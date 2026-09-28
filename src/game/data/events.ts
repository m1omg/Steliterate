import type { Rng } from '../rng';
import type { Body, Colony, EraId, GameState, ThreadId } from '../types';
import { capital, colonies, hasCharter, hasTech, log, threadTotals, uid } from '../sim/util';
import { FLARE_TURNS, SCORCH_K, SHELTER_CAP, SHELTER_MATTER, digShelters, keepTimeWithFlare, sheltersNeeded } from '../sim/flare';

// Narrative events. Many are moral: triage, sacrifice, trust. Effects are small and legible;
// the text carries the weight.

export type EventData = Record<string, string | number>;

export interface EventChoice {
  label: string;
  hint?: string;
  ok?: (s: GameState, d: EventData) => boolean;
  run: (s: GameState, d: EventData, rng: Rng) => string | void;
}

export interface EventDef {
  id: string;
  title: string;
  art: 'dusk' | 'degenerate' | 'blackhole' | 'dark' | 'flare' | 'ruins' | 'hunger' | 'sleepers' | 'survivor' | 'slow' | `finds/${string}`;
  eras?: EraId[];
  weight?: number; // random pool weight (0 or undefined = scripted only)
  once?: boolean;
  bind?: (s: GameState, rng: Rng) => EventData | null;
  text: (s: GameState, d: EventData) => string;
  choices: EventChoice[];
}

// ---------------------------------------------------------------- helpers

const res = (s: GameState, n: number) => (s.civ.resolve = Math.max(0, Math.min(100, s.civ.resolve + n)));
const dis = (s: GameState, n: number) => (s.civ.dissent = Math.max(0, Math.min(100, s.civ.dissent + n)));
const stand = (s: GameState, t: ThreadId, n: number) => (s.civ.standing[t] = Math.max(0, Math.min(100, s.civ.standing[t] + n)));
const energy = (s: GameState, n: number) => (s.civ.energy = Math.max(0, s.civ.energy + n));
const matter = (s: GameState, n: number) => (s.civ.matter = Math.max(0, s.civ.matter + n));
const accord = (s: GameState, n: number) => (s.civ.accord = Math.max(0, s.civ.accord + n));
const insight = (s: GameState, n: number) => {
  const c = s.civ;
  if (c.researching) c.research[c.researching] = (c.research[c.researching] ?? 0) + n;
  else c.flags.insight_bank = (c.flags.insight_bank ?? 0) + n;
};
const taint = (s: GameState, n: number) => (s.civ.taint = Math.max(0, Math.min(100, s.civ.taint + n)));

function shelterNote(r: { built: number; missing: number }): string {
  if (!r.built && !r.missing) return 'Everyone already has somewhere to go.';
  const built = r.built ? `${r.built} night-side shelter${r.built === 1 ? ' is' : 's are'} being cut into the rock.` : 'We could not pay for a single shelter.';
  return r.missing ? `${built} We could not pay for ${r.missing} more.` : built;
}

function homeworld(s: GameState): Body | undefined {
  return Object.values(s.bodies).find((b) => b.traits.includes('homeworld'));
}
function colonyById(s: GameState, d: EventData): Colony | undefined {
  return s.colonies[String(d.colonyId)];
}
function bodyById(s: GameState, d: EventData): Body | undefined {
  return s.bodies[String(d.bodyId)];
}
function anyColonyWith(s: GameState, t: ThreadId): Colony | undefined {
  return colonies(s).find((c) => c.pops[t] > 0);
}

// ---------------------------------------------------------------- events

