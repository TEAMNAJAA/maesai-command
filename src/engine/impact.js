/* ══════════════════════════════════════════════════════════════════════════
   IMPACT PREVIEW — "ถ้าสั่งตอนนี้จะเกิดอะไร" before an important order
   Each preview runs the real transition (engine/actions.js) on a copy of the
   state and reads the difference — budget, game time, trust — plus the
   model's forecast for that order. So the card always matches what the game
   will actually do.
   Card: { title, rows: [{ group: 'use'|'get'|'risk', tone, th, judge? }], verdict? }
   `judge` rows apply the decision rules for the player (false alarm, in time,
   wasted, worth it) — shown in Beginner, hidden in Expert (MODES.impactJudge).
   ══════════════════════════════════════════════════════════════════════════ */

import * as A from './actions'
import { destOf } from './world'
import { gradeChoice } from '../lib/routes'
import { zoneOutcome, peakDepth, arrivalAt, depthAt, computeSfvi, HARM_M, exposureSummary, sandbagFailAt } from '../lib/sim'
import { levelAt } from '../lib/hydro'
import { cloudCover } from '../lib/clouds'
import { SECTIONS, SECTION_BY_ID, GAPS_BY_SECTION } from '../lib/sections'
import { EMBANKMENT_GAPS } from '../lib/embankment'
import { metres } from '../lib/geo'
import { CAMP_SITES } from '../config/scenarioData'
import { THEOS2, THRESHOLDS, COSTS, DURATIONS, ACT2, MISSION, CMD_MIN, SFVI, EMBANKMENT, RELIEF, BOAT, MODES, RESCUE, SANDBAG, SEAL_PLANS } from '../config/missionConfig'
import { clockLabel, fmt, clamp, baht } from '../lib/format'

const hrs = (m) => (Math.abs(m) >= 60 ? `${(m / 60).toFixed(Math.round(m) % 60 ? 1 : 0)} ชม.` : `${Math.round(m)} นาที`)
const row = (group, tone, th, judge = false) => ({ group, tone, th, judge })
const tgt = (t) => (t === 'TOWN' ? 'ตัวเมือง' : `Sector ${t}`)
const RIVER = ['D', 'E', 'TOWN']
const cmd = (scn, m) => Math.round(m * (scn.stress?.cmdFactor || 1))   // Stress Test "less time": orders take longer

/* ── Act 1 ───────────────────────────────────────────────────────────────── */

