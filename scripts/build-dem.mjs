/* ══════════════════════════════════════════════════════════════════════════
   DEM relief for the two AOIs — SRTM-derived terrain, baked for offline use
   สร้างภาพความสูงภูมิประเทศ (hillshade) + กริดความสูง จากข้อมูล DEM สาธารณะ

     node scripts/build-dem.mjs

   Source : AWS Terrain Tiles (Terrarium encoding; SRTM and other public DEMs)
            https://registry.opendata.aws/terrain-tiles/
   Output : src/data/dem_<aoi>.jpg   hillshade + hypsometric tint, Web-Mercator
            src/data/dem_<aoi>.json  bbox + coarse elevation grid (m)

   The same AOI boxes are used by the map, so the image drops straight onto the
   EPSG:3857 projection in src/lib/geo.js. Replace with Sphere Elevation once a
   key is issued — the JSON shape is the contract the app reads.
   ══════════════════════════════════════════════════════════════════════════ */

import { chromium } from 'playwright'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA = join(HERE, '..', 'src', 'data')

const AOIS = [
  // id, bbox [W,S,E,N], tile zoom, output width px, grid step px, vertical exaggeration
  { id: 'aoi_b', bbox: [99.38, 20.31, 99.88, 20.605], z: 12, width: 1200, step: 10, zf: 1.4 },
  { id: 'aoi_a', bbox: [99.83, 20.405, 99.965, 20.475], z: 14, width: 1200, step: 10, zf: 2.2 },
]

const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z
const lat2y = (lat, z) => {
  const r = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z
}

async function tilePng(z, x, y) {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
  for (let i = 0; i < 3; i++) {
    const r = await fetch(url)
    if (r.ok) return 'data:image/png;base64,' + Buffer.from(await r.arrayBuffer()).toString('base64')
  }
  throw new Error('tile failed ' + url)
}

const browser = await chromium.launch()
const page = await browser.newPage()
mkdirSync(DATA, { recursive: true })

