/* ══════════════════════════════════════════════════════════════════════════
   MAE SAI COMMAND — "Perfect Run" gameplay recording
   Plays dist/index.html from the Mission Briefing to the AAR the way a strong
   player would, with a Thai caption for every step:
     Act 1  briefing → scan 3 sectors (L) → 3 evidence layers → town embankment:
            measure N + seal 14 gaps → read SFVI → evacuate 4 communities → summary
     Act 2  cloud 100% → SAR radar → Sphere Routing detour → triage in SFVI order
     Act 3  roof before/after slider → survey weak evidence → correct relief
            on all 10 roofs (฿9,000 / +฿10,000 / reject) → mission score + report

     npm run build
     node record-perfect-run.mjs     → recordings/perfect-run-<timestamp>/demo_gameplay.mp4 (+ .webm)
     RECORD_OUT=my-folder node record-perfect-run.mjs

   The briefing is not skipped (no ?demo), so the log session is a normal one —
   it lives only in the recorder's throw-away browser profile.
   ══════════════════════════════════════════════════════════════════════════ */

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { CURSOR_JS, wait, makeMarks, glide, point, click, sweep, caption, launch, finish, toMp4 } from './scripts/demo-kit.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = pathToFileURL(join(HERE, 'dist', 'index.html')).href
const OUT = resolve(HERE, process.env.RECORD_OUT || join('recordings', `perfect-run-${new Date().toISOString().slice(0, 19).replace(/\D/g, '')}`))
const NAME = 'demo_gameplay'
const W = 1920, H = 1080
const MIN_DAYS = 7                        // RELIEF.inundationMinDays in src/config/missionConfig.js
const timer = makeMarks()
const { mark } = timer

