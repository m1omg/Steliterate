// The three fates of matter. The unknown fate is one draw (decay half the time, curvature and
// stable a quarter each); old saves keep their fate. Stable matter ends the Degenerate Age at η 30
// (the Last Warmth: nothing decays) and the calendar still turns at η 39; curvature radiation ends
// it at η 68 with the neutron stars bursting, fades the dwarfs, and evaporates all matter at η 89.5;
// decay is as it was. Near η 30 the universe shows an unknown fate; until then the forecasts and
// texts are the same whatever it is.
import { autoPlay } from '../../../src/game/auto';
import { drawFate } from '../../../src/game/gen';
import { newGame } from '../../../src/game/newGame';
import { endTurn } from '../../../src/game/sim/turn';
import { techVisible } from '../../../src/game/sim/research';
import { TECH_BY_ID } from '../../../src/game/data/techs';
import { calendarEra, fateKnown, fateOf, matterGone } from '../../../src/game/fate';
import { shownKind } from '../../../src/game/physics';
import type { CrossingReport, GameState, ProtonFate } from '../../../src/game/types';
import { check, done, loadSave } from '../lib';

check(drawFate(0.1) === 'decay' && drawFate(0.49) === 'decay' && drawFate(0.5) === 'curvature' && drawFate(0.74) === 'curvature' && drawFate(0.75) === 'stable', 'an unknown fate: decay below 0.5, curvature to 0.75, stable above');
const old = loadSave('551fb1a-seed24757-turn71.json.gz');
check(old.saveVersion === 3 && old.fate === (old.protonsDecay ? 'decay' : 'stable'), `an old save keeps its fate (${old.fate}) and loads as version 3`);

/** Play a game of this fate with the autoplayer until `stop` says so; every crossing seen is kept. */
function play(fate: ProtonFate, stop: (s: GameState) => boolean, seed = 1000) {
  const s = newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: fate });
  const crossings: CrossingReport[] = [];
  for (let g = 0; g < 1200 && !s.outcome && !stop(s); g++) {
    autoPlay(s, 'competent');
    const r = endTurn(s);
    if (r.crossing) crossings.push(r.crossing);
  }
  return { s, crossings };
}
const text = (r: CrossingReport | undefined) => (r ? [r.title, r.intro, ...r.lines.map((l) => l.text)].join(' ') : '');

