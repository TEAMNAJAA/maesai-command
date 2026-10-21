/* B7 — a boat sent down a hazardous route has an accident: capsize (strong current / deep water) or shock (live current).
   The crew always survive, the boat is out of service, the people are still waiting, and it is the same every time. */
import { describe, it, expect } from 'vitest'
import { enterAct2, campOf, destOf } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { planTrip } from '../src/lib/routes'
import { BOAT_INCIDENT, BOAT } from '../src/config/missionConfig'
import { previewBoat } from '../src/engine/impact'
import { whatIf } from '../src/engine/whatif'
import { sceneOf } from '../src/engine/useEngine'
import { careful, step } from './helpers'

/** Play to act 2 (power left on) until a found group can be reached by a hazardous route of the wanted kind. */
function hazardTrip(want) {
  for (const seed of [11, 202, 3003, 7, 42, 99, 1234, 555, 8080, 31337]) {
    const { s: s1, scn } = careful(seed, { stopAfter: 1 })
    let s = enterAct2(s1, scn)
    scn.act2Passes.forEach((q) => { s = A.orderPass2(s, scn, q.id) })
    for (let t = 0; t < 30 * 60; t += 30) {
      s = step(s, scn, t)
      for (const id of s.commDown) if (!s.towers[id]) s = A.buildTower(s, scn, id)
      if (!s.boats.some((b) => b.busyUntil <= s.clock)) continue
      for (const p of s.points.filter((x) => x.revealed && x.status === 'waiting' && !s.commDown.includes(x.section))) {
        const mission = p.type === 'hardship' ? 'supply' : 'rescue'
        const dest = mission === 'supply' ? null : p.injured ? 'hosp' : scn.shelters[0]
        const plan = planTrip(s, scn, campOf(s), p, mission === 'supply' ? null : destOf(dest), s.clock)
        const idx = plan.options.findIndex((o) => !o.safe && (o.hazards || []).includes('power') === (want === 'shock'))
        if (idx >= 0 && s.fuel.used + plan.options[idx].fuelL <= s.fuel.total) return { s, scn, p, args: { pointId: p.id, mission, dest, plan, optionIdx: idx } }
      }
    }
  }
  return null
}

