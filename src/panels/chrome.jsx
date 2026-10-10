/* ══════════════════════════════════════════════════════════════════════════
   CHROME — top bar · act stepper · guided hint · alert log · status bar · toast
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState } from 'react'
import {
  AlertTriangle, Users, Clock, Timer, ChevronRight, ChevronUp, ChevronDown, Play, RotateCcw, BookOpen, Database, Lightbulb, X, Check, ScrollText,
} from 'lucide-react'
import { Panel } from '../ui/atoms'
import { CLOUD_RULE, SPHERE } from '../config/missionConfig'
import { COMMUNITIES } from '../config/scenarioData'
import { ACT_WINDOW, TOTAL_AT_RISK } from '../lib/sim'
import { fmt, clockHeadline, clockToDate, clamp } from '../lib/format'
import { sphereReady } from '../lib/sphere'

export const ACTS = [
  { n: 1, roman: 'I', th: 'เฝ้าระวัง', code: 'T−48', long: 'มองต้นน้ำที่มองไม่เห็น', en: 'SEEING THE UNSEEN UPSTREAM', hex: '#22E36B' },
  { n: 2, roman: 'II', th: 'วิกฤต', code: 'T+0', long: 'วันที่เมฆบังทั้งลุ่มน้ำ', en: 'THE DAY CLOUDS COVERED THE BASIN', hex: '#FF003C' },
  { n: 3, roman: 'III', th: 'ฟื้นฟู', code: 'T+36', long: 'เมื่อน้ำลดแต่โคลนยังอยู่', en: 'WATER RECEDES, MUD REMAINS', hex: '#38BDF8' },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5 pr-2">
      <svg viewBox="0 0 40 40" className="h-8 w-8 shrink-0">
        <path d="M20 2 L35 8 V21 C35 30 28 36 20 38 C12 36 5 30 5 21 V8 Z" fill="#0B1526" stroke="#38BDF8" strokeWidth="1.4" />
        <circle cx="20" cy="19" r="4.4" fill="none" stroke="#22E36B" strokeWidth="1.3" />
        <line x1="20" y1="10.5" x2="20" y2="27.5" stroke="#22E36B" strokeWidth="1" opacity="0.85" />
        <line x1="11.5" y1="19" x2="28.5" y2="19" stroke="#22E36B" strokeWidth="1" opacity="0.85" />
        <circle cx="20" cy="19" r="1.3" fill="#22E36B" />
      </svg>
      <div className="leading-none">
        <div className="font-mono text-[15px] font-bold tracking-[0.14em] text-white">MAE SAI COMMAND</div>
        <div className="mt-[3px] font-mono text-[7.5px] tracking-[0.2em] text-sky-300/50">THEOS-2 · GISTDA GEOSPATIAL DECISION SIMULATOR</div>
      </div>
    </div>
  )
}

export function TopBar({ eng, onBriefing, onTeacher, hintsOn, setHintsOn }) {
  const { s, situation, veto1, running, setRunning, goAct, reset, exposure } = eng
  const act = ACTS[s.act - 1]
  const sitHex = situation === 'CRITICAL' ? '#FF003C' : situation === 'HIGH' ? '#FF7A1A' : situation === 'REVIEW' ? '#38BDF8' : '#FFB300'
  const sitTh = { CRITICAL: 'วิกฤต', HIGH: 'สูง', REVIEW: 'ทบทวน', ELEVATED: 'เฝ้าระวัง' }[situation]
  return (
    <header className="relative z-30 flex h-[58px] shrink-0 items-center gap-3 border-b border-sky-400/15 bg-[#060B16]/92 px-3 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
      <Logo />

      <div className="hidden items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 lg:flex">
        <div className="leading-none">
          <div className="hud-label">SITUATION</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="num text-[12px] font-bold tracking-wider" style={{ color: sitHex }}>{situation}</span>
            <span className="font-thai text-[10px]" style={{ color: sitHex }}>{sitTh}</span>
            {situation === 'CRITICAL' && <AlertTriangle size={12} className="text-[#FF003C] animate-[flash_1.1s_ease-in-out_infinite]" />}
          </div>
        </div>
      </div>

      {/* Mission clock + real date */}
      <div className="relative mx-auto flex flex-col items-center">
        <div className="clip-notch border px-6 py-1"
          style={{ borderColor: `${act.hex}55`, background: `linear-gradient(180deg, ${act.hex}18, transparent)` }}>
          <div className={`num whitespace-nowrap font-bold leading-none tracking-[0.06em] ${s.act === 3 ? 'text-[15px]' : 'text-[22px]'}`}
            style={{ color: act.hex, textShadow: `0 0 22px ${act.hex}99` }}>
            {s.act === 3 ? 'AFTER ACTION REVIEW' : clockHeadline(s.clock)}
          </div>
        </div>
        <div className="font-thai mt-0.5 text-[10px]" style={{ color: `${act.hex}cc` }}>
          {clockToDate(s.clock)} · {s.act === 1 ? 'ก่อนยอดน้ำ' : s.act === 2 ? 'ยอดน้ำในเมือง' : 'หลังน้ำลด'}
        </div>
      </div>

      <div className="hidden items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 xl:flex">
        <Users size={15} className="text-sky-300/80" />
        <div className="leading-none">
          <div className="font-thai text-[9.5px] text-slate-400">หลังคาเรือนยังเสี่ยง</div>
          <div className="num mt-0.5 text-[13px] font-bold" style={{ color: exposure.exposed ? '#FF6B8A' : '#7CFFA0' }}>
            {fmt(exposure.exposed)}<span className="text-[10px] font-normal text-slate-500"> / {fmt(TOTAL_AT_RISK)}</span>
          </div>
        </div>
      </div>

      {s.act !== 3 && (
        <div className="flex items-center gap-1 rounded-md border border-white/[0.08] bg-white/[0.03] p-[3px]">
          <button onClick={() => setRunning((r) => !r)} title={running ? 'หยุดนาฬิกา (Space)' : 'เดินนาฬิกา (Space)'} data-run={running ? 'on' : 'off'}
            className={`grid h-7 w-7 place-items-center rounded transition ${running ? 'bg-[#FF003C]/20 text-[#FF6B8A]' : 'text-[#7CFFA0] hover:bg-[#22E36B]/15'}`}>
            {running ? <Timer size={13} className="animate-[flash_1s_ease-in-out_infinite]" /> : <Clock size={13} />}
          </button>
          <button onClick={() => eng.advance(60)} title="เดินเวลา +1 ชม." className="grid h-7 w-7 place-items-center rounded text-sky-300/70 hover:bg-white/10 hover:text-sky-100">
            <ChevronRight size={14} />
          </button>
        </div>
      )}
      {s.act !== 3 && (
        <button onClick={() => goAct(s.act + 1)} title={`ไปองก์ ${s.act + 1}`} data-next-act
          className="btn flex items-center gap-1.5 px-2.5 py-1.5"
          style={{ borderColor: `${ACTS[s.act].hex}77`, background: `linear-gradient(180deg, ${ACTS[s.act].hex}26, ${ACTS[s.act].hex}0D)`, color: ACTS[s.act].hex }}>
          <Play size={12} fill="currentColor" />
          <span className="font-thai normal-case tracking-normal text-[11px]">องก์ถัดไป</span>
        </button>
      )}

      <div className="flex items-center gap-0.5">
        <button onClick={() => setHintsOn((h) => !h)} title={hintsOn ? 'ซ่อนคำแนะนำ' : 'แสดงคำแนะนำ'}
          className="grid h-8 w-8 place-items-center rounded text-slate-400 transition hover:bg-white/10 hover:text-white">
          {hintsOn ? <Lightbulb size={15} className="text-[#FFD066]" /> : <Lightbulb size={15} />}
        </button>
        <button onClick={onBriefing} title="ทบทวนภารกิจ (Mission Briefing)" className="grid h-8 w-8 place-items-center rounded text-slate-400 transition hover:bg-white/10 hover:text-white">
          <BookOpen size={15} />
        </button>
        <button onClick={reset} title="เริ่มภารกิจใหม่" className="grid h-8 w-8 place-items-center rounded text-slate-400 transition hover:bg-white/10 hover:text-white">
          <RotateCcw size={15} />
        </button>
        {/* Teacher log export — deliberately discreet (Ctrl+Shift+L) */}
        <button onClick={onTeacher} title="Teacher log (Ctrl+Shift+L)" data-teacher
          className="grid h-8 w-6 place-items-center rounded text-slate-600 opacity-40 transition hover:bg-white/10 hover:text-white hover:opacity-100">
          <Database size={12} />
        </button>
      </div>

      {veto1 && s.act === 1 && (
        <div className="pointer-events-none absolute inset-x-0 -bottom-[1px] h-[2px] bg-[#FF003C] animate-[flash_.85s_ease-in-out_infinite]" style={{ boxShadow: '0 0 14px #FF003C' }} />
      )}
    </header>
  )
}

