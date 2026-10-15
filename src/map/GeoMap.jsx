/* ══════════════════════════════════════════════════════════════════════════
   GEO MAP — the real geography, drawn from the project's spatial files
   · catchment : AOI-B (DEM-derived, Myanmar) + THEOS-2 tasking swaths
   · urban     : AOI-A town core — 4 watch communities, OSM roads/rivers, routes
   · corridor  : the Sai embankment through town on sphere imagery (zoom 16–17) —
                 real roofs, the flood wall and its 14 gaps, the N ruler
   All coordinates are WGS84 → Web Mercator, so sphere tiles and the DEM align.
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useMemo, useRef, useCallback } from 'react'
import { DATA, THEOS2, OFFLINE_ROUTING, SPHERE, FLOOD_REACH, EMBANKMENT, HYDRO, THRESHOLDS } from '../config/missionConfig'
import { SECTORS, SHELTER } from '../config/scenarioData'
import {
  makeProjection, geomPath, linePath, boxKm, geomCentroid, aoiFeature, aoiStations, aoiRiver, osmRivers, osmRoads, saiRiver, roadWeight, tilesFor, elevationAt, isFloodedStreet,
} from '../lib/geo'
import { mulberry32 } from './terrain'
import { levelAt, ARRIVAL, safeFraction } from '../lib/sim'
import { sphereTileTemplate } from '../lib/sphere'
import { BUILDINGS, COMMUNITIES_LIVE } from '../lib/buildings'
import { EMBANKMENT_GAPS, EMBANKMENT_WALL, EMBANKMENT_RIVER, CHANNEL_RULER } from '../lib/embankment'

export const EXTENTS = {
  catchment: { bbox: [99.37, 20.3, 99.9, 20.615], dem: 'catchment', label: 'AOI-B · ลุ่มน้ำสายตอนบน (เมียนมา)' },
  urban: { bbox: [99.855, 20.414, 99.915, 20.458], dem: 'urban', label: 'AOI-A · เขตเมืองแม่สาย (4 ชุมชนเฝ้าระวัง)' },
  corridor: { bbox: EMBANKMENT.bbox, dem: 'urban', label: 'แนวตลิ่งแม่น้ำสาย · เขตเมืองแม่สาย' },
}

/** Grow a bbox about its centre (corridor imagery also fills the letterbox around the frame). */
const grow = ([w, s, e, n], fx, fy) => {
  const cx = (w + e) / 2, cy = (s + n) / 2, hx = ((e - w) / 2) * fx, hy = ((n - s) / 2) * fy
  return [cx - hx, cy - hy, cx + hx, cy + hy]
}

const SWATH_H_KM = 11

/** Deterministic scar positions inside each sector box (until GISTDA's landslide layer arrives). */
function sectorScars(sec) {
  const rnd = mulberry32(sec.id.charCodeAt(0) * 7919)
  const [w, s, e, n] = boxKm(sec.lon, sec.lat, THEOS2.swathKm * 0.8, SWATH_H_KM * 0.8)
  return Array.from({ length: sec.scars }, () => ({
    lon: w + rnd() * (e - w), lat: s + rnd() * (n - s), rot: rnd() * 180, len: 0.55 + rnd() * 0.5,
  }))
}
const SCARS = Object.fromEntries(SECTORS.map((sec) => [sec.id, sectorScars(sec)]))

