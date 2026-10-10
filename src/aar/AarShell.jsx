/* ══════════════════════════════════════════════════════════════════════════
   ACT 3 · AFTER ACTION REVIEW — every figure is computed from the player's run
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  ChevronRight, ScanLine, Clock, ClipboardList, Target, Activity, AlertTriangle, Boxes, Building2, Wrench, ScrollText, Download, Satellite, CheckCircle2, XCircle, Waves, Search, FileText, Database, Users, Mountain, Route, GraduationCap,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea,
} from 'recharts'
import { Panel, PanelHead, Src, Btn, ArcGauge, Spark, StatLine, Corners } from '../ui/atoms'
import { TerrainDefs, OpticalScene, useTerrain } from '../map/terrain'
import { ResolutionProof } from '../panels/command'
import { RELIEF, EVENT, DATA, SCORE, THRESHOLDS, GAME } from '../config/missionConfig'
import { LESSONS, SECTORS, COMMUNITIES, SRC, TOTAL_SCARS } from '../config/scenarioData'
import { ROOFS_LIVE as ROOFS, BUILDINGS } from '../lib/buildings'
import { makeProjection, boxKm, tilesFor } from '../lib/geo'
import { sphereReady, sphereTileTemplate } from '../lib/sphere'
import { evaluateRoof, reliefSummary, missionScore, TOTAL_AT_RISK, ARRIVAL } from '../lib/sim'
import { clamp, fmt, baht, clockLabel, clockToDate } from '../lib/format'
import { logger } from '../lib/evalLogger'

/* ── Before / after slider (whole town) ─────────────────────────────────── */

function useDragSlider(initial = 50) {
  const [pos, setPos] = useState(initial)
  const box = useRef(null)
  const drag = useRef(false)
  const move = useCallback((clientX) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    setPos(clamp(((clientX - r.left) / r.width) * 100, 2, 98))
  }, [])
  useEffect(() => {
    const mm = (e) => drag.current && move(e.clientX)
    const mu = () => { drag.current = false }
    window.addEventListener('pointermove', mm)
    window.addEventListener('pointerup', mu)
    return () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu) }
  }, [move])
  return { pos, box, start: (e) => { drag.current = true; move(e.clientX) }, grab: (e) => { e.stopPropagation(); drag.current = true } }
}

function Handle({ pos, grab }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-y-0 w-[2px] bg-white/85" style={{ left: `${pos}%`, boxShadow: '0 0 14px rgba(255,255,255,.7)' }} />
      <div className="absolute top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border-2 border-white/85 bg-[#0B132B]/90 backdrop-blur"
        style={{ left: `${pos}%`, boxShadow: '0 0 22px rgba(255,255,255,.45)' }} onPointerDown={grab} data-slider-handle>
        <div className="flex items-center gap-[3px] text-white"><ChevronRight size={12} className="rotate-180" /><ChevronRight size={12} /></div>
      </div>
    </>
  )
}

function ChangeSlider() {
  const { pos, box, start, grab } = useDragSlider()
  const [detect, setDetect] = useState(false)
  const terrain = useTerrain()
  const real = DATA.theosImagery.before && DATA.theosImagery.after
  return (
    <div ref={box} className="relative h-full w-full select-none overflow-hidden rounded-lg border border-sky-400/15 bg-[#04070E]" onPointerDown={start}>
      {real ? (
        <img src={DATA.theosImagery.after} alt="THEOS-2 after" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      ) : (
        <svg viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <TerrainDefs /><OpticalScene terrain={terrain} mud damaged />
        </svg>
      )}
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        {real ? (
          <img src={DATA.theosImagery.before} alt="THEOS-2 before" className="absolute inset-0 h-full object-cover" style={{ width: `${(100 / pos) * 100}%`, maxWidth: 'none' }} draggable={false} />
        ) : (
          <svg viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full" style={{ width: `${(100 / pos) * 100}%` }}>
            <TerrainDefs /><OpticalScene terrain={terrain} />
          </svg>
        )}
      </div>
      {detect && !real && (
        <svg viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid slice" className="pointer-events-none absolute inset-0 h-full w-full">
          <path d={terrain.riverPath} stroke="#FF003C" strokeWidth="62" fill="none" opacity="0.16" strokeLinecap="round" />
          {terrain.gaps.map((g, i) => (
            <g key={i}>
              <rect x={g.x - 16} y={g.y - 12} width="32" height="24" fill="none" stroke="#FF003C" strokeWidth="1.1" opacity="0.85" />
              <text x={g.x + 19} y={g.y + 3} fontSize="7" fill="#FF6B8A" className="font-mono">CHG {String(i + 1).padStart(2, '0')}</text>
            </g>
          ))}
        </svg>
      )}
      <div className="pointer-events-none absolute left-4 top-4">
        <div className="font-mono text-[20px] font-bold tracking-[0.09em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.9)]">BEFORE</div>
        <div className="font-thai mt-0.5 text-[11.5px] text-slate-200 drop-shadow-[0_2px_6px_rgba(0,0,0,.9)]">{EVENT.beforeImageLabel}</div>
      </div>
      <div className="pointer-events-none absolute right-4 top-4 text-right">
        <div className="font-mono text-[20px] font-bold tracking-[0.09em] text-white drop-shadow-[0_2px_8px_rgba(0,0,0,.9)]">AFTER</div>
        <div className="font-thai mt-0.5 text-[11.5px] text-slate-200 drop-shadow-[0_2px_6px_rgba(0,0,0,.9)]">{EVENT.afterImageLabel}</div>
      </div>
      <div className="absolute bottom-3 left-4 flex items-center gap-2">
        <Src t={real ? 'image' : 'scenario'} />
        {!real && <span className="font-thai rounded bg-black/60 px-1.5 py-0.5 text-[10.5px] text-slate-300">ภาพจำลอง — แทนด้วยภาพ THEOS-2 จริงใน config</span>}
      </div>
      {!real && (
        <button onPointerDown={(e) => e.stopPropagation()} onClick={() => setDetect((d) => !d)} data-change-detect
          className={`btn absolute right-4 top-[64px] px-3 py-1.5 ${detect ? 'border-[#FF003C]/60 bg-[#FF003C]/20 text-[#FF6B8A]' : 'border-sky-400/30 bg-[#070D1C]/85 text-sky-200 backdrop-blur'}`}>
          <span className="flex items-center gap-1.5"><ScanLine size={11} /> CHANGE DETECTION</span>
        </button>
      )}
      <Handle pos={pos} grab={grab} />
    </div>
  )
}

