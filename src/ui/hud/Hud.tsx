import { SHIP_BY_ID } from '../../game/data/ships';
import { formatYears } from '../../game/eras';
import { computeMods } from '../../game/sim/mods';
import { project, type Projection } from '../../game/sim/projection';
import { setDormant, setPace, longSleep } from '../../game/sim/actions';
import { colonies, hasTech } from '../../game/sim/util';
import type { Fleet, GameState } from '../../game/types';
import { signed } from '../fmt';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { VIEW_MODES, act, busy, cycleViewMode, engine, following, hudPrefs, isPhone, modal, notify, openBuildFor, phoneMore, rev, selection, setHudPrefs, toggleOrbits, uiZoom, view } from '../store';
import { goToColony, goToFleet } from '../screens/Lists';
import { isIdleFleet } from '../../game/sim/fleets';
import { flareClock, flareStop, paceMatters, starClock, turnsUntilYears } from '../../game/sim/flare';
import { thermalRGB } from '../../render/shaders/bodies';
import { ShipPrompt, shipPrompt } from './ShipPrompt';
import { doEndTurn } from '../turnflow';
import { Chronometer } from './Chronometer';
import { Resources } from './Resources';
import { ResearchPrompt } from './ResearchPrompt';
import { Tutorial } from './Tutorial';
import { sfx } from '../../audio/sfx';
import { pressable } from '../a11y';
import { uiFactor } from '../Tip';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { calendarEra } from '../../game/fate';

export function Hud({ s }: { s: GameState }) {
  void rev.value;
  const p = project(s);
  // where the top bar ends (in the interface's own pixels): on a phone the messages, the map
  // banner, the prompts and the top bar's details hang from it (styles.css: --hud-end)
  // (watched for size: the turn line's details open and close without the rest redrawing)
  useLayoutEffect(() => {
    const place = () => {
      const root = document.documentElement.style;
      // (the resources hang under the top bar, which a phone's turn line makes taller)
      const c = document.querySelector('.chrono')?.getBoundingClientRect();
      if (c) root.setProperty('--chrono-end', `${Math.round(c.bottom / uiFactor())}px`);
      const r = document.querySelector('.resources')?.getBoundingClientRect();
      if (r) root.setProperty('--hud-end', `${Math.round(r.bottom / uiFactor())}px`);
    };
    place();
    const watch = typeof ResizeObserver === 'function' ? new ResizeObserver(place) : null;
    for (const sel of ['.chrono', '.resources']) {
      const el = document.querySelector(sel);
      if (el) watch?.observe(el);
    }
    window.addEventListener('resize', place);
    return () => {
      watch?.disconnect();
      window.removeEventListener('resize', place);
    };
  }, []);
  return (
    <>
      <Chronometer s={s} nextYears={p.turnYears} />
      <Resources s={s} p={p} />
      <Rail s={s} />
      <BottomLeft s={s} />
      <TurnBox s={s} p={p} />
      <ResearchPrompt s={s} />
      <ShipPrompt s={s} />
      <Tutorial s={s} />
      <ViewSwitch s={s} />
    </>
  );
}

function RailBtn({ icon, label, short, wide, onClick, badge, on, cls }: { icon: IconName; label: string; short: string; wide?: string; onClick: () => void; badge?: number; on?: boolean; cls?: string }) {
  return (
    <button
      class={`btn iconbtn ${on ? 'on' : ''} ${cls ?? ''}`}
      data-tip={label}
      aria-label={label}
      onClick={() => {
        sfx('click');
        onClick();
      }}
    >
      <Icon name={icon} size="lg" />
      <span class="rail-label" aria-hidden="true">
        <span class="rl-short">{short}</span>
        <span class="rl-wide">{wide ?? short}</span>
      </span>
      {badge ? <span class="badge">{badge}</span> : null}
    </button>
  );
}

