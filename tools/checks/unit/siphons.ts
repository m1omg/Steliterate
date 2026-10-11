// Halo Siphons (11 Oct): shut for good from the Unlit's request or card; while they run the halo
// falls twice as fast (its clock runs ahead of ours by what they drew, counted only from turns played
// with this version: no save loads into an emptier halo); they double an ember's dark-matter light,
// not a world falling into it; the Unlit's messages wait for an answer.
import { milestonesFor } from '../../../src/game/eras';
import { choiceHint, EVENT_BY_ID } from '../../../src/game/data/events';
import { backgroundK, embersOutEta, emberShare, haloDrawn, haloReachesYears, primaryTemperature, siphonsRunning, sourceLight } from '../../../src/game/physics';
import { readSave, saveFile } from '../../../src/game/save';
import { answerSignal, shutHaloSiphons } from '../../../src/game/sim/actions';
import { updateForecasts } from '../../../src/game/sim/forecast';
import { updateMinds } from '../../../src/game/sim/minds';
import { computeMods } from '../../../src/game/sim/mods';
import { project } from '../../../src/game/sim/projection';
import { deliverSignals, sendSignal } from '../../../src/game/sim/signals';
import { endTurn } from '../../../src/game/sim/turn';
import { capital } from '../../../src/game/sim/util';
import type { GameState } from '../../../src/game/types';
import { check, done, loadSave, near } from '../lib';

const SAVE = '9eea773-seed1000-turn119-merger.json.gz'; // seed 1000, turn 119, η 17.65, the capital at a halo ember
const round = (s: GameState) => readSave(saveFile(s).text)!;

// ---------------------------------------------------------------- the halo's clock
const ember = { kind: 'white_dwarf', halo: true, mass: 0.6 } as any;
const brown = { kind: 'brown_dwarf', mass: 0.05, formedAt: 1e10 } as any;
const neutron = { kind: 'neutron_star', mass: 1.4 } as any;
let same = true;
for (let e = 14; e <= 26; e += 0.25) {
  const y = Math.pow(10, e);
  if (emberShare(ember, y) !== emberShare(ember, y, 0) || backgroundK(y) !== backgroundK(y, 0)) same = false;
  for (const p of [ember, brown, neutron]) if (primaryTemperature(p, y, 'degenerate') !== primaryTemperature(p, y, 'degenerate', 0, 0, 0)) same = false;
}
check(same, 'nothing drawn: the halo, the glow and the dead stars’ warmth are as before, bit for bit (η 14 to 26)');
const y247 = Math.pow(10, 24.7);
check(emberShare(ember, y247, y247) === 0, 'drawn as far as the years themselves (running from early on): the embers are out by η 24.7');
near('η 23.5 with as much drawn: the natural share at twice the years', emberShare(ember, Math.pow(10, 23.5), Math.pow(10, 23.5)), emberShare(ember, 2 * Math.pow(10, 23.5)));
const left = { ...ember, haloLeft: 1e23 };
near('a cast-out ember still dims by our own clock', emberShare(left, Math.pow(10, 23.5), 1e23), ((25 - Math.log10(Math.pow(10, 23.5) + 1e23)) / 3) * 0.5);

// ---------------------------------------------------------------- an old save: not retrospective
{
  const s = loadSave(SAVE);
  const c = capital(s)!;
  const sys = s.systems[c.systemId];
  const before = sourceLight(s, sys, s.years, s.turnLength).light;
  s.civ.techs.push('halo_siphons');
  const r = round(s);
  check(r.civ.flags.halo_drawn === undefined && haloDrawn(r) === 0, 'an old save with Halo Siphons researched loads with nothing drawn');
  check(sourceLight(r, r.systems[c.systemId], r.years, r.turnLength).light === before, 'and its ember gives the same light as before the update');
  const y0 = r.years;
  endTurn(r);
  near('one turn with the siphons running draws exactly that turn’s years', haloDrawn(r), r.years - y0);
  const t = loadSave(SAVE);
  for (let i = 0; i < 3; i++) endTurn(t);
  check(t.civ.flags.halo_drawn === undefined, 'a game without the siphons never draws (three turns)');
}

