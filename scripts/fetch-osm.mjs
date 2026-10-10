/* ══════════════════════════════════════════════════════════════════════════
   OSM extract for the Mae Sai urban AOI — rivers + road network
   ดึงแนวแม่น้ำและถนนจาก OpenStreetMap มาเก็บเป็นไฟล์ในโปรเจกต์ (ใช้แบบ offline)

     node scripts/fetch-osm.mjs

   Output: src/data/osm_maesai.geojson   (© OpenStreetMap contributors, ODbL)
   Main roads + rivers cover AOI-A; local streets only the town core, where the
   offline router needs them. Coordinates are rounded to ~1 m.
   ══════════════════════════════════════════════════════════════════════════ */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'src', 'data', 'osm_maesai.geojson')

const AOI_A = '20.405,99.83,20.475,99.965'      // S,W,N,E — matches AOI-A
const TOWN = '20.425,99.855,20.462,99.905'      // town core around the 4 watch communities

const query = `[out:json][timeout:90];
(
  way["waterway"~"^(river|stream)$"](${AOI_A});
  way["highway"~"^(trunk|primary|secondary|tertiary)(_link)?$"](${AOI_A});
  way["highway"~"^(residential|unclassified|living_street)$"](${TOWN});
);
out geom;`

// Public Overpass instances are often busy — try mirrors in turn.
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
let json = null
for (const url of [...ENDPOINTS, ...ENDPOINTS]) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'maesai-command-edu/1.0' },
    })
    if (res.ok) { json = await res.json(); break }
    console.warn(`${url} → HTTP ${res.status}, trying next`)
  } catch (e) {
    console.warn(`${url} → ${e.message}, trying next`)
  }
}
if (!json) throw new Error('all Overpass endpoints failed')

const r5 = (v) => Math.round(v * 1e5) / 1e5
const features = json.elements
  .filter((e) => e.type === 'way' && e.geometry?.length > 1)
  .map((e) => ({
    type: 'Feature',
    properties: {
      osm: e.id,
      kind: e.tags.waterway ? 'river' : 'road',
      class: e.tags.waterway || e.tags.highway,
      name: e.tags.name || '',
      name_en: e.tags['name:en'] || '',
      ref: e.tags.ref || '',
      oneway: e.tags.oneway === 'yes',
    },
    geometry: { type: 'LineString', coordinates: e.geometry.map((p) => [r5(p.lon), r5(p.lat)]) },
  }))

const fc = {
  type: 'FeatureCollection',
  attribution: '© OpenStreetMap contributors (ODbL)',
  fetched: new Date().toISOString(),
  bbox: [99.83, 20.405, 99.965, 20.475],
  features,
}
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(fc))
const count = features.reduce((m, f) => ((m[f.properties.class] = (m[f.properties.class] || 0) + 1), m), {})
console.log(`wrote ${OUT}\n${features.length} ways`, count)