export function previewEvac(s, scn, ids) {
  if (!ids.length) return null
  const after = A.orderZones(s, scn, ids)
  if (after === s || after.decisions.length === s.decisions.length) {
    return { title: `สั่งอพยพ ${ids.length} โซน`, rows: [row('risk', 'bad', 'งบประมาณไม่พอสำหรับคำสั่งนี้')], verdict: { tone: 'bad', th: 'ทำไม่ได้ — งบไม่พอ' } }
  }
  const rec = after.decisions[after.decisions.length - 1]
  const dTrust = Math.round((after.trust - s.trust) * 10) / 10
  const rows = [
    row('use', 'info', `งบ ${baht(after.budget.spent - s.budget.spent)} (${ids.length} โซน · คงเหลือ ${baht(after.budget.total - after.budget.spent)})`),
    row('use', 'info', `เวลาสั่งการ ${cmd(scn, CMD_MIN.evacuate)} นาที`),
  ]
  const zs = ids.map((id) => {
    const sec = SECTION_BY_ID[id]
    const now = zoneOutcome(after, scn, sec, after.orders[id]), none = zoneOutcome(after, scn, sec, null)
    return { id, now, gain: Math.max(0, now.safe - none.safe) }
  })
  const gain = zs.reduce((a, z) => a + z.gain, 0)
  rows.push(row('get', gain > 0 ? 'good' : 'warn', gain > 0 ? `ครัวเรือนออกจากเขตน้ำทันเพิ่มขึ้น ~${fmt(gain)} ครัวเรือน` : 'แทบไม่มีครัวเรือนที่ได้ประโยชน์เพิ่ม', true))
  const onTime = []
  for (const z of zs) {
    if (z.now.wasted || !z.now.atRisk || !Number.isFinite(z.now.arrival)) continue
    if (z.now.arrival <= s.clock) { rows.push(row('get', 'bad', `${z.id}: น้ำเข้าแล้วตั้งแต่ ${clockLabel(z.now.arrival)} — สั่งช้าไป คนส่วนใหญ่ต้องรอเรือในองก์ 2`, true)); continue }
    const pct = Math.round(z.now.timely * 100)
    if (pct >= 90 && zs.length > 3) { onTime.push(z.id); continue }
    rows.push(row('get', pct >= 90 ? 'good' : pct >= 50 ? 'warn' : 'bad', `${z.id}: น้ำถึง ${clockLabel(z.now.arrival)} · ต้องใช้ ${hrs(z.now.need)} → อพยพทัน ${pct}%`, true))
  }
  if (onTime.length) rows.push(row('get', 'good', `${onTime.join(', ')}: อพยพเสร็จก่อนน้ำถึง (≥ 90%)`, true))
  const sf = computeSfvi(s, scn)
  const score = Object.fromEntries(sf.perSection.map((x) => [x.id, x.score]))
  if (rec.outcome === 'false-alarm') {
    const weak = ids.filter((id) => score[id] < SFVI.decisionBand)
    rows.push(row('risk', 'bad', `เตือนผิด: ${weak.join(', ')} SFVI ยังต่ำกว่า ${SFVI.decisionBand} และน้ำยังไม่ถึงเกณฑ์ → ความเชื่อมั่น ${dTrust}% · คนไม่ยอมอพยพเพิ่มขึ้นในองก์ 2`, true))
  } else if (rec.outcome === 'late') {
    rows.push(row('risk', 'bad', `ประกาศครั้งแรกตอนน้ำเข้าเมืองแล้ว → เตือนช้า ความเชื่อมั่น ${dTrust}%`, true))
  } else if (rec.outcome === 'justified') {
    rows.push(row('get', 'good', `มีหลักฐานรองรับ (SFVI หรือระดับน้ำถึงเกณฑ์)${dTrust > 0 ? ` → ความเชื่อมั่น +${dTrust}%` : ''}`, true))
  }
  const wasted = zs.filter((z) => z.now.wasted).map((z) => z.id)
  if (wasted.length) rows.push(row('risk', 'warn', `${wasted.join(', ')} น้ำแทบไม่ถึง (ลึกสุด < ${HARM_M} ม.) → งบส่วนนี้เสียเปล่า`, true))
  const missed = SECTIONS.filter((z) => after.orders[z.id] === undefined && !ids.includes(z.id) && peakDepth(s, z) >= HARM_M).map((z) => z.id)
  if (missed.length) rows.push(row('risk', 'info', `ยังไม่ได้สั่ง ${missed.join(', ')} ซึ่งน้ำจะถึงเช่นกัน`, true))
  const late = zs.some((z) => !z.now.wasted && z.now.atRisk && z.now.timely < 0.5)
  const tone = rec.outcome === 'false-alarm' || rec.outcome === 'late' ? 'bad' : wasted.length || late ? 'warn' : 'good'
  return {
    title: `สั่งอพยพ ${ids.join(', ')}`, rows,
    verdict: { tone, judge: true, th: tone === 'good' ? 'คำสั่งนี้มีหลักฐานและทันเวลา' : tone === 'warn' ? 'ทำได้ แต่มีบางโซนไม่คุ้มหรือไม่ทัน' : 'ยังไม่ควรสั่งตอนนี้ — ดูความเสี่ยง' },
  }
}

