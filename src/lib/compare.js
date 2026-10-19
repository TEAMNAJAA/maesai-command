/* ══════════════════════════════════════════════════════════════════════════
   ROUND COMPARISON — เทียบรอบ 1 กับรอบ 2 (สถานการณ์ใหม่) เป็นหลักฐานการเรียนรู้
   ทุกเกมสุ่มสถานการณ์ใหม่ (seed) — ถ้ารอบสองดีขึ้น แปลว่าเข้าใจหลักการ ไม่ได้จำคำตอบ
   • sessionMetrics()  ตัวชี้วัดของรอบที่เล่นจบ (บันทึกลง Log ตอนจบภารกิจ)
   • roundPairs()      จับคู่รอบแรก–รอบสองของผู้เล่นชื่อเดียวกันในเครื่องนี้
   • pairedT()         Paired t-test (สองทาง) ตาม Sandbox Test Plan
   ══════════════════════════════════════════════════════════════════════════ */

import { missionScore, hintPenalty } from './sim'
import { whatIf } from '../engine/whatif'

/** What we keep about one finished run (all numbers, so they can be averaged and exported). */
export function sessionMetrics(s, scn, realSec = null) {
  const sc = missionScore(s, scn)
  const h = hintPenalty(s)
  const missed = [1, 2, 3].reduce((a, act) => a + whatIf(s, scn, act).cards.length, 0)
  const pp = sc.people
  return {
    version: sc.version,
    score: sc.points,
    decisionTier: sc.decision.tier.id, decisionRatio: Math.round(sc.decision.ratio * 100), critical: sc.decision.critical,
    parts: sc.partPoints,
    falseAlarms: s.falseAlarms,
    exposedHH: sc.exposure.exposed,
    savedPct: pp.need ? Math.round((pp.saved / pp.need) * 100) : 100,
    lost: pp.lost,
    routeErrors: s.routeErrors,
    wrongDest: s.wrongDest,
    reliefPct: Math.round(sc.relief.accuracy * 100),
    layersFirst: sc.layersAtFirst,
    hints: h.pointer + h.partial,
    hintPts: h.pts,
    missed,
    realSec: realSec === null ? null : Math.round(realSec),
    seed: s.seed, mode: s.modeId, stress: s.stress || [],
  }
}

/** Metrics shown in the comparison — `better`: which direction is an improvement. */
export const METRICS = [
  { k: 'score', th: 'คะแนนภารกิจ (เต็ม 1000)', unit: 'แต้ม', better: 1 },
  { k: 'decisionRatio', th: 'ตัดสินใจถูก', unit: '%', better: 1 },
  { k: 'critical', th: 'ผิดร้ายแรง', unit: 'ครั้ง', better: -1 },
  { k: 'falseAlarms', th: 'เตือนผิด', unit: 'ครั้ง', better: -1 },
  { k: 'savedPct', th: 'ช่วยผู้ติดค้างได้', unit: '%', better: 1 },
  { k: 'routeErrors', th: 'เส้นทางเรือผิด', unit: 'ครั้ง', better: -1 },
  { k: 'reliefPct', th: 'เยียวยาถูกต้อง', unit: '%', better: 1 },
  { k: 'layersFirst', th: 'ชั้นข้อมูลก่อนตัดสินใจครั้งแรก', unit: 'ชั้น', better: 1 },
  { k: 'missed', th: 'โอกาสที่พลาด ("ถ้าคุณเลือกอีกทาง")', unit: 'เรื่อง', better: -1 },
  { k: 'hints', th: 'ขอคำใบ้ขั้น 2–3', unit: 'ครั้ง', better: -1 },
  { k: 'realSec', th: 'เวลาเล่นจริง', unit: 'วินาที', better: -1 },
]

