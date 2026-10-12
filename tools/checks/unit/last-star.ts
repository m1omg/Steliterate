// The Last Star (12 Oct): it lit as its turn began with a life shorter than the turn, so it burned
// out in the turn it lit (or gave the next a few percent) and no turn drew on its light. Now it
// lights as the turn ends, as every new star does, shines through the next turn, and its event
// offers its clock, free whatever the pace; the Great Decay ends it with the rest of matter; a Last
// Star the old rule put out lights again as an old save loads (the player's choice). The Unlit's own
// message about it stays word for word.
import { choiceHint, EVENT_BY_ID } from '../../../src/game/data/events';
import { calendarEra } from '../../../src/game/fate';
import { sourceLight } from '../../../src/game/physics';
import { readSave, saveFile } from '../../../src/game/save';
import { answerEvent } from '../../../src/game/sim/actions';
import { livedShare, starClock, starClockTerms, turnStep } from '../../../src/game/sim/flare';
import { lastStarDies } from '../../../src/game/sim/minds';
import { endTurn } from '../../../src/game/sim/turn';
import type { GameState, StarSystem } from '../../../src/game/types';
import { check, done, loadSave, near } from '../lib';

declare const process: { getBuiltinModule(id: string): unknown };
const fs = process.getBuiltinModule('node:fs') as { readFileSync(p: string | URL): Uint8Array };
const zlib = process.getBuiltinModule('node:zlib') as { gunzipSync(b: Uint8Array): Uint8Array };

const BASE = '9eea773-seed1000-turn119-merger.json.gz'; // seed 1000, stable fate, turn 119, η 17.65
// made with main's code at 98139af (the old rule): lit at η 26 at pace −1, out within its turn (119)
const OLD = '98139af-seed1000-turn121-last-star-out.json.gz';
const round = (s: GameState) => readSave(saveFile(s).text)!;
const lastStar = (s: GameState) => Object.values(s.systems).find((x) => x.name === 'The Last Star' && !x.gone) as StarSystem | undefined;
const pendingStar = (s: GameState) => s.pending.filter((p) => p.defId === 'last_star');
const lightNow = (s: GameState, sys: StarSystem) => sourceLight(s, sys, s.years, turnStep(s).turnLength).light;

/** The old save's own text, before migrate: main's code wrote it. */
function oldRaw(): any {
  const bytes = fs.readFileSync(new URL(`../../saves/${OLD}`, import.meta.url));
  return JSON.parse(new TextDecoder().decode(zlib.gunzipSync(bytes)));
}
const fromRaw = (raw: unknown) => readSave(JSON.stringify(raw))!;

/** The base save moved to η `at`, the gathering done this turn, at this pace (and fate). */
function gathering(at: number, pace: number, fate?: 'decay' | 'stable' | 'curvature'): GameState {
  const s = loadSave(BASE);
  if (fate) s.fate = fate;
  s.years = Math.pow(10, at);
  s.eta = at;
  s.civ.pace = pace;
  s.minds.dark.stage = 4;
  s.minds.dark.understanding = 80;
  s.minds.dark.flags.gathering = s.turn;
  return s;
}

// ---------------------------------------------------------------- the old rule, as the save has it
const raw = oldRaw();
const rawStar = Object.values(raw.systems as Record<string, StarSystem>).find((x) => x.name === 'The Last Star')!;
const rawSig = (raw.signals as { kind: string; title: string; text: string; sentYears: number; arrivedTurn: number }[]).find((x) => x.kind === 'dark_star')!;
check(rawStar.primary.kind === 'black_dwarf' && raw.log.some((e: { turn: number; text: string }) => e.turn === rawSig.arrivedTurn - 1 && e.text === 'The star at The Last Star has burned out.'), 'main’s code: the Last Star lit and burned out within its turn (the bug, as the player saw it)');

