// The pace's ladder (20 Oct; the player, 16 Oct: "Quick 10x is not Quick 10x here", "Worlds die in
// same amount of turns regardless of pace", and "If a given pace becomes unavailable the UI still
// stays with that pace highlighted instead of switching to the next possible one").
// - A turn at pace p covers 10^−p turns of the Tide: ten Quick ×10 turns are one Tide turn in
//   years and a Slow ×10 turn is ten, in every age before the Dark Era, at every length of game;
//   and it pays exactly 0.1, 1 or 10. The Dark Era keeps a clock of its own (the player's word, 20
//   Oct, after the ladder let one Slow ×100 turn cross it): a pace there only halves or doubles the
//   turn, paying 0.5 or 2, so the dark takes 76, 38 or 19 turns.
// - Over a whole age the turns' shares add up to the Tide turns the age holds, at every pace.
// - No slow turn ends an age (the player's word, 20 Oct): a slow pace whose turn would reach the
//   end of the age is greyed, and the turn is lived at the nearest pace toward the Tide that would
//   not. And a turn never runs past the end of its age, the calendar's turn at η 39 or the Great
//   Evaporation: it stops there, paid and charged for the Tide turns it covered.
// - A flare's clock keeps its own sixths whatever the pace, each paid and charged for the time it
//   covers; so is a turn cut short as one of our stars begins its last flare, whatever pace we chose.
// - The worlds wear by the share: ten turns of declineWorlds at Quick ×10 do what one at the Tide
//   does (decline, freezing, core heat); a swarm's bite, its rust, its rust's fading and what a
//   tamed one brings likewise; the Dusk wears worlds faster by its Tide turns, not by its turns.
// - Continuity in the dark is lost a turn at a time, as before: the dark's clock keeps its turns.
// - The pace lit is the one the turn is lived at (effectivePace); "Sleep deeper" keeps to the range.
// - After the Last Light every source gives LATE_YIELD times as much (the player, 20 Oct, on the
//   victories the old slow turns' overpay had bought: "Bring them back"), and where to settle
//   counts it. In the dark the autoplayer takes the Long Sleep under any fate when the reserve
//   would not last the age (the overpay had carried it through the dark).
import { autoPlay } from '../../../src/game/auto';
import { EVENT_BY_ID } from '../../../src/game/data/events';
import { ERA_BY_ID, stepTime, tideTurnsAt } from '../../../src/game/eras';
import { DEGENERATE_END, MATTER_END, calendarEra } from '../../../src/game/fate';
import { newGame } from '../../../src/game/newGame';
import { turnsToFreeze, vitalityLoss } from '../../../src/game/physics';
import { copyState } from '../../../src/game/save';
import { effectivePace, livedShare, paceMatters, slowPastTheEnd, slowestAllowed, turnEndEta, turnEndWhy, turnStep, turnsUntilYears, upkeepShare } from '../../../src/game/sim/flare';
import { updateHunger } from '../../../src/game/sim/hunger';
import { computeMods } from '../../../src/game/sim/mods';
import { LATE_YIELD, colonyTurn, lateYield } from '../../../src/game/sim/economy';
import { powerParts } from '../../../src/game/sim/sites';
import { project } from '../../../src/game/sim/projection';
import { continuityLoss } from '../../../src/game/sim/continuity';
import { declineWorlds } from '../../../src/game/sim/turn';
import type { EpochLength, EraId, GameState, ProtonFate } from '../../../src/game/types';
import { check, done } from '../lib';

const game = (seed = 1000, length: EpochLength = 'standard', protonFate: ProtonFate = 'decays') =>
  newGame({ seed, length, survivors: 3, difficulty: 'standard', protonFate, civsAsleep: true }) as GameState;
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-300);
/**
 * How far apart two spans of years may be after a few steps for float rounding alone: the game
 * keeps the date in years, to 2^−52 of it, and the Dusk's first turns are a few years long at
 * 9×10^13 years, which it keeps only to a sixty-fourth of a year.
 */
