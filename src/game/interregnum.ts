// The Twilight Interregnum (1 Nov, the player: "a sort of a prequel mode where you start earlier,
// from 1e12 years in the future … It would again try to reflect the real physical environment of
// the era"; they named it). A game begun in it (`settings.interregnum`) is generated exactly as a
// game begun in the Dusk, with the same draws, and then rewound here to 10¹² years, with draws of
// its own: each system as it was then, from what it is at the Dusk.
//
// The physics. A red dwarf lives about 10¹² years at 0.25 M☉ and about 1.2 × 10¹³ at 0.08
// (Laughlin, Bodenheimer & Adams 1997; Adams et al. 2004), so every red dwarf shining at 10¹² years
// is dead long before the Dusk, the heaviest first, and the Dusk's small red dwarfs are born late,
// from the last of the gas. Star formation fades as about 1/t (Laughlin), the game lets it run to
// η 14 (a bend beside Adams & Laughlin's 1 to 10 trillion years for the gas, said in the Codex),
// and a few stars brighter than red dwarfs are still young. By then the galaxy is alone: every other
// galaxy is past the horizon, the afterglow of the beginning too faint to see (Krauss & Scherrer
// 2007). So between the old stars' deaths (η ≈ 13.1) and the last stars' births (η ≈ 13.9) the
// galaxy is dim: the interregnum of its name.

import { ERA_BY_ID, INTERREGNUM, eta } from './eras';
import { bodyStats, bodyTemplates, defaultWater, displaySize, flarePeak, inspiralTime } from './gen';
import { bodyName, properName } from './names';
import { formedAt } from './physics';
import { Rng, hashSeed } from './rng';
import type { Body, GameState, Primary, StarClass, StarSystem } from './types';

/** When the Interregnum begins, and when the Dusk does (its end). */
export const INTERREGNUM_START = INTERREGNUM.startYears;
export const DUSK_START = ERA_BY_ID.dusk.startYears;

/** A game begun in the Twilight Interregnum. */
export function interregnumGame(state: { settings: { interregnum?: boolean } }): boolean {
  return !!state.settings.interregnum;
}

/**
 * A red dwarf's life on the main sequence (years), by mass: 10¹² at 0.25 M☉, 1.2 × 10¹³ at 0.08
 * (Laughlin, Bodenheimer & Adams 1997; Adams et al. 2004), a power law between (our fit).
 */
export function redDwarfLife(mass: number): number {
  return 1e12 * Math.pow(Math.max(0.08, mass) / 0.25, -2.18);
}

/** The mass of an old red dwarf that leaves the main sequence at `when`: the heaviest first. */
function massDyingAt(when: number): number {
  return Math.min(0.25, Math.max(0.08, 0.25 * Math.pow(when / INTERREGNUM_START, -1 / 2.18)));
}

/** A red dwarf's light to collectors, in the Dusk's units (gen.ts makePrimary): 1 at about 0.11 M☉, 2.1 at 0.25. */
export function redDwarfLight(mass: number): number {
  return 0.75 + (mass - 0.08) * 8;
}

/** A red dwarf's luminosity in Suns (physics.ts primaryLuminosity): 0.23 M^2.3. */
function redDwarfSuns(mass: number): number {
  return 0.23 * Math.pow(Math.max(0.01, mass), 2.3);
}

/**
 * The young stars of the last star formation, by class: their mass, their life on the main
 * sequence, their light to collectors (compressed, as a helium star's is: the Dusk's units are a
 * red dwarf's light, and a Sun is a thousand of them; a bend the Codex states), their luminosity
 * and surface for the worlds' climates, and the white dwarf each leaves (the initial–final mass
 * relation; a blue giant leaves the neutron star or black hole of its system).
 */
