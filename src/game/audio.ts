import type { Sfx } from './engine'

// Tiny WebAudio synth: every sound and the music are generated, so there are no audio
// assets to load. Effects and music run on separate buses with their own volumes.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let sfxBus: GainNode | null = null
let musicBus: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let sfxVolume = 0.8
let musicVolume = 0.6
const lastPlayed = new Map<Sfx, number>()

/** Must be called from a user gesture before anything can be heard. */
export function unlockAudio() {
  if (!ctx) {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return
    ctx = new AudioCtor()
    master = ctx.createGain()
    master.gain.value = 0.6
    master.connect(ctx.destination)
    sfxBus = ctx.createGain()
    sfxBus.gain.value = sfxVolume
    sfxBus.connect(master)
    musicBus = ctx.createGain()
    musicBus.gain.value = 0
    musicBus.connect(master)
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
  startMusic()
}

/** Volumes from 0 to 1. Muting sets both to 0. */
export function setVolumes(music: number, effects: number) {
  musicVolume = music
  sfxVolume = effects
  if (!ctx || !sfxBus) return
  sfxBus.gain.setTargetAtTime(effects, ctx.currentTime, 0.02)
  updateMusicLevel()
}

function tone(
  type: OscillatorType,
  from: number,
  to: number,
  duration: number,
  volume: number,
  delay = 0,
) {
  if (!ctx || !sfxBus) return
  const start = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(sfxBus!)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

function noise(duration: number, volume: number, filterFrom: number, filterTo: number, delay = 0) {
  if (!ctx || !sfxBus || !noiseBuffer) return
  const start = ctx.currentTime + delay
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(filterFrom, start)
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, filterTo), start + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(filter).connect(gain).connect(sfxBus)
  source.start(start, Math.random() * 0.5)
  source.stop(start + duration + 0.02)
}

const throttle: Partial<Record<Sfx, number>> = { hit: 0.045, shoot: 0.05, spawn: 0.12, kill: 0.04, land: 0.1, spit: 0.08 }

export function playSfx(name: Sfx) {
  if (!ctx || sfxVolume <= 0) return
  const now = ctx.currentTime
  const gap = throttle[name]
  if (gap && now - (lastPlayed.get(name) ?? -1) < gap) return
  lastPlayed.set(name, now)

  switch (name) {
    case 'shoot':
      tone('square', 880 + Math.random() * 80, 420, 0.07, 0.05)
      break
    case 'hit':
      noise(0.06, 0.22, 3000, 400)
      tone('square', 220, 90, 0.06, 0.06)
      break
    case 'kill':
      noise(0.22, 0.3, 1800, 120)
      tone('sawtooth', 320, 50, 0.22, 0.12)
      break
    case 'hurt':
      tone('sawtooth', 180, 60, 0.3, 0.22)
      noise(0.18, 0.3, 1200, 100)
      break
    case 'jump':
      tone('square', 260, 520, 0.09, 0.06)
      break
    case 'airjump':
      tone('triangle', 520, 1040, 0.12, 0.1)
      break
    case 'land':
      noise(0.06, 0.12, 600, 100)
      break
    case 'dash':
      noise(0.16, 0.25, 5000, 300)
      tone('sine', 900, 300, 0.14, 0.06)
      break
    case 'seal':
      tone('sawtooth', 110, 55, 0.6, 0.18)
      tone('sine', 220, 110, 0.6, 0.12)
      noise(0.4, 0.15, 800, 80)
      break
    case 'volley':
      for (let index = 0; index < 4; index += 1) tone('square', 700 + index * 180, 350, 0.08, 0.06, index * 0.03)
      break
    case 'mirror':
      tone('triangle', 660, 990, 0.35, 0.12)
      tone('triangle', 990, 1320, 0.35, 0.08, 0.06)
      break
    case 'glyph':
      tone('sine', 330, 440, 0.25, 0.1)
      break
    case 'trap':
      tone('sawtooth', 600, 80, 0.35, 0.14)
      noise(0.3, 0.25, 2500, 150)
      break
    case 'ward':
      tone('triangle', 1200, 600, 0.12, 0.08)
      break
    case 'pickup':
      tone('sine', 660, 660, 0.08, 0.12)
      tone('sine', 990, 990, 0.12, 0.12, 0.07)
      break
    case 'spawn':
      tone('sine', 90, 180, 0.25, 0.08)
      break
    case 'wave':
      // Minor organ chord.
      ;[110, 130.8, 164.8, 220].forEach((frequency) => tone('triangle', frequency, frequency, 1.4, 0.07))
      break
    case 'clear':
      ;[220, 277, 330, 440].forEach((frequency, index) => tone('triangle', frequency, frequency, 0.5, 0.08, index * 0.09))
      break
    case 'portal':
      tone('sine', 220, 880, 0.25, 0.12)
      tone('triangle', 880, 220, 0.3, 0.06, 0.08)
      noise(0.25, 0.12, 3000, 400)
      break
    case 'spit':
      noise(0.12, 0.12, 900, 200)
      tone('sine', 180, 90, 0.14, 0.06)
      break
    case 'charge':
      // A rising choir-like swell before a boss slam.
      tone('sawtooth', 70, 140, 0.9, 0.1)
      tone('sine', 220, 440, 0.9, 0.08)
      break
    case 'slam':
      tone('sine', 90, 30, 0.6, 0.35)
      noise(0.5, 0.35, 1200, 60)
      break
    case 'death':
      tone('sawtooth', 220, 30, 1.2, 0.25)
      noise(0.9, 0.3, 1500, 60)
      break
  }
}

// ---------- Music ----------
// A slow gothic organ progression in D minor (i – VI – iv – V), scheduled a little ahead
// of time. Intensity adds layers: 0 silent, 0.25 title (organ and bell), 0.5 normal
// sermons (adds bass and choir), 1 boss sermons (adds arpeggio and drums), 2 the
// final sermon (everything, louder and darker).

const BPM = 72
const BEAT = 60 / BPM
// Chord tones per bar, as MIDI note numbers.
const PROGRESSION = [
  [50, 53, 57, 62], // D minor
  [46, 50, 53, 58], // B♭ major
  [43, 46, 50, 55], // G minor
  [45, 49, 52, 57], // A major
]
const midi = (note: number) => 440 * 2 ** ((note - 69) / 12)

let intensity = 0
let musicTimer = 0
let nextBarTime = 0
let bar = 0

function updateMusicLevel() {
  if (!ctx || !musicBus) return
  const level = intensity > 0 ? musicVolume * (intensity >= 2 ? 0.75 : 0.55) : 0
  musicBus.gain.setTargetAtTime(level, ctx.currentTime, 0.6)
}

export function setMusicIntensity(value: number) {
  intensity = value
  updateMusicLevel()
}

function voice(type: OscillatorType, frequency: number, start: number, length: number, volume: number, attack = 0.04, cutoff = 2400) {
  if (!ctx || !musicBus) return
  const osc = ctx.createOscillator()
  const filter = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = frequency
  filter.type = 'lowpass'
  filter.frequency.value = cutoff
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.linearRampToValueAtTime(volume, start + attack)
  gain.gain.setValueAtTime(volume, start + Math.max(attack, length - 0.25))
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  osc.connect(filter).connect(gain).connect(musicBus)
  osc.start(start)
  osc.stop(start + length + 0.05)
  return osc
}

function scheduleBar(start: number) {
  if (!ctx || !musicBus || intensity <= 0) return
  const chord = PROGRESSION[bar % PROGRESSION.length]
  const length = BEAT * 4
  const dark = intensity >= 2

  // Organ pad: every chord tone, a square through a soft filter plus a fifth above.
  for (const note of chord) {
    voice('square', midi(note), start, length + 0.2, 0.018, 0.35, dark ? 1200 : 1700)
    voice('triangle', midi(note + 12), start, length + 0.2, 0.012, 0.5)
  }
  // Tolling bell on the first bar of each phrase.
  if (bar % 4 === 0) voice('triangle', midi(chord[3] + 24), start, 2.4, 0.03, 0.005)

  if (intensity >= 0.5) {
    // Bass on beats one and three.
    voice('triangle', midi(chord[0] - 12), start, BEAT * 1.8, 0.07, 0.02, 600)
    voice('triangle', midi(chord[0] - 12), start + BEAT * 2, BEAT * 1.8, 0.06, 0.02, 600)
    // Wordless choir: a sine with vibrato, holding the top note across the bar.
    const choir = voice('sine', midi(chord[3] + 12), start, length, 0.035, 0.6)
    if (choir) {
      const lfo = ctx.createOscillator()
      const depth = ctx.createGain()
      lfo.frequency.value = 5
      depth.gain.value = 4
      lfo.connect(depth).connect(choir.frequency)
      lfo.start(start)
      lfo.stop(start + length)
    }
  }
  if (intensity >= 1) {
    // Arpeggio in eighth notes, and a heartbeat drum.
    for (let step = 0; step < 8; step += 1) {
      const note = chord[[0, 1, 2, 3, 2, 1, 2, 3][step]] + 12
      voice('square', midi(note), start + step * (BEAT / 2), BEAT / 2.2, dark ? 0.02 : 0.014, 0.005, 2200)
    }
    for (const beat of dark ? [0, 1, 2, 3] : [0, 2]) {
      const at = start + beat * BEAT
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.setValueAtTime(110, at)
      osc.frequency.exponentialRampToValueAtTime(38, at + 0.25)
      gain.gain.setValueAtTime(0.22, at)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3)
      osc.connect(gain).connect(musicBus)
      osc.start(at)
      osc.stop(at + 0.32)
    }
  }
  bar += 1
}

/** Start the music scheduler (safe to call repeatedly; needs unlockAudio first). */
export function startMusic() {
  if (!ctx || musicTimer) return
  nextBarTime = ctx.currentTime + 0.1
  musicTimer = window.setInterval(() => {
    if (!ctx) return
    // Keep about one bar scheduled ahead.
    while (nextBarTime < ctx.currentTime + BEAT * 4 + 0.2) {
      scheduleBar(nextBarTime)
      nextBarTime += BEAT * 4
    }
  }, 250)
}
