// The Thinning (the new version, part 3-3): the last decades of ordinary matter.
// - None of it before: if protons decay, from η 37.5 (matter dissolving in earnest) to the Great
//   Decay at η 39; under curvature radiation from η 87 (the brown dwarfs gone, the worlds
//   evaporating) to the Great Evaporation at η 89.5; never if matter is stable.
// - Meanwhile each structure still made of matter fails with the chance that keeps the share
//   standing at the share of matter left, and the Record names what went; decay-proof structures
//   do not fail, nor anything at a settlement that made the Passage.
// - What mines and skimmers bring in falls with the matter left.
// - A system dissolving before the Great Decay: what was re-encoded there goes on as leptonic at
//   once and drifts to the nearest black hole with spin left, its losses counted once for the
//   report; what made the Passage drifts whole; it joins a vault of ours there only of its own form.
// - The forecasts name what of ours is still made of matter.
import { asCiv } from '../../../src/game/civs';
import { newGame } from '../../../src/game/newGame';
import { colonyTurn } from '../../../src/game/sim/economy';
import { createColony } from '../../../src/game/sim/fleets';
import { updateForecasts } from '../../../src/game/sim/forecast';
import { computeMods } from '../../../src/game/sim/mods';
import { theThinning, thinShare } from '../../../src/game/sim/thinning';
import { handleNotes } from '../../../src/game/sim/turn';
import { colonies, formOf } from '../../../src/game/sim/util';
import type { Colony, GameState, ThreadId } from '../../../src/game/types';
import { THREADS } from '../../../src/game/types';
import { check, done } from '../lib';

const pops = (p: Partial<Record<ThreadId, number>>) => Object.fromEntries(THREADS.map((t) => [t, p[t] ?? 0])) as Record<ThreadId, number>;
const said = (s: GameState, re: RegExp) => s.civ.log.some((l) => re.test(l.text));
const at = (s: GameState, eta: number) => {
  s.eta = eta;
  s.years = Math.pow(10, eta);
};
/** A game of this fate in the Degenerate Age, our own settlements gone. */
function game(protonFate: 'decays' | 'stable' | 'curvature'): GameState {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate, civsAsleep: true });
  s.era = 'degenerate';
  s.civ.techs.push('leptonic_computation', 'penrose_process', 'mind_substrate');
  for (const c of colonies(s)) {
    s.bodies[c.bodyId].colonyId = null;
    delete s.colonies[c.id];
  }
  s.civ.energy = 1000;
  return s;
}
/** A settlement on a free world at a star (not a black hole). */
function town(s: GameState, not: string[] = []): Colony {
  const b = Object.values(s.bodies).find((x) => x.kind !== 'deep' && !x.colonyId && !not.includes(x.systemId) && !['black_hole', 'smbh'].includes(s.systems[x.systemId].primary.kind))!;
  return createColony(s, b, {});
}

// when
{
  const d = game('decays');
  const c = game('curvature');
  const st = game('stable');
  check(thinShare(d, 37.4) === 0 && Math.abs(thinShare(d, 38) - 1 / 3) < 1e-9 && thinShare(d, 39) === 1, `decay: none before η 37.5, a third gone at η 38, all of it at η 39 (${thinShare(d, 38).toFixed(3)})`);
  check(thinShare(c, 86.9) === 0 && Math.abs(thinShare(c, 88) - 0.4) < 1e-9 && thinShare(c, 89.5) === 1, `curvature: none before η 87, two fifths gone at η 88, all at η 89.5 (${thinShare(c, 88).toFixed(3)})`);
  check(thinShare(st, 38) === 0 && thinShare(st, 89) === 0, 'stable matter does not thin');
}

