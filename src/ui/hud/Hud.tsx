import { SHIP_BY_ID } from '../../game/data/ships';
import { formatYears, turnsUntil } from '../../game/eras';
import { computeMods } from '../../game/sim/mods';
import { project, type Projection } from '../../game/sim/projection';
import { setDormant, setPace, longSleep } from '../../game/sim/actions';
import { colonies, hasTech } from '../../game/sim/util';
import type { GameState } from '../../game/types';
import { signed } from '../fmt';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { act, busy, engine, hudPrefs, modal, rev, selection, setHudPrefs, view } from '../store';
import { goToColony } from '../screens/Lists';
import { doEndTurn } from '../turnflow';
import { Chronometer } from './Chronometer';
import { Resources } from './Resources';
import { ResearchPrompt } from './ResearchPrompt';
import { Tutorial } from './Tutorial';
import { sfx } from '../../audio/sfx';

export function Hud({ s }: { s: GameState }) {
  void rev.value;
  const p = project(s);
  return (
    <>
      <Chronometer s={s} />
      <Resources s={s} p={p} />
      <Rail s={s} />
      <BottomLeft s={s} />
      <TurnBox s={s} p={p} />
      <ResearchPrompt s={s} />
      <Tutorial s={s} />
      <ViewSwitch s={s} />
    </>
  );
}

function RailBtn({ icon, label, short, onClick, badge, on }: { icon: IconName; label: string; short: string; onClick: () => void; badge?: number; on?: boolean }) {
  return (
    <button
      class={`btn iconbtn ${on ? 'on' : ''}`}
      data-tip={label}
      aria-label={label}
      onClick={() => {
        sfx('click');
        onClick();
      }}
    >
      <Icon name={icon} size="lg" />
      <span class="rail-label" aria-hidden="true">{short}</span>
      {badge ? <span class="badge">{badge}</span> : null}
    </button>
  );
}

