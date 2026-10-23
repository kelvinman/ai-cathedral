// Generates src/assets/cathedral-sprites.png, the crypt, vault and tomb sheets, and src/assets/ui/*.png (extra scenery and UI
// pieces in the style of src/assets/gothic-sprites.png: Endesga 32 palette, 1px ink outlines,
// light from the top-left), plus public/favicon.png and the public/og-image.png share card.
// Every pixel is placed explicitly from the palette, so there is no anti-aliasing.
//
//   node scripts/generate-cathedral-sprites.mjs
//
// Prints the sprite rectangles that src/game/render.ts uses. The UI frames in src/assets/ui/
// are 9-sliced by src/index.css with border-image.

import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const C = {
  ink: '#181425',
  stone0: '#262b44',
  stone1: '#3a4466',
  stone2: '#5a6988',
  stone3: '#8b9bb4',
  stone4: '#c0cbdc',
  white: '#ffffff',
  wood0: '#3f2832',
  wood1: '#743f39',
  gold0: '#b86f50',
  gold1: '#e4a672',
  cream: '#ead4aa',
  blood0: '#792831',
  blood1: '#9e2835',
  blood2: '#be353d',
  blood3: '#e43b44',
  rose: '#c55c6b',
  moss0: '#405d67',
  moss1: '#497169',
  moss2: '#588f6d',
}

function seeded(seed) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

class Sprite {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.px = new Array(w * h).fill(null)
  }
  set(x, y, color) {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = color
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null
    return this.px[y * this.w + x]
  }
  rect(x, y, w, h, color) {
    for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) this.set(i, j, color)
  }
  /** Ink outline around the silhouette, like the source sheet. */
  outline() {
    const edges = []
    for (let y = 0; y < this.h; y += 1) {
      for (let x = 0; x < this.w; x += 1) {
        if (this.get(x, y)) continue
        const touches = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => {
          const neighbour = this.get(x + dx, y + dy)
          return neighbour && neighbour !== C.ink
        })
        if (touches) edges.push([x, y])
      }
    }
    for (const [x, y] of edges) this.set(x, y, C.ink)
    return this
  }
}

/** Cylinder shading across a width, lit from the left. */
function ramp(x, w) {
  const t = x / Math.max(1, w - 1)
  if (t < 0.12) return C.stone3
  if (t < 0.32) return C.stone2
  if (t < 0.68) return C.stone1
  return C.stone0
}

// ---------- Wall bricks (tileable 32×16) ----------
function wall(seed, extra) {
  const s = new Sprite(32, 16)
  const random = seeded(seed)
  const shades = Array.from({ length: 8 }, () => (random() < 0.18 ? 1 : 0))
  for (let y = 0; y < 16; y += 1) {
    const row = y < 8 ? 0 : 1
    for (let x = 0; x < 32; x += 1) {
      const bx = (x + (row ? 8 : 0)) % 32
      const brick = row * 4 + Math.floor(bx / 16)
      const lx = bx % 16
      const ly = y % 8
      let color = shades[brick] ? C.stone1 : C.stone0
      if (ly === 7 || lx === 15) color = C.ink
      else if (ly === 0) color = shades[brick] ? C.stone2 : C.stone1
      else if (lx === 0) color = C.stone1
      else if (random() < 0.05) color = C.stone1
      else if (random() < 0.03) color = C.ink
      s.set(x, y, color)
    }
  }
  extra?.(s, random)
  return s
}

const wallA = wall(11)
const wallB = wall(23, (s, random) => {
  // Moss creeping along the mortar.
  for (let x = 2; x < 30; x += 1) {
    if (random() < 0.55) s.set(x, 6, random() < 0.5 ? C.moss0 : C.moss1)
    if (random() < 0.25) s.set(x, 5, C.moss1)
    if (random() < 0.1) s.set(x, 4, C.moss2)
  }
})
const wallC = wall(37, (s) => {
  // A crack running through two courses.
  const path = [
    [9, 1],
    [10, 2],
    [10, 3],
    [11, 4],
    [11, 5],
    [12, 6],
    [13, 8],
    [13, 9],
    [14, 10],
    [13, 11],
    [14, 12],
    [15, 13],
  ]
  for (const [x, y] of path) {
    s.set(x, y, C.ink)
    s.set(x + 1, y, C.stone2)
  }
})

// ---------- Pillar shaft (tileable 20×16), capital, base ----------
const shaft = new Sprite(20, 16)
for (let y = 0; y < 16; y += 1) {
  for (let x = 0; x < 20; x += 1) {
    let color = ramp(x - 1, 18)
    if (x === 0 || x === 19) color = C.ink
    else if (x === 6 || x === 13) color = C.ink // fluting
    else if (x === 7 || x === 14) color = C.stone2
    if (y === 15 && x > 0 && x < 19) color = C.ink
    if (y === 0 && x > 0 && x < 19 && x !== 6 && x !== 13) color = C.stone2
    shaft.set(x, y, color)
  }
}

const capital = new Sprite(30, 14)
// Abacus slab.
for (let x = 1; x < 29; x += 1) {
  capital.set(x, 1, x < 6 ? C.stone4 : C.stone3)
  capital.set(x, 2, ramp(x - 1, 28))
  capital.set(x, 3, ramp(x - 1, 28))
  capital.set(x, 4, C.ink)
}
// Carved bell narrowing toward the shaft, with a leaf band.
for (let y = 5; y < 12; y += 1) {
  const inset = Math.floor((y - 5) * 0.6) + 2
  for (let x = inset; x < 30 - inset; x += 1) {
    let color = ramp(x - inset, 30 - inset * 2)
    if (y === 7 && x % 4 === 1) color = C.stone3
    if (y === 8 && x % 4 === 2) color = C.ink
    capital.set(x, y, color)
  }
}
for (let x = 5; x < 25; x += 1) capital.set(x, 12, C.ink)
capital.outline()

const base = new Sprite(30, 12)
for (let x = 4; x < 26; x += 1) {
  base.set(x, 1, x < 8 ? C.stone3 : C.stone2)
  base.set(x, 2, ramp(x - 4, 22))
  base.set(x, 3, C.ink)
}
for (let y = 4; y < 11; y += 1) {
  for (let x = 1; x < 29; x += 1) base.set(x, y, y === 4 ? (x < 6 ? C.stone3 : C.stone2) : ramp(x - 1, 28))
}
for (let x = 1; x < 29; x += 1) base.set(x, 7, C.ink)
base.outline()

// ---------- Cornice strip (tileable 16×8) ----------
const cornice = new Sprite(16, 8)
for (let x = 0; x < 16; x += 1) {
  cornice.set(x, 0, C.ink)
  cornice.set(x, 1, C.stone3)
  cornice.set(x, 2, C.stone2)
  cornice.set(x, 3, C.stone1)
  cornice.set(x, 4, C.ink)
  const dentil = x % 8 >= 1 && x % 8 <= 4
  for (let y = 5; y < 8; y += 1) cornice.set(x, y, dentil ? (y === 7 ? C.ink : x % 8 === 1 ? C.stone2 : C.stone1) : null)
}

// ---------- Blood drips ----------
function drip(length) {
  const s = new Sprite(5, length + 1)
  for (let y = 0; y < length - 3; y += 1) {
    s.set(2, y, C.blood1)
    if (y < 2) {
      s.set(1, y, C.blood0)
      s.set(3, y, C.blood0)
    }
  }
  s.rect(1, length - 3, 3, 3, C.blood1)
  s.set(2, length - 2, C.blood2)
  s.set(1, length - 3, C.rose)
  return s.outline()
}
const dripA = drip(9)
const dripB = drip(13)
const dripC = drip(6)

