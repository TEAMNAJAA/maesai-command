/* ══════════════════════════════════════════════════════════════════════════
   WHAT-IF UI — "ถ้าคุณเลือกอีกทาง"
   การ์ดเทียบ "คุณเลือก" กับ "ถ้าเลือก" เรียงตามผลกระทบ + สิ่งที่ทำได้ดี
   ใช้ในหน้าสรุปองก์ 1 · องก์ 2 และหน้าสรุปภารกิจ (AAR)
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useMemo, useState } from 'react'
import {
  GitBranch, ArrowRight, Lightbulb, CheckCircle2, ChevronDown, Megaphone, Wallet, HeartHandshake, ShieldCheck, Ruler, Satellite,
  ScanSearch, Building2, Search, Plane, RadioTower, Ship, Route, HeartPulse, Home, Users, Image as ImageIcon, Clock,
} from 'lucide-react'
import { Src } from './atoms'
import { whatIf } from '../engine/whatif'
import { fmt, baht } from '../lib/format'

const ICON = {
  evac: Megaphone, money: Wallet, trust: HeartHandshake, seal: ShieldCheck, channel: Ruler, theos: Satellite, scan: ScanSearch,
  camp: Building2, find: Search, drone: Plane, tower: RadioTower, boat: Ship, route: Route, hospital: HeartPulse, relief: Home, survey: Search,
}
const TONE = { gain: { hex: '#22E36B', text: '#BFF5CF' }, loss: { hex: '#FFB300', text: '#FFE0A3' } }

function Totals({ t }) {
  const chips = [
    t.people > 0 && [Users, `+${fmt(t.people)} คน`, 'ที่มีโอกาสปลอดภัยเพิ่ม'],
    t.hh > 0 && !t.people && [Home, `+${fmt(t.hh)} ครัวเรือน`, 'พ้นน้ำเพิ่ม'],
    t.images > 0 && [ImageIcon, `+${t.images} ภาพ`, 'THEOS-2 ที่ใช้ได้'],
    t.baht > 0 && [Wallet, baht(t.baht), 'เงินที่จ่ายผิด/เสียเปล่า'],
    t.min > 0 && [Clock, `${(t.min / 60).toFixed(1)} ชม.`, 'เวลาที่เสียไป'],
  ].filter(Boolean)
  if (!chips.length) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-thai text-[11px] text-slate-400">ถ้าเลือกดีที่สุดทุกเรื่อง:</span>
      {chips.map(([Icon, v, u]) => (
        <span key={u} className="font-thai flex items-center gap-1 rounded-md border border-[#22E36B]/30 bg-[#22E36B]/[0.08] px-2 py-[3px] text-[11px] text-[#BFF5CF]" title={u}>
          <Icon size={11} /><b className="num">{v}</b><span className="text-[10px] text-slate-400">{u}</span>
        </span>
      ))}
    </div>
  )
}

function WhatIfCard({ c, rank, compact }) {
  const Icon = ICON[c.icon] || GitBranch
  const tone = TONE[c.tone] || TONE.gain
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/[0.09] bg-[#081120]" data-whatif={c.id}>
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: tone.hex }} />
      <div className={`flex items-start gap-2.5 ${compact ? 'px-3 py-2' : 'px-3.5 py-2.5'}`}>
        <span className="relative mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border" style={{ borderColor: `${tone.hex}55`, background: `${tone.hex}14`, color: tone.hex }}>
          <Icon size={15} />
          <span className="num absolute -right-1.5 -top-1.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-[#0b1426] px-[3px] text-[8.5px] font-bold text-slate-300 ring-1 ring-white/15">{rank}</span>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="font-thai min-w-0 flex-1 text-[13px] font-bold leading-snug text-white">{c.title}</div>
            <div className="shrink-0 text-right leading-tight">
              <div className="num text-[15px] font-bold" style={{ color: tone.hex }}>{c.delta.v}</div>
              <div className="font-thai max-w-[170px] text-[9.5px] text-slate-400">{c.delta.unit}</div>
            </div>
          </div>
          <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-stretch gap-1.5">
            <div className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5">
              <div className="font-thai text-[9.5px] font-bold uppercase tracking-wide text-slate-500">คุณเลือก</div>
              <div className="font-thai text-[11.5px] leading-snug text-slate-300">{c.you}</div>
            </div>
            <ArrowRight size={14} className="self-center" style={{ color: tone.hex }} />
            <div className="rounded-md border px-2 py-1.5" style={{ borderColor: `${tone.hex}40`, background: `${tone.hex}0d` }}>
              <div className="font-thai text-[9.5px] font-bold uppercase tracking-wide" style={{ color: tone.hex }}>ถ้าเลือก</div>
              <div className="font-thai text-[11.5px] leading-snug" style={{ color: tone.text }}>{c.alt}</div>
            </div>
          </div>
          {c.lesson && (
            <div className="font-thai mt-1.5 flex gap-1.5 text-[11px] leading-snug text-[#FFE6A8]">
              <Lightbulb size={12} className="mt-[2px] shrink-0 text-[#FFD066]" />{c.lesson}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * "ถ้าคุณเลือกอีกทาง" for one act.
 *  limit   · how many cards before "ดูทั้งหมด"
 *  compact · tighter layout for the act summaries
 */