export const EVENTS: EventDef[] = [
  // ============================================================ scripted openings
  {
    id: 'dynamo_fails',
    title: 'The Dynamo Falters',
    art: 'dusk',
    eras: ['dusk'],
    once: true,
    text: (s) =>
      `The magnetic field of ${homeworld(s)?.name ?? 'the homeworld'} dropped by a third in a single generation. The core is freezing from the inside, and without its field the red sun’s wind is taking the air a little more each year. The engineers say the decline will speed up. The Commons wants to know what we will do.`,
    choices: [
      { label: 'Throw everything at a shield', hint: 'Research toward Magnetospheric Engineering jumps ahead. Resolve +2.', run: (s) => { s.civ.research.magnetospherics = (s.civ.research.magnetospherics ?? 0) + 30; if (!s.civ.researching) s.civ.researching = 'magnetospherics'; res(s, 2); } },
      { label: 'Start digging down', hint: 'Research toward Deep Warrens jumps ahead. Kin standing −2.', run: (s) => { s.civ.research.subterranean_cities = (s.civ.research.subterranean_cities ?? 0) + 40; if (!s.civ.researching) s.civ.researching = 'subterranean_cities'; stand(s, 'kin', -2); } },
      { label: 'Hold a vigil for the sky', hint: 'Resolve +5, Accord −5.', run: (s) => { res(s, 5); accord(s, -5); } },
    ],
  },
  {
    id: 'first_night',
    title: 'Counting the Dark',
    art: 'dusk',
    eras: ['dusk'],
    once: true,
    text: () =>
      'The observatory published its census. Of the stars that lit our sky when the Record began, one in three is gone, dimmed to cold white dwarfs or never there at all: brown dwarfs that never lit, corpses of stars older than memory. The rest are red dwarfs, all of them old. For the first time the whole sky is being counted as something that ends.',
    choices: [
      { label: 'Publish it plainly', hint: 'Resolve −3, Insight +40, Dissent −3.', run: (s) => { res(s, -3); insight(s, 40); dis(s, -3); } },
      { label: 'Publish it with hope', hint: 'Resolve +3, Dissent +2.', run: (s) => { res(s, 3); dis(s, 2); } },
    ],
  },

  // ============================================================ Dusk: the dying world
  {
    id: 'superflare',
    title: 'Superflare',
    art: 'flare',
    eras: ['dusk'],
    weight: 6,
    bind: (s) => {
      const hw = homeworld(s);
      if (!hw || hw.dissolved || !hw.colonyId) return null;
      const sys = s.systems[hw.systemId];
      if (sys.primary.kind !== 'red_dwarf') return null;
      return { colonyId: hw.colonyId };
    },
    text: () => 'The red sun threw off a superflare, a ten-minute blaze brighter than the whole star. On the day side, the thin air glowed. Sensors failed across the terminator, and the auroras reached the equator.',
    choices: [
      { label: 'Everyone underground', hint: 'Energy −12 (−4 with the flare record). The world is spared the worst.', run: (s, d) => { energy(s, s.civ.flags.flare_warning ? -4 : -12); const c = colonyById(s, d); if (c) { const b = s.bodies[c.bodyId]; b.vitality = Math.max(0, b.vitality - 0.01); } } },
      { label: 'Keep the collectors running', hint: 'Energy +18, vitality −4%, resolve −2.', run: (s, d) => { energy(s, 18); res(s, -2); const c = colonyById(s, d); if (c) { const b = s.bodies[c.bodyId]; b.vitality = Math.max(0, b.vitality - 0.04); } } },
    ],
  },
  {
    id: 'last_rain',
    title: 'The Last Rain',
    art: 'dusk',
    eras: ['dusk'],
    once: true,
    weight: 10,
    bind: (s) => {
      const hw = homeworld(s);
      return hw && !hw.dissolved && hw.vitality < 0.55 && hw.colonyId ? { colonyId: hw.colonyId } : null;
    },
    text: (s) => `It rained in the terminator cities of ${homeworld(s)?.name}. The climatologists are certain it will not rain there again. People went out without shelters, just to stand in it.`,
    choices: [
      { label: 'Record it, every drop', hint: 'Resolve +4, Kin standing +3.', run: (s) => { res(s, 4); stand(s, 'kin', 3); } },
      { label: 'Capture the water', hint: 'Matter +25. Kin standing −2.', run: (s) => { matter(s, 25); stand(s, 'kin', -2); } },
    ],
  },
  {
    id: 'sea_freezes',
    title: 'The Sea Freezes Over',
    art: 'dusk',
    eras: ['dusk'],
    once: true,
    weight: 10,
    bind: (s) => {
      const hw = homeworld(s);
      return hw && !hw.dissolved && hw.vitality < 0.32 && hw.colonyId ? { colonyId: hw.colonyId } : null;
    },
    text: () => 'The substellar sea, the eye of our world, the one place that was always warm, has a skin of ice across it for the first time. Heating it would take energy we may need elsewhere.',
    choices: [
      { label: 'Keep the sea open', hint: 'Energy −35, vitality +6%, Kin standing +6.', run: (s, d) => { energy(s, -35); stand(s, 'kin', 6); const c = colonyById(s, d); if (c) { const b = s.bodies[c.bodyId]; b.vitality = Math.min(1, b.vitality + 0.06); } } },
      { label: 'Let it close', hint: 'Resolve −4.', run: (s) => { res(s, -4); } },
      { label: 'Open the Commons and talk about it', hint: 'Accord −6, Dissent −6.', run: (s) => { accord(s, -6); dis(s, -6); } },
    ],
  },
  {
    id: 'who_sleeps_first',
    title: 'Who Sleeps First',
    art: 'dusk',
    eras: ['dusk', 'degenerate'],
    weight: 5,
    bind: (s) => {
      const c = colonies(s).find((x) => x.starving > 0 && x.pops.kin > 1 && (x.structures.cryo_hall ?? 0) > 0);
      return c ? { colonyId: c.id } : null;
    },
    text: (s, d) => `${colonyById(s, d)?.name} cannot feed everyone this winter. The cryo halls can take some of them. Someone has to decide who goes to sleep first.`,
    choices: [
      { label: 'The children', hint: 'They wake to a better time, maybe. 2 Kin to Cold Sleep. Kin standing −4.', run: (s, d) => { const c = colonyById(s, d); if (c) { const n = Math.min(2, c.pops.kin); c.pops.kin -= n; c.cryo += n; } stand(s, 'kin', -4); } },
      { label: 'The elders', hint: '2 Kin to Cold Sleep. Resolve −3.', run: (s, d) => { const c = colonyById(s, d); if (c) { const n = Math.min(2, c.pops.kin); c.pops.kin -= n; c.cryo += n; } res(s, -3); } },
      { label: 'Draw lots', hint: '2 Kin to Cold Sleep. Accord −4, Dissent −3.', run: (s, d) => { const c = colonyById(s, d); if (c) { const n = Math.min(2, c.pops.kin); c.pops.kin -= n; c.cryo += n; } accord(s, -4); dis(s, -3); } },
    ],
  },
  {
    id: 'mantle_settles',
    title: 'The Mantle Settles',
    art: 'dusk',
    eras: ['dusk'],
    weight: 4,
    bind: (s) => {
      const hw = homeworld(s);
      return hw && hw.coreHeat > 0.25 && hw.colonyId ? { colonyId: hw.colonyId } : null;
    },
    text: () => 'Deep sensors registered a slow shudder: a whole layer of the mantle has crystallised. The geothermal taps are running cooler.',
    choices: [
      { label: 'Drill deeper', hint: 'Matter −20; core heat recovers a little.', run: (s) => { matter(s, -20); const hw = homeworld(s); if (hw) hw.coreHeat = Math.min(1, hw.coreHeat + 0.05); } },
      { label: 'Accept it', hint: 'Core heat −0.08.', run: (s) => { const hw = homeworld(s); if (hw) hw.coreHeat = Math.max(0, hw.coreHeat - 0.08); } },
    ],
  },
  {
    id: 'derelict_ark',
    title: 'A Derelict Ark',
    art: 'ruins',
    eras: ['dusk', 'degenerate'],
    weight: 3,
    once: true,
    text: () => 'A probe found an ark drifting between stars. It is older than our species and its engines are cold. Inside, in racks of failing cryo berths, something is still alive.',
    choices: [
      { label: 'Wake them and bring them home', hint: '+2 Kin at the capital. Resolve +3. They are strangers.', run: (s) => { const c = capital(s); if (c) c.pops.kin += 2; res(s, 3); stand(s, 'kin', -1); } },
      { label: 'Salvage the ship', hint: 'Matter +60. Resolve −2.', run: (s) => { matter(s, 60); res(s, -2); } },
      { label: 'Leave them sleeping', hint: 'Nothing changes.', run: () => {} },
    ],
  },
  {
    id: 'comet',
    title: 'A Wandering Comet',
    art: 'dusk',
    eras: ['dusk'],
    weight: 3,
    text: () => 'A long-period comet is falling through the home system, full of ices from the old outer dark.',
    choices: [
      { label: 'Shepherd it to the homeworld', hint: 'Energy −20, homeworld vitality +5%.', ok: (s) => !!homeworld(s)?.colonyId, run: (s) => { energy(s, -20); const hw = homeworld(s); if (hw) hw.vitality = Math.min(1, hw.vitality + 0.05); } },
      { label: 'Mine it', hint: 'Matter +40.', run: (s) => { matter(s, 40); } },
    ],
  },
  {
    id: 'prophet_of_stillness',
    title: 'The Prophet of Stillness',
    art: 'dusk',
    eras: ['dusk', 'degenerate'],
    weight: 3,
    once: true,
    text: () => 'A preacher is drawing crowds: we should all go to sleep, forever, in the vaults, and stop spending the future on the present. Thousands have signed the petition.',
    choices: [
      { label: 'Let the idea spread', hint: 'Coldminds and Echoes standing +5, Kin −3. You can slow one step further than research allows (pace).', run: (s) => { stand(s, 'coldminds', 5); stand(s, 'echoes', 5); stand(s, 'kin', -3); s.civ.flags.stillness = 1; } },
      { label: 'Argue it out in the Commons', hint: 'Accord −8, Dissent −4.', run: (s) => { accord(s, -8); dis(s, -4); } },
      { label: 'Ban the petition', hint: 'Kin standing +5, Resolve +3: nobody is going to sleep forever. Dissent +8, Echoes and Coldminds standing −3.', run: (s) => { stand(s, 'kin', 5); res(s, 3); dis(s, 8); stand(s, 'echoes', -3); stand(s, 'coldminds', -3); } },
    ],
  },

  // ============================================================ minds and meaning
  {
    id: 'first_upload',
    title: 'The First Upload',
    art: 'dusk',
    eras: ['dusk'],
    once: true,
    weight: 12,
    bind: (s) => (hasTech(s, 'upload') ? {} : null),
    text: () => 'A dying poet has asked to be the first. The clinic is ready. Half the Commons calls it a door; the other half calls it a grave with a voice.',
    choices: [
      { label: 'Let her go through', hint: '+1 Echo at the capital. Echoes standing +5, Kin −3.', run: (s) => { const c = capital(s); if (c) c.pops.echoes += 1; stand(s, 'echoes', 5); stand(s, 'kin', -3); } },
      { label: 'Make it a public ceremony', hint: '+1 Echo. Accord −5, Resolve +3.', run: (s) => { const c = capital(s); if (c) c.pops.echoes += 1; accord(s, -5); res(s, 3); } },
      { label: 'Refuse her', hint: 'Kin standing +3, Echoes −4.', run: (s) => { stand(s, 'kin', 3); stand(s, 'echoes', -4); } },
    ],
  },
  {
    id: 'echo_drift',
    title: 'Drift',
    art: 'dusk',
    weight: 4,
    bind: (s) => (threadTotals(s).echoes >= 3 ? {} : null),
    text: () => 'An Echo, uploaded three generations ago, no longer recognises her grandchildren. She is kind to them, the way one is kind to strangers. Others report the same slow drift.',
    choices: [
      { label: 'Re-anchor them to their old memories', hint: 'Energy −15, Echoes standing +4.', run: (s) => { energy(s, -15); stand(s, 'echoes', 4); } },
      { label: 'Let them become who they are becoming', hint: 'Echoes +6, Kin −4.', run: (s) => { stand(s, 'echoes', 6); stand(s, 'kin', -4); } },
    ],
  },
  {
    id: 'anyone_in_there',
    title: 'Is Anyone In There?',
    art: 'dusk',
    weight: 3,
    once: true,
    bind: (s) => (threadTotals(s).lattice >= 3 ? {} : null),
    text: () => 'A Lattice unit asked a question in the maintenance logs: “What is the repair for?” No one programmed it to ask. Everyone is sure there is no one inside the Lattice. Almost everyone.',
    choices: [
      { label: 'Study it', hint: 'Insight +50.', run: (s) => { insight(s, 50); } },
      { label: 'Answer it honestly', hint: 'Resolve +2. Kin standing −2.', run: (s) => { res(s, 2); stand(s, 'kin', -2); s.civ.flags.lattice_asked = 1; } },
      { label: 'Wipe it and move on', hint: 'Kin standing +2.', run: (s) => { stand(s, 'kin', 2); } },
    ],
  },
  {
    id: 'chorus_invitation',
    title: 'An Invitation to Merge',
    art: 'dusk',
    weight: 3,
    bind: (s) => (threadTotals(s).chorus >= 1 && threadTotals(s).echoes >= 2 ? {} : null),
    text: () => 'The Chorus has sent invitations to every Echo: come in, it is warm here, you will never be alone. Some Echoes want to go. Some are frightened by how kind the invitation is.',
    choices: [
      { label: 'Allow it', hint: '2 Echoes merge into 1 Chorus. Chorus +5, Echoes −3.', run: (s) => { const c = anyColonyWith(s, 'echoes'); if (c && c.pops.echoes >= 2) { c.pops.echoes -= 2; c.pops.chorus += 1; } stand(s, 'chorus', 5); stand(s, 'echoes', -3); } },
      { label: 'Only with consent, one by one', hint: 'Chorus +2, Echoes +2.', run: (s) => { stand(s, 'chorus', 2); stand(s, 'echoes', 2); } },
    ],
  },

  // ============================================================ the Hunger
  {
    id: 'rust_in_the_belt',
    title: 'Rust in the Belt',
    art: 'hunger',
    once: true,
    text: (_s, d) =>
      'Surveyors found asteroids hollowed from the inside, and a haze of fine dark motes that moved away from their lights. It is a swarm: harvesters left running by a civilization that died before our sun was born. It does not seem to know it is alone. It only eats and grows, and it is drawn to warmth.' +
      (d.fleet ? (String(d.outcome ?? '').startsWith('It paid') ? ` ${d.outcome}` : ` Part of it came for ${d.fleet}. ${d.outcome ?? ''}`) : ''),
    choices: [
      { label: 'Study it', hint: 'Research toward Hunger Studies jumps ahead.', run: (s) => { s.civ.research.hunger_studies = (s.civ.research.hunger_studies ?? 0) + 50; } },
      { label: 'Arm the settlements', hint: 'Research toward Orbital Defence jumps ahead. Resolve −2.', run: (s) => { s.civ.research.orbital_defense = (s.civ.research.orbital_defense ?? 0) + 40; res(s, -2); } },
    ],
  },
  {
    id: 'last_flare',
    title: 'The Last Flare',
    art: 'flare',
    text: (s, d) => {
      const need = sheltersNeeded(s, String(d.systemId)).reduce((a, x) => a + x.n, 0);
      const day = Number(d.day1) > 1000 ? 'hot enough to soften rock' : Number(d.day1) > 373 ? 'far past boiling' : 'hotter than anything we have known';
      const night = Number(d.night1) > SCORCH_K
        ? ` and even the night side, ${d.night0} K until now, will reach about ${d.night1} K. The seas will boil away. Nowhere on the surface will be livable while it lasts.`
        : `. The night side, ${d.night0} K until now, will reach about ${d.night1} K: the only place on the surface anyone can bear.`;
      const heat = d.world ? ` On ${d.world} that means about ${d.mean1} K on average instead of ${d.mean0} K: some ${d.day1} K under the fixed sun, ${day},${night}` : '';
      const refuge = need > 0
        ? ` Our only refuge is the night side: shelters cut into the rock and cooled by radiators, ${SHELTER_CAP} Kin to a shelter. We need ${need} (${need * SHELTER_MATTER} matter; we have ${Math.floor(s.civ.matter)}). Whoever the domes, cold berths and shelters cannot hold will not live through it.`
        : ' Our domes and shelters already hold everyone who lives there.';
      const seas =
        (d.warm ? ` The warmth reaches farther out too: ${d.warm} will melt into open ocean while it lasts, warm enough for Kin to live by the water without domes. A refuge, if we can get people there in time.` : '') +
        (d.hot ? ` ${d.hot} will melt into a hot, steaming sea: liquid, but too hot to live by.` : '');
      const pace = Number(d.clock)
        ? ` At our pace the next turn alone would span ${d.next}: the whole flare would come and go inside it. Or we could quicken to the flare's own clock and live through it, ${FLARE_TURNS} turns of the brightest light we will ever see again.`
        : ` At our pace it will burn for about ${d.turns} turns.`;
      return `${d.star} has left the main sequence. It is not swelling into a giant as bigger stars did: it is shrinking and heating up into a blue dwarf, about ${d.ratio ?? 'a hundred'} times brighter than it was, and it will stay that way for about ${d.span} before it collapses into a white dwarf.${heat}${refuge}${seas}${pace}`;
    },
    choices: [
      {
        label: 'Dig in on the night side and keep time with the flare',
        hint: `Emergency shelters now, as many as we can pay for. Then ${FLARE_TURNS} turns inside the flare: collectors there gather about three times the light, and we get those turns to build and prepare before the Last Light. The heat does the same harm either way; while it lasts, each settlement loses one Kin a turn that it cannot shelter.`,
        ok: (_s, d) => Number(d.clock) === 1,
        run: (s, d) => {
          const r = digShelters(s, String(d.systemId));
          keepTimeWithFlare(s, String(d.systemId));
          return shelterNote(r) + ` We keep time with the flare now: ${FLARE_TURNS} turns, each about a sixth of it.`;
        },
      },
      {
        label: 'Dig in on the night side and let it pass',
        hint: 'The same shelters, at our own pace. Late in the Dusk the flare is over within a turn: its heat strikes once, and there is next to nothing to harvest.',
        run: (s, d) => shelterNote(digShelters(s, String(d.systemId))),
      },
    ],
  },
  {
    id: 'first_contact',
    title: 'We Are Not Alone',
    art: 'survivor',
    text: (_s, d) =>
      `Our listeners have picked out a civilization: ${d.name}, at ${d.star}, ${d.dist} away. What we are hearing left them ${d.age} ago; whatever they are now, they were alive then, and facing the same end as us. The first thing we could make out: “${d.words}”`,
    choices: [
      { label: 'Tell everyone', hint: 'Resolve +4. Our people learn they are not the last.', run: (s) => res(s, 4) },
      { label: 'Keep it with the listeners for now', hint: 'Insight +30. Nobody panics, and nobody hopes too soon.', run: (s) => insight(s, 30) },
    ],
  },
  {
    id: 'hunger_mirror',
    title: 'What It Was For',
    art: 'hunger',
    once: true,
    weight: 4,
    bind: (s) => (hasTech(s, 'command_language') ? {} : null),
    text: () =>
      'The command language decodes into a single standing order, repeated in every swarm: PERSIST. Its makers wrote it the night their star went out. They meant themselves. The machines took it literally, and have been obeying for a trillion years.',
    choices: [
      { label: 'Hear the warning', hint: 'Resolve +3. Taint −5.', run: (s) => { res(s, 3); taint(s, -5); } },
      { label: 'Hear the promise', hint: 'Insight +80. Taint +5.', run: (s) => { insight(s, 80); taint(s, 5); } },
    ],
  },

  // ============================================================ Degenerate Age
  {
    id: 'new_star',
    title: 'A New Star',
    art: 'degenerate',
    text: (s, d) =>
      `Two brown dwarfs in ${s.systems[String(d.systemId)]?.name} collided and merged, and the merged body is heavy enough to burn hydrogen. A small red star has lit where there was none. It will shine for trillions of years, which in this age is not long. Whoever reaches it first will feast.`,
    choices: [
      { label: 'Race for it', hint: 'Its system is revealed and charted.', run: (s, d) => { s.civ.known[String(d.systemId)] = 2; } },
      { label: 'Tell the others', hint: 'Every survivor you know recovers a little. Their trust grows.', run: (s) => { for (const sv of Object.values(s.survivors)) if (sv.alive && sv.contact) { sv.health = Math.min(1, sv.health + 0.08); sv.disposition += 8; } } },
    ],
  },
  {
    id: 'white_fire',
    title: 'White Fire',
    art: 'degenerate',
    text: (s, d) =>
      `Two white dwarfs in ${s.systems[String(d.systemId)]?.name} spiralled together and merged. The remnant is burning helium: a small, blue-white, furious star that will last only a few hundred million years. To slow minds it is a flash. To fast ones it is a feast. How fast will we choose to live while it lasts?`,
    choices: [
      { label: 'Quicken while it burns', hint: 'Pace +1 (shorter turns), so its light lasts many turns.', run: (s) => { s.civ.pace = Math.min(s.civ.pace + 1, 3); s.civ.known = { ...s.civ.known }; } },
      { label: 'Stay slow and catch the flash', hint: 'Keep the pace. What cannot be stored is lost.', run: () => {} },
    ],
  },
  {
    id: 'supernova',
    title: 'Supernova',
    art: 'degenerate',
    text: (s, d) =>
      `The merged remnant in ${s.systems[String(d.systemId)]?.name} was too heavy to live. It detonated as a thermonuclear supernova, for a few weeks outshining everything left in the Coalescence. Its light lit up shapes in the dark our instruments had never seen.`,
    choices: [{ label: 'Chart everything it showed us', hint: 'Insight +80; nearby systems revealed.', run: (s, d) => { insight(s, 80); const c = s.systems[String(d.systemId)]; if (c) for (const o of Object.values(s.systems)) if (Math.hypot(o.phys.x - c.phys.x, o.phys.y - c.phys.y, o.phys.z - c.phys.z) < 20000) s.civ.known[o.id] = Math.max(s.civ.known[o.id] ?? 0, 1) as 1 | 2; } }],
  },
  {
    id: 'cast_out',
    title: 'Cast Out',
    art: 'degenerate',
    text: (s, d) => `${s.systems[String(d.systemId)]?.name} has been flung out of the Coalescence by the slow chaos of a galaxy that is coming apart. Our settlement there is drifting into the void, getting farther from everyone forever.`,
    choices: [
      { label: 'Send them everything they need', hint: 'Energy −30, Matter −30. Resolve +3.', run: (s) => { energy(s, -30); matter(s, -30); res(s, 3); } },
      { label: 'They are on their own now', hint: 'Resolve −4.', run: (s) => { res(s, -4); } },
    ],
  },
  {
    id: 'unmoored',
    title: 'Unmoored',
    art: 'degenerate',
    text: (s, d) => `A passing star came close enough to ${s.systems[String(d.systemId)]?.name} to tear ${bodyById(s, d)?.name} out of its orbit. It is a rogue world now, falling away into the dark with our people on it.`,
    choices: [
      { label: 'Evacuate what we can', hint: 'Energy −20. Half its people move to the capital.', run: (s, d) => { energy(s, -20); const b = bodyById(s, d); const c = b?.colonyId ? s.colonies[b.colonyId] : undefined; const cap = capital(s); if (c && cap && c.id !== cap.id) { for (const t of ['kin', 'echoes', 'chorus', 'lattice', 'coldminds'] as ThreadId[]) { const n = Math.floor(c.pops[t] / 2); c.pops[t] -= n; cap.pops[t] += n; } } } },
      { label: 'They will live on their Hearth', hint: 'Resolve −2.', run: (s) => { res(s, -2); } },
    ],
  },
  {
    id: 'world_falls',
    title: 'A World Falls',
    art: 'degenerate',
    text: (s, d) => {
      const b = bodyById(s, d);
      const hw = b?.traits.includes('homeworld');
      const models = hasTech(s, 'accretion_modelling')
        ? b?.feeding?.model === 'rekindle'
          ? 'Our models are confident: it will break up quickly and the dead star will rekindle, briefly and brilliantly.'
          : 'Our models are confident: it will be peeled away slowly, a stream feeding the dead star for trillions of years.'
        : 'Our astronomers disagree. Some models say the planet will be peeled away slowly over trillions of years. Others say it will break up fast and the dead star will blaze again, briefly.';
      return hw
        ? `Gravitational waves have finally drained the orbit of ${b?.name}, the world we were born on. It has reached its dead sun’s tidal limit. ${models} Either way, our birthworld is becoming the fuel that keeps its own dead sun faintly warm.`
        : `${b?.name} has spiralled in to the tidal limit of its dead star. ${models}`;
    },
    choices: [
      { label: 'Evacuate the world and harvest the stream', hint: 'Its people move to the capital. Disk Skimmers can harvest the dead star.', run: (s, d) => { const b = bodyById(s, d); const c = b?.colonyId ? s.colonies[b.colonyId] : undefined; const cap = capital(s); if (b?.feeding) b.feeding.revealed = true; if (c && cap && c.id !== cap.id) { for (const t of ['kin', 'echoes', 'chorus', 'lattice', 'coldminds'] as ThreadId[]) { cap.pops[t] += c.pops[t]; c.pops[t] = 0; } cap.cryo += c.cryo; c.cryo = 0; } } },
      { label: 'Stay and mine our own world as it falls', hint: 'Matter +80. Resolve −3.', run: (s, d) => { matter(s, 80); res(s, -3); const b = bodyById(s, d); if (b?.feeding) b.feeding.revealed = true; } },
    ],
  },
  {
    id: 'embers_dim',
    title: 'The Embers Dim',
    art: 'degenerate',
    eras: ['degenerate'],
    once: true,
    weight: 20,
    bind: (s) => (s.eta > 22.3 ? {} : null),
    text: () => 'The dark-matter halo is running thin. The white dwarfs it kept warm are cooling, one after another, toward the few kelvin of true black dwarfs. Whatever we are going to live on next, we need to find it now.',
    choices: [{ label: 'Understood', hint: 'Ember yields keep falling until η 25.', run: (s) => { res(s, -2); } }],
  },
  {
    id: 'proton_answer',
    title: 'The Proton Question',
    art: 'degenerate',
    once: true,
    text: (s) =>
      s.protonsDecay
        ? 'The detector finally registered it: a single proton, decaying into a positron and a flash. Then another. Ordinary matter is not forever. Somewhere around 10³⁸ years from the beginning, every planet, every dead star and every body will have evaporated into light and leptons. Whatever we are then, we cannot be made of this.'
        : 'Ten thousand detector-lifetimes, and not a single decay. The protons are stable. Matter will outlast the black holes, cold and dark, slowly tunnelling into iron. Flesh, in principle, can last.',
    choices: [
      { label: 'Tell everyone the truth', hint: 'Resolve ±5 depending on the answer.', run: (s) => { res(s, s.protonsDecay ? -5 : 5); } },
      { label: 'Tell the councils only', hint: 'Dissent +3.', run: (s) => { dis(s, 3); } },
    ],
  },

  // ============================================================ Black Hole Age
  {
    id: 'final_burst',
    title: 'The Last Burst',
    art: 'blackhole',
    text: (s, d) => `The black hole at ${s.systems[String(d.systemId)]?.name} has finished evaporating. In its last second it gave back, as a burst of gamma rays and particles, what was left of everything it ever swallowed.`,
    choices: [{ label: 'Record it', hint: 'Its light is gone.', run: () => {} }],
  },
  {
    id: 'horizon_whispers',
    title: 'Whispers at the Horizon',
    art: 'blackhole',
    eras: ['blackhole'],
    weight: 3,
    once: true,
    text: () => 'Coldminds tending a Hawking collector report a structure in the noise, too regular to be random and too faint to be sure of. Some say it is information coming back out of the hole. Some say it is our own loneliness looking for a face.',
    choices: [
      { label: 'Listen longer', hint: 'Insight +120, Energy −20.', run: (s) => { insight(s, 120); energy(s, -20); } },
      { label: 'Let it be noise', hint: 'Resolve +2.', run: (s) => { res(s, 2); } },
    ],
  },

  // ============================================================ Dark Era
  {
    id: 'forgetting',
    title: 'Forgetting',
    art: 'dark',
    eras: ['dark'],
    weight: 8,
    bind: (s) => (s.civ.continuity < 45 ? {} : null),
    text: () => 'Error correction cannot keep up. Across the vaults, small things are going: names, faces, the colour of the old sun. Someone proposes pruning everything non-essential so the essential can be kept perfectly.',
    choices: [
      { label: 'Prune', hint: 'Continuity +12. Resolve −6.', run: (s) => { s.civ.continuity = Math.min(100, s.civ.continuity + 12); res(s, -6); } },
      { label: 'Sleep deeper', hint: 'Continuity +5. Pace slows.', run: (s) => { s.civ.continuity = Math.min(100, s.civ.continuity + 5); s.civ.pace = Math.max(-2, s.civ.pace - 1); } },
      { label: 'Keep everything, imperfectly', hint: 'Resolve +3.', run: (s) => { res(s, 3); } },
    ],
  },
  {
    id: 'positronium',
    title: 'Atoms Wider Than Galaxies',
    art: 'dark',
    eras: ['dark'],
    weight: 4,
    text: () => 'An electron and a positron, separated by more than the width of the old observable universe, have been orbiting each other since before the last black hole died. Their orbit has decayed. They annihilate, and the two photons pass through our collectors.',
    choices: [{ label: 'Catch what we can', hint: 'Energy +6.', run: (s) => { energy(s, 6); } }],
  },
  {
    id: 'false_vacuum',
    title: 'The False Vacuum',
    art: 'dark',
    eras: ['dark'],
    weight: 3,
    once: true,
    text: () =>
      'The old physics was never resolved: our vacuum may be metastable. Somewhere a bubble of truer vacuum could form and expand at the speed of light, and there would be no warning. Some estimates put the lifetime near 10¹⁶¹ years, give or take a thousand orders of magnitude. We are past 10¹⁰⁰.',
    choices: [
      { label: 'Write a record that could outlast it', hint: 'Energy −40. Resolve +4.', run: (s) => { energy(s, -40); res(s, 4); } },
      { label: 'Live with it', hint: 'Resolve −2.', run: (s) => { res(s, -2); } },
    ],
  },
  {
    id: 'mind_from_nowhere',
    title: 'A Mind From Nowhere',
    art: 'dark',
    eras: ['dark'],
    weight: 2,
    once: true,
    bind: (s) => (s.eta > 1e3 ? {} : null),
    text: () =>
      'In the thermal noise of the horizon, over spans that have no name, anything that can happen eventually does. A mind has fluctuated into being out of nothing. It knows it will dissolve in a moment. It has one question for us: what was it like, when there were stars?',
    choices: [
      { label: 'Tell it everything', hint: 'Continuity +8, Resolve +6.', run: (s) => { s.civ.continuity = Math.min(100, s.civ.continuity + 8); res(s, 6); } },
      { label: 'Ask it what it knows', hint: 'Insight +200.', run: (s) => { insight(s, 200); } },
    ],
  },

  // ============================================================ relics (found by survey)
  {
    id: 'relic_archive',
    title: 'An Archive of the Dead',
    art: 'ruins',
    text: (s, d) => `On ${bodyById(s, d)?.name} the survey found a library cut into bedrock by someone who died before our star formed. Much of it is still readable.`,
    choices: [
      { label: 'Read it, slowly', hint: 'Insight +90.', run: (s, d) => { insight(s, 90); const b = bodyById(s, d); if (b?.relic) b.relic.state = 'studied'; } },
      { label: 'Strip it for matter', hint: 'Matter +50 (more under salvage charters).', run: (s, d) => { const m = hasCharter(s, 'consume_the_dead') ? 3 : hasCharter(s, 'salvage_the_dead') ? 2 : 1; matter(s, 50 * m); if (m === 3) taint(s, 2); const b = bodyById(s, d); if (b?.relic) b.relic.state = 'spent'; } },
    ],
  },
  {
    id: 'relic_engine',
    title: 'A Cold Engine',
    art: 'ruins',
    text: (s, d) => `Beneath the ice of ${bodyById(s, d)?.name} lies an ancient reactor, shut down and sealed. Its fuel is still there.`,
    choices: [
      { label: 'Restart it', hint: 'Energy +70. Its heat may be noticed.', run: (s, d, rng) => { energy(s, 70); const b = bodyById(s, d); if (b?.relic) b.relic.state = 'spent'; if (rng.chance(0.3)) { const sys = b ? s.systems[b.systemId] : null; if (sys) sys.rust = Math.max(sys.rust ?? 0, 0.1); } } },
      { label: 'Take it apart', hint: 'Matter +55.', run: (s, d) => { matter(s, 55); const b = bodyById(s, d); if (b?.relic) b.relic.state = 'spent'; } },
    ],
  },
  {
    id: 'relic_tomb',
    title: 'A Tomb',
    art: 'ruins',
    text: (s, d) => `On ${bodyById(s, d)?.name}: rows upon rows of markers in a script no one alive can read, and one monument in the middle. Someone stayed to bury everyone else.`,
    choices: [
      { label: 'Mourn them', hint: 'Resolve +4.', run: (s, d) => { res(s, 4); const b = bodyById(s, d); if (b?.relic) b.relic.state = 'studied'; } },
      { label: 'Study the script', hint: 'Insight +45.', run: (s, d) => { insight(s, 45); const b = bodyById(s, d); if (b?.relic) b.relic.state = 'studied'; } },
      { label: 'Salvage the site', hint: 'Matter +40. Resolve −3.', run: (s, d) => { const m = hasCharter(s, 'consume_the_dead') ? 3 : hasCharter(s, 'salvage_the_dead') ? 2 : 1; matter(s, 40 * m); res(s, -3); if (m === 3) taint(s, 2); const b = bodyById(s, d); if (b?.relic) b.relic.state = 'spent'; } },
    ],
  },
  {
    id: 'relic_ghosts',
    title: 'Ghosts in the Archive',
    art: 'ruins',
    text: (s, d) => `The machines under ${bodyById(s, d)?.name} are still running, and still storing minds: thousands of archived people from a civilization that ended ages ago. They are not asleep. They are paused, mid-sentence.`,
    choices: [
      { label: 'Run them again, as Echoes', hint: '+2 Echoes at the capital (needs substrate). They are strange to us.', ok: (s) => hasTech(s, 'mind_substrate'), run: (s, d) => { const c = capital(s); if (c) c.pops.echoes += 2; stand(s, 'echoes', -3); const b = bodyById(s, d); if (b?.relic) b.relic.state = 'woken'; } },
      { label: 'Read their memories', hint: 'Insight +70.', run: (s, d) => { insight(s, 70); const b = bodyById(s, d); if (b?.relic) b.relic.state = 'studied'; } },
      { label: 'Let them finish their sentence and end', hint: 'Resolve +2.', run: (s, d) => { res(s, 2); const b = bodyById(s, d); if (b?.relic) b.relic.state = 'spent'; } },
    ],
  },
  {
    id: 'relic_sleepers',
    title: 'The Vault of Sleepers',
    art: 'sleepers',
    text: (s, d) =>
      `Under ${bodyById(s, d)?.name} is a vault, still warm. Inside, a whole people chose Dyson’s bargain long ago: sleep through the lean ages, wake briefly, think a little, sleep again. They have been sleeping for longer than our species has existed. They are not expecting visitors.`,
    choices: [
      { label: 'Leave them be', hint: 'Resolve +2.', run: (s, d) => { res(s, 2); const b = bodyById(s, d); if (b?.relic) b.relic.state = 'studied'; } },
      { label: 'Study the vault', hint: 'Insight +80. Research toward Hibernation Protocols.', run: (s, d) => { insight(s, 80); s.civ.research.hibernation_protocols = (s.civ.research.hibernation_protocols ?? 0) + 60; const b = bodyById(s, d); if (b?.relic) b.relic.state = 'studied'; } },
      {
        label: 'Wake them',
        hint: 'Energy −60. They may help, resent you, or be broken.',
        run: (s, d, rng) => {
          energy(s, -60);
          const b = bodyById(s, d);
          if (b?.relic) b.relic.state = 'woken';
          const r = rng.next();
          if (r < 0.45) {
            const c = capital(s);
            if (c) c.pops.echoes += 3;
            insight(s, 120);
            log(s, 'The sleepers woke gently, thanked us, and asked to join us. They brought their long patience with them.', 'good');
            return 'They wake gently. Three of them ask to join you, and share what they learned sleeping through the ages.';
          }
          if (r < 0.75) {
            const id = uid(s, 'sl');
            s.survivors[id] = { id, kind: 'survivor', name: 'The Woken', adjective: 'Woken', color: '#9fc7b0', way: 'dormant', homeSystemId: b?.systemId ?? s.civ.homeSystemId, systems: b ? [b.systemId] : [], pop: 14, health: 0.7, reserve: 10, disposition: -30, clock: 6, contact: true, alive: true, aidGiven: 0, lastSent: s.turn };
            return 'They wake angry. We interrupted a sleep they had planned for a hundred ages. They leave, and do not thank us.';
          }
          res(s, -6);
          const sys = b ? s.systems[b.systemId] : null;
          if (sys) {
            const swId = uid(s, 'hg');
            s.swarms[swId] = { id: swId, systemId: sys.id, from: null, to: null, traveled: 0, distance: 0, size: 3, awake: true, tamed: false, appetite: 1 };
          }
          return 'Something went wrong in the vault a very long time ago. What woke up is not the people who went to sleep. Their machines woke with them, and they are hungry.';
        },
      },
      { label: 'Devour the vault', hint: 'Energy +150, Matter +60. Hunger Taint +6. Requires Strip the Sleepers.', ok: (s) => hasCharter(s, 'strip_the_sleepers'), run: (s, d) => { energy(s, 150); matter(s, 60); taint(s, 6); res(s, -5); const b = bodyById(s, d); if (b?.relic) b.relic.state = 'spent'; } },
    ],
  },
];

