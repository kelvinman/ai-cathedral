import { ENEMY_NAMES, MAX_WAVE, isEliteWave } from '../game/engine'
import { ATLAS } from '../game/render'

export const pad = (value: number) => String(value).padStart(2, '0')

/** The line over each sermon's banner: who is joining, and when the bosses arrive. */
export function sermonLine(wave: number) {
  if (wave >= MAX_WAVE) return 'The Blood Model speaks'
  if (wave === 1) return `${ENEMY_NAMES.acolyte}s fill the nave`
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

export function AtlasIcon({ name, size = 34 }: { name: keyof typeof ATLAS; size?: number }) {
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

export function DashIcon() {
  return (
    <svg className="dash-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 6l6 6-6 6M12 6l6 6-6 6" />
    </svg>
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
