import type { GameState, Mind } from '../types';
import type { Mods } from './mods';
import { canConverse, sendSignal, voiceClock } from './signals';
import { capital, clamp, colonies, distLy, log, withRng } from './util';

// Two minds that are not like you at all.
// The Slow Ones live around the Heart and think one thought per age.
// The Unlit are made of the matter you cannot see. (Spoilers: docs/spoilers/dark-matter.md)

function heartDistance(state: GameState): number {
  const cap = capital(state);
  const heart = Object.values(state.systems).find((s) => s.special === 'core');
  if (!cap || !heart) return 0;
  return distLy(state.systems[cap.systemId], heart);
}

export function slowClock(state: GameState, logL: number): number {
  return state.era === 'dusk' ? 6.5 : logL + 2;
}

export function unlitClock(state: GameState, logL: number): number {
  return state.era === 'dusk' ? 7 : logL + 1;
}

export function updateMinds(state: GameState, logL: number, _mods: Mods) {
  const civ = state.civ;
  const my = voiceClock(state, logL);
  const slow = state.minds.slow;
  const dark = state.minds.dark;
  slow.clock = slowClock(state, logL);
  dark.clock = unlitClock(state, logL);

  // ---------------------------------------------------------------- the Slow Ones
  if (civ.taint > 60 && !slow.flags.silent && slow.stage > 0) {
    slow.flags.silent = 1;
    sendSignal(state, { from: 'slow', kind: 'slow_silent', distanceLy: 0, title: 'The Slow Ones have stopped answering', text: 'Their last message is a single, very long pause. The pattern around the Heart goes dark, and stays dark.' });
  }
  if (!slow.flags.silent) {
    if (slow.stage === 0 && civ.techs.includes('deep_listening') && (state.era !== 'dusk' || state.eraTurn >= 20)) {
      slow.stage = 1;
      sendSignal(state, {
        from: 'astronomers',
        kind: 'slow_anomaly',
        distanceLy: 0,
        title: 'A pattern at the Heart',
        text: 'Near the Heart, a white dwarf dims and brightens. The intervals are prime numbers of millennia. Our astronomers have watched it for three turns of the long record and it has not repeated. Someone is counting, very slowly.',
      });
    } else if (slow.stage === 1 && canConverse(my, slow.clock, 2.5)) {
      slow.stage = 2;
      sendSignal(state, {
        from: 'slow',
        kind: 'slow_first',
        distanceLy: heartDistance(state),
        title: 'The Slow Ones answer',
        text: 'Our clocks are finally close enough. What comes back is not words, but a proof, laid out across a hundred thousand years of flickers: that a finite store of energy can pay for an unlimited number of thoughts, if each thought is slower than the last. At the end of the proof there is a gap, as if waiting for us.',
        choices: [
          { id: 'math', label: 'Fill the gap with mathematics', hint: 'Show them you can follow.' },
          { id: 'history', label: 'Answer with our history', hint: 'Show them who we are.' },
          { id: 'silence', label: 'Wait', hint: 'Say nothing yet.' },
        ],
      });
    } else if (slow.stage === 3 && slow.understanding >= 45 && canConverse(my, slow.clock, 2.5)) {
      slow.stage = 4;
      civ.flags.slow_gift = 1;
      sendSignal(state, {
        from: 'slow',
        kind: 'slow_gift',
        distanceLy: heartDistance(state),
        title: 'The Slow Ones share the seam',
        text: 'They show us something they have been working on since before our star was born: a way to write on the boundary where one universe ends and another may begin. They cannot finish it alone. They ask us to keep a presence at the Heart until the very end. (Conformal Mathematics costs less; the Aeon Seed becomes possible.)',
      });
    }
  }

  // ---------------------------------------------------------------- the Unlit
  withRng(state, (rng) => {
    if (dark.stage === 0 && civ.techs.includes('halo_dynamics')) {
      dark.stage = 1;
      sendSignal(state, {
        from: 'astronomers',
        kind: 'dark_anomaly',
        distanceLy: 0,
        title: 'Mass without light',
        text: 'A star behind our reach brightened for eleven days, lensed by something we cannot see. Two planets in the home reach are precessing a little wrong. The halo maps show a knot of invisible mass moving against the flow of everything around it. Whatever it is, it has weight and no light.',
      });
    }
    if (dark.stage === 1 && civ.techs.includes('gravitic_semaphore')) {
      dark.stage = 2;
      dark.lastPattern = newPattern(() => rng.next());
      sendSignal(state, {
        from: 'dark',
        kind: 'dark_first',
        distanceLy: 0,
        title: 'Something moved the moon',
        text: `We moved an asteroid in the pattern of the first primes. Four years later, one of our moons shifted in its orbit: ${dark.lastPattern.join(' · ')}. It is an answer. It is also a warning of how easily they could move more than a moon. (Open Signals to answer with a gravitational gesture.)`,
      });
    }
    if (dark.stage === 2 && dark.understanding >= 40) {
      dark.stage = 3;
      sendSignal(state, {
        from: 'dark',
        kind: 'dark_reveal1',
        distanceLy: 0,
        title: 'The warmth of the embers',
        text: 'After long exchanges the meaning becomes clear, and we wish it had not. The embers, the white dwarfs we harvest, are warm because dark matter falls into them and annihilates. That dark matter is them. Every ember we live on is burning their kind.',
        choices: [
          { id: 'ease', label: 'Take less from the embers', hint: 'Ember yields −25%. They will remember.' },
          { id: 'promise', label: 'Promise to find another way', hint: 'Nothing changes yet.' },
          { id: 'keep', label: 'We cannot afford mercy', hint: 'They will remember that too.' },
        ],
      });
    }
    if (dark.stage === 3 && dark.understanding >= 70) {
      dark.stage = 4;
      sendSignal(state, {
        from: 'dark',
        kind: 'dark_reveal2',
        distanceLy: 0,
        title: 'They are not dying. They are choosing.',
        text: 'The falling is deliberate. For all the ages of the universe they have been invisible, touching everything and seen by nothing. Their pilgrimage into the embers is the only way they can ever make light. Now they want to do it once, all together: gather the last of the halo into one place and burn it as a star. A dark star, the last new star there will ever be. They need mass to seed it, and they need us to stop draining the halo.',
        choices: [
          { id: 'help', label: 'Help gather the Last Star', hint: 'Costs 200 matter and 100 energy. Requires not using Halo Siphons.' },
          { id: 'refuse', label: 'Refuse', hint: 'Their light is not our concern.' },
        ],
      });
    }
    if (dark.flags.gathering && state.turn >= dark.flags.gathering) {
      delete dark.flags.gathering;
      igniteDarkStar(state);
    }
    // exploitation has consequences: they can move worlds
    if (dark.stage >= 2 && state.era === 'degenerate' && (civ.techs.includes('halo_siphons') || dark.flags.hostile) && rng.chance(0.08)) {
      const c = rng.pick(colonies(state));
      if (c) {
        const b = state.bodies[c.bodyId];
        const sys = state.systems[c.systemId];
        if (b.kind !== 'deep' && rng.chance(0.5)) {
          b.rogue = true;
          log(state, `An invisible mass passed through ${sys.name}. ${b.name} has been flung loose from its star.`, 'bad', sys.id);
        } else if (!sys.ejected) {
          sys.ejected = true;
          log(state, `Something unseen pulled ${sys.name} out of the galaxy’s grip. It is drifting into the void.`, 'bad', sys.id);
        }
      }
    }
  });

  slow.understanding = clamp(slow.understanding, 0, 100);
  dark.understanding = clamp(dark.understanding, 0, 100);
}

