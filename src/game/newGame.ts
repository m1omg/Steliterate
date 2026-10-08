import { generateWorld } from './gen';
import { dryFromTheStart, frozenFromTheStart } from './physics';
import { createColony, newFleet } from './sim/fleets';
import { updateForecasts } from './sim/forecast';
import { log, savableName } from './sim/util';
import { SAVE_VERSION } from './save';
import type { GameSettings, GameState } from './types';

export const DEFAULT_SETTINGS: GameSettings = {
  seed: 20260927,
  survivors: 3,
  length: 'standard',
  difficulty: 'standard',
  protonFate: 'unknown',
  civName: 'The Kin of Aster',
  homeName: 'Aster',
};

export function newGame(partial: Partial<GameSettings> = {}): GameState {
  const settings: GameSettings = { ...DEFAULT_SETTINGS, ...partial };
  settings.civName = savableName(settings.civName);
  const state = generateWorld(settings);
  frozenFromTheStart(state);
  dryFromTheStart(state);
  const home = state.systems[state.civ.homeSystemId];
  const hw = home.bodies.map((id) => state.bodies[id]).find((b) => b.traits.includes('homeworld'))!;
  const c = createColony(state, hw, { kin: 8 });
  c.name = hw.name;
  c.structures = { solar_array: 1, geothermal_tap: 1, mine: 2, archive_spire: 1, shipyard: 1, commons: 1 };
  state.civ.capitalId = c.id;
  newFleet(state, home.id, ['probe'], 'Pathfinder');
  newFleet(state, home.id, ['probe'], 'Lamplighter');
  // one old escort, kept on watch over the homeworld: parked, so it does not ask for orders
  newFleet(state, home.id, ['warden'], 'Vigil').order = 'hold';
  log(state, `${settings.civName}. ${hw.name}, the last living world of ${home.name}. The long dusk begins.`, 'era');
  updateForecasts(state);
  state.saveVersion = SAVE_VERSION;
  return state;
}