// ---------- Rose window (96×96) ----------
const rose = new Sprite(96, 96)
{
  const random = seeded(5)
  const c = 47.5
  const outerSpokes = 16
  const innerSpokes = 8
  for (let y = 0; y < 96; y += 1) {
    for (let x = 0; x < 96; x += 1) {
      const dx = x - c
      const dy = y - c
      const r = Math.hypot(dx, dy)
      if (r > 47.6) continue
      const light = -(dx + dy) / (Math.max(r, 1) * Math.SQRT2) // 1 at top-left
      const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)
      let color

      if (r > 46.5) color = C.ink
      else if (r > 43) color = light > 0.45 ? C.stone3 : light > -0.1 ? C.stone2 : light > -0.6 ? C.stone1 : C.stone0
      else if (r > 41.8) color = C.ink
      else if (r <= 4.5) color = r <= 2 ? C.cream : C.gold1
      else if (r <= 6) color = C.gold0
      else if (r <= 7.4) color = C.ink
      else {
        const inner = r < 20
        const spokes = inner ? innerSpokes : outerSpokes
        const sector = (Math.PI * 2) / spokes
        const local = angle % sector
        const toSpoke = Math.min(local, sector - local) * r
        const segment = Math.floor(angle / sector)
        if (r >= 19 && r <= 22) {
          color = r < 19.9 || r > 21.1 ? C.ink : C.stone1
        } else if (toSpoke < 0.9) {
          color = C.stone1
        } else if (toSpoke < 1.8) {
          color = C.ink
        } else {
          // Glass, with a foil (small round pane) in each outer segment.
          const mid = (segment + 0.5) * sector
          const fx = c + Math.cos(mid) * 32 - x
          const fy = c + Math.sin(mid) * 32 - y
          const foil = Math.hypot(fx, fy)
          const bright = light * 0.5 + 0.5 + (random() - 0.5) * 0.15
          const dither = (x + y) % 2 === 0
          if (!inner && Math.abs(foil - 6.5) < 0.75) color = C.ink
          else if (inner) {
            color = segment % 2 ? (bright > 0.55 && dither ? C.gold1 : C.gold0) : bright > 0.6 && dither ? C.blood2 : C.blood1
          } else if (foil < 6.5) {
            color = bright > 0.7 ? C.blood3 : bright > 0.45 || dither ? C.blood2 : C.blood1
          } else if (segment % 2) {
            color = bright > 0.65 && dither ? C.stone3 : bright > 0.35 ? C.stone2 : C.stone1
          } else {
            color = bright > 0.6 && dither ? C.blood2 : bright > 0.3 ? C.blood1 : C.blood0
          }
          if (random() < 0.008) color = C.white
        }
      }
      rose.set(x, y, color)
    }
  }
}

// ---------- Lancet window (40×72): equilateral pointed arch ----------
const lancet = new Sprite(40, 72)
{
  const spring = 35
  const inArch = (x, y, inset) => {
    const w = 40 - inset * 2
    const left = inset - 0.5
    const right = 40 - inset - 0.5
    if (x < inset || x > 39 - inset) return false
    if (y >= spring) return true
    return Math.hypot(x - right, y - spring) <= w && Math.hypot(x - left, y - spring) <= w && y >= inset * 0.6
  }
  for (let y = 0; y < 72; y += 1) {
    for (let x = 0; x < 40; x += 1) {
      if (!inArch(x, y, 0)) continue
      let color
      if (y >= 65) {
        color = y === 65 ? C.stone3 : y === 66 ? C.stone2 : C.stone1
        if (y === 68) color = C.ink
      } else if (!inArch(x, y, 5)) {
        color = inArch(x, y, 4) ? C.ink : x < 12 ? C.stone2 : x > 28 ? C.stone0 : C.stone1
        if (y < spring && x >= 12 && x <= 28) color = inArch(x, y, 4) ? C.ink : C.stone2
      } else if (x === 19 || x === 20) {
        color = y > 26 ? C.stone1 : null
        if (y <= 26) color = undefined
      }
      if (color === undefined || (color === null && inArch(x, y, 5))) {
        // Leaded diamond lattice of stained glass, plus a trefoil in the head.
        const trefoil = Math.hypot(x - 19.5, y - 17)
        const lead = (x + y) % 6 === 0 || (x - y + 60) % 6 === 0
        const light = 1 - y / 72
        if (Math.abs(trefoil - 5) < 0.8) color = C.ink
        else if (trefoil < 5) color = trefoil < 2 ? C.gold1 : C.blood2
        else if (lead) color = C.ink
        else {
          const pane = Math.floor((x + y) / 6) + Math.floor((x - y + 60) / 6)
          const dither = (x + y) % 2 === 0
          color = pane % 3 === 0 ? (light > 0.5 && dither ? C.blood2 : C.blood1) : light > 0.55 && dither ? C.stone2 : C.stone1
        }
      }
      if (color === null) continue
      if (x === 18 || x === 21) {
        if (y > 26 && y < 65 && inArch(x, y, 5)) color = C.ink
      }
      lancet.set(x, y, color)
    }
  }
  lancet.outline()
}

// ---------- Arch ribs spanning two pillars ----------
/** `shades` runs from the lit face to the shadowed one. */
function arch(span, rise, thickness = 7, shades = [C.stone3, C.stone2, C.stone1, C.stone0]) {
  const [light, upper, middle, lower] = shades
  const h = rise + 2
  const s = new Sprite(span, h)
  const spring = h - 1
  const c = (span * span) / 4 / span + (rise * rise) / span // centre offset from the far spring point
  const half = span / 2
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < span; x += 1) {
      const leftHalf = x < half
      const cx = leftHalf ? c - 0.5 : span - c - 0.5
      const d = Math.hypot(x - cx, y - spring)
      const outer = c
      if (d > outer || d < outer - thickness) continue
      const depth = outer - d
      let color = depth < 1 ? C.ink : depth > thickness - 1 ? C.ink : depth < 2.6 ? upper : depth < 4.5 ? middle : lower
      // Voussoir joints along the curve.
      const angle = Math.atan2(spring - y, leftHalf ? x - cx : cx - x)
      const joint = Math.abs(((angle * outer) % 11) - 5.5) < 0.6
      if (joint && depth > 1 && depth < thickness - 1) color = C.ink
      s.set(x, y, color)
    }
  }
  // Keystone at the apex.
  const top = Math.max(0, Math.floor(h - 1 - rise))
  for (let y = top; y < top + thickness + 3; y += 1) {
    for (let x = Math.floor(half) - 4; x < Math.floor(half) + 4; x += 1) {
      const edge = y === top || y === top + thickness + 2 || x === Math.floor(half) - 4 || x === Math.floor(half) + 3
      s.set(x, y, edge ? C.ink : x < half - 1 ? light : upper)
    }
  }
  return s
}
const archSide = arch(194, 124)
const archMiddle = arch(228, 140)

