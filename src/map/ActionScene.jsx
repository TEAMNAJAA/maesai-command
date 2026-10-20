/* ══════════════════════════════════════════════════════════════════════════
   ACTION SCENES (B7) — short, skippable scenes when the player sends a boat or a drone
   • เรือ: chibi สั่งการ → เรือออกตามเส้นทางที่เลือก (คลื่นหัวเรือ)
     เส้นทางผิด → เรือล่ม (น้ำเชี่ยว) หรือ เรือโดนไฟช็อต (ไฟรั่ว) — ลูกเรือรอดเสมอ → การ์ดความรู้
   • โดรน: chibi ปล่อยโดรน → มุมกล้องโดรนสแกนโซน
   ผลทุกอย่างมาจาก engine (actions.dispatchBoat) — ฉากแค่แสดง · ?speed เร่ง · คลิกข้าม
   โหมดฝึกเจ้าหน้าที่: ไม่มีฉาก chibi/ตลก — เหลือการ์ดความรู้แบบเรียบ (ประกายไฟ + ข้อความ)
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo, useState } from 'react'
import { Ship, Plane, Zap, Waves, HeartPulse, LifeBuoy, MousePointerClick, BookOpen, Monitor } from 'lucide-react'
import { Chibi } from '../ui/chibi'
import { useProfile } from '../lib/profile'
import { prefs } from '../lib/prefs'
import { fx } from '../lib/fx'
import { audio } from '../lib/audio'
import { BOAT_INCIDENT, DURATIONS } from '../config/missionConfig'
import { SECTION_BY_ID } from '../lib/sections'
import { BUILDINGS } from '../lib/buildings'
import { alongRoute } from '../lib/routes'
import { KNOWLEDGE } from '../config/scenarioData'
import { osmRoads, saiRiver, makeProjection, boxKm, tilesFor } from '../lib/geo'
import { sphereReady, sphereTileTemplate } from '../lib/sphere'

const SPEED = typeof window !== 'undefined' ? Math.max(0.2, Number(new URLSearchParams(window.location.search).get('speed')) || 1) : 1
const W = 720, H = 360

/** Fit lon/lat coordinates into the scene (keeps the aspect, never closer in than `minM` across).
    Returns pt(lonlat) → [x, y] with pt.box = the visible [west, south, east, north]. */
