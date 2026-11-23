/* ══════════════════════════════════════════════════════════════════════════
   TITLE HERO — the first thing a player (or a judge) sees.
   THEOS-2 passes north → south (sun-synchronous, descending) over the real upper Sai catchment
   (SRTM relief, AOI-B outline, DEM main stem). Its 10.3 km push-broom swath over Sector C turns the
   night relief into a processed image strip, the river lights up, and the scan line "images" the
   title as it crosses it. One pass when the screen opens; slow clouds and rain after (.fx-heavy).
   Performance mode / reduced motion → the finished frame, no motion.
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useLayoutEffect, useMemo, useRef } from 'react'
import { DATA, THEOS2 } from '../config/missionConfig'
import { SECTORS } from '../config/scenarioData'
import { aoiFeature, aoiRiver } from '../lib/geo'
import { TheosSat } from '../map/Cutscene'

const DEM = DATA.dem.catchment
const IW = DEM.image.width, IH = DEM.image.height
const [WB, SB, EB, NB] = DEM.bbox
const px = ([lon, lat]) => [((lon - WB) / (EB - WB)) * IW, ((NB - lat) / (NB - SB)) * IH]
const pathOf = (pts) => pts.map((p, i) => { const [x, y] = px(p); return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}` }).join('')

const TARGET = SECTORS.find((s) => s.id === 'C')
const KX = 111320 * Math.cos((20.44 * Math.PI) / 180)
const SWATH_W = ((THEOS2.swathKm * 1000) / KX / (EB - WB)) * IW          // 10.3 km in image pixels
const [TX] = px([TARGET.lon, TARGET.lat])                                // the pass is planned over Sector C (mining area)
const SX = TX - SWATH_W / 2
const TOWN_Y = px([99.884, 20.44])[1]                                     // Mae Sai sits just past the east edge

export const SCAN = { delay: 700, dur: 4200 }
const at = (y) => SCAN.delay + SCAN.dur * Math.min(1, Math.max(0, y / IH))   // when the scan line reaches image row y

const CSS = `
@keyframes heroIn    { from { opacity: 0 } to { opacity: 1 } }
@keyframes heroScan  { 0% { transform: translateY(0) ; opacity: 1 } 93% { opacity: 1 } 100% { transform: translateY(${IH}px); opacity: 0 } }
@keyframes heroClip  { from { transform: scaleY(0) } to { transform: scaleY(1) } }
@keyframes heroFlow  { to { stroke-dashoffset: -64 } }
@keyframes heroCloud { from { transform: translateX(-8vw) } to { transform: translateX(8vw) } }
[data-title-hero] svg { animation: heroIn 1.1s ease-out both }
.hero-scan { animation: heroScan ${SCAN.dur}ms linear ${SCAN.delay}ms both }
.hero-clip { transform-box: fill-box; transform-origin: 50% 0; animation: heroClip ${SCAN.dur}ms linear ${SCAN.delay}ms both }
.hero-late { animation: heroIn .8s ease-out ${SCAN.delay + SCAN.dur}ms both }
.hero-flow { stroke-dasharray: 10 22; animation: heroFlow 1.6s linear infinite }
.hero-cloud { position: absolute; border-radius: 50%; background: radial-gradient(closest-side, rgba(203,225,245,.13), rgba(203,225,245,0)); animation: heroCloud 48s ease-in-out infinite alternate }
@keyframes titleScan { from { clip-path: inset(0 0 100% 0) } to { clip-path: inset(0 0 0 0) } }
.title-lit { animation: titleScan .9s linear 1.4s both }
.perf-lite .hero-scan { display: none }
.perf-lite [data-title-hero] svg, .perf-lite .hero-clip, .perf-lite .hero-late, .perf-lite .hero-flow, .perf-lite .title-lit { animation: none !important }
`

/** Full-screen backdrop for the title screen. `titleRef` → the heading whose [data-title-lit] layer the scan reveals. */
export function TitleHero({ titleRef }) {
  const svgRef = useRef(null)
  const outline = useMemo(() => {
    const g = aoiFeature('AOI-B')?.geometry
    return g?.type === 'Polygon' ? `${pathOf(g.coordinates[0])}Z` : ''
  }, [])
  const river = useMemo(() => (aoiRiver ? pathOf(aoiRiver.geometry.coordinates) : ''), [])

  // time the title reveal to the moment the scan line crosses it on this screen
  useLayoutEffect(() => {
    const lit = titleRef?.current?.querySelector('[data-title-lit]')
    const m = svgRef.current?.getScreenCTM?.()
    if (!lit || !m || !m.d) return
    const r = titleRef.current.getBoundingClientRect()
    const y0 = (r.top - m.f) / m.d, y1 = (r.bottom - m.f) / m.d
    lit.style.animation = `titleScan ${Math.max(160, at(y1) - at(y0))}ms linear ${at(y0)}ms both`
  }, [titleRef])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden data-title-hero>
      <style>{CSS}</style>
      <svg ref={svgRef} viewBox={`0 0 ${IW} ${IH}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <clipPath id="hero-swath"><rect className="hero-clip" x={SX} y="0" width={SWATH_W} height={IH} /></clipPath>
          <pattern id="hero-px" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0H4M0 0V4" stroke="#bae6fd" strokeOpacity=".1" strokeWidth=".6" /></pattern>
          <linearGradient id="hero-beam" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="#38bdf8" stopOpacity="0" /><stop offset=".8" stopColor="#38bdf8" stopOpacity=".26" /><stop offset="1" stopColor="#e0f2fe" stopOpacity=".75" />
          </linearGradient>
          <linearGradient id="hero-wide" x1="0" x2="1">
            <stop offset="0" stopColor="#7dd3fc" stopOpacity="0" /><stop offset=".5" stopColor="#7dd3fc" stopOpacity=".3" /><stop offset="1" stopColor="#7dd3fc" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* the catchment at night, before anyone has looked */}
        <image href={DEM.href} width={IW} height={IH} preserveAspectRatio="none" style={{ filter: 'brightness(.42) saturate(.5) contrast(1.12)' }} />
        <rect width={IW} height={IH} fill="#061328" opacity=".5" />
        {outline && <path d={outline} fill="none" stroke="#7dd3fc" strokeOpacity=".3" strokeWidth="1.3" strokeDasharray="7 6" />}
        {river && <path d={river} fill="none" stroke="#38bdf8" strokeOpacity=".32" strokeWidth="1.8" />}
        <g opacity=".5">
          <line x1={SX} y1="0" x2={SX} y2={IH} stroke="#7dd3fc" strokeDasharray="3 7" />
          <line x1={SX + SWATH_W} y1="0" x2={SX + SWATH_W} y2={IH} stroke="#7dd3fc" strokeDasharray="3 7" />
        </g>

        {/* what THEOS-2 has imaged so far */}
        <g clipPath="url(#hero-swath)">
          <image href={DEM.href} width={IW} height={IH} preserveAspectRatio="none" style={{ filter: 'contrast(1.18) saturate(.9) brightness(.92)' }} />
          <rect x={SX} width={SWATH_W} height={IH} fill="#0c4a6e" opacity=".18" />
          <rect x={SX} width={SWATH_W} height={IH} fill="url(#hero-px)" />
          {river && <path d={river} fill="none" stroke="#0ea5e9" strokeOpacity=".4" strokeWidth="8" strokeLinecap="round" />}
          {river && <path d={river} fill="none" stroke="#f0f9ff" strokeWidth="2.4" />}
          {river && <path d={river} fill="none" stroke="#38bdf8" strokeWidth="2.4" className="hero-flow fx-heavy" />}
        </g>

        {/* Mae Sai, where this water is going */}
        <g className="hero-late">
          <circle cx={IW - 12} cy={TOWN_Y} r="7" fill="#FF3B5C" />
          <circle cx={IW - 12} cy={TOWN_Y} r="7" fill="none" stroke="#FF3B5C" strokeWidth="2" className="sos-ring fx-heavy" />
          <text x={IW - 28} y={TOWN_Y + 5} textAnchor="end" fill="#FFB3C1" fontSize="16" fontWeight="700" className="font-thai">น้ำไหลลงสู่ อ.แม่สาย</text>
        </g>

        {/* the push-broom line and the satellite */}
        <g className="hero-scan">
          <rect x="0" y="-1" width={IW} height="2" fill="url(#hero-wide)" />
          <rect x={SX} y="-54" width={SWATH_W} height="54" fill="url(#hero-beam)" />
          <rect x={SX - 6} y="-1.6" width={SWATH_W + 12} height="3.2" fill="#f0f9ff" />
          <TheosSat x={TX} y={-58} s={0.95} rec />
          <text x={SX + SWATH_W + 14} y="5" fill="#bae6fd" fontSize="13" className="font-mono" letterSpacing="1.5">THEOS-2 · Sector C · Pan 0.5 m · 10.3 km</text>
        </g>
      </svg>

      <div className="fx-heavy">
        <div className="hero-cloud" style={{ left: '-10%', top: '6%', width: '62vw', height: '34vh' }} />
        <div className="hero-cloud" style={{ left: '46%', top: '-6%', width: '58vw', height: '30vh', animationDuration: '62s', animationDelay: '-20s' }} />
        <div className="hero-cloud" style={{ left: '20%', top: '30%', width: '48vw', height: '26vh', animationDuration: '55s', animationDelay: '-9s' }} />
        <div className="rain-layer rain-far" style={{ opacity: 0.22, animationDuration: '1.15s' }} />
        <div className="rain-layer rain-near" style={{ opacity: 0.16, animationDuration: '0.8s' }} />
      </div>
      {/* the controls sit on calm, dark ground; the pass stays visible above them */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(3,6,14,.16) 0%, rgba(3,6,14,.06) 22%, rgba(3,6,14,.3) 34%, rgba(3,6,14,.84) 44%, rgba(3,6,14,.95) 60%, rgba(3,6,14,.97) 100%)' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(130% 100% at 50% 30%, transparent 55%, rgba(2,4,10,.7) 100%)' }} />
    </div>
  )
}
