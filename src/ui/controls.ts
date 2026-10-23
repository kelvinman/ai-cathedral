import type { Action } from '../game/engine'

// Keys and gamepads. In single player every key below drives player one; in couch co-op
// player one keeps WASD and Space with left Shift, and player two takes the arrows with
// right Shift (or / and . on keyboards without one).

type Layout = Record<'left' | 'right' | 'down' | 'jump' | 'dash', string[]>
const LAYOUTS: Layout[] = [
  { left: ['KeyA'], right: ['KeyD'], down: ['KeyS'], jump: ['KeyW', 'Space'], dash: ['ShiftLeft'] },
  { left: ['ArrowLeft'], right: ['ArrowRight'], down: ['ArrowDown'], jump: ['ArrowUp'], dash: ['ShiftRight', 'Slash', 'Period'] },
]
const ALL = Object.fromEntries(
  (['left', 'right', 'down', 'jump', 'dash'] as const).map((name) => [name, LAYOUTS.flatMap((layout) => layout[name])]),
) as Layout

const ACTIONS: Record<string, Action> = Object.fromEntries([
  ...ALL.jump.map((code) => [code, 'jump'] as const),
  ...ALL.down.map((code) => [code, 'down'] as const),
  ...ALL.dash.map((code) => [code, 'dash'] as const),
])

/** Every key the game itself listens to while playing. */
export const GAME_KEYS = new Set(Object.values(ALL).flat())

/** The jump, drop or dash a key presses, if any. */
export const keyAction = (code: string): Action | undefined => ACTIONS[code]

/** Which player a game key belongs to (always player one in single player). */
export function keyPlayer(code: string, players: number) {
  if (players < 2) return 0
  return Object.values(LAYOUTS[1]).some((codes) => codes.includes(code)) ? 1 : 0
}

/** What a player is holding on the keyboard. */
export function heldKeys(held: ReadonlySet<string>, player: number, players: number) {
  const layout = players < 2 ? ALL : LAYOUTS[player]
  const any = (codes: string[]) => codes.some((code) => held.has(code))
  return { left: any(layout.left), right: any(layout.right), down: any(layout.down), jump: any(layout.jump) }
}

// ---------- Gamepads ----------

/** A pad's buttons this frame: held directions and jump, plus presses since last frame. */
export type PadReading = {
  player: number
  left: boolean
  right: boolean
  down: boolean
  jump: boolean
  pressed: Set<Action>
  /** Menu presses, as the keys they stand in for (ArrowUp, Enter, Escape…). */
  menu: string[]
}

const previous = new Map<number, Record<string, boolean>>()

/**
 * Standard-mapping pads: stick or d-pad to move, A to jump, B, X or a bumper to dash,
 * down to drop, Start to pause. In co-op a single pad joins as player two (the keyboard
 * is player one); with two pads, the first is player one and the second player two.
 */
export function readPads(players: number): PadReading[] {
  const pads = (navigator.getGamepads?.() ?? []).filter((pad): pad is Gamepad => Boolean(pad && pad.connected))
  return pads.map((pad, order) => {
    const button = (index: number) => Boolean(pad.buttons[index]?.pressed)
    const x = pad.axes[0] ?? 0
    const y = pad.axes[1] ?? 0
    const now = {
      left: button(14) || x < -0.45,
      right: button(15) || x > 0.45,
      up: button(12) || y < -0.6,
      down: button(13) || y > 0.6,
      jump: button(0),
      dash: button(1) || button(2) || button(4) || button(5),
      back: button(1),
      start: button(9),
    }
    const before = previous.get(pad.index) ?? {}
    previous.set(pad.index, now)
    const edge = (name: keyof typeof now) => now[name] && !before[name]
    const pressed = new Set<Action>()
    if (edge('jump')) pressed.add('jump')
    if (edge('dash')) pressed.add('dash')
    if (edge('down')) pressed.add('down')
    const menu: string[] = []
    if (edge('up')) menu.push('ArrowUp')
    if (edge('down')) menu.push('ArrowDown')
    if (edge('left')) menu.push('ArrowLeft')
    if (edge('right')) menu.push('ArrowRight')
    if (edge('jump')) menu.push('Enter')
    if (edge('back')) menu.push('Escape')
    if (edge('start')) menu.push('Start')
    const player = players < 2 ? 0 : pads.length === 1 ? 1 : Math.min(1, order)
    return { player, left: now.left, right: now.right, down: now.down, jump: now.jump, pressed, menu }
  })
}
