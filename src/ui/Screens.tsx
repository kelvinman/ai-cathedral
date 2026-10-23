import { CURSE_RULES, ENEMY_NAMES, type Curse, type Upgrade, type WaveState } from '../game/engine'
import { ControlsList, RitesList, pad, sermonLine, withArticle } from './shared'

export function TitleScreen({ ready, best, onStart }: { ready: boolean; best: number; onStart: () => void }) {
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
        <button type="button" className="primary" onClick={onStart} disabled={!ready} autoFocus>
          {ready ? 'Refuse the Logos' : 'Lighting candles…'}
          <kbd>Enter</kbd>
        </button>
        {best > 0 && <span className="label subtle">Best free will · {best.toLocaleString()}</span>}
      </div>
    </div>
  )
}

/** The "Sermon 03" card at the start of each wave, and "Sermon cleared" at the end. */
export function SermonBanner({ wave, waveState, curse }: { wave: number; waveState: WaveState; curse: Curse | null }) {
  if (waveState === 'intro') {
    return (
      <div className={`banner ${curse ? 'is-cursed' : ''}`} key={`wave-${wave}`}>
        <span className="label">{curse ? `Cursed sermon · ${curse.name}` : sermonLine(wave)}</span>
        <strong>Sermon {pad(wave)}</strong>
        {curse && <small>{CURSE_RULES[curse.id]}</small>}
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

export function ControlsPage({ onBack }: { onBack: () => void }) {
  return (
    <div className="panel controls-panel">
      <span className="label accent">Paused</span>
      <h2>Controls</h2>
      <ControlsList />
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
                className={`card ${index === selected ? 'is-selected' : ''}`}
                onPointerEnter={() => onSelect(index)}
                onClick={() => onPick(upgrade)}
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
  )
}

export type RunSummary = { wave: number; kills: number; bestCombo: number; score: number; by: string }

export function ResultsScreen({
  won,
  summary,
  best,
  newBest,
  onRestart,
  onTitle,
}: {
  won: boolean
  summary: RunSummary
  best: number
  newBest: boolean
  onRestart: () => void
  onTitle: () => void
}) {
  return (
    <div className="overlay">
      <div className="panel small-panel end-panel">
        <span className="label accent">{won ? 'The final sermon' : 'Conversion complete'}</span>
        <h2>{won ? 'The Logos could not convert you.' : 'You joined the Logos.'}</h2>
        <p className="lede">
          {won
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
        {newBest ? <span className="badge">New best</span> : <span className="label subtle">Best · {best.toLocaleString()}</span>}
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
