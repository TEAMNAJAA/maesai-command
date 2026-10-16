/* ══════════════════════════════════════════════════════════════════════════
   BOAT ROUTE PLANNER (act 2) — candidate routes and their hazards
   ทุกเที่ยวเรือ: ฐาน → จุดติดค้าง → ปลายทาง (จุดอพยพ/โรงพยาบาล) → กลับฐาน
   ผู้เล่นต้องเลือกเส้นทางเอง · เส้นทางที่ดีที่สุด = สั้นที่สุดในกลุ่มที่ปลอดภัย
   อันตราย: กระแสน้ำแรงริมแม่น้ำ · โซนน้ำลึกที่ยังไม่สูบ · โซนไฟฟ้ารั่วที่ยังไม่ตัดไฟ
   ══════════════════════════════════════════════════════════════════════════ */

import { ACT2, BOAT } from '../config/missionConfig'
import { routeOffline, metres, distToPolylineM, saiRiver } from './geo'
import { sectionAt } from './sections'
import { depthAt } from './sim'

export const VARIANTS = [
  { id: 'short', th: 'เส้นทางสั้นที่สุด', tech: 'Shortest path' },
  { id: 'inland', th: 'เลี่ยงแนวริมแม่น้ำ', tech: 'River-avoiding path' },
  { id: 'main', th: 'ถนนสายหลัก', tech: 'Main-road path' },
]

const riverM = (p) => (saiRiver.length ? Math.min(...saiRiver.map((f) => distToPolylineM(p, f.geometry.coordinates))) : Infinity)

function leg(from, to, variant, blockedRoads) {
  const debris = (mid, e) => blockedRoads.has(e?.osm)
  const near = (mid) => metres(mid, from) < 220 || metres(mid, to) < 220
  if (variant === 'short') return routeOffline(from, to, debris, () => 1)
  if (variant === 'inland') return routeOffline(from, to, (mid, e) => debris(mid, e) || (!near(mid) && riverM(mid) <= ACT2.riverBandM + 40), () => 1)
  return routeOffline(from, to, debris, (e) => (e.major ? 1 : 2.4))
}

/** Hazards met along a route at minute t (endpoints' own surroundings excluded). */
export function routeHazards(s, scn, coords, t, ends) {
  const hz = new Set()
  const powerOn = (id) => scn.powerHazards.some((p) => p.id === id && t >= p.at) && !s.powerCut[id]
  for (let i = 1; i < coords.length - 1; i++) {
    const p = coords[i]
    if (ends.some((e) => metres(p, e) < 200)) continue
    if (riverM(p) <= ACT2.riverBandM) hz.add('river')
    const sec = sectionAt(p)
    if (sec && metres(p, sec.c) < 900) {
      if (depthAt(s, sec, t) >= ACT2.deepWaterM) hz.add('deep')
      if (powerOn(sec.id)) hz.add('power')
    }
  }
  return [...hz]
}

export const HAZARD_TH = {
  river: 'กระแสน้ำแรงริมแม่น้ำ', deep: 'โซนน้ำลึกไหลเชี่ยว (ยังไม่สูบน้ำ)', power: 'โซนไฟฟ้ารั่ว (ยังไม่ตัดไฟ)',
}

/**
 * Candidate trips camp → point → destination. Each: coords, distances, minutes, fuel, hazards.
 * The optimal option is the shortest one with no hazard.
 */
export function planTrip(s, scn, camp, point, dest, t) {
  const blocked = new Set(scn.blockedRoads)
  const from = [camp.lon, camp.lat], at = [point.lon, point.lat], to = dest ? [dest.lon, dest.lat] : from
  const options = []
  for (const v of VARIANTS) {
    const a = leg(from, at, v.id, blocked)
    const b = leg(at, to, v.id, blocked)
    if (!a || !b) continue
    const back = dest ? leg(to, from, 'main', blocked) : null
    const coords = [...a.coords, ...b.coords]
    const outM = a.distanceM + b.distanceM, backM = back ? back.distanceM : 0
    const hazards = routeHazards(s, scn, coords, t, [from, at, to])
    const sig = Math.round(outM / 25)
    if (options.some((o) => Math.round(o.distanceM / 25) === sig && o.hazards.join() === hazards.join())) continue
    options.push({
      variant: v.id, th: v.th, tech: v.tech, coords, back: back?.coords || [],
      leg1M: a.distanceM, leg2M: b.distanceM, backM, splitAt: a.coords.length,
      distanceM: outM, totalM: outM + backM,
      minutes: Math.round((outM / 1000 / BOAT.speedKmh) * 60),
      fuelL: +(((outM + backM) / 1000) * BOAT.fuelLPerKm).toFixed(1),
      hazards, safe: hazards.length === 0, steps: [...new Set([...(a.steps || []), ...(b.steps || [])])].slice(0, 4),
    })
  }
  const safe = options.filter((o) => o.safe)
  const best = safe.length ? safe.reduce((m, o) => (o.distanceM < m.distanceM ? o : m)) : null
  return { options, best }
}

/** Grade the player's choice against the optimal option. */
export function gradeChoice(plan, chosen) {
  if (!chosen.safe) return { kind: 'unsafe', th: `เส้นทางผิด: ผ่าน${chosen.hazards.map((h) => HAZARD_TH[h]).join(' และ ')}` }
  if (plan.best && chosen.distanceM > plan.best.distanceM * 1.12) {
    return { kind: 'long', th: `คำนวณเส้นทางไม่คุ้ม: ยาวกว่าเส้นทางที่ดีที่สุด ${((chosen.distanceM - plan.best.distanceM) / 1000).toFixed(2)} กม.` }
  }
  return { kind: 'ok', th: 'เส้นทางถูกต้อง' }
}

/** Point on a polyline after `frac` (0–1) of its length — for animating boats. */
export function alongRoute(coords, frac) {
  if (!coords?.length) return null
  if (coords.length === 1 || frac <= 0) return coords[0]
  const seg = []
  let total = 0
  for (let i = 1; i < coords.length; i++) { const d = metres(coords[i - 1], coords[i]); seg.push(d); total += d }
  let target = Math.min(1, frac) * total
  for (let i = 0; i < seg.length; i++) {
    if (target <= seg[i]) {
      const u = seg[i] ? target / seg[i] : 0
      const a = coords[i], b = coords[i + 1]
      return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]
    }
    target -= seg[i]
  }
  return coords[coords.length - 1]
}
