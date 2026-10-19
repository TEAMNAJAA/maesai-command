/* ══════════════════════════════════════════════════════════════════════════
   CUT SCENES — what the player sees while the clock jumps
   THEOS-2 acquisition, four shots driven by the cut-scene progress k:
     orbit (Earth limb, THEOS-2 model) → camera (push-broom scan over the real
     SRTM terrain / GISTDA roofs, real cloud cover) → downlink to the ground
     station → AWAGAD L3 Ortho processing of each frame
   Plain time jump: a card with a running dial, the date, the river gauge
   (act 1) or the boats out (act 2), and what stopped the clock.
   Click anywhere to skip. Nothing else is clickable during a jump.
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useMemo } from 'react'
import { Satellite, FastForward, AlertTriangle, CheckCircle2, Radio, Cpu, Camera, Sun, Moon, Ship, MousePointerClick } from 'lucide-react'
import { THEOS2, THRESHOLDS, EVENT, DATA } from '../config/missionConfig'
import { SECTORS } from '../config/scenarioData'
import { BUILDINGS } from '../lib/buildings'
import { saiRiver, mercY } from '../lib/geo'
import { sphereReady, sphereTileTemplate } from '../lib/sphere'
import { cloudCells } from '../lib/clouds'
import { levelAt } from '../lib/hydro'
import { clockLabel, clockToDate, clamp } from '../lib/format'
import { Chibi } from '../ui/chibi'
import { useProfile } from '../lib/profile'
import { usePrefs } from '../lib/prefs'

const W = 900, SH = 330                       // card width · scene height
const KX = 111320 * Math.cos((20.44 * Math.PI) / 180)
const seg = (k, a, b) => clamp((k - a) / (b - a))
const smooth = (x) => x * x * (3 - 2 * x)
const PH = { orbit: [0, 0.22], scan: [0.22, 0.62], link: [0.62, 0.76], proc: [0.76, 1] }
const phaseOf = (k) => (k < PH.orbit[1] ? 0 : k < PH.scan[1] ? 1 : k < PH.link[1] ? 2 : 3)
const tgtTh = (t) => (t === 'TOWN' ? 'ตัวเมืองแม่สาย' : `Sector ${t}`)
const TOWN_C = [99.884, 20.44]
const TOWN_BOX = [99.862, 20.426, 99.906, 20.454]

/* ── THEOS-2 model (bus, panels, camera barrel, X-band antenna) ─────────── */

function TheosSat({ x, y, s = 1, rot = 0, rec = false }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <defs>
        <linearGradient id="sat-foil" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#f6d27a" /><stop offset="0.45" stopColor="#c9962c" /><stop offset="1" stopColor="#6e4f12" /></linearGradient>
        <linearGradient id="sat-cell" x1="0" x2="1"><stop offset="0" stopColor="#1e3a8a" /><stop offset="0.5" stopColor="#2b4fb5" /><stop offset="1" stopColor="#172c6b" /></linearGradient>
      </defs>
      {[-1, 1].map((d) => (
        <g key={d}>
          <rect x={d < 0 ? -64 : 18} y="-3" width="4" height="6" fill="#94a3b8" />
          <g transform={`translate(${d < 0 ? -112 : 22} -13) skewY(${d * -4})`}>
            <rect width="48" height="26" fill="url(#sat-cell)" stroke="#93c5fd" strokeWidth="0.8" />
            {[1, 2, 3, 4, 5].map((i) => <line key={i} x1={i * 8} y1="0" x2={i * 8} y2="26" stroke="#7dd3fc" strokeOpacity="0.45" strokeWidth="0.5" />)}
            <line x1="0" y1="13" x2="48" y2="13" stroke="#7dd3fc" strokeOpacity="0.45" strokeWidth="0.5" />
            <rect width="48" height="26" fill="url(#sat-glint)" opacity="0.35" />
          </g>
        </g>
      ))}
      <linearGradient id="sat-glint" x1="0" x2="1" y1="0" y2="1"><stop offset="0.3" stopColor="#fff" stopOpacity="0" /><stop offset="0.5" stopColor="#fff" stopOpacity="0.9" /><stop offset="0.7" stopColor="#fff" stopOpacity="0" /></linearGradient>
      <path d="M-14 -14 L14 -14 L18 0 L14 14 L-14 14 L-18 0 Z" fill="url(#sat-foil)" stroke="#3b2a06" strokeWidth="0.8" />
      <path d="M-14 -14 L14 -14 L10 -6 L-10 -6 Z" fill="#fff" opacity="0.18" />
      <rect x="-7" y="14" width="14" height="10" rx="2" fill="#1f2937" stroke="#64748b" strokeWidth="0.8" />
      <ellipse cx="0" cy="24.5" rx="6" ry="2.2" fill="#0b1220" stroke="#38bdf8" strokeWidth="0.8" />
      <circle cx="-2" cy="24" r="1.1" fill="#bae6fd" />
      <line x1="9" y1="-14" x2="13" y2="-24" stroke="#cbd5e1" strokeWidth="1.2" />
      <path d="M8 -27 Q13 -21 18 -27" fill="none" stroke="#e2e8f0" strokeWidth="1.6" />
      {rec && <circle cx="-10" cy="-9" r="2.2" fill="#ff3b63"><animate attributeName="opacity" values="1;0.2;1" dur="0.8s" repeatCount="indefinite" /></circle>}
    </g>
  )
}

