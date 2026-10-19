/* Screenshots: Stress Test picker + in-game effects, the teacher's round-1-vs-round-2 view,
   and the player's own progress card (needs npm run dev).
   node scripts/probe-stress-compare.mjs <outDir> [baseUrl]
   The teacher view uses synthetic sessions written to this browser profile only. */
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

const OUT = process.argv[2] || 'recordings/probe-stress-compare'
const BASE = process.argv[3] || 'http://localhost:5173/'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const errors = []
const watch = (page, tag) => { page.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`)); page.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`) }) }
const idle = (page) => page.waitForFunction(() => window.__maesai && !window.__maesai.busy, null, { timeout: 60000 })

/* ── 1 · title screen picker + a stress game ─────────────────────────── */
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }); watch(page, 'stress')
  await page.goto(`${BASE}?rec&seed=4242&speed=8`)
  await page.waitForSelector('[data-stress-picker]')
  for (const k of ['data', 'roads', 'time']) await page.locator(`[data-stress="${k}"]`).click()
  await page.waitForTimeout(300)
  const st = await page.evaluate(() => ({ stress: window.__maesai.s.stress, clock: window.__maesai.s.clock, lost: window.__maesai.scn.stress }))
  if (st.stress.length !== 3 || st.clock !== -36 * 60) errors.push(`picker did not apply: ${JSON.stringify(st)}`)
  await page.locator('[data-modal="briefing"] .w-\\[min\\(980px\\,94vw\\)\\]').screenshot({ path: join(OUT, 'title-stress.png') }).catch(() => page.screenshot({ path: join(OUT, 'title-stress.png') }))
  await page.locator('[data-player]').fill('ครูทดสอบ')
  await page.locator('[data-start]').click()
  await page.locator('button', { hasText: 'ข้ามแบบทดสอบ' }).click()
  await page.waitForSelector('[data-stress-badge]')
  // task the pass that will be lost and run to it
  const lost = st.lost.lostPass
  await page.locator('[data-rail="command"] [data-tab="theos"]').click()
  const card = page.locator(`[data-panel="theos"] [data-pass="${lost}"]`)
  if (await card.count()) {
    await card.locator('[data-target]').first().click()
    await page.evaluate((id) => { const p = window.__maesai.scn.passes.find((x) => x.id === id); return window.__maesai.advance({ mode: 'until', to: p.t + 10 }) }, lost)
    await idle(page); await page.waitForTimeout(500)
    if (!(await page.evaluate(() => window.__maesai.s.logs.some((l) => /สูญหาย/.test(l.th))))) errors.push('the lost pass left no log line')
  }
  await page.screenshot({ path: join(OUT, 'game-stress.png') })
  await page.close()
}

/* ── 2 · teacher: round 1 vs round 2 from synthetic sessions ────────── */
const names = ['ม.6/2-01', 'ม.6/2-02', 'ม.6/2-03', 'ม.6/2-04', 'ม.6/2-05', 'ม.6/2-06', 'ม.6/2-07', 'ม.6/2-08']
const r1 = [52, 61, 48, 70, 57, 66, 44, 59], r2 = [71, 74, 63, 76, 55, 82, 62, 73]
const metric = (score, k, i, round) => ({
  score, parts: {}, falseAlarms: round === 1 ? (i % 3 === 0 ? 2 : 1) : (i % 4 === 0 ? 1 : 0), exposedHH: 400 - score * 3, savedPct: Math.min(100, score + 8 + (round - 1) * 6),
  lost: 40 - score / 3, routeErrors: round === 1 ? 2 + (i % 2) : i % 2, wrongDest: 0, reliefPct: Math.min(100, score + (round === 2 ? 12 : 0)), layersFirst: round === 1 ? 2 + (i % 2) : 4,
  hints: round === 1 ? 6 - (i % 3) : 2 - (i % 2), hintPts: 0, missed: round === 1 ? 14 - (i % 4) : 7 - (i % 3), realSec: round === 1 ? 900 + i * 40 : 560 + i * 25,
  seed: round === 1 ? 1000 + i : 2000 + i, mode: 'beginner', stress: round === 2 && i === 5 ? ['data'] : [],
})
const sessions = names.flatMap((n, i) => [1, 2].map((round) => ({
  id: `S-${i}-${round}`, startedAt: `2026-10-19T0${round}:${String(10 + i).padStart(2, '0')}:00Z`, player: n, hintsEnabled: true, demo: false, briefingMs: 120000,
  pre: round === 1 ? { score: 2 + (i % 2), total: 5 } : null, post: round === 2 ? { score: 4, total: 5 } : null, actMs: { 1: 0, 2: 0, 3: 0 }, layersOpened: [], hints: [], rounds: [{ n: 1, kind: 'EVACUATE', layersOpened: 3 }],
  result: { score: round === 1 ? r1[i] : r2[i], metrics: metric(round === 1 ? r1[i] : r2[i], null, i, round) },
})))
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }); watch(page, 'teacher')
  await page.addInitScript((data) => { try { localStorage.setItem('maesai-command.eval.v1', JSON.stringify({ sessions: data })) } catch {} }, sessions)
  await page.goto(`${BASE}?demo&seed=4242`)
  await page.waitForSelector('[data-rail="command"]')
  await page.keyboard.press('Control+Shift+L')
  await page.waitForSelector('[data-modal="teacher"]')
  await page.locator('[data-teacher-tab="compare"]').click()
  await page.waitForSelector('[data-compare]')
  await page.waitForTimeout(400)
  await page.locator('[data-modal="teacher"]').screenshot({ path: join(OUT, 'teacher-compare.png') })
  await page.close()
}

/* ── 3 · player progress card: a previous round on this machine, then finish a new one ── */
{
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } }); watch(page, 'progress')
  await page.addInitScript((data) => { try { localStorage.setItem('maesai-command.eval.v1', JSON.stringify({ sessions: data })) } catch {} }, sessions)
  await page.goto(`${BASE}?rec&seed=5151&speed=8`)
  await page.locator('[data-player]').fill('ม.6/2-05')
  await page.locator('[data-start]').click()
  await page.locator('button', { hasText: 'ข้ามแบบทดสอบ' }).click()
  await page.waitForSelector('[data-rail="command"]')
  await page.locator('[data-rail="command"] [data-tab="base"]').click(); await page.locator('[data-camp="cmp-amp"]').click(); await idle(page)
  await page.evaluate(() => window.__maesai.advance({ mode: 'end' })); await idle(page)
  await page.locator('[data-act1-next]').click(); await page.waitForTimeout(500)
  await page.evaluate(() => window.__maesai.advance({ mode: 'end' })); await idle(page)
  await page.locator('[data-act2-next]').click(); await page.waitForTimeout(800)
  for (const r of await page.locator('[data-roof]').all()) { await r.click(); const id = await r.getAttribute('data-roof'); await page.locator(`[data-verdict="${id}-reject"]`).click() }
  await page.locator('button:has-text("สรุป · Leaderboard")').first().click()
  await page.waitForSelector('[data-prev-round]')
  await page.waitForTimeout(500)
  await page.locator('[data-prev-round]').screenshot({ path: join(OUT, 'player-progress.png') })
  if ((await page.locator('[data-prev-round]').getAttribute('data-prev-round')) !== '1') errors.push('previous round not found for the same player')
  await page.close()
}

await browser.close()
console.log(errors.length ? `ERRORS\n${errors.join('\n')}` : 'no errors')
process.exit(errors.length ? 2 : 0)
