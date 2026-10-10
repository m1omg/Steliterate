import { useState } from 'preact/hooks';
import { siteValue } from '../../game/sim/sites';
import { ANOMALIES } from '../../game/data/events';
import { bodyClimate, sourceLight } from '../../game/physics';
import { LIVING_WORLD, naturalKinRoom } from '../../game/sim/fleets';
import { habitabilityOf } from '../../game/sim/terraform';
import { SiteStrip, bestOf, starSites, worldSites, type Need, type Sites } from '../siteStrip';
import { YIELDS, yieldOf, yieldText, yieldTip } from '../yields';
import { SHIP_BY_ID, fleetLook } from '../../game/data/ships';
import { THREAD_DEFS } from '../../game/data/threads';
import { formatDistance, formatYears } from '../../game/eras';
import { computeMods } from '../../game/sim/mods';
import { TRIP_TIP, tripLabel } from '../trip';
import { orderFleet } from '../../game/sim/actions';
import { DWARF_COLD_AT } from '../../game/physics';
import { project } from '../../game/sim/projection';
import { starClock, turnStep, turnsUntilYears } from '../../game/sim/flare';
import { colonies, distLy, popsOf, swarmSeenAt } from '../../game/sim/util';
import type { Body, Colony, Fleet, GameState, PrimaryKind, StarSystem, ThreadId } from '../../game/types';
import { THREADS } from '../../game/types';
import { kelvin, n1 } from '../fmt';
import { Icon } from '../Icon';
import { PRIMARY_NAME, TRAIT_NAME, bodyKindName, isBeacon, primaryIcon, spareChoices, BEACON_TIP, SWARM_TIP } from '../labels';
import { act, engine, game, hoverStar, modal, notify, openBuildFor, rev, selection, settings, targeting, view, type SystemsTab } from '../store';
import { sfx } from '../../audio/sfx';
import { ModalFrame } from './Frame';
import { pressable } from '../a11y';
import { calendarEra } from '../../game/fate';

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

