/* ══════════════════════════════════════════════════════════════════════════
   CHIBI CREATOR (B8) — สร้างตัวละครที่หน้าเริ่มเกม
   ทรงผม · สีผม · สีผิว · ชุด · ชื่อ · รูปหน้า (อัปโหลด → ครอปวงกลม ย่อ 160 px ก่อนเก็บ)
   PDPA: รูปอยู่ในเครื่องนี้เท่านั้น ไม่เข้า Log/CSV/Leaderboard และลบได้ทุกเมื่อ
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useRef, useState } from 'react'
import { Upload, Trash2, ShieldCheck, Check, Shuffle } from 'lucide-react'
import { Modal } from '../ui/atoms'
import { Chibi, POSES } from '../ui/chibi'
import { profile, useProfile, HAIR, HAIR_COLORS, SKIN, OUTFITS, cropFace } from '../lib/profile'

const SHOWCASE = ['idle', 'point', 'megaphone', 'inspect', 'clipboard', 'cheer']

function Swatch({ color, on, onClick, data }) {
  return (
    <button onClick={onClick} {...data} className={`h-8 w-8 rounded-full border-2 transition ${on ? 'scale-110 border-white shadow-[0_0_12px_rgba(255,255,255,.5)]' : 'border-white/15 hover:border-white/50'}`} style={{ background: color }}>
      {on && <Check size={14} className="mx-auto text-white drop-shadow" />}
    </button>
  )
}

export function ChibiCreator({ open, onClose, player, setPlayer }) {
  const me = useProfile()
  const [i, setI] = useState(0)
  const [err, setErr] = useState('')
  const file = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    const t = setInterval(() => setI((n) => (n + 1) % SHOWCASE.length), 1700)
    return () => clearInterval(t)
  }, [open])
  const upload = async (f) => {
    setErr('')
    try { profile.setPhoto(await cropFace(f)) } catch { setErr('อ่านรูปนี้ไม่ได้ — ลองไฟล์ .jpg หรือ .png') }
  }
  const shuffle = () => profile.set({
    hair: HAIR[Math.floor(Math.random() * HAIR.length)].id, hairColor: HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)],
    skin: SKIN[Math.floor(Math.random() * SKIN.length)], outfit: OUTFITS[Math.floor(Math.random() * OUTFITS.length)].id,
  })
  const label = (t) => <div className="font-thai mb-1.5 text-[12px] font-bold text-slate-300">{t}</div>
  return (
    <Modal open={open} onClose={onClose} width={880} tone="#FFD066" z={92}>
      <div className="grid grid-cols-[300px_1fr] gap-5 p-6" data-chibi-creator>
        <div className="flex flex-col items-center">
          <div className="hud-label text-[#FFD066]">YOUR COMMANDER · ผู้บัญชาการของคุณ</div>
          <div className="relative mt-2 grid h-[300px] w-full place-items-center overflow-hidden rounded-xl border border-white/10 bg-[radial-gradient(70%_60%_at_50%_70%,rgba(56,189,248,.18),transparent)]">
            <div className="absolute inset-x-6 bottom-8 h-px bg-gradient-to-r from-transparent via-sky-400/40 to-transparent" />
            <Chibi key={SHOWCASE[i]} profile={me} pose={SHOWCASE[i]} size={190} />
          </div>
          <div className="font-thai mt-2 text-center text-[12px] text-slate-400">ท่าตัวอย่าง: {POSES[SHOWCASE[i]].say}</div>
          <button onClick={shuffle} className="font-thai mt-2 flex items-center gap-1.5 rounded-md border border-white/12 px-3 py-1.5 text-[12px] text-slate-300 hover:bg-white/[0.06]" data-chibi-shuffle><Shuffle size={13} />สุ่มลุค</button>
        </div>
        <div className="space-y-4">
          <div>
            {label('ชื่อผู้บัญชาการ / ทีม')}
            <input value={player} onChange={(e) => setPlayer(e.target.value)} maxLength={24} placeholder="เช่น ม.6/2-05" data-player-creator
              className="font-thai w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-[15px] text-white outline-none focus:border-[#FFD066]/70" />
          </div>
          <div>
            {label('ทรงผม')}
            <div className="flex gap-2">
              {HAIR.map((h) => (
                <button key={h.id} onClick={() => profile.set({ hair: h.id })} data-hair={h.id}
                  className={`flex flex-col items-center rounded-lg border-2 px-1.5 pb-1 pt-0.5 transition ${me.hair === h.id ? 'border-[#FFD066] bg-[#FFD066]/10' : 'border-white/10 hover:border-white/30'}`}>
                  <svg viewBox="22 14 76 76" width="50" height="50"><Chibi profile={{ ...me, hair: h.id, photo: null }} pose="idle" size={120} still /></svg>
                  <span className="font-thai text-[11px] text-slate-300">{h.th}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>{label('สีผม')}<div className="flex flex-wrap gap-2">{HAIR_COLORS.map((c, k) => <Swatch key={c} color={c} on={me.hairColor === c} onClick={() => profile.set({ hairColor: c })} data={{ 'data-hair-color': k }} />)}</div></div>
            <div>{label('สีผิว')}<div className="flex flex-wrap gap-2">{SKIN.map((c, k) => <Swatch key={c} color={c} on={me.skin === c} onClick={() => profile.set({ skin: c })} data={{ 'data-skin': k }} />)}</div></div>
          </div>
          <div>
            {label('ชุด')}
            <div className="grid grid-cols-4 gap-2">
              {OUTFITS.map((o) => (
                <button key={o.id} onClick={() => profile.set({ outfit: o.id })} data-outfit={o.id}
                  className={`flex flex-col items-center rounded-lg border-2 px-1 pb-1.5 transition ${me.outfit === o.id ? 'border-[#FFD066] bg-[#FFD066]/10' : 'border-white/10 hover:border-white/30'}`}>
                  <svg viewBox="14 12 92 140" width="52" height="78"><Chibi profile={{ ...me, outfit: o.id }} pose="idle" size={120} still /></svg>
                  <span className="font-thai text-[11px] text-slate-300">{o.th}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
            {label('รูปหน้า (ไม่บังคับ)')}
            <div className="flex items-center gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/20 bg-black/40">
                {me.photo ? <img src={me.photo} alt="" className="h-full w-full object-cover" /> : <span className="font-thai text-[10px] text-slate-500">หน้าการ์ตูน</span>}
              </div>
              <input ref={file} type="file" accept="image/*" className="hidden" data-photo-input onChange={(e) => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = '' }} />
              <button onClick={() => file.current?.click()} data-photo-upload className="font-thai flex items-center gap-1.5 rounded-md border border-sky-400/50 bg-sky-400/12 px-3 py-1.5 text-[12.5px] font-semibold text-sky-100 hover:bg-sky-400/20"><Upload size={14} />อัปโหลดรูป</button>
              {me.photo && <button onClick={() => profile.removePhoto()} data-photo-remove className="font-thai flex items-center gap-1.5 rounded-md border border-[#FF6B8A]/50 bg-[#FF003C]/10 px-3 py-1.5 text-[12.5px] font-semibold text-[#FFB3C2] hover:bg-[#FF003C]/20"><Trash2 size={14} />ลบรูป</button>}
            </div>
            {err && <div className="font-thai mt-1.5 text-[11.5px] text-[#FF9DB2]">{err}</div>}
            <div className="font-thai mt-2 flex gap-1.5 text-[11px] leading-snug text-slate-400"><ShieldCheck size={14} className="mt-[1px] shrink-0 text-[#22E36B]" />
              รูปถูกย่อเหลือ 160 พิกเซลและเก็บไว้ในเครื่องนี้เท่านั้น ไม่ส่งขึ้นอินเทอร์เน็ต ไม่ถูกบันทึกใน Log, CSV หรือตารางอันดับ (PDPA) · กด "ลบรูป" ได้ทุกเมื่อ</div>
          </div>
          <div className="flex justify-end">
            <button onClick={onClose} data-chibi-done className="btn flex items-center gap-2 border-[#22E36B]/70 bg-[#22E36B]/20 px-6 py-2.5 text-white hover:bg-[#22E36B]/30"><Check size={16} /><span className="font-thai normal-case tracking-normal text-[14px] font-bold">เสร็จ</span></button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
