/* ══════════════════════════════════════════════════════════════════════════
   GAME ENGINE HOOK — the mission clock runs in real time
   องก์ 1 (48 ชม.) ≈ 7.5 นาที · องก์ 2 (36 ชม.) ≈ 6 นาที · องก์ 3 นับวันจากการกระทำ
   Every action is a pure transition (engine/actions.js); time is engine/world.js.
   All writes go through commit(fn) so no callback ever acts on a stale snapshot.
   ══════════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { PACE, MODES, MISSION, THRESHOLDS } from '../config/missionConfig'
import { LAYERS, SHELTER_POOL } from '../config/scenarioData'
import { makeScenario } from '../lib/scenario'
import { computeSfvi, exposureSummary, reliefSummary, peakDepth, arrivalAt, evacNeedMin, HARM_M } from '../lib/sim'
import { planTrip } from '../lib/routes'
import { routeOffline, metres, isFloodedStreet } from '../lib/geo'
import { sphereRoute, sphereReady } from '../lib/sphere'
import { SECTIONS, SECTION_BY_ID } from '../lib/sections'
import { EMBANKMENT_GAPS } from '../lib/embankment'
import { newSeed } from '../lib/rng'
import { logger } from '../lib/evalLogger'
import { makeInitial, advanceTo, enterAct2, enterAct3, log, campOf, destOf } from './world'
import * as A from './actions'

const URLQ = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
const SPEED = Math.max(1, Number(URLQ.get('speed')) || 1)          // test/recording accelerator only
const FIXED_SEED = Number(URLQ.get('seed')) || null
const REC = URLQ.has('rec')                                         // recorder hook (record-*.mjs) — never on in normal play

export function useEngine() {
  const [s, setS] = useState(() => makeInitial(URLQ.get('mode') === 'expert' ? 'expert' : 'beginner', FIXED_SEED || newSeed()))
  const [running, setRunningRaw] = useState(false)
  const [flash, setFlash] = useState(null)
  const sRef = useRef(s)
  const scn = useMemo(() => makeScenario(s.seed, s.modeId), [s.seed, s.modeId])
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

  /* ── Clock ──────────────────────────────────────────────────────────────── */
  const atEnd = (p) => (p.act === 1 && p.clock >= 0) || (p.act === 2 && p.clock >= MISSION.act2EndMin) || p.act === 3
  const setRunning = useCallback((v) => {
    const next = typeof v === 'function' ? v(running) : v
    if (!next && !MODES[sRef.current.modeId].pause && !atEnd(sRef.current)) return   // expert: no pausing the flood
    setRunningRaw(next)
  }, [running])
  const forceStop = useCallback(() => setRunningRaw(false), [])

  useEffect(() => {
    if (!running || s.act === 3) return
    const id = setInterval(() => {
      const p = sRef.current
      if (atEnd(p)) { setRunningRaw(false); return }
      const pace = p.act === 1 ? PACE.act1MinPerSec : PACE.act2MinPerSec
      commit((q, sc) => advanceTo(q, sc, q.clock + (pace * SPEED * PACE.tickMs) / 1000))
      if (atEnd(sRef.current)) setRunningRaw(false)
    }, PACE.tickMs)
    return () => clearInterval(id)
  }, [running, s.act, commit])

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
      if (MODES[s.modeId].pause) setRunningRaw(false)
      commit((p) => { const n = { ...p, logs: [...p.logs] }; log(n, 'crit', 'VETO RULE 1', `Ban Tham Pha Chom ${world.level.toFixed(2)} m ≥ ${THRESHOLDS.criticalLevel.toFixed(2)} m.`, 'ระดับน้ำถึงเกณฑ์วิกฤต — สั่งอพยพโซนเสี่ยงทันทีโดยไม่รอภาพยืนยัน'); return n })
    }
  }, [veto1, s.act, s.modeId, world.level, commit])

  /* ── Act 1 actions ──────────────────────────────────────────────────────── */
  const wrap = (fn) => (...args) => commit((p, sc) => fn(p, sc, ...args))
  const setCamp = useCallback(wrap(A.setCamp), [commit])
  const setTasking = useCallback(wrap(A.setTasking), [commit])
  const submitAnalysis = useCallback(wrap(A.submitAnalysis), [commit])
  const submitChannel = useCallback(wrap(A.submitChannel), [commit])
  const sealGaps = useCallback(wrap(A.sealGaps), [commit])

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
      ids.filter((id) => after.orders[id] !== undefined && before.orders[id] === undefined).forEach((id) => routeZone(id))
    }
  }, [commit, routeZone])

  /* ── Act 2 actions ──────────────────────────────────────────────────────── */
  const orderPass2 = useCallback(wrap(A.orderPass2), [commit])
  const droneSortie = useCallback(wrap(A.droneSortie), [commit])
  const deployPump = useCallback(wrap(A.deployPump), [commit])
  const cutPower = useCallback(wrap(A.cutPower), [commit])
  const buildTower = useCallback(wrap(A.buildTower), [commit])
  /** Candidate routes for a boat trip, evaluated against the live state. */
  const planFor = useCallback((pointId, mission, destId) => {
    const p = sRef.current, sc = scnRef.current
    const pt = p.points.find((x) => x.id === pointId)
    if (!pt) return null
    return planTrip(p, sc, campOf(p), pt, mission === 'supply' ? null : destOf(destId), p.clock)
  }, [])
  const dispatchBoat = useCallback(wrap(A.dispatchBoat), [commit])

  /* ── Act 3 actions ──────────────────────────────────────────────────────── */
  const reviewRoof = useCallback(wrap(A.reviewRoof), [commit])
  const survey = useCallback(wrap(A.survey), [commit])
  const adjudicate = useCallback((roofId, verdict) => {
    const next = commit((p, sc) => A.adjudicate(p, sc, roofId, verdict))
    logger.relief(reliefSummary(next, scnRef.current))
  }, [commit])

  /* ── Flow ───────────────────────────────────────────────────────────────── */
  const goAct2 = useCallback(() => {
    commit((p, sc) => enterAct2(p, sc))
    setRunningRaw(true)
  }, [commit])
  const goAct3 = useCallback(() => {
    const p = sRef.current
    const pts = p.points
    logger.triage({ hits: pts.reduce((a, x) => a + x.rescued, 0), lost: pts.reduce((a, x) => a + x.lost, 0), routeErrors: p.routeErrors })
    commit((q) => enterAct3(q))
    setRunningRaw(false)
  }, [commit])
  const start = useCallback(() => setRunningRaw(true), [])
  const ackVeto = useCallback(() => {          // Beginner pauses on the alert — reading it resumes the clock
    commit((p) => ({ ...p, vetoAck: true }))
    if (!atEnd(sRef.current)) setRunningRaw(true)
  }, [commit])
  const finishMission = useCallback(() => commit((p) => ({ ...p, act3Done: true })), [commit])

  const newGame = useCallback((modeId = sRef.current.modeId, seed = FIXED_SEED || newSeed()) => {
    vetoAnnounced.current = false
    setRunningRaw(false)
    commit((p) => ({ ...makeInitial(modeId, seed), resetSeq: (p.resetSeq || 0) + 1 }))
  }, [commit])
  const setMode = useCallback((modeId) => {
    if (sRef.current.act !== 1 || sRef.current.clock > -48 * 60) return newGame(modeId)
    commit((p) => ({ ...makeInitial(modeId, p.seed), resetSeq: p.resetSeq }))
  }, [commit, newGame])

  /* recorder hook: lets record-*.mjs read the answers it needs to play a clean run */
  useEffect(() => {
    if (!REC) return
    window.__maesai = {
      get s() { return sRef.current },
      get scn() { return scnRef.current },
      planFor,
      run: (v) => setRunningRaw(v),
      gapCount: EMBANKMENT_GAPS.length,
      wetZones: () => SECTIONS.filter((z) => peakDepth(sRef.current, z) >= HARM_M).map((z) => z.id),
      orderAt: () => {
        const wet = SECTIONS.filter((z) => peakDepth(sRef.current, z) >= HARM_M)
        return wet.length ? Math.min(...wet.map((z) => arrivalAt(sRef.current, z) - evacNeedMin(z))) - 60 : 0
      },
    }
  }, [planFor])

  return {
    s, scn, mode, sfvi, world, veto1, situation, exposure, running, setRunning, forceStop, start, flash, toast,
    act1Over, act2Over,
    setCamp, setTasking, submitAnalysis, submitChannel, sealGaps, orderZones, toggleLayer, routeZone,
    orderPass2, droneSortie, deployPump, cutPower, buildTower, planFor, dispatchBoat,
    reviewRoof, survey, adjudicate,
    goAct2, goAct3, ackVeto, finishMission, newGame, setMode,
  }
}
