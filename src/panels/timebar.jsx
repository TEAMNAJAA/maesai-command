/* ══════════════════════════════════════════════════════════════════════════
   TIME BAR — the mission clock moves only from here (or from an order's
   command time). No waiting: jump to the next event with a short cut scene.
   แถบเวลา: เวลาในเกมเดินเมื่อคุณสั่งการ · ปุ่มเดินเวลา · เหตุการณ์ที่กำลังจะมาถึง
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState } from 'react'
import { FastForward, Satellite, Waves, Flag, Clock, Radio, Ship, Zap, Droplets, Plane, Hourglass, SkipForward } from 'lucide-react'
import { THRESHOLDS, MISSION, ACT2, TIME, THEOS2 } from '../config/missionConfig'
import { firstCrossing } from '../lib/hydro'
import { clockLabel } from '../lib/format'
import { ConfirmImpact } from '../ui/impact'
import { previewSkip } from '../engine/impact'

const hm = (min) => { const m = Math.max(0, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)} ชม.${m % 60 ? ` ${m % 60} น.` : ''}` : `${m} น.` }
const tg = (t) => (t === 'TOWN' ? 'เมือง' : t)

/** What is coming up, soonest first. */
export function upcoming(eng) {
  const { s, scn, sfvi } = eng
  const out = []
  if (s.act === 1) {
    for (const p of scn.passes) {
      if (p.t <= s.clock) continue
      const ch = s.taskings[p.id] || []
      out.push({ t: p.t, icon: Satellite, hex: ch.length ? '#7dd3fc' : '#FFD066', th: `THEOS-2 ${p.id}`, sub: ch.length ? `ถ่าย ${ch.map(tg).join(', ')}` : 'ยังไม่เลือกเป้าหมาย' })
    }
    for (const img of s.images) if (img.readyAt > s.clock) out.push({ t: img.readyAt, icon: Hourglass, hex: '#7dd3fc', th: `ภาพ ${tg(img.target)}`, sub: 'ประมวลผล L3' })
    const prep = firstCrossing(sfvi.prepLevel, s.clock, 0), crit = firstCrossing(THRESHOLDS.criticalLevel, s.clock, 0)
    if (Number.isFinite(prep) && prep > s.clock) out.push({ t: prep, icon: Waves, hex: '#FFB300', th: `น้ำ ${sfvi.prepLevel.toFixed(2)} ม.`, sub: 'เกณฑ์เตรียมพร้อม' })
    if (Number.isFinite(crit) && crit > s.clock) out.push({ t: crit, icon: Waves, hex: '#FF3B63', th: `น้ำ ${THRESHOLDS.criticalLevel.toFixed(2)} ม.`, sub: 'Veto 1' })
    const seals = s.jobs.filter((j) => j.kind === 'seal')
    if (seals.length) out.push({ t: Math.max(...seals.map((j) => j.at)), icon: Flag, hex: '#7CFFA0', th: 'อุดตลิ่งครบ', sub: `${seals.length} จุดในคิว` })
    out.push({ t: 0, icon: Flag, hex: '#FF3B63', th: 'T−0', sub: 'มวลน้ำถึงเมือง' })
  } else if (s.act === 2) {
    for (const q of scn.act2Passes) if (q.t > s.clock) out.push({ t: q.t, icon: Satellite, hex: s.act2Orders[q.id] ? '#7dd3fc' : '#FFD066', th: `THEOS-2 ${q.id}`, sub: s.act2Orders[q.id] ? 'สั่งถ่ายแล้ว' : 'ยังไม่สั่งถ่าย' })
    const nextRadar = Math.ceil((s.clock + 1) / (ACT2.radarRevisitH * 60)) * ACT2.radarRevisitH * 60
    if (nextRadar < MISSION.act2EndMin) out.push({ t: nextRadar, icon: Radio, hex: '#FF8A3D', th: 'เรดาร์', sub: 'อัปเดตความลึก' })
    const icon = { tower: Radio, power: Zap, pump: Droplets, drone: Plane, boatAtPoint: Ship, boatAtDest: Ship }
    const th = { tower: 'เสาสื่อสาร', power: 'ตัดไฟ', pump: 'เครื่องสูบ', drone: 'โดรน', boatAtPoint: 'เรือถึงจุด', boatAtDest: 'เรือส่งคน' }
    for (const j of s.jobs) if (icon[j.kind]) out.push({ t: j.at, icon: icon[j.kind], hex: '#7CFFA0', th: th[j.kind], sub: j.section || j.point || '' })
    const waiting = s.points.filter((p) => p.revealed && p.status === 'waiting')
    if (waiting.length) { const p = waiting.reduce((m, x) => (x.deadline < m.deadline ? x : m)); out.push({ t: p.deadline, icon: Clock, hex: '#FF3B63', th: `เส้นตาย ${p.id}`, sub: `${p.left} คน` }) }
    out.push({ t: MISSION.act2EndMin, icon: Flag, hex: '#38BDF8', th: 'T+36', sub: 'น้ำลด' })
  }
  return out.sort((a, b) => a.t - b.t)
}

