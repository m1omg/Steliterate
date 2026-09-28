import { SHIP_BY_ID, fleetLook } from '../../game/data/ships';
import { THREAD_DEFS } from '../../game/data/threads';
import { formatDistance } from '../../game/eras';
import { computeMods } from '../../game/sim/mods';
import { travelTurnsEstimate } from '../../game/sim/fleets';
import { project } from '../../game/sim/projection';
import { colonies, popsOf } from '../../game/sim/util';
import type { Colony, Fleet, GameState } from '../../game/types';
import { THREADS } from '../../game/types';
import { signed } from '../fmt';
import { Icon } from '../Icon';
import { BODY_NAME, PRIMARY_NAME } from '../labels';
import { engine, modal, rev, selection, view } from '../store';
import { sfx } from '../../audio/sfx';
import { ModalFrame } from './Frame';

export function goToFleet(s: GameState, f: Fleet) {
  sfx('select');
  modal.value = null;
  selection.value = { kind: 'fleet', id: f.id };
  const sysId = f.at ?? f.to ?? f.from;
  if (view.value === 'system' && f.at) {
    engine()?.showSystem(f.at);
  } else if (sysId) {
    if (view.value === 'system') {
      view.value = 'galaxy';
      engine()?.showGalaxy();
    }
    engine()?.focusGalaxyOn(sysId, 110);
  }
  engine()?.select(f.id);
  void s;
}

export function goToColony(c: Colony) {
  sfx('select');
  modal.value = null;
  selection.value = { kind: 'body', id: c.bodyId };
  view.value = 'system';
  engine()?.showSystem(c.systemId, c.bodyId);
}

function shipSummary(f: Fleet): string {
  const n: Record<string, number> = {};
  for (const x of f.ships) n[x.cls] = (n[x.cls] ?? 0) + 1;
  return Object.entries(n)
    .map(([k, v]) => `${v > 1 ? `${v}× ` : ''}${SHIP_BY_ID[k]?.name ?? k}`)
    .join(', ');
}

export function FleetsModal({ s }: { s: GameState }) {
  void rev.value;
  const mods = computeMods(s);
  const fleets = Object.values(s.fleets).sort((a, b) => Number(!!a.at) - Number(!!b.at) || a.name.localeCompare(b.name));
  return (
    <ModalFrame title="Fleets" eyebrow={`${fleets.length} fleet${fleets.length === 1 ? '' : 's'}`} icon="fleet" narrow>
      {fleets.length === 0 && <p class="dim">No ships. Build probes and settlers at a settlement with a Shipyard.</p>}
      <div class="list">
        {fleets.map((f) => {
          const moving = !f.at && f.to;
          const left = moving ? f.distance - f.traveled : 0;
          const settler = f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles);
          return (
            <div key={f.id} class="list-item fleet-row" onClick={() => goToFleet(s, f)}>
              <img class={`fleet-thumb${moving ? ' moving' : ''}`} src={`art/ships/${fleetLook(f.ships.map((x) => x.cls))}.png`} alt="" />
              <span class="grow">
                {f.name}
                <div class="faint" style={{ fontSize: '11px' }}>{shipSummary(f)}</div>
              </span>
              <span class="mono" style={{ fontSize: '11px', textAlign: 'right' }}>
                {moving ? (
                  <>
                    → {s.systems[f.to!]?.name}
                    <div class="faint">
                      {formatDistance(left)} · ~{travelTurnsEstimate(s, left, mods)}t{f.order === 'colonize' ? ' · to settle' : f.order === 'survey' ? ' · to survey' : ''}
                    </div>
                  </>
                ) : (
                  <>
                    {s.systems[f.at!]?.name}
                    <div class={settler && f.order === 'idle' ? 'neon' : f.order === 'fortify' ? 'good' : 'faint'}>{f.order === 'fortify' ? 'fortified' : f.order === 'hold' ? 'holding' : settler ? 'ready to settle' : 'idle'}</div>
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </ModalFrame>
  );
}

export function SettlementsModal({ s }: { s: GameState }) {
  void rev.value;
  const p = project(s);
  const bySystem = new Map<string, Colony[]>();
  for (const c of colonies(s)) {
    const list = bySystem.get(c.systemId) ?? [];
    list.push(c);
    bySystem.set(c.systemId, list);
  }
  const total = colonies(s).reduce((a, c) => a + popsOf(c) + c.cryo, 0);
  return (
    <ModalFrame title="Settlements" eyebrow={`${colonies(s).length} settlements in ${bySystem.size} system${bySystem.size === 1 ? '' : 's'} · ${total} people`} icon="colony" narrow>
      {[...bySystem.entries()].map(([sid, cs]) => {
        const sys = s.systems[sid];
        return (
          <div key={sid} class="section" style={{ marginTop: '6px' }}>
            <h3>
              {sys.name} <span class="faint" style={{ letterSpacing: 0, textTransform: 'none', fontFamily: 'var(--f-ui)', fontWeight: 400 }}>{PRIMARY_NAME[sys.primary.kind]}</span>
            </h3>
            <div class="list">
              {cs.map((c) => {
                const y = p.perColony[c.id]?.y;
                const net = y ? y.energy - y.energyUpkeep : 0;
                const b = s.bodies[c.bodyId];
                return (
                  <div key={c.id} class="list-item" onClick={() => goToColony(c)}>
                    <span class="grow">
                      {c.name}
                      {s.civ.capitalId === c.id && <span class="chip neon" style={{ marginLeft: '6px' }}>capital</span>}
                      {c.starving > 0 && <span class="chip danger" style={{ marginLeft: '6px' }}>starving</span>}
                      <div class="faint" style={{ fontSize: '11px' }}>
                        {BODY_NAME[b.kind]} · {c.queue.length ? `building ${c.queue.length}` : <span class="warn">idle</span>}
                      </div>
                    </span>
                    <span class="row" style={{ gap: '6px', fontSize: '12px' }}>
                      {THREADS.filter((t) => c.pops[t] > 0).map((t) => (
                        <span key={t} class="row" style={{ gap: '2px' }} data-tip={THREAD_DEFS[t].name}>
                          <Icon name={t} />
                          <span class="mono">{c.pops[t]}</span>
                        </span>
                      ))}
                      {c.cryo > 0 && (
                        <span class="row" style={{ gap: '2px' }} data-tip="In Cold Sleep">
                          <Icon name="cryo" />
                          <span class="mono">{c.cryo}</span>
                        </span>
                      )}
                    </span>
                    <span class={`mono ${net >= 0 ? 'good' : 'bad'}`} style={{ fontSize: '12px', minWidth: '44px', textAlign: 'right' }} data-tip="Energy this settlement adds or costs per turn">
                      {signed(net)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </ModalFrame>
  );
}
