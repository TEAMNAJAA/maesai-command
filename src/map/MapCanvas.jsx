/* ══════════════════════════════════════════════════════════════════════════
   MAP CANVAS — view switcher, 3D tilt, zoom/pan and on-map callouts
   Views:  corridor  · procedural THEOS-2 render of the urban embankment (act 1)
           catchment · real AOI-B geography + THEOS-2 tasking swaths  (act 1)
           urban     · real AOI-A town core — communities, roads, routes (acts 1–2)
           sar       · procedural RADARSAT-2 backscatter scene           (act 2)
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useRef, useCallback } from 'react'
import {
  AlertTriangle, CheckCircle2, X, Plus, Minus, MousePointer2, Hand, Maximize2, Mountain, Lock, Radar, Route,
} from 'lucide-react'
import { TerrainDefs, OpticalScene, SarScene, useTerrain } from './terrain'
import { GeoMap, EXTENTS } from './GeoMap'
import { Panel, Corners, Src, SrcLegend, Btn } from '../ui/atoms'
import { COMMUNITIES } from '../config/scenarioData'
import { clamp } from '../lib/format'
import { THRESHOLDS } from '../config/missionConfig'

export const VIEWS = {
  corridor: { th: 'แนวตลิ่งเมือง', en: 'URBAN EMBANKMENT', src: 'scenario', sensor: 'THEOS-2 · L3 ORTHO (ภาพจำลอง)' },
  catchment: { th: 'ลุ่มน้ำต้นน้ำ AOI-B', en: 'UPSTREAM CATCHMENT', src: 'radar', sensor: 'DEM SRTM · AOI GeoJSON' },
  urban: { th: '4 ชุมชน AOI-A', en: 'WATCH COMMUNITIES', src: 'measured', sensor: 'OpenStreetMap · AOI GeoJSON' },
  sar: { th: 'เรดาร์ SAR', en: 'RADARSAT-2', src: 'radar', sensor: 'RADARSAT-2 · C-BAND (ภาพจำลอง)' },
}
export const viewsForAct = (act) => (act === 2 ? ['sar', 'urban'] : ['catchment', 'urban', 'corridor'])

export function MapCanvas({ eng, view, setView, focus, onCommunity, onRouteTool, hint }) {
  const { s, sfvi, veto1 } = eng
  const terrain = useTerrain()
  const [hoverSector, setHoverSector] = useState(null)
  const [gapCard, setGapCard] = useState(null)
  const [routeDetail, setRouteDetail] = useState(false)
  const [tool, setTool] = useState('select')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [tilt, setTilt] = useState(false)
  const [cursor, setCursor] = useState(null)
  const drag = useRef(null)

  const act = s.act
  const L = s.layers
  const level = sfvi.world.level
  const floodPhase = clamp((level - 3.4) / 3, 0, 1)
  const isGeo = view === 'catchment' || view === 'urban'
  const meta = VIEWS[view]

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); setTilt(false) }

  const onPointerDown = useCallback((e) => {
    if (tool !== 'pan') return
    drag.current = { x: e.clientX, y: e.clientY, pan: { ...pan } }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }, [tool, pan])
  const onPointerMove = useCallback((e) => {
    if (!drag.current) return
    setPan({ x: drag.current.pan.x + (e.clientX - drag.current.x) / zoom, y: drag.current.pan.y + (e.clientY - drag.current.y) / zoom })
  }, [zoom])
  const onPointerUp = useCallback(() => { drag.current = null }, [])

  const sceneTransform = `${tilt ? 'perspective(1500px) rotateX(52deg) scale(1.22) ' : ''}scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-sky-400/15 bg-[#04070E]" data-map-view={view}>
      {/* ── Scene (tilt / zoom / pan apply here only) ───────────────────── */}
      <div className={`absolute inset-0 ${tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ transform: sceneTransform, transformOrigin: '50% 58%', transition: drag.current ? 'none' : 'transform .5s cubic-bezier(.4,0,.2,1)' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {isGeo ? (
          <GeoMap extent={view} eng={eng} hoverSector={hoverSector} setHoverSector={setHoverSector}
            onHover={tilt ? null : setCursor} focus={focus} onCommunity={onCommunity} />
        ) : (
          <ProceduralScene eng={eng} view={view} terrain={terrain} floodPhase={floodPhase}
            gapCard={gapCard} setGapCard={setGapCard} setRouteDetail={setRouteDetail} routeDetail={routeDetail} />
        )}
      </div>

      {/* ── Scan-line sheen + vignette ──────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-14 opacity-20 animate-[scanline_7s_linear_infinite]"
        style={{ background: 'linear-gradient(180deg, transparent, rgba(56,189,248,.22), transparent)' }} />
      <div className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(110% 80% at 50% 40%, transparent 58%, rgba(2,6,15,.7) 100%)' }} />

      {/* ── View switcher ───────────────────────────────────────────────── */}
      <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 gap-1 rounded-md border border-sky-400/20 bg-[#070D1C]/88 p-1 backdrop-blur-md">
        {viewsForAct(act).map((id) => (
          <button key={id} onClick={() => setView(id)} data-view={id}
            className={`btn whitespace-nowrap px-2.5 py-1.5 ${view === id
              ? 'border-sky-400/60 bg-sky-400/20 text-sky-100'
              : 'border-transparent text-sky-300/60 hover:text-sky-200'}`}>
            <span className="font-thai normal-case tracking-normal text-[10.5px]">{VIEWS[id].th}</span>
          </button>
        ))}
      </div>

      {/* ── Left toolbar ────────────────────────────────────────────────── */}
      <div className="absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-md border border-sky-400/20 bg-[#070D1C]/85 p-1 backdrop-blur-md">
        {[{ id: 'select', icon: MousePointer2, t: 'เลือก/คลิก' }, { id: 'pan', icon: Hand, t: 'เลื่อนแผนที่' }].map((t) => (
          <button key={t.id} onClick={() => setTool(t.id)} title={t.t}
            className={`grid h-7 w-7 place-items-center rounded transition
              ${tool === t.id ? 'bg-sky-400/20 text-sky-100 ring-1 ring-sky-400/50' : 'text-sky-300/60 hover:bg-white/10 hover:text-sky-200'}`}>
            <t.icon size={13} />
          </button>
        ))}
        <span className="my-0.5 h-px bg-sky-400/20" />
        <button title="ซูมเข้า" onClick={() => setZoom((z) => clamp(z + 0.25, 1, 3.5))} className="grid h-7 w-7 place-items-center rounded text-sky-300/60 hover:bg-white/10 hover:text-sky-200"><Plus size={13} /></button>
        <button title="ซูมออก" onClick={() => setZoom((z) => clamp(z - 0.25, 1, 3.5))} className="grid h-7 w-7 place-items-center rounded text-sky-300/60 hover:bg-white/10 hover:text-sky-200"><Minus size={13} /></button>
        <button title="รีเซ็ตมุมมอง" onClick={resetView} className="grid h-7 w-7 place-items-center rounded text-sky-300/60 hover:bg-white/10 hover:text-sky-200"><Maximize2 size={13} /></button>
        <span className="my-0.5 h-px bg-sky-400/20" />
        <button title="มุมมองเอียง 3D (ภูมิประเทศจาก DEM)" onClick={() => setTilt((t) => !t)} data-tilt={tilt ? 'on' : 'off'}
          className={`grid h-7 w-7 place-items-center rounded font-mono text-[9px] font-bold transition
            ${tilt ? 'bg-[#FF8A3D]/25 text-[#FFC59A] ring-1 ring-[#FF8A3D]/60' : 'text-sky-300/60 hover:bg-white/10 hover:text-sky-200'}`}>
          3D
        </button>
      </div>

      {/* ── Guided hint ─────────────────────────────────────────────────── */}
      {hint && <div className="absolute left-14 top-[58px] z-20 max-w-[330px]">{hint}</div>}

      {/* ── Act 1 corridor: flood-wall callouts ─────────────────────────── */}
      {view === 'corridor' && !gapCard && (
        <div className="pointer-events-none absolute bottom-12 left-1/2 z-20 -translate-x-1/2 animate-[fadeIn_.5s_ease-out]">
          <div className="flex items-center gap-2 rounded-md border border-[#FF003C]/45 bg-[#0B0F22]/85 px-3 py-1.5 backdrop-blur-md">
            <AlertTriangle size={11} className="text-[#FF003C] animate-[flash_1.4s_ease-in-out_infinite]" />
            <span className="font-thai text-[11px] text-[#FF9DB2]">พบจุดฟันหลอแนวกั้นน้ำ 14 จุด — คลิกหมุดสีแดงเพื่อดูรายละเอียด</span>
          </div>
        </div>
      )}
      {view === 'corridor' && gapCard && (
        <div className="absolute z-20 w-[220px] animate-[riseIn_.28s_ease-out]"
          style={{ left: `${clamp(gapCard.x / 1000, 0.04, 0.6) * 100}%`, top: `${clamp(gapCard.y / 760, 0.08, 0.6) * 100}%`, marginLeft: 26 }}>
          <Panel className="p-3" glow="#FF003C">
            <Corners color="rgba(255,0,60,.55)" />
            <button onClick={() => setGapCard(null)} className="absolute right-1.5 top-1.5 text-slate-500 hover:text-white"><X size={11} /></button>
            <div className="flex items-start gap-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[#FF003C]" />
              <div>
                <div className="text-[13px] font-semibold text-white">Missing Flood Wall</div>
                <div className="font-thai text-[10.5px] text-slate-400">จุดฟันหลอของแนวกั้นน้ำ</div>
              </div>
            </div>
            <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2.5">
              {[['Marker', gapCard.id, 'text-sky-200'], ['Risk Level', 'VERY HIGH', 'text-[#FF003C]'], ['Gap Length', `${gapCard.len} m`, 'text-white']].map(([k, v, c]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="hud-label">{k}</span><span className={`num text-[11px] font-bold ${c}`}>{v}</span>
                </div>
              ))}
              <div className="flex items-center justify-between"><span className="hud-label">Evidence</span><Src t="scenario" mini /></div>
              <div className="font-thai pt-1 text-[10px] leading-snug text-slate-400">ส่งบิ๊กแบ็กได้ที่แผงสั่งการ → ทรัพยากร</div>
            </div>
          </Panel>
        </div>
      )}

      {/* ── Act 2 SAR: blocked-route callout → opens the routing tool ────── */}
      {view === 'sar' && (
        <div className="absolute right-[13%] top-[24%] z-20 w-[244px]">
          <div className={`rounded-md border-2 px-3.5 py-3 backdrop-blur-md ${s.detourSolved
            ? 'border-[#22E36B]/60 bg-[#22E36B]/10' : 'border-[#FF003C] bg-[#FF003C]/12 animate-[softflash_1.4s_ease-in-out_infinite]'}`}
            style={{ boxShadow: s.detourSolved ? '0 0 26px -6px #22E36B88' : '0 0 30px -4px #FF003Caa' }}>
            <button onClick={() => setRouteDetail((v) => !v)} className="flex w-full items-center gap-2 text-left">
              {s.detourSolved ? <CheckCircle2 size={16} className="text-[#22E36B]" /> : <AlertTriangle size={16} className="text-[#FF003C]" />}
              <span className="font-mono text-[12px] font-bold tracking-[0.08em]" style={{ color: s.detourSolved ? '#7CFFA0' : '#FF3B63' }}>
                {s.detourSolved ? 'DETOUR ACTIVE' : 'ROUTE BLOCKED: LANDSLIDE'}
              </span>
            </button>
            <div className="font-thai mt-1.5 text-[10.5px] leading-snug text-slate-300/85">
              {s.detourSolved ? 'มีเส้นทางหนีน้ำที่คำนวณแล้ว — ดูบนมุมมอง 4 ชุมชน' : 'ถนน Mountain Route 7 ถูกดินโคลนตัดขาด สายลมจอยเหลือทางออกเส้นเดียว'}
            </div>
            {routeDetail && (
              <div className="mt-2 space-y-1 border-t border-white/15 pt-2 animate-[riseIn_.25s_ease-out]">
                {[['Debris run-out', '≈ 180 m'], ['Detected', 'T+0:15 · SAR change'], ['Cut off', 'สายลมจอย'], ['Exits left', '0 → ต้องหาเส้นทางเบี่ยง']].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-2">
                    <span className="hud-label">{k}</span><span className="font-thai text-[10px] text-white">{v}</span>
                  </div>
                ))}
                <div className="flex justify-end pt-0.5"><Src t="radar" mini /></div>
              </div>
            )}
            <Btn size="sm" variant={s.detourSolved ? 'go' : 'danger'} icon={Route} className="mt-2.5 w-full" onClick={onRouteTool}>
              <span className="font-thai normal-case tracking-normal">เปิดเครื่องมือ Sphere Routing</span>
            </Btn>
          </div>
        </div>
      )}

      {/* ── Act 2: cloud lock banner ────────────────────────────────────── */}
      {act === 2 && (
        <div className="absolute bottom-10 left-1/2 z-20 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-md border border-[#FF8A3D]/45 bg-[#0B0F22]/90 px-3 py-1.5 backdrop-blur-md">
            <Lock size={11} className="text-[#FF8A3D]" />
            <span className="font-thai text-[10.5px] text-[#FFC59A]">เมฆ 100% · ปิดภาพเชิงแสงอัตโนมัติ</span>
            <span className="h-3 w-px bg-white/15" />
            <Radar size={11} className="text-[#FF8A3D] animate-[glowpulse_2s_ease-in-out_infinite]" />
            <span className="font-mono text-[9.5px] tracking-[0.12em] text-[#FFC59A]">RADARSAT-2 · เช็คน้ำ ACTIVE</span>
          </div>
        </div>
      )}

      {/* ── Bottom-left readout ─────────────────────────────────────────── */}
      <div className="absolute bottom-2.5 left-3 z-20 flex items-center gap-2 rounded border border-sky-400/15 bg-[#060B17]/88 px-2.5 py-1 backdrop-blur">
        <span className="hud-label">SFVI</span>
        <span className="num text-[12px] font-bold" style={{ color: sfvi.basin >= 0.7 ? '#FF003C' : sfvi.basin >= 0.5 ? '#FFB300' : '#22E36B' }}>
          {sfvi.basin.toFixed(3)}
        </span>
        <span className="h-3 w-px bg-white/15" />
        <span className="hud-label">CONF</span>
        <span className="num text-[11px] text-sky-200">{Math.round(sfvi.confidence * 100)}%</span>
        <span className="h-3 w-px bg-white/15" />
        <span className="num text-[11px]" style={{ color: level >= THRESHOLDS.criticalLevel ? '#FF003C' : '#cbd5e1' }}>{level.toFixed(2)} m</span>
        {veto1 && (
          <>
            <span className="h-3 w-px bg-white/15" />
            <span className="font-mono text-[9.5px] font-bold tracking-[0.12em] text-[#FF003C] animate-[flash_1s_ease-in-out_infinite]">VETO 1</span>
          </>
        )}
      </div>

      {/* ── Top-right: provenance legend ────────────────────────────────── */}
      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-1 rounded border border-white/10 bg-[#060B17]/88 px-2 py-1.5 backdrop-blur" data-legend>
        <span className="font-thai text-[9.5px] text-slate-400">ป้ายที่มาข้อมูล</span>
        <SrcLegend vertical />
      </div>

      {/* ── Bottom-right: cursor read-out ───────────────────────────────── */}
      <div className="absolute bottom-2.5 right-3 z-20 flex max-w-[52%] flex-col items-end gap-1">
        <div className="flex max-w-full items-center gap-2 overflow-hidden whitespace-nowrap rounded border border-white/10 bg-[#060B17]/80 px-2 py-[3px] font-mono text-[9px] tracking-[0.08em] text-sky-300/60 backdrop-blur">
          {isGeo && cursor ? (
            <>
              <span>{cursor.lat.toFixed(4)}°N {cursor.lon.toFixed(4)}°E</span>
              {cursor.elev !== null && <><span className="h-3 w-px bg-white/10" /><span className="text-[#FFC59A]">ELEV {cursor.elev} m</span></>}
            </>
          ) : (
            <span>{isGeo ? EXTENTS[view].label : meta.en}</span>
          )}
          <span className="h-3 w-px bg-white/10" />
          <span>{meta.sensor}</span>
          <Src t={meta.src} mini />
        </div>
      </div>
    </div>
  )
}

/** The original procedural scenes (urban embankment render · SAR backscatter). */
function ProceduralScene({ eng, view, terrain, floodPhase, gapCard, setGapCard, setRouteDetail, routeDetail }) {
  const { s } = eng
  const L = s.layers
  const act = s.act
  const sar = view === 'sar'
  return (
    <svg viewBox="0 0 1000 760" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
      <TerrainDefs />
      {sar
        ? <SarScene terrain={terrain} floodPhase={floodPhase} />
        : <OpticalScene terrain={terrain} showBuildings={L.buildings || L.theos} />}

      {L.elev && terrain.ridges.map((r, i) => (
        <path key={`e${i}`} d={r.d} stroke={sar ? '#7FB2E5' : '#9ae6b4'} strokeWidth="0.7" fill="none" opacity="0.16" />
      ))}
      {L.river && !sar && (
        <path d={terrain.riverPath} stroke="#38BDF8" strokeWidth="2" fill="none" opacity="0.55"
          strokeDasharray="10 6" className="animate-[dashflow_9s_linear_infinite]" />
      )}
      {L.roads && (
        <g opacity={sar ? 0.85 : 0.6}>
          <path d="M 250 760 C 340 560, 400 420, 452 250 S 520 60, 560 -10" stroke={sar ? '#C9D6E8' : '#e8e2d4'} strokeWidth="2.6" fill="none" opacity="0.7" />
          <path d="M 812 40 C 790 180, 742 300, 700 400 S 640 620, 612 760"
            stroke={s.detourSolved ? '#22E36B' : '#6EE7B7'} strokeWidth="2.6" fill="none" strokeDasharray={s.detourSolved ? '0' : '14 7'}
            style={{ filter: `drop-shadow(0 0 5px ${s.detourSolved ? '#22E36B' : '#6EE7B7'})` }} />
          <path d="M 180 470 L 880 452" stroke="#9FB4CC" strokeWidth="1.7" fill="none" opacity="0.45" strokeDasharray="6 5" />
        </g>
      )}

      {L.pop && COMMUNITIES.map((c) => {
        const rank = s.priorities.indexOf(c.id)
        const hue = rank === 0 ? '#FF003C' : rank === 1 ? '#FF7A1A' : rank === 2 ? '#FFB300' : rank === 3 ? '#38BDF8' : '#A78BFA'
        return (
          <g key={c.id} className="cursor-pointer" onClick={() => act === 2 && eng.setPriority(c.id)}>
            <circle cx={c.x} cy={c.y} r="26" fill={hue} opacity="0.1" />
            <circle cx={c.x} cy={c.y} r="8" fill="none" stroke={hue} strokeWidth="1.6" opacity="0.9" />
            <circle cx={c.x} cy={c.y} r="3" fill={hue} />
            {rank >= 0 && <text x={c.x} y={c.y - 14} textAnchor="middle" fontSize="12" fontWeight="700" fill={hue} className="font-mono">#{rank + 1}</text>}
            <text x={c.x + 13} y={c.y + 4} fontSize="12" fill="#DCEBFF" className="font-thai"
              style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3, strokeLinejoin: 'round' }}>{c.th}</text>
            {c.exits === 1 && <text x={c.x + 13} y={c.y + 16} fontSize="8" fill="#FF003C" className="font-mono">1 EXIT ROUTE</text>}
          </g>
        )
      })}

      {L.facilities && (
        <g>
          {[[402, 300, 'HOSPITAL'], [600, 396, 'SCHOOL'], [500, 520, 'DDPM POST'], [640, 232, 'PUMP STN']].map(([x, y, t], i) => (
            <g key={i}>
              <rect x={x - 5} y={y - 5} width="10" height="10" fill="none" stroke="#22D3EE" strokeWidth="1.4" />
              <line x1={x} y1={y - 8} x2={x} y2={y + 8} stroke="#22D3EE" strokeWidth="0.8" opacity="0.6" />
              <text x={x + 9} y={y + 3} fontSize="7.5" fill="#7dd3fc" className="font-mono">{t}</text>
            </g>
          ))}
        </g>
      )}

      {/* flood-wall gaps — จุดฟันหลอ */}
      {view === 'corridor' && terrain.gaps.map((g, i) => {
        const on = gapCard?.id === g.id
        return (
          <g key={g.id} className="cursor-pointer" data-gap={g.id} onClick={() => setGapCard(on ? null : g)}>
            <circle cx={g.x} cy={g.y} r="9" fill="none" stroke="#FF003C" strokeWidth="1.1" opacity="0.5"
              className="animate-[pulsering_2.6s_ease-out_infinite]" style={{ animationDelay: `${i * 0.16}s`, transformOrigin: `${g.x}px ${g.y}px` }} />
            <circle cx={g.x} cy={g.y} r="15" fill="transparent" />
            <circle cx={g.x} cy={g.y} r={on ? 6.4 : 4.6} fill="#FF003C" opacity="0.95" style={{ filter: `drop-shadow(0 0 ${on ? 12 : 6}px #FF003C)` }} />
            <circle cx={g.x} cy={g.y} r="1.8" fill="#fff" />
            {on && <circle cx={g.x} cy={g.y} r="12" fill="none" stroke="#fff" strokeWidth="1.2" opacity="0.9" />}
          </g>
        )
      })}

      {/* act 2 — blocked mountain route */}
      {sar && (
        <g className="cursor-pointer" onClick={() => setRouteDetail((v) => !v)}>
          <rect x="586" y="116" width="88" height="88" fill="transparent" />
          <g className="animate-[softflash_1.1s_ease-in-out_infinite]">
            <line x1="600" y1="130" x2="660" y2="190" stroke="#FF003C" strokeWidth="7" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 10px #FF003C)' }} />
            <line x1="660" y1="130" x2="600" y2="190" stroke="#FF003C" strokeWidth="7" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 10px #FF003C)' }} />
          </g>
          {routeDetail && <circle cx="630" cy="160" r="46" fill="none" stroke="#fff" strokeWidth="1.3" opacity="0.85" strokeDasharray="7 5" />}
          <path d="M 596 118 L 672 122 L 688 196 L 604 200 Z" fill="#FF003C" opacity="0.08" stroke="#FF003C" strokeWidth="0.9" strokeDasharray="5 4" />
        </g>
      )}
      {sar && (
        <g className="font-mono">
          <text x="252" y="352" fontSize="13" fill="#8FA6C4" letterSpacing="3">MYANMAR</text>
          <text x="700" y="368" fontSize="13" fill="#8FA6C4" letterSpacing="3">THAILAND</text>
          <text x="500" y="222" fontSize="13" fill="#E3EEFB" letterSpacing="3">MAE SAI</text>
        </g>
      )}
      {sar && (
        <g style={{ transformOrigin: '500px 380px' }} className="animate-[sweep_7s_linear_infinite]" opacity="0.13">
          <path d="M 500 380 L 500 -60 A 440 440 0 0 1 812 68 Z" fill="url(#grad-glow)" />
        </g>
      )}
    </svg>
  )
}
