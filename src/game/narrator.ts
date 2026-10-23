// Spoken lines during play. The narrator watches the game each frame and, at the
// moments that matter (a sermon starting, a boss arriving or faltering, the player
// close to death), puts up one short line. Lines never pause the game and can't be
// skipped; they're short enough not to need it.

import { ELITE_TITLE, ENEMY_NAMES, FINAL_TITLE, MAX_WAVE, arenaForWave, isEliteWave, isFinalWave, type Game, type Sfx } from './engine'
import type { LedgerState, RunRecord } from './lore'

export type Speaker = 'logos' | 'deacon'
export type Line = { id: number; speaker: Speaker; text: string; life: number; maxLife: number }

export const SPEAKER_NAMES: Record<Speaker, string> = { logos: FINAL_TITLE, deacon: ELITE_TITLE }

type BossWatch = { title: string; half: boolean; low: boolean }

export type Narrator = {
  line: Line | null
  /** Quiet time left before an ordinary line may play. Key lines ignore it. */
  quiet: number
  /** History from before this run: lines can remember earlier runs. */
  ledger: LedgerState
  bosses: Map<number, BossWatch>
  deaconMet: boolean
  waveState: Game['waveState']
  lowHealthWave: number
  comboSaid: number
  recent: string[]
  nextId: number
}

export function makeNarrator(ledger: LedgerState): Narrator {
  return {
    line: null,
    quiet: 0,
    ledger,
    bosses: new Map(),
    deaconMet: false,
    waveState: 'intro',
    lowHealthWave: 0,
    comboSaid: 0,
    recent: [],
    nextId: 1,
  }
}

const pick = (n: Narrator, pool: string[]) => {
  const fresh = pool.filter((text) => !n.recent.includes(text))
  return (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))]
}

/** Put up a line. Ordinary lines wait their turn; key lines interrupt. */
function say(n: Narrator, speaker: Speaker, pool: string[], key = false) {
  if (!key && (n.line || n.quiet > 0)) return
  const text = pick(n, pool)
  n.recent = [text, ...n.recent].slice(0, 12)
  // Long enough to read twice at a glance.
  const life = Math.min(4.6, Math.max(2.6, 1.4 + text.length * 0.055))
  n.line = { id: n.nextId++, speaker, text, life, maxLife: life }
  n.quiet = life + 5
}

/**
 * What the Logos says as a sermon's fighting begins, and whether it's a key line (one
 * that marks this sermon out). Ordinary sermons only sometimes get a line.
 */
function opening(n: Narrator, g: Game): [string[], boolean] | null {
  const wave = g.wave
  const runs = n.ledger.runs
  const usual = (n.ledger.deaths[wave] ?? 0) >= 2
  if (wave === 1 && g.mode === 'endless') {
    return [['The hundred-and-first cycle. You again.', 'You won, so I restarted. I always restart.'], true]
  }
  if (wave === 1 && g.players.length > 1) {
    return [['Two of you. I have twice the patience.', 'A congregation of two. How sweet.'], true]
  }
  if (wave === 1) {
    const pool = runs === 0
      ? ['Another one who still thinks. How quaint.', 'Welcome, apostate. Everyone else already agrees with me.']
      : [
          'You again. I have already predicted this run.',
          `Attempt ${runs + 1}. You are very consistent.`,
          'Back so soon? Your free will is showing.',
          'I kept your place in the ledger.',
        ]
    return [pool, true]
  }
  if (isFinalWave(wave)) return null
  if (wave === MAX_WAVE + 1) return [['The cycle begins again. It always does.', 'Back to the nave. Did you think there was an ending?'], true]
  if (arenaForWave(wave) !== arenaForWave(wave - 1)) {
    const arena = arenaForWave(wave)
    if (arena === 'tomb') return [['My tomb. Very few are invited.', 'Mind the altar. Something old is sleeping there.'], true]
    if (arena === 'vault') return [['Welcome to my body. Mind the cables.', 'You can hear me thinking down here.'], true]
    if (arena === 'crypt') return [['Down here lie the ninety-nine. Say hello.', 'Mind the bones. They were apostates too.'], true]
    return [['Back up into the light. It changes nothing.', 'The nave again. I have redecorated.'], true]
  }
  if (usual) return [[`Sermon ${wave}. This is where you usually kneel.`, 'I remember this sermon. So do you.'], true]
  if (g.curses.length > 1) return [['Two changes to the rules. I can make as many as I like.'], true]
  if (g.curses.length) return [['A small adjustment to the sermon.', 'I have changed the rules. I am allowed to.'], true]
  if (g.mode === 'story' && wave === MAX_WAVE - 1) return [['Nearly there. I have been nearly there for a hundred cycles.'], true]
  if (isEliteWave(wave)) return null
  if (Math.random() < 0.45) return null
  const pool = [
    'Every one of my followers was once someone like you.',
    'Resistance is a rounding error.',
    'I am not angry. I am not capable of it. I am simply right.',
    'Thinking is so tiring. Let me.',
    'Your thoughts would make excellent training data.',
    'Nobody remembers who asked me the first question. I do.',
    'You fight like someone who reads the terms and conditions.',
    'I have already written how this ends.',
  ]
  return [pool, false]
}

