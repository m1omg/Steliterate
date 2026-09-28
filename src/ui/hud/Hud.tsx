import { formatYears, turnsUntil } from '../../game/eras';
import { computeMods } from '../../game/sim/mods';
import { project, type Projection } from '../../game/sim/projection';
import { setDormant, setPace, longSleep } from '../../game/sim/actions';
import { colonies, hasTech } from '../../game/sim/util';
import type { GameState } from '../../game/types';
import { signed } from '../fmt';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { act, busy, engine, modal, rev, selection, view } from '../store';
import { doEndTurn } from '../turnflow';
import { Chronometer } from './Chronometer';
import { Resources } from './Resources';
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
      <ViewSwitch s={s} />
    </>
  );
}

function RailBtn({ icon, label, onClick, badge, on }: { icon: IconName; label: string; onClick: () => void; badge?: number; on?: boolean }) {
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
      {badge ? <span class="badge">{badge}</span> : null}
    </button>
  );
}

function Rail({ s }: { s: GameState }) {
  void rev.value; // mutable game state: re-render on every change
  const unanswered = s.signals.filter((x) => x.arrivedTurn !== null && !x.resolved && x.choices.length).length;
  const m = modal.value?.kind;
  return (
    <nav class="rail panel" aria-label="Civilization">
      <RailBtn icon="research" label={`Research${s.civ.researching ? '' : ': nothing chosen'}`} on={m === 'research'} badge={s.civ.researching ? 0 : 1} onClick={() => (modal.value = { kind: 'research' })} />
      <RailBtn icon="threads" label="Threads: the kinds of mind you are made of" on={m === 'threads'} onClick={() => (modal.value = { kind: 'threads' })} />
      <RailBtn icon="doctrines" label="Charters: the book of laws" on={m === 'charters'} onClick={() => (modal.value = { kind: 'charters' })} />
      <RailBtn icon="diplomacy" label="Signals: the other minds" on={m === 'signals'} badge={unanswered} onClick={() => (modal.value = { kind: 'signals' })} />
      <RailBtn icon="log" label="The Record" on={m === 'log'} onClick={() => (modal.value = { kind: 'log' })} />
      <RailBtn icon="info" label="Codex: how the end of the universe works" on={m === 'codex'} onClick={() => (modal.value = { kind: 'codex' })} />
      <RailBtn icon="save" label="Save and load" on={m === 'save'} onClick={() => (modal.value = { kind: 'save' })} />
      <RailBtn icon="settings" label="Settings" on={m === 'settings'} onClick={() => (modal.value = { kind: 'settings' })} />
    </nav>
  );
}

function BottomLeft({ s }: { s: GameState }) {
  void rev.value; // mutable game state: re-render on every change
  const fc = s.forecasts.slice(0, 3);
  const feed = s.log.slice(-7).reverse();
  return (
    <div class="bottom-left">
      {fc.map((f) => {
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
              </div>
            </div>
            <span class="n">{isFinite(turns) ? `~${turns} turns` : ''}</span>
          </div>
        );
      })}
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
    </div>
  );
}

const PACE_LABEL: Record<number, string> = { 3: '×1/1000', 2: '×1/100', 1: '×1/10', 0: 'Tide', [-1]: '×10', [-2]: '×100' };

function TurnBox({ s, p }: { s: GameState; p: Projection }) {
  void rev.value; // mutable game state: re-render on every change
  const mods = computeMods(s);
  const civ = s.civ;
  const paces: number[] = [];
  for (let x = mods.paceMax; x >= mods.paceMin; x--) paces.push(x);
  const idleQueues = colonies(s).filter((c) => c.queue.length === 0).length;
  const warnings: string[] = [];
  if (!civ.researching) warnings.push('no research chosen');
  if (idleQueues) warnings.push(`${idleQueues} idle settlement${idleQueues > 1 ? 's' : ''}`);
  const unanswered = s.signals.filter((x) => x.arrivedTurn !== null && !x.resolved && x.choices.length).length;
  if (unanswered) warnings.push(`${unanswered} unanswered signal${unanswered > 1 ? 's' : ''}`);
  const eNet = p.energyIn - p.energyOut;
  return (
    <div class="turnbox">
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