export const YOUNG_CLASSES: Record<StarClass, { name: string; mass: [number, number]; life: [number, number]; light: number; suns: number; k: number; white: [number, number] }> = {
  K: { name: 'Orange dwarf', mass: [0.6, 0.85], life: [1.5e10, 5e10], light: 3, suns: 0.25, k: 4500, white: [0.5, 0.55] },
  G: { name: 'Yellow dwarf', mass: [0.85, 1.15], life: [7e9, 1.3e10], light: 4, suns: 1, k: 5800, white: [0.55, 0.6] },
  F: { name: 'White star', mass: [1.2, 1.6], life: [2e9, 4e9], light: 6, suns: 3.5, k: 6800, white: [0.6, 0.66] },
  A: { name: 'White star', mass: [1.7, 2.6], life: [5e8, 1.5e9], light: 9, suns: 20, k: 8800, white: [0.66, 0.8] },
  B: { name: 'Blue giant', mass: [8, 18], life: [1.5e7, 4e7], light: 14, suns: 4000, k: 22000, white: [1.2, 2] },
};

/** A young star's name with its class: "Yellow dwarf (G)". */
export function youngStarName(p: Primary): string {
  const c = p.cls ?? 'G';
  return `${YOUNG_CLASSES[c].name} (${c})`;
}

/**
 * The share of the galaxy's star-forming gas still left: all of it at 10¹² years, falling with the
 * logarithm of time (star formation fading as 1/t: as much gas goes into stars in each tenfold of
 * time), none from the Last Gas on.
 */
export function gasLeft(years: number): number {
  if (years >= DUSK_START) return 0;
  return Math.max(0, Math.min(1, 1 - Math.log10(Math.max(INTERREGNUM_START, years) / INTERREGNUM_START) / Math.log10(DUSK_START / INTERREGNUM_START)));
}

/** A Gas Scoop's ships reach a nebula this far away (light-years). */
export const GAS_SCOOP_LY = 25;

/** The nearest nebula within a Gas Scoop's reach of a system, if any. */
export function nebulaNear(state: GameState, sys: StarSystem): StarSystem | null {
  let best: StarSystem | null = null;
  let bestD = GAS_SCOOP_LY;
  for (const o of Object.values(state.systems)) {
    if (o.primary.kind !== 'nebula' || o.gone) continue;
    const d = Math.hypot(o.phys.x - sys.phys.x, o.phys.y - sys.phys.y, o.phys.z - sys.phys.z);
    if (d <= bestD) {
      best = o;
      bestD = d;
    }
  }
  return best;
}

/**
 * A nebula's gas gathers into a cloud seen as one from half the galaxy's age at its star's birth
 * (1 Nov, the player: "nebulas should be kind of rare and not literally my entire neighborhood";
 * games begun since then). Until it gathers it is thin gas: dark, not drawn as a cloud, too sparse
 * for its chemistry to be read, but there all the same for a Gas Scoop. A bend: a real cloud
 * gathers and collapses in some tens of millions of years, which at this age would leave almost
 * none to see; this leaves a few at the start and the last of the gas gathering near the age's end.
 */
export const CONDENSE_FACTOR = 2;

/** Is it a nebula's thin gas, not yet gathered into a cloud (a game begun before 1 Nov never has any)? */
export function thinGas(p: Primary): boolean {
  return p.kind === 'nebula' && p.condenseAt !== undefined;
}

/** The last born of a nebula's stars light this long before the Dusk at the latest. */
const LAST_BIRTH = DUSK_START - 1e12;

/** Log-uniform between two dates. */
function logDate(rng: Rng, from: number, to: number): number {
  return Math.pow(10, rng.range(Math.log10(from), Math.log10(to)));
}

/** A system's worlds (not its Deep), nearest first. */
function worldsOf(state: GameState, sys: StarSystem): Body[] {
  return sys.bodies.map((id) => state.bodies[id]).filter((b): b is Body => !!b && b.kind !== 'deep');
}

/**
 * Put away worlds that have not formed yet (`which`, or every one, the Deep with them): out of
 * `state.bodies` and into the system's `unformed`, until its star lights or its remnant is left.
 */
function unform(state: GameState, sys: StarSystem, which?: (b: Body) => boolean) {
  const keep: string[] = [];
  const put: Body[] = sys.unformed ?? [];
  for (const id of sys.bodies) {
    const b = state.bodies[id];
    if (!b) continue;
    if (which && !which(b)) keep.push(id);
    else {
      put.push(b);
      delete state.bodies[id];
    }
  }
  sys.bodies = keep;
  if (put.length) sys.unformed = put;
}

