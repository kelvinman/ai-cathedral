// Generates src/assets/player-frames.png: the player's animation frames. The head is taken
// as-is from src/assets/player-sprite.png (the original hand-drawn sprite); everything below
// the neck is drawn here, posed per frame: a long scribe's coat over a white shirt and red
// cravat, a quill in the front hand, trousers and boots.
//
//   node scripts/generate-characters.mjs
//
// The renderer outlines each frame in ink, so shapes here only need inner edges.

import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'

// ---------- PNG in and out ----------

function readPng(file) {
  const buffer = readFileSync(new URL(`../${file}`, import.meta.url))
  let position = 8
  let width = 0
  let height = 0
  const data = []
  while (position < buffer.length) {
    const length = buffer.readUInt32BE(position)
    const type = buffer.toString('ascii', position + 4, position + 8)
    const body = buffer.subarray(position + 8, position + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      if (body[8] !== 8 || body[9] !== 6) throw new Error(`${file}: expected 8-bit RGBA`)
    }
    if (type === 'IDAT') data.push(body)
    position += 12 + length
  }
  const raw = inflateSync(Buffer.concat(data))
  const stride = width * 4
  const pixels = Buffer.alloc(stride * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x]
      const a = x >= 4 ? pixels[y * stride + x - 4] : 0
      const b = y ? pixels[(y - 1) * stride + x] : 0
      const c = x >= 4 && y ? pixels[(y - 1) * stride + x - 4] : 0
      let out = value
      if (filter === 1) out += a
      else if (filter === 2) out += b
      else if (filter === 3) out += (a + b) >> 1
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        out += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      }
      pixels[y * stride + x] = out & 255
    }
  }
  const get = (x, y) => {
    const offset = (y * width + x) * 4
    if (pixels[offset + 3] < 128) return null
    return `#${[0, 1, 2].map((index) => pixels[offset + index].toString(16).padStart(2, '0')).join('')}`
  }
  return { width, height, get }
}

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buffer) => {
  let c = 0xffffffff
  for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function writePng(file, width, height, get) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = get(x, y)
      if (!color) continue
      const offset = y * (width * 4 + 1) + 1 + x * 4
      raw[offset] = parseInt(color.slice(1, 3), 16)
      raw[offset + 1] = parseInt(color.slice(3, 5), 16)
      raw[offset + 2] = parseInt(color.slice(5, 7), 16)
      raw[offset + 3] = 255
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(new URL(`../${file}`, import.meta.url), png)
}

// ---------- Drawing ----------

class Sprite {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.px = new Array(w * h).fill(null)
  }
  set(x, y, color) {
    x = Math.round(x)
    y = Math.round(y)
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = color
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null
    return this.px[y * this.w + x]
  }
}

/** Degrees from straight down; positive swings forward (toward -x, the way the player faces). */
const toward = (x, y, degrees, length) => {
  const angle = (degrees * Math.PI) / 180
  return [x - Math.sin(angle) * length, y + Math.cos(angle) * length]
}

/**
 * A limb segment of radius r, shaded across its width: lit on the side facing the top-left,
 * shadowed on the other, with a one-pixel dark rim so overlapping limbs stay readable.
 */
function limb(s, [x0, y0], [x1, y1], r, [light, mid, dark, rim]) {
  const dx = x1 - x0
  const dy = y1 - y0
  const length = Math.hypot(dx, dy) || 1
  for (let y = Math.floor(Math.min(y0, y1) - r - 1); y <= Math.ceil(Math.max(y0, y1) + r + 1); y += 1) {
    for (let x = Math.floor(Math.min(x0, x1) - r - 1); x <= Math.ceil(Math.max(x0, x1) + r + 1); x += 1) {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (length * length)))
      const px = x0 + dx * t
      const py = y0 + dy * t
      const distance = Math.hypot(x - px, y - py)
      if (distance > r) continue
      // Which side of the segment: the normal that points up-left is the lit one.
      let nx = -dy / length
      let ny = dx / length
      if (nx + ny > 0) {
        nx = -nx
        ny = -ny
      }
      const side = ((x - px) * nx + (y - py) * ny) / r
      const color = distance > r - 0.8 ? rim : side > 0.35 ? light : side < -0.4 ? dark : mid
      s.set(x, y, color)
    }
  }
}

