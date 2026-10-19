/* ══════════════════════════════════════════════════════════════════════════
   PERFORMANCE MODE (D5) — โหมดประหยัด สำหรับเครื่องโรงเรียน/โน้ตบุ๊กเก่า
   prefs.perf: 'auto' (เปิดเองเมื่อเฟรมเรตต่ำ หรือระบบขอลดการเคลื่อนไหว) · 'on' เปิดเสมอ · 'off' ภาพเต็ม
   เปิดแล้ว <html class="perf-lite"> → ซ่อน .fx-heavy (ฝน ฟ้าแลบ ระลอกน้ำ ประกายไฟ รอยคลื่น เงาเมฆ)
   ไม่สั่นจอ ตัวเลขไม่วิ่ง (lowMotion ใน ui/juice) — ข้อมูลและการตัดสินใจเหมือนเดิมทุกอย่าง
   ══════════════════════════════════════════════════════════════════════════ */

import { useSyncExternalStore } from 'react'
import { prefs } from './prefs'

const FPS_LOW = 30           // ต่ำกว่านี้ถือว่ากระตุก
const WINDOW_MS = 4000       // วัดทีละ 4 วินาที
const LOW_WINDOWS = 2        // ต่ำติดกัน 2 ช่วง (8 วิ) จึงเปิดเอง — ไม่สลับไปมาเพราะกระตุกครั้งเดียว

let autoLow = false          // the watchdog saw a slow machine (this page load only)
let lastFps = null
const subs = new Set()
const emit = () => subs.forEach((f) => f())

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Is lite mode on, and why. */
export function perfState() {
  const mode = prefs.get().perf
  const reason = mode === 'on' ? 'manual' : mode === 'off' ? null : autoLow ? 'fps' : reducedMotion() ? 'reduced-motion' : null
  return { mode, lite: !!reason, reason, fps: lastFps }
}

let snap = null
const snapshot = () => {
  const n = perfState()
  if (!snap || snap.lite !== n.lite || snap.reason !== n.reason || snap.mode !== n.mode || snap.fps !== n.fps) snap = n
  return snap
}
export const usePerf = () => useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, snapshot, snapshot)

export function applyPerf() {
  if (typeof document === 'undefined') return
  const { lite, reason } = perfState()
  document.documentElement.classList.toggle('perf-lite', lite)
  document.documentElement.dataset.perf = lite ? `lite-${reason}` : 'full'
  emit()
}

/** Call once at start: applies the mode, follows the settings, and watches the frame rate in 'auto'. */
export function installPerf({ watch = !prefs.rec } = {}) {
  if (typeof window === 'undefined') return
  applyPerf()
  prefs.subscribe(applyPerf)
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', applyPerf)
  if (!watch) return                                  // recordings keep the full picture
  let frames = 0, t0 = performance.now(), low = 0
  const loop = (t) => {
    frames++
    if (t - t0 >= WINDOW_MS) {
      const fps = (frames * 1000) / (t - t0)
      frames = 0; t0 = t
      lastFps = Math.round(fps)
      low = fps < FPS_LOW ? low + 1 : 0
      if (low >= LOW_WINDOWS && !autoLow && prefs.get().perf === 'auto') { autoLow = true; applyPerf() } else emit()
    }
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  // a hidden tab gets no frames — restart the window when it comes back so it is not read as slow
  document.addEventListener('visibilitychange', () => { frames = 0; t0 = performance.now(); low = 0 })
}
