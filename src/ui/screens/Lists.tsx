import { useState } from 'preact/hooks';
import { siteValue } from '../../game/sim/sites';
import { ANOMALIES } from '../../game/data/events';
import { bodyClimate, sourceLight } from '../../game/physics';
import { LIVING_WORLD, naturalKinRoom } from '../../game/sim/fleets';
import { SHIP_BY_ID, fleetLook } from '../../game/data/ships';
import { THREAD_DEFS } from '../../game/data/threads';
import { formatDistance, formatYears } from '../../game/eras';
import { computeMods } from '../../game/sim/mods';
import { tripLabel } from '../trip';
import { project } from '../../game/sim/projection';
import { starClock, turnStep, turnsUntilYears } from '../../game/sim/flare';
import { colonies, distLy, popsOf, swarmSeenAt } from '../../game/sim/util';
import type { Body, Colony, Fleet, GameState, StarSystem, ThreadId } from '../../game/types';
import { THREADS } from '../../game/types';
import { n1, signed } from '../fmt';
import { Icon } from '../Icon';
import { PRIMARY_NAME, TRAIT_NAME, bodyKindName, isBeacon, BEACON_TIP, SWARM_TIP } from '../labels';
import { engine, modal, rev, selection, targeting, view, type SystemsTab } from '../store';
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

/**
 * The Systems window: our settlements, every surveyed world, and in the Degenerate Age the
 * collision stars. The open tab lives in the modal itself, so S and W open (and close) the right one.
 */