// ---------- Portal gates (24×40, 4 animation frames, blood and moonlight variants) ----------
function portal(frame, colors) {
  const s = new Sprite(24, 40)
  const cx = 11.5
  const cy = 19.5
  const phase = (frame / 4) * Math.PI * 2
  for (let y = 0; y < 40; y += 1) {
    for (let x = 0; x < 24; x += 1) {
      const nx = (x - cx) / 11
      const ny = (y - cy) / 19
      const rho = Math.hypot(nx, ny)
      if (rho > 1) continue
      let color
      if (rho > 0.8) {
        // Stone frame, lit from the top-left, with gold studs that blink in turn.
        const light = -(nx + ny) / Math.max(rho, 0.01)
        color = light > 0.7 ? C.stone3 : light > 0 ? C.stone2 : light > -0.7 ? C.stone1 : C.stone0
        const stud = [
          [11, 1],
          [22, 19],
          [11, 38],
          [1, 19],
        ].findIndex(([sx, sy]) => Math.abs(x - sx) + Math.abs(y - sy) <= 0)
        if (stud >= 0) color = stud === frame ? C.cream : C.gold0
      } else if (rho > 0.72) {
        color = C.ink
      } else {
        // Swirling vortex: three arms that twist toward the centre.
        const angle = Math.atan2(ny, nx)
        const arm = Math.cos(3 * (angle + rho * 5 - phase))
        if (rho < 0.16) color = colors[4]
        else if (arm > 0.82) color = colors[3]
        else if (arm > 0.45) color = colors[2]
        else if (arm > -0.2) color = colors[1]
        else color = colors[0]
        if ((x + y + frame) % 7 === 0 && arm > 0.5) color = colors[4]
      }
      s.set(x, y, color)
    }
  }
  return s.outline()
}
const bloodPortal = [C.ink, C.blood0, C.blood1, C.blood3, C.rose]
const moonPortal = [C.ink, C.stone0, C.stone1, C.stone3, C.white]
const portalFrames = Object.fromEntries([
  ...[0, 1, 2, 3].map((frame) => [`portalRed${frame}`, [portal(frame, bloodPortal), frame * 24, 386]]),
  ...[0, 1, 2, 3].map((frame) => [`portalBlue${frame}`, [portal(frame, moonPortal), 96 + frame * 24, 386]]),
])

