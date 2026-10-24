// The stable fate's late game (the new version, part 3-6):
// - about one white dwarf in 30 is born 1.16 to 1.35 M☉, by a hash (no draw taken: the galaxy is
//   otherwise as it was);
// - each such dwarf explodes when its date comes (Caplan 2020: 10^1100 years at 1.35, 10^1600 at
//   1.24, 10^32000 at 1.16; none lighter), matter stable only: its worlds blown away, whatever we
//   had there lost, Burst Catchers elsewhere banking a share by distance; once;
// - by 10^1500 years everything is iron: Fusion Plants make nothing, cannot be built, and a
//   Hearth with nothing local burns nothing;
// - between 10^(10^26) and 10^(10^76) years each system's matter tunnels into black holes at a
//   time of its own: what is of matter is lost, a leptonic settlement on a world goes on in the
//   Deep and banks its own system's flash; by 10^(10^76) no matter is left;
// - the Passage opens where matter is stable; the autoplayer begins it in the Dark Era in time.
import { autoPlay } from '../../../src/game/auto';
import { generateWorld } from '../../../src/game/gen';
import { DEFAULT_SETTINGS } from '../../../src/game/newGame';
import { newGame } from '../../../src/game/newGame';
import { structureCheck } from '../../../src/game/sim/actions';
import { BURST_CATCH, burstShare } from '../../../src/game/sim/crossing';
import {
  COLLAPSE_FROM,
  COLLAPSE_TO,
  HEAVY_MAX,
  HEAVY_MIN,
  IRON_ETA,
  collapseLambda,
  deepTime,
  hasMatter,
  heavyDwarfs,
  ironAge,
  supernovaEta,
  turnsToCollapse,
  willExplode,
} from '../../../src/game/sim/deeptime';
import { createColony } from '../../../src/game/sim/fleets';
import { passageCheck } from '../../../src/game/sim/passage';
import { project } from '../../../src/game/sim/projection';
import { handleNotes } from '../../../src/game/sim/turn';
import { colonies, distLy, formOf } from '../../../src/game/sim/util';
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import type { Colony, GameState, StarSystem, ThreadId } from '../../../src/game/types';
import { THREADS } from '../../../src/game/types';
import { check, done } from '../lib';

const pops = (p: Partial<Record<ThreadId, number>>) => Object.fromEntries(THREADS.map((t) => [t, p[t] ?? 0])) as Record<ThreadId, number>;
const near = (a: number, b: number, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(b));

// heavy dwarfs: about one in 30, 1.16 to 1.35, and nothing drawn
{
  let wds = 0;
  let heavy = 0;
  let inRange = true;
  let same = true;
  for (let i = 0; i < 40; i++) {
    const settings = { ...DEFAULT_SETTINGS, seed: 1000 + i * 7919, protonFate: 'stable' as const, civsAsleep: true };
    const a = generateWorld(settings);
    const b = generateWorld(settings);
    heavyDwarfs(b);
    if (a.rng !== b.rng) same = false;
    for (const id of Object.keys(a.systems)) {
      const pa = a.systems[id].primary;
      const pb = b.systems[id].primary;
      if (pa.kind !== 'white_dwarf') {
        if (pa.mass !== pb.mass) same = false;
        continue;
      }
      wds++;
      if (pb.mass !== pa.mass) {
        heavy++;
        if (pb.mass < HEAVY_MIN || pb.mass > HEAVY_MAX) inRange = false;
      }
    }
  }
  const share = heavy / wds;
  check(share > 1 / 60 && share < 1 / 15, `about one white dwarf in 30 is born heavy: ${heavy} of ${wds} in 40 galaxies (1 in ${Math.round(wds / Math.max(1, heavy))})`);
  check(inRange, `each ${HEAVY_MIN} to ${HEAVY_MAX} M☉`);
  check(same, 'no draw taken, and nothing else changed: the generator’s random state and every other star as before');
}

// the dates (Caplan 2020), the heaviest first, none lighter than 1.16
{
  check(near(supernovaEta(1.35), 1100, 1e-9) && near(supernovaEta(1.24), 1600, 1e-9) && near(supernovaEta(1.16), 32000, 1e-9), 'Caplan’s three: 10^1100 years at 1.35 M☉, 10^1600 at 1.24, 10^32000 at 1.16');
  check(supernovaEta(1.15) === Infinity && supernovaEta(0.9) === Infinity, 'a dwarf lighter than 1.16 never explodes');
  let falling = true;
  for (let m = 1.16; m < 1.35; m += 0.01) if (!(supernovaEta(m + 0.01) < supernovaEta(m))) falling = false;
  check(falling, 'the heavier, the sooner');
}

