import { hawkingTime } from './gen';
import type { Body, EraId, GameState, Primary, StarSystem } from './types';

// Where the light comes from, era by era. Values are era-normalised "light factors": the
// share of a structure's nominal capture a source supports per Tide turn. Physical ratios
// between eras are absorbed by Dyson scaling (slower, colder minds need less per thought),
// so each era's economy stays readable while its sources stay scarce and finite.

export interface SourceInfo {
  light: number; // light factor available to collectors this turn
  label: string; // physical description for the UI
  temperatureK: number; // for colour
  alive: [number, number] | null; // cosmic-year window for short-lived sources
}

const LAST_LIGHT = 1e14;

/** Blackbody-ish surface temperature by primary kind and state (used for colours and text). */
export function primaryTemperature(p: Primary, years: number, era: EraId): number {
  switch (p.kind) {
    case 'red_dwarf':
      return 2700 + (p.mass - 0.08) * 6000;
    case 'blue_dwarf':
      return 8200;
    case 'collision_star':
      return 2900;
    case 'helium_star':
      return 42000;
    case 'helium_giant':
      return 6500;
    case 'dark_star':
      return 4200;
    case 'white_dwarf':
      if (era === 'dusk') return p.whiteAt && years - p.whiteAt < 5e9 ? 12000 : 3800;
      return p.halo && years < 1e25 ? 63 : 20;
    case 'black_dwarf':
      return p.rekindle ? 300 : 5;
    case 'brown_dwarf':
      return era === 'dusk' ? 420 : 60;
    case 'neutron_star':
      return era === 'dusk' ? 30000 : 900;
    default:
      return 0;
  }
}

