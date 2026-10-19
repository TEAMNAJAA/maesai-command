/* ══════════════════════════════════════════════════════════════════════════
   MAP CANVAS — view switcher, 3D tilt, zoom/pan and on-map callouts
   Act 1: catchment (THEOS-2 tasking) · urban (zones) · corridor (embankment)
   Act 2: urban (operations: clouds, stranded groups, boats) · corridor
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useRef, useCallback, useSyncExternalStore } from 'react'
import { AlertTriangle, CheckCircle2, X, Plus, Minus, MousePointer2, Hand, Maximize2, ShieldCheck, Satellite, Cloud, Ruler } from 'lucide-react'
import { GeoMap, EXTENTS } from './GeoMap'
import { Weather } from './Weather'
import { Panel, Corners, Src, SrcLegend, Btn } from '../ui/atoms'
import { clamp, fmt, clockLabel } from '../lib/format'
import { THRESHOLDS, EMBANKMENT, COSTS, DURATIONS } from '../config/missionConfig'
import { EMBANKMENT_GAPS } from '../lib/embankment'
import { cloudCover } from '../lib/clouds'

export const VIEWS = {
  catchment: { th: 'ลุ่มน้ำต้นน้ำ · THEOS-2', en: 'UPSTREAM CATCHMENT', src: 'radar', sensor: 'DEM SRTM · AOI GeoJSON · THEOS-2 sectors' },
  urban: { th: 'เมือง 10 โซน', en: 'TOWN ZONES', src: 'image', sensor: 'GISTDA sphere · อาคาร GISTDA · OSM' },
  corridor: { th: 'แนวตลิ่งเมือง', en: 'URBAN EMBANKMENT', src: 'image', sensor: 'GISTDA sphere z17 · อาคาร GISTDA' },
}
export const viewsForAct = (act) => (act === 2 ? ['urban', 'corridor'] : ['catchment', 'urban', 'corridor'])

const hm = (min) => { const m = Math.max(0, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)} ชม. ${m % 60} นาที` : `${m} นาที` }

export function MapCanvas({ eng, view, setView, onPoint, onChannel, beaconView, beaconMap }) {
  const { s, scn, sfvi, veto1 } = eng
  const [gapCard, setGapCard] = useState(null)
  const [tool, setTool] = useState('select')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [tilt, setTilt] = useState(false)
  // cursor readout lives outside React state: a mouse move must not redraw thousands of roofs
  const cursorVal = useRef(null), cursorSubs = useRef(new Set())
  const setCursor = useCallback((v) => { cursorVal.current = v; cursorSubs.current.forEach((f) => f()) }, [])
  const drag = useRef(null)
  const rootRef = useRef(null)
  const level = sfvi.world.level
  const meta = VIEWS[view]
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); setTilt(false) }
  const onPointerDown = useCallback((e) => { if (tool !== 'pan') return; drag.current = { x: e.clientX, y: e.clientY, pan: { ...pan } }; e.currentTarget.setPointerCapture?.(e.pointerId) }, [tool, pan])
  const onPointerMove = useCallback((e) => { if (!drag.current) return; setPan({ x: drag.current.pan.x + (e.clientX - drag.current.x) / zoom, y: drag.current.pan.y + (e.clientY - drag.current.y) / zoom }) }, [zoom])
  const onPointerUp = useCallback(() => { drag.current = null }, [])
  const sceneTransform = `${tilt ? 'perspective(1500px) rotateX(52deg) scale(1.22) ' : ''}scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`
  const onSector = (passId, sectorId) => {
    const cur = s.taskings[passId] || []
    eng.setTasking(passId, cur.includes(sectorId) ? cur.filter((x) => x !== sectorId) : [...cur, sectorId].slice(-2))
  }
  const next = s.act === 1 ? scn.passes.find((p) => p.t > s.clock) : scn.act2Passes.find((q) => q.t > s.clock)

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden rounded-lg border border-sky-400/15 bg-[#04070E]" data-map-view={view}>
      <div className={`absolute inset-0 ${tool === 'pan' ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{ transform: sceneTransform, transformOrigin: '50% 58%', transition: drag.current ? 'none' : 'transform .5s cubic-bezier(.4,0,.2,1)' }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        <GeoMap extent={view} eng={eng} onHover={tilt ? null : setCursor} onPoint={onPoint} onSector={onSector} onChannel={onChannel} beacon={beaconMap}
          gapSel={gapCard?.id} onGap={(g, e) => {
            const r = rootRef.current?.getBoundingClientRect()
            setGapCard(g && r ? { ...g, px: e.clientX - r.left, py: e.clientY - r.top, w: r.width, h: r.height } : null)
          }} />
      </div>
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(110% 80% at 50% 40%, transparent 62%, rgba(2,6,15,.6) 100%)' }} />
      <Weather eng={eng} />

      <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 gap-1 rounded-md border border-sky-400/20 bg-[#070D1C]/88 p-1 backdrop-blur-md">
        {viewsForAct(s.act).map((id) => (
          <button key={id} onClick={() => setView(id)} data-view={id}
            className={`btn whitespace-nowrap px-2.5 py-1.5 ${view === id ? 'border-sky-400/60 bg-sky-400/20 text-sky-100'
              : beaconView === id ? 'border-[#FFD066]/70 bg-[#FFD066]/15 text-[#FFE0A3] animate-[beacon_1.6s_ease-in-out_infinite]' : 'border-transparent text-sky-300/60 hover:text-sky-200'}`}>
            <span className="font-thai normal-case tracking-normal text-[10.5px]">{VIEWS[id].th}</span>
          </button>
        ))}
      </div>

      <div className="absolute left-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 rounded-md border border-sky-400/20 bg-[#070D1C]/85 p-1 backdrop-blur-md">
        {[{ id: 'select', icon: MousePointer2, t: 'เลือก/คลิก' }, { id: 'pan', icon: Hand, t: 'เลื่อนแผนที่' }].map((t) => (
          <button key={t.id} onClick={() => setTool(t.id)} title={t.t} className={`grid h-7 w-7 place-items-center rounded ${tool === t.id ? 'bg-sky-400/20 text-sky-100 ring-1 ring-sky-400/50' : 'text-sky-300/60 hover:bg-white/10'}`}><t.icon size={13} /></button>
        ))}
        <span className="my-0.5 h-px bg-sky-400/20" />
        <button title="ซูมเข้า" onClick={() => setZoom((z) => clamp(z + 0.25, 1, 3.5))} className="grid h-7 w-7 place-items-center rounded text-sky-300/60 hover:bg-white/10"><Plus size={13} /></button>
        <button title="ซูมออก" onClick={() => setZoom((z) => clamp(z - 0.25, 1, 3.5))} className="grid h-7 w-7 place-items-center rounded text-sky-300/60 hover:bg-white/10"><Minus size={13} /></button>
        <button title="รีเซ็ตมุมมอง" onClick={resetView} className="grid h-7 w-7 place-items-center rounded text-sky-300/60 hover:bg-white/10"><Maximize2 size={13} /></button>
        <span className="my-0.5 h-px bg-sky-400/20" />
        <button title="มุมมองเอียง 3D (ภูมิประเทศจาก DEM)" onClick={() => setTilt((t) => !t)} data-tilt={tilt ? 'on' : 'off'}
          className={`grid h-7 w-7 place-items-center rounded font-mono text-[9px] font-bold ${tilt ? 'bg-[#FF8A3D]/25 text-[#FFC59A] ring-1 ring-[#FF8A3D]/60' : 'text-sky-300/60 hover:bg-white/10'}`}>3D</button>
      </div>

      {/* context banner: next THEOS-2 pass · cloud over town */}
      {next && view !== 'corridor' && (
        <div className="absolute left-14 top-[58px] z-20 flex items-center gap-2 rounded-md border border-sky-400/30 bg-[#070D1C]/90 px-2.5 py-1.5 backdrop-blur-md" data-pass-banner>
          <Satellite size={13} className="text-sky-300" />
          <span className="font-thai text-[11px] text-sky-100">THEOS-2 รอบ {next.id} ผ่านใน <b className="num">{hm(next.t - s.clock)}</b></span>
          {s.act === 1 && <span className="font-thai text-[10.5px]" style={{ color: (s.taskings[next.id] || []).length ? '#7CFFA0' : '#FFD066' }}>{(s.taskings[next.id] || []).length ? `สั่งถ่าย ${(s.taskings[next.id] || []).join(', ')}` : 'ยังไม่ได้เลือกเป้าหมาย'}</span>}
          {s.act === 2 && <span className="font-thai text-[10.5px]" style={{ color: s.act2Orders[next.id] ? '#7CFFA0' : '#FFD066' }}>{s.act2Orders[next.id] ? 'สั่งถ่ายแล้ว' : 'ยังไม่ได้สั่งถ่าย'}</span>}
          {s.act === 2 && <span className="flex items-center gap-1 font-thai text-[10.5px] text-slate-300"><Cloud size={11} /> เมฆเหนือเมือง {Math.round(cloudCover(scn, s.clock) * 100)}%</span>}
        </div>
      )}

      {view === 'corridor' && <EmbankmentBar eng={eng} onChannel={onChannel} />}
      {view === 'corridor' && gapCard && <GapCard eng={eng} gap={gapCard} onClose={() => setGapCard(null)} />}

      <div className="absolute bottom-2.5 left-3 z-20 flex items-center gap-2 rounded border border-sky-400/15 bg-[#060B17]/88 px-2.5 py-1 backdrop-blur">
        <span className="hud-label">SFVI</span>
        <span className="num text-[12px] font-bold" style={{ color: sfvi.basin >= 0.7 ? '#FF003C' : sfvi.basin >= 0.62 ? '#FFB300' : '#22E36B' }}>{sfvi.basin.toFixed(3)}</span>
        <span className="h-3 w-px bg-white/15" />
        <span className="num text-[11px]" style={{ color: level >= THRESHOLDS.criticalLevel ? '#FF003C' : '#cbd5e1' }}>{level.toFixed(2)} m</span>
        {veto1 && <><span className="h-3 w-px bg-white/15" /><span className="font-mono text-[9.5px] font-bold tracking-[0.12em] text-[#FF003C] animate-[flash_1s_ease-in-out_infinite]">VETO 1</span></>}
      </div>
      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-1 rounded border border-white/10 bg-[#060B17]/88 px-2 py-1.5 backdrop-blur" data-legend>
        <span className="font-thai text-[9.5px] text-slate-400">ป้ายที่มาข้อมูล</span>
        <SrcLegend vertical />
      </div>
      <div className="absolute bottom-2.5 right-3 z-20 flex max-w-[52%] items-center gap-2 overflow-hidden whitespace-nowrap rounded border border-white/10 bg-[#060B17]/80 px-2 py-[3px] font-mono text-[9px] tracking-[0.08em] text-sky-300/60 backdrop-blur">
        <CursorReadout val={cursorVal} subs={cursorSubs} label={EXTENTS[view].label} />
        <span className="h-3 w-px bg-white/10" /><span>{meta.sensor}</span><Src t={meta.src} mini />
      </div>
    </div>
  )
}

