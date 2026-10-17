/* ══════════════════════════════════════════════════════════════════════════
   CUT SCENE — what the player sees while the clock jumps
   THEOS-2 acquisition: orbit → scan swaths → downlink → L3 Ortho (AWAGAD)
   Plain time jump: a banner with the clock running and what happened at the stop.
   The whole screen ignores clicks until the jump is over (1–3 s).
   ══════════════════════════════════════════════════════════════════════════ */

import React from 'react'
import { Satellite, FastForward, AlertTriangle, CheckCircle2, Radio, Cpu, Camera } from 'lucide-react'
import { THEOS2 } from '../config/missionConfig'
import { clockLabel } from '../lib/format'

const tgt = (t) => (t === 'TOWN' ? 'ตัวเมืองแม่สาย' : `Sector ${t}`)

function TheosScene({ cut, clock }) {
  const { pass } = cut
  const since = clock - pass.t
  const stage = since < 0 ? 0 : cut.act === 2 ? (since < 20 ? 1 : 3) : since < 25 ? 1 : since < 60 ? 2 : 3
  const steps = cut.act === 1
    ? [[Satellite, `THEOS-2 รอบ ${pass.id} โคจรเข้าพื้นที่`], [Camera, `ถ่ายภาพ ${pass.targets.map(tgt).join(' · ')} (Pan ${THEOS2.panM} ม. · MS ${THEOS2.msM} ม.)`], [Radio, 'ส่งข้อมูลลงสถานีภาครับ'], [Cpu, 'ประมวลผลภาพ L3 Ortho ผ่าน AWAGAD']]
    : [[Satellite, `THEOS-2 รอบ ${pass.id} โคจรผ่านเมืองแม่สาย`], [Camera, 'ถ่ายภาพตัวเมือง — เห็นเฉพาะโซนที่เมฆเปิด'], [Radio, 'ส่งข้อมูลลงสถานีภาครับ'], [Cpu, 'วิเคราะห์หาผู้ติดค้างบนหลังคา']]
  const k = cut.p
  return (
    <div className="w-[620px] overflow-hidden rounded-xl border border-sky-400/50 bg-[#050B18]/95 shadow-[0_0_60px_-10px_rgba(56,189,248,.8)]" data-cutscene="theos">
      {/* orbit strip */}
      <div className="relative h-[150px] overflow-hidden border-b border-sky-400/20 bg-[radial-gradient(120%_120%_at_50%_120%,#0b2a3f,#030712)]">
        <svg viewBox="0 0 620 150" className="absolute inset-0 h-full w-full">
          {Array.from({ length: 40 }, (_, i) => <circle key={i} cx={(i * 97) % 620} cy={(i * 53) % 90} r={i % 5 ? 0.7 : 1.2} fill="#fff" opacity={0.25 + (i % 3) * 0.2} />)}
          <path d="M-20 160 Q310 40 640 160" fill="#0f3d2e" stroke="#22E36B" strokeOpacity="0.35" />
          <path d="M-20 160 Q310 40 640 160" fill="url(#ground)" opacity="0.6" />
          <defs>
            <linearGradient id="ground" x1="0" x2="1"><stop offset="0" stopColor="#14532d" /><stop offset="0.5" stopColor="#3f6212" /><stop offset="1" stopColor="#14532d" /></linearGradient>
            <linearGradient id="beam" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#38BDF8" stopOpacity="0.55" /><stop offset="1" stopColor="#38BDF8" stopOpacity="0.05" /></linearGradient>
          </defs>
          {(() => {
            const x = -40 + k * 700, y = 34 + Math.sin(k * Math.PI) * -8
            return (
              <g>
                {stage >= 1 && stage <= 1 && <path d={`M${x - 6} ${y + 10} L${x - 46} 150 L${x + 46} 150 L${x + 6} ${y + 10} Z`} fill="url(#beam)" />}
                <rect x={x - 40} y={145} width={80} height={5} fill="#38BDF8" opacity={stage === 1 ? 0.9 : 0} />
                <g transform={`translate(${x} ${y})`}>
                  <rect x="-7" y="-6" width="14" height="12" rx="2" fill="#cbd5e1" stroke="#0f172a" />
                  <rect x="-32" y="-4" width="22" height="8" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="0.8" />
                  <rect x="10" y="-4" width="22" height="8" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="0.8" />
                  <circle cx="0" cy="7" r="2.4" fill="#38BDF8" />
                </g>
              </g>
            )
          })()}
        </svg>
        <div className="absolute left-3 top-2 flex items-center gap-2">
          <Satellite size={15} className="text-sky-300" />
          <span className="font-mono text-[11px] tracking-[0.18em] text-sky-200">THEOS-2 · {pass.id} · {clockLabel(pass.t)}</span>
        </div>
        <div className="num absolute right-3 top-2 text-[13px] font-bold text-white">{clockLabel(Math.round(clock))}</div>
      </div>
      <div className="space-y-1.5 p-4">
        {steps.map(([Icon, th], i) => {
          const on = i === stage && !cut.done, ok = i < stage || cut.done
          return (
            <div key={i} className="flex items-center gap-2.5">
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${ok ? 'border-[#22E36B] bg-[#22E36B]/20' : on ? 'border-sky-300 bg-sky-400/20' : 'border-white/15'}`}>
                {ok ? <CheckCircle2 size={13} className="text-[#7CFFA0]" /> : <Icon size={12} className={on ? 'animate-pulse text-sky-200' : 'text-slate-500'} />}
              </span>
              <span className={`font-thai text-[13.5px] ${ok ? 'text-slate-300' : on ? 'font-bold text-white' : 'text-slate-500'}`}>{th}{on && <span className="animate-pulse">…</span>}</span>
            </div>
          )
        })}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-sky-400 transition-[width]" style={{ width: `${k * 100}%` }} /></div>
        {cut.done && cut.event && (
          <div className="font-thai mt-2 flex items-center gap-2 rounded-md border border-[#22E36B]/40 bg-[#22E36B]/10 px-3 py-2 text-[14px] font-bold text-[#BFF5CF] animate-[riseIn_.3s_ease-out]">
            <CheckCircle2 size={16} /> {cut.event.th}
          </div>
        )}
      </div>
    </div>
  )
}

function JumpBanner({ cut, clock }) {
  const ev = cut.done && cut.event
  const bad = ev && ['crit', 'lost', 'storm', 'power', 'escalate', 'prepass'].includes(ev.kind)
  const hex = ev ? (bad ? '#FFB300' : '#22E36B') : '#38BDF8'
  return (
    <div className="min-w-[440px] rounded-lg border bg-[#050B18]/95 px-4 py-2.5 shadow-[0_0_40px_-12px_rgba(56,189,248,.8)]" style={{ borderColor: `${hex}88` }} data-cutscene="advance">
      <div className="flex items-center gap-2.5">
        <FastForward size={16} className="text-sky-300" />
        <span className="font-thai text-[13px] text-slate-300">เดินเวลา</span>
        <span className="num text-[13px] text-slate-400">{clockLabel(cut.from)}</span>
        <span className="text-slate-500">→</span>
        <span className="num text-[16px] font-bold text-white">{clockLabel(Math.round(clock))}</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-sky-400" style={{ width: `${cut.p * 100}%` }} /></div>
      {ev && (
        <div className="font-thai mt-2 flex items-center gap-2 text-[14px] font-bold animate-[riseIn_.25s_ease-out]" style={{ color: bad ? '#FFE0A3' : '#BFF5CF' }}>
          {bad ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />} {ev.th}
        </div>
      )}
    </div>
  )
}

export function Cutscene({ eng }) {
  const { cut, s } = eng
  if (!cut) return null
  return (
    <div className="fixed inset-0 z-[75] cursor-wait" data-cut={cut.kind}>
      <div className={`absolute inset-0 ${cut.kind === 'theos' ? 'bg-black/45 backdrop-blur-[1.5px]' : 'bg-transparent'}`} />
      <div className={`absolute left-1/2 -translate-x-1/2 ${cut.kind === 'theos' ? 'top-1/2 -translate-y-1/2' : 'bottom-[150px]'}`}>
        {cut.kind === 'theos' ? <TheosScene cut={cut} clock={s.clock} /> : <JumpBanner cut={cut} clock={s.clock} />}
      </div>
    </div>
  )
}
