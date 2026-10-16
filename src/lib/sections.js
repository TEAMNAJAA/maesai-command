/* ══════════════════════════════════════════════════════════════════════════
   SECTIONS — the town split into 10 operational zones built from real roofs
   แบ่งเขตเมืองแม่สายเป็น 10 โซนปฏิบัติการจากหลังคาจริงของ GISTDA (k-means)
   ใช้สั่งอพยพรายโซน ส่งอุปกรณ์รายโซน และคำนวณความลึกน้ำรายโซน
   ══════════════════════════════════════════════════════════════════════════ */

import { BUILDINGS } from './buildings'
import { communityGeo, metres } from './geo'
import { EMBANKMENT_GAPS } from './embankment'
import { COMMUNITIES } from '../config/scenarioData'
import poiRaw from '../data/osm_maesai_poi.geojson?raw'

const BOX = [99.866, 20.428, 99.902, 20.452]     // town core along the Sai, Thai bank
const MAX_RIVER_M = 1100
const K = 10
const DEPTH_GAIN = 1.6                           // m of street water per m of gauge above the zone's stage
const GAP_BOOST_M = 0.15                         // each open flood-wall gap next to a zone
const KX = 111320 * Math.cos((20.44 * Math.PI) / 180), KY = 110540

const thai = /[฀-๿]/
const POIS = JSON.parse(poiRaw).features
  .filter((f) => thai.test(f.properties.name) && ['place_of_worship', 'school', 'government', 'hospital', 'police'].includes(f.properties.kind))
  .map((f) => ({ name: f.properties.name, p: f.geometry.coordinates }))

function kmeans(pts, k) {
  const sorted = [...pts].sort((a, b) => a.c[0] - b.c[0])
  let C = Array.from({ length: k }, (_, i) => [...sorted[Math.floor(((i + 0.5) * sorted.length) / k)].c])
  for (let it = 0; it < 30; it++) {
    const acc = C.map(() => [0, 0, 0])
    for (const p of pts) {
      let bi = 0, bd = Infinity
      C.forEach((c, i) => { const d = ((p.c[0] - c[0]) * KX) ** 2 + ((p.c[1] - c[1]) * KY) ** 2; if (d < bd) { bd = d; bi = i } })
      p.k = bi; acc[bi][0] += p.c[0]; acc[bi][1] += p.c[1]; acc[bi][2]++
    }
    C = acc.map((a, i) => (a[2] ? [a[0] / a[2], a[1] / a[2]] : C[i]))
  }
  return C
}

/** Convex hull (monotone chain) of lon/lat points, pushed out by `bufM` metres from the centroid. */
function hull(points, centre, bufM = 45) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lo = [], up = []
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q) }
  for (const q of [...p].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q) }
  const h = [...lo.slice(0, -1), ...up.slice(0, -1)]
  return h.map(([x, y]) => {
    const dx = (x - centre[0]) * KX, dy = (y - centre[1]) * KY, d = Math.hypot(dx, dy) || 1
    return [x + ((dx / d) * bufM) / KX, y + ((dy / d) * bufM) / KY]
  })
}

const members = BUILDINGS
  .map((b, idx) => ({ b, idx, c: b.c }))
  .filter(({ c, b }) => c[0] >= BOX[0] && c[0] <= BOX[2] && c[1] >= BOX[1] && c[1] <= BOX[3] && b.riverM <= MAX_RIVER_M)

const CENTRES = members.length >= K ? kmeans(members, K) : []

export const SECTIONS = CENTRES
  .map((c, k) => {
    const m = members.filter((x) => x.k === k)
    const flood = m.filter((x) => x.b.flood).length
    const P = m.length ? flood / m.length : 0
    const riverM = m.reduce((a, x) => a + x.b.riverM, 0) / Math.max(1, m.length)
    const els = m.filter((x) => x.b.elev !== null)
    const elev = els.reduce((a, x) => a + x.b.elev, 0) / Math.max(1, els.length)
    // scenario flood model: zones with most roofs in the flood reach take water first
    const stage = Math.min(5.6, Math.max(4.0, 4.05 + 0.8 * (1 - P) + 0.0004 * riverM))
    // outline the zone's core (drop the farthest 12 % of roofs so stray houses don't balloon the hull)
    const byDist = m.map((x) => ({ p: x.c, d: (x.c[0] - c[0]) ** 2 * KX * KX + (x.c[1] - c[1]) ** 2 * KY * KY })).sort((a, b) => a.d - b.d)
    const core = byDist.slice(0, Math.max(4, Math.ceil(byDist.length * 0.88))).map((x) => x.p)
    return { k, c, roofs: m.length, floodRoofs: flood, P, riverM, elev, stage, idx: m.map((x) => x.idx), hull: hull(core, c, 25) }
  })
  .sort((a, b) => a.c[0] - b.c[0])
  .map((s, i) => {
    const coms = communityGeo.filter((g) => {
      let bi = null, bd = Infinity
      CENTRES.forEach((cc, j) => { const d = metres([g.lon, g.lat], cc); if (d < bd) { bd = d; bi = j } })
      return bi === s.k
    }).map((g) => g.id)
    return { ...s, id: `Z${i + 1}`, n: i + 1, communities: coms, households: s.roofs, floodHH: s.floodRoofs }
  })

/* Names: a watch community if the zone holds one, else the nearest landmark not already used. */
{
  const used = new Set()
  for (const s of SECTIONS) {
    const com = s.communities.map((cid) => COMMUNITIES.find((c) => c.id === cid)?.th).filter(Boolean).join(' · ')
    if (com) { s.name = com; continue }
    const near = POIS.map((p) => ({ ...p, d: metres(p.p, s.c) })).filter((p) => p.d < 900 && !used.has(p.name)).sort((a, b) => a.d - b.d)[0]
    if (near) { used.add(near.name); s.name = `ใกล้${near.name}` } else s.name = `ริมน้ำช่วงที่ ${s.n}`
  }
}

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]))

/** Section that contains (is nearest to) a lon/lat point. */
export function sectionAt(p) {
  let best = null, bd = Infinity
  for (const s of SECTIONS) { const d = metres(p, s.c); if (d < bd) { bd = d; best = s } }
  return best
}

/** Open flood-wall gaps next to each section (gap → nearest section). */
export const GAPS_BY_SECTION = (() => {
  const out = Object.fromEntries(SECTIONS.map((s) => [s.id, []]))
  for (const g of EMBANKMENT_GAPS) { const s = sectionAt([g.lon, g.lat]); if (s) out[s.id].push(g.id) }
  return out
})()

/**
 * Street water depth (m) in a section at gauge level `level`.
 * `openGaps` = unsealed gaps next to it (water enters earlier), `reliefM` = pumping.
 */
export function sectionDepth(sec, level, openGaps = 0, reliefM = 0) {
  const eff = sec.stage - Math.min(3, openGaps) * GAP_BOOST_M
  return Math.max(0, (level - eff) * DEPTH_GAIN - reliefM)
}

export const SECTION_COUNT = SECTIONS.length
