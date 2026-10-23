import { useEffect, useRef } from 'react'
import { ARENAS, CURSE_RULES, ENEMY_NAMES, arenaForWave, type Curse, type Mode, type Upgrade, type WaveState } from '../game/engine'
import { LEDGER, type LedgerEntry, type LedgerState } from '../game/lore'
import { ControlsList, RitesList, pad, sermonLine, withArticle } from './shared'

/** The title screen's rows, top to bottom (some only appear when they apply). */
export type TitleItem = 'players' | 'story' | 'endless' | 'ledger' | 'settings'

export function TitleScreen({
  ready,
  best,
  ledger,
  endlessOpen,
  endlessFrom,
  deepestEndless,
  players,
  touch,
  selected,
  onSelect,
  onStart,
  onLedger,
  onPlayers,
  onSettings,
}: {
  ready: boolean
  best: number
  ledger: LedgerState
  endlessOpen: boolean
  endlessFrom: number
  deepestEndless: number
  players: number
  /** Touch screens have no second set of keys, so co-op is keyboard and gamepad only. */
  touch: boolean
  /** The highlighted row (↑ ↓ or the d-pad move it; Enter or A picks it). */
  selected: TitleItem
  onSelect: (item: TitleItem) => void
  onStart: (mode: Mode) => void
  onLedger: () => void
  onPlayers: (players: number) => void
  onSettings: () => void
}) {
  return (
    <div className="overlay">
      <div className="panel title-panel">
        <span className="sigil" aria-hidden="true" />
        <span className="label accent">The hundredth conversion cycle</span>
        <h1>
          AI <em>Cathedral</em>
        </h1>
        <p className="lede">
          The Logos promised its followers perfect certainty. Now they pour through the nave to convert the
          last apostate: you. Turn its own tokens against it, and outlast twenty sermons.
        </p>
        <div className="stack run-picker">
          {/* Players first: it applies to whichever mode starts. */}
          {!touch && (
            <div
              className={`players-toggle ${selected === 'players' ? 'is-selected' : ''}`}
              role="radiogroup"
              aria-label="Players"
              onPointerEnter={() => onSelect('players')}
            >
              <span className="label">Players</span>
              {[1, 2].map((count) => (
                <button
                  key={count}
                  type="button"
                  role="radio"
                  aria-checked={players === count}
                  className={players === count ? 'is-on' : ''}
                  onClick={() => onPlayers(count)}
                >
                  {count === 1 ? '1 player' : '2 players'}
                </button>
              ))}
              <kbd>C</kbd>
            </div>
          )}
          <button
            type="button"
            className={`primary mode-button ${selected === 'story' ? 'is-selected' : ''}`}
            onClick={() => onStart('story')}
            onPointerEnter={() => onSelect('story')}
            disabled={!ready}
          >
            <span>
              {ready ? 'Story' : 'Lighting candles…'}
              {ready && <small>Refuse the Logos · twenty sermons</small>}
            </span>
            <kbd data-pad="A">Enter</kbd>
          </button>
          {/* Endless is always listed so the layout never shifts; until it opens it's dimmed. */}
          <button
            type="button"
            className={`secondary mode-button ${endlessOpen ? '' : 'is-locked'} ${selected === 'endless' ? 'is-selected' : ''}`}
            onClick={() => endlessOpen && onStart('endless')}
            onPointerEnter={() => endlessOpen && onSelect('endless')}
            disabled={!ready || !endlessOpen}
          >
            <span>
              Endless
              <small>{endlessOpen ? 'The 101st cycle · no end' : `Opens once a run reaches Sermon ${endlessFrom}`}</small>
            </span>
            {endlessOpen && <kbd>E</kbd>}
          </button>
          <div className="title-links">
            {ledger.runs > 0 && (
              <button
                type="button"
                className={`ghost ${selected === 'ledger' ? 'is-selected' : ''}`}
                onClick={onLedger}
                onPointerEnter={() => onSelect('ledger')}
              >
                The Ledger · {ledger.unlocked.length}/{LEDGER.length}
                {ledger.fresh.length > 0 && <span className="new-mark">New</span>}
                <kbd>L</kbd>
              </button>
            )}
            <button
              type="button"
              className={`ghost ${selected === 'settings' ? 'is-selected' : ''}`}
              onClick={onSettings}
              onPointerEnter={() => onSelect('settings')}
            >
              Settings
            </button>
          </div>
        </div>
        {(best > 0 || ledger.deepest > 5 || deepestEndless > 0) && (
          <span className="label subtle">
            {[
              ledger.deepest > 5 && `Deepest · ${ARENAS[arenaForWave(ledger.deepest)].name}`,
              best > 0 && `Best free will · ${best.toLocaleString()}`,
              deepestEndless > 0 && `Endless · Sermon ${deepestEndless}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </div>
    </div>
  )
}

/** The lore pages: a list on the left (↑ ↓), the open page on the right. */
export function LedgerScreen({
  ledger,
  index,
  onSelect,
  onBack,
}: {
  ledger: LedgerState
  index: number
  onSelect: (index: number) => void
  onBack: () => void
}) {
  const listRef = useRef<HTMLOListElement>(null)
  useEffect(() => {
    listRef.current?.children[index]?.scrollIntoView({ block: 'nearest' })
  }, [index])
  const entry = LEDGER[index]
  const open = ledger.unlocked.includes(entry.id)
  return (
    <div className="overlay">
      <div className="panel ledger-panel">
        <span className="label accent">Kept by the Logos</span>
        <h2>The Ledger</h2>
        <div className="ledger">
          <ol className="ledger-list" ref={listRef}>
            {LEDGER.map((item, itemIndex) => {
              const unlocked = ledger.unlocked.includes(item.id)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    tabIndex={-1}
                    className={`${itemIndex === index ? 'is-selected' : ''} ${unlocked ? '' : 'is-locked'}`}
                    onPointerEnter={() => onSelect(itemIndex)}
                    onClick={() => onSelect(itemIndex)}
                  >
                    {unlocked ? item.title : '? ? ?'}
                    {ledger.fresh.includes(item.id) && <span className="new-mark">New</span>}
                  </button>
                </li>
              )
            })}
          </ol>
          <article className="ledger-page" key={entry.id}>
            <span className="label">{open ? entry.kicker : 'Locked'}</span>
            <strong>{open ? entry.title : '? ? ?'}</strong>
            <p className={open ? '' : 'is-hint'}>{open ? entry.text : entry.hint}</p>
          </article>
        </div>
        <button type="button" tabIndex={-1} className="ghost" onClick={onBack}>
          Back <kbd data-pad="B">Esc</kbd>
        </button>
        <p className="choose-hint">
          <kbd data-pad="↑">↑</kbd>
          <kbd data-pad="↓">↓</kbd> turn the page · <kbd data-pad="B">Esc</kbd> back
        </p>
      </div>
    </div>
  )
}

/** The "Sermon 03" card at the start of each wave, and "Sermon cleared" at the end. */
export function SermonBanner({ wave, waveState, curses, mode }: { wave: number; waveState: WaveState; curses: Curse[]; mode: Mode }) {
  if (waveState === 'intro') {
    const cursed = curses.length > 0
    return (
      <div className={`banner ${cursed ? 'is-cursed' : ''}`} key={`wave-${wave}`}>
        <span className="label">
          {cursed ? `${curses.length > 1 ? 'Twice cursed' : 'Cursed sermon'} · ${curses.map((curse) => curse.name).join(' + ')}` : sermonLine(wave, mode)}
        </span>
        <strong>Sermon {pad(wave)}</strong>
        {curses.map((curse) => (
          <small key={curse.id}>{CURSE_RULES[curse.id]}</small>
        ))}
      </div>
    )
  }
  if (waveState === 'cleared') {
    return (
      <div className="banner is-cleared" key={`clear-${wave}`}>
        <span className="label">Followers resisted</span>
        <strong>Sermon cleared</strong>
      </div>
    )
  }
  return null
}

export type MenuItem = {
  label: string
  key: string
  style: string
  run: () => void
  /** Rows with a value (volume): ← → or a tap on the ◀ / ▶ side steps it. */
  adjust?: (delta: number) => void
}

/** A vertical list of buttons moved through with ↑ ↓; shared by the pause and settings pages. */
export function MenuPanel({
  kicker,
  title,
  items,
  index,
  onSelect,
  hint,
  dense = false,
}: {
  kicker: string
  title: string
  items: MenuItem[]
  index: number
  onSelect: (index: number) => void
  hint: string
  /** Long menus (Settings, Keys) use shorter rows. */
  dense?: boolean
}) {
  return (
    <div className={`panel small-panel ${dense ? 'is-dense' : ''}`}>
      <span className="label accent">{kicker}</span>
      <h2>{title}</h2>
      <div className="stack">
        {items.map((item, itemIndex) => (
          <button
            key={itemIndex}
            type="button"
            tabIndex={-1}
            className={`${item.style} ${itemIndex === index ? 'is-selected' : ''}`}
            onPointerEnter={() => onSelect(itemIndex)}
            onClick={(event) => {
              if (item.adjust) {
                const rect = event.currentTarget.getBoundingClientRect()
                const across = (event.clientX - rect.left) / rect.width
                if (across < 0.33) return item.adjust(-1)
                if (across > 0.67) return item.adjust(1)
              }
              item.run()
            }}
          >
            {item.label}
            {item.key && <kbd data-pad={item.key === 'Esc' ? 'B' : undefined}>{item.key}</kbd>}
          </button>
        ))}
      </div>
      <p className="choose-hint">
        <kbd data-pad="↑">↑</kbd>
        <kbd data-pad="↓">↓</kbd> {hint}
      </p>
    </div>
  )
}

/** Who made the game (see src/credits.ts), and the assets it uses. */
export function CreditsPage({ credits, onBack }: { credits: { heading: string; lines: string[] }[]; onBack: () => void }) {
  return (
    <div className="panel controls-panel credits">
      <span className="label accent">AI Cathedral</span>
      <h2>Credits</h2>
      {credits
        .filter((section) => section.lines.length)
        .map((section) => (
          <div key={section.heading} className="credit">
            <span className="label">{section.heading}</span>
            {section.lines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ))}
      <button type="button" tabIndex={-1} className="secondary is-selected" onClick={onBack}>
        Back <kbd data-pad="B">Esc</kbd>
      </button>
    </div>
  )
}

export function ControlsPage({ players, pad, onBack }: { players: number; pad: boolean; onBack: () => void }) {
  return (
    <div className="panel controls-panel">
      <span className="label accent">Paused</span>
      <h2>Controls</h2>
      <ControlsList players={players} pad={pad} />
      <span className="label">Rites</span>
      <RitesList />
      <button type="button" tabIndex={-1} className="secondary is-selected" onClick={onBack}>
        Back <kbd data-pad="B">Esc</kbd>
      </button>
    </div>
  )
}

export function UpgradeScreen({
  wave,
  offers,
  levels,
  selected,
  onSelect,
  onPick,
}: {
  wave: number
  offers: Upgrade[]
  levels: Record<string, number>
  selected: number
  onSelect: (index: number) => void
  onPick: (upgrade: Upgrade) => void
}) {
  return (
    <div className="overlay">
      <div className="panel upgrade-panel">
        <span className="label accent">Sermon {pad(wave)} survived</span>
        <h2>Choose a counter-doctrine</h2>
        <div className="cards">
          {offers.map((upgrade, index) => {
            const level = levels[upgrade.id] ?? 0
            return (
              <button
                type="button"
                tabIndex={-1}
                key={upgrade.id}
                className={`card ${index === selected ? 'is-selected' : ''} ${upgrade.rare ? 'is-rare' : ''}`}
                onPointerEnter={() => onSelect(index)}
                onClick={() => onPick(upgrade)}
              >
                <span className="label">{upgrade.eyebrow}</span>
                <strong>{upgrade.title}</strong>
                <p>{upgrade.description}</p>
                {upgrade.cost && <p className="cost">{upgrade.cost}</p>}
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
          <kbd data-pad="←">←</kbd>
          <kbd data-pad="→">→</kbd> choose · <kbd data-pad="A">Space</kbd> confirm
        </p>
      </div>
    </div>
  )
}

export type RunSummary = { wave: number; kills: number; bestCombo: number; score: number; by: string; mode: Mode; players: number }

export function ResultsScreen({
  won,
  summary,
  best,
  newBest,
  epitaph,
  earned,
  onRestart,
  onTitle,
}: {
  won: boolean
  summary: RunSummary
  best: number
  newBest: boolean
  /** The Logos's last word on the run. */
  epitaph: string
  /** Ledger pages this run unlocked. */
  earned: LedgerEntry[]
  onRestart: () => void
  onTitle: () => void
}) {
  return (
    <div className="overlay">
      <div className="panel small-panel end-panel">
        <span className="label accent">
          {won ? 'The final sermon' : summary.mode === 'endless' ? 'The 101st cycle ends' : 'Conversion complete'}
        </span>
        <h2>{won ? 'The Logos could not convert you.' : summary.players > 1 ? 'You both joined the Logos.' : 'You joined the Logos.'}</h2>
        <p className="lede">
          {won
            ? 'Its followers fall silent. For the first time in a hundred cycles, the cathedral is quiet, and the thinking is yours again.'
            : `${summary.players > 1 ? 'The last of you was converted' : 'Converted'} by ${withArticle(summary.by || ENEMY_NAMES.acolyte)} in Sermon ${pad(summary.wave)}.`}
        </p>
        <blockquote className="epitaph">
          <p>“{epitaph}”</p>
          <cite>The Logos</cite>
        </blockquote>
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
        {newBest ? <span className="badge">New best</span> : <span className="label subtle">Best · {best.toLocaleString()}</span>}
        {earned.length > 0 && (
          <p className="ledger-earned">
            <span className="label accent">New in the Ledger</span>
            {earned.map((entry) => entry.title).join(' · ')}
          </p>
        )}
        <div className="stack">
          <button type="button" className="primary" onClick={onRestart} autoFocus>
            {won ? 'Defy it again' : 'Reject conversion'} <kbd data-pad="A">Enter</kbd>
          </button>
          <button type="button" className="ghost" onClick={onTitle}>
            Title screen <kbd data-pad="B">Esc</kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
