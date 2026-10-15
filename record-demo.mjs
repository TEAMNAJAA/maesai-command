/* ══════════════════════════════════════════════════════════════════════════
   MAE SAI COMMAND — automated demo recording
   Drives the built single-file app (dist/index.html?demo — skips the briefing
   and pre-test, and flags the log session as a demo) and records a 1920×1080
   walkthrough of the three acts.

     npm run build
     node record-demo.mjs                 → recordings/run-<timestamp>/maesai-demo.webm
     RECORD_OUT=my-folder node record-demo.mjs

   Existing videos are never deleted: every run writes to its own folder.
   Shared helpers (cursor, clicks, cut sheet) live in scripts/demo-kit.mjs.
   ══════════════════════════════════════════════════════════════════════════ */

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { CURSOR_JS, wait, makeMarks, glide, point, click, launch, finish } from './scripts/demo-kit.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = pathToFileURL(join(HERE, 'dist', 'index.html')).href + '?demo'
const OUT = resolve(HERE, process.env.RECORD_OUT || join('recordings', `run-${new Date().toISOString().slice(0, 19).replace(/\D/g, '')}`))
const W = 1920, H = 1080
const timer = makeMarks()
const { mark } = timer

async function main() {
  const session = await launch(OUT, { width: W, height: H })
  const { page } = session

  await page.goto(APP, { waitUntil: 'load' })
  await page.waitForSelector('[data-rail="command"]', { timeout: 20000 })
  await page.evaluate(CURSOR_JS)
  await glide(page, W / 2, H / 2, 2)
  await wait(2200)                                     // let the HUD settle on camera

  const tab = (id) => page.locator(`[data-rail="command"] [data-tab="${id}"]`)
  const view = (id) => page.locator(`[data-view="${id}"]`)

  /* ══════════ SEGMENT 1 · ACT I — T−48 Hrs ══════════ */
  mark('SEGMENT 1 · ACT I begins (real AOI-B catchment)')

  // 1 · task a THEOS-2 swath over the narrowed channel (Sector D) on the real map
  await click(page, page.locator('[data-sector="D"]'), { hold: 620, after: 3000 })
  mark('  THEOS-2 swath over Sector D · N measured')
  for (const id of ['C', 'B']) await click(page, page.locator(`[data-sector="${id}"]`), { after: 1600 })
  mark('  mission step 1 complete · 3 swaths tasked')

  // 2 · buy evidence layers
  await click(page, tab('data'), { after: 600 })
  await click(page, page.locator('[data-layer="river"]'), { after: 700 })
  await click(page, page.locator('[data-layer="roads"]'), { after: 700 })
  await click(page, page.locator('[data-layer="pop"]'), { after: 900 })
  mark('  three evidence layers opened')

  // 3 · real town view, then the 3D DEM tilt
  await click(page, view('urban'), { after: 2200 })
  await click(page, page.locator('[data-tilt]'), { after: 2600 })
  await click(page, page.locator('[data-tilt]'), { after: 1200 })
  mark('  AOI-A communities + 3D tilt')

  // 4 · mission step 2: the town embankment on sphere imagery — seal one gap, then the rest
  await click(page, page.locator('[data-quest-go="bank"]'), { after: 4200 })
  await click(page, page.locator('[data-gap="FW-05"]'), { hold: 620, after: 1400 })
  await click(page, page.locator('[data-gap-card] button', { hasText: 'อุดจุดนี้' }), { after: 1200 })
  await click(page, page.locator('[data-embankment-bar] button', { hasText: 'อุดที่เหลือ' }), { after: 2200 })
  mark('  town embankment · 14 flood-wall gaps sealed')

  // 5 · mission step 3: hold once to show the dual comparison, then evacuate
  await click(page, page.locator('[data-quest-go="decide"]'), { after: 900 })
  await click(page, page.locator('[data-panel="decide"] button', { hasText: 'ยังไม่สั่งการ' }), { after: 3200 })
  await click(page, page.locator('[data-modal="hold"] button', { hasText: 'รับทราบ' }), { after: 900 })
  await click(page, page.locator('[data-panel="decide"] button', { hasText: 'ประกาศอพยพ' }), { hold: 620, after: 2600 })
  mark('SEGMENT 1 ends · evacuation ordered → act-1 summary')

  /* ══════════ SEGMENT 2 · ACT II — T+0 Hrs ══════════ */
  mark('SEGMENT 2 · ACT II begins')
  await click(page, page.locator('[data-modal="act1-summary"] button', { hasText: 'เข้าสู่ องก์ 2' }), { hold: 900, after: 2600 })
  await click(page, page.locator('[data-modal="cloud"] button', { hasText: 'Sphere Routing' }), { after: 1600 })
  await click(page, page.locator('[data-route-from="slj"]'), { after: 600 })
  await click(page, page.locator('[data-panel="route"] button', { hasText: 'คำนวณเส้นทาง' }), { after: 3200 })
  mark('  evacuation route computed (Sai Lom Joy → high ground)')

  await click(page, tab('triage'), { after: 800 })
  for (const id of ['slj', 'ksa', 'mlk', 'mdg']) await click(page, page.locator(`[data-triage="${id}"]`), { after: 450 })
  await click(page, page.locator('[data-panel="triage"] button', { hasText: 'ปล่อยขบวน' }), { after: 2800 })
  mark('SEGMENT 2 ends · triage released')

  /* ══════════ SEGMENT 3 · ACT III — AAR ══════════ */
  mark('SEGMENT 3 · ACT III begins')
  await click(page, page.locator('[data-next-act]'), { after: 2600 })

  const handle = page.locator('[data-slider-handle]').first()
  const hb = await handle.boundingBox()
  const cy = hb.y + hb.height / 2
  await glide(page, hb.x + hb.width / 2, cy, 24)
  await wait(700)
  await page.mouse.down()
  await page.mouse.move(hb.x - 380, cy, { steps: 42 }); await wait(850)
  await page.mouse.move(hb.x + 470, cy, { steps: 64 }); await wait(900)
  await page.mouse.move(hb.x + 40, cy, { steps: 34 })
  await page.mouse.up()
  await wait(1400)
  mark('  before / after slider')

  await click(page, page.locator('[data-aar-tab="decisions"]'), { after: 1500 })
  // roof IDs come from the real GISTDA footprints (BD-<FID>), so drive the first rows by position
  for (const [row, v] of [[0, 'both'], [2, 'reject'], [3, 'flat']]) {
    const tr = page.locator('[data-roof]').nth(row)
    const roof = await tr.getAttribute('data-roof')
    await click(page, tr, { after: 900 })
    await click(page, page.locator(`[data-verdict="${roof}-${v}"]`), { after: 1100 })
  }
  mark('  roof-by-roof relief adjudication')
  const relief = page.locator('[data-panel="relief-budget"]')
  await point(page, relief, { hold: 1800 })
  await click(page, page.locator('[data-aar-tab="summary"]'), { after: 2400 })
  mark('SEGMENT 3 ends · mission score')

  await wait(1600)

  await finish(session, OUT, 'maesai-demo.webm', timer)
}

main().catch((e) => { console.error('RECORDING FAILED:', e); process.exit(1) })
