import { STRUCTURE_BY_ID } from './data/structures';
import { hawkingTime } from './gen';
import type { Body, Colony, EraId, GameState, Primary, PrimaryKind, StarSystem } from './types';
import { calendarEra } from './fate';

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

/**
 * A white dwarf no dark matter warms, in the Degenerate Age: about 20 K as the age opens, then
 * cooling by Mestel’s law (L ∝ t^-1.4, so T ∝ t^-0.35) down to the 5 K the game gives a black
 * dwarf, which it reaches about η 16.7 and is then called. Nothing happens to a dwarf at 5 K but
 * its name; a real one would go on cooling, and faster than Mestel’s law once its core has
 * crystallised. The floor is the game’s, so that a cold dwarf is worth a little rather than nothing.
 */
const DWARF_START_K = 20;
const BLACK_DWARF_K = 5;
const MESTEL_T = -0.35;
/** An ember: a white dwarf warmed by dark matter annihilating inside it (Adams & Laughlin). */
const EMBER_K = 63;

export function coldDwarfK(years: number): number {
  return Math.min(DWARF_START_K, Math.max(BLACK_DWARF_K, DWARF_START_K * Math.pow(Math.max(1, years) / 1e15, MESTEL_T)));
}

/** The year an unwarmed white dwarf has cooled to 5 K: about 5.2 × 10^16 (η 16.7). */
export const DWARF_COLD_AT = 1e15 * Math.pow(BLACK_DWARF_K / DWARF_START_K, 1 / MESTEL_T);

/** The warmth an unwarmed white dwarf has left in the Degenerate Age, by its light (T⁴): 1 at 20 K, 0 at 5 K. */
export function dwarfGlow(years: number): number {
  const t = coldDwarfK(years);
  return (t ** 4 - BLACK_DWARF_K ** 4) / (DWARF_START_K ** 4 - BLACK_DWARF_K ** 4);
}

/**
 * The share of its dark-matter warmth an ember (a white dwarf in the halo) still has: all of it
 * to η 22, then less as the halo runs out, none by η 25. Its light follows this share; its
 * temperature the fourth root of it. One cast out of the galaxy (`haloLeft`) leaves the halo
 * behind and dims over the next tenfold of years, to nothing. (Its own stored heat would last
 * only some 10^11 to 10^13 years, a sliver of a turn this late: what is slow is the leaving, a
 * climb through the thinning outer halo over about a relaxation time, 10^19 to 10^20 years. The
 * game starts the dimming when it is cast out; really it would begin a little before.)
 */
export function emberShare(p: Primary, years: number): number {
  if (!p.halo || p.kind !== 'white_dwarf') return 0;
  const e = Math.log10(Math.max(1, years));
  const halo = e < 22 ? 1 : Math.max(0, (25 - e) / 3);
  if (p.haloLeft === undefined) return halo;
  return halo * Math.max(0, 1 - (e - Math.log10(Math.max(1, p.haloLeft))));
}

/** A white dwarf’s radius in Suns: about the Earth’s at 0.6 M☉, larger for a lighter one (R ∝ M^-1/3). */
function dwarfRadius(p: Primary): number {
  return 0.0125 * Math.cbrt(0.6 / Math.min(1.4, Math.max(0.08, p.mass)));
}

/**
 * A new star (collision star, helium star or helium giant) whose life ended before `years`: a
 * turn outlasted it, and it turns into a white dwarf as the turn ends. Until then it is drawn,
 * and its temperature and light read, as that remnant.
 */
export function newStarOut(p: Primary, years: number): boolean {
  return (p.kind === 'collision_star' || p.kind === 'helium_star' || p.kind === 'helium_giant') && p.diesAt !== undefined && p.diesAt <= years;
}

/** The kind a primary is shown as: an already-out new star as the cold white (or black) dwarf it is becoming. */
export function shownKind(p: Primary, years: number): PrimaryKind {
  if (!newStarOut(p, years)) return p.kind;
  return years >= DWARF_COLD_AT ? 'black_dwarf' : 'white_dwarf';
}

/** Rock melts: above this a dry world’s warmest ground is a crust over glowing magma (basalt erupts at 1,370 to 1,520 K). */
export const LAVA_K = 1500;