// structures of matter fail with the share of matter left; decay-proof ones and a passed settlement's do not
{
  const s = game('decays');
  at(s, 37.5);
  const a = town(s);
  a.pops = pops({ kin: 2 });
  a.structures = { mine: 300, lepton_substrate: 2 };
  const p = town(s, [a.systemId]);
  p.pops = pops({ echoes: 2 });
  p.form = 'leptonic';
  p.structures = { reserve_vault: 40, substrate_core: 20 };
  s.civ.capitalId = a.id;
  theThinning(s, 37.5, 38);
  const left = a.structures.mine ?? 0;
  check(left > 170 && left < 230, `from η 37.5 to 38, a third of the matter gone: of 300 mines ${left} stand (about 200)`);
  check(a.structures.lepton_substrate === 2, 'the Leptonic Substrate does not fail');
  check(p.structures.reserve_vault === 40 && p.structures.substrate_core === 20, 'nor anything at a settlement that made the Passage');
  check(said(s, new RegExp(`^${a.name}: the matter is thinning\\. \\d+ × Deep Mine have decayed away\\.$`)), `and the Record names what went (${s.civ.log.find((l) => /thinning/.test(l.text))?.text})`);
  theThinning(s, 38, 38.75);
  const half = a.structures.mine ?? 0;
  check(Math.abs(half - left / 4) < 20, `to η 38.75, five sixths of the matter gone: a quarter of what stood is left, ${half} of ${left} (about ${Math.round(left / 4)})`);
  theThinning(s, 38.75, 39);
  check(!a.structures.mine && a.structures.lepton_substrate === 2, `at η 39 none is left (${a.structures.mine ?? 0}), the substrate as it was`);
}

// what mines bring in falls with the matter left
{
  const s = game('decays');
  const c = town(s);
  c.pops = pops({ kin: 4 });
  c.structures = { mine: 2 };
  s.civ.capitalId = c.id;
  const mods = computeMods(s);
  const mined = (eta: number) => colonyTurn(s, c, { years: Math.pow(10, eta), L: Math.pow(10, eta - 1), logL: eta - 1, paceFactor: 1, mods }, 1e9).y.lines.find((l) => /Mine/.test(l.label))?.matter ?? 0;
  const before = mined(37);
  const thin = mined(38);
  check(before > 0 && Math.abs(thin / before - 2 / 3) < 1e-6, `a mine brings in two thirds as much at η 38 as before the Thinning (${thin.toFixed(2)} of ${before.toFixed(2)})`);
}

// a system dissolving before the Great Decay: what was re-encoded there goes on alone, to a hole with spin
{
  const s = game('decays');
  at(s, 38);
  const c = town(s);
  c.pops = pops({ kin: 3, echoes: 4, lattice: 2 });
  c.cryo = 2;
  c.structures = { lepton_substrate: 2, mine: 3, habitat_dome: 1 };
  s.civ.capitalId = c.id;
  const passed = town(s, [c.systemId]);
  passed.pops = pops({ echoes: 3 });
  passed.form = 'leptonic';
  passed.structures = { reserve_vault: 2, substrate_core: 1 };
  const bare = town(s, [c.systemId, passed.systemId]);
  bare.pops = pops({ kin: 5 });
  bare.structures = { habitat_dome: 1 };
  const d0 = s.civ.flags.decay_lost ?? 0;
  const sysOf = (x: Colony) => s.systems[x.systemId];
  const dissolve = (x: Colony) => {
    const sys = sysOf(x);
    sys.primary.kind = 'void';
    for (const id of sys.bodies) if (s.bodies[id] && s.bodies[id].kind !== 'deep') s.bodies[id].dissolved = true;
    return { systemId: sys.id, kind: 'dissolved' as const };
  };
  const ids = { c: c.id, passed: passed.id, bare: bare.id };
  asCiv(s, s.player, () => handleNotes(s, [dissolve(c), dissolve(passed), dissolve(bare)]));
  const went = colonies(s);
  const where = (x: Colony | undefined) => (x ? sysOf(x) : undefined);
  const vault = s.colonies[ids.c] ?? went.find((x) => (x.structures.lepton_substrate ?? 0) > 0);
  check(!!vault && formOf(vault) === 'leptonic' && ['black_hole', 'smbh'].includes(where(vault)!.primary.kind) && where(vault)!.primary.spin >= 20, `what was re-encoded goes on as leptonic, at once, at a black hole with spin (${where(vault)?.name}, spin ${Math.round(where(vault)?.primary.spin ?? 0)})`);
  check(!!vault && (vault.structures.lepton_substrate ?? 0) >= 2 && !vault.structures.mine && !vault.structures.habitat_dome && (vault.structures.penrose_harvester ?? 0) > 0, `keeping only its substrate, and with a harvester for the hole's spin (${vault ? Object.keys(vault.structures).join(', ') : '-'})`);
  check(!!vault && vault.pops.kin === 0 && vault.cryo === 0, 'its Kin and sleepers, made of matter, are gone');
  const p2 = s.colonies[ids.passed] ?? went.find((x) => (x.structures.reserve_vault ?? 0) > 0);
  check(!!p2 && (p2.structures.reserve_vault ?? 0) >= 2 && ['black_hole', 'smbh'].includes(where(p2)!.primary.kind), 'what made the Passage drifts there whole');
  check(!s.colonies[ids.bare], 'the settlement with nothing to go on is gone');
  check((s.civ.flags.decay_lost ?? 0) - d0 === 3 + 2 + 1 + 5, `each loss counted once for the Great Decay's report: 3 Kin, 2 sleepers, half the Lattice and the 5 Kin of the bare one (${(s.civ.flags.decay_lost ?? 0) - d0})`);
  check(said(s, /has dissolved\. What was re-encoded at .* goes on as leptonic, its Kin and the rest of what was matter lost, and drifts to .*, a black hole with spin to give\./), 'and the Record says so');
}

