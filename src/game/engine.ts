// Simulation for AI Blood Cathedral. Pure data + a fixed-step `step` function;
// rendering, audio and React only read from the Game object.

export const W = 1280
export const H = 720
export const GROUND_Y = 640
/** The run ends here: sermon 20 is the Blood Model's own. */
export const MAX_WAVE = 20

export type Phase = 'title' | 'playing' | 'paused' | 'upgrade' | 'dead' | 'won'
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
  /** Index into SURFACES of the floor or ledge it last stood on (-1 before landing). */
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
  /** Nameplate for bosses. */
  title?: string
}

export type Bolt = Point & {
  vx: number
  vy: number
  life: number
  damage: number
  pierce: number
  hit: Set<number>
  trail: Point[]
}
export type Seal = Point & { r: number; life: number; maxLife: number }
export type Glyph = Point & { r: number; life: number; arm: number; fired: boolean }
export type Particle = Point & {
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
  /** 'orb' flies at you; 'wave' is a slam shockwave that rolls along one ledge or the floor. */
  kind: 'orb' | 'wave'
  damage: number
  by: string
  /** Waves stop at the edges of the surface they were slammed on. */
  minX?: number
  maxX?: number
}
export type Ghost = Point & { facing: 1 | -1; life: number }
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
}

export type Upgrade = {
  id: string
  eyebrow: string
  title: string
  description: string
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
  time: number
  player: Player
  enemies: Enemy[]
  bolts: Bolt[]
  seals: Seal[]
  glyphs: Glyph[]
  particles: Particle[]
  texts: FloatText[]
  pickups: Pickup[]
  marks: SpawnMark[]
  ghosts: Ghost[]
  stains: Stain[]
  spits: Spit[]
  cooldowns: Record<AbilityKey, number>
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
  combo: number
  comboTimer: number
  bestCombo: number
  trauma: number
  hitstop: number
  hurtFlash: number
  nextId: number
  events: Sfx[]
  /** The surface the player last stood on, for follower pathfinding. */
  playerSurface: number
  /** Who landed the last hit, for the 'Converted by…' line on the results screen. */
  lastHurtBy: string
  /** This sermon's twist, if it is cursed. */
  curse: Curse | null
}

/** Widths are whole multiples of the 60px brick block the renderer tiles them with. */
export const BRICK = { w: 60, h: 34 }
export const PLATFORMS: Platform[] = [
  { x: 90, y: 530, w: 240 },
  { x: 950, y: 530, w: 240 },
  { x: 490, y: 430, w: 300 },
  { x: 170, y: 320, w: 240 },
  { x: 870, y: 320, w: 240 },
  { x: 520, y: 212, w: 240 },
]

/**
 * Candles flank the windows on wall sconces, centred on each window's height.
 * `y` is where the candelabra stands (the top of its shelf); the flames sit ~14px above.
 */
export const CANDLES: (Point & { shelf?: boolean })[] = [
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
]

/** Pentagram gates: stepping into one sends you out of its partner. Pairs cross the nave. */
export type Portal = Point & { pair: number; color: 'red' | 'blue' }
export const PORTALS: Portal[] = [
  // Floor gates flank the basin under the centre ledge, where there is headroom.
  { x: 547, y: GROUND_Y, pair: 1, color: 'red' },
  { x: 910, y: 320, pair: 0, color: 'red' },
  { x: 733, y: GROUND_Y, pair: 3, color: 'blue' },
  { x: 370, y: 320, pair: 2, color: 'blue' },
]
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
export const FINAL_TITLE = 'The Blood Model'

export const abilityMeta: Record<
  AbilityKey,
  { label: string; key: string; caption: string; color: string }
