/* ══════════════════════════════════════════════════════════════════════════
   RIGHT RAIL — COMMAND · แผงสั่งการ
   Act 1: imagery & layers · resources · decision
   Act 2: radar & layers · Sphere routing · triage · resources
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo } from 'react'
import {
  Layers, Lock, Check, Crosshair, Megaphone, Bell, Clock, AlertTriangle, CheckCircle2, Truck, Route, Radar, ChevronRight, Loader2, Wifi, WifiOff, ChevronDown,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Panel, Btn, Src, Divider, Corners, Tabs } from '../ui/atoms'
import { LAYERS, SECTORS, TACTICAL, QUICK_DEPLOY, SHORTAGE, COMMUNITIES, RES_PROOF } from '../config/scenarioData'
import { GAME, THEOS2, SFVI, CLOUD_RULE, OFFLINE_ROUTING } from '../config/missionConfig'
import { ARRIVAL, evacNeedMin, cloudAt } from '../lib/sim'
import { evacCostFor } from '../engine/useEngine'
import { sphereReady } from '../lib/sphere'
import { COMMUNITIES_LIVE } from '../lib/buildings'
import { fmt, clockLabel } from '../lib/format'
import { sfviHex } from './assessment'

export function CommandRail({ eng, tab, setTab, setView, onCollapse, onRoute, onHoldResult }) {
  const { s } = eng
  const act1 = s.act === 1
  const tabs = act1
    ? [['data', 'ข้อมูล/ภาพ'], ['resources', 'ทรัพยากร'], ['decide', 'ตัดสินใจ', eng.veto1]]
    : [['data', 'ข้อมูล'], ['route', 'เส้นทาง', !s.detourSolved], ['triage', 'จัดลำดับ', !s.convoy], ['resources', 'ทรัพยากร']]
  const current = tabs.some((t) => t[0] === tab) ? tab : tabs[0][0]
  return (
    <Panel className="flex min-h-0 flex-1 flex-col" data-rail="command">
      <div className="flex shrink-0 items-center justify-between px-3 pt-2.5">
        <div className="leading-none">
          <div className="font-thai text-[13px] font-semibold text-white">แผงสั่งการ</div>
          <div className="hud-label mt-1">COMMAND · ACT {['I', 'II', 'III'][s.act - 1]}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="num rounded border border-[#FFB300]/35 bg-[#FFB300]/10 px-1.5 py-[2px] text-[10px] font-bold text-[#FFD066]" title="เหรียญข้อมูล">◈ {s.coins}</span>
          <span className="num rounded border border-sky-400/30 bg-sky-400/10 px-1.5 py-[2px] text-[10px] font-bold text-sky-200" title="แต้มสั่งการ (Action Points)">{fmt(s.ap)} AP</span>
          <button onClick={onCollapse} title="พับแผง" className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-white/10 hover:text-white">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      <Tabs items={tabs} value={current} onChange={setTab} tone={act1 ? '#38BDF8' : '#FF003C'} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {current === 'data' && (
          <div className="space-y-3">
            <LayersList eng={eng} />
            {act1 ? <TaskingPanel eng={eng} setView={setView} /> : <SensorHandover />}
            {act1 && <ResolutionBlock />}
          </div>
        )}
        {current === 'resources' && (act1 ? <ResourcesAct1 eng={eng} /> : <ResourcesAct2 eng={eng} />)}
        {current === 'decide' && <DecisionBlock eng={eng} onHoldResult={onHoldResult} />}
        {current === 'route' && <RoutingTool eng={eng} onRoute={onRoute} />}
        {current === 'triage' && <PriorityPanel eng={eng} />}
      </div>
    </Panel>
  )
}

/* ── Layers ─────────────────────────────────────────────────────────────── */

