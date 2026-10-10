/* Formatting helpers shared by every module. */

import { EVENT } from '../config/missionConfig'

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const fmt = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
export const baht = (n) => '฿ ' + fmt(n)
export const pad2 = (n) => String(Math.abs(Math.trunc(n))).padStart(2, '0')
export const pct = (v, d = 0) => `${fmt(v * 100, d)}%`

/** Format the mission clock: negative = before peak flood. */
export function clockLabel(min) {
  const h = Math.trunc(min / 60), m = Math.abs(min % 60)
  const sign = min < 0 ? '−' : '+'
  return `T${sign}${pad2(h)}:${pad2(m)}`
}

/** Headline clock, mock-up styling: "T−48 Hrs" / "T+0 Hrs" / "T+6:30 Hrs". */
export function clockHeadline(min) {
  const h = Math.trunc(Math.abs(min) / 60), m = Math.abs(min % 60)
  const sign = min < 0 ? '−' : '+'
  return `T${sign}${h}${m ? ':' + pad2(m) : ''} Hrs`
}

const T0 = Date.parse(EVENT.t0ISO)

/** Mission clock → real calendar date of the September 2024 event (Thai, Bangkok time). */
export function clockToDate(min, withTime = true) {
  const d = new Date(T0 + min * 60000)
  try {
    return d.toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit',
      ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
    })
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ')
  }
}

/** Seconds → "m:ss" */
export function mmss(sec) {
  const s = Math.max(0, Math.round(sec))
  return `${Math.floor(s / 60)}:${pad2(s % 60)}`
}