/** Matter stable, the Dark Era at η `eta`: our capital somewhere, the galaxy's white dwarfs black. */
function dark(eta: number): GameState {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable', civsAsleep: true });
  s.era = 'dark';
  s.eta = eta;
  s.years = eta < 300 ? Math.pow(10, eta) : Infinity;
  for (const x of Object.values(s.systems)) if (x.primary.kind === 'white_dwarf') x.primary.kind = 'black_dwarf';
  return s;
}
/** A settlement of ours on a world of this system (made one if need be). */
function settleAt(s: GameState, sys: StarSystem, form: Colony['form'] = 'baryonic'): Colony {
  const b = sys.bodies.map((id) => s.bodies[id]).find((x) => x && x.kind !== 'deep' && !x.colonyId && !x.rogue)!;
  const c = createColony(s, b, {});
  c.pops = pops({ echoes: 4, coldminds: 2 });
  c.form = form;
  return c;
}

// a black dwarf supernova
{
  const s = dark(1290);
  const systems = Object.values(s.systems).filter((x) => x.primary.kind === 'black_dwarf' && x.bodies.some((id) => s.bodies[id].kind !== 'deep' && !s.bodies[id].rogue) && !x.special);
  const dw = systems[0];
  dw.primary.mass = 1.3;
  const date = supernovaEta(1.3);
  const there = settleAt(s, dw);
  // a catcher elsewhere, the nearest system with a world to stand on
  const away = systems.filter((x) => x.id !== dw.id).sort((a, b) => distLy(dw, a) - distLy(dw, b))[0];
  const catcher = settleAt(s, away);
  catcher.structures = { burst_catcher: 2 };
  check(willExplode(dw.primary) && date > 1290 && date < 1310, `a black dwarf of 1.3 M☉ explodes at η ${date.toFixed(0)}`);
  const quiet = deepTime(s, 1290, date - 1);
  check(!quiet.length && !dw.primary.exploded, 'not before its date');
  const e0 = s.civ.energy;
  const notes = deepTime(s, date - 1, date + 1);
  check(notes.length === 1 && notes[0].kind === 'blackdwarf_sn' && notes[0].systemId === dw.id && !!dw.primary.exploded && dw.primary.mass <= 1.0, 'it explodes in the turn that passes its date: an iron-cored dwarf is left');
  check(dw.bodies.every((id) => s.bodies[id].kind === 'deep' || s.bodies[id].dissolved || s.bodies[id].rogue), 'its worlds are blown away');
  handleNotes(s, notes);
  check(!s.colonies[there.id], 'what we had there is lost');
  const want = burstShare(distLy(dw, away)) * 2;
  check(near(s.civ.energy - e0, want), `two Burst Catchers ${distLy(dw, away).toFixed(1)} ly away bank ${want} (+${Math.round(s.civ.energy - e0)})`);
  check(s.civ.pending.some((p) => p.defId === 'black_dwarf_supernova'), 'the first is an event');
  check(!deepTime(s, date + 1, date + 100).length, 'once');
  // not where protons decay
  const d = dark(1290);
  d.fate = 'decay';
  const dw2 = d.systems[dw.id];
  dw2.primary.mass = 1.3;
  check(!deepTime(d, date - 1, date + 1).length && !dw2.primary.exploded, 'where protons decay, none explodes (they decayed first)');
}

// iron
{
  const before = dark(1400);
  const after = dark(1600);
  check(!ironAge(before) && ironAge(after) && IRON_ETA === 1500, 'everything is iron from 10^1500 years');
  const de = dark(1600);
  de.fate = 'decay';
  check(!ironAge(de), 'only where matter is stable');
  const fusing = (s: GameState) => {
    const c = s.colonies[s.civ.capitalId!];
    s.civ.techs.push('fusion');
    // (nothing local to warm a Hearth: no core heat left, and its star long dead)
    s.bodies[c.bodyId].coreHeat = 0;
    Object.assign(s.systems[c.systemId].primary, { kind: 'black_dwarf', mass: 0.6, lum: 0 });
    c.structures.fusion_plant = 1;
    s.civ.matter = 500;
    const line = project(s).perColony[c.id].y.lines.find((l) => l.label.startsWith('Fusion Plant'));
    return { e: line?.energy ?? 0, label: line?.label ?? '', check: structureCheck(s, c, STRUCTURE_BY_ID.fusion_plant) };
  };
  const a = fusing(before);
  const b = fusing(after);
  check(a.e > 0 && b.e <= 0 && /nothing left to fuse/.test(b.label), `a Fusion Plant makes ${a.e.toFixed(1)} before, nothing after ("${b.label}")`);
  check(!!b.check && /iron/.test(b.check), `and cannot be built after: "${b.check}"`);
  const hearth = (s: GameState) => project(s).perColony[s.civ.capitalId!].y.lines.find((l) => l.label.startsWith('Hearth'));
  const hb = hearth(before);
  const ha = hearth(after);
  check(!!hb && !!ha && (ha.energy ?? 0) < (hb.energy ?? 0), `a Hearth with little local burns less once all is iron (${(hb?.energy ?? 0).toFixed(2)} → ${(ha?.energy ?? 0).toFixed(2)})`);
}

