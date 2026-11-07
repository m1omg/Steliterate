// Thin gas: nebulae rare at a trillion years (1 Nov, the player: "Twilight Interregnum starting point
// has way too many nebulas … nebulas should be kind of rare and not literally my entire
// neighborhood"; for new games, not the one already begun), and a star's date given precisely
// ("Burns until 1 trillion years": "make it more precise and clarify that it's after the Big Bang").
// - A new game begun in the Interregnum: its galaxy is the one it was (the same hashes with the new
//   field set aside: seeds are sacred), but a future star's gas is thin and dark until half the
//   galaxy's age at its birth: a few nebulae at the start, none of them thin gas, and few near home.
// - Thin gas is named for what it is, says when it gathers, and gathers as the years pass it: a
//   nebula, its star lighting when it always would.
// - A Gas Scoop still draws on thin gas; Cold Chemistry reads only a nebula.
// - A game begun before (no field) keeps every nebula it had.
// - formatDate: "1.000015 trillion years after the Big Bang".
import { CONDENSE_FACTOR, INTERREGNUM_START, nebulaNear, thinGas } from '../../../src/game/interregnum';
import { newGame } from '../../../src/game/newGame';
import { evolveUniverse, nextStellarChange } from '../../../src/game/physics';
import { hashSeed } from '../../../src/game/rng';
import { copyState } from '../../../src/game/save';
import { formatDate } from '../../../src/game/eras';
import { primaryName, starLife } from '../../../src/ui/labels';
import { EVENTS } from '../../../src/game/data/events';
import type { GameState, StarSystem } from '../../../src/game/types';
import { check, done } from '../lib';

const hashOf = (g: GameState) =>
  hashSeed(JSON.stringify({ s: g.systems, b: g.bodies, v: g.survivors, c: g.colonies, f: g.fleets, civs: g.civs, sw: g.swarms }, (_k, v) => (v === Infinity ? '__inf' : v)));
const without = (g: GameState) => {
  const c = copyState(g);
  for (const x of Object.values(c.systems)) delete x.primary.condenseAt;
  return c;
};
const dist = (a: StarSystem, b: StarSystem) => Math.hypot(a.phys.x - b.phys.x, a.phys.y - b.phys.y, a.phys.z - b.phys.z);

// ---------------------------------------------------------------- generation
const s = newGame({ seed: 1000, interregnum: true, civsAsleep: true });
// (the hashes of 1 Nov were 3292118343 and 3254906463; since 7 Nov the old red dwarfs' deaths are
// spread from 10⁸ years into the age, as the Dusk spreads its own: interregnum-pace.ts)
check(hashOf(without(newGame({ seed: 1000, interregnum: true }))) === 2767092969 && hashOf(without(newGame({ seed: 20260927, interregnum: true }))) === 2252565887, 'the same galaxy as before, but for the new field (seeds 1000 and 20260927)');
let seen = 0;
let nearHome = 0;
let all = 0;
for (let seed = 1000; seed < 1010; seed++) {
  const g = newGame({ seed, interregnum: true, civsAsleep: true });
  const home = g.systems[g.civ.homeSystemId];
  const neb = Object.values(g.systems).filter((x) => x.primary.kind === 'nebula');
  const shown = neb.filter((x) => !thinGas(x.primary));
  all += neb.length;
  seen += shown.length;
  nearHome += shown.filter((x) => dist(x, home) <= 30).length;
  const right = neb.every((x) => (thinGas(x.primary) ? Math.abs(x.primary.condenseAt! - x.primary.bornAt! / CONDENSE_FACTOR) < 1 && x.primary.condenseAt! > INTERREGNUM_START : x.primary.bornAt! / CONDENSE_FACTOR <= INTERREGNUM_START));
  if (!right) check(false, `seed ${seed}: a nebula's gas gathers at half the galaxy's age at its birth`);
}
check(seen >= 3 && seen <= 40 && nearHome <= 3, `ten new games at a trillion years: ${seen} nebulae of ${all} future stars' gas (the rest thin gas), ${nearHome} within 30 ly of home`);
const dusk = newGame({ seed: 1000, civsAsleep: true });
check(!Object.values(dusk.systems).some((x) => x.primary.condenseAt !== undefined), 'a game begun in the Dusk has none');

// ---------------------------------------------------------------- thin gas, gathering
{
  const g = copyState(s);
  const sys = Object.values(g.systems).find((x) => thinGas(x.primary))!;
  const p = sys.primary;
  const at = p.condenseAt!;
  const born = p.bornAt!;
  check(primaryName(p) === 'Thin gas' && nextStellarChange(sys, g.years)?.what.includes('gathers into a nebula') === true && starLife(g, sys)?.now === 'thin gas', `${sys.name}: "${primaryName(p)}", it ${nextStellarChange(sys, g.years)?.what} (${starLife(g, sys)?.now} → ${starLife(g, sys)?.next})`);
  evolveUniverse(g, g.years, at * 1.01, () => 0.5);
  g.years = at * 1.01;
  check(g.systems[sys.id].primary.kind === 'nebula' && !thinGas(g.systems[sys.id].primary) && primaryName(g.systems[sys.id].primary) === 'Nebula' && nextStellarChange(g.systems[sys.id], g.years)?.at === born, `it gathers into a nebula as the years pass it (${formatDate(at, s.years)}), its star still to light at its time`);
  evolveUniverse(g, g.years, born * 1.001, () => 0.5);
  check(g.systems[sys.id].primary.kind !== 'nebula', `and lights as ${g.systems[sys.id].primary.kind}`);
}

// ---------------------------------------------------------------- the Gas Scoop and Cold Chemistry
{
  const g = copyState(s);
  const home = g.systems[g.civ.homeSystemId];
  // a thin gas the only gas near home
  const thin = Object.values(g.systems).find((x) => thinGas(x.primary))!;
  for (const x of Object.values(g.systems)) if (x.primary.kind === 'nebula' && x !== thin) x.primary = { ...x.primary, kind: 'brown_dwarf' };
  thin.phys = { ...home.phys, x: home.phys.x + 10 };
  check(nebulaNear(g, home)?.id === thin.id, 'a Gas Scoop still draws on thin gas within its reach');
  const chem = EVENTS.find((e) => e.id === 'nebula_chemistry')!;
  g.civ.known[thin.id] = 2;
  const rng = { pick: <T>(a: T[]) => a[0], next: () => 0.5, int: () => 0, range: () => 0.5, chance: () => false, shuffle: <T>(a: T[]) => a } as never;
  check(chem.bind!(g, rng) === null, 'Cold Chemistry reads no thin gas');
  delete thin.primary.condenseAt;
  check((chem.bind!(g, rng) as { systemId: string } | null)?.systemId === thin.id, 'but reads a nebula');
}

// ---------------------------------------------------------------- a game begun before
{
  const old = without(s);
  const neb = Object.values(old.systems).filter((x) => x.primary.kind === 'nebula');
  check(neb.length > 30 && neb.every((x) => !thinGas(x.primary) && primaryName(x.primary) === 'Nebula'), `a game begun before 1 Nov keeps every nebula it had (${neb.length})`);
}

// ---------------------------------------------------------------- a star's date
check(formatDate(1e12 + 1.5e7, 1e12) === '1.000015 trillion years after the Big Bang' && formatDate(1.03e12, 1e12) === '1.03 trillion years after the Big Bang' && formatDate(9.0004e13, 9e13) === '90.004 trillion years after the Big Bang', `a star's date, precise and after the Big Bang: "${formatDate(1e12 + 1.5e7, 1e12)}"`);

done('THIN GAS');
