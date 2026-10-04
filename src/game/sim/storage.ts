import { STRUCTURE_BY_ID } from '../data/structures';
import type { GameState } from '../types';
import type { Mods } from './mods';
import { colonies } from './util';

// How much energy the civilization can hold. Its own module so that flare.ts can read it without
// a cycle through economy.ts (which re-exports it).

/** Storage that holds its charge in a black hole (a Horizon Vault's spin) holds nothing once the hole has evaporated. */
export function storesInHole(state: GameState, systemId: string, id: string): boolean {
  const d = STRUCTURE_BY_ID[id];
  const hole = d?.primaries?.every((k) => k === 'black_hole' || k === 'smbh') ?? false;
  const kind = state.systems[systemId]?.primary.kind;
  return hole && kind !== 'black_hole' && kind !== 'smbh';
}

export function reserveCapacity(state: GameState, mods: Mods): number {
  let cap = 100;
  for (const c of colonies(state)) {
    for (const [id, n] of Object.entries(c.structures)) {
      const d = STRUCTURE_BY_ID[id];
      if (!d || !n || storesInHole(state, c.systemId, id)) continue;
      cap += ((d.reserveCap ?? 0) + (d.burstCap ?? 0)) * n;
    }
  }
  return cap * mods.reserveMult;
}
