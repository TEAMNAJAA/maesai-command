/* ══════════════════════════════════════════════════════════════════════════
   ACTIONS — every player order, as a pure state transition
   ไม่มีแต้ม AP: คำสั่งใช้ "เวลา" (งานของทีมใช้เวลาจริงในเกม) และ "งบประมาณ" (บาท)
   ══════════════════════════════════════════════════════════════════════════ */

import { THEOS2, COSTS, DURATIONS, MODES, TRUST, SFVI, RELIEF, BOAT, THRESHOLDS, EMBANKMENT, CMD_MIN, HINTS } from '../config/missionConfig'
import { CAMP_SITES, HOSPITAL } from '../config/scenarioData'
import { SECTION_BY_ID } from '../lib/sections'
import { EMBANKMENT_GAPS } from '../lib/embankment'
import { computeSfvi, scarStats } from '../lib/sim'
import { levelAt } from '../lib/hydro'
import { planTrip, gradeChoice } from '../lib/routes'
import { log, toast, campOf, destOf, advanceTo } from './world'
import { clockLabel, clockToDate, fmt } from '../lib/format'

const clone = (s) => structuredClone(s)
const mode = (s) => MODES[s.modeId]
const afford = (n, cost, what) => {
  if (n.budget.spent + cost > n.budget.total) {
    log(n, 'warn', 'BUDGET', `Not enough budget for ${what}.`, `งบประมาณไม่พอสำหรับ${what} (ต้องใช้ ฿${fmt(cost)})`)
    toast(n, 'warn', 'งบประมาณไม่พอ')
    return false
  }
  n.budget.spent += cost
  return true
}
/** Orders take effect at once; the command time they take moves the mission clock on. */
const spend = (n, scn, min) => (min > 0 ? advanceTo(n, scn, n.clock + min) : n)
const withTrust = (n, t) => { n.trust = Math.max(0, Math.min(100, t)); n.trustHist = [...n.trustHist.slice(-30), n.trust] }

/* ── Hint ladder — the player asks for the next rung (no game time) ────────── */

/** Open rung `rung` of a hint topic: one step at a time, only up to the act's limit, Beginner only. */
export function revealHint(s, scn, topic, rung) {
  if (!mode(s).tutor) return s
  const cur = s.hints?.[topic] || 1
  if (rung !== cur + 1 || rung > (HINTS.maxRung[s.act] || 1)) return s
  return { ...s, hints: { ...(s.hints || {}), [topic]: rung } }
}

/* ── Act 1 · base camp ───────────────────────────────────────────────────── */

export function setCamp(s, scn, id) {
  const site = CAMP_SITES.find((c) => c.id === id)
  if (!site || s.act !== 1 || s.camp === id) return s
  const n = clone(s)
  if (!afford(n, COSTS.camp, 'ตั้งฐานบัญชาการ')) return n
  n.camp = id
  log(n, 'good', 'CAMP', `Forward base set up at ${site.th}.`, `ตั้งฐานบัญชาการที่${site.th} (${site.note})`)
  toast(n, 'ok', `ตั้งฐานที่${site.th}`)
  return spend(n, scn, CMD_MIN.camp)
}

/* ── Act 1 · THEOS-2 tasking per pass ────────────────────────────────────── */

export function setTasking(s, scn, passId, targets) {
  const pass = scn.passes.find((p) => p.id === passId)
  if (!pass || s.act !== 1 || s.clock >= pass.t) return s
  const n = clone(s)
  n.taskings[passId] = targets.filter((t) => pass.reach.includes(t)).slice(0, THEOS2.targetsPerPass)
  return n
}