/* ── Act stepper ────────────────────────────────────────────────────────── */

export function ActStepper({ eng }) {
  const { s, goAct } = eng
  return (
    <nav className="relative z-20 flex h-[40px] shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[#050A14]/80 px-3" aria-label="Act progress">
      {ACTS.map((a, i) => {
        const state = s.act === a.n ? 'current' : s.act > a.n ? 'done' : 'next'
        const [lo, hi] = ACT_WINDOW[a.n]
        const prog = state === 'current' ? clamp((s.clock - lo) / (hi - lo)) : state === 'done' ? 1 : 0
        return (
          <React.Fragment key={a.n}>
            <button onClick={() => goAct(a.n)} data-act={a.n} title={`${a.en} — ${a.long}`}
              className="group relative flex h-[30px] min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md border px-2.5 transition"
              style={{
                borderColor: state === 'next' ? 'rgba(255,255,255,.08)' : `${a.hex}66`,
                background: state === 'current' ? `linear-gradient(90deg, ${a.hex}26, ${a.hex}08)` : 'rgba(255,255,255,.02)',
                boxShadow: state === 'current' ? `0 0 18px -8px ${a.hex}` : undefined,
              }}>
              <span className="absolute inset-y-0 left-0 transition-[width] duration-700" style={{ width: `${prog * 100}%`, background: `${a.hex}14` }} />
              <span className="relative grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border text-[9px] font-bold"
                style={{ borderColor: state === 'next' ? '#334155' : a.hex, background: state === 'done' ? a.hex : 'transparent', color: state === 'done' ? '#04121F' : state === 'current' ? a.hex : '#64748b' }}>
                {state === 'done' ? <Check size={11} strokeWidth={3.5} /> : a.roman}
              </span>
              <span className="relative min-w-0 truncate text-left">
                <span className="font-thai text-[12px] font-semibold" style={{ color: state === 'next' ? '#64809f' : '#fff' }}>องก์ {a.n}: {a.th}</span>
                <span className="num ml-1.5 text-[10px]" style={{ color: state === 'next' ? '#3d5573' : a.hex }}>{a.code}</span>
                <span className="font-thai ml-2 hidden text-[10px] text-slate-500 xl:inline">{a.long}</span>
              </span>
              {state === 'current' && <span className="relative ml-auto h-1.5 w-1.5 shrink-0 rounded-full animate-[flash_1.4s_ease-in-out_infinite]" style={{ background: a.hex }} />}
            </button>
            {i < ACTS.length - 1 && <ChevronRight size={14} className="shrink-0 text-slate-600" />}
          </React.Fragment>
        )
      })}
    </nav>
  )
}

