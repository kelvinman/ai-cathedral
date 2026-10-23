import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { playSfx, setMusicIntensity, setVolumes, startMusic, unlockAudio } from './game/audio'
import {
  H,
  MAX_WAVE,
  W,
  chooseUpgrade,
  isEliteWave,
  makeGame,
  startWave,
  step,
  stepAmbient,
  type AbilityKey,
  type Action,
  type Curse,
  type Game,
  type Input,
  type Phase,
  type Upgrade,
} from './game/engine'
import { loadAssets, render, setShakeEnabled, type Assets, type View } from './game/render'
import { Hud, readHud, type HudState } from './ui/Hud'
import {
  ControlsPage,
  MenuPanel,
  ResultsScreen,
  SermonBanner,
  TitleScreen,
  UpgradeScreen,
  type MenuItem,
  type RunSummary,
} from './ui/Screens'
import { ControlsList, RiteTip, pad } from './ui/shared'
import { readStorage, writeStorage } from './ui/storage'

const STEP = 1 / 120

// Move, jump, drop and dash are the only inputs: firing and rites are automatic.
const KEY_ACTIONS: Record<string, Action> = {
  Space: 'jump',
  KeyW: 'jump',
  ArrowUp: 'jump',
  KeyS: 'down',
  ArrowDown: 'down',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
}
const MOVE_KEYS = ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD']
const GAME_KEYS = new Set([...Object.keys(KEY_ACTIONS), ...MOVE_KEYS])
const RITES = new Set<string>(['seal', 'volley', 'mirror', 'glyph'])

type PauseView = 'menu' | 'controls' | 'settings'
type Settings = { music: number; effects: number; shake: boolean }

function loadSettings(): Settings {
  const prefersCalm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  try {
    const saved = JSON.parse(readStorage('abc-settings') ?? '{}') as Partial<Settings>
    return { music: saved.music ?? 0.6, effects: saved.effects ?? 0.8, shake: saved.shake ?? !prefersCalm }
  } catch {
    return { music: 0.6, effects: 0.8, shake: !prefersCalm }
  }
}

