// Events unlocked by technology and by what we have (31 Oct, the player: "The types of random Events
// should be unlocked by technology. (how does one harvest a comet without ships in-systems or an
// orbital shipyard?)", "with the comet the event should happen in player owned systems more often
// imo"; and, asked, "they should fall through no shipyard systems too but player in that case can
// only get research benefits", and of a probe, "It should be able to meet but not haul it").
// - A comet comes only once we know Volatile Shepherding or Orbital Industry, at any star of ours,
//   and the more of them the more often. Shepherding it (Volatile Shepherding, onto a living world
//   of ours there) or mining it (Orbital Industry) needs our ships there that can haul it, or a
//   Shipyard's tugs; a probe can meet it but not haul it. It can always be studied: closer, for
//   more, where any ship of ours meets it. An older save's comet, with no star, falls through the
//   home system.
// - A choice whose technology we lack is greyed out, says what it needs, and is refused.
// - The derelict ark needs a survey ship of ours; the Prophet of Stillness, Cold Sleep; the
//   whispers at the horizon, a Hawking Collector of ours. Drilling deeper into the mantle needs
//   Mantle Stimulation. Of the finds, salvaging sail foil needs Orbital Industry, catching an
//   interstellar shard Fusion Drives, catching a primordial hole's last light Orbital Collectors;
//   mining a diamond mantle and quarrying flare glass need nothing.
import { newGame } from '../../../src/game/newGame';
import { ANOMALY_BY_ID, EVENT_BY_ID, choiceHint, choiceOk } from '../../../src/game/data/events';
import { queueEvent, resolveEvent, rollRandomEvent } from '../../../src/game/sim/events';
import { newFleet } from '../../../src/game/sim/fleets';
import { Rng } from '../../../src/game/rng';
import { colonies } from '../../../src/game/sim/util';
import { copyState } from '../../../src/game/save';
import type { GameState } from '../../../src/game/types';
import { check, done } from '../lib';

const comet = EVENT_BY_ID.comet;
const base = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard', protonFate: 'decays', civsAsleep: true });
base.civ.techs = base.civ.techs.filter((t) => !['comet_shepherding', 'orbital_industry', 'cold_sleep', 'deep_mantle', 'fusion_drives'].includes(t));
const cap = base.colonies[base.civ.capitalId!];
const home = base.systems[cap.systemId];

/** Roll the random pool `n` times from an empty slate; what came, by id (and the comet's stars). */
function rolls(s0: GameState, n: number): { counts: Record<string, number>; stars: Set<string> } {
  const s = copyState(s0);
  const counts: Record<string, number> = {};
  const stars = new Set<string>();
  for (let i = 0; i < n; i++) {
    s.civ.pending = [];
    for (const k of Object.keys(s.civ.fired)) if (k.startsWith('last_')) delete s.civ.fired[k];
    rollRandomEvent(s);
    for (const p of s.civ.pending) {
      counts[p.defId] = (counts[p.defId] ?? 0) + 1;
      if (p.defId === 'comet') stars.add(String(p.data.systemId));
    }
  }
  return { counts, stars };
}

