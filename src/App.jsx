/* ══════════════════════════════════════════════════════════════════════════════
   THEOS-2 MAE SAI COMMAND
   Multi-Sensor Geospatial Serious Game & Integrated Disaster Decision Support
   ระบบภารกิจจำลองสถานการณ์และสนับสนุนการตัดสินใจบริหารจัดการอุทกภัยแม่สาย

   Flow:  title (name · mode · how to play) → pre-test → act 1 → summary → act 2 → summary
          → act 3 relief → score · leaderboard → post-test
   Time:  the mission clock moves only when the commander acts (orders take command
          time; the time bar jumps to the next event with a cut scene) — no waiting.
     left   · DataHub     (SFVI · satellite schedule · zone table · resources)
     centre · MapCanvas   (catchment · town zones · embankment) + TimeBar
     right  · ActionRail  (mission quest + orders)       bottom · TutorBar (Beginner)
   All tunables live in src/config/missionConfig.js
   ══════════════════════════════════════════════════════════════════════════ */

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { ChevronRight, ChevronLeft } from 'lucide-react'
import { useEngine } from './engine/useEngine'
import { TopBar, ActStepper, StatusBar, Toast, AlertLog, ACTS } from './panels/chrome'
import { DataHub } from './panels/datahub'
import { ActionRail } from './panels/actions'
import { TutorBar, questFor } from './panels/quest'
import { MapCanvas } from './map/MapCanvas'
import { AarShell } from './aar/AarShell'
import { QuizModal, VetoAlert, WaitCompareModal, Act1SummaryModal, Act2SummaryModal, TeacherPanel } from './modals/modals'
import { ImageAnalysisModal, ChannelModal } from './modals/analysis'
import { BoatPlannerModal } from './modals/planner'
import { LeaderboardModal } from './modals/guide'
import { TitleScreen, HowToPlay } from './modals/intro'
import { TimeBar } from './panels/timebar'
import { Cutscene } from './map/Cutscene'
import { ModeContext } from './ui/label'
import { logger } from './lib/evalLogger'
import { leaderboard } from './lib/leaderboard'
import { waitComparison } from './lib/sim'
import { sessionMetrics } from './lib/compare'

