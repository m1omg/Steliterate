import { useEffect, useMemo, useRef } from 'preact/hooks';
import { EVENT_BY_ID } from '../../game/data/events';
import { bodyClimate, buriedOcean, waterState } from '../../game/physics';
import { naturalKinRoom } from '../../game/sim/fleets';
import { lastsUntil, matterAt, powerAt, siteValue } from '../../game/sim/sites';
import { habitabilityOf } from '../../game/sim/terraform';
import type { Body, GameState } from '../../game/types';
import { sfx } from '../../audio/sfx';
import { kelvin } from '../fmt';
import { Icon } from '../Icon';
import { PRIMARY_NAME, bodyKindName } from '../labels';
import { NEEDS, type Need } from '../siteStrip';
import { engine, modal, rev, revealing, settings } from '../store';
import { Plate, eventResult, loreView, worldFinds } from '../screens/Story';

// where the survey reveal has come to: in the store, as the event cards wait for it (Story.tsx)
export { revealing };

/** Skip the reveal: this system's worlds at once; `all`, and the other systems charted, which open without one. */
export function skipReveal(all = false) {
  sfx('click');
  engine()?.skipReveal(all);
}

/** Next: on to the reveal's next world now. */
export function nextReveal() {
  sfx('click');
  engine()?.nextReveal();
}

/**
 * The survey reveal's caption (part 4; since 21 Oct over a flight of the camera, as in Endless
 * Space 2): top left over the view, the rest of the interface stepping aside while the camera flies
 * (in the magnifier mode it stays, and the caption has its place in the column). At the star its
 * name; at each world its name, then its kind, how it is to live on, its warmth, its water and what
 * the survey found there, typed in line by line, and four bars filling, one for each kind of
 * settler; on the way out how many worlds were charted. Next (Space, or a click on the view) goes
 * on to the next world. Enter and Escape skip it, before the game's own keys see them, so neither
 * ends the turn underneath it.
 */
