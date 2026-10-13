// Swarms go for ships stopped near them (the player's ask, 11 Oct: "swarm never really attacks my
// ship", when it sat at a star near one). An awake swarm of size 2 or more notices the nearest of
// our ships stopped within 25 ly, at a star where we have no settlement and no swarm sits, and on
// 30% of turns (15% under the Blackout) sends part of itself after it. The part strikes that ship
// wherever it finds it stopped, surely; once the ship is gone it goes back to its swarm and rejoins
// it (going on to our nearest settlement instead cost 18 to 30 of 300 harness games).
// And when a swarm breaks through a settlement, the ships there share its losses.
import { newGame } from '../../../src/game/newGame';
import { createColony } from '../../../src/game/sim/fleets';
import { HUNT_NOTICE, HUNT_REACH, swarmsHunt, updateHunger } from '../../../src/game/sim/hunger';
import { computeMods } from '../../../src/game/sim/mods';
import { colonies, distLy } from '../../../src/game/sim/util';
import type { Fleet, GameState, Swarm } from '../../../src/game/types';
import { check, done } from '../lib';
import { copyState } from '../../../src/game/save';

const L = 40;
const clone = (s: GameState) => copyState(s);

const base = (() => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' }) as GameState;
  s.swarms = {};
  s.turn = 5;
  s.civ.flags.first_swarm = 2;
  const settled = new Set(colonies(s).map((c) => c.systemId));
  const free = Object.values(s.systems).filter((x) => !x.gone && !x.special && !settled.has(x.id));
  // a star for the swarm, one near it for our ship, and one out of reach
  for (const a of free) {
    if (!a.bodies.some((id) => s.bodies[id].kind !== 'deep')) continue;
    const b = free.find((x) => x.id !== a.id && distLy(a, x) <= HUNT_REACH);
    const c = free.find((x) => distLy(a, x) > HUNT_REACH * 1.5);
    if (!b || !c) continue;
    // enough to eat that the swarm stays, as a rule (it moves on from a thin star)
    for (const id of a.bodies) if (s.bodies[id].kind !== 'deep') s.bodies[id].richness = Math.max(s.bodies[id].richness, 2);
    const sw: Swarm = { id: 'hgx', systemId: a.id, from: null, to: null, traveled: 0, distance: 0, size: 4, awake: true, tamed: false, appetite: 1 };
    s.swarms[sw.id] = sw;
    const f: Fleet = { id: 'fx', owner: 'us', name: 'Lamp', ships: [{ cls: 'ark', hp: 6 }], at: b.id, from: null, to: null, traveled: 0, distance: 0, order: 'hold' } as Fleet;
    s.fleets = { [f.id]: f };
    return { s, a: a.id, b: b.id, c: c.id };
  }
  throw new Error('no stars to test with');
})();

/** Over many draws, how often the swarm sends a part after our ship. */
const rate = (tweak: (s: GameState) => void, n = 1000) => {
  let sent = 0;
  for (let i = 0; i < n; i++) {
    const s = clone(base.s);
    s.rng = 1000 + i * 7919;
    tweak(s);
    const after = () => Object.values(s.swarms).filter((w) => w.prey === 'fx').length;
    const was = after();
    updateHunger(s, L, computeMods(s));
    if (after() > was) sent++;
  }
  return sent / n;
};

// noticed, about as often as the rule says
{
  const r = rate(() => {});
  check(Math.abs(r - HUNT_NOTICE) < 0.07, `a ship ${distLy(base.s.systems[base.a], base.s.systems[base.b]).toFixed(1)} ly from an awake swarm: a part is sent after it on ${Math.round(r * 100)}% of turns (the rule: ${HUNT_NOTICE * 100}%)`);
  const rb = rate((s) => s.civ.charters.push('blackout'));
  check(Math.abs(rb - HUNT_NOTICE / 2) < 0.06, `under the Blackout, half as often (${Math.round(rb * 100)}%)`);
}

// what is sent, and what is said
{
  let s: GameState | null = null;
  for (let i = 0; i < 50 && !s; i++) {
    const t = clone(base.s);
    t.rng = 1000 + i * 7919;
    updateHunger(t, L, computeMods(t));
    if (Object.values(t.swarms).some((w) => w.prey)) s = t;
  }
  const part = s && Object.values(s.swarms).find((w) => w.prey === 'fx');
  const nest = s?.swarms.hgx;
  check(!!part && part.to === base.b && part.from === base.a && !part.systemId && part.awake && part.size >= 1 && part.size <= 1.6, `the part (size ${part?.size.toFixed(2)}) sets off from the swarm's star for the ship's`);
  check(!!nest && !!part && nest.size + part.size <= 4.4 + 1e-9 && nest.size < 4, `and the swarm is smaller by it (${nest?.size.toFixed(2)} left)`);
  const said = s?.civ.log.find((e) => e.fleet === 'fx');
  check(!!said && said.kind === 'bad' && said.systemId === base.b && /coming for Lamp/.test(said.text), `we are told, naming the ship: "${said?.text}"`);
}

