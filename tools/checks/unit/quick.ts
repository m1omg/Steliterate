// Quickening splits a new star's clock turns into ten at a quick pace; without it, the clock is as before.
import { starClock, turnStep, livedShare, STAR_SPLIT } from '../../../src/game/sim/flare';
import { endTurn } from '../../../src/game/sim/turn';
import { formatYears } from '../../../src/game/eras';
import { check as ck, done, loadSave } from '../lib';
const check = (what: string, ok: boolean, more = '') => ck(ok, `${what}${more ? `: ${more}` : ''}`);
const load = () => { const s = loadSave('4fe2404-seed1000-turn87-clock.json.gz'); s.pending = []; return s; };

// without Quickening: a quick pace changes nothing while the clock runs
{
  const s = load();
  s.civ.techs = s.civ.techs.filter((t) => t !== 'quickening');
  s.civ.pace = 1;
  const c = starClock(s)!;
  const S = s.civ.flags.star_step;
  check('no Quickening: turn is a whole clock step', Math.abs(turnStep(s).turnLength - S) < S * 1e-9, formatYears(turnStep(s).turnLength));
  check('no Quickening: lived in full', livedShare(s) === 1);
  check('no Quickening: turn of 6', c.of === 6 && c.split === 1, `${c.turn} of ${c.of}`);
}
// with Quickening at Quick x10: sixty short turns, each a tenth
{
  const s = load();
  if (!s.civ.techs.includes('quickening')) s.civ.techs.push('quickening');
  s.civ.pace = 1;
  const c = starClock(s)!;
  const S = s.civ.flags.star_step;
  const until = s.civ.flags.star_until;
  const leftYears = until - s.years;
  check('Quickening: turn is a tenth of a step', Math.abs(turnStep(s).turnLength - S / STAR_SPLIT) < S * 1e-9, formatYears(turnStep(s).turnLength));
  check('Quickening: lived as a tenth', Math.abs(livedShare(s) - 0.1) < 1e-12);
  check('Quickening: turn of 60', c.of === 60 && c.split === 10 && c.left === Math.round(leftYears / (S / 10)), `${c.turn} of ${c.of}, ${c.left} left`);
  const want = c.left;
  let n = 0;
  let switched = false;
  while (starClock(s) && n < 200) {
    // halfway, slow back to the Tide for a turn, then quick again
    if (n === 15 && !switched) { s.civ.pace = 0; switched = true; }
    else if (n === 16) s.civ.pace = 1;
    endTurn(s);
    s.pending = [];
    n++;
  }
  // 15 short turns, one turn back at the Tide spans the rest of its clock turn (or a whole one), then short again
  check('the clock ends exactly as the star burns out', s.years === until, `${s.years.toExponential(10)} vs ${until.toExponential(10)}`);
  check('it took the expected number of turns', n >= want - 10 && n <= want, `${n} turns (${want} at Quick ×10 throughout)`);
  check('no flags left behind', !s.civ.flags.star_until && !s.civ.flags.star_step);
}
done('QUICK');