/* ── Guided hint ────────────────────────────────────────────────────────── */

export function computeHint(eng, { tab, view, postDone }) {
  const { s, sfvi, veto1 } = eng
  const orders = Object.keys(s.evacOrders).length
  if (s.act === 1) {
    if (veto1 && orders < COMMUNITIES.length) return { lv: 'crit', text: 'ระดับน้ำถึง 4.20 ม. — Veto 1: สั่งอพยพทันที ไม่ต้องรอภาพ', go: { tab: 'decide' }, cta: 'ไปที่การตัดสินใจ' }
    if (!s.tasked.length && s.swaths > 0 && sfvi.world.cloud <= CLOUD_RULE.cloudPct)
      return { text: 'คำแนะนำ: ลองสแกนป่าต้นน้ำเพื่อหาค่าดินถล่ม (L) — คลิกแถบ SECTOR บนแผนที่ลุ่มน้ำ', go: view === 'catchment' ? { tab: 'data' } : { view: 'catchment', tab: 'data' }, cta: view === 'catchment' ? 'ดูรายการแถบถ่ายภาพ' : 'เปิดแผนที่ลุ่มน้ำ' }
    if (!s.channelMeasured && s.swaths > 0 && sfvi.world.cloud <= CLOUD_RULE.cloudPct)
      return { text: 'คำแนะนำ: Sector D หรือ E พาดผ่านลำน้ำหลัก ใช้วัดความกว้างลำน้ำ (N) ได้', go: { view: 'catchment', tab: 'data' }, cta: 'ดูแถบ D / E' }
    if (sfvi.justified && orders === 0)
      return { text: `SFVI ${sfvi.basin.toFixed(2)} ผ่านเกณฑ์ ${'0.62'} แล้ว — เลือกชุมชนและพิจารณาสั่งอพยพ (ชุมชนทางออกน้อยใช้เวลาอพยพนาน)`, go: { tab: 'decide' }, cta: 'ไปที่การตัดสินใจ' }
    if (sfvi.stale && orders === 0)
      return { lv: 'warn', text: 'เมฆเริ่มบังลุ่มน้ำ (Cloud Rule) — ภาพเชิงแสงเชื่อถือได้น้อยลง ค่า L ถูกลดน้ำหนัก', go: { tab: 'decide' }, cta: 'ทบทวนการตัดสินใจ' }
    if (orders > 0 && orders < COMMUNITIES.length)
      return { text: 'ยังมีชุมชนที่ยังไม่ได้รับคำสั่ง — ตรวจ SFVI รายชุมชนและเวลาน้ำถึง', go: { tab: 'decide' }, cta: 'ดูชุมชนที่เหลือ' }
    if (orders === COMMUNITIES.length)
      return { text: 'สั่งอพยพครบ 4 ชุมชนแล้ว — ส่งบิ๊กแบ็กอุดจุดฟันหลอ หรือกด "องก์ถัดไป"', go: { view: 'corridor', tab: 'resources' }, cta: 'ดูจุดฟันหลอ' }
    if (view !== 'urban')
      return { text: 'ดูมุมมอง "4 ชุมชน" เพื่อเห็นตำแหน่งชุมชน ถนน และจุดอพยพจริง', go: { view: 'urban' }, cta: 'เปิดมุมมอง 4 ชุมชน' }
    return { text: 'การรอข้อมูลที่ครบกว่าก็มีราคา — ลองกด "ยังไม่สั่งการ" เพื่อดูผลเปรียบเทียบสองทาง', go: { tab: 'decide' }, cta: 'ไปที่การตัดสินใจ' }
  }
  if (s.act === 2) {
    if (s.warnedAt === null) return { lv: 'crit', text: 'ยังไม่เคยประกาศอพยพ — ประกาศตอนนี้ (เตือนช้า) ยังดีกว่าไม่ประกาศ', go: { tab: 'resources' }, cta: 'ไปที่ประกาศอพยพ' }
    if (!s.detourSolved) return { text: 'ถนนถูกตัดขาด — ใช้ Sphere Routing หาเส้นทางหนีน้ำให้ชุมชนสายลมจอย', go: { tab: 'route', view: 'urban' }, cta: 'เปิดเครื่องมือเส้นทาง' }
    if (!s.convoy) return { text: 'จัดลำดับ 4 ชุมชนตาม SFVI + tie-break (ทางออกน้อยกว่าได้ก่อน) แล้วปล่อยขบวน', go: { tab: 'triage' }, cta: 'ไปที่จัดลำดับ' }
    return { text: 'ระยะวิกฤตจัดการครบแล้ว — กด "องก์ถัดไป" เพื่อฟื้นฟูและเยียวยา', cta: null }
  }
  const done = Object.keys(s.adjudged).length
  if (done < 10) return { text: `ตัดสินเยียวยารายหลังคา (${done}/10) — เทียบภาพก่อน/หลังของแต่ละหลังก่อนอนุมัติ`, go: { aar: 'decisions' }, cta: 'เปิดบัญชีหลังคาเรือน' }
  if (!postDone) return { text: 'ทำแบบทดสอบหลังเรียน 5 ข้อ เพื่อดูคะแนนพัฒนาการ', go: { post: true }, cta: 'ทำแบบทดสอบหลังเรียน' }
  return { text: 'ภารกิจเสร็จสมบูรณ์ — ดูคะแนนในแท็บ SUMMARY หรือส่งออกรายงาน', cta: null }
}

