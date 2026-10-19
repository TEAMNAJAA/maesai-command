/* ══════════════════════════════════════════════════════════════════════════
   THEOS-2 IMAGE WORK (act 1)
   · ImageAnalysisModal — change detection: before (Mar 2024) vs this pass;
     label every candidate as a fresh landslide scar or not (fields, cloud
     shadows and old revegetated scars are the traps) → L
   · ChannelModal — drag the gauge across the Pan image, read the pixels,
     compute the width and N = 1 − width ÷ 150 yourself → N
   Synthetic scenes (THEOS-2 L3 Ortho stand-ins) until GISTDA imagery arrives.
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ScanSearch, Check, X, ChevronRight, Ruler, Lightbulb, Satellite } from 'lucide-react'
import { Modal, Btn, Src } from '../ui/atoms'
import { WhyButton } from '../ui/impact'
import { useMode } from '../ui/label'
import { THEOS2, THRESHOLDS, DATA } from '../config/missionConfig'
import { SECTORS } from '../config/scenarioData'
import { mulberry32 } from '../lib/rng'
import { TOWN_TARGET } from '../lib/scenario'
import { clamp, clockLabel } from '../lib/format'

const VW = 760, VH = 440

/* ── Sector scene: real SRTM relief of the sector + season + features ───── */

const DEM_B = DATA.dem.catchment
const CROP_DEG = 0.075                                        // ≈ 7.8 km across

function useScene(sectorId, seed) {
  return useMemo(() => {
    const r = mulberry32((seed * 31 + sectorId.charCodeAt(0) * 977) >>> 0)
    const sec = SECTORS.find((x) => x.id === sectorId) || SECTORS[0]
    const [w, s, e, n] = DEM_B.bbox
    const cx = ((sec.lon - w) / (e - w)) * DEM_B.image.width, cy = ((n - sec.lat) / (n - s)) * DEM_B.image.height
    const cw = (CROP_DEG / (e - w)) * DEM_B.image.width
    const k = VW / cw
    const img = { x: -(cx - cw / 2) * k, y: -(cy - (cw * VH / VW) / 2) * k, w: DEM_B.image.width * k, h: DEM_B.image.height * k }
    // river along the valley floor, road along the slope, a few hamlets by the road
    const riverY = VH * (0.62 + (r() - 0.5) * 0.2)
    let river = `M -20 ${riverY}`
    for (let x = 0; x <= VW + 40; x += 80) river += ` Q ${x + 40} ${riverY + (r() - 0.5) * 90} ${x + 80} ${riverY + (r() - 0.5) * 50}`
    const roadY = VH * 0.3 + r() * 40
    const road = `M -10 ${roadY} C ${VW * 0.3} ${roadY + 60}, ${VW * 0.6} ${roadY - 50}, ${VW + 10} ${roadY + 20}`
    const huts = Array.from({ length: 3 }, () => {
      const hx = 60 + r() * (VW - 120)
      const hy = roadY + (hx / VW - 0.5) * 30 + (r() - 0.5) * 24
      return Array.from({ length: 4 + Math.floor(r() * 5) }, () => ({ x: hx + (r() - 0.5) * 34, y: hy + (r() - 0.5) * 18, w: 3 + r() * 3, h: 2.5 + r() * 2.5, a: r() * 40 - 20, roof: r() > 0.5 ? '#b8b2a4' : '#9a5b45' }))
    }).flat()
    return { img, river, road, huts }
  }, [sectorId, seed])
}

