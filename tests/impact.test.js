import { describe, it, expect } from 'vitest'
import { makeScenario } from '../src/lib/scenario'
import { makeInitial, advanceTo, enterAct2, campOf, destOf } from '../src/engine/world'
import * as A from '../src/engine/actions'
import * as I from '../src/engine/impact'
import { peakDepth, arrivalAt, depthAt, HARM_M } from '../src/lib/sim'
import { planTrip, gradeChoice } from '../src/lib/routes'
import { SECTIONS, SECTION_BY_ID } from '../src/lib/sections'
import { EMBANKMENT_GAPS } from '../src/lib/embankment'
import { CAMP_SITES, WHY } from '../src/config/scenarioData'
import { THRESHOLDS, ACT2, COSTS, MODES } from '../src/config/missionConfig'
import { levelAt, firstCrossing } from '../src/lib/hydro'
import { fmt } from '../src/lib/format'

const SEEDS = [4242, 11, 202, 3003, 77]
const step = (s, scn, to) => { while (s.clock < to) s = advanceTo(s, scn, Math.min(to, s.clock + 15)); return s }
const start = (seed) => { const scn = makeScenario(seed); return { scn, s: makeInitial('beginner', seed) } }
const wetZones = (s) => SECTIONS.filter((z) => peakDepth(s, z) >= HARM_M).map((z) => z.id)
const dryZones = (s) => SECTIONS.filter((z) => peakDepth(s, z) < HARM_M).map((z) => z.id)
const rowsOf = (card, group) => card.rows.filter((r) => r.group === group)
const has = (card, re, tone) => card.rows.some((r) => re.test(r.th) && (!tone || r.tone === tone))

