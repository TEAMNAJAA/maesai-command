/* E — the T0 fight: stats come from act-1 preparation, the result is deterministic, every turn is a decision. */
import { describe, it, expect } from 'vitest'
import { makeScenario } from '../src/lib/scenario'
import { makeInitial, enterAct2 } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { bossSetup, bossTurn, bossIntent, bossBest, autoFight, applyBoss, resolveBoss, moveSchedule, cardBlock } from '../src/engine/boss'
import { decisionLedger, depthAt, arrivalAt, missionScore } from '../src/lib/sim'
import { SECTION_BY_ID } from '../src/lib/sections'
import { BOSS } from '../src/config/missionConfig'
import { careful, idle, step } from './helpers'

const SEED = 4242
const fightWell = (s, scn) => applyBoss(s, scn, autoFight(bossSetup(s, scn)), { fought: true })

describe('T0 boss — preparation decides the stats', () => {
  const good = careful(SEED, { stopAfter: 1 })
  const scn = good.scn
  const lazy = step(makeInitial('beginner', SEED), scn, 0)

  it('sealing lowers the pressure and the attack; evacuating in time keeps villagers safe', () => {
    const g = bossSetup(good.s, scn), l = bossSetup(lazy, scn)
    expect(g.boss.max).toBeLessThan(l.boss.max)
    expect(l.boss.max).toBe(BOSS.hpBase)
    expect(g.boss.attack).toBeLessThan(l.boss.attack)
    expect(g.me.villagers).toBeGreaterThan(l.me.villagers)
    expect(l.me.villagers).toBeGreaterThanOrEqual(BOSS.villagersMin)
  })

  it('the landslide-dam special exists only when images were not read or N not measured', () => {
    expect(bossSetup(good.s, scn).boss.damAvailable).toBe(false)
    expect(bossSetup(lazy, scn).boss.damAvailable).toBe(true)
    expect(moveSchedule(SEED, true)).toContain('dam')
    expect(moveSchedule(SEED, false)).not.toContain('dam')
    expect(moveSchedule(SEED, true)).toEqual(moveSchedule(SEED, true))            // fixed by the seed
  })

  it('the next move is shown only with enough evidence, and never in Expert', () => {
    expect(bossSetup(good.s, scn).seeNext).toBe(true)
    expect(bossSetup(lazy, scn).seeNext).toBe(false)
    expect(bossSetup({ ...good.s, modeId: 'expert' }, scn).seeNext).toBe(false)
    expect(bossIntent(bossSetup(lazy, scn)).visible).toBe(false)
  })
})

describe('T0 boss — cards are real measures', () => {
  const { s, scn } = careful(SEED, { stopAfter: 1 })
  const at = (b, move) => ({ ...b, moves: Array(b.turns).fill(move), boss: { ...b.boss, hp: 999, max: 999 } })
  const b0 = bossSetup(s, scn)

  it('cutting the power stops the live-current move; using it otherwise is wasted', () => {
    const hit = bossTurn(at(b0, 'power'), ['bigbag'])
    const cut = bossTurn(at(b0, 'power'), ['power'])
    expect(hit.log[0].taken).toBe(BOSS.moves.power.dmg)
    expect(cut.log[0].taken).toBe(0)
    expect(cut.log[0].verdict).not.toBe('bad')
    const lazy = bossSetup(step(makeInitial('beginner', SEED), scn, 0), scn)        // a strong surge (open gaps)
    expect(bossTurn(at(lazy, 'surge'), ['power']).log[0].verdict).toBe('bad')
  })

  it('big bags block a surge, THEOS-2 images blunt the dam burst and show the next move', () => {
    const lazy = bossSetup(step(makeInitial('beginner', SEED), scn, 0), scn)
    const raw = bossTurn(at(lazy, 'surge'), []).log[0].taken
    expect(bossTurn(at(lazy, 'surge'), ['bigbag']).log[0].taken).toBeLessThan(raw * 0.5)
    const withImg = { ...at(b0, 'dam'), seeNext: false }
    const r = bossTurn(withImg, ['theos'])
    expect(r.log[0].taken).toBeLessThan(bossTurn(withImg, []).log[0].taken * 0.3)
    expect(bossIntent(r).visible).toBe(true)
  })

  it('energy, budget and one-off cards are enforced', () => {
    expect(cardBlock(b0, ['pump', 'pump'], 'evac')).toBe('พลังสั่งการไม่พอ')
    expect(cardBlock(b0, ['pump', 'pump'], 'pump')).toBeTruthy()
    expect(cardBlock({ ...b0, me: { ...b0.me, budget: 10 } }, [], 'pump')).toBe('งบไม่พอ')
    expect(cardBlock({ ...b0, me: { ...b0.me, images: 0 } }, [], 'theos')).toBeTruthy()
    const afterBase = bossTurn(at(b0, 'rain'), ['base', 'pump', 'pump', 'evac'])
    expect(afterBase.me.baseUsed).toBe(true)
    expect(cardBlock(afterBase, [], 'base')).toBe('ใช้ไปแล้ว')
  })

  it('the commander acts first: water drained to zero does not strike', () => {
    const weak = { ...b0, boss: { ...b0.boss, hp: 10 }, moves: Array(b0.turns).fill('surge') }
    const r = bossTurn(weak, ['pump'])
    expect(r.status).toBe('won')
    expect(r.log[0].taken).toBe(0)
  })
})