// ---------------------------------------------------------------- the comet
{
  const r = rolls(base, 1500);
  check(!r.counts.comet, `knowing neither Volatile Shepherding nor Orbital Industry, no comet in 1500 rolls (${JSON.stringify(r.counts)})`);
  check(!r.counts.prophet_of_stillness, 'nor the Prophet of Stillness, before Cold Sleep');
}
{
  const s = copyState(base);
  s.civ.techs.push('orbital_industry');
  const homeAt = { systemId: home.id, n: 1 };
  check(comet.bind!(s, new Rng(1))?.systemId === home.id && choiceOk(comet.choices[1], s, homeAt), `with Orbital Industry, a comet at home can be mined: the Shipyard’s tugs haul it (${comet.text(s, homeAt).split('. ').slice(1).join('. ')})`);
  for (const c of colonies(s)) delete c.structures.shipyard;
  for (const f of Object.values(s.fleets)) if (f.owner === s.player) f.ships = f.ships.filter((x) => x.cls === 'probe');
  const probeHint = choiceHint(comet.choices[1], s, homeAt);
  check(!choiceOk(comet.choices[1], s, homeAt) && /Needs our ships \(not a probe\) or a Shipyard there to haul it/.test(probeHint) && /Our probe there can meet it, but not haul it/.test(comet.text(s, homeAt)), `with only survey probes there and no Shipyard, it is met but cannot be mined (${probeHint})`);
  check(choiceOk(comet.choices[2], s, homeAt) && /Insight \+40/.test(choiceHint(comet.choices[2], s, homeAt)), `the probe meets it: studied up close, insight +40 (${choiceHint(comet.choices[2], s, homeAt)})`);
  for (const f of Object.values(s.fleets)) if (f.owner === s.player) f.at = null;
  check(/Insight \+20: watched from afar/.test(choiceHint(comet.choices[2], s, homeAt)) && /nothing there to meet it with/.test(comet.text(s, homeAt)), 'with nothing there, it is watched from afar: insight +20');
  newFleet(s, home.id, ['warden']);
  check(choiceOk(comet.choices[1], s, homeAt) && /Our ships there can meet it, and haul it/.test(comet.text(s, homeAt)), 'a Warden there hauls it: it can be mined');
  // three more settlements of ours, each at its own star: one with a Shipyard, two with nothing
  const free = (sysId: string) => s.systems[sysId].bodies.map((id) => s.bodies[id]).find((b) => b && b.kind !== 'deep' && !b.colonyId && !b.dissolved);
  const others = Object.values(s.systems).filter((x) => x.id !== home.id && !x.gone && free(x.id)).slice(0, 3);
  others.forEach((sys, i) => {
    const b = free(sys.id)!;
    const id = `ev_${i}`;
    s.colonies[id] = { ...structuredClone(cap), id, name: `${b.name} test`, bodyId: b.id, systemId: sys.id, queue: [], structures: i === 0 ? { shipyard: 1 } : {} };
    b.colonyId = id;
  });
  const d = comet.bind!(s, new Rng(5))!;
  check(Number(d.n) === 4 && comet.weigh!(s, d) === 16, `four stars of ours, whatever is there: weight ${comet.weigh!(s, d)}, not ${comet.weight}`);
  const one = copyState(s);
  for (const c of colonies(one)) if (c.id.startsWith('ev_')) {
    one.bodies[c.bodyId].colonyId = null;
    delete one.colonies[c.id];
  }
  const many = rolls(s, 2500);
  const few = rolls(one, 2500);
  check(many.stars.size === 4, `comets fall through every star of ours, a Shipyard there or not: ${[...many.stars].map((id) => s.systems[id].name).join(', ')}`);
  check((many.counts.comet ?? 0) > 1.5 * (few.counts.comet ?? 0) && (few.counts.comet ?? 0) > 0, `and more often with more of them: ${many.counts.comet} comets with four stars, ${few.counts.comet} with one, in 2500 rolls`);
  const bare = { systemId: others[2].id, n: 4 };
  check(!choiceOk(comet.choices[1], s, bare) && choiceOk(comet.choices[2], s, bare), `at ${others[2].name}, with nothing of ours there to haul it, only studying it`);
  const yard = { systemId: others[0].id, n: 4 };
  check(choiceOk(comet.choices[1], s, yard), `at ${others[0].name}, its Shipyard’s tugs haul it`);
  // shepherding: Volatile Shepherding, a hauler, and a living world of ours there
  check(!choiceOk(comet.choices[0], s, yard) && /Needs Volatile Shepherding/.test(choiceHint(comet.choices[0], s, yard)), `to shepherd it: “${choiceHint(comet.choices[0], s, yard)}”`);
  s.civ.techs.push('comet_shepherding');
  check(!choiceOk(comet.choices[0], s, yard) && /none there has life to keep/.test(choiceHint(comet.choices[0], s, yard)), 'at a star where no world of ours has life, it cannot be shepherded, and says why');
  const hw = s.bodies[cap.bodyId];
  check(choiceOk(comet.choices[0], s, homeAt) && choiceHint(comet.choices[0], s, homeAt).includes(hw.name), `at home it can, onto ${hw.name} (${choiceHint(comet.choices[0], s, homeAt)})`);
  queueEvent(s, 'comet', homeAt);
  const p = s.civ.pending.find((x) => x.defId === 'comet')!;
  hw.vitality = 0.6;
  const v = hw.vitality;
  check(resolveEvent(s, p.uid, 0).ok && Math.abs(hw.vitality - Math.min(1, v + 0.05)) < 1e-9, `shepherded: ${hw.name}’s vitality ${(v * 100).toFixed(1)}% → ${(hw.vitality * 100).toFixed(1)}%`);
}
// a choice without its technology is refused
{
  const s = copyState(base);
  queueEvent(s, 'comet', { systemId: home.id, n: 1 });
  const p = s.civ.pending.find((x) => x.defId === 'comet')!;
  const m = s.civ.matter;
  const r = resolveEvent(s, p.uid, 1);
  check(!r.ok && s.civ.matter === m && s.civ.pending.includes(p), `mining it without Orbital Industry is refused (${r.text})`);
  check(resolveEvent(s, p.uid, 2).ok && !s.civ.pending.includes(p), 'studying it needs nothing');
}
// an older save's comet: no star, and none of the technologies
{
  const s = copyState(base);
  s.civ.pending.push({ uid: 'old_comet', defId: 'comet', data: {} });
  const text = comet.text(s, {});
  check(text.includes(home.name) && choiceOk(comet.choices[2], s, {}), `an older save’s comet falls through the home system (${text.slice(0, 60)}…), and can be studied`);
}

