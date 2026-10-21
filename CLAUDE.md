# CLAUDE.md — THEOS-2 Mae Sai Command

> ไฟล์นี้บันทึก Context ถาวรของโปรเจกต์ ให้อ่านก่อนเริ่มงานทุกครั้ง
> ร่างครั้งแรก 3 ต.ค. 2569 · 4 ต.ค. แยกโมดูล/config/แผนที่จริง/logger · 10 ต.ค. อาคารจริง GISTDA + Sphere API · 16 ต.ค. ออกแบบใหม่ (Beginner/Expert, เวลา+งบ, 10 โซน, กู้ภัยองก์ 2, leaderboard) · **17 ต.ค. เวลาเดินเมื่อผู้เล่นสั่งการ + คัตซีน, หน้าเปิดเกม + หน้าวิธีเล่น (ทีมเข้ารอบชิงชนะเลิศแล้ว)** · 19 ต.ค. การ์ด "ผลที่จะเกิด" + ปุ่ม ⓘ "ทำไมต้องทำ" + คำใบ้แบบบันได + "ถ้าคุณเลือกอีกทาง" + Stress Test + เทียบรอบ 1/2 ในแผงครู
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
node scripts/probe-whatif.mjs <outDir>   # ภาพ "ถ้าคุณเลือกอีกทาง" ท้ายองก์ 1/2 + AAR หลังเล่นแบบตั้งใจพลาด (ต้องเปิด npm run dev)
node scripts/probe-stress-compare.mjs <outDir>   # หน้าเลือก Stress Test + ผลในเกม · แผงครูเทียบรอบ 1→2 (ข้อมูลสังเคราะห์ในโปรไฟล์เบราว์เซอร์ทดสอบ) · การ์ดพัฒนาการผู้เล่น
RECORD_PARAMS=stress=all node record-demo.mjs   # smoke test 3 องก์ภายใต้ Stress Test ทุกเงื่อนไข
node scripts/probe-hints.mjs <outDir>    # ภาพหน้าจอคำใบ้แบบบันไดทั้ง 3 องก์ (ต้องเปิด npm run dev) · exit 2 ถ้าขั้นเกินองก์/ไม่ชี้ข้อมูล
node scripts/probe-news.mjs <outDir> [baseUrl]    # ข่าว/โซเชียล: ขึ้นเมื่อตัดสินใจ · ไม่บังปุ่มแผนที่ (ต้องเปิด npm run dev)
node scripts/probe-dex.mjs <outDir> [baseUrl]     # สมุดการ์ดความรู้: ปลดล็อก → ป้ายแจ้ง → เปิดสมุด (ต้องเปิด npm run dev)
node scripts/probe-career.mjs <outDir> [baseUrl]  # ยศ/ล็อก Expert+Stress/ครูปลดล็อก/แฟ้มประวัติ ที่ 1920 และ 1280 (ต้องเปิด npm run dev)
node scripts/probe-relief.mjs <outDir> [baseUrl]  # องก์ 3: ฉากศูนย์ควบคุม + ภาพหลังคาทุกหลัง (โคลนชัด/ลานสะอาด) (ต้องเปิด npm run dev)
node scripts/probe-officer.mjs <outDir> [baseUrl] # โหมดฝึกเจ้าหน้าที่: ปุ่ม/เมนู/?officer · ไม่มี chibi/บอส · สรุปตลิ่งจากการเตรียมตัว (ต้องเปิด npm run dev)
node scripts/probe-boss.mjs <outDir> [baseUrl]    # คืนวิกฤต T0 (บอส): 1920/1280 · Expert ซ่อนท่าถัดไป · ไม่เตรียมตัว → ตลิ่งแตก (ต้องเปิด npm run dev)
node scripts/probe-perf.mjs <outDir> [baseUrl]    # โหมดประหยัด: ปุ่มในเมนู · ?perf=lite · reduced-motion · จำลองเครื่องช้า → เปิดเอง (ต้องเปิด npm run dev)
node scripts/probe-chibi.mjs <outDir> [baseUrl]   # chibi ทุกท่า + ไม่บังปุ่มที่ 1920×1080/1280×720
node scripts/probe-impact.mjs <outDir>   # ภาพหน้าจอการ์ดผลที่จะเกิด/ⓘ/หน้าต่างยืนยัน ทั้ง 2 โหมด (ต้องเปิด npm run dev ไว้) · exit 2 ถ้ามี error หรือ Space/Esc ผิด
node scripts/fetch-osm.mjs · scripts/fetch-poi.mjs · scripts/build-dem.mjs   # ข้อมูลพื้นหลัง (ถนน/แม่น้ำ, POI, DEM)
node scripts/extract-buildings.mjs <BD_footprintTH.shp> <BD_footprintTH.dbf> [--clip=boundary.geojson] [--rescan]
python scripts/build-final-mission-package.py   # สร้าง gistda-request/revenge_Final_Mission_Package.docx
```

- **URL params:** `?officer` โหมดฝึกเจ้าหน้าที่ · `?unlock` ครูปลดล็อก Expert/Stress ทั้งหมด · `?perf=lite|full` โหมดประหยัด · `?mute` ปิดเสียง · `?chibilab` ดูท่า chibi · `?demo` ข้ามหน้าเปิดเกม/pre-test (ไม่นับสถิติ) · `?seed=N` สถานการณ์ตายตัว · `?mode=expert` · `?stress=data,roads,time` หรือ `?stress=all` (Stress Test) · `?speed=N` เร่งคัตซีน (ใช้ตอนอัดคลิป) · `?rec` เปิด `window.__maesai` ให้สคริปต์อัดคลิปอ่านเฉลย (ห้ามใช้ตอนเล่นจริง)
- **ห้ามดับเบิลคลิก `index.html` ที่ root** — เป็น entry ของ Vite
- คีย์ลัด: `Space` = เดินเวลาไปเหตุการณ์ถัดไป · `Ctrl+Shift+L` แผงครู
- **Sphere API key อยู่ใน `missionConfig.js` (SPHERE.apiKey)** ตามที่ผู้ใช้สั่ง — ตั้งทับได้ด้วย `.env.local` → `VITE_SPHERE_API_KEY` · ออฟไลน์/คีย์ใช้ไม่ได้ = fallback ข้อมูลในเครื่อง
- ไฟล์อาคารดิบทั้งประเทศอยู่ที่ `C:\Users\Computer\Downloads\BD_footprintTH-001.shp` + โฟลเดอร์ `BD_footprintTH-20261009T194218Z-1-002` — **ห้ามคัดลอกเข้า repo**
- Viewport ที่ทดสอบ: 1920×1080 (หลัก) และ 1280×720 · แผงซ้าย/ขวาพับได้
- แผงครู (Ctrl+Shift+L) มี 2 แท็บ: ภาพรวม Sandbox Test · เทียบรอบ 1 → รอบ 2 (Paired t-test) · Export CSV 4 แบบ: รายผู้เล่น · รายการตัดสินใจ · การขอคำใบ้ · รอบ 1 เทียบรอบ 2
- **เครื่องมือบนเครื่อง:** Node.js 24 + npm 11 (ใช้ `npm.cmd` ใน PowerShell — execution policy บล็อก npm.ps1) · Git · Playwright Chromium + ffmpeg · Python + python-docx/PyMuPDF
- **Git:** GitHub repo **private** `TEAMNAJAA/maesai-command` (branch `main`) · `.gitignore` ตัด `node_modules/`, `recordings/`, `*.local`, `.env` · repo มีใบสมัครที่มีเบอร์โทร/อีเมลสมาชิก **ห้ามเปลี่ยนเป็น public**

## 3. โครงสร้างไฟล์

| Path | หน้าที่ |
| --- | --- |
| `src/config/missionConfig.js` | **ค่าตั้งทั้งหมด:** SFVI, THRESHOLDS, CLOUD_RULE, TRUST, RELIEF, THEOS2 (3 รอบองก์ 1 ที่ T−42/−26/−11), **TIME + CMD_MIN** (เวลาสั่งการ/คัตซีน), MISSION (60 วัน), MODES (beginner/expert · `tutor` = ผู้ช่วยสอน+คำใบ้ · `impactJudge`), COSTS (บาท), DURATIONS, BOAT, FUEL_FACTOR 1.4, ACT2, RESCUE (≤ 9 จุดผู้ติดค้าง), HYDRO, EVENT, DATA, EMBANKMENT, SPHERE, SCORE, **HINTS** (ขั้นสูงสุดต่อองก์ 3/2/1 · หัก 1/2 คะแนน · เพดาน 10), EVAL |
| `src/config/scenarioData.js` | SRC 4 สี, COMMUNITIES, HOSPITAL, SHELTER_POOL (7), CAMP_SITES (3), EQUIPMENT, SECTORS, LAYERS, QUIZ, **WHY** (เหตุผล/โลกจริง/ทำถูก/ทำพลาด/ข้อมูลที่ใช้ ของแต่ละขั้น — ปุ่ม ⓘ) … |
| `src/lib/scenario.js` | `makeScenario(seed, mode)` — สุ่มต่อเกม: ฉากดินถล่ม 6 sector, ความกว้างลำน้ำ 20–34 ม., รอบโคจร+เมฆพยากรณ์, รอบถ่ายองก์ 2, เมฆลอย, พายุ, ไฟรั่ว, จุดอับ, จุดอพยพ 3 แห่ง, ถนนขาด, หลังคาเยียวยา 8 หลัง |
| `src/lib/sections.js` | 10 โซนจากหลังคาจริง (k-means) · `sectionDepth` · `GAPS_BY_SECTION` |
| `src/lib/sim.js` | ฟังก์ชันล้วน: `computeSfvi`, `depthAt`, `arrivalAt`, `zoneOutcome`, `exposureSummary`, `makePoints`, `reliefSummary`, `missionScore` |
| `src/lib/hydro.js` · `clouds.js` · `routes.js` · `rng.js` · `leaderboard.js` | กราฟน้ำ · เมฆลอย (Boolean model 35–65%) · วางแผนเรือ (`planTrip`: ตัวเลือก Sphere มาก่อน + ตัวคำนวณในเครื่อง 3 แบบ + **"เลี่ยงจุดอันตราย"** (`SAFE_VARIANT` เมื่อยังไม่มีเส้นปลอดภัย) + **"ผ่านจุดสิ่งกีดขวาง"** (เมื่อซากบนถนนตัดขาด ช้า ×1.5), ตรวจอันตรายทุกเส้นด้วย `hazardsAt` — **โซนของจุดผู้ติดค้าง/ฐาน/ปลายทางไม่นับเป็นน้ำลึก · ริมน้ำยกเว้นในรัศมี 320 ม. ของจุด · ไฟรั่วไม่ยกเว้น** (21 ต.ค.: เดิม 40% ของจุดไม่มีเส้นปลอดภัยเลย — `tests/routes.test.js`), `hazardMarks`) · seeded RNG · ตารางอันดับ (localStorage) |
| `src/lib/sphereRoutes.js` | เส้นทางเรือจาก **GISTDA Sphere Routing API**: `fetchBoatLegs` ขอ 2 โหมด (c เร็วสุด · d สั้นสุด) ทุกขา + ขากลับ · ถ้าทุกเส้น Sphere เจออันตราย → ขอใหม่ผ่านจุดแวะจากเส้นทางในเครื่องที่ปลอดภัย (`sphere-via`) · cache ต่อคู่จุด · ล้มเหลว/ออฟไลน์ = null (ใช้ OSM) · ฟังก์ชัน fetch ฉีดได้สำหรับเทสต์ |
| `src/lib/buildings.js` · `embankment.js` · `geo.js` · `sphere.js` · `evalLogger.js` | อาคาร GISTDA · แนวตลิ่ง 14 จุด · projection/router ออฟไลน์ · Sphere API · logger CSV |
| `src/engine/world.js` | state เริ่มต้น, `advanceTo` (เหตุการณ์ตามเวลา + `event()` ที่ทำให้ปุ่ม "เดินเวลา" หยุด), `enterAct2/3`, งานภาคสนาม (jobs), เรือวิ่งรับ-ส่งเอง (shuttle) |
| `src/engine/actions.js` | ทุกคำสั่งเป็น pure transition และ `spend(CMD_MIN.x)` เดินเวลาตามเวลาสั่งการ |
| `src/engine/impact.js` | **การ์ด "ผลที่จะเกิด"**: `previewEvac/Capture/Seal/Camp/Pass2/Field(pump·power·tower·drone)/Boat/Skip/Verdict/Survey` — รันคำสั่งจริงจาก actions.js บนสำเนา state แล้วอ่านผลต่าง (งบ เวลา ความเชื่อมั่น) + แบบจำลอง → `{title, rows:[{group: use/get/risk, tone, th, judge}], verdict}` · แถว `judge` = ประเมินตามกฎ (เตือนผิด/ทันเวลา/เสียเปล่า) แสดงเฉพาะ Beginner (`MODES.impactJudge`) |
| `src/engine/whatif.js` | **"ถ้าคุณเลือกอีกทาง"** `whatIf(s, scn, act)` → การ์ดเรียงตามผลกระทบ `{title, you, alt, delta, lesson, sum}` + `good` (สิ่งที่ทำได้ดี) + `totals` — เปลี่ยนการตัดสินใจทีละเรื่องแล้วคำนวณใหม่ด้วยแบบจำลองเดียวกับเกม: องก์ 1 เวลาสั่งอพยพรายโซน/เตือนผิด/อุดตลิ่ง/ค่า N/เป้า THEOS-2 (เมฆจริง)/แปลภาพ/ฐาน · องก์ 2 คนที่สูญเสีย (ไม่มีใครพบ→โดรน/เสา/THEOS-2 · พบแล้วไม่ส่งเรือ/ส่งช้า), รอบ Q ที่ไม่ได้สั่ง, เสบียงไม่ทัน, เส้นทาง, ผู้บาดเจ็บ · องก์ 3 คำตัดสินผิดรายหลัง, สำรวจเกินจำเป็น, ผลถ้าใช้ทั้งอำเภอ |
| `src/ui/whatif.jsx` | `WhatIfPanel` (คุณเลือก → ถ้าเลือก, ตัวเลขผลต่าง, บทเรียน, สิ่งที่ทำได้ดี) ในหน้าสรุปองก์ 1–2 และแท็บองก์ 1/2/3 ในหน้าสรุปภารกิจ |
| `src/lib/compare.js` · `src/modals/teacherCompare.jsx` | **เทียบรอบ 1 → 2**: `sessionMetrics()` (บันทึกตอนจบภารกิจใน `result.metrics`) · `roundPairs()` จับคู่ด้วยชื่อผู้เล่น (ไม่นับ demo/ยังไม่จบ, เตือนถ้า seed ซ้ำ) · `pairedT()` Paired t-test (incomplete beta) · `compareSummary` · `previousRound` · `pairsCSV` → แท็บ "เทียบรอบ 1 → รอบ 2" ในแผงครู (การ์ดสรุป + กราฟเส้นรายคน + ตาราง 9 ตัวชี้วัด + ตารางรายคน + Export CSV) และการ์ด "เทียบกับรอบก่อนของคุณ" ในหน้าสรุปภารกิจ |
| `src/engine/hints.js` | **คำใบ้แบบบันได**: `ladder(topic, ctx)` → 3 ขั้น (ถามชวนคิด → ชี้ที่ข้อมูล `go`/`spot` → เฉลยบางส่วน) ของ 11 หัวข้อ `a1.camp/task/read/channel/seal/evac` · `a2.pass/find/hazard/route` · `a3.relief` — คำนวณจาก state ปัจจุบัน · `rungOf`, `maxRungFor` |
| `src/ui/hints.jsx` | `HintLadder` (การ์ดบันได ใช้ในแถบผู้ช่วยสอน + หน้าแปลภาพ/วัดลำน้ำ/วางแผนเรือ/เยียวยา) · `spotlight(selector)` ไฟกะพริบ `[data-hint-spot]` รอบข้อมูลที่ขั้น 2 ชี้ |
| `src/ui/impact.jsx` | `ImpactCard` (ใช้/ได้/เสี่ยง + แถบสรุป) · `ImpactHover` (การ์ดลอยเมื่อชี้ปุ่ม, portal) · `ConfirmImpact` (หน้าต่างยืนยันก่อนสั่งอพยพ/ข้ามไปจบองก์ — Enter ยืนยัน, Esc ยกเลิก, **Space ไม่ทำอะไร** กันกดยืนยันโดยติดมือ) · `WhyButton` ⓘ อ่าน `WHY` ใน scenarioData.js |
| `src/engine/useEngine.js` | `commit()` · **`advance({mode: next / span / until / end})` เดินเวลาแบบแอนิเมชัน + `cut` (คัตซีน)** · `realMs()` เวลาเล่นจริง · hook `?rec` |
| `src/panels/timebar.jsx` | แถบเวลาใต้แผนที่: เหตุการณ์ถัดไป · +1 ชม. · เดินเวลา/ให้ THEOS-2 ถ่าย · ข้ามไปจบองก์ (`actSettled`) |
| `src/map/Cutscene.jsx` | คัตซีน THEOS-2 4 ช็อต: วงโคจร (โลก+บรรยากาศ+โมเดลดาวเทียม) → กล้องสแกน push-broom บนภูมิประเทศ SRTM จริง/ภาพ Sphere + หลังคา GISTDA + เมฆจริง → ดาวน์ลิงก์สถานีภาครับ → ประมวลผล L3 Ortho (AWAGAD) · การ์ดเดินเวลา (หน้าปัดนาฬิกา วันที่ ระดับน้ำ/เรือ) · คลิกเพื่อข้าม |
| `src/modals/intro.jsx` | **หน้าเปิดเกม (TitleScreen) + หน้าวิธีเล่น (HowToPlay)** — ใช้ตอบกรรมการ: เกมคืออะไร, หน้าจอ/เวลา, 3 องก์, Logic Matrix, ข้อมูล GISTDA, คะแนน/วัดผล |
| `src/panels/datahub.jsx` · `actions.jsx` · `quest.jsx` · `chrome.jsx` | แผงซ้าย (SFVI/ดาวเทียม/โซน/ทรัพยากร) · แผงขวา (แท็บคำสั่ง) · กล่องภารกิจ + TutorBar (`hint.topic` + `lead` → ขั้น 1 ของบันได, ปุ่ม "ขอคำใบ้เพิ่ม" เปิดการ์ดบันได) · TopBar (เวลาเล่นจริง)/AlertLog/StatusBar/Toast |
| `src/modals/analysis.jsx` · `planner.jsx` · `modals.jsx` · `guide.jsx` | แปลภาพบนภูมิประเทศ SRTM จริงของ sector (ก่อน=หน้าแล้ง มี.ค. / หลัง=มรสุม ก.ย., รอยดินถล่ม/นา/เงาเมฆ/รอยเก่า แบบสมจริง) + วัดลำน้ำบนภาพ Pan 0.5 ม. (กำแพงกันน้ำ ตลิ่ง หลังคา ต้นไม้ — `data-river` คือผิวน้ำ) · วางแผนเรือบนภาพ Sphere (สถานะ Sphere สด `data-sphere-status`, กลุ่มเส้นทาง Sphere/OSM, เลือกจำตามเส้นทางไม่ใช่ลำดับ, จุดอันตรายบนเส้นทางเฉพาะ Beginner, ไทม์ไลน์ออก–ถึง–กลับ) · quiz/veto/สรุปองก์/แผงครู · Leaderboard |
| `src/map/GeoMap.jsx` · `MapCanvas.jsx` | แผนที่ catchment/urban/corridor · สลับมุมมอง |
| `src/aar/AarShell.jsx` | องก์ 3: ภาพหลังคา Sphere ก่อน/หลัง (โคลนบนพื้น หลังคาสะอาด), ไทม์ซีรีส์เรดาร์, สำรวจภาคพื้น, คะแนน, รายงาน CSV |
| `scripts/demo-flow.mjs` · `demo-kit.mjs` | ผู้เล่นอัตโนมัติ (คลิก UI จริง ใช้เฉลยจาก `?rec`) · เคอร์เซอร์/คำบรรยาย/ffmpeg |
| `tests/` | vitest: scenario + engine + sphereRoutes (Sphere ปลอมแบบฉีด ไม่ใช้เน็ต) + impact (การ์ดตรงกับผลจริงของคำสั่ง, ไม่แก้ state, Expert ไม่เห็นแถว judge) + hints (ทีละขั้น, จำกัดตามองก์, หักคะแนน, ขั้น 1 ไม่บอกคำตอบ, ขั้น 3 ตรงกฎ, Log/CSV) |

**Stack:** React 18 · Vite 5 (+ vite-plugin-singlefile) · Tailwind 3 · lucide-react · recharts · vitest · ไม่มี backend

## 4. ตรรกะหลัก

### เวลา (สำคัญ — ตามที่ผู้ใช้กำหนด 17 ต.ค.)
- **ไม่มีนาฬิกาเดินเอง ไม่มีการนั่งรอ** — เวลาในเกมเดินเมื่อ (1) สั่งการ: ผลเกิดทันทีและกินเวลาสั่งการ `CMD_MIN` (ฐาน 60 · แปลภาพ 20 · วัด N 15/ครั้ง · อพยพ 30 · คำสั่งองก์ 2 ครั้งละ 5–10 นาที) หรือ (2) กดแถบเวลา: `+1 ชม.` · `เดินเวลา → เหตุการณ์ถัดไป` (Space) · `ให้ THEOS-2 ถ่ายรอบ Pn` (ไปจนได้ภาพ) · `ข้ามไปจบองก์` (เมื่อไม่มีงานค้างที่มองเห็น)
- เหตุการณ์ที่หยุดการเดินเวลา (`event()` ใน world.js): ภาพพร้อม · ดาวเทียมกำลังผ่านแต่ยังไม่เลือกเป้า · น้ำถึงเกณฑ์เตรียมพร้อม/วิกฤต · พายุ · ไฟรั่ว · ผลรอบ THEOS-2 · สายด่วน · โดรนพบ · ทีมงานเสร็จ (เสา/ตัดไฟ/สูบ) · เสบียงไม่ถึง/ช่วยไม่ทัน
- ระหว่างกระโดดเวลาแสดงคัตซีน 1–3 วินาที (THEOS-2 ราว 6 วินาที — ดาวเทียมผ่านตอน k≈0.3 ของคัตซีน) · คลิกที่ใดก็ได้เพื่อข้าม (`skipCut`)
- **เป้าหมายความยาว:** ผู้เล่นเก่งจบ 3 องก์ราว 7 นาที (ป้าย ⚡) · ครั้งแรก 12–15 นาที · `realMs()` วัดเวลาจริง ใช้ใน Leaderboard (คะแนนเท่ากันเรียงตามเวลา) และสรุปองก์

### องก์ 1 (T−48 → T0) — กล่องภารกิจ 6 สเต็ป
ตั้งฐาน → เลือกเป้าหมาย THEOS-2 (2 เป้า/รอบ ตามเมฆพยากรณ์ > 60% ใช้ไม่ได้) → ถ่าย (คัตซีน) → แปลภาพ (คลิกหมุดรอยดินถล่มใหม่ ระวังนา/เงาเมฆ/รอยเก่า → L) → วัดลำน้ำ (พิกเซล × 0.5 ม. → N) → เลือกกลยุทธ์แนวตลิ่ง 4 แผน (ทีมทำงานระหว่างเวลาเดิน) → สั่งอพยพรายโซน (งบต่อโซน; หลักฐานไม่พอ = เตือนผิด) · Veto 1 ที่ 4.20 ม.

### องก์ 2 (T0 → T+36)
เมฆลอย 35–65% · THEOS-2 3 รอบเห็นคนเฉพาะโซนเมฆเปิด (ไม่เห็นในจุดอับ → โดรน) · สายด่วนแจ้งหลังน้ำถึง 1–7 ชม. (โซนสัญญาณล่มแจ้งไม่ได้) · ผู้ติดค้าง ≤ 9 จุด (อยู่ไม่ได้ → เรืออพยพ, บาดเจ็บ → รพ.; อยู่ได้ → ถุงยังชีพ) · วางแผนเรือเลือกเส้นทางเอง (ริมน้ำ/ลึก ≥ 1.6 ม./ไฟรั่ว = ผิด · **Beginner เห็นป้ายอันตรายบนการ์ดทุกเส้น + จุดบนแผนที่เสมอ** และกล่อง "ยังไม่มีเส้นทางที่ปลอดภัย" บอกว่าต้องตัดไฟ/สูบน้ำก่อน `data-no-safe-route` · Expert อ่านเองจากแผนที่) · เรือวิ่งรับ-ส่งเองจนจุดหมด · น้ำมัน 140% · เครื่องสูบ −0.5 ม. · ปุ่มข้ามไปน้ำลดขึ้นหลัง T+12 เมื่อจุดที่มองเห็นได้รับการช่วยครบ (จุดที่ยังไม่พบจะสูญเสีย)

### องก์ 3 (วันที่ 2 → 60)
หลังคาจริง 8 หลัง · ภาพ Sphere ก่อน/หลัง (ฝั่งหลังจำลองโคลนรอบบ้านตาม mudLevel) · ไทม์ซีรีส์เรดาร์ 14 วัน · ท่วม ≥ 7 วัน = ฿9,000 · + โคลน = +฿10,000 · หลักฐานขาด → สำรวจภาคพื้น (+2 วัน ฿1,500)
- **กันกดเดา (B10):** คำตัดสินเป็น "ร่าง" จนกว่าจะยืนยัน (`lockVerdict` ทีละหลัง `data-lock` / `lockAll` "ยืนยันคำตัดสินทั้งหมด" `data-lock-all` + หน้าต่างยืนยัน) · ล็อกแล้วแก้ไม่ได้ (`s.locked`) · ร่างไม่นับใน `reliefSummary` / คะแนน / ledger / what-if · คะแนน ผลถูก/ผิด และยอด "ถ้าตัดสินถูกทุกหลัง" ซ่อนจนกว่าจะล็อกครบ → `ReliefReveal` เปิดผลทีละหลังพร้อมตราประทับ (คลิกเพื่อเปิดทั้งหมด) → `revealRelief` (`s.reliefRevealed`) → จึงเห็นคะแนน/บันทึก Leaderboard ได้

### การ์ด "ผลที่จะเกิด" + ⓘ (ข้อ 10, 19 ต.ค.)
- คำสั่งใหญ่ (สั่งอพยพ · ข้ามไปจบองก์) เปิด `ConfirmImpact` ก่อนเสมอ · คำสั่งที่เลือกค่าก่อนกด (ถ่าย THEOS-2 · อุดตลิ่ง · อพยพ · โดรน · เครื่องสูบ) มีการ์ดในแผงตลอด · ปุ่มเล็ก (ตั้งฐาน · สั่งถ่ายองก์ 2 · ตัดไฟ · ตั้งเสา · ส่งเรือ · ตัดสินเยียวยา · สำรวจ) มีการ์ดเมื่อชี้
- **ห้ามให้การ์ดเผยความจริงที่ผู้เล่นยังไม่รู้** (เช่น เมฆจริงในอนาคต, จุดผู้ติดค้างที่ยังไม่พบ, ผลจริงของหลังคา) — ใช้แค่สิ่งที่หน้าจอมีอยู่แล้ว + แบบจำลอง
- Expert เห็นเฉพาะต้นทุน (`judge: false`) → ผู้เชี่ยวชาญต้องประเมินความเสี่ยงเอง = "ปิดตัวช่วย" ที่ตอบกรรมการได้
- เพิ่มคำสั่งใหม่ → เพิ่ม `previewX` ใน impact.js + คีย์ใน `WHY` + เทสต์ใน tests/impact.test.js

### คำใบ้แบบบันได (ข้อ 9, 19 ต.ค.) — scaffolding ที่ค่อย ๆ ถอนออก
- แถบผู้ช่วยสอน **ไม่บอกคำตอบ** แล้ว: แสดงข้อเท็จจริงสั้น (`lead`) + ขั้น 1 "ถามชวนคิด" (ฟรี) · ผู้เล่นกด "ขอคำใบ้เพิ่ม" → ขั้น 2 "ชี้ที่ข้อมูล" (−1 คะแนน, พาไปแท็บ/มุมมอง + ไฟกะพริบ) → ขั้น 3 "เฉลยบางส่วน" (−2)
- องก์ 1 ได้ถึงขั้น 3 · องก์ 2 ถึงขั้น 2 · องก์ 3 มีแค่คำถาม (`HINTS.maxRung`) · Expert ไม่มีคำใบ้ · หักรวมไม่เกิน 10 · เปิดซ้ำไม่หักซ้ำ (`s.hints[topic]` = ขั้นสูงสุด)
- สิ่งที่เคยให้คำตอบตรง ๆ ย้ายไปอยู่หลังบันได: รายชื่อโซน SFVI ≥ 0.62 (ขั้น 3 อพยพ) · "วิธีดู" ดินถล่ม (ขั้น 2 แปลภาพ) · ตัวอย่างคำนวณ N (ขั้น 3) + เส้นประขอบน้ำ (ขั้น 2) · เครื่องหมายอันตรายบนแผนที่เรือ (ขั้น 2) / ป้ายอันตรายบนการ์ดเส้นทาง (ขั้น 3 — ปิดในองก์ 2) · นับวันท่วมขังให้ (ขั้น 3 — ปิดในองก์ 3)
- คะแนน: `missionScore().total = base − hints.pts/100` · AAR แสดงแถว "คำใบ้แบบบันได" · สรุปองก์แสดงจำนวนที่ขอ · Logger: `session.hints[]`, sessions CSV (`hints_pointer`, `hints_partial`, `hint_penalty_pts`, `hint_topics`) + `hintsCSV()` รายครั้ง (ปุ่มในแผงครู)
- เพิ่มหัวข้อ → เพิ่มใน `TOPICS` ของ hints.js + ให้ `questFor` คืน `topic` + เทสต์ใน tests/hints.test.js · ขั้น 1 ห้ามมีชื่อโซน/ตัวเลขคำตอบ

### "ถ้าคุณเลือกอีกทาง" (ข้อ 11) · Stress Test (ข้อ 4) · เทียบรอบ 1/2 (ข้อ 12) — 19 ต.ค.
- **What-if** แสดงหลังจบองก์เท่านั้น จึงเปิดเผยความจริงได้ (เมฆจริง จุดที่ไม่มีใครพบ ผลจริงของหลังคา) · ประวัติที่ต้องใช้: `p.revealedAt` `p.firstBoatAt` `p.escalated` `p.lostAt` และ `s.routeLog[]` (เส้นทางที่เลือกเทียบเส้นที่ดีที่สุดทุกเที่ยว) · ตอนจบองก์ 2 คนที่ยังรอในบ้านที่อยู่ไม่ได้นับเป็นสูญเสีย (เหมือน enterAct3)
- **Stress Test** (`STRESS` ใน missionConfig) ครูเลือกที่หน้าเปิดเกม (`StressPicker`, seed เดิม) หรือ `?stress=` · ใช้สตรีมสุ่มแยก (`R('stress')`) หลังสุ่มฉากปกติ → **ปิด Stress = ฉากเหมือนเดิมทุกอย่าง** · ข้อมูลหาย: `scn.stress.lostPass/lostQ` (ภาพหาย + event), เมฆ +15 จุด (`clouds.bonus`), สายด่วน +2 ชม., เรดาร์ขาดรอบ +2 หลัง · ถนนขาด: +4–6 ถนน, จุดอพยพ 2 แห่ง · เวลาลดลง: เริ่ม T−36 (`s.t0`), `CMD_MIN` ×1.5 (`scn.stress.cmdFactor` ใน `spend`) · แสดงป้ายบน TopBar, Leaderboard (STRESS ×n), AAR, Log/CSV (`stress`, `seed`, `mode`)
- **เทียบรอบ** ต้องให้ผู้เล่นใช้ชื่อเดิมและกดบันทึกคะแนน (เขียน `result.metrics`) · `logger.finish` รวมผลเดิม (แบบทดสอบหลังเรียนไม่ลบ metrics) · `logger.meta()` อัปเดต mode/seed/stress เมื่อครูเปลี่ยนก่อนเริ่ม

### เสียง (B1–B3 + C2, 19 ต.ค.)
- `src/lib/audio.js` สังเคราะห์ทุกเสียงด้วย Web Audio (ไม่มีไฟล์เสียง): เพลง ambient/lo-fi (แพดคอร์ด + เมโลดี้สุ่มใหม่ทุกห้อง + กลองสวิง + echo) 4 ระดับ `audio.setIntensity(0–3)` สงบ → ตึง → วิกฤต → คืนวิกฤต (App ตั้งตามระดับน้ำ/เส้นตายผู้ติดค้าง) · เสียง UI ทุกปุ่ม (`installUiSounds`: hover กันรัว 70 ms + click) · `audio.play('theos')` เสียงประจำตัว THEOS-2 (โน้ต D–A–E–F♯ + กล้องสแกน + ติ๊ดดาวน์ลิงก์) ตอนคัตซีน THEOS-2 และสั่งถ่ายองก์ 2 · เสียงตาม toast (ok/error/alarm) · ชุดเสียงสำหรับข้อถัดไป: megaphone thud boat drone splash zap stamp flip tick thunder boss hit win
- เริ่มเสียงหลังคลิก/กดคีย์ครั้งแรก · `src/lib/prefs.js` (localStorage `maesai-command.prefs.v1`) เพลง/เอฟเฟกต์ เปิด-ปิด + ระดับเสียงแยก (ค่าเริ่มต้นเบา) · `?mute`/`?rec` ปิดเสียง · เมนู 🔊 บน TopBar (`src/ui/settings.jsx`, `data-settings`, `data-pref`, `data-pref-vol`) · `window.__maesaiAudio` อ่านสถานะ (running/musicOn/level)

### ตัวละคร chibi (B8 + B12, 19 ต.ค.)
- `src/lib/profile.js` (localStorage `maesai-command.profile.v1`): ทรงผม 5 · สีผม 6 · สีผิว 5 · ชุด 4 (EOC/กู้ภัย/GISTDA/เสื้อกันฝน) · **รูปหน้าเก็บแยกที่ `maesai-command.photo.v1`** ครอปกลาง ย่อ 160 px JPEG — **PDPA: อยู่ในเครื่องนี้เท่านั้น ห้ามใส่ Log/CSV/Leaderboard** (tests/chibi.test.js ตรวจ) · ปุ่ม "ลบรูป" `data-photo-remove`
- `src/ui/chibi.jsx` `Chibi({profile, pose, size, still})` SVG ล้วน 14 ท่า (`POSES`: idle inspect ruler point megaphone carry clipboard remote switch pump cheer shock serious monitor) · keyframes `chibi-*` ใน index.css · ดูทุกท่าที่ `?chibilab`
- หน้าสร้างตัวละคร `src/modals/chibiCreator.jsx` (`data-chibi-creator`, `data-hair`, `data-hair-color`, `data-skin`, `data-outfit`, `data-photo-upload`, `data-chibi-done`) เปิดจากหน้าเปิดเกม (`data-chibi-edit`)
- ทุกคำสั่งใน useEngine ห่อด้วย `wrap(fn, kind)` → `fx.emit('action', {kind})` (`src/lib/fx.js` event bus) → `useChibiPose` เลือกท่า (modal → คัตซีน THEOS → คำสั่งล่าสุด 3.6 วิ → ดีใจ/ตกใจ → วิกฤต → องก์ 3) → `ChibiDock` ใต้แผงซ้าย (`data-chibi-dock`, `data-chibi-say`) · chibi อยู่ในคัตซีน THEOS-2 และการ์ดเดินเวลาด้วย
- `node scripts/probe-chibi.mjs <outDir>` (ต้องเปิด npm run dev) ภาพทุกท่า + ตรวจว่า chibi ไม่บังปุ่ม/ข้อมูลที่ 1920×1080 และ 1280×720 · exit 2 ถ้าบังหรือมี error

### ฉากเรือ/โดรน + อุบัติเหตุเรือ (B7, 19 ต.ค.)
- **เส้นทางผ่านอันตราย = เกิดอุบัติเหตุเสมอ (ไม่สุ่ม):** ผ่านไฟรั่ว → `shock` เรือโดนไฟช็อต ลูกเรือ 2 คนส่ง รพ. (`s.crewHospital`) เรือหยุด 9 ชม. · ริมน้ำ/น้ำลึก → `capsize` เรือล่ม ลูกเรือลอยคอถูกช่วยขึ้น ซ่อม 6 ชม. (`BOAT_INCIDENT` ใน missionConfig) · เรือถึงจุดอันตรายที่ 55% ของขาไป · ผู้ติดค้างยังรอ (`firstBoatAt` ไม่ถูกตั้ง) · `s.incidents[]` `{kind, boat, point, at, until, coords, splitAt}` · ยังนับเป็นเส้นทางผิดร้ายแรงใน ledger · **ไม่มีใครตายบนจอ**
- `src/map/ActionScene.jsx` `ActionScenes` (ใน App): รับ `fx 'scene'` จาก `sceneOf(kind, before, after)` ใน useEngine (ผลมาจาก engine ฉากแค่แสดง) → เรือแล่นตามเส้นทางที่เลือกบนแผนที่จริง (หลังคา GISTDA + ถนน OSM ใต้น้ำ + แม่น้ำสายไหลเชี่ยว, `Backdrop` memo) พร้อมคลื่นหัวเรือ · ไฟช็อต = ประกายไฟ + โครงกระดูกการ์ตูน ~0.3 วิ → ลูกเรือตัวดำผมตั้งตาหมุน + รถพยาบาล · ล่ม = เรือโยกแล้วคว่ำ ลูกเรือในห่วงชูชีพ → **การ์ดความรู้** (`data-knowledge`, `data-knowledge-ok`) · โดรน: ปล่อยจากถนนน้ำท่วม → มุมกล้องสแกนหลังคาจริงของโซน (ไม่เผยผลก่อนโดรนบินครบ)
- คลิก/Space/Enter/Esc = ข้าม (Space ไม่เดินเวลาต่อ — `stopImmediatePropagation`) · `?speed` เร่ง · ย่อเองบนจอเล็ก · chibi อยู่คอลัมน์ขวาของฉาก ไม่บังเส้นทาง · **โหมดเจ้าหน้าที่ (`prefs.officer`)**: ไม่มีฉากโดรน/เรือปกติ ฉากอุบัติเหตุเหลือประกายไฟ + ข้อเท็จจริง ไม่มีโครงกระดูก/chibi
- **กู้เรือ (21 ต.ค.):** แผงปฏิบัติการมีการ์ดเรือที่เสียหาย (`data-damaged-boat`) + ปุ่ม "กู้เรือ" (`data-salvage`, `A.salvageBoat`, `previewSalvage`, ⓘ `WHY.salvage`) — ฿18,000 · ล่ม 90 นาที / ไฟช็อต 150 นาที (`BOAT_INCIDENT.salvage`) แทนรอซ่อม 6–9 ชม. · job `salvage` หยุดเวลาเมื่อเรือกลับมา · ไม่หักคะแนน
- แผนที่: ซากเรือ (⚡/🛟 `data-incident`) อยู่ ณ จุดเกิดเหตุจนซ่อมเสร็จ · สรุปองก์ 2 / AAR / CSV แสดงจำนวนเรือล่ม/ไฟช็อต (`boat_capsize`, `boat_shock` ใน sessions CSV) · what-if นับเวลาซ่อมจริง
- บอท: `scenes()` ใน demo-flow รอฉาก/กดการ์ดความรู้ · `DEMO_MISTAKE=shock|capsize node record-demo.mjs` ให้บอทเลือกเส้นทางอันตราย 1 ครั้ง (ทดสอบ/อัดคลิปฉากอุบัติเหตุ) · tests/incident.test.js

### แผนที่มีชีวิต + สภาพอากาศ (B6 + C3, 19 ต.ค.)
- `src/lib/weather.js` `weatherAt(s, scn)` → `{rain, lightning, wind}` 0–1 **จากแบบจำลองเดิมเท่านั้น**: อัตราฝนที่สถานี R (`rainAt`) × เมฆลุ่มน้ำ (`cloudAt`) · ช่วงวิกฤตรอบ T0 (T−6 → T+8 ชม.) · พายุองก์ 2 **หลังเกิดแล้ว** (`s.stormHit`) จางใน 3 ชม. · องก์ 3 ฟ้าโปร่ง → ท้องฟ้าไม่บอกล่วงหน้า (tests/weather.test.js ตรวจ)
- `src/map/Weather.jsx` ใน MapCanvas (screen space, z-5 ใต้ปุ่มแผนที่): ฝน 2 ชั้นเป็นพื้นหลัง SVG เลื่อนด้วย CSS (`.rain-far/.rain-near`, ไม่ re-render React) + ท้องฟ้ามืดลงตามฝน · ฟ้าแลบสุ่มเฉพาะภาพ/เสียง (`audio.play('thunder')` ดีเลย์ 0.25–1.65 วิ) ถี่ขึ้นตาม `lightning` · prop `boost` สำหรับคืนวิกฤต (D4)
- GeoMap: แม่น้ำสายบวมและไหลเร็วขึ้นตามระดับน้ำ (`swell`) · น้ำในโซนค่อย ๆ เปลี่ยน (CSS transition `EASE`) + ลายระลอกคลื่นเลื่อน (`#flood-ripple`) · โซนไฟรั่วขอบกะพริบ + ประกายไฟ (`data-power-live`) จนกว่าจะตัดไฟ · ผู้ติดค้างที่พบแล้วส่ง SOS (วงคลื่น 2 ชั้น เร็วขึ้นเมื่อใกล้เส้นตาย) · เรือเลื่อนนุ่มระหว่างก้าวเวลาพร้อมรอยคลื่น V (`MapBoat`) · เงาเมฆบนพื้นใต้เมฆจริงองก์ 2 (เมฆเดียวกับที่ THEOS-2 ใช้ ณ เวลาปัจจุบันเท่านั้น) · มุมตลิ่งน้ำไหลเร็วตามมวลน้ำ
- ของที่กินเฟรมติดคลาส `fx-heavy` (ฝน ฟ้าแลบ ระลอก ประกายไฟ รอยคลื่น เงาเมฆ) → โหมดประหยัด (D5) ปิดได้ด้วย CSS
- หมายเหตุทดสอบ: แผง Browser ที่ซ่อน/ภาพหน้าจอในแผงมาช้าหลายวินาที — ฟ้าแลบ 0.7 วิตรวจด้วย DOM (`[data-lightning-flash]`) หรือเฟรมจากคลิป record-demo แทน