// ---------------------------------------------------------------- shutting them
{
  const s = loadSave(SAVE);
  check(shutHaloSiphons(s) === 'We have no Halo Siphons to shut.', 'nothing to shut before they are researched');
  s.civ.techs.push('halo_siphons');
  check(siphonsRunning(s), 'researched: they run');
  check(shutHaloSiphons(s) === null && s.civ.flags.siphons_shut === s.turn && !siphonsRunning(s), 'shut: for good, on this turn');
  check(shutHaloSiphons(s) === 'The Halo Siphons are already shut.', 'and only once');
  const y0 = s.years;
  endTurn(s);
  check(haloDrawn(s) === 0 && s.years > y0, 'a turn after they are shut draws nothing');
}

// ---------------------------------------------------------------- the Unlit's request
function withRequest(): { s: GameState; uid: string } {
  const s = loadSave(SAVE);
  s.civ.techs.push('halo_siphons');
  s.minds.dark.stage = 3;
  s.minds.dark.understanding = 75;
  updateMinds(s, 0, computeMods(s));
  deliverSignals(s);
  const sig = s.signals.find((x) => x.kind === 'dark_reveal2')!;
  return { s, uid: sig.uid };
}
{
  const { s, uid } = withRequest();
  const sig = s.signals.find((x) => x.uid === uid)!;
  check(!!sig && sig.arrivedTurn !== null && sig.resolved === null, 'their request has arrived, open');
  s.civ.matter = 1000;
  s.civ.energy = 1000;
  const no = answerSignal(s, uid, 'help');
  check(typeof no === 'string' && /siphons drain the halo/.test(no) && /Shut the Halo Siphons first/.test(no) && sig.resolved === null, `refused while the siphons run, and the request stays open: “${no}”`);
  shutHaloSiphons(s);
  s.civ.matter = 50;
  check(answerSignal(s, uid, 'help') === 'Gathering needs 200 matter and 100 energy.', 'shut, but short of matter: the old answer');
  s.civ.matter = 500;
  s.civ.energy = 500;
  check(answerSignal(s, uid, 'help') === null && sig.resolved === 'help' && s.civ.matter === 300 && s.civ.energy === 400, 'shut, with enough: Help goes through (−200 matter, −100 energy)');
}

// ---------------------------------------------------------------- the economy
{
  const energy = (s: GameState) => project(s).perColony[capital(s)!.id].y.energy;
  const setUp = (siphons: 'none' | 'running' | 'shut', rek: number) => {
    const s = loadSave(SAVE);
    const c = capital(s)!;
    c.structures.ember_collector = 2;
    s.systems[c.systemId].primary.rekindle = rek;
    if (siphons !== 'none') s.civ.techs.push('halo_siphons');
    if (siphons === 'shut') s.civ.flags.siphons_shut = s.turn;
    return s;
  };
  const off = energy(setUp('none', 0));
  const run = energy(setUp('running', 0));
  check(energy(setUp('shut', 0)) === off, `shut, exactly as never researched (${off.toFixed(2)} energy)`);
  check(run > off, `running, the embers’ dark matter doubles (${off.toFixed(2)} → ${run.toFixed(2)})`);
  const offR = energy(setUp('none', 0.4));
  const runR = energy(setUp('running', 0.4));
  near('a world falling into the ember adds light the siphons do not double', runR - offR, run - off, 1e-9);
}

// ---------------------------------------------------------------- what the Unlit do about it
{
  const moved = (s: GameState) => s.log.filter((l) => /invisible mass passed through|Something unseen pulled/.test(l.text)).length;
  const run = (shut: boolean, hostile: boolean) => {
    const s = loadSave(SAVE);
    s.civ.techs.push('halo_siphons');
    if (shut) s.civ.flags.siphons_shut = s.turn;
    s.minds.dark.stage = 4;
    if (hostile) s.minds.dark.flags.hostile = 1;
    const rng0 = s.rng;
    const n0 = moved(s);
    for (let i = 0; i < 200; i++) updateMinds(s, 0, computeMods(s));
    return { events: moved(s) - n0, rngUsed: s.rng !== rng0 };
  };
  const a = run(false, false);
  check(a.events > 0, `running, they move worlds (${a.events} in 200 turns)`);
  const b = run(true, false);
  check(b.events === 0 && !b.rngUsed, 'shut and never refused: nothing moves, and no dice are thrown');
  const h = run(true, true);
  check(h.events > 0, `shut but already hostile: they still move worlds (${h.events})`);
}

