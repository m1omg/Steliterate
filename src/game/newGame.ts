import { generateWorld } from './gen';
import { createColony, newFleet } from './sim/fleets';
import { updateForecasts } from './sim/forecast';
import { log } from './sim/util';
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
  const state = generateWorld(settings);
  const home = state.systems[state.civ.homeSystemId];
  const hw = home.bodies.map((id) => state.bodies[id]).find((b) => b.traits.includes('homeworld'))!;
  const c = createColony(state, hw, { kin: 8 });
  c.name = hw.name;
  c.structures = { solar_array: 1, geothermal_tap: 1, mine: 2, archive_spire: 1, shipyard: 1, commons: 1 };
  state.civ.capitalId = c.id;
  newFleet(state, home.id, ['probe'], 'Pathfinder');
  newFleet(state, home.id, ['probe'], 'Lamplighter');
  log(state, `${settings.civName}. ${hw.name}, the last living world of ${home.name}. The long dusk begins.`, 'era');
  updateForecasts(state);
  return state;
}