/* ── Roof-level before / after on the real GISTDA footprint ─────────────────
   BEFORE = today's GISTDA sphere imagery (online) around the real roof
   AFTER  = the same view with the scenario's standing water / mud / cloud
   Offline: a procedural background, still with the real footprint shape. */

const ROOF_VIEW_KM = [0.13, 0.071]   // same 1.83 : 1 aspect as the 440 × 240 frame

function useRoofView(roof) {
  return useMemo(() => {
    if (!roof.real) return null
    // frame ~4× the roof's size, never tighter than 90 × 60 m
    const side = Math.max(ROOF_VIEW_KM[0], (Math.sqrt(roof.areaM2 || 120) * 4.5) / 1000)
    const bbox = boxKm(roof.c[0], roof.c[1], side, side * (ROOF_VIEW_KM[1] / ROOF_VIEW_KM[0]))
    const proj = makeProjection(bbox, 330, 180, 0)
    const ring = (r) => r.map((p, i) => `${i ? 'L' : 'M'}${proj.pt(p).map((v) => v.toFixed(1)).join(' ')}`).join('') + 'Z'
    const [W, S, E, N] = bbox
    const near = BUILDINGS.filter((b) => b.fid !== roof.fid && b.c[0] > W - 0.0004 && b.c[0] < E + 0.0004 && b.c[1] > S - 0.0004 && b.c[1] < N + 0.0004)
    return {
      proj,
      // z19 is upsampled at Mae Sai — z18 is the sharpest real imagery
      tiles: sphereReady() ? tilesFor(proj, sphereTileTemplate(), 16, 0, 18) : [],
      target: ring(roof.ring),
      neighbours: near.map((b) => ring(b.ring)).join(''),
      centre: proj.pt(roof.c),
    }
  }, [roof])
}

function RoofScene({ roof, after, view }) {
  const seed = Number(String(roof.fid ?? roof.id).replace(/\D/g, '').slice(-6)) || 7
  const water = after && roof.days !== null
  const mudR = after ? (roof.mud === 'clear' ? 70 : roof.mud === 'partial' ? 48 : 0) : 0
  const cloud = after && roof.conf < 0.55
  const [cx, cy] = view ? view.centre : [165, 90]
  return (
    <svg viewBox="0 0 330 180" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
      {/* procedural ground — visible offline or while tiles load */}
      <rect width="330" height="180" fill={after ? '#5b4a33' : '#2f4a2c'} />
      {Array.from({ length: 60 }, (_, i) => {
        const x = (i * 53 + seed * 7) % 300, y = (i * 31 + seed * 3) % 200
        return <circle key={i} cx={x} cy={y} r={3 + (i % 4)} fill={after ? '#6d5a3a' : '#3d6d40'} opacity="0.7" />
      })}
      {/* GISTDA sphere imagery — the "after" copy is browned to read as a flooded scene */}
      {view?.tiles.length > 0 && (
        <g style={after ? { filter: 'sepia(0.75) saturate(0.6) brightness(0.8)' } : undefined}>
          {view.tiles.map((t) => <image key={t.key} href={t.href} x={t.x} y={t.y} width={t.w + 0.6} height={t.h + 0.6} preserveAspectRatio="none" />)}
        </g>
      )}
      {view && <path d={view.neighbours} fill={view.tiles.length ? 'none' : (after ? '#8a7358' : '#b04529')} stroke="#F8FAFC" strokeOpacity="0.55" strokeWidth="0.8" />}
      {water && <ellipse cx={cx} cy={cy} rx="130" ry="80" fill="#1d4ed8" opacity={Math.min(0.5, roof.days / 24)} />}
      {mudR > 0 && <ellipse cx={cx} cy={cy} rx={mudR} ry={mudR * 0.7} fill="#a07a45" opacity="0.7" />}
      {view
        ? <path d={view.target} fill={view.tiles.length ? 'none' : (after ? '#9a805f' : '#c05a3e')} stroke="#FFD066" strokeWidth="2" strokeDasharray="5 3" />
        : <rect x="118" y="76" width="64" height="46" fill={after ? '#9a805f' : '#c05a3e'} stroke="#FFD066" strokeWidth="1.4" strokeDasharray="5 3" />}
      {cloud && <rect width="330" height="180" fill="#cbd5e1" opacity="0.55" filter="blur(6px)" />}
    </svg>
  )
}