/** Is there nothing left that needs the commander before the act ends? */
export function actSettled(eng) {
  const { s, scn } = eng
  if (s.act === 1) return scn.passes.every((p) => p.t <= s.clock) && Object.keys(s.orders).length > 0
  // only what the commander can see: hidden groups (no call, cloud, blind spot) are still out there
  if (s.act === 2) return s.clock >= 12 * 60 && s.points.filter((p) => p.revealed).every((p) => p.status !== 'waiting' || s.jobs.some((j) => j.point === p.id)) && scn.act2Passes.every((q) => q.t <= s.clock || s.act2Orders[q.id])
  return false
}

export function TimeBar({ eng }) {
  const { s, scn, cut } = eng
  const [confirmEnd, setConfirmEnd] = useState(false)
  if (s.act === 3) return null
  const busy = !!cut
  const list = upcoming(eng).slice(0, 5)
  const next = s.act === 1 ? scn.passes.find((p) => p.t > s.clock) : null
  const nextTasked = next && (s.taskings[next.id] || []).length
  const capture = s.act === 1 && next && nextTasked && list[0]?.t === next.t
  const label = capture ? { icon: Satellite, th: `ให้ THEOS-2 ถ่ายรอบ ${next.id}` } : { icon: FastForward, th: 'เดินเวลา → เหตุการณ์ถัดไป' }
  const go = () => (capture ? eng.advance({ mode: 'until', to: next.t + THEOS2.processingMin }) : eng.advance({ mode: 'next' }))
  const settled = actSettled(eng)
  const endTh = s.act === 1 ? 'ข้ามไป T−0' : 'ข้ามไปน้ำลด (T+36)'
  return (
    <div className="flex h-[46px] shrink-0 items-center gap-2 rounded-md border border-sky-400/20 bg-[#060C18]/90 px-2.5" data-timebar>
      <div className="flex shrink-0 items-center gap-1.5 border-r border-white/10 pr-2.5">
        <Clock size={14} className="text-sky-300" />
        <div className="leading-tight">
          <div className="num text-[13px] font-bold text-white">{clockLabel(Math.round(s.clock))}</div>
          <div className="font-thai text-[9.5px] text-slate-400">เวลาเดินเมื่อคุณสั่งการ</div>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <span className="font-thai shrink-0 text-[10px] text-slate-500">ถัดไป</span>
        {list.map((e, i) => (
          <span key={`${e.th}${e.t}${i}`} className="flex shrink-0 items-center gap-1 rounded border px-1.5 py-[3px]" style={{ borderColor: `${e.hex}44`, background: `${e.hex}0F` }}>
            <e.icon size={11} style={{ color: e.hex }} />
            <span className="font-thai text-[10.5px] font-semibold text-slate-100">{e.th}</span>
            <span className="font-thai text-[9.5px] text-slate-400">{e.sub}</span>
            <span className="num text-[9.5px]" style={{ color: e.hex }}>+{hm(e.t - s.clock)}</span>
          </span>
        ))}
      </div>
      <button onClick={() => eng.advance({ mode: 'span', min: TIME.stepMin })} disabled={busy} data-advance="hour"
        className="btn shrink-0 border-white/15 bg-white/[0.05] px-2.5 py-1.5 text-slate-200 hover:bg-white/10 disabled:opacity-40">
        <span className="font-thai normal-case tracking-normal text-[11px]">+1 ชม.</span>
      </button>
      {settled && (
        <button onClick={() => setConfirmEnd(true)} disabled={busy} data-advance="end" title="ไม่มีงานค้างที่มองเห็น — ข้ามไปจบองก์"
          className="btn flex shrink-0 items-center gap-1 border-[#38BDF8]/50 bg-[#38BDF8]/12 px-2.5 py-1.5 text-sky-100 hover:bg-[#38BDF8]/25 disabled:opacity-40">
          <SkipForward size={12} /><span className="font-thai normal-case tracking-normal text-[11px]">{endTh}</span>
        </button>
      )}
      <button onClick={go} disabled={busy} data-advance="next" title="Space"
        className="btn flex shrink-0 items-center gap-1.5 border-[#22E36B]/60 bg-[#22E36B]/15 px-3 py-1.5 text-[#BFF5CF] hover:bg-[#22E36B]/25 disabled:opacity-40">
        <label.icon size={13} /><span className="font-thai normal-case tracking-normal text-[12px] font-bold">{label.th}</span>
      </button>
      <ConfirmImpact open={confirmEnd && settled} card={confirmEnd ? previewSkip(s, scn) : null} whyId="skip" tone="info" confirmTh={endTh}
        onCancel={() => setConfirmEnd(false)} onConfirm={() => { setConfirmEnd(false); eng.advance({ mode: 'end' }) }} />
    </div>
  )
}