/** Fill a polygon; `shade(x, y)` picks each pixel's colour. */
function polygon(s, points, shade) {
  const ys = points.map(([, y]) => y)
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y += 1) {
    const crossings = []
    for (let index = 0; index < points.length; index += 1) {
      const [ax, ay] = points[index]
      const [bx, by] = points[(index + 1) % points.length]
      if ((ay <= y + 0.5 && by > y + 0.5) || (by <= y + 0.5 && ay > y + 0.5)) {
        crossings.push(ax + ((y + 0.5 - ay) / (by - ay)) * (bx - ax))
      }
    }
    crossings.sort((a, b) => a - b)
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      for (let x = Math.round(crossings[index]); x < Math.round(crossings[index + 1]); x += 1) {
        const color = shade(x, y, crossings[index], crossings[index + 1])
        if (color) s.set(x, y, color)
      }
    }
  }
}

// ---------- The player ----------

// A coat with real value range, so arms, lapels and tails read against each other.
const COAT = ['#4d4260', '#362d45', '#251f30', '#120d17']
const COAT_BACK = ['#362d45', '#2a2336', '#1d1726', '#0d0a11']
const TROUSERS = ['#3a3348', '#2a2436', '#1c1725', '#0d0a11']
const TROUSERS_BACK = ['#2a2436', '#211c2c', '#16121d', '#0d0a11']
const BOOT = ['#5a4f66', '#2a2230', '#15111a', '#08060a']
const SKIN = ['#f7dfcc', '#e8c3ad', '#c8978e', '#5f3a35']
const SHIRT = { light: '#f2f0f5', shade: '#b9b5c0' }
const CRAVAT = { light: '#be353d', dark: '#792831' }
const QUILL = { vane: '#ead4aa', shade: '#c3a77c', nib: '#e4a672', glow: '#ffffff' }
const BUTTON = '#e4a672'

const head = readPng('src/assets/player-sprite.png')
/** The original sprite's head ends at this row; the body starts below it. */
const NECK = 38
/** From this row down, only the chin and hair are kept: the original collar is redrawn. */
const CHIN = 32
const HEAD_COLORS = new Set(['#f7dfcc', '#d5a79f', '#c8978e', '#5f3a35', '#aa7d67', '#f3c98e', '#674426', '#a07660', '#775c52'])
const FRAME = { w: 52, h: 94 }

/**
 * A pose: each leg's thigh and shin angle, each arm's shoulder and elbow angle (degrees from
 * straight down, positive forward), how far the coat tails stream back and lift, and
 * whether the feet are planted (planted frames are lowered so the lowest boot meets row 93).
 */