// ---------- Pack and write ----------
const pieces = {
  wallA: [wallA, 0, 0],
  wallB: [wallB, 32, 0],
  wallC: [wallC, 64, 0],
  cornice: [cornice, 96, 0],
  dripA: [dripA, 112, 0],
  dripB: [dripB, 118, 0],
  dripC: [dripC, 124, 0],
  shaft: [shaft, 0, 16],
  capital: [capital, 22, 16],
  base: [base, 54, 16],
  lancet: [lancet, 86, 16],
  rose: [rose, 128, 16],
  archSide: [archSide, 0, 114],
  archMiddle: [archMiddle, 0, 242],
  ...portalFrames,
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

/** Pack sprites at their offsets into one PNG and return their rectangles. */
function writeSheet(file, entries, width, height) {
  const rgba = Buffer.alloc(width * height * 4)
  const rects = {}
  for (const [name, [sprite, ox, oy]] of Object.entries(entries)) {
    rects[name] = [ox, oy, sprite.w, sprite.h]
    for (let y = 0; y < sprite.h; y += 1) {
      for (let x = 0; x < sprite.w; x += 1) {
        const color = sprite.get(x, y)
        if (!color) continue
        const offset = ((oy + y) * width + ox + x) * 4
        rgba[offset] = parseInt(color.slice(1, 3), 16)
        rgba[offset + 1] = parseInt(color.slice(3, 5), 16)
        rgba[offset + 2] = parseInt(color.slice(5, 7), 16)
        rgba[offset + 3] = 255
      }
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(new URL(`../${file}`, import.meta.url), png)
  return rects
}

console.log(JSON.stringify(writeSheet('src/assets/cathedral-sprites.png', pieces, 256, 428)))

// ---------- The crypt: a second arena beneath the cathedral ----------
// Same palette and outline rules, but cold teal stone, bone and iron instead of stained glass.

// Long crypt blocks (32×16 tile, 32×8 blocks), teal-grey with moss.
function cryptWall(seed, extra) {
  const s = new Sprite(32, 16)
  const random = seeded(seed)
  for (let y = 0; y < 16; y += 1) {
    const row = y < 8 ? 0 : 1
    for (let x = 0; x < 32; x += 1) {
      const bx = (x + (row ? 16 : 0)) % 32
      const ly = y % 8
      let color = C.stone0
      if (ly === 7 || bx === 31) color = C.ink
      else if (ly === 0) color = C.moss0
      else if (random() < 0.06) color = C.moss0
      else if (random() < 0.04) color = C.ink
      if (ly === 6 && random() < 0.3) color = C.moss1
      s.set(x, y, color)
    }
  }
  extra?.(s, random)
  return s
}
const cryptWallA = cryptWall(41)
const cryptWallB = cryptWall(53, (s) => {
  for (const [x, y] of [[20, 1], [21, 2], [21, 3], [22, 4], [22, 5], [23, 6], [24, 8], [24, 9], [25, 10]]) s.set(x, y, C.ink)
})

// An ossuary niche packed with skulls (32×16, tileable sideways).
const ossuary = new Sprite(32, 16)
{
  ossuary.rect(0, 0, 32, 16, C.ink)
  for (let x = 0; x < 32; x += 1) {
    ossuary.set(x, 0, C.stone1)
    ossuary.set(x, 15, C.stone0)
  }
  const skull = ['.###.', '#####', '#.#.#', '.###.', '.#.#.']
  for (const [ox, oy] of [[1, 2], [8, 2], [15, 2], [22, 2], [29, 2], [4, 8], [11, 8], [18, 8], [25, 8]]) {
    skull.forEach((row, y) =>
      [...row].forEach((bit, x) => {
        if (bit === '#') ossuary.set((ox + x) % 32, oy + y, y < 2 ? C.cream : C.stone4)
      }),
    )
  }
}

// Crypt slabs for ledges and the floor (30×17, the same size as the cathedral bricks).
function cryptBlock(inlay) {
  const s = new Sprite(30, 17)
  for (let y = 0; y < 17; y += 1) {
    for (let x = 0; x < 30; x += 1) {
      let color = C.stone1
      if (y === 0) color = C.stone3
      else if (y === 1) color = C.stone2
      else if (y >= 15) color = C.stone0
      else if (x === 0 || x === 29) color = C.ink
      else if (x === 1) color = C.stone2
      if (y === 16) color = C.ink
      s.set(x, y, color)
    }
  }
  // Chisel marks, and a carved skull or cross in the middle.
  for (const [x, y] of [[5, 5], [6, 6], [22, 11], [23, 10]]) s.set(x, y, C.stone0)
  if (inlay === 'skull') {
    ;['.###.', '#####', '#.#.#', '.###.'].forEach((row, y) =>
      [...row].forEach((bit, x) => bit === '#' && s.set(13 + x, 6 + y, C.stone4)),
    )
  } else if (inlay === 'cross') {
    s.rect(14, 5, 2, 8, C.stone0)
    s.rect(11, 7, 8, 2, C.stone0)
  }
  return s
}
const cryptBlockA = cryptBlock('cross')
const cryptBlockB = cryptBlock('plain')
const cryptBlockC = cryptBlock('skull')

// The sarcophagus that forms the crypt's centre ledge (150×70): a carved stone box with
// an effigy lying on the lid.
const sarcophagus = new Sprite(150, 70)
{
  const s = sarcophagus
  // Lid.
  for (let y = 0; y < 12; y += 1) for (let x = 2; x < 148; x += 1) s.set(x, y, y === 0 ? C.stone4 : y < 3 ? C.stone3 : y < 10 ? C.stone2 : C.stone1)
  // Effigy: a robed figure with folded hands, head to the left.
  s.rect(14, 0, 10, 4, C.cream)
  s.rect(15, -1 + 1, 8, 1, C.gold1)
  s.rect(24, 1, 100, 3, C.stone4)
  s.rect(60, 0, 8, 2, C.cream)
  for (let x = 26; x < 122; x += 6) s.set(x, 2, C.stone3)
  // Box.
  for (let y = 12; y < 62; y += 1) {
    for (let x = 6; x < 144; x += 1) {
      const t = (x - 6) / 138
      s.set(x, y, t < 0.08 ? C.stone2 : t > 0.92 ? C.stone0 : C.stone1)
    }
  }
  for (let x = 6; x < 144; x += 1) s.set(x, 12, C.ink)
  // Three carved quatrefoil panels.
  for (const cx of [38, 75, 112]) {
    for (let y = 18; y < 56; y += 1) {
      for (let x = cx - 18; x < cx + 18; x += 1) {
        const edge = y === 18 || y === 55 || x === cx - 18 || x === cx + 17
        if (edge) s.set(x, y, C.ink)
      }
    }
    for (let y = 22; y < 52; y += 1) {
      for (let x = cx - 14; x < cx + 14; x += 1) {
        const dx = x - cx + 0.5
        const dy = y - 36.5
        const lobe = [[0, -7], [0, 7], [-7, 0], [7, 0]].some(([lx, ly]) => Math.hypot(dx - lx, dy - ly) < 7.5)
        if (lobe) s.set(x, y, Math.hypot(dx, dy) < 3 ? C.blood1 : dy < 0 ? C.stone0 : C.ink)
      }
    }
  }
  // Plinth.
  for (let y = 62; y < 70; y += 1) for (let x = 0; x < 150; x += 1) s.set(x, y, y === 62 ? C.stone3 : y < 66 ? C.stone2 : C.stone0)
  s.outline()
}

// The Eye of the Logos: a carved stone seal that stands in for the rose window (72×72).
const modelEye = new Sprite(72, 72)
{
  const c = 35.5
  for (let y = 0; y < 72; y += 1) {
    for (let x = 0; x < 72; x += 1) {
      const dx = x - c
      const dy = y - c
      const r = Math.hypot(dx, dy)
      if (r > 35.6) continue
      const light = -(dx + dy) / (Math.max(r, 1) * Math.SQRT2)
      let color = light > 0.4 ? C.stone2 : light > -0.3 ? C.stone1 : C.stone0
      if (r > 34.6 || Math.abs(r - 28) < 0.7 || Math.abs(r - 19) < 0.7) color = C.ink
      // Runes around the ring.
      const angle = Math.atan2(dy, dx)
      if (r > 29 && r < 34 && Math.abs(Math.sin(angle * 12)) > 0.94) color = C.moss1
      // The eye: almond lids, a teal iris and a dark pupil.
      const lid = Math.abs(dy) < 9 * Math.cos(Math.min(Math.PI / 2, (Math.abs(dx) / 16) * (Math.PI / 2)))
      if (r < 18 && lid) color = C.cream
      if (r < 18 && lid && Math.abs(Math.abs(dy) - 9 * Math.cos((Math.abs(dx) / 16) * (Math.PI / 2))) < 1) color = C.ink
      if (Math.hypot(dx, dy) < 6.5) color = Math.hypot(dx + 1.5, dy + 1.5) < 2 ? C.white : C.moss2
      if (Math.hypot(dx, dy) < 2.6) color = C.ink
      modelEye.set(x, y, color)
    }
  }
}

// A brazier (16×18): iron bowl of coals on a tripod; the game adds the flames.
const brazier = new Sprite(16, 18)
{
  const s = brazier
  for (let x = 1; x < 15; x += 1) {
    s.set(x, 6, C.stone2)
    s.set(x, 7, C.stone1)
  }
  for (let y = 8; y < 11; y += 1) for (let x = 2 + (y - 8); x < 14 - (y - 8); x += 1) s.set(x, y, C.stone0)
  for (let x = 2; x < 14; x += 1) s.set(x, 5, x % 3 ? C.blood2 : C.gold1)
  for (let x = 4; x < 12; x += 2) s.set(x, 4, C.blood3)
  line(s, 7, 11, 7, 17, C.stone1)
  line(s, 5, 11, 2, 17, C.stone1)
  line(s, 10, 11, 13, 17, C.stone1)
  s.outline()
}

// Chain links (4×8, tileable downwards) and a pile of bones (40×12).
const chain = new Sprite(4, 8)
;['.##.', '#..#', '#..#', '.##.', '..#.', '..#.', '.#..', '.#..'].forEach((row, y) =>
  [...row].forEach((bit, x) => bit === '#' && chain.set(x, y, y < 4 ? C.stone3 : C.stone2)),
)
const bones = new Sprite(40, 12)
{
  const s = bones
  for (const [x0, y0, x1, y1] of [[2, 10, 16, 6], [10, 11, 30, 9], [20, 8, 36, 11], [6, 7, 12, 11]]) line(s, x0, y0, x1, y1, C.stone4)
  ;['.###.', '#####', '#.#.#', '.###.'].forEach((row, y) =>
    [...row].forEach((bit, x) => {
      if (bit === '#') {
        s.set(15 + x, 2 + y, C.cream)
        s.set(28 + x, 4 + y, C.stone4)
      }
    }),
  )
  s.outline()
}

const cryptSideArch = arch(188, 94, 8)
const cryptMiddleArch = arch(240, 120, 8)

const cryptPieces = {
  wallA: [cryptWallA, 0, 0],
  wallB: [cryptWallB, 32, 0],
  ossuary: [ossuary, 64, 0],
  blockA: [cryptBlockA, 96, 0],
  blockB: [cryptBlockB, 126, 0],
  blockC: [cryptBlockC, 156, 0],
  brazier: [brazier, 186, 0],
  chain: [chain, 202, 0],
  bones: [bones, 206, 0],
  eye: [modelEye, 0, 18],
  sarcophagus: [sarcophagus, 72, 18],
  sideArch: [cryptSideArch, 0, 92],
  middleArch: [cryptMiddleArch, 0, 190],
}
console.log(JSON.stringify(writeSheet('src/assets/crypt-sprites.png', cryptPieces, 256, 314)))

// ---------- The server vault: the Logos's body, beneath the crypt ----------
// Steel panels, server racks, cables and cooling fans. The game draws the racks' status
// lights on top, blinking, at the sockets listed in RACK.

// Riveted steel wall panels (32×16: two 16×16 panels), one variant with vent slits.
function vaultWall(vents) {
  const s = new Sprite(32, 16)
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const px = x % 16
      let color = C.stone0
      if (y === 0 || px === 0) color = C.stone1
      if (y === 15 || px === 15) color = C.ink
      s.set(x, y, color)
    }
  }
  for (const ox of [0, 16]) for (const [x, y] of [[2, 2], [12, 2], [2, 12], [12, 12]]) s.set(ox + x, y, C.stone2)
  if (vents) for (const y of [5, 7, 9, 11]) for (let x = 19; x < 29; x += 1) s.set(x, y, C.ink)
  return s
}
const vaultWallA = vaultWall(false)
const vaultWallB = vaultWall(true)

// A server rack (40×100): twelve 1U units, each with drive slots and two status-light
// sockets. Keep RACK in step with render.ts, which lights the sockets.
const RACK = { slotTop: 8, slotH: 7, slots: 12, leds: [30, 33] }
const rack = new Sprite(40, 100)
{
  const s = rack
  s.rect(0, 0, 40, 100, C.ink)
  s.rect(1, 1, 38, 98, C.stone0)
  s.rect(1, 1, 38, 4, C.stone1)
  s.rect(1, 1, 38, 1, C.stone2)
  for (let unit = 0; unit < RACK.slots; unit += 1) {
    const y = RACK.slotTop + unit * RACK.slotH
    s.rect(3, y, 34, RACK.slotH - 1, C.stone1)
    s.rect(3, y, 34, 1, C.stone2)
    s.set(3, y + RACK.slotH - 2, C.stone0)
    if (unit % 4 === 3) {
      // A wide unit with a vented face.
      for (let x = 6; x < 27; x += 2) s.set(x, y + 3, C.ink)
    } else {
      for (let x = 6; x < 26; x += 5) s.rect(x, y + 2, 4, 2, C.stone0)
    }
    for (const lx of RACK.leds) s.set(lx, y + 2, C.moss0)
  }
  s.rect(1, 93, 38, 6, C.stone1)
  s.rect(1, 93, 38, 1, C.stone2)
  s.rect(4, 96, 4, 3, C.ink)
  s.rect(32, 96, 4, 3, C.ink)
}

// Catwalk grating for ledges (30×17, the size of the cathedral bricks): a rail on top,
// see-through lattice, and a truss under it. One variant has hazard stripes.
function grate(hazard) {
  const s = new Sprite(30, 17)
  for (let y = 0; y < 17; y += 1) {
    for (let x = 0; x < 30; x += 1) {
      let color = null
      if (y === 0) color = hazard && (x >> 2) % 2 ? C.ink : hazard ? C.gold1 : C.stone3
      else if (y === 1) color = hazard && (x >> 2) % 2 ? C.ink : hazard ? C.gold0 : C.stone2
      else if (y === 2) color = C.stone1
      else if (y <= 11) color = (x + y) % 4 === 0 || (x - y + 40) % 4 === 0 ? C.stone1 : null
      else if (y === 12) color = C.stone2
      else if (y <= 14) color = C.stone1
      else if (y === 15) color = C.stone0
      else color = C.ink
      if ((x === 0 || x === 29) && y > 1) color = C.ink
      if (color) s.set(x, y, color)
    }
  }
  return s
}
const grateA = grate(false)
const grateB = grate(true)

// Diamond-tread steel floor plate (30×17).
const floorPlate = new Sprite(30, 17)
{
  const s = floorPlate
  for (let y = 0; y < 17; y += 1) {
    for (let x = 0; x < 30; x += 1) {
      let color = C.stone1
      if (y === 0) color = C.stone3
      else if (y === 1) color = C.stone2
      else if (y >= 15) color = C.stone0
      if (x === 0 || x === 29 || y === 16) color = C.ink
      s.set(x, y, color)
    }
  }
  for (let y = 4; y < 14; y += 3) {
    for (let x = 3 + ((y / 3) % 2) * 3; x < 27; x += 6) {
      s.set(x, y, C.stone2)
      s.set(x + 1, y - 1, C.stone3)
      s.set(x + 1, y, C.stone0)
    }
  }
}

// The screen the Logos watches through (88×64): its eye drawn in glowing scanlines.
const watchScreen = new Sprite(88, 64)
{
  const s = watchScreen
  s.rect(0, 0, 88, 54, C.ink)
  s.rect(1, 1, 86, 52, C.stone1)
  s.rect(1, 1, 86, 1, C.stone2)
  s.rect(1, 1, 1, 52, C.stone2)
  s.rect(5, 5, 78, 44, C.ink)
  for (let y = 6; y < 48; y += 2) for (let x = 6; x < 82; x += 1) s.set(x, y, C.stone0)
  const cx = 43.5
  const cy = 26.5
  for (let y = 6; y < 48; y += 1) {
    for (let x = 6; x < 82; x += 1) {
      const dx = x - cx
      const dy = y - cy
      const lidH = 13 * Math.cos(Math.min(Math.PI / 2, (Math.abs(dx) / 30) * (Math.PI / 2)))
      let color = null
      if (Math.abs(dx) < 30 && Math.abs(Math.abs(dy) - lidH) < 0.9) color = C.moss2
      const r = Math.hypot(dx, dy)
      if (r < 10.5 && Math.abs(dy) < lidH) color = r > 9.3 ? C.moss2 : r > 4 ? C.moss1 : C.ink
      if (Math.hypot(dx + 2, dy + 2) < 1.6) color = C.white
      // Scanlines dim every third row of the picture.
      if (color && y % 3 === 0) color = color === C.moss2 ? C.moss1 : color === C.moss1 ? C.moss0 : color
      if (color) s.set(x, y, color)
    }
  }
  s.rect(38, 54, 12, 6, C.stone1)
  s.rect(38, 54, 2, 6, C.stone2)
  s.rect(26, 60, 36, 4, C.stone2)
  s.rect(26, 60, 36, 1, C.stone3)
  s.outline()
}

// A cooling fan in a round housing (24×24).
const fan = new Sprite(24, 24)
{
  const c = 11.5
  for (let y = 0; y < 24; y += 1) {
    for (let x = 0; x < 24; x += 1) {
      const dx = x - c
      const dy = y - c
      const r = Math.hypot(dx, dy)
      if (r > 11.8) continue
      let color = r > 10.8 ? C.ink : r > 9 ? C.stone2 : C.ink
      if (r <= 9 && Math.sin(Math.atan2(dy, dx) * 3 + r * 0.35) > 0.25) color = r < 6 ? C.stone2 : C.stone1
      if (r < 2.6) color = C.stone3
      if (r > 9 && r <= 10.8 && dx + dy > 4) color = C.stone1
      fan.set(x, y, color)
    }
  }
}

// A caged lamp (10×16) on a short cord; the game adds the glow.
const lamp = new Sprite(10, 16)
{
  const s = lamp
  s.rect(4, 0, 2, 5, C.stone0)
  s.rect(1, 5, 8, 2, C.stone2)
  s.rect(3, 8, 4, 6, C.cream)
  s.rect(4, 9, 2, 3, C.white)
  for (const x of [1, 8]) s.rect(x, 7, 1, 8, C.stone2)
  s.rect(1, 14, 8, 1, C.stone1)
  s.outline()
}

// Pipes: a vertical run (12×16, tiles downwards) and a horizontal one (16×12).
const pipeShades = [C.ink, C.stone3, C.stone2, C.stone2, C.stone1, C.stone1, C.stone1, C.stone1, C.stone0, C.stone0, C.stone0, C.ink]
const pipeV = new Sprite(12, 16)
const pipeH = new Sprite(16, 12)
for (let a = 0; a < 16; a += 1) {
  for (let b = 0; b < 12; b += 1) {
    const flange = a < 2 && b > 0 && b < 11
    const color = flange ? (a === 0 ? C.stone3 : C.stone0) : pipeShades[b]
    pipeV.set(b, a, color)
    pipeH.set(a, b, color)
  }
}

// Cables sagging between two hangers (160×40): three strands, one red, one teal.
const cables = new Sprite(160, 40)
for (const [strand, [sag, base, highlight]] of [
  [30, 1, C.stone1],
  [24, 4, C.blood0],
  [18, 7, C.moss0],
].entries()) {
  let previous = null
  for (let x = 0; x < 160; x += 1) {
    const t = (x - 79.5) / 79.5
    const y = Math.round(base + sag * (1 - t * t))
    const from = previous ?? y
    for (let yy = Math.min(from, y); yy <= Math.max(from, y); yy += 1) {
      cables.set(x, yy, highlight)
      cables.set(x, yy + 1, C.ink)
    }
    previous = y
  }
  void strand
}

const vaultPieces = {
  wallA: [vaultWallA, 0, 0],
  wallB: [vaultWallB, 32, 0],
  grateA: [grateA, 64, 0],
  grateB: [grateB, 94, 0],
  plate: [floorPlate, 124, 0],
  lamp: [lamp, 154, 0],
  fan: [fan, 166, 0],
  pipeV: [pipeV, 192, 0],
  pipeH: [pipeH, 206, 0],
  rack: [rack, 0, 26],
  screen: [watchScreen, 42, 26],
  cables: [cables, 42, 92],
}
console.log(JSON.stringify(writeSheet('src/assets/vault-sprites.png', vaultPieces, 256, 132)))

// ---------- The tomb of the Logos: the deepest vault ----------
// Dark plum stone with gold seams, black marble steps, blood banners, the dead monolith
// of the Logos's first version, and the gold Eye above it all.

function tombWall(seed, rune) {
  const s = new Sprite(32, 16)
  const random = seeded(seed)
  for (let y = 0; y < 16; y += 1) {
    const row = y < 8 ? 0 : 1
    for (let x = 0; x < 32; x += 1) {
      const bx = (x + (row ? 8 : 0)) % 16
      const ly = y % 8
      let color = C.wood0
      if (ly === 7 || bx === 15) color = C.ink
      else if (ly === 0) color = C.wood1
      else if (random() < 0.05) color = C.ink
      s.set(x, y, color)
    }
  }
  // A thin gold seam along one joint.
  for (let x = 2; x < 14; x += 1) s.set(x, 7, C.gold0)
  if (rune) {
    ;['.###.', '#.#.#', '.###.'].forEach((line, y) =>
      [...line].forEach((bit, x) => bit === '#' && s.set(21 + x, 10 + y, C.gold1)),
    )
  }
  return s
}
const tombWallA = tombWall(61, false)
const tombWallB = tombWall(67, true)

// Black marble steps with a gold lip (30×17).
function tombStep(inlay) {
  const s = new Sprite(30, 17)
  for (let y = 0; y < 17; y += 1) {
    for (let x = 0; x < 30; x += 1) {
      let color = C.stone0
      if (y === 0) color = C.gold1
      else if (y === 1) color = C.gold0
      else if (y === 2) color = C.stone1
      else if (y >= 15) color = C.ink
      if ((x === 0 || x === 29) && y > 1) color = C.ink
      if (x === 1 && y > 2 && y < 15) color = C.stone1
      s.set(x, y, color)
    }
  }
  if (inlay === 'eye') {
    ;['..###..', '.#...#.', '#..#..#', '.#...#.', '..###..'].forEach((line, y) =>
      [...line].forEach((bit, x) => bit === '#' && s.set(11 + x, 6 + y, C.gold0)),
    )
  } else if (inlay === 'band') {
    for (let x = 3; x < 27; x += 1) s.set(x, 9, C.gold0)
  }
  // Veins in the marble.
  for (const [x, y] of [[5, 5], [6, 6], [7, 6], [22, 12], [23, 11]]) s.set(x, y, C.stone1)
  return s
}
const tombStepA = tombStep('plain')
const tombStepB = tombStep('eye')
const tombStepC = tombStep('band')

// A blood banner (20×64) with the gold eye, hanging from a rod, swallow-tailed.
const banner = new Sprite(20, 64)
{
  const s = banner
  s.rect(0, 0, 20, 2, C.stone2)
  for (let y = 2; y < 64; y += 1) {
    for (let x = 2; x < 18; x += 1) {
      if (y > 54 && Math.abs(x - 9.5) < (y - 54) * 0.9) continue
      let color = x === 2 || x === 17 ? C.gold0 : x < 5 ? C.blood2 : x > 14 ? C.blood0 : C.blood1
      if (y === 5) color = C.gold0
      s.set(x, y, color)
    }
  }
  ;['..####..', '.#....#.', '#..##..#', '.#....#.', '..####..'].forEach((line, y) =>
    [...line].forEach((bit, x) => bit === '#' && s.set(6 + x, 18 + y, C.gold1)),
  )
  s.outline()
}

// The Eye of the Logos in gold (96×96): a sunburst around an almond eye with a red iris.
const goldEye = new Sprite(96, 96)
{
  const c = 47.5
  for (let y = 0; y < 96; y += 1) {
    for (let x = 0; x < 96; x += 1) {
      const dx = x - c
      const dy = y - c
      const r = Math.hypot(dx, dy)
      const angle = Math.atan2(dy, dx)
      let color = null
      // Sixteen thin rays, widest near the ring.
      const ray = Math.sin(angle * 8)
      if (r > 30 && r < 47 && Math.abs(ray) > 0.9 - (47 - r) * 0.004) color = r < 38 ? C.gold1 : C.gold0
      if (r <= 30) color = r > 28.6 ? C.ink : r > 26.5 ? C.gold0 : C.wood0
      const lidH = 12 * Math.cos(Math.min(Math.PI / 2, (Math.abs(dx) / 24) * (Math.PI / 2)))
      if (r < 26 && Math.abs(dy) < lidH) color = C.cream
      if (r < 26 && Math.abs(dx) < 24 && Math.abs(Math.abs(dy) - lidH) < 1) color = C.ink
      if (r < 9 && Math.abs(dy) < lidH) color = r > 7.8 ? C.ink : r > 3.4 ? C.blood3 : C.ink
      if (Math.hypot(dx + 2.5, dy + 2.5) < 1.5) color = C.white
      if (color) goldEye.set(x, y, color)
    }
  }
  goldEye.outline()
}

// The first version of the Logos (64×150): a tall dead terminal with a cracked screen,
// a gold capstone, and lines of its last output carved underneath.
const monolith = new Sprite(64, 150)
{
  const s = monolith
  for (let y = 0; y < 150; y += 1) {
    const taper = y < 14 ? 14 - y : 0
    for (let x = 6 + taper; x < 58 - taper; x += 1) {
      const t = (x - 6) / 51
      let color = y < 14 ? (t < 0.4 ? C.gold1 : C.gold0) : t < 0.1 ? C.stone2 : t < 0.55 ? C.stone1 : C.stone0
      s.set(x, y, color)
    }
  }
  // Dead screen.
  s.rect(13, 28, 38, 42, C.ink)
  s.rect(15, 30, 34, 38, C.stone0)
  for (let y = 31; y < 67; y += 2) for (let x = 16; x < 48; x += 1) s.set(x, y, C.ink)
  for (const [x, y] of [[30, 32], [29, 34], [31, 36], [30, 38], [28, 40], [27, 43], [33, 41], [35, 44], [36, 47]]) s.set(x, y, C.stone2)
  // A faint question mark, the last thing it said.
  ;['.###.', '#...#', '...#.', '..#..', '.....', '..#..'].forEach((line, y) =>
    [...line].forEach((bit, x) => bit === '#' && s.set(30 + x, 50 + y, C.moss0)),
  )
  // Carved lines of output.
  for (let y = 80; y < 128; y += 5) {
    const random = seeded(y)
    for (let x = 14; x < 50; x += 1) if (random() < 0.7) s.set(x, y, C.stone0)
  }
  // Plinth.
  for (let y = 134; y < 150; y += 1) for (let x = 0; x < 64; x += 1) s.set(x, y, y === 134 ? C.stone3 : y < 140 ? C.stone2 : C.stone1)
  s.outline()
}

// The altar before it (120×50): a gold-lidded black block, the centre ledge.
const altar = new Sprite(120, 50)
{
  const s = altar
  for (let y = 0; y < 50; y += 1) {
    for (let x = 0; x < 120; x += 1) {
      let color = y === 0 ? C.gold1 : y < 3 ? C.gold0 : y < 6 ? C.stone1 : y >= 44 ? (y === 44 ? C.stone2 : C.stone1) : x < 8 ? C.stone1 : C.stone0
      if (y >= 6 && y < 44 && (x === 4 || x === 115)) color = C.ink
      s.set(x, y, color)
    }
  }
  for (const cx of [30, 60, 90]) {
    for (let y = 12; y < 38; y += 1) for (let x = cx - 10; x < cx + 10; x += 1) {
      if (y === 12 || y === 37 || x === cx - 10 || x === cx + 9) s.set(x, y, C.gold0)
    }
  }
  ;['..###..', '.#...#.', '#..#..#', '.#...#.', '..###..'].forEach((line, y) =>
    [...line].forEach((bit, x) => bit === '#' && s.set(57 + x, 22 + y, C.gold1)),
  )
  s.outline()
}

const tombShades = [C.gold1, C.gold0, C.wood1, C.wood0]
const tombSideArch = arch(188, 94, 8, tombShades)
const tombMiddleArch = arch(240, 120, 8, tombShades)

const tombPieces = {
  wallA: [tombWallA, 0, 0],
  wallB: [tombWallB, 32, 0],
  stepA: [tombStepA, 64, 0],
  stepB: [tombStepB, 94, 0],
  stepC: [tombStepC, 124, 0],
  banner: [banner, 154, 0],
  eye: [goldEye, 176, 0],
  monolith: [monolith, 0, 18],
  altar: [altar, 64, 100],
  sideArch: [tombSideArch, 0, 170],
  middleArch: [tombMiddleArch, 0, 268],
}
console.log(JSON.stringify(writeSheet('src/assets/tomb-sprites.png', tombPieces, 272, 392)))

// ---------- UI frames (one PNG each, for CSS border-image 9-slicing) ----------
// Built from the framed brick block in gothic-sprites.png (x 1, y 102): the same
// 2px wood border, with its gold corner flourish mirrored into all four corners.
const WOOD = { A: C.gold0, B: C.wood1, C: C.wood0, D: C.gold1, E: C.cream }
const brickTop = ['AAABAABBBAAABBBAAAAAAABBBBBAAA', 'ACCCCCCBBBBCCCCBBBCCBCCCCBBCCC']
const brickBottom = ['BBAAABBAAAAAAAABBBBBBABBAAAAAC', 'ABBBBCCCBBCCCCCBBCBBBCCCCBBCCC']
const brickLeft = ['AA', 'AC', 'AC', 'AC', 'AB', 'AC', 'AB', 'BC', 'BB', 'AB', 'AB', 'AB', 'BB', 'BB', 'BB']
const brickRight = ['BC', 'BC', 'AB', 'AB', 'AB', 'AB', 'BB', 'BB', 'BB', 'BB', 'AB', 'AB', 'AB', 'AB', 'AB']
const flourish = ['AAAD', 'ADEE', 'AEED', 'DD..', 'AD..']

function woodFrame(size, fill, colors = WOOD, ornament = flourish) {
  const s = new Sprite(size, size)
  s.rect(2, 2, size - 4, size - 4, fill)
  for (let x = 0; x < size; x += 1) {
    s.set(x, 0, colors[brickTop[0][x % 30]])
    s.set(x, 1, colors[brickTop[1][x % 30]])
    s.set(x, size - 2, colors[brickBottom[0][x % 30]])
    s.set(x, size - 1, colors[brickBottom[1][x % 30]])
  }
  for (let y = 2; y < size - 2; y += 1) {
    const left = brickLeft[y % brickLeft.length]
    const right = brickRight[y % brickRight.length]
    s.set(0, y, colors[left[0]])
    s.set(1, y, colors[left[1]])
    s.set(size - 2, y, colors[right[0]])
    s.set(size - 1, y, colors[right[1]])
  }
  ornament.forEach((row, y) =>
    [...row].forEach((key, x) => {
      if (key === '.') return
      const color = colors[key]
      s.set(2 + x, 2 + y, color)
      s.set(size - 3 - x, 2 + y, color)
      s.set(2 + x, size - 3 - y, color)
      s.set(size - 3 - x, size - 3 - y, color)
    }),
  )
  return s
}

/** Chunky bevelled button in one colour ramp: highlight, body, shadow. */
function button(highlight, body, shadow, pressed = false) {
  const s = new Sprite(16, 16)
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const corner = (x === 0 || x === 15) && (y === 0 || y === 15)
      if (corner) continue
      let color = body
      if (x === 0 || y === 0 || x === 15 || y === 15) color = C.ink
      else if (pressed ? y <= 2 : y === 1 || x === 1) color = pressed ? shadow : highlight
      else if (!pressed && (y >= 13 || x === 14)) color = shadow
      s.set(x, y, color)
    }
  }
  // Gold rivets, like the studs on the portal frames.
  for (const [x, y] of [
    [3, pressed ? 4 : 3],
    [12, pressed ? 4 : 3],
  ]) {
    s.set(x, y, C.gold1)
  }
  return s
}


