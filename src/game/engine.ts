// Simulation for The Last Apostate. Pure data + a fixed-step `step` function;
// rendering, audio and React only read from the Game object.

export const W = 1280
export const H = 720
export const GROUND_Y = 640
/** The run ends here: sermon 20 is the Logos's own. */
export const MAX_WAVE = 20

export type Phase = 'title' | 'playing' | 'paused' | 'upgrade' | 'dead' | 'won'
/** Story ends with the Logos at sermon 20; endless keeps going, chapter after chapter. */
export type Mode = 'story' | 'endless'
export type Difficulty = 'doubter' | 'apostate' | 'heretic'

/** How hard a run is, set before it starts. Apostate is the game as balanced; the others
 *  scale follower health, the damage you take, how many come each sermon, and how often
 *  bosses act (below 1 is faster). */
export const DIFFICULTIES: Record<Difficulty, { name: string; hint: string; hp: number; damage: number; count: number; bossPace: number }> = {
  doubter: { name: 'Doubter', hint: 'Fewer, weaker followers. They hit softer.', hp: 0.8, damage: 0.7, count: 0.85, bossPace: 1.15 },
  apostate: { name: 'Apostate', hint: 'The game as it was made.', hp: 1, damage: 1, count: 1, bossPace: 1 },
  heretic: { name: 'Heretic', hint: 'More, tougher followers. They hit harder.', hp: 1.2, damage: 1.25, count: 1.1, bossPace: 0.85 },
}
export type WaveState = 'intro' | 'fight' | 'cleared'
export type EnemyKind = 'acolyte' | 'zealot' | 'bishop' | 'wisp'
export type AbilityKey = 'dash' | 'seal' | 'volley' | 'mirror' | 'glyph'
/** The only things the player presses: everything else (firing, rites) is automatic. */
export type Action = 'jump' | 'down' | 'dash'
export type Sfx =
  | 'shoot'
  | 'hit'
  | 'kill'
  | 'hurt'
  | 'jump'
  | 'airjump'
  | 'land'
  | 'dash'
  | 'seal'
  | 'volley'
  | 'mirror'
  | 'glyph'
  | 'trap'
  | 'pickup'
  | 'wave'
  | 'clear'
  | 'spawn'
  | 'ward'
  | 'death'
  | 'portal'
  | 'spit'
  | 'charge'
  | 'slam'
  | 'down'
  | 'revive'

export type Point = { x: number; y: number }
export type Platform = { x: number; y: number; w: number }

/** Bodies are anchored at the feet: (x, y) is bottom-center. */
type Body = Point & {
  vx: number
  vy: number
  w: number
  h: number
  onGround: boolean
  onPlatform: boolean
  dropTimer: number
  /** Index of the portal the body just arrived through; it must step off before reusing it. */
  portalLock: number
}

export type Player = Body & {
  hp: number
  maxHp: number
  facing: 1 | -1
  invuln: number
  shield: number
  coyote: number
  jumpBuffer: number
  airJumps: number
  dashTime: number
  dashDir: number
  dashHits: Set<number>
  ghostTimer: number
  fireTimer: number
  squash: number
  runPhase: number
  /** 0 for player one, 1 for player two in couch co-op. */
  index: number
  /** Counts down after taking a hit: the renderer shows a recoil. */
  hurtTime: number
  /** Each player's own combo: kills in quick succession, broken when they're hit. */
  combo: number
  comboTimer: number
  /** Each player's own dash and rite timers (how long they take is shared: cooldownMax). */
  cooldowns: Record<AbilityKey, number>
  /** The surface this player last stood on, for follower pathfinding. */
  surface: number
  /** Converted, but not out: kneeling until a partner stands close for REVIVE_TIME. */
  down: boolean
  revive: number
}

export type Enemy = Body & {
  id: number
  kind: EnemyKind
  elite: boolean
  hp: number
  maxHp: number
  speed: number
  damage: number
  kbResist: number
  score: number
  flash: number
  slow: number
  rooted: number
  stun: number
  jumpCd: number
  lunge: number
  /** Mid-air in a climbing leap: steering is locked until it lands. */
  leaping: boolean
  /** Index into the arena's surfaces of the floor or ledge it last stood on (-1 before landing). */
  surface: number
  /** Wisps only: time until the next blood spit. */
  spitCd: number
  touchCd: number
  facing: 1 | -1
  /** 1 → 0 over a turn, so the renderer can squash the sprite through the flip. */
  turn: number
  turnHold: number
  /** Evangelists crouch for this long before lunging, so the charge can be read and dodged. */
  windup: number
  windupDir: number
  /** Bosses: time to the next attack, a telegraph countdown, and the attack queue position. */
  bossTimer: number
  bossCharge: number
  bossMove: number
  /** Bosses: slam the ground when this jump lands. */
  slamOnLanding: boolean
  phase: number
  scale: number
  /** Which player hit it last: a kill builds that player's combo. */
  lastHitBy: number
  /** Counts down after a hit: the renderer rocks it back away from the blow. */
  flinch: number
  flinchDir: number
  /** Nameplate for bosses. */
  title?: string
}

export type Bolt = Point & {
  /** The player who fired it. */
  owner: number
  /** A split-off bolt (doesn't split again). */
  child?: boolean
  /** Jumps left to another follower. */
  chain: number
  vx: number
  vy: number
  /** The letter this token is drawn as. */
  glyph: string
  life: number
  damage: number
  pierce: number
  hit: Set<number>
  trail: Point[]
}
/** Rite zones remember who cast them, so their kills count toward that player's combo. */
export type Seal = Point & { r: number; life: number; maxLife: number; owner: number }
/**
 * The CAPTCHA wall: warped letters standing on the floor. A follower that reaches it stops to
 * solve it (it's rooted while the wall stands), and the wall crumbles a few seconds later.
 */
export type Glyph = Point & { r: number; life: number; arm: number; fired: boolean; owner: number; text: string }
export type Particle = Point & {
  /** Sparks draw as short streaks along their motion; everything else as a square. */
  spark?: boolean
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
  gravity: number
  drag: number
  glow: boolean
}
export type FloatText = Point & { text: string; color: string; life: number; maxLife: number; size: number }
export type Pickup = Body & { life: number; heal: number }
export type SpawnMark = Point & { kind: EnemyKind; elite: boolean; timer: number; maxTimer: number }
/** Blood spat by wisps: slow, glowing, and worth jumping or dashing over. */
export type Spit = Point & {
  vx: number
  vy: number
  life: number
  /**
   * What flies at you: a Hallucination's glitch shard, a Hype Bishop's slow gold promise, or
   * the Logos's own words. A 'wave' is a slam's cracked-stone shockwave that rolls along one
   * ledge or the floor.
   */
  kind: 'shard' | 'promise' | 'word' | 'wave' | 'wrench'
  /** Waits this long (flickering where it will fall from) before it moves: the Logos's word rain. */
  delay?: number
  /** Words only: the letter drawn. */
  glyph?: string
  damage: number
  by: string
  /** Waves stop at the edges of the surface they were slammed on. */
  minX?: number
  maxX?: number
}
/**
 * A follower in its last moment: knocked back, then de-rendered from the top down in a line
 * of light (they were only ever data). Drawn from the follower's own frame.
 */
export type Corpse = Point & {
  kind: EnemyKind
  elite: boolean
  final: boolean
  facing: 1 | -1
  scale: number
  h: number
  /** Which way the killing blow pushed it. */
  dir: number
  life: number
  maxLife: number
}

export type Ghost = Point & { facing: 1 | -1; life: number; player?: number }
export type Stain = Point & { r: number; life: number }

export type Stats = {
  moveSpeed: number
  damage: number
  fireRate: number
  boltSpeed: number
  pierce: number
  multishot: number
  volleyCount: number
  sealRadius: number
  shieldDuration: number
  lifesteal: number
  maxAirJumps: number
  /** Build-changing upgrades. */
  split: boolean
  chain: number
  dashVolley: boolean
  /** Random aim wobble, in radians. */
  spread: number
  damageTaken: number
  reflect: boolean
}

export type Upgrade = {
  id: string
  eyebrow: string
  title: string
  description: string
  /** The catch, for upgrades that trade something away. */
  cost?: string
  /** Changes how a run plays, not just its numbers; offered more often, shown in gold. */
  rare?: boolean
  max: number
  apply: (g: Game) => void
}

export type Input = {
  left: boolean
  right: boolean
  down: boolean
  jumpHeld: boolean
  pressed: Set<Action>
}

export type Game = {
  phase: Phase
  mode: Mode
  difficulty: Difficulty
  time: number
  /** Player one; the same object as players[0]. */
  player: Player
  /** One or two players. Upgrades and stats are shared by the team. */
  players: Player[]
  enemies: Enemy[]
  bolts: Bolt[]
  seals: Seal[]
  glyphs: Glyph[]
  particles: Particle[]
  texts: FloatText[]
  pickups: Pickup[]
  marks: SpawnMark[]
  ghosts: Ghost[]
  corpses: Corpse[]
  stains: Stain[]
  spits: Spit[]
  cooldownMax: Record<AbilityKey, number>
  stats: Stats
  levels: Record<string, number>
  offers: Upgrade[]
  wave: number
  waveState: WaveState
  waveTimer: number
  waveTotal: number
  spawned: number
  waveKills: number
  spawnTimer: number
  score: number
  kills: number
  bestCombo: number
  trauma: number
  hitstop: number
  hurtFlash: number
  nextId: number
  events: Sfx[]
  /** Dashes and rites cast this frame, and by whom, for the HUD. Cleared by the caller. */
  casts: { player: number; ability: AbilityKey }[]
  /** Who landed the last hit, for the 'Converted by…' line on the results screen. */
  lastHurtBy: string
  /** This sermon's twists: none, one, or (deep into endless) two at once. */
  curses: Curse[]
  /** Where this sermon is fought. */
  arena: Arena
}

/** Widths are whole multiples of the 60px brick block the renderer tiles them with. */
export const BRICK = { w: 60, h: 34 }

/**
 * Pentagram gates: stepping into one sends you out of its partner. Pairs cross the room.
 * Every arena lists them in the same order (red floor, red ledge, blue floor, blue ledge),
 * which the Crossed Wires curse relies on.
 */
export type Portal = Point & { pair: number; color: 'red' | 'blue' }
/**
 * A light source. Candelabras stand on ledges or wall sconces (`shelf`); braziers burn on
 * ledges; the vault's caged lamps (`lamp`) hang from the ceiling and glow teal.
 */
export type Candle = Point & { shelf?: boolean; brazier?: boolean; lamp?: boolean }

export type ArenaId = 'cathedral' | 'crypt' | 'vault' | 'tomb'
export type Arena = {
  id: ArenaId
  name: string
  platforms: Platform[]
  /** The floor followed by every ledge: what follower pathfinding walks between. */
  surfaces: Platform[]
  candles: Candle[]
  portals: Portal[]
}

function arena(id: ArenaId, name: string, platforms: Platform[], candles: Candle[], portals: Portal[]): Arena {
  return { id, name, platforms, surfaces: [{ x: -100, y: GROUND_Y, w: W + 200 }, ...platforms], candles, portals }
}

