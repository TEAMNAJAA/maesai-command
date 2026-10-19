import { describe, it, expect } from 'vitest'
import { makeScenario } from '../src/lib/scenario'
import { makeInitial, advanceTo, enterAct2, enterAct3 } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { whatIf } from '../src/engine/whatif'
import { zoneOutcome, exposureSummary, peakDepth, arrivalAt, evacNeedMin, evaluateRoof, HARM_M } from '../src/lib/sim'
import { clearSections } from '../src/lib/clouds'
import { SECTIONS, SECTION_BY_ID } from '../src/lib/sections'
import { EMBANKMENT_GAPS } from '../src/lib/embankment'
import { COSTS, TRUST, RELIEF } from '../src/config/missionConfig'

const SEEDS = [4242, 11, 202, 3003, 77]
const step = (s, scn, to) => { while (s.clock < to) s = advanceTo(s, scn, Math.min(to, s.clock + 15)); return s }
const start = (seed) => ({ scn: makeScenario(seed), s: makeInitial('beginner', seed) })
const wet = (s) => SECTIONS.filter((z) => peakDepth(s, z) >= HARM_M)

describe('what-if debrief', () => {
  it('act 1, nothing ordered: one card per flooded zone, and applying the alternative really saves that many households', () => {
    for (const seed of SEEDS) {
      let { s, scn } = start(seed)
      s = A.setCamp(s, scn, 'cmp-amp')
      s = step(s, scn, 0)
      const before = JSON.stringify(s)
      const w = whatIf(s, scn, 1)
      expect(JSON.stringify(s)).toBe(before)                         // pure
      for (const z of wet(s)) {
        const c = w.cards.find((x) => x.id === `evac-${z.id}`)
        expect(c, `${seed} ${z.id}`).toBeTruthy()
        const altT = Math.max(-48 * 60, Math.round(arrivalAt(s, z) - evacNeedMin(z)))
        const gain = zoneOutcome(s, scn, z, altT).safe - zoneOutcome(s, scn, z, null).safe
        expect(c.sum.hh).toBe(gain)
        expect(c.delta.v).toBe(`+${gain.toLocaleString('en-US')}`)
      }
      // sorted by impact
      for (let i = 1; i < w.cards.length; i++) expect(w.cards[i - 1].weight).toBeGreaterThanOrEqual(w.cards[i].weight)
    }
  })

  it('act 1, a careful commander gets no evacuation cards and is told what went well', () => {
    for (const seed of SEEDS) {
      let { s, scn } = start(seed)
      s = A.setCamp(s, scn, 'cmp-amp')
      s = A.sealGaps(s, scn, EMBANKMENT_GAPS.map((g) => g.id))
      const z = wet(s)
      const at = Math.min(...z.map((x) => arrivalAt(s, x) - evacNeedMin(x))) - 60
      s = step(s, scn, Math.max(s.clock, at))
      s = A.orderZones(s, scn, z.map((x) => x.id))
      s = step(s, scn, 0)
      const w = whatIf(s, scn, 1)
      expect(w.cards.filter((c) => c.id.startsWith('evac-'))).toHaveLength(0)
      expect(w.cards.find((c) => c.id === 'seal')).toBeUndefined()
      expect(w.good.join(' ')).toMatch(/อุดจุดฟันหลอครบ/)
    }
  })

  it('a zone the water never reaches costs exactly its evacuation budget; a false alarm gives back its trust penalty', () => {
    for (const seed of SEEDS) {
      let { s, scn } = start(seed)
      const dry = SECTIONS.find((z) => peakDepth(s, z) < HARM_M)
      if (!dry) continue
      s = A.orderZones(s, scn, [dry.id])                              // T−48: no evidence → false alarm too
      s = step(s, scn, 0)
      const w = whatIf(s, scn, 1)
      const waste = w.cards.find((c) => c.id === `waste-${dry.id}`)
      expect(waste.sum.baht).toBe(COSTS.evacBase + COSTS.evacPerHH * dry.floodHH)
      const fa = w.cards.find((c) => c.id === 'false-alarm')
      expect(fa.delta.v).toBe(`+${TRUST.falseAlarmPenalties[0]}%`)
      return
    }
    throw new Error('no seed with a dry zone')
  })

  it('act 2: every lost person is accounted for by a card, and a skipped pass names who it would have found', () => {
    for (const seed of SEEDS.slice(0, 3)) {
      let { s, scn } = start(seed)
      s = A.setCamp(s, scn, 'cmp-amp'); s = step(s, scn, 0); s = enterAct2(s, scn)
      s = step(s, scn, 36 * 60)                                       // idle commander: no passes, no boats
      const w = whatIf(s, scn, 2)
      const lost = s.points.reduce((a, p) => a + p.lost + (p.status === 'waiting' && p.type === 'critical' ? p.left : 0), 0)
      const counted = w.cards.filter((c) => c.id.startsWith('lost-')).reduce((a, c) => a + c.sum.people, 0)
      expect(counted).toBe(lost)
      for (const c of w.cards.filter((x) => x.id.startsWith('q-'))) {
        const q = scn.act2Passes.find((x) => `q-${x.id}` === c.id)
        const clear = clearSections(scn, q.t)
        for (const id of c.alt.match(/Z\d+-\d+/g) || []) expect(clear).toContain(id.split('-')[0])
      }
      // the act-3 view of the same run agrees (enterAct3 books the waiting as lost)
      const w3 = whatIf(enterAct3(s), scn, 2)
      expect(w3.cards.filter((c) => c.id.startsWith('lost-')).reduce((a, c) => a + c.sum.people, 0)).toBe(lost)
    }
  })

  it('act 3: one card per wrong verdict with the exact money difference', () => {
    let { s, scn } = start(4242)
    s = A.setCamp(s, scn, 'cmp-amp'); s = step(s, scn, 0); s = enterAct2(s, scn); s = step(s, scn, 36 * 60); s = enterAct3(s)
    for (const r of scn.roofs) s = A.adjudicate(s, scn, r.id, 'flat')
    expect(whatIf(s, scn, 3).cards.filter((c) => c.id.startsWith('roof-'))).toHaveLength(0)   // drafts are not decisions yet
    s = A.lockAll(s, scn)
    const w = whatIf(s, scn, 3)
    const wrong = scn.roofs.filter((r) => evaluateRoof(r, 'flat') !== 'correct')
    expect(w.cards.filter((c) => c.id.startsWith('roof-'))).toHaveLength(wrong.length)
    for (const r of wrong) {
      const right = r.truth.mud ? RELIEF.flatGrant + RELIEF.mudGrant : r.truth.flat ? RELIEF.flatGrant : 0
      expect(w.cards.find((c) => c.id === `roof-${r.id}`).sum.baht).toBe(Math.abs(RELIEF.flatGrant - right))
    }
  })

  it('opening the act-1 debrief does not change the score or the state', () => {
    let { s, scn } = start(11)
    s = step(s, scn, 0)
    const a = exposureSummary(s, scn).exposed
    whatIf(s, scn, 1); whatIf(s, scn, 1)
    expect(exposureSummary(s, scn).exposed).toBe(a)
    expect(SECTION_BY_ID.Z1).toBeTruthy()
  })
})
