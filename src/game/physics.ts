import { STRUCTURE_BY_ID } from './data/structures';
import { defaultWater, hawkingTime } from './gen';
import type { Body, Colony, EraId, GameState, Primary, PrimaryKind, StarSystem } from './types';
import { calendarEra, fateKnown, fateOf, matterGone } from './fate';
import { ERA_BY_ID } from './eras';
import { hashSeed } from './rng';
import { protonFateKnown } from './sim/util';

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

/** A blue dwarf's surface in a game begun before its stars carried their own flare (blueK): every one at 8,200 K. */
const BLUE_K_OLD = 8200;

/**
 * Dead stars and worlds that nothing warms go on cooling for ever, each by one law in every age.
 * A neutron star or a world's core, with no insulating envelope, keeps its heat in its electrons
 * (heat capacity ∝ T) and is the same temperature throughout, while its surface radiates ∝ T⁴, so
 * it cools as T ≈ K·t^-½ (K in kelvin·years^½). White dwarfs (dwarfCoolingK) and brown dwarfs
 * (brownCoolingK) are kept warmer by their envelopes. Usable energy goes as T⁴, so a body a
 * thousand times colder gives a million million times less. Nothing ends up colder than the sky:
 * the cosmic horizon's own glow, SKY_K.
 */
const RESIDUAL = { neutron: 7e6, world: 1e4 } as const;
/** The temperature of the cosmic horizon (de Sitter, ħH/2πk at H∞ ≈ 56 km/s/Mpc): nothing ends up colder. */
export const SKY_K = 2.2e-30;
/**
 * The galaxy's own glow, the floor nothing in it cools below while it lasts. In the Dusk, the
 * light of the merged galaxy's red dwarfs: about 1 K. Today's interstellar starlight is about
 * 3.2 K (Eddington worked out 3.18 K in 1926), nearly all of it from stars far brighter than red
 * dwarfs. Only the faintest still shine, each about a thousandth of the Sun, so even a merged
 * galaxy holds a few tenths of a percent of today's light, and the temperature goes as its
 * fourth root. (The cosmic microwave background has long since redshifted to nothing.) After the
 * Last Light, the faint glow of the embers and the cooling brown dwarfs, about a hundredth of a
 * kelvin, while dark matter still warms them (to η 22, gone by η 25); then only the horizon's.
 */
export const BACKGROUND_DUSK_K = 1;
export const BACKGROUND_EMBERS_K = 0.01;
export function backgroundK(years: number): number {
  if (years < LAST_LIGHT) return BACKGROUND_DUSK_K;
  return BACKGROUND_EMBERS_K * Math.pow(haloShare(years), 0.25);
}
/** An ember: a white dwarf warmed by dark matter annihilating inside it (Adams & Laughlin). */
const EMBER_K = 63;
/** Dark matter falling into a neutron star warms it to about this while the halo lasts. */
const NEUTRON_HALO_K = 900;
/** And a brown dwarf, which catches far less of it, to a few kelvin (uncertain). */
const BROWN_HALO_K = 4;
/**
 * The warmth of protons decaying inside, if they decay (a lifetime near 10^37 years): about 400 W
 * from a white dwarf, which holds it near 0.05 K; a neutron star, small and dense, near 1.5 K; a
 * brown dwarf 9 mK; a world's interior 3 mK.
 */
const DECAY_K = { dwarf: 0.05, neutron: 1.5, brown: 0.009, world: 0.003 } as const;

/** What a body cools to, `age` years after it formed, with nothing to warm it. */
function residual(k: number, age: number): number {
  return k / Math.sqrt(Math.max(1, age));
}

/**
 * A giant's own heat, left from its formation and its slow contraction: Jupiter's gives it about
 * 100 K today, Saturn's 77 K and Neptune's 53 K, about 100 K × (M / 318 M⊕)^0.2 at 4.5 billion
 * years (our fit to the three; Uranus, at 30 K, is the odd one out), fading as t^-0.32 as a brown
 * dwarf's does (Burrows et al. 2001): about 4 K for a Jupiter in the Dusk, 2 K at η 15.
 */
export function giantHeatK(b: Body, years: number): number {
  if (b.kind !== 'gas_giant' && b.kind !== 'ice_giant') return 0;
  return 100 * Math.pow(Math.max(1, b.massEarth) / 318, 0.2) * Math.pow(Math.max(4.5e9, years) / 4.5e9, -0.32);
}

/** A white dwarf's core has crystallised by about this age, and its ions hold almost no heat (log L ≈ −7 at 0.6 M☉: Althaus et al. 2010, A&A Rev. 18, 471). */
const DEBYE_AGE = 5e11;

/**
 * A white dwarf's own temperature `age` years after it formed, with nothing warming it, by one law
 * in every age. Mestel's law while its envelope holds its heat in, 0.01 L☉ × (1 + t / 10^8
 * years)^-1.3 radiated from its surface: about 4,000 K at 10 billion years, as the coolest dwarfs
 * we see. Once its core has crystallised it fades faster, as T ∝ t^-0.58 (our estimate: the heat
 * left in its electrons, ∝ T, let out through the same envelope, L ∝ T_core^3.5): about 50 K
 * when the Dusk ends, 13 K at η 15, a hundredth of a kelvin at η 20. A red dwarf's remnant is
 * never hotter than its last flare was at its peak (the star contracts into it, cooling).
 */
