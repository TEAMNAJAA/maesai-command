/* ══════════════════════════════════════════════════════════════════════════
   BOSS (E) — คืนวิกฤต T0: "มวลน้ำ" ปะทะผู้บัญชาการ แบบเทิร์นด้วยการ์ดมาตรการจริง
   ฟังก์ชันล้วน ผลกำหนดจาก seed + สิ่งที่ผู้เล่นเตรียมในองก์ 1 เท่านั้น (ไม่มีสุ่มระหว่างเล่น)
   • มวลน้ำ: แรงดัน (HP) = พยากรณ์ − ผลการอุดฟันหลอ · แรงซัด = จุดฟันหลอที่ยังเปิด
     ท่าพิเศษ "ดินถล่มอุดลำน้ำแตก" มีเมื่อไม่ได้แปลภาพ หรือไม่ได้วัด N
     เห็นท่าถัดไปเมื่อ SFVI ≥ 0.62 (หลักฐานพอ) และไม่ใช่ Expert
   • ผู้บัญชาการ: ชาวบ้านปลอดภัย = % อพยพทัน · พลังต่อตา = ทีมว่าง · งบจริง · ความเชื่อมั่นจริง
   • ชนะ = แรงดันเหลือ 0 ภายใน 4 ตา · แพ้ = ตลิ่งแตก โซนเสี่ยงที่สุดน้ำสูงขึ้นในองก์ 2 (เกมเล่นต่อได้)
   • ทุกตาเป็นการตัดสินใจหนึ่งรายการใน decisionLedger (s.bossLog) — โหมดเจ้าหน้าที่/ข้ามฉาก = จัดการอัตโนมัติ
   ══════════════════════════════════════════════════════════════════════════ */

import { BOSS, MODES, SFVI } from '../config/missionConfig'
import { BOSS_MOVES, BOSS_CARDS, CAMP_SITES } from '../config/scenarioData'
import { EMBANKMENT_GAPS } from '../lib/embankment'
import { SECTIONS } from '../lib/sections'
import { computeSfvi, exposureSummary, campFloods, peakDepth, HARM_M, bigbagSealed } from '../lib/sim'
import { substream } from '../lib/rng'

const CARD_IDS = ['base', 'bigbag', 'pump', 'power', 'evac', 'boat', 'theos']

/** The fight as the player prepared it at T0. */
export function bossSetup(s, scn) {
  const nGaps = EMBANKMENT_GAPS.length || 1
  const sealed = Math.min(nGaps, bigbagSealed(s).length)          // sandbags give way before the crest
  const open = nGaps - sealed
  const hp = Math.round(BOSS.hpBase * (1 - BOSS.sealCut * (sealed / nGaps)))
  const attack = BOSS.attackBase + BOSS.attackPerGap * open
  const analysed = s.images.some((i) => i.usable && i.analyzed && i.target !== 'TOWN')
  const damAvailable = !analysed || !s.channel.measured
  const sf = computeSfvi(s, scn)
  const evidence = sf.basin >= SFVI.decisionBand
  const seeNext = !!MODES[s.modeId]?.tutor && evidence
  const exp = exposureSummary(s, scn)
  const villagers = Math.max(BOSS.villagersMin, Math.round(100 * exp.safeShare))
  const freeCrews = (s.crews || []).filter((c) => c.busyUntil <= Math.max(0, s.clock)).length
  const energy = Math.min(BOSS.energyMax, BOSS.energyBase + freeCrews)
  const site = CAMP_SITES.find((c) => c.id === s.camp)
  const baseOk = !!site && !campFloods(s, site)
  const images = s.images.filter((i) => i.usable).length
  return {
    turn: 1, turns: BOSS.turns,
    boss: { hp, max: hp, attack, open, sealed, nGaps, damAvailable },
    me: { villagers, villagersMax: 100, energy, energyMax: energy, budget: s.budget.total - s.budget.spent, spent: 0, trust: s.trust, baseOk, baseUsed: false, images },
    seeNext, evidence, sfvi: +sf.basin.toFixed(3),
    moves: moveSchedule(scn.seed, damAvailable),
    log: [], status: 'fight',
  }
}

/** Boss moves for the four turns — fixed by the seed (the dam bursts on turn 2 or 3 when it exists). */
export function moveSchedule(seed, damAvailable) {
  const r = substream(seed, 'boss')
  const pool = ['gap', 'power', 'rain']
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r.next() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]] }
  const moves = ['surge', ...pool]
  if (damAvailable) moves[r.chance(0.5) ? 1 : 2] = 'dam'
  return moves.slice(0, BOSS.turns)
}

