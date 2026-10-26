// Every star has a name of its own (26 Oct, the player: "lanthe well for whatever reason shows as
// unsurveyed after multiple surveys"): the two globular clusters could draw one name, and with it
// two Wells, one charted and one not. A new galaxy has no two stars of one name and no two
// clusters of one name, and a Well's worlds bear its name; a save with two Lanthe Wells loads
// with the later one renamed, the charted one as it was, and loading again changes nothing.
import { newGame } from '../../../src/game/newGame';
import { migrate } from '../../../src/game/save';
import { check, done } from '../lib';

let twins = 0;
let strays = 0;
for (let seed = 1; seed <= 60; seed++) {
  const s = newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard' });
  const names = Object.values(s.systems).map((x) => x.name);
  const clusters = s.regions.filter((r) => r.kind === 'globular').map((r) => r.name);
  if (new Set(names).size !== names.length || new Set(clusters).size !== clusters.length) twins++;
  for (const w of Object.values(s.systems).filter((x) => x.name.endsWith(' Well'))) if (w.bodies.some((id) => !s.bodies[id].name.startsWith(w.name))) strays++;
}
check(twins === 0, `60 galaxies: no two stars or clusters of one name (${twins})`);
check(strays === 0, `every Well’s worlds bear its name (${strays} not)`);

const s = newGame({ seed: 5, length: 'standard', survivors: 3, difficulty: 'standard' });
const wells = Object.values(s.systems).filter((x) => x.name.endsWith(' Well'));
for (const w of wells) w.name = 'Lanthe Well';
for (const r of s.regions.filter((x) => x.kind === 'globular')) r.name = 'Cluster Lanthe';
s.civ.known[wells[0].id] = 2;
const m = migrate(JSON.parse(JSON.stringify(s)));
const after = wells.map((w) => m.systems[w.id].name);
check(after[0] === 'Lanthe Well' && after[1] !== 'Lanthe Well' && after[1].endsWith(' Well'), `a save with two Lanthe Wells: the charted one keeps its name, the other is ${after[1]}`);
check(m.civ.known[wells[0].id] === 2 && (m.civ.known[wells[1].id] ?? 0) < 2, 'which of them is charted is unchanged');
const again = migrate(JSON.parse(JSON.stringify(m)));
check(wells.every((w) => again.systems[w.id].name === m.systems[w.id].name), 'loading again changes nothing');
done('NAMES');
