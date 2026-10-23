// Generates the character sheets:
//
// - src/assets/player-frames.png: the player's animation frames. The head is taken as-is
//   from src/assets/player-sprite.png (the original hand-drawn sprite); everything below the
//   neck is drawn here, posed per frame: a long scribe's coat over a white shirt and red
//   cravat, a quill in the front hand, trousers and boots.
// - src/assets/follower-frames.png: every follower type's walk and attack frames, once per
//   arena in that arena's dress (bone masks, visors and cables, gold circlets).
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

// ---------- Followers ----------
// Every follower faces right (+x) and stands in a 56×84 frame with its feet on the bottom
// row. Angles here are degrees from straight down, positive swinging forward (+x).

const F = { w: 56, h: 84 }
const ahead = (x, y, degrees, length) => {
  const angle = (degrees * Math.PI) / 180
  return [x + Math.sin(angle) * length, y + Math.cos(angle) * length]
}
/** Robe shading for polygons: lit edge on the left, shadowed band and rim on the right. */
const robeShade = ([light, mid, dark, rim], hem = Infinity) => (x, y, left, right) => {
  if (y >= hem) return rim
  if (x <= left + 1) return light
  if (x >= right - 1) return rim
  if (x >= right - 5) return dark
  return mid
}
function disc(s, cx, cy, r, color) {
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y += 1) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x += 1) {
      const c = typeof color === 'function' ? color(x - cx, y - cy) : color
      if (Math.hypot(x - cx, y - cy) <= r && c) s.set(x, y, c)
    }
  }
}
function pixels(s, x0, y0, rows, colors) {
  rows.forEach((row, y) => [...row].forEach((key, x) => colors[key] && s.set(x0 + x, y0 + y, colors[key])))
}
/** Two small feet under a robe, one stepping ahead of the other. */
function feet(s, step, colors) {
  const [front, back] = [step, -step]
  s.set(0, 0, null)
  for (const [x, shade] of [[33 + front, colors[1]], [22 + back, colors[2]]]) {
    for (let dx = 0; dx < 6; dx += 1) {
      s.set(x + dx, 82, dx === 5 ? colors[2] : shade)
      s.set(x + dx, 83, colors[3])
    }
    s.set(x + 1, 81, shade)
    s.set(x + 2, 81, shade)
  }
}
const SKIN_DARK = ['#c88d6b', '#a97a5c', '#7a5240', '#3f2832']
const SKIN_PALE = ['#e8c3ad', '#c8978e', '#9a6b62', '#5f3a35']
const SHOES = ['#5a4048', '#3f2832', '#2a1b22', '#120a0e']
const WALK = [-1, 0, 1, 0]

/** Fold lines down a robe that swing with its hem: a shadow crease with a lit edge beside it. */
function folds(s, xs, top, bottom, sway, [light, , dark]) {
  for (const x0 of xs) {
    for (let y = top; y < bottom; y += 1) {
      const x = Math.round(x0 + (sway * (y - top)) / (bottom - top))
      if (!s.get(x, y) || !s.get(x - 1, y)) continue
      s.set(x, y, dark)
      if (y > top + 4) s.set(x - 1, y, light)
    }
  }
}