const DEMO = typeof window !== 'undefined' && /[?&#](demo|skipIntro)\b/.test(window.location.href)

function CollapsedRail({ label, side, onOpen }) {
  return (
    <button onClick={onOpen} title={`เปิดแผง${label}`} className="panel flex h-full w-full flex-col items-center gap-2 py-3 text-slate-400 hover:text-white">
      {side === 'left' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      <span className="font-thai text-[11.5px] [writing-mode:vertical-rl]">{label}</span>
    </button>
  )
}

export default function App() {
  const eng = useEngine()
  const { s } = eng
  const [phase, setPhase] = useState(DEMO ? 'play' : 'title')        // title → pretest → play
  const [postOpen, setPostOpen] = useState(false)
  const [postDone, setPostDone] = useState(false)
  const [preScore, setPreScore] = useState(null)
  const [player, setPlayer] = useState('')
  const [tutorOn, setTutorOn] = useState(true)
  const [teacher, setTeacher] = useState(false)
  const [guide, setGuide] = useState(false)
  const [board, setBoard] = useState(false)
  const [logVersion, setLogVersion] = useState(0)
  const [view, setView] = useState('urban')
  const [tab, setTab] = useState('base')
  const [leftTab, setLeftTab] = useState('sat')
  const [aarTab, setAarTab] = useState('relief')
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [analyze, setAnalyze] = useState(null)
  const [channel, setChannel] = useState(false)
  const [plan, setPlan] = useState(null)
  const [wait, setWait] = useState(null)
  const [saved, setSaved] = useState(null)

  /* one evaluation session per run */
  const sessionFor = useRef(-1)
  useEffect(() => {
    if (sessionFor.current === s.resetSeq) return
    const prev = logger.current
    if (prev && prev.rounds.length && !prev.result) logger.finish({ trust: Math.round(s.trust), score: null, exposed: null, abandoned: true })
    sessionFor.current = s.resetSeq
    logger.start({ hintsEnabled: eng.mode.tutor, demo: DEMO, stress: s.stress || [], seed: s.seed, mode: s.modeId })
    if (DEMO) logger.briefingDone()
    logger.enterAct(1)
    if (s.resetSeq > 0) {
      setPhase(DEMO ? 'play' : 'title'); setPreScore(null); setPostDone(false); setPostOpen(false)
      setWait(null); setPlan(null); setAnalyze(null); setChannel(false); setSaved(null); setAarTab('relief')
    }
  }, [s.resetSeq]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => logger.subscribe(() => setLogVersion((v) => v + 1)), [])
  useEffect(() => { logger.meta({ stress: s.stress || [], seed: s.seed, mode: s.modeId, hintsEnabled: eng.mode.tutor }) }, [s.seed, s.modeId, (s.stress || []).join()]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (DEMO) eng.start() }, [s.resetSeq]) // eslint-disable-line react-hooks/exhaustive-deps

  /* act changes: default view, tabs */
  useEffect(() => {
    logger.enterAct(s.act)
    if (s.act === 1) { setView('urban'); setTab('base'); setLeftTab('sat') }
    if (s.act === 2) { setView('urban'); setTab('ops'); setLeftTab('zones') }
    if (s.act === 3) setAarTab('relief')
  }, [s.act])

  /* keyboard: Space = advance to the next event · Ctrl+Shift+L teacher log */
  const modalOpen = !!(analyze || channel || plan || wait || guide || board || teacher || postOpen)
  useEffect(() => {
    const h = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return
      if (e.ctrlKey && e.shiftKey && (e.key === 'L' || e.key === 'l')) { e.preventDefault(); setTeacher((t) => !t); return }
      if (phase === 'play' && e.code === 'Space' && s.act !== 3) {
        e.preventDefault()
        if (!modalOpen && !eng.act1Over && !eng.act2Over && !(eng.veto1 && s.act === 1 && !s.vetoAck)) eng.advance({ mode: 'next' })
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [eng, phase, s.act, s.vetoAck, modalOpen])

  const go = useCallback((g) => {
    if (!g) return
    if (g.tab) { setTab(g.tab); setRightOpen(true) }
    if (g.view) setView(g.view)
    if (g.left) { setLeftTab(g.left); setLeftOpen(true) }
    if (g.aar) setAarTab(g.aar)
    if (g.analyze) setAnalyze(g.analyze)
    if (g.channel) setChannel(true)
    if (g.plan) setPlan(g.plan)
    if (g.advance) eng.advance({ mode: g.advance === 'end' ? 'end' : 'next' })
  }, [eng])

  const finishPost = (score) => {
    setPostOpen(false); setPostDone(true)
    logger.finish({ trust: Math.round(eng.s.trust), score: saved?.score ?? null, exposed: eng.exposure.exposed, post: score })
  }
  const saveScore = (score) => {
    const entry = { name: player || 'ไม่ระบุชื่อ', mode: s.modeId, score: score.total * 100, sec: eng.realMs() / 1000, seed: s.seed, parts: score.parts, stress: s.stress || [] }
    const rank = leaderboard.add(entry)
    const top = leaderboard.top(s.modeId, 999)
    setSaved({ rank, at: top[rank - 1]?.at, score: Math.round(score.total * 100) })
    eng.finishMission()
    logger.finish({ trust: Math.round(s.trust), score: Math.round(score.total * 100), exposed: eng.exposure.exposed, metrics: sessionMetrics(s, eng.scn, eng.realMs() / 1000) })
    setBoard(true)
  }

  const playing = phase === 'play'
  const quest = playing && s.act < 3 && eng.mode.tutor && tutorOn ? questFor(eng) : null
  const target = quest?.hint?.go
  const beaconTab = target?.tab && target.tab !== tab ? target.tab : null
  const beaconView = target?.view && target.view !== view ? target.view : null
  const beaconMap = s.act === 1 && view === 'corridor' && !s.channel.measured && eng.mode.tutor ? 'ruler' : null
  const act = ACTS[s.act - 1]

  return (
    <ModeContext.Provider value={eng.mode}>
      <div className="crt grid-bg flex h-screen w-screen flex-col overflow-hidden bg-[#050912]">
        <div className="pointer-events-none fixed inset-0 z-0 transition-all duration-700" style={{ background: `radial-gradient(120% 70% at 50% 0%, ${act.hex}0F, transparent 62%)` }} />
        <TopBar eng={eng} onGuide={() => setGuide(true)} onBoard={() => setBoard(true)} onTeacher={() => setTeacher(true)} tutorOn={tutorOn} setTutorOn={setTutorOn}
          onReset={() => eng.newGame()} />
        <ActStepper eng={eng} />

        {s.act === 3 ? (
          <AarShell eng={eng} tab={aarTab} setTab={setAarTab} onPostTest={() => setPostOpen(true)} postDone={postDone} player={player} onSaveScore={saveScore} saved={saved} />
        ) : (
          <div className="relative z-10 grid min-h-0 flex-1 gap-3 p-3"
            style={{ gridTemplateColumns: `${leftOpen ? 'minmax(272px,300px)' : '34px'} minmax(0,1fr) ${rightOpen ? 'minmax(312px,350px)' : '34px'}` }}>
            {leftOpen ? <DataHub eng={eng} tab={leftTab} setTab={setLeftTab} onCollapse={() => setLeftOpen(false)} />
              : <CollapsedRail side="left" label="ข้อมูล" onOpen={() => setLeftOpen(true)} />}
            <div className="flex min-h-0 flex-col gap-2">
              <div className="min-h-[300px] flex-1">
                <MapCanvas key={`${s.act}-${s.resetSeq}`} eng={eng} view={view} setView={setView} onPoint={setPlan} onChannel={() => setChannel(true)}
                  beaconView={beaconView} beaconMap={beaconMap} />
              </div>
              <TimeBar eng={eng} />
              <AlertLog eng={eng} />
            </div>
            {rightOpen ? (
              <ActionRail eng={eng} tab={tab} setTab={setTab} onGo={go} onAnalyze={setAnalyze} onChannel={() => setChannel(true)} onPlan={setPlan}
                onWait={() => setWait(waitComparison(eng.s, eng.scn, 180))} beaconTab={beaconTab} onCollapse={() => setRightOpen(false)} />
            ) : <CollapsedRail side="right" label="แผงสั่งการ" onOpen={() => setRightOpen(true)} />}
          </div>
        )}

        {quest && <TutorBar eng={eng} onGo={go} onHide={() => setTutorOn(false)} />}
        <StatusBar eng={eng} />
        <Toast flash={eng.flash} />

        <Cutscene eng={eng} />
        <TitleScreen open={phase === 'title' && !guide} player={player} setPlayer={setPlayer} modeId={s.modeId} setMode={eng.setMode} stress={s.stress} setStress={eng.setStress}
          onHowTo={() => setGuide(true)} onBoard={() => setBoard(true)}
          onStart={() => { logger.setPlayer(player); logger.briefingDone(); setPhase('pretest') }} />
        <QuizModal open={phase === 'pretest'} kind="pre" onDone={(score) => { setPreScore(score); setPhase('play'); eng.start() }} onSkip={() => { setPhase('play'); eng.start() }} />
        <QuizModal open={postOpen} kind="post" preScore={preScore} onDone={finishPost} onSkip={() => setPostOpen(false)} />
        <VetoAlert open={playing && eng.veto1 && s.act === 1 && !s.vetoAck && !eng.act1Over} eng={eng} onAck={eng.ackVeto} onDecide={() => go({ tab: 'zones', view: 'urban', left: 'zones' })} />
        <WaitCompareModal data={wait} onClose={() => setWait(null)} onEvacuate={() => { setWait(null); go({ tab: 'zones' }) }} />
        <Act1SummaryModal open={playing && eng.act1Over} eng={eng} onNext={eng.goAct2} />
        <Act2SummaryModal open={playing && eng.act2Over} eng={eng} onNext={eng.goAct3} />
        {analyze && <ImageAnalysisModal eng={eng} imageId={analyze} onClose={() => setAnalyze(null)} />}
        {channel && <ChannelModal eng={eng} onClose={() => setChannel(false)} />}
        {plan && <BoatPlannerModal eng={eng} pointId={plan} onClose={() => setPlan(null)} />}
        <HowToPlay open={guide} onClose={() => setGuide(false)} onStart={phase === 'title' ? () => { setGuide(false); logger.setPlayer(player); logger.briefingDone(); setPhase('pretest') } : null} />
        <LeaderboardModal open={board} onClose={() => setBoard(false)} highlight={saved} version={saved?.at} />
        <TeacherPanel open={teacher} onClose={() => setTeacher(false)} version={logVersion} />
      </div>
    </ModeContext.Provider>
  )
}
