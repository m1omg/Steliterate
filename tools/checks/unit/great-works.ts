// A Great Work that is complete takes nothing more (12 Oct, the player, turn 204: "resume? i
// invested more energy than needed already", the Aeon Seed at 2,122 of 1,700 offering Resume). A
// Work stops once its progress reaches its cost, but its card still offered Resume, and resuming
// poured a turn's insight into it again, as the autoplayer did every turn after finishing one. Now
// a finished Work cannot be resumed, one not finished can be as before, and the Aeon Seed, finished,
// ends the game at the Last Horizon without being the active Work.
// And positronium (η 85, the player: "positronium forming did NOTHING ... no event"): the
// chronometer marked it, and nothing came of it. Now it is news, once, where matter decayed or was
// unmade, never where it is stable; a game already past η 85 hears it at its next turn.
import { newGame } from '../../../src/game/newGame';
import { startWork } from '../../../src/game/sim/actions';
import { autoPlay } from '../../../src/game/auto';
import { checkEndings, workCost } from '../../../src/game/sim/endings';
import { createColony } from '../../../src/game/sim/fleets';
import { endTurn } from '../../../src/game/sim/turn';
import { POSITRONIUM_ETA } from '../../../src/game/eras';
import type { Fate, GameState } from '../../../src/game/types';
import { check, done } from '../lib';

/** A game in the Black Hole Age with the Aeon Seed's condition met: a settlement at the Heart, and the Slow Ones' trust. */
const heartGame = (fate: Fate = 'decay', at = 50): GameState => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: fate === 'decay' ? 'decays' : fate });
  s.era = 'blackhole';
  s.years = Math.pow(10, at);
  s.eta = at;
  s.civ.techs.push('conformal_mathematics');
  const heart = Object.values(s.systems).find((x) => x.special === 'core')!;
  createColony(s, s.bodies[heart.bodies[0]], { coldminds: 4 });
  s.minds.slow.stage = 4;
  s.civ.taint = 0;
  s.civ.energy = 1000;
  return s;
};

// ---------------------------------------------------------------- a finished Work
{
  const s = heartGame();
  const cost = workCost(s, 'aeon_seed');
  check(startWork(s, 'aeon_seed') === null && s.civ.work === 'aeon_seed' && s.civ.energy === 700, 'the Aeon Seed begun, for 300 energy');
  s.civ.work = null;
  s.civ.works.aeon_seed = cost - 100;
  check(startWork(s, 'aeon_seed') === null && s.civ.work === 'aeon_seed' && s.civ.energy === 700, 'not finished: it can be resumed, for nothing more');
  s.civ.work = null;
  s.civ.works.aeon_seed = cost + 422;
  const why = startWork(s, 'aeon_seed');
  check(why !== null && s.civ.work === null && s.civ.energy === 700, `finished (${cost + 422} of ${cost}): it is not resumed (“${why}”)`);
  autoPlay(s, 'competent');
  check(s.civ.work !== 'aeon_seed', `nor by the autoplayer, which resumed it every turn (its Work now: ${s.civ.work ?? 'none'})`);
  const o = checkEndings(s, true);
  check(o?.kind === 'victory' && o.ending === 'The Aeon Seed', `finished and not the active Work, it ends the game at the Last Horizon (${o?.ending})`);
}
{
  const s = heartGame();
  s.civ.works.aeon_seed = workCost(s, 'aeon_seed') + 422;
  s.minds.slow.stage = 0;
  delete s.civ.flags.unlit_gift;
  const o = checkEndings(s, true);
  check(!o, 'without the Slow Ones’ trust it does not (as before)');
}

// ---------------------------------------------------------------- positronium
const heard = (s: GameState) => s.civ.pending.filter((p) => p.defId === 'positronium_forms').length;
const turnFrom = (fate: Fate, at: number) => {
  const s = heartGame(fate, at);
  s.civ.pending.length = 0;
  endTurn(s);
  return s;
};
{
  const before = turnFrom('decay', 80);
  console.log(`  decay, a turn from η 80 to ${before.eta.toFixed(2)}: ${heard(before)}`);
  check(before.eta < POSITRONIUM_ETA && heard(before) === 0, 'decay: no news before η 85');
  const at = turnFrom('decay', POSITRONIUM_ETA - 0.01);
  check(at.eta >= POSITRONIUM_ETA && heard(at) === 1, `decay: the turn that passes η 85 brings it (to η ${at.eta.toFixed(2)})`);
  at.civ.pending.length = 0;
  endTurn(at);
  check(heard(at) === 0, 'once only');
  const late = turnFrom('decay', 90.9);
  check(heard(late) === 1, 'a game already past it (the player’s, at η 90.9) hears it at its next turn');
  const curv = turnFrom('curvature', 86);
  check(heard(curv) === 1, 'curvature radiation: it comes too');
  const stable = turnFrom('stable', 90.9);
  check(heard(stable) === 0, 'stable matter: never (nothing decays, nothing is unmade, no positrons)');
}

done('GREAT WORKS');
