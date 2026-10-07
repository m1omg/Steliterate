import { ERA_BY_ID } from './eras';
import { bodyName, catalogueName, properName } from './names';
import { Rng, hashSeed } from './rng';
import type {
  Body,
  BodyKind,
  Civ,
  Fate,
  GameSettings,
  GameState,
  Primary,
  PrimaryKind,
  Province,
  Region,
  StarSystem,
  Survivor,
  SurvivorWay,
  ThreadId,
  Vec3,
} from './types';
import { THREADS } from './types';

// The Coalescence: one giant elliptical galaxy made of dozens of ancestral galaxies,
// surrounded by a nearly total void. Display coordinates are compressed per level so the
// whole thing reads at once; `phys` keeps true light-year positions for travel.

const LY_PER_UNIT = 100; // province and reach centres: 1 display unit = 100 ly
const OUTLIER_LY_PER_UNIT = 700;
const START_YEARS = ERA_BY_ID.dusk.startYears;

export const HAWKING_K = 2.1e67; // years per solar mass cubed

export function hawkingTime(massSun: number): number {
  return HAWKING_K * Math.pow(massSun, 3);
}

/** Gravitational-wave inspiral to the tidal limit (years), from the author's notes:
 * ~3e19 yr for an Earth mass at 0.1 AU around 0.6 M☉, scaling as a^4 / (m M²). */
export function inspiralTime(aAU: number, massEarth: number, hostMass: number): number {
  return 3e19 * Math.pow(aAU / 0.1, 4) * (1 / Math.max(0.01, massEarth)) * Math.pow(0.6 / Math.max(0.05, hostMass), 2);
}

function v(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}
function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function randomInSphere(rng: Rng, r: number, flatten = 1): Vec3 {
  for (;;) {
    const x = rng.range(-1, 1);
    const y = rng.range(-1, 1);
    const z = rng.range(-1, 1);
    if (x * x + y * y + z * z <= 1) return v(x * r, y * r * flatten, z * r);
  }
}

function dirFromAngles(theta: number, phi: number): Vec3 {
  return v(Math.cos(theta) * Math.cos(phi), Math.sin(phi), Math.sin(theta) * Math.cos(phi));
}

type Weights = Partial<Record<PrimaryKind, number>>;

const REACH_WEIGHTS: Weights = { red_dwarf: 26, white_dwarf: 32, brown_dwarf: 22, neutron_star: 7, black_hole: 5, blue_dwarf: 2, rogue: 6 };
const GLOBULAR_WEIGHTS: Weights = { white_dwarf: 50, neutron_star: 24, black_hole: 8, brown_dwarf: 12, red_dwarf: 6 };
const CORE_WEIGHTS: Weights = { neutron_star: 30, black_hole: 28, white_dwarf: 30, red_dwarf: 12 };

function pickKind(rng: Rng, w: Weights): PrimaryKind {
  const entries = Object.entries(w) as [PrimaryKind, number][];
  return rng.weighted(entries, (e) => e[1])[0];
}

export function makePrimary(rng: Rng, kind: PrimaryKind): Primary {
  const p: Primary = { kind, mass: 0.1, lum: 0, spin: 0, spinMax: 0 };
  switch (kind) {
    case 'red_dwarf': {
      p.mass = rng.range(0.08, 0.13);
      p.lum = 0.75 + (p.mass - 0.08) * 8 + rng.range(-0.08, 0.08);
      const untilBlue = Math.pow(10, rng.range(8, 12.97));
      p.blueAt = START_YEARS + untilBlue;
      p.whiteAt = p.blueAt + rng.range(2e9, 6e9);
      break;
    }
    case 'blue_dwarf': {
      p.mass = rng.range(0.1, 0.16);
      p.lum = 1.0;
      p.blueAt = START_YEARS - 1e9;
      p.whiteAt = START_YEARS + Math.pow(10, rng.range(6, 9.4));
      break;
    }
    case 'white_dwarf':
      p.mass = rng.range(0.45, 0.9);
      p.lum = 0.02;
      p.halo = rng.chance(0.6);
      break;
    case 'brown_dwarf':
      p.mass = rng.range(0.03, 0.075);
      p.lum = 0.02;
      break;
    case 'neutron_star':
      p.mass = rng.range(1.2, 2.1);
      p.lum = 0.08;
      p.spinMax = p.spin = rng.range(80, 220);
      break;
    case 'black_hole': {
      p.mass = rng.range(4, 28);
      const a = rng.range(0.2, 0.99);
      p.spinMax = p.spin = Math.round(420 * a * Math.sqrt(p.mass / 10));
      p.evaporateAt = hawkingTime(p.mass);
      break;
    }
    case 'smbh':
      p.mass = 3e8; // grows during galactic evaporation
      p.spinMax = p.spin = 40000;
      p.evaporateAt = hawkingTime(p.mass);
      break;
    case 'rogue':
      p.mass = 0;
      p.lum = 0;
      break;
    default:
      break;
  }
  return p;
}