export function GeoMap({ extent, eng, hoverSector, setHoverSector, onHover, focus, onCommunity, gapSel, onGap, beacon }) {
  const { s, sfvi } = eng
  const L = s.layers
  const ex = EXTENTS[extent]
  const proj = useMemo(() => makeProjection(ex.bbox, 1000, 760, extent === 'catchment' ? 18 : 0), [extent])
  const corridor = extent === 'corridor'
  const dem = DATA.dem[ex.dem]
  const svgRef = useRef(null)
  // sphere imagery basemap — Thai coverage only, so the Myanmar catchment keeps the SRTM relief
  const tiles = useMemo(() => {
    if (!SPHERE.basemap[extent]) return []
    // the embankment view keeps imagery under the letterbox too (its svg overflows the frame)
    return corridor ? tilesFor({ ...proj, bbox: grow(proj.bbox, 1.5, 1.4) }, sphereTileTemplate(), 140, 1) : tilesFor(proj, sphereTileTemplate(), 96, 1)
  }, [proj, extent, corridor])

  /* Real GISTDA roofs as a few compound paths (15k polygons → 6 SVG elements). */
  const roofs = useMemo(() => {
    if (extent === 'catchment' || !BUILDINGS.length) return null
    const [bw, bs, be, bn] = corridor ? grow(proj.bbox, 1.6, 1.5) : proj.bbox
    const ring = (r) => {
      let d = ''
      for (let i = 0; i < r.length; i++) { const [x, y] = proj.pt(r[i]); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) }
      return d + 'Z'
    }
    const out = { dry: '', wet: '', com: {} }
    for (const b of BUILDINGS) {
      if (corridor && (b.c[0] < bw || b.c[0] > be || b.c[1] < bs || b.c[1] > bn)) continue
      const d = ring(b.ring)
      if (b.community) {
        const k = (out.com[b.community] ||= { dry: '', wet: '' })
        if (b.flood) k.wet += d; else k.dry += d
      } else if (b.flood) out.wet += d
      else out.dry += d
    }
    return out
  }, [extent, proj, corridor])
  const act = s.act
  const level = levelAt(s.clock)
  const flooded = act === 2

  const handleMove = useCallback((e) => {
    if (!onHover || !svgRef.current) return
    const m = svgRef.current.getScreenCTM()
    if (!m) return
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    const [lon, lat] = proj.toLonLat(pt.x, pt.y)
    onHover({ lon, lat, elev: elevationAt(dem, lon, lat) })
  }, [proj, dem, onHover])

  const aoiB = aoiFeature('AOI-B'), aoiB1 = aoiFeature('AOI-B1'), aoiA = aoiFeature('AOI-A')
  const px = (m) => m / proj.metresPerPx

  return (
    <svg ref={svgRef} viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full"
      style={corridor ? { overflow: 'visible' } : undefined}
      onPointerMove={handleMove} onPointerLeave={() => onHover?.(null)}>
      <defs>
        <pattern id={`grid-${extent}`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(56,189,248,.07)" strokeWidth="1" />
        </pattern>
        <filter id="geo-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect x="0" y="0" width="1000" height="760" fill="#060b14" />
      <rect x="0" y="0" width="1000" height="760" fill={`url(#grid-${extent})`} />

      {/* DEM hillshade — SRTM relief, baked offline */}
      {(L.elev || corridor) && dem && (() => {
        const r = proj.rect(dem.bbox)
        return <image href={dem.href} x={r.x} y={r.y} width={r.w} height={r.h} preserveAspectRatio="none"
          opacity={tiles.length ? 0.45 : 0.92} style={tiles.length ? { mixBlendMode: 'multiply' } : undefined} />
      })()}
      {!L.elev && !corridor && <rect x="0" y="0" width="1000" height="760" fill="#0a1424" opacity="0.6" />}

      {/* GISTDA sphere imagery basemap (online + key); failed tiles stay transparent → DEM shows through */}
      {tiles.map((t) => (
        <image key={t.key} href={t.href} x={t.x} y={t.y} width={t.w + 0.6} height={t.h + 0.6} preserveAspectRatio="none" />
      ))}
      {tiles.length > 0 && !corridor && <rect x="0" y="0" width="1000" height="760" fill="#04080f" opacity="0.32" pointerEvents="none" />}
      {tiles.length > 0 && corridor && <rect x="-500" y="-400" width="2000" height="1560" fill="#04080f" opacity="0.12" pointerEvents="none" />}

      {/* real THEOS-2 imagery (when GISTDA delivers it) */}
      {L.theos && DATA.theosImagery.after && extent === 'urban' && (() => {
        const r = proj.rect(DATA.theosImagery.bbox)
        return <image href={DATA.theosImagery.after} x={r.x} y={r.y} width={r.w} height={r.h} preserveAspectRatio="none" />
      })()}

      {corridor && <CorridorScene eng={eng} proj={proj} roofs={roofs} gapSel={gapSel} onGap={onGap} beacon={beacon} />}

      {extent === 'catchment' && (
        <g>
          {/* AOI-B catchment polygon */}
          {aoiB && (
            <path d={geomPath(aoiB.geometry, proj)} fill="#FFB300" fillOpacity={L.watershed ? 0.07 : 0.03}
              stroke="#FFB300" strokeWidth={L.watershed ? 2.2 : 1.2} strokeDasharray="10 6" opacity="0.9" />
          )}
          {aoiB1 && (
            <path d={geomPath(aoiB1.geometry, proj)} fill="none" stroke="#FFD066" strokeWidth="1" strokeDasharray="3 5" opacity="0.7" />
          )}
          {aoiA && (() => {
            const r = proj.rect([99.83, 20.405, 99.965, 20.475])
            return (
              <g>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#38BDF8" fillOpacity="0.06" stroke="#38BDF8" strokeWidth="1.4" />
                <text x={r.x + 4} y={r.y - 6} fontSize="11" fill="#7dd3fc" className="font-mono">AOI-A · MAE SAI</text>
              </g>
            )
          })()}

          {/* LANDX: forest → mine/agri change, shaded per sector */}
          {L.landx && SECTORS.map((sec) => {
            const r = proj.rect(boxKm(sec.lon, sec.lat, THEOS2.swathKm, SWATH_H_KM))
            return <rect key={`lx${sec.id}`} x={r.x} y={r.y} width={r.w} height={r.h} fill="#C2410C" opacity={sec.forestLoss / 100 * 0.9} />
          })}

          {/* main stem from the AOI file */}
          {aoiRiver && (
            <>
              <path d={linePath(aoiRiver.geometry.coordinates, proj)} stroke="#0b1d33" strokeWidth="5" fill="none" opacity="0.7" />
              <path d={linePath(aoiRiver.geometry.coordinates, proj)} stroke="#38BDF8" strokeWidth={L.river ? 2.4 : 1.6} fill="none"
                opacity="0.95" filter="url(#geo-glow)" />
            </>
          )}

          {/* THEOS-2 tasking swaths */}
          {SECTORS.map((sec) => {
            const done = s.tasked.includes(sec.id)
            const cloudy = !done && s.cloudyPasses.includes(sec.id)
            const hot = hoverSector === sec.id
            const r = proj.rect(boxKm(sec.lon, sec.lat, THEOS2.swathKm, SWATH_H_KM))
            const tone = done ? '#22E36B' : cloudy ? '#A78BFA' : '#38BDF8'
            return (
              <g key={sec.id} className={act === 1 ? 'cursor-pointer' : ''} data-sector={sec.id}
                onMouseEnter={() => setHoverSector?.(sec.id)} onMouseLeave={() => setHoverSector?.(null)}
                onClick={() => act === 1 && eng.taskSwath(sec.id)}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="2"
                  fill={tone} fillOpacity={done ? 0.12 : hot ? 0.16 : 0.05}
                  stroke={tone} strokeWidth={hot ? 2.2 : 1.3} strokeDasharray={done ? '0' : '8 5'} />
                <text x={r.x + 6} y={r.y + 15} fontSize="11.5" className="font-mono" letterSpacing="1.2" fill={done ? '#7CFFA0' : '#CFE6FF'}
                  style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>{sec.label}</text>
                <text x={r.x + 6} y={r.y + 28} fontSize="9" className="font-thai" fill="#bae6fd"
                  style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 2.5 }}>{sec.th}</text>
                <text x={r.x + 6} y={r.y + r.h - 8} fontSize="9" className="font-mono"
                  fill={done ? '#FF6B8A' : cloudy ? '#C4B5FD' : '#94a3b8'} style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 2.5 }}>
                  {done ? `${sec.scars} NEW SCARS${sec.widthAt ? ` · W ${sec.widthAt} m` : ''}` : cloudy ? 'CLOUDED PASS' : `${THEOS2.swathKm} KM SWATH · ${act === 1 ? 'CLICK TO TASK' : 'NOT IMAGED'}`}
                </text>
                {done && SCARS[sec.id].map((k, i) => {
                  const [x, y] = proj.pt([k.lon, k.lat])
                  return <rect key={i} x={x - 2} y={y - 7 * k.len} width="4" height={14 * k.len} rx="1.5"
                    transform={`rotate(${k.rot} ${x} ${y})`} fill="#E0662F" stroke="#2b0d02" strokeWidth="0.6"
                    style={{ filter: 'drop-shadow(0 0 4px #FF5A2B)' }} />
                })}
              </g>
            )
          })}

          {/* GISTDA landslide layer (when delivered — DATA.landslides), revealed only inside imaged swaths */}
          {DATA.landslides?.features.map((f, i) => {
            const c = geomCentroid(f.geometry)
            if (!c) return null
            const seen = s.tasked.some((id) => {
              const sec = SECTORS.find((x) => x.id === id)
              const [w, so, e, n] = boxKm(sec.lon, sec.lat, THEOS2.swathKm, SWATH_H_KM)
              return c[0] >= w && c[0] <= e && c[1] >= so && c[1] <= n
            })
            if (!seen) return null
            return f.geometry.type === 'Point'
              ? <circle key={`ls${i}`} cx={proj.x(c[0])} cy={proj.y(c[1])} r="4" fill="#E0662F" stroke="#2b0d02" />
              : <path key={`ls${i}`} d={geomPath(f.geometry, proj)} fill="#E0662F" fillOpacity="0.8" stroke="#2b0d02" strokeWidth="0.6" />
          })}

          {/* stations */}
          {aoiStations.map((f) => {
            const [x, y] = proj.pt(f.geometry.coordinates)
            const key = f.properties.id === 'STN0029' ? 'W' : f.properties.id === 'MYA001' ? 'R' : null
            return (
              <g key={f.properties.id}>
                <circle cx={x} cy={y} r={key ? 6 : 3.5} fill={key ? '#22E36B' : '#9ae6b4'} stroke="#04140a" strokeWidth="1.5" />
                {key && (
                  <text x={x + 9} y={y - 6} fontSize="10.5" className="font-mono" fill="#7CFFA0"
                    style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>
                    {f.properties.id} · {key === 'W' ? 'ระดับน้ำ (W)' : 'ฝนต้นน้ำ (R)'}
                  </text>
                )}
              </g>
            )
          })}

          <text x="500" y="748" textAnchor="middle" fontSize="12" fill="#FFB300" className="font-mono" letterSpacing="2"
            style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>MYANMAR — UPSTREAM CATCHMENT · NO GROUND SENSORS · ≈965 KM²</text>
        </g>
      )}

      {extent === 'urban' && (
        <g>
          {/* simulated / radar flood extent */}
          {(flooded || (act === 1 && level >= 4.1)) && (
            DATA.radarFlood
              ? DATA.radarFlood.features.map((f, i) => (
                <path key={i} d={geomPath(f.geometry, proj)} fill="#FF8A3D" fillOpacity="0.28" stroke="#FF8A3D" strokeWidth="1" />
              ))
              : saiRiver.map((f) => (
                <path key={`fl${f.properties.osm}`} d={linePath(f.geometry.coordinates, proj)} stroke="#2563EB"
                  strokeWidth={px(flooded ? OFFLINE_ROUTING.floodBufferM * 2 : 160)} strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.26" />
              ))
          )}

          {/* OSM roads */}
          {L.roads && osmRoads.map((f) => {
            const w = roadWeight(f.properties.class)
            const mid = f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)]
            const wet = flooded && isFloodedStreet(mid)
            return (
              <path key={f.properties.osm} d={linePath(f.geometry.coordinates, proj)} fill="none"
                stroke={wet ? '#FF3B63' : w > 1 ? '#E8E2D4' : '#9FB4CC'} strokeWidth={w}
                strokeDasharray={wet ? '4 3' : undefined} opacity={w > 1 ? 0.8 : 0.42} />
            )
          })}

          {/* real GISTDA roofs — blue = inside the flood reach, tinted = assigned to a watch community */}
          {L.buildings && roofs && (
            <g pointerEvents="none" data-roofs={BUILDINGS.length}>
              <path d={roofs.dry} fill="#E2E8F0" fillOpacity="0.22" stroke="#F1F5F9" strokeOpacity="0.75" strokeWidth="0.5" />
              <path d={roofs.wet} fill="#38BDF8" fillOpacity={flooded ? 0.75 : 0.45} />
              {COMMUNITIES_LIVE.map((c) => {
                const k = roofs.com[c.id]
                if (!k) return null
                const order = s.evacOrders[c.id]
                const safe = order !== undefined ? safeFraction(c, order) : 0
                const hex = !L.pop ? '#38BDF8' : order !== undefined ? (safe >= 0.99 ? '#22E36B' : safe > 0 ? '#FFB300' : '#FF3B63') : s.clock >= ARRIVAL[c.id] ? '#FF003C' : '#FDE68A'
                return (
                  <g key={c.id}>
                    <path d={k.dry} fill="#F8FAFC" fillOpacity="0.45" stroke="#F8FAFC" strokeWidth="0.5" />
                    <path d={k.wet} fill={hex} fillOpacity="0.9" />
                  </g>
                )
              })}
            </g>
          )}

          {/* rivers — the Sai is the border, always drawn; the full network is a layer */}
          {(L.river ? osmRivers : saiRiver).map((f) => (
            <path key={`r${f.properties.osm}`} d={linePath(f.geometry.coordinates, proj)} fill="none"
              stroke="#38BDF8" strokeWidth={f.properties.class === 'river' ? 3.2 : 1.4} opacity="0.95" filter="url(#geo-glow)" />
          ))}

          {/* routes to the evacuation point */}
          {Object.values(s.routes).map((r) => (
            <g key={r.cid}>
              <path d={linePath(r.coords, proj)} fill="none" stroke="#000" strokeWidth="7" opacity="0.5" strokeLinejoin="round" />
              <path d={linePath(r.coords, proj)} fill="none" stroke="#22E36B" strokeWidth="3.6" strokeLinejoin="round"
                strokeDasharray={r.source === 'sphere' ? undefined : '10 6'} style={{ filter: 'drop-shadow(0 0 6px #22E36B)' }}
                className="animate-[dashflow_9s_linear_infinite]" />
            </g>
          ))}

          {/* shelter */}
          {(() => {
            const [x, y] = proj.pt([SHELTER.lon, SHELTER.lat])
            return (
              <g>
                <path d={`M ${x} ${y - 11} L ${x + 10} ${y + 7} L ${x - 10} ${y + 7} Z`} fill="#22E36B" fillOpacity="0.25" stroke="#22E36B" strokeWidth="1.8" />
                <text x={x + 14} y={y + 4} fontSize="11" className="font-thai" fill="#7CFFA0"
                  style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>{SHELTER.th}</text>
              </g>
            )
          })()}

          {/* stations in town */}
          {aoiStations.filter((f) => ['STN0029', 'MYA004', 'MYA002'].includes(f.properties.id)).map((f) => {
            const [x, y] = proj.pt(f.geometry.coordinates)
            const isW = f.properties.id === 'STN0029'
            return (
              <g key={f.properties.id}>
                <rect x={x - 5} y={y - 5} width="10" height="10" fill={isW ? '#22E36B' : '#9ae6b4'} stroke="#03120a" strokeWidth="1.3" transform={`rotate(45 ${x} ${y})`} />
                {isW && (
                  <text x={x - 8} y={y - 12} textAnchor="end" fontSize="10.5" className="font-mono" fill="#7CFFA0"
                    style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>STN0029 · {level.toFixed(2)} m</text>
                )}
              </g>
            )
          })}

          {/* the four watch communities */}
          {COMMUNITIES_LIVE.map((c) => {
            const [x, y] = proj.pt([c.lon, c.lat])
            const order = s.evacOrders[c.id]
            const arrived = s.clock >= ARRIVAL[c.id]
            const safe = order !== undefined ? safeFraction(c, order) : 0
            const hex = order !== undefined ? (safe >= 0.99 ? '#22E36B' : safe > 0 ? '#FFB300' : '#FF3B63') : arrived ? '#FF003C' : '#94A3B8'
            const rank = s.priorities.indexOf(c.id)
            const sel = focus === c.id
            const r = px(c.radiusM)
            const [lx, ly, anchor] = {
              w: [x - r - 8, y + 4, 'end'], e: [x + r + 8, y + 4, 'start'], n: [x, y - r - 18, 'middle'],
              s: [x, y + r + 16, 'middle'], sw: [x - r * 0.7 - 6, y + r * 0.7 + 14, 'end'],
            }[c.label || 's']
            return (
              <g key={c.id} className="cursor-pointer" data-community={c.id} onClick={() => onCommunity?.(c.id)}>
                {c.geometry
                  ? <path d={geomPath(c.geometry, proj)} fill={hex} fillOpacity={L.pop ? 0.22 : 0.08} stroke={hex} strokeWidth={sel ? 3 : 1.6} />
                  : <circle cx={x} cy={y} r={px(FLOOD_REACH.communityZoneM)} fill={hex} fillOpacity={sel ? 0.12 : 0.04} stroke={hex}
                    strokeWidth={sel ? 2.6 : 1.2} strokeDasharray="6 4" opacity="0.85" />}
                <circle cx={x} cy={y} r="4" fill={hex} />
                {rank >= 0 && (
                  <g>
                    <circle cx={x + r * 0.72} cy={y - r * 0.72} r="10" fill="#FFB300" stroke="#000" strokeWidth="1.5" />
                    <text x={x + r * 0.72} y={y - r * 0.72 + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="#04121F" className="font-mono">{rank + 1}</text>
                  </g>
                )}
                <text x={lx} y={ly} textAnchor={anchor} fontSize="12.5" className="font-thai" fill="#F1F7FF" fontWeight="600"
                  style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3.5 }}>{c.th}</text>
                {L.pop && (
                  <text x={lx} y={ly + 14} textAnchor={anchor} fontSize="10" className="font-thai" fill="#e2e8f0"
                    style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>
                    {c.floodRoofs}/{c.households} หลังคาในเขตน้ำถึง · {c.exits} ทางออก
                  </text>
                )}
              </g>
            )
          })}

          <text x="500" y="70" textAnchor="middle" fontSize="13" fill="#8FA6C4" className="font-mono" letterSpacing="3"
            style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>TACHILEIK · MYANMAR</text>
          <text x="500" y="735" textAnchor="middle" fontSize="13" fill="#8FA6C4" className="font-mono" letterSpacing="3"
            style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>MAE SAI · THAILAND</text>
        </g>
      )}
    </svg>
  )
}