export function previewCapture(s, scn, passId) {
  const pass = scn.passes.find((p) => p.id === passId)
  const targets = s.taskings[passId] || []
  if (!pass || !targets.length) return null
  const to = pass.t + THEOS2.processingMin
  const l0 = levelAt(Math.min(s.clock, 0)), l1 = levelAt(Math.min(to, 0))
  const rows = [
    row('use', 'info', `เวลาจะเดิน +${hrs(to - s.clock)} → ${clockLabel(to)} (ถ่าย + ประมวลผล ${THEOS2.processingMin / 60} ชม.)`),
    row('use', 'info', `รอบโคจร ${passId} (ใช้ได้ครั้งเดียว)`),
  ]
  let worst = 'good'
  for (const t of targets) {
    const f = pass.forecast[t]
    const chance = Math.round(clamp((THEOS2.cloudUsablePct - (f - 14)) / 28) * 100)
    rows.push(row('get', 'info', `${tgt(t)} → ${RIVER.includes(t) ? 'วัดลำน้ำ (N)' : 'หารอยดินถล่ม (L)'}${t !== 'TOWN' && RIVER.includes(t) ? ' + รอยดินถล่ม (L)' : ''}`))
    const tone = chance >= 70 ? 'good' : chance >= 35 ? 'warn' : 'bad'
    if (tone === 'bad' || (tone === 'warn' && worst === 'good')) worst = tone
    rows.push(row(tone === 'good' ? 'get' : 'risk', tone, `${tgt(t)}: เมฆพยากรณ์ ${f}% → โอกาสได้ภาพที่เห็นพื้นดิน ~${chance}%`, true))
  }
  rows.push(row('risk', 'info', `ระหว่างรอ น้ำถ้ำผาจม ${l0.toFixed(2)} → ${l1.toFixed(2)} ม.`))
  if (l0 < THRESHOLDS.criticalLevel && l1 >= THRESHOLDS.criticalLevel) rows.push(row('risk', 'bad', `น้ำจะถึงเกณฑ์วิกฤต ${THRESHOLDS.criticalLevel.toFixed(2)} ม. ระหว่างรอ — คิดเรื่องอพยพก่อนกดไหม?`))
  else if (l0 < THRESHOLDS.prepLevel && l1 >= THRESHOLDS.prepLevel) rows.push(row('risk', 'warn', `น้ำจะถึงเกณฑ์เตรียมพร้อม ${THRESHOLDS.prepLevel.toFixed(2)} ม. ระหว่างรอ`))
  return { title: `ให้ THEOS-2 ถ่ายรอบ ${passId}`, rows, verdict: { tone: worst, judge: true, th: worst === 'good' ? 'คาดว่าได้ภาพใช้ได้' : worst === 'warn' ? 'ลุ้นเมฆ — บางเป้าอาจใช้ไม่ได้' : 'มีเป้าที่เมฆหนาเกินไป' } }
}

const PLAN_TH = { risk: 'บิ๊กแบ็กเฉพาะจุดเสี่ยง', full: 'บิ๊กแบ็กทั้งแนว', sandbag: 'กระสอบทรายชั่วคราวทั้งแนว', none: 'ไม่อุด — เก็บงบไว้อพยพ' }

/** B4: what an embankment plan costs, when it is done, what it buys — and what it leaves open. */
export function previewSealPlan(s, scn, plan) {
  if (s.act !== 1 || !SEAL_PLANS[plan]) return null
  const title = PLAN_TH[plan]
  const after = A.sealPlan(s, scn, plan)
  const ids = A.sealTargets(s, scn, plan)
  const open = (st) => EMBANKMENT_GAPS.filter((g) => !st.sealed.includes(g.id) || (st.sandbagged || []).includes(g.id)).length
  // the embankment as it would stand when the crews finish (the model, not the future)
  const done = { ...after, sealed: [...new Set([...after.sealed, ...after.jobs.filter((j) => j.kind === 'seal').map((j) => j.gap)])],
    sandbagged: [...new Set([...(after.sandbagged || []), ...after.jobs.filter((j) => j.kind === 'seal' && j.bag === 'sandbag').map((j) => j.gap)])] }
  const exNow = exposureSummary(s, scn), exDone = exposureSummary(done, scn)
  const rows = []
  if (plan === 'none') {
    const bags = EMBANKMENT_GAPS.filter((g) => !s.sealed.includes(g.id)).reduce((a, g) => a + g.len * EMBANKMENT.bagsPerMetre, 0)
    rows.push(row('use', 'info', `ไม่ใช้งบตลิ่ง · ประหยัด ${baht(bags * COSTS.bigbag)} ไว้สั่งอพยพ`))
    rows.push(row('use', 'info', `เวลาสั่งการ ${cmd(scn, CMD_MIN.seal)} นาที · ทีมว่างไว้ทำงานอื่น`))
    rows.push(row('risk', 'bad', `ช่องเปิด ${open(s)} จุด — น้ำเข้าโซนหลังตลิ่งเร็วและลึกที่สุด`, true))
    return { title, rows, verdict: { tone: 'warn', judge: true, th: 'ได้งบอพยพเพิ่ม แต่ต้องอพยพให้ทันทุกโซน' } }
  }
  if (!ids.length) return { title, rows: [row('get', 'info', 'จุดที่แผนนี้ครอบคลุมอุดแล้วหรืออยู่ในคิวแล้ว')], verdict: { tone: 'info', th: 'ไม่มีงานเพิ่ม' } }
  if (after === s) return { title, rows: [row('risk', 'bad', 'งบไม่พอแม้แต่จุดเดียว')], verdict: { tone: 'bad', th: 'ทำไม่ได้ — งบไม่พอ' } }
  const jobs = after.jobs.filter((j) => j.kind === 'seal' && ids.includes(j.gap))
  const finish = jobs.length ? Math.max(...jobs.map((j) => j.at)) : s.clock
  rows.push(row('use', 'info', `${plan === 'sandbag' ? 'กระสอบทราย' : 'บิ๊กแบ็ก'} ${jobs.length} จุด · ${baht(after.budget.spent - s.budget.spent)}`))
  rows.push(row('use', 'info', `ทีม ${s.crews.length} ชุดทำตามคิวถึง ${clockLabel(finish)}`))
  if (jobs.length < ids.length) rows.push(row('risk', 'bad', `งบพอสำหรับ ${jobs.length} จาก ${ids.length} จุด`))
  const gain = Math.max(0, exNow.exposed - exDone.exposed)
  rows.push(row('get', gain ? 'good' : 'info', gain ? `ครัวเรือนที่ยังเสี่ยงลดลง ${fmt(gain)} (ตามแบบจำลอง)` : 'น้ำเข้าโซนหลังตลิ่งช้าลงและตื้นขึ้น', true))
  if (plan === 'risk') rows.push(row('risk', 'warn', `ยังเปิดอีก ${open(done)} จุด หน้าโซนที่ SFVI ต่ำ — ถ้าหลักฐานยังไม่พอ อาจเลือกพลาด`, true))
  if (plan === 'sandbag') {
    const tf = sandbagFailAt()
    rows.push(row('risk', 'bad', `พังเมื่อน้ำถึง ${SANDBAG.failLevel.toFixed(2)} ม.${Number.isFinite(tf) ? ` (แบบจำลอง: ราว ${clockLabel(tf)})` : ''} — ช่วยได้แค่ช่วงแรก`, true))
  }
  const wet = SECTIONS.filter((z) => peakDepth(s, z) >= HARM_M)
  const first = wet.length ? Math.min(...wet.map((z) => arrivalAt(s, z))) : Infinity
  if (Number.isFinite(first) && finish > first) rows.push(row('risk', 'warn', `เสร็จ ${clockLabel(finish)} หลังน้ำเริ่มถึงบางโซน (${clockLabel(first)})`, true))
  const tone = plan === 'full' ? 'good' : plan === 'risk' ? 'good' : 'warn'
  const th = { full: 'กันได้มากที่สุด แต่แพงและช้าที่สุด', risk: 'ถูกและเร็ว — ดีเท่าที่หลักฐานบอก', sandbag: 'ถูกและเร็วที่สุด แต่พังตอนยอดน้ำ' }[plan]
  return { title, rows, verdict: { tone, judge: true, th } }
}

