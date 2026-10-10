/* ══════════════════════════════════════════════════════════════════════════
   SCENARIO DATA — ข้อมูลฉากของภารกิจ (ชุมชน · พื้นที่ต้นน้ำ · ชั้นข้อมูล · หลังคาเรือน)
   ค่าที่ติดป้าย "ค่าสถานการณ์" ทั้งหมดอยู่ที่นี่ — แทนด้วยข้อมูลจริงได้ทันทีที่ได้มา
   (จำนวนครัวเรือนจริง → ปภ.เชียงราย / เทศบาลตำบลแม่สาย)
   ══════════════════════════════════════════════════════════════════════════ */

import {
  Megaphone, Hammer, Droplets, Plane, Stethoscope, Radio, Package, Truck, Ship, Fuel, Users,
} from 'lucide-react'

/* Four data-provenance labels — ป้ายกำกับที่มาของข้อมูล 4 แบบ (สีตามที่ทีมกำหนด) */
export const SRC = {
  measured: { code: 'MEASURED', short: 'วัดจริง', th: 'วัดจริง', hex: '#22E36B',
    note: 'วัดจากสถานี/สำรวจภาคพื้นจริง — กรมทรัพยากรน้ำ, ThaiWater, OpenStreetMap' },
  image: { code: 'THEOS-2', short: 'ภาพ THEOS-2', th: 'วัดจากภาพ THEOS-2', hex: '#38BDF8',
    note: 'วิเคราะห์จากภาพ THEOS-2 Level 3 Ortho (AWAGAD)' },
  radar: { code: 'RADAR', short: 'เรดาร์', th: 'เรดาร์', hex: '#FF8A3D',
    note: 'ข้อมูลเรดาร์ — RADARSAT-2 ผ่าน เช็คน้ำ / Disaster Platform · DEM จาก SRTM' },
  scenario: { code: 'SCENARIO', short: 'สถานการณ์', th: 'ค่าสถานการณ์', hex: '#94A3B8',
    note: 'ค่าที่ทีมตั้งขึ้นเพื่อจำลอง — ไม่ใช่ค่าวัดจริง' },
}

/* The four DDPM watch communities — 4 ชุมชนเฝ้าระวัง
   lon/lat ของเกาะทราย ไม้ลุงขน เหมืองแดง อ่านจาก MaeSai_AOI_ALL.geojson ตอนรัน
   (ค่าในนี้เป็นค่าสำรอง) · สายลมจอยยังไม่มีในไฟล์ → ตำแหน่งประมาณ รอยืนยัน
   floodStage = ระดับที่สถานีถ้ำผาจมซึ่งน้ำเริ่มเข้าชุมชน (ค่าสถานการณ์)
   x/y = ตำแหน่งบนฉากจำลอง (procedural corridor) */
export const COMMUNITIES = [
  { id: 'slj', name: 'Sai Lom Joy', th: 'สายลมจอย', full: 'ชุมชนสายลมจอย ม.1 ต.เวียงพางคำ',
    lon: 99.8782, lat: 20.4438, approx: true, radiusM: 140, label: 'w',
    households: 412, pop: 1486, P: 0.86, exits: 1, floodStage: 4.10, x: 545, y: 232 },
  { id: 'ksa', name: 'Koh Sai', th: 'เกาะทราย', full: 'ชุมชนเกาะทราย ม.7 ต.แม่สาย',
    lon: 99.8832, lat: 20.4433, radiusM: 150, label: 'n',
    households: 638, pop: 2310, P: 0.86, exits: 2, floodStage: 4.20, x: 470, y: 372 },
  { id: 'mlk', name: 'Mai Lung Khon', th: 'ไม้ลุงขน', full: 'ชุมชนไม้ลุงขน ต.แม่สาย',
    lon: 99.8870, lat: 20.4401, radiusM: 120, label: 'sw',
    households: 521, pop: 1902, P: 0.68, exits: 3, floodStage: 4.45, x: 566, y: 470 },
  { id: 'mdg', name: 'Muang Daeng', th: 'เหมืองแดง', full: 'ชุมชนเหมืองแดง ต.แม่สาย',
    lon: 99.8896, lat: 20.4401, radiusM: 120, label: 'e',
    households: 389, pop: 1402, P: 0.55, exits: 2, floodStage: 4.70, x: 430, y: 560 },
]

