/* ?chibilab — every pose, hair style and outfit on one page (visual check for B8/B12). */
import React from 'react'
import { Chibi, POSES } from './chibi'
import { HAIR, HAIR_COLORS, SKIN, OUTFITS, useProfile } from '../lib/profile'

export function ChibiLab() {
  const me = useProfile()
  return (
    <div className="min-h-screen bg-[#050912] p-6 text-white" data-chibi-lab>
      <div className="font-thai text-[18px] font-bold">Chibi lab · ท่าทั้งหมด</div>
      <div className="mt-3 grid grid-cols-7 gap-3">
        {Object.entries(POSES).map(([k, p]) => (
          <div key={k} className="flex flex-col items-center rounded-lg border border-white/10 bg-white/[0.03] p-2">
            <Chibi profile={me} pose={k} size={96} />
            <div className="num mt-1 text-[11px] text-sky-300">{k}</div>
            <div className="font-thai text-[10.5px] text-slate-400">{p.say}</div>
          </div>
        ))}
      </div>
      <div className="font-thai mt-5 text-[18px] font-bold">ทรงผม × ชุด × สีผิว</div>
      <div className="mt-3 grid grid-cols-10 gap-2">
        {HAIR.flatMap((h, i) => OUTFITS.slice(0, 2).map((o, j) => (
          <div key={h.id + o.id} className="flex flex-col items-center rounded-lg border border-white/10 bg-white/[0.03] p-1.5">
            <Chibi profile={{ hair: h.id, hairColor: HAIR_COLORS[(i + j) % HAIR_COLORS.length], skin: SKIN[(i * 2 + j) % SKIN.length], outfit: OUTFITS[(i + j * 2) % OUTFITS.length].id }} pose="idle" size={72} still />
            <div className="font-thai text-[10px] text-slate-400">{h.th} · {OUTFITS[(i + j * 2) % OUTFITS.length].th}</div>
          </div>
        )))}
      </div>
    </div>
  )
}