// The Early Adopter: hunched in a grey hood, face lit by the phone held up in both hands.
function earlyAdopter(frame) {
  const s = new Sprite(F.w, F.h)
  const robe = ['#7a6d7c', '#4f4558', '#352d3d', '#18131c']
  const sway = WALK[frame]
  const bob = frame % 2
  feet(s, sway * 3, SHOES)
  // A hunched back, the robe flaring to the hem.
  polygon(s, [[19, 24 + bob], [28, 20 + bob], [35, 23 + bob], [40, 36 + bob], [42 + sway, 81], [12 + sway, 81], [12, 60], [15, 38 + bob]], robeShade(robe, 80))
  folds(s, [20, 27, 35], 46 + bob, 80, sway * 2, robe)
  // Wide sleeves reach forward to the phone.
  limb(s, [32, 30 + bob], [36, 40 + bob], 3.4, robe)
  limb(s, [36, 40 + bob], [43, 33 + bob], 3, robe)
  limb(s, [43, 33 + bob], [45, 31 + bob], 1.9, SKIN_DARK)
  // The hood, bowed toward the screen: dark inside, the face lit from below.
  disc(s, 33, 18 + bob, 9.5, (dx, dy) => (dx + dy < -9 ? robe[0] : dx > 5 && dy > -3 ? null : dy > 6 ? robe[2] : robe[1]))
  disc(s, 38, 21 + bob, 5.5, '#18131c')
  const face = { x: 39, y: 22 + bob }
  disc(s, face.x, face.y, 3.6, (dx, dy) => (dy > 2 ? '#9be8d6' : dx < -1.5 ? SKIN_DARK[2] : SKIN_DARK[1]))
  s.set(face.x + 1, face.y - 1, '#181425')
  s.set(face.x + 3, face.y - 1, '#181425')
  // The phone, its screen toward the face, glow on the hood's rim.
  pixels(s, 44, 25 + bob, ['##', 'g#', 'g#', 'g#', '##'], { '#': '#181425', g: '#c6f5e8' })
  for (const [x, y] of [[41, 26], [42, 27], [36, 27]]) s.set(x, y + bob, '#588f6d')
  return { sprite: s, face, chest: { x: 28, y: 32 + bob, length: 20 } }
}