/** Send the fleet being given a destination on the map to this star (the map click, or the banner's Send). */
export function sendPicked(dest: string): boolean {
  const t = targeting.value;
  if (!t) return false;
  targeting.value = null;
  hoverStar.value = null;
  const f = game.value?.fleets[t.fleetId];
  if (!act((g) => orderFleet(g, t.fleetId, dest, t.order))) return false;
  sfx('select');
  const g = game.value;
  if (g && f?.to) notify(`${f.name} sets out for ${g.systems[dest].name}: ${tripLabel(g, f.distance, computeMods(g), true)}.`, 'info');
  return true;
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
            <div key={f.id} class="list-item fleet-row" {...pressable(() => goToFleet(s, f))}>
              <img class={`fleet-thumb${moving ? ' moving' : ''}`} src={`art/ships/${fleetLook(f.ships.map((x) => x.cls))}.png`} alt="" />
              <span class="grow">
                {f.name}
                <div class="faint" style={{ fontSize: '12.5px' }}>{shipSummary(f)}</div>
              </span>
              <span class="mono" style={{ fontSize: '12.5px', textAlign: 'right' }}>
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
 * Open the Systems window to choose where a stationed ship goes: collision stars first while any
 * burn; in the magnifier mode a probe's list is the stars not yet surveyed.
 */
export function sendFromSystems(s: GameState, f: Fleet) {
  sfx('click');
  const burning = calendarEra(s) === 'degenerate' && Object.values(s.systems).some((x) => isBeacon(s, x));
  const afar = !!settings.value.lowVision && f.ships.some((x) => SHIP_BY_ID[x.cls]?.survey) && Object.values(s.systems).some((x) => s.civ.known[x.id] === 1 && !x.gone);
  modal.value = { kind: 'settlements', tab: burning ? 'beacons' : afar ? 'afar' : 'worlds', send: f.id };
}

/** In the Systems window opened from a ship: send it to this star (the fleet's panel then shows the order). */
function SendButton({ s, f, sys }: { s: GameState; f: Fleet; sys: StarSystem }) {
  if (f.at === sys.id)
    return (
      <span class="chip" style={{ marginLeft: '6px' }}>
        {f.name} is here
      </span>
    );
  const from = s.systems[f.at!];
  const trip = tripLabel(s, distLy(from, sys), computeMods(s));
  return (
    <button
      class="btn small primary send-here"
      style={{ padding: '1px 6px', marginLeft: '6px', whiteSpace: 'nowrap' }}
      data-tip={`Send ${f.name} to ${sys.name}.\n${TRIP_TIP}`}
      onClick={(e) => {
        e.stopPropagation();
        if (act((g) => orderFleet(g, f.id, sys.id, 'move'))) goToFleet(s, s.fleets[f.id] ?? f);
      }}
    >
      Send · {trip}
    </button>
  );
}

/**
 * The Systems window: our settlements, every surveyed world, and in the Degenerate Age the
 * collision stars. The open tab lives in the modal itself, so S and W open (and close) the right one.
 * Opened from a ship (`send`), every star in it can be its destination.
 */
export function SystemsModal({ s, tab, send }: { s: GameState; tab?: SystemsTab; send?: string }) {
  void rev.value;
  const degenerate = calendarEra(s) === 'degenerate';
  const lv = !!settings.value.lowVision;
  const which = (tab === 'beacons' && !degenerate) || (tab === 'afar' && !lv) ? undefined : tab;
  const f = send ? s.fleets[send] : undefined;
  const sending = f?.at ? f : undefined;
  const show = (t?: SystemsTab) => (modal.value = { kind: 'settlements', tab: t, send: sending?.id });
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
      {lv && (
        <button class={`btn small ${which === 'afar' ? 'primary' : ''}`} onClick={() => show('afar')} data-tip="Every star on our map not yet surveyed, nearest first: to look at, or to send a ship to, without finding it on the map.">
          Seen from afar <span class="mono faint">{Object.values(s.systems).filter((x) => s.civ.known[x.id] === 1 && !x.gone).length}</span>
        </button>
      )}
      {sending && (
        <div class="row" style={{ gap: '6px', width: '100%', marginTop: '4px', fontSize: '13.5px' }}>
          <span class="grow neon">Where should {sending.name} go? Send it to any star on these lists.</span>
          <button class="btn small ghost" onClick={() => (modal.value = { kind: 'settlements', tab: which })} data-tip="Keep the window open without choosing a destination">
            Just browse
          </button>
        </div>
      )}
    </div>
  );
  if (which === 'worlds')
    return (
      <ModalFrame title="Systems" eyebrow="Surveyed worlds: every world a probe has charted" icon="planet" narrow>
        {tabs}
        <WorldsList s={s} send={sending} />
      </ModalFrame>
    );
  if (which === 'afar')
    return (
      <ModalFrame title="Systems" eyebrow="Seen from afar: stars on our map not yet surveyed" icon="system" narrow>
        {tabs}
        <AfarList s={s} send={sending} />
      </ModalFrame>
    );
  if (which === 'beacons')
    return (
      <ModalFrame title="Systems" eyebrow={`Collision stars: ${burning ? `${burning} burning on our map` : 'none burning on our map'}`} icon="red_dwarf" narrow>
        {tabs}
        <BeaconsList s={s} send={sending} />
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
      {bySystem.size > 0 && (
        <div class="yield-heads">
          <span class="grow faint">Each turn</span>
          <span class="yield-cells">
            {YIELDS.map(({ key, name, what }) => (
              <span key={key} data-tip={`${name}: ${what}`}>
                <Icon name={key} />
              </span>
            ))}
          </span>
        </div>
      )}
      {[...bySystem.entries()].map(([sid, cs]) => {
        const sys = s.systems[sid];
        return (
          <div key={sid} class="section" style={{ marginTop: '6px' }}>
            <h3 class="row" style={{ gap: '4px' }}>
              <span class="grow">
                {sys.name} <span class="faint" style={{ letterSpacing: 0, textTransform: 'none', fontFamily: 'var(--f-ui)', fontWeight: 400 }}>{PRIMARY_NAME[sys.primary.kind]}</span>
              </span>
              {sending && <SendButton s={s} f={sending} sys={sys} />}
            </h3>
            <div class="list">
              {cs.map((c) => {
                const y = p.perColony[c.id]?.y;
                const b = s.bodies[c.bodyId];
                return (
                  <div
                    key={c.id}
                    class="list-item settlement-row"
                    {...pressable(() => {
                      // an idle settlement opens where it can be given something to do
                      if (!c.queue.length && !c.spare) openBuildFor.value = c.id;
                      goToColony(c);
                    })}
                  >
                    <span class="grow">
                      {c.name}
                      {s.civ.capitalId === c.id && <span class="chip neon" style={{ marginLeft: '6px' }}>capital</span>}
                      {c.starving > 0 && <span class="chip danger" style={{ marginLeft: '6px' }}>starving</span>}
                      <div class="faint" style={{ fontSize: '12.5px' }}>
                        {bodyKindName(s, b)} · {c.queue.length ? `building ${c.queue.length}` : c.spare ? `working: ${spareChoices(s).find((x) => x.id === c.spare)?.name.toLowerCase()}` : <span class="warn">idle</span>}
                      </div>
                    </span>
                    <span class="row" style={{ gap: '6px', fontSize: '13.5px' }}>
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
                    {y && (
                      <span class="yield-cells">
                        {YIELDS.map(({ key }) => {
                          const v = yieldOf(y, key);
                          const tone = v < -0.049 ? 'bad' : Math.abs(v) <= 0.049 ? 'faint' : key === 'energy' ? 'good' : '';
                          return (
                            <span key={key} class={`mono ${tone}`} data-tip={yieldTip(y, key)}>
                              <Icon name={key} /> {yieldText(y, key)}
                            </span>
                          );
                        })}
                      </span>
                    )}
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
/**
 * The magnifier mode: every star on our map not yet surveyed, nearest first (to the ship being sent,
 * or to the capital), to look at or send a ship to without finding it on the map.
 */
function AfarList({ s, send }: { s: GameState; send?: Fleet }) {
  const cap = s.civ.capitalId ? s.colonies[s.civ.capitalId] : null;
  const from = s.systems[send?.at ?? cap?.systemId ?? s.civ.homeSystemId];
  const rows = Object.values(s.systems)
    .filter((x) => s.civ.known[x.id] === 1 && !x.gone)
    .map((sys) => ({ sys, ly: distLy(from, sys) }))
    .sort((a, b) => a.ly - b.ly);
  if (!rows.length) return <p class="dim">Every star on our map is surveyed.</p>;
  return (
    <div class="list">
      {rows.map(({ sys, ly }) => (
        <div key={sys.id} class="list-item world-row" {...pressable(() => goToSystem(sys.id))}>
          <Icon name={primaryIcon(sys.primary.kind)} />
          <span class="grow">
            {sys.name} <span class="faint">{PRIMARY_NAME[sys.primary.kind]}</span>
            {isBeacon(s, sys) && <span class="chip boon" style={{ marginLeft: '6px' }} data-tip={BEACON_TIP}>collision star</span>}
            {swarmSeenAt(s, sys.id) && <span class="chip danger" style={{ marginLeft: '6px' }} data-tip={SWARM_TIP}>swarm</span>}
            <div class="faint" style={{ fontSize: '12.5px' }}>
              {formatDistance(ly)} from {from.name}
            </div>
          </span>
          {send && <SendButton s={s} f={send} sys={sys} />}
        </div>
      ))}
    </div>
  );
}

export function goToSystem(id: string) {
  selection.value = { kind: 'system', id };
  engine()?.select(id);
  pivotToSystem(id);
}

type WorldSort = 'hab' | 'near' | 'room' | 'name' | 'type' | 'echoes' | 'lattice' | 'coldminds';
/** The kinds of star in the order the Type sort lists them: the holes, the dead stars, the living, the starless. */
const TYPE_ORDER: PrimaryKind[] = ['smbh', 'black_hole', 'neutron_star', 'white_dwarf', 'black_dwarf', 'brown_dwarf', 'red_dwarf', 'blue_dwarf', 'collision_star', 'helium_star', 'helium_giant', 'dark_star', 'rogue', 'void'];
const typeRank = (sys: StarSystem) => {
  const i = TYPE_ORDER.indexOf(sys.primary.kind);
  return i < 0 ? TYPE_ORDER.length : i;
};
/** Sorts that rank by what one kind of mind needs (see sites.ts). */
const MIND_SORT: Partial<Record<WorldSort, ThreadId>> = { echoes: 'echoes', lattice: 'lattice', coldminds: 'coldminds' };

/** Every charted world, best places to live first: what a settler would find there. */
function WorldsList({ s, send }: { s: GameState; send?: Fleet }) {
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
      return { b, sys, hab: habitabilityOf(s, b) * b.vitality, room: b.kind === 'gas_giant' ? 0 : naturalKinRoom(b, s), c, ly: distLy(home, sys), finds: b.traits.filter((t) => TRAIT_NAME[t] && ANOMALY_IDS.has(t)), v: mind ? siteValue(s, b, mind) : null, sites: bySystem ? {} : worldSites(s, b) };
    })
    .filter((r) => !findsOnly || r.finds.length > 0)
    .sort((x, y) => (sort === 'type' ? typeRank(x.sys) - typeRank(y.sys) : Number(isBeacon(s, y.sys)) - Number(isBeacon(s, x.sys)) || (x.v && y.v ? y.v.score - x.v.score : sort === 'hab' ? y.hab - x.hab : sort === 'room' ? y.room - x.room : sort === 'near' ? x.ly - y.ly : x.b.name.localeCompare(y.b.name))) || x.ly - y.ly);
  // the same worlds, one line per star: its best world, its total room, what was found there
  type StarRow = { sys: StarSystem; ly: number; worlds: number; best: (typeof rows)[number] | null; room: number; living: number; settled: boolean; finds: string[]; sites: Sites };
  const withWorlds = [...new Set(rows.map((r) => r.sys.id))].map((id): StarRow => {
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
      sites: bySystem ? starSites(s, rs[0].sys) : {},
    };
  });
  // and the surveyed stars with no worlds, only their Deep (most black holes, the Heart)
  const listed = new Set(withWorlds.map((x) => x.sys.id));
  const worldless = (x: StarSystem) => !x.bodies.some((id) => !!s.bodies[id] && !s.bodies[id].dissolved && s.bodies[id].kind !== 'deep');
  const deepOnly = bySystem && !findsOnly
    ? Object.values(s.systems)
        .filter((x) => s.civ.known[x.id] === 2 && !x.gone && !listed.has(x.id) && worldless(x) && (!open || !x.bodies.some((id) => s.bodies[id]?.colonyId)))
        .map((x): StarRow => ({ sys: x, ly: distLy(home, x), worlds: 0, best: null, room: 0, living: 0, settled: x.bodies.some((id) => !!s.bodies[id]?.colonyId), finds: [], sites: starSites(s, x) }))
    : [];
  const mindOf = MIND_SORT[sort];
  const score = (x: StarRow) => x.best?.v?.score ?? (mindOf ? (x.sites[mindOf as Need]?.v.score ?? -1e9) : -1e9);
  const systems = [...withWorlds, ...deepOnly].sort(
    (x, y) =>
      (sort === 'type'
        ? typeRank(x.sys) - typeRank(y.sys)
        : Number(isBeacon(s, y.sys)) - Number(isBeacon(s, x.sys)) ||
          (mindOf ? score(y) - score(x) : sort === 'hab' ? (y.best?.hab ?? -1) - (x.best?.hab ?? -1) : sort === 'room' ? y.room - x.room : sort === 'near' ? x.ly - y.ly : x.sys.name.localeCompare(y.sys.name))) || x.ly - y.ly,
  );
  // the measure the list is sorted by, marked in every row's strip (the distance when nearest first)
  const marked: Need | null = sort === 'hab' || sort === 'room' ? 'kin' : (MIND_SORT[sort] as Need | undefined) ?? null;
  const best = bestOf(bySystem ? systems.map((x) => x.sites) : rows.map((r) => r.sites));
  const dist = (ly: number) => <span class={`mark${sort === 'near' ? ' sorted' : ''}`}>{formatDistance(ly)}</span>;
  const sorts: [WorldSort, string, string][] = [
    ['hab', 'Habitable', 'Best for Kin: habitability × vitality'],
    ['room', 'Room', 'Most room for Kin without domes'],
    ['echoes', 'Power', 'Best for Echoes and the Chorus: the energy a settlement there could collect each turn at the Tide'],
    ['lattice', 'Matter', 'Best for the Lattice: the matter its mines, skimmers and lifters could raise each turn at the Tide'],
    ['coldminds', 'Lasting', 'Best for Coldminds: the worlds that will last longest before falling into their dead stars'],
    ['type', 'Type', 'By the kind of star: black holes, neutron stars, white and brown dwarfs, then the rest, nearest first within each'],
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
      {(bySystem ? systems.length : rows.length) === 0 && <p class="dim">{findsOnly ? 'No discoveries among these worlds yet. Surveys turn one up now and then.' : 'No worlds charted yet. Send a ship to survey a star.'}</p>}
      {bySystem ? (
        <div class="list">
          {systems.map(({ sys, ly, worlds, best: top, room, living, settled, finds, sites }) => (
            <div key={sys.id} class="list-item world-row" style={{ flexWrap: 'wrap' }} {...pressable(() => goToSystem(sys.id))}>
              <span class="grow">
                {sys.name} <span class="faint">{PRIMARY_NAME[sys.primary.kind]}</span>
                {isBeacon(s, sys) && <span class="chip boon" style={{ marginLeft: '6px' }} data-tip={BEACON_TIP}>collision star</span>}
                {settled && <span class="chip neon" style={{ marginLeft: '6px' }}>settled</span>}
                {finds.map((t) => (
                  <span key={t} class="chip" style={{ marginLeft: '6px' }} data-tip={TRAIT_NAME[t][1]}>{TRAIT_NAME[t][0]}</span>
                ))}
                <div class="faint" style={{ fontSize: '12.5px' }}>
                  {top ? (
                    <>
                      {worlds} world{worlds === 1 ? '' : 's'}
                      {living ? ` · ${living} living` : ''} · best: {top.b.name} · <span data-tip="Room for Kin across all its worlds, without domes or warrens">{room > 0 ? `${room} Kin room in all` : 'domes only'}</span>
                    </>
                  ) : (
                    <span data-tip="No worlds left, or none to begin with: only the habitats of its Deep">no worlds, only its Deep</span>
                  )}{' '}
                  · {dist(ly)}
                </div>
              </span>
              {send && <SendButton s={s} f={send} sys={sys} />}
              <SiteStrip s={s} sites={sites} best={best} active={marked} />
            </div>
          ))}
        </div>
      ) : (
        <div class="list">
          {rows.map(({ b, sys, c, ly, finds, sites }) => (
            <div key={b.id} class="list-item world-row" style={{ flexWrap: 'wrap' }} {...pressable(() => goToBody(b))}>
              <span class="grow">
                {b.name} <span class="faint">{bodyKindName(s, b)}</span>
                {isBeacon(s, sys) && <span class="chip boon" style={{ marginLeft: '6px' }} data-tip={BEACON_TIP}>collision star</span>}
                {b.colonyId && <span class="chip neon" style={{ marginLeft: '6px' }}>settled</span>}
                {finds.map((t) => (
                  <span key={t} class="chip" style={{ marginLeft: '6px' }} data-tip={TRAIT_NAME[t][1]}>{TRAIT_NAME[t][0]}</span>
                ))}
                <div class="faint" style={{ fontSize: '12.5px' }}>
                  {sys.name}
                  {sort === 'type' ? ` (${PRIMARY_NAME[sys.primary.kind]})` : ''} · {dist(ly)}
                  {c ? ` · ${c.day !== undefined && kelvin(c.night!) !== kelvin(c.day) ? `${kelvin(c.night!)} to ${kelvin(c.day)}` : kelvin(c.mean)}` : ''}
                  {b.water !== undefined && b.kind !== 'gas_giant' ? ` · ${Math.round(b.water * 100)}% water` : ''}
                </div>
              </span>
              {send && <SendButton s={s} f={send} sys={sys} />}
              <SiteStrip s={s} sites={sites} best={best} active={marked} one />
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
function BeaconsList({ s, send }: { s: GameState; send?: Fleet }) {
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
        <p class="dim" style={{ fontSize: '13.5px', margin: '0 0 6px' }}>
          Small red stars lit by colliding brown dwarfs: in this age nothing else nearby shines like them, and none lasts. The longest-burning first.
        </p>
      )}
      <div class="list">
        {burning.map(({ sys, left, turns, light, ly }) => {
          const known = s.civ.known[sys.id] ?? 0;
          const worlds = worldsOf(sys);
          const v = others(sys);
          return (
            <div key={sys.id} class="list-item world-row" {...pressable(() => goToSystem(sys.id))}>
              <span class="grow">
                <span class="boon">✦</span> {sys.name} <span class="faint">{s.provinces.find((p) => p.id === sys.provinceId)?.name ?? ''}</span>
                {kept?.systemId === sys.id && (
                  <span class="chip neon" style={chipGap} data-tip={`We are keeping time with it: turn ${kept.turn} of ${kept.of}, each a sixth of what was left of its life, whatever the pace.`}>
                    keeping time
                  </span>
                )}
                {kept?.nextId === sys.id && (
                  <span class="chip neon" style={chipGap} data-tip={`When the clock of ${kept.system} runs out, in ${kept.left} turn${kept.left === 1 ? '' : 's'}, we keep time with this one: six turns.`}>
                    next
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
                <div class="faint" style={{ fontSize: '12.5px' }}>
                  {known === 2 ? `${worlds} world${worlds === 1 ? '' : 's'}` : 'worlds not charted'} · {formatDistance(ly)} · {formatYears(left)} of light left
                </div>
              </span>
              <span class="mono" style={{ fontSize: '13.5px', textAlign: 'right', minWidth: '84px' }}>
                <span class="good" data-tip="How much a light collector here gathers this turn compared with its rating.">×{light < 1 ? light.toFixed(2) : n1(light)} light</span>
                <div
                  class={turns <= 1 ? 'warn' : 'faint'}
                  style={{ fontSize: '12.5px' }}
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
              {send && <SendButton s={s} f={send} sys={sys} />}
            </div>
          );
        })}
      </div>
      {out.length > 0 && (
        <div class="section" style={{ marginTop: '10px' }}>
          <h3>
            Already out <span class="faint" style={{ letterSpacing: 0, textTransform: 'none', fontFamily: 'var(--f-ui)', fontWeight: 400 }}>· lit and went out within the last turn</span>
          </h3>
          <p class="dim" style={{ fontSize: '13.5px', margin: '0 0 6px' }}>
            The last turn spanned {formatYears(s.turnLength)}, longer than {out.length === 1 ? 'this star' : 'these stars'} burned. Their light is gone; at the end of this turn each settles into {s.years >= DWARF_COLD_AT ? 'a black dwarf: this late in the age a turn outlasts its cooling' : 'a white dwarf'}.
          </p>
          <div class="list">
            {out.map(({ sys, life, ly }) => (
              <div key={sys.id} class="list-item world-row" {...pressable(() => goToSystem(sys.id))}>
                <span class="grow faint">
                  {sys.name} <span>{s.provinces.find((p) => p.id === sys.provinceId)?.name ?? ''}</span>
                  <div style={{ fontSize: '12.5px' }}>
                    {life > 0 ? `burned for ${formatYears(life)} · ` : ''}{formatDistance(ly)}
                  </div>
                </span>
                <span class="mono faint" style={{ fontSize: '12.5px' }}>out</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