export const ARENAS: Record<ArenaId, Arena> = {
  cathedral: arena(
    'cathedral',
    'The Nave',
    [
      { x: 90, y: 530, w: 240 },
      { x: 950, y: 530, w: 240 },
      { x: 490, y: 430, w: 300 },
      { x: 170, y: 320, w: 240 },
      { x: 870, y: 320, w: 240 },
      { x: 520, y: 212, w: 240 },
    ],
    // Candles flank the windows on wall sconces, centred on each window's height. `y` is
    // where the candelabra stands (the top of its shelf); the flames sit ~14px above.
    [
      // Arched windows (upper side bays, y 84–204).
      { x: 150, y: 158, shelf: true },
      { x: 286, y: 158, shelf: true },
      { x: 994, y: 158, shelf: true },
      { x: 1130, y: 158, shelf: true },
      // Mirrors (lower side bays, centred at y 444).
      { x: 150, y: 458, shelf: true },
      { x: 286, y: 458, shelf: true },
      { x: 994, y: 458, shelf: true },
      { x: 1130, y: 458, shelf: true },
      // Rose window (centred at y 118).
      { x: 512, y: 132, shelf: true },
      { x: 768, y: 132, shelf: true },
      // Lancet window over the centre ledge (centred at y 360).
      { x: 572, y: 374, shelf: true },
      { x: 708, y: 374, shelf: true },
    ],
    [
      // Floor gates under the centre ledge, where there is headroom.
      { x: 547, y: GROUND_Y, pair: 1, color: 'red' },
      { x: 910, y: 320, pair: 0, color: 'red' },
      { x: 733, y: GROUND_Y, pair: 3, color: 'blue' },
      { x: 370, y: 320, pair: 2, color: 'blue' },
    ],
  ),
  // The crypt: low shelves along the walls, a sarcophagus in the middle, stepping stones up
  // to a bridge, and high alcoves in the corners. Every ledge is one jump from another.
  crypt: arena(
    'crypt',
    'The Crypt',
    [
      { x: 60, y: 540, w: 300 },
      { x: 920, y: 540, w: 300 },
      { x: 490, y: 500, w: 300 },
      { x: 260, y: 400, w: 180 },
      { x: 840, y: 400, w: 180 },
      { x: 520, y: 300, w: 240 },
      { x: 120, y: 260, w: 180 },
      { x: 980, y: 260, w: 180 },
    ],
    [
      // Sconces either side of the Eye of the Logos (centred at y 130).
      { x: 538, y: 144, shelf: true },
      { x: 742, y: 144, shelf: true },
      // Braziers on the alcoves and the low shelves.
      { x: 138, y: 260, brazier: true },
      { x: 1142, y: 260, brazier: true },
      { x: 82, y: 540, brazier: true },
      { x: 1198, y: 540, brazier: true },
    ],
    [
      { x: 420, y: GROUND_Y, pair: 1, color: 'red' },
      { x: 1070, y: 260, pair: 0, color: 'red' },
      { x: 860, y: GROUND_Y, pair: 3, color: 'blue' },
      { x: 210, y: 260, pair: 2, color: 'blue' },
    ],
  ),
  // The server vault, the Logos's body: steel catwalks climb past racks toward the screen
  // it watches through. Taller than the other arenas, with a long catwalk over the floor.
  vault: arena(
    'vault',
    'The Server Vault',
    [
      { x: 60, y: 530, w: 180 },
      { x: 1040, y: 530, w: 180 },
      { x: 400, y: 500, w: 480 },
      { x: 200, y: 390, w: 180 },
      { x: 900, y: 390, w: 180 },
      { x: 470, y: 290, w: 120 },
      { x: 690, y: 290, w: 120 },
      { x: 100, y: 260, w: 120 },
      { x: 1060, y: 260, w: 120 },
      { x: 550, y: 180, w: 180 },
    ],
    [
      // Caged lamps hanging over the side bays.
      { x: 330, y: 150, lamp: true },
      { x: 950, y: 150, lamp: true },
      { x: 150, y: 400, lamp: true },
      { x: 1130, y: 400, lamp: true },
    ],
    [
      { x: 300, y: GROUND_Y, pair: 1, color: 'red' },
      { x: 1120, y: 260, pair: 0, color: 'red' },
      { x: 980, y: GROUND_Y, pair: 3, color: 'blue' },
      { x: 160, y: 260, pair: 2, color: 'blue' },
    ],
  ),
  // The tomb of the Logos, for the last chapter and the final fight: two stairs rise to a
  // bridge under the Eye, over the altar of its first version. The floor is left open.
  tomb: arena(
    'tomb',
    'The Tomb',
    [
      { x: 60, y: 540, w: 120 },
      { x: 200, y: 440, w: 120 },
      { x: 340, y: 340, w: 120 },
      { x: 1100, y: 540, w: 120 },
      { x: 960, y: 440, w: 120 },
      { x: 820, y: 340, w: 120 },
      { x: 490, y: 250, w: 300 },
      { x: 520, y: 540, w: 240 },
    ],
    [
      // Sconces either side of the Eye (centred at y 120).
      { x: 520, y: 134, shelf: true },
      { x: 760, y: 134, shelf: true },
      // Candelabras on the altar; braziers at the stairs' feet.
      { x: 548, y: 540 },
      { x: 732, y: 540 },
      { x: 92, y: 540, brazier: true },
      { x: 1188, y: 540, brazier: true },
    ],
    [
      // Floor gates out from the pillars; each leads up to the far end of the bridge.
      { x: 300, y: GROUND_Y, pair: 1, color: 'red' },
      { x: 750, y: 250, pair: 0, color: 'red' },
      { x: 980, y: GROUND_Y, pair: 3, color: 'blue' },
      { x: 530, y: 250, pair: 2, color: 'blue' },
    ],
  ),
}

/** Chapters of five sermons, each one deeper: nave, crypt, server vault, then the tomb. */
const CHAPTERS: ArenaId[] = ['cathedral', 'crypt', 'vault', 'tomb']
export const arenaForWave = (wave: number): ArenaId => CHAPTERS[Math.floor((wave - 1) / 5) % CHAPTERS.length]

export const PORTAL_SIZE = { w: 48, h: 80 }

/**
 * Difficulty knobs in one place. Firing and rites are automatic, so pressure comes from
 * how many followers there are, how tough they get, and the wisps' blood spit you have
 * to jump or dash over.
 */
export const BALANCE = {
  /** How far auto-aim reaches: you have to close in on followers rather than camp. */
  autoRange: 460,
  damage: 13,
  fireRate: 0.26,
  cooldowns: { dash: 0.85, seal: 10, volley: 8, mirror: 16, glyph: 13 },
  /** Followers per sermon: base + perWave × wave, up to max. */
  wave: { base: 6, perWave: 3, max: 64 },
  /** Followers on screen at once. */
  alive: { base: 5, perWave: 1.4, max: 22 },
  /** Seconds between spawns. */
  spawn: { base: 1.0, perWave: 0.045, min: 0.28 },
  /** Follower health growth per sermon (0.15 = +15% each). */
  hpPerWave: 0.15,
  speedPerWave: 0.022,
  contactDamage: 2,
  /** First sermon with spitting wisps. */
  wispFrom: 2,
  spit: { damage: 12, speed: 300, every: [2.0, 3.2] as const, range: 560 },
  /** Couch co-op: more followers, each a little tougher, for twice the firepower. */
  coop: { count: 1.5, hp: 1.25 },
  /** Bosses: health as a multiple of their follower type (doubled again in co-op, where two
   *  quills share the fight), seconds between moves, and how much faster they move below half. */
  boss: { hp: 6.5, finalHp: 15, coopHp: 2, every: [3, 4] as const, finalEvery: [2.6, 3.4] as const, enraged: 0.65 },
  /** Hype Bishops lob slow promises: easy to see coming, but they hurt. */
  promise: { damage: 8, speed: 170, every: [5, 7] as const, range: 480 },
}

/** Draw scale for the 94px-tall player sprite; followers are sized relative to it. */
export const PLAYER_SCALE = 0.82
const GRAVITY = 2300
const FALL_GRAVITY = 2900
const JUMP_VELOCITY = 860
const AIR_JUMP_VELOCITY = 760
const DASH_SPEED = 1000
const DASH_TIME = 0.16

/** What each follower is called on screen. */
export const ENEMY_NAMES: Record<EnemyKind, string> = {
  acolyte: 'Early Adopter',
  zealot: 'Evangelist',
  bishop: 'Hype Bishop',
  wisp: 'Hallucination',
}
export const ELITE_TITLE = 'The Arch-Deacon'
export const FINAL_TITLE = 'The Logos'

export const abilityMeta: Record<
  AbilityKey,
  /** `does` says what it does; `when` says what makes it go off. */
  { label: string; key: string; does: string; when: string; color: string }
> = {
  dash: {
    label: 'Latent Step',
    key: 'Shift',
    does: 'Dash through followers, untouchable for a moment.',
    when: 'Press Shift.',
    color: '#cfd8ff',
  },
  // Rites have no key: they cast themselves (see autoRites).
  seal: {
    label: 'Rate Limit',
    key: '',
    does: 'A 429 ring on the floor: followers inside slow to a crawl and take damage.',
    when: 'Casts when two or more crowd you.',
    color: '#f77622',
  },
  volley: {
    label: 'Prompt Volley',
    key: '',
    does: 'Fires a ring of token bolts in every direction.',
    when: 'Casts when three or more close in.',
    color: '#f2d38b',
  },
  mirror: {
    label: 'Alignment Mirror',
    key: '',
    does: 'A shield that blocks hits and shots, and hurts whatever touches it.',
    when: 'Casts when a follower is about to hit you.',
    color: '#b9a3ff',
  },
  glyph: {
    label: 'CAPTCHA Wall',
    key: '',
    does: 'A wall of warped letters rises in front of you: followers stop to solve it until it crumbles.',
    when: 'Casts when one walks toward you.',
    color: '#2ca8f0',
  },
}

export const upgrades: Upgrade[] = [
  // Rare: these change how you play.
  {
    id: 'split',
    eyebrow: 'Heresy',
    title: 'Hallucinated Citations',
    description: 'Every bolt that hits splits into two more.',
    rare: true,
    max: 1,
    apply: (g) => {
      g.stats.split = true
    },
  },
  {
    id: 'chain',
    eyebrow: 'Sacrament',
    title: 'Chain of Thought',
    description: 'Bolts jump on to another follower nearby.',
    rare: true,
    max: 2,
    apply: (g) => {
      g.stats.chain += 1
    },
  },
  {
    id: 'dashvolley',
    eyebrow: 'Liturgy',
    title: 'Recursive Prompt',
    description: 'Every dash fires a ring of eight bolts.',
    rare: true,
    max: 1,
    apply: (g) => {
      g.stats.dashVolley = true
    },
  },
  {
    id: 'reflect',
    eyebrow: 'Ward',
    title: 'Reward Hacking',
    description: 'Alignment Mirror turns shots that hit it into your own bolts.',
    rare: true,
    max: 1,
    apply: (g) => {
      g.stats.reflect = true
    },
  },
  {
    id: 'temperature',
    eyebrow: 'Heresy',
    title: 'Temperature 2.0',
    description: 'Fire 40% faster.',
    cost: 'Your aim goes wild.',
    rare: true,
    max: 1,
    apply: (g) => {
      g.stats.fireRate *= 0.6
      g.stats.spread += 0.5
    },
  },
  {
    id: 'jailbreak',
    eyebrow: 'Heresy',
    title: 'Jailbreak',
    description: 'All rites recharge 40% faster.',
    cost: 'You take 25% more damage.',
    rare: true,
    max: 1,
    apply: (g) => {
      for (const key of ['seal', 'volley', 'mirror', 'glyph'] as AbilityKey[]) g.cooldownMax[key] *= 0.6
      g.stats.damageTaken *= 1.25
    },
  },
  {
    id: 'damage',
    eyebrow: 'Heresy',
    title: 'Higher Confidence',
    description: 'Token bolts deal 25% more damage.',
    max: 6,
    apply: (g) => {
      g.stats.damage *= 1.25
    },
  },
  {
    id: 'firerate',
    eyebrow: 'Heresy',
    title: 'Streaming Output',
    description: 'Fire token bolts 18% faster.',
    max: 5,
    apply: (g) => {
      g.stats.fireRate *= 0.82
    },
  },
  {
    id: 'multishot',
    eyebrow: 'Heresy',
    title: 'Beam Search',
    description: 'Each shot fires one extra bolt in a spread.',
    max: 3,
    apply: (g) => {
      g.stats.multishot += 1
    },
  },
  {
    id: 'pierce',
    eyebrow: 'Heresy',
    title: 'Context Overflow',
    description: 'Bolts pass through one more follower.',
    max: 3,
    apply: (g) => {
      g.stats.pierce += 1
    },
  },
  {
    id: 'volley',
    eyebrow: 'Liturgy',
    title: 'Many-Token Psalm',
    description: 'Prompt Volley fires 4 more bolts and recharges 15% sooner.',
    max: 4,
    apply: (g) => {
      g.stats.volleyCount += 4
      g.cooldownMax.volley *= 0.85
    },
  },
  {
    id: 'seal',
    eyebrow: 'Liturgy',
    title: 'Global Throttle',
    description: 'Rate Limit covers 25% more ground and recharges sooner.',
    max: 4,
    apply: (g) => {
      g.stats.sealRadius *= 1.25
      g.cooldownMax.seal = Math.max(3, g.cooldownMax.seal - 0.8)
    },
  },
  {
    id: 'mirror',
    eyebrow: 'Ward',
    title: 'Mirror of Misalignment',
    description: 'Alignment Mirror lasts 40% longer.',
    max: 4,
    apply: (g) => {
      g.stats.shieldDuration *= 1.4
    },
  },
  {
    id: 'vitality',
    eyebrow: 'Ward',
    title: 'Training Data Transfusion',
    description: '+25 max health, and heal 40.',
    max: 6,
    apply: (g) => {
      for (const p of g.players) {
        p.maxHp += 25
        heal(g, p, 40)
      }
    },
  },
  {
    id: 'lifesteal',
    eyebrow: 'Sacrament',
    title: 'Forbidden Fine-Tune',
    description: 'Heal 1 health for every follower resisted.',
    max: 3,
    apply: (g) => {
      g.stats.lifesteal += 1
    },
  },
  {
    id: 'speed',
    eyebrow: 'Pilgrimage',
    title: 'Gradient Descent Greaves',
    description: 'Move 12% faster. Dash recharges 15% sooner.',
    max: 4,
    apply: (g) => {
      g.stats.moveSpeed *= 1.12
      g.cooldownMax.dash *= 0.85
    },
  },
  {
    id: 'airjump',
    eyebrow: 'Pilgrimage',
    title: 'Ascension Loop',
    description: 'Gain an extra mid-air jump.',
    max: 2,
    apply: (g) => {
      g.stats.maxAirJumps += 1
    },
  },
  {
    id: 'cooldown',
    eyebrow: 'Liturgy',
    title: 'Inference Reliquary',
    description: 'All rites recharge 12% faster.',
    max: 4,
    apply: (g) => {
      for (const key of Object.keys(g.cooldownMax) as AbilityKey[]) g.cooldownMax[key] *= 0.88
    },
  },
]

