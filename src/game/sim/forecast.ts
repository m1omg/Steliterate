import { ERA_BY_ID, formatYears, logTurnLength, turnsUntil } from '../eras';
import { BROWN_FADE_ETA, SURFACE_LIFE, boilingAway, dwarfFadeEta, embersOutEta, haloEta, haloMoved, haloReachesYears, lampsOver, nextStellarChange, siphonsRunning } from '../physics';
import type { Forecast, GameState } from '../types';
import { turnStep, turnsUntilYears } from './flare';
import { colonies, formOf, inItsSystem, protonFateKnown } from './util';
import { FLOW_ETA, flowAhead, flowing, keeping, nextToFlow } from './flow';
import { computeMods } from './mods';
import { DEGENERATE_END, FATE_SHOWN_AT, MATTER_END, calendarEra, fateOf, matterGone } from '../fate';
import { decayProof } from './crossing';
import { thinShare, thinning, thinningFrom } from './thinning';

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

/** Which of our settlements are still made of matter (neither made the Passage nor stand on anything decay-proof): named, for the forecasts. */
function stillOfMatter(state: GameState): string {
  const cs = colonies(state).filter((c) => formOf(c) === 'baryonic');
  const bare = cs.filter((c) => !decayProof(c)).map((c) => c.name);
  const kept = cs.filter((c) => decayProof(c)).map((c) => c.name);
  const names = (xs: string[]) => (xs.length > 6 ? `${xs.slice(0, 6).join(', ')} and ${xs.length - 6} more` : xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0]);
  if (!cs.length) return 'Nothing of ours is made of it any more.';
  return [bare.length ? `Still made of matter, with nothing to go on: ${names(bare)}.` : '', kept.length ? `Made of matter around what will go on (Leptonic Substrate, a Bastion Shell): ${names(kept)}; only the Passage keeps all of it.` : ''].filter(Boolean).join(' ');
}