### Game feel (C1 + B9, 20 ต.ค.)
- `src/ui/juice.jsx`: `floatsFor(prev, next)` (ฟังก์ชันล้วน) → ตัวเลขลอยจากผลต่างของ state จริง: งบที่ใช้ (`[data-hud="budget"]`) · น้ำมัน (`data-hud="fuel"`) · ความเชื่อมั่น (`data-hud="trust"`) · คนปลอดภัย/ได้เสบียง (บนหมุด `data-point-marker`) · ครัวเรือนที่สั่งอพยพ (บนโซน `data-zone`) · ตลิ่งที่อุด (`data-gap`) · คะแนนที่หักจากคำใบ้ — **ไม่มีคำว่าถูก/ผิด** (การตัดสินรอจบองก์) · ข้ามองก์ไม่ลอย · `useJuice(s)` + `<Floaters/>` (portal, `data-float`)
- `useShake(ref)` สั่นทั้งคอนโซลเบา ๆ ด้วย Web Animations เมื่อ fx `shake`: เรือล่ม/ไฟช็อต · น้ำถึงเกณฑ์ Veto · พายุ · มีกลุ่มสูญเสีย · `<Tween>` ตัวเลขงบ/น้ำมันวิ่งไปค่าใหม่ (มี timeout กันค้างเมื่อหน้าไม่ได้วาด) · `.btn` ยุบเมื่อกด · `lowMotion()` = ปิดสั่น/ตัวเลขวิ่งในโหมดประหยัด/ระบบขอลดการเคลื่อนไหว
- B9: ทุกคำสั่งขยับ chibi — เพิ่ม `review` (ดูหลังคา) `verdict` (ร่างคำตัดสิน) `hint` (ขอคำใบ้) ใน `ACTION_POSE`

