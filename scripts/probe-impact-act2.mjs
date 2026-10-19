/* Act 2 / act 3 screenshots of the consequence cards (needs npm run dev).
   node scripts/probe-impact-act2.mjs <outDir> [baseUrl] [mode] */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.argv[2] || 'recordings/probe-impact'
const BASE = process.argv[3] || 'http://localhost:5173/'
const MODE = process.argv[4] || 'beginner'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
await page.goto(`${BASE}?demo&rec&seed=4242&speed=8${MODE === 'expert' ? '&mode=expert' : ''}`)
await page.waitForSelector('[data-rail="command"]')
const idle = () => page.waitForFunction(() => window.__maesai && !window.__maesai.busy, null, { timeout: 60000 })
const rail = page.locator('[data-rail="command"]')
const tab = (id) => page.locator(`[data-rail="command"] [data-tab="${id}"]`).click()
const pre = MODE === 'expert' ? 'x-' : ''

// act 1 → act 2 straight away (camp at the district office)
await tab('base'); await page.locator('[data-camp="cmp-amp"]').click(); await idle()
await page.evaluate(() => window.__maesai.advance({ mode: 'end' })); await idle()
await page.waitForSelector('[data-act1-next]', { timeout: 60000 }); await page.locator('[data-act1-next]').click()
await page.waitForTimeout(800)
// run until people are known and the storm/power events have come
for (let i = 0; i < 12; i++) {
  const st = await page.evaluate(() => { const { s } = window.__maesai; return { pts: s.points.filter((p) => p.revealed && p.status === 'waiting').length, haz: s.hazardsLive.length, storm: s.stormHit, clock: s.clock } })
  if (st.pts >= 2 && st.haz && st.storm) break
  await page.evaluate(() => window.__maesai.advance({ mode: 'next' })); await idle(); await page.waitForTimeout(200)
}
await tab('sensors'); await page.waitForTimeout(300)
await rail.screenshot({ path: join(OUT, `${pre}act2-sensors.png`) })
const shoot = page.locator('[data-pass2] button', { hasText: 'สั่งถ่าย' }).first()
if (await shoot.count()) { await shoot.hover(); await page.waitForSelector('[data-impact-hover]'); await page.waitForTimeout(300); await page.screenshot({ path: join(OUT, `${pre}act2-pass2-hover.png`), clip: { x: 1000, y: 100, width: 920, height: 700 } }) }
await tab('field'); await page.waitForTimeout(300)
await rail.screenshot({ path: join(OUT, `${pre}act2-field.png`) })
const cut = page.locator('[data-power] button').first()
if (await cut.count()) { await cut.hover(); await page.waitForSelector('[data-impact-hover]'); await page.waitForTimeout(300); await page.screenshot({ path: join(OUT, `${pre}act2-power-hover.png`), clip: { x: 1000, y: 100, width: 920, height: 700 } }) }
// boat planner: pick the first route, hover "ส่งเรือออก"
await tab('ops'); await page.waitForTimeout(300)
const plan = page.locator('[data-point] button:not([disabled])', { hasText: 'วางแผนเรือ' }).first()
if (await plan.count()) {
  await plan.click()
  await page.waitForSelector('[data-modal="planner"]')
  await page.waitForFunction(() => !document.querySelector('[data-sphere-status="loading"]'), null, { timeout: 20000 }).catch(() => {})
  await page.locator('[data-route-opt]').first().click()
  await page.locator('[data-dispatch]').hover()
  await page.waitForSelector('[data-impact-hover]'); await page.waitForTimeout(300)
  await page.screenshot({ path: join(OUT, `${pre}act2-boat-hover.png`) })
  await page.locator('[data-modal="planner"] button', { hasText: 'ยกเลิก' }).click()
}
// skip to the recession → confirm dialog (only offered when settled; force it through the hook otherwise)
const end = page.locator('[data-advance="end"]')
if (await end.count()) { await end.click(); await page.waitForSelector('[data-modal="confirm"]'); await page.waitForTimeout(400); await page.screenshot({ path: join(OUT, `${pre}act2-skip-confirm.png`) }); await page.locator('[data-cancel]').click() }
await browser.close()
console.log(errors.length ? `ERRORS\n${errors.join('\n')}` : 'no errors')
process.exit(errors.length ? 2 : 0)
