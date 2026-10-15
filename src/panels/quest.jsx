/* ══════════════════════════════════════════════════════════════════════════
   MISSION QUEST — กล่องภารกิจองก์ 1 (มุมขวาบนของแผงสั่งการ)
   3 สเต็ปที่ผู้เล่นต้องทำตามลำดับ: สแกนต้นน้ำ (L) → แนวตลิ่ง (N) → ตัดสินใจ
   สเต็ปที่เสร็จติ๊กถูกสีเขียว · สเต็ปถัดไปกระพริบชี้เป้า
   ══════════════════════════════════════════════════════════════════════════ */

import React from 'react'
import { Check, ChevronRight, Target, Flag, X } from 'lucide-react'
import { Src } from '../ui/atoms'
import { GAME, CLOUD_RULE, QUEST } from '../config/missionConfig'
import { cloudAt } from '../lib/sim'
import { fmt } from '../lib/format'

/** Act 1 counts as decided once the player evacuated, issued a standby or chose to hold. */
export const act1Decided = (s) => s.decisions.some((d) => d.act === 1)

/** The three act-1 steps, derived from the engine state (pure). */
export function questSteps(eng) {
  const { s, sfvi } = eng
  const windowClosed = cloudAt(s.clock + GAME.swathMinutes) > CLOUD_RULE.cloudPct
  const used = GAME.swaths - s.swaths
  const scanDone = s.tasked.length > 0 && (s.swaths === 0 || windowClosed)
  const scanMissed = !scanDone && s.tasked.length === 0 && (s.swaths === 0 || windowClosed)
  const sealed = s.sealed.length
  const decided = act1Decided(s)
  return [
    {
      id: 'scan', n: 1, factor: 'L', src: 'image',
      title: 'สแกนป่าต้นน้ำ (SECTOR) หาจุดดินถล่มใหม่',
      state: scanDone ? 'done' : scanMissed ? 'missed' : 'todo',
      detail: scanMissed ? 'เมฆปิดหน้าต่างภาพแล้ว — ไปต่อด้วยหลักฐานที่มี' : `ถ่ายแล้ว ${used}/${GAME.swaths} แถบ · พบดินถล่ม ${sfvi.scarsSeen} จุด`,
      how: `คลิกแถบ SECTOR บนแผนที่ลุ่มน้ำ (แถบละ ${fmt(GAME.swathAP)} AP)`,
      go: { view: 'catchment', tab: 'data' }, cta: 'เปิดแผนที่ลุ่มน้ำ',
    },
    {
      id: 'bank', n: 2, factor: 'N', src: 'image',
      title: 'ตรวจแนวตลิ่งแม่น้ำสาย + สั่งอุดจุดฟันหลอ',
      state: s.channelMeasured && sealed >= QUEST.sealTarget ? 'done' : 'todo',
      detail: `วัดลำน้ำ ${s.channelMeasured ? `${Math.round(s.channelWidth)} ม. ✓` : 'ยังไม่วัด'} · อุดแล้ว ${sealed}/${QUEST.sealTarget} จุด`,
      how: 'กดปุ่มวัดลำน้ำ แล้วคลิกหมุดแดงบนแผนที่เพื่อสั่งอุด',
      go: { view: 'corridor', tab: 'resources' }, cta: 'เปิดแนวตลิ่งเมือง',
    },
    {
      id: 'decide', n: 3, factor: 'SFVI', src: null,
      title: 'ดู LIVE SFVI แล้วกดตัดสินใจ',
      state: decided ? 'done' : 'todo',
      detail: `SFVI ${sfvi.basin.toFixed(2)} · ${sfvi.veto1 ? 'Veto 1 — ต้องอพยพทันที' : sfvi.justified ? 'หลักฐานพอสั่งอพยพ' : 'หลักฐานยังไม่พอ'}`,
      how: 'กด [ประกาศอพยพ] หรือ [แจ้งเตรียมพร้อม] ในแท็บตัดสินใจ',
      go: { tab: 'decide' }, cta: 'ไปที่การตัดสินใจ',
    },
  ]
}

/** The step the beacon points at — Veto 1 jumps straight to the decision. */
export function activeStep(eng, steps = questSteps(eng)) {
  if (act1Decided(eng.s)) return null
  if (eng.veto1) return steps[2]
  return steps.find((x) => x.state === 'todo') || null
}