> = {
  dash: { label: 'Latent Step', key: 'Shift', caption: 'Dash through followers', color: '#cfd8ff' },
  // Rites have no key: they cast themselves (see autoRites).
  seal: { label: 'Rate Limit', key: '', caption: 'Throttles and burns followers', color: '#d6293b' },
  volley: { label: 'Prompt Volley', key: '', caption: 'Ring of token bolts', color: '#f2d38b' },
  mirror: { label: 'Alignment Mirror', key: '', caption: 'Reflect all contact', color: '#b9a3ff' },
  glyph: { label: 'CAPTCHA Glyph', key: '', caption: 'Stops whatever steps on it', color: '#9d6bff' },
}

export const upgrades: Upgrade[] = [
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
      g.player.maxHp += 25
      heal(g, 40)
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
  bishop: { w: 42, h: 88, hp: 170, speed: 62, damage: 22, kb: 0.7, score: 300, scale: PLAYER_SCALE * (94 / 84) * 1.2 },
  wisp: { w: 26, h: 26, hp: 18, speed: 135, damage: 8, kb: 0, score: 120, scale: 1 },
}

export function makeGame(): Game {
  return {
    phase: 'title',
    time: 0,
    player: {
      x: W / 2,
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
      facing: 1,
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
    },
    enemies: [],
    bolts: [],
    seals: [],
    glyphs: [],
    particles: [],
    texts: [],
    pickups: [],
    marks: [],
    ghosts: [],
    stains: [],
    spits: [],
    cooldowns: { dash: 0, seal: 0, volley: 0, mirror: 0, glyph: 0 },
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
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    trauma: 0,
    hitstop: 0,
    hurtFlash: 0,
    nextId: 1,
    events: [],
    playerSurface: 0,
    lastHurtBy: '',
    curse: null,
  }
}

export function waveTotal(wave: number) {
  return Math.min(BALANCE.wave.max, BALANCE.wave.base + wave * BALANCE.wave.perWave)
}

export const isEliteWave = (wave: number) => wave % 5 === 0

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
function moveBody(body: Body, dt: number) {
  const previousY = body.y
  body.x += body.vx * dt
  body.y += body.vy * dt
  body.dropTimer = Math.max(0, body.dropTimer - dt)
  body.onGround = false
  body.onPlatform = false
  if (body.vy >= 0 && body.dropTimer <= 0) {
    const half = body.w * 0.4
    for (const platform of PLATFORMS) {
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
  options: { gravity?: number; size?: number; glow?: boolean; life?: number; up?: number } = {},
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
    })
  }
}

function floatText(g: Game, x: number, y: number, text: string, color: string, size = 22) {
  g.texts.push({ x: x + rand(-8, 8), y, text, color, life: 0.8, maxLife: 0.8, size })
}

export function heal(g: Game, amount: number) {
  const p = g.player
  const before = p.hp
  p.hp = Math.min(p.maxHp, p.hp + amount)
  const gained = Math.round(p.hp - before)
  if (gained > 0) floatText(g, p.x, p.y - p.h - 10, `+${gained}`, '#8df0a8', 24)
}

function chest(body: Body): Point {
  return { x: body.x, y: body.y - body.h * 0.55 }
}

function hurtPlayer(g: Game, amount: number, fromX: number, by: string) {
  const p = g.player
  if (p.invuln > 0 || p.dashTime > 0 || p.shield > 0) return
  p.hp -= amount
  g.lastHurtBy = by
  p.invuln = 1
  const direction = p.x >= fromX ? 1 : -1
  p.vx = direction * 460
  p.vy = -420
  p.dashTime = 0
  g.trauma = Math.min(1, g.trauma + 0.55)
  g.hitstop = 0.09
  g.hurtFlash = 1
  g.combo = 0
  g.comboTimer = 0
  g.events.push('hurt')
  const c = chest(p)
  burst(g, c.x, c.y, '#ff4b5c', 22, 360, { gravity: 900, size: 3.5 })
  floatText(g, p.x, p.y - p.h - 10, `-${amount}`, '#ff5a6a', 28)
}

