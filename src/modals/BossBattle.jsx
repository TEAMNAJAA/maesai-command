/* ══════════════════════════════════════════════════════════════════════════
   BOSS BATTLE (E + D4) — คืนวิกฤต T0: มวลน้ำ ปะทะผู้บัญชาการ
   ตรรกะทั้งหมดอยู่ใน engine/boss.js (ฟังก์ชันล้วน) — หน้านี้แค่เลือกการ์ด แสดงผล และแอนิเมชัน
   • มวลน้ำเป็นกำแพงน้ำที่น่าเกรงขาม ไม่มีหน้าตาตัวการ์ตูน (เคารพผู้ประสบภัย) · ไม่มีใครตายบนจอ
   • คืนวิกฤต (D4): แสงแดงเรือง ฝนหนัก ฟ้าแลบถี่ เพลงระดับสูงสุด chibi หน้าจริงจัง
   • data-*: data-boss · data-boss-card · data-boss-end · data-boss-busy · data-boss-result · data-boss-continue
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Building2, Package, Fan, Zap, Megaphone, Ship, Satellite, Swords, Users, Wallet, HeartHandshake, Eye, EyeOff, Waves, ChevronRight, ShieldCheck, ShieldAlert, MousePointerClick } from 'lucide-react'
import { Chibi } from '../ui/chibi'
import { useProfile } from '../lib/profile'
import { WhyButton } from '../ui/impact'
import { VERDICT } from '../ui/decision'
import { audio } from '../lib/audio'
import { fx } from '../lib/fx'
import { BOSS } from '../config/missionConfig'
import { BOSS_CARDS } from '../config/scenarioData'
import { bossSetup, bossIntent, bossTurn, cardBlock, bossBest } from '../engine/boss'
import { fmt } from '../lib/format'

const SPEED = typeof window !== 'undefined' ? Math.max(0.2, Number(new URLSearchParams(window.location.search).get('speed')) || 1) : 1
const ICON = { base: Building2, bigbag: Package, pump: Fan, power: Zap, evac: Megaphone, boat: Ship, theos: Satellite }
const POSE = { base: 'clipboard', bigbag: 'carry', pump: 'pump', power: 'switch', evac: 'megaphone', boat: 'clipboard', theos: 'point' }
const ORDER = ['base', 'bigbag', 'pump', 'power', 'evac', 'boat', 'theos']
const turnClock = (turn) => { const a = (turn - 1) * 30, b = turn * 30; const f = (m) => `T+${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; return `${f(a)} → ${f(b)}` }

/** The water mass: layered dark wave, foam crest, debris — imposing, faceless. Grows with its pressure. */
function WaterMass({ hp, max, hit, strike }) {
  const k = 0.55 + 0.45 * (hp / Math.max(1, max))
  return (
    <svg viewBox="0 0 520 440" className="h-full w-full overflow-visible" data-boss-mass>
      <defs>
        <linearGradient id="bm-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1b4e6d" /><stop offset="0.55" stopColor="#0d2f46" /><stop offset="1" stopColor="#06182a" /></linearGradient>
        <linearGradient id="bm-mud" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#4a3a24" stopOpacity="0.85" /><stop offset="1" stopColor="#2c2316" stopOpacity="0.4" /></linearGradient>
        <radialGradient id="bm-glow" cx="50%" cy="80%" r="60%"><stop offset="0" stopColor="#ff2a4f" stopOpacity="0.35" /><stop offset="1" stopColor="#ff2a4f" stopOpacity="0" /></radialGradient>
        <filter id="bm-soft"><feGaussianBlur stdDeviation="6" /></filter>
      </defs>
      <ellipse cx="260" cy="420" rx="250" ry="30" fill="url(#bm-glow)" />
      <g style={{ transformOrigin: '260px 430px', transform: `scale(${k}) ${strike ? 'translateX(-70px) skewX(-6deg)' : ''}`, transition: 'transform .45s cubic-bezier(.3,1.4,.5,1)' }}>
        <g className="boss-swell" style={{ transformOrigin: '260px 430px' }}>
          {/* a breaking wall of water: rises from the river on the right, curls over toward the town */}
          <path d="M520 440 L520 120 C 480 58, 380 18, 280 38 C 196 54, 128 100, 94 170 C 74 212, 86 252, 122 256 C 152 259, 166 230, 160 206 C 157 190, 172 179, 189 186 C 216 197, 228 242, 216 292 C 204 342, 160 384, 108 440 Z" fill="url(#bm-body)" />
          {/* the hollow under the lip */}
          <path d="M122 256 C 152 259, 166 230, 160 206 C 157 190, 172 179, 189 186 C 175 200, 178 236, 160 262 C 148 278, 130 274, 122 256 Z" fill="#061524" opacity="0.9" />
          {/* lighter face of the wave */}
          <path d="M300 60 C 230 80, 190 130, 200 190 C 230 230, 250 300, 230 360 C 300 330, 380 300, 460 300 C 480 220, 450 120, 380 70 C 350 55, 320 55, 300 60 Z" fill="#2a6b8f" opacity="0.55" />
          <path d="M505 118 C 465 62, 380 30, 282 46 C 202 60, 138 104, 104 166 C 92 190, 92 222, 112 240" fill="none" stroke="#e0f2fe" strokeWidth="8" strokeLinecap="round" strokeDasharray="26 10 6 12" className="boss-foam" />
          <path d="M112 240 C 126 252, 146 246, 150 226" fill="none" stroke="#e0f2fe" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
          {/* mud in the water (the upstream landslides) */}
          <path d="M70 330 C 160 300, 300 320, 495 290 L 500 430 L 45 430 Z" fill="url(#bm-mud)" />
          {/* streaks of current */}
          {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${90 + i * 70} ${380 - i * 30} q 40 -30 90 -20`} stroke="#bae6fd" strokeOpacity="0.35" strokeWidth="2.4" fill="none" className="boss-streak" style={{ animationDelay: `${i * 0.23}s` }} />)}
          {/* debris carried along: logs, a roof sheet, a tyre */}
          <g className="boss-debris">
            <rect x="180" y="250" width="70" height="11" rx="5" fill="#5b4126" transform="rotate(-18 215 255)" />
            <rect x="330" y="220" width="54" height="9" rx="4" fill="#4a3520" transform="rotate(24 357 224)" />
            <path d="M260 300 l46 -10 l6 22 l-46 10 z" fill="#64748b" opacity="0.85" />
            <circle cx="410" cy="320" r="13" fill="none" stroke="#111827" strokeWidth="7" />
          </g>
          {/* spray */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <circle key={i} cx={130 + i * 50} cy={70 + (i % 3) * 18} r={10 + (i % 2) * 6} fill="#e0f2fe" opacity="0.25" filter="url(#bm-soft)" className="boss-spray" style={{ animationDelay: `${i * 0.3}s` }} />)}
        </g>
      </g>
      {hit && <rect x="0" y="0" width="520" height="440" fill="#fff" opacity="0.25" className="boss-hitflash" />}
    </svg>
  )
}

function Bar({ value, max, hex, label, icon: Icon, data }) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100))
  return (
    <div {...data}>
      <div className="flex items-baseline justify-between">
        <span className="font-thai flex items-center gap-1.5 text-[13px] font-bold text-slate-200"><Icon size={14} style={{ color: hex }} />{label}</span>
        <span className="num text-[15px] font-bold" style={{ color: hex }}>{Math.round(value)}<span className="text-[11px] text-slate-500"> / {max}</span></span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full border border-white/10 bg-black/50">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${hex}88, ${hex})`, boxShadow: `0 0 12px ${hex}` }} />
      </div>
    </div>
  )
}

