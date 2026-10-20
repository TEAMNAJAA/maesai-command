/* ══════════════════════════════════════════════════════════════════════════
   COMMANDER FILE (A1–A4) — แฟ้มประวัติผู้บัญชาการ: ยศ · แต้มสะสม · เหรียญตรา · ประวัติรอบเล่น · สิ่งที่ปลดล็อก
   ══════════════════════════════════════════════════════════════════════════ */

import React from 'react'
import { HeartHandshake, Search, Brain, Timer, Zap, ScanSearch, ShieldCheck, Scale, Lock, Award, FolderOpen, Medal, ChevronRight } from 'lucide-react'
import { Modal } from '../ui/atoms'
import { CAREER, STRESS } from '../config/missionConfig'
import { MEDALS, useCareer, unlocked } from '../lib/career'
import { fmt, mmss } from '../lib/format'

const ICON = { HeartHandshake, Search, Brain, Timer, Zap, ScanSearch, ShieldCheck, Scale }
const RANK_HEX = ['#94A3B8', '#38BDF8', '#22E36B', '#FFD066']

/** Rank emblem: chevrons for each step up. */
export function RankBadge({ rank, size = 'md' }) {
  const hex = RANK_HEX[rank.index] || '#94A3B8'
  const big = size === 'lg'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 ${big ? 'py-1.5' : 'py-0.5'}`} style={{ borderColor: `${hex}88`, background: `${hex}14` }} data-rank={rank.id}>
      <span className="flex flex-col items-center leading-none" style={{ color: hex }}>
        {Array.from({ length: rank.index + 1 }, (_, i) => <ChevronRight key={i} size={big ? 14 : 10} className="-my-[3px] -rotate-90" strokeWidth={3} />)}
      </span>
      <span className={`font-thai font-bold ${big ? 'text-[16px]' : 'text-[12px]'}`} style={{ color: hex }}>{rank.th}</span>
    </span>
  )
}

export function MedalBadge({ id, earned = true, size = 46, fresh = false }) {
  const m = MEDALS.find((x) => x.id === id)
  if (!m) return null
  const Icon = ICON[m.icon] || Award
  return (
    <div className="flex w-[92px] flex-col items-center text-center" title={`${m.th} — ${m.desc}`} data-medal={id} data-earned={earned ? 1 : 0}>
      <div className={`relative grid place-items-center rounded-full border-2 ${fresh ? 'animate-[stampIn_.45s_cubic-bezier(.2,1.6,.4,1)_both]' : ''}`}
        style={{ width: size, height: size, borderColor: earned ? '#FFD066' : '#334155', background: earned ? 'radial-gradient(circle at 35% 30%, #FFE7A3, #C9921E 70%)' : '#0f172a', boxShadow: earned ? '0 0 16px -2px #FFD066' : 'none' }}>
        {earned ? <Icon size={size * 0.46} className="text-[#3b2a06]" /> : <Lock size={size * 0.36} className="text-slate-600" />}
      </div>
      <span className={`font-thai mt-1 text-[11px] font-semibold leading-tight ${earned ? 'text-[#FFE0A3]' : 'text-slate-500'}`}>{m.th}</span>
    </div>
  )
}

export function CareerFile({ open, onClose, player, unlockAll }) {
  const f = useCareer(player)
  if (!open) return null
  const r = f.rank
  const un = unlocked(r.index, unlockAll)
  const recent = [...f.runs].reverse().slice(0, 8)
  const pts = f.runs.slice(-12).map((x) => x.points || 0)
  const maxP = Math.max(1000, ...pts)
  return (
    <Modal open={open} onClose={onClose} width={900} tone="#FFD066" z={93}>
      <div className="p-6" data-career-file>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg border-2 border-[#FFD066] bg-[#FFD066]/10"><FolderOpen size={21} className="text-[#FFD066]" /></span>
          <div>
            <div className="hud-label text-[#FFD066]">COMMANDER FILE · แฟ้มประวัติผู้บัญชาการ</div>
            <h2 className="font-thai text-[21px] font-bold text-white">{f.name || 'ยังไม่ได้ใส่ชื่อ'}</h2>
          </div>
          <div className="ml-auto"><RankBadge rank={r} size="lg" /></div>
        </div>

        {!f.name ? (
          <div className="font-thai mt-4 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-[13.5px] text-slate-300">ใส่ชื่อผู้เล่นที่หน้าเปิดเกม แล้วกด "บันทึกคะแนน" ท้ายภารกิจ — แฟ้มนี้จะสะสมแต้ม ยศ และเหรียญของชื่อนั้น (เก็บในเครื่องนี้เท่านั้น)</div>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[['แต้มสะสม', fmt(f.total)], ['ภารกิจที่จบ', f.count], ['คะแนนสูงสุด', `${fmt(f.best)} / 1000`], ['เหรียญ', `${f.medals.length} / ${MEDALS.length}`]].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2"><div className="font-thai text-[11.5px] text-slate-400">{k}</div><div className="num text-[20px] font-bold text-white">{v}</div></div>
              ))}
            </div>
            <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5" data-rank-progress>
              <div className="font-thai flex justify-between text-[12px] text-slate-300">
                <span>ยศถัดไป: {r.next ? <b className="text-white">{r.next.th}</b> : 'ยศสูงสุดแล้ว'}</span>
                {r.next && <span className="num">อีก {fmt(r.toNext)} แต้ม</span>}
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-black/50"><div className="h-full rounded-full bg-gradient-to-r from-[#C9921E] to-[#FFD066] transition-[width] duration-700" style={{ width: `${Math.round(r.progress * 100)}%` }} /></div>
              <div className="mt-1.5 flex justify-between">{CAREER.ranks.map((x, i) => <span key={x.id} className={`font-thai text-[10.5px] ${i <= r.index ? 'text-[#FFE0A3]' : 'text-slate-500'}`}>{x.th} · {fmt(x.min)}</span>)}</div>
            </div>
          </>
        )}

        <div className="mt-4">
          <div className="font-thai mb-2 flex items-center gap-1.5 text-[13px] font-bold text-white"><Medal size={15} className="text-[#FFD066]" />เหรียญตรา — นิสัยของผู้บัญชาการที่ดี</div>
          <div className="flex flex-wrap justify-between gap-y-3">{MEDALS.map((m) => <MedalBadge key={m.id} id={m.id} earned={f.medals.includes(m.id)} />)}</div>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_260px] gap-4">
          <div>
            <div className="font-thai mb-1.5 text-[13px] font-bold text-white">ภารกิจล่าสุด</div>
            {recent.length === 0 ? <div className="font-thai text-[12.5px] text-slate-500">ยังไม่มีรอบที่บันทึก</div> : (
              <table className="w-full text-left text-[12px]" data-career-runs>
                <thead className="font-thai text-slate-500"><tr><th className="py-1">วันที่</th><th>แต้ม</th><th>เกรด</th><th>เวลา</th><th>โหมด</th></tr></thead>
                <tbody>{recent.map((x) => (
                  <tr key={x.at} className="border-t border-white/[0.06] text-slate-200">
                    <td className="num py-1">{new Date(x.at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</td>
                    <td className="num font-bold text-white">{fmt(x.points)}</td>
                    <td className="num text-[#FFE0A3]">{x.grades || '—'}</td>
                    <td className="num">{x.sec ? mmss(x.sec) : '—'}</td>
                    <td className="font-thai">{x.mode === 'expert' ? 'ผู้เชี่ยวชาญ' : 'ผู้เริ่มต้น'}{x.stress?.length ? ' · Stress' : ''}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
            {pts.length > 1 && (
              <svg viewBox="0 0 400 60" className="mt-2 h-14 w-full" data-career-trend>
                {(() => { const xy = (p, i) => [12 + (i * 376) / (pts.length - 1), 54 - (p / maxP) * 46]; return (
                  <>
                    <polyline points={pts.map((p, i) => xy(p, i).join(',')).join(' ')} fill="none" stroke="#FFD066" strokeWidth="2" strokeLinejoin="round" />
                    {pts.map((p, i) => { const [x, y] = xy(p, i); return <circle key={i} cx={x} cy={y} r="3" fill="#FFD066" /> })}
                  </>
                ) })()}
              </svg>
            )}
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3" data-unlocks>
            <div className="font-thai mb-1.5 text-[13px] font-bold text-white">ปลดล็อกตามยศ</div>
            {[['expert', 'โหมดผู้เชี่ยวชาญ', un.expert], ...Object.entries(un.stress).map(([k, v]) => [`stress:${k}`, `Stress: ${STRESS[k]?.th || k}`, v])].map(([k, th, ok]) => (
              <div key={k} className="font-thai flex items-center gap-2 py-1 text-[12.5px]">
                {ok ? <ShieldCheck size={14} className="text-[#22E36B]" /> : <Lock size={14} className="text-slate-500" />}
                <span className={ok ? 'text-slate-100' : 'text-slate-500'}>{th}</span>
                {!ok && <span className="ml-auto text-[11px] text-slate-500">{CAREER.ranks[CAREER.unlocks[k]]?.th}</span>}
              </div>
            ))}
            {unlockAll && <div className="font-thai mt-1 text-[11px] text-[#FFD066]">ครูปลดล็อกทั้งหมดไว้</div>}
          </div>
        </div>
        <div className="font-thai mt-3 text-[11px] text-slate-500">เก็บในเครื่องนี้เท่านั้น · ใช้ชื่อเล่นเดิมทุกครั้งเพื่อสะสมแต้ม · แต้มนับจากรอบที่กด "บันทึกคะแนน"</div>
      </div>
    </Modal>
  )
}