/* ── Shot 1 + 3: the Earth limb from orbit, and the downlink ────────────── */

function OrbitShot({ k, cut }) {
  const link = k >= PH.scan[1]
  const u = link ? 0.55 + 0.45 * seg(k, PH.link[0], PH.link[1]) : 0.55 * smooth(seg(k, PH.orbit[0], PH.orbit[1]))
  const sx = 110 + u * 660
  const sy = 92 - Math.sin(u * Math.PI) * 26
  const stars = useMemo(() => Array.from({ length: 110 }, (_, i) => ({ x: (i * 97.3) % W, y: (i * 41.7) % 190, r: i % 7 ? 0.6 : 1.3, o: 0.25 + ((i * 13) % 10) / 14 })), [])
  const station = [742, 236]
  return (
    <svg viewBox={`0 0 ${W} ${SH}`} className="absolute inset-0 h-full w-full" data-shot="orbit">
      <defs>
        <radialGradient id="ov-sea" cx="45%" cy="-5%" r="85%"><stop offset="0" stopColor="#2a78b0" /><stop offset="0.5" stopColor="#0d3a64" /><stop offset="1" stopColor="#041631" /></radialGradient>
        <filter id="ov-land" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="5" seed="11" />
          <feColorMatrix values="0 0 0 0 0.27  0 0 0 0 0.36  0 0 0 0 0.17  9 0 0 0 -4.7" />
        </filter>
        <filter id="ov-cloud" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.01 0.024" numOctaves="5" seed="4" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  6 0 0 0 -3.05" />
        </filter>
        <linearGradient id="ov-night" x1="0" x2="1"><stop offset="0" stopColor="#000" stopOpacity="0.62" /><stop offset="0.35" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.15" /></linearGradient>
        <clipPath id="ov-earth"><circle cx={W / 2} cy="1210" r="1000" /></clipPath>
        <filter id="ov-glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7" /></filter>
        <radialGradient id="ov-sun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stopColor="#fff7d6" /><stop offset="0.25" stopColor="#ffe9a8" stopOpacity="0.55" /><stop offset="1" stopColor="#ffe9a8" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width={W} height={SH} fill="#01030a" />
      {stars.map((st, i) => <circle key={i} cx={st.x} cy={st.y} r={st.r} fill="#fff" opacity={st.o} />)}
      <circle cx="820" cy="40" r="70" fill="url(#ov-sun)" />
      {/* atmosphere glow behind the limb */}
      <circle cx={W / 2} cy="1210" r="1012" fill="none" stroke="#3b9cff" strokeWidth="30" opacity="0.28" filter="url(#ov-glow)" />
      <circle cx={W / 2} cy="1210" r="1000" fill="url(#ov-sea)" />
      <g clipPath="url(#ov-earth)">
        <rect x={-200 - u * 160} y="200" width={W + 400} height="140" filter="url(#ov-land)" opacity="0.9" />
        <rect x={-260 - u * 260} y="196" width={W + 520} height="144" filter="url(#ov-cloud)" opacity="0.85" />
        <rect width={W} height={SH} fill="url(#ov-night)" />
      </g>
      <circle cx={W / 2} cy="1210" r="1001" fill="none" stroke="#9be3ff" strokeWidth="2.2" opacity="0.9" filter="url(#ov-glow)" />
      <circle cx={W / 2} cy="1210" r="1000.5" fill="none" stroke="#d6f4ff" strokeWidth="0.8" opacity="0.8" />
      {/* orbit track */}
      <path d={`M 60 ${92 + 6} Q ${W / 2} 40 ${W - 60} ${92 + 6}`} fill="none" stroke="#7dd3fc" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="4 6" />
      {/* downlink */}
      {link && (
        <g>
          <line x1={sx} y1={sy + 24} x2={station[0]} y2={station[1] - 8} stroke="#7CFFA0" strokeWidth="1.8" strokeDasharray="6 7" className="animate-[dashflow_1.2s_linear_infinite]" />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={station[0]} cy={station[1] - 6} r="6" fill="none" stroke="#7CFFA0" strokeWidth="1.4">
              <animate attributeName="r" values="4;22" dur="1.2s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0" dur="1.2s" begin={`${i * 0.4}s`} repeatCount="indefinite" />
            </circle>
          ))}
          <g transform={`translate(${station[0]} ${station[1]})`}>
            <path d="M-9 -2 Q0 -16 9 -2 Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="0.8" />
            <line x1="0" y1="-6" x2="0" y2="4" stroke="#94a3b8" strokeWidth="1.6" />
            <rect x="-6" y="3" width="12" height="4" fill="#475569" />
          </g>
          <text x={station[0] - 8} y={station[1] + 24} textAnchor="end" className="font-thai" fontSize="12.5" fill="#BFF5CF" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>สถานีภาครับ GISTDA · X-band 8.2 GHz</text>
        </g>
      )}
      <TheosSat x={sx} y={sy} s={1.05} rot={-8 + u * 16} />
      <text x={sx} y={sy - 40} textAnchor="middle" className="num" fontSize="11" fill="#bae6fd" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>THEOS-2 · {cut.pass.id}</text>
    </svg>
  )
}

