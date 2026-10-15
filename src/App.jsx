/* ══════════════════════════════════════════════════════════════════════════════
   THEOS-2 MAE SAI COMMAND
   Multi-Sensor Geospatial Serious Game & Integrated Disaster Decision Support
   ระบบภารกิจจำลองสถานการณ์และสนับสนุนการตัดสินใจบริหารจัดการอุทกภัยแม่สาย

   Root layout:  briefing → pre-test → 3 acts → post-test
     act 1 is a 3-step mission quest that closes only through its summary
     left   · AssessmentRail  (live SFVI · river gauge · trust)
     centre · MapCanvas       (real AOI geography + procedural sensor scenes)
     right  · CommandRail     (imagery · resources · decisions · routing · triage)
   All tunables live in src/config/missionConfig.js
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useEngine } from './engine/useEngine'
import { TopBar, ActStepper, StatusBar, Toast, AlertLog, HintBox, computeHint, ACTS } from './panels/chrome'
import { AssessmentRail } from './panels/assessment'
import { CommandRail } from './panels/command'
import { MapCanvas } from './map/MapCanvas'
import { AarShell } from './aar/AarShell'
import { BriefingModal, QuizModal, VetoAlert, CloudAlert, HoldCompareModal, Act1SummaryModal, TeacherPanel } from './modals/modals'
import { act1Decided, activeStep } from './panels/quest'
import { logger } from './lib/evalLogger'
import { missionScore } from './lib/sim'
import { EVAL } from './config/missionConfig'

const DEMO = typeof window !== 'undefined' && /[?&#](demo|skipIntro)\b/.test(window.location.href)

function CollapsedRail({ label, side, onOpen }) {
  return (
    <button onClick={onOpen} title={`เปิดแผง${label}`}
      className="panel flex h-full w-full flex-col items-center gap-2 py-3 text-slate-400 transition hover:text-white">
      {side === 'left' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      <span className="font-thai text-[11.5px] [writing-mode:vertical-rl]">{label}</span>
    </button>
  )
}

export default function App() {
  const eng = useEngine()
  const { s } = eng
  const [phase, setPhase] = useState(DEMO ? 'play' : 'briefing')     // briefing → pretest → play
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [postOpen, setPostOpen] = useState(false)
  const [postDone, setPostDone] = useState(false)
  const [preScore, setPreScore] = useState(null)
  const [player, setPlayer] = useState('')
  const [hintsOn, setHintsOn] = useState(EVAL.hintsEnabled)
  const [hiddenHint, setHiddenHint] = useState(null)
  const [teacher, setTeacher] = useState(false)
  const [logVersion, setLogVersion] = useState(0)
  const [view, setView] = useState('catchment')
  const [tab, setTab] = useState('data')
  const [aarTab, setAarTab] = useState('summary')
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [holdData, setHoldData] = useState(null)
  const [focus, setFocus] = useState(null)
  const [summaryOpen, setSummaryOpen] = useState(false)

  /* one evaluation session per run of the mission */
  const sessionFor = useRef(-1)
  useEffect(() => {
    if (sessionFor.current === s.resetSeq) return
    const prev = logger.current
    if (prev && prev.rounds.length && !prev.result) {
      logger.finish({ trust: Math.round(s.trust), score: null, exposed: null, abandoned: true })
    }
    sessionFor.current = s.resetSeq
    logger.start({ hintsEnabled: hintsOn, demo: DEMO })
    if (DEMO) logger.briefingDone()
    logger.enterAct(1)
    if (s.resetSeq > 0) {
      setPhase(DEMO ? 'play' : 'briefing'); setPreScore(null); setPostDone(false); setPostOpen(false)
      setHoldData(null); setAarTab('summary'); setFocus(null); setSummaryOpen(false)
    }
  }, [s.resetSeq]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => logger.subscribe(() => setLogVersion((v) => v + 1)), [])

  /* act changes: log, default view and tab */
  useEffect(() => {
    logger.enterAct(s.act)
    setView(s.act === 2 ? 'sar' : 'catchment')
    setTab('data')
  }, [s.act])

  /* every evacuation / standby order in act 1 ends on the decision summary */
  const seenDecisions = useRef(0)
  useEffect(() => {
    const n = s.decisions.length
    if (n > seenDecisions.current) {
      const last = s.decisions[n - 1]
      if (last.act === 1 && last.kind !== 'HOLD') setSummaryOpen(true)
    }
    seenDecisions.current = n
  }, [s.decisions])

  /** Act navigation — act 1 can only be left through its summary, after a decision. */
  const requestAct = useCallback((n) => {
    if (s.act === 1 && n > 1) {
      if (!act1Decided(s) && !s.act1Timeout) {
        eng.toast('warn', 'ต้องตัดสินใจก่อน — ประกาศอพยพ / แจ้งเตรียมพร้อม / ยังไม่สั่งการ')
        setTab('decide'); setRightOpen(true)
        return
      }
      setSummaryOpen(true)
      return
    }
    eng.goAct(n)
  }, [eng, s])

  /* keyboard: 1/2/3 acts · Space clock · Ctrl+Shift+L teacher log */
  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) { e.preventDefault(); setTeacher((t) => !t); return }
      if (phase !== 'play') return
      if (e.key === '1') requestAct(1)
      if (e.key === '2') requestAct(2)
      if (e.key === '3') requestAct(3)
      if (e.code === 'Space' && s.act !== 3) { e.preventDefault(); eng.setRunning((r) => !r) }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [eng, phase, s.act, requestAct])

  const go = useCallback((g) => {
    if (g.tab) { setTab(g.tab); setRightOpen(true) }
    if (g.view) setView(g.view)
    if (g.aar) setAarTab(g.aar)
    if (g.post) setPostOpen(true)
  }, [])

  const onRoute = useCallback(async (cid) => {
    const r = await eng.computeRoute(cid)
    if (r) { setView('urban'); setFocus(cid) }
    return r
  }, [eng])

  const onCommunity = useCallback((cid) => {
    setFocus(cid)
    if (s.act === 2 && tab === 'triage' && !s.convoy) eng.setPriority(cid)
  }, [eng, s.act, s.convoy, tab])

  const finishPost = (score) => {
    setPostOpen(false); setPostDone(true); setAarTab('summary')
    const ms = missionScore(eng.s)
    logger.finish({ trust: Math.round(eng.s.trust), score: Math.round(ms.total * 100), exposed: ms.exposure.exposed, post: score })
  }

  const playing = phase === 'play'
  const hint = hintsOn && playing ? computeHint(eng, { tab, view, postDone }) : null
  const showHint = hint && hint.text !== hiddenHint
  const act = ACTS[s.act - 1]
  // mission-quest beacons: blink the tab / map view / map control the next step needs
  const quest = playing && s.act === 1 && hintsOn ? activeStep(eng) : null
  const beaconTab = quest?.go.tab && quest.go.tab !== tab ? quest.go.tab : null
  const beaconView = quest?.go.view && quest.go.view !== view ? quest.go.view : null
  const beaconMap = quest?.id === 'bank' && view === 'corridor' && !s.channelMeasured ? 'ruler' : null
  const summaryShown = playing && s.act === 1 && (summaryOpen || s.act1Timeout) && !holdData

  return (
    <div className="crt grid-bg flex h-screen w-screen flex-col overflow-hidden bg-[#050912]">
      <div className="pointer-events-none fixed inset-0 z-0 transition-all duration-700"
        style={{ background: `radial-gradient(120% 70% at 50% 0%, ${act.hex}0F, transparent 62%)` }} />

      <TopBar eng={eng} onBriefing={() => setBriefingOpen(true)} onTeacher={() => setTeacher(true)} hintsOn={hintsOn} setHintsOn={setHintsOn}
        onNextAct={() => requestAct(s.act + 1)} act1Ready={act1Decided(s)} />
      <ActStepper eng={eng} onAct={requestAct} />

      {s.act === 3 ? (
        <>
          <AarShell eng={eng} tab={aarTab} setTab={setAarTab} onPostTest={() => setPostOpen(true)} postDone={postDone} />
          {showHint && (
            <div className="fixed bottom-10 left-1/2 z-40 w-[440px] -translate-x-1/2">
              <HintBox hint={hint} onGo={go} onHide={() => setHiddenHint(hint.text)} />
            </div>
          )}
        </>
      ) : (
        <div className="relative z-10 grid min-h-0 flex-1 gap-3 p-3"
          style={{ gridTemplateColumns: `${leftOpen ? 'minmax(232px,268px)' : '34px'} minmax(0,1fr) ${rightOpen ? 'minmax(304px,344px)' : '34px'}` }}>
          {leftOpen ? <AssessmentRail eng={eng} onCollapse={() => setLeftOpen(false)} />
            : <CollapsedRail side="left" label="การประเมินสถานการณ์" onOpen={() => setLeftOpen(true)} />}

          <div className="flex min-h-0 flex-col gap-2">
            <div className="min-h-[300px] flex-1">
              <MapCanvas key={`${s.act}-${s.resetSeq}`} eng={eng} view={view} setView={setView} focus={focus}
                onCommunity={onCommunity} onRouteTool={() => go({ tab: 'route', view: 'urban' })} beaconView={beaconView} beaconMap={beaconMap}
                hint={showHint ? <HintBox hint={hint} onGo={go} onHide={() => setHiddenHint(hint.text)} /> : null} />
            </div>
            <AlertLog eng={eng} />
          </div>

          {rightOpen ? (
            <CommandRail eng={eng} tab={tab} setTab={setTab} setView={setView} onCollapse={() => setRightOpen(false)}
              onRoute={onRoute} onHoldResult={setHoldData} onGo={go} onFinish={() => requestAct(2)} beaconTab={beaconTab} />
          ) : <CollapsedRail side="right" label="แผงสั่งการ" onOpen={() => setRightOpen(true)} />}
        </div>
      )}

      <StatusBar eng={eng} />
      <Toast flash={eng.flash} />

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      <BriefingModal open={phase === 'briefing' || briefingOpen} firstRun={phase === 'briefing'} player={player} setPlayer={setPlayer}
        onEnter={() => { logger.setPlayer(player); logger.briefingDone(); setPhase('pretest') }}
        onClose={() => setBriefingOpen(false)} />
      <QuizModal open={phase === 'pretest'} kind="pre"
        onDone={(score) => { setPreScore(score); setPhase('play') }} onSkip={() => setPhase('play')} />
      <QuizModal open={postOpen} kind="post" preScore={preScore} onDone={finishPost} onSkip={() => setPostOpen(false)} />
      <VetoAlert open={playing && eng.veto1 && s.act === 1 && !s.vetoAck && !summaryShown && !s.act1Timeout} eng={eng}
        onAck={eng.ackVeto} onDecide={() => go({ tab: 'decide' })} />
      <CloudAlert open={playing && s.act === 2 && !s.cloudAck}
        onSar={() => { eng.ackCloud(); setView('sar'); go({ tab: 'data' }) }}
        onRouting={() => { eng.ackCloud(); go({ tab: 'route', view: 'urban' }) }} />
      <HoldCompareModal data={holdData} onClose={() => setHoldData(null)}
        onEvacuate={() => { setHoldData(null); go({ tab: 'decide' }) }} />
      <Act1SummaryModal open={summaryShown} eng={eng} timeout={s.act1Timeout}
        onStay={() => setSummaryOpen(false)}
        onNext={() => { setSummaryOpen(false); eng.goAct(2) }} />
      <TeacherPanel open={teacher} onClose={() => setTeacher(false)} version={logVersion} />
    </div>
  )
}
