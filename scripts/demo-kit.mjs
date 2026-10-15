/* ══════════════════════════════════════════════════════════════════════════
   DEMO KIT — shared helpers for the Playwright recordings
   (record-demo.mjs · record-perfect-run.mjs)
   On-screen cursor, gliding clicks, step captions, cut sheet, webm → mp4.
   ══════════════════════════════════════════════════════════════════════════ */

import { chromium } from 'playwright'
import { mkdirSync, readdirSync, renameSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

export const wait = (ms) => new Promise((r) => setTimeout(r, ms))

/** Cut-sheet timer: mark('label') prints and stores the elapsed time. */
export function makeMarks() {
  const t0 = Date.now()
  const marks = []
  const stamp = (ms) => { const s = ms / 1000; return `${String(Math.floor(s / 60)).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}` }
  const mark = (label) => {
    const ms = Date.now() - t0
    marks.push({ label, ms })
    console.log(`  ⏱  ${stamp(ms)}  ${label}`)
  }
  return { t0, marks, mark, stamp }
}

/* ── On-screen cursor: Playwright videos do not include the real pointer, so
      we draw one that tracks the synthetic mouse events. ─────────────────── */
export const CURSOR_JS = () => {
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

/** Step caption pinned to the bottom of the video (recording overlay, not part of the app). */
export async function caption(page, step, text) {
  await page.evaluate(([step, text]) => {
    let el = document.getElementById('__rec_caption')
    if (!el) {
      el = document.createElement('div')
      el.id = '__rec_caption'
      el.className = 'font-thai'
      el.style.cssText = `position:fixed;left:50%;bottom:40px;transform:translateX(-50%);z-index:2147483640;
        pointer-events:none;display:flex;align-items:center;gap:12px;max-width:78vw;padding:10px 22px 10px 12px;
        border-radius:12px;border:1.5px solid rgba(255,208,102,.75);background:rgba(3,7,16,.9);
        box-shadow:0 0 34px -8px rgba(255,208,102,.7);color:#fff;font-size:21px;font-weight:600;line-height:1.3`
      document.documentElement.append(el)
    }
    el.innerHTML = ''
    if (step) {
      const chip = document.createElement('span')
      chip.textContent = step
      chip.style.cssText = 'flex-shrink:0;border-radius:8px;background:#FFD066;color:#06101F;padding:3px 10px;font-size:17px;font-weight:800'
      el.append(chip)
    }
    const span = document.createElement('span')
    span.textContent = text
    el.append(span)
    el.animate([{ opacity: 0, transform: 'translateX(-50%) translateY(8px)' }, { opacity: 1, transform: 'translateX(-50%)' }], { duration: 260 })
  }, [step, text])
}

/* ── Driving helpers ──────────────────────────────────────────────────────── */
export async function glide(page, x, y, steps = 26) {
  await page.mouse.move(x, y, { steps })
}

async function centreOf(locator) {
  const b = await locator.boundingBox()
  if (!b) throw new Error('element has no box')
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/** Move the pointer to an element, pause so the viewer can follow, then click. */
export async function point(page, locator, { hold = 420, steps = 26 } = {}) {
  await locator.waitFor({ state: 'visible', timeout: 15000 })
  await locator.scrollIntoViewIfNeeded()
  const { x, y } = await centreOf(locator)
  await glide(page, x, y, steps)
  await wait(hold)
  return { x, y }
}
export async function click(page, locator, opts = {}) {
  const p = await point(page, locator, opts)
  await page.mouse.down(); await wait(90); await page.mouse.up()
  await wait(opts.after ?? 700)
  return p
}

/** Drag a slider handle: left by `left` px, right by `right` px, then settle at `end` px from the start. */
export async function sweep(page, handle, { left = 300, right = 380, end = 40 } = {}) {
  await handle.waitFor({ state: 'visible', timeout: 15000 })
  const hb = await handle.boundingBox()
  const cx = hb.x + hb.width / 2, cy = hb.y + hb.height / 2
  await glide(page, cx, cy, 24)
  await wait(600)
  await page.mouse.down()
  await page.mouse.move(cx - left, cy, { steps: 40 }); await wait(800)
  await page.mouse.move(cx + right, cy, { steps: 56 }); await wait(850)
  await page.mouse.move(cx + end, cy, { steps: 30 })
  await page.mouse.up()
}

/* ── Session ──────────────────────────────────────────────────────────────── */
export async function launch(out, { width = 1920, height = 1080 } = {}) {
  mkdirSync(out, { recursive: true })
  const errors = []
  const browser = await chromium.launch({
    args: ['--allow-file-access-from-files', '--force-device-scale-factor=1', '--hide-scrollbars'],
  })
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    recordVideo: { dir: out, size: { width, height } },
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  return { browser, ctx, page, errors }
}

/** Close the session, name the video, print the cut sheet. Returns the final .webm path. */
export async function finish({ browser, ctx, page, errors }, out, name, { marks, stamp, t0 }) {
  const video = page.video()
  await ctx.close()
  await browser.close()
  const raw = await video.path()
  const final = join(out, name)
  if (existsSync(raw)) renameSync(raw, final)
  for (const f of readdirSync(out)) {
    if (f.endsWith('.webm') && f !== name) rmSync(join(out, f), { force: true })
  }
  console.log('\n──────── CUT SHEET ────────')
  for (const m of marks) console.log(`${stamp(m.ms)}  ${m.label}`)
  console.log(`\nTOTAL ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log(`VIDEO ${final}`)
  if (errors.length) { console.log(`\nPAGE ERRORS (${errors.length}):\n${errors.join('\n')}`); process.exitCode = 2 }
  return final
}

/** webm → H.264 mp4 (plays everywhere). Returns the mp4 path, or null if ffmpeg is missing. */
export function toMp4(webm, mp4) {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4], { stdio: 'inherit' })
  if (r.error || r.status !== 0) { console.log('ffmpeg not available — kept the .webm only'); return null }
  console.log(`MP4   ${mp4}`)
  return mp4
}
