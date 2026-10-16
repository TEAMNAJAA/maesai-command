import { describe, it, expect } from 'vitest'
import { SECTIONS, sectionDepth, GAPS_BY_SECTION } from '../src/lib/sections'
import { makeScenario } from '../src/lib/scenario'
import { cloudCover, cloudCells, underCloud, clearSections, CLOUD_BOX } from '../src/lib/clouds'

describe('sections', () => {
  it('splits the town into 10 zones from real roofs', () => {
    expect(SECTIONS).toHaveLength(10)
    for (const s of SECTIONS) {
      expect(s.roofs).toBeGreaterThan(50)
      expect(s.stage).toBeGreaterThanOrEqual(4)
      expect(s.hull.length).toBeGreaterThan(3)
    }
    console.table(SECTIONS.map((s) => ({ id: s.id, name: s.name, roofs: s.roofs, flood: s.floodRoofs, P: s.P.toFixed(2), stage: s.stage.toFixed(2), peak: sectionDepth(s, 5.4).toFixed(2), gaps: GAPS_BY_SECTION[s.id].length })))
  })
  it('the four watch communities fall in distinct zones', () => {
    const coms = SECTIONS.flatMap((s) => s.communities)
    expect(new Set(coms).size).toBe(4)
  })
})

describe('scenario', () => {
  it('is reproducible from the seed', () => {
    expect(JSON.stringify(makeScenario(1234))).toBe(JSON.stringify(makeScenario(1234)))
    expect(makeScenario(1234).channel.widthM).not.toBe(undefined)
  })
  it('varies between seeds', () => {
    const widths = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((s) => makeScenario(s).channel.widthM))
    expect(widths.size).toBeGreaterThan(2)
  })
  it('has 4 act-1 passes in order, each with reachable targets and a forecast', () => {
    const s = makeScenario(42)
    expect(s.passes).toHaveLength(4)
    s.passes.forEach((p, i) => {
      expect(p.reach.length).toBeGreaterThanOrEqual(3)
      for (const id of p.reach) expect(p.forecast[id]).toBeTypeOf('number')
      if (i) expect(p.t).toBeGreaterThan(s.passes[i - 1].t)
    })
    expect(s.totalScars).toBeGreaterThan(8)
  })
  it('opens 3 shelters and picks 12 relief roofs with a balanced truth', () => {
    const s = makeScenario(99)
    expect(s.shelters).toHaveLength(3)
    expect(s.roofs).toHaveLength(12)
    expect(new Set(s.roofs.map((r) => r.id)).size).toBe(12)
    const both = s.roofs.filter((r) => r.truth.flat && r.truth.mud).length
    expect(both).toBe(4)
  })
})

describe('clouds over town', () => {
  it('cover stays between 35 % and 65 %', () => {
    const s = makeScenario(7)
    for (let t = 0; t <= 36 * 60; t += 30) {
      const c = cloudCover(s, t)
      expect(c).toBeGreaterThanOrEqual(0.349); expect(c).toBeLessThanOrEqual(0.651)
    }
  })
  it('measured cover on a grid tracks the target', () => {
    const s = makeScenario(7)
    for (const t of [60, 600, 1200, 1800]) {
      const cells = cloudCells(s, t)
      let hit = 0, n = 0
      for (let i = 0; i < 40; i++) for (let j = 0; j < 30; j++) {
        n++; if (underCloud(cells, [CLOUD_BOX[0] + ((i + 0.5) / 40) * (CLOUD_BOX[2] - CLOUD_BOX[0]), CLOUD_BOX[1] + ((j + 0.5) / 30) * (CLOUD_BOX[3] - CLOUD_BOX[1])])) hit++
      }
      expect(Math.abs(hit / n - cloudCover(s, t))).toBeLessThan(0.2)
      const clear = clearSections(s, t)
      expect(clear.length).toBeGreaterThan(0); expect(clear.length).toBeLessThan(10)
    }
  })
})