export function previewSeal(s, scn, ids) {
  if (!ids.length) return null
  const after = A.sealGaps(s, scn, ids)
  if (after === s) return null
  const jobs = after.jobs.filter((j) => j.kind === 'seal' && ids.includes(j.gap))
  const done = after.sealed.filter((id) => ids.includes(id))
  const started = jobs.length + done.length
  const gaps = EMBANKMENT_GAPS.filter((g) => ids.includes(g.id))
  const bags = gaps.reduce((a, g) => a + g.len * EMBANKMENT.bagsPerMetre, 0)
  if (!gaps.length) return null
  if (!started) return { title: `อุดจุดฟันหลอ ${ids.length} จุด`, rows: [row('use', 'info', `ต้องใช้ ${baht(bags * COSTS.bigbag)}`), row('risk', 'bad', 'งบประมาณไม่พอแม้แต่จุดเดียว')], verdict: { tone: 'bad', th: 'ทำไม่ได้ — งบไม่พอ' } }
  const finish = jobs.length ? Math.max(...jobs.map((j) => j.at)) : s.clock
  const rows = [
    row('use', 'info', `บิ๊กแบ็ก ${fmt(bags)} ใบ · ${baht(after.budget.spent - s.budget.spent)}`),
    row('use', 'info', `ทีม ${s.crews.length} ชุดทำตามคิวถึง ${clockLabel(finish)} (ทีมไม่ว่างระหว่างนี้)`),
    row('use', 'info', `เวลาสั่งการ ${cmd(scn, CMD_MIN.seal)} นาที`),
  ]
  if (started < ids.length) rows.push(row('risk', 'bad', `งบพอสำหรับ ${started} จาก ${ids.length} จุด`))
  const s2 = { ...s, sealed: [...new Set([...s.sealed, ...ids])] }
  let earliest = Infinity
  for (const sec of SECTIONS) {
    if (!GAPS_BY_SECTION[sec.id].some((g) => ids.includes(g))) continue
    const a0 = arrivalAt(s, sec), a1 = arrivalAt(s2, sec), p0 = peakDepth(s, sec), p1 = peakDepth(s2, sec)
    if (p0 < HARM_M) continue
    earliest = Math.min(earliest, a0)
    rows.push(row('get', 'good', `${sec.id}: น้ำถึงช้าลง ${Number.isFinite(a1) && Number.isFinite(a0) ? hrs(a1 - a0) : '—'} · ลึกสุด ${p0.toFixed(1)} → ${p1.toFixed(1)} ม.`, true))
  }
  if (Number.isFinite(earliest) && finish > earliest) rows.push(row('risk', 'warn', `ทีมอุดเสร็จ ${clockLabel(finish)} หลังน้ำเริ่มถึงบางโซน (${clockLabel(earliest)}) — จุดท้ายคิวอาจไม่ทัน`, true))
  return { title: `อุดจุดฟันหลอ ${ids.length} จุด`, rows, verdict: { tone: started < ids.length ? 'warn' : 'good', judge: true, th: 'น้ำเข้าโซนหลังตลิ่งช้าลงและตื้นขึ้น' } }
}

