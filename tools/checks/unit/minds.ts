// Minds of their own (the new version, part 2a-5): each of the other civilizations plays its way.
// - Its temperament (caution, generosity, ambition) comes from the seed and its id, never the dice.
// - Each way learns its own first, as soon as it can, and builds toward its own Great Work only.
// - The sleepers sleep the Long Sleep through hard times; a new star near them wakes them, they
//   send an Ark for it, and we hear that they are on their way, if we know them.
// - A Thread that forks from another civilization leaves it, and becomes no neighbour of ours.
import { WAY_RESEARCH, WAY_WORK, autoPlay } from '../../../src/game/auto';
import { WORK_BY_ID } from '../../../src/game/data/works';
import { asCiv } from '../../../src/game/civs';
import { newGame } from '../../../src/game/newGame';
import { GIANT_LIFE } from '../../../src/game/physics';
import { turnStep } from '../../../src/game/sim/flare';
import { logTurnLength } from '../../../src/game/eras';
import { newFleet } from '../../../src/game/sim/fleets';
import { availableTechs } from '../../../src/game/sim/research';
import { voiceClock } from '../../../src/game/sim/signals';
import { fork } from '../../../src/game/sim/society';
import { heardWaking } from '../../../src/game/sim/ways';
import { allFleets, coloniesOf, distLy, popsOf, temperament } from '../../../src/game/sim/util';
import { check, done } from '../lib';

const fresh = (seed: number) => newGame({ seed, survivors: 3 });

// ---- temperament
{
  const s = fresh(1000);
  const rng0 = s.rng;
  const ids = Object.keys(s.survivors);
  const all = ids.map((id) => temperament(s, id));
  const again = ids.map((id) => temperament(fresh(1000), id));
  check(JSON.stringify(all) === JSON.stringify(again) && s.rng === rng0, 'each one’s temperament comes from the seed and its id, never the dice');
  check(
    all.every((t) => [t.caution, t.generosity, t.ambition].every((x) => x >= 0 && x <= 1)) && new Set(all.map((t) => JSON.stringify(t))).size === all.length,
    `and differs from one to the next (${all.map((t) => `caution ${t.caution.toFixed(2)}, generosity ${t.generosity.toFixed(2)}, ambition ${t.ambition.toFixed(2)}`).join('; ')})`,
  );
}

// ---- each way's own research and Great Work
{
  let n = 0;
  const wrong: string[] = [];
  for (const seed of [1000, 8919, 80190, 88109, 2, 7]) {
    const s = fresh(seed);
    for (const sv of Object.values(s.survivors)) {
      if (!s.civs[sv.id]) continue;
      asCiv(s, sv.id, () => {
        const lead = WAY_RESEARCH[sv.way].find((id) => availableTechs(s).some((t) => t.id === id));
        s.civ.researching = null;
        autoPlay(s, 'competent');
        if (!lead) return;
        n++;
        // (with a swarm near, defence comes first)
        if (s.civ.researching !== lead && !s.civ.techs.includes(lead) && s.civ.researching !== 'orbital_defense') wrong.push(`${sv.name}: ${s.civ.researching} before ${lead}`);
      });
    }
  }
  check(n > 0 && wrong.length === 0, `each way learns its own first, as soon as it can (${n - wrong.length} of ${n})${wrong.length ? ': ' + wrong.join('; ') : ''}`);
  const works = Object.entries(WAY_WORK).filter(([, w]) => w);
  check(works.every(([, w]) => !!WORK_BY_ID[w!]), `and builds toward its own Great Work: ${works.map(([way, w]) => `${way}, ${WORK_BY_ID[w!].ending}`).join('; ')}`);
}

// ---- the sleepers
{
  const s = fresh(8919);
  const sv = Object.values(s.survivors).find((v) => v.way === 'dormant' && s.civs[v.id]);
  check(!!sv, 'seed 8919 has the sleepers');
  if (sv) {
    const civ = s.civs[sv.id];
    for (const t of ['hibernation_protocols', 'fusion_drives']) if (!civ.techs.includes(t)) civ.techs.push(t);
    civ.energy = 20;
    civ.flags.last_energy_net = -4;
    asCiv(s, sv.id, () => autoPlay(s, 'competent'));
    check(civ.dormant && civ.sleepTurns === 8, `in hard times, the reserve running out, they sleep the Long Sleep through them (${civ.sleepTurns} turns)`);
    // a new star lights near them, with a cold world by it
    const home = s.systems[sv.homeSystemId];
    const sys = Object.values(s.systems)
      .filter((x) => x.id !== home.id && !x.special && !x.gone && distLy(x, home) <= 100 && !Object.values(s.colonies).some((c) => c.systemId === x.id))
      .sort((a, b) => distLy(a, home) - distLy(b, home))[0];
    sys.primary.kind = 'helium_giant';
    sys.primary.bornAt = s.years;
    sys.primary.diesAt = s.years + GIANT_LIFE;
    const b = sys.bodies.map((id) => s.bodies[id]).find((x) => x && !x.dissolved && x.kind !== 'deep');
    if (b) b.kind = 'ice';
    civ.energy = 400;
    civ.matter = 300;
    const cap = s.colonies[civ.capitalId!];
    cap.structures.shipyard = Math.max(1, cap.structures.shipyard ?? 0);
    asCiv(s, sv.id, () => autoPlay(s, 'competent'));
    check(!civ.dormant && cap.queue[0]?.key === 'ark', `a new star lights at ${sys.name}: they wake, and an Ark for it goes to the front of the queue`);
    // the Ark built, it sets out
    asCiv(s, sv.id, () => {
      cap.queue.length = 0;
      newFleet(s, cap.systemId, ['ark']);
      autoPlay(s, 'competent');
    });
    const ark = allFleets(s).find((f) => f.owner === sv.id && f.ships.some((x) => x.cls === 'ark'));
    check(ark?.to === sys.id && ark.order === 'colonize', `the Ark sets out for it (${ark?.to === sys.id ? 'to ' + sys.name : ark?.to ? 'to ' + s.systems[ark.to].name : 'nowhere'})`);
    // and we hear of it, if we know them and can talk
    sv.contact = true;
    sv.clock = voiceClock(s, logTurnLength(turnStep(s)));
    check(heardWaking(s, sv) && s.civ.signals.some((x) => x.kind === 'woken' && x.from === sv.id), 'we hear that they have woken, and are on their way');
    check(!heardWaking(s, sv), 'once, not every turn');
  }
}

// ---- a fork
{
  const s = fresh(1000);
  const sv = Object.values(s.survivors).find((v) => s.civs[v.id] && coloniesOf(s, v.id).some((c) => c.pops.kin >= 3));
  check(!!sv, 'a civilization with Kin to fork');
  if (sv) {
    const before = Object.keys(s.survivors).length;
    const people = () => coloniesOf(s, sv.id).reduce((a, c) => a + popsOf(c), 0);
    const p0 = people();
    asCiv(s, sv.id, () => fork(s, 'kin'));
    check(people() < p0 && Object.keys(s.survivors).length === before, `a Thread that forks from another civilization leaves it (${p0} people, then ${people()}), and becomes no neighbour of ours`);
  }
}
done('MINDS');
