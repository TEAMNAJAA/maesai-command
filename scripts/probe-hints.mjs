/* Screenshots of the hint ladder through the three acts (needs npm run dev).
   node scripts/probe-hints.mjs <outDir> [baseUrl] */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.argv[2] || 'recordings/probe-hints'
const BASE = process.argv[3] || 'http://localhost:5173/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
const shot = (name, clip) => page.screenshot({ path: join(OUT, `${name}.png`), ...(clip ? { clip } : {}) })
const idle = () => page.waitForFunction(() => window.__maesai && !window.__maesai.busy, null, { timeout: 60000 })
const tab = (id) => page.locator(`[data-rail="command"] [data-tab="${id}"]`).click()
const st = () => page.evaluate(() => window.__maesai.s)
const expectEq = (a, b, what) => { if (a !== b) errors.push(`${what}: expected ${b}, got ${a}`) }

// ── how-to page section
await page.goto(`${BASE}?seed=4242`)
await page.locator('[data-howto]').click()
await page.locator('[data-howto-hints]').scrollIntoViewIfNeeded()
await page.waitForTimeout(400)
await page.locator('[data-howto-hints]').screenshot({ path: join(OUT, 'howto-hints.png') })

// ── act 1: tutor bar → ladder → pointer (spotlight) → partial answer
await page.goto(`${BASE}?demo&rec&seed=4242&speed=8`)
await page.waitForSelector('[data-tutor]')
await page.waitForTimeout(800)
await shot('a1-tutor-q', { x: 0, y: 960, width: 1920, height: 120 })
await page.locator('[data-hint-toggle]').click()
await page.waitForSelector('[data-hint-popover]'); await page.waitForTimeout(300)
await shot('a1-ladder-closed', { x: 1000, y: 560, width: 920, height: 520 })
await page.locator('[data-hint-popover] [data-hint-open-rung="2"]').click()
await page.waitForTimeout(700)
expectEq((await st()).hints['a1.camp'], 2, 'camp rung after opening 2')
const spots = await page.locator('[data-hint-spot]').count()
if (!spots) errors.push('rung 2 did not spotlight anything (a1.camp)')
await shot('a1-ladder-pointer')
await page.locator('[data-hint-popover] [data-hint-open-rung="3"]').click()
await page.waitForTimeout(500)
await shot('a1-ladder-partial', { x: 1000, y: 480, width: 920, height: 600 })

// set the camp, then the next topic is THEOS-2 tasking
await page.locator('[data-hint-toggle]').click()
await tab('base'); await page.locator('[data-camp="cmp-amp"]').click(); await idle()
await page.waitForTimeout(400)
const topic2 = await page.locator('[data-tutor]').getAttribute('data-tutor-topic')
expectEq(topic2, 'a1.task', 'topic after camp')
await shot('a1-tutor-task', { x: 0, y: 960, width: 1920, height: 120 })

// capture the first pass → image analysis with its ladder
await tab('theos')
const pass = page.locator('[data-panel="theos"] [data-pass]').first()
const river = pass.locator('[data-target$="-D"], [data-target$="-E"], [data-target$="-TOWN"]').first()
if (await river.count()) await river.click()
await pass.locator('[data-target]:not([data-target$="-D"]):not([data-target$="-E"]):not([data-target$="-TOWN"])').first().click()
await page.locator('[data-capture]').click(); await page.waitForTimeout(500); await idle()
await page.waitForTimeout(600)
const analyze = page.locator('[data-image] button', { hasText: 'แปลภาพ' }).first()
if (await analyze.count()) {
  await analyze.click(); await page.waitForSelector('[data-modal="analysis"]')
  await page.waitForTimeout(500)
  await shot('a1-analysis-ladder')
  await page.locator('[data-modal="analysis"] [data-hint-open-rung="2"]').click(); await page.waitForTimeout(300)
  await page.locator('[data-modal="analysis"] [data-hint-open-rung="3"]').click(); await page.waitForTimeout(400)
  await page.locator('[data-modal="analysis"] [data-hint-ladder]').screenshot({ path: join(OUT, 'a1-analysis-ladder-open.png') })
  await page.locator('[data-modal="analysis"] button', { hasText: 'ไว้ทีหลัง' }).click()
} else errors.push('no image to analyse after the first pass')

