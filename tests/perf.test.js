/* D5 — performance mode only changes how much moves on screen, never the game. */
import { describe, it, expect, afterEach } from 'vitest'
import { prefs } from '../src/lib/prefs'
import { perfState } from '../src/lib/perf'
import { careful } from './helpers'
import { missionScore } from '../src/lib/sim'

describe('performance mode (D5)', () => {
  afterEach(() => prefs.set({ perf: 'auto' }))

  it('manual on / off and auto', () => {
    prefs.set({ perf: 'on' })
    expect(perfState()).toMatchObject({ mode: 'on', lite: true, reason: 'manual' })
    prefs.set({ perf: 'off' })
    expect(perfState()).toMatchObject({ mode: 'off', lite: false, reason: null })
    prefs.set({ perf: 'auto' })
    expect(perfState()).toMatchObject({ mode: 'auto', lite: false })      // no slow frames measured, no reduced-motion request
  })

  it('the same decisions score the same with or without it', () => {
    prefs.set({ perf: 'off' })
    const a = careful(202)
    prefs.set({ perf: 'on' })
    const b = careful(202)
    expect(missionScore(b.s, b.scn).points).toBe(missionScore(a.s, a.scn).points)
  })
})
