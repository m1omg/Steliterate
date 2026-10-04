import { Rng } from './rng';

// Names for a universe that has had ninety trillion years to accumulate them:
// soft proper names for the places people cared about, catalogue codes for the rest.

const ONSETS = ['v', 'th', 's', 'm', 'r', 'l', 'k', 'n', 'c', 'd', 'h', 'or', 'al', 'es', 'y', 'qu', 'tr', 'sil', 'mer', 'cal', 'ish', 'an', 'ul', 'ev'];
const NUCLEI = ['a', 'e', 'i', 'o', 'u', 'ae', 'ei', 'ia', 'ou', 'y', 'io'];
const CODAS = ['', '', 'n', 'l', 'r', 's', 'th', 'm', 'x', 'nd', 'rn', 'sh', 'l', 'n'];
const ENDINGS = ['', '', '', 'a', 'on', 'is', 'el', 'ar', 'ine', 'eth', 'ys', 'um', 'orr', 'wyn', 'ai'];

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function properName(rng: Rng, syllables = rng.int(2, 3)): string {
  let out = '';
  for (let i = 0; i < syllables; i++) {
    out += (i === 0 || rng.chance(0.7) ? rng.pick(ONSETS) : '') + rng.pick(NUCLEI) + (i === syllables - 1 ? rng.pick(CODAS) : '');
  }
  if (out.length < 5) out += rng.pick(ENDINGS);
  out = out.replace(/(.)\1\1/g, '$1$1');
  return cap(out.slice(0, 11));
}

export function catalogueName(rng: Rng, kind: string): string {
  const n = rng.int(100, 9999);
  const suffix = rng.chance(0.4) ? '-' + String.fromCharCode(97 + rng.int(0, 5)) : '';
  switch (kind) {
    case 'white_dwarf':
      return `WD ${n}${suffix}`;
    case 'brown_dwarf':
      return `BD ${rng.int(10, 99)}·${n}`;
    case 'neutron_star':
      return `PSR ${rng.int(1000, 2359)}${rng.chance(0.5) ? '+' : '−'}${rng.int(10, 89)}`;
    case 'black_hole':
      return `BH ${n}`;
    case 'rogue':
      return `Drift ${n}`;
    default:
      return `Cat ${n}`;
  }
}

const REACH_WORDS = ['Reach', 'Drift', 'Shoal', 'Hollow', 'Expanse', 'Verge', 'Deep', 'Strand', 'Mere', 'Barrens'];
export function reachName(rng: Rng): string {
  return `${properName(rng, 2)} ${rng.pick(REACH_WORDS)}`;
}

const GALAXY_WORDS = ['Coalescence', 'Remnant', 'Cloud', 'Tide', 'Veil', 'Ember'];
export function galaxyName(rng: Rng, host: boolean): string {
  if (host) return 'The Coalescence';
  return `The ${properName(rng, 2)} ${rng.pick(GALAXY_WORDS.slice(1))}`;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export function bodyName(systemName: string, index: number): string {
  return `${systemName} ${ROMAN[index] ?? index + 1}`;
}
