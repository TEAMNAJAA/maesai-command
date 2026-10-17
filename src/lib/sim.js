/* ══════════════════════════════════════════════════════════════════════════
   SIMULATION CORE — pure functions, no React
   แกนคำนวณ: SFVI รายโซน · ความลึกน้ำรายโซน · ผลการอพยพ · ผู้ติดค้างองก์ 2 ·
   เยียวยาองก์ 3 · คะแนนภารกิจ  (ทุกฟังก์ชันรับ state ของผู้เล่น + scenario ของเกม)
   ══════════════════════════════════════════════════════════════════════════ */

import {
  SFVI, THRESHOLDS, CLOUD_RULE, HYDRO, RELIEF, SCORE, DURATIONS, RESCUE, ACT2, EVAL,
} from '../config/missionConfig'
import { SECTIONS, SECTION_BY_ID, sectionDepth, GAPS_BY_SECTION } from './sections'
import { BUILDINGS } from './buildings'
import { levelAt, rainAt, cloudAt, T_START } from './hydro'
import { substream } from './rng'
import { clamp } from './format'

export { levelAt, rainAt, cloudAt, worldAt, levelSeries, T_START } from './hydro'

export const ACT_WINDOW = { 1: [T_START, 0], 2: [0, 36 * 60], 3: [36 * 60, 60 * 1440] }
const PEAK_T = HYDRO.peakAtMin
export const WET_M = 0.3            // street water that stops normal movement
export const HARM_M = 0.5           // a zone that needs evacuation at all

/* ── Evidence gathered by the player ─────────────────────────────────────── */

/** Scar statistics from the player's image interpretation. */
export function scarStats(s, scn) {
  let tp = 0, fp = 0, available = 0, labelled = 0
  for (const img of s.images) {
    if (!img.usable || img.target === 'TOWN') continue
    const scene = scn.scenes[img.target]
    available += scene.scars
    if (!img.analyzed) continue
    for (const c of scene.cands) {
      const said = img.labels[c.id]
      if (said === 'scar') { labelled++; if (c.kind === 'scar') tp++; else fp++ }
    }
  }
  return { tp, fp, labelled, available, total: scn.totalScars }
}

/** Zone water depth at minute t given the player's sealing / pumping. */
export function openGapsOf(s, secId) {
  return GAPS_BY_SECTION[secId].filter((g) => !s.sealed.includes(g)).length
}
export function pumpReliefAt(s, secId, t) {
  const p = s.pumps?.[secId]
  return p && t >= p.readyAt ? ACT2.pumpReliefM : 0
}
export function depthAt(s, sec, t) {
  return sectionDepth(sec, levelAt(t), openGapsOf(s, sec.id), pumpReliefAt(s, sec.id, t))
}
export function peakDepth(s, sec) {
  return sectionDepth(sec, levelAt(PEAK_T), openGapsOf(s, sec.id), 0)
}
/** First minute the zone's streets are wet (≥ 0.3 m), with the current sealing. */
export function arrivalAt(s, sec) {
  for (let t = T_START; t <= 36 * 60; t += 10) if (depthAt(s, sec, t) >= WET_M) return t
  return Infinity
}
export const evacNeedMin = (sec) => DURATIONS.evacMobilise + sec.floodHH / DURATIONS.evacHHPerMin

/* ── SFVI = 0.30W + 0.25R + 0.20L + 0.15N + 0.10P  (P per zone) ──────────── */

