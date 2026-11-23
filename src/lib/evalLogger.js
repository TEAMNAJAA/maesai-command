/* ══════════════════════════════════════════════════════════════════════════
   AUTOMATED EVALUATION LOGGER — ระบบบันทึกพฤติกรรมผู้เล่นสำหรับ Sandbox Test
   เก็บทุกรอบการเล่นไว้ใน localStorage ของเครื่อง (บูธ/ห้องเรียนเครื่องเดียวเล่นหลายคน)
   แล้วส่งออก CSV ไปวิเคราะห์สถิติ (Paired t-test, % ผ่านเกณฑ์) ในรายงาน Final Package
   ══════════════════════════════════════════════════════════════════════════ */

import { EVAL, HINTS } from '../config/missionConfig'

const KEY = EVAL.storageKey
let memory = { sessions: [] }      // fallback when storage is blocked (private window, file:// policy)
let current = null
let stored = false  // a session is only written once it holds real data
let writable = true // the last write reached localStorage (false = quota full or storage blocked)
const now = () => Date.now()
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())
const byStart = (a, b) => String(a.startedAt).localeCompare(String(b.startedAt))

function readDisk() {
  try {
    const raw = localStorage.getItem(KEY)
    const d = raw ? JSON.parse(raw) : null
    return d && Array.isArray(d.sessions) ? d : null
  } catch { return null }  // storage unavailable or corrupt — keep the in-memory copy
}
function load() {
  memory = readDisk() || { sessions: [] }
  return memory
}
/** Fold in what another tab (or another copy of the page) wrote since we loaded — a booth or classroom
    machine often has the game open twice, and a plain write would wipe the other tab's players.
    Our own run in progress is newer in memory; every other run is newer on disk. */
function sync() {
  const disk = readDisk()
  if (!disk) return
  if ((disk.clearedAt || 0) > (memory.clearedAt || 0)) {   // the teacher cleared the log in another tab
    memory.sessions = memory.sessions.filter((x) => x === current)
    memory.clearedAt = disk.clearedAt
  }
  const byId = new Map(memory.sessions.map((x) => [x.id, x]))
  for (const x of disk.sessions) {
    if (!x || !x.id || (current && x.id === current.id)) continue
    byId.set(x.id, x)
  }
  memory.sessions = [...byId.values()].sort(byStart)
}
function write() {
  try { localStorage.setItem(KEY, JSON.stringify(memory)); writable = true } catch { writable = false }
}
function save() {
  if (current && !stored) { memory.sessions.push(current); stored = true }
  sync()
  write()
}

load()            // once only — `current` stays the object inside `memory`; sync() never replaces it

/** A fresh session record (also used when the teacher clears the log mid-run, so this run keeps logging). */
function blank({ hintsEnabled, demo = false, stress = [], seed = null, mode = null, officer = false }) {
  return {
    id: `S${new Date().toISOString().replace(/\D/g, '').slice(2, 14)}-${Math.random().toString(36).slice(2, 5)}`,
    startedAt: new Date().toISOString(),
    player: '',
    hintsEnabled,
    demo,             // presentation / recording run — excluded from Sandbox statistics
    stress,           // Stress Test conditions chosen by the teacher
    seed, mode,
    officer,          // F4 officer-training mode (no chibi / boss fight / music / comic effects)
    briefingMs: null,
    pre: null, post: null,
    actMs: { 1: 0, 2: 0, 3: 0 },
    layersOpened: [],
    hints: [],        // hint-ladder rungs the player asked for (rung 2 = pointer, rung 3 = partial answer)
    rounds: [],
    triage: null,
    relief: null,
    result: null,
    _t0: now(), _act: null, _actAt: null, _roundAt: null,
  }
}
if (typeof window !== 'undefined') {
  // the teacher panel follows players logged in another tab
  window.addEventListener('storage', (e) => { if (e.key === KEY) { sync(); emit() } })
}

