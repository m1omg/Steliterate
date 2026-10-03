import { EVENT_BY_ID, EVENTS } from '../data/events';
import type { GameState } from '../types';
import { log, uid, withRng } from './util';

export function queueEvent(state: GameState, defId: string, data: Record<string, string | number> = {}) {
  const def = EVENT_BY_ID[defId];
  if (!def) return;
  if (def.once && state.fired[defId]) return;
  if (state.pending.some((p) => p.defId === defId && JSON.stringify(p.data) === JSON.stringify(data))) return;
  state.pending.push({ uid: uid(state, 'ev'), defId, data });
  if (def.once) state.fired[defId] = state.turn;
}

/** Maybe fire one random event from the pool this turn. */
export function rollRandomEvent(state: GameState) {
  if (state.pending.length > 1) return;
  withRng(state, (rng) => {
    if (!rng.chance(0.22)) return;
    const pool: { id: string; w: number; data: Record<string, string | number> }[] = [];
    for (const e of EVENTS) {
      if (!e.weight) continue;
      if (e.eras && !e.eras.includes(state.era)) continue;
      if (e.once && state.fired[e.id]) continue;
      if ((state.fired[`last_${e.id}`] ?? -99) > state.turn - 12) continue;
      const data = e.bind ? e.bind(state, rng) : {};
      if (!data) continue;
      pool.push({ id: e.id, w: e.weight, data });
    }
    if (!pool.length) return;
    const pick = rng.weighted(pool, (p) => p.w);
    state.fired[`last_${pick.id}`] = state.turn;
    queueEvent(state, pick.id, pick.data);
  });
}

/** Apply a choice. Returns the outcome text (if any) or an error. */
export function resolveEvent(state: GameState, eventUid: string, choiceIndex: number): { ok: boolean; text?: string } {
  const idx = state.pending.findIndex((p) => p.uid === eventUid);
  if (idx < 0) return { ok: false, text: 'That moment has passed.' };
  const p = state.pending[idx];
  const def = EVENT_BY_ID[p.defId];
  if (!def) {
    state.pending.splice(idx, 1);
    return { ok: true };
  }
  const choice = def.choices[choiceIndex];
  if (!choice) return { ok: false, text: 'No such choice.' };
  if (choice.ok && !choice.ok(state, p.data)) return { ok: false, text: 'That is not possible now.' };
  const out = withRng(state, (rng) => choice.run(state, p.data, rng));
  state.pending.splice(idx, 1);
  // name the star the event was about, and let the entry show it
  const sys = p.data.systemId !== undefined ? state.systems[String(p.data.systemId)] : undefined;
  log(state, `${def.title}${sys ? ` (${sys.name})` : ''}: ${choice.label}.`, 'event', sys?.id);
  // remember what we chose at a discovery, so its report can be read again with the world
  const at = p.data.bodyId !== undefined ? state.bodies[String(p.data.bodyId)] : undefined;
  if (at && /^(relic|anom)_/.test(p.defId)) (at.lore ??= {})[p.defId] = choice.label;
  return { ok: true, text: typeof out === 'string' ? out : undefined };
}