// ---------------------------------------------------------------- the new rule, at three paces
for (const pace of [0, -1, -2]) {
  const s = gathering(26, pace);
  const from = s.years;
  endTurn(s);
  const sys = lastStar(s);
  check(!!sys && sys.primary.kind === 'dark_star', `pace ${pace}: the Last Star burns after the turn it lit`);
  if (!sys) continue;
  const to = s.years;
  check(sys.primary.bornAt === to && to > from, `pace ${pace}: it lit as the turn ended (born ${to.toExponential(3)})`);
  near(`pace ${pace}: it burns until the universe is three times as old`, sys.primary.diesAt!, lastStarDies(s, to));
  check(sys.primary.diesAt! >= 3 * to, `pace ${pace}: …at least`);
  check(pendingStar(s).length === 1, `pace ${pace}: its event waits (Light in the Halo)`);
  const sig = s.signals.find((x) => x.kind === 'dark_star' && x.from === 'dark');
  check(!!sig && sig.title === rawSig.title && sig.text === rawSig.text, `pace ${pace}: the Unlit’s message is word for word as before`);
  const light = lightNow(s, sys);
  check(light > 0, `pace ${pace}: the next turn draws on its light (×${light.toFixed(3)})`);
  if (pace === 0) near('pace 0: at the Tide it shines through the whole next turn', light, 10);
  check(s.civ.flags.last_star_lit === 1, `pace ${pace}: marked lit by the new rule`);
}

// ---------------------------------------------------------------- free, whatever the pace
{
  const s = gathering(26, 0);
  endTurn(s);
  const sys = lastStar(s)!;
  for (const pace of [0, -1, -2, -3]) {
    s.civ.pace = pace;
    const t = starClockTerms(s, sys);
    check(t.possible && t.cost === 0, `pace ${pace}: its clock can be kept, free (orders ${t.orders.toFixed(2)})`);
  }
  s.civ.pace = -3;
  sys.primary.kind = 'collision_star';
  const priced = starClockTerms(s, sys).cost;
  sys.primary.kind = 'dark_star';
  check(priced > 0, `a collision star as far out of tune would cost ${priced} energy: the Last Star is a gift`);
  const ev = EVENT_BY_ID.last_star;
  const p = pendingStar(s)[0];
  check(ev.text(s, p.data).includes('costs nothing, whatever our pace'), 'the event says it costs nothing, whatever our pace');
  check(choiceHint(ev.choices[0], s, p.data).includes('Free, whatever our pace.'), 'and so does its Keep time hint');
  check(!/[0-9]+ energy, once/.test(ev.text(s, p.data)), 'and names no price');
}

// ---------------------------------------------------------------- keeping time with it
{
  const s = gathering(26, -2);
  endTurn(s);
  const sys = lastStar(s)!;
  const energy = s.civ.energy;
  const res = answerEvent(s, pendingStar(s)[0].uid, 0);
  check(res.ok && s.civ.energy === energy && !!starClock(s), `Keep time with it: kept, nothing paid (${res.text})`);
  const dies = sys.primary.diesAt!;
  let full = true;
  let turns = 0;
  for (let i = 1; i <= 6; i++) {
    const kept = starClock(s);
    if (!kept || kept.turn !== i || kept.of !== 6 || kept.systemId !== sys.id) full = false;
    if (lightNow(s, sys) !== 10 || livedShare(s) !== 1) full = false;
    endTurn(s);
    turns++;
    if (s.years >= dies) break;
  }
  check(full, 'six turns at pace −2, each lived in full in its light (×10, one Tide turn each)');
  check(turns === 6 && s.years === dies, 'the sixth ends as it burns out');
  check(sys.primary.kind === 'black_dwarf' && !starClock(s) && !s.civ.flags.star_until, 'then it is out, and our own pace again');
}

// ---------------------------------------------------------------- watching it instead
{
  const s = gathering(26, 0);
  endTurn(s);
  const before = s.civ.resolve;
  const res = answerEvent(s, pendingStar(s)[0].uid, 1);
  check(res.ok && !starClock(s) && s.civ.resolve === Math.min(100, before + 2), 'Watch it burn: resolve +2, no clock');
}

// ---------------------------------------------------------------- the Great Decay ends it
{
  const s = gathering(38.3, 0, 'decay');
  endTurn(s);
  const sys = lastStar(s)!;
  check(!!sys && sys.primary.diesAt! > 1e39, 'where protons decay, lit at η 38.75 it would burn past η 39');
  answerEvent(s, pendingStar(s)[0].uid, 0);
  check(!!starClock(s), 'kept time with');
  for (let i = 0; i < 8 && s.era === 'degenerate' && !s.outcome; i++) endTurn(s);
  const p = Object.values(s.systems).find((x) => x.name === 'The Last Star')!.primary;
  check(s.eta >= 39 && p.kind === 'void', `the Great Decay took it with the rest of matter (η ${s.eta.toFixed(2)})`);
  check(!s.civ.flags.star_until && !s.civ.flags.star_step && !starClock(s), 'and the clock kept with it ended there');
}

