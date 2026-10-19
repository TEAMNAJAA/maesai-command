import { describe, it, expect } from 'vitest'
import { makeScenario } from '../src/lib/scenario'
import { makeInitial, advanceTo, enterAct2, enterAct3 } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { ladder, rungOf, maxRungFor, HINT_TOPICS } from '../src/engine/hints'
import { computeSfvi, hintPenalty, missionScore, peakDepth, HARM_M } from '../src/lib/sim'
import { SECTIONS } from '../src/lib/sections'
import { CAMP_SITES } from '../src/config/scenarioData'
import { HINTS, SFVI, THRESHOLDS } from '../src/config/missionConfig'
import { firstCrossing } from '../src/lib/hydro'
import { questFor } from '../src/panels/quest'
import { logger } from '../src/lib/evalLogger'

const SEEDS = [4242, 11, 202, 3003, 77]
const step = (s, scn, to) => { while (s.clock < to) s = advanceTo(s, scn, Math.min(to, s.clock + 15)); return s }
const start = (seed, mode = 'beginner') => ({ scn: makeScenario(seed, mode), s: makeInitial(mode, seed) })
const ctx = (s, scn, extra = {}) => ({ s, scn, sfvi: computeSfvi(s, scn), ...extra })
const act2 = (seed) => { let { s, scn } = start(seed); s = A.setCamp(s, scn, 'cmp-amp'); s = step(s, scn, 0); s = enterAct2(s, scn); return { s, scn } }

