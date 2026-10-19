/* ══════════════════════════════════════════════════════════════════════════
   CHROME — top bar · act stepper · alert log · status bar · toast
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useEffect } from 'react'
import {
  AlertTriangle, Timer, ChevronRight, ChevronUp, ChevronDown, RotateCcw, BookOpen, Database, Lightbulb, Check, ScrollText, Trophy, Wallet, Fuel, CalendarClock,
} from 'lucide-react'
import { Panel } from '../ui/atoms'
import { SPHERE, MISSION, TIME, STRESS } from '../config/missionConfig'
import { ACT_WINDOW } from '../lib/sim'
import { fmt, clockHeadline, clockToDate, clamp, mmss } from '../lib/format'
import { sphereReady } from '../lib/sphere'

export const ACTS = [
  { n: 1, roman: 'I', th: 'เฝ้าระวัง', code: 'T−48', long: 'มองต้นน้ำที่มองไม่เห็น', en: 'SEEING THE UNSEEN UPSTREAM', hex: '#22E36B' },
  { n: 2, roman: 'II', th: 'วิกฤต', code: 'T+0', long: 'เมฆเคลื่อนผ่าน น้ำเข้าเมือง', en: 'CLOUDS DRIFT, WATER RISES', hex: '#FF003C' },
  { n: 3, roman: 'III', th: 'ฟื้นฟู', code: 'T+36', long: 'เมื่อน้ำลดแต่โคลนยังอยู่', en: 'WATER RECEDES, MUD REMAINS', hex: '#38BDF8' },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5 pr-1">
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

function Meter({ icon: Icon, label, value, sub, hex, title }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1" title={title}>
      <Icon size={14} style={{ color: hex }} />
      <div className="leading-none">
        <div className="font-thai text-[9.5px] text-slate-400">{label}</div>
        <div className="num mt-0.5 text-[12.5px] font-bold" style={{ color: hex }}>{value}{sub && <span className="text-[9.5px] font-normal text-slate-500"> {sub}</span>}</div>
      </div>
    </div>
  )
}

/** Real playing time — skilled commanders finish the three acts in about 7 minutes. */
function PlayTimer({ eng }) {
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id) }, [])
  const sec = eng.realMs() / 1000
  const fast = sec > 0 && sec <= TIME.expertTargetSec
  return (
    <div className="flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1" title={`เวลาเล่นจริง · เป้าหมายผู้เล่นเก่ง ≤ ${TIME.expertTargetSec / 60} นาที`} data-playtime>
      <Timer size={14} className={fast ? 'text-[#7CFFA0]' : 'text-[#FFB300]'} />
      <div className="leading-none">
        <div className="font-thai text-[9.5px] text-slate-400">เวลาเล่นจริง</div>
        <div className="num mt-0.5 text-[12.5px] font-bold" style={{ color: fast ? '#7CFFA0' : '#FFD066' }}>{mmss(sec)}<span className="text-[9.5px] font-normal text-slate-500"> / เป้า {TIME.expertTargetSec / 60}:00</span></div>
      </div>
    </div>
  )
}

