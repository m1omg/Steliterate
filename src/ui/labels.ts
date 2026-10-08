import { ANOMALIES } from '../game/data/events';
import { FROZEN_K, LAVA_K, SURFACE_LIFE, bodyClimate, boilingAway, isStarLike, steamWorld } from '../game/physics';
import { SCORCH_K, THAW_ROOM, thawed } from '../game/sim/flare';
import type { Body, BodyKind, Focus, GameState, PrimaryKind, SpareWork, StarSystem } from '../game/types';
import { SPARE_RATE, TEND_SHARE, salvageIsMatter } from '../game/sim/spare';
import type { IconName } from './icons';
import { kelvin } from './fmt';
import { calendarEra } from '../game/fate';

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
  void: 'No star left',
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
  tidally_locked: ['Tidally locked', 'One face always toward its star: a day side that never sees night and a night side that never sees the star (the Temperature row gives both).'],
  failing_dynamo: ['Failing dynamo', 'The core is freezing and the magnetic field is fading. The stellar wind is stripping the air.'],
  subsurface_ocean: ['Buried ocean', 'Liquid water under the ice, kept warm by the tides of its star.'],
  once_alive: ['Once alive', 'This world had seas, air and life. They are gone: frozen when its warmth failed, or boiled away by its star.'],
  water_rich: ['Water-rich', 'Water is a large share of this world, perhaps half its mass: more than its star’s bright youth could boil away. Past the runaway greenhouse its seas rise into a sky of steam; below it they rain out again.'],
};

export const FOCUS: { id: Focus; name: string; tip: string }[] = [
  { id: 'balanced', name: 'Balanced', tip: 'No particular emphasis.' },
  { id: 'energy', name: 'Energy', tip: 'Energy +25%; industry, insight and accord −10%.' },
  { id: 'matter', name: 'Matter', tip: 'Matter raised by mines, skimmers and lifters +25%; energy, industry, insight and accord −10%.' },
  { id: 'industry', name: 'Industry', tip: 'Industry +30%; energy, insight and accord −10%.' },
  { id: 'insight', name: 'Insight', tip: 'Insight +30%; energy, industry and accord −10%.' },
  { id: 'accord', name: 'Accord', tip: 'Accord +40%; energy, industry and insight −10%.' },
];

/** What an idle settlement can do with its spare industry, and what each point of it makes. */
export function spareChoices(state: GameState): { id: SpareWork; name: string; tip: string }[] {
  const late = !salvageIsMatter(state);
  return [
    {
      id: 'salvage',
      name: 'Recycle',
      tip: late
        ? `Reclaim what is left of our decaying matter as power: energy +${SPARE_RATE.salvageLate} per point of spare industry.`
        : `Reuse the matter we already have (matter is conserved, and far easier to reuse than energy): matter +${SPARE_RATE.salvage} per point of spare industry.`,
    },
    { id: 'study', name: 'Study', tip: `Instruments, surveys and experiments: insight +${SPARE_RATE.study} per point of spare industry.` },
    { id: 'tend', name: 'Tend', tip: `Upkeep crews get more out of this settlement’s own collectors and hearth: energy +${SPARE_RATE.tend} per point of spare industry, but never more than a ${TEND_SHARE === 0.25 ? 'quarter' : `${TEND_SHARE * 100}%`} more than they make. Nothing where there is nothing to tend.` },
    { id: 'morale', name: 'Morale', tip: `Shared works, gatherings and memorials: resolve +${SPARE_RATE.morale} per point of spare industry.` },
  ];
}

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
  const boil = boilingAway(s, b);
  if (boil) return boil === 'swallowed' ? 'Being swallowed' : b.kind === 'asteroids' ? 'Vaporising rubble' : 'Boiling away';
  const sea = thawed(s, b);
  // (locked, its night side still frozen and its day side boiled dry: a band of sea between)
  if (sea) return twilightSea(s, b) ? 'Twilight sea' : sea === 'warm' ? 'Thawed ocean' : 'Hot sea';
  const melt = waterChanged(s, b);
  if (melt) return melt === 'steam' ? 'Steam world' : melt === 'scorched' ? 'Scorched world' : melt === 'terminator' ? 'Terminator world' : melt === 'warm' ? 'Thawed ocean' : 'Hot sea';
  if (lavaWorld(s, b)) return 'Lava world';
  if (twilightSea(s, b)) return 'Twilight sea';
  if (eyeballFace(s, b)) return (b.kind === 'ice' || b.kind === 'ocean_ice') && !b.traits.includes('once_alive') ? 'Eyeball sea' : 'Eyeball world';
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
 * sea has boiled away: down to its night side (scorched), or to the band of twilight between a dry
 * day side and a frozen night side, where life holds on (terminator habitability: Lobo et al.
 * 2023, ApJ 945, 161), or to steam even on its night side. A flare's thaw is `thawed`, which comes
 * first.
 */
