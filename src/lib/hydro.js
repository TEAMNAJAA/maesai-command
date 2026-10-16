/* ══════════════════════════════════════════════════════════════════════════
   HYDRO — the scenario world as functions of the mission clock
   ระดับน้ำ / ฝนสะสม / เมฆเหนือลุ่มน้ำต้นน้ำ ขึ้นกับเวลาเท่านั้น (ผู้เล่นเปลี่ยนแม่น้ำไม่ได้)
   ══════════════════════════════════════════════════════════════════════════ */

import { HYDRO } from '../config/missionConfig'
import { clamp } from './format'

export const T_START = -48 * 60

export function levelAt(t) {
  const h = HYDRO
  if (t <= h.peakAtMin) {
    const span = h.peakAtMin - T_START
    const x = clamp((t - T_START) / span)
    const drift = (h.driftPerHour * (t - T_START)) / 60
    const driftPeak = (h.driftPerHour * span) / 60
    return h.baseLevel + drift + (h.peakLevel - h.baseLevel - driftPeak) * x ** h.riseExponent
  }
  return h.recessBase + (h.peakLevel - h.recessBase) * Math.exp(-(t - h.peakAtMin) / h.recessTauMin)
}

export function rainAt(t) {
  const h = HYDRO
  if (t <= 0) return h.rainStartMm + h.rainAddMm * ((Math.max(t, T_START) - T_START) / -T_START) ** 1.6
  return h.rainStartMm + h.rainAddMm + 0.8 * (Math.min(t, 1440) / 60)
}

/** Basin-average cloud over the upstream catchment (Myanmar). */
export function cloudAt(t) {
  const [c0, c1] = HYDRO.cloudEarlyPct
  if (t < -720) return c0 + (c1 - c0) * ((t - T_START) / (-720 - T_START))
  if (t < HYDRO.cloudFullAtMin) return c1 + (100 - c1) * ((t + 720) / (HYDRO.cloudFullAtMin + 720))
  if (t < HYDRO.cloudClearAtMin) return 100
  return Math.max(12, 100 - 88 * ((t - HYDRO.cloudClearAtMin) / 360))
}

export const worldAt = (t) => ({ level: levelAt(t), rain: rainAt(t), cloud: cloudAt(t) })

/** Level history for a sparkline: `hours` back from t, one point per `stepMin`. */
export function levelSeries(t, hours = 12, stepMin = 30) {
  const out = []
  for (let k = t - hours * 60; k <= t; k += stepMin) out.push(levelAt(Math.max(T_START, k)))
  return out
}

/** First mission minute at which the gauge reaches `stage` (searching forward from `from`). */
export function firstCrossing(stage, from = T_START, to = 36 * 60) {
  for (let t = from; t <= to; t += 5) if (levelAt(t) >= stage) return t
  return Infinity
}