// when not
{
  const never = (what: string, tweak: (s: GameState) => void) => {
    const r = rate(tweak, 100);
    check(r === 0, `${what}: never (${Math.round(r * 100)}%)`);
  };
  never('a swarm asleep', (s) => (s.swarms.hgx.awake = false));
  never('a swarm too small to spare a part (1.5)', (s) => (s.swarms.hgx.size = 1.5));
  never('under the Communion Charter', (s) => s.civ.charters.push('communion_charter'));
  never('before the first swarm', (s) => delete s.civ.flags.first_swarm);
  never('on the first swarm’s own turn', (s) => (s.civ.flags.first_swarm = s.turn));
  never('a ship out of reach', (s) => (s.fleets.fx.at = base.c));
  never('a ship under way', (s) => Object.assign(s.fleets.fx, { at: null, from: base.b, to: base.c, distance: 30 }));
  never('a ship at a star we have settled', (s) => createColony(s, s.bodies[s.systems[base.b].bodies[0]], { echoes: 1 }));
  never('a ship at a star where a swarm sits (that one goes for it there)', (s) => {
    s.swarms.hgy = { ...s.swarms.hgx, id: 'hgy', systemId: base.b, awake: false, size: 1 };
  });
  never('a ship a part is already after', (s) => {
    s.swarms.hgz = { ...s.swarms.hgx, id: 'hgz', systemId: null, from: base.a, to: base.b, distance: 10, size: 1, prey: 'fx' };
  });
}

/** A part sent after our ship, on its way and about to arrive. */
const hunting = () => {
  const s = clone(base.s);
  const d = distLy(s.systems[base.a], s.systems[base.b]);
  s.swarms.hgx.size = 1.5; // too small to send another
  s.swarms.hunt = { id: 'hunt', systemId: null, from: base.a, to: base.b, traveled: d - 0.01, distance: d, size: 1.6, awake: true, tamed: false, appetite: 1, prey: 'fx', nest: 'hgx' };
  return s;
};
// it arrives: the ship is there, and it strikes surely
{
  const s = hunting();
  updateHunger(s, L, computeMods(s));
  check(s.swarms.hunt?.systemId === base.b && s.swarms.hunt.prey === 'fx', 'it arrives where the ship waits, and stays for it');
  let struck = 0;
  for (let i = 0; i < 100; i++) {
    const t = clone(s);
    t.rng = 1000 + i * 7919;
    swarmsHunt(t, computeMods(t));
    if (t.civ.log.some((e) => e.fleet === 'fx' && e.kind === 'combat')) struck++;
  }
  check(struck === 100, `there it strikes that ship every time (${struck} of 100), where a swarm feeding there strikes on 70% of turns`);
  // thin pickings do not move it on while the ship is there
  for (const id of s.systems[base.b].bodies) Object.assign(s.bodies[id], { richness: 0, hydrogen: 0 });
  let stayed = 0;
  for (let i = 0; i < 50; i++) {
    const t = clone(s);
    t.rng = 1000 + i * 7919;
    updateHunger(t, L, computeMods(t));
    if (t.swarms.hunt?.systemId === base.b) stayed++;
  }
  check(stayed === 50, `nothing to eat there, it still waits for the ship (${stayed} of 50)`);
}

// the ship moved on: the part turns back for its swarm
{
  const s = hunting();
  Object.assign(s.fleets.fx, { at: null, from: base.b, to: base.c, distance: 30 });
  updateHunger(s, L, computeMods(s));
  const w = s.swarms.hunt;
  const nest = s.swarms.hgx;
  check(!!w && !w.prey && !w.systemId && w.from === base.b && w.to === (nest.systemId ?? nest.to) && w.nest === 'hgx', `arriving to find the ship gone, it turns back for the swarm it broke away from (${nest.systemId ? 'where it sits' : 'where it is going'})`);
  const said = s.civ.log.find((e) => e.fleet === 'fx');
  check(!!said && said.kind === 'info' && /found it gone, and is going back to its swarm/.test(said.text), `and we are told: "${said?.text}"`);
}

