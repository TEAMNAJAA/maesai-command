/* ══════════════════════════════════════════════════════════════════════════
   COMMUNITY WATER INFORMATION — one page per data pack (area × hazard).
   Order follows the questions people ask: is my water safe → what do I do today → how much water
   do I need → what are the authorities doing and when → the measurements → impacts → Q&A →
   who to call → every source. All content comes from the pack; this file has no facts of its own.
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, XCircle, Phone, ExternalLink, Share2, ChevronDown, CircleHelp, Minus, Plus, Droplets, Clock3 } from 'lucide-react'
import { packById } from './packs'

/* ── language & formatting ─────────────────────────────────────────────── */
const T = (s, lang) => (s == null ? '' : typeof s === 'string' ? s : s[lang] ?? s.th ?? '')
const UI = {
  site: { th: 'ข้อมูลน้ำเพื่อชุมชน', en: 'Community water information' },
  updated: { th: 'ข้อมูล ณ', en: 'Updated' },
  latest: { th: 'ผลตรวจล่าสุด', en: 'Latest reading' },
  standard: { th: 'มาตรฐาน', en: 'Standard' },
  times: { th: 'สูงกว่ามาตรฐานประมาณ {n} เท่า', en: 'About {n}× the standard' },
  prelim: { th: 'ผลเบื้องต้น', en: 'Preliminary' },
  nav: { th: [['today', 'ทำอะไรวันนี้'], ['water', 'น้ำที่ต้องใช้'], ['actions', 'หน่วยงานทำอะไร'], ['readings', 'ผลตรวจ'], ['impacts', 'ผลกระทบ'], ['faq', 'ถาม-ตอบ'], ['call', 'โทรหาใคร'], ['sources', 'แหล่งข้อมูล']],
         en: [['today', 'What to do'], ['water', 'Water you need'], ['actions', 'What is being done'], ['readings', 'Readings'], ['impacts', 'Impacts'], ['faq', 'Q&A'], ['call', 'Who to call'], ['sources', 'Sources']] },
  todayH: { th: 'วันนี้ทำอะไรได้บ้าง', en: 'What to do today' },
  do: { th: 'ควรทำ', en: 'Do' }, dont: { th: 'อย่าทำ', en: "Don't" },
  waterH: { th: 'บ้านคุณต้องใช้น้ำสะอาดเท่าไร', en: 'How much clean water your household needs' },
  waterLead: { th: 'ใส่จำนวนคนในบ้านและจำนวนวัน เพื่อดูว่าต้องเตรียมน้ำที่ผ่านการตรวจแล้วเท่าไร และใช้เงินประมาณเท่าไร',
               en: 'Enter how many people and how many days to see how much tested water to prepare, and roughly what it costs.' },
  people: { th: 'คนในบ้าน', en: 'People' }, days: { th: 'จำนวนวัน', en: 'Days' },
  tap: { th: 'ประปาที่บ้านใช้อาบน้ำ-ล้างของได้ไหม', en: 'Can you use tap water for washing?' },
  tapYes: { th: 'ใช้ได้', en: 'Yes' }, tapNo: { th: 'ใช้ไม่ได้', en: 'No' },
  container: { th: 'ซื้อน้ำแบบ', en: 'Container' },
  price: { th: 'ราคาต่อ 1 ภาชนะ (บาท)', en: 'Price per container (baht)' },
  pricePh: { th: 'เช่น 15', en: 'e.g. 15' },
  drinkL: { th: 'ดื่ม', en: 'Drinking' }, cookL: { th: 'หุงต้ม', en: 'Cooking' }, hygL: { th: 'อาบ-ล้าง', en: 'Washing' },
  perDay: { th: 'ลิตร/วัน', en: 'L/day' },
  total: { th: 'ต้องเตรียมน้ำที่ผ่านการตรวจแล้ว', en: 'Tested water to prepare' },
  litres: { th: 'ลิตร', en: 'litres' }, about: { th: 'ประมาณ', en: 'about' },
  cost: { th: 'ค่าใช้จ่ายโดยประมาณ', en: 'Estimated cost' },
  costHint: { th: 'ใส่ราคาเพื่อคำนวณเงิน', en: 'Enter a price to see the cost' },
  waterNote: { th: 'ตัวเลขขั้นต่ำตามมาตรฐานสากล Sphere ช่วงอากาศร้อน คนทำงานหนัก หญิงตั้งครรภ์หรือให้นมบุตร อาจต้องใช้มากกว่านี้',
               en: 'Minimums from the international Sphere standard. Hot weather, heavy work, pregnancy or breastfeeding need more.' },
  actionsH: { th: 'หน่วยงานกำลังทำอะไร และนานแค่ไหน', en: 'What the authorities are doing, and for how long' },
  noDate: { th: 'ไม่ระบุวัน', en: 'No date given' },
  st: { done: { th: 'ทำแล้ว', en: 'Done' }, ongoing: { th: 'กำลังทำ', en: 'Ongoing' }, announced: { th: 'ประกาศแล้ว', en: 'Announced' },
        planned: { th: 'เป็นแผน', en: 'Planned' }, unconfirmed: { th: 'ยังไม่ยืนยันว่าเสร็จ', en: 'Completion not confirmed' } },
  unknownH: { th: 'สิ่งที่ยังไม่มีใครประกาศ', en: 'Not announced yet' },
  readingsH: { th: 'ผลตรวจสารหนูในน้ำแม่น้ำ', en: 'Arsenic measured in the river' },
  where: { th: 'จุดตรวจ', en: 'Where' }, when: { th: 'วันที่', en: 'Date' }, value: { th: 'ค่าที่วัดได้', en: 'Measured' },
  over: { th: 'เกินมาตรฐาน', en: 'Above standard' }, under: { th: 'ไม่เกิน', en: 'Within standard' },
  round: { th: 'ครั้งที่', en: 'Round' },
  impactsH: { th: 'ผลกระทบต่อชีวิตและรายได้', en: 'Impact on lives and livelihoods' },
  faqH: { th: 'คำถามที่พบบ่อย', en: 'Common questions' },
  callH: { th: 'โทรหาใคร', en: 'Who to call' },
  sourcesH: { th: 'แหล่งข้อมูล', en: 'Sources' },
  src: { th: 'ที่มา', en: 'Source' },
  share: { th: 'แชร์ให้เพื่อนบ้าน', en: 'Share with neighbours' },
  copied: { th: 'คัดลอกลิงก์แล้ว', en: 'Link copied' },
  shareFail: { th: 'แชร์ไม่ได้ในหน้านี้ — คัดลอกลิงก์จากแถบที่อยู่แทน', en: 'Sharing is not available here — copy the address bar link instead' },
  disclaimer: { th: 'เว็บไซต์นี้รวบรวมข้อมูลจากหน่วยงานและสื่อที่อ้างอิงไว้ ไม่ใช่เว็บไซต์ของหน่วยงานรัฐ ถ้าข้อมูลไม่ตรงกัน ให้ยึดประกาศล่าสุดของหน่วยงานในพื้นที่',
                en: 'This site gathers information from the agencies and outlets cited. It is not a government website; if anything differs, follow the latest notice from your local authorities.' },
}
const u = (k, lang) => T(UI[k], lang)

