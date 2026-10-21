/* ══════════════════════════════════════════════════════════════════════════
   HINT LADDER — คำใบ้แบบบันได (scaffolding ที่ค่อย ๆ ถอนออก)
   ขั้น 1  ถามชวนคิด    — ฟรี ผู้ช่วยสอนแสดงเอง: บอกว่า "ต้องคิดเรื่องอะไร" ไม่บอกคำตอบ
   ขั้น 2  ชี้ที่ข้อมูล   — ผู้เล่นกดขอ: พาไปที่ข้อมูลที่ต้องอ่าน + ไฟกะพริบรอบจุดนั้น
   ขั้น 3  เฉลยบางส่วน  — ผู้เล่นกดขอ: ตัวเลข/รายชื่อบางส่วน หรือตัวอย่างวิธีคิด
   องก์ 1 เปิดได้ครบ 3 ขั้น · องก์ 2 ถึงขั้น 2 · องก์ 3 มีแค่คำถาม (HINTS.maxRung)
   ทุกขั้นคำนวณจาก state ปัจจุบัน — ไม่มีขั้นไหนเผยสิ่งที่ผู้เล่นยังมองไม่เห็น
   (เช่น เมฆจริง ผู้ติดค้างที่ยังไม่พบ ผลจริงของหลังคา)
   ══════════════════════════════════════════════════════════════════════════ */

import * as A from './actions'
import { previewCamp } from './impact'
import { computeSfvi, peakDepth, arrivalAt, evacNeedMin, HARM_M } from '../lib/sim'
import { firstCrossing } from '../lib/hydro'
import { cloudCover } from '../lib/clouds'
import { SECTIONS } from '../lib/sections'
import { EMBANKMENT_GAPS } from '../lib/embankment'
import { CAMP_SITES } from '../config/scenarioData'
import { THEOS2, THRESHOLDS, SFVI, HINTS, MODES, ACT2, DURATIONS, RELIEF, COSTS, SANDBAG } from '../config/missionConfig'
import { clockLabel, fmt } from '../lib/format'

const RIVER = ['D', 'E', 'TOWN']
const tgt = (t) => (t === 'TOWN' ? 'ตัวเมือง' : `Sector ${t}`)
const hm = (min) => { const m = Math.max(0, Math.round(min)); return m >= 60 ? `${Math.floor(m / 60)} ชม.${m % 60 ? ` ${m % 60} นาที` : ''}` : `${m} นาที` }

/** The three rungs, as the player sees them. */
export const RUNGS = {
  1: { th: 'ถามชวนคิด', en: 'ASK', hex: '#7DD3FC' },
  2: { th: 'ชี้ที่ข้อมูล', en: 'POINT', hex: '#FFD066' },
  3: { th: 'เฉลยบางส่วน', en: 'PARTIAL', hex: '#FF8FA8' },
}

/** Highest rung the player has opened for a topic (rung 1 is always open). */
export const rungOf = (s, topic) => s.hints?.[topic] || 1
/** Highest rung this act allows (0 = no hints at all, i.e. Expert). */
export const maxRungFor = (s) => (MODES[s.modeId]?.tutor ? HINTS.maxRung[s.act] || 1 : 0)

/* ── Topics ──────────────────────────────────────────────────────────────── */