### โหมดประหยัด (D5, 20 ต.ค.)
- `src/lib/perf.js` `installPerf()` (main.jsx) · `prefs.perf`: `auto` (ค่าเริ่มต้น) / `off` ภาพเต็ม / `on` ประหยัด · `?perf=lite|full` · auto เปิดเองเมื่อเฟรมเรต < 30 ติดกัน 2 ช่วง × 4 วิ (ไม่วัดเมื่อแท็บซ่อน, ปิดการวัดใน `?rec` เพื่อให้คลิปได้ภาพเต็ม) หรือเครื่องตั้ง prefers-reduced-motion
- เปิดแล้ว `<html class="perf-lite" data-perf="lite-manual|lite-fps|lite-reduced-motion">` → ซ่อน `.fx-heavy` · ปิดเส้นสแกน CRT, glow ของแม่น้ำ, backdrop blur, แอนิเมชันน้ำไหล/ใบพัด · `Weather` ไม่เรนเดอร์ (ไม่มีฟ้าร้อง) · ไม่สั่นจอ/ตัวเลขไม่วิ่ง — **ข้อมูลและคะแนนเหมือนเดิม** (tests/perf.test.js)
- เมนู 🔊 มีส่วน "โหมดประหยัด" (`data-perf-section`, `data-pref-perf`) · เปิดเองแล้วขึ้น `PerfNotice` (`data-perf-notice`) 7 วิ · `node scripts/probe-perf.mjs <outDir> [baseUrl]` ตรวจปุ่ม, URL, reduced-motion และจำลองเครื่องช้า (exit 2 ถ้าไม่ผ่าน)