function drawPlayer(pose) {
  const s = new Sprite(FRAME.w, FRAME.h + 8)
  const hip = { front: [22, 62], back: [29, 62] }
  const shoulder = { front: [19, 43 + (pose.breath ?? 0)], back: [32, 43 + (pose.breath ?? 0)] }

  // Back arm and back leg sit behind the coat.
  const armChain = (from, [upper, lower]) => {
    const elbow = toward(from[0], from[1], upper, 9)
    const wrist = toward(elbow[0], elbow[1], upper + lower, 8)
    return { elbow, wrist, hand: toward(wrist[0], wrist[1], upper + lower, 1.5) }
  }
  const legChain = (from, [thigh, shin]) => {
    const knee = toward(from[0], from[1], thigh, 13)
    const ankle = toward(knee[0], knee[1], shin, 13)
    return { knee, ankle }
  }
  const legs = { front: legChain(hip.front, pose.front), back: legChain(hip.back, pose.back) }
  const arms = { front: armChain(shoulder.front, pose.armFront), back: armChain(shoulder.back, pose.armBack) }

  const boot = (ankle, shin, palette) => {
    // The foot follows the shin a little, so a trailing boot points its toe down.
    const tilt = Math.max(-50, Math.min(25, shin * 0.6))
    const toe = toward(ankle[0], ankle[1] + 2, 90 + tilt, 5)
    const heel = toward(ankle[0], ankle[1] + 2, -90 + tilt, 2)
    limb(s, heel, toe, 2.4, palette)
    limb(s, [ankle[0], ankle[1] - 1], [ankle[0], ankle[1] + 1], 2.4, palette)
  }

  limb(s, shoulder.back, arms.back.elbow, 2.6, COAT_BACK)
  limb(s, arms.back.elbow, arms.back.wrist, 2.3, COAT_BACK)
  limb(s, arms.back.wrist, arms.back.hand, 1.7, SKIN)
  limb(s, hip.back, legs.back.knee, 3.2, TROUSERS_BACK)
  limb(s, legs.back.knee, legs.back.ankle, 2.7, TROUSERS_BACK)
  boot(legs.back.ankle, pose.back[1], BOOT)

  // Coat tails: the back panel streams behind (to +x) and lifts with speed or a fall.
  const tail = pose.tail ?? 0
  const lift = pose.lift ?? 0
  polygon(s, [[25, 58], [36, 58], [38 + tail, 73 - lift], [33 + tail, 75 - lift], [27, 73]], (x, y, left, right) =>
    x <= left + 1 ? COAT[1] : x >= right - 2 ? COAT[3] : y > 72 - lift ? COAT[2] : COAT[2],
  )

  // Front leg.
  limb(s, hip.front, legs.front.knee, 3.3, TROUSERS)
  limb(s, legs.front.knee, legs.front.ankle, 2.8, TROUSERS)
  boot(legs.front.ankle, pose.front[1], BOOT)

  // Torso: the coat from shoulders to hips, lit from the left.
  const lean = pose.lean ?? 0
  polygon(s, [[14 - lean, 40], [37 - lean, 40], [39 - lean, 46], [36, 61], [16, 61], [13 - lean, 47]], (x, y, left, right) => {
    if (x <= left + 1) return COAT[0]
    if (x >= right - 2) return COAT[3]
    if (x >= right - 6) return COAT[2]
    return COAT[1]
  })
  // Shirt front, cravat and lapels in the open collar.
  polygon(s, [[21 - lean, 39], [30 - lean, 39], [26 - lean * 0.5, 52]], (x, _y, left, right) => (x >= right - 2 ? SHIRT.shade : SHIRT.light))
  polygon(s, [[23.5 - lean, 40], [28 - lean, 40], [27 - lean, 45], [25.5 - lean, 47], [24 - lean, 45]], (x, _y, left) => (x <= left + 1 ? CRAVAT.light : CRAVAT.dark))
  for (let y = 40; y < 53; y += 1) {
    const t = (y - 40) / 13
    s.set(20.5 - lean + t * 5, y, COAT[0])
    s.set(30.5 - lean - t * 4, y, COAT[3])
  }
  for (const y of [54, 58]) s.set(26, y, BUTTON)
  // A belt line at the waist, and the front panel of the coat skirt over the thigh.
  for (let x = 16; x < 36; x += 1) s.set(x, 61, COAT[3])
  polygon(s, [[16, 61], [26, 61], [24 + tail * 0.3, 73 - lift * 0.6], [15 + tail * 0.2, 72 - lift * 0.6]], (x, y, left, right) =>
    x <= left + 1 ? COAT[0] : x >= right - 1 ? COAT[3] : y > 70 - lift ? COAT[2] : COAT[1],
  )

  // Front arm over everything but the head, holding the quill.
  limb(s, shoulder.front, arms.front.elbow, 2.8, COAT)
  limb(s, arms.front.elbow, arms.front.wrist, 2.5, COAT)
  const cuff = toward(arms.front.wrist[0], arms.front.wrist[1], pose.armFront[0] + pose.armFront[1], -1)
  limb(s, cuff, arms.front.wrist, 1.8, [SHIRT.light, SHIRT.light, SHIRT.shade, SHIRT.shade])
  limb(s, arms.front.wrist, arms.front.hand, 1.9, SKIN)
  const [hx, hy] = arms.front.hand
  const quillAngle = pose.quill ?? 155
  for (let step = 0; step < 8; step += 1) {
    const [qx, qy] = toward(hx, hy, quillAngle, step)
    s.set(qx, qy, step < 2 ? QUILL.nib : QUILL.vane)
    if (step > 2 && step < 7) s.set(qx + 1, qy, QUILL.shade)
  }
  s.set(...toward(hx, hy, quillAngle + 180, 1.5), QUILL.glow)

  // A stand-up coat collar with the shirt's points showing, behind the chin.
  polygon(s, [[17 - lean, 37], [34 - lean, 35], [37 - lean, 41], [15 - lean, 41]], (x, _y, left, right) =>
    x <= left + 1 ? COAT[0] : x >= right - 2 ? COAT[3] : COAT[1],
  )
  for (const [x, y] of [[22, 38], [23, 39], [29, 38], [28, 39]]) s.set(x - lean, y, SHIRT.light)

  // The head goes on last, over the collar.
  for (let y = 0; y <= NECK; y += 1) {
    for (let x = 0; x < FRAME.w; x += 1) {
      const color = head.get(x, y)
      if (color && (y < CHIN || HEAD_COLORS.has(color))) s.set(x, y, color)
    }
  }

  // Lower planted poses so the lowest boot meets the bottom row.
  let lowest = 0
  for (let y = 0; y < s.h; y += 1) for (let x = 0; x < s.w; x += 1) if (s.get(x, y)) lowest = y
  const drop = pose.planted === false ? 0 : FRAME.h - 1 - lowest
  const frame = new Sprite(FRAME.w, FRAME.h)
  for (let y = 0; y < s.h; y += 1) for (let x = 0; x < s.w; x += 1) {
    const color = s.get(x, y)
    if (color) frame.set(x, y + drop, color)
  }
  return frame
}

