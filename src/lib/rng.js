/* Seeded random numbers — every game is reproducible from its seed (leaderboard fairness, tests). */

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A small toolkit around one stream. */
export function rng(seed) {
  const r = mulberry32(seed >>> 0)
  const api = {
    next: r,
    range: (a, b) => a + r() * (b - a),
    int: (a, b) => Math.floor(a + r() * (b - a + 1)),          // inclusive
    chance: (p) => r() < p,
    pick: (arr) => arr[Math.floor(r() * arr.length)],
    shuffle: (arr) => {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
      return a
    },
    sample: (arr, n) => api.shuffle(arr).slice(0, n),
  }
  return api
}

/** Derive an independent stream from a seed and a label. */
export function substream(seed, label) {
  let h = seed >>> 0
  for (let i = 0; i < label.length; i++) h = Math.imul(h ^ label.charCodeAt(i), 2654435761) >>> 0
  return rng(h)
}

export const newSeed = () => Math.floor(Math.random() * 900000) + 100000
