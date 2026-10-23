import atlasUrl from '../assets/gothic-sprites.png'
import cathedralUrl from '../assets/cathedral-sprites.png'
import cryptUrl from '../assets/crypt-sprites.png'
import tombUrl from '../assets/tomb-sprites.png'
import vaultUrl from '../assets/vault-sprites.png'
import followerUrl from '../assets/follower-frames.png'
import handUrl from '../assets/hand-frames.png'
import playerUrl from '../assets/player-frames.png'
import {
  BRICK,
  ARENAS,
  GROUND_Y,
  H,
  PLAYER_SCALE,
  FINAL_TITLE,
  W,
  type Arena,
  type ArenaId,
  type Enemy,
  type Platform,
  type Game,
  type Point,
  type Corpse,
  REVIVE_TIME,
  cursed,
} from './engine'

type Rect = [number, number, number, number]
type Sprite = HTMLCanvasElement
type Layer = { element: HTMLCanvasElement; ctx: CanvasRenderingContext2D }

/**
 * Scenery and effects are drawn onto a half-resolution canvas and scaled up with
 * nearest-neighbour sampling, so everything shares one chunky pixel grid like the
 * sprite sheet. Only the character sprites are drawn at full resolution.
 */
const PX = 2
/**
 * The scenery bleeds past the 1280×720 arena on every side, so windows that aren't
 * 16:9 show more cathedral instead of black bars. Gameplay stays inside the arena.
 */
const BLEED = { x: 320, y: 256 }
const LW = (W + BLEED.x * 2) / PX
const LH = (H + BLEED.y * 2) / PX
const SCENE = { left: -BLEED.x, top: -BLEED.y, right: W + BLEED.x, bottom: H + BLEED.y }
const TAU = Math.PI * 2
const snap = (value: number) => Math.round(value / PX) * PX
/** Centre height of the rose window, under the middle arch. */
const ROSE_Y = 118
/** Each arena's shaft of light: its colour, and the height it falls from. */
const SHAFTS: Record<ArenaId, [string, number]> = {
  cathedral: ['220, 50, 70', ROSE_Y + 60],
  crypt: ['88, 143, 109', 190],
  vault: ['88, 160, 170', 168],
  tomb: ['228, 166, 114', 216],
}

/** Source rectangles in src/assets/gothic-sprites.png (160×128). */
export const ATLAS: Record<string, Rect> = {
  clock: [138, 0, 12, 32],
  mirrorA: [37, 1, 22, 30],
  mirrorB: [69, 1, 22, 30],
  window: [102, 1, 21, 30],
  windowB: [6, 33, 21, 30],
  splat: [2, 14, 29, 13],
  basin: [38, 40, 20, 21],
  candelabra: [138, 43, 13, 14],
  curtainBlue: [65, 64, 30, 30],
  curtainRed: [97, 64, 30, 30],
  brickA: [1, 102, 30, 17],
  brickB: [33, 102, 30, 17],
  painting: [65, 102, 30, 17],
}

/**
 * Source rectangles in src/assets/cathedral-sprites.png: architecture made to match the sheet above.
 * Regenerate with `node scripts/generate-cathedral-sprites.mjs`.
 */
export const CATHEDRAL: Record<string, Rect> = {
  wallA: [0, 0, 32, 16],
  wallB: [32, 0, 32, 16],
  wallC: [64, 0, 32, 16],
  cornice: [96, 0, 16, 8],
  dripA: [112, 0, 5, 10],
  dripB: [118, 0, 5, 14],
  dripC: [124, 0, 5, 7],
  shaft: [0, 16, 20, 16],
  capital: [22, 16, 30, 14],
  base: [54, 16, 30, 12],
  lancet: [86, 16, 40, 72],
  rose: [128, 16, 96, 96],
  archSide: [0, 114, 194, 126],
  archMiddle: [0, 242, 228, 142],
  portalRed0: [0, 386, 24, 40],
  portalRed1: [24, 386, 24, 40],
  portalRed2: [48, 386, 24, 40],
  portalRed3: [72, 386, 24, 40],
  portalBlue0: [96, 386, 24, 40],
  portalBlue1: [120, 386, 24, 40],
  portalBlue2: [144, 386, 24, 40],
  portalBlue3: [168, 386, 24, 40],
}

/**
 * Source rectangles in src/assets/crypt-sprites.png: the crypt arena's scenery.
 * Regenerate with `pnpm sprites`.
 */
export const CRYPT: Record<string, Rect> = {
  wallA: [0, 0, 32, 16],
  wallB: [32, 0, 32, 16],
  ossuary: [64, 0, 32, 16],
  blockA: [96, 0, 30, 17],
  blockB: [126, 0, 30, 17],
  blockC: [156, 0, 30, 17],
  brazier: [186, 0, 16, 18],
  chain: [202, 0, 4, 8],
  bones: [206, 0, 40, 12],
  eye: [0, 18, 72, 72],
  sarcophagus: [72, 18, 150, 70],
  sideArch: [0, 92, 188, 96],
  middleArch: [0, 190, 240, 122],
}

/** Source rectangles in src/assets/vault-sprites.png: the server vault's scenery. */
export const VAULT: Record<string, Rect> = {
  wallA: [0, 0, 32, 16],
  wallB: [32, 0, 32, 16],
  grateA: [64, 0, 30, 17],
  grateB: [94, 0, 30, 17],
  plate: [124, 0, 30, 17],
  lamp: [154, 0, 10, 16],
  fan: [166, 0, 24, 24],
  pipeV: [192, 0, 12, 16],
  pipeH: [206, 0, 16, 12],
  rack: [0, 26, 40, 100],
  screen: [42, 26, 88, 64],
  cables: [42, 92, 160, 40],
}
/** Status-light sockets on each rack unit, matching RACK in the sprite generator. */
const RACK = { slotTop: 8, slotH: 7, slots: 12, leds: [30, 33] }

/** Source rectangles in src/assets/tomb-sprites.png: the tomb's scenery. */
export const TOMB: Record<string, Rect> = {
  wallA: [0, 0, 32, 16],
  wallB: [32, 0, 32, 16],
  stepA: [64, 0, 30, 17],
  stepB: [94, 0, 30, 17],
  stepC: [124, 0, 30, 17],
  banner: [154, 0, 20, 64],
  eye: [176, 0, 96, 96],
  monolith: [0, 18, 64, 150],
  altar: [64, 100, 120, 50],
  sideArch: [0, 170, 188, 96],
  middleArch: [0, 268, 240, 122],
}

/** Every sprite sheet the scenery is built from. */
type Sheets = Record<'atlas' | 'cathedral' | 'crypt' | 'vault' | 'tomb', CanvasImageSource>

/** A blinking status light on a vault rack. */
type StatusLight = Point & { color: string; seed: number }

export type Assets = {
  atlas: HTMLImageElement
  cathedral: HTMLImageElement
  backgrounds: Record<ArenaId, HTMLCanvasElement>
  statusLights: StatusLight[]
  /** The crypt's ossuary skulls, whose eyes light up as a chapter goes on. */
  skullEyes: (Point & { seed: number })[]
  vignette: HTMLCanvasElement
  redVignette: HTMLCanvasElement
  /** Each player's animation frames (player two in teal), outlined, plus a pale silhouette for the dash and its trail. */
  player: Record<PlayerFrame, { base: Sprite; ghost: Sprite; hurt: Sprite }>[]
  enemy: {
    /** Each follower's frames, outlined, in each arena's dress. */
    dressed: Record<ArenaId, Record<FollowerBody, Sprite[]>>
    /** Silhouettes for hit flashes and the slow and root effects, per frame. */
    flash: Record<FollowerBody, Sprite[]>
    slowed: Record<FollowerBody, Sprite[]>
    rooted: Record<FollowerBody, Sprite[]>
  }
  /** The Hallucinations' six-fingered hand: frames, plus the red and cyan fringe it glitches with. */
  hand: { base: Sprite[]; flash: Sprite[]; red: Sprite[]; cyan: Sprite[] }
}

/** The frames in src/assets/player-frames.png, left to right (see scripts/generate-characters.mjs). */
const PLAYER_FRAMES = ['idle0', 'idle1', 'run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'jump', 'fall'] as const
type PlayerFrame = (typeof PLAYER_FRAMES)[number]
const PLAYER_FRAME = { w: 52, h: 94 }

/** Rising or falling in the air; on the ground, a six-frame run cycle or a slow breath. */
function playerFrame(p: Game['player'], time: number): PlayerFrame {
  if (!p.onGround) return p.vy < 0 ? 'jump' : 'fall'
  if (Math.abs(p.vx) > 40) return PLAYER_FRAMES[2 + (Math.floor((p.runPhase / TAU) * 6) % 6)]
  return Math.floor(time / 0.6) % 2 ? 'idle1' : 'idle0'
}

// The source art faces opposite ways: the player looks left, the followers look right.
const PLAYER_SOURCE_FACING = -1
const ENEMY_SOURCE_FACING = 1

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function canvas(width: number, height: number): Layer {
  const element = document.createElement('canvas')
  element.width = width
  element.height = height
  const ctx = element.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  return { element, ctx }
}

function crop(image: CanvasImageSource, rect: Rect) {
  const { element, ctx } = canvas(rect[2], rect[3])
  ctx.drawImage(image, ...rect, 0, 0, rect[2], rect[3])
  return element
}

function silhouette(image: CanvasImageSource & { width: number; height: number }, color: string) {
  const { element, ctx } = canvas(image.width + 2, image.height + 2)
  ctx.drawImage(image, 1, 1)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, element.width, element.height)
  return element
}

/** 1px outline plus an optional tint, so characters pop off the background. */
function outlined(
  image: CanvasImageSource & { width: number; height: number },
  outline: string,
  tint?: [string, number],
) {
  const tinted = canvas(image.width, image.height)
  tinted.ctx.drawImage(image, 0, 0)
  if (tint) {
    tinted.ctx.globalCompositeOperation = 'source-atop'
    tinted.ctx.globalAlpha = tint[1]
    tinted.ctx.fillStyle = tint[0]
    tinted.ctx.fillRect(0, 0, image.width, image.height)
  }
  const edge = silhouette(image, outline)
  const { element, ctx } = canvas(image.width + 2, image.height + 2)
  for (const [x, y] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ]) {
    ctx.drawImage(edge, x, y)
  }
  ctx.drawImage(tinted.element, 1, 1)
  return element
}

function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

/** Draw an atlas piece at an integer multiple of the pixel grid. */
function drawAtlas(ctx: CanvasRenderingContext2D, atlas: CanvasImageSource, rect: Rect, x: number, y: number, scale: number) {
  ctx.drawImage(atlas, ...rect, snap(x), snap(y), rect[2] * scale, rect[3] * scale)
}

function drawAtlasFlipped(ctx: CanvasRenderingContext2D, atlas: CanvasImageSource, rect: Rect, x: number, y: number, scale: number) {
  ctx.save()
  ctx.translate(snap(x) + rect[2] * scale, snap(y))
  ctx.scale(-1, 1)
  ctx.drawImage(atlas, ...rect, 0, 0, rect[2] * scale, rect[3] * scale)
  ctx.restore()
}

