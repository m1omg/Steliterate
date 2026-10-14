import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { EVENT_BY_ID } from '../../game/data/events';
import { bodyClimate, buriedOcean, waterState } from '../../game/physics';
import { naturalKinRoom } from '../../game/sim/fleets';
import type { Body, GameState } from '../../game/types';
import type { RevealStep } from '../../render/systemView';
import { sfx } from '../../audio/sfx';
import { kelvin, pct } from '../fmt';
import { bodyKindName } from '../labels';
import { engine, modal, rev } from '../store';
import { Plate, eventResult, loreView, worldFinds } from '../screens/Story';

/** Where the survey reveal has come to (Engine onReveal), and null when none is playing. */
export const revealing = signal<RevealStep | null>(null);

/** Skip the reveal: this system's worlds at once; `all`, and the other systems charted, which open without one. */
export function skipReveal(all = false) {
  sfx('click');
  engine()?.skipReveal(all);
}

/**
 * The survey reveal's card (part 4): the world being charted, with what the survey found there,
 * its find last with its plate. Enter and Escape skip the reveal, before the game's own keys see
 * them, so neither ends the turn underneath it.
 */
export function RevealCard({ s }: { s: GameState }) {
  void rev.value;
  const r = revealing.value;
  const on = !!r;
  const box = useRef<HTMLDivElement>(null);
  // the messages make room for it (styles.css: they stack on from where it ends)
  useLayoutEffect(() => {
    const h = box.current ? box.current.offsetHeight + 6 : 0;
    document.documentElement.style.setProperty('--reveal-h', `${h}px`);
  });
  useEffect(() => () => document.documentElement.style.setProperty('--reveal-h', '0px'), []);
  useEffect(() => {
    if (!on) return;
    const keys = (e: KeyboardEvent) => {
      if ((e.key !== 'Enter' && e.key !== 'Escape') || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      // (a window or a story over it answers its own keys)
      if (modal.value || eventResult.value || loreView.value || s.civ.pending.length > 0) return;
      e.preventDefault();
      e.stopPropagation();
      skipReveal(false);
    };
    window.addEventListener('keydown', keys, true);
    return () => window.removeEventListener('keydown', keys, true);
  }, [on]);
  if (!r) return null;
  const sys = s.systems[r.systemId];
  const b = r.bodyId ? s.bodies[r.bodyId] : null;
  if (!sys) return null;
  return (
    <div ref={box} class="reveal-card panel" role="status" aria-live="polite" aria-label={`Survey of ${sys.name}`}>
      <div class="row">
        <div class="grow">
          <div class="eyebrow">
            Survey · {sys.name}
            {r.index >= 0 ? ` · ${r.index + 1} of ${r.total}` : ''}
          </div>
          <div class="rc-name">{b ? b.name : `${r.total} world${r.total === 1 ? '' : 's'} charted`}</div>
        </div>
        <button class="btn small" data-tip="Every world of this system now (Enter or Esc)" onClick={() => skipReveal(false)}>
          Skip
        </button>
        <button class="btn small ghost" data-tip="Every world now, and the other systems just charted open without a reveal" onClick={() => skipReveal(true)}>
          Skip all
        </button>
      </div>
      {b && <WorldFacts s={s} b={b} />}
    </div>
  );
}

/** What the card says of a world: its kind, warmth, water, how habitable, room for Kin; and a find last, with its plate. */
function WorldFacts({ s, b }: { s: GameState; b: Body }) {
  const giant = b.kind === 'gas_giant' || b.kind === 'ice_giant';
  const deep = b.kind === 'deep';
  const c = deep ? null : bodyClimate(s, b);
  const room = naturalKinRoom(b, s);
  const find = worldFinds(s, b)[0];
  const def = find ? EVENT_BY_ID[find.defId] : null;
  return (
    <>
      <dl class="kv rc-facts">
        <dt>Kind</dt>
        <dd>{bodyKindName(s, b)}</dd>
        {c && (
          <>
            <dt>Temperature</dt>
            <dd class="mono">{c.day !== undefined && kelvin(c.day) !== kelvin(c.night!) ? `${kelvin(c.night!)} to ${kelvin(c.day)}` : kelvin(c.mean)}</dd>
          </>
        )}
        {c && !giant && (
          <>
            <dt>Water</dt>
            <dd>{waterState(b, c, buriedOcean(s, b, c))}</dd>
          </>
        )}
        <dt>Habitable</dt>
        <dd class="mono">{pct(b.habitability * b.vitality)}</dd>
        {!deep && !giant && (
          <>
            <dt>Room for Kin</dt>
            <dd class={room > 0 ? 'mono good' : ''}>{room > 0 ? `${room} without domes` : 'none: domes needed'}</dd>
          </>
        )}
      </dl>
      {find && def && (
        <div class="rc-find">
          <Plate art={def.art} plate={def.plate} height={84} />
          <div class="rc-find-text">
            <span class="eyebrow">Found here</span> {find.title}
          </div>
        </div>
      )}
    </>
  );
}