/** Image interpretation: the player labels each candidate in a scene as a fresh scar or not. */
export function submitAnalysis(s, scn, imageId, labels) {
  const n = clone(s)
  const img = n.images.find((i) => i.id === imageId)
  if (!img || !img.usable) return s
  img.labels = labels; img.analyzed = true
  const scene = scn.scenes[img.target]
  let tp = 0, fp = 0
  for (const c of scene.cands) if (labels[c.id] === 'scar') { if (c.kind === 'scar') tp++; else fp++ }
  const missed = scene.scars - tp
  log(n, fp ? 'warn' : 'good', 'ANALYSIS', `Sector ${img.target}: ${tp} scars confirmed, ${fp} false, ${missed} missed.`,
    `แปลภาพ Sector ${img.target}: ระบุรอยดินถล่ม ${tp + fp} จุด${fp ? ` (ในนี้ ${fp} จุดไม่ใช่ดินถล่ม)` : ''}${missed ? ` · พลาด ${missed} จุด` : ''}`)
  const st = scarStats(n, scn)
  toast(n, fp ? 'warn' : 'ok', `L = ${st.labelled}/${scn.totalScars}`)
  return spend(n, scn, CMD_MIN.analysis)
}

/** N: the player computes the channel width from the Pan pixel count and enters N. */
export function submitChannel(s, scn, valueN) {
  if (s.channel.measured) return s
  const n = clone(s)
  const ok = n.images.some((i) => i.usable && i.readyAt <= n.clock && ['D', 'E', 'TOWN'].includes(i.target))
  if (!ok) return s
  n.channel.attempts += 1; n.channel.lastInput = valueN
  const truth = 1 - scn.channel.widthM / THRESHOLDS.origChannelWidth
  if (Math.abs(valueN - truth) <= 0.011) {
    n.channel.measured = true; n.channel.at = n.clock
    const narrow = scn.channel.widthM < THRESHOLDS.origChannelWidth * THRESHOLDS.narrowChannelRatio
    log(n, 'crit', 'CHANNEL', `Channel ${scn.channel.widthM} m (${scn.channel.pixels} px × ${THEOS2.panM} m) → N = ${truth.toFixed(2)}.${narrow ? ' Preparedness band lowered 0.20 m.' : ''}`,
      `คำนวณได้ถูกต้อง: ลำน้ำกว้าง ${scn.channel.widthM} ม. → N = ${truth.toFixed(2)}${narrow ? ' · ลำน้ำเหลือไม่ถึงครึ่ง ลดเกณฑ์เตือนภัย 0.20 ม.' : ''}`)
    toast(n, 'ok', `ค่า N = ${truth.toFixed(2)} ถูกต้อง`)
  } else {
    log(n, 'warn', 'CHANNEL', `N = ${valueN} rejected.`, `ค่า N = ${valueN} ยังไม่ถูก — ความกว้าง = จำนวนพิกเซล × 0.5 ม. แล้ว N = 1 − ความกว้าง ÷ 150`)
    toast(n, 'warn', 'ค่า N ยังไม่ถูก ลองคำนวณใหม่')
  }
  return spend(n, scn, CMD_MIN.channel)
}

/* ── Act 1 · embankment crews ─────────────────────────────────────────────── */

export function sealGaps(s, scn, ids) {
  if (s.act !== 1) return s
  const n = clone(s)
  const queued = new Set(n.jobs.filter((j) => j.kind === 'seal').map((j) => j.gap))
  const todo = ids.filter((id) => !n.sealed.includes(id) && !queued.has(id))
  let started = 0
  for (const id of todo) {
    const g = EMBANKMENT_GAPS.find((x) => x.id === id)
    if (!g) continue
    const bags = g.len * EMBANKMENT.bagsPerMetre
    if (!afford(n, bags * COSTS.bigbag, `บิ๊กแบ็ก ${g.id}`)) break
    const crew = n.crews.reduce((m, c) => (c.busyUntil < m.busyUntil ? c : m))
    const start = Math.max(n.clock, crew.busyUntil)
    crew.busyUntil = start + Math.round(g.len * DURATIONS.bigbagPerMetre)
    n.jobs.push({ kind: 'seal', gap: id, crew: crew.id, start, at: crew.busyUntil })
    started++
  }
  if (started) {
    log(n, 'info', 'EMBANKMENT', `${started} gap(s) queued for big-bag crews.`, `สั่งทีมวางบิ๊กแบ็ก ${started} จุด — ทีมมี ${n.crews.length} ชุด ทำตามคิว`)
    toast(n, 'ok', `ทีมบิ๊กแบ็กรับงาน ${started} จุด`)
    return spend(n, scn, CMD_MIN.seal)
  }
  return n
}

