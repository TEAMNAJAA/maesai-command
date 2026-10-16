/* ══════════════════════════════════════════════════════════════════════════
   GUIDE + LEADERBOARD
   คู่มือการเล่น (อ่านได้ทุกเมื่อจากปุ่มหนังสือ) · Leaderboard ต่อโหมด (เก็บในเครื่อง)
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo } from 'react'
import { BookOpen, Trophy, Satellite, Ship, Building2, Calculator, Target, Trash2 } from 'lucide-react'
import { Modal, Btn, SrcLegend } from '../ui/atoms'
import { SFVI, THRESHOLDS, THEOS2, RELIEF, COSTS, BOAT, FUEL_FACTOR, ACT2, MODES, SCORE, MISSION, PACE, DURATIONS } from '../config/missionConfig'
import { leaderboard } from '../lib/leaderboard'
import { fmt, mmss } from '../lib/format'

const TABS = [
  ['overview', 'ภาพรวม', BookOpen], ['act1', 'องก์ 1', Satellite], ['act2', 'องก์ 2', Ship], ['act3', 'องก์ 3', Building2],
  ['math', 'สูตร & ข้อมูล', Calculator], ['score', 'คะแนน', Target],
]

const H = ({ children }) => <h3 className="font-thai mt-3 text-[14px] font-bold text-white first:mt-0">{children}</h3>
const P = ({ children }) => <p className="font-thai mt-1 text-[12.5px] leading-relaxed text-slate-300">{children}</p>
const Steps = ({ items }) => (
  <ol className="mt-1.5 space-y-1">
    {items.map((t, i) => (
      <li key={i} className="font-thai flex gap-2 text-[12.5px] leading-snug text-slate-300">
        <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-400/20 text-[10.5px] font-bold text-sky-200">{i + 1}</span>
        <span>{t}</span>
      </li>
    ))}
  </ol>
)

export function GuideModal({ open, onClose, initial = 'overview' }) {
  const [tab, setTab] = useState(initial)
  if (!open) return null
  return (
    <Modal open onClose={onClose} width={920} tone="#38BDF8" z={92}>
      <div className="flex max-h-[86vh] flex-col p-5" data-modal="guide">
        <div className="flex items-center gap-3">
          <BookOpen size={20} className="text-sky-300" />
          <div>
            <div className="hud-label">HOW TO PLAY · คู่มือการเล่น</div>
            <h2 className="font-thai text-[19px] font-bold text-white">THEOS-2 Mae Sai Command — เล่นอย่างไร</h2>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          {TABS.map(([id, th, Icon]) => (
            <button key={id} onClick={() => setTab(id)} data-guide-tab={id}
              className={`font-thai flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-[12px] font-semibold ${tab === id ? 'bg-sky-400/20 text-white' : 'bg-white/[0.03] text-slate-400 hover:text-white'}`}>
              <Icon size={13} />{th}
            </button>
          ))}
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
          {tab === 'overview' && (
            <>
              <H>บทบาทของคุณ</H>
              <P>ผู้บัญชาการศูนย์ปฏิบัติการฉุกเฉิน (EOC) อำเภอแม่สาย ช่วงพายุยางิ ก.ย. 2567 ต้นน้ำแม่น้ำสายราว 965 ตร.กม. อยู่ในเมียนมา ตั้งสถานีวัดไม่ได้ <b className="text-sky-200">ดาวเทียม THEOS-2 คือตาหลักของคุณ</b> ส่วนเรดาร์ เช็คน้ำ โดรน และอุปกรณ์ภาคสนามเป็นตัวช่วย</P>
              <H>ทรัพยากร — ไม่มีแต้ม AP</H>
              <P>• <b>เวลา</b>: นาฬิกาเดินจริง องก์ 1 (48 ชม.) ≈ {Math.round(48 * 60 / PACE.act1MinPerSec / 60)} นาที · องก์ 2 (36 ชม.) ≈ {Math.round(36 * 60 / PACE.act2MinPerSec / 60)} นาที · ทุกงานของทีมใช้เวลาจริงในเกม · ทั้งภารกิจต้องจบใน {MISSION.deadlineDays} วัน<br />
                • <b>งบประมาณ (บาท)</b>: สั่งอพยพ ตั้งฐาน บิ๊กแบ็ก เครื่องสูบ เสาสื่อสาร โดรน — ใช้ผิดที่ = หมดงบตอนจำเป็น<br />
                • <b>น้ำมันเรือ</b>: ให้ {Math.round(FUEL_FACTOR * 100)}% ของที่ต้องใช้จริงถ้าวางเส้นทางถูก</P>
              <H>สองโหมด</H>
              <P>• <b className="text-[#7CFFA0]">Beginner</b>: ป้าย 2 บรรทัด (ไทยเข้าใจง่าย + ศัพท์เทคนิค) · แถบผู้ช่วยสอนด้านล่าง + ไฟชี้เป้า · หยุดเวลาได้ · บอกอันตรายของเส้นทาง · งบ ฿{fmt(MODES.beginner.budget / 1e6)}M เรือ {MODES.beginner.boats} ลำ<br />
                • <b className="text-[#FF9DB2]">Expert</b>: ศัพท์เทคนิคล้วน · ไม่มีตัวช่วย · หยุดเวลาไม่ได้ · ต้องอ่านอันตรายจากแผนที่เอง · งบ ฿{fmt(MODES.expert.budget / 1e6, 1)}M เรือ {MODES.expert.boats} ลำ</P>
              <H>อ่านหน้าจอ</H>
              <P>ซ้าย = <b>ข้อมูล</b> (SFVI · ดาวเทียม · ตารางโซน · ทรัพยากร) — ข้อมูลที่ใช้ตัดสินใจทั้งหมดอยู่ที่นี่ · กลาง = <b>แผนที่</b> (ลุ่มน้ำต้นน้ำ · เมือง 10 โซน · แนวตลิ่ง) · ขวา = <b>สั่งการ</b> พร้อมกล่องภารกิจ · ทุกตัวเลขมีป้ายที่มา:</P>
              <SrcLegend className="mt-1.5" />
            </>
          )}
          {tab === 'act1' && (
            <>
              <H>องก์ 1 · เฝ้าระวัง (T−48 → T−0)</H>
              <Steps items={[
                'แท็บ ④ ฐาน: เลือกที่ตั้งฐานบัญชาการ — ดูความสูงพื้นและระยะจากแม่น้ำ ฐานที่น้ำท่วมจะทำให้เรือออกช้า 3 ชม.',
                `แท็บ ① THEOS-2: ดาวเทียมผ่าน ${THEOS2.act1Passes} รอบ (เวลาในแท็บ "ดาวเทียม" ทางซ้าย) เลือกได้รอบละ ${THEOS2.targetsPerPass} เป้าหมาย ก่อนดาวเทียมผ่าน — ดูเมฆพยากรณ์ เกิน ${THEOS2.cloudUsablePct}% ภาพใช้ไม่ได้`,
                'เมื่อภาพพร้อม (2 ชม. หลังถ่าย) กด "แปลภาพ": ลากเทียบภาพก่อน/หลัง ระบุเฉพาะรอยดินถล่มใหม่ ระวังทุ่งนา เงาเมฆ และรอยเก่า → ได้ค่า L',
                'ต้องถ่าย Sector D/E หรือตัวเมืองอย่างน้อย 1 ภาพ แล้วเปิดเครื่องมือวัดลำน้ำในแท็บ ② ลากเส้นวัดที่ขอบน้ำ อ่านจำนวนพิกเซล คำนวณ N เอง',
                'แท็บ ② ส่งทีมบิ๊กแบ็กอุดจุดฟันหลอ — ทีมมีจำกัด ทำตามคิว จุดที่ยังเปิดทำให้น้ำเข้าเร็วขึ้น (ดูน้ำไหลผ่านช่องบนแผนที่แนวตลิ่ง)',
                'แท็บ ③ อพยพ: สั่งแยกรายโซน ดูตารางโซนทางซ้าย (SFVI · ลึก · เวลาที่เหลือ) สั่งเฉพาะโซนที่น้ำจะถึง และสั่งก่อนเวลาที่เหลือหมด',
                'ถึง T−0 องก์จบเอง → หน้าสรุปผล → องก์ 2',
              ]} />
            </>
          )}
          {tab === 'act2' && (
            <>
              <H>องก์ 2 · วิกฤต (T+0 → T+36)</H>
              <Steps items={[
                `เมฆเคลื่อนผ่านเมือง ครอบคลุม ${ACT2.cloudMinPct}–${ACT2.cloudMaxPct}% — สั่ง THEOS-2 ถ่ายทุกรอบ (แท็บ ②) ภาพจะเห็นคนติดค้างเฉพาะโซนที่เมฆเปิดตอนดาวเทียมผ่าน`,
                `เรดาร์เช็คน้ำอัปเดตความลึกรายโซนทุก ${ACT2.radarRevisitH} ชม. (ทะลุเมฆ แต่ไม่เห็นคน) · สายด่วน 1784 แจ้งเหตุได้เฉพาะโซนที่สัญญาณยังอยู่`,
                'โซน "จุดอับ" (ซอยลึก/ใต้ร่มไม้) ดาวเทียมมองไม่เห็นคน — ส่งโดรนช่วยส่อง',
                'คนที่พบมี 2 แบบ: อยู่ไม่ได้ (ส่งเรืออพยพ) · ยังอยู่ได้แต่ลำบาก (ส่งถุงยังชีพ) — ถ้าเสบียงไม่ถึงตามเวลา จะทรุดเป็นต้องอพยพ',
                'ผู้บาดเจ็บต้องส่ง "โรงพยาบาลแม่สาย" ส่งผิดที่เสียคะแนน',
                'วางแผนเรือ: เลือกเส้นทางเอง — หลีกเลี่ยงแนวริมแม่น้ำ (กระแสแรง) โซนน้ำลึก ≥ 1.6 ม. ที่ยังไม่สูบ และโซนไฟฟ้ารั่วที่ยังไม่ตัดไฟ · เลือกผิด = "คำนวณเส้นทางผิด" เสียเวลา น้ำมัน และคะแนน',
                'แท็บ ③: ไฟฟ้ารั่ว → สั่ง กฟภ. ตัดไฟก่อน · พายุตัดสัญญาณ → ตั้งเสาสื่อสาร (3 ชม.) · เครื่องสูบน้ำลดน้ำ 0.5 ม. เปิดเส้นทางที่ดีที่สุด',
              ]} />
            </>
          )}
          {tab === 'act3' && (
            <>
              <H>องก์ 3 · ฟื้นฟู (วันที่ 2 → 60)</H>
              <Steps items={[
                'แท็บ "เยียวยารายหลังคา": คลิกหลังคา (รหัส BD-<FID> ของ GISTDA) แผนที่ซูมไปที่หลังนั้นอัตโนมัติ',
                `นับวันท่วมขังจากกราฟเรดาร์ 14 วัน — ≥ ${RELIEF.inundationMinDays} วัน ได้เหมาจ่าย ฿${fmt(RELIEF.flatGrant)}`,
                `ลากสไลเดอร์ภาพ THEOS-2 ก่อน/หลัง ดูคราบโคลนรอบบ้าน — มีโคลนชัด + ท่วม ≥ ${RELIEF.inundationMinDays} วัน ได้ค่าล้างโคลนเพิ่ม ฿${fmt(RELIEF.mudGrant)}`,
                'ถ้ากราฟเรดาร์ขาดช่วง หรือภาพหลังมีเมฆบัง = หลักฐานไม่พอ → ส่งสำรวจภาคพื้น (แม่นแต่ใช้ 2 วัน) หรือเสี่ยงตัดสิน',
                'ตัดสินครบ 12 หลังภายในวันที่ 60 → ดูคะแนน → บันทึกลง Leaderboard',
              ]} />
            </>
          )}
          {tab === 'math' && (
            <>
              <H>SFVI — ดัชนีความเสี่ยงลุ่มน้ำสาย</H>
              <div className="num mt-1 rounded bg-black/30 px-3 py-2 text-[14px] text-sky-200">SFVI = 0.30·W + 0.25·R + 0.20·L + 0.15·N + 0.10·P  (≥ {SFVI.decisionBand} = หลักฐานพอสั่งอพยพ)</div>
              <P>W = ระดับน้ำถ้ำผาจม ÷ {THRESHOLDS.criticalLevel} ม. · R = ฝนสะสมโจตาดา ÷ {SFVI.rainNormMm} มม. · L = รอยดินถล่มใหม่ที่คุณระบุ ÷ ทั้งหมด · N = 1 − ความกว้างลำน้ำ ÷ {THRESHOLDS.origChannelWidth} ม. · P = หลังคาในเขตน้ำถึง ÷ หลังคาในโซน (GISTDA)</P>
              <H>ความกว้างลำน้ำจากภาพ THEOS-2</H>
              <div className="num mt-1 rounded bg-black/30 px-3 py-2 text-[14px] text-sky-200">ความกว้าง = จำนวนพิกเซล × {THEOS2.panM} ม. · N = 1 − ความกว้าง ÷ 150</div>
              <P>ตัวอย่าง: 56 พิกเซล × 0.5 = 28 ม. → N = 1 − 28 ÷ 150 = 0.81 · ลำน้ำเหลือไม่ถึงครึ่ง (75 ม.) → ลดเกณฑ์เตรียมพร้อม {THRESHOLDS.narrowChannelPrepDrop} ม.</P>
              <H>เกณฑ์ยับยั้ง</H>
              <P>Veto 1: ระดับน้ำ ≥ {THRESHOLDS.criticalLevel} ม. → อพยพทันทีไม่รอภาพ · Veto 2 (Cloud Rule): เมฆต้นน้ำ &gt; 60% หรือภาพเก่า &gt; 48 ชม. → ลดน้ำหนัก L เหลือ 0.08</P>
              <H>เวลาอพยพต่อโซน</H>
              <P>เวลาที่ต้องใช้ = {DURATIONS.evacMobilise} นาที + ครัวเรือนเสี่ยง ÷ {DURATIONS.evacHHPerMin} ครัวเรือน/นาที · ต้องสั่งก่อน "น้ำถึง − เวลาที่ต้องใช้"</P>
              <H>เรือกู้ภัย</H>
              <P>ความเร็ว {BOAT.speedKmh} กม./ชม. · จุ {BOAT.capacity} คน · น้ำมัน {BOAT.fuelLPerKm} ลิตร/กม. · ค่าใช้จ่าย ฿{fmt(COSTS.boatTrip)}/เที่ยว</P>
            </>
          )}
          {tab === 'score' && (
            <>
              <H>คะแนนภารกิจ (100%)</H>
              <P>THEOS-2 {SCORE.theos * 100}% (วางแผนถ่าย · แปลภาพ · วัดลำน้ำ · ใช้ค้นหาผู้ติดค้าง) · อพยพรายโซน {SCORE.evac * 100}% · ช่วยผู้ติดค้าง {SCORE.rescue * 100}% · โลจิสติกส์ {SCORE.logistics * 100}% (เส้นทาง น้ำมัน งบ ส่งทัน 60 วัน) · เยียวยา {SCORE.relief * 100}% · ความเชื่อมั่น {SCORE.trust * 100}%</P>
              <P>ความเชื่อมั่น: เตือนผิดเสียแบบทบ −5/−15/−40 · เตือนช้า −30 · ความเชื่อมั่นต่ำทำให้คนไม่ยอมอพยพมากขึ้นในองก์ 2</P>
            </>
          )}
        </div>
        <div className="mt-3 flex justify-end"><Btn variant="primary" onClick={onClose}><span className="font-thai normal-case tracking-normal">เข้าใจแล้ว</span></Btn></div>
      </div>
    </Modal>
  )
}

export function LeaderboardModal({ open, onClose, highlight, version }) {
  const [mode, setMode] = useState('beginner')
  const rows = useMemo(() => leaderboard.top(mode, 10), [mode, open, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const [confirm, setConfirm] = useState(false)
  if (!open) return null
  return (
    <Modal open onClose={onClose} width={620} tone="#FFD066" z={93}>
      <div className="p-5" data-modal="leaderboard">
        <div className="flex items-center gap-3">
          <Trophy size={20} className="text-[#FFD066]" />
          <div>
            <div className="hud-label">LEADERBOARD · เก็บในเครื่องนี้</div>
            <h2 className="font-thai text-[19px] font-bold text-white">ตารางคะแนนผู้บัญชาการ</h2>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          {Object.entries(MODES).map(([id, m]) => (
            <button key={id} onClick={() => setMode(id)} className={`font-thai flex-1 rounded px-2 py-1.5 text-[12px] font-semibold ${mode === id ? 'bg-[#FFD066]/20 text-white' : 'bg-white/[0.03] text-slate-400'}`}>{m.th} · {m.en}</button>
          ))}
        </div>
        <table className="mt-3 w-full border-collapse">
          <thead><tr className="border-b border-white/10">{['อันดับ', 'ชื่อ', 'คะแนน', 'เวลาเล่น', 'seed'].map((h) => <th key={h} className="font-thai px-2 py-1.5 text-left text-[11px] text-slate-400">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="font-thai px-2 py-4 text-center text-[12px] text-slate-500">ยังไม่มีคะแนนในโหมดนี้</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.at + r.name} className="border-b border-white/[0.05]" style={highlight && highlight.at === r.at ? { background: 'rgba(255,208,102,.12)' } : undefined}>
                <td className="num px-2 py-1.5 text-[13px] font-bold" style={{ color: i === 0 ? '#FFD066' : i === 1 ? '#cbd5e1' : i === 2 ? '#d6a46c' : '#94a3b8' }}>{i + 1}</td>
                <td className="font-thai px-2 py-1.5 text-[12.5px] text-white">{r.name}</td>
                <td className="num px-2 py-1.5 text-[13px] font-bold text-[#7CFFA0]">{r.score}%</td>
                <td className="num px-2 py-1.5 text-[11.5px] text-slate-400">{mmss(r.sec)}</td>
                <td className="num px-2 py-1.5 text-[11px] text-slate-500">{r.seed}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-center justify-between">
          {confirm ? (
            <span className="flex items-center gap-2"><span className="font-thai text-[11.5px] text-[#FF9DB2]">ล้างทั้งหมด?</span>
              <Btn size="sm" variant="danger" onClick={() => { leaderboard.clear(); setConfirm(false); onClose() }}><span className="font-thai normal-case">ล้าง</span></Btn>
              <Btn size="sm" variant="solid" onClick={() => setConfirm(false)}><span className="font-thai normal-case">ยกเลิก</span></Btn></span>
          ) : <Btn size="sm" variant="solid" icon={Trash2} onClick={() => setConfirm(true)}><span className="font-thai normal-case">ล้างตาราง (ครู)</span></Btn>}
          <Btn variant="primary" onClick={onClose}><span className="font-thai normal-case tracking-normal">ปิด</span></Btn>
        </div>
      </div>
    </Modal>
  )
}
