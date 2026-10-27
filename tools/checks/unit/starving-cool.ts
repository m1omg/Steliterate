// A starving civilization (the new version, part 3-2): once its reserve would last fewer than five
// turns, the autoplayer cools Echoes into Coldminds, which cost a fraction as much, as many as it
// takes to pay its way, as far as its vaults have room; with the reserve in hand it does not. In
// the Dark Era, where nothing refills it, the reserve must last the age. And after matter, or in
// the Dark Era, with nothing coming in at any pace it takes the pace that drains the reserve
// least for the ground it covers, not whichever costs least a turn.
import { autoPlay } from '../../../src/game/auto';
import { runCrossing } from '../../../src/game/sim/crossing';
import { turnStep } from '../../../src/game/sim/flare';
import { createColony, deepFor } from '../../../src/game/sim/fleets';
import { colonies } from '../../../src/game/sim/util';
import { THREADS, type ThreadId } from '../../../src/game/types';
import { newGame } from '../../../src/game/newGame';
import { capacity } from '../../../src/game/sim/economy';
import { computeMods } from '../../../src/game/sim/mods';
import { project } from '../../../src/game/sim/projection';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

/** Our capital in the Degenerate Age with Echoes and Cold Vaults, its reserve `energy`, last turn's net `net`. */
function at(energy: number, net: number, vaults = 2): GameState {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
  s.era = 'degenerate';
  s.eta = 26;
  s.years = Math.pow(10, 26);
  s.civ.techs.push('mind_substrate', 'cold_computation');
  const c = s.colonies[s.civ.capitalId!];
  c.structures.substrate_core = 4;
  c.structures.cold_vault = vaults;
  c.pops.echoes = 14;
  c.pops.coldminds = 0;
  s.civ.energy = energy;
  s.civ.flags.last_energy_net = net;
  return s;
}
const cooled = (s: GameState) => s.colonies[s.civ.capitalId!].pops.coldminds;

/** What our minds there cost a turn, Echoes and Coldminds. */
const minds = (s: GameState) => project(s).perColony[s.civ.capitalId!].y.lines.filter((l) => /Echo|Coldmind/.test(l.label)).reduce((a, l) => a - (l.energy ?? 0), 0);

const calm = at(1000, -4);
autoPlay(calm, 'competent');
const short = at(10, -4);
const before = minds(short);
autoPlay(short, 'competent');
const saved = before - minds(short);
check(cooled(short) > cooled(calm), `with the reserve gone in under five turns, Echoes are cooled into Coldminds (${cooled(short)}; with the reserve in hand, ${cooled(calm)})`);
check(saved >= 4 && cooled(short) < 12, `as many as it takes to pay its way, not all it could (${cooled(short)} of room for 12: ${saved.toFixed(1)} a turn saved, 4 short)`);
const tight = at(10, -40, 1);
autoPlay(tight, 'competent');
const room = capacity(tight, tight.colonies[tight.civ.capitalId!], computeMods(tight)).coldminds;
check(cooled(tight) === room, `and no more than the vaults have room for (${cooled(tight)} of ${room})`);

// in the Dark Era nothing refills the reserve: it must last the age, not five turns
{
  const dark = (era: 'dark' | 'blackhole') => {
    const g = at(80, -10);
    if (era === 'dark') {
      g.era = 'dark';
      g.eta = 1e5;
      g.years = Infinity;
    } else {
      g.era = 'blackhole';
      g.eta = 60;
      g.years = Math.pow(10, 60);
    }
    autoPlay(g, 'competent');
    return cooled(g);
  };
  const bh = dark('blackhole');
  const dk = dark('dark');
  check(dk > bh, `with eight turns of reserve, in the Dark Era it cools Echoes to make it last the age (${dk}; in the Black Hole Age, with income still to come, ${bh})`);
}

// with nothing coming in: the pace that drains the reserve least for the ground it covers (a
// game of 13 Oct quickened twice on a full reserve after a burst, and when nothing came in at its
// hole any more, the next pace cost about as much a turn: it starved at turns a hundred times
// short for 110 turns, until its will failed)
{
  const pops = (p: Partial<Record<ThreadId, number>>) => Object.fromEntries(THREADS.map((t) => [t, p[t] ?? 0])) as Record<ThreadId, number>;
  const g = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
  g.era = 'degenerate';
  g.civ.techs.push('leptonic_computation', 'mind_substrate', 'cold_computation');
  for (const c of colonies(g)) {
    g.bodies[c.bodyId].colonyId = null;
    delete g.colonies[c.id];
  }
  const hole = Object.values(g.systems).find((x) => x.primary.kind === 'black_hole' && !x.gone)!;
  const v = createColony(g, deepFor(g, hole)!, {});
  v.pops = pops({ coldminds: 30 });
  v.structures = { lepton_substrate: 3, cold_vault: 4 };
  g.civ.capitalId = v.id;
  g.civ.energy = 400;
  runCrossing(g, [g.player], { [g.player]: computeMods(g) });
  // the Black Hole Age, its hole drained of spin, at turns a hundred times shorter than the Tide's
  g.eta = 45;
  g.years = Math.pow(10, 45);
  g.systems[v.systemId].primary.spin = 0;
  g.civ.energy = 30;
  g.civ.pace = 2;
  const net = (p: number) => {
    const pr = project(g, p);
    return pr.energyIn - pr.energyOut;
  };
  const drain = (p: number) => -net(p) / (turnStep(g, p).eta - g.eta);
  check(net(2) < 0 && Math.abs(net(1) - net(2)) < 0.5, `nothing comes in, and the next pace costs about as much a turn (${net(2).toFixed(1)}, ${net(1).toFixed(1)}): by the turn, nothing to choose`);
  const by = [2, 1, 0].map((p) => `${drain(p).toFixed(0)}`).join(', ');
  g.civ.flags.last_energy_net = net(2);
  autoPlay(g, 'competent');
  check(g.civ.pace < 2, `by the decade there is: it slows toward the Tide (pace ${g.civ.pace}; a decade costs ${by} at turns 100 and 10 times short, and the Tide's)`);
}
done('STARVING COOL');