/* ── Act 1 · evacuation orders per zone ───────────────────────────────────── */

export function orderZones(s, scn, ids) {
  const n = clone(s)
  const sf = computeSfvi(n, scn)
  const gaugeOk = sf.veto1 || sf.world.level >= sf.prepLevel
  const targets = ids.filter((id) => n.orders[id] === undefined)
  if (!targets.length) return s
  const cost = targets.reduce((a, id) => a + COSTS.evacBase + COSTS.evacPerHH * SECTION_BY_ID[id].floodHH, 0)
  if (!afford(n, cost, `อพยพ ${targets.length} โซน`)) return n
  const scoreOf = Object.fromEntries(sf.perSection.map((x) => [x.id, x.score]))
  const weak = gaugeOk ? [] : targets.filter((id) => scoreOf[id] < SFVI.decisionBand)
  let outcome = 'justified', delta = TRUST.justifiedBonus
  if (n.act === 2) { outcome = n.warnedAt === null ? 'late' : 'rebroadcast'; delta = n.warnedAt === null ? -TRUST.lateWarningPenalty : 0 }
  else if (weak.length) {
    n.falseAlarms += 1
    delta = -TRUST.falseAlarmPenalties[Math.min(n.falseAlarms - 1, TRUST.falseAlarmPenalties.length - 1)]
    outcome = 'false-alarm'
  }
  for (const id of targets) n.orders[id] = n.clock
  n.warnedAt = n.warnedAt ?? n.clock
  withTrust(n, n.trust + delta)
  const rec = decisionRecord(n, sf, { kind: 'EVACUATE', communities: targets, outcome, matchSfvi: weak.length === 0, cost })
  n.decisions.push(rec)
  const names = targets.map((id) => `${id} ${SECTION_BY_ID[id].name}`).join(', ')
  if (outcome === 'false-alarm') {
    log(n, 'crit', 'FALSE ALARM', `Order for ${weak.join(', ')} not backed by evidence. Trust ${delta}%.`, `สั่งอพยพ ${weak.join(', ')} โดยหลักฐานไม่พอ (SFVI < ${SFVI.decisionBand}) — เตือนผิดครั้งที่ ${n.falseAlarms} ความเชื่อมั่น ${delta}%`)
    toast(n, 'crit', `เตือนผิด · ความเชื่อมั่น ${delta}%`)
  } else if (outcome === 'late') {
    log(n, 'crit', 'LATE WARNING', `First evacuation order with water already in town.`, `ประกาศอพยพครั้งแรกตอนน้ำเข้าเมืองแล้ว — เตือนช้า −${TRUST.lateWarningPenalty}%`)
    toast(n, 'crit', `เตือนช้า −${TRUST.lateWarningPenalty}%`)
  } else {
    log(n, 'good', 'ORDER', `Evacuation ordered: ${names} (฿${fmt(cost)}).`, `สั่งอพยพ ${names} · งบ ฿${fmt(cost)}`)
    toast(n, 'ok', `สั่งอพยพ ${targets.length} โซน`)
  }
  return spend(n, scn, CMD_MIN.evacuate)
}

export function decisionRecord(n, sf, rec) {
  return {
    act: n.act, clock: n.clock, clockLabel: clockLabel(n.clock), eventTime: clockToDate(n.clock),
    water: +levelAt(n.clock).toFixed(2), sfvi: +sf.basin.toFixed(3), confidence: +sf.confidence.toFixed(2),
    justified: sf.justified, layersOpened: n.layersOpened.length, layersActive: Object.values(n.layers).filter(Boolean).length,
    swaths: n.images.filter((i) => i.usable).length, recommended: sf.recommended, at: Date.now(),
    channelMeasured: n.channel.measured, gapsSealed: n.sealed.length, trustAfter: n.trust, ...rec,
  }
}

/* ── Act 2 · sensors and field tools ──────────────────────────────────────── */

