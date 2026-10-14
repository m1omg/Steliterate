// Every ship class shows a painted hull that exists (public/art/ships/<look>.png), and a fleet wears
// its heaviest warship's: the Aegis over the Breacher over the Hunter over the Warden over the
// Picket. A Kinetic Lance shows its own only with no other warship to escort it. The new hulls
// are warships' (their glow on the map is the war colour).
import { SHIPS, fleetLook, lookRole } from '../../../src/game/data/ships';
import { check, done } from '../lib';

declare const process: { getBuiltinModule(id: string): unknown };
const { existsSync } = process.getBuiltinModule('node:fs') as { existsSync(p: string): boolean };

const missing = SHIPS.map((d) => fleetLook([d.id])).filter((look) => !existsSync(`public/art/ships/${look}.png`));
check(missing.length === 0, `every class's hull has its picture (${missing.length ? `missing: ${missing.join(', ')}` : `${SHIPS.length} classes`})`);
const own = { picket: 'picket', breacher: 'breacher', hunter: 'hunter', lance: 'lance' } as const;
for (const [cls, look] of Object.entries(own)) check(fleetLook([cls]) === look && lookRole(look) === 'war', `the ${cls} wears its own hull, a warship's`);
const cases: [string[], string][] = [
  [['picket', 'warden'], 'war'],
  [['warden', 'hunter'], 'hunter'],
  [['hunter', 'breacher'], 'breacher'],
  [['breacher', 'aegis'], 'aegis'],
  [['lance', 'picket'], 'picket'],
  [['lance', 'lance'], 'lance'],
  [['lance', 'probe'], 'lance'],
  [['probe', 'ark'], 'settler'],
];
for (const [classes, look] of cases) check(fleetLook(classes) === look, `${classes.join(' + ')}: the ${look} hull (${fleetLook(classes)})`);
done('HULLS');
