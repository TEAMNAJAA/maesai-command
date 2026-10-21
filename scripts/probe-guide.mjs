/* Chibi guide (Beginner): it points at the control for the next quest step, moves on after the step, and is absent in Expert.
   node scripts/probe-guide.mjs <outDir> [baseUrl]   (needs npm run dev) · exit 2 on an error or a failed check */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
const OUT = process.argv[2] || 'recordings/probe-guide'
const BASE = process.argv[3] || 'http://localhost:5173/'
mkdirSync(OUT, { recursive: true })
const errors = []
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) errors.push(what) }
const browser = await chromium.launch()
for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const p = await browser.newPage({ viewport: { width: w, height: h } })
  p.on('pageerror', (e) => errors.push(`${w}: ${e.message}`))
  await p.goto(`${BASE}?demo&rec&seed=11&mute`)
  await p.waitForSelector('[data-chibi-guide]', { timeout: 20000 })
  const topic = () => p.evaluate(() => document.querySelector('[data-chibi-guide]')?.dataset.chibiGuide || null)
  check(await topic() === 'a1.camp', `${w}: points at the base step first`)
  // the highlight sits on a real control, and the chibi does not cover it
  const ov = await p.evaluate(() => {
    const t = document.querySelector('[data-chibi-guide-target]').getBoundingClientRect(), g = document.querySelector('[data-chibi-guide]').getBoundingClientRect()
    return g.right > t.left + 6 && g.left < t.right - 6 && g.bottom > t.top + 6 && g.top < t.bottom - 6
  })
  check(!ov, `${w}: the chibi does not cover the control`)
  await p.screenshot({ path: join(OUT, `${w}-camp.png`) })
  await p.locator('[data-panel="base"] [data-camp]').first().click()
  await p.waitForFunction(() => !window.__maesai?.busy, null, { timeout: 30000 })
  await p.waitForTimeout(1200)
  check(await topic() === 'a1.task', `${w}: moves on to the THEOS-2 step`)
  await p.locator('[data-chibi-guide-close]').click()
  await p.waitForTimeout(700)
  check(await topic() === null, `${w}: × hides it for this step`)
  await p.goto(`${BASE}?demo&rec&seed=11&mute&mode=expert`)
  await p.waitForSelector('[data-quest], [data-rail="command"]', { timeout: 20000 })
  await p.waitForTimeout(1500)
  check(await topic() === null, `${w}: Expert has no guide`)
  await p.close()
}
await browser.close()
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(2) }
console.log('no errors')