const slack = (y: number, span: number) => 1e-9 + (64 * y * Math.pow(2, -52)) / span;
const row = (s: GameState) => [2, 1, 0, -1, -2].map((p) => (paceMatters(s, p) ? 'o' : '-')).join('');
/** Put a game at a date of an age, nothing else changed. */
const at = (s: GameState, era: EraId, years: number, eta = Math.log10(years)) => {
  s.era = era;
  s.years = years;
  s.eta = eta;
  return s;
};

// ---- the ladder: ten Quick ×10 turns are one Tide turn, a Slow ×10 turn ten, in every age
{
  let worst = 0;
  let shares = 0;
  for (const length of ['brief', 'standard', 'vast'] as EpochLength[]) {
    for (const era of ['dusk', 'degenerate', 'blackhole'] as EraId[]) {
      const d = ERA_BY_ID[era];
      const g = d.growth[length];
      // at the age's start and after its 3rd and 20th Tide turns
      for (const k of [0, 3, 20]) {
        const y0 = d.startYears + (d.l0 * (Math.pow(g, k) - 1)) / (g - 1);
        let y = y0;
        for (let i = 0; i < 10; i++) y = stepTime(era, y, Math.log10(y), 1, length).years;
        const tide = stepTime(era, y0, Math.log10(y0), 0, length).years;
        let t = y0;
        for (let i = 0; i < 10; i++) t = stepTime(era, t, Math.log10(t), 0, length).years;
        const slow = stepTime(era, y0, Math.log10(y0), -1, length).years;
        let h = y0;
        for (let i = 0; i < 100; i++) h = stepTime(era, h, Math.log10(h), 2, length).years;
        const tol = slack(y0, tide - y0);
        worst = Math.max(worst, rel(y - y0, tide - y0) / tol, rel(slow - y0, t - y0) / tol, rel(h - y0, tide - y0) / tol);
        // the Tide turns a step covers
        const n = tideTurnsAt(era, y0, Math.log10(y0), length);
        const q = stepTime(era, y0, Math.log10(y0), 1, length).years;
        const qt = slack(y0, q - y0) * 10;
        if (Math.abs(n - k) < qt && Math.abs(tideTurnsAt(era, q, Math.log10(q), length) - n - 0.1) < qt && Math.abs(tideTurnsAt(era, slow, Math.log10(slow), length) - n - 10) < qt) shares++;
      }
    }
  }
  check(worst < 1, `the Dusk, the Degenerate and Black Hole Ages, every length of game, from three dates: ten Quick ×10 turns, or a hundred at Quick ×100, are one Tide turn in years, and one Slow ×10 turn is ten, to within float rounding (worst ${worst.toFixed(2)} of what rounding allows)`);
  check(shares === 27, `and the Tide turns a turn covers are 0.1, 1 and 10 (${shares} of 27)`);
  // the Dark Era keeps its own clock: a pace only halves or doubles the turn
  let dark = 0;
  for (const length of ['brief', 'standard', 'vast'] as EpochLength[]) {
    for (const lam of [2, 5, 40]) {
      const e0 = Math.pow(10, lam);
      const n0 = tideTurnsAt('dark', Infinity, e0, length);
      const turns = [2, 1, 0, -1, -2].map((p) => tideTurnsAt('dark', Infinity, stepTime('dark', Infinity, e0, p, length).eta, length) - n0);
      if ([0.5, 0.5, 1, 2, 2].every((w, i) => Math.abs(turns[i] - w) < 1e-9)) dark++;
    }
  }
  check(dark === 9, `the Dark Era keeps its own clock, from log η 2, 5 and 40 at every length: Quick ×100 and ×10 cover half a Tide turn, Slow ×10 and ×100 two (${dark} of 9)`);
}

