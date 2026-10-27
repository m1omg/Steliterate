// The Embers Dim (12 Oct): news only while the halo thins, from η 22.3 until the embers go out at
// η 25, by the halo's own clock. Until then it could come up to η 39: the player's game had it at
// η 35.9, telling them the halo, spent eleven tenfolds before, was "running thin".
import { EVENT_BY_ID } from '../../../src/game/data/events';
import { haloEta } from '../../../src/game/physics';
import type { Rng } from '../../../src/game/rng';
import type { GameState } from '../../../src/game/types';
import { check, done, loadSave } from '../lib';

const SAVE = '9eea773-seed1000-turn119-merger.json.gz'; // seed 1000, Degenerate Age
const ev = EVENT_BY_ID.embers_dim;
const rng = {} as Rng; // its condition draws nothing
const at = (eta: number, drawn = 0): GameState => {
  const s = loadSave(SAVE);
  s.years = Math.pow(10, eta);
  s.eta = eta;
  if (drawn > 0) s.flags.halo_drawn = drawn;
  else delete s.flags.halo_drawn;
  return s;
};
const offered = (s: GameState) => ev.bind!(s, rng) !== null;

check(!offered(at(22)), 'η 22: not yet (the halo has not begun to thin)');
check(offered(at(22.5)) && offered(at(24.9)), 'η 22.5 and 24.9: while the halo thins');
check(!offered(at(25.1)), 'η 25.1: not after the embers have gone out');
check(!offered(at(35.9)), 'η 35.9 (the player’s game, 12 Oct): not, eleven tenfolds after the halo was spent');
check(!offered(at(38.9)), 'η 38.9: not (it could come up to η 39 before)');
{
  // Halo Siphons ran the halo's clock ahead: by our clock η 24.8, by the halo's past 25
  const y = Math.pow(10, 24.8);
  const s = at(24.8, y);
  check(haloEta(s) > 25 && !offered(s), `drawn as far again: the halo’s clock at η ${haloEta(s).toFixed(2)}, past its end: not`);
  const t = at(22.2, Math.pow(10, 22.2));
  check(haloEta(t) > 22.3 && offered(t), `η 22.2 by ours, ${haloEta(t).toFixed(2)} by the halo’s: it thins sooner, and the news comes sooner`);
}

done('EMBERS DIM');