export function newPattern(rand: () => number): number[] {
  const kind = Math.floor(rand() * 3);
  const a = 1 + Math.floor(rand() * 6);
  const d = 1 + Math.floor(rand() * 4);
  if (kind === 0) return [a, a + d, a + 2 * d];
  if (kind === 1) return [a, a + d + 1, a];
  return [a, a, a];
}

export function patternAnswer(p: number[]): 'continue' | 'mirror' | 'resonance' {
  if (p.length === 3 && p[0] === p[1] && p[1] === p[2]) return 'resonance';
  if (p.length === 3 && p[0] === p[2]) return 'mirror';
  return 'continue';
}

/** Answer the Unlit by moving mass. */
export function gesture(state: GameState, answer: 'continue' | 'mirror' | 'resonance' | 'silence'): string | null {
  const dark = state.minds.dark;
  const civ = state.civ;
  if (dark.stage < 2) return 'There is no one to answer yet.';
  if (civ.flags.gesture_turn === state.turn) return 'Masses can be moved only once per turn.';
  if (answer !== 'silence') {
    if (civ.energy < 15 || civ.matter < 10) return 'A gesture needs 15 energy and 10 matter.';
    civ.energy -= 15;
    civ.matter -= 10;
  }
  civ.flags.gesture_turn = state.turn;
  return withRng(state, (rng) => {
    const right = patternAnswer(dark.lastPattern);
    if (answer === 'silence') {
      dark.understanding += 2;
      log(state, 'We held still. The halo held still with us.', 'mind');
    } else if (answer === right) {
      dark.understanding += 14;
      log(state, 'Our gesture was understood. The reply came gently this time.', 'mind');
    } else {
      dark.understanding += 3;
      if (rng.chance(0.6)) misread(state, () => rng.next());
      else log(state, 'They did not seem to understand, but nothing broke.', 'mind');
    }
    dark.lastPattern = newPattern(() => rng.next());
    return null;
  });
}

