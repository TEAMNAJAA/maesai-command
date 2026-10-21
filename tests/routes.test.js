/* Every stranded group can be reached by a safe boat route — or the only thing in the way is live power the player can cut. */
import { describe, it, expect } from 'vitest'
import { careful, step } from './helpers'
import { enterAct2, campOf, destOf } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { planTrip, hazardsAt } from '../src/lib/routes'
import { sectionAt } from '../src/lib/sections'
import { depthAt } from '../src/lib/sim'
import { ACT2 } from '../src/config/missionConfig'

function revealedPlans(seed) {
  let { s, scn } = careful(seed, { stopAfter: 1 })
  s = enterAct2(s, scn)
  scn.act2Passes.forEach((q) => { s = A.orderPass2(s, scn, q.id) })
  const out = [], seen = new Set()
  for (let t = 0; t < 36 * 60; t += 60) {
    s = step(s, scn, t)
    for (const p of s.points.filter((x) => x.revealed && x.status === 'waiting' && !seen.has(x.id))) {
      seen.add(p.id)
      const mission = p.type === 'hardship' ? 'supply' : 'rescue', dest = p.injured ? 'hosp' : scn.shelters[0]
      out.push({ s, scn, p, plan: planTrip(s, scn, campOf(s), p, mission === 'supply' ? null : destOf(dest), s.clock) })
    }
  }
  return out
}

describe('boat routes', () => {
  it('a group is never cut off: there is always a route, and a safe one unless live power blocks it', () => {
    let checked = 0
    for (const seed of [3, 9, 10, 30, 40]) {
      for (const { p, plan } of revealedPlans(seed)) {
        checked++
        expect(plan.options.length, `seed ${seed} ${p.id}: no route at all`).toBeGreaterThan(0)
        if (!plan.best) expect(plan.options.some((o) => o.hazards.includes('power')), `seed ${seed} ${p.id}: unsafe without live power`).toBe(true)
      }
    }
    expect(checked).toBeGreaterThan(20)
  }, 120000)

  it("the group's own flooded zone is not counted as deep water to cross", () => {
    const [{ s, scn, p }] = revealedPlans(9).filter((x) => x.p.type === 'critical')
    const zone = sectionAt([p.lon, p.lat])
    expect(depthAt(s, zone, s.clock)).toBeGreaterThan(ACT2.deepWaterM - 0.6)
    const at = hazardsAt(s, scn, s.clock, [[campOf(s).lon, campOf(s).lat], [p.lon, p.lat]])
    const inZone = [zone.c[0] + 0.004, zone.c[1]]                     // ~400 m from the zone centre, away from the group
    expect(at(inZone)).not.toContain('deep')
  }, 60000)
})
