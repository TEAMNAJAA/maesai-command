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
import { useMode } from '../ui/label'
import { THEOS2, THRESHOLDS } from '../config/missionConfig'
import { SECTORS } from '../config/scenarioData'
import { mulberry32 } from '../lib/rng'
import { TOWN_TARGET } from '../lib/scenario'
import { clamp, clockLabel } from '../lib/format'

const VW = 760, VH = 440

/* ── Synthetic sector scene ──────────────────────────────────────────────── */

function useScene(sectorId, seed) {
  return useMemo(() => {
    const r = mulberry32((seed * 31 + sectorId.charCodeAt(0) * 977) >>> 0)
    const canopy = Array.from({ length: 1700 }, () => ({ x: r() * VW, y: r() * VH, r: 2 + r() * 4.5, t: r() }))
    const ridges = Array.from({ length: 7 }, (_, i) => {
      const y0 = 40 + i * 60 + r() * 20
      let d = `M -20 ${y0}`
      for (let x = 0; x <= VW + 40; x += 60) d += ` Q ${x + 30} ${y0 + (r() - 0.5) * 70} ${x + 60} ${y0 + (r() - 0.5) * 40}`
      return d
    })
    const riverY = VH * (0.62 + (r() - 0.5) * 0.2)
    let river = `M -20 ${riverY}`
    for (let x = 0; x <= VW + 40; x += 80) river += ` Q ${x + 40} ${riverY + (r() - 0.5) * 90} ${x + 80} ${riverY + (r() - 0.5) * 50}`
    const roadY = VH * 0.3 + r() * 40
    const road = `M -10 ${roadY} C ${VW * 0.3} ${roadY + 60}, ${VW * 0.6} ${roadY - 50}, ${VW + 10} ${roadY + 20}`
    return { canopy, ridges, river, road }
  }, [sectorId, seed])
}

function Candidate({ c, after }) {
  const x = c.x * VW, y = c.y * VH, L = c.len * VW
  if (c.kind === 'scar') {
    if (!after) return null
    return (
      <g transform={`rotate(${c.rot + 90} ${x} ${y})`}>
        <path d={`M ${x - 5} ${y - L / 2} Q ${x + 7} ${y} ${x - 2} ${y + L / 2} L ${x + 9} ${y + L / 2 + 6} Q ${x + 14} ${y} ${x + 6} ${y - L / 2} Z`} fill="#a4572f" />
        <path d={`M ${x - 3} ${y - L / 2} L ${x + 5} ${y - L / 2 - 3}`} stroke="#d99a68" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx={x + 3} cy={y + L / 2 + 5} rx="12" ry="6" fill="#b9733f" opacity="0.85" />
      </g>
    )
  }
  if (c.kind === 'old') {
    return (
      <g transform={`rotate(${c.rot + 90} ${x} ${y})`} opacity="0.75">
        <path d={`M ${x - 4} ${y - L / 2} Q ${x + 6} ${y} ${x - 1} ${y + L / 2} L ${x + 8} ${y + L / 2 + 4} Q ${x + 12} ${y} ${x + 5} ${y - L / 2} Z`} fill="#6f6a3a" />
      </g>
    )
  }
  if (c.kind === 'field') {
    const w = L * 0.9, h = L * 0.6
    return (
      <g transform={`rotate(${c.rot} ${x} ${y})`}>
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} fill="#c4a96b" stroke="#8a7748" strokeWidth="1" />
        {Array.from({ length: 6 }, (_, i) => <line key={i} x1={x - w / 2} y1={y - h / 2 + ((i + 0.5) * h) / 6} x2={x + w / 2} y2={y - h / 2 + ((i + 0.5) * h) / 6} stroke="#a58c55" strokeWidth="1" />)}
      </g>
    )
  }
  if (!after) return null   // cloud shadow — only in this pass
  return (
    <g>
      <ellipse cx={x + 26} cy={y - 30} rx={L * 0.55} ry={L * 0.32} fill="#f1f5f9" opacity="0.9" filter="url(#cl-blur)" />
      <ellipse cx={x} cy={y} rx={L * 0.5} ry={L * 0.3} fill="#2a3540" opacity="0.72" filter="url(#cl-blur)" />
    </g>
  )
}

/** Rendered once per image; the before/after slider only moves a clip on the wrapper (no re-render while dragging). */
const SectorImage = React.memo(function SectorImage({ sceneId, seed, cands, after }) {
  const sc = useScene(sceneId, seed)
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
      <defs>
        <filter id="cl-blur"><feGaussianBlur stdDeviation="5" /></filter>
        <filter id="sat-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="4" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" />
        </filter>
        <linearGradient id="valley" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#264d2a" /><stop offset="1" stopColor="#1c3b22" /></linearGradient>
      </defs>
      <rect width={VW} height={VH} fill="url(#valley)" />
      {sc.ridges.map((d, i) => <path key={i} d={d} stroke="#10261a" strokeWidth="14" fill="none" opacity="0.35" />)}
      {sc.canopy.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={c.t > 0.55 ? '#3f7a43' : '#2a5a31'} opacity={0.55 + c.t * 0.4} />)}
      <path d={sc.road} stroke="#b9ad92" strokeWidth="3" fill="none" opacity="0.7" />
      <path d={sc.river} stroke={after ? '#7a6a4c' : '#3c6b7d'} strokeWidth={after ? 15 : 10} fill="none" opacity="0.95" />
      {cands.map((c) => <Candidate key={c.id} c={c} after={after} />)}
      <rect width={VW} height={VH} filter="url(#sat-grain)" opacity="0.13" style={{ mixBlendMode: 'overlay' }} />
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
            <h2 className="font-thai text-[18px] font-bold text-white">แปลภาพ {sec?.label} · {sec?.th} — หารอยดินถล่ม "ใหม่"</h2>
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
  const banks = useMemo(() => {
    const r = mulberry32(scn.seed)
    return Array.from({ length: 70 }, () => ({ x: r() < 0.5 ? r() * (left0 - 20) : left0 + riverPx + 20 + r() * (W - left0 - riverPx - 20), y: r() * H, w: 14 + r() * 28, h: 10 + r() * 20, t: r() }))
  }, [scn.seed]) // eslint-disable-line react-hooks/exhaustive-deps
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
            <h2 className="font-thai text-[18px] font-bold text-white">วัดความกว้างลำน้ำสาย แล้วคำนวณค่า N เอง</h2>
          </div>
          <span className="ml-auto"><Src t="image" /></span>
        </div>
        <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full select-none rounded-lg border border-white/15 bg-[#1b1b1b]" style={{ filter: 'grayscale(1) contrast(1.15)' }}>
          {banks.map((k, i) => <rect key={i} x={k.x} y={k.y} width={k.w} height={k.h} fill={k.t > 0.6 ? '#9a9a9a' : k.t > 0.3 ? '#6e6e6e' : '#4f4f4f'} transform={`rotate(${(k.t - 0.5) * 30} ${k.x} ${k.y})`} />)}
          <rect x={left0 - 14} y="0" width="14" height={H} fill="#8c8c8c" />
          <rect x={left0 + riverPx} y="0" width="14" height={H} fill="#8c8c8c" />
          <rect x={left0} y="0" width={riverPx} height={H} fill="#3a3a3a" />
          {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M ${left0 + 10} ${20 + i * 40} q ${riverPx / 4} 8 ${riverPx / 2} 0 t ${riverPx / 2 - 20} 0`} stroke="#555" strokeWidth="2" fill="none" />)}
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
