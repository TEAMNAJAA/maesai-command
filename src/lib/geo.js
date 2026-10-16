/* ══════════════════════════════════════════════════════════════════════════
   GEO — Web-Mercator projection, GeoJSON helpers, offline road router
   ระบบพิกัดของแผนที่จริง: EPSG:3857 เพื่อให้ตรงกับ tiles ของ sphere และภาพ DEM
   ══════════════════════════════════════════════════════════════════════════ */

import { DATA, OFFLINE_ROUTING, SPHERE } from '../config/missionConfig'
import { COMMUNITIES } from '../config/scenarioData'

export const mercX = (lon) => (lon + 180) / 360
export const mercY = (lat) => {
  const r = (lat * Math.PI) / 180
  return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2
}
const unMercX = (x) => x * 360 - 180
const unMercY = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI

/** Fit bbox [W,S,E,N] into a W×H viewBox (contain, centred, with padding). */
export function makeProjection(bbox, W = 1000, H = 760, pad = 24) {
  const [w, s, e, n] = bbox
  const x0 = mercX(w), x1 = mercX(e), y0 = mercY(n), y1 = mercY(s)
  const k = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / (y1 - y0))
  const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2
  const x = (lon) => ox + (mercX(lon) - x0) * k
  const y = (lat) => oy + (mercY(lat) - y0) * k
  const lat0 = (s + n) / 2
  const metresPerPx = (40075016.686 * Math.cos((lat0 * Math.PI) / 180)) / k
  return {
    bbox, W, H, k, x, y, metresPerPx,
    pt: ([lon, lat]) => [x(lon), y(lat)],
    toLonLat: (px, py) => [unMercX((px - ox) / k + x0), unMercY((py - oy) / k + y0)],
    rect: ([bw, bs, be, bn]) => ({ x: x(bw), y: y(bn), w: x(be) - x(bw), h: y(bs) - y(bn) }),
  }
}

export function linePath(coords, proj) {
  let d = ''
  for (let i = 0; i < coords.length; i++) {
    const [px, py] = proj.pt(coords[i])
    d += `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`
  }
  return d
}

export function geomPath(geometry, proj) {
  if (!geometry) return ''
  const ring = (r) => linePath(r, proj) + 'Z'
  switch (geometry.type) {
    case 'Polygon': return geometry.coordinates.map(ring).join(' ')
    case 'MultiPolygon': return geometry.coordinates.flatMap((p) => p.map(ring)).join(' ')
    case 'LineString': return linePath(geometry.coordinates, proj)
    case 'MultiLineString': return geometry.coordinates.map((l) => linePath(l, proj)).join(' ')
    default: return ''
  }
}

/** Distance in metres between two lon/lat points (equirectangular — fine at town scale). */
export function metres([lon1, lat1], [lon2, lat2]) {
  const kx = 111320 * Math.cos((((lat1 + lat2) / 2) * Math.PI) / 180)
  return Math.hypot((lon2 - lon1) * kx, (lat2 - lat1) * 110540)
}

export function distToPolylineM(p, coords) {
  let best = Infinity
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180), ky = 110540
  for (let i = 1; i < coords.length; i++) {
    const ax = (coords[i - 1][0] - p[0]) * kx, ay = (coords[i - 1][1] - p[1]) * ky
    const bx = (coords[i][0] - p[0]) * kx, by = (coords[i][1] - p[1]) * ky
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy
    const t = L2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / L2)) : 0
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy))
  }
  return best
}

export function pointInPolygon([x, y], ring) {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}
export function pointInGeometry(p, g) {
  if (!g) return false
  if (g.type === 'Polygon') return pointInPolygon(p, g.coordinates[0])
  if (g.type === 'MultiPolygon') return g.coordinates.some((poly) => pointInPolygon(p, poly[0]))
  return false
}

/** Mean of every vertex of any GeoJSON geometry (good enough to place a marker). */
export function geomCentroid(g) {
  const pts = []
  const walk = (c) => (typeof c[0] === 'number' ? pts.push(c) : c.forEach(walk))
  if (g?.coordinates) walk(g.coordinates)
  if (!pts.length) return null
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length]
}

