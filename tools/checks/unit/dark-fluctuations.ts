// What the late Dark Era's noise makes (7 Nov; sim/fluctuations.ts):
// - echoes, the player's alone and words only, each once as its date passes: a voice (λ 31), a page
//   of our first record (λ 43, word for word), our first world's sky (λ 70) and a settlement we lost
//   (λ 78; from the record of what we lost, or a game saved before it from the log's lines; none if we
//   lost none); their answers change nothing;
// - minds out of nothing from 10^(10⁵⁰) years: A Mind From Nowhere as the turn passes it (no longer
//   from η 1000, nor left to chance), held as an Echo only where an Error-Correction Array of ours
//   stands; Many Minds a turn or more later; under The Unbidden, one held a turn for each array where
//   its settlement has Echo room free, and none without the charter or before the date;
// - a cloud out of nothing at λ 99.4: once, the turn stopping at its date, a flash our Burst Catchers
//   bank, its card "A Light in the Dark"; none if the vacuum fell first.
import { CLOUD_LAMBDA } from '../../../src/game/eras';
import { EVENT_BY_ID } from '../../../src/game/data/events';
import { BURST_CATCH } from '../../../src/game/sim/crossing';
import { resolveEvent } from '../../../src/game/sim/events';
import { turnEndWhy, turnStep } from '../../../src/game/sim/flare';
import { ECHO_DATES, MINDS_FROM, foundingLine, holdTheUnbidden, lostToRemember } from '../../../src/game/sim/fluctuations';
import { endTurn } from '../../../src/game/sim/turn';
import { colonies } from '../../../src/game/sim/util';
import { vacuumFallsAt } from '../../../src/game/vacuum';
import type { GameState } from '../../../src/game/types';
import { darkGame } from '../darkgame';
import { check, done } from '../lib';

const lam = (s: GameState) => Math.log10(Math.max(1, s.eta));

/** Play a Dark Era game to its end at the Tide, energy and Continuity kept full; what each turn queued, and from which λ to which. */
function play(s: GameState) {
  const turns: { from: number; to: number; queued: string[]; lines: string[]; why: string }[] = [];
  for (let n = 0; n < 60 && !s.civ.outcome; n++) {
    const from = lam(s);
    const why = turnEndWhy(s);
    const stop = turnStep(s).eta;
    s.civ.pending.length = 0;
    s.civ.energy = 3000;
    s.civ.continuity = 100;
    const n0 = s.civ.log.length;
    endTurn(s);
    turns.push({ from, to: lam(s), queued: s.civ.pending.map((p) => p.defId), lines: s.civ.log.slice(n0).map((e) => e.text), why: stop === Math.pow(10, CLOUD_LAMBDA) ? why : '' });
  }
  return turns;
}

// ---------------------------------------------------------------- the echoes, and the minds
const s = darkGame();
const home = colonies(s)[0];
home.structures = { lepton_substrate: 3, preservation_array: 2, burst_catcher: 2 };
s.civ.techs.push('the_long_record', 'burst_capture');
s.civ.lostPlaces = [{ name: 'Old Harbour', turn: 40, era: 'dusk', why: 'its world fell into its star' }];
const turns = play(s);
const when = (id: string) => turns.find((t) => t.queued.includes(id));
for (const [id, at] of [['echo_voice', ECHO_DATES.voice], ['echo_page', ECHO_DATES.page], ['echo_sky', ECHO_DATES.sky], ['echo_lost', ECHO_DATES.lost], ['mind_from_nowhere', MINDS_FROM]] as const) {
  const t = when(id);
  check(!!t && t.from < at && t.to >= at, `${id} as the turn passes λ ${at} (${t ? `${t.from.toFixed(1)} to ${t.to.toFixed(1)}` : 'never'})`);
  check(turns.filter((x) => x.queued.includes(id)).length === 1, `${id} once`);
}
const mm = when('many_minds');
const first = turns.indexOf(when('mind_from_nowhere')!);
check(!!mm && turns.indexOf(mm) > first, `Many Minds a turn or more after the first mind (turn ${turns.indexOf(mm!) + 1}, the first at ${first + 1})`);
check(/Old Harbour/.test(EVENT_BY_ID.echo_lost.text(s, { name: 'Old Harbour', why: 'its world fell into its star', era: 'The Long Dusk' })) && EVENT_BY_ID.echo_page.text(s, {}).includes(foundingLine(s)), 'the settlement we lost, and our first record word for word');
check(foundingLine(s) === darkGame().civ.log.find((e) => e.kind === 'era')?.text, `our first record as the game began it ("${foundingLine(s).slice(0, 48)}…")`);
// the log stands in for the record in a game saved before it
{
  const old = darkGame();
  old.civ.log.push({ turn: 12, era: 'dusk', text: 'Brightwater is lost: its star exploded', kind: 'bad' });
  check(lostToRemember(old)?.name === 'Brightwater' && lostToRemember(darkGame())?.name === undefined, 'a game saved before the record: the log’s line; none lost, no echo');
}
// their answers change nothing
{
  const e = darkGame();
  const before = JSON.stringify({ c: e.civ.continuity, r: e.civ.resolve, en: e.civ.energy, st: e.civ.standing, p: colonies(e).map((c) => c.pops) });
  for (const id of ['echo_voice', 'echo_page', 'echo_sky', 'echo_lost']) {
    e.civ.pending.push({ uid: `x-${id}`, defId: id, data: id === 'echo_lost' ? { name: 'Old Harbour', why: 'its world fell', era: 'The Long Dusk' } : {} });
    resolveEvent(e, `x-${id}`, 0);
  }
  check(JSON.stringify({ c: e.civ.continuity, r: e.civ.resolve, en: e.civ.energy, st: e.civ.standing, p: colonies(e).map((c) => c.pops) }) === before, 'the echoes change nothing');
}