describe('impact previews', () => {
  it('never change the state they preview', () => {
    const { s, scn } = start(4242)
    const before = JSON.stringify(s)
    I.previewEvac(s, scn, wetZones(s))
    I.previewSeal(s, scn, EMBANKMENT_GAPS.map((g) => g.id))
    I.previewCamp(s, scn, 'cmp-pol')
    I.previewSkip(s, scn)
    expect(JSON.stringify(s)).toBe(before)
  })

  it('evacuation: the card cost is what the order really spends', () => {
    for (const seed of SEEDS) {
      const { s, scn } = start(seed)
      const ids = wetZones(s).slice(0, 3)
      const card = I.previewEvac(s, scn, ids)
      const after = A.orderZones(s, scn, ids)
      const spent = after.budget.spent - s.budget.spent
      expect(card.rows[0].group).toBe('use')
      expect(card.rows[0].th).toContain(fmt(spent))
      expect(card.rows[0].judge).toBe(false)
    }
  })

  it('evacuation with no evidence at T−48 is flagged as a false alarm (rule row, Beginner only)', () => {
    const { s, scn } = start(4242)
    const card = I.previewEvac(s, scn, wetZones(s).slice(0, 2))
    const fa = card.rows.find((r) => /เตือนผิด/.test(r.th))
    expect(fa).toBeTruthy()
    expect(fa.tone).toBe('bad')
    expect(fa.judge).toBe(true)
    expect(card.verdict.tone).toBe('bad')
    expect(card.verdict.judge).toBe(true)
  })

  it('evacuation after the critical level is justified and shows the timely share per zone', () => {
    for (const seed of SEEDS) {
      let { s, scn } = start(seed)
      s = step(s, scn, Math.min(-60, firstCrossing(THRESHOLDS.criticalLevel, s.clock, 0)))
      expect(levelAt(s.clock)).toBeGreaterThanOrEqual(THRESHOLDS.prepLevel)
      const ids = wetZones(s)
      const card = I.previewEvac(s, scn, ids)
      expect(card.rows.some((r) => /เตือนผิด/.test(r.th))).toBe(false)
      expect(has(card, /มีหลักฐานรองรับ/, 'good')).toBe(true)
      // per zone: "อพยพทัน N%" · zones that make it are grouped when many are ordered · zones already wet = too late
      expect(card.rows.filter((r) => r.judge && /อพยพทัน \d+%|อพยพเสร็จก่อนน้ำถึง|น้ำเข้าแล้ว/.test(r.th)).length).toBeGreaterThan(0)
    }
  })

  it('evacuating a zone the water never reaches is called wasted money', () => {
    for (const seed of SEEDS) {
      let { s, scn } = start(seed)
      const dry = dryZones(s)
      if (!dry.length) continue
      s = step(s, scn, firstCrossing(THRESHOLDS.criticalLevel, s.clock, 0))
      const card = I.previewEvac(s, scn, [dry[0]])
      expect(has(card, /เสียเปล่า/, 'warn')).toBe(true)
      return
    }
    throw new Error('no seed with a dry zone')
  })

  it('capture: the time jump matches the pass, and a cloudy target is a red risk', () => {
    const { s, scn } = start(4242)
    const pass = scn.passes[0]
    const cloudy = [...pass.reach].sort((a, b) => pass.forecast[b] - pass.forecast[a])[0]
    const s1 = A.setTasking(s, scn, pass.id, [cloudy])
    const card = I.previewCapture(s1, scn, pass.id)
    expect(card.rows[0].th).toMatch(/เวลาจะเดิน/)
    const risk = card.rows.find((r) => r.judge && r.th.includes(`${pass.forecast[cloudy]}%`))
    expect(risk).toBeTruthy()
    if (pass.forecast[cloudy] > 74) expect(risk.tone).toBe('bad')
    expect(I.previewCapture(s, scn, pass.id)).toBeNull()   // nothing tasked → no card
  })

  it('sealing: crews finish when the queued jobs finish, and covered zones get later/shallower water', () => {
    const { s, scn } = start(4242)
    const ids = EMBANKMENT_GAPS.map((g) => g.id)
    const card = I.previewSeal(s, scn, ids)
    const after = A.sealGaps(s, scn, ids)
    const finish = Math.max(...after.jobs.filter((j) => j.kind === 'seal').map((j) => j.at))
    expect(card.rows.find((r) => /ทีม/.test(r.th)).th).toMatch(/ทำตามคิวถึง/)
    expect(finish).toBeGreaterThan(s.clock)
    const gains = rowsOf(card, 'get')
    expect(gains.length).toBeGreaterThan(0)
    expect(gains.every((r) => r.judge)).toBe(true)
  })

  it('camp: the flood warning agrees with what act 2 does to that camp', () => {
    for (const seed of SEEDS.slice(0, 3)) {
      for (const site of CAMP_SITES) {
        const { s, scn } = start(seed)
        const card = I.previewCamp(s, scn, site.id)
        let n = A.setCamp(s, scn, site.id)
        n = step(n, scn, 0)
        n = enterAct2(n, scn)
        expect(card.verdict.tone === 'bad').toBe(n.campFlooded)
      }
    }
  })

  it('pump: shows the depth drop the pump really gives at ready time', () => {
    let { s, scn } = start(4242)
    s = A.setCamp(s, scn, 'cmp-amp'); s = step(s, scn, 0); s = enterAct2(s, scn)
    s = step(s, scn, 6 * 60)
    const z = SECTIONS.reduce((m, x) => (depthAt(s, x, s.clock) > depthAt(s, m, s.clock) ? x : m))
    const card = I.previewField(s, scn, 'pump', z.id)
    const after = A.deployPump(s, scn, z.id)
    const ready = after.pumps[z.id].readyAt
    const d1 = depthAt(s, z, ready), d2 = depthAt(after, z, ready)
    expect(d1 - d2).toBeCloseTo(ACT2.pumpReliefM, 5)
    expect(card.rows.some((r) => r.th.includes(`${d1.toFixed(1)} → ${Math.max(0, d1 - ACT2.pumpReliefM).toFixed(1)}`))).toBe(true)
    expect(card.rows[0].th).toContain(fmt(COSTS.pump))
  })

  it('boat: an unsafe route and an injured person sent to a shelter are flagged', () => {
    for (const seed of SEEDS) {
      let { s, scn } = start(seed)
      s = A.setCamp(s, scn, 'cmp-amp'); s = step(s, scn, 0); s = enterAct2(s, scn)
      const p = s.points.find((x) => x.injured)
      if (!p) continue
      const shelter = scn.shelters[0]
      const plan = planTrip(s, scn, campOf(s), p, destOf(shelter), s.clock)
      const opt = plan.options.find((o) => !o.safe) || plan.options[0]
      const card = I.previewBoat(s, scn, { point: p, mission: 'rescue', dest: shelter, plan, opt })
      expect(has(card, /ผู้บาดเจ็บ/, 'bad')).toBe(true)
      if (gradeChoice(plan, opt).kind === 'unsafe') expect(has(card, /เสีย 90 นาที/, 'bad')).toBe(true)
      expect(card.verdict.tone).toBe('bad')
      return
    }
    throw new Error('no seed with an injured stranded point')
  })

  it('skip to T−0 warns about every wet zone not yet ordered, and stops warning once they are', () => {
    const { s, scn } = start(4242)
    const card = I.previewSkip(s, scn)
    const wet = wetZones(s)
    const row = card.rows.find((r) => /ยังไม่ได้สั่งอพยพ/.test(r.th))
    expect(row && row.judge).toBe(true)
    for (const id of wet) expect(row.th).toContain(id)
    const ordered = { ...s, orders: Object.fromEntries(wet.map((id) => [id, s.clock])) }
    expect(I.previewSkip(ordered, scn).rows.some((r) => /ยังไม่ได้สั่งอพยพ/.test(r.th))).toBe(false)
  })

  it('Expert mode hides every rule row; Beginner sees them', () => {
    expect(MODES.beginner.impactJudge).toBe(true)
    expect(MODES.expert.impactJudge).toBe(false)
    const { s, scn } = start(4242)
    const card = I.previewEvac(s, scn, wetZones(s).slice(0, 2))
    const expertRows = card.rows.filter((r) => MODES.expert.impactJudge || !r.judge)
    expect(expertRows.length).toBeGreaterThan(0)
    expect(expertRows.some((r) => /เตือนผิด|อพยพทัน|เสียเปล่า/.test(r.th))).toBe(false)
  })

  it('every ⓘ topic has the full set of fields', () => {
    for (const [id, w] of Object.entries(WHY)) {
      for (const k of ['title', 'why', 'real', 'good', 'bad']) expect(w[k], `${id}.${k}`).toBeTruthy()
      expect(Array.isArray(w.data)).toBe(true)
    }
  })
})