async function main() {
  const session = await launch(OUT, { width: W, height: H })
  const { page } = session
  const tab = (id) => page.locator(`[data-rail="command"] [data-tab="${id}"]`)
  const say = (step, text) => caption(page, step, text)

  await page.goto(APP, { waitUntil: 'load' })
  await page.waitForSelector('[data-modal="briefing"]', { timeout: 20000 })
  await page.evaluate(CURSOR_JS)
  await glide(page, W / 2, H / 2, 2)

  /* ══════════ ACT I — เฝ้าระวัง T−48 ══════════ */
  mark('ACT I · mission briefing')
  await say('เริ่ม', 'อ่าน Mission Briefing — บทบาท: ผู้บัญชาการ EOC อำเภอแม่สาย')
  await wait(3500)
  await click(page, page.locator('[data-modal="briefing"] input'), { after: 200 })
  await page.keyboard.type('PERFECT RUN', { delay: 70 })
  await say('คลิก 1', 'กด "เข้าสู่ศูนย์บัญชาการ"')
  await click(page, page.locator('[data-modal="briefing"] button', { hasText: 'เข้าสู่ศูนย์บัญชาการ' }), { hold: 700, after: 1200 })
  await say('คลิก 2', 'แบบทดสอบก่อนเรียน 5 ข้อ — คลิปนี้กด "ข้ามแบบทดสอบ"')
  await wait(1500)
  await click(page, page.locator('[data-modal="quiz-pre"] button', { hasText: 'ข้ามแบบทดสอบ' }), { after: 1500 })
  await page.waitForSelector('[data-quest]')
  await say('ภารกิจ', 'กล่องภารกิจองก์ 1 (ขวาบน) — ทำ 3 สเต็ปตามช่องที่กระพริบ')
  await point(page, page.locator('[data-quest]'), { hold: 2600 })

  // step 1 — three THEOS-2 swaths over the sectors with the most fresh scars
  await say('สเต็ป 1', 'สแกนป่าต้นน้ำ: คลิกแถบ SECTOR C → B → A บนแผนที่ เพื่อหาจุดดินถล่ม (ค่า L)')
  for (const id of ['C', 'B', 'A']) await click(page, page.locator(`[data-sector="${id}"]`), { hold: 500, after: 1900 })
  await point(page, page.locator('[data-quest-step="scan"]'), { hold: 1600 })
  mark('  step 1 · 3 swaths, 12 scars (L)')

  // evidence layers before the decision (Sandbox criterion: ≥ 3)
  await say('หลักฐาน', 'แท็บ ① ภาพต้นน้ำ → เปิดชั้นข้อมูล แม่น้ำ · ถนน · ชุมชน (ดูหลักฐาน ≥ 3 ชั้นก่อนตัดสินใจ)')
  await click(page, tab('data'), { after: 500 })
  for (const id of ['river', 'roads', 'pop']) await click(page, page.locator(`[data-layer="${id}"]`), { after: 650 })
  mark('  three evidence layers')

  // step 2 — town embankment on sphere imagery
  await say('สเต็ป 2', 'กด "เปิดแนวตลิ่งเมือง" — ภาพดาวเทียม GISTDA Sphere จริง + อาคารจริง')
  await click(page, page.locator('[data-quest-go="bank"]'), { hold: 600, after: 4800 })
  await say('สเต็ป 2', 'คลิกป้าย "คลิกวัดความกว้างลำน้ำ" → ลำน้ำเหลือ 28 ม. จากเดิม 150 ม. (ค่า N)')
  await click(page, page.locator('[data-ruler="open"] rect'), { hold: 700, after: 2400 })
  await say('สเต็ป 2', 'คลิกหมุดแดง (จุดฟันหลอ) → ดูหลังคาเสี่ยงด้านหลัง → กด "อุดจุดนี้ด้วยบิ๊กแบ็ก"')
  await click(page, page.locator('[data-gap="FW-07"]'), { hold: 600, after: 1800 })
  await click(page, page.locator('[data-gap-card] button', { hasText: 'อุดจุดนี้' }), { after: 1300 })
  await say('สเต็ป 2', 'กด "อุดที่เหลือทั้งหมด" → แนวกั้นน้ำครบ 14 จุด หมุดเปลี่ยนเป็นสีเขียว')
  await click(page, page.locator('[data-embankment-bar] button', { hasText: 'อุดที่เหลือ' }), { hold: 600, after: 2600 })
  mark('  step 2 · N measured, 14 gaps sealed')

  // step 3 — read the SFVI, then evacuate all four communities
  const sfvi = (await page.locator('[data-panel="sfvi"] .num').first().innerText()).trim()
  await say('สเต็ป 3', `ดู LIVE SFVI ทางซ้าย = ${sfvi} ผ่านเกณฑ์ 0.62 → หลักฐานพอสั่งอพยพ`)
  await point(page, page.locator('[data-panel="sfvi"]'), { hold: 3000 })
  await say('สเต็ป 3', 'แท็บ ③ ตัดสินใจ → ทั้ง 4 ชุมชน "≥ เกณฑ์" → กด "ประกาศอพยพ 4 ชุมชน"')
  await click(page, page.locator('[data-quest-go="decide"]'), { after: 1400 })
  await click(page, page.locator('[data-panel="decide"] button', { hasText: 'ประกาศอพยพ' }), { hold: 900, after: 1800 })
  mark('  step 3 · evacuation of 4 communities (justified)')

  await say('จบองก์ 1', 'หน้าสรุปผล: ทุกชุมชนอพยพทัน · ความเชื่อมั่น 100% → กด "เข้าสู่ องก์ 2"')
  await point(page, page.locator('[data-modal="act1-summary"]'), { hold: 3600 })
  await click(page, page.locator('[data-modal="act1-summary"] button', { hasText: 'เข้าสู่ องก์ 2' }), { hold: 700, after: 2000 })
  mark('ACT I complete → summary')

  /* ══════════ ACT II — วิกฤต T+0 ══════════ */
  mark('ACT II · cloud 100%')
  await say('องก์ 2', 'มวลน้ำถึงเมือง เมฆบัง 100% ภาพเชิงแสงใช้ไม่ได้ → กด "เปิดเรดาร์ SAR (เช็คน้ำ)"')
  await wait(2200)
  await click(page, page.locator('[data-modal="cloud"] button', { hasText: 'เปิดเรดาร์ SAR' }), { hold: 600, after: 2400 })
  await say('องก์ 2', 'เรดาร์พบถนนถูกดินโคลนตัดขาด → กด "เปิดเครื่องมือ Sphere Routing"')
  await click(page, page.locator('[data-map-view="sar"] button', { hasText: 'เปิดเครื่องมือ Sphere Routing' }), { hold: 900, after: 1600 })
  await say('องก์ 2', 'เลือก "สายลมจอย" (ทางออกเส้นเดียว) → กด "คำนวณเส้นทางหนีน้ำ"')
  await click(page, page.locator('[data-route-from="slj"]'), { after: 600 })
  await click(page, page.locator('[data-panel="route"] button', { hasText: 'คำนวณเส้นทาง' }), { hold: 500, after: 600 })
  await page.locator('[data-panel="route"] .num', { hasText: 'km' }).first().waitFor({ timeout: 25000 })
  await say('องก์ 2', 'เส้นสีเขียว = เส้นทาง GISTDA Sphere Routing เลี่ยงถนนน้ำท่วม ไปจุดอพยพบนที่สูง')
  await wait(3800)
  mark('  Sphere Routing detour (Sai Lom Joy → high ground)')

  const order = await page.locator('[data-ranked]').evaluateAll((els) => els.map((e) => e.dataset.ranked))
  await say('องก์ 2', 'แท็บ "จัดลำดับ": ส่งเรือ/ขบวนกู้ภัยให้ชุมชนเรียงตาม SFVI (ดูลำดับที่แผงซ้าย)')
  await click(page, tab('triage'), { after: 900 })
  await point(page, page.locator('[data-ranked]').first(), { hold: 1400 })
  for (const id of order) await click(page, page.locator(`[data-triage="${id}"]`), { after: 650 })
  await say('องก์ 2', 'กด "ปล่อยขบวนตามลำดับ" → ตรงกฎ 4/4')
  await click(page, page.locator('[data-panel="triage"] button', { hasText: 'ปล่อยขบวน' }), { hold: 600, after: 2600 })
  mark(`  triage released (${order.join(' → ')})`)

  await say('จบองก์ 2', 'กด "องก์ถัดไป" (มุมขวาบน) → เข้าสู่การฟื้นฟู')
  await click(page, page.locator('[data-next-act]'), { hold: 700, after: 2400 })

  /* ══════════ ACT III — ฟื้นฟู T+36 ══════════ */
  mark('ACT III · relief')
  await say('องก์ 3', 'แท็บ "เยียวยารายหลังคา" — ตัดสินเงินเยียวยาทีละหลังคาเรือนจริง (GISTDA)')
  await click(page, page.locator('[data-aar-tab="decisions"]'), { after: 1400 })
  const rows = page.locator('[data-roof]')
  const n = await rows.count()
  const verdictIdx = { flat: 0, both: 1, reject: 2 }
  const verdictTh = { flat: 'อนุมัติ ฿9,000', both: 'อนุมัติ ฿9,000 + ค่าล้างโคลน ฿10,000', reject: 'ปฏิเสธ (ไม่เข้าเกณฑ์)' }
  for (let i = 0; i < n; i++) {
    const tr = rows.nth(i)
    const id = await tr.getAttribute('data-roof')
    await click(page, tr.locator('td').first(), { hold: 300, after: 700 })
    if (i === 0 || i === 4) {
      await say('องก์ 3', 'เลื่อนสไลเดอร์ ก่อน/หลัง เพื่อตรวจคราบโคลนบนหลังคาจริง')
      await sweep(page, page.locator('[data-roof-compare] [data-slider-handle]'), { left: 210, right: 330, end: -50 })
      await wait(700)
    }
    let verdict, why
    const surveyBtn = tr.locator('button', { hasText: 'ส่งสำรวจ' })
    if (await surveyBtn.count()) {
      await say('องก์ 3', `${id}: หลักฐานจากภาพไม่พอ → กด "ส่งสำรวจ" ภาคพื้นก่อน`)
      await click(page, surveyBtn, { hold: 500, after: 1300 })
      const txt = await tr.innerText()
      const flat = /เหมาจ่าย มีสิทธิ์/.test(txt), mud = /โคลน พบ/.test(txt)
      verdict = flat ? (mud ? 'both' : 'flat') : 'reject'
      why = `ผลภาคสนาม: เหมาจ่าย${flat ? 'มีสิทธิ์' : 'ไม่มีสิทธิ์'} · โคลน${mud ? 'พบ' : 'ไม่พบ'}`
    } else {
      const txt = await tr.innerText()
      const days = +(txt.match(/(\d+) วัน/)?.[1] ?? 0)
      const mud = /MUD CONFIRMED/.test(txt)
      verdict = days >= MIN_DAYS ? (mud ? 'both' : 'flat') : 'reject'
      why = `ท่วมขัง ${days} วัน${days >= MIN_DAYS ? ' (≥ 7)' : ' (< 7)'} · ${mud ? 'มีคราบโคลนชัด' : 'ไม่มีคราบโคลน'}`
    }
    await say('องก์ 3', `${id}: ${why} → ${verdictTh[verdict]}`)
    await click(page, page.locator(`[data-roof-actions="${id}"] button`).nth(verdictIdx[verdict]), { hold: 700, after: 1200 })
  }
  mark('  10 roofs adjudicated')
  await say('องก์ 3', 'ตัดสินครบ 10 หลัง — ถูกต้องทุกหลัง · ดูงบเยียวยาที่อนุมัติ')
  await point(page, page.locator('[data-panel="relief-budget"]'), { hold: 3000 })

  await say('AAR', 'แท็บ "สรุป": คะแนนความสำเร็จของภารกิจ + ไทม์ไลน์ปฏิบัติการ')
  await click(page, page.locator('[data-aar-tab="summary"]'), { after: 1000 })
  await point(page, page.locator('[data-panel="mission-score"]'), { hold: 3500 })
  await say('AAR', 'แท็บ "รายงาน": ตารางสรุป After Action Review')
  await click(page, page.locator('[data-aar-tab="report"]'), { after: 1200 })
  const score = await page.evaluate(() => {
    const cell = [...document.querySelectorAll('div')].find((d) => d.textContent.trim() === 'คะแนนภารกิจ')
    return cell?.nextElementSibling?.textContent.trim() || ''
  })
  await say('Perfect Run', `จบภารกิจ — คะแนนภารกิจ ${score}`)
  await wait(4500)
  mark(`AAR · mission score ${score}`)

  const webm = await finish(session, OUT, `${NAME}.webm`, timer)
  toMp4(webm, join(OUT, `${NAME}.mp4`))
}

main().catch((e) => { console.error('RECORDING FAILED:', e); process.exit(1) })