{
  // lit in the very turn the Great Decay comes: its event says what took it, and offers no clock
  const s = gathering(38.7, 0, 'decay');
  endTurn(s);
  const p = pendingStar(s)[0];
  const sys = Object.values(s.systems).find((x) => x.name === 'The Last Star')!;
  check(sys.primary.kind === 'void' && !!p, `lit as the Great Decay came (η ${s.eta.toFixed(2)}): dissolved, its event still waits`);
  const ev = EVENT_BY_ID.last_star;
  check(!!p && ev.text(s, p.data).endsWith('the Great Decay took it with the rest of matter, almost as it came.') && !ev.choices[0].ok!(s, p.data), 'its event says the Great Decay took it, and Keep time is shut');
}

// ---------------------------------------------------------------- in the Black Hole Age's calendar
{
  // curvature: the age is still the Degenerate one at η 45, while the calendar has turned
  const s = gathering(45, 0, 'curvature');
  endTurn(s);
  const sys = lastStar(s)!;
  check(calendarEra(s) === 'blackhole' && !!sys && sys.primary.kind === 'dark_star', 'lit in the Black Hole Age’s calendar (curvature, η 45)');
  near('there too it shines through the whole next turn at the Tide', lightNow(s, sys), 10);
  const res = answerEvent(s, pendingStar(s)[0].uid, 0);
  check(res.ok && !!starClock(s), 'and can be kept time with, free');
  const dies = sys.primary.diesAt!;
  let n = 0;
  while (s.years < dies && n < 8) {
    endTurn(s);
    n++;
  }
  check(n === 6 && sys.primary.kind === 'black_dwarf' && !starClock(s), `six turns, then out (${n})`);
}

// ---------------------------------------------------------------- in the Dark Era
{
  // seed 856252 (harness game 107) finishes the quest at η 2370: there years are past counting
  const s = gathering(26, 0);
  s.era = 'dark';
  s.years = Infinity;
  s.eta = 2369;
  s.turnLength = Infinity;
  endTurn(s);
  const sys = lastStar(s);
  check(!!sys && sys.primary.kind === 'black_dwarf' && pendingStar(s).length === 0, 'in the Dark Era it lights and goes out within the turn, as it always did there: no clock to offer');
  check(s.log.some((e) => e.text.startsWith('The Last Star lit and went out within the turn')) && s.signals.some((x) => x.kind === 'dark_star'), 'the Record says so, and the Unlit’s message still comes');
  check(Number.isFinite(s.civ.energy) && Number.isFinite(sourceLight(s, sys!, s.years, s.turnLength).light), 'nothing reads NaN from it');
}

// ---------------------------------------------------------------- an old save: it lights again
{
  const s = loadSave(OLD);
  const sys = lastStar(s)!;
  check(sys.primary.kind === 'dark_star' && sys.primary.bornAt === s.years, 'the old save loads with the Last Star lit again, as this turn begins');
  near('until three times the age', sys.primary.diesAt!, lastStarDies(s, s.years));
  check(pendingStar(s).length === 1 && s.civ.flags.last_star_lit === 1, 'its event waits, and it is marked');
  near('the coming turn at the Tide is lived in its light', lightNow(s, sys), 10);
  const r = round(s);
  check(pendingStar(r).length === 1 && lastStar(r)!.primary.bornAt === s.years, 'saved and loaded again: nothing more (one event, the same star)');
  check(r.signals.find((x) => x.kind === 'dark_star')!.text === rawSig.text, 'the Unlit’s message is untouched');
  answerEvent(r, pendingStar(r)[0].uid, 0);
  const dies = lastStar(r)!.primary.diesAt!;
  let n = 0;
  while (r.years < dies && n < 8 && !r.outcome) {
    endTurn(r);
    n++;
  }
  check(n === 6 && !starClock(r), `kept time with: six turns, then out (${n})`);
}
{
  const ok = (what: string, edit: (x: any) => void) => {
    const x = oldRaw();
    edit(x);
    const s = fromRaw(x);
    check(lastStar(s)?.primary.kind === 'black_dwarf' && pendingStar(s).length === 0, `not relit: ${what}`);
  };
  ok('lit before about η 24.5, when 10²⁵ years held it for turns', (x) => (x.signals.find((g: any) => g.kind === 'dark_star').sentYears = 1e24));
  ok('it went out turns after it lit', (x) => {
    for (const e of x.log) if (e.text === 'The star at The Last Star has burned out.') e.turn += 3;
  });
  ok('matter is gone', (x) => (x.civ.flags.matter_gone = 1));
  ok('lit by the new rule', (x) => (x.civ.flags.last_star_lit = 1));
}

done('LAST STAR');
