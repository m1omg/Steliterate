// Repealing a charter: it costs what writing it did, turns every Thread's opinion of it around,
// reopens the argument (dissent), is remembered; a windfall does not come twice; repealing the
// Overdrive Protocols ends every overdrive; a dark law cannot be repealed; it all survives a save.
import { CHARTER_BY_ID } from '../../../src/game/data/charters';
import { newGame } from '../../../src/game/newGame';
import { readSave, saveFile } from '../../../src/game/save';
import { charterAvailable, enactCharter, REPEAL_DISSENT, repealAvailable, repealCharter } from '../../../src/game/sim/actions';
import { endTurn } from '../../../src/game/sim/turn';
import { colonies } from '../../../src/game/sim/util';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const fresh = (): GameState => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
  if (!s.civ.techs.includes('the_long_record')) s.civ.techs.push('the_long_record');
  s.civ.accord = 500;
  s.civ.dissent = 20;
  for (const t of Object.keys(s.civ.standing) as (keyof typeof s.civ.standing)[]) s.civ.standing[t] = 50;
  s.pending.length = 0;
  return s;
};

// ---------------------------------------------------------------- what a repeal costs and turns around
const s = fresh();
const civ = s.civ;
const id = 'overdrive_protocols';
const d = CHARTER_BY_ID[id];
check(enactCharter(s, id) === null, `${d.name} enacted`);
for (const c of colonies(s)) c.overdrive = true;
const before = { accord: civ.accord, dissent: civ.dissent, standing: { ...civ.standing }, n: civ.charters.length };
check(repealAvailable(s, id) === null, `${d.name} can be repealed`);
check(repealCharter(s, id) === null, `repealed ${d.name}`);
check(!civ.charters.includes(id) && civ.charters.length === before.n - 1, 'it is out of the book');
check(Math.abs(before.accord - d.cost - civ.accord) < 1e-9, `accord −${d.cost}`);
check(Math.abs(civ.dissent - Math.min(100, before.dissent + REPEAL_DISSENT)) < 1e-9, `dissent +${REPEAL_DISSENT}`);
for (const [t, v] of Object.entries(d.stances)) {
  const k = t as keyof typeof civ.standing;
  const want = Math.max(0, Math.min(100, before.standing[k] - (v ?? 0)));
  check(Math.abs(civ.standing[k] - want) < 1e-9, `${t} standing turned around (${v! > 0 ? '−' : '+'}${Math.abs(v!)})`);
}
check(civ.flags[`repealed_${id}`] === s.turn, 'the repeal is remembered');
check(repealAvailable(s, id) === 'Not in force.', 'a law not in force cannot be repealed');
check(colonies(s).every((c) => !c.overdrive), 'repealing the Overdrive Protocols ends every overdrive');

// ---------------------------------------------------------------- a windfall does not come twice
const w = fresh();
const m0 = w.civ.matter,
  g0 = w.gfe;
check(enactCharter(w, 'salvage_the_dead') === null && Math.abs(w.civ.matter - m0 - 40) < 1e-9, 'Salvage the Dead pays 40 matter the first time');
check(repealCharter(w, 'salvage_the_dead') === null, 'and can be repealed');
const m1 = w.civ.matter,
  g1 = w.gfe;
check(enactCharter(w, 'salvage_the_dead') === null && w.civ.matter === m1 && w.gfe === g1 && g1 < g0, 'enacted again: no second windfall, no second drain');

// ---------------------------------------------------------------- dark laws stay
const k = fresh();
k.civ.techs.push('hunger_studies');
check(charterAvailable(k, 'consume_the_dead') === null && enactCharter(k, 'consume_the_dead') === null, 'a dark law written (Consume the Dead)');
check(repealAvailable(k, 'consume_the_dead') === 'There is no undoing this.', 'a dark law cannot be repealed');

// ---------------------------------------------------------------- the repeal survives saving, loading and a turn
const back = readSave(saveFile(s).text)!;
check(JSON.stringify(back.civ.charters) === JSON.stringify(s.civ.charters) && back.civ.flags[`repealed_${id}`] === s.turn, 'a save round trip keeps the book and the repeal');
endTurn(back);
check(back.turn === s.turn + 1, `a turn plays after the repeal (turn ${back.turn})`);
done('REPEAL');
