/* ══════════════════════════════════════════════════════════════════════════
   DECISION SCORE UI — คะแนนการตัดสินใจโดยรวม (score v2)
   ✅ ดี · ⚠️ พอใช้ · ❌ ผิด · ⏭️ ข้าม · ☠️ ผิดร้ายแรง → ระดับ ดีมาก/พอใช้/แย่/ไม่ผ่าน → ตัวคูณ
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, SkipForward, Skull, Scale, ChevronDown } from 'lucide-react'
import { DECISION } from '../config/missionConfig'

export const VERDICT = {
  good: { th: 'ดี', icon: CheckCircle2, hex: '#22E36B' },
  fair: { th: 'พอใช้', icon: AlertTriangle, hex: '#FFB300' },
  bad: { th: 'ผิด', icon: XCircle, hex: '#FF5C7A' },
  skip: { th: 'ข้าม', icon: SkipForward, hex: '#94A3B8' },
  critical: { th: 'ผิดร้ายแรง', icon: Skull, hex: '#FF2E63' },
}
export const TIER_HEX = { excellent: '#22E36B', fair: '#FFD066', poor: '#FF9D4D', fail: '#FF2E63' }

export function DecisionCounts({ counts, size = 'sm' }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {Object.entries(VERDICT).map(([k, v]) => (
        <span key={k} title={v.th} className={`num inline-flex items-center gap-0.5 rounded px-1 ${size === 'sm' ? 'text-[10.5px]' : 'text-[12px]'} font-bold`}
          style={{ color: counts[k] ? v.hex : '#475569', background: counts[k] ? `${v.hex}14` : 'transparent' }} data-count={k}>
          <v.icon size={size === 'sm' ? 10 : 12} />{counts[k] || 0}
        </span>
      ))}
    </span>
  )
}

/** First row of every score view: tier, ratio, multiplier and the five counts. */
export function DecisionHeadline({ decision, compact = false }) {
  const hex = TIER_HEX[decision.tier.id]
  return (
    <div className="relative overflow-hidden rounded-lg border px-2.5 py-2" style={{ borderColor: `${hex}66`, background: `linear-gradient(90deg, ${hex}1f, transparent)` }}
      data-decision-tier={decision.tier.id} data-decision-ratio={decision.ratio.toFixed(3)}>
      <div className="flex items-center gap-2">
        <Scale size={14} style={{ color: hex }} />
        <span className="font-thai text-[12px] font-bold text-white">คะแนนการตัดสินใจ</span>
        <span className="font-thai ml-auto rounded px-1.5 py-[1px] text-[11.5px] font-bold" style={{ color: '#05101e', background: hex }}>{decision.tier.th}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span className="num text-[18px] font-bold leading-none" style={{ color: hex }}>{Math.round(decision.ratio * 100)}%</span>
        <span className="font-thai text-[10.5px] text-slate-400">ตัดสินใจถูก · ตัวคูณ</span>
        <span className="num text-[13px] font-bold text-white">×{decision.mult.toFixed(2).replace(/0$/, '')}</span>
        {!compact && <span className="ml-auto"><DecisionCounts counts={decision.counts} /></span>}
      </div>
      {compact && <div className="mt-1"><DecisionCounts counts={decision.counts} /></div>}
      {decision.failed && (
        <div className="font-thai mt-1.5 flex items-center justify-center gap-1.5 rounded border-2 border-[#FF2E63] py-1 text-[13px] font-bold tracking-wide text-[#FF6B8A] [transform:rotate(-1.5deg)]" data-mission-failed>
          <Skull size={14} />ภารกิจล้มเหลว
        </div>
      )}
    </div>
  )
}

const ACT_TH = { 1: 'องก์ 1 · เฝ้าระวัง', 2: 'องก์ 2 · วิกฤต', 3: 'องก์ 3 · ฟื้นฟู' }

/** Every decision of the mission, grouped by act, with the Thai reason. */
export function DecisionList({ decision, acts = [1, 2, 3], limit = 8 }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-2" data-decision-list>
      {acts.map((a) => {
        const list = decision.items.filter((x) => x.act === a)
        if (!list.length) return null
        // the ones to talk about first: critical → wrong → skipped → fair → good
        const order = { critical: 0, bad: 1, skip: 2, fair: 3, good: 4 }
        const sorted = [...list].sort((x, y) => order[x.verdict] - order[y.verdict])
        const shown = open ? sorted : sorted.slice(0, limit)
        const c = { good: 0, fair: 0, bad: 0, skip: 0, critical: 0 }
        list.forEach((x) => c[x.verdict]++)
        return (
          <div key={a} className="overflow-hidden rounded-lg border border-white/[0.08]">
            <div className="flex items-center gap-2 bg-white/[0.04] px-2.5 py-1">
              <span className="font-thai text-[11.5px] font-bold text-slate-200">{ACT_TH[a]}</span>
              <span className="font-thai text-[10.5px] text-slate-500">{list.length} การตัดสินใจ</span>
              <span className="ml-auto"><DecisionCounts counts={c} /></span>
            </div>
            {shown.map((x) => {
              const v = VERDICT[x.verdict]
              return (
                <div key={x.id} className="flex items-start gap-2 border-t border-white/[0.04] px-2.5 py-[5px]" data-decision={x.id} data-verdict-kind={x.verdict}>
                  <v.icon size={13} className="mt-[2px] shrink-0" style={{ color: v.hex }} />
                  <span className="font-thai min-w-0 flex-1 text-[11.5px] leading-snug">
                    <span className="text-slate-100">{x.th}</span> <span className="text-slate-400">— {x.why}</span>
                  </span>
                  <span className="font-thai shrink-0 text-[10px] font-bold" style={{ color: v.hex }}>{v.th}</span>
                </div>
              )
            })}
          </div>
        )
      })}
      {decision.items.length > limit && (
        <button onClick={() => setOpen((o) => !o)} className="font-thai flex w-full items-center justify-center gap-1 rounded border border-white/10 py-1 text-[11px] text-slate-400 hover:text-white">
          {open ? 'ย่อ' : 'ดูทุกการตัดสินใจ'}<ChevronDown size={12} className={open ? 'rotate-180' : ''} />
        </button>
      )}
      <div className="font-thai text-[10px] leading-snug text-slate-500">
        สัดส่วนถูก = (ดี + พอใช้ × {DECISION.fairWeight}) ÷ ทั้งหมด · ข้าม = ผิด · {DECISION.tiers.map((t) => `${t.th} ≥ ${Math.round(t.minRatio * 100)}%${Number.isFinite(t.maxCritical) ? ` ร้ายแรง ≤ ${t.maxCritical}` : ''} ×${t.mult}`).join(' · ')}
      </div>
    </div>
  )
}
