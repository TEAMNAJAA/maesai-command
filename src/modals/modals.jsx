/* ══════════════════════════════════════════════════════════════════════════
   MODALS — briefing (mode choice) · pre/post test · veto-1 alert · "wait 3 h"
   comparison · act-1 and act-2 summaries · teacher log panel
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo } from 'react'
import {
  Shield, Satellite, Ship, Building2, AlertTriangle, Megaphone, CheckCircle2, XCircle, Clock, Database, Download, Trash2, ArrowRight, GraduationCap, Flag, BookOpen, Trophy, Users, HeartPulse, Fuel, Route, Wallet, Lightbulb,
} from 'lucide-react'
import { Modal, Btn, Src, SrcLegend } from '../ui/atoms'
import { QUIZ } from '../config/scenarioData'
import { SFVI, THRESHOLDS, RELIEF, TRUST, EVAL, MODES } from '../config/missionConfig'
import { SECTIONS, SECTION_BY_ID } from '../lib/sections'
import { hintPenalty } from '../lib/sim'
import { questFor } from '../panels/quest'
import { leaderboard } from '../lib/leaderboard'
import { clockLabel, clockToDate, fmt, pct, mmss } from '../lib/format'
import { logger, downloadText } from '../lib/evalLogger'

/* ── Pre / post test ────────────────────────────────────────────────────── */