// ---------------------------------------------------------------- messages that wait
{
  const { s, uid } = withRequest();
  const astro = sendSignal(s, { from: 'astronomers', kind: 'test_choice', distanceLy: 0, title: 'A test', text: 'A message with a choice.', choices: [{ id: 'a', label: 'A' }] });
  deliverSignals(s);
  for (let i = 0; i < 10; i++) {
    s.turn++;
    deliverSignals(s);
  }
  const sig = s.signals.find((x) => x.uid === uid)!;
  check(sig.resolved === null, 'their request is still open ten turns on');
  check(astro.resolved === 'lapsed', 'another message with a choice still lapses after 8 turns');
  sig.resolved = 'lapsed';
  const r = round(s);
  check(r.signals.find((x) => x.uid === uid)!.resolved === null, 'a request of theirs that lapsed before opens again as the save loads');
  check(r.signals.find((x) => x.uid === astro.uid)!.resolved === 'lapsed', 'other lapsed messages stay lapsed');
  for (let i = 0; i < 200; i++) sendSignal(r, { from: 'astronomers', kind: 'noise', distanceLy: 0, title: 'Noise', text: '' });
  deliverSignals(r);
  check(r.signals.length === 161 && r.signals.some((x) => x.uid === uid && x.resolved === null), `160 newer messages do not push out their open request (${r.signals.length} kept)`);
  r.signals.find((x) => x.uid === uid)!.resolved = 'refuse';
  deliverSignals(r);
  check(r.signals.length === 160, 'answered, it goes the way of the others (160)');
}

// ---------------------------------------------------------------- dates shown
{
  const s = loadSave(SAVE);
  updateForecasts(s);
  const f = s.forecasts.find((x) => x.kind === 'embers')!;
  check(!!f && f.dueYears === 1e22 && f.text === 'The dark-matter halo is being used up. White dwarfs will cool toward black dwarfs by η 25.', 'no siphons: the embers forecast is as before');
  check(JSON.stringify(milestonesFor('decay')) === JSON.stringify(milestonesFor('decay', undefined)), 'no siphons: the milestones are as before');
  const dim = EVENT_BY_ID.embers_dim.choices[0];
  check(choiceHint(dim, s, {}) === 'Ember yields keep falling until η 25.', 'no siphons: the fading embers’ hint is as before');
  s.civ.techs.push('halo_siphons');
  near('running: the embers are out by (10^25 + now) / 2', haloReachesYears(s, 25), (1e25 + s.years) / 2);
  near('that is η 24.7', embersOutEta(s), Math.log10(5e24 + s.years / 2), 1e-12);
  updateForecasts(s);
  const g = s.forecasts.find((x) => x.kind === 'embers')!;
  check(/faster while our Halo Siphons run/.test(g.text) && /η 24\.7/.test(g.text), `running: the forecast says so (“${g.text}”)`);
  const m = milestonesFor('decay', { at: embersOutEta(s), running: true }).find((x) => x.label === 'Embers fade')!;
  check(Math.abs(m.at - 24.699) < 0.01 && /bringing it sooner/.test(m.detail), 'running: the Chronometer’s Embers fade moves to η 24.7');
  check(/η 24\.7, sooner while our Halo Siphons run/.test(choiceHint(dim, s, {})), 'running: so does the fading embers’ hint');
  s.civ.flags.halo_drawn = 1e23;
  s.civ.flags.siphons_shut = s.turn;
  near('shut with 10^23 years drawn: the end comes that much sooner, and no more', haloReachesYears(s, 25), 1e25 - 1e23);
}

done('SIPHONS');
