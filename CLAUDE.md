# CLAUDE.md — THEOS-2 Mae Sai Command

> ไฟล์นี้บันทึก Context ถาวรของโปรเจกต์ ให้อ่านก่อนเริ่มงานทุกครั้ง
> ร่างครั้งแรก 3 ต.ค. 2569 · 4 ต.ค. แยกโมดูล/config/แผนที่จริง/logger · 10 ต.ค. อาคารจริง GISTDA + Sphere API · 16 ต.ค. ออกแบบใหม่ (Beginner/Expert, เวลา+งบ, 10 โซน, กู้ภัยองก์ 2, leaderboard) · **17 ต.ค. เวลาเดินเมื่อผู้เล่นสั่งการ + คัตซีน, หน้าเปิดเกม + หน้าวิธีเล่น (ทีมเข้ารอบชิงชนะเลิศแล้ว)**
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
npm run dev              # http://localhost:5173 · .claude/launch.json ชื่อ "maesai-command"
npm run build            # dist/index.html ไฟล์เดียว (~2.7 MB) inline ทุกอย่าง เปิดจาก file:// ได้ (ภาพ Sphere ต้องออนไลน์)
npx vitest run           # tests/ — scenario + engine (บอทเล่นเก่ง vs ไม่ทำอะไร)
node record-demo.mjs     # smoke test 3 องก์จาก dist/?demo&rec → recordings/run-<ts>/ (exit 2 ถ้าหน้าเว็บมี error)
node record-perfect-run.mjs  # คลิปเล่นสมบูรณ์จากหน้าเปิดเกม + คำบรรยายไทย → recordings/perfect-run-<ts>/demo_gameplay.mp4
node scripts/fetch-osm.mjs · scripts/fetch-poi.mjs · scripts/build-dem.mjs   # ข้อมูลพื้นหลัง (ถนน/แม่น้ำ, POI, DEM)
node scripts/extract-buildings.mjs <BD_footprintTH.shp> <BD_footprintTH.dbf> [--clip=boundary.geojson] [--rescan]
python scripts/build-final-mission-package.py   # สร้าง gistda-request/revenge_Final_Mission_Package.docx
```

- **URL params:** `?demo` ข้ามหน้าเปิดเกม/pre-test (ไม่นับสถิติ) · `?seed=N` สถานการณ์ตายตัว · `?mode=expert` · `?speed=N` เร่งคัตซีน (ใช้ตอนอัดคลิป) · `?rec` เปิด `window.__maesai` ให้สคริปต์อัดคลิปอ่านเฉลย (ห้ามใช้ตอนเล่นจริง)
- **ห้ามดับเบิลคลิก `index.html` ที่ root** — เป็น entry ของ Vite
- คีย์ลัด: `Space` = เดินเวลาไปเหตุการณ์ถัดไป · `Ctrl+Shift+L` แผงครู
- **Sphere API key อยู่ใน `missionConfig.js` (SPHERE.apiKey)** ตามที่ผู้ใช้สั่ง — ตั้งทับได้ด้วย `.env.local` → `VITE_SPHERE_API_KEY` · ออฟไลน์/คีย์ใช้ไม่ได้ = fallback ข้อมูลในเครื่อง
- ไฟล์อาคารดิบทั้งประเทศอยู่ที่ `C:\Users\Computer\Downloads\BD_footprintTH-001.shp` + โฟลเดอร์ `BD_footprintTH-20261009T194218Z-1-002` — **ห้ามคัดลอกเข้า repo**
- Viewport ที่ทดสอบ: 1920×1080 (หลัก) และ 1280×720 · แผงซ้าย/ขวาพับได้
- **เครื่องมือบนเครื่อง:** Node.js 24 + npm 11 (ใช้ `npm.cmd` ใน PowerShell — execution policy บล็อก npm.ps1) · Git · Playwright Chromium + ffmpeg · Python + python-docx/PyMuPDF
- **Git:** GitHub repo **private** `TEAMNAJAA/maesai-command` (branch `main`) · `.gitignore` ตัด `node_modules/`, `recordings/`, `*.local`, `.env` · repo มีใบสมัครที่มีเบอร์โทร/อีเมลสมาชิก **ห้ามเปลี่ยนเป็น public**

## 3. โครงสร้างไฟล์

| Path | หน้าที่ |
| --- | --- |
| `src/config/missionConfig.js` | **ค่าตั้งทั้งหมด:** SFVI, THRESHOLDS, CLOUD_RULE, TRUST, RELIEF, THEOS2 (3 รอบองก์ 1 ที่ T−42/−26/−11), **TIME + CMD_MIN** (เวลาสั่งการ/คัตซีน), MISSION (60 วัน), MODES (beginner/expert), COSTS (บาท), DURATIONS, BOAT, FUEL_FACTOR 1.4, ACT2, RESCUE (≤ 9 จุดผู้ติดค้าง), HYDRO, EVENT, DATA, EMBANKMENT, SPHERE, SCORE, EVAL |
| `src/config/scenarioData.js` | SRC 4 สี, COMMUNITIES, HOSPITAL, SHELTER_POOL (7), CAMP_SITES (3), EQUIPMENT, SECTORS, LAYERS, QUIZ … |
| `src/lib/scenario.js` | `makeScenario(seed, mode)` — สุ่มต่อเกม: ฉากดินถล่ม 6 sector, ความกว้างลำน้ำ 20–34 ม., รอบโคจร+เมฆพยากรณ์, รอบถ่ายองก์ 2, เมฆลอย, พายุ, ไฟรั่ว, จุดอับ, จุดอพยพ 3 แห่ง, ถนนขาด, หลังคาเยียวยา 8 หลัง |
| `src/lib/sections.js` | 10 โซนจากหลังคาจริง (k-means) · `sectionDepth` · `GAPS_BY_SECTION` |
| `src/lib/sim.js` | ฟังก์ชันล้วน: `computeSfvi`, `depthAt`, `arrivalAt`, `zoneOutcome`, `exposureSummary`, `makePoints`, `reliefSummary`, `missionScore` |
| `src/lib/hydro.js` · `clouds.js` · `routes.js` · `rng.js` · `leaderboard.js` | กราฟน้ำ · เมฆลอย (Boolean model 35–65%) · วางแผนเรือ 3 เส้นทาง + อันตราย · seeded RNG · ตารางอันดับ (localStorage) |
| `src/lib/buildings.js` · `embankment.js` · `geo.js` · `sphere.js` · `evalLogger.js` | อาคาร GISTDA · แนวตลิ่ง 14 จุด · projection/router ออฟไลน์ · Sphere API · logger CSV |
| `src/engine/world.js` | state เริ่มต้น, `advanceTo` (เหตุการณ์ตามเวลา + `event()` ที่ทำให้ปุ่ม "เดินเวลา" หยุด), `enterAct2/3`, งานภาคสนาม (jobs), เรือวิ่งรับ-ส่งเอง (shuttle) |
| `src/engine/actions.js` | ทุกคำสั่งเป็น pure transition และ `spend(CMD_MIN.x)` เดินเวลาตามเวลาสั่งการ |
| `src/engine/useEngine.js` | `commit()` · **`advance({mode: next / span / until / end})` เดินเวลาแบบแอนิเมชัน + `cut` (คัตซีน)** · `realMs()` เวลาเล่นจริง · hook `?rec` |
| `src/panels/timebar.jsx` | แถบเวลาใต้แผนที่: เหตุการณ์ถัดไป · +1 ชม. · เดินเวลา/ให้ THEOS-2 ถ่าย · ข้ามไปจบองก์ (`actSettled`) |
| `src/map/Cutscene.jsx` | คัตซีน THEOS-2 (โคจร→ถ่าย→ดาวน์ลิงก์→L3 Ortho) และแบนเนอร์เดินเวลา · บล็อกการคลิกระหว่างเล่น |
| `src/modals/intro.jsx` | **หน้าเปิดเกม (TitleScreen) + หน้าวิธีเล่น (HowToPlay)** — ใช้ตอบกรรมการ: เกมคืออะไร, หน้าจอ/เวลา, 3 องก์, Logic Matrix, ข้อมูล GISTDA, คะแนน/วัดผล |
| `src/panels/datahub.jsx` · `actions.jsx` · `quest.jsx` · `chrome.jsx` | แผงซ้าย (SFVI/ดาวเทียม/โซน/ทรัพยากร) · แผงขวา (แท็บคำสั่ง) · กล่องภารกิจ + TutorBar · TopBar (เวลาเล่นจริง)/AlertLog/StatusBar/Toast |
| `src/modals/analysis.jsx` · `planner.jsx` · `modals.jsx` · `guide.jsx` | แปลภาพ (คลิกหมุด = ดินถล่ม) + วัดลำน้ำ · วางแผนเรือ · quiz/veto/สรุปองก์/แผงครู · Leaderboard |
| `src/map/GeoMap.jsx` · `MapCanvas.jsx` | แผนที่ catchment/urban/corridor · สลับมุมมอง |
| `src/aar/AarShell.jsx` | องก์ 3: ภาพหลังคา Sphere ก่อน/หลัง (โคลนบนพื้น หลังคาสะอาด), ไทม์ซีรีส์เรดาร์, สำรวจภาคพื้น, คะแนน, รายงาน CSV |
| `scripts/demo-flow.mjs` · `demo-kit.mjs` | ผู้เล่นอัตโนมัติ (คลิก UI จริง ใช้เฉลยจาก `?rec`) · เคอร์เซอร์/คำบรรยาย/ffmpeg |
| `tests/` | vitest: scenario + engine |

**Stack:** React 18 · Vite 5 (+ vite-plugin-singlefile) · Tailwind 3 · lucide-react · recharts · vitest · ไม่มี backend

## 4. ตรรกะหลัก

### เวลา (สำคัญ — ตามที่ผู้ใช้กำหนด 17 ต.ค.)
- **ไม่มีนาฬิกาเดินเอง ไม่มีการนั่งรอ** — เวลาในเกมเดินเมื่อ (1) สั่งการ: ผลเกิดทันทีและกินเวลาสั่งการ `CMD_MIN` (ฐาน 60 · แปลภาพ 20 · วัด N 15/ครั้ง · อพยพ 30 · คำสั่งองก์ 2 ครั้งละ 5–10 นาที) หรือ (2) กดแถบเวลา: `+1 ชม.` · `เดินเวลา → เหตุการณ์ถัดไป` (Space) · `ให้ THEOS-2 ถ่ายรอบ Pn` (ไปจนได้ภาพ) · `ข้ามไปจบองก์` (เมื่อไม่มีงานค้างที่มองเห็น)
- เหตุการณ์ที่หยุดการเดินเวลา (`event()` ใน world.js): ภาพพร้อม · ดาวเทียมกำลังผ่านแต่ยังไม่เลือกเป้า · น้ำถึงเกณฑ์เตรียมพร้อม/วิกฤต · พายุ · ไฟรั่ว · ผลรอบ THEOS-2 · สายด่วน · โดรนพบ · ทีมงานเสร็จ (เสา/ตัดไฟ/สูบ) · เสบียงไม่ถึง/ช่วยไม่ทัน
- ระหว่างกระโดดเวลาแสดงคัตซีน 1–3 วินาที (THEOS-2 3.4 วินาที) ทั้งจอคลิกไม่ได้
- **เป้าหมายความยาว:** ผู้เล่นเก่งจบ 3 องก์ราว 7 นาที (ป้าย ⚡) · ครั้งแรก 12–15 นาที · `realMs()` วัดเวลาจริง ใช้ใน Leaderboard (คะแนนเท่ากันเรียงตามเวลา) และสรุปองก์

### องก์ 1 (T−48 → T0) — กล่องภารกิจ 6 สเต็ป
ตั้งฐาน → เลือกเป้าหมาย THEOS-2 (2 เป้า/รอบ ตามเมฆพยากรณ์ > 60% ใช้ไม่ได้) → ถ่าย (คัตซีน) → แปลภาพ (คลิกหมุดรอยดินถล่มใหม่ ระวังนา/เงาเมฆ/รอยเก่า → L) → วัดลำน้ำ (พิกเซล × 0.5 ม. → N) → ส่งทีมบิ๊กแบ็ก (ทีมทำงานระหว่างเวลาเดิน) → สั่งอพยพรายโซน (งบต่อโซน; หลักฐานไม่พอ = เตือนผิด) · Veto 1 ที่ 4.20 ม.

### องก์ 2 (T0 → T+36)
เมฆลอย 35–65% · THEOS-2 3 รอบเห็นคนเฉพาะโซนเมฆเปิด (ไม่เห็นในจุดอับ → โดรน) · สายด่วนแจ้งหลังน้ำถึง 1–7 ชม. (โซนสัญญาณล่มแจ้งไม่ได้) · ผู้ติดค้าง ≤ 9 จุด (อยู่ไม่ได้ → เรืออพยพ, บาดเจ็บ → รพ.; อยู่ได้ → ถุงยังชีพ) · วางแผนเรือเลือกเส้นทางเอง (ริมน้ำ/ลึก ≥ 1.6 ม./ไฟรั่ว = ผิด) · เรือวิ่งรับ-ส่งเองจนจุดหมด · น้ำมัน 140% · เครื่องสูบ −0.5 ม. · ปุ่มข้ามไปน้ำลดขึ้นหลัง T+12 เมื่อจุดที่มองเห็นได้รับการช่วยครบ (จุดที่ยังไม่พบจะสูญเสีย)

### องก์ 3 (วันที่ 2 → 60)
หลังคาจริง 8 หลัง · ภาพ Sphere ก่อน/หลัง (ฝั่งหลังจำลองโคลนรอบบ้านตาม mudLevel) · ไทม์ซีรีส์เรดาร์ 14 วัน · ท่วม ≥ 7 วัน = ฿9,000 · + โคลน = +฿10,000 · หลักฐานขาด → สำรวจภาคพื้น (+2 วัน ฿1,500)

### SFVI และคะแนน
SFVI = 0.30·W + 0.25·R + 0.20·L + 0.15·N + 0.10·P (≥ 0.62 = หลักฐานพอ) · คะแนน: THEOS-2 .20 · อพยพ .20 · ผู้ติดค้าง .20 · เยียวยา .20 · โลจิสติกส์ .10 · ความเชื่อมั่น .10

### ป้ายที่มาข้อมูล 4 สี (ห้ามละเมิด)
ทุกตัวเลข/ชั้นข้อมูลต้องมี `<Src t=.../>`: `measured` วัดจริง (เขียว `#22E36B`) · `image` ภาพ THEOS-2 (ฟ้า `#38BDF8`) · `radar` เรดาร์ (ส้ม `#FF8A3D`) · `scenario` ค่าสถานการณ์ (เทา `#94A3B8`)

