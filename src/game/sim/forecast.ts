import { ERA_BY_ID, formatYears, logTurnLength, turnsUntil } from '../eras';
import { BROWN_FADE_ETA, SURFACE_LIFE, boilingAway, fallsInAt, flashBoils, flashMelts, flashShelterFor, flashSheltered, giantFlash, giantWorld, meltLineAU, rubbleGame, takesWorldsIn, dwarfFadeEta, embersOutEta, haloEta, haloMoved, haloReachesYears, lampsOver, nextStellarChange, siphonsRunning } from '../physics';
import type { Forecast, GameState } from '../types';
import { turnStep, turnsUntilYears } from './flare';
import { colonies, hasCharter, hasTech, inItsSystem, protonFateKnown } from './util';
import { readsSwarms, swarmArrives, swarmSight } from './sight';
import { FLOW_ETA, flowAhead, flowing, keeping, nextToFlow } from './flow';
import { computeMods } from './mods';
import { flashReach } from './crossing';
import { DEGENERATE_END, FATE_SHOWN_AT, MATTER_END, calendarEra, fateOf } from '../fate';

// Forecasts: the astronomers' warnings. Every great change is visible in advance; the
// question is whether you can prepare in time.

export function forecastTurns(state: GameState, f: Forecast): number {
  if (calendarEra(state) === 'dark') return Infinity;
  return turnsUntilYears(state, f.dueYears, 0);
}

/** Turns until `at` at the Tide, for deciding which warnings to show: in the Dusk as the turns will really fall (a flare's clock, its stops). */
function tideTurnsTo(state: GameState, at: number, horizon: number): number {
  if (calendarEra(state) === 'dusk') return turnsUntilYears(state, at, 0, horizon + 1);
  const era = calendarEra(state);
  return turnsUntil(era === 'dark' ? 'blackhole' : era, state.years, at, state.settings.length);
}

