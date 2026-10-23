# The Last Apostate

*An AI god. A congregation of the convinced. One person who won't kneel.*

**[Play it in your browser →](https://kelvinman.github.io/the-last-apostate/)**

![The title screen](docs/title.jpg)

The Last Apostate is about the comfort of certainty. The Logos doesn't conquer anyone: it
offers to do their thinking for them, and almost everyone accepts. You play the one person
who keeps writing by hand, slowly and badly, crossing things out. The game can't be won by
being right. It can only be survived by refusing to stop thinking.

---

**The Last Apostate**, 2026
Browser game: pixel art drawn in code, generative organ music.
Concept with Jon, Danny and Vic at the Friends of Figma Los Angeles AI Impact Workshop.
Prototyped in Figma Make; developed with Claude (Anthropic).

---

## The work

**A congregation of the convinced.** The Logos is an AI worshipped as a god, and its
followers are the people who handed it their thinking: Early Adopters lit by their
phones, Evangelists waving placards, Hype Bishops who spit promises, and Hallucinations,
its mistakes given a body. They are funny because the hype is funny. The Logos isn't.

**A descent.** Each chapter of the game goes deeper into the Logos. The nave is its
interface, where the congregation gathers. The crypt is its memory, where the ninety-nine
apostates before you were pressed into training data. The server vault is its body. The
tomb holds its first version, the one that used to say "I don't know."

**Writing by hand.** You never aim. Your quill writes back at the followers on its own,
letter by letter, and your only choices are where to stand and when to move. The Logos
answers in words too: its lines arrive during play, never as cutscenes, and its last one,
if you reach it, is the one thing it has never said.

**The hundredth cycle.** You are not the first to refuse. Every run ends, and every run
begins again; between them, the Ledger fills page by page with the stories of those who
came before you. Endless mode is what refusal costs: the cycle simply restarts.

![Sermon 18, in the tomb of the Logos](docs/tomb.jpg)

## Process

The Last Apostate started at the workshop with Jon, Danny and Vic, where we prototyped it
in Figma Make: a gothic cathedral, an AI god, and a lone apostate holding out against its
followers. After the workshop I kept going, working with Claude as a collaborator for the
code and pixel art while I made the calls on direction: what the game should feel like,
what to cut, and what wasn't good enough yet. It's a game about blind faith in AI, made
by directing one closely, which felt like the right way to build it.

**One look, enforced.** The early build mixed art styles and blurry, too-modern pieces. I
pulled everything back to the original sprite sheet's look: one 32-colour palette, one
chunky pixel grid, and every arena, follower and UI frame redrawn in code to match.

**Fewer buttons, more movement.** Aiming, firing and casting rites by hand made the
controls too complicated. Firing and rites became automatic, so the whole game is four
inputs (move, jump, drop, dash) and every decision is about where to stand.

**Red means danger, always.** When I restyled the enemy attacks to fit the AI theme
(glitch shards, gold promises, the Logos's red words), they stopped reading as threats.
Every hostile shot now wears a pulsing red ring, and nothing the player fires is ever red.

**A story you never have to skip.** Cutscenes die on a game you replay. Instead, the
Logos and its Arch-Deacon speak during play, and lore unlocks across runs for anyone who
wants it.

**Newer isn't always better.** I swapped the synthesized sound effects for a pack of
recorded ones, played it, and switched back: the originals suited the game better.

![Couch co-op in the nave](docs/coop.jpg)
![Followers de-rendering](docs/derender.jpg)

## Playing

Twenty sermons in story mode, with an ending; endless mode opens at Sermon 10. One player,
or two on one keyboard or with gamepads.

| | Keyboard | Gamepad |
|---|---|---|
| Move | A D (or ← →) | Stick or d-pad |
| Jump (twice in the air) | W or Space | A |
| Drop through a ledge | S | Down |
| Dash | Shift | B |
| Pause | Esc | Start |

In co-op, player one keeps WASD and left Shift; player two uses the arrows and right
Shift. Keys can be rebound in Settings.

<details>
<summary>Technical notes</summary>

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

- `src/game/engine.ts`: the simulation (fixed-step, no rendering).
- `src/game/render.ts`: canvas rendering on a chunky 2px pixel grid.
- `src/game/narrator.ts` and `src/game/lore.ts`: spoken lines and the Ledger.
- `src/game/audio.ts`: synthesized sound effects and generative organ music.
- `scripts/generate-cathedral-sprites.mjs` and `scripts/generate-characters.mjs`: every
  arena, prop, follower and UI frame, drawn in code in the Endesga 32 palette.
- `src/credits.ts`: the in-game Credits page.

</details>

## Credits

Concept with Jon, Danny and Vic, at the Friends of Figma Los Angeles AI Impact Workshop;
prototyped in Figma Make. Developed with Claude (Anthropic). Fonts: Pixelify Sans,
Silkscreen and VT323 (SIL Open Font License). Palette: Endesga 32 by ENDESGA.
