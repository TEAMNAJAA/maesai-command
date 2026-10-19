/* F4 — officer-training mode is recorded in the session log; the T0 fight resolves without card decisions. */
import { describe, it, expect } from 'vitest'
import { logger } from '../src/lib/evalLogger'
import { resolveBoss } from '../src/engine/boss'
import { decisionLedger } from '../src/lib/sim'
import { careful } from './helpers'

describe('officer-training mode (F4)', () => {
  it('the session log and the sessions CSV carry the mode', () => {
    logger.start({ hintsEnabled: true, officer: true, seed: 11, mode: 'beginner' })
    expect(logger.current.officer).toBe(true)
    logger.meta({ officer: false })
    expect(logger.current.officer).toBe(false)
    expect(logger.sessionsCSV().split('\n')[0]).toContain('officer')
  })

  it('the embankment result comes from the preparation alone — no per-turn decisions', () => {
    const { s, scn } = careful(11, { stopAfter: 1 })
    const r = resolveBoss(s, scn)
    expect(r.boss).toMatchObject({ done: true, fought: false, won: true })
    expect(r.bossLog).toEqual([])
    const items = decisionLedger(r, scn).items
    expect(items.some((x) => x.id.startsWith('boss-'))).toBe(false)
    expect(items.find((x) => x.id === 'boss').verdict).toBe('good')
  })
})
