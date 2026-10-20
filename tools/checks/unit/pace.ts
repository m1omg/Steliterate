// Which paces change the coming turn, situation by situation.
import { paceMatters } from '../../../src/game/sim/flare';
import { newGame } from '../../../src/game/newGame';
import { check, done, loadSave } from '../lib';
const row = (s: any) => [2, 1, 0, -1, -2].map((p) => (paceMatters(s, p) ? 'o' : '-')).join('');
const expect = (what: string, s: any, want: string) => { const got = row(s); check(got === want, `${what}: ${got} (want ${want}; paces +2 +1 0 −1 −2, o = changes the turn)`); };
// a star clock, without and with Quickening
const s = loadSave('4fe2404-seed1000-turn87-clock.json.gz');
s.civ.techs = s.civ.techs.filter((t) => t !== 'quickening');
expect('star clock, no Quickening', s, '--o--');
s.civ.techs.push('quickening');
expect('star clock, Quickening', s, '-oo--');
// the same moment without the clock
delete s.civ.flags.star_until; delete s.civ.flags.star_step;
// (Slow ×100, a hundred Tide turns, would run on to the end of the age: since 20 Oct no slow turn ends one)
expect('Degenerate Age, no clock', s, 'oooo-');
// a Dusk flare clock: since 20 Oct it keeps its own turns, a sixth of the flare whatever the pace
// (until then a quicker pace cut them shorter, each still paid in full)
const d = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const tide = 40;
d.civ.flags.flare_until = d.years + 6 * tide * 3; d.civ.flags.flare_step = tide * 3;
expect('Dusk, keeping time with a flare (its sixth three Tide turns long): its sixths set the turns', d, '--o--');
// the Dark Era: its calendar will not stretch or shrink a turn more than twofold (its own clock,
// kept on 20 Oct at the player's word when the other ages took the ladder; it now pays the half or
// the two Tide turns a turn covers)
const k = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
k.era = 'dark'; k.eta = 1e5; k.years = Infinity;
expect('Dark Era', k, '-ooo-');
done('PACE');
