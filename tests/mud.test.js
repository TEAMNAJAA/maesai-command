/* B11 — the after image shows mud exactly for the houses that have it; the control room opens once. */
import { describe, it, expect } from 'vitest'
import { makeScenario } from '../src/lib/scenario'
import { RELIEF } from '../src/config/missionConfig'
import { sceneOf } from '../src/engine/useEngine'
import * as A from '../src/engine/actions'
import { idle } from './helpers'

describe('act 3 imagery and the control room (B11)', () => {
  it('mud is drawn if and only if the house really has mud — no faint traces on clean houses', () => {
    for (const seed of [11, 202, 3003, 4242, 7, 99]) {
      const scn = makeScenario(seed, 'beginner')
      for (const r of scn.roofs) expect(r.mudLevel >= RELIEF.mudVisibleLevel).toBe(!!r.mud)       // the physical mud (the grant also needs ≥ 7 days)
    }
  })

  it('the first roof opened in act 3 plays the control-room scene, later ones do not', () => {
    const { s, scn } = idle(11)
    const r1 = A.reviewRoof(s, scn, scn.roofs[0].id)
    expect(sceneOf('review', s, r1, scn)).toMatchObject({ kind: 'control', roof: scn.roofs[0].id })
    const r2 = A.reviewRoof(r1, scn, scn.roofs[1].id)
    expect(sceneOf('review', r1, r2, scn)).toBeNull()
  })
})
