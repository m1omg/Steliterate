// Decoy beacons burn only while we feed them: 30 energy to light, then 3 a turn (scaled by the
// turn's lived share, as all upkeep is), and the HUD's projection counts it. Lighting one turns the
// nearest awake, untamed swarm within reach toward it (a sleeping, tamed or distant one stays).
// Short of energy, a beacon goes dark (energy never below zero); we can put one out; one at a star
// that is gone is gone with it. A beacon from an old save is fed like any other.
import { autoPlay } from '../../../src/game/auto';
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { placeBeacon, putOutBeacon } from '../../../src/game/sim/actions';
import { BEACON_COST, BEACON_UPKEEP, feedBeacons, litBeacons } from '../../../src/game/sim/beacons';
import { livedShare } from '../../../src/game/sim/flare';
import { project } from '../../../src/game/sim/projection';
import { swarmReach } from '../../../src/game/sim/hunger';
import { reserveCapacity } from '../../../src/game/sim/economy';
import { computeMods } from '../../../src/game/sim/mods';
import { distLy } from '../../../src/game/sim/util';
import type { GameState, StarSystem, Swarm } from '../../../src/game/types';
import { check, done } from '../lib';

const clone = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;
const base = (() => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' });
  for (let g = 0; g < 30 && !s.outcome; g++) {
    autoPlay(s, 'competent');
    endTurn(s);
  }
  s.pending.length = 0;
  if (!s.civ.techs.includes('hunger_lures')) s.civ.techs.push('hunger_lures');
  s.swarms = {};
  s.civ.energy = 100;
  return s;
})();
const settled = (s: GameState, id: string) => Object.values(s.colonies).some((c) => c.systemId === id);
/** A copy of the game with a fleet stationed at an empty star near our capital. */
const setup = () => {
  const s = clone(base);
  const cap = s.systems[s.colonies[s.civ.capitalId!].systemId];
  const sys = Object.values(s.systems)
    .filter((x) => !x.gone && !x.special && !settled(s, x.id))
    .sort((a, b) => distLy(a, cap) - distLy(b, cap))[0];
  const f = Object.values(s.fleets)[0];
  Object.assign(f, { at: sys.id, to: null, from: null, traveled: 0, distance: 0, order: 'idle' });
  return { s, sys, f };
};
let n = 0;
const swarm = (s: GameState, at: StarSystem, more: Partial<Swarm> = {}): Swarm => {
  const sw: Swarm = { id: `sw_t${n++}`, systemId: at.id, from: null, to: null, traveled: 0, distance: 0, size: 2, awake: true, tamed: false, appetite: 1, ...more };
  s.swarms[sw.id] = sw;
  return sw;
};
/** A star within the swarms' reach of `sys`, and one beyond it. */
const nearAndFar = (s: GameState, sys: StarSystem) => {
  const R = swarmReach(s);
  const others = Object.values(s.systems).filter((x) => x.id !== sys.id && !x.gone);
  return { near: others.find((x) => distLy(x, sys) <= R * 0.8)!, far: others.find((x) => distLy(x, sys) > R * 1.5)! };
};

// ---------------------------------------------------------------- lighting one
{
  const { s, sys, f } = setup();
  const t = clone(s);
  t.civ.techs = t.civ.techs.filter((x) => x !== 'hunger_lures');
  check(placeBeacon(t, f.id) === 'Research Decoy Beacons first.', 'Decoy Beacons must be researched');
  const { near, far } = nearAndFar(s, sys);
  const sw = swarm(s, near);
  check(placeBeacon(s, f.id) === null && s.civ.energy === 100 - BEACON_COST && sys.beacon === true, `lighting one costs ${BEACON_COST} energy`);
  check(sw.to === sys.id && sw.systemId === null, `the nearest awake swarm (at ${near.name}) turns toward it at once`);
  check(placeBeacon(s, f.id) === 'A beacon already burns here.', 'one beacon to a star');
  check(s.log.slice(-2).some((l) => /has turned toward it/.test(l.text)), `the Record says so: "${s.log[s.log.length - 1].text}"`);
  for (const [what, more, at] of [
    ['a sleeping swarm', { awake: false }, near],
    ['a tamed one', { tamed: true }, near],
    ['one out of reach', {}, far],
  ] as const) {
    const u = setup();
    const w = swarm(u.s, at, more);
    placeBeacon(u.s, u.f.id);
    check(w.systemId === at.id && w.to === null, `${what} stays where it is`);
  }
  const p = setup();
  const col = Object.values(p.s.colonies)[0];
  Object.assign(p.f, { at: col.systemId });
  check(placeBeacon(p.s, p.f.id) === 'Place beacons in empty systems, away from our people.', 'never where our people live');
}

// ---------------------------------------------------------------- feeding it
{
  const { s, sys } = setup();
  // as an old save would have it: just lit; and well below the reserve's cap, so a turn's income
  // is not cut off by it
  sys.beacon = true;
  s.civ.energy = Math.floor(reserveCapacity(s, computeMods(s)) * 0.4);
  const without = clone(s);
  delete without.systems[sys.id].beacon;
  const pf = livedShare(s);
  check(Math.abs(project(s).energyOut - project(without).energyOut - BEACON_UPKEEP * pf) < 1e-9, `the coming turn's projection counts it (${BEACON_UPKEEP} × ${pf})`);
  endTurn(s);
  endTurn(without);
  check(Math.abs(without.civ.energy - s.civ.energy - BEACON_UPKEEP * pf) < 1e-9 && s.systems[sys.id].beacon === true, `a turn costs ${BEACON_UPKEEP} energy to keep it burning (${without.civ.energy.toFixed(2)} without it, ${s.civ.energy.toFixed(2)} with it)`);
  // put out
  const left = clone(s);
  check(putOutBeacon(s, sys.id) === null && !s.systems[sys.id].beacon, 'we can put it out, at once');
  check(putOutBeacon(s, sys.id) === 'No beacon burns there.', 'and only once');
  const after = clone(s);
  endTurn(s);
  endTurn(after);
  check(s.civ.energy === after.civ.energy, 'after which it costs nothing');
  void left;
}

// ---------------------------------------------------------------- short of energy
{
  const { s, sys } = setup();
  const other = Object.values(s.systems).find((x) => x.id !== sys.id && !x.gone && !x.special && !settled(s, x.id))!;
  sys.beacon = true;
  other.beacon = true;
  s.civ.energy = BEACON_UPKEEP + 1;
  const paid = feedBeacons(s, 1);
  check(paid === BEACON_UPKEEP && s.civ.energy === 1 && litBeacons(s).length === 1, `with energy for one, one is fed and the other goes dark (${litBeacons(s).map((x) => x.name).join(', ')} still burns)`);
  check(s.log.some((l) => /could not feed the beacon/.test(l.text)), 'and the Record says so');
  feedBeacons(s, 1);
  check(litBeacons(s).length === 0 && s.civ.energy === 1, 'with less than a turn’s upkeep, the last goes dark too, and energy never drops below zero');
  const g = setup();
  g.sys.beacon = true;
  g.sys.gone = true;
  check(feedBeacons(g.s, 1) === 0 && !g.sys.beacon, 'a beacon at a star that is gone is gone with it');
}

done('BEACON');
