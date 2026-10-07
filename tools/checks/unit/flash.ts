// Helium giants light as their turn ends, with an event; a star too brief for a clock can be caught in one turn (a flash).
import { GIANT_LIFE, sourceLight } from '../../../src/game/physics';
import { newGame } from '../../../src/game/newGame';
import { autoPlay } from '../../../src/game/auto';
import { endTurn } from '../../../src/game/sim/turn';
import { keepTimeWithStar, livedShare, paceMatters, starClock, starClockTerms, turnStep } from '../../../src/game/sim/flare';
import { reserveCapacity } from '../../../src/game/sim/economy';
import { computeMods } from '../../../src/game/sim/mods';
import { EVENT_BY_ID } from '../../../src/game/data/events';
import type { GameState, StarSystem } from '../../../src/game/types';
import { check, done } from '../lib';


// ---------------------------------------------------------------- a giant is born as its turn ends
const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
let born: StarSystem | null = null;
for (let guard = 0; guard < 700 && !s.outcome && !born; guard++) {
  autoPlay(s, 'competent');
  const r = endTurn(s);
  const g = r.notes.find((n) => n.kind === 'giant');
  if (g) born = s.systems[g.systemId];
}
check(!!born, `a helium giant forms in play (${born?.name}, η ${s.eta.toFixed(2)})`);
if (born) {
  const p = born.primary;
  check(p.kind === 'helium_giant' && p.bornAt === s.years && p.diesAt === s.years + GIANT_LIFE, 'it lights as its turn ends, and burns for 120,000 years from then');
  check(s.pending.some((e) => e.defId === 'helium_giant' && e.data.systemId === born!.id), 'its event is waiting');
  check((s.civ.known[born.id] ?? 0) >= 1, 'it is seen on the map');
  const text = EVENT_BY_ID.helium_giant.text(s, { systemId: born.id });
  console.log(`  event: ${text}`);
  const t = starClockTerms(s, born);
  console.log(`  terms: ${JSON.stringify(t)}`);
}

/** A helium giant lit now at a dead dwarf, in a game at least at η `eta`. */
function giantAt(eta: number): { s: GameState; sys: StarSystem } {
  const g = newGame({ seed: 8919, length: 'standard', survivors: 3, difficulty: 'standard' });
  for (let guard = 0; guard < 900 && !g.outcome && !(g.era === 'degenerate' && g.eta >= eta); guard++) {
    autoPlay(g, 'competent');
    endTurn(g);
  }
  g.pending.length = 0;
  for (const k of ['star_until', 'star_step', 'star_next', 'star_flash']) delete g.civ.flags[k];
  const sys = Object.values(g.systems).find((x) => !x.gone && (x.primary.kind === 'white_dwarf' || x.primary.kind === 'black_dwarf'))!;
  sys.primary.kind = 'helium_giant';
  sys.primary.bornAt = g.years;
  sys.primary.diesAt = g.years + GIANT_LIFE;
  g.civ.known[sys.id] = 2;
  if (!g.civ.techs.includes('quickening')) g.civ.techs.push('quickening');
  g.civ.pace = 0;
  g.civ.energy = Math.floor(reserveCapacity(g, computeMods(g)));
  return { s: g, sys };
}

for (const eta of [17.6, 18.5]) {
  const { s: g, sys } = giantAt(eta);
  const exact = GIANT_LIFE >= g.years * 1e-13;
  console.log(`-- η ${g.eta.toFixed(2)} (${exact ? 'the flash ends as the giant does' : 'the shortest turn outlasts the giant'})`);
  const t = starClockTerms(g, sys);
  check(t.possible && t.flash && t.brief, `a flash is offered (cost ${t.cost} of ${Math.floor(g.civ.energy)} energy; ${t.orders.toFixed(1)} tenfolds)`);
  const paid = keepTimeWithStar(g, sys.id);
  check(paid === t.cost, 'it is paid for once');
  const step = turnStep(g);
  const want = exact ? GIANT_LIFE : g.years * 1e-13;
  // (doubles at 10^18 step by a few hundred years: a turn this short is exact to an ulp or two)
  const ulp2 = 2 * Math.pow(2, Math.floor(Math.log2(g.years)) - 52);
  check(Math.abs(step.turnLength - want) <= ulp2, `the turn is ${step.turnLength.toExponential(4)} years (want ${want.toExponential(4)}, to within ${ulp2} years)`);
  if (exact) check(step.years === sys.primary.diesAt, 'it ends exactly as the giant burns out');
  check(livedShare(g) === 1, 'it is lived in full');
  const c = starClock(g);
  check(!!c && c.flash && c.turn === 1 && c.of === 1 && c.systemId === sys.id, `the clock reads turn ${c?.turn} of ${c?.of}, a flash, at ${c?.system}`);
  check(!paceMatters(g, 1) && !paceMatters(g, -1) && paceMatters(g, 0), 'Quick ×10 and Slow ×10 are greyed; the Tide is open');
  const light = sourceLight(g, sys, g.years, step.turnLength).light;
  const full = 70 * (0.5 + 0.5 * g.gfe);
  check(Math.abs(light - full) < 1e-9, `collectors get its full light: ×${light.toFixed(2)} (want ×${full.toFixed(2)})`);
  const y0 = g.years;
  g.pending.length = 0;
  endTurn(g);
  const left = ['star_until', 'star_step', 'star_next', 'star_flash'].filter((k) => g.civ.flags[k] !== undefined);
  check(left.length === 0, `no clock flags are left (${left.join(', ') || 'none'})`);
  check(sys.primary.kind !== 'helium_giant', `it burned out as the turn ended (now ${sys.primary.kind})`);
  check(Math.abs(g.years - y0 - want) <= ulp2, `the year moved on by ${(g.years - y0).toExponential(4)}`);
  const nt = turnStep(g);
  console.log(`  next turn: ${nt.turnLength.toExponential(2)} years at our own pace`);
}

done('FLASH');
