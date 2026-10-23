import type { CSSProperties } from 'react'
import { MAX_WAVE, abilityMeta, type AbilityKey, type Game, type WaveState } from '../game/engine'
import type { ATLAS } from '../game/render'
import { AtlasIcon, DashIcon, pad } from './shared'

export const ABILITY_ORDER: AbilityKey[] = ['dash', 'seal', 'volley', 'mirror', 'glyph']

const ICONS: Partial<Record<AbilityKey, keyof typeof ATLAS>> = {
  seal: 'splat',
  volley: 'candelabra',
  mirror: 'mirrorA',
  glyph: 'skull',
}

/** A snapshot of the game for the HUD, refreshed ~15 times a second. */
export type HudState = {
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

export function readHud(g: Game): HudState {
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

type Props = {
  hud: HudState
  /** Rites that just fired, so their icons can flash. */
  flashing: ReadonlySet<AbilityKey>
  showPauseButton: boolean
  onPause: () => void
  onDash: () => void
}

/** Hollow Knight-style corner HUD: combo orb, health pips and rites; sermon and score up top. */
export function Hud({ hud, flashing, showPauseButton, onPause, onDash }: Props) {
  const healthFrac = Math.max(0, hud.hp / hud.maxHp)
  const waveFrac = hud.waveTotal ? hud.waveKills / hud.waveTotal : 0
  // Health is shown as blood-drop pips worth 20 HP each.
  const pipCount = Math.ceil(hud.maxHp / 20)
  const pipsFull = Math.ceil(hud.hp / 20)
  // The gold orb fills with the combo timer; its liquid spans sprite rows 3–36 and
  // drains a whole pixel row at a time.
  const orbFillTop = 3 + Math.round((1 - (hud.combo >= 2 ? hud.comboFrac : 0)) * 33)

  return (
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
                  className={`ability ${isReady ? 'is-ready' : ''} ${flashing.has(key) ? 'is-firing' : ''}`}
                  style={{ '--accent': meta.color } as CSSProperties}
                  onPointerDown={(event) => {
                    event.preventDefault()
                    if (key === 'dash') onDash()
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

      {showPauseButton && (
        <button type="button" tabIndex={-1} className="pause-button" onClick={onPause} aria-label="Pause">
          ❚❚
        </button>
      )}
    </div>
  )
}