/**
 * Bring a system's unformed worlds into being (a star lit, a remnant left), each where it was:
 * those `which` takes, or all. Returns the worlds formed (for the passes a new galaxy's worlds go
 * through: frozen, and their water: physics.ts).
 */
export function formWorlds(state: GameState, sys: StarSystem, which?: (b: Body) => boolean): Body[] {
  if (!sys.unformed?.length) return [];
  const now = sys.unformed.filter((b) => !which || which(b));
  if (!now.length) return [];
  for (const b of now) state.bodies[b.id] = b;
  const rest = sys.unformed.filter((b) => !now.includes(b));
  const all = [...sys.bodies.map((id) => state.bodies[id]).filter((b): b is Body => !!b), ...now];
  // the Deep first, then by distance, as generation keeps them
  all.sort((a, b) => (a.kind === 'deep' ? -1 : b.kind === 'deep' ? 1 : a.orbitAU - b.orbitAU));
  sys.bodies = all.map((b) => b.id);
  if (rest.length) sys.unformed = rest;
  else delete sys.unformed;
  return now.filter((b) => b.kind !== 'deep');
}

/**
 * Which of a nebula's worlds form when its star lights: all of them; a young star's but those so
 * close they come in only after its giant phase, with its white dwarf; a blue giant's none but its
 * Deep (its worlds come with its remnant, as a pulsar's do).
 */
export function formsAtBirth(star: Primary): (b: Body) => boolean {
  if (star.kind !== 'young_star') return () => true;
  if (star.cls === 'B') return (b) => b.kind === 'deep';
  return (b) => b.kind === 'deep' || b.orbitAU >= 0.1;
}

/** A system becomes a nebula until `bornAt`, when it lights as `future`; its worlds form with it. Thin gas until it gathers (CONDENSE_FACTOR). */
function nebulaUntil(state: GameState, sys: StarSystem, bornAt: number, future: Primary) {
  sys.primary = { kind: 'nebula', mass: future.mass, lum: 0, spin: 0, spinMax: 0, bornAt, future };
  // (thin gas until it gathers, unless it has by now: no random draw)
  const condenseAt = bornAt / CONDENSE_FACTOR;
  if (condenseAt > state.years) sys.primary.condenseAt = condenseAt;
  unform(state, sys);
}

/** Scale a system's worlds outward for a brighter star (√ of the light), so each keeps the light it was made for. */
function scaleOrbits(state: GameState, sys: StarSystem, factor: number, hostMass: number) {
  for (const b of worldsOf(state, sys)) {
    if (b.orbitAU <= 0) continue;
    b.orbitAU *= factor;
    b.inspiralAt = DUSK_START + inspiralTime(b.orbitAU, b.massEarth, Math.max(0.1, hostMass));
    // (a world locked to its star stays locked: a trillion years is long enough even this far out)
  }
}

/** A young world: its core hotter (half again, at most 1), its decline slower. */
function youngWorlds(state: GameState, sys: StarSystem) {
  for (const b of [...worldsOf(state, sys), ...(sys.unformed ?? []).filter((x) => x.kind !== 'deep')]) {
    if (b.coreHeat > 0) b.coreHeat = Math.min(1, b.coreHeat * 1.5);
  }
}

/** An old red dwarf, alive at 10¹² years, leaving the main sequence at `dies`. */
function oldRedDwarf(rng: Rng, dies: number, mass = massDyingAt(dies)): Primary {
  return { kind: 'red_dwarf', mass, lum: redDwarfLight(mass) + rng.range(-0.08, 0.08), blueAt: dies, whiteAt: dies + rng.range(2e9, 6e9), ...flarePeak(mass), spin: 0, spinMax: 0 };
}

/**
 * Close worlds for a red dwarf in a system whose worlds were drawn for its white dwarf (wide
 * orbits): two to five, drawn as generation draws a red dwarf's (gen.ts bodyTemplates), each
 * widened by √ of the star's light beside a 0.105 M☉ one's, so they sit in the same light. The
 * worlds already there stay; all are then named and drawn out by distance.
 */