// tunnelling collapse
{
  const s = dark(Math.pow(10, 25.9));
  const lambdas = Object.values(s.systems).map(collapseLambda);
  check(lambdas.every((l) => l >= COLLAPSE_FROM && l <= COLLAPSE_TO) && Math.max(...lambdas) - Math.min(...lambdas) > 20, `each system its own time, between λ ${COLLAPSE_FROM} and ${COLLAPSE_TO} (spread ${Math.min(...lambdas).toFixed(1)} to ${Math.max(...lambdas).toFixed(1)})`);
  const withWorlds = Object.values(s.systems).filter((x) => hasMatter(s, x) && !x.special && x.bodies.filter((id) => s.bodies[id].kind !== 'deep' && !s.bodies[id].rogue).length >= 2);
  const sys = withWorlds[0];
  const ofMatter = settleAt(s, sys);
  const lept = settleAt(s, sys, 'leptonic');
  lept.structures = { burst_catcher: 1, lepton_substrate: 1 };
  const at = collapseLambda(sys);
  const e0 = s.civ.energy;
  check(!deepTime(s, Math.pow(10, 25.9), Math.pow(10, Math.min(at, 26) - 0.0001)).some((n) => n.systemId === sys.id), 'not before its time');
  const notes = deepTime(s, Math.pow(10, at - 0.01), Math.pow(10, at + 0.01));
  const mine = notes.find((n) => n.systemId === sys.id);
  check(!!mine && mine.kind === 'collapse' && sys.primary.kind === 'void' && !hasMatter(s, sys) && !sys.gone, 'its matter tunnels into black holes in the turn that passes its time; the system stays, something leptonic being there');
  handleNotes(s, notes);
  check(!s.colonies[ofMatter.id], 'what is of matter is lost');
  const still = colonies(s).find((c) => c.systemId === sys.id);
  check(!!still && formOf(still) === 'leptonic' && s.bodies[still.bodyId].kind === 'deep', `what made the Passage goes on, in the Deep (${still?.name})`);
  check(s.civ.energy - e0 >= BURST_CATCH, `its Burst Catcher banks its own system's flash (+${Math.round(s.civ.energy - e0)})`);
  check(s.civ.pending.some((p) => p.defId === 'tunnelling_collapse'), 'the first is an event');
  // a settlement of matter with decay-proof substrate goes on, as at the end of matter in the other
  // fates (the forecast says so): what was re-encoded, leptonic, in the Deep; its Kin, its sleepers
  // and what has no leptonic form lost
  {
    const t = dark(Math.pow(10, 25.9));
    const sys2 = Object.values(t.systems).filter((x) => hasMatter(t, x) && !x.special && x.id !== sys.id && x.bodies.filter((id) => t.bodies[id].kind !== 'deep' && !t.bodies[id].rogue && !t.bodies[id].colonyId).length >= 2)[0];
    for (const c of colonies(t)) if (c.systemId === sys2.id) delete t.colonies[c.id];
    const kept = settleAt(t, sys2);
    kept.pops = pops({ kin: 3, echoes: 3, coldminds: 2 });
    kept.cryo = 2;
    kept.structures = { lepton_substrate: 1, fusion_plant: 1 };
    const bare = settleAt(t, sys2);
    const at2 = collapseLambda(sys2);
    const n2 = deepTime(t, Math.pow(10, at2 - 0.01), Math.pow(10, at2 + 0.01));
    check(n2.some((n) => n.systemId === sys2.id && n.kind === 'collapse') && !sys2.gone, 'with minds on decay-proof substrate there, the system stays');
    handleNotes(t, n2);
    const on = t.colonies[kept.id];
    check(!t.colonies[bare.id], 'a settlement of matter with nothing decay-proof is lost');
    check(!!on && formOf(on) === 'leptonic' && t.bodies[on.bodyId].kind === 'deep' && on.pops.kin === 0 && on.cryo === 0 && on.pops.echoes === 3 && on.pops.coldminds === 2, `one with Leptonic Substrate goes on, leptonic, in the Deep: its Kin and sleepers lost, its minds kept (${on ? `${on.pops.echoes} Echoes, ${on.pops.coldminds} Coldminds` : 'gone'})`);
    check(!!on && (on.structures.lepton_substrate ?? 0) === 1 && !on.structures.fusion_plant, 'keeping its substrate, and nothing that has no leptonic form');
  }

  // and by 10^(10^76) nothing of matter is left anywhere
  deepTime(s, Math.pow(10, 25.9), Math.pow(10, COLLAPSE_TO + 0.01));
  check(Object.values(s.systems).every((x) => !hasMatter(s, x)) && s.flags.matter_gone !== undefined, 'by 10^(10^76) years no matter is left, and matter is gone');
}

