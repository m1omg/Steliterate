// Hunger knowledge in trade (the new version, part 2b): a neighbour under 30 Taint never offers
// notes on a Hunger technology, even when that is what we are researching; one on that path may,
// the offer marked, and taking it is a Hunger act of ours (a quarter of the technology's Taint,
// and heard of). A civilization of its own offers notes only on what it knows.
import { newGame } from '../../../src/game/newGame';
import { tradeOffer } from '../../../src/game/sim/dealings';
import { resolveSurvivorSignal } from '../../../src/game/sim/survivors';
import { sendSignal } from '../../../src/game/sim/signals';
import { check, done } from '../lib';

const fresh = () => {
  const s = newGame({ seed: 1000, survivors: 3 });
  const sv = Object.values(s.survivors).find((v) => s.civs[v.id])!;
  for (const t of ['hunger_studies', 'command_language']) {
    if (!s.civ.techs.includes(t)) s.civ.techs.push(t);
    if (!s.civs[sv.id].techs.includes(t)) s.civs[sv.id].techs.push(t);
  }
  s.civs[sv.id].techs.push('hunger_engines');
  s.civ.researching = 'hunger_engines';
  s.civ.matter = 400;
  s.civ.energy = 400;
  Object.assign(sv, { alive: true, contact: true, disposition: 40, health: 0.8 });
  return { s, sv };
};

{
  const { s, sv } = fresh();
  const o = tradeOffer(s, sv);
  check(!o || (o.tech !== 'hunger_engines' && !o.tainted), `under 30 Taint, nothing on Hunger Engines though that is what we research (${o?.techName ? `notes on ${o.techName} instead` : 'no offer: nothing else it knows is open to us'})`);
  check(!o || s.civs[sv.id].techs.includes(o.tech ?? ''), 'and only on what it knows itself');
}
{
  const { s, sv } = fresh();
  s.civs[sv.id].taint = 40;
  const o = tradeOffer(s, sv);
  check(!!o && o.tech === 'hunger_engines' && o.tainted === true, 'one on the Hunger’s path offers its notes on Hunger Engines, marked');
  // we take them
  const taint0 = s.civ.taint;
  const sig = sendSignal(s, { from: sv.id, kind: 'trade', distanceLy: 0, title: 't', text: 't', data: { ask: o!.ask, want: o!.want, insight: o!.insight, tech: o!.tech ?? '', taint: 3 }, choices: [{ id: 'trade', label: 'Trade' }, { id: 'decline', label: 'Decline' }] });
  sig.arrivedTurn = s.turn;
  resolveSurvivorSignal(s, sig.uid, 'trade');
  const heard = Object.values(s.survivors).some((v) => v.news?.some((n) => n.taint === 3 && /took notes on Hunger Engines/.test(n.what)));
  check(s.civ.taint === taint0 + 3 && heard, `taking them is a Hunger act: Taint +3 (a quarter of Hunger Engines’ 12), and heard of (${s.civ.taint - taint0})`);
}
done('HUNGER TRADE');
