// A message from a neighbour gone since it was sent (31 Oct; the audit of that day, the player: "the
// bug: answering a message from a civilization that’s already gone still has effects"). An answer
// that would reach them cannot be given, and says why; the others close the message and do
// nothing. Before: their refugees still came with +3 resolve, a shared work still cost 60 matter,
// a trade still cost and still delivered its notes, and refusing the Choir still cost the Echoes'
// standing. While they live, each answers as before.
import { newGame } from '../../../src/game/newGame';
import { goneAnswer, resolveSurvivorSignal } from '../../../src/game/sim/survivors';
import { sendSignal } from '../../../src/game/sim/signals';
import { totalPops } from '../../../src/game/sim/util';
import type { GameState, Survivor } from '../../../src/game/types';
import { copyState } from '../../../src/game/save';
import { check, done } from '../lib';

const base = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
base.civ.energy = 300;
base.civ.matter = 300;
base.civ.resolve = 50;
base.civ.standing.echoes = 50;
const c0 = base.colonies[base.civ.capitalId!];
c0.pops.echoes = 4;
base.civ.researching = 'fusion';

const KINDS: { kind: string; reach: string; other: string; data?: Record<string, string | number> }[] = [
  { kind: 'refugees', reach: 'accept', other: 'refuse', data: { n: 2 } },
  { kind: 'joint', reach: 'join', other: 'decline' },
  { kind: 'trade', reach: 'trade', other: 'decline', data: { ask: 40, want: 'matter', insight: 50, tech: '' } },
  { kind: 'choir_wish', reach: 'let', other: 'keep' },
  { kind: 'aid', reach: 'give', other: 'refuse', data: { ask: 30 } },
];
const setup = (kind: string, data: Record<string, string | number> | undefined, alive: boolean) => {
  const s: GameState = copyState(base);
  const sv: Survivor = Object.values(s.survivors)[0];
  Object.assign(sv, { alive, contact: true, way: kind === 'choir_wish' ? 'chorus' : 'garden', health: 0.8, pop: 24, disposition: 40 });
  const sig = sendSignal(s, { from: sv.id, kind, title: kind, text: '', distanceLy: 0, data, choices: [{ id: 'a', label: 'a' }] });
  sig.arrivedTurn = s.turn;
  return { s, sv, sig };
};
const look = (s: GameState, sv: Survivor) => JSON.stringify({ e: s.civ.energy, m: s.civ.matter, r: s.civ.resolve, st: s.civ.standing, pops: totalPops(s), ins: s.civ.research, mem: sv.memory?.length ?? 0, marks: sv.marks ?? {} });

for (const k of KINDS) {
  // gone: the answer that reaches them is refused, and says why
  {
    const { s, sv, sig } = setup(k.kind, k.data, false);
    const was = look(s, sv);
    const err = resolveSurvivorSignal(s, sig.uid, k.reach);
    check(/^They are gone: /.test(err ?? '') && !sig.resolved && look(s, sv) === was && goneAnswer(s, sig, k.reach) === err, `${k.kind}, gone: “${k.reach}” cannot be given (${err})`);
    const err2 = resolveSurvivorSignal(s, sig.uid, k.other);
    check(err2 === null && sig.resolved === k.other && look(s, sv) === was && goneAnswer(s, sig, k.other) === null, `${k.kind}, gone: “${k.other}” closes it and changes nothing`);
  }
  // alive: the answer that reaches them still does what it did
  {
    const { s, sv, sig } = setup(k.kind, k.data, true);
    const was = look(s, sv);
    const err = resolveSurvivorSignal(s, sig.uid, k.reach);
    check(err === null && sig.resolved === k.reach && look(s, sv) !== was && goneAnswer(s, sig, k.reach) === null, `${k.kind}, alive: “${k.reach}” is given as before`);
  }
}
done('GONE ANSWERS');
