/* ══════════════════════════════════════════════════════════════════════════
   AUDIO — เพลงและเสียงสังเคราะห์ด้วย Web Audio API ทั้งหมด (ไม่มีไฟล์เสียง · ออฟไลน์ไฟล์เดียว)
   • เพลงพื้นหลัง ambient / lo-fi: แพดคอร์ด + คีย์บอร์ดเมโลดี้สร้างใหม่ทุกห้อง (ไม่วนซ้ำตรง ๆ)
     + กลองเบา ๆ แบบสวิง · 4 ระดับความตึงเครียด (C2): สงบ → ตึง → วิกฤต → คืนวิกฤต
   • เสียง UI: ชี้ปุ่ม (กันรัว) · คลิก · เสียงประจำตัว THEOS-2 (โน้ต 4 ตัว + กล้องสแกน + ติ๊ดดาวน์ลิงก์)
   • เริ่มเสียงหลังผู้เล่นโต้ตอบครั้งแรกเท่านั้น (นโยบายเบราว์เซอร์) · ?rec / ?mute ปิดเสียง
   ══════════════════════════════════════════════════════════════════════════ */

import { prefs } from './prefs'

let ctx = null
let master, musicGain, musicFilter, sfxGain, send, noise
const mus = { on: false, timer: null, step: 0, next: 0, level: 0, pending: 0, chord: 0, rand: 1, notes: [], duck: 1 }

const midi = (m) => 440 * 2 ** ((m - 69) / 12)

function ensure() {
  if (ctx) return ctx
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!AC) return null
  ctx = new AC()
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3
  master = ctx.createGain(); master.connect(comp).connect(ctx.destination)
  musicGain = ctx.createGain(); musicGain.gain.value = 0
  musicFilter = ctx.createBiquadFilter(); musicFilter.type = 'lowpass'; musicFilter.frequency.value = 2200; musicFilter.Q.value = 0.4
  musicGain.connect(musicFilter).connect(master)
  sfxGain = ctx.createGain(); sfxGain.connect(master)
  // a soft echo room for the music (lo-fi tape feel)
  const delay = ctx.createDelay(1); delay.delayTime.value = 0.36
  const fb = ctx.createGain(); fb.gain.value = 0.3
  const wet = ctx.createGain(); wet.gain.value = 0.25
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1600
  delay.connect(tone).connect(fb).connect(delay); tone.connect(wet).connect(musicFilter)
  send = delay
  const len = ctx.sampleRate * 2
  noise = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  applyPrefs()
  return ctx
}

/* ── building blocks ─────────────────────────────────────────────────────── */

function voice({ type = 'sine', f, t, dur, gain = 0.1, attack = 0.005, release = 0.08, to = null, dest, detune = 0, echo = 0 }) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = detune
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + attack)
  g.gain.setValueAtTime(gain, t + Math.max(attack, dur - release))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + release)
  o.connect(g).connect(dest)
  if (echo) { const e = ctx.createGain(); e.gain.value = echo; g.connect(e).connect(send) }
  o.start(t); o.stop(t + dur + release + 0.05)
}
function hiss({ t, dur, gain = 0.1, type = 'highpass', freq = 6000, q = 0.7, to = null, dest }) {
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain()
  src.buffer = noise; src.loop = true
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur)
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(dest)
  src.start(t, Math.random()); src.stop(t + dur + 0.05)
}

/* ── music: generative ambient lo-fi ─────────────────────────────────────── */

const BPM = [68, 78, 90, 100]
// i–VI–III–VII-ish in A minor (calm, maj7 colours) and a darker set for crisis
const CHORDS = {
  calm: [[57, 60, 64, 67, 71], [53, 57, 60, 64], [48, 55, 59, 64], [55, 59, 62, 66]],
  dark: [[57, 60, 64, 67], [53, 57, 60, 65], [55, 58, 62, 65], [52, 56, 59, 62]],
}
const PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88]       // A minor pentatonic, two octaves

const rnd = () => { mus.rand = (mus.rand * 16807) % 2147483647; return mus.rand / 2147483647 }

