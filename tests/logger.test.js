import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/* The Sandbox logger is the research record (pre/post, round 1 vs 2) — it must not lose players.
   Each "tab" is a fresh copy of the module sharing one fake localStorage, as two browser tabs share one origin. */

function fakeStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)) },
    removeItem: (k) => { m.delete(k) },
    clear: () => m.clear(),
  }
}
async function tab() {
  vi.resetModules()
  return (await import('../src/lib/evalLogger')).logger
}
const play = (lg, name) => {
  lg.start({ hintsEnabled: true, seed: 1, mode: 'beginner' })
  lg.setPlayer(name)
  lg.finish({ score: 500 })
}

describe('Sandbox logger storage', () => {
  beforeEach(() => { globalThis.localStorage = fakeStorage() })
  afterEach(() => { delete globalThis.localStorage })

  it('two tabs open at once keep both players (a plain write used to wipe the other tab)', async () => {
    const a = await tab()
    const b = await tab()                    // loaded before tab A logged anybody
    play(a, 'นักเรียน A')
    play(b, 'นักเรียน B')
    play(a, 'นักเรียน C')
    const fresh = await tab()                // a reload sees what is on disk
    expect(fresh.sessions().map((x) => x.player).sort()).toEqual(['นักเรียน A', 'นักเรียน B', 'นักเรียน C'])
    expect(a.sessions()).toHaveLength(3)     // the teacher panel in either tab lists everyone
  })

  it('a run still in progress in one tab is not overwritten by the other tab', async () => {
    const a = await tab()
    const b = await tab()
    a.start({ hintsEnabled: true }); a.setPlayer('กำลังเล่น')
    b.sessions()                             // tab B picks up A's early copy
    a.quiz('pre', [], 3, 5)
    play(b, 'อีกคน')                         // B writes after A's latest change
    const fresh = await tab()
    const row = fresh.sessions().find((x) => x.player === 'กำลังเล่น')
    expect(row.pre?.score).toBe(3)
  })

  it('clearing the log before class keeps logging the next player (it used to stop the session)', async () => {
    const lg = await tab()
    play(lg, 'ครูทดสอบ')
    lg.start({ hintsEnabled: true, seed: 7, mode: 'beginner' })   // title screen of the next run
    lg.enterAct(1)
    lg.clear()
    expect(lg.current).not.toBeNull()
    expect(lg.current.seed).toBe(7)
    lg.setPlayer('นักเรียนคนแรก')
    lg.quiz('pre', [], 4, 5)
    lg.finish({ score: 610 })
    const fresh = await tab()
    expect(fresh.sessions().map((x) => x.player)).toEqual(['นักเรียนคนแรก'])
    expect(fresh.sessions()[0].pre.score).toBe(4)
  })

  it('a clear in one tab is honoured by the other tab instead of being written back', async () => {
    const a = await tab()
    play(a, 'เก่า 1'); play(a, 'เก่า 2')
    const b = await tab()
    expect(b.sessions()).toHaveLength(2)
    a.clear()
    play(b, 'ใหม่')
    const fresh = await tab()
    expect(fresh.sessions().map((x) => x.player)).toEqual(['ใหม่'])
  })

  it('says so when storage refuses the write (quota full) so the teacher can export first', async () => {
    const lg = await tab()
    play(lg, 'ok')
    expect(lg.persisted).toBe(true)
    globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError') }
    play(lg, 'เต็ม')
    expect(lg.persisted).toBe(false)
    expect(lg.sessions().map((x) => x.player)).toContain('เต็ม')    // still in memory for export
  })
})

describe('CSV export', () => {
  it('a player name that looks like a formula is exported as text', async () => {
    const { csvCell } = await import('../src/lib/evalLogger')
    expect(csvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`)
    expect(csvCell('+cmd')).toBe(`"'+cmd"`)
    expect(csvCell('@SUM(A1)')).toBe(`"'@SUM(A1)"`)
    expect(csvCell('-ต้น')).toBe(`"'-ต้น"`)
    expect(csvCell(-42)).toBe('"-42"')        // numbers stay numbers
    expect(csvCell('-0.5')).toBe('"-0.5"')
    expect(csvCell('สมชาย')).toBe('"สมชาย"')
    expect(csvCell(null)).toBe('""')
  })

  it('the sessions CSV carries the escaped name', async () => {
    const lg = await tab()
    lg.start({ hintsEnabled: true })
    lg.setPlayer('=1+1')
    lg.finish({ score: 1 })
    const line = lg.sessionsCSV().trim().split('\n').find((l) => l.includes('1+1'))
    expect(line).toContain(`"'=1+1"`)
  })
})