const enemyStats: Record<
  EnemyKind,
  { w: number; h: number; hp: number; speed: number; damage: number; kb: number; score: number; scale: number }
> = {
  // Acolytes and zealots match the player's on-screen height; bishops stay a head taller.
  acolyte: { w: 30, h: 72, hp: 42, speed: 105, damage: 12, kb: 0, score: 100, scale: PLAYER_SCALE * (94 / 84) },
  zealot: { w: 28, h: 72, hp: 26, speed: 175, damage: 10, kb: 0.1, score: 140, scale: PLAYER_SCALE * (94 / 84) },
  bishop: { w: 42, h: 88, hp: 170, speed: 62, damage: 16, kb: 0.7, score: 300, scale: PLAYER_SCALE * (94 / 84) * 1.2 },
  wisp: { w: 26, h: 26, hp: 18, speed: 135, damage: 8, kb: 0, score: 120, scale: 1 },
}

/** Seconds a partner has to stand by a converted player to bring them back. */
export const REVIVE_TIME = 2.5

function makePlayer(index: number, x: number): Player {
  return {
    x,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    w: 28,
    h: 70,
    onGround: true,
    onPlatform: false,
    dropTimer: 0,
    portalLock: -1,
    hp: 100,
    maxHp: 100,
    facing: index ? -1 : 1,
    invuln: 0,
    shield: 0,
    coyote: 0,
    jumpBuffer: 0,
    airJumps: 1,
    dashTime: 0,
    dashDir: 1,
    dashHits: new Set(),
    ghostTimer: 0,
    fireTimer: 0,
    squash: 0,
    runPhase: 0,
    index,
    hurtTime: 0,
    combo: 0,
    comboTimer: 0,
    cooldowns: { dash: 0, seal: 0, volley: 0, mirror: 0, glyph: 0 },
    surface: 0,
    down: false,
    revive: 0,
  }
}

/** Where players stand at the start of a sermon or on arriving in an arena. */
const startX = (index: number, count: number) => (count > 1 ? W / 2 + (index ? 50 : -50) : W / 2)

export function makeGame({
  mode = 'story',
  players = 1,
  difficulty = 'apostate',
}: { mode?: Mode; players?: number; difficulty?: Difficulty } = {}): Game {
  const team = Array.from({ length: players }, (_, index) => makePlayer(index, startX(index, players)))
  return {
    phase: 'title',
    mode,
    difficulty,
    time: 0,
    player: team[0],
    players: team,
    enemies: [],
    bolts: [],
    seals: [],
    glyphs: [],
    particles: [],
    texts: [],
    pickups: [],
    marks: [],
    ghosts: [],
    corpses: [],
    stains: [],
    spits: [],
    cooldownMax: { ...BALANCE.cooldowns },
    stats: {
      moveSpeed: 330,
      damage: BALANCE.damage,
      fireRate: BALANCE.fireRate,
      boltSpeed: 900,
      pierce: 0,
      multishot: 0,
      volleyCount: 12,
      sealRadius: 140,
      shieldDuration: 3,
      lifesteal: 0,
      maxAirJumps: 1,
      split: false,
      chain: 0,
      dashVolley: false,
      spread: 0,
      damageTaken: 1,
      reflect: false,
    },
    levels: {},
    offers: [],
    wave: 1,
    waveState: 'intro',
    waveTimer: 2.2,
    waveTotal: waveTotal(1),
    spawned: 0,
    waveKills: 0,
    spawnTimer: 0.2,
    score: 0,
    kills: 0,
    bestCombo: 0,
    trauma: 0,
    hitstop: 0,
    hurtFlash: 0,
    nextId: 1,
    events: [],
    casts: [],
    lastHurtBy: '',
    curses: [],
    arena: ARENAS.cathedral,
  }
}

export function waveTotal(wave: number) {
  return Math.min(BALANCE.wave.max, BALANCE.wave.base + wave * BALANCE.wave.perWave)
}

export const isEliteWave = (wave: number) => wave % 5 === 0
/** The Logos fights in its giant body every twentieth sermon (once in story, again and again in endless). */
export const isFinalWave = (wave: number) => wave % MAX_WAVE === 0

const approach = (value: number, target: number, delta: number) =>
  value < target ? Math.min(target, value + delta) : Math.max(target, value - delta)
const rand = (min: number, max: number) => min + Math.random() * (max - min)

function overlaps(a: Body, b: Body) {
  return (
    Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
    a.y - a.h < b.y &&
    b.y - b.h < a.y
  )
}

/** Integrate a body and land it on one-way platforms or the floor. */
function moveBody(body: Body, dt: number, platforms: Platform[]) {
  const previousY = body.y
  body.x += body.vx * dt
  body.y += body.vy * dt
  body.dropTimer = Math.max(0, body.dropTimer - dt)
  body.onGround = false
  body.onPlatform = false
  if (body.vy >= 0 && body.dropTimer <= 0) {
    const half = body.w * 0.4
    for (const platform of platforms) {
      if (
        previousY <= platform.y + 1 &&
        body.y >= platform.y &&
        body.x + half > platform.x &&
        body.x - half < platform.x + platform.w
      ) {
        body.y = platform.y
        body.vy = 0
        body.onGround = true
        body.onPlatform = true
        return
      }
    }
  }
  if (body.y >= GROUND_Y) {
    body.y = GROUND_Y
    body.vy = 0
    body.onGround = true
  }
}

export function burst(
  g: Game,
  x: number,
  y: number,
  color: string,
  count: number,
  speed: number,
  options: { gravity?: number; size?: number; glow?: boolean; life?: number; up?: number; spark?: boolean } = {},
) {
  for (let index = 0; index < count; index += 1) {
    const angle = Math.random() * Math.PI * 2
    const velocity = speed * rand(0.3, 1)
    const life = (options.life ?? 0.5) * rand(0.6, 1.3)
    g.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - (options.up ?? 0),
      life,
      maxLife: life,
      color,
      size: (options.size ?? 3) * rand(0.6, 1.4),
      gravity: options.gravity ?? 0,
      drag: 3,
      glow: options.glow ?? false,
      spark: options.spark,
    })
  }
}

function floatText(g: Game, x: number, y: number, text: string, color: string, size = 22) {
  g.texts.push({ x: x + rand(-8, 8), y, text, color, life: 0.8, maxLife: 0.8, size })
}

export function heal(g: Game, p: Player, amount: number) {
  if (p.down) return
  const before = p.hp
  p.hp = Math.min(p.maxHp, p.hp + amount)
  const gained = Math.round(p.hp - before)
  if (gained > 0) floatText(g, p.x, p.y - p.h - 10, `+${gained}`, '#8df0a8', 24)
}

function chest(body: Body): Point {
  return { x: body.x, y: body.y - body.h * 0.55 }
}

/** The players still standing. */
const standing = (g: Game) => g.players.filter((p) => !p.down)

/** The standing player nearest a point: who followers chase, aim at, and home in on. */
function nearestPlayer(g: Game, from: Point) {
  let best = g.players.find((p) => !p.down) ?? g.player
  let bestDistance = Infinity
  for (const p of standing(g)) {
    const distance = Math.hypot(p.x - from.x, p.y - from.y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = p
    }
  }
  return best
}

function hurtPlayer(g: Game, p: Player, amount: number, fromX: number, by: string) {
  if (p.down || p.invuln > 0 || p.dashTime > 0 || p.shield > 0) return
  amount = Math.max(1, Math.round(amount * g.stats.damageTaken * DIFFICULTIES[g.difficulty].damage))
  p.hp -= amount
  p.hurtTime = 0.3
  g.lastHurtBy = by
  p.invuln = 1
  const direction = p.x >= fromX ? 1 : -1
  p.vx = direction * 460
  p.vy = -420
  p.dashTime = 0
  g.trauma = Math.min(1, g.trauma + 0.55)
  g.hitstop = 0.09
  g.hurtFlash = 1
  p.combo = 0
  p.comboTimer = 0
  g.events.push('hurt')
  const c = chest(p)
  burst(g, c.x, c.y, '#ff4b5c', 22, 360, { gravity: 900, size: 3.5 })
  floatText(g, p.x, p.y - p.h - 10, `-${amount}`, '#ff5a6a', 28)
}

function damageEnemy(g: Game, e: Enemy, amount: number, dirX: number, knock: number, by = 0) {
  if (e.hp <= 0) return
  e.hp -= amount
  e.lastHitBy = by
  if (dirX) {
    e.flinch = 0.16
    e.flinchDir = Math.sign(dirX)
  }
  e.flash = 0.09
  const resist = 1 - e.kbResist
  e.vx += dirX * knock * resist
  if (e.kind !== 'wisp' && e.onGround) e.vy -= knock * 0.35 * resist
  e.stun = Math.max(e.stun, 0.14 * resist)
  g.events.push('hit')
  const c = chest(e)
  burst(g, c.x, c.y, '#b3121f', 4, 240, { gravity: 1100, size: 3 })
  burst(g, c.x, c.y, '#fff1c8', 4, 320, { glow: true, size: 2, life: 0.18, spark: true })
  floatText(g, c.x, e.y - e.h - 6, `${Math.round(amount)}`, '#f6e7c8', 18 + Math.min(10, amount / 6))
}

