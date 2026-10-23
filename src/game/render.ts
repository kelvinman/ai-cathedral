import atlasUrl from '../assets/gothic-sprites.png'
import cathedralUrl from '../assets/cathedral-sprites.png'
import cryptUrl from '../assets/crypt-sprites.png'
import enemyUrl from '../assets/enemy-sprite.png'
import playerUrl from '../assets/player-sprite.png'
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
  skull: [105, 107, 12, 12],
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

export type Assets = {
  atlas: HTMLImageElement
  cathedral: HTMLImageElement
  backgrounds: Record<ArenaId, HTMLCanvasElement>
  vignette: HTMLCanvasElement
  redVignette: HTMLCanvasElement
  player: { base: Sprite; flash: Sprite; ghost: Sprite }
  enemy: {
    acolyte: Sprite
    zealot: Sprite
    bishop: Sprite
    elite: Sprite
    final: Sprite
    flash: Sprite
    slowed: Sprite
    rooted: Sprite
  }
  skull: { base: Sprite; flash: Sprite }
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

function pentagram(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rotation: number, squash = 1) {
  ctx.save()
  ctx.translate(snap(x), snap(y))
  ctx.scale(1, squash)
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, TAU)
  for (let point = 0; point <= 5; point += 1) {
    const angle = rotation - Math.PI / 2 + (point * Math.PI * 4) / 5
    const px = Math.cos(angle) * r * 0.92
    const py = Math.sin(angle) * r * 0.92
    if (point === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.restore()
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

/** Candelabras on wall sconces or ledges, and the crypt's braziers. */
function drawCandles(ctx: CanvasRenderingContext2D, atlas: CanvasImageSource, cathedral: CanvasImageSource, crypt: CanvasImageSource, arena: Arena) {
  const [shelfW] = tile(CATHEDRAL.cornice)
  for (const candle of arena.candles) {
    if (candle.brazier) {
      drawAtlas(ctx, crypt, CRYPT.brazier, candle.x - 16, candle.y - 36, PX)
      continue
    }
    if (candle.shelf) drawAtlas(ctx, cathedral, CATHEDRAL.cornice, candle.x - shelfW / 2, candle.y, PX)
    drawAtlas(ctx, atlas, ATLAS.candelabra, candle.x - 14, candle.y - 28, PX)
  }
}

function buildCathedral(atlas: CanvasImageSource, cathedral: CanvasImageSource, crypt: CanvasImageSource) {
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
  drawCandles(ctx, atlas, cathedral, crypt, arena)
  fadeBleed(ctx)
  return element
}

/**
 * The crypt beneath the nave: long teal stone blocks, round arches on squat pillars,
 * skull-filled ossuary niches, hanging chains, braziers, and the Eye of the Logos carved where
 * the cathedral has its rose window. The centre ledge is a sarcophagus.
 */
function buildCrypt(atlas: CanvasImageSource, cathedral: CanvasImageSource, crypt: CanvasImageSource) {
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
    for (let x = from; x + ossuaryW <= to; x += ossuaryW) drawAtlas(ctx, crypt, CRYPT.ossuary, x, 300, PX)
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
  drawCandles(ctx, atlas, cathedral, crypt, arena)
  fadeBleed(ctx)
  return element
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

let assetsPromise: Promise<Assets> | null = null

export function loadAssets() {
  assetsPromise ??= Promise.all([
    loadImage(atlasUrl),
    loadImage(playerUrl),
    loadImage(enemyUrl),
    loadImage(cathedralUrl),
    loadImage(cryptUrl),
  ]).then(([atlas, player, enemy, cathedral, crypt]) => {
    const skull = crop(atlas, ATLAS.skull)
    return {
      atlas,
      cathedral,
      backgrounds: { cathedral: buildCathedral(atlas, cathedral, crypt), crypt: buildCrypt(atlas, cathedral, crypt) },
      vignette: buildVignette('0,0,0', [0.18, 0.32, 0.46, 0.6, 0.72]),
      redVignette: buildVignette('200,0,20', [0.3, 0.5, 0.7, 0.85, 1]),
      player: {
        base: outlined(player, '#050307'),
        flash: silhouette(player, '#ffffff'),
        ghost: silhouette(player, '#bcc8ff'),
      },
      enemy: {
        acolyte: outlined(enemy, '#4a0711'),
        zealot: outlined(enemy, '#4a0711', ['#7a33e0', 0.38]),
        bishop: outlined(enemy, '#4a0711', ['#c0142a', 0.42]),
        elite: outlined(enemy, '#f2b04a', ['#c0142a', 0.5]),
        // The Logos: a shadow-dark body with a blood-red outline.
        final: outlined(enemy, '#e43b44', ['#181425', 0.6]),
        flash: silhouette(enemy, '#ffffff'),
        slowed: silhouette(enemy, '#ff2a40'),
        rooted: silhouette(enemy, '#a77bff'),
      },
      skull: { base: outlined(skull, '#4a0711'), flash: silhouette(skull, '#ffffff') },
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

const flipEnemy = (facing: number) => facing !== ENEMY_SOURCE_FACING
const flipPlayer = (facing: number) => facing !== PLAYER_SOURCE_FACING

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy, assets: Assets, time: number) {
  const turnSquash = 1 - e.turn * 0.55
  if (e.kind === 'wisp') {
    const bob = Math.sin(e.phase * 6) * 3
    const sprite = e.flash > 0 ? assets.skull.flash : assets.skull.base
    drawCharacter(ctx, sprite, snap(e.x), snap(e.y - e.h / 2 + bob) + sprite.height, PX, flipEnemy(e.facing), turnSquash)
  } else {
    const walking = e.onGround && Math.abs(e.vx) > 20
    const bob = walking ? Math.abs(Math.sin(e.phase * 11)) * 3 : 0
    const tilt = walking ? Math.sin(e.phase * 11) * 0.05 : e.lunge > 0 ? e.facing * 0.25 : 0
    // Tells: an Evangelist crouches before lunging; a boss shudders before slamming.
    const crouch = e.windup > 0 ? 0.78 : 1
    const shudder = e.bossCharge > 0 ? (Math.floor(time * 30) % 2 ? PX : -PX) : 0
    const stretch = (e.onGround ? 1 : 1.06) * crouch
    const base = e.title === FINAL_TITLE ? assets.enemy.final : e.elite ? assets.enemy.elite : assets.enemy[e.kind]
    const telling = (e.windup > 0 || e.bossCharge > 0) && Math.floor(time * 12) % 2 === 0
    const sprite = e.flash > 0 || telling ? assets.enemy.flash : base
    const flip = flipEnemy(e.facing)
    drawCharacter(ctx, sprite, e.x + shudder, e.y - bob, e.scale, flip, turnSquash / stretch, stretch, tilt)
    if (e.rooted > 0 || e.slow > 0) {
      ctx.globalAlpha = e.rooted > 0 ? 0.55 : 0.3 + Math.sin(time * 12) * 0.1
      drawCharacter(ctx, e.rooted > 0 ? assets.enemy.rooted : assets.enemy.slowed, e.x, e.y - bob, e.scale, flip, turnSquash / stretch, stretch, tilt)
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

export type View = { scale: number; offsetX: number; offsetY: number; dpr: number; width: number; height: number }

export function render(
  ctx: CanvasRenderingContext2D,
  g: Game,
  assets: Assets,
  view: View,
) {
  const time = performance.now() / 1000
  layers ??= { ground: canvas(LW, LH), top: canvas(LW, LH), glow: canvas(LW, LH) }
  const p = g.player
  const playerVisible = g.phase !== 'dead'

  // ---- Ground layer: scenery, light, and everything that sits behind the characters.
  const ground = beginLayer(layers.ground, false)
  const arena = g.arena
  ground.drawImage(assets.backgrounds[arena.id], 0, 0)
  worldSpace(ground)
  ground.globalCompositeOperation = 'lighter'
  // Light falls from the rose window in the nave (red) or the Eye of the Logos in the crypt (teal).
  const shaftAlpha = 0.05 + Math.sin(time * 0.7) * 0.012
  const shaftColor = arena.id === 'crypt' ? '88, 143, 109' : '220, 50, 70'
  const shaftTop = arena.id === 'crypt' ? 190 : ROSE_Y + 60
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
    halo(ground, candle.x, candle.y - 26, candle.brazier ? 90 : 62, '255, 150, 70', candle.brazier ? flicker + 0.08 : flicker)
  }
  if (playerVisible) halo(ground, p.x, p.y - 38, 64, '255, 220, 190', 0.12)
  for (const e of g.enemies) {
    const final = e.title === FINAL_TITLE
    const glow = e.kind === 'wisp' || final ? '220, 30, 60' : e.elite ? '242, 176, 74' : '220, 20, 45'
    const strength = e.kind === 'wisp' ? 0.5 : final ? 0.6 + (e.bossCharge > 0 ? 0.3 : 0) : e.elite ? 0.35 : 0.16
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
    ground.fillStyle = 'rgba(140, 10, 25, 0.4)'
    ground.beginPath()
    ground.ellipse(snap(seal.x), snap(seal.y), seal.r, seal.r * 0.2, 0, 0, TAU)
    ground.fill()
    ground.strokeStyle = '#ff3049'
    ground.lineWidth = PX
    pentagram(ground, seal.x, seal.y, seal.r, Math.round(time * 8) / 10, 0.2)
    ground.stroke()
    ground.globalCompositeOperation = 'lighter'
    for (let step = 0; step < 3; step += 1) {
      ground.fillStyle = `rgba(255, 40, 60, ${0.07 * (step + 1)})`
      ground.fillRect(snap(seal.x - seal.r), seal.y - 60 + step * 20, snap(seal.r * 2), 20)
    }
    ground.globalCompositeOperation = 'source-over'
  }
  ground.globalAlpha = 1

  for (const glyph of g.glyphs) {
    const armed = glyph.arm <= 0
    ground.globalAlpha = Math.min(1, glyph.life / 0.4) * (armed ? 1 : 0.5)
    ground.strokeStyle = glyph.fired ? '#e6d6ff' : '#a77bff'
    ground.lineWidth = glyph.fired ? PX * 2 : PX
    const pulse = armed && Math.floor(time * 4) % 2 ? 1.05 : 1
    pentagram(ground, glyph.x, glyph.y, glyph.r * pulse, -Math.round(time * 12) / 10, 0.22)
    ground.stroke()
    ground.globalCompositeOperation = 'lighter'
    halo(ground, glyph.x, glyph.y - 4, 40, '157, 107, 255', armed ? 0.45 : 0.2)
    ground.globalCompositeOperation = 'source-over'
  }
  ground.globalAlpha = 1

  for (const mark of g.marks) {
    const t = 1 - mark.timer / mark.maxTimer
    const r = (mark.kind === 'wisp' ? 26 : mark.elite ? 70 : 40) * (0.4 + t * 0.6)
    const cy = mark.kind === 'wisp' ? mark.y - 13 : mark.y
    ground.strokeStyle = `rgba(255, 48, 73, ${0.4 + t * 0.6})`
    ground.lineWidth = PX
    pentagram(ground, mark.x, cy, r, Math.round(time * 30) / 10, mark.kind === 'wisp' ? 1 : 0.25)
    ground.stroke()
    ground.globalCompositeOperation = 'lighter'
    if (mark.kind !== 'wisp') {
      for (let step = 0; step < 4; step += 1) {
        ground.fillStyle = `rgba(255, 30, 60, ${0.1 * t * (step + 1)})`
        ground.fillRect(snap(mark.x - r * 0.6), mark.y - 170 + step * 42, snap(r * 1.2), 44)
      }
    } else {
      halo(ground, mark.x, cy, 40, '255, 30, 60', 0.5 * t)
    }
    ground.globalCompositeOperation = 'source-over'
  }

  for (const [index, portal] of arena.portals.entries()) {
    const red = portal.color === 'red'
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
  if (playerVisible && p.onGround) ground.fillRect(snap(p.x - 16), p.y - PX, 32, PX * 2)

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
    const size = Math.max(PX, snap(particle.glow ? particle.size * (0.5 + alpha * 0.5) : particle.size))
    target.fillRect(snap(particle.x - size / 2), snap(particle.y - size / 2), size, size)
  }
  top.globalAlpha = 1
  glow.globalAlpha = 1

  for (const bolt of g.bolts) {
    bolt.trail.forEach((point, index) => {
      glow.fillStyle = `rgba(242, 211, 139, ${(index + 1) / (bolt.trail.length + 2)})`
      glow.fillRect(snap(point.x) - PX, snap(point.y) - PX, PX * 2, PX * 2)
    })
    halo(glow, bolt.x, bolt.y, 12, '242, 211, 139', 0.7)
    glow.fillStyle = '#fff6dc'
    glow.fillRect(snap(bolt.x) - PX, snap(bolt.y) - PX, PX * 2, PX * 2)
  }

  for (const spit of g.spits) {
    if (spit.kind === 'wave') {
      // A shockwave: a cluster of blood spikes rolling along the ground.
      for (let column = -3; column <= 3; column += 1) {
        const height = snap(26 - Math.abs(column) * 6 + (Math.floor(time * 20 + column) % 2) * PX * 2)
        glow.fillStyle = column === 0 ? '#ffffff' : Math.abs(column) < 2 ? '#e43b44' : '#9e2835'
        glow.fillRect(snap(spit.x + column * PX * 2), spit.y - height, PX * 2, height)
      }
      halo(glow, spit.x, spit.y - 10, 26, '228, 59, 68', 0.7)
      continue
    }
    for (let index = 1; index <= 3; index += 1) {
      glow.fillStyle = `rgba(228, 59, 68, ${0.5 - index * 0.12})`
      glow.fillRect(snap(spit.x - spit.vx * 0.02 * index) - PX, snap(spit.y - spit.vy * 0.02 * index) - PX, PX * 2, PX * 2)
    }
    halo(glow, spit.x, spit.y, 18, '228, 59, 68', 0.8)
    glow.fillStyle = '#c55c6b'
    glow.fillRect(snap(spit.x) - PX * 2, snap(spit.y) - PX * 2, PX * 4, PX * 4)
    glow.fillStyle = '#ffffff'
    glow.fillRect(snap(spit.x) - PX, snap(spit.y) - PX, PX, PX)
  }

  for (const e of g.enemies) {
    if (e.kind !== 'wisp') continue
    const cy = e.y - e.h / 2
    for (let index = 1; index <= 3; index += 1) {
      const size = snap(10 - index * 2)
      glow.fillStyle = `rgba(255, 90, 60, ${0.6 - index * 0.15})`
      glow.fillRect(snap(e.x - e.vx * 0.03 * index - size / 2), snap(cy - e.vy * 0.03 * index + index * 3), size, size)
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

  if (playerVisible && p.shield > 0 && !(p.shield < 0.7 && Math.floor(time * 12) % 2 === 0)) {
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

  for (const enemy of g.enemies) drawEnemy(ctx, enemy, assets, time)

  for (const ghost of g.ghosts) {
    ctx.globalAlpha = (ghost.life / 0.22) * 0.45
    drawCharacter(ctx, assets.player.ghost, ghost.x, ghost.y, PLAYER_SCALE, flipPlayer(ghost.facing))
  }
  ctx.globalAlpha = 1

  if (playerVisible) {
    const blink = p.invuln > 0 && p.dashTime <= 0 && Math.floor(time * 16) % 2 === 0
    const running = p.onGround && Math.abs(p.vx) > 40
    const bob = running ? Math.abs(Math.sin(p.runPhase)) * 3 : 0
    const lean = (p.vx / 900) * 0.35
    ctx.globalAlpha = blink ? 0.35 : 1
    drawCharacter(
      ctx,
      p.dashTime > 0 ? assets.player.ghost : assets.player.base,
      p.x,
      p.y - bob,
      PLAYER_SCALE,
      flipPlayer(p.facing),
      1 + p.squash * 0.6,
      1 - p.squash,
      lean,
    )
    ctx.globalAlpha = 1
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
  ctx.drawImage(assets.vignette, ...visible)
  const danger = p.hp / p.maxHp
  const lowHealth = g.phase === 'playing' && danger < 0.3 ? (0.3 - danger) * 2 * (Math.floor(time * 3) % 2 ? 1 : 0.6) : 0
  const redness = Math.max(g.hurtFlash * 0.45, lowHealth * 0.6)
  if (redness > 0.01) {
    ctx.globalAlpha = Math.min(1, redness)
    ctx.drawImage(assets.redVignette, ...visible)
    ctx.globalAlpha = 1
  }
}