export function WhatIfPanel({ eng, act, limit = 3, compact = false, className = '' }) {
  const data = useMemo(() => whatIf(eng.s, eng.scn, act), [eng.s, eng.scn, act])
  const [all, setAll] = useState(false)
  const shown = all ? data.cards : data.cards.slice(0, limit)
  return (
    <div className={`overflow-hidden rounded-xl border border-[#A78BFA]/30 bg-gradient-to-b from-[#A78BFA]/[0.07] to-transparent ${className}`} data-whatif-panel={act}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-white/[0.06] px-3.5 py-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg border border-[#A78BFA]/50 bg-[#A78BFA]/15"><GitBranch size={15} className="text-[#C4B5FD]" /></span>
        <div className="leading-tight">
          <div className="hud-label !text-[8.5px] text-[#C4B5FD]/80">WHAT-IF DEBRIEF · องก์ {act}</div>
          <div className="font-thai text-[14px] font-bold text-white">ถ้าคุณเลือกอีกทาง</div>
        </div>
        <div className="ml-auto"><Totals t={data.totals} /></div>
      </div>
      <div className="space-y-2 p-3">
        <div className="font-thai flex items-center gap-1.5 text-[11px] text-slate-400">
          <Src t="scenario" mini />เปลี่ยนการตัดสินใจของคุณทีละเรื่อง แล้วคำนวณใหม่ด้วยแบบจำลองเดียวกับเกม — เรียงจากเรื่องที่มีผลมากที่สุด
        </div>
        {data.cards.length === 0 && (
          <div className="font-thai flex items-center gap-2 rounded-lg border border-[#22E36B]/30 bg-[#22E36B]/[0.06] px-3 py-2.5 text-[12.5px] text-[#BFF5CF]">
            <CheckCircle2 size={16} className="text-[#22E36B]" />ไม่พบการตัดสินใจที่เปลี่ยนแล้วได้ผลดีกว่านี้ในองก์นี้
          </div>
        )}
        {shown.map((c, i) => <WhatIfCard key={c.id} c={c} rank={i + 1} compact={compact} />)}
        {data.cards.length > limit && (
          <button onClick={() => setAll((v) => !v)} data-whatif-more
            className="font-thai flex w-full items-center justify-center gap-1 rounded-md border border-white/10 bg-white/[0.03] py-1.5 text-[11.5px] text-slate-300 hover:bg-white/[0.06] hover:text-white">
            {all ? 'ย่อ' : `ดูทั้งหมด ${data.cards.length} เรื่อง`}<ChevronDown size={13} className={all ? 'rotate-180' : ''} />
          </button>
        )}
        {data.good.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5" data-whatif-good>
            <span className="font-thai text-[11px] font-semibold text-[#7CFFA0]">สิ่งที่ทำได้ดี:</span>
            {data.good.map((g) => (
              <span key={g} className="font-thai flex items-center gap-1 rounded-full border border-[#22E36B]/30 bg-[#22E36B]/[0.08] px-2 py-[2px] text-[11px] text-[#CFF7DA]"><CheckCircle2 size={11} className="text-[#22E36B]" />{g}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