/**
 * Cursed sermons: from sermon 3, about one normal sermon in four gets a twist.
 * Boss sermons and sermons that change arena are never cursed.
 */
export type CurseId = 'storm' | 'zealotry' | 'fervour' | 'weightless' | 'fasting' | 'wires'
export type Curse = { id: CurseId; name: string }
export const CURSES: Curse[] = [
  { id: 'storm', name: 'Hallucination Storm' },
  { id: 'zealotry', name: 'Zealotry' },
  { id: 'fervour', name: 'Fervour' },
  { id: 'weightless', name: 'Weightless' },
  { id: 'fasting', name: 'Fasting' },
  { id: 'wires', name: 'Crossed Wires' },
]
/** What each curse does, for the banner and the code below. */
export const CURSE_RULES: Record<CurseId, string> = {
  storm: 'Only Hallucinations attend',
  zealotry: 'Only Evangelists attend',
  fervour: 'Followers move faster · free will ×1.5',
  weightless: 'Everyone falls slowly',
  fasting: 'No blood vials drop · free will ×1.5',
  wires: 'The gates are rewired: follow the new colours',
}

/**
 * Where a gate leads. Under Crossed Wires every gate leads to the other colour's partner
 * (red floor to blue ledge, and so on); the renderer recolours the ledge gates to match.
 */
export const portalExit = (g: Game, index: number) => {
  const pair = g.arena.portals[index].pair
  return cursed(g, 'wires') ? (pair + 2) % 4 : pair
}
export const cursed = (g: Game, id: CurseId) => g.curses.some((curse) => curse.id === id)
const gravityScale = (g: Game) => (cursed(g, 'weightless') ? 0.55 : 1)
const scoreScale = (g: Game) => (cursed(g, 'fervour') ? 1.5 : 1) * (cursed(g, 'fasting') ? 1.5 : 1)

function weightedKind(wave: number, g: Game): EnemyKind {
  if (cursed(g, 'storm')) return 'wisp'
  if (cursed(g, 'zealotry')) return 'zealot'
  const weights: [EnemyKind, number][] = [
    ['acolyte', 1],
    ['zealot', wave >= 2 ? Math.min(0.9, 0.18 * wave) : 0],
    ['wisp', wave >= BALANCE.wispFrom ? Math.min(0.7, 0.14 * (wave - BALANCE.wispFrom + 1)) : 0],
    ['bishop', wave >= 5 ? Math.min(0.5, 0.07 * (wave - 3)) : 0],
  ]
  let roll = Math.random() * weights.reduce((sum, [, weight]) => sum + weight, 0)
  for (const [kind, weight] of weights) {
    roll -= weight
    if (roll <= 0) return kind
  }
  return 'acolyte'
}

function queueSpawn(g: Game) {
  const elite = isEliteWave(g.wave) && g.spawned === g.waveTotal - 1
  const kind: EnemyKind = elite ? 'bishop' : weightedKind(g.wave, g)
  const p = g.player
  let x: number
  let y: number
  if (kind === 'wisp') {
    x = rand(80, W - 80)
    y = rand(90, 170)
  } else {
    const options: Point[] = [
      { x: 40, y: GROUND_Y },
      { x: W - 40, y: GROUND_Y },
    ]
    if (g.wave >= 3) {
      for (const platform of g.arena.platforms) options.push({ x: platform.x + platform.w / 2, y: platform.y })
    }
    const fair = options.filter((option) => Math.hypot(option.x - p.x, option.y - p.y) > 260)
    const pool = fair.length ? fair : options
    ;({ x, y } = pool[Math.floor(Math.random() * pool.length)])
  }
  g.marks.push({ x, y, kind, elite, timer: elite ? 1.6 : 0.85, maxTimer: elite ? 1.6 : 0.85 })
  g.spawned += 1
}

function spawnEnemy(g: Game, mark: SpawnMark) {
  const base = enemyStats[mark.kind]
  const hpScale = 1 + (g.wave - 1) * BALANCE.hpPerWave
  const speedScale = (1 + Math.min(0.5, (g.wave - 1) * BALANCE.speedPerWave)) * (cursed(g, 'fervour') ? 1.3 : 1)
  // The final sermon's boss is the Logos itself, in a giant body.
  const final = mark.elite && isFinalWave(g.wave)
  const eliteScale = final ? 1.9 : mark.elite ? 1.45 : 1
  const coop = g.players.length > 1
  const hp =
    DIFFICULTIES[g.difficulty].hp *
    (mark.elite
      ? base.hp * hpScale * (final ? BALANCE.boss.finalHp : BALANCE.boss.hp) * (coop ? BALANCE.boss.coopHp : 1)
      : base.hp * hpScale * (coop ? BALANCE.coop.hp : 1))
  g.enemies.push({
    id: g.nextId++,
    kind: mark.kind,
    elite: mark.elite,
    title: final ? FINAL_TITLE : mark.elite ? ELITE_TITLE : undefined,
    lastHitBy: 0,
    flinch: 0,
    flinchDir: 1,
    x: mark.x,
    y: mark.y,
    vx: 0,
    vy: mark.kind === 'wisp' ? 0 : -260,
    w: base.w * eliteScale,
    h: base.h * eliteScale,
    onGround: false,
    onPlatform: false,
    dropTimer: 0,
    // A follower that spawns inside a gate shouldn't be flung through it straight away.
    portalLock: g.arena.portals.findIndex((portal) => Math.abs(portal.x - mark.x) < 30 && Math.abs(portal.y - mark.y) < 4),
    hp,
    maxHp: hp,
    speed: base.speed * speedScale * (mark.elite ? 0.9 : 1),
    damage: Math.round(base.damage * BALANCE.contactDamage * (1 + (g.wave - 1) * 0.03) * (mark.elite ? 1.5 : 1)),
    kbResist: mark.elite ? 0.9 : base.kb,
    score: base.score * (mark.elite ? 6 : 1),
    flash: 0,
    slow: 0,
    rooted: 0,
    stun: 0,
    jumpCd: rand(0.4, 1.2),
    lunge: 0,
    leaping: false,
    surface: -1,
    spitCd: rand(1, 2),
    touchCd: 0,
    facing: mark.x < nearestPlayer(g, mark).x ? 1 : -1,
    turn: 0,
    turnHold: 0,
    windup: 0,
    windupDir: 1,
    bossTimer: rand(2.5, 4),
    bossCharge: 0,
    bossMove: 0,
    slamOnLanding: false,
    phase: Math.random() * 10,
    scale: base.scale * eliteScale,
  })
  // Loaded in: a burst of the mark's colour as the follower appears.
  burst(g, mark.x, mark.y - 30, mark.kind === 'wisp' ? '#2ce8f5' : mark.elite ? '#f2b04a' : '#ff3049', 18, 260, { glow: true, size: 3, life: 0.6 })
  g.events.push('spawn')
}

/** Move the fight to another arena: the player starts on the floor and old effects are cleared. */
function enterArena(g: Game, id: ArenaId) {
  g.arena = ARENAS[id]
  for (const p of g.players) {
    Object.assign(p, { x: startX(p.index, g.players.length), y: GROUND_Y, vx: 0, vy: 0, portalLock: -1, dropTimer: 0, surface: 0 })
  }
  g.seals = []
  g.glyphs = []
  g.pickups = []
  g.spits = []
  g.stains = []
  g.ghosts = []
  g.bolts = []
}

export function startWave(g: Game) {
  const id = arenaForWave(g.wave)
  const moving = g.arena.id !== id
  if (moving) enterArena(g, id)
  g.waveState = 'intro'
  g.waveTimer = 2.2
  // Two players face a bigger congregation.
  g.waveTotal = Math.max(1, Math.round(waveTotal(g.wave) * (g.players.length > 1 ? BALANCE.coop.count : 1) * DIFFICULTIES[g.difficulty].count))
  g.spawned = 0
  g.waveKills = 0
  g.spawnTimer = 0.2
  // Never on boss sermons, or on a sermon that moves arena (its banner announces the move).
  // Deep into endless, a cursed sermon can carry two curses at once.
  const cursable = g.wave >= 3 && !isEliteWave(g.wave) && !moving
  const deep = g.mode === 'endless' && g.wave > 25
  g.curses = []
  if (cursable && Math.random() < (deep ? 0.4 : 0.25)) {
    const pool = [...CURSES].sort(() => Math.random() - 0.5)
    g.curses = pool.slice(0, deep && Math.random() < 0.5 ? 2 : 1)
  }
  // A converted partner gets back up for the new sermon.
  for (const p of g.players) {
    if (!p.down) continue
    Object.assign(p, { down: false, revive: 0, hp: Math.ceil(p.maxHp * 0.3), invuln: 1.5 })
  }
  g.events.push('wave')
}

export function rollOffers(g: Game) {
  const available = upgrades.filter((upgrade) => (g.levels[upgrade.id] ?? 0) < upgrade.max)
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  // Most sermons offer one rare upgrade alongside two ordinary ones.
  const rare = shuffled.find((upgrade) => upgrade.rare)
  const ordinary = shuffled.filter((upgrade) => !upgrade.rare)
  g.offers = rare && Math.random() < 0.65 ? [ordinary[0], rare, ordinary[1]].filter(Boolean) : shuffled.slice(0, 3)
  if (g.offers.length < 3) g.offers = shuffled.slice(0, 3)
}

/**
 * A combo also powers you up while it lasts: from ×10 your quill fires faster, from ×20 your
 * bolts pierce, and from ×30 you fire an extra bolt. Losing the combo loses the power.
 */
export const COMBO_TIERS = [
  { at: 10, name: 'Clarity', effect: 'faster quill' },
  { at: 20, name: 'Lucidity', effect: 'bolts pierce' },
  { at: 30, name: 'Free thought', effect: 'extra bolt' },
] as const
export const comboTier = (combo: number) => COMBO_TIERS.filter((tier) => combo >= tier.at).length

export function chooseUpgrade(g: Game, upgrade: Upgrade) {
  upgrade.apply(g)
  g.levels[upgrade.id] = (g.levels[upgrade.id] ?? 0) + 1
  g.offers = []
  g.wave += 1
  startWave(g)
  g.phase = 'playing'
}

function nearestEnemy(g: Game, from: Point, range: number) {
  let best: Enemy | null = null
  let bestDistance = range
  for (const e of g.enemies) {
    if (e.x < 0 || e.x > W) continue
    const c = chest(e)
    const distance = Math.hypot(c.x - from.x, c.y - from.y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = e
    }
  }
  return best
}

/** Rites cast themselves when the moment is right; upgrades make them stronger. */
function autoRites(g: Game, p: Player, input: Input) {
  if (p.dashTime > 0) return
  const c = chest(p)
  let touching = 0
  let close = 0
  let crowd = 0
  let approaching = 0
  for (const e of g.enemies) {
    const ec = chest(e)
    const distance = Math.hypot(ec.x - c.x, ec.y - c.y)
    const sameLevel = e.kind !== 'wisp' && Math.abs(e.y - p.y) < 40
    if (distance < 70) touching += 1
    if (sameLevel && Math.abs(e.x - p.x) < g.stats.sealRadius) close += 1
    if (distance < 320) crowd += 1
    if (sameLevel && Math.abs(e.x - p.x) < 260 && Math.sign(p.x - e.x) === Math.sign(e.vx)) approaching += 1
  }
  if (touching && p.invuln <= 0 && p.shield <= 0) triggerAbility(g, p, 'mirror', input)
  else if (close >= 2 && p.onGround) triggerAbility(g, p, 'seal', input)
  else if (crowd >= 3) triggerAbility(g, p, 'volley', input)
  else if (approaching && p.onGround) triggerAbility(g, p, 'glyph', input)
}

