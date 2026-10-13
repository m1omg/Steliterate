import type { ColonyForm, ThreadId } from '../types';

/**
 * What a settlement is made of (the new version, part 3): the form decides who can live there.
 * Matter, as every settlement is until the end of matter; leptonic, for what goes on after it, on
 * decay-proof substrate; horizon, written into a black hole's horizon (part 3-4). All of it after
 * matter is speculation, and the Codex says so.
 */
export interface FormDef {
  id: ColonyForm;
  name: string;
  desc: string;
  /** Who can live there: the others have no room at all. */
  lives: readonly ThreadId[];
  /** Whether Kin can sleep there. */
  sleepers: boolean;
}

/** In the horizon a mind's upkeep is this share of what it was, and its pace (a turn's work) this share. */
export const HORIZON_UPKEEP = 0.1;
export const HORIZON_PACE = 0.25;
/** Room in a hole's horizon for each Thread that can live there: this much for each decade of its mass in Suns, and this much more. */
export const HORIZON_ROOM = 6;

/** The room in this hole's horizon for each Thread that can live there (none but at a black hole). */
export function horizonRoom(p: { kind: string; mass: number }): number {
  if (p.kind !== 'black_hole' && p.kind !== 'smbh') return 0;
  return Math.round(HORIZON_ROOM * (1 + Math.log10(Math.max(1, p.mass))));
}

export const FORMS: Record<ColonyForm, FormDef> = {
  baryonic: { id: 'baryonic', name: 'Matter', desc: 'Made of atoms, as everything has always been: it lasts as long as matter does.', lives: ['kin', 'echoes', 'chorus', 'lattice', 'coldminds'], sleepers: true },
  leptonic: {
    id: 'leptonic',
    name: 'Leptonic',
    desc: 'Speculative: minds and works re-encoded in electron–positron structures held by fields, which outlast ordinary matter. Echoes, Coldminds, the Lattice and the Chorus can live here. Kin are made of matter, and cannot, awake or asleep.',
    lives: ['echoes', 'chorus', 'lattice', 'coldminds'],
    sleepers: false,
  },
  horizon: {
    id: 'horizon',
    name: 'Horizon',
    desc: 'Speculative: minds written into a black hole’s horizon, which holds more than anything else its size, where time runs slowest. They cost a tenth of their upkeep and think at a quarter of their pace, with room by the hole’s mass. Bound to the hole: when it evaporates they are written back out, leptonic.',
    lives: ['echoes', 'chorus', 'lattice', 'coldminds'],
    sleepers: false,
  },
};
