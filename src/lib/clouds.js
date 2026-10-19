/* ══════════════════════════════════════════════════════════════════════════
   CLOUDS OVER TOWN (act 2) — drifting cells, 35–65 % of AOI-A at any moment
   เมฆเคลื่อนผ่านเมืองตามลม ไม่ได้ปิดทั้งหมด → THEOS-2 ถ่ายเห็นเฉพาะโซนที่เมฆเปิด
   ══════════════════════════════════════════════════════════════════════════ */

import { ACT2 } from '../config/missionConfig'
import { SECTIONS } from './sections'

export const CLOUD_BOX = [99.858, 20.422, 99.91, 20.458]       // the operations window over town
const KX = 111320 * Math.cos((20.44 * Math.PI) / 180), KY = 110540
const WM = (CLOUD_BOX[2] - CLOUD_BOX[0]) * KX, HM = (CLOUD_BOX[3] - CLOUD_BOX[1]) * KY

/** Share of the town under cloud at mission minute t (0.35–0.65). */
export function cloudCover(scn, t) {
  const c = scn.clouds
  const k = Math.sin(((t / 60) / c.periodH) * Math.PI * 2 + c.phase)
  const base = (ACT2.cloudMinPct + (ACT2.cloudMaxPct - ACT2.cloudMinPct) * (0.5 + 0.5 * k)) / 100
  return Math.min(0.9, base + (c.bonus || 0))                // Stress Test "data loss": thicker cloud
}

/** Cloud cells at t as {lon, lat, rM}; positions wrap around the window so cover stays steady. */
export function cloudCells(scn, t) {
  const c = scn.clouds
  const cov = cloudCover(scn, t)
  const n = c.blobs.length
  const meanR2 = c.blobs.reduce((a, b) => a + b.r * b.r, 0) / n
  // Boolean model: cover = 1 − exp(−n·π·r²/A) → solve r for the target cover
  const r0 = Math.sqrt((-Math.log(1 - cov) * WM * HM) / (n * Math.PI * meanR2))
  const km = (ACT2.windKmh * t) / 60 * 1000
  const du = (km * Math.cos(c.dir)) / WM, dv = (km * Math.sin(c.dir)) / HM
  return c.blobs.map((b) => {
    const u = (((b.u + du) % 1) + 1) % 1, v = (((b.v + dv) % 1) + 1) % 1
    return { lon: CLOUD_BOX[0] + u * (CLOUD_BOX[2] - CLOUD_BOX[0]), lat: CLOUD_BOX[1] + v * (CLOUD_BOX[3] - CLOUD_BOX[1]), rM: r0 * b.r }
  })
}

/** Is a lon/lat point under cloud? (wrapped copies count) */
export function underCloud(cells, [lon, lat]) {
  for (const c of cells) {
    for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) {
      const x = (lon - (c.lon + ox * (CLOUD_BOX[2] - CLOUD_BOX[0]))) * KX
      const y = (lat - (c.lat + oy * (CLOUD_BOX[3] - CLOUD_BOX[1]))) * KY
      if (x * x + y * y <= c.rM * c.rM) return true
    }
  }
  return false
}

/** Share of a section's sample points (centroid + hull) under cloud. */
export function sectionCloudShare(cells, sec) {
  const pts = [sec.c, ...sec.hull.filter((_, i) => i % 2 === 0)]
  return pts.filter((p) => underCloud(cells, p)).length / pts.length
}

/** Sections a THEOS-2 pass can see at minute t (cloud share < 50 %). */
export function clearSections(scn, t) {
  const cells = cloudCells(scn, t)
  return SECTIONS.filter((s) => sectionCloudShare(cells, s) < 0.5).map((s) => s.id)
}