export function HintBox({ hint, onGo, onHide }) {
  if (!hint) return null
  const hex = hint.lv === 'crit' ? '#FF003C' : hint.lv === 'warn' ? '#FFB300' : '#38BDF8'
  return (
    <div className="pointer-events-auto relative rounded-md border bg-[#070D1C]/92 px-3 py-2 backdrop-blur-md animate-[riseIn_.3s_ease-out]"
      style={{ borderColor: `${hex}66`, boxShadow: `0 0 22px -10px ${hex}` }} data-hint>
      <div className="flex items-start gap-2">
        <span className="relative mt-[3px] flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: hex }} />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: hex }} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-thai text-[11.5px] leading-snug text-slate-100">{hint.text}</div>
          {hint.cta && hint.go && (
            <button onClick={() => onGo(hint.go)} className="font-thai mt-1 text-[10.5px] font-semibold underline-offset-2 hover:underline" style={{ color: hex }}>
              {hint.cta} →
            </button>
          )}
        </div>
        <button onClick={onHide} title="ซ่อนคำแนะนำ" className="shrink-0 text-slate-500 hover:text-white"><X size={11} /></button>
      </div>
    </div>
  )
}

/* ── Alert log (collapsible drawer under the map) ───────────────────────── */

const LV = { crit: '#FF003C', warn: '#FFB300', good: '#22E36B', info: '#38BDF8' }

