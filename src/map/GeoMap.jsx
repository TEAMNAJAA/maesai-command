/* ══════════════════════════════════════════════════════════════════════════
   GEO MAP — the real geography, drawn from the project's spatial files
   · catchment : AOI-B (Myanmar) — THEOS-2 sectors, the next pass, cloud forecast
   · urban     : AOI-A town — 10 operational zones (real roofs), shelters, hospital,
                 base; act 2 adds radar depth, drifting clouds, flowing water,
                 stranded groups, boats on their routes, live current, comms
   · corridor  : the Sai embankment on sphere imagery (zoom 16–17) — flood wall,
                 14 gaps with water jetting through, the N ruler
   All coordinates are WGS84 → Web Mercator so sphere tiles and the DEM align.
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useMemo, useRef, useCallback } from 'react'
import { DATA, THEOS2, SPHERE, EMBANKMENT, THRESHOLDS, ACT2, BOAT_INCIDENT } from '../config/missionConfig'
import { SECTORS, CAMP_SITES, HOSPITAL, SHELTER_POOL } from '../config/scenarioData'
import {
  makeProjection, geomPath, linePath, boxKm, aoiFeature, aoiStations, aoiRiver, osmRivers, osmRoads, saiRiver, roadWeight, tilesFor, elevationAt, metres,
} from '../lib/geo'
import { depthAt, sandbagFailAt } from '../lib/sim'
import { sphereTileTemplate } from '../lib/sphere'
import { BUILDINGS, COMMUNITIES_LIVE } from '../lib/buildings'
import { SECTIONS } from '../lib/sections'
import { EMBANKMENT_GAPS, EMBANKMENT_WALL, EMBANKMENT_RIVER, CHANNEL_RULER } from '../lib/embankment'
import { cloudCells, CLOUD_BOX } from '../lib/clouds'
import { alongRoute } from '../lib/routes'
import { TOWN_TARGET } from '../lib/scenario'
import { campOf } from '../engine/world'
import { sfviHex } from '../panels/datahub'

export const EXTENTS = {
  catchment: { bbox: [99.37, 20.3, 99.9, 20.615], dem: 'catchment', label: 'AOI-B · ลุ่มน้ำสายตอนบน (เมียนมา)' },
  urban: { bbox: [99.862, 20.418, 99.908, 20.456], dem: 'urban', label: 'AOI-A · เขตเมืองแม่สาย · 10 โซนปฏิบัติการ' },
  corridor: { bbox: EMBANKMENT.bbox, dem: 'urban', label: 'แนวตลิ่งแม่น้ำสาย · เขตเมืองแม่สาย' },
}
const SWATH_H_KM = 11
const halo = { paintOrder: 'stroke', stroke: '#000', strokeWidth: 3.5, strokeLinejoin: 'round' }
const EASE = 'fill-opacity 1.4s ease, fill 1.4s ease, stroke 1.4s ease, opacity 1.4s ease, stroke-width 1.4s ease'

/** A boat on the map: glides between clock steps (CSS transition) and leaves a V wake behind it. */
function MapBoat({ proj, pos, ahead, hex, label, labelHex }) {
  const [x, y] = proj.pt(pos)
  const [ax, ay] = ahead ? proj.pt(ahead) : [x + 1, y]
  const ang = (Math.atan2(ay - y, ax - x) * 180) / Math.PI
  return (
    <g pointerEvents="none" style={{ transform: `translate(${x}px, ${y}px)`, transition: 'transform .5s linear' }} data-map-boat>
      <g transform={`rotate(${ang.toFixed(1)})`} className="fx-heavy">
        <path d="M-7 -4 L-26 -12 M-7 4 L-26 12" stroke="#e0f2fe" strokeWidth="1.6" strokeLinecap="round" className="wake" />
        <circle cx="-14" cy="0" r="2.2" fill="#fff" opacity="0.45" />
      </g>
      <circle r="7" fill={hex} stroke="#fff" strokeWidth="1.5" />
      <text x="9" y="4" fontSize="9.5" className="num" fill={labelHex} style={halo}>{label}</text>
    </g>
  )
}

/** Grow a bbox about its centre (imagery also fills the letterbox around the frame). */
const grow = ([w, s, e, n], fx, fy) => {
  const cx = (w + e) / 2, cy = (s + n) / 2, hx = ((e - w) / 2) * fx, hy = ((n - s) / 2) * fy
  return [cx - hx, cy - hy, cx + hx, cy + hy]
}

