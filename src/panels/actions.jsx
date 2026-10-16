/* ══════════════════════════════════════════════════════════════════════════
   RIGHT RAIL — ACTIONS · แผงสั่งการ
   องก์ 1: ① THEOS-2 (วางแผนรอบโคจร + แปลภาพ) ② ตลิ่ง/ลำน้ำ ③ อพยพรายโซน ④ ฐาน/ชั้นข้อมูล
   องก์ 2: ① ผู้ติดค้าง (วางแผนเรือ) ② THEOS-2 · โดรน ③ ภาคสนาม (ตัดไฟ · เสาสื่อสาร · สูบน้ำ)
   ทุกคำสั่งใช้เวลา (งานของทีม) และงบประมาณ — ไม่มีแต้ม AP
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo } from 'react'
import {
  ChevronRight, Satellite, ScanSearch, Ruler, ShieldCheck, Megaphone, Clock, Building2, Layers, Check, Cloud, Lock, Ship, Plane, Zap, RadioTower, Droplets, Users, HeartPulse, AlertTriangle, Loader2,
} from 'lucide-react'
import { Panel, Btn, Src, Divider } from '../ui/atoms'
import { Lbl, useMode } from '../ui/label'
import { QuestBox } from './quest'
import { THEOS2, COSTS, SFVI, EMBANKMENT, DURATIONS, ACT2 } from '../config/missionConfig'
import { CAMP_SITES, LAYERS, EQUIPMENT } from '../config/scenarioData'
import { SECTIONS, SECTION_BY_ID } from '../lib/sections'
import { EMBANKMENT_GAPS } from '../lib/embankment'
import { TOWN_TARGET } from '../lib/scenario'
import { peakDepth, arrivalAt, evacNeedMin, depthAt, HARM_M } from '../lib/sim'
import { fmt, clockLabel } from '../lib/format'
import { sfviHex, depthHex } from './datahub'

const hm = (min) => { const m = Math.max(0, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)}ชม. ${m % 60}น.` : `${m} นาที` }
const tgt = (t) => (t === TOWN_TARGET ? 'ตัวเมือง (AOI-A)' : `Sector ${t}`)

export function ActionRail({ eng, tab, setTab, onGo, onAnalyze, onChannel, onPlan, onWait, beaconTab, onCollapse }) {
  const { s } = eng
  const act1 = s.act === 1
  const tabs = act1
    ? [['theos', '①ภาพ', Satellite], ['bank', '②ตลิ่ง', Ruler], ['zones', '③อพยพ', Megaphone], ['base', '④ฐาน', Building2]]
    : [['ops', '①ผู้ติดค้าง', Users], ['sensors', '②ดาวเทียม', Satellite], ['field', '③ภาคสนาม', Zap]]
  const cur = tabs.some((t) => t[0] === tab) ? tab : tabs[0][0]
  return (
    <Panel className="flex min-h-0 flex-1 flex-col" data-rail="command">
      <div className="flex shrink-0 items-center justify-between px-3 pt-2.5">
        <div className="leading-none">
          <div className="font-thai text-[13px] font-semibold text-white">แผงสั่งการ</div>
          <div className="hud-label mt-1">COMMAND · ACT {['I', 'II', 'III'][s.act - 1]}</div>
        </div>
        <button onClick={onCollapse} title="พับแผง" className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-white/10 hover:text-white"><ChevronRight size={14} /></button>
      </div>
      <QuestBox eng={eng} onGo={onGo} />
      <div className="flex shrink-0 gap-[3px] border-b border-white/[0.07] px-2 pt-2">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} data-tab={id}
            className={`font-thai relative flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-t px-1 py-1.5 text-[10.5px] font-semibold transition
              ${cur === id ? 'text-white' : 'text-slate-500 hover:text-slate-300'} ${beaconTab === id && cur !== id ? 'text-[#FFE0A3] ring-1 ring-[#FFD066]/70 animate-[beacon_1.6s_ease-in-out_infinite]' : ''}`}
            style={cur === id ? { background: `${act1 ? '#38BDF8' : '#FF003C'}26`, boxShadow: `inset 0 -2px 0 ${act1 ? '#38BDF8' : '#FF003C'}` } : undefined}>
            <Icon size={11} />{label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {cur === 'theos' && <TheosPlanner eng={eng} onAnalyze={onAnalyze} />}
        {cur === 'bank' && <BankTab eng={eng} onChannel={onChannel} />}
        {cur === 'zones' && <ZoneOrders eng={eng} onWait={onWait} />}
        {cur === 'base' && <BaseTab eng={eng} />}
        {cur === 'ops' && <Incidents eng={eng} onPlan={onPlan} />}
        {cur === 'sensors' && <Sensors eng={eng} />}
        {cur === 'field' && <FieldOps eng={eng} />}
      </div>
    </Panel>
  )
}

/* ── ① THEOS-2 tasking per pass + image queue ─────────────────────────────── */

