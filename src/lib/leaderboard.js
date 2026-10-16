/* Leaderboard — kept on this device (booth / classroom machine), per mode. */

const KEY = 'maesai-command.leaderboard.v1'
let memory = []

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) memory = JSON.parse(raw) } catch { /* storage blocked */ }
  if (!Array.isArray(memory)) memory = []
  return memory
}
load()

export const leaderboard = {
  all() { return memory },
  top(modeId, n = 10) {
    return memory.filter((e) => e.mode === modeId).sort((a, b) => b.score - a.score || a.sec - b.sec).slice(0, n)
  },
  /** Add a finished run; returns its rank within the mode (1-based). */
  add({ name, mode, score, sec, seed, parts }) {
    const e = { name: String(name || 'ไม่ระบุชื่อ').slice(0, 24), mode, score: Math.round(score), sec: Math.round(sec), seed, parts, at: new Date().toISOString() }
    memory = [...memory, e]
    try { localStorage.setItem(KEY, JSON.stringify(memory)) } catch { /* ignore */ }
    return this.top(mode, 999).findIndex((x) => x === e || (x.at === e.at && x.name === e.name)) + 1
  },
  clear() { memory = []; try { localStorage.removeItem(KEY) } catch { /* ignore */ } },
}
