/* ══════════════════════════════════════════════════════════════════════════
   HINT LADDER UI — คำใบ้แบบบันได
   • HintLadder   การ์ดบันได 3 ขั้น (ถาม → ชี้ → เฉลยบางส่วน) ใช้ในแถบผู้ช่วยสอนและในหน้าต่างเครื่องมือ
   • spotlight()  ไฟกะพริบรอบข้อมูลที่ขั้น "ชี้ที่ข้อมูล" พาไปดู
   ขั้นที่เกินขีดจำกัดขององก์จะแสดงเป็น "ปิดในองก์นี้" — ให้ผู้เล่นเห็นว่าตัวช่วยค่อย ๆ ถอนออก
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useMemo, useState } from 'react'
import { Lightbulb, HelpCircle, MousePointerClick, KeyRound, Lock, Unlock, ChevronRight, GraduationCap } from 'lucide-react'
import { ladder, RUNGS, rungCost } from '../engine/hints'
import { hintPenalty } from '../lib/sim'
import { HINTS } from '../config/missionConfig'

const ICON = { 1: HelpCircle, 2: MousePointerClick, 3: KeyRound }

/** Flash a ring around the data a "pointer" hint talks about. */
export function spotlight(selector, ms = HINTS.spotMs) {
  if (!selector || typeof document === 'undefined') return
  const run = (tries) => {
    const els = [...document.querySelectorAll(selector)].filter((el) => el.getClientRects().length)
    if (!els.length) { if (tries > 0) setTimeout(() => run(tries - 1), 180); return }
    els.slice(0, 12).forEach((el) => el.setAttribute('data-hint-spot', ''))
    els[0].scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
    setTimeout(() => els.forEach((el) => el.removeAttribute('data-hint-spot')), ms)
  }
  setTimeout(() => run(8), 260)          // after the tab / view / modal the hint opened has rendered
}

/** Text of a rung as one line (lists joined) — for the tutor bar. */
export const rungLine = (r) => (r ? [r.th, ...(r.list || [])].filter(Boolean).join(' ') : '')

/**
 * The ladder card.
 *  topic · ctx (extra context for the topic: imageId, pointId, roof)
 *  onGo  · navigation for pointer rungs (tab / view / modal); omit inside a modal that already shows the data
 */
