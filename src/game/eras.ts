import type { EpochLength, EraId, Fate } from './types';

// Scale follows time. Each era has a natural pace, the Tide: the turn length a civilization
// surviving at that moment would naturally live at. The Tide grows in proportion to the time
// already spent in the era, so cosmic time advances geometrically. The player can quicken
// (shorter turns, more turns while a bright source lasts) or slow down against the Tide.

export interface EraDef {
  id: EraId;
  index: number;
  numeral: string;
  name: string;
  science: string;
  startYears: number;
  endEta: number; // era ends when eta reaches this (dark: log10(eta) reaches it)
  l0: number; // first Tide turn length (years)
  growth: Record<EpochLength, number>; // per-turn growth factor of the Tide
  accent: string;
  accentSoft: string;
  neon: string;
  intro: string;
}

export const ERAS: EraDef[] = [
  {
    id: 'dusk',
    index: 0,
    numeral: 'I',
    name: 'The Long Dusk',
    science: 'Late Stelliferous Era',
    startYears: 9.0e13,
    endEta: 14,
    l0: 40,
    growth: { brief: 1.38, standard: 1.27, vast: 1.2 },
    accent: '#f28a4f',
    accentSoft: '#ffb77a',
    neon: '#4fe3d1',
    intro:
      'Ninety trillion years after the first light, the galaxy has run out of gas to make new stars. Only the smallest red dwarfs still burn, and they are near the end of their fuel. Your world circles one of them. Its core is cooling and its magnetic field is failing, and the star’s wind has begun to strip the air away.',
  },
  {
    id: 'degenerate',
    index: 1,
    numeral: 'II',
    name: 'The Degenerate Age',
    science: 'Degenerate Era',
    startYears: 1e15,
    endEta: 39,
    l0: 1e9,
    growth: { brief: 4.47, standard: 2.82, vast: 2.14 },
    accent: '#93c4ff',
    accentSoft: '#cfe3ff',
    neon: '#ff5fa2',
    intro:
      'The last ordinary stars are gone. What remains are their corpses: white dwarfs kept faintly warm by dark matter falling into them, brown dwarfs that never ignited, neutron stars, and black holes. Now and then two brown dwarfs collide and a small star burns again, or two white dwarfs merge into a brilliant, brief helium star. The galaxy has begun to throw its remnants into the void, and the protons themselves may not last.',
  },
  {
    id: 'blackhole',
    index: 2,
    numeral: 'III',
    name: 'The Black Hole Age',
    science: 'Black Hole Era',
    startYears: 1e40,
    endEta: 100,
    l0: 2e39,
    growth: { brief: 31.6, standard: 12.6, vast: 6.3 },
    accent: '#a48dff',
    accentSoft: '#d2c6ff',
    neon: '#ffb347',
    intro:
      'Ordinary matter has decayed away. Planets, white dwarfs and neutron stars have dissolved into radiation and a thin haze of electrons and positrons. Only the black holes remain. They spin, and they very slowly evaporate. Whatever you are now, you live around them.',
  },
  {
    id: 'dark',
    index: 3,
    numeral: 'IV',
    name: 'The Dark Era',
    science: 'Dark Era',
    startYears: 1e100,
    endEta: 122, // measured on log10(eta): the deep-time ruler
    l0: 0,
    growth: { brief: 0.005, standard: 0.0029, vast: 0.0018 },
    accent: '#9aa3b0',
    accentSoft: '#c9ced6',
    neon: '#7fd8ff',
    intro:
      'The last black hole has evaporated. There are no more sources, only what you saved. Photons stretched longer than galaxies once were, and positronium atoms wider than the old observable universe, drift through the dark. Every thought now draws on a reserve that will never refill, and time itself now passes in powers of powers.',
  },
];

export const ERA_BY_ID: Record<EraId, EraDef> = Object.fromEntries(ERAS.map((e) => [e.id, e])) as Record<EraId, EraDef>;

