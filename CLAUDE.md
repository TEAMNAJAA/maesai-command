# CLAUDE.md — THEOS-2 Mae Sai Command

> ไฟล์นี้บันทึก Context ถาวรของโปรเจกต์ ให้อ่านก่อนเริ่มงานทุกครั้ง
> ร่างครั้งแรก 3 ต.ค. 2569 · ปรับใหญ่ 4 ต.ค. 2569 (แยกโมดูล, config กลาง, แผนที่จริง, logger) · 10 ต.ค. 2569 เชื่อมอาคารจริง GISTDA + Sphere API key
> แหล่งความจริงของตรรกะเกม = ใบสมัคร `gistda-request/revenge_ใบสมัคร_แก้ไข_ฉบับสะอาด.docx/.pdf`

## 1. โปรเจกต์คืออะไร

- **ชื่อ:** THEOS-2 Mae Sai Command : Multi-Sensor Geospatial Serious Game and Integrated Disaster Decision Support System
  (ระบบภารกิจจำลองสถานการณ์และสนับสนุนการตัดสินใจบริหารจัดการอุทกภัยแม่สาย ด้วยข้อมูลภูมิสารสนเทศแบบหลายช่วงคลื่น)
- **การแข่งขัน:** The GEO Quest 2026 : THEOS-2 Geospatial Mission Design Challenge (GISTDA) · ประเด็น 05 ด้านการจัดการภัยพิบัติ
- **ทีม:** revenge · นักเรียน ม.6 โรงเรียนสิงห์บุรี 5 คน · หัวหน้าทีม นายศิรวิทย์ พิทักษ์สาลี · ครูที่ปรึกษา นายสิทธิพัฒน์ จิตร์กระจ่าง
- **สิ่งที่สร้าง:** Web App แบบ Serious Game ผู้เรียนสวมบท "ผู้บัญชาการ EOC อำเภอแม่สาย" ตัดสินใจภายใต้หลักฐานที่ไม่เคยครบ ใน 3 องก์
- **ข้อกำหนดที่ใบสมัครสัญญาไว้:** Single-Page Web App, ทำงาน Offline ได้ ไม่ต้องล็อกอิน, โหมดครูส่งออก CSV Log, ขยายไปลุ่มน้ำอื่นได้โดยเปลี่ยนไฟล์ข้อมูลเชิงพื้นที่, ค่าเกณฑ์ปรับได้ใน Config File

## 2. วิธีรัน / Build

```bash
npm install              # ครั้งแรก
npm run dev              # http://localhost:5173  (?demo = ข้าม briefing/pre-test) · .claude/launch.json ชื่อ "maesai-command"
npm run build            # dist/index.html ไฟล์เดียว (~2.6 MB) inline ทุกอย่าง เปิดจาก file:// ได้ (ภาพ Sphere ต้องออนไลน์)
node record-demo.mjs     # อัดเดโม 3 องก์จาก dist/?demo → recordings/run-<timestamp>/ (ไม่ลบวิดีโอเดิม · exit 2 ถ้าหน้าเว็บมี error)
node scripts/fetch-osm.mjs   # ดึงถนน/แม่น้ำ OSM ใหม่ → src/data/osm_maesai.geojson
node scripts/build-dem.mjs   # สร้างภาพ DEM (SRTM, AWS Terrain Tiles) ใหม่ → src/data/dem_aoi_*.jpg/.json
node scripts/extract-buildings.mjs <BD_footprintTH.shp> <BD_footprintTH.dbf> [--clip=boundary.geojson] [--rescan]
                             # ตัดอาคาร GISTDA ทั้งประเทศ (24.5 ล้านหลัง, 3.5 GB) → src/data/buildings_maesai.json (15,851 หลัง)
```

