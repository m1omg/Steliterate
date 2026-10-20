// The late sky as it is (12 Oct, the player: "stars in enhanced mode in bh era isnt accurate,
// describing brown dwarfs at 13", and "an option to see black holes by their lifetime").
// - A brown dwarf's words follow what warms it: at 13 K it read "still glowing with the heat of its
//   youth" (by its light to collectors, which is counted in the age's tiny units); now the last of
//   the heat it formed with, then dark matter's few kelvin, then gone cold.
// - Pictures: a brown dwarf greys as it cools after the Dusk, a neutron star darkens as its spin
//   runs down, as its collectors' light always did (that light is unchanged).
// - Lasting: a place at a black hole lasts until the hole evaporates (it read "never falls in" at
//   every hole); a world around a star that never takes its worlds in never falls in (it read its
//   gravitational-wave date, which never comes there).
// - Turns to many dates at once (the Black holes tab) are the turns to each one.
import { newGame } from '../../../src/game/newGame';
import { fallsInAt, brownWarmth, pulsarBeam, sourceLight, primaryTemperature, haloDrawn } from '../../../src/game/physics';
import { deserialize } from '../../../src/game/save';
import { lastsUntil, siteValue } from '../../../src/game/sim/sites';
import { turnsUntilAll, turnsUntilYears } from '../../../src/game/sim/flare';
import { calendarEra } from '../../../src/game/fate';
import type { GameState, StarSystem } from '../../../src/game/types';
import { check, done, near } from '../lib';

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const at = (g: GameState, era: GameState['era'], eta: number) => {
  g.era = era;
  g.years = Math.pow(10, eta);
  g.eta = eta;
};

// ---------------------------------------------------------------- a brown dwarf's words
const bd = Object.values(s.systems).find((x) => x.primary.kind === 'brown_dwarf')!;
const said = (eta: number) => {
  at(s, eta < 14 ? 'dusk' : 'degenerate', eta);
  const src = sourceLight(s, bd, s.years, 0);
  return { label: src.label, T: primaryTemperature(bd.primary, s.years, calendarEra(s), 0, 0, haloDrawn(s)), light: src.light };
};
// where it is 13 K, as in the player's game
let lo = 14,
  hi = 20;
for (let i = 0; i < 40; i++) {
  const mid = (lo + hi) / 2;
  if (said(mid).T > 13) lo = mid;
  else hi = mid;
}
const t13 = said(lo);
console.log(`  ${bd.name} (${bd.primary.mass.toFixed(3)} M☉) at η ${lo.toFixed(2)}: ${t13.T.toFixed(1)} K, light ×${t13.light.toFixed(3)}: “${t13.label}”`);
check(!/glowing|youth/.test(t13.label) && /heat it formed with/.test(t13.label), 'at 13 K: not “glowing with the heat of its youth”, the last of the heat it formed with');
check(/faintly warmed by dark matter/.test(said(21).label), `η 21, the halo still there: “${said(21).label}”`);
check(said(30).label === 'Brown dwarf gone cold', `η 30, the halo spent: “${said(30).label}”`);
check(/never ignited/.test(said(13.96).label), 'in the Dusk as before');

// ---------------------------------------------------------------- pictures
check(brownWarmth(200) === 1 && brownWarmth(1e-20) === 0 && brownWarmth(13) > 0.2 && brownWarmth(13) < 0.6, `a brown dwarf's warmth in pictures: 1 at 200 K, ${brownWarmth(13).toFixed(2)} at 13 K, 0 in the Black Hole Age`);
check(pulsarBeam('dusk', 1e14) === 1 && pulsarBeam('degenerate', 1e21) === 0.5 && pulsarBeam('degenerate', 1e27) === 0 && pulsarBeam('blackhole', 1e50) === 0, 'a neutron star beams in the Dusk, half at η 21, none from η 27');
const ns = Object.values(s.systems).find((x) => x.primary.kind === 'neutron_star')!;
at(s, 'degenerate', 20);
near('its collectors’ light is as it was', sourceLight(s, ns, s.years, 0).light, 0.25 * Math.max(0, 1 - (20 - 15) / 12) * (0.4 + 0.6 * s.gfe));

// ---------------------------------------------------------------- Lasting at a black hole
{
  const g = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
  at(g, 'blackhole', 50);
  const holes = Object.values(g.systems).filter((x) => x.primary.kind === 'black_hole' || x.primary.kind === 'smbh');
  const deepOf = (x: StarSystem) => g.bodies[x.bodies.find((id) => g.bodies[id].kind === 'deep')!];
  const heart = holes.find((x) => x.primary.kind === 'smbh')!;
  const small = holes.filter((x) => x.primary.kind === 'black_hole').sort((a, b) => a.primary.evaporateAt! - b.primary.evaporateAt!)[0];
  const vh = siteValue(g, deepOf(heart), 'coldminds');
  const vs = siteValue(g, deepOf(small), 'coldminds');
  console.log(`  the Heart’s Deep: “${vh.label}”; ${small.name} (${small.primary.mass.toFixed(1)} M☉): “${vs.label}”`);
  check(lastsUntil(g, deepOf(heart)) === heart.primary.evaporateAt && /^lasts 10/.test(vh.label), 'a hole’s Deep lasts until the hole evaporates (it read “never falls in”)');
  check(vh.score > vs.score, 'so Coldminds rank the Heart, which lasts longest, above a lighter hole (a Vault Ship’s Best for them)');
  const rogue = { ...deepOf(small), kind: 'ice' as const, rogue: true };
  check(lastsUntil(g, rogue) === Infinity, 'a world flung loose from it never falls in, as before');
  const bdWorld = Object.values(g.bodies).find((b) => b.kind !== 'deep' && !b.rogue && b.inspiralAt && g.systems[b.systemId].primary.kind === 'brown_dwarf');
  // (in a game begun before 19 Oct; since then a brown dwarf takes its worlds in too: fall-in.ts)
  const og = deserialize(JSON.stringify(g))!;
  delete og.flags.all_fall;
  check(!!bdWorld && lastsUntil(og, og.bodies[bdWorld.id]) === Infinity && siteValue(og, og.bodies[bdWorld.id], 'coldminds').label === 'never falls in', `in a game begun before 19 Oct a world of a brown dwarf never falls in (it read its date, ${bdWorld?.inspiralAt?.toExponential(1)} years, which never comes there)`);
  check(!!bdWorld && lastsUntil(g, bdWorld) === fallsInAt(g, bdWorld) && isFinite(lastsUntil(g, bdWorld)), `in a new game it lasts until it falls in, at ${bdWorld ? lastsUntil(g, bdWorld).toExponential(1) : '?'} years`);
}

// ---------------------------------------------------------------- turns to many dates at once
{
  const g = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
  at(g, 'blackhole', 60);
  const targets = [61, 66.5, 70, 80, 99.3, 59, Infinity].map((e) => (isFinite(e) ? Math.pow(10, e) : e));
  const all = turnsUntilAll(g, targets);
  const one = targets.map((t) => turnsUntilYears(g, t));
  console.log(`  turns to η 61, 66.5, 70, 80, 99.3, 59, ∞: ${all.join(', ')}`);
  check(all.every((n, i) => n === one[i]), 'the same as counting each on its own');
}

done('LATE SKY');
