// One sea for the Water row and the picture (20 Oct; the player, 16 Oct: "Should show open
// terminator seas", and "'All frozen' water and cold but with visible seas?"). seaBand gives where
// a world's water is liquid by the sine of its star's height in its sky, f: under the star a locked
// world's ground is at its day side's figure, its warmest, and away from it as warm as the starlight
// falling there keeps it, T_day·f^¼, never colder than its night side. The Water row reads the
// band, and the system view draws it (uSeaFrom, uSeaTo).
// - Over a grid of climates the band is exactly where that profile is liquid (273 to 373 K), and
//   the row names it: all frozen, a small sea under its star (less than half the day side), a sea on
//   the day side, a band along the terminator, a sea on the night side, open water, steam.
// - The two worlds of the player's pictures: the super-Earth at 178 to 480 K has a band of sea where
//   its star stands 6° to 21° up; the eyeball at 95 to 224 K is all frozen, with no sea to draw.
// - Our homeworld keeps its open sea on the day side. Bare rock with no air has no band.
import { newGame } from '../../../src/game/newGame';
import { ICE_MELTS_K, SMALL_SEA_FROM, WATER_BOILS_K, bodyClimate, buriedOcean, seaBand, waterState, type BodyClimate } from '../../../src/game/physics';
import type { Body, GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const game = (seed: number) => newGame({ seed, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable', civsAsleep: true }) as GameState;
const profile = (c: BodyClimate, f: number) => (c.day === undefined ? c.mean : Math.max(c.night!, c.day * Math.pow(Math.max(0, f), 0.25)));
const liquid = (k: number) => k >= ICE_MELTS_K && k < WATER_BOILS_K;
const SAMPLES = Array.from({ length: 81 }, (_, i) => -1 + i / 40);
const world = (kind: Body['kind'], water: number) => ({ kind, water, traits: [] }) as unknown as Body;
const row = (c: BodyClimate) => waterState(world('super_earth', 0.4), c).replace(/^40%: /, '');
/** Which text a band should read as. */
const expected = (c: BodyClimate, from: number, to: number) => {
  if (c.day === undefined) return from < -1 && to > 1 ? 'open water' : to < -1 ? 'steam' : 'frozen';
  if (from > 1) return 'all frozen';
  if (to < -1) return 'steam, even on the night side';
  if (from < -1) return to > 1 ? 'open water' : 'boiled off the day side, open sea on the night side';
  if (to > 1) return from > SMALL_SEA_FROM ? 'a small open sea under its star, ice all round it' : 'open sea on the day side, ice beyond the terminator';
  return 'ice on the night side, open water along the terminator, the day side boiled dry';
};

// a grid of climates: locked (night up to day) and turning
let climates = 0;
let wrongBand = 0;
let wrongEdge = 0;
let wrongRow = 0;
const seen = new Set<string>();
for (let night = 40; night <= 460; night += 7) {
  for (let day = night; day <= 900; day += 9) {
    for (const c of [{ mean: (day + night) / 2, day, night }, { mean: day }] as BodyClimate[]) {
      climates++;
      const { from, to } = seaBand(c);
      for (const f of SAMPLES) if (liquid(profile(c, f)) !== (f >= from && f < to)) wrongBand++;
      // its edges are where the profile crosses 273 and 373 K
      if (from > -1 && from <= 1 && Math.abs(profile(c, from) - ICE_MELTS_K) > 1e-6) wrongEdge++;
      if (to > -1 && to <= 1 && Math.abs(profile(c, to) - WATER_BOILS_K) > 1e-6) wrongEdge++;
      const text = row(c);
      seen.add(text);
      if (text !== expected(c, from, to)) wrongRow++;
    }
  }
}
check(wrongBand === 0, `${climates} climates, ${SAMPLES.length} heights of the star each: the band is where the ground is 273 to 373 K (${wrongBand} wrong)`);
check(wrongEdge === 0, `its edges are where the ground crosses 273 and 373 K (${wrongEdge} wrong)`);
check(wrongRow === 0 && seen.size === 9, `the Water row names the band, ${seen.size} ways (${wrongRow} wrong)`);

// the player's two pictures
const superEarth: BodyClimate = { mean: 329, day: 480, night: 178 };
const sb = seaBand(superEarth);
const deg = (f: number) => (Math.asin(f) * 180) / Math.PI;
check(Math.abs(deg(sb.from) - 6) < 0.5 && Math.abs(deg(sb.to) - 21.4) < 0.5 && /open water along the terminator/.test(row(superEarth)), `the super-Earth at 178 to 480 K: open sea where its star stands ${deg(sb.from).toFixed(1)}° to ${deg(sb.to).toFixed(1)}° up ("${row(superEarth)}")`);
const eyeball: BodyClimate = { mean: 160, day: 224, night: 95 };
check(seaBand(eyeball).from > 1 && waterState(world('eyeball', 0.31), eyeball) === '31%: all frozen', `the eyeball at 95 to 224 K: no sea anywhere to draw ("${waterState(world('eyeball', 0.31), eyeball)}")`);
check(seaBand({ mean: 300, day: 400, night: 200, airless: true }).from > 1, 'bare rock with no air: no band');

// real worlds: our homeworld, and how many seas under their star are small
{
  const s = game(1000);
  const home = s.bodies[s.colonies[s.civ.capitalId!].bodyId];
  const c = bodyClimate(s, home);
  const b = seaBand(c);
  check(b.from > 0 && b.from < SMALL_SEA_FROM && b.to > 1 && /open sea on the day side/.test(waterState(home, c)), `${home.name}, ${Math.round(c.night!)} to ${Math.round(c.day!)} K: its sea reaches out to where its star stands ${deg(b.from).toFixed(0)}° up ("${waterState(home, c)}")`);
}
let small = 0;
let caps = 0;
let agree = 0;
let worlds = 0;
for (let seed = 1; seed <= 20; seed++) {
  const s = game(seed);
  for (const b of Object.values(s.bodies)) {
    if (b.kind === 'deep' || b.kind === 'gas_giant' || b.kind === 'ice_giant' || (b.water ?? 0) <= 0.005) continue;
    const c = bodyClimate(s, b);
    const band = seaBand(c);
    worlds++;
    if (c.day !== undefined && band.from > 0 && band.from <= 1 && band.to > 1) {
      caps++;
      if (band.from > SMALL_SEA_FROM) small++;
    }
    if (c.airless || b.kind === 'ocean_ice' || b.kind === 'asteroids' || waterState(b, c, buriedOcean(s, b, c)).includes(expected(c, band.from, band.to))) agree++;
  }
}
check(agree === worlds && caps > 50 && small > 0 && small < caps, `twenty galaxies: ${worlds} worlds with water, each one's Water row naming its band (${worlds - agree} not); ${caps} seas under their star, ${small} of them small`);

done('SEAS');
