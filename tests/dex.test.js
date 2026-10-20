/* D1 — knowledge cards unlock only when the player meets the thing in the game. */
import { describe, it, expect } from 'vitest'
import { makeScenario } from '../src/lib/scenario'
import { makeInitial } from '../src/engine/world'
import { dexUnlocks, dex } from '../src/lib/dex'
import { KNOWLEDGE } from '../src/config/scenarioData'
import { careful } from './helpers'

describe('knowledge book (D1)', () => {
  it('nothing at the start; a careful run collects most of the book', () => {
    const scn = makeScenario(11, 'beginner')
    expect(dexUnlocks(makeInitial('beginner', 11), scn)).toEqual([])
    const r = careful(11)
    const got = dexUnlocks(r.s, r.scn)
    expect(got).toEqual(expect.arrayContaining(['theos2', 'l3ortho', 'landslide', 'channel', 'sfvi', 'embankment', 'radarsat', 'sphere', 'relief']))
    expect(got.length).toBeGreaterThan(KNOWLEDGE.length / 2)
  })

  it('every card has its content, a source and a hint on how to find it', () => {
    for (const k of KNOWLEDGE) {
      expect(k.th && k.body && k.source && k.how).toBeTruthy()
      expect(k.body.length).toBeGreaterThan(40)
    }
    expect(new Set(KNOWLEDGE.map((k) => k.id)).size).toBe(KNOWLEDGE.length)
  })

  it('a card is new only the first time', () => {
    dex.reset()
    expect(dex.see(['theos2', 'sfvi'])).toEqual(['theos2', 'sfvi'])
    expect(dex.see(['theos2', 'channel'])).toEqual(['channel'])
    expect(dex.has('sfvi')).toBe(true)
    dex.reset()
    expect(dex.has('sfvi')).toBe(false)
  })
})
