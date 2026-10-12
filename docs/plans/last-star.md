# Plan: the Last Star burns out in the turn it lights

For a second Claude session. The player asked for it on 12 Oct ("make a plan for a second claude
session to fix it pls"), since the first account was near its usage limits.

Start with `HANDOVER.md` and `CLAUDE.md`, then this file. It touches the Unlit's quest, so read
`docs/spoilers/dark-matter.md` for context, and never repeat it to the player. Ask the player the
questions in step 1 before writing any code.

## What happened (the player's game)

The player asked: "when will i see the new star?" Their turn-149 save showed:
- Turn 134: they shut the Halo Siphons.
- Turn 135: they pressed Help.
- Turn 139: the Last Star lit and burned out inside that same turn. The Record says "The star at
  The Last Star has burned out" (turn 139).
- Turn 140: the Unlit's message "The Last Star" arrived.

They never saw it shine, and no turn drew on its light. Their system has since gone: the Great
Decay (η 39, fate decay) dissolved it. The game is at η 40.6 now.

## Why (checked in the code on 12 Oct)

- **`src/game/sim/minds.ts`, `igniteDarkStar`:** it runs from `updateMinds`, step 6 of `endTurn`.
  - It sets `bornAt: state.years` (the turn's start) and `diesAt: Math.max(state.years * 3, 1e25)`.
  - So the star lives until the universe is three times as old as when it lit.
- **`src/game/physics.ts`, `evolveUniverse`** (about line 625) runs in step 7 of the same turn. It
  burns a `dark_star` out as soon as `to >= p.diesAt`.
- **The turn's length.** A Degenerate turn at the Tide (standard) is about 1.82 times the
  universe's age, and ten times that for each step of slower pace.
- **The result.**
  - At pace −1 or slower, the star dies in the turn it lit.
  - At pace 0 it survives into the next turn, but `sourceLight` (`dark_star` branch) gives it only
    the share of that turn it overlaps, about 3%.
  - Either way the economy (step 1, at a turn's start) never sees it lit.
- **The rule it breaks.** Every other new star follows "it lights as the turn ends, and shines
  through the next" (the comment above the helium giant in `evolveUniverse`, and the long comment
  in `src/game/sim/flare.ts` above `STAR_TURNS`). A player may then keep time with it: its life in
  `STAR_TURNS` (6) turns, priced by `starClockTerms` and paid by `keepTimeWithStar`. The Last Star
  is left out: `isNewStar` (`flare.ts` line 182) lists only `collision_star`, `helium_star` and
  `helium_giant`.
- **When the old numbers work.** `diesAt`'s floor of 1e25 shows it was meant for a quest finished
  near η 22 to 25. The player finished at about η 37.

## Constraints

- **The Unlit's quest line stays word for word.** The player said: "don't change that part. I love
  it. Unless you want to extend it rather than reduce anything". No stored message text or choice
  changes; additions only. The player chooses (step 1).
- **Spoiler-light** in everything the player sees, this plan included: what the star gives and the
  gift stay in `docs/spoilers/`.
- **Saves are sacred:** optional fields or computed values; `migrate()`; a check with an old save.
- **Seeds are sacred.** The autoplayer answers the request with Help (`auto.ts`, `dark_reveal2`), so
  the harness will move. Report the numbers, as for every rules change.
- **Physics.** A dark star powered by dark matter annihilating is a real hypothesis for the
  first stars (Freese, Spolyar and Gondolo 2008). One in the far future is speculative, and so is
  its lifetime: the Codex must say plainly that the length is the game's choice.

## Step 1: ask the player first

Use AskUserQuestion, with these options and recommendations:

1. **How long it shines.**
   - **(Recommended) Like every other new star:** it lights as the turn ends and shines through
     the next turn. The player may keep time with it, for 6 turns of its life (`STAR_TURNS`), as
     with a collision star.
   - **A fixed number of turns,** whatever the pace, with no clock.
   - **A longer life in years** (for example to η 25, or ten times its age), with nothing else
     changed.
2. **Its price, if keeping time:**
   - **(Recommended) Free:** it is the Unlit's gift to everyone, and the player has paid 200
     matter and 100 energy already.
   - **Priced like other new stars** (`starClockTerms`: free within a hundredfold, energy per
     tenfold beyond).
3. **Existing saves:**
   - **(Recommended) From the update on.** A star that already burned out stays out. In the
     player's own game it could not shine now anyway: the Great Decay is past, at η 40.6.
   - **Relight it on load,** where it burned out inside the turn it lit, and matter still exists.

## Step 2: the change, for the recommended answers

1. **Light it as the turn ends.**
   - In `endTurn` (`src/game/sim/turn.ts`), the gathering's ignition must happen at `to`, as for
     other new stars: either in step 7 after the burnout checks, or `updateMinds` sets a flag and
     the star is made after `evolveUniverse`.
   - Then `bornAt = to` and `diesAt = to + life`, where life is at least the next turn's length.
   - The "Mass without light" and other message texts stay unchanged; keep its signal as it is.
   - Recheck where `igniteDarkStar` picks its host: `halo[0]`, the first globular-cluster system not
     gone. It may pick an ejected one (the player's was `ejected: true`). An ejected system is
     still a star, so this is probably fine, but say so.
2. **Make it a new star for the clocks.**
   - Add `dark_star` to `isNewStar` (`flare.ts`).
   - Make `starClockTerms` price it at 0 (a flag, or `kind === 'dark_star'`).
   - Make sure `NEW_STAR_LUM` and the boil and swallow rules for helium stars do not apply to it
     (`boilingAway`, `NewStar`). They should not: it is a dark star, not a helium star.
   - Check every place that switches on the new-star kinds:
     `grep -n "collision_star' || \|'helium_giant'" -r src`.
3. **Offer to keep time.**
   - The Unlit's "The Last Star" message has no choices, and must stay as it is.
   - Offer the clock where new stars are offered it without an event: the Systems window's
     Collision stars tab (`Lists.tsx`, around line 555), and the star's panel in `Drawer.tsx`.
     Find how a collision star's "keep time" is reached from there.
   - If neither offers one, add a button on the Last Star's panel ("Keep time with it", free),
     using `keepTimeWithStar`.
4. **The Great Decay.** In a decay universe ordinary matter dissolves by η 39, so the star should
   end then too (see how `matterGone` and `MATTER_END` treat other stars). Say so in its text, and
   in the Codex.
5. **Text.**
   - The Codex's Degenerate Age entry, near "Halo Siphons": how long the Last Star burns, that it
     can be kept time with, and the bend. A dark star in the far future, and its lifetime, are the
     game's choice.
   - The Manual's Unlit paragraph, if a clock is offered.
   - Write ’ in both (`Codex.tsx`, `Manual.tsx`).

## Step 3: checks

**A unit check, `tools/checks/unit/last-star.ts`:**
- Set the dark mind to stage 4 with `dark.flags.gathering = s.turn`. Run `endTurn`.
- The star exists after the turn, at paces 0, −1 and −2, with `bornAt` equal to the turn's end.
- The next turn's `project()` draws on its light (light above 0 at a colony there, or
  `sourceLight(...).light > 0` for its system).
- Keeping time with it costs 0, and it shines for 6 turns.
- It burns out as its clock ends; under the decay fate, by the Great Decay.
- An old save (`tools/saves/`, or one built at stage 4) loads and plays on.
- The quest's stored texts are unchanged: compare the signal texts before and after.

**A browser check** (if a button is added): the star on the map after the turn, its panel, Keep
time, the clock's turns. Include the magnifier mode. Use `pressable` or native buttons.

**Harness:**
- Count how many of 300 games light the star, and at what η.
- Compare 300 and 900 games against a `git worktree` of `main`, game for game (DEV-NOTES has the
  helpers).
- Report the numbers. The reference on 11 Oct: 151 / 69 / 71 in 300 games, 442 / 195 / 70 in 900.

## Step 4: going live

Follow CLAUDE.md:
- validate: tsc, build, playtest, savecompat, unit checks, and browser checks with `STEL_FONTS`;
- write the CHANGELOG, DEV-NOTES and SESSION-NOTES ("Picking up");
- open a PR into `main` and merge it with a merge commit (the player: "Always. You merge pls.");
- check that the Pages run succeeded and the live script matches the build.

Then tell the player, spoiler-light: the Last Star now shines when it lights and can be kept time
with. Their current game is past the Great Decay, so it will show in a future game.
