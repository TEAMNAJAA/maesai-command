/* ══════════════════════════════════════════════════════════════════════════
   BOAT PLANNER (act 2) — the player chooses mission, destination and route
   Beginner: hazards are spelled out per route · Expert: only distance / time /
   fuel — read the hazards off the map (radar depth, ⚡ live current, river).
   A wrong route costs fuel, time and score ("คำนวณเส้นทางผิด").
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo } from 'react'
import { Ship, HeartPulse, Users, Package, AlertTriangle, Check, Zap, Waves, MapPin } from 'lucide-react'
import { Modal, Btn, Src } from '../ui/atoms'
import { useMode } from '../ui/label'
import { BOAT, ACT2, COSTS } from '../config/missionConfig'
import { HOSPITAL, SHELTER_POOL } from '../config/scenarioData'
import { SECTIONS } from '../lib/sections'
import { makeProjection, linePath, saiRiver, tilesFor } from '../lib/geo'
import { sphereReady, sphereTileTemplate } from '../lib/sphere'
import { depthAt } from '../lib/sim'
import { HAZARD_TH } from '../lib/routes'
import { campOf } from '../engine/world'
import { fmt, clockLabel } from '../lib/format'

const hm = (min) => { const m = Math.max(0, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที` }

export function BoatPlannerModal({ eng, pointId, onClose }) {
  const mode = useMode()
  const { s, scn } = eng
  const p = s.points.find((x) => x.id === pointId)
  const shelters = scn.shelters.map((id) => SHELTER_POOL.find((x) => x.id === id))
  const [mission, setMission] = useState(p?.type === 'hardship' ? 'supply' : 'rescue')
  const [dest, setDest] = useState(shelters[0]?.id)
  const [pick, setPick] = useState(null)
  const plan = useMemo(() => (p ? eng.planFor(p.id, mission, dest) : null), [p?.id, mission, dest, s.clock - (s.clock % 30), s.pumps, s.powerCut]) // eslint-disable-line react-hooks/exhaustive-deps
  const camp = campOf(s)
  const destPt = dest === 'hosp' ? HOSPITAL : SHELTER_POOL.find((x) => x.id === dest)
  const view = useMemo(() => {
    if (!p || !camp) return null
    const pts = [[camp.lon, camp.lat], [p.lon, p.lat], ...(mission === 'rescue' && destPt ? [[destPt.lon, destPt.lat]] : []), ...(plan?.options || []).flatMap((o) => o.coords)]
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1])
    const pad = 0.004
    return makeProjection([Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad], 520, 360, 10)
  }, [p, camp, plan, mission, destPt])
  // imagery for the whole frame (the fitted view is wider than the data bounds)
  const tiles = useMemo(() => {
    if (!view || !sphereReady()) return []
    const [w, s0, e, n] = view.bbox, dx = (e - w) * 0.45, dy = (n - s0) * 0.3
    return tilesFor({ ...view, bbox: [w - dx, s0 - dy, e + dx, n + dy] }, sphereTileTemplate(), 48, 0, 17)
  }, [view])
  if (!p) return null
  const choice = pick !== null && plan?.options[pick] ? pick : null
  const opt = choice !== null ? plan.options[choice] : null
  const idle = s.boats.some((b) => b.busyUntil <= s.clock)
  const fuelLeft = s.fuel.total - s.fuel.used
  const go = () => {
    if (!opt) return
    eng.dispatchBoat({ pointId: p.id, mission, dest: mission === 'supply' ? null : dest, plan, optionIdx: choice })
    onClose()
  }
  const colors = ['#38BDF8', '#A78BFA', '#22E36B']
  return (
    <Modal open onClose={onClose} width={1060} tone="#FF7A1A" z={88}>
      <div className="p-5" data-modal="planner">
        <div className="flex items-center gap-3">
          <Ship size={20} className="text-[#FFB27A]" />
          <div>
            <div className="hud-label">RESCUE BOAT PLANNER · {p.id} · ZONE {p.section}</div>
            <h2 className="font-thai text-[18px] font-bold text-white">วางแผนเรือกู้ภัย — เลือกภารกิจ ปลายทาง และเส้นทางเอง</h2>
          </div>
          <span className="font-thai ml-auto rounded border border-[#FF7A1A]/50 px-2 py-0.5 text-[11.5px] font-bold text-[#FFB27A]">เหลือเวลา {hm(p.deadline - s.clock)}</span>
        </div>
        <div className="font-thai mt-2 flex flex-wrap gap-3 text-[12px] text-slate-300">
          <span><Users size={12} className="mr-1 inline" />เหลือ {p.left}/{p.people} คน (เรือจุ {BOAT.capacity} คน/เที่ยว)</span>
          <span>{p.type === 'critical' ? 'บ้านอยู่ไม่ได้ ต้องอพยพ' : 'บ้านยังอยู่ได้ ต้องการเสบียง'}</span>
          {p.injured > 0 && <span className="text-[#7dd3fc]"><HeartPulse size={12} className="mr-1 inline" />มีผู้บาดเจ็บ {p.injured} คน</span>}
          <span className="text-slate-500">น้ำมันคงเหลือ {fmt(fuelLeft)} L</span>
        </div>

        <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: '340px minmax(0,1fr)' }}>
          <div className="space-y-3">
            <div>
              <div className="font-thai mb-1 text-[12px] font-bold text-white">1) ภารกิจ</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[['rescue', 'อพยพคนออกมา', Ship], ['supply', 'ส่งถุงยังชีพ', Package]].map(([k, th, Icon]) => (
                  <button key={k} onClick={() => { setMission(k); setPick(null) }} disabled={k === 'supply' && p.type === 'critical'} data-mission={k}
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
                    <button key={d.id} onClick={() => { setDest(d.id); setPick(null) }} data-dest={d.id}
                      className={`font-thai flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-[11.5px] ${dest === d.id ? 'border-sky-400 bg-sky-400/15 text-white' : 'border-white/12 text-slate-300'}`}>
                      <span>{d.icon}</span><span className="flex-1">{d.th}</span><span className="num text-[10px] text-slate-500">{d.elev} ม.</span>
                    </button>
                  ))}
                </div>
                {mode.routeHints && p.injured > 0 && dest !== 'hosp' && <div className="font-thai mt-1 text-[10.5px] text-[#FF9DB2]">มีผู้บาดเจ็บ — ควรส่งโรงพยาบาล</div>}
              </div>
            )}
            <div>
              <div className="font-thai mb-1 text-[12px] font-bold text-white">{mission === 'rescue' ? '3' : '2'}) เส้นทาง (ฐาน → จุดเกิดเหตุ{mission === 'rescue' ? ' → ปลายทาง' : ' → ฐาน'})</div>
              {!plan?.options.length && <div className="font-thai text-[11px] text-[#FF9DB2]">หาเส้นทางไม่ได้ — ถนนขาดทั้งหมด</div>}
              <div className="space-y-1">
                {plan?.options.map((o, i) => (
                  <button key={o.variant} onClick={() => setPick(i)} data-route-opt={i}
                    className={`w-full rounded border px-2 py-1.5 text-left ${choice === i ? 'border-white bg-white/10' : 'border-white/12 hover:bg-white/[0.04]'}`} style={{ borderLeft: `4px solid ${colors[i]}` }}>
                    <div className="flex items-center gap-2">
                      <span className="font-thai flex-1 text-[12px] font-semibold text-white">{mode.labels === 'tech' ? o.tech : o.th}</span>
                      <span className="num text-[11px] text-slate-300">{(o.distanceM / 1000).toFixed(2)} กม.</span>
                    </div>
                    <div className="num mt-0.5 flex gap-3 text-[10.5px] text-slate-400"><span>ไปถึง ~{o.minutes} นาที</span><span>น้ำมัน {o.fuelL} L</span></div>
                    {o.steps?.length > 0 && <div className="font-thai truncate text-[10px] text-slate-500">ผ่าน: {o.steps.join(' → ')}</div>}
                    {mode.routeHints && (
                      <div className="font-thai mt-0.5 text-[10.5px]" style={{ color: o.safe ? '#7CFFA0' : '#FF9DB2' }}>
                        {o.safe ? '✓ ไม่พบอันตรายบนเส้นทาง' : `⚠ ${o.hazards.map((h) => HAZARD_TH[h]).join(' · ')}`}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {!mode.routeHints && <div className="font-thai mt-1 text-[10.5px] text-slate-500">โหมด Expert: ตรวจอันตรายเองจากแผนที่ (ความลึกเรดาร์ · ⚡ ไฟรั่ว · แนวริมแม่น้ำ)</div>}
            </div>
          </div>

          <div>
            <svg viewBox="0 0 520 360" className="w-full rounded-lg border border-white/15 bg-[#07101d]" data-planner-map>
              {view && (
                <>
                  {/* GISTDA Sphere imagery under a dark veil so routes and hazards read on top */}
                  {tiles.map((tl) => <image key={tl.key} href={tl.href} x={tl.x} y={tl.y} width={tl.w + 0.5} height={tl.h + 0.5} preserveAspectRatio="none" />)}
                  {tiles.length > 0 && <rect width="520" height="360" fill="#04101e" opacity="0.5" />}
                  {SECTIONS.map((z) => {
                    const d = depthAt(s, z, s.clock)
                    const power = s.hazardsLive.includes(z.id) && !s.powerCut[z.id]
                    const deep = d >= ACT2.deepWaterM
                    const [cx, cy] = view.pt(z.c)
                    return (
                      <g key={z.id}>
                        <path d={linePath([...z.hull, z.hull[0]], view)} fill={deep ? '#1d4ed8' : '#38BDF8'} fillOpacity={Math.min(0.55, d / 3.2)} stroke={power ? '#FFD066' : '#7dd3fc'} strokeOpacity={power ? 0.9 : 0.25} strokeWidth={power ? 2 : 1} strokeDasharray={power ? '4 3' : undefined} />
                        <text x={cx} y={cy} textAnchor="middle" fontSize="10" fill="#e2e8f0" className="num" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>{z.id} {d.toFixed(1)}ม.</text>
                        {power && <text x={cx} y={cy + 13} textAnchor="middle" fontSize="12">⚡</text>}
                        {s.pumps[z.id] && <text x={cx + 18} y={cy + 13} textAnchor="middle" fontSize="10" fill="#7dd3fc">⛽P</text>}
                      </g>
                    )
                  })}
                  {saiRiver.map((f) => (
                    <g key={f.properties.osm}>
                      <path d={linePath(f.geometry.coordinates, view)} stroke="#FF8A3D" strokeOpacity="0.25" strokeWidth={ACT2.riverBandM * 2 / view.metresPerPx} fill="none" strokeLinecap="round" />
                      <path d={linePath(f.geometry.coordinates, view)} stroke="#38BDF8" strokeWidth="2.5" fill="none" />
                    </g>
                  ))}
                  {plan?.options.map((o, i) => (
                    <path key={o.variant} d={linePath(o.coords, view)} stroke={colors[i]} strokeWidth={choice === i ? 5 : 2.2} strokeOpacity={choice === null || choice === i ? 0.95 : 0.35} fill="none" strokeLinejoin="round" strokeDasharray={choice === i ? undefined : '6 4'} />
                  ))}
                  {[[camp, '#22E36B', 'ฐาน'], [p, '#FF3B63', p.id], ...(mission === 'rescue' && destPt ? [[destPt, '#7dd3fc', dest === 'hosp' ? 'โรงพยาบาล' : 'จุดอพยพ']] : [])].map(([q, hex, label]) => {
                    const [x, y] = view.pt([q.lon, q.lat])
                    return (
                      <g key={label}>
                        <circle cx={x} cy={y} r="7" fill={hex} stroke="#000" strokeWidth="2" />
                        <text x={x + 10} y={y + 4} fontSize="11" fill="#fff" className="font-thai" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>{label}</text>
                      </g>
                    )
                  })}
                </>
              )}
            </svg>
            <div className="font-thai mt-1 flex flex-wrap items-center gap-3 text-[10.5px] text-slate-400">
              <span><span className="inline-block h-2 w-3 bg-[#FF8A3D]/40 align-middle" /> แนวริมแม่น้ำ (กระแสแรง)</span>
              <span><span className="inline-block h-2 w-3 bg-[#1d4ed8] align-middle" /> โซนลึก ≥ {ACT2.deepWaterM} ม.</span>
              <span>⚡ ไฟฟ้ารั่ว</span>
              <span className="ml-auto flex gap-1"><Src t="radar" mini /><Src t="measured" mini /></span>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <span className="font-thai mr-auto text-[11px] text-slate-500">{opt ? `เรือออก ${clockLabel(s.clock)} · ถึงจุดเกิดเหตุ ~${opt.minutes ? clockLabel(s.clock + Math.round((opt.leg1M / 1000 / BOAT.speedKmh) * 60)) : '—'} · ใช้น้ำมัน ${opt.fuelL} L · ฿${fmt(COSTS.boatTrip)}${mission === 'rescue' && p.left > BOAT.capacity ? ` · เรือจะวนรับ-ส่งต่อเองจนครบ ~${Math.ceil(p.left / BOAT.capacity)} เที่ยว (+${Math.round((2 * opt.leg2M / 1000) * BOAT.fuelLPerKm)} L/เที่ยว)` : ''}` : 'เลือกเส้นทางก่อนส่งเรือ'}</span>
          <Btn variant="solid" onClick={onClose}><span className="font-thai normal-case tracking-normal">ยกเลิก</span></Btn>
          <Btn variant="danger" size="lg" icon={Ship} disabled={!opt || !idle || opt.fuelL > fuelLeft} onClick={go}>
            <span className="font-thai normal-case tracking-normal text-[13px]">{!idle ? 'ไม่มีเรือว่าง' : opt && opt.fuelL > fuelLeft ? 'น้ำมันไม่พอ' : 'ส่งเรือออก'}</span>
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