/** Rectangle around a centre, `wKm` × `hKm`. Returns [W,S,E,N]. */
export function boxKm(lon, lat, wKm, hKm) {
  const dLon = wKm / (111.32 * Math.cos((lat * Math.PI) / 180)) / 2, dLat = hKm / 110.54 / 2
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat]
}

/* ── AOI file access ─────────────────────────────────────────────────────── */

const aoi = DATA.aoi?.features || []
export const aoiFeature = (id) => aoi.find((f) => f.properties?.id === id)
export const aoiStations = aoi.filter((f) => f.properties?.kind === 'station')
export const aoiRiver = aoi.find((f) => f.geometry?.type === 'LineString')

/** Community geometry: polygon from the AOI file if present, else point + radius (approximate). */
export const communityGeo = COMMUNITIES.map((c) => {
  const f = aoi.find((x) => x.properties?.kind === 'community' && (x.properties.name || '').includes(c.th))
  if (f?.geometry?.type === 'Polygon' || f?.geometry?.type === 'MultiPolygon') {
    const ring = f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0]
    const lon = ring.reduce((a, p) => a + p[0], 0) / ring.length, lat = ring.reduce((a, p) => a + p[1], 0) / ring.length
    return { ...c, lon, lat, geometry: f.geometry, source: 'aoi-polygon', approx: false }
  }
  if (f?.geometry?.type === 'Point') {
    const [lon, lat] = f.geometry.coordinates
    return { ...c, lon, lat, source: 'aoi-point', approx: true, note: f.properties.note }
  }
  return { ...c, source: 'config', approx: true }
})

/* ── OSM layers ──────────────────────────────────────────────────────────── */

const osm = DATA.osm?.features || []
export const osmRivers = osm.filter((f) => f.properties.kind === 'river')
export const osmRoads = osm.filter((f) => f.properties.kind === 'road')
export const saiRiver = osmRivers.filter((f) => /แม่สาย|Mae Sai/.test(f.properties.name + f.properties.name_en))
const MAJOR = /^(trunk|primary|secondary|tertiary)/
/** A street segment counts as flooded within the configured buffer of the Sai River (act 2 scenario). */
export const isFloodedStreet = (p) => saiRiver.some((f) => distToPolylineM(p, f.geometry.coordinates) < OFFLINE_ROUTING.floodBufferM)
export const roadWeight = (cls) => (MAJOR.test(cls) ? (cls.startsWith('trunk') ? 2.4 : 1.7) : 0.7)

/* ── DEM read-out ────────────────────────────────────────────────────────── */

export function elevationAt(dem, lon, lat) {
  if (!dem?.grid) return null
  const [W, S, E, N] = dem.bbox
  const fx = (mercX(lon) - mercX(W)) / (mercX(E) - mercX(W)), fy = (mercY(lat) - mercY(N)) / (mercY(S) - mercY(N))
  if (fx < 0 || fx >= 1 || fy < 0 || fy >= 1) return null
  return dem.grid.values[Math.floor(fy * dem.grid.h) * dem.grid.w + Math.floor(fx * dem.grid.w)]
}

/* ── Raster tiles (sphere basemap, EPSG:3857) ────────────────────────────── */

/** XYZ tiles covering the projection; `bias` asks for a sharper zoom so CSS zoom stays crisp. */
export function tilesFor(proj, template, maxTiles = 64, bias = 0, maxZ = SPHERE.maxZoom || 18) {
  if (!template) return []
  const [w, s, e, n] = proj.bbox
  let z = Math.round(Math.log2(proj.k / 256)) + bias
  z = Math.max(3, Math.min(maxZ, z))
  const out = []
  const span = (zz) => {
    const n2 = 2 ** zz
    return [Math.floor(mercX(w) * n2), Math.floor(mercX(e) * n2), Math.floor(mercY(n) * n2), Math.floor(mercY(s) * n2)]
  }
  let [tx0, tx1, ty0, ty1] = span(z)
  while ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > maxTiles && z > 3) { z -= 1;[tx0, tx1, ty0, ty1] = span(z) }
  const n2 = 2 ** z
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const lon0 = unMercX(tx / n2), lat0 = unMercY(ty / n2), lon1 = unMercX((tx + 1) / n2), lat1 = unMercY((ty + 1) / n2)
    out.push({ key: `${z}/${tx}/${ty}`, href: template.replace('{z}', z).replace('{x}', tx).replace('{y}', ty), ...proj.rect([lon0, lat1, lon1, lat0]) })
  }
  return out
}