export function computeSfvi(s, scn) {
  const t = s.clock
  const level = levelAt(t), rain = rainAt(t), cloud = cloudAt(t)
  const wts = SFVI.weights
  const W = clamp(level / THRESHOLDS.criticalLevel)
  const R = clamp(rain / SFVI.rainNormMm)
  const st = scarStats(s, scn)
  const L = clamp(st.labelled / scn.totalScars)
  const lastImage = s.images.filter((i) => i.usable && i.readyAt <= t).reduce((a, i) => Math.max(a, i.readyAt), -Infinity)
  const imageAgeH = Number.isFinite(lastImage) ? (t - lastImage) / 60 : Infinity
  const stale = cloud > CLOUD_RULE.cloudPct || imageAgeH > CLOUD_RULE.staleImageHours
  const Lw = stale ? wts.L * CLOUD_RULE.lWeightFactor : wts.L
  const width = s.channel.measured ? scn.channel.widthM : THRESHOLDS.origChannelWidth
  const N = clamp(1 - width / THRESHOLDS.origChannelWidth)
  const core = wts.W * W + wts.R * R + Lw * L + wts.N * N
  const perSection = SECTIONS.map((sec) => ({ id: sec.id, name: sec.name, P: sec.P, score: core + wts.P * sec.P }))
  const P = SECTIONS.reduce((a, sec) => a + sec.P * sec.roofs, 0) / SECTIONS.reduce((a, sec) => a + sec.roofs, 0)
  const basin = core + wts.P * P
  const usable = s.images.filter((i) => i.usable).length
  const confidence = clamp(0.3 + 0.08 * Math.min(4, usable) + (st.labelled ? 0.12 : 0) + (s.channel.measured ? 0.16 : 0) + (stale ? 0 : 0.1))
  const narrow = s.channel.measured && width < THRESHOLDS.origChannelWidth * THRESHOLDS.narrowChannelRatio
  const prepLevel = THRESHOLDS.prepLevel - (narrow ? THRESHOLDS.narrowChannelPrepDrop : 0)
  const veto1 = level >= THRESHOLDS.criticalLevel
  const justified = veto1 || level >= prepLevel || basin >= SFVI.decisionBand
  const recommended = veto1 ? perSection.filter((x) => x.P >= 0.25).map((x) => x.id)
    : perSection.filter((x) => x.score >= SFVI.decisionBand).map((x) => x.id)
  const ranked = [...perSection].sort((a, b) => b.score - a.score)
  return {
    W, R, L, N, P, Lw, stale, basin, perSection, ranked, confidence, scars: st,
    imageAgeH, narrow, prepLevel, veto1, justified, recommended, world: { level, rain, cloud },
  }
}

/* ── Evacuation model per zone ───────────────────────────────────────────── */

export function refusalShare(s) {
  return clamp(RESCUE.refuseBase + RESCUE.refusePerFalseAlarm * s.falseAlarms + Math.max(0, 70 - s.trust) / 400, 0, 0.45)
}

/** Households left in a zone when the water arrives, given the order time. */
export function zoneOutcome(s, scn, sec, orderAt = s.orders[sec.id]) {
  const peak = peakDepth(s, sec)
  const arrival = arrivalAt(s, sec)
  const need = evacNeedMin(sec)
  const atRisk = peak >= HARM_M ? sec.floodHH : 0
  const vul = substream(scn.seed, `vul-${sec.id}`).range(RESCUE.vulnerable[0], RESCUE.vulnerable[1])
  let moved
  if (orderAt === undefined || orderAt === null) moved = RESCUE.selfEvacuate
  else moved = clamp((arrival - orderAt) / need) * (1 - vul - refusalShare(s))
  const remaining = Math.round(atRisk * (1 - clamp(moved)))
  // decision quality: share of the evacuation that finished before the water (vulnerable/refusing excluded)
  const timely = orderAt === undefined || orderAt === null ? 0 : clamp((arrival - orderAt) / need)
  return { sec, order: orderAt ?? null, peak, arrival, need, atRisk, remaining, safe: atRisk - remaining, timely, wasted: orderAt != null && peak < HARM_M }
}

export function exposureSummary(s, scn) {
  const rows = SECTIONS.map((sec) => zoneOutcome(s, scn, sec))
  const total = rows.reduce((a, r) => a + r.atRisk, 0)
  const exposed = rows.reduce((a, r) => a + r.remaining, 0)
  return { rows, total, exposed, safe: total - exposed, safeShare: total ? 1 - exposed / total : 1 }
}

