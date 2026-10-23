import type { CSSProperties } from 'react'
import { MAX_WAVE, REVIVE_TIME, abilityMeta, type AbilityKey, type Game, type Mode, type WaveState } from '../game/engine'
import { SPEAKER_NAMES, type Line } from '../game/narrator'
import { ABILITY_ORDER, RiteIcon, pad } from './shared'

/** One player's corner of the HUD. */
export type PlayerHud = {
  hp: number
  maxHp: number
  down: boolean
  /** 0–1 while being revived. */
  revive: number
  cooldowns: Record<AbilityKey, number>
  cooldownFrac: Record<AbilityKey, number>
}

/** A snapshot of the game for the HUD, refreshed ~15 times a second. */
export type HudState = {
  players: PlayerHud[]
  mode: Mode
  wave: number
  waveKills: number
  waveTotal: number
  waveState: WaveState
  score: number
  combo: number
  comboFrac: number
}

export function readHud(g: Game): HudState {
  return {
    players: g.players.map((p) => {
      const cooldownFrac = {} as Record<AbilityKey, number>
      for (const key of ABILITY_ORDER) cooldownFrac[key] = p.cooldowns[key] / g.cooldownMax[key]
      return { hp: Math.ceil(p.hp), maxHp: p.maxHp, down: p.down, revive: p.revive / REVIVE_TIME, cooldowns: { ...p.cooldowns }, cooldownFrac }
    }),
    mode: g.mode,
    wave: g.wave,
    waveKills: g.waveKills,
    waveTotal: g.waveTotal,
    waveState: g.waveState,
    score: g.score,
    combo: g.combo,
    comboFrac: Math.max(0, g.comboTimer / 2.8),
  }
}

type Props = {
  hud: HudState
  /** Rites that just fired (per player), so their icons can flash. */
  flashing: ReadonlySet<string>
  showPauseButton: boolean
  onPause: () => void
  onDash: () => void
}

/** Health pips and rite icons for one player. */
function PlayerStack({ player, index, flashing, onDash }: { player: PlayerHud; index: number; flashing: ReadonlySet<string>; onDash: () => void }) {
  const healthFrac = Math.max(0, player.hp / player.maxHp)
  // Health is shown as blood-drop pips worth 20 HP each.
  const pipCount = Math.ceil(player.maxHp / 20)
  const pipsFull = Math.ceil(player.hp / 20)
  return (
    <div className="corner-stack">
      {player.down ? (
        <div className="downed" aria-label={`Player ${index + 1} is down`}>
          <span>Converted · stand close to revive</span>
          <i style={{ transform: `scaleX(${player.revive})` }} />
        </div>
      ) : (
        <div className={`health-pips ${healthFrac < 0.3 ? 'is-low' : ''}`} aria-label={`Health ${player.hp} of ${player.maxHp}`}>
          {Array.from({ length: pipCount }, (_, pip) => (
            <i key={pip} className={pip < pipsFull ? 'is-full' : ''} />
          ))}
        </div>
      )}
      <div className="abilities">
        {ABILITY_ORDER.map((key) => {
          const meta = abilityMeta[key]
          const frac = player.cooldownFrac[key]
          const isReady = frac <= 0
          return (
            <button
              key={key}
              type="button"
              tabIndex={-1}
              className={`ability ${isReady ? 'is-ready' : ''} ${flashing.has(`${index}:${key}`) ? 'is-firing' : ''}`}
              style={{ '--accent': meta.color } as CSSProperties}
              onPointerDown={(event) => {
                event.preventDefault()
                if (key === 'dash' && index === 0) onDash()
              }}
              title={`${meta.label}: ${meta.does} ${meta.when}`}
            >
              <span className="ability-icon">
                <RiteIcon rite={key} />
              </span>
              <span className="ability-fill" style={{ transform: `scaleY(${frac})` }} />
              {!isReady && <span className="ability-timer">{Math.ceil(player.cooldowns[key])}</span>}
              {key === 'dash' && <span className="ability-key">{index ? '/' : '⇧'}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Hollow Knight-style corner HUD: combo orb, health pips and rites; sermon and score up top.
 * In co-op, player two's pips and rites sit in the top-right corner, under the score.
 */
export function Hud({ hud, flashing, showPauseButton, onPause, onDash }: Props) {
  const waveFrac = hud.waveTotal ? hud.waveKills / hud.waveTotal : 0
  // The gold orb fills with the combo timer; its liquid spans sprite rows 3–36 and
  // drains a whole pixel row at a time.
  const orbFillTop = 3 + Math.round((1 - (hud.combo >= 2 ? hud.comboFrac : 0)) * 33)
  const [first, second] = hud.players

  return (
    <div className={`hud ${second ? 'is-coop' : ''}`} aria-live="off">
      <div className="corner">
        <div className="orb" style={{ '--fill-top': `${orbFillTop}` } as CSSProperties} title="Combo">
          <span className="orb-fill" />
          <span className="orb-frame" />
          {hud.combo >= 2 && <b key={hud.combo}>×{hud.combo}</b>}
        </div>
        <PlayerStack player={first} index={0} flashing={flashing} onDash={onDash} />
      </div>
      {second && (
        <div className="corner is-right">
          <PlayerStack player={second} index={1} flashing={flashing} onDash={onDash} />
        </div>
      )}

      <div className="sermon-title">
        <span>
          Sermon {pad(hud.wave)}
          {hud.mode === 'story' && ` / ${MAX_WAVE}`}
        </span>
        <div className="sermon-progress">
          <i style={{ transform: `scaleX(${waveFrac})` }} />
        </div>
      </div>

      <strong className="score">{hud.score.toLocaleString()}</strong>

      {showPauseButton && (
        <button type="button" tabIndex={-1} className="pause-button" onClick={onPause} aria-label="Pause">
          ❚❚
        </button>
      )}
    </div>
  )
}

/** A line spoken during play: who says it, and the line. Fades on its own. */
export function SpokenLine({ line, paused }: { line: Line; paused: boolean }) {
  return (
    <p
      className={`spoken spoken-${line.speaker} ${paused ? 'is-paused' : ''}`}
      style={{ '--life': `${line.maxLife}s` } as CSSProperties}
      role="status"
    >
      <span>{SPEAKER_NAMES[line.speaker]}</span>
      {line.text}
    </p>
  )
}
