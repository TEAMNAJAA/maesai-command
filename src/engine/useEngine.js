/* ══════════════════════════════════════════════════════════════════════════
   GAME ENGINE — central state machine for the three Acts
   Every action reads the latest state through `commit(fn)` (sRef is updated
   synchronously), so no callback can ever act on a stale snapshot.
   ══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { GAME, THRESHOLDS, TRUST, CLOUD_RULE, RELIEF, THEOS2, EMBANKMENT, HYDRO } from '../config/missionConfig'
import { COMMUNITIES, SECTORS, LAYERS, TACTICAL, QUICK_DEPLOY, SHELTER } from '../config/scenarioData'
import {
  T_START, ACT_WINDOW, cloudAt, computeSfvi, holdComparison, exposureSummary, levelAt, reliefSummary,
} from '../lib/sim'
import { clamp, fmt, clockLabel, clockToDate } from '../lib/format'
import { routeOffline, metres, pointInGeometry, communityGeo, isFloodedStreet } from '../lib/geo'
import { sphereRoute, sphereReady } from '../lib/sphere'
import { DATA, OFFLINE_ROUTING } from '../config/missionConfig'
import { EMBANKMENT_GAPS } from '../lib/embankment'
import { logger } from '../lib/evalLogger'

let LOG_SEQ = 0
const mkLog = (lv, tag, msg, th) => ({ id: ++LOG_SEQ, lv, tag, msg, th, stamp: new Date() })

const initialLogs = () => [
  mkLog('info', 'SYSTEM', 'Mae Sai Incident Command Post online — THEOS-2 tasking window open.', 'ศูนย์บัญชาการเหตุการณ์อุทกภัยแม่สายออนไลน์'),
  mkLog('warn', 'COVERAGE', 'No ground gauging station available inside upstream catchment (Myanmar territory).', 'ไม่มีสถานีตรวจวัดภาคพื้นในพื้นที่รับน้ำฝั่งเมียนมา'),
  mkLog('info', 'THEOS-2', `Tasking budget: ${GAME.swaths} swaths × ${THEOS2.swathKm} km · ${THEOS2.product}.`, `งบสั่งถ่ายภาพ ${GAME.swaths} แถบ แถบละ ${THEOS2.swathKm} กม.`),
  mkLog('crit', 'STRUCTURE', 'Missing flood wall detected — 14 embankment gaps require big-bag placement.', 'ตรวจพบจุดฟันหลอของแนวกั้นน้ำ 14 จุด'),
]

export const makeInitial = () => ({
  act: 1,
  clock: T_START,                        // minutes relative to peak flood (T±0)
  ap: GAME.apMax,
  coins: GAME.coinsMax,
  trust: 100,
  trustHist: [100, 100, 100, 100, 100, 100],
  layers: { theos: true, elev: true, buildings: true },
  purchased: ['theos', 'elev', 'buildings'],  // real GISTDA roofs ship with the base map          // a layer is paid for once per round, not per toggle
  layersOpened: [],                      // layers the player switched on themselves (Sandbox metric)
  tasked: [],                            // sector ids imaged cloud-free by THEOS-2
  cloudyPasses: [],                      // passes wasted under cloud
  swaths: GAME.swaths,
  lastImageClock: T_START - 6 * 60,      // last optical evidence is 6 h old at the start
  channelWidth: THRESHOLDS.origChannelWidth, // last confirmed width — stale until imaged
  channelMeasured: false,
  channelSource: null,                   // 'town' (แนวตลิ่งเมือง) or the sector id that measured N
  sealed: [],                            // flood-wall gaps sealed with big bags (act 1 step 2)
  act1Timeout: false,                    // T−0 reached in act 1 → the act-1 summary must close the act
  decisions: [],
  falseAlarms: 0,
  warnedAt: null,
  holdCount: 0,
  evacOrders: {},                        // community id → mission clock of the order
  deployed: { bigbag: 0, boat: 0, patrol: 0 },
  queue: [],
  priorities: [],                        // Act 2 triage order
  convoy: null,
  routes: {},                            // community id → routing result
  detourSolved: false,
  adjudged: {},                          // Act 3 roof decisions
  surveyed: [],
  seeded: { 2: false, 3: false },
  vetoAck: false,
  cloudAck: false,
  resetSeq: 0,
  logs: initialLogs(),
})

const evacCost = (act, n) => Math.round(GAME.evacAP[act] * (act === 1 ? 0.4 + (0.6 * n) / 4 : 1))
export const evacCostFor = evacCost

/** Pure: let `mins` of mission time pass. */
function passTime(p, mins) {
  return {
    ...p,
    clock: p.clock + mins,
    queue: p.queue.map((q) => ({ ...q, eta: q.eta - mins })).filter((q) => q.eta > -30),
  }
}

