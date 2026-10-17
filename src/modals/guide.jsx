/* ══════════════════════════════════════════════════════════════════════════
   LEADERBOARD — per mode, kept on this machine (score first, then playing time)
   คู่มือการเล่นย้ายไปอยู่ที่ modals/intro.jsx (HowToPlay)
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo } from 'react'
import { Trophy, Trash2, Zap } from 'lucide-react'
import { Modal, Btn } from '../ui/atoms'
import { MODES, TIME } from '../config/missionConfig'
import { leaderboard } from '../lib/leaderboard'
import { fmt, mmss } from '../lib/format'

export function LeaderboardModal({ open, onClose, highlight, version }) {
  const [mode, setMode] = useState('beginner')
  const rows = useMemo(() => leaderboard.top(mode, 10), [mode, open, version]) // eslint-disable-line react-hooks/exhaustive-deps
  const [confirm, setConfirm] = useState(false)
  if (!open) return null
  return (
    <Modal open onClose={onClose} width={620} tone="#FFD066" z={93}>
      <div className="p-5" data-modal="leaderboard">
        <div className="flex items-center gap-3">
          <Trophy size={20} className="text-[#FFD066]" />
          <div>
            <div className="hud-label">LEADERBOARD · เก็บในเครื่องนี้</div>
            <h2 className="font-thai text-[19px] font-bold text-white">ตารางคะแนนผู้บัญชาการ</h2>
          </div>
        </div>
        <div className="mt-3 flex gap-1">
          {Object.entries(MODES).map(([id, m]) => (
            <button key={id} onClick={() => setMode(id)} className={`font-thai flex-1 rounded px-2 py-1.5 text-[12px] font-semibold ${mode === id ? 'bg-[#FFD066]/20 text-white' : 'bg-white/[0.03] text-slate-400'}`}>{m.th} · {m.en}</button>
          ))}
        </div>
        <table className="mt-3 w-full border-collapse">
          <thead><tr className="border-b border-white/10">{['อันดับ', 'ชื่อ', 'คะแนน', 'เวลาเล่น', 'seed'].map((h) => <th key={h} className="font-thai px-2 py-1.5 text-left text-[11px] text-slate-400">{h}</th>)}</tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} className="font-thai px-2 py-4 text-center text-[12px] text-slate-500">ยังไม่มีคะแนนในโหมดนี้</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.at + r.name} className="border-b border-white/[0.05]" style={highlight && highlight.at === r.at ? { background: 'rgba(255,208,102,.12)' } : undefined}>
                <td className="num px-2 py-1.5 text-[13px] font-bold" style={{ color: i === 0 ? '#FFD066' : i === 1 ? '#cbd5e1' : i === 2 ? '#d6a46c' : '#94a3b8' }}>{i + 1}</td>
                <td className="font-thai px-2 py-1.5 text-[12.5px] text-white">{r.name}</td>
                <td className="num px-2 py-1.5 text-[13px] font-bold text-[#7CFFA0]">{Math.round(r.score)}%</td>
                <td className="num px-2 py-1.5 text-[11.5px] text-slate-400">{mmss(r.sec)}{r.sec && r.sec <= TIME.expertTargetSec ? <Zap size={11} className="ml-1 inline text-[#FFD066]" /> : null}</td>
                <td className="num px-2 py-1.5 text-[11px] text-slate-500">{r.seed}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-3 flex items-center justify-between">
          {confirm ? (
            <span className="flex items-center gap-2"><span className="font-thai text-[11.5px] text-[#FF9DB2]">ล้างทั้งหมด?</span>
              <Btn size="sm" variant="danger" onClick={() => { leaderboard.clear(); setConfirm(false); onClose() }}><span className="font-thai normal-case">ล้าง</span></Btn>
              <Btn size="sm" variant="solid" onClick={() => setConfirm(false)}><span className="font-thai normal-case">ยกเลิก</span></Btn></span>
          ) : <Btn size="sm" variant="solid" icon={Trash2} onClick={() => setConfirm(true)}><span className="font-thai normal-case">ล้างตาราง (ครู)</span></Btn>}
          <Btn variant="primary" onClick={onClose}><span className="font-thai normal-case tracking-normal">ปิด</span></Btn>
        </div>
      </div>
    </Modal>
  )
}
