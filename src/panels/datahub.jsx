/* ══════════════════════════════════════════════════════════════════════════
   LEFT RAIL — DATA HUB · ข้อมูลที่ใช้ตัดสินใจจริง
   SFVI · ดาวเทียม (รอบโคจร + เมฆพยากรณ์ + สเปกที่ใช้คำนวณ) · โซน (เวลาน้ำถึง /
   ความลึก / เวลาที่ต้องใช้อพยพ / เรดาร์) · ทรัพยากร
   ══════════════════════════════════════════════════════════════════════════ */

import React from 'react'
import { ChevronLeft, Gauge, Satellite, Map as MapIcon, Boxes, Lock, Zap, WifiOff, Droplets, Cloud, AlertTriangle } from 'lucide-react'
import { Src, Corners, Spark } from '../ui/atoms'
import { Lbl } from '../ui/label'
import { SFVI, THRESHOLDS, THEOS2, ACT2, BOAT } from '../config/missionConfig'
import { HOSPITAL, SHELTER_POOL } from '../config/scenarioData'
import { SECTIONS } from '../lib/sections'
import { arrivalAt, peakDepth, evacNeedMin, depthAt, levelSeries, HARM_M } from '../lib/sim'
import { cloudCells, sectionCloudShare, cloudCover } from '../lib/clouds'
import { TOWN_TARGET } from '../lib/scenario'
import { fmt, clockLabel, clockToDate, clamp } from '../lib/format'

export const sfviHex = (v) => (v >= 0.7 ? '#FF003C' : v >= SFVI.decisionBand ? '#FFB300' : v >= 0.5 ? '#FFD066' : '#22E36B')
const depthHex = (d) => (d >= ACT2.deepWaterM ? '#FF3B63' : d >= RESCUEDEPTH ? '#FF8A3D' : d >= HARM_M ? '#FFD066' : d > 0.05 ? '#7dd3fc' : '#64748b')
const RESCUEDEPTH = 1.5
const hrs = (m) => (Number.isFinite(m) ? `${(m / 60).toFixed(1)} ชม.` : '—')
const tgtName = (t) => (t === TOWN_TARGET ? 'ตัวเมือง' : `Sector ${t}`)

export function DataHub({ eng, tab, setTab, onCollapse }) {
  const { s } = eng
  const tabs = s.act === 1
    ? [['sfvi', 'SFVI', Gauge], ['sat', 'ดาวเทียม', Satellite], ['zones', 'โซน', MapIcon]]
    : [['zones', 'โซน·น้ำ', MapIcon], ['res', 'ทรัพยากร', Boxes], ['sfvi', 'SFVI', Gauge]]
  const cur = tabs.some((t) => t[0] === tab) ? tab : tabs[0][0]
  return (
    <div className="panel flex min-h-0 flex-col" data-rail="data">
      <div className="flex shrink-0 items-center justify-between px-3 pt-2.5">
        <div className="leading-none">
          <div className="font-thai text-[13px] font-semibold text-white">ข้อมูลประกอบการตัดสินใจ</div>
          <div className="hud-label mt-1">DATA HUB</div>
        </div>
        <button onClick={onCollapse} title="พับแผง" className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-white/10 hover:text-white"><ChevronLeft size={14} /></button>
      </div>
      <div className="flex shrink-0 gap-[3px] border-b border-white/[0.07] px-2 pt-2">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} data-left-tab={id}
            className={`font-thai flex flex-1 items-center justify-center gap-1 rounded-t px-1 py-1.5 text-[11px] font-semibold transition ${cur === id ? 'bg-sky-400/15 text-white shadow-[inset_0_-2px_0_#38BDF8]' : 'text-slate-500 hover:text-slate-300'}`}>
            <Icon size={12} />{label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        {cur === 'sfvi' && <SfviCard eng={eng} />}
        {cur === 'sat' && <SatTab eng={eng} />}
        {cur === 'zones' && (s.act === 1 ? <ZonesAct1 eng={eng} /> : <ZonesAct2 eng={eng} />)}
        {cur === 'res' && <Resources eng={eng} />}
      </div>
    </div>
  )
}

/* ── SFVI ─────────────────────────────────────────────────────────────────── */

