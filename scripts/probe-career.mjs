/* Career (A1–A4): the title screen shows the rank, locks Expert / Stress Test until the rank opens them,
   the teacher switch opens everything, and the commander file shows medals and runs. 1920×1080 and 1280×720.
   node scripts/probe-career.mjs <outDir> [baseUrl]   (needs npm run dev) · exit 2 on an error or a failed check */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
const OUT = process.argv[2] || 'recordings/probe-career'
const BASE = process.argv[3] || 'http://localhost:5173/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const errors = []
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) errors.push(what) }
const attr = (page, sel, a) => page.locator(sel).first().getAttribute(a)

for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } })     // fresh storage: a new commander
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${w}: ${e.message}`))
  await page.goto(`${BASE}?seed=4242&mute`)
  await page.waitForSelector('[data-player]')
  await page.locator('[data-player]').fill('ผบ.ทดสอบ')
  check(await attr(page, '[data-title-rank]', 'data-title-rank') === 'volunteer', `${w}: a new name starts as อาสาสมัคร`)
  check(await attr(page, '[data-mode-pick="expert"]', 'data-locked') === '1', `${w}: Expert is locked`)
  check(await attr(page, '[data-stress="data"]', 'data-locked') === '1', `${w}: Stress Test conditions are locked`)
  await page.screenshot({ path: join(OUT, `${w}-title-new.png`) })
  // the teacher opens everything
  await page.locator('[data-unlock-all]').click()
  check(await attr(page, '[data-mode-pick="expert"]', 'data-locked') === '0' && await attr(page, '[data-stress="time"]', 'data-locked') === '0', `${w}: teacher unlock opens Expert and every condition`)
  await page.locator('[data-unlock-all]').click()
  // a commander with history: 2,000 points → หัวหน้าชุด, Expert and the first condition open
  await page.evaluate(() => {
    const runs = [{ points: 1200, medals: ['trust', 'wall'], grades: 'ABA', sec: 540, mode: 'beginner', at: '2026-10-18T09:00:00Z' },
      { points: 800, medals: ['swift'], grades: 'BBA', sec: 400, mode: 'beginner', at: '2026-10-19T09:00:00Z' }]
    localStorage.setItem('maesai-command.career.v1', JSON.stringify({ 'ผบ.ทดสอบ': { name: 'ผบ.ทดสอบ', runs } }))
  })
  await page.reload()
  await page.waitForSelector('[data-player]')
  await page.locator('[data-player]').fill('ผบ.ทดสอบ ')
  await page.waitForTimeout(200)
  check(await attr(page, '[data-title-rank]', 'data-title-rank') === 'lead', `${w}: 2,000 points → หัวหน้าชุด`)
  check(await attr(page, '[data-mode-pick="expert"]', 'data-locked') === '0' && await attr(page, '[data-stress="data"]', 'data-locked') === '0' && await attr(page, '[data-stress="roads"]', 'data-locked') === '1', `${w}: the rank opens Expert + data loss, not yet roads`)
  await page.screenshot({ path: join(OUT, `${w}-title-lead.png`) })
  await page.locator('[data-career]').click()
  await page.waitForSelector('[data-career-file]')
  await page.waitForTimeout(500)
  check(await page.locator('[data-medal][data-earned="1"]').count() === 3, `${w}: the file shows the 3 medals earned`)
  check(await page.locator('[data-career-runs] tbody tr').count() === 2, `${w}: and both runs`)
  await page.screenshot({ path: join(OUT, `${w}-file.png`) })
  await ctx.close()
}
await browser.close()
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(2) }
console.log('no errors')