export function updateForecasts(state: GameState) {
  const out: Forecast[] = [];
  const add = (f: Omit<Forecast, 'uid'>, key?: string) => out.push({ ...f, uid: key ?? `${f.kind}:${f.systemId ?? ''}:${f.bodyId ?? ''}` });
  const colonized = new Set(colonies(state).map((c) => c.systemId));
  const years = state.years;
  const horizon = calendarEra(state) === 'dusk' ? 60 : 40;

  // stars that matter to us
  for (const sid of colonized) {
    const sys = state.systems[sid];
    const ch = nextStellarChange(sys, years);
    if (!ch || !isFinite(ch.at)) continue;
    // a hole we live on has its own warning in the Black Hole Age, which says more (below)
    if ((sys.primary.kind === 'black_hole' || sys.primary.kind === 'smbh') && (calendarEra(state) === 'blackhole' || state.era === 'blackhole')) continue;
    // a collapsing star leaves our living worlds there to freeze
    const freezing = sys.primary.kind === 'blue_dwarf'
      ? colonies(state).filter((c) => c.systemId === sid).map((c) => state.bodies[c.bodyId]).filter((b) => b && SURFACE_LIFE.includes(b.kind) && b.vitality > 0 && !lampsOver(state, b))
      : [];
    const then = freezing.length ? ` Then whatever still lives on ${freezing.map((b) => b.name).join(' and ')} will freeze as its light fades, unless Orbital Lamps keep it warm.` : '';
    const f: Omit<Forecast, 'uid'> = {
      kind: 'star',
      title: `${sys.name} ${ch.what}`,
      text: ch.what.includes('brightens')
        ? `In about ${formatYears(ch.at - years)}. For a few billion years it will be over a hundred times brighter, hot enough to boil the seas of its worlds.`
        : `In about ${formatYears(ch.at - years)}.${then}`,
      dueYears: ch.at,
      systemId: sid,
      severity: ch.what.includes('brightens') ? 'boon' : 'danger',
    };
    if (tideTurnsTo(state, ch.at, horizon) <= horizon) add(f);
  }

  // worlds that will fall into their stars: around a star that takes its worlds in now (a dead
  // star of ordinary matter; in a game begun since 19 Oct a brown dwarf or a black hole too), not
  // one still burning, and never one that keeps them (until 19 Oct every star after the Dusk was
  // taken for dead here, a brown dwarf's or a hole's worlds warned of and never falling)
  // (in a game begun since 20 Oct a world comes apart by what it is made of: physics.ts, rubbleGame)
  const rubble = rubbleGame(state);
  for (const c of colonies(state)) {
    const b = state.bodies[c.bodyId];
    if (!b || b.feeding || b.rogue || b.dissolved) continue;
    const sys = state.systems[b.systemId];
    if (!takesWorldsIn(state, sys.primary.kind)) continue;
    // (a giant's fall, where it flashes, has its own warning below)
    if (rubble && giantWorld(b)) continue;
    const at = fallsInAt(state, b);
    if (!isFinite(at) || at < years) continue;
    if (tideTurnsTo(state, at, horizon) > horizon) continue;
    const hole = sys.primary.kind === 'black_hole';
    const brown = sys.primary.kind === 'brown_dwarf';
    add({
      kind: 'inspiral',
      title: hole ? `${b.name} will be torn apart by its black hole` : brown ? `${b.name} will reach its brown dwarf’s tidal limit` : `${b.name} will reach its dead star’s tidal limit`,
      text: rubble
        ? hole
          ? 'Gravitational waves are draining its orbit. Far outside the horizon the hole’s tides will tear it into rubble, and the hole will take all of it within the turn: a faint flash that harms nothing, and Burst Catchers bank it. Three in four of the people there will get off to the Deep.'
          : `Gravitational waves are draining its orbit. The ${brown ? 'dwarf' : 'star'}’s tides will tear it into a ring of rubble, its core laid open, richer to mine than the world was, which will rain onto the ${brown ? 'dwarf, a faint warmth' : 'star'} for trillions of years.${brown ? '' : ' The models disagree about how fast.'}`
        : hole
          ? 'Gravitational waves are draining its orbit. Far outside the horizon the hole’s tides will tear it apart, and it will be gone within the turn.'
          : brown
            ? 'Gravitational waves are draining its orbit. The dwarf’s tides will tear it apart, and the rubble will rain onto it, a faint warmth for trillions of years.'
            : 'Gravitational waves are draining its orbit. The models disagree about what happens next.',
      dueYears: at,
      bodyId: b.id,
      systemId: b.systemId,
      severity: 'warn',
    });
  }

  // giants that will fall in a flash where we live (since 20 Oct): its date, how far it melts the
  // ground, and what each of our settlements there needs to live through it
  if (rubble) {
    for (const sid of colonized) {
      const sys = state.systems[sid];
      if (!sys || !takesWorldsIn(state, sys.primary.kind)) continue;
      for (const gid of sys.bodies) {
        const g = state.bodies[gid];
        if (!g || !giantWorld(g) || g.dissolved || g.rogue) continue;
        const at = fallsInAt(state, g);
        if (!isFinite(at) || at < years || tideTurnsTo(state, at, horizon) > horizon) continue;
        const f = giantFlash(sys.primary, g);
        const ours: string[] = [];
        let danger = false;
        for (const c of colonies(state)) {
          const b = state.bodies[c.bodyId];
          if (c.systemId !== sid || !b || b.dissolved || !inItsSystem(state, c)) continue;
          if (b.id === g.id) {
            ours.push(`${c.name} falls in with it: three in four of its people will get off to the Deep, into the flash.`);
            danger = true;
          } else if (flashBoils(state, b, f)) {
            ours.push(`${b.name} will boil away${c.name !== b.name ? `, and ${c.name} with it` : ''}: nothing on it can be saved.`);
            danger = true;
          } else if (flashMelts(state, b, f)) {
            // (with the research it comes with, if we have not done it yet)
            const locked = flashShelterFor(b) === 'flash_shelter';
            const tech = locked ? 'subterranean_cities' : 'orbital_industry';
            const learn = hasTech(state, tech) ? '' : locked ? ' (both come with the Deep Warrens research)' : ' (Orbital Industry)';
            const need = locked ? `a Flash Shelter or Deep Warrens${learn}` : `a Shadow Shield${learn}`;
            const has = flashSheltered(c, b);
            ours.push(`${c.name} ${has ? 'is sheltered' : `needs ${need}, or is lost`}.`);
            if (!has) danger = true;
          }
        }
        const line = meltLineAU(f.lum);
        const reach = flashReach(f.energy);
        add({
          kind: 'flash',
          title: `${g.name} will fall into its ${sys.primary.kind === 'black_hole' ? 'black hole' : sys.primary.kind === 'brown_dwarf' ? 'brown dwarf' : 'star'} in a flash`,
          text: [
            `Gravitational waves are draining its orbit. Its gas will pour onto the ${sys.primary.kind === 'black_hole' ? 'hole' : sys.primary.kind === 'brown_dwarf' ? 'dwarf' : 'star'} faster than it can take it in, and the ${sys.primary.kind === 'black_hole' ? 'hole' : 'star'} will shine at its limit, some ${Number(f.lum.toPrecision(2)).toLocaleString('en-US')} Suns, for about ${formatYears(Math.max(1, Number(f.years.toPrecision(2))))}. The ground melts out to about ${line < 10 ? line.toFixed(1) : Math.round(line)} AU, and the nearest small worlds boil away.`,
            ...ours,
            `Burst Catchers bank it out to about ${reach < 10 ? reach.toFixed(1) : Math.round(reach)} light-years.`,
          ]
            .filter(Boolean)
            .join(' '),
          dueYears: at,
          bodyId: g.id,
          systemId: sid,
          severity: danger ? 'danger' : 'warn',
        });
      }
    }
  }

  // worlds of ours a new star will boil away (or its giant swallow) as this turn ends
  for (const c of colonies(state)) {
    const b = state.bodies[c.bodyId];
    const boil = b ? boilingAway(state, b) : null;
    if (!b || !boil) continue;
    const L = turnStep(state).turnLength;
    add({
      kind: 'boil',
      title: boil === 'swallowed' ? `${b.name} will be swallowed by its star` : `${b.name} will boil away`,
      text: `${boil === 'swallowed' ? 'Its star is swelling into a giant over it.' : 'Its new star is too hot for it: the rock itself will boil off into space.'} It is gone as this turn ends: three in four of the people there will get off to the Deep, the rest will be lost.`,
      dueYears: isFinite(L) ? years + L : Infinity,
      bodyId: b.id,
      systemId: b.systemId,
      severity: 'danger',
    });
  }

  // the end of the age: where the Degenerate Age ends depends on the fate of matter, and while
  // that is unknown the warning stands at the earliest it could be, so its date gives nothing away
  const d = ERA_BY_ID[state.era];
  const fate = fateOf(state);
  const known = protonFateKnown(state);
  if (state.era === 'degenerate') {
    if (!known)
      add({ kind: 'crossing', title: 'The end of the Degenerate Age?', text: 'No one knows yet what becomes of matter. If protons decay, it dissolves near η 39, and only minds moved onto leptonic substrates, or living around black holes, will continue. If space itself slowly unmakes it, the neutron stars burst near η 68 and worlds last until η 90. If neither, nothing at all happens: the dead stars simply grow colder than the black holes, near η 30. The Proton Question would tell us; the neutron stars will, near η 30.', dueYears: Math.pow(10, FATE_SHOWN_AT), severity: 'danger' });
    else if (fate === 'decay') add({ kind: 'crossing', title: 'The Great Decay', text: 'Ordinary matter dissolves. Only minds moved onto leptonic substrates, or living around black holes, will continue.', dueYears: Math.pow(10, DEGENERATE_END.decay), severity: 'danger' });
    else if (fate === 'stable') add({ kind: 'crossing', title: 'The Last Warmth', text: 'The neutron stars, the last things warm of their own accord, cool below the faint glow of the black holes. Nothing dissolves: matter endures, frozen, and gives nothing back. From then on only the black holes are sources, and Kin will need warmth no star can give.', dueYears: Math.pow(10, DEGENERATE_END.stable), severity: 'warn' });
    else add({ kind: 'crossing', title: 'The Last Warmth', text: 'The neutron stars burst, one after another, at a tenth of a Sun: whatever is settled at one is lost, unless it is on a world flung loose from it long before, far away by then. Burst Catchers in other systems bank a share of the flash, the more the nearer they are. After that only the black holes are warm, and space goes on unmaking the rest: the dwarfs fade by η 85, worlds by η 90.', dueYears: Math.pow(10, DEGENERATE_END.curvature), severity: 'danger' });
  } else if (state.era !== 'dark') {
    const titles: Record<string, string> = { dusk: 'The Last Light', blackhole: 'The Last Horizon' };
    const texts: Record<string, string> = {
      dusk: 'Every remaining star leaves the main sequence. Whatever depends on starlight must be ready to do without it.',
      blackhole: 'The last black holes evaporate. After this there are no more sources.',
    };
    add({ kind: 'crossing', title: titles[state.era], text: texts[state.era], dueYears: Math.pow(10, d.endEta), severity: 'danger' });
  }
  // curvature radiation, once we know it: the end of matter, and the stars we live at that will go
  if (known && fate === 'curvature' && state.civ.flags.matter_gone === undefined) {
    add({ kind: 'evaporation_all', title: 'The Great Evaporation', text: 'Every world, every dead star and every scrap of ordinary matter will have evaporated. Only minds on leptonic substrate, living around the black holes that are left, go on.', dueYears: Math.pow(10, MATTER_END.curvature), severity: 'danger' });
    for (const sid of colonized) {
      const sys = state.systems[sid];
      const k = sys.primary.kind;
      const at = k === 'neutron_star' ? DEGENERATE_END.curvature : k === 'white_dwarf' || k === 'black_dwarf' ? dwarfFadeEta(sys.primary.mass) : k === 'brown_dwarf' ? BROWN_FADE_ETA : Infinity;
      if (!isFinite(at) || at <= state.eta) continue;
      // a settlement on a world flung loose from it long ago is far away, and safe
      const lost = colonies(state).some((c) => c.systemId === sid && inItsSystem(state, c));
      if (k === 'neutron_star') add({ kind: 'burst', title: `${sys.name} will burst`, text: lost ? 'Its neutron star, its mass given to the curvature of space, will burst at a tenth of a Sun: our settlements in its Deep and on the worlds it holds will be lost with it. Move what can be moved.' : 'Its neutron star, its mass given to the curvature of space, will burst at a tenth of a Sun. Our settlements here are on worlds flung loose from it long ago, far away by now, and safe.', dueYears: Math.pow(10, at), systemId: sid, severity: lost ? 'danger' : 'info' });
      else add({ kind: 'fade', title: `${sys.name} will fade`, text: 'Space is turning its dwarf’s mass into particles; when it is gone its worlds drift loose, and our settlements stay, with nothing there to warm them.', dueYears: Math.pow(10, at), systemId: sid, severity: 'warn' });
    }
  }

  // the Long Flow, if matter lasts that long: whatever no one is awake to mend flows away
  if (known && flowAhead(state)) add({ kind: 'flow', title: 'The Long Flow', text: 'From about 10⁶⁵ years even iron flows, its atoms tunnelling out of place: whatever no one is awake to mend runs into smooth lumps. A settlement with no one awake loses a structure a turn, Cryo Halls last, their sleepers with them; minds that think more slowly than the flow keep watchers awake, at half again their upkeep; ruins no one is digging are lost.', dueYears: Math.pow(10, FLOW_ETA), severity: 'warn' });
  if (flowing(state) || (known && flowAhead(state))) {
    const step = turnStep(state);
    const logL = logTurnLength(step);
    const mods = computeMods(state);
    const near = flowing(state) || tideTurnsTo(state, Math.pow(10, FLOW_ETA), 10) <= 10;
    for (const c of near ? colonies(state) : []) {
      if (keeping(c, logL, mods) !== 'unmanned' || !nextToFlow(c)) continue;
      const due = flowing(state) ? (isFinite(step.turnLength) ? years + step.turnLength : Infinity) : Math.pow(10, FLOW_ETA);
      add({ kind: 'flowing', title: flowing(state) ? `${c.name} is flowing away` : `${c.name} will flow away`, text: 'No one is awake there to mend it: a structure a turn will run into smooth lumps, the cheapest first, Cryo Halls last, and their sleepers with them. Wake someone, send someone, or take apart what is worth keeping.', dueYears: due, systemId: c.systemId, bodyId: c.bodyId, severity: 'danger' });
    }
  }

  // epoch milestones of the Degenerate Age
  if (calendarEra(state) === 'degenerate') {
    if (state.eta < 18.4) add({ kind: 'evaporation', title: 'Galactic evaporation begins', text: 'Close encounters will start flinging whole systems out of the Coalescence. A few will fall into the Heart.', dueYears: Math.pow(10, 18.4), severity: 'warn' });
    if (haloEta(state) < 22) {
      const text = !haloMoved(state)
        ? 'The dark-matter halo is being used up. White dwarfs will cool toward black dwarfs by η 25.'
        : `The dark-matter halo is being used up, ${siphonsRunning(state) ? 'faster while our Halo Siphons run' : 'sooner for what our Halo Siphons drew'}. White dwarfs will cool toward black dwarfs by about η ${embersOutEta(state).toFixed(1)}.`;
      add({ kind: 'embers', title: 'The embers begin to fade', text, dueYears: haloReachesYears(state, 22), severity: 'warn' });
    }
    if (protonFateKnown(state) && state.protonsDecay && state.eta < 37.5) add({ kind: 'decay', title: 'Proton decay takes hold', text: 'Matter will begin to dissolve in earnest.', dueYears: Math.pow(10, 37.5), severity: 'danger' });
  }

  // black holes we live on
  if (calendarEra(state) === 'blackhole' || state.era === 'blackhole') {
    for (const sid of colonized) {
      const p = state.systems[sid].primary;
      if (p.evaporateAt && p.evaporateAt > years) add({ kind: 'evaporate', title: `${state.systems[sid].name} will evaporate`, text: 'Its Hawking radiation brightens as it shrinks, ending in a final burst that Burst Catchers here can bank. Its worlds then drift loose, and our settlements stay, with nothing left there to draw on: its spin, its Hawking light and its glow go with it, and Horizon Vaults here, which store energy in its spin, will hold nothing.', dueYears: p.evaporateAt, systemId: sid, severity: 'warn' });
    }
  }

  // the galaxy's free energy
  const prev = state.flags.gfe_prev ?? 1;
  const rate = prev - state.gfe;
  state.flags.gfe_prev = state.gfe;
  if (state.gfe < 0.92 || rate > 0.002) {
    add({
      kind: 'gfe',
      title: `Galactic free energy at ${Math.round(state.gfe * 100)}%`,
      text: rate > 0.0005 ? `Falling about ${(rate * 100).toFixed(2)}% per turn. Every source and deposit yields less for everyone, and the Hunger is the main reason.` : 'Every source and deposit yields a little less for everyone.',
      dueYears: Infinity,
      severity: state.gfe < 0.6 ? 'danger' : 'warn',
    });
  }

  // swarms heading our way, as far as we see them; Hunger Studies reads when they will come
  // (sight.ts), and under the Communion Charter they come to join us (hunger.ts: commune)
  const seen = swarmSight(state);
  const reads = readsSwarms(state);
  const communion = hasCharter(state, 'communion_charter');
  for (const sw of Object.values(state.swarms)) {
    if (sw.tamed || !sw.to || !seen(sw)) continue;
    if (!colonized.has(sw.to)) continue;
    const name = state.systems[sw.to].name;
    add(
      communion
        ? { kind: 'hunger', title: `A swarm is coming to join us at ${name}`, text: 'Under the Communion Charter it will merge into our Lattice there, and its appetite will come with it (Taint).', dueYears: reads ? swarmArrives(state, sw) : Infinity, systemId: sw.to, severity: 'info' }
        : { kind: 'hunger', title: `A swarm is heading for ${name}`, text: reads ? 'It has smelled the heat of our settlement. Hunger Studies reads its way: it arrives at the speed it crosses at now.' : 'It has smelled the heat of our settlement.', dueYears: reads ? swarmArrives(state, sw) : Infinity, systemId: sw.to, severity: 'danger' },
      `hunger:${sw.id}`,
    );
  }

  out.sort((a, b) => a.dueYears - b.dueYears);
  state.forecasts = out;
}
