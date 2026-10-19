import { describe, it, expect } from 'vitest'
import { profile, HAIR, OUTFITS } from '../src/lib/profile'
import { POSES } from '../src/ui/chibi'
import { ACTION_POSE } from '../src/ui/chibiDock'
import { fx } from '../src/lib/fx'
import { logger } from '../src/lib/evalLogger'

describe('chibi (B8 / B12)', () => {
  it('every player action maps to an existing pose, and every pose says something', () => {
    for (const [kind, pose] of Object.entries(ACTION_POSE)) expect(POSES[pose], kind).toBeTruthy()
    for (const [k, p] of Object.entries(POSES)) { expect(p.say, k).toBeTruthy(); expect(p.arms).toHaveLength(2) }
    // the poses the brief asks for
    for (const k of ['inspect', 'ruler', 'point', 'megaphone', 'carry', 'clipboard', 'remote', 'switch', 'cheer', 'shock', 'serious', 'monitor']) expect(POSES[k], k).toBeTruthy()
    expect(POSES.inspect.hat).toBe('helmet')
    expect(POSES.monitor.hat).toBe('glasses')
  })

  it('the look is stored, the photo can be removed, and it never reaches the log or CSV (PDPA)', () => {
    profile.set({ hair: HAIR[2].id, outfit: OUTFITS[1].id })
    expect(profile.get().hair).toBe(HAIR[2].id)
    profile.setPhoto('data:image/jpeg;base64,AAAA')
    expect(profile.get().photo).toMatch(/^data:image/)
    logger.start({ hintsEnabled: true })
    logger.setPlayer('ทดสอบ')
    logger.finish({ score: 1 })
    const all = JSON.stringify(logger.sessions()) + logger.sessionsCSV() + logger.roundsCSV() + logger.hintsCSV()
    expect(all).not.toMatch(/data:image/)
    profile.removePhoto()
    expect(profile.get().photo).toBeNull()
  })

  it('the fx bus delivers actions and unsubscribes cleanly', () => {
    const got = []
    const off = fx.on('action', (p) => got.push(p.kind))
    fx.emit('action', { kind: 'evacuate' })
    off()
    fx.emit('action', { kind: 'seal' })
    expect(got).toEqual(['evacuate'])
  })
})
