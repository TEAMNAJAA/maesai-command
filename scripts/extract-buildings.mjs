/* ══════════════════════════════════════════════════════════════════════════
   GISTDA building footprints → compact Mae Sai layer for the web app
   ตัดชั้นอาคาร BD_footprintTH (ทั้งประเทศ ~24.5 ล้านหลัง) เหลือเฉพาะพื้นที่แม่สาย

     node scripts/extract-buildings.mjs <path/to/BD_footprintTH.shp> [path/to/BD_footprintTH.dbf]

   · streams the .shp once (3.5 GB) and keeps polygons whose bbox touches AOI-A
   · clips to AOI-A ∩ อำเภอแม่สาย (OSM relation 15652307) — OSM has no tambon
     boundaries for ต.แม่สาย / ต.เวียงพางคำ; pass --clip=<geojson> to use an
     official boundary instead (e.g. the admin layer requested from GISTDA)
   · writes src/data/buildings_maesai.json — quantised, delta-encoded rings:
       { bbox, q, count, fid: [...], rings: [[x0,y0,dx1,dy1,...], ...] }
     coordinates = bbox origin + int / q  (q = 1e6 → ~0.1 m)

   The raw national files are NOT copied into the repo (GitHub limit 100 MB).
   ══════════════════════════════════════════════════════════════════════════ */

import { openSync, readSync, closeSync, fstatSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'src', 'data', 'buildings_maesai.json')
const CACHE = join(HERE, '.cache')
const AOI_A = [99.83, 20.405, 99.965, 20.475]          // W,S,E,N — same as gistda-request AOI-A

const args = process.argv.slice(2)
const shpPath = args.find((a) => a.endsWith('.shp'))
const dbfPath = args.find((a) => a.endsWith('.dbf'))
const clipArg = args.find((a) => a.startsWith('--clip='))?.slice(7)
if (!shpPath) { console.error('usage: node scripts/extract-buildings.mjs <BD_footprintTH.shp> [BD_footprintTH.dbf] [--clip=boundary.geojson]'); process.exit(1) }

/* ── 1 · clip polygon ───────────────────────────────────────────────────── */

async function overpass(query) {
  const urls = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']
  for (const url of [...urls, ...urls]) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query), headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'maesai-command-edu/1.0' } })
      if (r.ok) return await r.json()
    } catch { /* try next */ }
  }
  throw new Error('Overpass unavailable')
}

/** Join the outer ways of a relation into closed rings. */
function assembleRings(ways) {
  const segs = ways.map((w) => w.geometry.map((p) => [p.lon, p.lat]))
  const rings = []
  while (segs.length) {
    let ring = segs.shift()
    let grew = true
    while (grew && (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1])) {
      grew = false
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i], end = ring.at(-1)
        if (s[0][0] === end[0] && s[0][1] === end[1]) { ring = ring.concat(s.slice(1)) } else if (s.at(-1)[0] === end[0] && s.at(-1)[1] === end[1]) { ring = ring.concat(s.slice(0, -1).reverse()) } else continue
        segs.splice(i, 1); grew = true; break
      }
    }
    rings.push(ring)
  }
  return rings
}

async function clipRings() {
  if (clipArg) {
    const g = JSON.parse(readFileSync(clipArg, 'utf8'))
    const geoms = (g.features || [g]).map((f) => f.geometry || f)
    return { label: clipArg, rings: geoms.flatMap((gm) => (gm.type === 'Polygon' ? [gm.coordinates[0]] : gm.coordinates.map((p) => p[0]))) }
  }
  mkdirSync(CACHE, { recursive: true })
  const cached = join(CACHE, 'maesai_district.json')
  if (!existsSync(cached)) {
    const j = await overpass('[out:json][timeout:120];rel(15652307);out geom;')
    const outer = j.elements[0].members.filter((m) => m.type === 'way' && m.role !== 'inner')
    writeFileSync(cached, JSON.stringify(assembleRings(outer)))
  }
  return { label: 'AOI-A ∩ อำเภอแม่สาย (OSM rel 15652307)', rings: JSON.parse(readFileSync(cached, 'utf8')) }
}