/** New stars’ light in Suns: a helium star (42,000 K), and the giant some of them swell into (6,500 K). */
export const NEW_STAR_LUM = { helium_star: 30, helium_giant: 1000 } as const;
/** A helium giant burns about 120,000 years. */
export const GIANT_LIFE = 1.2e5;
/**
 * About 45% of a 42,000 K helium star’s light is ionising ultraviolet. It strips the rock vapour
 * off a molten world long before the star dies: a world whose warmest ground passes this is
 * boiled away. (Rock vapour reaches 0.18 bar at 3,000 K and 1 bar near 3,350 K.)
 */
export const ROCK_BOIL_K = 3000;
/** Rubble evaporates sooner (laboratory rates for forsterite): an asteroid belt goes at this mean temperature. */
export const RUBBLE_BOIL_K = 1600;
/** Under a giant’s softer light, with little ultraviolet, rubble lasts its 120,000 years up to this. */
export const RUBBLE_GIANT_K = 1800;
/** A helium giant’s radius, about 25 R☉ (1,000 L☉ at 6,500 K): every world inside it is swallowed. */
export const GIANT_RADIUS_AU = 0.116;

type NewStar = keyof typeof NEW_STAR_LUM;

/**
 * Would this new star boil the world away while it burns? Under a helium star a world goes once
 * its warmest ground passes ROCK_BOIL_K, rubble once its mean passes RUBBLE_BOIL_K. Gas and ice
 * giants are spared (a bend: real ones would lose much of their gas to the ultraviolet). Under a
 * helium giant everything inside its radius is swallowed, giants too; outside it only rubble
 * evaporates, and the rest outlast its 120,000 years as lava worlds. Worlds that only steam keep
 * their water (another bend). The Deep, rogue worlds and worlds already falling in are spared.
 */
export function boilsUnder(state: GameState, b: Body, kind: NewStar): boolean {
  if (b.kind === 'deep' || b.dissolved || b.rogue || b.feeding || !(b.orbitAU > 0)) return false;
  const giant = kind === 'helium_giant';
  if (giant && b.orbitAU <= GIANT_RADIUS_AU) return true;
  if (b.kind === 'gas_giant' || b.kind === 'ice_giant') return false;
  const c = starClimate(state, b, NEW_STAR_LUM[kind]);
  if (b.kind === 'asteroids') return c.mean >= (giant ? RUBBLE_GIANT_K : RUBBLE_BOIL_K);
  return !giant && (c.day ?? c.mean) >= ROCK_BOIL_K;
}

/** A world its new star is boiling away (or its giant swallowing), gone as the coming turn ends. */
export function boilingAway(state: GameState, b: Body): 'boils' | 'swallowed' | null {
  const p = state.systems[b.systemId]?.primary;
  if (!p || (p.kind !== 'helium_star' && p.kind !== 'helium_giant') || newStarOut(p, state.years)) return null;
  if (!boilsUnder(state, b, p.kind)) return null;
  return p.kind === 'helium_giant' && b.orbitAU <= GIANT_RADIUS_AU ? 'swallowed' : 'boils';
}

/** Did this new star burn during some part of [from, to]? */
function shoneDuring(p: Primary, from: number, to: number): p is Primary & { kind: NewStar } {
  return (p.kind === 'helium_star' || p.kind === 'helium_giant') && (p.bornAt ?? -Infinity) < to && (p.diesAt ?? Infinity) > from;
}

