/* ══════════════════════════════════════════════════════════════════════════
   ACT 3 · RECOVERY + AFTER ACTION REVIEW
   · relief  — 12 real GISTDA roofs: THEOS-2 before/after slider (real sphere
               imagery + rendered mud/water/debris), radar day series, survey,
               verdicts (฿9,000 / +฿10,000 / reject) — clock counts days, ≤ 60
   · summary — mission score, leaderboard, timeline
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronRight, Clock, ClipboardList, Target, Activity, AlertTriangle, Building2, Wrench, ScrollText, Download, Satellite, CheckCircle2, XCircle, Waves, Search, FileText, Users, GraduationCap, Trophy, HeartPulse, Route, Flag, Eye, Lightbulb, Scale,
} from 'lucide-react'
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts'
import { Panel, PanelHead, Src, Btn, ArcGauge, Spark, StatLine, Corners } from '../ui/atoms'
import { useMode } from '../ui/label'
import { ImpactHover, WhyButton } from '../ui/impact'
import { HintLadder } from '../ui/hints'
import { DecisionHeadline, DecisionList, TIER_HEX } from '../ui/decision'
import { WhatIfPanel } from '../ui/whatif'
import { DeltaChip, fmtVal } from '../modals/teacherCompare'
import { sessionMetrics, previousRound, METRICS } from '../lib/compare'
import { rungOf } from '../engine/hints'
import { previewVerdict, previewSurvey } from '../engine/impact'
import { RELIEF, EVENT, SCORE, MODES, MISSION, TIME, STRESS, DECISION } from '../config/missionConfig'
import { LESSONS, RES_PROOF } from '../config/scenarioData'
import { BUILDINGS } from '../lib/buildings'
import { SECTION_BY_ID } from '../lib/sections'
import { makeProjection, boxKm, tilesFor } from '../lib/geo'
import { sphereReady, sphereTileTemplate } from '../lib/sphere'
import { evaluateRoof, reliefSummary, missionScore } from '../lib/sim'
import { leaderboard } from '../lib/leaderboard'
import { clamp, fmt, baht, clockLabel, clockToDate, mmss } from '../lib/format'
import { logger } from '../lib/evalLogger'

/* ── drag slider ─────────────────────────────────────────────────────────── */

function useDragSlider(initial = 50) {
  const [pos, setPos] = useState(initial)
  const box = useRef(null)
  const drag = useRef(false)
  const move = useCallback((clientX) => { const r = box.current?.getBoundingClientRect(); if (r) setPos(clamp(((clientX - r.left) / r.width) * 100, 2, 98)) }, [])
  useEffect(() => {
    const mm = (e) => drag.current && move(e.clientX)
    const mu = () => { drag.current = false }
    window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu)
    return () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu) }
  }, [move])
  return { pos, setPos, box, start: (e) => { drag.current = true; move(e.clientX) }, grab: (e) => { e.stopPropagation(); drag.current = true } }
}

function Handle({ pos, grab }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 w-[2px] bg-white/85" style={{ left: `${pos}%`, boxShadow: '0 0 14px rgba(255,255,255,.7)' }} />
      <div className="absolute top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border-2 border-white/85 bg-[#0B132B]/90"
        style={{ left: `${pos}%` }} onPointerDown={grab} data-slider-handle>
        <div className="flex items-center gap-[3px] text-white"><ChevronRight size={12} className="rotate-180" /><ChevronRight size={12} /></div>
      </div>
    </>
  )
}

/* ── Roof scene: real imagery + physically-plausible flood marks ──────────── */

function useRoofView(roof) {
  return useMemo(() => {
    // ~360 m across: wide enough that the sphere tile shows street texture instead of blown-up pixels
    const side = Math.min(0.45, Math.max(0.32, (Math.sqrt(roof.areaM2 || 120) * 18) / 1000))
    const bbox = boxKm(roof.c[0], roof.c[1], side, side * 0.56)
    const proj = makeProjection(bbox, 640, 360, 0)
    const ring = (r) => r.map((p, i) => `${i ? 'L' : 'M'}${proj.pt(p).map((v) => v.toFixed(1)).join(' ')}`).join('') + 'Z'
    const [W, S, E, N] = bbox
    const near = BUILDINGS.filter((b) => b.fid !== roof.fid && b.c[0] > W - 0.0004 && b.c[0] < E + 0.0004 && b.c[1] > S - 0.0004 && b.c[1] < N + 0.0004)
    return {
      proj, tiles: sphereReady() ? tilesFor(proj, sphereTileTemplate(), 24, 0, 18) : [],
      target: ring(roof.ring), neighbours: near.map((b) => ring(b.ring)).join(''), centre: proj.pt(roof.c),
      upm: 640 / (side * 1000), seed: (roof.fid % 97) + 3,
    }
  }, [roof])
}

/**
 * One side of the before/after slider.
 * After = THEOS-2 17 Sep (scenario): silt over streets and yards, roofs left clean (GISTDA footprints
 * mask the wash), a deposit hugging the compound sized by the roof's mud level, standing water if it
 * stayed wet, optional cloud.
 */