function waterChanged(s: GameState, b: Body): 'warm' | 'hot' | 'steam' | 'scorched' | 'terminator' | null {
  if (b.dissolved || (b.water ?? 0) <= 0.005) return null;
  if (b.kind !== 'ice' && b.kind !== 'ocean_ice' && b.kind !== 'eyeball' && b.kind !== 'terran') return null;
  const c = bodyClimate(s, b);
  const coldest = c.night ?? c.mean;
  if (b.kind === 'eyeball' || b.kind === 'terran') {
    if (coldest >= 373) return 'steam';
    if ((c.day ?? c.mean) < 373) return null;
    return c.night !== undefined && c.night < 273 ? 'terminator' : 'scorched';
  }
  if (coldest < 273) return null;
  if (coldest >= 373) return 'steam';
  // locked, its day side boiled and a sea left on its night side
  if (c.day !== undefined && c.day >= 373) return 'scorched';
  return c.mean >= 373 ? 'steam' : c.mean > SCORCH_K ? 'hot' : 'warm';
}

/**
 * An ice world (or ice-shelled ocean) locked close to its star, its day side past boiling and its
 * night side below freezing: the day side baked dry, the water frozen out on the night side, and
 * along the terminator, between the two, a band of open sea. Astronomers call such a planet a hot
 * eyeball (water cold-trapped on the night side: Leconte et al. 2013, A&A 554, A69). The generator
 * places some ice worlds this close (DEV-NOTES): the climate, not the kind, says what they are.
 */
function twilightSea(s: GameState, b: Body): boolean {
  if (b.dissolved || (b.kind !== 'ice' && b.kind !== 'ocean_ice') || (b.water ?? 0) < 0.1) return false;
  const c = bodyClimate(s, b);
  return c.day !== undefined && c.night !== undefined && c.day >= 373 && c.night < 273;
}

/**
 * A world locked to its star with an open sea on the side that faces it and ice everywhere else:
 * what Pierrehumbert (2011, ApJ 726, L8) called an eyeball. An ice world (or ice-shelled ocean)
 * thawed so on its day side is an eyeball sea; a living world of any kind so is an eyeball world.
 */
function eyeballFace(s: GameState, b: Body): boolean {
  if (b.dissolved || (b.water ?? 0) < 0.1) return false;
  if (b.kind !== 'ice' && b.kind !== 'ocean_ice' && b.kind !== 'terran' && b.kind !== 'eyeball') return false;
  const c = bodyClimate(s, b);
  return c.day !== undefined && c.night !== undefined && c.day >= 273 && c.day < 373 && c.night < 273;
}

/** Rocky kinds that melt into a lava world (water worlds boil to steam first). */
const MELTS: BodyKind[] = ['barren', 'super_earth', 'terran', 'eyeball'];

/** A dry rocky world whose warmest ground is past LAVA_K: a crust over glowing magma. */
function lavaWorld(s: GameState, b: Body): boolean {
  if (b.dissolved || !MELTS.includes(b.kind)) return false;
  const c = bodyClimate(s, b);
  return (c.day ?? c.mean) >= LAVA_K;
}

/**
 * What a world was, for the notes on what it has become: a world that once had life was a living
 * world (our homeworld an eyeball world), whatever it has turned into since.
 */