export function TopBar({ eng, onGuide, onBoard, onTeacher, tutorOn, setTutorOn, onReset }) {
  const { s, mode, situation, veto1 } = eng
  const act = ACTS[s.act - 1]
  const sitHex = situation === 'CRITICAL' ? '#FF003C' : situation === 'HIGH' ? '#FF7A1A' : situation === 'REVIEW' ? '#38BDF8' : '#FFB300'
  const sitTh = { CRITICAL: 'วิกฤต', HIGH: 'สูง', REVIEW: 'ทบทวน', ELEVATED: 'เฝ้าระวัง' }[situation]
  const left = s.budget.total - s.budget.spent
  const day = s.clock / 1440
  return (
    <header className="relative z-30 flex h-[58px] shrink-0 items-center gap-2.5 border-b border-sky-400/15 bg-[#060B16]/92 px-3 backdrop-blur-xl">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-sky-400/50 to-transparent" />
      <Logo />
      <div className="hidden items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 2xl:flex">
        <div className="leading-none">
          <div className="hud-label">SITUATION</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="num text-[12px] font-bold tracking-wider" style={{ color: sitHex }}>{situation}</span>
            <span className="font-thai text-[10px]" style={{ color: sitHex }}>{sitTh}</span>
            {situation === 'CRITICAL' && <AlertTriangle size={12} className="text-[#FF003C] animate-[flash_1.1s_ease-in-out_infinite]" />}
          </div>
        </div>
      </div>
      <span className="font-thai rounded border px-1.5 py-[3px] text-[10.5px] font-bold" data-mode={s.modeId}
        style={{ color: s.modeId === 'expert' ? '#FF9DB2' : '#7CFFA0', borderColor: s.modeId === 'expert' ? '#FF003C66' : '#22E36B66' }}>
        {mode.th} · {mode.en}
      </span>
      {s.stress?.length > 0 && (
        <span className="font-thai rounded border border-[#FF8A3D]/60 bg-[#FF8A3D]/12 px-1.5 py-[3px] text-[10.5px] font-bold text-[#FFB27A]" data-stress-badge
          title={s.stress.map((k) => `${STRESS[k].th}: ${STRESS[k].desc}`).join('\n')}>
          STRESS TEST · {s.stress.map((k) => STRESS[k].th).join(' · ')}
        </span>
      )}

      <div className="relative mx-auto flex flex-col items-center">
        <div className="clip-notch border px-6 py-1" style={{ borderColor: `${act.hex}55`, background: `linear-gradient(180deg, ${act.hex}18, transparent)` }}>
          <div className={`num whitespace-nowrap font-bold leading-none tracking-[0.06em] ${s.act === 3 ? 'text-[16px]' : 'text-[22px]'}`} style={{ color: act.hex, textShadow: `0 0 22px ${act.hex}99` }}>
            {s.act === 3 ? `RECOVERY · DAY ${Math.floor(day)}` : clockHeadline(Math.round(s.clock))}
          </div>
        </div>
        <div className="font-thai mt-0.5 whitespace-nowrap text-[10px]" style={{ color: `${act.hex}cc` }}>
          {clockToDate(Math.round(s.clock))} · {s.act === 1 ? 'ก่อนยอดน้ำ' : s.act === 2 ? 'ยอดน้ำในเมือง' : `เหลือ ${Math.max(0, Math.ceil(MISSION.deadlineDays - day))} วัน (กรอบ 60 วัน)`}
        </div>
      </div>

      <Meter icon={Wallet} label="งบปฏิบัติการคงเหลือ" value={`฿${fmt(left / 1e6, 2)}M`} sub={`/ ${fmt(s.budget.total / 1e6, 1)}M`}
        hex={left / s.budget.total < 0.15 ? '#FF6B8A' : '#FFD066'} title={`ใช้ไป ฿${fmt(s.budget.spent)}`} />
      {s.act === 2 && <Meter icon={Fuel} label="น้ำมันเรือ" value={`${fmt(s.fuel.total - s.fuel.used)} L`} sub={`/ ${fmt(s.fuel.total)}`} hex={(s.fuel.total - s.fuel.used) / Math.max(1, s.fuel.total) < 0.2 ? '#FF6B8A' : '#7dd3fc'} />}
      {s.act === 3 && <Meter icon={CalendarClock} label="เส้นตายภารกิจ" value={`วันที่ ${Math.floor(day)}`} sub="/ 60" hex={day > 50 ? '#FF6B8A' : '#7dd3fc'} />}

      <PlayTimer eng={eng} />

      <div className="flex items-center gap-0.5">
        {mode.tutor && (
          <button onClick={() => setTutorOn((h) => !h)} title={tutorOn ? 'ซ่อนผู้ช่วยสอน' : 'แสดงผู้ช่วยสอน'} className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-white">
            <Lightbulb size={15} className={tutorOn ? 'text-[#FFD066]' : ''} />
          </button>
        )}
        <button onClick={onGuide} title="คู่มือการเล่น" data-guide className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-white"><BookOpen size={15} /></button>
        <button onClick={onBoard} title="Leaderboard" data-board className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-white"><Trophy size={15} /></button>
        <button onClick={onReset} title="เริ่มภารกิจใหม่" className="grid h-8 w-8 place-items-center rounded text-slate-400 hover:bg-white/10 hover:text-white"><RotateCcw size={15} /></button>
        <button onClick={onTeacher} title="Teacher log (Ctrl+Shift+L)" data-teacher className="grid h-8 w-6 place-items-center rounded text-slate-600 opacity-40 hover:bg-white/10 hover:text-white hover:opacity-100"><Database size={12} /></button>
      </div>
      {veto1 && s.act === 1 && <div className="pointer-events-none absolute inset-x-0 -bottom-[1px] h-[2px] bg-[#FF003C] animate-[flash_.85s_ease-in-out_infinite]" style={{ boxShadow: '0 0 14px #FF003C' }} />}
    </header>
  )
}

/* ── Act stepper (display only — acts end by the clock) ─────────────────── */

