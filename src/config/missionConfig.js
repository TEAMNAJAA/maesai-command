/* ══════════════════════════════════════════════════════════════════════════
   MISSION CONFIG — ไฟล์ตั้งค่ากลางของภารกิจ
   ทุกเกณฑ์ ค่าน้ำหนัก อัตราเยียวยา และที่อยู่ข้อมูลอยู่ที่นี่ที่เดียว
   แก้ค่าในไฟล์นี้แล้ว `npm run build` — ไม่ต้องแตะโค้ดคอมโพเนนต์

   วิธีเสียบข้อมูลจริงจาก GISTDA (ดูหัวข้อ DATA ด้านล่าง):
     1. วางไฟล์ไว้ใน src/data/   (Shapefile ให้แปลงเป็น GeoJSON ก่อน เช่นด้วย
        QGIS → Export → GeoJSON, CRS = EPSG:4326 หรือ mapshaper.org)
     2. เพิ่มบรรทัด import ด้านบน แล้วใส่ตัวแปรลงช่องที่ตรงกันใน DATA
     3. npm run build — ข้อมูลจะถูกฝังใน dist/index.html จึงยังเปิด offline ได้
   ══════════════════════════════════════════════════════════════════════════ */

import aoiGeoJsonRaw from '../../gistda-request/MaeSai_AOI_ALL.geojson?raw'
import osmMaeSai from '../data/osm_maesai.geojson?raw'
import demA from '../data/dem_aoi_a.json'
import demB from '../data/dem_aoi_b.json'
import demAImage from '../data/dem_aoi_a.jpg'
import demBImage from '../data/dem_aoi_b.jpg'
// ชั้นอาคารจริง GISTDA (BD_footprintTH) ตัดเหลือ AOI-A ∩ อ.แม่สาย ด้วย scripts/extract-buildings.mjs
import buildingsMaeSai from '../data/buildings_maesai.json'

// ── ข้อมูลจริงจาก GISTDA (ยังไม่มี — เปิดคอมเมนต์เมื่อได้ไฟล์) ────────────────
// import radarFloodRaw from '../data/radar_flood_2024-09-12.geojson?raw'
// import landslideRaw  from '../data/landslide_scars_2024.geojson?raw'
// import theosBefore   from '../data/theos2_maesai_2024-03.jpg'
// import theosAfter    from '../data/theos2_maesai_2024-09-17.jpg'

const parse = (raw) => (raw ? JSON.parse(raw) : null)

/* ── 1 · SFVI — Sai Flood Vulnerability Index ────────────────────────────── */
export const SFVI = {
  weights: { W: 0.30, R: 0.25, L: 0.20, N: 0.15, P: 0.10 },
  rainNormMm: 250,       // R = ฝนสะสมบ้านโจตาดา ÷ 250 มม. (เพดานที่ทีมกำหนด)
  decisionBand: 0.62,    // SFVI ≥ ค่านี้ = มีหลักฐานพอสั่งอพยพ
}

/* ── 2 · เกณฑ์ระดับน้ำ / ลำน้ำ ──────────────────────────────────────────── */
export const THRESHOLDS = {
  criticalLevel: 4.20,   // ม. สถานีบ้านถ้ำผาจม (กรมทรัพยากรน้ำ) → Veto 1
  prepLevel: 4.01,       // ม. ระดับเตือนภัยเตรียมพร้อม
  origChannelWidth: 150, // ม. ความกว้างลำน้ำสายเดิม
  // Logic matrix: ลำน้ำเหลือ < ครึ่งหนึ่ง → ลดเกณฑ์เตือนภัยลงและเตือนเร็วขึ้น
  narrowChannelRatio: 0.5,
  narrowChannelPrepDrop: 0.20, // ม. ที่ลดจาก prepLevel เมื่อเข้าเงื่อนไข
}

/* ── 3 · Cloud rule (Veto 2) ─────────────────────────────────────────────── */
export const CLOUD_RULE = {
  cloudPct: 60,          // เมฆเกินค่านี้ → ภาพเชิงแสงเชื่อถือไม่ได้
  staleImageHours: 48,   // หรือภาพล่าสุดเก่ากว่านี้
  lWeightFactor: 0.4,    // น้ำหนัก L ถูกคูณด้วยค่านี้ (0.20 → 0.08)
  opticalLockPct: 100,   // เมฆถึงค่านี้ → ปิดชั้นภาพเชิงแสงอัตโนมัติ (องก์ 2)
}