// The Evangelist: wiry and leaning forward, shouting, an AGI placard held high.
const STEP4 = [
  [28, 14],
  [4, -4],
  [-24, -26],
  [8, -52],
]
function evangelist(frame) {
  const s = new Sprite(F.w, F.h)
  const tunic = ['#9a6cc8', '#6a4494', '#452866', '#1b0f29']
  const legs = ['#5a4f62', '#3f3648', '#2a2332', '#120e16']
  const hair = '#24182a'
  const pose =
    frame === 4
      ? { lean: 30, hip: [22, 64], front: [55, 30], back: [-35, -70], signArm: [-150, 30] }
      : frame === 5
        ? { lean: 55, hip: [18, 58], front: [60, 40], back: [-60, -60], signArm: [100, 20] }
        : { lean: 14, hip: [24, 56], front: STEP4[frame], back: STEP4[(frame + 2) % 4], signArm: [175, 10] }
  const [hx, hy] = pose.hip
  const legChain = ([thigh, shin], palette) => {
    const knee = ahead(hx, hy, thigh, 13)
    const ankle = ahead(knee[0], knee[1], shin, 13)
    limb(s, [hx, hy], knee, 2.8, palette)
    limb(s, knee, ankle, 2.3, palette)
    limb(s, [ankle[0] - 1, ankle[1] + 1], [ankle[0] + 4, ankle[1] + 1], 1.8, SHOES)
    return ankle
  }
  legChain(pose.back, ['#3f3648', '#2a2332', '#1e1926', '#120e16'])
  legChain(pose.front, legs)
  // Torso: a ragged tunic, broad at the shoulders, leaning into the walk.
  const shoulder = ahead(hx, hy, 180 - pose.lean, 20)
  const axis = [(shoulder[0] - hx) / 20, (shoulder[1] - hy) / 20]
  const across = [-axis[1], axis[0]]
  const at = ([x, y], width, along = 0) => [
    [x + across[0] * width + axis[0] * along, y + across[1] * width + axis[1] * along],
    [x - across[0] * width + axis[0] * along, y - across[1] * width + axis[1] * along],
  ]
  const [shoulderA, shoulderB] = at(shoulder, 6)
  const [hemA, hemB] = at([hx, hy], 6, -5)
  polygon(s, [shoulderA, shoulderB, hemB, [hemB[0] * 0.5 + hemA[0] * 0.5, hemB[1] * 0.5 + hemA[1] * 0.5 + 2], hemA], robeShade(tunic))
  const sash = at(ahead(hx, hy, 180 - pose.lean, 8), 6)
  limb(s, sash[0], sash[1], 1, ['#e4a672', '#b86f50', '#b86f50', '#743f39'])
  // Sign arm (behind the head) holding the placard up on a short pole.
  const elbow = ahead(shoulder[0], shoulder[1], pose.signArm[0], 8)
  const hand = ahead(elbow[0], elbow[1], pose.signArm[0] + pose.signArm[1], 7)
  limb(s, shoulder, elbow, 2.3, SKIN_DARK)
  limb(s, elbow, hand, 2.1, SKIN_DARK)
  const poleTop = [hand[0], hand[1] - 9]
  limb(s, [hand[0], hand[1] + 2], poleTop, 0.9, ['#b86f50', '#743f39', '#743f39', '#3f2832'])
  // The placard: cream board, red letters, kept inside the frame.
  const bx = Math.max(0, Math.min(F.w - 17, Math.round(poleTop[0] - 8)))
  const by = Math.max(0, Math.round(poleTop[1] - 9))
  for (let y = 0; y < 10; y += 1) for (let x = 0; x < 17; x += 1) s.set(bx + x, by + y, x === 0 || y === 0 || x === 16 || y === 9 ? '#743f39' : '#ead4aa')
  pixels(s, bx + 3, by + 2, ['.#..##.###', '#.#.#...#.', '###.#.#.#.', '#.#.#.#.#.', '#.#..##.###'], { '#': '#be353d' })
  // Head: shouting, hair wild.
  const face = { x: Math.min(F.w - 6, Math.round(shoulder[0] + 4)), y: Math.round(shoulder[1] - 7) }
  disc(s, face.x, face.y, 5, (dx, dy) => (dx < -2 ? SKIN_DARK[2] : dy < -2 && dx < 1 ? SKIN_DARK[0] : SKIN_DARK[1]))
  for (const [dx, dy] of [[-5, -4], [-6, -2], [-4, -6], [-2, -7], [0, -7], [2, -6], [-7, 0], [-6, 1], [-3, -5], [-1, -5], [1, -5], [-5, -1], [-4, -3]]) s.set(face.x + dx, face.y + dy, hair)
  s.set(face.x + 2, face.y - 1, '#181425')
  s.set(face.x + 4, face.y + 2, '#3f2832')
  s.set(face.x + 4, face.y + 3, '#3f2832')
  // Front arm: a pointing fist.
  const frontElbow = ahead(shoulder[0], shoulder[1], 70 + (frame === 5 ? 20 : 0), 8)
  const fist = ahead(frontElbow[0], frontElbow[1], 95, 7)
  limb(s, shoulder, frontElbow, 2.5, tunic)
  limb(s, frontElbow, fist, 2.2, SKIN_DARK)
  return { sprite: s, face, chest: { x: Math.round(shoulder[0]), y: Math.round(shoulder[1] + 3), length: 10 } }
}

