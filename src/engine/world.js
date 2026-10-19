/* ══════════════════════════════════════════════════════════════════════════
   WORLD — game state, and what happens as the mission clock runs
   สถานะเกม + เหตุการณ์ตามเวลา: ดาวเทียมโคจร · ภาพพร้อม · งานทีมเสร็จ · พายุ ·
   ไฟฟ้ารั่ว · เรดาร์อัปเดต · สายด่วน · เส้นตายผู้ติดค้าง · จบองก์
   ทุกฟังก์ชันเป็น pure: รับ state เดิม คืน state ใหม่ (log อยู่ใน state.logs)
   ══════════════════════════════════════════════════════════════════════════ */

import { THEOS2, MODES, MISSION, BOAT, FUEL_FACTOR, ACT2, DURATIONS, THRESHOLDS, TIME, STRESS } from '../config/missionConfig'
import { CAMP_SITES, HOSPITAL, SHELTER_POOL } from '../config/scenarioData'
import { SECTIONS, SECTION_BY_ID } from '../lib/sections'
import { T_START, levelAt } from '../lib/hydro'
import { makePoints, arrivalAt, peakDepth, HARM_M } from '../lib/sim'
import { clearSections } from '../lib/clouds'
import { routeOffline } from '../lib/geo'
import { clockLabel, fmt } from '../lib/format'

let SEQ = 0
export const mkLog = (lv, tag, msg, th) => ({ id: ++SEQ, lv, tag, msg, th, stamp: new Date() })
export function log(n, lv, tag, msg, th) { n.logs = [mkLog(lv, tag, msg, th), ...n.logs].slice(0, 120) }
export function toast(n, kind, text) { n.toasts = [...(n.toasts || []), { kind, text, id: ++SEQ }] }
/** Something the commander must react to — "advance to next event" stops here. */
export function event(n, kind, th) { n.eventSeq = (n.eventSeq || 0) + 1; n.lastEvent = { kind, th, at: n.clock } }

export const campOf = (s) => CAMP_SITES.find((c) => c.id === s.camp) || null
export const shelterList = (scn) => scn.shelters.map((id) => SHELTER_POOL.find((x) => x.id === id))
export const destOf = (id) => (id === 'hosp' ? HOSPITAL : SHELTER_POOL.find((x) => x.id === id))

export function makeInitial(modeId, seed, stress = []) {
  const mode = MODES[modeId] || MODES.beginner
  SEQ = 0
  const list = (stress || []).filter((k) => STRESS[k])
  const t0 = list.includes('time') ? STRESS.time.startH * 60 : T_START   // Stress Test "less time": the warning came late
  const logs = [mkLog('info', 'SYSTEM', 'Mae Sai Incident Command Post online — THEOS-2 tasking window open.', 'ศูนย์บัญชาการเหตุการณ์อุทกภัยแม่สายออนไลน์ · หน้าต่างสั่งถ่าย THEOS-2 เปิดแล้ว')]
  if (list.length) logs.unshift(mkLog('crit', 'STRESS TEST', `Stress test: ${list.map((k) => STRESS[k].en).join(', ')}.`, `โหมด Stress Test: ${list.map((k) => STRESS[k].th).join(' · ')} — กฎการตัดสินใจเดิมยังใช้ได้ไหม?`))
  return {
    modeId, seed, stress: list, t0,
    act: 1, clock: t0,
    budget: { total: mode.budget, spent: 0 },
    trust: 100, trustHist: [100],
    falseAlarms: 0, warnedAt: null,
    layers: { theos: true, elev: true, buildings: true }, layersOpened: [],
    hints: {},                        // hint-ladder topic → highest rung opened (rung 1 = the free question)
    // act 1
    camp: null,
    taskings: {},                     // passId → targets requested before the pass
    images: [],                       // THEOS-2 acquisitions
    channel: { measured: false, attempts: 0, at: null, lastInput: null },
    sealed: [], crews: Array.from({ length: mode.crews }, (_, i) => ({ id: `C${i + 1}`, busyUntil: t0 })),
    orders: {},                       // zone id → minute of the evacuation order
    routes: {},                       // zone id → evacuation route to a shelter (Sphere / offline)
    decisions: [],
    vetoAck: false, act1Done: false,
    // act 2
    points: [], boats: [], drones: [], fuel: { total: 0, used: 0 },
    pumps: {}, powerCut: {}, towers: {}, commDown: [], stormHit: false, hazardsLive: [],
    act2Orders: {}, act2Shots: [], radarAt: [],
    routeErrors: 0, wrongDest: 0, trips: 0, hospital: 0, sheltered: 0, campFlooded: false, act2Done: false,
    routeLog: [],                     // every boat route chosen vs the best one — for the "what if" debrief
    // act 3
    adjudged: {}, surveyed: [], reviewed: [], act3Done: false,
    jobs: [],
    logs,
    toasts: [],
    eventSeq: 0, lastEvent: null,
    resetSeq: 0,
  }
}

