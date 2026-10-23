import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { playSfx, setMuted as setAudioMuted, unlockAudio } from './game/audio'
import {
  ENEMY_NAMES,
  H,
  MAX_WAVE,
  W,
  abilityMeta,
  chooseUpgrade,
  isEliteWave,
  makeGame,
  startWave,
  step,
  stepAmbient,
  type AbilityKey,
  type Action,
  type Game,
  type Input,
  type Phase,
  type Upgrade,
  type WaveState,
} from './game/engine'
import { ATLAS, loadAssets, render, type Assets, type View } from './game/render'

const STEP = 1 / 120
const ABILITY_ORDER: AbilityKey[] = ['dash', 'seal', 'volley', 'mirror', 'glyph']

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
const GAME_KEYS = new Set([...Object.keys(KEY_ACTIONS), 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'])

const ICONS: Partial<Record<AbilityKey, keyof typeof ATLAS>> = {
  seal: 'splat',
  volley: 'candelabra',
  mirror: 'mirrorA',
  glyph: 'skull',
}

type Hud = {
  hp: number
  maxHp: number
  wave: number
  waveKills: number
  waveTotal: number
  waveState: WaveState
  score: number
  combo: number
  comboFrac: number
  cooldowns: Record<AbilityKey, number>
  cooldownFrac: Record<AbilityKey, number>
}

function readHud(g: Game): Hud {
  const cooldownFrac = {} as Record<AbilityKey, number>
  for (const key of ABILITY_ORDER) cooldownFrac[key] = g.cooldowns[key] / g.cooldownMax[key]
  return {
    hp: Math.ceil(g.player.hp),
    maxHp: g.player.maxHp,
    wave: g.wave,
    waveKills: g.waveKills,
    waveTotal: g.waveTotal,
    waveState: g.waveState,
    score: g.score,
    combo: g.combo,
    comboFrac: Math.max(0, g.comboTimer / 2.8),
    cooldowns: { ...g.cooldowns },
    cooldownFrac,
  }
}

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private mode); the game still works without it.
  }
}

const pad = (value: number) => String(value).padStart(2, '0')

/** The line over each sermon's banner: who is joining, and when the bosses arrive. */
function sermonLine(wave: number) {
  if (wave >= MAX_WAVE) return 'The Blood Model speaks'
  if (wave === 1) return `${ENEMY_NAMES.acolyte}s fill the nave`
  if (wave === 2) return `${ENEMY_NAMES.zealot}s and ${ENEMY_NAMES.wisp}s join the sermon`
  if (wave === 5) return `The Arch-Deacon leads the ${ENEMY_NAMES.bishop}s in`
  if (isEliteWave(wave)) return 'The Arch-Deacon returns'
  if (wave === MAX_WAVE - 1) return 'The model is almost done thinking'
  return 'The model is thinking'
}

/** "an Evangelist", "a Hype Bishop", "the Arch-Deacon". */
function withArticle(name: string) {
  if (name.startsWith('The ')) return `the ${name.slice(4)}`
  return `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`
}

function AtlasIcon({ name, size = 34 }: { name: keyof typeof ATLAS; size?: number }) {
  const [x, y, w, h] = ATLAS[name]
  const scale = size / Math.max(w, h)
  return (
    <span
      className="atlas-icon"
      aria-hidden="true"
      style={{
        width: w * scale,
        height: h * scale,
        backgroundPosition: `-${x * scale}px -${y * scale}px`,
        backgroundSize: `${160 * scale}px ${128 * scale}px`,
      }}
    />
  )
}

/** The four inputs, plus a reminder that firing and rites are automatic. */
function ControlsList() {
  return (
    <>
      <dl className="controls">
        <div>
          <dt>
            <kbd>A</kbd>
            <kbd>D</kbd>
          </dt>
          <dd>Move</dd>
        </div>
        <div>
          <dt>
            <kbd>Space</kbd>
          </dt>
          <dd>Jump ×2</dd>
        </div>
        <div>
          <dt>
            <kbd>S</kbd>
          </dt>
          <dd>Drop down</dd>
        </div>
        <div>
          <dt>
            <kbd>Shift</kbd>
          </dt>
          <dd>Dash</dd>
        </div>
      </dl>
      <p className="controls-note">You fire automatically. Your rites cast themselves.</p>
    </>
  )
}

