# CLAUDE.md — THEOS-2 Mae Sai Command

> ไฟล์นี้บันทึก Context ถาวรของโปรเจกต์ ให้อ่านก่อนเริ่มงานทุกครั้ง
> ร่างครั้งแรก 3 ต.ค. 2569 (2026-10-03) หลังติดตั้งระบบใหม่และ Session History เดิมหายไป
> แหล่งความจริงของตรรกะเกม = ใบสมัคร `gistda-request/revenge_ใบสมัคร_แก้ไข_ฉบับสะอาด.docx/.pdf`

## 1. โปรเจกต์คืออะไร

- **ชื่อ:** THEOS-2 Mae Sai Command : Multi-Sensor Geospatial Serious Game and Integrated Disaster Decision Support System
  (ระบบภารกิจจำลองสถานการณ์และสนับสนุนการตัดสินใจบริหารจัดการอุทกภัยแม่สาย ด้วยข้อมูลภูมิสารสนเทศแบบหลายช่วงคลื่น)
- **การแข่งขัน:** The GEO Quest 2026 : THEOS-2 Geospatial Mission Design Challenge (GISTDA) · ประเด็น 05 ด้านการจัดการภัยพิบัติ
- **ทีม:** revenge · นักเรียน ม.6 โรงเรียนสิงห์บุรี 5 คน · หัวหน้าทีม นายศิรวิทย์ พิทักษ์สาลี · ครูที่ปรึกษา นายสิทธิพัฒน์ จิตร์กระจ่าง
- **สิ่งที่สร้าง:** Web App แบบ Serious Game ผู้เรียนสวมบท "ศูนย์บัญชาการเหตุการณ์อุทกภัยอำเภอแม่สาย" ตัดสินใจภายใต้หลักฐานที่ไม่เคยครบ ใน 3 องก์
- **กลุ่มเป้าหมาย:** นักเรียน/ครู · ผู้เข้าชมแหล่งเรียนรู้ (บูธนิทรรศการ) · ชุมชน
- **ข้อกำหนดที่ใบสมัครสัญญาไว้:** Single-Page Web App, ทำงาน Offline ได้ ไม่ต้องล็อกอิน, มีโหมดครูส่งออก CSV Log, ขยายไปลุ่มน้ำอื่นได้โดยเปลี่ยนไฟล์ข้อมูลเชิงพื้นที่, ค่าเกณฑ์ปรับได้ใน Config File

## 2. วิธีรัน / Build

```bash
npm install      # ครั้งแรก
npm run dev      # http://localhost:5173 (มี .claude/launch.json ชื่อ "maesai-command")
npm run build    # ได้ dist/index.html ไฟล์เดียว (~775 KB) inline ทุกอย่าง ดับเบิลคลิกเปิดจาก file:// ได้เลย
node record-demo.mjs   # Playwright อัดวิดีโอเดโม 1920×1080 จาก dist/ → recordings/
```

- **ห้ามดับเบิลคลิก `index.html` ที่ root** — เป็น entry ของ Vite จะขึ้นการ์ดแจ้งเตือนแทนจอขาว
- คีย์ลัด: `1`/`2`/`3` สลับองก์ · `Space` เดิน/หยุดนาฬิกาภารกิจ
- Viewport ที่ทดสอบแล้ว: 1280×720 ถึง 1920×1080 (ไม่ได้ออกแบบให้ reflow ต่ำกว่า 1280 — เป็นจอ kiosk)
- **เครื่องมือบนเครื่อง (ติดตั้งผ่าน winget 2026-10-03):** Node.js 24.19 LTS + npm 11 · Git 2.55 · VS Code 1.140 (+ Tailwind CSS IntelliSense) · Playwright Chromium + ffmpeg 9.0 (สำหรับ `record-demo.mjs`)
- **Git:** GitHub repo **private** `TEAMNAJAA/maesai-command` (branch `main`) · `.gitignore` ตัด `node_modules/` และ `recordings/` (วิดีโอ ~83 MB) ออก · repo มีใบสมัครที่มีเบอร์โทร/อีเมลสมาชิก **ห้ามเปลี่ยนเป็น public**