function misread(state: GameState, rand: () => number) {
  const cs = colonies(state);
  if (!cs.length) return;
  const c = cs[Math.floor(rand() * cs.length)];
  const b = state.bodies[c.bodyId];
  const r = rand();
  if (r < 0.45) {
    if (b.vitality > 0) {
      b.vitality = Math.max(0, b.vitality - 0.1);
      log(state, `Their reply shook ${b.name}. Quakes, lost air, a thinner sky.`, 'bad', c.systemId);
    } else {
      // a world with no life left to lose: the quakes crack the settlement's hearth instead
      c.damage = Math.min(1, c.damage + 0.3);
      log(state, b.kind === 'deep' ? `Their reply wrenched ${c.name}: its hearth is cracked.` : `Their reply shook ${b.name}. Quakes cracked the hearth at ${c.name}.`, 'bad', c.systemId);
    }
  } else if (r < 0.8) {
    const alive = (['kin', 'echoes', 'lattice', 'chorus', 'coldminds'] as const).filter((t) => c.pops[t] > 0);
    if (alive.length) c.pops[alive[Math.floor(rand() * alive.length)]]--;
    log(state, `An asteroid nudged by their reply struck ${c.name}.`, 'bad', c.systemId);
  } else if (b.kind !== 'deep') {
    b.rogue = true;
    log(state, `A reply too strong: ${b.name} has been pulled loose from its star.`, 'bad', c.systemId);
  }
}

export function resolveMindSignal(state: GameState, sigUid: string, choice: string): string | null {
  const sig = state.signals.find((s) => s.uid === sigUid);
  if (!sig || sig.resolved) return 'Already answered.';
  const civ = state.civ;
  const slow: Mind = state.minds.slow;
  const dark: Mind = state.minds.dark;
  switch (sig.kind) {
    case 'slow_first':
      if (choice === 'math') slow.understanding += 22;
      if (choice === 'history') {
        slow.understanding += 15;
        civ.flags.insight_bank = (civ.flags.insight_bank ?? 0) + 120;
      }
      if (choice !== 'silence') slow.stage = 3;
      else slow.stage = 1;
      break;
    case 'dark_reveal1':
      if (choice === 'ease') {
        civ.flags.ember_restraint = 1;
        dark.understanding += 15;
      } else if (choice === 'promise') dark.understanding += 5;
      else {
        dark.understanding -= 10;
        dark.flags.hostile = 1;
      }
      break;
    case 'dark_reveal2':
      if (choice === 'help') {
        if (civ.techs.includes('halo_siphons')) return 'They will not gather while your siphons drain the halo.';
        if (civ.matter < 200 || civ.energy < 100) return 'Gathering needs 200 matter and 100 energy.';
        civ.matter -= 200;
        civ.energy -= 100;
        dark.flags.gathering = state.turn + 4;
        log(state, 'We began moving dead stars toward the gathering point. They began moving everything else.', 'mind');
      } else {
        dark.flags.hostile = 1;
        dark.understanding -= 20;
      }
      break;
    default:
      break;
  }
  sig.resolved = choice;
  return null;
}

function igniteDarkStar(state: GameState) {
  const halo = Object.values(state.systems).filter((s) => state.regions.find((r) => r.id === s.regionId)?.kind === 'globular' && !s.gone);
  const host = halo[0] ?? Object.values(state.systems).find((s) => s.primary.kind === 'white_dwarf' && !s.gone);
  if (!host) return;
  host.primary = { kind: 'dark_star', mass: 3, lum: 10, bornAt: state.years, diesAt: Math.max(state.years * 3, 1e25), spin: 0, spinMax: 0 };
  host.name = 'The Last Star';
  state.civ.known[host.id] = 2;
  state.gfe = Math.min(1, state.gfe + 0.1);
  state.civ.flags.unlit_gift = 1;
  state.minds.dark.stage = 5;
  sendSignal(state, {
    from: 'dark',
    kind: 'dark_star',
    distanceLy: 0,
    title: 'The Last Star',
    text: 'In the halo, a star has ignited, powered by dark matter annihilating in its heart. Everyone left in the Coalescence can see it. Its light is modulated, and when our astronomers decode it they find it is addressed to everything that can see: every ember they fed, every orbit they touched, and a gift for us, a way of writing across the end of the universe. The Unlit are becoming light.',
  });
}
