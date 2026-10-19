/* ══════════════════════════════════════════════════════════════════════════
   SETTINGS MENU (TopBar) — เปิด/ปิดเพลง · เปิด/ปิดเสียงเอฟเฟกต์ · ระดับเสียงแยกกัน (จำค่าไว้ในเครื่อง)
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useRef, useState } from 'react'
import { Volume2, VolumeX, Music2, MousePointerClick, X } from 'lucide-react'
import { prefs, usePrefs } from '../lib/prefs'
import { audio } from '../lib/audio'

function Toggle({ on, onChange, id }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} data-pref={id} data-on={on ? 1 : 0}
      className={`relative h-[20px] w-[36px] shrink-0 rounded-full border transition ${on ? 'border-[#22E36B] bg-[#22E36B]/35' : 'border-white/20 bg-white/[0.06]'}`}>
      <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full transition-all ${on ? 'left-[18px] bg-[#7CFFA0] shadow-[0_0_8px_#22E36B]' : 'left-[2px] bg-slate-400'}`} />
    </button>
  )
}

function Row({ icon: Icon, th, sub, children }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <Icon size={15} className="shrink-0 text-sky-300" />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="font-thai text-[12.5px] font-semibold text-white">{th}</div>
        {sub && <div className="font-thai text-[10.5px] text-slate-500">{sub}</div>}
      </div>
      {children}
    </div>
  )
}

function Volume({ value, onChange, disabled, id }) {
  return (
    <input type="range" min="0" max="1" step="0.05" value={value} disabled={disabled} data-pref-vol={id}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-1 w-full cursor-pointer accent-[#38BDF8] disabled:opacity-30" />
  )
}

/** Speaker button + popover. `extra` renders more sections (performance / officer mode). */
export function SettingsMenu({ extra = null }) {
  const p = usePrefs()
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const down = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    const key = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', down, true); window.addEventListener('keydown', key)
    return () => { window.removeEventListener('pointerdown', down, true); window.removeEventListener('keydown', key) }
  }, [open])
  const silent = !p.music && !p.sfx
  return (
    <div className="relative" ref={box}>
      <button onClick={() => { audio.unlock(); setOpen((o) => !o) }} title="เสียงและการตั้งค่า" data-settings
        className={`grid h-8 w-8 place-items-center rounded hover:bg-white/10 hover:text-white ${open ? 'bg-white/10 text-white' : 'text-slate-400'}`}>
        {silent ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-[95] w-[300px] overflow-hidden rounded-lg border border-sky-400/30 bg-[#07101f] shadow-[0_24px_60px_-14px_rgba(0,0,0,.95)] animate-[riseIn_.18s_ease-out]" data-settings-menu>
          <div className="flex items-center gap-2 border-b border-white/[0.07] bg-sky-400/[0.07] px-3 py-2">
            <span className="hud-label !text-[9px] text-sky-300">SETTINGS · การตั้งค่า</span>
            <button onClick={() => setOpen(false)} className="ml-auto text-slate-500 hover:text-white"><X size={13} /></button>
          </div>
          <div className="divide-y divide-white/[0.06] px-3">
            <div className="py-1">
              <Row icon={Music2} th="เพลงพื้นหลัง" sub={p.officer ? 'ปิดในโหมดฝึกเจ้าหน้าที่' : 'ambient · เร่งจังหวะเมื่อสถานการณ์ตึงเครียด'}>
                <Toggle id="music" on={p.music && !p.officer} onChange={(v) => prefs.set({ music: v })} />
              </Row>
              <Volume id="music" value={p.musicVol} disabled={!p.music || p.officer} onChange={(v) => prefs.set({ musicVol: v })} />
            </div>
            <div className="py-1">
              <Row icon={MousePointerClick} th="เสียงเอฟเฟกต์" sub="ชี้/คลิกปุ่ม · THEOS-2 · เหตุการณ์">
                <Toggle id="sfx" on={p.sfx} onChange={(v) => { prefs.set({ sfx: v }); if (v) setTimeout(() => audio.play('ok'), 30) }} />
              </Row>
              <Volume id="sfx" value={p.sfxVol} disabled={!p.sfx} onChange={(v) => { prefs.set({ sfxVol: v }); audio.play('tick') }} />
            </div>
            {extra}
          </div>
          <div className="font-thai border-t border-white/[0.06] px-3 py-1.5 text-[10px] text-slate-500">จำค่าไว้ในเครื่องนี้ · เสียงทั้งหมดสังเคราะห์ในเบราว์เซอร์ ใช้ได้แบบออฟไลน์</div>
        </div>
      )}
    </div>
  )
}

export { Toggle as SettingToggle, Row as SettingRow }
