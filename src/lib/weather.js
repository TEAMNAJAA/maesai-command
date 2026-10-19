/* ══════════════════════════════════════════════════════════════════════════
   WEATHER (C3) — what the sky over Mae Sai looks like at the current mission time
   มาจากแบบจำลองเดียวกับเกมเท่านั้น: ฝนสะสมที่สถานี R (rainAt) · เมฆเหนือลุ่มน้ำ (cloudAt) · ช่วงวิกฤตรอบ T0
   และพายุ "หลังจากที่เกิดแล้ว" — ไม่บอกล่วงหน้าว่าพายุ/เมฆจะมาเมื่อไร (กติกา: ห้ามเผยสิ่งที่ผู้เล่นยังไม่รู้)
   ══════════════════════════════════════════════════════════════════════════ */

import { rainAt, cloudAt } from './hydro'

const clamp01 = (x) => Math.max(0, Math.min(1, x))

/** { rain 0–1, lightning 0–1, wind 0–1 } — a pure function of the state the player already sees. */
export function weatherAt(s, scn) {
  if (!s || s.act >= 3) return { rain: 0, lightning: 0, wind: 0 }
  const t = s.clock
  const rate = Math.max(0, rainAt(t + 60) - rainAt(t))                         // mm/h at the upstream gauge
  const base = clamp01(rate / 5.5) * (0.35 + (0.65 * cloudAt(t)) / 100)
  // the hours around T0: the flood wave arrives in the heaviest rain
  const crisis = s.act === 1 ? clamp01((t + 360) / 360) : clamp01(1 - t / 480)
  // the act-2 storm shows only once it has struck (s.stormHit), then passes over about 3 h
  const storm = s.act === 2 && s.stormHit && scn?.stormAt !== undefined ? clamp01(1 - (t - scn.stormAt) / 180) : 0
  return {
    rain: Math.max(base, 0.9 * crisis, storm),
    lightning: Math.max(storm, 0.7 * crisis),
    wind: clamp01(0.25 + 0.75 * Math.max(storm, crisis)),
  }
}