- **ห้ามดับเบิลคลิก `index.html` ที่ root** — เป็น entry ของ Vite (มีการ์ดแจ้งเตือน ซึ่ง `main.jsx` ลบทิ้งเมื่อ React mount)
- คีย์ลัด: `1`/`2`/`3` สลับองก์ · `Space` เดิน/หยุดนาฬิกา · `Ctrl+Shift+L` แผงครู
- **Sphere API key อยู่ใน `missionConfig.js` (SPHERE.apiKey)** ตามที่ผู้ใช้สั่ง — ตั้งทับได้ด้วย `.env.local` → `VITE_SPHERE_API_KEY` · ออฟไลน์/คีย์ใช้ไม่ได้ = fallback ข้อมูลในเครื่องทั้งหมด
- ไฟล์อาคารดิบทั้งประเทศอยู่ที่ `C:\Users\Computer\Downloads\BD_footprintTH-001.shp` + โฟลเดอร์ `BD_footprintTH-20261009T194218Z-1-002` (dbf/shx/prj) — **ห้ามคัดลอกเข้า repo** (.gitignore กัน *.shp/*.dbf/*.shx ไว้แล้ว)
- Viewport ที่ทดสอบ: 1280×720 และ 1920×1080 (ไม่ reflow ต่ำกว่า 1280 — จอ kiosk; แผงซ้าย/ขวาพับได้)
- **เครื่องมือบนเครื่อง (winget 2026-10-03):** Node.js 24.19 LTS + npm 11 · Git 2.55 · VS Code 1.140 (+ Tailwind CSS IntelliSense) · Playwright Chromium + ffmpeg 9.0
- **Git:** GitHub repo **private** `TEAMNAJAA/maesai-command` (branch `main`) · `.gitignore` ตัด `node_modules/`, `recordings/`, `*.local`, `.env` · repo มีใบสมัครที่มีเบอร์โทร/อีเมลสมาชิก **ห้ามเปลี่ยนเป็น public**

## 3. โครงสร้างไฟล์

| Path | หน้าที่ |
| --- | --- |
| `src/config/missionConfig.js` | **ค่าตั้งทั้งหมด:** SFVI weights, THRESHOLDS (4.20/4.01), CLOUD_RULE, TRUST, RELIEF, THEOS2, GAME (ราคา AP ฯลฯ), HYDRO (กราฟน้ำจำลอง), EVENT (ยึดวัน ก.ย. 2567), **DATA (ที่อยู่ข้อมูล + ช่องเสียบข้อมูล GISTDA)**, SPHERE (URL/คีย์), OFFLINE_ROUTING, SCORE, EVAL |
| `src/config/scenarioData.js` | SRC (ป้าย 4 สี), COMMUNITIES (lon/lat, floodStage, label), SHELTER, SECTORS (lon/lat จริงใน AOI-B), LAYERS, TACTICAL, QUICK_DEPLOY, SHORTAGE, ROOFS, LESSONS, QUIZ |
| `src/lib/buildings.js` | อาคารจริง GISTDA: decode, โซนน้ำถึงต่อหลังคา, แบ่งหลังคาให้ 4 ชุมชน → `COMMUNITIES_LIVE` (households = หลังคาจริง, P จริง), `ROOFS_LIVE` (กรณีเยียวยาบนหลังคาจริง), `AOI_FLOOD_ROOFS` |
| `src/lib/sim.js` | ฟังก์ชันล้วน (ใช้ `COMMUNITIES_LIVE`/`ROOFS_LIVE`): `levelAt/rainAt/cloudAt`, `computeSfvi`, `ARRIVAL`, `exposedHH`, `holdComparison`, `reliefSummary`, `missionScore`, `evaluateRoof` |
| `src/lib/geo.js` | Web Mercator `makeProjection`, AOI access (`aoiFeature`, `communityGeo`), OSM layers, `isFloodedStreet`, `routeOffline` (Dijkstra), `tilesFor`, `elevationAt` |
| `src/lib/sphere.js` | `sphereRoute`, `sphereElevation`, `sphereTileTemplate` (timeout + fallback) |
| `src/lib/evalLogger.js` | `logger` (localStorage `maesai-command.eval.v1`), `summary()`, `sessionsCSV()`, `roundsCSV()` |
| `src/lib/format.js` | `clamp/fmt/baht/clockLabel/clockHeadline/clockToDate` |
| `src/engine/useEngine.js` | state machine — ทุก action เขียนผ่าน `commit(fn)` (sRef อัปเดตทันที) |
| `src/map/GeoMap.jsx` | แผนที่จริง: `catchment` (AOI-B + swaths) · `urban` (AOI-A + 4 ชุมชน + OSM + route) |
| `src/map/MapCanvas.jsx` | สลับมุมมอง (catchment/urban/corridor · sar/urban), zoom/pan, 3D tilt, legend, callouts |
| `src/map/terrain.jsx` | ฉากจำลองเดิม (OpticalScene / SarScene / useTerrain) |
| `src/ui/atoms.jsx` | Panel, Src, SrcLegend, Btn, ArcGauge, Spark, Modal, Section, Tabs … |
| `src/panels/assessment.jsx` | แผงซ้าย: SfviScorecard, RiverGauge, TrustGauge, SituationReport |
| `src/panels/command.jsx` | แผงขวา: LayersList, TaskingPanel, Resources, DecisionBlock, RoutingTool, PriorityPanel |
| `src/panels/chrome.jsx` | TopBar, ActStepper, `computeHint` + HintBox, AlertLog, StatusBar, Toast |
| `src/modals/modals.jsx` | Briefing, Quiz (pre/post), VetoAlert, CloudAlert, HoldCompareModal, TeacherPanel |
| `src/aar/AarShell.jsx` | องก์ 3: ChangeSlider, RoofCompare, AdjudicationTable, timeline, tabs, CSV report |
| `src/App.jsx` | root layout + ลำดับ briefing → pretest → play, การ์ดซ้าย/ขวาพับได้ |
| `src/data/` | `buildings_maesai.json` (GISTDA BD_footprint, AOI-A ∩ อ.แม่สาย, รูปแบบย่อ ~620 KB), `osm_maesai.geojson` (© OSM), `dem_aoi_a/b.jpg + .json` (SRTM) |
| `gistda-request/` | เอกสารยื่น GISTDA — `MaeSai_AOI_ALL.geojson` ถูก import เข้าแอปจริง (ดูหัวข้อ 7) |

**Stack:** React 18 · Vite 5 (+ vite-plugin-singlefile) · Tailwind 3 · lucide-react · recharts · ไม่มี backend

## 4. ตรรกะหลัก (`src/lib/sim.js` + `useEngine`)

### โลกจำลอง
- ระดับน้ำ/ฝน/เมฆเป็นฟังก์ชันของ `clock` เท่านั้น (`HYDRO`): ผ่านเกณฑ์เตรียมพร้อม 4.01 ม. ~T−8.7 ชม., วิกฤต 4.20 ม. ~T−5.9 ชม., ยอด 5.40 ม. ที่ T+2 ชม., เมฆ > 60% ~T−7.3 ชม., 100% ตั้งแต่ T−1 ชม.
- ทุก action ที่กินเวลา (สั่งถ่าย +95, deploy +30, อพยพ +45, hold +180 นาที) เดินนาฬิกา → น้ำขึ้นจริง · องก์ 1 หมดเวลา → เข้าองก์ 2 อัตโนมัติ
- **โซนน้ำถึง** (`FLOOD_REACH`): หลังคาห่างแม่น้ำสาย ≤ 150 ม. หรือ (≤ 800 ม. และ DEM ≤ 400 ม.) · มี `DATA.radarFlood` เมื่อไรใช้ polygon เรดาร์แทน · หลังคาเป็นของชุมชนที่ใกล้สุดภายใน 300 ม. · ทั้ง AOI มีหลังคาในโซนน้ำถึง 3,071 หลัง
- **ครัวเรือน = หลังคาจริง** ของแต่ละชุมชน (ใช้คิดเวลาอพยพและหลังคาเสี่ยง) — ลำดับ SFVI รายชุมชนจึงเปลี่ยนเป็น เหมืองแดง > ไม้ลุงขน > เกาะทราย > สายลมจอย (tie-break แทบไม่ถูกใช้แล้ว)
- **น้ำถึงชุมชน** = เวลาที่ระดับสถานีถึง `floodStage` (slj 4.10 / ksa 4.20 / mlk 4.45 / mdg 4.70) · **เวลาอพยพ** = households ÷ (exits × 3 ครัวเรือน/นาที) + 30 นาที · ครัวเรือนเสี่ยง = households × P × (1 − สัดส่วนที่อพยพทัน)

### SFVI = 0.30·W + 0.25·R + 0.20·L + 0.15·N + 0.10·P
| | โค้ด | ป้าย |
| --- | --- | --- |
| W | `level / 4.20` | วัดจริง |
| R | `rain / 250` | วัดจริง |
| L | `scarsSeen / 17` (เฉพาะ swath ที่ถ่ายได้ไม่ติดเมฆ) | ภาพ THEOS-2 |
| N | `1 − channelWidth / 150` (วัดได้จาก Sector D=28 ม. / E=34 ม.) | ภาพ THEOS-2 |
| P | **หลังคาจริงในโซนน้ำถึง ÷ หลังคาทั้งหมดของชุมชน** (GISTDA) — slj 120/228=0.53 · ksa 339/396=0.86 · mlk 295/303=0.97 · mdg 340/340=1.00 | ภาพ + สถานการณ์ (โซนน้ำถึงเป็นแบบจำลองจนกว่าจะมีเรดาร์) |

- **Veto 1:** ≥ 4.20 ม. → Modal แดงบังคับอพยพ · ปุ่ม HOLD ถูกปิด
- **Cloud Rule:** เมฆ > 60% หรือภาพเก่า > 48 ชม. → น้ำหนัก L × 0.4 + ความเชื่อมั่นต่ำ · สั่งถ่ายตอนเมฆ > 60% ได้ภาพที่มองไม่เห็นพื้น (เสีย AP/swath) · องก์ 2 เมฆ 100% → ล็อกชั้น optical + Modal ให้สลับ SAR/Sphere Routing
- **ลำน้ำแคบ < ครึ่ง** → ลดเกณฑ์เตรียมพร้อม 0.20 ม. (4.01 → 3.81)
- **การอพยพ (องก์ 1):** เลือกชุมชนได้ · AP = 1,500 × (0.4 + 0.6·n/4) · ถือว่ามีหลักฐานถ้า ระดับ ≥ เกณฑ์เตรียมพร้อม หรือทุกชุมชนที่เลือกมี SFVI ≥ 0.62 · ไม่งั้นเตือนผิด −5/−15/−40 · องก์ 2 สั่งครั้งแรก = เตือนช้า −30
- **HOLD:** +3 ชม. แล้วเปิด Dual Comparison (ครัวเรือนเสี่ยงถ้าสั่งตอนนี้ vs หลังรอ, ความลึกน้ำ/โคลนรายชุมชน)
- **Routing:** sphere Routing API (`mode=t`) ก่อน — ถ้าเส้นทางผ่านถนนท่วมในสถานการณ์ > 5% จะหาจุดแวะที่แห้งด้วย router ออฟไลน์แล้วเรียก sphere 2 ช่วง · ออฟไลน์/ล้มเหลว → Dijkstra บนถนน OSM ปิดถนน ≤ 200 ม. จากแม่น้ำสาย (ยกเว้น 300 ม. รอบต้นทาง) · หัก 500 AP เมื่อสำเร็จเท่านั้น
- **แผนที่ฐาน:** มุมมองเขตเมืองใช้ภาพ `thailand_images` ของ sphere (zoom +1, สูงสุด 19) ทับ DEM · มุมมองลุ่มน้ำเมียนมาใช้ DEM (ภาพ sphere นอกไทยหยาบ) · องก์ 3 ภาพหลังคาใช้ z18 (z19 ที่แม่สายเป็นภาพขยาย)
- **Tie-break:** คะแนนเท่ากัน → ทางออกน้อยกว่าได้ก่อน (สายลมจอย = เกาะทราย จูนให้เสมอโดยตั้งใจ)
- **คะแนนภารกิจ (AAR):** 0.35 อพยพทัน + 0.25 เยียวยาถูก + 0.15 triage + 0.15 trust + 0.10 ใช้หลักฐาน (`SCORE`)
- **เยียวยา:** 10 กรณีใน `ROOFS` (วันท่วมขัง/โคลน/ความมั่นใจ/ผลภาคสนาม = สถานการณ์) ถูกผูกกับหลังคาจริงขนาดบ้าน (50–400 ตร.ม.) ในโซนน้ำถึงของชุมชนเดียวกัน → รหัส `BD-<FID>` · สไลเดอร์ก่อน = ภาพ sphere ปัจจุบัน + รูปหลังคาจริง, หลัง = ทับน้ำขัง/โคลนจำลอง · ปุ่มอนุมัติอยู่ทั้งข้างสไลเดอร์และในตาราง · ประมาณการงบ = ค่าเฉลี่ยต่อหลัง × 3,071 หลังคาในโซนน้ำถึงของ AOI-A

### ป้ายที่มาข้อมูล 4 สี (ห้ามละเมิด)
ทุกตัวเลข/ชั้นข้อมูลต้องมี `<Src t=.../>`: `measured` วัดจริง (เขียว `#22E36B`) · `image` ภาพ THEOS-2 (ฟ้า `#38BDF8`) · `radar` เรดาร์ (ส้ม `#FF8A3D`) · `scenario` ค่าสถานการณ์ (เทา `#94A3B8`)

### Sandbox logger
- 1 session ต่อ 1 รอบเล่น (บันทึกเมื่อมีข้อมูลจริงเท่านั้น) · `?demo` ติดธง demo และไม่นับในสถิติ
- บันทึก: เวลาอ่าน briefing, pre/post, เวลาแต่ละองก์, ชั้นข้อมูลที่ผู้เล่นเปิดเอง, ทุกการตัดสินใจ (SFVI, ชุมชนที่สั่ง vs ที่ SFVI แนะนำ, วินาทีที่ใช้คิด), triage, relief, ผลสุดท้าย
- เกณฑ์: เปิด ≥ 3 ชั้นก่อนตัดสินใจครั้งแรก ≥ 70% ของผู้เล่น · post เพิ่ม ≥ 30% · briefing < 10 นาที
- ⚠️ คำแนะนำ (hint) ชี้นำพฤติกรรม — ตอนวัดผลจริงควรปิด (`EVAL.hintsEnabled` หรือปุ่มหลอดไฟ) ระบบบันทึกว่าเปิด/ปิดไว้ทุก session

## 5. ข้อเท็จจริงอ้างอิง

- แม่สายท่วมซ้ำ 6 ครั้งในปี 2567 · 6,182 ไร่ (10 ก.ย. 67) → 25,204 ไร่ (12 ก.ย. 67) — ค่าวันอื่นในกราฟเป็นค่าประมาณ
- GISTDA ใช้ RADARSAT-2 ช่วงเกิดเหตุ (10, 12 ก.ย. 67) และถ่าย THEOS-2 หลังน้ำลด (17 ก.ย. 67)
- ร่องรอยดินถล่มกว้าง 20–30 ม. · ลำน้ำสายแคบลงจาก ~150 ม. เหลือ 20–30 ม.
- มติ ครม. 17 ก.ย. 67: เหมาจ่าย 9,000 บ./ครัวเรือน + ค่าล้างโคลน 10,000 บ./หลัง (เกณฑ์ ≥ 7 วันเป็นกติกาของภารกิจ — ยืนยันกับหน่วยงานก่อนอ้างเป็นข้อเท็จจริง)
- THEOS-2: Pan 0.5 ม. / MS 2 ม. · swath 10.3 กม. · revisit 1.9 วัน · L3 Ortho ผ่าน AWAGAD
- sphere web services (ตรวจจาก docs 4 ต.ค. 69): Routing `api.sphere.gistda.or.th/services/route/route?flon&flat&tlon&tlat&mode&key` (คืน GeoJSON, `distance` ม., `interval` วินาที) · Elevation `…/services/geo/elevation?lon&lat&key` · XYZ `basemap.sphere.gistda.or.th/tiles/{layer}/EPSG3857/{z}/{x}/{y}.jpeg?key`
- Sandbox Test Plan: รอบ 1 เพื่อน 8 คน · รอบ 2 ม.ปลาย 10 คน (Pre/Post) · รอบ 3 บูธ 10 คน · ระยะ 2: 120 คน, Paired t-test, SUS ≥ 80

## 6. เอกสาร/ข้อมูลใน `gistda-request/` (25 ก.ย. 2569)

- ใบสมัครฉบับแก้ไข (docx/pdf + TrackChanges) · `GISTDA_data_request_revenge_v2.xlsx` (ต้องมี: THEOS-2 ก่อน/หลัง เขตเมือง, ภาพต้นน้ำ, ขอบเขตน้ำท่วมเรดาร์รายวัน)
- `MaeSai_AOI_ALL.geojson`: AOI-A (เมือง 20.405–20.475N, 99.83–99.965E) · AOI-B (ลุ่มน้ำ ~965 ตร.กม.) · AOI-B1 · สถานี STN0029 (W), MYA001 บ้านโจตาดา (R), MYA002–004 · จุดชุมชน เกาะทราย/ไม้ลุงขน/เหมืองแดง · แม่น้ำสาย (DEM main stem)
- **สายลมจอยยังไม่มีพิกัดในไฟล์** → ใช้ตำแหน่งประมาณใน `scenarioData.js` (99.8782E, 20.4438N) — ถ้าเพิ่มจุด/polygon ชื่อมีคำว่า "สายลมจอย" และ `kind: community` ลงใน GeoJSON แอปจะใช้ของจริงอัตโนมัติ
- **จุดอพยพ** (99.8806E, 20.4187N, ~416 ม.) เป็นตำแหน่งสมมติบนที่สูง — แก้ใน `SHELTER`

## 7. วิธีเสียบข้อมูลจริงจาก GISTDA

1. วางไฟล์ใน `src/data/` (Shapefile → GeoJSON EPSG:4326 ด้วย QGIS/mapshaper)
2. เปิดคอมเมนต์ import ใน `missionConfig.js` แล้วใส่ใน `DATA.radarFlood` / `DATA.landslides` / `DATA.buildings` / `DATA.theosImagery.before|after` (ภาพต้องตรงกรอบ `theosImagery.bbox` = AOI-A)
3. `npm run build` — radarFlood จะแทนแถบน้ำท่วมจำลองและใช้ปิดถนนใน router · theosImagery แทนภาพจำลองในสไลเดอร์และในมุมมองเมือง
- **รับแล้ว 10 ต.ค. 69:** ชั้นอาคาร BD_footprintTH → `DATA.buildings` (ตัดด้วย AOI-A ∩ อ.แม่สาย เพราะ OSM ไม่มีขอบเขตตำบล — ได้ขอบเขตปกครองจาก GISTDA เมื่อไรให้รัน extract-buildings ใหม่ด้วย `--clip=`)
- `DATA.landslides` แสดงบนแผนที่ลุ่มน้ำเฉพาะใน swath ที่ถ่ายแล้ว แต่ค่า L ยังนับจากจุดจำลองใน SECTORS · `runtimeUrls` ยังไม่ถูกโหลดตอนรัน

## 8. Backlog / ข้อจำกัดที่รู้

- ภาพ THEOS-2/เรดาร์จริงยังไม่มี (รอ GISTDA) — มุมมอง corridor/SAR และสไลเดอร์ยังเป็นภาพจำลอง (ติดป้ายสถานการณ์)
- Sphere ทดสอบกับคีย์จริงแล้ว (10 ต.ค. 69): Routing ✓ (CORS *) · Tiles z14–19 ✓ · Elevation คืน `null` บางจุด → ยังใช้ SRTM · ภาพ sphere เป็นภาพปัจจุบัน ไม่ใช่ภาพก่อนเหตุการณ์ 2567
- ป้ายของชั้นอาคารใช้ "ภาพ THEOS-2" (สีฟ้า) — ทีมควรยืนยันกับ GISTDA ว่าชั้น BD_footprint สกัดจากดาวเทียมดวงใด
- 3D Tilt = เอียงภาพ hillshade จาก SRTM แบบ perspective (ไม่ใช่ mesh 3D)
- ROOFS 10 หลัง, จำนวนครัวเรือน, floodStage, ภาพหลังคาเป็นค่าสถานการณ์ — รอข้อมูล ปภ./GISTDA
- Stress test 5 กรณียังเป็นข้อความในแท็บบทเรียน · ปุ่มคำขอทรัพยากรองก์ 2 แค่ log
- ยังไม่มี unit test — `sim.js` เป็นฟังก์ชันล้วน พร้อมเขียนเทสต์

## 9. แนวทางเขียนโค้ด

- ค่าเกณฑ์/อัตรา/ที่อยู่ข้อมูลใหม่ → `missionConfig.js` · ข้อมูลฉาก → `scenarioData.js` · ห้าม hard-code ใน component
- ตรรกะคำนวณ → `sim.js` (ฟังก์ชันล้วน) · state เปลี่ยนผ่าน `commit()` ใน `useEngine` เท่านั้น
- ทุกตัวเลขใหม่บนจอต้องมี `<Src/>` · ข้อความ UI ภาษาไทยใช้คลาส `font-thai` · log สองภาษา (`msg` อังกฤษ + `th` ไทย)
- ใส่ `data-*` (เช่น `data-tab`, `data-layer`, `data-sector`) ให้ปุ่มสำคัญ — `record-demo.mjs` ใช้ selector เหล่านี้
- Tailwind arbitrary values + keyframes ใน `index.css` · ระวังเขียน regex แบบ `/[-:T]/` ในโค้ด (Tailwind อ่านเป็นคลาส) ใช้ `/\D/` แทน
- หลังแก้: `npm run build` แล้ว `node record-demo.mjs` (RECORD_OUT=โฟลเดอร์ชั่วคราว) เพื่อทดสอบ 3 องก์อัตโนมัติ
