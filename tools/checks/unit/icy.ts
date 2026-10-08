// New galaxies place ice worlds by their star's light: an ice world or ice-shelled ocean that is not
// frozen even on its warmest ground starts as bare rock (dryFromTheStart, after generation). Its
// figures become bare rock's: no habitability or life, richness 1.0 to 1.7, a trace of water, no
// buried ocean. Nothing else changes: every other world, and every star, is as generation made it,
// with the same random draws. The home system keeps its fixed layout, its ice-shelled ocean
// included, and a star in its last flare is judged by its light before it.
import { generateWorld } from '../../../src/game/gen';
import { DEFAULT_SETTINGS, newGame } from '../../../src/game/newGame';
import { bodyClimate, frozenFromTheStart, primaryLuminosity, starClimate, NO_TERRAFORMING, decayWarmth, ICE_MELTS_K } from '../../../src/game/physics';
import { calendarEra } from '../../../src/game/fate';
import { check, done } from '../lib';

let dried = 0;
let otherChanged = 0;
let starsChanged = 0;
let warmIce = 0;
let badRock = 0;
let homeKept = 0;
let flaring = 0;
for (const seed of [1000, 2000, 3000, 4000]) {
  const opts = { seed, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' } as const;
  const before = generateWorld({ ...DEFAULT_SETTINGS, ...opts });
  frozenFromTheStart(before);
  const s = newGame(opts);
  for (const [id, a] of Object.entries(before.bodies)) {
    const b = s.bodies[id];
    if (JSON.stringify({ ...a, colonyId: null }) === JSON.stringify({ ...b, colonyId: null })) continue;
    if ((a.kind === 'ice' || a.kind === 'ocean_ice') && b.kind === 'barren') {
      dried++;
      const others = { ...a, kind: 'barren', habitability: 0, vitality: 0, decline: 0, coreHeat: 0, richness: b.richness, water: b.water, traits: b.traits, colonyId: null };
      if (b.habitability !== 0 || b.vitality !== 0 || b.richness < 1 || b.richness > 1.7 || (b.water ?? 0) > 0.01 || b.traits.includes('subsurface_ocean') || JSON.stringify(others) !== JSON.stringify({ ...b, colonyId: null })) badRock++;
    } else otherChanged++;
  }
  for (const id of Object.keys(before.systems)) if (JSON.stringify(before.systems[id]) !== JSON.stringify(s.systems[id])) starsChanged++;
  for (const b of Object.values(s.bodies)) {
    if (b.kind !== 'ice' && b.kind !== 'ocean_ice') continue;
    const sys = s.systems[b.systemId];
    if (sys.special === 'home') {
      homeKept++;
      continue;
    }
    // a flaring star: judged by its light before the flare
    const lum = sys.primary.kind === 'blue_dwarf' ? primaryLuminosity({ ...sys.primary, kind: 'red_dwarf' }, s.years, calendarEra(s), decayWarmth(s)) : undefined;
    if (sys.primary.kind === 'blue_dwarf') flaring++;
    const c = lum === undefined ? bodyClimate(s, b) : starClimate(s, b, lum, NO_TERRAFORMING);
    if ((c.day ?? c.mean) >= ICE_MELTS_K) warmIce++;
  }
}
check(dried > 20, `four galaxies: ${dried} ice worlds not frozen at their warmest start as bare rock`);
check(badRock === 0, 'with bare rock’s figures, and nothing else about them changed');
check(otherChanged === 0 && starsChanged === 0, `every other world and every star as generated (${otherChanged}, ${starsChanged})`);
check(warmIce === 0, `no ice world is left warm at its warmest (${flaring} around flaring stars judged by their light before)`);
check(homeKept >= 4, `the home system keeps its ice-shelled ocean (${homeKept})`);
done('ICY');
