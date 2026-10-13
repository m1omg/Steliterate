// The turn with more than one civilization (the new version, docs/plans/new-version.md, part
// 2a-0): every civilization plays its part of each step under its own perspective, the universe
// moves once between the steps, and none writes to another's own. A second civilization, a plain
// copy of ours set down at another star, played by the autoplayer under its own perspective (part
// 2a gives it a mind of its own), plays alongside ours under the checks' guard, which throws at any
// write that crosses over:
// - the player plays first, then the others; one whose game is over plays no more;
// - a whole age of turns and the Last Light pass with no write crossing over;
// - its settlement lives its own economy, its record and forecasts are its own;
// - at the crossing each has its own report: the universe's lines in both, its own losses in each;
// - the swarms go for anyone's ships, each civilization's by its own charters (Communion spares only
//   its own), told in its own Record; a tamed swarm works for whoever tamed it;
// - each builds its own Deep in a system another's Deep is in.
import { autoPlay } from '../../../src/game/auto';
import { asCiv, isPlayerView, setCivGuard } from '../../../src/game/civs';
import { newGame } from '../../../src/game/newGame';
import { copyState } from '../../../src/game/save';
import { createColony, deepFor, newFleet } from '../../../src/game/sim/fleets';
import { swarmsHunt, updateHunger } from '../../../src/game/sim/hunger';
import { computeMods } from '../../../src/game/sim/mods';
import { endTurn, turnOrder } from '../../../src/game/sim/turn';
import { colonies, distLy, popsOf } from '../../../src/game/sim/util';
import type { Civ, GameState } from '../../../src/game/types';
import { check, done } from '../lib';

/**
 * A second civilization: ours as it began, with a settlement like our first at the nearest free
 * world in another reach, as the others live (next door, two civilizations' warmth draws the
 * swarms of both reaches on them both).
 */
function addCiv(s: GameState, id: string): Civ {
  // (a deep reserve, so that it lives to the Last Light around whatever star it found)
  const c: Civ = { ...structuredClone(s.civ), id, name: `Others ${id}`, capitalId: null, known: {}, flags: {}, signals: [], forecasts: [], pending: [], log: [], crossing: null, outcome: null, fired: {}, stats: { pops: [], energy: [], resolve: [] }, energy: 4000, matter: 4000 };
  s.civs[id] = c;
  const ours = colonies(s)[0];
  const home = s.systems[ours.systemId];
  const free = (bid: string) => {
    const b = s.bodies[bid];
    return !!b && !b.colonyId && !b.dissolved && (b.kind === 'terran' || b.kind === 'super_earth' || b.kind === 'barren' || b.kind === 'eyeball');
  };
  const sys = Object.values(s.systems)
    .filter((x) => x.regionId !== home.regionId && !x.special && !x.gone && x.bodies.some(free))
    .sort((a, b) => distLy(home, a) - distLy(home, b))[0];
  // a world like our first, so that its people can live there
  const b = s.bodies[sys.bodies.find(free)!];
  const was = s.bodies[ours.bodyId];
  Object.assign(b, { kind: was.kind, habitability: was.habitability, vitality: was.vitality, decline: was.decline, coreHeat: was.coreHeat, water: was.water, richness: was.richness });
  asCiv(s, id, () => {
    const col = createColony(s, b, { ...ours.pops });
    col.structures = { ...ours.structures };
  });
  return c;
}

const s = newGame({ seed: 8919, survivors: 3, protonFate: 'decays' });
const other = addCiv(s, 'sv9');
const theirs = Object.values(s.colonies).find((c) => c.owner === 'sv9')!;
check(turnOrder(s).join(' ') === 'us sv9', `the player plays first, then the others (${turnOrder(s).join(', ')})`);
check(other.capitalId === theirs.id && colonies(s).every((c) => c.owner === 'us'), `its settlement (${theirs.name}) is its own and its capital; ours are ours`);

setCivGuard(true);
let threw = '';
let crossing = false;
const e0 = other.energy;
try {
  for (let i = 0; i < 400 && !s.civ.outcome && !crossing; i++) {
    autoPlay(s, 'competent');
    // it plays as the autoplayer plays for us, under its own perspective (part 2a gives it a mind of its own)
    asCiv(s, 'sv9', () => autoPlay(s, 'competent'));
    const r = endTurn(s);
    crossing = !!r.crossing;
    if (!isPlayerView(s)) throw new Error(`after turn ${s.turn} the state is pointed at ${s.civ.id}`);
  }
} catch (e) {
  threw = String(e).split('\n')[0];
}
setCivGuard(false);
check(threw === '', `a whole Dusk with two civilizations, no write crossing over${threw ? `: ${threw}` : ''} (to turn ${s.turn})`);
check(crossing && s.era === 'degenerate', `the Last Light came (turn ${s.turn}, ${s.era})`);
check(other.stats.pops.length === s.civ.stats.pops.length && other.stats.pops.length > 50, `it played every turn with us: ${other.stats.pops.length} turns of its own record`);
check(other.energy !== e0 && !!theirs.last && theirs.last.energy > 0, `its settlement lives its own economy (${theirs.last?.energy.toFixed(1)} energy a turn, reserve ${Math.round(e0)} → ${Math.round(other.energy)})`);
const asOurs = s.civ.log.filter((l) => l.text.includes(theirs.name) && l.kind !== 'info');
check(other.log.some((l) => l.kind === 'era') && asOurs.length === 0, `its record is its own: ours never tells of its settlement as ours${asOurs.length ? ` (“${asOurs[0].text}”)` : ''}`);
check(other.forecasts.length > 0 && other.forecasts !== s.civ.forecasts, `its forecasts its own (${other.forecasts.length})`);