const clampStep = (value: number, delta: number) => Math.round(Math.max(0, Math.min(1, value + delta)) * 10) / 10
const percent = (value: number) => (value <= 0 ? 'off' : `${Math.round(value * 100)}%`)

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game>(makeGame())
  const assetsRef = useRef<Assets | null>(null)
  const viewRef = useRef<View>({ scale: 1, offsetX: 0, offsetY: 0, dpr: 1, width: W, height: H })
  const heldRef = useRef(new Set<string>())
  const touchRef = useRef({ left: false, right: false, down: false, jump: false })
  const inputRef = useRef<Input>({ left: false, right: false, down: false, jumpHeld: false, pressed: new Set() })
  const phaseRef = useRef<Phase>('title')

  const [phase, setPhase] = useState<Phase>('title')
  const [hud, setHud] = useState<HudState>(() => readHud(gameRef.current))
  const [curse, setCurse] = useState<Curse | null>(null)
  const [flashing, setFlashing] = useState<Set<AbilityKey>>(new Set())
  // The first time each rite casts itself (ever), a tip explains what it did.
  const [riteTip, setRiteTip] = useState<AbilityKey | null>(null)
  const seenRitesRef = useRef<Set<string>>(new Set(JSON.parse(readStorage('abc-seen-rites') ?? '[]') as string[]))
  const [offers, setOffers] = useState<Upgrade[]>([])
  const [levels, setLevels] = useState<Record<string, number>>({})
  const [best, setBest] = useState(() => Number(readStorage('abc-best') ?? 0))
  const [newBest, setNewBest] = useState(false)
  const [ready, setReady] = useState(false)
  const [touch, setTouch] = useState(false)
  const [summary, setSummary] = useState<RunSummary>({ wave: 1, kills: 0, bestCombo: 0, score: 0, by: '' })
  const [muted, setMuted] = useState(() => readStorage('abc-muted') === '1')
  const [settings, setSettings] = useState<Settings>(loadSettings)

  // Highlighted upgrade card. The ref mirrors it for the key handler; confirming is
  // ignored briefly after the screen opens so a jump press can't pick a card by accident.
  const [selected, setSelected] = useState(0)
  const selectedRef = useRef(0)
  const offersOpenedAtRef = useRef(0)
  const select = useCallback((index: number) => {
    selectedRef.current = index
    setSelected(index)
  }, [])

  // Pause menu: which page is showing, and which row is highlighted (moved with ↑ ↓).
  const [pauseView, setPauseView] = useState<PauseView>('menu')
  const pauseViewRef = useRef<PauseView>('menu')
  const [pauseIndex, setPauseIndex] = useState(0)
  const pauseIndexRef = useRef(0)
  const menuItemsRef = useRef<MenuItem[]>([])
  const selectPause = useCallback((index: number) => {
    pauseIndexRef.current = index
    setPauseIndex(index)
  }, [])
  const showPauseView = useCallback(
    (view: PauseView) => {
      pauseViewRef.current = view
      setPauseView(view)
      selectPause(0)
    },
    [selectPause],
  )

  // First run only: a controls card that fades once the player starts moving.
  const [controlsCard, setControlsCard] = useState(false)
  const controlsCardRef = useRef(false)
  const dismissControlsCard = useCallback(() => {
    if (!controlsCardRef.current) return
    controlsCardRef.current = false
    setControlsCard(false)
    writeStorage('abc-seen-controls', '1')
  }, [])

  useEffect(() => {
    setVolumes(muted ? 0 : settings.music, muted ? 0 : settings.effects)
    setShakeEnabled(settings.shake)
    writeStorage('abc-muted', muted ? '1' : '0')
    writeStorage('abc-settings', JSON.stringify(settings))
  }, [muted, settings])

  useEffect(() => {
    const query = window.matchMedia('(pointer: coarse)')
    const update = () => setTouch(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  const goTo = useCallback((next: Phase) => {
    gameRef.current.phase = next
    phaseRef.current = next
    setPhase(next)
  }, [])

  const startGame = useCallback(() => {
    unlockAudio()
    startMusic()
    const game = makeGame()
    game.phase = 'playing'
    startWave(game)
    gameRef.current = game
    inputRef.current.pressed.clear()
    setLevels({})
    setNewBest(false)
    setCurse(game.curse)
    setHud(readHud(game))
    phaseRef.current = 'playing'
    setPhase('playing')
    if (!readStorage('abc-seen-controls')) {
      controlsCardRef.current = true
      setControlsCard(true)
    }
  }, [])

  const togglePause = useCallback(() => {
    const current = gameRef.current.phase
    if (current === 'playing') goTo('paused')
    else if (current === 'paused') goTo('playing')
  }, [goTo])

  const pick = useCallback(
    (upgrade: Upgrade) => {
      const game = gameRef.current
      if (game.phase !== 'upgrade') return
      chooseUpgrade(game, upgrade)
      setLevels({ ...game.levels })
      setOffers([])
      setCurse(game.curse)
      goTo('playing')
    },
    [goTo],
  )

  const press = useCallback((action: Action) => {
    if (gameRef.current.phase === 'playing') inputRef.current.pressed.add(action)
  }, [])

  // Keyboard.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const game = gameRef.current
      unlockAudio()
      if (GAME_KEYS.has(event.code) && game.phase === 'playing') event.preventDefault()
      if (game.phase === 'upgrade' && ['Space', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault()

      if (game.phase === 'paused') {
        const view = pauseViewRef.current
        if (view === 'controls' || (view === 'settings' && event.code === 'Escape')) {
          if (['Escape', 'Enter', 'Space', 'Backspace'].includes(event.code)) {
            event.preventDefault()
            showPauseView('menu')
          }
          return
        }
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD', 'Enter', 'Space'].includes(event.code)) {
          event.preventDefault()
          const count = menuItemsRef.current.length
          const index = pauseIndexRef.current
          if (event.code === 'ArrowUp' || event.code === 'KeyW') selectPause((index + count - 1) % count)
          if (event.code === 'ArrowDown' || event.code === 'KeyS') selectPause((index + 1) % count)
          if (event.code === 'ArrowLeft' || event.code === 'KeyA') menuItemsRef.current[index]?.adjust?.(-1)
          if (event.code === 'ArrowRight' || event.code === 'KeyD') menuItemsRef.current[index]?.adjust?.(1)
          if ((event.code === 'Enter' || event.code === 'Space') && !event.repeat) menuItemsRef.current[index]?.run()
          return
        }
      }
      if (event.repeat) return
      heldRef.current.add(event.code)
      // The first-run card fades as soon as the player moves, jumps or dashes.
      if (game.phase === 'playing' && (KEY_ACTIONS[event.code] || MOVE_KEYS.includes(event.code))) dismissControlsCard()

      if (game.phase === 'upgrade') {
        const count = game.offers.length
        if (event.code === 'ArrowLeft' || event.code === 'KeyA') select((selectedRef.current + count - 1) % count)
        if (event.code === 'ArrowRight' || event.code === 'KeyD') select((selectedRef.current + 1) % count)
        const confirm = event.code === 'Space' || event.code === 'Enter'
        if (confirm && performance.now() - offersOpenedAtRef.current > 500) pick(game.offers[selectedRef.current])
        return
      }

      if (event.code === 'Escape' || event.code === 'KeyP') {
        togglePause()
        return
      }
      if (event.code === 'KeyM') {
        setMuted((value) => !value)
        return
      }
      if (event.code === 'KeyR' && game.phase === 'paused') {
        startGame()
        return
      }
      if (event.code === 'Enter') {
        if (game.phase === 'title' || game.phase === 'dead' || game.phase === 'won') {
          event.preventDefault()
          startGame()
        }
        return
      }
      const action = KEY_ACTIONS[event.code]
      if (action) press(action)
    }
    const onKeyUp = (event: KeyboardEvent) => heldRef.current.delete(event.code)
    const onBlur = () => {
      heldRef.current.clear()
      touchRef.current = { left: false, right: false, down: false, jump: false }
      if (gameRef.current.phase === 'playing') goTo('paused')
    }
    const onVisibility = () => {
      if (document.hidden) onBlur()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [dismissControlsCard, goTo, pick, press, select, selectPause, showPauseView, startGame, togglePause])

  useEffect(() => {
    if (phase === 'paused') showPauseView('menu')
  }, [phase, showPauseView])

  // The first-run card also fades on its own after a while.
  useEffect(() => {
    if (!controlsCard || phase !== 'playing') return
    const timer = window.setTimeout(dismissControlsCard, 9000)
    return () => window.clearTimeout(timer)
  }, [controlsCard, dismissControlsCard, phase])

  useEffect(() => {
    if (!riteTip) return
    const timer = window.setTimeout(() => setRiteTip(null), 5500)
    return () => window.clearTimeout(timer)
  }, [riteTip])

  // Music swells on boss sermons and drops to the soft organ on menus. It never stops,
  // so the upgrade screen between sermons doesn't leave a silent gap.
  useEffect(() => {
    if (phase === 'playing') setMusicIntensity(hud.wave >= MAX_WAVE ? 2 : isEliteWave(hud.wave) ? 1 : 0.5)
    else if (phase === 'upgrade' || phase === 'won') setMusicIntensity(0.5)
    else setMusicIntensity(0.25)
  }, [phase, hud.wave])

  // Game loop.
  useEffect(() => {
    const canvasElement = canvasRef.current
    const stage = stageRef.current
    if (!canvasElement || !stage) return
    const ctx = canvasElement.getContext('2d')
    if (!ctx) return
    let disposed = false
    void loadAssets().then((assets) => {
      if (disposed) return
      assetsRef.current = assets
      setReady(true)
    })

    const resize = () => {
      const rect = stage.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvasElement.width = Math.round(rect.width * dpr)
      canvasElement.height = Math.round(rect.height * dpr)
      const scale = Math.min(rect.width / W, rect.height / H)
      viewRef.current = {
        scale,
        dpr,
        width: rect.width,
        height: rect.height,
        offsetX: (rect.width - W * scale) / 2,
        offsetY: (rect.height - H * scale) / 2,
      }
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(stage)

    let last = performance.now()
    let accumulator = 0
    let hudTimer = 0
    let raf = 0
    const flashTimers = new Map<AbilityKey, number>()
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      const game = gameRef.current
      const input = inputRef.current

      if (game.phase === 'playing') {
        const held = heldRef.current
        const touchState = touchRef.current
        input.left = held.has('ArrowLeft') || held.has('KeyA') || touchState.left
        input.right = held.has('ArrowRight') || held.has('KeyD') || touchState.right
        input.down = held.has('ArrowDown') || held.has('KeyS') || touchState.down
        input.jumpHeld = held.has('Space') || held.has('KeyW') || held.has('ArrowUp') || touchState.jump
        accumulator += dt
        let steps = 0
        while (accumulator >= STEP && steps < 12) {
          step(game, input, STEP)
          accumulator -= STEP
          steps += 1
          if (game.phase !== 'playing') break
        }
      } else {
        accumulator = 0
        input.pressed.clear()
        if (game.phase !== 'paused') stepAmbient(game, dt)
      }

      // Sounds, and a brief flash on the HUD icon of any rite that just cast itself.
      let flashChanged = false
      for (const sound of game.events) {
        playSfx(sound)
        if (RITES.has(sound)) {
          flashTimers.set(sound as AbilityKey, now + 450)
          flashChanged = true
          // Held back while the first-run controls card is up; it'll show on the next cast.
          if (!seenRitesRef.current.has(sound) && !controlsCardRef.current) {
            seenRitesRef.current.add(sound)
            writeStorage('abc-seen-rites', JSON.stringify([...seenRitesRef.current]))
            setRiteTip(sound as AbilityKey)
          }
        }
      }
      game.events.length = 0
      for (const [key, until] of flashTimers) {
        if (until < now) {
          flashTimers.delete(key)
          flashChanged = true
        }
      }
      if (flashChanged) setFlashing(new Set(flashTimers.keys()))

      if (game.phase !== phaseRef.current) {
        phaseRef.current = game.phase
        setPhase(game.phase)
        if (game.phase === 'upgrade') {
          setOffers(game.offers)
          select(Math.floor(game.offers.length / 2))
          offersOpenedAtRef.current = performance.now()
        }
        if (game.phase === 'dead' || game.phase === 'won') {
          setSummary({ wave: game.wave, kills: game.kills, bestCombo: game.bestCombo, score: game.score, by: game.lastHurtBy })
          const previous = Number(readStorage('abc-best') ?? 0)
          if (game.score > previous) {
            writeStorage('abc-best', String(game.score))
            setBest(game.score)
            setNewBest(true)
          }
        }
        setHud(readHud(game))
      }
      hudTimer += dt
      if (hudTimer > 0.066 && game.phase === 'playing') {
        hudTimer = 0
        setHud(readHud(game))
      }

      const assets = assetsRef.current
      if (assets) render(ctx, game, assets, viewRef.current)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [select])

  const holdTouch = (key: keyof typeof touchRef.current, action?: Action) => ({
    onPointerDown: (event: ReactPointerEvent) => {
      event.preventDefault()
      unlockAudio()
      event.currentTarget.setPointerCapture(event.pointerId)
      touchRef.current[key] = true
      if (action) press(action)
    },
    onPointerUp: () => {
      touchRef.current[key] = false
    },
    onPointerCancel: () => {
      touchRef.current[key] = false
    },
  })

  const pauseItems: MenuItem[] = [
    { label: 'Resume', key: 'Esc', style: 'primary', run: () => goTo('playing') },
    { label: 'Restart', key: 'R', style: 'secondary', run: startGame },
    { label: 'Controls', key: '', style: 'secondary', run: () => showPauseView('controls') },
    { label: 'Settings', key: '', style: 'secondary', run: () => showPauseView('settings') },
    { label: 'Quit to title', key: '', style: 'ghost', run: () => goTo('title') },
  ]
  const change = (patch: Partial<Settings>) => {
    setMuted(false)
    setSettings((current) => ({ ...current, ...patch }))
  }
  const settingsItems: MenuItem[] = [
    {
      label: `◀ Music ${percent(muted ? 0 : settings.music)} ▶`,
      key: '',
      style: 'secondary',
      run: () => change({ music: settings.music > 0 ? 0 : 0.6 }),
      adjust: (delta) => change({ music: clampStep(settings.music, delta * 0.1) }),
    },
    {
      label: `◀ Effects ${percent(muted ? 0 : settings.effects)} ▶`,
      key: '',
      style: 'secondary',
      run: () => change({ effects: settings.effects > 0 ? 0 : 0.8 }),
      adjust: (delta) => change({ effects: clampStep(settings.effects, delta * 0.1) }),
    },
    {
      label: `Screen shake: ${settings.shake ? 'on' : 'off'}`,
      key: '',
      style: 'secondary',
      run: () => change({ shake: !settings.shake }),
      adjust: () => change({ shake: !settings.shake }),
    },
    { label: 'Back', key: 'Esc', style: 'ghost', run: () => showPauseView('menu') },
  ]
  menuItemsRef.current = pauseView === 'settings' ? settingsItems : pauseItems

  const playing = phase === 'playing'

  return (
    <main className={`game ${playing ? 'is-playing' : ''}`}>
      <div className="stage" ref={stageRef}>
        <canvas ref={canvasRef} aria-label="AI Cathedral arena" onContextMenu={(event) => event.preventDefault()} />

        {phase !== 'title' && (
          <Hud
            hud={hud}
            flashing={flashing}
            showPauseButton={touch && (playing || phase === 'paused')}
            onPause={togglePause}
            onDash={() => {
              unlockAudio()
              press('dash')
            }}
          />
        )}

        {playing && <SermonBanner wave={hud.wave} waveState={hud.waveState} curse={curse} />}

        {playing && controlsCard && !touch && (
          <div className="panel controls-card" aria-live="polite">
            <ControlsList />
          </div>
        )}

        {playing && riteTip && <RiteTip rite={riteTip} />}

        {touch && playing && <p className="rotate-hint">Turn your phone sideways for a bigger arena</p>}
        {touch && playing && (
          <div className="touch-controls">
            <div className="touch-pad">
              <button type="button" className="touch-button" aria-label="Move left" {...holdTouch('left')}>
                ◀
              </button>
              <button type="button" className="touch-button" aria-label="Drop down" {...holdTouch('down', 'down')}>
                ▼
              </button>
              <button type="button" className="touch-button" aria-label="Move right" {...holdTouch('right')}>
                ▶
              </button>
            </div>
            <div className="touch-pad">
              <button
                type="button"
                className="touch-button is-large"
                aria-label="Dash"
                onPointerDown={(event) => {
                  event.preventDefault()
                  unlockAudio()
                  press('dash')
                }}
              >
                Dash
              </button>
              <button type="button" className="touch-button is-large" aria-label="Jump" {...holdTouch('jump', 'jump')}>
                Jump
              </button>
            </div>
          </div>
        )}

        {phase === 'title' && <TitleScreen ready={ready} best={best} onStart={startGame} />}

        {phase === 'paused' && (
          <div className="overlay">
            {pauseView === 'controls' && <ControlsPage onBack={() => showPauseView('menu')} />}
            {pauseView === 'menu' && (
              <MenuPanel
                kicker={`Sermon ${pad(hud.wave)}`}
                title="Paused"
                items={pauseItems}
                index={pauseIndex}
                onSelect={selectPause}
                hint="choose · Enter select"
              />
            )}
            {pauseView === 'settings' && (
              <MenuPanel
                kicker="Paused"
                title="Settings"
                items={settingsItems}
                index={pauseIndex}
                onSelect={selectPause}
                hint="choose · ← → adjust"
              />
            )}
          </div>
        )}

        {phase === 'upgrade' && (
          <UpgradeScreen wave={hud.wave} offers={offers} levels={levels} selected={selected} onSelect={select} onPick={pick} />
        )}

        {(phase === 'dead' || phase === 'won') && (
          <ResultsScreen
            won={phase === 'won'}
            summary={summary}
            best={best}
            newBest={newBest}
            onRestart={startGame}
            onTitle={() => goTo('title')}
          />
        )}
      </div>
    </main>
  )
}