function onceWas(b: Body): string {
  if (b.traits.includes('homeworld') && b.kind !== 'eyeball') return 'an eyeball world, and our home';
  if (b.traits.includes('once_alive')) return 'a living world';
  const was: Partial<Record<BodyKind, string>> = { eyeball: 'an eyeball world', ice: 'an ice world', ocean_ice: 'an ice-shelled ocean', super_earth: 'a super-Earth', barren: 'bare rock' };
  return was[b.kind] ?? `a ${BODY_NAME[b.kind].toLowerCase()}`;
}

/** A longer note on the kind, for tooltips: what it was, when that has changed. */
export function bodyKindNote(s: GameState, b: Body): string {
  const boil = boilingAway(s, b);
  const what = b.kind === 'asteroids' ? 'An asteroid belt' : `Once ${onceWas(b)}`;
  if (boil === 'swallowed') return `${what}. Its star is swelling into a helium giant some 25 times the Sun’s size, and this world orbits inside it: it is swallowed as this turn ends.`;
  if (boil) {
    const by = s.systems[b.systemId]?.primary.kind === 'helium_giant' ? 'Its star has swollen into a helium giant, a thousand times as bright as the Sun' : 'Its new star, a helium star burning at 42,000 K, pours out ultraviolet';
    return `${what}. ${by}: ${b.kind === 'asteroids' ? 'the rubble is evaporating' : 'its ground is past 3,000 K, and the rock vapour is stripped off into space'}. It is gone as this turn ends.`;
  }
  const sea = thawed(s, b);
  if (sea && twilightSea(s, b)) return `Once ${onceWas(b)}. Its star's last flare has boiled its day side dry, and its night side is still frozen: along the terminator, between the two, the ice has melted into a band of open sea${sea === 'warm' ? `, with room for ${THAW_ROOM} Kin by the water without domes for as long as the flare lasts` : ''}. When the star collapses it will freeze again.`;
  if (sea === 'warm') return `Once ${onceWas(b)}. Its star's last flare has melted it into open ocean under a thin, steamy sky: room for ${THAW_ROOM} Kin by the water without domes, for as long as the flare lasts. When the star collapses it will freeze again.`;
  if (sea === 'hot') return `Once ${onceWas(b)}. Its star's last flare has melted it into a hot, steaming sea, too hot to live by. When the star collapses it will freeze again.`;
  const melt = waterChanged(s, b);
  if (melt === 'steam' && steamWorld(s, b)) {
    return `A water-rich world past the runaway greenhouse: its oceans have risen into a sky of steam hundreds of bars deep, which holds the ground at ${kelvin(bodyClimate(s, b).mean)} by night as by day. If its light falls below the limit (its star dead and its remnant cooled), the steam rains out into seas.`;
  }
  if (melt) {
    const c = bodyClimate(s, b);
    const flare = s.systems[b.systemId]?.primary.kind === 'blue_dwarf';
    const by = flare ? `Its star's last flare has` : 'Its star has';
    const night = c.night === undefined ? '' : c.night < 373 ? ', with a hot sea left only on its night side' : ', even on its night side';
    // a world of sea and land is alive: the flare is killing it (scorched), not thawing it for a while
    if (melt === 'terminator')
      return `Locked to its star, its day side ${flare ? 'boiled dry by the flare' : 'boiled dry'} and its night side frozen: water stays liquid${b.vitality > 0 ? ', and life holds on,' : ''} only in the band of twilight between. Astronomers call it terminator habitability (Lobo et al. 2023).`;
    if (melt === 'scorched')
      return flare || b.traits.includes('once_alive') || b.kind === 'ice' || b.kind === 'ocean_ice'
        ? `Once ${onceWas(b)}. ${by} boiled away the sea on its day side; a sea is left only on its night side.`
        : 'Locked close to its star, its day side too hot for any sea: its water lies on its night side, as open sea.';
    if (b.kind === 'eyeball' || b.kind === 'terran') return `Once ${onceWas(b)}. ${by} boiled its seas into a sky of steam${night}${flare ? ': nowhere on its surface is livable while the flare lasts' : ''}.`;
    const again = flare ? ' When the star collapses it will freeze again.' : '';
    if (melt !== 'steam') return `Once ${onceWas(b)}. ${by} melted it into ${melt === 'warm' ? 'open ocean' : 'a hot, steaming sea'}.${again}`;
    return `Once ${onceWas(b)}. ${by} boiled its ice into a sky of steam${night}.${again}`;
  }
  if (eyeballFace(s, b) && !twilightSea(s, b) && b.kind !== 'eyeball') {
    const icy = b.kind === 'ice' || b.kind === 'ocean_ice';
    return `Locked to its star: ${icy ? 'its ice has thawed into' : 'it keeps'} an open sea on the side that faces it, with ice all round it and over the night side. Pierrehumbert (2011) called such a world an eyeball.`;
  }
  if (lavaWorld(s, b)) {
    const c = bodyClimate(s, b);
    const was = b.kind === 'barren' ? 'Bare rock' : `Once ${onceWas(b)}`;
    const side = c.night !== undefined && c.night < LAVA_K ? ' on the side that faces it (the night side is solid rock)' : '';
    const haze = (c.day ?? c.mean) >= 2600 ? '; past 2,600 K the rock itself boils into a thin, glowing haze' : '';
    return `${was}, melted by its star${side}: a dark crust of basalt over glowing magma${haze}.`;
  }
  if (twilightSea(s, b)) {
    const c = bodyClimate(s, b);
    return `${b.kind === 'ocean_ice' ? 'An ice-shelled ocean' : 'An ice world'} locked close to its star. Its day side is baked dry, up to ${Math.round(c.day!)} K; its water has frozen out on the night side, down to ${Math.round(c.night!)} K; and along the terminator, in the twilight between, the ice melts into a band of open sea. What astronomers call a hot eyeball.`;
  }
  if (bodyKindName(s, b) !== 'Frozen world') return '';
  const p = s.systems[b.systemId]?.primary;
  const why = b.rogue ? 'It has no star' : !p || !isStarLike(p) ? 'Its star is dead' : 'Its star is too faint to warm it';
  return `Once ${onceWas(b)}. ${why}, and ${b.kind === 'eyeball' ? 'the sea on its day side has' : 'its seas have'} frozen over; what warmth is left comes from inside.`;
}

