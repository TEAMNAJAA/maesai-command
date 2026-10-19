import { describe, it, expect } from 'vitest'
import { idle } from './helpers'
import * as A from '../src/engine/actions'
import { reliefSummary, missionScore, decisionLedger, evaluateRoof } from '../src/lib/sim'

/** Act 3 with every roof unreviewed. */
const act3 = (seed = 4242) => idle(seed)
const right = (r) => (r.truth.flat ? (r.truth.mud ? 'both' : 'flat') : 'reject')

describe('B10 — relief verdicts cannot be found by trial and error', () => {
  it('drafts do not count: no score, no right/wrong, until a verdict is locked', () => {
    let { s, scn } = act3()
    for (const r of scn.roofs) s = A.adjudicate(s, scn, r.id, right(r))
    expect(reliefSummary(s, scn).done).toBe(0)
    expect(missionScore(s, scn).partPoints.relief).toBe(0)
    expect(decisionLedger(s, scn).items.filter((x) => x.id.startsWith('roof-')).every((x) => x.verdict === 'skip')).toBe(true)
    s = A.lockVerdict(s, scn, scn.roofs[0].id)
    expect(reliefSummary(s, scn).done).toBe(1)
    expect(missionScore(s, scn).partPoints.relief).toBeGreaterThan(0)
  })

  it('a locked verdict cannot be changed', () => {
    let { s, scn } = act3()
    const r = scn.roofs[0]
    s = A.adjudicate(s, scn, r.id, 'flat')
    s = A.lockVerdict(s, scn, r.id)
    const after = A.adjudicate(s, scn, r.id, 'reject')
    expect(after).toBe(s)
    expect(after.adjudged[r.id]).toBe('flat')
    expect(A.lockVerdict(s, scn, r.id)).toBe(s)
  })

  it('lock-all locks only drafted roofs; the reveal opens only when every roof is locked', () => {
    let { s, scn } = act3()
    for (const r of scn.roofs.slice(0, 5)) s = A.adjudicate(s, scn, r.id, 'reject')
    s = A.lockAll(s, scn)
    expect(Object.keys(s.locked)).toHaveLength(5)
    expect(A.revealRelief(s, scn)).toBe(s)
    expect(s.reliefRevealed).toBe(false)
    for (const r of scn.roofs.slice(5)) s = A.adjudicate(s, scn, r.id, 'flat')
    s = A.lockAll(s, scn)
    s = A.revealRelief(s, scn)
    expect(s.reliefRevealed).toBe(true)
    const correct = scn.roofs.filter((r) => evaluateRoof(r, s.adjudged[r.id]) === 'correct').length
    expect(reliefSummary(s, scn).correct).toBe(correct)
  })
})
