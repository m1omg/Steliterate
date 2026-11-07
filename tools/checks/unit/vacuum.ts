// The vacuum, a hidden fate (7 Nov; vacuum.ts). The setting "What of the vacuum?":
// - absent (every game before) or Stable: the lowest there is, nothing ends by it, known;
// - Unknown: a third each of stable, the Higgs field's metastable vacuum and a landscape vacuum,
//   by a hash of the seed (no draw: every seed keeps its galaxy), told by the Vacuum Question;
// - the Higgs vacuum falls early in the Dark Era: Andreassen, Frost & Schwartz's lifetime (10¹⁶¹
//   years, 95%: 10⁶⁵ to 10¹³⁸³) as the wait for a bubble inside our horizon, 10⁶¹³ (10²²⁹ to 10⁵⁵⁰¹);
// - a landscape vacuum falls to its final state between λ 34 and 122, always before the Recurrence;
// - the chance the forecast gives rises every turn, at every length and pace, and is the
//   distribution's, never the hidden date's;
// - the fall ends the game for everyone (Endurance: "The True Vacuum", "The Final State"), after a
//   Work finished that turn and before the Fade and the Recurrence;
// - the False Vacuum event comes only while the vacuum is unknown; the Chronometer's marks follow
//   what is known.
import { deepMilestonesFor, stepTime } from '../../../src/game/eras';
import { EVENT_BY_ID } from '../../../src/game/data/events';
import { TECH_BY_ID } from '../../../src/game/data/techs';
import { newGame } from '../../../src/game/newGame';
import { Rng } from '../../../src/game/rng';
import { checkEndings, workCost } from '../../../src/game/sim/endings';
import { updateForecasts } from '../../../src/game/sim/forecast';
import { completeTech, techVisible } from '../../../src/game/sim/research';
import { endTurn } from '../../../src/game/sim/turn';
import { LANDSCAPE_FROM, LANDSCAPE_TO, VACUUM_ENDING, fallChance, fallQuantile, vacuumFallsAt, vacuumKnown, vacuumOf, zOf } from '../../../src/game/vacuum';
import { hashSeed } from '../../../src/game/rng';
import type { EpochLength, GameState } from '../../../src/game/types';
import { darkGame } from '../darkgame';
import { check, done } from '../lib';

// ---------------------------------------------------------------- the setting
const plain = newGame({ seed: 1000, civsAsleep: true });
check(plain.settings.vacuum === undefined && vacuumOf(plain) === 'stable' && vacuumKnown(plain) && vacuumFallsAt(plain) === Infinity, 'absent, as in every game before: stable, known, never falling');
const galaxy = (g: GameState) => hashSeed(JSON.stringify({ s: g.systems, b: g.bodies, v: g.survivors }, (_k, v) => (v === Infinity ? '__inf' : v)));
check(['higgs', 'landscape', 'unknown'].every((v) => galaxy(newGame({ seed: 1000, civsAsleep: true, vacuum: v as 'higgs' })) === galaxy(plain)), 'the setting changes nothing in the galaxy (no draw is taken)');
const count = { stable: 0, higgs: 0, landscape: 0 };
for (let seed = 0; seed < 900; seed++) count[vacuumOf({ settings: { seed, vacuum: 'unknown' }, civ: { techs: [] } } as unknown as GameState)]++;
check(Object.values(count).every((n) => Math.abs(n - 300) < 45), `unknown: a third each over 900 seeds (${count.stable} stable, ${count.higgs} Higgs, ${count.landscape} landscape)`);

// ---------------------------------------------------------------- the dates
const z = (eta: number) => zOf(Math.log10(eta));
const halfTurn = 0.5 * Math.sqrt(0.0029);
const want: [number, number][] = [[0.025, 228.6], [0.5, 612.6], [0.975, 5500.6]];
for (const [u, eta] of want) {
  const got = Math.pow(10, fallQuantile('higgs', u));
  check(Math.abs(zOf(fallQuantile('higgs', u)) - z(eta)) <= halfTurn, `the Higgs vacuum's ${u * 100}% date near η ${eta} (${got.toFixed(0)}; within half a Tide turn)`);
}
check([0, 0.3, 0.7, 0.999].every((u) => fallQuantile('landscape', u) >= LANDSCAPE_FROM && fallQuantile('landscape', u) < LANDSCAPE_TO), 'a landscape vacuum falls between λ 34 and 122, always before the Recurrence');

// the chance per turn rises, at every length and pace (the Dark Era's paces: half, one or two Tide turns)
for (const length of ['brief', 'standard', 'vast'] as EpochLength[]) {
  for (const pace of [1, 0, -1]) {
    for (const v of ['higgs', 'landscape'] as const) {
      let y = 1e100;
      let e = 100;
      let last = -1;
      let rising = true;
      let n = 0;
      while (Math.log10(e) < 122 && n < 400) {
        const st = stepTime('dark', y, e, pace, length);
        const p = fallChance(v, Math.log10(e), Math.log10(st.eta));
        if (p + 1e-12 < last && last < 0.999) rising = false;
        last = p;
        y = st.years;
        e = st.eta;
        n++;
      }
      check(rising, `${v}, ${length}, pace ${pace}: the chance rises every turn (${n} turns)`);
    }
  }
}

