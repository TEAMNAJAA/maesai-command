/* ══════════════════════════════════════════════════════════════════════════
   IMPACT UI — "ผลที่จะเกิด" cards + ⓘ "ทำไมต้องทำ"
   • ImpactCard     ใช้อะไร / ได้อะไร / เสี่ยงอะไร (จาก engine/impact.js)
   • ImpactHover    การ์ดลอยเมื่อชี้ปุ่ม (คำสั่งเล็ก)
   • ConfirmImpact  หน้าต่างยืนยันก่อนคำสั่งใหญ่ (อพยพ · ข้ามไปจบองก์)
   • WhyButton      ⓘ เหตุผลในโลกจริงของปุ่ม/ขั้นตอน (WHY ใน scenarioData.js)
   แถวที่เป็น "การประเมินตามกฎ" (judge) แสดงเฉพาะโหมดผู้เริ่มต้น — ผู้เชี่ยวชาญต้องประเมินเอง
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Info, X, Coins, TrendingUp, AlertTriangle, CheckCircle2, XCircle, Lightbulb, Globe2, Database, Scale, ShieldAlert, ArrowRight,
} from 'lucide-react'
import { Modal, Src } from './atoms'
import { useMode } from './label'
import { WHY } from '../config/scenarioData'

const TONE = {
  good: { hex: '#22E36B', text: '#BFF5CF' },
  warn: { hex: '#FFB300', text: '#FFE0A3' },
  bad: { hex: '#FF3D6B', text: '#FFB8C6' },
  info: { hex: '#7DD3FC', text: '#D3DEEA' },
}
const GROUPS = [
  { id: 'use', th: 'ใช้', en: 'COST', icon: Coins, hex: '#94A3B8' },
  { id: 'get', th: 'ได้', en: 'GAIN', icon: TrendingUp, hex: '#22E36B' },
  { id: 'risk', th: 'เสี่ยง', en: 'RISK', icon: AlertTriangle, hex: '#FFB300' },
]
const VERDICT_ICON = { good: CheckCircle2, warn: AlertTriangle, bad: XCircle, info: Info }

/** Rows the current mode may see (Expert: no rule evaluation). */
export function visibleRows(card, judge) {
  return (card?.rows || []).filter((r) => judge || !r.judge)
}

/* ── ImpactCard ──────────────────────────────────────────────────────────── */