## 3. โครงสร้างไฟล์

| Path | หน้าที่ |
| --- | --- |
| `src/App.jsx` | **แอปทั้งหมดอยู่ไฟล์เดียว (~3,600 บรรทัด)** แบ่งเป็น 13 section (ดูด้านล่าง) |
| `src/main.jsx` | mount `<App/>` ใน StrictMode |
| `src/index.css` | Tailwind + keyframes (`flash`, `softflash`, `pulsering`, `sweep`, `scanline`, `riseIn` …) + คลาส `.panel` `.panel-hd` `.panel-title` `.hud-label` `.num` `.btn` `.clip-notch` `.clip-tab` `.crt` `.grid-bg` |
| `vite.config.js` | `vite-plugin-singlefile` → build เป็นไฟล์เดียว, `base: './'` |
| `README.md` | วิธีรัน + สคริปต์เดโม 3 องก์ทีละคลิก + ส่วนที่จงใจต่างจาก mock-up |
| `record-demo.mjs` | สคริปต์ Playwright อัดเดโมอัตโนมัติ (มี cursor ปลอมวาดทับ) |
| `recordings/` | วิดีโอเดโม MaeSai-ACT1/2/3.mp4, MaeSai-FULL.mp4, maesai-demo.webm (12 ส.ค. 2569) |
| `dist/index.html` | ตัว build ล่าสุด (24 ก.ย. 2569 23:43 — ใหม่กว่า App.jsx แก้ล่าสุด 23:41) |
| `gistda-request/` | เอกสารยื่น GISTDA — ดูหัวข้อ 7 |

**Section ใน `App.jsx`:** 1 Mission constants · 2 Utilities (PRNG `mulberry32`, `smoothPath`, `pointAt`, `clockLabel`) · 3 Procedural terrain (`useTerrain`, `TerrainDefs`, `OpticalScene`, `SarScene`) · 4 UI atoms (`Panel`, `Src`, `Btn`, `ArcGauge`, `Spark`, `MeterRow`, `StatLine`, `Corners`) · 5 Game engine `useEngine()` · 6 `MapCanvas` · 7 `LayersPanel`/`MiniMap` · 8 `TopBar`/`ActSwitcher` · 9 `WeatherBar`/`AlertLog`/`CriticalBanner` · 10 Command Interface (`SfviPanel`, `DecisionBlock`, `TaskingPanel`, `ResourcePanelAct1`, `ShortagePanelAct2`, `PriorityPanel`, `SituationReport`, `TrustPanel`, `ResolutionProof`) · 11 `CommandShell` (องก์ 1–2) · 12 Act 3 AAR (`ChangeSlider`, `AdjudicationTable`, `AarShell`, `ReportTab`, CSV export) · 13 Root (`App`, `Toast`, `StatusBar`)

**Stack:** React 18 · Vite 5 · Tailwind 3 · lucide-react · recharts · ไม่มี backend ไม่มี asset ภายนอก — แผนที่ทั้งหมดเป็น SVG ที่สร้างจาก seeded PRNG (seed `20240912`) จึงเหมือนเดิมทุกครั้ง

## 4. ตรรกะหลัก (ตามที่ implement จริงใน `useEngine()`)