const nameKey = (p) => String(p || '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Completed, non-demo sessions grouped by player: round 1 vs round 2 (+ every round's score for the trend). */
export function roundPairs(sessions) {
  const done = sessions.filter((x) => !x.demo && x.result?.metrics && nameKey(x.player))
  const by = new Map()
  for (const x of done) {
    const k = nameKey(x.player)
    if (!by.has(k)) by.set(k, [])
    by.get(k).push(x)
  }
  const pairs = []
  for (const list of by.values()) {
    if (list.length < 2) continue
    list.sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)))
    // score v2 (points) and v1 (%) are not comparable: pair the first two rounds of the newest version
    const ver = (x) => x.result.metrics.version || 1
    const newest = Math.max(...list.map(ver))
    const same = list.filter((x) => ver(x) === newest)
    if (same.length < 2) continue
    const [r1, r2] = same
    const m1 = r1.result.metrics, m2 = r2.result.metrics
    const delta = Object.fromEntries(METRICS.map(({ k }) => [k, m1[k] === null || m2[k] === null || m1[k] === undefined || m2[k] === undefined ? null : m2[k] - m1[k]]))
    pairs.push({
      player: r1.player, rounds: same.length, r1, r2, m1, m2, delta, version: newest,
      sameSeed: m1.seed !== undefined && m1.seed === m2.seed,
      trend: same.map((x) => x.result.metrics.score),
    })
  }
  return pairs.sort((a, b) => (b.delta.score ?? 0) - (a.delta.score ?? 0))
}

/* ── Paired t-test (two-tailed) ─────────────────────────────────────────── */

function lgamma(x) {   // Lanczos
  const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
  x -= 1
  let a = c[0]
  const t = x + g + 0.5
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}
function betacf(a, b, x) {
  const MAX = 200, EPS = 3e-14, FPMIN = 1e-300
  let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAX; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}
/** Regularized incomplete beta I_x(a, b). */
export function ibeta(x, a, b) {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b
}

/** Paired t-test on round-2 minus round-1 differences: { n, mean, sd, t, df, p } (p two-tailed). */
export function pairedT(diffs) {
  const d = diffs.filter((x) => Number.isFinite(x))
  const n = d.length
  if (n < 2) return { n, mean: n ? d[0] : null, sd: null, t: null, df: n - 1, p: null }
  const mean = d.reduce((a, x) => a + x, 0) / n
  const sd = Math.sqrt(d.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1))
  const df = n - 1
  if (sd === 0) return { n, mean, sd, t: mean === 0 ? 0 : Infinity, df, p: mean === 0 ? 1 : 0 }
  const t = mean / (sd / Math.sqrt(n))
  const p = ibeta(df / (df + t * t), df / 2, 0.5)
  return { n, mean, sd, t, df, p }
}

/** Group summary for the teacher panel. */
export function compareSummary(pairs) {
  const avg = (xs) => { const v = xs.filter((x) => Number.isFinite(x)); return v.length ? v.reduce((a, x) => a + x, 0) / v.length : null }
  const rows = METRICS.map((m) => {
    const a = avg(pairs.map((p) => p.m1[m.k])), b = avg(pairs.map((p) => p.m2[m.k]))
    // `better` stays the direction (+1 higher is better / −1 lower is better); `improved` is whether the group moved that way
    const improved = a === null || b === null || b === a ? null : Math.sign(b - a) === m.better
    return { ...m, r1: a, r2: b, improved }
  })
  const improved = pairs.filter((p) => (p.delta.score ?? 0) > 0).length
  return { n: pairs.length, rows, improved, test: pairedT(pairs.map((p) => p.delta.score)), sameSeed: pairs.filter((p) => p.sameSeed).length }
}

/** This player's previous finished round on this device (for the end-of-mission feedback). */
export function previousRound(sessions, player, currentId) {
  const k = nameKey(player)
  if (!k) return null
  const prev = sessions.filter((x) => x.id !== currentId && !x.demo && x.result?.metrics && nameKey(x.player) === k)
  prev.sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))
  return prev[0] || null
}

/** CSV of the pairs (one row per player). */
export function pairsCSV(pairs) {
  const head = ['player', 'rounds', 'seed_r1', 'seed_r2', 'same_seed', 'stress_r1', 'stress_r2', ...METRICS.flatMap((m) => [`${m.k}_r1`, `${m.k}_r2`, `${m.k}_delta`])]
  const rows = pairs.map((p) => [p.player, p.rounds, p.m1.seed ?? '', p.m2.seed ?? '', p.sameSeed ? 1 : 0, (p.m1.stress || []).join(' '), (p.m2.stress || []).join(' '),
    ...METRICS.flatMap((m) => [p.m1[m.k] ?? '', p.m2[m.k] ?? '', p.delta[m.k] ?? ''])])
  return '﻿' + [head, ...rows].map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
}
