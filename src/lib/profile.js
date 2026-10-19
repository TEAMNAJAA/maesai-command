/* ══════════════════════════════════════════════════════════════════════════
   PROFILE — ตัวละคร chibi ของผู้เล่น (ทรงผม สีผม สีผิว ชุด ชื่อ รูปหน้า)
   PDPA: รูปหน้าเป็นข้อมูลส่วนบุคคล → เก็บใน localStorage ของเครื่องนี้เท่านั้น
   ไม่เข้า Log / CSV / Leaderboard / ไม่ส่งขึ้นอินเทอร์เน็ต · ลบได้ทุกเมื่อ (removePhoto)
   ══════════════════════════════════════════════════════════════════════════ */

import { useSyncExternalStore } from 'react'

const KEY = 'maesai-command.profile.v1'
const PHOTO_KEY = 'maesai-command.photo.v1'            // kept apart so deleting it is one clean step

export const HAIR = [
  { id: 'short', th: 'สั้น' }, { id: 'bob', th: 'บ๊อบ' }, { id: 'pony', th: 'หางม้า' }, { id: 'spiky', th: 'ตั้ง' }, { id: 'long', th: 'ยาว' },
]
export const HAIR_COLORS = ['#1f1a17', '#4a2f1d', '#8b5a2b', '#c58b3a', '#6b6f7a', '#7a3b8c']
export const SKIN = ['#fde2c8', '#f6cfa6', '#e8b48a', '#c98d62', '#9b6744']
export const OUTFITS = [
  { id: 'eoc', th: 'เสื้อกั๊ก EOC', main: '#f97316', trim: '#fde047', under: '#1e3a5f' },
  { id: 'rescue', th: 'แจ็กเก็ตกู้ภัย', main: '#dc2626', trim: '#f8fafc', under: '#1f2937' },
  { id: 'gistda', th: 'โปโล GISTDA', main: '#1e3a8a', trim: '#38bdf8', under: '#1e3a8a' },
  { id: 'rain', th: 'เสื้อกันฝน', main: '#facc15', trim: '#0f172a', under: '#334155' },
]
const DEFAULT = { hair: 'short', hairColor: HAIR_COLORS[0], skin: SKIN[1], outfit: 'eoc' }

let data = { ...DEFAULT }
let photo = null
try { data = { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { /* private window */ }
try { photo = localStorage.getItem(PHOTO_KEY) || null } catch { photo = null }
let snap = { ...data, photo }
const subs = new Set()
const emit = () => { snap = { ...data, photo }; subs.forEach((fn) => fn()) }

export const profile = {
  get: () => snap,
  set(patch) {
    data = { ...data, ...patch }
    delete data.photo
    try { localStorage.setItem(KEY, JSON.stringify(data)) } catch { /* ignore */ }
    emit()
  },
  /** Store a face photo (already cropped and shrunk). */
  setPhoto(dataUrl) {
    photo = dataUrl
    try { localStorage.setItem(PHOTO_KEY, dataUrl) } catch { /* quota / private window: keep for this page only */ }
    emit()
  },
  removePhoto() {
    photo = null
    try { localStorage.removeItem(PHOTO_KEY) } catch { /* ignore */ }
    emit()
  },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
}
export const useProfile = () => useSyncExternalStore(profile.subscribe, profile.get, profile.get)

/** Any picture → a centred square, 160 px, JPEG (~10 KB) before it is stored. */
export function cropFace(file, size = 160) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('not an image')); return }
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight)
      const sx = (img.naturalWidth - side) / 2, sy = (img.naturalHeight - side) / 2.6     // a little above centre: faces sit high
      const c = document.createElement('canvas'); c.width = c.height = size
      c.getContext('2d').drawImage(img, sx, Math.max(0, sy), side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('cannot read image')) }
    img.src = url
  })
}