// it joins a vault of ours only of its own form: one still of matter would keep nothing of it at the end
{
  const s = game('decays');
  at(s, 38);
  const passed = town(s);
  passed.pops = pops({ echoes: 6 });
  passed.form = 'leptonic';
  passed.structures = { reserve_vault: 2, substrate_core: 2 };
  s.civ.capitalId = passed.id;
  const here = s.systems[passed.systemId];
  const holes = Object.values(s.systems).filter((x) => ['black_hole', 'smbh'].includes(x.primary.kind) && !x.gone && x.primary.spin >= 20);
  const far = (h: (typeof holes)[number]) => Math.hypot(h.phys.x - here.phys.x, h.phys.y - here.phys.y, h.phys.z - here.phys.z);
  const nearest = holes.slice().sort((x, y) => far(x) - far(y))[0];
  // our settlement still of matter in that hole's Deep
  const deep = s.bodies[nearest.bodies.find((id) => s.bodies[id]?.kind === 'deep')!];
  const old = createColony(s, deep, {});
  old.pops = pops({ kin: 2 });
  old.structures = { habitat_dome: 1 };
  const sys = s.systems[passed.systemId];
  sys.primary.kind = 'void';
  for (const id of sys.bodies) if (s.bodies[id] && s.bodies[id].kind !== 'deep') s.bodies[id].dissolved = true;
  asCiv(s, s.player, () => handleNotes(s, [{ systemId: sys.id, kind: 'dissolved' }]));
  const moved = s.colonies[passed.id];
  check(!!moved && formOf(moved) === 'leptonic' && moved.systemId !== nearest.id && old.pops.echoes === 0 && (old.structures.reserve_vault ?? 0) === 0, `a passed settlement does not join ours of matter at ${nearest.name}: it drifts on to ${s.systems[moved?.systemId ?? '']?.name}`);
}

// the forecasts name what of ours is still made of matter
{
  const s = game('decays');
  at(s, 34);
  const a = town(s);
  a.pops = pops({ kin: 2 });
  a.structures = { mine: 1 };
  const b = town(s, [a.systemId]);
  b.pops = pops({ echoes: 2 });
  b.structures = { lepton_substrate: 1 };
  s.civ.capitalId = a.id;
  updateForecasts(s);
  const decay = s.civ.forecasts.find((f) => f.kind === 'decay')?.text ?? '';
  check(new RegExp(`Still made of matter, with nothing to go on: ${a.name}\\.`).test(decay) && new RegExp(`Made of matter around what will go on .*: ${b.name}; only the Passage keeps all of it\\.`).test(decay), `before the Thinning, the forecast names them (${decay.slice(decay.indexOf('Still'), decay.indexOf('Still') + 90)}…)`);
  at(s, 38);
  updateForecasts(s);
  const now = s.civ.forecasts.find((f) => f.kind === 'thinning')?.text ?? '';
  check(/Ordinary matter is dissolving: 33% of it is gone/.test(now) && now.includes(a.name), `during it, how much is gone, and what is still made of it (${now.slice(0, 70)}…)`);
  const c = game('curvature');
  at(c, 80);
  const t = town(c);
  t.pops = pops({ kin: 2 });
  c.civ.capitalId = t.id;
  updateForecasts(c);
  check(/Once the brown dwarfs have faded the worlds themselves evaporate/.test(c.civ.forecasts.find((f) => f.kind === 'thinning')?.text ?? ''), 'under curvature it is foreseen from before the brown dwarfs fade');
}
done('THINNING');
