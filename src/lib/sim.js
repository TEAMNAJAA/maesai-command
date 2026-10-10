/* ══════════════════════════════════════════════════════════════════════════
   SIMULATION CORE — pure functions, no React
   แกนคำนวณของภารกิจ: กราฟระดับน้ำ · SFVI · ครัวเรือนที่พ้นภัย · คะแนนภารกิจ
   The river is a function of time only: players change who is warned, not the water.
   ══════════════════════════════════════════════════════════════════════════ */

import {
  SFVI, THRESHOLDS, CLOUD_RULE, HYDRO, GAME, RELIEF, SCORE, EVAL,
} from '../config/missionConfig'
import { SECTORS, TOTAL_SCARS } from '../config/scenarioData'
// live = real GISTDA roof counts and flood-reach shares (falls back to scenario values)
import { COMMUNITIES_LIVE as COMMUNITIES, ROOFS_LIVE as ROOFS, AOI_FLOOD_ROOFS, HAS_BUILDINGS } from './buildings'
import { clamp } from './format'

export const T_START = -48 * 60
export const ACT_WINDOW = { 1: [T_START, -1], 2: [0, 36 * 60 - 1], 3: [36 * 60, 96 * 60] }
export const actOfClock = (t) => (t < 0 ? 1 : t < 36 * 60 ? 2 : 3)

/* ── Scenario world: level / rain / cloud as functions of mission clock ──── */

export function levelAt(t) {
  const h = HYDRO
  if (t <= h.peakAtMin) {
    const span = h.peakAtMin - T_START
    const x = clamp((t - T_START) / span)
    const drift = (h.driftPerHour * (t - T_START)) / 60
    const driftPeak = (h.driftPerHour * span) / 60
    return h.baseLevel + drift + (h.peakLevel - h.baseLevel - driftPeak) * x ** h.riseExponent
  }
  return h.recessBase + (h.peakLevel - h.recessBase) * Math.exp(-(t - h.peakAtMin) / h.recessTauMin)
}

export function rainAt(t) {
  const h = HYDRO
  if (t <= 0) return h.rainStartMm + h.rainAddMm * ((t - T_START) / -T_START) ** 1.6
  return h.rainStartMm + h.rainAddMm + 0.8 * (Math.min(t, 1440) / 60)
}

export function cloudAt(t) {
  const [c0, c1] = HYDRO.cloudEarlyPct
  if (t < -720) return c0 + (c1 - c0) * ((t - T_START) / (-720 - T_START))
  if (t < HYDRO.cloudFullAtMin) return c1 + (100 - c1) * ((t + 720) / (HYDRO.cloudFullAtMin + 720))
  if (t < HYDRO.cloudClearAtMin) return 100
  return Math.max(12, 100 - 88 * ((t - HYDRO.cloudClearAtMin) / 360))
}

export const worldAt = (t) => ({ level: levelAt(t), rain: rainAt(t), cloud: cloudAt(t) })

/** Level history for a sparkline: `hours` back from t, one point per `stepMin`. */
export function levelSeries(t, hours = 12, stepMin = 30) {
  const out = []
  for (let k = t - hours * 60; k <= t; k += stepMin) out.push(levelAt(Math.max(T_START, k)))
  return out
}

/* ── SFVI ─────────────────────────────────────────────────────────────────── */

export function scarsSeen(s) {
  return s.tasked.reduce((n, id) => n + (SECTORS.find((x) => x.id === id)?.scars || 0), 0)
}