const clone = (s) => structuredClone(s)

/* ── Act transitions ──────────────────────────────────────────────────────── */

export function enterAct2(s, scn) {
  const n = clone(s)
  const mode = MODES[n.modeId]
  n.act = 2; n.clock = 0; n.act1Done = true; n.toasts = []
  if (!n.camp) {
    n.camp = CAMP_SITES[0].id
    log(n, 'warn', 'CAMP', 'No forward base was chosen — the district office was assigned by default.', 'ไม่ได้ตั้งฐานบัญชาการ — ระบบตั้งที่ที่ว่าการอำเภอให้อัตโนมัติ')
  }
  n.points = makePoints(n, scn)
  n.boats = Array.from({ length: mode.boats }, (_, i) => ({ id: `B${i + 1}`, busyUntil: 0 }))
  n.drones = Array.from({ length: mode.drones }, (_, i) => ({ id: `D${i + 1}`, busyUntil: 0 }))
  // fuel = 140% of the litres the optimal plan would burn
  const camp = campOf(n)
  let need = 0
  const from = [camp.lon, camp.lat]
  for (const p of n.points) {
    // optimal round trip on the road graph (the best safe option is at most this long in practice)
    const at = [p.lon, p.lat]
    const dest = p.injured ? HOSPITAL : destOf(scn.shelters[0])
    const out = routeOffline(from, at, () => false, () => 1)
    const on = p.type === 'critical' ? routeOffline(at, [dest.lon, dest.lat], () => false, () => 1) : null
    const back = p.type === 'critical' ? routeOffline([dest.lon, dest.lat], from, () => false, () => 1) : out
    // one run out, then shuttles point ⇄ destination until the point is clear, then home
    const shuttles = p.type === 'critical' ? Math.ceil(p.people / BOAT.capacity) - 1 : 0
    const km = ((out?.distanceM || 0) + (on?.distanceM || 0) * (1 + 2 * shuttles) + (back?.distanceM || 0)) / 1000
    need += km * BOAT.fuelLPerKm * 1.1
  }
  n.fuel = { total: Math.max(60, Math.round(need * FUEL_FACTOR)), used: 0, optimal: Math.round(need) }
  // a camp in a flooding zone has to relocate first
  const campSec = SECTIONS.reduce((m, z) => (Math.hypot(z.c[0] - camp.lon, z.c[1] - camp.lat) < Math.hypot(m.c[0] - camp.lon, m.c[1] - camp.lat) ? z : m))
  const nearSec = Math.hypot((campSec.c[0] - camp.lon) * 104000, (campSec.c[1] - camp.lat) * 110540) < 700
  if (nearSec && peakDepth(n, campSec) >= HARM_M) {
    n.campFlooded = true
    n.boats.forEach((b) => { b.busyUntil = 180 })
    log(n, 'crit', 'CAMP FLOODED', `Forward base at ${camp.th} is under water — boats relocating for 3 h.`, `ฐาน${camp.th}น้ำท่วม ต้องย้ายฐาน เรือออกปฏิบัติงานได้หลัง T+3 ชม.`)
  }
  n.radarAt = [0]
  log(n, 'crit', 'T+0', 'The flood crest is in town. Clouds drift across Mae Sai — task THEOS-2 into the gaps; radar (เช็คน้ำ) updates every 6 h.',
    'มวลน้ำเข้าเมืองแล้ว เมฆเคลื่อนผ่าน 35–65% — สั่ง THEOS-2 ถ่ายช่องที่เมฆเปิด · เรดาร์เช็คน้ำอัปเดตทุก 6 ชม.')
  log(n, 'info', 'FUEL', `Boat fuel allocated: ${fmt(n.fuel.total)} L (140% of the optimal plan).`, `จัดสรรน้ำมันเรือ ${fmt(n.fuel.total)} ลิตร (140% ของแผนที่ดีที่สุด) — วางเส้นทางผิดจะเปลืองน้ำมันและเสียคะแนน`)
  return n
}