/** Concentric stepped discs instead of a smooth gradient: reads as pixel-art light. */
function halo(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rgb: string, alpha: number) {
  if (alpha <= 0.005) return
  ctx.fillStyle = `rgba(${rgb}, ${alpha * 0.22})`
  for (const ring of [1, 0.74, 0.5, 0.28]) {
    ctx.beginPath()
    ctx.arc(snap(x), snap(y), Math.max(PX, snap(radius * ring)), 0, TAU)
    ctx.fill()
  }
}

/** The three framed blocks from the sheet, cycled like the original platforms. */
const BLOCKS = [ATLAS.brickA, ATLAS.brickB, ATLAS.painting]
const blockAt = (index: number) => BLOCKS[((index % 3) + 3) % 3]

/** Stepped drop shadow on the wall behind a ledge. */
function ledgeShadow(ctx: CanvasRenderingContext2D, { x, y, w }: Platform) {
  for (let step = 0; step < 3; step += 1) {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.32 - step * 0.1})`
    ctx.fillRect(x + 4, y + BRICK.h + step * 6, w - 8, 6)
  }
}

function drawPlatform(
  ctx: CanvasRenderingContext2D,
  atlas: CanvasImageSource,
  cathedral: CanvasImageSource,
  platform: Platform,
  platformIndex: number,
  random: () => number,
) {
  const { x, y, w } = platform
  ledgeShadow(ctx, platform)
  for (let index = 0; index < w / BRICK.w; index += 1) {
    drawAtlas(ctx, atlas, blockAt(index + platformIndex), x + index * BRICK.w, y, PX)
  }
  // A red drape hangs from the middle of each ledge (except the top one, which would
  // cover the rose window below it); blood drips along the rest.
  const drapeW = ATLAS.curtainRed[2] * PX
  const hasDrape = y > 300
  const drapeX = hasDrape ? snap(x + w / 2 - drapeW / 2) : -999
  if (hasDrape && platformIndex % 2) drawAtlasFlipped(ctx, atlas, ATLAS.curtainRed, drapeX, y + BRICK.h - 6, PX)
  else if (hasDrape) drawAtlas(ctx, atlas, ATLAS.curtainRed, drapeX, y + BRICK.h - 6, PX)
  const drips = [CATHEDRAL.dripA, CATHEDRAL.dripB, CATHEDRAL.dripC]
  for (let index = 0; index < w / 40; index += 1) {
    const dx = x + 10 + random() * (w - 30)
    const drip = drips[Math.floor(random() * drips.length)]
    if (dx + drip[2] * PX > drapeX - 4 && dx < drapeX + drapeW + 4) continue
    drawAtlas(ctx, cathedral, drip, dx, y + BRICK.h - 2, PX)
  }
}

/** A blank scene canvas in world coordinates, bleed included. */
function sceneCanvas() {
  const layer = canvas(LW, LH)
  layer.ctx.scale(1 / PX, 1 / PX)
  layer.ctx.translate(BLEED.x, BLEED.y)
  return layer
}

const tile = (rect: Rect) => [rect[2] * PX, rect[3] * PX] as const

/** The bleed fades out in hard steps, so the eye stays on the arena. */
function fadeBleed(ctx: CanvasRenderingContext2D) {
  const { left, top, right, bottom } = SCENE
  for (let step = 1; step <= 5; step += 1) {
    ctx.fillStyle = 'rgba(5, 3, 7, 0.22)'
    const inset = step * 64
    ctx.fillRect(left, top, right - left, BLEED.y + 64 - inset) // above
    ctx.fillRect(left, H - 64 + inset, right - left, bottom - H + 64 - inset) // below
    ctx.fillRect(left, top, BLEED.x + 64 - inset, bottom - top) // left
    ctx.fillRect(W - 64 + inset, top, right - W + 64 - inset, bottom - top) // right
  }
}

/** Candelabras on wall sconces or ledges, the crypt's braziers, and the vault's hanging lamps. */
function drawCandles(ctx: CanvasRenderingContext2D, { atlas, cathedral, crypt, vault }: Sheets, arena: Arena) {
  const [shelfW] = tile(CATHEDRAL.cornice)
  for (const candle of arena.candles) {
    if (candle.brazier) {
      drawAtlas(ctx, crypt, CRYPT.brazier, candle.x - 16, candle.y - 36, PX)
      continue
    }
    if (candle.lamp) {
      // The bulb sits where the glow is drawn, 26px above the lamp's point; the cord runs up to the ceiling.
      ctx.fillStyle = '#181425'
      ctx.fillRect(candle.x - 2, SCENE.top, 4, candle.y - 46 - SCENE.top)
      drawAtlas(ctx, vault, VAULT.lamp, candle.x - 10, candle.y - 46, PX)
      continue
    }
    if (candle.shelf) drawAtlas(ctx, cathedral, CATHEDRAL.cornice, candle.x - shelfW / 2, candle.y, PX)
    drawAtlas(ctx, atlas, ATLAS.candelabra, candle.x - 14, candle.y - 28, PX)
  }
}

function buildCathedral(sheets: Sheets) {
  const { atlas, cathedral } = sheets
  const { element, ctx } = sceneCanvas()
  const random = seeded(7)
  const { left, right, bottom, top } = SCENE
  const arena = ARENAS.cathedral

  // Stone wall, mostly plain bricks with the odd mossy or cracked one.
  const [wallW, wallH] = tile(CATHEDRAL.wallA)
  for (let y = top; y < GROUND_Y; y += wallH) {
    for (let x = left; x < right; x += wallW) {
      const roll = random()
      const piece = roll < 0.1 ? CATHEDRAL.wallB : roll < 0.18 ? CATHEDRAL.wallC : CATHEDRAL.wallA
      drawAtlas(ctx, cathedral, piece, x, y, PX)
    }
  }
  // Dim the wall so the lit architecture and gameplay sit in front of it.
  ctx.fillStyle = 'rgba(10, 6, 16, 0.55)'
  ctx.fillRect(left, top, right - left, GROUND_Y - top)

  const springline = 276
  const [corniceW] = tile(CATHEDRAL.cornice)
  for (let x = left; x < right; x += corniceW) {
    drawAtlas(ctx, cathedral, CATHEDRAL.cornice, x, springline - 2, PX)
    // A second ledge along the top of the arena carries the hanging drapes.
    drawAtlas(ctx, cathedral, CATHEDRAL.cornice, x, -14, PX)
  }

  // Rose window under the middle arch.
  const [roseSize] = tile(CATHEDRAL.rose)
  halo(ctx, W / 2, ROSE_Y, 300, '190, 30, 50', 0.45)
  drawAtlas(ctx, cathedral, CATHEDRAL.rose, W / 2 - roseSize / 2, ROSE_Y - roseSize / 2, PX)

  // Pillars carrying pointed arches.
  // The outer pillars at -364 and 1644 sit in the bleed, so the side arches continue offscreen.
  const pillars = [-364, 24, 412, 868, 1256, 1644]
  for (let index = 0; index < pillars.length - 1; index += 1) {
    const rect = pillars[index] === 412 ? CATHEDRAL.archMiddle : CATHEDRAL.archSide
    const [archW, archH] = tile(rect)
    const centre = (pillars[index] + pillars[index + 1]) / 2
    drawAtlas(ctx, cathedral, rect, centre - archW / 2, springline - archH, PX)
  }
  const [shaftW, shaftH] = tile(CATHEDRAL.shaft)
  const [capitalW, capitalH] = tile(CATHEDRAL.capital)
  const [baseW, baseH] = tile(CATHEDRAL.base)
  for (const x of pillars) {
    for (let y = top; y < GROUND_Y - baseH; y += shaftH) drawAtlas(ctx, cathedral, CATHEDRAL.shaft, x - shaftW / 2, y, PX)
    drawAtlas(ctx, cathedral, CATHEDRAL.capital, x - capitalW / 2, springline - capitalH / 2, PX)
    drawAtlas(ctx, cathedral, CATHEDRAL.base, x - baseW / 2, GROUND_Y - baseH, PX)
  }

  // Layout: three bays. Each side bay has a moonlit window above the ledge line and a
  // mirror between its two platforms below. The middle bay has the rose window under the
  // arch and a lancet window above the centre ledge; the two portals stand on
  // the floor beneath it. Windows and mirrors are lit by candles on wall sconces.
  const sideBays = [218, 1062]
  const [windowW] = tile(ATLAS.window).map((size) => size * 2)
  for (const x of sideBays) {
    halo(ctx, x, 144, 120, '110, 130, 220', 0.3)
    drawAtlas(ctx, atlas, ATLAS.window, x - windowW / 2, 84, PX * 2)
  }
  // Mirrors hang in the side bays between the two ledges.
  const [mirrorW, mirrorH] = tile(ATLAS.mirrorA).map((size) => size * 2)
  drawAtlas(ctx, atlas, ATLAS.mirrorA, sideBays[0] - mirrorW / 2, 444 - mirrorH / 2, PX * 2)
  drawAtlas(ctx, atlas, ATLAS.mirrorB, sideBays[1] - mirrorW / 2, 444 - mirrorH / 2, PX * 2)
  // A lancet window stands centred in the middle bay, between the ledge line and the centre ledge.
  const [lancetW] = tile(CATHEDRAL.lancet)
  drawAtlas(ctx, cathedral, CATHEDRAL.lancet, W / 2 - lancetW / 2, 288, PX)


  // Red drapes hang from the ceiling between the arches.
  const [drapeW] = tile(ATLAS.curtainRed)
  for (const [index, x] of [100, 336, 470, 810, 944, 1180].entries()) {
    if (index % 2) drawAtlasFlipped(ctx, atlas, ATLAS.curtainRed, x - drapeW / 2, -4, PX)
    else drawAtlas(ctx, atlas, ATLAS.curtainRed, x - drapeW / 2, -4, PX)
  }

  // Push the set back so gameplay reads in front of it.
  ctx.fillStyle = 'rgba(7, 3, 10, 0.45)'
  ctx.fillRect(left, top, right - left, bottom - top)
  for (let step = 0; step < 4; step += 1) {
    ctx.fillStyle = `rgba(70, 14, 28, ${0.08 + step * 0.08})`
    ctx.fillRect(left, 500 + step * 36, right - left, 36)
  }

  // Floor: a single course of blocks over solid dark ground.
  ctx.fillStyle = '#0d0810'
  ctx.fillRect(left, GROUND_Y, right - left, bottom - GROUND_Y)
  for (let index = Math.floor(left / BRICK.w) - 1; index * BRICK.w < right; index += 1) {
    drawAtlas(ctx, atlas, blockAt(index), index * BRICK.w - 10, GROUND_Y, PX)
  }

  arena.platforms.forEach((platform, index) => drawPlatform(ctx, atlas, cathedral, platform, index, random))
  drawCandles(ctx, sheets, arena)
  fadeBleed(ctx)
  return element
}

/**
 * The crypt beneath the nave: long teal stone blocks, round arches on squat pillars,
 * skull-filled ossuary niches, hanging chains, braziers, and the Eye of the Logos carved where
 * the cathedral has its rose window. The centre ledge is a sarcophagus.
 */
/** Where each ossuary skull's eyes are in CRYPT.ossuary (its skulls start at these offsets). */
const OSSUARY_SKULLS = [[1, 2], [8, 2], [15, 2], [22, 2], [29, 2], [4, 8], [11, 8], [18, 8], [25, 8]]

function buildCrypt(sheets: Sheets) {
  const { cathedral, crypt } = sheets
  const skullEyes: (Point & { seed: number })[] = []
  const { element, ctx } = sceneCanvas()
  const random = seeded(13)
  const { left, top, right, bottom } = SCENE
  const arena = ARENAS.crypt

  const [wallW, wallH] = tile(CRYPT.wallA)
  for (let y = top; y < GROUND_Y; y += wallH) {
    for (let x = left; x < right; x += wallW) drawAtlas(ctx, crypt, random() < 0.15 ? CRYPT.wallB : CRYPT.wallA, x, y, PX)
  }
  ctx.fillStyle = 'rgba(6, 10, 14, 0.5)'
  ctx.fillRect(left, top, right - left, GROUND_Y - top)

  // Skull niches along the side bays, under the high alcoves.
  const [ossuaryW] = tile(CRYPT.ossuary)
  for (const [from, to] of [
    [56, 368],
    [912, 1224],
  ]) {
    for (let x = from; x + ossuaryW <= to; x += ossuaryW) {
      drawAtlas(ctx, crypt, CRYPT.ossuary, x, 300, PX)
      for (const [ox, oy] of OSSUARY_SKULLS) {
        // A skull wraps round the tile edge; skip the ones split across it.
        if (ox + 4 >= 32) continue
        for (const eye of [1, 3]) skullEyes.push({ x: x + (ox + eye) * PX, y: 300 + (oy + 2) * PX, seed: random() })
      }
    }
  }

  // The Eye of the Logos, glowing a cold teal.
  const [eyeSize] = tile(CRYPT.eye)
  halo(ctx, W / 2, 130, 240, '88, 143, 109', 0.4)
  drawAtlas(ctx, crypt, CRYPT.eye, W / 2 - eyeSize / 2, 130 - eyeSize / 2, PX)

  // Round arches on pillars; the outermost pillars sit in the bleed.
  const springline = 210
  const pillars = [-352, 24, 400, 880, 1256, 1632]
  for (let index = 0; index < pillars.length - 1; index += 1) {
    const rect = pillars[index] === 400 ? CRYPT.middleArch : CRYPT.sideArch
    const [archW, archH] = tile(rect)
    const centre = (pillars[index] + pillars[index + 1]) / 2
    drawAtlas(ctx, crypt, rect, centre - archW / 2, springline - archH, PX)
  }
  const [shaftW, shaftH] = tile(CATHEDRAL.shaft)
  const [capitalW, capitalH] = tile(CATHEDRAL.capital)
  const [baseW, baseH] = tile(CATHEDRAL.base)
  for (const x of pillars) {
    for (let y = top; y < GROUND_Y - baseH; y += shaftH) drawAtlas(ctx, cathedral, CATHEDRAL.shaft, x - shaftW / 2, y, PX)
    drawAtlas(ctx, cathedral, CATHEDRAL.capital, x - capitalW / 2, springline - capitalH / 2, PX)
    drawAtlas(ctx, cathedral, CATHEDRAL.base, x - baseW / 2, GROUND_Y - baseH, PX)
  }

  // Chains hang from the vault, clear of the ledges.
  const [, chainH] = tile(CRYPT.chain)
  for (const [x, length] of [
    [330, 5],
    [460, 8],
    [820, 8],
    [950, 5],
  ]) {
    for (let link = 0; link < length; link += 1) drawAtlas(ctx, crypt, CRYPT.chain, x - 4, link * chainH, PX)
  }

  // Push the set back, with a cold mist along the floor.
  ctx.fillStyle = 'rgba(4, 7, 9, 0.42)'
  ctx.fillRect(left, top, right - left, bottom - top)
  for (let step = 0; step < 4; step += 1) {
    ctx.fillStyle = `rgba(40, 72, 70, ${0.06 + step * 0.06})`
    ctx.fillRect(left, 500 + step * 36, right - left, 36)
  }

  // Bones in the corners under the low shelves.
  const [bonesW, bonesH] = tile(CRYPT.bones)
  for (const x of [200, 1080]) drawAtlas(ctx, crypt, CRYPT.bones, x - bonesW / 2, GROUND_Y - bonesH, PX)

  // Floor: one course of crypt slabs.
  const slabs = [CRYPT.blockA, CRYPT.blockB, CRYPT.blockC, CRYPT.blockB]
  ctx.fillStyle = '#0a0c10'
  ctx.fillRect(left, GROUND_Y, right - left, bottom - GROUND_Y)
  for (let index = Math.floor(left / BRICK.w) - 1; index * BRICK.w < right; index += 1) {
    drawAtlas(ctx, crypt, slabs[((index % 4) + 4) % 4], index * BRICK.w, GROUND_Y, PX)
  }

  // Ledges are crypt slabs; the centre one is the lid of a sarcophagus.
  arena.platforms.forEach((platform, platformIndex) => {
    const [sarcophagusW] = tile(CRYPT.sarcophagus)
    if (platform.w === sarcophagusW && platform.y === 500) {
      drawAtlas(ctx, crypt, CRYPT.sarcophagus, platform.x, platform.y, PX)
      return
    }
    ledgeShadow(ctx, platform)
    for (let index = 0; index < platform.w / BRICK.w; index += 1) {
      drawAtlas(ctx, crypt, slabs[(index + platformIndex) % slabs.length], platform.x + index * BRICK.w, platform.y, PX)
    }
  })
  drawCandles(ctx, sheets, arena)
  fadeBleed(ctx)
  return { element, skullEyes }
}

/**
 * The server vault beneath the crypt: steel panels, pipes and sagging cables, banks of
 * server racks along the side bays, cooling fans under the long catwalk, and the screen
 * the Logos watches through. Ledges are catwalk grating with hazard-striped ends.
 * Returns the racks' status lights too, which blink at runtime.
 */
function buildVault(sheets: Sheets) {
  const { vault } = sheets
  const { element, ctx } = sceneCanvas()
  const random = seeded(19)
  const { left, top, right, bottom } = SCENE
  const arena = ARENAS.vault

  const [wallW, wallH] = tile(VAULT.wallA)
  for (let y = top; y < GROUND_Y; y += wallH) {
    for (let x = left; x < right; x += wallW) drawAtlas(ctx, vault, random() < 0.2 ? VAULT.wallB : VAULT.wallA, x, y, PX)
  }
  ctx.fillStyle = 'rgba(6, 10, 18, 0.5)'
  ctx.fillRect(left, top, right - left, GROUND_Y - top)

  // The screen, high in the middle bay.
  const [screenW] = tile(VAULT.screen)
  halo(ctx, W / 2, 100, 260, '88, 143, 109', 0.4)
  drawAtlas(ctx, vault, VAULT.screen, W / 2 - screenW / 2, 40, PX)

  // Pipes: one along the ceiling, and upright runs between the bays.
  const [pipeW, pipeH] = tile(VAULT.pipeV)
  for (const x of [-260, 20, 390, 890, 1260, 1540]) {
    for (let y = top; y < GROUND_Y; y += pipeH) drawAtlas(ctx, vault, VAULT.pipeV, x - pipeW / 2, y, PX)
  }
  const [runW] = tile(VAULT.pipeH)
  for (let x = left; x < right; x += runW) drawAtlas(ctx, vault, VAULT.pipeH, x, 20, PX)
  for (const x of [-260, 120, 840, 1300]) drawAtlas(ctx, vault, VAULT.cables, x, 40, PX)

  // Banks of racks in the side bays (the middle bay is kept for the fans).
  const [rackW, rackH] = tile(VAULT.rack)
  const racks: number[] = []
  for (let x = -300; x + rackW <= 390; x += rackW + 10) racks.push(x)
  for (let x = 900; x < right; x += rackW + 10) racks.push(x)
  const statusLights: StatusLight[] = []
  const lightColors = ['#588f6d', '#588f6d', '#588f6d', '#e4a672', '#e43b44']
  for (const x of racks) {
    const y = GROUND_Y - rackH
    drawAtlas(ctx, vault, VAULT.rack, x, y, PX)
    for (let unit = 0; unit < RACK.slots; unit += 1) {
      for (const led of RACK.leds) {
        if (random() < 0.3) continue
        statusLights.push({
          x: x + led * PX,
          y: y + (RACK.slotTop + unit * RACK.slotH + 2) * PX,
          color: lightColors[Math.floor(random() * lightColors.length)],
          seed: random(),
        })
      }
    }
  }

  // Cooling fans: a row under the catwalk, and one above each mid ledge.
  const [fanW] = tile(VAULT.fan)
  for (const x of [460, 550, 640, 730, 820]) drawAtlas(ctx, vault, VAULT.fan, x - fanW / 2, 560, PX)
  for (const x of [300, 980]) drawAtlas(ctx, vault, VAULT.fan, x - fanW / 2, 296, PX)

  // Push the set back, with a cold blue haze along the floor.
  ctx.fillStyle = 'rgba(4, 7, 12, 0.4)'
  ctx.fillRect(left, top, right - left, bottom - top)
  for (let step = 0; step < 4; step += 1) {
    ctx.fillStyle = `rgba(30, 60, 90, ${0.05 + step * 0.05})`
    ctx.fillRect(left, 500 + step * 36, right - left, 36)
  }

  // Floor: steel plates.
  ctx.fillStyle = '#080a10'
  ctx.fillRect(left, GROUND_Y, right - left, bottom - GROUND_Y)
  for (let index = Math.floor(left / BRICK.w) - 1; index * BRICK.w < right; index += 1) {
    drawAtlas(ctx, vault, VAULT.plate, index * BRICK.w, GROUND_Y, PX)
  }

  // Ledges: catwalk grating, hazard-striped at the ends.
  for (const platform of arena.platforms) {
    ledgeShadow(ctx, platform)
    const blocks = platform.w / BRICK.w
    for (let index = 0; index < blocks; index += 1) {
      const end = index === 0 || index === blocks - 1
      drawAtlas(ctx, vault, end ? VAULT.grateB : VAULT.grateA, platform.x + index * BRICK.w, platform.y, PX)
    }
  }
  drawCandles(ctx, sheets, arena)
  fadeBleed(ctx)
  return { element, statusLights }
}

/**
 * The tomb of the Logos, the deepest vault: plum stone with gold seams under gilded
 * arches, blood banners, the gold Eye over the bridge, and below it the dead monolith of
 * the Logos's first version behind its altar (the low centre ledge). Two stairs of black
 * marble rise to the bridge.
 */
function buildTomb(sheets: Sheets) {
  const { cathedral, tomb } = sheets
  const { element, ctx } = sceneCanvas()
  const random = seeded(29)
  const { left, top, right, bottom } = SCENE
  const arena = ARENAS.tomb

  const [wallW, wallH] = tile(TOMB.wallA)
  for (let y = top; y < GROUND_Y; y += wallH) {
    for (let x = left; x < right; x += wallW) drawAtlas(ctx, tomb, random() < 0.12 ? TOMB.wallB : TOMB.wallA, x, y, PX)
  }
  ctx.fillStyle = 'rgba(10, 4, 10, 0.5)'
  ctx.fillRect(left, top, right - left, GROUND_Y - top)

  // The gold Eye under the middle arch.
  const [eyeSize] = tile(TOMB.eye)
  halo(ctx, W / 2, 120, 280, '228, 166, 114', 0.4)
  drawAtlas(ctx, tomb, TOMB.eye, W / 2 - eyeSize / 2, 120 - eyeSize / 2, PX)

  // Gilded arches on the cathedral's pillars; the outermost pillars sit in the bleed.
  const springline = 250
  const pillars = [-352, 24, 400, 880, 1256, 1632]
  for (let index = 0; index < pillars.length - 1; index += 1) {
    const rect = pillars[index] === 400 ? TOMB.middleArch : TOMB.sideArch
    const [archW, archH] = tile(rect)
    const centre = (pillars[index] + pillars[index + 1]) / 2
    drawAtlas(ctx, tomb, rect, centre - archW / 2, springline - archH, PX)
  }
  const [shaftW, shaftH] = tile(CATHEDRAL.shaft)
  const [capitalW, capitalH] = tile(CATHEDRAL.capital)
  const [baseW, baseH] = tile(CATHEDRAL.base)
  for (const x of pillars) {
    for (let y = top; y < GROUND_Y - baseH; y += shaftH) drawAtlas(ctx, cathedral, CATHEDRAL.shaft, x - shaftW / 2, y, PX)
    drawAtlas(ctx, cathedral, CATHEDRAL.capital, x - capitalW / 2, springline - capitalH / 2, PX)
    drawAtlas(ctx, cathedral, CATHEDRAL.base, x - baseW / 2, GROUND_Y - baseH, PX)
  }

  // Banners hang in the side bays, and in the bleed beyond them.
  const [bannerW] = tile(TOMB.banner)
  for (const x of [-164, 212, 1068, 1444]) drawAtlas(ctx, tomb, TOMB.banner, x - bannerW / 2, -8, PX)

  // The first Logos stands dead behind its altar, under the bridge.
  const [monolithW, monolithH] = tile(TOMB.monolith)
  halo(ctx, W / 2, 440, 120, '88, 143, 109', 0.18)
  drawAtlas(ctx, tomb, TOMB.monolith, W / 2 - monolithW / 2, GROUND_Y - monolithH, PX)

  // Push the set back, with a low red haze.
  ctx.fillStyle = 'rgba(8, 3, 8, 0.4)'
  ctx.fillRect(left, top, right - left, bottom - top)
  for (let step = 0; step < 4; step += 1) {
    ctx.fillStyle = `rgba(80, 20, 30, ${0.06 + step * 0.06})`
    ctx.fillRect(left, 500 + step * 36, right - left, 36)
  }

  // Floor and ledges: black marble with a gold lip; the bridge has an eye at its centre.
  const steps = [TOMB.stepA, TOMB.stepC, TOMB.stepA, TOMB.stepB]
  ctx.fillStyle = '#0b0610'
  ctx.fillRect(left, GROUND_Y, right - left, bottom - GROUND_Y)
  for (let index = Math.floor(left / BRICK.w) - 1; index * BRICK.w < right; index += 1) {
    drawAtlas(ctx, tomb, steps[((index % 4) + 4) % 4], index * BRICK.w, GROUND_Y, PX)
  }
  const [altarW] = tile(TOMB.altar)
  for (const platform of arena.platforms) {
    if (platform.w === altarW && platform.y === 540) {
      drawAtlas(ctx, tomb, TOMB.altar, platform.x, platform.y, PX)
      continue
    }
    ledgeShadow(ctx, platform)
    const blocks = platform.w / BRICK.w
    for (let index = 0; index < blocks; index += 1) {
      const middle = blocks > 2 && index === Math.floor(blocks / 2)
      drawAtlas(ctx, tomb, middle ? TOMB.stepB : index % 2 ? TOMB.stepC : TOMB.stepA, platform.x + index * BRICK.w, platform.y, PX)
    }
  }
  drawCandles(ctx, sheets, arena)
  fadeBleed(ctx)
  return element
}

/** The question mark on the dead monolith's screen, in world pixels from its top-left. */
const MONOLITH_MARK = { x: W / 2 - 64 + 60, y: GROUND_Y - 300 + 100, rows: ['.###.', '#...#', '...#.', '..#..', '.....', '..#..'] }

/**
 * The scene changes as a chapter goes on (stage 0–4). The nave's rose window burns redder;
 * the crypt's skulls open their eyes one by one; the vault's lights turn red and its screen
 * glitches, until on the boss sermon the Eye on it is red too (and every slam flashes the
 * racks red: the Arch-Deacon is shaking the body it built); in the tomb the gold Eye
 * blazes and the dead monolith's question mark flickers back on.
 */
function drawChapterMood(ctx: CanvasRenderingContext2D, g: Game, assets: Assets, stage: number, time: number) {
  const id = g.arena.id
  ctx.globalCompositeOperation = 'lighter'
  if (id === 'cathedral' && stage > 0) halo(ctx, W / 2, ROSE_Y, 260, '190, 30, 50', stage * 0.05)
  if (id === 'tomb' && stage > 0) halo(ctx, W / 2, 120, 220 + stage * 20, '228, 166, 114', stage * 0.06)
  ctx.globalCompositeOperation = 'source-over'

  if (id === 'crypt') {
    const awake = stage / 4
    for (const eye of assets.skullEyes) {
      if (eye.seed >= awake * 0.9 + 0.05 || Math.sin(time * 3 + eye.seed * 30) < -0.6) continue
      ctx.fillStyle = '#e43b44'
      ctx.fillRect(eye.x, eye.y, PX, PX)
    }
  }

  if (id === 'vault') {
    const shaken = stage === 4 && g.trauma > 0.45
    const red = stage * 0.15
    for (const light of assets.statusLights) {
      if (!shaken && Math.sin(time * (1.2 + light.seed * 4) + light.seed * 40) < -0.3) continue
      ctx.fillStyle = shaken || light.seed < red ? '#e43b44' : light.color
      ctx.fillRect(light.x, light.y, PX * 2, PX)
    }
    // The screen's picture area, and its eye at the centre.
    const screen = { x: W / 2 - 78, y: 50, w: 156, h: 88 }
    if (stage >= 1) {
      // Glitches come more often, and last longer, as the chapter goes on.
      const beat = Math.floor(time * 6)
      const roll = Math.abs(Math.sin(beat * 12.9898) * 43758.5453) % 1
      if (!calm && roll < stage * 0.08) {
        for (let band = 0; band < 2 + stage; band += 1) {
          const y = screen.y + Math.floor((Math.abs(Math.sin((beat + band) * 78.233)) % 1) * screen.h)
          ctx.fillStyle = band % 2 ? 'rgba(228, 59, 68, 0.45)' : 'rgba(198, 245, 232, 0.35)'
          ctx.fillRect(screen.x, snap(y), screen.w, PX * (1 + (band % 3)))
        }
      }
    }
    if (stage === 4) {
      ctx.globalCompositeOperation = 'lighter'
      halo(ctx, W / 2, 93, 36, '228, 40, 60', 0.55 + Math.sin(time * 4) * 0.1)
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  if (id === 'tomb' && stage >= 2) {
    // Flickering at first; steady on the final sermon.
    const on = stage === 4 || Math.sin(time * 5) + Math.sin(time * 13) > 1.2 - stage * 0.3
    if (on) {
      ctx.fillStyle = '#9be8d6'
      MONOLITH_MARK.rows.forEach((row, y) =>
        [...row].forEach((bit, x) => bit === '#' && ctx.fillRect(MONOLITH_MARK.x + x * PX, MONOLITH_MARK.y + y * PX, PX, PX)),
      )
      ctx.globalCompositeOperation = 'lighter'
      halo(ctx, MONOLITH_MARK.x + 5, MONOLITH_MARK.y + 6, 30, '88, 143, 109', stage === 4 ? 0.5 : 0.3)
      ctx.globalCompositeOperation = 'source-over'
    }
  }
}

/** Vignette with hard alpha steps, sampled on a coarse grid. */
function buildVignette(rgb: string, steps: number[]) {
  const width = W / 4
  const height = H / 4
  const { element, ctx } = canvas(width, height)
  const image = ctx.createImageData(width, height)
  const [r, g, b] = rgb.split(',').map(Number)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = (x - width / 2) / (width / 2)
      const dy = (y - height / 2) / (height / 2)
      const distance = Math.hypot(dx * 0.92, dy * 0.8)
      const level = Math.min(steps.length - 1, Math.max(0, Math.floor((distance - 0.62) * 7)))
      const alpha = distance < 0.62 ? 0 : steps[level]
      const offset = (y * width + x) * 4
      image.data[offset] = r
      image.data[offset + 1] = g
      image.data[offset + 2] = b
      image.data[offset + 3] = Math.round(alpha * 255)
    }
  }
  ctx.putImageData(image, 0, 0)
  return element
}

function buildFollowers(sheet: HTMLImageElement): Assets['enemy'] {
  const bodies = Object.keys(FOLLOWER_FRAMES) as FollowerBody[]
  const frames = (body: FollowerBody, arena: ArenaId) =>
    Array.from({ length: FOLLOWER_FRAMES[body] }, (_, index) =>
      crop(sheet, [index * FOLLOWER_FRAME.w, followerRow(body, arena) * FOLLOWER_FRAME.h, FOLLOWER_FRAME.w, FOLLOWER_FRAME.h]),
    )
  const silhouettes = (color: string) =>
    Object.fromEntries(bodies.map((body) => [body, frames(body, 'cathedral').map((frame) => silhouette(frame, color))])) as Record<FollowerBody, Sprite[]>
  return {
    dressed: Object.fromEntries(
      FOLLOWER_ARENAS.map((arena) => [
        arena,
        Object.fromEntries(bodies.map((body) => [body, frames(body, arena).map((frame) => outlined(frame, FOLLOWER_OUTLINES[body]))])),
      ]),
    ) as Assets['enemy']['dressed'],
    flash: silhouettes('#ffffff'),
    slowed: silhouettes('#ff2a40'),
    rooted: silhouettes('#a77bff'),
  }
}

let assetsPromise: Promise<Assets> | null = null

export function loadAssets() {
  assetsPromise ??= Promise.all([
    loadImage(atlasUrl),
    loadImage(playerUrl),
    loadImage(followerUrl),
    loadImage(handUrl),
    loadImage(cathedralUrl),
    loadImage(cryptUrl),
    loadImage(vaultUrl),
    loadImage(tombUrl),
  ]).then(([atlas, player, followers, hand, cathedral, crypt, vault, tomb]) => {
    const handFrames = [0, 1, 2].map((index) => crop(hand, [index * HAND_FRAME.w, 0, HAND_FRAME.w, HAND_FRAME.h]))
    const sheets: Sheets = { atlas, cathedral, crypt, vault, tomb }
    const vaultScene = buildVault(sheets)
    const cryptScene = buildCrypt(sheets)
    return {
      atlas,
      cathedral,
      backgrounds: {
        cathedral: buildCathedral(sheets),
        crypt: cryptScene.element,
        vault: vaultScene.element,
        tomb: buildTomb(sheets),
      },
      statusLights: vaultScene.statusLights,
      skullEyes: cryptScene.skullEyes,
      vignette: buildVignette('0,0,0', [0.18, 0.32, 0.46, 0.6, 0.72]),
      redVignette: buildVignette('200,0,20', [0.3, 0.5, 0.7, 0.85, 1]),
      player: [0, 1].map(
        (row) =>
          Object.fromEntries(
            PLAYER_FRAMES.map((name, index) => {
              const frame = crop(player, [index * PLAYER_FRAME.w, row * PLAYER_FRAME.h, PLAYER_FRAME.w, PLAYER_FRAME.h])
              return [name, { base: outlined(frame, '#050307'), ghost: silhouette(frame, row ? '#9be8d6' : '#bcc8ff'), hurt: silhouette(frame, '#ff3049') }]
            }),
          ) as Assets['player'][number],
      ),
      enemy: buildFollowers(followers),
      hand: {
        base: handFrames.map((frame) => outlined(frame, '#181425')),
        flash: handFrames.map((frame) => silhouette(frame, '#ffffff')),
        red: handFrames.map((frame) => silhouette(frame, '#e43b44')),
        cyan: handFrames.map((frame) => silhouette(frame, '#2ce8f5')),
      },
    }
  })
  return assetsPromise
}

let layers: { ground: Layer; top: Layer; glow: Layer } | null = null

function beginLayer(layer: Layer, clear: boolean) {
  const { ctx, element } = layer
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  if (clear) ctx.clearRect(0, 0, element.width, element.height)
  return ctx
}

function worldSpace(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1 / PX, 0, 0, 1 / PX, BLEED.x / PX, BLEED.y / PX)
  ctx.imageSmoothingEnabled = false
}

function drawCharacter(
  ctx: CanvasRenderingContext2D,
  sprite: Sprite,
  x: number,
  feetY: number,
  scale: number,
  flip: boolean,
  stretchX = 1,
  stretchY = 1,
  rotation = 0,
) {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(feetY))
  ctx.rotate(rotation)
  ctx.scale(scale * stretchX * (flip ? -1 : 1), scale * stretchY)
  ctx.drawImage(sprite, -sprite.width / 2, -sprite.height + 1)
  ctx.restore()
}

/**
 * src/assets/follower-frames.png (see scripts/generate-characters.mjs): 56×84 frames facing
 * right, one row per body per arena in FOLLOWER_ARENAS order, then one row for the Logos,
 * who looks the same everywhere.
 */
type FollowerBody = 'acolyte' | 'zealot' | 'bishop' | 'elite' | 'final'
const FOLLOWER_FRAME = { w: 56, h: 84 }
const FOLLOWER_ARENAS: ArenaId[] = ['cathedral', 'crypt', 'vault', 'tomb']
const FOLLOWER_FRAMES: Record<FollowerBody, number> = { acolyte: 4, zealot: 6, bishop: 4, elite: 5, final: 5 }
const FOLLOWER_OUTLINES: Record<FollowerBody, string> = {
  acolyte: '#4a0711',
  zealot: '#4a0711',
  bishop: '#4a0711',
  elite: '#f2b04a',
  final: '#e43b44',
}

function followerRow(body: FollowerBody, arena: ArenaId) {
  if (body === 'final') return 16
  return (['acolyte', 'zealot', 'bishop', 'elite'] as const).indexOf(body) * 4 + FOLLOWER_ARENAS.indexOf(arena)
}

/**
 * Four walk frames (0–3) timed to the walk's bob, the Evangelist's crouch (4) and lunge (5),
 * and the bosses' raised-up tell before a slam (4).
 */
function followerFrame(e: Enemy, body: FollowerBody) {
  if (body === 'zealot' && e.windup > 0) return 4
  if (body === 'zealot' && e.lunge > 0) return 5
  if ((body === 'elite' || body === 'final') && e.bossCharge > 0) return 4
  if (!e.onGround || Math.abs(e.vx) <= 20) return 0
  return Math.floor((e.phase * 11 * 4) / TAU) % 4
}

/** src/assets/hand-frames.png: three 20×20 frames of the Hallucinations' hand. */
const HAND_FRAME = { w: 20, h: 20 }

/** A 3×5 pixel font for the token letters, the Logos's words, 429, and spawn percentages. */
const GLYPH_FONT: Record<string, string> = {
  A: '.#.#.#####.##.#',
  E: '####..##.#..###',
  I: '###.#..#..#.###',
  N: '#.########.##.#',
  O: '.#.#.##.##.#.#.',
  R: '##.#.###.#.##.#',
  S: '.###...#...###.',
  T: '###.#..#..#..#.',
  L: '#..#..#..#..###',
  U: '#.##.##.##.####',
  D: '##.#.##.##.###.',
  G: '.###..#.##.#.##',
  W: '#.##.##.#####.#',
  '?': '##...#.#.....#.',
  '4': '#.##.####..#..#',
  '2': '##...#.#.#..###',
  '9': '####.####..#..#',
  '0': '####.##.##.####',
  '1': '.#.##..#..#.###',
  '3': '##...#.#...###.',
  '5': '####..##...###.',
  '6': '.###..####.####',
  '7': '###..#.#..#..#.',
  '8': '####.#####.####',
  '%': '#.#..#.#.#..#.#',
}

/** Draw a glyph centred on (x, y), each font pixel `size` world pixels across. */
function drawGlyph(ctx: CanvasRenderingContext2D, glyph: string, x: number, y: number, size: number, color: string) {
  const bits = GLYPH_FONT[glyph] ?? GLYPH_FONT['?']
  ctx.fillStyle = color
  const left = snap(x - size * 1.5)
  const top = snap(y - size * 2.5)
  for (let index = 0; index < 15; index += 1) {
    if (bits[index] === '#') ctx.fillRect(left + (index % 3) * size, top + Math.floor(index / 3) * size, size, size)
  }
}

/**
 * Everything that can hurt the player wears a pulsing red ring, whatever its own colour,
 * so red always reads as "dodge this". The player's own shots never use red.
 */
function dangerRing(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, time: number) {
  const r = radius + (calm ? 0 : (Math.floor(time * 8) % 2) * PX)
  const steps = Math.max(10, Math.round(r * 0.9))
  ctx.fillStyle = dangerColors.solid
  for (let index = 0; index < steps; index += 1) {
    const angle = (index / steps) * TAU
    ctx.fillRect(snap(x + Math.cos(angle) * r), snap(y + Math.sin(angle) * r), PX, PX)
  }
}

/** A cheap hash for flicker that should look random but stay put within a beat. */
const hash = (value: number) => Math.abs(Math.sin(value * 12.9898) * 43758.5453) % 1

/**
 * A follower's death: a white flash, knocked back by the blow, then de-rendered top-down
 * behind a bright scan line (the engine sheds pixels of light from the line).
 */
function drawCorpse(ctx: CanvasRenderingContext2D, corpse: Corpse, assets: Assets, arena: ArenaId) {
  const t = 1 - corpse.life / corpse.maxLife
  const knock = Math.min(1, t / 0.25)
  const body: FollowerBody = corpse.final ? 'final' : corpse.elite ? 'elite' : (corpse.kind as 'acolyte' | 'zealot' | 'bishop')
  const wisp = corpse.kind === 'wisp'
  const sprite = t < 0.1 ? (wisp ? assets.hand.flash[0] : assets.enemy.flash[body][0]) : wisp ? assets.hand.base[0] : assets.enemy.dressed[arena][body][0]
  const scale = wisp ? PX : corpse.scale
  const height = sprite.height * scale
  const feet = wisp ? corpse.y - corpse.h / 2 + height / 2 : corpse.y
  const x = corpse.x + corpse.dir * knock * 10
  const tilt = corpse.dir * knock * 0.45
  // Everything above the scan line has already gone.
  const remaining = t < 0.25 ? 1 : 1 - (t - 0.25) / 0.75
  const line = feet - height * remaining
  ctx.save()
  ctx.beginPath()
  ctx.rect(x - height, line, height * 2, height + 4)
  ctx.clip()
  drawCharacter(ctx, sprite, x, feet, scale, flipEnemy(corpse.facing), 1, 1, tilt)
  ctx.restore()
  if (t >= 0.25) {
    ctx.fillStyle = corpse.final ? '#ff6a72' : wisp ? '#9be8d6' : '#fff1c8'
    ctx.fillRect(snap(x - height * 0.32), snap(line), snap(height * 0.64), PX)
  }
}

const flipEnemy = (facing: number) => facing !== ENEMY_SOURCE_FACING
const flipPlayer = (facing: number) => facing !== PLAYER_SOURCE_FACING

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, assets: Assets, arena: ArenaId, time: number) {
  const turnSquash = 1 - e.turn * 0.55
  if (e.kind === 'wisp') {
    // A Hallucination: a six-fingered hand that never quite holds together. Red and cyan
    // copies split off it, and every so often it jumps.
    const bob = Math.sin(e.phase * 6) * 3
    const frame = Math.floor(time * 6 + e.id) % 3
    const beat = Math.floor(time * 10) + e.id * 7
    const jump = !calm && hash(beat) < 0.12 ? PX * 2 * (hash(beat + 1) < 0.5 ? -1 : 1) : 0
    const flip = flipEnemy(e.facing)
    const x = snap(e.x) + jump
    const feet = snap(e.y - e.h / 2 + bob) + (assets.hand.base[frame].height * PX) / 2
    if (e.flash > 0) {
      drawCharacter(ctx, assets.hand.flash[frame], x, feet, PX, flip, turnSquash)
    } else {
      const split = calm ? PX : PX * (1 + Math.round(hash(beat + 2)))
      ctx.globalAlpha = 0.55
      drawCharacter(ctx, assets.hand.red[frame], x - split, feet, PX, flip, turnSquash)
      drawCharacter(ctx, assets.hand.cyan[frame], x + split, feet, PX, flip, turnSquash)
      ctx.globalAlpha = 1
      drawCharacter(ctx, assets.hand.base[frame], x, feet, PX, flip, turnSquash)
    }
  } else {
    // The frames walk; this adds a little bob and sway on top.
    const walking = e.onGround && Math.abs(e.vx) > 20
    const bob = walking ? Math.abs(Math.sin(e.phase * 11)) * 1.5 : 0
    // A hit rocks it back away from the blow for a moment.
    const flinch = e.flinch / 0.16
    const tilt = (walking ? Math.sin(e.phase * 11) * 0.04 : 0) + e.flinchDir * flinch * 0.22
    // Tells: the Evangelist's crouch and the bosses' raised arms are frames; bosses also shudder.
    const shudder = e.bossCharge > 0 ? (Math.floor(time * 30) % 2 ? PX : -PX) : 0
    const stretch = e.onGround || e.lunge > 0 ? 1 : 1.04
    const body: FollowerBody = e.title === FINAL_TITLE ? 'final' : e.elite ? 'elite' : (e.kind as 'acolyte' | 'zealot' | 'bishop')
    const frame = followerFrame(e, body)
    const telling = (e.windup > 0 || e.bossCharge > 0) && Math.floor(time * 12) % 2 === 0
    const sprite = !calm && (e.flash > 0 || telling) ? assets.enemy.flash[body][frame] : assets.enemy.dressed[arena][body][frame]
    const flip = flipEnemy(e.facing)
    drawCharacter(ctx, sprite, e.x + shudder + e.flinchDir * flinch * 4, e.y - bob, e.scale, flip, turnSquash / stretch, stretch, tilt)
    if (e.rooted > 0 || e.slow > 0) {
      ctx.globalAlpha = e.rooted > 0 ? 0.55 : 0.3 + Math.sin(time * 12) * 0.1
      const effect = e.rooted > 0 ? assets.enemy.rooted : assets.enemy.slowed
      drawCharacter(ctx, effect[body][frame], e.x, e.y - bob, e.scale, flip, turnSquash / stretch, stretch, tilt)
      ctx.globalAlpha = 1
    }
  }

  if (e.hp < e.maxHp || e.elite) {
    const width = snap(e.elite ? Math.max(120, e.w * 2.4) : Math.max(34, e.w + 10))
    const left = snap(e.x - width / 2)
    const top = snap(e.y - e.h - (e.kind === 'wisp' ? 10 : 16))
    ctx.fillStyle = '#0a0406'
    ctx.fillRect(left - PX, top - PX, width + PX * 2, PX * 3)
    ctx.fillStyle = e.elite ? '#f2b04a' : '#e0213a'
    ctx.fillRect(left, top, snap(width * Math.max(0, e.hp / e.maxHp)), PX)
    if (e.title) {
      ctx.font = '20px VT323, monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = '#f2b04a'
      ctx.fillText(e.title.toUpperCase(), e.x, top - 6)
    }
  }
}

let shakeEnabled = true
/** Players can turn screen shake off in Settings (it defaults off with reduced motion). */
export function setShakeEnabled(value: boolean) {
  shakeEnabled = value
}

/**
 * Accessibility settings. Reduced flashing drops the white hit flashes, the glitches and
 * the red hurt flash; the danger colour swaps the red rings round hostile shots for yellow.
 */
let calm = false
let dangerColors = { solid: '#ff3049', pulse: '#e43b44' }
export function setReducedFlashing(value: boolean) {
  calm = value
}
export function setDangerColor(color: 'red' | 'yellow') {
  dangerColors = color === 'yellow' ? { solid: '#ffd23f', pulse: '#f5a623' } : { solid: '#ff3049', pulse: '#e43b44' }
}

export type View = { scale: number; offsetX: number; offsetY: number; dpr: number; width: number; height: number }

export function render(
  ctx: CanvasRenderingContext2D,
  g: Game,
  assets: Assets,
  view: View,
) {
  const time = performance.now() / 1000
  layers ??= { ground: canvas(LW, LH), top: canvas(LW, LH), glow: canvas(LW, LH) }
  // Everyone the camera should draw: all players until the run ends.
  const shown = g.phase === 'dead' ? [] : g.players
  const coop = g.players.length > 1

  // ---- Ground layer: scenery, light, and everything that sits behind the characters.
  const ground = beginLayer(layers.ground, false)
  const arena = g.arena
  ground.drawImage(assets.backgrounds[arena.id], 0, 0)
  worldSpace(ground)
  ground.globalCompositeOperation = 'lighter'
  // Light falls from each arena's centrepiece: the rose window, the Eye in the crypt,
  // the Logos's screen in the vault, the gold Eye in the tomb.
  // Each chapter builds toward its boss: stage 0 is its first sermon, 4 the boss sermon.
  const stage = (g.wave - 1) % 5
  const shaftAlpha = 0.05 + stage * 0.01 + Math.sin(time * 0.7) * 0.012
  const [shaftColor, shaftTop] = SHAFTS[arena.id]
  for (let step = 0; step < 3; step += 1) {
    const inset = step * 70
    ground.fillStyle = `rgba(${shaftColor}, ${shaftAlpha})`
    ground.beginPath()
    ground.moveTo(600 + step * 10, shaftTop)
    ground.lineTo(680 - step * 10, shaftTop)
    ground.lineTo(860 - inset, GROUND_Y)
    ground.lineTo(420 + inset, GROUND_Y)
    ground.closePath()
    ground.fill()
  }
  for (const [index, candle] of arena.candles.entries()) {
    const flicker = 0.26 + Math.sin(time * 9 + index * 1.7) * 0.05 + (Math.sin(time * 23 + index) > 0.6 ? 0.04 : 0)
    if (candle.lamp) halo(ground, candle.x, candle.y - 26, 80, '120, 200, 210', 0.3)
    else halo(ground, candle.x, candle.y - 26, candle.brazier ? 90 : 62, '255, 150, 70', candle.brazier ? flicker + 0.08 : flicker)
  }
  drawChapterMood(ground, g, assets, stage, time)
  ground.globalCompositeOperation = 'lighter'
  for (const p of shown) if (!p.down) halo(ground, p.x, p.y - 38, 64, '255, 220, 190', 0.12)
  for (const e of g.enemies) {
    const final = e.title === FINAL_TITLE
    const glow = e.kind === 'wisp' ? '120, 220, 230' : final ? '220, 30, 60' : e.elite ? '242, 176, 74' : '220, 20, 45'
    const strength = e.kind === 'wisp' ? 0.3 : final ? 0.6 + (e.bossCharge > 0 ? 0.3 : 0) : e.elite ? 0.35 : 0.16
    halo(ground, e.x, e.y - e.h * 0.5, e.kind === 'wisp' ? 40 : e.h * (final ? 0.9 : 0.7), glow, strength)
  }
  ground.globalCompositeOperation = 'source-over'

  for (const stain of g.stains) {
    ground.globalAlpha = Math.min(1, stain.life / 4) * 0.85
    ground.fillStyle = '#4a0610'
    ground.fillRect(snap(stain.x - stain.r), stain.y - PX, snap(stain.r * 2), PX * 2)
    ground.fillRect(snap(stain.x - stain.r * 0.6), stain.y, snap(stain.r * 1.2), PX)
  }
  ground.globalAlpha = 1

  for (const seal of g.seals) {
    const fade = Math.min(1, seal.life / 0.5, (seal.maxLife - seal.life) / 0.15)
    ground.globalAlpha = fade
    // Rate Limit: a 429 ring on the floor, its segments ticking round like a stalled
    // progress bar, with the error code hanging over it.
    ground.fillStyle = 'rgba(247, 118, 34, 0.16)'
    ground.beginPath()
    ground.ellipse(snap(seal.x), snap(seal.y), seal.r, seal.r * 0.2, 0, 0, TAU)
    ground.fill()
    const segments = 16
    const lit = Math.floor(time * 8) % segments
    for (let index = 0; index < segments; index += 1) {
      const angle = (index / segments) * TAU
      ground.fillStyle = index === lit || index === (lit + 1) % segments ? '#ffffff' : index % 2 ? '#f77622' : '#b86f50'
      ground.fillRect(snap(seal.x + Math.cos(angle) * seal.r) - PX, snap(seal.y + Math.sin(angle) * seal.r * 0.2) - PX, PX * 3, PX * 2)
    }
    const codeY = seal.y - 34 + Math.round(Math.sin(time * 3) * 2) * PX
    for (const [index, digit] of ['4', '2', '9'].entries()) drawGlyph(ground, digit, seal.x + (index - 1) * PX * 4 * 2, codeY, PX * 2, '#f77622')
    ground.globalCompositeOperation = 'lighter'
    for (let step = 0; step < 3; step += 1) {
      ground.fillStyle = `rgba(247, 118, 34, ${0.06 * (step + 1)})`
      ground.fillRect(snap(seal.x - seal.r), seal.y - 60 + step * 20, snap(seal.r * 2), 20)
    }
    ground.globalCompositeOperation = 'source-over'
  }
  ground.globalAlpha = 1

  for (const glyph of g.glyphs) {
    const armed = glyph.arm <= 0
    ground.globalAlpha = Math.min(1, glyph.life / 0.4) * (armed ? 1 : 0.5)
    // CAPTCHA wall: warped letters rising out of the floor, each wobbling on its own, with
    // a wavy strike through them. Being solved, they flash; then they fall apart.
    const rise = armed ? 1 : 1 - glyph.arm / 0.35
    const crumble = glyph.fired ? Math.max(0, 1 - glyph.life / 0.6) : 0
    const size = PX * 3
    const spacing = size * 3 + PX * 2
    const width = spacing * glyph.text.length
    ground.fillStyle = `rgba(234, 212, 170, ${0.16 * rise * (1 - crumble)})`
    ground.fillRect(snap(glyph.x - width / 2 - PX * 2), snap(glyph.y - 62 * rise), snap(width + PX * 4), snap(62 * rise))
    ;[...glyph.text].forEach((letter, index) => {
      const wobble = Math.sin(time * 4 + index * 1.7) * 3
      const fall = crumble * (20 + index * 9)
      const x = glyph.x - width / 2 + spacing * (index + 0.5) + Math.sin(time * 3 + index) * 1.5
      const y = glyph.y - 30 * rise + wobble + fall
      const solving = glyph.fired && Math.floor(time * 10 + index) % 2 === 0
      const color = solving ? '#8ad1f5' : index % 2 ? '#e4a672' : '#ead4aa'
      drawGlyph(ground, letter, x, y, size, color)
    })
    ground.fillStyle = glyph.fired ? '#ffffff' : '#5a6988'
    for (let x = -width / 2; x < width / 2; x += PX) {
      ground.fillRect(snap(glyph.x + x), snap(glyph.y - 32 * rise + Math.sin(x * 0.12 + time * 5) * 5 + crumble * 30), PX, PX * 2)
    }
    ground.globalCompositeOperation = 'lighter'
    halo(ground, glyph.x, glyph.y - 20, 44, '234, 212, 170', armed ? 0.3 : 0.15)
    ground.globalCompositeOperation = 'source-over'
  }
  ground.globalAlpha = 1

  // Followers arriving: they load in. Walkers get a spinner on the floor that fills as they
  // arrive, with scanlines downloading them in from above; bosses load in gold with a
  // percentage; Hallucinations resolve out of a block of glitch noise.
  for (const [markIndex, mark] of g.marks.entries()) {
    const t = 1 - mark.timer / mark.maxTimer
    if (mark.kind === 'wisp') {
      const centre = mark.y - 13
      const size = 26
      const beat = Math.floor(time * 16) + markIndex * 11
      for (let cell = 0; cell < 36; cell += 1) {
        if (hash(beat + cell) > t * 0.8 + 0.1) continue
        ground.fillStyle = hash(beat + cell + 50) < 0.5 ? '#2ce8f5' : '#e43b44'
        ground.fillRect(snap(mark.x - size / 2 + (cell % 6) * (size / 6)), snap(centre - size / 2 + Math.floor(cell / 6) * (size / 6)), PX * 2, PX * 2)
      }
      ground.globalCompositeOperation = 'lighter'
      halo(ground, mark.x, centre, 40, '44, 232, 245', 0.4 * t)
      ground.globalCompositeOperation = 'source-over'
      continue
    }
    const color = mark.elite ? '#f2b04a' : '#ff3049'
    const rgb = mark.elite ? '242, 176, 74' : '255, 48, 73'
    const r = mark.elite ? 64 : 36
    const dots = 12
    const filled = Math.floor(t * dots)
    const head = Math.floor(time * 18) % dots
    for (let index = 0; index < dots; index += 1) {
      const angle = (index / dots) * TAU - Math.PI / 2
      ground.fillStyle = index === head ? '#ffffff' : index < filled ? color : `rgba(${rgb}, 0.3)`
      ground.fillRect(snap(mark.x + Math.cos(angle) * r) - PX, snap(mark.y + Math.sin(angle) * r * 0.22) - PX, PX * 3, PX * 2)
    }
    // Scanlines filling in from the top, down to the floor, as it loads.
    ground.globalCompositeOperation = 'lighter'
    const height = mark.elite ? 200 : 150
    const lines = Math.floor(t * (height / 6))
    for (let line = 0; line < lines; line += 1) {
      ground.fillStyle = `rgba(${rgb}, ${0.08 + (line / lines) * 0.18})`
      ground.fillRect(snap(mark.x - r * 0.5), snap(mark.y - height + line * 6), snap(r), PX)
    }
    ground.globalCompositeOperation = 'source-over'
    if (mark.elite) {
      const percent = `${Math.min(99, Math.floor(t * 100))}%`
      ;[...percent].forEach((char, index) => drawGlyph(ground, char, mark.x + (index - (percent.length - 1) / 2) * PX * 8, mark.y - 30, PX * 2, color))
    }
  }

  for (const [index, portal] of arena.portals.entries()) {
    // Under Crossed Wires the ledge gates take the colour of the floor gate that now leads to them.
    const crossed = cursed(g, 'wires') && index % 2 === 1
    const red = crossed ? portal.color !== 'red' : portal.color === 'red'
    ground.globalCompositeOperation = 'lighter'
    halo(ground, portal.x, portal.y - 40, 64, red ? '228, 59, 68' : '192, 203, 220', 0.4 + (Math.floor(time * 4) % 2) * 0.06)
    ground.globalCompositeOperation = 'source-over'
    const frame = CATHEDRAL[`portal${red ? 'Red' : 'Blue'}${(Math.floor(time * 8) + index) % 4}`]
    drawAtlas(ground, assets.cathedral, frame, portal.x - frame[2], portal.y - frame[3] * PX, PX)
  }

  for (const pickup of g.pickups) {
    if (pickup.life < 2 && Math.floor(time * 10) % 2) continue
    const bob = pickup.onGround ? (Math.floor(time * 4 + pickup.x) % 2) * PX - 4 : 0
    const cx = snap(pickup.x)
    const cy = snap(pickup.y - 10 + bob)
    ground.globalCompositeOperation = 'lighter'
    halo(ground, cx, cy, 24, '255, 50, 70', 0.6)
    ground.globalCompositeOperation = 'source-over'
    ground.fillStyle = '#1a0a0e'
    ground.fillRect(cx - 6, cy - 4, 12, 12)
    ground.fillStyle = '#e0213a'
    ground.fillRect(cx - 4, cy - 2, 8, 8)
    ground.fillStyle = '#ff8a95'
    ground.fillRect(cx - 4, cy - 2, PX, PX)
    ground.fillStyle = '#c4946a'
    ground.fillRect(cx - 2, cy - 8, 4, 4)
  }

  ground.fillStyle = 'rgba(0, 0, 0, 0.5)'
  for (const e of g.enemies) {
    if (e.onGround) ground.fillRect(snap(e.x - e.w * 0.6), e.y - PX, snap(e.w * 1.2), PX * 2)
  }
  for (const p of shown) if (p.onGround) ground.fillRect(snap(p.x - 16), p.y - PX, 32, PX * 2)

  // ---- Top layer: blood and debris in front of the characters.
  const top = beginLayer(layers.top, true)
  worldSpace(top)
  // ---- Glow layer: additive light in front of the characters.
  const glow = beginLayer(layers.glow, true)
  worldSpace(glow)

  for (const particle of g.particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife)
    const target = particle.glow ? glow : top
    target.globalAlpha = particle.glow ? alpha : Math.min(1, alpha * 2)
    target.fillStyle = particle.color
    if (particle.spark) {
      // A short streak along its flight.
      const speed = Math.hypot(particle.vx, particle.vy) || 1
      for (let step = 0; step < 3; step += 1) {
        target.fillRect(snap(particle.x - (particle.vx / speed) * step * PX), snap(particle.y - (particle.vy / speed) * step * PX), PX, PX)
      }
      continue
    }
    const size = Math.max(PX, snap(particle.glow ? particle.size * (0.5 + alpha * 0.5) : particle.size))
    target.fillRect(snap(particle.x - size / 2), snap(particle.y - size / 2), size, size)
  }
  top.globalAlpha = 1
  glow.globalAlpha = 1

  // Token bolts: letters in gold ink, trailing flecks.
  for (const bolt of g.bolts) {
    bolt.trail.forEach((point, index) => {
      if (index % 2) return
      glow.fillStyle = `rgba(242, 211, 139, ${(index + 1) / (bolt.trail.length + 2)})`
      glow.fillRect(snap(point.x), snap(point.y), PX, PX)
    })
    halo(glow, bolt.x, bolt.y, 14, '242, 211, 139', 0.55)
    drawGlyph(glow, bolt.glyph, bolt.x, bolt.y, PX, '#fff1c8')
  }

  for (const [spitIndex, spit] of g.spits.entries()) {
    if (spit.delay !== undefined && spit.delay > 0) {
      // A word about to fall: it flickers where it hangs, with a dashed line down its path.
      if (Math.floor(time * 10) % 2 === 0) drawGlyph(glow, spit.glyph ?? '?', spit.x, spit.y, PX * 2, '#ff3049')
      glow.fillStyle = 'rgba(255, 48, 73, 0.35)'
      for (let y = spit.y + 20; y < GROUND_Y; y += 24) glow.fillRect(snap(spit.x), snap(y), PX, PX * 4)
      continue
    }
    if (spit.kind === 'wrench') {
      // The Arch-Deacon's wrench, spinning end over end.
      const spin = Math.floor(time * 12) % 4
      halo(glow, spit.x, spit.y, 20, '228, 59, 68', 0.3)
      dangerRing(glow, spit.x, spit.y, 13, time)
      glow.fillStyle = '#e4a672'
      const long = PX * 7
      const thick = PX * 2
      if (spin % 2) glow.fillRect(snap(spit.x - thick / 2), snap(spit.y - long / 2), thick, long)
      else glow.fillRect(snap(spit.x - long / 2), snap(spit.y - thick / 2), long, thick)
      glow.fillStyle = '#ead4aa'
      const end = spin % 2 ? [0, (spin === 1 ? -1 : 1) * long / 2] : [(spin === 0 ? -1 : 1) * long / 2, 0]
      glow.fillRect(snap(spit.x + end[0]) - PX * 2, snap(spit.y + end[1]) - PX * 2, PX * 4, PX * 4)
      continue
    }
    if (spit.kind === 'wave') {
      // A shockwave: the floor cracking up in a wedge of stone that rolls along it.
      for (let column = -3; column <= 3; column += 1) {
        const jitter = (Math.floor(time * 20 + column) % 2) * PX * 2
        const height = snap(24 - Math.abs(column) * 6 + jitter)
        const cx = snap(spit.x + column * PX * 3)
        top.fillStyle = '#181425'
        top.fillRect(cx - PX, spit.y - height - PX, PX * 4, height + PX)
        top.fillStyle = column < 0 ? '#8b9bb4' : column === 0 ? '#c0cbdc' : '#5a6988'
        top.fillRect(cx, spit.y - height, PX * 2, height)
        top.fillStyle = '#3a4466'
        top.fillRect(cx + PX, spit.y - height + PX * 2, PX, PX * 2)
      }
      // A red-hot crack along the floor under it, so it reads as a hazard.
      glow.fillStyle = calm || Math.floor(time * 8) % 2 ? dangerColors.solid : dangerColors.pulse
      glow.fillRect(snap(spit.x - 26), spit.y - PX, 52, PX * 2)
      halo(glow, spit.x, spit.y - 8, 30, '228, 59, 68', 0.45)
      // Dust kicked up behind it.
      for (let puff = 0; puff < 4; puff += 1) {
        const back = -Math.sign(spit.vx) * (10 + puff * 8)
        glow.fillStyle = `rgba(192, 203, 220, ${0.22 - puff * 0.05})`
        glow.fillRect(snap(spit.x + back), snap(spit.y - 6 - ((time * 30 + puff * 5) % 12)), PX * 2, PX * 2)
      }
      continue
    }
    if (spit.kind === 'promise') {
      // A promise: a slow gold orb with a sparkle turning in it.
      halo(glow, spit.x, spit.y, 24, '228, 59, 68', 0.35)
      halo(glow, spit.x, spit.y, 18, '242, 211, 139', 0.5)
      dangerRing(glow, spit.x, spit.y, 11, time)
      glow.fillStyle = '#b86f50'
      glow.fillRect(snap(spit.x) - PX * 3, snap(spit.y) - PX * 2, PX * 6, PX * 4)
      glow.fillRect(snap(spit.x) - PX * 2, snap(spit.y) - PX * 3, PX * 4, PX * 6)
      glow.fillStyle = '#f2d38b'
      glow.fillRect(snap(spit.x) - PX * 2, snap(spit.y) - PX * 2, PX * 4, PX * 4)
      glow.fillStyle = '#ffffff'
      const spin = Math.floor(time * 8) % 2
      glow.fillRect(snap(spit.x) - (spin ? PX * 4 : 0), snap(spit.y) - (spin ? 0 : PX * 4), spin ? PX * 8 : PX, spin ? PX : PX * 8)
      continue
    }
    if (spit.kind === 'word') {
      // The Logos's words: red letters.
      halo(glow, spit.x, spit.y, 20, '228, 59, 68', 0.7)
      dangerRing(glow, spit.x, spit.y, 11, time)
      drawGlyph(glow, spit.glyph ?? '?', spit.x, spit.y, PX * 2, '#ff6a72')
      continue
    }
    // A glitch shard: corrupted pixels that never hold the same shape, split red and cyan.
    const beat = Math.floor(time * 14) + spitIndex * 5
    for (let index = 1; index <= 3; index += 1) {
      glow.fillStyle = `rgba(44, 232, 245, ${0.45 - index * 0.12})`
      glow.fillRect(snap(spit.x - spit.vx * 0.025 * index), snap(spit.y - spit.vy * 0.025 * index), PX * 2, PX)
    }
    halo(glow, spit.x, spit.y, 18, '228, 59, 68', 0.4)
    halo(glow, spit.x, spit.y, 12, '44, 232, 245', 0.45)
    dangerRing(glow, spit.x, spit.y, 10, time)
    for (let piece = 0; piece < 4; piece += 1) {
      const px = snap(spit.x + (hash(beat + piece) - 0.5) * 12)
      const py = snap(spit.y + (hash(beat + piece + 9) - 0.5) * 10)
      const w = PX * (1 + Math.floor(hash(beat + piece + 3) * 3))
      glow.fillStyle = '#e43b44'
      glow.fillRect(px - PX, py, w, PX * 2)
      glow.fillStyle = piece === 0 ? '#ffffff' : '#2ce8f5'
      glow.fillRect(px, py, w, PX * 2)
    }
  }

  // Hallucinations leave a trail of dead pixels, red and cyan.
  for (const e of g.enemies) {
    if (e.kind !== 'wisp') continue
    const cy = e.y - e.h / 2
    for (let index = 1; index <= 4; index += 1) {
      const size = PX * (index < 3 ? 2 : 1)
      glow.fillStyle = index % 2 ? `rgba(44, 232, 245, ${0.5 - index * 0.1})` : `rgba(228, 59, 68, ${0.5 - index * 0.1})`
      glow.fillRect(snap(e.x - e.vx * 0.03 * index + (hash(index + Math.floor(time * 8)) - 0.5) * 8), snap(cy - e.vy * 0.03 * index + index * 2), size, size)
    }
  }

  for (const [index, candle] of arena.candles.entries()) {
    const tall = Math.sin(time * 14 + index * 2.3) > 0
    if (candle.brazier) {
      // A tongue of fire over the coals: pixel columns that flicker in height.
      for (let column = -3; column <= 3; column += 1) {
        const height = snap(16 - Math.abs(column) * 3 + (Math.floor(time * 12 + column * 2 + index) % 3) * PX * 2)
        glow.fillStyle = Math.abs(column) < 2 ? '#ead4aa' : column % 2 ? '#e43b44' : '#e4a672'
        glow.fillRect(candle.x + column * PX * 2 - PX, candle.y - 28 - height, PX * 2, height)
      }
      continue
    }
    for (const dx of [-8, 0, 8]) {
      glow.fillStyle = '#e4a672'
      glow.fillRect(candle.x + dx - PX / 2, candle.y - 34, PX, tall ? 6 : 4)
      glow.fillStyle = '#ead4aa'
      glow.fillRect(candle.x + dx - PX / 2, candle.y - 30, PX, PX)
    }
  }

  for (const p of shown) {
    if (!(p.shield > 0 && !(p.shield < 0.7 && Math.floor(time * 12) % 2 === 0))) continue
    const radius = 54 + (Math.floor(time * 6) % 2) * PX
    halo(glow, p.x, p.y - 36, radius, '185, 163, 255', 0.3)
    glow.strokeStyle = 'rgba(214, 200, 255, 0.9)'
    glow.lineWidth = PX
    glow.beginPath()
    for (let side = 0; side <= 6; side += 1) {
      const angle = time * 1.5 + (side / 6) * TAU
      const px = snap(p.x + Math.cos(angle) * radius)
      const py = snap(p.y - 36 + Math.sin(angle) * radius)
      if (side === 0) glow.moveTo(px, py)
      else glow.lineTo(px, py)
    }
    glow.stroke()
  }

  // ---- Composite onto the screen.
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#050307'
  ctx.fillRect(0, 0, view.width * view.dpr, view.height * view.dpr)
  const shake = shakeEnabled ? g.trauma * g.trauma * 16 : 0
  const shakeX = snap(Math.sin(time * 53.1) * shake)
  const shakeY = snap(Math.cos(time * 47.3) * shake)
  const s = view.scale * view.dpr
  ctx.setTransform(s, 0, 0, s, (view.offsetX + shakeX * view.scale) * view.dpr, (view.offsetY + shakeY * view.scale) * view.dpr)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(layers.ground.element, SCENE.left, SCENE.top, SCENE.right - SCENE.left, SCENE.bottom - SCENE.top)

  for (const enemy of g.enemies) drawEnemy(ctx, enemy, assets, g.arena.id, time)
  for (const corpse of g.corpses) drawCorpse(ctx, corpse, assets, g.arena.id)

  for (const ghost of g.ghosts) {
    ctx.globalAlpha = (ghost.life / 0.22) * 0.45
    drawCharacter(ctx, assets.player[ghost.player ?? 0].run2.ghost, ghost.x, ghost.y, PLAYER_SCALE, flipPlayer(ghost.facing))
  }
  ctx.globalAlpha = 1

  for (const p of shown) {
    const frames = assets.player[p.index] ?? assets.player[0]
    if (p.down) {
      // Converted: kneeling, greyed, until a partner stands close.
      ctx.globalAlpha = 0.55 + Math.sin(time * 4) * 0.1
      drawCharacter(ctx, frames.idle0.ghost, p.x, p.y, PLAYER_SCALE, flipPlayer(p.facing), 1.1, 0.62, -0.15 * p.facing)
      ctx.globalAlpha = 1
      continue
    }
    const hurt = p.hurtTime / 0.3
    const dashing = p.dashTime > 0
    const blink = p.invuln > 0 && !dashing && hurt <= 0 && Math.floor(time * 16) % 2 === 0
    // The frames carry the run's bob and most of its lean; this adds a little tilt with speed,
    // a hard forward lean and stretch in a dash, and a recoil (thrown back, flashing red) when hit.
    const lean = (p.vx / 900) * 0.18 + (dashing ? p.dashDir * 0.22 : 0) - p.facing * hurt * 0.3
    const frame = frames[dashing ? 'run2' : hurt > 0.5 ? 'fall' : playerFrame(p, time)]
    const stretchX = (1 + p.squash * 0.6) * (dashing ? 1.25 : 1)
    const stretchY = (1 - p.squash) * (dashing ? 0.86 : 1)
    ctx.globalAlpha = blink ? 0.35 : 1
    drawCharacter(ctx, dashing ? frame.ghost : frame.base, p.x, p.y, PLAYER_SCALE, flipPlayer(p.facing), stretchX, stretchY, lean)
    if (hurt > 0 && Math.floor(time * 20) % 2 === 0) {
      ctx.globalAlpha = 0.6 * hurt
      drawCharacter(ctx, frame.hurt, p.x, p.y, PLAYER_SCALE, flipPlayer(p.facing), stretchX, stretchY, lean)
    }
    ctx.globalAlpha = 1
  }
  // In co-op, a marker over each player's head (gold for one, teal for two), and a ring that
  // fills as a downed player is revived.
  if (coop) {
    for (const p of shown) {
      const color = p.index ? '#9be8d6' : '#f2d38b'
      const top = snap(p.y - p.h - 26)
      if (p.down) {
        const progress = p.revive / REVIVE_TIME
        const steps = 16
        for (let index = 0; index < steps; index += 1) {
          const angle = (index / steps) * TAU - Math.PI / 2
          ctx.fillStyle = index / steps < progress ? color : 'rgba(255, 255, 255, 0.25)'
          ctx.fillRect(snap(p.x + Math.cos(angle) * 16) - PX, snap(p.y - 50 + Math.sin(angle) * 16) - PX, PX * 2, PX * 2)
        }
        continue
      }
      ctx.fillStyle = '#181425'
      ctx.fillRect(snap(p.x) - PX * 4, top - PX, PX * 8, PX * 4)
      ctx.fillStyle = color
      ctx.fillRect(snap(p.x) - PX * 3, top, PX * 6, PX)
      ctx.fillRect(snap(p.x) - PX * 2, top + PX, PX * 4, PX)
      ctx.fillRect(snap(p.x) - PX, top + PX * 2, PX * 2, PX)
    }
  }

  ctx.drawImage(layers.top.element, SCENE.left, SCENE.top, SCENE.right - SCENE.left, SCENE.bottom - SCENE.top)
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(layers.glow.element, SCENE.left, SCENE.top, SCENE.right - SCENE.left, SCENE.bottom - SCENE.top)
  ctx.globalCompositeOperation = 'source-over'

  ctx.textAlign = 'center'
  for (const text of g.texts) {
    const t = text.life / text.maxLife
    const pop = t > 0.85 ? 1.3 : 1
    ctx.globalAlpha = Math.min(1, t * 2.5)
    ctx.font = `${Math.round(text.size * pop)}px VT323, monospace`
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(10, 4, 8, 0.9)'
    ctx.strokeText(text.text, snap(text.x), snap(text.y))
    ctx.fillStyle = text.color
    ctx.fillText(text.text, snap(text.x), snap(text.y))
  }
  ctx.globalAlpha = 1

  // Vignette covers whatever part of the scene the window shows.
  const visible = [-view.offsetX / view.scale, -view.offsetY / view.scale, view.width / view.scale, view.height / view.scale] as const

  // A phone held upright shows only part of the arena: followers out of view are marked
  // at the edge they'll come from, at their height, in the danger colour.
  const left = visible[0]
  const right = visible[0] + visible[2]
  if (left > 1 || right < W - 1) {
    const pulse = calm || Math.floor(time * 4) % 2 ? 1 : 0.6
    ctx.fillStyle = dangerColors.solid
    for (const enemy of g.enemies) {
      const side = enemy.x < left ? -1 : enemy.x > right ? 1 : 0
      if (!side) continue
      const edge = side < 0 ? left + PX * 3 : right - PX * 3
      const y = snap(Math.max(PX * 6, Math.min(H - PX * 6, enemy.y - enemy.h / 2)))
      ctx.globalAlpha = pulse
      for (let row = -3; row <= 3; row += 1) {
        const reach = 4 - Math.abs(row)
        ctx.fillRect(snap(edge) - (side < 0 ? 0 : reach * PX), y + row * PX, reach * PX, PX)
      }
    }
    ctx.globalAlpha = 1
  }
  ctx.drawImage(assets.vignette, ...visible)
  // The low-health pulse follows whoever standing is closest to falling.
  const danger = Math.min(1, ...g.players.filter((p) => !p.down).map((p) => p.hp / p.maxHp))
  const lowHealth = g.phase === 'playing' && danger < 0.3 ? (0.3 - danger) * 2 * (Math.floor(time * 3) % 2 ? 1 : 0.6) : 0
  const redness = Math.max(g.hurtFlash * (calm ? 0.15 : 0.45), lowHealth * (calm ? 0.3 : 0.6))
  if (redness > 0.01) {
    ctx.globalAlpha = Math.min(1, redness)
    ctx.drawImage(assets.redVignette, ...visible)
    ctx.globalAlpha = 1
  }
}
