// Two saves from 9eea773, one turn each: the helium star after a merger boils the close worlds it
// threatened; the lingering helium giant boils nothing and converts.
import { endTurn } from '../../../src/game/sim/turn';
import { autoPlay } from '../../../src/game/auto';
import { bodyClimate, boilingAway, primaryLuminosity, primaryTemperature, shownKind, sourceLight } from '../../../src/game/physics';
import { check, done, loadSave } from '../lib';

for (const [name, file] of [
  ['merger', '9eea773-seed1000-turn119-merger.json.gz'],
  ['giant', '9eea773-seed1000-turn120-giant.json.gz'],
] as const) {
  const s = loadSave(file);
  const sys = Object.values(s.systems).find((x) => x.name === 'Kyhux')!;
  const worlds = sys.bodies.map((id) => s.bodies[id]).filter((b) => b && b.kind !== 'deep' && !b.dissolved);
  const p = sys.primary;
  console.log(`${name}: η ${s.eta.toFixed(2)}, Kyhux ${p.kind} (shown as ${shownKind(p, s.years)}), ${primaryTemperature(p, s.years, s.era).toFixed(0)} K, ${primaryLuminosity(p, s.years, s.era).toExponential(2)} L☉; light "${sourceLight(s, sys, s.years, 0).label}"`);
  for (const b of worlds) {
    const c = bodyClimate(s, b);
    console.log(`  ${b.name} ${b.kind} at ${b.orbitAU} AU: ${c.day !== undefined ? `${c.night!.toFixed(0)}–${c.day.toFixed(0)}` : c.mean.toFixed(0)} K, ${boilingAway(s, b) ?? 'stays'}`);
  }
  const doomed = worlds.filter((b) => boilingAway(s, b));
  autoPlay(s, 'competent');
  endTurn(s);
  const after = sys.bodies.map((id) => s.bodies[id]).filter((b) => b && b.kind !== 'deep' && !b.dissolved);
  console.log(`  next turn (η ${s.eta.toFixed(2)}): Kyhux ${sys.primary.kind}; worlds left: ${after.map((b) => b.name).join(', ') || 'none'}`);
  if (name === 'merger') check(doomed.length > 0 && doomed.every((b) => b.dissolved), `the helium star boiled the ${doomed.length} worlds it threatened`);
  else check(after.length === worlds.length && sys.primary.kind !== 'helium_giant', 'the lingering giant boiled nothing and converted');
}
done('OLD SAVES');
