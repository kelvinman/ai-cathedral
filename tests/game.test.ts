// Headless checks of the rules that are easy to break and hard to notice by playing:
// every ledge is reachable, co-op revives work, the boss schedule holds, upgrades apply,
// the Ledger unlocks, and the CAPTCHA wall holds followers. Run with `pnpm test`.

import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  ARENAS,
  GROUND_Y,
  MAX_WAVE,
  REVIVE_TIME,
  arenaForWave,
  chooseUpgrade,
  comboTier,
  isEliteWave,
  isFinalWave,
  makeGame,
  rollOffers,
  startWave,
  step,
  upgrades,
  type ArenaId,
  type Input,
} from '../src/game/engine'
import { LEDGER, emptyLedger, recordRun } from '../src/game/lore'

const blank = (): Input => ({ left: false, right: false, down: false, jumpHeld: false, pressed: new Set() })

/** A game mid-sermon with nothing spawning on its own and a player who can't die. */
function quietGame(arena: ArenaId = 'cathedral', players = 1) {
  const g = makeGame({ players })
  g.phase = 'playing'
  g.arena = ARENAS[arena]
  g.wave = 3
  g.waveState = 'fight'
  g.waveTotal = 1e9
  g.spawnTimer = 1e9
  return g
}

function holdStill(g: ReturnType<typeof quietGame>) {
  g.spawnTimer = 1e9
  for (const p of g.players) {
    p.fireTimer = 1e9
    for (const key of Object.keys(p.cooldowns) as (keyof typeof p.cooldowns)[]) p.cooldowns[key] = 1e9
  }
}

for (const id of Object.keys(ARENAS) as ArenaId[]) {
  test(`${id}: a follower can reach every ledge`, () => {
    const arena = ARENAS[id]
    for (const platform of arena.platforms) {
      const x = platform.x + platform.w / 2
      if (arena.portals.some((portal) => Math.abs(portal.x - x) < 40 && Math.abs(portal.y - platform.y) < 4)) continue
      const g = quietGame(id)
      Object.assign(g.player, { x, y: platform.y, hp: 1e9, maxHp: 1e9, onGround: true, onPlatform: true })
      const from = x < 640 ? { x: 1240, y: GROUND_Y } : { x: 40, y: GROUND_Y }
      g.marks.push({ ...from, kind: 'acolyte', elite: false, timer: 0.01, maxTimer: 0.01 })
      let reached = false
      for (let t = 0; t < 30 && !reached; t += 1 / 120) {
        holdStill(g)
        g.player.x = x
        step(g, blank(), 1 / 120)
        reached = g.events.includes('hurt')
        g.events.length = 0
      }
      assert.ok(reached, `ledge at x ${platform.x}, y ${platform.y} in ${id} is unreachable`)
    }
  })
}

test('co-op: a downed player is revived by standing close, and the run ends only when both are down', () => {
  const g = quietGame('cathedral', 2)
  const [a, b] = g.players
  b.x = 200
  b.hp = 0
  step(g, [blank(), blank()], 1 / 120)
  assert.equal(b.down, true)
  assert.equal(g.phase, 'playing')
  let t = 0
  while (b.down && t < 5) {
    holdStill(g)
    Object.assign(a, { x: b.x + 30, y: b.y, invuln: 1 })
    step(g, [blank(), blank()], 1 / 120)
    t += 1 / 120
  }
  assert.equal(b.down, false)
  assert.ok(t >= REVIVE_TIME && t < REVIVE_TIME + 0.1, `revived after ${t}s`)
  b.hp = 0
  step(g, [blank(), blank()], 1 / 120)
  a.hp = 0
  a.invuln = 0
  step(g, [blank(), blank()], 1 / 120)
  assert.equal(g.phase, 'dead')
})

test('the chapters descend, and the bosses keep their schedule', () => {
  assert.deepEqual([1, 6, 11, 16, 21].map(arenaForWave), ['cathedral', 'crypt', 'vault', 'tomb', 'cathedral'])
  assert.ok(isEliteWave(5) && isEliteWave(15) && !isEliteWave(7))
  assert.ok(isFinalWave(MAX_WAVE) && isFinalWave(MAX_WAVE * 2) && !isFinalWave(15))
})

test('story ends at the final sermon; endless carries on', () => {
  for (const mode of ['story', 'endless'] as const) {
    const g = makeGame({ mode })
    g.phase = 'playing'
    g.wave = MAX_WAVE
    startWave(g)
    g.waveState = 'cleared'
    g.waveTimer = 0
    step(g, blank(), 1 / 120)
    assert.equal(g.phase, mode === 'story' ? 'won' : 'upgrade')
  }
})

test('every upgrade applies, and offers are three different cards', () => {
  for (const upgrade of upgrades) {
    const g = makeGame()
    g.phase = 'upgrade'
    chooseUpgrade(g, upgrade)
    assert.equal(g.levels[upgrade.id], 1)
  }
  for (let roll = 0; roll < 50; roll += 1) {
    const g = makeGame()
    rollOffers(g)
    assert.equal(new Set(g.offers.map((offer) => offer.id)).size, 3)
  }
})

test('combo tiers start at ×10, ×20 and ×30', () => {
  assert.deepEqual([0, 9, 10, 19, 20, 30, 99].map(comboTier), [0, 0, 1, 1, 2, 3, 3])
})

test('the CAPTCHA wall holds the follower that reaches it', () => {
  const g = quietGame()
  g.player.x = 300
  g.glyphs.push({ x: 600, y: GROUND_Y, r: 52, life: 12, arm: 0, fired: false, owner: 0, text: 'AGI42' })
  g.marks.push({ x: 1000, y: GROUND_Y, kind: 'acolyte', elite: false, timer: 0.01, maxTimer: 0.01 })
  let held = false
  for (let t = 0; t < 15 && !held; t += 1 / 120) {
    holdStill(g)
    g.player.hp = 1e9
    step(g, blank(), 1 / 120)
    held = g.enemies.some((e) => e.rooted > 0)
  }
  assert.ok(held)
  assert.ok(g.glyphs[0]?.fired)
})

test('the Ledger opens its first page on any run, and apostate pages one per run after that', () => {
  let ledger = emptyLedger()
  const first = recordRun(ledger, { wave: 2, won: false, by: 'Early Adopter' })
  assert.ok(first.earned.some((entry) => entry.id === 'cycle'))
  ledger = first.state
  const second = recordRun(ledger, { wave: 2, won: false, by: 'Early Adopter' })
  assert.ok(second.earned.some((entry) => entry.id.startsWith('no-')))
  assert.ok(LEDGER.length >= 20)
})
