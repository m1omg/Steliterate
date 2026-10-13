// The Lattice thinks a little (the new version, part 2a-5, the player's choice):
// - the Lattice Thread itself yields a little insight and accord (0.3 and 0.1 a Lattice);
// - a Search Foundry turns industry into insight at 4 to 1, a Protocol Registry industry into
//   accord at 10 to 1, each up to its draw a turn, and only where a Lattice is here to run it;
// - without a Lattice they convert nothing, and the settlement's panel says why;
// - neither takes more industry than the settlement has.
import { THREAD_DEFS } from '../../../src/game/data/threads';
import { STRUCTURE_BY_ID } from '../../../src/game/data/structures';
import { newGame } from '../../../src/game/newGame';
import { colonyTurn, moraleMultiplier } from '../../../src/game/sim/economy';
import { computeMods } from '../../../src/game/sim/mods';
import { turnStep } from '../../../src/game/sim/flare';
import { colonies } from '../../../src/game/sim/util';
import { check, done } from '../lib';

check(THREAD_DEFS.lattice.insight === 0.3 && THREAD_DEFS.lattice.accord === 0.1, 'the Lattice yields a little insight and accord of its own (0.3 and 0.1)');
const sf = STRUCTURE_BY_ID.search_foundry;
const pr = STRUCTURE_BY_ID.protocol_registry;
check(sf?.search?.into === 'insight' && sf.search.rate === 0.25 && pr?.search?.into === 'accord' && pr.search.rate === 0.1, 'Search Foundry: industry into insight at 4 to 1; Protocol Registry: into accord at 10 to 1');

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', civsAsleep: true });
const c = colonies(s)[0];
const mods = computeMods(s);
const step = turnStep(s);
const ctx = { mods, years: s.years, L: step.turnLength, logL: Math.log10(step.turnLength), paceFactor: 1 };
const yieldNow = () => colonyTurn(s, c, ctx, 1e9).y;

c.pops.lattice = 0;
const base = yieldNow();
c.structures.search_foundry = 1;
c.structures.protocol_registry = 1;
const unrun = yieldNow();
check(unrun.industry === base.industry && unrun.insight === base.insight && unrun.accord === base.accord, 'with no Lattice here, they turn nothing');
check(unrun.lines.filter((l) => /no Lattice here to run it/.test(l.label)).length === 2, 'and the settlement’s panel says why');

c.pops.lattice = 4;
delete c.structures.search_foundry;
delete c.structures.protocol_registry;
const plain = yieldNow();
c.structures.search_foundry = 1;
c.structures.protocol_registry = 1;
const run = yieldNow();
const took = plain.industry - run.industry;
const sfLine = run.lines.find((l) => /Search Foundry: industry into insight/.test(l.label));
const prLine = run.lines.find((l) => /Protocol Registry: industry into accord/.test(l.label));
console.log(`  industry ${plain.industry.toFixed(2)} -> ${run.industry.toFixed(2)}; insight ${plain.insight.toFixed(2)} -> ${run.insight.toFixed(2)}; accord ${plain.accord.toFixed(2)} -> ${run.accord.toFixed(2)}`);
check(!!sfLine && !!prLine && took > 0, `with the Lattice here, they draw industry (${took.toFixed(2)} a turn)`);
check(Math.abs(-(sfLine?.industry ?? 0) * 0.25 * mods.insightMult - (sfLine?.insight ?? 0)) < 1e-9 && Math.abs(run.insight - plain.insight - (sfLine?.insight ?? 0)) < 1e-9, `the Foundry gives a quarter of what it draws as insight (${(sfLine?.insight ?? 0).toFixed(2)})`);
check(Math.abs(-(prLine?.industry ?? 0) * 0.1 - (prLine?.accord ?? 0)) < 1e-9 && Math.abs(run.accord - plain.accord - (prLine?.accord ?? 0)) < 1e-9, `the Registry a tenth as accord (${(prLine?.accord ?? 0).toFixed(2)})`);
// (its share scales with the settlement's output, as every work's industry does: morale, a waking's bonus)
const out = moraleMultiplier(s) * (s.civ.wakeBonus > 0 ? 1.3 : 1);
check(Math.abs(-(sfLine?.industry ?? 0) - sf.search!.draw * out) < 1e-9 && Math.abs(-(prLine?.industry ?? 0) - pr.search!.draw * out) < 1e-9, `each draws its share a turn and no more (${sf.search!.draw} and ${pr.search!.draw}, ×${out.toFixed(2)} for the settlement’s output)`);

// never more than there is: a settlement whose industry is small gives what it has
c.pops = { kin: 0, echoes: 0, chorus: 0, lattice: 1, coldminds: 0 };
const small = yieldNow();
check(small.industry >= -1e-9, `a settlement with little industry is never driven below none (${small.industry.toFixed(2)})`);
done('LATTICE SEARCH');