### Sandbox logger
1 session ต่อ 1 รอบเล่น · `?demo` ไม่นับสถิติ · บันทึก pre/post, เวลาแต่ละองก์, ชั้นข้อมูล, ทุกการตัดสินใจ, triage, relief · เกณฑ์: เปิด ≥ 3 ชั้นก่อนตัดสินใจครั้งแรก ≥ 70% · post เพิ่ม ≥ 30%

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

- ภาพ THEOS-2/เรดาร์จริงยังไม่มี (รอ GISTDA) — ฉากแปลภาพ, ฝั่ง "หลัง" ของหลังคา, เมฆ, จุดผู้ติดค้าง เป็นค่าสถานการณ์
- Sphere: Routing ✓ · Tiles ✓ · Elevation คืน `null` บางจุด → ใช้ SRTM · ภาพ Sphere เป็นภาพปัจจุบัน
- `gistda-request/revenge_Final_Mission_Package.docx` เขียนก่อนเปลี่ยนระบบเวลา — ถ้าจะส่งใหม่ต้องปรับข้อความเรื่องเวลา/โหมด
- ค่าสถานการณ์ (floodStage โซน, ครัวเรือน, ผู้ติดค้าง, หลังคาเยียวยา) รอข้อมูล ปภ./GISTDA
- รอบชิงชนะเลิศ (กติกา GISTDA): วิดีโอ ≤ 5 นาที Full HD · ส่ง Mission Package ล่วงหน้า ≥ 10 วัน · นำเสนอ + ตอบคำถาม ≤ 15 นาที