export function orderPass2(s, scn, passId) {
  const q = scn.act2Passes.find((p) => p.id === passId)
  if (!q || s.act !== 2 || s.clock >= q.t || s.act2Orders[passId]) return s
  const n = clone(s)
  n.act2Orders[passId] = true
  log(n, 'info', 'THEOS-2', `${passId} tasked over AOI-A at ${clockLabel(q.t)}.`, `สั่ง THEOS-2 รอบ ${passId} ถ่ายตัวเมือง เวลา ${clockLabel(q.t)} — จะเห็นเฉพาะโซนที่เมฆไม่บังตอนนั้น`)
  return spend(n, scn, CMD_MIN.pass2)
}

const free = (list, t) => list.find((x) => x.busyUntil <= t)

export function droneSortie(s, scn, sectionId) {
  const n = clone(s)
  const d = free(n.drones, n.clock)
  if (!d) { toast(n, 'warn', 'โดรนไม่ว่าง'); return n }
  if (!afford(n, COSTS.drone, 'เที่ยวบินโดรน')) return n
  d.busyUntil = n.clock + DURATIONS.droneSortie
  n.jobs.push({ kind: 'drone', section: sectionId, drone: d.id, start: n.clock, at: d.busyUntil })
  log(n, 'info', 'UAV', `Drone ${d.id} to ${sectionId}.`, `ส่งโดรน ${d.id} สำรวจโซน ${sectionId} (${DURATIONS.droneSortie} นาที) — ตัวช่วยสำหรับจุดอับ/ใต้เมฆ`)
  return spend(n, scn, CMD_MIN.drone)
}

export function deployPump(s, scn, sectionId) {
  if (s.pumps[sectionId]) return s
  const n = clone(s)
  if (Object.keys(n.pumps).length >= mode(n).pumps) { toast(n, 'warn', 'เครื่องสูบน้ำหมดแล้ว'); return n }
  if (!afford(n, COSTS.pump, 'เครื่องสูบน้ำ')) return n
  n.pumps[sectionId] = { readyAt: n.clock + DURATIONS.pumpSetup }
  n.jobs.push({ kind: 'pump', section: sectionId, start: n.clock, at: n.clock + DURATIONS.pumpSetup })
  log(n, 'info', 'PUMP', `Pump to ${sectionId}.`, `ติดตั้งเครื่องสูบน้ำโซน ${sectionId} (${DURATIONS.pumpSetup / 60} ชม.)`)
  return spend(n, scn, CMD_MIN.pump)
}

export function cutPower(s, scn, sectionId) {
  if (s.powerCut[sectionId] || s.jobs.some((j) => j.kind === 'power' && j.section === sectionId)) return s
  const n = clone(s)
  n.jobs.push({ kind: 'power', section: sectionId, start: n.clock, at: n.clock + DURATIONS.powerCut })
  log(n, 'info', 'กฟภ.', `Power isolation requested for ${sectionId}.`, `ประสาน กฟภ. ตัดไฟโซน ${sectionId} (${DURATIONS.powerCut} นาที)`)
  return spend(n, scn, CMD_MIN.power)
}

export function buildTower(s, scn, sectionId) {
  if (s.towers[sectionId] || s.jobs.some((j) => j.kind === 'tower' && j.section === sectionId)) return s
  const n = clone(s)
  if (!afford(n, COSTS.tower, 'เสาสื่อสาร')) return n
  n.jobs.push({ kind: 'tower', section: sectionId, start: n.clock, at: n.clock + DURATIONS.towerSetup })
  log(n, 'info', 'COMMS', `Mobile cell site for ${sectionId}.`, `ส่งเสาสื่อสารเคลื่อนที่ไปโซน ${sectionId} (${DURATIONS.towerSetup / 60} ชม.)`)
  return spend(n, scn, CMD_MIN.tower)
}