function fmtDate(iso, lang) {
  if (!iso) return ''
  const [y, m, d] = String(iso).split('-').map(Number)
  const loc = lang === 'th' ? 'th-TH' : 'en-GB'
  if (!m) return new Intl.DateTimeFormat(loc, { year: 'numeric' }).format(new Date(y, 0, 1))
  return new Intl.DateTimeFormat(loc, d ? { day: 'numeric', month: 'short', year: 'numeric' } : { month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d || 1))
}
const nf = (lang, digits = 0) => new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-GB', { maximumFractionDigits: digits, minimumFractionDigits: digits })

function useLang() {
  const [lang, setLang] = useState(() => {
    const q = new URLSearchParams(window.location.search).get('lang')
    if (q === 'th' || q === 'en') return q
    try { return localStorage.getItem('water-info.lang') || 'th' } catch { return 'th' }
  })
  useEffect(() => {
    document.documentElement.lang = lang
    try { localStorage.setItem('water-info.lang', lang) } catch { /* private mode */ }
  }, [lang])
  return [lang, setLang]
}

/* ── citations: numbered in the order of the pack's source list ─────────── */
function useCite(pack) {
  return useMemo(() => {
    const ids = Object.keys(pack.sources)
    return (id) => ids.indexOf(id) + 1
  }, [pack])
}
function Cite({ ids, n, lang }) {
  if (!ids?.length) return null
  return (
    <span className="ml-1 whitespace-nowrap text-[13px] text-[var(--muted)]">
      [{ids.map((id, i) => (
        <React.Fragment key={id}>{i ? ', ' : ''}<a href={`#src-${id}`} className="underline decoration-dotted underline-offset-2 hover:text-[var(--river)]" aria-label={`${u('src', lang)} ${n(id)}`}>{n(id)}</a></React.Fragment>
      ))}]
    </span>
  )
}