### คืนวิกฤต T0 — บอส "มวลน้ำ" (E + D4, 20 ต.ค.)
- `src/engine/boss.js` ฟังก์ชันล้วน ผลกำหนดจาก seed + การเตรียมตัวองก์ 1 (`BOSS` ใน missionConfig · ข้อความการ์ด/ท่า `BOSS_CARDS`/`BOSS_MOVES` + ⓘ `WHY.boss*` ใน scenarioData)
  - มวลน้ำ: แรงดัน = 100 × (1 − 0.45 × สัดส่วนฟันหลอที่อุดเสร็จ) · แรงซัด = 4 + 2 × ฟันหลอที่เปิด · ท่า 4 ตา (`moveSchedule(seed)`: คลื่นซัด → สุ่มลำดับ ทะลักฟันหลอ/ตู้ไฟ/ฝนซ้ำ) · "ดินถล่มอุดลำน้ำแตก" มีเฉพาะเมื่อไม่ได้แปลภาพหรือไม่ได้วัด N · เห็นท่าถัดไปเมื่อ Beginner และ SFVI ≥ 0.62 (Expert ไม่เห็นเลย)
  - ผู้บัญชาการ: ชาวบ้านปลอดภัย = % ครัวเรือนเสี่ยงที่อพยพทัน (ขั้นต่ำ 15) · พลัง/ตา = 2 + ทีมที่ลงพื้นที่แล้วและว่างตอน T0 (≤ 5) **+1 ใน Beginner (chibi ช่วยประสานงาน)** (21 ต.ค.: เดิม 1 + ทีมว่าง → ทีมยังทำงานตอน T0 แพ้แน่นอน และคนไม่ใช้ทีมเลยได้พลังมากสุด) · งบจริง · ความเชื่อมั่นจริง (คูณผลการ์ดอพยพ) · การ์ด 7 ใบ: ประสานจากฐาน (ฐานต้องพ้นน้ำ) บิ๊กแบ็ก เครื่องสูบ ตัดไฟ ประกาศอพยพ เรือเตรียมพร้อม ภาพ THEOS-2 (`cardBlock` บอกเหตุผลที่ใช้ไม่ได้)
  - ผู้บัญชาการลงมือก่อน (ระบายจนหมด = น้ำไม่ได้ซัดตานั้น) · ชนะ = แรงดัน 0 ใน 4 ตา · แพ้ = ตลิ่งแตก `s.breach` โซนเสี่ยงที่สุด +0.4 ม. ตั้งแต่ T0 (`breachAt` ใน `depthAt` — **ไม่แก้คำตัดสินองก์ 1 ย้อนหลัง**: `arrivalAt` ไม่นับ breach) → ผู้ติดค้างองก์ 2 มากขึ้น เกมเล่นต่อได้
  - ทุกตา = 1 รายการใน decisionLedger (`s.bossLog`) + รายการผล `boss` (ดี/ผิด) · `bossBest` (ทุกชุดการ์ดที่ใช้ได้ × เล่นต่อจนจบคืนด้วย 2 แผนง่าย เลือกชุดที่จบดีสุด ~0.3 วิ) ใช้กับโหมดเจ้าหน้าที่/ข้ามฉาก/บอท และ **กล่อง "ผู้ช่วยแนะนำ" ใน Beginner** (`data-boss-advice`, ปุ่ม `data-boss-advice-use` — ท่าที่มองไม่เห็นถือว่าเป็นคลื่นซัด ไม่เผยของจริง) · ไม่เตรียมตัวยังแพ้ (tests/boss.test.js balance) · `enterAct2` เรียก `resolveBoss` ถ้ายังไม่ได้สู้ (ไม่มีรายการรายตา)