export function RevealCard({ s }: { s: GameState }) {
  void rev.value;
  const r = revealing.value;
  const on = !!r;
  const lv = !!settings.value.lowVision;
  const cine = on && !lv;
  // the rest of the interface steps aside while the camera flies (styles.css: html.cine), and is
  // back once it is over
  useEffect(() => {
    document.documentElement.classList.toggle('cine', cine);
  }, [cine]);
  useEffect(() => () => document.documentElement.classList.remove('cine'), []);
  useEffect(() => {
    if (!on) return;
    const keys = (e: KeyboardEvent) => {
      const next = e.key === ' ';
      if ((e.key !== 'Enter' && e.key !== 'Escape' && !next) || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // (a button in focus answers Space itself; held down, Space goes no further than once)
      if (next && (tag === 'BUTTON' || e.repeat)) return;
      // (a window over it answers its own keys; an event waits for the flight to end: Story.tsx)
      if (modal.value || eventResult.value || loreView.value) return;
      e.preventDefault();
      e.stopPropagation();
      if (next) nextReveal();
      else skipReveal(false);
    };
    window.addEventListener('keydown', keys, true);
    return () => window.removeEventListener('keydown', keys, true);
  }, [on]);
  // the world last arrived at: on the way to the next its lines fade out
  const held = useRef<string | null>(null);
  if (r?.phase === 'hold') held.current = r.bodyId;
  // the best power and matter of every world charted, for the bars (once a reveal)
  const best = useMemo(() => (r ? bestSites(s) : null), [r?.systemId, s.turn]);
  if (!r) return null;
  const sys = s.systems[r.systemId];
  if (!sys) return null;
  const at = r.phase === 'hold' ? r.bodyId : r.phase === 'fly' ? held.current : null;
  const b = at ? s.bodies[at] : null;
  const counted = r.index >= 0 && r.index < r.total;
  const worlds = `${r.total} world${r.total === 1 ? '' : 's'}`;
  return (
    <div class={`reveal-card ${lv ? 'panel' : 'cine-caption'} rc-${r.phase}`} role="status" aria-live="polite" aria-label={`Survey of ${sys.name}`}>
      <div class="rc-top">
        <span class="eyebrow">
          Survey · {sys.name}
          {counted ? ` · ${r.index + 1} of ${r.total}` : ''}
        </span>
        <span class="rc-btns">
          {r.phase !== 'outro' && (
            <button class="btn small ghost" data-tip="On to the next world (Space, or a click on the view)" onClick={nextReveal}>
              Next
            </button>
          )}
          <button class="btn small" data-tip="Every world of this system now (Enter or Esc)" onClick={() => skipReveal(false)}>
            Skip
          </button>
          <button class="btn small ghost" data-tip="Every world now, and the other systems just charted open without a reveal" onClick={() => skipReveal(true)}>
            Skip all
          </button>
        </span>
      </div>
      {r.phase === 'intro' && (
        <div class="rc-world" key="intro">
          <div class="rc-name">{sys.name}</div>
          <div class="rc-lines">
            <div class="rc-line" style={{ '--i': 0 }}>
              {PRIMARY_NAME[sys.primary.kind]} · {worlds} to chart
            </div>
          </div>
        </div>
      )}
      {b && best && <WorldLines key={b.id} s={s} b={b} best={best} leaving={r.phase === 'fly'} />}
      {r.phase === 'outro' && (
        <div class="rc-world" key="outro">
          <div class="rc-name">{worlds} charted</div>
        </div>
      )}
    </div>
  );
}

/** The best power and matter among every world charted: a world's bars are measured against them. */
function bestSites(s: GameState): { echoes: number; lattice: number } {
  let echoes = 0;
  let lattice = 0;
  for (const sys of Object.values(s.systems)) {
    if (s.civ.known[sys.id] !== 2 || sys.gone) continue;
    for (const id of sys.bodies) {
      const b = s.bodies[id];
      if (!b || b.dissolved) continue;
      echoes = Math.max(echoes, powerAt(s, b));
      lattice = Math.max(lattice, matterAt(s, b));
    }
  }
  return { echoes, lattice };
}

/**
 * How each kind of settler would fare there, out of five: Livable from how habitable it is and
 * its room for Kin (two at least with room, one at most without); Power and Matter against the best
 * world charted; Lasting by how long it has left against the universe's age now (as long: three;
 * a hundred times as long, or never falling in: five).
 */
function bars(s: GameState, b: Body, best: { echoes: number; lattice: number }): { need: Need; level: number; label: string }[] {
  const of = (x: number, top: number) => (x <= 0 ? 0 : top <= 0 ? 1 : Math.max(1, Math.min(5, Math.round((5 * x) / top))));
  return NEEDS.map(({ need }) => {
    const v = siteValue(s, b, need);
    let level = 0;
    if (v.score >= 0) {
      if (need === 'kin') {
        const hab = habitabilityOf(s, b) * b.vitality;
        level = naturalKinRoom(b, s) > 0 ? Math.min(5, 2 + Math.round(3 * hab)) : hab >= 0.3 ? 1 : 0;
      } else if (need === 'echoes') level = of(powerAt(s, b), best.echoes);
      else if (need === 'lattice') level = of(matterAt(s, b), best.lattice);
      else {
        const left = lastsUntil(s, b) - s.years;
        level = !isFinite(left) ? 5 : left <= 0 ? 0 : Math.max(0, Math.min(5, Math.round(Math.log10(left / Math.max(1, s.years)) + 3)));
      }
    }
    return { need, level, label: v.label };
  });
}

/** A world's lines, typed in one after another (styles.css: each its `--i`), then its bars, then a find's plate. */
function WorldLines({ s, b, best, leaving }: { s: GameState; b: Body; best: { echoes: number; lattice: number }; leaving: boolean }) {
  const giant = b.kind === 'gas_giant' || b.kind === 'ice_giant';
  const deep = b.kind === 'deep';
  const c = deep ? null : bodyClimate(s, b);
  const room = naturalKinRoom(b, s);
  const find = worldFinds(s, b)[0];
  const def = find ? EVENT_BY_ID[find.defId] : null;
  const lines: { text: preact.ComponentChildren; cls?: string }[] = [{ text: bodyKindName(s, b), cls: 'rc-kind' }];
  lines.push(deep ? { text: 'Open space round the star', cls: 'rc-sub' } : giant ? { text: 'No ground to stand on', cls: 'rc-sub' } : room > 0 ? { text: `Room for ${room} Kin without domes`, cls: 'rc-sub good' } : { text: 'Kin would need domes', cls: 'rc-sub' });
  if (c) lines.push({ text: <>Temperature <span class="mono">{c.day !== undefined && kelvin(c.day) !== kelvin(c.night!) ? `${kelvin(c.night!)} to ${kelvin(c.day)}` : kelvin(c.mean)}</span></> });
  if (c && !giant) lines.push({ text: <>Water: {waterState(b, c, buriedOcean(s, b, c))}</> });
  if (find) lines.push({ text: <>Found here: {find.title}</>, cls: 'rc-found' });
  const list = bars(s, b, best);
  return (
    <div class={`rc-world${leaving ? ' leaving' : ''}`}>
      <div class="rc-name">{b.name}</div>
      <div class="rc-lines">
        {lines.map((l, i) => (
          <div key={i} class={`rc-line ${l.cls ?? ''}`} style={{ '--i': i }}>
            {l.text}
          </div>
        ))}
      </div>
      <div class="rc-bars" style={{ '--i': lines.length }}>
        {list.map((x, j) => {
          const n = NEEDS.find((y) => y.need === x.need)!;
          return (
            <div key={x.need} class={`rc-bar need-${x.need}`} style={{ '--j': j }} data-tip={`${n.what}.\nHere: ${x.label}.`} aria-label={`${n.name}: ${x.label}, ${x.level} of 5`}>
              <Icon name={n.icon} />
              <span class="rc-segs" aria-hidden="true">
                {[0, 1, 2, 3, 4].map((k) => (
                  <i key={k} class={k < x.level ? 'on' : ''} style={{ '--k': k }} />
                ))}
              </span>
              <span class="rc-val mono">{x.label}</span>
            </div>
          );
        })}
      </div>
      {find && def && (
        <div class="rc-plate" style={{ '--i': lines.length + 2 }}>
          <Plate art={def.art} plate={def.plate} height={84} />
        </div>
      )}
    </div>
  );
}
