/* Shared players for the tests: a careful commander (with optional deliberate mistakes) and an idle one. */
import { makeScenario, TOWN_TARGET } from '../src/lib/scenario'
import { makeInitial, advanceTo, enterAct2, enterAct3, campOf, destOf } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { peakDepth, arrivalAt, evacNeedMin, HARM_M } from '../src/lib/sim'
import { planTrip } from '../src/lib/routes'
import { SECTIONS } from '../src/lib/sections'
import { EMBANKMENT_GAPS } from '../src/lib/embankment'

export const step = (s, scn, to) => { while (s.clock < to) s = advanceTo(s, scn, Math.min(to, s.clock + 15)); return s }

/**
 * opts.unsafeTrips — send this many boats down a hazardous route on purpose
 * opts.stress      — Stress Test conditions
 * opts.stopAfter   — 1 | 2 to stop at the end of that act
 * opts.boss        — (s, scn) => s, plays the T0 battle when the game has one
 */
export function careful(seed, opts = {}) {
  const scn = makeScenario(seed, 'beginner', opts.stress || [])
  let s = makeInitial('beginner', seed, opts.stress || [])
  s = A.setCamp(s, scn, 'cmp-amp')
  s = A.sealGaps(s, scn, EMBANKMENT_GAPS.map((g) => g.id))
  for (const pass of scn.passes.filter((p) => p.t > s.clock)) {
    const best = [...pass.reach].sort((a, b) => (pass.forecast[a] - pass.forecast[b]) || ((a === TOWN_TARGET || a === 'D') ? -1 : 1))
    s = A.setTasking(s, scn, pass.id, best.filter((t) => pass.forecast[t] <= 50).slice(0, 2))
    s = step(s, scn, pass.t + 125)
    for (const img of s.images.filter((i) => i.usable && !i.analyzed && i.target !== TOWN_TARGET)) {
      s = A.submitAnalysis(s, scn, img.id, Object.fromEntries(scn.scenes[img.target].cands.map((c) => [c.id, c.kind === 'scar' ? 'scar' : 'none'])))
    }
    if (!s.channel.measured && s.images.some((i) => i.usable && ['D', 'E', TOWN_TARGET].includes(i.target))) s = A.submitChannel(s, scn, +(1 - scn.channel.widthM / 150).toFixed(2))
  }
  const wet = SECTIONS.filter((z) => peakDepth(s, z) >= HARM_M)
  s = step(s, scn, Math.max(s.clock, Math.min(...wet.map((z) => arrivalAt(s, z) - evacNeedMin(z))) - 60))
  s = A.orderZones(s, scn, wet.map((z) => z.id))
  s = step(s, scn, 0)
  if (opts.boss) s = opts.boss(s, scn)
  if (opts.stopAfter === 1) return { s, scn }
  s = enterAct2(s, scn)
  scn.act2Passes.forEach((q) => { s = A.orderPass2(s, scn, q.id) })
  let unsafeLeft = opts.unsafeTrips || 0
  for (let t = 0; t < 36 * 60; t += 30) {
    s = step(s, scn, t)
    for (const id of s.hazardsLive) if (!s.powerCut[id]) s = A.cutPower(s, scn, id)
    for (const id of s.commDown) if (!s.towers[id]) s = A.buildTower(s, scn, id)
    for (const id of scn.blindSpots) if (!s.jobs.some((j) => j.kind === 'drone' && j.section === id) && t % 180 === 0) s = A.droneSortie(s, scn, id)
    for (const p of s.points.filter((x) => x.revealed && x.status === 'waiting' && !s.commDown.includes(x.section))) {
      if (!s.boats.some((b) => b.busyUntil <= s.clock)) break
      if (s.jobs.filter((j) => j.point === p.id && j.kind === 'boatAtPoint').length * 10 >= p.left) continue
      const mission = p.type === 'hardship' ? 'supply' : 'rescue', dest = p.injured ? 'hosp' : scn.shelters[0]
      const plan = planTrip(s, scn, campOf(s), p, mission === 'supply' ? null : destOf(dest), s.clock)
      let idx = plan.best ? plan.options.indexOf(plan.best) : -1
      const bad = plan.options.findIndex((o) => !o.safe)
      if (unsafeLeft > 0 && bad >= 0) { idx = bad; unsafeLeft-- }
      if (idx < 0) { s = A.deployPump(s, scn, p.section); continue }
      s = A.dispatchBoat(s, scn, { pointId: p.id, mission, dest, plan, optionIdx: idx })
    }
  }
  s = step(s, scn, 36 * 60)
  if (opts.stopAfter === 2) return { s, scn, unsafeLeft }
  s = enterAct3(s)
  for (const r of scn.roofs) {
    if (r.radarGap || r.theosCloud) s = A.survey(s, scn, r.id)
    s = A.adjudicate(s, scn, r.id, r.truth.flat ? (r.truth.mud ? 'both' : 'flat') : 'reject')
    if (A.lockVerdict) s = A.lockVerdict(s, scn, r.id)
  }
  return { s, scn, unsafeLeft }
}

export function idle(seed, stress = []) {
  const scn = makeScenario(seed, 'beginner', stress)
  let s = makeInitial('beginner', seed, stress)
  s = step(s, scn, 0)
  s = enterAct2(s, scn)
  s = step(s, scn, 36 * 60)
  s = enterAct3(s)
  return { s, scn }
}
