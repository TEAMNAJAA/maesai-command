import { describe, it, expect, beforeEach } from 'vitest'
import { makeScenario } from '../src/lib/scenario'
import { makeInitial, advanceTo, enterAct2, campOf, destOf } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { planTrip, gradeChoice, hazardMarks, routeHazards } from '../src/lib/routes'
import { fetchBoatLegs, sphereLeg, clearSphereCache, midpointOf } from '../src/lib/sphereRoutes'
import { metres, saiRiver } from '../src/lib/geo'

const lineM = (pts) => pts.slice(1).reduce((a, p, i) => a + metres(pts[i], p), 0)

/** Act 2 with stranded points, base at the district office. */
function act2(seed = 4242) {
  const scn = makeScenario(seed)
  let s = makeInitial('beginner', seed)
  s = A.setCamp(s, scn, 'cmp-amp')
  s = advanceTo(s, scn, 0)
  s = enterAct2(s, scn)
  return { s, scn }
}

/** Stub Sphere: a straight road between the endpoints, optionally bent through `via`. */
const stub = (via = null, calls = []) => async (from, to, mode) => {
  calls.push({ from, to, mode })
  const coords = via ? [from, via(from, to, mode), to] : [from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2], to]
  return { coords, distanceM: lineM(coords) * (mode === 'd' ? 0.97 : 1), durationS: 60, steps: ['ถนนทดสอบ'] }
}

describe('boat routes from GISTDA Sphere', () => {
  beforeEach(() => clearSphereCache())

  it('Sphere options come first, carry their source, and every option is hazard-checked', async () => {
    const { s, scn } = act2()
    const p = s.points[0], camp = campOf(s), dest = destOf(scn.shelters[0])
    const legs = await fetchBoatLegs({ s, scn, camp, point: p, dest, route: stub() })
    expect(legs).not.toBeNull()
    const plan = planTrip(s, scn, camp, p, dest, s.clock, legs)
    const sources = plan.options.map((o) => o.source)
    expect(sources[0]).toBe('sphere')
    expect(sources).toContain('offline')
    expect(sources.lastIndexOf('sphere')).toBeLessThan(sources.indexOf('offline'))
    for (const o of plan.options) {
      expect(o.hazards).toEqual(routeHazards(s, scn, o.coords, s.clock, [[camp.lon, camp.lat], [p.lon, p.lat], [dest.lon, dest.lat]]))
      expect(o.coords[0]).toEqual([camp.lon, camp.lat])           // snapped to the base
      expect(o.coords[o.splitAt - 1]).toEqual([p.lon, p.lat])     // the out leg ends at the stranded point
      expect(o.fuelL).toBeGreaterThan(0)
    }
    if (plan.best) {
      const safe = plan.options.filter((o) => o.safe)
      expect(plan.best.distanceM).toBe(Math.min(...safe.map((o) => o.distanceM)))
      expect(gradeChoice(plan, plan.best).kind).toBe('ok')
    }
  })

  it('a supply run has no destination: out to the point and straight back, no separate return leg', async () => {
    const { s, scn } = act2()
    const p = s.points[0], camp = campOf(s)
    const legs = await fetchBoatLegs({ s, scn, camp, point: p, dest: null, route: stub() })
    const plan = planTrip(s, scn, camp, p, null, s.clock, legs)
    const sph = plan.options.find((o) => o.source === 'sphere')
    expect(sph.back).toEqual([])
    expect(sph.coords[sph.coords.length - 1]).toEqual([camp.lon, camp.lat])
  })

  it('legs are cached per endpoint pair and mode', async () => {
    const calls = []
    const route = stub(null, calls)
    const a = [99.88, 20.43], b = [99.89, 20.44]
    await sphereLeg(a, b, 'c', route); await sphereLeg(a, b, 'c', route); await sphereLeg(a, b, 'd', route)
    expect(calls).toHaveLength(2)
  })

  it('Sphere failing or timing out → null, and the planner still offers the offline routes', async () => {
    const { s, scn } = act2()
    const p = s.points[0], camp = campOf(s), dest = destOf(scn.shelters[0])
    const legs = await fetchBoatLegs({ s, scn, camp, point: p, dest, route: async () => { throw new Error('timeout') } })
    expect(legs).toBeNull()
    const plan = planTrip(s, scn, camp, p, dest, s.clock, legs)
    expect(plan.options.length).toBeGreaterThan(0)
    expect(plan.options.every((o) => o.source === 'offline')).toBe(true)
  })

  it('when every direct Sphere route is hazardous it asks again through a safe offline route', async () => {
    // late in act 2 the water is down; the stub forces every direct Sphere leg through the river (strong current)
    for (const seed of [4242, 11, 202, 3003, 77]) {
      clearSphereCache()
      let { s, scn } = act2(seed)
      s = advanceTo(s, scn, 30 * 60)
      const camp = campOf(s), dest = destOf(scn.shelters[0])
      const ends = (p) => [[camp.lon, camp.lat], [p.lon, p.lat], [dest.lon, dest.lat]]
      const riverPts = saiRiver.flatMap((f) => f.geometry.coordinates)
      for (const p of s.points) {
        const e = ends(p)
        const isTripLeg = (f, t) => e.some((x) => x[0] === f[0] && x[1] === f[1]) && e.some((x) => x[0] === t[0] && x[1] === t[1])
        const bend = (f, t) => riverPts.filter((q) => e.every((x) => metres(q, x) > 400)).sort((q1, q2) => (metres(q1, f) + metres(q1, t)) - (metres(q2, f) + metres(q2, t)))[0]
        const route = async (f, t, mode) => {
          const coords = isTripLeg(f, t) ? [f, bend(f, t), t] : [f, t]
          return { coords, distanceM: lineM(coords), durationS: 60, steps: [] }
        }
        const legs = await fetchBoatLegs({ s, scn, camp, point: p, dest, route })
        const plan0 = planTrip(s, scn, camp, p, dest, s.clock, { ...legs, detour: null })
        const direct = plan0.options.filter((o) => o.source === 'sphere')
        const safeOffline = plan0.options.some((o) => o.source === 'offline' && o.safe)
        if (direct.length && direct.every((o) => !o.safe) && safeOffline) {
          expect(legs.detour).not.toBeNull()
          expect(legs.detour.via).toHaveLength(2)
          const plan = planTrip(s, scn, camp, p, dest, s.clock, legs)
          expect(plan.options.some((o) => o.variant === 'sphere-via')).toBe(true)
          return
        }
      }
    }
    throw new Error('no seed produced a hazardous-Sphere / safe-offline trip to exercise the detour')
  })

  it('hazard marks sit on the route and only where a hazard is', () => {
    const { s, scn } = act2()
    const p = s.points[0], camp = campOf(s), dest = destOf(scn.shelters[0])
    const plan = planTrip(s, scn, camp, p, dest, s.clock)
    for (const o of plan.options) {
      const marks = hazardMarks(s, scn, o.coords, s.clock, [[camp.lon, camp.lat], [p.lon, p.lat], [dest.lon, dest.lat]])
      if (o.safe) expect(marks).toHaveLength(0)
      for (const m of marks) expect(o.coords.some((c) => c === m.p)).toBe(true)
    }
  })

  it('midpointOf splits a line by length', () => {
    const m = midpointOf([[0, 0], [0.001, 0], [0.003, 0]])
    expect(m[0]).toBeCloseTo(0.0015, 6)
  })
})
