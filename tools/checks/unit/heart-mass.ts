// The Last Horizon opens with the Heart going (26 Oct, the player: "extend the last horizon cutscene
// with the Heart evaporating as the last BH"), its figures from its own mass: the film is told it
// (`heartMassOf`), from the start of a game and still once the Heart has evaporated (its system kept,
// its kind void), and the Heart is the last hole of all, so its going is the age's end.
import { newGame } from '../../../src/game/newGame';
import { evaporateHole } from '../../../src/game/physics';
import { heartMassOf } from '../../../src/film/films';
import { check, done } from '../lib';

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const heart = Object.values(s.systems).find((x) => x.primary.kind === 'smbh')!;
check(!!heart && heart.name === 'The Heart', 'a game has its Heart');
check(heartMassOf(s) === heart.primary.mass && heart.primary.mass >= 3e8, `the film is told its mass (${heartMassOf(s)?.toExponential(2)} Suns)`);
const last = Object.values(s.systems).filter((x) => x.primary.kind === 'black_hole' || x.primary.kind === 'smbh').sort((a, b) => (b.primary.evaporateAt ?? 0) - (a.primary.evaporateAt ?? 0))[0];
check(last === heart, 'the Heart is the last hole to evaporate');
heart.primary.mass = 4.6e10;
evaporateHole(s, heart);
check(heartMassOf(s) === 4.6e10, 'once it has evaporated, its mass is still told (its system kept, its kind void)');
check(heartMassOf(null) === undefined, 'with no game, none (the film takes the largest it can grow to)');
done('HEART MASS');