/* ── Shot 2: what the camera sees — push-broom scan over the real terrain ─ */

const DEM_B = DATA.dem.catchment, DEM_A = DATA.dem.urban
const toImg = (dem, [lon, lat]) => {
  const [w, s, e, n] = dem.bbox
  return [((lon - w) / (e - w)) * dem.image.width, ((n - lat) / (n - s)) * dem.image.height]
}
const pxPerDeg = (dem) => dem.image.width / (dem.bbox[2] - dem.bbox[0])

/** GISTDA Sphere imagery of the town (online) as tiles in urban-DEM pixels; [] offline. */
const unMercY = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI
let TOWN_TILES = null
function townTiles() {
  if (TOWN_TILES !== null) return TOWN_TILES
  const tpl = sphereReady() ? sphereTileTemplate() : ''
  TOWN_TILES = []
  if (!tpl) return TOWN_TILES
  const z = 15, n = 2 ** z
  const [w, s, e, nn] = TOWN_BOX
  const x0 = Math.floor(((w + 180) / 360) * n), x1 = Math.floor(((e + 180) / 360) * n)
  const y0 = Math.floor(mercY(nn) * n), y1 = Math.floor(mercY(s) * n)
  for (let ty = y0 - 1; ty <= y1 + 1; ty++) for (let tx = x0 - 1; tx <= x1 + 1; tx++) {
    const lon0 = (tx / n) * 360 - 180, lon1 = ((tx + 1) / n) * 360 - 180
    const lat0 = unMercY(ty / n), lat1 = unMercY((ty + 1) / n)
    const [ax, ay] = toImg(DEM_A, [lon0, lat0]), [bx, by] = toImg(DEM_A, [lon1, lat1])
    TOWN_TILES.push({ key: `${z}/${tx}/${ty}`, href: tpl.replace('{z}', z).replace('{x}', tx).replace('{y}', ty), x: ax, y: ay, w: bx - ax, h: by - ay })
  }
  return TOWN_TILES
}
const TownImagery = ({ style }) => <g style={style}>{townTiles().map((tl) => <image key={tl.key} href={tl.href} x={tl.x} y={tl.y} width={tl.w + 0.3} height={tl.h + 0.3} preserveAspectRatio="none" />)}</g>