// the crossing: one universe, a report each
const mine = s.civ.crossing!;
const its = other.crossing!;
const shared = /of the last red dwarfs went out|The last ordinary starlight is gone/;
check(!!mine && !!its && mine !== its && mine.from === 'dusk' && its.to === 'degenerate', 'each civilization has its own report of the Last Light');
check(mine.lines.some((l) => shared.test(l.text)) && its.lines.some((l) => shared.test(l.text)), 'the universe’s lines are in both');
check(mine.lines[0].text === its.lines[0].text && /^Preparation/.test(mine.lines[1].text) && /^Preparation/.test(its.lines[1].text), 'each in its place: the stars first, then each one’s own preparation');
const theirsNow = Object.values(s.colonies).filter((c) => c.owner === 'sv9');
const oursNow = colonies(s);
check(its.popsAfter === theirsNow.reduce((n, c) => n + popsOf(c) + c.cryo, 0) && its.coloniesAfter === theirsNow.length && mine.popsAfter === oursNow.reduce((n, c) => n + popsOf(c) + c.cryo, 0) && mine.coloniesAfter === oursNow.length, `its losses are its own: ${its.popsBefore} → ${its.popsAfter} of its people in ${its.coloniesAfter} settlements, against our ${mine.popsBefore} → ${mine.popsAfter} in ${mine.coloniesAfter}`);

// the swarms meet each civilization by its own rules: whose ship, whose charter, whose Record
{
  const g = newGame({ seed: 1000, survivors: 3, protonFate: 'stable' });
  g.swarms = {};
  g.turn = 5;
  const them = addCiv(g, 'sv9');
  g.civ.flags.first_swarm = 2;
  them.flags.first_swarm = 2;
  const settled = new Set(Object.values(g.colonies).map((c) => c.systemId));
  const at = Object.values(g.systems).find((x) => !x.gone && !x.special && !settled.has(x.id) && x.bodies.some((id) => g.bodies[id].kind !== 'deep'))!;
  g.swarms.hgx = { id: 'hgx', systemId: at.id, from: null, to: null, traveled: 0, distance: 0, size: 3, awake: true, tamed: false, appetite: 1 };
  const mine = newFleet(g, at.id, ['probe'], 'Our Lamp');
  const theirs = asCiv(g, 'sv9', () => newFleet(g, at.id, ['probe'], 'Their Lamp'));
  const hp = mine.ships[0].hp;
  const hunt = (setup: (h: GameState) => void) => {
    let ours = 0;
    let its = 0;
    let told = true;
    for (let i = 0; i < 200; i++) {
      const h = copyState(g);
      h.rng = 1000 + i * 7919;
      setup(h);
      swarmsHunt(h, (id) => asCiv(h, id, () => computeMods(h)));
      const hit = (id: string) => !h.fleets[id] || h.fleets[id].ships[0].hp < hp;
      if (hit(mine.id)) ours++;
      if (hit(theirs.id)) {
        its++;
        // they hear it, we do not
        if (!h.civs.sv9.log.some((l) => l.text.includes('Their Lamp')) || h.civs.us.log.some((l) => l.text.includes('Their Lamp'))) told = false;
      }
    }
    return { ours, its, told };
  };
  const plain = hunt(() => {});
  check(plain.ours > 60 && plain.its > 60 && plain.told, `a swarm goes for every civilization’s ships stopped at its star (ours ${plain.ours}, theirs ${plain.its} of 200), and each hears of its own in its own Record`);
  const communion = hunt((h) => h.civs.sv9.charters.push('communion_charter'));
  check(communion.its === 0 && communion.ours > 60, `under its Communion Charter the swarms take it for their own: its ship spared, ours not (${communion.its} and ${communion.ours})`);
  // a tamed swarm works for whoever tamed it
  const h = copyState(g);
  h.swarms.hgx.tamed = true;
  h.swarms.hgx.tamedBy = 'sv9';
  const m0 = h.civs.us.matter;
  const t0 = h.civs.sv9.matter;
  updateHunger(h, 40, (id) => asCiv(h, id, () => computeMods(h)));
  check(h.civs.sv9.matter > t0 && h.civs.us.matter === m0, `a tamed swarm works for whoever tamed it (+${(h.civs.sv9.matter - t0).toFixed(1)} matter to them, none to us)`);
}

// each its own Deep: where another holds a system's Deep, ours is built beside it
{
  const g = newGame({ seed: 1000, survivors: 3, protonFate: 'stable' });
  addCiv(g, 'sv9');
  const sys = Object.values(g.systems).find((x) => !x.gone && !x.special && x.bodies.some((id) => g.bodies[id].kind === 'deep') && !x.bodies.some((id) => g.bodies[id].colonyId))!;
  const theirDeep = deepFor(g, sys, 'sv9')!;
  const theirs = asCiv(g, 'sv9', () => createColony(g, theirDeep, { echoes: 3 }));
  const before = sys.bodies.length;
  const ours = deepFor(g, sys)!;
  check(deepFor(g, sys, 'sv9') === theirDeep && ours !== theirDeep && ours.kind === 'deep' && sys.bodies.length === before + 1 && !ours.colonyId, 'another holds the Deep: ours is a new one beside it, theirs stays theirs');
  const col = createColony(g, ours, { echoes: 2 });
  check(deepFor(g, sys) === ours && col.owner === 'us' && theirs.owner === 'sv9' && g.bodies[theirs.bodyId] === theirDeep, 'and from then on each finds its own');
}

// one whose game is over plays no more
other.outcome = { kind: 'defeat', ending: 'test', turn: s.turn, eta: s.eta };
const before = other.stats.pops.length;
endTurn(s);
check(turnOrder(s).join(' ') === 'us' && other.stats.pops.length === before, 'a civilization whose game is over plays no more');

done('CIV TURNS');
