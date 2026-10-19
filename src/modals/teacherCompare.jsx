/* ══════════════════════════════════════════════════════════════════════════
   TEACHER · ROUND COMPARISON — เทียบรอบ 1 → รอบ 2 (สถานการณ์ใหม่)
   หลักฐานว่าเกิดการเรียนรู้: ผู้เล่นคนเดิมเล่นสถานการณ์ใหม่แล้วตัดสินใจดีขึ้นไหม
   (คะแนน · เตือนผิด · ช่วยคน · เส้นทาง · เยียวยา · ใช้ข้อมูล · คำใบ้ · เวลา) + Paired t-test
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useMemo } from 'react'
import { TrendingUp, TrendingDown, Minus, Users, FlaskConical, Download, AlertTriangle, Sigma, Repeat } from 'lucide-react'
import { Btn } from '../ui/atoms'
import { roundPairs, compareSummary, pairsCSV, METRICS } from '../lib/compare'
import { logger, downloadText } from '../lib/evalLogger'
import { mmss } from '../lib/format'

export const fmtVal = (k, v) => (v === null || v === undefined ? '—' : k === 'realSec' ? mmss(v) : ['score', 'savedPct', 'reliefPct'].includes(k) ? `${Math.round(v)}%` : Number.isInteger(v) ? `${v}` : v.toFixed(1))
const fmtDelta = (k, d) => (d === null || d === undefined ? '—' : `${d > 0 ? '+' : d < 0 ? '−' : '±'}${k === 'realSec' ? mmss(Math.abs(d)) : ['score', 'savedPct', 'reliefPct'].includes(k) ? `${Math.abs(Math.round(d))}%` : Math.abs(d) % 1 ? Math.abs(d).toFixed(1) : Math.abs(d)}`)
const GOOD = '#22E36B', BAD = '#FF5C7A', FLAT = '#94A3B8'

export function DeltaChip({ k, d, better }) {
  const tone = d === null || d === 0 ? FLAT : Math.sign(d) === better ? GOOD : BAD
  const Icon = d === null || d === 0 ? Minus : d > 0 ? TrendingUp : TrendingDown
  return (
    <span className="num inline-flex items-center gap-1 rounded px-1.5 py-[1px] text-[11px] font-bold" style={{ color: tone, background: `${tone}1a` }}>
      <Icon size={11} />{fmtDelta(k, d)}
    </span>
  )
}

/** Slope chart: one line per player from round 1 to round 2. */
function Slopes({ pairs, mean }) {
  const W = 430, H = 230, x1 = 70, x2 = 330, top = 18, bot = 200
  const y = (v) => bot - (Math.max(0, Math.min(100, v)) / 100) * (bot - top)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" data-compare-slopes>
      {[0, 25, 50, 75, 100].map((v) => (
        <g key={v}>
          <line x1={x1 - 8} y1={y(v)} x2={x2 + 8} y2={y(v)} stroke="rgba(148,163,184,.12)" />
          <text x={x1 - 14} y={y(v) + 3} textAnchor="end" fontSize="9" fill="#64809f" className="num">{v}</text>
        </g>
      ))}
      <text x={x1} y={H - 6} textAnchor="middle" fontSize="11" fill="#cbd5e1" className="font-thai">รอบ 1</text>
      <text x={x2} y={H - 6} textAnchor="middle" fontSize="11" fill="#cbd5e1" className="font-thai">รอบ 2 (สถานการณ์ใหม่)</text>
      {pairs.map((p) => {
        const d = p.delta.score ?? 0
        const hex = d > 0 ? GOOD : d < 0 ? BAD : FLAT
        return (
          <g key={p.player} opacity="0.85">
            <line x1={x1} y1={y(p.m1.score)} x2={x2} y2={y(p.m2.score)} stroke={hex} strokeWidth="1.6" />
            <circle cx={x1} cy={y(p.m1.score)} r="3.2" fill={hex} />
            <circle cx={x2} cy={y(p.m2.score)} r="3.2" fill={hex} />
            {pairs.length <= 12 && <text x={x2 + 9} y={y(p.m2.score) + 3} fontSize="9.5" fill="#cbd5e1" className="font-thai">{p.player}</text>}
          </g>
        )
      })}
      {mean && (
        <g>
          <line x1={x1} y1={y(mean[0])} x2={x2} y2={y(mean[1])} stroke="#C4B5FD" strokeWidth="3.2" strokeDasharray="7 4" />
          <text x={(x1 + x2) / 2} y={(y(mean[0]) + y(mean[1])) / 2 - 7} textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#C4B5FD" className="font-thai">ค่าเฉลี่ย</text>
        </g>
      )}
    </svg>
  )
}

