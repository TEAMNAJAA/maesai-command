/* ══════════════════════════════════════════════════════════════════════════
   UI ATOMS — panels, provenance chip, gauges, buttons
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect } from 'react'
import { TrendingUp, TrendingDown, ArrowUp, X, ChevronDown, ChevronRight } from 'lucide-react'
import { SRC } from '../config/scenarioData'
import { clamp, fmt } from '../lib/format'

export function Panel({ children, className = '', glow = null, ...rest }) {
  return (
    <div className={`panel ${className}`} style={glow ? { boxShadow: `0 0 0 1px ${glow}33, 0 0 26px -8px ${glow}66, inset 0 1px 0 rgba(255,255,255,.05)` } : undefined} {...rest}>
      {children}
    </div>
  )
}

export function PanelHead({ title, right, icon: Icon, accent = '#7dd3fc' }) {
  return (
    <div className="panel-hd">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon size={12} style={{ color: accent }} className="shrink-0" />}
        <span className="panel-title truncate">{title}</span>
      </div>
      {right}
    </div>
  )
}

/** Provenance chip — every number on screen must declare where it came from.
 *  `dot` = colour dot only (dense one-line rows); the label stays in the tooltip and the map legend. */
export function Src({ t, mini = false, dot = false }) {
  const s = SRC[t]
  if (!s) return null
  if (dot) {
    return (
      <span title={`${s.th} (${s.code}) — ${s.note}`} data-src={t}
        className="inline-block h-[8px] w-[8px] shrink-0 rounded-full" style={{ background: s.hex, boxShadow: `0 0 0 2px ${s.hex}33, 0 0 6px ${s.hex}88` }} />
    )
  }
  return (
    <span title={`${s.th} (${s.code}) — ${s.note}`}
      className={`font-thai inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-[3px] border leading-none
        ${mini ? 'px-1 py-[2px] text-[8px]' : 'px-1.5 py-[3px] text-[9px]'}`}
      style={{ color: s.hex, borderColor: `${s.hex}55`, background: `${s.hex}14` }}>
      <span className="h-[4px] w-[4px] shrink-0 rounded-full" style={{ background: s.hex }} />
      {s.short}
    </span>
  )
}

/** Legend of the four provenance colours — shown on the map and in reports. */
export function SrcLegend({ className = '', vertical = false }) {
  return (
    <div className={`flex gap-1.5 ${vertical ? 'flex-col items-end' : 'flex-wrap items-center'} ${className}`}>
      {Object.keys(SRC).map((k) => <Src key={k} t={k} mini />)}
    </div>
  )
}