export function dwarfCoolingK(p: Primary, age: number): number {
  const r = dwarfRadius(p);
  const mestel = (t: number) => 5772 * Math.pow((0.01 * Math.pow(1 + Math.max(0, t) / 1e8, -1.3)) / (r * r), 0.25);
  const t = age <= DEBYE_AGE ? mestel(age) : mestel(DEBYE_AGE) * Math.pow(age / DEBYE_AGE, -0.58);
  return p.blueAt !== undefined ? Math.min(t, p.blueK ?? BLUE_K_OLD) : t;
}

/**
 * A brown dwarf's own temperature, by Burrows et al.'s fit to their models (2001, Rev. Mod. Phys.
 * 73, 719, eq. 2): 1,550 K × (t / 1 billion years)^-0.32 × (M / 0.05 M☉)^0.83. Fitted to ages of
 * up to about 10 billion years; this far on it is an upper bound (a cold envelope may let the
 * heat out faster). About 40 K at the Dusk's end for a middling one, 19 K at η 15, 0.5 K at η 20.
 */
export function brownCoolingK(p: Primary, age: number): number {
  return 1550 * Math.pow(Math.max(1e8, age) / 1e9, -0.32) * Math.pow(Math.max(0.01, p.mass) / 0.05, 0.83);
}

/** The year a dwarf the galaxy began with formed. */
const FIRST_FORMED = 1e9;
/**
 * When a dead star the galaxy began with formed (a red dwarf's remnant has its own collapse,
 * whiteAt): from 1 billion years after the Big Bang to the Dusk, as many in each tenfold of time,
 * a star formation fading as 1/t. From a hash of its own, so with no random draw, the same in any
 * game and in a save from before.
 */
export function formedAt(p: Primary): number {
  const u = (hashSeed(`formed:${p.kind === 'brown_dwarf' ? 'bd' : 'wd'}:${p.mass}`) % 1000003) / 1000003;
  return Math.pow(10, Math.log10(FIRST_FORMED) + u * (Math.log10(ERA_BY_ID.dusk.startYears) - Math.log10(FIRST_FORMED)));
}

/** Years since a white or black dwarf formed: since its collapse if it was a star of ours to watch, else since formedAt. */
function dwarfAge(p: Primary, years: number): number {
  return Math.max(0, years - (p.whiteAt ?? formedAt(p)));
}

/**
 * A world falling into a dead star warms it as it feeds: an Earth spread over 10^14 to 10^15
 * years gives about 10^15 to 10^16 W (GMṀ/R), some 10^-12 to 10^-11 L☉, so this much per unit
 * of its light to collectors: a dwarf held at 50 to 110 K, as the Codex says.
 */
const REKINDLE_SUNS = 4e-12;
/** The warmth a feeding world gives a dwarf of radius `r` (R☉), from its light (Stefan–Boltzmann). */
function rekindledK(p: Primary, r: number): number {
  return p.rekindle ? 5772 * Math.pow((p.rekindle * REKINDLE_SUNS) / (r * r), 0.25) : 0;
}

/** Temperatures that add as power does: (a⁴ + b⁴ + …)^¼, never below the sky's. */
function warmth(...parts: number[]): number {
  let s = SKY_K ** 4;
  for (const x of parts) s += x ** 4;
  return Math.pow(s, 0.25);
}

/**
 * How much of the warmth of decaying protons to show and count (0..1): none unless protons decay
 * and we know they do (until then a dead star reads as the prediction without it: finding out is
 * what the Proton Question does), all of it until η 37.5, then less as the matter goes, none by η 39.
 */
export function decayWarmth(state: GameState, years = state.years): number {
  if (!state.protonsDecay || !protonFateKnown(state)) return 0;
  const e = Math.log10(Math.max(1, years));
  return Math.max(0, Math.min(1, (39 - e) / 1.5));
}

/**
 * Curvature radiation, if that is the fate of matter: a neutron star glows at about 30 nK as space
 * turns its mass into particles (a white dwarf, far less dense, at a few picokelvin: nothing).
 */
const CURVATURE_NEUTRON_K = 3e-8;

/** How much of the curvature glow to show (0 or 1): only under that fate, and once we know it. */
export function curvatureWarmth(state: GameState): number {
  return fateOf(state) === 'curvature' && fateKnown(state) ? 1 : 0;
}

/**
 * The year the game calls a white dwarf no dark matter warms a black dwarf: about 5.2 × 10^16
 * (η 16.7). Only a name: it has been colder than any star for ages by then. (Other rules read
 * this date, so it stays where it was when the game called them black at 5 K.)
 */
export const DWARF_COLD_AT = 1e15 * Math.pow(5 / 20, 1 / -0.35);