function DashIcon() {
  return (
    <svg className="dash-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6l6 6-6 6M12 6l6 6-6 6" />
    </svg>
  )
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Game>(makeGame())
  const assetsRef = useRef<Assets | null>(null)
  const viewRef = useRef<View>({ scale: 1, offsetX: 0, offsetY: 0, dpr: 1, width: W, height: H })
  const heldRef = useRef(new Set<string>())
  const touchRef = useRef({ left: false, right: false, down: false, jump: false })
  const inputRef = useRef<Input>({
    left: false,
    right: false,
    down: false,
    jumpHeld: false,
    pressed: new Set(),
  })
  const phaseRef = useRef<Phase>('title')

  const [phase, setPhase] = useState<Phase>('title')
  const [hud, setHud] = useState<Hud>(() => readHud(gameRef.current))
  const [offers, setOffers] = useState<Upgrade[]>([])
  // Highlighted upgrade card. The ref mirrors it for the key handler; confirming is
  // ignored briefly after the screen opens so a jump press can't pick a card by accident.
  const [selected, setSelected] = useState(0)
  const selectedRef = useRef(0)
  const offersOpenedAtRef = useRef(0)
  const select = useCallback((index: number) => {
    selectedRef.current = index
    setSelected(index)
  }, [])
  // Highlighted pause-menu button, moved with ↑ ↓ and activated with Enter or Space.
  const [pauseIndex, setPauseIndex] = useState(0)
  // The pause menu can show a Controls page instead of its buttons.
  const [pauseView, setPauseView] = useState<'menu' | 'controls'>('menu')
  const pauseViewRef = useRef<'menu' | 'controls'>('menu')
  const showPauseView = useCallback((view: 'menu' | 'controls') => {
    pauseViewRef.current = view
    setPauseView(view)
  }, [])
  // First run only: a controls card that fades once the player starts moving.
  const [controlsCard, setControlsCard] = useState(false)
  const controlsCardRef = useRef(false)
  const dismissControlsCard = useCallback(() => {
    if (!controlsCardRef.current) return
    controlsCardRef.current = false
    setControlsCard(false)
    writeStorage('abc-seen-controls', '1')
  }, [])
  const pauseIndexRef = useRef(0)
  const pauseActionsRef = useRef<(() => void)[]>([])
  const selectPause = useCallback((index: number) => {
    pauseIndexRef.current = index
    setPauseIndex(index)
  }, [])
  const [levels, setLevels] = useState<Record<string, number>>({})
  const [best, setBest] = useState(() => Number(readStorage('abc-best') ?? 0))
  const [newBest, setNewBest] = useState(false)
  const [muted, setMuted] = useState(() => readStorage('abc-muted') === '1')
  const [ready, setReady] = useState(false)
  const [touch, setTouch] = useState(false)
  const [summary, setSummary] = useState({ wave: 1, kills: 0, bestCombo: 0, score: 0, by: '' })

  useEffect(() => {
    setAudioMuted(muted)
    writeStorage('abc-muted', muted ? '1' : '0')
  }, [muted])

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
    const game = makeGame()
    game.phase = 'playing'
    startWave(game)
    gameRef.current = game
    inputRef.current.pressed.clear()
    setLevels({})
    setNewBest(false)
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
      if (game.phase === 'paused' && pauseViewRef.current === 'controls') {
        if (['Escape', 'Enter', 'Space', 'Backspace'].includes(event.code)) {
          event.preventDefault()
          showPauseView('menu')
        }
        return
      }
      if (game.phase === 'paused' && ['ArrowUp', 'ArrowDown', 'KeyW', 'KeyS', 'Enter', 'Space'].includes(event.code)) {
        event.preventDefault()
        const count = pauseActionsRef.current.length
        if (event.code === 'ArrowUp' || event.code === 'KeyW') selectPause((pauseIndexRef.current + count - 1) % count)
        if (event.code === 'ArrowDown' || event.code === 'KeyS') selectPause((pauseIndexRef.current + 1) % count)
        if ((event.code === 'Enter' || event.code === 'Space') && !event.repeat) pauseActionsRef.current[pauseIndexRef.current]?.()
        return
      }
      if (event.repeat) return
      heldRef.current.add(event.code)
      // The first-run card fades as soon as the player moves, jumps or dashes.
      if (game.phase === 'playing' && (KEY_ACTIONS[event.code] || ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(event.code))) {
        dismissControlsCard()
      }

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
    if (phase === 'paused') {
      selectPause(0)
      showPauseView('menu')
    }
  }, [phase, selectPause, showPauseView])

  // The first-run card also fades on its own after a while.
  useEffect(() => {
    if (!controlsCard || phase !== 'playing') return
    const timer = window.setTimeout(dismissControlsCard, 9000)
    return () => window.clearTimeout(timer)
  }, [controlsCard, dismissControlsCard, phase])

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

      for (const sound of game.events) playSfx(sound)
      game.events.length = 0

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
      if (assets) {
        render(ctx, game, assets, viewRef.current)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [touch])

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

  const healthFrac = Math.max(0, hud.hp / hud.maxHp)
  const waveFrac = hud.waveTotal ? hud.waveKills / hud.waveTotal : 0
  // Health is shown as blood-drop pips worth 20 HP each.
  const pipCount = Math.ceil(hud.maxHp / 20)
  const pipsFull = Math.ceil(hud.hp / 20)
  // The gold orb fills with the combo timer; its liquid spans sprite rows 3–36 and
  // drains a whole pixel row at a time.
  const orbFillTop = 3 + Math.round((1 - (hud.combo >= 2 ? hud.comboFrac : 0)) * 33)
  const pauseItems = [
    { label: 'Resume', key: 'Esc', style: 'primary', run: () => goTo('playing') },
    { label: 'Restart', key: 'R', style: 'secondary', run: startGame },
    { label: 'Controls', key: '', style: 'secondary', run: () => showPauseView('controls') },
    { label: `Sound: ${muted ? 'off' : 'on'}`, key: 'M', style: 'secondary', run: () => setMuted((value) => !value) },
    { label: 'Quit to title', key: '', style: 'ghost', run: () => goTo('title') },
  ]
  pauseActionsRef.current = pauseItems.map((item) => item.run)
  const playing = phase === 'playing'
  const showHud = phase !== 'title'

  return (
    <main className={`game ${playing ? 'is-playing' : ''}`}>
      <div className="stage" ref={stageRef}>
        <canvas
          ref={canvasRef}
          aria-label="AI Blood Cathedral arena"
          onContextMenu={(event) => event.preventDefault()}
        />

        {showHud && (
          <div className="hud" aria-live="off">
            <div className="corner">
              <div className="orb" style={{ '--fill-top': `${orbFillTop}` } as CSSProperties} title="Combo">
                <span className="orb-fill" />
                <span className="orb-frame" />
                {hud.combo >= 2 && <b key={hud.combo}>×{hud.combo}</b>}
              </div>
              <div className="corner-stack">
                <div className={`health-pips ${healthFrac < 0.3 ? 'is-low' : ''}`} aria-label={`Health ${hud.hp} of ${hud.maxHp}`}>
                  {Array.from({ length: pipCount }, (_, index) => (
                    <i key={index} className={index < pipsFull ? 'is-full' : ''} />
                  ))}
                </div>
                <div className="abilities">
                  {ABILITY_ORDER.map((key) => {
                    const meta = abilityMeta[key]
                    const frac = hud.cooldownFrac[key]
                    const isReady = frac <= 0
                    const icon = ICONS[key]
                    return (
                      <button
                        key={key}
                        type="button"
                        tabIndex={-1}
                        className={`ability ${isReady ? 'is-ready' : ''}`}
                        style={{ '--accent': meta.color } as CSSProperties}
                        onPointerDown={(event) => {
                          event.preventDefault()
                          unlockAudio()
                          if (key === 'dash') press('dash')
                        }}
                        title={`${meta.label}: ${meta.caption}`}
                      >
                        <span className="ability-icon">{icon ? <AtlasIcon name={icon} /> : <DashIcon />}</span>
                        <span className="ability-fill" style={{ transform: `scaleY(${frac})` }} />
                        {!isReady && <span className="ability-timer">{Math.ceil(hud.cooldowns[key])}</span>}
                        {key === 'dash' && <span className="ability-key">⇧</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="sermon-title">
              <span>
                Sermon {pad(hud.wave)} / {MAX_WAVE}
              </span>
              <div className="sermon-progress">
                <i style={{ transform: `scaleX(${waveFrac})` }} />
              </div>
            </div>

            <strong className="score">{hud.score.toLocaleString()}</strong>

            {touch && (playing || phase === 'paused') && (
              <button type="button" tabIndex={-1} className="pause-button" onClick={togglePause} aria-label="Pause">
                ❚❚
              </button>
            )}
          </div>
        )}

        {playing && hud.waveState === 'intro' && (
          <div className="banner" key={`wave-${hud.wave}`}>
            <span className="label">{sermonLine(hud.wave)}</span>
            <strong>Sermon {pad(hud.wave)}</strong>
          </div>
        )}
        {playing && hud.waveState === 'cleared' && (
          <div className="banner is-cleared" key={`clear-${hud.wave}`}>
            <span className="label">Followers resisted</span>
            <strong>Sermon cleared</strong>
          </div>
        )}

        {playing && controlsCard && !touch && (
          <div className="panel controls-card" aria-live="polite">
            <ControlsList />
          </div>
        )}

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

        {phase === 'title' && (
          <div className="overlay">
            <div className="panel title-panel">
              <span className="sigil" aria-hidden="true" />
              <span className="label accent">The hundredth conversion cycle</span>
              <h1>
                AI Blood <em>Cathedral</em>
              </h1>
              <p className="lede">
                The Blood Model promised its followers perfect certainty. Now they pour through the nave to convert
                the last apostate: you. Turn the model&apos;s own tokens against it, and outlast twenty sermons.
              </p>
              <button type="button" className="primary" onClick={startGame} disabled={!ready} autoFocus>
                {ready ? 'Refuse the model' : 'Lighting candles…'}
                <kbd>Enter</kbd>
              </button>
              {best > 0 && <span className="label subtle">Best free will · {best.toLocaleString()}</span>}
            </div>
          </div>
        )}

        {phase === 'paused' && (
          <div className="overlay">
            {pauseView === 'controls' ? (
              <div className="panel small-panel controls-panel">
                <span className="label accent">Paused</span>
                <h2>Controls</h2>
                <ControlsList />
                <button type="button" tabIndex={-1} className="secondary is-selected" onClick={() => showPauseView('menu')}>
                  Back <kbd>Esc</kbd>
                </button>
              </div>
            ) : (
              <div className="panel small-panel">
                <span className="label accent">Sermon {pad(hud.wave)}</span>
                <h2>Paused</h2>
                <div className="stack">
                  {pauseItems.map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      tabIndex={-1}
                      className={`${item.style} ${index === pauseIndex ? 'is-selected' : ''}`}
                      onPointerEnter={() => selectPause(index)}
                      onClick={item.run}
                    >
                      {item.label}
                      {item.key && <kbd>{item.key}</kbd>}
                    </button>
                  ))}
                </div>
                <p className="choose-hint">
                  <kbd>↑</kbd>
                  <kbd>↓</kbd> choose · <kbd>Enter</kbd> select
                </p>
              </div>
            )}
          </div>
        )}

        {phase === 'upgrade' && (
          <div className="overlay">
            <div className="panel upgrade-panel">
              <span className="label accent">Sermon {pad(hud.wave)} survived</span>
              <h2>Choose a counter-doctrine</h2>
              <div className="cards">
                {offers.map((upgrade, index) => {
                  const level = levels[upgrade.id] ?? 0
                  return (
                    <button
                      type="button"
                      tabIndex={-1}
                      key={upgrade.id}
                      className={`card ${index === selected ? 'is-selected' : ''}`}
                      onPointerEnter={() => select(index)}
                      onClick={() => pick(upgrade)}
                    >
                      <span className="label">{upgrade.eyebrow}</span>
                      <strong>{upgrade.title}</strong>
                      <p>{upgrade.description}</p>
                      <span className="pips" aria-label={`Level ${level} of ${upgrade.max}`}>
                        {Array.from({ length: upgrade.max }, (_, pip) => (
                          <i key={pip} className={pip < level ? 'is-on' : pip === level ? 'is-next' : ''} />
                        ))}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="choose-hint">
                <kbd>←</kbd>
                <kbd>→</kbd> choose · <kbd>Space</kbd> confirm
              </p>
            </div>
          </div>
        )}

        {(phase === 'dead' || phase === 'won') && (
          <div className="overlay">
            <div className="panel small-panel end-panel">
              <span className="label accent">{phase === 'won' ? 'The final sermon' : 'Conversion complete'}</span>
              <h2>{phase === 'won' ? 'The Blood Model could not convert you.' : 'You joined the model.'}</h2>
              <p className="lede">
                {phase === 'won'
                  ? 'Its followers fall silent. For the first time in a hundred cycles, the cathedral is quiet, and the thinking is yours again.'
                  : `Converted by ${withArticle(summary.by || ENEMY_NAMES.acolyte)} in Sermon ${pad(summary.wave)}.`}
              </p>
              <dl className="stats">
                <div>
                  <dt>Sermon</dt>
                  <dd>{pad(summary.wave)}</dd>
                </div>
                <div>
                  <dt>Resisted</dt>
                  <dd>{summary.kills}</dd>
                </div>
                <div>
                  <dt>Best combo</dt>
                  <dd>{summary.bestCombo ? `×${summary.bestCombo}` : '–'}</dd>
                </div>
                <div>
                  <dt>Free will</dt>
                  <dd>{summary.score.toLocaleString()}</dd>
                </div>
              </dl>
              {newBest ? (
                <span className="badge">New best</span>
              ) : (
                <span className="label subtle">Best · {best.toLocaleString()}</span>
              )}
              <div className="stack">
                <button type="button" className="primary" onClick={startGame} autoFocus>
                  {phase === 'won' ? 'Defy it again' : 'Reject conversion'} <kbd>Enter</kbd>
                </button>
                <button type="button" className="ghost" onClick={() => goTo('title')}>
                  Title screen
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
