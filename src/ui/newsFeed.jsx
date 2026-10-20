/* ══════════════════════════════════════════════════════════════════════════
   NEWS FEED UI (D2) — การ์ดพาดหัวข่าว / โพสต์โซเชียลเลื่อนเข้ามุมแผนที่ + รายการย้อนหลัง
   ข่าวมาจาก fx 'news' (App คำนวณจาก newsFor) · ไม่บังปุ่ม: มุมล่างขวาของแผนที่ (มุมมองตลิ่งยกขึ้นเหนือแถบฟันหลอ)
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useState } from 'react'
import { Newspaper, MessageCircle, Heart, X, ChevronUp } from 'lucide-react'
import { fx } from '../lib/fx'
import { clockLabel } from '../lib/format'

const TONE = { good: '#22E36B', bad: '#FF6B8A', warn: '#FFB300', info: '#38BDF8' }
const history = []
const subs = new Set()
fx.on('news', (n) => { history.unshift(n); history.splice(40); subs.forEach((f) => f()) })
export const newsHistory = () => history

function Item({ n, compact }) {
  const hex = TONE[n.tone] || TONE.info
  return n.kind === 'social' ? (
    <div className="flex gap-2" data-news-item="social">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-500/20 text-sky-200"><MessageCircle size={14} /></span>
      <span className="min-w-0">
        <span className="font-thai block text-[10.5px] text-slate-400">ชาวแม่สาย · {clockLabel(n.at)}</span>
        <span className={`font-thai block leading-snug text-slate-100 ${compact ? 'text-[12px]' : 'text-[13px]'}`}>{n.th}</span>
        {n.likes > 0 && <span className="num mt-0.5 flex items-center gap-1 text-[10.5px] text-slate-400"><Heart size={10} style={{ color: hex }} />{n.likes.toLocaleString()}</span>}
      </span>
    </div>
  ) : (
    <div className="flex gap-2" data-news-item="news">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded" style={{ background: `${hex}22`, color: hex }}><Newspaper size={14} /></span>
      <span className="min-w-0">
        <span className="font-thai block text-[10.5px] font-bold" style={{ color: hex }}>ข่าวด่วน · {n.outlet}</span>
        <span className={`font-thai block font-semibold leading-snug text-white ${compact ? 'text-[12px]' : 'text-[13.5px]'}`}>{n.th}</span>
      </span>
    </div>
  )
}

export function NewsFeed({ view = 'urban' }) {
  const [cur, setCur] = useState(null)
  const [open, setOpen] = useState(false)
  const [, tick] = useState(0)
  useEffect(() => {
    const f = () => tick((x) => x + 1)
    subs.add(f)
    const off = fx.on('news', (n) => setCur(n))
    return () => { subs.delete(f); off() }
  }, [])
  useEffect(() => {
    if (!cur) return undefined
    const t = setTimeout(() => setCur(null), 6500)
    return () => clearTimeout(t)
  }, [cur])
  if (!history.length) return null
  return (
    // bottom-right, above the data-source strip; above the embankment bar in the corridor view
    <div className={`absolute right-3 z-20 flex w-[min(330px,46%)] flex-col items-end ${view === 'corridor' ? 'bottom-[104px]' : 'bottom-11'}`} data-news-feed>
      {open ? (
        <div className="max-h-[300px] overflow-y-auto rounded-lg border border-white/12 bg-[#060c18]/95 p-2.5 shadow-[0_12px_40px_-10px_rgba(0,0,0,.9)]" data-news-list>
          <div className="mb-1.5 flex items-center gap-2"><Newspaper size={13} className="text-sky-300" /><span className="font-thai text-[12px] font-bold text-white">ข่าวและโซเชียล</span>
            <button onClick={() => setOpen(false)} className="ml-auto text-slate-500 hover:text-white"><X size={13} /></button></div>
          <div className="space-y-2">{history.map((n) => <Item key={n.id} n={n} compact />)}</div>
        </div>
      ) : cur ? (
        <button onClick={() => setOpen(true)} key={cur.id} className="w-full rounded-lg border bg-[#060c18]/95 px-2.5 py-2 text-left shadow-[0_12px_40px_-10px_rgba(0,0,0,.9)] animate-[riseIn_.3s_ease-out]" style={{ borderColor: `${TONE[cur.tone] || TONE.info}66` }} data-news-card={cur.kind}>
          <Item n={cur} />
        </button>
      ) : (
        <button onClick={() => setOpen(true)} className="font-thai flex items-center gap-1.5 rounded-md border border-white/12 bg-[#060c18]/90 px-2 py-1 text-[11px] text-slate-300 hover:text-white" data-news-open>
          <Newspaper size={12} className="text-sky-300" />ข่าว {history.length}<ChevronUp size={11} />
        </button>
      )}
    </div>
  )
}
