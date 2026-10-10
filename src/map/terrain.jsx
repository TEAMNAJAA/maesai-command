/* ══════════════════════════════════════════════════════════════════════════
   PROCEDURAL TERRAIN — no external assets, fully offline-capable
   ฉากจำลองภาพ THEOS-2 / เรดาร์ ใช้จนกว่าจะได้ภาพจริงจาก GISTDA
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useMemo } from 'react'
import { SECTORS } from '../config/scenarioData'

/** Deterministic PRNG so the generated terrain never re-rolls between renders. */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Catmull-Rom → cubic bezier, for smooth river / ridge geometry. */
export function smoothPath(pts) {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)}, ${c2[0].toFixed(1)} ${c2[1].toFixed(1)}, ${p2[0]} ${p2[1]}`
  }
  return d
}

/** Interpolate a point + tangent along a polyline at parameter t ∈ [0,1]. */
export function pointAt(pts, t) {
  const segs = [], total = pts.reduce((acc, p, i) => {
    if (i === 0) return 0
    const l = Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])
    segs.push(l); return acc + l
  }, 0)
  let target = t * total
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i]) {
      const u = segs[i] === 0 ? 0 : target / segs[i]
      const a = pts[i], b = pts[i + 1]
      return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }
    }
    target -= segs[i]
  }
  const a = pts[pts.length - 2], b = pts[pts.length - 1]
  return { x: b[0], y: b[1], ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }
}

export const RIVER_PTS = [
  [548, -30], [536, 60], [552, 138], [524, 214], [508, 292],
  [518, 366], [494, 442], [478, 520], [488, 596], [464, 700], [456, 760],
]

export function useTerrain(seed = 20240912) {
  return useMemo(() => {
    const rnd = mulberry32(seed)
    const riverPath = smoothPath(RIVER_PTS)

    /* Dendritic drainage network — recursive branching off the main stem. */
    const tribs = []
    const branch = (x, y, ang, len, depth) => {
      if (depth <= 0 || len < 5) return
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len
      tribs.push({ x1: x, y1: y, x2, y2, w: 0.25 + depth * 0.34, o: 0.16 + depth * 0.11 })
      const n = rnd() < 0.74 ? 2 : 1
      for (let i = 0; i < n; i++) {
        branch(x2, y2, ang + (rnd() - 0.5) * 0.9 + (i ? 0.46 : -0.46), len * (0.6 + rnd() * 0.24), depth - 1)
      }
    }
    for (let i = 0; i < 26; i++) {
      const t = 0.02 + (i / 26) * 0.96
      const p = pointAt(RIVER_PTS, t)
      const side = i % 2 ? 1 : -1
      branch(p.x, p.y, p.ang + side * (1.15 + (rnd() - 0.5) * 0.4), 52 + rnd() * 46, 4)
    }

    /* Distance from the river centreline — drives canopy density and the
       valley-floor lightening, so the town reads as a clearing in forest. */
    const samples = []
    for (let i = 0; i <= 90; i++) samples.push(pointAt(RIVER_PTS, i / 90))
    const distToRiver = (x, y) => {
      let m = 1e9
      for (const p of samples) {
        const d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y)
        if (d < m) m = d
      }
      return Math.sqrt(m)
    }

    /* Canopy stipple — this is what makes the hillsides read as forest rather
       than a flat green fill. Density falls off sharply inside the valley. */
    const canopy = []
    for (let i = 0; i < 4200; i++) {
      const x = rnd() * 1000, y = rnd() * 780 - 10
      const d = distToRiver(x, y)
      if (d < 190 && rnd() > (d / 190) ** 2.2) continue        // clearing over the town
      canopy.push({ x, y, r: 1 + rnd() * 2.5, t: rnd(), d })
    }

    /* Building footprints clustered along the urban corridor. */
    const buildings = []
    for (let i = 0; i < 1150; i++) {
      const t = 0.1 + rnd() * 0.88
      const p = pointAt(RIVER_PTS, t)
      const side = rnd() < 0.5 ? -1 : 1
      const off = 13 + Math.pow(rnd(), 1.3) * 112          // tight ribbon, not confetti
      const jitter = (rnd() - 0.5) * 9
      const x = p.x + Math.cos(p.ang + Math.PI / 2) * off * side + jitter
      const y = p.y + Math.sin(p.ang + Math.PI / 2) * off * side + jitter
      if (x < 250 || x > 780) continue
      buildings.push({
        x, y,
        w: 3.6 + rnd() * 5.4, h: 3 + rnd() * 4.6,
        r: (p.ang * 180) / Math.PI + (rnd() - 0.5) * 18,
        tone: rnd(), near: off < 62,
      })
    }

    /* Ridge lines for hill-shade contouring. */
    const ridges = []
    for (let i = 0; i < 22; i++) {
      const base = i < 11 ? 60 + i * 16 : 1000 - (i - 11) * 16 - 60
      const pts = []
      for (let k = 0; k <= 8; k++) {
        pts.push([base + (rnd() - 0.5) * 54, k * 96 - 20])
      }
      ridges.push({ d: smoothPath(pts), o: 0.05 + rnd() * 0.1 })
    }

    /* Flood-wall gaps — จุดฟันหลอ · 14 points along the embankment. */
    const gaps = []
    for (let i = 0; i < 14; i++) {
      const t = 0.16 + (i / 14) * 0.74 + (rnd() - 0.5) * 0.02
      const p = pointAt(RIVER_PTS, t)
      const side = i % 3 === 0 ? -1 : 1
      gaps.push({
        id: `FW-${String(i + 1).padStart(2, '0')}`,
        x: p.x + Math.cos(p.ang + Math.PI / 2) * 15 * side,
        y: p.y + Math.sin(p.ang + Math.PI / 2) * 15 * side,
        len: 18 + Math.round(rnd() * 46),
      })
    }

    /* Landslide scars in the Myanmar catchment (revealed by tasking). */
    const scars = []
    SECTORS.forEach((s) => {
      for (let i = 0; i < s.scars; i++) {
        const a = rnd() * Math.PI * 2, r = 18 + rnd() * 54
        scars.push({
          sector: s.id,
          x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r,
          w: 20 + Math.round(rnd() * 10),           // 20–30 m scar width
          rot: rnd() * 180,
        })
      }
    })

    return { riverPath, tribs, buildings, ridges, gaps, scars, canopy }
  }, [seed])
}

/* ── Shared SVG filter defs ─────────────────────────────────────────────── */
export function TerrainDefs() {
  return (
    <defs>
      <filter id="fx-optical" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.016" numOctaves="6" seed="7" result="n" />
        <feColorMatrix in="n" type="matrix" result="c"
          values="0.10 0.22 0.05 0 0.045
                  0.16 0.34 0.07 0 0.075
                  0.07 0.15 0.06 0 0.038
                  0    0    0    0 1" />
        <feDiffuseLighting in="n" surfaceScale="2.2" diffuseConstant="1.05" lightingColor="#8fae7a" result="l">
          <feDistantLight azimuth="308" elevation="52" />
        </feDiffuseLighting>
        <feBlend in="c" in2="l" mode="multiply" />
      </filter>

      <filter id="fx-sar" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.004 0.011" numOctaves="7" seed="19" result="base" />
        <feDiffuseLighting in="base" surfaceScale="3.4" diffuseConstant="1.35" lightingColor="#ffffff" result="lit">
          <feDistantLight azimuth="292" elevation="26" />
        </feDiffuseLighting>
        <feColorMatrix in="lit" type="matrix"
          values="1.35 0 0 0 -0.42
                  1.35 0 0 0 -0.40
                  1.35 0 0 0 -0.36
                  0    0 0 0 1" />
      </filter>

      <filter id="fx-speckle">
        <feTurbulence type="turbulence" baseFrequency="0.85" numOctaves="2" seed="3" result="s" />
        <feColorMatrix in="s" type="saturate" values="0" />
      </filter>

      <filter id="fx-mud" x="-10%" y="-10%" width="120%" height="120%">
        <feTurbulence type="fractalNoise" baseFrequency="0.007 0.018" numOctaves="6" seed="7" result="n" />
        <feColorMatrix in="n" type="matrix" result="c"
          values="0.26 0.20 0.05 0 0.085
                  0.19 0.16 0.05 0 0.062
                  0.10 0.09 0.04 0 0.036
                  0    0    0    0 1" />
        <feDiffuseLighting in="n" surfaceScale="2.4" diffuseConstant="1.0" lightingColor="#b09a72" result="l">
          <feDistantLight azimuth="308" elevation="50" />
        </feDiffuseLighting>
        <feBlend in="c" in2="l" mode="multiply" />
      </filter>

      <linearGradient id="grad-flood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.9" />
        <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0.75" />
      </linearGradient>
      <radialGradient id="grad-glow">
        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="grad-mudriver" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#8A6B3D" />
        <stop offset="55%" stopColor="#A98452" />
        <stop offset="100%" stopColor="#7C5F35" />
      </linearGradient>
      {/* Soft valley clearing — a hard-edged ellipse read as a painted oval. */}
      <radialGradient id="grad-valley-g" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#4a6338" stopOpacity="0.85" />
        <stop offset="45%" stopColor="#40592f" stopOpacity="0.5" />
        <stop offset="78%" stopColor="#22401f" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#0e2013" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="grad-valley-m" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0%" stopColor="#6a5637" stopOpacity="0.85" />
        <stop offset="45%" stopColor="#5b4a2f" stopOpacity="0.5" />
        <stop offset="78%" stopColor="#3d3220" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#2b2519" stopOpacity="0" />
      </radialGradient>
      {/* Valley walls: darken hard towards both map edges. */}
      <linearGradient id="grad-slopeL" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#000000" stopOpacity="0.5" />
        <stop offset="30%" stopColor="#000000" stopOpacity="0.2" />
        <stop offset="55%" stopColor="#000000" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="grad-slopeR" x1="1" y1="0" x2="0" y2="0">
        <stop offset="0%" stopColor="#000000" stopOpacity="0.5" />
        <stop offset="30%" stopColor="#000000" stopOpacity="0.2" />
        <stop offset="55%" stopColor="#000000" stopOpacity="0" />
      </linearGradient>
    </defs>
  )
}

/** Optical scene (Act 1 / AAR "before"). Mud variant is used for AAR "after".
 *  Built from explicit geometry — dark forested slopes, a stippled canopy, a
 *  cleared valley floor and dense rooftops — rather than a filter wash, which
 *  flattened into a uniform green. Filters are kept only as a subtle mottle. */
export function OpticalScene({ terrain, mud = false, showBuildings = true, damaged = false }) {
  const { riverPath, tribs, buildings, ridges, canopy, scars } = terrain

  const C = mud
    ? { base: '#3a3222', floor: '#6a5637', canopyDark: '#3f3421', canopyLite: '#6d5a3a', trib: '#b0906099', ridge: '#1d1710' }
    : { base: '#1b3a22', floor: '#4a6338', canopyDark: '#15301b', canopyLite: '#3d6d40', trib: '#1a3a2299', ridge: '#08180d' }

  return (
    <g>
      {/* deep base + valley clearing */}
      <rect x="0" y="0" width="1000" height="780" fill={C.base} />
      <ellipse cx="500" cy="380" rx="290" ry="470" fill={mud ? 'url(#grad-valley-m)' : 'url(#grad-valley-g)'} />

      {/* slope shading: valley walls fall away to either side */}
      <rect x="0" y="0" width="1000" height="780" fill="url(#grad-slopeL)" />
      <rect x="0" y="0" width="1000" height="780" fill="url(#grad-slopeR)" />

      {/* ridge lines */}
      {ridges.map((r, i) => (
        <path key={`r${i}`} d={r.d} stroke={C.ridge} strokeWidth="2.4" fill="none" opacity={r.o * 3.2} />
      ))}

      {/* dendritic drainage cut into the slopes */}
      {tribs.map((t, i) => (
        <line key={`t${i}`} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={C.trib} strokeWidth={t.w * 1.3} opacity={t.o * 1.8} strokeLinecap="round" />
      ))}

      {/* canopy stipple — the forest texture */}
      {canopy.map((c, i) => (
        <circle key={`c${i}`} cx={c.x} cy={c.y} r={c.r}
          fill={c.t > 0.5 ? C.canopyLite : C.canopyDark}
          opacity={0.5 + c.t * 0.5} />
      ))}

      {/* landslide scars on the after-image */}
      {mud && scars.map((k, i) => (
        <rect key={`s${i}`} x={k.x} y={k.y} width="6" height={26 + k.w} rx="3"
          transform={`rotate(${k.rot} ${k.x} ${k.y})`} fill="#8a4520" opacity="0.85" />
      ))}

      {/* river */}
      <path d={riverPath} stroke="#050c08" strokeWidth={mud ? 76 : 44} fill="none" opacity="0.45" strokeLinecap="round" />
      <path d={riverPath} stroke={mud ? 'url(#grad-mudriver)' : '#2f5f7e'} strokeWidth={mud ? 62 : 24}
        fill="none" strokeLinecap="round" opacity={mud ? 0.99 : 0.92} />
      <path d={riverPath} stroke={mud ? '#c9a874' : '#5d93b4'} strokeWidth={mud ? 26 : 9}
        fill="none" strokeLinecap="round" opacity={mud ? 0.55 : 0.5} />

      {/* rooftops */}
      {showBuildings && buildings.map((b, i) => {
        const gone = damaged && b.near && b.tone > 0.42
        const fill = mud
          ? (gone ? '#5c4c36' : ['#8a7358', '#9a805f', '#7b674c', '#a68a63'][Math.floor(b.tone * 4)])
          : ['#c05a3e', '#d4744c', '#6b7c8b', '#98a3b0', '#b04529', '#8d5a45'][Math.floor(b.tone * 6)]
        return (
          <rect key={`b${i}`} x={b.x} y={b.y} width={b.w} height={b.h} rx="0.5"
            transform={`rotate(${b.r} ${b.x} ${b.y})`}
            fill={fill} opacity={gone ? 0.45 : mud ? 0.85 : 0.96} />
        )
      })}

      {/* fine mottle so the render does not look vector-clean */}
      <rect x="0" y="0" width="1000" height="780" filter="url(#fx-speckle)" opacity={mud ? 0.13 : 0.16}
        style={{ mixBlendMode: 'overlay' }} />
      <rect x="0" y="0" width="1000" height="780" filter={mud ? 'url(#fx-mud)' : 'url(#fx-optical)'}
        opacity="0.24" style={{ mixBlendMode: 'soft-light' }} />
    </g>
  )
}

/** SAR radar scene (Act 2) — black backscatter with bright drainage filaments. */
export function SarScene({ terrain, floodPhase }) {
  const { riverPath, tribs, buildings } = terrain
  return (
    <g>
      <rect x="0" y="0" width="1000" height="760" fill="#04060A" />
      <rect x="0" y="0" width="1000" height="760" filter="url(#fx-sar)" opacity="0.3" />
      {tribs.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke="#EEF4FC" strokeWidth={t.w * 1.15} opacity={Math.min(1, t.o * 1.5)} strokeLinecap="round" />
      ))}
      {/* Bright specular return from built-up surfaces */}
      {buildings.map((b, i) => (
        <rect key={i} x={b.x} y={b.y} width={b.w * 0.7} height={b.h * 0.7}
          fill="#9FB4CC" opacity={0.1 + b.tone * 0.16} />
      ))}
      {/* Flood extent — low backscatter reads as smooth water, rendered glowing */}
      <g opacity={0.95}>
        <path d={riverPath} stroke="#0EA5E9" strokeWidth={46 + floodPhase * 46} fill="none"
          strokeLinecap="round" opacity="0.16" style={{ filter: 'blur(9px)' }} />
        <path d={riverPath} stroke="url(#grad-flood)" strokeWidth={16 + floodPhase * 26} fill="none" strokeLinecap="round" />
        {buildings.filter((b) => b.near).map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={3 + b.tone * 7 * (0.5 + floodPhase)}
            fill="#38BDF8" opacity={0.28 + b.tone * 0.42} />
        ))}
      </g>
      <rect x="0" y="0" width="1000" height="760" filter="url(#fx-speckle)" opacity="0.16"
        style={{ mixBlendMode: 'screen' }} />
    </g>
  )
}