function fit(coords, pad = 40, minM = 900) {
  const lat0 = coords.reduce((a, c) => a + c[1], 0) / coords.length
  const kx = Math.cos((lat0 * Math.PI) / 180)
  const X = coords.map((c) => c[0] * kx), Y = coords.map((c) => c[1])
  const deg = minM / 111320
  const sw = Math.max(deg, Math.max(...X) - Math.min(...X)), sh = Math.max(deg * 0.5, Math.max(...Y) - Math.min(...Y))
  const Xc = (Math.max(...X) + Math.min(...X)) / 2, Yc = (Math.max(...Y) + Math.min(...Y)) / 2
  const sc = Math.min((W - pad * 2) / sw, (H - pad * 2) / sh)
  const pt = (c) => [W / 2 + (c[0] * kx - Xc) * sc, H / 2 - (c[1] - Yc) * sc]
  pt.box = [(Xc - W / 2 / sc) / kx, Yc - H / 2 / sc, (Xc + W / 2 / sc) / kx, Yc + H / 2 / sc]
  pt.mPx = sc / 111320                                     // pixels per metre
  return pt
}
const inBox = (c, b) => c[0] >= b[0] && c[0] <= b[2] && c[1] >= b[1] && c[1] <= b[3]
const pathOf = (coords, pt, close = false) => coords.map((c, i) => { const [x, y] = pt(c); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}` }).join('') + (close ? 'Z' : '')

/** Shrink the scene on small screens (it is drawn at 870 × 400). */
function useFitScale() {
  const get = () => (typeof window === 'undefined' ? 1 : Math.min(1, (window.innerWidth - 32) / (W + 152), (window.innerHeight - 40) / (H + 44)))
  const [k, setK] = useState(get)
  useEffect(() => { const h = () => setK(get()); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h) }, [])
  return k
}

function useProgress(dur, key) {
  const [p, setP] = useState(0)
  useEffect(() => {
    let raf, t0 = performance.now()
    // a frame timestamp can be a hair earlier than t0 — never let progress go negative
    const tick = (t) => { const k = Math.max(0, Math.min(1, (t - t0) / dur)); setP(k); if (k < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    // no frames in a page that is not being drawn — the scene still ends on time
    const done = setTimeout(() => { cancelAnimationFrame(raf); setP(1) }, dur + 400)
    return () => { cancelAnimationFrame(raf); clearTimeout(done) }
  }, [dur, key])
  return p
}

/** The real town under flood water: GISTDA roof footprints, OSM streets under water, the Sai River running fast.
    Drawn once per scene (memo) — only the boat/drone layer animates. */
const Backdrop = React.memo(function Backdrop({ pt, tint = 'flood' }) {
  const b = pt.box
  const roofs = useMemo(() => {
    let d = '', n = 0
    for (const r of BUILDINGS) { if (n > 3200) break; if (inBox(r.c, b)) { d += pathOf(r.ring, pt, true); n++ } }
    return d
  }, [pt]) // eslint-disable-line react-hooks/exhaustive-deps
  const roads = useMemo(() => osmRoads.filter((f) => f.geometry.coordinates.some((c) => inBox(c, b))).map((f) => pathOf(f.geometry.coordinates, pt)).join(''), [pt]) // eslint-disable-line react-hooks/exhaustive-deps
  const river = useMemo(() => saiRiver.filter((f) => f.geometry.coordinates.some((c) => inBox(c, b))).map((f) => pathOf(f.geometry.coordinates, pt)).join(''), [pt]) // eslint-disable-line react-hooks/exhaustive-deps
  const riverW = Math.max(8, 26 * pt.mPx)
  const cam = tint === 'camera'
  return (
    <g>
      <defs>
        <linearGradient id="as-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={cam ? '#203a33' : '#0d4064'} /><stop offset="1" stopColor={cam ? '#14261f' : '#072a45'} /></linearGradient>
        <pattern id="as-waves" width="60" height="22" patternUnits="userSpaceOnUse">
          <path d="M0 11 Q15 4 30 11 T60 11" stroke="#7dd3fc" strokeOpacity="0.16" strokeWidth="1.3" fill="none" />
          <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="60 0" dur="4s" repeatCount="indefinite" />
        </pattern>
        <radialGradient id="as-vig" cx="50%" cy="50%" r="70%"><stop offset="0.6" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.55" /></radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#as-water)" />
      <path d={roads} fill="none" stroke="#9fd8f5" strokeOpacity="0.07" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <rect width={W} height={H} fill="url(#as-waves)" />
      {river && (
        <g>
          <path d={river} fill="none" stroke="#04182a" strokeOpacity="0.85" strokeWidth={riverW} strokeLinecap="round" strokeLinejoin="round" />
          <path d={river} fill="none" stroke="#e0f2fe" strokeOpacity="0.55" strokeWidth="1.6" strokeDasharray="10 16">
            <animate attributeName="stroke-dashoffset" from="0" to="-52" dur="0.9s" repeatCount="indefinite" />
          </path>
        </g>
      )}
      <path d={roofs} fill={cam ? '#8f9a88' : '#76839a'} fillOpacity="0.92" stroke="#e2e8f0" strokeOpacity="0.3" strokeWidth="0.5" />
      <rect width={W} height={H} fill="url(#as-vig)" />
      <text x={W - 10} y={H - 8} textAnchor="end" fontSize="9" fill="#94a3b8" opacity="0.8" className="font-thai">หลังคา: GISTDA BD_footprint · ถนน/แม่น้ำ: OSM · ระดับน้ำ: ค่าสถานการณ์</text>
    </g>
  )
})

function SceneAside({ pose, say }) {
  const me = useProfile()
  return (
    <div className="flex w-[150px] shrink-0 flex-col items-center justify-end border-l border-white/10 bg-[linear-gradient(180deg,#071426,#0c2340)] px-2 pb-1" data-scene-chibi={pose}>
      <div key={say} className="font-thai mb-1 w-full rounded-lg border border-sky-300/40 bg-[#081a30] px-2 py-1.5 text-center text-[12.5px] font-semibold leading-snug text-sky-50 animate-[bubblePop_.25s_ease-out]">{say}</div>
      <Chibi profile={me} pose={pose} size={112} />
    </div>
  )
}

function BoatHull({ x, y, ang, tilt = 0, flip = false, crew = 'ok', officer }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${ang}) rotate(${tilt}) scale(1 ${flip ? -1 : 1})`}>
      <ellipse cx="-2" cy="2" rx="22" ry="10" fill="#000" opacity="0.3" />
      <path d="M-18 -8 L12 -8 Q22 0 12 8 L-18 8 Z" fill="#f97316" stroke="#fff" strokeWidth="1.6" />
      <rect x="-14" y="-4" width="14" height="8" rx="2" fill="#7c2d12" />
      {/* the crew (top view): two heads in helmets */}
      {crew === 'ok' && [-9, -2].map((cx) => <circle key={cx} cx={cx} cy="0" r="3.2" fill="#facc15" stroke="#000" strokeWidth="0.6" />)}
      {crew === 'skeleton' && !officer && [-9, -2].map((cx) => (
        <g key={cx}><circle cx={cx} cy="0" r="3.6" fill="#f8fafc" /><circle cx={cx - 1.2} cy="-0.6" r="0.9" fill="#000" /><circle cx={cx + 1.2} cy="-0.6" r="0.9" fill="#000" /><path d={`M${cx - 1.4} 1.6 L${cx + 1.4} 1.6`} stroke="#000" strokeWidth="0.5" /></g>
      ))}
      {crew === 'sooty' && [-9, -2].map((cx) => (
        <g key={cx}>
          <path d={`M${cx - 3} -2 L${cx - 2} -5.5 L${cx - 0.6} -2.5 L${cx} -6 L${cx + 0.8} -2.5 L${cx + 2.2} -5.4 L${cx + 3} -2`} fill="#111" />
          <circle cx={cx} cy="0" r="3.2" fill="#1f2937" stroke="#000" strokeWidth="0.6" />
          {!officer && <g style={{ transformOrigin: `${cx}px 0px`, animation: 'chibiSpin .6s linear infinite' }}><path d={`M${cx - 1.6} -0.3 a 0.8 0.8 0 1 1 0.8 0.8`} stroke="#fff" strokeWidth="0.6" fill="none" /><path d={`M${cx + 0.4} -0.3 a 0.8 0.8 0 1 1 0.8 0.8`} stroke="#fff" strokeWidth="0.6" fill="none" /></g>}
        </g>
      ))}
    </g>
  )
}

