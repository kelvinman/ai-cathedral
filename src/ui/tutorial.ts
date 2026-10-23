import type { AbilityKey, Game, Sfx } from '../game/engine'

// The first run's lessons: one hint at a time, each cleared by doing it. Firing and rites
// are automatic, so two lessons just point at what the game is already doing.

export type Device = 'keys' | 'pad' | 'touch'

type Lesson = {
  /** The hint, worded for the player's current device. */
  text: Record<Device, string>
  /** Done once the player has done it (or, for lessons that only explain, after a while). */
  done: (seen: Seen) => boolean
}

/** What has happened since the lesson started. */
export type Seen = {
  moved: number
  events: Set<Sfx>
  casts: Set<AbilityKey>
  dropped: boolean
  seconds: number
}

export const LESSONS: Lesson[] = [
  {
    text: { keys: 'Move with A and D, or the arrow keys.', pad: 'Move with the left stick.', touch: 'Move with ◀ and ▶.' },
    done: (seen) => seen.moved > 120,
  },
  {
    text: {
      keys: 'Jump with W or Space. Press it again in the air to jump twice.',
      pad: 'Jump with A. Press it again in the air to jump twice.',
      touch: 'Tap Jump, and again in the air to jump twice.',
    },
    done: (seen) => seen.events.has('airjump'),
  },
  {
    text: { keys: 'On a ledge, press S to drop through it.', pad: 'On a ledge, press down to drop through it.', touch: 'On a ledge, tap ▼ to drop through it.' },
    done: (seen) => seen.dropped,
  },
  {
    text: {
      keys: 'Your quill writes on its own, at the nearest follower. Your job is to stay alive.',
      pad: 'Your quill writes on its own, at the nearest follower. Your job is to stay alive.',
      touch: 'Your quill writes on its own, at the nearest follower. Your job is to stay alive.',
    },
    done: (seen) => seen.seconds > 6,
  },
  {
    text: {
      keys: 'Let them close in: your rites cast themselves when followers crowd you.',
      pad: 'Let them close in: your rites cast themselves when followers crowd you.',
      touch: 'Let them close in: your rites cast themselves when followers crowd you.',
    },
    done: (seen) => seen.casts.size > 0 && seen.seconds > 2,
  },
  {
    text: { keys: 'Step into a gate to come out of its twin.', pad: 'Step into a gate to come out of its twin.', touch: 'Step into a gate to come out of its twin.' },
    done: (seen) => seen.events.has('portal'),
  },
  {
    text: { keys: 'Dash through danger with Shift.', pad: 'Dash through danger with B.', touch: 'Tap Dash to slip through danger.' },
    done: (seen) => seen.casts.has('dash'),
  },
]

export type Tutorial = { lesson: number; seen: Seen; startX: number; finished: number }

export const startTutorial = (g: Game): Tutorial => ({ lesson: 0, seen: freshSeen(), startX: g.player.x, finished: 0 })

const freshSeen = (): Seen => ({ moved: 0, events: new Set(), casts: new Set(), dropped: false, seconds: 0 })

/** Track this frame, and move on to the next lesson once the current one is done. Returns true when it changed. */
export function advanceTutorial(t: Tutorial, g: Game, dt: number) {
  if (t.lesson >= LESSONS.length) {
    t.finished += dt
    return false
  }
  const p = g.player
  t.seen.seconds += dt
  t.seen.moved += Math.abs(p.x - t.startX)
  t.startX = p.x
  if (p.dropTimer > 0) t.seen.dropped = true
  for (const event of g.events) t.seen.events.add(event)
  for (const cast of g.casts) if (cast.player === 0) t.seen.casts.add(cast.ability)
  if (!LESSONS[t.lesson].done(t.seen)) return false
  t.lesson += 1
  t.seen = freshSeen()
  return true
}