/** The light a primary supplies, era-normalised, for the turn [years, years + L]. */
export function sourceLight(state: GameState, sys: StarSystem, years: number, L: number): SourceInfo {
  const p = sys.primary;
  const era = state.era;
  const gfe = state.gfe;
  const rek = p.rekindle ?? 0;
  switch (p.kind) {
    case 'red_dwarf':
      return { light: p.lum, label: 'Red dwarf, main sequence', temperatureK: primaryTemperature(p, years, era), alive: null };
    case 'blue_dwarf': {
      // a few billion years of flare: a turn that outlasts it gets its share, then a young white dwarf
      const from = p.blueAt ?? years;
      const to = p.whiteAt ?? Infinity;
      const overlap = Math.max(0, Math.min(to, years + L) - Math.max(from, years));
      const share = L > 0 ? Math.min(1, overlap / L) : 1;
      return { light: p.lum * (0.3 + 2.7 * share), label: 'Blue dwarf: a red dwarf in its last bright flare', temperatureK: 8200, alive: null };
    }
    case 'white_dwarf': {
      if (era === 'dusk') {
        const age = p.whiteAt ? years - p.whiteAt : 1e13;
        const young = p.whiteAt ? 0.45 * Math.pow(1 + Math.max(0, age) / 1e9, -1.2) : 0;
        return { light: Math.max(0.02, young), label: p.whiteAt ? 'White dwarf, newly collapsed and cooling' : 'Old white dwarf, nearly cold', temperatureK: primaryTemperature(p, years, era), alive: null };
      }
      if (era === 'degenerate') {
        const e = Math.log10(Math.max(1, years));
        const ember = p.halo ? (e < 22 ? 1 : Math.max(0, (25 - e) / 3)) : 0;
        const light = (0.05 + ember) * (0.35 + 0.65 * gfe) + rek;
        return { light, label: ember > 0 ? 'Ember: a white dwarf warmed by dark matter annihilating inside it (about 63 K)' : 'White dwarf, cold', temperatureK: ember > 0 ? 63 : 20, alive: null };
      }
      return { light: rek, label: 'Cold white dwarf', temperatureK: 5, alive: null };
    }
    case 'black_dwarf':
      return { light: 0.01 + rek, label: rek > 0 ? 'Black dwarf, rekindled by an infalling world' : 'Black dwarf: a white dwarf gone cold', temperatureK: rek > 0 ? 300 : 5, alive: null };
    case 'brown_dwarf':
      return { light: era === 'dusk' ? 0.03 : 0.02 * gfe, label: 'Brown dwarf: a star that never ignited', temperatureK: primaryTemperature(p, years, era), alive: null };
    case 'neutron_star': {
      const light = era === 'dusk' ? 0.1 : era === 'degenerate' ? 0.25 * Math.max(0, 1 - (Math.log10(years) - 15) / 12) * (0.4 + 0.6 * gfe) : 0;
      return { light, label: 'Neutron star, slowly spinning down', temperatureK: primaryTemperature(p, years, era), alive: null };
    }
    case 'dark_star': {
      const born = p.bornAt ?? years;
      const dies = p.diesAt ?? years;
      const overlap = Math.max(0, Math.min(dies, years + L) - Math.max(born, years));
      const frac = L > 0 ? Math.min(1, overlap / L) : 1;
      return { light: 10 * frac, label: 'The Last Star: a star burning dark matter, the last new star there will ever be', temperatureK: 4200, alive: [born, dies] };
    }
    case 'collision_star':
    case 'helium_star':
    case 'helium_giant': {
      const base = p.kind === 'collision_star' ? 4 : p.kind === 'helium_star' ? 14 : 70;
      const born = p.bornAt ?? years;
      const dies = p.diesAt ?? years;
      const overlap = Math.max(0, Math.min(dies, years + L) - Math.max(born, years));
      const frac = L > 0 ? Math.min(1, overlap / L) : 0;
      const label =
        p.kind === 'collision_star'
          ? 'Collision star: two brown dwarfs merged and ignited hydrogen'
          : p.kind === 'helium_star'
            ? 'Helium star: two white dwarfs merged and ignited helium'
            : 'Helium giant: a merger remnant burning its last shells, blindingly bright';
      return { light: base * frac * (0.5 + 0.5 * gfe), label, temperatureK: primaryTemperature(p, years, era), alive: [born, dies] };
    }
    case 'black_hole':
    case 'smbh': {
      // collectors see the accretion disk. The Heart's disk is fed by its crowded core
      // (stars torn apart, stellar winds), bright in the Dusk and fading as those stars die;
      // a lone stellar hole has only a faint trickle of infalling gas
      const disk = diskLight(p.kind, era, years) * (0.35 + 0.65 * gfe);
      const label =
        p.kind === 'smbh'
          ? disk > 0.3
            ? 'Supermassive black hole: its accretion disk, fed by the crowded Heart, still shines'
            : disk > 0
              ? 'Supermassive black hole: a dimming disk, fed only now and then'
              : 'Supermassive black hole, quiet'
          : disk > 0
            ? 'Black hole with a faint accretion disk'
            : 'Black hole';
      return { light: disk, label, temperatureK: 0, alive: null };
    }
    default:
      return { light: 0, label: sys.primary.kind === 'rogue' ? 'Starless: rogue worlds drifting alone' : 'Nothing remains', temperatureK: 0, alive: null };
  }
}

/** Hawking power available to collectors (Black Hole Era), rising as the hole shrinks. */
export function hawkingLight(p: Primary, years: number): number {
  if (!p.evaporateAt || years >= p.evaporateAt) return 0;
  const f = Math.min(0.999, years / p.evaporateAt);
  const base = p.kind === 'smbh' ? 0.004 : p.mass > 1000 ? 0.04 : 0.35;
  return Math.min(25, base * Math.pow(1 - f, -2 / 3));
}

// ---------------------------------------------------------------- stellar evolution

export interface EvolutionNote {
  systemId: string;
  kind:
    | 'blue'
    | 'white'
    | 'collision'
    | 'merger'
    | 'giant'
    | 'burnout'
    | 'supernova'
    | 'rogue'
    | 'feeding'
    | 'rekindle'
    | 'plunge'
    | 'ejected'
    | 'swallowed'
    | 'evaporated'
    | 'dissolved';
  bodyId?: string;
}