- `src/modals/BossBattle.jsx` (`data-boss`, `data-boss-card`, `data-boss-end`, `data-boss-busy`, `data-boss-intent`, `data-boss-result`, `data-boss-continue`) เปิดเมื่อ T0 ก่อนสรุปองก์ 1 · มวลน้ำเป็นคลื่นยักษ์ม้วนตัว ไม่มีหน้า (เคารพผู้ประสบภัย) · D4: แสงแดงเรือง ฝนหนัก ฟ้าแลบถี่ + ฟ้าร้อง เพลงระดับ 3 chibi จริงจัง · Enter = จบตา · `window.__maesai.bossBest()` (?rec) ให้บอท · สรุปองก์ 1 มี `EmbankmentSummary` (`data-embankment-summary=held|breached`) · CSV `boss_won/boss_fought/boss_turns`
- `node scripts/probe-boss.mjs <outDir> [baseUrl]` ภาพทุกช่วงที่ 1920/1280 + Expert ซ่อนท่า + ไม่เตรียมตัว → ตลิ่งแตก → องก์ 2 มี breach · tests/boss.test.js

### โหมดฝึกเจ้าหน้าที่ (F4, 20 ต.ค.)
- `prefs.officer` — เปิดที่หน้าเปิดเกม (`data-officer-toggle` ข้างปุ่มวิธีเล่น) · เมนู 🔊 (`data-pref="officer"`) · `?officer` (`?officer=0` ปิด) · ป้าย "โหมดฝึกเจ้าหน้าที่" บน TopBar (`data-officer-badge`)
- ปิด: chibi ทุกที่ (dock, หน้าเปิดเกม, หน้าสร้างตัวละคร, คัตซีน, ฉากเรือ/โดรน) · ฉากบอส (T0 จัดการอัตโนมัติด้วย `eng.autoBoss()` → สรุปองก์ 1 แสดง `EmbankmentSummary` "ประเมินจากการเตรียมตัว" ไม่มีรายการตัดสินใจรายตา) · เพลง · เอฟเฟกต์ตลก (โครงกระดูก/ตัวดำ — เหลือประกายไฟ + ข้อเท็จจริง) · สั่นจอ
- คงไว้: ระบบสนับสนุนการตัดสินใจทั้งหมด (SFVI, การ์ดผลที่จะเกิด, ⓘ, คำใบ้, what-if, สภาพอากาศ, ตัวเลขลอยที่เป็นข้อมูล) · บันทึก `session.officer` + คอลัมน์ `officer` ใน sessions CSV
- `node scripts/probe-officer.mjs <outDir> [baseUrl]` ตรวจปุ่มหน้าเปิดเกม/เมนู/URL ทั้ง 1920 และ 1280 · `RECORD_PARAMS=officer node record-demo.mjs` เล่น 3 องก์ในโหมดนี้ · tests/officer.test.js