function SfviCard({ eng }) {
  const { sfvi, s, scn } = eng
  const w = SFVI.weights
  const st = sfvi.scars
  const rows = [
    { k: 'W', w: w.W, v: sfvi.W, src: ['measured'], label: 'ระดับน้ำ', raw: `${sfvi.world.level.toFixed(2)} ม.`, tip: `W = ระดับน้ำสถานีบ้านถ้ำผาจม ÷ ${THRESHOLDS.criticalLevel.toFixed(2)} ม.` },
    { k: 'R', w: w.R, v: sfvi.R, src: ['measured'], label: 'ฝนต้นน้ำ', raw: `${fmt(sfvi.world.rain)} มม.`, tip: `R = ฝนสะสมบ้านโจตาดา ÷ ${SFVI.rainNormMm} มม.` },
    { k: 'L', w: sfvi.Lw, v: sfvi.L, src: ['image'], label: 'ดินถล่ม', raw: `${st.labelled}/${scn.totalScars} จุด`, dim: sfvi.stale, tip: 'L = รอยดินถล่มใหม่ที่ "คุณ" ระบุจากภาพ THEOS-2 ÷ จำนวนทั้งหมดในพื้นที่รับน้ำ' },
    { k: 'N', w: w.N, v: sfvi.N, src: ['image'], label: 'ลำน้ำแคบ', raw: s.channel.measured ? `${scn.channel.widthM}/150 ม.` : 'ยังไม่วัด', tip: 'N = 1 − ความกว้างลำน้ำ ÷ 150 ม. (คำนวณเองจากภาพ)' },
    { k: 'P', w: w.P, v: sfvi.P, src: ['image', 'scenario'], label: 'บ้านเขตน้ำถึง', raw: 'รายโซน', tip: 'P = หลังคาจริง GISTDA ในโซนน้ำถึง ÷ หลังคาทั้งโซน (ดูแท็บโซน)' },
  ]
  const hex = sfviHex(sfvi.basin)
  const series = levelSeries(s.clock, 12, 30)
  return (
    <div className="space-y-2" data-panel="sfvi">
      <div className="relative rounded border border-white/[0.08] bg-white/[0.025] p-2.5">
        <Corners />
        <div className="flex items-center gap-3">
          <span className="num text-[28px] font-bold leading-none" style={{ color: hex, textShadow: `0 0 18px ${hex}77` }}>{sfvi.basin.toFixed(2)}</span>
          <span className="font-thai text-[11.5px] font-semibold leading-tight" style={{ color: sfvi.justified ? '#7CFFA0' : '#FFB3C2' }}>
            {sfvi.veto1 ? 'Veto 1 — ต้องอพยพทันที' : sfvi.justified ? 'หลักฐานพอสั่งอพยพ' : 'หลักฐานยังไม่พอ'}
          </span>
        </div>
        <div className="relative mt-2 h-[7px] w-full overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${sfvi.basin * 100}%`, background: `linear-gradient(90deg,${hex}55,${hex})` }} />
          <div className="absolute top-0 h-full w-[2px] bg-white" style={{ left: `${SFVI.decisionBand * 100}%` }} />
        </div>
        <div className="font-thai mt-1 flex justify-between text-[9.5px] text-slate-500"><span>ความเชื่อมั่นหลักฐาน {Math.round(sfvi.confidence * 100)}%</span><span>เกณฑ์ {SFVI.decisionBand}</span></div>
      </div>
      <div className="num whitespace-nowrap rounded border border-sky-400/15 bg-sky-400/[0.04] px-2 py-1 text-center text-[10.5px] text-sky-200/90">
        SFVI = {rows.map((r, i) => <span key={r.k}>{i ? '+' : ''}<span style={{ color: r.dim ? '#C4B5FD' : undefined }}>{r.w.toFixed(2)}</span>{r.k}</span>)}
      </div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.k} title={`${r.tip} · น้ำหนัก ${r.w.toFixed(2)}`} data-factor={r.k}
            className="relative flex items-center gap-2 overflow-hidden rounded border border-white/[0.06] bg-white/[0.02] px-2 py-[5px]">
            <span className="absolute inset-y-0 left-0 transition-[width] duration-500" style={{ width: `${r.v * 100}%`, background: r.dim ? 'rgba(167,139,250,.13)' : 'rgba(56,189,248,.13)' }} />
            <span className="num relative grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[3px] border border-sky-400/35 bg-[#0b1526] text-[10px] font-bold text-sky-200">{r.k}</span>
            <span className="font-thai relative min-w-0 flex-1 truncate text-[11px] text-slate-200">{r.label} <span className="num text-[10px] text-slate-400">{r.raw}</span></span>
            <span className="num relative w-[30px] shrink-0 text-right text-[11.5px] font-bold text-white">{r.v.toFixed(2)}</span>
            <span className="relative flex shrink-0 items-center gap-1">{r.src.map((x) => <Src key={x} t={x} dot />)}</span>
          </div>
        ))}
        {sfvi.stale && (
          <div className="font-thai flex items-center gap-1.5 rounded border border-[#A78BFA]/25 bg-[#A78BFA]/[0.07] px-2 py-1 text-[10px] text-[#C4B5FD]">
            <Lock size={10} className="shrink-0" /> Cloud Rule — เมฆต้นน้ำ {Math.round(sfvi.world.cloud)}% / ภาพเก่า · น้ำหนัก L เหลือ {sfvi.Lw.toFixed(2)}
          </div>
        )}
      </div>
      <div className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
        <div className="flex items-baseline justify-between">
          <span className="font-thai text-[10.5px] text-slate-400">ระดับน้ำสถานีถ้ำผาจม</span>
          <span className="flex items-center gap-1.5"><span className="num text-[14px] font-bold" style={{ color: sfvi.world.level >= THRESHOLDS.criticalLevel ? '#FF003C' : sfvi.world.level >= sfvi.prepLevel ? '#FFB300' : '#22E36B' }}>{sfvi.world.level.toFixed(2)} ม.</span><Src t="measured" dot /></span>
        </div>
        <Spark data={series} color="#38BDF8" h={30} />
        <div className="font-thai flex justify-between text-[9.5px]"><span className="text-[#FFD066]">เตรียมพร้อม {sfvi.prepLevel.toFixed(2)}{sfvi.narrow ? ' (ลดเกณฑ์)' : ''}</span><span className="text-[#FF6B8A]">วิกฤต {THRESHOLDS.criticalLevel.toFixed(2)}</span></div>
      </div>
      <div className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
        <div className="flex items-baseline justify-between">
          <span className="font-thai text-[10.5px] text-slate-400">ความเชื่อมั่นประชาชน</span>
          <span className="num text-[13px] font-bold" style={{ color: s.trust >= 75 ? '#7CFFA0' : s.trust >= 50 ? '#FFD066' : '#FF6B8A' }}>{Math.round(s.trust)}%</span>
        </div>
        <div className="font-thai text-[9.5px] text-slate-500">เตือนผิด {s.falseAlarms} ครั้ง · ยิ่งเตือนผิด คนยิ่งไม่ยอมอพยพ</div>
      </div>
    </div>
  )
}