export function previewCamp(s, scn, id) {
  const site = CAMP_SITES.find((c) => c.id === id)
  if (!site) return null
  const rows = [row('use', 'info', `${baht(COSTS.camp)} · เวลาสั่งการ ${cmd(scn, CMD_MIN.camp)} นาที`)]
  const near = SECTIONS.reduce((m, z) => (metres([site.lon, site.lat], z.c) < metres([site.lon, site.lat], m.c) ? z : m))
  const flooded = metres([site.lon, site.lat], near.c) < 700 && peakDepth(s, near) >= HARM_M
  const wet = SECTIONS.filter((z) => peakDepth(s, z) >= HARM_M)
  const km = wet.length ? wet.reduce((a, z) => a + metres([site.lon, site.lat], z.c), 0) / wet.length / 1000 : 0
  rows.push(row('get', 'info', site.note))
  if (wet.length) rows.push(row('get', 'info', `ถึงกลางโซนที่น้ำจะท่วมเฉลี่ย ~${km.toFixed(1)} กม. (เรือ ~${Math.round((km / BOAT.speedKmh) * 60)} นาทีต่อเที่ยว)`))
  rows.push(flooded
    ? row('risk', 'bad', `ที่ตั้งนี้น้ำจะท่วม (โซน ${near.id} ลึก ~${peakDepth(s, near).toFixed(1)} ม.) → องก์ 2 ต้องย้ายฐาน เรือออกช้า 3 ชม.`, true)
    : row('get', 'good', 'ที่ตั้งพ้นน้ำตลอดเหตุการณ์ — เรือออกได้ทันที', true))
  return { title: `ตั้งฐานที่${site.th}`, rows, verdict: { tone: flooded ? 'bad' : 'good', judge: true, th: flooded ? 'ไม่แนะนำ — ฐานจะจมน้ำ' : 'ที่ตั้งปลอดภัย' } }
}

/* ── Act 2 ───────────────────────────────────────────────────────────────── */

const waitingIn = (s, id) => s.points.filter((p) => p.revealed && p.status === 'waiting' && p.section === id)

export function previewPass2(s, scn, qid) {
  const q = scn.act2Passes.find((x) => x.id === qid)
  if (!q) return null
  return {
    title: `สั่ง THEOS-2 รอบ ${qid}`,
    rows: [
      row('use', 'info', `เวลาสั่งการ ${cmd(scn, CMD_MIN.pass2)} นาที · ไม่มีค่าใช้จ่าย`),
      row('get', 'good', `ภาพตัวเมืองตอน ${clockLabel(q.t)} — เห็นผู้ติดค้างบนหลังคาในโซนที่เมฆเปิด`),
      row('risk', 'info', `ตอนนี้เมฆปกคลุมเมือง ${Math.round(cloudCover(scn, s.clock) * 100)}% (ตอนดาวเทียมผ่านอาจต่างไป) · จุดอับ ${scn.blindSpots.join(', ')} ภาพมองไม่เห็นคน`),
    ],
  }
}