describe('boat incidents on a hazardous route (B7)', () => {
  for (const kind of ['capsize', 'shock']) {
    it(`${kind}: crew survive, boat out of service, people still waiting`, () => {
      const trip = hazardTrip(kind)
      expect(trip, `no seed offered a ${kind} route`).toBeTruthy()
      const { s, scn, p, args } = trip
      const boat = s.boats.find((b) => b.busyUntil <= s.clock)
      const n = A.dispatchBoat(s, scn, args)
      expect(n.incidents).toHaveLength(1)
      const inc = n.incidents[0]
      expect(inc.kind).toBe(kind)
      expect(inc.boat).toBe(boat.id)
      expect(inc.point).toBe(p.id)
      // the boat reaches the hazard part-way out, then is out for the repair time
      expect(inc.at).toBeGreaterThan(s.clock)
      expect(inc.until - inc.at).toBe(BOAT_INCIDENT[kind].repairMin)
      expect(n.boats.find((b) => b.id === boat.id).busyUntil).toBe(inc.until)
      // nobody was picked up: the group is still waiting and no boat counts as sent
      const q = n.points.find((x) => x.id === p.id)
      expect(q.status).toBe('waiting')
      expect(q.firstBoatAt).toBeUndefined()
      expect(n.jobs.some((j) => j.kind === 'boatAtPoint' && j.point === p.id && j.boat === boat.id)).toBe(false)
      expect(n.routeErrors).toBe(s.routeErrors + 1)
      expect(n.routeLog[n.routeLog.length - 1].kind).toBe('unsafe')
      // crew to hospital after a shock only — nobody dies
      expect(n.crewHospital || 0).toBe(kind === 'shock' ? 2 : 0)
      expect(n.logs.some((l) => l.tag === (kind === 'shock' ? 'SHOCK' : 'CAPSIZE'))).toBe(true)
      // fuel burnt only up to the hazard
      expect(n.fuel.used).toBeCloseTo(s.fuel.used + args.plan.options[args.optionIdx].fuelL * BOAT_INCIDENT.hazardAt, 1)
      // the input state is untouched
      expect(s.incidents || []).toHaveLength(0)
    })
  }

  it('is deterministic — the same order gives the same accident', () => {
    const { s, scn, args } = hazardTrip('shock')
    const a = A.dispatchBoat(s, scn, args), b = A.dispatchBoat(s, scn, args)
    expect(a.incidents).toEqual(b.incidents)
    expect(a.boats).toEqual(b.boats)
    expect(a.clock).toBe(b.clock)
  })

  it('the wrecked boat cannot be sent again until it is repaired', () => {
    const { s, scn, args } = hazardTrip('capsize')
    let n = A.dispatchBoat(s, scn, args)
    const inc = n.incidents[0]
    // take every other boat out of service, then try again with the same route plan
    n = { ...n, boats: n.boats.map((b) => (b.id === inc.boat ? b : { ...b, busyUntil: inc.until + 999 })) }
    const again = A.dispatchBoat(n, scn, { ...args, optionIdx: args.plan.options.indexOf(args.plan.best) >= 0 ? args.plan.options.indexOf(args.plan.best) : args.optionIdx })
    expect(again.trips).toBe(n.trips)
  })

  it('the consequence card warns of the accident, the scene matches the engine, the debrief counts the repair time', () => {
    for (const kind of ['capsize', 'shock']) {
      const { s, scn, p, args } = hazardTrip(kind)
      const opt = args.plan.options[args.optionIdx]
      const card = previewBoat(s, scn, { point: p, mission: args.mission, dest: args.dest, plan: args.plan, opt })
      const text = card.rows.map((r) => r.th).join(' ')
      expect(text).toContain(kind === 'shock' ? 'ไฟช็อต' : 'เรือล่ม')
      const n = A.dispatchBoat(s, scn, args)
      const scene = sceneOf('boat', s, n)
      expect(scene).toMatchObject({ kind: 'boat', outcome: kind, point: p.id, boat: n.incidents[0].boat })
      expect(scene.coords.length).toBeGreaterThan(1)
      const w = whatIf({ ...n, act: 2, clock: 36 * 60 }, scn, 2)
      const route = w.cards.find((c) => /เส้นทาง/.test(c.title))
      expect(route).toBeTruthy()
      expect(route.sum.min).toBe(BOAT_INCIDENT[kind].repairMin)
    }
  })

  it('a safe route plays the normal boat scene and a drone order plays the drone scene', () => {
    const { s, scn, args } = hazardTrip('capsize')
    const best = args.plan.options.indexOf(args.plan.best)
    if (best >= 0) {
      const n = A.dispatchBoat(s, scn, { ...args, optionIdx: best })
      expect(n.incidents || []).toHaveLength(0)
      expect(sceneOf('boat', s, n)).toMatchObject({ kind: 'boat', outcome: 'ok' })
    }
    const zone = scn.blindSpots[0]
    const d = A.droneSortie(s, scn, zone)
    expect(sceneOf('drone', s, d)).toMatchObject({ kind: 'drone', section: zone })
    expect(sceneOf('boat', s, s)).toBeNull()
    expect(BOAT.speedKmh).toBeGreaterThan(0)
  })
})

describe('boat salvage after an accident', () => {
  it('a salvage team brings the boat back early for money and time — no score lost', async () => {
    const { careful } = await import('./helpers')
    const A = await import('../src/engine/actions')
    const { previewSalvage } = await import('../src/engine/impact')
    const { decisionLedger } = await import('../src/lib/sim')
    const { BOAT_INCIDENT } = await import('../src/config/missionConfig')
    const run = careful(202, { unsafeTrips: 1, stopAfter: 2 })
    if (run.unsafeLeft) return
    // replay up to the accident: find it and salvage from just after it happened
    const inc = run.s.incidents[0]
    const s = { ...structuredClone(run.s), clock: inc.at + 1 }
    s.incidents = s.incidents.map((x) => ({ ...x, until: inc.at + BOAT_INCIDENT[x.kind].repairMin, salvaged: false }))
    s.boats = s.boats.map((b) => (b.id === inc.boat ? { ...b, busyUntil: inc.at + BOAT_INCIDENT[inc.kind].repairMin } : b))
    const card = previewSalvage(s, run.scn, inc.boat)
    expect(card.title).toContain(inc.boat)
    const n = A.salvageBoat(s, run.scn, inc.boat)
    const boat = n.boats.find((b) => b.id === inc.boat)
    expect(boat.busyUntil).toBeLessThan(inc.at + BOAT_INCIDENT[inc.kind].repairMin)
    expect(n.budget.spent - s.budget.spent).toBe(BOAT_INCIDENT.salvage.baht)
    expect(n.incidents.find((x) => x.boat === inc.boat).salvaged).toBe(true)
    expect(n.jobs.some((j) => j.kind === 'salvage' && j.boat === inc.boat)).toBe(true)
    expect(A.salvageBoat(n, run.scn, inc.boat)).toBe(n)                      // once only
    expect(decisionLedger(n, run.scn).mistakes).toBe(decisionLedger(s, run.scn).mistakes)
  }, 60000)
})
