/* ══════════════════════════════════════════════════════════════════════════
   MAE SAI COMMAND — automated demo recording
   Drives the built single-file app (dist/index.html?demo — skips the briefing
   and pre-test, and flags the log session as a demo) and records a 1920×1080
   walkthrough of the three acts.

     npm run build
     node record-demo.mjs                 → recordings/run-<timestamp>/maesai-demo.webm
     RECORD_OUT=my-folder node record-demo.mjs

   Existing videos are never deleted: every run writes to its own folder.
   ══════════════════════════════════════════════════════════════════════════ */

import { chromium } from 'playwright'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { mkdirSync, readdirSync, renameSync, rmSync, existsSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = pathToFileURL(join(HERE, 'dist', 'index.html')).href + '?demo'
const OUT = resolve(HERE, process.env.RECORD_OUT || join('recordings', `run-${new Date().toISOString().slice(0, 19).replace(/\D/g, '')}`))
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
  mkdirSync(OUT, { recursive: true })
  const errors = []

  const browser = await chromium.launch({
    args: ['--allow-file-access-from-files', '--force-device-scale-factor=1', '--hide-scrollbars'],
  })
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: { width: W, height: H } },
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  await page.goto(APP, { waitUntil: 'load' })
  await page.waitForSelector('[data-rail="command"]', { timeout: 20000 })
  await page.evaluate(CURSOR_JS)
  await glide(page, W / 2, H / 2, 2)
  await wait(2200)                                     // let the HUD settle on camera

  const tab = (id) => page.locator(`[data-rail="command"] [data-tab="${id}"]`)
  const view = (id) => page.locator(`[data-view="${id}"]`)

  /* ══════════ SEGMENT 1 · ACT I — T−48 Hrs ══════════ */
  mark('SEGMENT 1 · ACT I begins (real AOI-B catchment)')

  // 1 · task a THEOS-2 swath over the narrowed channel (Sector D) on the real map
  await click(page, page.locator('[data-sector="D"]'), { hold: 620, after: 3000 })
  mark('  THEOS-2 swath over Sector D · N measured')

  // 2 · buy evidence layers
  await click(page, tab('data'), { after: 600 })
  await click(page, page.locator('[data-layer="river"]'), { after: 700 })
  await click(page, page.locator('[data-layer="roads"]'), { after: 700 })
  await click(page, page.locator('[data-layer="pop"]'), { after: 900 })
  mark('  three evidence layers opened')

  // 3 · real town view, then the 3D DEM tilt
  await click(page, view('urban'), { after: 2200 })
  await click(page, page.locator('[data-tilt]'), { after: 2600 })
  await click(page, page.locator('[data-tilt]'), { after: 1200 })
  mark('  AOI-A communities + 3D tilt')

  // 4 · decision: hold once to show the dual comparison, then evacuate
  await click(page, tab('decide'), { after: 900 })
  await click(page, page.locator('[data-panel="decide"] button', { hasText: 'ยังไม่สั่งการ' }), { after: 3200 })
  await click(page, page.locator('[data-modal="hold"] button', { hasText: 'รับทราบ' }), { after: 900 })
  await click(page, page.locator('[data-panel="decide"] button', { hasText: 'ประกาศอพยพ' }), { hold: 620, after: 2600 })
  mark('SEGMENT 1 ends · evacuation ordered')

  /* ══════════ SEGMENT 2 · ACT II — T+0 Hrs ══════════ */
  mark('SEGMENT 2 · ACT II begins')
  await click(page, page.locator('[data-next-act]'), { after: 2600 })
  await click(page, page.locator('[data-modal="cloud"] button', { hasText: 'Sphere Routing' }), { after: 1600 })
  await click(page, page.locator('[data-route-from="slj"]'), { after: 600 })
  await click(page, page.locator('[data-panel="route"] button', { hasText: 'คำนวณเส้นทาง' }), { after: 3200 })
  mark('  evacuation route computed (Sai Lom Joy → high ground)')

  await click(page, tab('triage'), { after: 800 })
  for (const id of ['slj', 'ksa', 'mlk', 'mdg']) await click(page, page.locator(`[data-triage="${id}"]`), { after: 450 })
  await click(page, page.locator('[data-panel="triage"] button', { hasText: 'ปล่อยขบวน' }), { after: 2800 })
  mark('SEGMENT 2 ends · triage released')

  /* ══════════ SEGMENT 3 · ACT III — AAR ══════════ */
  mark('SEGMENT 3 · ACT III begins')
  await click(page, page.locator('[data-next-act]'), { after: 2600 })

  const handle = page.locator('[data-slider-handle]').first()
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

  await click(page, page.locator('[data-aar-tab="decisions"]'), { after: 1500 })
  // roof IDs come from the real GISTDA footprints (BD-<FID>), so drive the first rows by position
  for (const [row, v] of [[0, 'both'], [2, 'reject'], [3, 'flat']]) {
    const tr = page.locator('[data-roof]').nth(row)
    const roof = await tr.getAttribute('data-roof')
    await click(page, tr, { after: 900 })
    await click(page, page.locator(`[data-verdict="${roof}-${v}"]`), { after: 1100 })
  }
  mark('  roof-by-roof relief adjudication')
  const relief = page.locator('[data-panel="relief-budget"]')
  await point(page, relief, { hold: 1800 })
  await click(page, page.locator('[data-aar-tab="summary"]'), { after: 2400 })
  mark('SEGMENT 3 ends · mission score')

  await wait(1600)

  const video = page.video()
  await ctx.close()
  await browser.close()

  const raw = await video.path()
  const final = join(OUT, 'maesai-demo.webm')
  if (existsSync(raw)) renameSync(raw, final)
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
  if (errors.length) { console.log(`\nPAGE ERRORS (${errors.length}):\n${errors.join('\n')}`); process.exitCode = 2 }
}

main().catch((e) => { console.error('RECORDING FAILED:', e); process.exit(1) })
