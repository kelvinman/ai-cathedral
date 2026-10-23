# AI Cathedral

**[Play it in your browser →](https://kelvinman.github.io/ai-cathedral/)**

A pixel-art gothic survival game. The Logos, an AI worshipped as a god, promised its
followers perfect certainty. Now they pour through the cathedral to convert the last
apostate: you. Your quill writes back at them on its own and your rites cast themselves;
your job is to move, jump, dash, and stay alive through twenty sermons, descending from
the nave to the tomb where the Logos began.

![The title screen](docs/title.jpg)

## What's in it

- **Four arenas, one descent.** The nave, the crypt where the ninety-nine lie, the server
  vault that is the Logos's body, and its tomb. Each chapter builds toward its boss: the
  rose window reddens, the skulls open their eyes, the racks turn red, the dead monolith
  wakes.
- **Followers with their own bodies**, dressed for each arena: Early Adopters glued to
  their phones, Evangelists waving AGI placards, Hype Bishops lobbing promises,
  six-fingered Hallucinations, the Arch-Deacon with its wrench, and the Logos itself.
- **Builds that change how you play.** Counter-doctrines between sermons, including rare
  ones (bolts that split, bolts that chain, a mirror that reflects shots) and trade-offs.
  Combos power you up at ×10, ×20 and ×30.
- **Story mode** (twenty sermons and an ending), **endless mode** (unlocks at Sermon 10),
  and **couch co-op** for two on one keyboard or with gamepads, with revives.
- **A story told in passing.** The Logos and the Arch-Deacon speak as you play, and the
  Ledger collects twenty lore pages across runs.
- **Settings**: key rebinding, gamepad support, reduced flashing, larger text, a yellow
  danger colour, screen shake, fullscreen, and save codes to back up progress.

![Couch co-op in the nave](docs/coop.jpg)
![Sermon 18, in the tomb of the Logos](docs/tomb.jpg)
![Followers de-rendering](docs/derender.jpg)

## The story behind it

AI Cathedral started with Jon, Danny and Vic at the Friends of Figma Los Angeles AI
Impact Workshop, where we prototyped it in Figma Make: a gothic cathedral, an AI god, and
a lone apostate holding out against its followers.

After the workshop I kept going. I worked with Claude (Anthropic's AI) as a collaborator
for the code and pixel art, while I made the calls on direction: what the game should feel
like, what to cut, and what wasn't good enough yet. It's a game about blind faith in AI,
made by directing one closely, which felt like the right way to build it.

## Design decisions

**One look, enforced.** The early build mixed art styles and blurry, too-modern pieces. I
pulled everything back to the original sprite sheet's look: one 32-colour palette, one
chunky pixel grid, and every arena, follower and UI frame redrawn in code to match.

**Fewer buttons, more movement.** Aiming, firing and casting rites by hand made the
controls too complicated. Firing and rites became automatic, so the whole game is four inputs
(move, jump, drop, dash) and every decision is about where to stand.

**Red means danger, always.** When I restyled the enemy attacks to fit the AI theme
(glitch shards, gold "promises", the Logos's red words), they stopped reading as
threats. Every hostile shot now wears a pulsing red ring, and nothing the player fires is
ever red.

**A story you never have to skip.** Cutscenes die on a game you replay. Instead, the
Logos and its Arch-Deacon talk during play, lines react to how a run is going, and lore
pages unlock across runs in the Ledger for anyone who wants them.

**Newer isn't always better.** I swapped the synthesized sound effects for a pack of
recorded ones, played it, and switched back: the originals suited the game better.

## Controls

| | Keyboard | Gamepad |
|---|---|---|
| Move | A D (or ← →) | Stick or d-pad |
| Jump (twice in the air) | W or Space | A |
| Drop through a ledge | S | Down |
| Dash | Shift | B |
| Pause | Esc | Start |

In co-op, player one keeps WASD and left Shift; player two uses the arrows and right
Shift. Firing and rites are automatic.

## Running it

Needs Node 22 and pnpm (see `.mise.toml`).

```bash
pnpm install
pnpm dev        # play locally
pnpm test       # rules checks: reachability, revives, bosses, upgrades, Ledger
pnpm balance    # simulate runs and report how far scripted players get
pnpm sprites    # regenerate all pixel art from scripts/
pnpm build      # static build in dist/, hostable from any folder
```

Every push to `main` is tested and deployed to GitHub Pages
(`.github/workflows/pages.yml`).

## How it's made

- `src/game/engine.ts`: the whole simulation (fixed-step, no rendering).
- `src/game/render.ts`: canvas rendering on a chunky 2px pixel grid.
- `src/game/narrator.ts` and `src/game/lore.ts`: spoken lines and the Ledger.
- `src/game/audio.ts`: synthesized sound effects and generative organ music.
- `scripts/generate-cathedral-sprites.mjs` and `scripts/generate-characters.mjs`: every
  arena, prop, follower and UI frame is drawn in code, in the Endesga 32 palette.
- `src/credits.ts`: who made it, shown on the in-game Credits page.

## Credits

Original concept with Jon, Danny and Vic, made at the Friends of Figma Los Angeles AI Impact
Workshop, where it was first prototyped in Figma Make. See `src/credits.ts`, also shown in game under Settings → Save and credits → Credits.
Fonts: Pixelify Sans, Silkscreen and VT323 (SIL Open Font License). Palette: Endesga 32
by ENDESGA. Built with Claude (Anthropic).
