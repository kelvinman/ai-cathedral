import type { Sfx } from './engine'

// Tiny WebAudio synth: every sound is generated, so there are no audio assets to load.

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let muted = false
const lastPlayed = new Map<Sfx, number>()

/** Must be called from a user gesture before anything can be heard. */
export function unlockAudio() {
  if (!ctx) {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return
    ctx = new AudioCtor()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.5
    master.connect(ctx.destination)
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

export function setMuted(value: boolean) {
  muted = value
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.02)
}

function tone(
  type: OscillatorType,
  from: number,
  to: number,
  duration: number,
  volume: number,
  delay = 0,
) {
  if (!ctx || !master) return
  const start = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration)
  gain.gain.setValueAtTime(volume, start)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(master)
  osc.start(start)
  osc.stop(start + duration + 0.02)
}

function noise(duration: number, volume: number, filterFrom: number, filterTo: number, delay = 0) {
  if (!ctx || !master || !noiseBuffer) return
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
  source.connect(filter).connect(gain).connect(master)
  source.start(start, Math.random() * 0.5)
  source.stop(start + duration + 0.02)
}

const throttle: Partial<Record<Sfx, number>> = { hit: 0.045, shoot: 0.05, spawn: 0.12, kill: 0.04, land: 0.1 }

export function playSfx(name: Sfx) {
  if (!ctx || muted) return
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
    case 'death':
      tone('sawtooth', 220, 30, 1.2, 0.25)
      noise(0.9, 0.3, 1500, 60)
      break
  }
}
