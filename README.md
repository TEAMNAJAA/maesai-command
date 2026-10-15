# THEOS-2 MAE SAI COMMAND

**Multi-Sensor Geospatial Serious Game & Integrated Disaster Decision Support System**
ระบบภารกิจจำลองสถานการณ์และสนับสนุนการตัดสินใจบริหารจัดการอุทกภัยแม่สาย

Interactive command-centre simulator for *The GEO Quest 2026* (GISTDA) — ทีม revenge.
The learner is the Mae Sai EOC commander across three acts, deciding under evidence that is never complete.

---

## Run

> ⚠️ Do not double-click the `index.html` in the project root — it is the Vite dev entry.

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:5173 — add `?demo` to skip the briefing and pre-test (presentation mode; the log session is flagged as a demo and excluded from the Sandbox statistics).

**Standalone build (booth / classroom / judging):**

```bash
npm run build
```

Produces one self-contained file, `dist/index.html` (~2.6 MB): code, the AOI GeoJSON, 15,851 real GISTDA building footprints, the SRTM relief and the OpenStreetMap roads are all inlined. Double-click it — it runs offline; with internet it also loads the GISTDA sphere imagery and routing.

**Keyboard:** `1` `2` `3` jump between acts · `Space` runs / pauses the mission clock · `Ctrl+Shift+L` opens the teacher log.

**Sphere API key:** the team key is set in `src/config/missionConfig.js` (override with `VITE_SPHERE_API_KEY` in `.env.local`). Online, the town view uses sphere `thailand_images` as the basemap and evacuation routes come from sphere Routing; offline everything falls back to bundled data. The key ships inside the build — keep the repo private.

---

## Player flow

1. **Mission Briefing** — role (ผู้บัญชาการ EOC แม่สาย), the 3 acts, the decision rules, optional player code.
2. **Pre-test** (5 questions) → **Act I → Act II → Act III** → **Post-test** with the improvement score.

| Act | Window | Map | What the learner decides |
| --- | --- | --- | --- |
| **I** เฝ้าระวัง | T−48 → T−0 h | Real AOI-B catchment (SRTM relief) with THEOS-2 swaths; real AOI-A town; the Sai embankment on GISTDA sphere imagery (zoom 16–17) | A 3-step mission: ① image upstream sectors (L) ② measure the channel and seal the 14 flood-wall gaps (N) ③ evacuate / standby / hold — act 1 closes only through its decision summary |
| **II** วิกฤต | T+0 → T+36 h | SAR scene / AOI-A town with flood band and closed streets | Radar handover, Sphere routing to high ground, triage of the 4 communities |
| **III** ฟื้นฟู | T+36 h → | Before/after slider (town + per roof) | Roof-by-roof relief: ฿9,000 / +฿10,000 / reject / ground survey |

Screen layout: **left** = assessment (live SFVI · river gauge · trust), **centre** = map (view switcher, zoom/pan, 3D tilt), **right** = command panel with the act-1 mission quest box on top and numbered tabs. Finished steps tick green; the next step, its tab and its map view blink (the bulb icon turns the blinking beacons and hints off). Both side rails collapse.

---

## Decision rules as implemented (`src/lib/sim.js`)

```
SFVI = 0.30·W + 0.25·R + 0.20·L + 0.15·N + 0.10·P
```

| | Definition | Provenance |
| --- | --- | --- |
| **W** | Ban Tham Pha Chom level ÷ 4.20 m | วัดจริง |
| **R** | Ban Jotada accumulated rain ÷ 250 mm | วัดจริง |
| **L** | Landslide scars found by THEOS-2 swaths ÷ 17 | วัดจากภาพ THEOS-2 |
| **N** | 1 − measured channel width ÷ 150 m | วัดจากภาพ THEOS-2 |
| **P** | Real GISTDA roofs inside the flood reach ÷ all roofs of the community | วัดจากภาพ + ค่าสถานการณ์ (flood reach is modelled until radar extents arrive) |

- **Veto 1** — level ≥ 4.20 m: red alert, evacuate now; "hold" is disabled.
- **Cloud rule** — cloud > 60 % or optical evidence > 48 h: L weight × 0.4, confidence flagged low. THEOS-2 passes under heavy cloud return no ground pixels. At 100 % cloud (act II) optical layers lock and the radar / routing alert appears.
- **Narrow channel** — measured width < half of 150 m lowers the preparedness band by 0.20 m.
- **Per-community justification** — an evacuation order is evidence-backed if the gauge is at the preparedness band (4.01 m) or every selected community has SFVI ≥ 0.62; otherwise it is a false alarm (−5 / −15 / −40). First order in act II = late warning (−30).
- **Hold** — advances 3 h and shows the dual comparison: households exposed if ordered now vs after waiting, water depth and mud in each community.

