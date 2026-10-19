/* ══════════════════════════════════════════════════════════════════════════
   SCENARIO — everything that changes from game to game, from one seed
   ทุกเกมสุ่มใหม่: ความกว้างลำน้ำ · เวลาโคจร THEOS-2 + เมฆพยากรณ์ · รอยดินถล่ม ·
   จุดอพยพที่เปิด · ถนนที่ขาด · พายุ/ไฟฟ้ารั่ว/จุดอับ · หลังคาที่ต้องเยียวยา
   (ผู้ติดค้างในองก์ 2 สร้างตอนเริ่มองก์ 2 จากการตัดสินใจจริงของผู้เล่น — ดู sim.js)
   ══════════════════════════════════════════════════════════════════════════ */

import { THEOS2, ACT2, MODES, RELIEF, STRESS } from '../config/missionConfig'
import { SECTORS, SHELTER_POOL } from '../config/scenarioData'
import { SECTIONS } from './sections'
import { BUILDINGS } from './buildings'
import { osmRoads } from './geo'
import { cloudAt } from './hydro'
import { substream } from './rng'
import { clamp } from './format'

const H = 60
const PEAK = 5.4
export const TOWN_TARGET = 'TOWN'          // AOI-A — the town reach of the Sai (for N and the embankment)

/** Synthetic THEOS-2 sector scene: true fresh scars plus look-alikes the player must reject. */
function sectorScene(r, sec) {
  const scars = Math.max(1, Math.min(3, Math.round(sec.scars / 2 + r.range(-0.8, 0.9))))
  const cands = []
  const place = () => [r.range(0.1, 0.9), r.range(0.14, 0.86)]
  for (let i = 0; i < scars; i++) { const [x, y] = place(); cands.push({ kind: 'scar', x, y, rot: r.range(-35, 35), len: r.range(0.07, 0.13) }) }
  const fields = r.int(1, 2), shadows = r.int(0, 1), oldScars = r.int(0, 1)
  for (let i = 0; i < fields; i++) { const [x, y] = place(); cands.push({ kind: 'field', x, y, rot: r.range(-20, 20), len: r.range(0.06, 0.1) }) }
  for (let i = 0; i < shadows; i++) { const [x, y] = place(); cands.push({ kind: 'shadow', x, y, rot: r.range(0, 180), len: r.range(0.07, 0.11) }) }
  for (let i = 0; i < oldScars; i++) { const [x, y] = place(); cands.push({ kind: 'old', x, y, rot: r.range(-30, 30), len: r.range(0.07, 0.11) }) }
  return { scars, cands: r.shuffle(cands).map((c, i) => ({ ...c, id: `${sec.id}${i + 1}` })) }
}

