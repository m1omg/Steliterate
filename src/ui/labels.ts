import { ANOMALIES } from '../game/data/events';
import { FROZEN_K, LAVA_K, SURFACE_LIFE, bodyClimate, isStarLike } from '../game/physics';
import { SCORCH_K, THAW_ROOM, thawed } from '../game/sim/flare';
import type { Body, BodyKind, Focus, GameState, PrimaryKind, StarSystem } from '../game/types';
import type { IconName } from './icons';

export const PRIMARY_NAME: Record<PrimaryKind, string> = {
  red_dwarf: 'Red dwarf',
  blue_dwarf: 'Blue dwarf',
  white_dwarf: 'White dwarf',
  black_dwarf: 'Black dwarf',
  brown_dwarf: 'Brown dwarf',
  neutron_star: 'Neutron star',
  black_hole: 'Black hole',
  smbh: 'Supermassive black hole',
  collision_star: 'Collision star',
  helium_star: 'Helium star',
  helium_giant: 'Helium giant',
  dark_star: 'The Last Star',
  rogue: 'Starless',
  void: 'Empty',
};

export function primaryIcon(k: PrimaryKind): IconName {
  switch (k) {
    case 'red_dwarf':
    case 'collision_star':
      return 'red_dwarf';
    case 'blue_dwarf':
    case 'white_dwarf':
    case 'black_dwarf':
    case 'helium_star':
    case 'helium_giant':
    case 'dark_star':
      return 'white_dwarf';
    case 'brown_dwarf':
      return 'brown_dwarf';
    case 'neutron_star':
      return 'neutron_star';
    case 'black_hole':
    case 'smbh':
      return 'black_hole';
    default:
      return 'system';
  }
}

export const BODY_NAME: Record<BodyKind, string> = {
  eyeball: 'Eyeball world',
  terran: 'Terrestrial world',
  super_earth: 'Super-Earth',
  barren: 'Barren rock',
  ice: 'Ice world',
  ocean_ice: 'Ice-shelled ocean',
  gas_giant: 'Gas giant',
  ice_giant: 'Ice giant',
  asteroids: 'Asteroid belt',
  deep: 'The Deep',
};

export function bodyIcon(k: BodyKind): IconName {
  if (k === 'asteroids') return 'asteroids';
  if (k === 'gas_giant' || k === 'ice_giant') return 'gas_giant';
  if (k === 'deep') return 'dyson';
  return 'planet';
}

export const TRAIT_NAME: Record<string, [string, string]> = {
  ...Object.fromEntries(ANOMALIES.map((a) => [a.id, [a.name, a.tip] as [string, string]])),
  homeworld: ['Homeworld', 'Where the Kin were born. They will not forgive its abandonment.'],
  tidally_locked: ['Tidally locked', 'One face always toward the star: a burning day side, a frozen night side, and a thin habitable ring between.'],
  failing_dynamo: ['Failing dynamo', 'The core is freezing and the magnetic field is fading. The stellar wind is stripping the air.'],
  subsurface_ocean: ['Buried ocean', 'Liquid water under the ice, kept warm by tides.'],
  once_alive: ['Once alive', 'This world had seas, air and life. It froze or dried out when its warmth was gone.'],
};

export const FOCUS: { id: Focus; name: string; tip: string }[] = [
  { id: 'balanced', name: 'Balanced', tip: 'No particular emphasis.' },
  { id: 'energy', name: 'Energy', tip: 'Energy +25%, everything else −10%.' },
  { id: 'industry', name: 'Industry', tip: 'Industry +30%, everything else −10%.' },
  { id: 'insight', name: 'Insight', tip: 'Insight +30%, everything else −10%.' },
  { id: 'accord', name: 'Accord', tip: 'Accord +40%, everything else −10%.' },
];

export const WAY_NAME: Record<string, string> = {
  garden: 'clinging to biology',
  upload: 'uploaded',
  chorus: 'merged into one mind',
  dormant: 'asleep, waking rarely',
  lattice: 'handed over to processes and protocol',
  fork: 'a Thread that left you',
};

