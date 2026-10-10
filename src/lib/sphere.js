/* ══════════════════════════════════════════════════════════════════════════
   GISTDA sphere web services — Routing · Elevation · Raster tiles
   https://sphere.gistda.or.th/docs/web-service/routing
   Every call degrades gracefully: no key / offline / timeout → caller falls back
   to the offline router or the bundled SRTM DEM.
   ══════════════════════════════════════════════════════════════════════════ */

import { SPHERE } from '../config/missionConfig'

export const sphereReady = () => Boolean(SPHERE.apiKey) && (typeof navigator === 'undefined' || navigator.onLine !== false)

export const sphereTileTemplate = () => (SPHERE.apiKey
  ? SPHERE.tileUrl.replace('{layer}', SPHERE.tileLayer).replace('{key}', encodeURIComponent(SPHERE.apiKey))
  : '')

async function getJson(url) {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), SPHERE.timeoutMs)
  try {
    const r = await fetch(url, { signal: ctl.signal })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return await r.json()
  } finally {
    clearTimeout(timer)
  }
}

/** Route from [lon,lat] to [lon,lat]. Resolves { coords, distanceM, durationS, steps }. */
export async function sphereRoute(from, to, mode = SPHERE.routingMode) {
  if (!sphereReady()) throw new Error('sphere API key not configured')
  const q = new URLSearchParams({
    flon: from[0], flat: from[1], tlon: to[0], tlat: to[1], mode, key: SPHERE.apiKey,
  })
  const fc = await getJson(`${SPHERE.routingUrl}?${q}`)
  const feats = fc?.features || []
  if (!feats.length) throw new Error('no route returned')
  const coords = feats.flatMap((f) => f.geometry?.coordinates || [])
  return {
    coords,
    distanceM: feats.reduce((a, f) => a + (f.properties?.distance || 0), 0),
    durationS: feats.reduce((a, f) => a + (f.properties?.interval || 0), 0),
    steps: feats.map((f) => f.properties?.name).filter(Boolean),
  }
}

/** Elevation (m above MSL) at a point. */
export async function sphereElevation(lon, lat) {
  if (!sphereReady()) throw new Error('sphere API key not configured')
  const q = new URLSearchParams({ lon, lat, key: SPHERE.apiKey })
  const res = await getJson(`${SPHERE.elevationUrl}?${q}`)
  const v = Array.isArray(res) ? res[0]?.elevation : res?.elevation
  if (typeof v !== 'number') throw new Error('no elevation')
  return v
}