export function makeScenario(seed, modeId = 'beginner', stress = []) {
  const mode = MODES[modeId] || MODES.beginner
  const R = (label) => substream(seed, label)

  /* ── THEOS-2 · upstream sectors ───────────────────────────────────────── */
  const rs = R('sectors')
  const scenes = Object.fromEntries(SECTORS.map((sec) => [sec.id, sectorScene(rs, sec)]))
  const totalScars = Object.values(scenes).reduce((a, s) => a + s.scars, 0)

  /* ── N: river width at the narrowest reach (measured in Pan pixels) ───── */
  const rw = R('channel')
  const widthM = rw.int(20, 34)
  // measurable on any clear image of Sector D, Sector E or the town reach
  const channel = { widthM, pixels: Math.round(widthM / THEOS2.panM) }

  /* ── Act 1 passes: time, reachable targets, cloud forecast vs actual ──── */
  const rp = R('passes')
  const ids = SECTORS.map((s) => s.id)
  const passes = THEOS2.act1PassHours.slice(0, THEOS2.act1Passes).map((h, i) => {
    const t = Math.round((h + rp.range(-1.5, 1.5)) * H)
    const reach = rp.sample(ids, rp.int(3, 4))
    if (i % 2 === 0 || rp.chance(0.4)) reach.push(TOWN_TARGET)
    if (!reach.includes('D') && !reach.includes('E') && i <= 1) reach.push(rp.pick(['D', 'E']))
    const base = cloudAt(t)
    const forecast = {}, actual = {}
    for (const id of reach) {
      const f = id === TOWN_TARGET ? clamp(base * 0.6 + rp.range(-12, 25), 0, 100) : clamp(base + rp.range(-22, 34), 0, 100)
      forecast[id] = Math.round(f)
      actual[id] = Math.round(clamp(f + rp.range(-14, 14), 0, 100))
    }
    return { id: `P${i + 1}`, t, reach, forecast, actual }
  })

  /* ── Act 2: passes over town, drifting clouds, storm, hazards ────────── */
  const ra = R('act2')
  const act2Passes = [3, 14, 27].slice(0, THEOS2.act2Passes).map((h, i) => ({ id: `Q${i + 1}`, t: Math.round((h + ra.range(-1.5, 1.5)) * H) }))
  const wet = SECTIONS.filter((s) => (PEAK - s.stage) * 1.6 >= 0.5)
  const clouds = {
    phase: ra.range(0, Math.PI * 2),
    periodH: ra.range(9, 14),
    dir: ra.range(-0.35, 0.25),          // radians from due east (wind from the W–SW)
    blobs: Array.from({ length: 9 }, () => ({ u: ra.next(), v: ra.next(), r: ra.range(0.7, 1.3) })),
  }
  const stormAt = Math.round(ra.range(ACT2.stormAtH[0], ACT2.stormAtH[1]) * H)
  const commDown = ra.sample(wet.map((s) => s.id), Math.min(ACT2.commDownSections, wet.length))
  const powerHazards = ra.sample(wet.map((s) => s.id), Math.min(ACT2.powerHazardSections, wet.length))
    .map((id) => ({ id, at: Math.round(ra.range(1, 10) * H) }))
  const blindSpots = ra.sample(wet.map((s) => s.id).filter((id) => !powerHazards.some((p) => p.id === id)), ACT2.blindSpotSections)
  const shelters = ra.sample(SHELTER_POOL, 3).map((s) => s.id)
  const townRoads = osmRoads.filter((f) => /residential|tertiary|unclassified/.test(f.properties.class)
    && f.geometry.coordinates.some(([x, y]) => x > 99.872 && x < 99.9 && y > 20.43 && y < 20.448))
  const blockedRoads = ra.sample(townRoads, ra.int(2, 4)).map((f) => f.properties.osm)

  /* ── Act 3: eight real roofs with radar day counts and mud evidence ──── */
  const rr = R('relief')
  const plan = rr.shuffle(['both', 'both', 'both', 'flat', 'flat', 'reject', 'reject', 'mudOnly'])
  const used = new Set()
  const house = (b) => b.flood && b.areaM2 >= 50 && b.areaM2 <= 400
  const secOf = Object.fromEntries(SECTIONS.flatMap((s) => s.idx.map((i) => [i, s])))
  const pool = BUILDINGS.map((b, i) => ({ b, s: secOf[i] })).filter(({ b, s }) => s && house(b))
  const deep = pool.filter(({ s }) => s.stage <= 4.5), shallow = pool.filter(({ s }) => s.stage > 4.3)
  const gapIdx = rr.sample([...Array(plan.length).keys()], 1), cloudIdx = rr.sample([...Array(plan.length).keys()].filter((i) => !gapIdx.includes(i)), 2)
  const roofs = plan.map((v, i) => {
    const src = (v === 'both' || v === 'flat' ? deep : shallow).filter(({ b }) => !used.has(b.fid))
    const { b, s } = src[rr.int(0, src.length - 1)] || pool[i]
    used.add(b.fid)
    const days = v === 'both' || v === 'flat' ? rr.int(RELIEF.inundationMinDays, 13) : rr.int(1, RELIEF.inundationMinDays - 1)
    const mud = v === 'both' || v === 'mudOnly' ? true : v === 'flat' ? false : rr.chance(0.25)
    const radarGap = gapIdx.includes(i), theosCloud = cloudIdx.includes(i)
    // daily radar flood flags for 14 days after the peak; gaps are missed passes
    const series = Array.from({ length: 14 }, (_, d) => (radarGap && d >= days - 3 && d <= days + 1 ? null : d < days ? 1 : 0))
    return {
      id: `BD-${b.fid}`, fid: b.fid, ring: b.ring, c: b.c, elev: b.elev, areaM2: b.areaM2, section: s.id,
      days, series, mud, mudLevel: mud ? rr.range(0.55, 1) : rr.range(0, 0.18), radarGap, theosCloud,
      truth: { flat: days >= RELIEF.inundationMinDays, mud: mud && days >= RELIEF.inundationMinDays },
    }
  })

  /* ── Stress Test: applied after the base draw (own random stream) so the normal game never changes ── */
  const list = (stress || []).filter((k) => STRESS[k])
  const st = { list, lostPass: null, lostQ: null, hotlineExtraMin: 0, startMin: null, cmdFactor: 1 }
  const rx = R('stress')
  if (list.includes('time')) { st.startMin = STRESS.time.startH * H; st.cmdFactor = STRESS.time.cmdFactor }
  if (list.includes('data')) {
    const open = passes.filter((p) => st.startMin === null || p.t > st.startMin)
    st.lostPass = rx.pick(open).id
    st.lostQ = rx.pick(act2Passes).id
    clouds.bonus = STRESS.data.cloudBonus
    st.hotlineExtraMin = STRESS.data.hotlineExtraH * H
    const spare = roofs.filter((r) => !r.radarGap && !r.theosCloud)
    for (const r of rx.sample(spare, Math.min(STRESS.data.extraRadarGaps, spare.length))) {
      r.radarGap = true
      r.series = Array.from({ length: 14 }, (_, d) => (d >= r.days - 3 && d <= r.days + 1 ? null : d < r.days ? 1 : 0))
    }
  }
  if (list.includes('roads')) {
    const more = townRoads.map((f) => f.properties.osm).filter((id) => !blockedRoads.includes(id))
    blockedRoads.push(...rx.sample(more, Math.min(more.length, rx.int(STRESS.roads.extraBlocked[0], STRESS.roads.extraBlocked[1]))))
    shelters.splice(STRESS.roads.shelters)
  }

  return {
    seed, modeId, mode,
    scenes, totalScars, channel, passes,
    act2Passes, clouds, stormAt, commDown, powerHazards, blindSpots, shelters, blockedRoads,
    roofs, stress: st,
  }
}
