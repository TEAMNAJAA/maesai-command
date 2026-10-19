/* Screenshots of the "ถ้าคุณเลือกอีกทาง" debrief after a deliberately sloppy run (needs npm run dev).
   node scripts/probe-whatif.mjs <outDir> [baseUrl] */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.argv[2] || 'recordings/probe-whatif'
const BASE = process.argv[3] || 'http://localhost:5173/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
const idle = () => page.waitForFunction(() => window.__maesai && !window.__maesai.busy, null, { timeout: 60000 })
const tab = (id) => page.locator(`[data-rail="command"] [data-tab="${id}"]`).click()

await page.goto(`${BASE}?demo&rec&seed=4242&speed=8`)
await page.waitForSelector('[data-rail="command"]')
// act 1: flooded camp, an early (false-alarm) order, then skip to T−0
await tab('base'); await page.locator('[data-camp="cmp-pol"]').click(); await idle()
await tab('zones')
for (const z of ['Z1', 'Z3']) await page.locator(`[data-pick="${z}"]`).click()
await page.locator('[data-evac-order]').click(); await page.locator('[data-confirm]').click(); await idle()
await page.evaluate(() => window.__maesai.advance({ mode: 'end' })); await idle()
// E: the T0 fight comes first — play it badly on purpose (no measures) and move on
await page.waitForSelector('[data-boss], [data-whatif-panel="1"]', { timeout: 60000 })
for (let i = 0; i < 8 && await page.locator('[data-boss]').count() && !(await page.locator('[data-boss-result]').count()); i++) {
  await page.waitForFunction(() => document.querySelector('[data-boss]')?.dataset.bossBusy === '0', null, { timeout: 30000 })
  if (await page.locator('[data-boss-result]').count()) break
  await page.locator('[data-boss-end]').click()
}
if (await page.locator('[data-boss-continue]').count()) await page.locator('[data-boss-continue]').click()
await page.waitForSelector('[data-whatif-panel="1"]', { timeout: 60000 })
await page.waitForTimeout(600)
await page.locator('[data-modal="act1-summary"]').screenshot({ path: join(OUT, 'act1-summary.png') })
const n1 = await page.locator('[data-whatif-panel="1"] [data-whatif]').count()
if (!n1) errors.push('act 1 debrief shows no cards after a sloppy act')
await page.locator('[data-whatif-panel="1"] [data-whatif-more]').click().catch(() => {})
await page.waitForTimeout(300)
await page.locator('[data-whatif-panel="1"]').screenshot({ path: join(OUT, 'act1-whatif-all.png') })
await page.locator('[data-act1-next]').click()
await page.waitForTimeout(800)

// act 2: just run the clock — nobody gets a boat
for (let i = 0; i < 4; i++) { await page.evaluate(() => window.__maesai.advance({ mode: 'next' })); await idle() }
await page.evaluate(() => window.__maesai.advance({ mode: 'end' })); await idle()
await page.waitForSelector('[data-whatif-panel="2"]', { timeout: 60000 })
await page.waitForTimeout(600)
await page.locator('[data-modal="act2-summary"]').screenshot({ path: join(OUT, 'act2-summary.png') })
if (!(await page.locator('[data-whatif-panel="2"] [data-whatif]').count())) errors.push('act 2 debrief shows no cards when nobody was helped')
await page.locator('[data-act2-next]').click()
await page.waitForTimeout(1200)

// act 3: approve the flat grant for every roof
const roofs = await page.locator('[data-roof]').all()
for (const r of roofs) {
  await r.click(); await page.waitForTimeout(150)
  const id = await r.getAttribute('data-roof')
  await page.locator(`[data-verdict="${id}-flat"]`).click()
}
await page.screenshot({ path: join(OUT, 'act3-drafts.png') })
await page.locator('[data-lock-all]').click()
await page.waitForSelector('[data-modal="confirm"]'); await page.waitForTimeout(300)
await page.screenshot({ path: join(OUT, 'act3-lock-confirm.png') })
await page.locator('[data-confirm]').click()
await page.waitForTimeout(1500)
await page.screenshot({ path: join(OUT, 'act3-reveal-mid.png') })
await page.waitForSelector('[data-reveal-done]', { timeout: 30000 }); await page.waitForTimeout(400)
await page.screenshot({ path: join(OUT, 'act3-reveal-done.png') })
await page.locator('[data-reveal-done]').click()
await page.locator('[data-aar-tab="summary"], button:has-text("สรุป · Leaderboard")').first().click()
await page.waitForSelector('[data-whatif-tabs]')
await page.waitForTimeout(600)
await page.locator('[data-whatif-tabs]').screenshot({ path: join(OUT, 'aar-act3.png') })
await page.locator('[data-whatif-act="2"]').click(); await page.waitForTimeout(300)
await page.locator('[data-whatif-tabs]').screenshot({ path: join(OUT, 'aar-act2.png') })

await browser.close()
console.log(errors.length ? `ERRORS\n${errors.join('\n')}` : 'no errors')
process.exit(errors.length ? 2 : 0)