/** An age's intro, for the fate of matter: the Black Hole Age (and, for stable matter, the Dark) reads differently by fate. */
export function ageIntro(era: EraId, fate: Fate): string {
  if (era === 'blackhole' && fate === 'stable')
    return 'The protons held, and nothing marked the moment: the neutron stars, the last things warm of their own accord, have cooled below the faint glow of the black holes. For the whole life of the universe the holes were the coldest things in it; now they are the warmest. Matter endures, cold and dark, slowly tunnelling toward iron, and the dead stars and worlds are fuel now, not sources. The holes spin, and they very slowly evaporate. Whatever you are now, you live around them.';
  if (era === 'blackhole' && fate === 'curvature')
    return 'The neutron stars have burst. For 10⁶⁸ years each gave its mass, a little at a time, to the curvature of space around it; at a tenth of a Sun it could hold together no longer. They were the last things warm of their own accord. Now the black holes are the warmest things in the universe, and the lightest of them are already bursting too. White dwarfs, brown dwarfs and worlds remain, cold and dark, and space is unmaking them as well, slowly: the dwarfs will fade by η 85, every world by η 90. Whatever you are now, you live around the holes.';
  if (era === 'dark' && fate === 'stable')
    return 'The last black hole has evaporated. There are no more sources, only what you saved. The matter is still here, dead stars and worlds as cold as the sky itself, giving nothing back. Photons stretched longer than galaxies once were drift through the dark. Every thought now draws on a reserve that will never refill, and time itself now passes in powers of powers.';
  return ERA_BY_ID[era].intro;
}

/** The name of the crossing out of an age: the Degenerate Age ends in the Great Decay if protons decay, otherwise at the Last Warmth. */
export function crossingName(from: EraId, fate: Fate): string {
  if (from === 'dusk') return 'The Last Light';
  if (from === 'degenerate') return fate === 'decay' ? 'The Great Decay' : 'The Last Warmth';
  if (from === 'blackhole') return 'The Last Horizon';
  return 'The End';
}

export function nextEra(id: EraId): EraId | null {
  const i = ERA_BY_ID[id].index;
  return i < ERAS.length - 1 ? ERAS[i + 1].id : null;
}

export function eta(years: number): number {
  return Math.log10(Math.max(1, years));
}

/** The natural turn length (years) at a given moment of an era, before pace. */
export function tideLength(era: EraId, years: number, length: EpochLength): number {
  const d = ERA_BY_ID[era];
  if (era === 'dark') return Infinity;
  const elapsed = Math.max(0, years - d.startYears);
  return d.l0 + (d.growth[length] - 1) * elapsed;
}

/** Deep time: the per-turn growth factor of log10(eta) at the Tide. */
function darkLambdaFactor(lambda: number, length: EpochLength): number {
  const a = ERA_BY_ID.dark.growth[length];
  const n = Math.sqrt(Math.max(0, Math.log(Math.max(lambda, 2) / 2)) / a);
  return Math.exp(a * (2 * n + 1));
}

export interface TimeStep {
  years: number;
  eta: number;
  turnLength: number;
}

/** Advance the clock by one turn at the given pace (log10 factor, + = quicker, shorter turns). */
export function stepTime(era: EraId, years: number, etaNow: number, pace: number, length: EpochLength): TimeStep {
  const factor = Math.pow(10, -pace);
  if (era !== 'dark') {
    const L = tideLength(era, years, length) * factor;
    const y = years + L;
    return { years: y, eta: eta(y), turnLength: L };
  }
  const lambda = Math.log10(Math.max(etaNow, 100));
  const g = darkLambdaFactor(lambda, length);
  const nextLambda = Math.min(122.5, lambda * Math.pow(g, Math.min(2, Math.max(0.5, factor))));
  const nextEta = Math.pow(10, nextLambda);
  const y = nextEta < 300 ? Math.pow(10, nextEta) : Infinity;
  const L = isFinite(y) && isFinite(years) ? y - years : Infinity;
  return { years: y, eta: nextEta, turnLength: L };
}

/** log10 of the turn length for tempo maths. In deep time the length is ~10^nextEta. */
export function logTurnLength(step: TimeStep): number {
  if (isFinite(step.turnLength)) return Math.log10(Math.max(1, step.turnLength));
  return step.eta;
}

/** Has the era run its course? */
export function eraOver(era: EraId, etaNow: number): boolean {
  const d = ERA_BY_ID[era];
  if (era === 'dark') return Math.log10(etaNow) >= d.endEta;
  return etaNow >= d.endEta;
}

/** Turns until a cosmic year is reached at the Tide (for forecasts), or Infinity past maxTurns. */
export function turnsUntil(era: EraId, years: number, target: number, length: EpochLength, pace = 0, maxTurns = 400): number {
  if (!isFinite(target)) return Infinity;
  if (target <= years) return 0;
  let y = years;
  let e = eta(years);
  for (let n = 1; n <= maxTurns; n++) {
    const s = stepTime(era, y, e, pace, length);
    y = s.years;
    e = s.eta;
    if (y >= target) return n;
  }
  return Infinity;
}