export function AlertLog({ eng }) {
  const { s } = eng
  const [open, setOpen] = useState(false)
  const latest = s.logs[0]
  return (
    <Panel className="shrink-0" data-panel="log">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left">
        <ScrollText size={12} className="shrink-0 text-sky-300" />
        <span className="panel-title shrink-0">ALERT LOG</span>
        {!open && latest && (
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LV[latest.lv] }} />
            <span className="shrink-0 font-mono text-[9.5px] font-bold" style={{ color: LV[latest.lv] }}>{latest.tag}</span>
            <span className="font-thai truncate text-[10.5px] text-slate-400">{latest.th || latest.msg}</span>
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hud-label">{s.logs.length}</span>
          {open ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronUp size={12} className="text-slate-500" />}
        </span>
      </button>
      {open && (
        <div className="max-h-[180px] overflow-y-auto border-t border-white/[0.06]">
          {s.logs.slice(0, 40).map((l) => (
            <div key={l.id} className="flex items-start gap-2.5 border-b border-white/[0.04] px-3 py-[7px]">
              <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LV[l.lv], boxShadow: `0 0 6px ${LV[l.lv]}` }} />
              <span className="num shrink-0 pt-[1px] text-[9.5px] text-slate-500">
                {String(l.stamp.getHours()).padStart(2, '0')}:{String(l.stamp.getMinutes()).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[9.5px] font-bold tracking-[0.1em]" style={{ color: LV[l.lv] }}>{l.tag}</span>
                <span className="block text-[10.5px] leading-snug text-slate-300">{l.msg}</span>
                {l.th && <span className="font-thai block text-[10px] leading-snug text-slate-500">{l.th}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}

/* ── Status bar + toast ─────────────────────────────────────────────────── */

export function StatusBar({ eng }) {
  const { s } = eng
  const online = sphereReady()
  return (
    <footer className="relative z-20 flex h-7 shrink-0 items-center gap-3 border-t border-sky-400/15 bg-[#060B16]/92 px-4 backdrop-blur-xl">
      <span className="hud-label">DATA:</span>
      <span className="font-mono text-[9.5px] tracking-[0.1em] text-sky-200/80">THEOS-2 · GISTDA</span>
      <span className="text-slate-700">|</span>
      <span className="font-mono text-[9.5px] tracking-[0.1em] text-sky-200/60">
        {s.act === 2 ? 'RADARSAT-2 · เช็คน้ำ · DISASTER PLATFORM' : 'AOI GeoJSON · SRTM DEM · OpenStreetMap · AWAGAD · LANDX'}
      </span>
      <span className="ml-auto flex items-center gap-2">
        <span className="hud-label">SPHERE API:</span>
        <span className="h-2 w-2 rounded-full" style={{ background: online ? '#22E36B' : '#FFB300', boxShadow: `0 0 8px ${online ? '#22E36B' : '#FFB300'}` }} />
        <span className="font-thai text-[10px]" style={{ color: online ? '#7CFFA0' : '#FFD066' }}>
          {online ? 'เชื่อมต่อ' : SPHERE.apiKey ? 'ออฟไลน์' : 'ยังไม่ใส่คีย์ · ใช้ข้อมูลออฟไลน์'}
        </span>
      </span>
    </footer>
  )
}

export function Toast({ flash }) {
  if (!flash) return null
  const hex = flash.kind === 'crit' ? '#FF003C' : flash.kind === 'warn' ? '#FFB300' : '#22E36B'
  return (
    <div className="pointer-events-none fixed left-1/2 top-[108px] z-[70] -translate-x-1/2 animate-[riseIn_.3s_ease-out]">
      <div className="flex items-center gap-2.5 rounded-md border-2 px-5 py-2 backdrop-blur-md"
        style={{ borderColor: hex, background: `${hex}1A`, boxShadow: `0 0 34px -8px ${hex}` }}>
        <AlertTriangle size={15} style={{ color: hex }} />
        <span className="font-thai text-[13px] font-bold" style={{ color: hex }}>{flash.text}</span>
      </div>
    </div>
  )
}