// ---------------------------------------------------------------- the end
{
  const s = darkGame({ vacuum: 'higgs' });
  const at = vacuumFallsAt(s);
  let before = Math.log10(s.eta);
  let n = 0;
  while (!s.civ.outcome && n < 60) {
    before = Math.log10(s.eta);
    s.civ.pending.length = 0;
    s.civ.energy = Math.max(s.civ.energy, 4000);
    s.civ.continuity = 100;
    endTurn(s);
    n++;
  }
  const o = s.civ.outcome;
  check(o?.ending === VACUUM_ENDING.higgs && o.kind === 'endurance' && before < at && Math.log10(s.eta) >= at, `a Higgs game ends as the turn passes its date (λ ${at.toFixed(2)}): ${o?.kind} "${o?.ending}" in Dark turn ${n}, λ ${before.toFixed(2)} to ${Math.log10(s.eta).toFixed(2)}`);
  check(n >= 6 && n <= 18, `early in the Dark Era (turn ${n})`);
}
{
  // a Work finished the turn it falls stands; the fall comes before the Fade
  const s = darkGame({ vacuum: 'landscape' });
  s.eta = Math.pow(10, vacuumFallsAt(s) + 0.01);
  s.civ.works.hibernal_cascade = workCost(s, 'hibernal_cascade');
  check(checkEndings(s)?.kind === 'victory', `a Work finished as it falls stands (${s.civ.outcome?.ending})`);
  const t = darkGame({ vacuum: 'landscape' });
  t.eta = Math.pow(10, vacuumFallsAt(t) + 0.01);
  t.civ.continuity = 0;
  check(checkEndings(t)?.ending === VACUUM_ENDING.landscape, `before the Fade, as it falls in the turn (${t.civ.outcome?.ending})`);
  const u = darkGame({ vacuum: 'landscape' });
  u.eta = Math.pow(10, 122.5);
  check(checkEndings(u)?.ending === VACUUM_ENDING.landscape, 'and always before the Recurrence');
  const v = darkGame();
  v.eta = Math.pow(10, 122.5);
  check(checkEndings(v)?.ending === 'Recurrence', 'a stable vacuum: the Recurrence, as ever');
}

// ---------------------------------------------------------------- what we know of it
{
  const s = darkGame({ vacuum: 'unknown' });
  const q = TECH_BY_ID.vacuum_question;
  check(!vacuumKnown(s) && techVisible(s, q), 'unknown: not known, and the Vacuum Question there to research');
  check(!techVisible(darkGame(), q) && !techVisible(darkGame({ vacuum: 'higgs' }), q), 'chosen: nothing to find out');
  const fv = EVENT_BY_ID.false_vacuum;
  check(!!fv.bind?.(s, new Rng(1)) && !fv.bind?.(darkGame(), new Rng(1)), 'the False Vacuum event only while it is unknown');
  completeTech(s, 'vacuum_question');
  check(vacuumKnown(s) && s.civ.pending.some((p) => p.defId === 'vacuum_answer'), 'the Vacuum Question tells (its answer comes)');
  const higgs = darkGame({ vacuum: 'higgs' });
  updateForecasts(higgs);
  const f = higgs.civ.forecasts.find((x) => x.kind === 'vacuum');
  check(!!f && /this turn/.test(f.title) && /no warning and no defence/.test(f.text), `a known Higgs vacuum: the forecast gives its chance ("${f?.title}")`);
  const st = darkGame();
  updateForecasts(st);
  const un = darkGame({ vacuum: 'unknown' });
  updateForecasts(un);
  check(!st.civ.forecasts.some((x) => x.kind === 'vacuum') && !un.civ.forecasts.some((x) => x.kind === 'vacuum'), 'none where it is stable, or not known');
}
{
  const labels = (v: 'stable' | 'higgs' | 'landscape' | null) => deepMilestonesFor(null, v).map((m) => m.label);
  const unknown = deepMilestonesFor(null, null);
  check(labels(null).includes('Vacuum decay?') && labels(null).includes('The final state?') && /If the vacuum lasts/.test(unknown.find((m) => m.label === 'Recurrence')?.detail ?? ''), 'the Chronometer, not knowing: the Higgs decay, the final state, the Recurrence if the vacuum lasts');
  check(Math.abs((unknown.find((m) => m.label === 'Vacuum decay?')?.at ?? 0) - Math.log10(613)) < 1e-9, 'the Higgs decay where a bubble can reach us, near 10⁶¹³ years (not 10¹⁶¹)');
  check(!labels('stable').some((l) => /vacuum|final state/i.test(l)) && labels('stable').includes('Recurrence'), 'stable: the Recurrence alone');
  check(labels('higgs').includes('The true vacuum (most likely)') && !labels('higgs').includes('Recurrence'), 'the Higgs vacuum: its fall, and no Recurrence');
  check(labels('landscape').includes('The final state (earliest)') && !labels('landscape').includes('Recurrence'), 'a landscape vacuum: its final state, and no Recurrence');
}

done('VACUUM');
