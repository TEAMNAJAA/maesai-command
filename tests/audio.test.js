import { describe, it, expect } from 'vitest'
import { audio } from '../src/lib/audio'
import { prefs } from '../src/lib/prefs'

describe('sound settings (B1–B3, C2)', () => {
  it('nothing plays and nothing throws before the first gesture (no AudioContext yet)', () => {
    expect(() => { audio.play('click'); audio.play('theos'); audio.play('nope'); audio.duck(true); audio.duck(false) }).not.toThrow()
    expect(audio.running).toBe(false)
  })
  it('music intensity is clamped to the four levels', () => {
    audio.setIntensity(7); expect(audio.intensity).toBe(3)
    audio.setIntensity(-2); expect(audio.intensity).toBe(0)
    audio.setIntensity(2); expect(audio.intensity).toBe(2)
  })
  it('settings change, notify, and start quiet by default', () => {
    const d = prefs.get()
    expect(d.musicVol).toBeLessThan(0.5)
    let n = 0
    const off = prefs.subscribe(() => n++)
    prefs.set({ music: false, sfxVol: 0.3 })
    expect(prefs.get().music).toBe(false)
    expect(prefs.get().sfxVol).toBe(0.3)
    expect(n).toBe(1)
    off()
    prefs.set({ music: d.music, sfxVol: d.sfxVol })
  })
})