/** Blackbody-ish surface temperature by primary kind and state (used for colours and text). */
export function primaryTemperature(p: Primary, years: number, era: EraId): number {
  if (newStarOut(p, years)) return coldDwarfK(years);
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
    case 'white_dwarf': {
      if (era === 'dusk') {
        // from its light and its size (Stefan–Boltzmann): about 12,000 K at the collapse, a few
        // hundred K trillions of years on
        const r = dwarfRadius(p);
        return 5772 * Math.pow(primaryLuminosity(p, years, era) / (r * r), 0.25);
      }
      if (p.rekindle) return 300; // a world falling into it, as a rekindled black dwarf
      // an ember holds about 63 K while the halo lasts and cools as its warmth fades (T ∝ power^¼);
      // the rest cool on toward a black dwarf's 5 K
      const cold = coldDwarfK(years);
      const ember = emberShare(p, years);
      return ember > 0 ? Math.max(cold, EMBER_K * Math.pow(ember, 0.25)) : cold;
    }
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

/** A young white dwarf's light to collectors (red dwarf = 1): 0.45 at the collapse, fading as it cools. */
const YOUNG_LIGHT = 0.45;
const YOUNG_TAU = 1e9;
/** No white dwarf in the Dusk gives less (a faint warmth near the end of its cooling). */
const COLD_LIGHT = 0.02;

/**
 * A white dwarf's light to collectors, averaged over the ages from `a` to `b` years after its
 * collapse (the value at `a` when b ≤ a): 0.45 × (1 + t / 1 Gyr)^-1.2, never below 0.02.
 */
export function youngDwarfLight(a: number, b: number): number {
  const at = (t: number) => Math.max(COLD_LIGHT, YOUNG_LIGHT * Math.pow(1 + Math.max(0, t) / YOUNG_TAU, -1.2));
  if (!(b > a)) return at(a);
  // where it reaches the floor, and the integral of the fading part (a power law)
  const floorAt = YOUNG_TAU * (Math.pow(YOUNG_LIGHT / COLD_LIGHT, 1 / 1.2) - 1);
  const F = (t: number) => ((-YOUNG_LIGHT * YOUNG_TAU) / 0.2) * Math.pow(1 + t / YOUNG_TAU, -0.2);
  const lo = Math.max(0, a);
  let sum = Math.max(0, lo - a) * at(0);
  const mid = Math.min(b, floorAt);
  if (mid > lo) sum += F(mid) - F(lo);
  const floorFrom = Math.max(lo, floorAt);
  if (b > floorFrom) sum += COLD_LIGHT * (b - floorFrom);
  return sum / (b - a);
}

/** The light a primary supplies, era-normalised, for the turn [years, years + L]. */
export function sourceLight(state: GameState, sys: StarSystem, years: number, L: number): SourceInfo {
  const p = sys.primary;
  const era = calendarEra(state);
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
        // averaged over the turn: a long one right after the collapse gets only its share of the glow
        const light = p.whiteAt ? youngDwarfLight(years - p.whiteAt, years - p.whiteAt + Math.max(0, L)) : 0.02;
        return { light, label: p.whiteAt ? 'White dwarf, newly collapsed and cooling' : 'Old white dwarf, nearly cold', temperatureK: primaryTemperature(p, years, era), alive: null };
      }
      if (era === 'degenerate') {
        const gf = 0.35 + 0.65 * gfe;
        const ember = emberShare(p, years);
        const temperatureK = primaryTemperature(p, years, era);
        if (ember > 0) {
          const label =
            p.haloLeft !== undefined
              ? 'Ember, dimming: cast out of the galaxy, it has left behind the dark matter that warmed it'
              : ember < 1
                ? 'Ember, fading: the dark matter that warms it is running out'
                : 'Ember: a white dwarf warmed by dark matter annihilating inside it (about 63 K)';
          return { light: (0.05 + ember) * gf + rek, label, temperatureK, alive: null };
        }
        // no dark matter warms it: from ×0.05 at 20 K to a black dwarf's ×0.01 at 5 K, as its light falls
        const glow = dwarfGlow(years);
        const light = 0.01 + (0.05 * gf - 0.01) * glow + rek;
        const label = rek > 0 ? 'White dwarf, rekindled by an infalling world' : glow > 0 ? 'White dwarf, still cooling: no dark matter warms it' : 'White dwarf gone cold: a black dwarf in all but name';
        return { light, label, temperatureK, alive: null };
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
      // a flash we keep time with is lived in full in its light, even where the calendar's shortest
      // turn outlasts the star (a bend: past about η 18.1 a giant's 120,000 years are too few to count)
      const flash = state.civ?.flags.star_flash === dies && dies > years;
      const frac = flash ? 1 : L > 0 ? Math.min(1, overlap / L) : 0;
      // (display only) a turn can outlast the whole of such a star: it may already be out
      const label =
        dies <= years
          ? `${p.kind === 'collision_star' ? 'Collision star' : p.kind === 'helium_star' ? 'Helium star' : 'Helium giant'}, already out: it lit and burnt out within a single turn, and is settling into ${shownKind(p, years) === 'black_dwarf' ? 'a cold, dark dwarf' : 'a white dwarf'}`
          : p.kind === 'collision_star'
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
  if ((p.kind !== 'black_hole' && p.kind !== 'smbh') || !p.evaporateAt || years >= p.evaporateAt) return 0;
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
    | 'dissolved'
    | 'boiled';
  bodyId?: string;
  /** (boiled) inside a giant's own radius, rather than boiled by its light */
  swallowed?: boolean;
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
    // an ember outside the galaxy has left its halo (cast out before this was kept, or by other means)
    if (sys.ejected && p.halo && p.kind === 'white_dwarf' && p.haloLeft === undefined) p.haloLeft = from;
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
    // the new star that shone during this turn, before its death below rewrites it
    const shone: NewStar[] = shoneDuring(p, from, to) ? [p.kind] : [];
    // short-lived stars
    if (p.kind === 'dark_star' && p.diesAt && to >= p.diesAt) {
      p.kind = 'black_dwarf';
      p.bornAt = undefined;
      p.diesAt = undefined;
      notes.push({ systemId: sys.id, kind: 'burnout' });
    }
    if ((p.kind === 'collision_star' || p.kind === 'helium_star' || p.kind === 'helium_giant') && p.diesAt && to >= p.diesAt) {
      if (p.kind === 'helium_star' && (p.mass >= 0.9 || rand() < 0.3) && !sys.primary.rekindle) {
        // massive merger remnants swell into a brief, brilliant helium giant. Like every new star
        // it lights as the turn ends (it would have lit and gone out inside it): it shines through
        // the next turn, which can be quickened to it (flare.ts), and burns out as that one ends
        p.kind = 'helium_giant';
        p.bornAt = to;
        p.diesAt = to + GIANT_LIFE;
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
    // white dwarfs go black: one no dark matter warms once it has cooled to 5 K (about η 16.7), an
    // ember once the halo is spent (η 25). Only the name changes: nothing happens to it at 5 K.
    if (p.kind === 'white_dwarf' && calendarEra(state) !== 'dusk' && to >= DWARF_COLD_AT && emberShare(p, to) === 0) p.kind = 'black_dwarf';
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
      if (!sys.ejected && b.orbitAU > 0 && calendarEra(state) !== 'blackhole' && calendarEra(state) !== 'dark') {
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
    // a new star boils away the worlds too close to it, and a giant swallows those inside it
    for (const k of shone) {
      for (const bid of sys.bodies) {
        const b = state.bodies[bid];
        if (!b || !boilsUnder(state, b, k)) continue;
        b.dissolved = true;
        notes.push({ systemId: sys.id, kind: 'boiled', bodyId: b.id, swallowed: k === 'helium_giant' && b.orbitAU <= GIANT_RADIUS_AU });
      }
    }
  }

  // Degenerate Age: collisions and mergers light rare, short stars. A turn here can outlast such
  // a star's whole life, so (a bend) each lights as its turn ends, whenever in the turn the two
  // met: it is seen alight, and we may keep time with it (flare.ts). The draw that used to place
  // its birth inside the turn is still made, so every later draw stays where it was.
  if (calendarEra(state) === 'degenerate') {
    // Brown dwarfs meet only in a bound galaxy: as it evaporates (η 18.4 to 21, below) their
    // collisions grow rarer, and once it has, they stop. Helium stars come from white-dwarf pairs
    // that spiral together by their own gravitational waves, galaxy or not: those go on to η 25.
    const bound = e < 18.4 ? 1 : e < 21 ? (21 - e) / 2.6 : 0;
    const collisionRate = Math.min(0.6, L / 4e12) * state.gfe * bound;
    if (rand() < collisionRate) {
      const bds = systems.filter((s) => s.primary.kind === 'brown_dwarf' && !s.gone && !s.ejected);
      if (bds.length) {
        const s = bds[Math.floor(rand() * bds.length)];
        rand();
        const born = to;
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
        rand();
        const born = to;
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
            if (s.primary.halo && s.primary.kind === 'white_dwarf') s.primary.haloLeft = to;
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
  if (calendarEra(state) === 'blackhole' || calendarEra(state) === 'dark') {
    for (const s of systems) {
      const p = s.primary;
      if ((p.kind === 'black_hole' || p.kind === 'smbh') && p.evaporateAt && to >= p.evaporateAt && !s.gone) {
        evaporateHole(state, s);
        notes.push({ systemId: s.id, kind: 'evaporated' });
      }
    }
  }
  return notes;
}

/**
 * A black hole has evaporated. It lost its mass so slowly that the orbits around it widened as it
 * shrank (a ∝ 1/M) until nothing held them: its worlds drift on as rogue worlds, and what was
 * built on them stays. Its spin, its Hawking light and any glow around it are gone. The final
 * burst, huge by this age's standards, is spread too thin at the distances worlds orbit to harm
 * them (Burst Catchers close in bank some of it). The system is gone only if nothing is left in it.
 */
export function evaporateHole(state: GameState, s: StarSystem) {
  const p = s.primary;
  p.kind = 'void';
  p.lum = 0;
  p.spin = 0;
  p.spinMax = 0;
  p.rekindle = undefined;
  let left = Object.values(state.colonies).some((c) => c.systemId === s.id);
  for (const bid of s.bodies) {
    const b = state.bodies[bid];
    if (!b || b.dissolved || b.kind === 'deep') continue;
    b.rogue = true;
    left = true;
  }
  s.gone = !left;
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
  if (newStarOut(p, years)) {
    const r = dwarfRadius(p);
    return Math.pow(coldDwarfK(years) / 5772, 4) * r * r;
  }
  switch (p.kind) {
    case 'red_dwarf':
    case 'collision_star':
      return 0.23 * Math.pow(m, 2.3); // lower main sequence
    case 'blue_dwarf':
      return Math.min(0.4, 2 * m); // a red dwarf's last bright phase, about a third of the Sun at peak
    case 'helium_star':
    case 'helium_giant':
      return NEW_STAR_LUM[p.kind];
    case 'dark_star':
      return 1;
    case 'white_dwarf': {
      if (era === 'dusk') {
        const age = p.whiteAt ? Math.max(0, years - p.whiteAt) : 1e13;
        return 0.01 * Math.pow(1 + age / 1e8, -1.3);
      }
      // an ember by the dark matter it burns (about 4 × 10^-12 L☉ while the halo lasts), any other
      // by how far it has cooled (Stefan–Boltzmann, from its size)
      const r = dwarfRadius(p);
      const cold = Math.pow(coldDwarfK(years) / 5772, 4) * r * r;
      const ember = era === 'degenerate' ? emberShare(p, years) : 0;
      if (ember > 0) return Math.max(cold, 4e-12 * ember);
      return cold + (p.rekindle ?? 0) * 1e-6;
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

/** Orbital Lamps hold the world they light at about this temperature, day side and night side. */
export const LAMP_K = 285;

/** Does something in orbit keep this world warm (Orbital Lamps over its settlement)? */
export function lampsOver(state: GameState, b: Body, c: Colony | undefined = b.colonyId ? state.colonies[b.colonyId] : undefined): boolean {
  return !!c && Object.entries(c.structures).some(([id, n]) => n > 0 && !!STRUCTURE_BY_ID[id]?.warms);
}

/** The kinds with life on their surface: they freeze, or dry to bare rock, when they die. */
export const SURFACE_LIFE: Body['kind'][] = ['eyeball', 'terran', 'super_earth'];

/** Below this even a world's warmest ground is frozen hard: a frozen world, whatever it was. */
export const FROZEN_K = 195;

/**
 * Surface life whose star has died (a remnant, or nothing): its light is fading, and once even
 * its warmest ground is below FROZEN_K the world begins to freeze (vitalityLoss). A white dwarf
 * just collapsed is still hot, and early in the Dusk, when turns are short, it keeps a close
 * world warm for many of them.
 */
export function sunGone(state: GameState, b: Body): boolean {
  if (!SURFACE_LIFE.includes(b.kind) || b.dissolved || b.vitality <= 0) return false;
  const p = state.systems[b.systemId]?.primary;
  return !p || !isStarLike(p);
}

/**
 * Vitality a living world loses this turn. `decline`: a settled world's slow dying, sooner as
 * the Dusk wears on (Magnetic Shields and Orbital Lamps slow it, overdrive hastens it).
 * `freeze`: without a sun a living world freezes within a few turns, 5% a turn (half that with
 * a Core Stimulator), unless Orbital Lamps keep it warm: after the Last Light, on a world cast
 * out of its system, or, for life on the surface, once even its warmest ground is below FROZEN_K:
 * its star dead and cooled (see sunGone), or too faint to warm it (no new game has such a world;
 * older saves may). Life under an ice shell, kept warm by tides, lasts until the Last Light.
 */
export function vitalityLoss(state: GameState, b: Body, c: Colony | undefined = b.colonyId ? state.colonies[b.colonyId] : undefined): { decline: number; freeze: number } {
  if (b.dissolved || b.vitality <= 0) return { decline: 0, freeze: 0 };
  let mult = 1;
  let core = false;
  if (c) {
    for (const [id, n] of Object.entries(c.structures)) {
      const d = STRUCTURE_BY_ID[id];
      if (!d || !n) continue;
      if (d.declineMult) mult *= d.declineMult;
      if (id === 'core_stimulator') core = true;
    }
    if (c.overdrive) mult *= 1.3;
  }
  const accel = calendarEra(state) === 'dusk' ? Math.min(3, 1 + state.eraTurn * 0.02) : 3;
  const decline = c && b.decline > 0 ? b.decline * mult * accel : 0;
  const cold = () => {
    const cl = bodyClimate(state, b);
    return (cl.day ?? cl.mean) < FROZEN_K;
  };
  const sunless = calendarEra(state) !== 'dusk' || !!b.rogue || (SURFACE_LIFE.includes(b.kind) && cold());
  const freeze = sunless && !lampsOver(state, b, c) ? 0.05 * (core ? 0.5 : 1) : 0;
  return { decline, freeze };
}

/**
 * A new galaxy's living worlds that are frozen hard even on their warmest ground (a dim red
 * dwarf's outer band of orbits, a super-Earth brought close to a long-dead white dwarf) start as
 * what they are: dead ice, or bare rock. Deterministic and after generation, so the galaxy's
 * random draws, and everything else in it, stay as they were.
 */
export function frozenFromTheStart(state: GameState): number {
  let n = 0;
  for (const b of Object.values(state.bodies)) {
    if (!SURFACE_LIFE.includes(b.kind) || b.vitality <= 0 || b.traits.includes('homeworld')) continue;
    const c = bodyClimate(state, b);
    if ((c.day ?? c.mean) >= FROZEN_K) continue;
    b.kind = (b.water ?? 0) >= 0.1 ? 'ice' : 'barren';
    b.habitability = b.kind === 'ice' ? 0.05 : 0;
    b.vitality = 0;
    b.decline = 0;
    n++;
  }
  return n;
}

/**
 * Turns until a freezing world dies, stepped as declineWorlds takes them (decline, then cold,
 * in floating point), at this turn's losses; Infinity if it is not freezing.
 */
export function turnsToFreeze(state: GameState, b: Body, c?: Colony): number {
  const loss = vitalityLoss(state, b, c);
  if (loss.freeze <= 0) return Infinity;
  let v = b.vitality;
  for (let n = 1; n <= 1000; n++) {
    v = Math.max(0, v - loss.decline);
    if (v > 0) v = Math.max(0, v - loss.freeze);
    if (v <= 0) return n;
  }
  return Infinity;
}

/** Surface temperature: starlight (equilibrium, albedo 0.3), the world's own heat, a little greenhouse. */
export function bodyClimate(state: GameState, b: Body): BodyClimate {
  const c = starClimate(state, b);
  if (!lampsOver(state, b)) return c;
  // the lamps stand in for the sun where it falls short (they are no help against a flare)
  const lit = (k: number) => Math.max(k, LAMP_K);
  return c.day !== undefined ? { mean: lit(c.mean), day: lit(c.day), night: lit(c.night!) } : { mean: lit(c.mean) };
}

/** A world's climate without Orbital Lamps: under its star's light today, or under `lum` Suns. */
export function starClimate(state: GameState, b: Body, lum?: number): BodyClimate {
  const sys = state.systems[b.systemId];
  const L = b.rogue ? 0 : (lum ?? primaryLuminosity(sys.primary, state.years, calendarEra(state)));
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
  // ice stays ice only while even the warmest ground is below freezing (a flare can melt it)
  const warmest = climate.day ?? climate.mean;
  if (b.kind === 'ocean_ice' && warmest < 273) return `${share}: a global ocean under the ice`;
  if (b.kind === 'asteroids') return warmest < 273 ? `${share}: ice in the rubble` : `${share}: boiling off the rubble`;
  const liquidAt = (k: number) => k >= 273 && k < 373;
  if (climate.day !== undefined && climate.night !== undefined) {
    if (liquidAt(climate.day) && !liquidAt(climate.night)) return `${share}: open sea on the day side, ice beyond the terminator`;
    if (liquidAt(climate.day)) return `${share}: open water`;
    if (climate.day >= 373) {
      if (climate.night >= 373) return `${share}: steam, even on the night side`;
      if (liquidAt(climate.night)) return `${share}: boiled off the day side, open sea on the night side`;
      return `${share}: boiled off the day side, ice on the night side`;
    }
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