The river level, rain and cloud are functions of mission time (scenario hydrograph in `missionConfig.js → HYDRO`): the player changes who is warned, not the water. Flood arrival per community and evacuation time per exit drive the exposure figures.

---

## Where everything lives

| Path | Contents |
| --- | --- |
| `src/config/missionConfig.js` | **All tunables**: SFVI weights, thresholds (4.20 / 4.01 m), cloud rule, trust, relief rates, game costs, hydrograph, event dates, **data paths**, sphere URLs, scoring weights, Sandbox criteria |
| `src/config/scenarioData.js` | Communities, sectors, layers, roofs, quiz, lessons, provenance badges |
| `src/lib/sim.js` | Pure model: hydrograph, SFVI, exposure, hold comparison, relief, mission score |
| `src/lib/buildings.js` | Real GISTDA roofs: flood reach, community assignment, live P, roof cases for act III |
| `src/lib/geo.js` | Web-Mercator projection, AOI access, OSM layers, offline router (Dijkstra) |
| `src/lib/sphere.js` | sphere Routing / Elevation / tiles with graceful fallback |
| `src/lib/evalLogger.js` | Sandbox logger (localStorage) + CSV export |
| `src/engine/useEngine.js` | State machine for the 3 acts |
| `src/map/` | `GeoMap` (real geography), `MapCanvas` (views, tilt, callouts), `terrain` (procedural scenes) |
| `src/panels/` | Left assessment rail, right command rail, top bar / stepper / hint / log |
| `src/modals/modals.jsx` | Briefing, pre/post test, Veto 1 alert, cloud rule, hold comparison, teacher panel |
| `src/aar/AarShell.jsx` | Act III review |
| `src/data/` | Bundled offline data: `osm_maesai.geojson`, `dem_aoi_a/b.jpg + .json` |
| `scripts/` | `fetch-osm.mjs`, `build-dem.mjs`, `extract-buildings.mjs` (national BD_footprintTH → Mae Sai) — regenerate `src/data/` |
| `gistda-request/` | Application documents and AOI files (`MaeSai_AOI_ALL.geojson` is loaded by the app) |

### Plugging in GISTDA data

1. Put the file in `src/data/` (convert Shapefile → GeoJSON EPSG:4326 with QGIS or mapshaper).
2. Uncomment / add the `import` at the top of `missionConfig.js` and set the matching `DATA` slot: `radarFlood`, `landslides`, `buildings`, `theosImagery.before/after`.
3. `npm run build`. Flood polygons replace the simulated flood band and drive the offline router; THEOS-2 before/after images replace the procedural slider.

---

## Teacher log (Sandbox Test)

The discreet database icon (top-right) or `Ctrl+Shift+L` opens the logger. It stores every session on the machine and checks the team's pass criteria: ≥ 70 % of players open ≥ 3 layers before deciding, post-test gain ≥ 30 %, briefing < 10 min. **Export Log CSV** writes one row per player (pre/post for a paired t-test) and one row per decision.

## Demo recording

```bash
npm run build
```

```bash
node record-demo.mjs
```

Drives `dist/index.html?demo` through all three acts at 1920×1080 and writes `recordings/run-<timestamp>/maesai-demo.webm`. Existing videos are never deleted. Exits with code 2 if the page logs any error.

```bash
node record-perfect-run.mjs
```

A "perfect run" from the Mission Briefing to the AAR with a Thai caption on every step (scan 3 sectors, measure N and seal the 14 gaps, evacuate, SAR + Sphere Routing, triage in SFVI order, survey weak evidence, correct relief on all 10 roofs → mission score 100%). Writes `recordings/perfect-run-<timestamp>/demo_gameplay.mp4` (and `.webm`; the mp4 needs ffmpeg).

## Data sources & credits

Building footprints: GISTDA BD_footprintTH · Imagery & routing: GISTDA sphere · AOI boundaries: ทีม revenge (DEM-derived) · Relief: AWS Terrain Tiles (SRTM) · Roads/rivers: © OpenStreetMap contributors (ODbL) · Flood figures: GISTDA RADARSAT-2 (10, 12 Sep 2024) · Relief rates: Cabinet resolution 17 Sep 2024. Community locations other than those in the AOI file, household counts, flood stages and roof cases are **scenario values** and carry the grey badge.
