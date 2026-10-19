/* ══════════════════════════════════════════════════════════════════════════
   PREFS — การตั้งค่าของเครื่องนี้ (เสียง · โหมดประสิทธิภาพ · โหมดฝึกเจ้าหน้าที่)
   เก็บใน localStorage ของเครื่องเท่านั้น · URL ทับได้ชั่วคราว:
   ?mute ปิดเสียง · ?rec ปิดเสียง (สคริปต์อัดคลิป) · ?perf=lite โหมดประสิทธิภาพ · ?officer โหมดฝึกเจ้าหน้าที่
   ══════════════════════════════════════════════════════════════════════════ */

import { useSyncExternalStore } from 'react'

const KEY = 'maesai-command.prefs.v1'
const DEFAULTS = {
  music: true, sfx: true,
  musicVol: 0.32, sfxVol: 0.55,        // quiet by default — ambient, not in the way
  perf: 'auto',                        // 'auto' (switch on when the frame rate drops) · 'on' (lite) · 'off' (full)
  officer: false,                      // โหมดฝึกเจ้าหน้าที่: no chibi, boss, music or comic effects
}
const URLQ = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const OVERRIDE = {
  ...(URLQ.has('mute') || URLQ.has('rec') ? { music: false, sfx: false } : {}),
  ...(URLQ.get('perf') === 'lite' ? { perf: 'on' } : URLQ.get('perf') === 'full' ? { perf: 'off' } : {}),
  ...(URLQ.has('officer') ? { officer: URLQ.get('officer') !== '0' } : {}),
}

let stored = { ...DEFAULTS }
try { stored = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { /* private window */ }
let snapshot = { ...stored, ...OVERRIDE }
const subs = new Set()

export const prefs = {
  get: () => snapshot,
  /** Change settings; URL overrides stay in force for this page load only. */
  set(patch) {
    stored = { ...stored, ...patch }
    for (const k of Object.keys(patch)) delete OVERRIDE[k]
    snapshot = { ...stored, ...OVERRIDE }
    try { localStorage.setItem(KEY, JSON.stringify(stored)) } catch { /* ignore */ }
    subs.forEach((fn) => fn())
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
  rec: URLQ.has('rec'),
}

export const usePrefs = () => useSyncExternalStore(prefs.subscribe, prefs.get, prefs.get)
