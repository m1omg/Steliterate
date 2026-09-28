import { ANOMALIES } from '../game/data/events';
import type { BodyKind, Focus, PrimaryKind } from '../game/types';
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