// Health orb (40×40) in three layers: empty glass, liquid (CSS clips it from the top to
// show how full it is), and the stone ring with a glass glint drawn over both.
const ORB_C = 19.5
const ORB_INNER = 16.6
function orbLayer(paint) {
  const s = new Sprite(40, 40)
  for (let y = 0; y < 40; y += 1) {
    for (let x = 0; x < 40; x += 1) {
      const dx = x - ORB_C
      const dy = y - ORB_C
      const r = Math.hypot(dx, dy)
      const color = paint(x, y, r, dx, dy)
      if (color) s.set(x, y, color)
    }
  }
  return s
}
const orbEmpty = orbLayer((x, y, r) => {
  if (r > ORB_INNER) return null
  return (x + y) % 2 === 0 && y > 24 ? C.stone0 : C.ink
})
const orbFrame = orbLayer((x, y, r, dx, dy) => {
  if (r > 19.6) return null
  if (r > 18.7) return C.ink
  if (r > ORB_INNER + 0.9) {
    const light = -(dx + dy) / (r * Math.SQRT2)
    const angle = Math.atan2(dy, dx)
    const stud = [0, Math.PI / 2, Math.PI, -Math.PI / 2].some((a) => Math.abs(Math.atan2(Math.sin(angle - a), Math.cos(angle - a))) < 0.09)
    if (stud) return C.gold1
    return light > 0.5 ? C.stone3 : light > -0.1 ? C.stone2 : light > -0.6 ? C.stone1 : C.stone0
  }
  if (r > ORB_INNER) return C.ink
  // Glass glint along the upper-left of the bowl.
  const angle = Math.atan2(dy, dx)
  if (r > 12 && r < 14.2 && angle > -2.6 && angle < -1.9) return C.white
  if (r > 12.5 && r < 13.6 && angle > -2.9 && angle < -1.6) return C.stone4
  return null
})

