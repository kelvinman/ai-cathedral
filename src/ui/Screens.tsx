import { useEffect, useRef } from 'react'
import { ARENAS, CURSE_RULES, ENEMY_NAMES, arenaForWave, type Curse, type Mode, type Upgrade, type WaveState } from '../game/engine'
import { LEDGER, type LedgerEntry, type LedgerState } from '../game/lore'
import { ControlsList, RitesList, pad, sermonLine, withArticle } from './shared'

export function TitleScreen({
  ready,
  best,
  ledger,
  endlessOpen,
  endlessFrom,
  deepestEndless,
  players,
  touch,
  onStart,
  onLedger,
  onPlayers,
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
  onStart: (mode: Mode) => void
  onLedger: () => void
  onPlayers: (players: number) => void
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
            <div className="players-toggle" role="radiogroup" aria-label="Players">
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
          <button type="button" className="primary mode-button" onClick={() => onStart('story')} disabled={!ready} autoFocus>
            <span>
              {ready ? 'Story' : 'Lighting candles…'}
              {ready && <small>Refuse the Logos · twenty sermons</small>}
            </span>
            <kbd>Enter</kbd>
          </button>
          {endlessOpen ? (
            <button type="button" className="secondary mode-button" onClick={() => onStart('endless')} disabled={!ready}>
              <span>
                Endless
                <small>The 101st cycle · no end</small>
              </span>
              <kbd>E</kbd>
            </button>
          ) : (
            <span className="locked-mode">Endless opens once a run reaches Sermon {endlessFrom}</span>
          )}
          {ledger.runs > 0 && (
            <button type="button" className="ghost" onClick={onLedger}>
              The Ledger · {ledger.unlocked.length}/{LEDGER.length}
              {ledger.fresh.length > 0 && <span className="new-mark">New</span>}
              <kbd>L</kbd>
            </button>
          )}
        </div>
        {(best > 0 || ledger.deepest > 5) && (
          <span className="label subtle">
            {ledger.deepest > 5 && `Deepest · ${ARENAS[arenaForWave(ledger.deepest)].name}`}
            {ledger.deepest > 5 && best > 0 && ' · '}
            {best > 0 && `Best free will · ${best.toLocaleString()}`}
            {deepestEndless > 0 && ` · Endless · Sermon ${deepestEndless}`}
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
          Back <kbd>Esc</kbd>
        </button>
        <p className="choose-hint">
          <kbd>↑</kbd>
          <kbd>↓</kbd> turn the page · <kbd>Esc</kbd> back
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
}: {
  kicker: string
  title: string
  items: MenuItem[]
  index: number
  onSelect: (index: number) => void
  hint: string
}) {
  return (
    <div className="panel small-panel">
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
            {item.key && <kbd>{item.key}</kbd>}
          </button>
        ))}
      </div>
      <p className="choose-hint">
        <kbd>↑</kbd>
        <kbd>↓</kbd> {hint}
      </p>
    </div>
  )
}

export function ControlsPage({ players, onBack }: { players: number; onBack: () => void }) {
  return (
    <div className="panel controls-panel">
      <span className="label accent">Paused</span>
      <h2>Controls</h2>
      <ControlsList players={players} />
      <span className="label">Rites</span>
      <RitesList />
      <button type="button" tabIndex={-1} className="secondary is-selected" onClick={onBack}>
        Back <kbd>Esc</kbd>
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
          <kbd>←</kbd>
          <kbd>→</kbd> choose · <kbd>Space</kbd> confirm
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
            {won ? 'Defy it again' : 'Reject conversion'} <kbd>Enter</kbd>
          </button>
          <button type="button" className="ghost" onClick={onTitle}>
            Title screen
          </button>
        </div>
      </div>
    </div>
  )
}