function damageEnemy(g: Game, e: Enemy, amount: number, dirX: number, knock: number) {
  if (e.hp <= 0) return
  e.hp -= amount
  e.flash = 0.09
  const resist = 1 - e.kbResist
  e.vx += dirX * knock * resist
  if (e.kind !== 'wisp' && e.onGround) e.vy -= knock * 0.35 * resist
  e.stun = Math.max(e.stun, 0.14 * resist)
  g.events.push('hit')
  const c = chest(e)
  burst(g, c.x, c.y, '#b3121f', 5, 240, { gravity: 1100, size: 3 })
  floatText(g, c.x, e.y - e.h - 6, `${Math.round(amount)}`, '#f6e7c8', 18 + Math.min(10, amount / 6))
}

/**
 * Cursed sermons: from sermon 3, about one normal sermon in four gets a twist.
 * Boss sermons are never cursed.
 */
export type CurseId = 'storm' | 'zealotry' | 'fervour' | 'weightless' | 'fasting'
export type Curse = { id: CurseId; name: string }
export const CURSES: Curse[] = [
  { id: 'storm', name: 'Hallucination Storm' },
  { id: 'zealotry', name: 'Zealotry' },
  { id: 'fervour', name: 'Fervour' },
  { id: 'weightless', name: 'Weightless' },
  { id: 'fasting', name: 'Fasting' },
]
/** What each curse does, for the banner and the code below. */
export const CURSE_RULES: Record<CurseId, string> = {
  storm: 'Only Hallucinations attend',
  zealotry: 'Only Evangelists attend',
  fervour: 'Followers move faster · free will ×1.5',
  weightless: 'Everyone falls slowly',
  fasting: 'No blood vials drop · free will ×1.5',
}
const gravityScale = (g: Game) => (g.curse?.id === 'weightless' ? 0.55 : 1)
const scoreScale = (g: Game) => (g.curse?.id === 'fervour' || g.curse?.id === 'fasting' ? 1.5 : 1)

