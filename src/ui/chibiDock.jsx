/* ══════════════════════════════════════════════════════════════════════════
   CHIBI DOCK (B12) — the player's chibi in the bottom-left corner of every act
   Lives in its own layout slot (never on top of buttons or data) and poses
   for whatever the player is doing. Hidden in officer mode (F4).
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useState } from 'react'
import { Chibi, POSES } from './chibi'
import { useProfile } from '../lib/profile'
import { fx } from '../lib/fx'

/** What the player just did → pose (kept for a few seconds). */
export const ACTION_POSE = {
  camp: 'clipboard', tasking: 'point', capture: 'point', analysis: 'inspect', channel: 'ruler', seal: 'carry',
  evacuate: 'megaphone', pass2: 'point', drone: 'remote', power: 'switch', tower: 'remote', pump: 'pump',
  boat: 'clipboard', survey: 'inspect', verdict: 'monitor', lock: 'monitor',
}

/**
 * Pose from the situation, most specific first:
 * open tool → time-jump scene → the last action → good/bad news → crisis → act 3 → idle.
 */
export function useChibiPose({ eng, modal, crisis }) {
  const [recent, setRecent] = useState(null)
  useEffect(() => fx.on('action', ({ kind }) => setRecent({ pose: ACTION_POSE[kind] || 'idle', until: Date.now() + 3600 })), [])
  useEffect(() => {
    if (!eng.flash) return
    setRecent({ pose: eng.flash.kind === 'ok' ? 'cheer' : 'shock', until: Date.now() + 2600 })
  }, [eng.flash?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!recent) return undefined
    const t = setTimeout(() => setRecent(null), Math.max(0, recent.until - Date.now()))
    return () => clearTimeout(t)
  }, [recent])
  if (modal === 'analysis') return 'inspect'
  if (modal === 'channel') return 'ruler'
  if (modal === 'planner') return 'clipboard'
  if (eng.cut?.kind === 'theos') return 'point'
  if (recent) return recent.pose
  if (crisis) return 'serious'
  if (eng.s.act === 3) return 'monitor'
  return 'idle'
}

export function ChibiDock({ pose = 'idle', name = '', compact = false }) {
  const me = useProfile()
  const [shown, setShown] = useState(pose)
  const [pop, setPop] = useState(0)
  useEffect(() => { setShown(pose); setPop((n) => n + 1) }, [pose])
  if (compact) {
    return (
      <div className="flex justify-center pb-1" data-chibi-dock="compact" title={POSES[shown]?.say}>
        <Chibi profile={me} pose={shown} size={30} />
      </div>
    )
  }
  return (
    <div className="panel relative flex h-[118px] shrink-0 items-end gap-1 overflow-hidden px-2 pt-1" data-chibi-dock={shown}>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-sky-400/[0.08] to-transparent" />
      <div className="relative -mb-1 shrink-0"><Chibi profile={me} pose={shown} size={78} /></div>
      <div className="mb-3 min-w-0 flex-1">
        <div key={pop} className="font-thai relative rounded-lg rounded-bl-none border border-sky-400/30 bg-[#0b1830] px-2.5 py-1.5 text-[11.5px] font-semibold leading-snug text-sky-100 animate-[riseIn_.25s_ease-out]" data-chibi-say>
          {POSES[shown]?.say}
        </div>
        <div className="font-thai mt-1 truncate pl-1 text-[10.5px] text-slate-500">ผบ. {name || 'ไม่ระบุชื่อ'}</div>
      </div>
    </div>
  )
}
