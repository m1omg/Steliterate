// How a fleet fights (the combat system, 20 Oct; docs/plans/2026-10-20-combat.md): a tactic it
// keeps until told otherwise, the same in every fight it is in, against ships, settlements and
// swarms. Each changes what its ships deal and what they take; Stand off cannot hold a siege, storm
// or raid, and an Escort's warships take the fire meant for its unarmed ships. Close in and Stand
// off change both alike: between two fleets they set how fast a fight goes, not who wins it (at
// ×0.35 taken, Stand off won even four ships against five holding the line); a settlement's guns,
// which no battle silences, a swarm's odds, a siege's clock and help on its way are what make them
// matter.
import type { Fleet, TacticId } from '../types';
import { isWarship } from './ships';

export interface TacticDef {
  id: TacticId;
  name: string;
  /** What it does, in the fleet's panel. */
  desc: string;
  /** What its ships' fire is multiplied by. */
  dealt: number;
  /** What the fire and hurt that reach its ships are multiplied by. */
  taken: number;
  /** Whether it can hold a siege, storm a settlement and raid. */
  holds: boolean;
  /** Whether its warships take the fire meant for its unarmed ships. */
  escorts?: boolean;
}

export const TACTICS: TacticDef[] = [
  { id: 'line', name: 'Hold the line', desc: 'Fire at will, and take what comes.', dealt: 1, taken: 1, holds: true },
  { id: 'close', name: 'Close in', desc: 'To close range, where a laser’s spot is small and a slug has no time to be dodged, both ways: ends a fight sooner, for the stronger side.', dealt: 1.5, taken: 1.5, holds: true },
  { id: 'standoff', name: 'Stand off', desc: 'Keep to the edge of range, where the light-seconds between them let a jinking ship slip a beam or a slug, both ways: half the hits land, and a fight lasts twice as long. Holding out, or waiting for help; it holds no siege, cannot storm or raid, and is not dug in.', dealt: 0.5, taken: 0.5, holds: false },
  { id: 'escort', name: 'Escort', desc: 'Its warships put themselves between the enemy and its unarmed ships, and take the fire meant for them; they fire less for it.', dealt: 0.75, taken: 1, holds: true, escorts: true },
];

export const TACTIC_BY_ID: Record<TacticId, TacticDef> = Object.fromEntries(TACTICS.map((t) => [t.id, t])) as Record<TacticId, TacticDef>;

/** A fleet's tactic (one from before the combat system holds the line, and so does one without a warship: there is no one aboard to fight). */
export function tacticOf(f: Fleet): TacticDef {
  if (!f.tactic || !f.ships.some((s) => isWarship(s.cls))) return TACTIC_BY_ID.line;
  return TACTIC_BY_ID[f.tactic] ?? TACTIC_BY_ID.line;
}

/** What a tactic does, in figures, for its button's tip. */
export function tacticNote(t: TacticDef): string {
  const x = (n: number) => `×${n}`;
  return `Deals ${x(t.dealt)}, takes ${x(t.taken)}${t.escorts ? '; its warships take the fire meant for its unarmed ships' : ''}${t.holds ? '' : '; holds no siege, and cannot storm or raid'}.`;
}

/**
 * What each of a fleet's ships takes of the hurt drawn for it (`hits`, one for each ship, in its
 * order): its tactic's share, and an Escort's unarmed ships' hurt borne by its warships, evenly.
 * The draws are the same whatever the tactic, so a fleet holding the line takes what it always did.
 */
export function shareHurt(f: Fleet, hits: number[]): number[] {
  const t = tacticOf(f);
  const out = hits.map((h) => h * t.taken);
  if (!t.escorts) return out;
  const armed = f.ships.map((s) => isWarship(s.cls));
  const n = armed.filter(Boolean).length;
  if (!n) return out;
  const moved = out.reduce((a, h, i) => a + (armed[i] ? 0 : h), 0);
  return out.map((h, i) => (armed[i] ? h + moved / n : 0));
}

/** Whether a fleet fights dug in, by its ships' own bonus: fortified, and not standing off (standing off, it gives up its post). */
export function fleetDug(f: Fleet): boolean {
  return f.order === 'fortify' && tacticOf(f).holds;
}