/* ── Corridor · the Sai embankment through town ───────────────────────────── */

const halo = { paintOrder: 'stroke', stroke: '#000', strokeWidth: 3.5, strokeLinejoin: 'round' }

function CorridorScene({ eng, proj, roofs, gapSel, onGap, beacon }) {
  const { s } = eng
  const px = (m) => m / proj.metresPerPx
  const act1 = s.act === 1 && !s.act1Timeout
  const shift = (p, [nx, ny], d) => [p[0] + (nx * d) / (111320 * Math.cos((p[1] * Math.PI) / 180)), p[1] + (ny * d) / 110540]
  const ruler = CHANNEL_RULER && (() => {
    const w = s.channelMeasured ? s.channelWidth : HYDRO.trueChannelWidth
    const a = proj.pt(shift(CHANNEL_RULER.at, CHANNEL_RULER.normal, w / 2))
    const b = proj.pt(shift(CHANNEL_RULER.at, CHANNEL_RULER.normal, -w / 2))
    const lab = proj.pt(shift(CHANNEL_RULER.at, CHANNEL_RULER.normal, -95))   // label over the Myanmar bank
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0])
    const tick = (p) => [p[0] + Math.cos(ang + Math.PI / 2) * 6, p[1] + Math.sin(ang + Math.PI / 2) * 6, p[0] - Math.cos(ang + Math.PI / 2) * 6, p[1] - Math.sin(ang + Math.PI / 2) * 6]
    return { a, b, lab, ta: tick(a), tb: tick(b), w }
  })()

  return (
    <g data-corridor>
      {/* the pre-encroachment channel (~150 m) once THEOS-2 has measured what is left */}
      {s.channelMeasured && EMBANKMENT_RIVER.length > 1 && (
        <path d={linePath(EMBANKMENT_RIVER, proj)} fill="none" stroke="#38BDF8" strokeWidth={px(THRESHOLDS.origChannelWidth)}
          strokeLinecap="round" strokeLinejoin="round" opacity="0.1" pointerEvents="none" />
      )}

      {/* real GISTDA roofs as outlines, so the imagery stays readable underneath */}
      {roofs && (
        <g pointerEvents="none" data-roofs={BUILDINGS.length}>
          <path d={roofs.dry + Object.values(roofs.com).map((k) => k.dry).join('')} fill="#F8FAFC" fillOpacity="0.06" stroke="#F8FAFC" strokeOpacity="0.6" strokeWidth="0.7" />
          <path d={roofs.wet + Object.values(roofs.com).map((k) => k.wet).join('')} fill="#38BDF8" fillOpacity="0.16" stroke="#7DD3FC" strokeOpacity="0.9" strokeWidth="0.75" />
        </g>
      )}

      {/* river centreline (OSM) */}
      {EMBANKMENT_RIVER.length > 1 && (
        <path d={linePath(EMBANKMENT_RIVER, proj)} fill="none" stroke="#38BDF8" strokeWidth="1.4" strokeDasharray="8 6" opacity="0.75"
          className="animate-[dashflow_9s_linear_infinite]" pointerEvents="none" />
      )}

      {/* the flood wall, broken at every gap */}
      <g pointerEvents="none">
        {EMBANKMENT_WALL.pieces.map((piece, i) => (
          <g key={i}>
            <path d={linePath(piece, proj)} fill="none" stroke="#000" strokeWidth="6.5" opacity="0.55" strokeLinecap="round" strokeLinejoin="round" />
            <path d={linePath(piece, proj)} fill="none" stroke="#FCD34D" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        ))}
        {EMBANKMENT_GAPS.map((g) => {
          const span = EMBANKMENT_WALL.spans[g.id]
          if (!span || span.length < 2) return null
          const sealed = s.sealed.includes(g.id)
          return (
            <path key={g.id} d={linePath(span, proj)} fill="none" stroke={sealed ? '#22E36B' : '#FF003C'} strokeWidth="4.5"
              strokeDasharray={sealed ? undefined : '3 3'} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${sealed ? '#22E36B' : '#FF003C'})` }} />
          )
        })}
      </g>

      {/* N ruler across the channel */}
      {ruler && (
        <g className={act1 && !s.channelMeasured ? 'cursor-pointer' : ''} data-ruler={s.channelMeasured ? 'measured' : 'open'}
          onClick={() => act1 && !s.channelMeasured && eng.measureChannel()}>
          <line x1={ruler.a[0]} y1={ruler.a[1]} x2={ruler.lab[0]} y2={ruler.lab[1]} stroke="#E0F2FE" strokeWidth="1" strokeDasharray="2 3" opacity="0.8" />
          <line x1={ruler.a[0]} y1={ruler.a[1]} x2={ruler.b[0]} y2={ruler.b[1]} stroke="#000" strokeWidth="5" opacity="0.6" />
          <line x1={ruler.a[0]} y1={ruler.a[1]} x2={ruler.b[0]} y2={ruler.b[1]} stroke={s.channelMeasured ? '#22D3EE' : '#fff'} strokeWidth="2.4"
            strokeDasharray={s.channelMeasured ? undefined : '3 2'} />
          {[ruler.ta, ruler.tb].map((k, i) => <line key={i} x1={k[0]} y1={k[1]} x2={k[2]} y2={k[3]} stroke={s.channelMeasured ? '#22D3EE' : '#fff'} strokeWidth="2" />)}
          {beacon === 'ruler' && !s.channelMeasured && (
            <circle cx={ruler.lab[0]} cy={ruler.lab[1]} r="16" fill="none" stroke="#FFD066" strokeWidth="1.6"
              className="animate-[pulsering_1.8s_ease-out_infinite]" style={{ transformOrigin: `${ruler.lab[0]}px ${ruler.lab[1]}px` }} />
          )}
          <g transform={`translate(${ruler.lab[0]} ${ruler.lab[1]})`}>
            <rect x="-78" y="-15" width="156" height="30" rx="5" fill="#070D1C" fillOpacity="0.9" stroke={s.channelMeasured ? '#22D3EE' : '#FFD066'} strokeWidth="1.2" />
            <text y="-2" textAnchor="middle" fontSize="11" fontWeight="700" className="font-thai" fill={s.channelMeasured ? '#A5F3FC' : '#FFE0A3'}>
              {s.channelMeasured ? `ลำน้ำเหลือ ${Math.round(ruler.w)} ม.` : 'คลิกวัดความกว้างลำน้ำ'}
            </text>
            <text y="10" textAnchor="middle" fontSize="9" className="font-thai" fill="#94A3B8">
              {s.channelMeasured ? `เดิม ${THRESHOLDS.origChannelWidth} ม. · N = ${(1 - ruler.w / THRESHOLDS.origChannelWidth).toFixed(2)}` : 'ค่า N · ภาพ THEOS-2'}
            </text>
          </g>
        </g>
      )}

      {/* community names for orientation */}
      {COMMUNITIES_LIVE.map((c) => {
        const [x, y] = proj.pt([c.lon, c.lat])
        return (
          <g key={c.id} pointerEvents="none">
            <circle cx={x} cy={y} r="3.5" fill="#FDE68A" stroke="#000" strokeWidth="1.2" />
            <text x={x + 7} y={y + 4} fontSize="12" fontWeight="600" className="font-thai" fill="#FEF3C7" style={halo}>{c.th}</text>
          </g>
        )
      })}

      {/* the 14 gaps — click to seal */}
      {EMBANKMENT_GAPS.map((g, i) => {
        const [x, y] = proj.pt([g.lon, g.lat])
        const sealed = s.sealed.includes(g.id)
        const on = gapSel === g.id
        return (
          <g key={g.id} className="cursor-pointer" data-gap={g.id} data-sealed={sealed ? '1' : '0'}
            onClick={(e) => { e.stopPropagation(); onGap?.(on ? null : g, e) }}>
            <circle cx={x} cy={y} r="16" fill="transparent" />
            {!sealed && (
              <circle cx={x} cy={y} r="10" fill="none" stroke="#FF003C" strokeWidth="1.4" opacity="0.7"
                className="animate-[pulsering_2.4s_ease-out_infinite]" style={{ animationDelay: `${i * 0.17}s`, transformOrigin: `${x}px ${y}px` }} />
            )}
            {sealed ? (
              <g>
                <circle cx={x} cy={y} r={on ? 8 : 6.5} fill="#22E36B" stroke="#03140a" strokeWidth="1.4" style={{ filter: 'drop-shadow(0 0 5px #22E36B)' }} />
                <path d={`M ${x - 3} ${y} L ${x - 0.8} ${y + 2.4} L ${x + 3.2} ${y - 2.6}`} fill="none" stroke="#03140a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            ) : (
              <g>
                <circle cx={x} cy={y} r={on ? 7.5 : 6} fill="#FF003C" stroke="#2b0008" strokeWidth="1.2" style={{ filter: `drop-shadow(0 0 ${on ? 10 : 6}px #FF003C)` }} />
                <circle cx={x} cy={y} r="2" fill="#fff" />
              </g>
            )}
            {on && <circle cx={x} cy={y} r="13" fill="none" stroke="#fff" strokeWidth="1.4" />}
            {(on || i === 0 || i === EMBANKMENT_GAPS.length - 1) && (
              <text x={x} y={y + 22} textAnchor="middle" fontSize="9.5" className="font-mono" fill={sealed ? '#7CFFA0' : '#FF9DB2'} style={halo}>{g.id}</text>
            )}
          </g>
        )
      })}

      <text x="500" y="80" textAnchor="middle" fontSize="13" fill="#CBD5E1" className="font-mono" letterSpacing="3" style={halo}>TACHILEIK · MYANMAR</text>
      <text x="30" y="690" fontSize="13" fill="#CBD5E1" className="font-mono" letterSpacing="3" style={halo}>MAE SAI · THAILAND</text>
    </g>
  )
}
