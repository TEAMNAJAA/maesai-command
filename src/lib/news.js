/* ══════════════════════════════════════════════════════════════════════════
   NEWS FEED (D2) — พาดหัวข่าว / โพสต์โซเชียลจำลอง ที่เปลี่ยนตามการตัดสินใจ
   newsFor(prev, next, scn) ฟังก์ชันล้วน: อ่านผลต่างของ state จริงเท่านั้น (ไม่รู้อนาคต ไม่เผยจุดที่ยังไม่พบ)
   น้ำเสียงให้เกียรติผู้ประสบภัย — ไม่ใช้คำหวือหวากับความสูญเสีย
   ══════════════════════════════════════════════════════════════════════════ */

import { SECTION_BY_ID } from './sections'
import { EMBANKMENT_GAPS } from './embankment'

const zoneName = (id) => SECTION_BY_ID[id]?.name || id
const OUTLETS = ['ข่าวเชียงรายวันนี้', 'สถานีข่าวภาคเหนือ', 'NBT เชียงราย', 'ไทยรัฐออนไลน์ (จำลอง)']
const pick = (arr, k) => arr[Math.abs(k) % arr.length]

/** Headlines (kind 'news') and social posts (kind 'social') one state change produces. */
export function newsFor(p, s, scn) {
  if (!p || !s || p === s) return []
  const out = []
  const t = s.clock
  const news = (id, th, tone = 'info') => out.push({ id: `${id}@${t}`, kind: 'news', th, tone, outlet: pick(OUTLETS, id.length + Math.round(t / 60)), at: t })
  const post = (id, th, tone = 'info', likes = 0) => out.push({ id: `${id}@${t}`, kind: 'social', th, tone, likes, at: t })

  if (p.act !== s.act) {
    if (s.act === 2) news('act2', 'มวลน้ำเข้าตัวเมืองแม่สาย — ศูนย์ EOC เร่งค้นหาผู้ติดค้าง', 'warn')
    if (s.act === 3) news('act3', 'น้ำเริ่มลด ชาวแม่สายกลับเข้าบ้าน เริ่มสำรวจความเสียหายเพื่อขอเงินเยียวยา')
    return out
  }

  // act 1 — warnings, the embankment, trust
  const newDec = (s.decisions || []).slice((p.decisions || []).length)
  for (const d of newDec) {
    if (d.kind !== 'EVACUATE') continue
    if (d.outcome === 'false-alarm') {
      news(`false${newDec.length}`, `EOC แม่สายประกาศอพยพ ${d.communities.join(', ')} ทั้งที่น้ำยังไม่มา — ชาวบ้านเริ่มไม่เชื่อ`, 'bad')
      post(`falsepost${d.communities[0]}`, `ขนของหนีมารอบนี้ไม่มีน้ำเลย รอบหน้าไม่ออกแล้วนะ 😤 #แม่สาย`, 'bad', 214)
    } else {
      news(`evac${d.communities.join('')}`, `EOC สั่งอพยพ ${d.communities.map(zoneName).join(' · ')} — ชาวบ้านทยอยขนของขึ้นที่สูง`, 'good')
    }
  }
  const allGaps = EMBANKMENT_GAPS.length
  if (p.sealed.length < allGaps && s.sealed.length === allGaps && !(s.sandbagged || []).length) news('sealed', `ทีมบิ๊กแบ็กอุดฟันหลอตลิ่งแม่น้ำสายครบ ${allGaps} จุด`, 'good')
  if (s.sealPlan === 'none' && p.sealPlan !== 'none') post('noseal', 'ไม่อุดตลิ่งจริงดิ? หวังว่าอพยพทันนะ 🙏 #แม่สาย', 'warn', 88)
  if ((s.logs || []).some((l) => l.tag === 'SANDBAG') && !(p.logs || []).some((l) => l.tag === 'SANDBAG')) news('sandbag', 'กระสอบทรายริมน้ำสายพัง น้ำทะลักเข้าชุมชนหลังตลิ่ง', 'bad')
  if (s.boss?.done && !p.boss?.done) news('boss', s.boss.won ? 'แนวตลิ่งแม่สายรับยอดน้ำคืนวิกฤตไว้ได้' : `ตลิ่งแตกคืนวิกฤต — น้ำทะลักเข้า${zoneName(s.breach?.zone)}`, s.boss.won ? 'good' : 'bad')
  // public mood follows trust
  const band = (x) => (x >= 75 ? 'hi' : x >= 50 ? 'mid' : 'lo')
  if (band(s.trust) !== band(p.trust)) {
    if (band(s.trust) === 'lo') post('trustlo', 'ประกาศ EOC ช่วงนี้เชื่อได้แค่ไหน? หลายบ้านบอกจะรอดูก่อน #น้ำท่วมแม่สาย', 'bad', 530)
    if (band(s.trust) === 'hi' && band(p.trust) !== 'hi') post('trusthi', 'ขอบคุณ EOC แม่สาย เตือนแม่นมาก ออกทันทุกบ้าน 🙏 #แม่สายไม่ทิ้งกัน', 'good', 1240)
  }

  // act 2 — rescues, accidents, power, loss (respectfully)
  for (const q of s.points || []) {
    const o = (p.points || []).find((x) => x.id === q.id)
    if (!o) continue
    const safe = (q.rescued || 0) - (o.rescued || 0)
    if (safe > 0) news(`resc${q.id}`, `เรือกู้ภัยพา ${safe} ชีวิตออกจาก${zoneName(q.section)}ได้อย่างปลอดภัย`, 'good')
    if (q.status === 'supplied' && o.status !== 'supplied') post(`sup${q.id}`, `ถุงยังชีพมาถึงแล้ว ขอบคุณทีมเรือ 🚤 #${zoneName(q.section).replace(/\s/g, '')}`, 'good', 96)
    if (q.status === 'lost' && o.status !== 'lost' && q.revealed) news(`lost${q.id}`, `รายงานความสูญเสียใน${zoneName(q.section)} — EOC ทบทวนการเข้าถึงพื้นที่`, 'bad')
  }
  for (const x of (s.incidents || []).slice((p.incidents || []).length)) {
    if (x.kind === 'shock') news(`shock${x.boat}`, 'เรือกู้ภัยโดนไฟฟ้ารั่วกลางน้ำ ลูกเรือ 2 นายส่งโรงพยาบาล — ย้ำตัดไฟก่อนเข้าพื้นที่', 'bad')
    else news(`cap${x.boat}`, 'เรือกู้ภัยล่มกลางกระแสน้ำเชี่ยว ลูกเรือปลอดภัย — เรือต้องเข้าซ่อม', 'bad')
  }
  const cut = Object.keys(s.powerCut || {}).filter((id) => !(p.powerCut || {})[id])
  for (const id of cut) post(`cut${id}`, `ไฟดับทั้ง${zoneName(id)} แต่เข้าใจ ปลอดภัยไว้ก่อน 🕯️`, 'info', 41)
  if (s.stormHit && !p.stormHit) news('storm', 'พายุซ้ำ สัญญาณมือถือล่มบางโซน — ญาติติดต่อผู้ติดค้างไม่ได้', 'warn')

  // act 3 — relief
  const lockedNow = Object.keys(s.locked || {}).length, lockedBefore = Object.keys(p.locked || {}).length
  if (lockedBefore === 0 && lockedNow > 0) news('relief', 'เริ่มพิจารณาเงินเยียวยาตามมติ ครม. — เหมาจ่าย 9,000 บาท + ค่าล้างโคลน 10,000 บาท', 'info')
  return out
}