export function enterAct3(s) {
  const n = clone(s)
  n.act = 3; n.clock = MISSION.act2EndMin; n.act2Done = true; n.toasts = []
  // anyone still waiting when the water recedes counts as harmed
  for (const p of n.points) if (p.left > 0 && p.status !== 'supplied' && p.status !== 'lost') { p.lost += p.type === 'critical' ? p.left : 0; p.status = p.type === 'critical' ? 'lost' : 'suffered' }
  n.boats.forEach((b) => { b.busyUntil = 0 }); n.jobs = n.jobs.filter((j) => j.kind === 'survey')
  log(n, 'info', 'RECOVERY', 'Water recedes. THEOS-2 post-event imagery and the radar time series are in — adjudicate relief roof by roof.',
    'น้ำลดแล้ว ได้ภาพ THEOS-2 หลังเหตุการณ์และไทม์ซีรีส์เรดาร์ — พิจารณาเยียวยารายหลังคา ภายในวันที่ 60')
  return n
}

/* ── Time ─────────────────────────────────────────────────────────────────── */

const pointActive = (n, p) => n.clock >= (SECTION_BY_ID[p.section] ? arrivalCache(n, p.section) : 0)
const ARR = new Map()
function arrivalCache(n, id) {
  const key = `${id}|${n.sealed.length}`
  if (!ARR.has(key)) ARR.set(key, Math.max(0, arrivalAt(n, SECTION_BY_ID[id])))
  return ARR.get(key)
}

function reveal(n, p, how, at = n.clock) {
  if (p.revealed || p.status !== 'waiting') return false
  p.revealed = how; p.revealedAt = at
  return true
}