export function previewField(s, scn, kind, id) {
  const sec = SECTION_BY_ID[id]
  if (!sec) return null
  const known = waitingIn(s, id)
  const mode = MODES[s.modeId]
  if (kind === 'pump') {
    if (s.pumps[id]) return { title: `เครื่องสูบโซน ${id}`, rows: [row('get', 'info', 'โซนนี้มีเครื่องสูบแล้ว')] }
    const left = mode.pumps - Object.keys(s.pumps).length
    const ready = s.clock + DURATIONS.pumpSetup
    const d1 = depthAt(s, sec, ready), d2 = Math.max(0, d1 - ACT2.pumpReliefM)
    const rows = [
      row('use', 'info', `${baht(COSTS.pump)} · เครื่องสูบเหลือ ${left} → ${left - 1}`),
      row('use', 'info', `ติดตั้ง ${hrs(DURATIONS.pumpSetup)} → พร้อม ${clockLabel(ready)}`),
      row('get', 'info', `โซน ${id}: ลึก ${d1.toFixed(1)} → ${d2.toFixed(1)} ม. เมื่อเครื่องพร้อม`),
    ]
    if (left <= 0) rows.push(row('risk', 'bad', 'เครื่องสูบหมดแล้ว'))
    if (d1 >= ACT2.deepWaterM && d2 < ACT2.deepWaterM) rows.push(row('get', 'good', `ต่ำกว่า ${ACT2.deepWaterM} ม. → เส้นทางเรือผ่านโซนนี้ได้ปลอดภัย`, true))
    else if (d1 < ACT2.deepWaterM) rows.push(row('risk', 'warn', `ไม่ลึกถึง ${ACT2.deepWaterM} ม. อยู่แล้ว — เครื่องนี้อาจไม่จำเป็น`, true))
    else rows.push(row('risk', 'warn', `ยังลึกเกิน ${ACT2.deepWaterM} ม. แม้สูบแล้ว`, true))
    if (known.length) rows.push(row('get', 'good', `ช่วยยืดเวลาให้ผู้ติดค้างที่รู้แล้วในโซน ${known.length} จุด`, true))
    return { title: `ติดตั้งเครื่องสูบโซน ${id}`, rows }
  }
  if (kind === 'power') {
    const ready = s.clock + DURATIONS.powerCut
    return {
      title: `ตัดไฟโซน ${id}`,
      rows: [
        row('use', 'info', `ไม่มีค่าใช้จ่าย · ประสาน กฟภ. ${hrs(DURATIONS.powerCut)} → ตัดเสร็จ ${clockLabel(ready)}`),
        row('get', 'good', `เส้นทางเรือที่ผ่านโซน ${id} ไม่นับเป็นอันตราย "ไฟรั่ว" อีก`),
        row('risk', 'info', 'ถ้าไม่ตัด: เรือที่ผ่านโซนนี้จะโดนไฟช็อต ลูกเรือต้องส่งโรงพยาบาล เรือหยุดใช้งาน 9 ชม.'),
        ...(known.length ? [row('get', 'good', `ผู้ติดค้างที่รู้แล้วในโซน ${known.length} จุด`, true)] : []),
      ],
    }
  }
  if (kind === 'tower') {
    const ready = s.clock + DURATIONS.towerSetup
    const rows = [
      row('use', 'info', `${baht(COSTS.tower)} · ติดตั้ง ${hrs(DURATIONS.towerSetup)} → สัญญาณกลับ ${clockLabel(ready)}`),
      row('get', 'good', `สั่งเรือเข้าโซน ${id} ได้ · คนโทรสายด่วน 1784 แจ้งเหตุได้อีกครั้ง`),
    ]
    if (known.length) rows.push(row('risk', 'warn', `จุดที่รออยู่ในโซนนี้ ${known.length} จุด ส่งเรือไม่ได้จนกว่าเสาจะเสร็จ`))
    const tight = known.filter((p) => p.deadline < ready)
    if (tight.length) rows.push(row('risk', 'bad', `${tight.map((p) => p.id).join(', ')} เส้นตายก่อนเสาเสร็จ — อาจช่วยไม่ทัน`, true))
    return { title: `ตั้งเสาสื่อสารโซน ${id}`, rows }
  }
  if (kind === 'drone') {
    const free = s.drones.filter((d) => d.busyUntil <= s.clock).length
    const rows = [
      row('use', 'info', `${baht(COSTS.drone)} · บิน ${DURATIONS.droneSortie} นาที · โดรนว่าง ${free}/${s.drones.length}`),
      row('get', 'info', `ส่องหาผู้ติดค้างในโซน ${id} (ใต้เมฆได้)`),
    ]
    if (scn.blindSpots.includes(id)) rows.push(row('get', 'good', 'จุดอับ — ดาวเทียมมองไม่เห็นคนในโซนนี้ โดรนคือทางหลัก', true))
    else if (s.commDown.includes(id)) rows.push(row('get', 'good', 'สัญญาณล่ม คนโทรแจ้งไม่ได้ — โดรนช่วยหาได้', true))
    else rows.push(row('risk', 'warn', 'ดาวเทียมและสายด่วนครอบคลุมโซนนี้อยู่แล้ว — อาจไม่คุ้ม', true))
    if (!free) rows.push(row('risk', 'bad', 'ไม่มีโดรนว่าง'))
    return { title: `ส่งโดรนโซน ${id}`, rows }
  }
  return null
}