/* ── Satellite: pass schedule + cloud forecast + the numbers you need ────── */

function SatTab({ eng }) {
  const { s, scn } = eng
  return (
    <div className="space-y-2" data-panel="sat">
      <div className="rounded border border-sky-400/25 bg-sky-400/[0.05] px-2 py-1.5">
        <div className="flex items-center justify-between"><span className="font-thai text-[11px] font-bold text-sky-100">THEOS-2 (GISTDA)</span><Src t="image" mini /></div>
        <div className="mt-1 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10.5px]">
          <span className="font-thai text-slate-400">ขนาดพิกเซล Pan</span><span className="num text-right font-bold text-white">{THEOS2.panM} ม./พิกเซล</span>
          <span className="font-thai text-slate-400">ขนาดพิกเซล MS</span><span className="num text-right text-white">{THEOS2.msM} ม.</span>
          <span className="font-thai text-slate-400">ความกว้างแถบถ่าย</span><span className="num text-right text-white">{THEOS2.swathKm} กม.</span>
          <span className="font-thai text-slate-400">ภาพ L3 พร้อมหลังถ่าย</span><span className="num text-right text-white">{THEOS2.processingMin / 60} ชม.</span>
          <span className="font-thai text-slate-400">เมฆที่ยังใช้ภาพได้</span><span className="num text-right text-white">≤ {THEOS2.cloudUsablePct}%</span>
          <span className="font-thai text-slate-400">ลำน้ำสายเดิม</span><span className="num text-right text-white">{THRESHOLDS.origChannelWidth} ม.</span>
        </div>
      </div>
      <div className="font-thai text-[10.5px] text-slate-400">รอบโคจร + เมฆพยากรณ์ต่อเป้าหมาย (ค่าจริงตอนถ่ายอาจคลาด ±14%)</div>
      {scn.passes.map((p) => {
        const past = p.t <= s.clock
        const req = s.taskings[p.id] || []
        const imgs = s.images.filter((i) => i.passId === p.id)
        return (
          <div key={p.id} className={`rounded border px-2 py-1.5 ${past ? 'border-white/[0.06] bg-white/[0.015] opacity-80' : 'border-white/[0.1] bg-white/[0.03]'}`} data-pass-row={p.id}>
            <div className="flex items-baseline justify-between">
              <span className="num text-[11.5px] font-bold text-white">{p.id} · {clockLabel(p.t)}</span>
              <span className="font-thai text-[9.5px] text-slate-500">{clockToDate(p.t)}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1">
              {p.reach.map((t) => {
                const f = p.forecast[t], img = imgs.find((i) => i.target === t)
                const hex = f > THEOS2.cloudUsablePct ? '#FF6B8A' : f > 40 ? '#FFD066' : '#7CFFA0'
                return (
                  <span key={t} className="font-thai flex items-center gap-1 rounded border px-1.5 py-[1px] text-[10px]"
                    style={{ borderColor: req.includes(t) ? '#38BDF8' : 'rgba(255,255,255,.1)', background: req.includes(t) ? 'rgba(56,189,248,.12)' : 'transparent' }}>
                    <span className="text-slate-200">{t === TOWN_TARGET ? 'เมือง' : t}</span>
                    <Cloud size={9} style={{ color: hex }} /><span className="num" style={{ color: hex }}>{f}%</span>
                    {img && <span className="num" style={{ color: img.usable ? '#7CFFA0' : '#FF6B8A' }}>→{img.cloud}%{img.usable ? '✓' : '✗'}</span>}
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
      <div className="flex justify-end gap-1"><Src t="scenario" mini /></div>
    </div>
  )
}

/* ── Zones: act 1 forecast table ─────────────────────────────────────────── */

function ZonesAct1({ eng }) {
  const { s, sfvi } = eng
  const score = Object.fromEntries(sfvi.perSection.map((z) => [z.id, z.score]))
  return (
    <div className="space-y-1.5" data-panel="zones">
      <div className="font-thai text-[10.5px] leading-snug text-slate-400">
        พยากรณ์จากแบบจำลอง DEM + ระดับน้ำ (เปลี่ยนตามการอุดตลิ่ง) — โซนที่ <b className="text-[#FFD066]">น้ำถึง − เวลาอพยพ</b> ใกล้หมด ต้องสั่งก่อน
      </div>
      <table className="w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="border-b border-white/10 text-slate-400">
            <th className="py-1 text-left font-thai font-semibold">โซน</th>
            <th className="text-right font-thai font-semibold" title="หลังคาในเขตน้ำถึง / ทั้งหมด (GISTDA)">บ้าน</th>
            <th className="text-right font-semibold">SFVI</th>
            <th className="text-right font-thai font-semibold" title="ลึกสูงสุดที่คาด">ลึก</th>
            <th className="text-right font-thai font-semibold" title="เวลาที่น้ำ ≥ 0.3 ม. − เวลาที่ต้องใช้อพยพ">เหลือ</th>
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map((z) => {
            const peak = peakDepth(s, z), arr = arrivalAt(s, z), need = evacNeedMin(z)
            const slack = arr - s.clock - need
            const ordered = s.orders[z.id] !== undefined
            return (
              <tr key={z.id} className="border-b border-white/[0.05]" data-zone-row={z.id} title={`${z.name} · น้ำถึง ${Number.isFinite(arr) ? clockLabel(arr) : 'ไม่ถึง'} · ต้องใช้เวลาอพยพ ${hrs(need)}`}>
                <td className="py-[3px]">
                  <span className="num font-bold" style={{ color: ordered ? '#7CFFA0' : '#e2e8f0' }}>{z.id}</span>
                  <span className="font-thai ml-1 inline-block max-w-[74px] truncate align-bottom text-[9.5px] text-slate-500">{z.name}</span>
                </td>
                <td className="num text-right text-slate-300">{z.floodHH}<span className="text-slate-600">/{z.roofs}</span></td>
                <td className="num text-right font-bold" style={{ color: sfviHex(score[z.id]) }}>{score[z.id].toFixed(2)}</td>
                <td className="num text-right font-bold" style={{ color: depthHex(peak) }}>{peak.toFixed(1)}</td>
                <td className="num text-right" style={{ color: ordered ? '#7CFFA0' : !Number.isFinite(arr) || peak < HARM_M ? '#64748b' : slack < 0 ? '#FF003C' : slack < 360 ? '#FFB300' : '#cbd5e1' }}>
                  {ordered ? 'สั่งแล้ว' : !Number.isFinite(arr) || peak < HARM_M ? '—' : `${(slack / 60).toFixed(0)}h`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="flex items-center justify-between font-thai text-[9.5px] text-slate-500">
        <span>บ้าน = ในเขตน้ำถึง/ทั้งหมด · ลึก = ม.</span>
        <span className="flex gap-1"><Src t="image" mini /><Src t="scenario" mini /></span>
      </div>
    </div>
  )
}

/* ── Zones: act 2 radar depth + hazards + cloud now ─────────────────────── */

function ZonesAct2({ eng }) {
  const { s, scn } = eng
  const lastRadar = s.radarAt[s.radarAt.length - 1] ?? 0
  const cells = cloudCells(scn, s.clock)
  return (
    <div className="space-y-1.5" data-panel="zones">
      <div className="flex items-center justify-between font-thai text-[10.5px] text-slate-400">
        <span>เรดาร์เช็คน้ำล่าสุด {clockLabel(lastRadar)} · เมฆเหนือเมือง {Math.round(cloudCover(scn, s.clock) * 100)}%</span>
        <Src t="radar" mini />
      </div>
      <table className="w-full border-collapse text-[10.5px]">
        <thead>
          <tr className="border-b border-white/10 text-slate-400">
            <th className="py-1 text-left font-thai font-semibold">โซน</th>
            <th className="text-right font-thai font-semibold" title="ความลึกน้ำจากเรดาร์รอบล่าสุด">ลึก(ม.)</th>
            <th className="text-center font-thai font-semibold">เมฆ</th>
            <th className="text-center font-thai font-semibold">อันตราย</th>
            <th className="text-right font-thai font-semibold">จุดที่พบ</th>
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map((z) => {
            const d = depthAt(s, z, lastRadar)
            const cloudy = sectionCloudShare(cells, z) >= 0.5
            const power = s.hazardsLive.includes(z.id) && !s.powerCut[z.id]
            const comm = s.commDown.includes(z.id)
            const blind = scn.blindSpots.includes(z.id)
            const pts = s.points.filter((p) => p.section === z.id && p.revealed)
            const open = pts.filter((p) => p.status === 'waiting').length
            return (
              <tr key={z.id} className="border-b border-white/[0.05]" data-zone-row={z.id} title={z.name}>
                <td className="py-[3px]"><span className="num font-bold text-slate-100">{z.id}</span><span className="font-thai ml-1 inline-block max-w-[62px] truncate align-bottom text-[9.5px] text-slate-500">{z.name}</span></td>
                <td className="num text-right font-bold" style={{ color: depthHex(d) }}>{d.toFixed(1)}{s.pumps[z.id] && <Droplets size={9} className="ml-0.5 inline text-sky-300" />}</td>
                <td className="text-center">{cloudy ? <Cloud size={11} className="inline text-slate-300" /> : <span className="text-[9px] text-[#7CFFA0]">เปิด</span>}</td>
                <td className="text-center">
                  {power && <Zap size={11} className="inline text-[#FFD066]" />}
                  {comm && <WifiOff size={11} className="ml-0.5 inline text-[#FF6B8A]" />}
                  {blind && <span className="font-thai ml-0.5 text-[9px] text-[#C4B5FD]" title="จุดอับ ต้องใช้โดรน">อับ</span>}
                  {!power && !comm && !blind && <span className="text-slate-600">·</span>}
                </td>
                <td className="num text-right" style={{ color: open ? '#FF6B8A' : '#64748b' }}>{open ? `${open} รอ` : pts.length || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="font-thai rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[9.5px] leading-snug text-slate-500">
        ลึก ≥ {ACT2.deepWaterM} ม. = น้ำไหลเชี่ยว เรือผ่านไม่ปลอดภัยจนกว่าจะสูบน้ำ · เรดาร์ทะลุเมฆแต่ไม่เห็นคน — คนต้องหาด้วย THEOS-2 (ช่องเมฆ) สายด่วน หรือโดรน
      </div>
    </div>
  )
}

/* ── Resources (act 2) ───────────────────────────────────────────────────── */

function Resources({ eng }) {
  const { s, scn, mode } = eng
  const t = s.clock
  const fuelLeft = s.fuel.total - s.fuel.used
  const Row = ({ label, value, hex = '#fff', sub }) => (
    <div className="flex items-baseline justify-between border-b border-white/[0.05] py-[4px]">
      <span className="font-thai text-[11px] text-slate-300">{label}</span>
      <span className="num text-[11.5px] font-bold" style={{ color: hex }}>{value}{sub && <span className="text-[9.5px] font-normal text-slate-500"> {sub}</span>}</span>
    </div>
  )
  const saved = s.points.reduce((a, p) => a + p.rescued, 0)
  return (
    <div className="space-y-2" data-panel="res">
      <div className="rounded border border-white/[0.08] bg-white/[0.025] px-2 py-1">
        <Row label="งบปฏิบัติการคงเหลือ" value={`฿${fmt(s.budget.total - s.budget.spent)}`} hex="#FFD066" />
        <Row label="น้ำมันเรือคงเหลือ" value={`${fmt(fuelLeft)} L`} sub={`/ ${fmt(s.fuel.total)}`} hex={fuelLeft / Math.max(1, s.fuel.total) < 0.2 ? '#FF6B8A' : '#7dd3fc'} />
        <Row label="อัตราใช้น้ำมันเรือ" value={`${BOAT.fuelLPerKm} L/กม.`} sub={`· ${BOAT.speedKmh} กม./ชม. · จุ ${BOAT.capacity} คน`} />
        <Row label="เส้นทางผิด" value={s.routeErrors} hex={s.routeErrors ? '#FF6B8A' : '#7CFFA0'} />
      </div>
      <div className="font-thai text-[10.5px] font-semibold text-slate-300">เรือกู้ภัย</div>
      <div className="grid grid-cols-3 gap-1">
        {s.boats.map((b) => {
          const busy = b.busyUntil > t
          return (
            <div key={b.id} className="rounded border px-1.5 py-1 text-center" style={{ borderColor: busy ? '#FFB30055' : '#22E36B55', background: busy ? '#FFB30010' : '#22E36B10' }}>
              <div className="num text-[11px] font-bold text-white">{b.id}</div>
              <div className="font-thai text-[9.5px]" style={{ color: busy ? '#FFD066' : '#7CFFA0' }}>{busy ? `กลับ ${clockLabel(b.busyUntil)}` : 'ว่าง'}</div>
            </div>
          )
        })}
      </div>
      <div className="rounded border border-white/[0.08] bg-white/[0.025] px-2 py-1">
        <Row label="โดรนว่าง" value={`${s.drones.filter((d) => d.busyUntil <= t).length}/${s.drones.length}`} />
        <Row label="เครื่องสูบน้ำที่ติดตั้ง" value={`${Object.keys(s.pumps).length}/${mode.pumps}`} />
        <Row label="ส่งถึงโรงพยาบาล" value={`${s.hospital} คน`} hex="#7dd3fc" />
        <Row label="ส่งถึงจุดอพยพ" value={`${s.sheltered} คน`} hex="#7CFFA0" />
        <Row label="ช่วยได้แล้วรวม" value={`${saved} คน`} hex="#7CFFA0" />
      </div>
      <div className="font-thai text-[10.5px] font-semibold text-slate-300">ปลายทางที่เปิด (สุ่มต่อเกม)</div>
      <div className="space-y-1">
        <div className="font-thai flex items-center justify-between rounded border border-[#38BDF8]/30 bg-[#38BDF8]/[0.06] px-2 py-1 text-[10.5px]"><span className="text-sky-100">🏥 {HOSPITAL.th}</span><span className="num text-slate-400">{HOSPITAL.elev} ม.</span></div>
        {scn.shelters.map((id) => SHELTER_POOL.find((x) => x.id === id)).map((sh) => (
          <div key={sh.id} className="font-thai flex items-center justify-between rounded border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[10.5px]"><span className="text-slate-200">⛺ {sh.th}</span><span className="num text-slate-400">{sh.elev} ม.</span></div>
        ))}
      </div>
    </div>
  )
}

export { depthHex }
