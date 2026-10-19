/* C1 — floating numbers come from real state changes and never judge a decision early. */
import { describe, it, expect } from 'vitest'
import { makeScenario } from '../src/lib/scenario'
import { makeInitial, enterAct2, campOf, destOf } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { planTrip } from '../src/lib/routes'
import { EMBANKMENT_GAPS } from '../src/lib/embankment'
import { SECTIONS } from '../src/lib/sections'
import { DECISION } from '../src/config/missionConfig'
import { floatsFor } from '../src/ui/juice'
import { careful, step } from './helpers'

const SEED = 11
const kinds = (fs) => fs.map((f) => f.kind)

describe('floating numbers (C1)', () => {
  const scn = makeScenario(SEED, 'beginner')
  const s0 = makeInitial('beginner', SEED)

  it('an order floats what it cost and what it did — not whether it was right', () => {
    const s1 = A.setCamp(s0, scn, 'cmp-amp')
    expect(kinds(floatsFor(s0, s1))).toContain('budget')
    const gap = EMBANKMENT_GAPS[0].id
    const s2 = step(A.sealGaps(s1, scn, [gap]), scn, s1.clock + 600)
    const f2 = floatsFor(s1, s2)
    expect(f2.find((f) => f.kind === 'seal')?.at).toBe(`[data-gap="${gap}"]`)
    const z = SECTIONS[0]
    const s3 = A.orderZones(s2, scn, [z.id])
    const evac = floatsFor(s2, s3).find((f) => f.kind === 'evac')
    expect(evac.text).toContain(String(z.households))
    // the text never says good/bad/wrong — judging waits for the end of the act
    for (const f of [...floatsFor(s0, s1), ...f2, ...floatsFor(s2, s3)]) expect(f.text).not.toMatch(/ถูก|ผิด|ดี|พลาด/)
  })

  it('a hint rung costs points on screen, the same amount the score takes', () => {
    const s1 = A.revealHint(s0, scn, 'a1.camp', 2)
    expect(s1).not.toBe(s0)
    const f = floatsFor(s0, s1).find((x) => x.kind === 'hint')
    expect(f.text).toBe(`−${1 * DECISION.hintPoints} คะแนน`)
  })

  it('people brought to safety float on their marker; nothing floats across acts or without a change', () => {
    const { s: a1, scn: sc } = careful(SEED, { stopAfter: 1 })
    let s = enterAct2(a1, sc)
    sc.act2Passes.forEach((q) => { s = A.orderPass2(s, sc, q.id) })
    let found = null
    for (let t = 0; t < 30 * 60 && !found; t += 30) {
      s = step(s, sc, t)
      for (const id of s.hazardsLive) if (!s.powerCut[id]) s = A.cutPower(s, sc, id)
      for (const id of s.commDown) if (!s.towers[id]) s = A.buildTower(s, sc, id)
      const p = s.points.find((x) => x.revealed && x.status === 'waiting' && x.type !== 'hardship' && !s.commDown.includes(x.section))
      if (!p || !s.boats.some((b) => b.busyUntil <= s.clock)) continue
      const plan = planTrip(s, sc, campOf(s), p, destOf(sc.shelters[0]), s.clock)
      if (!plan.best) continue
      const sent = A.dispatchBoat(s, sc, { pointId: p.id, mission: 'rescue', dest: sc.shelters[0], plan, optionIdx: plan.options.indexOf(plan.best) })
      expect(kinds(floatsFor(s, sent))).toEqual(expect.arrayContaining(['budget', 'fuel']))
      const job = sent.jobs.find((j) => j.point === p.id && j.kind === 'boatAtPoint')
      let later = sent
      while (!floatsFor(sent, later).some((f) => f.kind === 'people') && later.clock < job.atDest + 60) later = step(later, sc, later.clock + 15)
      found = floatsFor(sent, later).find((f) => f.kind === 'people')
      expect(found?.at).toBe(`[data-point-marker="${p.id}"]`)
    }
    expect(found).toBeTruthy()
    expect(floatsFor(a1, enterAct2(a1, sc))).toEqual([])
    expect(floatsFor(s, s)).toEqual([])
  })
})