// the Passage, where matter is stable: open, and the autoplayer makes it in time
{
  const s = dark(Math.pow(10, 20));
  const c = s.colonies[s.civ.capitalId!];
  s.civ.techs.push('leptonic_computation');
  s.civ.energy = 5000;
  check(passageCheck(s, c) === null, 'the Passage opens where matter is stable');
  const left = turnsToCollapse(s, 0);
  check(isFinite(left) && left > 0, `the collapse can begin in about ${left} turns at the Tide`);
  // a few turns before it, the autoplayer begins it
  c.last = { ...(c.last ?? ({} as NonNullable<Colony['last']>)), industry: 40 } as Colony['last'];
  const late = dark(Math.pow(10, 25.5));
  const lc = late.colonies[late.civ.capitalId!];
  late.civ.techs.push('leptonic_computation');
  late.civ.energy = 5000;
  lc.last = { ...(lc.last ?? ({} as NonNullable<Colony['last']>)), industry: 40 } as Colony['last'];
  autoPlay(late, 'competent');
  // (begun, or begun and rushed: a rush finishes it at once since 24 Oct)
  check(lc.queue.some((q) => q.kind === 'passage') || lc.form === 'leptonic', `with the collapse ${turnsToCollapse(late, late.civ.pace)} turns off, the autoplayer begins the Passage`);
  const early = dark(150);
  const ec = early.colonies[early.civ.capitalId!];
  early.civ.techs.push('leptonic_computation');
  early.civ.energy = 5000;
  ec.last = { ...(ec.last ?? ({} as NonNullable<Colony['last']>)), industry: 40 } as Colony['last'];
  autoPlay(early, 'competent');
  check(!ec.queue.some((q) => q.kind === 'passage'), `with it ${turnsToCollapse(early, early.civ.pace)} turns off, not yet`);
}

// the autoplayer once everything is iron: the Long Sleep where the reserve would not last the age
// and no Great Work would be done first
{
  const iron = (energy: number) => {
    const s = dark(1600);
    const c = s.colonies[s.civ.capitalId!];
    s.civ.techs.push('hibernation_protocols');
    s.bodies[c.bodyId].coreHeat = 0;
    Object.assign(s.systems[c.systemId].primary, { kind: 'black_dwarf', mass: 0.6, lum: 0 });
    c.pops = pops({ echoes: 2, coldminds: 4 });
    c.cryo = 0;
    c.structures = { mag_shield: 1, core_stimulator: 1, orbital_mirrors: 1, atmosphere_works: 1, preservation_array: 2, cold_vault: 1 };
    c.queue = [];
    s.civ.energy = energy;
    s.civ.matter = 0;
    s.civ.researching = null;
    s.civ.pending = [];
    return s;
  };
  const short = iron(60);
  autoPlay(short, 'competent');
  check(short.civ.dormant && short.civ.sleepTurns > 0, `a reserve that would not last the age: the Long Sleep (${short.civ.sleepTurns} turns)`);
  const plenty = iron(50000);
  autoPlay(plenty, 'competent');
  check(!plenty.civ.dormant, 'one that would: awake');
  const working = iron(60);
  working.civ.work = 'hibernal_cascade';
  working.civ.works.hibernal_cascade = 1490;
  working.civ.flags.last_insight = 40;
  autoPlay(working, 'competent');
  check(!working.civ.dormant, 'a Great Work done before the reserve runs out: awake for it');
  const before = iron(60);
  before.eta = 1400;
  before.years = Infinity;
  autoPlay(before, 'competent');
  check(!before.civ.dormant, 'before the iron: awake');
}

done('STABLE DARK');