/** Close-up of the crew after the hit — big enough to read (the top-view boat is small). */
function CrewCloseUp({ kind, k, officer, at }) {
  if (officer) return null
  const skeleton = kind === 'shock' && k < 0.08 + 0.3 / (4.4 * 0.55)
  // beside the boat, on the side with more room, kept inside the scene
  const cx = Math.min(W - 64, Math.max(64, at[0] + (at[0] < W / 2 ? 96 : -96)))
  const cy = Math.min(H - 150, Math.max(62, at[1] - 70))
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r="52" fill="#020814" fillOpacity="0.85" stroke={kind === 'shock' ? '#FDE047' : '#7DD3FC'} strokeWidth="2" />
      <clipPath id="as-cu"><circle r="50" /></clipPath>
      <g clipPath="url(#as-cu)">
        {kind === 'shock' ? (
          skeleton ? (
            <g>
              <rect x="-60" y="-60" width="120" height="120" fill="#fde047" opacity={Math.floor(k * 60) % 2 ? 0.9 : 0.4} />
              <circle cy="-8" r="20" fill="#f8fafc" /><circle cx="-7" cy="-11" r="5" fill="#000" /><circle cx="7" cy="-11" r="5" fill="#000" /><path d="M-2 -2 L2 -2 L0 2Z" fill="#000" />
              <path d="M-9 6 h18 M-7 6 v4 M-2 6 v4 M3 6 v4 M8 6 v4" stroke="#000" strokeWidth="1.4" />
              <path d="M0 12 v26 M-14 18 h28 M-12 24 h24 M-10 30 h20" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" />
            </g>
          ) : (
            <g>
              <rect x="-60" y="-60" width="120" height="120" fill="#1e293b" />
              {/* spiky singed hair, sooty face, spinning eyes, a puff of smoke — alive and grumpy */}
              <path d="M-22 -14 L-18 -36 L-10 -20 L-4 -42 L2 -21 L10 -40 L14 -20 L22 -34 L22 -12 Z" fill="#111" />
              <circle cy="-4" r="20" fill="#3f3f46" /><ellipse cx="-12" cy="4" rx="4" ry="2.4" fill="#f87171" opacity="0.5" /><ellipse cx="12" cy="4" rx="4" ry="2.4" fill="#f87171" opacity="0.5" />
              {[-7, 7].map((cx) => <g key={cx} style={{ transformOrigin: `${cx}px -6px`, animation: 'chibiSpin .5s linear infinite' }}><path d={`M${cx - 4} -6 a 4 4 0 1 1 4 4 a 2 2 0 1 1 -2 -2`} stroke="#fff" strokeWidth="1.6" fill="none" /></g>)}
              <path d="M-5 8 q5 -3 10 0" stroke="#111" strokeWidth="1.6" fill="none" />
              {[0, 1, 2].map((i) => <circle key={i} cx={14 + i * 6} cy={-30 - i * 7 - k * 10} r={4 + i * 1.5} fill="#94a3b8" opacity={0.55 - i * 0.12} />)}
            </g>
          )
        ) : (
          <g>
            <rect x="-60" y="-60" width="120" height="120" fill="#0d4064" />
            <path d="M-60 6 Q-40 -2 -20 6 T20 6 T60 6 V60 H-60Z" fill="#0a3352" />
            <g transform={`translate(0 ${Math.sin(k * 18) * 3})`}>
              <circle cy="4" r="22" fill="none" stroke="#f97316" strokeWidth="9" /><circle cy="4" r="22" fill="none" stroke="#fff" strokeWidth="9" strokeDasharray="10 13" />
              <circle cy="-6" r="13" fill="#facc15" stroke="#000" strokeWidth="1" />
              <circle cx="-4" cy="-7" r="1.6" fill="#000" /><circle cx="4" cy="-7" r="1.6" fill="#000" /><path d="M-3 -1 q3 2 6 0" stroke="#000" strokeWidth="1.2" fill="none" />
              <path d="M10 -10 l4 -5" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round" />
            </g>
            <path d="M-50 18 Q-30 10 -10 18 T30 18 T60 18" stroke="#e0f2fe" strokeOpacity="0.6" strokeWidth="2" fill="none" />
          </g>
        )}
      </g>
      <text y="68" textAnchor="middle" fontSize="11" fontWeight="800" fill={kind === 'shock' ? '#FEF08A' : '#BAE6FD'} className="font-thai">{kind === 'shock' ? (skeleton ? 'ซซซ่า!!' : 'รอด… แต่ต้องไป รพ.') : 'ลอยคอ รอทีมช่วย'}</text>
    </g>
  )
}