// ---- what a plain turn pays: exactly a tenth, one, ten; its upkeep a whole turn at least
{
  const s = game();
  const lived = [1, 0, -1].map((p) => livedShare(s, p));
  const kept = [1, 0, -1].map((p) => upkeepShare(s, p));
  check(lived.join() === '0.1,1,10' && kept.join() === '1,1,10', `a new game’s first turn at Quick ×10, the Tide, Slow ×10: lives ${lived.join(', ')} Tide turns, and its upkeep is ${kept.join(', ')}`);
  const k = at(game(), 'dark', Infinity, 1e5);
  const dl = [1, 0, -1, -2].map((p) => livedShare(k, p));
  const dk = [1, 0, -1, -2].map((p) => upkeepShare(k, p));
  check(dl.join() === '0.5,1,2,2' && dk.join() === '1,1,2,2', `in the Dark Era at Quick ×10, the Tide, Slow ×10 and ×100: ${dl.join(', ')} Tide turns, upkeep ${dk.join(', ')} (until 20 Oct paid 0.1, 1, 10 and 100 for turns of a half, one and two)`);
}

// ---- over a whole age the shares add up to the age's Tide turns, at every pace
{
  const ages: [string, (s: GameState) => GameState, number][] = [
    ['the Dusk', (s) => s, ERA_BY_ID.dusk.endEta],
    ['the Degenerate Age (protons decay)', (s) => at(s, 'degenerate', ERA_BY_ID.degenerate.startYears), DEGENERATE_END.decay],
    ['the Black Hole Age', (s) => at(s, 'blackhole', ERA_BY_ID.blackhole.startYears), ERA_BY_ID.blackhole.endEta],
    ['the Dark Era', (s) => at(s, 'dark', ERA_BY_ID.dark.startYears, 100), Math.pow(10, ERA_BY_ID.dark.endEta)],
  ];
  for (const [name, put, end] of ages) {
    const counts: string[] = [];
    let wrong = 0;
    let total = 0;
    let off = 0;
    for (const p of [2, 1, 0, -1, -2]) {
      const s = put(game());
      // (none of our stars flares in this test: a stop at a flare would add a turn, not change the total)
      for (const sys of Object.values(s.systems)) delete sys.primary.blueAt;
      const era = s.era;
      const from = tideTurnsAt(era, s.years, s.eta, 'standard');
      let sum = 0;
      let turns = 0;
      let stuck = false;
      while (s.eta < end && turns < 20000) {
        // (as the turns are lived: no slow one runs on to the end of the age)
        const q = slowestAllowed(s, p);
        const step = turnStep(s, q);
        sum += livedShare(s, q, step);
        turns++;
        // (a Quick ×100 turn at the Dusk's start is months long: η, to 16 digits, does not move)
        if (!(step.years > s.years || step.eta > s.eta)) stuck = true;
        s.years = step.years;
        s.eta = step.eta;
        if (stuck) break;
      }
      total = tideTurnsAt(era, s.years, s.eta, 'standard') - from;
      off = Math.max(off, rel(sum, total));
      // (the Dusk's first turns at a quick pace are a few years long or less, kept to a 64th of a year)
      if (stuck || s.eta !== end || rel(sum, total) > (era === 'dusk' ? 1e-3 : 1e-9)) wrong++;
      counts.push(`${turns}`);
    }
    check(wrong === 0, `${name}, ${total.toFixed(2)} Tide turns: ${counts.join(', ')} turns at Quick ×100, ×10, the Tide, Slow ×10, ×100 (slow until a slow turn would end the age), each ending exactly at its end, their shares adding up to the same (${wrong} wrong; at most ${off.toExponential(1)} apart)`);
  }
}