function Rail({ s }: { s: GameState }) {
  void rev.value; // mutable game state: re-render on every change
  const unanswered = s.signals.filter((x) => x.arrivedTurn !== null && !x.resolved && x.choices.length).length;
  const m = modal.value?.kind;
  const readySettlers = Object.values(s.fleets).filter((f) => f.at && f.order === 'idle' && f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles)).length;
  return (
    <nav class="rail panel" aria-label="Civilization">
      <RailBtn icon="research" label={`Research${s.civ.researching ? '' : ': nothing chosen'}`} short="Research" on={m === 'research'} badge={s.civ.researching ? 0 : 1} onClick={() => (modal.value = { kind: 'research' })} />
      <RailBtn icon="colony" label="Settlements" short="Settle" on={m === 'settlements'} onClick={() => (modal.value = { kind: 'settlements' })} />
      <RailBtn icon="fleet" label="Fleets" short="Fleets" on={m === 'fleets'} badge={readySettlers} onClick={() => (modal.value = { kind: 'fleets' })} />
      <RailBtn icon="threads" label="Threads: the kinds of mind you are made of" short="Threads" on={m === 'threads'} onClick={() => (modal.value = { kind: 'threads' })} />
      <RailBtn icon="doctrines" label="Charters: the book of laws" short="Laws" on={m === 'charters'} onClick={() => (modal.value = { kind: 'charters' })} />
      <RailBtn icon="diplomacy" label="Signals: the other minds" short="Signals" on={m === 'signals'} badge={unanswered} onClick={() => (modal.value = { kind: 'signals' })} />
      <RailBtn icon="log" label="The Record" short="Record" on={m === 'log'} onClick={() => (modal.value = { kind: 'log' })} />
      <RailBtn icon="info" label="Codex: how to play, and how the universe ends" short="Codex" on={m === 'codex'} onClick={() => (modal.value = { kind: 'codex' })} />
      <RailBtn icon="save" label="Save and load" short="Save" on={m === 'save'} onClick={() => (modal.value = { kind: 'save' })} />
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
  return (
    <div class="bottom-left">
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
          const turns = isFinite(f.dueYears) && s.era !== 'dark' ? turnsUntil(s.era, s.years, f.dueYears, s.settings.length, 0) : Infinity;
          return (
            <div
              key={f.uid}
              class="forecast panel"
              data-tip={f.text}
              onClick={() => {
                if (f.systemId) {
                  selection.value = { kind: 'system', id: f.systemId };
                  engine()?.select(f.systemId);
                  if (view.value === 'galaxy') engine()?.focusGalaxyOn(f.systemId, 120);
                }
              }}
              style={{ cursor: f.systemId ? 'pointer' : 'default' }}
            >
              <Icon name={f.severity === 'boon' ? 'energy' : 'warning'} cls={f.severity === 'danger' ? 'bad' : f.severity === 'boon' ? 'boon' : 'warn'} />
              <div class="grow">
                <div class="t">{f.title}</div>
                <div class="faint" style={{ fontSize: '11px' }}>
                  {isFinite(f.dueYears) ? `in ${formatYears(f.dueYears - s.years)}` : 'now'}
                  {isFinite(turns) ? ` · ~${turns} turns` : ''}
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
              <span class="faint mono" style={{ fontSize: '10px' }}>
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

const PACE_LABEL: Record<number, string> = { 3: 'Quick ×1000', 2: 'Quick ×100', 1: 'Quick ×10', 0: 'Tide', [-1]: 'Slow ×10', [-2]: 'Slow ×100' };

function TurnBox({ s, p }: { s: GameState; p: Projection }) {
  void rev.value; // mutable game state: re-render on every change
  const mods = computeMods(s);
  const civ = s.civ;
  const paces: number[] = [];
  for (let x = mods.paceMax; x >= mods.paceMin; x--) paces.push(x);
  const idle = colonies(s).filter((c) => c.queue.length === 0);
  const unanswered = s.signals.filter((x) => x.arrivedTurn !== null && !x.resolved && x.choices.length).length;
  const readySettlers = Object.values(s.fleets).filter((f) => f.at && f.order === 'idle' && f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles));
  // things worth a look before ending the turn; each one takes you there
  const todo: { text: string; tip: string; go: () => void }[] = [];
  if (!civ.researching) todo.push({ text: 'Research paused', tip: 'Nothing is being researched. Open the research web.', go: () => (modal.value = { kind: 'research' }) });
  if (idle.length) todo.push({ text: `${idle.length} idle settlement${idle.length > 1 ? 's' : ''}`, tip: idle.map((c) => c.name).join(', '), go: () => (idle.length === 1 ? goToColony(idle[0]) : (modal.value = { kind: 'settlements' })) });
  if (readySettlers.length) todo.push({ text: `${readySettlers.length} settler${readySettlers.length > 1 ? 's' : ''} waiting`, tip: 'Choose a world to settle.', go: () => (modal.value = { kind: 'fleets' }) });
  if (unanswered) todo.push({ text: `${unanswered} signal${unanswered > 1 ? 's' : ''} to answer`, tip: 'Open Signals.', go: () => (modal.value = { kind: 'signals' }) });
  const warnings = todo.map((t) => t.text);
  const eNet = p.energyIn - p.energyOut;
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
          <span class="mono faint" style={{ fontSize: '11px' }} data-tip="How much cosmic time the next turn will cover at this pace.">
            next turn {isFinite(p.turnYears) ? formatYears(p.turnYears) : 'deep time'}
          </span>
        </div>
        <div class="opts">
          {paces.map((x) => (
            <button
              key={x}
              class={`btn small ${civ.pace === x ? 'primary' : ''}`}
              data-tip={
                x > 0
                  ? `Quicken ×${Math.pow(10, x)}: shorter turns, more turns to act while a source lasts. Energy per turn drops ${Math.pow(10, x)}×; minds that cannot hurry idle.`
                  : x < 0
                    ? `Slow ×${Math.pow(10, -x)}: longer turns. ${Math.pow(10, -x)}× the energy per turn, but the universe moves on faster between your decisions.`
                    : 'The Tide: the natural pace of this age.'
              }
              onClick={() => act((g) => setPace(g, x))}
            >
              {PACE_LABEL[x] ?? `${x}`}
            </button>
          ))}
        </div>
        <div class="row" style={{ marginTop: '6px' }}>
          <button class={`btn small ${civ.dormant ? 'on' : ''}`} data-tip="Dormancy: sleep through the coming turns. Upkeep falls to a tenth; nothing is built or learned; energy is still collected." onClick={() => act((g) => setDormant(g, !g.civ.dormant))}>
            <Icon name={civ.dormant ? 'wake' : 'sleep'} /> {civ.dormant ? 'Wake' : 'Sleep'}
          </button>
          {hasTech(s, 'hibernation_protocols') && (
            <button class="btn small" data-tip="Long Sleep: stay dormant for the next five turns. Turns end on their own, pausing whenever an event needs a decision; press Wake to stop early. On waking, output is +30% for a turn." onClick={() => act((g) => longSleep(g, 5)) && doEndTurn()}>
              Long Sleep ×5
            </button>
          )}
          <span class={`mono grow ${eNet >= 0 ? 'good' : 'bad'}`} style={{ textAlign: 'right', fontSize: '12px' }}>
            {signed(eNet)} energy
          </span>
        </div>
      </div>
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
      <button class={`btn small ${view.value === 'galaxy' ? 'primary' : ''}`} onClick={() => { view.value = 'galaxy'; engine()?.showGalaxy(); }} data-tip="The Coalescence">
        <Icon name="galaxy" /> Galaxy
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
      >
        <Icon name="system" /> System
      </button>
      <button class="btn small ghost" onClick={home} data-tip="Back to your capital">
        <Icon name="colony" />
      </button>
    </div>
  );
}