const Section = ({ id, title, children, lead }) => (
  <section id={id} className="mt-10">
    <h2 className="text-[22px] font-bold leading-snug sm:text-[24px]">{title}</h2>
    {lead && <p className="mt-1 max-w-[62ch] text-[16px] text-[var(--muted)]">{lead}</p>}
    <div className="mt-4">{children}</div>
  </section>
)

/* ── the answer ─────────────────────────────────────────────────────────── */
function Answer({ pack, lang, n }) {
  const { latest, standard, answer } = pack
  const ratio = latest.value / standard.value
  const max = Math.max(latest.value, ...pack.readings.map((r) => r.value)) * 1.08
  const unsafe = answer.level === 'unsafe'
  return (
    <div className="rounded-2xl border-2 p-5 sm:p-7" style={{ borderColor: unsafe ? 'var(--silt)' : 'var(--ok)', background: unsafe ? 'var(--silt-soft)' : 'var(--ok-soft)' }}>
      <p className="text-[26px] font-bold leading-tight sm:text-[34px]" style={{ color: unsafe ? 'var(--silt)' : 'var(--ok)' }}>{T(answer, lang)}</p>
      <p className="mt-3 max-w-[60ch] text-[17px] leading-relaxed">{T(answer.sub, lang)}<Cite ids={answer.src} n={n} lang={lang} /></p>

      {/* how far over the standard, drawn to scale */}
      <figure className="mt-6" aria-label={`${u('latest', lang)} ${latest.value} ${standard.unitEn}, ${u('standard', lang)} ${standard.value}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <span className="text-[15px] font-semibold">{u('latest', lang)} · {T(latest.where, lang)} · {fmtDate(latest.date, lang)}</span>
          {latest.preliminary && <span className="rounded-full border border-[var(--silt)] px-2.5 py-0.5 text-[13px] font-semibold text-[var(--silt)]">{u('prelim', lang)}</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3">
          <span className="num text-[34px] font-bold leading-none" style={{ color: 'var(--silt)' }}>{latest.value}</span>
          <span className="text-[17px] font-semibold" style={{ color: 'var(--silt)' }}>{lang === 'th' ? standard.unit : standard.unitEn}</span>
          <span className="text-[17px] font-bold">{u('times', lang).replace('{n}', nf(lang).format(Math.round(ratio)))}</span>
        </div>
        <div className="relative mt-3 h-8 rounded-lg bg-[var(--card)]" style={{ boxShadow: 'inset 0 0 0 1px var(--line)' }}>
          <div className="absolute inset-y-1.5 left-1.5 rounded-md" style={{ width: `calc(${(latest.value / max) * 100}% - 6px)`, background: 'var(--silt)' }} />
          <div className="absolute -bottom-2 top-[-8px] w-[3px] rounded bg-[var(--river)]" style={{ left: `${(standard.value / max) * 100}%` }} />
        </div>
        <figcaption className="mt-3 text-[15px] font-semibold text-[var(--river)]">
          ▏{u('standard', lang)} {standard.value} {lang === 'th' ? standard.unit : standard.unitEn} ({T(standard.label, lang)})
        </figcaption>
        <p className="mt-2 text-[14px] text-[var(--muted)]">{T(latest.note, lang)}<Cite ids={latest.src} n={n} lang={lang} /></p>
      </figure>
    </div>
  )
}

function StatusList({ pack, lang, n }) {
  const tone = { ok: ['var(--ok)', CheckCircle2], partial: ['var(--river)', Clock3], bad: ['var(--silt)', XCircle] }
  return (
    <ul className="mt-4 grid gap-2.5 sm:grid-cols-3">
      {pack.status.map((s) => {
        const [c, Icon] = tone[s.tone] || tone.partial
        return (
          <li key={s.id} className="flex gap-3 rounded-xl border border-[var(--line)] bg-[var(--card)] p-3.5">
            <Icon size={22} className="mt-0.5 shrink-0" style={{ color: c }} aria-hidden />
            <div className="text-[15.5px] leading-snug">
              {T(s, lang)}
              <div className="mt-1 text-[13px] text-[var(--muted)]">{fmtDate(s.date, lang)}<Cite ids={s.src} n={n} lang={lang} /></div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/* ── what to do today ───────────────────────────────────────────────────── */
function Today({ pack, lang, n }) {
  const col = (items, good) => (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-[19px] font-bold" style={{ color: good ? 'var(--ok)' : 'var(--silt)' }}>
        {good ? <CheckCircle2 size={22} aria-hidden /> : <XCircle size={22} aria-hidden />}{u(good ? 'do' : 'dont', lang)}
      </h3>
      <ul className="mt-3 space-y-3">
        {items.map((x, i) => <li key={i} className="border-t border-[var(--line)] pt-3 text-[16.5px] leading-snug first:border-0 first:pt-0">{T(x, lang)}<Cite ids={x.src} n={n} lang={lang} /></li>)}
      </ul>
    </div>
  )
  return <div className="grid gap-3 md:grid-cols-2">{col(pack.todo.do, true)}{col(pack.todo.dont, false)}</div>
}

/* ── how much water ─────────────────────────────────────────────────────── */
function Stepper({ label, value, set, min, max, presets }) {
  return (
    <div>
      <div className="text-[15px] font-semibold">{label}</div>
      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" onClick={() => set(Math.max(min, value - 1))} className="grid h-12 w-12 place-items-center rounded-xl border border-[var(--line)] bg-[var(--card)]" aria-label="−"><Minus size={20} /></button>
        <input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => set(Math.min(max, Math.max(min, Number(e.target.value) || min)))}
          className="num h-12 w-20 rounded-xl border border-[var(--line)] bg-[var(--card)] text-center text-[20px] font-bold" />
        <button type="button" onClick={() => set(Math.min(max, value + 1))} className="grid h-12 w-12 place-items-center rounded-xl border border-[var(--line)] bg-[var(--card)]" aria-label="+"><Plus size={20} /></button>
      </div>
      {presets && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button key={p} type="button" onClick={() => set(p)} className={`num h-9 rounded-full border px-3.5 text-[15px] ${value === p ? 'border-[var(--river)] bg-[var(--river-soft)] font-bold text-[var(--river)]' : 'border-[var(--line)]'}`}>{p}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function WaterCalc({ pack, lang, n }) {
  const W = pack.water
  const [people, setPeople] = useState(4)
  const [days, setDays] = useState(7)
  const [tapOk, setTapOk] = useState(true)
  const [ci, setCi] = useState(0)
  const [price, setPrice] = useState('')
  const c = W.containers[ci]
  const lo = W.drink + W.cookLow + (tapOk ? 0 : W.hygieneLow)
  const hi = W.drink + W.cookHigh + (tapOk ? 0 : W.hygieneHigh)
  const totLo = lo * people * days, totHi = hi * people * days
  const nLo = Math.ceil(totLo / c.l), nHi = Math.ceil(totHi / c.l)
  const p = Number(price)
  const f0 = nf(lang)
  const range = (a, b) => (a === b ? f0.format(a) : `${f0.format(a)}–${f0.format(b)}`)
  const row = (k, a, b) => (
    <div className="flex items-baseline justify-between gap-3 border-t border-[var(--line)] py-2 first:border-0">
      <span>{u(k, lang)}</span><span className="num font-semibold">{range(a * people, b * people)} {u('perDay', lang)}</span>
    </div>
  )
  return (
    <div className="grid gap-4 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 sm:p-6 md:grid-cols-[1fr_1fr]">
      <div className="space-y-5">
        <Stepper label={u('people', lang)} value={people} set={setPeople} min={1} max={30} />
        <Stepper label={u('days', lang)} value={days} set={setDays} min={1} max={90} presets={[3, 7, 14, 30]} />
        <div>
          <div className="text-[15px] font-semibold">{u('tap', lang)}</div>
          <div className="mt-1.5 inline-flex rounded-xl border border-[var(--line)] p-1" role="group">
            {[[true, 'tapYes'], [false, 'tapNo']].map(([v, k]) => (
              <button key={k} type="button" aria-pressed={tapOk === v} onClick={() => setTapOk(v)}
                className={`h-10 rounded-lg px-4 text-[15.5px] ${tapOk === v ? 'bg-[var(--river)] font-bold text-white' : ''}`}>{u(k, lang)}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[1.3fr_1fr] gap-2">
          <label className="block">
            <span className="text-[15px] font-semibold">{u('container', lang)}</span>
            <select value={ci} onChange={(e) => setCi(Number(e.target.value))} className="mt-1.5 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-2 text-[15.5px]">
              {W.containers.map((x, i) => <option key={x.l} value={i}>{T(x, lang)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-[15px] font-semibold">{u('price', lang)}</span>
            <input type="number" inputMode="decimal" min="0" value={price} placeholder={u('pricePh', lang)} onChange={(e) => setPrice(e.target.value)}
              className="num mt-1.5 h-12 w-full rounded-xl border border-[var(--line)] bg-[var(--card)] px-3 text-[17px]" />
          </label>
        </div>
      </div>

      <div className="flex flex-col rounded-xl bg-[var(--river-soft)] p-4" aria-live="polite">
        <div className="text-[15.5px]">
          {row('drinkL', W.drink, W.drink)}
          {row('cookL', W.cookLow, W.cookHigh)}
          {!tapOk && row('hygL', W.hygieneLow, W.hygieneHigh)}
        </div>
        <div className="mt-4 border-t-2 border-[var(--river)] pt-3">
          <div className="text-[15px] font-semibold text-[var(--river)]">{u('total', lang)} · {f0.format(days)} {lang === 'th' ? 'วัน' : days === 1 ? 'day' : 'days'}</div>
          <div className="num mt-1 text-[30px] font-bold leading-tight">{range(totLo, totHi)} <span className="text-[18px]">{u('litres', lang)}</span></div>
          <div className="mt-1 text-[16px]">{u('about', lang)} <b className="num">{range(nLo, nHi)}</b> × {T(c, lang)}</div>
          <div className="mt-3 text-[15px] font-semibold text-[var(--river)]">{u('cost', lang)}</div>
          <div className="num text-[22px] font-bold">{p > 0 ? `฿${range(nLo * p, nHi * p)}` : <span className="text-[16px] font-normal text-[var(--muted)]">{u('costHint', lang)}</span>}</div>
        </div>
        <p className="mt-auto pt-4 text-[13.5px] text-[var(--muted)]">{u('waterNote', lang)}<Cite ids={W.src} n={n} lang={lang} /></p>
      </div>
    </div>
  )
}

/* ── what is being done ─────────────────────────────────────────────────── */
const ST_STYLE = {
  done: { color: 'var(--ok)', fill: true }, ongoing: { color: 'var(--river)', fill: true },
  announced: { color: 'var(--river)', fill: false }, planned: { color: 'var(--muted)', fill: false }, unconfirmed: { color: 'var(--silt)', fill: false },
}
function Actions({ pack, lang, n }) {
  const items = [...pack.actions].sort((a, b) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || String(a.date).localeCompare(String(b.date)))
  return (
    <>
      <ol className="relative ml-2 border-l-2 border-[var(--line)] pl-6">
        {items.map((a, i) => {
          const s = ST_STYLE[a.status] || ST_STYLE.planned
          return (
            <li key={i} className="relative pb-6 last:pb-0">
              <span className="absolute -left-[33px] top-1.5 h-4 w-4 rounded-full border-[3px]" style={{ borderColor: s.color, background: s.fill ? s.color : 'var(--bg)' }} aria-hidden />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="num text-[15px] font-bold">{a.date ? `${fmtDate(a.date, lang)}${a.until ? ` – ${fmtDate(a.until, lang)}` : ''}` : u('noDate', lang)}</span>
                <span className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold" style={{ color: s.fill ? 'white' : s.color, background: s.fill ? s.color : 'transparent', boxShadow: s.fill ? 'none' : `inset 0 0 0 1.5px ${s.color}` }}>{T(UI.st[a.status], lang)}</span>
                <span className="text-[14px] text-[var(--muted)]">{T(a.who, lang)}</span>
              </div>
              <p className="mt-1 max-w-[64ch] text-[16.5px] leading-snug">{T(a, lang)}<Cite ids={a.src} n={n} lang={lang} /></p>
            </li>
          )
        })}
      </ol>
      {pack.unknown?.length > 0 && (
        <div className="mt-6 rounded-2xl border-2 border-dashed border-[var(--line)] p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-[18px] font-bold"><CircleHelp size={20} aria-hidden />{u('unknownH', lang)}</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-6 text-[16px]">{pack.unknown.map((x, i) => <li key={i}>{T(x, lang)}</li>)}</ul>
        </div>
      )}
    </>
  )
}

/* ── readings ───────────────────────────────────────────────────────────── */
function Readings({ pack, lang, n }) {
  const unit = lang === 'th' ? pack.standard.unit : pack.standard.unitEn
  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-[var(--line)] bg-[var(--card)]">
        <table className="w-full min-w-[520px] border-collapse text-left text-[15.5px]">
          <thead>
            <tr className="border-b border-[var(--line)] text-[14px] text-[var(--muted)]">
              <th className="px-4 py-2.5 font-semibold">{u('where', lang)}</th>
              <th className="px-4 py-2.5 font-semibold">{u('when', lang)}</th>
              <th className="px-4 py-2.5 text-right font-semibold">{u('value', lang)} ({unit})</th>
              <th className="px-4 py-2.5 font-semibold">{u('standard', lang)} {pack.standard.value}</th>
            </tr>
          </thead>
          <tbody>
            {pack.readings.map((r, i) => {
              const over = r.value > pack.standard.value
              return (
                <tr key={i} className="border-b border-[var(--line)] last:border-0">
                  <td className="px-4 py-3">{T(r.where, lang)}{r.round ? <span className="ml-1 text-[13px] text-[var(--muted)]">({u('round', lang)} {r.round})</span> : null}<Cite ids={r.src} n={n} lang={lang} /></td>
                  <td className="num px-4 py-3 whitespace-nowrap">{r.dateFrom ? `${fmtDate(r.dateFrom, lang)} – ` : ''}{fmtDate(r.date, lang)}</td>
                  <td className="num px-4 py-3 text-right font-bold" style={{ color: over ? 'var(--silt)' : 'var(--ok)' }}>{r.value}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold" style={{ color: over ? 'var(--silt)' : 'var(--ok)' }}>{over ? `${u('over', lang)} ~${nf(lang).format(Math.round(r.value / pack.standard.value))}×` : u('under', lang)}</span>
                    {r.preliminary && <span className="ml-2 text-[13px] text-[var(--muted)]">({u('prelim', lang)})</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {pack.readingsNote && <p className="mt-3 max-w-[64ch] text-[15px] text-[var(--muted)]">{T(pack.readingsNote, lang)}<Cite ids={pack.readingsNote.src} n={n} lang={lang} /></p>}
    </>
  )
}

/* ── page ───────────────────────────────────────────────────────────────── */
export function App() {
  const pack = useMemo(() => packById(new URLSearchParams(window.location.search).get('pack')), [])
  const [lang, setLang] = useLang()
  const n = useCite(pack)
  const [note, setNote] = useState(null)
  useEffect(() => { document.title = `${T(pack.place, lang).split(' ')[0]} · ${u('site', lang)}` }, [pack, lang])

  const share = async () => {
    const data = { title: T(pack.answer, lang), text: `${T(pack.answer, lang)} — ${u('site', lang)}`, url: window.location.href }
    try {
      if (navigator.share) { await navigator.share(data); return }
      await navigator.clipboard.writeText(window.location.href); setNote(u('copied', lang))
    } catch (e) {
      if (e?.name !== 'AbortError') setNote(u('shareFail', lang))
    }
    setTimeout(() => setNote(null), 3500)
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] backdrop-blur" style={{ background: 'color-mix(in srgb, var(--bg) 94%, transparent)' }}>
        <div className="mx-auto flex max-w-[960px] items-center gap-3 px-4 py-2.5">
          <Droplets size={26} className="shrink-0 text-[var(--river)]" aria-hidden />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[16px] font-bold">{T(pack.place, lang)}</div>
            <div className="truncate text-[13.5px] text-[var(--muted)]">{T(pack.hazard, lang)} · {u('updated', lang)} {fmtDate(pack.updated, lang)}</div>
          </div>
          <div className="flex shrink-0 rounded-lg border border-[var(--line)] p-0.5" role="group" aria-label="Language">
            {['th', 'en'].map((l) => (
              <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
                className={`h-9 min-w-[44px] rounded-md px-2 text-[14px] font-bold ${lang === l ? 'bg-[var(--river)] text-white' : 'text-[var(--muted)]'}`}>{l === 'th' ? 'ไทย' : 'EN'}</button>
            ))}
          </div>
        </div>
        <nav className="mx-auto max-w-[960px] overflow-x-auto px-4 pb-2" aria-label={u('site', lang)}>
          <ul className="flex w-max gap-1.5">
            {UI.nav[lang].map(([id, label]) => (
              <li key={id}><a href={`#${id}`} className="block whitespace-nowrap rounded-full border border-[var(--line)] bg-[var(--card)] px-3.5 py-1.5 text-[14.5px] hover:border-[var(--river)]">{label}</a></li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-[960px] px-4 pb-16 pt-6">
        <Answer pack={pack} lang={lang} n={n} />
        <StatusList pack={pack} lang={lang} n={n} />

        <Section id="today" title={u('todayH', lang)}><Today pack={pack} lang={lang} n={n} /></Section>
        <Section id="water" title={u('waterH', lang)} lead={u('waterLead', lang)}><WaterCalc pack={pack} lang={lang} n={n} /></Section>
        <Section id="actions" title={u('actionsH', lang)}><Actions pack={pack} lang={lang} n={n} /></Section>
        <Section id="readings" title={u('readingsH', lang)}><Readings pack={pack} lang={lang} n={n} /></Section>

        <Section id="impacts" title={u('impactsH', lang)}>
          <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
            {pack.impacts.map((x) => (
              <div key={x.id}>
                <h3 className="text-[18px] font-bold">{T(x, lang)}</h3>
                <p className="mt-1 text-[16px] leading-relaxed">{T(x.body, lang)}<Cite ids={x.src} n={n} lang={lang} /></p>
              </div>
            ))}
          </div>
        </Section>

        <Section id="faq" title={u('faqH', lang)}>
          <div className="divide-y divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--card)]">
            {pack.faq.map((f, i) => (
              <details key={i} className="group px-4 py-1 sm:px-5">
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-2 text-[17px] font-semibold">
                  {T(f.q, lang)}<ChevronDown size={20} className="shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="pb-4 text-[16.5px] leading-relaxed">{T(f.a, lang)}<Cite ids={f.src} n={n} lang={lang} /></p>
              </details>
            ))}
          </div>
        </Section>

        <Section id="call" title={u('callH', lang)}>
          <ul className="grid gap-2.5 sm:grid-cols-2">
            {pack.contacts.map((c) => (
              <li key={c.n}>
                <a href={`tel:${c.n}`} className="flex min-h-[64px] items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--card)] px-4 py-3 hover:border-[var(--river)]">
                  <Phone size={22} className="shrink-0 text-[var(--river)]" aria-hidden />
                  <span className="num text-[24px] font-bold">{c.n}</span>
                  <span className="text-[15.5px] leading-snug">{T(c, lang)}</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="sources" title={u('sourcesH', lang)}>
          <ol className="space-y-2.5 text-[15px]">
            {Object.entries(pack.sources).map(([id, s]) => (
              <li key={id} id={`src-${id}`} className="flex gap-3 scroll-mt-28">
                <span className="num w-6 shrink-0 text-right font-bold text-[var(--muted)]">{n(id)}</span>
                <span className="min-w-0">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-words font-semibold text-[var(--river)] underline underline-offset-2">{s.title}<ExternalLink size={13} className="ml-1 inline align-[-1px]" aria-hidden /></a>
                  <span className="block text-[var(--muted)]">{s.outlet}{s.date ? ` · ${fmtDate(s.date, lang)}` : ''}</span>
                </span>
              </li>
            ))}
          </ol>
        </Section>

        <footer className="mt-12 border-t border-[var(--line)] pt-6">
          <button type="button" onClick={share} className="flex h-12 items-center gap-2 rounded-xl bg-[var(--river)] px-5 text-[16px] font-bold text-white">
            <Share2 size={19} aria-hidden />{u('share', lang)}
          </button>
          {note && <p className="mt-2 text-[15px]" role="status">{note}</p>}
          <p className="mt-5 max-w-[70ch] text-[14.5px] leading-relaxed text-[var(--muted)]">{u('disclaimer', lang)}</p>
        </footer>
      </main>
    </div>
  )
}
