/* ══════════════════════════════════════════════════════════════════════════
   LEFT RAIL — ASSESSMENT · การประเมินสถานการณ์
   Live SFVI scorecard · river gauge · trust gauge · (act 2) situation report
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState } from 'react'
import {
  Gauge, Waves, Activity, ClipboardList, Lock, Info, ArrowUp, ArrowDown, ChevronLeft, CloudRain, Cloud, Users,
} from 'lucide-react'
import { Section, Src, ArcGauge, Spark, Corners } from '../ui/atoms'
import { SFVI, THRESHOLDS, TRUST } from '../config/missionConfig'
import { TOTAL_SCARS } from '../config/scenarioData'
import { COMMUNITIES_LIVE, HAS_BUILDINGS, FLOOD_SOURCE, AOI_ROOFS } from '../lib/buildings'
import { levelSeries, levelAt, TOTAL_AT_RISK } from '../lib/sim'
import { fmt, clamp } from '../lib/format'

export function AssessmentRail({ eng, onCollapse }) {
  const [open, setOpen] = useState({ sfvi: true, gauge: true, trust: true, sitrep: true })
  const t = (k) => () => setOpen((o) => ({ ...o, [k]: !o[k] }))
  const { s } = eng
  return (
    <div className="flex min-h-0 flex-col gap-2.5 overflow-y-auto pr-0.5" data-rail="assessment">
      <div className="flex shrink-0 items-center justify-between px-1">
        <div className="leading-none">
          <div className="font-thai text-[13px] font-semibold text-white">การประเมินสถานการณ์</div>
          <div className="hud-label mt-1">ASSESSMENT</div>
        </div>
        <button onClick={onCollapse} title="พับแผง" className="grid h-6 w-6 place-items-center rounded text-slate-500 hover:bg-white/10 hover:text-white">
          <ChevronLeft size={14} />
        </button>
      </div>
      <Section title="LIVE SFVI" th="ดัชนีความเปราะบาง" icon={Gauge} open={open.sfvi} onToggle={t('sfvi')}
        right={<span className="num text-[11px] font-bold" style={{ color: sfviHex(eng.sfvi.basin) }}>{eng.sfvi.basin.toFixed(3)}</span>}>
        <SfviScorecard eng={eng} />
      </Section>
      <Section title="RIVER GAUGE" th="ระดับน้ำถ้ำผาจม" icon={Waves} open={open.gauge} onToggle={t('gauge')}
        right={<span className="num text-[11px] font-bold" style={{ color: levelHex(eng.world.level, eng.sfvi.prepLevel) }}>{eng.world.level.toFixed(2)} m</span>}>
        <RiverGauge eng={eng} />
      </Section>
      <Section title="TRUST INDEX" th="ความเชื่อมั่นประชาชน" icon={Activity} open={open.trust} onToggle={t('trust')}
        accent={trustHex(s.trust)} right={<span className="num text-[11px] font-bold" style={{ color: trustHex(s.trust) }}>{Math.round(s.trust)}%</span>}>
        <TrustGauge eng={eng} />
      </Section>
      {s.act === 2 && (
        <Section title="SITUATION REPORT" th="รายงานสถานการณ์" icon={ClipboardList} open={open.sitrep} onToggle={t('sitrep')}>
          <SituationReport eng={eng} />
        </Section>
      )}
    </div>
  )
}

export const sfviHex = (v) => (v >= 0.7 ? '#FF003C' : v >= SFVI.decisionBand ? '#FFB300' : v >= 0.5 ? '#FFD066' : '#22E36B')
export const levelHex = (lv, prep) => (lv >= THRESHOLDS.criticalLevel ? '#FF003C' : lv >= prep ? '#FFB300' : '#22E36B')
export const trustHex = (t) => (t >= 75 ? '#22E36B' : t >= 50 ? '#FFB300' : '#FF003C')

export function SfviScorecard({ eng }) {
  const { sfvi, s } = eng
  const w = SFVI.weights
  const rows = [
    { k: 'W', w: w.W, v: sfvi.W, src: 'measured', label: `ระดับน้ำ ÷ ${THRESHOLDS.criticalLevel.toFixed(2)} ม.`, th: 'สถานีบ้านถ้ำผาจม' },
    { k: 'R', w: w.R, v: sfvi.R, src: 'measured', label: 'ฝนสะสมต้นน้ำ', th: 'สถานีบ้านโจตาดา · เมียนมา' },
    { k: 'L', w: sfvi.Lw, v: sfvi.L, src: 'image', label: `ดินถล่มใหม่ ${sfvi.scarsSeen}/${TOTAL_SCARS} จุด`, th: 'จากภาพ THEOS-2', dim: sfvi.stale },
    { k: 'N', w: w.N, v: sfvi.N, src: 'image', label: `ลำน้ำเหลือ ${Math.round(s.channelWidth)} / ${THRESHOLDS.origChannelWidth} ม.`, th: s.channelMeasured ? 'วัดจากภาพแล้ว' : 'ยังไม่วัด (ค่าเดิม)' },
    HAS_BUILDINGS
      ? { k: 'P', w: w.P, v: sfvi.P, src: 'image', src2: FLOOD_SOURCE === 'radar' ? 'radar' : 'scenario',
        label: `หลังคาในเขตน้ำถึง ${COMMUNITIES_LIVE.reduce((a, c) => a + c.floodRoofs, 0)}/${COMMUNITIES_LIVE.reduce((a, c) => a + c.households, 0)}`,
        th: `อาคารจริง GISTDA · โซนน้ำถึง${FLOOD_SOURCE === 'radar' ? 'เรดาร์' : 'แบบจำลอง'}` }
      : { k: 'P', w: w.P, v: sfvi.P, src: 'scenario', label: 'ครัวเรือนในเขตน้ำถึง', th: 'เฉลี่ย 4 ชุมชน' },
  ]
  const hex = sfviHex(sfvi.basin)
  return (
    <div className="space-y-2 p-2.5" data-panel="sfvi">
      <div className="relative rounded border border-white/[0.08] bg-white/[0.025] p-2.5">
        <Corners />
        <div className="flex items-end gap-3">
          <span className="num text-[30px] font-bold leading-none" style={{ color: hex, textShadow: `0 0 18px ${hex}77` }}>{sfvi.basin.toFixed(3)}</span>
          <div className="flex-1 pb-1">
            <div className="relative h-[7px] w-full overflow-hidden rounded-full bg-white/[0.08]">
              <div className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${sfvi.basin * 100}%`, background: `linear-gradient(90deg,${hex}55,${hex})`, boxShadow: `0 0 10px ${hex}` }} />
              <div className="absolute top-0 h-full w-[2px] bg-white" style={{ left: `${SFVI.decisionBand * 100}%` }} />
            </div>
            <div className="font-thai mt-1 flex justify-between text-[9px] text-slate-500">
              <span>0</span><span>เกณฑ์ตัดสินใจ ≥ {SFVI.decisionBand.toFixed(2)}</span><span>1</span>
            </div>
          </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="font-thai text-[10.5px]" style={{ color: sfvi.justified ? '#7CFFA0' : '#FFB3C2' }}>
            {sfvi.veto1 ? 'Veto 1 — ต้องอพยพทันที' : sfvi.justified ? 'หลักฐานพอสั่งอพยพ' : 'หลักฐานยังไม่พอ'}
          </span>
          <span className="font-mono text-[9px] text-sky-300/60">0.30W+0.25R+0.20L+0.15N+0.10P</span>
        </div>
      </div>

      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.k} className={`rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 ${r.dim ? 'opacity-70' : ''}`}>
            <div className="flex items-center gap-1.5">
              <span className="num grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[3px] border border-sky-400/35 bg-sky-400/10 text-[10px] font-bold text-sky-200">{r.k}</span>
              <span className="num shrink-0 text-[9px] text-slate-500">×{r.w.toFixed(2)}</span>
              <span className="font-thai min-w-0 flex-1 truncate text-[10.5px] text-slate-300">{r.label}</span>
              <Src t={r.src} mini />
              {r.src2 && <Src t={r.src2} mini />}
              <span className="num w-[32px] shrink-0 text-right text-[11px] font-semibold text-white">{r.v.toFixed(2)}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-sky-400 transition-[width] duration-500" style={{ width: `${r.v * 100}%`, boxShadow: '0 0 6px #38BDF8' }} />
              </div>
              <span className="font-thai shrink-0 text-[9px] text-slate-500">{r.th}</span>
            </div>
            {r.dim && (
              <div className="mt-1 flex items-center gap-1.5 rounded border border-[#A78BFA]/25 bg-[#A78BFA]/[0.07] px-1.5 py-1">
                <Lock size={9} className="shrink-0 text-[#A78BFA]" />
                <span className="font-thai text-[9.5px] leading-tight text-[#C4B5FD]">
                  Cloud Rule — เมฆ {Math.round(sfvi.world.cloud)}% / ภาพเก่า {Math.round(sfvi.imageAgeH)} ชม. · น้ำหนัก L เหลือ {sfvi.Lw.toFixed(2)} · ความเชื่อมั่นต่ำ
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
        <span className="font-thai text-[10.5px] text-slate-400">ความเชื่อมั่นของหลักฐาน</span>
        <div className="flex items-center gap-2">
          <div className="h-[4px] w-16 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="h-full rounded-full" style={{ width: `${sfvi.confidence * 100}%`, background: sfvi.stale ? '#A78BFA' : '#22E36B' }} />
          </div>
          <span className="num text-[11px] font-semibold" style={{ color: sfvi.stale ? '#C4B5FD' : '#7CFFA0' }}>{Math.round(sfvi.confidence * 100)}%</span>
        </div>
      </div>

      <div className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
        <div className="font-thai mb-1 text-[10px] text-slate-400">SFVI รายชุมชน (เรียงตามกฎ + tie-break)</div>
        {sfvi.ranked.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1.5 py-[2px]">
            <span className="num w-3 text-[9.5px] text-slate-500">{i + 1}</span>
            <span className="font-thai min-w-0 flex-1 truncate text-[10.5px] text-slate-200">{c.th}</span>
            <span className="num text-[9px]" style={{ color: c.exits === 1 ? '#FF6B8A' : '#64748b' }}>{c.exits} ทาง</span>
            <span className="num w-[38px] text-right text-[10.5px] font-semibold" style={{ color: sfviHex(c.score) }}>{c.score.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function RiverGauge({ eng }) {
  const { world, sfvi, s } = eng
  const lv = world.level
  const max = 6
  const series = levelSeries(s.clock, 12, 30)
  const prev = levelAt(s.clock - 60)
  const rising = lv - prev
  const hex = levelHex(lv, sfvi.prepLevel)
  const pos = (v) => `${clamp(v / max) * 100}%`
  return (
    <div className="space-y-2 p-2.5" data-panel="gauge">
      <div className="flex gap-3">
        {/* vertical staff gauge */}
        <div className="relative h-[132px] w-9 shrink-0 overflow-hidden rounded border border-white/10 bg-[#050b16]">
          <div className="absolute inset-x-0 bottom-0 transition-[height] duration-700"
            style={{ height: pos(lv), background: `linear-gradient(0deg, ${hex}cc, ${hex}33)`, boxShadow: `0 0 12px ${hex}` }} />
          {[[THRESHOLDS.criticalLevel, '#FF003C'], [sfvi.prepLevel, '#FFB300']].map(([v, c]) => (
            <div key={c} className="absolute inset-x-0 h-[2px]" style={{ bottom: pos(v), background: c, boxShadow: `0 0 6px ${c}` }} />
          ))}
          {[1, 2, 3, 4, 5].map((m) => (
            <div key={m} className="absolute left-0 w-2 border-t border-white/25" style={{ bottom: pos(m) }} />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="num text-[26px] font-bold leading-none" style={{ color: hex }}>{lv.toFixed(2)}</span>
            <span className="text-[11px] text-slate-400">ม.</span>
            {Math.abs(rising) > 0.005 && (rising > 0
              ? <ArrowUp size={14} className="text-[#FF003C]" /> : <ArrowDown size={14} className="text-[#22E36B]" />)}
            <span className="ml-auto"><Src t="measured" mini /></span>
          </div>
          <div className="font-thai text-[10px] text-slate-500">สถานีบ้านถ้ำผาจม (STN0029) · {rising >= 0 ? '+' : ''}{(rising * 100).toFixed(1)} ซม./ชม.</div>
          <div className="mt-1.5 space-y-0.5 font-thai text-[10px]">
            <div className="flex justify-between"><span className="text-[#FF6B8A]">วิกฤต (Veto 1)</span><span className="num text-[#FF6B8A]">{THRESHOLDS.criticalLevel.toFixed(2)} ม.</span></div>
            <div className="flex justify-between"><span className="text-[#FFD066]">เตรียมพร้อม{sfvi.narrow ? ' (ลดเกณฑ์)' : ''}</span><span className="num text-[#FFD066]">{sfvi.prepLevel.toFixed(2)} ม.</span></div>
          </div>
          <Spark data={series} color={hex} h={36} />
          <div className="font-thai flex justify-between text-[9px] text-slate-600"><span>12 ชม. ก่อน</span><span>ตอนนี้</span></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
          <div className="flex items-center justify-between"><CloudRain size={11} className="text-sky-300" /><Src t="measured" mini /></div>
          <div className="num mt-1 text-[14px] font-bold text-white">{fmt(world.rain)} <span className="text-[10px] font-normal text-slate-400">มม.</span></div>
          <div className="font-thai text-[9px] text-slate-500">ฝนสะสม บ้านโจตาดา</div>
        </div>
        <div className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5">
          <div className="flex items-center justify-between"><Cloud size={11} className="text-slate-300" /><Src t="scenario" mini /></div>
          <div className="num mt-1 text-[14px] font-bold" style={{ color: world.cloud > 60 ? '#C4B5FD' : '#fff' }}>{Math.round(world.cloud)}%</div>
          <div className="font-thai text-[9px] text-slate-500">เมฆเหนือลุ่มน้ำ</div>
        </div>
      </div>
    </div>
  )
}

export function TrustGauge({ eng }) {
  const { s } = eng
  const t = s.trust
  const hex = trustHex(t)
  const band = t >= 90 ? 'VERY HIGH' : t >= 75 ? 'HIGH' : t >= 50 ? 'MODERATE' : t >= 30 ? 'LOW' : 'COLLAPSED'
  const prev = s.trustHist[s.trustHist.length - 2] ?? t
  const delta = t - prev
  return (
    <div className="px-2.5 pb-2.5 pt-2" data-panel="trust">
      <ArcGauge value={t} color={hex} label={band} size={132}
        delta={`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`} deltaDir={delta >= 0 ? 'up' : 'down'} />
      <Spark data={s.trustHist} color={hex} h={34} dots={s.trustHist.length < 14} />
      <div className="mt-1.5 grid grid-cols-3 gap-1 text-center">
        {[['เตือนผิด', s.falseAlarms], ['รอภาพ', s.holdCount], ['โทษครั้งถัดไป', `−${TRUST.falseAlarmPenalties[Math.min(s.falseAlarms, 2)]}%`]].map(([k, v]) => (
          <div key={k} className="rounded border border-white/[0.06] bg-white/[0.02] py-1">
            <div className="num text-[11.5px] font-bold text-white">{v}</div>
            <div className="font-thai text-[9px] text-slate-500">{k}</div>
          </div>
        ))}
      </div>
      <div className="font-thai mt-1.5 flex items-start gap-1.5 text-[9.5px] leading-snug text-slate-500">
        <Info size={10} className="mt-[2px] shrink-0" />
        เตือนผิดทบ −5/−15/−40 · เตือนช้า −30 ครั้งเดียวแต่มีผู้ได้รับผลกระทบจริง
      </div>
    </div>
  )
}

export function SituationReport({ eng }) {
  const { exposure } = eng
  const rows = [
    { label: 'พื้นที่น้ำท่วม (เรดาร์ 12 ก.ย. 67)', value: '25,204 ไร่', src: 'radar' },
    { label: 'หลังคาเรือนในเขตน้ำถึง (4 ชุมชน)', value: fmt(TOTAL_AT_RISK), src: HAS_BUILDINGS ? 'image' : 'scenario' },
    ...(HAS_BUILDINGS ? [{ label: 'อาคารจริงใน AOI-A (GISTDA)', value: fmt(AOI_ROOFS), src: 'image' }] : []),
    { label: 'อพยพทันก่อนน้ำมา', value: fmt(exposure.safe), src: 'scenario' },
    { label: 'ยังเสี่ยง/ติดน้ำ', value: fmt(exposure.exposed), src: 'scenario', bad: true },
    { label: 'ดินถล่มที่ตรวจพบ', value: `${eng.sfvi.scarsSeen} จุด`, src: 'image' },
  ]
  return (
    <div className="px-2.5 py-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 border-b border-white/[0.04] py-[5px] last:border-0">
          <Users size={10} className="shrink-0 text-sky-300/60" />
          <span className="font-thai min-w-0 flex-1 truncate text-[10.5px] text-slate-300">{r.label}</span>
          <Src t={r.src} mini />
          <span className="num shrink-0 text-[11px] font-semibold" style={{ color: r.bad ? '#FF6B8A' : '#fff' }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}