interface BodyTemplate {
  kind: BodyKind;
  aAU: number;
  massEarth: number;
}

function bodyTemplates(rng: Rng, primary: Primary): BodyTemplate[] {
  const out: BodyTemplate[] = [];
  const add = (kind: BodyKind, aAU: number, massEarth: number) => out.push({ kind, aAU, massEarth });
  switch (primary.kind) {
    case 'red_dwarf':
    case 'blue_dwarf': {
      const n = rng.int(2, 5);
      let a = rng.range(0.012, 0.025);
      for (let i = 0; i < n; i++) {
        const inHz = a > 0.025 && a < 0.09;
        let kind: BodyKind;
        const r = rng.next();
        if (inHz && r < 0.45) kind = rng.chance(0.8) ? 'eyeball' : 'terran';
        else if (r < 0.25) kind = 'barren';
        else if (r < 0.45) kind = 'super_earth';
        else if (r < 0.62) kind = a > 0.06 ? 'ice' : 'barren';
        else if (r < 0.74) kind = 'asteroids';
        else if (r < 0.86) kind = a > 0.05 ? 'ocean_ice' : 'barren';
        else kind = a > 0.08 && rng.chance(0.4) ? 'gas_giant' : 'ice';
        add(kind, a, massFor(rng, kind));
        a *= rng.range(1.4, 2.1);
      }
      break;
    }
    case 'white_dwarf': {
      const n = rng.int(0, 3);
      for (let i = 0; i < n; i++) {
        const close = rng.chance(0.12); // migrated inward after the giant phase (Kozai–Lidov)
        const a = close ? rng.range(0.01, 0.03) : rng.range(1.2, 12);
        const kind: BodyKind = close ? rng.pick(['barren', 'gas_giant', 'super_earth'] as BodyKind[]) : rng.pick(['barren', 'ice_giant', 'ice', 'asteroids', 'gas_giant'] as BodyKind[]);
        add(kind, a, massFor(rng, kind));
      }
      break;
    }
    case 'brown_dwarf': {
      const n = rng.int(0, 3);
      let a = rng.range(0.004, 0.01);
      for (let i = 0; i < n; i++) {
        const kind: BodyKind = rng.pick(['barren', 'ice', 'ocean_ice'] as BodyKind[]);
        add(kind, a, massFor(rng, kind) * 0.3);
        a *= rng.range(1.5, 2.2);
      }
      break;
    }
    case 'neutron_star': {
      const n = rng.int(0, 2);
      for (let i = 0; i < n; i++) add('barren', rng.range(0.2, 1.2), rng.range(0.02, 4));
      break;
    }
    case 'black_hole':
      if (rng.chance(0.3)) add(rng.pick(['barren', 'ice'] as BodyKind[]), rng.range(2, 20), rng.range(0.1, 3));
      break;
    case 'rogue': {
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i++) add(rng.pick(['ice', 'ocean_ice', 'barren'] as BodyKind[]), 0, rng.range(0.1, 5));
      break;
    }
    default:
      break;
  }
  return out;
}

