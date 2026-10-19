/* ══════════════════════════════════════════════════════════════════════════
   WHAT IF — "ถ้าคุณเลือกอีกทาง" (counterfactual debrief at the end of each act)
   เปลี่ยนการตัดสินใจของผู้เล่นทีละเรื่อง แล้วคำนวณผลใหม่ด้วยแบบจำลองเดียวกับเกม
   (zoneOutcome · exposureSummary · evaluateRoof) → เห็นว่าการตัดสินใจไหนมีผลมากที่สุด
   ใช้หลังจบองก์เท่านั้น จึงเปิดเผยความจริงได้ (เมฆจริง · จุดที่ไม่มีใครพบ · ผลจริงของหลังคา)
   Card: { id, act, tone: 'gain'|'loss', icon, title, you, alt, delta: { v, unit }, lesson, weight, sum: { hh, people, baht, images, min } }
   ══════════════════════════════════════════════════════════════════════════ */

import { zoneOutcome, exposureSummary, peakDepth, arrivalAt, refusalShare, scarStats, reliefSummary, evaluateRoof, HARM_M } from '../lib/sim'
import { firstCrossing, T_START } from '../lib/hydro'
import { clearSections } from '../lib/clouds'
import { SECTIONS, SECTION_BY_ID } from '../lib/sections'
import { EMBANKMENT_GAPS } from '../lib/embankment'
import { metres } from '../lib/geo'
import { campOf } from './world'
import { previewCamp } from './impact'
import { CAMP_SITES, HOSPITAL } from '../config/scenarioData'
import { THRESHOLDS, THEOS2, COSTS, TRUST, RESCUE, RELIEF, BOAT, DURATIONS, MISSION, EMBANKMENT } from '../config/missionConfig'
import { clockLabel, fmt, baht } from '../lib/format'

const hrs = (m) => { const a = Math.abs(Math.round(m)); return a >= 60 ? `${(a / 60).toFixed(a % 60 ? 1 : 0)} ชม.` : `${a} นาที` }
const tgt = (t) => (t === 'TOWN' ? 'ตัวเมือง' : `Sector ${t}`)
const pctx = (v) => `${Math.round(v * 100)}%`
const people = (hh) => Math.round(hh * RESCUE.peoplePerHH)
const card = (c) => ({ tone: 'gain', sum: {}, weight: 1, ...c })

/* ═════════════════════════════ Act 1 ═════════════════════════════ */