function TheosPlanner({ eng, onAnalyze }) {
  const { s, scn } = eng
  const upcoming = scn.passes.filter((p) => p.t > s.clock)
  return (
    <div className="space-y-2.5" data-panel="theos">
      <div className="font-thai rounded border border-sky-400/20 bg-sky-400/[0.05] px-2.5 py-1.5 text-[10.5px] leading-snug text-slate-300">
        THEOS-2 ผ่านพื้นที่เป็นรอบ ๆ (ดูเวลาในแท็บ <b>ดาวเทียม</b> ทางซ้าย) · เลือกได้รอบละ {THEOS2.targetsPerPass} เป้าหมาย · เมฆเกิน {THEOS2.cloudUsablePct}% = ภาพใช้ไม่ได้ · ภาพพร้อมหลังถ่าย {THEOS2.processingMin / 60} ชม.
      </div>
      {upcoming.length === 0 && <div className="font-thai text-[11px] text-slate-500">หมดรอบโคจรในองก์นี้แล้ว</div>}
      {upcoming.map((p, i) => {
        const chosen = s.taskings[p.id] || []
        const toggle = (t) => eng.setTasking(p.id, chosen.includes(t) ? chosen.filter((x) => x !== t) : [...chosen, t].slice(-THEOS2.targetsPerPass))
        return (
          <div key={p.id} className={`rounded border px-2.5 py-2 ${i === 0 ? 'border-sky-400/40 bg-sky-400/[0.06]' : 'border-white/[0.08] bg-white/[0.02]'}`} data-pass={p.id}>
            <div className="flex items-center gap-2">
              <Satellite size={13} className="text-sky-300" />
              <span className="num text-[12px] font-bold text-white">รอบ {p.id}</span>
              <span className="num text-[10.5px] text-slate-400">{clockLabel(p.t)}</span>
              <span className="font-thai ml-auto text-[10.5px] font-semibold" style={{ color: i === 0 ? '#FFD066' : '#94a3b8' }}>อีก {hm(p.t - s.clock)}</span>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              {p.reach.map((t) => {
                const on = chosen.includes(t), f = p.forecast[t]
                const hex = f > THEOS2.cloudUsablePct ? '#FF6B8A' : f > 40 ? '#FFD066' : '#7CFFA0'
                return (
                  <button key={t} onClick={() => toggle(t)} data-target={`${p.id}-${t}`}
                    className={`flex items-center gap-1.5 rounded border px-1.5 py-1 text-left transition ${on ? 'border-sky-400 bg-sky-400/20' : 'border-white/[0.1] bg-white/[0.02] hover:border-sky-400/40'}`}>
                    <span className={`grid h-[13px] w-[13px] shrink-0 place-items-center rounded-[3px] border ${on ? 'border-sky-300 bg-sky-400' : 'border-slate-500'}`}>{on && <Check size={9} strokeWidth={4} className="text-[#04121F]" />}</span>
                    <span className="font-thai min-w-0 flex-1 truncate text-[10.5px] text-slate-100">{t === TOWN_TARGET ? 'ตัวเมือง' : `Sector ${t}`}</span>
                    <Cloud size={10} style={{ color: hex }} /><span className="num text-[10px]" style={{ color: hex }}>{f}%</span>
                  </button>
                )
              })}
            </div>
            <div className="font-thai mt-1 text-[9.5px] text-slate-500">{chosen.length ? `สั่งถ่าย: ${chosen.map(tgt).join(', ')}` : 'ยังไม่ได้เลือกเป้าหมาย — ถ้าไม่เลือก รอบนี้จะเสียเปล่า'}</div>
          </div>
        )
      })}
      <Divider label="ภาพที่ได้ · IMAGE QUEUE" />
      {s.images.length === 0 && <div className="font-thai text-[11px] text-slate-500">ยังไม่มีภาพ — ภาพมาหลังรอบโคจรที่สั่งถ่ายไว้</div>}
      <div className="space-y-1">
        {[...s.images].reverse().map((img) => {
          const ready = img.readyAt <= s.clock
          const river = ['D', 'E', TOWN_TARGET].includes(img.target)
          return (
            <div key={img.id} className="flex items-center gap-2 rounded border border-white/[0.07] bg-white/[0.02] px-2 py-1.5" data-image={img.id}>
              <ScanSearch size={13} className={img.usable ? 'text-sky-300' : 'text-slate-600'} />
              <span className="min-w-0 flex-1">
                <span className="font-thai block truncate text-[11px] text-slate-100">{tgt(img.target)} <span className="num text-[9.5px] text-slate-500">{img.passId}</span></span>
                <span className="font-thai block text-[9.5px]" style={{ color: !img.usable ? '#FF6B8A' : img.analyzed ? '#7CFFA0' : ready ? '#FFD066' : '#94a3b8' }}>
                  {!img.usable ? `เมฆบัง ${img.cloud}% — ใช้ไม่ได้` : !ready ? `กำลังผลิต L3 Ortho · พร้อม ${clockLabel(img.readyAt)}` : img.analyzed ? `แปลแล้ว · ระบุดินถล่ม ${Object.values(img.labels).filter((v) => v === 'scar').length} จุด` : img.target === TOWN_TARGET ? 'พร้อม — ใช้วัดลำน้ำในแท็บ ②' : 'พร้อมวิเคราะห์'}
                  {river && img.usable && ready && img.target !== TOWN_TARGET ? ' · วัดลำน้ำได้' : ''}
                </span>
              </span>
              {img.usable && ready && img.target !== TOWN_TARGET && (
                <Btn size="sm" variant={img.analyzed ? 'solid' : 'primary'} icon={ScanSearch} onClick={() => onAnalyze(img.id)}>
                  <span className="font-thai normal-case tracking-normal">{img.analyzed ? 'ดูอีกครั้ง' : 'แปลภาพ'}</span>
                </Btn>
              )}
              <Src t={img.usable ? 'image' : 'scenario'} dot />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── ② Embankment crews + channel width (N) ─────────────────────────────── */

function BankTab({ eng, onChannel }) {
  const { s, scn } = eng
  const queued = s.jobs.filter((j) => j.kind === 'seal')
  const open = EMBANKMENT_GAPS.filter((g) => !s.sealed.includes(g.id) && !queued.some((j) => j.gap === g.id))
  const cost = open.reduce((a, g) => a + g.len * EMBANKMENT.bagsPerMetre * COSTS.bigbag, 0)
  const riverImg = s.images.find((i) => i.usable && i.readyAt <= s.clock && ['D', 'E', TOWN_TARGET].includes(i.target))
  return (
    <div className="space-y-2.5" data-panel="bank">
      <Divider label="ค่า N · ความกว้างลำน้ำ" />
      <div className="rounded border border-white/[0.08] bg-white/[0.025] px-2.5 py-2">
        <div className="flex items-center gap-2">
          <Ruler size={14} className="text-sky-300" />
          <span className="font-thai flex-1 text-[11.5px] text-slate-100">{s.channel.measured ? `วัดแล้ว: ${scn.channel.widthM} ม. → N = ${(1 - scn.channel.widthM / 150).toFixed(2)}` : 'ยังไม่ได้คำนวณ'}</span>
          <Src t="image" mini />
        </div>
        <div className="num mt-1.5 rounded bg-black/30 px-2 py-1 text-center text-[11px] text-sky-200">ความกว้าง = พิกเซล × {THEOS2.panM} ม. · N = 1 − ความกว้าง ÷ 150</div>
        {!s.channel.measured && (
          <Btn variant="primary" className="mt-2 w-full" icon={Ruler} disabled={!riverImg} onClick={onChannel}>
            <span className="font-thai normal-case tracking-normal">{riverImg ? `เปิดเครื่องมือวัด (ภาพ ${tgt(riverImg.target)})` : 'ต้องมีภาพ Sector D/E หรือตัวเมืองก่อน'}</span>
          </Btn>
        )}
        {s.channel.attempts > 0 && !s.channel.measured && <div className="font-thai mt-1 text-[10px] text-[#FF9DB2]">ส่งคำตอบแล้ว {s.channel.attempts} ครั้ง (ยิ่งผิดบ่อยคะแนน THEOS-2 ยิ่งลด)</div>}
      </div>

      <Divider label="จุดฟันหลอ · ทีมบิ๊กแบ็ก" />
      <div className="grid grid-cols-3 gap-1">
        {s.crews.map((c) => {
          const busy = c.busyUntil > s.clock
          return (
            <div key={c.id} className="rounded border px-1.5 py-1 text-center" style={{ borderColor: busy ? '#FFB30055' : '#22E36B55' }}>
              <div className="num text-[11px] font-bold text-white">ทีม {c.id}</div>
              <div className="font-thai text-[9.5px]" style={{ color: busy ? '#FFD066' : '#7CFFA0' }}>{busy ? `ว่าง ${clockLabel(c.busyUntil)}` : 'ว่าง'}</div>
            </div>
          )
        })}
      </div>
      <div className="rounded border border-white/[0.08] bg-white/[0.025] px-2.5 py-2">
        <div className="flex items-center justify-between font-thai text-[11px]">
          <span className="text-slate-200">อุดเสร็จ {s.sealed.length} · ในคิว {queued.length} · ยังเปิด {open.length}</span>
          <Src t="scenario" mini />
        </div>
        <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full rounded-full bg-[#22E36B]" style={{ width: `${(s.sealed.length / EMBANKMENT_GAPS.length) * 100}%` }} />
        </div>
        {open.length > 0 && (
          <Btn variant="go" className="mt-2 w-full" icon={ShieldCheck} onClick={() => eng.sealGaps(open.map((g) => g.id))}>
            <span className="font-thai normal-case tracking-normal">ส่งทีมอุดที่เหลือ {open.length} จุด · ฿{fmt(cost)}</span>
          </Btn>
        )}
        <div className="font-thai mt-1 text-[9.5px] leading-snug text-slate-500">ทีมใช้เวลา ~{DURATIONS.bigbagPerMetre} นาที/เมตร ทำตามคิว · จุดที่ยังเปิดทำให้น้ำเข้าโซนหลังตลิ่งเร็วและลึกขึ้น (ดูคอลัมน์ "ลึก" ในตารางโซน) · คลิกหมุดบนแผนที่แนวตลิ่งเพื่ออุดทีละจุด</div>
      </div>
    </div>
  )
}

/* ── ③ Evacuation orders per zone ─────────────────────────────────────────── */

function ZoneOrders({ eng, onWait }) {
  const { s, sfvi } = eng
  const [sel, setSel] = useState([])
  const score = Object.fromEntries(sfvi.perSection.map((z) => [z.id, z.score]))
  const pending = SECTIONS.filter((z) => s.orders[z.id] === undefined)
  const chosen = sel.filter((id) => s.orders[id] === undefined)
  const cost = chosen.reduce((a, id) => a + COSTS.evacBase + COSTS.evacPerHH * SECTION_BY_ID[id].floodHH, 0)
  const weak = sfvi.justified && (sfvi.veto1 || sfvi.world.level >= sfvi.prepLevel) ? [] : chosen.filter((id) => score[id] < SFVI.decisionBand)
  return (
    <div className="space-y-2" data-panel="zones-order">
      <div className="font-thai rounded border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5 text-[10.5px] leading-snug text-slate-300">
        สั่งอพยพ <b>แยกรายโซน</b> — ใช้งบ ฿{fmt(COSTS.evacBase)} + ฿{fmt(COSTS.evacPerHH)}/ครัวเรือน · โซนที่น้ำไม่ถึงคือเงินเสียเปล่า · โซนที่ SFVI &lt; {SFVI.decisionBand} และระดับน้ำยังต่ำ = เตือนผิด
      </div>
      <div className="space-y-1">
        {SECTIONS.map((z) => {
          const ordered = s.orders[z.id] !== undefined
          const on = chosen.includes(z.id)
          const peak = peakDepth(s, z), arr = arrivalAt(s, z), need = evacNeedMin(z)
          return (
            <button key={z.id} disabled={ordered} onClick={() => setSel((c) => (c.includes(z.id) ? c.filter((x) => x !== z.id) : [...c, z.id]))} data-pick={z.id}
              className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left transition ${ordered ? 'border-[#22E36B]/35 bg-[#22E36B]/[0.07]' : on ? 'border-[#FF6B8A]/60 bg-[#FF003C]/[0.09]' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]'}`}>
              <span className={`grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] border ${ordered ? 'border-[#22E36B] bg-[#22E36B]' : on ? 'border-[#FF6B8A] bg-[#FF6B8A]' : 'border-slate-500'}`}>{(ordered || on) && <Check size={10} strokeWidth={3.5} className="text-[#04121F]" />}</span>
              <span className="min-w-0 flex-1">
                <span className="font-thai block truncate text-[11px] text-white"><span className="num font-bold">{z.id}</span> {z.name}</span>
                <span className="font-thai block text-[9.5px] text-slate-500">
                  {ordered ? `สั่งแล้ว ${clockLabel(s.orders[z.id])}` : `${z.floodHH} ครัวเรือนเสี่ยง · ลึก ${peak.toFixed(1)} ม. · ${Number.isFinite(arr) && peak >= HARM_M ? `น้ำถึง ${clockLabel(arr)} · ใช้ ${(need / 60).toFixed(1)} ชม.` : 'น้ำแทบไม่ถึง'}`}
                </span>
              </span>
              <span className="num shrink-0 text-[11px] font-bold" style={{ color: sfviHex(score[z.id]) }}>{score[z.id].toFixed(2)}</span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between font-thai text-[9.5px] text-slate-500"><span>เวลา/ความลึก = แบบจำลอง DEM · บ้าน = GISTDA</span><span className="flex gap-1"><Src t="image" mini /><Src t="scenario" mini /></span></div>
      <Btn variant="danger" size="lg" className="w-full" icon={Megaphone} disabled={!chosen.length} onClick={() => { eng.orderZones(chosen); setSel([]) }}>
        <span className="font-thai normal-case tracking-normal text-[12px]">สั่งอพยพ {chosen.length} โซน · ฿{fmt(cost)}</span>
      </Btn>
      {chosen.length > 0 && (
        <div className="font-thai rounded border px-2 py-1 text-[10.5px]" style={{ borderColor: weak.length ? '#FF6B8A66' : '#22E36B55', color: weak.length ? '#FFB3C2' : '#BFF5CF' }}>
          {weak.length ? `เสี่ยงเตือนผิด: ${weak.join(', ')} ยังมี SFVI ต่ำกว่าเกณฑ์` : 'มีหลักฐานรองรับ'}
        </div>
      )}
      <Btn variant="solid" className="w-full" icon={Clock} disabled={!pending.length} onClick={onWait}>
        <span className="font-thai normal-case tracking-normal">ดูผลถ้ารอข้อมูลอีก 3 ชม. (ไม่เสียเวลา)</span>
      </Btn>
    </div>
  )
}

/* ── ④ Base camp + data layers ───────────────────────────────────────────── */

function BaseTab({ eng }) {
  const { s } = eng
  return (
    <div className="space-y-2.5" data-panel="base">
      <Divider label="ฐานบัญชาการ · FORWARD BASE" />
      <div className="font-thai text-[10.5px] leading-snug text-slate-400">เรือกู้ภัยออกจากฐานนี้ในองก์ 2 · ถ้าฐานอยู่ในโซนที่น้ำท่วม ต้องย้ายฐานและเสียเวลา 3 ชม. · ตั้งฐานใช้งบ ฿{fmt(COSTS.camp)}</div>
      {CAMP_SITES.map((c) => {
        const on = s.camp === c.id
        return (
          <button key={c.id} onClick={() => eng.setCamp(c.id)} data-camp={c.id}
            className={`w-full rounded border px-2.5 py-2 text-left transition ${on ? 'border-[#22E36B] bg-[#22E36B]/[0.1]' : 'border-white/[0.08] bg-white/[0.02] hover:border-sky-400/40'}`}>
            <div className="flex items-center gap-2">
              <Building2 size={13} className={on ? 'text-[#22E36B]' : 'text-slate-400'} />
              <span className="font-thai flex-1 text-[11.5px] font-semibold text-white">{c.th}</span>
              {on && <Check size={13} className="text-[#22E36B]" />}
            </div>
            <div className="font-thai mt-0.5 flex items-center justify-between text-[10px] text-slate-400"><span>{c.note}</span><Src t="measured" dot /></div>
          </button>
        )
      })}
      <Divider label="ชั้นข้อมูลบนแผนที่ · LAYERS" />
      <div className="space-y-1">
        {LAYERS.filter((l) => !l.actOnly || l.actOnly === s.act).map((l) => {
          const on = !!s.layers[l.id]
          return (
            <button key={l.id} onClick={() => eng.toggleLayer(l.id)} data-layer={l.id}
              className={`flex w-full items-center gap-2 rounded border px-2 py-[5px] text-left ${on ? 'border-sky-400/40 bg-sky-400/[0.09]' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]'}`}>
              <span className={`grid h-[14px] w-[14px] shrink-0 place-items-center rounded-[3px] border ${on ? 'border-sky-400 bg-sky-400' : 'border-slate-500/60'}`}>{on && <Check size={9} strokeWidth={3.5} className="text-[#04121F]" />}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-[11px] text-white">{l.name}</span><span className="font-thai block truncate text-[9.5px] text-slate-500">{l.sub}</span></span>
              <Src t={l.src} dot />
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ── Act 2 · ① incidents ─────────────────────────────────────────────────── */

function Incidents({ eng, onPlan }) {
  const { s, scn } = eng
  const t = s.clock
  const enRoute = (id) => s.jobs.filter((j) => j.kind === 'boatAtPoint' && j.point === id).length
  const known = s.points.filter((p) => p.revealed)
  const open = known.filter((p) => p.status === 'waiting').sort((a, b) => a.deadline - b.deadline)
  const closed = known.filter((p) => p.status !== 'waiting')
  const idle = s.boats.filter((b) => b.busyUntil <= t).length
  return (
    <div className="space-y-2" data-panel="ops">
      <div className="flex items-center gap-2 rounded border border-white/[0.08] bg-white/[0.025] px-2.5 py-1.5">
        <Ship size={14} className="text-sky-300" />
        <span className="font-thai flex-1 text-[11px] text-slate-200">เรือว่าง {idle}/{s.boats.length} · น้ำมัน {fmt(s.fuel.total - s.fuel.used)} L</span>
        <span className="font-thai text-[10px] text-slate-500">พบแล้ว {known.length} จุด</span>
      </div>
      {open.length === 0 && <div className="font-thai rounded border border-dashed border-white/10 px-2.5 py-3 text-center text-[11px] text-slate-500">ยังไม่มีจุดที่รอความช่วยเหลือ — สั่ง THEOS-2 ถ่ายรอบถัดไป / ส่งโดรนส่องจุดอับ / ตั้งเสาสื่อสารให้คนโทรแจ้งได้</div>}
      {open.map((p) => {
        const left = p.deadline - t
        const urgent = left < 180
        const comm = s.commDown.includes(p.section)
        const power = s.hazardsLive.includes(p.section) && !s.powerCut[p.section]
        return (
          <div key={p.id} className="rounded border px-2.5 py-2" data-point={p.id}
            style={{ borderColor: urgent ? '#FF003C88' : p.type === 'critical' ? '#FF7A1A55' : '#FFD06655', background: urgent ? '#FF003C12' : 'rgba(255,255,255,.02)' }}>
            <div className="flex items-center gap-2">
              <span className="num text-[12px] font-bold text-white">{p.id}</span>
              <span className="font-thai rounded px-1.5 text-[10px] font-bold" style={{ background: p.type === 'critical' ? '#FF7A1A33' : '#FFD06633', color: p.type === 'critical' ? '#FFB27A' : '#FFE0A3' }}>{p.type === 'critical' ? 'อยู่ไม่ได้ · ต้องอพยพ' : 'อยู่ได้ · ต้องการเสบียง'}</span>
              <span className="font-thai ml-auto text-[10.5px] font-bold" style={{ color: urgent ? '#FF6B8A' : '#cbd5e1' }}>เหลือ {hm(left)}</span>
            </div>
            <div className="font-thai mt-1 flex flex-wrap gap-x-2 text-[10px] text-slate-400">
              <span><Users size={10} className="mr-0.5 inline" />{p.left}/{p.people} คน</span>
              {p.injured > 0 && <span className="text-[#7dd3fc]"><HeartPulse size={10} className="mr-0.5 inline" />บาดเจ็บ {p.injured} → โรงพยาบาล</span>}
              {p.refuser && <span className="text-[#FFB3C2]">เคยไม่เชื่อคำเตือน</span>}
              <span>พบโดย {p.revealed === 'theos' ? 'THEOS-2' : p.revealed === 'drone' ? 'โดรน' : 'สายด่วน 1784'}</span>
              {enRoute(p.id) > 0 && <span className="text-[#7CFFA0]">เรือกำลังไป {enRoute(p.id)} ลำ</span>}
            </div>
            {(comm || power) && <div className="font-thai mt-1 text-[10px] text-[#FFD066]">{comm ? '⚠ สัญญาณล่ม — ต้องตั้งเสาสื่อสารก่อนสั่งทีม' : ''}{power ? ' ⚠ ไฟฟ้ารั่วในโซน — ตัดไฟก่อน' : ''}</div>}
            <Btn size="sm" variant={p.type === 'critical' ? 'danger' : 'warn'} className="mt-1.5 w-full" icon={Ship} disabled={!idle || comm} onClick={() => onPlan(p.id)}>
              <span className="font-thai normal-case tracking-normal text-[11px]">วางแผนเรือ · เลือกเส้นทาง</span>
            </Btn>
          </div>
        )
      })}
      {closed.length > 0 && (
        <>
          <Divider label={`จบแล้ว ${closed.length} จุด`} />
          <div className="flex flex-wrap gap-1">
            {closed.map((p) => (
              <span key={p.id} className="font-thai rounded border px-1.5 py-[1px] text-[10px]"
                style={{ borderColor: p.status === 'lost' ? '#FF003C66' : '#22E36B55', color: p.status === 'lost' ? '#FF9DB2' : '#BFF5CF' }}>
                {p.id} {p.status === 'lost' ? `สูญเสีย ${p.lost}` : p.status === 'supplied' ? 'ส่งเสบียงแล้ว' : `ช่วย ${p.rescued}`}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Act 2 · ② THEOS-2 passes, radar, drones ─────────────────────────────── */

function Sensors({ eng }) {
  const { s, scn } = eng
  const t = s.clock
  const [zone, setZone] = useState(scn.blindSpots[0])
  const freeDrone = s.drones.filter((d) => d.busyUntil <= t).length
  return (
    <div className="space-y-2.5" data-panel="sensors">
      <Divider label="THEOS-2 · ถ่ายผ่านช่องเมฆ" />
      {scn.act2Passes.map((q) => {
        const past = q.t <= t, ordered = s.act2Orders[q.id], shot = s.act2Shots.find((x) => x.id === q.id)
        return (
          <div key={q.id} className="flex items-center gap-2 rounded border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5" data-pass2={q.id}>
            <Satellite size={13} className={past ? 'text-slate-500' : 'text-sky-300'} />
            <span className="min-w-0 flex-1">
              <span className="num block text-[11.5px] font-bold text-white">รอบ {q.id} · {clockLabel(q.t)}</span>
              <span className="font-thai block text-[9.5px] text-slate-500">
                {shot ? `เห็นพื้นดิน ${shot.clear.length}/10 โซน: ${shot.clear.join(' ')}` : past ? 'ผ่านไปแล้ว (ไม่ได้สั่ง)' : ordered ? `สั่งแล้ว · อีก ${hm(q.t - t)}` : `อีก ${hm(q.t - t)} — เห็นเฉพาะโซนที่เมฆเปิดตอนนั้น`}
              </span>
            </span>
            {!past && !ordered && <Btn size="sm" variant="primary" icon={Satellite} onClick={() => eng.orderPass2(q.id)}><span className="font-thai normal-case tracking-normal">สั่งถ่าย</span></Btn>}
            {ordered && !past && <Check size={14} className="text-[#22E36B]" />}
          </div>
        )
      })}
      <div className="font-thai rounded border border-[#FF8A3D]/30 bg-[#FF8A3D]/[0.06] px-2.5 py-1.5 text-[10.5px] leading-snug text-[#FFC59A]">
        <b>เช็คน้ำ (RADARSAT-2)</b> อัปเดตความลึกทุก {ACT2.radarRevisitH} ชม. อัตโนมัติ — ทะลุเมฆได้แต่ความละเอียดไม่พอเห็นคน (ดูความลึกในตารางโซนทางซ้าย)
      </div>
      <Divider label="โดรน · ตัวช่วยส่องจุดอับ" />
      <div className="font-thai text-[10.5px] text-slate-400">ใช้กับโซนที่ดาวเทียมมองไม่เห็นคน (จุดอับ: {scn.blindSpots.join(', ')}) หรือเมฆบังนาน · ฿{fmt(COSTS.drone)}/เที่ยว · {DURATIONS.droneSortie} นาที</div>
      <div className="grid grid-cols-5 gap-1">
        {SECTIONS.map((z) => {
          const blind = scn.blindSpots.includes(z.id)
          return (
            <button key={z.id} onClick={() => setZone(z.id)} data-drone-zone={z.id}
              className={`num rounded border py-1 text-[10.5px] font-bold ${zone === z.id ? 'border-sky-400 bg-sky-400/20 text-white' : blind ? 'border-[#A78BFA]/60 text-[#C4B5FD]' : 'border-white/[0.1] text-slate-400'}`}>
              {z.id}
            </button>
          )
        })}
      </div>
      <Btn variant="primary" className="w-full" icon={Plane} disabled={!freeDrone} onClick={() => eng.droneSortie(zone)}>
        <span className="font-thai normal-case tracking-normal">ส่งโดรนสำรวจโซน {zone} ({freeDrone}/{s.drones.length} ว่าง)</span>
      </Btn>
    </div>
  )
}

/* ── Act 2 · ③ field: power, comms, pumps ────────────────────────────────── */

function FieldOps({ eng }) {
  const { s, mode } = eng
  const t = s.clock
  const busy = (kind, id) => s.jobs.some((j) => j.kind === kind && j.section === id)
  const [pz, setPz] = useState('Z4')
  return (
    <div className="space-y-2.5" data-panel="field">
      <Divider label="ไฟฟ้ารั่ว · ประสาน กฟภ." />
      {s.hazardsLive.length === 0 && <div className="font-thai text-[10.5px] text-slate-500">ยังไม่มีรายงานไฟฟ้ารั่ว</div>}
      {s.hazardsLive.map((id) => (
        <div key={id} className="flex items-center gap-2 rounded border border-[#FFD066]/40 bg-[#FFD066]/[0.06] px-2.5 py-1.5" data-power={id}>
          <Zap size={14} className="text-[#FFD066]" />
          <span className="font-thai flex-1 text-[11px] text-slate-100">โซน {id} · {SECTION_BY_ID[id].name}</span>
          {s.powerCut[id] ? <span className="font-thai text-[10.5px] text-[#7CFFA0]">ตัดไฟแล้ว</span>
            : busy('power', id) ? <span className="font-thai flex items-center gap-1 text-[10.5px] text-[#FFD066]"><Loader2 size={11} className="animate-spin" />กำลังตัด</span>
              : <Btn size="sm" variant="warn" icon={Zap} onClick={() => eng.cutPower(id)}><span className="font-thai normal-case tracking-normal">ตัดไฟ</span></Btn>}
        </div>
      ))}
      <Divider label="สัญญาณสื่อสาร · เสาเคลื่อนที่" />
      {!s.stormHit && <div className="font-thai text-[10.5px] text-slate-500">พายุยังไม่เข้า — เมื่อเข้า บางโซนจะสัญญาณล่ม สั่งทีม/รับแจ้งเหตุไม่ได้</div>}
      {s.stormHit && [...new Set([...s.commDown, ...Object.keys(s.towers)])].map((id) => (
        <div key={id} className="flex items-center gap-2 rounded border border-[#FF6B8A]/35 bg-[#FF003C]/[0.05] px-2.5 py-1.5" data-comm={id}>
          <RadioTower size={14} className={s.towers[id] ? 'text-[#22E36B]' : 'text-[#FF6B8A]'} />
          <span className="font-thai flex-1 text-[11px] text-slate-100">โซน {id} · {SECTION_BY_ID[id].name}</span>
          {s.towers[id] ? <span className="font-thai text-[10.5px] text-[#7CFFA0]">สัญญาณกลับมาแล้ว</span>
            : busy('tower', id) ? <span className="font-thai flex items-center gap-1 text-[10.5px] text-[#FFD066]"><Loader2 size={11} className="animate-spin" />กำลังตั้งเสา</span>
              : <Btn size="sm" variant="danger" icon={RadioTower} onClick={() => eng.buildTower(id)}><span className="font-thai normal-case tracking-normal">ตั้งเสา ฿{fmt(COSTS.tower / 1000)}k</span></Btn>}
        </div>
      ))}
      <Divider label={`เครื่องสูบน้ำ · เหลือ ${mode.pumps - Object.keys(s.pumps).length}/${mode.pumps}`} />
      <div className="font-thai text-[10.5px] leading-snug text-slate-400">ลดน้ำในโซนลง {ACT2.pumpReliefM} ม. หลังติดตั้ง {DURATIONS.pumpSetup / 60} ชม. — ใช้เปิดเส้นทางที่ผ่านโซนน้ำลึก (≥ {ACT2.deepWaterM} ม.) และยืดเวลาให้ผู้ติดค้าง · ฿{fmt(COSTS.pump)}</div>
      <div className="grid grid-cols-5 gap-1">
        {SECTIONS.map((z) => {
          const d = depthAt(s, z, t)
          return (
            <button key={z.id} onClick={() => setPz(z.id)} data-pump-zone={z.id}
              className={`rounded border py-1 text-center ${pz === z.id ? 'border-sky-400 bg-sky-400/20' : 'border-white/[0.1]'}`}>
              <div className="num text-[10.5px] font-bold text-white">{z.id}{s.pumps[z.id] && '·P'}</div>
              <div className="num text-[9px]" style={{ color: depthHex(d) }}>{d.toFixed(1)}ม.</div>
            </button>
          )
        })}
      </div>
      <Btn variant="primary" className="w-full" icon={Droplets} disabled={!!s.pumps[pz] || Object.keys(s.pumps).length >= mode.pumps} onClick={() => eng.deployPump(pz)}>
        <span className="font-thai normal-case tracking-normal">{s.pumps[pz] ? `โซน ${pz} มีเครื่องสูบแล้ว` : `ติดตั้งเครื่องสูบที่โซน ${pz}`}</span>
      </Btn>
    </div>
  )
}
