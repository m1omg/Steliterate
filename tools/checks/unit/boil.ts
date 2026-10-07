// Worlds boil away near helium stars; a helium giant swallows what orbits inside it.
import { GIANT_RADIUS_AU, bodyClimate, boilingAway } from '../../../src/game/physics';
import { newGame } from '../../../src/game/newGame';
import { autoPlay } from '../../../src/game/auto';
import { endTurn } from '../../../src/game/sim/turn';
import { canSettle, createColony } from '../../../src/game/sim/fleets';
import type { Body, GameState, StarSystem } from '../../../src/game/types';
import { updateForecasts } from '../../../src/game/sim/forecast';
import { EVENT_BY_ID } from '../../../src/game/data/events';
import { check, done } from '../lib';


const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
let guard = 0;
while (!s.outcome && guard++ < 700 && !(s.era === 'degenerate' && s.eta >= 17.3)) {
  autoPlay(s, 'competent');
  endTurn(s);
}
s.pending.length = 0;
console.log(`era ${s.era}, η ${s.eta.toFixed(2)}, turn ${s.turn}`);

/** Make a test world in a system: a copy of any world, with the kind and orbit given. */
let n = 0;
function world(sys: StarSystem, kind: Body['kind'], a: number, locked = false): Body {
  const proto = Object.values(s.bodies).find((b) => b.kind === 'barren')!;
  const b: Body = JSON.parse(JSON.stringify(proto));
  b.id = `t${n++}`;
  b.systemId = sys.id;
  b.name = `${sys.name} ${kind} ${a}`;
  b.kind = kind;
  b.orbitAU = a;
  b.colonyId = null;
  b.dissolved = false;
  b.rogue = false;
  b.feeding = undefined;
  b.relic = undefined;
  b.vitality = 0;
  b.coreHeat = 0;
  b.inspiralAt = undefined;
  b.traits = locked ? ['tidally_locked'] : [];
  s.bodies[b.id] = b;
  sys.bodies.push(b.id);
  return b;
}

/** A dead white dwarf system nobody lives in, its own worlds cleared away, lit as `kind`. */
function testStar(kind: 'helium_star' | 'helium_giant', not: string[]): StarSystem {
  const sys = Object.values(s.systems).find((x) => !x.gone && !not.includes(x.id) && (x.primary.kind === 'white_dwarf' || x.primary.kind === 'black_dwarf') && !Object.values(s.colonies).some((c) => c.systemId === x.id))!;
  for (const id of sys.bodies) if (s.bodies[id].kind !== 'deep') s.bodies[id].dissolved = true;
  sys.primary.kind = kind;
  sys.primary.mass = 0.7;
  sys.primary.bornAt = s.years;
  sys.primary.diesAt = s.years + 1e30; // burns right through the coming turn
  s.civ.known[sys.id] = 2;
  return sys;
}

// ---------------------------------------------------------------- under a helium star (30 L☉)
const he = testStar('helium_star', []);
he.ejected = true; // outside the galaxy: no close passes fling its test worlds away first
const deep = s.bodies[he.bodies.find((id) => s.bodies[id].kind === 'deep')!];
const molten = world(he, 'barren', 0.023, true); // 471 to 5,494 K
const rubble = world(he, 'asteroids', 0.1225); // mean about 1,700 K
const cooler = world(he, 'asteroids', 0.1574); // mean about 1,500 K
const hotGiant = world(he, 'gas_giant', 0.02);
const lava = world(he, 'barren', 0.15); // about 1,540 K: a lava world, not boiled
const ocean = world(he, 'ocean_ice', 2.0);
const t = (b: Body) => { const c = bodyClimate(s, b); return c.day !== undefined ? `${c.night!.toFixed(0)}–${c.day.toFixed(0)} K` : `${c.mean.toFixed(0)} K`; };
for (const b of [molten, rubble, cooler, hotGiant, lava, ocean]) console.log(`  ${b.name}: ${t(b)} → ${boilingAway(s, b) ?? 'stays'}`);
check(boilingAway(s, molten) === 'boils', 'a locked rock at 0.023 AU (day past 3,000 K) boils');
check(boilingAway(s, rubble) === 'boils', 'rubble at a mean of 1,700 K boils');
check(boilingAway(s, cooler) === null, 'rubble at 1,500 K stays');
check(boilingAway(s, hotGiant) === null, 'a gas giant at 0.02 AU is spared');
check(boilingAway(s, lava) === null, 'a lava world at 0.15 AU stays');
check(boilingAway(s, ocean) === null && boilingAway(s, deep) === null, 'a steaming ocean and the Deep stay');
// our settlement there: refused for newcomers, evacuated when it goes
const col = createColony(s, molten, { echoes: 8, lattice: 4 });
col.cryo = 4;
check(!!canSettle(s, rubble, 'echoes'), `settling a doomed world is refused: "${canSettle(s, rubble, 'echoes')}"`);
check(!canSettle(s, lava, 'echoes'), 'settling the lava world is allowed');

