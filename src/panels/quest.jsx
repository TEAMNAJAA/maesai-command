/* ══════════════════════════════════════════════════════════════════════════
   MISSION QUEST + TUTOR — objectives of each act, derived from the state
   กล่องภารกิจ (มุมขวาบน ทุกโหมด) · แถบผู้ช่วยสอน (ด้านล่าง เฉพาะ Beginner)
   ══════════════════════════════════════════════════════════════════════════ */

import React from 'react'
import { Check, ChevronRight, Target, X, Lightbulb } from 'lucide-react'
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
      { id: 'seal', title: 'อุดจุดฟันหลอของแนวตลิ่ง', done: s.sealed.length === EMBANKMENT_GAPS.length, detail: `อุดแล้ว ${s.sealed.length}/${EMBANKMENT_GAPS.length} · อยู่ในคิว ${sealedOrQueued - s.sealed.length}`, go: { tab: 'bank', view: 'corridor' } },
      { id: 'evac', title: 'สั่งอพยพรายโซนตามหลักฐาน', done: ordered > 0 && hot.length === 0, detail: `สั่งแล้ว ${ordered} โซน · โซนที่ SFVI ≥ ${SFVI.decisionBand} ยังไม่สั่ง ${hot.length}`, go: { tab: 'zones', view: 'urban' } },
    ]
    let hint
    if (sfvi.veto1 && hot.length) hint = { lv: 'crit', text: `Veto 1: ระดับน้ำ ≥ 4.20 ม. — สั่งอพยพโซนเสี่ยงทันที (${hot.map((z) => z.id).join(', ')})`, go: { tab: 'zones', view: 'urban' }, cta: 'ไปที่อพยพรายโซน' }
    else if (!s.camp) hint = { text: 'เริ่มจากตั้งฐานบัญชาการ — เลือกที่ที่พื้นสูงและห่างแม่น้ำ (ดูค่าความสูงในแท็บ ④)', go: { tab: 'base', view: 'urban' }, cta: 'เลือกที่ตั้งฐาน' }
    else if (next && !(s.taskings[next.id] || []).length) hint = { text: `ดาวเทียม THEOS-2 รอบ ${next.id} จะผ่านใน ${hm(next.t - s.clock)} — เลือกเป้าหมาย 2 แห่งที่เมฆพยากรณ์ต่ำกว่า 60% (ดูแท็บ "ดาวเทียม" ทางซ้าย)`, go: { tab: 'theos', view: 'catchment', left: 'sat' }, cta: 'วางแผนถ่ายภาพ' }
    else if (toRead.length) hint = { lv: 'warn', text: `ภาพ THEOS-2 ${toRead.length} ภาพพร้อมแล้ว — แปลภาพ: เทียบภาพก่อน/หลัง หาเฉพาะรอยดินถล่ม "ใหม่"`, go: { tab: 'theos', analyze: toRead[0].id }, cta: 'เปิดภาพวิเคราะห์' }
    else if (!s.channel.measured && riverImg) hint = { text: 'มีภาพลำน้ำแล้ว — นับพิกเซลความกว้าง แล้วคำนวณ N = 1 − (พิกเซล × 0.5 ม.) ÷ 150', go: { tab: 'bank', channel: true }, cta: 'เปิดเครื่องมือวัดลำน้ำ' }
    else if (sealedOrQueued < EMBANKMENT_GAPS.length) hint = { text: `จุดฟันหลอยังเปิด ${EMBANKMENT_GAPS.length - sealedOrQueued} จุด — น้ำจะเข้าโซนหลังแนวตลิ่งเร็วขึ้น ส่งทีมบิ๊กแบ็กไปอุด`, go: { tab: 'bank', view: 'corridor' }, cta: 'ดูแนวตลิ่ง' }
    else if (hot.length) hint = { text: `โซน ${hot.map((z) => z.id).join(', ')} มี SFVI ≥ ${SFVI.decisionBand} แล้ว — เทียบเวลาน้ำถึงกับเวลาที่ต้องใช้อพยพ แล้วสั่งเฉพาะโซนที่น้ำจะถึง`, go: { tab: 'zones', view: 'urban', left: 'zones' }, cta: 'ดูตารางโซน' }
    else hint = { text: `รอหลักฐานเพิ่ม — รอบโคจรถัดไป ${next ? `${next.id} (${clockLabel(next.t)})` : 'ไม่มีแล้ว'} · ตรวจตารางโซนทางซ้ายว่าโซนใดน้ำจะถึง`, go: { left: 'zones' }, cta: 'ดูตารางโซน' }
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
    if (power.length) hint = { lv: 'crit', text: `ไฟฟ้ารั่วในโซน ${power.join(', ')} — สั่ง กฟภ. ตัดไฟก่อนส่งทีมเข้า หรือเลือกเส้นทางที่ไม่ผ่าน`, go: { tab: 'field' }, cta: 'ไปที่ภาคสนาม' }
    else if (comm.length && s.points.some((p) => comm.includes(p.section))) hint = { lv: 'crit', text: `พายุตัดสัญญาณโซน ${comm.join(', ')} — สั่งการทีมเข้าไม่ได้และไม่มีคนโทรแจ้ง ต้องตั้งเสาสื่อสาร`, go: { tab: 'field' }, cta: 'ตั้งเสาสื่อสาร' }
    else if (nextQ && !s.act2Orders[nextQ.id] && nextQ.t - s.clock < 240) hint = { lv: 'warn', text: `THEOS-2 รอบ ${nextQ.id} ผ่านเมืองใน ${hm(nextQ.t - s.clock)} — สั่งถ่ายเพื่อหาผู้ติดค้างในโซนที่เมฆเปิด`, go: { tab: 'sensors' }, cta: 'สั่งถ่าย THEOS-2' }
    else if (unattended.length && idle) hint = { lv: unattended[0].deadline - s.clock < 180 ? 'crit' : 'warn', text: `${unattended[0].id}: ${unattended[0].people} คน ${unattended[0].type === 'critical' ? 'อยู่ไม่ได้ ต้องอพยพ' : 'ยังอยู่ได้ ต้องการเสบียง'}${unattended[0].injured ? ` · บาดเจ็บ ${unattended[0].injured} → โรงพยาบาล` : ''} · เหลือ ${hm(unattended[0].deadline - s.clock)}`, go: { plan: unattended[0].id }, cta: 'วางแผนเรือ' }
    else if (scn.blindSpots.some((id) => !s.jobs.some((j) => j.kind === 'drone' && j.section === id))) hint = { text: `โซน ${scn.blindSpots.join(', ')} เป็นจุดอับ (ซอยลึก/ใต้ร่มไม้) — ดาวเทียมมองไม่เห็นคน ส่งโดรนช่วยส่อง`, go: { tab: 'sensors' }, cta: 'ส่งโดรน' }
    else hint = { text: 'ติดตามข้อมูลเรดาร์ (ความลึกรายโซน) และรอรอบ THEOS-2 ถัดไป — ใช้เครื่องสูบน้ำเปิดทางถ้าเส้นทางผ่านโซนน้ำลึก', go: { left: 'zones' }, cta: 'ดูข้อมูลโซน' }
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

/** Beginner tutor bar — one instruction at a time, with a jump to the right control. */
export function TutorBar({ eng, onGo, onHide }) {
  const { hint } = questFor(eng)
  if (!hint) return null
  const hex = hint.lv === 'crit' ? '#FF003C' : hint.lv === 'warn' ? '#FFB300' : '#38BDF8'
  return (
    <div className="relative z-20 flex h-[38px] shrink-0 items-center gap-3 border-t px-3" data-tutor
      style={{ borderColor: `${hex}55`, background: `linear-gradient(90deg, ${hex}22, #050912 60%)` }}>
      <span className="flex shrink-0 items-center gap-1.5 font-thai text-[11px] font-bold" style={{ color: hex }}>
        <Lightbulb size={14} className="animate-[flash_1.6s_ease-in-out_infinite]" /> ผู้ช่วยสอน
      </span>
      <span className="font-thai min-w-0 flex-1 truncate text-[12.5px] text-slate-100" title={hint.text}>{hint.text}</span>
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
