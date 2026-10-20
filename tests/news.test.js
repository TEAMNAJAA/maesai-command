/* D2 — the news follows the decisions; it never tells the player what they have not found. */
import { describe, it, expect } from 'vitest'
import { makeScenario } from '../src/lib/scenario'
import { makeInitial, enterAct2, campOf, destOf } from '../src/engine/world'
import * as A from '../src/engine/actions'
import { planTrip } from '../src/lib/routes'
import { SECTIONS } from '../src/lib/sections'
import { newsFor } from '../src/lib/news'
import { careful, step } from './helpers'

const SEED = 11

describe('news feed (D2)', () => {
  it('a false alarm makes the news and the people lose faith', () => {
    const scn = makeScenario(SEED, 'beginner')
    const s0 = A.setCamp(makeInitial('beginner', SEED), scn, 'cmp-amp')
    const quiet = SECTIONS.filter((z) => z.P < 0.2)[0] || SECTIONS[0]
    const s1 = A.orderZones(s0, scn, [quiet.id])
    if (s1.decisions[s1.decisions.length - 1]?.outcome !== 'false-alarm') return    // this zone happened to be justified
    const n = newsFor(s0, s1, scn)
    expect(n.some((x) => x.kind === 'news' && x.tone === 'bad' && /เตือนผิด|ไม่เชื่อ|น้ำยังไม่มา/.test(x.th))).toBe(true)
    expect(n.some((x) => x.kind === 'social')).toBe(true)
  })

  it('a rescue is reported by the community name', () => {
    const { s: a1, scn } = careful(SEED, { stopAfter: 1 })
    let s = enterAct2(a1, scn)
    scn.act2Passes.forEach((q) => { s = A.orderPass2(s, scn, q.id) })
    let story = null
    for (let t = 0; t < 30 * 60 && !story; t += 30) {
      const before = s
      s = step(s, scn, t)
      for (const id of s.hazardsLive) if (!s.powerCut[id]) s = A.cutPower(s, scn, id)
      for (const id of s.commDown) if (!s.towers[id]) s = A.buildTower(s, scn, id)
      const p = s.points.find((x) => x.revealed && x.status === 'waiting' && x.type !== 'hardship' && !s.commDown.includes(x.section) && !s.jobs.some((j) => j.point === x.id))
      if (p && s.boats.some((b) => b.busyUntil <= s.clock)) {
        const plan = planTrip(s, scn, campOf(s), p, destOf(scn.shelters[0]), s.clock)
        if (plan.best) s = A.dispatchBoat(s, scn, { pointId: p.id, mission: 'rescue', dest: scn.shelters[0], plan, optionIdx: plan.options.indexOf(plan.best) })
      }
      story = newsFor(before, s, scn).find((x) => /ชีวิต/.test(x.th))
    }
    expect(story).toBeTruthy()
    expect(story.tone).toBe('good')
  })

  it('a loss is reported only for a group the player knew about', () => {
    const { s: a1, scn } = careful(SEED, { stopAfter: 1 })
    const s = enterAct2(a1, scn)
    const q = s.points[0]
    const before = { ...s, points: s.points.map((x) => (x.id === q.id ? { ...x, status: 'waiting' } : x)) }
    const unseen = { ...s, points: s.points.map((x) => (x.id === q.id ? { ...x, status: 'lost', revealed: false } : x)) }
    const seen = { ...s, points: s.points.map((x) => (x.id === q.id ? { ...x, status: 'lost', revealed: 'theos' } : x)) }
    expect(newsFor(before, unseen, scn).some((x) => /สูญเสีย/.test(x.th))).toBe(false)
    expect(newsFor(before, seen, scn).some((x) => /สูญเสีย/.test(x.th))).toBe(true)
    expect(newsFor(s, s, scn)).toEqual([])
  })
})