/** What the water does this turn, with its raw damage. `visible` = the player may see it now. */
export function bossIntent(b) {
  const id = b.moves[b.turn - 1]
  if (!id) return null
  return { id, th: BOSS_MOVES[id].th, desc: BOSS_MOVES[id].desc, dmg: rawDamage(b, id), visible: b.seeNext || !!b.revealed?.[b.turn] }
}

function rawDamage(b, id) {
  const M = BOSS.moves
  if (id === 'surge') return b.boss.attack
  if (id === 'gap') return b.boss.open > 0 ? Math.round(b.boss.attack * M.gap.mult) : M.gap.closed
  if (id === 'power') return M.power.dmg
  if (id === 'rain') return M.rain.dmg
  if (id === 'dam') return Math.round(M.dam.dmg + b.boss.attack * M.dam.attackShare)
  return 0
}

/** Can this card be played now (energy, money, limits, prerequisites)? → null or the reason in Thai. */
export function cardBlock(b, picks, id) {
  const C = BOSS.cards[id]
  const count = picks.filter((x) => x === id).length
  if (id === 'base') return !b.me.baseOk ? 'ฐานถูกน้ำท่วม' : b.me.baseUsed || count ? 'ใช้ไปแล้ว' : null
  if (id === 'theos' && !b.me.images) return 'ไม่มีภาพ THEOS-2 ที่ใช้ได้'
  if (count >= (C.max || 1)) return `ใช้ได้ตาละ ${C.max || 1} ครั้ง`
  const cap = b.me.energy + (picks.includes('base') ? BOSS.cards.base.gain : 0)
  const used = picks.reduce((s, x) => s + BOSS.cards[x].energy, 0)
  if (used + C.energy > cap) return 'พลังสั่งการไม่พอ'
  const baht = picks.reduce((s, x) => s + BOSS.cards[x].baht, 0)
  if (baht + C.baht > b.me.budget - b.me.spent) return 'งบไม่พอ'
  return null
}

/** Resolve one turn: the player's cards, then the water's move. Returns the next fight state. */
export function bossTurn(b, picks = []) {
  if (b.status !== 'fight') return b
  const n = structuredClone(b)
  const move = bossIntent(n)
  const has = (id) => picks.filter((x) => x === id).length
  const C = BOSS.cards
  // cards first
  let bossDmg = has('pump') * C.pump.hp + has('bigbag') * C.bigbag.hp
  let mult = 1
  if (move.id === 'surge' || move.id === 'gap') mult *= (1 - C.bigbag.block) ** has('bigbag')
  if (move.id === 'power' && has('power')) mult = 0
  if (move.id === 'dam' && has('theos')) mult *= 1 - C.theos.cut
  if (has('boat')) mult *= 1 - C.boat.cut
  const heal = has('evac') ? Math.round(C.evac.heal * (n.me.trust / 100)) : 0
  // the commander acts first: water drained to nothing never gets to strike this turn
  const broken = n.boss.hp - bossDmg <= 0
  const taken = broken ? 0 : Math.round(move.dmg * mult)
  if (move.id === 'rain' && !broken) n.boss.hp += BOSS.moves.rain.heal
  n.boss.hp = Math.max(0, n.boss.hp - bossDmg)
  n.me.villagers = Math.max(0, Math.min(n.me.villagersMax, n.me.villagers + heal - taken))
  n.me.spent += picks.reduce((a, x) => a + C[x].baht, 0)
  if (has('base')) n.me.baseUsed = true
  if (has('theos')) n.revealed = { ...(n.revealed || {}), [n.turn + 1]: true }
  // the verdict for this turn (counted in the decision score)
  const v = judgeTurn(b, move, picks, taken)
  n.log.push({ turn: n.turn, move: move.id, moveTh: move.th, picks: [...picks], raw: move.dmg, taken, heal, bossDmg, hpAfter: n.boss.hp, villagersAfter: n.me.villagers, verdict: v.verdict, why: v.why, seen: move.visible })
  // outcome
  if (n.me.villagers <= 0) n.status = 'lost'
  else if (n.boss.hp <= 0) n.status = 'won'
  else if (n.turn >= n.turns) n.status = 'lost'
  else n.turn += 1
  return n
}