/** The share of its halo of dark matter still falling into any dead star: all of it to η 22, none by η 25. */
function haloShare(years: number): number {
  const e = Math.log10(Math.max(1, years));
  return e < 22 ? 1 : Math.max(0, (25 - e) / 3);
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
  const halo = haloShare(years);
  if (p.haloLeft === undefined) return halo;
  const e = Math.log10(Math.max(1, years));
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
  const c = starClimate(state, b, NEW_STAR_LUM[kind], NO_TERRAFORMING);
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

/**
 * A primary's temperature in kelvin, for colours and text (no rule reads one below 195 K): a
 * star's surface, a dead star's by what still warms it (see the cooling above), a black hole's
 * Hawking temperature. `decay`: the share of the warmth of decaying protons to count (decayWarmth).
 */
export function primaryTemperature(p: Primary, years: number, era: EraId, decay = 0, curve = 0): number {
  const t = ownTemperature(p, years, era, decay, curve);
  // a dead star sits in the galaxy's glow like everything else (a black hole's is its Hawking temperature)
  return p.kind === 'black_hole' || p.kind === 'smbh' ? t : warmth(t, backgroundK(years));
}

/** A primary's temperature from what warms it alone, without the galaxy's background glow. */
export function ownTemperature(p: Primary, years: number, _era: EraId, decay = 0, curve = 0): number {
  const fromDecay = (k: number) => k * Math.pow(decay, 0.25);
  // a new star a turn outlasted: the white dwarf it left, cooled through the rest of that turn
  if (newStarOut(p, years)) return warmth(dwarfCoolingK(p, years - (p.diesAt ?? 0)), fromDecay(DECAY_K.dwarf));
  switch (p.kind) {
    case 'red_dwarf':
      return 2700 + (p.mass - 0.08) * 6000;
    case 'blue_dwarf':
      // at the peak of its last flare (a new galaxy's stars carry their own, by mass)
      return p.blueK ?? BLUE_K_OLD;
    case 'collision_star':
      return 2900;
    case 'helium_star':
      return 42000;
    case 'helium_giant':
      return 6500;
    case 'dark_star':
      return 4200;
    case 'white_dwarf':
    case 'black_dwarf':
      // its own cooling (one law in every age); dark matter falling into it while the halo lasts,
      // Dusk and after (Adams & Laughlin: from η 11), an ember at about 63 K that fades with the
      // halo (T ∝ power^¼); a world falling into it; its protons decaying, if they do
      return warmth(dwarfCoolingK(p, dwarfAge(p, years)), EMBER_K * Math.pow(emberShare(p, years), 0.25), rekindledK(p, dwarfRadius(p)), fromDecay(DECAY_K.dwarf));
    case 'brown_dwarf':
      // its own cooling from its own age, and a few kelvin of dark matter while the halo lasts
      return warmth(brownCoolingK(p, Math.max(0, years - formedAt(p))), BROWN_HALO_K * Math.pow(haloShare(years), 0.25), fromDecay(DECAY_K.brown));
    case 'neutron_star':
      // dark matter holds it near 900 K while the halo lasts, in the Dusk as after (its own heat
      // was long gone: about 100 K at a billion years with nothing to warm it)
      return warmth(NEUTRON_HALO_K * Math.pow(haloShare(years), 0.25), residual(RESIDUAL.neutron, years), fromDecay(DECAY_K.neutron), CURVATURE_NEUTRON_K * curve);
    case 'black_hole':
    case 'smbh':
      // Hawking: 6.2 × 10^-8 K for a hole of one Sun, colder the heavier it is
      return 6.17e-8 / Math.max(1e-6, p.mass);
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
  const decay = decayWarmth(state, years);
  switch (p.kind) {
    case 'red_dwarf':
      return { light: p.lum, label: 'Red dwarf, main sequence', temperatureK: primaryTemperature(p, years, era), alive: null };
    case 'blue_dwarf': {
      // a few billion years of flare: a turn that outlasts it gets its share, then a young white dwarf
      const from = p.blueAt ?? years;
      const to = p.whiteAt ?? Infinity;
      const overlap = Math.max(0, Math.min(to, years + L) - Math.max(from, years));
      const share = L > 0 ? Math.min(1, overlap / L) : 1;
      return { light: p.lum * (0.3 + 2.7 * share), label: 'Blue dwarf: a red dwarf in its last bright flare', temperatureK: p.blueK ?? BLUE_K_OLD, alive: null };
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
        const temperatureK = primaryTemperature(p, years, era, decay);
        if (ember > 0) {
          const label =
            p.haloLeft !== undefined
              ? 'Ember, dimming: cast out of the galaxy, it has left behind the dark matter that warmed it'
              : ember < 1
                ? 'Ember, fading: the dark matter that warms it is running out'
                : 'Ember: a white dwarf warmed by dark matter annihilating inside it (about 63 K)';
          // its light is the dark matter it burns, and fades with it
          return { light: 1.05 * ember * gf + rek, label, temperatureK, alive: null };
        }
        // nothing warms it: a few millikelvin, and nothing to gather unless a world falls in
        const label = rek > 0 ? 'White dwarf, rekindled by an infalling world' : 'White dwarf gone cold: nothing warms it, and it has nothing left to give';
        return { light: rek, label, temperatureK, alive: null };
      }
      return { light: rek, label: rek > 0 ? 'White dwarf, rekindled by an infalling world' : 'Cold white dwarf: nothing left to give', temperatureK: primaryTemperature(p, years, era, decay), alive: null };
    }
    case 'black_dwarf':
      return { light: rek, label: rek > 0 ? 'Black dwarf, rekindled by an infalling world' : 'Black dwarf: a white dwarf gone cold, with nothing left to give', temperatureK: primaryTemperature(p, years, era, decay), alive: null };
    case 'brown_dwarf': {
      // all of its own light, cooling with its age, in the units of the age: next to nothing
      // beside a red dwarf, but after the Last Light, while it still holds the heat of its youth,
      // worth an ember or more (only collectors built for it can take it: Infrared Shrouds)
      const lum = primaryLuminosity(p, years, era, decay);
      const light = era === 'dusk' ? lum / lightUnitSuns('dusk') : 1.05 * (0.35 + 0.65 * gfe) * (lum / lightUnitSuns(era));
      const temperatureK = primaryTemperature(p, years, era, decay);
      const label = era === 'dusk' ? 'Brown dwarf: a star that never ignited, cooling since it formed' : light >= 0.05 ? 'Brown dwarf, still glowing with the heat of its youth' : haloShare(years) > 0 ? 'Brown dwarf, nearly cold, faintly warmed by dark matter' : 'Brown dwarf gone cold';
      return { light, label, temperatureK, alive: null };
    }
    case 'neutron_star': {
      const light = era === 'dusk' ? 0.1 : era === 'degenerate' ? 0.25 * Math.max(0, 1 - (Math.log10(years) - 15) / 12) * (0.4 + 0.6 * gfe) : 0;
      return { light, label: light > 0 ? 'Neutron star, slowly spinning down' : 'Neutron star, spun down and cold', temperatureK: primaryTemperature(p, years, era, decay, curvatureWarmth(state)), alive: null };
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
      // collectors see the accretion disk. The Heart's is fed by its crowded core, the gas its
      // stars shed (a hole this heavy swallows a whole star without tearing it), bright in the
      // Dusk and fading as those stars die; a lone stellar hole has only a faint trickle of gas
      const disk = diskLight(p.kind, era, years, !matterGone(state)) * (0.35 + 0.65 * gfe);
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
    | 'boiled'
    | 'faded';
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
    // white dwarfs are called black: one no dark matter warms from η 16.7 (it has been cold for
    // ages), an ember once the halo is spent (η 25). Only the name changes.
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
            const heart = systems.find((x) => x.primary.kind === 'smbh');
            if (heart) growHeart(heart.primary, s.primary.mass);
            // into the Heart, with every world still bound to it; one already flung loose drifts
            // on, and the system stays for it, empty, as when a black hole evaporates
            let adrift = false;
            for (const bid of s.bodies) {
              const b = state.bodies[bid];
              if (!b || b.kind === 'deep' || b.dissolved) continue;
              if (b.rogue) adrift = true;
              else b.dissolved = true;
            }
            if (adrift) Object.assign(s.primary, { kind: 'void', lum: 0, spin: 0, spinMax: 0, rekindle: undefined });
            else s.gone = true;
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
  // curvature radiation (that fate only): space turns the dwarfs' mass into particles until they
  // are gone, white and black dwarfs between η 78.5 and 85 by mass, brown dwarfs near η 87; their
  // worlds drift loose and what we built there stays (the neutron stars burst at the Last Warmth)
  if (fateOf(state) === 'curvature') {
    for (const s of systems) {
      const p = s.primary;
      if (s.gone) continue;
      const at = p.kind === 'white_dwarf' || p.kind === 'black_dwarf' ? dwarfFadeEta(p.mass) : p.kind === 'brown_dwarf' ? BROWN_FADE_ETA : Infinity;
      if (e >= at) {
        evaporateHole(state, s);
        notes.push({ systemId: s.id, kind: 'faded' });
      }
    }
  }
  return notes;
}

/** Brown dwarfs under curvature radiation last to about η 87 (Falcke, Wondrak & van Suijlekom, from their density). */
export const BROWN_FADE_ETA = 87;

/**
 * When a white dwarf is gone to curvature radiation (η): a 1.3 M☉ one, dense, at about 78.5
 * (Falcke, Wondrak & van Suijlekom), lighter and thinner ones later, 0.6 M☉ near 82; between 78 and
 * 85. As it shrinks it grows less dense, so it fades away rather than bursting as a neutron star does.
 */
export function dwarfFadeEta(mass: number): number {
  return Math.max(78, Math.min(85, 82 - 10 * Math.log10(Math.max(0.1, mass) / 0.6)));
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
export function primaryLuminosity(p: Primary, years: number, era: EraId, decay = 0): number {
  const m = Math.max(0.01, p.mass);
  // a dead star's light, from its temperature and its size (Stefan–Boltzmann; radii in Suns)
  // (its own warmth: the galaxy's glow around it is not light it gives)
  const glow = (r: number) => Math.pow(ownTemperature(p, years, era, decay) / 5772, 4) * r * r;
  if (newStarOut(p, years)) return glow(dwarfRadius(p));
  switch (p.kind) {
    case 'red_dwarf':
    case 'collision_star':
      return 0.23 * Math.pow(m, 2.3); // lower main sequence
    case 'blue_dwarf':
      // a red dwarf's last flare at its peak (a new galaxy's stars carry their own, by mass; older
      // games keep the bright flare they began with, up to 0.4 L☉)
      return p.blueLum ?? Math.min(0.4, 2 * m);
    case 'helium_star':
    case 'helium_giant':
      return NEW_STAR_LUM[p.kind];
    case 'dark_star':
      return 1;
    case 'white_dwarf':
    case 'black_dwarf': {
      // by its warmth; an ember at least by the dark matter it burns (about 4 × 10^-12 L☉ while
      // the halo lasts: Adams & Laughlin)
      const ember = emberShare(p, years);
      return ember > 0 ? Math.max(glow(dwarfRadius(p)), 4e-12 * ember) : glow(dwarfRadius(p));
    }
    case 'brown_dwarf':
      return glow(0.1);
    case 'neutron_star':
      return glow(1.7e-5);
    case 'black_hole':
    case 'smbh':
      // its accretion disk, as bright as what collectors there gather (its Hawking glow is
      // nothing beside it)
      return diskLight(p.kind, era, years) * lightUnitSuns(era);
    default:
      return 0;
  }
}

/**
 * One unit of light to collectors (sourceLight), as a luminosity in Suns. The game sets the unit
 * by age: in the Dusk a red dwarf of 0.1 M☉ (0.23 × 0.1^2.3 = 1.15 × 10^-3 L☉), from the Last
 * Light an ember (about 4 × 10^-12 L☉).
 */
export function lightUnitSuns(era: EraId): number {
  return era === 'dusk' ? 1.15e-3 : 4e-12;
}

export interface BodyClimate {
  mean: number; // K
  day?: number; // tidally locked worlds
  night?: number;
  /** Past the runaway greenhouse: its seas are a sky of steam (water-rich worlds only). */
  steam?: boolean;
  /** No air to hold water as a liquid: bare rock and rubble, unless Atmosphere Works give it one. */
  airless?: boolean;
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
 * Frozen hard: even its warmest ground below FROZEN_K. Nothing lives on such a surface, Kin
 * without domes included (Orbital Lamps keep the world they light out of it).
 */
export function frozenHard(state: GameState, b: Body, c: BodyClimate = bodyClimate(state, b)): boolean {
  return !b.dissolved && b.kind !== 'deep' && (c.day ?? c.mean) < FROZEN_K;
}

/** Nothing on a world's surface survives past this, even on its night side: the limit of known life (122 °C: Takai et al. 2008). */
export const LIFE_LIMIT_K = 395;

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
 * Life seeded on a dead world freezes once nothing keeps the world warm (seededLifeUnkept).
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
  // (a world alone in the dark has no star, and no tides, to warm it, as a world flung loose has not)
  const p = state.systems[b.systemId]?.primary;
  const starless = !p || p.kind === 'rogue' || p.kind === 'void';
  const sunless = calendarEra(state) !== 'dusk' || !!b.rogue || starless || (SURFACE_LIFE.includes(b.kind) && cold()) || seededLifeUnkept(state, b, c);
  const freeze = sunless && !lampsOver(state, b, c) ? 0.05 * (core ? 0.5 : 1) : 0;
  return { decline, freeze };
}

/**
 * Life seeded on a dead world (Biosphere Seeding, sim/terraform.ts) lives on the warmth the
 * terraforming gives it: once its star has died, or its mirrors and its air works are both gone,
 * it freezes as surface life does.
 */
export function seededLifeUnkept(state: GameState, b: Body, c: Colony | undefined = b.colonyId ? state.colonies[b.colonyId] : undefined): boolean {
  if (!c || !((c.structures.biosphere_seeding ?? 0) > 0) || SURFACE_LIFE.includes(b.kind)) return false;
  const tf = terraformingOf(state, b, c);
  return !tf.mirrors && !tf.works;
}

/** Ice melts here: an ice world (or the shell of an ice-shelled ocean) is frozen only below it. */
export const ICE_MELTS_K = 273;

/**
 * A water-rich world: an ice-shelled ocean, or an ice world with at least this share of its surface
 * under water (the wetter half; ice worlds have 30 to 70%). Up to half its mass may be water, as in
 * the ocean planets of Léger et al. 2004: too much to lose in its star's bright youth.
 */
export const WATER_RICH = 0.5;

/**
 * A new galaxy's icy worlds, sorted by the water they formed with. The water-rich keep it, marked
 * `water_rich`: close to their star, past the runaway greenhouse, their seas are a sky of steam
 * (starClimate), and nothing lives there (declineWorlds). The water-poor that are not frozen even
 * on their warmest ground start as bare rock: inside their star's snow line ice never gathered,
 * and what they had boiled off in its long, bright youth (Luger & Barnes 2015). Unless they are
 * locked to their star with a night side cold enough to keep it: there what water they have is
 * cold-trapped as ice, never reaching the day side to boil (a twilight or eyeball sea). The generator
 * picks a world's kind by its orbit, at fixed distances whatever its star's light (and one branch
 * for red dwarfs at any orbit), so these came out close in. A star already in its last flare is
 * judged by its light before it, so the water-poor worlds it had frozen are still there to thaw in
 * the flare (the water-rich ones the flare takes past the runaway greenhouse are steam worlds
 * instead). Deterministic and after generation, so the galaxy's random draws, and everything else
 * in it, stay as they were; the home system keeps its fixed layout.
 */
export function waterFromTheStart(state: GameState): { rich: number; dried: number; trapped: number } {
  let rich = 0;
  let dried = 0;
  let trapped = 0;
  const era = calendarEra(state);
  const decay = decayWarmth(state);
  for (const b of Object.values(state.bodies)) {
    if (b.kind !== 'ice' && b.kind !== 'ocean_ice') continue;
    const sys = state.systems[b.systemId];
    if (!sys || sys.special === 'home') continue;
    if (b.kind === 'ocean_ice' || (b.water ?? 0) >= WATER_RICH) {
      if (!b.traits.includes('water_rich')) b.traits.push('water_rich');
      if (steamWorld(state, b)) {
        b.vitality = 0;
        b.decline = 0;
      }
      rich++;
      continue;
    }
    const lum = sys.primary.kind === 'blue_dwarf' ? primaryLuminosity({ ...sys.primary, kind: 'red_dwarf' }, state.years, era, decay) : undefined;
    const c = starClimate(state, b, lum, NO_TERRAFORMING);
    if ((c.day ?? c.mean) < ICE_MELTS_K) continue;
    // locked to its star with a night side that stays frozen: its water is cold-trapped there as
    // ice, too little to raise a runaway greenhouse, since it never reaches the day side to boil
    // (Leconte et al. 2013, A&A 554, A69; Menou 2013, ApJ 774, 51)
    if (c.night !== undefined && c.night < ICE_MELTS_K) {
      trapped++;
      continue;
    }
    // bare rock's own figures: its richness (1.0 to 1.7) from where the ice's lay in its range,
    // its trace of water from its own seed, as generation gives them
    b.richness = 1 + 0.7 * Math.max(0, Math.min(1, (b.richness - 0.5) / 0.4));
    b.kind = 'barren';
    b.habitability = 0;
    b.vitality = 0;
    b.decline = 0;
    b.coreHeat = 0;
    b.water = defaultWater('barren', (b.seed % 1000) / 1000);
    b.traits = b.traits.filter((t) => t !== 'subsurface_ocean');
    dried++;
  }
  return { rich, dried, trapped };
}

/**
 * The runaway greenhouse, as the mean warmth starlight alone would give a world: past it, a
 * water-rich world's seas boil into its sky for good. At 1.4 times Earth's sunlight (the player's
 * choice): Kasting 1988's limit, where the oceans evaporate entirely (the same paper put 1,500 K
 * of ground beneath, which Selsis et al. 2023 revise: steamGroundK). Later models start the runaway sooner, at 1.06 (Kopparapu et al.
 * 2013) to 1.1 (Leconte et al. 2013, Nature 504, 268). 276.6 K is the warmth starClimate gives at
 * that light (Earth's 1 AU, albedo 0.3, is 254 K). A tidally locked world's clouds shade it and
 * hold the limit off to 300 K, nearly twice Earth's sunlight: Yang, Cowan & Abbot 2013 kept such
 * worlds habitable to 1.6 times it around a red dwarf and 1.9 around a K star, where their runs
 * stopped. Any light counts, a flaring star's too.
 */
export const RUNAWAY_K = 278 * Math.pow(0.7 * 1.4, 0.25);
export const RUNAWAY_LOCKED_K = 300;
/** The warmth starClimate gives at Earth's sunlight (1 AU from one Sun, albedo 0.3): 254 K. */
const EARTH_EQ_K = 278 * Math.pow(0.7, 0.25);

/**
 * The ground under a runaway's steam sky, by night as by day. Not the 1,500 K and more of a fully
 * convective steam atmosphere (Kasting 1988): in a consistent model the deep steam is radiative,
 * and the redder the star, the higher up its light is absorbed and the cooler the ground (Selsis
 * et al. 2023, Nature 620, 287). Just past the runaway it is about 1,250 K under a Sun-like star
 * and some 550 K under one like TRAPPIST-1 (2,600 K), about 1,100 K below what the convective
 * model gives; between, by the star's temperature, and never past the convective 1,650 K. More light warms it slowly, as
 * (sunlight / limit)^0.16, our fit to where they find the rock melts (1,620 K): at 7.4 times
 * Earth's sunlight for the Sun, at 339 for TRAPPIST-1.
 */
export function steamGroundK(starK: number, sunlight: number, limit: number): number {
  const exit = Math.min(1650, Math.max(550, 550 + ((starK - 2600) * (1250 - 550)) / (5772 - 2600)));
  return exit * Math.pow(Math.max(1, sunlight / limit), 0.16);
}

/** A water-rich world past the runaway greenhouse, its seas a sky of steam (see starClimate). */
export function steamWorld(state: GameState, b: Body): boolean {
  return !b.dissolved && b.traits.includes('water_rich') && !!bodyClimate(state, b).steam;
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
  return c.day !== undefined ? { ...c, mean: lit(c.mean), day: lit(c.day), night: lit(c.night!) } : { ...c, mean: lit(c.mean) };
}

/** A world's climate without Orbital Lamps: under its star's light today, or under `lum` Suns. */
export function starClimate(state: GameState, b: Body, lum?: number, tf: Terraforming = terraformingOf(state, b)): BodyClimate {
  const sys = state.systems[b.systemId];
  const era = calendarEra(state);
  const decay = decayWarmth(state);
  let L = b.rogue ? 0 : (lum ?? primaryLuminosity(sys.primary, state.years, era, decay));
  // Orbital Mirrors: more of its star's light for a cold world, a shade for a hot one
  if (tf.mirrors && L > 0) {
    const bare = starClimate(state, b, lum, { mirrors: false, works: tf.works });
    L *= (bare.day ?? bare.mean) < TERRAFORM_TARGET_K ? MIRROR_GAIN : 1 / MIRROR_GAIN;
  }
  const a = Math.max(0.003, b.orbitAU);
  const tEq = L > 0 ? 278 * Math.pow(L, 0.25) * Math.pow(0.7, 0.25) / Math.sqrt(a) : 0;
  // its own heat: its core's, while that lasts (it runs out after the Last Light), then what is
  // left of it, and its protons decaying, if they do and we know it
  const tInt = warmth(40 * b.coreHeat, era === 'dusk' ? 0 : residual(RESIDUAL.world, state.years), DECAY_K.world * Math.pow(decay, 0.25), giantHeatK(b, state.years));
  // and the galaxy's glow around it, which even a world far from any star sits in
  const bg = backgroundK(state.years);
  const raw = Math.pow(Math.pow(tEq, 4) + Math.pow(tInt, 4) + Math.pow(bg, 4), 0.25);
  let t = raw;
  // a water-rich world past the runaway greenhouse: its seas are a sky of steam hundreds of bars
  // deep, which holds the ground hot by night as by day (steamGroundK); below the limit they rain out
  // (a belt is rubble on many orbits, not one face turned to its star)
  const locked = b.traits.includes('tidally_locked') && tEq > 0 && b.kind !== 'asteroids';
  if (b.traits.includes('water_rich') && !b.rogue && t >= (locked ? RUNAWAY_LOCKED_K : RUNAWAY_K)) {
    const limit = Math.pow((locked ? RUNAWAY_LOCKED_K : RUNAWAY_K) / EARTH_EQ_K, 4);
    const k = Math.max(t, steamGroundK(primaryTemperature(sys.primary, state.years, era, decay), L / (a * a), limit));
    return locked ? { mean: k, day: k, night: k, steam: true } : { mean: k, steam: true };
  }
  // Atmosphere Works: on a cold world, an air rich in greenhouse gases keeps the warmth in
  if (tf.works && t < TERRAFORM_TARGET_K) t = Math.min(TERRAFORM_TARGET_K, t * WORKS_GREENHOUSE);
  if (b.kind === 'eyeball' || b.kind === 'terran' || b.kind === 'super_earth') t *= 1 + 0.12 * b.vitality;
  const airless = (b.kind === 'barren' || b.kind === 'asteroids') && !tf.works;
  if (locked) {
    // the day side faces the star for ever; air and sea carry some heat round to the night (a
    // thick enough air carries most of it: Atmosphere Works). Only the starlight divides so: the
    // world's own heat and the galaxy's glow warm both sides alike, as its air does
    const warmed = t / raw;
    const side = (share: number) => warmed * Math.pow(Math.pow(tEq * share, 4) + Math.pow(tInt, 4) + Math.pow(bg, 4), 0.25);
    if (airless) return { mean: t, day: side(1.4), night: side(0.12), airless };
    const carry = Math.max(0.25 + 0.45 * b.vitality, tf.works ? WORKS_CARRY : 0);
    return { mean: t, day: side(1.3 - 0.15 * carry), night: side(0.35 + 0.4 * carry) };
  }
  return airless ? { mean: t, airless } : { mean: t };
}

// ------------------------------------------------------------ terraforming (sim/terraform.ts)

/** The warmth terraforming aims a world's warmest ground at (K). */
export const TERRAFORM_TARGET_K = 288;
/** Orbital Mirrors double the light a cold world gets from its star, or halve a hot world's. */
export const MIRROR_GAIN = 2;
/** Atmosphere Works' greenhouse air warms a cold world by this factor (never past the target). */
export const WORKS_GREENHOUSE = 1.15;
/** And carries this much of a locked world's heat round to its night side (a living world's air does as much). */
export const WORKS_CARRY = 0.7;

export interface Terraforming {
  mirrors: boolean;
  works: boolean;
}

/**
 * Terraforming runs on a red dwarf's steady light: in the Long Dusk only, around one that still
 * burns. Not by a flaring star, a new star's brief blaze or a remnant: there the worlds are as
 * they would be without it.
 */
export function terraformLit(state: GameState, b: Body): boolean {
  return calendarEra(state) === 'dusk' && !b.rogue && !b.dissolved && state.systems[b.systemId]?.primary.kind === 'red_dwarf';
}

/** No terraforming: a world's climate as it is by itself. */
export const NO_TERRAFORMING: Terraforming = { mirrors: false, works: false };

/** The terraforming a settlement keeps going on its world (none once its star has gone). */
export function terraformingOf(state: GameState, b: Body, c: Colony | undefined = b.colonyId ? state.colonies[b.colonyId] : undefined): Terraforming {
  if (!c || !terraformLit(state, b)) return NO_TERRAFORMING;
  return { mirrors: (c.structures.orbital_mirrors ?? 0) > 0, works: (c.structures.atmosphere_works ?? 0) > 0 };
}

/**
 * How livable a world's warmest ground is for Kin under an open sky: fully from 250 to 330 K,
 * not at all below 200 K (frozen hard) or above 400 K (boiling, then baking).
 */
export function livableWarmth(k: number): number {
  if (k < 250) return Math.max(0, (k - 200) / 50);
  if (k > 330) return Math.max(0, (400 - k) / 70);
  return 1;
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
  return Math.min(2.5, Math.max(0.05, insolationByDistance(state, b)));
}

/** A world's sunlight against its star's standard orbit by the inverse-square law alone (insolation caps it for surface arrays). */
export function insolationByDistance(state: GameState, b: Body): number {
  if (b.rogue) return 0;
  const sys = state.systems[b.systemId];
  if (!sys) return 1;
  const p = sys.primary;
  let aStd: number;
  if (p.kind === 'red_dwarf' || p.kind === 'blue_dwarf' || p.kind === 'collision_star') {
    aStd = 0.031 * Math.pow(Math.max(0.05, p.mass) / 0.1, 1.15);
  } else {
    // (the close worlds set the standard: cold outer worlds far beyond them do not move it)
    const orbits = sys.bodies
      .map((id) => state.bodies[id])
      .filter((x) => x && x.kind !== 'deep' && !x.dissolved && !x.rogue && x.orbitAU > 0 && (!x.traits.includes('outer') || x === b))
      .map((x) => x.orbitAU)
      .sort((x, y) => x - y);
    aStd = orbits.length ? orbits[Math.floor(orbits.length / 2)] : b.orbitAU;
  }
  return (aStd / Math.max(0.003, b.orbitAU)) ** 2;
}

/**
 * Bare ice in a vacuum lasts ages only below about this: Mercury's and the Moon's polar ice
 * (Vasavada, Paige & Wood 1999). Warmer, it sublimates away.
 */
export const AIRLESS_ICE_K = 110;

/**
 * Is the ocean under this world's ice still liquid? While ice is left over it and something keeps
 * it warm: the tides of the star it is bound to (not a world adrift, or alone in the dark), until
 * its core heat runs out after the Last Light.
 */
export function buriedOcean(state: GameState, b: Body, climate: BodyClimate = bodyClimate(state, b)): boolean {
  if (b.dissolved || (b.kind !== 'ocean_ice' && !b.traits.includes('subsurface_ocean'))) return false;
  if (climate.steam || (climate.night ?? climate.mean) >= ICE_MELTS_K) return false;
  const p = state.systems[b.systemId]?.primary;
  if (b.rogue || !p || p.kind === 'rogue' || p.kind === 'void') return false;
  return calendarEra(state) === 'dusk' || b.coreHeat >= BURIED_HEAT;
}

/** After the Last Light a buried ocean stays liquid while its core heat is at least this. */
export const BURIED_HEAT = 0.05;

/**
 * A plain description of a world's water at its current temperature. `ocean`: whether an
 * ice-shelled ocean is still liquid under its ice (buriedOcean); if not, it is frozen through.
 */
export function waterState(b: Body, climate: BodyClimate, ocean = true): string {
  const w = b.water ?? 0;
  if (w <= 0.005) return 'none';
  const share = `${Math.round(w * 100)}%`;
  // ice stays ice only while even the warmest ground is below freezing (a flare can melt it)
  const warmest = climate.day ?? climate.mean;
  if (climate.airless) {
    // no air, so no liquid: ice where the ground is cold enough to keep it, or gone to space
    const coldest = climate.night ?? climate.mean;
    if (b.kind === 'asteroids') return coldest < AIRLESS_ICE_K ? `${share}: ice in the rubble` : `${share}: boiling off the rubble`;
    if (warmest < AIRLESS_ICE_K) return `${share}: frost`;
    if (coldest < AIRLESS_ICE_K) return `${share}: frost cold-trapped on the night side, the day side bare`;
    return `${share}: boiling off into space`;
  }
  if (b.kind === 'ocean_ice' && warmest < 273) return ocean ? `${share}: ${w >= 0.9 ? 'a global ocean' : 'an ocean'} under the ice` : `${share}: frozen through`;
  if (b.kind === 'asteroids') return warmest < 273 ? `${share}: ice in the rubble` : `${share}: boiling off the rubble`;
  const liquidAt = (k: number) => k >= 273 && k < 373;
  if (climate.day !== undefined && climate.night !== undefined) {
    if (liquidAt(climate.day) && !liquidAt(climate.night)) return `${share}: open sea on the day side, ice beyond the terminator`;
    if (liquidAt(climate.day)) return `${share}: open water`;
    if (climate.day >= 373) {
      if (climate.night >= 373) return `${share}: steam, even on the night side`;
      if (liquidAt(climate.night)) return `${share}: boiled off the day side, open sea on the night side`;
      // between the two, along the terminator, the ground passes through 273 to 373 K: a band of sea
      return `${share}: ice on the night side, open water along the terminator, the day side boiled dry`;
    }
    return `${share}: all frozen`;
  }
  if (liquidAt(climate.mean)) return `${share}: open water`;
  if (climate.mean >= 373) return `${share}: steam`;
  return `${share}: frozen`;
}

/**
 * Light from a black hole's accretion disk, in collector units (a red dwarf's light = 1).
 * Also sets how brightly the disk is drawn, so what you see is what collectors get. Nothing feeds
 * one once ordinary matter is gone (`matter` false: after the Great Decay).
 */
export function diskLight(kind: 'black_hole' | 'smbh', era: string, years: number, matter = true): number {
  if (!matter) return 0;
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