function Card({ id, count, block, onClick, onRemove }) {
  const C = BOSS.cards[id], T = BOSS_CARDS[id], Icon = ICON[id]
  const on = count > 0
  return (
    <div className="relative" data-boss-card-wrap={id}>
      <button type="button" onClick={onClick} disabled={!!block && !on} data-boss-card={id} data-picked={count} title={block || T.short}
        className={`group relative flex h-full w-full flex-col items-center rounded-xl border-2 px-2 pb-2 pt-2.5 text-center transition duration-150 ${on ? '-translate-y-2 border-[#FFD066] bg-[#FFD066]/15 shadow-[0_10px_30px_-8px_rgba(255,208,102,.8)]' : block ? 'cursor-not-allowed border-white/10 bg-white/[0.03] opacity-45' : 'border-sky-400/35 bg-[#0a1a30] hover:-translate-y-1 hover:border-sky-300'}`}>
        <span className="absolute left-1.5 top-1.5 flex gap-0.5">{Array.from({ length: C.energy }, (_, i) => <span key={i} className="h-2.5 w-2.5 rounded-full bg-[#FFD066] shadow-[0_0_6px_#FFD066]" />)}{C.energy === 0 && <span className="font-thai text-[9.5px] text-slate-400">ฟรี</span>}</span>
        <Icon className="mt-3 text-sky-200" size={30} />
        <span className="font-thai mt-1.5 text-[13px] font-bold leading-tight text-white">{T.th}</span>
        <span className="font-thai mt-1 text-[10.5px] leading-snug text-slate-300">{T.short}</span>
        <span className="num mt-auto pt-1 text-[11px] text-[#FFE0A3]">{C.baht ? `฿${fmt(C.baht / 1000)}k` : '฿0'}</span>
        {block && !on && <span className="font-thai absolute inset-x-1 bottom-1 rounded bg-black/80 px-1 py-0.5 text-[10px] text-[#FF9DB2]">{block}</span>}
        {count > 1 && <span className="num absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-[#FFD066] text-[12px] font-bold text-black">×{count}</span>}
      </button>
      <span className="absolute right-1 top-1"><WhyButton id={`boss_${id}`} size={12} /></span>
      {on && <button type="button" onClick={onRemove} className="font-thai absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1.5 text-[10.5px] text-slate-400 hover:text-white" data-boss-unpick={id}>เอาออก</button>}
    </div>
  )
}