/** The plate for each way of life (art/<name>.webp); the generic one for any way added without one. */
const WAY_ART: Record<string, string> = { garden: 'way_garden', upload: 'way_upload', chorus: 'way_chorus', dormant: 'way_dormant', lattice: 'way_lattice', fork: 'way_fork' };
export const wayArt = (way: string) => WAY_ART[way] ?? 'survivor';

/**
 * What kind of world a body is now. A living world is named for its warmth only while it has
 * some: once even its warmest ground is below FROZEN_K (its star dead, or too faint) it is
 * simply a frozen world.
 */
export function bodyKindName(s: GameState, b: Body): string {
  const sea = thawed(s, b);
  if (sea) return sea === 'warm' ? 'Thawed ocean' : 'Hot sea';
  const melt = waterChanged(s, b);
  if (melt) return melt === 'steam' ? 'Steam world' : melt === 'scorched' ? 'Scorched world' : melt === 'warm' ? 'Thawed ocean' : 'Hot sea';
  if (lavaWorld(s, b)) return 'Lava world';
  if (SURFACE_LIFE.includes(b.kind)) {
    const c = bodyClimate(s, b);
    if ((c.day ?? c.mean) < FROZEN_K) return 'Frozen world';
  }
  return BODY_NAME[b.kind];
}

/**
 * A world named for its ice or its sea when neither is left: an ice world or ice-shelled ocean
 * with no ice anywhere, melted into open sea, a hot sea or steam by whatever warms it (a flare,
 * a helium star, a white dwarf still hot from its collapse; a locked world may keep a hot sea on
 * its night side), or a world of sea and land (an eyeball or terrestrial world) whose day-side
 * sea has boiled away (scorched), or boiled to steam even on its night side. A flare's thaw is
 * `thawed`, which comes first.
 */
function waterChanged(s: GameState, b: Body): 'warm' | 'hot' | 'steam' | 'scorched' | null {
  if (b.dissolved || (b.water ?? 0) <= 0.005) return null;
  if (b.kind !== 'ice' && b.kind !== 'ocean_ice' && b.kind !== 'eyeball' && b.kind !== 'terran') return null;
  const c = bodyClimate(s, b);
  const coldest = c.night ?? c.mean;
  if (b.kind === 'eyeball' || b.kind === 'terran') return coldest >= 373 ? 'steam' : (c.day ?? c.mean) >= 373 ? 'scorched' : null;
  if (coldest < 273) return null;
  return c.mean >= 373 ? 'steam' : c.mean > SCORCH_K ? 'hot' : 'warm';
}

/** Rocky kinds that melt into a lava world (water worlds boil to steam first). */
const MELTS: BodyKind[] = ['barren', 'super_earth', 'terran', 'eyeball'];

/** A dry rocky world whose warmest ground is past LAVA_K: a crust over glowing magma. */
function lavaWorld(s: GameState, b: Body): boolean {
  if (b.dissolved || !MELTS.includes(b.kind)) return false;
  const c = bodyClimate(s, b);
  return (c.day ?? c.mean) >= LAVA_K;
}

/** What a world was, for the notes on what it has become. */
function onceWas(k: BodyKind): string {
  const was: Partial<Record<BodyKind, string>> = { eyeball: 'an eyeball world', ice: 'an ice world', ocean_ice: 'an ice-shelled ocean', super_earth: 'a super-Earth', barren: 'bare rock' };
  return was[k] ?? `a ${BODY_NAME[k].toLowerCase()}`;
}

