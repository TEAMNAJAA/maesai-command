/* ══════════════════════════════════════════════════════════════════════════
   CHIBI — ตัวละครผู้บัญชาการของผู้เล่น (SVG ล้วน)
   ทรงผม 5 · สีผม 6 · สีผิว 5 · ชุด 4 · หน้าการ์ตูนหรือรูปที่อัปโหลด (ครอปวงกลม)
   ท่าตามสิ่งที่ผู้เล่นทำ (B12): ส่องดินถล่ม (หมวกเหลือง) · ถือไม้บรรทัด · ชี้ดาวเทียม · โทรโข่ง ·
   แบกกระสอบ · เขียนแผนเรือ · รีโมตโดรน · ยกสวิตช์ · ดีใจ · ตกใจ · จริงจัง · นั่งหน้าจอ (แว่น)
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useId } from 'react'
import { OUTFITS } from '../lib/profile'

export const POSES = {
  idle: { arms: [12, -12], face: 'smile', say: 'พร้อมรับคำสั่ง' },
  inspect: { arms: [18, -128], face: 'focus', hat: 'helmet', prop: 'magnifier', say: 'ส่องหารอยดินถล่มใหม่…' },
  ruler: { arms: [-62, 62], face: 'focus', prop: 'ruler', say: 'วัดขอบน้ำถึงขอบน้ำ' },
  point: { arms: [14, -138], face: 'open', prop: 'satellite', say: 'THEOS-2 ผ่านแล้ว!' },
  megaphone: { arms: [18, -96], face: 'open', prop: 'megaphone', say: 'ประกาศอพยพ!' },
  carry: { arms: [10, -150], face: 'effort', prop: 'sandbag', layer: 'mid', say: 'อุดตลิ่งก่อนน้ำมา!' },
  clipboard: { arms: [-48, 44], face: 'focus', prop: 'clipboard', say: 'วางเส้นทางเรือ…' },
  remote: { arms: [-38, 38], face: 'smile', prop: 'remote', say: 'ปล่อยโดรน!' },
  switch: { arms: [16, -58], face: 'effort', prop: 'switch', say: 'ตัดไฟก่อน!' },
  pump: { arms: [-40, 40], face: 'effort', prop: 'pump', say: 'สูบน้ำเปิดทาง' },
  cheer: { arms: [150, -150], face: 'joy', prop: 'sparkle', say: 'เยี่ยมเลย!' },
  shock: { arms: [26, -168], face: 'shock', prop: 'sweat', say: 'แย่แล้ว…' },
  serious: { arms: [6, -6], face: 'serious', say: 'สถานการณ์วิกฤต' },
  monitor: { arms: [-46, 46], face: 'focus', hat: 'glasses', prop: 'monitor', say: 'ตรวจหลักฐานรายหลัง' },
}

const SH_L = [41, 92], SH_R = [79, 92], ARM = 25
const handAt = (sh, deg) => { const r = (deg * Math.PI) / 180; return [sh[0] - Math.sin(r) * ARM, sh[1] + Math.cos(r) * ARM] }

function Hair({ style, color, part }) {
  // part: 'back' (behind the head) or 'front'
  const dark = color
  if (part === 'back') {
    if (style === 'bob') return <path d="M27 52 Q26 84 40 88 L80 88 Q94 84 93 52 Z" fill={dark} />
    if (style === 'long') return <path d="M26 50 Q22 100 36 112 L84 112 Q98 100 94 50 Z" fill={dark} />
    if (style === 'pony') return <path d="M86 40 Q108 46 104 74 Q101 92 92 98 Q97 76 88 60 Z" fill={dark} />
    return null
  }
  if (style === 'spiky') return <path d="M28 52 L30 34 L38 40 L40 24 L49 34 L54 18 L61 32 L68 18 L72 34 L81 24 L83 40 L91 34 L92 52 Q88 40 76 40 Q60 30 44 40 Q32 40 28 52 Z" fill={dark} />
  if (style === 'pony') return <path d="M28 54 Q27 26 60 23 Q93 26 92 54 Q86 38 72 40 Q64 32 56 40 Q38 36 28 54 Z" fill={dark} />
  if (style === 'bob') return <path d="M27 56 Q26 24 60 22 Q94 24 93 56 Q90 40 78 38 L66 44 L56 38 L44 44 Q34 42 27 56 Z" fill={dark} />
  if (style === 'long') return <path d="M27 58 Q25 24 60 22 Q95 24 93 58 Q88 40 74 36 Q66 44 60 40 Q50 46 44 38 Q32 42 27 58 Z" fill={dark} />
  return <path d="M28 54 Q27 24 60 22 Q93 24 92 54 Q88 38 76 36 Q70 44 62 38 Q54 46 46 38 Q34 40 28 54 Z" fill={dark} />   // short
}

function Face({ kind }) {
  const eye = (x) => {
    if (kind === 'joy') return <path key={x} d={`M${x - 5} 60 Q${x} 54 ${x + 5} 60`} stroke="#1e1b2e" strokeWidth="2.6" fill="none" strokeLinecap="round" />
    if (kind === 'effort') return <path key={x} d={`M${x - 5} 56 L${x + 4} 59 L${x - 5} 62`} stroke="#1e1b2e" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" transform={x > 60 ? `scale(-1 1) translate(${-2 * x} 0)` : undefined} />
    const h = kind === 'shock' ? 9 : kind === 'focus' ? 6 : 8
    return (
      <g key={x}>
        <ellipse cx={x} cy={59} rx={kind === 'shock' ? 4.6 : 4.2} ry={h / 2 + 0.5} fill="#1e1b2e" />
        <circle cx={x + 1.4} cy={57} r={1.5} fill="#fff" />
        {kind === 'shock' && <circle cx={x - 1.3} cy={61} r={0.8} fill="#fff" />}
      </g>
    )
  }
  const brow = kind === 'serious' ? [<path key="l" d="M43 49 L54 52" stroke="#1e1b2e" strokeWidth="2.2" strokeLinecap="round" />, <path key="r" d="M77 49 L66 52" stroke="#1e1b2e" strokeWidth="2.2" strokeLinecap="round" />]
    : kind === 'shock' ? [<path key="l" d="M43 49 Q48 45 54 48" stroke="#1e1b2e" strokeWidth="1.8" fill="none" />, <path key="r" d="M66 48 Q72 45 77 49" stroke="#1e1b2e" strokeWidth="1.8" fill="none" />] : null
  const mouth = {
    smile: <path d="M54 69 Q60 74 66 69" stroke="#7a2e2e" strokeWidth="2.2" fill="none" strokeLinecap="round" />,
    open: <path d="M54 68 Q60 77 66 68 Z" fill="#7a2e2e" />,
    joy: <path d="M52 67 Q60 79 68 67 Z" fill="#7a2e2e" />,
    focus: <path d="M56 70 L64 70" stroke="#7a2e2e" strokeWidth="2" strokeLinecap="round" />,
    effort: <path d="M55 71 Q60 67 65 71" stroke="#7a2e2e" strokeWidth="2.2" fill="none" strokeLinecap="round" />,
    shock: <ellipse cx="60" cy="71" rx="3.2" ry="4" fill="#7a2e2e" />,
    serious: <path d="M55 71 L65 71" stroke="#7a2e2e" strokeWidth="2.4" strokeLinecap="round" />,
  }[kind] || null
  return (
    <g>
      {brow}
      {eye(49)}{eye(71)}
      <ellipse cx="42" cy="66" rx="4.5" ry="2.6" fill="#ff8fa3" opacity="0.55" />
      <ellipse cx="78" cy="66" rx="4.5" ry="2.6" fill="#ff8fa3" opacity="0.55" />
      {mouth}
    </g>
  )
}

function Arm({ sh, deg, sleeve, skin, anim }) {
  return (
    <g transform={`rotate(${deg} ${sh[0]} ${sh[1]})`} style={anim ? { animation: anim, transformOrigin: `${sh[0]}px ${sh[1]}px`, transformBox: 'view-box' } : undefined}>
      <rect x={sh[0] - 5.5} y={sh[1] - 3} width="11" height={ARM - 3} rx="5.5" fill={sleeve} />
      <circle cx={sh[0]} cy={sh[1] + ARM} r="5.6" fill={skin} />
    </g>
  )
}

function Prop({ kind, l, r, accent }) {
  switch (kind) {
    case 'magnifier': return (
      <g transform={`translate(${r[0]} ${r[1]})`}>
        <line x1="0" y1="0" x2="-7" y2="9" stroke="#3b2f22" strokeWidth="3.4" strokeLinecap="round" />
        <circle cx="5" cy="-6" r="8" fill="#bfe9ff" fillOpacity="0.45" stroke="#1e293b" strokeWidth="2.6" />
        <path d="M1 -9 Q4 -12 8 -10" stroke="#fff" strokeWidth="1.4" fill="none" />
      </g>
    )
    case 'ruler': {
      const cx = (l[0] + r[0]) / 2, cy = (l[1] + r[1]) / 2 - 2
      return (
        <g transform={`rotate(-5 ${cx} ${cy})`}>
          <rect x={cx - 30} y={cy - 4.5} width="60" height="9" rx="1.5" fill="#fcd34d" stroke="#92400e" strokeWidth="1.1" />
          {Array.from({ length: 13 }, (_, i) => <line key={i} x1={cx - 27 + i * 4.5} y1={cy - 4.5} x2={cx - 27 + i * 4.5} y2={cy - (i % 2 ? 1.5 : -0.5)} stroke="#92400e" strokeWidth="0.8" />)}
          <text x={cx} y={cy + 3.6} textAnchor="middle" fontSize="4.2" fontWeight="800" fill="#92400e">0.5 m/px</text>
        </g>
      )
    }
    case 'satellite': return (
      <g transform={`translate(${r[0] + 12} ${r[1] - 24})`} className="chibi-ping">
        <rect x="-4" y="-3" width="8" height="6" rx="1" fill="#e2e8f0" />
        <rect x="-15" y="-2" width="9" height="4" fill="#38bdf8" /><rect x="6" y="-2" width="9" height="4" fill="#38bdf8" />
        <circle cx="0" cy="0" r="12" fill="none" stroke="#7dd3fc" strokeWidth="1.2" className="chibi-ring" />
      </g>
    )
    case 'megaphone': return (
      <g transform={`translate(${r[0]} ${r[1]})`}>
        <path d="M0 -4 L18 -11 L18 11 L0 4 Z" fill="#f8fafc" stroke="#334155" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="-4" y="-4" width="5" height="8" rx="1.5" fill="#ef4444" />
        {[0, 1, 2].map((i) => <path key={i} d={`M${23 + i * 5} -8 Q${28 + i * 5} 0 ${23 + i * 5} 8`} stroke={accent} strokeWidth="1.8" fill="none" strokeLinecap="round" className="chibi-wave" style={{ animationDelay: `${i * 0.18}s` }} />)}
      </g>
    )
    case 'sandbag': return (
      <g className="chibi-lift" transform={`rotate(-14 ${r[0] + 8} ${r[1] + 8})`}>
        <rect x={r[0] - 8} y={r[1] - 2} width="36" height="19" rx="8" fill="#d6c19a" stroke="#8a7350" strokeWidth="1.6" />
        <path d={`M${r[0] - 3} ${r[1] + 4} Q${r[0] + 10} ${r[1] + 8} ${r[0] + 23} ${r[1] + 4} M${r[0] - 1} ${r[1] + 11} Q${r[0] + 10} ${r[1] + 14} ${r[0] + 21} ${r[1] + 11}`} stroke="#8a7350" strokeWidth="1" fill="none" opacity="0.7" />
        <text x={r[0] + 10} y={r[1] + 10.5} textAnchor="middle" fontSize="5.2" fontWeight="800" fill="#7c5b2f">BIG BAG</text>
      </g>
    )
    case 'clipboard': return (
      <g>
        <g transform={`translate(${l[0] + 4} ${l[1] - 18}) rotate(-8)`}>
          <rect x="0" y="0" width="22" height="28" rx="2.5" fill="#a16207" />
          <rect x="2.5" y="4" width="17" height="21" rx="1" fill="#f8fafc" />
          <rect x="7" y="-1.5" width="8" height="4" rx="1.2" fill="#64748b" />
          {[9, 13, 17, 21].map((y, i) => <line key={y} x1="5" y1={y} x2={i === 3 ? 12 : 17} y2={y} stroke="#94a3b8" strokeWidth="1.1" />)}
          <path d="M5 21 L9 23 L16 15" stroke="#22c55e" strokeWidth="1.6" fill="none" className="chibi-draw" />
        </g>
        <g transform={`translate(${r[0]} ${r[1]})`} className="chibi-write"><line x1="0" y1="0" x2="-7" y2="-11" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" /><line x1="-7" y1="-11" x2="-8.5" y2="-13.5" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" /></g>
      </g>
    )
    case 'remote': return (
      <g>
        <g transform={`translate(${(l[0] + r[0]) / 2} ${l[1] - 2})`}>
          <rect x="-11" y="-6" width="22" height="12" rx="3" fill="#1f2937" stroke="#64748b" strokeWidth="1" />
          <circle cx="-5" cy="0" r="2.4" fill="#475569" /><circle cx="5" cy="0" r="2.4" fill="#475569" />
          <line x1="8" y1="-6" x2="12" y2="-16" stroke="#94a3b8" strokeWidth="1.4" />
        </g>
        <g transform="translate(96 26)" className="chibi-hover">
          <rect x="-7" y="-2" width="14" height="5" rx="2" fill="#e2e8f0" />
          <line x1="-14" y1="-4" x2="-4" y2="-4" stroke="#94a3b8" strokeWidth="1.6" className="chibi-prop" /><line x1="4" y1="-4" x2="14" y2="-4" stroke="#94a3b8" strokeWidth="1.6" className="chibi-prop" />
          <circle cx="0" cy="3.5" r="1.3" fill="#22e36b" className="chibi-blink" />
        </g>
      </g>
    )
    case 'switch': return (
      <g transform={`translate(${r[0] + 4} ${r[1] + 4})`}>
        <rect x="-8" y="-2" width="16" height="22" rx="2" fill="#475569" stroke="#1e293b" strokeWidth="1.2" />
        <text x="0" y="16" textAnchor="middle" fontSize="7" fill="#fde047">⚡</text>
        <g className="chibi-flip" style={{ transformOrigin: '0px 4px', transformBox: 'view-box' }}><rect x="-2" y="-12" width="4" height="16" rx="2" fill="#ef4444" /></g>
      </g>
    )
    case 'pump': return (
      <g transform="translate(60 120)">
        <rect x="-22" y="-12" width="44" height="18" rx="4" fill="#0ea5e9" stroke="#075985" strokeWidth="1.4" />
        <circle cx="-10" cy="-3" r="5" fill="#082f49" className="chibi-spin" style={{ transformOrigin: '-10px -3px', transformBox: 'view-box' }} />
        <path d="M22 -6 Q36 -6 36 6" stroke="#38bdf8" strokeWidth="4" fill="none" />
      </g>
    )
    case 'monitor': return (
      <g>
        <rect x="24" y="106" width="72" height="40" rx="4" fill="#0b1220" stroke="#38bdf8" strokeWidth="1.6" />
        <rect x="28" y="110" width="64" height="30" rx="2" fill="#0f2b46" className="chibi-screen" />
        <path d="M32 132 L42 124 L52 128 L64 118 L76 122 L88 114" stroke="#22e36b" strokeWidth="1.6" fill="none" />
        <rect x="18" y="144" width="84" height="4" rx="2" fill="#334155" />
      </g>
    )
    case 'sparkle': return (
      <g className="chibi-twinkle">
        {[[18, 22], [104, 18], [12, 70], [108, 64]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 6} L${x + 1.6} ${y - 1.6} L${x + 6} ${y} L${x + 1.6} ${y + 1.6} L${x} ${y + 6} L${x - 1.6} ${y + 1.6} L${x - 6} ${y} L${x - 1.6} ${y - 1.6} Z`} fill="#fde047" style={{ animationDelay: `${i * 0.2}s` }} />)}
      </g>
    )
    case 'sweat': return (
      <g>
        <path d="M92 36 Q96 44 92 47 Q88 44 92 36 Z" fill="#7dd3fc" className="chibi-drip" />
        <text x="100" y="30" fontSize="16" fontWeight="900" fill="#ff5c7a">!</text>
      </g>
    )
    default: return null
  }
}

/**
 * The player's chibi.
 *  profile — { hair, hairColor, skin, outfit, photo }
 *  pose    — key of POSES
 */
