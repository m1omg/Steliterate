// Ships see the stars they pass (part 1b). A ship under way sees, with the eyes it has stopped,
// every star near the stretch it flew this turn: one just inside its reach is seen, one just
// outside is not, nor an outlier of the void; a survey ship sees three times as far. Seen is only
// seen: charting still needs a stop, and nothing is found there. A survey ship under way at the
// edge of what is known takes one long-baseline look a turn and picks out the three nearest stars
// no one has seen; a warship under way takes none.
import { newGame } from '../../../src/game/newGame';
import { advanceFleets, newFleet, orderMove, updateDetection, type Flown } from '../../../src/game/sim/fleets';
import { computeMods } from '../../../src/game/sim/mods';
import { fleets } from '../../../src/game/sim/util';
import type { GameState, StarSystem, Vec3 } from '../../../src/game/types';
import { check, done } from '../lib';

const dist = (p: Vec3, q: Vec3) => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);

function setUp() {
  const s = newGame({ seed: 1000 });
  s.civ.pending.length = 0;
  s.civ.energy = 1e6;
  const probe = fleets(s).find((f) => f.at && f.ships.some((x) => x.cls === 'probe'))!;
  const home = s.systems[probe.at!];
  // somewhere far to fly to, charted (so it is no reason to look elsewhere first)
  const far = Object.values(s.systems).find((x) => !x.gone && !x.special && dist(x.phys, home.phys) > 4000 && dist(x.phys, home.phys) < 20000)!;
  s.civ.known[far.id] = 2;
  return { s, home, far, probe };
}

/** Three stars moved beside the way, 30% along it: inside the reach, outside it, and an outlier inside. */
function besideTheWay(s: GameState, home: StarSystem, far: StarSystem, reach: number) {
  const a = home.phys,
    b = far.phys;
  const d = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const len = Math.hypot(d.x, d.y, d.z);
  // a direction square to the way
  let u = { x: -d.y, y: d.x, z: 0 };
  if (Math.hypot(u.x, u.y) < 1e-6) u = { x: 0, y: -d.z, z: d.y };
  const ul = Math.hypot(u.x, u.y, u.z);
  const at = (k: number) => ({ x: a.x + d.x * 0.3 + (u.x / ul) * reach * k, y: a.y + d.y * 0.3 + (u.y / ul) * reach * k, z: a.z + d.z * 0.3 + (u.z / ul) * reach * k });
  const others = Object.values(s.systems).filter((x) => x.id !== home.id && x.id !== far.id && !x.gone && !x.special && x.bodies.length > 0);
  const [inside, outside, outlier] = others.slice(-3);
  inside.phys = at(0.9);
  outside.phys = at(1.1);
  outlier.phys = at(0.5);
  outlier.special = 'outlier';
  for (const x of [inside, outside, outlier]) delete s.civ.known[x.id];
  return { inside, outside, outlier, len };
}

// a warship under way: the stretch it flew, with a Warden's eyes
{
  const { s, home, far } = setUp();
  const mods = computeMods(s);
  const w = newFleet(s, home.id, ['warden']);
  const reach = mods.detect;
  const { inside, outside, outlier, len } = besideTheWay(s, home, far, reach);
  check(orderMove(s, w.id, far.id) === null, 'a Warden sets out');
  const charted = () => Object.values(s.civ.known).filter((v) => v === 2).length;
  const before = charted();
  const pending = s.civ.pending.length;
  const flown = advanceFleets(s, (0.5 * len) / mods.speed, mods).filter((x) => x.f.id === w.id);
  check(flown.length === 1 && !w.at, `halfway, still under way (${w.traveled.toFixed(0)} of ${w.distance.toFixed(0)} ly)`);
  updateDetection(s, mods, flown);
  check(s.civ.known[inside.id] === 1, `a star ${(0.9 * reach).toFixed(0)} ly from the way is seen (its reach ${reach} ly)`);
  check(!s.civ.known[outside.id], `one ${(1.1 * reach).toFixed(0)} ly from it is not`);
  check(!s.civ.known[outlier.id], 'nor an outlier of the void, close as it is');
  check(charted() === before && s.civ.pending.length === pending, 'seen is only seen: nothing charted, nothing found');
  check(s.civ.log.some((l) => /Under way, our ships pick out a star/.test(l.text)), 'and one message says so');
}

// a survey ship sees three times as far under way, as stopped
{
  const { s, home, far, probe } = setUp();
  const mods = computeMods(s);
  const reach = mods.detect * 3;
  // (the stars beside the way as for a Warden: well inside a probe's reach)
  const { inside, outside, len } = besideTheWay(s, home, far, mods.detect);
  check(orderMove(s, probe.id, far.id) === null, 'a probe sets out');
  const flown = advanceFleets(s, (0.5 * len) / mods.speed, mods).filter((x) => x.f.id === probe.id);
  updateDetection(s, mods, flown);
  check(s.civ.known[inside.id] === 1 && s.civ.known[outside.id] === 1, `a probe sees both (its reach ${reach} ly)`);
}

// the long-baseline look under way: beyond the edge of everything, a probe picks out the three
// nearest stars no one has seen; a Warden there picks out none
{
  for (const kind of ['probe', 'warden'] as const) {
    const { s, home, far, probe } = setUp();
    const mods = computeMods(s);
    const f = kind === 'probe' ? probe : newFleet(s, home.id, ['warden']);
    orderMove(s, f.id, far.id);
    const xs = Object.values(s.systems).map((x) => x.phys.x);
    const out = { x: Math.max(...xs) + 3000, y: home.phys.y, z: home.phys.z };
    const unseen = () => Object.values(s.systems).filter((x) => !s.civ.known[x.id] && !x.gone && x.special !== 'outlier');
    const nearest = unseen()
      .sort((p, q) => dist(p.phys, out) - dist(q.phys, out))
      .slice(0, 3)
      .map((x) => x.id);
    const n0 = unseen().length;
    const flown: Flown[] = [{ f, a: out, b: out }];
    updateDetection(s, mods, flown);
    const picked = n0 - unseen().length;
    if (kind === 'probe') {
      check(picked === 3 && nearest.every((id) => s.civ.known[id] === 1), `a probe under way picks out the three nearest unseen stars (${picked})`);
    } else check(picked === 0, `a Warden under way takes no long look (${picked})`);
  }
}
done('EN ROUTE');
