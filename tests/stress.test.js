import { describe, it, expect } from 'vitest'
import { makeScenario, TOWN_TARGET } from '../src/lib/scenario'
import { makeInitial, advanceTo, enterAct2, enterAct3, campOf, destOf } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { missionScore, peakDepth, arrivalAt, evacNeedMin, makePoints, HARM_M } from '../src/lib/sim'
import { cloudCover } from '../src/lib/clouds'
import { planTrip } from '../src/lib/routes'
import { SECTIONS } from '../src/lib/sections'
import { EMBANKMENT_GAPS } from '../src/lib/embankment'
import { STRESS, CMD_MIN, parseStress } from '../src/config/missionConfig'

const SEEDS = [4242, 11, 202]
const step = (s, scn, to) => { while (s.clock < to) s = advanceTo(s, scn, Math.min(to, s.clock + 15)); return s }
const strip = (scn) => { const { stress, ...rest } = scn; return JSON.stringify(rest) }

describe('Stress Test', () => {
  it('parses the URL form', () => {
    expect(parseStress('all')).toEqual(['data', 'roads', 'time'])
    expect(parseStress('time,data,bogus')).toEqual(['time', 'data'])
    expect(parseStress(null)).toEqual([])
  })

  it('no stress = exactly the normal scenario; conditions never reshuffle the rest', () => {
    for (const seed of SEEDS) {
      const base = makeScenario(seed, 'beginner')
      expect(strip(makeScenario(seed, 'beginner', []))).toBe(strip(base))
      expect(base.stress.list).toEqual([])
      const all = makeScenario(seed, 'beginner', ['data', 'roads', 'time'])
      expect(JSON.stringify(all.scenes)).toBe(JSON.stringify(base.scenes))
      expect(JSON.stringify(all.passes)).toBe(JSON.stringify(base.passes))
      expect(all.channel).toEqual(base.channel)
      expect(all.blindSpots).toEqual(base.blindSpots)
    }
  })

  it('data loss: one act-1 pass and one act-2 pass deliver nothing, thicker cloud, later calls, more radar gaps', () => {
    for (const seed of SEEDS) {
      const base = makeScenario(seed, 'beginner')
      const scn = makeScenario(seed, 'beginner', ['data'])
      const lost = scn.passes.find((p) => p.id === scn.stress.lostPass)
      expect(lost).toBeTruthy()
      let s = makeInitial('beginner', seed, ['data'])
      s = A.setTasking(s, scn, lost.id, lost.reach.slice(0, 2))
      s = step(s, scn, lost.t + 130)
      expect(s.images.filter((i) => i.passId === lost.id)).toHaveLength(0)
      expect(s.logs.some((l) => /สูญหาย/.test(l.th))).toBe(true)
      for (const t of [0, 300, 900]) expect(cloudCover(scn, t)).toBeCloseTo(Math.min(0.9, cloudCover(base, t) + STRESS.data.cloudBonus), 6)
      expect(scn.roofs.filter((r) => r.radarGap).length).toBe(base.roofs.filter((r) => r.radarGap).length + STRESS.data.extraRadarGaps)
      // the act-2 pass that fails reveals nobody
      s = A.setCamp(s, scn, 'cmp-amp'); s = step(s, scn, 0); s = enterAct2(s, scn)
      const q = scn.act2Passes.find((x) => x.id === scn.stress.lostQ)
      s = A.orderPass2(s, scn, q.id)
      s = step(s, scn, q.t + 1)
      expect(s.act2Shots.find((x) => x.id === q.id).lost).toBe(true)
      expect(s.points.some((p) => p.revealed === 'theos' && p.revealedAt === q.t)).toBe(false)
      // calls come later than in a normal game with the same decisions
      const b = { ...s }
      const later = makePoints(b, scn), normal = makePoints(b, base)
      for (let i = 0; i < later.length; i++) expect(later[i].hotlineAt - normal[i].hotlineAt).toBe(STRESS.data.hotlineExtraH * 60)
    }
  })

  it('roads cut: more blocked streets, two shelters', () => {
    for (const seed of SEEDS) {
      const base = makeScenario(seed, 'beginner'), scn = makeScenario(seed, 'beginner', ['roads'])
      const extra = scn.blockedRoads.length - base.blockedRoads.length
      expect(extra).toBeGreaterThanOrEqual(STRESS.roads.extraBlocked[0])
      expect(extra).toBeLessThanOrEqual(STRESS.roads.extraBlocked[1])
      expect(scn.shelters).toEqual(base.shelters.slice(0, STRESS.roads.shelters))
    }
  })

  it('less time: the mission starts at T−36 and every order takes 50% longer', () => {
    const scn = makeScenario(4242, 'beginner', ['time'])
    const s = makeInitial('beginner', 4242, ['time'])
    expect(s.clock).toBe(STRESS.time.startH * 60)
    expect(s.t0).toBe(STRESS.time.startH * 60)
    const after = A.setCamp(s, scn, 'cmp-amp')
    expect(after.clock - s.clock).toBe(Math.round(CMD_MIN.camp * STRESS.time.cmdFactor))
    if (scn.stress.lostPass) expect(scn.passes.find((p) => p.id === scn.stress.lostPass).t).toBeGreaterThan(s.clock)
  })

  it('a careful commander still finishes all three acts under every condition, and beats an idle one', () => {
    const all = ['data', 'roads', 'time']
    for (const seed of SEEDS) {
      const scn = makeScenario(seed, 'beginner', all)
      let s = makeInitial('beginner', seed, all)
      s = A.setCamp(s, scn, 'cmp-amp')
      s = A.sealGaps(s, scn, EMBANKMENT_GAPS.map((g) => g.id))
      for (const pass of scn.passes.filter((p) => p.t > s.clock)) {
        s = A.setTasking(s, scn, pass.id, [...pass.reach].sort((a, b) => pass.forecast[a] - pass.forecast[b]).slice(0, 2))
        s = step(s, scn, pass.t + 125)
        for (const img of s.images.filter((i) => i.usable && !i.analyzed && i.target !== TOWN_TARGET)) {
          s = A.submitAnalysis(s, scn, img.id, Object.fromEntries(scn.scenes[img.target].cands.map((c) => [c.id, c.kind === 'scar' ? 'scar' : 'none'])))
        }
      }
      const wet = SECTIONS.filter((z) => peakDepth(s, z) >= HARM_M)
      const at = Math.min(...wet.map((z) => arrivalAt(s, z) - evacNeedMin(z))) - 60
      s = step(s, scn, Math.max(s.clock, at))
      s = A.orderZones(s, scn, wet.map((z) => z.id))
      s = step(s, scn, 0)
      s = enterAct2(s, scn)
      scn.act2Passes.forEach((q) => { s = A.orderPass2(s, scn, q.id) })
      for (let t = 0; t < 36 * 60; t += 30) {
        s = step(s, scn, t)
        for (const id of s.hazardsLive) if (!s.powerCut[id]) s = A.cutPower(s, scn, id)
        for (const id of s.commDown) if (!s.towers[id]) s = A.buildTower(s, scn, id)
        for (const id of scn.blindSpots) if (t % 180 === 0) s = A.droneSortie(s, scn, id)
        for (const p of s.points.filter((x) => x.revealed && x.status === 'waiting' && !s.commDown.includes(x.section))) {
          if (!s.boats.some((b) => b.busyUntil <= s.clock)) break
          if (s.jobs.filter((j) => j.point === p.id && j.kind === 'boatAtPoint').length * 10 >= p.left) continue
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
        s = A.lockVerdict(s, scn, r.id)
      }
      const careful = missionScore(s, scn)
      let idle = makeInitial('beginner', seed, all)
      idle = step(idle, scn, 0); idle = enterAct2(idle, scn); idle = step(idle, scn, 36 * 60); idle = enterAct3(idle)
      const lazy = missionScore(idle, scn)
      // under stress a scripted player may still lose a group (that is the point of the test) — compare the work, not the tier
      expect(careful.perf).toBeGreaterThan(lazy.perf + 300)
      expect(careful.decision.ratio).toBeGreaterThan(lazy.decision.ratio + 0.5)
      expect(s.shelters ?? scn.shelters).toHaveLength(2)
    }
  })
})