/** "ดูผลถ้ารอ" — households left if the still-unordered zones are ordered now vs after `waitMin`. */
export function waitComparison(s, scn, waitMin = 180) {
  const t0 = s.clock, t1 = s.clock + waitMin
  const rows = SECTIONS.map((sec) => {
    const prior = s.orders[sec.id]
    const now = zoneOutcome(s, scn, sec, prior ?? t0), later = zoneOutcome(s, scn, sec, prior ?? t1)
    return { sec, ordered: prior !== undefined, arrival: now.arrival, need: now.need, peak: now.peak,
      remainingNow: now.remaining, remainingLater: later.remaining, depthNow: depthAt(s, sec, t0), depthLater: depthAt(s, sec, t1) }
  })
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0)
  return { t0, t1, levelNow: levelAt(t0), levelLater: levelAt(t1), rows, remainingNow: sum('remainingNow'), remainingLater: sum('remainingLater') }
}

/* ── Act 2 · stranded households (built from the player's act-1 orders) ──── */

/** Minute at which the zone first reaches `depth` m (after `from`). */
export function timeToDepth(s, sec, depth, from = 0) {
  for (let t = from; t <= 36 * 60; t += 10) if (depthAt(s, sec, t) >= depth) return t
  return Infinity
}

export function makePoints(s, scn) {
  const r = substream(scn.seed, 'points')
  const points = []
  // deepest zones first, capped city-wide so a good commander can clear act 2 in a few minutes
  const hit = SECTIONS.map((sec) => ({ sec, out: zoneOutcome(s, scn, sec) }))
    .filter(({ out }) => out.remaining > 0 && out.peak >= HARM_M)
    .sort((a, b) => b.out.peak - a.out.peak)
  for (const { sec, out } of hit) {
    const n = Math.min(RESCUE.maxPointsPerSection, Math.max(1, Math.ceil(out.remaining / 40)), RESCUE.maxPoints - points.length)
    if (n <= 0) break
    const roofs = sec.idx.filter((i) => BUILDINGS[i].flood)
    // people sit out the crest on upper floors and roofs: windows run from the start of act 2
    const arrival = Number.isFinite(out.arrival) ? Math.max(0, out.arrival) : 0
    for (let k = 0; k < n; k++) {
      const b = BUILDINGS[roofs[r.int(0, roofs.length - 1)]]
      const people = Math.min(RESCUE.maxPeoplePerPoint, Math.max(3, Math.round((out.remaining * RESCUE.peoplePerHH) / n)))
      const critical = out.peak >= RESCUE.criticalDepthM
      const injured = critical && r.chance(RESCUE.injuredShare) ? r.int(1, 3) : 0
      const deadline = critical
        ? Math.min(34 * 60, Math.max(180, timeToDepth(s, sec, RESCUE.criticalDepthM, arrival)) + r.int(4, 14) * 60)
        : Math.min(34 * 60, arrival + r.int(10, 20) * 60)
      points.push({
        id: `${sec.id}-${k + 1}`, section: sec.id, lon: b.c[0], lat: b.c[1], fid: b.fid,
        people, left: people, injured, type: critical ? 'critical' : 'hardship',
        refuser: r.chance(clamp(refusalShare(s) * 3)), deadline,
        hotlineAt: Math.max(0, arrival) + Math.round(r.range(ACT2.hotlineDelayH[0], ACT2.hotlineDelayH[1]) * 60),
        revealed: null, status: 'waiting', assigned: null, rescued: 0, toHospital: 0, lost: 0,
      })
    }
  }
  return points
}

/* ── Act 3 · relief adjudication ─────────────────────────────────────────── */

export function evaluateRoof(roof, verdict) {
  const eFlat = roof.truth.flat, eMud = roof.truth.mud
  if (verdict === 'reject') return eFlat ? 'denial' : 'correct'
  if (verdict === 'flat') return eFlat ? (eMud ? 'under' : 'correct') : 'overpay'
  if (verdict === 'both') return eFlat && eMud ? 'correct' : 'overpay'
  return 'pending'
}
const payout = (v) => (v === 'flat' ? RELIEF.flatGrant : v === 'both' ? RELIEF.flatGrant + RELIEF.mudGrant : 0)
const truthPayout = (r) => (r.truth.flat ? RELIEF.flatGrant : 0) + (r.truth.mud ? RELIEF.mudGrant : 0)

