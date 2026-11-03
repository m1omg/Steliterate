// The Long Dusk's film at the Last Gas (3 Nov, the player: "please redo the video for the start of the
// long dusk when you start the twilight interregnum. Because it shows you having a home world around
// the red dwarf, even though at that time, if you started at 1 trillion years, your home world would
// be long gone. You would be living on colony worlds"). Until then no film played at the Last Gas.
// - A game begun in the Twilight Interregnum (the turn-48 save in tools/saves/, played on to the
//   Last Gas): the crossing plays the Long Dusk's film, told the game was begun in the Interregnum
//   (its own cut: FilmArgs.begun), the star we were born under a white dwarf by then at the
//   temperature the game gives it, and whether a settlement of ours is still on our first world.
// - A game begun in the Dusk: no such cut, and its crossings' films as before.
import { readSave } from '../../../src/game/save';
import { newGame } from '../../../src/game/newGame';
import { crossingFilm } from '../../../src/film/films';
import { filmArgsOf } from '../../../src/ui/filmArgs';
import { isStarLike } from '../../../src/game/physics';
import { colonies } from '../../../src/game/sim/util';
import { endTurn } from '../../../src/game/sim/turn';
import { check, done } from '../lib';

// (no @types/node here: the few Node APIs used, declared as savecompat does)
declare const process: { getBuiltinModule(id: string): unknown };
const fs = process.getBuiltinModule('node:fs') as { readFileSync(p: string | URL): Uint8Array };
const zlib = process.getBuiltinModule('node:zlib') as { gunzipSync(b: Uint8Array): Uint8Array };

const file = new URL('../../saves/39f855c-seed1000-turn48-interregnum-next.json.gz', import.meta.url);
const s = readSave(new TextDecoder().decode(zlib.gunzipSync(fs.readFileSync(file))))!;
check(s.era === 'interregnum' && !!s.settings.interregnum, `the turn-${s.turn} save, begun in the Twilight Interregnum (${s.era})`);
// on to its last turn, which stops at 9 × 10¹³ years (as unit/interregnum-clock does)
s.years = 8.5e13;
s.eta = Math.log10(s.years);
s.civ.pending.length = 0;
const r = endTurn(s);
check(r.crossing?.title === 'The Last Gas' && s.era === 'dusk', `The Last Gas (${r.crossing?.title}), into the ${s.era}`);
const film = crossingFilm(r.crossing?.title, r.crossing?.to ?? '');
check(film === 'dusk', `it plays the Long Dusk's film (${film}); until 3 Nov, none`);
const args = filmArgsOf(s);
const home = s.systems[s.civ.homeSystemId];
check(args.begun === 'interregnum' && home.primary.kind === 'white_dwarf' && !isStarLike(home.primary), `in the Interregnum's cut: ${home.name}, the star we were born under, a ${home.primary.kind.replace('_', ' ')} (begun: ${args.begun})`);
check(typeof args.homeK === 'number' && args.homeK > 3 && args.homeK < 500, `its temperature as the game has it: ${args.homeK?.toFixed(0)} K (seen by its heat in the film)`);
const onFirst = colonies(s).filter((c) => c.systemId === s.civ.homeSystemId && s.bodies[c.bodyId]?.traits.includes('homeworld'));
check(args.homeLit === onFirst.length > 0, `whether a settlement of ours is still on our first world: ${args.homeLit} (${onFirst.length} there; ${colonies(s).length} settlements in all)`);
// the same with our first world given up: no lights there
for (const c of onFirst) s.bodies[c.bodyId].traits = s.bodies[c.bodyId].traits.filter((t) => t !== 'homeworld');
check(filmArgsOf(s).homeLit === false, 'and none, where none of ours is left there');

// ---------------------------------------------------------------- a game begun in the Dusk
const d = newGame({ seed: 1000, civsAsleep: true });
const da = filmArgsOf(d);
check(da.begun === undefined && da.homeK === undefined && da.homeLit === undefined && da.fate !== undefined, 'a game begun in the Dusk: the film as it always was');
check(crossingFilm('The Last Light', 'degenerate') === 'last_light' && crossingFilm('The Last Horizon', 'dark') === 'last_horizon' && crossingFilm('The Great Decay', 'blackhole') === 'great_decay', 'and the other crossings keep their films');
done('LAST GAS FILM');