function massFor(rng: Rng, kind: BodyKind): number {
  switch (kind) {
    case 'gas_giant':
      return rng.range(60, 400);
    case 'ice_giant':
      return rng.range(10, 20);
    case 'super_earth':
      return rng.range(2, 7);
    case 'eyeball':
    case 'terran':
      return rng.range(0.6, 1.6);
    case 'asteroids':
      return 0.001;
    case 'ocean_ice':
    case 'ice':
      return rng.range(0.1, 1.2);
    default:
      return rng.range(0.05, 1.2);
  }
}

function displaySize(kind: BodyKind, massEarth: number): number {
  switch (kind) {
    case 'gas_giant':
      return 3.4 + Math.min(1.4, massEarth / 300);
    case 'ice_giant':
      return 2.7;
    case 'asteroids':
      return 0.6;
    case 'deep':
      return 0;
    default:
      return 0.9 + Math.cbrt(massEarth) * 0.85;
  }
}

function bodyStats(rng: Rng, kind: BodyKind): Pick<Body, 'habitability' | 'vitality' | 'decline' | 'coreHeat' | 'richness' | 'hydrogen' | 'water'> {
  const s = { habitability: 0, vitality: 0, decline: 0, coreHeat: 0, richness: 1, hydrogen: 0, water: 0 };
  switch (kind) {
    case 'eyeball':
      s.habitability = rng.range(0.5, 0.8);
      s.vitality = rng.range(0.15, 0.45);
      s.decline = 0.002;
      s.coreHeat = rng.range(0.05, 0.25);
      s.richness = rng.range(0.7, 1.1);
      break;
    case 'terran':
      s.habitability = rng.range(0.5, 0.75);
      s.vitality = rng.range(0.1, 0.35);
      s.decline = 0.002;
      s.coreHeat = rng.range(0.05, 0.2);
      s.richness = rng.range(0.8, 1.2);
      break;
    case 'super_earth':
      s.habitability = rng.range(0.2, 0.45);
      s.vitality = rng.range(0.05, 0.25);
      s.decline = 0.0015;
      s.coreHeat = rng.range(0.15, 0.4);
      s.richness = rng.range(1.1, 1.5);
      break;
    case 'ocean_ice':
      s.habitability = 0.15;
      s.vitality = rng.range(0.05, 0.15);
      s.coreHeat = rng.range(0.05, 0.2);
      s.richness = rng.range(0.5, 0.8);
      break;
    case 'ice':
      s.habitability = 0.05;
      s.richness = rng.range(0.5, 0.9);
      break;
    case 'barren':
      s.richness = rng.range(1.0, 1.7);
      break;
    case 'asteroids':
      s.richness = rng.range(1.8, 2.6);
      break;
    case 'gas_giant':
      s.richness = 0.3;
      s.hydrogen = rng.range(1.6, 2.4);
      break;
    case 'ice_giant':
      s.richness = 0.5;
      s.hydrogen = rng.range(0.9, 1.4);
      break;
    case 'deep':
      s.richness = 0;
      break;
  }
  return s;
}

// ------------------------------------------------------------------ builder

class Builder {
  rng: Rng;
  provinces: Province[] = [];
  regions: Region[] = [];
  systems: Record<string, StarSystem> = {};
  bodies: Record<string, Body> = {};
  n = 0;
  constructor(seed: number) {
    this.rng = new Rng(seed);
  }
  id(prefix: string): string {
    return `${prefix}${(this.n++).toString(36)}`;
  }

  addSystem(region: Region, local: Vec3, kind: PrimaryKind, special?: StarSystem['special']): StarSystem {
    const rng = this.rng;
    const primary = makePrimary(rng, kind);
    const named = kind === 'red_dwarf' || kind === 'blue_dwarf' || kind === 'smbh' || rng.chance(0.25);
    const name = kind === 'smbh' ? 'The Heart' : named ? properName(rng) : catalogueName(rng, kind);
    const sys: StarSystem = {
      id: this.id('s'),
      name,
      regionId: region.id,
      provinceId: region.provinceId,
      pos: add(region.pos, local),
      phys: add(region.phys, local),
      primary,
      bodies: [],
      seed: hashSeed(name + this.n),
      special,
    };
    this.systems[sys.id] = sys;
    // the Deep: orbital space around the primary, where stations live
    this.addBody(sys, 'deep', 0, 0, 0);
    const templates = bodyTemplates(rng, primary);
    templates.sort((a, b) => a.aAU - b.aAU);
    templates.forEach((t, i) => this.addBody(sys, t.kind, t.aAU, t.massEarth, i));
    return sys;
  }

