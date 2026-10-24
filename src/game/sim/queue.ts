import { SHIP_BY_ID } from '../data/ships';
import { STRUCTURE_BY_ID, dismantledKey, structureLabel } from '../data/structures';
import type { Colony, GameState, QueueItem } from '../types';
import { newFleet } from './fleets';
import { WORKS_WATER } from './terraform';
import { log } from './util';

/**
 * A queued project is finished (already off the queue): a building stands, with what it does
 * once; a ship leaves the slips. At the turn's end when the work is put in (turn.ts,
 * applyIndustry), and at once when it is rushed (actions.ts, rushBuild).
 */
export function finishQueued(state: GameState, c: Colony, item: QueueItem) {
  if (item.kind === 'structure') {
    const d = STRUCTURE_BY_ID[item.key];
    c.structures[item.key] = (c.structures[item.key] ?? 0) + 1;
    // what a building does once, it does the first time: one taken apart here and built again does not repeat it
    const again = dismantledKey(c.id, item.key);
    if ((state.civ.flags[again] ?? 0) > 0) {
      state.civ.flags[again]--;
      if (state.civ.flags[again] <= 0) delete state.civ.flags[again];
    } else {
      if (d?.vitalityOnce) {
        const b = state.bodies[c.bodyId];
        b.vitality = Math.min(1, b.vitality + d.vitalityOnce);
      }
      if (d?.coreHeatBonus) {
        const b = state.bodies[c.bodyId];
        b.coreHeat = Math.min(1, b.coreHeat + d.coreHeatBonus);
      }
      // the volatiles steered in to build the air bring water with them
      if (d?.terraform === 'works') {
        const b = state.bodies[c.bodyId];
        b.water = Math.max(b.water ?? 0, WORKS_WATER);
      }
      if (item.key === 'confluence_node') state.civ.flags.chorus_nodes_built = (state.civ.flags.chorus_nodes_built ?? 0) + 1;
    }
    log(state, `${c.name}: ${item.kind === 'structure' ? structureLabel(item.key, state.systems[c.systemId]).name : d?.name ?? item.key} complete.`, 'good', c.systemId);
  } else {
    const def = SHIP_BY_ID[item.key];
    if (def?.crew) c.pops.kin = Math.max(0, c.pops.kin - def.crew);
    const existing = Object.values(state.fleets).find((f) => f.at === c.systemId && f.order === 'idle' && !f.auto && f.ships.every((s) => s.cls === item.key) && !def?.settles && !def?.survey);
    if (existing) existing.ships.push({ cls: item.key, hp: def?.hp ?? 5 });
    else newFleet(state, c.systemId, [item.key]);
    log(state, `${c.name}: ${def?.name ?? item.key} launched from the slips.`, 'good', c.systemId);
  }
}
