import { useState } from 'preact/hooks';
import { ANOMALIES } from '../../game/data/events';
import { bodyClimate } from '../../game/physics';
import { LIVING_WORLD, naturalKinRoom } from '../../game/sim/fleets';
import { SHIP_BY_ID, fleetLook } from '../../game/data/ships';
import { THREAD_DEFS } from '../../game/data/threads';
import { formatDistance } from '../../game/eras';
import { computeMods } from '../../game/sim/mods';
import { tripLabel } from '../trip';
import { project } from '../../game/sim/projection';
import { colonies, distLy, popsOf } from '../../game/sim/util';
import type { Body, Colony, Fleet, GameState } from '../../game/types';
import { THREADS } from '../../game/types';
import { signed } from '../fmt';
import { Icon } from '../Icon';
import { PRIMARY_NAME, TRAIT_NAME, bodyKindName, isBeacon, BEACON_TIP } from '../labels';
import { engine, modal, rev, selection, targeting, view } from '../store';
import { sfx } from '../../audio/sfx';
import { ModalFrame } from './Frame';

const ANOMALY_IDS = new Set(ANOMALIES.map((a) => a.id));

export function goToFleet(s: GameState, f: Fleet) {
  sfx('select');
  modal.value = null;
  selection.value = { kind: 'fleet', id: f.id };
  const sysId = f.at ?? f.to ?? f.from;
  if (view.value === 'system' && f.at) {
    engine()?.showSystem(f.at);
  } else if (!f.at && view.value === 'galaxy') {
    // under way: ride along with it
    engine()?.focusFleet(f.id);
  } else if (sysId) {
    // close enough to see the neighbours it could go to next
    view.value = 'galaxy';
    engine()?.showGalaxy(sysId, f.at ? 45 : 110);
  }
  engine()?.select(f.id);
  void s;
}

/** Choose a fleet's next destination by clicking a star on the galaxy map. */
export function pickOnMap(f: Fleet) {
  sfx('click');
  modal.value = null;
  const probe = f.ships.some((x) => SHIP_BY_ID[x.cls]?.survey);
  targeting.value = { fleetId: f.id, order: probe ? 'survey' : 'move' };
  selection.value = { kind: 'fleet', id: f.id };
  engine()?.select(f.id);
  view.value = 'galaxy';
  // pull back far enough to see the stars around it
  if (f.at) engine()?.showGalaxy(f.at, 70);
}

