import type { EpochLength, EraId, GameState } from './types';

export interface EraDef {
  id: EraId;
  index: number;
  numeral: string;
  name: string;
  science: string;
  etaStart: number;
  etaEnd: number;
  startYears: number;
  logL0: number; // log10 of the first turn's length in years
  step: Record<EpochLength, number>; // log10 growth of turn length per turn
  accent: string;
  accentSoft: string;
  ink: string;
  intro: string;
}

export const ERAS: EraDef[] = [
  {
    id: 'dusk',
    index: 0,
    numeral: 'I',
    name: 'The Long Dusk',
    science: 'Late Stelliferous Era',
    etaStart: 13.954,
    etaEnd: 14,
    startYears: 9.0e13,
    logL0: 1.6,
    step: { brief: 0.14, standard: 0.105, vast: 0.08 },
    accent: '#f28a4f',
    accentSoft: '#ffb77a',
    ink: '#efe4d6',
    intro:
      'Ninety trillion years after the first light, the galaxy has run out of gas to make new stars. Only the smallest red dwarfs still burn, and they are near the end of their fuel. Your world circles one of them. Its core is cooling and its magnetic field is failing, and the star’s wind has begun to strip the air away.',
  },
  {
    id: 'degenerate',
    index: 1,
    numeral: 'II',
    name: 'The Degenerate Age',
    science: 'Degenerate Era',
    etaStart: 15,
    etaEnd: 39,
    startYears: 1e15,
    logL0: 9,
    step: { brief: 0.65, standard: 0.45, vast: 0.33 },
    accent: '#93c4ff',
    accentSoft: '#cfe3ff',
    ink: '#e3e9f2',
    intro:
      'The last stars are gone. What remains are their corpses: white dwarfs kept faintly warm by dark matter falling into them, brown dwarfs that never ignited, neutron stars, and black holes. Every few ages two brown dwarfs collide and a new star burns briefly. The galaxy has begun to throw its remnants out into the void, and the protons themselves may not last.',
  },
  {
    id: 'blackhole',
    index: 2,
    numeral: 'III',
    name: 'The Black Hole Age',
    science: 'Black Hole Era',
    etaStart: 40,
    etaEnd: 100,
    startYears: 1e40,
    logL0: 39.3,
    step: { brief: 1.5, standard: 1.1, vast: 0.8 },
    accent: '#a48dff',
    accentSoft: '#d2c6ff',
    ink: '#e6e2f2',
    intro:
      'Ordinary matter has decayed away. Planets, white dwarfs and neutron stars have dissolved into radiation and a thin haze of electrons and positrons. Only the black holes remain. They spin, and they very slowly evaporate. Whatever you are now, you live around them.',
  },
  {
    id: 'dark',
    index: 3,
    numeral: 'IV',
    name: 'The Dark Era',
    science: 'Dark Era',
    etaStart: 100,
    etaEnd: 141,
    startYears: 1e100,
    logL0: 99.5,
    step: { brief: 2.4, standard: 1.8, vast: 1.3 },
    accent: '#9aa3b0',
    accentSoft: '#c9ced6',
    ink: '#dcdfe4',
    intro:
      'The last black hole has evaporated. There are no more sources, only what you saved. Photons stretched longer than galaxies once were, and positronium atoms wider than the old observable universe, drift through the dark. Every thought now draws on a reserve that will never refill.',
  },
];

export const ERA_BY_ID: Record<EraId, EraDef> = Object.fromEntries(ERAS.map((e) => [e.id, e])) as Record<EraId, EraDef>;

export function nextEra(id: EraId): EraId | null {
  const i = ERA_BY_ID[id].index;
  return i < ERAS.length - 1 ? ERAS[i + 1].id : null;
}

/** Length of the coming turn in years. */
export function turnLengthFor(era: EraId, eraTurn: number, length: EpochLength): number {
  const def = ERA_BY_ID[era];
  return Math.pow(10, def.logL0 + def.step[length] * eraTurn);
}

export function eta(years: number): number {
  return Math.log10(Math.max(1, years));
}

/** Where the era should end (cosmic years). */
export function eraEndYears(era: EraId): number {
  return Math.pow(10, ERA_BY_ID[era].etaEnd);
}