export function RoundCompare({ version }) {
  const pairs = useMemo(() => roundPairs(logger.sessions()), [version])
  const sum = useMemo(() => compareSummary(pairs), [pairs])
  const stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, '')
  if (!pairs.length) {
    return (
      <div className="mt-4 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-5" data-compare-empty>
        <div className="font-thai flex items-center gap-2 text-[15px] font-bold text-white"><Repeat size={17} className="text-[#C4B5FD]" />ยังไม่มีผู้เล่นที่เล่นครบ 2 รอบ</div>
        <ol className="font-thai mt-2 space-y-1 text-[12.5px] leading-snug text-slate-300">
          <li>1. ให้ผู้เล่นใส่ <b>ชื่อเดิมทุกรอบ</b> ที่หน้าเปิดเกม และเล่นจนกด "บันทึกลง Leaderboard"</li>
          <li>2. เริ่มเกมใหม่ (ปุ่ม ↻) — ระบบสุ่มสถานการณ์ใหม่ให้ (เมฆ ลำน้ำ ผู้ติดค้าง ต่างจากเดิม) จึงจำคำตอบไม่ได้</li>
          <li>3. กลับมาที่หน้านี้ จะเห็นรอบ 1 เทียบรอบ 2 ของแต่ละคน พร้อม Paired t-test สำหรับรายงาน</li>
        </ol>
        <div className="font-thai mt-2 text-[11.5px] text-slate-500">รอบสาธิต (?demo) ไม่ถูกนับ · ข้อมูลเก็บในเครื่องนี้เท่านั้น</div>
      </div>
    )
  }
  const t = sum.test
  const sig = t.p !== null && t.p < 0.05
  const scoreRow = sum.rows.find((r) => r.k === 'score'), timeRow = sum.rows.find((r) => r.k === 'realSec'), hintRow = sum.rows.find((r) => r.k === 'hints')
  const card = (Icon, label, main, sub, hex = '#fff') => (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <div className="font-thai flex items-center gap-1.5 text-[11.5px] text-slate-400"><Icon size={12} />{label}</div>
      <div className="num mt-1 text-[20px] font-bold leading-tight" style={{ color: hex }}>{main}</div>
      <div className="font-thai mt-0.5 text-[11px] text-slate-500">{sub}</div>
    </div>
  )
  return (
    <div className="mt-4 space-y-3" data-compare>
      <div className="grid grid-cols-4 gap-2.5">
        {card(Users, 'ผู้เล่นที่เล่นครบ 2 รอบ', `${sum.n} คน`, `ดีขึ้น ${sum.improved}/${sum.n} คน (${Math.round((sum.improved / sum.n) * 100)}%)`, '#C4B5FD')}
        {card(TrendingUp, 'คะแนนเฉลี่ย รอบ 1 → 2', `${fmtVal('score', scoreRow.r1)} → ${fmtVal('score', scoreRow.r2)}`, `เปลี่ยน ${fmtDelta('score', scoreRow.r2 - scoreRow.r1)}`, scoreRow.improved ? GOOD : scoreRow.improved === false ? BAD : '#fff')}
        {card(Sigma, 'Paired t-test (คะแนน)', t.t === null ? '—' : `t(${t.df}) = ${Number.isFinite(t.t) ? t.t.toFixed(2) : '∞'}`, t.p === null ? 'ต้องมีอย่างน้อย 2 คน' : `p = ${t.p < 0.001 ? '< .001' : t.p.toFixed(3)} · ${sig ? 'มีนัยสำคัญที่ .05' : 'ยังไม่มีนัยสำคัญ'}`, sig ? GOOD : '#FFD066')}
        {card(Repeat, 'เวลาเล่น · คำใบ้ (เฉลี่ย)', `${fmtVal('realSec', timeRow.r1)} → ${fmtVal('realSec', timeRow.r2)}`, `คำใบ้ขั้น 2–3: ${fmtVal('hints', hintRow.r1)} → ${fmtVal('hints', hintRow.r2)} ครั้ง`)}
      </div>

      <div className="grid grid-cols-[430px_1fr] gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
          <div className="font-thai px-1 text-[12px] font-bold text-white">คะแนนรายคน: รอบ 1 → รอบ 2</div>
          <Slopes pairs={pairs} mean={scoreRow.r1 !== null ? [scoreRow.r1, scoreRow.r2] : null} />
        </div>
        <div className="overflow-hidden rounded-xl border border-white/10" data-compare-metrics>
          <div className="font-thai grid grid-cols-[1fr_70px_70px_88px] gap-2 bg-white/[0.06] px-3 py-1.5 text-[11.5px] font-bold text-slate-300">
            <span>ตัวชี้วัด (ค่าเฉลี่ย)</span><span className="text-right">รอบ 1</span><span className="text-right">รอบ 2</span><span className="text-right">เปลี่ยน</span>
          </div>
          {sum.rows.map((r) => (
            <div key={r.k} className="font-thai grid grid-cols-[1fr_70px_70px_88px] items-center gap-2 border-t border-white/[0.05] px-3 py-[5px] text-[12px]">
              <span className="text-slate-200">{r.th}<span className="ml-1 text-[10px] text-slate-500">{r.better > 0 ? 'ยิ่งมากยิ่งดี' : 'ยิ่งน้อยยิ่งดี'}</span></span>
              <span className="num text-right text-slate-400">{fmtVal(r.k, r.r1)}</span>
              <span className="num text-right text-white">{fmtVal(r.k, r.r2)}</span>
              <span className="text-right">{r.r1 === null || r.r2 === null ? '—' : <DeltaChip k={r.k} d={r.r2 - r.r1} better={r.better} />}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/10" data-compare-players>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-white/[0.04]">
              {['ผู้เล่น', 'รอบ', 'สถานการณ์ (seed)', 'คะแนน', 'เตือนผิด', 'ช่วยคนได้', 'โอกาสที่พลาด', 'คำใบ้', 'เวลา', 'หมายเหตุ'].map((h) => (
                <th key={h} className="font-thai px-2 py-1.5 text-left text-[11px] font-semibold text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pairs.map((p) => (
              <tr key={p.player} className="border-t border-white/[0.05]">
                <td className="font-thai px-2 py-1.5 text-[12px] font-semibold text-white">{p.player}</td>
                <td className="num px-2 py-1.5 text-[11.5px] text-slate-400">{p.rounds}</td>
                <td className="num px-2 py-1.5 text-[11px] text-slate-400">{p.m1.seed ?? '—'} → {p.m2.seed ?? '—'}</td>
                <td className="px-2 py-1.5"><span className="num text-[11.5px] text-slate-300">{p.m1.score}% → {p.m2.score}%</span> <DeltaChip k="score" d={p.delta.score} better={1} /></td>
                <td className="px-2 py-1.5"><DeltaChip k="falseAlarms" d={p.delta.falseAlarms} better={-1} /></td>
                <td className="px-2 py-1.5"><DeltaChip k="savedPct" d={p.delta.savedPct} better={1} /></td>
                <td className="px-2 py-1.5"><DeltaChip k="missed" d={p.delta.missed} better={-1} /></td>
                <td className="px-2 py-1.5"><DeltaChip k="hints" d={p.delta.hints} better={-1} /></td>
                <td className="px-2 py-1.5"><DeltaChip k="realSec" d={p.delta.realSec} better={-1} /></td>
                <td className="font-thai px-2 py-1.5 text-[10.5px]">
                  {p.sameSeed && <span className="mr-1 inline-flex items-center gap-0.5 rounded bg-[#FFB300]/15 px-1 text-[#FFD066]" title="สถานการณ์เดิม — อาจจำคำตอบได้"><AlertTriangle size={10} />seed เดิม</span>}
                  {(p.m2.stress?.length > 0 || p.m1.stress?.length > 0) && <span className="inline-flex items-center gap-0.5 rounded bg-[#FF8A3D]/15 px-1 text-[#FFB27A]"><FlaskConical size={10} />Stress</span>}
                  {p.trend.length > 2 && <span className="num ml-1 text-slate-500">({p.trend.join('→')})</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Btn variant="primary" icon={Download} onClick={() => downloadText(pairsCSV(pairs), `maesai-round1-vs-round2-${stamp}.csv`)} data-compare-export>
          <span className="font-thai normal-case tracking-normal text-[12.5px]">Export CSV · รอบ 1 เทียบรอบ 2</span>
        </Btn>
        <span className="font-thai text-[11.5px] leading-snug text-slate-500">
          จับคู่ด้วยชื่อผู้เล่น · รอบ 1 = รอบแรกที่เล่นจบ · รอบ 2 = รอบถัดไป{sum.sameSeed ? ` · ${sum.sameSeed} คู่ใช้ seed เดิม (ควรแยกวิเคราะห์)` : ''} · {METRICS.length} ตัวชี้วัด
        </span>
      </div>
    </div>
  )
}