export function ImpactCard({ card, compact = false, className = '', heading = 'ผลที่จะเกิดถ้าสั่งตอนนี้' }) {
  const mode = useMode()
  const judge = mode.impactJudge !== false
  if (!card) return null
  const rows = visibleRows(card, judge)
  const hidden = (card.rows || []).length - rows.length
  const verdict = card.verdict && (judge || !card.verdict.judge) ? card.verdict : null
  const VIcon = verdict ? VERDICT_ICON[verdict.tone] : null
  const vt = verdict ? TONE[verdict.tone] : null
  return (
    <div data-impact={card.title}
      className={`overflow-hidden rounded-md border bg-[#060c19]/90 ${className}`}
      style={{ borderColor: vt ? `${vt.hex}55` : 'rgba(125,211,252,.22)', boxShadow: vt ? `inset 3px 0 0 ${vt.hex}` : 'inset 3px 0 0 rgba(125,211,252,.5)' }}>
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] bg-white/[0.025] px-2.5 py-1">
        <Scale size={11} className="shrink-0 text-sky-300" />
        <span className="font-thai min-w-0 flex-1 truncate text-[10.5px] font-semibold text-slate-200">{heading}</span>
        <span className="hud-label !text-[8px] text-slate-500">IMPACT</span>
        <Src t="scenario" dot />
      </div>
      <div className={compact ? 'space-y-1 px-2.5 py-1.5' : 'space-y-1.5 px-3 py-2'}>
        {GROUPS.map((g) => {
          const list = rows.filter((r) => r.group === g.id)
          if (!list.length) return null
          const Icon = g.icon
          return (
            <div key={g.id} className="flex gap-2" data-impact-group={g.id}>
              <div className="flex w-[42px] shrink-0 items-start gap-1 pt-[1px]">
                <Icon size={11} style={{ color: g.hex }} className="mt-[1px] shrink-0" />
                <span className="font-thai text-[10px] font-bold leading-[14px]" style={{ color: g.hex }}>{g.th}</span>
              </div>
              <ul className="min-w-0 flex-1 space-y-[3px]">
                {list.map((r, i) => (
                  <li key={i} className="font-thai flex gap-1.5 text-[10.5px] leading-[15px]" data-impact-row={r.tone} data-judge={r.judge ? 1 : 0}>
                    <span className="mt-[5px] h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: TONE[r.tone].hex, boxShadow: `0 0 6px ${TONE[r.tone].hex}99` }} />
                    <span className="min-w-0" style={{ color: TONE[r.tone].text }}>{r.th}</span>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
      {verdict && (
        <div className="font-thai flex items-center gap-1.5 border-t px-2.5 py-1.5 text-[11px] font-semibold" data-impact-verdict={verdict.tone}
          style={{ borderColor: `${vt.hex}33`, background: `linear-gradient(90deg, ${vt.hex}26, ${vt.hex}08)`, color: vt.text }}>
          <VIcon size={13} style={{ color: vt.hex }} className="shrink-0" />{verdict.th}
        </div>
      )}
      {!judge && hidden > 0 && (
        <div className="font-thai flex items-center gap-1.5 border-t border-white/[0.06] px-2.5 py-1 text-[9.5px] text-slate-500">
          <ShieldAlert size={10} className="shrink-0" />โหมดผู้เชี่ยวชาญ: ระบบบอกเฉพาะต้นทุน — ความคุ้มและความเสี่ยงต้องประเมินเองจากหลักฐาน
        </div>
      )}
    </div>
  )
}

/* ── Floating layer (portal) — placed beside an anchor, kept on screen ──── */

function useFloat(open, anchorRef, width, prefer = 'left') {
  const [pos, setPos] = useState(null)
  const boxRef = useRef(null)
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) { setPos(null); return }
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect()
      if (!a) return
      const h = boxRef.current?.offsetHeight || 220
      const vw = window.innerWidth, vh = window.innerHeight, gap = 8
      let left, top
      if (prefer === 'left' && a.left - width - gap > 8) { left = a.left - width - gap; top = a.top + a.height / 2 - h / 2 }
      else if (prefer !== 'below' && a.right + width + gap < vw - 8) { left = a.right + gap; top = a.top + a.height / 2 - h / 2 }
      else { left = a.left + a.width / 2 - width / 2; top = a.bottom + gap; if (top + h > vh - 8) top = a.top - h - gap }
      left = Math.max(8, Math.min(vw - width - 8, left))
      top = Math.max(8, Math.min(vh - h - 8, top))
      setPos({ left, top })
    }
    place()
    const raf = requestAnimationFrame(place)   // second pass with the real height
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open, anchorRef, width, prefer])
  return [pos, boxRef]
}

/* ── ImpactHover — wraps a button; shows the card while pointing at it ──── */

export function ImpactHover({ card, children, width = 300, className = '', block = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const timer = useRef(0)
  const [pos, boxRef] = useFloat(open && !!card, ref, width)
  const show = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), 220) }
  const hide = () => { clearTimeout(timer.current); setOpen(false) }
  useEffect(() => () => clearTimeout(timer.current), [])
  const Tag = block ? 'div' : 'span'
  return (
    <Tag ref={ref} className={`${block ? 'block' : 'inline-flex'} ${className}`} onPointerEnter={show} onPointerLeave={hide} onFocus={show} onBlur={hide} onPointerDown={hide}>
      {children}
      {open && card && createPortal(
        <div ref={boxRef} className="pointer-events-none fixed z-[96] animate-[fadeIn_.15s_ease-out]" data-impact-hover
          style={{ width, left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>
          <ImpactCard card={card} compact heading={card.title} className="shadow-[0_18px_50px_-12px_rgba(0,0,0,.9)]" />
        </div>,
        document.body,
      )}
    </Tag>
  )
}

/* ── WhyButton — ⓘ real-world reason for a step ─────────────────────────── */

export function WhyButton({ id, size = 13, className = '', label = null }) {
  const w = WHY[id]
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const [pos, boxRef] = useFloat(open, ref, 320)
  useEffect(() => {
    if (!open) return
    const down = (e) => { if (!boxRef.current?.contains(e.target) && !ref.current?.contains(e.target)) setOpen(false) }
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    window.addEventListener('pointerdown', down, true)
    window.addEventListener('keydown', key, true)
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key, true) }
  }, [open, boxRef])
  if (!w) return null
  return (
    <>
      <button ref={ref} type="button" data-why={id} title="ทำไมต้องทำ?"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
        className={`group inline-flex shrink-0 items-center gap-1 rounded-full align-middle transition ${open ? 'text-white' : 'text-sky-300/80 hover:text-white'} ${className}`}>
        <span className={`grid place-items-center rounded-full border transition ${open ? 'border-sky-300 bg-sky-400/30' : 'border-sky-400/45 bg-sky-400/[0.08] group-hover:border-sky-300 group-hover:bg-sky-400/20'}`}
          style={{ width: size + 3, height: size + 3 }}>
          <Info size={size - 3} strokeWidth={2.6} />
        </span>
        {label && <span className="font-thai text-[10px] font-semibold normal-case tracking-normal">{label}</span>}
      </button>
      {open && createPortal(
        <div ref={boxRef} data-why-pop={id} onPointerDown={(e) => e.stopPropagation()}
          className="fixed z-[97] w-[320px] overflow-hidden rounded-lg border border-sky-400/40 bg-[#07101f] shadow-[0_24px_60px_-14px_rgba(0,0,0,.95),0_0_0_1px_rgba(56,189,248,.12)] animate-[riseIn_.18s_ease-out]"
          style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}>
          <div className="relative border-b border-sky-400/20 bg-gradient-to-r from-sky-500/20 via-sky-500/[0.06] to-transparent px-3 py-2">
            <div className="hud-label !text-[8.5px] text-sky-300/80">WHY · ทำไมต้องทำ</div>
            <div className="font-thai mt-0.5 pr-5 text-[12.5px] font-bold leading-snug text-white">{w.title}</div>
            <button onClick={() => setOpen(false)} className="absolute right-2 top-2 text-slate-500 hover:text-white" title="ปิด (Esc)"><X size={13} /></button>
          </div>
          <div className="space-y-2 px-3 py-2.5">
            <WhyLine icon={Lightbulb} hex="#FFD066" head="เหตุผล">{w.why}</WhyLine>
            <WhyLine icon={Globe2} hex="#7DD3FC" head="ในโลกจริง">{w.real}</WhyLine>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="rounded border border-[#22E36B]/30 bg-[#22E36B]/[0.07] px-2 py-1.5">
                <div className="font-thai flex items-center gap-1 text-[10px] font-bold text-[#7CFFA0]"><CheckCircle2 size={11} />ทำถูก</div>
                <div className="font-thai mt-0.5 text-[10px] leading-snug text-[#CFF7DA]">{w.good}</div>
              </div>
              <div className="rounded border border-[#FF3D6B]/30 bg-[#FF3D6B]/[0.07] px-2 py-1.5">
                <div className="font-thai flex items-center gap-1 text-[10px] font-bold text-[#FF9DB2]"><XCircle size={11} />ทำพลาด</div>
                <div className="font-thai mt-0.5 text-[10px] leading-snug text-[#FFD0DA]">{w.bad}</div>
              </div>
            </div>
            {w.data?.length > 0 && (
              <div>
                <div className="font-thai mb-1 flex items-center gap-1 text-[10px] font-semibold text-slate-400"><Database size={10} />ข้อมูลที่ใช้</div>
                <div className="flex flex-wrap gap-1">
                  {w.data.map((d) => <span key={d} className="font-thai rounded border border-white/10 bg-white/[0.04] px-1.5 py-[1px] text-[9.5px] text-slate-300">{d}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function WhyLine({ icon: Icon, hex, head, children }) {
  return (
    <div className="flex gap-2">
      <span className="mt-[1px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded" style={{ background: `${hex}1f`, color: hex }}><Icon size={11} /></span>
      <div className="min-w-0">
        <div className="font-thai text-[10px] font-bold" style={{ color: hex }}>{head}</div>
        <div className="font-thai text-[10.5px] leading-snug text-slate-200">{children}</div>
      </div>
    </div>
  )
}

/* ── ConfirmImpact — confirm a big order with its consequences ──────────── */

export function ConfirmImpact({ open, card, confirmTh, whyId, tone = 'danger', onConfirm, onCancel }) {
  const mode = useMode()
  const judge = mode.impactJudge !== false
  const v = card?.verdict && (judge || !card.verdict.judge) ? card.verdict.tone : null
  const accent = v ? TONE[v].hex : tone === 'danger' ? '#FF3D6B' : '#38BDF8'
  const ok = useCallback(() => { onConfirm?.() }, [onConfirm])
  useEffect(() => {
    if (!open) return
    // the dialog owns the keyboard: Enter = confirm · Esc = cancel · Space does nothing —
    // players press Space to run the clock, so it must neither advance time underneath
    // nor "click" the focused confirm button (that would fire the order by habit)
    const h = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (!e.repeat) ok() }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel?.() }
      else if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); e.stopPropagation() }
    }
    const up = (e) => { if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); e.stopPropagation() } }
    window.addEventListener('keydown', h, true)
    window.addEventListener('keyup', up, true)
    return () => { window.removeEventListener('keydown', h, true); window.removeEventListener('keyup', up, true) }
  }, [open, ok, onCancel])
  return (
    <Modal open={open && !!card} onClose={onCancel} width={470} tone={accent} z={89}>
      <div data-modal="confirm" className="p-4">
        <div className="flex items-start gap-2.5 pr-6">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border" style={{ borderColor: `${accent}66`, background: `${accent}1a`, color: accent }}>
            <Scale size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="hud-label !text-[8.5px]" style={{ color: `${accent}cc` }}>CONFIRM ORDER · ตรวจผลก่อนสั่ง</div>
            <div className="font-thai mt-0.5 flex items-center gap-1.5 text-[15px] font-bold leading-tight text-white">
              <span className="min-w-0">{card?.title}</span>{whyId && <WhyButton id={whyId} size={14} />}
            </div>
          </div>
        </div>
        <ImpactCard card={card} className="mt-3" />
        <div className="mt-3 flex items-center gap-2">
          <button type="button" onClick={onCancel} data-cancel
            className="btn font-thai flex-1 border-white/12 bg-white/[0.05] py-2 text-[12px] normal-case tracking-normal text-slate-300 hover:bg-white/10 hover:text-white">
            ยกเลิก · กลับไปดูหลักฐาน
          </button>
          <button type="button" onClick={ok} data-confirm autoFocus
            className="btn font-thai flex flex-[1.25] items-center justify-center gap-1.5 py-2 text-[12px] font-bold normal-case tracking-normal text-white"
            style={{ borderColor: `${accent}aa`, background: `linear-gradient(180deg, ${accent}55, ${accent}2a)`, boxShadow: `0 0 22px -6px ${accent}` }}>
            {confirmTh}<ArrowRight size={14} />
          </button>
        </div>
        <div className="font-thai mt-1.5 text-center text-[9.5px] text-slate-500">Enter = ยืนยัน · Esc = ยกเลิก · ตัวเลขจากแบบจำลองสถานการณ์ ณ เวลาปัจจุบัน</div>
      </div>
    </Modal>
  )
}