/** Boat dispatch with the route the player chose. `plan` comes from routes.planTrip. */
export function dispatchBoat(s, scn, { pointId, mission, dest, plan, optionIdx }) {
  const n = clone(s)
  const p = n.points.find((x) => x.id === pointId)
  const boat = free(n.boats, n.clock)
  const opt = plan.options[optionIdx]
  if (!p || !boat || !opt || p.status !== 'waiting') return s
  if (n.commDown.includes(p.section)) { toast(n, 'warn', 'ติดต่อทีมในโซนนี้ไม่ได้ — ตั้งเสาสื่อสารก่อน'); return n }
  if (n.fuel.used + opt.fuelL > n.fuel.total) { log(n, 'crit', 'FUEL', 'Not enough fuel.', 'น้ำมันเรือไม่พอสำหรับเที่ยวนี้'); toast(n, 'crit', 'น้ำมันไม่พอ'); return n }
  const kitCost = mission === 'supply' ? Math.ceil(p.people / 3.2) * COSTS.kit : 0
  if (!afford(n, COSTS.boatTrip + kitCost, mission === 'supply' ? 'ถุงยังชีพ' : 'เที่ยวเรือ')) return n
  const grade = gradeChoice(plan, opt)
  let delay = 0
  if (grade.kind !== 'ok') {
    n.routeErrors += 1
    if (grade.kind === 'unsafe') delay = 90
    log(n, 'crit', 'ROUTE', grade.th, `${grade.th}${delay ? ' — เรือต้องถอยกลับหาทางใหม่ เสียเวลา 90 นาที' : ''} · คะแนนลดลง`)
    toast(n, 'crit', grade.kind === 'unsafe' ? 'คำนวณเส้นทางผิด!' : 'เส้นทางไม่ใช่เส้นที่ดีที่สุด')
  }
  n.fuel.used = Math.round((n.fuel.used + opt.fuelL) * 10) / 10
  const min = (m) => Math.round((m / 1000 / BOAT.speedKmh) * 60)
  const tPoint = n.clock + delay + min(opt.leg1M)
  const tDest = tPoint + DURATIONS.load + min(opt.leg2M)
  const tHome = tDest + DURATIONS.load + min(opt.backM)
  boat.busyUntil = mission === 'supply' ? tPoint + min(opt.leg2M) : tHome
  n.jobs.push({ kind: 'boatAtPoint', boat: boat.id, point: p.id, mission, dest, atDest: tDest, at: tPoint, start: n.clock, coords: opt.coords, back: opt.back, home: boat.busyUntil, splitAt: opt.splitAt, legs: { l2: opt.leg2M, back: opt.backM } })
  n.trips += 1
  if (mission !== 'supply') p.status = 'waiting'
  p.assigned = (p.assigned || 0) + 1
  const dn = mission === 'supply' ? 'ส่งถุงยังชีพ' : `อพยพไป${destOf(dest)?.th}`
  log(n, 'info', 'BOAT', `${boat.id} → ${p.id} (${(opt.distanceM / 1000).toFixed(1)} km, ${opt.fuelL} L).`, `เรือ ${boat.id} ออกไป ${p.id} · ${dn} · ${(opt.distanceM / 1000).toFixed(1)} กม. · น้ำมัน ${opt.fuelL} ลิตร`)
  return spend(n, scn, CMD_MIN.boat)
}

/* ── Act 3 · relief ───────────────────────────────────────────────────────── */

export function reviewRoof(s, scn, roofId) {
  if (s.reviewed.includes(roofId)) return s
  const n = clone(s)
  n.reviewed.push(roofId)
  n.clock += Math.round(DURATIONS.reviewDays * 1440)
  return n
}
export function survey(s, scn, roofId) {
  if (s.surveyed.includes(roofId) || s.jobs.some((j) => j.kind === 'survey' && j.roof === roofId)) return s
  const n = clone(s)
  if (!afford(n, RELIEF.surveyCost, 'ส่งทีมสำรวจ')) return n
  n.surveyed.push(roofId)
  n.clock += Math.round(DURATIONS.surveyDays * 1440)
  log(n, 'info', 'SURVEY', `Ground survey for ${roofId}.`, `ส่งทีมสำรวจภาคพื้น ${roofId} — แม่นแต่ใช้เวลา ${DURATIONS.surveyDays} วัน`)
  return n
}
export function adjudicate(s, scn, roofId, verdict) {
  const n = clone(s)
  n.adjudged[roofId] = verdict
  return n
}

export { HOSPITAL }
