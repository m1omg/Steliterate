import { STRUCTURES, type StructureDef } from '../data/structures';
import { formatYears } from '../eras';
import { bodyClimate, hawkingLight, sourceLight } from '../physics';
import type { Body, GameState, ThreadId } from '../types';
import { turnStep } from './flare';
import { naturalKinRoom } from './fleets';
import { eraIndex, hasTech } from './util';

// What a world is worth to each kind of mind, for choosing where to settle. Kin need livable
// ground; Echoes (and the Chorus) need power for their substrate; the Lattice needs matter to
// build and repair with; Coldminds need almost nothing, only a place that lasts. The numbers use
// the same rules as the economy, with the buildings we could put there today.

/** Could a settlement on this world build it now? (structureCheck's location rules, without a colony) */
function buildableAt(state: GameState, b: Body, d: StructureDef): boolean {
  if (d.tech && !hasTech(state, d.tech)) return false;
  if (eraIndex(d.era) > eraIndex(state.era)) return false;
  const sys = state.systems[b.systemId];
  // orbital structures can be built from any world in the system
  if (d.bodies && !d.bodies.includes(b.kind) && !d.bodies.includes('deep')) return false;
  if (d.notBodies && d.notBodies.includes(b.kind)) return false;
  if (d.primaries && !d.primaries.includes(sys.primary.kind)) return false;
  if (d.habitable && b.habitability < 0.3) return false;
  if (d.id === 'disk_skimmer' && !(sys.primary.rekindle && sys.primary.rekindle > 0)) return false;
  return true;
}

/** Energy a settlement here could collect in a turn at the Tide: its Hearth plus every collector we can build. */
export function powerAt(state: GameState, b: Body): number {
  if (b.dissolved) return 0;
  const sys = state.systems[b.systemId];
  const p = sys.primary;
  const L = turnStep(state, 0).turnLength;
  const light = b.rogue ? 0 : sourceLight(state, sys, state.years, isFinite(L) ? L : 0).light;
  const hole = p.kind === 'black_hole' || p.kind === 'smbh';
  let e = 2 * Math.max(0.25, Math.min(1.5, light), b.coreHeat * 0.8, hole && eraIndex(state.era) >= 1 ? 1 : 0);
  for (const d of STRUCTURES) {
    if (!d.energy || !buildableAt(state, b, d)) continue;
    const a = d.energy.amount * d.max;
    switch (d.energy.mode) {
      case 'light':
        e += a * light;
        break;
      case 'geo':
        e += a * b.coreHeat;
        break;
      case 'rekindle':
        e += a * (p.rekindle ?? 0);
        break;
      case 'spin':
        if (p.spin > 0) e += a;
        break;
      case 'hawking':
        e += a * hawkingLight(p, state.years);
        break;
      default:
        break; // fuel burners and the late-age harvesters work the same anywhere
    }
  }
  return e;
}

/** Matter a settlement here could raise in a turn at the Tide: mines, skimmers and lifters. */
export function matterAt(state: GameState, b: Body): number {
  if (b.dissolved) return 0;
  const gfe = 0.4 + 0.6 * state.gfe;
  let m = 0;
  for (const d of STRUCTURES) {
    if (!(d.matterYield || d.hydrogenYield || d.lift) || !buildableAt(state, b, d)) continue;
    m += ((d.matterYield ?? 0) * b.richness + (d.hydrogenYield ?? 0) * b.hydrogen + (d.lift ?? 0)) * d.max;
  }
  return m * gfe;
}

/** The cosmic year this world is lost to us (falls into its dead star), or Infinity. */
export function lastsUntil(b: Body): number {
  if (b.dissolved) return 0;
  return b.feeding ? b.feeding.start : (b.inspiralAt ?? Infinity);
}

export interface SiteValue {
  score: number;
  label: string;
  tip: string;
}

/** How good a world is for settlers of one kind, with a short label and why. */
export function siteValue(state: GameState, b: Body, thread: ThreadId): SiteValue {
  switch (thread) {
    case 'kin': {
      const hab = b.habitability * b.vitality;
      const room = b.kind === 'gas_giant' ? 0 : naturalKinRoom(b);
      return {
        score: room * 10 + hab,
        label: room > 0 ? `${Math.round(hab * 100)}% · ${room} room` : `${Math.round(hab * 100)}% · domes`,
        tip: 'Kin need livable ground: habitability × vitality, and room for Kin without building anything.',
      };
    }
    case 'echoes':
    case 'chorus': {
      const p = powerAt(state, b);
      return {
        score: p,
        label: `≈${Math.round(p)} energy`,
        tip: 'Minds on substrate need power, not air: about what a settlement here could collect each turn at the Tide, with its Hearth and every collector you can build now (light × the star, geothermal × the core).',
      };
    }
    case 'lattice': {
      const m = matterAt(state, b);
      return {
        score: m + powerAt(state, b) * 0.1,
        label: `≈${Math.round(m)} matter`,
        tip: 'The Lattice builds and repairs with matter: about what its mines, skimmers and lifters could raise here each turn at the Tide.',
      };
    }
    case 'coldminds': {
      const until = lastsUntil(b);
      const left = until - state.years;
      const t = b.kind === 'gas_giant' || b.kind === 'ice_giant' ? 100 : bodyClimate(state, b).mean;
      return {
        // what lasts longest first; among those, the colder
        score: (isFinite(left) ? Math.log10(Math.max(1, left)) : 400) - t / 10000,
        label: isFinite(left) ? `lasts ${formatYears(Math.max(0, left))}` : 'never falls in',
        tip: 'Coldminds need almost nothing from a world, only time: how long before this one falls into its dead star. Among equals, the colder first.',
      };
    }
  }
}
