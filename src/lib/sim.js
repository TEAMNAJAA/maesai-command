/* ══════════════════════════════════════════════════════════════════════════
   SIMULATION CORE — pure functions, no React
   แกนคำนวณ: SFVI รายโซน · ความลึกน้ำรายโซน · ผลการอพยพ · ผู้ติดค้างองก์ 2 ·
   เยียวยาองก์ 3 · คะแนนภารกิจ  (ทุกฟังก์ชันรับ state ของผู้เล่น + scenario ของเกม)
   ══════════════════════════════════════════════════════════════════════════ */

import {
  SFVI, THRESHOLDS, CLOUD_RULE, HYDRO, RELIEF, SCORE, DURATIONS, RESCUE, ACT2, EVAL, HINTS, DECISION,
} from '../config/missionConfig'
import { CAMP_SITES } from '../config/scenarioData'
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
        hotlineAt: Math.max(0, arrival) + Math.round(r.range(ACT2.hotlineDelayH[0], ACT2.hotlineDelayH[1]) * 60) + (scn.stress?.hotlineExtraMin || 0),
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

/* ── Hint ladder penalty — rung 2 and 3 cost score points, once per topic ─── */

export function hintPenalty(s) {
  let raw = 0, pointer = 0, partial = 0
  for (const r of Object.values(s.hints || {})) {
    for (let k = 2; k <= r; k++) raw += HINTS.cost[k] || 0
    if (r >= 2) pointer++
    if (r >= 3) partial++
  }
  return { pts: Math.min(HINTS.maxPenalty, raw), raw, pointer, partial }
}

/* ── Mission score — computed from what the player actually did ──────────── */

/* ── Decision ledger (score v2) ─────────────────────────────────────────────
   ทุกการตัดสินใจของภารกิจ → ✅ good · ⚠️ fair · ❌ bad · ⏭️ skip · ☠️ critical พร้อมเหตุผลภาษาไทย
   องก์ที่ยังไม่จบไม่ถูกนับ (ไม่อย่างนั้นสิ่งที่ยังทำได้จะถูกนับว่า "ข้าม") */

const item = (id, act, th, verdict, why) => ({ id, act, th, verdict, why })
const tgtTh = (t) => (t === 'TOWN' ? 'ตัวเมือง' : `Sector ${t}`)
const clockTh = (m) => { const a = Math.abs(Math.round(m)), h = Math.floor(a / 60), mm = a % 60; return `T${m < 0 ? '−' : '+'}${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}` }

/** Does a forward base at this site end up under water? (same rule as enterAct2) */
export function campFloods(s, site) {
  if (!site) return false
  const near = SECTIONS.reduce((m, z) => (Math.hypot(z.c[0] - site.lon, z.c[1] - site.lat) < Math.hypot(m.c[0] - site.lon, m.c[1] - site.lat) ? z : m))
  const close = Math.hypot((near.c[0] - site.lon) * 104000, (near.c[1] - site.lat) * 110540) < 700
  return close && peakDepth(s, near) >= HARM_M
}