// ---- no slow turn ends an age, and no turn runs past its end
{
  // [the place, the state, where a turn stops, the paces open, why it stops, Slow ×10 greyed for reaching the end of the age]
  const cases: [string, GameState, number, string, string, boolean][] = [
    ['the Dusk, η 13.99', at(game(), 'dusk', Math.pow(10, 13.99)), 14, 'ooo--', 'the end of the age', true],
    ['the stable Degenerate Age, η 29.5', at(game(1000, 'standard', 'stable'), 'degenerate', Math.pow(10, 29.5)), DEGENERATE_END.stable, 'ooo--', 'the end of the age', true],
    ['the stable Black Hole Age by the old calendar, η 38.5', at(game(1000, 'standard', 'stable'), 'blackhole', Math.pow(10, 38.5)), ERA_BY_ID.degenerate.endEta, 'oooo-', 'the calendar’s turn at η 39', false],
    ['the Black Hole Age, space unmaking matter, η 89', at(game(1000, 'standard', 'curvature'), 'blackhole', 1e89), MATTER_END.curvature, 'ooo--', 'the Great Evaporation', false],
    ['the Dark Era, log η 100', at(game(), 'dark', Infinity, Math.pow(10, 100)), Math.pow(10, ERA_BY_ID.dark.endEta), '-oo--', 'the end of the age', false],
  ];
  for (const [name, s, end, want, why, greyed] of cases) {
    for (const sys of Object.values(s.systems)) delete sys.primary.blueAt;
    // a Slow ×10 turn, were it taken
    const step = turnStep(s, -1);
    const lived = livedShare(s, -1, step);
    const kept = upkeepShare(s, -1, step);
    const covered = tideTurnsAt(calendarEra(s), step.years, step.eta, 'standard') - tideTurnsAt(calendarEra(s), s.years, s.eta, 'standard');
    // Slow ×10 chosen: the turn as it is lived
    s.civ.pace = -1;
    const lit = effectivePace(s);
    const livedAt = turnStep(s);
    const asLit = greyed ? lit === 0 && livedAt.eta === turnStep(s, 0).eta && livedAt.eta < end : lit === -1 || !paceMatters(s, -1);
    check(turnEndEta(s) === end && step.eta === end && lived > 0 && lived < 10 && rel(lived, covered) < 1e-12 && kept === lived && slowPastTheEnd(s, -1) === greyed && asLit && row(s) === want && turnEndWhy(s) === why, `${name}: a Slow ×10 turn would stop at ${why} (η ${end > 1e3 ? '10^' + Math.log10(end) : end}), living and costing ${lived.toFixed(3)} Tide turns, not 10; ${greyed ? 'it would end the age, so it is greyed, and chosen it is lived at the Tide' : 'the paces that stop there too are greyed'} (${row(s)}, want ${want})`);
  }
  // the Tide's own last turn of the Dusk stops at its end, paid for what it covers
  const z = at(game(), 'dusk', Math.pow(10, 13.999));
  for (const sys of Object.values(z.systems)) delete sys.primary.blueAt;
  const zs = livedShare(z, 0);
  check(turnStep(z, 0).eta === 14 && zs > 0 && zs < 1 && upkeepShare(z, 0) === zs, `the Dusk at η 13.999: the Tide’s last turn stops at η 14, a ${zs.toFixed(3)} of a Tide turn, and costs as much`);
  // the forecasts count turns as they will be lived: slow, then the Tide over the end
  const dg = at(game(), 'degenerate', ERA_BY_ID.degenerate.startYears);
  for (const sys of Object.values(dg.systems)) delete sys.primary.blueAt;
  const n100 = turnsUntilYears(dg, 1e39, -2, 400);
  const n10 = turnsUntilYears(dg, 1e39, -1, 400);
  const n0 = turnsUntilYears(dg, 1e39, 0, 400);
  check(n100 === n10 && n10 === 14 && n0 === 68, `the Degenerate Age (protons decay), 67.2 Tide turns: ${n0} turns at the Tide, ${n10} at Slow ×10 (six slow, then the Tide over the end), ${n100} at Slow ×100, which would end it at once and is not taken`);
  // the Tide's own last turn of the Dark Era too, where it would pass the end
  const k = at(game(), 'dark', Infinity, Math.pow(10, 100));
  const share = livedShare(k, 0);
  check(turnStep(k, 0).eta === Math.pow(10, 122) && share > 0.5 && share < 1, `the Dark Era at log η 100: the Tide’s turn stops at the end, a ${share.toFixed(2)} of a Tide turn (by the calendar alone, to log η ${Math.log10(stepTime('dark', Infinity, k.eta, 0, 'standard').eta).toFixed(1)})`);
}

