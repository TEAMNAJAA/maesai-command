import { describe, it, expect } from 'vitest'
import { makeScenario } from '../src/lib/scenario'
import { makeInitial, advanceTo, enterAct2, enterAct3, campOf, destOf } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { planTrip } from '../src/lib/routes'
import { missionScore, exposureSummary, peakDepth, HARM_M } from '../src/lib/sim'
import { SECTIONS } from '../src/lib/sections'
import { bossSetup, bossTurn, bossAdvice } from '../src/engine/boss'
import { whatIf } from '../src/engine/whatif'
import { careful } from './helpers'

/* Engine regressions found in review (Nov 2569): outcomes must not depend on how far one call jumps,
   act results must not be rewritten by a later act, and nobody may vanish from the counts. */

const step = (s, scn, to, d = 10) => { while (s.clock < to) s = advanceTo(s, scn, Math.min(to, s.clock + d)); return s }
const summary = (s) => s.points.map((p) => `${p.id}:${p.status}:${p.rescued}:${p.lost}`).join(' ')

/** Act 2 at T+12 with every known group served and boats shuttling (from the reviewer's repro). */
function midAct2(seed) {
  const { s: s1, scn } = careful(seed, { stopAfter: 1 })
  let s = enterAct2(s1, scn)
  scn.act2Passes.forEach((q) => { s = A.orderPass2(s, scn, q.id) })
  s = step(s, scn, 11 * 60)
  for (const id of s.hazardsLive) if (!s.powerCut[id]) s = A.cutPower(s, scn, id)
  for (const id of s.commDown) if (!s.towers[id]) s = A.buildTower(s, scn, id)
  s = step(s, scn, 12 * 60 - 20)
  s = { ...s, points: s.points.map((p) => (p.status === 'waiting' && !p.revealed ? { ...p, revealed: 'hotline', revealedAt: s.clock } : p)) }
  for (const p of s.points.filter((x) => x.status === 'waiting' && x.deadline > s.clock + 90 && !s.commDown.includes(x.section))) {
    if (!s.boats.some((b) => b.busyUntil <= s.clock)) break
    const mission = p.type === 'hardship' ? 'supply' : 'rescue', dest = p.injured ? 'hosp' : scn.shelters[0]
    const plan = planTrip(s, scn, campOf(s), p, mission === 'supply' ? null : destOf(dest), s.clock)
    if (!plan.best) continue
    s = A.dispatchBoat(s, scn, { pointId: p.id, mission, dest, plan, optionIdx: plan.options.indexOf(plan.best) })
  }
  return { s: step(s, scn, 12 * 60), scn }
}

