import type { ThreadId } from '../types';

export interface ThreadDef {
  id: ThreadId;
  name: string;
  one: string;
  blurb: string;
  industry: number;
  insight: number;
  accord: number;
  energyUpkeep: number;
  matterUpkeep: number;
  clockMin: number; // log10 years: the fastest this kind of mind can live
  /** how the slowest possible clock is found: fixed, or relative to the Echo limit from research */
  clockMax: { fixed?: number; relative?: number };
  strainImmune?: boolean;
  conscious: boolean;
}

export const THREAD_DEFS: Record<ThreadId, ThreadDef> = {
  kin: {
    id: 'kin',
    name: 'Kin',
    one: 'Kin',
    blurb: 'Biological people: the species born on the homeworld, and any other living beings who have joined you, such as refugees from biological civilizations. They must be fed, warmed and housed, which makes them the most expensive minds to keep alive, and they are the source of most of what the others call meaning.',
    industry: 1.0,
    insight: 0.8,
    accord: 0.6,
    energyUpkeep: 1.0,
    matterUpkeep: 0.1,
    clockMin: 1.6,
    clockMax: { fixed: 1.6 },
    conscious: true,
  },
  echoes: {
    id: 'echoes',
    name: 'Echoes',
    one: 'Echo',
    blurb: 'Uploaded minds running on substrate. Cheap to keep, able to slow their thinking to match the age, and prone to drifting away from the people they were.',
    industry: 0.6,
    insight: 1.5,
    accord: 0.2,
    energyUpkeep: 0.45,
    matterUpkeep: 0,
    clockMin: 0,
    clockMax: { relative: 0 },
    conscious: true,
  },
  chorus: {
    id: 'chorus',
    name: 'Chorus',
    one: 'Chorus',
    blurb: 'Many minds merged into one. Efficient and harmonious within itself; unsettling to everyone outside it. Harder to slow than a single mind.',
    industry: 2.0,
    insight: 1.8,
    accord: 1.0,
    energyUpkeep: 0.9,
    matterUpkeep: 0,
    clockMin: 0.5,
    clockMax: { relative: -1.5 },
    conscious: true,
  },
  lattice: {
    id: 'lattice',
    name: 'Lattice',
    one: 'Lattice',
    blurb: 'Self-maintaining processes. They build, repair and replicate without rest, make no demands, keep no grudges, and wear out. Whether anyone is in there is a question they have never raised.',
    industry: 2.2,
    insight: 0,
    accord: 0,
    energyUpkeep: 0.25,
    matterUpkeep: 0.3,
    clockMin: 0,
    clockMax: { fixed: 999 },
    strainImmune: true,
    conscious: false,
  },
  coldminds: {
    id: 'coldminds',
    name: 'Coldminds',
    one: 'Coldmind',
    blurb: 'Minds held in vaults near absolute zero, thinking one slow thought per age. Almost free to keep, and almost unable to hurry.',
    industry: 0.2,
    insight: 1.0,
    accord: 0.3,
    energyUpkeep: 0.08,
    matterUpkeep: 0,
    clockMin: 4,
    clockMax: { relative: 6 },
    conscious: true,
  },
};

export interface DemandDef {
  id: string;
  thread: ThreadId;
  text: string;
}

export const DEMANDS: DemandDef[] = [
  { id: 'kin_homeworld', thread: 'kin', text: 'Keep the homeworld alive (vitality above 25%)' },
  { id: 'kin_room', thread: 'kin', text: 'Room to live: no Kin settlement over its capacity' },
  { id: 'kin_warmth', thread: 'kin', text: 'No settlement starving for energy' },
  { id: 'echoes_substrate', thread: 'echoes', text: 'Spare substrate: at least 2 free Echo slots' },
  { id: 'echoes_stop', thread: 'echoes', text: 'Enact the Right to Stop' },
  { id: 'echoes_clock', thread: 'echoes', text: 'Let us keep pace: Echo tempo strain below 1' },
  { id: 'chorus_consent', thread: 'chorus', text: 'Enact Merge Consent' },
  { id: 'chorus_grow', thread: 'chorus', text: 'Grow the Chorus: another Confluence Node' },
  { id: 'coldminds_quiet', thread: 'coldminds', text: 'Quiet: no Hearth in overdrive' },
  { id: 'coldminds_reserve', thread: 'coldminds', text: 'Keep the reserve above a third of capacity' },
];
