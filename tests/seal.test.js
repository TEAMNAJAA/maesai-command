/* B4 — four embankment plans, each with a real trade-off. */
import { describe, it, expect } from 'vitest'
import { makeScenario } from '../src/lib/scenario'
import { makeInitial } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { previewSealPlan } from '../src/engine/impact'
import { openGapsOf, sandbagFailAt, peakDepth, arrivalAt, decisionLedger, bigbagSealed, HARM_M } from '../src/lib/sim'
import { bossSetup } from '../src/engine/boss'
import { SECTIONS, GAPS_BY_SECTION } from '../src/lib/sections'
import { EMBANKMENT_GAPS } from '../src/lib/embankment'
import { SANDBAG, COSTS, EMBANKMENT } from '../src/config/missionConfig'
import { careful, step } from './helpers'

const SEED = 11
const scn = makeScenario(SEED, 'beginner')
const start = () => A.setCamp(makeInitial('beginner', SEED), scn, 'cmp-amp')
const finishJobs = (s) => step(s, scn, Math.max(s.clock, ...s.jobs.filter((j) => j.kind === 'seal').map((j) => j.at)) + 10)
const nGaps = EMBANKMENT_GAPS.length
const spent = (a, b) => b.budget.spent - a.budget.spent

describe('embankment plans (B4)', () => {
  it('full = every gap with big bags; risk = only the gaps the evidence points at; none costs nothing', () => {
    const s = start()
    expect(A.sealTargets(s, scn, 'full')).toHaveLength(nGaps)
    const risk = A.sealTargets(s, scn, 'risk')
    expect(risk.length).toBeGreaterThan(0)
    expect(risk.length).toBeLessThan(nGaps)
    const full = A.sealPlan(s, scn, 'full'), part = A.sealPlan(s, scn, 'risk'), none = A.sealPlan(s, scn, 'none')
    expect(spent(s, part)).toBeLessThan(spent(s, full))
    expect(spent(s, none)).toBe(0)
    expect(none.sealPlan).toBe('none')
    expect(none.clock).toBeGreaterThan(s.clock)                              // the decision still takes command time
    const last = (x) => Math.max(...x.jobs.filter((j) => j.kind === 'seal').map((j) => j.at))
    expect(last(part)).toBeLessThan(last(full))                              // fewer gaps → crews finish sooner
  })

  it('sandbags: cheaper and faster, then give way once the river passes their limit', () => {
    const s = start()
    const bag = A.sealPlan(s, scn, 'sandbag'), big = A.sealPlan(s, scn, 'full')
    const bigCost = EMBANKMENT_GAPS.reduce((a, g) => a + g.len * EMBANKMENT.bagsPerMetre * COSTS.bigbag, 0)
    expect(spent(s, big)).toBe(bigCost)
    expect(spent(s, bag)).toBeLessThan(bigCost * SANDBAG.costFactor + nGaps)
    const t = finishJobs(bag)
    expect(t.sandbagged).toHaveLength(nGaps)
    const tf = sandbagFailAt()
    expect(Number.isFinite(tf)).toBe(true)
    const z = SECTIONS.find((x) => GAPS_BY_SECTION[x.id].length)
    expect(openGapsOf(t, z.id, tf - 10)).toBe(0)
    expect(openGapsOf(t, z.id, tf)).toBe(GAPS_BY_SECTION[z.id].length)
    // early water is held back, the crest is not
    const bare = { ...t, sealed: [], sandbagged: [] }
    const wet = SECTIONS.filter((x) => peakDepth(bare, x) >= HARM_M)
    expect(wet.some((x) => arrivalAt(t, x) > arrivalAt(bare, x) || !Number.isFinite(arrivalAt(bare, x)))).toBe(true)
    for (const x of wet) expect(peakDepth(t, x)).toBeCloseTo(peakDepth(bare, x), 5)
    // the night fight counts only what still stands
    expect(bigbagSealed(t)).toHaveLength(0)
    expect(bossSetup(step(t, scn, 0), scn).boss.max).toBeGreaterThan(bossSetup(step(finishJobs(big), scn, 0), scn).boss.max)
  })

  it('sandbags can be upgraded to big bags', () => {
    const t = finishJobs(A.sealPlan(start(), scn, 'sandbag'))
    const u = finishJobs(A.sealPlan(t, scn, 'full'))
    expect(u.sandbagged).toHaveLength(0)
    expect(bigbagSealed(u)).toHaveLength(nGaps)
  })

  it('the moment sandbags give way is an event the clock stops at', () => {
    let t = finishJobs(A.sealPlan(start(), scn, 'sandbag'))
    t = step(t, scn, sandbagFailAt() + 5)
    expect(t.logs.some((l) => l.tag === 'SANDBAG')).toBe(true)
  })

  it('the ledger judges the plan: full / covering every gap that matters = good, sandbags = fair, nothing + poor evacuation = bad', () => {
    const verdict = (s) => decisionLedger(step(s, scn, 0), scn).items.find((x) => x.id === 'seal')
    expect(verdict(finishJobs(A.sealPlan(start(), scn, 'full'))).verdict).toBe('good')
    expect(verdict(finishJobs(A.sealPlan(start(), scn, 'sandbag'))).verdict).toBe('fair')
    expect(verdict(A.sealPlan(start(), scn, 'none')).verdict).toBe('bad')
    // only the gaps in front of zones that flood, all with big bags → good and cheaper
    const s = start()
    const bare = { ...s, sealed: [] }
    const needed = SECTIONS.filter((z) => peakDepth(bare, z) >= HARM_M).flatMap((z) => GAPS_BY_SECTION[z.id])
    if (needed.length < nGaps) {
      const v = verdict(finishJobs(A.sealGaps(s, scn, needed)))
      expect(v.verdict).toBe('good')
    }
  })

  it('the consequence card names the trade-off and changes nothing', () => {
    const s = start()
    const before = JSON.stringify(s)
    const sb = previewSealPlan(s, scn, 'sandbag'), no = previewSealPlan(s, scn, 'none'), rk = previewSealPlan(s, scn, 'risk')
    expect(sb.rows.map((r) => r.th).join(' ')).toMatch(/พัง/)
    expect(no.rows.map((r) => r.th).join(' ')).toMatch(/ประหยัด/)
    expect(rk.rows.map((r) => r.th).join(' ')).toMatch(/ยังเปิด/)
    expect(JSON.stringify(s)).toBe(before)
  })

  it('a careful commander with big bags along the whole line still reaches the top tier', () => {
    const r = careful(SEED)
    expect(decisionLedger(r.s, r.scn).items.find((x) => x.id === 'seal').verdict).toBe('good')
  })
})
