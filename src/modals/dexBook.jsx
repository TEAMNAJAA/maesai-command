/* ══════════════════════════════════════════════════════════════════════════
   KNOWLEDGE BOOK (D1) — สมุดสะสมการ์ดความรู้ (แบบ Pokédex) + ป้ายแจ้งเมื่อปลดล็อกการ์ดใหม่
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useState } from 'react'
import { Satellite, Image as ImageIcon, Mountain, Cloud, History, Ruler, Gauge, Package, Radar, Plane, Zap, Waves, Route, Scale, BookOpen, Lock, BookMarked } from 'lucide-react'
import { Modal } from '../ui/atoms'
import { KNOWLEDGE } from '../config/scenarioData'
import { useDex, dex } from '../lib/dex'
import { audio } from '../lib/audio'

const ICON = { Satellite, ImageIcon, Mountain, Cloud, History, Ruler, Gauge, Package, Radar, Plane, Zap, Waves, Route, Scale }

function CardFace({ k, open, onClick, active }) {
  const Icon = ICON[k.icon] || BookOpen
  return (
    <button type="button" onClick={onClick} disabled={!open} data-dex-card={k.id} data-open={open ? 1 : 0}
      className={`flex h-[118px] flex-col items-center justify-center rounded-xl border-2 px-2 text-center transition ${open ? (active ? 'border-[#FFD066] bg-[#FFD066]/12' : 'border-sky-400/35 bg-[#0a1a30] hover:border-sky-300') : 'cursor-default border-white/8 bg-white/[0.02]'}`}>
      {open ? <Icon size={30} style={{ color: k.hex }} /> : <Lock size={24} className="text-slate-600" />}
      <span className={`font-thai mt-2 text-[12.5px] font-bold leading-tight ${open ? 'text-white' : 'text-slate-500'}`}>{open ? k.th : '???'}</span>
      {!open && <span className="font-thai mt-1 text-[10px] leading-tight text-slate-500">{k.how}</span>}
    </button>
  )
}

export function DexBook({ open, onClose }) {
  const found = useDex()
  const [pick, setPick] = useState(null)
  useEffect(() => { if (!open) setPick(null) }, [open])
  if (!open) return null
  const n = KNOWLEDGE.filter((k) => found[k.id]).length
  const sel = KNOWLEDGE.find((k) => k.id === pick)
  return (
    <Modal open={open} onClose={onClose} width={960} tone="#38BDF8" z={93}>
      <div className="p-6" data-dex-book>
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg border-2 border-sky-400 bg-sky-400/10"><BookMarked size={21} className="text-sky-300" /></span>
          <div>
            <div className="hud-label">KNOWLEDGE BOOK · สมุดการ์ดความรู้</div>
            <h2 className="font-thai text-[20px] font-bold text-white">สะสมแล้ว {n} / {KNOWLEDGE.length} ใบ</h2>
          </div>
          <div className="ml-4 h-2.5 w-48 overflow-hidden rounded-full bg-black/50"><div className="h-full rounded-full bg-sky-400 transition-[width] duration-700" style={{ width: `${(n / KNOWLEDGE.length) * 100}%` }} /></div>
        </div>
        <div className="mt-4 grid grid-cols-[1fr_320px] gap-4">
          <div className="grid grid-cols-4 gap-2">{KNOWLEDGE.map((k) => <CardFace key={k.id} k={k} open={!!found[k.id]} active={pick === k.id} onClick={() => setPick(k.id)} />)}</div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4" data-dex-detail={sel?.id || ''}>
            {sel ? (() => { const Icon = ICON[sel.icon] || BookOpen; return (
              <>
                <div className="flex items-center gap-2"><Icon size={22} style={{ color: sel.hex }} /><span className="font-thai text-[16px] font-bold text-white">{sel.th}</span></div>
                <p className="font-thai mt-2 text-[13px] leading-relaxed text-slate-200">{sel.body}</p>
                {sel.inGame && <p className="font-thai mt-2 rounded-lg border border-sky-400/25 bg-sky-400/[0.06] px-2.5 py-1.5 text-[12px] leading-snug text-sky-100"><b>ในเกม:</b> {sel.inGame}</p>}
                <p className="font-thai mt-2 text-[11px] text-slate-500">ที่มา: {sel.source}</p>
                <p className="font-thai mt-1 text-[10.5px] text-slate-600">พบครั้งแรก {new Date(found[sel.id]).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              </>
            ) })() : <div className="font-thai text-[13px] leading-relaxed text-slate-400">การ์ดปลดล็อกเมื่อคุณเจอเรื่องนั้นในเกมจริง — ถ่ายภาพ THEOS-2 แปลภาพ วัดลำน้ำ ส่งเรือ ตัดสินเยียวยา… เลือกการ์ดที่ปลดล็อกแล้วเพื่ออ่าน</div>}
          </div>
        </div>
        <div className="font-thai mt-3 flex items-center text-[11px] text-slate-500">สะสมในเครื่องนี้ · ทุกการ์ดอ้างอิงข้อมูลจริงของ GISTDA / หน่วยงาน
          <button onClick={() => { if (window.confirm('ล้างการ์ดที่สะสมไว้ในเครื่องนี้?')) dex.reset() }} className="ml-auto rounded px-1.5 text-slate-500 hover:bg-white/10 hover:text-white" data-dex-reset>ล้างสมุด</button>
        </div>
      </div>
    </Modal>
  )
}

/** A quiet banner when a card is unlocked — click to open the book. */
export function DexToast({ items, onOpen, onDone }) {
  useEffect(() => {
    if (!items.length) return undefined
    audio.play('flip')
    const t = setTimeout(onDone, 5200)
    return () => clearTimeout(t)
  }, [items.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!items.length) return null
  const ks = KNOWLEDGE.filter((k) => items.includes(k.id))
  return (
    <button onClick={onOpen} className="fixed bottom-16 right-4 z-[89] flex max-w-[340px] items-center gap-3 rounded-xl border border-sky-400/50 bg-[#07101f] px-3 py-2.5 text-left shadow-[0_14px_40px_-10px_rgba(0,0,0,.9)] animate-[riseIn_.3s_ease-out]" data-dex-toast>
      <BookMarked size={22} className="shrink-0 text-sky-300" />
      <span className="min-w-0">
        <span className="font-thai block text-[11px] font-bold text-sky-300">ปลดล็อกการ์ดความรู้{ks.length > 1 ? ` ${ks.length} ใบ` : ''}</span>
        <span className="font-thai block truncate text-[13.5px] font-bold text-white">{ks.map((k) => k.th).join(' · ')}</span>
        <span className="font-thai block text-[10.5px] text-slate-400">คลิกเพื่อเปิดสมุด</span>
      </span>
    </button>
  )
}
