/* ══════════════════════════════════════════════════════════════════════════
   MISSION QUEST + TUTOR — objectives of each act, derived from the state
   กล่องภารกิจ (มุมขวาบน ทุกโหมด) · แถบผู้ช่วยสอน (ด้านล่าง เฉพาะ Beginner)
   แถบผู้ช่วยสอนไม่บอกคำตอบ: งานที่ต้องคิดใช้ "คำใบ้แบบบันได" (engine/hints.js) —
   ขั้น 1 เป็นคำถามชวนคิด ผู้เล่นกดขอขั้นถัดไปเอง · `hint.topic` ชี้หัวข้อ, `hint.lead` = ข้อเท็จจริงสั้น ๆ
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Target, X, Lightbulb, ChevronUp } from 'lucide-react'
import { HintLadder, rungLine } from '../ui/hints'
import { ladder, RUNGS } from '../engine/hints'
import { SFVI } from '../config/missionConfig'
import { EMBANKMENT_GAPS } from '../lib/embankment'
import { TOWN_TARGET } from '../lib/scenario'
import { clockLabel } from '../lib/format'

const hm = (min) => { const m = Math.max(0, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที` }

/** Objectives + the single most useful next move for the current act. */
export function questFor(eng) {
  const { s, scn, sfvi } = eng
  if (s.act === 1) {
    const next = scn.passes.find((p) => p.t > s.clock)
    const usable = s.images.filter((i) => i.usable)
    const ready = usable.filter((i) => i.readyAt <= s.clock)
    const toRead = ready.filter((i) => !i.analyzed && i.target !== TOWN_TARGET)
    const riverImg = ready.some((i) => ['D', 'E', TOWN_TARGET].includes(i.target))
    const queued = new Set(s.jobs.filter((j) => j.kind === 'seal').map((j) => j.gap))
    const sealedOrQueued = EMBANKMENT_GAPS.filter((g) => s.sealed.includes(g.id) || queued.has(g.id)).length
    const hot = sfvi.perSection.filter((z) => z.score >= SFVI.decisionBand && s.orders[z.id] === undefined)
    const ordered = Object.keys(s.orders).length
    const steps = [
      { id: 'camp', title: 'ตั้งฐานบัญชาการบนที่สูง', done: !!s.camp, detail: s.camp ? 'ตั้งฐานแล้ว' : 'ดูความสูงพื้นดินและระยะจากแม่น้ำ', go: { tab: 'base', view: 'urban' } },
      { id: 'task', title: 'วางแผนถ่ายภาพ THEOS-2 ตามรอบโคจร', done: usable.length >= 3 || !next, detail: `ภาพใช้ได้ ${usable.length} ภาพ${next ? ` · รอบถัดไป ${next.id} อีก ${hm(next.t - s.clock)}` : ' · หมดรอบโคจรแล้ว'}`, go: { tab: 'theos', view: 'catchment' } },
      { id: 'read', title: 'แปลภาพหารอยดินถล่มใหม่ (ค่า L)', done: ready.length > 0 && toRead.length === 0, detail: `แปลแล้ว ${ready.filter((i) => i.analyzed).length} · รอแปล ${toRead.length} ภาพ`, go: { tab: 'theos', view: 'catchment' } },
      { id: 'channel', title: 'คำนวณความกว้างลำน้ำ (ค่า N)', done: s.channel.measured, detail: s.channel.measured ? `N = ${sfvi.N.toFixed(2)}` : riverImg ? 'มีภาพลำน้ำแล้ว — เปิดเครื่องมือวัด' : 'ต้องมีภาพ THEOS-2 ของ Sector D/E หรือตัวเมือง', go: { tab: 'bank', view: 'corridor' } },
      { id: 'seal', title: 'เลือกกลยุทธ์แนวตลิ่ง', done: s.sealed.length === EMBANKMENT_GAPS.length || s.sealPlan === 'none' || (!!s.sealPlan && queued.size === 0 && s.sealed.length > 0),
        detail: s.sealPlan === 'none' ? 'ไม่อุด — เก็บงบไว้อพยพ' : `อุดแล้ว ${s.sealed.length}/${EMBANKMENT_GAPS.length}${(s.sandbagged || []).length ? ` (กระสอบทราย ${(s.sandbagged || []).length})` : ''} · อยู่ในคิว ${sealedOrQueued - s.sealed.length}`, go: { tab: 'bank', view: 'corridor' } },
      { id: 'evac', title: 'สั่งอพยพรายโซนตามหลักฐาน', done: ordered > 0 && hot.length === 0, detail: `สั่งแล้ว ${ordered} โซน · โซนที่ SFVI ≥ ${SFVI.decisionBand} ยังไม่สั่ง ${hot.length}`, go: { tab: 'zones', view: 'urban' } },
    ]
    let hint
    if (sfvi.veto1 && hot.length) hint = { lv: 'crit', topic: 'a1.evac', lead: 'Veto 1: ระดับน้ำ ≥ 4.20 ม. ต้องตัดสินใจทันที', go: { tab: 'zones', view: 'urban' }, cta: 'ไปที่อพยพรายโซน' }
    else if (!s.camp) hint = { topic: 'a1.camp', lead: 'เริ่มจากตั้งฐานบัญชาการ', go: { tab: 'base', view: 'urban' }, cta: 'ไปที่แท็บฐาน' }
    else if (next && !(s.taskings[next.id] || []).length && !toRead.length) hint = { topic: 'a1.task', lead: `THEOS-2 รอบ ${next.id} ผ่านใน ${hm(next.t - s.clock)}`, go: { tab: 'theos', view: 'catchment' }, cta: 'วางแผนถ่ายภาพ' }
    else if (toRead.length) hint = { lv: 'warn', topic: 'a1.read', ctx: { imageId: toRead[0].id }, lead: `ภาพ THEOS-2 ${toRead.length} ภาพพร้อมแล้ว`, go: { tab: 'theos', analyze: toRead[0].id }, cta: 'เปิดภาพวิเคราะห์' }
    else if (!s.channel.measured && riverImg) hint = { topic: 'a1.channel', lead: 'มีภาพลำน้ำแล้ว', go: { tab: 'bank', channel: true }, cta: 'เปิดเครื่องมือวัดลำน้ำ' }
    else if (sealedOrQueued < EMBANKMENT_GAPS.length) hint = { topic: 'a1.seal', lead: `จุดฟันหลอยังเปิด ${EMBANKMENT_GAPS.length - sealedOrQueued} จุด`, go: { tab: 'bank', view: 'corridor' }, cta: 'ดูแนวตลิ่ง' }
    else if (hot.length) hint = { topic: 'a1.evac', lead: 'หลักฐานเริ่มพอสำหรับบางโซน', go: { tab: 'zones', view: 'urban', left: 'zones' }, cta: 'ดูตารางโซน' }
    else if (next && (s.taskings[next.id] || []).length) hint = { text: `เลือกเป้าหมายรอบ ${next.id} แล้ว — กด "ให้ THEOS-2 ถ่ายรอบ ${next.id}" ที่แถบเวลาใต้แผนที่ (เวลาจะเดินไปจนได้ภาพ)`, go: { advance: true }, cta: `ให้ THEOS-2 ถ่ายรอบ ${next.id}` }
    else if (!ordered) hint = { topic: 'a1.evac', lead: 'หมดรอบดาวเทียมแล้ว', go: { tab: 'zones', view: 'urban', left: 'zones' }, cta: 'ดูตารางโซน' }
    else hint = { text: 'สั่งการครบแล้ว — กด "ข้ามไป T−0" ที่แถบเวลา เพื่อดูผลองก์ 1', go: { advance: 'end' }, cta: 'ข้ามไป T−0' }
    return { title: 'ภารกิจองก์ 1 · เฝ้าระวัง', steps, hint }
  }

  if (s.act === 2) {
    const nextQ = scn.act2Passes.find((q) => q.t > s.clock)
    const known = s.points.filter((p) => p.revealed)
    const open = known.filter((p) => p.status === 'waiting')
    const enRoute = new Set(s.jobs.filter((j) => j.kind === 'boatAtPoint').map((j) => j.point))
    const unattended = open.filter((p) => !enRoute.has(p.id)).sort((a, b) => a.deadline - b.deadline)
    const power = s.hazardsLive.filter((id) => !s.powerCut[id] && !s.jobs.some((j) => j.kind === 'power' && j.section === id))
    const comm = s.commDown.filter((id) => !s.jobs.some((j) => j.kind === 'tower' && j.section === id))
    const idle = s.boats.filter((b) => b.busyUntil <= s.clock).length
    const steps = [
      { id: 'pass', title: 'สั่ง THEOS-2 ถ่ายเมืองทุกรอบโคจร', done: scn.act2Passes.every((q) => s.act2Orders[q.id] || q.t <= s.clock), detail: nextQ ? `รอบ ${nextQ.id} อีก ${hm(nextQ.t - s.clock)}${s.act2Orders[nextQ.id] ? ' · สั่งแล้ว' : ''}` : 'ครบทุกรอบ', go: { tab: 'sensors' } },
      { id: 'find', title: 'ค้นหาผู้ติดค้าง (THEOS-2 · สายด่วน · โดรน)', done: false, detail: `พบแล้ว ${known.length} จุด · จุดอับ ${scn.blindSpots.join(', ')} ต้องใช้โดรน`, go: { tab: 'sensors', view: 'urban' } },
      { id: 'hazard', title: 'จัดการอันตราย: ตัดไฟ · ตั้งเสาสื่อสาร', done: s.stormHit && !power.length && !comm.length, detail: `ไฟรั่ว ${power.length} · สัญญาณล่ม ${comm.length} โซน`, go: { tab: 'field' } },
      { id: 'rescue', title: 'ส่งเรือ/เสบียงก่อนเส้นตาย', done: known.length > 0 && open.length === 0, detail: `รอความช่วยเหลือ ${open.length} จุด · เรือว่าง ${idle}/${s.boats.length}`, go: { tab: 'ops' } },
      { id: 'route', title: 'วางเส้นทางเรือให้ถูก', done: s.trips > 0 && s.routeErrors === 0, detail: `ส่งแล้ว ${s.trips} เที่ยว · เส้นทางผิด ${s.routeErrors} ครั้ง · ส่งผู้บาดเจ็บผิดที่ ${s.wrongDest}`, go: { tab: 'ops' } },
    ]
    let hint
    if (power.length) hint = { lv: 'crit', topic: 'a2.hazard', lead: 'มีรายงานไฟฟ้ารั่ว', go: { tab: 'field' }, cta: 'ไปที่ภาคสนาม' }
    else if (comm.length && s.points.some((p) => comm.includes(p.section))) hint = { lv: 'crit', topic: 'a2.hazard', lead: 'พายุตัดสัญญาณสื่อสาร', go: { tab: 'field' }, cta: 'ไปที่ภาคสนาม' }
    else if (nextQ && !s.act2Orders[nextQ.id] && nextQ.t - s.clock < 240) hint = { lv: 'warn', topic: 'a2.pass', lead: `THEOS-2 รอบ ${nextQ.id} ผ่านเมืองใน ${hm(nextQ.t - s.clock)}`, go: { tab: 'sensors' }, cta: 'ไปที่แท็บดาวเทียม' }
    else if (unattended.length && idle) hint = { lv: unattended[0].deadline - s.clock < 180 ? 'crit' : 'warn', topic: 'a2.route', ctx: { pointId: unattended[0].id }, lead: `${unattended[0].id} รอความช่วยเหลือ · เหลือ ${hm(unattended[0].deadline - s.clock)}`, go: { plan: unattended[0].id }, cta: 'วางแผนเรือ' }
    else if (scn.blindSpots.some((id) => !s.jobs.some((j) => j.kind === 'drone' && j.section === id))) hint = { topic: 'a2.find', lead: 'ยังมีที่ที่ไม่มีใครมองเห็น', go: { tab: 'sensors' }, cta: 'ไปที่แท็บดาวเทียม' }
    else if (unattended.length && !idle) hint = { text: 'เรือออกหมดทุกลำ — กดเดินเวลาให้เรือกลับมา แล้วส่งต่อ', go: { advance: true }, cta: 'เดินเวลา' }
    else hint = { text: 'ยังไม่มีงานค้าง — กด "เดินเวลา → เหตุการณ์ถัดไป" เพื่อรอรอบ THEOS-2 / สายด่วน / ทีมรายงานผล', go: { advance: true }, cta: 'เดินเวลา' }
    return { title: 'ภารกิจองก์ 2 · วิกฤต', steps, hint }
  }

  const done = Object.keys(s.adjudged).length
  const total = scn.roofs.length
  const day = Math.floor(s.clock / 1440)
  return {
    title: 'ภารกิจองก์ 3 · ฟื้นฟู',
    steps: [
      { id: 'review', title: 'ตรวจภาพก่อน/หลังทุกหลังคา', done: s.reviewed.length >= total, detail: `${s.reviewed.length}/${total}`, go: { aar: 'relief' } },
      { id: 'judge', title: 'ตัดสินเยียวยาครบทุกหลัง', done: done >= total, detail: `${done}/${total}`, go: { aar: 'relief' } },
      { id: 'deadline', title: 'จบภายในวันที่ 60', done: day <= 60 && done >= total, detail: `วันที่ ${day} / 60`, go: { aar: 'relief' } },
    ],
    hint: done < total ? { text: `ตัดสินเยียวยารายหลังคา (${done}/${total}) — นับวันท่วมขังจากกราฟเรดาร์ และดูคราบโคลนจากภาพ THEOS-2`, go: { aar: 'relief' }, cta: 'บัญชีหลังคาเรือน' }
      : { text: 'ตัดสินครบแล้ว — ดูคะแนนและบันทึกลง Leaderboard', go: { aar: 'summary' }, cta: 'ดูคะแนน' },
  }
}

