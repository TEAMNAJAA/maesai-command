/* Knowledge book (D1): a card unlocks when the thing first happens in play (toast), the book shows found and
   locked cards, a found card opens its text. 1920×1080 and 1280×720.
   node scripts/probe-dex.mjs <outDir> [baseUrl]   (needs npm run dev) · exit 2 on an error or a failed check */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
const OUT = process.argv[2] || 'recordings/probe-dex'
const BASE = process.argv[3] || 'http://localhost:5173/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const errors = []
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) errors.push(what) }
const idle = (page) => page.waitForFunction(() => window.__maesai && !window.__maesai.busy, null, { timeout: 60000 })

for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${w}: ${e.message}`))
  await page.goto(`${BASE}?demo&rec&seed=4242&speed=4&mute`)
  await idle(page)
  check(await page.locator('[data-dex]').count() === 1, `${w}: the book button is in the top bar`)
  // choose an embankment plan → the "embankment" card unlocks
  await page.locator('[data-rail="command"] [data-tab="bank"]').click()
  await page.locator('[data-seal-plan="full"]').click(); await page.locator('[data-seal-go]').click()
  await page.waitForSelector('[data-dex-toast]', { timeout: 8000 }).catch(() => {})
  check(await page.locator('[data-dex-toast]').count() === 1, `${w}: a toast says a card was unlocked`)
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, `${w}-toast.png`) })
  await page.locator('[data-dex-toast]').click()
  await page.waitForSelector('[data-dex-book]')
  check(await page.locator('[data-dex-card][data-open="1"]').count() >= 1, `${w}: the book shows the found card`)
  check(await page.locator('[data-dex-card][data-open="0"]').count() >= 10, `${w}: the rest are locked with a hint`)
  await page.locator('[data-dex-card][data-open="1"]').first().click()
  check((await page.locator('[data-dex-detail]').getAttribute('data-dex-detail')) !== '', `${w}: a found card opens its text`)
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, `${w}-book.png`) })
  await ctx.close()
}
await browser.close()
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(2) }
console.log('no errors')