function LayersList({ eng }) {
  const { s, toggleLayer } = eng
  const cloudLocked = cloudAt(s.clock) >= CLOUD_RULE.opticalLockPct
  const groups = useMemo(() => {
    const g = {}
    LAYERS.forEach((l) => { if (!l.actOnly || l.actOnly === s.act) (g[l.group] ||= []).push(l) })
    return g
  }, [s.act])
  return (
    <div data-panel="layers">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5"><Layers size={12} className="text-sky-300" /><span className="panel-title">MAP LAYERS</span></span>
        <span className="font-thai text-[10px] text-slate-500">เปิดแล้ว {s.layersOpened.length} ชั้น</span>
      </div>
      <div className="font-thai mt-1 text-[10px] leading-snug text-slate-500">ชั้นข้อมูลทุกชั้นมีราคาเป็นเหรียญ ◈ — ซื้อครั้งเดียวต่อรอบ เปิดซ้ำฟรี</div>
      {Object.entries(groups).map(([g, items]) => (
        <div key={g}>
          <Divider label={g} />
          <div className="space-y-1">
            {items.map((l) => {
              const on = !!s.layers[l.id]
              const locked = l.optical && cloudLocked
              const paid = s.purchased.includes(l.id)
              const tooPoor = !on && !locked && !paid && s.coins < l.cost
              return (
                <button key={l.id} disabled={locked} onClick={() => toggleLayer(l.id)} data-layer={l.id}
                  className={`group flex w-full items-center gap-2 rounded border px-2 py-[6px] text-left transition
                    ${locked ? 'cursor-not-allowed border-[#A78BFA]/20 bg-[#A78BFA]/[0.04]'
                      : on ? 'border-sky-400/40 bg-sky-400/[0.09]'
                        : tooPoor ? 'border-white/[0.06] bg-white/[0.015] opacity-50'
                          : 'border-white/[0.07] bg-white/[0.02] hover:border-sky-400/30 hover:bg-white/[0.05]'}`}>
                  <span className={`grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] border transition
                    ${locked ? 'border-[#A78BFA]/45' : on ? 'border-sky-400 bg-sky-400' : 'border-slate-500/60'}`}>
                    {locked ? <Lock size={8} className="text-[#A78BFA]" /> : on ? <Check size={10} strokeWidth={3.5} className="text-[#04121F]" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[11px] leading-tight ${locked ? 'text-[#A78BFA]/70 line-through' : on ? 'text-white' : 'text-slate-300'}`}>{l.name}</span>
                    <span className="font-thai block truncate text-[9.5px] leading-tight text-slate-500">{locked ? 'เมฆปกคลุม 100% — ปิดอัตโนมัติ' : l.sub}</span>
                  </span>
                  <Src t={l.src} mini />
                  {!locked && !on && !paid && <span className="num shrink-0 rounded border border-[#FFB300]/30 px-1 text-[9px] text-[#FFD066]">◈{l.cost}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── THEOS-2 tasking ────────────────────────────────────────────────────── */

function TaskingPanel({ eng, setView }) {
  const { s } = eng
  const cloudNow = cloudAt(s.clock + GAME.swathMinutes)
  return (
    <div className="space-y-2" data-panel="tasking">
      <Divider label="THEOS-2 TASKING · สั่งถ่ายภาพต้นน้ำ" />
      <div className="relative rounded border border-white/[0.08] bg-white/[0.025] p-2.5">
        <Corners />
        <div className="flex items-end gap-2">
          <span className="num text-[24px] font-bold leading-none text-white">{s.swaths}</span>
          <span className="font-thai pb-0.5 text-[10.5px] text-slate-400">แถบคงเหลือ · แถบละ {THEOS2.swathKm} กม. · {fmt(GAME.swathAP)} AP</span>
        </div>
        <div className="mt-2 flex gap-1">
          {Array.from({ length: GAME.swaths }, (_, i) => (
            <div key={i} className="h-[5px] flex-1 rounded-full" style={{ background: i < s.swaths ? '#38BDF8' : 'rgba(255,255,255,.08)', boxShadow: i < s.swaths ? '0 0 8px #38BDF8' : 'none' }} />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1 border-t border-white/[0.07] pt-2 font-mono text-[9px] text-slate-400">
          <div>PAN <span className="text-white">{THEOS2.panM} m</span></div><div>MS <span className="text-white">{THEOS2.msM} m</span></div>
          <div>REVISIT <span className="text-white">{THEOS2.revisitDays} d</span></div>
          <div>CLOUD <span style={{ color: cloudNow > CLOUD_RULE.cloudPct ? '#C4B5FD' : '#fff' }}>{Math.round(cloudNow)}%</span></div>
        </div>
      </div>
      {cloudNow > CLOUD_RULE.cloudPct && (
        <div className="font-thai flex items-start gap-1.5 rounded border border-[#A78BFA]/30 bg-[#A78BFA]/[0.08] px-2 py-1.5 text-[10px] leading-snug text-[#C4B5FD]">
          <Lock size={10} className="mt-[2px] shrink-0" /> เมฆเกิน {CLOUD_RULE.cloudPct}% — ภาพที่สั่งถ่ายตอนนี้จะมองไม่เห็นพื้นดิน
        </div>
      )}
      <Btn variant="primary" icon={Crosshair} className="w-full" onClick={() => setView('catchment')}>
        <span className="font-thai normal-case tracking-normal">ดูแผนที่ลุ่มน้ำต้นน้ำ (AOI-B)</span>
      </Btn>
      <div className="space-y-1">
        {SECTORS.map((sec) => {
          const done = s.tasked.includes(sec.id)
          const cloudy = !done && s.cloudyPasses.includes(sec.id)
          return (
            <button key={sec.id} disabled={done || s.swaths <= 0 || s.ap < GAME.swathAP} data-task={sec.id}
              onClick={() => { setView('catchment'); eng.taskSwath(sec.id) }}
              className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left transition
                ${done ? 'border-[#22E36B]/35 bg-[#22E36B]/[0.07]' : 'border-white/[0.07] bg-white/[0.02] hover:border-sky-400/40 hover:bg-white/[0.05] disabled:opacity-35'}`}>
              <span className="num grid h-[20px] w-[20px] shrink-0 place-items-center rounded-[3px] border text-[10px] font-bold"
                style={{ borderColor: done ? '#22E36B66' : '#38BDF855', color: done ? '#7CFFA0' : '#9FCBEF' }}>{sec.id}</span>
              <span className="min-w-0 flex-1">
                <span className="font-thai block truncate text-[11px] text-slate-200">{sec.th}</span>
                <span className="block text-[9px] text-slate-500">{sec.widthAt ? 'วัดความกว้างลำน้ำ (N) ได้' : `ป่าหาย ${sec.forestLoss}%`}</span>
              </span>
              {done ? <span className="num shrink-0 text-[10px] font-bold text-[#FF6B8A]">{sec.scars} จุด</span>
                : cloudy ? <span className="font-thai shrink-0 text-[9.5px] text-[#C4B5FD]">เมฆบัง</span>
                  : <Src t="image" mini />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ResolutionBlock() {
  const [open, setOpen] = useState(false)
  const data = RES_PROOF.map((r) => ({ name: r.width, 'Sentinel-2 10 m': r.s2, 'THEOS-2 MS 2 m': r.ms, 'THEOS-2 Pan 0.5 m': r.pan }))
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 py-1">
        <span className="hud-label">RESOLUTION PROOF · ข้อพิสูจน์เชิงตัวเลข</span>
        <ChevronDown size={11} className={`ml-auto text-slate-500 transition ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <ResolutionProof data={data} />}
    </div>
  )
}

export function ResolutionProof({ data, compact = true }) {
  const rows = data || RES_PROOF.map((r) => ({ name: r.width, 'Sentinel-2 10 m': r.s2, 'THEOS-2 MS 2 m': r.ms, 'THEOS-2 Pan 0.5 m': r.pan }))
  return (
    <div className="space-y-2">
      <div style={{ height: compact ? 130 : 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#7d93b2', fontSize: 9, fontFamily: 'monospace' }} axisLine={{ stroke: 'rgba(148,163,184,.2)' }} tickLine={false} />
            <YAxis tick={{ fill: '#7d93b2', fontSize: 9, fontFamily: 'monospace' }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip contentStyle={{ background: '#0B132B', border: '1px solid rgba(56,189,248,.3)', borderRadius: 6, fontSize: 11 }}
              labelStyle={{ color: '#7dd3fc' }} formatter={(v) => `${v}% pure pixels`} />
            <Bar dataKey="Sentinel-2 10 m" fill="#FF003C" radius={[2, 2, 0, 0]} />
            <Bar dataKey="THEOS-2 MS 2 m" fill="#FFB300" radius={[2, 2, 0, 0]} />
            <Bar dataKey="THEOS-2 Pan 0.5 m" fill="#22E36B" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="font-thai rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-[10px] leading-snug text-slate-400">
        พิกเซลบริสุทธิ์ = <span className="num text-sky-200">(w − 2p) / w</span> · รอยดินถล่ม 20 ม. ที่จุดภาพ 10 ม. เหลือพิกเซลบริสุทธิ์
        <b className="text-[#FF6B8A]"> 0%</b> — ตรวจพบได้แต่วัดความกว้างไม่ได้ THEOS-2 Pan 0.5 ม. ได้ 40–60 พิกเซล
      </div>
    </div>
  )
}

function SensorHandover() {
  return (
    <div className="rounded border border-[#FF8A3D]/30 bg-[#FF8A3D]/[0.07] px-2.5 py-2">
      <div className="flex items-center gap-2">
        <Radar size={13} className="text-[#FF8A3D]" />
        <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-[#FFC59A]">SENSOR HANDOVER</span>
        <Src t="radar" mini />
      </div>
      <div className="font-thai mt-1.5 text-[10.5px] leading-snug text-slate-300">
        เมฆปกคลุม 100% ภาพเชิงแสงใช้ไม่ได้ ระยะนี้ <b>ไม่ใช้ THEOS-2</b> — ตรงกับแนวปฏิบัติจริงของ GISTDA ที่ใช้ภาพเรดาร์
        RADARSAT-2 เมื่อ 10 และ 12 ก.ย. 2567 ผ่านแพลตฟอร์ม เช็คน้ำ / Disaster Platform
      </div>
    </div>
  )
}

/* ── Resources ──────────────────────────────────────────────────────────── */

function TacticalGrid({ eng, highlightEvac }) {
  const { s } = eng
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {TACTICAL.map((t) => {
        const isEvac = t.id === 'evac'
        const cost = isEvac ? evacCostFor(s.act, 4) : t.ap
        return (
          <button key={t.id} onClick={() => eng.tactical(t.id)} disabled={s.ap < cost} data-tactical={t.id}
            title={`${t.name} — ${t.th} · ${fmt(cost)} AP`}
            className={`group relative rounded border p-1.5 text-center transition disabled:opacity-35
              ${isEvac && highlightEvac ? 'border-[#FF003C]/55 bg-[#FF003C]/[0.1] hover:bg-[#FF003C]/20' : 'border-white/[0.08] bg-white/[0.025] hover:border-sky-400/40 hover:bg-white/[0.05]'}`}>
            <div className="font-thai truncate text-[10px] text-slate-300">{t.th}</div>
            <div className="my-1 grid h-[30px] place-items-center">
              <t.icon size={19} className={isEvac && highlightEvac ? 'text-[#FF3B63] animate-[flash_1.8s_ease-in-out_infinite]' : 'text-sky-200/75 group-hover:text-sky-100'} />
            </div>
            <div className="num text-[9px] text-[#FFD066]">{fmt(cost)} AP</div>
          </button>
        )
      })}
    </div>
  )
}

function ResourcesAct1({ eng }) {
  const { s, deploy } = eng
  return (
    <div className="space-y-3" data-panel="resources">
      <Divider label="QUICK DEPLOY · จัดสรรกำลัง" />
      <div className="grid grid-cols-3 gap-1.5">
        {QUICK_DEPLOY.map((q) => (
          <button key={q.id} onClick={() => deploy(q.id)} disabled={s.ap < q.ap} data-deploy={q.id}
            className="group relative overflow-hidden rounded border border-white/[0.08] bg-white/[0.025] p-2 text-left transition hover:border-sky-400/40 hover:bg-white/[0.05] disabled:opacity-35">
            <Corners />
            <div className="font-thai truncate text-[11px] text-slate-200">{q.th}</div>
            <div className="my-1.5 grid h-[34px] place-items-center rounded bg-gradient-to-b from-white/[0.05] to-transparent">
              <q.icon size={22} className="text-sky-200/80 group-hover:text-sky-100" />
            </div>
            <div className="num text-[12px] font-bold text-sky-300">{fmt(q.stock - (s.deployed[q.id] || 0))}</div>
            <div className="num text-[9px] text-[#FFD066]">{q.ap} AP · +{q.batch}</div>
            {(s.deployed[q.id] || 0) > 0 && (
              <div className="mt-1 rounded bg-[#22E36B]/12 px-1 py-[1px] text-center font-mono text-[8px] text-[#7CFFA0]">+{fmt(s.deployed[q.id])} SENT</div>
            )}
          </button>
        ))}
      </div>
      <Divider label="TACTICAL ACTIONS · ปฏิบัติการ" />
      <TacticalGrid eng={eng} />
      {s.queue.length > 0 && (
        <>
          <Divider label={`DEPLOYMENT QUEUE · ${s.queue.length}`} />
          <div className="space-y-1">
            {s.queue.map((q) => (
              <div key={q.id} className="flex items-center gap-2 rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
                <Truck size={11} className="shrink-0 text-sky-300" />
                <span className="min-w-0 flex-1 truncate text-[10px] text-slate-300">{q.name} × {q.qty}</span>
                <span className="num shrink-0 text-[9.5px]" style={{ color: q.eta > 0 ? '#FFD066' : '#7CFFA0' }}>{q.eta > 0 ? `ETA ${q.eta}m` : 'ON SITE'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function ResourcesAct2({ eng }) {
  return (
    <div className="space-y-3" data-panel="resources">
      <div className="flex items-center justify-between">
        <span className="hud-label">RESOURCE STATUS</span>
        <span className="font-mono text-[9px] font-bold tracking-[0.1em] text-[#FF003C] animate-[softflash_1.8s_ease-in-out_infinite]">CRITICAL SHORTAGE</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {SHORTAGE.map((r) => {
          const hex = r.pct === 0 ? '#FF003C' : r.pct < 20 ? '#FF3B63' : r.pct < 30 ? '#FF7A1A' : '#FFB300'
          return (
            <div key={r.id} className="relative rounded border p-1.5 text-center" style={{ borderColor: `${hex}33`, background: `${hex}0A` }}>
              <div className="font-thai truncate text-[10px]" style={{ color: `${hex}dd` }}>{r.th}</div>
              <div className="my-1 grid h-[28px] place-items-center"><r.icon size={18} style={{ color: hex }} /></div>
              <div className="num text-[14px] font-bold leading-none" style={{ color: hex }}>{r.pct}%</div>
              <div className="num mt-0.5 text-[8px] text-slate-500">{fmt(r.have)} / {fmt(r.max)}</div>
            </div>
          )
        })}
      </div>
      <Divider label="TACTICAL ACTIONS · ปฏิบัติการ" />
      <TacticalGrid eng={eng} highlightEvac />
      <div className="font-thai rounded border border-[#FF003C]/25 bg-[#FF003C]/[0.06] px-2.5 py-2 text-[10px] leading-snug text-[#FFB3C2]">
        น้ำเข้าเมืองแล้ว การประกาศอพยพตอนนี้คือ<b>การเตือนช้า</b> — เสียความเชื่อมั่น −30% ครั้งเดียว และครัวเรือนที่ยังไม่ได้รับคำสั่งได้รับผลกระทบไปแล้ว
      </div>
    </div>
  )
}

/* ── Decision (Act 1) ───────────────────────────────────────────────────── */

export function DecisionBlock({ eng, onHoldResult }) {
  const { s, sfvi, veto1, issueOrder } = eng
  const pending = COMMUNITIES.filter((c) => s.evacOrders[c.id] === undefined).map((c) => c.id)
  const [sel, setSel] = useState(null)
  const chosen = (sel ?? pending).filter((id) => pending.includes(id))
  const cost = evacCostFor(s.act, chosen.length || 4)
  const gaugeOk = veto1 || sfvi.world.level >= sfvi.prepLevel
  const unjustified = gaugeOk ? [] : chosen.filter((id) => !sfvi.recommended.includes(id))
  const toggle = (id) => setSel((cur) => {
    const base = cur ?? pending
    return base.includes(id) ? base.filter((x) => x !== id) : [...base, id]
  })
  const hrs = (m) => (m === Infinity ? '—' : `${(m / 60).toFixed(1)} ชม.`)

  return (
    <div className="space-y-2.5" data-panel="decide">
      {veto1 && (
        <div className="flex items-start gap-2 rounded border border-[#FF003C]/60 bg-[#FF003C]/12 px-2.5 py-2 animate-[softflash_1.6s_ease-in-out_infinite]">
          <AlertTriangle size={13} className="mt-[1px] shrink-0 text-[#FF003C]" />
          <span className="font-thai text-[10.5px] leading-snug text-[#FFB3C2]">
            <b className="font-mono">VETO 1</b> — ระดับน้ำ {sfvi.world.level.toFixed(2)} ม. ≥ 4.20 ม. สั่งอพยพทันที ห้ามรอภาพรอบหน้า
          </span>
        </div>
      )}

      <Divider label="เลือกชุมชนที่จะอพยพ · เทียบ SFVI" />
      <div className="space-y-1">
        {COMMUNITIES_LIVE.map((c) => {
          const score = sfvi.perCommunity.find((x) => x.id === c.id).score
          const ordered = s.evacOrders[c.id] !== undefined
          const on = !ordered && chosen.includes(c.id)
          const rec = sfvi.recommended.includes(c.id)
          const eta = ARRIVAL[c.id] - s.clock
          const need = evacNeedMin(c)
          return (
            <button key={c.id} disabled={ordered} onClick={() => toggle(c.id)} data-pick={c.id}
              className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left transition
                ${ordered ? 'border-[#22E36B]/35 bg-[#22E36B]/[0.07]' : on ? 'border-[#FF6B8A]/50 bg-[#FF003C]/[0.08]' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]'}`}>
              <span className={`grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] border
                ${ordered ? 'border-[#22E36B] bg-[#22E36B]' : on ? 'border-[#FF6B8A] bg-[#FF6B8A]' : 'border-slate-500/60'}`}>
                {(ordered || on) && <Check size={10} strokeWidth={3.5} className="text-[#04121F]" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="font-thai block truncate text-[11.5px] text-white">{c.th}
                  {c.exits === 1 && <span className="ml-1 text-[9.5px] text-[#FF6B8A]">· ทางออก 1 เส้น</span>}</span>
                <span className="font-thai block text-[9.5px] text-slate-500">
                  {ordered ? `สั่งอพยพแล้ว ณ ${clockLabel(s.evacOrders[c.id])}` : `น้ำถึงอีก ~${hrs(eta)} · อพยพใช้ ${hrs(need)} · ${c.floodRoofs} หลังคาเสี่ยง`}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="num block text-[11px] font-semibold" style={{ color: sfviHex(score) }}>{score.toFixed(3)}</span>
                <span className="font-thai block text-[9px]" style={{ color: rec ? '#7CFFA0' : '#64748b' }}>{rec ? '≥ เกณฑ์' : 'ต่ำกว่าเกณฑ์'}</span>
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between font-thai text-[9.5px] text-slate-500">
        <span>เวลาน้ำถึง/อพยพ = แบบจำลอง</span><Src t="scenario" mini />
      </div>

      <Btn variant="danger" size="lg" icon={Megaphone} className="w-full" disabled={!pending.length || !chosen.length || s.ap < cost}
        onClick={() => { issueOrder('EVACUATE', chosen); setSel(null) }}>
        <span className="font-thai normal-case tracking-normal text-[12px]">ประกาศอพยพ {chosen.length} ชุมชน · {fmt(cost)} AP</span>
      </Btn>
      <Btn variant="warn" size="lg" icon={Bell} className="w-full" disabled={s.ap < GAME.standbyAP} onClick={() => issueOrder('STANDBY')}>
        <span className="font-thai normal-case tracking-normal text-[12px]">แจ้งเตรียมพร้อม + ขอภาพเร่งด่วน · {GAME.standbyAP} AP</span>
      </Btn>
      <Btn variant="solid" size="lg" icon={Clock} className="w-full" disabled={veto1}
        title={veto1 ? 'Veto 1 ทำงาน — ห้ามรอ' : ''}
        onClick={() => { const r = issueOrder('HOLD'); if (r) onHoldResult?.(r) }}>
        <span className="font-thai normal-case tracking-normal text-[12px]">ยังไม่สั่งการ — รอภาพรอบหน้า (+{GAME.holdMinutes / 60} ชม.)</span>
      </Btn>

      <div className="flex items-center justify-between rounded border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
        <span className="font-thai text-[10.5px] text-slate-400">คำสั่งนี้จะเป็น</span>
        <span className="font-thai text-[11px] font-bold" style={{ color: unjustified.length ? '#FF6B8A' : '#7CFFA0' }}>
          {unjustified.length ? `เสี่ยงเตือนผิด (${unjustified.length} ชุมชนต่ำกว่าเกณฑ์)` : 'มีหลักฐานรองรับ'}
        </span>
      </div>
    </div>
  )
}

/* ── Routing (Act 2) ────────────────────────────────────────────────────── */

function RoutingTool({ eng, onRoute }) {
  const { s } = eng
  const [cid, setCid] = useState('slj')
  const [busy, setBusy] = useState(false)
  const online = sphereReady()
  const run = async () => {
    setBusy(true)
    try { await onRoute(cid) } finally { setBusy(false) }
  }
  return (
    <div className="space-y-2.5" data-panel="route">
      <div className="relative rounded border border-white/[0.08] bg-white/[0.025] p-2.5">
        <Corners />
        <div className="flex items-center gap-2">
          <Route size={13} className="text-[#22E36B]" />
          <span className="font-mono text-[10.5px] font-bold tracking-[0.1em] text-sky-100">SPHERE ROUTING</span>
          <span className={`ml-auto flex items-center gap-1 font-thai text-[10px] ${online ? 'text-[#7CFFA0]' : 'text-[#FFD066]'}`}>
            {online ? <Wifi size={11} /> : <WifiOff size={11} />}{online ? 'เชื่อม API แล้ว' : 'โหมดออฟไลน์'}
          </span>
        </div>
        <div className="font-thai mt-1.5 text-[10.5px] leading-snug text-slate-400">
          {online
            ? 'เรียก sphere Routing API (mode t — เลี่ยงถนนปิดและพื้นที่น้ำท่วม) จากชุมชนไปจุดอพยพบนที่สูง'
            : 'เชื่อม sphere ไม่ได้ (ออฟไลน์/ไม่มีคีย์) — ใช้ตัวคำนวณเส้นทางออฟไลน์บนโครงข่ายถนน OpenStreetMap โดยปิดถนนริมน้ำที่ท่วม'}
        </div>
      </div>
      <Divider label="ต้นทาง · ชุมชน" />
      <div className="grid grid-cols-2 gap-1.5">
        {COMMUNITIES.map((c) => {
          const has = s.routes[c.id]
          return (
            <button key={c.id} onClick={() => setCid(c.id)} data-route-from={c.id}
              className={`rounded border px-2 py-1.5 text-left transition ${cid === c.id ? 'border-[#22E36B]/60 bg-[#22E36B]/[0.1]' : 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05]'}`}>
              <div className="font-thai flex items-center justify-between text-[11.5px] text-white">{c.th}{has && <CheckCircle2 size={11} className="text-[#22E36B]" />}</div>
              <div className="font-thai text-[9.5px] text-slate-500">ทางออก {c.exits} เส้น</div>
            </button>
          )
        })}
      </div>
      <Btn variant="go" size="lg" icon={busy ? Loader2 : Route} className="w-full" disabled={busy || s.ap < GAME.detourAP} onClick={run}>
        <span className="font-thai normal-case tracking-normal text-[12px]">{busy ? 'กำลังคำนวณ…' : `คำนวณเส้นทางหนีน้ำ · ${GAME.detourAP} AP`}</span>
      </Btn>
      {Object.values(s.routes).length > 0 && (
        <>
          <Divider label="ผลการคำนวณ" />
          {Object.values(s.routes).map((r) => {
            const c = COMMUNITIES.find((x) => x.id === r.cid)
            return (
              <div key={r.cid} className="rounded border border-[#22E36B]/25 bg-[#22E36B]/[0.05] px-2.5 py-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-thai text-[11.5px] text-white">{c.th} → จุดอพยพ</span>
                  <Src t={r.source === 'sphere' ? 'measured' : 'scenario'} mini />
                </div>
                <div className="num mt-0.5 text-[11px] text-[#7CFFA0]">{(r.distanceM / 1000).toFixed(2)} km · ~{Math.round(r.durationS / 60)} min</div>
                <div className="font-thai text-[9.5px] text-slate-500">
                  {r.source === 'sphere'
                    ? `GISTDA sphere Routing API${r.via ? ' · เลี่ยงถนนริมน้ำที่ท่วมผ่านจุดแวะ' : ''}`
                    : `ออฟไลน์ · OSM · ปิดถนนริมแม่น้ำสาย ≤ ${OFFLINE_ROUTING.floodBufferM} ม.`}
                </div>
                {r.steps?.length > 0 && (
                  <div className="font-thai mt-0.5 truncate text-[9.5px] text-slate-400" title={[...new Set(r.steps)].join(' → ')}>
                    ผ่าน: {[...new Set(r.steps)].slice(0, 4).join(' → ')}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

/* ── Triage (Act 2) ─────────────────────────────────────────────────────── */

function PriorityPanel({ eng }) {
  const { s, sfvi, setPriority } = eng
  const correct = sfvi.ranked.map((c) => c.id)
  const chosen = s.priorities
  const graded = s.convoy
  return (
    <div className="space-y-2.5" data-panel="triage">
      <Divider label="TRIAGE · จัดลำดับ 4 ชุมชนเฝ้าระวัง" />
      <div className="font-thai text-[10.5px] leading-snug text-slate-400">
        ทรัพยากรไปไม่ถึงทั้ง 4 ชุมชนพร้อมกัน — คลิกเรียงลำดับการส่งกำลัง ถ้าคะแนนเท่ากัน ให้ชุมชนที่<b className="text-sky-200">เหลือทางออกน้อยกว่า</b>ได้ก่อน
      </div>
      <div className="space-y-1">
        {sfvi.perCommunity.map((c) => {
          const rank = chosen.indexOf(c.id)
          const on = rank >= 0
          return (
            <button key={c.id} onClick={() => setPriority(c.id)} disabled={!!graded} data-triage={c.id}
              className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left transition
                ${on ? 'border-sky-400/45 bg-sky-400/[0.09]' : 'border-white/[0.07] bg-white/[0.02] hover:border-sky-400/30 hover:bg-white/[0.05]'}`}>
              <span className={`num grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[3px] border text-[11px] font-bold
                ${on ? 'border-sky-400 bg-sky-400 text-[#04121F]' : 'border-slate-600 text-slate-500'}`}>{on ? rank + 1 : '·'}</span>
              <span className="min-w-0 flex-1">
                <span className="font-thai block truncate text-[11.5px] text-white">{c.th}</span>
                <span className="font-thai block text-[9.5px]" style={{ color: c.exits === 1 ? '#FF6B8A' : '#64748b' }}>ทางออก {c.exits} เส้น · {fmt(c.households)} หลังคา (เสี่ยง {fmt(c.floodRoofs)})</span>
              </span>
              <span className="num shrink-0 text-[11px] font-semibold" style={{ color: sfviHex(c.score) }}>{c.score.toFixed(3)}</span>
            </button>
          )
        })}
      </div>
      {graded ? (
        <div className="rounded border px-2.5 py-2" style={{ borderColor: graded.hits === 4 ? '#22E36B55' : '#FFB30055', background: graded.hits === 4 ? '#22E36B0D' : '#FFB3000D' }}>
          <div className="flex items-center gap-2">
            {graded.hits === 4 ? <CheckCircle2 size={13} className="text-[#22E36B]" /> : <AlertTriangle size={13} className="text-[#FFB300]" />}
            <span className="font-thai text-[11px] font-semibold" style={{ color: graded.hits === 4 ? '#7CFFA0' : '#FFD066' }}>ตรงกฎ {graded.hits} / 4 ตำแหน่ง</span>
          </div>
          <div className="font-thai mt-1 text-[10px] text-slate-400">ลำดับตามกฎ: {correct.map((id) => COMMUNITIES.find((c) => c.id === id).th).join(' → ')}</div>
          {correct[0] === 'slj' && (
            <div className="font-thai mt-1 text-[10px] leading-snug text-slate-400">
              สายลมจอยกับเกาะทรายคะแนนเท่ากัน — tie-break ให้สายลมจอยก่อน เพราะเหลือทางออกเส้นเดียว
            </div>
          )}
        </div>
      ) : (
        <Btn variant="primary" size="lg" icon={Truck} className="w-full" disabled={chosen.length !== 4} onClick={eng.releaseConvoy}>
          <span className="font-thai normal-case tracking-normal text-[12px]">ปล่อยขบวนตามลำดับ ({chosen.length}/4)</span>
        </Btn>
      )}
    </div>
  )
}