/** Roofs of the town as one compound path in urban-DEM pixels (built once). */
let TOWN_ROOFS = null
function townRoofs() {
  if (TOWN_ROOFS !== null) return TOWN_ROOFS
  const [w, s, e, n] = TOWN_BOX
  let d = ''
  for (const b of BUILDINGS) {
    if (b.c[0] < w || b.c[0] > e || b.c[1] < s || b.c[1] > n) continue
    b.ring.forEach((p, i) => { const [x, y] = toImg(DEM_A, p); d += `${i ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}` })
    d += 'Z'
  }
  const river = saiRiver.map((f) => f.geometry.coordinates.map((p, i) => { const [x, y] = toImg(DEM_A, p); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}` }).join('')).join('')
  TOWN_ROOFS = { d, river }
  return TOWN_ROOFS
}

/** The terrain image plus mirrored copies around it, so any frame is fully covered without a seam. */
function Terrain({ dem, style }) {
  const { width: w, height: h } = dem.image
  return (
    <g style={style}>
      {[-1, 0, 1].flatMap((i) => [-1, 0, 1].map((j) => (
        <image key={`${i}${j}`} href={dem.href} width={w} height={h} preserveAspectRatio="none"
          transform={`translate(${i * w + (i % 2 ? w : 0)} ${j * h + (j % 2 ? h : 0)}) scale(${i % 2 ? -1 : 1} ${j % 2 ? -1 : 1})`} />
      )))}
    </g>
  )
}

function CameraShot({ k, cut, eng }) {
  const town = cut.act === 2
  const dem = town ? DEM_A : DEM_B
  const pass = cut.act === 1 ? eng.scn.passes.find((p) => p.id === cut.pass.id) : null
  // targets → boxes in image pixels (THEOS-2 swath ≈ 10.3 km)
  const boxes = useMemo(() => {
    const swathDeg = THEOS2.swathKm / (KX / 1000)
    return cut.pass.targets.map((t) => {
      const c = t === 'TOWN' ? (town ? TOWN_C : [Math.min(99.872, TOWN_C[0]), TOWN_C[1]]) : [SECTORS.find((x) => x.id === t).lon, SECTORS.find((x) => x.id === t).lat]
      const [cx, cy] = toImg(dem, c)
      const wPx = (town ? 0.032 : swathDeg) * pxPerDeg(dem)
      return { t, cx, cy, w: wPx, h: wPx * 0.8, cloud: pass ? pass.actual[t] : null }
    })
  }, [cut.pass.id]) // eslint-disable-line react-hooks/exhaustive-deps
  // crop: all boxes plus margin, at the scene's aspect
  const crop = useMemo(() => {
    let x0 = Math.min(...boxes.map((b) => b.cx - b.w / 2)), x1 = Math.max(...boxes.map((b) => b.cx + b.w / 2))
    let y0 = Math.min(...boxes.map((b) => b.cy - b.h / 2)), y1 = Math.max(...boxes.map((b) => b.cy + b.h / 2))
    const m = (x1 - x0) * 0.22 + 20
    x0 -= m; x1 += m; y0 -= m * 0.6; y1 += m * 0.6
    const asp = W / SH
    if ((x1 - x0) / (y1 - y0) < asp) { const cx = (x0 + x1) / 2, hw = ((y1 - y0) * asp) / 2; x0 = cx - hw; x1 = cx + hw } else { const cy = (y0 + y1) / 2, hh = (x1 - x0) / asp / 2; y0 = cy - hh; y1 = cy + hh }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  }, [boxes])
  const ks = smooth(seg(k, PH.scan[0] + 0.02, PH.scan[1] - 0.03))
  const scanX = crop.x + crop.w * (-0.04 + 1.08 * ks)
  const s = crop.w / W                                           // image px per screen px
  const roofs = town ? townRoofs() : null
  const t = eng.s.clock
  const cells = town ? cloudCells(eng.scn, t) : []
  const ppm = pxPerDeg(dem) / KX                                  // image px per metre
  const found = town ? eng.s.points.filter((p) => p.revealed === 'theos') : []
  return (
    <svg viewBox={`${crop.x} ${crop.y} ${crop.w} ${crop.h}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" data-shot="camera">
      <defs>
        <clipPath id="cam-done"><rect x={crop.x} y={crop.y - 50} width={Math.max(0, scanX - crop.x)} height={crop.h + 100} /></clipPath>
        <linearGradient id="cam-band" x1="1" x2="0"><stop offset="0" stopColor="#7dd3fc" stopOpacity="0.55" /><stop offset="1" stopColor="#7dd3fc" stopOpacity="0" /></linearGradient>
        <filter id="cam-cloud" x="-60%" y="-60%" width="220%" height="220%">
          <feTurbulence type="fractalNoise" baseFrequency={0.012 / s} numOctaves="5" seed="9" result="n" />
          <feTurbulence type="fractalNoise" baseFrequency={0.006 / s} numOctaves="2" seed="21" result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale={90 * s} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation={14 * s} result="b" />
          <feComposite in="n" in2="b" operator="arithmetic" k1="1.25" k2="0" k3="0.22" k4="0" result="m" />
          <feColorMatrix in="m" result="c" values="0 0 0 0 0.96  0 0 0 0 0.97  0 0 0 0 1  0 0 0 1.55 -0.2" />
          <feDiffuseLighting in="n" surfaceScale="3" diffuseConstant="1.1" lightingColor="#ffffff" result="l"><feDistantLight azimuth="235" elevation="55" /></feDiffuseLighting>
          <feComposite in="l" in2="c" operator="in" result="lit" />
          <feBlend in="lit" in2="c" mode="multiply" />
        </filter>
        <filter id="cam-shadow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation={10 * s} /></filter>
      </defs>
      <rect x={crop.x - 200} y={crop.y - 200} width={crop.w + 400} height={crop.h + 400} fill="#0a1a10" />
      {/* not yet imaged: dim, soft */}
      <Terrain dem={dem} style={{ filter: 'saturate(.35) brightness(.5) blur(1px)' }} />
      {town && <TownImagery style={{ filter: 'saturate(.3) brightness(.5) blur(.6px)' }} />}
      {town && !townTiles().length && <path d={roofs.d} fill="#cbd5e1" opacity="0.28" />}
      {/* imaged strip: full colour, crisp */}
      <g clipPath="url(#cam-done)">
        <Terrain dem={dem} style={{ filter: 'saturate(1.15) contrast(1.08)' }} />
        {town && (townTiles().length
          ? <TownImagery style={{ filter: 'saturate(1.1) contrast(1.06)' }} />
          : <>
            <path d={roofs.river} fill="none" stroke="#6b8f9e" strokeWidth={9 * ppm * 3} strokeLinecap="round" opacity="0.85" />
            <path d={roofs.d} fill="#e7e2d8" stroke="#8a8172" strokeWidth={0.4 * s} opacity="0.92" />
          </>)}
      </g>
      {/* cloud: shadows on the ground, then the cloud tops */}
      {town
        ? cells.map((c, i) => { const [x, y] = toImg(dem, [c.lon, c.lat]); return <circle key={`s${i}`} cx={x + 14 * s} cy={y + 10 * s} r={c.rM * ppm} fill="#0b1520" opacity="0.32" filter="url(#cam-shadow)" /> })
        : boxes.filter((b) => b.cloud > 15).map((b) => <ellipse key={`s${b.t}`} cx={b.cx + 12 * s} cy={b.cy + 9 * s} rx={b.w * 0.5 * (b.cloud / 100) + 6 * s} ry={b.h * 0.4 * (b.cloud / 100) + 5 * s} fill="#0b1520" opacity="0.35" filter="url(#cam-shadow)" />)}
      <g filter="url(#cam-cloud)" opacity="0.95">
        {town
          ? cells.map((c, i) => { const [x, y] = toImg(dem, [c.lon, c.lat]); return <circle key={i} cx={x} cy={y} r={c.rM * ppm} fill="#fff" /> })
          : boxes.filter((b) => b.cloud > 15).flatMap((b) => [0, 1, 2, 3].map((j) => (
            <ellipse key={`${b.t}${j}`} cx={b.cx + (j - 1.5) * b.w * 0.18} cy={b.cy + ((j % 2) - 0.5) * b.h * 0.2} rx={b.w * (0.18 + b.cloud / 260)} ry={b.h * (0.16 + b.cloud / 330)} fill="#fff" />
          )))}
      </g>
      {/* swath frames */}
      {boxes.map((b) => {
        const done = scanX > b.cx + b.w / 2
        const ok = b.cloud === null || b.cloud <= THEOS2.cloudUsablePct
        const hex = !done ? '#7dd3fc' : ok ? '#22E36B' : '#FF3B63'
        return (
          <g key={b.t}>
            <rect x={b.cx - b.w / 2} y={b.cy - b.h / 2} width={b.w} height={b.h} fill="none" stroke={hex} strokeWidth={2 * s} strokeDasharray={done ? undefined : `${8 * s} ${5 * s}`} />
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy], i) => (
              <path key={i} d={`M${b.cx + dx * b.w / 2} ${b.cy + dy * (b.h / 2 - 12 * s)} V${b.cy + dy * b.h / 2} H${b.cx + dx * (b.w / 2 - 12 * s)}`} fill="none" stroke={hex} strokeWidth={3.5 * s} />
            ))}
            <text x={b.cx - b.w / 2 + 6 * s} y={b.cy - b.h / 2 - 7 * s} fontSize={13 * s} fill="#fff" className="font-thai" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 * s }}>
              {tgtTh(b.t)}{done ? (b.cloud === null ? ' · ถ่ายแล้ว' : ok ? ` · ✓ เมฆ ${b.cloud}%` : ` · ✗ เมฆบัง ${b.cloud}%`) : ''}
            </text>
          </g>
        )
      })}
      {/* people located on roofs (act 2) */}
      {found.map((p) => {
        const [x, y] = toImg(dem, [p.lon, p.lat])
        if (x > scanX) return null
        return (
          <g key={p.id}>
            <circle cx={x} cy={y} r={9 * s} fill="none" stroke="#FF3B63" strokeWidth={2 * s}><animate attributeName="r" values={`${5 * s};${16 * s}`} dur="1s" repeatCount="indefinite" /><animate attributeName="opacity" values="1;0" dur="1s" repeatCount="indefinite" /></circle>
            <circle cx={x} cy={y} r={4.5 * s} fill="#FF3B63" stroke="#fff" strokeWidth={1.2 * s} />
            <text x={x + 8 * s} y={y - 6 * s} fontSize={11.5 * s} fill="#FFC2CE" className="font-thai" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 * s }}>{p.people} คน</text>
          </g>
        )
      })}
      {/* the scan line */}
      {ks > 0 && ks < 1 && (
        <g>
          <rect x={scanX - 70 * s} y={crop.y} width={70 * s} height={crop.h} fill="url(#cam-band)" />
          <line x1={scanX} y1={crop.y} x2={scanX} y2={crop.y + crop.h} stroke="#e0f2fe" strokeWidth={2.4 * s} />
        </g>
      )}
    </svg>
  )
}

