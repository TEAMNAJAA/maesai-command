/* ══════════════════════════════════════════════════════════════════════════
   OSM points of interest for Mae Sai — hospitals, schools, temples, offices
   ใช้เป็นโรงพยาบาลรับผู้บาดเจ็บ จุดอพยพ (ที่สูง) และที่ตั้งฐานบัญชาการในองก์ 1–2

     node scripts/fetch-poi.mjs

   Output: src/data/osm_maesai_poi.geojson   (© OpenStreetMap contributors, ODbL)
   ══════════════════════════════════════════════════════════════════════════ */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '..', 'src', 'data', 'osm_maesai_poi.geojson')
const AOI_A = '20.405,99.83,20.475,99.965'      // S,W,N,E — matches AOI-A

const query = `[out:json][timeout:90];
(
  nwr["amenity"~"^(hospital|clinic|school|college|university|place_of_worship|townhall|police|fire_station|community_centre)$"](${AOI_A});
  nwr["office"="government"](${AOI_A});
  nwr["leisure"~"^(stadium|sports_centre)$"](${AOI_A});
);
out center tags;`

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
const kindOf = (t) => t.amenity || (t.office ? 'government' : t.leisure) || 'other'
const features = json.elements
  .map((e) => ({ e, lon: e.lon ?? e.center?.lon, lat: e.lat ?? e.center?.lat }))
  .filter(({ lon, lat }) => lon !== undefined && lat !== undefined)
  .map(({ e, lon, lat }) => ({
    type: 'Feature',
    properties: { osm: `${e.type}/${e.id}`, kind: kindOf(e.tags), name: e.tags.name || e.tags['name:th'] || '', name_en: e.tags['name:en'] || '' },
    geometry: { type: 'Point', coordinates: [r5(lon), r5(lat)] },
  }))

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify({ type: 'FeatureCollection', attribution: '© OpenStreetMap contributors (ODbL)', fetched: new Date().toISOString(), features }))
const count = features.reduce((m, f) => ((m[f.properties.kind] = (m[f.properties.kind] || 0) + 1), m), {})
console.log(`wrote ${OUT}\n${features.length} POIs`, count)