// ---------------------------------------------------------------- stable: the Last Warmth at η 30
{
  const { s, crossings } = play('stable', (g) => g.era === 'blackhole');
  const r = crossings.find((c) => c.from === 'degenerate');
  check(s.era === 'blackhole' && s.eta >= 30 && s.eta < 31.5, `stable: the Black Hole Age begins at η ${s.eta.toFixed(2)}`);
  check(r?.title === 'The Last Warmth' && !/decayed|dissolved/.test(text(r)), `its crossing is the Last Warmth, with nothing decayed (${r?.title})`);
  check(calendarEra(s) === 'degenerate' && s.years < 1e40, 'the calendar is still the Degenerate Age’s');
  const { s: s2 } = play('stable', (g) => g.eta >= 40.5);
  check(s2.era === 'blackhole' && calendarEra(s2) === 'blackhole' && s2.years >= 1e40, `at η 39 the calendar turns on its own (η ${s2.eta.toFixed(2)}, ${s2.era})`);
  check(!matterGone(s2), 'and matter endures');
}
// ---------------------------------------------------------------- curvature: neutron stars burst at η 68, matter gone at η 89.5
{
  const { s, crossings } = play('curvature', (g) => g.era === 'blackhole');
  const r = crossings.find((c) => c.from === 'degenerate');
  check(s.era === 'blackhole' && s.eta >= 68 && s.eta < 70, `curvature: the Black Hole Age begins at η ${s.eta.toFixed(2)}`);
  check(r?.title === 'The Last Warmth' && /neutron stars have burst/.test(text(r)), 'the neutron stars burst at the Last Warmth');
  check(!Object.values(s.systems).some((x) => x.primary.kind === 'neutron_star'), 'none is left');
  const { s: s1 } = play('curvature', (g) => g.eta >= 85.5);
  const white = (g: GameState) => Object.values(g.systems).filter((x) => !x.gone && ['white_dwarf', 'black_dwarf'].includes(shownKind(x.primary, g.years)));
  check(s1.eta < 89.5 && white(s1).length === 0, `by η ${s1.eta.toFixed(2)} every white dwarf has faded (${white(s1).map((x) => `${x.name} ${x.primary.kind}`).join(', ') || 'none left'})`);
  const { s: s2, crossings: c2 } = play('curvature', (g) => g.eta >= 90 || matterGone(g));
  const storm = c2.find((c) => c.title === 'The Great Evaporation');
  check(!!storm && storm.from === 'blackhole' && storm.to === 'blackhole', `the Great Evaporation comes inside the age (η ${s2.eta.toFixed(2)})`);
  check(matterGone(s2) && Object.values(s2.bodies).every((b) => b.kind === 'deep' || b.dissolved), 'and every world is gone');
  check(!Object.values(s2.systems).some((x) => !x.gone && (x.primary.kind === 'white_dwarf' || x.primary.kind === 'black_dwarf' || x.primary.kind === 'brown_dwarf')), 'no dwarf is left');
}
// ---------------------------------------------------------------- decay: as it was
{
  const { s, crossings } = play('decays', (g) => g.era === 'blackhole');
  const r = crossings.find((c) => c.from === 'degenerate');
  check(s.era === 'blackhole' && r?.title === 'The Great Decay' && s.years >= 1e40, `decay: the Great Decay at η 39, the calendar jumping to 10⁴⁰ (η ${s.eta.toFixed(2)})`);
  check(matterGone(s) && calendarEra(s) === 'blackhole', 'matter is gone');
}
// ---------------------------------------------------------------- an unknown fate gives nothing away until η 30, then shows itself
// no one may ask the Proton Question here (the autoplayer would, or the scholars from surplus insight)
const asked = TECH_BY_ID.proton_question.requires;
TECH_BY_ID.proton_question.requires = ['(never)'];
const blindTurn = (s: GameState) => {
  autoPlay(s, 'competent');
  return endTurn(s);
};
const seen = (fate: 'decays' | 'stable' | 'curvature') => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'unknown' });
  s.fate = fate === 'decays' ? 'decay' : fate;
  s.protonsDecay = fate === 'decays';
  // stop short of η 30, where the neutron stars tell (a slow turn here can be two η long)
  let prev = s.eta;
  for (let g = 0; g < 900 && !s.outcome && s.eta < 29; g++) {
    if (s.eta + 2 * Math.max(s.eta - prev, 0.05) >= 29.8) break;
    prev = s.eta;
    blindTurn(s);
  }
  const f = s.forecasts.find((x) => x.kind === 'crossing');
  return { s, f };
};
const before = (['decays', 'stable', 'curvature'] as const).map(seen);
check(before.every((b) => !fateKnown(b.s)), 'before η 29 none of the three is known (no Proton Question asked)');
/** The first place two values differ, as a path ('' if they are the same). */
function firstDiff(a: unknown, b: unknown, path = ''): string {
  if (a === b) return '';
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return path || '(the whole)';
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
    if (d) return d;
  }
  return '';
}
// nothing the game does, shows or lets the autoplayer see may depend on a fate no one knows yet
const blind = (s: GameState) => JSON.parse(JSON.stringify({ ...s, fate: undefined, protonsDecay: undefined })) as unknown;
const diffs = before.slice(1).map((b) => firstDiff(blind(before[0].s), blind(b.s)));
check(diffs.every((d) => d === ''), `and the three games are the same in everything but the fate itself (${diffs.filter(Boolean).join(', ') || 'no difference'}, η ${before[0].s.eta.toFixed(2)})`);
check(before.every((b) => b.f?.title === 'The end of the Degenerate Age?' && b.f.dueYears === 1e30 && b.f.text === before[0].f?.text), 'the age’s forecast reads the same in all three, due at the earliest date');
for (const b of before) {
  const g = b.s;
  let r: CrossingReport | undefined;
  for (let n = 0; n < 60 && !g.outcome && !fateKnown(g); n++) r = blindTurn(g).crossing ?? r;
  const shown = fateOf(g) === 'decay' ? 'decay_shown' : fateOf(g) === 'curvature' ? 'curvature_shown' : null;
  check(fateKnown(g) && g.eta >= 30, `${fateOf(g)}: known at η ${g.eta.toFixed(2)}${shown ? `, with ${shown}` : ', by the crossing itself'}`);
  if (shown) check(g.pending.some((e) => e.defId === shown) && !r, `its reveal (${shown}) is waiting, and the age goes on (${g.pending.map((e) => e.defId).join(', ')})`);
  else check(r?.title === 'The Last Warmth' && text(r).includes('The question is settled: the protons are stable.'), 'and the Last Warmth says so');
  check(g.forecasts.find((x) => x.kind === 'crossing')?.title !== 'The end of the Degenerate Age?', `the forecast no longer asks (${g.forecasts.find((x) => x.kind === 'crossing')?.title})`);
}
TECH_BY_ID.proton_question.requires = asked;
// ---------------------------------------------------------------- research by fate
const r = newGame({ seed: 1000, protonFate: 'curvature' });
check(techVisible(r, TECH_BY_ID.curvature_harvest) && !techVisible(r, TECH_BY_ID.baryon_decay_harvest) && !techVisible(r, TECH_BY_ID.garden_of_embers), 'curvature: Curvature Harvest, not Decay Harvest, not the stable-only work');
const st = newGame({ seed: 1000, protonFate: 'stable' });
check(!techVisible(st, TECH_BY_ID.curvature_harvest) && techVisible(st, TECH_BY_ID.garden_of_embers), 'stable: the stable-only work, no Curvature Harvest');
done('FATES');
