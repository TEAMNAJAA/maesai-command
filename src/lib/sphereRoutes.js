/* ══════════════════════════════════════════════════════════════════════════
   BOAT ROUTES FROM GISTDA SPHERE (act 2)
   Fetches the legs of a rescue trip from the Sphere Routing API —
   base → stranded point → destination, plus the way back — in two modes
   (c = fastest, d = shortest). If every Sphere route crosses a hazard the game
   knows about (deep water, live current, river current), it asks Sphere again
   through a waypoint taken from a safe offline route ("Sphere + จุดแวะ").
   Sphere does not know about the flood: lib/routes.js checks every option.
   Offline / no key / timeout → resolves null and the planner keeps the
   offline (OSM) routes. Legs are cached per endpoint pair and mode.
   ══════════════════════════════════════════════════════════════════════════ */

import { sphereRoute as liveRoute } from './sphere'
import { planTrip } from './routes'
import { metres } from './geo'

const cache = new Map()                       // "lon,lat>lon,lat@mode" → Promise<leg|null>
const key = (a, b, m) => `${a[0].toFixed(5)},${a[1].toFixed(5)}>${b[0].toFixed(5)},${b[1].toFixed(5)}@${m}`

/** One leg from Sphere, snapped to the exact endpoints so boats start and stop where they should. */
export function sphereLeg(from, to, mode, route = liveRoute) {
  const k = key(from, to, mode)
  if (!cache.has(k)) {
    cache.set(k, route(from, to, mode)
      .then((r) => (r && r.coords?.length ? { ...r, coords: [from, ...r.coords, to], source: 'sphere' } : null))
      .catch(() => null))
  }
  return cache.get(k)
}

export const clearSphereCache = () => cache.clear()

/** Point halfway along a polyline (by length). */
export function midpointOf(coords) {
  if (!coords?.length) return null
  let total = 0
  const seg = []
  for (let i = 1; i < coords.length; i++) { const d = metres(coords[i - 1], coords[i]); seg.push(d); total += d }
  let target = total / 2
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i]) { const u = seg[i] ? target / seg[i] : 0; const a = coords[i], b = coords[i + 1]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u] }
    target -= seg[i]
  }
  return coords[coords.length - 1]
}

const join = (x, y) => (x && y ? { coords: [...x.coords, ...y.coords.slice(1)], distanceM: x.distanceM + y.distanceM, durationS: (x.durationS || 0) + (y.durationS || 0), steps: [...(x.steps || []), ...(y.steps || [])], source: 'sphere' } : null)

/**
 * All Sphere legs for one trip. Resolves { modes: {c:{a,b}, d:{a,b}}, back, detour } or null when
 * Sphere returned nothing usable. `route` is injectable for tests.
 */
export async function fetchBoatLegs({ s, scn, camp, point, dest, route = liveRoute }) {
  const from = [camp.lon, camp.lat], at = [point.lon, point.lat], to = dest ? [dest.lon, dest.lat] : from
  const [ac, ad, bc, bd, back] = await Promise.all([
    sphereLeg(from, at, 'c', route), sphereLeg(from, at, 'd', route),
    sphereLeg(at, to, 'c', route), sphereLeg(at, to, 'd', route),
    dest ? sphereLeg(to, from, 'c', route) : Promise.resolve(null),
  ])
  const legs = { modes: { c: { a: ac, b: bc }, d: { a: ad, b: bd } }, back, detour: null }
  if (!(ac && bc) && !(ad && bd)) return null

  // every direct Sphere route hazardous → route Sphere through a safe offline route's midpoints
  const plan = planTrip(s, scn, camp, point, dest, s.clock, legs)
  const sphereOpts = plan.options.filter((o) => o.source === 'sphere')
  if (sphereOpts.length && sphereOpts.every((o) => !o.safe)) {
    const safe = plan.options.filter((o) => o.source === 'offline' && o.safe).sort((x, y) => x.distanceM - y.distanceM)[0]
    if (safe) {
      const wa = midpointOf(safe.coords.slice(0, safe.splitAt)), wb = midpointOf(safe.coords.slice(safe.splitAt - 1))
      const [a1, a2, b1, b2] = await Promise.all([sphereLeg(from, wa, 'c', route), sphereLeg(wa, at, 'c', route), sphereLeg(at, wb, 'c', route), sphereLeg(wb, to, 'c', route)])
      const a = join(a1, a2), b = join(b1, b2)
      if (a && b) legs.detour = { a, b, via: [wa, wb] }
    }
  }
  return legs
}