/** Approximate number of turns an era lasts at a given epoch length (for UI previews). */
export function estimateEraTurns(era: EraId, length: EpochLength): number {
  const def = ERA_BY_ID[era];
  let years = def.startYears;
  const end = eraEndYears(era);
  let n = 0;
  while (years < end && n < 2000) {
    years += turnLengthFor(era, n, length);
    n++;
  }
  return n;
}

// ------------------------------------------------------------ formatting

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '.': '·', '-': '⁻' };

export function sup(n: number | string): string {
  return String(n)
    .split('')
    .map((c) => SUP[c] ?? c)
    .join('');
}

function trimNum(x: number, digits: number): string {
  return x.toLocaleString('en-US', { maximumFractionDigits: digits });
}

/** "40 years", "3,200 years", "12.4 million years", "10²⁷·³ years" */
export function formatYears(y: number): string {
  if (!isFinite(y)) return '∞';
  if (y < 1e4) return `${trimNum(Math.round(y), 0)} years`;
  if (y < 1e6) return `${trimNum(Math.round(y / 100) * 100, 0)} years`;
  if (y < 1e9) return `${trimNum(y / 1e6, 1)} million years`;
  if (y < 1e12) return `${trimNum(y / 1e9, 1)} billion years`;
  if (y < 1e15) return `${trimNum(y / 1e12, 1)} trillion years`;
  return `10${sup(eta(y).toFixed(1))} years`;
}

export function formatYearsShort(y: number): string {
  if (y < 1e4) return `${Math.round(y)} yr`;
  if (y < 1e6) return `${trimNum(y / 1e3, 0)}k yr`;
  if (y < 1e9) return `${trimNum(y / 1e6, 1)} Myr`;
  if (y < 1e12) return `${trimNum(y / 1e9, 1)} Gyr`;
  if (y < 1e15) return `${trimNum(y / 1e12, 1)} Tyr`;
  return `10${sup(eta(y).toFixed(1))} yr`;
}

/** η with enough precision to move visibly in each era. */
export function formatEta(years: number, era: EraId): string {
  const e = eta(years);
  const digits = era === 'dusk' ? 4 : era === 'degenerate' ? 2 : 1;
  return e.toFixed(digits);
}

export function formatDistance(ly: number): string {
  if (ly < 1000) return `${trimNum(ly, ly < 10 ? 1 : 0)} ly`;
  if (ly < 1e6) return `${trimNum(ly / 1000, 1)} kly`;
  return `${trimNum(ly / 1e6, 2)} Mly`;
}

// ------------------------------------------------------------ chronometer milestones

export interface Milestone {
  eta: number;
  label: string;
  detail: string;
}

export const MILESTONES: Milestone[] = [
  { eta: 14, label: 'Last Light', detail: 'The last ordinary stars leave the main sequence; star formation ends.' },
  { eta: 15, label: 'Stripped worlds', detail: 'Close stellar encounters have torn most planets from their stars.' },
  { eta: 19.5, label: 'Galactic evaporation', detail: 'Most remnants are flung out of their galaxies; a minority falls into the central black hole.' },
  { eta: 23, label: 'Brown-dwarf stars end', detail: 'Collisions between brown dwarfs stop lighting new stars.' },
  { eta: 25, label: 'Embers fade', detail: 'The dark-matter halo is depleted; white dwarfs stop being heated by WIMP annihilation.' },
  { eta: 37, label: 'Proton decay?', detail: 'If protons decay (lifetime unknown, >10³⁴ years), ordinary matter dissolves by η ≈ 39.' },
  { eta: 69, label: 'Stellar holes evaporate', detail: 'Black holes of a few to tens of solar masses finish evaporating by Hawking radiation.' },
  { eta: 83, label: 'Million-sun holes', detail: 'Black holes of 10⁶ solar masses evaporate.' },
  { eta: 85, label: 'Positronium forms', detail: 'Electrons and positrons pair into atoms larger than today’s observable universe.' },
  { eta: 99, label: 'Last Horizon', detail: 'Galaxy-sized black holes evaporate. The Black Hole Era ends.' },
  { eta: 141, label: 'Positronium decays', detail: 'The last bound structures annihilate into photons.' },
];

export function currentEraDef(state: GameState): EraDef {
  return ERA_BY_ID[state.era];
}