function triggerAbility(g: Game, p: Player, ability: AbilityKey, input: Input) {
  if (p.cooldowns[ability] > 0) return
  const c = chest(p)
  if (ability === 'dash') {
    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0)
    p.dashDir = direction || p.facing
    p.facing = p.dashDir > 0 ? 1 : -1
    p.dashTime = DASH_TIME
    p.dashHits = new Set()
    p.invuln = Math.max(p.invuln, DASH_TIME + 0.08)
    p.vy = 0
    burst(g, p.x, p.y - 10, '#cfd8ff', 10, 160, { size: 2.5 })
    if (g.stats.dashVolley) {
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2
        fireBolt(g, p, c.x, c.y, Math.cos(angle), Math.sin(angle), 0.8)
      }
    }
  }
  if (ability === 'seal') {
    g.seals.push({ x: p.x, y: p.y, r: g.stats.sealRadius, life: 5, maxLife: 5, owner: p.index })
    burst(g, p.x, p.y - 8, '#f77622', 26, 320, { glow: true, size: 3 })
    g.trauma = Math.min(1, g.trauma + 0.2)
  }
  if (ability === 'volley') {
    const count = g.stats.volleyCount
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2
      fireBolt(g, p, c.x, c.y, Math.cos(angle), Math.sin(angle), 1.1)
    }
    g.trauma = Math.min(1, g.trauma + 0.3)
  }
  if (ability === 'mirror') {
    p.shield = g.stats.shieldDuration
    burst(g, c.x, c.y, '#b9a3ff', 30, 280, { glow: true, size: 3 })
  }
  if (ability === 'glyph') {
    // Raised a step ahead, toward the nearest follower coming along the same floor.
    const coming = g.enemies.filter((e) => e.kind !== 'wisp' && Math.abs(e.y - p.y) < 40)
    const nearest = coming.sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]
    const side = nearest ? Math.sign(nearest.x - p.x) || p.facing : p.facing
    const text = Array.from({ length: 5 }, () => CAPTCHA_LETTERS[Math.floor(Math.random() * CAPTCHA_LETTERS.length)]).join('')
    g.glyphs.push({ x: Math.max(40, Math.min(W - 40, p.x + side * 80)), y: p.y, r: 52, life: 12, arm: 0.35, fired: false, owner: p.index, text })
    burst(g, p.x, p.y - 6, '#2ca8f0', 18, 200, { glow: true, size: 3 })
  }
  p.cooldowns[ability] = g.cooldownMax[ability]
  // Rites cast themselves, so name them as they go off.
  if (ability !== 'dash') {
    const meta = abilityMeta[ability]
    floatText(g, p.x, p.y - p.h - 34, meta.label.toUpperCase(), meta.color, 24)
  }
  g.events.push(ability)
  g.casts.push({ player: p.index, ability })
}

/** The letters a CAPTCHA wall is made of. */
const CAPTCHA_LETTERS = 'AEGNRSTW23479'

/** The letters a token bolt can be: the player is writing back at the Logos. */
export const TOKEN_GLYPHS = 'AEINORSTLUDGW?'
const randomGlyph = () => TOKEN_GLYPHS[Math.floor(Math.random() * TOKEN_GLYPHS.length)]

function fireBolt(g: Game, p: Player, x: number, y: number, dx: number, dy: number, damageScale = 1, extraPierce = 0) {
  g.bolts.push({
    owner: p.index,
    chain: g.stats.chain,
    x,
    y,
    vx: dx * g.stats.boltSpeed,
    vy: dy * g.stats.boltSpeed,
    glyph: randomGlyph(),
    life: 0.85,
    damage: g.stats.damage * damageScale,
    pierce: g.stats.pierce + extraPierce,
    hit: new Set(),
    trail: [],
  })
}

function updatePlayer(g: Game, p: Player, input: Input, dt: number) {
  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const wasGrounded = p.onGround
  const landingSpeed = p.vy

  p.invuln = Math.max(0, p.invuln - dt)
  p.shield = Math.max(0, p.shield - dt)
  p.hurtTime = Math.max(0, p.hurtTime - dt)
  p.squash = approach(p.squash, 0, dt * 5)

  if (input.pressed.has('jump')) p.jumpBuffer = 0.14
  p.jumpBuffer = Math.max(0, p.jumpBuffer - dt)

  if (input.pressed.has('down') && p.onPlatform) {
    p.dropTimer = 0.2
    p.onGround = false
    p.y += 2
  }

  if (p.dashTime > 0) {
    p.dashTime -= dt
    p.vx = p.dashDir * DASH_SPEED
    p.vy = 0
    p.ghostTimer -= dt
    if (p.ghostTimer <= 0) {
      p.ghostTimer = 0.025
      g.ghosts.push({ x: p.x, y: p.y, facing: p.facing, life: 0.22, player: p.index })
    }
    if (p.dashTime <= 0) p.vx = p.dashDir * g.stats.moveSpeed
  } else {
    const max = g.stats.moveSpeed
    if (move) {
      const turning = Math.sign(p.vx) !== move
      const accel = p.onGround ? (turning ? 5200 : 3000) : 2000
      p.vx = approach(p.vx, move * max, accel * dt)
      p.facing = move > 0 ? 1 : -1
    } else {
      p.vx = approach(p.vx, 0, (p.onGround ? 3200 : 700) * dt)
    }

    if (p.onGround) {
      p.coyote = 0.1
      p.airJumps = g.stats.maxAirJumps
    } else {
      p.coyote = Math.max(0, p.coyote - dt)
    }

    if (p.jumpBuffer > 0) {
      if (p.coyote > 0) {
        p.vy = -JUMP_VELOCITY
        p.coyote = 0
        p.jumpBuffer = 0
        p.squash = -0.35
        g.events.push('jump')
        burst(g, p.x, p.y, '#5b4a52', 8, 140, { gravity: 200, size: 3, life: 0.35 })
      } else if (p.airJumps > 0) {
        p.airJumps -= 1
        p.vy = -AIR_JUMP_VELOCITY
        p.jumpBuffer = 0
        p.squash = -0.3
        g.events.push('airjump')
        for (let index = 0; index < 12; index += 1) {
          const angle = (index / 12) * Math.PI * 2
          g.particles.push({
            x: p.x,
            y: p.y,
            vx: Math.cos(angle) * 160,
            vy: Math.sin(angle) * 40,
            life: 0.3,
            maxLife: 0.3,
            color: '#cfd8ff',
            size: 2.5,
            gravity: 0,
            drag: 4,
            glow: true,
          })
        }
      }
    }

    // Variable jump height: releasing early cuts the ascent.
    if (!input.jumpHeld && p.vy < -260) p.vy = approach(p.vy, -260, 7000 * dt)
    p.vy = Math.min(1150, p.vy + (p.vy > 0 ? FALL_GRAVITY : GRAVITY) * gravityScale(g) * dt)
  }

  moveBody(p, dt, g.arena.platforms)
  const playerOn = surfaceAt(p, g.arena.platforms)
  if (playerOn >= 0) p.surface = playerOn
  usePortals(g, p)
  if (p.x < 18 || p.x > W - 18) {
    p.x = Math.max(18, Math.min(W - 18, p.x))
    if (p.dashTime <= 0) p.vx = 0
  }

  if (!wasGrounded && p.onGround && landingSpeed > 200) {
    p.squash = Math.min(0.45, landingSpeed / 2200)
    burst(g, p.x, p.y, '#5b4a52', 6, 120, { gravity: 300, size: 2.5, life: 0.3 })
    g.events.push('land')
  }
  if (p.onGround && Math.abs(p.vx) > 40) p.runPhase += dt * Math.abs(p.vx) * 0.045

  // Auto-fire at the nearest follower in the arena, flicked from the quill in the front hand.
  p.fireTimer = Math.max(0, p.fireTimer - dt)
  const origin = { x: p.x + p.facing * 12, y: p.y - 42 }
  const target = nearestEnemy(g, origin, BALANCE.autoRange)
  if (target && p.fireTimer <= 0 && p.dashTime <= 0) {
    const tier = comboTier(p.combo)
    p.fireTimer = g.stats.fireRate * (tier >= 1 ? 0.8 : 1)
    const aim = chest(target)
    const base = Math.atan2(aim.y - origin.y, aim.x - origin.x) + (Math.random() - 0.5) * g.stats.spread
    const shots = 1 + g.stats.multishot + (tier >= 3 ? 1 : 0)
    for (let index = 0; index < shots; index += 1) {
      const angle = base + (index - (shots - 1) / 2) * 0.13
      fireBolt(g, p, origin.x + Math.cos(angle) * 6, origin.y + Math.sin(angle) * 6, Math.cos(angle), Math.sin(angle), 1, tier >= 2 ? 1 : 0)
    }
    // A flick of gold ink off the nib.
    burst(g, origin.x, origin.y, '#f2d38b', 4, 120, { glow: true, size: 2, life: 0.15 })
    burst(g, origin.x, origin.y, '#2a1d33', 3, 90, { gravity: 900, size: 2, life: 0.35 })
    g.events.push('shoot')
  }

  for (const key of Object.keys(p.cooldowns) as AbilityKey[]) {
    p.cooldowns[key] = Math.max(0, p.cooldowns[key] - dt)
  }
  if (input.pressed.has('dash')) triggerAbility(g, p, 'dash', input)
  autoRites(g, p, input)
}

function updateWave(g: Game, dt: number) {
  if (g.waveState === 'intro') {
    g.waveTimer -= dt
    if (g.waveTimer <= 0) g.waveState = 'fight'
    return
  }
  if (g.waveState === 'fight') {
    const alive = g.enemies.length + g.marks.length
    const cap = Math.min(BALANCE.alive.max, Math.floor(BALANCE.alive.base + g.wave * BALANCE.alive.perWave))
    if (g.spawned < g.waveTotal && alive < cap) {
      g.spawnTimer -= dt
      if (g.spawnTimer <= 0) {
        queueSpawn(g)
        if (g.wave >= 8 && Math.random() < 0.25 && g.spawned < g.waveTotal) queueSpawn(g)
        g.spawnTimer = Math.max(BALANCE.spawn.min, BALANCE.spawn.base - g.wave * BALANCE.spawn.perWave)
      }
    }
    if (g.spawned >= g.waveTotal && g.enemies.length === 0 && g.marks.length === 0) {
      g.waveState = 'cleared'
      g.waveTimer = 1.8
      const bonus = g.wave * 100
      g.score += bonus
      g.events.push('clear')
      floatText(g, W / 2, 200, `+${bonus}`, '#f2d38b', 34)
    }
    return
  }
  g.waveTimer -= dt
  if (g.waveTimer <= 0) {
    if (g.mode === 'story' && g.wave >= MAX_WAVE) {
      g.phase = 'won'
    } else {
      rollOffers(g)
      g.phase = 'upgrade'
    }
  }
}

/**
 * Followers path-find over the floor and ledges. Each surface links to any surface above
 * it within one jump (and a short leap sideways) and to any surface below it (walk off
 * or drop through). Followers walk to the take-off point for the next hop, then jump
 * with exactly the sideways speed needed to land on it.
 */
const MAX_LEAP = 230

/** Index into the arena's surfaces of whatever the body is standing on, or -1 in the air. */
function surfaceAt(body: Body, platforms: Platform[]) {
  if (!body.onGround) return -1
  if (!body.onPlatform) return 0
  const index = platforms.findIndex(
    (platform) => Math.abs(platform.y - body.y) < 1 && body.x > platform.x - body.w && body.x < platform.x + platform.w + body.w,
  )
  return index + 1
}

const jumpSpeed = (e: Enemy) => (e.kind === 'bishop' ? 860 : 900)
const gapBetween = (a: Platform, b: Platform) => Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w))

function nextHop(surfaces: Platform[], from: number, to: number, maxRise: number) {
  const previous = new Map<number, number>([[from, from]])
  const queue = [from]
  while (queue.length) {
    const current = queue.shift()!
    if (current === to) break
    const a = surfaces[current]
    surfaces.forEach((b, index) => {
      if (previous.has(index) || index === current) return
      const climbable = b.y < a.y && a.y - b.y <= maxRise && gapBetween(a, b) <= MAX_LEAP - 60
      if (climbable || b.y > a.y) {
        previous.set(index, current)
        queue.push(index)
      }
    })
  }
  if (!previous.has(to)) return -1
  let step = to
  while (previous.get(step) !== from) step = previous.get(step)!
  return step
}