### SFVI — Sai Flood Vulnerability Index
```
SFVI = 0.30·W + 0.25·R + 0.20·L + 0.15·N + 0.10·P        (SFVI_WEIGHTS)
```
| ตัวแปร | นิยามในใบสมัคร | การคำนวณในโค้ด | ป้ายที่มา |
| --- | --- | --- | --- |
| W | ระดับน้ำสถานีบ้านถ้ำผาจม ÷ 4.20 ม. (กรมทรัพยากรน้ำ) | `clamp(waterLevel / 4.20)` | MEASURED |
| R | ฝนสะสมต้นน้ำ สถานีบ้านโจตาดา (เมียนมา) ปรับ 0–1 (มูลนิธิอาสาเพื่อนพึ่งฯ ผ่าน ThaiWater) | `clamp(rain24 / 250)` — 250 มม. คือค่าเพดานที่ทีมตั้งเอง | MEASURED |
| L | ร่องรอยดินถล่มใหม่ในป่าต้นน้ำ (THEOS-2) | `scarsSeen / 17` (ผลรวม scars ของ sector ที่สั่งถ่ายแล้ว) | IMAGE |
| N | 1 − (ความกว้างปัจจุบัน ÷ 150 ม.) | `1 - channelWidth/150` — ได้ค่าจริงเมื่อสั่งถ่าย Sector D (28 ม.) หรือ E (34 ม.) | IMAGE |
| P | สัดส่วนครัวเรือนในเขตน้ำถึงของแต่ละชุมชน | ค่าคงที่รายชุมชน 0.86 / 0.86 / 0.68 / 0.55 · basin ใช้ค่าเฉลี่ย | SCENARIO |

- คำนวณ 2 แบบ: `sfvi.basin` (ทั้งลุ่มน้ำ ใช้ P เฉลี่ย) และ `sfvi.perCommunity` (ราย 4 ชุมชน) · เกณฑ์ตัดสินใจ `≥ 0.62`
- `sfvi.confidence = 0.34 + 0.3·(swaths/3) + 0.2·(วัดความกว้างลำน้ำแล้ว) + 0.16·(ภาพไม่ล้าสมัย)`

### กฎการตัดสินใจ
- **Veto 1:** `waterLevel ≥ 4.20` → สั่งอพยพทันทีไม่รอภาพ ไม่สน SFVI · ประกาศครั้งเดียว + แถบแดงทั้ง HUD
- **Veto 2 (Cloud Rule):** `cloudCover > 60 || lastImageAgeH > 48` → น้ำหนัก L ถูกตัดเหลือ `0.20×0.4 = 0.08` + ขึ้นป้ายความเชื่อมั่นต่ำ (ไม่ renormalize น้ำหนัก ดังนั้น SFVI สูงสุดเหลือ 0.88)
- **Preparedness band:** `PREP_LEVEL = 4.00` ม. (ใบสมัครระบุ 4.01 ม. เป็นระดับเตรียมพร้อม / Logic matrix ใช้ 4.00–4.20)
- **Tie-break:** คะแนนเท่ากัน → ชุมชนที่เหลือเส้นทางออกน้อยกว่าได้ก่อน (สายลมจอยกับเกาะทรายถูกจูนให้เสมอกันโดยตั้งใจ สายลมจอยชนะเพราะเหลือทางออก 1 เส้น)
- **Trust model:** เตือนผิดทบ −5 / −15 / −40 · เตือนช้า (อพยพครั้งแรกในองก์ 2) −30 ครั้งเดียว · อพยพที่มีหลักฐาน (`water ≥ 4.00 || SFVI ≥ 0.62`) +2.5
- **ปุ่ม "ยังไม่สั่งการ รอภาพรอบหน้า" (HOLD):** ฟรี แต่นาฬิกาเดิน +3 ชม. และนับ `holdCount`

