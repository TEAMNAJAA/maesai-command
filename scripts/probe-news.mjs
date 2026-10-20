/* News feed (D2): a decision makes the news (a false alarm → a bad headline + a social post), the card sits in
   the map corner without covering a control, and the history list opens. 1920×1080 and 1280×720, both map views.
   node scripts/probe-news.mjs <outDir> [baseUrl]   (needs npm run dev) · exit 2 on an error or a failed check */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
const OUT = process.argv[2] || 'recordings/probe-news'
const BASE = process.argv[3] || 'http://localhost:5173/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const errors = []
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) errors.push(what) }
const idle = (page) => page.waitForFunction(() => window.__maesai && !window.__maesai.busy, null, { timeout: 60000 })
/** The feed box must not intersect any visible button or bar on the map other than its own. */
const overlap = (page) => page.evaluate(() => {
  const f = document.querySelector('[data-news-feed]')
  if (!f) return 'no feed'
  const r = f.getBoundingClientRect()
  const hits = []
  for (const el of document.querySelectorAll('[data-map-view] button, [data-embankment-bar], [data-legend], [data-pass-banner]')) {
    if (f.contains(el)) continue
    const b = el.getBoundingClientRect()
    if (b.width < 2 || b.height < 2) continue
    if (b.left < r.right - 1 && b.right > r.left + 1 && b.top < r.bottom - 1 && b.bottom > r.top + 1) hits.push(el.textContent.trim().slice(0, 24) || el.tagName)
  }
  return hits.join(' | ')
})

for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', (e) => errors.push(`${w}: ${e.message}`))
  await page.goto(`${BASE}?demo&rec&seed=4242&speed=4&mute`)
  await idle(page)
  // order the zone with the lowest SFVI at T−48 — no evidence yet, so a false alarm
  const zone = "Z1"
  await page.locator('[data-rail="command"] [data-tab="zones"]').click()
  await page.locator(`[data-pick="${zone}"]`).first().click()
  const order = page.locator('[data-evac-order]')
  if (await order.count() && await order.isEnabled()) {
    await order.click()
    if (await page.locator('[data-confirm]').count()) await page.locator('[data-confirm]').click()
  }
  await page.waitForSelector('[data-news-card]', { timeout: 8000 }).catch(() => {})
  check(await page.locator('[data-news-card]').count() === 1, `${w}: the order makes the news`)
  await page.waitForTimeout(450)
  let o = await overlap(page); check(!o, `${w}: the news card covers no map control${o ? ` (${o})` : ''}`)
  await page.screenshot({ path: join(OUT, `${w}-card.png`) })
  // corridor view: the embankment bar sits at the bottom too
  await page.locator('[data-view="corridor"]').click()
  await page.waitForTimeout(500)
  o = await overlap(page); check(!o, `${w}: corridor view — no overlap${o ? ` (${o})` : ''}`)
  await page.locator('[data-view="urban"]').click()
  // history
  const btn = page.locator('[data-news-card], [data-news-open]').first()
  await btn.click()
  await page.waitForSelector('[data-news-list]')
  const items = await page.locator('[data-news-list] [data-news-item]').count()
  check(items >= 1, `${w}: the history lists ${items} item(s)`)
  await page.screenshot({ path: join(OUT, `${w}-list.png`) })
  await page.close()
}
await browser.close()
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(2) }
console.log('no errors')
