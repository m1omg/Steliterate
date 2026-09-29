import { ERA_BY_ID, formatYears, turnsUntil } from '../eras';
import { nextStellarChange } from '../physics';
import type { Forecast, GameState } from '../types';
import { turnsUntilYears } from './flare';
import { colonies, protonFateKnown } from './util';

// Forecasts: the astronomers' warnings. Every great change is visible in advance; the
// question is whether you can prepare in time.

export function forecastTurns(state: GameState, f: Forecast): number {
  if (state.era === 'dark') return Infinity;
  return turnsUntilYears(state, f.dueYears, 0);
}

export function updateForecasts(state: GameState) {
  const out: Forecast[] = [];
  const add = (f: Omit<Forecast, 'uid'>) => out.push({ ...f, uid: `${f.kind}:${f.systemId ?? ''}:${f.bodyId ?? ''}` });
  const colonized = new Set(colonies(state).map((c) => c.systemId));
  const years = state.years;
  const horizon = state.era === 'dusk' ? 60 : 40;

  // stars that matter to us
  for (const sid of colonized) {
    const sys = state.systems[sid];
    const ch = nextStellarChange(sys, years);
    if (!ch || !isFinite(ch.at)) continue;
    const f: Omit<Forecast, 'uid'> = {
      kind: 'star',
      title: `${sys.name} ${ch.what}`,
      text: ch.what.includes('brightens')
        ? `In about ${formatYears(ch.at - years)}. For a few billion years it will be over a hundred times brighter, hot enough to boil the seas of its worlds.`
        : `In about ${formatYears(ch.at - years)}.`,
      dueYears: ch.at,
      systemId: sid,
      severity: ch.what.includes('brightens') ? 'boon' : 'danger',
    };
    if (turnsUntil(state.era === 'dark' ? 'blackhole' : state.era, years, ch.at, state.settings.length) <= horizon) add(f);
  }

  // worlds that will fall into dead stars
  for (const c of colonies(state)) {
    const b = state.bodies[c.bodyId];
    if (!b || !b.inspiralAt || b.feeding || b.rogue || b.dissolved) continue;
    const sys = state.systems[b.systemId];
    const dead = ['white_dwarf', 'black_dwarf', 'neutron_star'].includes(sys.primary.kind) || state.era !== 'dusk';
    if (!dead || b.inspiralAt < years) continue;
    if (turnsUntil(state.era === 'dark' ? 'blackhole' : state.era, years, b.inspiralAt, state.settings.length) > horizon) continue;
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

  // the end of the era
  const d = ERA_BY_ID[state.era];
  if (state.era !== 'dark') {
    const end = Math.pow(10, d.endEta);
    const titles: Record<string, string> = { dusk: 'The Last Light', degenerate: 'The Great Decay', blackhole: 'The Last Horizon' };
    const texts: Record<string, string> = {
      dusk: 'Every remaining star leaves the main sequence. Whatever depends on starlight must be ready to do without it.',
      degenerate: state.protonsDecay || !protonFateKnown(state) ? 'Ordinary matter dissolves (if protons decay). Only minds moved onto leptonic substrates, or living around black holes, will continue.' : 'The age of remnants gives way to the age of black holes. Matter endures, frozen.',
      blackhole: 'The last black holes evaporate. After this there are no more sources.',
    };
    add({ kind: 'crossing', title: titles[state.era], text: texts[state.era], dueYears: end, severity: 'danger' });
  }

  // epoch milestones of the Degenerate Age
  if (state.era === 'degenerate') {
    if (state.eta < 18.4) add({ kind: 'evaporation', title: 'Galactic evaporation begins', text: 'Close encounters will start flinging whole systems out of the Coalescence. A few will fall into the Heart.', dueYears: Math.pow(10, 18.4), severity: 'warn' });
    if (state.eta < 22) add({ kind: 'embers', title: 'The embers begin to fade', text: 'The dark-matter halo is being used up. White dwarfs will cool toward black dwarfs by η 25.', dueYears: Math.pow(10, 22), severity: 'warn' });
    if (protonFateKnown(state) && state.protonsDecay && state.eta < 37.5) add({ kind: 'decay', title: 'Proton decay takes hold', text: 'Matter will begin to dissolve in earnest.', dueYears: Math.pow(10, 37.5), severity: 'danger' });
  }

  // black holes we live on
  if (state.era === 'blackhole') {
    for (const sid of colonized) {
      const p = state.systems[sid].primary;
      if (p.evaporateAt && p.evaporateAt > years) add({ kind: 'evaporate', title: `${state.systems[sid].name} will evaporate`, text: 'Its Hawking radiation brightens as it shrinks, ending in a final burst.', dueYears: p.evaporateAt, systemId: sid, severity: 'danger' });
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

  // swarms heading our way
  for (const sw of Object.values(state.swarms)) {
    if (sw.tamed || !sw.to) continue;
    if (!colonized.has(sw.to)) continue;
    add({ kind: 'hunger', title: `A swarm is heading for ${state.systems[sw.to].name}`, text: 'It has smelled the heat of our settlement.', dueYears: Infinity, systemId: sw.to, severity: 'danger' });
  }

  out.sort((a, b) => a.dueYears - b.dueYears);
  state.forecasts = out;
}