/** Advance every primary and body to cosmic year `to` (from `from`). Returns what happened. */
export function evolveUniverse(state: GameState, from: number, to: number, rand: () => number): EvolutionNote[] {
  const notes: EvolutionNote[] = [];
  const L = to - from;
  const e = Math.log10(Math.max(1, to));
  const systems = Object.values(state.systems);
  for (const sys of systems) {
    if (sys.gone) continue;
    const p = sys.primary;
    // main-sequence endings
    if (p.kind === 'red_dwarf' && p.blueAt && to >= p.blueAt) {
      p.kind = 'blue_dwarf';
      notes.push({ systemId: sys.id, kind: 'blue' });
    }
    if (p.kind === 'blue_dwarf' && p.whiteAt && to >= p.whiteAt) {
      p.kind = 'white_dwarf';
      p.mass = Math.max(0.08, p.mass * 0.95);
      p.halo = rand() < 0.6;
      notes.push({ systemId: sys.id, kind: 'white' });
    }
    // short-lived stars
    if (p.kind === 'dark_star' && p.diesAt && to >= p.diesAt) {
      p.kind = 'black_dwarf';
      p.bornAt = undefined;
      p.diesAt = undefined;
      notes.push({ systemId: sys.id, kind: 'burnout' });
    }
    if ((p.kind === 'collision_star' || p.kind === 'helium_star' || p.kind === 'helium_giant') && p.diesAt && to >= p.diesAt) {
      if (p.kind === 'helium_star' && (p.mass >= 0.9 || rand() < 0.3) && !sys.primary.rekindle) {
        // massive merger remnants swell into a brief, brilliant helium giant
        p.kind = 'helium_giant';
        p.bornAt = p.diesAt;
        p.diesAt = p.diesAt + 1.2e5;
        notes.push({ systemId: sys.id, kind: 'giant' });
      } else {
        p.kind = p.kind === 'collision_star' ? 'white_dwarf' : 'white_dwarf';
        p.halo = false;
        p.lum = 0.02;
        p.bornAt = undefined;
        p.diesAt = undefined;
        notes.push({ systemId: sys.id, kind: 'burnout' });
      }
    }
    // white dwarfs go cold after the embers fade
    if (p.kind === 'white_dwarf' && state.era !== 'dusk' && e > 25.5) p.kind = 'black_dwarf';
    // rekindled dwarfs: feeding worlds fade as (1 + t/tau)^-2
    let rek = 0;
    for (const bid of sys.bodies) {
      const b = state.bodies[bid];
      if (!b || b.dissolved) continue;
      if (b.feeding) {
        const t = Math.max(0, to - b.feeding.start);
        const k = b.feeding.model === 'rekindle' ? 8 : 1;
        const power = b.feeding.base * k * Math.pow(1 + t / b.feeding.tau, -2);
        rek += power;
        if (t > 30 * b.feeding.tau) {
          b.dissolved = true;
          notes.push({ systemId: sys.id, kind: 'plunge', bodyId: b.id });
        }
      }
    }
    p.rekindle = rek > 0.001 ? rek : undefined;

    // planets: close passes strip them (while bound in the galaxy); degenerate hosts pull them in
    for (const bid of sys.bodies) {
      const b = state.bodies[bid];
      if (!b || b.kind === 'deep' || b.dissolved || b.rogue || b.feeding) continue;
      if (!sys.ejected && b.orbitAU > 0 && state.era !== 'blackhole' && state.era !== 'dark') {
        const density = sys.special === 'core' ? 3 : state.regions.find((r) => r.id === sys.regionId)?.kind === 'globular' ? 4 : 1;
        const tau = 1e15 / (density * Math.pow(Math.max(0.01, b.orbitAU), 2)) * 25;
        const pRogue = 1 - Math.exp(-L / tau);
        if (rand() < pRogue) {
          b.rogue = true;
          notes.push({ systemId: sys.id, kind: 'rogue', bodyId: b.id });
          continue;
        }
      }
      const degenerate = p.kind === 'white_dwarf' || p.kind === 'black_dwarf' || p.kind === 'neutron_star';
      if (degenerate && b.inspiralAt && to >= b.inspiralAt && b.orbitAU > 0) {
        const jupiter = b.massEarth > 50;
        const rekindle = rand() < (jupiter ? 0.35 : 0.2);
        b.feeding = {
          start: Math.max(from, b.inspiralAt),
          tau: jupiter ? 1e13 : Math.pow(10, 14.2 + rand() * 1.2),
          base: (jupiter ? 5 : 1) * Math.min(3, Math.max(0.3, b.massEarth / (jupiter ? 318 : 1))),
          model: rekindle ? 'rekindle' : 'feed',
          revealed: false,
        };
        b.vitality = 0;
        notes.push({ systemId: sys.id, kind: rekindle ? 'rekindle' : 'feeding', bodyId: b.id });
      }
    }
  }

  // Degenerate Age: collisions and mergers light rare, short stars
  if (state.era === 'degenerate') {
    const collisionRate = e < 23 ? Math.min(0.6, L / 4e12) * state.gfe : 0;
    if (rand() < collisionRate) {
      const bds = systems.filter((s) => s.primary.kind === 'brown_dwarf' && !s.gone && !s.ejected);
      if (bds.length) {
        const s = bds[Math.floor(rand() * bds.length)];
        const born = from + rand() * L;
        s.primary.kind = 'collision_star';
        s.primary.mass = 0.1;
        s.primary.bornAt = born;
        s.primary.diesAt = born + Math.pow(10, 12 + rand());
        notes.push({ systemId: s.id, kind: 'collision' });
      }
    }
    const mergerRate = e < 25 ? Math.min(0.35, L / 3e13) * state.gfe : 0;
    if (rand() < mergerRate) {
      const wds = systems.filter((s) => (s.primary.kind === 'white_dwarf' || s.primary.kind === 'black_dwarf') && !s.gone);
      if (wds.length) {
        const s = wds[Math.floor(rand() * wds.length)];
        const born = from + rand() * L;
        if (rand() < 0.1) {
          // super-Chandrasekhar merger: a Type Ia supernova
          notes.push({ systemId: s.id, kind: 'supernova' });
          s.primary.kind = 'void';
          s.primary.lum = 0;
          for (const bid of s.bodies) {
            const b = state.bodies[bid];
            if (b && b.kind !== 'deep') b.dissolved = true;
          }
        } else {
          s.primary.kind = 'helium_star';
          s.primary.mass = 0.4 + rand() * 0.7;
          s.primary.bornAt = born;
          s.primary.diesAt = born + (0.8 + rand() * 2.2) * 1e8;
          notes.push({ systemId: s.id, kind: 'merger' });
        }
      }
    }
    // galactic evaporation: most remnants ejected, a few fall into the Heart
    if (e > 18.4 && e < 21) {
      const pEject = Math.min(0.5, 0.22 * (Math.log10(L) - 17));
      for (const s of systems) {
        if (s.ejected || s.gone || s.special === 'core' || s.special === 'home') continue;
        if (rand() < pEject * 0.25) {
          if (rand() < 0.08 && s.primary.kind !== 'smbh') {
            s.gone = true;
            const heart = systems.find((x) => x.primary.kind === 'smbh');
            if (heart) growHeart(heart.primary, s.primary.mass);
            notes.push({ systemId: s.id, kind: 'swallowed' });
          } else {
            s.ejected = true;
            notes.push({ systemId: s.id, kind: 'ejected' });
          }
        }
      }
      // galactic infall feeds the Heart over the whole evaporation epoch
      const heart = systems.find((x) => x.primary.kind === 'smbh');
      if (heart) growHeart(heart.primary, 4.6e10 * Math.min(1, L / 5e20));
    }
    // proton decay dissolves ordinary matter near the end of the age
    if (state.protonsDecay && e > 37.5) {
      for (const s of systems) {
        if (s.primary.kind === 'black_hole' || s.primary.kind === 'smbh' || s.gone) continue;
        const pDis = Math.min(1, (e - 37.5) / 1.5);
        if (rand() < pDis) {
          s.primary.kind = 'void';
          s.primary.lum = 0;
          for (const bid of s.bodies) {
            const b = state.bodies[bid];
            if (b && b.kind !== 'deep') b.dissolved = true;
          }
          notes.push({ systemId: s.id, kind: 'dissolved' });
        }
      }
    }
  }

  // Black Hole Era (and beyond): Hawking evaporation, the last bursts
  if (state.era === 'blackhole' || state.era === 'dark') {
    for (const s of systems) {
      const p = s.primary;
      if ((p.kind === 'black_hole' || p.kind === 'smbh') && p.evaporateAt && to >= p.evaporateAt && !s.gone) {
        p.kind = 'void';
        s.gone = true;
        notes.push({ systemId: s.id, kind: 'evaporated' });
      }
    }
  }
  return notes;
}

