/* Screenshots of the item-10 UI (consequence cards + ⓘ) in Beginner and Expert.
   node scripts/probe-impact.mjs <outDir> [baseUrl] */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.argv[2] || 'recordings/probe-impact'
const BASE = process.argv[3] || 'http://localhost:5173/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const errors = []

async function run(modeTag) {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => errors.push(`${modeTag}: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${modeTag} console: ${m.text()}`) })
  await page.goto(`${BASE}?demo&seed=4242${modeTag === 'expert' ? '&mode=expert' : ''}`)
  await page.waitForSelector('[data-rail="command"]')
  await page.waitForTimeout(1500)
  const rail = page.locator('[data-rail="command"]')
  const shot = (name, loc = rail) => loc.screenshot({ path: join(OUT, `${modeTag}-${name}.png`) })

  // ① THEOS-2: pick two targets → capture card
  await page.locator('[data-rail="command"] [data-tab="theos"]').click()
  const pass = page.locator('[data-panel="theos"] [data-pass]').first()
  const targets = pass.locator('[data-target]')
  await targets.nth(0).click(); await targets.nth(1).click()
  await page.waitForTimeout(300)
  await shot('theos')
  // ⓘ popover
  await page.locator('[data-why="theos"]').click()
  await page.waitForSelector('[data-why-pop]'); await page.waitForTimeout(500)
  await page.screenshot({ path: join(OUT, `${modeTag}-why.png`), clip: { x: 1100, y: 0, width: 820, height: 700 } })
  await page.keyboard.press('Escape')

  // ② bank: seal card
  await page.locator('[data-rail="command"] [data-tab="bank"]').click()
  await page.waitForTimeout(300)
  await shot('bank')

  // ③ zones: select wet + a dry zone, inline card, then the confirm dialog
  await page.locator('[data-rail="command"] [data-tab="zones"]').click()
  for (const z of ['Z1', 'Z2', 'Z3']) await page.locator(`[data-pick="${z}"]`).click()
  await page.waitForTimeout(300)
  await page.locator('[data-panel="zones-order"] [data-impact]').scrollIntoViewIfNeeded()
  await shot('zones')
  await page.locator('[data-evac-order]').click()
  await page.waitForSelector('[data-modal="confirm"]')
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, `${modeTag}-confirm.png`) })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  const stillOpen = await page.locator('[data-modal="confirm"]').count()
  if (stillOpen) errors.push(`${modeTag}: Esc did not close the confirm dialog`)
  // Space must not run the clock under an open dialog
  const clock0 = await page.locator('[data-timebar] .num').first().textContent()
  await page.locator('[data-evac-order]').click()
  await page.waitForSelector('[data-modal="confirm"]')
  await page.keyboard.press('Space'); await page.waitForTimeout(600)
  const clock1 = await page.locator('[data-timebar] .num').first().textContent()
  if (clock0 !== clock1) errors.push(`${modeTag}: Space advanced the clock under the confirm dialog (${clock0} → ${clock1})`)
  await page.locator('[data-cancel]').click()

  // ④ base: hover a camp → floating card
  await page.locator('[data-rail="command"] [data-tab="base"]').click()
  await page.locator('[data-camp="cmp-pol"]').hover()
  await page.waitForSelector('[data-impact-hover]')
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(OUT, `${modeTag}-camp-hover.png`), clip: { x: 1000, y: 150, width: 920, height: 650 } })
  await page.close()
}

await run('beginner')
await run('expert')
await browser.close()
console.log(errors.length ? `ERRORS\n${errors.join('\n')}` : 'no errors')
process.exit(errors.length ? 2 : 0)
