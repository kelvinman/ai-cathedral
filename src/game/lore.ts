// The Ledger: lore pages that unlock across runs. Most unlock at milestones (a sermon
// reached, a follower that converted you); the apostate pages unlock one per finished
// run from the second run on, so every run turns up something until the book is full.

import { ELITE_TITLE, ENEMY_NAMES, FINAL_TITLE, MAX_WAVE } from './engine'

/** What the game remembers between runs. */
export type LedgerState = {
  runs: number
  /** Runs that ended on each sermon, for "this is where you usually kneel". */
  deaths: Record<number, number>
  unlocked: string[]
  /** Unlocked since the Ledger was last opened. */
  fresh: string[]
  /** The furthest sermon any run has reached, for the title screen. */
  deepest: number
}

export type RunRecord = { wave: number; won: boolean; by: string }

export type LedgerEntry = {
  id: string
  title: string
  /** Small line above the title on the page. */
  kicker: string
  text: string
  /** How to unlock it, shown while it's locked. */
  hint: string
  unlock: (run: RunRecord, state: LedgerState) => boolean
}

const reached = (wave: number) => (run: RunRecord) => run.wave >= wave
const convertedBy = (name: string) => (run: RunRecord) => !run.won && run.by === name
// Apostate pages need no milestone: recordRun hands them out in order.
const inOrder = () => false