export function decisionLedger(s, scn) {
  const items = []
  const t0 = s.t0 ?? T_START
  const done1 = s.act > 1 || s.clock >= 0
  const done2 = s.act > 2 || (s.act === 2 && s.clock >= 36 * 60)

  /* ═════ Act 1 ═════ */
  if (done1) {
    const site = CAMP_SITES.find((c) => c.id === s.camp)
    if (!site || s.campAuto) items.push(item('camp', 1, 'ตั้งฐานบัญชาการ', 'skip', 'ไม่ได้เลือกที่ตั้งฐาน — ระบบตั้งให้อัตโนมัติ'))
    else items.push(item('camp', 1, `ตั้งฐานที่${site.th}`, campFloods(s, site) ? 'bad' : 'good', campFloods(s, site) ? 'ที่ตั้งนี้น้ำท่วมถึง ต้องย้ายฐานกลางวิกฤต' : 'ที่ตั้งพ้นน้ำ เรือออกได้ทันที'))

    for (const pass of scn.passes) {
      if (pass.t < t0 || scn.stress?.lostPass === pass.id) continue          // before the (late) start · lost at downlink
      const imgs = s.images.filter((i) => i.passId === pass.id), ok = imgs.filter((i) => i.usable).length
      const th = `THEOS-2 รอบ ${pass.id}`
      if (!imgs.length) items.push(item(`pass-${pass.id}`, 1, th, 'skip', 'ไม่ได้เลือกเป้าหมาย — เสียรอบโคจร'))
      else if (ok === imgs.length) items.push(item(`pass-${pass.id}`, 1, th, 'good', `ได้ภาพที่ใช้ได้ ${ok} ภาพ`))
      else if (ok) items.push(item(`pass-${pass.id}`, 1, th, 'fair', `ใช้ได้ ${ok}/${imgs.length} ภาพ — เป้าหนึ่งเมฆบัง`))
      else items.push(item(`pass-${pass.id}`, 1, th, 'bad', `เมฆบังทุกเป้า (${imgs.map((i) => `${tgtTh(i.target)} ${i.cloud}%`).join(', ')})`))
    }

    for (const img of s.images.filter((i) => i.usable && i.target !== 'TOWN')) {
      const scene = scn.scenes[img.target]
      const th = `แปลภาพ ${tgtTh(img.target)} (${img.passId})`
      if (!img.analyzed) { items.push(item(`read-${img.id}`, 1, th, 'skip', 'ได้ภาพแล้วแต่ไม่ได้แปล — ค่า L ไม่ครบ')); continue }
      let tp = 0, fp = 0
      for (const c of scene.cands) if (img.labels[c.id] === 'scar') { if (c.kind === 'scar') tp++; else fp++ }
      const miss = scene.scars - tp
      items.push(item(`read-${img.id}`, 1, th, !fp && !miss ? 'good' : fp + miss <= 1 ? 'fair' : 'bad',
        !fp && !miss ? `ระบุรอยดินถล่มใหม่ครบ ${tp} จุด ไม่มีของหลอกตา` : `ถูก ${tp}/${scene.scars}${fp ? ` · ระบุผิด ${fp} (นา/เงาเมฆ/รอยเก่า)` : ''}${miss ? ` · พลาด ${miss}` : ''}`))
    }

    if (s.channel.measured) items.push(item('channel', 1, 'วัดความกว้างลำน้ำ (ค่า N)', s.channel.attempts <= 1 ? 'good' : 'fair', s.channel.attempts <= 1 ? 'คำนวณถูกตั้งแต่ครั้งแรก' : `คำนวณถูกในครั้งที่ ${s.channel.attempts}`))
    else items.push(item('channel', 1, 'วัดความกว้างลำน้ำ (ค่า N)', 'skip', 'ไม่ได้วัดค่า N — เกณฑ์เตือนภัยไม่ได้ปรับตามลำน้ำที่แคบลง'))

    const nGaps = Object.keys(GAPS_BY_SECTION).reduce((a, k) => a + GAPS_BY_SECTION[k].length, 0) || 1
    const sealed = s.sealed.length
    const sealVerdict = sealed >= nGaps ? 'good' : sealed >= nGaps / 2 ? 'fair' : sealed > 0 ? 'bad' : 'skip'
    items.push(item('seal', 1, 'อุดจุดฟันหลอแนวตลิ่ง', sealVerdict, sealed ? `อุดเสร็จก่อนน้ำถึง ${sealed}/${nGaps} จุด` : 'ไม่ได้อุดจุดฟันหลอ — น้ำเข้าโซนหลังตลิ่งเร็วขึ้น'))

    for (const r of exposureSummary(s, scn).rows) {
      const th = `อพยพ ${r.sec.id} ${r.sec.name}`
      if (r.atRisk > 0) {
        if (r.order === null) items.push(item(`evac-${r.sec.id}`, 1, th, 'skip', `ไม่ได้สั่งอพยพ — น้ำถึง ${Number.isFinite(r.arrival) ? clockTh(r.arrival) : '—'} ลึกสุด ${r.peak.toFixed(1)} ม.`))
        else if (r.timely >= 0.95) items.push(item(`evac-${r.sec.id}`, 1, th, 'good', `สั่ง ${clockTh(r.order)} อพยพเสร็จก่อนน้ำถึง`))
        else items.push(item(`evac-${r.sec.id}`, 1, th, r.timely >= 0.5 ? 'fair' : 'bad', `สั่ง ${clockTh(r.order)} อพยพทันเพียง ${Math.round(r.timely * 100)}%`))
      } else if (r.order !== null) items.push(item(`evac-${r.sec.id}`, 1, th, 'bad', `น้ำสูงสุดเพียง ${r.peak.toFixed(1)} ม. — งบอพยพเสียเปล่า`))
    }

    s.decisions.filter((d) => d.outcome === 'false-alarm' && d.act === 1).forEach((d, i) => {
      items.push(item(`false-${i}`, 1, `ประกาศอพยพ ${d.communities.join(', ')} (${d.clockLabel})`, i === 0 ? 'bad' : 'critical',
        i === 0 ? `เตือนผิด — SFVI ${Number(d.sfvi).toFixed(2)} ต่ำกว่าเกณฑ์และระดับน้ำยังไม่ถึง` : `เตือนผิดซ้ำครั้งที่ ${i + 1} — ประชาชนเลิกเชื่อคำเตือน`))
    })

    for (const b of s.bossLog || []) items.push(item(`boss-${b.turn}`, 1, `คืนวิกฤต ตาที่ ${b.turn}: ${b.moveTh}`, b.verdict, b.why))
  }

  /* ═════ Act 2 ═════ */
  if (done2) {
    for (const q of scn.act2Passes) {
      const ordered = !!s.act2Orders[q.id]
      items.push(item(`q-${q.id}`, 2, `THEOS-2 รอบ ${q.id} หาผู้ติดค้าง`, ordered ? 'good' : 'skip', ordered ? (scn.stress?.lostQ === q.id ? 'สั่งถ่ายแล้ว (ภาพสูญหายจาก Stress Test)' : 'สั่งถ่ายผ่านช่องเมฆ') : 'ไม่ได้สั่งถ่าย — เสียโอกาสพบผู้ติดค้าง'))
    }
    for (const id of s.hazardsLive) items.push(item(`power-${id}`, 2, `ไฟฟ้ารั่วโซน ${id}`, s.powerCut[id] ? 'good' : 'skip', s.powerCut[id] ? 'ประสาน กฟภ. ตัดไฟแล้ว' : 'ไม่ได้ตัดไฟ'))
    const withPeople = (id) => s.points.some((p) => p.section === id)
    for (const id of scn.commDown.filter(withPeople)) items.push(item(`tower-${id}`, 2, `สัญญาณล่มโซน ${id}`, s.towers[id] ? 'good' : 'skip', s.towers[id] ? 'ตั้งเสาสื่อสารแล้ว' : 'ไม่ได้ตั้งเสา — คนโทรแจ้งไม่ได้ สั่งเรือเข้าไม่ได้'))
    for (const id of scn.blindSpots.filter(withPeople)) {
      const sent = (s.sorties || []).some((x) => x.section === id)
      items.push(item(`drone-${id}`, 2, `จุดอับโซน ${id}`, sent ? 'good' : 'skip', sent ? 'ส่งโดรนส่องแล้ว' : 'ไม่ได้ส่งโดรน — ดาวเทียมมองไม่เห็นคนในจุดอับ'))
    }
    const HZ = { river: 'ริมแม่น้ำกระแสแรง', deep: 'น้ำลึกไหลเชี่ยว', power: 'ไฟรั่ว' }
    ;(s.routeLog || []).forEach((r, i) => {
      items.push(item(`route-${i}`, 2, `เส้นทางเรือไป ${r.point} (${clockTh(r.at)})`, r.kind === 'ok' ? 'good' : r.kind === 'long' ? 'fair' : 'critical',
        r.kind === 'ok' ? 'ปลอดภัยและสั้นที่สุด' : r.kind === 'long' ? `ปลอดภัยแต่อ้อม +${((r.chosenM - (r.bestM || r.chosenM)) / 1000).toFixed(1)} กม.` : `ส่งเรือเข้าเส้นทางอันตราย (${r.hazards.map((h) => HZ[h] || h).join(' / ')})`))
    })
    for (const p of s.points) {
      const lostN = p.lost + (s.act === 2 && p.status === 'waiting' && p.type === 'critical' ? p.left : 0)
      const th = `ผู้ติดค้าง ${p.id} (${p.people} คน)`
      if (lostN > 0) {
        const late = p.firstBoatAt === undefined || p.firstBoatAt - (p.revealedAt ?? 0) > DECISION.lateBoatMin
        items.push(!p.revealed ? item(`point-${p.id}`, 2, th, 'bad', `ไม่มีใครพบทันเวลา — สูญเสีย ${lostN} คน`)
          : late ? item(`point-${p.id}`, 2, th, 'critical', `พบตั้งแต่ ${clockTh(p.revealedAt ?? 0)} แต่${p.firstBoatAt === undefined ? 'ไม่ได้ส่งเรือ' : `ส่งเรือ ${clockTh(p.firstBoatAt)} ช้าเกินไป`} — สูญเสีย ${lostN} คน`)
            : item(`point-${p.id}`, 2, th, 'bad', `ส่งเรือทันทีแต่เรือลำเดียวไม่พอ (จุ 10 คน/เที่ยว) — ควรส่งเพิ่ม · สูญเสีย ${lostN} คน`))
      } else if (p.status === 'suffered' || (p.status === 'waiting' && p.left > 0)) {
        items.push(item(`point-${p.id}`, 2, th, 'bad', p.revealed ? 'บ้านยังอยู่ได้แต่ไม่ได้รับเสบียงจนน้ำลด' : 'ไม่มีใครพบ ไม่ได้รับความช่วยเหลือ'))
      } else items.push(item(`point-${p.id}`, 2, th, p.escalated !== undefined ? 'fair' : 'good', p.escalated !== undefined ? 'ช่วยได้ แต่เสบียงไม่ทันจนต้องอพยพด่วน' : p.status === 'supplied' ? 'ส่งเสบียงถึงก่อนเส้นตาย' : 'อพยพครบทุกคน'))
    }
    for (let i = 0; i < s.wrongDest; i++) items.push(item(`dest-${i}`, 2, 'ส่งผู้บาดเจ็บ', 'bad', 'ส่งไปจุดอพยพแทนโรงพยาบาล — ต้องส่งต่อ'))
  }

  /* ═════ Act 3 ═════ */
  if (s.act === 3) {
    const final = (id) => (s.locked ? !!s.locked[id] : !!s.adjudged[id])     // only confirmed verdicts count
    for (const r of scn.roofs) {
      const v = final(r.id) ? s.adjudged[r.id] : null
      const th = `เยียวยา ${r.id} (โซน ${r.section})`
      if (!v) { items.push(item(`roof-${r.id}`, 3, th, 'skip', 'ยังไม่ได้ยืนยันคำตัดสิน')); continue }
      const out = evaluateRoof(r, v)
      items.push(item(`roof-${r.id}`, 3, th, out === 'correct' ? 'good' : 'bad', out === 'correct' ? 'ตัดสินถูกตามหลักฐาน' : { overpay: 'จ่ายเกิน', denial: 'ตัดสิทธิ์ผิด', under: 'จ่ายขาด' }[out]))
    }
    for (const id of s.surveyed) {
      const r = scn.roofs.find((x) => x.id === id)
      if (r && !r.theosCloud && !r.radarGap) items.push(item(`survey-${id}`, 3, `ส่งสำรวจ ${id}`, 'fair', 'หลักฐานระยะไกลครบอยู่แล้ว — เสียเวลา 2 วัน'))
    }
  }

  const counts = { good: 0, fair: 0, bad: 0, skip: 0, critical: 0 }
  for (const x of items) counts[x.verdict]++
  const total = items.length
  const ratio = total ? (counts.good + counts.fair * DECISION.fairWeight) / total : 1
  const tier = DECISION.tiers.find((t) => ratio >= t.minRatio && counts.critical <= t.maxCritical) || DECISION.tiers[DECISION.tiers.length - 1]
  return { items, counts, total, ratio, critical: counts.critical, tier, mult: tier.mult, failed: !!tier.failed }
}