export function SystemsModal({ s, tab }: { s: GameState; tab?: SystemsTab }) {
  void rev.value;
  const degenerate = s.era === 'degenerate';
  const which = tab === 'beacons' && !degenerate ? undefined : tab;
  const show = (t?: SystemsTab) => (modal.value = { kind: 'settlements', tab: t });
  const surveyedCount = Object.values(s.bodies).filter((b) => s.civ.known[b.systemId] === 2 && !b.dissolved && b.kind !== 'deep').length;
  const burning = degenerate ? Object.values(s.systems).filter((x) => isBeacon(s, x)).length : 0;
  const tabs = (
    <div class="row wrap" style={{ gap: '4px', marginBottom: '8px' }}>
      <button class={`btn small ${!which ? 'primary' : ''}`} onClick={() => show()}>Our settlements</button>
      <button class={`btn small ${which === 'worlds' ? 'primary' : ''}`} onClick={() => show('worlds')}>Surveyed worlds <span class="mono faint">{surveyedCount}</span></button>
      {degenerate && (
        <button class={`btn small ${which === 'beacons' ? 'primary' : ''}`} onClick={() => show('beacons')} data-tip={`${BEACON_TIP} Every one on our map, and how long each will burn.`}>
          ✦ Collision stars <span class={`mono ${burning ? 'boon' : 'faint'}`}>{burning}</span>
        </button>
      )}
    </div>
  );
  if (which === 'worlds')
    return (
      <ModalFrame title="Systems" eyebrow="Surveyed worlds: every world a probe has charted" icon="planet" narrow>
        {tabs}
        <WorldsList s={s} />
      </ModalFrame>
    );
  if (which === 'beacons')
    return (
      <ModalFrame title="Systems" eyebrow={`Collision stars: ${burning ? `${burning} burning on our map` : 'none burning on our map'}`} icon="red_dwarf" narrow>
        {tabs}
        <BeaconsList s={s} />
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
    <ModalFrame title="Systems" eyebrow={`Our settlements: ${colonies(s).length} in ${bySystem.size} system${bySystem.size === 1 ? '' : 's'} · ${total} people`} icon="colony" narrow>
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

type WorldSort = 'hab' | 'near' | 'room' | 'name' | 'echoes' | 'lattice' | 'coldminds';
/** Sorts that rank by what one kind of mind needs (see sites.ts). */
const MIND_SORT: Partial<Record<WorldSort, ThreadId>> = { echoes: 'echoes', lattice: 'lattice', coldminds: 'coldminds' };

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
      const mind = MIND_SORT[sort];
      return { b, sys, hab: b.habitability * b.vitality, room: b.kind === 'gas_giant' ? 0 : naturalKinRoom(b), c, ly: distLy(home, sys), finds: b.traits.filter((t) => TRAIT_NAME[t] && ANOMALY_IDS.has(t)), v: mind ? siteValue(s, b, mind) : null };
    })
    .filter((r) => !findsOnly || r.finds.length > 0)
    .sort((x, y) => Number(isBeacon(s, y.sys)) - Number(isBeacon(s, x.sys)) || (x.v && y.v ? y.v.score - x.v.score : sort === 'hab' ? y.hab - x.hab : sort === 'room' ? y.room - x.room : sort === 'near' ? x.ly - y.ly : x.b.name.localeCompare(y.b.name)) || x.ly - y.ly);
  // the same worlds, one line per star: its best world, its total room, what was found there
  const systems = [...new Set(rows.map((r) => r.sys.id))]
    .map((id) => {
      const rs = rows.filter((r) => r.sys.id === id);
      const best = rs.reduce((a, r) => ((r.v && a.v ? r.v.score > a.v.score : r.hab > a.hab) ? r : a), rs[0]);
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
    .sort((x, y) => Number(isBeacon(s, y.sys)) - Number(isBeacon(s, x.sys)) || (x.best.v && y.best.v ? y.best.v.score - x.best.v.score : sort === 'hab' ? y.best.hab - x.best.hab : sort === 'room' ? y.room - x.room : sort === 'near' ? x.ly - y.ly : x.sys.name.localeCompare(y.sys.name)) || x.ly - y.ly);
  const sorts: [WorldSort, string, string][] = [
    ['hab', 'Habitable', 'Best for Kin: habitability × vitality'],
    ['room', 'Room', 'Most room for Kin without domes'],
    ['echoes', 'Power', 'Best for Echoes and the Chorus: the energy a settlement there could collect each turn at the Tide'],
    ['lattice', 'Matter', 'Best for the Lattice: the matter its mines, skimmers and lifters could raise each turn at the Tide'],
    ['coldminds', 'Lasting', 'Best for Coldminds: the worlds that will last longest before falling into their dead stars'],
    ['near', 'Nearest', 'Nearest to the capital'],
    ['name', 'Name', 'Alphabetical'],
  ];
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
        {sorts.map(([k, label, tip]) => (
          <button key={k} class={`btn small ghost ${sort === k ? 'on' : ''}`} onClick={() => setSort(k)} data-tip={tip}>
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
              {best.v ? (
                <span class="mono" style={{ fontSize: '12px', textAlign: 'right', minWidth: '64px' }} data-tip={`${best.v.tip} (its best world)`}>
                  {best.v.label}
                </span>
              ) : (
                <span class="mono" style={{ fontSize: '12px', textAlign: 'right', minWidth: '64px' }}>
                  <span class={best.hab >= LIVING_WORLD ? 'good' : best.hab > 0.05 ? '' : 'faint'} data-tip="Its most habitable world">{Math.round(best.hab * 100)}%</span>
                  <div class="faint" style={{ fontSize: '11px' }} data-tip="Room for Kin across all its worlds, without domes or warrens">{room > 0 ? `${room} Kin room` : 'domes only'}</div>
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div class="list">
          {rows.map(({ b, sys, hab, room, c, ly, finds, v }) => (
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
              {v ? (
                <span class="mono" style={{ fontSize: '12px', textAlign: 'right', minWidth: '64px' }} data-tip={v.tip}>
                  {v.label}
                </span>
              ) : (
                <span class="mono" style={{ fontSize: '12px', textAlign: 'right', minWidth: '64px' }}>
                  <span class={hab >= LIVING_WORLD ? 'good' : hab > 0.05 ? '' : 'faint'}>{Math.round(hab * 100)}%</span>
                  <div class="faint" style={{ fontSize: '11px' }} data-tip="Room for Kin without domes or warrens">{b.kind === 'gas_giant' ? 'no Kin' : room > 0 ? `${room} Kin room` : 'domes only'}</div>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * The Degenerate Age's collision stars on our map, the longest-burning first: how long each has
 * left at this pace, what its light is worth, and who is there. Turns in this age can outlast a
 * collision star's whole life, so many light and go out within one; those keep the name until the
 * turn ends and are listed apart, without light.
 */
function BeaconsList({ s }: { s: GameState }) {
  void rev.value;
  const cap = colonies(s).find((c) => c.id === s.civ.capitalId);
  const home = s.systems[cap?.systemId ?? s.civ.homeSystemId];
  const ours = new Set(colonies(s).map((c) => c.systemId));
  const L = turnStep(s).turnLength;
  const stars = Object.values(s.systems).filter((x) => x.primary.kind === 'collision_star' && !x.gone && (s.civ.known[x.id] ?? 0) > 0);
  const burning = stars
    .filter((x) => isBeacon(s, x))
    .map((sys) => {
      const dies = sys.primary.diesAt ?? s.years;
      return { sys, left: dies - s.years, turns: turnsUntilYears(s, dies), light: sourceLight(s, sys, s.years, isFinite(L) ? L : 0).light, ly: distLy(home, sys) };
    })
    .sort((a, b) => b.left - a.left || a.ly - b.ly);
  const out = stars
    .filter((x) => !isBeacon(s, x))
    .map((sys) => ({ sys, life: (sys.primary.diesAt ?? 0) - (sys.primary.bornAt ?? Infinity), ly: distLy(home, sys) }))
    .sort((a, b) => a.ly - b.ly);
  const kept = starClock(s);
  const worldsOf = (sys: StarSystem) => sys.bodies.filter((id) => s.bodies[id] && !s.bodies[id].dissolved && s.bodies[id].kind !== 'deep').length;
  const others = (sys: StarSystem) => (s.civ.known[sys.id] === 2 ? Object.values(s.survivors).find((v) => v.alive && v.systems.includes(sys.id)) : undefined);
  const chipGap = { marginLeft: '6px' };
  return (
    <>
      {burning.length === 0 ? (
        <p class="dim">
          {s.eta >= 21
            ? 'No collision star is burning on our map, and no more will light: the galaxy has evaporated, and brown dwarfs no longer meet.'
            : 'No collision star is burning on our map. Now and then two brown dwarfs, each too small to burn hydrogen, collide and merge into a body heavy enough to burn it: a small red star that shines for one to ten trillion years. While one burns it heads every list of destinations, and its name shows on the galaxy map with a ✦.'}
        </p>
      ) : (
        <p class="dim" style={{ fontSize: '12px', margin: '0 0 6px' }}>
          Small red stars lit by colliding brown dwarfs: in this age nothing else nearby shines like them, and none lasts. The longest-burning first.
        </p>
      )}
      <div class="list">
        {burning.map(({ sys, left, turns, light, ly }) => {
          const known = s.civ.known[sys.id] ?? 0;
          const worlds = worldsOf(sys);
          const v = others(sys);
          return (
            <div key={sys.id} class="list-item world-row" onClick={() => goToSystem(sys.id)}>
              <span class="grow">
                <span class="boon">✦</span> {sys.name} <span class="faint">{s.provinces.find((p) => p.id === sys.provinceId)?.name ?? ''}</span>
                {kept?.systemId === sys.id && (
                  <span class="chip neon" style={chipGap} data-tip={`We are keeping time with it: turn ${kept.turn} of ${kept.of}, each a sixth of what was left of its life, whatever the pace.`}>
                    keeping time
                  </span>
                )}
                {ours.has(sys.id) && <span class="chip neon" style={chipGap}>settled</span>}
                {known < 2 && <span class="chip warn" style={chipGap}>not surveyed</span>}
                {swarmSeenAt(s, sys.id) && <span class="chip danger" style={chipGap} data-tip={SWARM_TIP}>swarm</span>}
                {v && (
                  <span class="chip" style={{ ...chipGap, color: v.color, borderColor: v.color }} data-tip={v.contact ? `${v.name} live there` : 'Someone lives there'}>
                    {v.contact ? v.name : 'someone lives there'}
                  </span>
                )}
                <div class="faint" style={{ fontSize: '11px' }}>
                  {known === 2 ? `${worlds} world${worlds === 1 ? '' : 's'}` : 'worlds not charted'} · {formatDistance(ly)} · {formatYears(left)} of light left
                </div>
              </span>
              <span class="mono" style={{ fontSize: '12px', textAlign: 'right', minWidth: '84px' }}>
                <span class="good" data-tip="How much a light collector here gathers this turn compared with its rating.">×{light < 1 ? light.toFixed(2) : n1(light)} light</span>
                <div
                  class={turns <= 1 ? 'warn' : 'faint'}
                  style={{ fontSize: '11px' }}
                  data-tip={`${
                    turns <= 1
                      ? 'At this pace it goes out during this turn, so collectors catch its light for only part of it.'
                      : isFinite(turns)
                        ? `At this pace it gives light for ${turns} turns, counting this one, and goes out during the last of them.`
                        : 'At this pace it burns for longer than we can foresee.'
                  } ${formatYears(left)} of light left.`}
                >
                  {turns <= 1 ? 'goes out this turn' : isFinite(turns) ? `${turns} turns left` : 'many turns left'}
                </div>
              </span>
            </div>
          );
        })}
      </div>
      {out.length > 0 && (
        <div class="section" style={{ marginTop: '10px' }}>
          <h3>
            Already out <span class="faint" style={{ letterSpacing: 0, textTransform: 'none', fontFamily: 'var(--f-ui)', fontWeight: 400 }}>· lit and went out within the last turn</span>
          </h3>
          <p class="dim" style={{ fontSize: '12px', margin: '0 0 6px' }}>
            The last turn spanned {formatYears(s.turnLength)}, longer than {out.length === 1 ? 'this star' : 'these stars'} burned. Their light is gone; at the end of this turn each settles into a white dwarf.
          </p>
          <div class="list">
            {out.map(({ sys, life, ly }) => (
              <div key={sys.id} class="list-item world-row" onClick={() => goToSystem(sys.id)}>
                <span class="grow faint">
                  {sys.name} <span>{s.provinces.find((p) => p.id === sys.provinceId)?.name ?? ''}</span>
                  <div style={{ fontSize: '11px' }}>
                    {life > 0 ? `burned for ${formatYears(life)} · ` : ''}{formatDistance(ly)}
                  </div>
                </span>
                <span class="mono faint" style={{ fontSize: '11px' }}>out</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