### 3 องก์
| องก์ | ช่วงเวลา (`clock` นาที เทียบ peak) | สิ่งที่เกิดในโค้ด |
| --- | --- | --- |
| **I** มองต้นน้ำที่มองไม่เห็น | T−48 → T−0 | ภาพ THEOS-2 Optical · `coins` 14 ใช้ซื้อ layer (ซื้อครั้งเดียวต่อรอบ เปิดซ้ำฟรี) · `ap` 10,000 · สั่งถ่าย THEOS-2 ได้ 3 swath (1,200 AP/ครั้ง, +95 นาที) เหนือ 6 sector ในเมียนมา เพื่อหา L และ N · 14 จุดฟันหลอ (FW-01…14) คลิกดูการ์ด · Quick deploy บิ๊กแบ็ก/ลาดตระเวน · ตัดสินใจ EVACUATE (1,500 AP) / STANDBY (700 AP) / HOLD |
| **II** วันที่เมฆบังทั้งลุ่มน้ำ | T+0 → T+36 | เมฆ 100% → layer ที่ `optical: true` ถูกล็อก · เปลี่ยนฉากเป็น SAR (RADARSAT-2 / เช็คน้ำ) · เข้าครั้งแรกถูก seed: AP ≤1,250, trust ≤42, water ≥4.68 · อพยพ 700 AP · จุดถนนขาด Mountain Route 7 → "Compute Detour" (Sphere Routing API จำลอง, 500 AP) · Triage จัดลำดับ 4 ชุมชนเทียบ `sfvi.ranked` · แผงทรัพยากรขาดแคลน |
| **III** น้ำลดแต่โคลนยังอยู่ (AAR) | T+36 → | Before/After slider + Change detection · ตารางเยียวยา 10 หลังคา (`ROOFS`): ฿9,000 เหมาจ่าย (ท่วมขัง ≥7 วัน) / +฿10,000 ล้างโคลน / Reject / Survey (฿1,500 แม่นแต่ช้า) → error matrix (correct / overpay / wrongful denial / under-paid) · แท็บ SUMMARY / OPERATIONS / DECISIONS / IMPACT / LESSONS / REPORT · Export CSV (UTF-8 BOM) |

`goAct(n)` คุมการสลับองก์: องก์ที่เข้าผ่าน switcher ครั้งแรกจะถูก seed ค่าสำหรับนำเสนอ, ส่วนที่เล่นต่อเนื่องจะพา state จริงไปด้วย และบังคับ `clock` ให้อยู่ในหน้าต่างเวลาขององก์นั้น

### หลักการป้ายที่มาข้อมูล 4 แบบ (ห้ามละเมิด)
ทุกตัวเลขบนจอต้องติด `<Src t="..."/>` หนึ่งในสี่: `measured` วัดจริง (เขียว `#00FF41`) · `image` วัดจากภาพ (ฟ้า `#38BDF8`) · `radar` เรดาร์ (ม่วง `#A78BFA`) · `scenario` ค่าสถานการณ์ (เหลือง `#FFB300`) — เพื่อไม่ให้ผู้เรียนเข้าใจว่าทุกค่าจริงเท่ากัน

## 5. ค่าคงที่สำคัญ (Section 1 ของ App.jsx)

`CRITICAL_LEVEL 4.20` · `PREP_LEVEL 4.00` · `ORIG_WIDTH 150` · `FLAT_GRANT 9000` · `MUD_GRANT 10000` · `SURVEY_COST 1500` · `INUNDATION_MIN 7` · `SWATH_KM 10.3` · `AP_MAX 10000` · `COINS_MAX 14` · `EVAC_AP {1:1500, 2:700, 3:700}`
ข้อมูลฉาก: `COMMUNITIES` (4 ชุมชน: slj สายลมจอย 1 ทางออก, ksa เกาะทราย, mlk ไม้ลุงขน, mdg เหมืองแดง) · `SECTORS` A–F (รวม 17 scars) · `LAYERS` 10 ชั้น · `TACTICAL` · `ROOFS` · `RES_PROOF` (พิกเซลบริสุทธิ์ = (w−2p)/w)
**กฎ:** ค่าเกณฑ์/อัตราเยียวยาต้องอยู่ในบล็อกค่าคงที่เท่านั้น ห้าม hard-code ลงใน logic (ใบสมัครระบุว่าจะยืนยันค่าจริงปี 2569 กับหน่วยงานภายหลัง)

## 6. ข้อเท็จจริงอ้างอิง (ใช้ในเนื้อหาเกม/รายงาน)