  addBody(sys: StarSystem, kind: BodyKind, aAU: number, massEarth: number, index: number): Body {
    const rng = this.rng;
    const stats = bodyStats(rng, kind);
    const b: Body = {
      id: this.id('b'),
      systemId: sys.id,
      name: kind === 'deep' ? `${sys.name} Deep` : bodyName(sys.name, index),
      kind,
      orbit: kind === 'deep' ? 0 : 16 + index * rng.range(8, 11) + (kind === 'gas_giant' ? 4 : 0),
      phase: rng.range(0, Math.PI * 2),
      size: displaySize(kind, massEarth),
      seed: hashSeed(sys.name + kind + index + this.n),
      orbitAU: aAU,
      massEarth,
      ...stats,
      traits: [],
      colonyId: null,
    };
    // from the body's own seed, so adding it does not disturb the rest of generation
    b.water = defaultWater(kind, (b.seed % 1000) / 1000);
    if (kind !== 'deep' && sys.primary.kind !== 'rogue' && aAU > 0) {
      b.inspiralAt = START_YEARS + inspiralTime(aAU, massEarth, Math.max(0.1, sys.primary.mass));
      if (b.orbitAU < 0.08 && kind !== 'gas_giant') b.traits.push('tidally_locked');
    }
    if (kind !== 'deep' && kind !== 'gas_giant' && rng.chance(0.11)) {
      b.relic = { kind: rng.weighted(['archive', 'engine', 'tomb', 'ghosts', 'sleepers'] as const, (k) => (k === 'sleepers' ? 0.6 : 1)), state: 'hidden' };
    }
    if (kind === 'ocean_ice') b.traits.push('subsurface_ocean');
    this.bodies[b.id] = b;
    sys.bodies.push(b.id);
    return b;
  }

  makeRegion(province: Province, name: string, center: Vec3, radiusLy: number, kind: Region['kind'], physScale = LY_PER_UNIT): Region {
    const r: Region = {
      id: this.id('r'),
      name,
      provinceId: province.id,
      pos: center,
      phys: scale(center, physScale),
      radiusLy,
      kind,
    };
    this.regions.push(r);
    return r;
  }

  fillRegion(region: Region, count: number, weights: Weights, flatten = 0.55): StarSystem[] {
    const out: StarSystem[] = [];
    const placed: Vec3[] = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 40) {
      const local = randomInSphere(this.rng, region.radiusLy, flatten);
      if (placed.some((p) => Math.hypot(p.x - local.x, p.y - local.y, p.z - local.z) < region.radiusLy * 0.22)) continue;
      placed.push(local);
      out.push(this.addSystem(region, local, pickKind(this.rng, weights)));
    }
    return out;
  }
}

// ------------------------------------------------------------------ world

const SURVIVOR_NAMES: { name: string; adjective: string; way: SurvivorWay; color: string }[] = [
  { name: 'The Vaelun Hold', adjective: 'Vaelun', way: 'garden', color: '#d9a066' },
  { name: 'The Serein Archive', adjective: 'Serein', way: 'upload', color: '#7fb6d9' },
  { name: 'The Hollow Choir', adjective: 'Choir', way: 'chorus', color: '#c38fd9' },
  { name: 'The Long Sleepers of Ost', adjective: 'Ostian', way: 'dormant', color: '#8fd9b4' },
  { name: 'The Tessellate', adjective: 'Tessellate', way: 'lattice', color: '#d9d27f' },
];

export function freshThreadRecord(v0: number): Record<ThreadId, number> {
  return Object.fromEntries(THREADS.map((t) => [t, v0])) as Record<ThreadId, number>;
}