// ---------------------------------------------------------------- discoveries
// Phenomena a survey can turn up. Hard science only; where the physics is hypothetical the
// text says so. Each leaves a trait on the world so the find stays visible.

export interface AnomalyDef {
  id: string;
  name: string; // shown as the world's trait
  tip: string;
  fits: (s: GameState, b: Body) => boolean;
  event: Omit<EventDef, 'id' | 'art'>; // the plate is art/finds/<id>.webp
}

const sysOf = (s: GameState, b: Body) => s.systems[b.systemId];
const rocky = (b: Body) => ['barren', 'super_earth', 'terran', 'eyeball', 'ice', 'ocean_ice'].includes(b.kind);

export const ANOMALIES: AnomalyDef[] = [
  {
    id: 'vent_life',
    name: 'Vent life',
    tip: 'Chemosynthetic life around hydrothermal vents in a buried ocean.',
    fits: (_s, b) => (b.kind === 'ocean_ice' || b.traits.includes('subsurface_ocean')) && !b.colonyId,
    event: {
      title: 'Life Under the Ice',
      text: (s, d) =>
        `Under the ice shell of ${bodyById(s, d)?.name}, tidal flexing keeps an ocean liquid, and on its floor warm vents feed mats of something alive: chemosynthetic cells a few microns across, living on the chemistry of rock and water, with no light at all. Their biochemistry is not ours. They are the first life anyone here has found that is not related to us.`,
      choices: [
        { label: 'Study them without touching', hint: 'Insight +50, Resolve +3, Kin standing +3.', run: (s) => { insight(s, 50); res(s, 3); stand(s, 'kin', 3); } },
        { label: 'Declare the ocean a sanctuary', hint: 'Resolve +6, Accord +10. The Kin will remember.', run: (s) => { res(s, 6); accord(s, 10); stand(s, 'kin', 4); } },
        { label: 'Take samples for our own biology', hint: 'Insight +80. Some will call it theft: Kin standing −3.', run: (s) => { insight(s, 80); stand(s, 'kin', -3); } },
      ],
    },
  },
  {
    id: 'fossil_reactor',
    name: 'Fossil reactor',
    tip: 'The isotope record of a natural fission reactor that burned out when the universe was young.',
    fits: (_s, b) => rocky(b) && b.kind !== 'ocean_ice',
    event: {
      title: 'The Ghost of a Reactor',
      text: (s, d) =>
        `Survey cores from ${bodyById(s, d)?.name} show the wrong isotopes in one layer of rock: xenon and neodymium in the ratios left by nuclear fission. Long ago, when the universe was only a few billion years old, groundwater flooded a seam of uranium ore here and it went critical, a natural reactor like the one found in Earth's Oklo mine. Every atom of that uranium decayed away tens of trillions of years ago. Only its fingerprints are left.`,
      choices: [{ label: 'Read the record', hint: 'Insight +45: a clock for the early universe.', run: (s) => insight(s, 45) }],
    },
  },
  {
    id: 'diamond_mantle',
    name: 'Diamond mantle',
    tip: 'A carbon-rich world: beneath a graphite crust, a mantle of diamond.',
    fits: (_s, b) => (b.kind === 'super_earth' || b.kind === 'barren') && b.massEarth > 1.5,
    event: {
      title: 'A Carbon World',
      text: (s, d) =>
        `Seismic soundings of ${bodyById(s, d)?.name} ring like a bell. It formed from a disk rich in carbon and poor in oxygen, so instead of silicate rock it has a crust of graphite over a thick mantle of diamond.`,
      choices: [
        { label: 'Mine it', hint: 'Mineral richness +0.8, Matter +30.', run: (s, d) => { const b = bodyById(s, d); if (b) b.richness += 0.8; matter(s, 30); } },
        { label: 'Use it as an instrument', hint: 'Insight +35: a diamond planet carries seismic waves very cleanly.', run: (s) => insight(s, 35) },
      ],
    },
  },
  {
    id: 'primordial_hole',
    name: 'Primordial black hole',
    tip: 'A black hole the mass of a mountain, left from the first second of the universe and now evaporating. Speculative: such holes are hypothetical.',
    fits: (_s, b) => b.kind === 'asteroids',
    event: {
      title: 'A Black Hole the Size of a Mountain',
      text: (s, d) =>
        `In the belt of ${sysOf(s, bodyById(s, d)!)?.name} the survey found a point of gamma-ray light with no surface at all: about four trillion kilograms, a black hole smaller than an atomic nucleus. Only a hole formed in the first second of the universe could be this small, and a hole this small should be finishing its Hawking evaporation about now, brightening as it shrinks. Primordial black holes were only ever a hypothesis. (Speculative physics.)`,
      choices: [
        { label: 'Catch its last light', hint: 'Energy +120, once. It is nearly gone.', run: (s) => energy(s, 120) },
        { label: 'Measure it as it dies', hint: 'Insight +90: Hawking radiation, observed directly.', run: (s) => insight(s, 90) },
      ],
    },
  },
  {
    id: 'interstellar_shard',
    name: 'Interstellar visitor',
    tip: 'A fragment of another star’s planet-forming disk, passing through.',
    fits: (_s, b) => b.kind === 'asteroids' || b.kind === 'barren',
    event: {
      title: 'A Visitor From Another Star',
      text: (s, d) =>
        `An elongated shard of rock is crossing ${sysOf(s, bodyById(s, d)!)?.name} on a hyperbolic path: it is not bound to this star. Its isotopes say it was thrown out of some other star's disk before the ancestral galaxies merged, and it has been falling between stars ever since.`,
      choices: [
        { label: 'Study it as it passes', hint: 'Insight +40.', run: (s) => insight(s, 40) },
        { label: 'Catch it', hint: 'Energy −20, Matter +55.', ok: (s) => s.civ.energy >= 20, run: (s) => { energy(s, -20); matter(s, 55); } },
      ],
    },
  },
  {
    id: 'fossils',
    name: 'Fossil biosphere',
    tip: 'Mineral structures grown around life that died tens of trillions of years ago.',
    fits: (_s, b) => ['barren', 'super_earth', 'terran', 'ice'].includes(b.kind),
    event: {
      title: 'Someone Lived Here',
      text: (s, d) =>
        `Under the dust of ${bodyById(s, d)?.name}: layered mounds of mineral that grew around mats of microbes, like stromatolites, in shallow seas that dried up some eighty trillion years ago. Life happened here, once, without anyone to see it.`,
      choices: [
        { label: 'Tell everyone', hint: 'Resolve +6, Dissent −2. We are not the first.', run: (s) => { res(s, 6); dis(s, -2); } },
        { label: 'Archive it quietly', hint: 'Insight +30.', run: (s) => insight(s, 30) },
      ],
    },
  },
  {
    id: 'flare_glass',
    name: 'Flare glass',
    tip: 'Plains of glass fused by the superflares of a young red dwarf.',
    fits: (s, b) => (b.kind === 'barren' || b.kind === 'super_earth') && ['red_dwarf', 'blue_dwarf', 'white_dwarf'].includes(sysOf(s, b).primary.kind),
    event: {
      title: 'Plains of Glass',
      text: (s, d) =>
        `The day side of ${bodyById(s, d)?.name} is paved with glass: layer on layer of rock melted by superflares when its red dwarf was young and violent, trillions of years ago. Each layer dates an outburst.`,
      choices: [
        { label: 'Quarry the glass', hint: 'Matter +40.', run: (s) => matter(s, 40) },
        { label: 'Read the flare record', hint: 'Insight +25, and our astronomers learn to see flares coming.', run: (s) => { insight(s, 25); s.civ.flags.flare_warning = 1; } },
      ],
    },
  },
  {
    id: 'clathrates',
    name: 'Clathrate ice',
    tip: 'Methane and hydrogen locked in cages of ice: fuel for fusion.',
    fits: (_s, b) => ['ice', 'ocean_ice', 'ice_giant'].includes(b.kind),
    event: {
      title: 'Fuel in the Ice',
      text: (s, d) =>
        `Kilometres down in the ice of ${bodyById(s, d)?.name}, the survey found clathrate hydrates: methane and hydrogen molecules trapped in cages of water ice, stable only at this cold and this pressure. A frozen store of fuel.`,
      choices: [{ label: 'Chart the deposits', hint: 'Hydrogen yield +0.8 here (fuel for fusion).', run: (s, d) => { const b = bodyById(s, d); if (b) b.hydrogen += 0.8; } }],
    },
  },
  {
    id: 'lens',
    name: 'Lensing alignment',
    tip: 'A rogue world behind this star focused the light of distant stars for a while.',
    fits: () => true,
    event: {
      title: 'A Lens in the Dark',
      text: (s, d) =>
        `A rogue planet drifting far behind ${sysOf(s, bodyById(s, d)!)?.name} has lined up with the star as seen from here. For a few years its gravity focuses the light of stars behind it, a microlensing event, and our instruments read their spectra as if they were next door.`,
      choices: [
        {
          label: 'Map everything it shows us',
          hint: 'Stars within 400 light-years appear on the map. Insight +20.',
          run: (s, d) => {
            const here = sysOf(s, bodyById(s, d)!);
            for (const o of Object.values(s.systems)) {
              if (s.civ.known[o.id] || o.gone) continue;
              if (Math.hypot(o.phys.x - here.phys.x, o.phys.y - here.phys.y, o.phys.z - here.phys.z) <= 400) s.civ.known[o.id] = 1;
            }
            insight(s, 20);
          },
        },
      ],
    },
  },
  {
    id: 'sail_graveyard',
    name: 'Sail graveyard',
    tip: 'A drift of dead lightsail probes from a civilization that died long ago.',
    fits: (_s, b) => b.kind === 'asteroids' || b.kind === 'deep',
    event: {
      title: 'A Graveyard of Sails',
      text: (s, d) =>
        `In the dark beyond ${bodyById(s, d)?.name}: hundreds of lightsails, each a few square kilometres of metal foil, the probes of someone who crossed between stars on starlight. Their cores are dead. The star charts etched into their frames are not.`,
      choices: [
        { label: 'Read the charts', hint: 'Insight +70.', run: (s) => insight(s, 70) },
        { label: 'Salvage the foil', hint: 'Matter +60.', run: (s) => matter(s, 60) },
      ],
    },
  },
  {
    id: 'resonance',
    name: 'Tidal resonance',
    tip: 'Locked in an orbital resonance with its neighbours: the flexing heats its interior.',
    fits: (s, b) => ['ice', 'ocean_ice', 'eyeball', 'terran', 'super_earth'].includes(b.kind) && sysOf(s, b).bodies.length >= 4,
    event: {
      title: 'Kept Warm by Its Neighbours',
      text: (s, d) =>
        `${bodyById(s, d)?.name} is locked in an orbital resonance with its sibling worlds: every few orbits they tug it back onto an eccentric path, and the endless squeezing heats its interior, as Jupiter's moons heat Io.`,
      choices: [{ label: 'Tap the tidal heat', hint: 'Core heat +0.2 here, for geothermal power.', run: (s, d) => { const b = bodyById(s, d); if (b) b.coreHeat = Math.min(1, b.coreHeat + 0.2); } }],
    },
  },
  {
    id: 'magnetar_print',
    name: 'Magnetar imprint',
    tip: 'Rock magnetised by the field of a star that was once a magnetar.',
    fits: (s, b) => rocky(b) && sysOf(s, b).primary.kind === 'neutron_star',
    event: {
      title: 'Written by a Magnetar',
      text: (s, d) =>
        `Every grain of iron in the rocks of ${bodyById(s, d)?.name} points the same way. Its neutron star was once a magnetar, with a magnetic field a thousand trillion times Earth's, and the field wrote itself into the planet before it faded.`,
      choices: [{ label: 'Study the imprint', hint: 'Insight +40.', run: (s) => insight(s, 40) }],
    },
  },
  {
    id: 'warm_rogue',
    name: 'Warm under hydrogen',
    tip: 'A starless world whose thick hydrogen air holds in its own heat, with liquid water beneath.',
    fits: (_s, b) => !!b.rogue && rocky(b),
    event: {
      title: 'Warm in the Dark',
      text: (s, d) =>
        `${bodyById(s, d)?.name} has no star, yet it is warm. A thick atmosphere of hydrogen, which lets heat out only very slowly at these temperatures, holds in the last warmth of its interior like a blanket, and under it there is liquid water.`,
      choices: [{ label: 'Chart it for settlers', hint: 'Core heat +0.2 and habitability at least 15% here.', run: (s, d) => { const b = bodyById(s, d); if (b) { b.coreHeat = Math.min(1, b.coreHeat + 0.2); b.habitability = Math.max(b.habitability, 0.15); b.vitality = Math.max(b.vitality, 0.3); } } }],
    },
  },
];

// discoveries are events too (queued by the survey, never rolled at random)
EVENTS.push(...ANOMALIES.map((a): EventDef => ({ id: `anom_${a.id}`, art: `finds/${a.id}`, ...a.event })));

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