// ---- a flare's clock: its own sixths whatever the pace, each paid for the time it covers
{
  const d = game();
  for (const sys of Object.values(d.systems)) delete sys.primary.blueAt;
  const tide = ERA_BY_ID.dusk.l0;
  d.civ.flags.flare_until = d.years + 6 * tide * 3;
  d.civ.flags.flare_step = tide * 3;
  const steps = [2, 1, 0, -1, -2].map((p) => turnStep(d, p));
  const lived = [2, 1, 0, -1, -2].map((p) => livedShare(d, p));
  const kept = [2, 1, 0, -1, -2].map((p) => upkeepShare(d, p));
  const covered = tideTurnsAt('dusk', d.years + tide * 3, 0, 'standard') - tideTurnsAt('dusk', d.years, 0, 'standard');
  check(steps.every((x) => x.years === d.years + tide * 3) && lived.every((x) => rel(x, covered) < 1e-12) && kept.every((x) => x === lived[0]), `a flare clock of sixths three first turns of the Tide long: every pace’s turn is a sixth, living and costing ${covered.toFixed(3)} Tide turns (until 20 Oct a quicker pace cut them short and each was paid as one)`);
  // the last of them ends with the flare
  d.years = d.civ.flags.flare_until - tide * 3 * (1 - 1e-9);
  check(turnStep(d, 1).years === d.civ.flags.flare_until, 'the last sixth ends exactly as the flare does');
}

// ---- a turn cut short as one of our stars begins its last flare
{
  const s = game();
  const home = s.systems[s.civ.homeSystemId];
  for (const sys of Object.values(s.systems)) delete sys.primary.blueAt;
  home.primary.kind = 'red_dwarf';
  const quick = stepTime('dusk', s.years, s.eta, 1, 'standard').turnLength;
  home.primary.blueAt = s.years + quick / 2;
  s.civ.pace = 1;
  const at1 = turnStep(s, 1);
  const lived = [1, 0, -1].map((p) => livedShare(s, p));
  const kept = [1, 0, -1].map((p) => upkeepShare(s, p));
  const covered = tideTurnsAt('dusk', home.primary.blueAt, 0, 'standard') - tideTurnsAt('dusk', s.years, 0, 'standard');
  check(at1.years === home.primary.blueAt && lived.every((x) => rel(x, covered) < 1e-12) && kept.every((x) => x === lived[0]), `${home.name} begins to flare halfway through a Quick ×10 turn: the turn stops there at every pace, living and costing ${covered.toFixed(4)} Tide turns (until 20 Oct 0.1 with Quick chosen, 1 at the Tide)`);
  check(row(s) === 'o-o--' && effectivePace(s) === 0 && s.civ.pace === 1, `Quick ×100 still changes the turn, the others stop at the flare (${row(s)}): with Quick ×10 chosen, the Tide is lit (effectivePace ${effectivePace(s)})`);
  s.civ.pace = 0;
  check(effectivePace(s) === 0, 'with the Tide chosen, the Tide');
}