// ---------------------------------------------------------------- holding a mind out of nothing
{
  const e = darkGame();
  const hold = EVENT_BY_ID.mind_from_nowhere.choices[0];
  check(hold.label === 'Hold its pattern' && !hold.ok!(e, {}), 'without an Error-Correction Array a mind cannot be held');
  colonies(e)[0].structures.preservation_array = 1;
  const echoes = colonies(e)[0].pops.echoes;
  e.civ.pending.push({ uid: 'm', defId: 'mind_from_nowhere', data: {} });
  check(resolveEvent(e, 'm', 0).ok && colonies(e)[0].pops.echoes === echoes + 1 && e.civ.flags.unbidden === 1, 'with one, it wakes as one of our Echoes');
}
{
  const e = darkGame();
  const c = colonies(e)[0];
  c.structures = { lepton_substrate: 2, preservation_array: 2 };
  c.pops.echoes = 6;
  e.eta = Math.pow(10, 60);
  check(holdTheUnbidden(e, e.eta) === 0, 'not without The Unbidden');
  e.civ.charters.push('the_unbidden');
  check(holdTheUnbidden(e, Math.pow(10, 40)) === 0, 'nor before 10^(10⁵⁰) years');
  const n = holdTheUnbidden(e, e.eta);
  check(n === 2 && c.pops.echoes === 8, `one a turn for each array (${n} held, ${c.pops.echoes} Echoes)`);
  const m = holdTheUnbidden(e, e.eta);
  check(m === 0, `and only into Echo room free (${m} more with the substrate full)`);
  check(!!turns.length && s.civ.flags.unbidden === undefined, 'in the game above, without the charter and the first mind’s card unanswered, none held');
}

// ---------------------------------------------------------------- the cloud
const lit = turns.filter((t) => t.queued.includes('cloud_light'));
check(lit.length === 1 && Math.abs(lit[0].to - CLOUD_LAMBDA) < 1e-6, `the cloud once, its turn ending at its date (λ ${lit[0]?.to.toFixed(3)})`);
check(turns.some((t) => t.why === 'the light expected near 10^(10⁹⁹) years'), 'the turn stops for the light, and says so');
const caught = lit[0]?.lines.find((l) => /Burst Catchers .* caught the flash/.test(l)) ?? '';
check(caught.includes(`+${BURST_CATCH * 2} energy`), `our two Burst Catchers bank its flash ("${caught}")`);
{
  // a landscape vacuum falling before it: no cloud, and no stop for it
  let seed = 1000;
  let g = darkGame({ vacuum: 'landscape' }, seed);
  while (vacuumFallsAt(g) > CLOUD_LAMBDA - 5 && seed < 1100) g = darkGame({ vacuum: 'landscape' }, ++seed);
  const t = play(g);
  check(!t.some((x) => x.queued.includes('cloud_light')) && g.civ.outcome?.ending === 'The Final State', `none if the vacuum fell first (seed ${seed}: falls at λ ${vacuumFallsAt(g).toFixed(1)})`);
}

done('DARK FLUCTUATIONS');