export function Chibi({ profile, pose = 'idle', size = 96, className = '', still = false }) {
  const uid = useId().replace(/:/g, '')
  const P = POSES[pose] || POSES.idle
  const o = OUTFITS.find((x) => x.id === profile.outfit) || OUTFITS[0]
  const [la, ra] = P.arms
  const l = handAt(SH_L, la), r = handAt(SH_R, ra)
  const sleeve = o.id === 'eoc' ? o.under : o.main
  const write = pose === 'clipboard' ? 'chibiWrite 0.5s ease-in-out infinite alternate' : null
  const behind = P.layer === 'back'
  return (
    <svg viewBox="0 0 120 150" width={size} height={size * 1.25} className={`overflow-visible ${className}`} data-chibi={pose} aria-label={P.say}>
      <defs>
        <clipPath id={`${uid}-face`}><circle cx="60" cy="56" r="27.5" /></clipPath>
        <radialGradient id={`${uid}-cheek`} cx="0.5" cy="0.35" r="0.7"><stop offset="0" stopColor="#fff" stopOpacity="0.22" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <ellipse cx="60" cy="146" rx="27" ry="4" fill="#000" opacity="0.35" />
      <g className={still ? '' : pose === 'cheer' ? 'chibi-jump' : pose === 'serious' ? '' : 'chibi-bob'}>
        {behind && <Prop kind={P.prop} l={l} r={r} accent={o.trim} />}
        {/* legs + shoes */}
        <rect x="47" y="118" width="11" height="22" rx="4" fill="#1f2a44" />
        <rect x="62" y="118" width="11" height="22" rx="4" fill="#1f2a44" />
        <ellipse cx="52" cy="141" rx="8" ry="4" fill="#0f172a" /><ellipse cx="68" cy="141" rx="8" ry="4" fill="#0f172a" />
        <Hair style={profile.hair} color={profile.hairColor} part="back" />
        {/* body by outfit */}
        <path d="M41 86 Q60 80 79 86 L84 120 Q60 126 36 120 Z" fill={o.id === 'eoc' ? o.under : o.main} />
        {o.id === 'eoc' && <>
          <path d="M41 87 L52 86 L50 121 L37 119 Z M79 87 L68 86 L70 121 L83 119 Z" fill={o.main} />
          <rect x="37" y="103" width="14" height="3.4" fill={o.trim} /><rect x="69" y="103" width="14" height="3.4" fill={o.trim} />
          <rect x="37" y="111" width="14" height="3.4" fill={o.trim} /><rect x="69" y="111" width="14" height="3.4" fill={o.trim} />
          <text x="60" y="100" textAnchor="middle" fontSize="6.5" fontWeight="900" fill="#e2e8f0">EOC</text>
        </>}
        {o.id === 'rescue' && <>
          <line x1="60" y1="86" x2="60" y2="122" stroke="#7f1d1d" strokeWidth="1.4" />
          <rect x="64" y="94" width="11" height="11" rx="2" fill={o.trim} /><path d="M69.5 96 L69.5 103 M66 99.5 L73 99.5" stroke="#dc2626" strokeWidth="2.4" />
          <rect x="37" y="112" width="47" height="3" fill={o.trim} opacity="0.85" />
        </>}
        {o.id === 'gistda' && <>
          <path d="M52 84 L60 92 L68 84" stroke={o.trim} strokeWidth="2.4" fill="none" />
          <circle cx="70" cy="99" r="4" fill="none" stroke={o.trim} strokeWidth="1.2" /><path d="M66 103 L74 95" stroke={o.trim} strokeWidth="1.2" />
          <text x="49" y="112" textAnchor="middle" fontSize="4.6" fontWeight="800" fill={o.trim}>GISTDA</text>
        </>}
        {o.id === 'rain' && <>
          <path d="M44 86 Q60 96 76 86" stroke={o.trim} strokeWidth="2" fill="none" />
          <circle cx="60" cy="100" r="1.6" fill={o.trim} /><circle cx="60" cy="108" r="1.6" fill={o.trim} /><circle cx="60" cy="116" r="1.6" fill={o.trim} />
        </>}
        {P.layer === 'mid' && <Prop kind={P.prop} l={l} r={r} accent={o.trim} />}
        <Arm sh={SH_L} deg={la} sleeve={sleeve} skin={profile.skin} />
        <Arm sh={SH_R} deg={ra} sleeve={sleeve} skin={profile.skin} anim={write} />
        {/* head */}
        <rect x="55" y="78" width="10" height="8" rx="3" fill={profile.skin} />
        <circle cx="29" cy="60" r="5" fill={profile.skin} /><circle cx="91" cy="60" r="5" fill={profile.skin} />
        <circle cx="60" cy="55" r="31" fill={profile.skin} />
        <circle cx="60" cy="55" r="31" fill={`url(#${uid}-cheek)`} />
        {profile.photo
          ? <image href={profile.photo} x="32.5" y="28.5" width="55" height="55" clipPath={`url(#${uid}-face)`} preserveAspectRatio="xMidYMid slice" />
          : <Face kind={P.face} />}
        {profile.photo && <circle cx="60" cy="56" r="27.5" fill="none" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.4" />}
        {P.hat === 'helmet'
          ? <g><path d="M27 46 Q28 18 60 16 Q92 18 93 46 Z" fill="#facc15" stroke="#a16207" strokeWidth="1.4" /><rect x="22" y="43" width="76" height="6" rx="3" fill="#eab308" stroke="#a16207" strokeWidth="1.2" /><rect x="56" y="17" width="8" height="26" rx="3" fill="#fde047" opacity="0.8" /></g>
          : <g style={profile.photo ? { opacity: 0.95 } : undefined}><Hair style={profile.hair} color={profile.hairColor} part="front" /></g>}
        {P.hat === 'glasses' && <g stroke="#0f172a" strokeWidth="1.8" fill="#bae6fd" fillOpacity="0.18"><rect x="40" y="52" width="16" height="12" rx="4" /><rect x="64" y="52" width="16" height="12" rx="4" /><line x1="56" y1="57" x2="64" y2="57" /></g>}
        {!behind && P.layer !== 'mid' && <Prop kind={P.prop} l={l} r={r} accent={o.trim} />}
      </g>
    </svg>
  )
}