/* Viewfinder chrome over the camera shot (screen space) */
function Viewfinder({ cut, clock }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      {[['left-3 top-3', 'border-l-2 border-t-2'], ['right-3 top-3', 'border-r-2 border-t-2'], ['left-3 bottom-3', 'border-l-2 border-b-2'], ['right-3 bottom-3', 'border-r-2 border-b-2']].map(([p, b]) => <div key={p} className={`absolute h-6 w-6 border-sky-200/80 ${p} ${b}`} />)}
      <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2"><div className="absolute left-1/2 top-0 h-full w-px bg-sky-100/50" /><div className="absolute left-0 top-1/2 h-px w-full bg-sky-100/50" /></div>
      <div className="num absolute left-6 top-5 rounded bg-black/55 px-2 py-1 text-[11px] leading-tight text-sky-100">
        <div className="flex items-center gap-1.5 font-bold text-white"><span className="h-2 w-2 animate-pulse rounded-full bg-[#ff3b63]" /> REC · THEOS-2 {cut.pass.id}</div>
        <div>ALT 621 km · V 7.5 km/s · ROLL {cut.act === 1 ? '+14°' : '−6°'}</div>
        <div>PAN {THEOS2.panM} m · MS {THEOS2.msM} m · SWATH {THEOS2.swathKm} km</div>
      </div>
      <div className="num absolute right-6 top-5 rounded bg-black/55 px-2 py-1 text-right text-[12px] font-bold text-white">{clockLabel(Math.round(clock))}<div className="font-thai text-[10.5px] font-normal text-slate-300">{clockToDate(Math.round(clock))}</div></div>
      <div className="absolute bottom-5 left-6 flex items-end gap-1.5">
        <div className="h-1.5 w-24 border-x-2 border-b-2 border-white/80" /><span className="num text-[10.5px] text-white" style={{ textShadow: '0 0 3px #000' }}>{cut.act === 1 ? '10 km' : '500 m'}</span>
      </div>
    </div>
  )
}

/* ── Shot 4: AWAGAD L3 Ortho processing of each frame ───────────────────── */