### กลยุทธ์แนวตลิ่ง (B4, 20 ต.ค.)
- `SEAL_PLANS` / `SANDBAG` / `SEAL_RISK` ใน missionConfig · แผงคำสั่งแท็บตลิ่งมีตัวเลือก 4 แผน (`data-seal-plans`, `data-seal-plan=risk|full|sandbag|none`, `data-seal-go`) + การ์ดผลที่จะเกิด `previewSealPlan` + ⓘ `WHY.seal_*` · หมุดบนแผนที่ยังอุดทีละจุดได้
  - **เฉพาะจุดเสี่ยง** บิ๊กแบ็กเฉพาะฟันหลอหน้าโซน SFVI ≥ 0.62 (น้อยกว่า 3 โซน → 3 โซน SFVI สูงสุด) `sealTargets` — ถูก เร็ว ดีเท่าที่หลักฐานบอก (หลักฐานอ่อน = เลือกพลาด) จุดที่เหลือยังรั่ว
  - **บิ๊กแบ็กทั้งแนว** — แพง ช้า กันได้มากสุด
  - **กระสอบทราย** ราคา ×0.3 เวลา ×0.45 แต่พังครั้งแรกที่น้ำถึง 4.6 ม. (`sandbagFailAt`, ไม่กลับมา) → ช่วยชะลอน้ำช่วงแรกแต่ไม่ช่วยยอดน้ำ/บอส · event "กระสอบทรายพัง" · หมุดสีน้ำตาล → แดงเมื่อพัง · อัปเกรดเป็นบิ๊กแบ็กทีหลังได้
  - **ไม่อุด** เก็บงบไว้อพยพ (`s.sealPlan = 'none'`)
