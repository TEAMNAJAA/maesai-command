/* Officer-training mode (F4): title switch, ?officer, the settings toggle — no chibi, no boss fight, no music,
   no cartoon accident; the decision support stays. Screenshots at 1920×1080 and 1280×720.
   node scripts/probe-officer.mjs <outDir> [baseUrl]   (needs npm run dev) · exit 2 on an error or a failed check */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
const OUT = process.argv[2] || 'recordings/probe-officer'
const BASE = process.argv[3] || 'http://localhost:5173/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const errors = []
const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) errors.push(what) }
const idle = (page) => page.waitForFunction(() => window.__maesai && !window.__maesai.busy, null, { timeout: 60000 })
const count = (page, sel) => page.locator(sel).count()

for (const [w, h] of [[1920, 1080], [1280, 720]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  page.on('pageerror', (e) => errors.push(`${w}: ${e.message}`))
  // the title screen switch
  await page.goto(`${BASE}?rec&seed=4242&speed=4`)
  await page.waitForSelector('[data-officer-toggle]')
  check(await count(page, '[data-chibi-edit]') === 1, `${w}: the chibi editor shows by default`)
  await page.locator('[data-officer-toggle]').click()
  check(await page.locator('[data-officer-toggle]').getAttribute('data-on') === '1', `${w}: the title switch turns officer mode on`)
  check(await count(page, '[data-chibi-edit]') === 0, `${w}: no chibi editor in officer mode`)
  await page.screenshot({ path: join(OUT, `${w}-title.png`) })
  await page.locator('[data-player]').fill('จนท. ปภ. ทดสอบ')
  await page.locator('[data-start]').click(); await page.locator('button', { hasText: 'ข้ามแบบทดสอบ' }).click()
  await idle(page)
  check(await count(page, '[data-chibi-dock]') === 0, `${w}: no chibi dock`)
  check(await count(page, '[data-officer-badge]') === 1, `${w}: the top bar says officer-training mode`)
  check(await count(page, '[data-tutor]') + await count(page, '[data-rail="command"]') > 0, `${w}: the decision support is still there`)
  await page.screenshot({ path: join(OUT, `${w}-act1.png`) })
  // to T0: no fight, the summary carries the embankment result
  for (let i = 0; i < 30 && !(await count(page, '[data-modal="act1-summary"]')); i++) {
    await idle(page)
    if (await count(page, '[data-modal="veto"]')) { await page.locator('[data-modal="veto"] button', { hasText: 'รับทราบ' }).click(); continue }
    check(await count(page, '[data-boss]') === 0, `${w}: no boss fight`)
    await page.evaluate(() => window.__maesai.advance({ mode: 'end' }))
    await page.waitForTimeout(400)
  }
  await page.waitForSelector('[data-modal="act1-summary"]')
  check(await count(page, '[data-embankment-summary]') === 1, `${w}: the act-1 summary reports the embankment`)
  check(await page.evaluate(() => window.__maesai.s.boss?.fought === false && window.__maesai.s.bossLog.length === 0), `${w}: resolved from the preparation, no card decisions`)
  await page.locator('[data-modal="act1-summary"]').screenshot({ path: join(OUT, `${w}-summary.png`) })
  // the settings toggle switches it back off
  await page.locator('[data-act1-next]').click()
  await idle(page)
  await page.locator('[data-settings]').click()
  check(await page.locator('[data-pref="officer"]').getAttribute('data-on') === '1', `${w}: the settings toggle shows officer mode`)
  await page.locator('[data-pref="officer"]').click()
  check(await count(page, '[data-chibi-dock]') === 1, `${w}: switching it off brings the chibi back`)
  await page.close()
}

// ?officer from the URL, and the session log records it
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.on('pageerror', (e) => errors.push(`url: ${e.message}`))
  await page.goto(`${BASE}?demo&rec&seed=4242&officer`)
  await idle(page)
  check(await count(page, '[data-officer-badge]') === 1 && await count(page, '[data-chibi-dock]') === 0, '?officer turns it on')
  const csvHasCol = await page.evaluate(async () => { const m = await import('/src/lib/evalLogger.js'); return m.logger.sessionsCSV().split('\n')[0].includes('officer') })
  check(csvHasCol, 'sessions CSV has an officer column')
  await page.close()
}

await browser.close()
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(2) }
console.log('no errors')