const inRing = ([x, y], ring) => {
  let c = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

/* ── 2 · stream the national shapefile ──────────────────────────────────── */

function scan(path, bbox) {
  const fd = openSync(path, 'r')
  const size = fstatSync(fd).size
  const CHUNK = 64 * 1024 * 1024
  let buf = Buffer.alloc(CHUNK + 1024 * 1024)
  let carry = 0, pos = 100, index = 0
  const keep = []
  const [W, S, E, N] = bbox
  const t0 = Date.now()
  while (pos < size || carry > 0) {
    const n = pos < size ? readSync(fd, buf, carry, Math.min(CHUNK, size - pos), pos) : 0
    pos += n
    const end = carry + n
    let o = 0
    while (o + 8 <= end) {
      const len = buf.readInt32BE(o + 4) * 2
      if (o + 8 + len > end) break
      const c = o + 8
      const type = buf.readInt32LE(c)
      if (type === 5) {
        const x0 = buf.readDoubleLE(c + 4), y0 = buf.readDoubleLE(c + 12), x1 = buf.readDoubleLE(c + 20), y1 = buf.readDoubleLE(c + 28)
        if (x1 >= W && x0 <= E && y1 >= S && y0 <= N) {
          const nParts = buf.readInt32LE(c + 36), nPts = buf.readInt32LE(c + 40)
          const parts = []
          for (let i = 0; i < nParts; i++) parts.push(buf.readInt32LE(c + 44 + i * 4))
          const p0 = c + 44 + nParts * 4
          const pts = []
          for (let i = 0; i < nPts; i++) pts.push([buf.readDoubleLE(p0 + i * 16), buf.readDoubleLE(p0 + i * 16 + 8)])
          // keep only the outer ring (first part) — footprints are simple polygons
          keep.push({ index, ring: pts.slice(0, parts[1] ?? nPts) })
        }
      }
      index++
      o += 8 + len
    }
    buf.copy(buf, 0, o, end)
    carry = end - o
    if (n === 0 && carry > 0) break
    process.stdout.write(`\r  scanned ${(pos / 1e9).toFixed(2)} / ${(size / 1e9).toFixed(2)} GB · ${index.toLocaleString()} records · kept ${keep.length.toLocaleString()} · ${((Date.now() - t0) / 1000).toFixed(0)} s`)
  }
  closeSync(fd)
  process.stdout.write('\n')
  return keep
}

function readFids(path, indices) {
  if (!path || !existsSync(path)) return null
  const fd = openSync(path, 'r')
  const h = Buffer.alloc(32); readSync(fd, h, 0, 32, 0)
  const headerLen = h.readUInt16LE(8), recLen = h.readUInt16LE(10)
  const rec = Buffer.alloc(recLen)
  const out = indices.map((i) => { readSync(fd, rec, 0, recLen, headerLen + i * recLen); return parseInt(rec.toString('latin1', 1).trim(), 10) })
  closeSync(fd)
  return out
}

/* ── 3 · run ────────────────────────────────────────────────────────────── */

const clip = await clipRings()
console.log(`clip: ${clip.label} (${clip.rings.length} ring${clip.rings.length > 1 ? 's' : ''})`)
const rawCache = join(CACHE, 'aoi_a_raw.json')
let raw
if (existsSync(rawCache) && !args.includes('--rescan')) {
  raw = JSON.parse(readFileSync(rawCache, 'utf8'))
  console.log(`using cached scan (${raw.length.toLocaleString()} polygons) — pass --rescan to re-read the .shp`)
} else {
  raw = scan(shpPath, AOI_A)
  mkdirSync(CACHE, { recursive: true })
  writeFileSync(rawCache, JSON.stringify(raw))
}

const centroid = (r) => [r.reduce((a, p) => a + p[0], 0) / r.length, r.reduce((a, p) => a + p[1], 0) / r.length]
const [W, S, E, N] = AOI_A
const kept = raw.filter((b) => {
  const c = centroid(b.ring)
  return c[0] >= W && c[0] <= E && c[1] >= S && c[1] <= N && clip.rings.some((ring) => inRing(c, ring))
})
const fids = readFids(dbfPath, kept.map((b) => b.index))

const Q = 1e6
const rings = kept.map((b) => {
  const out = []
  let px = 0, py = 0
  b.ring.slice(0, -1).forEach(([x, y], i) => {             // drop the closing vertex
    const qx = Math.round((x - W) * Q), qy = Math.round((y - S) * Q)
    if (i === 0) out.push(qx, qy); else out.push(qx - px, qy - py)
    px = qx; py = qy
  })
  return out
})

writeFileSync(OUT, JSON.stringify({
  source: 'GISTDA BD_footprintTH (building footprints, WGS84)',
  clip: clip.label,
  bbox: AOI_A, q: Q, count: kept.length,
  fid: fids || kept.map((b) => b.index),
  rings,
}))
const kb = (JSON.stringify(rings).length / 1024).toFixed(0)
console.log(`wrote ${OUT}\n  ${kept.length.toLocaleString()} buildings inside the clip (of ${raw.length.toLocaleString()} touching AOI-A) · rings ≈ ${kb} KB`)