// ---------------------------------------------------------------- the others
{
  const s = copyState(base);
  const ark = EVENT_BY_ID.derelict_ark;
  check(ark.bind!(s, new Rng(1)) !== null, 'the derelict ark: found by one of our survey probes');
  for (const f of Object.values(s.fleets)) if (f.owner === s.player) f.ships = f.ships.filter((x) => x.cls !== 'probe');
  check(ark.bind!(s, new Rng(1)) === null, 'with no survey ship, it is not found');
  check(!choiceOk(ark.choices[0], s, {}) && /Needs Fusion Drives/.test(choiceHint(ark.choices[0], s, {})) && !choiceOk(ark.choices[1], s, {}) && choiceOk(ark.choices[2], s, {}), 'bringing them home needs Fusion Drives, salvage Orbital Industry; leaving them sleeping, nothing');
  check(JSON.stringify(EVENT_BY_ID.prophet_of_stillness.tech) === '["cold_sleep"]', 'the Prophet of Stillness needs Cold Sleep');
  const r = rolls(s, 1500);
  s.civ.techs.push('cold_sleep');
  const r2 = rolls(s, 1500);
  check(!r.counts.prophet_of_stillness && (r2.counts.prophet_of_stillness ?? 0) > 0, `before Cold Sleep no prophet in 1500 rolls; after it, ${r2.counts.prophet_of_stillness}`);
  const mantle = EVENT_BY_ID.mantle_settles;
  check(!choiceOk(mantle.choices[0], s, {}) && /Needs Mantle Stimulation/.test(choiceHint(mantle.choices[0], s, {})) && choiceOk(mantle.choices[1], s, {}), 'drilling deeper needs Mantle Stimulation; accepting it, nothing');
  const whispers = EVENT_BY_ID.horizon_whispers;
  check(whispers.bind!(s, new Rng(1)) === null, 'no whispers at the horizon without a Hawking Collector of ours');
  const t = copyState(base);
  t.colonies[t.civ.capitalId!].structures.hawking_collector = 1;
  check(whispers.bind!(t, new Rng(1)) !== null, 'with one, they can come');
  const find = (a: string, label: RegExp) => ANOMALY_BY_ID[a].event.choices.find((c) => label.test(c.label))!;
  const foil = find('sail_graveyard', /Salvage/);
  const shard = find('interstellar_shard', /Catch it/);
  const light = find('primordial_hole', /last light/);
  check(!choiceOk(foil, s, {}) && /Needs Orbital Industry/.test(choiceHint(foil, s, {})), 'salvaging sail foil needs Orbital Industry');
  check(/Needs Fusion Drives/.test(choiceHint(shard, s, {})) && !choiceOk(shard, s, {}), 'catching an interstellar shard, Fusion Drives');
  check(/Needs Orbital Collectors/.test(choiceHint(light, s, {})) && !choiceOk(light, s, {}), 'catching a primordial hole’s last light, Orbital Collectors');
  check(choiceOk(find('diamond_mantle', /Mine it/), s, {}) && choiceOk(find('flare_glass', /Quarry/), s, {}), 'mining a diamond mantle and quarrying flare glass need nothing');
  check(['sail_graveyard', 'interstellar_shard', 'primordial_hole', 'diamond_mantle', 'flare_glass'].every((a) => ANOMALY_BY_ID[a].event.choices.some((c) => !c.tech)), 'and every find can always be studied, or taken as it is');
}
done('EVENT TECH');