// The Hype Bishop: a tall mitre with the Eye on it, a wide red cope, a gold crozier.
function hypeBishop(frame) {
  const s = new Sprite(F.w, F.h)
  const cope = ['#d8564f', '#9e2835', '#792831', '#3e1017']
  const gold = ['#ead4aa', '#e4a672', '#b86f50', '#743f39']
  const sway = WALK[frame]
  const bob = frame % 2
  feet(s, sway * 2, SHOES)
  // A round, self-satisfied body.
  polygon(s, [[18, 30 + bob], [38, 30 + bob], [46, 48 + bob], [47 + sway, 81], [11 + sway, 81], [12, 50 + bob]], robeShade(cope, 80))
  folds(s, [17, 23, 38, 43], 50 + bob, 79, sway * 2, cope)
  // The back sleeve hangs at its side.
  limb(s, [19, 34 + bob], [15, 52 + bob], 3.6, cope)
  // Gold orphrey down the front and along the hem.
  for (let y = 31 + bob; y < 81; y += 1) {
    const x = Math.round(31 + (y - 31) * 0.12 + sway * ((y - 31) / 50))
    s.set(x, y, gold[1])
    s.set(x + 1, y, gold[2])
  }
  for (let x = 12 + sway; x < 47 + sway; x += 1) s.set(x, 79, x % 4 ? gold[1] : gold[2])
  // Face and jowls under the mitre.
  const face = { x: 32, y: 26 + bob }
  disc(s, face.x, face.y, 5.5, (dx, dy) => (dx < -3 ? SKIN_PALE[2] : dy > 3 ? SKIN_PALE[2] : SKIN_PALE[1]))
  s.set(face.x + 2, face.y - 1, '#181425')
  s.set(face.x + 4, face.y + 2, SKIN_PALE[3])
  // The mitre: two tall peaks, banded in gold, the Eye on its face.
  polygon(s, [[26, 22 + bob], [38, 22 + bob], [36, 6 + bob], [32, 1 + bob], [28, 6 + bob]], (x, y, left, right) =>
    x <= left + 1 ? '#f2f0f5' : x >= right - 2 ? '#b9b5c0' : '#e6e2ea',
  )
  for (let x = 26; x < 39; x += 1) s.set(x, 21 + bob, gold[1])
  pixels(s, 30, 11 + bob, ['.###.', '#.r.#', '.###.'], { '#': gold[2], r: '#e43b44' })
  // Crozier in the front hand, with a curled gold crook.
  limb(s, [36, 38 + bob], [44, 46 + bob], 3, cope)
  limb(s, [44, 46 + bob], [46, 44 + bob], 2, SKIN_PALE)
  limb(s, [47, 10 + bob], [47, 82], 1, gold)
  pixels(s, 44, 3 + bob, ['.###.', '#...#', '#..#.', '.#...', '..#..', '..#..', '..#..'], { '#': gold[1] })
  return { sprite: s, face, chest: { x: 26, y: 33 + bob, length: 30 } }
}

// The Arch-Deacon, the Logos's maker: an old engineer-priest with a white beard, brass
// goggles, cables over the shoulders, and the giant wrench it slams the ground with.
function archDeacon(frame) {
  const s = new Sprite(F.w, F.h)
  const vest = ['#5a6988', '#3a4466', '#262b44', '#131626']
  const gold = ['#ead4aa', '#e4a672', '#b86f50', '#743f39']
  const charging = frame === 4
  const sway = charging ? 0 : WALK[frame]
  const bob = charging ? 1 : frame % 2
  feet(s, sway * 3, SHOES)
  polygon(s, [[16, 30 + bob], [38, 30 + bob], [43, 50 + bob], [44 + sway, 81], [12 + sway, 81], [12, 48 + bob]], robeShade(vest, 80))
  folds(s, [17, 33, 39], 58 + bob, 78, sway * 2, vest)
  for (let x = 12 + sway; x < 44 + sway; x += 1) s.set(x, 78, gold[2])
  // A belt of tools.
  for (let x = 14; x < 42; x += 1) s.set(x, 54 + bob, '#3f2832')
  pixels(s, 18, 55 + bob, ['#..#.##', '#..#.##', '...#...'], { '#': '#8b9bb4' })
  // Cables draped over the shoulders like a stole: red, teal and black.
  for (const [offset, color] of [[0, '#be353d'], [2, '#588f6d'], [4, '#181425']]) {
    for (let y = 31; y < 62; y += 1) {
      const x = 22 + offset + Math.round(Math.sin((y + offset) * 0.35) * 1.5)
      s.set(x, y + bob, color)
    }
  }
  // Head: bald and old, beard to the chest, goggles pushed up.
  const face = { x: 31, y: 23 + bob }
  disc(s, face.x, face.y, 6, (dx, dy) => (dx < -3 ? SKIN_PALE[2] : SKIN_PALE[1]))
  polygon(s, [[26, 26 + bob], [37, 26 + bob], [35, 38 + bob], [31, 41 + bob], [27, 36 + bob]], (x, _y, left, right) =>
    x <= left + 1 ? '#f2f0f5' : x >= right - 1 ? '#8b9bb4' : '#c0cbdc',
  )
  pixels(s, 26, 16 + bob, ['.##..##', '#oo##oo', '.##..##'], { '#': gold[1], o: '#9be8d6' })
  s.set(face.x + 3, face.y, '#181425')
  // The wrench: carried low while walking, raised overhead to slam.
  const grip = charging ? [33, 10 + bob] : [41, 46 + bob]
  const head = charging ? [33, -2] : [50, 22 + bob]
  limb(s, [36, 34 + bob], grip, 3, vest)
  limb(s, grip, head, 1.6, ['#8b9bb4', '#5a6988', '#3a4466', '#181425'])
  const [wx, wy] = head.map(Math.round)
  pixels(s, wx - 6, Math.max(0, wy - 4), ['.####....####.', '##############', '#####....#####', '####......####', '###........###'], { '#': gold[1], s: gold[2] })
  for (let x = wx - 6; x < wx + 8; x += 1) s.get(x, Math.max(0, wy - 3)) && s.set(x, Math.max(0, wy - 3), gold[0])
  disc(s, grip[0], grip[1], 2, SKIN_PALE[1])
  return { sprite: s, face, chest: { x: 25, y: 33 + bob, length: 24 } }
}