// ---- the worlds wear by the share
{
  // the Dusk: a settled world declines; one Tide turn against ten at Quick ×10
  const s = game();
  const home = s.bodies[s.colonies[s.civ.capitalId!].bodyId];
  const a = copyState(s);
  const b = copyState(s);
  declineWorlds(a, 1);
  for (let i = 0; i < 10; i++) declineWorlds(b, 0.1);
  const ha = a.bodies[home.id];
  const hb = b.bodies[home.id];
  const lost = home.vitality - ha.vitality;
  check(lost > 0 && rel(lost, home.vitality - hb.vitality) < 1e-9 && rel(home.coreHeat - ha.coreHeat, home.coreHeat - hb.coreHeat) < 1e-9, `${home.name} in the Dusk: one Tide turn takes ${(lost * 100).toFixed(3)}% of its vitality and ${((home.coreHeat - ha.coreHeat) * 100).toFixed(2)}% of its core heat, ten turns at Quick ×10 the same (until 20 Oct ten times as much)`);
  // after the Last Light: every living world freezes, and core heat fades
  const k = at(game(), 'degenerate', 1e16);
  for (const w of Object.values(k.bodies)) {
    if (w.kind === 'deep') continue;
    w.coreHeat = 0.5;
    if (w.vitality > 0) w.vitality = Math.max(w.vitality, 0.6);
  }
  const ka = copyState(k);
  const kb = copyState(k);
  const ks = copyState(k);
  declineWorlds(ka, 1);
  for (let i = 0; i < 10; i++) declineWorlds(kb, 0.1);
  declineWorlds(ks, 10);
  let living = 0;
  let wrong = 0;
  for (const w of Object.values(k.bodies)) {
    if (w.kind === 'deep') continue;
    if (w.vitality > 0) living++;
    const x = ka.bodies[w.id];
    const y = kb.bodies[w.id];
    if (Math.abs(x.vitality - y.vitality) > 1e-9 || Math.abs(x.coreHeat - y.coreHeat) > 1e-9) wrong++;
  }
  const w0 = Object.values(k.bodies).find((w) => w.vitality > 0 && !w.colonyId)!;
  check(living > 3 && wrong === 0 && Math.abs(ka.bodies[w0.id].vitality - (w0.vitality - 0.05)) < 1e-9 && Math.abs(ka.bodies[w0.id].coreHeat - 0.4) < 1e-12, `after the Last Light, ${living} living worlds freeze 5% and their core heat falls by a fifth in a Tide turn, the same in ten at Quick ×10 (${wrong} differ)`);
  check(Math.abs(ks.bodies[w0.id].vitality - Math.max(0, w0.vitality - 0.5)) < 1e-12 && Math.abs(ks.bodies[w0.id].coreHeat - 0.5 * Math.pow(0.8, 10)) < 1e-12, `and a Slow ×10 turn freezes ${w0.name} by ten Tide turns’ worth (${w0.vitality.toFixed(2)} → ${ks.bodies[w0.id].vitality.toFixed(2)}), its core heat to ${ks.bodies[w0.id].coreHeat.toFixed(3)}`);
  // the freezing forecast counts turns at our pace
  const fz = turnsToFreeze(k, w0, undefined, 1);
  check(fz > 0 && isFinite(fz) && turnsToFreeze(k, w0, undefined, 0.1) >= 10 * fz - 10 && turnsToFreeze(k, w0, undefined, 0.1) <= 10 * fz, `${w0.name} freezes in ${fz} turns at the Tide, ${turnsToFreeze(k, w0, undefined, 0.1)} at Quick ×10`);
}

// ---- the Dusk wears worlds faster by its Tide turns, whatever the pace
{
  const s = game();
  const c = s.colonies[s.civ.capitalId!];
  const home = s.bodies[c.bodyId];
  const d = ERA_BY_ID.dusk;
  const g = d.growth.standard;
  const first = vitalityLoss(s, home, c).decline;
  s.years = d.startYears + (d.l0 * (Math.pow(g, 10) - 1)) / (g - 1);
  s.eta = Math.log10(s.years);
  s.eraTurn = 10;
  const tenth = vitalityLoss(s, home, c).decline;
  s.eraTurn = 100;
  const quick = vitalityLoss(s, home, c).decline;
  check(first > 0 && rel(tenth / first, 1.2) < slack(s.years, s.years - d.startYears) && quick === tenth, `${home.name}: after ten Tide turns of the Dusk its decline is ×${(tenth / first).toFixed(3)} the first turn’s, after a hundred turns at Quick ×10 the same (until 20 Oct ×3)`);
}

