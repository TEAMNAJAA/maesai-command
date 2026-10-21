/* ══════════════════════════════════════════════════════════════════════════
   CHIBI GUIDE (Beginner) — the player's chibi stands beside the control to use next and says what to do there
   • อ่านขั้นถัดไปจาก questFor(eng).hint (หัวข้อเดียวกับแถบผู้ช่วยสอน) → ชี้ที่ปุ่ม/การ์ดจริงในแผงสั่งการ
     ถ้าแท็บนั้นยังไม่เปิด ชี้ที่ปุ่มแท็บก่อน · ไม่บอกคำตอบ (ไม่บอกโซน/ค่า) บอกแค่ "ทำอะไร ตรงไหน อย่างไร" · ไม่หักคะแนน
   • ซ่อนเมื่อมีหน้าต่าง/คัตซีน/ฉากเปิดอยู่ · ปิดได้ทีละขั้น (×) · โหมดเจ้าหน้าที่/Expert ไม่มี
   • data-*: data-chibi-guide (= หัวข้อ) · data-chibi-guide-target · data-chibi-guide-close
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Chibi } from './chibi'
import { useProfile } from '../lib/profile'

/** topic → where to point (first visible match) and what to say. ctx comes from the quest hint. */
const GUIDE = {
  'a1.camp': { sel: () => '[data-panel="base"] [data-camp]', th: 'เลือกที่ตั้งฐาน — ดูความสูงพื้นและระยะจากแม่น้ำในการ์ด แล้วกดเลือก' },
  'a1.task': { sel: () => '[data-panel="theos"] [data-target]', th: 'เลือกเป้าที่เมฆพยากรณ์ไม่เกิน 60% (รอบละ 2 เป้า) แล้วกด “ให้ THEOS-2 ถ่าย”' },
  'a1.read': { sel: (c) => (c?.imageId ? `[data-image="${c.imageId}"] button` : '[data-image] button'), th: 'กดเปิดภาพนี้ แล้วคลิกหมุดที่เป็นรอยดินถล่ม “ใหม่” — ระวังนา เงาเมฆ และรอยเก่า' },
  'a1.channel': { sel: () => '[data-panel="bank"] button.btn', th: 'เปิดเครื่องมือวัด แล้วลากหมุดสองข้างให้ชิดผิวน้ำพอดี' },
  'a1.seal': { sel: () => '[data-seal-plans]', th: 'เลือกแผนแนวตลิ่ง 1 แบบ — อ่านการ์ด “ผลที่จะเกิด” ก่อนกดยืนยัน' },
  'a1.evac': { sel: () => '[data-panel="zones-order"]', th: 'เลือกโซนที่ SFVI ถึง 0.62 แล้วกด “สั่งอพยพ” — โซนที่หลักฐานยังไม่พอ สั่งแล้วจะเป็นเตือนผิด' },
  'a2.hazard': { sel: () => '[data-panel="field"] [data-power] button, [data-panel="field"] [data-comm] button', th: 'จัดการอันตรายตรงนี้ก่อน: ตัดไฟโซนที่ไฟรั่ว · ตั้งเสาให้คนโทรแจ้งได้' },
  'a2.pass': { sel: () => '[data-pass2] button', th: 'สั่ง THEOS-2 ถ่ายเมืองรอบนี้ เพื่อหาคนที่ติดอยู่บนหลังคา' },
  'a2.route': { sel: (c) => (c?.pointId ? `[data-point="${c.pointId}"] button` : '[data-point] button'), th: 'กดวางแผนเรือ แล้วเลือกเส้นทางที่ขึ้น ✓ ไม่พบอันตราย (เส้นสั้นที่สุดในกลุ่มนั้น)' },
  'a2.find': { sel: () => '[data-drone-zone]', th: 'ส่งโดรนไปโซนจุดอับ — ดาวเทียมมองไม่เห็นคนใต้ร่มไม้/ซอยลึก' },
}

const visible = (el) => {
  if (!el) return false
  const r = el.getBoundingClientRect()
  return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
}
const OVERLAYS = '[data-modal], [data-cutscene], [data-action-scene], [data-boss]'

export function ChibiGuide({ hint, hidden }) {
  const me = useProfile()
  const [spot, setSpot] = useState(null)              // { rect, th, tab }
  const [closed, setClosed] = useState(null)          // topic the player dismissed
  const topic = hint?.topic
  const g = GUIDE[topic]

  useEffect(() => {
    if (!g || hidden || closed === topic) { setSpot(null); return undefined }
    let scrolled = false
    const find = () => {
      if (document.querySelector(OVERLAYS)) return setSpot(null)
      const el = [...document.querySelectorAll(g.sel(hint.ctx))].find(visible)
        || (() => { const t = [...document.querySelectorAll(g.sel(hint.ctx))][0]; if (t && !scrolled) { scrolled = true; t.scrollIntoView({ block: 'nearest' }) } return visible(t) ? t : null })()
      if (el) return setSpot({ rect: el.getBoundingClientRect(), th: g.th, tab: false })
      const tab = hint.go?.tab && document.querySelector(`[data-rail="command"] [data-tab="${hint.go.tab}"]`)
      if (visible(tab)) return setSpot({ rect: tab.getBoundingClientRect(), th: `เปิดแท็บนี้ก่อน${hint.lead ? ` — ${hint.lead}` : ''}`, tab: true })
      setSpot(null)
    }
    find()
    const iv = setInterval(find, 500)
    addEventListener('resize', find)
    return () => { clearInterval(iv); removeEventListener('resize', find) }
  }, [topic, hint?.ctx?.imageId, hint?.ctx?.pointId, hidden, closed]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!spot) return null
  const { rect } = spot
  const W = 236, C = 66
  // stand to the left of the target (the command rail is on the right); to its right when there is no room
  const left = rect.left - W - C - 18 > 8 ? rect.left - W - C - 18 : Math.min(innerWidth - W - C - 8, rect.right + 14)
  const top = Math.max(60, Math.min(innerHeight - 150, rect.top + rect.height / 2 - 52))
  const onLeft = left < rect.left
  return createPortal(
    <>
      <div className="pointer-events-none fixed z-[70] rounded-lg border-2 border-[#FFD066] shadow-[0_0_0_4px_rgba(255,208,102,.18),0_0_22px_rgba(255,208,102,.55)] animate-pulse"
        style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8 }} data-chibi-guide-target />
      <div className={`pointer-events-none fixed z-[71] flex items-end gap-1 ${onLeft ? '' : 'flex-row-reverse'}`} style={{ left, top, width: W + C + 8 }} data-chibi-guide={topic}>
        <div className="font-thai pointer-events-auto relative rounded-xl border border-[#FFD066]/70 bg-[#0b1426]/95 px-3 py-2 text-[12.5px] leading-snug text-[#FFF3CC] shadow-[0_10px_30px_-8px_#000]" style={{ width: W }}>
          <button onClick={() => setClosed(topic)} className="absolute right-1 top-1 rounded p-0.5 text-slate-500 hover:bg-white/10 hover:text-white" title="ซ่อนขั้นนี้" data-chibi-guide-close><X size={12} /></button>
          <div className="pr-4 text-[10.5px] font-bold tracking-wide text-[#FFD066]">{spot.tab ? 'ไปที่แท็บนี้' : 'ทำตรงนี้'}</div>
          <div>{spot.th}</div>
        </div>
        <div style={{ transform: onLeft ? 'none' : 'scaleX(-1)' }}><Chibi profile={me} pose="point" size={C} /></div>
      </div>
    </>,
    document.body,
  )
}