- `openGapsOf(s, sec, t)` นับกระสอบทรายที่พังเป็นช่องเปิด · `bigbagSealed(s)` ใช้ในบอส · ledger `sealItem`: บิ๊กแบ็กครบ หรือครบทุกจุดหน้าโซนที่น้ำถึงจริง = ดี · กระสอบทราย = พอใช้ · ไม่อุด = พอใช้ถ้าอพยพทัน ≥ 90% ไม่งั้นผิด · what-if เทียบกับบิ๊กแบ็กทั้งแนว · คำใบ้ a1.seal ใหม่ · tests/seal.test.js

### เกรด S/A/B/C ท้ายองก์ (C4, 20 ต.ค.)
- `actGrade(s, scn, act)` (sim.js) จากรายการตัดสินใจขององก์นั้นใน decisionLedger: นับ **จำนวนครั้งที่ผิด** (ผิด + ผิดร้ายแรง + ข้าม) → `ACT_GRADES` ใน missionConfig (S ≤ 1 · A ≤ 3 · B ≤ 6 · C มากกว่า — แก้ 21 ต.ค. เดิมผิดร้ายแรงครั้งเดียวก็ตก C) · null จนกว่าองก์จะจบ
- `src/ui/gradeStamp.jsx` `GradeStamp` ตราประทับกระแทก (`stampIn`) + เสียง `stamp` + สั่นเบา · หัวสรุปองก์ 1/2 และแถว 3 องก์ในหน้าสรุปภารกิจ (`data-grade`, `data-grade-act`, `data-act-grades`) · CSV `act_grades` เช่น "SAB" · tests/grade.test.js

### ศูนย์ควบคุม + โคลนชัด (B11, 20 ต.ค.)
- เข้าองก์ 3 (หลังคาแรกเปิดอัตโนมัติ) → ฉากศูนย์ควบคุม EOC (`ControlRoom` ใน ActionScene.jsx, `data-action-scene="control"`, `sceneOf('review')` เฉพาะหลังคาแรก) — chibi ใส่แว่นหน้าจอ ผนังจอข้อมูล และจอใหญ่แสดงภาพ Sphere จริงของพื้นที่ + กรอบหลังคา + เส้นปาดก่อน/หลัง (ฝั่ง "หลัง" ปรับโทนทั่วไปเท่านั้น **ไม่วาดโคลน** — ให้ผู้เล่นอ่านหลักฐานเอง) · คลิกข้าม · โหมดเจ้าหน้าที่ไม่แสดง
- ภาพ "หลัง" ใน RoofScene: โคลนเฉพาะ `mudLevel ≥ RELIEF.mudVisibleLevel` (0.4 = บ้านที่มีโคลนจริงทุกหลัง) → ตะกอนน้ำตาลหนาราว 30 ม. รอบบ้าน + รอยไหล + คราบน้ำบนผนัง (เส้นเข้มรอบหลังคา) + แอ่งน้ำขัง + เศษขยะ (`MudDetail`, `data-mud-detail`) · บ้านที่ไม่มีโคลน: ลานบ้านสะอาด (ตัดตะกอนทั่วย่าน + แอ่งน้ำรอบบ้านออก) · filter `blob` ใช้ userSpaceOnUse (เดิมถูกตัดเป็นสี่เหลี่ยมเล็ก)
- `node scripts/probe-relief.mjs <outDir> [baseUrl]` ฉากศูนย์ควบคุม + ภาพทุกหลัง ตรวจว่ามีโคลน ⇔ `r.mud` · tests/mud.test.js

### ยศ · เหรียญ · ปลดล็อก · แฟ้มประวัติ (A1–A4, 20 ต.ค.)
- `src/lib/career.js` · `CAREER` ใน missionConfig: ยศตามแต้มสะสม (คะแนนภารกิจที่กดบันทึก) อาสาสมัคร 0 → หัวหน้าชุด 1,500 → ผอ.ศูนย์ 4,000 → ผู้บัญชาการ EOC 8,000 (`rankFor`)
- เหรียญ 8 แบบผูกกับนิสัยที่อยากสอน (`MEDALS`, `medalsFor(s, scn, {realSec})` ฟังก์ชันล้วน, ต้องลงมือจริงจึงได้): ไม่เตือนผิดเลย · พบผู้ติดค้างครบ (ต้องส่งเรือด้วย) · ไม่ใช้คำใบ้ (Beginner, ภารกิจไม่ล้มเหลว) · จบใน ~7 นาที · ตัดไฟก่อนส่งเรือทุกครั้ง · แปลภาพไม่ผิดเลย · ตลิ่งรับยอดน้ำ · เยียวยาถูกทุกหลัง
- ปลดล็อก (`CAREER.unlocks`, `unlocked(rankIndex, unlockAll)`): Expert + Stress "ข้อมูลหาย" ที่หัวหน้าชุด · "ถนนขาด" ที่ ผอ.ศูนย์ · "เวลาลดลง" ที่ผู้บัญชาการ EOC · **ครูปลดล็อกทั้งหมด** ปุ่ม `data-unlock-all` บน Stress Picker (`prefs.unlockAll`, `?unlock`) · `?mode=expert` / `?stress=` ใช้ได้เสมอ
- แฟ้มประวัติ (localStorage `maesai-command.career.v1`, ชื่อเล่น + ผลรอบ — ไม่มีรูป/ข้อมูลส่วนตัวอื่น): บันทึกเมื่อกด "บันทึกคะแนน" (ไม่บันทึกใน `?demo`/`?rec` หรือไม่มีชื่อ) · `src/modals/careerFile.jsx` `CareerFile` (`data-career-file`) เปิดจากหน้าเปิดเกม (`data-career`) · ยศ (`RankBadge`, `data-title-rank`) ใต้ช่องชื่อ · หน้าสรุปภารกิจมีแผงเหรียญรอบนี้ + "เลื่อนยศ" (`data-run-medals`, `data-rank-up`) · CSV `medals`
- `node scripts/probe-career.mjs <outDir> [baseUrl]` · tests/career.test.js

### สมุดการ์ดความรู้ (D1, 20 ต.ค.)
- `KNOWLEDGE` (14 ใบ, scenarioData) — THEOS-2 · L3 Ortho/AWAGAD · ดินถล่มใหม่ · เงาเมฆ · รอยเก่า · ค่า N · SFVI · แนวตลิ่ง · RADARSAT-2 · โดรน · ไฟรั่ว · น้ำเชี่ยว · GISTDA Sphere · มติ ครม. เยียวยา (เนื้อหา + "ในเกม" + ที่มา + `how` วิธีปลดล็อก) · การ์ดความรู้หลังเรืออุบัติเหตุใช้เนื้อหาเดียวกัน
- `src/lib/dex.js` `dexUnlocks(s, scn)` (ฟังก์ชันล้วน, เฉพาะสิ่งที่เกิดบนจอจริง) + `dex.see()` สะสมใน localStorage `maesai-command.dex.v1` · App ตรวจทุกครั้งที่ state เปลี่ยน → `DexToast` (`data-dex-toast`, คลิกเปิดสมุด) · ปุ่มสมุดบน TopBar (`data-dex` + จำนวนที่สะสม) → `DexBook` (`data-dex-book`, `data-dex-card`, `data-dex-detail`, ล้างสมุด `data-dex-reset`)
- `node scripts/probe-dex.mjs <outDir> [baseUrl]` · tests/dex.test.js

