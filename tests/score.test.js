import { describe, it, expect } from 'vitest'
import { careful, idle, step } from './helpers'
import { makeScenario } from '../src/lib/scenario'
import { makeInitial, enterAct2, enterAct3 } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { missionScore, decisionLedger } from '../src/lib/sim'
import { EMBANKMENT_GAPS } from '../src/lib/embankment'
import { DECISION, SCORE } from '../src/config/missionConfig'

describe('score v2 — performance × a multiplier that counts mistakes (at most −30%)', () => {
  it('a careful commander reaches "ดีมาก" (×1.0) with nearly full points', () => {
    for (const seed of [11, 202, 3003, 77]) {
      const { s, scn } = careful(seed)
      const sc = missionScore(s, scn)
      expect(sc.decision.tier.id, `${seed}`).toBe('excellent')
      expect(sc.decision.critical).toBe(0)
      expect(sc.points).toBeGreaterThan(900)
      expect(sc.points).toBeLessThanOrEqual(DECISION.maxPoints)
      // points are shown per part out of their maximum
      for (const [k, w] of Object.entries(SCORE)) expect(sc.max[k]).toBe(Math.round(w * DECISION.maxPoints))
      expect(sc.points).toBe(Math.max(0, Math.round(sc.perf * sc.decision.mult) - sc.hintPts))
    }
  })

  it('doing nothing earns almost nothing — no free logistics or trust', () => {
    for (const seed of [11, 202, 4242]) {
      const sc = missionScore(idle(seed).s, idle(seed).scn)
      expect(sc.partPoints.logistics).toBe(0)
      expect(sc.partPoints.trust).toBe(0)
      expect(sc.partPoints.evac).toBe(0)
      expect(sc.points).toBeLessThan(50)
      expect(sc.decision.tier.id).toBe('poor')
      expect(sc.decision.mult).toBe(0.7)
    }
  })

  it('only the easy parts (base, sandbags, satellite orders, lazy verdicts) scores far below a careful commander', () => {
    for (const seed of [11, 202]) {
      const scn = makeScenario(seed)
      let s = makeInitial('beginner', seed)
      s = A.setCamp(s, scn, 'cmp-amp')
      s = A.sealGaps(s, scn, EMBANKMENT_GAPS.map((g) => g.id))
      for (const p of scn.passes) s = A.setTasking(s, scn, p.id, p.reach.slice(0, 2))
      s = step(s, scn, 0)
      s = enterAct2(s, scn)
      scn.act2Passes.forEach((q) => { s = A.orderPass2(s, scn, q.id) })
      s = step(s, scn, 36 * 60)
      s = enterAct3(s)
      for (const r of scn.roofs) { s = A.adjudicate(s, scn, r.id, 'flat'); if (A.lockVerdict) s = A.lockVerdict(s, scn, r.id) }
      const sc = missionScore(s, scn)
      expect(sc.decision.mistakes).toBeGreaterThanOrEqual(12)
      expect(sc.decision.tier.id).toBe('poor')
      expect(sc.points).toBeLessThan(missionScore(careful(seed).s, careful(seed).scn).points * 0.6)
    }
  })

  it('a hazardous boat route is a mistake (live power = critical) — but never costs more than the multiplier floor', () => {
    for (const seed of [11, 202, 3003, 77, 4242, 5150]) {
      const run = careful(seed, { unsafeTrips: 2 })
      if (run.unsafeLeft) continue                                   // this seed never offered two hazardous routes
      const led = decisionLedger(run.s, run.scn)
      const bad = led.items.filter((x) => x.id.startsWith('route-') && x.verdict !== 'good' && x.verdict !== 'fair')
      expect(bad).toHaveLength(2)
      for (const x of bad) expect(x.verdict).toBe(x.why.includes('ไฟช็อต') ? 'critical' : 'bad')
      expect(missionScore(run.s, run.scn).decision.mult).toBeGreaterThanOrEqual(0.85)
      return
    }
    throw new Error('no seed offered two hazardous routes')
  })

  it('the multiplier follows the mistake count: ≤ 7 ×1.0 · 8–11 ×0.85 · 12+ ×0.7', () => {
    const tierFor = (m) => DECISION.tiers.find((t) => m <= t.maxMistakes)
    expect([0, 7, 8, 11, 12, 40].map((m) => tierFor(m).mult)).toEqual([1, 1, 0.85, 0.85, 0.7, 0.7])
    expect(Math.min(...DECISION.tiers.map((t) => t.mult))).toBe(0.7)
  })

  it('every decision has a verdict and a Thai reason; acts only count once they are over', () => {
    const { s, scn } = careful(11, { stopAfter: 1 })
    const led = decisionLedger(s, scn)
    expect(led.items.length).toBeGreaterThan(10)
    expect(led.items.every((x) => x.act === 1)).toBe(true)
    for (const x of led.items) {
      expect(['good', 'fair', 'bad', 'skip', 'critical']).toContain(x.verdict)
      expect(x.why.length).toBeGreaterThan(3)
    }
    // mid act 1: nothing judged yet
    const fresh = makeInitial('beginner', 11)
    expect(decisionLedger(fresh, scn).items).toHaveLength(0)
  })

  it('repeated false alarms are critical', () => {
    const scn = makeScenario(11)
    let s = makeInitial('beginner', 11)
    s = A.orderZones(s, scn, ['Z1'])
    s = A.orderZones(s, scn, ['Z2'])
    s = A.orderZones(s, scn, ['Z3'])
    s = step(s, scn, 0)
    const fa = decisionLedger(s, scn).items.filter((x) => x.id.startsWith('false-'))
    expect(fa.map((x) => x.verdict)).toEqual(['bad', 'critical', 'critical'])
    expect(decisionLedger(s, scn).mistakes).toBeGreaterThanOrEqual(3)
  })
})