/** Pure: enter act `n`, seeding presentation values only when the act is entered cold. */
function enterAct(p, n) {
  if (p.act === n) return p
  let next = { ...p, act: n, act1Timeout: false }
  const playedAct1 = p.decisions.length > 0
  if (n === 2 && !p.seeded[2]) {
    const trust = playedAct1 ? p.trust : Math.min(p.trust, GAME.act2Seed.trust)
    next = {
      ...next, seeded: { ...next.seeded, 2: true },
      ap: Math.min(p.ap, GAME.act2Seed.ap),           // critical-phase budget
      trust, trustHist: playedAct1 ? [...p.trustHist, trust] : [...p.trustHist.slice(-18), 68, 61, 55, 49, 45, trust],
      layers: { ...p.layers, theos: false, landx: false, sar: true, roads: true },
      purchased: [...new Set([...p.purchased, 'sar', 'roads'])],
      cloudAck: false,
    }
  }
  if (n === 3 && !next.seeded[3]) {
    next = { ...next, seeded: { ...next.seeded, 3: true }, trust: playedAct1 ? next.trust : GAME.act3SeedTrust }
  }
  if (n === 1) {
    // Skies are clear again in the pre-event phase, so the optical layers come back.
    next = { ...next, layers: { ...next.layers, theos: true, sar: false }, vetoAck: false }
  }
  const [lo, hi] = ACT_WINDOW[n]
  if (next.clock < lo || next.clock > hi) next = { ...next, clock: lo }
  return next
}

