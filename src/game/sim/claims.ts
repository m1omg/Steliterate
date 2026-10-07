// Expansion. A thriving civilization sends settlers to the stars of its own cluster that suit its
// way of life: gardens to living worlds; uploads and the Choir to embers and holes (white dwarfs,
// neutron stars, black holes); the sleepers to cold worlds by new stars; the Tessellate to brown
// dwarfs and belts. Never to a star we live at, or another civilization's. Their ships cross at a
// fiftieth of the speed of light, the star is theirs when they arrive, and we see it (a ring on
// the map in their colour) when the light of it reaches us. Every new source slows their decline.
// The Hunger smells them as it smells us; when it feeds at one of their stars they ask us for
// warships, and remember whether we came.

import type { Body, GameState, StarSystem, Survivor, SurvivorWay } from '../types';
import { livingWorlds } from './fleets';
import { residentsOf } from './homes';
import { sendSignal } from './signals';
import { distanceToThem, lightArrived, spreadNews, voice } from './survivors';
import { capital, distLy, log } from './util';

/** How far they look for new stars (ly): their own cluster. */
export const CLAIM_REACH = 100;
/** The most stars they settle beyond their first. */
export const MAX_CLAIMS = 3;
/** Each turn a thriving civilization with room to grow sends settlers out with this chance. */
export const CLAIM_CHANCE = 0.06;
/** Their settlers' ships cross at this fraction of the speed of light. */
export const CLAIM_SPEED = 0.02;
/** Every star they hold beyond their first eases their decline: drain ÷ (1 + this × stars). */
export const CLAIM_EASE = 0.25;
/** Turns we have to keep a promise of warships. */
export const PROMISE_TURNS = 10;
/** They ask for help against the same swarm at most once in this many turns. */
export const PLEA_EVERY = 10;

/** What they look for in a star, by way of life (a fork as the Thread it came from). */
function wants(sv: Survivor): SurvivorWay {
  if (sv.way !== 'fork') return sv.way;
  return sv.forkOf === 'kin' ? 'garden' : sv.forkOf === 'lattice' ? 'lattice' : 'upload';
}

const NEW_STARS = new Set(['collision_star', 'helium_star', 'helium_giant']);
const COLD = new Set(['barren', 'ice', 'ocean_ice']);

/** Whether a star suits their way of life. */
export function suits(state: GameState, sv: Survivor, sys: StarSystem): boolean {
  const k = sys.primary.kind;
  const bodies = sys.bodies.map((id) => state.bodies[id]).filter((b) => b && !b.dissolved);
  switch (wants(sv)) {
    case 'garden':
      return livingWorlds(state, sys.id).length > 0;
    case 'upload':
    case 'chorus':
      return k === 'white_dwarf' || k === 'neutron_star' || k === 'black_hole';
    case 'dormant':
      return NEW_STARS.has(k) && bodies.some((b) => COLD.has(b.kind));
    case 'lattice':
      return k === 'brown_dwarf' || bodies.some((b) => b.kind === 'asteroids');
    default:
      return false;
  }
}

/** Whether anyone lives at a star already: we do, another civilization does, or settlers are on their way to it. */
function taken(state: GameState, sys: StarSystem): boolean {
  if (Object.values(state.colonies).some((c) => c.systemId === sys.id)) return true;
  return Object.values(state.survivors).some((o) => o.alive && (o.systems.includes(sys.id) || o.claim?.systemId === sys.id));
}

/** The nearest free star within reach that suits them, and how far it is from the nearest of theirs. */
export function claimTarget(state: GameState, sv: Survivor): { sys: StarSystem; ly: number } | null {
  const mine = sv.systems.map((id) => state.systems[id]).filter((x): x is StarSystem => !!x && !x.gone);
  let best: { sys: StarSystem; ly: number } | null = null;
  for (const sys of Object.values(state.systems)) {
    if (sys.gone || sys.ejected || sys.special || taken(state, sys)) continue;
    const ly = Math.min(...mine.map((m) => distLy(m, sys)));
    if (!(ly <= CLAIM_REACH) || (best && ly >= best.ly) || !suits(state, sv, sys)) continue;
    best = { sys, ly };
  }
  return best;
}

/** Stars they hold beyond their first, still standing. */
export function claimedStars(state: GameState, sv: Survivor): number {
  return sv.systems.filter((id) => id !== sv.homeSystemId && state.systems[id] && !state.systems[id].gone).length;
}

/** How much their new sources ease the universe's drain on them. */
export function claimEase(state: GameState, sv: Survivor): number {
  return 1 / (1 + CLAIM_EASE * Math.min(MAX_CLAIMS, claimedStars(state, sv)));
}

/** Their side, each of their turns: settlers arrive, or a thriving civilization sends some out. */
export function expand(state: GameState, sv: Survivor, chance: () => number) {
  const c = sv.claim;
  if (c) {
    if (!lightArrived(state, c.at)) return;
    delete sv.claim;
    const sys = state.systems[c.systemId];
    // someone else got there first, or there is nothing left: they will look again
    if (!sys || sys.gone || Object.values(state.colonies).some((x) => x.systemId === sys.id) || Object.values(state.survivors).some((o) => o !== sv && o.alive && o.systems.includes(sys.id))) return;
    sv.systems.push(sys.id);
    (sv.claimedAt ??= {})[sys.id] = state.years;
    sv.health = Math.min(1, sv.health + 0.05);
    return;
  }
  if (sv.health <= 0.5 || sv.pop < 12 || claimedStars(state, sv) >= MAX_CLAIMS || chance() >= CLAIM_CHANCE) return;
  const t = claimTarget(state, sv);
  if (!t) return;
  sv.claim = { systemId: t.sys.id, at: isFinite(state.years) ? state.years + t.ly / CLAIM_SPEED : state.years };
}