- แม่สายท่วมซ้ำ 6 ครั้งในปี 2567 · พื้นที่ท่วมขัง 6,182 ไร่ (10 ก.ย. 67) → 25,204 ไร่ (12 ก.ย. 67) ×4 ใน 2 วัน · เวลาเตือนภัยจริง 2–4 ชม.
- GISTDA ใช้ RADARSAT-2 ช่วงเกิดเหตุ (10, 12 ก.ย. 67) และถ่าย THEOS-2 หลังน้ำลด (17 ก.ย. 67) · ภาพต้นน้ำที่วิเคราะห์ดินโคลน 13 ก.ย. 67
- ร่องรอยดินถล่มกว้าง 20–30 ม. · ลำน้ำสายแคบลงจาก ~150 ม. เหลือ 20–30 ม. · น้ำจากบ้านโจตาดาถึงแม่สาย ~5 ชม.
- มติ ครม. 17 ก.ย. 67: เหมาจ่าย 9,000 บ./ครัวเรือน + ค่าล้างโคลน 10,000 บ./หลัง
- THEOS-2: Pan 0.5 ม. / MS 2 ม. · swath 10.3 กม. · revisit เฉลี่ย 1.9 วัน · Level 3 Ortho ผ่าน AWAGAD
- บริการ GISTDA ที่ใช้: เช็คน้ำ + Disaster Platform (เรดาร์/วันท่วมขัง), Sphere (Map / Elevation / Routing API), AWAGAD + LANDX · ไม่ใช้: Crops Drought, Carbon Atlas, Dragonfly, FAIPA PM2.5, Life Dee
- ผลสำรวจนักเรียนสิงห์บุรี 80 คน: 20% ไม่รู้ว่าต้นน้ำอยู่นอกประเทศ, 15% ไม่รู้เกณฑ์เยียวยาตามวันท่วมขัง
- **Sandbox Test Plan:** รอบ 1 เพื่อน 8 คน 45 นาที · รอบ 2 ม.ปลาย 10 คน 60 นาที (Pre/Post test 5 ข้อ) · รอบ 3 บูธ 10 คน 15 นาที/คน · **เกณฑ์ผ่าน:** สอนกติกา <10 นาที, Post-test เพิ่ม ≥30%, ผู้เล่น ≥70% เปิดข้อมูล ≥3 ชั้นก่อนตัดสินใจ (วัดจาก log) · ระยะ 2: 120 คน, Paired t-test, SUS ≥80, Cronbach's alpha
- **Stress Test 5 กรณี:** เมฆ 3 วัน (L ล้าสมัย) · สถานีต้นน้ำขาดรายงาน · ทางออกชุมชนถูกตัด · น้ำหลากรอบสองก่อนล้างโคลนเสร็จ · ผู้เรียนไม่สั่งการในองก์ 1 — กฎต้องลดปัจจัยตามลำดับความสำคัญ ไม่ใช่หยุดทำงาน

## 7. เอกสารใน `gistda-request/` (จัดทำ 25 ก.ย. 2569)

- `revenge_ใบสมัคร_แก้ไข_ฉบับสะอาด.docx/.pdf` — ใบสมัครฉบับแก้ไขล่าสุด (มีฉบับ TrackChanges คู่กัน)
- `GISTDA_data_request_revenge_v2.xlsx` — คำขอข้อมูล 9 รายการ · **ต้องมี:** แถว 1 (THEOS-2 Pan ก่อน/หลัง ก.ย. 67 เขตเมือง), แถว 3 (ภาพต้นน้ำเมียนมา), แถว 4 (ขอบเขตน้ำท่วมเรดาร์รายวัน 8 ก.ย.–31 ต.ค. 67) · ที่เหลือ: THEOS-2 ล่าสุด 2569 หาจุดฟันหลอ, ชั้นดินถล่ม/เหมือง, LANDX, Sphere tiles offline + Routing, ชั้นอาคาร, ขอบเขตปกครอง
  - ไม่ต้องขอ GISTDA: Sphere API key (portal.sphere.gistda.or.th) · น้ำท่วมซ้ำซาก (opendata.gistda.or.th) · ระดับน้ำ/ฝน (thaiwater.net) · ครัวเรือน 4 ชุมชน (ปภ.เชียงราย / ทต.แม่สาย)