/* Evacuation point on higher ground (~416 m vs town ~395 m, SRTM) — ตำแหน่งสมมติ */
export const SHELTER = { th: 'จุดอพยพบนที่สูง (สมมติ)', name: 'Evacuation point (scenario)', lon: 99.8806, lat: 20.4187 }

/* Upstream catchment sectors inside Myanmar — no ground sensors reachable.
   lon/lat = ศูนย์กลางแถบถ่ายภาพ THEOS-2 (กว้าง 10.3 กม.) ภายใน AOI-B
   x/y = ตำแหน่งบนฉากจำลอง (ใช้วาดรอยดินถล่มบนภาพ after) */
export const SECTORS = [
  { id: 'A', label: 'SECTOR A', th: 'ต้นน้ำเหนือสุด', lon: 99.455, lat: 20.535, scars: 3, widthAt: null, forestLoss: 14.2, x: 118, y: 96 },
  { id: 'B', label: 'SECTOR B', th: 'ไหล่เขาตะวันตก', lon: 99.48, lat: 20.405, scars: 4, widthAt: null, forestLoss: 21.7, x: 300, y: 74 },
  { id: 'C', label: 'SECTOR C', th: 'พื้นที่เหมืองแร่', lon: 99.6, lat: 20.52, scars: 5, widthAt: null, forestLoss: 38.9, x: 505, y: 108 },
  { id: 'D', label: 'SECTOR D', th: 'ลำน้ำคอด', lon: 99.735, lat: 20.415, scars: 2, widthAt: 28, forestLoss: 9.4, x: 700, y: 168 },
  { id: 'E', label: 'SECTOR E', th: 'ที่ราบก่อนเข้าเมือง', lon: 99.835, lat: 20.465, scars: 1, widthAt: 34, forestLoss: 4.1, x: 872, y: 240 },
  { id: 'F', label: 'SECTOR F', th: 'ป่าต้นน้ำฝั่งตะวันออก', lon: 99.71, lat: 20.535, scars: 2, widthAt: null, forestLoss: 11.8, x: 250, y: 262 },
]
export const TOTAL_SCARS = SECTORS.reduce((s, x) => s + x.scars, 0)   // 17

/* Layer catalogue — every layer is a paid toggle (ชั้นข้อมูลมีราคาเป็นเหรียญ) */
export const LAYERS = [
  { id: 'theos',      group: 'BASE LAYERS',    name: 'THEOS-2 Optical',      sub: 'Pan 0.5 m · MS 2 m',              cost: 3, src: 'image',    optical: true },
  { id: 'sar',        group: 'BASE LAYERS',    name: 'SAR Flood Extent',     sub: 'RADARSAT-2 · เช็คน้ำ',            cost: 2, src: 'radar',    actOnly: 2 },
  { id: 'elev',       group: 'BASE LAYERS',    name: 'DEM / Elevation',      sub: 'SRTM 30 m · Sphere Elevation',    cost: 2, src: 'radar' },
  { id: 'river',      group: 'HYDROLOGY',      name: 'River Network',        sub: 'OpenStreetMap · สาย / รวก',       cost: 1, src: 'measured' },
  { id: 'watershed',  group: 'HYDROLOGY',      name: 'Watershed Boundary',   sub: 'AOI-B · คำนวณจาก DEM',             cost: 1, src: 'scenario' },
  { id: 'roads',      group: 'INFRASTRUCTURE', name: 'Road Network',         sub: 'OpenStreetMap',                   cost: 1, src: 'measured' },
  { id: 'buildings',  group: 'INFRASTRUCTURE', name: 'Buildings Footprint',  sub: 'GISTDA BD_footprint · อาคารจริง',  cost: 3, src: 'image' },
  { id: 'facilities', group: 'INFRASTRUCTURE', name: 'Critical Facilities',  sub: 'Hospitals, Schools, Etc.',        cost: 2, src: 'scenario' },
  { id: 'landx',      group: 'ANALYSIS',       name: 'LANDX Land Use',       sub: 'Upstream forest → mine/agri',     cost: 2, src: 'image',    optical: true },
  { id: 'pop',        group: 'ANALYSIS',       name: 'Community & Population', sub: '4 watch communities · DDPM',   cost: 1, src: 'scenario' },
]

