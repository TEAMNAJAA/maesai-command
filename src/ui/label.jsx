/* ══════════════════════════════════════════════════════════════════════════
   MODE-AWARE LABELS — Beginner: plain Thai + (technical term) on two lines,
   with a tooltip saying what it is for · Expert: the technical term only.
   ══════════════════════════════════════════════════════════════════════════ */

import React, { createContext, useContext } from 'react'
import { MODES } from '../config/missionConfig'

export const ModeContext = createContext(MODES.beginner)
export const useMode = () => useContext(ModeContext)

/** <Lbl th="สั่งถ่ายภาพ" tech="Satellite Tasking" what="ใช้ทำอะไร" /> */
export function Lbl({ th, tech, what, className = '', thClass = '', techClass = '' }) {
  const mode = useMode()
  if (mode.labels === 'tech') {
    return <span className={`leading-tight ${className}`} title={[th, what].filter(Boolean).join(' — ')}>{tech}</span>
  }
  return (
    <span className={`inline-flex flex-col leading-tight ${className}`} title={what}>
      <span className={`font-thai ${thClass}`}>{th}</span>
      {tech && <span className={`text-[0.78em] font-normal opacity-70 ${techClass}`}>({tech})</span>}
    </span>
  )
}

/** One-line variant for tight spots: "ไทย (Tech)" in beginner, "Tech" in expert. */
export function lbl(mode, th, tech) {
  return mode.labels === 'tech' ? tech : `${th}${tech ? ` (${tech})` : ''}`
}
