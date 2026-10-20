/* The T0 crisis night (E + D4): screenshots of the fight at 1920×1080 and 1280×720, a prepared and an unprepared
   commander, Expert (next move hidden). node scripts/probe-boss.mjs <outDir> [baseUrl]   (needs npm run dev)
   exit 2 on a page error or a failed check. */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
const OUT = process.argv[2] || 'recordings/probe-boss'
const BASE = process.argv[3] || 'http://localhost:5173/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const errors = []
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) errors.push(what) }
const idle = (page) => page.waitForFunction(() => window.__maesai && !window.__maesai.busy, null, { timeout: 60000 })
const ready = (page) => page.waitForFunction(() => document.querySelector('[data-boss]')?.dataset.bossBusy === '0', null, { timeout: 30000 })

/** Reach T0 — `prepared` seals the whole embankment and orders the wet zones first. */
async function toT0(page, prepared) {
  await idle(page)
  if (prepared) {
    await page.locator('[data-rail="command"] [data-tab="base"]').click(); await page.locator('[data-camp="cmp-amp"]').click()
    await page.locator('[data-rail="command"] [data-tab="bank"]').click()
    await page.locator('[data-seal-plan="full"]').click(); await page.locator('[data-seal-go]').click()
  }
  for (let i = 0; i < 30 && !(await page.locator('[data-boss]').count()); i++) {
    await idle(page)
    if (await page.locator('[data-modal="veto"]').count()) { await page.locator('[data-modal="veto"] button', { hasText: 'รับทราบ' }).click(); continue }
    await page.evaluate(() => window.__maesai.advance({ mode: 'end' }))
    await page.waitForTimeout(400)
  }
  await page.waitForSelector('[data-boss]', { timeout: 30000 })
}

for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', (e) => errors.push(`${w}: ${e.message}`))
  await page.goto(`${BASE}?demo&rec&seed=4242&speed=4`)
  await toT0(page, true)
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(OUT, `${w}-intro.png`) })
  await ready(page)
  check(await page.locator('[data-boss-card]').count() === 7, `${w}: seven measure cards`)
  const intent = await page.locator('[data-boss-intent]').getAttribute('data-boss-intent')
  console.log(`  ${w} intent: ${intent}`)
  // pick the best play and show the hand before ending the turn
  const picks = await page.evaluate(() => window.__maesai.bossBest())
  for (const id of picks) await page.locator(`[data-boss-card="${id}"]`).click()
  await page.waitForTimeout(250)
  await page.screenshot({ path: join(OUT, `${w}-pick.png`) })
  // the whole card row is on screen and nothing overflows the viewport
  const fits = await page.evaluate(() => [...document.querySelectorAll('[data-boss-card], [data-boss-end]')].every((e) => { const r = e.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1 && r.top >= 0 }))
  check(fits, `${w}: cards and the end-turn button fit the screen`)
  await page.locator('[data-boss-end]').click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: join(OUT, `${w}-resolve.png`) })
  for (let i = 0; i < 8 && !(await page.locator('[data-boss-result]').count()); i++) {
    await ready(page)
    if (await page.locator('[data-boss-result]').count()) break
    for (const id of await page.evaluate(() => window.__maesai.bossBest())) await page.locator(`[data-boss-card="${id}"]`).click()
    await page.locator('[data-boss-end]').click()
  }
  await page.waitForSelector('[data-boss-result]')
  await page.waitForTimeout(400)
  await page.screenshot({ path: join(OUT, `${w}-result.png`) })
  check(await page.locator('[data-boss-result]').getAttribute('data-boss-result') === 'won', `${w}: a prepared commander holds the embankment`)
  await page.locator('[data-boss-continue]').click()
  await page.waitForSelector('[data-modal="act1-summary"]')
  check(await page.locator('[data-embankment-summary="held"]').count() === 1, `${w}: the act-1 summary reports the embankment`)
  await page.locator('[data-modal="act1-summary"]').screenshot({ path: join(OUT, `${w}-summary.png`) })
  await page.close()
}

// unprepared, Expert: next move hidden, no measures → the embankment breaks, the game goes on
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.on('pageerror', (e) => errors.push(`expert: ${e.message}`))
  await page.goto(`${BASE}?demo&rec&seed=4242&speed=4&mode=expert`)
  await toT0(page, false)
  await ready(page)
  check(await page.locator('[data-boss-intent]').getAttribute('data-boss-intent') === 'hidden', 'Expert never sees the next move')
  await page.screenshot({ path: join(OUT, 'expert-hidden.png') })
  for (let i = 0; i < 8 && !(await page.locator('[data-boss-result]').count()); i++) { await ready(page); if (await page.locator('[data-boss-result]').count()) break; await page.locator('[data-boss-end]').click() }
  await page.waitForSelector('[data-boss-result]')
  check(await page.locator('[data-boss-result]').getAttribute('data-boss-result') === 'lost', 'no measures + no preparation → the embankment breaks')
  await page.screenshot({ path: join(OUT, 'expert-lost.png') })
  await page.locator('[data-boss-continue]').click()
  await page.waitForSelector('[data-modal="act1-summary"]')
  check(await page.locator('[data-embankment-summary="breached"]').count() === 1, 'the summary names the breached zone')
  await page.locator('[data-act1-next]').click()
  await page.waitForFunction(() => window.__maesai.s.act === 2)
  check(await page.evaluate(() => !!window.__maesai.s.breach), 'act 2 runs with the breach')
  await page.close()
}

await browser.close()
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(2) }
console.log('no errors')