export const TACTICAL = [
  { id: 'evac',  name: 'Evacuation Alert', th: 'ประกาศอพยพ',      icon: Megaphone,   ap: 1500, kind: 'decision' },
  { id: 'road',  name: 'Road Closure',     th: 'ปิดเส้นทาง',       icon: Hammer,      ap: 600 },
  { id: 'pump',  name: 'Water Pump',       th: 'เครื่องสูบน้ำ',     icon: Droplets,    ap: 700 },
  { id: 'drone', name: 'Drone Survey',     th: 'บิน UAV ยืนยันจุด', icon: Plane,       ap: 900 },
  { id: 'med',   name: 'Medical Team',     th: 'หน่วยแพทย์',        icon: Stethoscope, ap: 850 },
  { id: 'comm',  name: 'Communication',    th: 'ตั้งสถานีสื่อสาร',  icon: Radio,       ap: 400 },
]

export const QUICK_DEPLOY = [
  { id: 'bigbag', name: 'Sandbags (Big Bag)', th: 'บิ๊กแบ็ก',      unit: 'Units', stock: 4250, batch: 500, ap: 800, icon: Package },
  { id: 'boat',   name: 'Rescue Boats',       th: 'เรือกู้ภัย',     unit: 'Boats', stock: 12,   batch: 2,   ap: 650, icon: Ship },
  { id: 'patrol', name: 'Ground Patrol',      th: 'ชุดลาดตระเวน',  unit: 'Teams', stock: 24,   batch: 2,   ap: 250, icon: Truck },
]

/* Act 2 — critical shortage board */
export const SHORTAGE = [
  { id: 'sandbags', name: 'SANDBAGS',         th: 'กระสอบทราย', icon: Package,     have: 0,   max: 5000, pct: 0 },
  { id: 'boats',    name: 'RESCUE BOATS',     th: 'เรือกู้ภัย',  icon: Ship,        have: 1,   max: 12,   pct: 8 },
  { id: 'fuel',     name: 'FUEL',             th: 'น้ำมัน',      icon: Fuel,        have: 300, max: 2000, pct: 15 },
  { id: 'teams',    name: 'RESCUE TEAMS',     th: 'ทีมกู้ภัย',   icon: Users,       have: 9,   max: 50,   pct: 18 },
  { id: 'medical',  name: 'MEDICAL SUPPLIES', th: 'เวชภัณฑ์',    icon: Stethoscope, have: 110, max: 500,  pct: 22 },
  { id: 'drones',   name: 'DRONES',           th: 'โดรน',        icon: Plane,       have: 6,   max: 20,   pct: 30 },
]

/* Resolution proof — ข้อพิสูจน์เชิงตัวเลข (pure-pixel fraction = (w−2p)/w) */
export const RES_PROOF = [
  { width: '20 m', s2: 0.0,  ms: 80.0, pan: 95.0 },
  { width: '25 m', s2: 20.0, ms: 84.0, pan: 96.0 },
  { width: '30 m', s2: 33.3, ms: 86.7, pan: 96.7 },
]

/* Act-2 alert script */
export const ACT2_ALERTS = [
  { t: 'T+0:05', tag: 'RESOURCE ALERT',   msg: 'Sandbags depleted along the Koh Sai embankment', lv: 'crit' },
  { t: 'T+0:08', tag: 'EVACUATION ALERT', msg: 'Sai Lom Joy: last exit road under water', lv: 'crit' },
  { t: 'T+0:12', tag: 'FLOOD WARNING',    msg: 'Water level rising rapidly in the Sai River', lv: 'crit' },
  { t: 'T+0:15', tag: 'ROUTE BLOCKED',    msg: 'Landslide detected on Mountain Route 7', lv: 'crit' },
]