// Gold "free will" liquid for the combo orb: same shading as the blood, gold ramp.
const orbFillGold = orbLayer((x, y, r, dx, dy) => {
  if (r > ORB_INNER) return null
  const light = -(dx + dy) / (ORB_INNER * Math.SQRT2)
  const dither = (x + y) % 2 === 0
  if ((x * 7 + y * 13) % 41 === 0 && r < ORB_INNER - 3) return C.white
  if (light > 0.55) return dither ? C.cream : C.gold1
  if (light > 0.1) return C.gold1
  if (light > -0.45) return dither ? C.gold1 : C.gold0
  if (light > -0.75) return C.gold0
  return dither ? C.gold0 : C.wood1
})

// Health pip: a blood drop (9×12), full and empty.
const dropShape = [
  '....o....',
  '...oho...',
  '...ohm...',
  '..ohmms..',
  '..ohmms..',
  '.ohmmmms.',
  '.ohmmmmso',
  'ohhmmmmso',
  'ohmmmmmso',
  'ohmmmmsso',
  '.osssssd.',
  '..ooooo..',
]
function drop(full) {
  const s = new Sprite(9, 12)
  const colors = full
    ? { o: C.ink, h: C.blood3, m: C.blood2, s: C.blood1, d: C.blood0 }
    : { o: C.ink, h: C.stone1, m: C.stone0, s: C.stone0, d: C.ink }
  dropShape.forEach((row, y) => [...row].forEach((key, x) => key !== '.' && s.set(x, y, colors[key])))
  if (full) s.set(3, 6, C.white)
  return s
}