export function QuestBox({ eng, onGo, onFinish }) {
  const steps = questSteps(eng)
  const active = activeStep(eng, steps)
  const decided = act1Decided(eng.s)
  const done = steps.filter((x) => x.state === 'done').length
  return (
    <div className="mx-2.5 mt-2 shrink-0 overflow-hidden rounded-md border border-[#FFD066]/35 bg-gradient-to-b from-[#FFD066]/[0.08] to-transparent" data-quest>
      <div className="flex items-center gap-2 px-2.5 pt-2">
        <Target size={13} className="text-[#FFD066]" />
        <span className="font-thai text-[12px] font-bold text-white">ภารกิจองก์ 1</span>
        <span className="hud-label">MISSION</span>
        <span className="num ml-auto rounded bg-white/[0.06] px-1.5 py-[1px] text-[10px] font-bold" style={{ color: done === 3 ? '#7CFFA0' : '#FFD066' }}>{done}/3</span>
      </div>
      <div className="space-y-1 p-2">
        {steps.map((st) => {
          const on = active?.id === st.id
          const ok = st.state === 'done'
          const missed = st.state === 'missed'
          return (
            <div key={`${st.id}-${st.state}`} data-quest-step={st.id} data-state={on ? 'active' : st.state}
              className={`rounded border transition ${ok ? 'border-[#22E36B]/30 bg-[#22E36B]/[0.06] animate-[stepdone_1.4s_ease-out]'
                : on ? 'border-[#FFD066]/70 bg-[#FFD066]/[0.09] animate-[beacon_1.6s_ease-in-out_infinite]'
                  : missed ? 'border-[#A78BFA]/30 bg-[#A78BFA]/[0.05]' : 'border-white/[0.07] bg-white/[0.02]'}`}>
              <button onClick={() => onGo(st.go)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left">
                <span className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] border-2
                  ${ok ? 'border-[#22E36B] bg-[#22E36B] animate-[checkpop_.6s_ease-out]' : missed ? 'border-[#A78BFA]/70' : on ? 'border-[#FFD066]' : 'border-slate-600'}`}>
                  {ok ? <Check size={12} strokeWidth={4} className="text-[#04121F]" />
                    : missed ? <X size={11} strokeWidth={3} className="text-[#C4B5FD]" />
                      : on ? <ChevronRight size={12} strokeWidth={3} className="text-[#FFD066] animate-[flash_1s_ease-in-out_infinite]" />
                        : <span className="num text-[9.5px] font-bold text-slate-500">{st.n}</span>}
                </span>
                <span className={`font-thai min-w-0 flex-1 text-[11.5px] leading-tight ${ok ? 'text-[#BFF5CF]' : on ? 'font-semibold text-white' : missed ? 'text-[#C4B5FD]' : 'text-slate-400'}`}>
                  <span className="num mr-1 text-[10px] opacity-70">{st.n}</span>{st.title}
                </span>
                <span className="num shrink-0 rounded border px-1 py-[1px] text-[9px] font-bold"
                  style={{ color: ok ? '#7CFFA0' : '#9FCBEF', borderColor: ok ? '#22E36B55' : '#38BDF844' }}>{st.factor}</span>
              </button>
              {(on || ok || missed) && (
                <div className="font-thai flex items-center gap-1.5 px-2 pb-1.5 pl-[34px] text-[10px] leading-snug text-slate-400">
                  <span className="min-w-0 flex-1">{st.detail}</span>
                  {st.src && <Src t={st.src} mini />}
                </div>
              )}
              {on && (
                <div className="px-2 pb-2 pl-[34px]">
                  <div className="font-thai text-[10px] leading-snug text-[#FFE0A3]">{st.how}</div>
                  <button onClick={() => onGo(st.go)} data-quest-go={st.id}
                    className="font-thai mt-1.5 flex w-full items-center justify-center gap-1 rounded border border-[#FFD066]/60 bg-[#FFD066]/15 px-2 py-1.5 text-[11px] font-bold text-[#FFE6A8] transition hover:bg-[#FFD066]/25">
                    {st.cta} <ChevronRight size={12} />
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {decided && (
        <div className="px-2 pb-2">
          <button onClick={onFinish} data-quest-finish
            className="font-thai flex w-full items-center justify-center gap-1.5 rounded border-2 border-[#22E36B]/70 bg-[#22E36B]/15 px-2 py-2 text-[12px] font-bold text-[#BFF5CF] transition animate-[beaconGo_1.6s_ease-in-out_infinite] hover:bg-[#22E36B]/25">
            <Flag size={13} /> สรุปผลองก์ 1 แล้วไปองก์ 2 <ChevronRight size={13} />
          </button>
          {done < 3 && <div className="font-thai mt-1 text-center text-[9.5px] text-slate-500">สเต็ปที่ยังไม่ติ๊กทำต่อได้ก่อนไปองก์ 2</div>}
        </div>
      )}
    </div>
  )
}