/** Centered modal with a dimmed backdrop. `tone` sets the accent colour. */
export function Modal({ open, onClose, children, width = 640, tone = '#38BDF8', closable = true, z = 80 }) {
  useEffect(() => {
    if (!open || !closable) return
    const h = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, closable, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 grid place-items-center bg-[#02050c]/75 p-4 backdrop-blur-sm animate-[fadeIn_.2s_ease-out]"
      style={{ zIndex: z }} onPointerDown={(e) => { if (closable && e.target === e.currentTarget) onClose?.() }}>
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-xl border bg-[#070D1C]/97 animate-[riseIn_.28s_ease-out]"
        style={{ maxWidth: width, borderColor: `${tone}55`, boxShadow: `0 0 0 1px ${tone}22, 0 0 60px -18px ${tone}` }}>
        <Corners color={`${tone}88`} />
        {closable && (
          <button onClick={onClose} className="absolute right-3 top-3 z-10 text-slate-500 hover:text-white" title="ปิด (Esc)">
            <X size={15} />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}

/** Collapsible accordion section used inside the side rails. */
export function Section({ title, th, icon: Icon, accent = '#7dd3fc', open, onToggle, right, children }) {
  return (
    <Panel className="shrink-0">
      <button onClick={onToggle} className="panel-hd w-full text-left">
        <span className="flex min-w-0 items-center gap-2">
          {Icon && <Icon size={12} style={{ color: accent }} className="shrink-0" />}
          <span className="panel-title truncate">{title}</span>
          {th && <span className="font-thai truncate text-[9.5px] text-slate-500">{th}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {right}
          {open ? <ChevronDown size={12} className="text-slate-500" /> : <ChevronRight size={12} className="text-slate-500" />}
        </span>
      </button>
      {open && <div className="animate-[fadeIn_.2s_ease-out]">{children}</div>}
    </Panel>
  )
}

/** Small tab strip. items: [[id, label, badge?]] · `beacon` = tab the mission quest points at */
export function Tabs({ items, value, onChange, tone = '#38BDF8', beacon = null }) {
  return (
    <div className="flex shrink-0 gap-[3px] border-b border-white/[0.07] px-2 pt-2">
      {items.map(([id, label, badge]) => {
        const on = value === id
        return (
          <button key={id} onClick={() => onChange(id)} data-tab={id}
            className={`font-thai relative flex-1 rounded-t px-1.5 py-1.5 text-[10.5px] font-semibold transition
              ${on ? 'text-white' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'}
              ${beacon === id && !on ? 'text-[#FFE0A3] ring-1 ring-[#FFD066]/70 animate-[beacon_1.6s_ease-in-out_infinite]' : ''}`}
            style={on ? { background: `${tone}26`, boxShadow: `inset 0 -2px 0 ${tone}` } : undefined}>
            {label}
            {badge ? <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#FFB300] animate-[flash_1.4s_ease-in-out_infinite]" /> : null}
          </button>
        )
      })}
    </div>
  )
}

export function Btn({ children, onClick, disabled, variant = 'ghost', size = 'md', className = '', icon: Icon, title, ...rest }) {
  const sizes = { sm: 'px-2 py-1 text-[9px]', md: 'px-3 py-1.5 text-[10px]', lg: 'px-4 py-2.5 text-[11px]' }
  const styles = {
    ghost: 'border-sky-400/25 bg-sky-400/[0.06] text-sky-200/90 hover:border-sky-400/60 hover:bg-sky-400/15 hover:text-sky-100',
    primary: 'border-sky-400/60 bg-sky-500/20 text-sky-100 hover:bg-sky-400/30 shadow-[0_0_18px_-6px_rgba(56,189,248,.85)]',
    danger: 'border-[#FF003C]/55 bg-[#FF003C]/14 text-[#FF6B8A] hover:bg-[#FF003C]/25 hover:text-white shadow-[0_0_18px_-6px_rgba(255,0,60,.9)]',
    go: 'border-[#00FF41]/50 bg-[#00FF41]/12 text-[#7CFFA0] hover:bg-[#00FF41]/22 hover:text-white',
    warn: 'border-[#FFB300]/50 bg-[#FFB300]/12 text-[#FFD066] hover:bg-[#FFB300]/22',
    solid: 'border-white/10 bg-white/[0.06] text-slate-300 hover:bg-white/10 hover:text-white',
  }
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled} {...rest}
      className={`btn ${sizes[size]} ${styles[variant]} ${className}`}>
      <span className="flex items-center justify-center gap-1.5">
        {Icon && <Icon size={size === 'sm' ? 10 : 12} />}
        {children}
      </span>
    </button>
  )
}

/** 270° arc gauge (Trust Index / Mission Success). */
export function ArcGauge({ value, size = 150, thickness = 11, color = '#00FF41', track = 'rgba(148,163,184,.18)',
  label, sub, delta, deltaDir = 'up', children, display = null, unit = '%', ticks = ['0%', '100%'] }) {
  const R = (size - thickness) / 2 - 2
  const cx = size / 2, cy = size / 2
  const START = 135, SWEEP = 270
  const toXY = (deg) => {
    const r = ((deg - 90) * Math.PI) / 180
    return [cx + R * Math.cos(r), cy + R * Math.sin(r)]
  }
  const arc = (from, to) => {
    const [x1, y1] = toXY(from), [x2, y2] = toXY(to)
    const large = to - from > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`
  }
  const v = clamp(value / 100)
  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size * 0.86} viewBox={`0 0 ${size} ${size * 0.86}`}>
        <path d={arc(START, START + SWEEP)} stroke={track} strokeWidth={thickness} fill="none" strokeLinecap="round" />
        {v > 0.002 && (
          <path d={arc(START, START + SWEEP * v)} stroke={color} strokeWidth={thickness} fill="none" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 7px ${color}cc)`, transition: 'all .6s cubic-bezier(.4,0,.2,1)' }} />
        )}
        <text x={cx} y={cy + 4} textAnchor="middle" className="num" fontSize={size * 0.24} fontWeight="700" fill="#fff">
          {display ?? Math.round(value)}
          {unit && <tspan fontSize={size * 0.12} fill={color}>{unit}</tspan>}
        </text>
        {label && (
          <text x={cx} y={cy + size * 0.16} textAnchor="middle" fontSize={size * 0.075} fill={color}
            className="font-mono" letterSpacing="1.6">{label}</text>
        )}
      </svg>
      <div className="-mt-1 flex w-full items-center justify-between px-2">
        <span className="hud-label">{ticks[0]}</span>
        {sub && <span className="hud-label text-slate-400">{sub}</span>}
        <span className="hud-label">{ticks[1]}</span>
      </div>
      {delta && (
        <div className="mt-1.5 flex items-center gap-1 font-mono text-[10px]"
          style={{ color: deltaDir === 'up' ? '#00FF41' : '#FF003C' }}>
          {deltaDir === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {delta}
        </div>
      )}
      {children}
    </div>
  )
}

/** Lightweight hand-rolled sparkline (used inside tight HUD panels). */
export function Spark({ data, color = '#38BDF8', h = 46, dots = false, fill = true }) {
  if (!data?.length) return null
  const min = Math.min(...data), max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1 || 1)) * 100, 100 - ((v - min) / span) * 84 - 8])
  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ')
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height: h }} className="w-full">
      {fill && <path d={`${line} L 100 100 L 0 100 Z`} fill={color} opacity="0.12" />}
      <path d={line} stroke={color} strokeWidth="1.6" fill="none" vectorEffect="non-scaling-stroke"
        style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
      {dots && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="1.6" fill={color} vectorEffect="non-scaling-stroke" />)}
    </svg>
  )
}

