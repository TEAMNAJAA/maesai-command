/* ══════════════════════════════════════════════════════════════════════════
   INTRO — title screen + "how to play" page
   หน้าเปิดเกมที่เข้าใจได้ใน 10 วินาที (เริ่มเล่น · วิธีเล่น · อันดับ) และหน้าอธิบาย
   ว่าเกมนี้ใช้ทำอะไร เล่นอย่างไร ใช้ข้อมูล GISTDA ตรงไหน ตัดสินใจด้วยกฎอะไร วัดผลอย่างไร
   (ใช้ตอบคำถามกรรมการ/ครูได้จากหน้าเดียว)
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useRef } from 'react'
import {
  Play, BookOpen, Trophy, Satellite, Ship, Building2, Target, Users, Map, Clock, FastForward, Database, GraduationCap, Scale,
  CheckCircle2, X, ArrowRight, Layers, Timer, Zap, Lightbulb, HelpCircle, MousePointerClick, KeyRound,
} from 'lucide-react'
import { SrcLegend } from '../ui/atoms'
import { SFVI, THRESHOLDS, THEOS2, RELIEF, ACT2, MODES, SCORE, TIME, HINTS } from '../config/missionConfig'
import { leaderboard } from '../lib/leaderboard'
import { fmt, mmss } from '../lib/format'

const ACTS = [
  {
    n: 1, hex: '#22E36B', icon: Satellite, th: 'องก์ 1 · เฝ้าระวัง', when: 'ก่อนน้ำมา · T−48 ชม. → T−0', goal: 'เตือนภัยให้ถูกโซน ถูกเวลา ทั้งที่ต้นน้ำอยู่ในเมียนมา',
    steps: ['ตั้งฐานบัญชาการบนที่สูง', 'เลือกเป้าหมายให้ THEOS-2 ถ่าย ตามเมฆพยากรณ์', 'กด "ให้ THEOS-2 ถ่าย" → คัตซีนดาวเทียมสแกน', 'แปลภาพ: คลิกเฉพาะรอยดินถล่มใหม่ (ค่า L)', 'วัดลำน้ำจากภาพ: พิกเซล × 0.5 ม. → ค่า N', 'ส่งทีมบิ๊กแบ็กอุดจุดฟันหลอแนวตลิ่ง', 'สั่งอพยพเฉพาะโซนที่น้ำจะถึง ก่อนเวลาหมด'],
  },
  {
    n: 2, hex: '#FF3B63', icon: Ship, th: 'องก์ 2 · วิกฤต', when: 'ระหว่างน้ำท่วม · T+0 → T+36 ชม.', goal: 'หาและช่วยผู้ติดค้างให้ทันก่อนน้ำท่วมมิดบ้าน',
    steps: [`เมฆลอยผ่านเมือง ${ACT2.cloudMinPct}–${ACT2.cloudMaxPct}% → สั่ง THEOS-2 ถ่ายทุกรอบ`, 'หาผู้ติดค้าง: THEOS-2 · สายด่วน 1784 · โดรน (จุดอับ)', 'จัดการอันตราย: ตัดไฟรั่ว · ตั้งเสาสื่อสาร · เครื่องสูบน้ำ', 'วางแผนเรือ: อพยพ/ส่งเสบียง · ผู้บาดเจ็บ → โรงพยาบาล', 'เลือกเส้นทางที่ปลอดภัยและสั้นที่สุดเอง (ผิด = เสียคะแนน)'],
  },
  {
    n: 3, hex: '#38BDF8', icon: Building2, th: 'องก์ 3 · ฟื้นฟู', when: 'หลังน้ำลด · วันที่ 2 → 60', goal: 'จ่ายเงินเยียวยาให้ถูกบ้าน ไม่จ่ายเกิน ไม่ตัดสิทธิ์ผิด',
    steps: ['เทียบภาพ THEOS-2 ก่อน/หลัง ดูคราบโคลนรอบบ้าน', 'นับวันท่วมขังจากไทม์ซีรีส์เรดาร์ (เช็คน้ำ)', 'หลักฐานไม่ครบ (เมฆบัง/เรดาร์ขาด) → ส่งสำรวจภาคพื้น', `ตัดสิน: ฿${fmt(RELIEF.flatGrant)} · +฿${fmt(RELIEF.mudGrant)} ค่าล้างโคลน · ปฏิเสธ`],
  },
]

const RULES = [
  [`SFVI ≥ ${SFVI.decisionBand} หรือ ระดับน้ำ ≥ ${THRESHOLDS.prepLevel.toFixed(2)} ม.`, 'มีหลักฐานพอ → สั่งอพยพได้ (ไม่นับเป็นเตือนผิด)'],
  [`ระดับน้ำถ้ำผาจม ≥ ${THRESHOLDS.criticalLevel.toFixed(2)} ม. (Veto 1)`, 'อพยพโซนเสี่ยงทันที ไม่ต้องรอภาพ'],
  [`เมฆ > ${THEOS2.cloudUsablePct}% หรือภาพเก่า > 48 ชม. (Cloud Rule)`, 'ภาพใช้ไม่ได้/ลดน้ำหนัก L → พึ่งข้อมูลอื่น'],
  [`ลำน้ำกว้าง < ${THRESHOLDS.origChannelWidth * THRESHOLDS.narrowChannelRatio} ม. (เหลือไม่ถึงครึ่ง)`, `ลดเกณฑ์เตรียมพร้อม ${THRESHOLDS.narrowChannelPrepDrop.toFixed(2)} ม. → เตือนเร็วขึ้น`],
  ['บ้านลึก ≥ 1.5 ม. (อยู่ไม่ได้)', 'ส่งเรืออพยพ · มีผู้บาดเจ็บ → โรงพยาบาลแม่สาย'],
  ['บ้านยังอยู่ได้แต่ลำบาก', 'ส่งถุงยังชีพ (ไม่ส่ง = ทรุดเป็นต้องอพยพ)'],
  [`เส้นทางผ่านริมแม่น้ำ / น้ำลึก ≥ ${ACT2.deepWaterM} ม. / ไฟรั่ว`, 'ห้ามใช้ → ตัดไฟ สูบน้ำ หรือเลือกเส้นทางอื่น'],
  [`ท่วมขัง ≥ ${RELIEF.inundationMinDays} วัน (เรดาร์)`, `เหมาจ่าย ฿${fmt(RELIEF.flatGrant)} / ครัวเรือน`],
  ['+ คราบโคลนชัดในภาพ THEOS-2', `+ ค่าล้างโคลน ฿${fmt(RELIEF.mudGrant)} / หลัง`],
  ['หลักฐานขาด (เมฆบังภาพ / เรดาร์ขาดรอบ)', 'ส่งทีมสำรวจภาคพื้นก่อนตัดสิน (+2 วัน)'],
]

const DATA = [
  ['THEOS-2 (GISTDA)', `ตาหลักของเกม · Pan ${THEOS2.panM} ม. / MS ${THEOS2.msM} ม. · L3 Ortho ผ่าน AWAGAD`, 'องก์ 1 หาดินถล่ม + วัดลำน้ำ · องก์ 2 หาคนบนหลังคา · องก์ 3 ดูคราบโคลน', '#38BDF8'],
  ['Sphere (GISTDA)', 'แผนที่ฐานภาพดาวเทียม + Routing API', 'แผนที่ทุกองก์ · คำนวณเส้นทางอพยพ', '#38BDF8'],
  ['เช็คน้ำ · RADARSAT-2', 'ขอบเขต/ความลึกน้ำท่วม ทะลุเมฆ', 'องก์ 2 ความลึกรายโซน · องก์ 3 นับวันท่วมขัง', '#FF8A3D'],
  ['BD_footprint (GISTDA)', 'อาคารจริง 15,851 หลังในแม่สาย', 'แบ่ง 10 โซน · นับครัวเรือนเสี่ยง · หลังคาที่ต้องเยียวยา', '#38BDF8'],
  ['OSM · SRTM DEM', 'ถนน แม่น้ำ ความสูงพื้นที่', 'เส้นทางเรือ · ที่ตั้งฐาน/จุดอพยพบนที่สูง', '#22E36B'],
]

const H2 = ({ icon: Icon, children, id }) => (
  <h2 id={id} className="font-thai mt-7 flex scroll-mt-4 items-center gap-2 text-[19px] font-bold text-white first:mt-0">
    <Icon size={18} className="text-sky-300" /> {children}
  </h2>
)

/* ── How to play (also the explainer for judges and teachers) ───────────── */