function Rail({ s }: { s: GameState }) {
  void rev.value; // mutable game state: re-render on every change
  // (and when the forecasts or the interface size change)
  void hudPrefs.value;
  void uiZoom.value;
  const ref = useRef<HTMLElement>(null);
  // on a short screen the rail stops above the forecasts and scrolls, so its last buttons
  // (Save, Menu) are not left under them
  useLayoutEffect(() => {
    const fit = () => {
      const rail = ref.current;
      if (!rail) return;
      const below = document.querySelector('.bottom-left');
      if (isPhone() || !below || document.documentElement.classList.contains('lv')) {
        rail.style.maxHeight = '';
        return;
      }
      const room = (below.getBoundingClientRect().top - rail.getBoundingClientRect().top - 8) / uiFactor();
      rail.style.maxHeight = `${Math.max(120, Math.floor(room))}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  });
  const unanswered = s.signals.filter((x) => x.arrivedTurn !== null && !x.resolved && x.choices.length).length;
  const m = modal.value?.kind;
  const readySettlers = Object.values(s.fleets).filter((f) => f.at && f.order === 'idle' && f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles)).length;
  return (
    <nav ref={ref} class="rail panel" aria-label="Civilization">
      <RailBtn icon="research" label={`Research${s.civ.researching ? '' : ': nothing chosen'}`} short="Research" on={m === 'research'} badge={s.civ.researching ? 0 : 1} onClick={() => (modal.value = { kind: 'research' })} />
      <RailBtn icon="colony" label={`Systems: our settlements and every surveyed world${calendarEra(s) === 'degenerate' ? ', and the collision stars' : ''}`} short="Systems" on={m === 'settlements'} onClick={() => (modal.value = { kind: 'settlements' })} />
      <RailBtn icon="fleet" label="Fleets" short="Fleets" on={m === 'fleets'} badge={readySettlers} onClick={() => (modal.value = { kind: 'fleets' })} />
      <RailBtn icon="threads" label="Threads: the kinds of mind you are made of" short="Threads" on={m === 'threads'} onClick={() => (modal.value = { kind: 'threads' })} />
      <RailBtn icon="doctrines" label="Charters: the book of laws" short="Laws" wide="Charters" on={m === 'charters'} onClick={() => (modal.value = { kind: 'charters' })} />
      <RailBtn icon="diplomacy" label="Signals: the other minds" short="Signals" on={m === 'signals'} badge={unanswered} onClick={() => (modal.value = { kind: 'signals' })} />
      <RailBtn icon="log" label="The Record" short="Record" on={m === 'log'} onClick={() => (modal.value = { kind: 'log' })} />
      {/* (phones: Codex and Save through Menu, to leave the others room for their names) */}
      <RailBtn icon="info" label="Codex: how to play, and how the universe ends" short="Codex" cls="rail-menu-only" on={m === 'codex'} onClick={() => (modal.value = { kind: 'codex' })} />
      <RailBtn icon="save" label="Save and load" short="Save" wide="Save / load" cls="rail-menu-only" on={m === 'save'} onClick={() => (modal.value = { kind: 'save' })} />
      <RailBtn icon="settings" label="Menu: settings, save, main menu" short="Menu" on={m === 'settings'} onClick={() => (modal.value = { kind: 'settings' })} />
    </nav>
  );
}

function BottomLeft({ s }: { s: GameState }) {
  void rev.value; // mutable game state: re-render on every change
  const ui = hudPrefs.value;
  const all = s.forecasts;
  const shown = all.filter((f) => !s.flags[`fcd:${f.uid}`]).slice(0, 3);
  const hidden = all.length - all.filter((f) => !s.flags[`fcd:${f.uid}`]).length;
  const feed = s.log.slice(-7).reverse();
  // (on a phone it is folded under the top bar until its turn line is tapped: styles.css)
  return (
    <div class={`bottom-left${phoneMore.value ? ' open' : ''}`}>
      <div class="bl-head panel">
        <button class={`btn ghost small ${ui.forecasts ? 'on' : ''}`} onClick={() => setHudPrefs({ forecasts: !ui.forecasts })} data-tip="Show or hide the forecasts">
          <Icon name="warning" /> Forecasts {all.length ? <span class="mono faint">{all.length}</span> : null}
        </button>
        <button class={`btn ghost small ${ui.feed ? 'on' : ''}`} onClick={() => setHudPrefs({ feed: !ui.feed })} data-tip="Show or hide the latest entries of the Record">
          <Icon name="log" /> Record
        </button>
        {ui.forecasts && hidden > 0 && (
          <button
            class="btn ghost small"
            data-tip="Bring back the forecasts you closed"
            onClick={() => act((g) => {
              for (const k of Object.keys(g.flags)) if (k.startsWith('fcd:')) delete g.flags[k];
            })}
          >
            {hidden} closed
          </button>
        )}
      </div>
      {ui.forecasts &&
        shown.map((f) => {
          // turns at the pace you have chosen (the Tide figure too, when they differ)
          const due = isFinite(f.dueYears) && calendarEra(s) !== 'dark';
          // (as they will really fall: a flare's own clock and its first moment shorten them)
          const turns = due ? turnsUntilYears(s, f.dueYears, s.civ.pace, 5000) : Infinity;
          const tideTurns = due && s.civ.pace !== 0 ? turnsUntilYears(s, f.dueYears, 0, 5000) : turns;
          const tip = isFinite(turns) ? `${f.text}\n~${turns} turn${turns === 1 ? '' : 's'} at this pace${tideTurns !== turns && isFinite(tideTurns) ? ` (~${tideTurns} at the Tide)` : ''}.` : f.text;
          return (
            <div
              key={f.uid}
              class="forecast panel"
              data-tip={tip}
              {...(f.systemId
                ? pressable(() => {
                    selection.value = { kind: 'system', id: f.systemId! };
                    engine()?.select(f.systemId!);
                    if (view.value === 'galaxy') engine()?.focusGalaxyOn(f.systemId!, 120);
                  })
                : {})}
              style={{ cursor: f.systemId ? 'pointer' : 'default' }}
            >
              <Icon name={f.severity === 'boon' ? 'energy' : 'warning'} cls={f.severity === 'danger' ? 'bad' : f.severity === 'boon' ? 'boon' : 'warn'} />
              <div class="grow">
                <div class="t">{f.title}</div>
                <div class="faint" style={{ fontSize: '12.5px' }}>
                  {isFinite(f.dueYears) ? `in ${formatYears(f.dueYears - s.years)}` : 'now'}
                  {isFinite(turns) ? ` · ~${turns} turn${turns === 1 ? '' : 's'}` : ''}
                </div>
              </div>
              <button
                class="btn ghost small fc-close"
                aria-label="Close this forecast"
                data-tip="Close. It stays on the Chronometer."
                onClick={(e) => {
                  e.stopPropagation();
                  act((g) => {
                    g.flags[`fcd:${f.uid}`] = g.turn;
                  });
                }}
              >
                <Icon name="close" />
              </button>
            </div>
          );
        })}
      {ui.feed && (
        <div class="feed panel scroll" aria-live="polite">
          {feed.map((e, i) => (
            <div key={i} class={`e ${e.kind}`}>
              <span class="faint mono" style={{ fontSize: '11.5px' }}>
                {e.turn}
              </span>{' '}
              {e.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const PACE_LABEL: Record<number, string> = { 3: 'Quick ×1000', 2: 'Quick ×100', 1: 'Quick ×10', 0: 'Tide', [-1]: 'Slow ×10', [-2]: 'Slow ×100', [-3]: 'Slow ×1000' };

function TurnBox({ s, p }: { s: GameState; p: Projection }) {
  void rev.value; // mutable game state: re-render on every change
  const [paceMenu, setPaceMenu] = useState(false);
  // the pace list folds at a touch anywhere else (the map, another button)
  useEffect(() => {
    if (!paceMenu) return;
    const away = (e: PointerEvent) => {
      if (!(e.target as Element | null)?.closest?.('.pace-menu, .pace-pick')) setPaceMenu(false);
    };
    window.addEventListener('pointerdown', away, true);
    return () => window.removeEventListener('pointerdown', away, true);
  }, [paceMenu]);
  const mods = computeMods(s);
  const civ = s.civ;
  const flare = flareClock(s);
  const flaring = flare ? null : flareStop(s);
  const star = starClock(s);
  const paces: number[] = [];
  for (let x = mods.paceMax; x >= mods.paceMin; x--) paces.push(x);
  // why a pace would change nothing now (its button is greyed out)
  const paceWhy = (x: number): string => {
    if (star?.flash) return `Not now: we are catching the flash of ${star.system}, one turn whatever the pace. Our own pace returns when it is out.`;
    if (star) {
      if (x < 0) return `Not now: we keep time with ${star.system}, and its clock sets our turns. Our own pace returns when it burns out.`;
      return hasTech(s, 'quickening') ? `Not now: Quick ×10 is as finely as the clock of ${star.system} can be split.` : `Not now: we keep time with ${star.system}, and its clock sets our turns. Quickening would let Quick ×10 split each into ten.`;
    }
    if (flare) return `Not now: we keep time with ${flare.system}’s last flare, and it sets our turns.`;
    const stop = flareStop(s, x);
    if (stop && x < 0) return `Not now: the turn stops when ${stop.name} begins its last flare, whatever the pace.`;
    if (calendarEra(s) === 'dark') return x > 0 ? 'Not in this age: a turn cannot be quickened further.' : 'Not in this age: a turn cannot be slowed further.';
    return `Not now: the turn would be the same as at ${PACE_LABEL[x > 0 ? x - 1 : x + 1]}.`;
  };
  const paceTip = (x: number, open: boolean): string =>
    !open
      ? paceWhy(x)
      : x > 0
        ? `Quicken ×${Math.pow(10, x)}: shorter turns, more turns to act while a source lasts. Energy per turn drops ${Math.pow(10, x)}×; minds that cannot hurry idle.`
        : x < 0
          ? `Slow ×${Math.pow(10, -x)}: longer turns. ${Math.pow(10, -x)}× the energy per turn, but the universe moves on faster between your decisions.`
          : 'The Tide: the natural pace of this age.';
  const todo = todoItems(s);
  const warnings = todo.map((t) => t.text);
  const eNet = p.energyIn - p.energyOut;
  const longSleepBtn = () => hasTech(s, 'hibernation_protocols') && (
    <button class="btn small" data-tip="Long Sleep: the next five turns end on their own, pausing whenever an event needs a decision; press Wake to stop early. We stay dormant for four of them and wake on the fifth, with output +30% for that turn." onClick={() => act((g) => longSleep(g, 5)) && doEndTurn()}>
      Long Sleep ×5
    </button>
  );
  const sleepBtn = () => (
    <button class={`btn small ${civ.dormant ? 'on' : ''}`} data-tip="Dormancy: sleep through the coming turns. Upkeep falls to a tenth; nothing is built or learned; energy is still collected." onClick={() => act((g) => setDormant(g, !g.civ.dormant))}>
      <Icon name={civ.dormant ? 'wake' : 'sleep'} /> {civ.dormant ? 'Wake' : 'Sleep'}
    </button>
  );
  return (
    <div class="turnbox">
      {todo.length > 0 && (
        <div class="todo">
          {todo.map((t) => (
            <button key={t.text} class="btn small todo-chip" data-tip={t.tip} onClick={() => { sfx('click'); t.go(); }}>
              {t.text} <Icon name="arrow_right" />
            </button>
          ))}
        </div>
      )}
      <div class="pace panel">
        <div class="row">
          <span class="stencil grow">Pace</span>
          <span class="mono faint" style={{ fontSize: '12.5px' }} data-tip="How much cosmic time the next turn will cover at this pace.">
            next turn {isFinite(p.turnYears) ? formatYears(p.turnYears) : 'deep time'}
          </span>
        </div>
        {flare && (
          <div class="chip neon" style={{ margin: '4px 0 2px' }} data-tip={`We are keeping time with ${flare.system}'s last flare: each turn is a sixth of it, lived in full, and pays as one turn at the Tide whatever the pace. Your pace takes over again when the star collapses into a white dwarf.`}>
            Flare clock · turn {flare.turn} of {flare.of}
          </div>
        )}
        {flaring && (
          <div class="chip neon" style={{ margin: '4px 0 2px' }} data-tip={`${flaring.name} is about to leave the main sequence and begin its last flare. The turn stops the moment it does, whatever the pace (a slower one cannot take us past it, and the short turn pays as one turn at the Tide at most), so we can decide how to meet the flare.`}>
            Turn stops · {flaring.name} begins to flare
          </div>
        )}
        {star && (
          <div
            class="chip neon"
            style={{ margin: '4px 0 2px', whiteSpace: 'normal', flexWrap: 'wrap' }}
            data-tip={star.flash ? `We are catching the flash of ${star.system}: one turn, lived in full in its light, and paid as one turn at the Tide whatever the pace. Your pace takes over again when it is out.` : `We are keeping time with the new star at ${star.system}: ${star.split > 1 ? `Quick ×10 splits each of its turns, a sixth of what was left of its life, into ten, each lived as a tenth of a turn at the Tide.` : `each turn is a sixth of what was left of its life, lived in full, and pays as one turn at the Tide whatever the pace.${hasTech(s, 'quickening') ? ' With Quickening, Quick ×10 would split each into ten.' : ''}`} ${star.next ? `When it burns out we follow ${star.next} on, six more turns.` : 'Your pace takes over again when it burns out.'}`}
          >
            <span>{star.flash ? `Star flash · ${star.system} · one turn` : `Star clock · ${star.system} · turn ${star.turn} of ${star.of}`}</span>
            {star.next && <span>then {star.next}</span>}
          </div>
        )}
        <div class="opts">
          {paces.map((x) => {
            const open = paceMatters(s, x);
            return (
              <button key={x} class={`btn small pace-opt ${civ.pace === x ? 'primary' : ''} ${open ? '' : 'disabled'}`} aria-disabled={!open} data-tip={paceTip(x, open)} onClick={() => open && act((g) => setPace(g, x))}>
                {PACE_LABEL[x] ?? `${x}`}
              </button>
            );
          })}
        </div>
        <div class="row pace-sleep" style={{ marginTop: '6px' }}>
          {sleepBtn()}
          {longSleepBtn()}
          <span class={`mono grow ${eNet >= 0 ? 'good' : 'bad'}`} style={{ textAlign: 'right', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
            {signed(eNet)} energy
          </span>
        </div>
        {/* phones: the pace as one button, its choices (each explained) in a list over the map */}
        <div class="row pace-phone">
          <button class={`btn small pace-pick ${paceMenu ? 'on' : ''}`} aria-expanded={paceMenu} onClick={() => { sfx('click'); setPaceMenu(!paceMenu); }}>
            <span class="faint">Pace</span> {PACE_LABEL[civ.pace] ?? civ.pace} <Icon name={paceMenu ? 'minus' : 'plus'} />
          </button>
          {sleepBtn()}
          <span class={`mono grow pp-net ${eNet >= 0 ? 'good' : 'bad'}`} style={{ textAlign: 'right', fontSize: '13px', whiteSpace: 'nowrap' }}>
            {signed(eNet)}
          </span>
        </div>
      </div>
      {/* (outside the pace panel, whose cut corners would clip it) */}
      {paceMenu && (
        <div class="pace-menu panel" role="dialog" aria-label="Pace">
          <div class="row">
            <span class="stencil grow">Pace</span>
            <span class="mono faint" style={{ fontSize: '12.5px' }}>
              next turn {isFinite(p.turnYears) ? formatYears(p.turnYears) : 'deep time'}
            </span>
          </div>
          {paces.map((x) => {
            const open = paceMatters(s, x);
            return (
              <button
                key={x}
                class={`btn small pm-opt ${civ.pace === x ? 'primary' : ''} ${open ? '' : 'disabled'}`}
                aria-disabled={!open}
                onClick={() => {
                  if (!open) return;
                  act((g) => setPace(g, x));
                  setPaceMenu(false);
                }}
              >
                <b>{PACE_LABEL[x] ?? `${x}`}</b>
                <span class="pm-why">{paceTip(x, open)}</span>
              </button>
            );
          })}
          {hasTech(s, 'hibernation_protocols') && <div class="row">{longSleepBtn()}</div>}
        </div>
      )}
      <button class="btn primary endturn" disabled={busy.value || !!s.outcome} onClick={() => doEndTurn()} data-tip={warnings.length ? `Before you go: ${warnings.join(', ')}.` : 'End the turn.'}>
        <span>
          End Turn
          <small>{civ.sleepTurns > 0 ? `sleeping · ${civ.sleepTurns} more` : warnings.length ? warnings[0] : `turn ${s.turn}`}</small>
        </span>
      </button>
    </div>
  );
}

function ViewSwitch({ s }: { s: GameState }) {
  void rev.value; // mutable game state: re-render on every change
  const home = () => {
    const cap = s.civ.capitalId ? s.colonies[s.civ.capitalId] : null;
    const id = cap?.systemId ?? s.civ.homeSystemId;
    if (view.value === 'system') {
      view.value = 'system';
      engine()?.showSystem(id);
    } else engine()?.focusGalaxyOn(id, 150);
    selection.value = { kind: 'system', id };
    engine()?.select(id);
  };
  const sel = selection.value;
  const selSystem = sel ? (sel.kind === 'system' ? sel.id : sel.kind === 'body' ? s.bodies[sel.id]?.systemId : sel.kind === 'fleet' ? s.fleets[sel.id]?.at : null) : null;
  return (
    <div class="viewswitch panel">
      <button class={`btn small ${view.value === 'galaxy' ? 'primary' : ''}`} aria-label="Galaxy" onClick={() => { view.value = 'galaxy'; engine()?.showGalaxy(); }} data-tip="The Coalescence">
        <Icon name="galaxy" /> <span class="vs-label">Galaxy</span>
      </button>
      <button
        class={`btn small ${view.value === 'system' ? 'primary' : ''}`}
        disabled={!selSystem && view.value !== 'system'}
        onClick={() => {
          if (selSystem) {
            view.value = 'system';
            engine()?.showSystem(selSystem);
          }
        }}
        data-tip="Look closer at the selected system (or double-click it)"
        aria-label="System"
      >
        <Icon name="system" /> <span class="vs-label">System</span>
      </button>
      <button class="btn small ghost" aria-label="Home" onClick={home} data-tip="Back to your capital (H)">
        <Icon name="colony" /> <span class="vs-label">Home</span>
      </button>
      <button
        class={`btn small ghost ${hudPrefs.value.viewMode ? 'on' : ''}`}
        onClick={() => { sfx('click'); cycleViewMode(); }}
        data-tip={`${VIEW_MODES[hudPrefs.value.viewMode].tip}\nClick (or V) for the next view: ${VIEW_MODES.map((m) => m.label).join(' → ')}.`}
        aria-label={`View: ${VIEW_MODES[hudPrefs.value.viewMode].label}`}
      >
        <Icon name="survey" /> <span class="vs-label">{VIEW_MODES[hudPrefs.value.viewMode].label}</span>
      </button>
      {following.value?.kind === 'fleet' && s.fleets[following.value.id] && (
        <button class="btn small ghost on" onClick={() => { sfx('click'); engine()?.unfollow(); }} data-tip="The view follows this fleet. Click to let go." aria-label="Stop following">
          <Icon name="fleet" /> <span class="vs-label">{s.fleets[following.value.id].name}</span> <Icon name="close" />
        </button>
      )}
      {view.value === 'system' && (
        <>
          <button class={`btn small ghost ${hudPrefs.value.orbitsPaused ? 'on' : ''}`} onClick={() => { sfx('click'); toggleOrbits(); }} data-tip={hudPrefs.value.orbitsPaused ? 'Set the worlds moving again (P)' : 'Hold the worlds still in their orbits (P)'}>
            <Icon name="clock" /> <span class="vs-label">{hudPrefs.value.orbitsPaused ? 'Play' : 'Pause'}</span>
          </button>
          <button class="btn small ghost" onClick={() => { sfx('click'); engine()?.frameSystem(); }} data-tip="See the whole system (lets go of a followed world)" aria-label="See the whole system">
            <Icon name="focus" /> <span class="vs-label">Whole system</span>
          </button>
        </>
      )}
      {hudPrefs.value.viewMode === 2 && <ThermalLegend />}
    </div>
  );
}

const TICKS: [number, string][] = [
  [0, '0 K'],
  [0.2, '4'],
  [0.4, '25'],
  [0.6, '120'],
  [0.75, '400'],
  [1, '3000 K'],
];

/** The thermal view's key: the same ramp the shaders use, with a few temperatures marked. */
function ThermalLegend() {
  const stops = [0, 0.2, 0.4, 0.6, 0.75, 0.9, 1].map((t) => {
    const k = Math.pow(3001, t) - 1;
    const [r, g, b] = thermalRGB(k);
    return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}) ${t * 100}%`;
  });
  return (
    <div class="thermal-legend" aria-label="Thermal view: temperature scale">
      <div class="tl-bar" style={{ background: `linear-gradient(90deg, ${stops.join(', ')})` }} />
      <div class="tl-ticks mono">
        {TICKS.map(([t, label]) => (
          <span key={label} style={{ left: `${t * 100}%` }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Settlements with nothing queued and no work chosen for when nothing is (such a settlement only recycles). */
const idleColonies = (s: GameState) => colonies(s).filter((c) => c.queue.length === 0 && !c.spare);
const readySettlers = (s: GameState) => Object.values(s.fleets).filter((f) => f.at && f.order === 'idle' && f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles));
const idleShips = (s: GameState) => Object.values(s.fleets).filter((f) => isIdleFleet(f) && !f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles));
const unansweredSignals = (s: GameState) => s.signals.filter((x) => x.arrivedTurn !== null && !x.resolved && x.choices.length).length;

/** Things worth a look before ending the turn (the to-do chips); each one takes you there. */
function todoItems(s: GameState): { text: string; tip: string; go: () => void }[] {
  const idle = idleColonies(s);
  const settlers = readySettlers(s);
  const ships = idleShips(s);
  const unanswered = unansweredSignals(s);
  const todo: { text: string; tip: string; go: () => void }[] = [];
  if (!s.civ.researching) todo.push({ text: 'Research paused', tip: 'Nothing is being researched. Open the research web.', go: () => (modal.value = { kind: 'research' }) });
  if (idle.length)
    todo.push({
      text: `${idle.length} idle settlement${idle.length > 1 ? 's' : ''}`,
      tip: `${idle.map((c) => c.name).join(', ')}\nNothing queued, and nothing chosen to work on instead: their spare industry is only recycled into matter. In a settlement’s Build tab, queue something or choose what it works on when nothing is queued.`,
      go: () => {
        if (idle.length > 1) {
          modal.value = { kind: 'settlements' };
          return;
        }
        openBuildFor.value = idle[0].id;
        goToColony(idle[0]);
      },
    });
  if (settlers.length) todo.push({ text: `${settlers.length} settler${settlers.length > 1 ? 's' : ''} waiting`, tip: 'Choose a world to settle.', go: () => (modal.value = { kind: 'fleets' }) });
  if (ships.length) todo.push({ text: `${ships.length} ship${ships.length > 1 ? 's' : ''} idle`, tip: `${ships.map((f) => f.name).join(', ')}. Click to go to the next one; Fortify or Hold stops the asking.`, go: () => nextIdleShip(s, ships) });
  if (unanswered) todo.push({ text: `${unanswered} signal${unanswered > 1 ? 's' : ''} to answer`, tip: 'Open Signals.', go: () => (modal.value = { kind: 'signals' }) });
  return todo;
}

let lastStep = '';
/**
 * The magnifier mode's N: what needs attention, one thing at a time, the to-do chips' list item by
 * item: research, each idle settlement's Build tab, each waiting settler, each idle ship, the signals.
 */
export function nextTodo(s: GameState) {
  const steps: { key: string; go: () => void }[] = [];
  if (!s.civ.researching) steps.push({ key: 'research', go: () => (modal.value = { kind: 'research' }) });
  for (const c of idleColonies(s))
    steps.push({
      key: `colony:${c.id}`,
      go: () => {
        openBuildFor.value = c.id;
        goToColony(c);
      },
    });
  for (const f of readySettlers(s)) steps.push({ key: `fleet:${f.id}`, go: () => goToFleet(s, f) });
  for (const f of idleShips(s))
    steps.push({
      key: `fleet:${f.id}`,
      go: () => {
        goToFleet(s, f);
        shipPrompt.value = f.id;
      },
    });
  if (unansweredSignals(s)) steps.push({ key: 'signals', go: () => (modal.value = { kind: 'signals' }) });
  if (!steps.length) {
    notify('Nothing is waiting on you this turn.');
    return;
  }
  // the one after the last, or the first again once that one is dealt with
  const at = steps.findIndex((x) => x.key === lastStep);
  const step = steps[(at + 1) % steps.length];
  lastStep = step.key;
  step.go();
}

/** The magnifier mode's B: the selected settlement's Build tab (a star with one settlement of ours counts). */
export function buildSelected(s: GameState) {
  const sel = selection.value;
  const b = sel?.kind === 'body' ? s.bodies[sel.id] : null;
  let c = b?.colonyId ? s.colonies[b.colonyId] : null;
  if (!c && sel?.kind === 'system') {
    const here = colonies(s).filter((x) => x.systemId === sel.id);
    if (here.length === 1) c = here[0];
  }
  if (!c) {
    notify('Select a settlement first. N goes to one waiting for work.');
    return;
  }
  openBuildFor.value = c.id;
  goToColony(c);
}

let idleCursor = 0;
/** Step through the idle ships, one per click, and offer each its choices. */
function nextIdleShip(s: GameState, list: Fleet[]) {
  const f = list[idleCursor++ % list.length];
  goToFleet(s, f);
  shipPrompt.value = f.id;
}