function act1(s, scn) {
  const cards = [], good = []
  const narrow = scn.channel.widthM < THRESHOLDS.origChannelWidth * THRESHOLDS.narrowChannelRatio
  const drop = THRESHOLDS.narrowChannelPrepDrop
  const prepNow = THRESHOLDS.prepLevel - (s.channel.measured && narrow ? drop : 0)
  const t0 = s.t0 ?? T_START                                       // Stress Test "less time" starts later
  const evidT = firstCrossing(prepNow, t0, 0)                      // earliest order the gauge alone backs
  const exp = exposureSummary(s, scn)

  /* evacuation per zone: the latest order that still gets everyone out, vs what the player did */
  const onTime = []
  for (const r of exp.rows) {
    const sec = r.sec
    if (r.atRisk > 0) {
      if (r.order !== null && r.timely >= 0.95) { onTime.push(sec.id); continue }
      const altT = Math.max(t0, Math.round(r.arrival - r.need))
      const alt = zoneOutcome(s, scn, sec, altT)
      const gain = alt.safe - r.safe
      if (gain <= 0) continue
      const gaugeOk = Number.isFinite(evidT) && evidT <= altT
      cards.push(card({
        id: `evac-${sec.id}`, act: 1, icon: 'evac',
        title: r.order === null ? `ถ้าสั่งอพยพ ${sec.id} ${sec.name}` : `ถ้าสั่ง ${sec.id} เร็วขึ้น ${hrs(r.order - altT)}`,
        you: r.order === null ? `ไม่ได้สั่งอพยพ — ประชาชนหนีเองได้ราว ${pctx(RESCUE.selfEvacuate)}` : `สั่งตอน ${clockLabel(r.order)} · น้ำถึง ${clockLabel(r.arrival)} · อพยพทัน ${pctx(r.timely)}`,
        alt: `สั่งภายใน ${clockLabel(altT)} — การอพยพ ${sec.floodHH} ครัวเรือนใช้ ${hrs(r.need)} เสร็จก่อนน้ำถึง`,
        delta: { v: `+${fmt(gain)}`, unit: `ครัวเรือนพ้นน้ำ (~${fmt(people(gain))} คน)` },
        lesson: gaugeOk
          ? `ระดับน้ำถึงเกณฑ์ ${prepNow.toFixed(2)} ม. ตั้งแต่ ${clockLabel(evidT)} — มีหลักฐานพอสั่งได้ทันโดยไม่เป็นเตือนผิด`
          : `ระดับน้ำถึงเกณฑ์ช้ากว่านั้น${Number.isFinite(evidT) ? ` (${clockLabel(evidT)})` : ''} — ต้องใช้หลักฐานจาก THEOS-2 (ค่า L, N) ดัน SFVI ให้ถึง 0.62 ก่อน`,
        weight: gain, sum: { hh: gain, people: people(gain) },
      }))
    } else if (r.order !== null) {
      const cost = COSTS.evacBase + COSTS.evacPerHH * sec.floodHH
      cards.push(card({
        id: `waste-${sec.id}`, act: 1, icon: 'money', tone: 'loss',
        title: `ถ้าไม่สั่ง ${sec.id} ${sec.name}`,
        you: `สั่งอพยพโซนนี้ตอน ${clockLabel(r.order)}${sec.floodHH ? ` (${fmt(sec.floodHH)} ครัวเรือน)` : ''}`,
        alt: `ไม่ต้องอพยพ — น้ำสูงสุดเพียง ${r.peak.toFixed(1)} ม. (เกณฑ์อันตราย ${HARM_M} ม.)`,
        delta: { v: `+${baht(cost)}`, unit: 'งบที่ประหยัดได้' },
        lesson: 'คอลัมน์ความลึกในตารางโซนบอกแล้วว่า "น้ำแทบไม่ถึง" — งบอพยพควรใช้กับโซนที่น้ำถึงจริง',
        weight: cost / 25_000, sum: { baht: cost },
      }))
    }
  }
  const wetN = exp.rows.filter((r) => r.atRisk > 0).length
  if (wetN && onTime.length === wetN) good.push(`สั่งอพยพทันเวลาครบทั้ง ${wetN} โซนที่น้ำถึง`)
  else if (onTime.length) good.push(`อพยพทันเวลา: ${onTime.join(', ')}`)

  /* false alarms: the same orders, issued once the evidence was there */
  const fa = s.decisions.filter((d) => d.outcome === 'false-alarm')
  if (fa.length) {
    const lost = TRUST.falseAlarmPenalties.slice(0, fa.length).reduce((a, x) => a + x, 0)
      + Math.max(0, fa.length - TRUST.falseAlarmPenalties.length) * TRUST.falseAlarmPenalties[TRUST.falseAlarmPenalties.length - 1]
    const alt = { ...s, falseAlarms: 0, trust: Math.min(100, s.trust + lost) }
    const gain = Math.max(0, exp.exposed - exposureSummary(alt, scn).exposed)
    const refuse = refusalShare(s) - refusalShare(alt)
    cards.push(card({
      id: 'false-alarm', act: 1, icon: 'trust',
      title: 'ถ้ารอหลักฐานก่อนประกาศอพยพ',
      you: `ประกาศ ${fa[0].communities.join(', ')} ตอน ${fa[0].clockLabel} ขณะ SFVI ${Number(fa[0].sfvi).toFixed(2)} < 0.62 และระดับน้ำยังต่ำ → เตือนผิด ${fa.length} ครั้ง`,
      alt: `ประกาศเมื่อ SFVI ≥ 0.62 หรือระดับน้ำ ≥ ${prepNow.toFixed(2)} ม.${Number.isFinite(evidT) ? ` (${clockLabel(evidT)})` : ''}`,
      delta: { v: `+${lost}%`, unit: `ความเชื่อมั่น · คนไม่ยอมอพยพ −${Math.round(refuse * 100)}%${gain ? ` · พ้นน้ำเพิ่ม ${fmt(gain)} ครัวเรือน` : ''}` },
      lesson: 'เตือนผิดทำให้คนไม่เชื่อคำเตือนครั้งต่อไป — ผลลามไปถึงจำนวนผู้ติดค้างในองก์ 2',
      weight: 30 + gain, sum: { hh: gain, people: people(gain) },
    }))
  } else if (s.decisions.some((d) => d.kind === 'EVACUATE')) good.push('ไม่มีเตือนผิด — ประกาศเมื่อมีหลักฐานรองรับ')

  /* embankment gaps */
  const open = EMBANKMENT_GAPS.filter((g) => !s.sealed.includes(g.id))
  if (open.length) {
    const alt = { ...s, sealed: EMBANKMENT_GAPS.map((g) => g.id) }
    const gain = Math.max(0, exp.exposed - exposureSummary(alt, scn).exposed)
    let best = null
    for (const sec of SECTIONS) {
      if (peakDepth(s, sec) < HARM_M) continue
      const a0 = arrivalAt(s, sec), a1 = arrivalAt(alt, sec)
      if (!Number.isFinite(a0)) continue
      const d = (Number.isFinite(a1) ? a1 : MISSION.act2EndMin) - a0
      if (!best || d > best.d) best = { sec, d, p0: peakDepth(s, sec), p1: peakDepth(alt, sec) }
    }
    if (best && best.d > 0) {
      const bags = open.reduce((a, g) => a + g.len * EMBANKMENT.bagsPerMetre, 0)
      cards.push(card({
        id: 'seal', act: 1, icon: 'seal',
        title: `ถ้าอุดจุดฟันหลอครบ ${EMBANKMENT_GAPS.length} จุด`,
        you: `อุดได้ ${s.sealed.length}/${EMBANKMENT_GAPS.length} จุด — เหลือช่องเปิด ${open.length} จุด`,
        alt: `ส่งทีมบิ๊กแบ็กอุดที่เหลือตั้งแต่ต้นองก์ (อีก ${fmt(bags)} ใบ · ${baht(bags * COSTS.bigbag)})`,
        delta: gain ? { v: `+${fmt(gain)}`, unit: 'ครัวเรือนพ้นน้ำ' } : { v: `+${hrs(best.d)}`, unit: `เวลาก่อนน้ำถึง ${best.sec.id}` },
        lesson: `น้ำถึง ${best.sec.id} ช้าลง ${hrs(best.d)} และลึกสุด ${best.p0.toFixed(1)} → ${best.p1.toFixed(1)} ม. — มีเวลาอพยพและเรือเข้าได้ง่ายขึ้น`,
        weight: Math.max(gain, 10), sum: { hh: gain, people: people(gain) },
      }))
    }
  } else good.push(`อุดจุดฟันหลอครบ ${EMBANKMENT_GAPS.length} จุด`)

  /* channel width N */
  if (narrow) {
    const tBase = firstCrossing(THRESHOLDS.prepLevel, T_START, 0), tDrop = firstCrossing(THRESHOLDS.prepLevel - drop, T_START, 0)
    const gainMin = Number.isFinite(tBase) && Number.isFinite(tDrop) ? tBase - tDrop : 0
    if (!s.channel.measured && gainMin > 0) {
      cards.push(card({
        id: 'channel', act: 1, icon: 'channel',
        title: 'ถ้าวัดความกว้างลำน้ำ (ค่า N) จากภาพ Pan 0.5 ม.',
        you: 'ไม่ได้วัดค่า N — เกณฑ์เตือนภัยยังเป็น 4.01 ม. ตามเดิม',
        alt: `วัดได้ ${scn.channel.widthM} ม. (เหลือไม่ถึงครึ่งของ 150 ม.) → เกณฑ์เตือนภัยลดเป็น ${(THRESHOLDS.prepLevel - drop).toFixed(2)} ม.`,
        delta: { v: `+${hrs(gainMin)}`, unit: 'มีหลักฐานสั่งอพยพเร็วขึ้น' },
        lesson: 'ลำน้ำแคบลง น้ำเท่าเดิมล้นตลิ่งเร็วขึ้น — ภาพละเอียด 0.5 ม. เท่านั้นที่วัดลำน้ำกว้าง 20–30 ม. ได้',
        weight: 14 + gainMin / 30, sum: { min: gainMin },
      }))
    } else if (s.channel.measured && gainMin > 0) good.push(`วัดค่า N ได้ — เกณฑ์เตือนภัยลดลง มีหลักฐานเร็วขึ้น ${hrs(gainMin)}`)
  }

  /* THEOS-2 passes: the actual cloud is known now */
  let usable = 0
  for (const pass of scn.passes) {
    if (pass.t > s.clock || pass.t < t0 || scn.stress?.lostPass === pass.id) continue   // before the start, or lost at downlink
    const chosen = s.taskings[pass.id] || []
    const byActual = [...pass.reach].sort((a, b) => pass.actual[a] - pass.actual[b])
    const ok = (t) => pass.actual[t] <= THEOS2.cloudUsablePct
    if (!chosen.length) {
      const could = byActual.filter(ok).slice(0, THEOS2.targetsPerPass)
      if (could.length) {
        cards.push(card({
          id: `pass-${pass.id}`, act: 1, icon: 'theos',
          title: `ถ้าสั่งถ่าย THEOS-2 รอบ ${pass.id}`,
          you: `รอบ ${pass.id} (${clockLabel(pass.t)}) ผ่านไปโดยไม่ได้เลือกเป้าหมาย`,
          alt: `ถ่าย ${could.map((t) => `${tgt(t)} (เมฆจริง ${pass.actual[t]}%)`).join(' · ')}`,
          delta: { v: `+${could.length}`, unit: 'ภาพที่ใช้ได้' },
          lesson: 'รอบโคจรมีจำกัด (revisit ~1.9 วัน) — พลาดหนึ่งรอบคือเสียหลักฐานทั้งรอบ',
          weight: 9 * could.length, sum: { images: could.length },
        }))
      }
      continue
    }
    usable += chosen.filter(ok).length
    const bad = chosen.filter((t) => !ok(t))
    const better = byActual.filter((t) => !chosen.includes(t) && ok(t)).slice(0, bad.length)
    if (bad.length && better.length) {
      const overForecast = bad.some((t) => pass.forecast[t] > THEOS2.cloudUsablePct)
      cards.push(card({
        id: `cloud-${pass.id}`, act: 1, icon: 'theos',
        title: `รอบ ${pass.id}: ถ้าเลือก ${better.map(tgt).join(', ')}`,
        you: `เลือก ${bad.map((t) => `${tgt(t)} (พยากรณ์ ${pass.forecast[t]}% · จริง ${pass.actual[t]}%)`).join(' · ')} — เมฆบัง ภาพใช้ไม่ได้`,
        alt: better.map((t) => `${tgt(t)} (พยากรณ์ ${pass.forecast[t]}% · จริง ${pass.actual[t]}%)`).join(' · '),
        delta: { v: `+${better.length}`, unit: 'ภาพที่ใช้ได้' },
        lesson: overForecast ? `เลือกเป้าที่พยากรณ์เมฆเกิน ${THEOS2.cloudUsablePct}% — กล้องเชิงแสงมองทะลุเมฆไม่ได้` : 'พยากรณ์เมฆคลาดได้ราว ±14% — เป้าที่พยากรณ์ใกล้ 60% เสี่ยง ควรมีเผื่อ',
        weight: 8 * better.length, sum: { images: better.length },
      }))
    }
  }
  if (usable >= 3) good.push(`ได้ภาพ THEOS-2 ที่ใช้ได้ ${usable} ภาพ`)

  /* image interpretation (the truth of each pin is known now) */
  const st = scarStats(s, scn)
  if (st.available && (st.fp > 0 || st.tp < st.available)) {
    const miss = st.available - st.tp
    cards.push(card({
      id: 'scars', act: 1, icon: 'scan', tone: st.fp ? 'loss' : 'gain',
      title: 'ถ้าแปลภาพถูกทุกหมุด',
      you: `ระบุรอยดินถล่ม ${st.labelled} จุด (ถูก ${st.tp}${st.fp ? ` · ผิด ${st.fp}` : ''}) จากที่มีจริงในภาพ ${st.available} จุด`,
      alt: `ระบุครบ ${st.available} จุด ไม่มีทุ่งนา/เงาเมฆ/รอยเก่าปน`,
      delta: { v: `L ${(st.labelled / st.total).toFixed(2)} → ${(st.available / st.total).toFixed(2)}`, unit: 'ค่า L ใน SFVI' },
      lesson: st.fp ? 'ระบุสิ่งที่ไม่ใช่ดินถล่มทำให้ SFVI สูงเกินจริง — เสี่ยงเตือนเกินเหตุ' : `พลาดรอยจริง ${miss} จุด ทำให้ประเมินความเสี่ยงต่ำไป`,
      weight: 6 * (st.fp + miss),
    }))
  } else if (st.available) good.push(`แปลภาพถูกทุกหมุด (${st.tp}/${st.available})`)

  /* forward base */
  const site = campOf(s)
  if (!site) {
    const safe = CAMP_SITES.find((c) => previewCamp(s, scn, c.id)?.verdict?.tone !== 'bad')
    cards.push(card({ id: 'camp', act: 1, icon: 'camp', title: 'ถ้าตั้งฐานบัญชาการเอง', you: 'ไม่ได้ตั้งฐาน — ระบบเลือกที่ว่าการอำเภอให้', alt: safe ? `${safe.th} (${safe.note})` : 'เลือกที่สูงที่พ้นน้ำ', delta: { v: 'ควบคุมเอง', unit: 'ที่ตั้งฐานเรือ' }, lesson: 'ศูนย์บัญชาการต้องเลือกตั้งแต่ต้น — เรือทุกลำออกจากที่นี่', weight: 5 }))
  } else if (previewCamp(s, scn, site.id)?.verdict?.tone === 'bad') {
    const safe = CAMP_SITES.find((c) => previewCamp(s, scn, c.id)?.verdict?.tone !== 'bad')
    if (safe) {
      cards.push(card({
        id: 'camp', act: 1, icon: 'camp',
        title: `ถ้าตั้งฐานที่${safe.th}`,
        you: `ตั้งฐานที่${site.th} — น้ำท่วมถึง ต้องย้ายฐานกลางวิกฤต`,
        alt: `${safe.th} (${safe.note}) — พ้นน้ำตลอดเหตุการณ์`,
        delta: { v: '+3 ชม.', unit: 'เรือออกปฏิบัติงานได้เร็วขึ้นในองก์ 2' },
        lesson: 'ศูนย์บัญชาการต้องอยู่บนที่สูง และไม่ถูกตัดขาดตอนน้ำขึ้นสูงสุด',
        weight: 24, sum: { min: 180 },
      }))
    }
  } else good.push(`ตั้งฐานบนที่สูงพ้นน้ำ (${site.th})`)

  return { cards, good }
}