function BoatScene({ ev, officer, onDone }) {
  const outcome = ev.outcome
  const dur = (outcome === 'ok' ? 2600 : 4400) / SPEED
  const p = useProgress(dur, ev.id)
  useEffect(() => { if (p >= 1) onDone() }, [p >= 1]) // eslint-disable-line react-hooks/exhaustive-deps
  const out = useMemo(() => ev.coords.slice(0, ev.splitAt || ev.coords.length), [ev.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const pt = useMemo(() => fit(out), [out])
  const path = useMemo(() => pathOf(out, pt), [out, pt])
  // travel phase: the whole leg (ok) or up to the hazard (incident)
  const stopAt = outcome === 'ok' ? 1 : BOAT_INCIDENT.hazardAt
  const tp = outcome === 'ok' ? Math.min(1, p / 0.9) : Math.min(1, p / 0.45)
  const pos = alongRoute(out, tp * stopAt) || out[0]
  const ahead = alongRoute(out, Math.min(1, tp * stopAt + 0.02)) || out[out.length - 1]
  const [x, y] = pt(pos), [ax, ay] = pt(ahead)
  const ang = (Math.atan2(ay - y, ax - x) * 180) / Math.PI
  const [ex, ey] = pt(out[out.length - 1])
  const [hx, hy] = pt(alongRoute(out, BOAT_INCIDENT.hazardAt) || out[0])
  const hit = outcome !== 'ok' && p > 0.45
  const k = hit ? (p - 0.45) / 0.55 : 0
  // incident animation
  const tilt = outcome === 'capsize' && hit ? Math.sin(k * 30) * 25 * Math.min(1, k * 3) : 0
  const flip = outcome === 'capsize' && k > 0.38
  const sink = outcome === 'capsize' && k > 0.38 ? Math.min(1, (k - 0.38) / 0.3) : 0
  const crew = outcome === 'shock' && hit ? (k < 0.08 ? 'ok' : k < 0.08 + 0.3 / (4.4 * 0.55) ? 'skeleton' : 'sooty') : 'ok'
  const flash = outcome === 'shock' && hit && k < 0.35 && Math.floor(k * 40) % 2 === 0
  const pose = !hit ? (p < 0.18 ? 'clipboard' : 'point') : 'shock'
  const say = !hit ? (p < 0.18 ? `${ev.boat} → ${ev.point} ตามเส้นทางที่เลือก` : 'ออกเรือ!') : outcome === 'shock' ? 'ไฟรั่ว! ต้องตัดไฟก่อน…' : 'น้ำเชี่ยวเกินไป!'
  return (
    <div className="flex">
      <div className="relative overflow-hidden" style={{ width: W, height: H }}>
        <svg width={W} height={H} className="absolute inset-0">
          <Backdrop pt={pt} />
          <path d={path} fill="none" stroke="#000" strokeOpacity="0.45" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d={path} fill="none" stroke="#FFB27A" strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" />
          {/* the hazard the chosen route crosses — fixed on the map */}
          {outcome === 'shock' && (
            <g transform={`translate(${hx} ${hy})`}>
              <circle r="30" fill="#fde047" opacity={0.12 + (Math.floor(p * 24) % 2) * 0.1} />
              <circle r="30" fill="none" stroke="#fde047" strokeWidth="1.4" strokeDasharray="4 4" opacity="0.8" />
              <text x="-9" y="8" fontSize="22">⚡</text>
              {hit && k < 0.6 && [0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${-26 + i * 9} -26 l6 10 l-6 4 l7 12`} stroke="#fde047" strokeWidth="2.4" fill="none" opacity={(Math.floor(k * 60 + i) % 3) ? 1 : 0.2} />)}
            </g>
          )}
          {outcome === 'capsize' && (
            <g transform={`translate(${hx} ${hy})`} opacity="0.9">
              {[0, 1, 2].map((i) => <path key={i} d={`M${-26 + i * 6} ${-12 + i * 12} q 12 -10 24 0 t 24 0`} stroke="#e0f2fe" strokeWidth="2" fill="none" strokeDasharray="6 5"><animate attributeName="stroke-dashoffset" from="0" to="-22" dur={`${0.5 + i * 0.15}s`} repeatCount="indefinite" /></path>)}
            </g>
          )}
          {/* destination: the stranded group signalling */}
          <g transform={`translate(${ex} ${ey})`}>
            <circle r="16" fill="none" stroke="#FF3B63" strokeWidth="2" className="animate-[pulsering_1.4s_ease-out_infinite]" style={{ transformOrigin: '0 0' }} />
            <circle r="7" fill="#FF3B63" stroke="#fff" strokeWidth="1.6" />
            <text y="-14" textAnchor="middle" fontSize="11" fontWeight="900" fill="#FFB3C2" className="animate-[flash_1s_steps(2)_infinite]">SOS</text>
            <text y="24" textAnchor="middle" fontSize="10" fontWeight="700" fill="#FFE4EA" className="num">{ev.point}</text>
          </g>
          {/* wake: a V behind the bow + foam */}
          {!hit && tp < 1 && (
            <g transform={`translate(${x} ${y}) rotate(${ang})`} opacity="0.9">
              <path d="M-16 -7 L-46 -20 M-16 7 L-46 20" stroke="#e0f2fe" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
              {[0, 1, 2, 3].map((i) => <circle key={i} cx={-22 - i * 9} cy={(i % 2 ? 1 : -1) * (3 + i * 2)} r={2.2 - i * 0.4} fill="#fff" opacity={0.6 - i * 0.12} />)}
            </g>
          )}
          {outcome === 'capsize' && hit && [0, 1, 2].map((i) => (
            <circle key={i} cx={x} cy={y} r={10 + k * 60 + i * 12} fill="none" stroke="#e0f2fe" strokeWidth={2.4 - i * 0.6} opacity={Math.max(0, 0.8 - k - i * 0.2)} />
          ))}
          <g opacity={1 - sink}><BoatHull x={x} y={y} ang={ang} tilt={tilt} flip={flip} crew={crew} officer={officer} /></g>
          {/* capsize: crew afloat in life rings */}
          {outcome === 'capsize' && k > 0.45 && [[-26, 14], [24, -10]].map(([dx, dy], i) => (
            <g key={i} transform={`translate(${x + dx} ${y + dy + Math.sin(k * 20 + i) * 2})`}>
              <circle r="7" fill="none" stroke="#f97316" strokeWidth="4" /><circle r="7" fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="4 7" />
              <circle r="3.2" fill="#facc15" stroke="#000" strokeWidth="0.6" />
            </g>
          ))}
          {hit && k > 0.06 && <CrewCloseUp kind={outcome} k={k} officer={officer} at={[hx, hy]} />}
          {flash && <rect width={W} height={H} fill="#fff" opacity="0.55" />}
          {/* ambulance after a shock */}
          {outcome === 'shock' && k > 0.55 && <g transform={`translate(${W - 110} ${H - 64})`}><rect x="0" y="0" width="64" height="30" rx="5" fill="#f8fafc" /><rect x="40" y="6" width="20" height="12" rx="2" fill="#7dd3fc" /><path d="M14 9 L14 21 M8 15 L20 15" stroke="#dc2626" strokeWidth="4" /><circle cx="14" cy="32" r="5" fill="#111" /><circle cx="50" cy="32" r="5" fill="#111" /><rect x="22" y="-5" width="10" height="5" rx="1" fill="#ef4444" className="animate-[flash_.5s_steps(2)_infinite]" /></g>}
        </svg>
        {hit && k > 0.62 && (
          <div className="font-thai absolute inset-x-0 bottom-4 mx-auto w-fit rounded-lg border px-4 py-2 text-center text-[14px] font-bold animate-[riseIn_.3s_ease-out]"
            style={{ borderColor: outcome === 'shock' ? '#FDE047' : '#7DD3FC', background: '#020814e6', color: outcome === 'shock' ? '#FEF08A' : '#BAE6FD' }}>
            {outcome === 'shock' ? `เรือ ${ev.boat} โดนไฟช็อต — ลูกเรือรอด ส่งโรงพยาบาล` : `เรือ ${ev.boat} ล่ม — ลูกเรือปลอดภัย ถูกช่วยขึ้นมาแล้ว`}
            <div className="text-[11.5px] font-semibold text-slate-300">เรือหยุดใช้งาน {Math.round(BOAT_INCIDENT[outcome].repairMin / 60)} ชม. · ผู้ติดค้าง {ev.point} ยังรออยู่ · ผิดร้ายแรง</div>
          </div>
        )}
      </div>
      {!officer && <SceneAside pose={pose} say={say} />}
    </div>
  )
}

function DroneScene({ ev, officer, onDone }) {
  const dur = 3200 / SPEED
  const p = useProgress(dur, ev.id)
  useEffect(() => { if (p >= 1) onDone() }, [p >= 1]) // eslint-disable-line react-hooks/exhaustive-deps
  const sec = SECTION_BY_ID[ev.section]
  const pt = useMemo(() => (sec ? fit(sec.hull, 30, 500) : null), [ev.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const hull = useMemo(() => (sec && pt ? pathOf(sec.hull, pt, true) : ''), [pt]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!sec || !pt) return null
  const launch = p < 0.3
  const k = launch ? p / 0.3 : (p - 0.3) / 0.7
  const scanY = 30 + ((k * 2) % 1) * (H - 60)
  // the camera drifts slowly across the zone
  const drift = `translate(${(0.5 - k) * 40} ${(0.5 - k) * 18}) scale(${1.04 + k * 0.06})`
  return (
    <div className="flex">
      <div className="relative overflow-hidden" style={{ width: W, height: H }}>
        <svg width={W} height={H} className="absolute inset-0">
          {launch ? (
            <g>
              <defs>
                <linearGradient id="dl-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0a1426" /><stop offset="1" stopColor="#1c3150" /></linearGradient>
                <linearGradient id="dl-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a5a6e" stopOpacity="0.92" /><stop offset="1" stopColor="#1d3344" stopOpacity="0.98" /></linearGradient>
              </defs>
              <rect width={W} height={H} fill="url(#dl-sky)" />
              {/* a flooded street: houses up to the windows in brown water */}
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const x0 = 18 + i * 118, hh = 70 + ((i * 37) % 3) * 14
                return (
                  <g key={i}>
                    <rect x={x0} y={H - 60 - hh} width="92" height={hh + 40} fill={['#334155', '#3f3a35', '#2f3e46'][i % 3]} stroke="#0f172a" />
                    <path d={`M${x0 - 8} ${H - 60 - hh} L${x0 + 46} ${H - 98 - hh} L${x0 + 100} ${H - 60 - hh} Z`} fill={['#7c2d12', '#475569', '#9a3412'][i % 3]} />
                    <rect x={x0 + 16} y={H - 40 - hh} width="22" height="18" fill="#fde68a" opacity={i % 2 ? 0.75 : 0.25} />
                    <rect x={x0 + 54} y={H - 40 - hh} width="22" height="18" fill="#fde68a" opacity={i % 2 ? 0.2 : 0.7} />
                  </g>
                )
              })}
              <rect y={H - 78} width={W} height="78" fill="url(#dl-water)" />
              <path d={`M0 ${H - 78} Q ${W / 8} ${H - 84} ${W / 4} ${H - 78} T ${W / 2} ${H - 78} T ${(3 * W) / 4} ${H - 78} T ${W} ${H - 78}`} fill="none" stroke="#bae6fd" strokeOpacity="0.45" strokeWidth="2" />
              {Array.from({ length: 34 }, (_, i) => <line key={i} x1={(i * 53) % W} y1={(i * 97) % (H - 90)} x2={((i * 53) % W) - 7} y2={((i * 97) % (H - 90)) + 22} stroke="#cbd5e1" strokeOpacity="0.35" strokeWidth="1.2"><animateTransform attributeName="transform" type="translate" from="0 -40" to="-14 60" dur={`${0.7 + (i % 5) * 0.08}s`} repeatCount="indefinite" /></line>)}
              <g transform={`translate(${W / 2 + 40 - k * 40} ${H - 70 - k * 170}) scale(${1.7 - k * 0.6})`}>
                <ellipse cx="0" cy="14" rx="18" ry="3" fill="#000" opacity={0.3 * (1 - k)} />
                <rect x="-16" y="-4" width="32" height="8" rx="3" fill="#e2e8f0" />
                <rect x="-5" y="4" width="10" height="5" rx="1.5" fill="#334155" />
                <path d="M-16 0 L-26 -6 M16 0 L26 -6" stroke="#94a3b8" strokeWidth="2" />
                {[-26, 26].map((dx) => <ellipse key={dx} cx={dx} cy="-8" rx="12" ry="2" fill="#cbd5e1" className="chibi-prop" />)}
                <circle cx="0" cy="6" r="2.4" fill="#22e36b" className="chibi-blink" />
              </g>
              <rect x={W / 2 - 200} y="18" width="400" height="58" rx="10" fill="#020814" opacity="0.55" />
              <text x={W / 2} y="44" textAnchor="middle" fontSize="16" fontWeight="800" fill="#e0f2fe" className="font-thai">ปล่อยโดรน {ev.drone} → โซน {ev.section}</text>
              <text x={W / 2} y="65" textAnchor="middle" fontSize="12" fill="#94a3b8" className="font-thai">{sec.name}</text>
            </g>
          ) : (
            <g>
              <g transform={drift} style={{ transformOrigin: `${W / 2}px ${H / 2}px` }}>
                <Backdrop pt={pt} tint="camera" />
                <path d={hull} fill="none" stroke="#7dd3fc" strokeWidth="1.6" strokeDasharray="6 5" />
              </g>
              <rect width={W} height={H} fill="#22e36b" opacity="0.05" />
              <line x1="0" y1={scanY} x2={W} y2={scanY} stroke="#22e36b" strokeWidth="2" opacity="0.8" />
              <rect x="0" y={scanY - 30} width={W} height="30" fill="url(#ds-scan)" />
              <defs><linearGradient id="ds-scan" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22e36b" stopOpacity="0" /><stop offset="1" stopColor="#22e36b" stopOpacity="0.18" /></linearGradient></defs>
              <g stroke="#e2e8f0" strokeWidth="1.4" fill="none" opacity="0.85">
                <path d={`M${W / 2 - 40} ${H / 2} h25 M${W / 2 + 15} ${H / 2} h25 M${W / 2} ${H / 2 - 40} v25 M${W / 2} ${H / 2 + 15} v25`} />
                <path d={`M20 40 v-20 h20 M${W - 20} 40 v-20 h-20 M20 ${H - 40} v20 h20 M${W - 20} ${H - 40} v20 h-20`} />
              </g>
              <rect y="42" width={W} height="42" fill="#020814" opacity="0.6" />
              <text x="30" y="58" fontSize="12" fontWeight="800" fill="#ef4444" className={Math.floor(p * 8) % 2 ? '' : 'opacity-40'}>● REC</text>
              <text x="30" y="76" fontSize="11" fill="#e2e8f0" className="num">UAV {ev.drone} · ALT 120 m · FOV 78° · ZONE {ev.section}</text>
              <text x={W - 30} y="58" textAnchor="end" fontSize="13" fontWeight="800" fill="#bbf7d0" className="font-thai">กำลังสแกนหาผู้ติดค้าง…</text>
              <text x={W - 30} y="76" textAnchor="end" fontSize="11" fill="#94a3b8" className="font-thai">ผลจะรายงานเมื่อโดรนบินครบ {DURATIONS.droneSortie} นาที</text>
            </g>
          )}
        </svg>
      </div>
      {!officer && <SceneAside pose="remote" say={launch ? 'ปล่อยโดรน!' : 'ส่องใต้เมฆ ซอยลึก…'} />}
    </div>
  )
}

/** B11: the EOC control room — the commander pulls the roof up on the big screen. Footprints only: the result is for the player to read. */
function ControlRoom({ ev, onDone }) {
  const p = useProgress(2800 / SPEED, ev.id)
  useEffect(() => { if (p >= 1) onDone() }, [p >= 1]) // eslint-disable-line react-hooks/exhaustive-deps
  const scr = { x: 150, y: 54, w: 420, h: 236 }
  // the same ~260 m view act 3 uses: the real Sphere image when online, GISTDA footprints either way
  const view = useMemo(() => {
    const proj = makeProjection(boxKm(ev.c[0], ev.c[1], 0.26, 0.26 * (scr.h / scr.w)), scr.w, scr.h, 0)
    const ring = (r) => r.map((q, i) => `${i ? 'L' : 'M'}${proj.pt(q).map((v) => v.toFixed(1)).join(' ')}`).join('') + 'Z'
    const [w0, s0, e0, n0] = proj.bbox
    let near = ''
    for (const x of BUILDINGS) if (x.c[0] > w0 && x.c[0] < e0 && x.c[1] > s0 && x.c[1] < n0) near += ring(x.ring)
    return { tiles: sphereReady() ? tilesFor(proj, sphereTileTemplate(), 16, 0, 18) : [], near, target: ring(ev.ring) }
  }, [ev.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const wipe = Math.min(1, Math.max(0, (p - 0.35) / 0.5))
  return (
    <div className="flex">
      <div className="relative overflow-hidden" style={{ width: W, height: H }}>
        <svg width={W} height={H} className="absolute inset-0">
          <defs>
            <linearGradient id="cr-room" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#07101f" /><stop offset="1" stopColor="#0b1a2e" /></linearGradient>
            <clipPath id="cr-big"><rect x={scr.x} y={scr.y} width={scr.w} height={scr.h} rx="6" /></clipPath>
          </defs>
          <rect width={W} height={H} fill="url(#cr-room)" />
          {/* the monitor wall */}
          {[0, 1, 2, 3].map((i) => [0, 1].map((j) => {
            const x = i < 2 ? 14 + i * 64 : W - 142 + (i - 2) * 64, y = 40 + j * 74
            const lab = ['RADARSAT-2', 'SFVI', 'Sphere', 'AWAGAD', 'L3 Ortho', 'GISTDA', 'ปภ.', '14 วัน'][i * 2 + j]
            return (
              <g key={`${i}${j}`}>
                <rect x={x} y={y} width="56" height="62" rx="4" fill="#0c2236" stroke="#1e3a5f" />
                {[0, 1, 2, 3].map((k) => <rect key={k} x={x + 6} y={y + 10 + k * 9} width={20 + ((i * 7 + j * 5 + k * 11) % 26)} height="4" fill={k % 2 ? '#38BDF8' : '#22E36B'} opacity={0.25 + ((Math.floor(p * 12) + k + i) % 3) * 0.2} />)}
                <text x={x + 28} y={y + 56} textAnchor="middle" fontSize="7.5" fill="#94a3b8" className="font-mono">{lab}</text>
              </g>
            )
          }))}
          {/* the big screen: before | after footprints with a wipe — no mud drawn here */}
          <rect x={scr.x - 6} y={scr.y - 6} width={scr.w + 12} height={scr.h + 12} rx="10" fill="#0a1a2c" stroke="#38bdf8" strokeOpacity="0.5" />
          <g clipPath="url(#cr-big)">
            <rect x={scr.x} y={scr.y} width={scr.w} height={scr.h} fill="#123024" />
            {Array.from({ length: 12 }, (_, i) => <line key={`v${i}`} x1={scr.x + (i + 1) * scr.w / 13} y1={scr.y} x2={scr.x + (i + 1) * scr.w / 13} y2={scr.y + scr.h} stroke="#38bdf8" strokeOpacity="0.07" />)}
            {Array.from({ length: 7 }, (_, i) => <line key={`h${i}`} x1={scr.x} y1={scr.y + (i + 1) * scr.h / 8} x2={scr.x + scr.w} y2={scr.y + (i + 1) * scr.h / 8} stroke="#38bdf8" strokeOpacity="0.07" />)}
            <g transform={`translate(${scr.x} ${scr.y})`}>
              {view.tiles.map((t) => <image key={t.key} href={t.href} x={t.x} y={t.y} width={t.w + 0.6} height={t.h + 0.6} preserveAspectRatio="none" />)}
              <path d={view.near} fill={view.tiles.length ? 'none' : '#7b8b7e'} fillOpacity="0.75" stroke="#e2e8f0" strokeOpacity={view.tiles.length ? 0.35 : 0.25} strokeWidth="0.6" />
              {/* "after": a general post-flood grade only — whether this house has mud is for the player to read in act 3 */}
              <rect x={scr.w * wipe} y="0" width={scr.w * (1 - wipe)} height={scr.h} fill="#6b5536" opacity="0.38" style={{ mixBlendMode: 'multiply' }} />
              <path d={view.target} fill="#FFD066" fillOpacity="0.2" stroke="#FFD066" strokeWidth="2" strokeDasharray="5 3" />
            </g>
            <line x1={scr.x + scr.w * wipe} y1={scr.y} x2={scr.x + scr.w * wipe} y2={scr.y + scr.h} stroke="#38BDF8" strokeWidth="2" />
            <text x={scr.x + 10} y={scr.y + 18} fontSize="11" fontWeight="700" fill="#e0f2fe" className="font-thai">ก่อน · Sphere</text>
            <text x={scr.x + scr.w - 10} y={scr.y + 18} textAnchor="end" fontSize="11" fontWeight="700" fill="#e0f2fe" className="font-thai">หลัง · THEOS-2 L3</text>
            <rect x={scr.x + 10} y={scr.y + scr.h - 22} width={(scr.w - 20) * Math.min(1, p / 0.8)} height="5" rx="2" fill="#22E36B" opacity="0.8" />
            <text x={scr.x + 10} y={scr.y + scr.h - 28} fontSize="10" fill="#bbf7d0" className="font-thai">{p < 0.35 ? 'ดาวน์โหลดภาพ L3 Ortho…' : p < 0.85 ? 'ซ้อนภาพก่อน/หลังน้ำ…' : 'พร้อมตรวจหลักฐาน'}</text>
          </g>
          {/* the desk */}
          <path d={`M0 ${H - 46} L${W} ${H - 46} L${W} ${H} L0 ${H} Z`} fill="#0e2033" />
          {Array.from({ length: 18 }, (_, i) => <circle key={i} cx={40 + i * 36} cy={H - 24} r="2.6" fill={['#22E36B', '#FFD066', '#38BDF8'][i % 3]} opacity={(Math.floor(p * 10 + i) % 4) ? 0.9 : 0.2} />)}
        </svg>
      </div>
      <SceneAside pose="monitor" say={p < 0.5 ? `เปิดภาพหลังคา ${ev.roof} บนจอใหญ่` : 'ดูโคลนรอบบ้าน + นับวันท่วมขังจากเรดาร์'} />
    </div>
  )
}

const card = (id, icon, title) => { const k = KNOWLEDGE.find((x) => x.id === id); return { icon, hex: k.hex, title, body: k.body, source: k.source } }
const KNOW = {
  shock: card('power', Zap, 'น้ำท่วมที่มีไฟรั่ว อันตรายถึงชีวิต'),
  capsize: card('current', Waves, 'กระแสน้ำเชี่ยว พลิกเรือขนาดเล็กได้'),
}

function KnowledgeCard({ kind, onClose }) {
  const K = KNOW[kind]
  return (
    <div className="w-[560px] overflow-hidden rounded-xl border-2 bg-[#06101f] shadow-[0_0_60px_-10px_rgba(0,0,0,.9)] animate-[riseIn_.3s_ease-out]" style={{ borderColor: `${K.hex}aa` }} data-knowledge={kind} onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ background: `linear-gradient(90deg, ${K.hex}30, transparent)` }}>
        <BookOpen size={15} style={{ color: K.hex }} /><span className="hud-label !text-[9px]" style={{ color: K.hex }}>การ์ดความรู้ · KNOWLEDGE</span>
      </div>
      <div className="flex gap-3 px-4 py-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border-2" style={{ borderColor: K.hex, background: `${K.hex}1a` }}><K.icon size={28} style={{ color: K.hex }} /></span>
        <div>
          <div className="font-thai text-[17px] font-bold text-white">{K.title}</div>
          <div className="font-thai mt-1 text-[13px] leading-relaxed text-slate-300">{K.body}</div>
          <div className="font-thai mt-1.5 text-[11px] text-slate-500">ที่มา: {K.source}</div>
        </div>
      </div>
      <div className="flex justify-end border-t border-white/[0.06] px-4 py-2.5">
        <button onClick={onClose} data-knowledge-ok className="btn border-[#22E36B]/70 bg-[#22E36B]/20 px-5 py-2 text-white hover:bg-[#22E36B]/30"><span className="font-thai normal-case tracking-normal text-[13px] font-bold">เข้าใจแล้ว</span></button>
      </div>
    </div>
  )
}

/** Queue of scenes from fx 'scene' events; shown one at a time over the map. */
export function ActionScenes() {
  const [queue, setQueue] = useState([])
  const [card, setCard] = useState(null)
  const fitScale = useFitScale()
  useEffect(() => fx.on('scene', (ev) => {
    const officer = prefs.get().officer
    if (officer && ev.kind === 'drone') return                        // officer mode: no show, just the log
    if (officer && ev.kind === 'boat' && ev.outcome === 'ok') return
    if (officer && ev.kind === 'control') return
    setQueue((q) => [...q, { ...ev, id: `${Date.now()}-${Math.random()}` }])
  }), [])
  const ev = queue[0]
  useEffect(() => {
    if (!ev) return
    if (ev.kind === 'boat') audio.play('boat')
    if (ev.kind === 'drone') audio.play('drone')
    if (ev.kind === 'boat' && ev.outcome !== 'ok') {
      const t = setTimeout(() => { audio.play(ev.outcome === 'shock' ? 'zap' : 'splash'); fx.emit('shake', { strength: ev.outcome === 'shock' ? 2 : 1.4 }) }, (4400 * 0.45) / SPEED)
      return () => clearTimeout(t)
    }
  }, [ev?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const officer = prefs.get().officer
  // ends the scene on screen once (the timer and a click can both call it)
  const done = () => {
    const id = ev?.id
    setQueue((q) => {
      if (!q[0] || q[0].id !== id) return q
      if (q[0].kind === 'boat' && q[0].outcome !== 'ok') setCard(q[0].outcome)
      return q.slice(1)
    })
  }
  // while a scene or card is up, Space/Enter/Esc only skip it (Space must not also jump the clock)
  const active = !!(ev || card)
  useEffect(() => {
    if (!active) return undefined
    const h = (e) => {
      if (!['Space', 'Enter', 'Escape', 'NumpadEnter'].includes(e.code)) return
      e.preventDefault(); e.stopImmediatePropagation()
      if (e.type !== 'keydown' || e.repeat) return
      if (queue[0]) done(); else setCard(null)
    }
    window.addEventListener('keydown', h, true)
    window.addEventListener('keyup', h, true)
    return () => { window.removeEventListener('keydown', h, true); window.removeEventListener('keyup', h, true) }
  })
  if (!ev && !card) return null
  if (!ev && card) {
    return (
      <div className="fixed inset-0 z-[86] grid place-items-center bg-black/55" data-action-scene="knowledge" onClick={() => setCard(null)}>
        <KnowledgeCard kind={card} onClose={() => setCard(null)} />
      </div>
    )
  }
  if (ev.kind === 'control') {
    return (
      <div className="fixed inset-0 z-[76] grid cursor-pointer place-items-center bg-black/55" data-action-scene="control" onClick={done} title="คลิกเพื่อข้าม">
        <div className="overflow-hidden rounded-xl border border-sky-400/45 bg-[#040a14] shadow-[0_0_80px_-12px_rgba(56,189,248,.75)]" style={{ transform: `scale(${fitScale})` }}>
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
            <Monitor size={15} className="text-sky-300" />
            <span className="font-thai text-[13px] font-bold text-white">ศูนย์ควบคุม EOC · เปิดภาพหลังคา {ev.roof}</span>
            <span className="font-thai ml-auto flex items-center gap-1 text-[11px] text-slate-400"><MousePointerClick size={12} />คลิกเพื่อข้าม</span>
          </div>
          <ControlRoom ev={ev} onDone={done} />
        </div>
      </div>
    )
  }
  const Icon = ev.kind === 'drone' ? Plane : ev.outcome === 'shock' ? Zap : ev.outcome === 'capsize' ? LifeBuoy : Ship
  const officerIncident = officer && ev.kind === 'boat'
  return (
    <div className="fixed inset-0 z-[76] grid cursor-pointer place-items-center bg-black/50" data-action-scene={ev.kind} data-outcome={ev.outcome || ''} onClick={done} title="คลิกเพื่อข้าม">
      <div className="overflow-hidden rounded-xl border border-sky-400/45 bg-[#040a14] shadow-[0_0_80px_-12px_rgba(56,189,248,.75)]" style={{ transform: `scale(${fitScale})` }}>
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
          <Icon size={15} className="text-sky-300" />
          <span className="font-thai text-[13px] font-bold text-white">{ev.kind === 'drone' ? `โดรน ${ev.drone} · โซน ${ev.section}` : `เรือ ${ev.boat} → ${ev.point}`}</span>
          {ev.kind === 'boat' && ev.outcome !== 'ok' && <span className="font-thai rounded bg-[#FF3B63]/20 px-1.5 text-[11px] font-bold text-[#FF9DB2]">เส้นทางผ่าน{ev.outcome === 'shock' ? 'ไฟรั่ว' : 'น้ำเชี่ยว'}</span>}
          {ev.kind === 'boat' && ev.outcome === 'shock' && <HeartPulse size={14} className="text-[#7dd3fc]" />}
          <span className="font-thai ml-auto flex items-center gap-1 text-[11px] text-slate-400"><MousePointerClick size={12} />คลิกเพื่อข้าม</span>
        </div>
        {officerIncident
          ? <OfficerIncident ev={ev} onDone={done} />
          : ev.kind === 'boat' ? <BoatScene ev={ev} officer={officer} onDone={done} /> : <DroneScene ev={ev} officer={officer} onDone={done} />}
      </div>
    </div>
  )
}

/** Officer mode: no chibi, no cartoon — sparks or spray and the facts. */
function OfficerIncident({ ev, onDone }) {
  const p = useProgress(2400 / SPEED, ev.id)
  useEffect(() => { if (p >= 1) onDone() }, [p >= 1]) // eslint-disable-line react-hooks/exhaustive-deps
  const shock = ev.outcome === 'shock'
  return (
    <div className="grid place-items-center px-10 py-8" style={{ width: W }}>
      <svg width="220" height="90">
        {shock ? [0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${40 + i * 30} 10 l10 25 l-10 8 l12 30`} stroke="#fde047" strokeWidth="3" fill="none" opacity={Math.floor(p * 30 + i) % 3 ? 1 : 0.25} />)
          : [0, 1, 2].map((i) => <circle key={i} cx="110" cy="45" r={10 + p * 40 + i * 10} fill="none" stroke="#7dd3fc" strokeWidth="2" opacity={Math.max(0, 0.8 - p - i * 0.2)} />)}
      </svg>
      <div className="font-thai mt-2 text-center text-[15px] font-bold text-white">{shock ? `เรือ ${ev.boat} สัมผัสกระแสไฟรั่ว — ลูกเรือส่งโรงพยาบาล` : `เรือ ${ev.boat} ล่มจากกระแสน้ำเชี่ยว — ลูกเรือปลอดภัย`}</div>
      <div className="font-thai mt-1 text-[12.5px] text-slate-400">เรือหยุดใช้งาน {Math.round(BOAT_INCIDENT[ev.outcome].repairMin / 60)} ชม. · ผู้ติดค้าง {ev.point} ยังรออยู่</div>
    </div>
  )
}