/** Process everything that happens between the current clock and `to`. */
export function advanceTo(s, scn, to) {
  if (to <= s.clock) return s
  const n = clone(s)
  const from = n.clock
  n.clock = to
  const crossed = (t) => t > from && t <= to

  if (n.act === 1) {
    for (const pass of scn.passes) {
      if (crossed(pass.t - TIME.prePassWarnMin) && !(n.taskings[pass.id] || []).length) {
        log(n, 'warn', 'THEOS-2', `${pass.id} overhead in ${TIME.prePassWarnMin} min — no targets selected.`, `THEOS-2 รอบ ${pass.id} จะผ่านใน ${TIME.prePassWarnMin} นาที แต่ยังไม่ได้เลือกเป้าหมาย`)
        event(n, 'prepass', `THEOS-2 รอบ ${pass.id} กำลังจะผ่าน — เลือกเป้าหมายก่อน (หรือกดเดินเวลาต่อเพื่อข้ามรอบนี้)`)
      }
      if (!crossed(pass.t)) continue
      const targets = n.taskings[pass.id] || []
      if (!targets.length) { log(n, 'info', 'THEOS-2', `${pass.id} passed with no tasking.`, `ดาวเทียม THEOS-2 รอบ ${pass.id} ผ่านไปโดยไม่ได้สั่งถ่าย`); continue }
      if (scn.stress?.lostPass === pass.id) {
        log(n, 'crit', 'STRESS · DOWNLINK', `${pass.id}: ground station lost the downlink — no images from this pass.`, `สถานีภาครับสัญญาณ THEOS-2 รอบ ${pass.id} ไม่ได้ — ภาพรอบนี้สูญหายทั้งหมด (Stress Test: ข้อมูลหาย)`)
        toast(n, 'crit', `ภาพรอบ ${pass.id} สูญหาย`)
        event(n, 'lostpass', `สถานีภาครับสัญญาณ THEOS-2 รอบ ${pass.id} ไม่ได้ — ต้องตัดสินใจด้วยข้อมูลที่มี`)
        continue
      }
      for (const tg of targets) {
        const cloud = pass.actual[tg]
        const usable = cloud <= THEOS2.cloudUsablePct
        n.images.push({ id: `${pass.id}-${tg}`, passId: pass.id, target: tg, takenAt: pass.t, readyAt: pass.t + THEOS2.processingMin, cloud, usable, analyzed: false, labels: {} })
        log(n, usable ? 'good' : 'warn', 'THEOS-2', `${pass.id} acquired ${tg} · cloud ${cloud}%${usable ? '' : ' — no usable ground pixels'}.`,
          usable ? `THEOS-2 ถ่าย ${tg === 'TOWN' ? 'ตัวเมือง' : `Sector ${tg}`} สำเร็จ (เมฆ ${cloud}%) — ภาพ L3 Ortho พร้อมใน 2 ชม.` : `THEOS-2 ถ่าย ${tg === 'TOWN' ? 'ตัวเมือง' : `Sector ${tg}`} แต่เมฆบัง ${cloud}% มองไม่เห็นพื้นดิน`)
      }
    }
    const ready = n.images.filter((img) => crossed(img.readyAt))
    if (ready.length) {
      const ok = ready.filter((i) => i.usable)
      for (const img of ok) toast(n, 'ok', `ภาพ THEOS-2 ${img.target === 'TOWN' ? 'ตัวเมือง' : `Sector ${img.target}`} พร้อมวิเคราะห์`)
      event(n, 'images', `ได้ภาพ THEOS-2 ${ready.length} ภาพ · ใช้ได้ ${ok.length}${ok.length < ready.length ? ` · เมฆบัง ${ready.length - ok.length}` : ''}`)
    }
    const prep = THRESHOLDS.prepLevel - (n.channel.measured && scn.channel.widthM < THRESHOLDS.origChannelWidth * THRESHOLDS.narrowChannelRatio ? THRESHOLDS.narrowChannelPrepDrop : 0)
    const l0 = levelAt(from), l1 = levelAt(Math.min(to, 0))
    if (l0 < prep && l1 >= prep) event(n, 'prep', `ระดับน้ำถ้ำผาจมถึงเกณฑ์เตรียมพร้อม ${prep.toFixed(2)} ม.`)
    if (l0 < THRESHOLDS.criticalLevel && l1 >= THRESHOLDS.criticalLevel) event(n, 'crit', `ระดับน้ำถึงเกณฑ์วิกฤต ${THRESHOLDS.criticalLevel.toFixed(2)} ม. — Veto 1`)
  }

  // field jobs (crews, pumps, towers, power cuts, drones, boats)
  const due = n.jobs.filter((j) => j.at <= to).sort((a, b) => a.at - b.at)
  n.jobs = n.jobs.filter((j) => j.at > to)
  for (const j of due) finishJob(n, scn, j)

  if (n.act === 2) {
    if (crossed(scn.stormAt)) {
      n.stormHit = true
      n.commDown = scn.commDown.filter((id) => !n.towers[id])
      log(n, 'crit', 'STORM', `Storm cell knocked out mobile networks in ${n.commDown.join(', ')}.`, `พายุทำให้สัญญาณสื่อสารล่มในโซน ${n.commDown.join(', ')} — สั่งการทีมเข้าโซนนี้ไม่ได้ ต้องตั้งเสาสื่อสาร`)
      toast(n, 'crit', `พายุตัดสัญญาณ ${n.commDown.length} โซน`)
      event(n, 'storm', `พายุตัดสัญญาณสื่อสาร ${n.commDown.length} โซน`)
    }
    for (const hz of scn.powerHazards) {
      if (crossed(hz.at)) {
        n.hazardsLive = [...new Set([...n.hazardsLive, hz.id])]
        log(n, 'crit', 'POWER', `Live current reported in ${hz.id} — isolate power before sending teams in.`, `พบไฟฟ้ารั่วในโซน ${hz.id} (${SECTION_BY_ID[hz.id].name}) — ต้องตัดไฟก่อนส่งทีมเข้า`)
        toast(n, 'crit', `ไฟฟ้ารั่ว · โซน ${hz.id}`)
        event(n, 'power', `พบไฟฟ้ารั่วโซน ${hz.id}`)
      }
    }
    for (let h = ACT2.radarRevisitH * 60; h <= to; h += ACT2.radarRevisitH * 60) {
      if (crossed(h)) { n.radarAt.push(h); log(n, 'info', 'เช็คน้ำ', `RADARSAT-2 flood depth update ${clockLabel(h)}.`, 'เรดาร์ (เช็คน้ำ) อัปเดตความลึกน้ำรายโซนแล้ว') }
    }
    for (const q of scn.act2Passes) {
      if (!crossed(q.t)) continue
      if (!n.act2Orders[q.id]) { log(n, 'warn', 'THEOS-2', `${q.id} passed over town — not tasked.`, `THEOS-2 รอบ ${q.id} ผ่านเมืองไปโดยไม่ได้สั่งถ่าย`); continue }
      if (scn.stress?.lostQ === q.id) {
        n.act2Shots.push({ id: q.id, t: q.t, clear: [], lost: true })
        log(n, 'crit', 'STRESS · AWAGAD', `${q.id}: processing failed — no image.`, `ประมวลผลภาพ THEOS-2 รอบ ${q.id} ล้มเหลว — ไม่ได้ภาพ (Stress Test: ข้อมูลหาย) ใช้สายด่วนและโดรนแทน`)
        toast(n, 'crit', `ภาพรอบ ${q.id} สูญหาย`)
        event(n, 'lostpass', `ภาพ THEOS-2 รอบ ${q.id} สูญหาย — ใช้สายด่วนและโดรนแทน`)
        continue
      }
      const clear = clearSections(scn, q.t)
      let found = 0
      for (const p of n.points) {
        if (clear.includes(p.section) && !scn.blindSpots.includes(p.section) && pointActive(n, p) && reveal(n, p, 'theos', q.t)) found++
      }
      n.act2Shots.push({ id: q.id, t: q.t, clear })
      log(n, 'good', 'THEOS-2', `${q.id}: ${clear.length}/10 zones clear of cloud — ${found} stranded groups located.`,
        `THEOS-2 รอบ ${q.id} เห็นพื้นดิน ${clear.length}/10 โซน (ที่เหลือเมฆบัง) · พบผู้ติดค้างใหม่ ${found} จุด`)
      toast(n, 'ok', `THEOS-2 พบผู้ติดค้าง ${found} จุด`)
      event(n, 'theos', `THEOS-2 รอบ ${q.id} เห็นพื้นดิน ${clear.length}/10 โซน · พบผู้ติดค้าง ${found} จุด`)
    }
    for (const p of n.points) {
      if (p.status !== 'waiting') continue
      if (!p.revealed && to >= p.hotlineAt && pointActive(n, p) && !n.commDown.includes(p.section) && reveal(n, p, 'hotline', Math.max(from, p.hotlineAt))) {
        log(n, 'warn', '1784', `Hotline: ${p.people} people stranded in ${p.section}.`, `สายด่วน 1784 แจ้ง: ผู้ติดค้าง ${p.people} คน โซน ${p.section}`)
        event(n, 'hotline', `สายด่วน 1784: ผู้ติดค้าง ${p.people} คน โซน ${p.section}`)
      }
      if (to >= p.deadline) {
        if (p.type === 'hardship') {
          p.type = 'critical'; p.escalated = p.deadline; p.deadline = to + 6 * 60
          log(n, 'crit', 'ESCALATION', `${p.id}: supplies never arrived — now needs evacuation.`, `${p.id}: ไม่ได้รับเสบียง อาการทรุด ต้องอพยพด้วยเรือภายใน 6 ชม.`)
          event(n, 'escalate', `${p.id} ไม่ได้รับเสบียง — ต้องอพยพด่วน`)
        } else {
          p.lost += p.left; p.left = 0; p.status = 'lost'; p.lostAt = p.deadline
          log(n, 'crit', 'CASUALTIES', `${p.id}: water overtook the house before rescue.`, `${p.id}: น้ำท่วมมิดก่อนเรือไปถึง — มีผู้สูญเสีย`)
          toast(n, 'crit', `ไม่ทันเวลา · ${p.id}`)
          event(n, 'lost', `${p.id} ช่วยไม่ทัน — น้ำท่วมมิดบ้าน`)
        }
      }
    }
  }
  if (n.act === 1 && to >= 0 && from < 0) n.clock = 0
  if (n.act === 2 && to >= MISSION.act2EndMin) n.clock = MISSION.act2EndMin
  return n
}

