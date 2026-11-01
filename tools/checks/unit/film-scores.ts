// The films' music (1 Nov, the player: "please improve the music in the vids and dont use the same
// melody for every vid"; and "add a bit of Terminator 1 synth soundtrack energy to the cutscene
// music, not a full style overwhelm, just a bit"). Each film's score (src/film/score.ts):
// - is there, timed as its film is (its tempo and its length), the fate cuts too;
// - has a melody no other film shares: no two films' motifs move by the same first intervals;
// - keeps its melody in its mode, but where a note steps off it on purpose;
// - accents every cut of its film on its beat;
// - begins every event within the film, on a grid of quarter beats from its start or from a cut
//   (the Supernova's and the Last Horizon's own sounds on theirs);
// - keeps few oscillators sounding at once: at most about fifty at full quality, thirty below it
//   (a tablet's medium, by default);
// - has the synth's drive in the darker films (an analog sequencer and a metallic clank), and only
//   a touch of it: several films have neither.
import { FILMS, type FilmId } from '../../../src/film/films';
import { compose, FATE_SCORES, melodyNotes, MODES, mostAtOnce, SCORES, scoreOf, type Score } from '../../../src/film/score';
import { check, done } from '../lib';

const ids = Object.keys(FILMS) as FilmId[];
const all: [string, Score][] = [...ids.map((id) => [id, SCORES[id]] as [string, Score]), ...Object.entries(FATE_SCORES)];

check(ids.every((id) => !!SCORES[id]) && Object.keys(SCORES).length === ids.length, `every film has a score (${ids.length}, the Twilight Interregnum's among them: ${!!SCORES.interregnum})`);
const timed = ids.filter((id) => SCORES[id].bpm !== FILMS[id].bpm || SCORES[id].beats !== FILMS[id].beats);
check(!timed.length, `each score is timed as its film is${timed.length ? `: not ${timed.join(', ')}` : ''}`);
check(scoreOf('last_horizon', 'stable') === FATE_SCORES['last_horizon:stable'] && scoreOf('last_warmth', 'curvature') === FATE_SCORES['last_warmth:curvature'] && scoreOf('dusk', 'stable') === SCORES.dusk, 'a fate cut has its own score, and a film without one keeps its own');

// no two films' melodies alike: the semitone steps of each motif, the first three (or all, if fewer)
const steps = (s: Score) => {
  const st = s.motif.map(([, d, , alt]) => {
    const m = MODES[s.mode];
    const n = m.length;
    return m[((d % n) + n) % n] + 12 * Math.floor(d / n) + (alt ?? 0);
  });
  return st.slice(1).map((x, i) => x - st[i]);
};
const head = new Map<string, string>();
const clash: string[] = [];
for (const id of ids) {
  const k = steps(SCORES[id]).slice(0, 3).join(',');
  for (const [other, ok] of head) if (ok.startsWith(k) || k.startsWith(ok)) clash.push(`${id} and ${other} (${k} / ${ok})`);
  head.set(id, k);
}
check(!clash.length, `no two films share a melody: ${ids.length} motifs, each moving its own way${clash.length ? `; alike: ${clash.join('; ')}` : ''}`);
const keys = new Set(ids.map((id) => `${SCORES[id].tonic.toFixed(2)} ${SCORES[id].mode}`));
check(keys.size >= 12, `and their keys and modes vary (${keys.size} of ${ids.length} distinct)`);

for (const [id, s] of all) {
  const ev = compose(s);
  const beat = 60 / s.bpm;
  // the melody in its mode
  const out = melodyNotes(s).filter((m) => !m.off && !(MODES[s.mode] as readonly number[]).includes(((m.st % 12) + 12) % 12));
  // every cut accented on its beat
  const unaccented = s.cuts.filter((c) => !ev.some((e) => e.cut && Math.abs(e.b - c) < 1e-9));
  // every event within the film, on the grid
  const special = new Set(['thump', 'chirp', 'boom', 'swell']);
  const onGrid = (b: number) => [0, ...s.cuts].some((c) => b >= c - 1e-9 && Math.abs((b - c) * 4 - Math.round((b - c) * 4)) < 1e-6);
  const stray = ev.filter((e) => e.b < 0 || e.b >= s.beats || e.b + e.len > s.beats + 1e-6 || (!special.has(e.v) && !onGrid(e.b)));
  const hi = mostAtOnce(ev, s.bpm);
  const lo = mostAtOnce(ev, s.bpm, true);
  check(
    !out.length && !unaccented.length && !stray.length && hi <= 56 && lo <= 32 && ev.length > 30,
    `${id}: ${ev.length} notes in ${(s.beats * beat).toFixed(1)} s, ${s.mode} on ${s.tonic} Hz; ${s.cuts.length} cuts accented${unaccented.length ? ` (not ${unaccented.join(', ')})` : ''}; melody in its mode${out.length ? ` (not at ${out.map((m) => m.b).join(', ')})` : ''}; ${stray.length ? `${stray.length} off the grid or outside the film (${stray.slice(0, 3).map((e) => `${e.v} at ${e.b}`).join(', ')})` : 'all on the grid'}; at most ${hi} oscillators at once (${lo} below high quality)`,
  );
}

// the synth's drive: in the darker films, and only a touch
const uses = (id: FilmId, v: string) => compose(SCORES[id]).some((e) => e.v === v);
const dark: FilmId[] = ['supernova', 'last_light', 'great_decay', 'last_horizon', 'end_hunger'];
const plain = ids.filter((id) => !uses(id, 'seq') && !uses(id, 'metal') && !uses(id, 'synth'));
check(dark.every((id) => uses(id, 'seq') && uses(id, 'metal')), `the darker films have the sequencer and the clank (${dark.join(', ')})`);
check(plain.length >= 4 && ids.filter((id) => uses(id, 'metal')).length <= 7, `and only a touch: ${plain.length} films have none of the synth (${plain.join(', ')}), ${ids.filter((id) => uses(id, 'metal')).length} the clank`);
check(uses('interregnum', 'seq') && uses('interregnum', 'synth') && !uses('interregnum', 'metal'), 'the Twilight Interregnum: a sequence and the synth lead once, warm, no clank');

done('FILM SCORES');