describe('hint ladder', () => {
  it('opens one rung at a time, never past the act limit, and never in Expert', () => {
    let { s, scn } = start(4242)
    expect(rungOf(s, 'a1.evac')).toBe(1)
    expect(A.revealHint(s, scn, 'a1.evac', 3)).toBe(s)                 // cannot skip rung 2
    s = A.revealHint(s, scn, 'a1.evac', 2)
    expect(rungOf(s, 'a1.evac')).toBe(2)
    expect(A.revealHint(s, scn, 'a1.evac', 2)).toBe(s)                 // already open — no second charge
    s = A.revealHint(s, scn, 'a1.evac', 3)
    expect(rungOf(s, 'a1.evac')).toBe(3)
    expect(A.revealHint(s, scn, 'a1.evac', 4)).toBe(s)

    const b = act2(4242)
    expect(maxRungFor(b.s)).toBe(HINTS.maxRung[2])
    let s2 = A.revealHint(b.s, b.scn, 'a2.route', 2)
    expect(rungOf(s2, 'a2.route')).toBe(2)
    expect(A.revealHint(s2, b.scn, 'a2.route', 3)).toBe(s2)             // act 2 stops at "point to the data"

    const s3 = enterAct3(s2)
    expect(maxRungFor(s3)).toBe(HINTS.maxRung[3])
    expect(A.revealHint(s3, b.scn, 'a3.relief', 2)).toBe(s3)            // act 3: the question only

    const x = start(4242, 'expert')
    expect(maxRungFor(x.s)).toBe(0)
    expect(A.revealHint(x.s, x.scn, 'a1.evac', 2)).toBe(x.s)
  })

  it('costs score once per rung per topic, capped, and the mission score shows it', () => {
    let { s, scn } = start(4242)
    expect(hintPenalty(s).pts).toBe(0)
    s = A.revealHint(s, scn, 'a1.evac', 2)
    expect(hintPenalty(s)).toMatchObject({ pts: HINTS.cost[2], pointer: 1, partial: 0 })
    s = A.revealHint(s, scn, 'a1.evac', 3)
    expect(hintPenalty(s)).toMatchObject({ pts: HINTS.cost[2] + HINTS.cost[3], pointer: 1, partial: 1 })
    for (const t of ['a1.camp', 'a1.task', 'a1.read', 'a1.channel', 'a1.seal']) { s = A.revealHint(s, scn, t, 2); s = A.revealHint(s, scn, t, 3) }
    const p = hintPenalty(s)
    expect(p.raw).toBe(6 * (HINTS.cost[2] + HINTS.cost[3]))
    expect(p.pts).toBe(Math.min(HINTS.maxPenalty, p.raw))
    const sc = missionScore(s, scn)
    expect(sc.total).toBeCloseTo(Math.max(0, sc.base - p.pts / 100), 10)
  })

  it('every topic has three rungs with text, in the act where it is used', () => {
    for (const seed of SEEDS) {
      const a1 = start(seed)
      const a2 = act2(seed)
      const a3 = { s: enterAct3(a2.s), scn: a2.scn }
      for (const topic of HINT_TOPICS) {
        const at = topic.startsWith('a1') ? a1 : topic.startsWith('a2') ? a2 : a3
        const extra = topic === 'a3.relief' ? { roof: at.scn.roofs[0] } : {}
        const L = ladder(topic, ctx(at.s, at.scn, extra))
        expect(L.title, topic).toBeTruthy()
        for (const r of [1, 2, 3]) expect(L.rungs[r]?.th, `${topic} rung ${r}`).toBeTruthy()
        expect(L.open).toBe(1)
      }
    }
  })

  it('rung 1 asks — it never names the zones, the camp or the cloud numbers', () => {
    for (const seed of SEEDS) {
      let { s, scn } = start(seed)
      for (const t of ['a1.camp', 'a1.task', 'a1.evac', 'a1.seal']) {
        const q = ladder(t, ctx(s, scn)).rungs[1].th
        expect(q, t).not.toMatch(/Z\d+/)
        expect(q, t).not.toMatch(/\d+%/)
        for (const c of CAMP_SITES) expect(q, t).not.toContain(c.th)
      }
      s = step(s, scn, -6 * 60)
      expect(ladder('a1.evac', ctx(s, scn)).rungs[1].th).not.toMatch(/Z\d+/)
    }
  })

  it('evacuation rung 3 names exactly the zones the rules allow at that moment', () => {
    for (const seed of SEEDS) {
      let { s, scn } = start(seed)
      // before the gauge: zones with SFVI ≥ band (or none yet)
      let sf = computeSfvi(s, scn)
      let part = ladder('a1.evac', ctx(s, scn)).rungs[3].th
      const hot = sf.perSection.filter((z) => z.score >= SFVI.decisionBand).map((z) => z.id)
      if (hot.length) for (const id of hot) expect(part).toContain(id)
      else expect(part).toMatch(/ยังไม่มีโซนที่หลักฐานพอ/)
      // gauge reached: every wet zone not yet ordered, nothing else
      s = step(s, scn, Math.min(-30, firstCrossing(THRESHOLDS.criticalLevel, s.clock, 0)))
      sf = computeSfvi(s, scn)
      part = ladder('a1.evac', ctx(s, scn)).rungs[3].th
      const wet = SECTIONS.filter((z) => peakDepth(s, z) >= HARM_M).map((z) => z.id)
      const listed = (part.split(':').pop().match(/Z\d+/g) || [])
      expect(new Set(listed)).toEqual(new Set(wet))
    }
  })

  it('image rung 3 gives the count of new scars, camp rung 3 the camps that really flood', () => {
    let { s, scn } = start(4242)
    const pass = scn.passes[0]
    const tg = pass.reach.filter((t) => t !== 'TOWN').sort((a, b) => pass.forecast[a] - pass.forecast[b])[0]
    s = A.setTasking(s, scn, pass.id, [tg])
    s = step(s, scn, pass.t + 125)
    const img = s.images.find((i) => i.usable)
    if (img) expect(ladder('a1.read', ctx(s, scn, { imageId: img.id })).rungs[3].th).toContain(`${scn.scenes[img.target].scars} จุด`)

    for (const seed of SEEDS.slice(0, 3)) {
      const b = start(seed)
      const part = ladder('a1.camp', ctx(b.s, b.scn)).rungs[3].th
      for (const c of CAMP_SITES) {
        let n = A.setCamp(b.s, b.scn, c.id); n = step(n, b.scn, 0); n = enterAct2(n, b.scn)
        expect(part.includes(c.th), `${seed} ${c.id}`).toBe(n.campFlooded)
      }
    }
  })

  it('the tutor bar points at a topic instead of listing the answer', () => {
    let { s, scn } = start(4242)
    s = A.setCamp(s, scn, 'cmp-amp')
    s = A.sealGaps(s, scn, ['x'])   // no-op, keep the gaps open
    for (const p of scn.passes) s = step(s, scn, p.t + 130)
    const q = questFor({ s, scn, sfvi: computeSfvi(s, scn) })
    expect(q.hint.topic).toBeTruthy()
    expect(`${q.hint.lead || ''}${q.hint.text || ''}`).not.toMatch(/Z\d+/)
  })

  it('hint requests are logged per session and exported', () => {
    logger.start({ hintsEnabled: true })
    logger.hint({ topic: 'a1.evac', rung: 2, act: 1, clock: -600 })
    logger.hint({ topic: 'a1.evac', rung: 3, act: 1, clock: -590 })
    logger.hint({ topic: 'a1.read', rung: 2, act: 1, clock: -500 })
    expect(logger.current.hints).toHaveLength(3)
    const rows = logger.hintsCSV().trim().split('\n')
    expect(rows.length).toBeGreaterThanOrEqual(4)
    const sess = logger.sessionsCSV().trim().split('\n')
    const head = sess[0].split(','), last = sess[sess.length - 1].split(',')
    const col = (k) => last[head.indexOf(`"${k}"`)].replace(/"/g, '')
    expect(col('hints_pointer')).toBe('2')
    expect(col('hints_partial')).toBe('1')
    expect(Number(col('hint_penalty_pts'))).toBe(2 * HINTS.cost[2] + HINTS.cost[3])
  })
})