function growHeart(p: Primary, dm: number) {
  p.mass = Math.min(4.6e10, p.mass + dm);
  p.evaporateAt = hawkingTime(p.mass);
  p.spinMax = Math.max(p.spinMax, 40000 + p.mass / 2e6);
}

/** When will this system's star next change? (for forecasts) */
export function nextStellarChange(sys: StarSystem, years: number): { at: number; what: string } | null {
  const p = sys.primary;
  if (p.kind === 'red_dwarf' && p.blueAt && p.blueAt > years) return { at: p.blueAt, what: 'leaves the main sequence and brightens into a blue dwarf' };
  if (p.kind === 'blue_dwarf' && p.whiteAt && p.whiteAt > years) return { at: p.whiteAt, what: 'collapses into a white dwarf' };
  if ((p.kind === 'collision_star' || p.kind === 'helium_star' || p.kind === 'helium_giant') && p.diesAt && p.diesAt > years) return { at: p.diesAt, what: 'burns out' };
  if ((p.kind === 'black_hole' || p.kind === 'smbh') && p.evaporateAt && p.evaporateAt > years) return { at: p.evaporateAt, what: 'evaporates in a final burst of Hawking radiation' };
  return null;
}

export function isStarLike(p: Primary): boolean {
  return ['red_dwarf', 'blue_dwarf', 'collision_star', 'helium_star', 'helium_giant', 'dark_star'].includes(p.kind);
}