/* ═════════════════════════════ Act 2 ═════════════════════════════ */

function act2(s, scn) {
  const cards = [], good = []
  const camp = campOf(s)
  const min = (m) => Math.round((m / 1000 / BOAT.speedKmh) * 60)
  // boat time base → point: straight line × 1.35 (typical street detour) — the debrief needs the order of magnitude, not a route
  const reach = (p) => (camp ? min(metres([camp.lon, camp.lat], [p.lon, p.lat]) * 1.35) : null)
  const activeAt = (p, t) => t >= Math.max(0, arrivalAt(s, SECTION_BY_ID[p.section]))
  // at the end of act 2 anyone still waiting in a house they cannot stay in counts as lost (enterAct3 books it)
  const lostOf = (p) => p.lost + (s.act === 2 && p.status === 'waiting' && p.type === 'critical' ? p.left : 0)

  /* stranded groups that were lost — why, and what would have saved them */
  for (const p of s.points) {
    const lostN = lostOf(p)
    if (!lostN) continue
    const sec = SECTION_BY_ID[p.section]
    let title, you, alt, lesson, icon = 'find'
    if (!p.revealed) {
      const q = scn.act2Passes.find((x) => !s.act2Orders[x.id] && x.t < p.deadline && activeAt(p, x.t) && clearSections(scn, x.t).includes(p.section) && !scn.blindSpots.includes(p.section))
      if (scn.blindSpots.includes(p.section)) {
        title = `ถ้าส่งโดรนไปโซน ${p.section} (จุดอับ)`
        you = `ไม่มีใครพบ ${p.id} — ดาวเทียมมองไม่เห็นคนในซอยลึก/ใต้ร่มไม้`
        alt = `ส่งโดรน (${DURATIONS.droneSortie} นาที · ${baht(COSTS.drone)}) หลังน้ำเข้าโซน ${clockLabel(Math.max(0, arrivalAt(s, sec)))} — พบก่อนเส้นตาย ${clockLabel(p.deadline)}`
        lesson = 'ดาวเทียมกับโดรนเสริมกัน — จุดที่ภาพมองไม่เห็นต้องใช้เครื่องมืออื่น'
        icon = 'drone'
      } else if (scn.commDown.includes(p.section)) {
        title = `ถ้าตั้งเสาสื่อสารโซน ${p.section}`
        you = `${p.id} โทรสายด่วนไม่ได้ (พายุตัดสัญญาณ) และไม่มีใครพบ`
        alt = `ตั้งเสาเคลื่อนที่ (${DURATIONS.towerSetup / 60} ชม. · ${baht(COSTS.tower)}) — สายด่วนแจ้งได้ และสั่งเรือเข้าโซนได้`
        lesson = 'โซนที่สัญญาณล่มเงียบผิดปกติไม่ได้แปลว่าปลอดภัย'
        icon = 'tower'
      } else if (q) {
        title = `ถ้าสั่ง THEOS-2 รอบ ${q.id}`
        you = `ไม่ได้สั่งถ่ายรอบ ${q.id} — ${p.id} ไม่มีใครพบ`
        alt = `รอบ ${q.id} (${clockLabel(q.t)}) โซน ${p.section} เมฆเปิดพอดี — จะพบ ${p.id} ตั้งแต่ตอนนั้น`
        lesson = 'ทุกรอบโคจรคือโอกาสเห็นผู้ติดค้างผ่านช่องเมฆ — สั่งถ่ายไว้ก่อนเสมอ (ไม่มีค่าใช้จ่าย)'
        icon = 'theos'
      } else {
        title = `${p.id}: ไม่มีใครพบทันเวลา`
        you = 'THEOS-2 ไม่เห็น (เมฆบังทุกรอบ) และสายด่วนแจ้งช้า'
        alt = `ส่งโดรนส่องโซน ${p.section} หลังน้ำเข้า ${clockLabel(Math.max(0, arrivalAt(s, sec)))}`
        lesson = 'เมื่อดาวเทียมเห็นไม่ครบ ต้องใช้ทุกช่องทาง: ภาพ · สายด่วน · โดรน'
        icon = 'drone'
      }
    } else {
      const go = reach(p, p.revealedAt)
      // a zone the storm cut off needs a mobile tower first (the rules block boats until it is up)
      const commBlock = scn.commDown.includes(p.section) && !s.towers[p.section] && p.revealedAt >= scn.stormAt
      const sendAt = p.revealedAt + (commBlock ? DURATIONS.towerSetup : 0)
      const arriveAt = go !== null ? sendAt + go : null
      const inTime = arriveAt !== null && arriveAt <= p.deadline
      if (p.firstBoatAt === undefined) {
        title = commBlock ? `ถ้าตั้งเสาสื่อสารโซน ${p.section} แล้วส่งเรือไป ${p.id}` : `ถ้าส่งเรือไป ${p.id} ทันทีที่พบ`
        you = `พบตั้งแต่ ${clockLabel(p.revealedAt)} (เหลือ ${hrs(p.deadline - p.revealedAt)}) แต่ไม่มีเรือออกไป${commBlock ? ' — โซนสัญญาณล่ม' : ''}`
        alt = commBlock
          ? `ตั้งเสาตอน ${clockLabel(p.revealedAt)} (เสร็จ ${clockLabel(sendAt)}) แล้วส่งเรือ${arriveAt !== null ? ` — ถึงราว ${clockLabel(arriveAt)} ${inTime ? 'ก่อน' : 'หลัง'}เส้นตาย ${clockLabel(p.deadline)}` : ''}`
          : `ส่งเรือตอน ${clockLabel(p.revealedAt)}${go !== null ? ` — ถึงใน ~${go} นาที ${inTime ? 'ก่อน' : 'หลัง'}เส้นตาย ${clockLabel(p.deadline)}` : ''}`
        lesson = !inTime && arriveAt !== null ? 'แม้ส่งทันทีก็ไม่ทัน — ต้องพบให้เร็วกว่านี้ (สั่ง THEOS-2 ทุกรอบ · ส่งโดรน · ตั้งเสาสื่อสารตั้งแต่พายุเข้า)'
          : commBlock ? 'โซนสัญญาณล่มต้องตั้งเสาสื่อสารก่อน จึงจะสั่งทีมเข้าไปได้ — ตั้งทันทีที่พายุเข้า' : 'เรียงงานตามเส้นตาย — จุดที่ใกล้เส้นตายที่สุดต้องได้เรือก่อน'
        icon = commBlock ? 'tower' : 'boat'
      } else {
        title = `ถ้าส่งเรือไป ${p.id} เร็วขึ้น ${hrs(p.firstBoatAt - p.revealedAt)}`
        you = `พบ ${clockLabel(p.revealedAt)} · ส่งเรือ ${clockLabel(p.firstBoatAt)} · เส้นตาย ${clockLabel(p.deadline)}`
        alt = `ส่งทันทีที่พบ${go !== null ? ` — ถึงราว ${clockLabel(p.revealedAt + go)}` : ''}${p.left + p.lost > BOAT.capacity ? ` · ${Math.ceil((p.left + p.lost) / BOAT.capacity)} เที่ยว ควรส่งเรือ 2 ลำ` : ''}`
        lesson = p.people > BOAT.capacity ? `เรือจุ ${BOAT.capacity} คน/เที่ยว — จุดที่มีคนมากและเส้นตายใกล้ ควรส่งเรือมากกว่า 1 ลำ` : 'ยิ่งรอ น้ำยิ่งสูง — ส่งเรือทันทีที่พบ'
        icon = 'boat'
      }
    }
    cards.push(card({ id: `lost-${p.id}`, act: 2, icon, title, you, alt, lesson, delta: { v: `+${lostN}`, unit: 'คนที่มีโอกาสรอด' }, weight: lostN * 1.5 + (p.deadline < 1e9 ? 1 / (1 + p.deadline) : 0), sum: { people: lostN } }))
  }

  /* unordered THEOS-2 passes: who would have been found earlier */
  for (const q of scn.act2Passes) {
    if (s.act2Orders[q.id] || q.t > s.clock) continue
    const clear = clearSections(scn, q.t)
    const earlier = s.points.filter((p) => clear.includes(p.section) && !scn.blindSpots.includes(p.section) && activeAt(p, q.t) && (!p.revealed || p.revealedAt > q.t) && !lostOf(p))
    if (!earlier.length) continue
    const gained = earlier.filter((p) => p.revealed).reduce((a, p) => a + (p.revealedAt - q.t), 0) / Math.max(1, earlier.filter((p) => p.revealed).length)
    cards.push(card({
      id: `q-${q.id}`, act: 2, icon: 'theos',
      title: `ถ้าสั่ง THEOS-2 รอบ ${q.id}`,
      you: `รอบ ${q.id} (${clockLabel(q.t)}) ผ่านเมืองไปโดยไม่ได้สั่งถ่าย`,
      alt: `เห็นพื้นดิน ${clear.length}/10 โซน — พบ ${earlier.map((p) => p.id).join(', ')} เร็วขึ้น${gained > 0 ? ` เฉลี่ย ${hrs(gained)}` : ''}`,
      delta: { v: `+${earlier.length}`, unit: 'จุดที่พบเร็วขึ้น' },
      lesson: 'สั่งถ่ายไม่มีค่าใช้จ่าย — ทุกรอบที่พลาดคือเวลาที่ผู้ติดค้างต้องรอ',
      weight: 8 * earlier.length,
    }))
  }

  /* supplies that never arrived */
  const esc = s.points.filter((p) => p.escalated !== undefined && !lostOf(p))
  if (esc.length) {
    cards.push(card({
      id: 'escalated', act: 2, icon: 'boat', tone: 'loss',
      title: 'ถ้าส่งถุงยังชีพก่อนเส้นตาย',
      you: `${esc.map((p) => p.id).join(', ')} ไม่ได้รับเสบียงทัน — ต้องอพยพด่วนแทน`,
      alt: `ส่งถุงยังชีพก่อน ${esc.map((p) => clockLabel(p.escalated)).join(', ')} — เรือเที่ยวเดียว คนอยู่ต่อได้จนน้ำลด`,
      delta: { v: `−${esc.length}`, unit: 'ภารกิจอพยพด่วนที่ไม่จำเป็น' },
      lesson: 'บ้านที่ยังอยู่ได้ต้องการเสบียง ไม่ใช่เรืออพยพ — แต่ถ้าปล่อยนานจะกลายเป็นงานด่วน',
      weight: 6 * esc.length,
    }))
  }

  /* boat routes */
  const log = s.routeLog || []
  const unsafe = log.filter((r) => r.kind === 'unsafe'), long = log.filter((r) => r.kind === 'long')
  if (unsafe.length || long.length) {
    const extraKm = long.reduce((a, r) => a + (r.chosenM - (r.bestM || r.chosenM)), 0) / 1000
    const extraL = [...unsafe, ...long].reduce((a, r) => a + Math.max(0, r.fuelL - (r.bestFuelL ?? r.fuelL)), 0)
    const kinds = [...new Set(unsafe.flatMap((r) => r.hazards))]
    const HZ = { river: 'ริมแม่น้ำกระแสแรง', deep: 'น้ำลึก ≥ 1.6 ม.', power: 'ไฟรั่ว', blocked: 'ถนนขาด' }
    cards.push(card({
      id: 'routes', act: 2, icon: 'route', tone: 'loss',
      title: 'ถ้าเลือกเส้นทางที่ปลอดภัยและสั้นที่สุดทุกเที่ยว',
      you: [unsafe.length ? `เส้นทางผิด ${unsafe.length} ครั้ง${kinds.length ? ` (ผ่าน${kinds.map((k) => HZ[k] || k).join(' / ')})` : ''}` : '', long.length ? `อ้อมเกิน ${long.length} ครั้ง (+${extraKm.toFixed(1)} กม.)` : ''].filter(Boolean).join(' · '),
      alt: `ทุกเที่ยวใช้เส้นที่ไม่ผ่านอันตรายและสั้นที่สุด — ไม่เสียเวลาถอยกลับ 90 นาที/ครั้ง`,
      delta: { v: `+${hrs(unsafe.length * 90)}${extraL > 0.05 ? ` · ${extraL.toFixed(1)} L` : ''}`, unit: 'เวลาเรือ · น้ำมันที่ประหยัด' },
      lesson: 'Sphere รู้จักถนนแต่ไม่รู้ว่าน้ำท่วมตรงไหน — ต้องตรวจทุกเส้นทางกับเรดาร์และรายงานไฟรั่ว',
      weight: 10 * unsafe.length + 3 * long.length, sum: { min: unsafe.length * 90 },
    }))
  } else if (log.length) good.push(`เลือกเส้นทางเรือถูกทุกเที่ยว (${log.length} เที่ยว)`)

  if (s.wrongDest) {
    cards.push(card({
      id: 'hospital', act: 2, icon: 'hospital', tone: 'loss',
      title: 'ถ้าส่งผู้บาดเจ็บไปโรงพยาบาลโดยตรง',
      you: `ส่งผู้บาดเจ็บไปจุดอพยพ ${s.wrongDest} ครั้ง — ต้องส่งต่ออีกทอด`,
      alt: `เลือกปลายทาง "${HOSPITAL.th}" ตั้งแต่แรก`,
      delta: { v: `−${s.wrongDest}`, unit: 'การส่งต่อที่ไม่จำเป็น' },
      lesson: 'คัดแยกผู้ประสบภัย (triage) ตั้งแต่ต้นทาง: บาดเจ็บ → โรงพยาบาล',
      weight: 8 * s.wrongDest,
    }))
  }

  const need = s.points.reduce((a, p) => a + p.people, 0), lostAll = s.points.reduce((a, p) => a + lostOf(p), 0)
  if (need && !lostAll) good.push(`ช่วยผู้ติดค้างได้ครบทุกจุด (${fmt(need)} คน)`)
  if (scn.act2Passes.every((q) => s.act2Orders[q.id])) good.push('สั่ง THEOS-2 ครบทุกรอบโคจร')
  const injured = s.points.reduce((a, p) => a + p.injured, 0)
  if (injured && !s.wrongDest) good.push('ผู้บาดเจ็บถึงโรงพยาบาลทุกคน')
  return { cards, good }
}

