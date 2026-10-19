/* C3 — the sky follows the scenario model and never tells the player what is coming. */
import { describe, it, expect } from 'vitest'
import { makeScenario } from '../src/lib/scenario'
import { makeInitial, advanceTo, enterAct2, enterAct3 } from '../src/engine/world'
import { weatherAt } from '../src/lib/weather'
import { step } from './helpers'

const SEED = 11
const at = (s, t) => ({ ...s, clock: t })

describe('weather (C3)', () => {
  const scn = makeScenario(SEED, 'beginner')
  const s0 = makeInitial('beginner', SEED)

  it('rain builds through act 1 with the rain gauge; lightning only in the hours around T0', () => {
    const early = weatherAt(at(s0, -47 * 60), scn), mid = weatherAt(at(s0, -20 * 60), scn), late = weatherAt(at(s0, -60), scn)
    expect(early.rain).toBeLessThan(mid.rain)
    expect(mid.rain).toBeLessThan(late.rain)
    expect(early.lightning).toBe(0)
    expect(mid.lightning).toBe(0)
    expect(late.lightning).toBeGreaterThan(0.5)
    for (const w of [early, mid, late]) for (const v of Object.values(w)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1) }
  })

  it('the act-2 storm shows only after it has struck — no warning from the sky', () => {
    let s = step(s0, scn, 0)
    s = enterAct2(s, scn)
    const before = at(s, scn.stormAt - 30)
    expect(before.stormHit).toBe(false)
    const quiet = weatherAt(before, scn)
    // moving the (hidden) storm time changes nothing before it strikes
    expect(weatherAt(before, { ...scn, stormAt: scn.stormAt - 20 })).toEqual(quiet)
    const hit = advanceTo(s, scn, scn.stormAt + 5)
    expect(hit.stormHit).toBe(true)
    const storm = weatherAt(hit, scn)
    expect(storm.lightning).toBeGreaterThan(0.9)
    expect(storm.rain).toBeGreaterThan(0.9)
    // and it passes
    expect(weatherAt(at(hit, scn.stormAt + 300), scn).lightning).toBeLessThan(storm.lightning)
  })

  it('act 3 is dry', () => {
    let s = step(s0, scn, 0)
    s = enterAct3(enterAct2(s, scn))
    expect(weatherAt(s, scn)).toEqual({ rain: 0, lightning: 0, wind: 0 })
  })
})