export function bodyIsGone(b: Body): boolean {
  return !!b.dissolved;
}

export const LAST_LIGHT_YEARS = LAST_LIGHT;

/**
 * Approximate luminosity of a primary in solar units, for surface temperatures shown to the
 * player. (The economy uses era-normalised light factors instead; see sourceLight.)
 */
export function primaryLuminosity(p: Primary, years: number, era: EraId): number {
  const m = Math.max(0.01, p.mass);
  switch (p.kind) {
    case 'red_dwarf':
    case 'collision_star':
      return 0.23 * Math.pow(m, 2.3); // lower main sequence
    case 'blue_dwarf':
      return Math.min(0.4, 2 * m); // a red dwarf's last bright phase, about a third of the Sun at peak
    case 'helium_star':
      return 30;
    case 'helium_giant':
      return 1000;
    case 'dark_star':
      return 1;
    case 'white_dwarf': {
      if (era === 'dusk') {
        const age = p.whiteAt ? Math.max(0, years - p.whiteAt) : 1e13;
        return 0.01 * Math.pow(1 + age / 1e8, -1.3);
      }
      if (era === 'degenerate' && p.halo && years < 1e25) return 4e-12; // warmed by dark matter
      return 1e-15 + (p.rekindle ?? 0) * 1e-6;
    }
    case 'black_dwarf':
      return 1e-17 + (p.rekindle ?? 0) * 1e-6;
    case 'brown_dwarf':
      return era === 'dusk' ? 1e-6 : 1e-8;
    case 'neutron_star':
      return era === 'dusk' ? 1e-5 : 1e-9;
    default:
      return 0;
  }
}

export interface BodyClimate {
  mean: number; // K
  day?: number; // tidally locked worlds
  night?: number;
}