// ---------------------------------------------------------------- under a helium giant (1,000 L☉)
const gi = testStar('helium_giant', [he.id]);
gi.ejected = true; // outside the galaxy: no close passes fling its test worlds away first
const inside = world(gi, 'gas_giant', 0.1);
const edge = world(gi, 'barren', GIANT_RADIUS_AU * 1.05);
const rubbleG17 = world(gi, 'asteroids', 0.7075); // mean about 1,700 K: stays under a giant
const rubbleG19 = world(gi, 'asteroids', 0.5664); // about 1,900 K: goes
for (const b of [inside, edge, rubbleG17, rubbleG19]) console.log(`  ${b.name}: ${t(b)} → ${boilingAway(s, b) ?? 'stays'}`);
check(boilingAway(s, inside) === 'swallowed', 'a gas giant at 0.1 AU, inside the giant, is swallowed');
check(boilingAway(s, edge) === null, 'a rock just outside the giant stays (a lava world)');
check(boilingAway(s, rubbleG17) === null && boilingAway(s, rubbleG19) === 'boils', 'under a giant, rubble goes from 1,800 K');

// ---------------------------------------------------------------- warnings before it happens
updateForecasts(s);
const fc = s.forecasts.find((f) => f.kind === 'boil' && f.bodyId === molten.id);
check(!!fc && fc.severity === 'danger', `a forecast warns: "${fc?.title}"`);
const wf = String((EVENT_BY_ID.white_fire.text as (s: GameState, d: Record<string, string | number>) => string)(s, { systemId: he.id }));
check(wf.includes(molten.name) && wf.includes(rubble.name) && !wf.includes(lava.name) && /Deep/.test(wf), 'White Fire names the worlds it will boil, and that our people there can get off');
console.log(`  White Fire: ${wf}`);

// ---------------------------------------------------------------- the turn ends
const turnBefore = s.turn;
const lastLog = s.log[s.log.length - 1];
const popsBefore = { echoes: col.pops.echoes, lattice: col.pops.lattice, cryo: col.cryo };
endTurn(s);
const news = s.log.slice(s.log.indexOf(lastLog) + 1).map((l) => l.text);
for (const b of [molten, rubble, inside, rubbleG19]) if (!b.dissolved) console.log(`  still there: ${b.name} (${s.systems[b.systemId].primary.kind}, gone ${!!s.systems[b.systemId].gone}, rogue ${!!b.rogue}, feeding ${!!b.feeding})`);
check(!!(molten.dissolved && rubble.dissolved && inside.dissolved && rubbleG19.dissolved), 'the doomed worlds are gone after the turn');
check(!cooler.dissolved && !hotGiant.dissolved && !lava.dissolved && !ocean.dissolved && !deep.dissolved && !edge.dissolved && !rubbleG17.dissolved, 'every other world is still there');
check(!s.colonies[col.id], 'our settlement on the boiled world is gone');
const host = deep.colonyId ? s.colonies[deep.colonyId] : undefined;
console.log(`  the Deep: ${host ? `echoes ${host.pops.echoes}, lattice ${host.pops.lattice}, cryo ${host.cryo}` : 'nobody'} (from ${JSON.stringify(popsBefore)})`);
const escaped = news.map((x) => x.match(/^(\d+) of (.+?)’s people escaped to the Deep/)).find((m) => m && m[2] === col.name);
const got = Number(escaped?.[1] ?? 0);
check(!!host && got >= 6 && got <= 12, `three in four of its people got off to the Deep (${got}; at most 12 of ${JSON.stringify(popsBefore)})`);
void turnBefore;
const said = (re: RegExp) => news.some((x) => re.test(x));
check(said(/boiled away in the heat of the new star/), 'the Record says a world boiled away');
check(said(/swallowed by the swelling giant/), 'the Record says a world was swallowed');
check(said(/escaped to the Deep/), 'the Record says people escaped to the Deep');
for (const x of news.filter((x) => /boiled|swallowed|escaped|lost|destroyed/.test(x))) console.log(`  Record: ${x}`);
check(canSettle(s, molten, 'echoes') === 'Nothing is left of it.', 'a boiled world cannot be settled');

done('BOIL');