/** What the Deep is for: its panel shows no habitability, room or matter, which reads as empty. */
export function deepNote(s: GameState): string {
  const industry = calendarEra(s) === 'dusk' && !s.civ.techs.includes('orbital_industry') ? ' and Orbital Industry' : '';
  return `Orbital space around the star: no ground, water or rock, so nothing to live on or mine. Orbital Collectors work here, and some structures exist only here (the Dyson Swarm, the Stellar Lifter; later most power from dead stars and black holes): any settlement of ours in this system can build them. Minds on substrate live here as well as anywhere; Kin need Habitat Domes${industry}.`;
}

/**
 * In the Degenerate Age a collision star is the brightest thing for light-years around: every
 * list of places puts the ones on our map first, while they burn. (One that lit and went out
 * within the last turn keeps the name until the turn ends, without light.)
 */
export function isBeacon(s: GameState, sys: StarSystem): boolean {
  return calendarEra(s) === 'degenerate' && sys.primary.kind === 'collision_star' && !sys.gone && (s.civ.known[sys.id] ?? 0) > 0 && (sys.primary.diesAt ?? 0) > s.years;
}

export const BEACON_TIP = 'A collision star: two brown dwarfs, each too small to burn hydrogen, collided, and the merged body is heavy enough to burn it. In the Degenerate Age nothing else nearby shines like it.';

export const SWARM_TIP = 'A swarm is feeding there. It goes for most ships that stop at its star, where we have no settlement to fight beside them: a probe rarely comes back, and warships beat off only small swarms (or go for one, from their panel, by the same odds).';

/** A pace's name, as the Pace panel's buttons give it. */
export function paceName(p: number): string {
  return p === 0 ? 'the Tide' : p > 0 ? `Quick ×${10 ** p}` : `Slow ×${10 ** -p}`;
}