/** Was this turn's play sound? good / fair / bad / skip — judged on what the play did, not on luck. */
function judgeTurn(b, move, picks, taken) {
  const energyLeft = b.me.energy + (picks.includes('base') ? BOSS.cards.base.gain : 0) - picks.reduce((a, x) => a + BOSS.cards[x].energy, 0)
  const wasted = picks.filter((x) => (x === 'power' && move.id !== 'power') || (x === 'theos' && move.id !== 'dam' && b.turn >= b.turns))
  const counter = { surge: ['bigbag', 'boat'], gap: ['bigbag', 'boat'], power: ['power'], dam: ['theos', 'boat'], rain: ['pump'] }[move.id]
  const countered = picks.some((x) => counter.includes(x)) || move.dmg < 8 && move.id !== 'rain'
  const drained = picks.includes('pump')
  if (!picks.length) return { verdict: 'skip', why: `ไม่ได้สั่งการ — ${move.th} ทำความเสียหาย ${taken}` }
  if (wasted.length && !countered) return { verdict: 'bad', why: `ใช้${wasted.map((x) => BOSS_CARDS[x].th).join('/')}ผิดจังหวะ — ${move.th} ไม่ได้ถูกรับมือ (เสียหาย ${taken})` }
  if (countered && drained) return { verdict: wasted.length ? 'fair' : 'good', why: `รับ${move.th}ด้วย${picks.filter((x) => counter.includes(x)).map((x) => BOSS_CARDS[x].th).join('+') || 'แนวตลิ่ง'} และระบายมวลน้ำ${wasted.length ? ' (มีการ์ดเสียเปล่า)' : ''}` }
  if (countered) return { verdict: energyLeft >= 2 ? 'fair' : 'good', why: `รับ${move.th}ได้${energyLeft >= 2 ? ` แต่เหลือพลังสั่งการ ${energyLeft} ไม่ได้ใช้` : ''}` }
  if (drained) return { verdict: taken >= 12 ? 'fair' : 'good', why: `ระบายมวลน้ำ แต่ปล่อยให้${move.th}ทำความเสียหาย ${taken}` }
  return { verdict: 'bad', why: `ไม่ได้รับมือ${move.th} — เสียหาย ${taken}` }
}

/** Best cards for this turn knowing the true move — for officer mode / skipped fights and the demo bot. */
export function bossBest(b) {
  let best = [], bestScore = -Infinity
  const rec = (picks, from) => {
    const sim = bossTurn({ ...b, revealed: b.revealed }, picks)
    const last = sim.log[sim.log.length - 1]
    const score = (sim.status === 'won' ? 1000 : 0) - (sim.status === 'lost' && sim.me.villagers <= 0 ? 1000 : 0) + last.bossDmg * 1.0 - (last.taken - last.heal) * 1.25 - picks.length * 0.01 - (last.verdict === 'bad' ? 5 : 0)
    if (score > bestScore) { bestScore = score; best = picks }
    for (let i = from; i < CARD_IDS.length; i++) {
      const id = CARD_IDS[i]
      if (!cardBlock(b, picks, id)) rec([...picks, id], i)
    }
  }
  rec([], 0)
  return best
}

/** Play the whole fight with bossBest (no player choices). */
export function autoFight(b) {
  let n = b
  while (n.status === 'fight') n = bossTurn(n, bossBest(n))
  return n
}

/** Write the result into the game: budget, decisions (only when the player fought), the breach on a loss. */
export function applyBoss(s, scn, b, { fought = true } = {}) {
  const n = structuredClone(s)
  n.budget.spent += b.me.spent
  n.boss = { done: true, won: b.status === 'won', fought, turns: b.log.length, hpLeft: b.boss.hp, hpMax: b.boss.max, villagers: b.me.villagers, spent: b.me.spent,
    sealed: b.boss.sealed, nGaps: b.boss.nGaps, energy: b.me.energyMax }
  n.bossLog = fought ? b.log.map((x) => ({ turn: x.turn, moveTh: x.moveTh, verdict: x.verdict, why: x.why })) : []
  if (b.status !== 'won') {
    // the embankment gives way where the water hurts most: the deepest zone already in harm's way
    const zone = [...SECTIONS].filter((z) => peakDepth(s, z) >= HARM_M).sort((a, c) => peakDepth(s, c) - peakDepth(s, a))[0] || SECTIONS[0]
    n.breach = { zone: zone.id, extraM: BOSS.breachM, at: 0 }
  }
  return n
}

/** A fight that was not played (officer mode, skipped scene, tests) resolves from the preparation alone. */
export function resolveBoss(s, scn) {
  if (s.boss?.done) return s
  return applyBoss(s, scn, autoFight(bossSetup(s, scn)), { fought: false })
}