/** A longer note on the kind, for tooltips: what it was, when that has changed. */
export function bodyKindNote(s: GameState, b: Body): string {
  const sea = thawed(s, b);
  if (sea === 'warm') return `Once ${onceWas(b.kind)}. Its star's last flare has melted it into open ocean under a thin, steamy sky: room for ${THAW_ROOM} Kin by the water without domes, for as long as the flare lasts. When the star collapses it will freeze again.`;
  if (sea === 'hot') return `Once ${onceWas(b.kind)}. Its star's last flare has melted it into a hot, steaming sea, too hot to live by. When the star collapses it will freeze again.`;
  const melt = waterChanged(s, b);
  if (melt) {
    const c = bodyClimate(s, b);
    const flare = s.systems[b.systemId]?.primary.kind === 'blue_dwarf';
    const by = flare ? `Its star's last flare has` : 'Its star has';
    const night = c.night === undefined ? '' : c.night < 373 ? ', with a hot sea left only on its night side' : ', even on its night side';
    // a world of sea and land is alive: the flare is killing it (scorched), not thawing it for a while
    if (melt === 'scorched') return `Once ${onceWas(b.kind)}. ${by} boiled away the sea on its day side; ${(c.night ?? c.mean) < 273 ? 'ice is left' : 'a sea is left'} only on its night side.`;
    if (b.kind === 'eyeball' || b.kind === 'terran') return `Once ${onceWas(b.kind)}. ${by} boiled its seas into a sky of steam${night}${flare ? ': nowhere on its surface is livable while the flare lasts' : ''}.`;
    const again = flare ? ' When the star collapses it will freeze again.' : '';
    if (melt !== 'steam') return `Once ${onceWas(b.kind)}. ${by} melted it into ${melt === 'warm' ? 'open ocean' : 'a hot, steaming sea'}.${again}`;
    return `Once ${onceWas(b.kind)}. ${by} boiled its ice into a sky of steam${night}.${again}`;
  }
  if (lavaWorld(s, b)) {
    const c = bodyClimate(s, b);
    const was = b.kind === 'barren' ? 'Bare rock' : `Once ${onceWas(b.kind)}`;
    const side = c.night !== undefined && c.night < LAVA_K ? ' on the side that faces it (the night side is solid rock)' : '';
    const haze = (c.day ?? c.mean) >= 2600 ? '; past 2,600 K the rock itself boils into a thin, glowing haze' : '';
    return `${was}, melted by its star${side}: a dark crust of basalt over glowing magma${haze}.`;
  }
  if (bodyKindName(s, b) !== 'Frozen world') return '';
  const p = s.systems[b.systemId]?.primary;
  const why = b.rogue ? 'It has no star' : !p || !isStarLike(p) ? 'Its star is dead' : 'Its star is too faint to warm it';
  return `Once ${onceWas(b.kind)}. ${why}, and ${b.kind === 'eyeball' ? 'the sea on its day side has' : 'its seas have'} frozen over; what warmth is left comes from inside.`;
}

/** What the Deep is for: its panel shows no habitability, room or matter, which reads as empty. */
export function deepNote(s: GameState): string {
  const industry = s.era === 'dusk' && !s.civ.techs.includes('orbital_industry') ? ' and Orbital Industry' : '';
  return `Orbital space around the star: no ground, water or rock, so nothing to live on or mine. Orbital Collectors work here, and some structures exist only here (the Dyson Swarm, the Stellar Lifter; later most power from dead stars and black holes): any settlement of ours in this system can build them. Minds on substrate live here as well as anywhere; Kin need Habitat Domes${industry}.`;
}

/**
 * In the Degenerate Age a collision star is the brightest thing for light-years around: every
 * list of places puts the ones on our map first, while they burn. (One that lit and went out
 * within the last turn keeps the name until the turn ends, without light.)
 */
export function isBeacon(s: GameState, sys: StarSystem): boolean {
  return s.era === 'degenerate' && sys.primary.kind === 'collision_star' && !sys.gone && (s.civ.known[sys.id] ?? 0) > 0 && (sys.primary.diesAt ?? 0) > s.years;
}

export const BEACON_TIP = 'A collision star: two brown dwarfs, each too small to burn hydrogen, collided, and the merged body is heavy enough to burn it. In the Degenerate Age nothing else nearby shines like it.';

export const SWARM_TIP = 'A swarm is feeding there. It goes for most ships that stop at its star, where we have no settlement to fight beside them: a probe rarely comes back, and warships beat off only small swarms.';