/* ── Job completion ───────────────────────────────────────────────────────── */

function finishJob(n, scn, j) {
  switch (j.kind) {
    case 'seal':
      if (!n.sealed.includes(j.gap)) n.sealed.push(j.gap)
      log(n, 'good', 'EMBANKMENT', `${j.crew} sealed ${j.gap}.`, `ทีม ${j.crew} อุดจุดฟันหลอ ${j.gap} เสร็จ — น้ำหลังแนวกั้นลดลง`)
      break
    case 'pump':
      log(n, 'good', 'PUMP', `Pump running in ${j.section}.`, `เครื่องสูบน้ำโซน ${j.section} ทำงานแล้ว — น้ำลด ${ACT2.pumpReliefM} ม. เปิดทางให้เรือ/รถ`)
      event(n, 'pump', `เครื่องสูบน้ำโซน ${j.section} ทำงานแล้ว`)
      break
    case 'tower':
      n.towers[j.section] = true
      n.commDown = n.commDown.filter((id) => id !== j.section)
      log(n, 'good', 'COMMS', `Mobile cell site up in ${j.section}.`, `ตั้งเสาสื่อสารโซน ${j.section} เสร็จ — สั่งการทีมและรับแจ้งเหตุได้แล้ว`)
      toast(n, 'ok', `สัญญาณกลับมา · โซน ${j.section}`)
      event(n, 'tower', `เสาสื่อสารโซน ${j.section} ใช้งานได้`)
      break
    case 'power':
      n.powerCut[j.section] = true
      log(n, 'good', 'กฟภ.', `Power isolated in ${j.section}.`, `กฟภ. ตัดไฟโซน ${j.section} แล้ว — ส่งทีมเข้าได้อย่างปลอดภัย`)
      event(n, 'powercut', `ตัดไฟโซน ${j.section} แล้ว`)
      break
    case 'drone': {
      let found = 0
      for (const p of n.points) if (p.section === j.section && pointActive(n, p) && reveal(n, p, 'drone', j.at)) found++
      log(n, 'good', 'UAV', `Drone sortie over ${j.section}: ${found} groups found.`, `โดรนบินสำรวจโซน ${j.section} พบผู้ติดค้าง ${found} จุด`)
      toast(n, found ? 'ok' : 'warn', `โดรนโซน ${j.section}: พบ ${found} จุด`)
      event(n, 'drone', `โดรนโซน ${j.section} พบผู้ติดค้าง ${found} จุด`)
      break
    }
    case 'boatAtPoint': {
      const p = n.points.find((x) => x.id === j.point)
      if (!p || p.status === 'lost') { j.aboard = 0; break }
      if (j.mission === 'supply') {
        p.status = 'supplied'; p.left = 0
        log(n, 'good', 'SUPPLY', `${j.boat} delivered kits to ${p.id}.`, `เรือ ${j.boat} ส่งถุงยังชีพถึง ${p.id} — ${p.people} คนอยู่ต่อได้`)
      } else {
        const take = Math.min(p.left, BOAT.capacity)
        if (!take) { j.aboard = 0; break }            // another boat already cleared the point
        const inj = Math.min(p.injured - p.toHospital - (p.injAboard || 0), take)
        p.left -= take; p.injAboard = (p.injAboard || 0) + Math.max(0, inj)
        n.jobs.push({ ...j, kind: 'boatAtDest', pointAt: j.at, aboard: take, injured: Math.max(0, inj), at: j.atDest })
        log(n, 'good', 'RESCUE', `${j.boat} picked up ${take} people at ${p.id}.`, `เรือ ${j.boat} รับผู้ติดค้าง ${take} คนที่ ${p.id}${p.left ? ` (เหลืออีก ${p.left})` : ''}`)
      }
      break
    }
    case 'boatAtDest': {
      const p = n.points.find((x) => x.id === j.point)
      if (!p) break
      p.rescued += j.aboard; p.injAboard = Math.max(0, (p.injAboard || 0) - j.injured)
      if (j.dest === 'hosp') { n.hospital += j.aboard; p.toHospital += j.injured }
      else {
        n.sheltered += j.aboard
        if (j.injured) {
          n.wrongDest++
          log(n, 'crit', 'MEDICAL', `${j.injured} injured taken to a shelter instead of hospital.`, `ส่งผู้บาดเจ็บ ${j.injured} คนไปจุดอพยพแทนโรงพยาบาล — ต้องส่งต่อ เสียคะแนน`)
          toast(n, 'crit', 'ผู้บาดเจ็บต้องไปโรงพยาบาล')
        }
      }
      if (p.left === 0 && p.status === 'waiting') p.status = 'rescued'
      log(n, 'good', 'DELIVERED', `${j.boat} landed ${j.aboard} people at ${destOf(j.dest)?.th}.`, `เรือ ${j.boat} ส่ง ${j.aboard} คนถึง${destOf(j.dest)?.th}`)
      shuttle(n, j, p)
      break
    }
    case 'boatHome':
      break
    case 'survey':
      if (!n.surveyed.includes(j.roof)) n.surveyed.push(j.roof)
      log(n, 'info', 'SURVEY', `Field team reported on ${j.roof}.`, `ทีมสำรวจภาคพื้นรายงานผล ${j.roof} แล้ว`)
      break
    default:
  }
}

