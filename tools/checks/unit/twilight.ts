// An ice world (or ice-shelled ocean) locked close to its star, with its day side past boiling and
// its night side below freezing, is named for what it is: a Twilight sea (a hot eyeball), its water
// frozen on the night side, open along the terminator, boiled off the day side. Only such worlds
// carry the name, and their water says so. New galaxies have few (waterFromTheStart: a water-rich
// world that hot is a steam world, a water-poor one dries out), but a brightening star can make
// one, and games begun before have them. Display only: the world itself is unchanged.
import { newGame } from '../../../src/game/newGame';
import { bodyClimate, boilingAway, waterState } from '../../../src/game/physics';
import type { Body, GameState } from '../../../src/game/types';
import { bodyKindName } from '../../../src/ui/labels';
import { check, done, loadSave } from '../lib';

const isTwilight = (s: GameState, b: Body) => {
  const c = bodyClimate(s, b);
  return (b.kind === 'ice' || b.kind === 'ocean_ice') && (b.water ?? 0) >= 0.1 && !boilingAway(s, b) && c.day !== undefined && c.night !== undefined && c.day >= 373 && c.night < 273;
};
/** Every world named a Twilight sea is one, and every one is named so, its water too. */
const audit = (s: GameState) => {
  let named = 0;
  let wrong = 0;
  for (const b of Object.values(s.bodies)) {
    if (b.dissolved || b.kind === 'deep') continue;
    const t = isTwilight(s, b);
    if (t !== (bodyKindName(s, b) === 'Twilight sea')) wrong++;
    if (t) {
      named++;
      if (!/ice on the night side, open water along the terminator, the day side boiled dry/.test(waterState(b, bodyClimate(s, b)))) wrong++;
    }
  }
  return { named, wrong };
};

// new galaxies name everything rightly
for (const seed of [1000, 2000, 3000]) {
  const s = newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  const a = audit(s);
  check(a.wrong === 0, `seed ${seed}: ${a.named} twilight sea${a.named === 1 ? '' : 's'} at the start, nothing misnamed`);
}

// one made by hand: bare rock close to its red dwarf, given ice
{
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  const b = Object.values(s.bodies).find((x) => {
    if (x.kind !== 'barren' || x.colonyId || !x.traits.includes('tidally_locked') || s.systems[x.systemId].primary.kind !== 'red_dwarf') return false;
    const c = bodyClimate(s, x);
    return c.day !== undefined && c.day >= 400 && c.night !== undefined && c.night < 200;
  });
  if (b) {
    b.kind = 'ice';
    b.water = 0.5;
    const c = bodyClimate(s, b);
    check(bodyKindName(s, b) === 'Twilight sea', `${b.name}, given ice at ${Math.round(c.night!)}–${Math.round(c.day!)} K: ${bodyKindName(s, b)}`);
    check(/ice on the night side, open water along the terminator, the day side boiled dry/.test(waterState(b, c)), `its water: ${waterState(b, c)}`);
  } else check(false, 'a hot locked rock to try');
}

// a game begun before still has them, named rightly
{
  let named = 0;
  let wrong = 0;
  for (const name of ['4fe2404-seed1000-turn87-clock.json.gz', '551fb1a-seed24757-turn71.json.gz', '7d0806d-seed1000-turn85-star.json.gz']) {
    const a = audit(loadSave(name));
    named += a.named;
    wrong += a.wrong;
  }
  check(wrong === 0, `old saves: ${named} twilight seas, nothing misnamed`);
}
done('TWILIGHT');
