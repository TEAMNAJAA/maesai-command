/* ══════════════════════════════════════════════════════════════════════════
   DEMO FLOW — a careful player who clicks through all three acts
   Used by record-demo.mjs and record-perfect-run.mjs.
   The app must be opened with ?rec so window.__maesai exposes the scenario
   (correct scar labels, wet zones, best boat route). Every action is still
   a real click on the UI so the video shows what a player would do.
   Time only moves when the player acts: the flow presses the time bar
   (THEOS-2 capture / next event / skip to the end) and waits out each cut scene.
   ══════════════════════════════════════════════════════════════════════════ */

import { wait, point, click, sweep } from './demo-kit.mjs'

const RIVER = ['D', 'E', 'TOWN']

export async function playMission(page, { say = async () => {}, mark = () => {}, slow = 1 } = {}) {
  const has = async (sel) => (await page.locator(sel).count()) > 0
  const tab = (id) => page.locator(`[data-rail="command"] [data-tab="${id}"]`)
  const ms = (n) => Math.round(n * slow)
  const idle = () => page.waitForFunction(() => !window.__maesai.busy, null, { timeout: 30000 })
  /** Press a time-bar control and sit through the cut scene. */
  const advance = async (sel, text) => {
    if (text) await say('เวลา', text)
    await idle()
    const b = page.locator(sel).first()
    if (!(await b.count()) || !(await b.isEnabled())) return false
    await click(page, b, { hold: ms(450), after: 200 })
    await wait(300); await idle(); await wait(ms(500))
    return true
  }
  const st = () => page.evaluate(() => {
    const { s, scn } = window.__maesai
    return {
      act: s.act, clock: s.clock, camp: s.camp, trips: s.trips, gapsTotal: window.__maesai.gapCount,
      queued: s.sealed.length + s.jobs.filter((j) => j.kind === 'seal').length,
      passes: scn.passes.map((p) => ({ id: p.id, t: p.t, reach: p.reach, forecast: p.forecast, chosen: s.taskings[p.id] || [] })),
      images: s.images.map((i) => ({ id: i.id, target: i.target, usable: i.usable, ready: i.readyAt <= s.clock, analyzed: !!i.analyzed })),
      measured: s.channel.measured, ordered: Object.keys(s.orders), orderAt: window.__maesai.orderAt(),
    }
  })
  const openTab = async (id, after = 500) => { if (await has(`[data-rail="command"] [data-tab="${id}"]`)) await click(page, tab(id), { hold: ms(250), after: ms(after) }) }
  const ensureView = async (id) => { const v = page.locator(`[data-view="${id}"]`); if (await v.count()) await click(page, v, { hold: ms(200), after: ms(700) }) }

  let swept = false                      // show the before/after slider once, then work fast like a trained player
  /* ══════════ ACT I ══════════ */
  mark('ACT I · watch')
  for (let guard = 0; guard < 2000; guard++) {
    if (await has('[data-modal="act1-summary"]')) break
    if (await has('[data-modal="veto"]')) {
      await say('Veto 1', 'ระดับน้ำถึง 4.20 ม. — กฎ Veto 1 บังคับให้ตัดสินใจทันที (ทีมสั่งอพยพโซนเสี่ยงไว้แล้ว)')
      await click(page, page.locator('[data-modal="veto"] button', { hasText: 'รับทราบ' }), { hold: ms(900), after: ms(600) })
      continue
    }
    const s = await st()
    if (!s.camp) {
      await say('ฐาน', 'ตั้งฐานบัญชาการที่ที่ว่าการอำเภอ — พื้นสูง 414 ม. ห่างแม่น้ำ น้ำไม่ท่วมฐาน')
      await openTab('base')
      await click(page, page.locator('[data-camp="cmp-amp"]'), { hold: ms(700), after: ms(900) })
      continue
    }
    if (s.queued < s.gapsTotal) {
      await say('ตลิ่ง', 'แนวตลิ่งเมือง: ส่งทีมบิ๊กแบ็กอุดจุดฟันหลอทั้งหมด — ทีมทยอยอุดระหว่างที่เวลาเดิน')
      await openTab('bank'); await ensureView('corridor')
      await wait(ms(1200))
      const b = page.locator('[data-panel="bank"] button', { hasText: 'ส่งทีมอุด' })
      if (await b.count()) await click(page, b.first(), { hold: ms(600), after: ms(900) })
      if ((await st()).queued < s.gapsTotal) throw new Error('could not queue every embankment gap (budget?)')
      continue
    }
    const next = s.passes.find((p) => p.t > s.clock && !p.chosen.length)
    if (next && next === s.passes.find((p) => p.t > s.clock)) {
      const needRiver = !s.measured && !s.images.some((i) => i.usable && RIVER.includes(i.target))
      const order = [...next.reach].sort((a, b) => (next.forecast[a] - next.forecast[b]) || (RIVER.includes(a) ? -1 : 1))
      let pick = order.filter((t) => next.forecast[t] <= 50).slice(0, 2)
      if (needRiver) { const r = order.find((t) => RIVER.includes(t) && next.forecast[t] <= 55); if (r && !pick.includes(r)) pick = [r, ...pick].slice(0, 2) }
      if (!pick.length) pick = order.slice(0, 1)
      await say('THEOS-2', `วางแผนถ่ายภาพรอบ ${next.id}: เลือกเป้าหมายที่เมฆพยากรณ์ต่ำ (${pick.map((t) => (t === 'TOWN' ? 'ตัวเมือง' : `Sector ${t}`) + ` ${next.forecast[t]}%`).join(' · ')})`)
      await openTab('theos'); await ensureView('catchment')
      for (const t of pick) await click(page, page.locator(`[data-target="${next.id}-${t}"]`), { hold: ms(500), after: ms(500) })
      continue
    }
    const img = s.images.find((i) => i.usable && i.ready && !i.analyzed && i.target !== 'TOWN')
    if (img) {
      await say('แปลภาพ', `ภาพ THEOS-2 Sector ${img.target} พร้อม — เทียบก่อน/หลัง แล้วระบุเฉพาะรอยดินถล่ม "ใหม่" (ค่า L)`)
      await openTab('theos')
      await click(page, page.locator(`[data-image="${img.id}"] button`), { hold: ms(500), after: ms(1200) })
      const handle = page.locator('[data-analysis-handle]')
      if (!swept && await handle.count()) { await sweep(page, handle, { left: 260, right: 320, end: 0 }); swept = true }
      const cands = await page.evaluate((id) => {
        const { s, scn } = window.__maesai
        const im = s.images.find((x) => x.id === id)
        return scn.scenes[im.target].cands.map((c) => ({ id: c.id, scar: c.kind === 'scar' }))
      }, img.id)
      for (const c of cands.filter((x) => x.scar)) await click(page, page.locator(`[data-cand="${c.id}"]`), { hold: ms(260), after: ms(240) })
      await click(page, page.locator('[data-modal="analysis"] button', { hasText: 'ส่งผล' }), { hold: ms(500), after: ms(2200) })
      await click(page, page.locator('[data-modal="analysis"] button', { hasText: 'ปิด' }), { hold: ms(200), after: ms(400) })
      continue
    }
    const riverImg = s.images.find((i) => i.usable && i.ready && RIVER.includes(i.target))
    if (!s.measured && riverImg) {
      await say('ค่า N', 'วัดความกว้างลำน้ำจากภาพ Pan 0.5 ม.: ลากเส้นวัดไปที่ขอบน้ำ → พิกเซล × 0.5 = เมตร → N = 1 − เมตร ÷ 150')
      await openTab('bank')
      await click(page, page.locator('[data-panel="bank"] button', { hasText: 'เปิดเครื่องมือวัด' }), { hold: ms(500), after: ms(1000) })
      const river = await page.locator('[data-modal="channel"] svg rect[fill="#3a3a3a"]').boundingBox()
      for (const [k, x] of [['a', river.x], ['b', river.x + river.width]]) {
        const g = await page.locator(`[data-gauge="${k}"] circle`).boundingBox()
        await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2, { steps: 18 }); await wait(ms(300))
        await page.mouse.down(); await page.mouse.move(x, g.y + g.height / 2, { steps: 30 }); await page.mouse.up(); await wait(ms(400))
      }
      const { px, n } = await page.evaluate(() => { const c = window.__maesai.scn.channel; return { px: c.pixels, n: (1 - (c.pixels * 0.5) / 150).toFixed(2) } })
      await say('ค่า N', `วัดได้ ${px} พิกเซล → ${px} × 0.5 = ${(px * 0.5).toFixed(1)} ม. → N = 1 − ${(px * 0.5).toFixed(1)} ÷ 150 = ${n}`)
      await click(page, page.locator('[data-n-input]'), { hold: ms(300), after: ms(200) })
      await page.keyboard.type(n, { delay: 120 })
      await click(page, page.locator('[data-modal="channel"] button', { hasText: 'ส่งค่า N' }), { hold: ms(500), after: ms(1600) })
      await click(page, page.locator('[data-modal="channel"] button', { hasText: 'ปิด' }), { hold: ms(200), after: ms(400) })
      continue
    }
    const upcoming = s.passes.find((p) => p.t > s.clock)
    if (!s.ordered.length) {
      const at = s.orderAt
      if (s.clock >= at) {
        const wet = await page.evaluate(() => window.__maesai.wetZones())
        await say('อพยพ', `ตารางโซน: น้ำจะถึงโซน ${wet.join(', ')} — สั่งอพยพเฉพาะโซนเหล่านี้ ก่อนเวลาที่ต้องใช้อพยพจะไม่พอ`)
        await click(page, page.locator('[data-left-tab="zones"]'), { hold: ms(400), after: ms(800) })
        await openTab('zones'); await ensureView('urban')
        await point(page, page.locator('[data-panel="zones"]'), { hold: ms(1600) })
        for (const z of wet) await click(page, page.locator(`[data-pick="${z}"]`), { hold: ms(220), after: ms(250) })
        await click(page, page.locator('[data-panel="zones-order"] button', { hasText: 'สั่งอพยพ' }), { hold: ms(700), after: ms(1200) })
        continue
      }
      // the next capture would jump past the moment to order: step the clock an hour at a time
      if (!upcoming || upcoming.t + 120 > at) { await advance('[data-advance="hour"]', 'เดินเวลาทีละชั่วโมง — ดูระดับน้ำและตารางโซนก่อนสั่งอพยพ'); continue }
    }
    if (upcoming) {
      await openTab('theos')
      await advance('[data-capture]', `ให้ THEOS-2 ถ่ายรอบ ${upcoming.id} — คัตซีน: ดาวเทียมโคจร → ถ่ายภาพ → ประมวลผล L3 Ortho`)
      continue
    }
    if (!(await advance('[data-advance="end"]', 'สั่งการครบแล้ว — ข้ามไป T−0'))) await advance('[data-advance="next"]')
  }
  await say('สรุปองก์ 1', 'มวลน้ำถึงตัวเมือง — สรุปผลองก์ 1')
  await wait(ms(3500))
  await click(page, page.locator('[data-act1-next]'), { hold: ms(600), after: ms(1500) })

  /* ══════════ ACT II ══════════ */
  mark('ACT II · crisis')
  await say('องก์ 2', 'เมฆเคลื่อนผ่านเมือง 35–65% — สั่ง THEOS-2 ถ่ายทุกรอบเพื่อหาผู้ติดค้างในช่องที่เมฆเปิด')
  await openTab('sensors')
  for (let i = 0; i < 4; i++) {
    const b = page.locator('[data-pass2] button', { hasText: 'สั่งถ่าย' }).first()
    if (!(await b.count())) break
    await click(page, b, { hold: ms(350), after: ms(400) })
  }
  const droneAt = {}
  const skip = new Set()                 // points with no safe route right now — retried after the next event
  for (let guard = 0; guard < 4000; guard++) {
    if (await has('[data-modal="act2-summary"]')) break
    await page.evaluate((ids) => { window.__skip = ids }, [...skip])
    const a = await page.evaluate(() => {
      const { s, scn } = window.__maesai
      const busy = (k, id) => s.jobs.some((j) => j.kind === k && j.section === id)
      return {
        clock: s.clock,
        power: s.hazardsLive.filter((id) => !s.powerCut[id] && !busy('power', id)),
        comm: s.commDown.filter((id) => !s.towers[id] && !busy('tower', id)),
        blind: scn.blindSpots, droneFree: s.drones.some((d) => d.busyUntil <= s.clock),
        boatFree: s.boats.some((b) => b.busyUntil <= s.clock),
        pumps: Object.keys(s.pumps).length,
        // one shuttling boat clears a point; a second only when the deadline is close · supply needs one trip
        point: s.points.filter((p) => p.revealed && p.status === 'waiting' && !s.commDown.includes(p.section) && !(s.pumps[p.section] && s.pumps[p.section].readyAt > s.clock))
          .filter((p) => {
            const going = s.jobs.filter((j) => j.point === p.id && (j.kind === 'boatAtPoint' || j.kind === 'boatAtDest')).length
            if (p.type === 'hardship') return going === 0
            return going === 0 || (going < 2 && p.deadline - s.clock < 8 * 60 && p.left > 10)
          })
          .filter((p) => !window.__skip?.includes(p.id))
          .sort((x, y) => x.deadline - y.deadline)
          .map((p) => ({ id: p.id, section: p.section, type: p.type, injured: p.injured, people: p.left }))[0] || null,
        shelter: scn.shelters[0],
      }
    })
    if (a.power.length) {
      await say('ไฟฟ้ารั่ว', `พบไฟฟ้ารั่วโซน ${a.power[0]} — สั่ง กฟภ. ตัดไฟก่อนส่งทีมเข้า`)
      await openTab('field')
      await click(page, page.locator(`[data-power="${a.power[0]}"] button`), { hold: ms(500), after: ms(700) })
      continue
    }
    if (a.comm.length) {
      await say('สื่อสาร', `พายุตัดสัญญาณโซน ${a.comm[0]} — ตั้งเสาสื่อสารเคลื่อนที่ (ใช้เวลา 3 ชม.)`)
      await openTab('field')
      await click(page, page.locator(`[data-comm="${a.comm[0]}"] button`), { hold: ms(500), after: ms(700) })
      continue
    }
    if (a.point && a.boatFree) {
      const mission = a.point.type === 'hardship' ? 'supply' : 'rescue'
      const dest = a.point.injured ? 'hosp' : a.shelter
      const idx = await page.evaluate(([id, m, d]) => { const p = window.__maesai.planFor(id, m, d); return p && p.best ? p.options.indexOf(p.best) : -1 }, [a.point.id, mission, dest])
      if (idx < 0) {
        // every route crosses deep water: pump the zone on the way (or wait for the water to drop)
        const deep = await page.evaluate(([id, m, d]) => { const { s } = window.__maesai; return window.__maesai.deepAlong(id, m, d).filter((z) => !s.pumps[z]) }, [a.point.id, mission, dest])
        if (deep.length && a.pumps < 3) {
          await say('สูบน้ำ', `ทุกเส้นทางไป ${a.point.id} ผ่านโซนน้ำลึก ${deep[0]} — ติดตั้งเครื่องสูบน้ำโซน ${deep[0]} เพื่อเปิดทาง`)
          await openTab('field')
          await click(page, page.locator(`[data-pump-zone="${deep[0]}"]`), { hold: ms(350), after: ms(300) })
          const pb = page.locator('[data-panel="field"] button', { hasText: 'ติดตั้งเครื่องสูบ' })
          if (await pb.count() && await pb.isEnabled()) await click(page, pb, { hold: ms(400), after: ms(600) })
          continue
        }
        skip.add(a.point.id)
        await advance('[data-advance="next"]')
        continue
      }
      const why = mission === 'supply' ? 'บ้านยังอยู่ได้ → ส่งถุงยังชีพ' : a.point.injured ? `มีผู้บาดเจ็บ ${a.point.injured} คน → ส่งโรงพยาบาล` : 'อยู่ไม่ได้ → อพยพไปจุดอพยพ'
      await say('เรือกู้ภัย', `${a.point.id}: ${a.point.people} คน · ${why} · เลือกเส้นทางที่ปลอดภัยและสั้นที่สุด`)
      await openTab('ops')
      await click(page, page.locator(`[data-point="${a.point.id}"] button`, { hasText: 'วางแผนเรือ' }), { hold: ms(450), after: ms(1100) })
      await click(page, page.locator(`[data-mission="${mission}"]`), { hold: ms(300), after: ms(400) })
      if (mission === 'rescue') await click(page, page.locator(`[data-dest="${dest}"]`), { hold: ms(300), after: ms(500) })
      await click(page, page.locator(`[data-route-opt="${idx}"]`), { hold: ms(600), after: ms(900) })
      await click(page, page.locator('[data-modal="planner"] button', { hasText: 'ส่งเรือออก' }), { hold: ms(450), after: ms(600) })
      continue
    }
    const blind = a.blind.find((id) => a.clock - (droneAt[id] ?? -999) >= 360)
    if (blind && a.droneFree) {
      droneAt[blind] = a.clock
      await say('โดรน', `โซน ${blind} เป็นจุดอับ (ซอยลึก/ใต้ร่มไม้) — ดาวเทียมมองไม่เห็นคน ส่งโดรนช่วยส่อง`)
      await openTab('sensors')
      await click(page, page.locator(`[data-drone-zone="${blind}"]`), { hold: ms(300), after: ms(300) })
      await click(page, page.locator('[data-panel="sensors"] button', { hasText: 'ส่งโดรน' }), { hold: ms(400), after: ms(600) })
      continue
    }
    // skip to the recession only once every group has had time to be found and helped
    const late = await page.evaluate(() => { const { s } = window.__maesai; return s.clock >= 26 * 60 && s.points.every((p) => p.status !== 'waiting' || s.jobs.some((j) => j.point === p.id)) })
    if (!(late && await advance('[data-advance="end"]', 'ช่วยครบทุกจุดแล้ว — ข้ามไปน้ำลด'))) await advance('[data-advance="next"]', 'เดินเวลา → เหตุการณ์ถัดไป (เรือแล่น · สายด่วน · รอบดาวเทียม)')
    skip.clear()
  }
  await say('สรุปองก์ 2', 'น้ำเริ่มลด — สรุปผลการช่วยเหลือ')
  await wait(ms(3500))
  await click(page, page.locator('[data-act2-next]'), { hold: ms(600), after: ms(2500) })

  /* ══════════ ACT III ══════════ */
  mark('ACT III · relief')
  const roofs = await page.evaluate(() => window.__maesai.scn.roofs.map((r) => ({ id: r.id, survey: r.radarGap || r.theosCloud, v: r.truth.flat ? (r.truth.mud ? 'both' : 'flat') : 'reject' })))
  const vth = { flat: 'เหมาจ่าย ฿9,000', both: '฿9,000 + ค่าล้างโคลน ฿10,000', reject: 'ปฏิเสธ (ท่วมขังไม่ถึง 7 วัน)' }
  for (const [i, r] of roofs.entries()) {
    await click(page, page.locator(`[data-roof="${r.id}"]`), { hold: ms(250), after: ms(1200) })
    if (i < 2) {
      await say('เยียวยา', 'ลากสไลเดอร์เทียบภาพก่อน/หลัง (โคลนรอบบ้าน) + นับวันท่วมขังจากไทม์ซีรีส์เรดาร์')
      const h = page.locator('[data-slider-handle]').first()
      if (await h.count()) await sweep(page, h, { left: 380, right: 260, end: -120 })
    }
    if (r.survey) {
      await say('เยียวยา', `${r.id}: หลักฐานไม่ครบ (เมฆบัง/เรดาร์ขาดรอบ) — ส่งทีมสำรวจภาคพื้นก่อนตัดสิน`)
      const sb = page.locator('button', { hasText: 'ส่งสำรวจภาคพื้น' })
      if (await sb.count()) await click(page, sb.first(), { hold: ms(400), after: ms(900) })
    }
    await say('เยียวยา', `${r.id}: ${vth[r.v]}`)
    await click(page, page.locator(`[data-verdict="${r.id}-${r.v}"]`), { hold: ms(400), after: ms(700) })
  }
  await click(page, page.locator('[data-aar-tab="summary"]'), { hold: ms(400), after: ms(1200) })
  await say('AAR', 'สรุปคะแนนภารกิจ — บันทึกลงตารางอันดับ')
  const save = page.locator('[data-save-score]')
  if (await save.count() && await save.isEnabled()) await click(page, save, { hold: ms(800), after: ms(2500) })
  const score = await page.evaluate(() => document.querySelector('[data-panel="mission-score"]')?.textContent.match(/(\d+)\s*%/)?.[1] || '?')
  await page.keyboard.press('Escape'); await wait(ms(800))
  mark(`AAR · mission score ${score}%`)
  return { score }
}