describe('T0 boss — outcome', () => {
  it('a prepared commander wins; an idle one loses and the embankment breaks', () => {
    for (const seed of [SEED, 11, 202]) {
      const g = careful(seed, { stopAfter: 1 })
      expect(autoFight(bossSetup(g.s, g.scn)).status).toBe('won')
      const scn = makeScenario(seed, 'beginner')
      const lazy = step(makeInitial('beginner', seed), scn, 0)
      const r = resolveBoss(lazy, scn)
      expect(r.boss.won).toBe(false)
      expect(r.breach.extraM).toBe(BOSS.breachM)
      expect(r.bossLog).toEqual([])                                       // not fought → no turn decisions
    }
  })

  it('the breach deepens that zone in act 2 but does not rewrite act-1 verdicts', () => {
    const scn = makeScenario(SEED, 'beginner')
    const lazy = step(makeInitial('beginner', SEED), scn, 0)
    const before = decisionLedger(lazy, scn).items.filter((x) => x.id.startsWith('evac-')).map((x) => x.verdict)
    const r = resolveBoss(lazy, scn)
    const z = SECTION_BY_ID[r.breach.zone]
    expect(depthAt(r, z, 60) - depthAt(lazy, z, 60)).toBeCloseTo(BOSS.breachM, 5)
    expect(depthAt(r, z, -60)).toBe(depthAt(lazy, z, -60))
    expect(arrivalAt(r, z)).toBe(arrivalAt(lazy, z))
    expect(decisionLedger(r, scn).items.filter((x) => x.id.startsWith('evac-')).map((x) => x.verdict)).toEqual(before)
    expect(decisionLedger(r, scn).items.find((x) => x.id === 'boss').verdict).toBe('bad')
  })

  it('a fought battle puts every turn in the decision score and pays for the cards', () => {
    const { s, scn } = careful(SEED, { stopAfter: 1 })
    const b = autoFight(bossSetup(s, scn))
    const n = applyBoss(s, scn, b, { fought: true })
    expect(n.bossLog).toHaveLength(b.log.length)
    expect(n.budget.spent).toBe(s.budget.spent + b.me.spent)
    const led = decisionLedger(n, scn).items
    expect(led.filter((x) => x.id.startsWith('boss-'))).toHaveLength(b.log.length)
    expect(led.find((x) => x.id === 'boss').verdict).toBe('good')
    expect(enterAct2(n, scn).boss).toEqual(n.boss)                       // not fought twice
  })

  it('a careful commander who fights well still reaches the top tier', () => {
    const r = careful(11, { boss: fightWell })
    const sc = missionScore(r.s, r.scn)
    expect(sc.decision.tier.id).toBe('excellent')
    expect(r.s.boss.won).toBe(true)
  })

  it('bossBest only plays cards that are allowed', () => {
    const { s, scn } = idle(SEED, [])
    const b = bossSetup({ ...s, act: 1, clock: 0 }, scn)
    const picks = bossBest(b)
    let acc = []
    for (const p of picks) { expect(cardBlock(b, acc, p)).toBeNull(); acc = [...acc, p] }
  })
})