export function HowToPlay({ open, onClose, onStart }) {
  const body = useRef(null)
  if (!open) return null
  const go = (id) => body.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth' })
  const nav = [['what', 'เกมนี้คืออะไร'], ['screen', 'หน้าจอ & เวลา'], ['acts', 'เล่น 3 องก์'], ['rules', 'กฎการตัดสินใจ'], ['data', 'ข้อมูล GISTDA'], ['score', 'คะแนน & วัดผล']]
  return (
    <div className="fixed inset-0 z-[95] flex flex-col bg-[#040812]" data-modal="howto">
      <div className="flex shrink-0 items-center gap-3 border-b border-sky-400/20 px-6 py-3">
        <BookOpen size={20} className="text-sky-300" />
        <div>
          <div className="hud-label">HOW TO PLAY · วิธีเล่น</div>
          <div className="font-thai text-[17px] font-bold text-white">THEOS-2 Mae Sai Command — ใช้ทำอะไร และเล่นอย่างไร</div>
        </div>
        <div className="ml-6 flex gap-1">
          {nav.map(([id, th]) => (
            <button key={id} onClick={() => go(id)} className="font-thai rounded px-2.5 py-1 text-[12px] text-slate-300 hover:bg-white/10 hover:text-white">{th}</button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {onStart && (
            <button onClick={onStart} className="btn flex items-center gap-1.5 border-[#22E36B]/60 bg-[#22E36B]/15 px-4 py-2 text-[#BFF5CF] hover:bg-[#22E36B]/25" data-howto-start>
              <Play size={13} fill="currentColor" /><span className="font-thai normal-case tracking-normal text-[13px] font-bold">เริ่มเล่น</span>
            </button>
          )}
          <button onClick={onClose} title="ปิด" className="grid h-9 w-9 place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-white" data-howto-close><X size={18} /></button>
        </div>
      </div>

      <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-[1180px]">
          {/* 1 · what */}
          <H2 icon={Target} id="what">เกมนี้คืออะไร ใช้ทำอะไร</H2>
          <div className="mt-2 grid grid-cols-[1.25fr_1fr] gap-4">
            <div className="rounded-xl border border-sky-400/25 bg-sky-400/[0.05] p-4">
              <p className="font-thai text-[15px] leading-relaxed text-slate-100">
                <b className="text-white">Serious Game จำลองการตัดสินใจ</b> — ผู้เล่นสวมบท <b className="text-[#FFD066]">ผู้บัญชาการศูนย์ปฏิบัติการฉุกเฉิน (EOC) อำเภอแม่สาย</b> รับมือ
                อุทกภัยแม่สาย ก.ย. 2567 ซึ่ง <b>ต้นน้ำราว 965 ตร.กม. อยู่ในเมียนมา</b> ไทยตั้งสถานีวัดไม่ได้ —
                <b className="text-sky-200"> ภาพดาวเทียม THEOS-2 จึงเป็น "ตา" หลัก</b> ที่ใช้ตัดสินใจ ตั้งแต่เตือนภัย ช่วยผู้ติดค้าง จนถึงเยียวยา
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[[Clock, '3 องก์ ≈ 7 นาที', 'ผู้เล่นเก่ง · ครั้งแรก 12–15 นาที'], [Map, 'ข้อมูลพื้นที่จริง', 'อาคาร GISTDA · Sphere · OSM · DEM'], [Zap, 'เปิดไฟล์เดียวเล่นได้', 'ไม่ต้องติดตั้ง/ล็อกอิน · Offline']].map(([I, a, b]) => (
                  <div key={a} className="rounded-lg border border-white/10 bg-black/25 p-2.5">
                    <I size={15} className="text-sky-300" />
                    <div className="font-thai mt-1 text-[13px] font-bold text-white">{a}</div>
                    <div className="font-thai text-[11px] text-slate-400">{b}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="font-thai flex items-center gap-2 text-[14px] font-bold text-white"><GraduationCap size={15} className="text-[#7CFFA0]" /> ผู้เล่นจะได้เรียนรู้</div>
                <ul className="font-thai mt-1.5 space-y-1 text-[13px] leading-snug text-slate-300">
                  <li>① อ่านภาพ THEOS-2: แปลภาพดินถล่ม · วัดความกว้างลำน้ำจากพิกเซล</li>
                  <li>② ใช้หลักฐานหลายชั้น + Decision Rule ตัดสินใจทั้งที่ข้อมูลไม่ครบ</li>
                  <li>③ บริหารเวลา งบ น้ำมัน ภายใต้เมฆ พายุ และไฟฟ้ารั่ว</li>
                  <li>④ เยียวยาอย่างเป็นธรรมด้วยหลักฐานเชิงพื้นที่</li>
                </ul>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="font-thai flex items-center gap-2 text-[14px] font-bold text-white"><Users size={15} className="text-[#FFD066]" /> เหมาะกับ</div>
                <div className="font-thai mt-1.5 text-[13px] leading-snug text-slate-300">นักเรียน ม.ปลาย / มหาวิทยาลัย · ครูใช้เป็นกิจกรรมในห้องเรียน · บูธ Roadshow / นิทรรศการ · เจ้าหน้าที่ท้องถิ่นซ้อมแผน (Tabletop Exercise)</div>
              </div>
            </div>
          </div>

          {/* 2 · screen & time */}
          <H2 icon={Layers} id="screen">หน้าจอ และ "เวลาเดินเมื่อคุณสั่งการ"</H2>
          <div className="mt-2 grid grid-cols-[1fr_1fr] gap-4">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="grid h-[210px] grid-cols-[1fr_2.2fr_1.2fr] grid-rows-[1fr_34px] gap-1.5 font-thai text-[12px]">
                <div className="row-span-1 rounded border border-[#22E36B]/40 bg-[#22E36B]/10 p-2"><b className="text-[#7CFFA0]">ซ้าย · ข้อมูล</b><div className="mt-1 text-[11px] text-slate-300">SFVI · รอบดาวเทียม · ตารางโซน · ทรัพยากร — ข้อมูลที่ใช้ตัดสินใจ</div></div>
                <div className="rounded border border-sky-400/40 bg-sky-400/10 p-2"><b className="text-sky-200">กลาง · แผนที่</b><div className="mt-1 text-[11px] text-slate-300">ลุ่มน้ำต้นน้ำ · เมือง 10 โซน · แนวตลิ่ง — คลิกบนแผนที่ได้</div></div>
                <div className="rounded border border-[#FFD066]/40 bg-[#FFD066]/10 p-2"><b className="text-[#FFE0A3]">ขวา · สั่งการ</b><div className="mt-1 text-[11px] text-slate-300">กล่องภารกิจ (ทำตามลำดับ) + แท็บคำสั่ง</div></div>
                <div className="col-span-3 flex items-center gap-2 rounded border border-[#22E36B]/50 bg-[#22E36B]/10 px-2"><FastForward size={13} className="text-[#7CFFA0]" /><b className="text-[#BFF5CF]">แถบเวลา</b><span className="text-[11px] text-slate-300">เหตุการณ์ถัดไป · ปุ่ม "เดินเวลา"</span></div>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <ul className="font-thai space-y-2 text-[13.5px] leading-snug text-slate-200">
                <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#7CFFA0]" /><span><b>ไม่มีการนั่งรอ</b> — กดคำสั่งแล้วผลเกิดทันที แต่ทุกคำสั่งกิน "เวลาสั่งการ" ในเกม (เช่น สั่งอพยพ 30 นาที แปลภาพ 20 นาที)</span></li>
                <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#7CFFA0]" /><span>อยากให้เวลาเดิน (รอดาวเทียม รอเรือถึง) กด <b className="text-[#BFF5CF]">"เดินเวลา → เหตุการณ์ถัดไป"</b> หรือ Space — เกมกระโดดไปเหตุการณ์ถัดไปพร้อม <b>คัตซีน</b> 1–3 วินาที</span></li>
                <li className="flex gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[#7CFFA0]" /><span>น้ำขึ้นตามเวลาในเกม — ยิ่งใช้เวลาโดยไม่จำเป็น เวลาอพยพ/ช่วยคนยิ่งน้อยลง</span></li>
                <li className="flex gap-2"><Timer size={16} className="mt-0.5 shrink-0 text-[#FFD066]" /><span>เกมจับ <b>เวลาเล่นจริง</b> ด้วย — คนที่เข้าใจข้อมูลแล้วจะจบได้เร็วขึ้น (เป้าหมาย ⚡ ≤ {TIME.expertTargetSec / 60} นาที) ใช้ดูพัฒนาการหลังเรียน</span></li>
              </ul>
              <SrcLegend className="mt-3" />
            </div>
          </div>

          {/* 3 · acts */}
          <H2 icon={Play} id="acts">เล่น 3 องก์ = 3 ช่วงของการจัดการภัยพิบัติ</H2>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {ACTS.map((a) => (
              <div key={a.n} className="rounded-xl border p-4" style={{ borderColor: `${a.hex}55`, background: `${a.hex}0C` }}>
                <div className="flex items-center gap-2"><a.icon size={18} style={{ color: a.hex }} /><span className="font-thai text-[16px] font-bold text-white">{a.th}</span></div>
                <div className="font-thai mt-0.5 text-[12px]" style={{ color: a.hex }}>{a.when}</div>
                <div className="font-thai mt-2 rounded bg-black/30 px-2.5 py-1.5 text-[12.5px] text-slate-100"><b>เป้าหมาย:</b> {a.goal}</div>
                <ol className="mt-2.5 space-y-1.5">
                  {a.steps.map((st, i) => (
                    <li key={i} className="font-thai flex gap-2 text-[13px] leading-snug text-slate-300">
                      <span className="num grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10.5px] font-bold text-black" style={{ background: a.hex }}>{i + 1}</span>{st}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <div className="font-thai mt-2 text-[12.5px] text-slate-400">ทุกองก์มี <b className="text-[#FFE0A3]">กล่องภารกิจ</b> มุมขวาบนบอกว่าต้องทำอะไรต่อ · โหมดผู้เริ่มต้นมี <b className="text-[#FFE0A3]">แถบผู้ช่วยสอน</b> ด้านล่าง ที่ถามให้คิดก่อน ไม่บอกคำตอบ · จบองก์มีหน้าสรุปผลทุกครั้ง</div>

          {/* 3b · hint ladder */}
          <div className="mt-3 rounded-xl border border-[#FFD066]/30 bg-gradient-to-r from-[#FFD066]/[0.07] to-transparent p-4" data-howto-hints>
            <div className="flex items-center gap-2"><Lightbulb size={17} className="text-[#FFD066]" /><span className="font-thai text-[15px] font-bold text-white">คำใบ้แบบบันได — ผู้ช่วยไม่คิดแทน แค่ช่วยให้คิดเป็น</span></div>
            <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-stretch gap-2">
              {[[HelpCircle, 'ขั้น 1 · ถามชวนคิด', 'ผู้ช่วยสอนถามคำถามที่ต้องคิด เช่น "น้ำจะถึงโซนไหนก่อนที่การอพยพจะเสร็จ?"', '#7DD3FC', 'ฟรี'],
                [MousePointerClick, 'ขั้น 2 · ชี้ที่ข้อมูล', 'กดขอเอง: พาไปที่ข้อมูลที่ต้องอ่าน พร้อมไฟกะพริบรอบจุดนั้น', '#FFD066', `−${HINTS.cost[2]} คะแนน`],
                [KeyRound, 'ขั้น 3 · เฉลยบางส่วน', 'กดขอเอง: ตัวเลข/รายชื่อบางส่วน หรือตัวอย่างวิธีคิด — ยังต้องตัดสินใจเอง', '#FF8FA8', `−${HINTS.cost[3]} คะแนน`]].map(([Icon, th, d, hex, cost], i) => (
                <React.Fragment key={th}>
                  {i > 0 && <ArrowRight size={16} className="self-center text-slate-600" />}
                  <div className="rounded-lg border p-2.5" style={{ borderColor: `${hex}55`, background: `${hex}0d` }}>
                    <div className="flex items-center gap-1.5"><Icon size={14} style={{ color: hex }} /><span className="font-thai text-[13px] font-bold" style={{ color: hex }}>{th}</span>
                      <span className="font-thai ml-auto rounded px-1.5 text-[10.5px]" style={{ background: `${hex}22`, color: hex }}>{cost}</span></div>
                    <div className="font-thai mt-1 text-[12px] leading-snug text-slate-300">{d}</div>
                  </div>
                </React.Fragment>
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1.5">
              <span className="font-thai text-[12.5px] font-semibold text-slate-300">ตัวช่วยค่อย ๆ ถอนออก:</span>
              {[1, 2, 3].map((a) => (
                <span key={a} className="font-thai flex items-center gap-1.5 text-[12.5px] text-slate-300">องก์ {a}
                  <span className="flex gap-[3px]">{[1, 2, 3].map((r) => <span key={r} className="h-[9px] w-[9px] rounded-full" style={{ background: r <= HINTS.maxRung[a] ? ['#7DD3FC', '#FFD066', '#FF8FA8'][r - 1] : 'rgba(255,255,255,.12)' }} />)}</span>
                </span>
              ))}
              <span className="font-thai text-[12px] text-slate-500">หักรวมไม่เกิน {HINTS.maxPenalty} คะแนน · ครูเห็นจำนวนครั้งที่ขอคำใบ้ใน Log — เล่นรอบสองควรขอน้อยลง</span>
            </div>
          </div>

          {/* 4 · rules */}
          <H2 icon={Scale} id="rules">กฎการตัดสินใจ (Decision Rule / Logic Matrix)</H2>
          <div className="mt-2 grid grid-cols-[1.5fr_1fr] gap-4">
            <div className="overflow-hidden rounded-xl border border-white/10">
              <div className="font-thai grid grid-cols-[1fr_1fr] bg-white/[0.06] px-3 py-1.5 text-[12px] font-bold text-slate-300"><span>ถ้าหลักฐานเป็นแบบนี้…</span><span>…ตัดสินใจแบบนี้</span></div>
              {RULES.map(([a, b], i) => (
                <div key={i} className={`font-thai grid grid-cols-[1fr_1fr] gap-3 px-3 py-1.5 text-[12.5px] ${i % 2 ? 'bg-white/[0.02]' : ''}`}>
                  <span className="text-sky-100">{a}</span><span className="text-slate-200">{b}</span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-sky-400/25 bg-sky-400/[0.05] p-4">
              <div className="font-thai text-[14px] font-bold text-white">ดัชนีความเสี่ยงลุ่มน้ำสาย (SFVI)</div>
              <div className="num mt-2 rounded bg-black/40 px-3 py-2 text-[15px] text-sky-200">SFVI = 0.30·W + 0.25·R + 0.20·L + 0.15·N + 0.10·P</div>
              <ul className="font-thai mt-2 space-y-1 text-[12.5px] text-slate-300">
                <li><b className="text-[#7CFFA0]">W</b> ระดับน้ำสถานีถ้ำผาจม ÷ {THRESHOLDS.criticalLevel.toFixed(2)} ม.</li>
                <li><b className="text-[#7CFFA0]">R</b> ฝนสะสมบ้านโจตาดา ÷ {SFVI.rainNormMm} มม.</li>
                <li><b className="text-sky-300">L</b> รอยดินถล่มใหม่ที่ <u>ผู้เล่นแปลจากภาพ THEOS-2</u></li>
                <li><b className="text-sky-300">N</b> 1 − ความกว้างลำน้ำ (<u>ผู้เล่นวัดจากภาพ</u>) ÷ {THRESHOLDS.origChannelWidth} ม.</li>
                <li><b className="text-sky-300">P</b> หลังคาในเขตน้ำถึง ÷ หลังคาในโซน (อาคาร GISTDA)</li>
              </ul>
              <div className="font-thai mt-2 text-[12px] text-slate-400">ค่า ≥ {SFVI.decisionBand} = หลักฐานพอสั่งอพยพ · เตือนผิดทำให้ความเชื่อมั่นลด และคนไม่ยอมอพยพในครั้งต่อไป</div>
            </div>
          </div>

          {/* 5 · data */}
          <H2 icon={Database} id="data">ข้อมูล GISTDA ที่ใช้ — และใช้ตรงไหน</H2>
          <div className="mt-2 grid grid-cols-5 gap-2.5">
            {DATA.map(([name, what, where, hex]) => (
              <div key={name} className="rounded-xl border p-3" style={{ borderColor: `${hex}44`, background: `${hex}0A` }}>
                <div className="font-thai text-[13.5px] font-bold" style={{ color: hex }}>{name}</div>
                <div className="font-thai mt-1 text-[12px] text-slate-200">{what}</div>
                <div className="font-thai mt-1.5 border-t border-white/10 pt-1.5 text-[11.5px] text-slate-400">{where}</div>
              </div>
            ))}
          </div>

          {/* 6 · score */}
          <H2 icon={Trophy} id="score">คะแนน และการวัดผลการเรียนรู้</H2>
          <div className="mt-2 grid grid-cols-[1.2fr_1fr] gap-4 pb-8">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid grid-cols-3 gap-2">
                {[['theos', 'ใช้ THEOS-2', '#38BDF8'], ['evac', 'อพยพรายโซน', '#22E36B'], ['rescue', 'ช่วยผู้ติดค้าง', '#FF3B63'], ['relief', 'เยียวยาถูกต้อง', '#FFD066'], ['logistics', 'โลจิสติกส์', '#A78BFA'], ['trust', 'ความเชื่อมั่น', '#7dd3fc']].map(([k, th, hex]) => (
                  <div key={k} className="rounded-lg border border-white/10 bg-black/25 p-2.5">
                    <div className="num text-[20px] font-bold" style={{ color: hex }}>{Math.round(SCORE[k] * 100)}%</div>
                    <div className="font-thai text-[12px] text-slate-300">{th}</div>
                  </div>
                ))}
              </div>
              <div className="font-thai mt-2.5 text-[12.5px] leading-snug text-slate-400">คะแนนวัด "คุณภาพการตัดสินใจ" ไม่ใช่ความเร็ว · เวลาเล่นจริงใช้จัดอันดับเมื่อคะแนนเท่ากัน และแสดงป้าย ⚡ เมื่อจบภายใน {TIME.expertTargetSec / 60} นาที</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <ul className="font-thai space-y-1.5 text-[13px] leading-snug text-slate-300">
                <li>• แบบทดสอบก่อน/หลังเล่น 5 ข้อ → วัดคะแนนที่เพิ่มขึ้น</li>
                <li>• บันทึกทุกการตัดสินใจ ชั้นข้อมูลที่เปิด เวลาแต่ละองก์ → ครูส่งออก CSV (Ctrl+Shift+L)</li>
                <li>• เล่นซ้ำได้ ทุกเกมสุ่มสถานการณ์ใหม่ (ความกว้างลำน้ำ เมฆ จุดอพยพ ผู้ติดค้าง) — วัดว่าเวลาเล่นลดลง คะแนนสูงขึ้น</li>
                <li>• บันทึกการขอคำใบ้ขั้น 2–3 ทุกครั้ง → วัดว่าผู้เรียนพึ่งตัวช่วยน้อยลงเมื่อเล่นซ้ำ</li>
                <li>• 2 โหมด: <b className="text-[#7CFFA0]">{MODES.beginner.th}</b> (ผู้ช่วยสอน + คำใบ้แบบบันได) · <b className="text-[#FF9DB2]">{MODES.expert.th}</b> (ศัพท์เทคนิค ไม่มีตัวช่วย ทรัพยากรน้อยกว่า)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Title screen ───────────────────────────────────────────────────────── */

export function TitleScreen({ open, player, setPlayer, modeId, setMode, onStart, onHowTo, onBoard }) {
  if (!open) return null
  const top = leaderboard.top(modeId, 3)
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[radial-gradient(120%_90%_at_50%_10%,rgba(14,40,70,.92),rgba(3,6,14,.97))] backdrop-blur-[3px] keep-blur" data-modal="briefing">
      <div className="w-[min(980px,94vw)]">
        <div className="text-center">
          <div className="font-mono text-[12px] tracking-[0.35em] text-sky-300/80">THE GEO QUEST 2026 · THEOS-2 GEOSPATIAL MISSION</div>
          <h1 className="mt-2 font-mono text-[46px] font-bold tracking-[0.12em] text-white" style={{ textShadow: '0 0 36px rgba(56,189,248,.6)' }}>MAE SAI COMMAND</h1>
          <p className="font-thai mx-auto mt-2 max-w-[760px] text-[17px] leading-relaxed text-slate-200">
            คุณคือ <b className="text-[#FFD066]">ผู้บัญชาการศูนย์ EOC อำเภอแม่สาย</b> — ใช้ <b className="text-sky-200">ภาพดาวเทียม THEOS-2</b> และข้อมูล GISTDA
            เตือนภัย ช่วยผู้ติดค้าง และเยียวยาผู้ประสบอุทกภัยแม่สาย ก.ย. 2567
          </p>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {ACTS.map((a) => (
            <div key={a.n} className="rounded-xl border px-4 py-3" style={{ borderColor: `${a.hex}55`, background: `${a.hex}0E` }}>
              <div className="flex items-center gap-2"><a.icon size={17} style={{ color: a.hex }} /><span className="font-thai text-[15px] font-bold text-white">{a.th}</span></div>
              <div className="font-thai mt-1 text-[12.5px] leading-snug text-slate-300">{a.goal}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-[1fr_300px] gap-4">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <label>
                <span className="font-thai text-[12px] text-slate-400">ชื่อผู้เล่น / ทีม</span>
                <input value={player} onChange={(e) => setPlayer(e.target.value)} maxLength={24} placeholder="เช่น ม.6/2-05" data-player
                  className="font-thai mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2.5 text-[15px] text-white outline-none focus:border-sky-400/60" />
              </label>
              <div className="flex gap-1.5">
                {Object.entries(MODES).map(([id, m]) => (
                  <button key={id} onClick={() => setMode(id)} data-mode-pick={id}
                    className={`font-thai rounded-lg border-2 px-3 py-2 text-left ${modeId === id ? (id === 'expert' ? 'border-[#FF6B8A] bg-[#FF003C]/12' : 'border-[#22E36B] bg-[#22E36B]/12') : 'border-white/10 hover:border-white/25'}`}>
                    <div className="text-[13.5px] font-bold text-white">{m.th}</div>
                    <div className="text-[10.5px] text-slate-400">{id === 'beginner' ? 'ผู้ช่วยสอน + คำใบ้แบบบันได' : 'ไม่มีตัวช่วย'}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 flex gap-2.5">
              <button onClick={onStart} data-start className="btn flex flex-1 items-center justify-center gap-2 border-[#22E36B]/70 bg-[#22E36B]/20 py-3.5 text-white hover:bg-[#22E36B]/30 shadow-[0_0_30px_-8px_#22E36B]">
                <Play size={18} fill="currentColor" /><span className="font-thai normal-case tracking-normal text-[18px] font-bold">เริ่มภารกิจ</span>
              </button>
              <button onClick={onHowTo} data-howto className="btn flex items-center gap-2 border-sky-400/60 bg-sky-400/12 px-5 text-sky-100 hover:bg-sky-400/25">
                <BookOpen size={17} /><span className="font-thai normal-case tracking-normal text-[15px] font-bold">วิธีเล่น</span>
              </button>
            </div>
            <div className="font-thai mt-2.5 text-center text-[12px] text-slate-500">ใช้เวลา ~7 นาทีสำหรับผู้เล่นเก่ง · ครั้งแรก 12–15 นาที · ไม่ต้องรอ เวลาเดินเมื่อคุณสั่งการ</div>
          </div>
          <button onClick={onBoard} className="rounded-xl border border-[#FFD066]/30 bg-[#FFD066]/[0.06] p-4 text-left hover:bg-[#FFD066]/[0.1]">
            <div className="font-thai flex items-center gap-2 text-[14px] font-bold text-[#FFE0A3]"><Trophy size={15} /> อันดับสูงสุด · {MODES[modeId].th}</div>
            {top.length === 0
              ? <div className="font-thai mt-2 text-[12.5px] text-slate-500">ยังไม่มีคะแนน — เป็นคนแรก!</div>
              : top.map((r, i) => (
                <div key={r.at} className="font-thai mt-1.5 flex items-center gap-2 text-[13px] text-slate-200">
                  <span className="num w-4 text-slate-500">{i + 1}</span><span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="num text-[#7CFFA0]">{Math.round(r.score)}%</span>{r.sec ? <span className="num text-[11px] text-slate-500">{mmss(r.sec)}</span> : null}
                </div>
              ))}
            <div className="font-thai mt-2 flex items-center gap-1 text-[11.5px] text-slate-400">ดูทั้งหมด <ArrowRight size={11} /></div>
          </button>
        </div>
        <div className="font-mono mt-5 text-center text-[10.5px] tracking-[0.12em] text-slate-500">DATA · THEOS-2 · SPHERE · เช็คน้ำ (RADARSAT-2) · BD_FOOTPRINT · AWAGAD — ทีม REVENGE · โรงเรียนสิงห์บุรี</div>
      </div>
    </div>
  )
}