export function MeterRow({ name, pct, have, max, unit = '', color }) {
  const c = color || (pct >= 70 ? '#38BDF8' : pct >= 40 ? '#FFB300' : '#FF003C')
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] text-slate-300">{name}</span>
        <span className="num text-[11px] font-semibold" style={{ color: c }}>{pct}%</span>
      </div>
      <div className="mt-1 h-[5px] w-full overflow-hidden rounded-full bg-white/[0.07]">
        <div className="h-full rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${c}77, ${c})`, boxShadow: `0 0 8px ${c}aa` }} />
      </div>
      {have !== undefined && (
        <div className="num mt-0.5 text-right text-[9px] text-slate-500">
          {fmt(have)} / {fmt(max)}{unit}
        </div>
      )}
    </div>
  )
}

export function StatLine({ icon: Icon, label, value, src, accent = '#7dd3fc', arrow }) {
  return (
    <div className="flex items-center gap-2.5 py-[7px]">
      {Icon && (
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded border border-white/10 bg-white/[0.04]">
          <Icon size={12} style={{ color: accent }} />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300">{label}</span>
      {src && <Src t={src} mini />}
      <span className="num shrink-0 text-[11.5px] font-semibold text-white">{value}</span>
      {arrow && <ArrowUp size={11} className="shrink-0 text-[#FF003C]" />}
    </div>
  )
}

export function Divider({ label, right = null }) {
  return (
    <div className="flex items-center gap-2 py-2">
      <span className="hud-label whitespace-nowrap">{label}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-sky-400/25 to-transparent" />
      {right}
    </div>
  )
}

/* Corner brackets for that targeting-reticle command-center feel */
export function Corners({ color = 'rgba(56,189,248,.5)' }) {
  const c = 'pointer-events-none absolute h-2.5 w-2.5'
  return (
    <>
      <span className={`${c} left-0 top-0 border-l border-t`} style={{ borderColor: color }} />
      <span className={`${c} right-0 top-0 border-r border-t`} style={{ borderColor: color }} />
      <span className={`${c} bottom-0 left-0 border-b border-l`} style={{ borderColor: color }} />
      <span className={`${c} bottom-0 right-0 border-b border-r`} style={{ borderColor: color }} />
    </>
  )
}
