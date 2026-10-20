/* Act 3 imagery (B11): the control-room scene on the first roof, then every roof's before/after at the
   "after" end of the slider — muddy houses must show thick mud, clean houses a clean yard.
   node scripts/probe-relief.mjs <outDir> [baseUrl]   (needs npm run dev) · exit 2 on an error or a failed check */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
const OUT = process.argv[2] || 'recordings/probe-relief'
const BASE = process.argv[3] || 'http://localhost:5173/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const errors = []
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) errors.push(what) }
const idle = (page) => page.waitForFunction(() => window.__maesai && !window.__maesai.busy, null, { timeout: 60000 })

const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
page.on('pageerror', (e) => errors.push(e.message))
await page.goto(`${BASE}?demo&rec&seed=4242&speed=0.6`)
// act 1 → T0 → (boss) → act 2 → act 3, as fast as the API allows
for (let i = 0; i < 40 && !(await page.evaluate(() => window.__maesai.s.act === 3)); i++) {
  await idle(page)
  if (await page.locator('[data-modal="veto"]').count()) { await page.locator('[data-modal="veto"] button', { hasText: 'รับทราบ' }).click(); continue }
  if (await page.locator('[data-boss]').count()) {
    if (await page.locator('[data-boss-continue]').count()) { await page.locator('[data-boss-continue]').click(); continue }
    await page.waitForFunction(() => document.querySelector('[data-boss]')?.dataset.bossBusy === '0', null, { timeout: 30000 }).catch(() => {})
    if (!(await page.locator('[data-boss-result]').count())) await page.locator('[data-boss-end]').click()
    continue
  }
  if (await page.locator('[data-act1-next]').count()) { await page.locator('[data-act1-next]').click(); continue }
  if (await page.locator('[data-act2-next]').count()) { await page.locator('[data-act2-next]').click(); continue }
  await page.evaluate(() => window.__maesai.advance({ mode: 'end' }))
  await page.waitForTimeout(500)
}
// act 3 opens on the first roof — in the control room
await page.waitForSelector('[data-action-scene="control"]', { timeout: 8000 }).catch(() => {})
check(await page.locator('[data-action-scene="control"]').count() === 1, 'the first roof opens in the control room')
await page.waitForTimeout(1700)
await page.screenshot({ path: join(OUT, 'control-room.png') })
await page.locator('[data-action-scene="control"]').click().catch(() => {})
await page.waitForTimeout(400)
check(await page.locator('[data-action-scene]').count() === 0, 'a click skips it')
await page.waitForSelector('[data-roof]')
const roofs = await page.evaluate(() => window.__maesai.scn.roofs.map((r) => ({ id: r.id, mud: r.mud, cloud: r.theosCloud })))
// every roof, slider at the "after" end
for (const r of roofs) {
  await page.locator(`[data-roof="${r.id}"]`).click()
  await page.waitForTimeout(300)
  const box = await page.locator(`[data-roof-compare="${r.id}"]`).boundingBox()
  if (box) { await page.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + 2, box.y + box.height / 2, { steps: 6 }); await page.mouse.up() }
  await page.waitForTimeout(250)
  const has = await page.locator(`[data-roof-compare="${r.id}"] [data-mud-detail]`).count()
  if (!r.cloud) check(r.mud ? has > 0 : has === 0, `${r.id}: ${r.mud ? 'mud is drawn' : 'clean yard, no mud drawn'}`)
  await page.locator(`[data-roof-compare="${r.id}"]`).screenshot({ path: join(OUT, `${r.id}-${r.mud ? 'mud' : 'clean'}${r.cloud ? '-cloud' : ''}.png`) })
}
await browser.close()
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(2) }
console.log('no errors')