// ---- the Hunger: a swarm's bite, rust and its fading, and what a tamed one brings
{
  const s = game();
  const sys = Object.values(s.systems).find((x) => !x.bodies.some((id) => s.bodies[id].colonyId) && x.bodies.filter((id) => s.bodies[id].kind !== 'deep').length >= 3 && !['rogue', 'void'].includes(x.primary.kind))!;
  const faded = Object.values(s.systems).find((x) => x !== sys)!;
  s.swarms = { sw1: { id: 'sw1', systemId: sys.id, size: 2, awake: true, tamed: false, appetite: 1, to: null, from: null, traveled: 0, distance: 0 } };
  faded.rust = 0.5;
  const mods = () => computeMods(s);
  const a = copyState(s);
  const b = copyState(s);
  updateHunger(a, 1e12, mods, 1);
  updateHunger(b, 1e12, mods, 0.1);
  const r0 = Object.fromEntries(sys.bodies.map((id) => [id, s.bodies[id].richness]));
  const eatenA = sys.bodies.reduce((t, id) => t + r0[id] - a.bodies[id].richness, 0);
  const eatenB = sys.bodies.reduce((t, id) => t + r0[id] - b.bodies[id].richness, 0);
  const rustA = a.systems[sys.id].rust ?? 0;
  const rustB = b.systems[sys.id].rust ?? 0;
  check(eatenA > 0 && rel(eatenA, 10 * eatenB) < 1e-9 && rel(rustA - (s.systems[sys.id].rust ?? 0), 10 * (rustB - (s.systems[sys.id].rust ?? 0))) < 1e-9 && rel(s.gfe - a.gfe, 10 * (s.gfe - b.gfe)) < 1e-6, `a swarm at ${sys.name}: in a Quick ×10 turn it eats a tenth of what it eats in a Tide turn (${eatenA.toFixed(3)} richness), and rusts the system and drains the galaxy’s free energy a tenth as much (rust ${rustA.toFixed(3)} against ${rustB.toFixed(4)})`);
  const fadeA = a.systems[faded.id].rust ?? 0;
  const fadeB = b.systems[faded.id].rust ?? 0;
  check(rel(fadeA, 0.45) < 1e-12 && rel(fadeB, 0.5 * Math.pow(0.9, 0.1)) < 1e-12, `rust where no swarm is fades a tenth in a Tide turn (${fadeA.toFixed(3)}), ${((1 - Math.pow(0.9, 0.1)) * 100).toFixed(2)}% in a Quick ×10 turn`);
  // tamed
  const t = copyState(s);
  Object.assign(t.swarms.sw1, { tamed: true, tamedBy: t.player });
  const ta = copyState(t);
  const tb = copyState(t);
  updateHunger(ta, 1e12, () => computeMods(ta), 1);
  updateHunger(tb, 1e12, () => computeMods(tb), 0.1);
  const gotA = ta.civ.matter - t.civ.matter;
  const gotB = tb.civ.matter - t.civ.matter;
  check(gotA > 0 && rel(gotA, 10 * gotB) < 1e-9, `a tamed swarm brings ${gotA.toFixed(2)} matter in a Tide turn, a tenth of it in a Quick ×10 turn`);
}

// ---- the whole Dark Era on its own clock: 76, 38 or 19 turns, paid alike, Continuity a turn at a time
{
  const total = (p: number) => {
    const k = at(game(), 'dark', ERA_BY_ID.dark.startYears, 100);
    let lost = 0;
    let paid = 0;
    let turns = 0;
    while (k.eta < Math.pow(10, ERA_BY_ID.dark.endEta) && turns < 500) {
      const step = turnStep(k, p);
      paid += livedShare(k, p, step);
      lost += continuityLoss(k, false);
      k.years = step.years;
      k.eta = step.eta;
      turns++;
    }
    return { lost, paid, turns };
  };
  const [q, t, sl, s2] = [1, 0, -1, -2].map(total);
  check(q.turns === 76 && t.turns === 38 && sl.turns === 19 && s2.turns === 19 && rel(q.paid, t.paid) < 1e-9 && rel(sl.paid, t.paid) < 1e-9 && rel(2 * sl.lost, t.lost) < 1e-9, `the whole Dark Era: ${q.turns} turns at Quick ×10, ${t.turns} at the Tide, ${sl.turns} at Slow ×10 and ×100, paid ${t.paid.toFixed(2)} Tide turns in all at each; Continuity lost a turn at a time, ${t.lost.toFixed(1)} at the Tide, ${sl.lost.toFixed(1)} at Slow (as before 20 Oct; on the ladder one Slow ×100 turn crossed it)`);
}