export function previewBoat(s, scn, { point, mission, dest, plan, opt }) {
  if (!point || !opt || !plan) return null
  const travel = (m) => Math.round((m / 1000 / BOAT.speedKmh) * 60)
  const grade = gradeChoice(plan, opt)
  const kits = mission === 'supply' ? Math.ceil(point.people / RESCUE.peoplePerHH) : 0
  const fuelLeft = s.fuel.total - s.fuel.used
  const free = s.boats.filter((b) => b.busyUntil <= s.clock).length
  const tPoint = s.clock + travel(opt.leg1M)
  const rows = [
    row('use', fuelLeft - opt.fuelL < 0 ? 'bad' : fuelLeft - opt.fuelL < s.fuel.total * 0.15 ? 'warn' : 'info', `น้ำมัน ${opt.fuelL} L (คงเหลือ ${fmt(Math.max(0, fuelLeft - opt.fuelL))} / ${fmt(s.fuel.total)} L)`),
    row('use', 'info', `${baht(COSTS.boatTrip + kits * COSTS.kit)}${kits ? ` (ถุงยังชีพ ${kits} ชุด)` : ''} · เรือ 1 ลำ (ว่าง ${free} → ${Math.max(0, free - 1)})`),
    row('get', tPoint <= point.deadline ? 'good' : 'bad', `ถึง ${point.id} ${clockLabel(tPoint)} · เส้นตาย ${clockLabel(point.deadline)}${tPoint > point.deadline ? ' — ไม่ทัน' : ` (เผื่อ ${hrs(point.deadline - tPoint)})`}`),
  ]
  if (mission === 'supply') rows.push(row('get', 'good', `ถุงยังชีพ ${kits} ชุดให้ ${point.left} คน — อยู่ต่อได้จนน้ำลด`))
  else {
    const d = destOf(dest)
    const trips = Math.ceil(point.left / BOAT.capacity)
    rows.push(row('get', 'good', `รับ ${point.left} คนไป${d?.th || 'ปลายทาง'}${trips > 1 ? ` · เรือวนรับ-ส่งเองอีก ${trips - 1} เที่ยว (เรือจุ ${BOAT.capacity} คน)` : ''}`))
    if (point.injured && dest !== 'hosp') rows.push(row('risk', 'bad', `มีผู้บาดเจ็บ ${point.injured} คน แต่ปลายทางไม่ใช่โรงพยาบาล → ต้องส่งต่อ เสียคะแนน`, true))
  }
  if (grade.kind === 'unsafe') rows.push(row('risk', 'bad', `${grade.th} → ${(opt.hazards || []).includes('power') ? 'เรือโดนไฟช็อต ลูกเรือส่งโรงพยาบาล' : 'เรือล่ม ต้องซ่อม'} · ผู้ติดค้างยังรอ · ผิดร้ายแรง`, true))
  else if (grade.kind === 'long') rows.push(row('risk', 'warn', `${grade.th} → เปลืองน้ำมันและคะแนนโลจิสติกส์ลด`, true))
  else rows.push(row('get', 'good', 'เส้นทางปลอดภัยและสั้นที่สุดในตัวเลือก', true))
  if (opt.fuelL > fuelLeft) rows.push(row('risk', 'bad', 'น้ำมันไม่พอสำหรับเที่ยวนี้'))
  const bad = rows.some((r) => r.judge && r.tone === 'bad') || tPoint > point.deadline
  const warn = rows.some((r) => r.judge && r.tone === 'warn')
  return {
    title: `ส่งเรือไป ${point.id}`, rows,
    verdict: { tone: bad ? 'bad' : warn ? 'warn' : 'good', judge: true, th: bad ? 'คำสั่งนี้มีปัญหา — ดูความเสี่ยงก่อนส่ง' : warn ? 'ส่งได้ แต่ยังไม่ใช่ตัวเลือกที่ดีที่สุด' : 'แผนนี้ปลอดภัยและทันเวลา' },
  }
}

/* ── Act 3 ───────────────────────────────────────────────────────────────── */