// The Logos, in its giant body: a towering robe with the Eye for a head inside a halo of
// runes, long arms ending in claws, and cables trailing from the hem like roots.
function theLogos(frame) {
  const s = new Sprite(F.w, F.h)
  const robe = ['#4a3550', '#2c1f33', '#1a1220', '#08050a']
  const charging = frame === 4
  const ripple = charging ? 0 : WALK[frame]
  // Roots of cable dragging behind.
  for (const [start, color, length] of [[18, '#be353d', 14], [24, '#588f6d', 12], [30, '#181425', 16]]) {
    for (let step = 0; step < length; step += 1) s.set(start - step, 82 - Math.round(Math.abs(Math.sin((step + frame) * 0.6)) * 2), color)
  }
  polygon(s, [[18, 26], [38, 26], [44, 44], [48 + ripple, 82], [10 - ripple, 82], [12, 44]], robeShade(robe, 82))
  // Red seams.
  for (let y = 30; y < 82; y += 1) {
    s.set(Math.round(28 + (y - 30) * 0.08), y, '#be353d')
    if (y % 9 === 0) for (let x = 14; x < 44; x += 3) s.set(x, y, '#792831')
  }
  // Arms: raised to the halo when it gathers itself, otherwise reaching ahead.
  const arm = (shoulderX, angles, palette) => {
    const elbow = ahead(shoulderX, 32, angles[0], 11)
    const hand = ahead(elbow[0], elbow[1], angles[1], 11)
    limb(s, [shoulderX, 32], elbow, 2.6, palette)
    limb(s, elbow, hand, 2.2, palette)
    for (const spread of [-25, 0, 25]) {
      const tip = ahead(hand[0], hand[1], angles[1] + spread, 3)
      s.set(tip[0], tip[1], '#c0cbdc')
    }
  }
  arm(20, charging ? [-160, -170] : [30 - ripple * 6, 70], ['#2c1f33', '#1a1220', '#120c16', '#08050a'])
  arm(36, charging ? [160, 170] : [60 + ripple * 6, 95], robe)
  // Halo of gold runes behind the head, then the Eye.
  const eye = { x: 29, y: 16 }
  disc(s, eye.x, eye.y, 12, (dx, dy) => {
    const r = Math.hypot(dx, dy)
    if (r < 10.5) return null
    return Math.abs(Math.sin(Math.atan2(dy, dx) * 8)) > 0.7 ? '#e4a672' : '#b86f50'
  })
  disc(s, eye.x, eye.y, 7.5, (dx, dy) => {
    const r = Math.hypot(dx, dy)
    if (r > 6.6) return '#181425'
    if (r < 2.2) return '#181425'
    if (r < 4.2) return charging ? '#ffffff' : '#e43b44'
    return dx + dy < -3 ? '#ffffff' : '#ead4aa'
  })
  return { sprite: s, face: eye, chest: { x: 28, y: 30, length: 0 } }
}