function planMelody(level) {
  // a fresh rhythm + random walk every bar, so the tune never loops exactly
  const slots = [0, 3, 4, 6, 8, 10, 11, 12, 14]
  const p = [0.28, 0.36, 0.44, 0.5][level]
  let i = Math.floor(rnd() * 4) + 2
  mus.notes = slots.filter(() => rnd() < p).map((s) => { i = Math.max(0, Math.min(PENTA.length - 1, i + Math.round((rnd() - 0.5) * 3))); return { s, m: PENTA[i], len: rnd() < 0.3 ? 2 : 1 } })
}

function step(t, k) {
  const L = mus.level, dur16 = 60 / BPM[L] / 4
  const bar = k % 16
  const swing = k % 2 ? dur16 * 0.12 : 0
  const at = t + swing
  if (bar === 0) {
    if (mus.pending !== mus.level) mus.level = mus.pending
    mus.chord = (mus.chord + 1) % 4
    const set = mus.level >= 2 ? CHORDS.dark : CHORDS.calm
    const ch = set[mus.chord]
    const len = dur16 * 16
    for (const [i, m] of ch.entries()) voice({ type: i % 2 ? 'triangle' : 'sawtooth', f: midi(m), t, dur: len, gain: 0.022 / (1 + i * 0.25), attack: 0.9, release: 1.4, dest: musicGain, detune: (i - 2) * 5, echo: 0.3 })
    if (mus.level >= 3) voice({ type: 'sine', f: midi(ch[0] - 24), t, dur: len, gain: 0.07, attack: 0.4, release: 0.8, dest: musicGain })
    planMelody(mus.level)
    hiss({ t, dur: len, gain: 0.006, type: 'bandpass', freq: 2500, q: 0.3, dest: musicGain })   // vinyl air
  }
  const set = mus.level >= 2 ? CHORDS.dark : CHORDS.calm
  const root = set[mus.chord][0] - 12
  if (L >= 1 && (bar === 0 || bar === 8 || (L >= 2 && bar === 10))) voice({ type: 'sine', f: midi(root), t: at, dur: dur16 * 3, gain: 0.09, attack: 0.01, release: 0.12, dest: musicGain })
  const kicks = L >= 3 ? [0, 4, 8, 12] : L >= 2 ? [0, 6, 8, 11] : L >= 1 ? [0, 8] : []
  if (kicks.includes(bar)) voice({ type: 'sine', f: 120, to: 42, t: at, dur: 0.22, gain: L >= 3 ? 0.32 : 0.24, attack: 0.002, release: 0.06, dest: musicGain })
  if (L >= 1 && (bar === 4 || bar === 12)) hiss({ t: at, dur: 0.16, gain: 0.05, type: 'bandpass', freq: 1800, q: 0.8, dest: musicGain })
  if (L >= 1 && (L >= 2 || bar % 2 === 0)) hiss({ t: at, dur: 0.04, gain: bar % 4 === 2 ? 0.03 : 0.018, type: 'highpass', freq: 7500, dest: musicGain })
  if (L >= 2 && bar % 2 === 0) { const ch = set[mus.chord]; voice({ type: 'square', f: midi(ch[(bar / 2) % ch.length] + 12), t: at, dur: dur16 * 0.8, gain: 0.012, attack: 0.004, release: 0.05, dest: musicGain }) }
  for (const n of mus.notes) if (n.s === bar) voice({ type: 'triangle', f: midi(n.m), t: at, dur: dur16 * 2 * n.len, gain: 0.05, attack: 0.008, release: 0.35, dest: musicGain, echo: 0.45 })
}

function startMusic() {
  if (!ensure() || mus.on) return
  mus.on = true
  mus.rand = (Date.now() % 2147483646) + 1
  mus.next = ctx.currentTime + 0.1
  mus.timer = setInterval(() => {
    if (!ctx) return
    if (mus.next < ctx.currentTime - 0.25) mus.next = ctx.currentTime + 0.05      // tab was in the background
    while (mus.next < ctx.currentTime + 0.14) {
      step(mus.next, mus.step)
      mus.next += 60 / BPM[mus.level] / 4
      mus.step++
    }
  }, 30)
  musicGain.gain.cancelScheduledValues(ctx.currentTime)
  musicGain.gain.setTargetAtTime(prefs.get().musicVol * mus.duck, ctx.currentTime, 0.8)
}
function stopMusic() {
  if (!ctx || !mus.on) return
  mus.on = false
  clearInterval(mus.timer); mus.timer = null
  musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3)
}