export function previewVerdict(verdict) {
  const pay = verdict === 'flat' ? RELIEF.flatGrant : verdict === 'both' ? RELIEF.flatGrant + RELIEF.mudGrant : 0
  const rule = {
    flat: [`ถูกเมื่อ: ท่วมขัง ≥ ${RELIEF.inundationMinDays} วัน และไม่มีโคลนทับถมชัด`, `ถ้าท่วมไม่ถึง ${RELIEF.inundationMinDays} วัน → จ่ายเกิน · ถ้ามีโคลนชัด → จ่ายขาด ${baht(RELIEF.mudGrant)}`],
    both: [`ถูกเมื่อ: ท่วมขัง ≥ ${RELIEF.inundationMinDays} วัน และเห็นโคลนทับถมรอบบ้าน`, 'ถ้าไม่มีโคลนหรือท่วมไม่นานพอ → จ่ายเกิน'],
    reject: [`ถูกเมื่อ: ท่วมขังไม่ถึง ${RELIEF.inundationMinDays} วัน`, 'ถ้าบ้านเข้าเกณฑ์จริง → ตัดสิทธิ์ผิด คนเดือดร้อนไม่ได้รับเงิน'],
  }[verdict]
  return { title: verdict === 'reject' ? 'ปฏิเสธคำร้อง' : `อนุมัติ ${baht(pay)}`, rows: [row('use', 'info', `จ่าย ${baht(pay)}`), row('get', 'good', rule[0]), row('risk', 'warn', rule[1])] }
}

export function previewSurvey(s) {
  const day = s.clock / 1440
  return {
    title: 'ส่งทีมสำรวจภาคพื้น',
    rows: [
      row('use', 'info', `${baht(RELIEF.surveyCost)} · +${DURATIONS.surveyDays} วัน (ตอนนี้วันที่ ${Math.floor(day)} / ${MISSION.deadlineDays})`),
      row('get', 'good', 'ผลภาคพื้นยืนยันวันท่วมขังและโคลนได้แม่นยำ'),
      row('risk', 'info', 'ใช้เฉพาะหลังที่หลักฐานระยะไกลไม่พอ — ส่งทุกหลังจะเกินกรอบ 60 วัน'),
    ],
  }
}

/* ── Skip to the end of the act ──────────────────────────────────────────── */

export function previewSkip(s, scn) {
  const rows = []
  if (s.act === 1) {
    rows.push(row('use', 'info', `เวลาเดิน +${hrs(-s.clock)} ไปถึง T−0 (มวลน้ำถึงเมือง)`))
    const missed = SECTIONS.filter((z) => s.orders[z.id] === undefined && peakDepth(s, z) >= HARM_M).map((z) => z.id)
    if (missed.length) rows.push(row('risk', 'bad', `ยังไม่ได้สั่งอพยพ ${missed.join(', ')} ซึ่งน้ำจะถึง — จะไม่มีโอกาสสั่งอีกในองก์นี้`, true))
    const unread = s.images.filter((i) => i.usable && !i.analyzed && i.target !== 'TOWN').length
    if (unread) rows.push(row('risk', 'warn', `ภาพที่ยังไม่แปล ${unread} ภาพ (ค่า L ยังไม่ครบ)`))
    if (!s.channel.measured) rows.push(row('risk', 'warn', 'ยังไม่ได้วัดค่า N'))
    rows.push(row('get', 'good', 'จบองก์เร็วขึ้น → ดูสรุปผลและเข้าสู่องก์ 2'))
  } else {
    rows.push(row('use', 'info', `เวลาเดิน +${hrs(MISSION.act2EndMin - s.clock)} ไปถึงน้ำลด (T+36)`))
    const open = s.points.filter((p) => p.revealed && p.status === 'waiting' && !s.jobs.some((j) => j.point === p.id))
    if (open.length) rows.push(row('risk', 'bad', `ยังมีผู้ติดค้างที่รู้แล้วรอเรือ ${open.length} จุด (${open.map((p) => p.id).join(', ')})`))
    rows.push(row('risk', 'warn', 'ผู้ติดค้างที่ยังไม่มีใครพบ (ถ้ามี) จะไม่มีโอกาสช่วยอีก'))
    rows.push(row('get', 'good', 'จบองก์เร็วขึ้น → เข้าสู่การเยียวยา'))
  }
  const bad = rows.some((r) => r.tone === 'bad')
  return { title: s.act === 1 ? 'ข้ามไป T−0' : 'ข้ามไปน้ำลด', rows, verdict: { tone: bad ? 'bad' : 'good', judge: true, th: bad ? 'ยังมีงานค้าง — แน่ใจหรือไม่?' : 'ไม่มีงานค้างที่มองเห็น ข้ามได้' } }
}