/* ═════════════════════════════ Act 3 ═════════════════════════════ */

const PAY = (v) => (v === 'flat' ? RELIEF.flatGrant : v === 'both' ? RELIEF.flatGrant + RELIEF.mudGrant : 0)
const VTH = { flat: `อนุมัติ ${baht(RELIEF.flatGrant)}`, both: `อนุมัติ ${baht(RELIEF.flatGrant + RELIEF.mudGrant)} (รวมค่าล้างโคลน)`, reject: 'ปฏิเสธคำร้อง' }
const OUT_TH = { overpay: 'จ่ายเกิน', denial: 'ตัดสิทธิ์ผิด', under: 'จ่ายขาด' }

function act3(s, scn) {
  const cards = [], good = []
  let correct = 0
  for (const r of scn.roofs) {
    const v = s.locked && !s.locked[r.id] ? null : s.adjudged[r.id]     // drafts are not decisions
    if (!v) continue
    const out = evaluateRoof(r, v)
    if (out === 'correct') { correct++; continue }
    const right = r.truth.flat ? (r.truth.mud ? 'both' : 'flat') : 'reject'
    const diff = PAY(v) - PAY(right)
    const missing = [r.theosCloud ? 'เมฆบังภาพหลัง' : '', r.radarGap ? 'เรดาร์ขาดรอบ' : ''].filter(Boolean)
    const surveyed = s.surveyed.includes(r.id)
    cards.push(card({
      id: `roof-${r.id}`, act: 3, icon: 'relief', tone: 'loss',
      title: `${r.id} · โซน ${r.section}: ${OUT_TH[out]}`,
      you: VTH[v],
      alt: `${VTH[right]} — ท่วมขังจริง ${r.days} วัน (เกณฑ์ ${RELIEF.inundationMinDays}) · โคลน${r.mud ? 'ทับถมชัด' : 'ไม่พบ'}`,
      delta: diff > 0 ? { v: `−${baht(diff)}`, unit: 'จ่ายเกินจากงบเยียวยา' } : { v: `+${baht(-diff)}`, unit: 'ที่ครัวเรือนนี้ควรได้รับ' },
      lesson: missing.length && !surveyed ? `หลักฐานไม่ครบ (${missing.join(' · ')}) — ถ้าส่งสำรวจภาคพื้น (${baht(RELIEF.surveyCost)} · +${DURATIONS.surveyDays} วัน) จะตัดสินถูก`
        : out === 'denial' ? 'ตัดสิทธิ์ผิด = คนเดือดร้อนจริงไม่ได้รับความช่วยเหลือ — นับแท่งเรดาร์ให้ครบก่อน'
          : out === 'under' ? 'เห็นปื้นโคลนรอบบ้านในภาพหลังแต่ไม่ได้อนุมัติค่าล้างโคลน'
            : `นับวันท่วมขังจากกราฟเรดาร์ให้ครบ — เกณฑ์ ${RELIEF.inundationMinDays} วัน`,
      weight: 6 + Math.abs(diff) / 2500, sum: { baht: Math.abs(diff) },
    }))
  }
  const needless = s.surveyed.filter((id) => { const r = scn.roofs.find((x) => x.id === id); return r && !r.theosCloud && !r.radarGap })
  if (needless.length) {
    cards.push(card({
      id: 'survey', act: 3, icon: 'survey', tone: 'loss',
      title: 'ถ้าส่งสำรวจเฉพาะหลังที่หลักฐานไม่ครบ',
      you: `ส่งสำรวจ ${needless.join(', ')} ทั้งที่ภาพและเรดาร์ครบ`,
      alt: 'ตัดสินจากภาพ THEOS-2 + ไทม์ซีรีส์เรดาร์ได้เลย',
      delta: { v: `+${needless.length * DURATIONS.surveyDays} วัน · ${baht(needless.length * RELIEF.surveyCost)}`, unit: 'เวลาและงบที่ประหยัด' },
      lesson: 'การสำรวจภาคพื้นแม่นแต่ช้า — ใช้เมื่อข้อมูลระยะไกลไม่พอเท่านั้น',
      weight: 4 * needless.length, sum: { baht: needless.length * RELIEF.surveyCost },
    }))
  }
  const rel = reliefSummary(s, scn)
  if (rel.done >= rel.total && Math.abs(rel.projected - rel.projectedIdeal) > 1) {
    const gap = rel.projected - rel.projectedIdeal
    cards.push(card({
      id: 'district', act: 3, icon: 'money', tone: gap > 0 ? 'loss' : 'gain',
      title: `ถ้าใช้เกณฑ์แบบเดียวกันทั้งอำเภอ (${fmt(rel.householdsInScope)} ครัวเรือน)`,
      you: `ค่าเฉลี่ยของคุณ → ประมาณ ${baht(rel.projected)}`,
      alt: `ตัดสินถูกทุกหลัง → ประมาณ ${baht(rel.projectedIdeal)}`,
      delta: { v: `${gap > 0 ? '−' : '+'}${baht(Math.abs(gap))}`, unit: gap > 0 ? 'งบที่จ่ายเกินทั้งอำเภอ' : 'เงินที่ประชาชนควรได้เพิ่ม' },
      lesson: 'ความผิดพลาดเล็ก ๆ ต่อหลังคา กลายเป็นเงินหลายล้านเมื่อใช้ทั้งอำเภอ — หลักฐานดาวเทียมช่วยให้จ่ายตรงสิทธิ์',
      weight: 5 + Math.abs(gap) / 1e6,
    }))
  }
  if (rel.done && correct === rel.done) good.push(`ตัดสินเยียวยาถูกทุกหลัง (${correct}/${rel.total})`)
  if (s.clock <= MISSION.deadlineDays * 1440 && rel.done >= rel.total) good.push(`จบภายในวันที่ ${MISSION.deadlineDays}`)
  return { cards, good }
}

/* ═════════════════════════════ API ═════════════════════════════ */

const BY_ACT = { 1: act1, 2: act2, 3: act3 }

/** What-if debrief for one act: cards sorted by impact, the strong points, and totals. */
export function whatIf(s, scn, act) {
  const { cards, good } = BY_ACT[act](s, scn)
  cards.sort((a, b) => b.weight - a.weight)
  const total = (k) => cards.reduce((a, c) => a + (c.sum?.[k] || 0), 0)
  return { act, cards, good, totals: { hh: total('hh'), people: total('people'), baht: total('baht'), images: total('images'), min: total('min') } }
}
