/* ══════════════════════════════════════════════════════════════════════════
   FX BUS — presentation events (no game state): what the player just did,
   for the chibi's pose, sounds, floating numbers and screen shake.
   fx.emit('action', { kind: 'evacuate' }) · fx.on('action', fn) → unsubscribe
   ══════════════════════════════════════════════════════════════════════════ */

const subs = new Map()

export const fx = {
  emit(type, payload = {}) { (subs.get(type) || []).forEach((fn) => fn(payload)) },
  on(type, fn) {
    if (!subs.has(type)) subs.set(type, new Set())
    subs.get(type).add(fn)
    return () => subs.get(type).delete(fn)
  },
}
