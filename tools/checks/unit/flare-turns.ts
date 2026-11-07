// Keeping time with a flare (1 Nov, the player's game, begun in the Twilight Interregnum, turn 52:
// "No light to draw on right now? what?" under Kekoth's blue flare). Each of its six turns covers
// 620 million years, 0.2% of a Tide turn there (0.4% since 7 Nov, the Interregnum's Tide grown as
// the Dusk's), and pays for that time only; the build list said
// "No light to collect here right now", and the 18 Kin cost 51 energy a turn while it gathered 0.4.
// Asked, the player chose "People cost for the time too" (economy.ts clockShare):
// - in the flare's turns people's upkeep and the labs' draw are for the time a turn covers, as the
//   machines' already were: the turn's net is near nothing, not −51; their work stays a whole turn's;
// - the build list says it is a short turn, the flare's, with what a building gathers now and over a
//   Tide turn (projection.ts littleEnergy), where there is light;
// - any other turn is as before: people cost a whole turn at our pace, quick or not.
import { readSave } from '../../../src/game/save';
import { newGame } from '../../../src/game/newGame';
import { project, structureEffect } from '../../../src/game/sim/projection';
import { clockShare } from '../../../src/game/sim/economy';
import { flareClock } from '../../../src/game/sim/flare';
import { endTurn } from '../../../src/game/sim/turn';
import { colonies } from '../../../src/game/sim/util';
import { check, done } from '../lib';

// (no @types/node here: the few Node APIs used, declared as savecompat does)
declare const process: { getBuiltinModule(id: string): unknown };
const fs = process.getBuiltinModule('node:fs') as { readFileSync(p: string | URL): Uint8Array };
const zlib = process.getBuiltinModule('node:zlib') as { gunzipSync(b: Uint8Array): Uint8Array };

const file = new URL('../../saves/4865f2e-seed794228454-turn52-flare-interregnum-next.json.gz', import.meta.url);
const s = readSave(new TextDecoder().decode(zlib.gunzipSync(fs.readFileSync(file))))!;
const clock = flareClock(s);
const p = project(s);
check(!!clock && clock.turn === 1 && p.ctx.paceFactor < 0.01 && clockShare(p.ctx) === p.ctx.upkeepShare, `the player's game: keeping time with ${clock?.system}'s flare, turn ${clock?.turn} of ${clock?.of}, ${(p.ctx.paceFactor * 100).toPrecision(2)}% of a Tide turn`);
const net = p.energyIn - p.energyOut;
check(Math.abs(net) < 2 && p.industry > 20, `its turn: ${p.energyIn.toFixed(2)} energy in, ${p.energyOut.toFixed(2)} out (it was 0.40 in, 51.17 out), industry ${p.industry.toFixed(1)}, a whole turn's`);
const mer = colonies(s).find((c) => s.bodies[c.bodyId].name === 'Meranuhash II')!;
const solar = structureEffect(s, mer, 'solar_array', p.ctx).notes.join(' ');
check(/^A short turn: we keep time with Kekoth’s flare\. It covers 620 million years, 0\.4% of a Tide turn, and gathers for that time only: \+0\.02 energy now, \+5\.\d over a Tide turn/.test(solar), `a Solar Array at Meranuhash II: "${solar}"`);
// six turns of it: energy barely moves but for the pact's beams; then our own pace again
const e0 = s.civ.energy;
let beamed = 0;
for (let i = 0; i < 6; i++) {
  s.civ.pending.length = 0;
  const n = s.civ.log.length;
  endTurn(s);
  for (const l of s.civ.log.slice(n)) {
    const m = /beamed (\d+) energy|(\d+) energy arrived by beam/.exec(l.text);
    if (m) beamed += m[1] ? -Number(m[1]) : Number(m[2]);
  }
}
check(!flareClock(s) && Math.abs(s.civ.energy - e0 - beamed) < 6, `six turns inside the flare: energy ${e0.toFixed(1)} → ${s.civ.energy.toFixed(1)}, ${beamed} of it beamed by pacts; then our own pace again`);

// ---------------------------------------------------------------- any other turn, as before
const d = newGame({ seed: 1000, civsAsleep: true });
check(clockShare(project(d).ctx) === 1, 'a turn at the Tide: people cost a whole turn');
d.civ.pace = 1;
const q = project(d);
check(q.ctx.paceFactor < 0.2 && clockShare(q.ctx) === 1, `at Quick ×10 (${q.ctx.paceFactor.toFixed(2)} of a Tide turn): still a whole turn's upkeep, the price of quickening`);
done('FLARE TURNS');