/** Swing the view round to a system: close up on the galaxy map, or (inside) into the system itself. */
export function pivotToSystem(id: string, inside = false) {
  sfx('select');
  modal.value = null;
  if (inside || view.value === 'system') {
    view.value = 'system';
    engine()?.showSystem(id);
  } else engine()?.focusGalaxyOn(id, 40);
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
                      {formatDistance(left)} · {tripLabel(s, left, mods)}{f.order === 'colonize' ? ' · to settle' : f.auto === 'explore' ? ' · exploring' : f.order === 'survey' ? ' · to survey' : ''}
                    </div>
                  </>
                ) : (
                  <>
                    {s.systems[f.at!]?.name}
                    <div class={f.auto === 'explore' ? 'neon' : settler && f.order === 'idle' ? 'neon' : f.order === 'fortify' ? 'good' : 'faint'}>{f.auto === 'explore' ? 'exploring (waiting for energy)' : f.order === 'fortify' ? 'fortified' : f.order === 'hold' ? 'holding' : settler ? 'ready to settle' : 'idle'}</div>
                  </>
                )}
              </span>
              {f.at && (
                <button
                  class="btn ghost small"
                  aria-label={`Look inside ${s.systems[f.at]?.name}`}
                  data-tip={`Look inside ${s.systems[f.at]?.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    selection.value = { kind: 'fleet', id: f.id };
                    pivotToSystem(f.at!, true);
                  }}
                >
                  <Icon name="system" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </ModalFrame>
  );
}

export function SettlementsModal({ s, tab }: { s: GameState; tab?: 'worlds' }) {
  void rev.value;
  const [which, setWhich] = useState<'ours' | 'worlds'>(tab ?? 'ours');
  const surveyedCount = Object.values(s.bodies).filter((b) => s.civ.known[b.systemId] === 2 && !b.dissolved && b.kind !== 'deep').length;
  const tabs = (
    <div class="row" style={{ gap: '4px', marginBottom: '8px' }}>
      <button class={`btn small ${which === 'ours' ? 'primary' : ''}`} onClick={() => setWhich('ours')}>Our settlements</button>
      <button class={`btn small ${which === 'worlds' ? 'primary' : ''}`} onClick={() => setWhich('worlds')}>Surveyed worlds <span class="mono faint">{surveyedCount}</span></button>
    </div>
  );
  if (which === 'worlds')
    return (
      <ModalFrame title="Surveyed worlds" eyebrow="Every world a probe has charted" icon="planet" narrow>
        {tabs}
        <WorldsList s={s} />
      </ModalFrame>
    );
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
      {tabs}
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
                        {bodyKindName(s, b)} · {c.queue.length ? `building ${c.queue.length}` : <span class="warn">idle</span>}
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

export function goToBody(b: Body) {
  sfx('select');
  modal.value = null;
  selection.value = { kind: 'body', id: b.id };
  view.value = 'system';
  engine()?.showSystem(b.systemId, b.id);
}

/** Select a star and centre the view on it (the system panel lists its worlds). */
export function goToSystem(id: string) {
  selection.value = { kind: 'system', id };
  engine()?.select(id);
  pivotToSystem(id);
}

type WorldSort = 'hab' | 'near' | 'room' | 'name';

/** Every charted world, best places to live first: what a settler would find there. */
function WorldsList({ s }: { s: GameState }) {
  void rev.value;
  const [sort, setSort] = useState<WorldSort>('hab');
  const [open, setOpen] = useState(true);
  const [findsOnly, setFindsOnly] = useState(false);
  const [bySystem, setBySystem] = useState(false);
  const cap = colonies(s).find((c) => c.id === s.civ.capitalId);
  const home = s.systems[cap?.systemId ?? s.civ.homeSystemId];
  const rows = Object.values(s.bodies)
    .filter((b) => s.civ.known[b.systemId] === 2 && !b.dissolved && b.kind !== 'deep' && (!open || !b.colonyId))
    .map((b) => {
      const sys = s.systems[b.systemId];
      const c = b.kind === 'gas_giant' || b.kind === 'ice_giant' ? null : bodyClimate(s, b);
      return { b, sys, hab: b.habitability * b.vitality, room: b.kind === 'gas_giant' ? 0 : naturalKinRoom(b), c, ly: distLy(home, sys), finds: b.traits.filter((t) => TRAIT_NAME[t] && ANOMALY_IDS.has(t)) };
    })
    .filter((r) => !findsOnly || r.finds.length > 0)
    .sort((x, y) => Number(isBeacon(s, y.sys)) - Number(isBeacon(s, x.sys)) || (sort === 'hab' ? y.hab - x.hab : sort === 'room' ? y.room - x.room : sort === 'near' ? x.ly - y.ly : x.b.name.localeCompare(y.b.name)) || x.ly - y.ly);
  // the same worlds, one line per star: its best world, its total room, what was found there
  const systems = [...new Set(rows.map((r) => r.sys.id))]
    .map((id) => {
      const rs = rows.filter((r) => r.sys.id === id);
      const best = rs.reduce((a, r) => (r.hab > a.hab ? r : a), rs[0]);
      return {
        sys: rs[0].sys,
        ly: rs[0].ly,
        worlds: rs.length,
        best,
        room: rs.reduce((a, r) => a + r.room, 0),
        living: rs.filter((r) => r.hab >= LIVING_WORLD).length,
        settled: rs.some((r) => r.b.colonyId),
        finds: [...new Set(rs.flatMap((r) => r.finds))],
      };
    })
    .sort((x, y) => Number(isBeacon(s, y.sys)) - Number(isBeacon(s, x.sys)) || (sort === 'hab' ? y.best.hab - x.best.hab : sort === 'room' ? y.room - x.room : sort === 'near' ? x.ly - y.ly : x.sys.name.localeCompare(y.sys.name)) || x.ly - y.ly);
  const sorts: [WorldSort, string][] = [['hab', 'Habitable'], ['room', 'Room'], ['near', 'Nearest'], ['name', 'Name']];
  return (
    <>
      <div class="row wrap" style={{ gap: '4px', marginBottom: '6px' }}>
        <div class="seg" role="group" aria-label="Show">
          <button class={`btn small ${!bySystem ? 'primary' : ''}`} onClick={() => setBySystem(false)} data-tip="Every charted world on its own line">
            Planets
          </button>
          <button class={`btn small ${bySystem ? 'primary' : ''}`} onClick={() => setBySystem(true)} data-tip="One line per star: its best world, total room and discoveries">
            Systems
          </button>
        </div>
        {sorts.map(([k, label]) => (
          <button key={k} class={`btn small ghost ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)}>
            {label}
          </button>
        ))}
        <span class="grow" />
        <button class={`btn small ghost ${findsOnly ? 'on' : ''}`} onClick={() => setFindsOnly(!findsOnly)} data-tip="Only worlds where a survey turned up something remarkable">
          With discoveries
        </button>
        <button class={`btn small ghost ${open ? 'on' : ''}`} onClick={() => setOpen(!open)} data-tip="Hide the worlds we have already settled">
          Unsettled only
        </button>
      </div>
      {rows.length === 0 && <p class="dim">{findsOnly ? 'No discoveries among these worlds yet. Surveys turn one up now and then.' : 'No worlds charted yet. Send a ship to survey a star.'}</p>}
      {bySystem ? (
        <div class="list">
          {systems.map(({ sys, ly, worlds, best, room, living, settled, finds }) => (
            <div key={sys.id} class="list-item world-row" onClick={() => goToSystem(sys.id)}>
              <span class="grow">
                {sys.name} <span class="faint">{PRIMARY_NAME[sys.primary.kind]}</span>
                {isBeacon(s, sys) && <span class="chip boon" style={{ marginLeft: '6px' }} data-tip={BEACON_TIP}>collision star</span>}
                {settled && <span class="chip neon" style={{ marginLeft: '6px' }}>settled</span>}
                {finds.map((t) => (
                  <span key={t} class="chip" style={{ marginLeft: '6px' }} data-tip={TRAIT_NAME[t][1]}>{TRAIT_NAME[t][0]}</span>
                ))}
                <div class="faint" style={{ fontSize: '11px' }}>
                  {worlds} world{worlds === 1 ? '' : 's'}
                  {living ? ` · ${living} living` : ''} · best: {best.b.name} · {formatDistance(ly)}
                </div>
              </span>
              <span class="mono" style={{ fontSize: '12px', textAlign: 'right', minWidth: '64px' }}>
                <span class={best.hab >= LIVING_WORLD ? 'good' : best.hab > 0.05 ? '' : 'faint'} data-tip="Its most habitable world">{Math.round(best.hab * 100)}%</span>
                <div class="faint" style={{ fontSize: '11px' }} data-tip="Room for Kin across all its worlds, without domes or warrens">{room > 0 ? `${room} Kin room` : 'domes only'}</div>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div class="list">
          {rows.map(({ b, sys, hab, room, c, ly, finds }) => (
            <div key={b.id} class="list-item world-row" onClick={() => goToBody(b)}>
              <span class="grow">
                {b.name} <span class="faint">{bodyKindName(s, b)}</span>
                {isBeacon(s, sys) && <span class="chip boon" style={{ marginLeft: '6px' }} data-tip={BEACON_TIP}>collision star</span>}
                {b.colonyId && <span class="chip neon" style={{ marginLeft: '6px' }}>settled</span>}
                {finds.map((t) => (
                  <span key={t} class="chip" style={{ marginLeft: '6px' }} data-tip={TRAIT_NAME[t][1]}>{TRAIT_NAME[t][0]}</span>
                ))}
                <div class="faint" style={{ fontSize: '11px' }}>
                  {sys.name} · {formatDistance(ly)}
                  {c ? ` · ${c.day !== undefined ? `${Math.round(c.night!)}–${Math.round(c.day)}` : Math.round(c.mean)} K` : ''}
                  {b.water !== undefined && b.kind !== 'gas_giant' ? ` · ${Math.round(b.water * 100)}% water` : ''}
                </div>
              </span>
              <span class="mono" style={{ fontSize: '12px', textAlign: 'right', minWidth: '64px' }}>
                <span class={hab >= LIVING_WORLD ? 'good' : hab > 0.05 ? '' : 'faint'}>{Math.round(hab * 100)}%</span>
                <div class="faint" style={{ fontSize: '11px' }} data-tip="Room for Kin without domes or warrens">{b.kind === 'gas_giant' ? 'no Kin' : room > 0 ? `${room} Kin room` : 'domes only'}</div>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