/** An evacuation boat keeps running destination ⇄ point on the same route until the point is clear. */
function shuttle(n, j, p) {
  if (!j.legs || p.status !== 'waiting' || p.left <= 0) return
  const pledged = n.jobs.filter((x) => x.kind === 'boatAtPoint' && x.point === p.id).length * BOAT.capacity
  if (p.left - pledged <= 0) return
  const fuelL = Math.round(((2 * j.legs.l2) / 1000) * BOAT.fuelLPerKm * 10) / 10
  if (n.fuel.used + fuelL > n.fuel.total) {
    log(n, 'warn', 'FUEL', `${j.boat} cannot afford another shuttle to ${p.id}.`, `น้ำมันไม่พอให้เรือ ${j.boat} วนกลับไปรับที่ ${p.id} อีก — เรือกลับฐาน`)
    return
  }
  const min = (m) => Math.round((m / 1000 / BOAT.speedKmh) * 60)
  const leg2 = j.coords.slice(j.splitAt - 1)
  const tPoint = j.at + DURATIONS.load + min(j.legs.l2)
  const tDest = tPoint + DURATIONS.load + min(j.legs.l2)
  const boat = n.boats.find((b) => b.id === j.boat)
  if (boat) boat.busyUntil = tDest + DURATIONS.load + min(j.legs.back)
  n.fuel.used = Math.round((n.fuel.used + fuelL) * 10) / 10
  n.jobs.push({ ...j, kind: 'boatAtPoint', start: j.at + DURATIONS.load, at: tPoint, atDest: tDest, coords: [...[...leg2].reverse(), ...leg2], splitAt: leg2.length, home: boat?.busyUntil, aboard: undefined, injured: undefined, pointAt: undefined })
  log(n, 'info', 'BOAT', `${j.boat} shuttling back to ${p.id} (${p.left} left).`, `เรือ ${j.boat} วนกลับไปรับที่ ${p.id} (เหลือ ${p.left} คน · น้ำมัน ${fuelL} L)`)
}

export const levelNow = (s) => levelAt(s.clock)
export const isCritical = (s) => levelAt(s.clock) >= THRESHOLDS.criticalLevel
export { DURATIONS }
