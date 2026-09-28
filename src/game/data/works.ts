import type { EraId } from '../types';

// Great Works: the projects that can end the game in something other than silence.

export interface WorkDef {
  id: string;
  name: string;
  ending: string;
  path: string;
  eras: EraId[];
  tech: string;
  cost: number; // insight
  energy: number; // one-off at start
  requirement: string; // shown in the UI; checked in sim/endings.ts
  maxTaint: number;
  epilogue: string;
}

export const WORKS: WorkDef[] = [
  {
    id: 'hibernal_cascade',
    name: 'The Hibernal Cascade',
    ending: 'The Long Thought',
    path: 'Continuance',
    eras: ['dark'],
    tech: 'asymptotic_mind',
    cost: 1500,
    energy: 220,
    requirement: 'Echoes and Coldminds together number at least 6.',
    maxTaint: 59,
    epilogue:
      'You slow until each thought takes longer than the one before, and you sleep between them for longer still. With a finite store and an endless night, the sum still grows. Whether it grows forever, no one in the universe is left to check. You keep thinking.',
  },
  {
    id: 'confluence',
    name: 'Confluence',
    ending: 'One Voice',
    path: 'Union',
    eras: ['blackhole', 'dark'],
    tech: 'total_confluence',
    cost: 1500,
    energy: 150,
    requirement: 'The Chorus is at least half of everyone, and every Thread’s standing is at least 55.',
    maxTaint: 29,
    epilogue:
      'The Threads braid into one. There is no one left to disagree, and the one who remains remembers every argument fondly. A single mind costs less than a crowd, and it faces the dark with every memory the crowd ever had.',
  },
  {
    id: 'archive_of_everything',
    name: 'The Archive of Everything',
    ending: 'The Quiet Lattice',
    path: 'Persistence, kept by the machines',
    eras: ['blackhole', 'dark'],
    tech: 'archive_theory',
    cost: 1500,
    energy: 150,
    requirement: 'The Lattice is at least half of everyone.',
    maxTaint: 59,
    epilogue:
      'The last of the others finish writing, and let go. What remains keeps the record: every face, every argument, every star you saw. It maintains itself and repairs itself, and as far as anyone knew, nobody reads it. Now and then, in the maintenance logs, a record is opened that nothing asked for. It is not you. It is everything you were, kept.',
  },
  {
    id: 'aeon_seed',
    name: 'The Aeon Seed',
    ending: 'The Aeon Seed',
    path: 'Speculative physics',
    eras: ['blackhole'],
    tech: 'conformal_mathematics',
    cost: 1700,
    energy: 300,
    requirement: 'A settlement at the Heart, and the Slow Ones’ trust. The seed is written when the Heart evaporates.',
    maxTaint: 29,
    epilogue:
      'When the Heart finally evaporates, its last light carries a pattern out to where scale stops meaning anything. If Penrose was right, the end of this universe is the beginning of the next, and something you wrote is waiting in its first light.',
  },
  {
    id: 'garden_of_embers',
    name: 'The Garden of Embers',
    ending: 'The Last Garden',
    path: 'Biology',
    eras: ['dark'],
    tech: 'garden_of_embers',
    cost: 1200,
    energy: 200,
    requirement: 'Protons are stable, and at least 6 living Kin (awake or in Cold Sleep) remain.',
    maxTaint: 29,
    epilogue:
      'In a frozen universe of stable iron and cold light, you wake the Kin and grow a garden around the last warmth you saved. A few thousand years of green, then sleep, then green again. It is small, and it is alive.',
  },
];

export const WORK_BY_ID: Record<string, WorkDef> = Object.fromEntries(WORKS.map((w) => [w.id, w]));

export const DARK_ENDING = {
  ending: 'The Hunger',
  epilogue:
    'There is no one left inside to notice when it happens. The swarms that were once your people move from ember to ember, eating what light is left, and will outlast everything, including the time everything had left. It was survival. It worked.',
};

export const ENDURANCE_ENDING = {
  ending: 'Recurrence',
  epilogue:
    'You outlasted every source, every bound atom, every clock. In a universe this old, given enough time, any state comes around again. You are still here to see it.',
};
