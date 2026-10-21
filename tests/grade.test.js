/* C4 — act grades come from that act's own decisions. */
import { describe, it, expect } from 'vitest'
import { actGrade } from '../src/lib/sim'
import { ACT_GRADES } from '../src/config/missionConfig'
import { careful, idle } from './helpers'

describe('act grades S/A/B/C (C4)', () => {
  it('a careful commander earns top grades; doing nothing earns C; an act not yet over has none', () => {
    const c = careful(11)
    expect(['S', 'A']).toContain(actGrade(c.s, c.scn, 1).id)
    expect(['S', 'A']).toContain(actGrade(c.s, c.scn, 3).id)
    const i = idle(11)
    expect(actGrade(i.s, i.scn, 1).id).toBe('C')
    const early = careful(11, { stopAfter: 1 })
    expect(actGrade({ ...early.s, clock: -60 }, early.scn, 1)).toBeNull()
  })

  it('the grade counts the mistakes of that act (S ≤ 1 · A ≤ 3 · B ≤ 6 · C more)', () => {
    const run = careful(202, { unsafeTrips: 1 })
    if (run.unsafeLeft) return                                    // no hazardous route came up on this seed
    const g = actGrade(run.s, run.scn, 2)
    expect(g.mistakes).toBeGreaterThan(0)
    expect(ACT_GRADES.find((x) => g.mistakes <= x.maxMistakes).id).toBe(g.id)
    expect(['S', 'A']).toContain(g.id)                          // one wrong route is not a disaster
  })
})