export function ActStepper({ eng }) {
  const { s } = eng
  return (
    <nav className="relative z-20 flex h-[34px] shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[#050A14]/80 px-3" aria-label="Act progress">
      {ACTS.map((a, i) => {
        const state = s.act === a.n ? 'current' : s.act > a.n ? 'done' : 'next'
        const [lo, hi] = ACT_WINDOW[a.n]
        const prog = state === 'current' ? clamp((s.clock - lo) / (hi - lo)) : state === 'done' ? 1 : 0
        return (
          <React.Fragment key={a.n}>
            <div data-act={a.n} title={`${a.en} — ${a.long}`}
              className="relative flex h-[24px] min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md border px-2.5"
              style={{ borderColor: state === 'next' ? 'rgba(255,255,255,.08)' : `${a.hex}66`, background: state === 'current' ? `linear-gradient(90deg, ${a.hex}26, ${a.hex}08)` : 'rgba(255,255,255,.02)' }}>
              <span className="absolute inset-y-0 left-0 transition-[width] duration-700" style={{ width: `${prog * 100}%`, background: `${a.hex}1A` }} />
              <span className="relative grid h-[16px] w-[16px] shrink-0 place-items-center rounded-full border text-[8.5px] font-bold"
                style={{ borderColor: state === 'next' ? '#334155' : a.hex, background: state === 'done' ? a.hex : 'transparent', color: state === 'done' ? '#04121F' : state === 'current' ? a.hex : '#64748b' }}>
                {state === 'done' ? <Check size={10} strokeWidth={3.5} /> : a.roman}
              </span>
              <span className="relative min-w-0 truncate">
                <span className="font-thai text-[11.5px] font-semibold" style={{ color: state === 'next' ? '#64809f' : '#fff' }}>องก์ {a.n}: {a.th}</span>
                <span className="num ml-1.5 text-[10px]" style={{ color: state === 'next' ? '#3d5573' : a.hex }}>{a.code}</span>
                <span className="font-thai ml-2 hidden text-[10px] text-slate-500 xl:inline">{a.long}</span>
              </span>
            </div>
            {i < ACTS.length - 1 && <ChevronRight size={13} className="shrink-0 text-slate-600" />}
          </React.Fragment>
        )
      })}
    </nav>
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
            <span className="font-thai truncate text-[10.5px] text-slate-300">{latest.th || latest.msg}</span>
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hud-label">{s.logs.length}</span>
          {open ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronUp size={12} className="text-slate-500" />}
        </span>
      </button>
      {open && (
        <div className="max-h-[200px] overflow-y-auto border-t border-white/[0.06]">
          {s.logs.slice(0, 60).map((l) => (
            <div key={l.id} className="flex items-start gap-2.5 border-b border-white/[0.04] px-3 py-[6px]">
              <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: LV[l.lv], boxShadow: `0 0 6px ${LV[l.lv]}` }} />
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[9.5px] font-bold tracking-[0.1em]" style={{ color: LV[l.lv] }}>{l.tag}</span>
                {l.th && <span className="font-thai block text-[11px] leading-snug text-slate-200">{l.th}</span>}
                <span className="block text-[10px] leading-snug text-slate-500">{l.msg}</span>
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
        {s.act === 2 ? 'THEOS-2 · RADARSAT-2 เช็คน้ำ · SPHERE · BD_footprint' : 'AOI GeoJSON · SRTM DEM · OpenStreetMap · AWAGAD · LANDX · BD_footprint'}
      </span>
      <span className="font-mono text-[9.5px] tracking-[0.08em] text-slate-500">SEED {s.seed}</span>
      <span className="ml-auto flex items-center gap-2">
        <span className="hud-label">SPHERE API:</span>
        <span className="h-2 w-2 rounded-full" style={{ background: online ? '#22E36B' : '#FFB300', boxShadow: `0 0 8px ${online ? '#22E36B' : '#FFB300'}` }} />
        <span className="font-thai text-[10px]" style={{ color: online ? '#7CFFA0' : '#FFD066' }}>{online ? 'เชื่อมต่อ' : SPHERE.apiKey ? 'ออฟไลน์' : 'ยังไม่ใส่คีย์'}</span>
      </span>
    </footer>
  )
}

export function Toast({ flash }) {
  if (!flash) return null
  const hex = flash.kind === 'crit' ? '#FF003C' : flash.kind === 'warn' ? '#FFB300' : '#22E36B'
  return (
    <div className="pointer-events-none fixed left-1/2 top-[178px] z-[70] -translate-x-1/2 animate-[riseIn_.3s_ease-out]">
      <div className="flex items-center gap-2.5 rounded-md border-2 px-5 py-2 backdrop-blur-md" style={{ borderColor: hex, background: `${hex}1A`, boxShadow: `0 0 34px -8px ${hex}` }}>
        {flash.kind === 'ok' ? <Check size={15} style={{ color: hex }} /> : <AlertTriangle size={15} style={{ color: hex }} />}
        <span className="font-thai text-[13px] font-bold" style={{ color: hex }}>{flash.text}</span>
      </div>
    </div>
  )
}
