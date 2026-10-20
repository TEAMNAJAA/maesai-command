/* ══════════════════════════════════════════════════════════════════════════
   GRADE STAMP (C4) — เกรด S/A/B/C ท้ายองก์ ตราประทับกระแทกลงจอพร้อมเสียง
   เกรดมาจาก actGrade() (sim.js) = สัดส่วนการตัดสินใจที่ดีในองก์นั้น + จำนวนผิดร้ายแรง (เกณฑ์ใน ACT_GRADES)
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useRef } from 'react'
import { audio } from '../lib/audio'
import { fx } from '../lib/fx'

const LABEL = { S: 'ยอดเยี่ยม', A: 'ดีมาก', B: 'พอใช้', C: 'ปรับปรุง' }

export function GradeStamp({ grade, act, size = 92, quiet = false }) {
  const played = useRef(false)
  useEffect(() => {
    if (!grade || played.current || quiet) return undefined
    played.current = true
    const t = setTimeout(() => { audio.play('stamp'); fx.emit('shake', { strength: grade.id === 'S' ? 0.8 : 0.5 }) }, 420)
    return () => clearTimeout(t)
  }, [grade, quiet])
  if (!grade) return null
  const hex = grade.hex
  return (
    <div className="pointer-events-none relative shrink-0 select-none" style={{ width: size, height: size }} data-grade={grade.id} data-grade-act={act} title={`เกรดองก์ ${act}: ${grade.id} — ${LABEL[grade.id]} · ตัดสินใจดี ${Math.round(grade.ratio * 100)}%${grade.critical ? ` · ผิดร้ายแรง ${grade.critical}` : ''}`}>
      <div className="absolute inset-0 grid place-items-center rounded-full border-[5px] animate-[stampIn_.42s_cubic-bezier(.2,1.6,.4,1)_both]"
        style={{ borderColor: hex, color: hex, background: `radial-gradient(circle, ${hex}22, transparent 70%)`, boxShadow: `0 0 26px -4px ${hex}, inset 0 0 0 3px ${hex}33` }}>
        <div className="absolute inset-[7px] rounded-full border-2 border-dashed" style={{ borderColor: `${hex}88` }} />
        <div className="text-center leading-none">
          <div className="font-mono font-black" style={{ fontSize: size * 0.48, textShadow: `0 0 18px ${hex}aa` }}>{grade.id}</div>
          <div className="font-thai font-bold" style={{ fontSize: Math.max(9, size * 0.12) }}>{LABEL[grade.id]}</div>
        </div>
      </div>
    </div>
  )
}