### พาดหัวข่าว / โซเชียลจำลอง (D2, 20 ต.ค.)
- `src/lib/news.js` `newsFor(prev, next, scn)` ฟังก์ชันล้วนจากผลต่างของ state จริง: สั่งอพยพ (ข่าวดี) · **เตือนผิด** (ข่าวร้าย + โพสต์ชาวบ้านไม่เชื่อ) · อุดตลิ่งครบ/ไม่อุด/กระสอบทรายพัง · ผลคืนวิกฤต · ความเชื่อมั่นข้ามเกณฑ์ (โพสต์ #แม่สายไม่ทิ้งกัน / ไม่เชื่อ EOC) · เรือพาคนปลอดภัย (ชื่อชุมชน) · เสบียงถึง · เรือล่ม/ไฟช็อต · ตัดไฟ · พายุ · ความสูญเสีย **เฉพาะกลุ่มที่ผู้เล่นพบแล้ว** (ไม่เผยจุดที่ไม่รู้) · เริ่มเยียวยา — น้ำเสียงให้เกียรติผู้ประสบภัย
- App ส่ง `fx.emit('news')` → `src/ui/newsFeed.jsx` `NewsFeed` มุมล่างขวาของแผนที่ (มุมมองตลิ่งยกเหนือแถบฟันหลอ) การ์ดข่าว/โพสต์ 6.5 วิ (`data-news-card`) + รายการย้อนหลัง (`data-news-open`, `data-news-list`)
- `node scripts/probe-news.mjs <outDir> [baseUrl]` ตรวจว่าไม่บังปุ่มแผนที่ทั้ง 2 มุมมอง/2 ขนาดจอ · tests/news.test.js

### SFVI และคะแนน (score v2 — 19 ต.ค. B5+B14)
SFVI = 0.30·W + 0.25·R + 0.20·L + 0.15·N + 0.10·P (≥ 0.62 = หลักฐานพอ)
- **คะแนนรวม (เต็ม 1000) = คะแนนผลงาน × ตัวคูณการตัดสินใจ − คำใบ้** (`missionScore` ใน sim.js → `points`, `perf`, `partPoints` เทียบ `max` เช่น "อพยพ 140 / 200", `decision`, `hintPts`) · ผลงาน: THEOS-2 200 · อพยพ 200 · ผู้ติดค้าง 200 · เยียวยา 200 · โลจิสติกส์ 100 · ความเชื่อมั่น 100 · คำใบ้ 10 แต้ม/คะแนนเดิม (≤ 100)
- **ไม่มีคะแนนฟรี (B5):** อพยพนับเฉพาะโซนที่น้ำถึง · ไม่ส่งเรือเลยโลจิสติกส์ = 0 · ไม่เตือนภัยก่อน T0 ความเชื่อมั่น = 0
- **`decisionLedger(s, scn)`** ประเมินทุกการตัดสินใจ ✅ good · ⚠️ fair · ❌ bad · ⏭️ skip · ☠️ critical พร้อมเหตุผลไทย (นับเฉพาะองก์ที่จบแล้ว): ฐาน · รอบ THEOS-2 · แปลภาพรายภาพ · ค่า N · อุดตลิ่ง · อพยพรายโซน · เตือนผิด (ครั้งที่ 2+ = ☠️) · รอบ Q · ตัดไฟ · เสา · โดรนจุดอับ · เส้นทางเรือทุกเที่ยว (ไฟรั่ว = ☠️ · น้ำเชี่ยว/ลึก = ❌) · ผู้ติดค้างรายจุด (พบแล้วไม่ส่ง/ส่งช้า > 60 นาทีจนสูญเสีย = ☠️, ส่งทันแต่ไม่พอ = ❌) · ผู้บาดเจ็บ · เยียวยารายหลัง · สำรวจเกินจำเป็น · `s.bossLog` (ชุด E) + ผลคืนวิกฤต (แพ้แต่สู้เอง = ⚠️ เพราะแต่ละตาถูกตัดสินแล้ว · ไม่ได้สู้ = ❌ · ข้อความบอกโซนที่น้ำทะลักและการเตรียมตัว)
- **ตัวคูณนับจำนวนครั้งที่ผิด** (ผิด + ผิดร้ายแรง + ข้าม — ทั้งภารกิจ) → `DECISION.tiers`: ผิด ≤ 7 ครั้ง ดีมาก ×1.0 · 8–11 ครั้ง พอใช้ ×0.85 · 12 ครั้งขึ้นไป ต้องปรับปรุง ×0.7 — **หักมากสุด 30%** (ผู้ใช้กำหนด 21 ต.ค.: "10 คะแนนเหลือ 7") · ความสูญเสียจริงหักอยู่แล้วในคะแนนผลงาน จึงไม่ลงโทษซ้ำด้วยตัวคูณ · ไม่มีระดับ "ภารกิจล้มเหลว" แล้ว · สัดส่วนถูก (ratio) ยังคำนวณไว้แสดง/Log
- UI: `src/ui/decision.jsx` (`DecisionHeadline` แถวแรกของคะแนน · `DecisionList` · `DecisionCounts`) · สรุปองก์ 1/2 มี "การตัดสินใจในองก์นี้" · Leaderboard เก็บ `v: 2` (แต้ม) และแสดงเฉพาะ v2 · Log/CSV: `score_version`, `decision_tier`, `decision_ratio`, `points` · เทียบรอบจับคู่เฉพาะเวอร์ชันเดียวกัน
- เทสต์ `tests/score.test.js` (+ `tests/helpers.js` ผู้เล่นตัวอย่าง): เล่นเก่ง = ดีมาก · ไม่ทำอะไร < 50 แต้ม (×0.7) · ทำแค่ส่วนง่าย ผิด ≥ 12 ครั้ง ได้ไม่ถึง 60% ของคนเล่นเก่ง · เส้นทางอันตราย = ผิด (ไฟรั่ว = ร้ายแรง) แต่ตัวคูณไม่ต่ำกว่า ×0.85 · ตารางตัวคูณตามจำนวนครั้งที่ผิด · เตือนผิดซ้ำ = ☠️

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
- Sphere: Routing ✓ (เส้นทางอพยพ + เส้นทางเรือ) · Tiles ✓ · Elevation คืน `null` บางจุด → ใช้ SRTM · ภาพ Sphere เป็นภาพปัจจุบัน
- `gistda-request/revenge_Final_Mission_Package.docx` เขียนก่อนเปลี่ยนระบบเวลา — ถ้าจะส่งใหม่ต้องปรับข้อความเรื่องเวลา/โหมด
- ค่าสถานการณ์ (floodStage โซน, ครัวเรือน, ผู้ติดค้าง, หลังคาเยียวยา) รอข้อมูล ปภ./GISTDA
- รอบชิงชนะเลิศ (กติกา GISTDA): วิดีโอ ≤ 5 นาที Full HD · ส่ง Mission Package ล่วงหน้า ≥ 10 วัน · นำเสนอ + ตอบคำถาม ≤ 15 นาที

## 9. แนวทางเขียนโค้ด

- ค่าเกณฑ์/อัตรา/ที่อยู่ข้อมูลใหม่ → `missionConfig.js` · ข้อมูลฉาก → `scenarioData.js` · ห้าม hard-code ใน component
- ตรรกะคำนวณ → `sim.js` (ฟังก์ชันล้วน) · state เปลี่ยนผ่าน `commit()` ใน `useEngine` เท่านั้น
- ทุกตัวเลขใหม่บนจอต้องมี `<Src/>` · ข้อความ UI ภาษาไทยใช้คลาส `font-thai` · log สองภาษา (`msg` อังกฤษ + `th` ไทย)
- ใส่ `data-*` (เช่น `data-tab`, `data-layer`, `data-sector`) ให้ปุ่มสำคัญ — `record-demo.mjs` ใช้ selector เหล่านี้ · ยืนยันคำสั่ง: `data-evac-order` → `[data-modal="confirm"]` → `data-confirm` / `data-cancel` · `data-why=<id>` · `data-impact` · `Btn` ส่ง `data-*` ต่อให้ `<button>` แล้ว
- Tailwind arbitrary values + keyframes ใน `index.css` · ระวังเขียน regex แบบ `/[-:T]/` ในโค้ด (Tailwind อ่านเป็นคลาส) ใช้ `/\D/` แทน
- `tailwind.config.js` เปิด opacity ทุกค่า 0–100 (เดิม `/12` `/88` `/97` ฯลฯ ไม่ถูกสร้าง → พื้นหลัง modal โปร่ง/ขอบสว่าง) · ห้ามใช้ `backdrop-blur` ทับแผนที่ (กินเฟรม — index.css ปิดไว้ ยกเว้นคลาส `keep-blur`)
- หลังแก้: `npm run build` แล้ว `node record-demo.mjs` (RECORD_OUT=โฟลเดอร์ชั่วคราว) เพื่อทดสอบ 3 องก์อัตโนมัติ
