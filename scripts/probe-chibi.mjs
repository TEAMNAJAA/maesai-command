/* Chibi screenshots: title screen, creator, the dock in acts 1–3 and cut scenes, at 1920×1080 and 1280×720 (needs npm run dev).
   node scripts/probe-chibi.mjs <outDir> [baseUrl]
   Checks that the dock never covers a button or a data panel. */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
const OUT = process.argv[2] || 'recordings/probe-chibi'
const BASE = process.argv[3] || 'http://localhost:5173/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const errors = []
const idle = (page) => page.waitForFunction(() => window.__maesai && !window.__maesai.busy, null, { timeout: 60000 })
/** The dock's box must not intersect any visible button / panel other than its own column. */
const overlap = (page) => page.evaluate(() => {
  const dock = document.querySelector('[data-chibi-dock]')
  if (!dock) return 'no dock'
  const d = dock.getBoundingClientRect()
  const hits = []
  for (const el of document.querySelectorAll('button, [data-panel], [data-timebar], [data-tutor], [data-rail]')) {
    if (dock.contains(el) || el.contains(dock)) continue
    // what is actually visible: clip by every scrolling / clipping ancestor
    let r = el.getBoundingClientRect()
    r = { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a)
      if (cs.overflowY !== 'visible' || cs.overflowX !== 'visible') {
        const c = a.getBoundingClientRect()
        r = { left: Math.max(r.left, c.left), right: Math.min(r.right, c.right), top: Math.max(r.top, c.top), bottom: Math.min(r.bottom, c.bottom) }
      }
    }
    if (r.right - r.left < 2 || r.bottom - r.top < 2) continue
    if (r.left < d.right - 1 && r.right > d.left + 1 && r.top < d.bottom - 1 && r.bottom > d.top + 1) hits.push(el.getAttribute('data-panel') || el.getAttribute('data-rail') || el.textContent.trim().slice(0, 20))
  }
  return hits.join(' | ')
})
for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', (e) => errors.push(`${w}: ${e.message}`))
  await page.goto(`${BASE}?rec&seed=4242&speed=6`)
  await page.waitForSelector('[data-chibi-edit]')
  await page.screenshot({ path: join(OUT, `${w}-title.png`) })
  await page.locator('[data-chibi-edit]').click(); await page.waitForSelector('[data-chibi-creator]')
  await page.locator('[data-hair="pony"]').click(); await page.locator('[data-outfit="rescue"]').click(); await page.locator('[data-hair-color="2"]').click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, `${w}-creator.png`) })
  await page.locator('[data-chibi-done]').click()
  await page.locator('[data-player]').fill('ม.6/2-05')
  await page.locator('[data-start]').click(); await page.locator('button', { hasText: 'ข้ามแบบทดสอบ' }).click()
  await page.waitForSelector('[data-chibi-dock]')
  let o = await overlap(page); if (o) errors.push(`${w} act 1 dock overlaps: ${o}`)
  await page.screenshot({ path: join(OUT, `${w}-act1.png`) })
  // an order → the chibi poses
  await page.locator('[data-rail="command"] [data-tab="base"]').click(); await page.locator('[data-camp="cmp-amp"]').click()
  await page.waitForTimeout(250)
  const pose = await page.locator('[data-chibi-dock]').getAttribute('data-chibi-dock'); if (pose === 'idle') errors.push(`${w}: no pose after an order`)
  await idle(page)
  // the THEOS-2 cut scene has the chibi in it
  await page.locator('[data-rail="command"] [data-tab="theos"]').click()
  await page.locator('[data-panel="theos"] [data-pass]').first().locator('[data-target]').first().click()
  await page.locator('[data-capture]').click()
  await page.waitForSelector('[data-scene-chibi]', { timeout: 4000 }).catch(() => {})
  await page.waitForTimeout(250)
  if (!(await page.locator('[data-scene-chibi]').count())) errors.push(`${w}: no chibi in the THEOS-2 cut scene`)
  await page.screenshot({ path: join(OUT, `${w}-cut.png`) })
  await idle(page)
  await page.evaluate(() => window.__maesai.advance({ mode: 'end' })); await idle(page)
  await page.locator('[data-act1-next]').click(); await page.waitForTimeout(600)
  o = await overlap(page); if (o) errors.push(`${w} act 2 dock overlaps: ${o}`)
  await page.screenshot({ path: join(OUT, `${w}-act2.png`) })
  await page.evaluate(() => window.__maesai.advance({ mode: 'end' })); await idle(page)
  await page.locator('[data-act2-next]').click(); await page.waitForTimeout(900)
  o = await overlap(page); if (o) errors.push(`${w} act 3 dock overlaps: ${o}`)
  await page.screenshot({ path: join(OUT, `${w}-act3.png`) })
  await page.close()
}
await browser.close()
console.log(errors.length ? `ERRORS\n${errors.join('\n')}` : 'no errors')
process.exit(errors.length ? 2 : 0)