/* ── Corridor overlays ───────────────────────────────────────────────────── */

function EmbankmentBar({ eng, onChannel }) {
  const { s } = eng
  const queued = new Set(s.jobs.filter((j) => j.kind === 'seal').map((j) => j.gap))
  const open = EMBANKMENT_GAPS.filter((g) => !s.sealed.includes(g.id) && !queued.has(g.id))
  const cost = open.reduce((a, g) => a + g.len * EMBANKMENT.bagsPerMetre * COSTS.bigbag, 0)
  const act1 = s.act === 1
  return (
    <div className="absolute bottom-11 left-1/2 z-20 w-max max-w-[96%] -translate-x-1/2" data-embankment-bar>
      <div className="flex items-center gap-2 whitespace-nowrap rounded-md border border-white/15 bg-[#070D1C]/95 px-2.5 py-1.5">
        {open.length ? <AlertTriangle size={12} className="shrink-0 text-[#FF003C] animate-[flash_1.4s_ease-in-out_infinite]" /> : <CheckCircle2 size={12} className="shrink-0 text-[#22E36B]" />}
        <span className="font-thai text-[11px]" style={{ color: open.length ? '#FF9DB2' : '#7CFFA0' }}>
          จุดฟันหลอ {EMBANKMENT_GAPS.length} · อุดแล้ว {s.sealed.length} · ในคิวทีม {queued.size} · เปิดอยู่ {open.length}
        </span>
        <Src t="scenario" mini />
        {act1 && !s.channel.measured && <Btn size="sm" variant="primary" icon={Ruler} onClick={onChannel}><span className="font-thai normal-case tracking-normal text-[10.5px]">วัดลำน้ำ (N)</span></Btn>}
        {act1 && open.length > 0 && (
          <Btn size="sm" variant="go" icon={ShieldCheck} onClick={() => eng.sealGaps(open.map((g) => g.id))}>
            <span className="font-thai normal-case tracking-normal text-[10.5px]">ส่งทีมอุดที่เหลือ {open.length} จุด · ฿{fmt(cost / 1e6, 2)}M</span>
          </Btn>
        )}
      </div>
    </div>
  )
}