/* ── Offline router over the OSM road graph (fallback for sphere Routing) ── */

let GRAPH = null
function graph() {
  if (GRAPH) return GRAPH
  const key = (p) => `${p[0]},${p[1]}`
  const nodes = new Map()   // key → { p, edges: [{ to, w, cls }] }
  const node = (p) => {
    const k = key(p)
    if (!nodes.has(k)) nodes.set(k, { k, p, edges: [] })
    return nodes.get(k)
  }
  for (const f of osmRoads) {
    const c = f.geometry.coordinates
    const major = MAJOR.test(f.properties.class)
    const osm = f.properties.osm, name = f.properties.name
    for (let i = 1; i < c.length; i++) {
      const a = node(c[i - 1]), b = node(c[i]), w = metres(c[i - 1], c[i])
      const mid = [(c[i - 1][0] + c[i][0]) / 2, (c[i - 1][1] + c[i][1]) / 2]
      a.edges.push({ to: b, w, major, osm, name, mid })
      b.edges.push({ to: a, w, major, osm, name, mid })
    }
  }
  GRAPH = { nodes: [...nodes.values()] }
  return GRAPH
}

function nearestNode(p, ok = () => true) {
  let best = null, bd = Infinity
  for (const n of graph().nodes) {
    if (!n.edges.length || !ok(n)) continue
    const d = metres(p, n.p)
    if (d < bd) { bd = d; best = n }
  }
  return best
}

/** Default edge weighting: a convoy prefers main roads. */
const convoyCost = (e) => (e.major ? 1 : 1.35)

/**
 * Shortest path from `from` to `to` (lon/lat). `blocked(midLonLat, edge)` closes a road
 * segment (flooded / debris); `mult(edge)` scales its cost. Returns null if unreachable.
 */
export function routeOffline(from, to, blocked = () => false, mult = convoyCost) {
  const a = nearestNode(from), b = nearestNode(to)
  if (!a || !b) return null
  const dist = new Map([[a.k, 0]]), prev = new Map(), done = new Set()
  const heap = [[0, a]]
  const pushH = (item) => {
    heap.push(item)
    let i = heap.length - 1
    while (i > 0) { const j = (i - 1) >> 1; if (heap[j][0] <= heap[i][0]) break;[heap[i], heap[j]] = [heap[j], heap[i]]; i = j }
  }
  const popH = () => {
    const top = heap[0], last = heap.pop()
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1, r = l + 1
        let m = i
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === i) break;[heap[i], heap[m]] = [heap[m], heap[i]]; i = m
      }
    }
    return top
  }
  while (heap.length) {
    const [d, n] = popH()
    if (done.has(n.k)) continue
    done.add(n.k)
    if (n === b) break
    for (const e of n.edges) {
      if (done.has(e.to.k) || blocked(e.mid, e)) continue
      const nd = d + e.w * mult(e)
      if (nd < (dist.get(e.to.k) ?? Infinity)) { dist.set(e.to.k, nd); prev.set(e.to.k, [n, e.w, e.name]); pushH([nd, e.to]) }
    }
  }
  if (!done.has(b.k)) return null
  const coords = [], seen = new Set(), names = []
  let cur = b, metresTotal = 0
  while (cur && !seen.has(cur.k)) {
    seen.add(cur.k); coords.push(cur.p)
    const pr = prev.get(cur.k)
    if (!pr) break
    metresTotal += pr[1]; if (pr[2]) names.push(pr[2]); cur = pr[0]
  }
  coords.reverse(); names.reverse()
  return { coords: [from, ...coords, to], distanceM: metresTotal + metres(from, coords[0]) + metres(coords[coords.length - 1], to), steps: names.filter((x, i) => x && x !== names[i - 1]) }
}