export function QuestBox({ eng, onGo }) {
  const q = questFor(eng)
  const done = q.steps.filter((x) => x.done).length
  const active = q.steps.find((x) => !x.done)
  return (
    <div className="mx-2.5 mt-2 shrink-0 overflow-hidden rounded-md border border-[#FFD066]/35 bg-gradient-to-b from-[#FFD066]/[0.07] to-transparent" data-quest>
      <div className="flex items-center gap-2 px-2.5 pt-2">
        <Target size={13} className="text-[#FFD066]" />
        <span className="font-thai text-[12px] font-bold text-white">{q.title}</span>
        <span className="num ml-auto rounded bg-white/[0.06] px-1.5 py-[1px] text-[10px] font-bold" style={{ color: done === q.steps.length ? '#7CFFA0' : '#FFD066' }}>{done}/{q.steps.length}</span>
      </div>
      <div className="space-y-[3px] p-2">
        {q.steps.map((st, i) => {
          const on = active?.id === st.id
          return (
            <button key={`${st.id}-${st.done}`} onClick={() => onGo(st.go)} data-quest-step={st.id} data-state={st.done ? 'done' : on ? 'active' : 'todo'}
              className={`flex w-full items-center gap-2 rounded border px-2 py-[5px] text-left transition
                ${st.done ? 'border-[#22E36B]/25 bg-[#22E36B]/[0.06] animate-[stepdone_1.4s_ease-out]' : on ? 'border-[#FFD066]/60 bg-[#FFD066]/[0.08]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05]'}`}>
              <span className={`grid h-[16px] w-[16px] shrink-0 place-items-center rounded-[4px] border-2 ${st.done ? 'border-[#22E36B] bg-[#22E36B] animate-[checkpop_.6s_ease-out]' : on ? 'border-[#FFD066]' : 'border-slate-600'}`}>
                {st.done ? <Check size={11} strokeWidth={4} className="text-[#04121F]" /> : <span className="num text-[9px] font-bold text-slate-400">{i + 1}</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`font-thai block truncate text-[11px] leading-tight ${st.done ? 'text-[#BFF5CF]' : on ? 'font-semibold text-white' : 'text-slate-300'}`}>{st.title}</span>
                <span className="font-thai block truncate text-[9.5px] text-slate-500">{st.detail}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Beginner tutor bar — the question to think about (rung 1), more only when the player asks. */
export function TutorBar({ eng, onGo, onHide }) {
  const { hint } = questFor(eng)
  const [ladderOpen, setLadderOpen] = useState(false)
  const topic = hint?.topic || null
  useEffect(() => { setLadderOpen(false) }, [topic])
  const L = useMemo(() => (topic ? ladder(topic, { s: eng.s, scn: eng.scn, sfvi: eng.sfvi, ...(hint.ctx || {}) }) : null), [topic, eng.s, eng.scn, eng.sfvi, hint?.ctx?.pointId, hint?.ctx?.imageId]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!hint) return null
  const hex = hint.lv === 'crit' ? '#FF003C' : hint.lv === 'warn' ? '#FFB300' : '#38BDF8'
  const rung = L ? L.open : 0
  const text = L ? `${hint.lead ? `${hint.lead} — ` : ''}${rungLine(L.rungs[rung])}` : hint.text
  return (
    <div className="relative z-20 flex h-[38px] shrink-0 items-center gap-3 border-t px-3" data-tutor data-tutor-topic={topic || ''}
      style={{ borderColor: `${hex}55`, background: `linear-gradient(90deg, ${hex}22, #050912 60%)` }}>
      <span className="flex shrink-0 items-center gap-1.5 font-thai text-[11px] font-bold" style={{ color: hex }}>
        <Lightbulb size={14} className="animate-[flash_1.6s_ease-in-out_infinite]" /> ผู้ช่วยสอน
      </span>
      {L && (
        <span className="font-thai flex shrink-0 items-center gap-1 rounded border px-1.5 py-[2px] text-[10px] font-bold" style={{ borderColor: `${RUNGS[rung].hex}66`, color: RUNGS[rung].hex, background: `${RUNGS[rung].hex}14` }}>
          {RUNGS[rung].th}
        </span>
      )}
      <span className="font-thai min-w-0 flex-1 truncate text-[12.5px] text-slate-100" title={text}>{text}</span>
      {L && L.max > 0 && (
        <button onClick={() => setLadderOpen((o) => !o)} data-hint-toggle
          className={`font-thai flex shrink-0 items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-semibold transition ${ladderOpen ? 'border-[#FFD066] bg-[#FFD066]/20 text-white' : 'border-[#FFD066]/50 bg-[#FFD066]/[0.08] text-[#FFE0A3] hover:bg-[#FFD066]/15'}`}
          title="คำใบ้แบบบันได: ถาม → ชี้ที่ข้อมูล → เฉลยบางส่วน">
          <span className="flex gap-[3px]">
            {[1, 2, 3].map((r) => <span key={r} className="h-[7px] w-[7px] rounded-full" style={{ background: r <= rung ? RUNGS[r].hex : r <= L.max ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.07)' }} />)}
          </span>
          {rung < L.max ? 'ขอคำใบ้เพิ่ม' : 'ดูคำใบ้'}
          <ChevronUp size={12} className={`transition ${ladderOpen ? '' : 'rotate-180'}`} />
        </button>
      )}
      {ladderOpen && L && (
        <div className="absolute bottom-[calc(100%+6px)] right-3 z-30 w-[470px] animate-[riseIn_.2s_ease-out] shadow-[0_-18px_50px_-12px_rgba(0,0,0,.85)]" data-hint-popover>
          <HintLadder eng={eng} topic={topic} ctx={hint.ctx || {}} onGo={onGo} />
        </div>
      )}
      {hint.cta && hint.go && (
        <button onClick={() => onGo(hint.go)} data-tutor-go
          className="font-thai flex shrink-0 items-center gap-1 rounded border px-2.5 py-1 text-[11.5px] font-bold transition hover:brightness-125 animate-[beacon_1.6s_ease-in-out_infinite]"
          style={{ borderColor: `${hex}88`, background: `${hex}22`, color: '#fff' }}>
          {hint.cta} <ChevronRight size={12} />
        </button>
      )}
      <button onClick={onHide} title="ซ่อนผู้ช่วยสอน" className="shrink-0 text-slate-500 hover:text-white"><X size={13} /></button>
    </div>
  )
}