export function GeoMap({ extent, eng, onHover, onPoint, onSector, onChannel, gapSel, onGap, beacon }) {
  const { s, scn } = eng
  const L = s.layers
  const ex = EXTENTS[extent]
  const proj = useMemo(() => makeProjection(ex.bbox, 1000, 760, extent === 'catchment' ? 18 : 0), [extent])
  const dem = DATA.dem[ex.dem]
  const svgRef = useRef(null)
  const town = extent !== 'catchment'
  const tiles = useMemo(() => (SPHERE.basemap[extent] || extent === 'urban'
    ? tilesFor({ ...proj, bbox: grow(proj.bbox, 1.45, 1.35) }, sphereTileTemplate(), 140, 1) : []), [proj, extent])

  /* real GISTDA roofs as compound paths, split dry / flood-reach */
  const roofs = useMemo(() => {
    if (!town || !BUILDINGS.length) return null
    const [bw, bs, be, bn] = grow(proj.bbox, 1.6, 1.5)
    const zoneOf = new Map(SECTIONS.flatMap((z) => z.idx.map((i) => [i, z.id])))
    let dry = '', wet = ''
    const zone = Object.fromEntries(SECTIONS.map((z) => [z.id, '']))
    BUILDINGS.forEach((b, idx) => {
      if (b.c[0] < bw || b.c[0] > be || b.c[1] < bs || b.c[1] > bn) return
      let d = ''
      for (let i = 0; i < b.ring.length; i++) { const [x, y] = proj.pt(b.ring[i]); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) }
      d += 'Z'
      if (b.flood) wet += d; else dry += d
      const z = zoneOf.get(idx)
      if (z) zone[z] += d
    })
    return { dry, wet, zone }
  }, [town, proj])

  const handleMove = useCallback((e) => {
    if (!onHover || !svgRef.current) return
    const m = svgRef.current.getScreenCTM()
    if (!m) return
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
    const [lon, lat] = proj.toLonLat(pt.x, pt.y)
    onHover({ lon, lat, elev: elevationAt(dem, lon, lat) })
  }, [proj, dem, onHover])

  return (
    <svg ref={svgRef} viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full"
      style={town ? { overflow: 'visible' } : undefined} onPointerMove={handleMove} onPointerLeave={() => onHover?.(null)} data-extent={extent}>
      <defs>
        <filter id="geo-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="cloud-soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14" /></filter>
        <pattern id="flood-ripple" width="46" height="20" patternUnits="userSpaceOnUse">
          <path d="M0 10 Q11.5 4 23 10 T46 10" stroke="#e0f2fe" strokeOpacity="0.55" strokeWidth="1" fill="none" />
          <path d="M-12 18 Q0 13 11 18 T34 18 T57 18" stroke="#bae6fd" strokeOpacity="0.3" strokeWidth="0.8" fill="none" />
          <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="46 0" dur="6s" repeatCount="indefinite" />
        </pattern>
      </defs>
      <rect x="-500" y="-400" width="2000" height="1560" fill="#060b14" />
      {dem && (L.elev || town) && (() => {
        const r = proj.rect(dem.bbox)
        return <image href={dem.href} x={r.x} y={r.y} width={r.w} height={r.h} preserveAspectRatio="none" opacity="0.9" />
      })()}
      {tiles.map((t) => <image key={t.key} href={t.href} x={t.x} y={t.y} width={t.w + 0.6} height={t.h + 0.6} preserveAspectRatio="none" />)}
      {tiles.length > 0 && <rect x="-500" y="-400" width="2000" height="1560" fill="#04080f" opacity={extent === 'urban' ? 0.3 : 0.12} pointerEvents="none" />}

      {extent === 'catchment' && <Catchment eng={eng} proj={proj} onSector={onSector} />}
      {extent === 'urban' && <Urban eng={eng} proj={proj} roofs={roofs} onPoint={onPoint} />}
      {extent === 'corridor' && <Corridor eng={eng} proj={proj} roofs={roofs} gapSel={gapSel} onGap={onGap} onChannel={onChannel} beacon={beacon} />}
    </svg>
  )
}

/* ── Catchment (act 1 tasking) ───────────────────────────────────────────── */