/** Landslide outline: narrow head scarp at the top, widening runout fan at the toe, ragged edges. */
function scarShape(c, x, y, L) {
  const r = mulberry32([...c.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0)
  const N = 14, left = [], right = []
  const bend = (r() - 0.5) * 0.35, lob = 2 + r() * 2
  for (let i = 0; i <= N; i++) {
    const u = i / N
    const toe = Math.exp(-((u - 0.86) ** 2) / 0.012) * 0.22
    const wid = L * (0.08 + 0.13 * u + 0.12 * Math.sin(u * Math.PI * lob) ** 2 * u + toe) * (0.8 + r() * 0.35)
    const yy = y - L / 2 + u * L
    const sway = (Math.sin(u * 3.1) * bend + (r() - 0.5) * 0.03) * L
    left.push([x + sway - wid / 2 * (0.85 + r() * 0.3), yy]); right.push([x + sway + wid / 2 * (0.85 + r() * 0.3), yy])
  }
  const pts = [...left, ...right.reverse()]
  return `M${pts.map((p) => p.map((v) => v.toFixed(1)).join(' ')).join(' L')} Z`
}

function Candidate({ c, after, uid }) {
  const x = c.x * VW, y = c.y * VH, L = c.len * VW * 1.15
  if (c.kind === 'scar' || c.kind === 'old') {
    if (c.kind === 'scar' && !after) return null
    const d = scarShape(c, x, y, L)
    const fresh = c.kind === 'scar'
    return (
      <g transform={`rotate(${c.rot} ${x} ${y})`} filter={`url(#${uid}-rough)`}>
        {fresh && <path d={d} transform="translate(2.5 1.5)" fill="#1d150c" opacity="0.45" />}
        <path d={d} fill={fresh ? `url(#${uid}-soil)` : `url(#${uid}-old)`} opacity={fresh ? 1 : 0.72} />
        {fresh && <path d={`M${x - L * 0.06} ${y - L / 2 + 1} q ${L * 0.06} -4 ${L * 0.13} 0`} stroke="#f1c58f" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
        {fresh && [0.55, 0.68, 0.8, 0.9].map((u, i) => <circle key={i} cx={x + (i % 2 ? 1 : -1) * L * 0.08} cy={y - L / 2 + u * L} r="1.6" fill="#3a2a1a" opacity="0.7" />)}
      </g>
    )
  }
  if (c.kind === 'field') {
    const w = L * 0.95, h = L * 0.62
    const tones = after ? ['#7ea343', '#93b552', '#6c9638'] : ['#bfa66e', '#ad955f', '#cdb782']
    return (
      <g transform={`rotate(${c.rot} ${x} ${y})`}>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy], i) => {
          const x0 = x + (dx < 0 ? -w / 2 : 1), y0 = y + (dy < 0 ? -h / 2 : 1)
          return (
            <g key={i}>
              <rect x={x0} y={y0} width={w / 2 - 1} height={h / 2 - 1} fill={tones[i % 3]} />
              {Array.from({ length: 5 }, (_, j) => <line key={j} x1={x0} x2={x0 + w / 2 - 1} y1={y0 + (j + 0.5) * (h / 10)} y2={y0 + (j + 0.5) * (h / 10)} stroke={after ? '#5d8530' : '#9a8350'} strokeWidth="0.7" opacity="0.8" />)}
            </g>
          )
        })}
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="none" stroke={after ? '#c9d9a0' : '#e1d3a6'} strokeWidth="0.9" opacity="0.8" />
      </g>
    )
  }
  if (!after) return null   // cloud + its shadow — only in this pass
  return (
    <g>
      <ellipse cx={x} cy={y} rx={L * 0.5} ry={L * 0.32} fill="#16222a" opacity="0.62" filter={`url(#${uid}-soft)`} />
      <g filter={`url(#${uid}-cloud)`}>
        {[[0, 0, 0.42, 0.26], [0.22, -0.08, 0.3, 0.2], [-0.2, 0.04, 0.28, 0.18], [0.05, 0.12, 0.3, 0.16]].map(([dx, dy, rx, ry], i) => (
          <ellipse key={i} cx={x + 30 + dx * L} cy={y - 34 + dy * L} rx={rx * L} ry={ry * L} fill="#fff" />
        ))}
      </g>
    </g>
  )
}

// Mar 2024 dry season (tan, low saturation) vs Sep 2024 monsoon (deep green, wet, hazy)
const SEASON = {
  after: '0.78 0.12 0 0 -0.03  0.05 1.00 0.04 0 0.0  0.02 0.12 0.70 0 -0.02  0 0 0 1 0',
  before: '0.88 0.12 0 0 0.01  0.08 0.88 0.04 0 0.01  0.04 0.10 0.68 0 0  0 0 0 1 0',
}
// light speckle layers over the relief: canopy = dark crowns, clump = sunlit stands
const CANOPY = {
  after: '0 0 0 0 0.04  0 0 0 0 0.13  0 0 0 0 0.05  3 0 0 0 -1.25',
  before: '0 0 0 0 0.16  0 0 0 0 0.16  0 0 0 0 0.08  3 0 0 0 -1.25',
}
const CLUMP = {
  after: '0 0 0 0 0.42  0 0 0 0 0.62  0 0 0 0 0.28  3 0 0 0 -1.6',
  before: '0 0 0 0 0.66  0 0 0 0 0.60  0 0 0 0 0.38  3 0 0 0 -1.6',
}