const RoofScene = React.memo(function RoofScene({ roof, after, view, pan }) {
  const id = `r${roof.fid}${after ? 'a' : 'b'}`
  const mud = after ? roof.mudLevel : 0
  const wet = after ? Math.min(1, roof.days / 12) : 0
  const wash = 0.1 + 0.16 * wet                                 // neighbourhood silt, same for every house in the area
  const halo = (5 + mud * 12) * view.upm                        // deposit around the compound (m → svg units)
  const tone = pan ? 'grayscale(1) contrast(1.15) brightness(1.05)' : undefined
  const roofsD = view.neighbours + view.target
  return (
    <svg viewBox="0 0 640 360" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" style={{ filter: tone }}>
      <defs>
        <filter id={`${id}-age`} x="0" y="0" width="100%" height="100%">
          {/* soaked ground reads flatter and warmer than the dry-season basemap */}
          <feColorMatrix type="matrix" values={`${0.78 - 0.08 * wet} 0.16 0.04 0 0.01  0.1 ${0.76 - 0.08 * wet} 0.06 0 0  0.06 0.12 ${0.62 - 0.06 * wet} 0 -0.01  0 0 0 1 0`} />
        </filter>
        <filter id={`${id}-blob`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed={view.seed} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={22 + mud * 18} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="2.2" />
        </filter>
        <filter id={`${id}-silt`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.38" numOctaves="3" seed={view.seed + 7} result="g" />
          <feColorMatrix in="g" type="matrix" values="0.42 0 0 0 0.36  0.34 0 0 0 0.27  0.22 0 0 0 0.16  0 0 0 0 1" />
        </filter>
        <filter id={`${id}-pool`} x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="3" seed={view.seed + 11} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="60" xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="3" />
        </filter>
        <filter id={`${id}-soft`}><feGaussianBlur stdDeviation="1.6" /></filter>
        <mask id={`${id}-ground`} maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="360">
          <rect width="640" height="360" fill="#fff" opacity={wash} />
          {mud > 0.05 && <path d={view.target} fill="#fff" stroke="#fff" strokeWidth={halo * 2} strokeLinejoin="round" opacity={0.35 + mud * 0.65} filter={`url(#${id}-blob)`} />}
          <path d={roofsD} fill="#000" filter={`url(#${id}-soft)`} />
        </mask>
        <mask id={`${id}-water`} maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="360">
          {Array.from({ length: 5 }, (_, i) => (
            <ellipse key={i} cx={(view.seed * 37 + i * 131) % 640} cy={(view.seed * 53 + i * 79) % 360} rx={28 + ((i * 29) % 36)} ry={14 + ((i * 17) % 16)} fill="#fff" filter={`url(#${id}-pool)`} />
          ))}
          <path d={roofsD} fill="#000" filter={`url(#${id}-soft)`} />
        </mask>
        <filter id={`${id}-cloud`} x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="4" seed={view.seed + 3} /><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1.4 1.25" /></filter>
      </defs>
      <rect width="640" height="360" fill={after ? '#5a4b36' : '#2f4a2c'} />
      {view.tiles.length > 0 && (
        <g filter={after ? `url(#${id}-age)` : undefined}>
          {view.tiles.map((t) => <image key={t.key} href={t.href} x={t.x} y={t.y} width={t.w + 0.6} height={t.h + 0.6} preserveAspectRatio="none" />)}
        </g>
      )}
      {!view.tiles.length && <path d={view.neighbours} fill={after ? '#8a7a62' : '#9a5a45'} opacity="0.85" />}
      {after && (
        <g mask={`url(#${id}-ground)`}>
          <rect width="640" height="360" fill="#9c7f58" opacity="0.62" />
          <rect width="640" height="360" filter={`url(#${id}-silt)`} opacity="0.45" />
        </g>
      )}
      {after && wet > 0.75 && (
        <g mask={`url(#${id}-water)`} opacity={0.25 + wet * 0.3}>
          <rect width="640" height="360" fill="#3d4b45" />
          <rect width="640" height="360" fill="#9fb3b0" opacity="0.12" filter={`url(#${id}-silt)`} />
        </g>
      )}
      <path d={view.target} fill="none" stroke="#FFD066" strokeWidth="2" strokeDasharray="5 3" />
      {after && roof.theosCloud && <rect width="640" height="360" filter={`url(#${id}-cloud)`} opacity="0.92" />}
    </svg>
  )
})

function RoofCompare({ roof, eng, pan, setPan }) {
  const { pos, box, start, grab } = useDragSlider(55)
  const view = useRoofView(roof)
  const online = view.tiles.length > 0
  return (
    <div ref={box} className="relative h-[300px] w-full select-none overflow-hidden rounded-lg border border-white/15" onPointerDown={start} data-roof-compare={roof.id}>
      <RoofScene roof={roof} after view={view} pan={pan} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        <div className="absolute inset-0 [will-change:transform]" style={{ width: `${(100 / pos) * 100}%` }}><RoofScene roof={roof} view={view} pan={pan} /></div>
      </div>
      <span className="font-thai pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10.5px] text-white">◀ ก่อน · {online ? 'ภาพดาวเทียม GISTDA sphere' : 'ภาพจำลอง'}</span>
      <span className="font-thai pointer-events-none absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10.5px] text-white">หลัง · THEOS-2 {EVENT.afterImageLabel.split('·')[1]?.trim()} (จำลอง) ▶</span>
      <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setPan((p) => !p)} data-pan-toggle
        className={`btn absolute bottom-2 right-2 px-2 py-1 ${pan ? 'border-white/60 bg-white/20 text-white' : 'border-sky-400/40 bg-black/60 text-sky-200'}`}>
        <span className="font-mono text-[9.5px]">{pan ? 'PAN 0.5 m' : 'MS COLOUR'}</span>
      </button>
      <div className="pointer-events-none absolute bottom-2 left-2 flex gap-1">{online && <Src t="image" mini />}<Src t="scenario" mini /></div>
      <Handle pos={pos} grab={grab} />
    </div>
  )
}

/* ── Radar day series ────────────────────────────────────────────────────── */

function RadarSeries({ roof, hint }) {
  const counted = roof.series.filter((v) => v === 1).length
  const gaps = roof.series.filter((v) => v === null).length
  return (
    <div className="rounded border border-[#FF8A3D]/30 bg-[#FF8A3D]/[0.05] px-2.5 py-2" data-radar-series>
      <div className="flex items-center justify-between">
        <span className="font-thai text-[11px] font-semibold text-[#FFC59A]">ไทม์ซีรีส์เรดาร์ (เช็คน้ำ) · 14 วันหลังยอดน้ำ</span>
        <Src t="radar" mini />
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {roof.series.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
            <div className="h-7 w-full rounded-sm" title={v === null ? 'ไม่มีรอบเรดาร์' : v ? 'น้ำท่วมขัง' : 'แห้ง'}
              style={{ background: v === null ? 'repeating-linear-gradient(45deg,#334155,#334155 3px,#1e293b 3px,#1e293b 6px)' : v ? '#2563eb' : '#475569' }} />
            <span className="num text-[8.5px] text-slate-500">{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="font-thai mt-1 text-[10.5px] text-slate-400">
        ฟ้า = ท่วมขัง · เทา = แห้ง · ลาย = ไม่มีรอบเรดาร์{hint ? ` · นับได้ ${counted} วัน${gaps ? ` (ขาดข้อมูล ${gaps} วัน)` : ''}` : ''} · เกณฑ์ ≥ {RELIEF.inundationMinDays} วัน
      </div>
    </div>
  )
}

/* ── Relief workspace ────────────────────────────────────────────────────── */

function ReliefTab({ eng }) {
  const mode = useMode()
  const { s, scn } = eng
  const roofs = scn.roofs
  const [focus, setFocus] = useState(roofs[0].id)
  const [pan, setPan] = useState(false)
  const roof = roofs.find((r) => r.id === focus)
  const rel = reliefSummary(s, scn)
  const surveyed = s.surveyed.includes(roof.id)
  const pick = (id) => { setFocus(id); eng.reviewRoof(id) }
  useEffect(() => { eng.reviewRoof(roofs[0].id) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const verdicts = [['flat', `อนุมัติ ฿${fmt(RELIEF.flatGrant)}`, '#22E36B'], ['both', `฿${fmt(RELIEF.flatGrant)} + ค่าล้างโคลน ฿${fmt(RELIEF.mudGrant)}`, '#FFB300'], ['reject', 'ปฏิเสธ', '#FF003C']]
  const outTh = { correct: 'ถูกต้อง', overpay: 'จ่ายเกิน', denial: 'ตัดสิทธิ์ผิด', under: 'จ่ายขาด', pending: '—' }
  return (
    <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: '230px minmax(0,1fr)' }}>
      <div className="flex min-h-0 flex-col gap-1 overflow-y-auto pr-1" data-roof-list>
        <div className="font-thai flex items-start gap-1.5 px-1 text-[11px] text-slate-400"><span className="min-w-0 flex-1">หลังคาที่ต้องพิจารณา ({rel.done}/{rel.total}) · คลิกเพื่อซูมไปที่หลังนั้น</span><WhyButton id="relief" /></div>
        {roofs.map((r) => {
          const v = s.adjudged[r.id]
          return (
            <button key={r.id} onClick={() => pick(r.id)} data-roof={r.id}
              className={`rounded border px-2 py-1.5 text-left transition ${focus === r.id ? 'border-sky-400 bg-sky-400/[0.12]' : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]'}`}>
              <div className="flex items-center justify-between"><span className="num text-[11px] font-bold text-white">{r.id}</span>{v ? <CheckCircle2 size={12} className="text-[#22E36B]" /> : s.reviewed.includes(r.id) ? <Eye size={12} className="text-slate-500" /> : null}</div>
              <div className="font-thai text-[10px] text-slate-500">โซน {r.section} · {SECTION_BY_ID[r.section]?.name}</div>
              {v && <div className="font-thai text-[10px] text-sky-200">{verdicts.find((x) => x[0] === v)?.[1]}</div>}
            </button>
          )
        })}
      </div>
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        <div className="flex items-center gap-2">
          <span className="num text-[16px] font-bold text-white">{roof.id}</span>
          <span className="font-thai text-[11.5px] text-slate-400">โซน {roof.section} · {roof.areaM2 ? `${Math.round(roof.areaM2)} ตร.ม.` : ''} · พื้น {roof.elev ?? '—'} ม.รทก.</span>
          <Src t="image" mini />
          <span className="font-thai ml-auto text-[11px] text-slate-400">ลากสไลเดอร์เทียบก่อน/หลัง · ปุ่มมุมขวาล่างสลับภาพสี/Pan 0.5 ม.</span>
        </div>
        <RoofCompare key={roof.id} roof={roof} eng={eng} pan={pan} setPan={setPan} />
        <div className="grid grid-cols-2 gap-2">
          <RadarSeries roof={roof} hint={mode.tutor && rungOf(s, 'a3.relief') >= 3} />
          <div className="rounded border border-white/[0.08] bg-white/[0.025] px-2.5 py-2">
            <div className="font-thai flex items-center gap-1.5 text-[11px] font-semibold text-slate-200"><span className="flex-1">หลักฐานโคลนจาก THEOS-2</span><WhyButton id="survey" /></div>
            <div className="font-thai mt-1 text-[10.5px] leading-snug text-slate-400">
              {roof.theosCloud ? 'ภาพหลังมีเมฆบังบริเวณบ้าน — ดูคราบโคลนไม่ได้' : mode.tutor && rungOf(s, 'a3.relief') >= 2 ? 'ดูปื้นสีน้ำตาลรอบบ้านในภาพหลัง: เป็นปื้นใหญ่สีน้ำตาลทึบ = โคลนชัด' : 'ตีความคราบโคลนจากภาพเอง'}
            </div>
            {surveyed ? (
              <div className="font-thai mt-1.5 rounded bg-sky-400/10 px-2 py-1 text-[11px] text-sky-100" data-survey-result>ผลภาคสนาม: ท่วมขัง {roof.days} วัน · โคลน{roof.mud ? 'หนา ต้องล้าง' : 'ไม่พบ'}</div>
            ) : (
              <ImpactHover block className="mt-1.5" card={previewSurvey(s)}>
                <Btn size="sm" variant="ghost" className="w-full" icon={Search} onClick={() => eng.survey(roof.id)}>
                  <span className="font-thai normal-case tracking-normal">ส่งสำรวจภาคพื้น · ฿{fmt(RELIEF.surveyCost)} · +2 วัน</span>
                </Btn>
              </ImpactHover>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" data-roof-actions={roof.id}>
          {verdicts.map(([k, label, hex]) => {
            const on = s.adjudged[roof.id] === k
            return (
              <ImpactHover key={k} card={previewVerdict(k)}>
                <button onClick={() => eng.adjudicate(roof.id, k)} data-verdict={`${roof.id}-${k}`}
                  className="btn px-3 py-2 font-thai text-[12px] normal-case tracking-normal"
                  style={on ? { borderColor: `${hex}`, background: `${hex}33`, color: '#fff' } : { borderColor: `${hex}66`, color: hex }}>{label}</button>
              </ImpactHover>
            )
          })}
          {s.adjudged[roof.id] && s.act3Done && <span className="font-thai ml-2 text-[11.5px] font-bold" style={{ color: evaluateRoof(roof, s.adjudged[roof.id]) === 'correct' ? '#7CFFA0' : '#FF9DB2' }}>{outTh[evaluateRoof(roof, s.adjudged[roof.id])]}</span>}
        </div>
        {mode.tutor && <HintLadder eng={eng} topic="a3.relief" ctx={{ roof }} compact />}
        <div className="font-thai text-[10.5px] leading-snug text-slate-500">เกณฑ์: ท่วมขัง ≥ {RELIEF.inundationMinDays} วัน → เหมาจ่าย ฿{fmt(RELIEF.flatGrant)} · มีโคลนชัด (และเข้าเกณฑ์ท่วมขัง) → +ค่าล้างโคลน ฿{fmt(RELIEF.mudGrant)} · หลักฐานไม่พอ → ส่งสำรวจ (แม่นแต่ช้า) / เสี่ยงตัดสิน</div>
      </div>
    </div>
  )
}

/* ── Score column + summary ──────────────────────────────────────────────── */

const PARTS = [['theos', 'ใช้ THEOS-2'], ['evac', 'อพยพรายโซน'], ['rescue', 'ช่วยผู้ติดค้าง'], ['logistics', 'โลจิสติกส์'], ['relief', 'เยียวยาถูกต้อง'], ['trust', 'ความเชื่อมั่น']]

function ScoreColumn({ eng, score }) {
  const { s } = eng
  const d = score.decision
  const hex = TIER_HEX[d.tier.id]
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
      <Panel className="shrink-0" data-panel="mission-score" data-total-points={score.points} data-score-version={score.version}>
        <PanelHead title="MISSION SCORE · คะแนนภารกิจ" icon={Target} right={<Src t="scenario" mini />} />
        <div className="px-3 pt-2.5"><DecisionHeadline decision={d} compact /></div>
        <div className="px-3 pb-1 pt-2"><ArcGauge value={score.points / 10} display={score.points} unit="" ticks={['0', String(DECISION.maxPoints)]} color={hex} label={`/ ${DECISION.maxPoints} แต้ม`} size={150} /></div>
        <div className="space-y-1 px-3 pb-3">
          {PARTS.map(([k, label]) => {
            const v = score.partPoints[k], m = score.max[k], r = m ? v / m : 0
            return (
              <div key={k} data-part={k}>
                <div className="flex items-baseline justify-between"><span className="font-thai text-[11px] text-slate-300">{label}</span><span className="num text-[11px] font-semibold text-white">{v} <span className="text-slate-500">/ {m}</span></span></div>
                <div className="mt-0.5 h-[4px] overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${r * 100}%`, background: r >= 0.75 ? '#22E36B' : r >= 0.5 ? '#FFB300' : '#FF3B63' }} /></div>
              </div>
            )
          })}
          <div className="num mt-1.5 rounded bg-black/30 px-2 py-1 text-center text-[10.5px] text-slate-300" data-score-formula>
            ผลงาน {score.perf} × {d.mult} {score.hintPts ? `− คำใบ้ ${score.hintPts} ` : ''}= <b className="text-white">{score.points}</b>
          </div>
          {MODES[s.modeId].tutor && (
            <div className="mt-1.5 flex items-center justify-between rounded border px-2 py-1" data-hint-penalty={score.hints.pts}
              style={{ borderColor: score.hints.pts ? '#FF6B8A44' : '#22E36B44', background: score.hints.pts ? '#FF003C0d' : '#22E36B0d' }}>
              <span className="font-thai flex items-center gap-1.5 text-[11px] text-slate-300"><Lightbulb size={11} className="text-[#FFD066]" />คำใบ้แบบบันได
                <span className="text-[9.5px] text-slate-500">ชี้ข้อมูล {score.hints.pointer} · เฉลย {score.hints.partial}</span></span>
              <span className="num text-[11.5px] font-bold" style={{ color: score.hints.pts ? '#FF9DB2' : '#7CFFA0' }}>{score.hints.pts ? `−${score.hintPts}` : 'คิดเองทั้งหมด ✓'}</span>
            </div>
          )}
        </div>
      </Panel>
      <Panel className="shrink-0">
        <PanelHead title="OPERATION SUMMARY" icon={ClipboardList} />
        <div className="px-3 py-1">
          <StatLine icon={Satellite} label="ภาพ THEOS-2 ที่ใช้ได้" value={s.images.filter((i) => i.usable).length} src="image" />
          <StatLine icon={Search} label="ดินถล่มที่ระบุ (ถูก/ผิด)" value={`${score.scars.tp}/${score.scars.fp}`} src="image" />
          <StatLine icon={Users} label="ช่วยผู้ติดค้าง" value={`${score.people.saved}/${score.people.need}`} src="scenario" accent="#22E36B" />
          <StatLine icon={HeartPulse} label="ผู้บาดเจ็บถึงโรงพยาบาล" value={`${score.people.injuredOk}/${score.people.injured}`} src="scenario" />
          <StatLine icon={Route} label="เส้นทางผิด" value={s.routeErrors} src="scenario" accent={s.routeErrors ? '#FF6B8A' : '#22E36B'} />
          <StatLine icon={Clock} label="วันที่ของภารกิจ" value={`${Math.floor(s.clock / 1440)} / ${MISSION.deadlineDays}`} src="scenario" />
        </div>
      </Panel>
      <Panel className="shrink-0">
        <PanelHead title="FINAL TRUST INDEX" icon={Activity} />
        <div className="px-3 pb-2 pt-3"><ArcGauge value={s.trust} color={s.trust >= 75 ? '#22E36B' : s.trust >= 50 ? '#FFB300' : '#FF003C'} label="TRUST" size={130} /><Spark data={s.trustHist} color="#38BDF8" h={44} dots fill={false} /></div>
      </Panel>
    </div>
  )
}

/** The same player's previous round on this machine (new scenario) — did the decisions get better? */
function PrevRound({ eng, player }) {
  const prev = useMemo(() => previousRound(logger.sessions(), player, logger.current?.id), [player, eng.s.act3Done]) // eslint-disable-line react-hooks/exhaustive-deps
  const now = useMemo(() => sessionMetrics(eng.s, eng.scn, eng.realMs() / 1000), [eng.s, eng.scn]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!player) return null
  if (!prev) {
    return (
      <div className="font-thai flex items-center gap-2 rounded-xl border border-dashed border-white/12 px-4 py-2.5 text-[12px] text-slate-400" data-prev-round="none">
        <Activity size={14} className="text-[#C4B5FD]" />เล่นอีกรอบด้วยชื่อ "{player}" — ระบบสุ่มสถานการณ์ใหม่ แล้วจะเทียบพัฒนาการของคุณให้ที่นี่
      </div>
    )
  }
  const m = prev.result.metrics
  const keys = ['score', 'falseAlarms', 'savedPct', 'missed', 'hints', 'realSec']
  return (
    <Panel data-prev-round="1">
      <PanelHead title="YOUR PROGRESS · เทียบกับรอบก่อนของคุณ" icon={Activity} accent="#C4B5FD"
        right={<span className="font-thai text-[10.5px] text-slate-500">รอบก่อน seed {m.seed ?? '—'} · รอบนี้ seed {eng.s.seed}{m.seed === eng.s.seed ? ' (สถานการณ์เดิม)' : ' (สถานการณ์ใหม่)'}</span>} />
      <div className="grid grid-cols-6 gap-2 px-3 py-2.5">
        {keys.map((k) => {
          const meta = METRICS.find((x) => x.k === k)
          const d = m[k] === null || m[k] === undefined || now[k] === null ? null : now[k] - m[k]
          return (
            <div key={k} className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2">
              <div className="font-thai truncate text-[10.5px] text-slate-400" title={meta.th}>{meta.th}</div>
              <div className="num mt-0.5 text-[13px] text-slate-300">{fmtVal(k, m[k])} → <b className="text-white">{fmtVal(k, now[k])}</b></div>
              <div className="mt-0.5"><DeltaChip k={k} d={d} better={meta.better} /></div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

/** "ถ้าคุณเลือกอีกทาง" for the whole mission — one tab per act (act 3 once every roof is decided). */
function WhatIfTabs({ eng, relDone }) {
  const [act, setAct] = useState(relDone ? 3 : 1)
  return (
    <div data-whatif-tabs>
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="font-thai mr-1 text-[12px] font-semibold text-slate-300">บทเรียนจากการตัดสินใจของคุณ</span>
        {[[1, 'องก์ 1 · เฝ้าระวัง'], [2, 'องก์ 2 · วิกฤต'], [3, 'องก์ 3 · ฟื้นฟู']].map(([a, th]) => (
          <button key={a} onClick={() => setAct(a)} data-whatif-act={a}
            className={`font-thai rounded-md border px-2.5 py-1 text-[11.5px] font-semibold transition ${act === a ? 'border-[#A78BFA] bg-[#A78BFA]/20 text-white' : 'border-white/10 text-slate-400 hover:text-white'}`}>{th}</button>
        ))}
      </div>
      {act === 3 && !relDone
        ? <div className="font-thai rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-[12.5px] text-slate-400">ตัดสินเยียวยาให้ครบทุกหลังก่อน แล้วจะเห็นว่าแต่ละหลังควรตัดสินอย่างไร</div>
        : <WhatIfPanel key={act} eng={eng} act={act} limit={4} />}
    </div>
  )
}

function SummaryTab({ eng, score, onPostTest, postDone, player, onSaved, saved }) {
  const { s } = eng
  const rel = score.relief
  const allDone = rel.done >= rel.total
  const top = leaderboard.top(s.modeId, 5)
  return (
    <div className="space-y-3">
      <Panel className="p-4" glow="#FFD066">
        <div className="flex items-center gap-3">
          <Trophy size={22} className="text-[#FFD066]" />
          <div>
            <div className="font-thai text-[16px] font-bold text-white">{allDone ? `ภารกิจจบ — ${score.points} / ${DECISION.maxPoints} แต้ม · การตัดสินใจ${score.decision.tier.th}${score.decision.failed ? ' · ภารกิจล้มเหลว' : ''}` : `ยังตัดสินเยียวยาไม่ครบ (${rel.done}/${rel.total})`}</div>
            <div className="font-thai text-[12px] text-slate-400">{MODES[s.modeId].th} · seed {s.seed} · ผู้เล่น {player || 'ไม่ระบุชื่อ'}{s.stress?.length > 0 && <span className="ml-1 rounded bg-[#FF8A3D]/20 px-1.5 py-[1px] text-[11px] font-bold text-[#FFB27A]">Stress Test: {s.stress.map((k) => STRESS[k].th).join(' · ')}</span>} · เวลาเล่นจริง <b className="num text-white">{mmss(eng.realMs() / 1000)}</b>
              {eng.realMs() > 0 && eng.realMs() / 1000 <= TIME.expertTargetSec && <span className="ml-1.5 rounded bg-[#FFD066]/20 px-1.5 py-[1px] text-[11px] font-bold text-[#FFE0A3]">⚡ ภายใน {TIME.expertTargetSec / 60} นาที</span>}</div>
          </div>
          <div className="ml-auto flex gap-2">
            <Btn variant={postDone ? 'solid' : 'go'} icon={GraduationCap} onClick={onPostTest} disabled={postDone}><span className="font-thai normal-case tracking-normal">{postDone ? 'ทำแบบทดสอบแล้ว' : 'แบบทดสอบหลังเรียน'}</span></Btn>
            <Btn variant="primary" icon={Trophy} disabled={!allDone || !!saved} onClick={onSaved} data-save-score><span className="font-thai normal-case tracking-normal">{saved ? `บันทึกแล้ว · อันดับ ${saved.rank}` : 'บันทึกลง Leaderboard'}</span></Btn>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {top.length === 0 && <div className="font-thai col-span-5 text-[12px] text-slate-500">ยังไม่มีคะแนนในโหมดนี้</div>}
          {top.map((r, i) => (
            <div key={r.at} className="rounded border border-white/10 bg-white/[0.03] px-2 py-1.5" style={saved && saved.at === r.at ? { borderColor: '#FFD066' } : undefined}>
              <div className="num text-[11px] font-bold" style={{ color: i === 0 ? '#FFD066' : '#cbd5e1' }}>#{i + 1} · {r.score} แต้ม</div>
              <div className="font-thai truncate text-[11px] text-white">{r.name}</div>
              <div className="num text-[9.5px] text-slate-500">{mmss(r.sec)}</div>
            </div>
          ))}
        </div>
      </Panel>
      {allDone && <PrevRound eng={eng} player={player} />}
      {allDone && (
        <Panel data-panel="decisions">
          <PanelHead title="DECISIONS · รายการตัดสินใจทั้งหมด" icon={Scale} right={<Src t="scenario" mini />} />
          <div className="grid grid-cols-[300px_1fr] gap-3 p-3">
            <div className="self-start"><DecisionHeadline decision={score.decision} compact /></div>
            <DecisionList decision={score.decision} limit={6} />
          </div>
        </Panel>
      )}
      <WhatIfTabs eng={eng} relDone={allDone} />
      <Panel>
        <PanelHead title="DECISION TIMELINE · เส้นเวลาการตัดสินใจ" icon={Clock} right={<Src t="scenario" mini />} />
        <div className="flex gap-1 overflow-x-auto px-3 py-2.5">
          {[...s.decisions.map((d) => ({ t: d.clock, label: `อพยพ ${d.communities.join(' ')}`, hex: d.outcome === 'false-alarm' ? '#FF6B8A' : '#22E36B' })),
            ...s.images.filter((i) => i.usable).map((i) => ({ t: i.takenAt, label: `THEOS-2 ${i.target === 'TOWN' ? 'เมือง' : i.target}`, hex: '#38BDF8' })),
            ...s.act2Shots.map((q) => ({ t: q.t, label: `THEOS-2 ${q.id} เห็น ${q.clear.length} โซน`, hex: '#38BDF8' })),
            { t: 0, label: 'น้ำเข้าเมือง (T0)', hex: '#FF003C' }]
            .sort((a, b) => a.t - b.t).map((m, i) => (
              <div key={i} className="flex min-w-[118px] flex-col rounded border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
                <span className="font-thai truncate text-[11px] font-semibold" style={{ color: m.hex }}>{m.label}</span>
                <span className="num text-[10px] text-slate-400">{clockLabel(m.t)}</span>
                <span className="font-thai text-[9.5px] text-slate-500">{clockToDate(m.t)}</span>
              </div>
            ))}
        </div>
      </Panel>
      <Panel>
        <PanelHead title="INUNDATED AREA — GISTDA RADAR (ก.ย. 2567)" icon={Waves} accent="#FF8A3D" right={<Src t="radar" />} />
        <div className="h-[180px] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={EVENT.floodRai} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF8A3D" stopOpacity="0.55" /><stop offset="100%" stopColor="#FF8A3D" stopOpacity="0.02" /></linearGradient></defs>
              <CartesianGrid stroke="rgba(148,163,184,.09)" />
              <XAxis dataKey="d" tick={{ fill: '#64809f', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis width={48} tick={{ fill: '#64809f', fontSize: 9 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0B132B', border: '1px solid rgba(255,138,61,.35)', borderRadius: 6, fontSize: 11 }} formatter={(v) => [`${fmt(v)} ไร่`, 'พื้นที่น้ำท่วม']} />
              <ReferenceArea x1="10 ก.ย." x2="12 ก.ย." fill="#FF003C" fillOpacity={0.07} />
              <Area type="monotone" dataKey="rai" stroke="#FF8A3D" strokeWidth={2} fill="url(#ag)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  )
}

function ReliefBudget({ eng, score }) {
  const rel = score.relief
  const rows = [['เหมาจ่ายครัวเรือน', RELIEF.flatGrant, rel.flats, '#22E36B'], ['ค่าล้างโคลนต่อหลัง', RELIEF.mudGrant, rel.muds, '#FFB300'], ['ส่งสำรวจภาคพื้น', RELIEF.surveyCost, rel.surveys, '#38BDF8']]
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pl-1">
      <Panel className="shrink-0" glow="#22E36B" data-panel="relief-budget">
        <PanelHead title="RELIEF BUDGET · งบเยียวยา" icon={Building2} accent="#7CFFA0" right={<Src t="scenario" mini />} />
        <div className="px-3 py-2">
          {rows.map(([n, rate, q, hex]) => (
            <div key={n} className="border-b border-white/[0.05] py-[6px] last:border-0">
              <div className="flex justify-between"><span className="font-thai text-[11.5px] text-slate-300">{n}</span><span className="num text-[11.5px] font-bold" style={{ color: hex }}>{baht(rate)}</span></div>
              <div className="num mt-0.5 text-right text-[10px] text-slate-400">× {q} = {baht(rate * q)}</div>
            </div>
          ))}
          <div className="mt-1.5 flex items-center justify-between border-t border-white/10 pt-2">
            <span className="font-thai text-[12px] font-bold text-[#7CFFA0]">อนุมัติแล้ว ({rel.done}/{rel.total})</span>
            <span className="num text-[14px] font-bold text-white">{baht(rel.committed)}</span>
          </div>
          <div className="font-thai mt-2 rounded border border-white/[0.07] bg-white/[0.02] px-2 py-1.5 text-[10.5px] text-slate-400">ประมาณการทั้งเมือง ({fmt(rel.householdsInScope)} ครัวเรือนในโซนน้ำถึง): <span className="num text-sky-200">{rel.done ? baht(Math.round(rel.projected)) : '—'}</span> · ถ้าตัดสินถูกทุกหลัง {baht(Math.round(rel.projectedIdeal))}</div>
        </div>
      </Panel>
      <Panel className="shrink-0">
        <PanelHead title="TOP LESSONS" icon={ScrollText} />
        <div className="space-y-2 px-3 py-2.5">
          {LESSONS.slice(0, 4).map((l) => (
            <div key={l.n} className="flex gap-2.5"><span className="num grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-sky-400/45 bg-sky-400/12 text-[11px] font-bold text-sky-200">{l.n}</span><span className="font-thai text-[11.5px] leading-snug text-slate-300">{l.th}</span></div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

/* ── Shell ──────────────────────────────────────────────────────────────── */

const TABS = [['relief', 'เยียวยารายหลังคา'], ['summary', 'สรุป · Leaderboard'], ['report', 'รายงาน']]

export function AarShell({ eng, tab, setTab, onPostTest, postDone, player, onSaveScore, saved }) {
  const score = useMemo(() => missionScore(eng.s, eng.scn), [eng.s, eng.scn])
  const exportCSV = useCallback(() => {
    const { s, scn } = eng
    const rows = [
      ['THEOS-2 MAE SAI COMMAND — AFTER ACTION REPORT'], ['Generated', new Date().toISOString()], ['Session', logger.current?.id ?? ''], ['Mode', s.modeId], ['Seed', s.seed], [],
      ['RESULT', 'Score version', score.version], ['RESULT', 'Mission points', `${score.points} / ${DECISION.maxPoints}`],
      ['RESULT', 'Decision tier', score.decision.tier.id], ['RESULT', 'Decision ratio', score.decision.ratio.toFixed(3)], ['RESULT', 'Decision multiplier', score.decision.mult],
      ['RESULT', 'Performance points', score.perf], ['RESULT', 'Hint points', score.hintPts],
      ...Object.entries(score.partPoints).map(([k, v]) => ['RESULT', `points.${k}`, `${v} / ${score.max[k]}`]), [],
      ['DECISION', 'ACT', 'VERDICT', 'WHAT', 'WHY'],
      ...score.decision.items.map((x) => ['DECISION', x.act, x.verdict, x.th, x.why]),
      ['RESULT', 'People saved / needing help', `${score.people.saved} / ${score.people.need}`],
      ['RESULT', 'Route errors', s.routeErrors], ['RESULT', 'Budget spent', s.budget.spent], ['RESULT', 'Fuel used / total', `${s.fuel.used} / ${s.fuel.total}`], [],
      ['ZONE', 'ORDER', 'PEAK DEPTH (m)', 'AT RISK HH', 'LEFT BEHIND HH'],
      ...score.exposure.rows.map((r) => [r.sec.id, r.order === null ? 'not ordered' : clockLabel(r.order), r.peak.toFixed(2), r.atRisk, r.remaining]), [],
      ['ROOF', 'ZONE', 'RADAR DAYS', 'MUD', 'VERDICT', 'OUTCOME'],
      ...scn.roofs.map((r) => [r.id, r.section, r.days, r.mud ? 'yes' : 'no', s.adjudged[r.id] ?? 'pending', s.adjudged[r.id] ? evaluateRoof(r, s.adjudged[r.id]) : 'pending']),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a'); a.href = url; a.download = `maesai-command-aar-${Date.now()}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }, [eng, score])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex flex-1 gap-1">
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} data-aar-tab={id}
              className={`clip-tab font-thai flex-1 px-3 py-2 text-[12px] font-semibold transition ${tab === id ? 'bg-gradient-to-b from-sky-400/25 to-sky-400/[0.08] text-white shadow-[inset_0_-2px_0_#38BDF8]' : 'bg-white/[0.03] text-slate-500 hover:text-slate-300'}`}>{label}</button>
          ))}
        </div>
        <Btn variant="primary" icon={Download} onClick={exportCSV}><span className="font-thai normal-case tracking-normal text-[12px]">Export รายงาน</span></Btn>
      </div>
      <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: 'minmax(232px,260px) minmax(0,1fr) minmax(260px,300px)' }}>
        <ScoreColumn eng={eng} score={score} />
        <div className="flex min-h-0 flex-col overflow-y-auto">
          {tab === 'relief' && <Panel className="flex min-h-0 flex-1 flex-col p-3"><ReliefTab eng={eng} /></Panel>}
          {tab === 'summary' && <SummaryTab eng={eng} score={score} onPostTest={onPostTest} postDone={postDone} player={player} saved={saved} onSaved={() => onSaveScore(score)} />}
          {tab === 'report' && <ReportTab eng={eng} score={score} />}
        </div>
        <ReliefBudget eng={eng} score={score} />
      </div>
    </div>
  )
}

function ReportTab({ eng, score }) {
  const { s, scn } = eng
  return (
    <Panel>
      <PanelHead title="AFTER ACTION REPORT — MAE SAI FLOOD RESPONSE" icon={FileText} />
      <div className="font-thai space-y-4 p-4 text-[12.5px] leading-relaxed text-slate-300">
        <section>
          <h3 className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-sky-200">1 · THEOS-2 ในภารกิจนี้</h3>
          <p className="mt-1">สั่งถ่าย {s.images.length} เป้าหมาย ใช้ได้ {s.images.filter((i) => i.usable).length} ภาพ · ระบุดินถล่มถูก {score.scars.tp} ผิด {score.scars.fp} จากทั้งหมด {scn.totalScars} · วัดลำน้ำ {s.channel.measured ? `${scn.channel.widthM} ม. (ส่ง ${s.channel.attempts} ครั้ง)` : 'ไม่ได้วัด'} · องก์ 2 THEOS-2 พบผู้ติดค้าง {s.points.filter((p) => p.revealed === 'theos').length} จุด จาก {s.points.filter((p) => p.revealed).length} จุดที่พบ</p>
        </section>
        <section>
          <h3 className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-sky-200">2 · การอพยพรายโซน</h3>
          <table className="mt-1.5 w-full border-collapse text-[11.5px]">
            <thead><tr className="border-b border-white/10 text-slate-400">{['โซน', 'สั่งเมื่อ', 'ลึกสูงสุด', 'เสี่ยง', 'ติดค้าง'].map((h) => <th key={h} className="py-1 text-left font-semibold">{h}</th>)}</tr></thead>
            <tbody>{score.exposure.rows.map((r) => (
              <tr key={r.sec.id} className="border-b border-white/[0.05]"><td className="py-1">{r.sec.id} {r.sec.name}</td><td className="num">{r.order === null ? <span className="text-[#FF6B8A]">ไม่ได้สั่ง</span> : clockLabel(r.order)}</td><td className="num">{r.peak.toFixed(1)} ม.</td><td className="num">{r.atRisk}</td><td className="num" style={{ color: r.remaining ? '#FF6B8A' : '#7CFFA0' }}>{r.remaining}</td></tr>
            ))}</tbody>
          </table>
        </section>
        <section>
          <h3 className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-sky-200">3 · ปฏิบัติการกู้ภัย</h3>
          <p className="mt-1">ช่วยได้ {score.people.saved}/{score.people.need} คน · สูญเสีย {score.people.lost} · ผู้บาดเจ็บถึงโรงพยาบาล {score.people.injuredOk}/{score.people.injured} · เส้นทางผิด {s.routeErrors} · ส่งผู้บาดเจ็บผิดที่ {s.wrongDest} · น้ำมัน {fmt(s.fuel.used)}/{fmt(s.fuel.total)} ลิตร · งบใช้ ฿{fmt(s.budget.spent)} จาก ฿{fmt(s.budget.total)}</p>
        </section>
        <section>
          <h3 className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-sky-200">4 · ความละเอียดของภาพกับการวัดได้</h3>
          <div className="mt-1 grid grid-cols-4 gap-1 text-[11px]">
            {['ความกว้างรอย', 'Sentinel-2 10 ม.', 'THEOS-2 MS 2 ม.', 'THEOS-2 Pan 0.5 ม.'].map((h) => <div key={h} className="font-semibold text-slate-400">{h}</div>)}
            {RES_PROOF.flatMap((r) => [r.width, `${r.s2}%`, `${r.ms}%`, `${r.pan}%`]).map((v, i) => <div key={i} className="num text-slate-200">{v}</div>)}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">พิกเซลบริสุทธิ์ = (w − 2p) / w — รอย 20 ม. ที่จุดภาพ 10 ม. วัดความกว้างไม่ได้</p>
        </section>
      </div>
    </Panel>
  )
}