export function QuizModal({ open, kind, preScore, onDone, onSkip }) {
  const [ans, setAns] = useState({})
  const [result, setResult] = useState(null)
  const isPost = kind === 'post'
  const all = QUIZ.every((q) => ans[q.id] !== undefined)
  const submit = () => {
    const score = QUIZ.filter((q) => ans[q.id] === q.answer).length
    logger.quiz(kind, QUIZ.map((q) => ans[q.id]), score, QUIZ.length)
    setResult(score)
  }
  const finish = () => { const r = result; setAns({}); setResult(null); onDone(r) }
  const gain = isPost && result !== null && preScore !== null && preScore !== undefined
    ? (preScore ? (result - preScore) / preScore : null) : null

  return (
    <Modal open={open} closable={false} width={760} z={90} tone={isPost ? '#22E36B' : '#38BDF8'}>
      <div className="p-6" data-modal={`quiz-${kind}`}>
        <div className="flex items-center gap-3">
          <GraduationCap size={22} className={isPost ? 'text-[#22E36B]' : 'text-sky-300'} />
          <div>
            <div className="hud-label">{isPost ? 'POST-TEST' : 'PRE-TEST'} · 5 ข้อ</div>
            <h2 className="font-thai text-[19px] font-bold text-white">{isPost ? 'แบบทดสอบหลังเรียน' : 'แบบทดสอบก่อนเรียน'}</h2>
          </div>
          {result !== null && (
            <div className="ml-auto text-right">
              <div className="num text-[26px] font-bold leading-none text-white">{result}<span className="text-[15px] text-slate-400"> / {QUIZ.length}</span></div>
              <div className="font-thai text-[11px] text-slate-400">คะแนนของคุณ</div>
            </div>
          )}
        </div>
        {result === null && (
          <p className="font-thai mt-2 text-[12.5px] text-slate-400">
            {isPost ? 'ข้อเดียวกับก่อนเรียน — ตอบตามความเข้าใจหลังจบภารกิจ' : 'ยังไม่ต้องรู้คำตอบ — ตอบตามความเข้าใจตอนนี้ ใช้วัดพัฒนาการหลังเล่น'}
          </p>
        )}

        <div className="mt-4 space-y-3">
          {QUIZ.map((q, i) => (
            <div key={q.id} className="rounded-lg border border-white/10 bg-white/[0.025] p-3">
              <div className="font-thai text-[13.5px] font-semibold text-white">{i + 1}. {q.q}</div>
              <div className="font-thai text-[10.5px] text-slate-500">หัวข้อ: {q.topic}</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {q.choices.map((c, k) => {
                  const picked = ans[q.id] === k
                  const show = result !== null
                  const right = show && k === q.answer
                  const wrong = show && picked && k !== q.answer
                  return (
                    <button key={k} disabled={show} onClick={() => setAns((a) => ({ ...a, [q.id]: k }))} data-quiz={`${q.id}-${k}`}
                      className={`font-thai flex items-center gap-2 rounded border px-2.5 py-2 text-left text-[12.5px] transition
                        ${right ? 'border-[#22E36B]/60 bg-[#22E36B]/12 text-[#C8FFD9]' : wrong ? 'border-[#FF003C]/60 bg-[#FF003C]/12 text-[#FFC2CE]'
                          : picked ? 'border-sky-400/60 bg-sky-400/15 text-white' : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.06]'}`}>
                      <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-full border border-current text-[10px]">{'กขคง'[k]}</span>
                      {c}
                      {right && <CheckCircle2 size={13} className="ml-auto shrink-0" />}
                      {wrong && <XCircle size={13} className="ml-auto shrink-0" />}
                    </button>
                  )
                })}
              </div>
              {result !== null && <div className="font-thai mt-1.5 text-[11.5px] leading-snug text-slate-400">💡 {q.why}</div>}
            </div>
          ))}
        </div>

        {result !== null && isPost && (
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {[['ก่อนเรียน', preScore ?? '—', '#94A3B8'], ['หลังเรียน', result, '#22E36B'],
              ['พัฒนาการ', gain === null ? '—' : `${gain >= 0 ? '+' : ''}${Math.round(gain * 100)}%`, gain !== null && gain >= EVAL.postTestGainTarget ? '#22E36B' : '#FFB300']].map(([k, v, c]) => (
              <div key={k} className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-center">
                <div className="num text-[24px] font-bold" style={{ color: c }}>{v}</div>
                <div className="font-thai text-[12px] text-slate-400">{k}</div>
              </div>
            ))}
            <div className="font-thai col-span-3 text-center text-[11.5px] text-slate-500">
              เป้าหมายของทีม: คะแนนหลังเรียนเพิ่ม ≥ {Math.round(EVAL.postTestGainTarget * 100)}% · ผลถูกบันทึกในบันทึกครูแล้ว
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          {result === null && onSkip
            ? <button onClick={onSkip} className="font-thai text-[11.5px] text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline">ข้ามแบบทดสอบ (โหมดสาธิต)</button>
            : <span />}
          {result === null
            ? <Btn variant="primary" size="lg" disabled={!all} onClick={submit}><span className="font-thai normal-case tracking-normal text-[13px]">ส่งคำตอบ ({Object.keys(ans).length}/{QUIZ.length})</span></Btn>
            : <Btn variant="go" size="lg" icon={ArrowRight} onClick={finish}><span className="font-thai normal-case tracking-normal text-[13px]">{isPost ? 'ดูสรุปภารกิจ' : 'เริ่มองก์ 1'}</span></Btn>}
        </div>
      </div>
    </Modal>
  )
}

/* ── Veto 1 red alert (zones) ───────────────────────────────────────────── */

export function VetoAlert({ open, eng, onAck, onDecide }) {
  const { s, sfvi, world } = eng
  if (!open) return null
  const hot = sfvi.perSection.filter((z) => z.P >= 0.25 && s.orders[z.id] === undefined)
  return (
    <Modal open closable={false} width={580} tone="#FF003C" z={85}>
      <div className="p-6 text-center" data-modal="veto">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-[#FF003C] bg-[#FF003C]/15 animate-[softflash_1.1s_ease-in-out_infinite]">
          <AlertTriangle size={30} className="text-[#FF003C]" />
        </div>
        <div className="mt-3 font-mono text-[12px] font-bold tracking-[0.2em] text-[#FF3B63]">VETO RULE 1 · CRITICAL ALERT</div>
        <h2 className="font-thai mt-1 text-[22px] font-bold text-white">ระดับน้ำถึงเกณฑ์วิกฤต</h2>
        <p className="font-thai mt-2 text-[14px] leading-relaxed text-slate-300">
          สถานีบ้านถ้ำผาจม <b className="num text-[#FF6B8A]">{world.level.toFixed(2)} ม.</b> ≥ {THRESHOLDS.criticalLevel.toFixed(2)} ม. — สั่งอพยพโซนเสี่ยงทันทีโดยไม่รอภาพยืนยัน
        </p>
        <div className="mt-2 flex justify-center"><Src t="measured" /></div>
        <div className="font-thai mt-3 text-[12.5px] text-[#FFB3C2]">{hot.length ? `โซนเสี่ยงที่ยังไม่ได้สั่ง: ${hot.map((z) => z.id).join(' · ')}` : 'โซนเสี่ยงได้รับคำสั่งครบแล้ว'}</div>
        <div className="mt-5 flex flex-col gap-2">
          {hot.length > 0 && (
            <Btn variant="danger" size="lg" icon={Megaphone} onClick={() => { eng.orderZones(hot.map((z) => z.id)); onAck() }}>
              <span className="font-thai normal-case tracking-normal text-[14px]">สั่งอพยพ {hot.length} โซนเสี่ยงทันที</span>
            </Btn>
          )}
          <Btn variant="solid" onClick={() => { onAck(); onDecide() }}><span className="font-thai normal-case tracking-normal text-[12.5px]">รับทราบ — ไปเลือกโซนเอง</span></Btn>
        </div>
      </div>
    </Modal>
  )
}

/* ── "ดูผลถ้ารอ 3 ชม." comparison (no time passes) ──────────────────────── */

const margin = (m) => {
  if (!Number.isFinite(m)) return '—'
  const sign = m >= 0 ? '+' : '−', a = Math.abs(m)
  return a >= 120 ? `${sign}${(a / 60).toFixed(1)} ชม.` : `${sign}${Math.round(a)} นาที`
}

export function WaitCompareModal({ data, onClose, onEvacuate }) {
  if (!data) return null
  const diff = data.remainingLater - data.remainingNow
  return (
    <Modal open onClose={onClose} width={880} tone="#FFB300" z={85}>
      <div className="p-6" data-modal="wait">
        <div className="flex items-center gap-3">
          <Clock size={22} className="text-[#FFD066]" />
          <div>
            <div className="hud-label">COST OF INACTION · DUAL COMPARISON</div>
            <h2 className="font-thai text-[19px] font-bold text-white">ถ้ารอข้อมูลอีก 3 ชั่วโมงแล้วค่อยสั่ง จะเป็นอย่างไร</h2>
          </div>
          <div className="ml-auto"><Src t="scenario" /></div>
        </div>
        <div className="font-thai mt-1 text-[12px] text-slate-400">{clockLabel(data.t0)} ({clockToDate(data.t0)}) เทียบ {clockLabel(data.t1)} · ระดับน้ำ {data.levelNow.toFixed(2)} → {data.levelLater.toFixed(2)} ม.</div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-[#22E36B]/30 bg-[#22E36B]/[0.06] p-3">
            <div className="font-thai text-[11.5px] text-slate-400">ทาง ก: สั่งโซนที่เหลือตอนนี้</div>
            <div className="num mt-1 text-[22px] font-bold text-[#7CFFA0]">{fmt(data.remainingNow)} <span className="font-thai text-[12px] font-normal text-slate-400">ครัวเรือนยังติดอยู่เมื่อน้ำมา</span></div>
          </div>
          <div className="rounded-lg border border-[#FF003C]/30 bg-[#FF003C]/[0.06] p-3">
            <div className="font-thai text-[11.5px] text-slate-400">ทาง ข: รอ 3 ชม. แล้วค่อยสั่ง</div>
            <div className="num mt-1 text-[22px] font-bold text-[#FF6B8A]">{fmt(data.remainingLater)} <span className="font-thai text-[12px] font-normal text-slate-400">ครัวเรือนยังติดอยู่</span></div>
          </div>
        </div>
        <table className="mt-4 w-full border-collapse">
          <thead><tr className="border-b border-white/10">
            {['โซน', 'น้ำถึง', 'ลึกสูงสุด', 'ทาง ก · ติดค้าง (เวลาเหลือ)', 'ทาง ข · ติดค้าง (เวลาเหลือ)'].map((h) => <th key={h} className="font-thai px-2 py-2 text-left text-[11px] font-semibold text-slate-400">{h}</th>)}
          </tr></thead>
          <tbody>
            {data.rows.filter((r) => r.peak >= 0.5).map((r) => (
              <tr key={r.sec.id} className="border-b border-white/[0.05]">
                <td className="font-thai px-2 py-1.5 text-[12.5px] text-white"><span className="num font-bold">{r.sec.id}</span> {r.sec.name}</td>
                <td className="num px-2 py-1.5 text-[11.5px] text-slate-300">{Number.isFinite(r.arrival) ? clockLabel(r.arrival) : '—'}</td>
                <td className="num px-2 py-1.5 text-[11.5px] text-slate-300">{r.peak.toFixed(1)} ม.</td>
                {r.ordered ? <td colSpan={2} className="font-thai px-2 py-1.5 text-[12px] text-[#7CFFA0]">สั่งไปแล้ว</td> : (
                  <>
                    <td className="px-2 py-1.5"><span className="num text-[12px] text-[#7CFFA0]">{fmt(r.remainingNow)}</span><span className="num ml-1 text-[10.5px] text-slate-500">({margin(r.arrival - data.t0 - r.need)})</span></td>
                    <td className="px-2 py-1.5"><span className="num text-[12px] text-[#FF6B8A]">{fmt(r.remainingLater)}</span><span className="num ml-1 text-[10.5px] text-slate-500">({margin(r.arrival - data.t1 - r.need)})</span></td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="font-thai mt-3 rounded-lg border border-[#FFB300]/30 bg-[#FFB300]/[0.07] px-3 py-2.5 text-[13px] leading-relaxed text-[#FFE0A3]">
          {diff > 0 ? <>การรอ 3 ชม. ทำให้มีครัวเรือนติดค้างเพิ่ม <b className="num">{fmt(diff)}</b> ครัวเรือน — ผู้ติดค้างเหล่านี้จะกลายเป็นงานของเรือกู้ภัยในองก์ 2</>
            : <>การรอครั้งนี้ยังไม่ทำให้ติดค้างเพิ่ม แต่เวลาเหลือก่อนน้ำถึงลดลง — หลักฐานใหม่จะมาจากรอบโคจร THEOS-2 ถัดไปเท่านั้น</>}
          <div className="mt-1 text-[11.5px] text-slate-400">ไม่มีเวลาผ่านไปจากการดูหน้านี้ · "เวลาเหลือ" = เวลาตั้งแต่สั่งจนน้ำถึง ลบเวลาที่ต้องใช้อพยพ</div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="solid" onClick={onClose}><span className="font-thai normal-case tracking-normal text-[12.5px]">รับทราบ</span></Btn>
          <Btn variant="danger" icon={Megaphone} onClick={onEvacuate}><span className="font-thai normal-case tracking-normal text-[12.5px]">ไปเลือกโซนอพยพ</span></Btn>
        </div>
      </div>
    </Modal>
  )
}

/* ── End of act 1 (T−0) ─────────────────────────────────────────────────── */

export function Act1SummaryModal({ open, eng, onNext }) {
  if (!open) return null
  const { s, scn, sfvi, exposure } = eng
  const q = questFor(eng)
  const ordered = Object.keys(s.orders)
  const wet = exposure.rows.filter((r) => r.atRisk > 0)
  const missedZones = wet.filter((r) => r.order === null)
  const wasted = exposure.rows.filter((r) => r.wasted)
  const verdict = !ordered.length ? ['crit', 'ไม่ได้สั่งอพยพเลย — ทุกโซนที่น้ำถึงจะมีผู้ติดค้างจำนวนมากในองก์ 2']
    : missedZones.length ? ['warn', `ยังไม่ได้สั่ง ${missedZones.length} โซนที่น้ำถึง (${missedZones.map((r) => r.sec.id).join(', ')}) — เตรียมเรือให้พร้อม`]
      : exposure.exposed === 0 ? ['good', 'ยอดเยี่ยม — ทุกโซนที่น้ำถึงอพยพทันก่อนน้ำมา']
        : ['good', `สั่งครบทุกโซนที่น้ำถึง ยังเหลือคนที่อพยพไม่ทัน/ไม่ยอมไป ${fmt(exposure.exposed)} ครัวเรือน`]
  const vhex = { good: '#22E36B', warn: '#FFB300', crit: '#FF003C' }[verdict[0]]
  const usable = s.images.filter((i) => i.usable).length
  const stat = (label, value, src, hex = '#fff') => (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex items-center justify-between gap-1"><span className="font-thai text-[11px] text-slate-400">{label}</span>{src && <Src t={src} mini />}</div>
      <div className="num mt-0.5 text-[19px] font-bold leading-tight" style={{ color: hex }}>{value}</div>
    </div>
  )
  return (
    <Modal open closable={false} width={760} tone={vhex} z={86}>
      <div className="p-6" data-modal="act1-summary">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg border-2" style={{ borderColor: vhex, background: `${vhex}1A` }}><Flag size={21} style={{ color: vhex }} /></div>
          <div>
            <div className="hud-label">ACT I COMPLETE · T−0 · {clockToDate(0)}</div>
            <h2 className="font-thai text-[20px] font-bold leading-tight text-white">มวลน้ำถึงตัวเมือง — สรุปผลองก์ 1</h2>
          </div>
        </div>
        <div className="font-thai mt-3 rounded-lg border px-3 py-2.5 text-[13.5px] font-semibold leading-snug" style={{ borderColor: `${vhex}55`, background: `${vhex}12`, color: verdict[0] === 'good' ? '#C8FFD9' : verdict[0] === 'crit' ? '#FFC2CE' : '#FFE0A3' }}>
          {verdict[1]}
          {wasted.length > 0 && <div className="mt-0.5 text-[12px] font-normal text-[#FFE0A3]">สั่งอพยพโซนที่น้ำไม่ถึง {wasted.map((r) => r.sec.id).join(', ')} — งบเสียเปล่า</div>}
          {s.falseAlarms > 0 && <div className="mt-0.5 text-[12px] font-normal text-[#FFB3C2]">เตือนผิด {s.falseAlarms} ครั้ง — คนไม่เชื่อคำเตือนมากขึ้น</div>}
        </div>
        <div className={`mt-3 grid gap-2 ${eng.mode.tutor ? 'grid-cols-5' : 'grid-cols-4'}`}>
          {stat('ครัวเรือนยังติดอยู่', fmt(exposure.exposed), 'scenario', exposure.exposed ? '#FF6B8A' : '#7CFFA0')}
          {stat('โซนที่สั่ง / ที่น้ำถึง', `${ordered.length} / ${wet.length}`, 'scenario', missedZones.length ? '#FFD066' : '#7CFFA0')}
          {stat('ภาพ THEOS-2 ใช้ได้', `${usable}`, 'image', usable >= 3 ? '#7CFFA0' : '#FFD066')}
          {stat('เวลาเล่นจริง', mmss(eng.realMs() / 1000), null, '#7dd3fc')}
          {eng.mode.tutor && (() => { const h = hintPenalty(s); return stat('ขอคำใบ้ (ชี้ / เฉลย)', `${h.pointer} / ${h.partial}`, null, h.pts ? '#FFD066' : '#7CFFA0') })()}
        </div>
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.025] p-3">
          <div className="font-thai text-[12px] font-bold text-white">ภารกิจองก์ 1</div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1">
            {q.steps.map((st) => (
              <div key={st.id} className="flex items-start gap-2">
                {st.done ? <CheckCircle2 size={14} className="mt-[1px] shrink-0 text-[#22E36B]" /> : <XCircle size={14} className="mt-[1px] shrink-0 text-slate-500" />}
                <span className="min-w-0"><span className={`font-thai block text-[12px] ${st.done ? 'text-[#BFF5CF]' : 'text-slate-400'}`}>{st.title}</span><span className="font-thai block text-[10.5px] text-slate-500">{st.detail}</span></span>
              </div>
            ))}
          </div>
          <div className="font-thai mt-2 text-[11px] text-slate-400">SFVI ล่าสุด {sfvi.basin.toFixed(2)} · L = {sfvi.scars.labelled}/{scn.totalScars} (ระบุถูก {sfvi.scars.tp} · ผิด {sfvi.scars.fp}) · N = {sfvi.N.toFixed(2)} · ความเชื่อมั่น {Math.round(s.trust)}%</div>
        </div>
        <div className="font-thai mt-3 text-[11.5px] leading-snug text-slate-400">องก์ 2: เมฆเคลื่อนผ่านเมือง 35–65% — ใช้ THEOS-2 ถ่ายช่องเมฆหาผู้ติดค้าง · เรดาร์เช็คน้ำบอกความลึก · เรือกู้ภัยออกจากฐานของคุณ</div>
        <div className="mt-4 flex justify-end">
          <Btn variant="danger" size="lg" icon={ArrowRight} onClick={onNext}><span className="font-thai normal-case tracking-normal text-[14px]" data-act1-next>เข้าสู่ องก์ 2: วิกฤตน้ำท่วม</span></Btn>
        </div>
      </div>
    </Modal>
  )
}

/* ── End of act 2 (T+36) ────────────────────────────────────────────────── */

export function Act2SummaryModal({ open, eng, onNext }) {
  if (!open) return null
  const { s } = eng
  const pts = s.points
  const need = pts.reduce((a, p) => a + p.people, 0)
  const saved = pts.reduce((a, p) => a + p.rescued + (p.status === 'supplied' ? p.people : 0), 0)
  const lost = pts.reduce((a, p) => a + p.lost + (p.status === 'waiting' && p.type === 'critical' ? p.left : 0), 0)
  const injured = pts.reduce((a, p) => a + p.injured, 0), injOk = pts.reduce((a, p) => a + p.toHospital, 0)
  const found = pts.filter((p) => p.revealed)
  const byTheos = found.filter((p) => p.revealed === 'theos').length
  const share = need ? saved / need : 1
  const hex = share >= 0.8 ? '#22E36B' : share >= 0.5 ? '#FFB300' : '#FF003C'
  const stat = (Icon, label, value, color = '#fff') => (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
      <div className="font-thai flex items-center gap-1.5 text-[11px] text-slate-400"><Icon size={12} />{label}</div>
      <div className="num mt-0.5 text-[19px] font-bold leading-tight" style={{ color }}>{value}</div>
    </div>
  )
  return (
    <Modal open closable={false} width={720} tone={hex} z={86}>
      <div className="p-6" data-modal="act2-summary">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg border-2" style={{ borderColor: hex, background: `${hex}1A` }}><Flag size={21} style={{ color: hex }} /></div>
          <div>
            <div className="hud-label">ACT II COMPLETE · T+36 · {clockToDate(36 * 60)}</div>
            <h2 className="font-thai text-[20px] font-bold leading-tight text-white">น้ำเริ่มลด — สรุปผลการช่วยเหลือ</h2>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {stat(Users, 'ผู้ที่ต้องการความช่วยเหลือ', fmt(need))}
          {stat(CheckCircle2, 'ช่วยได้ (อพยพ + เสบียง)', `${fmt(saved)} (${Math.round(share * 100)}%)`, hex)}
          {stat(AlertTriangle, 'สูญเสีย/ช่วยไม่ทัน', fmt(lost), lost ? '#FF6B8A' : '#7CFFA0')}
          {stat(HeartPulse, 'ผู้บาดเจ็บถึงโรงพยาบาล', `${injOk}/${injured}`, injOk === injured ? '#7CFFA0' : '#FFD066')}
          {stat(Satellite, 'จุดที่ THEOS-2 พบ', `${byTheos}/${found.length}`, '#7dd3fc')}
          {stat(Route, 'เส้นทางผิด', s.routeErrors, s.routeErrors ? '#FF6B8A' : '#7CFFA0')}
          {stat(Fuel, 'น้ำมันที่ใช้', `${fmt(s.fuel.used)} / ${fmt(s.fuel.total)} L`)}
          {stat(Wallet, 'งบคงเหลือ', `฿${fmt((s.budget.total - s.budget.spent) / 1e6, 2)}M`, '#FFD066')}
          {stat(Clock, 'เวลาเล่นจริงสะสม', mmss(eng.realMs() / 1000), '#7dd3fc')}
        </div>
        {eng.mode.tutor && (() => {
          const h = hintPenalty(s)
          return (
            <div className="font-thai mt-2 flex items-center gap-2 rounded-lg border border-[#FFD066]/25 bg-[#FFD066]/[0.05] px-3 py-1.5 text-[12px] text-slate-300" data-hint-summary>
              <Lightbulb size={13} className="text-[#FFD066]" />
              คำใบ้แบบบันไดที่ขอทั้งหมด: ชี้ที่ข้อมูล {h.pointer} · เฉลยบางส่วน {h.partial} · หักคะแนน <b className={h.pts ? 'text-[#FF9DB2]' : 'text-[#7CFFA0]'}>−{h.pts}</b>
              <span className="ml-auto text-[11px] text-slate-500">องก์ 3 มีแค่คำถาม — ใช้สิ่งที่เรียนมา</span>
            </div>
          )
        })()}
        <div className="font-thai mt-3 text-[11.5px] leading-snug text-slate-400">องก์ 3: ภาพ THEOS-2 หลังน้ำลดและไทม์ซีรีส์เรดาร์มาถึงแล้ว — ตัดสินเยียวยา {eng.scn.roofs.length} หลังคาให้ครบภายในวันที่ 60</div>
        <div className="mt-4 flex justify-end">
          <Btn variant="primary" size="lg" icon={ArrowRight} onClick={onNext}><span className="font-thai normal-case tracking-normal text-[14px]" data-act2-next>เข้าสู่ องก์ 3: ฟื้นฟู</span></Btn>
        </div>
      </div>
    </Modal>
  )
}

/* ── Teacher log panel (hidden button, top-right) ───────────────────────── */

export function TeacherPanel({ open, onClose, version }) {
  const sum = useMemo(() => logger.summary(), [open, version])
  const sessions = useMemo(() => logger.sessions().slice(-12).reverse(), [open, version])
  const [confirm, setConfirm] = useState(false)
  const stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, '')
  const chip = (ok) => (ok === null ? <span className="font-thai text-[11px] text-slate-500">ยังไม่มีข้อมูล</span>
    : ok ? <span className="font-thai rounded bg-[#22E36B]/15 px-1.5 py-0.5 text-[11px] text-[#7CFFA0]">ผ่าน</span>
      : <span className="font-thai rounded bg-[#FF003C]/15 px-1.5 py-0.5 text-[11px] text-[#FF9DB2]">ไม่ผ่าน</span>)
  return (
    <Modal open={open} onClose={onClose} width={860} z={95}>
      <div className="p-6" data-modal="teacher">
        <div className="flex items-center gap-3">
          <Database size={20} className="text-sky-300" />
          <div>
            <div className="hud-label">AUTOMATED EVALUATION LOGGER · TEACHER MODE</div>
            <h2 className="font-thai text-[19px] font-bold text-white">บันทึกการทดสอบ (Sandbox Test)</h2>
          </div>
        </div>
        <div className="font-thai mt-1 text-[12px] text-slate-400">เก็บในเครื่องนี้ (localStorage) · {sum.sessions} รอบการเล่น{sum.demo ? ` (ไม่นับโหมดสาธิต ${sum.demo} รอบ)` : ''} · ส่งออก CSV ไปวิเคราะห์ Paired t-test ในรายงาน</div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="font-thai text-[12px] text-slate-400">เปิดข้อมูล ≥ {EVAL.minLayersBeforeDecision} ชั้นก่อนตัดสินใจ</div>
            <div className="num mt-1 text-[22px] font-bold text-white">{sum.layerShare === null ? '—' : pct(sum.layerShare)}</div>
            <div className="mt-1 flex items-center gap-2"><span className="font-thai text-[11px] text-slate-500">เกณฑ์ ≥ {pct(EVAL.passShare)}</span>{chip(sum.layerPass)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="font-thai text-[12px] text-slate-400">คะแนนก่อน → หลังเรียน ({sum.paired} คู่)</div>
            <div className="num mt-1 text-[22px] font-bold text-white">{sum.pre === null ? '—' : sum.pre.toFixed(2)} → {sum.post === null ? '—' : sum.post.toFixed(2)}</div>
            <div className="mt-1 flex items-center gap-2"><span className="font-thai text-[11px] text-slate-500">เพิ่ม {sum.gain === null ? '—' : pct(sum.gain)} · เกณฑ์ ≥ {pct(EVAL.postTestGainTarget)}</span>{chip(sum.gainPass)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="font-thai text-[12px] text-slate-400">เวลาอ่านกติกา (Briefing)</div>
            <div className="num mt-1 text-[22px] font-bold text-white">{sum.briefingMin === null ? '—' : `${sum.briefingMin.toFixed(1)} นาที`}</div>
            <div className="mt-1 flex items-center gap-2"><span className="font-thai text-[11px] text-slate-500">เกณฑ์ &lt; {EVAL.briefingTargetMin} นาที</span>{chip(sum.briefingPass)}</div>
          </div>
        </div>

        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              {['รอบ', 'ผู้เล่น', 'คำแนะนำ', 'ขอคำใบ้ (ชี้/เฉลย)', 'Pre', 'Post', 'ชั้นข้อมูลก่อนตัดสินใจ', 'การตัดสินใจ', 'คะแนนภารกิจ'].map((h) => (
                <th key={h} className="font-thai px-2 py-1.5 text-left text-[11px] font-semibold text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 && (
              <tr><td colSpan={9} className="font-thai px-2 py-3 text-center text-[12px] text-slate-500">ยังไม่มีบันทึก</td></tr>
            )}
            {sessions.map((s) => {
              const first = s.rounds.find((r) => r.kind !== 'HOLD') || s.rounds[0]
              return (
                <tr key={s.id} className="border-b border-white/[0.05]">
                  <td className="num px-2 py-1.5 text-[11px] text-slate-300">{s.id}{s.demo && <span className="font-thai ml-1 text-[10px] text-[#FFD066]">สาธิต</span>}</td>
                  <td className="font-thai px-2 py-1.5 text-[11.5px] text-white">{s.player || '—'}</td>
                  <td className="font-thai px-2 py-1.5 text-[11px] text-slate-400">{s.hintsEnabled ? 'เปิด' : 'ปิด'}</td>
                  <td className="num px-2 py-1.5 text-[11.5px] text-slate-300">{s.hintsEnabled ? `${(s.hints || []).filter((h) => h.rung === 2).length} / ${(s.hints || []).filter((h) => h.rung === 3).length}` : '—'}</td>
                  <td className="num px-2 py-1.5 text-[11.5px] text-slate-300">{s.pre?.score ?? '—'}</td>
                  <td className="num px-2 py-1.5 text-[11.5px] text-slate-300">{s.post?.score ?? '—'}</td>
                  <td className="num px-2 py-1.5 text-[11.5px]" style={{ color: (first?.layersOpened ?? 0) >= EVAL.minLayersBeforeDecision ? '#7CFFA0' : '#FF9DB2' }}>{first ? first.layersOpened : '—'}</td>
                  <td className="num px-2 py-1.5 text-[11.5px] text-slate-300">{s.rounds.length}</td>
                  <td className="num px-2 py-1.5 text-[11.5px] text-slate-300">{s.result?.score ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Btn variant="primary" icon={Download} onClick={() => downloadText(logger.sessionsCSV(), `maesai-sessions-${stamp}.csv`)}>
            <span className="font-thai normal-case tracking-normal text-[12.5px]">Export Log CSV · รายผู้เล่น</span>
          </Btn>
          <Btn variant="ghost" icon={Download} onClick={() => downloadText(logger.roundsCSV(), `maesai-rounds-${stamp}.csv`)}>
            <span className="font-thai normal-case tracking-normal text-[12.5px]">Export CSV · รายการตัดสินใจ</span>
          </Btn>
          <Btn variant="ghost" icon={Download} onClick={() => downloadText(logger.hintsCSV(), `maesai-hints-${stamp}.csv`)}>
            <span className="font-thai normal-case tracking-normal text-[12.5px]">Export CSV · การขอคำใบ้</span>
          </Btn>
          <div className="ml-auto">
            {confirm ? (
              <span className="flex items-center gap-2">
                <span className="font-thai text-[11.5px] text-[#FF9DB2]">ลบบันทึกทั้งหมดในเครื่องนี้?</span>
                <Btn variant="danger" size="sm" onClick={() => { logger.clear(); setConfirm(false) }}><span className="font-thai normal-case">ลบ</span></Btn>
                <Btn variant="solid" size="sm" onClick={() => setConfirm(false)}><span className="font-thai normal-case">ยกเลิก</span></Btn>
              </span>
            ) : (
              <Btn variant="solid" size="sm" icon={Trash2} onClick={() => setConfirm(true)}><span className="font-thai normal-case">ล้างบันทึก</span></Btn>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
