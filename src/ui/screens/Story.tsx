import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import { SHIP_BY_ID } from '../../game/data/ships';
import { EVENT_BY_ID } from '../../game/data/events';
import { DARK_ENDING, ENDURANCE_ENDING, WORKS } from '../../game/data/works';
import { ERA_BY_ID, formatEta, formatYears } from '../../game/eras';
import { answerEvent } from '../../game/sim/actions';
import { threadTotals, totalPops } from '../../game/sim/util';
import type { Body, GameState, PendingEvent } from '../../game/types';
import { THREADS } from '../../game/types';
import { THREAD_DEFS } from '../../game/data/threads';
import { music } from '../../audio/music';
import { sfx } from '../../audio/sfx';
import { n0 } from '../fmt';
import { bump, engine, hudPrefs, modal, rev, screen, selection, setHudPrefs } from '../store';
import { pivotToSystem } from './Lists';
import { Icon } from '../Icon';
import { ModalFrame } from './Frame';

// Art plates live in art/<name>.webp. Until one exists the plate is a graded gradient.
const ART_TINT: Record<string, string> = {
  dusk: '#3a1a10',
  degenerate: '#141c2c',
  blackhole: '#1c1430',
  dark: '#0c0d10',
  flare: '#4a1c0c',
  ruins: '#241c16',
  hunger: '#2a0e0c',
  sleepers: '#10202a',
  survivor: '#1e1a14',
  slow: '#161a28',
};

export function Plate({ art, height = 220 }: { art: string; height?: number }) {
  const tint = ART_TINT[art] ?? '#15141a';
  return (
    <div
      class="event-art"
      style={{
        height: `${height}px`,
        backgroundImage: `url(art/${art}.webp), radial-gradient(ellipse at 70% 40%, ${tint}, #050507 75%)`,
      }}
      aria-hidden="true"
    />
  );
}

/** Events about the homeworld and its star, which carry no place of their own. */
const AT_HOME = new Set(['dynamo_fails', 'first_night', 'comet']);

/** The star an event is about, if it is about one we can see. */
function eventSystem(s: GameState, p: PendingEvent): string | null {
  const d = p.data;
  const home = Object.values(s.bodies).find((b) => b.traits.includes('homeworld'));
  // the derelict ark was found by one of our probes: wherever a survey ship is
  const probe = Object.values(s.fleets).find((f) => f.ships.some((x) => SHIP_BY_ID[x.cls]?.survey));
  const id =
    (typeof d.systemId === 'string' && d.systemId) ||
    (typeof d.bodyId === 'string' && s.bodies[d.bodyId]?.systemId) ||
    (typeof d.colonyId === 'string' && s.colonies[d.colonyId]?.systemId) ||
    (AT_HOME.has(p.defId) && (home?.systemId ?? s.civ.homeSystemId)) ||
    (p.defId === 'derelict_ark' && probe && (probe.at ?? probe.to ?? probe.from)) ||
    null;
  return id && s.systems[id] && !s.systems[id].gone && (s.civ.known[id] ?? 0) > 0 ? id : null;
}

/** Swing the view to the star an event is about (and select it). */
function showEventStar(s: GameState, id: string) {
  if (!s.systems[id] || s.systems[id].gone) return;
  selection.value = { kind: 'system', id };
  engine()?.select(id);
  pivotToSystem(id);
}

/** Narrative events waiting for a decision. The first pending one is shown. */
/** The outcome of the last event choice, shown before the next event. */
export const eventResult = signal<{ title: string; text: string } | null>(null);

/** A discovery's report, opened again from its world. */
export const loreView = signal<{ defId: string; bodyId: string } | null>(null);

/** The survey reports of one world (its ruins and remarkable finds), with what we chose. */
export function worldFinds(s: GameState, b: Body): { defId: string; title: string; choice: string | null }[] {
  const ids: string[] = [];
  if (b.relic && b.relic.state !== 'hidden') ids.push(`relic_${b.relic.kind}`);
  for (const t of b.traits) if (EVENT_BY_ID[`anom_${t}`]) ids.push(`anom_${t}`);
  return ids
    .filter((id) => EVENT_BY_ID[id])
    .map((id) => {
      const def = EVENT_BY_ID[id];
      let choice = b.lore?.[id] ?? null;
      if (!choice && !s.pending.some((p) => p.defId === id && p.data.bodyId === b.id)) {
        // older games did not keep it with the world: look for it in the Record
        const e = s.log.find((l) => l.kind === 'event' && l.text.startsWith(`${def.title}: `));
        if (e) choice = e.text.slice(def.title.length + 2).replace(/\.$/, '');
      }
      return { defId: id, title: def.title, choice };
    });
}