export function computeSfvi(s) {
  const w = worldAt(s.clock)
  const wts = SFVI.weights
  const W = clamp(w.level / THRESHOLDS.criticalLevel)
  const R = clamp(w.rain / SFVI.rainNormMm)
  const seen = scarsSeen(s)
  const L = clamp(seen / TOTAL_SCARS)
  const imageAgeH = (s.clock - s.lastImageClock) / 60
  // Veto 2 / Cloud rule — cloud cover or stale optical evidence caps the weight L may carry.
  const stale = w.cloud > CLOUD_RULE.cloudPct || imageAgeH > CLOUD_RULE.staleImageHours
  const Lw = stale ? wts.L * CLOUD_RULE.lWeightFactor : wts.L
  const N = clamp(1 - s.channelWidth / THRESHOLDS.origChannelWidth)
  const core = wts.W * W + wts.R * R + Lw * L + wts.N * N
  const perCommunity = COMMUNITIES.map((c) => ({ ...c, score: core + wts.P * c.P }))
  const P = COMMUNITIES.reduce((a, c) => a + c.P, 0) / COMMUNITIES.length
  const basin = core + wts.P * P
  const confidence = clamp(0.34 + 0.3 * (s.tasked.length / GAME.swaths) + (s.channelMeasured ? 0.2 : 0) + (stale ? 0 : 0.16))
  /* Tie-break rule: equal score → the community with fewer exits ranks higher. */
  const ranked = [...perCommunity].sort((a, b) =>
    Math.abs(b.score - a.score) > 1e-9 ? b.score - a.score : a.exits - b.exits)
  // Logic matrix: channel below half its width → warn earlier (lower the preparedness band).
  const narrow = s.channelMeasured && s.channelWidth < THRESHOLDS.origChannelWidth * THRESHOLDS.narrowChannelRatio
  const prepLevel = THRESHOLDS.prepLevel - (narrow ? THRESHOLDS.narrowChannelPrepDrop : 0)
  const veto1 = w.level >= THRESHOLDS.criticalLevel
  const justified = veto1 || w.level >= prepLevel || basin >= SFVI.decisionBand
  const recommended = veto1 ? COMMUNITIES.map((c) => c.id)
    : perCommunity.filter((c) => c.score >= SFVI.decisionBand).map((c) => c.id)
  return {
    W, R, L, N, P, Lw, stale, basin, perCommunity, ranked, confidence, scarsSeen: seen,
    imageAgeH, narrow, prepLevel, veto1, justified, recommended, world: w,
  }
}

/* ── Evacuation exposure model (ค่าสถานการณ์) ─────────────────────────────── */

/** Mission clock at which the gauge first reaches `stage` metres. */
function firstCrossing(stage) {
  for (let t = T_START; t <= ACT_WINDOW[2][1]; t += 5) if (levelAt(t) >= stage) return t
  return Infinity
}
export const ARRIVAL = Object.fromEntries(COMMUNITIES.map((c) => [c.id, firstCrossing(c.floodStage)]))

export const evacNeedMin = (c) => c.households / (c.exits * HYDRO.evacRateHHPerMinPerExit) + HYDRO.mobiliseMin
export const atRiskHH = (c) => Math.round(c.households * c.P)     // = real roofs inside the flood reach
export const TOTAL_AT_RISK = COMMUNITIES.reduce((a, c) => a + atRiskHH(c), 0)

export function safeFraction(c, orderClock) {
  if (orderClock === null || orderClock === undefined) return 0
  return clamp((ARRIVAL[c.id] - orderClock) / evacNeedMin(c))
}
export const exposedHH = (c, orderClock) => Math.round(atRiskHH(c) * (1 - safeFraction(c, orderClock)))
export const depthAt = (c, t) => Math.max(0, levelAt(t) - c.floodStage)
export const mudCmAt = (c, t) => depthAt(c, t) * HYDRO.mudCmPerMetre

/** Outcome of the current evacuation orders for every community. */
export function exposureSummary(s) {
  const rows = COMMUNITIES.map((c) => {
    const order = s.evacOrders[c.id] ?? null
    const exposed = exposedHH(c, order)
    return { c, order, arrival: ARRIVAL[c.id], need: evacNeedMin(c), atRisk: atRiskHH(c), exposed, safe: atRiskHH(c) - exposed }
  })
  const exposed = rows.reduce((a, r) => a + r.exposed, 0)
  return { rows, exposed, safe: TOTAL_AT_RISK - exposed, total: TOTAL_AT_RISK, safeShare: 1 - exposed / TOTAL_AT_RISK }
}