function addCloseWorlds(state: GameState, sys: StarSystem, rng: Rng) {
  const p = sys.primary;
  const widen = Math.sqrt(redDwarfSuns(p.mass) / redDwarfSuns(0.105));
  const templates = bodyTemplates(rng, { ...p, kind: 'red_dwarf' }).sort((a, b) => a.aAU - b.aAU);
  const have = worldsOf(state, sys);
  const nearest = have.reduce((m, b) => Math.min(m, b.orbitAU), Infinity);
  templates.forEach((t, i) => {
    const a = t.aAU * widen;
    if (a >= nearest * 0.7) return;
    const stats = bodyStats(rng, t.kind);
    const seed = hashSeed(`${sys.id}:interregnum:${i}`);
    const b: Body = {
      id: `bi${sys.id}_${i}`,
      systemId: sys.id,
      name: '',
      kind: t.kind,
      orbit: 0,
      phase: rng.range(0, Math.PI * 2),
      size: displaySize(t.kind, t.massEarth),
      seed,
      orbitAU: a,
      massEarth: t.massEarth,
      ...stats,
      traits: [],
      colonyId: null,
    };
    b.water = defaultWater(t.kind, (seed % 1000) / 1000);
    b.inspiralAt = DUSK_START + inspiralTime(a, t.massEarth, Math.max(0.1, p.mass * 0.95));
    if (a < 0.08 && t.kind !== 'gas_giant') b.traits.push('tidally_locked');
    if (t.kind === 'ocean_ice') b.traits.push('subsurface_ocean');
    if (t.kind !== 'gas_giant' && rng.chance(0.11)) b.relic = { kind: rng.weighted(['archive', 'engine', 'tomb', 'ghosts', 'sleepers'] as const, (k) => (k === 'sleepers' ? 0.6 : 1)), state: 'hidden' };
    state.bodies[b.id] = b;
    sys.bodies.push(b.id);
  });
  // named and drawn out by distance, the Deep first
  const all = worldsOf(state, sys).sort((a, b) => a.orbitAU - b.orbitAU);
  let orbit = 16;
  all.forEach((b, i) => {
    if (i > 0) orbit += rng.range(8, 11);
    b.orbit = orbit + (b.kind === 'gas_giant' ? 4 : 0);
    b.name = bodyName(sys.name, i);
  });
  const deep = sys.bodies.filter((id) => state.bodies[id]?.kind === 'deep');
  sys.bodies = [...deep, ...all.map((b) => b.id)];
}

/**
 * A home (ours, or a neighbour's) at 10¹² years: the same system and worlds, around one of the
 * heavier red dwarfs, 0.19 to 0.22 M☉, old, which flares blue 2 × 10¹¹ to 8 × 10¹¹ years in
 * (about turn 88 to 94 of 114 at Standard; a red dwarf of 0.2 M☉ lives some 1.6 × 10¹² years) and
 * then collapses to a white dwarf. Its worlds are widened by √ of its light beside the star it had
 * at the Dusk, so each keeps the light it was made for.
 */
function heavyHome(state: GameState, sys: StarSystem, rng: Rng, ours: boolean) {
  const was = sys.primary;
  const mass = rng.range(0.19, 0.22);
  const dies = INTERREGNUM_START + Math.pow(10, rng.range(11.3, 11.9));
  sys.primary = oldRedDwarf(rng, dies, mass);
  sys.primary.lum = redDwarfLight(mass);
  scaleOrbits(state, sys, Math.sqrt(redDwarfSuns(mass) / redDwarfSuns(was.mass)), mass * 0.95);
  youngWorlds(state, sys);
  if (!ours) return;
  // our world is young: its core hot, its field strong, its decline a healthy world's
  for (const b of worldsOf(state, sys)) {
    if (!b.traits.includes('homeworld')) continue;
    b.coreHeat = 1;
    b.decline = 0.002;
    b.traits = b.traits.filter((t) => t !== 'failing_dynamo');
  }
}

/**
 * A white dwarf of the Dusk, as it was at 10¹² years (its draw, `r`):
 * - one in five a white dwarf already, formed before (one in four of those still young, glowing);
 * - most an old red dwarf, alive, going out within the Interregnum, the heaviest first;
 * - some a red dwarf born during it, from a nebula, and gone again before the Dusk (one in six:
 *   star formation fading as 1/t makes as many in each tenfold of time);
 * - a few a young orange or yellow dwarf, alive or born later; rarer, a white star (F, A).
 */