const TOPICS = {
  /* ═════ Act 1 ═════ */
  'a1.camp': {
    title: 'ตั้งฐานบัญชาการ',
    rungs: ({ s, scn }) => {
      const flooded = CAMP_SITES.filter((c) => previewCamp(s, scn, c.id)?.verdict?.tone === 'bad')
      return [
        { th: 'ตอนน้ำขึ้นสูงสุด ฐานต้องยังใช้งานได้และเรือต้องออกได้ทันที — ที่ไหนพื้นสูงพอ และไม่อยู่ติดแม่น้ำจนน้ำท่วมถึง?' },
        { th: 'เทียบ "พื้น … ม." กับ "ห่างแม่น้ำ … กม." ของทั้ง 3 ที่ในแท็บ ④ ฐาน แล้วดูตำแหน่งบนแผนที่เทียบกับโซนที่น้ำจะท่วม (สีในมุมมองเมือง)',
          go: { tab: 'base', view: 'urban' }, spot: '[data-camp]' },
        { th: flooded.length
          ? `ที่ตั้งที่น้ำจะท่วมถึง: ${flooded.map((c) => c.th).join(', ')} — ตัดออก แล้วเลือกจากที่เหลือโดยดูว่าใกล้เขตน้ำท่วมพอให้เรือถึงเร็ว`
          : 'ทั้ง 3 ที่พ้นน้ำ — เลือกที่ใกล้เขตน้ำท่วมที่สุดเพื่อให้เรือถึงเร็ว' },
      ]
    },
  },

  'a1.task': {
    title: 'เลือกเป้าหมาย THEOS-2',
    rungs: ({ s, scn }) => {
      const next = scn.passes.find((p) => p.t > s.clock)
      if (!next) return [{ th: 'หมดรอบโคจรในองก์นี้แล้ว — ใช้ภาพที่มีให้คุ้มที่สุด' }, { th: 'ดูคิวภาพในแท็บ ① ภาพ', go: { tab: 'theos' } }, { th: 'ไม่มีรอบให้เลือกแล้ว' }]
      const byCloud = [...next.reach].sort((a, b) => next.forecast[a] - next.forecast[b])
      const best = byCloud.slice(0, THEOS2.targetsPerPass)
      const hasRiver = s.images.some((i) => i.usable && RIVER.includes(i.target)) || s.channel.measured
      const river = byCloud.find((t) => RIVER.includes(t) && next.forecast[t] <= THEOS2.cloudUsablePct)
      const swap = !hasRiver && river && !best.some((t) => RIVER.includes(t))
      return [
        { th: `ภาพเชิงแสงมองทะลุเมฆไม่ได้ — รอบ ${next.id} เป้าไหนมีโอกาสเห็นพื้นดิน และเป้าไหนช่วยวัดความกว้างลำน้ำ (ค่า N) ได้ด้วย?` },
        { th: `ดูตัวเลข ☁ % ข้างชื่อเป้าในการ์ดรอบ ${next.id} (แท็บ ① ภาพ) — เกิน ${THEOS2.cloudUsablePct}% ภาพมักใช้ไม่ได้ · ภาพ Sector D, E หรือตัวเมือง ใช้วัดลำน้ำได้ · ตารางเมฆรายรอบอยู่ในแท็บ "ดาวเทียม" ทางซ้าย`,
          go: { tab: 'theos', view: 'catchment', left: 'sat' }, spot: `[data-pass="${next.id}"]` },
        { th: `เมฆพยากรณ์ต่ำสุดรอบ ${next.id}: ${best.map((t) => `${tgt(t)} ${next.forecast[t]}%`).join(' · ')}${swap ? ` — แต่ยังไม่มีภาพลำน้ำ ลองเปลี่ยนเป้าหนึ่งเป็น ${tgt(river)} (${next.forecast[river]}%)` : ''}` },
      ]
    },
  },

  'a1.read': {
    title: 'แปลภาพหารอยดินถล่มใหม่',
    rungs: ({ s, scn, imageId }) => {
      const img = s.images.find((i) => i.id === imageId) || s.images.find((i) => i.usable && i.readyAt <= s.clock && !i.analyzed && i.target !== 'TOWN')
      const scene = img ? scn.scenes[img.target] : null
      return [
        { th: 'รอยดินถล่ม "ใหม่" ต่างจากสิ่งที่มีอยู่แล้วอย่างไร? ลากเส้นเทียบภาพก่อน/หลังทีละหมุด — อะไรที่มีในภาพก่อนด้วยไม่ใช่ของใหม่' },
        { th: 'ดูทีละหมุดตามลักษณะนี้:',
          list: [
            'ดินถล่มใหม่ — แนวสีน้ำตาลแดงยาวลงตามลาดเขา มีดินกองที่ปลาย ไม่มีในภาพก่อน',
            'ทุ่งนา/ไร่ — รูปสี่เหลี่ยม มีแนวร่อง มีในภาพก่อนด้วย',
            'เงาเมฆ — ปื้นเทาเข้มไม่มีพื้นผิว มีเมฆขาวอยู่ข้าง ๆ',
            'รอยเก่า — สีน้ำตาลอมเขียว ต้นไม้เริ่มขึ้น มีในภาพก่อนแล้ว',
          ],
          go: img ? { tab: 'theos', analyze: img.id } : { tab: 'theos' } },
        { th: scene
          ? `ภาพ ${tgt(img.target)} มีรอยดินถล่มใหม่ ${scene.scars} จุด จากหมุดทั้งหมด ${scene.cands.length} หมุด — ที่เหลือเป็นสิ่งหลอกตา`
          : 'ยังไม่มีภาพที่พร้อมแปล' },
      ]
    },
  },

  'a1.channel': {
    title: 'วัดความกว้างลำน้ำ (ค่า N)',
    rungs: () => [
      { th: `ความกว้างลำน้ำต้องวัดจากขอบน้ำถึงขอบน้ำ ไม่ใช่กำแพงหรือตลิ่ง — ภาพ Pan 1 พิกเซลยาวกี่เมตร และลำน้ำสายเดิมกว้างเท่าไร?` },
      { th: `ผิวน้ำคือแถบเทาเข้มเรียบตรงกลาง ขนาบด้วยตลิ่งดิน (เทากลาง) และกำแพงคอนกรีต (ขาว) — วางเส้นเหลืองชิดขอบแถบเทาเข้ม (เส้นประบนภาพ) · ค่า ${THEOS2.panM} ม./พิกเซล และ ${THRESHOLDS.origChannelWidth} ม. อยู่ในแท็บ "ดาวเทียม" ทางซ้าย`,
        go: { tab: 'bank', channel: true }, spot: '[data-channel-image]' },
      { th: `ตัวอย่างวิธีคิด (ตัวเลขสมมติ): วัดได้ 40 พิกเซล → 40 × ${THEOS2.panM} = 20 ม. → N = 1 − 20 ÷ ${THRESHOLDS.origChannelWidth} = 0.87 — ทำแบบเดียวกันกับจำนวนพิกเซลที่คุณวัดได้` },
    ],
  },

  'a1.seal': {
    title: 'อุดจุดฟันหลอของแนวตลิ่ง',
    rungs: ({ s, scn }) => {
      const queued = new Set(s.jobs.filter((j) => j.kind === 'seal').map((j) => j.gap))
      const open = EMBANKMENT_GAPS.filter((g) => !s.sealed.includes(g.id) && !queued.has(g.id)).map((g) => g.id)
      const after = open.length ? A.sealGaps(s, scn, open) : s
      const jobs = after.jobs.filter((j) => j.kind === 'seal')
      const finish = jobs.length ? Math.max(...jobs.map((j) => j.at)) : s.clock
      const wet = SECTIONS.filter((z) => peakDepth(s, z) >= HARM_M)
      const first = wet.length ? Math.min(...wet.map((z) => arrivalAt(s, z))) : Infinity
      return [
        { th: 'แต่ละแผนแลกอะไรกับอะไร — เงิน เวลา ความทนน้ำ หรืองบที่เหลือไว้อพยพ? และหลักฐานที่คุณมีตอนนี้พอบอกไหมว่าจุดไหนเสี่ยงจริง?' },
        { th: `มุมมอง "แนวตลิ่งเมือง" แสดงจุดฟันหลอเป็นหมุดแดง · ตารางโซนคอลัมน์ "ลึก" และ "น้ำถึง" บอกว่าโซนหลังตลิ่งเสี่ยงแค่ไหน · ทีมใช้ ~${DURATIONS.bigbagPerMetre} นาที/เมตร`,
          go: { tab: 'bank', view: 'corridor' }, spot: '[data-seal-plans]' },
        { th: open.length
          ? `บิ๊กแบ็กทั้งแนว ${open.length} จุดถ้าสั่งตอนนี้จะเสร็จ ${clockLabel(finish)} — น้ำเริ่มเข้าโซนแรก ${Number.isFinite(first) ? clockLabel(first) : '—'}${Number.isFinite(first) ? (finish <= first ? ' (ทัน)' : ' (ไม่ทัน — ลองอุดเฉพาะจุดเสี่ยงที่หลักฐานชี้)') : ''} · กระสอบทรายพังเมื่อน้ำ ≥ ${SANDBAG.failLevel.toFixed(2)} ม.`
          : 'ส่งทีมครบทุกจุดแล้ว — รอทีมทำงานตามคิว' },
      ]
    },
  },

  'a1.evac': {
    title: 'สั่งอพยพรายโซน',
    rungs: ({ s, sfvi }) => {
      const gaugeOk = sfvi.veto1 || sfvi.world.level >= sfvi.prepLevel
      const pending = SECTIONS.filter((z) => s.orders[z.id] === undefined)
      const wet = pending.filter((z) => peakDepth(s, z) >= HARM_M)
      const hot = sfvi.perSection.filter((z) => z.score >= SFVI.decisionBand && s.orders[z.id] === undefined).map((z) => z.id)
      const urgent = [...wet].sort((a, b) => (arrivalAt(s, a) - evacNeedMin(a)) - (arrivalAt(s, b) - evacNeedMin(b)))[0]
      const prepAt = firstCrossing(sfvi.prepLevel, s.clock, 0)
      let part
      if (!wet.length) part = 'ทุกโซนที่น้ำจะถึงสั่งอพยพแล้ว — ที่เหลือน้ำแทบไม่ถึง ไม่ต้องสั่ง'
      else if (gaugeOk) part = `ระดับน้ำถึงเกณฑ์แล้ว สั่งได้ไม่เป็นเตือนผิด — โซนที่น้ำจะถึงและยังไม่ได้สั่ง: ${wet.map((z) => z.id).join(', ')}`
      else if (hot.length) part = `โซนที่ SFVI ≥ ${SFVI.decisionBand} แล้ว: ${hot.join(', ')} — สั่งได้โดยไม่เป็นเตือนผิด · โซนที่ต้องเริ่มก่อนเพื่อน: ${urgent.id}`
      else part = `ยังไม่มีโซนที่หลักฐานพอ — ระดับน้ำจะถึง ${sfvi.prepLevel.toFixed(2)} ม.${Number.isFinite(prepAt) ? ` ราว ${clockLabel(prepAt)}` : ''} · โซนที่ต้องเริ่มก่อนเพื่อน: ${urgent.id} (น้ำถึง ${clockLabel(arrivalAt(s, urgent))} ใช้เวลาอพยพ ${hm(evacNeedMin(urgent))})`
      return [
        { th: 'น้ำจะถึงโซนไหนก่อนที่การอพยพจะเสร็จ? โซนไหนน้ำไม่ถึงเลย? และตอนนี้หลักฐานพอหรือยัง — ถ้ายังไม่พอจะกลายเป็นเตือนผิด' },
        { th: `ตารางโซน (แผงซ้าย "โซน" หรือแท็บ ③): เทียบ "น้ำถึง" กับ "ใช้ … ชม." ของแต่ละโซน · "น้ำแทบไม่ถึง" = ไม่ต้องสั่ง · หลักฐานพอเมื่อ SFVI ของโซน ≥ ${SFVI.decisionBand} หรือระดับน้ำ ≥ ${sfvi.prepLevel.toFixed(2)} ม.`,
          go: { tab: 'zones', view: 'urban', left: 'zones' }, spot: '[data-panel="zones-order"] [data-pick]' },
        { th: part },
      ]
    },
  },

  /* ═════ Act 2 ═════ */
  'a2.pass': {
    title: 'สั่ง THEOS-2 หาผู้ติดค้าง',
    rungs: ({ s, scn }) => {
      const next = scn.act2Passes.find((q) => q.t > s.clock)
      return [
        { th: `คนที่ติดค้างบนหลังคามองเห็นได้จากภาพ ${THEOS2.panM} ม. แต่เฉพาะตอนที่เมฆเปิด — รอบถัดไปดาวเทียมผ่านเมื่อไร และคุณสั่งถ่ายไว้หรือยัง?` },
        { th: `แท็บ ② ดาวเทียม: แต่ละรอบบอกเวลาผ่าน — กด "สั่งถ่าย" ก่อนเวลา (ไม่มีค่าใช้จ่าย) · ตอนนี้เมฆปกคลุมเมือง ${Math.round(cloudCover(scn, s.clock) * 100)}%`,
          go: { tab: 'sensors' }, spot: next ? `[data-pass2="${next.id}"]` : '[data-pass2]' },
        { th: next ? `รอบที่ยังสั่งได้: ${scn.act2Passes.filter((q) => q.t > s.clock && !s.act2Orders[q.id]).map((q) => `${q.id} (${clockLabel(q.t)})`).join(', ') || 'สั่งครบแล้ว'}` : 'ผ่านครบทุกรอบแล้ว' },
      ]
    },
  },

  'a2.find': {
    title: 'ค้นหาผู้ติดค้างที่ดาวเทียมมองไม่เห็น',
    rungs: ({ s, scn }) => [
      { th: 'มีโซนไหนที่ภาพดาวเทียมมองไม่เห็นคน หรือคนในโซนนั้นโทรแจ้งไม่ได้? คุณจะใช้เครื่องมืออะไรแทน?' },
      { th: `แท็บ ② ดาวเทียม: ปุ่มโซนสีม่วง = จุดอับ (ซอยลึก/ใต้ร่มไม้) · แท็บ ③ ภาคสนาม: โซนสัญญาณล่ม — โดรนบินใต้เมฆได้ ${DURATIONS.droneSortie} นาที/เที่ยว ฿${fmt(COSTS.drone)}`,
        go: { tab: 'sensors' }, spot: '[data-drone-zone]' },
      { th: `จุดอับ: ${scn.blindSpots.join(', ')}${s.commDown.length ? ` · สัญญาณล่ม: ${s.commDown.join(', ')}` : ''}` },
    ],
  },

  'a2.hazard': {
    title: 'อันตรายในพื้นที่: ไฟรั่ว · สัญญาณล่ม',
    rungs: ({ s }) => {
      const power = s.hazardsLive.filter((id) => !s.powerCut[id])
      const fact = [power.length ? `มีรายงานไฟฟ้ารั่วโซน ${power.join(', ')}` : '', s.commDown.length ? `สัญญาณล่มโซน ${s.commDown.join(', ')}` : ''].filter(Boolean).join(' · ')
      return [
        { th: `${fact ? `${fact} — ` : ''}เรือที่ผ่านโซนไฟรั่วจะเกิดอะไรขึ้น? ถ้าโซนสัญญาณล่มมีคนติดค้าง คุณสั่งทีมเข้าไปได้ไหม? จะแก้ที่ต้นเหตุ หรือเลี่ยง?` },
        { th: `แท็บ ③ ภาคสนาม: ตัดไฟ = ประสาน กฟภ. ${DURATIONS.powerCut / 60} ชม. ไม่มีค่าใช้จ่าย · เสาสื่อสาร = ${DURATIONS.towerSetup / 60} ชม. ฿${fmt(COSTS.tower)} · หรือเลือกเส้นทางเรือที่ไม่ผ่านโซนไฟรั่ว`,
          go: { tab: 'field' }, spot: '[data-power], [data-comm]' },
        { th: 'โซนไฟรั่วที่มีเส้นทางเรือผ่านควรตัดไฟก่อน · โซนสัญญาณล่มที่มีผู้ติดค้างรออยู่ต้องตั้งเสาก่อนจึงจะส่งเรือได้' },
      ]
    },
  },

  'a2.route': {
    title: 'วางแผนเรือ: ภารกิจ ปลายทาง เส้นทาง',
    rungs: ({ s, pointId }) => {
      const p = s.points.find((x) => x.id === pointId) || s.points.find((x) => x.revealed && x.status === 'waiting')
      const who = p ? `${p.id}: ${p.left} คน` : 'จุดนี้'
      return [
        { th: `${who} — บ้านยังอยู่ได้ (ส่งเสบียง) หรืออยู่ไม่ได้ (ต้องอพยพ)? มีผู้บาดเจ็บไหม ควรไปที่ไหน? เส้นทางไหนเลี่ยงริมแม่น้ำ น้ำลึก ≥ ${ACT2.deepWaterM} ม. และโซนไฟรั่วได้ทั้งขาไปและขากลับ?` },
        { th: 'ในหน้าวางแผนเรือ การ์ดแต่ละเส้นบอกอันตรายไว้แล้ว (〰 ริมน้ำกระแสแรง · ≈ ลึก ≥ 1.6 ม. · ⚡ ไฟรั่ว) — ชี้เมาส์ที่เส้นทางเพื่อดูว่าผ่านอันตรายตรงไหนบนแผนที่',
          go: p ? { plan: p.id } : { tab: 'ops' }, spot: '[data-planner-map]' },
        { th: 'เลือกเส้นที่ขึ้น ✓ ไม่พบอันตราย และสั้นที่สุดในกลุ่มนั้น (เส้น “เลี่ยงจุดอันตราย” หลบให้แล้ว) · ถ้ายังไม่มีเส้นปลอดภัย: ตัดไฟ/สูบน้ำก่อน อย่าเพิ่งส่งเรือ' },
      ]
    },
  },

  /* ═════ Act 3 ═════ */
  'a3.relief': {
    title: 'ตัดสินเยียวยารายหลังคา',
    rungs: ({ roof }) => {
      const days = roof ? roof.series.filter((v) => v === 1).length : 0
      const gaps = roof ? roof.series.filter((v) => v === null).length : 0
      return [
        { th: `บ้านหลังนี้ท่วมขังกี่วัน (นับแท่งสีฟ้าในกราฟเรดาร์) ถึงเกณฑ์ ${RELIEF.inundationMinDays} วันไหม? เห็นปื้นโคลนรอบบ้านในภาพหลังหรือเปล่า? ถ้าข้อมูลขาด (เมฆบัง/เรดาร์ขาดรอบ) จะเสี่ยงตัดสิน หรือส่งสำรวจ?` },
        { th: 'กราฟเรดาร์: ฟ้า = ท่วมขัง · เทา = แห้ง · ลาย = ไม่มีรอบเรดาร์ · ภาพหลัง: ปื้นใหญ่สีน้ำตาลทึบรอบบ้าน = โคลนชัด', spot: '[data-radar-series]' },
        { th: roof ? `นับได้ ${days} วัน${gaps ? ` (ขาดข้อมูล ${gaps} วัน)` : ''}` : '' },
      ]
    },
  },
}

/** Ladder for a topic in the current situation: { topic, title, rungs[1..3], open, max }. */
export function ladder(topic, ctx) {
  const def = TOPICS[topic]
  if (!def) return null
  const full = { ...ctx, sfvi: ctx.sfvi || computeSfvi(ctx.s, ctx.scn) }
  const rungs = def.rungs(full)
  return { topic, title: def.title, rungs: [null, ...rungs], open: rungOf(ctx.s, topic), max: maxRungFor(ctx.s) }
}

export const HINT_TOPICS = Object.keys(TOPICS)

/** Rung costs as shown on the buttons. */
export const rungCost = (r) => HINTS.cost[r] || 0