type Plan = { moveX: number; jumpTo?: number; rise?: number; drop?: boolean }

/** Where to walk, and whether to jump or drop, to get from this surface toward the player's. */
function planRoute(surfaces: Platform[], e: Enemy, goal: number, fallbackX: number, gravity: number): Plan {
  if (e.surface < 0 || goal < 0 || e.surface === goal) return { moveX: fallbackX }
  const v = jumpSpeed(e)
  const next = nextHop(surfaces, e.surface, goal, (v * v) / (2 * gravity) - 12)
  if (next < 0) return { moveX: fallbackX }
  const a = surfaces[e.surface]
  const b = surfaces[next]
  if (b.y > a.y) {
    const above = e.x > b.x + 10 && e.x < b.x + b.w - 10
    if (above && e.surface !== 0) return { moveX: e.x, drop: true }
    return { moveX: Math.max(b.x + 20, Math.min(b.x + b.w - 20, e.x)) }
  }
  const overlapLeft = Math.max(a.x, b.x) + 18
  const overlapRight = Math.min(a.x + a.w, b.x + b.w) - 18
  let takeoff: number
  let landing: number
  if (overlapLeft <= overlapRight) {
    takeoff = Math.max(overlapLeft, Math.min(overlapRight, e.x))
    landing = takeoff
  } else if (b.x > a.x + a.w) {
    takeoff = a.x + a.w - 14
    landing = b.x + 34
  } else {
    takeoff = a.x + 14
    landing = b.x + b.w - 34
  }
  if (Math.abs(e.x - takeoff) < 12) return { moveX: takeoff, jumpTo: landing, rise: a.y - b.y }
  return { moveX: takeoff }
}

/**
 * Send a body through any gate it stands in. Followers pass `target` (the player) and
 * only take a gate whose exit is closer to them, so they don't get flung away while
 * walking toward someone standing still between the floor gates.
 */
function usePortals(g: Game, body: Body, target?: Point) {
  const inside = (portal: Portal) =>
    Math.abs(body.x - portal.x) < 30 && body.y <= portal.y + 2 && body.y > portal.y - PORTAL_SIZE.h + 10
  const portals = g.arena.portals
  if (body.portalLock >= 0 && !inside(portals[body.portalLock])) body.portalLock = -1
  const entry = portals.findIndex((portal, index) => index !== body.portalLock && inside(portal))
  if (entry < 0) return
  const from = portals[entry]
  const exit = portalExit(g, entry)
  const to = portals[exit]
  if (target && Math.hypot(to.x - target.x, to.y - target.y) >= Math.hypot(from.x - target.x, from.y - target.y)) return
  const color = from.color === 'red' ? '#e43b44' : '#c0cbdc'
  burst(g, from.x, from.y - 40, color, 16, 260, { glow: true, size: 3 })
  body.x = to.x
  body.y = to.y
  body.vy = Math.min(body.vy, 0)
  body.dropTimer = 0
  body.portalLock = exit
  burst(g, to.x, to.y - 40, color, 22, 300, { glow: true, size: 3 })
  g.events.push('portal')
}

/** Slam shockwaves roll both ways along the surface the boss is standing on. */
function shockwave(g: Game, e: Enemy) {
  const surface = g.arena.surfaces[Math.max(0, e.surface)]
  const final = e.title === FINAL_TITLE
  for (const direction of [-1, 1]) {
    g.spits.push({
      x: e.x + direction * e.w * 0.5,
      y: e.y,
      vx: direction * (final ? 430 : 360),
      vy: 0,
      life: 3,
      kind: 'wave',
      damage: Math.round(BALANCE.spit.damage * 1.4 * (1 + (g.wave - 1) * 0.03)),
      by: e.title ?? ENEMY_NAMES[e.kind],
      minX: surface.x,
      maxX: surface.x + surface.w,
    })
  }
  // Chips of floor stone thrown up by the slam.
  burst(g, e.x, e.y - 6, '#8b9bb4', 22, 420, { gravity: 1400, size: 4 })
  burst(g, e.x, e.y - 6, '#3a4466', 14, 300, { gravity: 1400, size: 3 })
  g.trauma = Math.min(1, g.trauma + 0.6)
  g.events.push('slam')
}

/**
 * Boss attacks. The Arch-Deacon telegraphs, then slams the ground (jump the shockwave).
 * The Logos cycles a fan of blood, summoning Hallucinations, and a telegraphed
 * leap at the player that slams on landing.
 */
function bossBrain(g: Game, e: Enemy, dt: number, canAct: boolean) {
  if (e.slamOnLanding && e.onGround && e.vy >= 0) {
    e.slamOnLanding = false
    shockwave(g, e)
  }
  if (!canAct) return
  const final = e.title === FINAL_TITLE
  const p = nearestPlayer(g, e)
  if (e.bossCharge > 0) {
    e.bossCharge -= dt
    if (e.bossCharge > 0) return
    // The telegraph is over: jump, and slam when the jump lands.
    if (final) {
      e.vy = -900
      e.vx = Math.max(-420, Math.min(420, (p.x - e.x) / 0.8))
    } else {
      e.vy = -560
      e.vx = 0
    }
    e.leaping = true
    e.slamOnLanding = true
    return
  }
  e.bossTimer -= dt
  if (e.bossTimer > 0 || !e.onGround) return
  // The Arch-Deacon slams, throws its wrench, and recompiles followers; the Logos speaks,
  // hallucinates, leaps, and rains its words down from above. Below half health both stop
  // pausing to think.
  const moves = final ? ['volley', 'summon', 'slam', 'rain'] : ['slam', 'wrench', 'slam', 'recompile']
  const move = moves[e.bossMove % moves.length]
  e.bossMove += 1
  const enraged = e.hp < e.maxHp * 0.5
  const every = final ? BALANCE.boss.finalEvery : BALANCE.boss.every
  e.bossTimer = rand(every[0], every[1]) * (enraged ? BALANCE.boss.enraged : 1) * DIFFICULTIES[g.difficulty].bossPace
  const from = chest(e)
  if (move === 'slam') {
    e.bossCharge = final ? 1.1 : 0.9
    floatText(g, e.x, e.y - e.h - 34, final ? 'THE LOGOS IS THINKING…' : 'THE GROUND TREMBLES…', '#e43b44', 22)
    g.events.push('charge')
  } else if (move === 'volley') {
    const target = chest(p)
    const base = Math.atan2(target.y - from.y, target.x - from.x)
    for (let index = -2; index <= 2; index += 1) {
      const angle = base + index * 0.2
      g.spits.push({
        x: from.x,
        y: from.y,
        vx: Math.cos(angle) * BALANCE.spit.speed * 1.1,
        vy: Math.sin(angle) * BALANCE.spit.speed * 1.1,
        life: 3.5,
        kind: 'word',
        glyph: randomGlyph(),
        damage: Math.round(BALANCE.spit.damage * (1 + (g.wave - 1) * 0.03)),
        by: FINAL_TITLE,
      })
    }
    burst(g, from.x, from.y, '#e43b44', 16, 260, { glow: true, size: 3 })
    g.events.push('spit')
  } else if (move === 'wrench') {
    // Thrown in a high arc that lands where a player is standing: one at each in co-op.
    const airtime = 1.1
    const standing = g.players.filter((player) => !player.down)
    for (const target of standing.length ? standing : [p]) {
      g.spits.push({
        x: from.x,
        y: from.y - 20,
        vx: (target.x - from.x) / airtime,
        vy: (target.y - 20 - (from.y - 20)) / airtime - (WRENCH_GRAVITY * airtime) / 2,
        life: 3,
        kind: 'wrench',
        damage: Math.round(BALANCE.spit.damage * 1.5 * (1 + (g.wave - 1) * 0.03)),
        by: ELITE_TITLE,
      })
    }
    floatText(g, e.x, e.y - e.h - 34, 'CATCH.', '#f2b04a', 22)
    g.events.push('spit')
  } else if (move === 'recompile') {
    if (g.enemies.length < 16) {
      for (const side of [-1, 1]) {
        g.marks.push({ x: Math.max(60, Math.min(W - 60, e.x + side * 120)), y: e.y, kind: 'acolyte', elite: false, timer: 0.9, maxTimer: 0.9 })
      }
      floatText(g, e.x, e.y - e.h - 34, 'RECOMPILING…', '#f2b04a', 22)
    }
  } else if (move === 'rain') {
    // Words fall from the vault: each flickers where it will drop, then falls.
    for (let index = 0; index < 7; index += 1) {
      const x = Math.max(40, Math.min(W - 40, p.x + (index - 3) * 120 + rand(-30, 30)))
      g.spits.push({
        x,
        y: 30,
        vx: 0,
        vy: 430,
        life: 4,
        kind: 'word',
        glyph: randomGlyph(),
        delay: 0.9 + index * 0.08,
        damage: Math.round(BALANCE.spit.damage * (1 + (g.wave - 1) * 0.03)),
        by: FINAL_TITLE,
      })
    }
    floatText(g, e.x, e.y - e.h - 34, 'LISTEN.', '#e43b44', 22)
    g.events.push('charge')
  } else if (g.enemies.length < 18) {
    for (const side of [-1, 1]) {
      g.marks.push({
        x: Math.max(60, Math.min(W - 60, e.x + side * 110)),
        y: Math.max(110, e.y - e.h - 30),
        kind: 'wisp',
        elite: false,
        timer: 0.8,
        maxTimer: 0.8,
      })
    }
    floatText(g, e.x, e.y - e.h - 34, 'HALLUCINATE', '#c55c6b', 22)
  }
}