function pastOfWhite(state: GameState, sys: StarSystem, rng: Rng) {
  const dusk = sys.primary;
  const r = rng.next();
  // (one born heavy enough to explode one day, deeptime.ts, formed long ago: the stable fate keeps it)
  if (r < 0.2 || dusk.mass >= 1.1) {
    dusk.formed = rng.chance(0.25) ? INTERREGNUM_START - Math.pow(10, rng.range(9, 10.1)) : logDate(rng, 1e9, 8e11);
    return;
  }
  if (r < 0.72) {
    // its death spread through the age as the Dusk spreads its own (gen.ts makePrimary): evenly in
    // the logarithm of the time since the age began, from 10⁸ years in (since 7 Nov; from 10¹⁰
    // until then, when every turn was already longer than a whole flare). A bend: in nature the old
    // red dwarfs' deaths crowd toward the age's end (the Codex says so). The same one draw as ever.
    const dies = INTERREGNUM_START + Math.pow(10, rng.range(8, Math.log10(1.2e13)));
    sys.primary = oldRedDwarf(rng, dies);
    sys.primary.halo = dusk.halo;
    addCloseWorlds(state, sys, rng);
    youngWorlds(state, sys);
    return;
  }
  if (r < 0.86) {
    const mass = rng.range(0.08, 0.25);
    const bornAt = logDate(rng, INTERREGNUM_START * 1.2, LAST_BIRTH);
    const star = oldRedDwarf(rng, bornAt + redDwarfLife(mass) * rng.range(0.8, 1.2), mass);
    star.lum = redDwarfLight(mass);
    sys.primary = star;
    addCloseWorlds(state, sys, rng);
    youngWorlds(state, sys);
    nebulaUntil(state, sys, bornAt, star);
    return;
  }
  const cls: StarClass = r < 0.95 ? (rng.chance(0.55) ? 'K' : 'G') : rng.chance(0.6) ? 'F' : 'A';
  const c = YOUNG_CLASSES[cls];
  const life = rng.range(c.life[0], c.life[1]);
  const born = rng.chance(cls === 'K' || cls === 'G' ? 0.7 : 0.5) ? null : logDate(rng, INTERREGNUM_START * 1.2, LAST_BIRTH);
  const diesAt = born === null ? INTERREGNUM_START + life * rng.range(0.05, 1) : born + life;
  const white: Primary = { ...dusk, mass: rng.range(c.white[0], c.white[1]), whiteAt: diesAt };
  delete white.formed;
  const star: Primary = { kind: 'young_star', cls, mass: rng.range(c.mass[0], c.mass[1]), lum: c.light, spin: 0, spinMax: 0, diesAt, future: white };
  if (born !== null) star.bornAt = born;
  sys.primary = star;
  // its close worlds came in after its giant phase (gen.ts): they come with its white dwarf
  unform(state, sys, (b) => b.kind !== 'deep' && b.orbitAU < 0.1);
  if (cls === 'A' || cls === 'F') for (const b of worldsOf(state, sys)) b.coreHeat = Math.min(1, b.coreHeat * 1.5 + 0.1);
  else youngWorlds(state, sys);
  if (born !== null) nebulaUntil(state, sys, born, star);
}

/**
 * A blue giant, the last of the massive stars: alive at the start (`alive`), or born later from a
 * nebula. It burns for tens of millions of years and leaves its system's neutron star or black
 * hole in a supernova; its worlds come with the remnant (as a pulsar's do: gen.ts addHoleWorlds).
 */
function blueGiant(state: GameState, sys: StarSystem, rng: Rng, alive: boolean) {
  const remnant = sys.primary;
  const c = YOUNG_CLASSES.B;
  const born = alive ? null : logDate(rng, INTERREGNUM_START * 1.2, LAST_BIRTH);
  const diesAt = born === null ? INTERREGNUM_START + Math.pow(10, rng.range(6.5, 7.5)) : born + rng.range(c.life[0], c.life[1]);
  const star: Primary = { kind: 'young_star', cls: 'B', mass: rng.range(c.mass[0], c.mass[1]), lum: c.light, spin: 0, spinMax: 0, diesAt, future: remnant };
  if (born !== null) star.bornAt = born;
  sys.primary = star;
  unform(state, sys, (b) => b.kind !== 'deep');
  if (born !== null) nebulaUntil(state, sys, born, star);
}