export function updateForecasts(state: GameState) {
  const out: Forecast[] = [];
  const add = (f: Omit<Forecast, 'uid'>) => out.push({ ...f, uid: `${f.kind}:${f.systemId ?? ''}:${f.bodyId ?? ''}` });
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

  // worlds that will fall into dead stars
  for (const c of colonies(state)) {
    const b = state.bodies[c.bodyId];
    if (!b || !b.inspiralAt || b.feeding || b.rogue || b.dissolved) continue;
    const sys = state.systems[b.systemId];
    const dead = ['white_dwarf', 'black_dwarf', 'neutron_star'].includes(sys.primary.kind) || calendarEra(state) !== 'dusk';
    if (!dead || b.inspiralAt < years) continue;
    if (tideTurnsTo(state, b.inspiralAt, horizon) > horizon) continue;
    add({
      kind: 'inspiral',
      title: `${b.name} will reach its dead star’s tidal limit`,
      text: 'Gravitational waves are draining its orbit. The models disagree about what happens next.',
      dueYears: b.inspiralAt,
      bodyId: b.id,
      systemId: b.systemId,
      severity: 'warn',
    });
  }

  // worlds of ours a new star will boil away (or its giant swallow) as this turn ends
  for (const c of colonies(state)) {
    const b = state.bodies[c.bodyId];
    const boil = b ? boilingAway(state, b) : null;
    if (!b || !boil) continue;
    const L = turnStep(state, state.civ.pace).turnLength;
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
      add({ kind: 'crossing', title: 'The end of the Degenerate Age?', text: 'No one knows yet what becomes of matter. If protons decay, it dissolves near η 39, and only minds moved onto leptonic substrates will continue, drifting to the black holes. If space itself slowly unmakes it, the neutron stars burst near η 68 and worlds last until η 90. If neither, nothing at all happens: the dead stars simply grow colder than the black holes, near η 30. The Proton Question would tell us; the neutron stars will, near η 30.', dueYears: Math.pow(10, FATE_SHOWN_AT), severity: 'danger' });
    else if (fate === 'decay') add({ kind: 'crossing', title: 'The Great Decay', text: 'Ordinary matter dissolves, from η 37.5 one system at a time. Only what was re-encoded goes on, drifting to the black holes, the only sources left: a settlement that made the Passage whole, one on Leptonic Substrate with only that. The rest is lost.', dueYears: Math.pow(10, DEGENERATE_END.decay), severity: 'danger' });
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
  if (known && fate === 'curvature' && state.flags.matter_gone === undefined) {
    add({ kind: 'evaporation_all', title: 'The Great Evaporation', text: 'Every world, every dead star and every scrap of ordinary matter will have evaporated. Only what was re-encoded goes on, around the black holes that are left: a settlement that made the Passage whole, one on Leptonic Substrate with only that. The rest is lost.', dueYears: Math.pow(10, MATTER_END.curvature), severity: 'danger' });
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
    const step = turnStep(state, state.civ.pace);
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
    if (protonFateKnown(state) && state.protonsDecay && state.eta < 37.5) add({ kind: 'decay', title: 'Proton decay takes hold', text: `Matter will begin to dissolve in earnest, system by system, and whatever is still made of it will thin with it, structure by structure, until the Great Decay. ${stillOfMatter(state)}`, dueYears: Math.pow(10, 37.5), severity: 'danger' });
  }
  // the Thinning, once we know matter will end (thinning.ts): what is still made of it
  if (known && fate !== 'stable' && !matterGone(state)) {
    const from = thinningFrom(state);
    if (thinning(state)) add({ kind: 'thinning', title: 'The Thinning', text: `Ordinary matter is ${fate === 'decay' ? 'dissolving' : 'evaporating'}: ${Math.round(thinShare(state) * 100)}% of it is gone, and what is still made of it fails with it, structure by structure. ${stillOfMatter(state)}`, dueYears: Math.pow(10, MATTER_END[fate]), severity: 'danger' });
    else if (fate === 'curvature' && state.eta < from) add({ kind: 'thinning', title: 'The Thinning', text: `Once the brown dwarfs have faded the worlds themselves evaporate, and whatever is still made of matter will fail with them, structure by structure, until the Great Evaporation. ${stillOfMatter(state)}`, dueYears: Math.pow(10, from), severity: 'warn' });
  }

  // black holes we live on
  if (calendarEra(state) === 'blackhole' || state.era === 'blackhole') {
    for (const sid of colonized) {
      const p = state.systems[sid].primary;
      // (what we wrote into its horizon comes back out with it, horizon.ts)
      const written = colonies(state).some((c) => c.systemId === sid && formOf(c) === 'horizon');
      if (p.evaporateAt && p.evaporateAt > years) add({ kind: 'evaporate', title: `${state.systems[sid].name} will evaporate`, text: `Its Hawking radiation brightens as it shrinks, ending in a final burst that Burst Catchers here can bank. Its worlds then drift loose, and our settlements stay, with nothing left there to draw on: its spin, its Hawking light and its glow go with it, and Horizon Vaults here, which store energy in its spin, will hold nothing. A leptonic settlement can drift to another black hole before then (its panel).${written ? ' What we wrote into its horizon will be written back out, leptonic, half its Lattice lost, and drift on.' : ''}`, dueYears: p.evaporateAt, systemId: sid, severity: 'warn' });
    }
  }

  // the galaxy's free energy
  const prev = state.civ.flags.gfe_prev ?? 1;
  const rate = prev - state.gfe;
  state.civ.flags.gfe_prev = state.gfe;
  if (state.gfe < 0.92 || rate > 0.002) {
    add({
      kind: 'gfe',
      title: `Galactic free energy at ${Math.round(state.gfe * 100)}%`,
      text: rate > 0.0005 ? `Falling about ${(rate * 100).toFixed(2)}% per turn. Every source and deposit yields less for everyone, and the Hunger is the main reason.` : 'Every source and deposit yields a little less for everyone.',
      dueYears: Infinity,
      severity: state.gfe < 0.6 ? 'danger' : 'warn',
    });
  }

  // swarms heading our way
  for (const sw of Object.values(state.swarms)) {
    if (sw.tamed || !sw.to) continue;
    if (!colonized.has(sw.to)) continue;
    add({ kind: 'hunger', title: `A swarm is heading for ${state.systems[sw.to].name}`, text: 'It has smelled the heat of our settlement.', dueYears: Infinity, systemId: sw.to, severity: 'danger' });
  }

  out.sort((a, b) => a.dueYears - b.dueYears);
  state.civ.forecasts = out;
}