describe('time steps', () => {
  it('who survives does not depend on how far one call jumps (a skipped cut scene, a slow frame rate)', () => {
    for (const seed of [20, 7]) {
      const { s, scn } = midAct2(seed)
      expect(s.jobs.some((j) => j.kind.startsWith('boat'))).toBe(true)
      const oneJump = advanceTo(s, scn, 36 * 60)
      const tenMin = step(s, scn, 36 * 60, 10)
      const threeMin = step(s, scn, 36 * 60, 3)
      expect(summary(oneJump)).toBe(summary(tenMin))
      expect(summary(threeMin)).toBe(summary(tenMin))
      expect(missionScore(enterAct3(oneJump), scn).points).toBe(missionScore(enterAct3(tenMin), scn).points)
    }
  }, 60000)

  it('a group whose people are all on the boat is not reported lost when the deadline passes in transit', () => {
    let checked = 0
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const scn = makeScenario(seed, 'beginner', [])
      let s = makeInitial('beginner', seed, [])
      s = A.setCamp(s, scn, 'cmp-amp')
      s = step(s, scn, 0, 30)
      s = enterAct2(s, scn)
      const p = s.points.find((x) => x.type === 'critical' && !scn.commDown.includes(x.section))
      if (!p) continue
      s = step(s, scn, 300)
      if (s.points.find((x) => x.id === p.id).status !== 'waiting') continue
      const dest = p.injured ? 'hosp' : scn.shelters[0]
      const plan = planTrip(s, scn, campOf(s), p, destOf(dest), s.clock)
      if (!plan.best) continue
      s = { ...s, points: s.points.map((x) => (x.id === p.id ? { ...x, revealed: 'hotline', revealedAt: s.clock, people: 8, left: 8, injured: 0 } : x)) }
      s = A.dispatchBoat(s, scn, { pointId: p.id, mission: 'rescue', dest, plan, optionIdx: plan.options.indexOf(plan.best) })
      const job = s.jobs.find((j) => j.kind === 'boatAtPoint' && j.point === p.id)
      const dl = Math.round((job.at + job.atDest) / 2)                 // the deadline falls between pickup and landing
      if (!(dl > job.at && dl < job.atDest)) continue
      s = { ...s, points: s.points.map((x) => (x.id === p.id ? { ...x, deadline: dl } : x)) }
      const after = step(s, scn, job.atDest + 30, 5)
      const q = after.points.find((x) => x.id === p.id)
      expect(q.status).toBe('rescued')
      expect(q.rescued).toBe(8)
      expect(q.lost).toBe(0)
      expect(after.logs.some((l) => l.tag === 'CASUALTIES' && l.th.includes(p.id))).toBe(false)
      checked++
      break
    }
    expect(checked).toBe(1)
  }, 60000)

  it('people already on a boat when act 2 ends are landed, not dropped from both counts', () => {
    const { s: s1, scn } = careful(1, { stopAfter: 1 })
    let s = enterAct2(s1, scn)
    s = step(s, scn, 2100)
    const p0 = s.points.find((p) => !scn.commDown.includes(p.section))
    s = { ...s, points: s.points.map((p) => (p.id === p0.id ? { ...p, type: 'critical', status: 'waiting', left: 10, people: 10, lost: 0, rescued: 0, injured: 0, escalated: 1900, deadline: 2400, revealed: 'hotline', revealedAt: 2100 } : p)) }
    for (const id of scn.powerHazards.map((h) => h.id)) s = A.cutPower(s, scn, id)
    s = step(s, scn, 2120)
    const dest = scn.shelters[0]
    const plan = planTrip(s, scn, campOf(s), s.points.find((p) => p.id === p0.id), destOf(dest), s.clock)
    s = A.dispatchBoat(s, scn, { pointId: p0.id, mission: 'rescue', dest, plan, optionIdx: plan.options.indexOf(plan.best) })
    const j = s.jobs.find((x) => x.kind === 'boatAtPoint' && x.point === p0.id)
    expect(j.at).toBeLessThan(36 * 60)
    expect(j.atDest).toBeGreaterThan(36 * 60)                          // picked up before the end, lands after it
    const s3 = enterAct3(step(s, scn, 36 * 60))
    const r = s3.points.find((p) => p.id === p0.id)
    expect(r.rescued + r.lost).toBe(r.people)
    expect(r.rescued).toBe(10)
    expect(r.status).toBe('rescued')
  }, 60000)

  it('every group adds up in act 3: rescued + lost = people (evacuations), across seeds', () => {
    for (const seed of [4242, 11, 202]) {
      const { s } = careful(seed)
      for (const p of s.points.filter((x) => x.type === 'critical')) expect(p.rescued + p.lost).toBe(p.people)
    }
  }, 120000)
})

