/* A1–A4 — ranks from cumulative points, medals for the habits we teach, unlocks by rank, a file per name. */
import { describe, it, expect } from 'vitest'
import { MEDALS, medalsFor, rankFor, recordRun, fileOf, unlocked, career } from '../src/lib/career'
import { CAREER } from '../src/config/missionConfig'
import { careful, idle } from './helpers'

describe('career (A1–A4)', () => {
  it('ranks climb with cumulative points', () => {
    expect(rankFor(0).id).toBe('volunteer')
    expect(rankFor(CAREER.ranks[1].min - 1).id).toBe('volunteer')
    expect(rankFor(CAREER.ranks[1].min).id).toBe('lead')
    expect(rankFor(99999).id).toBe(CAREER.ranks[CAREER.ranks.length - 1].id)
    expect(rankFor(99999).next).toBeNull()
    const r = rankFor(CAREER.ranks[1].min + 100)
    expect(r.toNext).toBe(CAREER.ranks[2].min - CAREER.ranks[1].min - 100)
  })

  it('medals reward the habits: a careful commander earns several, an idle one none', () => {
    const c = careful(11)
    const got = medalsFor(c.s, c.scn, { realSec: 6 * 60 })
    expect(got).toEqual(expect.arrayContaining(['trust', 'wall', 'swift']))
    expect(got.every((id) => MEDALS.some((m) => m.id === id))).toBe(true)
    const i = idle(11)
    expect(medalsFor(i.s, i.scn, { realSec: 30 * 60 })).toEqual([])
    expect(medalsFor(c.s, c.scn, { realSec: 30 * 60 })).not.toContain('swift')
  })

  it('the file collects runs per name, reports new medals and a rank-up', () => {
    const name = `ทดสอบ-${Math.random().toString(36).slice(2, 7)}`
    expect(fileOf(name).count).toBe(0)
    const a = recordRun(name, { points: 900, medals: ['trust'] })
    expect(a.newMedals).toEqual(['trust'])
    expect(a.rankUp).toBeNull()
    const b = recordRun(`  ${name.toUpperCase()}  `, { points: 800, medals: ['trust', 'wall'] })   // same commander, any case/spaces
    expect(b.newMedals).toEqual(['wall'])
    expect(b.rankUp?.id).toBe('lead')
    const f = fileOf(name)
    expect(f).toMatchObject({ count: 2, total: 1700, best: 900 })
    expect(f.medals.sort()).toEqual(['trust', 'wall'])
    expect(recordRun('   ', { points: 500 })).toBeNull()                 // no name, nothing filed
    career.clear(name)
    expect(fileOf(name).count).toBe(0)
  })

  it('rank opens Expert and the Stress Test conditions one by one; the teacher can open everything', () => {
    expect(unlocked(0)).toEqual({ expert: false, stress: { data: false, roads: false, time: false } })
    expect(unlocked(1)).toMatchObject({ expert: true, stress: { data: true, roads: false } })
    expect(unlocked(3).stress).toEqual({ data: true, roads: true, time: true })
    expect(unlocked(0, true)).toEqual({ expert: true, stress: { data: true, roads: true, time: true } })
  })
})
