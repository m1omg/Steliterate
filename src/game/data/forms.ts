import type { ColonyForm, ThreadId } from '../types';

/**
 * What a settlement is made of (the new version, part 3): the form decides who can live there.
 * Matter, as every settlement is until the end of matter; leptonic, for what goes on after it, on
 * decay-proof substrate (all of it speculation, and the Codex says so).
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

export const FORMS: Record<ColonyForm, FormDef> = {
  baryonic: { id: 'baryonic', name: 'Matter', desc: 'Made of atoms, as everything has always been: it lasts as long as matter does.', lives: ['kin', 'echoes', 'chorus', 'lattice', 'coldminds'], sleepers: true },
  leptonic: {
    id: 'leptonic',
    name: 'Leptonic',
    desc: 'Speculative: minds and works re-encoded in electron–positron structures held by fields, which outlast ordinary matter. Echoes, Coldminds, the Lattice and the Chorus can live here. Kin are made of matter, and cannot, awake or asleep.',
    lives: ['echoes', 'chorus', 'lattice', 'coldminds'],
    sleepers: false,
  },
};