export function reliefSummary(s, scn) {
  const roofs = scn.roofs
  const done = roofs.filter((r) => s.adjudged[r.id])
  const out = { correct: 0, overpay: 0, denial: 0, under: 0 }
  done.forEach((r) => { out[evaluateRoof(r, s.adjudged[r.id])] += 1 })
  const flats = done.filter((r) => ['flat', 'both'].includes(s.adjudged[r.id])).length
  const muds = done.filter((r) => s.adjudged[r.id] === 'both').length
  const committed = done.reduce((a, r) => a + payout(s.adjudged[r.id]), 0) + s.surveyed.length * RELIEF.surveyCost
  const ideal = roofs.reduce((a, r) => a + truthPayout(r), 0)
  const scope = SECTIONS.reduce((a, sec) => a + (peakDepth(s, sec) >= HARM_M ? sec.floodHH : 0), 0)
  const perRoof = done.length ? done.reduce((a, r) => a + payout(s.adjudged[r.id]), 0) / done.length : 0
  return {
    done: done.length, total: roofs.length, ...out, flats, muds, surveys: s.surveyed.length, committed, ideal,
    accuracy: out.correct / roofs.length,
    projected: perRoof * scope, projectedIdeal: (ideal / roofs.length) * scope, householdsInScope: scope,
  }
}

/* ── Mission score — computed from what the player actually did ──────────── */

export function missionScore(s, scn) {
  const st = scarStats(s, scn)
  const requested = s.images.length
  const usable = s.images.filter((i) => i.usable).length
  const tasking = requested ? usable / requested * Math.min(1, usable / 4) : 0
  const interp = st.available ? clamp((st.tp - st.fp) / st.available) : 0
  const nScore = s.channel.measured ? (s.channel.attempts <= 1 ? 1 : s.channel.attempts <= 2 ? 0.7 : 0.4) : 0
  const pts = s.points || []
  const revealable = pts.filter((p) => !scn.blindSpots.includes(p.section)).length
  const byTheos = pts.filter((p) => p.revealed === 'theos').length
  const act2Eyes = revealable ? clamp(byTheos / revealable) : (s.act >= 2 ? 1 : 0)
  const theos = 0.35 * tasking + 0.35 * interp + 0.15 * nScore + 0.15 * act2Eyes

  const exp = exposureSummary(s, scn)
  const zoneScore = exp.rows.map((r) => {
    if (r.atRisk === 0) return r.order === null ? 1 : 0.3           // ordered a zone the water never reached
    return r.timely
  })
  const evac = zoneScore.reduce((a, v) => a + v, 0) / zoneScore.length

  const needPeople = pts.reduce((a, p) => a + p.people, 0)
  const saved = pts.reduce((a, p) => a + p.rescued + (p.status === 'supplied' ? p.people : 0), 0)
  const lost = pts.reduce((a, p) => a + p.lost, 0)
  const injured = pts.reduce((a, p) => a + p.injured, 0)
  const injuredOk = pts.reduce((a, p) => a + p.toHospital, 0)
  const rescue = needPeople ? clamp(saved / needPeople - (lost / needPeople) * 0.5) * (injured ? 0.8 + 0.2 * (injuredOk / injured) : 1) : (s.act >= 2 ? 1 : 0)

  const fuelOver = s.fuel.total ? Math.max(0, s.fuel.used / s.fuel.total - 1 / 1.4) : 0
  const overDeadline = s.clock > 60 * 1440 ? 0.3 : 0
  const logistics = clamp(1 - 0.1 * s.routeErrors - 0.06 * s.wrongDest - fuelOver * 0.5 - overDeadline - (s.budget.spent > s.budget.total ? 0.3 : 0))

  const rel = reliefSummary(s, scn)
  const parts = { theos, evac, rescue, logistics, relief: rel.accuracy, trust: s.trust / 100 }
  const total = Object.entries(SCORE).reduce((a, [k, w]) => a + w * parts[k], 0)
  const firstOrder = s.decisions.find((d) => d.kind === 'EVACUATE')
  return {
    total, parts, exposure: exp, relief: rel, scars: st,
    people: { need: needPeople, saved, lost, injured, injuredOk },
    layersAtFirst: firstOrder?.layersOpened ?? s.layersOpened.length, minLayers: EVAL.minLayersBeforeDecision,
  }
}

export const sectionById = (id) => SECTION_BY_ID[id]