## 9. แนวทางเขียนโค้ด

- ค่าเกณฑ์/อัตรา/ที่อยู่ข้อมูลใหม่ → `missionConfig.js` · ข้อมูลฉาก → `scenarioData.js` · ห้าม hard-code ใน component
- ตรรกะคำนวณ → `sim.js` (ฟังก์ชันล้วน) · state เปลี่ยนผ่าน `commit()` ใน `useEngine` เท่านั้น
- ทุกตัวเลขใหม่บนจอต้องมี `<Src/>` · ข้อความ UI ภาษาไทยใช้คลาส `font-thai` · log สองภาษา (`msg` อังกฤษ + `th` ไทย)
- ใส่ `data-*` (เช่น `data-tab`, `data-layer`, `data-sector`) ให้ปุ่มสำคัญ — `record-demo.mjs` ใช้ selector เหล่านี้
- Tailwind arbitrary values + keyframes ใน `index.css` · ระวังเขียน regex แบบ `/[-:T]/` ในโค้ด (Tailwind อ่านเป็นคลาส) ใช้ `/\D/` แทน
- หลังแก้: `npm run build` แล้ว `node record-demo.mjs` (RECORD_OUT=โฟลเดอร์ชั่วคราว) เพื่อทดสอบ 3 องก์อัตโนมัติ