export function LoreModal({ s }: { s: GameState }) {
  void rev.value;
  const v = loreView.value;
  const def = v ? EVENT_BY_ID[v.defId] : null;
  const b = v ? s.bodies[v.bodyId] : null;
  if (!v || !def || !b) return null;
  let text = '';
  try {
    text = def.text(s, { bodyId: b.id, systemId: b.systemId });
  } catch {
    text = '…';
  }
  const find = worldFinds(s, b).find((f) => f.defId === v.defId);
  const pending = s.pending.some((p) => p.defId === v.defId && p.data.bodyId === b.id);
  const close = () => (loreView.value = null);
  return (
    <div class="modal-wrap" onClick={(e) => e.target === e.currentTarget && close()}>
      <div class="modal panel narrow event" role="dialog" aria-modal="true" aria-label={def.title}>
        <Plate art={def.art} />
        <div class="modal-body scroll" style={{ marginTop: '-60px', position: 'relative' }}>
          <div class="eyebrow">Survey report · {b.name}, {s.systems[b.systemId]?.name}</div>
          <h1 class="event-title">{def.title}</h1>
          <p class="event-text">{text}</p>
          <p class="dim" style={{ fontSize: '13px' }}>
            {find?.choice ? <>We chose: <span class="neon">{find.choice}</span>.</> : pending ? 'We have not decided yet.' : 'What we chose then is no longer in the Record.'}
          </p>
          <div class="row" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
            <button class="btn primary" onClick={close}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventModal({ s }: { s: GameState }) {
  void rev.value; // mutable game state: re-render on every change
  const result = eventResult.value;
  const top = s.pending[0];
  // as an event about a star opens, the view swings there behind it
  useEffect(() => {
    if (!top || eventResult.value || !hudPrefs.value.eventPivot) return;
    const id = eventSystem(s, top);
    if (id) showEventStar(s, id);
  }, [top?.uid]);
  if (result) {
    return (
      <ModalFrame title={result.title} narrow closable={false} foot={<button class="btn primary" onClick={() => (eventResult.value = null)}>Continue</button>}>
        <p class="event-text">{result.text}</p>
      </ModalFrame>
    );
  }
  const p = s.pending[0];
  if (!p) return null;
  const def = EVENT_BY_ID[p.defId];
  if (!def) return null;
  let text = '';
  try {
    text = def.text(s, p.data);
  } catch {
    text = '…';
  }
  const sysId = eventSystem(s, p);
  const pivot = !!sysId && hudPrefs.value.eventPivot;
  return (
    <div class="modal-wrap">
      <div class="modal panel narrow event" role="dialog" aria-modal="true" aria-label={def.title}>
        <Plate art={def.art} />
        <div class="modal-body scroll" style={{ marginTop: '-60px', position: 'relative' }}>
          <div class="eyebrow">{ERA_BY_ID[s.era].name} · turn {s.turn}</div>
          <h1 class="event-title">{def.title}</h1>
          <p class="event-text">{text}</p>
          <div class="col" style={{ gap: '6px', marginTop: '12px' }}>
            {def.choices.map((c, i) => {
              let ok = true;
              try {
                ok = !c.ok || c.ok(s, p.data);
              } catch {
                ok = false;
              }
              return (
                <button
                  key={i}
                  class="btn choice"
                  disabled={!ok}
                  onClick={() => {
                    const r = answerEvent(s, p.uid, i);
                    sfx('select');
                    bump();
                    if (r.text) eventResult.value = { title: def.title, text: r.text };
                    if (pivot && sysId) showEventStar(s, sysId);
                  }}
                >
                  <span>{c.label}</span>
                  {c.hint && <span class="h">{c.hint}</span>}
                </button>
              );
            })}
          </div>
          {sysId && (
            <label class="check-row">
              <input type="checkbox" checked={hudPrefs.value.eventPivot} onChange={(e) => setHudPrefs({ eventPivot: (e.target as HTMLInputElement).checked })} />
              <Icon name="focus" /> Show {s.systems[sysId].name} (now and after choosing)
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

export function EraIntro({ s }: { s: GameState }) {
  const era = ERA_BY_ID[s.era];
  return (
    <div class="crossing" role="dialog" aria-modal="true" aria-label={era.name}>
      <div class="crossing-art" style={{ backgroundImage: `url(art/${s.era}.webp)` }} />
      <div class="crossing-body">
        <div class="from">{era.numeral} · {era.science}</div>
        <h1>{era.name}</h1>
        <p class="intro">{era.intro}</p>
        <p class="dim" style={{ fontSize: '13px', maxWidth: '60ch' }}>
          η {formatEta(s.eta, s.era)}: {formatYears(s.years, s.eta)} since the Big Bang. Keep your people alive through what is coming. Every turn covers more time than the last.
        </p>
        <button
          class="btn primary"
          style={{ minWidth: '220px', minHeight: '44px' }}
          onClick={() => {
            modal.value = null;
            music.setEra(s.era);
            sfx('click');
          }}
        >
          Begin
        </button>
      </div>
    </div>
  );
}

export function CrossingScreen({ s }: { s: GameState }) {
  const r = s.crossing;
  if (!r) return null;
  const to = ERA_BY_ID[r.to];
  const from = ERA_BY_ID[r.from];
  return (
    <div class="crossing" role="dialog" aria-modal="true" aria-label={to.name}>
      <div class="crossing-art" style={{ backgroundImage: `url(art/${r.to}.webp)` }} />
      <div class="crossing-body">
        <div class="from">The end of {from.name}</div>
        <h1>{to.name}</h1>
        <p class="intro">{to.intro}</p>
        <div class="row wrap" style={{ gap: '18px', justifyContent: 'center' }}>
          <div>
            <div class="eyebrow">People</div>
            <div class={`mono ${r.popsAfter < r.popsBefore ? 'bad' : 'good'}`} style={{ fontSize: '20px' }}>
              {n0(r.popsBefore)} → {n0(r.popsAfter)}
            </div>
          </div>
          <div>
            <div class="eyebrow">Settlements</div>
            <div class={`mono ${r.coloniesAfter < r.coloniesBefore ? 'bad' : 'good'}`} style={{ fontSize: '20px' }}>
              {r.coloniesBefore} → {r.coloniesAfter}
            </div>
          </div>
        </div>
        <div class="lines panel" style={{ padding: '12px 16px', width: '100%' }}>
          {r.lines.map((l, i) => (
            <div key={i} class={l.kind === 'bad' ? 'bad' : l.kind === 'good' ? 'good' : 'dim'}>
              {l.text}
            </div>
          ))}
        </div>
        <button
          class="btn primary"
          style={{ minWidth: '220px', minHeight: '44px' }}
          onClick={() => {
            s.crossing = null;
            modal.value = s.outcome ? { kind: 'outcome' } : null;
            music.setEra(s.era);
            sfx('click');
            bump();
          }}
        >
          Go on
        </button>
      </div>
    </div>
  );
}

const DEFEAT_TEXT: Record<string, string> = {
  Silence: 'The last of you went quiet. The settlements cooled, the archives stopped answering, and the light of your worlds kept travelling outward for a while after there was no one left to send it.',
  'The Will Fails': 'You did not run out of energy. You ran out of reasons. One by one the Threads chose to stop, and the reserve sat full and unused in the dark.',
  'The Fade': 'Every cycle in the dark cost a little of who you were. At the end, the pattern was too thin to hold. Something still runs where you used to be, but it is not you.',
};

export function OutcomeScreen({ s }: { s: GameState }) {
  const o = s.outcome;
  if (!o) return null;
  const work = WORKS.find((w) => w.ending === o.ending);
  const epilogue = work?.epilogue ?? (o.kind === 'dark' ? DARK_ENDING.epilogue : o.kind === 'endurance' ? ENDURANCE_ENDING.epilogue : DEFEAT_TEXT[o.ending] ?? '');
  const totals = threadTotals(s);
  const fates = Object.values(s.survivors);
  const head = o.kind === 'victory' ? 'An ending' : o.kind === 'dark' ? 'The dark ending' : o.kind === 'endurance' ? 'Endurance' : 'The end';
  return (
    <div class="crossing" role="dialog" aria-modal="true" aria-label={o.ending}>
      <div class="crossing-art" style={{ backgroundImage: `url(art/${o.kind === 'dark' ? 'hunger' : s.era}.webp)` }} />
      <div class="crossing-body">
        <div class="from">{head} · turn {o.turn} · <span class="greek">η</span> {formatEta(o.eta, s.era)}</div>
        <h1 class={o.kind === 'defeat' || o.kind === 'dark' ? 'bad' : ''}>{o.ending}</h1>
        <p class="intro">{epilogue}</p>
        <div class="lines panel" style={{ padding: '12px 16px', width: '100%' }}>
          <div class="dim">
            You endured {formatYears(s.years, s.eta)} and {s.turn} turns. {totalPops(s)} of you remain
            {totalPops(s) > 0 ? `: ${THREADS.filter((t) => totals[t] > 0).map((t) => `${totals[t]} ${THREAD_DEFS[t].name}`).join(', ')}` : ''}.
          </div>
          {fates.map((f) => (
            <div key={f.id} class={f.fate === 'saved' || f.fate === 'absorbed' ? 'good' : f.fate === 'seized' || f.fate === 'devoured' ? 'bad' : 'dim'}>
              {f.name}: {f.alive ? 'still out there' : f.fate === 'saved' ? 'saved' : f.fate === 'absorbed' ? 'lives on within you' : f.fate === 'seized' ? 'taken by force' : f.fate === 'devoured' ? 'devoured' : f.fate === 'transcended' ? 'went beyond' : 'faded'}
            </div>
          ))}
        </div>
        <div class="row wrap" style={{ gap: '8px', justifyContent: 'center' }}>
          <button class="btn" onClick={() => (modal.value = null)}>
            Look around
          </button>
          <button
            class="btn primary"
            onClick={() => {
              modal.value = null;
              screen.value = 'menu';
              music.setMood('menu');
            }}
          >
            Main menu
          </button>
        </div>
      </div>
    </div>
  );
}