/** Whether we can see that they live at a star: we know of them, and the light of their arrival has reached us. */
export function seenThere(state: GameState, sv: Survivor, systemId: string): boolean {
  if (!sv.alive || !sv.contact || !sv.systems.includes(systemId)) return false;
  const at = sv.claimedAt?.[systemId];
  if (at === undefined) return true;
  const cap = capital(state);
  const here = cap ? state.systems[cap.systemId] : state.systems[state.civ.homeSystemId];
  const there = state.systems[systemId];
  return lightArrived(state, at + (here && there ? distLy(here, there) : 0));
}

/** The stars of theirs we can see. */
export function starsSeen(state: GameState, sv: Survivor): string[] {
  return sv.systems.filter((id) => seenThere(state, sv, id));
}

/** A living civilization is warm: the Hunger smells it as it smells us. */
export function theirWarmth(state: GameState, systemId: string): number {
  let w = 0;
  for (const sv of Object.values(state.survivors)) if (sv.alive && !sv.exodus && sv.systems.includes(systemId)) w += 0.1 * sv.pop * sv.health;
  return w;
}

/** A swarm feeds at one of their stars: they ask us for warships (at most once in PLEA_EVERY turns). Returns true if they asked. */
export function askAgainstHunger(state: GameState, sv: Survivor): boolean {
  if (sv.promised || sv.war) return false;
  const key = `swarm_plea_${sv.id}`;
  if (state.turn - (state.civ.flags[key] ?? -99) < PLEA_EVERY) return false;
  const sw = Object.values(state.swarms).find((w) => w.systemId && w.awake && !w.tamed && sv.systems.includes(w.systemId));
  if (!sw) return false;
  const sys = state.systems[sw.systemId!];
  state.civ.flags[key] = state.turn;
  sv.lastSent = state.turn;
  sendSignal(state, {
    from: sv.id,
    kind: 'swarm_plea',
    distanceLy: distanceToThem(state, sv),
    title: `${sv.name} asks for help against the Hunger`,
    text: voice(
      sv,
      `A swarm of the Hunger is feeding at ${sys.name}. We cannot drive it off alone. If you have warships, send them.`,
      `HOSTILE HARVESTER ACTIVE AT ${sys.name.toUpperCase()}. LOCAL COUNTERMEASURES INSUFFICIENT. REQUEST: ARMED ASSISTANCE.`,
    ),
    data: { systemId: sys.id },
    choices: [
      { id: 'promise', label: 'We will send warships', hint: `Order warships to ${sys.name}. If ours fight it there within ${PROMISE_TURNS} turns they will remember it; if we never come, they will remember that too.` },
      { id: 'refuse', label: 'We cannot', hint: 'They will understand.' },
    ],
  });
  return true;
}

/** Our answer: we promise warships. */
export function promiseHelp(state: GameState, sv: Survivor, systemId: string): string | null {
  if (!sv.alive) return 'They are gone.';
  sv.promised = { systemId, turn: state.turn };
  const sys = state.systems[systemId];
  log(state, `We promised ${sv.name} warships at ${sys?.name ?? 'their star'}: ${PROMISE_TURNS} turns to keep our word.`, 'info', systemId);
  return null;
}

/** Their side of a promise, each of their turns: kept, broken, or moot once the swarm has gone. */
export function judgePromise(state: GameState, sv: Survivor) {
  const p = sv.promised;
  if (!p || state.turn - p.turn < PROMISE_TURNS) return;
  delete sv.promised;
  const sys = state.systems[p.systemId];
  if (p.kept) {
    sv.disposition = Math.min(100, sv.disposition + 10);
    log(state, `${sv.name} saw our warships fight for them at ${sys?.name ?? 'their star'}, as we promised.`, 'good', p.systemId);
  } else if (Object.values(state.swarms).some((w) => w.systemId === p.systemId && w.awake && !w.tamed)) {
    sv.disposition = Math.max(-100, sv.disposition - 10);
    log(state, `We promised ${sv.name} warships at ${sys?.name ?? 'their star'}, and none came. They will remember.`, 'bad', p.systemId);
  }
}

/**
 * Our warships fought a swarm at a star: whoever lives there is glad of it, and if the swarm
 * broke, everyone hears of it.
 */
export function foughtFor(state: GameState, systemId: string, broke: boolean) {
  for (const sv of Object.values(state.survivors)) {
    if (!sv.alive || !sv.systems.includes(systemId)) continue;
    sv.disposition = Math.min(100, sv.disposition + (broke ? 20 : 5));
    if (sv.promised?.systemId === systemId) sv.promised.kept = true;
    const sys = state.systems[systemId];
    if (broke) spreadNews(state, systemId, 5, `you broke the Hunger at ${sys?.name ?? 'a star'} for ${sv.name}`, sv.id);
    if (sv.contact) log(state, broke ? `${sv.name} will not forget that our warships broke the swarm at ${sys?.name}.` : `${sv.name} saw our warships fight the swarm at ${sys?.name}.`, 'good', systemId);
  }
}

/** The civilization we can see living on this world: at its first star, or where the light of its arrival has reached us. */
export function residentsSeen(state: GameState, b: Body): Survivor | null {
  const sv = residentsOf(state, b);
  return sv && (sv.homeSystemId === b.systemId || seenThere(state, sv, b.systemId)) ? sv : null;
}
