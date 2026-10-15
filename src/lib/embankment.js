/* ══════════════════════════════════════════════════════════════════════════
   EMBANKMENT — the Sai River flood wall through Mae Sai town (act 1, step 2)
   แนวกั้นน้ำวางบนแม่น้ำสายจริง (OSM) ฝั่งไทย — ฝั่งไทยหาจากหลังคา GISTDA
   เพราะชั้นอาคารถูกตัดเฉพาะ อ.แม่สาย · จุดฟันหลอ 14 จุดเป็นค่าสถานการณ์
   ══════════════════════════════════════════════════════════════════════════ */

import { EMBANKMENT, HYDRO } from '../config/missionConfig'
import { saiRiver, metres } from './geo'
import { BUILDINGS, COMMUNITIES_LIVE } from './buildings'

const [W, E] = EMBANKMENT.stretch
const [, S, , N] = EMBANKMENT.bbox
const inside = (p) => p[0] >= W && p[0] <= E && p[1] >= S && p[1] <= N

/** The Sai centreline through the stretch, chained west → east from the OSM pieces. */
function centreline() {
  const runs = []
  for (const f of saiRiver) {
    let cur = []
    for (const p of f.geometry.coordinates) {
      if (inside(p)) cur.push(p)
      else if (cur.length) { if (cur.length > 1) runs.push(cur); cur = [] }
    }
    if (cur.length > 1) runs.push(cur)
  }
  if (!runs.length) return []
  runs.sort((a, b) => Math.min(a[0][0], a[a.length - 1][0]) - Math.min(b[0][0], b[b.length - 1][0]))
  let line = runs.shift()
  if (line[0][0] > line[line.length - 1][0]) line = [...line].reverse()
  while (runs.length) {
    const end = line[line.length - 1]
    let bi = 0, bd = Infinity, rev = false
    runs.forEach((r, i) => {
      const d0 = metres(end, r[0]), d1 = metres(end, r[r.length - 1])
      if (d0 < bd) { bd = d0; bi = i; rev = false }
      if (d1 < bd) { bd = d1; bi = i; rev = true }
    })
    const r = runs.splice(bi, 1)[0]
    line = line.concat(rev ? [...r].reverse() : r)
  }
  return line
}

/** Resample a polyline every `step` metres. */
function resample(line, step) {
  const out = []
  let carry = 0
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1], b = line[i], L = metres(a, b)
    let t = carry
    while (t <= L) { const u = L ? t / L : 0; out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); t += step }
    carry = t - L
  }
  return out
}

const STEP = 10
const PTS = resample(centreline(), STEP)
const lat0 = (S + N) / 2
const KX = 111320 * Math.cos((lat0 * Math.PI) / 180), KY = 110540
const shift = (p, nx, ny, d) => [p[0] + (nx * d) / KX, p[1] + (ny * d) / KY]

/* Unit normals (metres) along the river, flipped so they point at the Thai bank:
   whichever side carries more GISTDA roofs, smoothed so the wall never zig-zags. */
const NORMALS = (() => {
  const near = BUILDINGS.filter((b) => b.c[0] > W - 0.003 && b.c[0] < E + 0.003 && b.c[1] > S && b.c[1] < N).map((b) => b.c)
  const raw = PTS.map((p, i) => {
    const a = PTS[Math.max(0, i - 2)], b = PTS[Math.min(PTS.length - 1, i + 2)]
    const tx = (b[0] - a[0]) * KX, ty = (b[1] - a[1]) * KY, tl = Math.hypot(tx, ty) || 1
    const n = [-ty / tl, tx / tl]
    const count = (s) => { const q = shift(p, n[0], n[1], s * 40); return near.filter((c) => metres(c, q) < 45).length }
    return { n, side: Math.sign(count(1) - count(-1)) }
  })
  let last = -1                     // west → east, the right-hand bank is Thailand
  return raw.map((r, i) => {
    let v = 0
    for (let k = -6; k <= 6; k++) v += raw[i + k]?.side || 0
    if (v) last = Math.sign(v)
    return [r.n[0] * last, r.n[1] * last]
  })
})()

const WALL_PTS = PTS.map((p, i) => shift(p, NORMALS[i][0], NORMALS[i][1], EMBANKMENT.bankOffsetM))

/* Deterministic gap lengths — the gap positions are evenly spread with a little jitter. */
const rnd = (() => { let a = 20240911; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296 } })()

export const EMBANKMENT_GAPS = (() => {
  if (WALL_PTS.length < 20) return []
  const n = EMBANKMENT.gaps
  const [lo, hi] = EMBANKMENT.gapLenM
  return Array.from({ length: n }, (_, i) => {
    const t = 0.05 + (0.9 * (i + 0.5)) / n + (rnd() - 0.5) * 0.025
    const k = Math.round(t * (WALL_PTS.length - 1))
    const p = WALL_PTS[k]
    const len = Math.round(lo + rnd() * (hi - lo))
    const behind = BUILDINGS.filter((b) => b.flood && metres(b.c, p) <= 150).length
    let com = null, best = 450
    for (const c of COMMUNITIES_LIVE) { const d = metres(p, [c.lon, c.lat]); if (d < best) { best = d; com = c } }
    return { id: `FW-${String(i + 1).padStart(2, '0')}`, k, lon: p[0], lat: p[1], len, behind, community: com?.th || null }
  })
})()

/** Wall pieces between the gaps (lon/lat polylines) and the gap spans themselves. */
export const EMBANKMENT_WALL = (() => {
  const half = (g) => Math.max(1, Math.round(g.len / 2 / STEP))
  const cut = new Map()
  for (const g of EMBANKMENT_GAPS) for (let k = g.k - half(g); k <= g.k + half(g); k++) cut.set(k, g.id)
  const pieces = [], spans = {}
  let cur = []
  WALL_PTS.forEach((p, k) => {
    const id = cut.get(k)
    if (id) { (spans[id] ||= []).push(p); if (cur.length > 1) pieces.push(cur); cur = [] } else cur.push(p)
  })
  if (cur.length > 1) pieces.push(cur)
  return { pieces, spans }
})()

/** The river centreline and its 150 m pre-encroachment channel (for the N ruler). */
export const EMBANKMENT_RIVER = PTS

/** Ruler across the channel at `rulerAt` — the town reach where THEOS-2 measures N. */
export const CHANNEL_RULER = (() => {
  if (!PTS.length) return null
  const k = Math.round(EMBANKMENT.rulerAt * (PTS.length - 1))
  const p = PTS[k], [nx, ny] = NORMALS[k]
  const w = HYDRO.trueChannelWidth
  return { at: p, a: shift(p, nx, ny, w / 2), b: shift(p, nx, ny, -w / 2), widthM: w, normal: [nx, ny] }
})()

export const WALL_LENGTH_KM = (PTS.length * STEP) / 1000
