/* ══════════════════════════════════════════════════════════════════════════
   MAE SAI COMMAND — "Perfect Run" gameplay recording (Beginner mode)
   Plays dist/index.html from the title screen to the AAR the way a strong
   player would, with a Thai caption for every step:
     Act 1  forward base → seal the flood-wall gaps → task THEOS-2 by cloud
            forecast → read new landslides (L) → measure the channel (N)
            → evacuate only the zones the water will reach, in time
     Act 2  task THEOS-2 into cloud gaps → cut live power → raise comm towers
            → drones over blind spots → boats with the safest shortest route
            (injured → hospital) → pumps where every route is too deep
     Act 3  roof before/after slider + radar series → ground survey where the
            evidence is weak → relief verdict on every roof → score → leaderboard

     npm run build
     node record-perfect-run.mjs     → recordings/perfect-run-<timestamp>/demo_gameplay.mp4 (+ .webm)
     RECORD_OUT=my-folder RECORD_SEED=4242 node record-perfect-run.mjs

   ?rec exposes the scenario to the recorder only (scripts/demo-flow.mjs);
   every action is still a click on the real UI. The log session lives only in
   the recorder's throw-away browser profile.
   ══════════════════════════════════════════════════════════════════════════ */

import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { CURSOR_JS, wait, makeMarks, glide, click, caption, launch, finish, toMp4 } from './scripts/demo-kit.mjs'
import { playMission } from './scripts/demo-flow.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const SEED = Number(process.env.RECORD_SEED) || 4242
const SPEED = Number(process.env.RECORD_SPEED) || 1          // cut-scene speed: 1 = what a player sees
const APP = (process.env.RECORD_URL || pathToFileURL(join(HERE, 'dist', 'index.html')).href) + `?rec&seed=${SEED}&speed=${SPEED}`
const OUT = resolve(HERE, process.env.RECORD_OUT || join('recordings', `perfect-run-${new Date().toISOString().slice(0, 19).replace(/\D/g, '')}`))
const NAME = 'demo_gameplay'
const W = 1920, H = 1080
const timer = makeMarks()
const { mark } = timer

async function main() {
  const session = await launch(OUT, { width: W, height: H })
  const { page } = session
  const say = (step, text) => { console.log(`  [${((Date.now() - timer.t0) / 1000).toFixed(0)}s] ${step}: ${text}`); return caption(page, step, text) }

  await page.goto(APP, { waitUntil: 'load' })
  await page.waitForSelector('[data-modal="briefing"]', { timeout: 20000 })
  await page.evaluate(CURSOR_JS)
  await glide(page, W / 2, H / 2, 2)

  mark('TITLE')
  await say('เริ่ม', 'หน้าเปิดเกม — คุณคือผู้บัญชาการ EOC แม่สาย · 3 องก์ · เวลาเดินเมื่อคุณสั่งการ')
  await wait(3000)
  await click(page, page.locator('[data-howto]'), { hold: 600, after: 1500 })
  await say('วิธีเล่น', 'หน้า "วิธีเล่น" อธิบายเป้าหมาย 3 องก์ กฎการตัดสินใจ และข้อมูล GISTDA ที่ใช้')
  await page.mouse.wheel(0, 700); await wait(1800); await page.mouse.wheel(0, 900); await wait(1800)
  await click(page, page.locator('[data-howto-close]'), { hold: 400, after: 800 })
  await click(page, page.locator('[data-mode-pick="beginner"]'), { hold: 500, after: 400 })
  await click(page, page.locator('[data-player]'), { after: 200 })
  await page.keyboard.type('PERFECT RUN', { delay: 70 })
  await click(page, page.locator('[data-start]'), { hold: 700, after: 1200 })
  await say('แบบทดสอบ', 'แบบทดสอบก่อนเรียน 5 ข้อ (วัดพัฒนาการ) — คลิปนี้กดข้าม')
  await click(page, page.locator('[data-modal="quiz-pre"] button', { hasText: 'ข้ามแบบทดสอบ' }), { after: 1200 })
  await page.waitForSelector('[data-quest]')
  await page.waitForFunction(() => !!window.__maesai)

  const { score } = await playMission(page, { say, mark, slow: 0.6 })
  await click(page, page.locator('[data-aar-tab="report"]'), { after: 1200 })
  await say('Perfect Run', `จบภารกิจ — คะแนนภารกิจ ${score}`)
  await wait(4500)

  const webm = await finish(session, OUT, `${NAME}.webm`, timer)
  toMp4(webm, join(OUT, `${NAME}.mp4`))
}

main().catch((e) => { console.error('RECORDING FAILED:', e); process.exit(1) })