export function generateWorld(settings: GameSettings): GameState {
  const b = new Builder(settings.seed);
  const rng = b.rng;

  // ---- provinces
  const core: Province = { id: 'p_core', name: 'The Heart', kind: 'core', pos: v(0, 0, 0), phys: v(0, 0, 0), radius: 160, lore: 'Where the ancestral galaxies fell together. Their central black holes merged here long ago.' };
  b.provinces.push(core);
  const ancestralNames = ['Remnant', 'Remnant', 'Remnant'];
  const ancestralLore = [
    'The largest of the ancestors. Its old stars still share an orbit and a chemistry, like a family that kept its accent.',
    'A once-great spiral, long since stirred into the whole. Its reaches are the most thinly spread.',
    'A smaller ancestor that fell in late. Its stars are the least mixed.',
  ];
  const baseTheta = rng.range(0, Math.PI * 2);
  const ancestral: Province[] = [];
  for (let i = 0; i < 3; i++) {
    const theta = baseTheta + (i * Math.PI * 2) / 3 + rng.range(-0.35, 0.35);
    const dist = [420, 520, 610][i] + rng.range(-40, 40);
    const pos = scale(dirFromAngles(theta, rng.range(-0.18, 0.18)), dist);
    const p: Province = { id: `p_anc${i}`, name: `The ${properName(rng, 2)} ${ancestralNames[i]}`, kind: 'ancestral', pos, phys: scale(pos, LY_PER_UNIT), radius: 230 - i * 30, lore: ancestralLore[i] };
    ancestral.push(p);
    b.provinces.push(p);
  }
  const streams: Province[] = [];
  for (let i = 0; i < 2; i++) {
    const theta = baseTheta + Math.PI / 3 + i * Math.PI + rng.range(-0.3, 0.3);
    const pos = scale(dirFromAngles(theta, rng.range(-0.3, 0.3)), rng.range(760, 860));
    const p: Province = { id: `p_str${i}`, name: `The ${properName(rng, 2)} Stream`, kind: 'stream', pos, phys: scale(pos, LY_PER_UNIT), radius: 140, lore: 'A tidal stream: the pulled-out remains of a dwarf galaxy, still strung along its old orbit.' };
    streams.push(p);
    b.provinces.push(p);
  }
  const halo: Province = { id: 'p_halo', name: 'The Halo', kind: 'halo', pos: v(0, 0, 0), phys: v(0, 0, 0), radius: 1050, lore: 'The thin outskirts, where ancient globular clusters swing through a sea of dark matter.' };
  b.provinces.push(halo);
  const voidP: Province = { id: 'p_void', name: 'The Void', kind: 'void', pos: v(0, 0, 0), phys: v(0, 0, 0), radius: 4000, lore: 'Beyond the Coalescence: nothing. Every other galaxy crossed the cosmic horizon trillions of years ago.' };
  b.provinces.push(voidP);

  // ---- regions & systems
  const coreRegion = b.makeRegion(core, 'The Heart', v(0, 0, 0), 55, 'core');
  const coreSystems = b.fillRegion(coreRegion, 7, CORE_WEIGHTS, 0.8);
  const heart = b.addSystem(coreRegion, v(0, 0, 0), 'smbh', 'core');
  heart.name = 'The Heart';

  const reaches: Region[] = [];
  const reachSystems: Record<string, StarSystem[]> = {};
  ancestral.forEach((p, i) => {
    const nReach = i === 0 ? 3 : i === 1 ? 3 : 2;
    for (let k = 0; k < nReach; k++) {
      const off = randomInSphere(rng, p.radius * 0.8, 0.35);
      const r = b.makeRegion(p, `${properName(rng, 2)} ${rng.pick(['Reach', 'Drift', 'Shoal', 'Hollow', 'Verge', 'Mere', 'Strand'])}`, add(p.pos, off), rng.range(36, 48), 'reach');
      reaches.push(r);
      reachSystems[r.id] = b.fillRegion(r, rng.int(10, 13), REACH_WEIGHTS);
    }
  });
  streams.forEach((p) => {
    const r = b.makeRegion(p, `${p.name.replace('The ', '')}`, p.pos, 44, 'reach');
    reaches.push(r);
    reachSystems[r.id] = b.fillRegion(r, rng.int(7, 9), { ...REACH_WEIGHTS, white_dwarf: 45, brown_dwarf: 25 }, 0.3);
  });
  const globulars: Region[] = [];
  for (let i = 0; i < 2; i++) {
    const pos = scale(dirFromAngles(rng.range(0, Math.PI * 2), rng.range(0.45, 0.9) * (i === 0 ? 1 : -1)), rng.range(820, 980));
    const r = b.makeRegion(halo, `Cluster ${rng.pick(['Ossa', 'Keth', 'Umber', 'Lanthe', 'Mora', 'Sill'])}`, pos, 22, 'globular');
    globulars.push(r);
    b.fillRegion(r, rng.int(6, 8), GLOBULAR_WEIGHTS, 1);
    if (rng.chance(0.8)) {
      const imbh = b.addSystem(r, v(0, 0, 0), 'black_hole');
      imbh.primary.mass = Math.pow(10, rng.range(3, 3.8));
      imbh.primary.spinMax = imbh.primary.spin = 3000;
      imbh.primary.evaporateAt = hawkingTime(imbh.primary.mass);
      imbh.name = `${r.name.replace('Cluster ', '')} Well`;
    }
  }
  // outliers in the void
  const runaway = b.makeRegion(voidP, 'The Runaway', scale(dirFromAngles(rng.range(0, Math.PI * 2), rng.range(-0.3, 0.3)), 2600), 18, 'outlier', OUTLIER_LY_PER_UNIT);
  b.fillRegion(runaway, 3, { red_dwarf: 40, white_dwarf: 40, brown_dwarf: 20 }, 1).forEach((s) => (s.special = 'outlier'));
  const wanderer = b.makeRegion(voidP, 'The Wanderer', scale(dirFromAngles(rng.range(0, Math.PI * 2), rng.range(-0.6, 0.6)), 3300), 6, 'outlier', OUTLIER_LY_PER_UNIT);
  const wSys = b.addSystem(wanderer, v(0, 0, 0), 'black_hole', 'outlier');
  wSys.primary.mass = 2.2e5;
  wSys.primary.spinMax = wSys.primary.spin = 9000;
  wSys.primary.evaporateAt = hawkingTime(wSys.primary.mass);
  wSys.name = 'The Wanderer';

  // ---- home: an outer reach of the largest ancestor
  const homeReach = reaches
    .filter((r) => b.provinces.find((p) => p.id === r.provinceId)?.kind === 'ancestral')
    .sort((a, c) => Math.hypot(c.pos.x, c.pos.z) - Math.hypot(a.pos.x, a.pos.z))[0];
  // make sure the home reach has company: extra red dwarfs and a brown dwarf
  for (let i = 0; i < 4; i++) {
    const local = randomInSphere(rng, homeReach.radiusLy, 0.5);
    reachSystems[homeReach.id].push(b.addSystem(homeReach, local, i < 3 ? 'red_dwarf' : 'brown_dwarf'));
  }
  const home = b.addSystem(homeReach, v(0, 0, 0), 'red_dwarf', 'home');
  // replace generated bodies with the home system's fixed layout
  for (const id of home.bodies) delete b.bodies[id];
  home.bodies = [];
  home.name = properName(rng, 2);
  home.primary = { kind: 'red_dwarf', mass: 0.1, lum: 1.0, blueAt: 9.94e13, whiteAt: 9.94e13 + 4e9, spin: 0, spinMax: 0 };
  b.addBody(home, 'deep', 0, 0, 0);
  const inner = b.addBody(home, 'barren', 0.014, 0.4, 0);
  inner.richness = 1.6;
  const hw = b.addBody(home, 'eyeball', 0.031, 1.0, 1);
  hw.name = settings.homeName;
  Object.assign(hw, { habitability: 0.85, vitality: 1.0, decline: 0.012, coreHeat: 0.8, richness: 1.0, water: 0.42, relic: undefined });
  hw.traits = ['homeworld', 'tidally_locked', 'failing_dynamo'];
  hw.size = 2.0;
  hw.inspiralAt = START_YEARS + inspiralTime(0.031, 1, 0.1);
  const ice = b.addBody(home, 'ocean_ice', 0.058, 0.3, 2);
  ice.traits = ['subsurface_ocean'];
  ice.vitality = 0.12;
  const belt = b.addBody(home, 'asteroids', 0.1, 0.001, 3);
  belt.richness = 2.2;
  const cold = b.addBody(home, 'super_earth', 0.17, 3.2, 4);
  cold.relic = { kind: 'tomb', state: 'hidden' };

  // ---- survivors in other reaches
  const survivors: Record<string, Survivor> = {};
  const otherReaches = reaches.filter((r) => r.id !== homeReach.id);
  rng.shuffle(otherReaches);
  const picks = rng.shuffle([...SURVIVOR_NAMES]).slice(0, Math.max(0, Math.min(4, settings.survivors)));
  // not next door, but not out of reach either: the first lives in one of the two clusters
  // nearest ours, the second in one of the nearest five, the rest anywhere. (Chosen from the
  // shuffled order, so the rest of the galaxy is generated exactly as before.)
  const reachDist = (r: (typeof reaches)[number]) => Math.hypot(r.phys.x - homeReach.phys.x, r.phys.y - homeReach.phys.y, r.phys.z - homeReach.phys.z);
  const nearest = [...otherReaches].sort((a, c) => reachDist(a) - reachDist(c));
  const taken = new Set<string>();
  const reachFor = (i: number) => {
    const near = new Set((i === 0 ? nearest.slice(0, 2) : i === 1 ? nearest.slice(0, 5) : nearest).map((r) => r.id));
    const r = otherReaches.find((x) => near.has(x.id) && !taken.has(x.id)) ?? otherReaches.find((x) => !taken.has(x.id)) ?? otherReaches[i % otherReaches.length];
    taken.add(r.id);
    return r;
  };
  picks.forEach((sv, i) => {
    const reach = reachFor(i);
    const sys = b.addSystem(reach, randomInSphere(rng, reach.radiusLy * 0.4, 0.5), sv.way === 'lattice' ? 'brown_dwarf' : 'red_dwarf', 'survivor');
    const id = `sv${i}`;
    survivors[id] = {
      id,
      kind: 'survivor',
      name: sv.name,
      adjective: sv.adjective,
      color: sv.color,
      way: sv.way,
      homeSystemId: sys.id,
      systems: [sys.id],
      pop: rng.range(18, 30),
      health: rng.range(0.75, 0.95),
      reserve: 40,
      disposition: rng.range(-10, 25),
      clock: sv.way === 'dormant' ? 6 : sv.way === 'upload' ? 3 : 1.7,
      contact: false,
      alive: true,
      aidGiven: 0,
      lastSent: 0,
    };
  });

  // ---- sleeper vault: one guaranteed, far from home
  const vaultReach = otherReaches[otherReaches.length - 1] ?? homeReach;
  const vault = b.addSystem(vaultReach, randomInSphere(rng, vaultReach.radiusLy * 0.6, 0.5), 'white_dwarf', 'sleeper');
  const vaultBody = b.bodies[vault.bodies[vault.bodies.length - 1]] ?? b.addBody(vault, 'barren', 2, 0.5, 0);
  vaultBody.relic = { kind: 'sleepers', state: 'hidden' };
  vault.name = properName(rng, 3);

  const civ = makeCiv(settings, home.id);
  // the fate of matter: as chosen, or one draw (the same single draw as ever, so no galaxy changes)
  const fate: Fate = settings.protonFate === 'decays' ? 'decay' : settings.protonFate === 'stable' ? 'stable' : settings.protonFate === 'curvature' ? 'curvature' : drawFate(rng.next());
  const state: GameState = {
    v: 1,
    settings,
    rng: hashSeed(settings.seed * 7 + 13),
    turn: 1,
    era: 'dusk',
    eraTurn: 0,
    years: START_YEARS,
    eta: Math.log10(START_YEARS),
    turnLength: ERA_BY_ID.dusk.l0,
    protonsDecay: fate === 'decay',
    fate,
    gfe: 1,
    provinces: b.provinces,
    regions: b.regions,
    systems: b.systems,
    bodies: b.bodies,
    colonies: {},
    fleets: {},
    civ,
    survivors,
    minds: {
      slow: { id: 'slow', kind: 'slow', name: 'The Slow Ones', systemId: heart.id, stage: 0, understanding: 0, clock: 6.5, lastPattern: [], flags: {} },
      dark: { id: 'dark', kind: 'dark', name: 'The Unlit', systemId: null, stage: 0, understanding: 0, clock: 5, lastPattern: [], flags: {} },
    },
    swarms: {},
    signals: [],
    forecasts: [],
    pending: [],
    log: [],
    battles: [],
    nextId: 1,
    crossing: null,
    outcome: null,
    flags: {},
    fired: {},
  };
  void coreSystems;
  void globulars;

  // ---- dormant Hunger nests: far from home, at least one in a globular or stream
  const nestCandidates = Object.values(state.systems).filter((s) => {
    const r = b.regions.find((x) => x.id === s.regionId);
    return r && r.id !== homeReach.id && (r.kind === 'globular' || r.kind === 'reach') && !s.special;
  });
  rng.shuffle(nestCandidates);
  const nests = settings.difficulty === 'harsh' ? 3 : settings.difficulty === 'gentle' ? 1 : 2;
  // one nest lies in a cluster near ours, where the first probes will find it; the rest anywhere
  // (picked from the same shuffled order, so the galaxy itself is unchanged)
  const near3 = new Set(nearest.slice(0, 2).map((r) => r.id));
  const first = nestCandidates.findIndex((s) => near3.has(s.regionId));
  if (first > 0) nestCandidates.unshift(...nestCandidates.splice(first, 1));
  nestCandidates.slice(0, nests).forEach((s, i) => {
    const id = `hg${i}`;
    state.swarms[id] = { id, systemId: s.id, from: null, to: null, traveled: 0, distance: 0, size: 2 + i, awake: false, tamed: false, appetite: 1 };
    s.rust = 0.15;
  });

  // ---- knowledge: the home reach is charted
  for (const s of Object.values(state.systems)) {
    if (s.regionId === homeReach.id) civ.known[s.id] = 1;
  }
  civ.known[home.id] = 2;
  civ.known[heart.id] = 1; // the Heart is visible from anywhere

  return state;
}