/** "ยังไม่สั่งการ" — compare ordering now against ordering after the hold. */
export function holdComparison(s, after) {
  const t0 = s.clock, t1 = after.clock
  const rows = COMMUNITIES.map((c) => {
    const prior = s.evacOrders[c.id] ?? null
    const oNow = prior ?? t0, oLater = prior ?? t1
    return {
      c, ordered: prior !== null, arrival: ARRIVAL[c.id], need: evacNeedMin(c),
      exposedNow: exposedHH(c, oNow), exposedLater: exposedHH(c, oLater),
      marginNow: ARRIVAL[c.id] - oNow - evacNeedMin(c), marginLater: ARRIVAL[c.id] - oLater - evacNeedMin(c),
      depthNow: depthAt(c, t0), depthLater: depthAt(c, t1),
      mudNow: mudCmAt(c, t0), mudLater: mudCmAt(c, t1),
    }
  })
  const sum = (k) => rows.reduce((a, r) => a + r[k], 0)
  return {
    t0, t1, levelNow: levelAt(t0), levelLater: levelAt(t1), rows,
    exposedNow: sum('exposedNow'), exposedLater: sum('exposedLater'),
    sfviNow: computeSfvi(s), sfviLater: computeSfvi(after),
  }
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
const truthPayout = (r) => (r.truth.flat ? RELIEF.flatGrant : 0) + (r.truth.flat && r.truth.mud ? RELIEF.mudGrant : 0)

const SCOPE = HAS_BUILDINGS ? AOI_FLOOD_ROOFS : TOTAL_AT_RISK

export function reliefSummary(s) {
  const done = ROOFS.filter((r) => s.adjudged[r.id])
  const out = { correct: 0, overpay: 0, denial: 0, under: 0 }
  done.forEach((r) => { out[evaluateRoof(r, s.adjudged[r.id])] += 1 })
  const flats = done.filter((r) => ['flat', 'both'].includes(s.adjudged[r.id])).length
  const muds = done.filter((r) => s.adjudged[r.id] === 'both').length
  const committed = done.reduce((a, r) => a + payout(s.adjudged[r.id]), 0) + s.surveyed.length * RELIEF.surveyCost
  const ideal = done.reduce((a, r) => a + truthPayout(r), 0)
  // The 10 roofs are a sample — extrapolate to every household in the flood reach.
  const perRoof = done.length ? done.reduce((a, r) => a + payout(s.adjudged[r.id]), 0) / done.length : 0
  const idealPerRoof = ROOFS.reduce((a, r) => a + truthPayout(r), 0) / ROOFS.length
  return {
    done: done.length, total: ROOFS.length, ...out, flats, muds, surveys: s.surveyed.length, committed, ideal,
    accuracy: done.length ? out.correct / ROOFS.length : 0,
    // project onto every flood-reach roof in AOI-A (real GISTDA footprints), else the 4 zones
    projected: perRoof * SCOPE, projectedIdeal: idealPerRoof * SCOPE, householdsInScope: SCOPE,
  }
}

/* ── Mission success — computed from what the player actually did ───────── */

export function missionScore(s, sfvi) {
  const exp = exposureSummary(s)
  const rel = reliefSummary(s)
  const firstDecision = s.decisions.find((d) => d.kind !== 'HOLD')
  const layersAtFirst = firstDecision?.layersOpened ?? s.layersOpened.length
  const parts = {
    warning: exp.safeShare,
    relief: rel.accuracy,
    triage: s.convoy ? s.convoy.hits / 4 : 0,
    trust: s.trust / 100,
    evidence: 0.5 * Math.min(1, s.tasked.length / GAME.swaths) + 0.5 * Math.min(1, layersAtFirst / EVAL.minLayersBeforeDecision),
  }
  const total = Object.entries(SCORE).reduce((a, [k, w]) => a + w * parts[k], 0)
  return { total, parts, exposure: exp, relief: rel, layersAtFirst }
}