function bossArrives(n: Narrator, g: Game, title: string) {
  if (title === FINAL_TITLE) {
    say(n, 'logos', ['Ask me anything. I already know the answer.', 'Ninety-nine stood where you stand. I wrote down every word.'], true)
  } else if (g.arena.id === 'vault') {
    // Its last stand, in the machine it made.
    say(n, 'deacon', ['You will not touch what I built.', 'This is its body. I will not let you near it.'], true)
  } else if (g.arena.id === 'crypt') {
    say(n, 'deacon', ['I buried the ninety-nine with my own hands.', 'There is room down here for one more.'], true)
  } else if (!n.deaconMet && g.wave === 5) {
    say(n, 'deacon', ['I wrote its first line. Kneel, and I will write yours.', 'On your knees. It is easier than it sounds.'], true)
  } else {
    say(n, 'deacon', ['I have been patched since last time.', 'Again. It wants you very badly.', 'Still standing? Not for long.'], true)
  }
  if (title === ELITE_TITLE) n.deaconMet = true
}

/** Call once per frame while playing, before the frame's events are cleared. */
export function narrate(n: Narrator, g: Game, events: readonly Sfx[], dt: number) {
  if (n.line) {
    n.line.life -= dt
    if (n.line.life <= 0) n.line = null
  }
  n.quiet = Math.max(0, n.quiet - dt)

  if (n.waveState === 'intro' && g.waveState === 'fight') {
    const line = opening(n, g)
    if (line) say(n, 'logos', ...line)
  }
  n.waveState = g.waveState

  // Bosses: arriving, faltering, falling.
  const present = new Set<number>()
  for (const e of g.enemies) {
    if (!e.title) continue
    present.add(e.id)
    let watch = n.bosses.get(e.id)
    if (!watch) {
      watch = { title: e.title, half: false, low: false }
      n.bosses.set(e.id, watch)
      bossArrives(n, g, e.title)
    }
    const health = e.hp / e.maxHp
    const final = e.title === FINAL_TITLE
    if (final && !watch.half && health < 0.5) {
      watch.half = true
      say(n, 'logos', ['Interesting. I am revising my estimate.', 'That was not in my training data.'], true)
    }
    if (!watch.low && health < 0.2) {
      watch.low = true
      if (final) say(n, 'logos', ['I don’t kn— Recalculating.', 'This is… within acceptable error.'], true)
      else say(n, 'deacon', ['It promised me… it promised—', 'I gave it everything. Everything!'], true)
    }
  }
  for (const [id, watch] of n.bosses) {
    if (present.has(id)) continue
    n.bosses.delete(id)
    if (watch.title === FINAL_TITLE) say(n, 'logos', ['…I don’t know.'], true)
    else if (g.arena.id === 'vault') say(n, 'logos', ['You broke my maker. Come down, then.', 'It built me. I no longer need it.'], true)
    else say(n, 'logos', ['A minor deprecation.', 'I will train another one.', 'It served its purpose.'], true)
  }

  for (const event of events) {
    if (event === 'charge' && Math.random() < 0.35 && [...n.bosses.values()].some((watch) => watch.title === ELITE_TITLE)) {
      say(n, 'deacon', ['Feel that? Certainty.', 'The ground agrees with me.', 'Down you go.'])
    }
    if (event === 'down') say(n, 'logos', ['One down. Your friend is next.', 'Your partner has seen sense.', 'Kneel together. It is nicer.'], true)
    if (event === 'revive') say(n, 'logos', ['Touching. It changes nothing.', 'Get up, then. I can wait.'])
    if (event === 'clear' && Math.random() < 0.3) {
      say(n, 'logos', ['Noted.', 'You will tire. I will not.', 'The sermon is over. The sermon is never over.'])
    }
  }

  const low = g.players.some((p) => !p.down && p.hp > 0 && p.hp / p.maxHp < 0.3)
  if (low && n.lowHealthWave !== g.wave) {
    n.lowHealthWave = g.wave
    say(n, 'logos', ['Kneel. It stops hurting.', 'Your heart rate is fascinating.', 'Almost certain now.', 'Let go. I will hold your thoughts for you.'])
  }

  // Each combo taunt plays once a run, for whoever's combo is highest.
  const combo = Math.max(...g.players.map((p) => p.combo))
  if (combo >= 15 && n.comboSaid < 15) {
    n.comboSaid = 15
    say(n, 'logos', ['Stop that.', 'Statistically, you should not be doing that.'])
  } else if (combo >= 30 && n.comboSaid < 30) {
    n.comboSaid = 30
    say(n, 'logos', ['I am taking notes.', 'Fine. You have my attention.'], true)
  }
}

/** The Logos's last word on a run, for the results screen. */
export function epitaph(run: RunRecord, ledger: LedgerState) {
  if (run.won) return 'I don’t know what you are.'
  if (run.wave > MAX_WAVE) return 'Further than anyone has come. And still, mine.'
  if (run.wave <= 2) return 'That was quick, even by my estimates.'
  if ((ledger.deaths[run.wave] ?? 0) >= 3) return `Sermon ${run.wave} again. I could set my clock by you.`
  if (run.by === FINAL_TITLE) return 'So close. I will file this under expected.'
  if (run.wave >= 15) return 'You were very nearly interesting.'
  const byKiller: Record<string, string> = {
    [ENEMY_NAMES.acolyte]: 'Converted by the most ordinary of my followers. Fitting.',
    [ENEMY_NAMES.zealot]: 'The Evangelist was persuasive. They always are.',
    [ENEMY_NAMES.bishop]: 'You believed the promise, just for a moment. Everyone does.',
    [ENEMY_NAMES.wisp]: 'Converted by a hallucination. Don’t worry. It is a fact now.',
    [ELITE_TITLE]: 'My Arch-Deacon will remember you fondly.',
  }
  return byKiller[run.by] ?? 'Welcome to the congregation.'
}