function GapCard({ eng, gap, onClose }) {
  const { s } = eng
  const sealed = s.sealed.includes(gap.id)
  const job = s.jobs.find((j) => j.kind === 'seal' && j.gap === gap.id)
  const act1 = s.act === 1
  const hex = sealed ? '#22E36B' : job ? '#FFB300' : '#FF003C'
  const left = clamp(gap.px + 22, 8, gap.w - 262), top = clamp(gap.py - 40, 56, gap.h - 240)
  const bags = gap.len * EMBANKMENT.bagsPerMetre
  return (
    <div className="absolute z-30 w-[250px] animate-[riseIn_.25s_ease-out]" style={{ left, top }} data-gap-card={gap.id}>
      <Panel className="bg-[#070D1C]/95 p-3" glow={hex}>
        <Corners color={`${hex}88`} />
        <button onClick={onClose} className="absolute right-1.5 top-1.5 text-slate-500 hover:text-white"><X size={12} /></button>
        <div className="font-thai text-[13px] font-semibold text-white">{sealed ? 'อุดแล้ว' : job ? 'ทีมกำลังไป' : 'จุดฟันหลอของแนวกั้นน้ำ'} · <span className="num">{gap.id}</span></div>
        <div className="font-thai text-[10.5px] text-slate-400">{gap.community ? `ริมตลิ่งใกล้ชุมชน${gap.community}` : 'ริมตลิ่งแม่น้ำสาย ฝั่งไทย'}</div>
        <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2.5 text-[10.5px]">
          <div className="flex justify-between"><span className="font-thai text-slate-400">ช่องโหว่ยาว</span><span className="flex items-center gap-1.5"><span className="num font-bold text-white">{gap.len} ม.</span><Src t="scenario" mini /></span></div>
          <div className="flex justify-between"><span className="font-thai text-slate-400">หลังคาเสี่ยงด้านหลัง (≤150 ม.)</span><span className="flex items-center gap-1.5"><span className="num font-bold text-[#FFB3C2]">{gap.behind}</span><Src t="image" mini /></span></div>
          <div className="flex justify-between"><span className="font-thai text-slate-400">บิ๊กแบ็ก · ใช้เวลาทีม</span><span className="num font-bold text-white">{fmt(bags)} ใบ · {Math.round((gap.len * DURATIONS.bigbagPerMetre) / 6) / 10} ชม.</span></div>
          {job && <div className="font-thai text-[#FFE0A3]">ทีม {job.crew} จะเสร็จ {clockLabel(job.at)}</div>}
        </div>
        {!sealed && !job && act1 && (
          <Btn variant="go" className="mt-2.5 w-full" icon={ShieldCheck} onClick={() => { eng.sealGaps([gap.id]); onClose() }}>
            <span className="font-thai normal-case tracking-normal text-[11.5px]">ส่งทีมอุดจุดนี้ · ฿{fmt(bags * COSTS.bigbag)}</span>
          </Btn>
        )}
      </Panel>
    </div>
  )
}

function CursorReadout({ val, subs, label }) {
  const cursor = useSyncExternalStore((cb) => { subs.current.add(cb); return () => subs.current.delete(cb) }, () => val.current)
  return cursor
    ? <><span>{cursor.lat.toFixed(4)}°N {cursor.lon.toFixed(4)}°E</span>{cursor.elev !== null && <span className="text-[#FFC59A]">ELEV {cursor.elev} m</span>}</>
    : <span>{label}</span>
}