/* ── 4 · Trust model ─────────────────────────────────────────────────────── */
export const TRUST = {
  falseAlarmPenalties: [5, 15, 40], // เตือนผิดครั้งที่ 1 / 2 / 3+
  lateWarningPenalty: 30,           // เตือนช้า (สั่งครั้งแรกในองก์ 2)
  justifiedBonus: 2.5,
}

/* ── 5 · เกณฑ์เยียวยา (มติ ครม. 17 ก.ย. 2567 — ยืนยันค่าปี 2569 กับหน่วยงานก่อนใช้จริง) */
export const RELIEF = {
  flatGrant: 9000,        // บาท/ครัวเรือน เหมาจ่าย
  mudGrant: 10000,        // บาท/หลัง ค่าล้างโคลน
  surveyCost: 1500,       // บาท ส่งทีมสำรวจภาคพื้น
  inundationMinDays: 7,   // วันท่วมขังขั้นต่ำ (จากไทม์ซีรีส์เรดาร์)
}

/* ── 6 · THEOS-2 ─────────────────────────────────────────────────────────── */
export const THEOS2 = { swathKm: 10.3, panM: 0.5, msM: 2, revisitDays: 1.9, product: 'Level 3 Ortho (AWAGAD)' }

/* ── 7 · กติกาเกม ────────────────────────────────────────────────────────── */
export const GAME = {
  apMax: 10000,
  coinsMax: 14,
  swaths: 3,
  swathAP: 1200,
  swathMinutes: 95,        // เวลาที่ใช้ต่อการสั่งถ่าย 1 แถบ
  evacAP: { 1: 1500, 2: 700, 3: 700 },
  standbyAP: 700,
  holdMinutes: 180,        // "ยังไม่สั่งการ รอภาพรอบหน้า"
  detourAP: 500,
  autoRunStepMin: 15,
  autoRunTickMs: 900,
  act2Seed: { ap: 1250, trust: 42 },  // ค่าตั้งต้นเมื่อกระโดดเข้าองก์ 2 ผ่านแถบองก์
  act3SeedTrust: 72,
}

/* ── 8 · Scenario hydrograph (ค่าสถานการณ์ — ปรับเมื่อได้ข้อมูลสถานีจริง) ─── */
// ระดับน้ำ/ฝน/เมฆ เป็นฟังก์ชันของเวลาเท่านั้น (ผู้เล่นเปลี่ยนแม่น้ำไม่ได้)
export const HYDRO = {
  baseLevel: 3.62,         // ม. ที่ T−48
  driftPerHour: 0.003,     // ม./ชม. ระดับขยับช้า ๆ ก่อนมวลน้ำมาถึง
  peakLevel: 5.40,         // ม. ยอดน้ำ
  peakAtMin: 120,          // นาทีหลัง T0
  riseExponent: 7.4,       // ยิ่งมาก = ขึ้นช้าแล้วพุ่งตอนท้าย (เวลาเตือนจริง 2–4 ชม.)
  recessBase: 3.70,
  recessTauMin: 1064,      // ลดลงต่ำกว่า 4.20 ราว T+24 ชม.
  rainStartMm: 178,
  rainAddMm: 160,          // ฝนสะสมเพิ่มจนถึง T0
  cloudEarlyPct: [8, 30],  // เมฆช่วงต้น (T−48 → T−12)
  cloudFullAtMin: -60,     // เมฆ 100% ตั้งแต่ T−1 ชม.
  cloudClearAtMin: 30 * 60,
  trueChannelWidth: 28,    // ม. ความกว้างจริง (สิ่งที่ THEOS-2 จะวัดได้)
  evacRateHHPerMinPerExit: 3,
  mobiliseMin: 30,         // นาทีตั้งแต่ประกาศจนเริ่มเคลื่อนย้าย (ไซเรน/SMS)
  mudCmPerMetre: 30,       // ซม. โคลนต่อความลึกน้ำ 1 ม. (ป่าต้นน้ำถูกทำลาย)
}

/* ── 9 · ยึดเวลาเกมกับเหตุการณ์จริง ก.ย. 2567 ─────────────────────────────── */
export const EVENT = {
  // T0 = ยอดน้ำเข้าเขตเมือง (ค่าสถานการณ์ที่วางให้สอดคล้องกับภาพเรดาร์ 10–12 ก.ย. 2567)
  t0ISO: '2024-09-11T06:00:00+07:00',
  beforeImageLabel: 'THEOS-2 · ม.ค.–เม.ย. 2567 (ก่อนเหตุการณ์)',
  afterImageLabel: 'THEOS-2 · 17 ก.ย. 2567 (หลังน้ำลด)',
  radarDates: ['10 ก.ย. 2567', '12 ก.ย. 2567'],
  floodRai: [{ d: '08 ก.ย.', rai: 1240 }, { d: '10 ก.ย.', rai: 6182 }, { d: '11 ก.ย.', rai: 14900 },
    { d: '12 ก.ย.', rai: 25204 }, { d: '14 ก.ย.', rai: 19600 }, { d: '17 ก.ย.', rai: 8420 }],
}

