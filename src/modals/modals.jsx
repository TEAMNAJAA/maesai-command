/* ══════════════════════════════════════════════════════════════════════════
   MODALS — briefing · pre/post test · veto-1 alert · cloud rule · hold
   comparison · teacher log panel
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo } from 'react'
import {
  Shield, Satellite, Radar, Building2, AlertTriangle, Cloud, Route, Megaphone, CheckCircle2, XCircle, Clock, Database, Download, Trash2, ArrowRight, GraduationCap,
} from 'lucide-react'
import { Modal, Btn, Src, SrcLegend } from '../ui/atoms'
import { QUIZ, COMMUNITIES } from '../config/scenarioData'
import { SFVI, THRESHOLDS, RELIEF, TRUST, GAME, EVAL } from '../config/missionConfig'
import { clockLabel, clockToDate, fmt, pct } from '../lib/format'
import { logger, downloadText } from '../lib/evalLogger'
import { evacCostFor } from '../engine/useEngine'

/* ── Mission briefing ───────────────────────────────────────────────────── */

export function BriefingModal({ open, firstRun, onEnter, onClose, player, setPlayer }) {
  const acts = [
    { n: 1, hex: '#22E36B', icon: Satellite, title: 'องก์ 1: เฝ้าระวัง', time: 'T−48 → T−0 ชม.', sensor: 'THEOS-2 (ภาพเชิงแสง)',
      body: 'ใช้เหรียญข้อมูลเปิดชั้นข้อมูล สั่งถ่ายภาพ THEOS-2 ไปที่ป่าต้นน้ำในเมียนมาหารอยดินถล่ม (L) และวัดความกว้างลำน้ำ (N) แล้วตัดสินใจว่าจะเตือน/อพยพชุมชนใด เมื่อใด' },
    { n: 2, hex: '#FF003C', icon: Radar, title: 'องก์ 2: วิกฤต', time: 'T+0 → T+36 ชม.', sensor: 'เรดาร์ RADARSAT-2 (เช็คน้ำ)',
      body: 'เมฆบัง 100% ภาพเชิงแสงถูกปิดอัตโนมัติ สลับไปใช้เรดาร์ ใช้ Sphere Routing หาเส้นทางหนีน้ำเมื่อถนนขาด และจัดลำดับส่งกำลังให้ 4 ชุมชน' },
    { n: 3, hex: '#38BDF8', icon: Building2, title: 'องก์ 3: ฟื้นฟู', time: 'T+36 ชม. →', sensor: 'THEOS-2 Pan 0.5 ม. + เรดาร์',
      body: `เทียบภาพก่อน–หลังรายหลังคา อนุมัติเงินเยียวยา ${fmt(RELIEF.flatGrant)} บ. (ท่วมขัง ≥ ${RELIEF.inundationMinDays} วัน) + ค่าล้างโคลน ${fmt(RELIEF.mudGrant)} บ. หรือส่งสำรวจภาคพื้น` },
  ]
  return (
    <Modal open={open} onClose={onClose} closable={!firstRun} width={880} z={90}>
      <div className="p-6" data-modal="briefing">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg border border-sky-400/40 bg-sky-400/10"><Shield size={22} className="text-sky-300" /></div>
          <div>
            <div className="hud-label">MISSION BRIEFING · THEOS-2 MAE SAI COMMAND</div>
            <h1 className="font-thai text-[22px] font-bold leading-tight text-white">ภารกิจผู้บัญชาการ EOC แม่สาย</h1>
          </div>
        </div>

        <p className="font-thai mt-3 text-[13.5px] leading-relaxed text-slate-300">
          คุณคือ <b className="text-sky-200">ผู้บัญชาการศูนย์ปฏิบัติการฉุกเฉิน (EOC) อำเภอแม่สาย</b> จ.เชียงราย — ฝนตกหนักต่อเนื่อง
          แต่ <b className="text-[#FFD066]">ต้นน้ำแม่น้ำสายราว 965 ตร.กม. อยู่ในเมียนมา</b> ไทยตั้งสถานีวัดที่นั่นไม่ได้ และโดรนบินข้ามพรมแดนไม่ได้
          ดาวเทียมจึงเป็นเซนเซอร์เดียวที่มองเห็นต้นเหตุ เป้าหมายของคุณ: ปกป้องครัวเรือนใน 4 ชุมชนเฝ้าระวัง
          (สายลมจอย · เกาะทราย · ไม้ลุงขน · เหมืองแดง) รักษาความเชื่อมั่นของประชาชน และเยียวยาอย่างเป็นธรรม
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {acts.map((a) => (
            <div key={a.n} className="rounded-lg border p-3" style={{ borderColor: `${a.hex}44`, background: `${a.hex}0B` }}>
              <div className="flex items-center gap-2">
                <a.icon size={15} style={{ color: a.hex }} />
                <span className="font-thai text-[14px] font-bold text-white">{a.title}</span>
              </div>
              <div className="num mt-0.5 text-[11px]" style={{ color: a.hex }}>{a.time}</div>
              <div className="font-thai mt-0.5 text-[11px] text-slate-400">{a.sensor}</div>
              <div className="font-thai mt-1.5 text-[12px] leading-snug text-slate-300">{a.body}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="font-thai text-[13px] font-bold text-white">กฎการตัดสินใจ</div>
            <div className="num mt-1 text-[12px] text-sky-200">SFVI = 0.30·W + 0.25·R + 0.20·L + 0.15·N + 0.10·P</div>
            <ul className="font-thai mt-1.5 space-y-1 text-[12px] leading-snug text-slate-300">
              <li>• SFVI ≥ {SFVI.decisionBand} = มีหลักฐานพอสั่งอพยพ</li>
              <li>• <b className="text-[#FF6B8A]">Veto 1:</b> ระดับน้ำถ้ำผาจม ≥ {THRESHOLDS.criticalLevel.toFixed(2)} ม. → อพยพทันที ไม่รอภาพ</li>
              <li>• <b className="text-[#C4B5FD]">Cloud Rule:</b> เมฆบัง → ลดน้ำหนัก L และความเชื่อมั่นต่ำ</li>
              <li>• เตือนผิดเสียความเชื่อมั่นทบ −{TRUST.falseAlarmPenalties.join('/−')} · เตือนช้า −{TRUST.lateWarningPenalty}</li>
              <li>• "ยังไม่สั่งการ" ได้เสมอ — แต่เวลาเดินต่อ {GAME.holdMinutes / 60} ชม. และมีราคา</li>
            </ul>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="font-thai text-[13px] font-bold text-white">อ่านหน้าจอ</div>
            <ul className="font-thai mt-1.5 space-y-1 text-[12px] leading-snug text-slate-300">
              <li>• <b>ซ้าย</b> = แผงประเมิน (SFVI สด · ระดับน้ำ · ความเชื่อมั่น)</li>
              <li>• <b>กลาง</b> = แผนที่ — สลับมุมมองด้านบน · ปุ่ม 3D เอียงภูมิประเทศ</li>
              <li>• <b>ขวา</b> = แผงสั่งการ (ชั้นข้อมูล · ทรัพยากร · ตัดสินใจ)</li>
              <li>• ◈ เหรียญข้อมูลซื้อชั้นข้อมูล · AP ใช้สั่งการ</li>
            </ul>
            <div className="font-thai mt-2 text-[11.5px] text-slate-400">ทุกตัวเลขมีป้ายบอกที่มา:</div>
            <SrcLegend className="mt-1" />
          </div>
        </div>

        <div className="mt-4 flex items-end gap-3">
          {firstRun && (
            <label className="flex-1">
              <span className="font-thai text-[11.5px] text-slate-400">รหัสผู้เล่น / ชื่อเล่น (ไม่บังคับ — ใช้จับคู่ผลแบบทดสอบในบันทึกครู)</span>
              <input value={player} onChange={(e) => setPlayer(e.target.value)} maxLength={40} placeholder="เช่น ม.6/2-05"
                className="font-thai mt-1 w-full rounded border border-white/15 bg-black/30 px-3 py-2 text-[13px] text-white outline-none focus:border-sky-400/60" />
            </label>
          )}
          <Btn variant="primary" size="lg" icon={ArrowRight} className={firstRun ? '' : 'ml-auto'} onClick={firstRun ? onEnter : onClose}>
            <span className="font-thai normal-case tracking-normal text-[14px]">{firstRun ? 'เข้าสู่ศูนย์บัญชาการ' : 'กลับสู่ศูนย์บัญชาการ'}</span>
          </Btn>
        </div>
      </div>
    </Modal>
  )
}

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

/* ── Veto 1 red alert ───────────────────────────────────────────────────── */

export function VetoAlert({ open, eng, onAck, onDecide }) {
  const { s, world } = eng
  const pending = COMMUNITIES.filter((c) => s.evacOrders[c.id] === undefined)
  const cost = evacCostFor(1, pending.length || 4)
  return (
    <Modal open={open} closable={false} width={560} tone="#FF003C" z={85}>
      <div className="p-6 text-center" data-modal="veto">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border-2 border-[#FF003C] bg-[#FF003C]/15 animate-[softflash_1.1s_ease-in-out_infinite]">
          <AlertTriangle size={30} className="text-[#FF003C]" />
        </div>
        <div className="mt-3 font-mono text-[12px] font-bold tracking-[0.2em] text-[#FF3B63]">VETO RULE 1 · CRITICAL ALERT</div>
        <h2 className="font-thai mt-1 text-[22px] font-bold text-white">บังคับอพยพทันที</h2>
        <p className="font-thai mt-2 text-[14px] leading-relaxed text-slate-300">
          ระดับน้ำสถานีบ้านถ้ำผาจม <b className="num text-[#FF6B8A]">{world.level.toFixed(2)} ม.</b> ถึงระดับวิกฤต
          ({THRESHOLDS.criticalLevel.toFixed(2)} ม. กรมทรัพยากรน้ำ) — ต้องสั่งอพยพโดย<b>ไม่รอภาพยืนยัน</b> ไม่ว่าค่า SFVI จะเป็นเท่าใด
        </p>
        <div className="mt-2 flex justify-center"><Src t="measured" /></div>
        {pending.length > 0 ? (
          <div className="font-thai mt-3 text-[12.5px] text-[#FFB3C2]">ยังไม่ได้รับคำสั่ง: {pending.map((c) => c.th).join(' · ')}</div>
        ) : (
          <div className="font-thai mt-3 text-[12.5px] text-[#7CFFA0]">ทุกชุมชนได้รับคำสั่งอพยพแล้ว</div>
        )}
        <div className="mt-5 flex flex-col gap-2">
          {pending.length > 0 && (
            <Btn variant="danger" size="lg" icon={Megaphone} disabled={s.ap < cost}
              onClick={() => { eng.issueOrder('EVACUATE', pending.map((c) => c.id)); onAck() }}>
              <span className="font-thai normal-case tracking-normal text-[14px]">สั่งอพยพ {pending.length} ชุมชนที่เหลือทันที · {fmt(cost)} AP</span>
            </Btn>
          )}
          <Btn variant="solid" onClick={() => { onAck(); onDecide() }}>
            <span className="font-thai normal-case tracking-normal text-[12.5px]">รับทราบ — ไปที่แผงตัดสินใจ</span>
          </Btn>
        </div>
      </div>
    </Modal>
  )
}

/* ── Cloud rule (act 2 entry) ───────────────────────────────────────────── */

export function CloudAlert({ open, onSar, onRouting }) {
  return (
    <Modal open={open} closable={false} width={580} tone="#FF8A3D" z={85}>
      <div className="p-6" data-modal="cloud">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full border-2 border-[#FF8A3D] bg-[#FF8A3D]/15"><Cloud size={24} className="text-[#FFC59A]" /></div>
          <div>
            <div className="font-mono text-[11px] font-bold tracking-[0.2em] text-[#FFC59A]">CLOUD RULE · T+0</div>
            <h2 className="font-thai text-[20px] font-bold text-white">เมฆปกคลุม 100% — ภาพเชิงแสงใช้ไม่ได้</h2>
          </div>
        </div>
        <p className="font-thai mt-3 text-[13.5px] leading-relaxed text-slate-300">
          มวลน้ำเข้าเมืองแล้ว ชั้นภาพ THEOS-2 / อาคาร / LANDX <b>ถูกปิดอัตโนมัติ</b> เพราะดาวเทียมเชิงแสงถ่ายทะลุเมฆไม่ได้
          ค่า L ถูกลดน้ำหนักและติดป้ายความเชื่อมั่นต่ำ ให้สลับไปใช้ <b className="text-[#FFC59A]">เรดาร์ RADARSAT-2 ผ่าน เช็คน้ำ</b> ซึ่งทะลุเมฆได้
          — เหมือนที่ GISTDA ใช้จริงเมื่อ 10 และ 12 ก.ย. 2567
        </p>
        <div className="mt-2 flex gap-2"><Src t="radar" /><Src t="image" /></div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Btn variant="warn" size="lg" icon={Radar} onClick={onSar}>
            <span className="font-thai normal-case tracking-normal text-[13px]">เปิดเรดาร์ SAR (เช็คน้ำ)</span>
          </Btn>
          <Btn variant="go" size="lg" icon={Route} onClick={onRouting}>
            <span className="font-thai normal-case tracking-normal text-[13px]">เปิดเครื่องมือ Sphere Routing</span>
          </Btn>
        </div>
      </div>
    </Modal>
  )
}

/* ── "ยังไม่สั่งการ" dual comparison ─────────────────────────────────────── */

const margin = (m) => {
  const sign = m >= 0 ? '+' : '−'
  const a = Math.abs(m)
  return a >= 120 ? `${sign}${(a / 60).toFixed(1)} ชม.` : `${sign}${Math.round(a)} นาที`
}

export function HoldCompareModal({ data, onClose, onEvacuate }) {
  if (!data) return null
  const diff = data.exposedLater - data.exposedNow
  const cell = (a, b, unit, d = 2, worse = (x, y) => y > x) => (
    <span className="num text-[12px]">
      <span className="text-slate-300">{a.toFixed(d)}</span>
      <span className="mx-1 text-slate-600">→</span>
      <span style={{ color: worse(a, b) ? '#FF6B8A' : '#cbd5e1' }}>{b.toFixed(d)}</span>
      <span className="text-[10px] text-slate-500"> {unit}</span>
    </span>
  )
  return (
    <Modal open onClose={onClose} width={860} tone="#FFB300" z={85}>
      <div className="p-6" data-modal="hold">
        <div className="flex items-center gap-3">
          <Clock size={22} className="text-[#FFD066]" />
          <div>
            <div className="hud-label">INACTION DECISION · DUAL COMPARISON</div>
            <h2 className="font-thai text-[19px] font-bold text-white">ผลของการ "ยังไม่สั่งการ" {GAME.holdMinutes / 60} ชั่วโมง</h2>
          </div>
          <div className="ml-auto"><Src t="scenario" /></div>
        </div>
        <div className="font-thai mt-1 text-[12px] text-slate-400">
          {clockLabel(data.t0)} ({clockToDate(data.t0)}) → {clockLabel(data.t1)} ({clockToDate(data.t1)})
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="font-thai text-[11.5px] text-slate-400">ระดับน้ำสถานีถ้ำผาจม</div>
            <div className="mt-1 text-[16px]">{cell(data.levelNow, data.levelLater, 'ม.')}</div>
          </div>
          <div className="rounded-lg border border-[#22E36B]/30 bg-[#22E36B]/[0.06] p-3">
            <div className="font-thai text-[11.5px] text-slate-400">ทาง ก: สั่งอพยพตอน {clockLabel(data.t0)}</div>
            <div className="num mt-1 text-[22px] font-bold text-[#7CFFA0]">{fmt(data.exposedNow)} <span className="font-thai text-[12px] font-normal text-slate-400">หลังคาเรือนเสี่ยง</span></div>
          </div>
          <div className="rounded-lg border border-[#FF003C]/30 bg-[#FF003C]/[0.06] p-3">
            <div className="font-thai text-[11.5px] text-slate-400">ทาง ข: รอแล้วสั่งตอน {clockLabel(data.t1)}</div>
            <div className="num mt-1 text-[22px] font-bold text-[#FF6B8A]">{fmt(data.exposedLater)} <span className="font-thai text-[12px] font-normal text-slate-400">หลังคาเรือนเสี่ยง</span></div>
          </div>
        </div>

        <table className="mt-4 w-full border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              {['ชุมชน', 'น้ำถึงชุมชน', 'ทาง ก · เสี่ยง (เวลาเหลือ)', 'ทาง ข · เสี่ยง (เวลาเหลือ)', 'ความลึกน้ำในชุมชน', 'โคลนสะสม'].map((h) => (
                <th key={h} className="font-thai px-2 py-2 text-left text-[11px] font-semibold text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.c.id} className="border-b border-white/[0.05]">
                <td className="font-thai px-2 py-2 text-[13px] text-white">{r.c.th}{r.c.exits === 1 && <span className="ml-1 text-[10px] text-[#FF6B8A]">ทางออก 1</span>}</td>
                <td className="num px-2 py-2 text-[11.5px] text-slate-300">{Number.isFinite(r.arrival) ? clockLabel(r.arrival) : '—'}</td>
                {r.ordered ? (
                  <td colSpan={2} className="font-thai px-2 py-2 text-[12px] text-[#7CFFA0]">สั่งอพยพไปแล้ว — ไม่เปลี่ยน ({fmt(r.exposedNow)} เสี่ยง)</td>
                ) : (
                  <>
                    <td className="px-2 py-2"><span className="num text-[12px] text-[#7CFFA0]">{fmt(r.exposedNow)}</span>
                      <span className="num ml-1 text-[10.5px]" style={{ color: r.marginNow >= 0 ? '#64748b' : '#FF6B8A' }}>({margin(r.marginNow)})</span></td>
                    <td className="px-2 py-2"><span className="num text-[12px] text-[#FF6B8A]">{fmt(r.exposedLater)}</span>
                      <span className="num ml-1 text-[10.5px]" style={{ color: r.marginLater >= 0 ? '#64748b' : '#FF6B8A' }}>({margin(r.marginLater)})</span></td>
                  </>
                )}
                <td className="px-2 py-2">{cell(r.depthNow, r.depthLater, 'ม.')}</td>
                <td className="px-2 py-2">{cell(r.mudNow, r.mudLater, 'ซม.', 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="font-thai mt-3 rounded-lg border border-[#FFB300]/30 bg-[#FFB300]/[0.07] px-3 py-2.5 text-[13px] leading-relaxed text-[#FFE0A3]">
          {diff > 0
            ? <>การรอ {GAME.holdMinutes / 60} ชม. ทำให้หลังคาเรือนเสี่ยงเพิ่มขึ้น <b className="num">{fmt(diff)}</b> หลัง — เวลาเหลือสำหรับอพยพลดลง ขณะที่ระดับน้ำและโคลนในชุมชนสูงขึ้น</>
            : <>การรอครั้งนี้ยังไม่ทำให้หลังคาเรือนเสี่ยงเพิ่ม — แต่เวลาที่เหลือก่อนน้ำถึงลดลง และ SFVI ไม่ได้เพิ่มหลักฐานใหม่ ({data.sfviNow.basin.toFixed(3)} → {data.sfviLater.basin.toFixed(3)})</>}
          <div className="mt-1 text-[11.5px] text-slate-400">"เวลาเหลือ" = เวลาตั้งแต่สั่งจนน้ำถึง ลบเวลาที่ต้องใช้อพยพ (ติดลบ = อพยพไม่ทัน)</div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Btn variant="solid" onClick={onClose}><span className="font-thai normal-case tracking-normal text-[12.5px]">รับทราบ</span></Btn>
          <Btn variant="danger" icon={Megaphone} onClick={onEvacuate}><span className="font-thai normal-case tracking-normal text-[12.5px]">ไปสั่งอพยพตอนนี้</span></Btn>
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
              {['รอบ', 'ผู้เล่น', 'คำแนะนำ', 'Pre', 'Post', 'ชั้นข้อมูลก่อนตัดสินใจ', 'การตัดสินใจ', 'คะแนนภารกิจ'].map((h) => (
                <th key={h} className="font-thai px-2 py-1.5 text-left text-[11px] font-semibold text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.length === 0 && (
              <tr><td colSpan={8} className="font-thai px-2 py-3 text-center text-[12px] text-slate-500">ยังไม่มีบันทึก</td></tr>
            )}
            {sessions.map((s) => {
              const first = s.rounds.find((r) => r.kind !== 'HOLD') || s.rounds[0]
              return (
                <tr key={s.id} className="border-b border-white/[0.05]">
                  <td className="num px-2 py-1.5 text-[11px] text-slate-300">{s.id}{s.demo && <span className="font-thai ml-1 text-[10px] text-[#FFD066]">สาธิต</span>}</td>
                  <td className="font-thai px-2 py-1.5 text-[11.5px] text-white">{s.player || '—'}</td>
                  <td className="font-thai px-2 py-1.5 text-[11px] text-slate-400">{s.hintsEnabled ? 'เปิด' : 'ปิด'}</td>
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
