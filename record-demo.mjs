/* ══════════════════════════════════════════════════════════════════════════
   MAE SAI COMMAND — automated demo recording
   Drives the built single-file app and records a 1920×1080 walkthrough
   following the three-act presentation script.

     node record-demo.mjs

   Output: recordings/maesai-demo.webm  (+ .mp4 when ffmpeg is available)
   ══════════════════════════════════════════════════════════════════════════ */

import { chromium } from 'playwright'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync, readdirSync, renameSync, rmSync, existsSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = pathToFileURL(join(HERE, 'dist', 'index.html')).href
const OUT = join(HERE, 'recordings')
const W = 1920, H = 1080

const t0 = Date.now()
const marks = []
const mark = (label) => {
  const ms = Date.now() - t0
  marks.push({ label, ms })
  const s = (ms / 1000)
  console.log(`  ⏱  ${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}  ${label}`)
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/* ── On-screen cursor: Playwright videos do not include the real pointer, so
      we draw one that tracks the synthetic mouse events. ─────────────────── */
const CURSOR_JS = () => {
  const dot = document.createElement('div')
  dot.style.cssText = `position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;
    border:2.5px solid #fff;border-radius:50%;pointer-events:none;z-index:2147483647;
    box-shadow:0 0 0 1.5px rgba(0,0,0,.65), 0 0 14px rgba(255,255,255,.85);
    background:rgba(255,255,255,.14);transition:width .08s,height .08s;will-change:transform`
  const core = document.createElement('div')
  core.style.cssText = `position:fixed;left:0;top:0;width:5px;height:5px;margin:-2.5px 0 0 -2.5px;
    background:#fff;border-radius:50%;pointer-events:none;z-index:2147483647;
    box-shadow:0 0 0 1px rgba(0,0,0,.6)`
  document.documentElement.append(dot, core)
  let x = innerWidth / 2, y = innerHeight / 2
  const draw = () => {
    dot.style.transform = `translate(${x}px,${y}px)`
    core.style.transform = `translate(${x}px,${y}px)`
  }
  draw()
  addEventListener('mousemove', (e) => { x = e.clientX; y = e.clientY; draw() }, true)
  addEventListener('mousedown', () => {
    dot.style.borderColor = '#00FF41'
    const r = document.createElement('div')
    r.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:12px;height:12px;margin:-6px 0 0 -6px;
      border:2px solid #00FF41;border-radius:50%;pointer-events:none;z-index:2147483646;opacity:.95`
    document.documentElement.append(r)
    r.animate([{ transform: 'scale(1)', opacity: .95 }, { transform: 'scale(4.5)', opacity: 0 }],
      { duration: 620, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => r.remove()
  }, true)
  addEventListener('mouseup', () => { dot.style.borderColor = '#fff' }, true)
}

/* ── Driving helpers ──────────────────────────────────────────────────────── */
async function glide(page, x, y, steps = 26) {
  await page.mouse.move(x, y, { steps })
}

async function centreOf(locator) {
  const b = await locator.boundingBox()
  if (!b) throw new Error('element has no box')
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/** Move the pointer to an element, pause so the viewer can follow, then click. */
async function point(page, locator, { hold = 420, steps = 26 } = {}) {
  await locator.waitFor({ state: 'visible', timeout: 15000 })
  const { x, y } = await centreOf(locator)
  await glide(page, x, y, steps)
  await wait(hold)
  return { x, y }
}
async function click(page, locator, opts = {}) {
  const p = await point(page, locator, opts)
  await page.mouse.down(); await wait(90); await page.mouse.up()
  await wait(opts.after ?? 700)
  return p
}

async function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  const browser = await chromium.launch({
    args: ['--allow-file-access-from-files', '--force-device-scale-factor=1', '--hide-scrollbars'],
  })
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: { width: W, height: H } },
  })
  const page = await ctx.newPage()

  await page.goto(APP, { waitUntil: 'load' })
  await page.waitForSelector('text=MAE SAI COMMAND', { timeout: 20000 })
  await page.evaluate(CURSOR_JS)
  await glide(page, W / 2, H / 2, 2)
  await wait(2200)                                     // let the HUD settle on camera

  /* Scoped locators */
  const cmd = page.locator('.panel', { hasText: 'COMMAND INTERFACE' })
  const actI = page.locator('button[title*="SEEING THE UNSEEN"]')
  const actII = page.locator('button[title*="THE DAY CLOUDS"]')
  const actIII = page.locator('button[title*="WATER RECEDES"]')

  /* ══════════ SEGMENT 1 · ACT I — T−48 Hrs ══════════ */
  mark('SEGMENT 1 · ACT I begins')
  await click(page, actI, { after: 1100 })

  // 1 · layers — untick then re-tick so the toggle is visible on camera
  const theos = page.locator('button', { hasText: 'THEOS-2 Optical' }).first()
  const elev = page.locator('button', { hasText: 'Sphere Elevation' }).first()
  await click(page, theos, { after: 520 })
  await click(page, theos, { after: 900 })
  await click(page, elev, { after: 520 })
  await click(page, elev, { after: 1300 })
  mark('  layers toggled')

  // 2 · flood-wall marker → VERY HIGH popup
  const pins = page.locator('svg[viewBox="0 0 1000 760"] circle[fill="transparent"]')
  await click(page, pins.nth(5), { hold: 620, after: 2600 })
  mark('  Missing Flood Wall popup')

  // 3 · OPERATIONS tab → catchment tasking grid (3 swaths, Myanmar side)
  await click(page, cmd.locator('button', { hasText: 'OPERATIONS' }), { after: 1100 })
  await click(page, page.locator('button', { hasText: 'Open Catchment Tasking Grid' }), { after: 2900 })
  mark('  catchment tasking grid')

  // show a swath actually being tasked — the core Act-I mechanic
  await click(page, page.locator('button').filter({ hasText: /SECTOR C/ }).first(), { after: 3000 })
  mark('  THEOS-2 swath tasked over Sector C')

  // 4 · back to OVERVIEW → place big bags
  await click(page, cmd.locator('button', { hasText: 'OVERVIEW' }), { after: 900 })
  await click(page, page.locator('button', { hasText: 'SANDBAGS (BIG BAG)' }), { hold: 620, after: 3000 })
  mark('SEGMENT 1 ends · big bags deployed')

  /* ══════════ SEGMENT 2 · ACT II — T+0 Hrs ══════════ */
  mark('SEGMENT 2 · ACT II begins')
  await click(page, actII, { after: 2600 })            // hold on the radar switch

  // 1 · SAR layer
  const sar = page.locator('button', { hasText: 'SAR Flood Extent' }).first()
  await click(page, sar, { after: 700 })
  await click(page, sar, { after: 2400 })
  mark('  SAR flood extent')

  // 2 · ROUTE BLOCKED cross → detail
  const xHit = page.locator('svg[viewBox="0 0 1000 760"] rect[fill="transparent"]').first()
  await click(page, xHit, { hold: 620, after: 2700 })
  mark('  ROUTE BLOCKED detail')

  // 3 · Sphere Routing API detour, then the evacuation order
  await click(page, page.locator('button', { hasText: 'Compute Detour' }), { after: 2800 })
  mark('  detour computed')
  await click(page, cmd.locator('button', { hasText: 'OVERVIEW' }), { after: 800 })
  await click(page, page.locator('button', { hasText: 'EVACUATION ALERT' }).first(), { hold: 620, after: 2600 })
  mark('  evacuation alert · late warning')

  // 4 · hover the trust gauge as it collapses
  const trust = page.locator('.panel', { hasText: 'TRUST INDEX' }).first()
  await point(page, trust, { hold: 400 })
  const tb = await trust.boundingBox()
  await glide(page, tb.x + tb.width / 2, tb.y + tb.height * 0.55, 20)
  await wait(3600)
  mark('SEGMENT 2 ends · trust index')

  /* ══════════ SEGMENT 3 · ACT III — AAR ══════════ */
  mark('SEGMENT 3 · ACT III begins')
  await click(page, actIII, { after: 2600 })

  // 1 · before/after slider drag
  const handle = page.locator('[class*="cursor-ew-resize"]').first()
  const hb = await handle.boundingBox()
  const cy = hb.y + hb.height / 2
  await glide(page, hb.x + hb.width / 2, cy, 24)
  await wait(700)
  await page.mouse.down()
  await page.mouse.move(hb.x - 380, cy, { steps: 42 }); await wait(850)
  await page.mouse.move(hb.x + 470, cy, { steps: 64 }); await wait(900)
  await page.mouse.move(hb.x + 40, cy, { steps: 34 })
  await page.mouse.up()
  await wait(1400)
  mark('  before / after slider')

  // change detection overlay
  await click(page, page.locator('button', { hasText: 'CHANGE DETECTION' }), { after: 2600 })
  mark('  change detection')

  // 2 · relief budget logic on the right
  const relief = page.locator('.panel', { hasText: 'RELIEF BUDGET' })
  await relief.scrollIntoViewIfNeeded()
  await point(page, relief, { hold: 500 })
  const rb = await relief.boundingBox()
  await glide(page, rb.x + rb.width * 0.5, rb.y + rb.height * 0.30, 20); await wait(1500)
  await glide(page, rb.x + rb.width * 0.5, rb.y + rb.height * 0.52, 18); await wait(1700)
  await glide(page, rb.x + rb.width * 0.5, rb.y + rb.height * 0.80, 18); await wait(2200)
  mark('SEGMENT 3 ends · relief budget')

  await wait(1600)

  const video = page.video()
  await ctx.close()
  await browser.close()

  const raw = await video.path()
  const final = join(OUT, 'maesai-demo.webm')
  if (existsSync(raw)) renameSync(raw, final)
  // tidy any stray empty video files
  for (const f of readdirSync(OUT)) {
    if (f.endsWith('.webm') && f !== 'maesai-demo.webm') rmSync(join(OUT, f), { force: true })
  }

  console.log('\n──────── CUT SHEET ────────')
  for (const m of marks) {
    const s = m.ms / 1000
    console.log(`${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}  ${m.label}`)
  }
  console.log(`\nTOTAL ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log(`VIDEO ${final}`)
}

main().catch((e) => { console.error('RECORDING FAILED:', e); process.exit(1) })
