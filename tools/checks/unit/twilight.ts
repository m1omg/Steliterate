// An ice world (or ice-shelled ocean) locked close to its star, with its day side past boiling and
// its night side below freezing, is named for what it is: a Twilight sea (a hot eyeball), its water
// frozen on the night side, open along the terminator, boiled off the day side. Only such worlds
// carry the name, and their water says so. Display only: the world itself is unchanged.
import { newGame } from '../../../src/game/newGame';
import { bodyClimate, boilingAway, waterState } from '../../../src/game/physics';
import { bodyKindName } from '../../../src/ui/labels';
import { check, done } from '../lib';

let named = 0;
let wrong = 0;
let example = '';
for (const seed of [1000, 2000, 3000]) {
  const s = newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  for (const b of Object.values(s.bodies)) {
    if (b.dissolved || b.kind === 'deep') continue;
    const c = bodyClimate(s, b);
    const twilight = (b.kind === 'ice' || b.kind === 'ocean_ice') && (b.water ?? 0) >= 0.1 && !boilingAway(s, b) && c.day !== undefined && c.night !== undefined && c.day >= 373 && c.night < 273;
    const name = bodyKindName(s, b);
    if (twilight !== (name === 'Twilight sea')) {
      wrong++;
      if (wrong <= 3) console.log(`  ${b.name}: ${b.kind}, ${Math.round(c.night ?? c.mean)}–${Math.round(c.day ?? c.mean)} K, named ${name}`);
    }
    if (twilight) {
      named++;
      const w = waterState(b, c);
      if (!/ice on the night side, open water along the terminator, the day side boiled dry/.test(w)) wrong++;
      example ||= `${b.name}: ${Math.round(c.night!)}–${Math.round(c.day!)} K, ${w}`;
    }
  }
}
check(named > 0, `three galaxies have twilight seas (${named}; e.g. ${example})`);
check(wrong === 0, `only they are named so, and their water says so (${wrong} wrong)`);
done('TWILIGHT');
