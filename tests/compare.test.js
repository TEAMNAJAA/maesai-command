import { describe, it, expect } from 'vitest'
import { pairedT, ibeta, roundPairs, compareSummary, previousRound, pairsCSV, sessionMetrics } from '../src/lib/compare'
import { makeScenario } from '../src/lib/scenario'
import { makeInitial, advanceTo, enterAct2, enterAct3 } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { logger } from '../src/lib/evalLogger'

const m = (score, extra = {}) => ({ score, falseAlarms: 1, savedPct: 60, routeErrors: 2, reliefPct: 50, layersFirst: 2, missed: 10, hints: 4, realSec: 800, seed: 1, stress: [], ...extra })
const sess = (id, player, startedAt, metrics, demo = false) => ({ id, player, startedAt, demo, result: metrics ? { metrics } : null })

describe('round 1 vs round 2', () => {
  it('incomplete beta and the paired t-test match reference values', () => {
    expect(ibeta(0.5, 1, 1)).toBeCloseTo(0.5, 10)
    expect(ibeta(0.3, 1, 1)).toBeCloseTo(0.3, 10)
    expect(ibeta(0.5, 2, 2)).toBeCloseTo(0.5, 10)
    // scipy.stats.ttest_1samp([2,4,6,8], 0) → t = 3.8730, p = 0.03047
    const r = pairedT([2, 4, 6, 8])
    expect(r.df).toBe(3)
    expect(r.t).toBeCloseTo(3.873, 3)
    expect(r.p).toBeCloseTo(0.03047, 4)
    // [5,-2,9,3,7,1,4,6] → t = 3.3506, p = 0.01224 (reference: numerical integration of the t density)
    const q = pairedT([5, -2, 9, 3, 7, 1, 4, 6])
    expect(q.t).toBeCloseTo(3.3506, 3)
    expect(q.p).toBeCloseTo(0.01224, 4)
    expect(pairedT([3]).p).toBeNull()
  })

  it('pairs each player’s first two finished rounds by name, skips demo / unfinished runs, flags a repeated seed', () => {
    const list = [
      sess('a2', 'ม.6/2 ', '2026-10-19T10:30:00Z', m(80, { seed: 7, falseAlarms: 0, hints: 1, realSec: 500 })),
      sess('a1', 'ม.6/2', '2026-10-19T10:00:00Z', m(60, { seed: 5 })),
      sess('a3', 'ม.6/2', '2026-10-19T11:00:00Z', m(90, { seed: 9 })),
      sess('b1', 'ข้าว', '2026-10-19T10:00:00Z', m(50, { seed: 3 })),
      sess('b2', 'ข้าว', '2026-10-19T10:20:00Z', m(45, { seed: 3 })),
      sess('c1', 'โชว์', '2026-10-19T10:00:00Z', m(70), true),
      sess('c2', 'โชว์', '2026-10-19T10:10:00Z', m(99), true),
      sess('d1', 'ไม่จบ', '2026-10-19T10:00:00Z', m(40)),
      sess('d2', 'ไม่จบ', '2026-10-19T10:10:00Z', null),
    ]
    const pairs = roundPairs(list)
    expect(pairs.map((p) => p.player.trim()).sort()).toEqual(['ข้าว', 'ม.6/2'])
    const a = pairs.find((p) => p.player.trim() === 'ม.6/2')
    expect(a.r1.id).toBe('a1'); expect(a.r2.id).toBe('a2'); expect(a.rounds).toBe(3)
    expect(a.delta).toMatchObject({ score: 20, falseAlarms: -1, hints: -3, realSec: -300 })
    expect(a.trend).toEqual([60, 80, 90])
    expect(a.sameSeed).toBe(false)
    expect(pairs.find((p) => p.player === 'ข้าว').sameSeed).toBe(true)
    const sum = compareSummary(pairs)
    expect(sum.n).toBe(2); expect(sum.improved).toBe(1); expect(sum.sameSeed).toBe(1)
    const score = sum.rows.find((r) => r.k === 'score')
    expect(score.r1).toBe(55); expect(score.r2).toBe(62.5); expect(score.improved).toBe(true); expect(score.better).toBe(1)
    const fa = sum.rows.find((r) => r.k === 'falseAlarms')
    expect(fa.better).toBe(-1)                                                // lower is better …
    expect(fa.improved).toBe(true)                                            // … and 1 → 0.5 moved that way
    expect(pairsCSV(pairs).split('\n')).toHaveLength(3)
    expect(previousRound(list, 'ม.6/2', 'a3').id).toBe('a2')
    expect(previousRound(list, 'ใครก็ไม่รู้', 'x')).toBeNull()
  })

  it('a finished run yields numeric metrics for the log', () => {
    const scn = makeScenario(4242)
    let s = makeInitial('beginner', 4242)
    while (s.clock < 0) s = advanceTo(s, scn, Math.min(0, s.clock + 60))
    s = enterAct2(s, scn)
    while (s.clock < 36 * 60) s = advanceTo(s, scn, Math.min(36 * 60, s.clock + 60))
    s = enterAct3(s)
    for (const r of scn.roofs) s = A.adjudicate(s, scn, r.id, 'reject')
    const met = sessionMetrics(s, scn, 512.4)
    for (const k of ['score', 'falseAlarms', 'savedPct', 'routeErrors', 'reliefPct', 'layersFirst', 'hints', 'missed']) expect(Number.isFinite(met[k]), k).toBe(true)
    expect(met.realSec).toBe(512)
    expect(met.seed).toBe(4242)
    expect(met.missed).toBeGreaterThan(0)
  })

  it('the post-test does not wipe the round metrics', () => {
    logger.start({ hintsEnabled: true })
    logger.setPlayer('ทดสอบ')
    logger.finish({ score: 77, metrics: m(77) })
    logger.finish({ score: 77, post: 4 })
    expect(logger.current.result.metrics.score).toBe(77)
    expect(logger.current.result.post).toBe(4)
  })
})