function applyPrefs() {
  if (!ctx) return
  const p = prefs.get()
  sfxGain.gain.setTargetAtTime(p.sfx ? p.sfxVol : 0, ctx.currentTime, 0.05)
  if (p.music && !p.officer) { startMusic(); musicGain.gain.setTargetAtTime(p.musicVol * mus.duck, ctx.currentTime, 0.4) } else stopMusic()
}
prefs.subscribe(applyPrefs)

/* ── sound effects ───────────────────────────────────────────────────────── */

const SFX = {
  hover: (t) => voice({ type: 'sine', f: 1900, to: 1500, t, dur: 0.03, gain: 0.035, release: 0.03, dest: sfxGain }),
  click: (t) => { voice({ type: 'triangle', f: 660, to: 300, t, dur: 0.06, gain: 0.12, release: 0.05, dest: sfxGain }); hiss({ t, dur: 0.03, gain: 0.03, freq: 3000, dest: sfxGain }) },
  ok: (t) => [76, 81, 88].forEach((m, i) => voice({ type: 'sine', f: midi(m), t: t + i * 0.07, dur: 0.18, gain: 0.08, release: 0.3, dest: sfxGain, echo: 0.2 })),
  error: (t) => voice({ type: 'square', f: 150, to: 110, t, dur: 0.18, gain: 0.05, release: 0.08, dest: sfxGain }),
  alarm: (t) => [0, 0.32, 0.64].forEach((d) => { voice({ type: 'triangle', f: 660, t: t + d, dur: 0.14, gain: 0.07, dest: sfxGain }); voice({ type: 'triangle', f: 880, t: t + d + 0.15, dur: 0.14, gain: 0.07, dest: sfxGain }) }),
  // THEOS-2 signature: D–A–E–F♯ bell motif · push-broom scan sweep · three downlink ticks
  theos: (t) => {
    [74, 81, 88, 90].forEach((m, i) => { voice({ type: 'sine', f: midi(m), t: t + i * 0.11, dur: 0.22, gain: 0.09, release: 0.4, dest: sfxGain, echo: 0.35 }); voice({ type: 'sine', f: midi(m) * 2.01, t: t + i * 0.11, dur: 0.08, gain: 0.02, release: 0.2, dest: sfxGain }) })
    hiss({ t: t + 0.5, dur: 0.9, gain: 0.05, type: 'bandpass', freq: 400, to: 4200, q: 4, dest: sfxGain })
    ;[1.5, 1.62, 1.74].forEach((d) => voice({ type: 'square', f: 2400, t: t + d, dur: 0.04, gain: 0.03, release: 0.02, dest: sfxGain }))
  },
  megaphone: (t) => { voice({ type: 'sawtooth', f: 440, to: 520, t, dur: 0.25, gain: 0.04, dest: sfxGain }); voice({ type: 'sawtooth', f: 330, to: 390, t: t + 0.27, dur: 0.25, gain: 0.04, dest: sfxGain }) },
  thud: (t) => { voice({ type: 'sine', f: 90, to: 40, t, dur: 0.18, gain: 0.25, dest: sfxGain }); hiss({ t, dur: 0.12, gain: 0.05, type: 'lowpass', freq: 600, dest: sfxGain }) },
  boat: (t) => { for (let i = 0; i < 6; i++) voice({ type: 'sawtooth', f: 70, t: t + i * 0.09, dur: 0.06, gain: 0.05, dest: sfxGain }); hiss({ t, dur: 0.8, gain: 0.04, type: 'lowpass', freq: 900, dest: sfxGain }) },
  drone: (t) => { voice({ type: 'sawtooth', f: 180, to: 240, t, dur: 0.9, gain: 0.025, attack: 0.2, dest: sfxGain }); hiss({ t, dur: 0.9, gain: 0.02, type: 'bandpass', freq: 3000, dest: sfxGain }) },
  splash: (t) => { hiss({ t, dur: 0.7, gain: 0.18, type: 'lowpass', freq: 1800, to: 300, dest: sfxGain }); [0.15, 0.3, 0.42].forEach((d) => voice({ type: 'sine', f: 500, to: 1200, t: t + d, dur: 0.08, gain: 0.04, dest: sfxGain })) },
  zap: (t) => { for (let i = 0; i < 7; i++) hiss({ t: t + i * 0.045 + Math.random() * 0.02, dur: 0.04, gain: 0.12, type: 'highpass', freq: 2500 + Math.random() * 3000, dest: sfxGain }); voice({ type: 'sawtooth', f: 120, t, dur: 0.35, gain: 0.05, dest: sfxGain }) },
  stamp: (t) => { voice({ type: 'sine', f: 140, to: 50, t, dur: 0.16, gain: 0.3, dest: sfxGain }); hiss({ t, dur: 0.08, gain: 0.08, type: 'bandpass', freq: 1200, dest: sfxGain }) },
  flip: (t) => hiss({ t, dur: 0.12, gain: 0.05, type: 'bandpass', freq: 2000, to: 5000, dest: sfxGain }),
  tick: (t) => voice({ type: 'sine', f: 2600, t, dur: 0.02, gain: 0.025, dest: sfxGain }),
  thunder: (t) => { hiss({ t, dur: 2.2, gain: 0.16, type: 'lowpass', freq: 380, to: 90, dest: sfxGain }); hiss({ t, dur: 0.18, gain: 0.08, type: 'highpass', freq: 1500, dest: sfxGain }) },
  // the water mass: a low swell, never comic
  boss: (t) => { hiss({ t, dur: 2.4, gain: 0.2, type: 'lowpass', freq: 160, to: 520, dest: sfxGain }); voice({ type: 'sine', f: 44, t, dur: 2.2, gain: 0.22, attack: 0.6, release: 0.8, dest: sfxGain }) },
  hit: (t) => { voice({ type: 'sine', f: 220, to: 70, t, dur: 0.2, gain: 0.2, dest: sfxGain }); hiss({ t, dur: 0.25, gain: 0.08, type: 'lowpass', freq: 1500, dest: sfxGain }) },
  win: (t) => [69, 73, 76, 81].forEach((m, i) => voice({ type: 'triangle', f: midi(m), t: t + i * 0.12, dur: 0.3, gain: 0.08, release: 0.5, dest: sfxGain, echo: 0.3 })),
}

