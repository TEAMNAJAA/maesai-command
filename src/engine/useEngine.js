/* ══════════════════════════════════════════════════════════════════════════
   GAME ENGINE HOOK — the mission clock moves only when the commander acts
   ไม่มีการนั่งรอ: คำสั่งมีผลทันทีและกินเวลาสั่งการ · ปุ่ม "เดินเวลา" กระโดดไปเหตุการณ์
   ถัดไปพร้อมคัตซีนสั้น ๆ (ดาวเทียมสแกน · เรือแล่น · น้ำขึ้น) · วัดเวลาเล่นจริงแยกต่างหาก
   Every action is a pure transition (engine/actions.js); time is engine/world.js.
   All writes go through commit(fn) so no callback ever acts on a stale snapshot.
   ══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { TIME, MODES, MISSION, THRESHOLDS, ACT2, parseStress } from '../config/missionConfig'
import { LAYERS, SHELTER_POOL } from '../config/scenarioData'
import { makeScenario } from '../lib/scenario'
import { computeSfvi, exposureSummary, reliefSummary, peakDepth, arrivalAt, evacNeedMin, depthAt, HARM_M } from '../lib/sim'
import { planTrip } from '../lib/routes'
import { fetchBoatLegs } from '../lib/sphereRoutes'
import { routeOffline, metres, isFloodedStreet } from '../lib/geo'
import { sphereRoute, sphereReady } from '../lib/sphere'
import { SECTIONS, SECTION_BY_ID, sectionAt } from '../lib/sections'
import { EMBANKMENT_GAPS } from '../lib/embankment'
import { newSeed } from '../lib/rng'
import { logger } from '../lib/evalLogger'
import { makeInitial, advanceTo, enterAct2, enterAct3, log, campOf, destOf } from './world'
import * as A from './actions'
import { applyBoss, resolveBoss } from './boss'
import { fx } from '../lib/fx'

const URLQ = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const SPEED = Math.max(0.2, Number(URLQ.get('speed')) || 1)        // cut-scene speed (recordings use > 1)
const FIXED_SEED = Number(URLQ.get('seed')) || null
const REC = URLQ.has('rec')                                         // recorder hook (record-*.mjs) — never on in normal play
const URL_STRESS = parseStress(URLQ.get('stress'))                  // ?stress=data,roads,time | all — Stress Test from a link

/** B7: the short scene that goes with a boat or drone order. The outcome comes from the engine — the scene only shows it. */
export function sceneOf(kind, before, after, scn = null) {
  if (kind === 'review' && (before.reviewed || []).length === 0 && (after.reviewed || []).length === 1) {
    const roof = scn?.roofs?.find((r) => r.id === after.reviewed[0])
    return roof ? { kind: 'control', roof: roof.id, ring: roof.ring, c: roof.c } : null
  }
  if (kind === 'boat') {
    const inc = (after.incidents || []).length > (before.incidents || []).length ? after.incidents[after.incidents.length - 1] : null
    if (inc) return { kind: 'boat', outcome: inc.kind, boat: inc.boat, point: inc.point, coords: inc.coords, splitAt: inc.splitAt }
    const job = after.jobs.filter((j) => j.kind === 'boatAtPoint' && j.start === before.clock).pop()
    return job ? { kind: 'boat', outcome: 'ok', boat: job.boat, point: job.point, coords: job.coords, splitAt: job.splitAt } : null
  }
  if (kind === 'drone') {
    const job = after.jobs.filter((j) => j.kind === 'drone' && j.start === before.clock).pop()
    return job ? { kind: 'drone', drone: job.drone, section: job.section } : null
  }
  return null
}

