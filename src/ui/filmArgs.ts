import { heartMassOf, type FilmArgs } from '../film/films';
import { calendarEra, fateOf } from '../game/fate';
import { curvatureWarmth, decayWarmth, haloDrawn, isStarLike, primaryTemperature } from '../game/physics';
import { colonies } from '../game/sim/util';
import type { GameState } from '../game/types';

/**
 * What a film is told of the game it is shown in: the fate of matter and the Heart's mass, as
 * before; and since 3 Nov, for a game begun in the Twilight Interregnum (the player: the Long Dusk's
 * film "shows you having a home world around the red dwarf, even though at that time, if you
 * started at 1 trillion years, your home world would be long gone. You would be living on colony
 * worlds"), that cut of the Long Dusk's film: the star we were born under, a white dwarf by then,
 * its temperature as the game has it; and whether a settlement of ours is still on our first world.
 * (Here, not in films.ts: the films' painter thread loads films.ts and need not load the physics.)
 */
export function filmArgsOf(s: GameState | null | undefined): FilmArgs {
  if (!s) return {};
  const args: FilmArgs = { fate: fateOf(s), heartMass: heartMassOf(s) };
  if (!s.settings.interregnum) return args;
  args.begun = 'interregnum';
  const home = s.systems[s.civ.homeSystemId];
  if (home && !isStarLike(home.primary)) args.homeK = primaryTemperature(home.primary, s.years, calendarEra(s), decayWarmth(s), curvatureWarmth(s), haloDrawn(s));
  args.homeLit = colonies(s).some((c) => c.systemId === s.civ.homeSystemId && !!s.bodies[c.bodyId]?.traits.includes('homeworld'));
  return args;
}
