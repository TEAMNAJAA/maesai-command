/* ══════════════════════════════════════════════════════════════════════════
   MAE SAI COMMAND — automated demo recording / end-to-end smoke test
   Drives the built single-file app (dist/index.html?demo — skips the briefing
   and pre-test, flags the log session as a demo) through all three acts at a
   higher clock speed and records a 1920×1080 video.

     npm run build
     node record-demo.mjs                 → recordings/run-<timestamp>/maesai-demo.webm
     RECORD_OUT=my-folder node record-demo.mjs

   Exits with code 2 if the page logged any error. Existing videos are never
   deleted: every run writes to its own folder. The player lives in
   scripts/demo-flow.mjs, the cursor/captions in scripts/demo-kit.mjs.
   ══════════════════════════════════════════════════════════════════════════ */

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { CURSOR_JS, glide, makeMarks, caption, launch, finish } from './scripts/demo-kit.mjs'
import { playMission } from './scripts/demo-flow.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SEED = Number(process.env.RECORD_SEED) || 4242
const SPEED = Number(process.env.RECORD_SPEED) || 3          // faster cut scenes for the smoke test
const APP = (process.env.RECORD_URL || pathToFileURL(join(HERE, 'dist', 'index.html')).href) + `?demo&rec&seed=${SEED}&speed=${SPEED}`
const OUT = resolve(HERE, process.env.RECORD_OUT || join('recordings', `run-${new Date().toISOString().slice(0, 19).replace(/\D/g, '')}`))
const W = 1920, H = 1080
const timer = makeMarks()

async function main() {
  const session = await launch(OUT, { width: W, height: H })
  const { page } = session
  await page.goto(APP, { waitUntil: 'load' })
  await page.waitForSelector('[data-quest]', { timeout: 20000 })
  await page.waitForFunction(() => !!window.__maesai)
  await page.evaluate(CURSOR_JS)
  await glide(page, W / 2, H / 2, 2)
  const { score } = await playMission(page, { say: (step, text) => { console.log(`  [${((Date.now() - timer.t0) / 1000).toFixed(0)}s] ${step}: ${text}`); return caption(page, step, text) }, mark: timer.mark, slow: 0.6 })
    .catch(async (e) => { await page.screenshot({ path: join(OUT, 'failure.png') }).catch(() => {}); throw e })
  console.log(`MISSION SCORE ${score}%`)
  await finish(session, OUT, 'maesai-demo.webm', timer)
}

main().catch((e) => { console.error('RECORDING FAILED:', e); process.exit(1) })