/** Rendered once per image; the before/after slider only moves a clip on the wrapper (no re-render while dragging). */
const SectorImage = React.memo(function SectorImage({ sceneId, seed, cands, after }) {
  const sc = useScene(sceneId, seed)
  const uid = `sx${after ? 'a' : 'b'}`
  const key = after ? 'after' : 'before'
  const of = (kind) => cands.filter((c) => c.kind === kind).map((c) => <Candidate key={c.id} c={c} after={after} uid={uid} />)
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
      <defs>
        <filter id={`${uid}-season`} x="0" y="0" width="100%" height="100%">
          <feColorMatrix type="matrix" values={SEASON[key]} />
          <feComponentTransfer><feFuncR type="linear" slope="1.2" intercept="-0.06" /><feFuncG type="linear" slope="1.2" intercept="-0.06" /><feFuncB type="linear" slope="1.2" intercept="-0.06" /></feComponentTransfer>
        </filter>
        <filter id={`${uid}-canopy`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="3" seed="3" />
          <feColorMatrix values={CANOPY[key]} />
        </filter>
        <filter id={`${uid}-clump`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" seed="8" />
          <feColorMatrix values={CLUMP[key]} />
        </filter>
        <filter id={`${uid}-rough`} x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.22" numOctaves="2" seed="5" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id={`${uid}-cloud`} x="-60%" y="-60%" width="220%" height="220%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="4" seed="2" result="n" />
          <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b" />
          <feComposite in="n" in2="b" operator="in" result="m" />
          <feColorMatrix in="m" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 2.4 -0.35" />
        </filter>
        <filter id={`${uid}-grain`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="4" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <linearGradient id={`${uid}-soil`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dca877" /><stop offset="0.3" stopColor="#a65e36" /><stop offset="0.75" stopColor="#8f5232" /><stop offset="1" stopColor="#bd9466" />
        </linearGradient>
        <linearGradient id={`${uid}-old`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a8550" /><stop offset="1" stopColor="#66703c" /></linearGradient>
        <radialGradient id={`${uid}-vig`} cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.35" /></radialGradient>
      </defs>
      <rect width={VW} height={VH} fill="#23402a" />
      {/* real relief of the sector (SRTM hillshade) in the season's colours */}
      <image href={DEM_B.href} x={sc.img.x} y={sc.img.y} width={sc.img.w} height={sc.img.h} preserveAspectRatio="none" filter={`url(#${uid}-season)`} />
      <rect width={VW} height={VH} filter={`url(#${uid}-clump)`} opacity="0.3" />
      {!after && <rect width={VW} height={VH} fill="#9c8650" opacity="0.08" style={{ mixBlendMode: 'multiply' }} />}
      {/* tree crowns over the forest */}
      <rect width={VW} height={VH} filter={`url(#${uid}-canopy)`} opacity={after ? 0.5 : 0.4} />
      {of('old')}
      <path d={sc.road} stroke="#2e2a1f" strokeWidth="4.2" fill="none" opacity="0.55" />
      <path d={sc.road} stroke={after ? '#b7a885' : '#d2c39d'} strokeWidth="2.2" fill="none" />
      {sc.huts.map((h, i) => <rect key={i} x={h.x} y={h.y} width={h.w} height={h.h} fill={h.roof} transform={`rotate(${h.a} ${h.x} ${h.y})`} opacity="0.95" />)}
      {/* river: wet margin · water · glint */}
      <path d={sc.river} stroke={after ? '#9c8a62' : '#b5ab8a'} strokeWidth={after ? 26 : 18} fill="none" opacity="0.55" strokeLinecap="round" />
      <path d={sc.river} stroke={after ? '#8a6b45' : '#3d6b70'} strokeWidth={after ? 17 : 9} fill="none" strokeLinecap="round" />
      <path d={sc.river} stroke={after ? '#c09a68' : '#7fb2b0'} strokeWidth="1.4" fill="none" opacity="0.6" strokeDasharray="22 40" />
      {of('field')}
      {of('scar')}
      {of('shadow')}
      {after && <rect width={VW} height={VH} fill="#dfeaf2" opacity="0.05" />}
      <rect width={VW} height={VH} filter={`url(#${uid}-grain)`} opacity="0.12" style={{ mixBlendMode: 'overlay' }} />
      <rect width={VW} height={VH} fill={`url(#${uid}-vig)`} />
    </svg>
  )
})

const KIND_TH = { scar: 'ดินถล่มใหม่', field: 'ทุ่งนา/ไร่ (มีในภาพก่อน)', shadow: 'เงาเมฆ (ไม่ใช่พื้นดินเปลี่ยน)', old: 'รอยดินถล่มเก่า (มีในภาพก่อน)' }

export function ImageAnalysisModal({ eng, imageId, onClose }) {
  const mode = useMode()
  const img = eng.s.images.find((i) => i.id === imageId)
  const scene = img ? eng.scn.scenes[img.target] : null
  const [labels, setLabels] = useState(() => ({ ...(img?.labels || {}) }))
  const [focus, setFocus] = useState(null)
  const [pos, setPos] = useState(50)
  const [done, setDone] = useState(img?.analyzed || false)
  const [checking, setChecking] = useState(false)
  const box = useRef(null)
  const drag = useRef(false)
  useEffect(() => {
    const mm = (e) => { if (!drag.current || !box.current) return; const r = box.current.getBoundingClientRect(); setPos(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100)) }
    const mu = () => { drag.current = false }
    window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu)
    return () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu) }
  }, [])
  if (!img || !scene) return null
  const sec = SECTORS.find((x) => x.id === img.target)
  const set = (id, v) => { if (!done) setLabels((l) => ({ ...l, [id]: v })) }
  const nScar = Object.values(labels).filter((v) => v === 'scar').length
  // short "scan" before the reveal so the check reads as a step, not an instant answer
  const submit = () => {
    setChecking(true)
    setTimeout(() => { eng.submitAnalysis(img.id, Object.fromEntries(scene.cands.map((c) => [c.id, labels[c.id] === 'scar' ? 'scar' : 'none']))); setChecking(false); setDone(true) }, 900)
  }
  const result = (c) => (labels[c.id] === 'scar') === (c.kind === 'scar')
  return (
    <Modal open onClose={onClose} width={1120} tone="#38BDF8" z={88}>
      <div className="p-5" data-modal="analysis">
        <div className="flex items-center gap-3">
          <ScanSearch size={20} className="text-sky-300" />
          <div>
            <div className="hud-label">THEOS-2 · L3 ORTHO · PAN-SHARPENED · CHANGE DETECTION</div>
            <h2 className="font-thai flex items-center gap-2 text-[18px] font-bold text-white">แปลภาพ {sec?.label} · {sec?.th} — หารอยดินถล่ม "ใหม่" <WhyButton id="analysis" size={15} /></h2>
          </div>
          <span className="ml-auto flex items-center gap-2"><span className="num text-[11px] text-slate-400">ถ่าย {clockLabel(img.takenAt)} · เมฆ {img.cloud}%</span><Src t="image" /></span>
        </div>
        <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: 'minmax(0,1fr) 300px' }}>
          <div>
            <div ref={box} className="relative aspect-[760/440] w-full select-none overflow-hidden rounded-lg border border-white/15 bg-black"
              onPointerDown={(e) => { if (e.target.closest('[data-cand]')) return; drag.current = true; const r = box.current.getBoundingClientRect(); setPos(clamp(((e.clientX - r.left) / r.width) * 100, 0, 100)) }}>
              <SectorImage sceneId={img.target} seed={eng.s.seed} cands={scene.cands} after />
              <div className="absolute inset-0 [will-change:clip-path]" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
                <SectorImage sceneId={img.target} seed={eng.s.seed} cands={scene.cands} after={false} />
              </div>
              <div className="pointer-events-none absolute inset-y-0 w-[2px] bg-white/90" style={{ left: `${pos}%` }} />
              {checking && (
                <div className="pointer-events-none absolute inset-0 z-10 bg-sky-400/10">
                  <div className="absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-sky-300/50 to-transparent animate-[scanY_.9s_linear]" />
                  <span className="font-thai absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded bg-black/80 px-3 py-1.5 text-[14px] font-bold text-sky-100">กำลังตรวจกับข้อมูลภาคพื้น…</span>
                </div>
              )}
              <div className="absolute top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border-2 border-white bg-black/70 text-white" style={{ left: `${pos}%` }}
                onPointerDown={(e) => { e.stopPropagation(); drag.current = true }} data-analysis-handle>⇆</div>
              <span className="font-thai pointer-events-none absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">◀ ก่อนเหตุการณ์ (มี.ค. 2567)</span>
              <span className="font-thai pointer-events-none absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">ภาพรอบนี้ ({img.passId}) ▶</span>
              {scene.cands.map((c, i) => {
                const lab = labels[c.id]
                const hex = done ? (result(c) ? '#22E36B' : '#FF003C') : lab === 'scar' ? '#FF7A1A' : lab === 'none' ? '#94A3B8' : '#FFD066'
                return (
                  <button key={c.id} data-cand={c.id} onClick={() => { setFocus(c.id); set(c.id, labels[c.id] === 'scar' ? 'none' : 'scar') }}
                    className="absolute grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-[11px] font-bold text-white shadow-lg"
                    style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%`, borderColor: hex, background: focus === c.id ? `${hex}cc` : `${hex}55` }}>
                    {i + 1}
                  </button>
                )
              })}
            </div>
            <div className="font-thai mt-1.5 text-[11px] text-slate-400">ลากเส้นกลางเพื่อเทียบภาพก่อน/หลัง · คลิกหมุดบนภาพ = ระบุว่าเป็นดินถล่มใหม่ (คลิกซ้ำเพื่อยกเลิก) · หมุดที่ไม่ได้คลิกนับเป็น "ไม่ใช่" · ภาพจำลองเพื่อการฝึก (รอภาพ THEOS-2 จริงจาก GISTDA)</div>
          </div>
          <div className="flex min-h-0 flex-col gap-2">
            {mode.tutor && !done && (
              <div className="font-thai rounded border border-[#FFD066]/35 bg-[#FFD066]/[0.06] px-2.5 py-2 text-[11px] leading-snug text-[#FFE6A8]">
                <div className="mb-1 flex items-center gap-1 font-bold"><Lightbulb size={12} /> วิธีดู</div>
                • <b>ดินถล่มใหม่</b>: แนวสีน้ำตาลแดงยาวลงตามลาดเขา มีดินกองที่ปลาย และ<b>ไม่มีในภาพก่อน</b><br />
                • ทุ่งนา/ไร่: สี่เหลี่ยม มีแนวร่อง — มีในภาพก่อนด้วย<br />
                • เงาเมฆ: ปื้นเทาเข้มไม่มีพื้นผิว มีเมฆขาวอยู่ข้าง ๆ<br />
                • รอยเก่า: สีน้ำตาลอมเขียว มีในภาพก่อนแล้ว
              </div>
            )}
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {scene.cands.map((c, i) => (
                <div key={c.id} className={`rounded border px-2 py-1.5 ${focus === c.id ? 'border-sky-400 bg-sky-400/10' : 'border-white/[0.08] bg-white/[0.02]'}`} onClick={() => setFocus(c.id)}>
                  <div className="flex items-center gap-2">
                    <span className="num grid h-5 w-5 place-items-center rounded-full bg-white/10 text-[10.5px] font-bold text-white">{i + 1}</span>
                    {done ? (
                      <span className="font-thai flex-1 text-[11px]" style={{ color: result(c) ? '#7CFFA0' : '#FF9DB2' }}>{result(c) ? <Check size={11} className="mr-1 inline" /> : <X size={11} className="mr-1 inline" />}{KIND_TH[c.kind]}</span>
                    ) : (
                      <span className="flex flex-1 gap-1">
                        <button onClick={() => set(c.id, 'scar')} data-label={`${c.id}-scar`} className={`font-thai flex-1 rounded border px-1 py-0.5 text-[10.5px] ${labels[c.id] === 'scar' ? 'border-[#FF7A1A] bg-[#FF7A1A]/25 text-white' : 'border-white/15 text-slate-300'}`}>ดินถล่มใหม่</button>
                        <button onClick={() => set(c.id, 'none')} data-label={`${c.id}-none`} className={`font-thai flex-1 rounded border px-1 py-0.5 text-[10.5px] ${labels[c.id] === 'none' ? 'border-slate-300 bg-white/15 text-white' : 'border-white/15 text-slate-300'}`}>ไม่ใช่</button>
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {done ? (
              <div className="font-thai rounded border border-sky-400/30 bg-sky-400/[0.06] px-2.5 py-2 text-[11.5px] text-sky-100">
                ระบุดินถล่ม {nScar} จุด · ถูก {scene.cands.filter((c) => c.kind === 'scar' && labels[c.id] === 'scar').length}/{scene.scars} · ผิด {scene.cands.filter((c) => c.kind !== 'scar' && labels[c.id] === 'scar').length}
                <div className="text-[10px] text-slate-400">ค่า L ใน SFVI ใช้จำนวนที่คุณระบุ — ระบุเกินทำให้ SFVI สูงเกินจริง</div>
              </div>
            ) : (
              <Btn variant="primary" size="lg" icon={Check} onClick={submit} disabled={checking}><span className="font-thai normal-case tracking-normal text-[12.5px]">ส่งผลการแปลภาพ (ระบุดินถล่ม {nScar} จุด)</span></Btn>
            )}
            <Btn variant="solid" onClick={onClose}><span className="font-thai normal-case tracking-normal">{done ? 'ปิด' : 'ไว้ทีหลัง'}</span></Btn>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ── Channel width: measure in pixels, compute N ─────────────────────────── */

const PX = 6      // screen px per image pixel in the measuring view

export function ChannelModal({ eng, onClose }) {
  const mode = useMode()
  const { s, scn } = eng
  const img = s.images.find((i) => i.usable && i.readyAt <= s.clock && ['D', 'E', TOWN_TARGET].includes(i.target))
  const W = 900, H = 360
  const riverPx = scn.channel.pixels * PX
  const left0 = (W - riverPx) / 2
  const [a, setA] = useState(left0 - 70)
  const [b, setB] = useState(left0 + riverPx + 60)
  const [val, setVal] = useState('')
  const [res, setRes] = useState(null)
  const svg = useRef(null)
  const drag = useRef(null)
  const toX = useCallback((e) => { const r = svg.current.getBoundingClientRect(); return clamp(((e.clientX - r.left) / r.width) * W, 10, W - 10) }, [])
  useEffect(() => {
    const mm = (e) => { if (!drag.current || !svg.current) return; const x = toX(e); drag.current === 'a' ? setA(x) : setB(x) }
    const mu = () => { drag.current = null }
    window.addEventListener('pointermove', mm); window.addEventListener('pointerup', mu)
    return () => { window.removeEventListener('pointermove', mm); window.removeEventListener('pointerup', mu) }
  }, [toX])
  // Pan 0.5 m town reach: flood walls + earth banks, riverside roads, roof blocks with shadows, trees
  const town = useMemo(() => {
    const r = mulberry32(scn.seed)
    const L = left0 - 14, R = left0 + riverPx + 14            // outer faces of the flood walls
    const roadL = L - 46, roadR = R + 34
    const roofs = []
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? 0 : roadR + 18, x1 = side < 0 ? roadL - 16 : W
      for (let y = -10; y < H + 10;) {
        const h = 18 + r() * 26
        for (let x = x0 + r() * 6; x < x1 - 14;) {
          const w = 16 + r() * 30
          if (r() > 0.18) roofs.push({ x, y, w: Math.min(w, x1 - x), h, tone: 120 + Math.round(r() * 110), ridge: r() > 0.5 })
          x += w + 3 + r() * 7
        }
        y += h + 5 + r() * 9
      }
    }
    const trees = Array.from({ length: 46 }, () => {
      const side = r() < 0.5 ? -1 : 1
      const x = side < 0 ? roadL + 12 + r() * (L - roadL - 18) : R + 6 + r() * (roadR - R - 12)
      return { x, y: r() * H, rr: 4 + r() * 6 }
    })
    const glint = Array.from({ length: 10 }, () => ({ x: left0 + 4 + r() * (riverPx - 8), y: r() * H, w: 3 + r() * 6 }))
    return { L, R, roadL, roadR, roofs, trees, glint }
  }, [scn.seed, left0, riverPx])
  if (!img) return null
  const px = Math.round(Math.abs(b - a) / PX)
  const submit = () => {
    const v = Number(String(val).replace(',', '.'))
    if (!Number.isFinite(v)) return
    eng.submitChannel(+v.toFixed(2))
    setRes(Math.abs(v - (1 - scn.channel.widthM / THRESHOLDS.origChannelWidth)) <= 0.011 ? 'ok' : 'bad')
  }
  return (
    <Modal open onClose={onClose} width={1000} tone="#38BDF8" z={88}>
      <div className="p-5" data-modal="channel">
        <div className="flex items-center gap-3">
          <Ruler size={20} className="text-sky-300" />
          <div>
            <div className="hud-label">THEOS-2 · PAN {THEOS2.panM} M · {img.target === TOWN_TARGET ? 'TOWN REACH' : `SECTOR ${img.target}`} · CHANNEL WIDTH</div>
            <h2 className="font-thai flex items-center gap-2 text-[18px] font-bold text-white">วัดความกว้างลำน้ำสาย แล้วคำนวณค่า N เอง <WhyButton id="channel" size={15} /></h2>
          </div>
          <span className="ml-auto"><Src t="image" /></span>
        </div>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full select-none rounded-lg border border-white/15 bg-[#1b1b1b]">
          <defs>
            <filter id="pan-ground" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="4" seed="6" />
              <feColorMatrix values="0 0 0 0 0.45  0 0 0 0 0.45  0 0 0 0 0.42  0 0 0 0.55 0" />
            </filter>
            <filter id="pan-grain" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
            <filter id="pan-flow" x="0" y="0" width="100%" height="100%">
              <feTurbulence type="fractalNoise" baseFrequency="0.09 0.006" numOctaves="3" seed="12" />
              <feColorMatrix values="0 0 0 0 0.75  0 0 0 0 0.75  0 0 0 0 0.75  0.9 0 0 0 -0.32" />
            </filter>
            <filter id="pan-tree" x="-50%" y="-50%" width="200%" height="200%">
              <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="2" seed="7" result="n" />
              <feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <clipPath id="pan-water"><rect x={left0} y="0" width={riverPx} height={H} /></clipPath>
          </defs>
          {/* the image itself is panchromatic — the gauge on top keeps its colour */}
          <g style={{ filter: 'grayscale(1) contrast(1.12)' }}>
            <rect width={W} height={H} fill="#6d6d66" />
            <rect width={W} height={H} filter="url(#pan-ground)" />
            {/* roof blocks: shadow to the lower right, ridge line on pitched roofs */}
            {town.roofs.map((o, i) => (
              <g key={i}>
                <rect x={o.x + 3} y={o.y + 3} width={o.w} height={o.h} fill="#1c1c1a" opacity="0.55" />
                <rect x={o.x} y={o.y} width={o.w} height={o.h} fill={`rgb(${o.tone},${o.tone},${o.tone - 6})`} />
                {o.ridge && <line x1={o.x + 1} y1={o.y + o.h / 2} x2={o.x + o.w - 1} y2={o.y + o.h / 2} stroke={`rgb(${o.tone + 30},${o.tone + 30},${o.tone + 24})`} strokeWidth="1.2" />}
              </g>
            ))}
            {/* riverside roads */}
            {[town.roadL - 13, town.roadR].map((x, i) => (
              <g key={i}>
                <rect x={x} y="0" width="13" height={H} fill="#a9a9a2" />
                <line x1={x + 6.5} y1="0" x2={x + 6.5} y2={H} stroke="#e4e4dc" strokeWidth="0.9" strokeDasharray="8 8" />
              </g>
            ))}
            {/* trees along the bank */}
            <g filter="url(#pan-tree)">
              {town.trees.map((tr, i) => <g key={i}><circle cx={tr.x + 2} cy={tr.y + 2} r={tr.rr} fill="#151513" opacity="0.5" /><circle cx={tr.x} cy={tr.y} r={tr.rr} fill="#3d4038" /><circle cx={tr.x - tr.rr * 0.3} cy={tr.y - tr.rr * 0.3} r={tr.rr * 0.45} fill="#5a5e52" /></g>)}
            </g>
            {/* concrete flood wall (bright) + earth bank slope down to the water edge */}
            <rect x={town.L} y="0" width="6" height={H} fill="#d4d4cc" />
            <rect x={town.L + 6} y="0" width="8" height={H} fill="#8a8678" />
            <rect x={left0 + riverPx} y="0" width="8" height={H} fill="#8a8678" />
            <rect x={town.R - 6} y="0" width="6" height={H} fill="#d4d4cc" />
            {/* water: turbid channel, flow streaks, a few glints */}
            <rect x={left0} y="0" width={riverPx} height={H} fill="#3a3a3a" data-river />
            <g clipPath="url(#pan-water)">
              <rect x={left0} y="0" width={riverPx} height={H} filter="url(#pan-flow)" opacity="0.55" />
              {town.glint.map((g, i) => <ellipse key={i} cx={g.x} cy={g.y} rx={g.w / 2} ry="0.9" fill="#f2f2ea" opacity="0.55" />)}
            </g>
            <rect width={W} height={H} filter="url(#pan-grain)" opacity="0.1" style={{ mixBlendMode: 'overlay' }} />
          </g>
          <text x="12" y={H - 12} fontSize="11" fill="#e2e8f0" className="num" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>THEOS-2 PAN · 1 พิกเซล = {THEOS2.panM} ม.</text>
          {/* the gauge */}
          <line x1={a} y1={H / 2} x2={b} y2={H / 2} stroke="#38BDF8" strokeWidth="2.5" />
          {Array.from({ length: Math.floor(Math.abs(b - a) / (PX * 2)) + 1 }, (_, i) => {
            const x = Math.min(a, b) + i * PX * 2
            return <line key={i} x1={x} y1={H / 2 - (i % 5 === 0 ? 12 : 6)} x2={x} y2={H / 2 + (i % 5 === 0 ? 12 : 6)} stroke="#7dd3fc" strokeWidth="1" />
          })}
          {[['a', a], ['b', b]].map(([k, x]) => (
            <g key={k} style={{ cursor: 'ew-resize' }} onPointerDown={(e) => { e.preventDefault(); drag.current = k }} data-gauge={k}>
              <line x1={x} y1={H / 2 - 40} x2={x} y2={H / 2 + 40} stroke="#FFD066" strokeWidth="3" />
              <circle cx={x} cy={H / 2 - 46} r="11" fill="#FFD066" stroke="#000" strokeWidth="2" />
              <rect x={x - 14} y={H / 2 - 60} width="28" height="120" fill="transparent" />
            </g>
          ))}
          <rect x={(a + b) / 2 - 70} y={H / 2 + 22} width="140" height="28" rx="5" fill="#000" opacity="0.8" />
          <text x={(a + b) / 2} y={H / 2 + 41} textAnchor="middle" fontSize="16" fontWeight="700" fill="#FFD066" className="num">{px} พิกเซล</text>
        </svg>
        <div className="font-thai mt-1.5 text-[11px] text-slate-400">ลากเส้นสีเหลืองทั้งสองข้างไปวางที่ขอบน้ำ (ไม่ใช่ขอบตลิ่ง) · ขีดเล็กทุก 2 พิกเซล ขีดยาวทุก 10 พิกเซล</div>
        <div className="mt-3 grid grid-cols-[1fr_300px] gap-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <div className="font-thai text-[13px] font-bold text-white">สูตร</div>
            <div className="num mt-1 text-[14px] text-sky-200">ความกว้าง (ม.) = จำนวนพิกเซล × {THEOS2.panM} ม./พิกเซล</div>
            <div className="num text-[14px] text-sky-200">N = 1 − ความกว้าง ÷ {THRESHOLDS.origChannelWidth}</div>
            {mode.tutor && <div className="font-thai mt-2 text-[12px] leading-snug text-[#FFE0A3]">ตัวอย่างวิธีคิด: ถ้าวัดได้ 40 พิกเซล → 40 × 0.5 = 20 ม. → N = 1 − 20 ÷ 150 = 0.87 · ค่า 0.5 ม. และ 150 ม. ดูได้ในแท็บ "ดาวเทียม" ทางซ้าย</div>}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            <label className="font-thai text-[12px] text-slate-300">ค่า N ที่คำนวณได้ (ทศนิยม 2 ตำแหน่ง)</label>
            <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="เช่น 0.83" inputMode="decimal" data-n-input
              className="num mt-1 w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-[18px] text-white outline-none focus:border-sky-400" />
            <Btn variant="primary" className="mt-2 w-full" icon={Check} onClick={submit} disabled={s.channel.measured}><span className="font-thai normal-case tracking-normal">ส่งค่า N</span></Btn>
            {res === 'ok' || s.channel.measured ? <div className="font-thai mt-2 text-[12px] font-bold text-[#7CFFA0]">ถูกต้อง — N เข้าสู่ SFVI แล้ว</div>
              : res === 'bad' ? <div className="font-thai mt-2 text-[12px] text-[#FF9DB2]">ยังไม่ถูก ลองวางเส้นวัดที่ขอบน้ำใหม่ แล้วคำนวณอีกครั้ง</div> : null}
          </div>
        </div>
        <div className="mt-3 flex justify-end"><Btn variant="solid" onClick={onClose}><span className="font-thai normal-case tracking-normal">ปิด</span></Btn></div>
      </div>
    </Modal>
  )
}
