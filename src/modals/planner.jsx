/* ══════════════════════════════════════════════════════════════════════════
   BOAT PLANNER (act 2) — the player chooses mission, destination and route
   Routes come from the GISTDA Sphere Routing API (fastest · shortest · via a
   safe waypoint when every direct route is hazardous) and from the offline
   router (OSM) as the fallback. Sphere knows roads, not the flood: every
   route is checked against the game's own hazards (river current, deep water
   without a pump, live current).
   Beginner: hazards are spelled out per route and marked on the map ·
   Expert: only distance / time / fuel — read the hazards off the map.
   A wrong route costs fuel, time and score ("คำนวณเส้นทางผิด").
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo, useEffect } from 'react'
import { Ship, HeartPulse, Users, Package, Check, Loader2, CheckCircle2, WifiOff, RotateCcw, Clock, Fuel, Navigation, Satellite, Cpu } from 'lucide-react'
import { Modal, Btn, Src } from '../ui/atoms'
import { ImpactHover, WhyButton } from '../ui/impact'
import { HintLadder } from '../ui/hints'
import { previewBoat } from '../engine/impact'
import { useMode } from '../ui/label'
import { BOAT, ACT2, COSTS, DURATIONS } from '../config/missionConfig'
import { HOSPITAL, SHELTER_POOL } from '../config/scenarioData'
import { SECTIONS } from '../lib/sections'
import { makeProjection, linePath, saiRiver, tilesFor } from '../lib/geo'
import { sphereReady, sphereTileTemplate } from '../lib/sphere'
import { depthAt } from '../lib/sim'
import { HAZARD_TH, hazardMarks } from '../lib/routes'
import { campOf } from '../engine/world'
import { fmt, clockLabel } from '../lib/format'

const hm = (min) => { const m = Math.max(0, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที` }
const MW = 560, MH = 400
const COLOR = { 'sphere-c': '#38BDF8', 'sphere-d': '#2DD4BF', 'sphere-via': '#4ADE80', short: '#A78BFA', inland: '#F472B6', main: '#FBBF24', safe: '#86EFAC', debris: '#CBD5E1' }
const HZ = { river: { hex: '#FF8A3D', glyph: '〰' }, deep: { hex: '#3B82F6', glyph: '≈' }, power: { hex: '#FFD066', glyph: '⚡' } }
const travel = (m) => Math.round((m / 1000 / BOAT.speedKmh) * 60)

function SphereStatus({ status, count, onRetry }) {
  const map = {
    loading: [Loader2, 'กำลังขอเส้นทางจาก GISTDA Sphere…', '#7dd3fc', 'animate-spin'],
    ok: [CheckCircle2, `Sphere Routing API · ${count} เส้นทาง`, '#7CFFA0', ''],
    error: [WifiOff, 'Sphere ไม่ตอบ — ใช้ตัวคำนวณในเครื่อง', '#FFD066', ''],
    off: [WifiOff, 'ออฟไลน์ — ใช้ตัวคำนวณในเครื่อง (OSM)', '#94a3b8', ''],
    idle: [Loader2, 'เตรียมขอเส้นทาง…', '#94a3b8', 'animate-spin'],
  }
  const [Icon, th, hex, cls] = map[status] || map.idle
  return (
    <span className="font-thai flex items-center gap-1 rounded-full border px-2 py-[2px] text-[10.5px]" style={{ borderColor: `${hex}66`, color: hex, background: `${hex}12` }} data-sphere-status={status}>
      <Icon size={11} className={cls} />{th}
      {status === 'error' && <button onClick={onRetry} className="ml-1 rounded px-1 hover:bg-white/10" title="ลองใหม่"><RotateCcw size={10} /></button>}
    </span>
  )
}

function RouteCard({ o, i, active, focused, mode, showHazards, onPick, onHover }) {
  const hex = COLOR[o.variant] || '#94a3b8'
  const sphere = o.source === 'sphere'
  return (
    <button onClick={() => onPick(o.variant)} onMouseEnter={() => onHover(o.variant)} onMouseLeave={() => onHover(null)} data-route-opt={i} data-route-source={o.source}
      className={`relative w-full overflow-hidden rounded-md border px-2.5 py-2 text-left transition ${active ? 'border-white/70 bg-white/[0.09] shadow-[0_0_18px_-6px_rgba(255,255,255,.6)]' : focused ? 'border-white/30 bg-white/[0.05]' : 'border-white/12 bg-white/[0.02] hover:bg-white/[0.05]'}`}>
      <span className="absolute inset-y-0 left-0 w-[4px]" style={{ background: hex }} />
      <div className="flex items-center gap-2 pl-1">
        <svg width="26" height="8" className="shrink-0"><line x1="1" y1="4" x2="25" y2="4" stroke={hex} strokeWidth="3" strokeDasharray={sphere ? undefined : '5 3'} strokeLinecap="round" /></svg>
        <span className="font-thai min-w-0 flex-1 truncate text-[12px] font-semibold text-white">{mode.labels === 'tech' ? o.tech : o.th}</span>
        <span className="num text-[12.5px] font-bold text-white">{(o.distanceM / 1000).toFixed(2)}<span className="text-[10px] font-normal text-slate-400"> กม.</span></span>
      </div>
      <div className="num mt-1 flex items-center gap-3 pl-1 text-[10.5px] text-slate-300">
        <span className="flex items-center gap-1"><Clock size={10} />ไปถึง ~{o.minutes} นาที</span>
        <span className="flex items-center gap-1"><Fuel size={10} />{o.fuelL} L</span>
        {o.via && <span className="font-thai flex items-center gap-1 text-[#BFF5CF]"><Navigation size={10} />ผ่านจุดแวะ {o.via.length}</span>}
      </div>
      {o.steps?.length > 0 && <div className="font-thai mt-0.5 truncate pl-1 text-[10px] text-slate-500">ผ่าน: {o.steps.join(' → ')}</div>}
      {showHazards && (
        <div className="mt-1 flex flex-wrap gap-1 pl-1">
          {o.safe
            ? <span className="font-thai rounded bg-[#22E36B]/15 px-1.5 py-[1px] text-[10px] text-[#7CFFA0]">✓ ไม่พบอันตรายบนเส้นทาง</span>
            : o.hazards.map((h) => <span key={h} className="font-thai rounded px-1.5 py-[1px] text-[10px]" style={{ background: `${HZ[h].hex}22`, color: HZ[h].hex }}>{HZ[h].glyph} {HAZARD_TH[h]}</span>)}
        </div>
      )}
    </button>
  )
}

export function BoatPlannerModal({ eng, pointId, onClose }) {
  const mode = useMode()
  const { s, scn } = eng
  const p = s.points.find((x) => x.id === pointId)
  const shelters = scn.shelters.map((id) => SHELTER_POOL.find((x) => x.id === id))
  const [mission, setMission] = useState(p?.type === 'hardship' ? 'supply' : 'rescue')
  const [dest, setDest] = useState(shelters[0]?.id)
  const [pickVar, setPickVar] = useState(null)         // remembered by route, not by list position (Sphere routes arrive later)
  const [hoverVar, setHoverVar] = useState(null)
  useEffect(() => { if (p) eng.requestBoatRoutes(p.id, mission, dest) }, [p?.id, mission, dest]) // eslint-disable-line react-hooks/exhaustive-deps
  const status = p ? eng.boatRouteStatus(p.id, mission, dest) : 'idle'
  const plan = useMemo(() => (p ? eng.planFor(p.id, mission, dest) : null), [p?.id, mission, dest, s.clock - (s.clock % 30), s.pumps, s.powerCut, eng.boatRouteVer]) // eslint-disable-line react-hooks/exhaustive-deps
  const camp = campOf(s)
  const destPt = mission === 'rescue' ? (dest === 'hosp' ? HOSPITAL : SHELTER_POOL.find((x) => x.id === dest)) : null
  const view = useMemo(() => {
    if (!p || !camp) return null
    const pts = [[camp.lon, camp.lat], [p.lon, p.lat], ...(destPt ? [[destPt.lon, destPt.lat]] : []), ...(plan?.options || []).flatMap((o) => o.coords)]
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1])
    const pad = 0.004
    return makeProjection([Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad], MW, MH, 14)
  }, [p, camp, plan, destPt])
  // imagery for the whole frame (the fitted view is wider than the data bounds)
  const tiles = useMemo(() => {
    if (!view || !sphereReady()) return []
    const [w, s0, e, n] = view.bbox, dx = (e - w) * 0.45, dy = (n - s0) * 0.3
    return tilesFor({ ...view, bbox: [w - dx, s0 - dy, e + dx, n + dy] }, sphereTileTemplate(), 48, 0, 17)
  }, [view])
  const options = plan?.options || []
  const choice = options.findIndex((o) => o.variant === pickVar)
  const opt = choice >= 0 ? options[choice] : null
  const focus = options.find((o) => o.variant === hoverVar) || opt
  // Beginner: every route card names its hazards and the map marks them (the user asked for the warning to be always there) ·
  // Expert: read the hazards off the map yourself
  const routeRung = mode.tutor ? 3 : 0
  const marks = useMemo(() => (focus && p && camp && routeRung >= 2 ? hazardMarks(s, scn, focus.coords, s.clock, [[camp.lon, camp.lat], [p.lon, p.lat], ...(destPt ? [[destPt.lon, destPt.lat]] : [[camp.lon, camp.lat]])]) : []),
    [focus, s.clock, s.pumps, s.powerCut, routeRung]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return null
  const idle = s.boats.some((b) => b.busyUntil <= s.clock)
  const fuelLeft = s.fuel.total - s.fuel.used
  const go = () => {
    if (!opt) return
    eng.dispatchBoat({ pointId: p.id, mission, dest: mission === 'supply' ? null : dest, plan, optionIdx: choice })
    onClose()
  }
  const sphereOpts = options.filter((o) => o.source === 'sphere')
  const offlineOpts = options.filter((o) => o.source !== 'sphere')
  const cardProps = (o) => ({ o, i: options.indexOf(o), active: o.variant === pickVar, focused: o.variant === hoverVar, mode, showHazards: routeRung >= 3, onPick: setPickVar, onHover: setHoverVar })
  // trip timeline for the chosen route
  const tPoint = opt ? s.clock + travel(opt.leg1M) : null
  const tDest = opt && mission === 'rescue' ? tPoint + DURATIONS.load + travel(opt.leg2M) : null
  const tHome = opt ? (mission === 'rescue' ? tDest + DURATIONS.load + travel(opt.backM) : tPoint + DURATIONS.load + travel(opt.leg2M)) : null
  const ordered = focus ? [...options.filter((o) => o !== focus), focus] : options

  return (
    <Modal open onClose={onClose} width={1120} tone="#FF7A1A" z={88}>
      <div className="p-5" data-modal="planner">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg border border-[#FF7A1A]/50 bg-[#FF7A1A]/12"><Ship size={20} className="text-[#FFB27A]" /></div>
          <div>
            <div className="hud-label">RESCUE BOAT PLANNER · {p.id} · ZONE {p.section} · GISTDA SPHERE ROUTING</div>
            <h2 className="font-thai flex items-center gap-2 text-[18px] font-bold text-white">วางแผนเรือกู้ภัย — เลือกภารกิจ ปลายทาง และเส้นทางเอง <WhyButton id="boat" size={15} /></h2>
          </div>
          <span className="font-thai ml-auto rounded border border-[#FF7A1A]/50 px-2 py-0.5 text-[11.5px] font-bold text-[#FFB27A]">เหลือเวลา {hm(p.deadline - s.clock)}</span>
        </div>
        <div className="font-thai mt-2 flex flex-wrap gap-3 text-[12px] text-slate-300">
          <span><Users size={12} className="mr-1 inline" />เหลือ {p.left}/{p.people} คน (เรือจุ {BOAT.capacity} คน/เที่ยว)</span>
          <span>{p.type === 'critical' ? 'บ้านอยู่ไม่ได้ ต้องอพยพ' : 'บ้านยังอยู่ได้ ต้องการเสบียง'}</span>
          {p.injured > 0 && <span className="text-[#7dd3fc]"><HeartPulse size={12} className="mr-1 inline" />มีผู้บาดเจ็บ {p.injured} คน</span>}
          <span className="text-slate-500">น้ำมันคงเหลือ {fmt(fuelLeft)} L</span>
        </div>

        <div className="mt-3 grid gap-4" style={{ gridTemplateColumns: '370px minmax(0,1fr)' }}>
          <div className="space-y-3">
            <div>
              <div className="font-thai mb-1 text-[12px] font-bold text-white">1) ภารกิจ</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[['rescue', 'อพยพคนออกมา', Ship], ['supply', 'ส่งถุงยังชีพ', Package]].map(([k, th, Icon]) => (
                  <button key={k} onClick={() => { setMission(k); setPickVar(null) }} disabled={k === 'supply' && p.type === 'critical'} data-mission={k}
                    className={`font-thai flex items-center gap-1.5 rounded border px-2 py-1.5 text-[12px] disabled:opacity-35 ${mission === k ? 'border-[#FF7A1A] bg-[#FF7A1A]/20 text-white' : 'border-white/15 text-slate-300'}`}>
                    <Icon size={13} />{th}
                  </button>
                ))}
              </div>
              {mission === 'supply' && <div className="font-thai mt-1 text-[10.5px] text-slate-400">ถุงยังชีพ ฿{fmt(COSTS.kit)}/ครัวเรือน · ส่งได้เฉพาะบ้านที่ยังอยู่ได้</div>}
            </div>
            {mission === 'rescue' && (
              <div>
                <div className="font-thai mb-1 text-[12px] font-bold text-white">2) ปลายทาง</div>
                <div className="space-y-1">
                  {[{ id: 'hosp', th: HOSPITAL.th, elev: HOSPITAL.elev, icon: '🏥' }, ...shelters.map((x) => ({ ...x, icon: '⛺' }))].map((d) => (
                    <button key={d.id} onClick={() => { setDest(d.id); setPickVar(null) }} data-dest={d.id}
                      className={`font-thai flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-[11.5px] ${dest === d.id ? 'border-sky-400 bg-sky-400/15 text-white' : 'border-white/12 text-slate-300'}`}>
                      <span>{d.icon}</span><span className="flex-1">{d.th}</span><span className="num text-[10px] text-slate-500">{d.elev} ม.</span>
                    </button>
                  ))}
                </div>
                {mode.tutor && p.injured > 0 && dest !== 'hosp' && <div className="font-thai mt-1 text-[10.5px] text-[#FF9DB2]">มีผู้บาดเจ็บ — ควรส่งโรงพยาบาล</div>}
              </div>
            )}
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="font-thai text-[12px] font-bold text-white">{mission === 'rescue' ? '3' : '2'}) เส้นทาง</span>
                <SphereStatus status={status} count={sphereOpts.length} onRetry={() => eng.requestBoatRoutes(p.id, mission, dest)} />
              </div>
              {!options.length && <div className="font-thai text-[11px] text-[#FF9DB2]">หาเส้นทางไม่ได้ — ถนนขาดทั้งหมด</div>}
              {mode.tutor && options.length > 0 && status !== 'loading' && !plan?.best && (() => {
                // Beginner: no route is safe yet — say what fixes it instead of letting the boat go
                const kinds = new Set(options.flatMap((o) => o.hazards))
                return (
                  <div className="font-thai mb-1.5 rounded-md border border-[#FF6B8A]/50 bg-[#FF003C]/[0.08] px-2.5 py-2 text-[11.5px] leading-snug text-[#FFD1DA]" data-no-safe-route>
                    <div className="font-bold text-[#FF9DB2]">⚠ ตอนนี้ยังไม่มีเส้นทางที่ปลอดภัย — อย่าเพิ่งส่งเรือ</div>
                    {kinds.has('power') && <div>⚡ ไฟรั่วบนเส้นทาง → แท็บ “ภาคสนาม” สั่งตัดไฟโซนนั้นก่อน (~1 ชม.) แล้วกลับมาวางแผนใหม่</div>}
                    {kinds.has('deep') && <div>≈ น้ำลึกไหลเชี่ยว → ติดตั้งเครื่องสูบน้ำในโซนที่เส้นทางผ่าน</div>}
                    {kinds.has('river') && <div>〰 กระแสแรงริมแม่น้ำ → ลองปลายทางอื่น หรือรอให้ตัดไฟ/สูบน้ำเสร็จเพื่อเปิดเส้นทางเลี่ยง</div>}
                  </div>
                )
              })()}
              <div className="max-h-[300px] space-y-2 overflow-y-auto pr-1">
                {(sphereOpts.length > 0 || status === 'loading') && (
                  <div>
                    <div className="font-thai mb-1 flex items-center gap-1 text-[10.5px] font-bold tracking-wide text-sky-300"><Satellite size={11} /> GISTDA Sphere Routing API</div>
                    <div className="space-y-1">
                      {sphereOpts.map((o) => <RouteCard key={o.variant} {...cardProps(o)} />)}
                      {status === 'loading' && [0, 1].map((k) => <div key={k} className="h-[54px] animate-pulse rounded-md border border-white/[0.07] bg-white/[0.04]" />)}
                    </div>
                  </div>
                )}
                {offlineOpts.length > 0 && (
                  <div>
                    <div className="font-thai mb-1 flex items-center gap-1 text-[10.5px] font-bold tracking-wide text-slate-400"><Cpu size={11} /> ตัวคำนวณสำรองในเครื่อง (OSM)</div>
                    <div className="space-y-1">{offlineOpts.map((o) => <RouteCard key={o.variant} {...cardProps(o)} />)}</div>
                  </div>
                )}
              </div>
              <div className="font-thai mt-1.5 text-[10.5px] leading-snug text-slate-500">
                Sphere คำนวณเส้นทางบนถนนจริงแต่ไม่รู้ว่าน้ำท่วมตรงไหน — ทุกเส้นทางจึงต้องตรวจกับข้อมูลเรดาร์/ไฟรั่วของเกมก่อนเลือก
                {!mode.tutor && ' · โหมด Expert: อ่านอันตรายเองจากแผนที่'}
              </div>
            </div>
            {mode.tutor && <HintLadder eng={eng} topic="a2.route" ctx={{ pointId: p.id }} compact />}
          </div>

          <div>
            <svg viewBox={`0 0 ${MW} ${MH}`} className="w-full rounded-lg border border-white/15 bg-[#07101d]" data-planner-map>
              <defs>
                <filter id="pl-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              {view && (
                <>
                  {/* GISTDA Sphere imagery under a dark veil so routes and hazards read on top */}
                  {tiles.map((tl) => <image key={tl.key} href={tl.href} x={tl.x} y={tl.y} width={tl.w + 0.5} height={tl.h + 0.5} preserveAspectRatio="none" />)}
                  <rect width={MW} height={MH} fill="#04101e" opacity={tiles.length ? 0.48 : 0} />
                  {SECTIONS.map((z) => {
                    const d = depthAt(s, z, s.clock)
                    const power = s.hazardsLive.includes(z.id) && !s.powerCut[z.id]
                    const deep = d >= ACT2.deepWaterM
                    const [cx, cy] = view.pt(z.c)
                    return (
                      <g key={z.id}>
                        <path d={linePath([...z.hull, z.hull[0]], view)} fill={deep ? '#1d4ed8' : '#38BDF8'} fillOpacity={Math.min(0.5, d / 3.4)} stroke={power ? '#FFD066' : '#7dd3fc'} strokeOpacity={power ? 0.95 : 0.25} strokeWidth={power ? 2 : 1} strokeDasharray={power ? '4 3' : undefined} />
                        <text x={cx} y={cy} textAnchor="middle" fontSize="10" fill="#e2e8f0" className="num" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>{z.id} {d.toFixed(1)}ม.</text>
                        {power && <text x={cx} y={cy + 13} textAnchor="middle" fontSize="12">⚡</text>}
                        {s.pumps[z.id] && <text x={cx + 18} y={cy + 13} textAnchor="middle" fontSize="10" fill="#7dd3fc">⛽P</text>}
                      </g>
                    )
                  })}
                  {saiRiver.map((f) => (
                    <g key={f.properties.osm}>
                      <path d={linePath(f.geometry.coordinates, view)} stroke="#FF8A3D" strokeOpacity="0.22" strokeWidth={(ACT2.riverBandM * 2) / view.metresPerPx} fill="none" strokeLinecap="round" />
                      <path d={linePath(f.geometry.coordinates, view)} stroke="#38BDF8" strokeWidth="2.5" fill="none" />
                    </g>
                  ))}
                  {/* way back to base for the chosen route */}
                  {opt?.back?.length > 1 && <path d={linePath(opt.back, view)} fill="none" stroke="#e2e8f0" strokeOpacity="0.55" strokeWidth="1.6" strokeDasharray="2 4" />}
                  {/* all routes: Sphere solid, offline dashed; the focused one on top with a casing, glow and flow */}
                  {ordered.map((o) => {
                    const hex = COLOR[o.variant] || '#94a3b8'
                    const on = focus && o.variant === focus.variant
                    const d = linePath(o.coords, view)
                    const dim = focus && !on
                    return (
                      <g key={o.variant} data-route-line={o.variant}>
                        {on && <path d={d} fill="none" stroke="#000" strokeOpacity="0.7" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />}
                        <path d={d} fill="none" stroke={hex} strokeWidth={on ? 4.5 : 2.4} strokeOpacity={dim ? 0.35 : 0.95} strokeLinejoin="round" strokeLinecap="round"
                          strokeDasharray={o.source === 'sphere' ? undefined : '7 5'} filter={on ? 'url(#pl-glow)' : undefined} />
                        {on && <path d={d} fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="1.6" strokeDasharray="3 14" className="animate-[dashflow_3s_linear_infinite]" />}
                      </g>
                    )
                  })}
                  {/* hazards met along the focused route (Beginner) */}
                  {marks.map((m, i) => {
                    const [x, y] = view.pt(m.p)
                    return (
                      <g key={i} data-hazard-mark={m.kind}>
                        <circle cx={x} cy={y} r="8.5" fill={HZ[m.kind].hex} stroke="#000" strokeWidth="1.5" opacity="0.95" />
                        <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#0b1220">{HZ[m.kind].glyph}</text>
                      </g>
                    )
                  })}
                  {/* Sphere waypoints */}
                  {focus?.via?.map((w, i) => {
                    const [x, y] = view.pt(w)
                    return <g key={i}><rect x={x - 6} y={y - 6} width="12" height="12" transform={`rotate(45 ${x} ${y})`} fill="#4ADE80" stroke="#000" strokeWidth="1.5" /><text x={x + 9} y={y - 7} fontSize="10" fill="#BFF5CF" className="font-thai" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>จุดแวะ {i + 1}</text></g>
                  })}
                  {/* base · point · destination */}
                  {(() => {
                    const [bx, by] = view.pt([camp.lon, camp.lat]), [px, py] = view.pt([p.lon, p.lat])
                    const dp = destPt ? view.pt([destPt.lon, destPt.lat]) : null
                    const label = (x, y, th, hex) => <text x={x + 13} y={y + 4} fontSize="11.5" fontWeight="700" fill={hex} className="font-thai" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3.5 }}>{th}</text>
                    return (
                      <>
                        <g><rect x={bx - 8} y={by - 8} width="16" height="16" rx="3" fill="#22E36B" stroke="#000" strokeWidth="2" /><path d={`M${bx - 3} ${by + 4} V${by - 5} L${bx + 5} ${by - 2.5} L${bx - 3} ${by}`} fill="#04121F" />{label(bx, by, 'ฐานเรือ', '#BFF5CF')}</g>
                        {dp && (
                          <g>
                            <circle cx={dp[0]} cy={dp[1]} r="9" fill={dest === 'hosp' ? '#fff' : '#22E36B'} stroke="#000" strokeWidth="2" />
                            {dest === 'hosp'
                              ? <path d={`M${dp[0] - 1.8} ${dp[1] - 5.5} h3.6 v3.7 h3.7 v3.6 h-3.7 v3.7 h-3.6 v-3.7 h-3.7 v-3.6 h3.7 z`} fill="#ef4444" />
                              : <path d={`M${dp[0] - 5} ${dp[1] + 4} L${dp[0]} ${dp[1] - 5} L${dp[0] + 5} ${dp[1] + 4} Z`} fill="#04121F" />}
                            {label(dp[0], dp[1], dest === 'hosp' ? 'โรงพยาบาล' : 'จุดอพยพ', dest === 'hosp' ? '#fecaca' : '#BFF5CF')}
                          </g>
                        )}
                        <g>
                          <circle cx={px} cy={py} r="9" fill="none" stroke="#FF3B63" strokeWidth="2"><animate attributeName="r" values="8;20" dur="1.4s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.9;0" dur="1.4s" repeatCount="indefinite" /></circle>
                          <circle cx={px} cy={py} r="9" fill="#FF3B63" stroke="#000" strokeWidth="2" />
                          <text x={px} y={py + 3.5} textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" className="num">{p.left}</text>
                          {label(px, py, p.id, '#FFC2CE')}
                        </g>
                      </>
                    )
                  })()}
                  <text x={MW - 8} y={MH - 8} textAnchor="end" fontSize="9" fill="#cbd5e1" opacity="0.8" className="num" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>© GISTDA Sphere · OpenStreetMap</text>
                </>
              )}
            </svg>
            <div className="font-thai mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-slate-400">
              <span className="flex items-center gap-1"><svg width="20" height="6"><line x1="1" y1="3" x2="19" y2="3" stroke="#38BDF8" strokeWidth="3" /></svg>Sphere</span>
              <span className="flex items-center gap-1"><svg width="20" height="6"><line x1="1" y1="3" x2="19" y2="3" stroke="#A78BFA" strokeWidth="3" strokeDasharray="5 3" /></svg>ในเครื่อง (OSM)</span>
              <span><span className="inline-block h-2 w-3 bg-[#FF8A3D]/40 align-middle" /> ริมแม่น้ำ (กระแสแรง)</span>
              <span><span className="inline-block h-2 w-3 bg-[#1d4ed8] align-middle" /> ลึก ≥ {ACT2.deepWaterM} ม.</span>
              <span>⚡ ไฟฟ้ารั่ว</span>
              <span className="flex items-center gap-1"><svg width="20" height="6"><line x1="1" y1="3" x2="19" y2="3" stroke="#e2e8f0" strokeWidth="1.6" strokeDasharray="2 4" /></svg>ทางกลับฐาน</span>
              <span className="ml-auto flex gap-1"><Src t="radar" mini /><Src t="measured" mini /></span>
            </div>
            {/* trip timeline */}
            <div className="mt-2 flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2" data-trip-timeline>
              {opt ? (
                [['ออกจากฐาน', s.clock, Ship], ['ถึงจุดเกิดเหตุ', tPoint, Users], ...(mission === 'rescue' ? [[dest === 'hosp' ? 'ถึงโรงพยาบาล' : 'ถึงจุดอพยพ', tDest, dest === 'hosp' ? HeartPulse : Check]] : []), ['กลับถึงฐาน', tHome, Navigation]].map(([th, t, Icon], i, arr) => (
                  <React.Fragment key={th}>
                    <div className="flex items-center gap-1.5">
                      <Icon size={13} className={t > p.deadline && th === 'ถึงจุดเกิดเหตุ' ? 'text-[#FF6B8A]' : 'text-sky-300'} />
                      <div className="leading-tight"><div className="font-thai text-[10px] text-slate-400">{th}</div><div className="num text-[11.5px] font-bold text-white">{clockLabel(t)}</div></div>
                    </div>
                    {i < arr.length - 1 && <div className="h-px flex-1 bg-gradient-to-r from-sky-400/60 to-sky-400/10" />}
                  </React.Fragment>
                ))
              ) : <span className="font-thai text-[11px] text-slate-500">เลือกเส้นทางเพื่อดูเวลาออก · ถึง · กลับ</span>}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <span className="font-thai mr-auto text-[11px] text-slate-500">{opt ? `ใช้น้ำมัน ${opt.fuelL} L · ฿${fmt(COSTS.boatTrip)}${opt.source === 'sphere' ? ' · เส้นทางจาก GISTDA Sphere' : ' · เส้นทางจากตัวคำนวณในเครื่อง'}${mission === 'rescue' && p.left > BOAT.capacity ? ` · เรือจะวนรับ-ส่งต่อเองจนครบ ~${Math.ceil(p.left / BOAT.capacity)} เที่ยว (+${Math.round(((2 * opt.leg2M) / 1000) * BOAT.fuelLPerKm)} L/เที่ยว)` : ''}` : 'เลือกเส้นทางก่อนส่งเรือ'}</span>
          <Btn variant="solid" onClick={onClose}><span className="font-thai normal-case tracking-normal">ยกเลิก</span></Btn>
          <ImpactHover width={330} card={opt ? previewBoat(s, scn, { point: p, mission, dest, plan, opt }) : null}>
            <Btn variant="danger" size="lg" icon={Ship} disabled={!opt || !idle || opt.fuelL > fuelLeft} onClick={go} data-dispatch>
              <span className="font-thai normal-case tracking-normal text-[13px]">{!idle ? 'ไม่มีเรือว่าง' : opt && opt.fuelL > fuelLeft ? 'น้ำมันไม่พอ' : 'ส่งเรือออก'}</span>
            </Btn>
          </ImpactHover>
        </div>
      </div>
    </Modal>
  )
}
