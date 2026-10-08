// Life a flare or a runaway greenhouse has boiled is dead, and only that life.
// - A new galaxy whose stars are already flaring starts with the flare so far behind it
//   (scorchedFromTheStart): each world it scorches, even on the night side, has the life and
//   water scorchWorlds would have left it after that share of the flare, and one whose life ran
//   out has died as it dies in play (surface life to bare rock). Nothing else changes, and no
//   random draw is taken.
// - A steam world (water_rich, past the runaway limit) holds no life: what it has dies with the
//   turn, and we hear of it if we know the world.
// - A world dry on its day side that keeps ice, and an ocean under it, on its night side (a
//   twilight sea) keeps its life through a flare.
import { generateWorld } from '../../../src/game/gen';
import { DEFAULT_SETTINGS, newGame } from '../../../src/game/newGame';
import { SURFACE_LIFE, bodyClimate, decayWarmth, frozenFromTheStart, primaryLuminosity, steamWorld, waterFromTheStart } from '../../../src/game/physics';
import { calendarEra } from '../../../src/game/fate';
import { scorched } from '../../../src/game/sim/flare';
import { endTurn } from '../../../src/game/sim/turn';
import type { Body, GameState, StarSystem } from '../../../src/game/types';
import { check, done } from '../lib';

const same = (a: Body, b: Body) => JSON.stringify({ ...a, colonyId: null }) === JSON.stringify({ ...b, colonyId: null });

// new galaxies: the flare before turn 1
{
  let hit = 0;
  let dead = 0;
  let wrong = 0;
  let other = 0;
  let stars = 0;
  for (const seed of [1000, 2000, 3000, 4000, 5000, 6000]) {
    const opts = { seed, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' } as const;
    const pre = generateWorld({ ...DEFAULT_SETTINGS, ...opts });
    frozenFromTheStart(pre);
    waterFromTheStart(pre);
    const s = newGame(opts);
    for (const id of Object.keys(pre.systems)) if (JSON.stringify(pre.systems[id]) !== JSON.stringify(s.systems[id])) stars++;
    for (const [id, a] of Object.entries(pre.bodies)) {
      const b = s.bodies[id];
      const p = pre.systems[a.systemId].primary;
      const hot = a.vitality > 0 && scorched(pre, a) && p.blueAt !== undefined && p.whiteAt !== undefined;
      if (!hot) {
        if (!same(a, b)) other++;
        continue;
      }
      hit++;
      const share = Math.max(0, Math.min(1, (pre.years - p.blueAt!) / (p.whiteAt! - p.blueAt!)));
      const want: Body = { ...a, vitality: Math.max(0, a.vitality - 0.6 * share), water: a.water ? a.water * (1 - 0.9 * share) : a.water };
      if (want.vitality <= 0) {
        dead++;
        if (SURFACE_LIFE.includes(a.kind)) Object.assign(want, { kind: 'barren', habitability: 0, traits: a.traits.includes('once_alive') ? a.traits : [...a.traits, 'once_alive'] });
      }
      if (!same(want, b)) wrong++;
    }
  }
  check(hit >= 10 && wrong === 0, `six galaxies: ${hit} living worlds a flare under way has scorched start as the flare so far leaves them`);
  check(dead >= hit - 3, `${dead} of them start dead (most such flares are well on)`);
  check(other === 0 && stars === 0, `every other world and every star as generated and sorted by water (${other}, ${stars})`);
}

// one turn, two worlds made by hand
{
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  const free = (id: string) => !s.bodies[id].colonyId && s.bodies[id].kind !== 'deep';
  const reds = Object.values(s.systems).filter((x) => x.special !== 'home' && x.primary.kind === 'red_dwarf' && x.bodies.some(free));
  // an ice-shelled ocean with life under its ice, where its star's light alone gives it k kelvin
  const ocean = (sys: StarSystem, k: number): Body => {
    const proto = s.bodies[sys.bodies.find(free)!];
    const L = primaryLuminosity(sys.primary, s.years, calendarEra(s), decayWarmth(s));
    const b: Body = { ...proto, kind: 'ocean_ice', water: 0.97, habitability: 0.15, vitality: 0.12, decline: 0, coreHeat: 0, rogue: false, dissolved: false, colonyId: null, traits: ['tidally_locked', 'subsurface_ocean', 'water_rich'], orbitAU: Math.pow((278 * Math.pow(L, 0.25) * Math.pow(0.7, 0.25)) / k, 2) };
    s.bodies[b.id] = b;
    s.civ.known[sys.id] = 2;
    return b;
  };
  // past the locked limit under a steady red dwarf: a steam world
  const steam = ocean(reds[0], 400);
  // dry on its day side, ice and an ocean on its night side, in a flare: a twilight sea
  const flaring = reds[1];
  flaring.primary.kind = 'blue_dwarf';
  flaring.primary.blueAt = s.years - 1e9;
  flaring.primary.whiteAt = s.years + 1e9;
  const twilight = ocean(flaring, 299);
  const c = bodyClimate(s, twilight);
  check(steamWorld(s, steam) && steam.vitality > 0, `${steam.name}, with life under its ice, made a steam world (${Math.round(bodyClimate(s, steam).mean)} K)`);
  check(!steamWorld(s, twilight) && !scorched(s, twilight) && c.day! >= 373 && c.night! < 273, `${twilight.name}, in a flare: its day side ${Math.round(c.day!)} K, its night side ${Math.round(c.night!)} K under ice`);
  const was = twilight.vitality;
  const logged = s.log.length;
  endTurn(s);
  const said = s.log.slice(logged - 1).some((e) => e.text === `Nothing lives on ${steam.name} now: its seas have boiled into a sky of steam.`);
  check(s.bodies[steam.id].vitality === 0 && said, `the turn ends: nothing lives on ${steam.name}, and the Record says so`);
  check(s.bodies[twilight.id].vitality === was, `${twilight.name} keeps its life (${Math.round(was * 100)}%) under its night-side ice`);
}

// the start passes take no random draw: the same seed starts the same galaxy
{
  const s = newGame({ seed: 3000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' }) as GameState;
  const again = newGame({ seed: 3000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  check(JSON.stringify(s.bodies) === JSON.stringify(again.bodies), 'the same seed starts the same galaxy, scorched the same way');
}
done('SCORCH');
