/* Performance mode (D5): manual switch, ?perf=lite, prefers-reduced-motion, and the automatic switch on a slow machine
   (the page is loaded with a busy main thread until the frame rate drops). Screenshots at 1920×1080 and 1280×720.
   node scripts/probe-perf.mjs <outDir> [baseUrl]      (needs npm run dev) · exit 2 on an error or a failed check */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
const OUT = process.argv[2] || 'recordings/probe-perf'
const BASE = process.argv[3] || 'http://localhost:5173/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const errors = []
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) errors.push(what) }
const state = (page) => page.evaluate(() => ({ cls: document.documentElement.classList.contains('perf-lite'), perf: document.documentElement.dataset.perf, weather: !!document.querySelector('[data-weather]'), notice: !!document.querySelector('[data-perf-notice]') }))

for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', (e) => errors.push(`${w}: ${e.message}`))
  // 1) default: full picture, weather on the map
  await page.goto(`${BASE}?demo&seed=4242&mute`)
  await page.waitForSelector('[data-weather]')
  let s = await state(page)
  check(!s.cls && s.perf === 'full' && s.weather, `${w}: starts with the full picture`)
  // 2) the settings menu turns it on and off
  await page.locator('[data-settings]').click()
  await page.locator('[data-pref-perf="on"]').click()
  s = await state(page)
  check(s.cls && s.perf === 'lite-manual' && !s.weather, `${w}: settings → ประหยัด drops rain/lightning`)
  await page.screenshot({ path: join(OUT, `${w}-lite-menu.png`) })
  await page.locator('[data-pref-perf="auto"]').click()
  s = await state(page)
  check(!s.cls && s.weather, `${w}: back to อัตโนมัติ restores the effects`)
  await page.close()
}

// 3) URL and OS preference
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (e) => errors.push(`url: ${e.message}`))
  await page.goto(`${BASE}?demo&seed=4242&mute&perf=lite`)
  await page.waitForSelector('[data-map-view]')
  check((await state(page)).perf === 'lite-manual', '?perf=lite')
  await page.close()
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' })
  const p2 = await ctx.newPage()
  await p2.goto(`${BASE}?demo&seed=4242&mute`)
  await p2.waitForSelector('[data-map-view]')
  check((await state(p2)).perf === 'lite-reduced-motion', 'prefers-reduced-motion → lite')
  await ctx.close()
}

// 4) a slow machine: keep the main thread busy until frames drop under 30 fps → lite switches on by itself, with a notice
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.on('pageerror', (e) => errors.push(`auto: ${e.message}`))
  await page.goto(`${BASE}?demo&seed=4242&mute`)
  await page.waitForSelector('[data-weather]')
  await page.evaluate(() => { window.__burn = setInterval(() => { const t = performance.now(); while (performance.now() - t < 60) { /* busy */ } }, 5) })
  await page.waitForFunction(() => document.documentElement.dataset.perf === 'lite-fps', null, { timeout: 40000 }).catch(() => {})
  await page.evaluate(() => clearInterval(window.__burn))
  const s = await state(page)
  check(s.perf === 'lite-fps' && !s.weather, 'slow frames → lite switches on by itself')
  check(s.notice, 'a notice says it switched and where to change it')
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(OUT, '1920-auto-lite.png') })
  await page.close()
}

await browser.close()
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(2) }
console.log('no errors')