export function useEngine() {
  const [s, setS] = useState(makeInitial)
  const [running, setRunning] = useState(false)
  const [flash, setFlash] = useState(null)
  const sRef = useRef(s)

  /** Single write path: compute from the live state, store synchronously, render. */
  const commit = useCallback((fn) => {
    const next = fn(sRef.current)
    if (next === sRef.current) return next
    sRef.current = next
    setS(next)
    return next
  }, [])

  const push = useCallback((lv, tag, msg, th) => {
    commit((p) => ({ ...p, logs: [mkLog(lv, tag, msg, th), ...p.logs].slice(0, 90) }))
  }, [commit])

  const toast = useCallback((kind, text) => {
    const id = Date.now()
    setFlash({ kind, text, id })
    setTimeout(() => setFlash((f) => (f && f.id === id ? null : f)), 3200)
  }, [])

  const sfvi = useMemo(() => computeSfvi(s), [s])
  const world = sfvi.world
  const veto1 = sfvi.veto1
  const veto2 = sfvi.stale
  const exposure = useMemo(() => exposureSummary(s), [s.evacOrders])
  const situation = s.act === 3 ? 'REVIEW'
    : veto1 || s.act === 2 ? 'CRITICAL'
      : world.level >= sfvi.prepLevel ? 'HIGH' : 'ELEVATED'

  /* ── Time ─────────────────────────────────────────────────────────────── */
  /** Advance the clock, crossing into the next act when its window ends. */
  const tick = useCallback((p, mins) => {
    let next = passTime(p, mins)
    if (next.act === 1 && next.clock >= 0) {
      // The flood reaches town: act 1 stops at T−0 and the act-1 summary closes it.
      const first = !p.act1Timeout
      next = { ...next, clock: 0, act1Timeout: true }
      setTimeout(() => {
        setRunning(false)
        if (first) toast('crit', 'T−0 · มวลน้ำถึงตัวเมือง — สรุปผลองก์ 1')
      }, 0)
    } else if (next.act === 2 && next.clock >= ACT_WINDOW[3][0]) {
      next = enterAct(next, 3)
      setTimeout(() => setRunning(false), 0)
    }
    return next
  }, [toast])

  const advance = useCallback((mins) => commit((p) => (p.act === 3 || p.act1Timeout ? p : tick(p, mins))), [commit, tick])

  useEffect(() => {
    if (!running || s.act === 3) return
    const t = setInterval(() => advance(GAME.autoRunStepMin), GAME.autoRunTickMs)
    return () => clearInterval(t)
  }, [running, s.act, advance])

  /* Veto-1 announcement fires once per act-1 run */
  const vetoAnnounced = useRef(false)
  useEffect(() => {
    if (veto1 && s.act === 1 && !vetoAnnounced.current) {
      vetoAnnounced.current = true
      setRunning(false)
      push('crit', 'VETO RULE 1',
        `Ban Tham Pha Chom ${world.level.toFixed(2)} m ≥ ${THRESHOLDS.criticalLevel.toFixed(2)} m — order evacuation now, do NOT wait for the next image pass.`,
        'ถึงระดับวิกฤต สั่งอพยพทันทีโดยไม่รอภาพยืนยัน')
    }
    if (!veto1) vetoAnnounced.current = false
  }, [veto1, s.act, world.level, push])

  /* Cloud-rule announcement — Veto 2 in act 1, optical lock in act 2 */
  const cloudAnnounced = useRef({ stale: false, lock: false })
  useEffect(() => {
    if (veto2 && s.act === 1 && !cloudAnnounced.current.stale) {
      cloudAnnounced.current.stale = true
      push('warn', 'VETO RULE 2', `Cloud ${Math.round(world.cloud)}% over the catchment — L weight cut to ${sfvi.Lw.toFixed(2)}, confidence flagged LOW.`,
        'เมฆบัง/ภาพเก่า ลดน้ำหนัก L และระบุความเชื่อมั่นต่ำ')
    }
    if (world.cloud >= CLOUD_RULE.opticalLockPct && !cloudAnnounced.current.lock) {
      cloudAnnounced.current.lock = true
      push('warn', 'SENSOR', 'CLOUD COVER 100% — optical layers locked. Switching evidence source to RADARSAT-2 via เช็คน้ำ.',
        'เมฆปกคลุม 100% ชั้นภาพเชิงแสงถูกปิดอัตโนมัติ สลับไปใช้เรดาร์')
    }
  }, [veto2, s.act, world.cloud, sfvi.Lw, push])

  /* ── Trust ────────────────────────────────────────────────────────────── */
  const withTrust = (p, t) => ({ ...p, trust: clamp(t, 0, 100), trustHist: [...p.trustHist.slice(-23), clamp(t, 0, 100)] })

  /* ── Layers ───────────────────────────────────────────────────────────── */
  const toggleLayer = useCallback((id) => {
    const L = LAYERS.find((l) => l.id === id)
    const cur = sRef.current
    if (cur.layers[id]) {
      commit((p) => ({ ...p, layers: { ...p.layers, [id]: false } }))
      return
    }
    if (L.optical && cloudAt(cur.clock) >= CLOUD_RULE.opticalLockPct) {
      push('warn', 'LAYER', `${L.name} locked — cloud cover 100%.`, 'เมฆปกคลุม 100% ใช้ภาพเชิงแสงไม่ได้')
      return
    }
    const paid = cur.purchased.includes(id)
    if (!paid && cur.coins < L.cost) {
      push('warn', 'LAYER', `Insufficient data coins for ${L.name} — ${L.cost} required, ${cur.coins} left.`,
        'เหรียญข้อมูลไม่พอ · ต้องเลือกว่าจะซื้อชั้นใดก่อน')
      return
    }
    commit((p) => ({
      ...p,
      coins: paid ? p.coins : p.coins - L.cost,
      layers: { ...p.layers, [id]: true },
      purchased: paid ? p.purchased : [...p.purchased, id],
      layersOpened: p.layersOpened.includes(id) ? p.layersOpened : [...p.layersOpened, id],
    }))
    logger.layerOpened(id, cur.act)
    push('info', 'LAYER', paid ? `${L.name} re-enabled — already licensed this round.` : `${L.name} enabled — ${L.cost} data coin${L.cost > 1 ? 's' : ''} spent.`, null)
  }, [commit, push])

  /* ── THEOS-2 tasking ──────────────────────────────────────────────────── */
  const taskSwath = useCallback((sectorId) => {
    const sec = SECTORS.find((x) => x.id === sectorId)
    const cur = sRef.current
    if (cur.act !== 1 || cur.act1Timeout || cur.tasked.includes(sectorId)) return
    if (cur.swaths <= 0) { push('warn', 'THEOS-2', 'No tasking swaths left this round.', 'โควตาสั่งถ่ายภาพหมดแล้ว'); return }
    if (cur.ap < GAME.swathAP) { push('warn', 'THEOS-2', `Need ${fmt(GAME.swathAP)} AP to task a swath.`, 'แต้มสั่งการไม่พอ'); return }
    const cloud = cloudAt(cur.clock + GAME.swathMinutes)
    const clear = cloud <= CLOUD_RULE.cloudPct
    commit((p) => {
      let next = tick({ ...p, ap: p.ap - GAME.swathAP, swaths: p.swaths - 1 }, GAME.swathMinutes)
      if (!clear) return { ...next, cloudyPasses: [...next.cloudyPasses, sectorId] }
      next = { ...next, tasked: [...next.tasked, sectorId], lastImageClock: next.clock }
      if (sec.widthAt && (!next.channelMeasured || sec.widthAt < next.channelWidth)) {
        next = { ...next, channelWidth: sec.widthAt, channelMeasured: true, channelSource: sec.id }
      }
      return next
    })
    if (!clear) {
      push('warn', 'THEOS-2', `${sec.label} pass returned ${Math.round(cloud)}% cloud — no usable ground pixels. Optical cannot see through cloud.`,
        `ภาพมีเมฆปกคลุม ${Math.round(cloud)}% มองไม่เห็นพื้นดิน — ดาวเทียมเชิงแสงถ่ายทะลุเมฆไม่ได้`)
      toast('warn', `THEOS-2 · ${sec.label} · เมฆบัง ${Math.round(cloud)}%`)
      return
    }
    push('good', 'THEOS-2',
      `Swath tasked over ${sec.label} (${THEOS2.swathKm} km, Pan ${THEOS2.panM} m) — ${sec.scars} new landslide scars detected, 20–30 m wide.`,
      `สั่งถ่ายภาพ ${sec.label} พบร่องรอยดินถล่มใหม่ ${sec.scars} จุด`)
    if (sec.widthAt) {
      const narrow = sec.widthAt < THRESHOLDS.origChannelWidth * THRESHOLDS.narrowChannelRatio
      push('crit', 'CHANNEL',
        `Sai River width measured at ${sec.widthAt} m — down from ${THRESHOLDS.origChannelWidth} m.${narrow ? ` Preparedness band lowered by ${THRESHOLDS.narrowChannelPrepDrop.toFixed(2)} m.` : ''}`,
        `วัดความกว้างลำน้ำเหลือ ${sec.widthAt} ม. จากเดิม ${THRESHOLDS.origChannelWidth} ม.${narrow ? ' → ลดเกณฑ์เตือนภัยและเตือนเร็วขึ้น' : ''}`)
    }
    if (sec.scars >= 3) {
      push('warn', 'SEDIMENT', 'Fresh scars upstream mean the flood will carry mud — stage mud-clearing resources, not only boats.',
        'พบดินถล่มใหม่ น้ำที่มาจะพาโคลนมาด้วย เตรียมทรัพยากรล้างโคลนด้วย')
    }
    toast('ok', `THEOS-2 PASS COMPLETE · ${sec.label}`)
  }, [commit, tick, push, toast])

  /* ── Resources ────────────────────────────────────────────────────────── */
  const deploy = useCallback((id) => {
    const q = QUICK_DEPLOY.find((x) => x.id === id)
    if (sRef.current.ap < q.ap) { push('warn', 'DEPLOY', `Need ${q.ap} AP.`, 'แต้มสั่งการไม่พอ'); return }
    commit((p) => tick({
      ...p, ap: p.ap - q.ap,
      deployed: { ...p.deployed, [id]: (p.deployed[id] || 0) + q.batch },
      queue: [...p.queue, { id: `${id}-${Date.now()}`, name: q.name, qty: q.batch, unit: q.unit, eta: 45 + Math.round(Math.random() * 60) }],
    }, 30))
    push('good', 'DEPLOY', `${q.batch} ${q.unit.toLowerCase()} of ${q.name} dispatched — ${q.ap} AP.`, `ส่ง${q.th} ${q.batch} หน่วย`)
  }, [commit, tick, push])

  /* ── Act 1 · town embankment (step 2) ─────────────────────────────────── */
  /** Measure the Sai channel on the latest THEOS-2 ortho at the town reach → N. */
  const measureChannel = useCallback(() => {
    const cur = sRef.current
    if (cur.act !== 1 || cur.act1Timeout || cur.channelMeasured) return
    const w = HYDRO.trueChannelWidth, orig = THRESHOLDS.origChannelWidth
    const narrow = w < orig * THRESHOLDS.narrowChannelRatio
    commit((p) => tick({ ...p, channelWidth: w, channelMeasured: true, channelSource: 'town' }, EMBANKMENT.measureMinutes))
    push('crit', 'CHANNEL',
      `Sai River measured on the THEOS-2 ortho at the town embankment: ${w} m wide, down from ${orig} m.${narrow ? ` Preparedness band lowered by ${THRESHOLDS.narrowChannelPrepDrop.toFixed(2)} m.` : ''}`,
      `วัดความกว้างลำน้ำสายช่วงในเมืองได้ ${w} ม. จากเดิม ${orig} ม.${narrow ? ' → ลดเกณฑ์เตือนภัยและเตือนเร็วขึ้น' : ''}`)
    toast('ok', `วัดลำน้ำได้ ${w} ม. · ค่า N = ${(1 - w / orig).toFixed(2)}`)
  }, [commit, tick, push, toast])

  /** Seal flood-wall gaps with big bags — one gap or every gap still open. */
  const sealGaps = useCallback((ids) => {
    const cur = sRef.current
    if (cur.act !== 1 || cur.act1Timeout) return
    const todo = ids.filter((id) => !cur.sealed.includes(id))
    if (!todo.length) return
    const cost = todo.length * EMBANKMENT.sealAP
    if (cur.ap < cost) {
      push('warn', 'EMBANKMENT', `Need ${fmt(cost)} AP to seal ${todo.length} gap${todo.length > 1 ? 's' : ''}.`, 'แต้มสั่งการไม่พอสำหรับอุดจุดฟันหลอ')
      return
    }
    const bags = EMBANKMENT_GAPS.filter((g) => todo.includes(g.id)).reduce((a, g) => a + g.len * EMBANKMENT.bagsPerMetre, 0)
    const next = commit((p) => tick({
      ...p, ap: p.ap - cost, sealed: [...p.sealed, ...todo],
      deployed: { ...p.deployed, bigbag: (p.deployed.bigbag || 0) + bags },
    }, todo.length * EMBANKMENT.sealMinutes))
    push('good', 'EMBANKMENT', `${todo.length} flood-wall gap${todo.length > 1 ? 's' : ''} sealed with ${fmt(bags)} big bags (${todo.join(', ')}) — ${fmt(cost)} AP.`,
      `อุดจุดฟันหลอ ${todo.length} จุดด้วยบิ๊กแบ็ก ${fmt(bags)} ใบ`)
    toast('ok', next.sealed.length >= EMBANKMENT_GAPS.length ? 'แนวกั้นน้ำครบทุกจุดแล้ว' : todo.length === 1 ? `อุด ${todo[0]} แล้ว` : `อุดจุดฟันหลอ ${todo.length} จุด`)
  }, [commit, tick, push, toast])

  /* ── Decisions ────────────────────────────────────────────────────────── */
  const record = (p, rec) => {
    const sf = computeSfvi(p)
    const full = {
      act: p.act, clock: p.clock, clockLabel: clockLabel(p.clock), eventTime: clockToDate(p.clock),
      water: +levelAt(p.clock).toFixed(2), sfvi: +sf.basin.toFixed(3), confidence: +sf.confidence.toFixed(2),
      justified: sf.justified, layersOpened: p.layersOpened.length,
      channelMeasured: p.channelMeasured, gapsSealed: p.sealed.length,
      layersActive: Object.values(p.layers).filter(Boolean).length, swaths: p.tasked.length,
      recommended: sf.recommended, at: Date.now(), ...rec,
    }
    return full
  }

  /** Core decision: EVACUATE (selected communities) · STANDBY · HOLD. Returns HOLD comparison. */
  const issueOrder = useCallback((kind, communities) => {
    const cur = sRef.current
    if (cur.act1Timeout) return null                  // act 1 is over — the summary closes it
    const sf = computeSfvi(cur)
    if (kind === 'HOLD') {
      if (sf.veto1 && cur.act === 1) {
        push('crit', 'HOLD REFUSED', 'Veto 1 is active — waiting for the next image pass is no longer a legal option.', 'เกณฑ์ยับยั้งที่ 1 ทำงาน ห้ามรอภาพรอบหน้า')
        return null
      }
      const before = cur
      const rec = record(cur, { kind: 'HOLD', communities: [] })
      const after = commit((p) => {
        const n = tick({ ...p, holdCount: p.holdCount + 1 }, GAME.holdMinutes)
        return { ...n, decisions: [...n.decisions, { ...rec, trustAfter: n.trust }] }
      })
      logger.decision({ ...rec, trustAfter: after.trust, outcome: 'hold' })
      push('warn', 'HOLD', `Command holds. Clock advances ${GAME.holdMinutes / 60} h — the cost of waiting for better evidence is now on the record.`,
        'ยังไม่สั่งการ รอภาพรอบหน้า · เวลาเดินต่อ')
      return holdComparison(before, after)
    }

    if (kind === 'STANDBY') {
      if (cur.ap < GAME.standbyAP) { push('warn', 'ORDER', `Need ${GAME.standbyAP} AP.`, 'แต้มสั่งการไม่พอ'); return null }
      const rec = record(cur, { kind: 'STANDBY', communities: [] })
      const after = commit((p) => {
        const n = tick({ ...p, ap: p.ap - GAME.standbyAP }, 30)
        return { ...n, decisions: [...n.decisions, { ...rec, trustAfter: n.trust }] }
      })
      logger.decision({ ...rec, trustAfter: after.trust, outcome: 'standby' })
      push('warn', 'ORDER', 'Preparedness notice issued to all four watch communities · urgent tasking requested.',
        'แจ้งเตรียมพร้อม 4 ชุมชน และขอสั่งถ่ายภาพรอบเร่งด่วน')
      return null
    }

    // EVACUATE
    const pending = COMMUNITIES.map((c) => c.id).filter((id) => cur.evacOrders[id] === undefined)
    const chosen = (communities?.length ? communities : pending).filter((id) => cur.evacOrders[id] === undefined)
    const targets = chosen.length ? chosen : COMMUNITIES.map((c) => c.id)
    const cost = evacCost(cur.act, targets.length)
    if (cur.ap < cost) { push('warn', 'ORDER', `Need ${fmt(cost)} AP for this evacuation order.`, 'แต้มสั่งการไม่พอสำหรับคำสั่งอพยพ'); return null }

    // Justification is judged per community: veto 1, the gauge band, or that community's own SFVI.
    const scoreOf = Object.fromEntries(sf.perCommunity.map((c) => [c.id, c.score]))
    const gaugeOk = sf.veto1 || sf.world.level >= sf.prepLevel
    const unjustified = gaugeOk ? [] : targets.filter((id) => !sf.recommended.includes(id))
    let delta = 0, outcome = 'justified', fa = cur.falseAlarms
    if (cur.act === 2) {
      if (cur.warnedAt === null) { delta = -TRUST.lateWarningPenalty; outcome = 'late' } else { delta = 1; outcome = 'rebroadcast' }
    } else if (unjustified.length) {
      fa += 1; delta = -TRUST.falseAlarmPenalties[Math.min(fa - 1, TRUST.falseAlarmPenalties.length - 1)]; outcome = 'false-alarm'
    } else {
      delta = TRUST.justifiedBonus
    }
    const rec = record(cur, { kind: 'EVACUATE', communities: targets, matchSfvi: unjustified.length === 0 && cur.act === 1 })
    const after = commit((p) => {
      const orders = { ...p.evacOrders }
      targets.forEach((id) => { if (orders[id] === undefined) orders[id] = p.clock })
      let n = { ...p, ap: p.ap - cost, falseAlarms: fa, evacOrders: orders, warnedAt: p.warnedAt ?? p.clock }
      n = withTrust(n, n.trust + delta)
      n = tick(n, 45)
      return { ...n, decisions: [...n.decisions, { ...rec, outcome, trustAfter: n.trust }] }
    })
    logger.decision({ ...rec, outcome, trustAfter: after.trust })

    const names = targets.map((id) => COMMUNITIES.find((c) => c.id === id).th).join(', ')
    if (outcome === 'late') {
      push('crit', 'LATE WARNING', `Evacuation ordered with the flood already in the streets (${names}). −${TRUST.lateWarningPenalty}% trust, and households were hit before the order reached them.`,
        `เตือนช้า เสียความเชื่อมั่น −${TRUST.lateWarningPenalty}% และมีผู้ได้รับผลกระทบจริง`)
      toast('crit', `LATE WARNING · TRUST −${TRUST.lateWarningPenalty}%`)
    } else if (outcome === 'rebroadcast') {
      push('good', 'ORDER', 'Standing evacuation order re-broadcast to all four watch communities.', 'ประกาศอพยพซ้ำไปยัง 4 ชุมชนเฝ้าระวัง')
      toast('ok', 'EVACUATION RE-BROADCAST')
    } else if (outcome === 'false-alarm') {
      const bad = unjustified.map((id) => `${COMMUNITIES.find((c) => c.id === id).th} (SFVI ${scoreOf[id].toFixed(2)})`).join(', ')
      push('crit', 'FALSE ALARM', `Order not backed by evidence for ${bad} — below the ${sf.prepLevel.toFixed(2)} m band and under SFVI 0.62. Compounding penalty ${delta}%.`,
        `เตือนโดยหลักฐานไม่พอ ครั้งที่ ${fa} เสียความเชื่อมั่น ${delta}%`)
      toast('crit', `FALSE ALARM #${fa} · TRUST ${delta}%`)
    } else {
      push('good', 'ORDER', `EVACUATION ORDER issued for ${names} — backed by the evidence on file. Trust +${TRUST.justifiedBonus}%.`,
        `ประกาศอพยพ ${names} สอดคล้องกับหลักฐาน`)
      toast('ok', `EVACUATION ORDER · ${targets.length} ชุมชน`)
    }
    return null
  }, [commit, tick, push, toast])

  const tactical = useCallback((id) => {
    const a = TACTICAL.find((x) => x.id === id)
    if (a.id === 'evac') return issueOrder('EVACUATE')
    if (sRef.current.ap < a.ap) { push('warn', 'TACTICAL', `Need ${fmt(a.ap)} AP.`, 'แต้มสั่งการไม่พอ'); return null }
    commit((p) => tick({ ...p, ap: p.ap - a.ap }, 20))
    push('info', 'TACTICAL', `${a.name} executed — ${fmt(a.ap)} AP.`, a.th)
    if (a.id === 'drone') {
      push('warn', 'UAV', 'UAV confirms satellite-cued points only. Thai UAVs may not cross the border — upstream remains satellite-only.',
        'UAV ยืนยันจุดที่ดาวเทียมชี้เป้า แต่บินข้ามพรมแดนไม่ได้')
    }
    return null
  }, [commit, tick, push, issueOrder])

  /* ── Act 2 · triage & routing ─────────────────────────────────────────── */
  const setPriority = useCallback((cid) => {
    commit((p) => {
      const cur = p.priorities
      if (cur.includes(cid)) return { ...p, priorities: cur.filter((x) => x !== cid) }
      if (cur.length >= 4) return p
      return { ...p, priorities: [...cur, cid] }
    })
  }, [commit])

  const releaseConvoy = useCallback(() => {
    const cur = sRef.current
    if (cur.priorities.length !== 4) return
    const rule = computeSfvi(cur).ranked.map((c) => c.id)
    const hits = cur.priorities.filter((id, i) => id === rule[i]).length
    const convoy = { order: cur.priorities, rule, hits, clock: cur.clock }
    commit((p) => ({ ...p, convoy }))
    logger.triage(convoy)
    const nm = (id) => COMMUNITIES.find((c) => c.id === id).th
    push(hits === 4 ? 'good' : 'warn', 'DISPATCH', `Convoy released: ${cur.priorities.map(nm).join(' → ')} · ${hits}/4 match the decision rule.`,
      `ปล่อยขบวนตามลำดับ ${cur.priorities.map(nm).join(' → ')}`)
  }, [commit, push])

  /** Evacuation route from a community to the shelter — sphere Routing, else offline OSM router. */
  const computeRoute = useCallback(async (cid) => {
    const cur = sRef.current
    if (cur.ap < GAME.detourAP) { push('warn', 'ROUTING', `Need ${GAME.detourAP} AP to compute a route.`, 'แต้มสั่งการไม่พอ'); return null }
    const c = COMMUNITIES.find((x) => x.id === cid)
    const geoC = communityGeo.find((x) => x.id === cid) || c
    const from = [geoC.lon, geoC.lat], to = [SHELTER.lon, SHELTER.lat]
    const flooded = cur.act === 2
    const radar = DATA.radarFlood?.features || []
    const wetAt = (p) => (radar.length ? radar.some((f) => pointInGeometry(p, f.geometry)) : flooded && isFloodedStreet(p))
    const blocked = (mid) => metres(mid, from) >= OFFLINE_ROUTING.originExemptM && wetAt(mid)   // wade out to the nearest through-road
    const wetShare = (coords) => {
      const pts = coords.filter((p) => metres(p, from) >= OFFLINE_ROUTING.originExemptM)
      return pts.length ? pts.filter(wetAt).length / pts.length : 0
    }
    const offline = () => {
      const r = routeOffline(from, to, blocked)
      return r ? { ...r, durationS: (r.distanceM / 1000 / OFFLINE_ROUTING.convoyKmh) * 3600, steps: [] } : null
    }

    let route = null, source = 'sphere', note = ''
    if (sphereReady()) {
      try {
        route = await sphereRoute(from, to)
        // sphere knows today's road network, not this flood: if its route runs through the
        // flooded riverside streets, route again through a dry waypoint found offline.
        if (wetShare(route.coords) > 0.05) {
          const dry = offline()
          if (dry) {
            const via = dry.coords[Math.floor(dry.coords.length / 2)]
            const [a, b] = await Promise.all([sphereRoute(from, via), sphereRoute(via, to)])
            route = { coords: [...a.coords, ...b.coords], distanceM: a.distanceM + b.distanceM, durationS: a.durationS + b.durationS, steps: [...a.steps, ...b.steps], via }
          }
        }
      } catch (e) { note = e.message; route = null }
    }
    if (!route) { source = 'offline'; route = offline() }
    if (!route) {
      push('crit', 'ROUTING', `No passable route from ${c.th} — every exit crosses flooded streets. No AP spent.`, `ไม่พบเส้นทางที่ผ่านได้จาก${c.th} (ไม่หักแต้ม)`)
      return null
    }
    const result = { ...route, source, cid, clock: sRef.current.clock }
    // AP and time are only spent on a successful computation.
    commit((p) => ({ ...tick({ ...p, ap: p.ap - GAME.detourAP }, 25), routes: { ...p.routes, [cid]: result }, detourSolved: true }))
    const viaRoads = [...new Set(route.steps || [])].slice(0, 4).join(' → ')
    push('good', source === 'sphere' ? 'SPHERE ROUTING API' : 'OFFLINE ROUTER',
      `${c.name} → evacuation point: ${(route.distanceM / 1000).toFixed(1)} km, ~${Math.round(route.durationS / 60)} min${route.via ? ' (via a dry waypoint)' : ''}${source === 'offline' ? ' (OSM graph, riverside streets closed)' : ''}${viaRoads ? ` · ${viaRoads}` : ''}.`,
      source === 'sphere'
        ? `คำนวณเส้นทางหนีน้ำด้วย GISTDA sphere Routing API${route.via ? ' โดยเลี่ยงถนนริมน้ำที่ท่วม' : ''}`
        : `คำนวณเส้นทางสำรองแบบออฟไลน์ (${note ? `sphere ไม่ตอบ: ${note}` : 'ไม่มีอินเทอร์เน็ต/คีย์ sphere'})`)
    return result
  }, [commit, tick, push])

  /* ── Act 3 · relief adjudication ──────────────────────────────────────── */
  const adjudicate = useCallback((roofId, verdict) => {
    const next = commit((p) => ({ ...p, adjudged: { ...p.adjudged, [roofId]: verdict } }))
    logger.relief(reliefSummary(next))
  }, [commit])
  const survey = useCallback((roofId) => {
    commit((p) => (p.surveyed.includes(roofId) ? p : { ...p, surveyed: [...p.surveyed, roofId] }))
    push('info', 'GROUND SURVEY', `${roofId} — field team dispatched. Accurate but slow: +90 min, ฿${fmt(RELIEF.surveyCost)}.`,
      'ส่งสำรวจภาคพื้น แม่นแต่ช้า')
  }, [commit, push])

  /* ── Act transitions ──────────────────────────────────────────────────── */
  const goAct = useCallback((n) => {
    if (n === 1) { vetoAnnounced.current = false; cloudAnnounced.current = { stale: false, lock: false } }
    commit((p) => enterAct(p, n))
    setRunning(false)
  }, [commit])

  const ackVeto = useCallback(() => commit((p) => ({ ...p, vetoAck: true })), [commit])
  const ackCloud = useCallback(() => commit((p) => ({ ...p, cloudAck: true })), [commit])

  const reset = useCallback(() => {
    vetoAnnounced.current = false
    cloudAnnounced.current = { stale: false, lock: false }
    LOG_SEQ = 0
    commit((p) => ({ ...makeInitial(), resetSeq: p.resetSeq + 1 }))
    setRunning(false)
  }, [commit])

  return {
    s, sfvi, world, veto1, veto2, situation, exposure, running, setRunning, flash,
    push, toast, advance, toggleLayer, taskSwath, deploy, measureChannel, sealGaps, tactical, issueOrder,
    setPriority, releaseConvoy, computeRoute, adjudicate, survey, goAct, ackVeto, ackCloud, reset,
  }
}