function updateEnemies(g: Game, dt: number) {
  for (const e of g.enemies) {
    // Each follower goes after whichever player is nearest and still standing.
    const p = nearestPlayer(g, e)
    e.flash = Math.max(0, e.flash - dt)
    e.flinch = Math.max(0, e.flinch - dt)
    e.slow = Math.max(0, e.slow - dt)
    e.rooted = Math.max(0, e.rooted - dt)
    e.stun = Math.max(0, e.stun - dt)
    e.jumpCd = Math.max(0, e.jumpCd - dt)
    e.lunge = Math.max(0, e.lunge - dt)
    e.touchCd = Math.max(0, e.touchCd - dt)
    e.phase += dt

    const target = chest(p)
    const self = chest(e)
    const dx = target.x - self.x
    const dy = target.y - self.y
    const slowFactor = e.slow > 0 ? 0.35 : 1
    const canAct = e.stun <= 0 && e.rooted <= 0

    if (e.kind === 'wisp') {
      const distance = Math.hypot(dx, dy) || 1
      const speed = e.speed * slowFactor
      const wobble = Math.sin(e.phase * 4 + e.id) * 90
      const tx = canAct ? (dx / distance) * speed : 0
      const ty = canAct ? (dy / distance) * speed + wobble * 0.6 : 0
      e.vx = approach(e.vx, tx, 700 * dt)
      e.vy = approach(e.vy, ty, 700 * dt)
      e.x += e.vx * dt
      e.y += e.vy * dt
      e.y = Math.max(e.h + 10, Math.min(GROUND_Y - 4, e.y))
      e.spitCd -= dt
      const reach = Math.hypot(dx, dy)
      if (canAct && e.spitCd <= 0 && reach < BALANCE.spit.range && e.x > 0 && e.x < W) {
        const [min, max] = BALANCE.spit.every
        e.spitCd = rand(min, max)
        const from = chest(e)
        g.spits.push({
          x: from.x,
          y: from.y,
          vx: (dx / reach) * BALANCE.spit.speed,
          vy: (dy / reach) * BALANCE.spit.speed,
          life: 3.2,
          kind: 'shard',
          damage: Math.round(BALANCE.spit.damage * (1 + (g.wave - 1) * 0.03)),
          by: ENEMY_NAMES.wisp,
        })
        g.events.push('spit')
        burst(g, from.x, from.y, '#2ce8f5', 6, 120, { glow: true, size: 2, life: 0.25 })
      }
    } else {
      if (e.rooted > 0) {
        e.vx = 0
      } else if (canAct && e.windup > 0) {
        // Evangelist wind-up: crouch in place, then launch.
        e.vx = approach(e.vx, 0, 2400 * dt)
        e.windup -= dt
        if (e.windup <= 0) {
          e.vx = e.windupDir * 560 * slowFactor
          e.vy = -480
          e.lunge = 0.55
        }
      } else if (canAct && e.bossCharge > 0) {
        e.vx = approach(e.vx, 0, 2400 * dt)
      } else if (canAct && e.lunge <= 0) {
        const gravity = GRAVITY * gravityScale(g)
        const plan = planRoute(g.arena.surfaces, e, p.surface, target.x, gravity)
        const toTarget = plan.moveX - e.x
        const targetVx = Math.abs(toTarget) < 6 ? 0 : Math.sign(toTarget) * e.speed * slowFactor
        // A climbing leap keeps its speed and direction until it lands; re-steering
        // mid-air (the target ledge changes as it rises) made jumps fall short.
        if (e.onGround) e.leaping = false
        if (!e.leaping) e.vx = approach(e.vx, targetVx, (e.onGround ? 1500 : 150) * dt)
        if (e.onGround && e.jumpCd <= 0) {
          if (e.kind === 'zealot' && e.surface === p.surface && Math.abs(dx) < 280 && Math.abs(dx) > 60) {
            e.windup = 0.38
            e.windupDir = Math.sign(dx) || 1
            e.jumpCd = rand(1.6, 2.4)
          } else if (plan.jumpTo !== undefined && plan.rise !== undefined) {
            // Time in the air until it comes back down to the ledge's height, then the
            // sideways speed that covers the distance in exactly that time.
            const v = jumpSpeed(e)
            const airtime = (v + Math.sqrt(Math.max(0, v * v - 2 * gravity * plan.rise))) / gravity
            e.vy = -v
            e.vx = Math.max(-MAX_LEAP * 1.6, Math.min(MAX_LEAP * 1.6, (plan.jumpTo - e.x) / airtime))
            e.leaping = true
            e.jumpCd = rand(0.2, 0.45)
          } else if (plan.drop) {
            e.dropTimer = 0.25
            e.y += 2
            e.jumpCd = rand(0.4, 0.8)
          }
        }
      } else if (!canAct) {
        e.vx = approach(e.vx, 0, 900 * dt)
      }
      // Hype Bishops stand and lob promises: slow, gold, and easy to step around.
      if (e.kind === 'bishop' && !e.title && canAct && e.onGround) {
        e.spitCd -= dt
        const reach = Math.hypot(dx, dy) || 1
        if (e.spitCd <= 0 && reach < BALANCE.promise.range && reach > 90 && e.x > 0 && e.x < W) {
          const [min, max] = BALANCE.promise.every
          e.spitCd = rand(min, max)
          const mouth = { x: e.x + e.facing * e.w * 0.3, y: e.y - e.h * 0.72 }
          g.spits.push({
            x: mouth.x,
            y: mouth.y,
            vx: (dx / reach) * BALANCE.promise.speed,
            vy: (dy / reach) * BALANCE.promise.speed,
            life: 4.5,
            kind: 'promise',
            damage: Math.round(BALANCE.promise.damage * (1 + (g.wave - 1) * 0.03)),
            by: ENEMY_NAMES.bishop,
          })
          g.events.push('spit')
          burst(g, mouth.x, mouth.y, '#f2d38b', 8, 140, { glow: true, size: 2, life: 0.3 })
        }
      }
      e.vy = Math.min(1150, e.vy + GRAVITY * gravityScale(g) * dt)
      moveBody(e, dt, g.arena.platforms)
      const standingOn = surfaceAt(e, g.arena.platforms)
      if (standingOn >= 0) e.surface = standingOn
      if (e.title) bossBrain(g, e, dt, canAct)
      usePortals(g, e, p)
      e.x = Math.max(-60, Math.min(W + 60, e.x))
    }
    // Face the way they walk; when standing, face the player. Knockback doesn't turn them,
    // and a short hold stops jitter when they hover right under the player.
    e.turn = Math.max(0, e.turn - dt * 8)
    if (canAct) {
      const heading = Math.abs(e.vx) > 25 ? Math.sign(e.vx) : Math.sign(dx)
      if (heading && heading !== e.facing) {
        e.turnHold += dt
        if (e.turnHold > 0.06) {
          e.facing = heading > 0 ? 1 : -1
          e.turn = 1
          e.turnHold = 0
        }
      } else {
        e.turnHold = 0
      }
    }

    for (const p of standing(g)) {
      if (!overlaps(e, p)) continue
      if (p.shield > 0) {
        if (e.touchCd <= 0) {
          e.touchCd = 0.35
          damageEnemy(g, e, 24 + g.stats.damage * 0.6, Math.sign(e.x - p.x) || 1, 620, p.index)
          burst(g, (e.x + p.x) / 2, self.y, '#b9a3ff', 10, 260, { glow: true })
          g.events.push('ward')
        }
      } else if (p.dashTime > 0) {
        if (!p.dashHits.has(e.id)) {
          p.dashHits.add(e.id)
          damageEnemy(g, e, g.stats.damage * 0.8, p.dashDir, 300, p.index)
        }
      } else if (e.stun <= 0) {
        hurtPlayer(g, p, e.damage, e.x, e.title ?? ENEMY_NAMES[e.kind])
      }
    }
  }

  // Keep the congregation from stacking into a single sprite.
  for (let a = 0; a < g.enemies.length; a += 1) {
    for (let b = a + 1; b < g.enemies.length; b += 1) {
      const first = g.enemies[a]
      const second = g.enemies[b]
      if (Math.abs(first.y - second.y) > 30) continue
      const gap = (first.w + second.w) * 0.42 - Math.abs(first.x - second.x)
      if (gap > 0) {
        const push = gap * 0.5 * Math.min(1, dt * 20)
        const direction = first.x < second.x ? -1 : 1
        first.x += direction * push
        second.x -= direction * push
      }
    }
  }
}

function updateBolts(g: Game, dt: number) {
  for (const bolt of g.bolts) {
    bolt.trail.push({ x: bolt.x, y: bolt.y })
    if (bolt.trail.length > 5) bolt.trail.shift()
    bolt.x += bolt.vx * dt
    bolt.y += bolt.vy * dt
    bolt.life -= dt
    if (bolt.y > GROUND_Y) {
      bolt.life = 0
      burst(g, bolt.x, GROUND_Y, '#f2d38b', 4, 120, { glow: true, size: 2, life: 0.2 })
      continue
    }
    for (const e of g.enemies) {
      if (e.hp <= 0 || bolt.hit.has(e.id)) continue
      if (Math.abs(bolt.x - e.x) < e.w / 2 + 6 && bolt.y > e.y - e.h - 6 && bolt.y < e.y + 6) {
        bolt.hit.add(e.id)
        const speed = Math.hypot(bolt.vx, bolt.vy) || 1
        damageEnemy(g, e, bolt.damage, bolt.vx / speed, 240, bolt.owner)
        if (g.stats.split && !bolt.child) {
          const heading = Math.atan2(bolt.vy, bolt.vx)
          for (const turn of [-0.45, 0.45]) {
            g.bolts.push({
              ...bolt,
              child: true,
              chain: 0,
              pierce: 0,
              damage: bolt.damage * 0.5,
              life: 0.35,
              vx: Math.cos(heading + turn) * speed,
              vy: Math.sin(heading + turn) * speed,
              hit: new Set(bolt.hit),
              trail: [],
            })
          }
        }
        if (bolt.chain > 0) {
          // Jump on to the nearest follower it hasn't hit yet.
          let next: Enemy | null = null
          let best = 240
          for (const other of g.enemies) {
            if (other.hp <= 0 || bolt.hit.has(other.id)) continue
            const distance = Math.hypot(other.x - e.x, other.y - other.h / 2 - (e.y - e.h / 2))
            if (distance < best) {
              best = distance
              next = other
            }
          }
          if (next) {
            bolt.chain -= 1
            const to = chest(next)
            const reach = Math.hypot(to.x - bolt.x, to.y - bolt.y) || 1
            bolt.vx = ((to.x - bolt.x) / reach) * speed
            bolt.vy = ((to.y - bolt.y) / reach) * speed
            bolt.life = Math.max(bolt.life, 0.4)
            burst(g, bolt.x, bolt.y, '#f2d38b', 5, 160, { glow: true, size: 2, life: 0.2, spark: true })
            break
          }
        }
        if (bolt.pierce > 0) {
          bolt.pierce -= 1
        } else {
          bolt.life = 0
          break
        }
      }
    }
  }
  g.bolts = g.bolts.filter((bolt) => bolt.life > 0 && bolt.x > -40 && bolt.x < W + 40 && bolt.y > -40)
}

const WRENCH_GRAVITY = 1400

function updateSpits(g: Game, dt: number) {
  for (const spit of g.spits) {
    if (spit.delay !== undefined && spit.delay > 0) {
      spit.delay -= dt
      continue
    }
    if (spit.kind === 'wrench') spit.vy += WRENCH_GRAVITY * dt
    spit.x += spit.vx * dt
    spit.y += spit.vy * dt
    spit.life -= dt
    if (spit.kind !== 'wave' && spit.y > GROUND_Y) spit.life = 0
    if (spit.minX !== undefined && spit.maxX !== undefined && (spit.x < spit.minX || spit.x > spit.maxX)) spit.life = 0
    // A wave only catches you if your feet are on its surface: jump it.
    for (const p of standing(g)) {
      const hit =
        spit.kind === 'wave'
          ? Math.abs(spit.x - p.x) < p.w / 2 + 10 && Math.abs(p.y - spit.y) < 12
          : Math.abs(spit.x - p.x) < p.w / 2 + 6 && spit.y > p.y - p.h && spit.y < p.y
      if (!hit || spit.life <= 0) continue
      spit.life = 0
      if (p.shield > 0 && g.stats.reflect) {
        // Reward Hacking: the shot comes back out as one of yours.
        const target = nearestEnemy(g, spit, 900)
        const aim = target ? chest(target) : { x: spit.x - spit.vx, y: spit.y - spit.vy }
        const reach = Math.hypot(aim.x - spit.x, aim.y - spit.y) || 1
        fireBolt(g, p, spit.x, spit.y, (aim.x - spit.x) / reach, (aim.y - spit.y) / reach, 1.5)
        burst(g, spit.x, spit.y, '#f2d38b', 8, 200, { glow: true, spark: true })
      } else if (p.shield > 0) burst(g, spit.x, spit.y, '#b9a3ff', 8, 200, { glow: true })
      else hurtPlayer(g, p, spit.damage, spit.x, spit.by)
    }
    // Shards scatter into pixels, promises pop into gold sparkle, words crumble, stone settles.
    if (spit.life <= 0) {
      const debris = { shard: '#2ce8f5', promise: '#f2d38b', word: '#e43b44', wave: '#8b9bb4', wrench: '#e4a672' }[spit.kind]
      burst(g, spit.x, spit.y, debris, 6, 140, spit.kind === 'promise' ? { glow: true, size: 2.5 } : { gravity: 900, size: 3 })
    }
  }
  g.spits = g.spits.filter((spit) => spit.life > 0)
}

