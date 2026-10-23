import { ENEMY_NAMES, MAX_WAVE, abilityMeta, isEliteWave, type AbilityKey } from '../game/engine'

export const pad = (value: number) => String(value).padStart(2, '0')

/** The line over each sermon's banner: who is joining, and when the bosses arrive. */
export function sermonLine(wave: number) {
  if (wave >= MAX_WAVE) return 'The Blood Model speaks'
  if (wave === 1) return `${ENEMY_NAMES.acolyte}s fill the nave`
  // Chapters change arena every five sermons (see arenaForWave).
  if (wave === 6) return 'Descend into the crypt'
  if (wave === 11) return 'Back up into the nave'
  if (wave === 16) return "Down to the Blood Model's tomb"
  if (wave === 2) return `${ENEMY_NAMES.zealot}s and ${ENEMY_NAMES.wisp}s join the sermon`
  if (wave === 5) return `The Arch-Deacon leads the ${ENEMY_NAMES.bishop}s in`
  if (isEliteWave(wave)) return 'The Arch-Deacon returns'
  if (wave === MAX_WAVE - 1) return 'The model is almost done thinking'
  return 'The model is thinking'
}

/** "an Evangelist", "a Hype Bishop", "the Arch-Deacon". */
export function withArticle(name: string) {
  if (name.startsWith('The ')) return `the ${name.slice(4)}`
  return `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`
}

export const ABILITY_ORDER: AbilityKey[] = ['dash', 'seal', 'volley', 'mirror', 'glyph']

/** Pixel icon for a rite (or the dash), drawn to match its effect in the arena. */
export function RiteIcon({ rite }: { rite: AbilityKey }) {
  return <span className={`rite-icon rite-${rite}`} aria-hidden="true" />
}

/** Each rite with what it does and what sets it off: for the Controls page. */
export function RitesList() {
  return (
    <ul className="rites">
      {ABILITY_ORDER.map((key) => {
        const meta = abilityMeta[key]
        return (
          <li key={key}>
            <RiteIcon rite={key} />
            <div>
              <strong>{meta.label}</strong>
              <span>{meta.does}</span>
              <small>{meta.when}</small>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Shown the first time each rite casts itself, so players learn what it was. */
export function RiteTip({ rite }: { rite: AbilityKey }) {
  const meta = abilityMeta[rite]
  return (
    <div className="panel rite-tip" key={rite} role="status">
      <RiteIcon rite={rite} />
      <div>
        <strong>{meta.label}</strong>
        <span>{meta.does}</span>
        <small>{meta.when}</small>
      </div>
    </div>
  )
}

/** The four inputs, plus a reminder that firing and rites are automatic. */
export function ControlsList() {
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