- `MaeSai_AOI_ALL.geojson` / `.kml` (WGS84) — 12 features:
  - **AOI-A** เขตเมืองแม่สาย–ท่าขี้เหล็ก กรอบ 20.405–20.475°N, 99.830–99.965°E (~109 ตร.กม.)
  - **AOI-B** ลุ่มน้ำสายตอนบนเหนือบ้านถ้ำผาจม ~965 ตร.กม. (99% ในเมียนมา) คำนวณจาก SRTM ~30 ม. · 20.312–20.601°N, 99.382–99.879°E
  - **AOI-B1** ส่วนติดชายแดน ทางตะวันออกของ 99.70°E ~291 ตร.กม. (ขอก่อน)
  - สถานี: **STN0029** บ้านแม่สาย/บ้านถ้ำผาจม (99.8717E, 20.4446N, กรมทรัพยากรน้ำ → W) · **MYA001** บ้านโจตาดา (99.6858E, 20.3913N → R) · MYA002 ดอยต่อคำ · MYA003 สะพานอูทูนอ่อง สบสาย · MYA004 สะพานมิตรภาพแห่งที่ 1
  - ชุมชน (ตำแหน่งประมาณจาก OSM): เกาะทราย, ไม้ลุงขน, เหมืองแดง (**ยังไม่มีจุดสายลมจอย**)
  - LineString แม่น้ำสาย (DEM main stem, 169 จุด)
- `AOI-A_*.kml`, `AOI-B_*.kml`, `AOI-B1_*.kml`, `MaeSai_AOI_map.png` — ไฟล์แยกสำหรับแนบคำขอ

## 8. จุดที่โค้ด / brief / ใบสมัคร ไม่ตรงกัน (ตรวจเมื่อ 2026-10-03)

1. **Cloud Rule:** brief บอก "เมฆบัง 100%" · ใบสมัครบอก "เมฆบัง + ภาพเก่าเกิน 48 ชม." (AND) · โค้ดใช้ `cloud > 60 OR age > 48`
2. **L/N ใช้อะไรซื้อ:** brief บอกใช้เหรียญข้อมูลซื้อภาพ THEOS-2 · โค้ด: เหรียญใช้ซื้อ *layer* ส่วนการสั่งถ่ายเพื่อหา L/N ใช้ *AP* (1,200/swath) · จุดฟันหลอ (บิ๊กแบ็ก) แยกจากค่า N (ความกว้างลำน้ำ)
3. `PREP_LEVEL` 4.00 vs ใบสมัคร 4.01
4. ป้าย `SRC.measured.note` เขียน "Dept. of Water Resources" ครอบทุกค่า แต่ R มาจากมูลนิธิอาสาเพื่อนพึ่งฯ ผ่าน ThaiWater
5. วันที่ใน AAR (BEFORE 28 APR 2025 / AFTER 07 MAY 2025, timeline 28 APR–05 MAY) มาจาก mock-up ไม่ตรงเหตุการณ์จริง ก.ย. 2567
6. Mock-up แสดงระดับน้ำ 6.35 ม. แต่โค้ดยึด 4.20 ม. ตามใบสมัคร (จงใจ — ดู README)

## 9. บั๊กที่รู้แล้ว / Backlog

**บั๊ก**
- **Stale closure ใน `tactical('evac')`** — `tactical` ถูก `useCallback(..., [push])` จึงจับ `issueOrder` ของ render แรก ซึ่งจับ `sfvi.basin` ค่าเริ่มต้น (~0.51) ไว้ตลอด → ในองก์ 1 การกด *Evacuation Alert* ใน TACTICAL ACTIONS จะตัดสินด้วย SFVI ค่าเก่า (อาจนับเป็น false alarm ทั้งที่แผง DecisionBlock บอก EVIDENCE-BACKED) และ decision log/CSV บันทึก SFVI ผิด · แก้: ย้าย `issueOrder` ไว้ก่อน `tactical` แล้วใส่ใน deps หรืออ่าน sfvi ผ่าน ref

