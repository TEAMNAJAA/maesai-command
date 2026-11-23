import { describe, it, expect } from 'vitest'
import { PACKS } from '../portal/packs'

/* The water-information site shows public-health facts: every fact must name a source that exists,
   in both languages where the pack provides them, and dates must be real ISO dates. */
const facts = (p) => [
  ['answer', p.answer], ['latest', p.latest], ['standard', p.standard], ['readingsNote', p.readingsNote], ['water', p.water],
  ...p.status.map((x) => [`status ${x.id}`, x]),
  ...p.todo.do.map((x, i) => [`do ${i}`, x]), ...p.todo.dont.map((x, i) => [`dont ${i}`, x]),
  ...p.actions.map((x, i) => [`action ${i}`, x]), ...p.readings.map((x, i) => [`reading ${i}`, x]),
  ...p.impacts.map((x) => [`impact ${x.id}`, x]), ...p.faq.map((x, i) => [`faq ${i}`, x]),
].filter(([, x]) => x)

describe('water-information data packs', () => {
  for (const p of PACKS) {
    it(`${p.id}: every fact cites a source that exists`, () => {
      for (const [where, x] of facts(p)) {
        const ids = Array.isArray(x.src) ? x.src : [x.src]
        expect(ids.filter(Boolean).length, `${where} has no source`).toBeGreaterThan(0)
        for (const id of ids) expect(p.sources[id], `${where} cites unknown source "${id}"`).toBeTruthy()
      }
    })
    it(`${p.id}: sources have a URL, dates are ISO and not in the future of the pack`, () => {
      for (const [id, s] of Object.entries(p.sources)) {
        expect(s.url, id).toMatch(/^https:\/\//)
        if (s.date) expect(s.date <= p.updated, `${id} dated after the pack`).toBe(true)
      }
      const iso = /^\d{4}(-\d{2}(-\d{2})?)?$/
      for (const x of [...p.actions, ...p.readings, ...p.status]) {
        for (const k of ['date', 'until', 'dateFrom']) if (x[k]) expect(x[k], `${k} ${x[k]}`).toMatch(iso)
      }
      for (const r of p.readings) if (r.date) expect(r.date <= p.updated).toBe(true)
    })
    it(`${p.id}: Thai text everywhere, English for the main answer`, () => {
      expect(p.answer.th && p.answer.en && p.place.th && p.hazard.th).toBeTruthy()
      for (const [where, x] of facts(p)) if (typeof x.th === 'string') expect(x.th.length, where).toBeGreaterThan(0)
    })
  }
})