export function useEngine() {
  const [s, setS] = useState(() => makeInitial(URLQ.get('mode') === 'expert' ? 'expert' : 'beginner', FIXED_SEED || newSeed(), URL_STRESS))
  const [cut, setCut] = useState(null)              // active cut scene (time jump)
  const busy = useRef(false)
  const skip = useRef(false)
  const real = useRef({ start: null, actStart: null, acts: {} })
  const [flash, setFlash] = useState(null)
  const sRef = useRef(s)
  const stressKey = (s.stress || []).join()
  const scn = useMemo(() => makeScenario(s.seed, s.modeId, s.stress), [s.seed, s.modeId, stressKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const scnRef = useRef(scn)
  scnRef.current = scn
  const mode = MODES[s.modeId]

  /** Single write path: compute from the live state, store synchronously, render. */
  const commit = useCallback((fn) => {
    const next = fn(sRef.current, scnRef.current)
    if (!next || next === sRef.current) return sRef.current
    sRef.current = next
    setS(next)
    return next
  }, [])

  /* toasts queued by pure transitions → one flash at a time */
  useEffect(() => {
    if (flash || !s.toasts?.length) return
    const [first] = s.toasts
    setFlash(first)
    commit((p) => ({ ...p, toasts: p.toasts.filter((x) => x.id !== first.id) }))
  }, [s.toasts, flash, commit])
  useEffect(() => {                                  // the hide timer lives with the flash, not the queue
    if (!flash) return
    const t = setTimeout(() => setFlash(null), sRef.current.toasts?.length ? 1800 : 3000)
    return () => clearTimeout(t)
  }, [flash])
  const toast = useCallback((kind, text) => commit((p) => ({ ...p, toasts: [...(p.toasts || []), { kind, text, id: Date.now() + Math.random() }] })), [commit])

  /* ── Clock: animated jumps ─────────────────────────────────────────────── */
  const atEnd = (p) => (p.act === 1 && p.clock >= 0) || (p.act === 2 && p.clock >= MISSION.act2EndMin) || p.act === 3
  /**
   * Move the mission clock forward with a short cut scene.
   *   mode 'next' — stop at the next event the commander must react to (or the act's jump cap)
   *   mode 'span' — exactly `min` minutes
   *   mode 'until'— to minute `to` (e.g. a THEOS-2 pass + processing), stopping early only for Veto 1
   *   mode 'end'  — straight to the end of the act
   */
  const advance = useCallback(({ mode: how = 'next', min = TIME.stepMin, to = null } = {}) => {
    const p0 = sRef.current, sc = scnRef.current
    if (busy.current || atEnd(p0)) return
    const end = p0.act === 1 ? 0 : MISSION.act2EndMin
    const target = how === 'end' ? end : how === 'until' ? Math.min(end, to) : Math.min(end, p0.clock + (how === 'span' ? min : TIME.maxJumpMin[p0.act]))
    if (target <= p0.clock) return
    let stopAt = target
    if (how === 'next' || how === 'until') {
      let probe = p0
      for (let t2 = p0.clock + 10; ; t2 += 10) {
        const tt = Math.min(t2, target)
        const prev = probe.eventSeq
        probe = advanceTo(probe, sc, tt)
        const hit = probe.eventSeq !== prev && (how === 'next' || probe.lastEvent?.kind === 'crit')
        if (hit || tt >= target) { stopAt = tt; break }
      }
    }
    // a THEOS-2 acquisition inside the jump gets the scanning cut scene
    const pass = p0.act === 1
      ? sc.passes.find((q) => q.t > p0.clock && q.t <= stopAt && (p0.taskings[q.id] || []).length)
      : sc.act2Passes.find((q) => q.t > p0.clock && q.t <= stopAt && p0.act2Orders[q.id])
    const hours = (stopAt - p0.clock) / 60
    const ms = (pass ? TIME.cutMs.theos : Math.max(TIME.cutMs.min, Math.min(TIME.cutMs.max, TIME.cutMs.min + hours * TIME.cutMs.perHour))) / SPEED
    const from = p0.clock
    // THEOS-2 sequence: the pass happens during the camera shot (k ≈ 0.3), processing fills the rest
    const passAt = pass ? Math.min(stopAt, Math.max(from, pass.t)) : null
    const clockAt = (k) => {
      if (!pass) { const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; return from + (stopAt - from) * e }
      if (k < 0.3) { const u = k / 0.3; return from + (passAt - from) * (1 - (1 - u) ** 2) }
      return passAt + (stopAt - passAt) * ((k - 0.3) / 0.7)
    }
    skip.current = false
    busy.current = true
    setCut({ kind: pass ? 'theos' : 'advance', pass: pass ? { id: pass.id, targets: p0.act === 1 ? p0.taskings[pass.id] : ['TOWN'], t: pass.t } : null, from, to: stopAt, p: 0, act: p0.act })
    let t0 = performance.now()
    let last = 0
    const tick = () => {
      const now = performance.now()
      if (skip.current) { t0 = now - ms; skip.current = false }
      const k = Math.min(1, (now - t0) / ms)
      if (k < 1 && now - last < 70) { requestAnimationFrame(tick); return }   // ~14 map updates/s — the town map is heavy
      last = now
      const clock = Math.round(clockAt(k))
      commit((q, sc2) => (clock > q.clock ? advanceTo(q, sc2, clock) : q))
      setCut((c) => c && { ...c, p: k })
      if (k < 1) { requestAnimationFrame(tick); return }
      commit((q, sc2) => (stopAt > q.clock ? advanceTo(q, sc2, stopAt) : q))
      const ev = sRef.current.eventSeq !== p0.eventSeq ? sRef.current.lastEvent : null
      setCut((c) => c && { ...c, p: 1, done: true, event: ev })
      closeTimer.current = setTimeout(() => { busy.current = false; setCut(null) }, (pass ? 2200 : ev ? 1300 : 350) / SPEED)
    }
    requestAnimationFrame(tick)
  }, [commit])

  /** Click during a cut scene: jump to its end · click on the result: close it. */
  const closeTimer = useRef(null)
  const skipCut = useCallback(() => {
    setCut((c) => {
      if (!c) return c
      if (c.done) { clearTimeout(closeTimer.current); busy.current = false; return null }
      skip.current = true
      return c
    })
  }, [])

  /* real playing time (for the leaderboard and the learning log) */
  const realMs = useCallback(() => (real.current.start ? (real.current.end || Date.now()) - real.current.start : 0), [])
  const markAct = (n) => { const r = real.current; if (r.actStart) r.acts[n] = Date.now() - r.actStart; r.actStart = Date.now() }

  /* ── Derived ────────────────────────────────────────────────────────────── */
  const sfvi = useMemo(() => computeSfvi(s, scn), [s, scn])
  const exposure = useMemo(() => exposureSummary(s, scn), [s.orders, s.sealed, s.trust, s.falseAlarms, scn]) // eslint-disable-line react-hooks/exhaustive-deps
  const veto1 = sfvi.veto1
  const world = sfvi.world
  const situation = s.act === 3 ? 'REVIEW' : veto1 || s.act === 2 ? 'CRITICAL' : world.level >= sfvi.prepLevel ? 'HIGH' : 'ELEVATED'
  const act1Over = s.act === 1 && s.clock >= 0
  const act2Over = s.act === 2 && s.clock >= MISSION.act2EndMin

  /* Veto 1 announcement (once per run) */
  const vetoAnnounced = useRef(false)
  useEffect(() => {
    if (veto1 && s.act === 1 && !vetoAnnounced.current) {
      vetoAnnounced.current = true
      commit((p) => { const n = { ...p, logs: [...p.logs] }; log(n, 'crit', 'VETO RULE 1', `Ban Tham Pha Chom ${world.level.toFixed(2)} m ≥ ${THRESHOLDS.criticalLevel.toFixed(2)} m.`, 'ระดับน้ำถึงเกณฑ์วิกฤต — สั่งอพยพโซนเสี่ยงทันทีโดยไม่รอภาพยืนยัน'); return n })
    }
  }, [veto1, s.act, s.modeId, world.level, commit])

  /* ── Act 1 actions ──────────────────────────────────────────────────────── */
  const wrap = (fn, kind = null) => (...args) => {
    const before = sRef.current
    const after = commit((p, sc) => fn(p, sc, ...args))
    if (kind && after !== before) {
      fx.emit('action', { kind })                                             // chibi pose, sounds, effects
      const scene = sceneOf(kind, before, after, scnRef.current)
      if (scene) fx.emit('scene', scene)                                      // B7: boat / drone scene (ActionScene.jsx)
    }
    return after
  }
  const setCamp = useCallback(wrap(A.setCamp, 'camp'), [commit])
  const setTasking = useCallback(wrap(A.setTasking, 'tasking'), [commit])
  const submitAnalysis = useCallback(wrap(A.submitAnalysis, 'analysis'), [commit])
  const submitChannel = useCallback(wrap(A.submitChannel, 'channel'), [commit])
  const sealGaps = useCallback(wrap(A.sealGaps, 'seal'), [commit])
  const sealPlan = useCallback(wrap(A.sealPlan, 'seal'), [commit])

  /** Hint ladder: open the next rung of a topic (no game time) and log the request. */
  const revealHint = useCallback((topic, rung) => {
    const before = sRef.current
    const after = commit((p, sc) => A.revealHint(p, sc, topic, rung))
    if (after !== before) { logger.hint({ topic, rung, act: after.act, clock: after.clock }); fx.emit('action', { kind: 'hint' }) }
    return after !== before
  }, [commit])

  const toggleLayer = useCallback((id) => {
    const L = LAYERS.find((l) => l.id === id)
    commit((p) => {
      const on = !p.layers[id]
      const opened = on && !p.layersOpened.includes(id)
      if (opened) logger.layerOpened(id, p.act)
      return { ...p, layers: { ...p.layers, [id]: on }, layersOpened: opened ? [...p.layersOpened, id] : p.layersOpened }
    })
    return L
  }, [commit])

  /** Evacuation route zone → nearest open shelter: GISTDA Sphere Routing, else the offline router. */
  const routeZone = useCallback(async (zoneId) => {
    const sec = SECTION_BY_ID[zoneId], sc = scnRef.current
    const shelters = sc.shelters.map((id) => SHELTER_POOL.find((x) => x.id === id))
    const sh = shelters.reduce((m, x) => (metres(sec.c, [x.lon, x.lat]) < metres(sec.c, [m.lon, m.lat]) ? x : m))
    const from = sec.c, to = [sh.lon, sh.lat]
    let route = null, source = 'offline'
    if (sphereReady()) {
      try { route = await sphereRoute(from, to); source = 'sphere' } catch { route = null }
    }
    if (!route) {
      const r = routeOffline(from, to, (mid) => metres(mid, from) > 300 && isFloodedStreet(mid))
      if (r) route = { coords: r.coords, distanceM: r.distanceM, steps: r.steps }
    }
    if (route) commit((p) => ({ ...p, routes: { ...p.routes, [zoneId]: { coords: route.coords, distanceM: route.distanceM, steps: route.steps || [], source, shelter: sh.id } } }))
  }, [commit])

  const orderZones = useCallback((ids) => {
    const before = sRef.current
    const after = commit((p, sc) => A.orderZones(p, sc, ids))
    if (after !== before && after.decisions.length > before.decisions.length) {
      logger.decision(after.decisions[after.decisions.length - 1])
      fx.emit('action', { kind: 'evacuate' })
      ids.filter((id) => after.orders[id] !== undefined && before.orders[id] === undefined).forEach((id) => routeZone(id))
    }
  }, [commit, routeZone])

  /* ── Act 2 actions ──────────────────────────────────────────────────────── */
  const orderPass2 = useCallback(wrap(A.orderPass2, 'pass2'), [commit])
  const droneSortie = useCallback(wrap(A.droneSortie, 'drone'), [commit])
  const deployPump = useCallback(wrap(A.deployPump, 'pump'), [commit])
  const cutPower = useCallback(wrap(A.cutPower, 'power'), [commit])
  const buildTower = useCallback(wrap(A.buildTower, 'tower'), [commit])
  const salvageBoat = useCallback(wrap(A.salvageBoat, 'salvage'), [commit])
  /* Boat routes from the GISTDA Sphere Routing API, per trip (base · point · destination).
     status: loading → ok | error (Sphere did not answer) | off (no key / offline) */
  const boatRoutes = useRef(new Map())
  const [boatRouteVer, setBoatRouteVer] = useState(0)
  const tripKey = (p, pointId, mission, destId) => {
    const pt = p.points.find((x) => x.id === pointId)     // ids repeat across games — the position does not
    return `${p.seed}|${p.camp}|${pointId}@${pt ? `${pt.lon.toFixed(5)},${pt.lat.toFixed(5)}` : ''}|${mission === 'supply' ? 'camp' : destId}`
  }
  const boatRouteStatus = useCallback((pointId, mission, destId) => boatRoutes.current.get(tripKey(sRef.current, pointId, mission, destId))?.status || 'idle', [])
  const requestBoatRoutes = useCallback(async (pointId, mission, destId) => {
    const p = sRef.current, sc = scnRef.current
    const pt = p.points.find((x) => x.id === pointId)
    const camp = campOf(p)
    if (!pt || !camp) return
    const k = tripKey(p, pointId, mission, destId)
    const cur = boatRoutes.current.get(k)
    if (cur && cur.status !== 'error') return
    if (!sphereReady()) { boatRoutes.current.set(k, { status: 'off' }); setBoatRouteVer((v) => v + 1); return }
    boatRoutes.current.set(k, { status: 'loading' }); setBoatRouteVer((v) => v + 1)
    let legs = null
    try { legs = await fetchBoatLegs({ s: sRef.current, scn: sc, camp, point: pt, dest: mission === 'supply' ? null : destOf(destId) }) } catch { legs = null }
    boatRoutes.current.set(k, legs ? { status: 'ok', legs } : { status: 'error' })
    setBoatRouteVer((v) => v + 1)
  }, [])
  /** Candidate routes for a boat trip (Sphere options when they have arrived + the offline router), evaluated against the live state. */
  const planFor = useCallback((pointId, mission, destId) => {
    const p = sRef.current, sc = scnRef.current
    const pt = p.points.find((x) => x.id === pointId)
    if (!pt) return null
    const legs = boatRoutes.current.get(tripKey(p, pointId, mission, destId))?.legs || null
    return planTrip(p, sc, campOf(p), pt, mission === 'supply' ? null : destOf(destId), p.clock, legs)
  }, [])
  const dispatchBoat = useCallback(wrap(A.dispatchBoat, 'boat'), [commit])

  /* ── Act 3 actions ──────────────────────────────────────────────────────── */
  const reviewRoof = useCallback(wrap(A.reviewRoof, 'review'), [commit])
  const survey = useCallback(wrap(A.survey, 'survey'), [commit])
  const lockVerdict = useCallback((roofId) => { const next = commit((p, sc) => A.lockVerdict(p, sc, roofId)); logger.relief(reliefSummary(next, scnRef.current)); fx.emit('action', { kind: 'lock' }) }, [commit])
  const lockAll = useCallback(() => { const next = commit((p, sc) => A.lockAll(p, sc)); logger.relief(reliefSummary(next, scnRef.current)) }, [commit])
  const revealRelief = useCallback(() => commit((p, sc) => A.revealRelief(p, sc)), [commit])
  const adjudicate = useCallback((roofId, verdict) => {
    const next = commit((p, sc) => A.adjudicate(p, sc, roofId, verdict))
    logger.relief(reliefSummary(next, scnRef.current))
    fx.emit('action', { kind: 'verdict' })
  }, [commit])

  /* ── T0 crisis night (E) ─────────────────────────────────────────────────── */
  const finishBoss = useCallback((battle) => {
    const next = commit((p, sc) => (p.boss?.done ? p : applyBoss(p, sc, battle, { fought: true })))
    logger.meta({ boss: { won: next.boss.won, fought: true, turns: next.boss.turns } })
  }, [commit])
  /** Officer mode / a skipped fight: the result follows from the preparation alone. */
  const autoBoss = useCallback(() => {
    const next = commit((p, sc) => resolveBoss(p, sc))
    logger.meta({ boss: { won: next.boss.won, fought: false, turns: 0 } })
  }, [commit])

  /* ── Flow ───────────────────────────────────────────────────────────────── */
  const goAct2 = useCallback(() => {
    markAct(1)
    commit((p, sc) => enterAct2(p, sc))
  }, [commit])
  const goAct3 = useCallback(() => {
    const p = sRef.current
    const pts = p.points
    const inc = p.incidents || []
    logger.triage({ hits: pts.reduce((a, x) => a + x.rescued, 0), lost: pts.reduce((a, x) => a + x.lost, 0), routeErrors: p.routeErrors,
      capsize: inc.filter((x) => x.kind === 'capsize').length, shock: inc.filter((x) => x.kind === 'shock').length })
    markAct(2)
    commit((q) => enterAct3(q))
  }, [commit])
  const start = useCallback(() => { if (!real.current.start) { real.current.start = Date.now(); real.current.actStart = Date.now() } }, [])
  const ackVeto = useCallback(() => commit((p) => ({ ...p, vetoAck: true })), [commit])
  const finishMission = useCallback(() => {
    if (!real.current.acts[3]) { markAct(3); real.current.end = Date.now() }
    commit((p) => ({ ...p, act3Done: true }))
  }, [commit])

  const newGame = useCallback((modeId = sRef.current.modeId, seed = FIXED_SEED || newSeed(), stress = sRef.current.stress) => {
    vetoAnnounced.current = false
    real.current = { start: null, actStart: null, acts: {} }
    commit((p) => ({ ...makeInitial(modeId, seed, stress), resetSeq: (p.resetSeq || 0) + 1 }))
  }, [commit])
  const untouched = () => sRef.current.act === 1 && sRef.current.clock <= sRef.current.t0
  const setMode = useCallback((modeId) => {
    if (!untouched()) return newGame(modeId)
    commit((p) => ({ ...makeInitial(modeId, p.seed, p.stress), resetSeq: p.resetSeq }))
  }, [commit, newGame]) // eslint-disable-line react-hooks/exhaustive-deps
  /** Stress Test conditions chosen by the teacher (title screen) — same seed, so the effect is comparable. */
  const setStress = useCallback((list) => {
    if (!untouched()) return newGame(sRef.current.modeId, sRef.current.seed, list)
    commit((p) => ({ ...makeInitial(p.modeId, p.seed, list), resetSeq: p.resetSeq }))
  }, [commit, newGame]) // eslint-disable-line react-hooks/exhaustive-deps

  /* recorder hook: lets record-*.mjs read the answers it needs to play a clean run */
  useEffect(() => {
    if (!REC) return
    window.__maesai = {
      get s() { return sRef.current },
      get scn() { return scnRef.current },
      planFor,
      boatRouteStatus,
      advance,
      get busy() { return busy.current },
      gapCount: EMBANKMENT_GAPS.length,
      /** zones too deep along the least-bad route (what a pump would open) */
      deepAlong: (pointId, mission, destId) => {
        const plan = planFor(pointId, mission, destId)
        if (!plan?.options.length) return []
        const o = plan.options.reduce((m, x) => (x.hazards.length < m.hazards.length || (x.hazards.length === m.hazards.length && x.distanceM < m.distanceM) ? x : m))
        const p = sRef.current, out = new Set()
        for (const c of o.coords) { const sec = sectionAt(c); if (sec && depthAt(p, sec, p.clock) >= ACT2.deepWaterM) out.add(sec.id) }
        return [...out]
      },
      wetZones: () => SECTIONS.filter((z) => peakDepth(sRef.current, z) >= HARM_M).map((z) => z.id),
      orderAt: () => {
        const wet = SECTIONS.filter((z) => peakDepth(sRef.current, z) >= HARM_M)
        return wet.length ? Math.min(...wet.map((z) => arrivalAt(sRef.current, z) - evacNeedMin(z))) - 60 : 0
      },
    }
  }, [planFor, advance])

  return {
    s, scn, mode, sfvi, world, veto1, situation, exposure, cut, advance, skipCut, realMs, realActs: real.current.acts, start, flash, toast,
    act1Over, act2Over, finishBoss, autoBoss,
    setCamp, setTasking, submitAnalysis, submitChannel, sealGaps, sealPlan, orderZones, toggleLayer, routeZone, revealHint,
    orderPass2, droneSortie, deployPump, cutPower, buildTower, salvageBoat, planFor, dispatchBoat, requestBoatRoutes, boatRouteStatus, boatRouteVer,
    reviewRoof, survey, adjudicate, lockVerdict, lockAll, revealRelief,
    goAct2, goAct3, ackVeto, finishMission, newGame, setMode, setStress,
  }
}