/* ── Mission score (v2): performance points × decision multiplier − hints ──
   ไม่มีคะแนนฟรี: ส่วนที่ไม่ได้ทำได้ 0 (โซนที่น้ำไม่ถึงไม่นับเป็นคะแนนอพยพ · ไม่ส่งเรือเลยไม่ได้คะแนนโลจิสติกส์ ·
   ไม่เตือนภัยก่อนน้ำมาไม่ได้คะแนนความเชื่อมั่น) */

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
  const wet = exp.rows.filter((r) => r.atRisk > 0)
  const wasted = exp.rows.filter((r) => r.wasted).length
  const evac = clamp((wet.length ? wet.reduce((a, r) => a + r.timely, 0) / wet.length : 1) - DECISION.wastedEvacPenalty * wasted)

  const needPeople = pts.reduce((a, p) => a + p.people, 0)
  const saved = pts.reduce((a, p) => a + p.rescued + (p.status === 'supplied' ? p.people : 0), 0)
  const lost = pts.reduce((a, p) => a + p.lost, 0)
  const injured = pts.reduce((a, p) => a + p.injured, 0)
  const injuredOk = pts.reduce((a, p) => a + p.toHospital, 0)
  const rescue = needPeople ? clamp(saved / needPeople - (lost / needPeople) * 0.5) * (injured ? 0.8 + 0.2 * (injuredOk / injured) : 1) : (s.act >= 2 ? 1 : 0)

  const fuelOver = s.fuel.total ? Math.max(0, s.fuel.used / s.fuel.total - 1 / 1.4) : 0
  const overDeadline = s.clock > 60 * 1440 ? 0.3 : 0
  const idleBoats = s.act >= 2 && needPeople > 0 && !s.trips            // nobody sent a boat: no logistics to score
  const logistics = idleBoats ? 0 : clamp(1 - 0.1 * s.routeErrors - 0.06 * s.wrongDest - fuelOver * 0.5 - overDeadline - (s.budget.spent > s.budget.total ? 0.3 : 0))

  const rel = reliefSummary(s, scn)
  const warnedInTime = s.warnedAt !== null && s.warnedAt !== undefined && s.warnedAt < 0
  const trust = exp.total > 0 && (s.act > 1 || s.clock >= 0) && !warnedInTime ? 0 : s.trust / 100   // never warned before the water: no trust to keep

  const parts = { theos, evac, rescue, logistics, relief: rel.accuracy, trust }
  const max = Object.fromEntries(Object.entries(SCORE).map(([k, w]) => [k, Math.round(w * DECISION.maxPoints)]))
  const partPoints = Object.fromEntries(Object.keys(SCORE).map((k) => [k, Math.round(max[k] * parts[k])]))
  const perf = Object.values(partPoints).reduce((a, v) => a + v, 0)
  const decision = decisionLedger(s, scn)
  const hints = hintPenalty(s)
  const hintPts = hints.pts * DECISION.hintPoints
  const afterMult = Math.round(perf * decision.mult)
  const points = Math.max(0, afterMult - hintPts)
  const firstOrder = s.decisions.find((d) => d.kind === 'EVACUATE')
  return {
    version: DECISION.version,
    points, perf, afterMult, hintPts, max, partPoints, decision,
    total: points / DECISION.maxPoints, base: afterMult / DECISION.maxPoints,
    hints, parts, exposure: exp, relief: rel, scars: st,
    people: { need: needPeople, saved, lost, injured, injuredOk },
    layersAtFirst: firstOrder?.layersOpened ?? s.layersOpened.length, minLayers: EVAL.minLayersBeforeDecision,
  }
}

export const sectionById = (id) => SECTION_BY_ID[id]
