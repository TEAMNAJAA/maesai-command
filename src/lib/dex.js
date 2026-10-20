/* ══════════════════════════════════════════════════════════════════════════
   KNOWLEDGE DEX (D1) — สมุดสะสมการ์ดความรู้ ปลดล็อกเมื่อเจอในเกมจริง
   dexUnlocks(s, scn) ฟังก์ชันล้วน: อ่าน state ว่าผู้เล่นได้พบเรื่องไหนแล้ว · สะสมในเครื่องนี้ (localStorage)
   เนื้อหาการ์ดอยู่ใน KNOWLEDGE (scenarioData.js)
   ══════════════════════════════════════════════════════════════════════════ */

import { useSyncExternalStore } from 'react'
import { KNOWLEDGE } from '../config/scenarioData'

const KEY = 'maesai-command.dex.v1'

/** Which cards this game has shown the player so far — only things that actually happened on screen. */
export function dexUnlocks(s, scn) {
  const got = new Set()
  const add = (id, ok) => { if (ok) got.add(id) }
  const ready = s.images.filter((i) => i.usable && i.readyAt <= s.clock)
  const read = ready.filter((i) => i.analyzed && i.target !== 'TOWN')
  const seen = (kind) => read.some((i) => scn.scenes[i.target]?.cands.some((c) => c.kind === kind))
  add('theos2', s.images.length > 0)
  add('l3ortho', ready.length > 0)
  add('landslide', read.some((i) => scn.scenes[i.target]?.cands.some((c) => c.kind === 'scar' && i.labels[c.id] === 'scar')))
  add('cloudshadow', seen('shadow'))
  add('oldscar', seen('old'))
  add('channel', !!s.channel.measured)
  add('sfvi', (s.decisions || []).some((d) => d.kind === 'EVACUATE') || s.act >= 2)
  add('embankment', !!s.sealPlan || s.sealed.length > 0)
  add('radarsat', s.act >= 2)
  add('drone', (s.jobs || []).some((j) => j.kind === 'drone') || (s.points || []).some((p) => p.revealed === 'drone'))
  add('power', (s.hazardsLive || []).length > 0 || (s.incidents || []).some((x) => x.kind === 'shock'))
  add('current', (s.incidents || []).some((x) => x.kind === 'capsize') || (s.routeLog || []).some((r) => (r.hazards || []).some((h) => h !== 'power')))
  add('sphere', (s.trips || 0) > 0)
  add('relief', Object.keys(s.locked || {}).length > 0)
  return KNOWLEDGE.filter((k) => got.has(k.id)).map((k) => k.id)
}

let memory = {}
try { memory = JSON.parse(localStorage.getItem(KEY) || '{}') } catch { /* private window */ }
const subs = new Set()
let ver = 0
const emit = () => { ver++; subs.forEach((f) => f()) }

export const dex = {
  has: (id) => !!memory[id],
  all: () => memory,
  /** Mark cards as found; returns the ones that are new on this machine. */
  see(ids) {
    const fresh = ids.filter((id) => !memory[id])
    if (!fresh.length) return []
    const at = new Date().toISOString()
    memory = { ...memory, ...Object.fromEntries(fresh.map((id) => [id, at])) }
    try { localStorage.setItem(KEY, JSON.stringify(memory)) } catch { /* ignore */ }
    emit()
    return fresh
  },
  reset() { memory = {}; try { localStorage.removeItem(KEY) } catch { /* ignore */ } emit() },
  subscribe(f) { subs.add(f); return () => subs.delete(f) },
}
export const useDex = () => { useSyncExternalStore(dex.subscribe, () => ver, () => ver); return memory }