function makeCiv(settings: GameSettings, homeSystemId: string): Civ {
  return {
    name: settings.civName,
    homeSystemId,
    capitalId: null,
    energy: 60,
    matter: 120,
    accord: 15,
    resolve: 62,
    dissent: 12,
    standing: freshThreadRecord(60),
    lowStanding: freshThreadRecord(0),
    demands: { kin: null, echoes: null, chorus: null, lattice: null, coldminds: null },
    techs: [],
    researching: null,
    research: {},
    work: null,
    works: {},
    charters: [],
    pace: 0,
    dormant: false,
    sleepTurns: 0,
    wakeBonus: 0,
    known: {},
    continuity: 100,
    taint: 0,
    flags: {},
    stats: { pops: [], energy: [], resolve: [] },
  };
}

export function systemDistanceLy(a: StarSystem, c: StarSystem): number {
  return Math.hypot(a.phys.x - c.phys.x, a.phys.y - c.phys.y, a.phys.z - c.phys.z);
}

/** Share of a world's surface under water or ice, by kind (u in 0..1 picks within the range). */
export function defaultWater(kind: BodyKind, u = 0.5): number {
  switch (kind) {
    case 'eyeball':
      return 0.25 + 0.3 * u;
    case 'terran':
      return 0.3 + 0.45 * u;
    case 'super_earth':
      return 0.05 + 0.35 * u;
    case 'ocean_ice':
      return 0.95 + 0.05 * u;
    case 'ice':
      return 0.3 + 0.4 * u;
    case 'asteroids':
      return 0.02 + 0.08 * u;
    case 'barren':
      return 0.01 * u;
    default:
      return 0;
  }
}

/** An unknown fate of matter, from one uniform draw: protons decay half the time, curvature radiation a quarter, stable a quarter. */
export function drawFate(u: number): Fate {
  return u < 0.5 ? 'decay' : u < 0.75 ? 'curvature' : 'stable';
}