**ยังไม่ได้ทำตามใบสมัคร**
- ยังไม่ได้ใช้ข้อมูลภูมิศาสตร์จริง — `MaeSai_AOI_ALL.geojson` ยังไม่ถูกโหลด แผนที่เป็น SVG procedural ทั้งหมด · พิกัดมุมจอ hard-code
- ยังไม่ได้เรียก Sphere API จริง (Map / Elevation / Routing เป็นข้อความจำลอง) — ต้องมี API key และแผน cache สำหรับโหมด offline
- ยังไม่มีภาพ THEOS-2 / RADARSAT-2 จริง (รอผลคำขอข้อมูล GISTDA)
- ค่าคงที่ยังอยู่ใน App.jsx — ใบสมัครสัญญา "Config File" แยก
- ปุ่ม HOLD ยังไม่ "แสดงผลที่เกิดกับทั้ง 4 ชุมชนและเทียบผลสองทาง" ตาม Logic Matrix
- กฎใน Logic Matrix ที่ยังแค่ log ไม่ได้มีผลจริง: ลำน้ำ < ครึ่งความกว้างเดิม → ลดเกณฑ์เตือนภัย · พบดินถล่มใหม่ → เตรียมทรัพยากรล้างโคลน
- ระบบ log สำหรับ Sandbox Test ยังไม่ครบ: ไม่บันทึก "จำนวนชั้นข้อมูลที่เปิดก่อนตัดสินใจ", เวลาเรียนรู้กติกา, ชุมชนที่เลือกเทียบลำดับ SFVI · ไม่มี Pre/Post test
- AAR ส่วนใหญ่เป็นตัวเลข mock-up คงที่ (Mission success 86%, cost summary, damage stats, decision speed) ยังไม่คำนวณจากการเล่นจริง (ยกเว้นงบเยียวยาและ error matrix)
- Stress test 5 กรณีเป็นเพียงข้อความในแท็บ LESSONS ยังเล่นจริงไม่ได้
- ทรัพยากรองก์ 1 ตามใบสมัครมีเรือกู้ภัย/เครื่องจักรหนัก — ยังไม่มีในแผง
- ปุ่มที่ยังไม่ทำงาน: Settings, LogOut, ADD LAYER, VIEW ALL ALERTS, View Detailed Report, ปุ่ม X ของ MiniMap/Command Interface, Request ในองก์ 2 แค่ log

## 10. แนวทางเขียนโค้ด

- รักษาสไตล์เดิม: ไฟล์เดียว แบ่ง section ด้วยกรอบคอมเมนต์ `═══` · คอมเมนต์อังกฤษ + ศัพท์ไทยกำกับ · ข้อความ log/UI สองภาษา (`msg` อังกฤษ + `th` ไทย)
- Tailwind แบบ arbitrary values (`text-[9.5px]`, `tracking-[0.13em]`) · animation ผ่าน `animate-[name_..]` ที่ประกาศ keyframes ใน `index.css`
- พาเลต: void `#050912` · neon `#00FF41` · crit `#FF003C` · warn `#FFB300` · sky `#38BDF8` · radar `#A78BFA` · สีองก์ I/II/III = `#00FF41` / `#FF003C` / `#38BDF8`
- State เปลี่ยนผ่าน `setS` ใน `useEngine()` เท่านั้น · อ่านค่าปัจจุบันใน callback ผ่าน `sRef.current` เพื่อเลี่ยง stale closure
- ทุกตัวเลขใหม่บนจอต้องมีป้าย `<Src/>` · ค่าเกณฑ์ใหม่ต้องไปอยู่ใน Section 1
- หลังแก้ต้อง `npm run build` ให้ `dist/index.html` ทันสมัย (ไฟล์นี้คือสิ่งที่ใช้ส่ง/เปิดบูธ/อัดเดโม) และไล่สคริปต์เดโมใน README ให้ผ่าน