/* ── 10 · DATA — ที่อยู่ข้อมูลเชิงพื้นที่ ───────────────────────────────── */
export const DATA = {
  aoi: parse(aoiGeoJsonRaw),                     // ขอบเขต AOI-A/B/B1 + สถานี + ชุมชน (ทีม revenge)
  aoiSource: 'gistda-request/MaeSai_AOI_ALL.geojson',
  kml: {
    all: 'gistda-request/MaeSai_AOI_ALL.kml',
    urban: 'gistda-request/AOI-A_SaiRiver_MaeSai-Urban.kml',
    catchment: 'gistda-request/AOI-B_SaiRiver_Upper-Catchment.kml',
    priority: 'gistda-request/AOI-B1_SaiRiver_Upper-Catchment_Priority.kml',
  },
  osm: parse(osmMaeSai),                          // ถนน + แม่น้ำ (© OpenStreetMap, scripts/fetch-osm.mjs)
  dem: {                                          // ภาพความสูง SRTM (scripts/build-dem.mjs)
    catchment: { ...demB, href: demBImage },
    urban: { ...demA, href: demAImage },
  },
  // ช่องสำหรับข้อมูลจริงจาก GISTDA — ใส่แล้วแผนที่จะแสดงทันที
  radarFlood: null,      // parse(radarFloodRaw)  ขอบเขตน้ำท่วมจากเรดาร์ (เช็คน้ำ / Disaster Platform)
  landslides: null,      // parse(landslideRaw)   ร่องรอยดินถล่ม (แสดงในแถบที่สั่งถ่ายแล้ว)
  buildings: buildingsMaeSai, // อาคารจริง GISTDA 15,851 หลัง (รูปแบบย่อ — ดู scripts/extract-buildings.mjs)
  theosImagery: {        // ภาพ THEOS-2 ก่อน–หลัง (จัดให้ตรงกรอบ bbox ด้านล่าง)
    before: null,        // theosBefore
    after: null,         // theosAfter
    bbox: [99.83, 20.405, 99.965, 20.475],      // [W,S,E,N] = AOI-A
  },
  // ถ้าเปิดผ่านเว็บเซิร์ฟเวอร์ (http/https) จะโหลด URL เหล่านี้ทับค่าด้านบนตอนรัน
  runtimeUrls: { radarFlood: '', landslides: '', buildings: '' },
}

/* ── 10b · โซนน้ำถึง (ค่าสถานการณ์ — ใช้ขอบเขตน้ำท่วมเรดาร์แทนทันทีที่มี DATA.radarFlood) ── */
// หลังคาอยู่ในโซนน้ำถึงถ้า: ห่างแม่น้ำสาย ≤ riverNearM  หรือ  (ห่าง ≤ riverFarM และพื้น DEM ≤ maxElevM)
export const FLOOD_REACH = {
  riverNearM: 150,
  riverFarM: 800,
  maxElevM: 400,         // ม. รทก. (SRTM) — ชุมชนริมน้ำแม่สายอยู่ราว 393–402 ม.
  communityZoneM: 300,   // หลังคาเป็นของชุมชนที่ใกล้ที่สุดภายในรัศมีนี้ → ใช้คำนวณ P จริง
}

/* ── 10c · แนวตลิ่งเมือง — จุดฟันหลอของแนวกั้นน้ำ (องก์ 1 สเต็ป 2) ─────────────── */
// วางบนแม่น้ำสายจริง (OSM) ฝั่งไทย = ฝั่งที่มีหลังคา GISTDA · ตำแหน่ง/ความยาวจุดฟันหลอเป็นค่าสถานการณ์
export const EMBANKMENT = {
  bbox: [99.8745, 20.4352, 99.8955, 20.4532],   // [W,S,E,N] มุมมอง "แนวตลิ่งเมือง" ≈ ซูม 16 (ภาพ sphere z17)
  stretch: [99.8755, 99.8945],   // ช่วงลองจิจูดของแม่น้ำสายที่วางแนวกั้นน้ำ
  bankOffsetM: 16,               // แนวกั้นน้ำห่างกึ่งกลางลำน้ำ (ลำน้ำกว้าง ~28 ม.)
  gaps: 14,                      // จำนวนจุดฟันหลอ
  gapLenM: [18, 64],             // ช่วงความยาวช่องโหว่ (ม.)
  sealAP: 150,                   // AP ต่อการอุด 1 จุด
  sealMinutes: 5,                // เวลาต่อจุด
  bagsPerMetre: 2,               // บิ๊กแบ็กต่อความยาว 1 ม. (วางสองแถว)
  measureMinutes: 15,            // วัดความกว้างลำน้ำจากภาพ (ค่า N)
  rulerAt: 0.36,                 // ตำแหน่งไม้บรรทัดวัดลำน้ำตามแนวแม่น้ำ (0–1)
}