// the ship is lost while it waits: back too, and we hear it had it
{
  const s = hunting();
  updateHunger(s, L, computeMods(s));
  delete s.fleets.fx;
  updateHunger(s, L, computeMods(s));
  const w = s.swarms.hunt;
  check(!!w && !w.prey && w.to === (s.swarms.hgx.systemId ?? s.swarms.hgx.to), 'its ship lost, it goes back to its swarm');
  check(s.civ.log.some((e) => /has had it, and is going back/.test(e.text) && !e.fleet), 'and we are told (with no ship to look at)');
}

// back with its swarm, it rejoins it; if the swarm has moved on, it follows; no random draw taken
{
  const back = (seed: number) => {
    const s = hunting();
    s.rng = seed;
    const d = distLy(s.systems[base.a], s.systems[base.b]);
    Object.assign(s.swarms.hunt, { from: base.b, to: base.a, traveled: d - 0.01, distance: d });
    delete s.swarms.hunt.prey;
    const without = clone(s);
    delete without.swarms.hunt;
    updateHunger(s, L, computeMods(s));
    updateHunger(without, L, computeMods(without));
    return { s, without };
  };
  // a turn its swarm stays, and one it moves on
  let stay: ReturnType<typeof back> | null = null;
  let moved: ReturnType<typeof back> | null = null;
  for (let i = 0; i < 200 && (!stay || !moved); i++) {
    const r = back(1000 + i * 7919);
    if (r.without.swarms.hgx.systemId === base.a) stay ??= r;
    else moved ??= r;
  }
  check(!!stay && !stay.s.swarms.hunt && Math.abs(stay.s.swarms.hgx.size - stay.without.swarms.hgx.size - 1.6) < 1e-9 && stay.s.rng === stay.without.rng, `it rejoins its swarm, larger by it (${stay?.without.swarms.hgx.size.toFixed(2)} → ${stay?.s.swarms.hgx.size.toFixed(2)}), and every draw is as without it`);
  const w = moved?.s.swarms.hunt;
  check(!!moved && !!w && w.from === base.a && w.to === moved.s.swarms.hgx.to && w.nest === 'hgx' && moved.s.rng === moved.without.rng, 'its swarm moved on: it follows it there');
}

// its swarm gone: a swarm of its own, which feeds and moves on as any swarm does
{
  const s = hunting();
  updateHunger(s, L, computeMods(s));
  delete s.fleets.fx;
  delete s.swarms.hgx;
  updateHunger(s, L, computeMods(s));
  const w = s.swarms.hunt;
  check(!!w && !w.prey && !w.nest, `with its swarm gone, it is a swarm of its own (${w?.systemId ? 'feeding where it was' : 'moving on, as any swarm from a thin star'})`);
}

// a swarm that breaks through a settlement hurts the ships there too
{
  let hurt = 0;
  let lost = 0;
  let worst = Infinity;
  let least = 0;
  let fits = 0;
  for (let i = 0; i < 40; i++) {
    const s = clone(base.s);
    s.rng = 1000 + i * 7919;
    createColony(s, s.bodies[s.systems[base.b].bodies[0]], { echoes: 1 });
    Object.assign(s.swarms.hgx, { systemId: base.b, size: 6 });
    s.fleets.gx = { ...s.fleets.fx, id: 'gx', name: 'Ember', ships: [{ cls: 'ark', hp: 0.5 }] };
    updateHunger(s, L, computeMods(s));
    const hp = s.fleets.fx?.ships[0]?.hp ?? 0;
    // its size when it struck: what it grew to, less the half it gains by breaking through
    const size = s.swarms.hgx.size - 0.5;
    if (hp < 6) hurt++;
    if (6 - hp >= 0.2 * size - 1e-9 && 6 - hp <= 0.6 * size + 1e-9) fits++;
    worst = Math.min(worst, hp);
    least = Math.max(least, hp);
    if (!s.fleets.gx && s.civ.log.some((e) => e.fleet === 'gx' && /was lost in the fighting/.test(e.text))) lost++;
  }
  check(hurt === 40 && fits === 40, `a swarm of about 6 breaking through: the ships there are hurt every time, by 0.2 to 0.6 of its size (hull 6 → ${worst.toFixed(1)} to ${least.toFixed(1)})`);
  check(lost === 40, `one that cannot take it is lost, and we are told (${lost} of 40)`);
}

done('HUNT');