function RoofCompare({ roof, eng }) {
  const { pos, box, start, grab } = useDragSlider(64)   // keep the handle off the target roof
  const view = useRoofView(roof)
  const online = view?.tiles.length > 0
  const mudTh = { clear: 'มีคราบโคลนชัด', partial: 'บางส่วน / ถูกบัง', none: 'ไม่พบคราบโคลน' }
  return (
    <div className="grid grid-cols-[440px_minmax(0,1fr)] gap-4 rounded-lg border border-sky-400/20 bg-white/[0.02] p-2.5" data-roof-compare={roof.id}>
      <div ref={box} className="relative h-[240px] w-[440px] select-none overflow-hidden rounded border border-white/10" onPointerDown={start}>
        <RoofScene roof={roof} after view={view} />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <div className="absolute inset-0" style={{ width: `${(100 / pos) * 100}%` }}><RoofScene roof={roof} view={view} /></div>
        </div>
        <span className="font-thai pointer-events-none absolute left-2 top-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">
          ก่อน · {online ? 'ภาพ GISTDA sphere (ปัจจุบัน)' : 'ภาพจำลอง'}
        </span>
        <span className="font-thai pointer-events-none absolute right-2 top-2 rounded bg-black/65 px-1.5 py-0.5 text-[10px] text-white">หลัง · จำลองน้ำขัง/โคลน</span>
        <div className="pointer-events-none absolute bottom-2 left-2 flex gap-1">{online && <Src t="image" mini />}<Src t="scenario" mini /></div>
        <Handle pos={pos} grab={grab} />
      </div>
      <div className="font-thai space-y-1.5 text-[11.5px]">
        <div className="num text-[15px] font-bold text-white">{roof.id}</div>
        <div className="text-slate-400">{COMMUNITIES.find((c) => c.name === roof.com)?.th || roof.com}{roof.real ? ` · ${roof.elev ?? '—'} ม.รทก.` : ''}</div>
        {roof.real && <div className="flex items-center justify-between"><span className="text-slate-400">หลังคาจริง</span><Src t="image" mini /></div>}
        <div className="flex items-center justify-between"><span className="text-slate-400">ท่วมขัง</span>
          <span className="num" style={{ color: roof.days === null ? '#FF6B8A' : roof.days >= RELIEF.inundationMinDays ? '#7CFFA0' : '#cbd5e1' }}>{roof.days === null ? 'ไม่มีภาพเรดาร์' : `${roof.days} วัน`}</span></div>
        <div className="flex justify-end"><Src t="scenario" mini /></div>
        <div className="flex items-center justify-between"><span className="text-slate-400">โคลน</span><span className="text-slate-200">{mudTh[roof.mud]}</span></div>
        <div className="flex items-center justify-between"><span className="text-slate-400">ความมั่นใจ</span>
          <span className="num" style={{ color: roof.conf >= 0.7 ? '#7CFFA0' : roof.conf >= 0.5 ? '#FFD066' : '#FF6B8A' }}>{Math.round(roof.conf * 100)}%</span></div>
        <div className="text-[10px] leading-snug text-slate-500">รูปหลังคาจาก GISTDA BD_footprint · วันท่วมขัง/โคลนเป็นค่าสถานการณ์จนกว่าจะได้ไทม์ซีรีส์เรดาร์</div>
        {eng && (
          <div className="flex flex-wrap gap-1.5 pt-1" data-roof-actions={roof.id}>
            {[['flat', `อนุมัติ ฿${fmt(RELIEF.flatGrant)}`, '#22E36B'], ['both', `+ ค่าล้างโคลน ฿${fmt(RELIEF.mudGrant)}`, '#FFB300'], ['reject', 'ปฏิเสธ', '#FF003C']].map(([k, label, hex]) => {
              const on = eng.s.adjudged[roof.id] === k
              return (
                <button key={k} onClick={() => eng.adjudicate(roof.id, k)}
                  className="btn px-2 py-1.5 font-thai text-[11px] normal-case tracking-normal"
                  style={on ? { borderColor: `${hex}aa`, background: `${hex}30`, color: '#fff' } : { borderColor: `${hex}55`, color: hex }}>
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Relief adjudication table ──────────────────────────────────────────── */

function AdjudicationTable({ eng }) {
  const { s, adjudicate, survey } = eng
  const [focus, setFocus] = useState(ROOFS[0].id)
  const rel = reliefSummary(s)
  const mudLabel = { clear: 'MUD CONFIRMED', partial: 'PARTIAL / OBSCURED', none: 'NO MUD' }
  const mudHex = { clear: '#FF7A1A', partial: '#FFB300', none: '#64748b' }
  const roof = ROOFS.find((r) => r.id === focus)
  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <div className="grid shrink-0 grid-cols-5 gap-2">
        {[['ตัดสินแล้ว', `${rel.done} / ${rel.total}`, '#38BDF8'], ['ถูกต้อง', rel.correct, '#22E36B'], ['จ่ายเกิน', rel.overpay, '#FFB300'],
          ['ตัดสิทธิ์ผิด', rel.denial, '#FF003C'], ['งบที่อนุมัติ', baht(rel.committed), '#7dd3fc']].map(([l, v, hex]) => (
          <div key={l} className="relative rounded border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5">
            <Corners color={`${hex}44`} />
            <div className="font-thai truncate text-[10.5px] text-slate-400">{l}</div>
            <div className="num mt-0.5 text-[15px] font-bold leading-none" style={{ color: hex }}>{v}</div>
          </div>
        ))}
      </div>
      <RoofCompare roof={roof} eng={eng} />
      <div className="min-h-0 flex-1 overflow-y-auto rounded border border-white/[0.07]">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-[#0A1120]">
            <tr className="border-b border-white/10">
              {['หลังคา', 'ชุมชน', 'ท่วมขัง', 'คราบโคลน', 'มั่นใจ', 'ตัดสิน', 'ผล'].map((h) => <th key={h} className="font-thai px-2 py-1.5 text-left text-[11px] font-semibold text-slate-400">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {ROOFS.map((r) => {
              const v = s.adjudged[r.id]
              const out = v ? evaluateRoof(r, v) : 'pending'
              const revealed = s.surveyed.includes(r.id)
              const insufficient = r.days === null || r.conf < 0.55
              const outHex = { correct: '#22E36B', overpay: '#FFB300', denial: '#FF003C', under: '#FF7A1A', pending: '#64748b' }[out]
              const outTh = { correct: 'ถูกต้อง', overpay: 'จ่ายเกิน', denial: 'ตัดสิทธิ์ผิด', under: 'จ่ายขาด', pending: '—' }[out]
              return (
                <tr key={r.id} onClick={() => setFocus(r.id)} data-roof={r.id}
                  className={`cursor-pointer border-b border-white/[0.05] transition ${focus === r.id ? 'bg-sky-400/[0.08]' : 'hover:bg-white/[0.025]'}`}>
                  <td className="num px-2 py-1.5 text-[11px] text-white">{r.id}</td>
                  <td className="font-thai px-2 py-1.5 text-[11px] text-slate-300">{COMMUNITIES.find((c) => c.name === r.com)?.th}</td>
                  <td className="px-2 py-1.5">
                    {r.days === null ? <span className="font-thai text-[10.5px] text-[#FF003C]">ไม่มีภาพ</span>
                      : <span className="num text-[11px]" style={{ color: r.days >= RELIEF.inundationMinDays ? '#7CFFA0' : '#94a3b8' }}>{r.days} วัน{r.days >= RELIEF.inundationMinDays ? ' ✓' : ''}</span>}
                  </td>
                  <td className="px-2 py-1.5"><span className="font-mono text-[9.5px]" style={{ color: mudHex[r.mud] }}>{mudLabel[r.mud]}</span></td>
                  <td className="num px-2 py-1.5 text-[10.5px]" style={{ color: r.conf >= 0.7 ? '#7CFFA0' : r.conf >= 0.5 ? '#FFD066' : '#FF6B8A' }}>{Math.round(r.conf * 100)}%</td>
                  <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1">
                      {[['flat', '฿9,000', '#22E36B'], ['both', '+฿10,000', '#FFB300'], ['reject', 'ปฏิเสธ', '#FF003C']].map(([k, label, hex]) => (
                        <button key={k} onClick={() => { setFocus(r.id); adjudicate(r.id, k) }} data-verdict={`${r.id}-${k}`}
                          className="btn px-1.5 py-1 font-thai normal-case tracking-normal"
                          style={v === k ? { borderColor: `${hex}99`, background: `${hex}2e`, color: '#fff' } : { borderColor: 'rgba(255,255,255,.12)', color: '#94a3b8' }}>
                          {label}
                        </button>
                      ))}
                      {insufficient && (
                        <button onClick={() => { setFocus(r.id); survey(r.id) }} disabled={revealed}
                          className={`btn px-1.5 py-1 font-thai normal-case tracking-normal ${revealed ? 'border-sky-400/50 bg-sky-400/15 text-sky-200' : 'border-sky-400/30 text-sky-300 hover:bg-sky-400/15'}`}>
                          {revealed ? 'สำรวจแล้ว' : 'ส่งสำรวจ'}
                        </button>
                      )}
                    </div>
                    {revealed && <div className="font-thai mt-1 text-[10px] text-sky-300/80">ภาคสนาม: เหมาจ่าย {r.truth.flat ? 'มีสิทธิ์' : 'ไม่มีสิทธิ์'} · โคลน {r.truth.mud ? 'พบ' : 'ไม่พบ'}</div>}
                  </td>
                  <td className="font-thai px-2 py-1.5 text-[11px] font-bold" style={{ color: outHex }}>{outTh}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="font-thai shrink-0 text-[10.5px] leading-snug text-slate-500">
        หลักฐาน: วันท่วมขังจากไทม์ซีรีส์เรดาร์ · คราบโคลนจาก THEOS-2 Pan 0.5 ม. ก่อน/หลัง · เกณฑ์ เหมาจ่าย {baht(RELIEF.flatGrant)} (ท่วมขัง ≥ {RELIEF.inundationMinDays} วัน)
        + ค่าล้างโคลน {baht(RELIEF.mudGrant)} · หลักฐานไม่พอ → ส่งสำรวจ (แม่นแต่ช้า) / อนุมัติ (เสี่ยงจ่ายเกิน) / ปฏิเสธ (เสี่ยงตัดสิทธิ์ผิด)
      </div>
    </div>
  )
}

/* ── Timeline built from the actual decision log ────────────────────────── */

function OperationTimeline({ eng }) {
  const { s } = eng
  const kindTh = { EVACUATE: 'ประกาศอพยพ', STANDBY: 'แจ้งเตรียมพร้อม', HOLD: 'ยังไม่สั่งการ' }
  const kindHex = { EVACUATE: '#FF3B63', STANDBY: '#FFB300', HOLD: '#94A3B8' }
  const rounds = logger.current?.rounds || []
  const events = [
    ...s.decisions.map((d) => ({ clock: d.clock, label: kindTh[d.kind] || d.kind, hex: kindHex[d.kind] || '#38BDF8', sub: d.communities?.length ? d.communities.map((id) => COMMUNITIES.find((c) => c.id === id)?.th).join(' · ') : '' })),
    ...COMMUNITIES.map((c) => ({ clock: ARRIVAL[c.id], label: `น้ำถึง${c.th}`, hex: '#2563EB', sub: 'แบบจำลอง' })),
    { clock: 0, label: 'ยอดน้ำเข้าเมือง (T0)', hex: '#FF003C', sub: 'เรดาร์ 10–12 ก.ย.' },
    { clock: 36 * 60, label: 'น้ำลด · ฟื้นฟู', hex: '#38BDF8', sub: 'THEOS-2 17 ก.ย.' },
  ].filter((e) => Number.isFinite(e.clock)).sort((a, b) => a.clock - b.clock)
  const chart = rounds.map((r) => ({ n: r.n, sec: r.roundSec, kind: r.kind }))
  return (
    <Panel className="flex shrink-0 flex-col">
      <PanelHead title="OPERATION TIMELINE · เส้นเวลาการตัดสินใจจริง" icon={Clock} right={<Src t="scenario" mini />} />
      <div className="flex gap-1 overflow-x-auto px-3 pt-2.5 pb-1">
        {events.map((m, i) => (
          <div key={i} className="flex min-w-[124px] flex-1 flex-col rounded border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
            <span className="font-thai truncate text-[11px] font-semibold" style={{ color: m.hex }}>{m.label}</span>
            <span className="num text-[10px] text-slate-400">{clockLabel(m.clock)}</span>
            <span className="font-thai text-[9.5px] text-slate-500">{clockToDate(m.clock)}</span>
            {m.sub && <span className="font-thai truncate text-[9.5px] text-slate-500">{m.sub}</span>}
          </div>
        ))}
      </div>
      <div className="h-[132px] px-2 pb-1 pt-2">
        {chart.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="rgba(148,163,184,.09)" vertical={false} />
              <XAxis dataKey="n" tick={{ fill: '#64809f', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <YAxis width={34} tick={{ fill: '#64809f', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} unit="s" />
              <Tooltip contentStyle={{ background: '#0B132B', border: '1px solid rgba(56,189,248,.3)', borderRadius: 6, fontSize: 11 }}
                formatter={(v, n, p) => [`${v} วินาที`, p.payload.kind]} labelFormatter={(n) => `รอบที่ ${n}`} />
              <Bar dataKey="sec" radius={[3, 3, 0, 0]}>
                {chart.map((c, i) => <Cell key={i} fill={kindHex[c.kind] || '#38BDF8'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="font-thai grid h-full place-items-center text-[12px] text-slate-500">ยังไม่มีการตัดสินใจที่บันทึกไว้</div>}
      </div>
      <div className="font-thai border-t border-white/[0.07] px-3 py-1.5 text-[10.5px] text-slate-500">กราฟ: เวลาจริงที่ใช้คิดในแต่ละรอบการตัดสินใจ (วินาที) — จากระบบบันทึกอัตโนมัติ</div>
    </Panel>
  )
}

/* ── Left / right columns ───────────────────────────────────────────────── */

function AarLeftColumn({ eng, score }) {
  const { s } = eng
  const exp = score.exposure
  const parts = [
    ['warning', 'อพยพทันเวลา', score.parts.warning],
    ['relief', 'เยียวยาถูกต้อง', score.parts.relief],
    ['triage', 'จัดลำดับตามกฎ', score.parts.triage],
    ['trust', 'ความเชื่อมั่น', score.parts.trust],
    ['evidence', 'ใช้หลักฐาน', score.parts.evidence],
  ]
  const total = Math.round(score.total * 100)
  const hex = total >= 75 ? '#22E36B' : total >= 50 ? '#FFB300' : '#FF003C'
  const trustHex = s.trust >= 75 ? '#22E36B' : s.trust >= 50 ? '#FFB300' : '#FF003C'
  const band = s.trust >= 90 ? 'VERY HIGH' : s.trust >= 75 ? 'HIGH' : s.trust >= 50 ? 'MODERATE' : s.trust >= 30 ? 'LOW' : 'COLLAPSED'
  const startTrust = s.trustHist[0] ?? 100
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
      <Panel className="shrink-0" data-panel="mission-score">
        <PanelHead title="MISSION SUCCESS · คะแนนภารกิจ" icon={Target} right={<Src t="scenario" mini />} />
        <div className="px-3 pb-2 pt-3">
          <ArcGauge value={total} color={hex} label={total >= 75 ? 'SUCCESSFUL' : total >= 50 ? 'PARTIAL' : 'FAILED'} size={150} />
        </div>
        <div className="space-y-1 px-3 pb-3">
          {parts.map(([k, label, v]) => (
            <div key={k}>
              <div className="flex items-baseline justify-between">
                <span className="font-thai text-[11px] text-slate-300">{label} <span className="num text-[9.5px] text-slate-500">×{SCORE[k]}</span></span>
                <span className="num text-[11px] font-semibold text-white">{Math.round(v * 100)}%</span>
              </div>
              <div className="mt-0.5 h-[4px] overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full" style={{ width: `${v * 100}%`, background: v >= 0.75 ? '#22E36B' : v >= 0.5 ? '#FFB300' : '#FF3B63' }} />
              </div>
            </div>
          ))}
          <div className="font-thai pt-1 text-[10px] text-slate-500">คำนวณจากการเล่นจริง — น้ำหนักแก้ได้ที่ missionConfig.js (SCORE)</div>
        </div>
      </Panel>

      <Panel className="shrink-0">
        <PanelHead title="OPERATION SUMMARY" icon={ClipboardList} />
        <div className="px-3 py-1">
          <StatLine icon={Clock} label="ช่วงเหตุการณ์" value={`${clockToDate(-48 * 60, false)} – ${clockToDate(36 * 60, false)}`} src="scenario" />
          <StatLine icon={Users} label="หลังคาในเขตน้ำถึง (4 ชุมชน)" value={fmt(TOTAL_AT_RISK)} src="image" />
          <StatLine icon={CheckCircle2} label="อพยพทัน" value={fmt(exp.safe)} src="scenario" accent="#22E36B" />
          <StatLine icon={AlertTriangle} label="ยังเสี่ยงเมื่อน้ำมา" value={fmt(exp.exposed)} src="scenario" accent="#FF6B8A" />
          <StatLine icon={Satellite} label="แถบ THEOS-2 ที่ใช้" value={`${s.tasked.length} / ${GAME.swaths}`} src="image" />
          <StatLine icon={Boxes} label="ทรัพยากรที่ส่ง" value={fmt(Object.values(s.deployed).reduce((a, b) => a + b, 0))} src="scenario" />
        </div>
      </Panel>

      <Panel className="shrink-0">
        <PanelHead title="FINAL TRUST INDEX" icon={Activity} accent={trustHex} />
        <div className="px-3 pb-2 pt-3">
          <ArcGauge value={s.trust} color={trustHex} label={band} sub="ค่าสุดท้าย" size={140}
            delta={`${s.trust - startTrust >= 0 ? '+' : ''}${(s.trust - startTrust).toFixed(1)}% จากเริ่มต้น`} deltaDir={s.trust >= startTrust ? 'up' : 'down'} />
          <Spark data={s.trustHist} color={trustHex} h={60} dots fill={false} />
        </div>
      </Panel>
    </div>
  )
}

function AarRightColumn({ eng, setTab, score }) {
  const rel = score.relief
  const rows = [
    { n: 'เหมาจ่ายครัวเรือน', rate: RELIEF.flatGrant, qty: rel.flats, hex: '#22E36B' },
    { n: 'ค่าล้างโคลนต่อหลัง', rate: RELIEF.mudGrant, qty: rel.muds, hex: '#FFB300' },
    { n: 'ส่งสำรวจภาคพื้น', rate: RELIEF.surveyCost, qty: rel.surveys, hex: '#38BDF8' },
  ]
  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pl-1">
      <Panel className="shrink-0" glow="#22E36B" data-panel="relief-budget">
        <PanelHead title="RELIEF BUDGET · งบเยียวยา" icon={Building2} accent="#7CFFA0" right={<Src t="scenario" mini />} />
        <div className="px-3 py-2">
          {rows.map((r) => (
            <div key={r.n} className="border-b border-white/[0.05] py-[6px] last:border-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-thai min-w-0 flex-1 truncate text-[11.5px] text-slate-300">{r.n}</span>
                <span className="num shrink-0 text-[11.5px] font-bold" style={{ color: r.hex }}>{baht(r.rate)}</span>
              </div>
              <div className="num mt-0.5 text-right text-[10px] text-slate-400">× {r.qty} = {baht(r.rate * r.qty)}</div>
            </div>
          ))}
          <div className="mt-1.5 flex items-center justify-between border-t border-white/10 pt-2">
            <span className="font-thai text-[12px] font-bold text-[#7CFFA0]">อนุมัติแล้ว ({rel.done}/{rel.total} หลัง)</span>
            <span className="num text-[14px] font-bold text-white">{baht(rel.committed)}</span>
          </div>
          <div className="mt-2 rounded border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
            <div className="font-thai text-[10.5px] text-slate-400">ประมาณการทั้ง AOI-A ({fmt(rel.householdsInScope)} หลังคาในเขตน้ำถึง)</div>
            <div className="flex items-baseline justify-between">
              <span className="num text-[13px] font-bold text-sky-200">{rel.done ? baht(Math.round(rel.projected)) : '—'}</span>
              <span className="font-thai text-[10px] text-slate-500">ถ้าตัดสินถูกทุกหลัง {baht(Math.round(rel.projectedIdeal))}</span>
            </div>
          </div>
          <Btn variant="go" size="sm" className="mt-2 w-full" icon={ClipboardList} onClick={() => setTab('decisions')}>
            <span className="font-thai normal-case tracking-normal">เปิดบัญชีหลังคาเรือน</span>
          </Btn>
        </div>
      </Panel>

      <Panel className="shrink-0">
        <PanelHead title="IMPACT OVERVIEW" icon={AlertTriangle} accent="#FF7A1A" />
        <div className="px-3 py-1">
          <StatLine icon={Waves} label="พื้นที่น้ำท่วมสูงสุด" value="25,204 ไร่" src="radar" />
          <StatLine icon={Mountain} label="ดินถล่มที่ตรวจพบ" value={`${eng.sfvi.scarsSeen} / ${TOTAL_SCARS}`} src="image" />
          <StatLine icon={Route} label="ลำน้ำสายเหลือ" value={`${Math.round(eng.s.channelWidth)} ม.`} src="image" />
          <StatLine icon={Route} label="เส้นทางหนีน้ำที่คำนวณ" value={Object.keys(eng.s.routes).length} src="scenario" />
        </div>
      </Panel>

      <Panel className="shrink-0">
        <PanelHead title="TOP 3 LESSONS" icon={ScrollText} />
        <div className="space-y-2 px-3 py-2.5">
          {LESSONS.slice(0, 3).map((l) => (
            <div key={l.n} className="flex gap-2.5">
              <span className="num grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border border-sky-400/45 bg-sky-400/12 text-[11px] font-bold text-sky-200">{l.n}</span>
              <span className="font-thai text-[11.5px] leading-snug text-slate-300">{l.th}</span>
            </div>
          ))}
        </div>
        <div className="px-3 pb-3"><Btn variant="ghost" className="w-full" icon={ScrollText} onClick={() => setTab('lessons')}><span className="font-thai normal-case tracking-normal">บทเรียนทั้งหมด</span></Btn></div>
      </Panel>
    </div>
  )
}

/* ── Shell ──────────────────────────────────────────────────────────────── */

const TABS = [['summary', 'สรุป'], ['decisions', 'เยียวยารายหลังคา'], ['operations', 'ปฏิบัติการ'], ['impact', 'ผลกระทบ'], ['lessons', 'บทเรียน'], ['report', 'รายงาน']]

export function AarShell({ eng, tab, setTab, onPostTest, postDone }) {
  const score = useMemo(() => missionScore(eng.s), [eng.s])

  const exportCSV = useCallback(() => {
    const { s, sfvi } = eng
    const rows = [
      ['THEOS-2 MAE SAI COMMAND — AFTER ACTION REPORT'],
      ['Generated', new Date().toISOString()], ['Session', logger.current?.id ?? ''],
      [],
      ['SECTION', 'KEY', 'VALUE', 'PROVENANCE'],
      ['RESULT', 'Mission score', `${Math.round(score.total * 100)}%`, 'SCENARIO'],
      ...Object.entries(score.parts).map(([k, v]) => ['RESULT', `score.${k}`, `${Math.round(v * 100)}%`, 'SCENARIO']),
      ['RESULT', 'Households safe / at risk', `${score.exposure.safe} / ${score.exposure.total}`, 'SCENARIO'],
      ['STATE', 'Final trust index', `${s.trust.toFixed(1)}%`, 'SCENARIO'],
      ['STATE', 'Swaths tasked', s.tasked.join(' ') || 'none', 'IMAGE'],
      ['STATE', 'Channel width (m)', s.channelWidth, 'IMAGE'],
      ['STATE', 'Layers opened by player', s.layersOpened.join(' '), 'SCENARIO'],
      ['SFVI', 'Basin score', sfvi.basin.toFixed(4), 'DERIVED'],
      ...['W', 'R', 'L', 'N', 'P'].map((k) => ['SFVI', k, sfvi[k].toFixed(4), { W: 'MEASURED', R: 'MEASURED', L: 'IMAGE', N: 'IMAGE', P: 'SCENARIO' }[k]]),
      [],
      ['COMMUNITY', 'ORDER CLOCK', 'EVENT TIME', 'FLOOD ARRIVAL', 'AT RISK HH', 'EXPOSED HH'],
      ...score.exposure.rows.map((r) => [r.c.th, r.order === null ? 'not ordered' : clockLabel(r.order), r.order === null ? '' : clockToDate(r.order), clockLabel(r.arrival), r.atRisk, r.exposed]),
      [],
      ['ROOF ID', 'COMMUNITY', 'INUNDATION DAYS', 'MUD', 'VERDICT', 'OUTCOME'],
      ...ROOFS.map((r) => [r.id, r.com, r.days ?? 'NO PASS', r.mud, s.adjudged[r.id] ?? 'pending', s.adjudged[r.id] ? evaluateRoof(r, s.adjudged[r.id]) : 'pending']),
      [],
      ['DECISION LOG', 'CLOCK', 'EVENT TIME', 'WATER (m)', 'SFVI', 'COMMUNITIES', 'OUTCOME'],
      ...s.decisions.map((d) => [d.kind, d.clockLabel, d.eventTime, d.water, d.sfvi, (d.communities || []).join(' '), d.outcome ?? '']),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `maesai-command-aar-${Date.now()}.csv`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    eng.push('good', 'EXPORT', 'After Action Review exported as CSV.', 'ส่งออกรายงานหลังปฏิบัติการเป็นไฟล์ CSV')
  }, [eng, score])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className="flex shrink-0 items-center gap-3">
        <div className="flex flex-1 gap-1">
          {TABS.map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} data-aar-tab={id}
              className={`clip-tab font-thai flex-1 px-3 py-2 text-[12px] font-semibold transition
                ${tab === id ? 'bg-gradient-to-b from-sky-400/25 to-sky-400/[0.08] text-white shadow-[inset_0_-2px_0_#38BDF8]' : 'bg-white/[0.03] text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'}`}>
              {label}
            </button>
          ))}
        </div>
        <Btn variant={postDone ? 'solid' : 'go'} size="lg" icon={GraduationCap} onClick={onPostTest} disabled={postDone}>
          <span className="font-thai normal-case tracking-normal text-[12px]">{postDone ? 'ทำแบบทดสอบแล้ว' : 'แบบทดสอบหลังเรียน'}</span>
        </Btn>
        <Btn variant="primary" size="lg" icon={Download} onClick={exportCSV}>
          <span className="font-thai normal-case tracking-normal text-[12px]">Export รายงาน</span>
        </Btn>
      </div>

      <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: 'minmax(232px,268px) minmax(0,1fr) minmax(272px,320px)' }}>
        <AarLeftColumn eng={eng} score={score} />

        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-0.5">
          {tab === 'summary' && (
            <>
              <div className="min-h-[300px] flex-1"><ChangeSlider /></div>
              <OperationTimeline eng={eng} />
            </>
          )}
          {tab === 'decisions' && (
            <Panel className="flex min-h-0 flex-1 flex-col">
              <PanelHead title="RELIEF ADJUDICATION · บัญชีหลังคาเรือน" icon={Building2} right={<span className="font-thai text-[10.5px] text-slate-400">มติ ครม. 17 ก.ย. 2567</span>} />
              <div className="min-h-0 flex-1 overflow-hidden p-3"><AdjudicationTable eng={eng} /></div>
            </Panel>
          )}
          {tab === 'operations' && <OperationsTab eng={eng} score={score} />}
          {tab === 'impact' && <ImpactTab score={score} />}
          {tab === 'lessons' && <LessonsTab />}
          {tab === 'report' && <ReportTab eng={eng} score={score} exportCSV={exportCSV} />}
        </div>

        <AarRightColumn eng={eng} setTab={setTab} score={score} />
      </div>
    </div>
  )
}

function OperationsTab({ eng, score }) {
  const { s } = eng
  return (
    <div className="space-y-3">
      <Panel>
        <PanelHead title="EVACUATION OUTCOME · ผลการอพยพรายชุมชน" icon={Users} right={<Src t="scenario" mini />} />
        <table className="w-full border-collapse">
          <thead><tr className="border-b border-white/10">
            {['ชุมชน', 'สั่งอพยพ', 'น้ำถึง', 'ต้องใช้เวลาอพยพ', 'เสี่ยง / ทั้งหมด'].map((h) => <th key={h} className="font-thai px-3 py-2 text-left text-[11px] font-semibold text-slate-400">{h}</th>)}
          </tr></thead>
          <tbody>
            {score.exposure.rows.map((r) => (
              <tr key={r.c.id} className="border-b border-white/[0.05]">
                <td className="font-thai px-3 py-2 text-[12.5px] text-white">{r.c.th}</td>
                <td className="px-3 py-2 text-[11.5px]">{r.order === null ? <span className="font-thai text-[#FF6B8A]">ไม่ได้สั่ง</span> : <span className="num text-slate-300">{clockLabel(r.order)}</span>}</td>
                <td className="num px-3 py-2 text-[11.5px] text-slate-300">{clockLabel(r.arrival)}</td>
                <td className="num px-3 py-2 text-[11.5px] text-slate-300">{Math.round(r.need)} min</td>
                <td className="num px-3 py-2 text-[12px] font-semibold" style={{ color: r.exposed ? '#FF6B8A' : '#7CFFA0' }}>{fmt(r.exposed)} / {fmt(r.atRisk)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel>
        <PanelHead title="SENSOR TASKING RECORD" icon={Satellite} />
        <div className="grid grid-cols-3 gap-2 p-3">
          {SECTORS.map((sec) => {
            const done = s.tasked.includes(sec.id)
            const cloudy = s.cloudyPasses.includes(sec.id)
            return (
              <div key={sec.id} className="rounded border px-2.5 py-2" style={{ borderColor: done ? '#22E36B33' : 'rgba(255,255,255,.07)', background: done ? '#22E36B0A' : 'rgba(255,255,255,.02)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold" style={{ color: done ? '#7CFFA0' : '#64748b' }}>{sec.label}</span>
                  {done ? <CheckCircle2 size={11} className="text-[#22E36B]" /> : <XCircle size={11} className="text-slate-600" />}
                </div>
                <div className="font-thai mt-1 text-[10.5px] text-slate-500">{done ? `${sec.scars} รอยดินถล่ม · ป่าหาย ${sec.forestLoss}%` : cloudy ? 'ถ่ายแล้วแต่เมฆบัง' : 'ไม่ได้ถ่าย — จุดบอด'}</div>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}

function ImpactTab({ score }) {
  const rel = score.relief
  const pie = [
    { name: 'เหมาจ่าย', value: rel.flats * RELIEF.flatGrant, hex: '#22E36B' },
    { name: 'ค่าล้างโคลน', value: rel.muds * RELIEF.mudGrant, hex: '#FFB300' },
    { name: 'สำรวจภาคพื้น', value: rel.surveys * RELIEF.surveyCost, hex: '#38BDF8' },
  ].filter((p) => p.value > 0)
  return (
    <div className="space-y-3">
      <Panel>
        <PanelHead title="INUNDATED AREA — GISTDA RADAR TIME SERIES (ก.ย. 2567)" icon={Waves} accent="#FF8A3D" right={<Src t="radar" />} />
        <div className="h-[210px] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={EVENT.floodRai} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
              <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF8A3D" stopOpacity="0.55" /><stop offset="100%" stopColor="#FF8A3D" stopOpacity="0.02" /></linearGradient></defs>
              <CartesianGrid stroke="rgba(148,163,184,.09)" />
              <XAxis dataKey="d" tick={{ fill: '#64809f', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis width={48} tick={{ fill: '#64809f', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#0B132B', border: '1px solid rgba(255,138,61,.35)', borderRadius: 6, fontSize: 11 }} formatter={(v) => [`${fmt(v)} ไร่`, 'พื้นที่น้ำท่วม']} />
              <ReferenceArea x1="10 ก.ย." x2="12 ก.ย." fill="#FF003C" fillOpacity={0.07} label={{ value: '×4 ใน 2 วัน', fill: '#FF6B8A', fontSize: 10 }} />
              <Area type="monotone" dataKey="rai" stroke="#FF8A3D" strokeWidth={2} fill="url(#ag)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="font-thai border-t border-white/[0.07] px-3 py-2 text-[11px] text-slate-400">6,182 ไร่ (10 ก.ย.) → 25,204 ไร่ (12 ก.ย.) — ช่วงตัดสินใจกว้างราวสองวัน และดาวเทียมเชิงแสงมองไม่เห็นตลอดช่วงนั้น · ค่า 8/11/14/17 ก.ย. เป็นค่าประมาณระหว่างจุด</div>
      </Panel>
      <div className="grid grid-cols-2 gap-3">
        <Panel>
          <PanelHead title="RELIEF BREAKDOWN" icon={Wrench} right={<Src t="scenario" />} />
          <div className="h-[200px] p-3">
            {pie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={44} outerRadius={72} paddingAngle={2} stroke="none">
                    {pie.map((c, i) => <Cell key={i} fill={c.hex} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0B132B', border: '1px solid rgba(56,189,248,.3)', borderRadius: 6, fontSize: 11 }} formatter={(v, n) => [baht(v), n]} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="font-thai grid h-full place-items-center text-[12px] text-slate-500">ยังไม่ได้อนุมัติเงินเยียวยา</div>}
          </div>
        </Panel>
        <Panel>
          <PanelHead title="RESOLUTION vs MEASURABILITY" icon={Search} right={<Src t="image" />} />
          <div className="p-3"><ResolutionProof compact={false} /></div>
        </Panel>
      </div>
    </div>
  )
}

function LessonsTab() {
  return (
    <div className="space-y-3">
      <Panel>
        <PanelHead title="LESSONS LEARNED — บทเรียน" icon={ScrollText} />
        <div className="space-y-2 p-3">
          {LESSONS.map((l) => (
            <div key={l.n} className="flex gap-3 rounded border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
              <span className="num grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full border border-sky-400/45 bg-sky-400/12 text-[12px] font-bold text-sky-200">{l.n}</span>
              <div className="min-w-0 flex-1">
                <span className="rounded border border-sky-400/25 bg-sky-400/[0.08] px-1.5 py-[2px] font-mono text-[8px] tracking-[0.1em] text-sky-300">{l.tag}</span>
                <div className="font-thai mt-1.5 text-[13px] leading-snug text-slate-100">{l.th}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-slate-500">{l.txt}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <PanelHead title="STRESS TEST REGISTER — แผนทดสอบความทนทานของกฎ" icon={AlertTriangle} accent="#FFB300" />
        <div className="grid grid-cols-2 gap-2 p-3">
          {[
            ['เมฆปกคลุมลุ่มน้ำ 3 วัน', 'ค่า L ล้าสมัย → ลดน้ำหนัก ความเชื่อมั่นต่ำ เรดาร์รับช่วง'],
            ['สถานีต้นน้ำขาดรายงาน', 'R หายไป → W และ N รับภาระ ความเชื่อมั่นลดลง'],
            ['ชุมชนเสียทางออกสุดท้าย', 'tie-break ยกขึ้นอันดับแรกทันที'],
            ['น้ำหลากรอบสองก่อนล้างโคลนเสร็จ', 'กลับสู่ระยะวิกฤต เปิดค่าล้างโคลนใหม่'],
            ['ผู้เรียนไม่สั่งการในองก์ 1', 'นาฬิกาเดินต่อ ระบบแสดงผลกับทั้ง 4 ชุมชน (ลองกด "ยังไม่สั่งการ")'],
          ].map(([k, v]) => (
            <div key={k} className="rounded border border-[#FFB300]/20 bg-[#FFB300]/[0.05] px-2.5 py-2">
              <div className="font-thai text-[12px] font-semibold text-[#FFD066]">{k}</div>
              <div className="font-thai mt-1 text-[11px] leading-snug text-slate-400">{v}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function ReportTab({ eng, score, exportCSV }) {
  const { s, sfvi } = eng
  return (
    <div className="space-y-3">
      <Panel>
        <PanelHead title="AFTER ACTION REPORT — MAE SAI FLOOD RESPONSE" icon={FileText}
          right={<Btn size="sm" variant="primary" icon={Download} onClick={exportCSV}>Export CSV</Btn>} />
        <div className="font-thai space-y-4 p-4 text-[12.5px] leading-relaxed text-slate-300">
          <section>
            <h3 className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-sky-200">1 · ทำไมต้องใช้ข้อมูลดาวเทียม</h3>
            <p className="mt-1">ลุ่มน้ำสายตอนบน (AOI-B ≈965 ตร.กม.) อยู่ในเมียนมา ไทยตั้งสถานีวัดไม่ได้ และ UAV บินข้ามพรมแดนไม่ได้ ดาวเทียมจึงเป็นเซนเซอร์เดียวที่เห็นพื้นที่ต้นเหตุ</p>
          </section>
          <section>
            <h3 className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-sky-200">2 · การตัดสินใจของคุณ</h3>
            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {[['คะแนนภารกิจ', `${Math.round(score.total * 100)}%`], ['หลังคาเรือนอพยพทัน', `${fmt(score.exposure.safe)}/${fmt(score.exposure.total)}`],
                ['แถบ THEOS-2', `${s.tasked.length}/${GAME.swaths}`], ['ชั้นข้อมูลก่อนตัดสินใจ', score.layersAtFirst],
                ['เตือนผิด', s.falseAlarms], ['รอภาพ', s.holdCount], ['หลังคาที่ตัดสิน', `${score.relief.done}/${score.relief.total}`], ['ความเชื่อมั่น', `${Math.round(s.trust)}%`]].map(([k, v]) => (
                <div key={k} className="rounded border border-white/[0.07] bg-white/[0.025] px-2.5 py-2">
                  <div className="text-[10.5px] text-slate-400">{k}</div>
                  <div className="num mt-0.5 text-[15px] font-bold text-white">{v}</div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-sky-200">3 · กฎการตัดสินใจที่ใช้จริง</h3>
            <p className="mt-1">SFVI ลุ่มน้ำล่าสุด <b className="num text-sky-200">{sfvi.basin.toFixed(3)}</b> ความเชื่อมั่น <b className="num text-sky-200">{Math.round(sfvi.confidence * 100)}%</b> ·
              Veto 1 (≥ {THRESHOLDS.criticalLevel.toFixed(2)} ม.) {s.decisions.some((d) => d.water >= THRESHOLDS.criticalLevel) ? 'ถูกใช้ระหว่างภารกิจ' : 'ไม่ได้ถูกใช้ในการตัดสินใจ'} ·
              ลำน้ำวัดได้ {Math.round(s.channelWidth)} ม. {s.channelMeasured ? '(จากภาพ THEOS-2)' : '(ยังไม่ได้วัด — ใช้ค่าเดิม)'}</p>
          </section>
          <section>
            <h3 className="font-mono text-[10.5px] font-bold tracking-[0.14em] text-sky-200">4 · หมายเหตุความถูกต้อง</h3>
            <p className="mt-1 text-slate-400">เกณฑ์สถานีและอัตราเยียวยาอยู่ใน src/config/missionConfig.js ทั้งหมด จำนวนหลังคาเรือนนับจากชั้นอาคารจริงของ GISTDA ส่วนโซนน้ำถึง เวลาน้ำถึง และงบเยียวยาคำนวณจากการตัดสินใจของผู้เล่นด้วยแบบจำลอง
              (ติดป้าย "ค่าสถานการณ์") — ไม่ใช่ตัวเลขความเสียหายจริงของเหตุการณ์ปี 2567</p>
          </section>
        </div>
      </Panel>
      <Panel>
        <PanelHead title="PROVENANCE LEGEND · ป้ายที่มาข้อมูล 4 แบบ" icon={Database} />
        <div className="grid grid-cols-2 gap-2 p-3">
          {Object.entries(SRC).map(([k, v]) => (
            <div key={k} className="flex items-start gap-2.5 rounded border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
              <Src t={k} />
              <div className="font-thai min-w-0 text-[11px] leading-snug text-slate-400">{v.note}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