for (const a of AOIS) {
  const [W, S, E, N] = a.bbox
  const fx0 = lon2x(W, a.z), fx1 = lon2x(E, a.z), fy0 = lat2y(N, a.z), fy1 = lat2y(S, a.z)
  const tx0 = Math.floor(fx0), tx1 = Math.floor(fx1), ty0 = Math.floor(fy0), ty1 = Math.floor(fy1)
  const tiles = []
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    tiles.push({ tx: tx - tx0, ty: ty - ty0, url: await tilePng(a.z, tx, ty) })
  }
  console.log(`${a.id}: ${tiles.length} tiles @ z${a.z}`)

  const latMid = (S + N) / 2
  const metersPerPx = (156543.03392 * Math.cos((latMid * Math.PI) / 180)) / 2 ** a.z

  const out = await page.evaluate(async ({ tiles, cols, rows, crop, outW, step, zf, mpp }) => {
    const mosaic = document.createElement('canvas')
    mosaic.width = cols * 256; mosaic.height = rows * 256
    const mctx = mosaic.getContext('2d')
    for (const t of tiles) {
      const img = new Image(); img.src = t.url; await img.decode()
      mctx.drawImage(img, t.tx * 256, t.ty * 256)
    }
    const { x0, y0, w, h } = crop
    const px = mctx.getImageData(Math.floor(x0), Math.floor(y0), Math.ceil(w), Math.ceil(h)).data
    const iw = Math.ceil(w), ih = Math.ceil(h)
    const elev = new Float32Array(iw * ih)
    let min = 1e9, max = -1e9
    for (let i = 0; i < iw * ih; i++) {
      const e = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768
      elev[i] = e; if (e < min) min = e; if (e > max) max = e
    }
    const at = (x, y) => elev[Math.min(ih - 1, Math.max(0, y)) * iw + Math.min(iw - 1, Math.max(0, x))]

    // Horn hillshade, sun from the north-west — the cartographic convention.
    const az = (315 * Math.PI) / 180, zen = ((90 - 42) * Math.PI) / 180
    const ramp = [[0, [24, 52, 36]], [0.25, [44, 78, 46]], [0.5, [78, 92, 56]], [0.75, [112, 98, 70]], [1, [150, 140, 122]]]
    const tint = (t) => {
      for (let i = 1; i < ramp.length; i++) if (t <= ramp[i][0]) {
        const [a0, c0] = ramp[i - 1], [a1, c1] = ramp[i], u = (t - a0) / (a1 - a0)
        return c0.map((c, k) => c + (c1[k] - c) * u)
      }
      return ramp[ramp.length - 1][1]
    }
    const shade = document.createElement('canvas')
    shade.width = iw; shade.height = ih
    const sctx = shade.getContext('2d')
    const img = sctx.createImageData(iw, ih)
    for (let y = 0; y < ih; y++) for (let x = 0; x < iw; x++) {
      const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1)
      const d = at(x - 1, y), f = at(x + 1, y)
      const g = at(x - 1, y + 1), hh = at(x, y + 1), k = at(x + 1, y + 1)
      const dzdx = ((c + 2 * f + k) - (a + 2 * d + g)) / (8 * mpp)
      const dzdy = ((g + 2 * hh + k) - (a + 2 * b + c)) / (8 * mpp)
      const slope = Math.atan(zf * Math.hypot(dzdx, dzdy))
      const aspect = Math.atan2(dzdy, -dzdx)
      let s = Math.cos(zen) * Math.cos(slope) + Math.sin(zen) * Math.sin(slope) * Math.cos(az - aspect)
      s = 0.32 + Math.max(0, s) * 0.95
      const col = tint((at(x, y) - min) / (max - min || 1))
      const o = (y * iw + x) * 4
      img.data[o] = Math.min(255, col[0] * s); img.data[o + 1] = Math.min(255, col[1] * s)
      img.data[o + 2] = Math.min(255, col[2] * s); img.data[o + 3] = 255
    }
    sctx.putImageData(img, 0, 0)
    const outH = Math.round((outW * ih) / iw)
    const fin = document.createElement('canvas')
    fin.width = outW; fin.height = outH
    const fctx = fin.getContext('2d')
    fctx.imageSmoothingQuality = 'high'
    fctx.drawImage(shade, 0, 0, outW, outH)
    const jpeg = fin.toDataURL('image/jpeg', 0.84)

    // coarse grid for the elevation read-out under the cursor
    const gw = Math.floor(iw / step), gh = Math.floor(ih / step), grid = []
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      grid.push(Math.round(at(Math.floor((gx + 0.5) * step), Math.floor((gy + 0.5) * step))))
    }
    return { jpeg, gw, gh, grid, min: Math.round(min), max: Math.round(max), outW, outH }
  }, {
    tiles, cols: tx1 - tx0 + 1, rows: ty1 - ty0 + 1,
    crop: { x0: (fx0 - tx0) * 256, y0: (fy0 - ty0) * 256, w: (fx1 - fx0) * 256, h: (fy1 - fy0) * 256 },
    outW: a.width, step: a.step, zf: a.zf, mpp: metersPerPx,
  })

  writeFileSync(join(DATA, `dem_${a.id}.jpg`), Buffer.from(out.jpeg.split(',')[1], 'base64'))
  writeFileSync(join(DATA, `dem_${a.id}.json`), JSON.stringify({
    source: 'AWS Terrain Tiles (Terrarium) — SRTM-derived DEM',
    bbox: a.bbox, zoom: a.z, minElev: out.min, maxElev: out.max,
    image: { width: out.outW, height: out.outH },
    grid: { w: out.gw, h: out.gh, values: out.grid },
  }))
  console.log(`  → dem_${a.id}.jpg ${out.outW}×${out.outH}, elevation ${out.min}–${out.max} m, grid ${out.gw}×${out.gh}`)
}

await browser.close()