export const LESSONS = [
  { n: 1, txt: 'The cause sat upstream, outside the gauge network — satellite evidence was the only early signal.',
          th: 'ต้นเหตุอยู่ต้นน้ำนอกเขตสถานีวัด หลักฐานจากดาวเทียมเป็นสัญญาณล่วงหน้าเพียงอย่างเดียว', tag: 'WARNING' },
  { n: 2, txt: 'A community with one exit needs the earliest order — its evacuation takes longest.',
          th: 'ชุมชนที่เหลือทางออกเส้นเดียวต้องได้คำสั่งก่อน เพราะใช้เวลาอพยพนานที่สุด', tag: 'LOGISTICS' },
  { n: 3, txt: 'Waiting for better evidence has a price measured in households.',
          th: 'การรอข้อมูลที่ครบกว่ามีราคา และวัดเป็นจำนวนครัวเรือนได้', tag: 'DECISION' },
  { n: 4, txt: 'Optical imagery goes blind under 100% cloud — radar must be the default critical-phase sensor, not the fallback.',
          th: 'ภาพเชิงแสงใช้ไม่ได้เมื่อเมฆ 100% เรดาร์ต้องเป็นเซนเซอร์หลักของระยะวิกฤต', tag: 'SENSOR' },
  { n: 5, txt: 'Channel narrowing (150 m → 28 m) raised stage faster than discharge alone predicted; the warning threshold must be lowered.',
          th: 'ลำน้ำแคบลงทำให้ระดับน้ำขึ้นเร็วกว่าที่ปริมาณน้ำทำนาย ต้องลดเกณฑ์เตือนภัย', tag: 'HYDROLOGY' },
  { n: 6, txt: 'Evidence resolution changed relief fairness: low-confidence roofs could not be adjudicated from imagery alone.',
          th: 'ความละเอียดของหลักฐานเปลี่ยนความเป็นธรรมของการเยียวยาได้จริง', tag: 'EQUITY' },
]

/* Act 3 · roof-by-roof relief adjudication (บัญชีหลังคาเรือน) — ค่าสถานการณ์ */
export const ROOFS = [
  { id: 'MS-0142', com: 'Koh Sai',       days: 9,    mud: 'clear',   conf: 0.94, truth: { flat: true,  mud: true  } },
  { id: 'MS-0198', com: 'Sai Lom Joy',   days: 11,   mud: 'clear',   conf: 0.96, truth: { flat: true,  mud: true  } },
  { id: 'MS-0231', com: 'Mai Lung Khon', days: 4,    mud: 'none',    conf: 0.89, truth: { flat: false, mud: false } },
  { id: 'MS-0277', com: 'Muang Daeng',   days: 8,    mud: 'none',    conf: 0.91, truth: { flat: true,  mud: false } },
  { id: 'MS-0304', com: 'Koh Sai',       days: 7,    mud: 'partial', conf: 0.52, truth: { flat: true,  mud: true  } },
  { id: 'MS-0356', com: 'Sai Lom Joy',   days: null, mud: 'partial', conf: 0.31, truth: { flat: true,  mud: false } },
  { id: 'MS-0401', com: 'Mai Lung Khon', days: 6,    mud: 'clear',   conf: 0.88, truth: { flat: false, mud: true  } },
  { id: 'MS-0455', com: 'Muang Daeng',   days: null, mud: 'none',    conf: 0.28, truth: { flat: false, mud: false } },
  { id: 'MS-0512', com: 'Koh Sai',       days: 12,   mud: 'clear',   conf: 0.97, truth: { flat: true,  mud: true  } },
  { id: 'MS-0588', com: 'Sai Lom Joy',   days: 3,    mud: 'partial', conf: 0.44, truth: { flat: false, mud: true  } },
]