function ProcessShot({ k, cut, eng }) {
  const f = seg(k, PH.proc[0], PH.proc[1] - 0.04)
  const town = cut.act === 2
  const pass = cut.act === 1 ? eng.scn.passes.find((p) => p.id === cut.pass.id) : null
  const bars = town
    ? [['ส่งภาพเข้าระบบ AWAGAD', 0], ['ตรวจจับคน/สิ่งของบนหลังคา', 0.25], ['ระบุพิกัดผู้ติดค้างลงแผนที่', 0.5]]
    : [['แก้ค่ารังสี (Radiometric)', 0], ['ปรับแก้ภูมิประเทศด้วย DEM (Orthorectify)', 0.22], ['รวม Pan 0.5 ม. + MS 2 ม. (Pan-sharpen)', 0.44]]
  const found = town ? eng.s.points.filter((p) => p.revealed === 'theos').length : 0
  return (
    <div className="absolute inset-0 flex items-center gap-5 bg-[radial-gradient(120%_120%_at_30%_20%,#0d2036,#040a14)] px-7" data-shot="process">
      <div className="flex gap-3">
        {cut.pass.targets.map((t) => {
          const dem = town || t === 'TOWN' ? DEM_A : DEM_B
          const c = t === 'TOWN' ? TOWN_C : [SECTORS.find((x) => x.id === t).lon, SECTORS.find((x) => x.id === t).lat]
          const [cx, cy] = toImg(dem, c)
          const half = (t === 'TOWN' ? 0.02 : 0.045) * pxPerDeg(dem)
          const cloud = pass ? pass.actual[t] : null
          const bad = cloud !== null && cloud > THEOS2.cloudUsablePct
          return (
            <div key={t} className="w-[250px]">
              <div className="relative h-[200px] overflow-hidden rounded-md border border-white/20 bg-black">
                <svg viewBox={`${cx - half} ${cy - half * 0.72} ${half * 2} ${half * 1.44}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full"
                  style={{ filter: `blur(${(1 - f) * 3.5}px) saturate(${0.25 + 0.95 * f}) contrast(${0.8 + 0.3 * f}) brightness(${0.75 + 0.3 * f})`, transform: `rotate(${(1 - f) * 5}deg) scale(${1.12 - 0.12 * f})` }}>
                  <image href={dem.href} x="0" y="0" width={dem.image.width} height={dem.image.height} preserveAspectRatio="none" />
                  {(town || t === 'TOWN') && (townTiles().length ? <TownImagery /> : <path d={townRoofs().d} fill="#e7e2d8" opacity="0.9" />)}
                </svg>
                {cloud > 15 && <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 55% at 45% 50%, rgba(255,255,255,.95), rgba(255,255,255,.55) 55%, transparent 80%)', opacity: Math.min(1, cloud / 80) }} />}
                <div className="pointer-events-none absolute inset-0 opacity-[.18] mix-blend-overlay" style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 3px)', opacity: 0.25 * (1 - f) }} />
                <span className={`num absolute left-1.5 top-1.5 rounded px-1.5 py-[1px] text-[10px] font-bold ${f >= 1 ? 'bg-[#22E36B] text-black' : 'bg-black/70 text-slate-200'}`}>{f >= 1 ? (town ? 'ANALYSED' : 'L3 ORTHO') : 'RAW L0'}</span>
              </div>
              <div className="font-thai mt-1 flex items-center justify-between text-[12px]">
                <span className="text-white">{tgtTh(t)}</span>
                {cloud !== null && <span style={{ color: bad ? '#FF9DB2' : '#7CFFA0' }}>{bad ? `เมฆ ${cloud}% · ใช้ไม่ได้` : `เมฆ ${cloud}% · ใช้ได้`}</span>}
                {town && <span className="text-[#FFC2CE]">{f >= 0.75 ? `พบ ${found} จุด` : 'กำลังตรวจ…'}</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-mono text-[11px] tracking-[0.2em] text-sky-300/80">GISTDA · AWAGAD PROCESSING</div>
        <div className="font-thai text-[17px] font-bold text-white">{town ? 'วิเคราะห์ภาพหาผู้ติดค้างบนหลังคา' : 'ประมวลผลภาพระดับ L3 Ortho'}</div>
        <div className="mt-3 space-y-2.5">
          {bars.map(([th, d]) => {
            const v = clamp((f - d) / 0.5)
            return (
              <div key={th}>
                <div className="font-thai flex justify-between text-[12px] text-slate-300"><span>{th}</span><span className="num">{Math.round(v * 100)}%</span></div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-[#22E36B]" style={{ width: `${v * 100}%` }} /></div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ── The THEOS-2 sequence ───────────────────────────────────────────────── */

function SceneChibi({ pose, say, size = 70, className = '' }) {
  const me = useProfile()
  if (usePrefs().officer) return null                 // F4: no cartoon in officer-training mode
  return (
    <div className={`pointer-events-none flex items-end gap-1 ${className}`} data-scene-chibi={pose}>
      <Chibi profile={me} pose={pose} size={size} />
      {say && <div className="font-thai mb-6 rounded-lg rounded-bl-none border border-sky-300/40 bg-[#081a30]/90 px-2 py-1 text-[11.5px] font-semibold text-sky-50">{say}</div>}
    </div>
  )
}

function TheosScene({ cut, eng }) {
  const k = cut.p
  const ph = cut.done ? 3 : phaseOf(k)
  const op = (a, b, fade = 0.035) => smooth(clamp(Math.min((k - a) / fade + 1, (b - k) / fade + 1)))
  const steps = cut.act === 1
    ? [[Satellite, 'โคจรเข้าพื้นที่'], [Camera, `ถ่ายภาพ ${cut.pass.targets.map(tgtTh).join(' · ')}`], [Radio, 'ส่งข้อมูลลงสถานีภาครับ'], [Cpu, 'ประมวลผล L3 Ortho']]
    : [[Satellite, 'โคจรผ่านแม่สาย'], [Camera, 'ถ่ายตัวเมือง (เห็นเฉพาะช่องที่เมฆเปิด)'], [Radio, 'ส่งข้อมูลลงสถานีภาครับ'], [Cpu, 'หาผู้ติดค้างบนหลังคา']]
  return (
    <div className="overflow-hidden rounded-xl border border-sky-400/45 bg-[#040a14] shadow-[0_0_80px_-12px_rgba(56,189,248,.75)]" style={{ width: W }} data-cutscene="theos">
      <div className="relative overflow-hidden" style={{ height: SH }}>
        {!cut.done && <>
          <div className="absolute inset-0" style={{ opacity: Math.max(op(PH.orbit[0] - 1, PH.orbit[1]), op(PH.link[0], PH.link[1])) }}><OrbitShot k={k} cut={cut} /></div>
          <div className="absolute inset-0" style={{ opacity: op(PH.scan[0], PH.scan[1]) }}>
            {k >= PH.scan[0] - 0.04 && k <= PH.scan[1] + 0.04 && <><CameraShot k={k} cut={cut} eng={eng} /><Viewfinder cut={cut} clock={eng.s.clock} /></>}
          </div>
        </>}
        <div className="absolute inset-0" style={{ opacity: cut.done ? 1 : op(PH.proc[0], 2) }}>{(k >= PH.proc[0] - 0.04 || cut.done) && <ProcessShot k={cut.done ? 1 : k} cut={cut} eng={eng} />}</div>
        <SceneChibi className="absolute bottom-1 left-2" pose={ph <= 1 ? 'point' : ph === 2 ? 'remote' : 'monitor'}
          say={ph === 0 ? 'THEOS-2 เข้าพื้นที่แล้ว!' : ph === 1 ? 'กล้องสแกน…' : ph === 2 ? 'รับสัญญาณลงสถานี' : 'ได้ภาพ L3 Ortho'} />
        <div className="font-thai pointer-events-none absolute bottom-2 right-3 flex items-center gap-1 rounded bg-black/50 px-2 py-0.5 text-[11px] text-slate-300"><MousePointerClick size={12} /> คลิกเพื่อข้าม</div>
      </div>
      <div className="flex items-center gap-1 border-t border-white/10 px-4 py-3">
        {steps.map(([Icon, th], i) => {
          const done = i < ph || cut.done, on = i === ph && !cut.done
          return (
            <React.Fragment key={i}>
              {i > 0 && <div className="mx-1 h-[2px] flex-1 rounded bg-white/10"><div className="h-full rounded bg-[#22E36B] transition-[width]" style={{ width: done ? '100%' : on ? '50%' : '0%' }} /></div>}
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={`grid h-7 w-7 place-items-center rounded-full border ${done ? 'border-[#22E36B] bg-[#22E36B]/20' : on ? 'border-sky-300 bg-sky-400/25' : 'border-white/15'}`}>
                  {done ? <CheckCircle2 size={14} className="text-[#7CFFA0]" /> : <Icon size={13} className={on ? 'animate-pulse text-sky-100' : 'text-slate-500'} />}
                </span>
                <span className={`font-thai max-w-[190px] truncate text-[12.5px] ${done ? 'text-slate-300' : on ? 'font-bold text-white' : 'text-slate-500'}`}>{th}</span>
              </div>
            </React.Fragment>
          )
        })}
      </div>
      {cut.done && cut.event && (
        <div className="font-thai flex items-center gap-2 border-t border-[#22E36B]/30 bg-[#22E36B]/10 px-4 py-2.5 text-[14.5px] font-bold text-[#BFF5CF] animate-[riseIn_.3s_ease-out]">
          <CheckCircle2 size={17} /> {cut.event.th}
        </div>
      )}
    </div>
  )
}

/* ── Plain time jump ────────────────────────────────────────────────────── */

const T0 = Date.parse(EVENT.t0ISO)
const hourOf = (min) => ((((T0 + min * 60000) / 3600000 + 7) % 24) + 24) % 24     // Bangkok time

function ClockDial({ min }) {
  const h = hourOf(min), m = (h % 1) * 60
  return (
    <svg viewBox="-26 -26 52 52" className="h-[54px] w-[54px] shrink-0">
      <circle r="24" fill="#071526" stroke="#38bdf8" strokeOpacity="0.6" strokeWidth="1.5" />
      {Array.from({ length: 12 }, (_, i) => <line key={i} x1="0" y1="-21" x2="0" y2={i % 3 ? -18.5 : -16.5} stroke="#bae6fd" strokeWidth={i % 3 ? 1 : 1.8} transform={`rotate(${i * 30})`} />)}
      <line x1="0" y1="2" x2="0" y2="-11" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" transform={`rotate(${(h % 12) * 30})`} />
      <line x1="0" y1="3" x2="0" y2="-17" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="round" transform={`rotate(${m * 6})`} />
      <circle r="2" fill="#7dd3fc" />
    </svg>
  )
}

function JumpCard({ cut, eng }) {
  const { s } = eng
  const clock = s.clock
  const ev = cut.done && cut.event
  const bad = ev && ['crit', 'lost', 'storm', 'power', 'escalate', 'prepass'].includes(ev.kind)
  const hex = ev ? (bad ? '#FFB300' : '#22E36B') : '#38BDF8'
  const h = hourOf(clock), night = h < 6 || h >= 18.5
  const lvl = levelAt(Math.min(clock, 0)), lvl0 = levelAt(Math.min(cut.from, 0))
  const fill = clamp((lvl - 3.4) / (4.7 - 3.4))
  const boats = s.jobs.filter((j) => j.kind === 'boatAtPoint' || j.kind === 'boatAtDest').length
  return (
    <div className="w-[620px] overflow-hidden rounded-xl border bg-[#050b18]/95 shadow-[0_0_50px_-14px_rgba(56,189,248,.9)]" style={{ borderColor: `${hex}88` }} data-cutscene="advance">
      <div className="relative flex items-center gap-4 px-4 py-3" style={{ background: night ? 'linear-gradient(90deg,#060c1e,#0a1530)' : 'linear-gradient(90deg,#0b2036,#0f2c44)' }}>
        <SceneChibi pose={bad ? 'shock' : cut.act === 2 ? 'clipboard' : 'idle'} size={46} />
        <ClockDial min={clock} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FastForward size={15} className="text-sky-300" />
            <span className="font-thai text-[12.5px] text-slate-300">เดินเวลา</span>
            <span className="num text-[12.5px] text-slate-400">{clockLabel(cut.from)}</span>
            <span className="text-slate-500">→</span>
            <span className="num text-[19px] font-bold text-white">{clockLabel(Math.round(clock))}</span>
          </div>
          <div className="font-thai mt-0.5 flex items-center gap-1.5 text-[12px] text-slate-300">{night ? <Moon size={12} className="text-indigo-200" /> : <Sun size={12} className="text-amber-200" />}{clockToDate(Math.round(clock))}</div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-sky-300" style={{ width: `${cut.p * 100}%` }} /></div>
        </div>
        {cut.act === 1 ? (
          <div className="flex shrink-0 items-end gap-2" title="ระดับน้ำสถานีถ้ำผาจม">
            <div className="relative h-[56px] w-[16px] overflow-hidden rounded-full border border-white/25 bg-black/40">
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1d4ed8] to-[#38bdf8]" style={{ height: `${fill * 100}%` }} />
              {[[THRESHOLDS.prepLevel, '#FFB300'], [THRESHOLDS.criticalLevel, '#FF3B63']].map(([v, c]) => <div key={v} className="absolute inset-x-0 h-[2px]" style={{ bottom: `${clamp((v - 3.4) / 1.3) * 100}%`, background: c }} />)}
            </div>
            <div className="leading-tight">
              <div className="font-thai text-[10.5px] text-slate-400">น้ำถ้ำผาจม</div>
              <div className="num text-[16px] font-bold" style={{ color: lvl >= THRESHOLDS.criticalLevel ? '#FF6B8A' : lvl >= THRESHOLDS.prepLevel ? '#FFD066' : '#7dd3fc' }}>{lvl.toFixed(2)} ม.</div>
              <div className="num text-[10.5px] text-slate-400">{lvl >= lvl0 ? '▲' : '▼'} {Math.abs(lvl - lvl0).toFixed(2)}</div>
            </div>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <Ship size={22} className={boats ? 'text-[#FFB27A]' : 'text-slate-500'} />
            <div className="leading-tight"><div className="font-thai text-[10.5px] text-slate-400">เรือกำลังปฏิบัติงาน</div><div className="num text-[16px] font-bold text-white">{boats} เที่ยว</div></div>
          </div>
        )}
      </div>
      {ev && (
        <div className="font-thai flex items-center gap-2 border-t px-4 py-2 text-[14px] font-bold animate-[riseIn_.25s_ease-out]" style={{ borderColor: `${hex}44`, background: `${hex}14`, color: bad ? '#FFE0A3' : '#BFF5CF' }}>
          {bad ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />} {ev.th}
        </div>
      )}
    </div>
  )
}

export function Cutscene({ eng }) {
  const { cut } = eng
  if (!cut) return null
  const theos = cut.kind === 'theos'
  return (
    <div className="fixed inset-0 z-[75] cursor-pointer" data-cut={cut.kind} onClick={eng.skipCut} title="คลิกเพื่อข้าม">
      <div className={`absolute inset-0 ${theos ? 'bg-black/60' : 'bg-transparent'}`} />
      <div className={`absolute left-1/2 -translate-x-1/2 ${theos ? 'top-1/2 -translate-y-1/2' : 'bottom-[150px]'}`}>
        {theos ? <TheosScene cut={cut} eng={eng} /> : <JumpCard cut={cut} eng={eng} />}
      </div>
    </div>
  )
}