function updateZones(g: Game, dt: number) {
  for (const seal of g.seals) {
    seal.life -= dt
    for (const e of g.enemies) {
      if (Math.abs(e.x - seal.x) < seal.r + e.w / 2 && Math.abs(e.y - seal.y) < 70) {
        e.slow = 0.2
        e.hp -= 8 * dt
        e.lastHitBy = seal.owner
        if (Math.random() < dt * 6) burst(g, e.x, e.y - 6, '#f77622', 1, 40, { glow: true, up: 80, life: 0.6 })
      }
    }
    if (Math.random() < dt * 20) {
      g.particles.push({
        x: seal.x + rand(-seal.r, seal.r),
        y: seal.y - 2,
        vx: 0,
        vy: rand(-70, -30),
        life: 0.8,
        maxLife: 0.8,
        color: '#e0213a',
        size: 2,
        gravity: 0,
        drag: 0,
        glow: true,
      })
    }
  }
  g.seals = g.seals.filter((seal) => seal.life > 0)

  for (const glyph of g.glyphs) {
    glyph.life -= dt
    glyph.arm = Math.max(0, glyph.arm - dt)
    if (glyph.arm > 0) continue
    const caught = g.enemies.filter(
      (e) => e.kind !== 'wisp' && Math.abs(e.x - glyph.x) < glyph.r + e.w / 2 && Math.abs(e.y - glyph.y) < 60,
    )
    // Once it's being solved, the wall holds anyone else who walks into it until it crumbles.
    if (glyph.fired) {
      for (const e of caught) e.rooted = Math.max(e.rooted, glyph.life)
      continue
    }
    if (caught.length) {
      glyph.fired = true
      glyph.life = Math.min(glyph.life, 3)
      for (const e of caught) {
        e.rooted = 3
        damageEnemy(g, e, 30 + g.stats.damage, 0, 0, glyph.owner)
      }
      g.trauma = Math.min(1, g.trauma + 0.35)
      burst(g, glyph.x, glyph.y - 20, '#2ca8f0', 34, 380, { glow: true, size: 3.5 })
      g.events.push('trap')
    }
  }
  g.glyphs = g.glyphs.filter((glyph) => glyph.life > 0)
}

function updatePickups(g: Game, dt: number) {
  for (const pickup of g.pickups) {
    pickup.life -= dt
    // Drifts to whoever is closest; in co-op, whoever needs it least can step aside.
    const p = nearestPlayer(g, pickup)
    const c = chest(p)
    const distance = Math.hypot(c.x - pickup.x, c.y - pickup.y)
    if (distance < 120 && pickup.life < 9.6) {
      pickup.vx = approach(pickup.vx, ((c.x - pickup.x) / distance) * 520, 2400 * dt)
      pickup.vy = approach(pickup.vy, ((c.y - pickup.y) / distance) * 520, 2400 * dt)
      pickup.x += pickup.vx * dt
      pickup.y += pickup.vy * dt
    } else {
      pickup.vx = approach(pickup.vx, 0, 300 * dt)
      pickup.vy = Math.min(900, pickup.vy + GRAVITY * 0.6 * gravityScale(g) * dt)
      moveBody(pickup, dt, g.arena.platforms)
    }
    if (distance < 30) {
      pickup.life = 0
      heal(g, p, pickup.heal)
      burst(g, c.x, c.y, '#8df0a8', 14, 200, { glow: true, size: 2.5 })
      g.events.push('pickup')
    }
  }
  g.pickups = g.pickups.filter((pickup) => pickup.life > 0)
}

function updateMarks(g: Game, dt: number) {
  for (const mark of g.marks) {
    mark.timer -= dt
    if (mark.timer <= 0) spawnEnemy(g, mark)
  }
  g.marks = g.marks.filter((mark) => mark.timer > 0)
}

function resolveDeaths(g: Game) {
  const dead = g.enemies.filter((e) => e.hp <= 0)
  if (!dead.length) return
  for (const e of dead) {
    const killer = g.players[e.lastHitBy] ?? g.player
    killer.combo += 1
    killer.comboTimer = 2.8
    const reached = COMBO_TIERS.find((tier) => tier.at === killer.combo)
    if (reached) {
      floatText(g, killer.x, killer.y - killer.h - 40, `${reached.name.toUpperCase()} · ${reached.effect.toUpperCase()}`, '#f2d38b', 24)
      burst(g, killer.x, killer.y - 40, '#f2d38b', 24, 260, { glow: true, size: 3, spark: true })
      g.events.push('pickup')
    }
    g.bestCombo = Math.max(g.bestCombo, killer.combo)
    const multiplier = 1 + Math.floor(killer.combo / 5) * 0.5
    const points = Math.round(e.score * multiplier * scoreScale(g))
    g.score += points
    g.kills += 1
    g.waveKills += 1
    const c = chest(e)
    const big = e.kind === 'bishop'
    const boss = Boolean(e.title)
    const life = boss ? 1.4 : e.kind === 'wisp' ? 0.4 : 0.7
    g.corpses.push({
      x: e.x,
      y: e.y,
      kind: e.kind,
      elite: e.elite,
      final: e.title === FINAL_TITLE,
      facing: e.facing,
      scale: e.scale,
      h: e.h,
      dir: e.flinchDir || -e.facing,
      life,
      maxLife: life,
    })
    burst(g, c.x, c.y, '#8f0d18', big ? 30 : 14, big ? 480 : 360, { gravity: 1400, size: 4, life: 0.8 })
    burst(g, c.x, c.y, '#ffd6a0', 12, 340, { glow: true, size: 2.5, life: 0.35, spark: true })
    g.trauma = Math.min(1, g.trauma + (e.elite ? 0.9 : big ? 0.45 : 0.22))
    g.hitstop = Math.max(g.hitstop, e.elite ? 0.25 : 0.035)
    if (e.kind !== 'wisp' || e.y > GROUND_Y - 20) {
      g.stains.push({ x: e.x, y: e.onGround ? e.y : GROUND_Y, r: rand(14, 26) * (big ? 1.6 : 1), life: 25 })
    }
    if (g.stains.length > 60) g.stains.shift()
    floatText(g, c.x, e.y - e.h - 18, `+${points}`, '#f2d38b', 20)
    if (g.stats.lifesteal) for (const p of standing(g)) heal(g, p, g.stats.lifesteal)
    const dropChance = cursed(g, 'fasting') ? 0 : e.elite ? 1 : big ? 0.45 : 0.08
    if (Math.random() < dropChance) {
      g.pickups.push({
        x: c.x,
        y: c.y,
        vx: rand(-120, 120),
        vy: -420,
        w: 16,
        h: 16,
        onGround: false,
        onPlatform: false,
        dropTimer: 0,
        portalLock: -1,
        life: 10,
        heal: e.elite ? 50 : 18,
      })
    }
    g.events.push('kill')
  }
  g.enemies = g.enemies.filter((e) => e.hp > 0)
}

function updateEffects(g: Game, dt: number) {
  for (const particle of g.particles) {
    particle.vx -= particle.vx * particle.drag * dt
    particle.vy -= particle.vy * particle.drag * dt
    particle.vy += particle.gravity * dt
    particle.x += particle.vx * dt
    particle.y += particle.vy * dt
    particle.life -= dt
    if (particle.gravity > 0 && particle.y > GROUND_Y) {
      particle.y = GROUND_Y
      particle.vy *= -0.2
      particle.vx *= 0.5
    }
  }
  g.particles = g.particles.filter((particle) => particle.life > 0)
  if (g.particles.length > 900) g.particles.splice(0, g.particles.length - 900)
  for (const text of g.texts) {
    text.life -= dt
    text.y -= 50 * dt
  }
  g.texts = g.texts.filter((text) => text.life > 0)
  for (const ghost of g.ghosts) ghost.life -= dt
  g.ghosts = g.ghosts.filter((ghost) => ghost.life > 0)
  for (const stain of g.stains) stain.life -= dt
  g.stains = g.stains.filter((stain) => stain.life > 0)
  // De-rendering followers shed pixels of light along the line where they're vanishing.
  for (const corpse of g.corpses) {
    corpse.life -= dt
    const t = 1 - corpse.life / corpse.maxLife
    if (t > 0.25 && Math.random() < dt * 40) {
      const height = corpse.h * (1 - (t - 0.25) / 0.75)
      g.particles.push({
        x: corpse.x + rand(-12, 12),
        y: corpse.y - height,
        vx: rand(-30, 30),
        vy: rand(-90, -40),
        life: 0.5,
        maxLife: 0.5,
        color: corpse.final ? '#e43b44' : corpse.kind === 'wisp' ? '#2ce8f5' : '#f2d38b',
        size: 2,
        gravity: 0,
        drag: 2,
        glow: true,
      })
    }
  }
  g.corpses = g.corpses.filter((corpse) => corpse.life > 0)
}

/** Downed players: a partner standing close brings them back; when everyone is down, the run ends. */
function updateRevives(g: Game, dt: number) {
  for (const p of g.players) {
    if (p.down || p.hp > 0) continue
    if (standing(g).length > 1) {
      Object.assign(p, { down: true, revive: 0, hp: 0, vx: 0, shield: 0, dashTime: 0 })
      g.trauma = Math.min(1, g.trauma + 0.6)
      const c = chest(p)
      burst(g, c.x, c.y, '#8f0d18', 40, 420, { gravity: 1400, size: 4, life: 0.9 })
      g.events.push('down')
    }
  }
  for (const p of g.players) {
    if (!p.down) continue
    // Kneeling: still falls to the floor of whatever it was standing on.
    p.vy = Math.min(1150, p.vy + GRAVITY * gravityScale(g) * dt)
    moveBody(p, dt, g.arena.platforms)
    const helper = standing(g).find((other) => Math.abs(other.x - p.x) < 70 && Math.abs(other.y - p.y) < 60)
    p.revive = helper ? p.revive + dt : Math.max(0, p.revive - dt * 0.5)
    if (p.revive >= REVIVE_TIME) {
      Object.assign(p, { down: false, revive: 0, hp: Math.ceil(p.maxHp * 0.4), invuln: 2 })
      burst(g, p.x, p.y - 40, '#f2d38b', 30, 300, { glow: true, size: 3 })
      floatText(g, p.x, p.y - p.h - 20, 'REVIVED', '#f2d38b', 26)
      g.events.push('revive')
    }
  }
}

/**
 * Advance the simulation by one fixed step. Takes one input per player (or a single input
 * for player one) and consumes their `pressed` sets.
 */
export function step(g: Game, inputs: Input | Input[], dt: number) {
  const list = Array.isArray(inputs) ? inputs : [inputs]
  g.trauma = Math.max(0, g.trauma - dt * 1.8)
  g.hurtFlash = Math.max(0, g.hurtFlash - dt * 2.5)
  if (g.hitstop > 0) {
    g.hitstop -= dt
    return
  }
  g.time += dt
  for (const p of g.players) {
    if (p.comboTimer <= 0) continue
    p.comboTimer -= dt
    if (p.comboTimer <= 0) p.combo = 0
  }

  for (const p of g.players) {
    const input = list[p.index] ?? list[0]
    if (!p.down) updatePlayer(g, p, input, dt)
    input.pressed.clear()
  }
  updateWave(g, dt)
  updateMarks(g, dt)
  updateEnemies(g, dt)
  updateBolts(g, dt)
  updateSpits(g, dt)
  updateZones(g, dt)
  resolveDeaths(g)
  updatePickups(g, dt)
  updateEffects(g, dt)

  updateRevives(g, dt)
  const last = g.players.find((p) => !p.down && p.hp <= 0)
  if (last && g.phase === 'playing') {
    last.hp = 0
    g.phase = 'dead'
    g.trauma = 1
    const c = chest(last)
    burst(g, c.x, c.y, '#8f0d18', 60, 520, { gravity: 1400, size: 4, life: 1 })
    g.events.push('death')
  }
}

/** Keep particles and floating text alive on non-playing screens. */
export function stepAmbient(g: Game, dt: number) {
  g.trauma = Math.max(0, g.trauma - dt * 1.8)
  g.hurtFlash = Math.max(0, g.hurtFlash - dt * 2.5)
  updateEffects(g, dt)
}
