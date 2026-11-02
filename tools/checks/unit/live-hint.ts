// A message's price as it stands now (1 Nov, the player, of a pact offer: "popup says 77, window
// 48 accord"). The offer's Agree said the price of the turn it arrived; each pact made since had
// raised it, and agreeing asked today's (`liveHint`):
// - the hint names today's price, and what we have when it is short;
// - agreeing short of it says the same price; with enough, the pact is made at it;
// - a shared work's yield is today's too.
import { newGame } from '../../../src/game/newGame';
import { liveHint, resolveSurvivorSignal } from '../../../src/game/sim/survivors';
import { pactCost } from '../../../src/game/sim/pacts';
import { sendSignal, deliverSignals } from '../../../src/game/sim/signals';
import { copyState } from '../../../src/game/save';
import { check, done } from '../lib';

const s = copyState(newGame({ seed: 1000, civsAsleep: true }));
const [sv, other] = Object.values(s.survivors);
for (const o of Object.values(s.survivors)) Object.assign(o, { alive: true, contact: true, disposition: 60 });
const hintThen = `The Threads must consent: ${pactCost(s)} accord now (dearer with every pact).`;
sendSignal(s, { from: sv.id, kind: 'pact_offer', distanceLy: 0, title: 'offer', text: 'offer', data: { pact: 'archives' }, choices: [{ id: 'accept', label: 'Agree', hint: hintThen }, { id: 'decline', label: 'Decline' }] });
deliverSignals(s);
const sig = s.civ.signals.find((x) => x.kind === 'pact_offer')!;
s.civ.accord = 500;
check(!!sig && liveHint(s, sig, 'accept') === hintThen, `at first the same: "${liveHint(s, sig, 'accept')}"`);
// two pacts made since, with another
other.pacts = { aid: s.turn, watch: s.turn };
const now = pactCost(s);
s.civ.accord = now - 5;
const hint = liveHint(s, sig, 'accept')!;
check(now > Number(/(\d+) accord/.exec(hintThen)![1]) && hint.includes(`${now} accord now`) && hint.includes(`we have ${now - 5}`), `two pacts later: "${hint}" (it came saying ${/(\d+) accord/.exec(hintThen)![1]})`);
const err = resolveSurvivorSignal(s, sig.uid, 'accept');
check(err === `Needs ${now} accord.` && !sig.resolved, `agreeing short of it says the same price (${err})`);
s.civ.accord = now + 1;
check(!liveHint(s, sig, 'accept')!.includes('we have') && resolveSurvivorSignal(s, sig.uid, 'accept') === null && s.civ.accord === 1 && sv.pacts?.archives !== undefined, 'with enough, the pact is made at that price');
check(liveHint(s, { kind: 'trade', from: sv.id }, 'trade') === null, 'a fixed trade keeps its own words');
done('LIVE HINT');