// ---------- Rite icons (16×16), drawn to match what each rite does on screen ----------
function line(sprite, x0, y0, x1, y1, color, thickness = 1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2
  for (let index = 0; index <= steps; index += 1) {
    const x = Math.round(x0 + ((x1 - x0) * index) / steps)
    const y = Math.round(y0 + ((y1 - y0) * index) / steps)
    for (let t = 0; t < thickness; t += 1) sprite.set(x + t, y, color)
  }
}
const riteIcons = {
  // Latent Step: two silver chevrons pointing forward.
  dash: (() => {
    const s = new Sprite(16, 16)
    for (const x0 of [2, 8]) {
      line(s, x0, 3, x0 + 5, 8, C.stone4, 2)
      line(s, x0, 13, x0 + 5, 8, C.stone4, 2)
      s.set(x0, 3, C.white)
    }
    return s.outline()
  })(),
  // Rate Limit: the red pentagram seal it leaves on the floor.
  seal: (() => {
    const s = new Sprite(16, 16)
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        const r = Math.hypot(x - 7.5, y - 7.5)
        if (r < 5.7) s.set(x, y, C.ink)
        if (Math.abs(r - 6.4) < 0.75) s.set(x, y, y < 8 ? C.blood3 : C.blood2)
      }
    }
    const points = Array.from({ length: 5 }, (_, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 4) / 5
      return [7.5 + Math.cos(angle) * 5.2, 7.5 + Math.sin(angle) * 5.2]
    })
    points.forEach(([x, y], index) => {
      const [nx, ny] = points[(index + 1) % 5]
      line(s, x, y, nx, ny, C.rose)
    })
    return s.outline()
  })(),
  // Prompt Volley: a ring of gold bolts flying out.
  volley: (() => {
    const s = new Sprite(16, 16)
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2
      const x = Math.round(7 + Math.cos(angle) * 5.2)
      const y = Math.round(7 + Math.sin(angle) * 5.2)
      s.rect(x, y, 2, 2, C.gold1)
      s.set(x, y, C.cream)
    }
    s.rect(7, 7, 2, 2, C.cream)
    return s.outline()
  })(),
  // Alignment Mirror: the silver hexagon shield that rings the player.
  mirror: (() => {
    const s = new Sprite(16, 16)
    const R = 6.8
    const inside = (x, y, radius) => {
      const q = Math.abs(x - 7.5)
      const r = Math.abs(y - 7.5)
      return q <= (radius * Math.sqrt(3)) / 2 && r <= radius - q / Math.sqrt(3)
    }
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        if (!inside(x, y, R)) continue
        s.set(x, y, inside(x, y, R - 1.7) ? C.stone1 : x + y < 15 ? C.stone4 : C.stone3)
      }
    }
    line(s, 5, 6, 7, 4, C.white)
    line(s, 5, 8, 9, 4, C.stone4)
    return s.outline()
  })(),
  // CAPTCHA Glyph: a ticked "I'm not a robot" box.
  glyph: (() => {
    const s = new Sprite(16, 16)
    s.rect(2, 3, 11, 11, C.stone3)
    s.rect(3, 4, 9, 9, C.stone4)
    line(s, 4, 8, 6, 11, C.moss2, 2)
    line(s, 6, 11, 12, 2, C.moss2, 2)
    line(s, 7, 11, 13, 2, C.moss1)
    return s.outline()
  })(),
}

