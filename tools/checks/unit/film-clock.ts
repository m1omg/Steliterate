// A film's clock (15 Oct): the time of the sound being heard, carried on to each frame's own time.
// The check found by the project check of 15 Oct: where the output's timestamp cannot be trusted,
// the context's clock was carried on by the page's time without end, so a sound that stopped (a
// suspended or interrupted context, a stalled audio thread) left the film running on in silence,
// then frozen until the sound caught up. Now it is carried on for a long step's length at most (250 ms),
// and only while the sound runs.
import { audioClock } from '../../../src/film/player';
import { check, done } from '../lib';

/** A context as far as the clock reads it: its time, its state, and (optionally) its output's timestamp. */
interface Fake {
  currentTime: number;
  state: string;
  getOutputTimestamp?: () => { contextTime?: number; performanceTime?: number };
}
const clockOf = (ctx: Fake, at: number) => audioClock(ctx as unknown as AudioContext, at);

// no timestamp: the context's clock, stepping by its buffer (23.2 ms), read at 60 frames a second
{
  const ctx: Fake = { currentTime: 1, state: 'running' };
  const clock = clockOf(ctx, 1);
  const shown: number[] = [];
  for (let i = 0; i < 120; i++) {
    const p = 1000 + i * (1000 / 60);
    // the context's clock: its last whole step before this moment
    ctx.currentTime = 1 + Math.floor((p - 1000) / 23.22) * 0.02322;
    shown.push(clock.now(p));
  }
  const steps = shown.slice(1).map((t, i) => t - shown[i]);
  check(
    steps.every((d) => d >= 0) && steps.filter((d) => d === 0).length === 0,
    `no timestamp: every frame moves on (${steps.filter((d) => d === 0).length} repeats in 119)`,
  );
  check(Math.abs(shown[119] - 119 / 60) < 0.03, `and keeps time with the sound (${shown[119].toFixed(3)} s after 1.983 s)`);
}

// a stalled audio thread: the clock stops while the context says it runs; the film holds within a step
{
  const ctx: Fake = { currentTime: 2, state: 'running' };
  const clock = clockOf(ctx, 1);
  clock.now(5000);
  const a = clock.now(5100);
  const b = clock.now(6000);
  const c = clock.now(9000);
  check(a > 1.09 && a < 1.11, `carried on between steps (${a.toFixed(3)} s, 100 ms on)`);
  check(b <= 1.25 + 1e-9 && c <= 1.25 + 1e-9, `a stopped clock holds the film within 250 ms (${b.toFixed(3)}, ${c.toFixed(3)} s after 1 s and 4 s)`);
  ctx.currentTime = 2.3;
  const d = clock.now(9010);
  check(Math.abs(d - 1.3) < 1e-9, `and it moves on with the sound again (${d.toFixed(3)} s)`);
}

// a suspended context (an interruption): the film waits for its sound
{
  const ctx: Fake = { currentTime: 3, state: 'running' };
  const clock = clockOf(ctx, 1);
  const a = clock.now(1000);
  ctx.state = 'suspended';
  const b = clock.now(1050);
  const c = clock.now(4000);
  check(Math.abs(a - 2) < 1e-9 && Math.abs(b - 2) < 1e-9 && Math.abs(c - 2) < 1e-9, `suspended, the film waits (${a.toFixed(3)} → ${c.toFixed(3)} s over 3 s)`);
  ctx.state = 'running';
  ctx.currentTime = 3.05;
  const d = clock.now(4010);
  check(Math.abs(d - 2.05) < 1e-9, `resumed, it goes on from there (${d.toFixed(3)} s)`);
}

// a timestamp to trust: the sample being heard (72 ms behind the context's clock), carried on to the frame's time
{
  const ctx: Fake = { currentTime: 10, state: 'running', getOutputTimestamp: () => ({ contextTime: 9.928, performanceTime: 2000 }) };
  const clock = clockOf(ctx, 9);
  const a = clock.now(2016);
  check(Math.abs(a - (0.928 + 0.016)) < 1e-9, `the output's timestamp: the sound heard, at the frame's time (${a.toFixed(4)} s)`);
  // Firefox before its output has played anything: zeros, not trusted
  ctx.getOutputTimestamp = () => ({ contextTime: 0, performanceTime: 0 });
  ctx.currentTime = 10.5;
  const b = clock.now(2516);
  check(Math.abs(b - 1.5) < 1e-9, `a timestamp of zeros is not trusted: the context's clock (${b.toFixed(4)} s)`);
  // one far ahead of the clock (a stale reading) is not trusted either, and time never goes backwards
  ctx.getOutputTimestamp = () => ({ contextTime: 12, performanceTime: 2516 });
  const c = clock.now(2520);
  check(c >= b && c < 1.52, `a timestamp ahead of the clock is not trusted, and time never goes back (${c.toFixed(4)} s)`);
}

done('FILM CLOCK');