/**
 * A star the Dusk knows as a white dwarf, and catalogues by it ("WD 1570"), shines at 10¹² years:
 * a red dwarf, or a young star. It has a name of its own then, as red dwarfs do (gen.ts), and its
 * worlds and its Deep are named after it, those not yet formed too. Drawn from the pass's stream,
 * and never one another star has.
 */
function nameShining(state: GameState, sys: StarSystem, rng: Rng, taken: Set<string>) {
  if (!/^(WD|PSR|BH) /.test(sys.name)) return;
  let name = properName(rng);
  for (let i = 0; i < 20 && taken.has(name); i++) name = properName(rng);
  if (taken.has(name)) return;
  const was = sys.name;
  taken.add(name);
  sys.name = name;
  for (const b of [...sys.bodies.map((id) => state.bodies[id]), ...(sys.unformed ?? [])]) {
    if (b && (b.name === was || b.name.startsWith(`${was} `))) b.name = name + b.name.slice(was.length);
  }
}

/**
 * Rewind a newly generated galaxy to 10¹² years (newGame, before the passes that read the start's
 * temperatures). Draws from a stream of its own, so the galaxy it starts from is the one the same
 * seed gives at the Dusk. Systems of note keep what they are, but for the homes.
 */
export function interregnumPass(state: GameState) {
  const rng = new Rng(hashSeed(`${state.settings.seed}:interregnum`));
  state.era = 'interregnum';
  state.eraTurn = 0;
  state.years = INTERREGNUM_START;
  state.eta = eta(INTERREGNUM_START);
  state.turnLength = INTERREGNUM.l0;
  // the homes: ours, and each neighbour's (the Lattice lives at a brown dwarf, which stays one)
  const homes = [state.civ.homeSystemId, ...Object.values(state.survivors).map((sv) => sv.homeSystemId)];
  for (const id of homes) {
    const sys = state.systems[id];
    if (sys?.primary.kind === 'red_dwarf') heavyHome(state, sys, rng, id === state.civ.homeSystemId);
  }
  const home = new Set(homes);
  const remnants: StarSystem[] = [];
  for (const sys of Object.values(state.systems)) {
    if (home.has(sys.id) || sys.special || sys.gone) continue;
    const p = sys.primary;
    switch (p.kind) {
      case 'red_dwarf':
      case 'blue_dwarf': {
        // a star of the Dusk: born from the last of the gas, one life before it flares
        const bornAt = Math.min(LAST_BIRTH, Math.max(INTERREGNUM_START * 1.2, (p.blueAt ?? DUSK_START) - redDwarfLife(p.mass)));
        nebulaUntil(state, sys, bornAt, p);
        break;
      }
      case 'white_dwarf':
        pastOfWhite(state, sys, rng);
        break;
      case 'brown_dwarf': {
        const at = formedAt(p);
        if (at > INTERREGNUM_START) nebulaUntil(state, sys, Math.min(LAST_BIRTH, at), p);
        break;
      }
      case 'neutron_star':
      case 'black_hole':
        if (p.mass < 50) remnants.push(sys);
        break;
      default:
        break;
    }
  }
  // the massive stars: one or two still burning, and one more now and then born later
  rng.shuffle(remnants);
  const alive = rng.int(1, 2);
  const later = rng.int(0, 2);
  remnants.slice(0, alive + later).forEach((sys, i) => blueGiant(state, sys, rng, i < alive));
  // every star that shines in the age, or will, by a name of its own (a catalogue's is the Dusk's)
  const taken = new Set(Object.values(state.systems).map((x) => x.name));
  for (const sys of Object.values(state.systems)) {
    const k = sys.primary.kind === 'nebula' ? sys.primary.future?.kind : sys.primary.kind;
    if (k === 'red_dwarf' || k === 'young_star') nameShining(state, sys, rng, taken);
  }
  // the galaxy as it was: what each civilization knows of a nebula is what it knows of the place
}