/* Pre/Post test — แบบทดสอบ 5 ข้อ (ข้อเดียวกันทั้งก่อนและหลังเรียน เพื่อจับคู่ผลได้) */
export const QUIZ = [
  {
    id: 'q1', topic: 'ลุ่มน้ำสายข้ามพรมแดน',
    q: 'พื้นที่รับน้ำต้นแม่น้ำสาย (เหนือสถานีบ้านถ้ำผาจม) ส่วนใหญ่อยู่ที่ใด?',
    choices: ['อำเภอแม่สาย จังหวัดเชียงราย', 'ประเทศเมียนมา', 'ประเทศลาว', 'อำเภอแม่จัน จังหวัดเชียงราย'],
    answer: 1,
    why: 'ลุ่มน้ำตอนบนราว 965 ตร.กม. อยู่ในเมียนมาเกือบทั้งหมด ไทยจึงตั้งสถานีวัดในพื้นที่ต้นน้ำไม่ได้',
  },
  {
    id: 'q2', topic: 'ดินโคลนถล่มต้นน้ำ',
    q: 'ร่องรอยดินถล่มใหม่ในป่าต้นน้ำส่งผลต่ออุทกภัยที่แม่สายอย่างไร?',
    choices: ['ทำให้ฝนตกน้อยลง', 'ไม่มีผล เพราะอยู่คนละประเทศ', 'น้ำหลากพาตะกอนโคลนมาทับถมบ้านเรือนและทำให้ลำน้ำตื้นแคบลง', 'ทำให้น้ำลดเร็วขึ้น'],
    answer: 2,
    why: 'ดินถล่มคือแหล่งตะกอน น้ำที่มาจึงพาโคลนมาด้วย และลำน้ำสายแคบลงจาก ~150 ม. เหลือ 20–30 ม.',
  },
  {
    id: 'q3', topic: 'ข้อจำกัดดาวเทียมเชิงแสง',
    q: 'ทำไมดาวเทียมเชิงแสง เช่น THEOS-2 จึงใช้ติดตามมวลน้ำระหว่างพายุฝนไม่ได้?',
    choices: ['เพราะถ่ายภาพได้เฉพาะกลางคืน', 'เพราะเมฆบังทำให้ถ่ายภาพพื้นดินไม่ได้', 'เพราะความละเอียดต่ำเกินไป', 'เพราะห้ามถ่ายภาพพื้นที่ชายแดน'],
    answer: 1,
    why: 'แสงที่ตามองเห็นทะลุเมฆไม่ได้ ช่วงเมฆปกคลุม 100% ภาพเชิงแสงจึงใช้ไม่ได้',
  },
  {
    id: 'q4', topic: 'ดาวเทียมเรดาร์',
    q: 'ดาวเทียมเรดาร์ (เช่น RADARSAT-2) มีข้อดีอย่างไรในช่วงน้ำท่วม?',
    choices: ['ถ่ายภาพสีได้สวยกว่า', 'ส่งคลื่นไมโครเวฟเองจึงทะลุเมฆได้ทั้งกลางวันและกลางคืน', 'บินต่ำกว่าเมฆ', 'วัดปริมาณน้ำฝนได้โดยตรง'],
    answer: 1,
    why: 'เรดาร์เป็นเซนเซอร์แอคทีฟ ผิวน้ำเรียบสะท้อนสัญญาณกลับน้อยจึงเห็นพื้นที่น้ำท่วมชัดแม้มีเมฆ',
  },
  {
    id: 'q5', topic: 'เกณฑ์เยียวยา 7 วัน',
    q: 'ในภารกิจนี้ ครัวเรือนต้องถูกน้ำท่วมขังอย่างน้อยกี่วันจึงเข้าเกณฑ์เงินเหมาจ่าย 9,000 บาท?',
    choices: ['1 วัน', '3 วัน', '7 วัน', '30 วัน'],
    answer: 2,
    why: 'เกณฑ์ที่ใช้ในภารกิจคือท่วมขัง ≥ 7 วัน (นับจากไทม์ซีรีส์เรดาร์) ร่วมกับค่าล้างโคลน 10,000 บาท/หลัง',
  },
]
