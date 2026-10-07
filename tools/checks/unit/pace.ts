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
expect('Degenerate Age, no clock', s, 'ooooo');
// a Dusk flare clock: slower paces than the flare's sixth change nothing
const d = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const tide = 40;
d.civ.flags.flare_until = d.years + 6 * tide * 3; d.civ.flags.flare_step = tide * 3;
expect('Dusk, keeping time with a flare (its sixth three Tide turns long): Slow ×10 reaches it, ×100 no further', d, 'oooo-');
// the Dark Era: its calendar will not stretch or shrink a turn more than twofold
const k = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
k.era = 'dark'; k.eta = 1e5; k.years = Infinity;
expect('Dark Era', k, '-ooo-');
done('PACE');