function Catchment({ eng, proj, onSector }) {
  const { s, scn } = eng
  const L = s.layers
  const aoiB = aoiFeature('AOI-B'), aoiB1 = aoiFeature('AOI-B1')
  const next = scn.passes.find((p) => p.t > s.clock)
  const chosen = next ? s.taskings[next.id] || [] : []
  return (
    <g>
      {aoiB && <path d={geomPath(aoiB.geometry, proj)} fill="#FFB300" fillOpacity={L.watershed ? 0.07 : 0.03} stroke="#FFB300" strokeWidth={L.watershed ? 2.2 : 1.2} strokeDasharray="10 6" opacity="0.9" />}
      {aoiB1 && <path d={geomPath(aoiB1.geometry, proj)} fill="none" stroke="#FFD066" strokeWidth="1" strokeDasharray="3 5" opacity="0.7" />}
      {(() => { const r = proj.rect([99.83, 20.405, 99.965, 20.475]); return <g><rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#38BDF8" fillOpacity="0.07" stroke="#38BDF8" strokeWidth="1.4" /><text x={r.x + 4} y={r.y - 6} fontSize="11" fill="#7dd3fc" className="font-mono">AOI-A · MAE SAI (ตัวเมือง)</text></g> })()}
      {aoiRiver && (
        <>
          <path d={linePath(aoiRiver.geometry.coordinates, proj)} stroke="#0b1d33" strokeWidth="5" fill="none" opacity="0.7" />
          <path d={linePath(aoiRiver.geometry.coordinates, proj)} stroke="#38BDF8" strokeWidth="2.2" fill="none" opacity="0.95" strokeDasharray="10 6" className="animate-[dashflow_6s_linear_infinite]" />
        </>
      )}
      {SECTORS.map((sec) => {
        const r = proj.rect(boxKm(sec.lon, sec.lat, THEOS2.swathKm, SWATH_H_KM))
        const imgs = s.images.filter((i) => i.target === sec.id)
        const good = imgs.find((i) => i.usable)
        const reach = next?.reach.includes(sec.id)
        const on = chosen.includes(sec.id)
        const f = next?.forecast[sec.id]
        const tone = on ? '#38BDF8' : good ? '#22E36B' : reach ? '#FFD066' : '#64748b'
        const marked = good?.analyzed ? Object.values(good.labels).filter((v) => v === 'scar').length : null
        return (
          <g key={sec.id} className={reach ? 'cursor-pointer' : ''} data-sector={sec.id} onClick={() => reach && onSector?.(next.id, sec.id)}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="2" fill={tone} fillOpacity={on ? 0.18 : good ? 0.1 : 0.04}
              stroke={tone} strokeWidth={on ? 2.6 : 1.3} strokeDasharray={good || on ? undefined : '8 5'} />
            <text x={r.x + 6} y={r.y + 15} fontSize="11.5" className="font-mono" letterSpacing="1.2" fill="#CFE6FF" style={halo}>{sec.label}</text>
            <text x={r.x + 6} y={r.y + 28} fontSize="9" className="font-thai" fill="#bae6fd" style={halo}>{sec.th}</text>
            {reach && f !== undefined && (
              <g>
                <text x={r.x + r.w - 6} y={r.y + 16} textAnchor="end" fontSize="13" style={halo} fill={f > THEOS2.cloudUsablePct ? '#FF9DB2' : f > 40 ? '#FFE0A3' : '#BFF5CF'}>☁ {f}%</text>
                <text x={r.x + r.w - 6} y={r.y + 30} textAnchor="end" fontSize="9" className="font-thai" fill="#FFE0A3" style={halo}>{on ? `สั่งถ่ายรอบ ${next.id}` : `คลิกเพื่อสั่งถ่ายรอบ ${next.id}`}</text>
              </g>
            )}
            <text x={r.x + 6} y={r.y + r.h - 8} fontSize="9.5" className="font-thai" style={halo}
              fill={good ? '#7CFFA0' : imgs.length ? '#FF9DB2' : '#94a3b8'}>
              {good ? (marked === null ? 'ภาพพร้อม — รอแปล' : `แปลแล้ว · ระบุดินถล่ม ${marked} จุด`) : imgs.length ? 'ถ่ายแล้วแต่เมฆบัง' : 'ยังไม่มีภาพ THEOS-2'}
            </text>
            {sec.widthAt && <text x={r.x + 6} y={r.y + r.h - 22} fontSize="9" className="font-thai" fill="#7dd3fc" style={halo}>ลำน้ำคอด — วัด N ได้</text>}
          </g>
        )
      })}
      {aoiStations.map((f) => {
        const [x, y] = proj.pt(f.geometry.coordinates)
        const key = f.properties.id === 'STN0029' ? 'W' : f.properties.id === 'MYA001' ? 'R' : null
        return (
          <g key={f.properties.id}>
            <circle cx={x} cy={y} r={key ? 6 : 3.5} fill={key ? '#22E36B' : '#9ae6b4'} stroke="#04140a" strokeWidth="1.5" />
            {key && <text x={x + 9} y={y - 6} fontSize="10.5" className="font-mono" fill="#7CFFA0" style={halo}>{f.properties.id} · {key === 'W' ? 'ระดับน้ำ (W)' : 'ฝนต้นน้ำ (R)'}</text>}
          </g>
        )
      })}
      <text x="500" y="748" textAnchor="middle" fontSize="12" fill="#FFB300" className="font-mono" letterSpacing="2" style={halo}>MYANMAR — UPSTREAM CATCHMENT · NO GROUND SENSORS · ≈965 KM²</text>
    </g>
  )
}

/* ── Urban: zones, operations ────────────────────────────────────────────── */

function Urban({ eng, proj, roofs, onPoint }) {
  const { s, scn, sfvi } = eng
  const L = s.layers
  const act2 = s.act === 2
  const t = s.clock
  const lastRadar = s.radarAt[s.radarAt.length - 1] ?? 0
  const score = Object.fromEntries(sfvi.perSection.map((z) => [z.id, z.score]))
  const cells = act2 ? cloudCells(scn, t) : []
  const cloudPos = cells.flatMap((c, i) => [-1, 0, 1].flatMap((ox) => [-1, 0, 1].map((oy) => {
    const lon = c.lon + ox * (CLOUD_BOX[2] - CLOUD_BOX[0]), lat = c.lat + oy * (CLOUD_BOX[3] - CLOUD_BOX[1])
    const [x, y] = proj.pt([lon, lat])
    return x < -300 || x > 1300 || y < -300 || y > 1060 ? null : { key: `${i}${ox}${oy}`, x, y, r: c.rM / proj.metresPerPx }
  }))).filter(Boolean)
  const camp = campOf(s)
  const px = (m) => m / proj.metresPerPx
  const boats = act2 ? s.jobs.filter((j) => j.kind === 'boatAtPoint' || j.kind === 'boatAtDest') : []
  const swell = Math.max(0, Math.min(1, (eng.world.level - 3.6) / 1.8))      // 0 at normal flow → 1 at the peak
  // static geometry projected once per view (re-projecting every road on each order made clicks lag)
  const geo = useMemo(() => ({
    hull: Object.fromEntries(SECTIONS.map((z) => [z.id, linePath([...z.hull, z.hull[0]], proj)])),
    roads: osmRoads.map((f) => ({ f, d: linePath(f.geometry.coordinates, proj), w: roadWeight(f.properties.class) })),
    rivers: (L.river ? osmRivers : saiRiver).map((f) => ({ f, d: linePath(f.geometry.coordinates, proj) })),
  }), [proj, L.river])
  return (
    <g>
      {/* zones: a soft boundary + the zone's real roofs tinted by the metric that matters now */}
      {SECTIONS.map((z) => {
        const d = act2 ? depthAt(s, z, lastRadar) : 0
        const ordered = s.orders[z.id] !== undefined
        const hex = act2 ? (d >= ACT2.deepWaterM ? '#3b82f6' : d >= 0.3 ? '#7dd3fc' : '#94a3b8') : sfviHex(score[z.id])
        return (
          <g key={z.id} data-zone={z.id}>
            <path d={geo.hull[z.id]} style={{ fill: hex, fillOpacity: act2 ? Math.min(0.32, d / 5) : 0.05, transition: EASE }}
              stroke={ordered ? '#22E36B' : hex} strokeOpacity={0.75} strokeWidth={ordered ? 2.4 : 1.1} strokeDasharray={ordered ? undefined : '5 4'} />
            {roofs && <path d={roofs.zone[z.id]} style={{ fill: hex, fillOpacity: act2 ? 0.55 : 0.32, stroke: hex, transition: EASE }} strokeOpacity="0.8" strokeWidth="0.5" pointerEvents="none" />}
          </g>
        )
      })}
      {/* water flowing through flooded zones (act 2) */}
      {act2 && SECTIONS.map((z) => {
        const d = depthAt(s, z, t)
        if (d < 0.3) return null
        return (
          <g key={`fl${z.id}`} pointerEvents="none">
            <path d={geo.hull[z.id]} fill="url(#flood-ripple)" className="fx-heavy" style={{ opacity: Math.min(0.85, 0.2 + d / 2.2), transition: EASE }} />
            <path d={geo.hull[z.id]} fill="none" stroke="#bfdbfe" strokeOpacity={Math.min(0.7, d / 2.5)}
              strokeWidth="1.6" strokeDasharray="3 9" className="animate-[waterflow_14s_linear_infinite]" />
          </g>
        )
      })}
      {/* live current: the zone outline flickers and sparks until the power is cut */}
      {act2 && s.hazardsLive.filter((id) => !s.powerCut[id]).map((id) => {
        const z = SECTIONS.find((x) => x.id === id)
        const [x, y] = proj.pt(z.c)
        return (
          <g key={`pw${id}`} pointerEvents="none" data-power-live={id}>
            <path d={geo.hull[id]} fill="#FDE047" stroke="#FDE047" strokeWidth="2.2" className="power-flick" />
            {[[-26, 14], [18, 22], [-6, 34]].map(([dx, dy], i) => (
              <path key={i} d={`M${x + dx} ${y + dy} l4 -7 l-3 0 l4 -7`} stroke="#FEF08A" strokeWidth="1.6" fill="none" strokeLinecap="round" className="spark-flick fx-heavy" style={{ animationDelay: `${i * 0.37}s` }} />
            ))}
          </g>
        )
      })}
      {L.roads && geo.roads.map(({ f, d, w }) => {
        const blocked = act2 && scn.blockedRoads.includes(f.properties.osm)
        return <path key={f.properties.osm} d={d} fill="none" stroke={blocked ? '#FF3B63' : w > 1 ? '#E8E2D4' : '#9FB4CC'} strokeWidth={blocked ? 3 : w} strokeDasharray={blocked ? '4 3' : undefined} opacity={blocked ? 0.95 : w > 1 ? 0.75 : 0.4} />
      })}
      {L.buildings && roofs && (
        <g pointerEvents="none" opacity="0.6">
          <path d={roofs.dry} fill="none" stroke="#F1F5F9" strokeOpacity="0.35" strokeWidth="0.5" />
        </g>
      )}
      {geo.rivers.map(({ f, d }) => {
        const main = f.properties.class === 'river'
        return (
          <g key={`r${f.properties.osm}`}>
            <path d={d} fill="none" stroke="#38BDF8" style={{ strokeWidth: main ? 3.4 * (1 + swell * 1.8) : 1.4, transition: EASE }} opacity="0.95" filter="url(#geo-glow)" />
            {main && <path d={d} fill="none" stroke="#e0f2fe" strokeWidth="1.4" strokeDasharray="6 10" className="animate-[waterflow_9s_linear_infinite]" style={{ animationDuration: `${(9 - 6.5 * swell).toFixed(1)}s` }} opacity="0.8" />}
            {main && swell > 0.35 && <path d={d} fill="none" stroke="#fff" strokeWidth="0.9" strokeDasharray="2 17" className="fx-heavy animate-[waterflow_9s_linear_infinite]" style={{ animationDuration: `${(5.5 - 3.5 * swell).toFixed(1)}s` }} opacity={0.35 + swell * 0.4} />}
          </g>
        )
      })}
      {/* evacuation routes computed for ordered zones (Sphere / offline) */}
      {Object.entries(s.routes).map(([id, r]) => (
        <path key={`ev${id}`} d={linePath(r.coords, proj)} fill="none" stroke="#22E36B" strokeWidth="2.6" strokeOpacity="0.85"
          strokeDasharray={r.source === 'sphere' ? undefined : '8 5'} className="animate-[dashflow_9s_linear_infinite]" />
      ))}
      {/* active boat routes */}
      {boats.map((j, i) => <path key={`br${i}`} d={linePath(j.coords, proj)} fill="none" stroke="#FFB27A" strokeWidth="2" strokeOpacity="0.55" strokeDasharray="5 4" />)}

      {/* zone labels */}
      {SECTIONS.map((z) => {
        const [x, y] = proj.pt(z.c)
        const d = act2 ? depthAt(s, z, lastRadar) : null
        const power = s.hazardsLive.includes(z.id) && !s.powerCut[z.id]
        const comm = s.commDown.includes(z.id)
        return (
          <g key={`lb${z.id}`} pointerEvents="none">
            <text x={x} y={y - 4} textAnchor="middle" fontSize="13" fontWeight="700" className="num" fill="#F8FAFC" style={halo}>{z.id}</text>
            <text x={x} y={y + 10} textAnchor="middle" fontSize="9.5" className="font-thai" fill="#e2e8f0" style={halo}>
              {act2 ? `น้ำ ${d.toFixed(1)} ม.` : `SFVI ${score[z.id].toFixed(2)}`}{s.orders[z.id] !== undefined ? ' · สั่งอพยพ' : ''}
            </text>
            {power && <text x={x - 16} y={y + 28} fontSize="16" textAnchor="middle">⚡</text>}
            {comm && <text x={x + 2} y={y + 28} fontSize="13" textAnchor="middle" fill="#FF6B8A" className="num" style={halo}>📵</text>}
            {s.pumps[z.id] && <text x={x + 20} y={y + 28} fontSize="10" textAnchor="middle" fill="#7dd3fc" className="font-thai" style={halo}>{t >= s.pumps[z.id].readyAt ? 'สูบน้ำ' : 'ติดตั้งสูบ'}</text>}
            {act2 && scn.blindSpots.includes(z.id) && <text x={x} y={y - 18} fontSize="9" textAnchor="middle" fill="#C4B5FD" className="font-thai" style={halo}>จุดอับ</text>}
          </g>
        )
      })}
      {/* watch communities (act 1) */}
      {!act2 && COMMUNITIES_LIVE.map((c) => {
        const [x, y] = proj.pt([c.lon, c.lat])
        return <g key={c.id} pointerEvents="none"><circle cx={x} cy={y} r="3.5" fill="#FDE68A" stroke="#000" /><text x={x + 6} y={y - 5} fontSize="10.5" className="font-thai" fill="#FEF3C7" style={halo}>{c.th}</text></g>
      })}
      {/* destinations and base */}
      {[HOSPITAL, ...scn.shelters.map((id) => SHELTER_POOL.find((x) => x.id === id))].map((d) => {
        const [x, y] = proj.pt([d.lon, d.lat])
        const hosp = d.id === 'hosp'
        return (
          <g key={d.id} pointerEvents="none">
            <rect x={x - 8} y={y - 8} width="16" height="16" rx="3" fill={hosp ? '#0ea5e9' : '#16a34a'} stroke="#fff" strokeWidth="1.5" />
            <text x={x} y={y + 5} textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff">{hosp ? '+' : 'S'}</text>
            <text x={x + 12} y={y + 4} fontSize="10" className="font-thai" fill={hosp ? '#bae6fd' : '#bbf7d0'} style={halo}>{d.th}</text>
          </g>
        )
      })}
      {(s.act === 1 && !s.camp ? CAMP_SITES : camp ? [camp] : []).map((c) => {
        const [x, y] = proj.pt([c.lon, c.lat])
        return (
          <g key={c.id} pointerEvents="none" opacity={camp ? 1 : 0.75}>
            <path d={`M ${x} ${y - 12} L ${x + 10} ${y + 6} L ${x - 10} ${y + 6} Z`} fill={camp ? '#FFD066' : 'none'} stroke="#FFD066" strokeWidth="2" strokeDasharray={camp ? undefined : '3 2'} />
            <text x={x + 13} y={y + 4} fontSize="10" className="font-thai" fill="#FFE0A3" style={halo}>{camp ? `ฐาน: ${c.th}` : `ฐาน? ${c.th}`}</text>
          </g>
        )
      })}
      {/* stranded groups (only the ones found) */}
      {act2 && s.points.filter((p) => p.revealed).map((p) => {
        const [x, y] = proj.pt([p.lon, p.lat])
        const open = p.status === 'waiting'
        const urgent = open && p.deadline - t < 180
        const hex = !open ? (p.status === 'lost' ? '#64748b' : '#22E36B') : p.type === 'critical' ? '#FF3B63' : '#FFB300'
        return (
          <g key={p.id} className={open ? 'cursor-pointer' : ''} onClick={() => open && onPoint?.(p.id)} data-point-marker={p.id}>
            {open && <circle cx={x} cy={y} r="9" fill="none" stroke={hex} strokeWidth="1.6" className="sos-ring" style={{ animationDuration: urgent ? '1.1s' : '2.4s' }} />}
            {open && <circle cx={x} cy={y} r="9" fill="none" stroke={hex} strokeWidth="1.2" className="sos-ring fx-heavy" style={{ animationDuration: urgent ? '1.1s' : '2.4s', animationDelay: urgent ? '.55s' : '1.2s' }} />}
            {open && <text x={x} y={y - 12} textAnchor="middle" fontSize="7.5" fontWeight="900" fill={hex} className="animate-[flash_1.2s_steps(2)_infinite]" style={halo}>SOS</text>}
            <circle cx={x} cy={y} r="17" fill="transparent" />
            <circle cx={x} cy={y} r="8" fill={hex} stroke="#000" strokeWidth="1.6" />
            <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#000" className="num">{open ? p.left : '✓'}</text>
            {p.injured > 0 && open && <text x={x + 9} y={y - 7} fontSize="11" fill="#7dd3fc" fontWeight="800">+</text>}
            {open && <text x={x} y={y + 21} textAnchor="middle" fontSize="9" className="num" fill={urgent ? '#FF9DB2' : '#e2e8f0'} style={halo}>{Math.max(0, Math.floor((p.deadline - t) / 60))}h</text>}
          </g>
        )
      })}
      {/* boats on the move */}
      {act2 && s.jobs.filter((j) => j.kind === 'boatAtPoint').map((j) => {
        const outLeg = j.coords.slice(0, j.splitAt)
        const k = (t - j.start) / Math.max(1, j.at - j.start)
        const pos = alongRoute(outLeg, k)
        if (!pos) return null
        return <MapBoat key={`b${j.boat}${j.start}`} proj={proj} pos={pos} ahead={alongRoute(outLeg, Math.min(1, k + 0.04))} hex="#FF7A1A" label={j.boat} labelHex="#FFE0A3" />
      })}
      {act2 && s.jobs.filter((j) => j.kind === 'boatAtDest').map((j) => {
        const leave = j.pointAt + 15
        const leg = j.coords.slice(j.splitAt - 1)
        const k = (t - leave) / Math.max(1, j.at - leave)
        const pos = alongRoute(leg, k)
        if (!pos) return null
        return <MapBoat key={`bd${j.boat}${j.start}`} proj={proj} pos={pos} ahead={alongRoute(leg, Math.min(1, k + 0.04))} hex="#22E36B" label={`${j.boat} · ${j.aboard} คน`} labelHex="#BFF5CF" />
      })}
      {act2 && (s.incidents || []).filter((x) => t >= x.at && t < x.until).map((x) => {
        const pos = alongRoute(x.coords.slice(0, x.splitAt || x.coords.length), BOAT_INCIDENT.hazardAt)
        if (!pos) return null
        const [px0, py0] = proj.pt(pos)
        const shock = x.kind === 'shock'
        return (
          <g key={`inc${x.boat}${x.at}`} pointerEvents="none" data-incident={x.kind}>
            <circle cx={px0} cy={py0} r="13" fill="none" stroke={shock ? '#FDE047' : '#7DD3FC'} strokeWidth="1.6" strokeDasharray="3 3" className="animate-[spin_6s_linear_infinite]" style={{ transformOrigin: `${px0}px ${py0}px` }} />
            <circle cx={px0} cy={py0} r="7" fill="#64748b" stroke="#fff" strokeWidth="1.4" />
            <text x={px0} y={py0 + 4} textAnchor="middle" fontSize="10">{shock ? '⚡' : '🛟'}</text>
            <text x={px0 + 12} y={py0 + 4} fontSize="9.5" className="num" fill={shock ? '#FEF08A' : '#BAE6FD'} style={halo}>{x.boat} {shock ? 'ไฟช็อต' : 'ล่ม'} · ซ่อม {Math.max(1, Math.ceil((x.until - t) / 60))}h</text>
          </g>
        )
      })}
      {act2 && s.jobs.filter((j) => j.kind === 'drone').map((j) => {
        const z = SECTIONS.find((x) => x.id === j.section)
        const [x, y] = proj.pt(z.c)
        return <text key={`d${j.drone}`} x={x + 24} y={y - 14} fontSize="16" pointerEvents="none" className="animate-[flash_1.2s_ease-in-out_infinite]">🛸</text>
      })}
      {/* drifting clouds over town (act 2) */}
      {act2 && cloudPos.map(({ key, x, y, r }) => <circle key={`sh${key}`} cx={x + 22} cy={y + 30} r={r * 0.95} fill="#020617" opacity="0.28" filter="url(#cloud-soft)" pointerEvents="none" className="fx-heavy" />)}
      {act2 && cloudPos.map(({ key, x, y, r }) => <circle key={`c${key}`} cx={x} cy={y} r={r} fill="#f8fafc" opacity="0.5" filter="url(#cloud-soft)" pointerEvents="none" />)}
      <text x="500" y="40" textAnchor="middle" fontSize="13" fill="#8FA6C4" className="font-mono" letterSpacing="3" style={halo}>TACHILEIK · MYANMAR</text>
    </g>
  )
}

/* ── Corridor · the Sai embankment ───────────────────────────────────────── */

function Corridor({ eng, proj, roofs, gapSel, onGap, onChannel, beacon }) {
  const { s, scn } = eng
  const px = (m) => m / proj.metresPerPx
  const queued = new Set(s.jobs.filter((j) => j.kind === 'seal').map((j) => j.gap))
  const level = eng.world.level
  const surge = Math.max(0.15, Math.min(1, (level - 3.6) / 1.2))
  const shift = (p, [nx, ny], d) => [p[0] + (nx * d) / (111320 * Math.cos((p[1] * Math.PI) / 180)), p[1] + (ny * d) / 110540]
  const ruler = CHANNEL_RULER && (() => {
    const w = s.channel.measured ? scn.channel.widthM : 26
    const a = proj.pt(shift(CHANNEL_RULER.at, CHANNEL_RULER.normal, w / 2))
    const b = proj.pt(shift(CHANNEL_RULER.at, CHANNEL_RULER.normal, -w / 2))
    const lab = proj.pt(shift(CHANNEL_RULER.at, CHANNEL_RULER.normal, -95))
    return { a, b, lab }
  })()
  const riverImg = s.images.some((i) => i.usable && i.readyAt <= s.clock && ['D', 'E', TOWN_TARGET].includes(i.target))
  return (
    <g data-corridor>
      {s.channel.measured && EMBANKMENT_RIVER.length > 1 && (
        <path d={linePath(EMBANKMENT_RIVER, proj)} fill="none" stroke="#38BDF8" strokeWidth={px(THRESHOLDS.origChannelWidth)} strokeLinecap="round" strokeLinejoin="round" opacity="0.1" pointerEvents="none" />
      )}
      {roofs && (
        <g pointerEvents="none">
          <path d={roofs.dry} fill="#F8FAFC" fillOpacity="0.06" stroke="#F8FAFC" strokeOpacity="0.55" strokeWidth="0.7" />
          <path d={roofs.wet} fill="#38BDF8" fillOpacity="0.16" stroke="#7DD3FC" strokeOpacity="0.85" strokeWidth="0.75" />
        </g>
      )}
      {/* the river, flowing */}
      {EMBANKMENT_RIVER.length > 1 && (
        <g pointerEvents="none">
          <path d={linePath(EMBANKMENT_RIVER, proj)} fill="none" stroke="#3b82f6" strokeWidth={px(26)} strokeLinecap="round" opacity={0.25 + surge * 0.3} />
          <path d={linePath(EMBANKMENT_RIVER, proj)} fill="none" stroke="#dbeafe" strokeWidth="1.6" strokeDasharray="6 12" opacity="0.9" className="animate-[waterflow_5s_linear_infinite]" style={{ animationDuration: `${(5.5 - 3.5 * surge).toFixed(1)}s` }} />
          <path d={linePath(EMBANKMENT_RIVER, proj)} fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="2 15" opacity={0.25 + surge * 0.45} className="fx-heavy animate-[waterflow_5s_linear_infinite]" style={{ animationDuration: `${(3.6 - 2.4 * surge).toFixed(1)}s` }} transform="translate(0 4)" />
        </g>
      )}
      {/* water through open gaps — jets into town; sealed gaps drain away */}
      {EMBANKMENT_GAPS.map((g) => {
        const sealed = s.sealed.includes(g.id)
        const near = SECTIONS.reduce((m, z) => (metres([g.lon, g.lat], z.c) < metres([g.lon, g.lat], m.c) ? z : m))
        const dx = near.c[0] - g.lon, dy = near.c[1] - g.lat, dl = Math.hypot(dx * 104000, dy * 110540) || 1
        const reach = (sealed ? 0 : 60 + surge * 140)
        const end = [g.lon + (dx * 104000 / dl) * reach / 104000, g.lat + (dy * 110540 / dl) * reach / 110540]
        const [x0, y0] = proj.pt([g.lon, g.lat]), [x1, y1] = proj.pt(end)
        if (sealed) return <circle key={`j${g.id}`} cx={x0} cy={y0} r={px(30)} fill="#38BDF8" opacity="0.12" pointerEvents="none" className="animate-[breathe_4s_ease-in-out_infinite]" />
        return (
          <g key={`j${g.id}`} pointerEvents="none">
            <path d={`M ${x0} ${y0} L ${x1} ${y1}`} stroke="#60a5fa" strokeWidth={px(g.len) * 0.7 + 3} strokeLinecap="round" opacity={0.35 + surge * 0.3} />
            <path d={`M ${x0} ${y0} L ${x1} ${y1}`} stroke="#e0f2fe" strokeWidth="1.8" strokeDasharray="5 7" strokeLinecap="round" className="animate-[waterflow_3s_linear_infinite]" />
          </g>
        )
      })}
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
          const sealed = s.sealed.includes(g.id), q = queued.has(g.id)
          const sb = (s.sandbagged || []).includes(g.id), broke = sb && s.clock >= sandbagFailAt()
          const hex = broke ? '#FF003C' : sb ? '#D9A55B' : sealed ? '#22E36B' : q ? '#FFB300' : '#FF003C'
          return <path key={g.id} d={linePath(span, proj)} fill="none" stroke={hex} strokeWidth="4.5" strokeDasharray={sealed ? undefined : '3 3'} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${hex})` }} />
        })}
      </g>
      {ruler && (
        <g className={riverImg && !s.channel.measured ? 'cursor-pointer' : ''} onClick={() => riverImg && !s.channel.measured && onChannel?.()} data-ruler={s.channel.measured ? 'measured' : 'open'}>
          <line x1={ruler.a[0]} y1={ruler.a[1]} x2={ruler.lab[0]} y2={ruler.lab[1]} stroke="#E0F2FE" strokeWidth="1" strokeDasharray="2 3" opacity="0.8" />
          <line x1={ruler.a[0]} y1={ruler.a[1]} x2={ruler.b[0]} y2={ruler.b[1]} stroke={s.channel.measured ? '#22D3EE' : '#fff'} strokeWidth="2.4" strokeDasharray={s.channel.measured ? undefined : '3 2'} />
          {beacon === 'ruler' && !s.channel.measured && <circle cx={ruler.lab[0]} cy={ruler.lab[1]} r="16" fill="none" stroke="#FFD066" strokeWidth="1.6" className="animate-[pulsering_1.8s_ease-out_infinite]" style={{ transformOrigin: `${ruler.lab[0]}px ${ruler.lab[1]}px` }} />}
          <g transform={`translate(${ruler.lab[0]} ${ruler.lab[1]})`}>
            <rect x="-86" y="-15" width="172" height="30" rx="5" fill="#070D1C" fillOpacity="0.92" stroke={s.channel.measured ? '#22D3EE' : '#FFD066'} strokeWidth="1.2" />
            <text y="-2" textAnchor="middle" fontSize="11" fontWeight="700" className="font-thai" fill={s.channel.measured ? '#A5F3FC' : '#FFE0A3'}>
              {s.channel.measured ? `ลำน้ำเหลือ ${scn.channel.widthM} ม.` : riverImg ? 'คลิกวัดความกว้างลำน้ำ' : 'ต้องมีภาพ THEOS-2 ก่อน'}
            </text>
            <text y="10" textAnchor="middle" fontSize="9" className="font-thai" fill="#94A3B8">{s.channel.measured ? `เดิม 150 ม. · N = ${(1 - scn.channel.widthM / 150).toFixed(2)}` : 'ค่า N · คำนวณจากพิกเซล'}</text>
          </g>
        </g>
      )}
      {COMMUNITIES_LIVE.map((c) => {
        const [x, y] = proj.pt([c.lon, c.lat])
        return <g key={c.id} pointerEvents="none"><circle cx={x} cy={y} r="3.5" fill="#FDE68A" stroke="#000" strokeWidth="1.2" /><text x={x + 7} y={y + 4} fontSize="12" fontWeight="600" className="font-thai" fill="#FEF3C7" style={halo}>{c.th}</text></g>
      })}
      {EMBANKMENT_GAPS.map((g, i) => {
        const [x, y] = proj.pt([g.lon, g.lat])
        const sb = (s.sandbagged || []).includes(g.id), broke = sb && s.clock >= sandbagFailAt()
        const sealed = s.sealed.includes(g.id) && !broke, q = queued.has(g.id)
        const on = gapSel === g.id
        const hex = sb && !broke ? '#D9A55B' : sealed ? '#22E36B' : q ? '#FFB300' : '#FF003C'
        return (
          <g key={g.id} className="cursor-pointer" data-gap={g.id} data-sealed={sealed ? '1' : q ? 'q' : '0'} onClick={(e) => { e.stopPropagation(); onGap?.(on ? null : g, e) }}>
            <circle cx={x} cy={y} r="16" fill="transparent" />
            {!sealed && <circle cx={x} cy={y} r="10" fill="none" stroke={hex} strokeWidth="1.4" opacity="0.7" className="animate-[pulsering_2.4s_ease-out_infinite]" style={{ animationDelay: `${i * 0.17}s`, transformOrigin: `${x}px ${y}px` }} />}
            <circle cx={x} cy={y} r={on ? 8 : 6.5} fill={hex} stroke="#000" strokeWidth="1.3" style={{ filter: `drop-shadow(0 0 6px ${hex})` }} />
            {sealed ? <path d={`M ${x - 3} ${y} L ${x - 0.8} ${y + 2.4} L ${x + 3.2} ${y - 2.6}`} fill="none" stroke="#03140a" strokeWidth="1.8" strokeLinecap="round" /> : <circle cx={x} cy={y} r="2" fill="#fff" />}
            {on && <circle cx={x} cy={y} r="13" fill="none" stroke="#fff" strokeWidth="1.4" />}
          </g>
        )
      })}
      <text x="500" y="80" textAnchor="middle" fontSize="13" fill="#CBD5E1" className="font-mono" letterSpacing="3" style={halo}>TACHILEIK · MYANMAR</text>
      <text x="30" y="690" fontSize="13" fill="#CBD5E1" className="font-mono" letterSpacing="3" style={halo}>MAE SAI · THAILAND</text>
    </g>
  )
}
