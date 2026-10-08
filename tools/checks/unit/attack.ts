// Warships can go for a swarm (the player's ask, 8 Oct). Every warship of ours at its star fights
// together, at plain strength, once a turn, by the odds the swarm has when it comes for them: a win
// kills 0.3 × the attack and salvages twice that in matter, and breaks it at 0.4 or less; a loss
// tears into every ship there; one asleep wakes unless broken. Only warships; not under the
// Communion Charter; the odds shown are the odds played.
import { newGame } from '../../../src/game/newGame';
import { attack } from '../../../src/game/sim/actions';
import { attackBlocked, attackOdds, warshipsAt } from '../../../src/game/sim/hunger';
import type { Fleet, GameState, Swarm } from '../../../src/game/types';
import { check, done } from '../lib';

const setup = (size: number, awake = true, ships = [{ cls: 'warden', hp: 10 }]) => {
  const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'stable' }) as GameState;
  const sys = Object.values(s.systems).find((x) => x.special !== 'home' && !Object.values(s.swarms).some((w) => w.systemId === x.id) && !Object.values(s.colonies).some((c) => c.systemId === x.id))!;
  const sw: Swarm = { id: 'hgx', systemId: sys.id, from: null, to: null, traveled: 0, distance: 0, size, awake, tamed: false, appetite: 1 };
  s.swarms[sw.id] = sw;
  const f: Fleet = { id: 'fx', name: 'Spear', ships: ships.map((x) => ({ ...x })), at: sys.id, from: null, to: null, traveled: 0, distance: 0, order: 'idle' } as Fleet;
  s.fleets[f.id] = f;
  return { s, sys, sw, f };
};

// a small swarm, sure to lose
{
  const { s, sw, f } = setup(1);
  const odds = attackOdds(warshipsAt(s, f.at!).attack, sw.size);
  const m0 = s.civ.matter;
  const r = attack(s, f.id);
  check(odds === 1 && typeof r !== 'string' && r.ok && !s.swarms[sw.id], `a Warden (attack 3) against a swarm of size 1: ${Math.round(odds * 100)}% to win, and it is broken`);
  check(Math.abs(s.civ.matter - m0 - 2 * Math.min(1, 3 * 0.3)) < 1e-9, `we salvage twice what is killed, 0.3 × the attack, and the rest scatters (+${(s.civ.matter - m0).toFixed(1)} matter)`);
  check(s.fleets[f.id]?.ships[0].hp >= 1, 'the Warden comes through');
}

// a big one: the attack fails and hurts
{
  const { s, sw, f } = setup(8);
  const odds = attackOdds(3, 8);
  const r = attack(s, f.id);
  const hp = s.fleets[f.id]?.ships[0]?.hp ?? 0;
  check(odds === 0 && typeof r !== 'string' && !r.ok && hp < 10 && s.swarms[sw.id]?.size === 8, `a Warden against a swarm of size 8: no chance, and it is hurt (hull ${hp.toFixed(1)} of 10)`);
  check(attackBlocked(s, f.at!) !== null && typeof attack(s, f.id) === 'string', `once a turn: "${attackBlocked(s, f.at!)}"`);
}

// together, and the odds between
{
  const { s, sw, f } = setup(3, true, [{ cls: 'warden', hp: 10 }, { cls: 'warden', hp: 10 }]);
  const other: Fleet = { ...f, id: 'fy', name: 'Shield', ships: [{ cls: 'aegis', hp: 30 }] };
  s.fleets[other.id] = other;
  const { attack: a, fleets } = warshipsAt(s, f.at!);
  check(a === 14 && fleets.length === 2, `every warship of ours at the star fights together: two Wardens and an Aegis, attack ${a}`);
  check(Math.abs(attackOdds(6, 6) - (6 / 7.2 - 0.6) / 0.5) < 1e-12 && attackOdds(6, 4.5) === 1 && attackOdds(6, 8.4) === 0, 'between, the odds of the swarm’s own rule: sure up to attack / 1.32, none past attack / 0.72');
  f.order = 'fortify';
  check(warshipsAt(s, f.at!).attack === 14, 'fortified ships go out at their plain strength');
  void sw;
}

// asleep, it wakes; probes cannot; the Communion forbids it
{
  const { s, sw, f } = setup(6, false);
  attack(s, f.id);
  check(s.swarms[sw.id]?.awake === true, 'a swarm asleep, not broken, wakes');
  const p = setup(1, true, [{ cls: 'probe', hp: 2 }]);
  check(typeof attack(p.s, p.f.id) === 'string', 'a probe cannot attack');
  const c = setup(1);
  c.s.civ.charters.push('communion_charter');
  check(typeof attack(c.s, c.f.id) === 'string' && !!attackBlocked(c.s, c.f.at!), 'under the Communion Charter, no');
}

// many fights: the odds shown are the odds played
{
  let wins = 0;
  const n = 400;
  for (let i = 0; i < n; i++) {
    const { s, f } = setup(3);
    s.rng = 1000 + i * 7919;
    const r = attack(s, f.id);
    if (typeof r !== 'string' && r.ok) wins++;
  }
  const want = attackOdds(3, 3);
  check(Math.abs(wins / n - want) < 0.07, `a Warden against size 3, ${n} fights: won ${Math.round((wins / n) * 100)}%, shown ${Math.round(want * 100)}%`);
}
done('ATTACK');