let lastHover = 0
export const audio = {
  /** Browsers allow sound only after a gesture: call from any first click/key. */
  unlock() {
    if (!ensure()) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    applyPrefs()
  },
  play(name) {
    const p = prefs.get()
    if (!ctx || !p.sfx || !SFX[name] || ctx.state !== 'running') return
    if (name === 'hover') { const now = performance.now(); if (now - lastHover < 70) return; lastHover = now }
    SFX[name](ctx.currentTime + 0.005)
  },
  /** 0 calm · 1 tense · 2 crisis · 3 the crisis night — applied at the next bar. */
  setIntensity(level) { mus.pending = Math.max(0, Math.min(3, level | 0)); if (!mus.on) mus.level = mus.pending },
  get intensity() { return mus.pending },
  /** Lower the music under a cut scene or the THEOS-2 signature. */
  duck(on) { mus.duck = on ? 0.35 : 1; if (ctx && mus.on) musicGain.gain.setTargetAtTime(prefs.get().musicVol * mus.duck, ctx.currentTime, 0.25) },
  get running() { return !!ctx && ctx.state === 'running' },
}

// a read-only handle for probes / the teacher to check the sound engine is alive
if (typeof window !== 'undefined') window.__maesaiAudio = { get running() { return audio.running }, get musicOn() { return mus.on }, get level() { return mus.level }, get pending() { return mus.pending } }

/* ── UI sounds for every button: hover (rate-limited) and click ─────────── */

let installed = false
export function installUiSounds() {
  if (installed || typeof document === 'undefined') return
  installed = true
  const first = () => { audio.unlock(); window.removeEventListener('pointerdown', first, true); window.removeEventListener('keydown', first, true) }
  window.addEventListener('pointerdown', first, true)
  window.addEventListener('keydown', first, true)
  let lastEl = null
  document.addEventListener('pointerover', (e) => {
    const b = e.target.closest?.('button, [role="button"]')
    if (!b || b === lastEl || b.disabled) return
    lastEl = b
    audio.play('hover')
  })
  document.addEventListener('pointerout', (e) => { if (lastEl && e.target.closest?.('button, [role="button"]') === lastEl && !lastEl.contains(e.relatedTarget)) lastEl = null })
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest?.('button, [role="button"]')
    if (b && !b.disabled) audio.play('click')
  })
}
