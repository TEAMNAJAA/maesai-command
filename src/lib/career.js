/* ══════════════════════════════════════════════════════════════════════════
   CAREER (A1–A4) — ยศผู้บัญชาการ · เหรียญตรา · ปลดล็อก · แฟ้มประวัติต่อชื่อผู้เล่น
   • ยศเลื่อนตามแต้มสะสม (คะแนนภารกิจ v2 ที่กดบันทึก) · เหรียญผูกกับพฤติกรรมที่อยากสอน (ฟังก์ชันล้วน)
   • ปลดล็อก Expert / Stress Test ทีละเงื่อนไขตามยศ — ครูปลดล็อกทั้งหมดได้ (prefs.unlockAll) · URL param ใช้ได้เสมอ
   • เก็บใน localStorage ของเครื่องนี้ (ชื่อเล่น + ผลแต่ละรอบ) — ไม่มีรูป ไม่มีข้อมูลส่วนตัวอื่น
   ══════════════════════════════════════════════════════════════════════════ */

import { useSyncExternalStore } from 'react'
import { CAREER, TIME, MODES } from '../config/missionConfig'
import { hintPenalty, scarStats, reliefSummary, missionScore } from './sim'

const KEY = 'maesai-command.career.v1'
const norm = (name) => (name || '').trim().toLowerCase()

/* ── A2 · medals: each one is a habit worth learning ── */
export const MEDALS = [
  { id: 'trust', th: 'ไม่เตือนผิดเลย', desc: 'สั่งอพยพเมื่อหลักฐานพอเท่านั้น — ไม่มีการเตือนผิดตลอดภารกิจ', icon: 'HeartHandshake',
    test: ({ s }) => s.falseAlarms === 0 && Object.keys(s.orders).length > 0 },
  { id: 'found', th: 'พบผู้ติดค้างครบทุกจุด', desc: 'ใช้ THEOS-2 · โดรน · เสาสื่อสาร จนพบทุกกลุ่มที่ติดค้าง', icon: 'Search',
    test: ({ s }) => s.points.length > 0 && s.trips > 0 && s.points.every((p) => p.revealed) },
  { id: 'nohint', th: 'ไม่ใช้คำใบ้', desc: 'จบภารกิจโหมดผู้เริ่มต้นโดยไม่เปิดคำใบ้ขั้นที่ 2–3', icon: 'Brain',
    test: ({ s, scn }) => !!MODES[s.modeId]?.tutor && hintPenalty(s).pts === 0 && !missionScore(s, scn).decision.failed },
  { id: 'swift', th: 'จบในราว 7 นาที', desc: `เล่นจบ 3 องก์ในเวลาจริงไม่เกิน ${TIME.expertTargetSec / 60} นาที`, icon: 'Timer',
    test: ({ realSec }) => realSec > 0 && realSec <= TIME.expertTargetSec },
  { id: 'power', th: 'ตัดไฟก่อนส่งเรือทุกครั้ง', desc: 'มีไฟรั่วในเมือง และไม่มีเรือลำไหนผ่านโซนไฟรั่ว', icon: 'Zap',
    test: ({ s }) => (s.hazardsLive || []).length > 0 && s.trips > 0 && !(s.routeLog || []).some((r) => (r.hazards || []).includes('power')) },
  { id: 'reader', th: 'แปลภาพไม่ผิดเลย', desc: 'ระบุรอยดินถล่มใหม่โดยไม่หลงนา เงาเมฆ หรือรอยเก่าเลยสักจุด', icon: 'ScanSearch',
    test: ({ s, scn }) => { const st = scarStats(s, scn); return st.labelled > 0 && st.fp === 0 } },
  { id: 'wall', th: 'ตลิ่งรับยอดน้ำ', desc: 'ชนะ "มวลน้ำ" ในคืนวิกฤต T0', icon: 'ShieldCheck',
    test: ({ s }) => !!s.boss?.won },
  { id: 'fair', th: 'เยียวยาถูกทุกหลัง', desc: 'ตัดสินเงินเยียวยาถูกทั้ง 8 หลัง — ไม่จ่ายเกิน ไม่ตัดสิทธิ์ผิด', icon: 'Scale',
    test: ({ s, scn }) => { const r = reliefSummary(s, scn); return r.done === r.total && r.correct === r.total } },
]

/** Medals earned in this mission (ids). */
export function medalsFor(s, scn, { realSec = 0 } = {}) {
  return MEDALS.filter((m) => { try { return m.test({ s, scn, realSec }) } catch { return false } }).map((m) => m.id)
}

/* ── A1 · ranks from cumulative points ── */
export function rankFor(total) {
  const ranks = CAREER.ranks
  let i = 0
  for (let k = 0; k < ranks.length; k++) if (total >= ranks[k].min) i = k
  const next = ranks[i + 1] || null
  return { ...ranks[i], index: i, next, toNext: next ? next.min - total : 0, progress: next ? (total - ranks[i].min) / (next.min - ranks[i].min) : 1 }
}

/* ── A4 · the commander's file, per player name ── */
let memory = {}
try { memory = JSON.parse(localStorage.getItem(KEY) || '{}') } catch { /* private window */ }
const subs = new Set()
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(memory)) } catch { /* ignore */ } subs.forEach((f) => f()) }

export function fileOf(name) {
  const rec = memory[norm(name)]
  const runs = rec?.runs || []
  const total = runs.reduce((a, r) => a + (r.points || 0), 0)
  const medals = [...new Set(runs.flatMap((r) => r.medals || []))]
  const best = runs.reduce((m, r) => Math.max(m, r.points || 0), 0)
  return { name: rec?.name || (name || '').trim(), runs, total, best, medals, rank: rankFor(total), count: runs.length }
}

/** Add a finished mission. Returns { before, after, newMedals, rankUp }. */
export function recordRun(name, run) {
  const key = norm(name)
  if (!key) return null
  const before = fileOf(name)
  memory = { ...memory, [key]: { name: name.trim(), runs: [...(memory[key]?.runs || []), { ...run, at: run.at || new Date().toISOString() }].slice(-200) } }
  save()
  const after = fileOf(name)
  return { before, after, newMedals: (run.medals || []).filter((m) => !before.medals.includes(m)), rankUp: after.rank.index > before.rank.index ? after.rank : null }
}

export const career = { fileOf, recordRun, subscribe: (f) => { subs.add(f); return () => subs.delete(f) }, clear: (name) => { const k = norm(name); if (memory[k]) { const { [k]: _, ...rest } = memory; memory = rest; save() } } }
let ver = 0
const bump = () => { ver++ }
subs.add(bump)
export const useCareer = (name) => { useSyncExternalStore(career.subscribe, () => ver, () => ver); return fileOf(name) }

/* ── A3 · what the rank opens: Expert, then the Stress Test conditions one by one ── */
export function unlocked(rankIndex, unlockAll = false) {
  const need = CAREER.unlocks
  const ok = (k) => unlockAll || rankIndex >= (need[k] ?? 0)
  return { expert: ok('expert'), stress: Object.fromEntries(Object.keys(need).filter((k) => k.startsWith('stress:')).map((k) => [k.slice(7), ok(k)])) }
}