export function HintLadder({ eng, topic, ctx = {}, onGo, compact = false, className = '' }) {
  const { s, scn, sfvi } = eng
  const L = useMemo(() => ladder(topic, { s, scn, sfvi, ...ctx }), [topic, s, scn, sfvi, ctx.imageId, ctx.pointId, ctx.roof]) // eslint-disable-line react-hooks/exhaustive-deps
  const [justOpened, setJustOpened] = useState(0)
  if (!L || !L.max) return null
  const pen = hintPenalty(s)
  const open = (r) => {
    if (!eng.revealHint(topic, r)) return
    setJustOpened(r)
    const rung = L.rungs[r]
    if (rung?.go && onGo) onGo(rung.go)
    if (rung?.spot) spotlight(rung.spot)
  }
  const pad = compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
  return (
    <div className={`overflow-hidden rounded-lg border border-[#FFD066]/35 bg-[#0a0f1c] ${className}`} data-hint-ladder={topic} data-hint-open={L.open}>
      <div className="flex items-center gap-2 border-b border-[#FFD066]/20 bg-gradient-to-r from-[#FFD066]/[0.16] via-[#FFD066]/[0.05] to-transparent px-3 py-1.5">
        <Lightbulb size={13} className="shrink-0 text-[#FFD066]" />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="hud-label !text-[8.5px] text-[#FFD066]/80">HINT LADDER · คำใบ้แบบบันได</div>
          <div className="font-thai truncate text-[12px] font-bold text-white">{L.title}</div>
        </div>
        <span className="font-thai shrink-0 rounded border border-white/10 bg-black/30 px-1.5 py-[2px] text-[10px] text-slate-300" title="คะแนนที่หักจากการเปิดคำใบ้ขั้น 2–3 (รวมทุกหัวข้อ)">
          หักแล้ว <b className={pen.pts ? 'text-[#FF9DB2]' : 'text-[#7CFFA0]'}>−{pen.pts}</b> / {HINTS.maxPenalty}
        </span>
      </div>
      <ol className={`relative ${pad}`}>
        {[1, 2, 3].map((r) => {
          const R = RUNGS[r], Icon = ICON[r], rung = L.rungs[r]
          const isOpen = r <= L.open
          const isNext = r === L.open + 1 && r <= L.max
          const closedByAct = r > L.max
          const last = r === 3
          return (
            <li key={r} className="relative flex gap-2.5 pb-2 last:pb-0" data-hint-rung={r} data-state={isOpen ? 'open' : isNext ? 'next' : closedByAct ? 'faded' : 'locked'}>
              {!last && <span className="absolute left-[11px] top-[24px] bottom-0 w-px" style={{ background: isOpen && r < L.open ? `${RUNGS[r + 1].hex}66` : 'rgba(255,255,255,.1)' }} />}
              <span className={`relative z-[1] grid h-[23px] w-[23px] shrink-0 place-items-center rounded-full border-2 ${isOpen && justOpened === r ? 'animate-[checkpop_.6s_ease-out]' : ''}`}
                style={isOpen ? { borderColor: R.hex, background: `${R.hex}26`, color: R.hex } : { borderColor: 'rgba(255,255,255,.14)', color: 'rgba(148,163,184,.6)' }}>
                <Icon size={12} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-thai text-[11px] font-bold" style={{ color: isOpen ? R.hex : '#94a3b8' }}>ขั้น {r} · {R.th}</span>
                  <span className={`font-thai rounded px-1 text-[9.5px] ${rungCost(r) ? 'bg-[#FF3D6B]/12 text-[#FF9DB2]' : 'bg-[#22E36B]/12 text-[#7CFFA0]'}`}>{rungCost(r) ? `−${rungCost(r)} คะแนน` : 'ฟรี'}</span>
                </div>
                {isOpen && rung && (
                  <div className={`font-thai mt-0.5 text-[11.5px] leading-snug text-slate-100 ${justOpened === r ? 'animate-[fadeIn_.35s_ease-out]' : ''}`}>
                    {rung.th}
                    {rung.list && (
                      <ul className="mt-1 space-y-0.5">
                        {rung.list.map((x) => <li key={x} className="flex gap-1.5 text-[11px] text-slate-200"><span className="mt-[6px] h-[4px] w-[4px] shrink-0 rounded-full" style={{ background: R.hex }} />{x}</li>)}
                      </ul>
                    )}
                    {r === 2 && (rung.go || rung.spot) && onGo && (
                      <button onClick={() => { if (rung.go) onGo(rung.go); spotlight(rung.spot) }} className="font-thai ml-1 inline-flex items-center gap-0.5 rounded px-1 text-[10.5px] font-semibold text-[#FFE0A3] hover:bg-[#FFD066]/15">
                        ชี้อีกครั้ง <ChevronRight size={11} />
                      </button>
                    )}
                  </div>
                )}
                {isNext && (
                  <button onClick={() => open(r)} data-hint-open-rung={r}
                    className="font-thai mt-1 inline-flex items-center gap-1.5 rounded-md border px-2 py-[3px] text-[11px] font-semibold transition hover:brightness-125"
                    style={{ borderColor: `${R.hex}77`, background: `${R.hex}17`, color: R.hex }}>
                    <Unlock size={11} />ขอคำใบ้ขั้นนี้{rungCost(r) ? ` (−${rungCost(r)})` : ''}
                  </button>
                )}
                {!isOpen && !isNext && !closedByAct && (
                  <div className="font-thai mt-0.5 flex items-center gap-1 text-[10.5px] text-slate-500"><Lock size={10} />เปิดขั้น {r - 1} ก่อน</div>
                )}
                {closedByAct && (
                  <div className="font-thai mt-0.5 flex items-center gap-1 text-[10.5px] text-slate-500"><GraduationCap size={11} />ปิดในองก์ {s.act} — ผู้ช่วยค่อย ๆ ถอนออก ลองใช้สิ่งที่เรียนมา</div>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {!compact && (
        <div className="font-thai border-t border-white/[0.06] px-3 py-1.5 text-[9.5px] leading-snug text-slate-500">
          ลองคิดจากขั้น 1 ก่อน · ขั้นที่เปิดแล้วไม่หักซ้ำ · หักรวมไม่เกิน {HINTS.maxPenalty} คะแนน · ทุกครั้งที่ขอคำใบ้ถูกบันทึกให้ครูเห็นพัฒนาการ
        </div>
      )}
    </div>
  )
}
