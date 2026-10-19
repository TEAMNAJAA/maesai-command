import { describe, it, expect } from 'vitest'
import { makeScenario, TOWN_TARGET } from '../src/lib/scenario'
import { makeInitial, advanceTo, enterAct2, enterAct3, campOf, destOf } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { computeSfvi, missionScore, peakDepth, arrivalAt, evacNeedMin, HARM_M } from '../src/lib/sim'
import { planTrip } from '../src/lib/routes'
import { SECTIONS } from '../src/lib/sections'
import { EMBANKMENT_GAPS } from '../src/lib/embankment'
import { THRESHOLDS } from '../src/config/missionConfig'

const step = (s, scn, to) => { while (s.clock < to) s = advanceTo(s, scn, Math.min(to, s.clock + 15)); return s }

/** A careful player: uses every THEOS-2 pass, reads the images right, orders only wet zones in time, rescues smartly. */
function perfectRun(seed, modeId = 'beginner') {
  const scn = makeScenario(seed, modeId)
  let s = makeInitial(modeId, seed)
  s = A.setCamp(s, scn, 'cmp-amp')
  s = A.sealGaps(s, scn, EMBANKMENT_GAPS.map((g) => g.id))
  for (const pass of scn.passes) {
    const best = [...pass.reach].sort((a, b) => (pass.forecast[a] - pass.forecast[b])
      || ((a === TOWN_TARGET || a === 'D') ? -1 : 1))
    const pick = best.filter((t) => pass.forecast[t] <= 50).slice(0, 2)
    s = A.setTasking(s, scn, pass.id, pick)
    s = step(s, scn, pass.t + 125)
    for (const img of s.images.filter((i) => i.usable && !i.analyzed && i.target !== TOWN_TARGET)) {
      const labels = Object.fromEntries(scn.scenes[img.target].cands.map((c) => [c.id, c.kind === 'scar' ? 'scar' : 'none']))
      s = A.submitAnalysis(s, scn, img.id, labels)
    }
    if (!s.channel.measured && s.images.some((i) => i.usable && ['D', 'E', TOWN_TARGET].includes(i.target))) {
      s = A.submitChannel(s, scn, +(1 - scn.channel.widthM / 150).toFixed(2))
    }
  }
  // order every zone that will be under ≥ 0.5 m, early enough to finish moving people
  const wet = SECTIONS.filter((z) => peakDepth(s, z) >= HARM_M)
  const orderAt = Math.min(...wet.map((z) => arrivalAt(s, z) - evacNeedMin(z))) - 60
  s = step(s, scn, Math.max(s.clock, orderAt))
  s = A.orderZones(s, scn, wet.map((z) => z.id))
  s = step(s, scn, 0)
  s = enterAct2(s, scn)
  scn.act2Passes.forEach((q) => { s = A.orderPass2(s, scn, q.id) })
  for (let t = 0; t < 36 * 60; t += 30) {
    s = step(s, scn, t)
    for (const id of s.hazardsLive) if (!s.powerCut[id]) s = A.cutPower(s, scn, id)
    for (const id of s.commDown) if (!s.towers[id]) s = A.buildTower(s, scn, id)
    for (const id of scn.blindSpots) if (!s.jobs.some((j) => j.kind === 'drone' && j.section === id) && t % 180 === 0) s = A.droneSortie(s, scn, id)
    for (const p of s.points.filter((x) => x.revealed && x.status === 'waiting' && !s.commDown.includes(x.section))) {
      if (!s.boats.some((b) => b.busyUntil <= s.clock)) break
      const enRoute = s.jobs.filter((j) => j.point === p.id && j.kind === 'boatAtPoint').length
      if (enRoute * 10 >= p.left) continue
      const mission = p.type === 'hardship' ? 'supply' : 'rescue'
      const dest = p.injured ? 'hosp' : scn.shelters[0]
      const plan = planTrip(s, scn, campOf(s), p, mission === 'supply' ? null : destOf(dest), s.clock)
      const idx = plan.best ? plan.options.indexOf(plan.best) : -1
      if (idx < 0) { s = A.deployPump(s, scn, p.section); continue }
      s = A.dispatchBoat(s, scn, { pointId: p.id, mission, dest, plan, optionIdx: idx })
    }
  }
  s = step(s, scn, 36 * 60)
  s = enterAct3(s)
  for (const r of scn.roofs) {
    if (r.radarGap || r.theosCloud) s = A.survey(s, scn, r.id)
    s = A.adjudicate(s, scn, r.id, r.truth.flat ? (r.truth.mud ? 'both' : 'flat') : 'reject')
  }
  return { s, scn, score: missionScore(s, scn) }
}