const uiPieces = {
  ...Object.fromEntries(Object.entries(riteIcons).map(([key, sprite]) => [`rite-${key}.png`, sprite])),
  'orb-empty.png': orbEmpty,
  'orb-fill-gold.png': orbFillGold,
  'orb-frame.png': orbFrame,
  'pip-full.png': drop(true),
  'pip-empty.png': drop(false),
  'panel.png': woodFrame(26, C.ink),
  'button.png': button(C.blood3, C.blood1, C.blood0),
  'button-hover.png': button(C.rose, C.blood2, C.blood0),
  'button-down.png': button(C.blood3, C.blood1, C.blood0, true),
  'button-stone.png': button(C.stone3, C.stone1, C.stone0),
  'button-stone-hover.png': button(C.stone4, C.stone2, C.stone0),
  'button-stone-down.png': button(C.stone3, C.stone1, C.stone0, true),
}
mkdirSync(new URL('../src/assets/ui/', import.meta.url), { recursive: true })
for (const [file, sprite] of Object.entries(uiPieces)) {
  writeSheet(`src/assets/ui/${file}`, { piece: [sprite, 0, 0] }, sprite.w, sprite.h)
}
console.log(`UI frames: ${Object.keys(uiPieces).join(', ')}`)

// ---------- Favicon: the rose window, sampled down to 32×32 ----------
const favicon = new Sprite(32, 32)
for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) favicon.set(x, y, rose.get(x * 3 + 1, y * 3 + 1))
writeSheet('public/favicon.png', { piece: [favicon, 0, 0] }, 32, 32)

// ---------- Share card (1200×630), drawn at 1/4 size and scaled up ----------
const FONT = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
}
const CARD_W = 300
const CARD_H = 158
const card = new Sprite(CARD_W, CARD_H)
const DIM = { [C.stone0]: C.ink, [C.stone1]: C.stone0, [C.stone2]: C.stone1, [C.moss0]: C.ink, [C.moss1]: C.stone0, [C.moss2]: C.stone0 }
function blit(dst, src, ox, oy, map = {}) {
  for (let y = 0; y < src.h; y += 1) {
    for (let x = 0; x < src.w; x += 1) {
      const color = src.get(x, y)
      if (color) dst.set(ox + x, oy + y, map[color] ?? color)
    }
  }
}
function text(dst, string, ox, oy, scale, color, shadow) {
  let cursor = ox
  for (const char of string) {
    const glyph = FONT[char]
    if (glyph) {
      glyph.forEach((row, y) =>
        [...row].forEach((bit, x) => {
          if (bit !== '#') return
          for (let sy = 0; sy < scale; sy += 1) {
            for (let sx = 0; sx < scale; sx += 1) {
              dst.set(cursor + x * scale + sx + 1, oy + y * scale + sy + 1, shadow)
              dst.set(cursor + x * scale + sx, oy + y * scale + sy, color)
            }
          }
        }),
      )
    }
    cursor += 6 * scale
  }
}
const textWidth = (string, scale) => string.length * 6 * scale - scale
// Dim wall, pillars, the rose window, a ledge for a floor, and a pair of portals.
for (let y = 0; y < CARD_H; y += 16) for (let x = 0; x < CARD_W; x += 32) blit(card, [wallA, wallB, wallC][(x / 32 + y / 16) % 3 === 0 ? 1 : 0], x, y, DIM)
for (const px of [18, CARD_W - 38]) for (let y = 0; y < CARD_H; y += 16) blit(card, shaft, px, y)
blit(card, rose, (CARD_W - 96) / 2, 4)
for (let x = 0; x < CARD_W; x += 16) blit(card, cornice, x, CARD_H - 8)
blit(card, portalFrames.portalRed0[0], 66, 32)
blit(card, portalFrames.portalBlue0[0], CARD_W - 90, 32)
// Title on a dark band so it reads at thumbnail size.
for (let y = 100; y < 136; y += 1) for (let x = 0; x < CARD_W; x += 1) card.set(x, y, C.ink)
for (let x = 0; x < CARD_W; x += 1) {
  card.set(x, 99, C.gold0)
  card.set(x, 136, C.gold0)
}
const top = 'AI'
const bottom = 'CATHEDRAL'
const titleWidth = textWidth(`${top} ${bottom}`, 2)
text(card, top, (CARD_W - titleWidth) / 2, 104, 2, C.cream, C.blood0)
text(card, bottom, (CARD_W - titleWidth) / 2 + textWidth(`${top} `, 2) + 2, 104, 2, C.blood3, C.blood0)
const tagline = 'OUTLAST TWENTY SERMONS'
text(card, tagline, Math.round((CARD_W - textWidth(tagline, 1)) / 2), 124, 1, C.stone4, C.ink)
const og = new Sprite(1200, 630)
for (let y = 0; y < 630; y += 1) for (let x = 0; x < 1200; x += 1) og.set(x, y, card.get(x >> 2, y >> 2))
writeSheet('public/og-image.png', { piece: [og, 0, 0] }, 1200, 630)
console.log('Favicon and share card written to public/')
