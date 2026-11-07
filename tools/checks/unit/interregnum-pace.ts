// The Twilight Interregnum paced as the Long Dusk (7 Nov, the player: "So the pacing matches the
// original start in that late stelliferous era [which] doesn't have stars going out in 1 turn").
// Until then its Tide grew ×1.6 a turn (Standard) and its old red dwarfs began to die only 10¹⁰
// years in, when a turn was already longer than a whole flare (2 to 6 × 10⁹ years): on seeds 1000
// to 1019, 91% of its flares came and went between two turns and none was seen across two. Now:
// - its Tide grows as the Dusk's (×1.38 / 1.27 / 1.2), from the same 40 years: about 114 turns;
// - its old red dwarfs' deaths are spread evenly in the logarithm of the time since it began, from
//   10⁸ years in, as the Dusk spreads its own (gen.ts makePrimary): a bend the Codex states;
// - so its flares are seen nearly as the Dusk's are: on those seeds 57% never at a turn's end and
//   30% across two turns or more (the Dusk 47% and 39%). The rest of the gap is the red dwarfs
//   born during the age, and the homes, which go out late, when a turn is long;
// - a game begun in the Dusk is generated exactly as before.
import { ERA_BY_ID, INTERREGNUM, eta, stepTime } from '../../../src/game/eras';
import { newGame } from '../../../src/game/newGame';
import { hashSeed } from '../../../src/game/rng';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

/** The ends of an age's Tide turns at Standard, from its start to its end. */
function turnEnds(era: 'interregnum' | 'dusk', from: number, to: number): number[] {
  const ends: number[] = [];
  let y = from;
  while (y < to && ends.length < 400) {
    y = Math.min(stepTime(era, y, eta(y), 0, 'standard').years, to);
    ends.push(y);
  }
  return ends;
}

/** How many of the age's red dwarf flares are seen at no turn's end, and how many at two or more. */
function flares(games: GameState[], era: 'interregnum' | 'dusk', from: number, to: number) {
  const ends = turnEnds(era, from, to);
  let all = 0;
  let unseen = 0;
  let twice = 0;
  let first = Infinity;
  for (const g of games) {
    for (const sys of Object.values(g.systems)) {
      const p = sys.primary;
      if (p.kind !== 'red_dwarf' || !p.blueAt || !p.whiteAt || p.blueAt >= to || p.blueAt < from) continue;
      const k = ends.filter((t) => t > p.blueAt! && t < p.whiteAt!).length;
      all++;
      if (k === 0) unseen++;
      if (k >= 2) twice++;
      first = Math.min(first, ends.findIndex((t) => t >= p.blueAt!) + 1);
    }
  }
  return { all, unseen: unseen / all, twice: twice / all, first, turns: ends.length };
}

const seeds = [1000, 1001, 1002, 1003, 1004, 1005];
const inter = flares(seeds.map((seed) => newGame({ seed, interregnum: true, civsAsleep: true })), 'interregnum', INTERREGNUM.startYears, ERA_BY_ID.dusk.startYears);
const dusk = flares(seeds.map((seed) => newGame({ seed, civsAsleep: true })), 'dusk', ERA_BY_ID.dusk.startYears, Math.pow(10, ERA_BY_ID.dusk.endEta));
const pct = (x: number) => `${Math.round(x * 100)}%`;
check(inter.turns >= 112 && inter.turns <= 116, `the Interregnum about 114 turns at Standard (${inter.turns}; the Dusk ${dusk.turns})`);
check(inter.all >= 60, `enough of its old red dwarfs flare within it to judge (${inter.all} on ${seeds.length} seeds)`);
check(inter.unseen <= 0.62, `about half its flares are seen at a turn's end (${pct(1 - inter.unseen)} seen; in the Dusk ${pct(1 - dusk.unseen)}; 9% until 7 Nov)`);
check(inter.twice >= 0.25, `about three in ten are seen across two turns or more (${pct(inter.twice)}; in the Dusk ${pct(dusk.twice)}; none until 7 Nov)`);
check(Math.abs(inter.twice - dusk.twice) <= 0.15 && Math.abs(inter.unseen - dusk.unseen) <= 0.15, `nearly as the Dusk's are (never seen ${pct(inter.unseen)} against ${pct(dusk.unseen)}, two turns or more ${pct(inter.twice)} against ${pct(dusk.twice)})`);
check(inter.first >= 20, `the first old star does not go out in the age's first stretch of short turns (turn ${inter.first})`);

// the deaths spread from 10⁸ years in, the heaviest first, and every one within the age
const g = newGame({ seed: 1000, interregnum: true, civsAsleep: true });
const old = Object.values(g.systems).filter((s) => s.primary.kind === 'red_dwarf' && s.primary.blueAt! < ERA_BY_ID.dusk.startYears && s.id !== g.civ.homeSystemId && !Object.values(g.survivors).some((v) => v.homeSystemId === s.id));
const early = old.filter((s) => s.primary.blueAt! - INTERREGNUM.startYears < 1e10);
check(old.length > 0 && early.length > 0 && early.every((s) => s.primary.blueAt! - INTERREGNUM.startYears >= 1e8), `some go out within its first 10¹⁰ years, none within its first 10⁸ (${early.length} of ${old.length})`);
const byDeath = [...old].sort((a, b) => a.primary.blueAt! - b.primary.blueAt!);
check(byDeath.every((s, i) => i === 0 || s.primary.mass <= byDeath[i - 1].primary.mass + 1e-12), 'the heaviest first');

// a game begun in the Dusk: generated exactly as before (the hashes of interregnum-galaxy.ts)
const hashOf = (x: GameState) =>
  hashSeed(JSON.stringify({ s: x.systems, b: x.bodies, v: x.survivors, c: x.colonies, f: x.fleets, civs: x.civs, sw: x.swarms }, (_k, v) => (v === Infinity ? '__inf' : v)));
check(hashOf(newGame({ seed: 1000 })) === 2871165249, 'a game begun in the Dusk is generated exactly as before (seed 1000)');

done('INTERREGNUM PACE', `${inter.turns} turns; flares never seen ${pct(inter.unseen)}, two turns or more ${pct(inter.twice)} (the Dusk ${pct(dusk.unseen)}, ${pct(dusk.twice)})`);