export const logger = {
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },

  /** Begin a new player session (called when the briefing opens). */
  start(opts) {
    stored = false
    current = blank(opts)
    emit()
    return current.id
  },
  get current() { return current },
  /** Mode / seed / Stress Test changed on the title screen before play — keep the session in step. */
  meta(fields) { if (current) { Object.assign(current, fields); if (stored) save() } },
  setPlayer(label) { if (current) { current.player = String(label || '').slice(0, 40); save() } },

  briefingDone() {
    if (!current || current.briefingMs !== null) return
    current.briefingMs = now() - current._t0
    current._roundAt = now()
    save(); emit()
  },

  quiz(kind, answers, score, total) {
    if (!current) return
    current[kind] = { score, total, answers, at: new Date().toISOString() }
    save(); emit()
  },

  enterAct(n) {
    if (!current) return
    const t = now()
    if (current._act) current.actMs[current._act] += t - current._actAt
    current._act = n; current._actAt = t
    if (stored) save()
  },

  layerOpened(id, act) {
    if (!current || current.layersOpened.some((l) => l.id === id)) return
    current.layersOpened.push({ id, act, at: now() - current._t0 })
    save()
  },

  /** Hint ladder: the player asked for rung 2 (pointer) or 3 (partial answer) of a topic. */
  hint({ topic, rung, act, clock }) {
    if (!current) return
    if (!current.hints) current.hints = []
    current.hints.push({ topic, rung, act, clock, at: now() - current._t0 })
    save(); emit()
  },

  /** One decision round: EVACUATE / STANDBY / HOLD / TACTICAL_EVAC … */
  decision(r) {
    if (!current) return
    const t = now()
    current.rounds.push({ n: current.rounds.length + 1, ...r, roundSec: Math.round((t - (current._roundAt ?? current._t0)) / 1000) })
    current._roundAt = t
    save(); emit()
  },

  triage(t) { if (current) { current.triage = t; save(); emit() } },
  relief(r) { if (current) { current.relief = r; save() } },

  /** End of the run (score saved) — called again after the post-test: later calls merge, they never drop the metrics. */
  finish(result) {
    if (!current) return
    this.enterAct(current._act)
    const prev = current.result || {}
    current.result = { ...prev, ...result, metrics: result.metrics || prev.metrics, totalSec: prev.totalSec ?? Math.round((now() - current._t0) / 1000), at: prev.at || new Date().toISOString() }
    save(); emit()
  },

  sessions() { sync(); return memory.sessions },
  /** false when the last write did not reach localStorage — the teacher should export before closing. */
  get persisted() { return writable },

  /** Wipe every stored session (teacher). The run in progress keeps logging from now on: a teacher
      typically clears the test data at the title screen, right before the first student plays. */
  clear() {
    memory = { sessions: [], clearedAt: now() }
    stored = false
    if (current) {
      const { hintsEnabled, demo, stress, seed, mode, officer, _act } = current
      current = { ...blank({ hintsEnabled, demo, stress, seed, mode, officer }), _act, _actAt: _act ? now() : null }
    }
    write(); emit()
  },

  /** Sandbox Test pass criteria computed across every stored session. */
  summary() {
    sync()
    const real = memory.sessions.filter((s) => !s.demo)
    const ss = real.filter((s) => s.rounds.length > 0)
    const firstLayers = ss.map((s) => (s.rounds.find((r) => r.kind !== 'HOLD') || s.rounds[0]).layersOpened ?? 0)
    const passLayers = firstLayers.filter((n) => n >= EVAL.minLayersBeforeDecision).length
    const paired = real.filter((s) => s.pre && s.post)
    const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
    const pre = avg(paired.map((s) => s.pre.score)), post = avg(paired.map((s) => s.post.score))
    const briefing = avg(ss.filter((s) => s.briefingMs !== null).map((s) => s.briefingMs / 60000))
    return {
      sessions: real.length,
      demo: memory.sessions.length - real.length,
      played: ss.length,
      layerShare: ss.length ? passLayers / ss.length : null,
      layerPass: ss.length ? passLayers / ss.length >= EVAL.passShare : null,
      paired: paired.length, pre, post,
      gain: pre && post !== null ? (post - pre) / pre : null,
      gainPass: pre && post !== null ? (post - pre) / pre >= EVAL.postTestGainTarget : null,
      briefingMin: briefing,
      briefingPass: briefing !== null ? briefing < EVAL.briefingTargetMin : null,
      avgRoundSec: avg(ss.flatMap((s) => s.rounds.map((r) => r.roundSec))),
      avgDeepHints: avg(ss.filter((s) => s.hintsEnabled).map((s) => (s.hints || []).length)),
    }
  },

  sessionsCSV() {
    sync()
    const head = ['session_id', 'player', 'started_at', 'demo', 'hints', 'briefing_min', 'pre_score', 'post_score', 'gain_pct',
      'act1_sec', 'act2_sec', 'act3_sec', 'layers_opened_total', 'layers_before_first_decision', 'decisions',
      'first_decision', 'first_decision_clock', 'evacuated_communities', 'triage_hits', 'relief_correct',
      'final_trust', 'mission_score', 'households_exposed', 'total_sec',
      'hints_pointer', 'hints_partial', 'hint_penalty_pts', 'hint_topics', 'stress', 'seed', 'mode',
      'score_version', 'decision_tier', 'decision_ratio', 'points', 'boat_capsize', 'boat_shock', 'boss_won', 'boss_fought', 'boss_turns', 'officer', 'act_grades', 'medals']
    const rows = memory.sessions.map((s) => {
      const first = s.rounds.find((r) => r.kind !== 'HOLD')
      const gain = s.pre && s.post && s.pre.score ? ((s.post.score - s.pre.score) / s.pre.score) * 100 : ''
      return [s.id, s.player, s.startedAt, s.demo ? 1 : 0, s.hintsEnabled ? 1 : 0, s.briefingMs !== null ? (s.briefingMs / 60000).toFixed(2) : '',
        s.pre?.score ?? '', s.post?.score ?? '', gain === '' ? '' : gain.toFixed(1),
        Math.round(s.actMs[1] / 1000), Math.round(s.actMs[2] / 1000), Math.round(s.actMs[3] / 1000),
        s.layersOpened.length, first?.layersOpened ?? '', s.rounds.length,
        first?.kind ?? '', first?.clockLabel ?? '', first?.communities?.join(' ') ?? '',
        s.triage?.hits ?? '', s.relief?.correct ?? '',
        s.result?.trust ?? '', s.result?.score ?? '', s.result?.exposed ?? '', s.result?.totalSec ?? '',
        ...hintCols(s), (s.stress || []).join(' '), s.seed ?? '', s.mode ?? '',
        s.result?.scoreVersion ?? (s.result?.score !== undefined && s.result?.score !== null ? 1 : ''), s.result?.decisionTier ?? '', s.result?.decisionRatio ?? '', s.result?.points ?? '',
        s.triage?.capsize ?? '', s.triage?.shock ?? '', s.boss ? (s.boss.won ? 1 : 0) : '', s.boss ? (s.boss.fought ? 1 : 0) : '', s.boss?.turns ?? '', s.officer ? 1 : 0, s.result?.grades ?? '', s.result?.medals ?? '']
    })
    return toCSV([head, ...rows])
  },

  /** One row per hint request — when, in which act, on which topic, how deep. */
  hintsCSV() {
    sync()
    const head = ['session_id', 'player', 'act', 'clock_min', 'topic', 'rung', 'rung_kind', 'sec_from_start']
    const rows = []
    for (const s of memory.sessions) for (const h of s.hints || []) {
      rows.push([s.id, s.player, h.act, h.clock, h.topic, h.rung, h.rung === 2 ? 'pointer' : 'partial', Math.round(h.at / 1000)])
    }
    return toCSV([head, ...rows])
  },

  roundsCSV() {
    sync()
    const head = ['session_id', 'player', 'round', 'act', 'kind', 'clock', 'event_time', 'round_sec', 'water_m', 'sfvi',
      'confidence', 'justified', 'layers_opened', 'layers_active', 'swaths_tasked', 'communities_ordered',
      'sfvi_recommended', 'match_sfvi', 'outcome', 'trust_after', 'channel_measured', 'gaps_sealed']
    const rows = []
    for (const s of memory.sessions) for (const r of s.rounds) {
      rows.push([s.id, s.player, r.n, r.act, r.kind, r.clockLabel, r.eventTime, r.roundSec, r.water, r.sfvi,
        r.confidence, r.justified ? 1 : 0, r.layersOpened, r.layersActive, r.swaths,
        (r.communities || []).join(' '), (r.recommended || []).join(' '), r.matchSfvi ?? '', r.outcome ?? '', r.trustAfter ?? '',
        r.channelMeasured === undefined ? '' : r.channelMeasured ? 1 : 0, r.gapsSealed ?? ''])
    }
    return toCSV([head, ...rows])
  },
}

/** Hint columns of the sessions CSV (penalty mirrors sim.hintPenalty). */
function hintCols(s) {
  const hs = s.hints || []
  const top = {}
  for (const h of hs) top[h.topic] = Math.max(top[h.topic] || 1, h.rung)
  let pts = 0
  for (const r of Object.values(top)) for (let k = 2; k <= r; k++) pts += HINTS.cost[k] || 0
  return [hs.filter((h) => h.rung === 2).length, hs.filter((h) => h.rung === 3).length, Math.min(HINTS.maxPenalty, pts), Object.keys(top).join(' ')]
}

/** One CSV cell. A player name such as =HYPERLINK(…) or +cmd would run as a formula when the teacher
    opens the file in Excel / Sheets — text that starts with = + - @ tab or CR gets a leading ' (numbers stay numbers). */
export function csvCell(c) {
  let v = String(c ?? '')
  if (v && '=+-@\t\r'.includes(v[0]) && !Number.isFinite(Number(v))) v = `'${v}`
  return `"${v.replace(/"/g, '""')}"`
}
function toCSV(rows) {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\n')
}

export function downloadText(text, filename, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