/** Approximate number of turns an era lasts at the Tide. */
export function estimateEraTurns(era: EraId, length: EpochLength): number {
  const d = ERA_BY_ID[era];
  let y = d.startYears;
  let e = eta(y);
  let n = 0;
  while (!eraOver(era, e) && n < 1000) {
    const s = stepTime(era, y, e, 0, length);
    y = s.years;
    e = s.eta;
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

function num(x: number, digits: number): string {
  return x.toLocaleString('en-US', { maximumFractionDigits: digits });
}

/** Human-readable span of years, valid from decades to powers of powers. */
export function formatYears(y: number, etaHint?: number): string {
  if (!isFinite(y)) {
    const e = etaHint ?? Infinity;
    if (!isFinite(e)) return '∞';
    return `10^(10${sup(Math.log10(e).toFixed(1))}) years`;
  }
  if (y < 1e4) return `${num(Math.round(y), 0)} years`;
  if (y < 1e6) return `${num(Math.round(y / 100) * 100, 0)} years`;
  if (y < 1e9) return `${num(y / 1e6, 1)} million years`;
  if (y < 1e12) return `${num(y / 1e9, 1)} billion years`;
  if (y < 1e15) return `${num(y / 1e12, 1)} trillion years`;
  return `10${sup(eta(y).toFixed(1))} years`;
}

export function formatYearsShort(y: number, etaHint?: number): string {
  if (!isFinite(y)) {
    const e = etaHint ?? Infinity;
    return isFinite(e) ? `10^10${sup(Math.log10(e).toFixed(1))} yr` : '∞';
  }
  if (y < 1e4) return `${Math.round(y)} yr`;
  if (y < 1e6) return `${num(y / 1e3, 0)}k yr`;
  if (y < 1e9) return `${num(y / 1e6, 1)} Myr`;
  if (y < 1e12) return `${num(y / 1e9, 1)} Gyr`;
  if (y < 1e15) return `${num(y / 1e12, 1)} Tyr`;
  return `10${sup(eta(y).toFixed(1))} yr`;
}

/** η with enough precision to move visibly in each era. */
export function formatEta(e: number, era: EraId): string {
  if (e >= 1e4) return `10${sup(Math.log10(e).toFixed(2))}`;
  const digits = era === 'dusk' ? 4 : era === 'degenerate' ? 2 : era === 'blackhole' ? 1 : 1;
  return e.toFixed(digits);
}

export function formatDistance(ly: number): string {
  if (ly < 1000) return `${num(ly, ly < 10 ? 1 : 0)} ly`;
  if (ly < 1e6) return `${num(ly / 1000, 1)} kly`;
  return `${num(ly / 1e6, 2)} Mly`;
}

// ------------------------------------------------------------ chronometer milestones

export interface Milestone {
  at: number; // eta for the main ruler, log10(eta) for the deep ruler
  label: string;
  detail: string;
}

/** Milestones every fate shares. */
const COMMON_MILESTONES: Milestone[] = [
  { at: 14, label: 'Last Light', detail: 'The last ordinary stars leave the main sequence; star formation ends.' },
  { at: 15, label: 'Stripped worlds', detail: 'Close stellar passes have torn most planets from their stars.' },
  { at: 19.5, label: 'Galactic evaporation', detail: 'Most remnants are flung out of the galaxy; a minority falls into the central black hole.' },
  { at: 21, label: 'Last collision stars', detail: 'The galaxy has evaporated: brown dwarfs no longer meet, and no new collision stars light. (Merging white-dwarf pairs need no galaxy and still flare until about η 25.)' },
  { at: 25, label: 'Embers fade', detail: 'The dark-matter halo is spent; white dwarfs are no longer warmed by WIMP annihilation.' },
  { at: 69, label: 'Stellar holes evaporate', detail: 'Black holes of a few to tens of solar masses finish evaporating.' },
  { at: 83, label: 'Million-sun holes', detail: 'Black holes of 10⁶ solar masses evaporate.' },
  { at: 99, label: 'Last Horizon', detail: 'Galaxy-sized black holes evaporate. The Black Hole Era ends.' },
];

/** What each fate of matter adds; `null` is a fate not yet known, whose milestones are questions. */
const FATE_MILESTONES: Record<Fate | 'unknown', Milestone[]> = {
  decay: [
    { at: 37.5, label: 'Proton decay', detail: 'Protons decay in earnest: ordinary matter begins to dissolve.' },
    { at: 39, label: 'The Great Decay', detail: 'Ordinary matter is gone. Only minds on leptonic substrate, and the black holes, remain. The Degenerate Age ends.' },
    { at: 85, label: 'Positronium forms', detail: 'Electrons and positrons pair into atoms larger than today’s observable universe.' },
    { at: 141, label: 'Positronium decays', detail: 'The last bound atoms annihilate into photons.' },
  ],
  stable: [{ at: 30, label: 'The Last Warmth', detail: 'The neutron stars, the last things warm of their own accord, cool below the faint glow of the black holes. The Degenerate Age ends; nothing dissolves.' }],
  curvature: [
    { at: 68, label: 'Neutron stars burst', detail: 'Curvature radiation: at a tenth of a Sun each neutron star bursts. The Degenerate Age ends.' },
    { at: 82, label: 'White dwarfs fade', detail: 'Space has turned their mass into particles: the heaviest are gone near η 78.5, a typical one near 82, the lightest by 85.' },
    { at: 85, label: 'Positronium forms', detail: 'Electrons and positrons pair into atoms larger than today’s observable universe.' },
    { at: 87, label: 'Brown dwarfs fade', detail: 'The brown dwarfs are gone the same way.' },
    { at: 89.5, label: 'The Great Evaporation', detail: 'Every world and every scrap of ordinary matter has evaporated.' },
    { at: 141, label: 'Positronium decays', detail: 'The last bound atoms annihilate into photons.' },
  ],
  unknown: [
    { at: 30, label: 'The Last Warmth?', detail: 'If matter is stable, the Degenerate Age ends about here: the neutron stars cool below the black holes, and nothing else happens.' },
    { at: 37, label: 'Proton decay?', detail: 'If protons decay (lifetime unknown, above 10³⁴ years), ordinary matter dissolves by η ≈ 39.' },
    { at: 68, label: 'Neutron stars burst?', detail: 'If space itself slowly unmakes matter (curvature radiation), the neutron stars burst about here, and the dwarfs and worlds follow by η 90.' },
    { at: 89.5, label: 'Great Evaporation?', detail: 'If curvature radiation is real, the last ordinary matter is gone by about here.' },
  ],
};

/** The milestones on the main ruler, for a fate of matter (null while it is unknown). */
export function milestonesFor(fate: Fate | null): Milestone[] {
  return [...COMMON_MILESTONES, ...FATE_MILESTONES[fate ?? 'unknown']].sort((a, b) => a.at - b.at);
}

/** Today's milestones with the fate unknown (kept for anything that lists them all). */
export const MILESTONES: Milestone[] = milestonesFor(null);

/** Deep-time milestones, on log10(eta). Speculative physics, labelled as such in the Codex. */
export const DEEP_MILESTONES: Milestone[] = [
  { at: Math.log10(141), label: 'Positronium decays', detail: 'η ≈ 141 (Page & McKee), where protons decayed or space unmade matter.' },
  { at: Math.log10(161), label: 'Vacuum decay?', detail: 'One Standard Model estimate puts the vacuum lifetime near 10¹⁶¹ years, with an uncertainty spanning over a thousand orders of magnitude.' },
  { at: Math.log10(1500), label: 'Iron stars', detail: 'If protons are stable, cold fusion by tunnelling turns all matter to iron by about 10¹⁵⁰⁰ years (Dyson 1979).' },
  { at: 26, label: 'Tunnelling collapse', detail: 'If protons are stable, iron stars tunnel into neutron stars and black holes between 10^(10²⁶) and 10^(10⁷⁶) years.' },
  { at: 76, label: 'Last collapse', detail: 'The slowest estimate for matter tunnelling into black holes.' },
  { at: 122, label: 'Recurrence', detail: 'Poincaré recurrence of a de Sitter horizon, about 10^(10¹²²) years: given long enough, any state returns.' },
];

/** The deep-time milestones for a fate: iron and collapse only if matter is stable, positronium only if it is not. */
export function deepMilestonesFor(fate: Fate | null): Milestone[] {
  return DEEP_MILESTONES.filter((m) => {
    if (m.label === 'Iron stars' || m.label === 'Tunnelling collapse' || m.label === 'Last collapse') return fate === 'stable' || fate === null;
    if (m.label === 'Positronium decays') return fate !== 'stable';
    return true;
  });
}