// Run cycle for one leg (thigh, shin), six frames: reach, load, pass under, push off,
// recover with the heel up, swing through. The other leg is half a cycle behind.
const STRIDE = [
  [34, 22],
  [18, 6],
  [0, -6],
  [-26, -32],
  [-14, -84],
  [22, -44],
]
const run = STRIDE.map((front, index) => {
  const back = STRIDE[(index + 3) % 6]
  return {
    front,
    back,
    // Arms swing against the legs, elbows bent.
    armFront: [-front[0] * 0.9, 70],
    armBack: [-back[0] * 0.9, 70],
    tail: 3 + (index % 3),
    lift: 1 + (index % 3 === 1 ? 1 : 0),
    lean: 1,
    quill: 150,
  }
})

const POSES = {
  idle0: { front: [4, 0], back: [-5, 0], armFront: [12, 40], armBack: [-6, 20], tail: 0, quill: 160 },
  idle1: { front: [4, 0], back: [-5, 0], armFront: [12, 44], armBack: [-6, 22], tail: 0, quill: 162, breath: 1 },
  ...Object.fromEntries(run.map((pose, index) => [`run${index}`, pose])),
  jump: { front: [48, -8], back: [8, -40], armFront: [110, 30], armBack: [60, 30], tail: 1, lift: -1, planted: false, quill: 130 },
  fall: { front: [14, 8], back: [-22, -20], armFront: [95, -15], armBack: [135, 10], tail: 3, lift: 5, planted: false, quill: 120 },
}

const names = Object.keys(POSES)
const frames = names.map((name) => drawPlayer(POSES[name]))
writePng('src/assets/player-frames.png', FRAME.w * frames.length, FRAME.h, (x, y) => frames[Math.floor(x / FRAME.w)].get(x % FRAME.w, y))
console.log(`player-frames.png: ${names.length} frames of ${FRAME.w}×${FRAME.h}: ${names.join(', ')}`)