export function BossBattle({ eng, player = '', onFinish }) {
  const me = useProfile()
  const init = useMemo(() => bossSetup(eng.s, eng.scn), []) // eslint-disable-line react-hooks/exhaustive-deps
  const [b, setB] = useState(init)
  const [picks, setPicks] = useState([])
  const [phase, setPhase] = useState('intro')            // intro → pick → resolve → (pick | end)
  const [fxState, setFx] = useState({})                  // hit / strike / last result for the animation
  const [flash, setFlash] = useState(0)
  const ref = useRef(b)
  ref.current = b
  const intent = bossIntent(b)
  const cap = b.me.energy + (picks.includes('base') ? BOSS.cards.base.gain : 0)
  const used = picks.reduce((a, x) => a + BOSS.cards[x].energy, 0)
  const cost = picks.reduce((a, x) => a + BOSS.cards[x].baht, 0)

  // D4 crisis night: peak music, the boss theme, frequent lightning with thunder
  useEffect(() => {
    audio.setIntensity(3); audio.play('boss')
    const t = setTimeout(() => setPhase('pick'), 1600 / SPEED)
    let lt
    const strike = () => { lt = setTimeout(() => { setFlash((x) => x + 1); setTimeout(() => audio.play('thunder'), 200 + Math.random() * 700); strike() }, 2500 + Math.random() * 3500) }
    strike()
    return () => { clearTimeout(t); clearTimeout(lt) }
  }, [])
  // the demo bot reads the best play from here (?rec only)
  useEffect(() => {
    if (window.__maesai) window.__maesai.bossBest = () => (ref.current.status === 'fight' ? bossBest(ref.current) : [])
    return () => { if (window.__maesai) delete window.__maesai.bossBest }
  }, [])

  const pose = phase === 'end' ? (b.status === 'won' ? 'cheer' : 'serious')
    : fxState.strike ? 'shock' : picks.length ? POSE[picks[picks.length - 1]] : 'serious'

  const pick = (id) => { if (phase !== 'pick') return; if (!cardBlock(b, picks, id)) { setPicks((p) => [...p, id]); audio.play('click') } }
  const unpick = (id) => setPicks((p) => { const i = p.lastIndexOf(id); return i < 0 ? p : [...p.slice(0, i), ...p.slice(i + 1)] })

  const endTurn = () => {
    if (phase !== 'pick') return
    const next = bossTurn(b, picks)
    const last = next.log[next.log.length - 1]
    setPhase('resolve')
    // 1) our measures hit the water
    if (last.bossDmg) { setFx({ hit: true }); audio.play('hit'); fx.emit('float', { text: `แรงดัน −${last.bossDmg}`, hex: '#7dd3fc', at: '[data-boss-mass]', big: true }) }
    setTimeout(() => {
      setB({ ...next, me: { ...next.me, villagers: b.me.villagers }, status: 'fight' })   // pressure drops first
      // 2) the water strikes (unless it was drained first)
      if (last.taken > 0 || last.move === 'rain') {
        setFx({ strike: true }); audio.play('splash'); fx.emit('shake', { strength: Math.min(2.2, 0.6 + last.taken / 16) })
        if (last.taken) fx.emit('float', { text: `ชาวบ้าน −${last.taken}`, hex: '#FF6B8A', at: '[data-boss-villagers]', big: true })
      } else setFx({})
      if (last.heal) setTimeout(() => fx.emit('float', { text: `+${last.heal} อพยพเพิ่ม`, hex: '#7CFFA0', at: '[data-boss-villagers]' }), 250)
      setTimeout(() => {
        setFx({ last })
        setB(next); setPicks([])
        if (next.status === 'fight') setPhase('pick')
        else { setPhase('end'); audio.play(next.status === 'won' ? 'win' : 'alarm') }
      }, 900 / SPEED)
    }, 700 / SPEED)
  }
  // Enter = end the turn (Space stays off — no confirming by accident)
  useEffect(() => {
    const h = (e) => { if (e.key === 'Enter' && phase === 'pick') { e.preventDefault(); endTurn() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const last = fxState.last
  return (
    <div className="fixed inset-0 z-[85] overflow-hidden bg-[#03060d]" data-boss data-boss-busy={phase === 'pick' || phase === 'end' ? 0 : 1} data-boss-turn={b.turn} data-boss-phase={phase}>
      {/* night sky, red glow, rain, lightning */}
      <div className="absolute inset-0 bg-[radial-gradient(110%_80%_at_70%_20%,#13253f,#03060d_70%)]" />
      <div className="boss-redglow absolute inset-0" />
      <div className="fx-heavy rain-layer rain-far" style={{ opacity: 0.85, animationDuration: '.42s' }} />
      <div className="fx-heavy rain-layer rain-near" style={{ opacity: 0.7, animationDuration: '.3s' }} />
      {flash > 0 && <div key={flash} className="fx-heavy pointer-events-none absolute inset-0" style={{ animation: 'lightning .7s ease-out forwards', background: 'radial-gradient(90% 70% at 70% 0%, rgba(226,240,255,.7), transparent 75%)' }} />}

      <div className="relative flex h-full flex-col px-[max(16px,2.2vw)] py-[max(12px,1.8vh)]">
        {/* header */}
        <div className="flex items-center gap-3">
          <span className="hud-label !text-[11px] text-[#FF9DB2]">CRISIS NIGHT · คืนวิกฤต T0</span>
          <span className="font-thai text-[clamp(18px,1.6vw,26px)] font-bold text-white">ยอดน้ำเข้าเมือง — รับมือ "มวลน้ำ" {b.turns} ตา</span>
          <WhyButton id="boss" size={15} />
          <span className="font-thai ml-auto rounded-lg border border-white/15 bg-black/40 px-3 py-1 text-[14px] text-slate-200" data-boss-turnlabel>ตาที่ <b className="num text-white">{Math.min(b.turn, b.turns)}</b>/{b.turns} · <span className="num">{turnClock(Math.min(b.turn, b.turns))}</span></span>
        </div>

        {/* arena */}
        <div className="mt-2 grid min-h-0 flex-1 grid-cols-[minmax(260px,30%)_1fr_minmax(300px,36%)] gap-4">
          {/* the commander */}
          <div className="flex min-h-0 flex-col justify-end gap-2.5 rounded-2xl border border-sky-400/25 bg-[#071225]/80 p-3">
            <div className="flex flex-1 items-end justify-center" data-boss-chibi={pose}><Chibi profile={me} pose={pose} size={Math.round(Math.min(190, (typeof window !== 'undefined' ? window.innerHeight : 900) * 0.2))} /></div>
            <div className="font-thai text-center text-[13px] font-bold text-sky-100">ผบ. {player || 'ศูนย์ EOC แม่สาย'}</div>
            <Bar value={b.me.villagers} max={b.me.villagersMax} hex="#22E36B" label="ชาวบ้านปลอดภัย" icon={Users} data={{ 'data-boss-villagers': '' }} />
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5"><div className="font-thai text-slate-400">พลังสั่งการ</div>
                <div className="mt-0.5 flex gap-1">{Array.from({ length: cap }, (_, i) => <span key={i} className={`h-3 w-3 rounded-full ${i < cap - used ? 'bg-[#FFD066] shadow-[0_0_8px_#FFD066]' : 'bg-white/10'}`} />)}</div></div>
              <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5"><div className="font-thai flex items-center gap-1 text-slate-400"><Wallet size={11} />งบคงเหลือ</div><div className="num font-bold text-[#FFD066]">฿{fmt((b.me.budget - b.me.spent - cost) / 1e6, 2)}M</div></div>
              <div className="col-span-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5"><div className="font-thai flex items-center gap-1 text-slate-400"><HeartHandshake size={11} />ความเชื่อมั่นประชาชน <span className="num ml-auto font-bold" style={{ color: b.me.trust >= 75 ? '#7CFFA0' : b.me.trust >= 50 ? '#FFD066' : '#FF6B8A' }}>{Math.round(b.me.trust)}%</span></div>
                <div className="font-thai text-[10.5px] text-slate-500">การ์ดประกาศอพยพได้ผล × ความเชื่อมั่น</div></div>
            </div>
          </div>

          {/* the clash */}
          <div className="flex min-h-0 flex-col items-center justify-center gap-3">
            {phase === 'intro' && <div className="font-thai animate-[riseIn_.4s_ease-out] text-center text-[clamp(22px,2.4vw,40px)] font-bold text-white" style={{ textShadow: '0 0 30px #ff2a4f' }}>มวลน้ำมาถึงแล้ว</div>}
            {last && phase !== 'intro' && (
              <div className="font-thai w-full max-w-[420px] rounded-xl border border-white/12 bg-black/55 px-3 py-2 text-center animate-[riseIn_.25s_ease-out]" data-boss-last>
                <div className="text-[12px] text-slate-400">ตาที่ {last.turn} · {last.moveTh}</div>
                <div className="mt-0.5 text-[14px] text-white">แรงดัน <b className="num text-sky-300">−{last.bossDmg}</b>{last.move === 'rain' && last.taken >= 0 ? <span className="text-[#FFB27A]"> (+{BOSS.moves.rain.heal} ฝน)</span> : null} · ชาวบ้าน <b className="num text-[#FF9DB2]">−{last.taken}</b>{last.heal ? <> <b className="num text-[#7CFFA0]">+{last.heal}</b></> : null}</div>
              </div>
            )}
            <Swords size={38} className="text-[#FF6B8A] opacity-70" />
          </div>

          {/* the water */}
          <div className="flex min-h-0 flex-col gap-2 rounded-2xl border border-[#FF3B63]/30 bg-[#12060c]/70 p-3">
            <Bar value={b.boss.hp} max={b.boss.max} hex="#38BDF8" label="แรงดันมวลน้ำ" icon={Waves} data={{ 'data-boss-hp': b.boss.hp }} />
            <div className="font-thai flex flex-wrap gap-x-3 text-[11.5px] text-slate-400">
              <span>แรงซัด <b className="num text-[#FF9DB2]">{b.boss.attack}</b> (ฟันหลอเปิด {b.boss.open}/{b.boss.nGaps})</span>
              {b.boss.damAvailable && <span className="text-[#FFB27A]">⚠ มีดินถล่มอุดลำน้ำที่ไม่รู้ตำแหน่ง</span>}
            </div>
            <div className="relative min-h-0 flex-1"><WaterMass hp={b.boss.hp} max={b.boss.max} hit={fxState.hit} strike={fxState.strike} /></div>
            {phase !== 'end' && intent && (
              <div className={`font-thai rounded-lg border px-3 py-2 ${intent.visible ? 'border-[#FF6B8A]/60 bg-[#FF003C]/12' : 'border-white/15 bg-black/40'}`} data-boss-intent={intent.visible ? intent.id : 'hidden'}>
                {intent.visible ? (
                  <div className="flex items-center gap-2"><Eye size={15} className="text-[#FF9DB2]" /><span className="text-[13.5px] font-bold text-white">ท่าถัดไป: {intent.th}</span><span className="num ml-auto text-[13px] font-bold text-[#FF9DB2]">⚔ {intent.dmg}</span></div>
                ) : (
                  <div className="flex items-center gap-2"><EyeOff size={15} className="text-slate-400" /><span className="text-[13px] text-slate-300">ท่าถัดไป: ??? — {eng.s.modeId === 'expert' ? 'Expert ต้องคาดการณ์เอง' : `หลักฐานไม่พอ (SFVI ${b.sfvi.toFixed(2)} < 0.62)`}</span></div>
                )}
                {intent.visible && <div className="mt-0.5 text-[11px] text-slate-400">{intent.desc}</div>}
              </div>
            )}
          </div>
        </div>

        {/* hand / result */}
        {phase !== 'end' ? (
          <div className="mt-3 flex items-stretch gap-3">
            <div className="grid flex-1 grid-cols-7 gap-2 pb-5" style={{ height: 'clamp(150px, 21vh, 210px)' }}>
              {ORDER.map((id) => <Card key={id} id={id} count={picks.filter((x) => x === id).length} block={cardBlock(b, picks, id)} onClick={() => pick(id)} onRemove={() => unpick(id)} />)}
            </div>
            <div className="flex w-[clamp(170px,14vw,230px)] flex-col justify-center gap-2 pb-5">
              <div className="font-thai text-center text-[12px] text-slate-400">ใช้พลัง {used}/{cap} · ฿{fmt(cost / 1000)}k</div>
              <button onClick={endTurn} disabled={phase !== 'pick'} data-boss-end
                className="btn flex items-center justify-center gap-2 border-[#FF6B8A]/70 bg-[#FF003C]/25 py-4 text-white hover:bg-[#FF003C]/40 shadow-[0_0_30px_-8px_#FF003C]">
                <span className="font-thai normal-case tracking-normal text-[17px] font-bold">{picks.length ? 'สั่งการ · จบตา' : 'ไม่สั่งการ · จบตา'}</span><ChevronRight size={18} />
              </button>
              <div className="font-thai text-center text-[10.5px] text-slate-500">Enter = จบตา · ⓘ บนการ์ด = เหตุผลของมาตรการ</div>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-4 rounded-2xl border-2 px-5 py-3 animate-[riseIn_.35s_ease-out]" data-boss-result={b.status}
            style={{ borderColor: b.status === 'won' ? '#22E36B' : '#FF6B8A', background: b.status === 'won' ? 'rgba(34,227,107,.1)' : 'rgba(255,0,60,.1)' }}>
            {b.status === 'won' ? <ShieldCheck size={40} className="text-[#7CFFA0]" /> : <ShieldAlert size={40} className="text-[#FF9DB2]" />}
            <div className="min-w-0 flex-1">
              <div className="font-thai text-[clamp(18px,1.7vw,26px)] font-bold text-white">{b.status === 'won' ? 'แนวตลิ่งรับมวลน้ำไว้ได้!' : 'ตลิ่งแตก — น้ำทะลักเข้าโซนที่เสี่ยงที่สุด'}</div>
              <div className="font-thai text-[13px] text-slate-300">
                {b.status === 'won' ? `ระบายแรงดันจนหมดใน ${b.log.length} ตา · ชาวบ้านปลอดภัย ${b.me.villagers}/100` : `โซนที่เสี่ยงที่สุดน้ำสูงขึ้น ${BOSS.breachM} ม. ตลอดองก์ 2 (มีผู้ติดค้างมากขึ้น) · เกมเล่นต่อได้`}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1.5" data-boss-turns>
                {b.log.map((x) => <span key={x.turn} className="font-thai rounded border px-1.5 py-0.5 text-[11px]" title={x.why} style={{ borderColor: `${VERDICT[x.verdict].hex}88`, color: VERDICT[x.verdict].hex }}>ตา {x.turn} · {x.moveTh} · {VERDICT[x.verdict].th}</span>)}
              </div>
            </div>
            <button onClick={() => onFinish(b)} data-boss-continue className="btn flex items-center gap-2 border-[#22E36B]/70 bg-[#22E36B]/20 px-6 py-3.5 text-white hover:bg-[#22E36B]/30">
              <span className="font-thai normal-case tracking-normal text-[16px] font-bold">ไปสรุปองก์ 1</span><ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
      {phase === 'resolve' && <div className="font-thai pointer-events-none absolute bottom-3 right-4 flex items-center gap-1 text-[11px] text-slate-500"><MousePointerClick size={12} />กำลังคำนวณผล…</div>}
    </div>
  )
}