// ---------- Arena dress, drawn over each follower's face and chest ----------
const DRESS = {
  cathedral: () => {},
  // The ninety-nine's bones, worn as masks.
  crypt: (s, { face }) => {
    pixels(s, face.x - 4, face.y - 3, ['..#####..', '.#######.', '#oo###oo#', '#oo###oo#', '####o###s', '.######s.', '..#o#o#..'], {
      '#': '#ead4aa',
      s: '#c0cbdc',
      o: '#181425',
    })
  },
  // Plugged in: a glowing visor, a status light, and a cable from the back of the head.
  vault: (s, { face }) => {
    pixels(s, face.x - 5, face.y - 1, ['===========', '-----------'], { '=': '#c6f5e8', '-': '#588f6d' })
    s.set(face.x + 6, face.y - 2, '#e43b44')
    for (let step = 0; step < 16; step += 1) {
      const x = face.x - 6 - Math.round(step * 0.7)
      s.set(x, face.y - 1 + step, '#181425')
      s.set(x + 1, face.y - 1 + step, '#181425')
    }
  },
  // The devout: a gold circlet with the Eye set in red, and a gold stole down the chest.
  tomb: (s, { face, chest }) => {
    pixels(s, face.x - 6, face.y - 5, ['===========er', '-----------rw'], { '=': '#e4a672', '-': '#b86f50', e: '#e4a672', r: '#e43b44', w: '#ffffff' })
    for (let y = 0; y < chest.length; y += 1) {
      s.set(chest.x + (y % 2), chest.y + y, '#e4a672')
      s.set(chest.x + 1 - (y % 2), chest.y + y, '#b86f50')
    }
  },
}

// Sheet layout, which src/game/render.ts mirrors: one row per follower type per arena (in
// ARENA_ORDER), then one row for the Logos, who wears nothing but itself.
const ARENA_ORDER = ['cathedral', 'crypt', 'vault', 'tomb']
const FOLLOWERS = [
  { name: 'acolyte', draw: earlyAdopter, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
  { name: 'zealot', draw: evangelist, frames: ['walk0', 'walk1', 'walk2', 'walk3', 'windup', 'lunge'] },
  { name: 'bishop', draw: hypeBishop, frames: ['walk0', 'walk1', 'walk2', 'walk3'] },
  { name: 'elite', draw: archDeacon, frames: ['walk0', 'walk1', 'walk2', 'walk3', 'charge'] },
]
const rows = []
for (const follower of FOLLOWERS) {
  for (const arena of ARENA_ORDER) {
    rows.push(
      follower.frames.map((_, index) => {
        const drawn = follower.draw(index)
        DRESS[arena](drawn.sprite, drawn)
        return drawn.sprite
      }),
    )
  }
}
rows.push(['walk0', 'walk1', 'walk2', 'walk3', 'charge'].map((_, index) => theLogos(index).sprite))
const columns = Math.max(...rows.map((row) => row.length))
writePng('src/assets/follower-frames.png', F.w * columns, F.h * rows.length, (x, y) => rows[Math.floor(y / F.h)][Math.floor(x / F.w)]?.get(x % F.w, y % F.h) ?? null)
console.log(`follower-frames.png: ${rows.length} rows of up to ${columns} frames of ${F.w}×${F.h}`)