function weightedKind(wave: number, curse: Curse | null): EnemyKind {
  if (curse?.id === 'storm') return 'wisp'
  if (curse?.id === 'zealotry') return 'zealot'
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
  const kind: EnemyKind = elite ? 'bishop' : weightedKind(g.wave, g.curse)
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
      for (const platform of PLATFORMS) options.push({ x: platform.x + platform.w / 2, y: platform.y })
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
  const speedScale = (1 + Math.min(0.5, (g.wave - 1) * BALANCE.speedPerWave)) * (g.curse?.id === 'fervour' ? 1.3 : 1)
  // The final sermon's boss is the Blood Model itself, in a giant body.
  const final = mark.elite && g.wave >= MAX_WAVE
  const eliteScale = final ? 1.9 : mark.elite ? 1.45 : 1
  const hp = base.hp * hpScale * (final ? 14 : mark.elite ? 5 : 1)
  g.enemies.push({
    id: g.nextId++,
    kind: mark.kind,
    elite: mark.elite,
    title: final ? FINAL_TITLE : mark.elite ? ELITE_TITLE : undefined,
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
    portalLock: PORTALS.findIndex((portal) => Math.abs(portal.x - mark.x) < 30 && Math.abs(portal.y - mark.y) < 4),
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
    facing: mark.x < g.player.x ? 1 : -1,
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
  burst(g, mark.x, mark.y - 30, '#e0213a', 18, 260, { glow: true, size: 3, life: 0.6 })
  g.events.push('spawn')
}

export function startWave(g: Game) {
  g.waveState = 'intro'
  g.waveTimer = 2.2
  g.waveTotal = waveTotal(g.wave)
  g.spawned = 0
  g.waveKills = 0
  g.spawnTimer = 0.2
  const cursable = g.wave >= 3 && !isEliteWave(g.wave) && g.wave < MAX_WAVE
  g.curse = cursable && Math.random() < 0.25 ? CURSES[Math.floor(Math.random() * CURSES.length)] : null
  g.events.push('wave')
}

export function rollOffers(g: Game) {
  const available = upgrades.filter((upgrade) => (g.levels[upgrade.id] ?? 0) < upgrade.max)
  g.offers = [...available].sort(() => Math.random() - 0.5).slice(0, 3)
}

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
function autoRites(g: Game, input: Input) {
  const p = g.player
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
  if (touching && p.invuln <= 0 && p.shield <= 0) triggerAbility(g, 'mirror', input)
  else if (close >= 2 && p.onGround) triggerAbility(g, 'seal', input)
  else if (crowd >= 3) triggerAbility(g, 'volley', input)
  else if (approaching && p.onGround) triggerAbility(g, 'glyph', input)
}

function triggerAbility(g: Game, ability: AbilityKey, input: Input) {
  if (g.cooldowns[ability] > 0) return
  const p = g.player
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
  }
  if (ability === 'seal') {
    g.seals.push({ x: p.x, y: p.y, r: g.stats.sealRadius, life: 5, maxLife: 5 })
    burst(g, p.x, p.y - 8, '#e0213a', 26, 320, { glow: true, size: 3 })
    g.trauma = Math.min(1, g.trauma + 0.2)
  }
  if (ability === 'volley') {
    const count = g.stats.volleyCount
    for (let index = 0; index < count; index += 1) {
      const angle = (index / count) * Math.PI * 2
      fireBolt(g, c.x, c.y, Math.cos(angle), Math.sin(angle), 1.1)
    }
    g.trauma = Math.min(1, g.trauma + 0.3)
  }
  if (ability === 'mirror') {
    p.shield = g.stats.shieldDuration
    burst(g, c.x, c.y, '#b9a3ff', 30, 280, { glow: true, size: 3 })
  }
  if (ability === 'glyph') {
    g.glyphs.push({ x: p.x, y: p.y, r: 95, life: 12, arm: 0.35, fired: false })
    burst(g, p.x, p.y - 6, '#9d6bff', 18, 200, { glow: true, size: 3 })
  }
  g.cooldowns[ability] = g.cooldownMax[ability]
  // Rites cast themselves, so name them as they go off.
  if (ability !== 'dash') {
    const meta = abilityMeta[ability]
    floatText(g, p.x, p.y - p.h - 34, meta.label.toUpperCase(), meta.color, 24)
  }
  g.events.push(ability)
}

function fireBolt(g: Game, x: number, y: number, dx: number, dy: number, damageScale = 1) {
  g.bolts.push({
    x,
    y,
    vx: dx * g.stats.boltSpeed,
    vy: dy * g.stats.boltSpeed,
    life: 0.85,
    damage: g.stats.damage * damageScale,
    pierce: g.stats.pierce,
    hit: new Set(),
    trail: [],
  })
}

function updatePlayer(g: Game, input: Input, dt: number) {
  const p = g.player
  const move = (input.right ? 1 : 0) - (input.left ? 1 : 0)
  const wasGrounded = p.onGround
  const landingSpeed = p.vy

  p.invuln = Math.max(0, p.invuln - dt)
  p.shield = Math.max(0, p.shield - dt)
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
      g.ghosts.push({ x: p.x, y: p.y, facing: p.facing, life: 0.22 })
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

  moveBody(p, dt)
  const playerOn = surfaceAt(p)
  if (playerOn >= 0) g.playerSurface = playerOn
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

  // Auto-fire at the nearest follower in the arena.
  p.fireTimer = Math.max(0, p.fireTimer - dt)
  const origin = chest(p)
  const target = nearestEnemy(g, origin, BALANCE.autoRange)
  if (target && p.fireTimer <= 0 && p.dashTime <= 0) {
    p.fireTimer = g.stats.fireRate
    const aim = chest(target)
    const base = Math.atan2(aim.y - origin.y, aim.x - origin.x)
    const shots = 1 + g.stats.multishot
    for (let index = 0; index < shots; index += 1) {
      const angle = base + (index - (shots - 1) / 2) * 0.13
      fireBolt(g, origin.x + Math.cos(angle) * 18, origin.y + Math.sin(angle) * 18, Math.cos(angle), Math.sin(angle))
    }
    burst(g, origin.x + Math.cos(base) * 22, origin.y + Math.sin(base) * 22, '#f2d38b', 4, 120, { glow: true, size: 2, life: 0.15 })
    g.events.push('shoot')
  }

  for (const key of Object.keys(g.cooldowns) as AbilityKey[]) {
    g.cooldowns[key] = Math.max(0, g.cooldowns[key] - dt)
  }
  if (input.pressed.has('dash')) triggerAbility(g, 'dash', input)
  autoRites(g, input)
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
    if (g.wave >= MAX_WAVE) {
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
const SURFACES: Platform[] = [{ x: -100, y: GROUND_Y, w: W + 200 }, ...PLATFORMS]
const MAX_LEAP = 230

/** Index into SURFACES of whatever the body is standing on, or -1 in the air. */
function surfaceAt(body: Body) {
  if (!body.onGround) return -1
  if (!body.onPlatform) return 0
  const index = PLATFORMS.findIndex(
    (platform) => Math.abs(platform.y - body.y) < 1 && body.x > platform.x - body.w && body.x < platform.x + platform.w + body.w,
  )
  return index + 1
}

const jumpSpeed = (e: Enemy) => (e.kind === 'bishop' ? 860 : 900)
const gapBetween = (a: Platform, b: Platform) => Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w))

function nextHop(from: number, to: number, maxRise: number) {
  const previous = new Map<number, number>([[from, from]])
  const queue = [from]
  while (queue.length) {
    const current = queue.shift()!
    if (current === to) break
    const a = SURFACES[current]
    SURFACES.forEach((b, index) => {
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
function planRoute(e: Enemy, goal: number, fallbackX: number, gravity: number): Plan {
  if (e.surface < 0 || goal < 0 || e.surface === goal) return { moveX: fallbackX }
  const v = jumpSpeed(e)
  const next = nextHop(e.surface, goal, (v * v) / (2 * gravity) - 12)
  if (next < 0) return { moveX: fallbackX }
  const a = SURFACES[e.surface]
  const b = SURFACES[next]
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
  if (body.portalLock >= 0 && !inside(PORTALS[body.portalLock])) body.portalLock = -1
  const entry = PORTALS.findIndex((portal, index) => index !== body.portalLock && inside(portal))
  if (entry < 0) return
  const from = PORTALS[entry]
  const to = PORTALS[from.pair]
  if (target && Math.hypot(to.x - target.x, to.y - target.y) >= Math.hypot(from.x - target.x, from.y - target.y)) return
  const color = from.color === 'red' ? '#e43b44' : '#c0cbdc'
  burst(g, from.x, from.y - 40, color, 16, 260, { glow: true, size: 3 })
  body.x = to.x
  body.y = to.y
  body.vy = Math.min(body.vy, 0)
  body.dropTimer = 0
  body.portalLock = from.pair
  burst(g, to.x, to.y - 40, color, 22, 300, { glow: true, size: 3 })
  g.events.push('portal')
}

/** Slam shockwaves roll both ways along the surface the boss is standing on. */
function shockwave(g: Game, e: Enemy) {
  const surface = SURFACES[Math.max(0, e.surface)]
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
  burst(g, e.x, e.y - 6, '#9e2835', 30, 420, { gravity: 1400, size: 4 })
  g.trauma = Math.min(1, g.trauma + 0.6)
  g.events.push('slam')
}

/**
 * Boss attacks. The Arch-Deacon telegraphs, then slams the ground (jump the shockwave).
 * The Blood Model cycles a fan of blood, summoning Hallucinations, and a telegraphed
 * leap at the player that slams on landing.
 */
function bossBrain(g: Game, e: Enemy, dt: number, canAct: boolean) {
  if (e.slamOnLanding && e.onGround && e.vy >= 0) {
    e.slamOnLanding = false
    shockwave(g, e)
  }
  if (!canAct) return
  const final = e.title === FINAL_TITLE
  const p = g.player
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
  const moves = final ? ['volley', 'summon', 'slam'] : ['slam']
  const move = moves[e.bossMove % moves.length]
  e.bossMove += 1
  e.bossTimer = final ? rand(3, 4) : rand(5.5, 7.5)
  const from = chest(e)
  if (move === 'slam') {
    e.bossCharge = final ? 1.1 : 0.9
    floatText(g, e.x, e.y - e.h - 34, final ? 'THE MODEL IS THINKING…' : 'THE GROUND TREMBLES…', '#e43b44', 22)
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
        kind: 'orb',
        damage: Math.round(BALANCE.spit.damage * (1 + (g.wave - 1) * 0.03)),
        by: FINAL_TITLE,
      })
    }
    burst(g, from.x, from.y, '#e43b44', 16, 260, { glow: true, size: 3 })
    g.events.push('spit')
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
  const p = g.player
  for (const e of g.enemies) {
    e.flash = Math.max(0, e.flash - dt)
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
          kind: 'orb',
          damage: Math.round(BALANCE.spit.damage * (1 + (g.wave - 1) * 0.03)),
          by: ENEMY_NAMES.wisp,
        })
        g.events.push('spit')
        burst(g, from.x, from.y, '#e43b44', 6, 120, { glow: true, size: 2, life: 0.25 })
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
        const plan = planRoute(e, g.playerSurface, target.x, gravity)
        const toTarget = plan.moveX - e.x
        const targetVx = Math.abs(toTarget) < 6 ? 0 : Math.sign(toTarget) * e.speed * slowFactor
        // A climbing leap keeps its speed and direction until it lands; re-steering
        // mid-air (the target ledge changes as it rises) made jumps fall short.
        if (e.onGround) e.leaping = false
        if (!e.leaping) e.vx = approach(e.vx, targetVx, (e.onGround ? 1500 : 150) * dt)
        if (e.onGround && e.jumpCd <= 0) {
          if (e.kind === 'zealot' && e.surface === g.playerSurface && Math.abs(dx) < 280 && Math.abs(dx) > 60) {
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
      e.vy = Math.min(1150, e.vy + GRAVITY * gravityScale(g) * dt)
      moveBody(e, dt)
      const standingOn = surfaceAt(e)
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

    if (overlaps(e, p)) {
      if (p.shield > 0) {
        if (e.touchCd <= 0) {
          e.touchCd = 0.35
          damageEnemy(g, e, 24 + g.stats.damage * 0.6, Math.sign(e.x - p.x) || 1, 620)
          burst(g, (e.x + p.x) / 2, self.y, '#b9a3ff', 10, 260, { glow: true })
          g.events.push('ward')
        }
      } else if (p.dashTime > 0) {
        if (!p.dashHits.has(e.id)) {
          p.dashHits.add(e.id)
          damageEnemy(g, e, g.stats.damage * 0.8, p.dashDir, 300)
        }
      } else if (e.stun <= 0) {
        hurtPlayer(g, e.damage, e.x, e.title ?? ENEMY_NAMES[e.kind])
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
        damageEnemy(g, e, bolt.damage, bolt.vx / speed, 240)
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

function updateSpits(g: Game, dt: number) {
  const p = g.player
  for (const spit of g.spits) {
    spit.x += spit.vx * dt
    spit.y += spit.vy * dt
    spit.life -= dt
    if (spit.kind === 'orb' && spit.y > GROUND_Y) spit.life = 0
    if (spit.minX !== undefined && spit.maxX !== undefined && (spit.x < spit.minX || spit.x > spit.maxX)) spit.life = 0
    // A wave only catches you if your feet are on its surface: jump it.
    const hit =
      spit.kind === 'wave'
        ? Math.abs(spit.x - p.x) < p.w / 2 + 10 && Math.abs(p.y - spit.y) < 12
        : Math.abs(spit.x - p.x) < p.w / 2 + 6 && spit.y > p.y - p.h && spit.y < p.y
    if (hit && spit.life > 0) {
      spit.life = 0
      if (p.shield > 0) burst(g, spit.x, spit.y, '#b9a3ff', 8, 200, { glow: true })
      else hurtPlayer(g, spit.damage, spit.x, spit.by)
    }
    if (spit.life <= 0) burst(g, spit.x, spit.y, '#9e2835', 6, 140, { gravity: 900, size: 3 })
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
        if (Math.random() < dt * 6) burst(g, e.x, e.y - 6, '#e0213a', 1, 40, { glow: true, up: 80, life: 0.6 })
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
    if (glyph.fired || glyph.arm > 0) continue
    const caught = g.enemies.filter(
      (e) => Math.abs(e.x - glyph.x) < glyph.r && Math.abs(e.y - glyph.y) < 90,
    )
    if (caught.length) {
      glyph.fired = true
      glyph.life = Math.min(glyph.life, 0.6)
      for (const e of caught) {
        e.rooted = 3
        damageEnemy(g, e, 30 + g.stats.damage, 0, 0)
      }
      g.trauma = Math.min(1, g.trauma + 0.35)
      burst(g, glyph.x, glyph.y - 20, '#9d6bff', 34, 380, { glow: true, size: 3.5 })
      g.events.push('trap')
    }
  }
  g.glyphs = g.glyphs.filter((glyph) => glyph.life > 0)
}

function updatePickups(g: Game, dt: number) {
  const p = g.player
  for (const pickup of g.pickups) {
    pickup.life -= dt
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
      moveBody(pickup, dt)
    }
    if (distance < 30) {
      pickup.life = 0
      heal(g, pickup.heal)
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
    g.combo += 1
    g.comboTimer = 2.8
    g.bestCombo = Math.max(g.bestCombo, g.combo)
    const multiplier = 1 + Math.floor(g.combo / 5) * 0.5
    const points = Math.round(e.score * multiplier * scoreScale(g))
    g.score += points
    g.kills += 1
    g.waveKills += 1
    const c = chest(e)
    const big = e.kind === 'bishop'
    burst(g, c.x, c.y, '#8f0d18', big ? 46 : 26, big ? 520 : 400, { gravity: 1400, size: 4, life: 0.9 })
    burst(g, c.x, c.y, '#ffd6a0', 10, 300, { glow: true, size: 2.5, life: 0.35 })
    g.trauma = Math.min(1, g.trauma + (e.elite ? 0.9 : big ? 0.45 : 0.22))
    g.hitstop = Math.max(g.hitstop, e.elite ? 0.25 : 0.035)
    if (e.kind !== 'wisp' || e.y > GROUND_Y - 20) {
      g.stains.push({ x: e.x, y: e.onGround ? e.y : GROUND_Y, r: rand(14, 26) * (big ? 1.6 : 1), life: 25 })
    }
    if (g.stains.length > 60) g.stains.shift()
    floatText(g, c.x, e.y - e.h - 18, `+${points}`, '#f2d38b', 20)
    if (g.stats.lifesteal) heal(g, g.stats.lifesteal)
    const dropChance = g.curse?.id === 'fasting' ? 0 : e.elite ? 1 : big ? 0.45 : 0.08
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
}

/** Advance the simulation by one fixed step. Consumes `input.pressed`. */
export function step(g: Game, input: Input, dt: number) {
  g.trauma = Math.max(0, g.trauma - dt * 1.8)
  g.hurtFlash = Math.max(0, g.hurtFlash - dt * 2.5)
  if (g.hitstop > 0) {
    g.hitstop -= dt
    return
  }
  g.time += dt
  if (g.comboTimer > 0) {
    g.comboTimer -= dt
    if (g.comboTimer <= 0) g.combo = 0
  }

  updatePlayer(g, input, dt)
  input.pressed.clear()
  updateWave(g, dt)
  updateMarks(g, dt)
  updateEnemies(g, dt)
  updateBolts(g, dt)
  updateSpits(g, dt)
  updateZones(g, dt)
  resolveDeaths(g)
  updatePickups(g, dt)
  updateEffects(g, dt)

  if (g.player.hp <= 0 && g.phase === 'playing') {
    g.player.hp = 0
    g.phase = 'dead'
    g.trauma = 1
    const c = chest(g.player)
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