// channel tool: rung 2 draws the water edges
const meas = page.locator('[data-panel="bank"] button', { hasText: 'เปิดเครื่องมือวัด' })
await tab('bank')
if (await meas.isEnabled().catch(() => false)) {
  await meas.click(); await page.waitForSelector('[data-modal="channel"]')
  await page.locator('[data-modal="channel"] [data-hint-open-rung="2"]').click(); await page.waitForTimeout(500)
  if (!(await page.locator('[data-river-guide]').count())) errors.push('channel rung 2 did not draw the water edges')
  await shot('a1-channel-guides')
  await page.locator('[data-modal="channel"] button', { hasText: 'ปิด' }).last().click()
}

// ── act 2: planner ladder stops at rung 2; hazard marks appear only after asking
await page.evaluate(() => window.__maesai.advance({ mode: 'end' })); await idle()
await page.waitForSelector('[data-act1-next]', { timeout: 60000 }); await page.locator('[data-act1-next]').click()
await page.waitForTimeout(800)
for (let i = 0; i < 10; i++) {
  const n = await page.evaluate(() => window.__maesai.s.points.filter((p) => p.revealed && p.status === 'waiting').length)
  if (n >= 2) break
  await page.evaluate(() => window.__maesai.advance({ mode: 'next' })); await idle()
}
await page.waitForTimeout(400)
await shot('a2-tutor', { x: 0, y: 960, width: 1920, height: 120 })
await tab('ops')
const plan = page.locator('[data-point] button:not([disabled])', { hasText: 'วางแผนเรือ' }).first()
if (await plan.count()) {
  await plan.click(); await page.waitForSelector('[data-modal="planner"]')
  await page.locator('[data-route-opt]').first().hover(); await page.waitForTimeout(300)
  const before = await page.locator('[data-planner-map] [data-hazard-mark]').count()
  await page.locator('[data-modal="planner"] [data-hint-open-rung="2"]').click(); await page.waitForTimeout(300)
  await page.locator('[data-route-opt]').first().hover(); await page.waitForTimeout(400)
  if (await page.locator('[data-modal="planner"] [data-hint-open-rung="3"]').count()) errors.push('act 2 offered rung 3')
  if (!(await page.locator('[data-modal="planner"] [data-hint-rung="3"][data-state="faded"]').count())) errors.push('act 2 rung 3 not shown as faded')
  await shot('a2-planner-ladder')
  console.log(`hazard marks before/after asking: ${before} → ${await page.locator('[data-planner-map] [data-hazard-mark]').count()}`)
  await page.locator('[data-modal="planner"] button', { hasText: 'ยกเลิก' }).click()
}

// ── act 3: the question only
await page.evaluate(() => window.__maesai.advance({ mode: 'end' })); await idle()
await page.waitForSelector('[data-modal="act2-summary"]', { timeout: 60000 }).catch(() => {})
const next3 = page.locator('[data-modal="act2-summary"] button').last()
if (await next3.count()) await next3.click()
await page.waitForTimeout(1200)
const relief = page.locator('[data-hint-ladder="a3.relief"]')
if (await relief.count()) {
  await relief.scrollIntoViewIfNeeded(); await relief.screenshot({ path: join(OUT, 'a3-relief-ladder.png') })
  if (await relief.locator('[data-hint-open-rung]').count()) errors.push('act 3 offered a rung beyond the question')
} else errors.push('no act 3 ladder')
const pen = page.locator('[data-hint-penalty]')
if (await pen.count()) await pen.screenshot({ path: join(OUT, 'a3-penalty.png') })
console.log('hints state', JSON.stringify((await st()).hints))

await browser.close()
console.log(errors.length ? `ERRORS\n${errors.join('\n')}` : 'no errors')
process.exit(errors.length ? 2 : 0)
