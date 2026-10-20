/* ══════════════════════════════════════════════════════════════════════════
   GAME FEEL (C1) — floating numbers, a light screen shake, numbers that count
   • ตัวเลขลอย: อ่านจากผลต่างของ state จริงเท่านั้น (งบที่ใช้ น้ำมัน คนที่ปลอดภัย ครัวเรือนที่สั่งอพยพ
     ตลิ่งที่อุด ความเชื่อมั่น คะแนนที่หักจากคำใบ้) — ไม่บอกว่าการตัดสินใจถูก/ผิดก่อนจบองก์
   • สั่นจอเบา ๆ: fx 'shake' (เรือล่ม/ไฟช็อต · น้ำถึงเกณฑ์วิกฤต · พายุ) — ปิดเองในโหมดประหยัด/ลดการเคลื่อนไหว
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { fx } from '../lib/fx'
import { hintPenalty } from '../lib/sim'
import { SECTION_BY_ID } from '../lib/sections'
import { DECISION } from '../config/missionConfig'
import { prefs } from '../lib/prefs'

/** Motion is cut in performance mode (D5) and for players who ask the OS for less motion. */
export const lowMotion = () => typeof document !== 'undefined' && (document.documentElement.classList.contains('perf-lite')
  || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

const baht = (v) => (v >= 1e6 ? `฿${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `฿${Math.round(v / 1e3)}k` : `฿${Math.round(v)}`)

/** The floats one state change produces — pure, so it can be tested. */
export function floatsFor(p, s) {
  if (!p || !s || p === s || p.act !== s.act) return []
  const out = []
  const spent = s.budget.spent - p.budget.spent
  if (spent > 0) out.push({ text: `−${baht(spent)}`, hex: '#FF9DB2', at: '[data-hud="budget"]', dy: 26, kind: 'budget' })
  const fuel = s.fuel.used - p.fuel.used
  if (fuel > 0.05) out.push({ text: `−${fuel.toFixed(1)} L`, hex: '#7dd3fc', at: '[data-hud="fuel"]', dy: 26, kind: 'fuel' })
  const trust = Math.round(s.trust) - Math.round(p.trust)
  if (trust) out.push({ text: `${trust > 0 ? '+' : '−'}${Math.abs(trust)}% ความเชื่อมั่น`, hex: trust > 0 ? '#7CFFA0' : '#FF6B8A', at: '[data-hud="trust"]', kind: 'trust' })
  for (const q of s.points || []) {
    const o = (p.points || []).find((x) => x.id === q.id)
    if (!o) continue
    const safe = (q.rescued || 0) - (o.rescued || 0)
    if (safe > 0) out.push({ text: `+${safe} คน ปลอดภัย`, hex: '#7CFFA0', at: `[data-point-marker="${q.id}"]`, big: true, kind: 'people' })
    if (q.status === 'supplied' && o.status !== 'supplied') out.push({ text: `+${q.people} คน ได้เสบียง`, hex: '#7CFFA0', at: `[data-point-marker="${q.id}"]`, big: true, kind: 'people' })
  }
  for (const z of Object.keys(s.orders || {})) {
    if (p.orders?.[z] !== undefined) continue
    const hh = SECTION_BY_ID[z]?.households
    if (hh) out.push({ text: `+${hh} ครัวเรือน อพยพ`, hex: '#7CFFA0', at: `[data-zone="${z}"]`, kind: 'evac' })
  }
  for (const g of s.sealed || []) if (!(p.sealed || []).includes(g)) out.push({ text: 'อุดแล้ว ✓', hex: '#7CFFA0', at: `[data-gap="${g}"]`, kind: 'seal' })
  const hp = hintPenalty(s).pts - hintPenalty(p).pts
  if (hp > 0) out.push({ text: `−${hp * DECISION.hintPoints} คะแนน`, hex: '#FF6B8A', at: '[data-hint-ladder]', big: true, kind: 'hint' })
  return out
}

/** Watches the state and floats what just changed. */
export function useJuice(s) {
  const prev = useRef(s)
  useEffect(() => {
    const p = prev.current
    prev.current = s
    for (const f of floatsFor(p, s)) fx.emit('float', f)
  }, [s])
}

function where(at) {
  if (!at) return null
  if (typeof at === 'object') return at
  const el = document.querySelector(at)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (!r.width && !r.height) return null
  if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** fx.emit('float', { text, hex, at: selector | {x, y}, dx, dy, big }) */
export function Floaters() {
  const [items, setItems] = useState([])
  useEffect(() => fx.on('float', (f) => {
    const pos = where(f.at)
    if (!pos) return
    const id = `${Date.now()}-${Math.random()}`
    // stack floats that land on the same spot instead of drawing them on top of each other
    setItems((xs) => {
      const same = xs.filter((x) => Math.abs(x.x0 - pos.x) < 30 && Math.abs(x.y0 - pos.y) < 30).length
      return [...xs.slice(-11), { ...f, id, x0: pos.x, y0: pos.y, x: pos.x + (f.dx || 0), y: pos.y + (f.dy || 0) - same * 18 }]
    })
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 1800)
  }), [])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[95]" data-floaters>
      {items.map((f) => (
        <div key={f.id} className={`float-num num absolute whitespace-nowrap font-bold ${f.big ? 'text-[17px]' : 'text-[13px]'}`} data-float={f.kind || ''}
          style={{ left: f.x, top: f.y, color: f.hex, textShadow: `0 0 10px ${f.hex}88, 0 1px 2px #000, 0 0 3px #000` }}>
          <span className="font-thai">{f.text}</span>
        </div>
      ))}
    </div>,
    document.body,
  )
}

/** A brief shake of the whole console (Web Animations — no re-render). */
export function useShake(ref) {
  useEffect(() => fx.on('shake', ({ strength = 1 } = {}) => {
    const el = ref.current
    if (!el || lowMotion() || prefs.get().officer || !el.animate) return
    const a = 2.6 * Math.min(2.5, strength)
    el.animate([
      { transform: 'translate(0, 0)' }, { transform: `translate(${-a}px, ${a * 0.45}px)` }, { transform: `translate(${a * 0.9}px, ${-a * 0.4}px)` },
      { transform: `translate(${-a * 0.55}px, ${-a * 0.25}px)` }, { transform: `translate(${a * 0.3}px, ${a * 0.2}px)` }, { transform: 'translate(0, 0)' },
    ], { duration: 380 + 80 * strength, easing: 'ease-out' })
  }), [ref])
}

/** A number that eases to its new value (budget, fuel). */
export function Tween({ value, format = (v) => v, ms = 650 }) {
  const [shown, setShown] = useState(value)
  const cur = useRef(value)                         // what is on screen now — a new value eases on from here
  useEffect(() => {
    if (lowMotion() || cur.current === value) { cur.current = value; setShown(value); return undefined }
    const a = cur.current, t0 = performance.now()
    let raf
    const tick = (t) => {
      const k = Math.max(0, Math.min(1, (t - t0) / ms)), e = 1 - (1 - k) ** 3
      cur.current = a + (value - a) * e
      setShown(cur.current)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    // a page that is not being drawn (background tab) gets no frames — never leave a stale number on screen
    const done = setTimeout(() => { cancelAnimationFrame(raf); cur.current = value; setShown(value) }, ms + 250)
    return () => { cancelAnimationFrame(raf); clearTimeout(done) }
  }, [value, ms])
  return <>{format(shown)}</>
}