/** Surface temperature: starlight (equilibrium, albedo 0.3), the world's own heat, a little greenhouse. */
export function bodyClimate(state: GameState, b: Body): BodyClimate {
  const sys = state.systems[b.systemId];
  const L = b.rogue ? 0 : primaryLuminosity(sys.primary, state.years, state.era);
  const a = Math.max(0.003, b.orbitAU);
  const tEq = L > 0 ? 278 * Math.pow(L, 0.25) * Math.pow(0.7, 0.25) / Math.sqrt(a) : 0;
  const tInt = 40 * b.coreHeat;
  let t = Math.pow(Math.pow(tEq, 4) + Math.pow(tInt, 4), 0.25);
  if (b.kind === 'eyeball' || b.kind === 'terran' || b.kind === 'super_earth') t *= 1 + 0.12 * b.vitality;
  t = Math.max(1, t);
  if (b.traits.includes('tidally_locked') && tEq > 0) {
    // the day side faces the star for ever; air and sea carry some heat round to the night
    const airless = b.kind === 'barren' || b.kind === 'asteroids';
    if (airless) return { mean: t, day: t * 1.4, night: Math.max(tInt, t * 0.12) };
    const carry = 0.25 + 0.45 * b.vitality;
    return { mean: t, day: t * (1.3 - 0.15 * carry), night: Math.max(tInt, t * (0.35 + 0.4 * carry)) };
  }
  return { mean: t };
}

/**
 * Sunlight on a world's surface relative to its star's standard orbit, by the inverse-square law:
 * what surface Solar Arrays catch (orbital collectors sit wherever the light is best and do not
 * care). For burning stars the standard orbit follows the star's mass and is set so the
 * homeworld (0.031 AU around 0.1 M☉) gets exactly ×1; around remnants, whose light the game
 * scales to the age, it is the system's middle orbit. Kept between ×0.05 and ×2.5.
 */
export function insolation(state: GameState, b: Body): number {
  if (b.rogue) return 0;
  const sys = state.systems[b.systemId];
  if (!sys) return 1;
  const p = sys.primary;
  let aStd: number;
  if (p.kind === 'red_dwarf' || p.kind === 'blue_dwarf' || p.kind === 'collision_star') {
    aStd = 0.031 * Math.pow(Math.max(0.05, p.mass) / 0.1, 1.15);
  } else {
    const orbits = sys.bodies
      .map((id) => state.bodies[id])
      .filter((x) => x && x.kind !== 'deep' && !x.dissolved && !x.rogue && x.orbitAU > 0)
      .map((x) => x.orbitAU)
      .sort((x, y) => x - y);
    aStd = orbits.length ? orbits[Math.floor(orbits.length / 2)] : b.orbitAU;
  }
  return Math.min(2.5, Math.max(0.05, (aStd / Math.max(0.003, b.orbitAU)) ** 2));
}

/** A plain description of a world's water at its current temperature. */
export function waterState(b: Body, climate: BodyClimate): string {
  const w = b.water ?? 0;
  if (w <= 0.005) return 'none';
  const share = `${Math.round(w * 100)}%`;
  if (b.kind === 'ocean_ice') return `${share}: a global ocean under the ice`;
  if (b.kind === 'asteroids') return `${share}: ice in the rubble`;
  const liquidAt = (k: number) => k >= 273 && k < 373;
  if (climate.day !== undefined && climate.night !== undefined) {
    if (liquidAt(climate.day) && !liquidAt(climate.night)) return `${share}: open sea on the day side, ice beyond the terminator`;
    if (liquidAt(climate.day)) return `${share}: open water`;
    if (climate.day >= 373) return `${share}: boiled off the day side, ice on the night side`;
    return `${share}: all frozen`;
  }
  if (liquidAt(climate.mean)) return `${share}: open water`;
  if (climate.mean >= 373) return `${share}: steam`;
  return `${share}: frozen`;
}

/**
 * Light from a black hole's accretion disk, in collector units (a red dwarf's light = 1).
 * Also sets how brightly the disk is drawn, so what you see is what collectors get.
 */
export function diskLight(kind: 'black_hole' | 'smbh', era: string, years: number): number {
  if (kind === 'smbh') {
    if (era === 'dusk') return 1.5;
    if (era === 'degenerate') {
      // the Heart's stars die and scatter across the age: from bright to a trickle
      const e = Math.log10(Math.max(1, years));
      return Math.max(0.15, 1.2 - (e - 15) * 0.07);
    }
    if (era === 'blackhole') return 0.08;
    return 0;
  }
  return era === 'dusk' || era === 'degenerate' ? 0.05 : 0;
}
