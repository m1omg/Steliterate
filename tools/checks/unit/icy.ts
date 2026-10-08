// New galaxies sort their icy worlds by the water they formed with (waterFromTheStart, after
// generation). The water-rich (ice-shelled oceans, and ice worlds with half their surface or more
// under water) keep it, marked water_rich; past the runaway greenhouse their seas are a sky of steam
// that holds the ground at 1,500 K by night as by day, and when the light falls below the limit it
// rains out again. The water-poor that are not frozen even on their warmest ground
// start as bare rock, with bare rock's figures; the water-poor and frozen stay ice. Nothing else
// changes: every other world, and every star, is as generation made it, with the same random draws.
// The home system keeps its fixed layout. Old saves have no water-rich worlds, and their climates
// are as before.
import { generateWorld } from '../../../src/game/gen';
import { DEFAULT_SETTINGS, newGame } from '../../../src/game/newGame';
import { ICE_MELTS_K, NO_TERRAFORMING, RUNAWAY_K, RUNAWAY_LOCKED_K, STEAM_K, WATER_RICH, bodyClimate, decayWarmth, frozenFromTheStart, primaryLuminosity, starClimate, steamWorld, waterState } from '../../../src/game/physics';
import { calendarEra } from '../../../src/game/fate';
import type { GameState } from '../../../src/game/types';
import { bodyKindName } from '../../../src/ui/labels';
import { ANOMALIES } from '../../../src/game/data/events';
import { check, done, loadSave } from '../lib';

const clone = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;
const ICY_FINDS = ANOMALIES.filter((a) => ['vent_life', 'clathrates', 'fossils'].includes(a.id));
let rich = 0;
let richWrong = 0;
let dried = 0;
let badRock = 0;
let otherChanged = 0;
let starsChanged = 0;
let warmPoor = 0;
let homeKept = 0;
let steam = 0;
let steamWrong = 0;
let example: { s: GameState; id: string } | null = null;
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
      if (a.kind !== 'ice' || (a.water ?? 0) >= WATER_RICH || b.richness < 1 || b.richness > 1.7 || (b.water ?? 0) > 0.01 || b.traits.includes('subsurface_ocean') || JSON.stringify(others) !== JSON.stringify({ ...b, colonyId: null })) badRock++;
    } else if ((a.kind === 'ice' || a.kind === 'ocean_ice') && b.traits.includes('water_rich')) {
      rich++;
      // nothing but the mark
      if (JSON.stringify({ ...a, traits: [...a.traits, 'water_rich'], colonyId: null }) !== JSON.stringify({ ...b, colonyId: null }) || !(a.kind === 'ocean_ice' || (a.water ?? 0) >= WATER_RICH)) richWrong++;
    } else otherChanged++;
  }
  for (const id of Object.keys(before.systems)) if (JSON.stringify(before.systems[id]) !== JSON.stringify(s.systems[id])) starsChanged++;
  for (const b of Object.values(s.bodies)) {
    if (b.kind !== 'ice' && b.kind !== 'ocean_ice') continue;
    const sys = s.systems[b.systemId];
    if (sys.special === 'home') {
      homeKept++;
      if (b.traits.includes('water_rich')) richWrong++;
      continue;
    }
    // the water-poor left as ice are frozen (a flaring star judged by its light before)
    if (!b.traits.includes('water_rich')) {
      const lum = sys.primary.kind === 'blue_dwarf' ? primaryLuminosity({ ...sys.primary, kind: 'red_dwarf' }, s.years, calendarEra(s), decayWarmth(s)) : undefined;
      const c = lum === undefined ? bodyClimate(s, b) : starClimate(s, b, lum, NO_TERRAFORMING);
      if ((c.day ?? c.mean) >= ICE_MELTS_K) warmPoor++;
      continue;
    }
    // a water-rich world is a steam world exactly when starlight alone would take it past the limit
    const locked = b.traits.includes('tidally_locked');
    const plain = starClimate(s, { ...b, traits: b.traits.filter((t) => t !== 'water_rich') }, undefined, NO_TERRAFORMING).mean;
    const past = !b.rogue && plain >= (locked ? RUNAWAY_LOCKED_K : RUNAWAY_K);
    const c = bodyClimate(s, b);
    if (past) {
      steam++;
      const even = c.mean >= STEAM_K && (c.day === undefined || (c.day === c.mean && c.night === c.mean));
      if (!even || !steamWorld(s, b) || bodyKindName(s, b) !== 'Steam world' || !/steam/.test(waterState(b, c))) steamWrong++;
      // no survey finds of ice, of an ocean under it, or of dried seas on a steam world
      if (ICY_FINDS.some((a) => a.fits(s, b))) steamWrong++;
      if (!example && locked) example = { s, id: b.id };
    } else if (steamWorld(s, b) || c.mean >= STEAM_K) steamWrong++;
  }
}
check(rich > 50 && richWrong === 0, `four galaxies: ${rich} water-rich icy worlds keep their water, marked and otherwise as generated (the home system unmarked)`);
check(dried > 10 && badRock === 0, `${dried} water-poor ones not frozen at their warmest start as bare rock, with bare rock’s figures`);
check(warmPoor === 0, 'no water-poor ice world is left warm at its warmest');
check(otherChanged === 0 && starsChanged === 0, `every other world and every star as generated (${otherChanged}, ${starsChanged})`);
check(homeKept >= 4, `the home system keeps its icy worlds (${homeKept})`);
check(ICY_FINDS.length === 3 && steam > 5 && steamWrong === 0, `${steam} water-rich worlds past the runaway limit are steam worlds (${STEAM_K} K by night as by day, named so, with no finds of ice or buried seas), and only they`);

// less light, below the limit: the steam rains out (moved ten times farther out, a hundredth of the light)
if (example) {
  const s = clone(example.s);
  const b = s.bodies[example.id];
  const was = bodyClimate(s, b);
  b.orbitAU *= 10;
  const now = bodyClimate(s, b);
  check(!steamWorld(s, b) && now.mean < STEAM_K && bodyKindName(s, b) !== 'Steam world', `${b.name}: ${Math.round(was.mean)} K; with a hundredth of the light, ${Math.round(now.mean)} K and ${bodyKindName(s, b)}`);
} else check(false, 'a locked steam world to try');

// old saves: no water-rich worlds, climates as before
{
  let worlds = 0;
  let marked = 0;
  let changed = 0;
  for (const name of ['4fe2404-seed1000-turn87-clock.json.gz', '551fb1a-seed24757-turn71.json.gz', '9eea773-seed1000-turn120-giant.json.gz']) {
    const s = loadSave(name);
    for (const b of Object.values(s.bodies)) {
      worlds++;
      if (b.traits.includes('water_rich')) marked++;
      if (bodyClimate(s, b).mean >= STEAM_K && (b.kind === 'ice' || b.kind === 'ocean_ice') && bodyKindName(s, b) === 'Steam world' && steamWorld(s, b)) changed++;
    }
  }
  check(marked === 0 && changed === 0, `old saves: ${worlds} worlds, none water-rich, no steam skies`);
}
done('ICY');
