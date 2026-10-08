// Terraforming, as it has been proposed for Mars (and, with shades, for Venus), for the worlds a
// dim red sun leaves dead. Orbital Mirrors send a cold world more of its star's light, or shade a
// hot one. Atmosphere Works build it an air (greenhouse gases, and volatiles steered in from icy
// bodies) that keeps a cold world warm, carries heat round to the night side of a locked world and
// lets water stay liquid. On a world made warm and wet enough, Biosphere Seeding lets engineered
// life spread across it, and that is what gives Kin room to live under an open sky (room follows
// habitability × vitality). It is for dead and marginal worlds: one already habitable gains little
// (nothing past TERRAFORM_CEILING), and seeding is only for worlds with no life of their own.
//
// All of it runs on a red dwarf's steady light, in the Long Dusk only (physics.ts terraformLit):
// when the star flares or dies, or the Last Light comes, the warmth goes, and the seeded life
// freezes as any living world's does (seededLifeUnkept).
//
// Grounded: McKay, Toon & Kasting 1991 (Nature 352: making Mars habitable), Zubrin & McKay 1993
// (AIAA-93-2005: orbital mirrors and halocarbon factories), Joshi, Haberle & Reynolds 1997 (Icarus
// 129: a thick enough air carries heat round a tidally locked world). Bent: Mars itself has too
// little carbon dioxide to thicken its air (Jakosky & Edwards 2018, Nature Astronomy 2), so here
// the volatiles are brought in; and the work takes the few turns the game gives it, however long
// the turns are.

import type { Body, Colony, GameState } from '../types';
import { livableWarmth, starClimate, terraformLit, terraformingOf, type Terraforming } from '../physics';

/** Habitability the mirrors add, and the works: in full where the world's warmest ground becomes livable. */
export const MIRROR_LIFT = 0.2;
export const WORKS_LIFT = 0.25;
/** Terraforming makes a world no more habitable than this (a living world can be far better). */
export const TERRAFORM_CEILING = 0.55;
/** Seeded life needs at least this habitability, and this much water, to take hold. */
export const SEED_MIN = 0.3;
export const SEED_WATER = 0.05;
/** A world with this much life of its own is not seeded: it has a biosphere already. */
export const OWN_LIFE = 0.5;
/** Vitality seeded life adds a turn, up to SEED_CAP. */
export const SEED_RATE = 0.04;
export const SEED_CAP = 0.8;
/** Atmosphere Works bring in water with the air: at least this share of the surface. */
export const WORKS_WATER = 0.1;

export type TerraformKind = 'mirrors' | 'works' | 'seeding';

const colonyOf = (state: GameState, b: Body) => (b.colonyId ? state.colonies[b.colonyId] : undefined);

/** A world's climate under this terraforming (its warmest ground: the day side of a locked world). */
export function terraformedWarmth(state: GameState, b: Body, tf: Terraforming): number {
  const cl = starClimate(state, b, undefined, tf);
  return cl.day ?? cl.mean;
}

/** Habitability terraforming adds, and the warmth it brings the world to. */
function lift(state: GameState, b: Body, tf: Terraforming): { add: number; warmth: number } {
  const warmth = terraformedWarmth(state, b, tf);
  const add = ((tf.mirrors ? MIRROR_LIFT : 0) + (tf.works ? WORKS_LIFT : 0)) * livableWarmth(warmth);
  return { add, warmth };
}

/** A world's habitability: its own, raised by the terraforming its settlement keeps going. */
export function habitabilityOf(state: GameState, b: Body, c: Colony | undefined = colonyOf(state, b)): number {
  const tf = terraformingOf(state, b, c);
  if (!tf.mirrors && !tf.works) return b.habitability;
  return Math.max(b.habitability, Math.min(TERRAFORM_CEILING, b.habitability + lift(state, b, tf).add));
}

/** Why Biosphere Seeding cannot take hold on this world (null if it can). */
export function seedingBlocked(state: GameState, b: Body, c: Colony | undefined = colonyOf(state, b)): string | null {
  if (b.habitability >= OWN_LIFE) return 'It has life of its own: seeding is for dead worlds.';
  const h = habitabilityOf(state, b, c);
  if (h < SEED_MIN) return `Too harsh for anything to take hold: habitability ${Math.round(h * 100)}%, and life needs ${Math.round(SEED_MIN * 100)}% (Orbital Mirrors and Atmosphere Works first).`;
  if ((b.water ?? 0) < SEED_WATER) return 'Too dry for life to start: Atmosphere Works bring water in with the air.';
  return null;
}

/**
 * The world's vitality once its seeded life has spread this turn (as it is, if none is seeded or
 * it cannot spread). Kept to six places, so it comes to SEED_CAP exactly.
 */
export function seededVitality(state: GameState, b: Body, c: Colony): number {
  if (!((c.structures.biosphere_seeding ?? 0) > 0) || b.dissolved || b.vitality >= SEED_CAP || !terraformLit(state, b) || seedingBlocked(state, b, c)) return b.vitality;
  return Math.min(SEED_CAP, Math.round((b.vitality + SEED_RATE) * 1e6) / 1e6);
}

/** Vitality the seeded life on this world adds this turn (0 if none is seeded, or it cannot spread). */
export function seedingGrowth(state: GameState, b: Body, c: Colony): number {
  return seededVitality(state, b, c) - b.vitality;
}

/**
 * Why a terraforming structure cannot be built on this world (null if it can): it needs a star
 * that still burns, a world not already as habitable as terraforming makes one, and a climate the
 * mirrors and the air together could make livable (no use at 60 K, or at 600).
 */
export function terraformBlocked(state: GameState, b: Body, c: Colony | undefined, kind: TerraformKind): string | null {
  if (!terraformLit(state, b)) return 'Terraforming runs on a red dwarf’s steady light: only around one that still burns, in the Long Dusk.';
  if (kind === 'seeding') return seedingBlocked(state, b, c);
  if (b.habitability >= TERRAFORM_CEILING) return 'Already as habitable as terraforming can make a world.';
  const both = lift(state, b, { mirrors: true, works: true });
  if (both.add <= 0) return `No use here: even with mirrors and air its warmest ground would be ${Math.round(both.warmth)} K, ${both.warmth < 250 ? 'frozen hard' : 'too hot to live in'}.`;
  return null;
}

/** For the world's panel and the build list: what terraforming does here, now and with all of it. */
export function terraformSummary(state: GameState, b: Body, c: Colony | undefined = colonyOf(state, b)): { own: number; now: number; warmth: number; full: number; fullWarmth: number } {
  const tf = terraformingOf(state, b, c);
  const all = { mirrors: true, works: true };
  const fullLift = lift(state, b, all);
  return {
    own: b.habitability,
    now: habitabilityOf(state, b, c),
    warmth: terraformedWarmth(state, b, tf),
    full: Math.max(b.habitability, Math.min(TERRAFORM_CEILING, b.habitability + fullLift.add)),
    fullWarmth: fullLift.warmth,
  };
}
