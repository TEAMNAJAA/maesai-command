/* ══════════════════════════════════════════════════════════════════════════
   WEATHER OVERLAY (C3) — rain and lightning over the map, in screen space
   ความแรงมาจาก weatherAt() (แบบจำลองเดียวกับเกม) · ฝน = พื้นหลัง SVG เลื่อนด้วย CSS (ไม่ re-render React)
   ฟ้าแลบสุ่มเฉพาะภาพ/เสียง ไม่กระทบตรรกะเกม · class fx-heavy = ปิดได้ในโหมดประหยัด (D5)
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useRef, useState } from 'react'
import { weatherAt } from '../lib/weather'
import { audio } from '../lib/audio'
import { usePerf } from '../lib/perf'

export function Weather({ eng, boost = 0 }) {
  const w = weatherAt(eng.s, eng.scn)
  const lightning = Math.min(1, w.lightning + boost)
  const rain = Math.min(1, w.rain + boost * 0.5)
  const [flash, setFlash] = useState(null)
  const level = useRef(lightning)
  level.current = lightning
  const lite = usePerf().lite                       // D5: no rain layers, no strikes, no thunder
  const on = lightning >= 0.15 && !lite
  // random strikes while a storm or the T0 crisis lasts — the gap shrinks as it gets worse
  useEffect(() => {
    if (!on) return undefined
    let tm
    const next = () => {
      const k = level.current
      tm = setTimeout(() => {
        if (document.hidden) { next(); return }
        setFlash({ id: Date.now(), x: 8 + Math.random() * 84, bolt: Math.random() < 0.65, bend: Math.random() })
        setTimeout(() => audio.play('thunder'), 250 + Math.random() * 1400)
        next()
      }, Math.max(2500, (15000 - 11000 * k) * (0.55 + Math.random() * 0.9)))
    }
    next()
    return () => clearTimeout(tm)
  }, [on])
  if (lite) return null
  return (
    <div className="fx-heavy pointer-events-none absolute inset-0 z-[5] overflow-hidden" data-weather data-rain={rain.toFixed(2)} data-lightning={lightning.toFixed(2)}>
      {rain > 0.04 && (
        <>
          <div className="absolute inset-0" style={{ background: `rgba(2,6,15,${(0.22 * rain).toFixed(3)})` }} />
          <div className="rain-layer rain-far" style={{ opacity: 0.25 + 0.6 * rain, animationDuration: `${0.62 - 0.2 * w.wind}s` }} />
          {rain > 0.3 && <div className="rain-layer rain-near" style={{ opacity: Math.min(0.85, (rain - 0.3) * 1.3), animationDuration: `${0.42 - 0.14 * w.wind}s` }} />}
        </>
      )}
      {flash && (
        <div key={flash.id} className="absolute inset-0" onAnimationEnd={() => setFlash(null)} style={{ animation: 'lightning .7s ease-out forwards' }} data-lightning-flash>
          <div className="absolute inset-0" style={{ background: `radial-gradient(90% 70% at ${flash.x}% 0%, rgba(226,240,255,.75), rgba(186,230,253,.18) 55%, transparent 80%)` }} />
          {flash.bolt && (
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d={bolt(flash.x, flash.bend)} fill="none" stroke="#f0f9ff" strokeWidth="0.45" strokeLinejoin="bevel" style={{ filter: 'drop-shadow(0 0 1.2px #bae6fd)' }} vectorEffect="non-scaling-stroke" />
            </svg>
          )}
        </div>
      )}
    </div>
  )
}

/** A jagged bolt from the top edge down to about a third of the map. */
function bolt(x, bend) {
  let px = x, py = 0, d = `M${px} ${py}`
  const steps = 7
  for (let i = 1; i <= steps; i++) {
    px += (Math.sin(i * 2.3 + bend * 9) * 3.2) + (bend - 0.5) * 1.6
    py += 34 / steps + (i % 2 ? 1.2 : -0.4)
    d += ` L${px.toFixed(2)} ${py.toFixed(2)}`
  }
  return d
}
