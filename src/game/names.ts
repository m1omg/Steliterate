import { Rng } from './rng';
import type { GameState } from './types';

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

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
export function bodyName(systemName: string, index: number): string {
  return `${systemName} ${ROMAN[index] ?? index + 1}`;
}

/** The names a globular cluster draws from (gen.ts), and its Well with it. */
export const CLUSTER_NAMES = ['Ossa', 'Keth', 'Umber', 'Lanthe', 'Mora', 'Sill'];

/**
 * Give every star and region a name of its own. The two globular clusters draw their names apart
 * and can draw the same one, and with it their Wells (one galaxy in eight); now and then a
 * catalogue number comes up twice; and a Well's first worlds kept the name its star had before it
was a Well. A later cluster of the same name takes the first name no
 * cluster has, and its Well with it; a later star of the same name the next free number, or else
 * " Minor". Its worlds follow its name. It draws nothing, so a seed's galaxy is the same; it runs
 * on each new galaxy and on every load (26 Oct, the player: "lanthe well for whatever reason shows
 * as unsurveyed after multiple surveys": there were two Lanthe Wells, and one was charted).
 */
export function distinctNames(state: GameState): void {
  // a star named after its worlds were (a Well, the Wanderer): they take its name, as its Deep says
  for (const sys of Object.values(state.systems)) {
    const deep = sys.bodies.map((id) => state.bodies[id]).find((b) => b?.kind === 'deep');
    const was = deep?.name.endsWith(' Deep') ? deep.name.slice(0, -' Deep'.length) : null;
    if (was && was !== sys.name) rename(state, sys.id, sys.name, was);
  }
  const regionNames = new Set<string>();
  for (const r of state.regions ?? []) {
    if (regionNames.has(r.name) && r.name.startsWith('Cluster ')) {
      const free = CLUSTER_NAMES.find((n) => !state.regions.some((x) => x.name === `Cluster ${n}`));
      if (free) {
        const was = r.name.slice('Cluster '.length);
        r.name = `Cluster ${free}`;
        for (const sys of Object.values(state.systems)) if (sys.regionId === r.id && sys.name === `${was} Well`) rename(state, sys.id, `${free} Well`);
      }
    }
    regionNames.add(r.name);
  }
  const names = new Set(Object.values(state.systems).map((x) => x.name));
  const seen = new Set<string>();
  for (const sys of Object.values(state.systems)) {
    if (seen.has(sys.name)) {
      const m = /^(.*?)(\d+)$/.exec(sys.name);
      let name = `${sys.name} Minor`;
      if (m) for (let n = Number(m[2]) + 1; ; n++) {
        const next = `${m[1]}${String(n).padStart(m[2].length, '0')}`;
        if (!names.has(next)) {
          name = next;
          break;
        }
      }
      rename(state, sys.id, name);
      names.add(name);
    }
    seen.add(sys.name);
  }
}

/** A star's new name, and its worlds' with it (they are named after it: "<star> II", "<star> Deep"). */
function rename(state: GameState, id: string, name: string, was = state.systems[id].name) {
  const sys = state.systems[id];
  sys.name = name;
  for (const bid of sys.bodies) {
    const b = state.bodies[bid];
    if (b && (b.name === was || b.name.startsWith(`${was} `))) b.name = name + b.name.slice(was.length);
  }
}