/* ── 10d · ภารกิจองก์ 1 (Mission Quest) ─────────────────────────────────────── */
export const QUEST = {
  // สเต็ป 1 สำเร็จเมื่อใช้แถบถ่ายภาพครบ หรือเมฆปิดหน้าต่างภาพแล้ว (ต้องมีภาพที่ใช้ได้อย่างน้อย 1 แถบ)
  // สเต็ป 2 สำเร็จเมื่อวัดค่า N แล้ว และอุดจุดฟันหลอครบ sealTarget จุด
  sealTarget: 14,
}

/* ── 11 · GISTDA sphere API (https://sphere.gistda.or.th/docs) ───────────── */
// คีย์ของทีม (ตั้งทับได้ด้วย .env.local → VITE_SPHERE_API_KEY=...)
// หมายเหตุ: คีย์ถูกฝังใน dist/index.html และอยู่ใน git — repo ต้องเป็น private เท่านั้น
export const SPHERE = {
  apiKey: import.meta.env.VITE_SPHERE_API_KEY || '2740131611D8403286C4296EE0E1583D',
  routingUrl: 'https://api.sphere.gistda.or.th/services/route/route',
  routingMode: 't',      // t = เลี่ยงถนนปิด/น้ำท่วม · c = เร็วสุด · d = สั้นสุด
  elevationUrl: 'https://api.sphere.gistda.or.th/services/geo/elevation',
  tileUrl: 'https://basemap.sphere.gistda.or.th/tiles/{layer}/EPSG3857/{z}/{x}/{y}.jpeg?key={key}',
  tileLayer: 'thailand_images', // sphere_streets · thailand_images · sphere_hybrid
  basemap: { urban: true, corridor: true, catchment: false }, // ภาพ sphere ครอบคลุมเฉพาะไทย — ลุ่มน้ำเมียนมาใช้ DEM
  maxZoom: 19,
  timeoutMs: 7000,
}

/* ตัวคำนวณเส้นทางสำรองแบบออฟไลน์ (ใช้เมื่อไม่มีคีย์ sphere / ไม่มีอินเทอร์เน็ต) */
export const OFFLINE_ROUTING = {
  floodBufferM: 200,     // ปิดถนนที่อยู่ห่างแม่น้ำสายไม่เกินค่านี้ (องก์ 2) — ถ้ามีข้อมูลเรดาร์จะใช้ขอบเขตจริงแทน
  originExemptM: 300,    // ถนนรอบชุมชนต้นทางยังใช้ได้ (ลุยน้ำออกมาถึงถนนหลัก)
  convoyKmh: 18,         // ความเร็วขบวนอพยพเฉลี่ย
}

/* ── 12 · คะแนนความสำเร็จภารกิจ (AAR) — น้ำหนักรวม = 1 ─────────────────────── */
export const SCORE = {
  warning: 0.35,   // ครัวเรือนที่พ้นภัยทัน (จากเวลาที่สั่งอพยพแต่ละชุมชน)
  relief: 0.25,    // ตัดสินเยียวยาถูกต้อง
  triage: 0.15,    // จัดลำดับ 4 ชุมชนตรงกฎ SFVI + tie-break
  trust: 0.15,     // ความเชื่อมั่นประชาชนตอนจบ
  evidence: 0.10,  // ใช้หลักฐาน (สั่งถ่ายภาพ + เปิดชั้นข้อมูลก่อนตัดสินใจ)
}

/* ── 13 · Sandbox test / logging ─────────────────────────────────────────── */
export const EVAL = {
  minLayersBeforeDecision: 3,  // เกณฑ์: เปิดข้อมูล ≥ 3 ชั้นก่อนตัดสินใจ
  passShare: 0.70,             // ผู้เล่น ≥ 70% ต้องผ่านเกณฑ์ข้างบน
  postTestGainTarget: 0.30,    // คะแนน Post-test เพิ่ม ≥ 30%
  briefingTargetMin: 10,       // สอนกติกา < 10 นาที
  hintsEnabled: true,          // ปิดเมื่อต้องการวัดพฤติกรรมแบบไม่มีคำแนะนำ
  storageKey: 'maesai-command.eval.v1',
}