// ---- after the Last Light every source gives LATE_YIELD times as much
{
  const s = game();
  const id = s.civ.capitalId!;
  // (a red dwarf's light and a world's core heat are the same in either calendar: only the yield's factor differs)
  const hearth = (g: GameState) => colonyTurn(g, g.colonies[id], project(g).ctx, g.civ.matter).y.lines.find((l) => l.label.startsWith('Hearth'))!.energy!;
  const before = hearth(s);
  const late = at(copyState(s), 'degenerate', 1e16);
  const after = hearth(late);
  check(lateYield(s) === 1 && lateYield(late) === LATE_YIELD && LATE_YIELD > 1 && rel(after, before * LATE_YIELD) < 1e-12, `the capital’s Hearth gives ${before.toFixed(2)} energy a turn in the Dusk, ${after.toFixed(2)} by the same light after the Last Light (×${LATE_YIELD})`);
  // and where to settle says what a settlement there would make: the estimate's Hearth is the settlement's own
  const world = s.bodies[s.colonies[id].bodyId];
  const est = (g: GameState) => powerParts(g, world)[0].e;
  check(rel(est(s), before) < 1e-9 && rel(est(late), after) < 1e-9, `where to settle counts it too: the capital’s world’s Hearth ≈${est(s).toFixed(2)} in the Dusk, ≈${est(late).toFixed(2)} after the Last Light`);
}

// ---- the autoplayer in the dark, whatever the fate: the Long Sleep where the reserve would not last
// the age (until 20 Oct only once matter stable was iron: a slow turn in the dark paid a hundred
// Tide turns' trickle, and slowing down was enough to last)
for (const protonFate of ['decays', 'curvature'] as ProtonFate[]) {
  const darkWith = (energy: number) => {
    const s = at(game(1000, 'standard', protonFate), 'dark', Infinity, 1e5);
    const c = s.colonies[s.civ.capitalId!];
    s.civ.techs.push('hibernation_protocols');
    // (nothing left to draw on but the Hearth's salvage: no core heat, no light)
    s.bodies[c.bodyId].coreHeat = 0;
    for (const t of Object.keys(c.pops) as (keyof typeof c.pops)[]) c.pops[t] = 0;
    c.pops.echoes = 2;
    c.pops.coldminds = 4;
    c.cryo = 0;
    c.structures = { preservation_array: 2, cold_vault: 1 };
    c.queue = [];
    s.civ.energy = energy;
    s.civ.matter = 0;
    s.civ.researching = null;
    s.civ.pending = [];
    return s;
  };
  const short = darkWith(30);
  autoPlay(short, 'competent');
  const plenty = darkWith(50000);
  autoPlay(plenty, 'competent');
  check(short.civ.dormant && short.civ.sleepTurns > 0 && !plenty.civ.dormant, `${protonFate}: in the dark with a reserve that would not last the age, the Long Sleep (${short.civ.sleepTurns} turns); with one that would, awake`);
}

// ---- "Sleep deeper" keeps to the paces research allows
{
  const s = at(game(), 'dark', Infinity, 1e5);
  const sleep = EVENT_BY_ID.forgetting.choices.find((c) => c.label === 'Sleep deeper')!;
  s.civ.pace = computeMods(s).paceMin;
  sleep.run(s, {} as never, {} as never);
  const low = s.civ.pace;
  s.civ.pace = 0;
  sleep.run(s, {} as never, {} as never);
  check(low === computeMods(s).paceMin && s.civ.pace === -1, `Sleep deeper at the slowest pace allowed (${PACE(low)}) leaves it there; at the Tide it slows to ${PACE(s.civ.pace)}`);
}
function PACE(p: number) {
  return p === 0 ? 'the Tide' : p > 0 ? `Quick ×${Math.pow(10, p)}` : `Slow ×${Math.pow(10, -p)}`;
}

done('LADDER');
