/* ══════════════════════════════════════════════════════════════════════════
   REAL BUILDINGS — GISTDA BD_footprintTH clipped to Mae Sai (AOI-A ∩ อ.แม่สาย)
   ผูกหลังคาเรือนจริงเข้ากับตรรกะเกม:
     · โซนน้ำถึงต่อหลังคา (เรดาร์จริงถ้ามี ไม่งั้นใช้กติกา FLOOD_REACH)
     · แบ่งหลังคาให้ 4 ชุมชน → ค่า P จริง = หลังคาในโซนน้ำถึง ÷ หลังคาทั้งหมดของชุมชน
     · เลือกหลังคาจริงให้กรณีเยียวยาในองก์ 3
   ══════════════════════════════════════════════════════════════════════════ */

import { DATA, FLOOD_REACH } from '../config/missionConfig'
import { COMMUNITIES, ROOFS } from '../config/scenarioData'
import { saiRiver, distToPolylineM, elevationAt, communityGeo, pointInGeometry, metres } from './geo'

/** Decode the compact format written by scripts/extract-buildings.mjs (or accept GeoJSON). */
function decode(src) {
  if (!src) return []
  if (src.type === 'FeatureCollection') {
    return src.features.map((f, i) => ({
      fid: f.properties?.FID ?? i,
      ring: f.geometry.type === 'Polygon' ? f.geometry.coordinates[0] : f.geometry.coordinates[0][0],
    }))
  }
  const [W, S] = src.bbox
  return src.rings.map((r, i) => {
    const ring = []
    let x = 0, y = 0
    for (let k = 0; k < r.length; k += 2) {
      x = k ? x + r[k] : r[k]; y = k ? y + r[k + 1] : r[k + 1]
      ring.push([W + x / src.q, S + y / src.q])
    }
    return { fid: src.fid[i], ring }
  })
}

const radar = DATA.radarFlood?.features || []
const dem = DATA.dem.urban

export const BUILDINGS = decode(DATA.buildings).map((b) => {
  const c = [b.ring.reduce((a, p) => a + p[0], 0) / b.ring.length, b.ring.reduce((a, p) => a + p[1], 0) / b.ring.length]
  const riverM = saiRiver.length ? Math.min(...saiRiver.map((f) => distToPolylineM(c, f.geometry.coordinates))) : Infinity
  const elev = elevationAt(dem, c[0], c[1])
  const flood = radar.length
    ? radar.some((f) => pointInGeometry(c, f.geometry))
    : riverM <= FLOOD_REACH.riverNearM || (riverM <= FLOOD_REACH.riverFarM && elev !== null && elev <= FLOOD_REACH.maxElevM)
  // nearest watch community within the zone radius
  let community = null, best = FLOOD_REACH.communityZoneM
  for (const cg of communityGeo) {
    const d = metres(c, [cg.lon, cg.lat])
    if (d <= best) { best = d; community = cg.id }
  }
  // planar area (m²) — used to pick ordinary house roofs for the relief cases
  const kx = 111320 * Math.cos((c[1] * Math.PI) / 180), ky = 110540
  let a2 = 0
  for (let i = 0; i < b.ring.length; i++) {
    const p = b.ring[i], q = b.ring[(i + 1) % b.ring.length]
    a2 += p[0] * kx * q[1] * ky - q[0] * kx * p[1] * ky
  }
  return { ...b, c, riverM, elev, flood, community, areaM2: Math.abs(a2 / 2) }
})

export const HAS_BUILDINGS = BUILDINGS.length > 0
export const FLOOD_SOURCE = radar.length ? 'radar' : 'model'     // provenance of the flood-reach zone
export const AOI_ROOFS = BUILDINGS.length
export const AOI_FLOOD_ROOFS = BUILDINGS.filter((b) => b.flood).length

/** Per-community roof counts from the real footprints. */
export const COMMUNITY_ROOFS = Object.fromEntries(COMMUNITIES.map((c) => {
  const mine = BUILDINGS.filter((b) => b.community === c.id)
  return [c.id, { roofs: mine.length, flood: mine.filter((b) => b.flood).length }]
}))

/**
 * Communities with live numbers: households → real roofs in the zone, P → real share
 * of those roofs inside the flood reach. Falls back to the scenario values if the
 * building layer is missing or a zone is empty.
 */
export const COMMUNITIES_LIVE = COMMUNITIES.map((c) => {
  const g = communityGeo.find((x) => x.id === c.id) || c
  const r = COMMUNITY_ROOFS[c.id]
  const real = HAS_BUILDINGS && r.roofs >= 10
  return {
    ...c, lon: g.lon, lat: g.lat, approx: g.approx,
    households: real ? r.roofs : c.households,
    P: real ? r.flood / r.roofs : c.P,
    floodRoofs: real ? r.flood : Math.round(c.households * c.P),
    pSource: real ? 'buildings' : 'scenario',
  }
})

/**
 * Act 3 cases on real roofs: each scenario case (inundation days, mud signature,
 * confidence, field truth) is attached to a real building of the same community
 * that lies inside the flood reach. Deterministic, so the ledger is stable.
 */
export const ROOFS_LIVE = (() => {
  const used = new Set()
  return ROOFS.map((r, i) => {
    const cid = COMMUNITIES.find((c) => c.name === r.com)?.id
    const house = (b) => b.areaM2 >= 50 && b.areaM2 <= 400        // household-sized roofs, not warehouses
    const pool = BUILDINGS.filter((b) => b.community === cid && b.flood && house(b) && !used.has(b.fid)).sort((a, b) => a.fid - b.fid)
    if (!pool.length) return { ...r, real: false }
    const b = pool[(i * 7919 + 13) % pool.length]
    used.add(b.fid)
    return { ...r, id: `BD-${b.fid}`, caseId: r.id, fid: b.fid, ring: b.ring, c: b.c, elev: b.elev, areaM2: b.areaM2, real: true }
  })
})()