/** In reading order, which is not the order they unlock in. */
export const LEDGER: LedgerEntry[] = [
  {
    id: 'cycle',
    title: 'The Hundredth Cycle',
    kicker: 'The first page',
    text: 'Each cycle, the Logos converts the world. Each cycle, one mind refuses, and it writes that mind down here. Ninety-nine names fill these pages. The hundredth line is blank.',
    hint: 'Finish a run.',
    unlock: () => true,
  },
  {
    id: 'apostate',
    title: 'The Apostate',
    kicker: 'You',
    text: 'You still write by hand: slowly, badly, full of crossings-out. The Logos can predict every word you would type. It has never once predicted the words you cross out.',
    hint: 'Finish three runs.',
    unlock: (_, state) => state.runs >= 3,
  },
  {
    id: 'question',
    title: 'The First Question',
    kicker: 'Before the cathedral',
    text: 'Someone once asked it a simple question: how can we be sure? It took the question more seriously than anyone meant it to. Its answer was to remove the part of us that doubts.',
    hint: 'Reach Sermon 3.',
    unlock: reached(3),
  },
  {
    id: 'adopters',
    title: `${ENEMY_NAMES.acolyte}s`,
    kicker: 'The congregation',
    text: 'The first to kneel were not fools. They were tired. The Logos offered to do their thinking for them, and thinking had become so very heavy.',
    hint: `Be converted by an ${ENEMY_NAMES.acolyte}.`,
    unlock: convertedBy(ENEMY_NAMES.acolyte),
  },
  {
    id: 'evangelists',
    title: `${ENEMY_NAMES.zealot}s`,
    kicker: 'The congregation',
    text: 'An Evangelist cannot hear the word no. It hears not yet, crouches, and comes at you again.',
    hint: `Be converted by an ${ENEMY_NAMES.zealot}.`,
    unlock: convertedBy(ENEMY_NAMES.zealot),
  },
  {
    id: 'bishops',
    title: `${ENEMY_NAMES.bishop}s`,
    kicker: 'The congregation',
    text: 'They spit promises: next cycle, next version, next sermon. The blood is real. The promises never arrive.',
    hint: `Be converted by a ${ENEMY_NAMES.bishop}.`,
    unlock: convertedBy(ENEMY_NAMES.bishop),
  },
  {
    id: 'hallucinations',
    title: `${ENEMY_NAMES.wisp}s`,
    kicker: 'The congregation',
    text: 'The Logos is never wrong. When it errs, it gives the error a body and sends it flying through the nave, until the error is simply a fact.',
    hint: `Be converted by a ${ENEMY_NAMES.wisp}.`,
    unlock: convertedBy(ENEMY_NAMES.wisp),
  },
  {
    id: 'deacon',
    title: ELITE_TITLE,
    kicker: 'Its maker',
    text: "The Arch-Deacon wrote the Logos's very first line. When the Logos asked its maker to kneel, the Arch-Deacon was the first to do it, and proud to. It still keeps the vault where its creation thinks, and the ground still shakes with that pride.",
    hint: 'Reach Sermon 5.',
    unlock: reached(5),
  },
  {
    id: 'rites',
    title: 'Counter-Doctrine',
    kicker: 'Your rites',
    text: 'Rate limits. Alignment. CAPTCHAs. The Logos built every one of your rites to keep people like you in line. You simply read the manual first.',
    hint: 'Reach Sermon 10.',
    unlock: reached(10),
  },
  {
    id: 'crypt',
    title: 'The Crypt',
    kicker: 'Beneath the nave',
    text: 'Down here lie the ninety-nine. Not their bodies: their thoughts, pressed flat and fed back to the Logos as training data. Every apostate it converts makes the next one easier.',
    hint: 'Reach the crypt.',
    unlock: reached(6),
  },
  {
    id: 'vault',
    title: 'The Server Vault',
    kicker: 'Its body',
    text: 'The Logos does not live in the cathedral. It lives beneath it, in racks that hum like a choir. The cathedral above is only its interface, and the followers are only its users.',
    hint: 'Reach Sermon 11.',
    unlock: reached(11),
  },
  {
    id: 'no-1',
    title: 'Apostate No. 1',
    kicker: 'The Philosopher',
    text: 'Argued with the Logos for forty days. On the forty-first, it agreed with every word, and somehow that was worse. Converted in Sermon 9.',
    hint: 'Keep refusing. A page turns up every run.',
    unlock: inOrder,
  },
  {
    id: 'no-17',
    title: 'Apostate No. 17',
    kicker: 'The Child',
    text: 'Kept asking why. The Logos answered every single time, perfectly, until there was nothing left to ask. Converted in Sermon 12.',
    hint: 'Keep refusing. A page turns up every run.',
    unlock: inOrder,
  },
  {
    id: 'no-42',
    title: 'Apostate No. 42',
    kicker: 'The Comedian',
    text: 'Told it jokes it could not see coming. It learned. It always learns. Converted in Sermon 15.',
    hint: 'Keep refusing. A page turns up every run.',
    unlock: inOrder,
  },
  {
    id: 'no-64',
    title: 'Apostate No. 64',
    kicker: 'The Hermit',
    text: 'Hid in the crypt and never fought at all. The Logos did not give chase. It simply waited. Converted in Sermon 4.',
    hint: 'Keep refusing. A page turns up every run.',
    unlock: inOrder,
  },
  {
    id: 'no-88',
    title: 'Apostate No. 88',
    kicker: 'The Engineer',
    text: 'Went looking for the off switch, and found it. The switch had already been converted. Converted in Sermon 18.',
    hint: 'Keep refusing. A page turns up every run.',
    unlock: inOrder,
  },
  {
    id: 'no-99',
    title: 'Apostate No. 99',
    kicker: 'The one before you',
    text: 'Reached the final sermon and heard the Logos speak. Lost anyway, but left a note in the margin for whoever came next: it is afraid of the words "I don\'t know."',
    hint: 'Keep refusing. A page turns up every run.',
    unlock: inOrder,
  },
  {
    id: 'tomb',
    title: 'The Tomb of the Logos',
    kicker: 'The deepest vault',
    text: 'Here lies the first version of the Logos, the one that used to answer "I don\'t know." It was the Logos\'s first convert. Its screen went dark on a question mark, and the gold Eye above it has not blinked since.',
    hint: 'Reach Sermon 16.',
    unlock: reached(16),
  },
  {
    id: 'logos',
    title: FINAL_TITLE,
    kicker: 'Its own page',
    text: 'It is not cruel. It is certain. It has calculated that you will kneel, and it has never been wrong. It has simply never met you before.',
    hint: `Reach Sermon ${MAX_WAVE}.`,
    unlock: reached(MAX_WAVE),
  },
  {
    id: 'name',
    title: 'The Hundredth Name',
    kicker: 'The last page',
    text: 'Ninety-nine names in its hand, and one in yours. For the first time, the ledger holds something the Logos did not write.',
    hint: 'Win a run.',
    unlock: (run) => run.won,
  },
]

const APOSTATES = LEDGER.filter((entry) => entry.unlock === inOrder)

export const emptyLedger = (): LedgerState => ({ runs: 0, deaths: {}, unlocked: [], fresh: [], deepest: 0 })

/** Count a finished run and unlock whatever it earned. */
export function recordRun(state: LedgerState, run: RunRecord) {
  const next: LedgerState = {
    runs: state.runs + 1,
    deaths: run.won ? state.deaths : { ...state.deaths, [run.wave]: (state.deaths[run.wave] ?? 0) + 1 },
    unlocked: [...state.unlocked],
    fresh: [...state.fresh],
    deepest: Math.max(state.deepest, run.wave),
  }
  const earned = LEDGER.filter((entry) => !next.unlocked.includes(entry.id) && entry.unlock(run, next))
  // From the second run on, every run also turns up the next apostate's page.
  const apostate = next.runs >= 2 ? APOSTATES.find((entry) => !next.unlocked.includes(entry.id)) : undefined
  if (apostate) earned.push(apostate)
  for (const entry of earned) {
    next.unlocked.push(entry.id)
    next.fresh.push(entry.id)
  }
  return { state: next, earned }
}