describe('act results stay as they were', () => {
  it('seal jobs still queued at T0 are cancelled (unstarted ones refunded) — they do not finish in act 2 and rewrite act 1', () => {
    const seed = 3
    const scn = makeScenario(seed, 'beginner', [])
    let s = makeInitial('beginner', seed, [])
    s = A.setCamp(s, scn, 'cmp-amp')
    const wet = SECTIONS.filter((z) => peakDepth(s, z) >= HARM_M).map((z) => z.id)
    s = step(s, scn, -8 * 60)
    s = A.orderZones(s, scn, wet)
    s = step(s, scn, -6 * 60)
    s = A.sealPlan(s, scn, 'full')
    s = step(s, scn, 0)
    const pending = s.jobs.filter((j) => j.kind === 'seal')
    expect(pending.length).toBeGreaterThan(0)                           // the crews could not finish before the crest
    const unstarted = pending.filter((j) => j.start >= 0)
    const exposedT0 = exposureSummary(s, scn).exposed
    const sealedT0 = [...s.sealed].sort()
    let s2 = enterAct2(s, scn)
    expect(s2.jobs.filter((j) => j.kind === 'seal')).toHaveLength(0)
    expect(s2.budget.spent).toBe(s.budget.spent + (s2.boss?.spent || 0) - unstarted.reduce((a, j) => a + j.cost, 0))
    s2 = step(s2, scn, 36 * 60)
    expect([...s2.sealed].sort()).toEqual(sealedT0)
    expect(exposureSummary(s2, scn).exposed).toBe(exposedT0)
  }, 60000)

  it('Stress "data loss": the what-if never suggests the act-2 pass whose image is always lost', () => {
    let hit = 0
    for (const seed of [2, 3]) {
      const { s: s1, scn } = careful(seed, { stopAfter: 1, stress: ['data'] })
      const lostQ = scn.stress.lostQ
      let s = enterAct2(s1, scn)
      scn.act2Passes.filter((q) => q.id !== lostQ).forEach((q) => { s = A.orderPass2(s, scn, q.id) })
      for (let t = 0; t < 36 * 60; t += 30) {                          // a commander who serves every group found
        s = step(s, scn, t)
        for (const id of s.hazardsLive) if (!s.powerCut[id]) s = A.cutPower(s, scn, id)
        for (const id of s.commDown) if (!s.towers[id]) s = A.buildTower(s, scn, id)
        for (const p of s.points.filter((x) => x.revealed && x.status === 'waiting' && !s.commDown.includes(x.section))) {
          if (!s.boats.some((b) => b.busyUntil <= s.clock)) break
          if (s.jobs.filter((j) => j.point === p.id && j.kind === 'boatAtPoint').length * 10 >= p.left) continue
          const mission = p.type === 'hardship' ? 'supply' : 'rescue', dest = p.injured ? 'hosp' : scn.shelters[0]
          const plan = planTrip(s, scn, campOf(s), p, mission === 'supply' ? null : destOf(dest), s.clock)
          if (!plan.best) continue
          s = A.dispatchBoat(s, scn, { pointId: p.id, mission, dest, plan, optionIdx: plan.options.indexOf(plan.best) })
        }
      }
      s = step(s, scn, 36 * 60)
      if (s.points.some((p) => !p.revealed || p.revealedAt > scn.act2Passes.find((q) => q.id === lostQ).t)) hit++
      const w = whatIf(s, scn, 2)
      expect(w.cards.find((c) => c.id === `q-${lostQ}`)).toBeUndefined()
      for (const c of w.cards) expect(`${c.title} ${c.alt}`).not.toContain(`รอบ ${lostQ} `)
    }
    expect(hit).toBeGreaterThan(0)          // the lost pass really could have "found someone earlier"
  }, 120000)
})

describe('crisis night advice (Beginner)', () => {
  it('never depends on moves the player cannot see', () => {
    let turns = 0
    for (const seed of [1, 2, 3, 4]) {
      for (const variant of ['careful', 'risk']) {
        let s, scn
        if (variant === 'careful') ({ s, scn } = careful(seed, { stopAfter: 1 }))
        else { scn = makeScenario(seed, 'beginner', []); s = makeInitial('beginner', seed, []); s = A.setCamp(s, scn, 'cmp-amp'); s = A.sealPlan(s, scn, 'risk'); s = step(s, scn, 0, 15) }
        let b = bossSetup(s, scn)
        while (b.status === 'fight') {
          // the same fight with every move after this one changed: the advice must not move
          const other = { ...b, moves: b.moves.map((m, i) => (i < b.turn ? m : m === 'surge' ? 'rain' : 'surge')) }
          expect(bossAdvice(other).join('+')).toBe(bossAdvice(b).join('+'))
          b = bossTurn(b, bossAdvice(b))
          turns++
        }
      }
    }
    expect(turns).toBeGreaterThan(8)
  }, 120000)
})