/** A player who never acts. */
function idleRun(seed) {
  const scn = makeScenario(seed)
  let s = makeInitial('beginner', seed)
  s = step(s, scn, 0)
  s = enterAct2(s, scn)
  s = step(s, scn, 36 * 60)
  s = enterAct3(s)
  return { s, scn, score: missionScore(s, scn) }
}

describe('engine', () => {
  it('act-1 passes produce THEOS-2 images 2 h after the pass', () => {
    const scn = makeScenario(5)
    let s = makeInitial('beginner', 5)
    const p1 = scn.passes[0]
    s = A.setTasking(s, scn, p1.id, p1.reach.slice(0, 2))
    s = step(s, scn, p1.t + 1)
    expect(s.images).toHaveLength(2)
    expect(s.images[0].readyAt).toBe(p1.t + 120)
  })

  it('the channel formula is checked against the scenario width', () => {
    const scn = makeScenario(6)
    let s = makeInitial('beginner', 6)
    s.images.push({ id: 'x', target: 'D', usable: true, readyAt: s.clock, labels: {} })
    s = A.submitChannel(s, scn, 0.5)
    expect(s.channel.measured).toBe(false)
    s = A.submitChannel(s, scn, +(1 - scn.channel.widthM / THRESHOLDS.origChannelWidth).toFixed(2))
    expect(s.channel.measured).toBe(true)
    expect(s.channel.attempts).toBe(2)
  })

  it('crews seal gaps over time, not instantly', () => {
    const scn = makeScenario(7)
    let s = makeInitial('beginner', 7)
    s = A.sealGaps(s, scn, EMBANKMENT_GAPS.map((g) => g.id))
    expect(s.sealed).toHaveLength(0)
    s = step(s, scn, s.clock + 24 * 60)
    expect(s.sealed).toHaveLength(EMBANKMENT_GAPS.length)
    expect(s.budget.spent).toBeGreaterThan(0)
  })

  for (const seed of [11, 202, 3003]) {
    it(`a careful player scores far above an idle one (seed ${seed})`, () => {
      const good = perfectRun(seed)
      const idle = idleRun(seed)
      const sf = computeSfvi(good.s, good.scn)
      console.log(`seed ${seed}: perfect ${(good.score.total * 100).toFixed(0)}%`, Object.fromEntries(Object.entries(good.score.parts).map(([k, v]) => [k, +(v * 100).toFixed(0)])),
        'people', good.score.people, 'fuel', good.s.fuel, 'budget', good.s.budget, 'errors', good.s.routeErrors,
        `| idle ${(idle.score.total * 100).toFixed(0)}%`, idle.score.people)
      expect(good.score.points).toBeGreaterThan(750)                 // score v2: points out of 1000
      expect(good.score.decision.critical).toBe(0)
      expect(idle.score.points).toBeLessThan(50)
      expect(idle.score.decision.tier.id).toBe('fail')
      expect(good.s.budget.spent).toBeLessThanOrEqual(good.s.budget.total)
      expect(good.s.fuel.used).toBeLessThanOrEqual(good.s.fuel.total)
      expect(sf.L).toBeGreaterThan(0)
    })
  }
})
