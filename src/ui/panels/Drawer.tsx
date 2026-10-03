import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { SHIP_BY_ID, fleetLook } from '../../game/data/ships';
import { STRUCTURE_BY_ID, STRUCTURE_KINDS, structureKind, structureLabel, type StructureKind } from '../../game/data/structures';
import { EVENT_BY_ID } from '../../game/data/events';
import { THREAD_DEFS } from '../../game/data/threads';
import { formatDistance, formatYears } from '../../game/eras';
import { FROZEN_K, bodyClimate, insolation, lampsOver, primaryTemperature, sourceLight, sunGone, turnsToFreeze, waterState } from '../../game/physics';
import {
  absorb,
  buildableShips,
  buildableStructures,
  buildCost,
  convert,
  disbandFleet,
  moveQueued,
  orderFleet,
  setAutoExplore,
  standFleet,
  placeBeacon,
  queueBuild,
  raid,
  removeQueued,
  rushBuild,
  rushCost,
  setFocus,
  tame,
  toggleOverdrive,
  type Conversion,
} from '../../game/sim/actions';
import { capacity } from '../../game/sim/economy';
import { canSettle, launchCost } from '../../game/sim/fleets';
import { TRIP_TIP, tripLabel } from '../trip';
import { computeMods } from '../../game/sim/mods';
import { project, structureEffect, type BuildEffect } from '../../game/sim/projection';
import { capital, distLy, hasCharter, hasTech, nearestSwarmSeen, popsOf, swarmSeenAt } from '../../game/sim/util';
import { swarmReach } from '../../game/sim/hunger';
import type { Body, Colony, Fleet, GameState, StarSystem, Swarm, ThreadId } from '../../game/types';
import { THREADS } from '../../game/types';
import { n0, n1, pct, signed } from '../fmt';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { FOCUS, PRIMARY_NAME, TRAIT_NAME, WAY_NAME, wayArt, bodyIcon, primaryIcon, bodyKindName, bodyKindNote, deepNote, isBeacon, BEACON_TIP, SWARM_TIP } from '../labels';
import { act, engine, following, notify, rev, selection, targeting, view } from '../store';
import { RAID_COOLDOWN, raidStrength, raidTarget } from '../../game/sim/survivors';
import { pickOnMap, pivotToSystem } from '../screens/Lists';
import { loreView } from '../screens/Story';
import { siteValue, type SiteValue } from '../../game/sim/sites';
import { residentsOf, survivorPeople, survivorWorld } from '../../game/sim/homes';
import { EXPLORE_RESERVE, FORTIFY_BONUS, LIVING_WORLD, isWarFleet, naturalKinRoom } from '../../game/sim/fleets';
import { sfx } from '../../audio/sfx';

export function Drawer({ s }: { s: GameState }) {
  void rev.value;
  const ref = useRef<HTMLElement>(null);
  // On a phone the panel covers the lower half of the screen: slide the view up so what is
  // selected stays visible (and can be tapped again) between the top bar and the panel.
  useLayoutEffect(() => {
    const place = () => {
      const eng = engine();
      const el = ref.current;
      if (!eng) return;
      if (!el || window.innerWidth > 760) return eng.setFocusY(null);
      const top = (document.querySelector('.resources') as HTMLElement | null)?.getBoundingClientRect().bottom ?? 0;
      const bottom = el.getBoundingClientRect().top;
      eng.setFocusY(bottom - top > 80 ? (top + bottom) / 2 : null);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  });
  useEffect(() => () => engine()?.setFocusY(null), []);
  const sel = selection.value;
  if (!sel) return null;
  let body: preact.JSX.Element | null = null;
  if (sel.kind === 'system' && s.systems[sel.id]) body = <SystemPanel s={s} sys={s.systems[sel.id]} />;
  else if (sel.kind === 'body' && s.bodies[sel.id]) {
    const b = s.bodies[sel.id];
    body = b.colonyId && s.colonies[b.colonyId] ? <ColonyPanel s={s} c={s.colonies[b.colonyId]} /> : <BodyPanel s={s} b={b} />;
  } else if (sel.kind === 'fleet' && s.fleets[sel.id]) body = <FleetPanel s={s} f={s.fleets[sel.id]} />;
  else if (sel.kind === 'swarm' && s.swarms[sel.id]) body = <SwarmPanel s={s} sw={s.swarms[sel.id]} />;
  if (!body) return null;
  return (
    <aside ref={ref} class="drawer panel" aria-label="Selection">
      <button class="btn ghost small drawer-close" aria-label="Close" onClick={() => { selection.value = null; engine()?.select(null); }}>
        <Icon name="close" />
      </button>
      {body}
    </aside>
  );
}

function selectBody(b: Body) {
  sfx('select');
  selection.value = { kind: 'body', id: b.id };
  if (view.value === 'galaxy') {
    // step inside and bring the planet to the middle of the screen
    view.value = 'system';
    engine()?.showSystem(b.systemId, b.id);
  } else engine()?.select(`body:${b.id}`);
}

function selectSystem(id: string) {
  sfx('select');
  selection.value = { kind: 'system', id };
  engine()?.select(id);
}

function enterSystem(id: string) {
  view.value = 'system';
  engine()?.showSystem(id);
}

function distFromCapital(s: GameState, sys: StarSystem): number {
  const c = capital(s);
  const from = c ? s.systems[c.systemId] : s.systems[s.civ.homeSystemId];
  return from ? distLy(from, sys) : 0;
}

/** A world's name inside its system: "III", "Deep". */
function shortWorldName(b: Body, sys: StarSystem): string {
  return b.name.startsWith(`${sys.name} `) ? b.name.slice(sys.name.length + 1) : b.name;
}

/** Every world of the system, one tap away, with the one shown marked. */
function WorldStrip({ s, sys, current }: { s: GameState; sys: StarSystem; current: string }) {
  if (s.civ.known[sys.id] !== 2) return null;
  const worlds = sys.bodies.map((id) => s.bodies[id]).filter((b) => b && !b.dissolved);
  if (worlds.length < 2) return null;
  return (
    <nav class="world-strip" aria-label={`Worlds of ${sys.name}`}>
      <button class="ws-item ws-sys" onClick={() => selectSystem(sys.id)} data-tip={`${sys.name}: the whole system`}>
        <Icon name={primaryIcon(sys.primary.kind)} />
      </button>
      {worlds.map((b) => {
        const c = b.colonyId ? s.colonies[b.colonyId] : null;
        const hab = b.habitability * b.vitality;
        return (
          <button
            key={b.id}
            class={`ws-item${b.id === current ? ' on' : ''}${c ? ' ours' : hab >= LIVING_WORLD ? ' living' : ''}`}
            aria-current={b.id === current ? 'true' : undefined}
            onClick={() => b.id !== current && selectBody(b)}
            data-tip={`${c ? `${c.name} (our settlement)` : b.name} · ${bodyKindName(s, b)}${b.kind !== 'deep' ? ` · ${pct(hab)} habitable` : ''}`}
          >
            <Icon name={bodyIcon(b.kind)} />
            <span>{shortWorldName(b, sys)}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ------------------------------------------------------------------ system

function SystemPanel({ s, sys }: { s: GameState; sys: StarSystem }) {
  void rev.value; // mutable game state: re-render on every change
  const known = s.civ.known[sys.id] ?? 0;
  const p = project(s);
  const src = sourceLight(s, sys, s.years, p.turnYears);
  const T = primaryTemperature(sys.primary, s.years, s.era);
  const province = s.provinces.find((x) => x.id === sys.provinceId);
  const fleets = Object.values(s.fleets).filter((f) => f.at === sys.id);
  const swarms = Object.values(s.swarms).filter((w) => w.systemId === sys.id);
  const survivor = Object.values(s.survivors).find((v) => v.alive && v.systems.includes(sys.id));
  const survivorHome = survivor && known === 2 ? survivorWorld(s, survivor, sys.id) : null;
  const fc = s.forecasts.filter((f) => f.systemId === sys.id);
  const d = distFromCapital(s, sys);
  return (
    <>
      <div class="drawer-head">
        <div class="eyebrow">{province?.name ?? 'The Coalescence'}{sys.ejected ? ' · cast out into the void' : ''}</div>
        <h2>{sys.name}</h2>
        <div class="row wrap" style={{ marginTop: '6px' }}>
          <span class="chip"><Icon name={primaryIcon(sys.primary.kind)} /> {PRIMARY_NAME[sys.primary.kind]}</span>
          {known < 2 && <span class="chip warn">{known === 1 ? 'not surveyed' : 'unknown'}</span>}
          {(sys.rust ?? 0) > 0.05 && <span class="chip danger" data-tip={rustTip(s, sys)}>rust {pct(sys.rust ?? 0)}</span>}
          {sys.beacon && <span class="chip neon">decoy beacon</span>}
          {sys.gone && <span class="chip danger">gone</span>}
        </div>
        {view.value === 'galaxy' && known > 0 && !sys.gone && (
          <button class="btn small primary enter-system" onClick={() => enterSystem(sys.id)} data-tip="Or double-click the star, tap it again, or zoom in on it.">
            <Icon name="system" /> Look inside
          </button>
        )}
      </div>
      <div class="drawer-body scroll">
        {known === 2 && (
          <div class="section" style={{ marginTop: 0 }}>
            <h3>
              Worlds <span class="faint" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>· click one to look at it</span>
            </h3>
            <div class="list">
              {sys.bodies
                .map((id) => s.bodies[id])
                .filter((b) => b && !b.dissolved)
                .map((b) => {
                  const c = b.colonyId ? s.colonies[b.colonyId] : null;
                  const hab = b.habitability * b.vitality;
                  return (
                    <div key={b.id} class="list-item" role="button" tabIndex={0} onClick={() => selectBody(b)} onKeyDown={(e) => e.key === 'Enter' && selectBody(b)}>
                      <Icon name={bodyIcon(b.kind)} cls={c ? 'neon' : hab >= LIVING_WORLD ? 'boon' : ''} />
                      <span class="grow">
                        {c ? c.name : b.name} <span class="faint" style={{ fontSize: '11px' }}>{bodyKindName(s, b)}</span>
                      </span>
                      {b.relic && b.relic.state !== 'hidden' && <Icon name="relic" cls="accent" />}
                      {survivor && survivorHome?.id === b.id && (
                        <span data-tip={`${survivor.contact ? survivor.name : 'Someone'} live${survivor.contact ? '' : 's'} here`} style={{ width: '9px', height: '9px', background: survivor.color, display: 'inline-block' }} />
                      )}
                      {b.rogue && <span class="chip warn">rogue</span>}
                      {b.feeding && <span class="chip boon">feeding</span>}
                      {c ? (
                        <span class="mono neon" style={{ fontSize: '12px' }} data-tip="People living here">{popsOf(c)}</span>
                      ) : b.kind !== 'deep' ? (
                        <span class={`mono ${hab >= LIVING_WORLD ? 'boon' : 'faint'}`} style={{ fontSize: '11px' }} data-tip="Habitable: habitability × vitality">{pct(hab)}</span>
                      ) : null}
                      <Icon name="arrow_right" cls="faint" />
                    </div>
                  );
                })}
            </div>
          </div>
        )}
        <p class="flavor" style={{ margin: '8px 0' }}>{src.label}.</p>
        <dl class="kv">
          <dt>Light for collectors</dt>
          <dd class="mono" data-tip="How much a light collector here gathers compared with its rating.">{src.light > 0 ? `×${n1(src.light)}` : 'none'}</dd>
          {T > 0 && (
            <>
              <dt>Surface</dt>
              <dd class="mono">{n0(T)} K</dd>
            </>
          )}
          <dt>Mass</dt>
          <dd class="mono">{sys.primary.mass >= 1000 ? sys.primary.mass.toExponential(1) : n1(sys.primary.mass)} M☉</dd>
          {sys.primary.spinMax > 0 && (
            <>
              <dt>Spin reservoir</dt>
              <dd class="mono">{pct(sys.primary.spin / sys.primary.spinMax)}</dd>
            </>
          )}
          {src.alive && (
            <>
              <dt>{src.alive[1] > s.years ? 'Burns until' : 'Burnt out at'}</dt>
              <dd class="mono">{formatYears(src.alive[1])}</dd>
            </>
          )}
          <dt>Distance</dt>
          <dd class="mono">{d > 0 ? formatDistance(d) : 'here'}</dd>
        </dl>
        {fc.length > 0 && (
          <div class="section">
            <h3>Forecast</h3>
            {fc.map((f) => (
              <div key={f.uid} class={`row ${f.severity === 'danger' ? 'bad' : f.severity === 'boon' ? 'boon' : 'warn'}`} style={{ fontSize: '12px', alignItems: 'flex-start' }} data-tip={f.text}>
                <Icon name="warning" /> <span class="grow">{f.title}</span>
                <span class="mono faint">{isFinite(f.dueYears) ? formatYears(f.dueYears - s.years) : ''}</span>
              </div>
            ))}
          </div>
        )}
        {survivor && (
          <div class="section">
            <h3>Others</h3>
            {survivor.contact && <div class="drawer-plate" style={{ backgroundImage: `url(art/${wayArt(survivor.way)}.webp)` }} role="img" aria-label={`${survivor.name}: ${WAY_NAME[survivor.way] ?? ''}`} />}
            <div
              class={`row ${survivorHome ? 'list-item' : ''}`}
              style={{ fontSize: '13px' }}
              role={survivorHome ? 'button' : undefined}
              onClick={() => survivorHome && selectBody(survivorHome)}
              data-tip={survivorHome ? `They live ${survivorHome.kind === 'deep' ? 'in orbital habitats in the Deep' : `on ${survivorHome.name}`}. Click to look at it.` : ''}
            >
              <span style={{ width: '10px', height: '10px', background: survivor.color, display: 'inline-block' }} />
              <span class="grow">
                {survivor.name}
                {survivorHome && <span class="faint" style={{ fontSize: '11px' }}> · {survivorHome.kind === 'deep' ? 'in the Deep' : `on ${survivorHome.name}`}</span>}
              </span>
              <span class="faint">{survivor.contact ? survivorPeople(survivor) : 'not contacted'}</span>
            </div>
          </div>
        )}
        {known === 1 && (
          <p class="dim" style={{ fontSize: '12px' }}>
            Seen from afar: the star is known, its worlds are not. Send any ship to survey it (probes are the cheapest, and see farthest).
          </p>
        )}
        {(fleets.length > 0 || swarms.length > 0) && (
          <div class="section">
            <h3>In orbit</h3>
            <div class="list">
              {fleets.map((f) => (
                <div key={f.id} class="list-item" onClick={() => { selection.value = { kind: 'fleet', id: f.id }; engine()?.select(f.id); }}>
                  <Icon name="fleet" cls="neon" /> <span class="grow">{f.name}</span> <span class="faint">{f.ships.length} ship{f.ships.length > 1 ? 's' : ''}</span>
                </div>
              ))}
              {swarms.map((w) => (
                <div key={w.id} class="list-item" onClick={() => { selection.value = { kind: 'swarm', id: w.id }; engine()?.select(w.id); }}>
                  <Icon name="warning" cls={w.tamed ? 'neon' : 'bad'} /> <span class="grow">{w.tamed ? 'Tamed swarm' : 'Hunger swarm'}</span> <span class="mono faint">size {n1(w.size)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function kelvin(k: number): string {
  const c = k - 273.15;
  return c > -120 && c < 200 ? `${n0(k)} K (${c > 0 ? '+' : ''}${n0(c)} °C)` : `${n0(k)} K`;
}

/** The four needs a place can meet, in the order of the settle sorts: livable, power, matter, lasting. */
const NEEDS: { thread: ThreadId; icon: IconName; what: string }[] = [
  { thread: 'kin', icon: 'kin', what: 'Kin: livable ground and room without domes' },
  { thread: 'echoes', icon: 'echoes', what: 'Echoes and the Chorus: power' },
  { thread: 'lattice', icon: 'lattice', what: 'The Lattice: matter' },
  { thread: 'coldminds', icon: 'coldminds', what: 'Coldminds: time before the world falls into its star' },
];

type StarSites = Partial<Record<ThreadId, { b: Body; v: SiteValue }>>;

/** A charted star's best world for each kind of settler (none where they cannot settle). */
function starSites(s: GameState, sys: StarSystem): StarSites {
  const out: StarSites = {};
  for (const n of NEEDS) {
    for (const id of sys.bodies) {
      const b = s.bodies[id];
      if (!b || canSettle(s, b, n.thread)) continue;
      const v = siteValue(s, b, n.thread);
      if (!out[n.thread] || v.score > out[n.thread]!.v.score) out[n.thread] = { b, v };
    }
  }
  return out;
}

/** How suitable a charted star is for each kind of settler: one short figure per need. */
function SiteStrip({ s, sites, best, mine }: { s: GameState; sites: StarSites; best: Partial<Record<ThreadId, number>>; mine: ThreadId | null }) {
  return (
    <div class="row wrap" style={{ gap: '10px', fontSize: '11px', marginTop: '1px', flexBasis: '100%', paddingLeft: '24px' }}>
      {NEEDS.map((n) => {
        const x = sites[n.thread];
        const own = mine === n.thread || (mine === 'chorus' && n.thread === 'echoes');
        if (!x) {
          return (
            <span key={n.thread} class="faint" style={{ opacity: own ? 1 : 0.8 }} data-tip={`${n.what}. Nowhere here they could settle.`}>
              <Icon name={n.icon} /> none
            </span>
          );
        }
        const label = x.v.label;
        const dying = /freezing|cooling/.test(label);
        const short =
          n.thread === 'kin'
            ? dying ? (/cooling/.test(label) ? 'cooling' : 'freezing') : /room/.test(label) ? `${label.match(/(\d+) room/)?.[1] ?? ''} room` : 'domes'
            : n.thread === 'coldminds'
              ? label.replace(/^lasts /, '').replace(/ years?$/, '').replace('never falls in', '∞')
              : (label.match(/[\d,.]+/)?.[0] ?? label);
        // the best of the stars listed here, for this need (for Kin: room to live without domes)
        const top = n.thread === 'kin' ? !dying && /room/.test(label) : (best[n.thread] ?? 0) > 0 && x.v.score >= 0.75 * best[n.thread]!;
        return (
          <span key={n.thread} class={`mono ${dying ? 'warn' : top ? 'good' : 'faint'}`} style={own ? { fontWeight: 600 } : undefined} data-tip={`${n.what}. The best place here: ${x.b.name} (${bodyKindName(s, x.b)}), ${label}.\n${x.v.tip}`}>
            <Icon name={n.icon} /> {short}
          </span>
        );
      })}
    </div>
  );
}

/** Turn the view to a world (inside its system) without changing what is selected. */
function lookAtWorld(systemId: string, bodyId: string) {
  sfx('select');
  view.value = 'system';
  engine()?.showSystem(systemId, bodyId);
}

/** A warning on a place we might send people: a swarm feeding there, or one within its reach. */
function SwarmNear({ s, systemId }: { s: GameState; systemId: string }) {
  const near = nearestSwarmSeen(s, systemId);
  const reach = swarmReach(s);
  // (after the Dusk a swarm's reach is the whole galaxy; only the ones near enough to care matter)
  if (!near || near.ly > Math.min(reach, 90)) return null;
  if (near.ly < 0.5 && near.at?.id === systemId) {
    return (
      <span class="chip danger" style={{ marginLeft: '6px' }} data-tip="A swarm is feeding at this star. It goes for settlements here every turn until they drive it off, and for ships that stop here: a new settlement needs defences from the start.">
        swarm here
      </span>
    );
  }
  const where = near.at ? `at ${near.at.name}` : 'on its way between stars';
  return (
    <span class={`chip ${near.ly <= 25 ? 'danger' : 'warn'}`} style={{ marginLeft: '6px' }} data-tip={`The nearest swarm we can see is ${formatDistance(near.ly)} away, ${where}: within its reach (a swarm looks up to ${formatDistance(reach)} away for its next meal). Swarms go for warmth and matter, the nearer the likelier, so a new settlement here may draw it.`}>
      swarm {formatDistance(near.ly)}
    </span>
  );
}

/** What a star's rust means, and whether the Hunger is still at it. */
function rustTip(s: GameState, sys: StarSystem): string {
  const feeding = Object.values(s.swarms).some((w) => w.systemId === sys.id && w.awake && !w.tamed);
  return `The Hunger's rust: how much a swarm has fed here. It builds while one eats (4% a turn, more for a bigger swarm) and never fades. The rust itself does no harm; the harm is what was eaten, the worlds' mineral richness and hydrogen, which never grow back. ${feeding ? 'A swarm is feeding here now.' : 'No swarm is feeding here now.'}`;
}

/** A living world without a sun: cooling as its dead star fades, or freezing, and how long it has. */
function FreezingRow({ s, b, c }: { s: GameState; b: Body; c?: Colony }) {
  const tip = `A living world whose star has died cools as the light fades. Once even its warmest ground is below ${FROZEN_K} K it freezes: 5% of its vitality a turn (half that with a Core Stimulator), and when none is left it is an ice world or bare rock. After the Last Light every living world freezes so, as does one cast out of its system. Orbital Lamps keep one warm and alive.`;
  const n = turnsToFreeze(s, b, c);
  if (isFinite(n)) {
    return (
      <>
        <dt data-tip={tip}>Freezing</dt>
        <dd class="mono bad" data-tip={tip}>{`dies in about ${n} turn${n === 1 ? '' : 's'}`}</dd>
      </>
    );
  }
  if (s.era !== 'dusk' || !sunGone(s, b) || lampsOver(s, b, c)) return null;
  return (
    <>
      <dt data-tip={tip}>Cooling</dt>
      <dd class="warn" data-tip={tip}>its star is dead</dd>
    </>
  );
}

/** Temperature and water rows for a world's key/value list. */
function ClimateRows({ s, b }: { s: GameState; b: Body }) {
  if (b.kind === 'deep' || b.kind === 'gas_giant' || b.kind === 'ice_giant') return null;
  const c = bodyClimate(s, b);
  const tip = 'From starlight, the world’s own heat and what is left of its air. Tidally locked worlds keep a hot day side and a cold night side.';
  return (
    <>
      <dt data-tip={tip}>Temperature</dt>
      <dd class="mono" data-tip={c.day !== undefined ? `Day side ${kelvin(c.day)}\nNight side ${kelvin(c.night!)}` : ''}>
        {c.day !== undefined && n0(c.day) !== n0(c.night!) ? `${n0(c.night!)}–${n0(c.day)} K` : kelvin(c.mean)}
      </dd>
      <dt>Water</dt>
      <dd style={{ fontSize: '12px' }}>{waterState(b, c)}</dd>
      <dt data-tip="Sunlight on the surface compared with the star's standard orbit, by the inverse-square law. Surface Solar Arrays collect this much of the star's light; orbital collectors catch it anywhere.">Sunlight</dt>
      <dd class="mono">{b.rogue ? 'none' : `×${n1(insolation(s, b))}`}</dd>
    </>
  );
}

// ------------------------------------------------------------------ uninhabited body

function BodyPanel({ s, b }: { s: GameState; b: Body }) {
  void rev.value; // mutable game state: re-render on every change
  const sys = s.systems[b.systemId];
  const surveyed = s.civ.known[sys.id] === 2;
  const settlers = Object.values(s.fleets).filter((f) => f.at && f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles && (!SHIP_BY_ID[x.cls]?.inSystem || f.at === b.systemId)));
  const residents = surveyed ? residentsOf(s, b) : null;
  return (
    <>
      <div class="drawer-head">
        <div class="eyebrow">
          <span style={{ cursor: 'pointer' }} onClick={() => selectSystem(sys.id)}>{sys.name}</span> · <span data-tip={bodyKindNote(s, b)}>{bodyKindName(s, b)}</span>
        </div>
        <h2>{b.name}</h2>
        {residents && (
          <div class="row" style={{ marginTop: '4px', fontSize: '13px', gap: '6px' }} data-tip={residents.contact ? `${residents.name}: ${WAY_NAME[residents.way] ?? ''}. Their world cannot be settled; it can only be taken, or left to them.` : 'Someone lives here. We have not made contact with them yet.'}>
            <span style={{ width: '10px', height: '10px', background: residents.color, display: 'inline-block' }} />
            <span>
              {residents.contact ? (
                <>
                  Home of <b>{residents.name}</b> <span class="faint">· {survivorPeople(residents)}{b.kind === 'deep' ? ', in orbital habitats' : ''}</span>
                </>
              ) : (
                'Someone lives here.'
              )}
            </span>
          </div>
        )}
        <div class="row wrap" style={{ marginTop: '6px' }}>
          {b.traits.map((t) =>
            EVENT_BY_ID[`anom_${t}`] ? (
              <button key={t} class="chip lore" data-tip={`${TRAIT_NAME[t]?.[1] ?? ''}\nClick to read the survey report again.`} onClick={() => { sfx('open'); loreView.value = { defId: `anom_${t}`, bodyId: b.id }; }}>
                <Icon name="relic" /> {TRAIT_NAME[t]?.[0] ?? t}
              </button>
            ) : (
              <span key={t} class="chip" data-tip={TRAIT_NAME[t]?.[1] ?? ''}>{TRAIT_NAME[t]?.[0] ?? t}</span>
            ),
          )}
          {b.rogue && <span class="chip warn" data-tip="Stripped from its star by a close stellar pass. Only its own heat is left.">rogue</span>}
          {b.feeding && <span class="chip boon" data-tip="Being torn apart by its dead star; the debris stream heats the star.">feeding its star</span>}
        </div>
        <WorldStrip s={s} sys={sys} current={b.id} />
      </div>
      <div class="drawer-body scroll">
        {surveyed && b.kind === 'deep' && <p class="flavor">{deepNote(s)}</p>}
        {!surveyed ? (
          <p class="flavor">Not yet surveyed. Send any ship to learn what is here.</p>
        ) : (
          <dl class="kv">
            <dt>Habitability</dt>
            <dd class="mono">{pct(b.habitability)}</dd>
            <dt>Vitality</dt>
            <dd class="mono">{pct(b.vitality)}</dd>
            <FreezingRow s={s} b={b} />
            {b.kind !== 'deep' && b.kind !== 'gas_giant' && (
              <>
                <dt data-tip="Kin the world holds by itself: about 12 × habitability × vitality, rounded down (a third of that on a rogue or feeding world). Below about 8% habitability × vitality there is no room, and Kin can live here only in domes, warrens or a Garden Ark.">Room for Kin</dt>
                <dd class={naturalKinRoom(b) > 0 ? 'mono good' : ''} style={naturalKinRoom(b) > 0 ? undefined : { fontSize: '12px' }}>
                  {naturalKinRoom(b) > 0 ? `${naturalKinRoom(b)} without domes` : 'none: domes needed'}
                </dd>
              </>
            )}
            <ClimateRows s={s} b={b} />
            <dt>Core heat</dt>
            <dd class="mono">{pct(b.coreHeat)}</dd>
            <dt>Mineral richness</dt>
            <dd class="mono">×{n1(b.richness)}</dd>
            {b.hydrogen > 0 && (
              <>
                <dt>Hydrogen</dt>
                <dd class="mono">×{n1(b.hydrogen)}</dd>
              </>
            )}
            <dt>Orbit</dt>
            <dd class="mono">{b.kind === 'deep' ? '—' : `${b.orbitAU < 0.1 ? b.orbitAU.toFixed(3) : n1(b.orbitAU)} AU`}</dd>
            <dt>Mass</dt>
            <dd class="mono">{b.massEarth >= 10 ? n0(b.massEarth) : n1(b.massEarth)} M⊕</dd>
            {b.inspiralAt && isFinite(b.inspiralAt) && (
              <>
                <dt data-tip="When gravitational-wave orbital decay brings it to its dead star's tidal limit.">Falls inward</dt>
                <dd class="mono">{formatYears(b.inspiralAt)}</dd>
              </>
            )}
            {b.relic && b.relic.state !== 'hidden' && (
              <>
                <dt>Ruins</dt>
                <dd>
                  {EVENT_BY_ID[`relic_${b.relic.kind}`]?.title ?? b.relic.kind} · {b.relic.state}{' '}
                  <button class="btn ghost small" style={{ marginLeft: '4px' }} data-tip="Read the survey report again, and what we chose." onClick={() => { sfx('open'); loreView.value = { defId: `relic_${b.relic!.kind}`, bodyId: b.id }; }}>
                    <Icon name="relic" /> Read again
                  </button>
                </dd>
              </>
            )}
          </dl>
        )}
        {surveyed && !b.colonyId && settlers.length > 0 && (
          <div class="section">
            <h3>Settle</h3>
            {settlers.map((f) => {
              const ship = f.ships.find((x) => SHIP_BY_ID[x.cls]?.settles)!;
              const def = SHIP_BY_ID[ship.cls];
              const err = canSettle(s, b, def.settles!.thread);
              const from = s.systems[f.at!];
              const ly = distLy(from, sys);
              const mods = computeMods(s);
              return (
                <div key={f.id} class="row" style={{ marginBottom: '4px' }}>
                  <span class="grow" style={{ fontSize: '12px' }}>
                    {def.name} at {from.name}
                    <div class="faint mono" style={{ fontSize: '11px' }}>{ly > 0 ? `${formatDistance(ly)} · ${tripLabel(s, ly, mods, true)} · ${n0(launchCost(s, f, ly, mods))} energy` : 'here'}</div>
                  </span>
                  <button class="btn small" disabled={!!err} data-tip={err ?? `Send ${def.settles!.pops} ${THREAD_DEFS[def.settles!.thread].name} to live here.`} onClick={() => act((g) => orderFleet(g, f.id, sys.id, 'colonize', b.id)) && sfx('good')}>
                    <Icon name="colonize" /> Settle
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ settlement

const CONVERSIONS: { id: Conversion; label: string; icon: 'upload' | 'merge' | 'coldminds' | 'cryo' | 'wake'; tip: string; show: (s: GameState, c: Colony) => boolean }[] = [
  { id: 'upload', label: 'Upload', icon: 'upload', tip: 'One Kin becomes an Echo (6 energy). Needs an Upload Clinic and free substrate.', show: (_s, c) => (c.structures.upload_clinic ?? 0) > 0 },
  { id: 'merge', label: 'Merge', icon: 'merge', tip: 'Two Echoes become one Chorus (8 energy). Needs a Confluence Node.', show: (_s, c) => (c.structures.confluence_node ?? 0) > 0 },
  { id: 'cool', label: 'Cool', icon: 'coldminds', tip: 'One Echo becomes a Coldmind, thinking far slower and costing almost nothing to keep. Needs a Cold Vault.', show: (_s, c) => (c.structures.cold_vault ?? 0) + (c.structures.lepton_substrate ?? 0) + (c.structures.bastion ?? 0) > 0 },
  { id: 'freeze', label: 'Freeze', icon: 'cryo', tip: 'Put one Kin into Cold Sleep. Sleepers cost almost nothing and do nothing.', show: (s, c) => capacity(s, c, computeMods(s)).cryo > 0 },
  { id: 'thaw', label: 'Thaw', icon: 'wake', tip: 'Wake one sleeper.', show: (_s, c) => c.cryo > 0 },
];

function ColonyPanel({ s, c }: { s: GameState; c: Colony }) {
  void rev.value; // mutable game state: re-render on every change
  const [tab, setTab] = useState<'overview' | 'build'>('overview');
  const b = s.bodies[c.bodyId];
  const sys = s.systems[c.systemId];
  const mods = computeMods(s);
  const capy = capacity(s, c, mods);
  const p = project(s);
  const t = p.perColony[c.id];
  const y = t?.y;
  const isCap = s.civ.capitalId === c.id;
  const eNet = y ? y.energy - y.energyUpkeep : 0;
  const lineTip = (key: 'energy' | 'matter' | 'industry' | 'insight' | 'accord') =>
    (y?.lines ?? [])
      .filter((l) => (l[key] ?? 0) !== 0)
      .map((l) => `${l.label}: ${signed(l[key] ?? 0)}`)
      .join('\n') || 'Nothing yet.';
  return (
    <>
      <div class="drawer-head">
        <div class="eyebrow">
          <span style={{ cursor: 'pointer' }} onClick={() => selectSystem(sys.id)}>{sys.name}</span> · <span data-tip={bodyKindNote(s, b)}>{bodyKindName(s, b)}</span>
        </div>
        <h2>{c.name}</h2>
        <div class="row wrap" style={{ marginTop: '6px' }}>
          {isCap && <span class="chip neon">capital</span>}
          {b.traits.map((tr) => (
            <span key={tr} class="chip" data-tip={TRAIT_NAME[tr]?.[1] ?? ''}>{TRAIT_NAME[tr]?.[0] ?? tr}</span>
          ))}
          {c.starving > 0 && <span class="chip danger">starving</span>}
          {c.overdrive && <span class="chip warn">overdrive</span>}
          {b.rogue && <span class="chip warn">rogue</span>}
        </div>
        <WorldStrip s={s} sys={sys} current={b.id} />
        <div class="row" style={{ marginTop: '8px', gap: '4px' }}>
          <button class={`btn small ${tab === 'overview' ? 'primary' : ''}`} onClick={() => setTab('overview')}>Overview</button>
          <button class={`btn small ${tab === 'build' ? 'primary' : ''}`} onClick={() => setTab('build')}>
            Build {c.queue.length ? `(${c.queue.length})` : ''}
          </button>
        </div>
      </div>
      <div class="drawer-body scroll">
        {tab === 'overview' ? (
          <>
            {y && (
              <>
              <div class="eyebrow yields-head">This settlement, each turn</div>
              <div class="yields">
                <div data-tip={`Energy: captured minus upkeep\n${lineTip('energy')}\nUpkeep −${n1(y.energyUpkeep)}`}>
                  <span class="yv"><Icon name="energy" cls="accent" /> <span class={`mono ${eNet >= 0 ? 'good' : 'bad'}`}>{signed(eNet)}</span></span>
                  <span class="yl">Energy</span>
                </div>
                <div data-tip={`Matter: mined minus used\n${lineTip('matter')}${y.matterUpkeep ? `\nUsed −${n1(y.matterUpkeep)}` : ''}`}>
                  <span class="yv"><Icon name="matter" /> <span class="mono">{signed(y.matter - y.matterUpkeep)}</span></span>
                  <span class="yl">Matter</span>
                </div>
                <div data-tip={`Industry: builds this settlement's queue\n${lineTip('industry')}`}>
                  <span class="yv"><Icon name="industry" /> <span class="mono">{n1(y.industry)}</span></span>
                  <span class="yl">Industry</span>
                </div>
                <div data-tip={`Insight: drives research\n${lineTip('insight')}`}>
                  <span class="yv"><Icon name="insight" /> <span class="mono">{n1(y.insight)}</span></span>
                  <span class="yl">Insight</span>
                </div>
                <div data-tip={`Accord: buys Charters\n${lineTip('accord')}`}>
                  <span class="yv"><Icon name="accord" /> <span class="mono">{signed(y.accord)}</span></span>
                  <span class="yl">Accord</span>
                </div>
              </div>
              </>
            )}
            <div class="section">
              <h3>People</h3>
              {THREADS.filter((th) => c.pops[th] > 0 || capy[th] > 0).map((th) => {
                const st = t?.strain[th];
                const strainTxt = st && st.m !== 0 ? (st.m > 0 ? `living too fast for the age by ${n1(st.m)} orders: upkeep ×${n1(st.upkeepMul)}` : `too slow for this pace by ${n1(-st.m)} orders: output ×${n1(st.outMul)}`) : '';
                return (
                  <div key={th} class="row pop-row" data-tip={`${THREAD_DEFS[th].name}: ${THREAD_DEFS[th].blurb}${strainTxt ? `\nTempo: ${strainTxt}` : ''}`}>
                    <Icon name={th} cls={c.pops[th] > capy[th] ? 'bad' : ''} />
                    <span class="grow">{THREAD_DEFS[th].name}</span>
                    {st && Math.abs(st.m) >= 0.5 && <span class={`chip ${st.m > 0 ? 'warn' : 'boon'}`}>{st.m > 0 ? 'strained' : 'idling'}</span>}
                    <span class={`mono ${c.pops[th] > capy[th] ? 'bad' : ''}`}>{c.pops[th]}<span class="faint">/{th === 'lattice' || capy[th] > 0 ? capy[th] : '—'}</span></span>
                  </div>
                );
              })}
              {(capy.cryo > 0 || c.cryo > 0) && (
                <div class="row pop-row" data-tip="Kin in Cold Sleep: nearly free to keep, and they do nothing.">
                  <Icon name="cryo" />
                  <span class="grow">Sleeping</span>
                  <span class="mono">{c.cryo}<span class="faint">/{capy.cryo}</span></span>
                </div>
              )}
              {capy.echoes > c.pops.echoes && <EchoHint s={s} c={c} />}
              <div class="row wrap" style={{ gap: '4px', marginTop: '6px' }}>
                {CONVERSIONS.filter((cv) => cv.show(s, c)).map((cv) => (
                  <button key={cv.id} class="btn small" data-tip={cv.tip} onClick={() => act((g) => convert(g, c.id, cv.id))}>
                    <Icon name={cv.icon} /> {cv.label}
                  </button>
                ))}
              </div>
            </div>
            <div class="section">
              <h3>World</h3>
              <dl class="kv">
                <dt data-tip="How much of the world is still alive. Kin capacity follows it.">Vitality</dt>
                <dd>
                  <div class="row" style={{ justifyContent: 'flex-end' }}>
                    <div class={`bar ${b.vitality < 0.25 ? 'bad' : 'good'}`} style={{ width: '90px' }}><i style={{ width: pct(b.vitality) }} /></div>
                    <span class="mono">{pct(b.vitality)}</span>
                  </div>
                </dd>
                <FreezingRow s={s} b={b} c={c} />
                <ClimateRows s={s} b={b} />
                <dt>Core heat</dt>
                <dd class="mono">{pct(b.coreHeat)}</dd>
                {c.damage > 0.01 && (
                  <>
                    <dt data-tip="Damage to the settlement's hearth from overdrive and attacks.">Hearth damage</dt>
                    <dd class="mono bad">{pct(c.damage)}</dd>
                  </>
                )}
                {b.inspiralAt && isFinite(b.inspiralAt) && (
                  <>
                    <dt>Falls inward</dt>
                    <dd class="mono">{formatYears(b.inspiralAt)}</dd>
                  </>
                )}
              </dl>
            </div>
            <ExpandSection s={s} c={c} />
            <div class="section">
              <h3>Focus</h3>
              <div class="seg">
                {FOCUS.map((f) => (
                  <button key={f.id} class={`btn small ${c.focus === f.id ? 'primary' : ''}`} data-tip={f.tip} onClick={() => act((g) => setFocus(g, c.id, f.id))}>
                    {f.name}
                  </button>
                ))}
              </div>
              {hasCharter(s, 'overdrive_protocols') && (
                <button class={`btn small ${c.overdrive ? 'danger on' : ''}`} style={{ marginTop: '6px' }} data-tip="Run the hearth beyond its rating: much more energy, steady damage, a brighter signature and a draw on the galaxy's free energy." onClick={() => act((g) => toggleOverdrive(g, c.id))}>
                  {c.overdrive ? 'Overdrive ON' : 'Overdrive'}
                </button>
              )}
            </div>
            <div class="section">
              <h3>Structures</h3>
              <div class="row wrap" style={{ gap: '4px' }}>
                {Object.entries(c.structures)
                  .filter(([id, n]) => n > 0 && STRUCTURE_BY_ID[id])
                  // grouped by kind, as in the build list
                  .sort(([a], [b]) => KIND_ORDER.indexOf(structureKind(STRUCTURE_BY_ID[a])) - KIND_ORDER.indexOf(structureKind(STRUCTURE_BY_ID[b])))
                  .map(([id, n]) => (
                    <span key={id} class="chip" data-tip={structureLabel(id, sys).desc}>
                      <KindIcon id={id} />
                      {structureLabel(id, sys).name}
                      {n > 1 ? ` ×${n}` : ''}
                    </span>
                  ))}
              </div>
            </div>
          </>
        ) : (
          <BuildTab s={s} c={c} industry={y?.industry ?? 0} />
        )}
      </div>
    </>
  );
}

/** Founding new settlements from here: ready settler ships, and one-click orders for more. */
function ExpandSection({ s, c }: { s: GameState; c: Colony }) {
  const ready = Object.values(s.fleets).filter((f) => f.at === c.systemId && f.order === 'idle' && f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles));
  const ships = buildableShips(s, c).filter((x) => x.def.settles);
  const queued = (id: string) => c.queue.filter((q) => q.key === id).length;
  const noYard = !(c.structures.shipyard ?? 0);
  return (
    <div class="section">
      <h3>Expand</h3>
      {ready.map((f) => (
        <div key={f.id} class="row ready-settler">
          <Icon name="colonize" cls="neon" />
          <span class="grow" style={{ fontSize: '12px' }}>
            {f.name} is ready.
          </span>
          <button class="btn small primary" onClick={() => selectFleet(f)}>
            Choose a world
          </button>
        </div>
      ))}
      {noYard ? (
        <div class="faint" style={{ fontSize: '12px' }}>Build a Shipyard here to launch settlers.</div>
      ) : (
        <div class="settler-buttons">
          {ships.map(({ def, error }) => {
            const cost = buildCost(s, def, true);
            const n = queued(def.id);
            return (
              <button
                key={def.id}
                class="btn small"
                disabled={!!error}
                data-tip={`${def.name}\n${def.desc}\nCosts ${cost.industry} industry${cost.matter > 0 ? ` and ${cost.matter} matter` : ''}.${error ? `\n${error}` : ''}`}
                onClick={() => act((g) => queueBuild(g, c.id, 'ship', def.id)) && sfx('build')}
              >
                <Icon name="colonize" /> {def.name}
                <span class="mono faint">
                  {cost.industry} ind{cost.matter > 0 ? ` / ${cost.matter} mat` : ''}
                </span>
                {n > 0 && <span class="chip neon">{n} queued</span>}
              </button>
            );
          })}
        </div>
      )}
      {!hasTech(s, 'mind_substrate') && !hasTech(s, 'fusion_drives') && (
        <div class="faint" style={{ fontSize: '11px', marginTop: '4px' }}>
          Lighters reach worlds of this star. For other stars, research Mind Substrate (Seedcores) or Fusion Drives (Kin Arks).
        </div>
      )}
    </div>
  );
}

function selectFleet(f: Fleet) {
  sfx('select');
  selection.value = { kind: 'fleet', id: f.id };
  engine()?.select(f.id);
}

/** The icon for each kind of structure; its colour comes from `.kind-<kind>` in styles.css. */
const KIND_ICON: Record<StructureKind, IconName> = { energy: 'energy', storage: 'reserve', matter: 'matter', industry: 'industry', insight: 'insight', accord: 'accord', people: 'kin', world: 'planet', defence: 'shield' };
const KIND_ORDER = STRUCTURE_KINDS.map((k) => k.id);

/** A structure's kind, as a small coloured icon in front of its name. */
function KindIcon({ id }: { id: string }) {
  const def = STRUCTURE_BY_ID[id];
  if (!def) return null;
  const k = structureKind(def);
  return (
    <span class={`kind-icon kind-${k}`}>
      <Icon name={KIND_ICON[k]} />
    </span>
  );
}

/** Which kind of structure the build list shows (kept while moving between settlements). */
const buildKind = signal<StructureKind | 'all'>('all');

function BuildTab({ s, c, industry }: { s: GameState; c: Colony; industry: number }) {
  void rev.value; // mutable game state: re-render on every change
  const [kind, setKind] = useState<'structure' | 'ship'>('structure');
  const rc = rushCost(s, c.id);
  let acc = 0;
  const ctx = project(s).ctx;
  type Item = { id: string; name: string; desc: string; error: string | null | undefined; cost: ReturnType<typeof buildCost>; count: number; fx?: BuildEffect; sk?: StructureKind };
  const list: Item[] =
    kind === 'structure'
      ? buildableStructures(s, c).map((x) => ({ id: x.def.id, ...structureLabel(x.def.id, s.systems[c.systemId]), error: x.error, cost: buildCost(s, x.def, false), count: c.structures[x.def.id] ?? 0, fx: structureEffect(s, c, x.def.id, ctx), sk: structureKind(x.def) }))
      : buildableShips(s, c).map((x) => ({ id: x.def.id, name: x.def.name, desc: x.def.desc, error: x.error, cost: buildCost(s, x.def, true), count: 0 }));
  // structures come grouped by kind, and can be narrowed to one kind
  const present = STRUCTURE_KINDS.filter((k) => list.some((x) => x.sk === k.id));
  const only = kind === 'structure' && buildKind.value !== 'all' && present.some((k) => k.id === buildKind.value) ? buildKind.value : null;
  const groups: { k: (typeof STRUCTURE_KINDS)[number] | null; items: Item[] }[] =
    kind === 'structure' ? present.filter((k) => !only || k.id === only).map((k) => ({ k, items: list.filter((x) => x.sk === k.id) })) : [{ k: null, items: list }];
  const pick = (k: StructureKind | 'all') => {
    buildKind.value = k;
    sfx('click');
  };
  return (
    <>
      <div class="section" style={{ marginTop: 0 }}>
        <h3>Queue <span class="mono faint" style={{ letterSpacing: 0 }}>{n1(industry)} industry/turn</span></h3>
        {c.queue.length === 0 && <div class="faint" style={{ fontSize: '12px' }}>Idle. Choose something below.</div>}
        {c.queue.map((q, i) => {
          const def = q.kind === 'structure' ? STRUCTURE_BY_ID[q.key] : SHIP_BY_ID[q.key];
          acc += q.cost - q.progress;
          const turns = industry > 0 ? Math.ceil(acc / industry) : Infinity;
          return (
            <div key={q.uid} class="queue-item">
              <div class="row">
                <span class="grow">
                  {q.kind === 'structure' ? (
                    <KindIcon id={q.key} />
                  ) : (
                    <span class="kind-icon">
                      <Icon name="fleet" />
                    </span>
                  )}
                  {q.kind === 'structure' ? structureLabel(q.key, s.systems[c.systemId]).name : def?.name ?? q.key}
                </span>
                <span class="mono faint" style={{ fontSize: '11px' }}>{isFinite(turns) ? `${turns} turn${turns > 1 ? 's' : ''}` : 'stalled'}</span>
                <button class="btn ghost small" aria-label="Move up" data-tip="Build this sooner (move up the queue)" disabled={i === 0} onClick={() => act((g) => moveQueued(g, c.id, q.uid, -1))}>▲</button>
                <button class="btn ghost small" aria-label="Move down" data-tip="Build this later (move down the queue)" disabled={i === c.queue.length - 1} onClick={() => act((g) => moveQueued(g, c.id, q.uid, 1))}>▼</button>
                <button class="btn ghost small" aria-label="Remove" data-tip="Remove (half the materials come back)" onClick={() => act((g) => removeQueued(g, c.id, q.uid))}>
                  <Icon name="close" />
                </button>
              </div>
              <div class="bar neon"><i style={{ width: pct(q.progress / q.cost) }} /></div>
            </div>
          );
        })}
        {rc && c.flags_rushed !== s.turn && (
          <button class="btn small" style={{ marginTop: '6px' }} data-tip="Emergency shifts finish the first project now. People resent it." onClick={() => act((g) => rushBuild(g, c.id)) && sfx('build')}>
            Rush first: {rc.matter ? `${rc.matter} matter, ` : ''}{rc.energy} energy
          </button>
        )}
      </div>
      <div class="section">
        <div class="row" style={{ gap: '4px', marginBottom: '6px' }}>
          <button class={`btn small ${kind === 'structure' ? 'primary' : ''}`} onClick={() => setKind('structure')}>Structures</button>
          <button class={`btn small ${kind === 'ship' ? 'primary' : ''}`} onClick={() => setKind('ship')}>Ships</button>
        </div>
        {kind === 'structure' && present.length > 1 && (
          <div class="kind-chips" role="group" aria-label="Show structures of one kind">
            <button class={`btn small ${!only ? 'primary' : ''}`} aria-pressed={!only} data-tip={`Every kind (${list.length} here)`} onClick={() => pick('all')}>
              All
            </button>
            {present.map((k) => (
              <button key={k.id} class={`btn small kind-${k.id} ${only === k.id ? 'primary' : ''}`} aria-pressed={only === k.id} data-tip={`${k.tip}\n${list.filter((x) => x.sk === k.id).length} here`} onClick={() => pick(k.id)}>
                <Icon name={KIND_ICON[k.id]} /> {k.name}
              </button>
            ))}
          </div>
        )}
        <div class="list-head">
          <span>{kind === 'structure' ? 'Click to queue · what one more adds here, per turn' : 'Click to queue'}</span>
          <span>Cost</span>
        </div>
        <div class="list">
          {groups.map((grp) => [
            grp.k && !only && (
              <div key={`h-${grp.k.id}`} class={`build-group kind-${grp.k.id}`} data-tip={grp.k.tip}>
                <Icon name={KIND_ICON[grp.k.id]} /> {grp.k.name}
              </div>
            ),
            ...grp.items.map((x) => (
              <div
                key={x.id}
                class={`list-item build ${x.error ? 'disabled' : ''}`}
                data-tip={`${x.name}\n${x.desc}${x.error ? `\n${x.error}` : ''}`}
                onClick={() => {
                  if (x.error) return;
                  if (act((g) => queueBuild(g, c.id, kind, x.id))) sfx('build');
                }}
              >
                <span class="grow">
                  {x.sk && <KindIcon id={x.id} />}
                  {x.name}
                  {x.count > 0 && <span class="faint"> ×{x.count}</span>}
                  {x.fx && <EffectLine fx={x.fx} />}
                  <div class="build-desc">{x.desc}</div>
                  {x.error && <div class="faint" style={{ fontSize: '11px' }}>{x.error}</div>}
                </span>
                <span class="mono faint build-cost" data-tip={`Costs ${x.cost.industry} industry (the settlement's work)${x.cost.matter > 0 ? `, ${x.cost.matter} matter up front` : ''}${x.cost.energy > 0 ? `, ${x.cost.energy} energy` : ''}`}>
                  <span>{x.cost.industry} <Icon name="industry" /> ind</span>
                  {x.cost.matter > 0 && <span>{x.cost.matter} <Icon name="matter" /> mat</span>}
                  {x.cost.energy > 0 && <span>{x.cost.energy} <Icon name="energy" /> en</span>}
                </span>
              </div>
            )),
          ])}
        </div>
      </div>
    </>
  );
}

/** Free substrate and no Echoes yet: say where Echoes come from, and when the next one forms. */
function EchoHint({ s, c }: { s: GameState; c: Colony }) {
  const grown = c.growth?.echoes ?? 0;
  const turns = Math.max(1, Math.ceil((1 - grown) / 0.22));
  const clinic = (c.structures.upload_clinic ?? 0) > 0;
  const stalled = s.civ.energy <= 15;
  return (
    <div class="faint echo-hint">
      {stalled ? (
        <span class="warn">No new Echoes while the reserve is at 15 energy or less.</span>
      ) : (
        <>A new Echo forms in the free substrate in about {turns} turn{turns > 1 ? 's' : ''} (one every ~5 turns while the reserve is above 15).</>
      )}{' '}
      {clinic ? 'Upload a Kin for one at once (6 energy).' : hasTech(s, 'upload') ? 'For one at once, build an Upload Clinic and upload a Kin.' : 'For one at once, research Upload and build an Upload Clinic.'}
    </div>
  );
}

/** What one more of a structure changes here, per turn: the numbers first, then the rest. */
function EffectLine({ fx }: { fx: BuildEffect }) {
  const parts: preact.JSX.Element[] = [];
  const add = (v: number, icon: IconName, what: string) => {
    if (Math.abs(v) < 0.05) return;
    parts.push(
      <span key={what} class={`fx ${v > 0 ? 'good' : 'bad'}`} data-tip={`${what} a turn, here`}>
        {signed(v)}
        <Icon name={icon} />
        <span class="fx-word">{what.toLowerCase()}</span>
      </span>,
    );
  };
  add(fx.energy, 'energy', 'Energy');
  add(fx.matter, 'matter', 'Matter');
  add(fx.industry, 'industry', 'Industry');
  add(fx.insight, 'insight', 'Insight');
  add(fx.accord, 'accord', 'Accord');
  for (const [k, v] of Object.entries(fx.room)) {
    if (!v) continue;
    parts.push(
      <span key={k} class="fx good">
        +{v} {k === 'cryo' ? 'cold sleep' : `${THREAD_DEFS[k as ThreadId].name} room`}
      </span>,
    );
  }
  for (const n of fx.notes) parts.push(<span key={n} class="fx note">{n}</span>);
  if (!parts.length) return null;
  return <div class="fx-line">{parts}</div>;
}

// ------------------------------------------------------------------ fleet

type SettleSort = 'auto' | 'near' | ThreadId;
/** Other measures a settler list can be ranked by: key, button, tip, heading. */
const SETTLE_SORTS: [SettleSort, string, string, string][] = [
  ['auto', 'Best for them', '', ''],
  ['kin', 'Livable', 'Habitability × vitality and room for Kin without domes', 'most livable first'],
  ['echoes', 'Power', 'The energy a settlement there could collect each turn at the Tide', 'most power first'],
  ['lattice', 'Matter', 'What mines, skimmers and lifters could raise there each turn', 'most matter first'],
  ['coldminds', 'Lasting', 'How long before the world falls into its dead star', 'longest-lasting first'],
  ['near', 'Nearest', 'The shortest trips first', 'nearest first'],
];

/** What each kind of settler looks for first. */
const SETTLE_BEST: Record<ThreadId, string> = {
  kin: 'most livable first',
  echoes: 'most power first',
  chorus: 'most power first',
  lattice: 'most matter first',
  coldminds: 'longest-lasting first',
};

function FleetPanel({ s, f }: { s: GameState; f: Fleet }) {
  void rev.value; // mutable game state: re-render on every change
  const mods = computeMods(s);
  const here = f.at ? s.systems[f.at] : null;
  const followingIt = following.value?.kind === 'fleet' && following.value.id === f.id;
  const settler = f.ships.find((x) => SHIP_BY_ID[x.cls]?.settles);
  const surveyor = f.ships.some((x) => SHIP_BY_ID[x.cls]?.survey);
  const tender = f.ships.some((x) => SHIP_BY_ID[x.cls]?.tames);
  const tgt = targeting.value?.fleetId === f.id;
  const known = here ? Object.values(s.systems).filter((x) => x.id !== here.id && !x.gone && (s.civ.known[x.id] ?? 0) > 0).map((x) => ({ sys: x, ly: distLy(here, x) })) : [];
  // collision stars first (all of them, in the Degenerate Age), then the nearest ten
  const dests = [
    ...known.filter((d) => isBeacon(s, d.sys)).sort((a, b) => a.ly - b.ly),
    ...known
      .filter((d) => !isBeacon(s, d.sys))
      .sort((a, b) => (surveyor ? Number(s.civ.known[a.sys.id] === 2) - Number(s.civ.known[b.sys.id] === 2) : 0) || a.ly - b.ly)
      .slice(0, 10),
  ];
  // how suitable each charted star nearby is for each kind of settler, and the best of them
  const destSites: Record<string, StarSites> = {};
  const destBest: Partial<Record<ThreadId, number>> = {};
  for (const d of dests) {
    if (s.civ.known[d.sys.id] !== 2) continue;
    const sites = (destSites[d.sys.id] = starSites(s, d.sys));
    for (const n of NEEDS) destBest[n.thread] = Math.max(destBest[n.thread] ?? 0, sites[n.thread]?.v.score ?? 0);
  }
  const settleDef = settler ? SHIP_BY_ID[settler.cls] : null;
  // settlers are ranked for their own kind unless the player picks another measure
  const [settleSort, setSettleSort] = useState<SettleSort>('auto');
  useEffect(() => setSettleSort('auto'), [f.id]);
  const measure: ThreadId = settleSort === 'auto' || settleSort === 'near' ? (settleDef?.settles?.thread ?? 'kin') : settleSort;
  const settleTargets =
    here && settleDef
      ? Object.values(s.bodies)
          .filter((b) => s.civ.known[b.systemId] === 2 && (!settleDef.inSystem || b.systemId === here.id) && !canSettle(s, b, settleDef.settles!.thread))
          .map((b) => ({ b, ly: distLy(here, s.systems[b.systemId]), hab: b.habitability * b.vitality, v: siteValue(s, b, measure) }))
          // each kind of mind wants something different: Kin livable ground, Echoes power, the Lattice matter, Coldminds time
          .sort((a, b) => Number(isBeacon(s, s.systems[b.b.systemId])) - Number(isBeacon(s, s.systems[a.b.systemId])) || (settleSort === 'near' ? a.ly - b.ly : b.v.score - a.v.score) || a.ly - b.ly)
          .slice(0, 10)
      : [];
  const swarmHere = here ? Object.values(s.swarms).find((w) => w.systemId === here.id && !w.tamed) : null;
  // another civilization lives here: our warships could take from them
  const [raidArmed, setRaidArmed] = useState(false);
  useEffect(() => setRaidArmed(false), [f.id, f.at]);
  const raidSv = here && isWarFleet(f) ? raidTarget(s, here.id) : null;
  const raidWait = raidSv?.raidedAt !== undefined ? RAID_COOLDOWN - (s.turn - raidSv.raidedAt) : 0;
  const doRaid = () => {
    if (!raidArmed) {
      setRaidArmed(true);
      sfx('warn');
      return;
    }
    setRaidArmed(false);
    const out: { r?: { ok: boolean; text: string } } = {};
    const done = act((g) => {
      const r = raid(g, f.id);
      if (typeof r === 'string') return r;
      out.r = r;
    });
    if (done && out.r) {
      notify(out.r.text, out.r.ok ? 'good' : 'bad');
      sfx(out.r.ok ? 'good' : 'bad');
    }
  };
  return (
    <>
      <div class="drawer-head">
        <img class="fleet-portrait" src={`art/ships/${fleetLook(f.ships.map((x) => x.cls))}.png`} alt="" />
        <div class="eyebrow">{here ? `At ${here.name}` : f.to ? `Under way to ${s.systems[f.to]?.name}` : 'Adrift'}</div>
        <h2>{f.name}</h2>
        <div class="row wrap" style={{ marginTop: '6px' }}>
          {f.ships.map((x, i) => (
            <span key={i} class="chip" data-tip={`${SHIP_BY_ID[x.cls]?.desc}\nHull ${x.hp}/${SHIP_BY_ID[x.cls]?.hp}`}>
              {SHIP_BY_ID[x.cls]?.name ?? x.cls}
            </span>
          ))}
          {f.order === 'fortify' && <span class="chip neon" data-tip={`Dug in: counts ${FORTIFY_BONUS}× against swarms here, and turns raiders away from the capital.`}><Icon name="shield" /> fortified</span>}
          {f.order === 'hold' && <span class="chip" data-tip="Parked on purpose: the game will not ask about it.">holding</span>}
          {f.auto === 'explore' && <span class="chip neon" data-tip={`Exploring by itself: always the nearest unsurveyed star. It waits while the reserve is under ${EXPLORE_RESERVE} energy plus the launch.`}><Icon name="survey" /> exploring</span>}
        </div>
        <div class="row wrap" style={{ marginTop: '8px', gap: '4px' }}>
          <button class={`btn small ${followingIt && !following.value?.keepZoom ? 'on' : ''}`} onClick={() => { sfx('click'); if (followingIt && !following.value?.keepZoom) engine()?.unfollow(); else engine()?.focusFleet(f.id); }} data-tip="Fly in close and keep the view on this fleet as it moves (or double-click it; tap it twice on a touchscreen). Click again to let go.">
            <Icon name="focus" /> Follow
          </button>
          <button class={`btn small ${followingIt && following.value?.keepZoom ? 'on' : ''}`} onClick={() => { sfx('click'); if (followingIt && following.value?.keepZoom) engine()?.unfollow(); else engine()?.focusFleet(f.id, true); }} data-tip="Put this fleet in the middle of the view and keep it there as it moves, without zooming in. Click again to let go.">
            <Icon name="galaxy" /> Centre
          </button>
          {here && view.value === 'galaxy' && (
            <button class="btn small" onClick={() => pivotToSystem(here.id, true)} data-tip={`Step inside ${here.name} to see its worlds`}>
              <Icon name="system" /> Look inside {here.name}
            </button>
          )}
        </div>
      </div>
      <div class="drawer-body scroll">
        {!here && f.to && (
          <>
            <div class="bar neon" style={{ marginBottom: '6px' }}><i style={{ width: pct(f.distance > 0 ? f.traveled / f.distance : 1) }} /></div>
            <div class="mono dim" style={{ fontSize: '12px' }}>
              {formatDistance(f.traveled)} of {formatDistance(f.distance)} · {tripLabel(s, f.distance - f.traveled, mods, true)} to go
            </div>
            {f.order === 'colonize' && f.targetBody && <div class="faint" style={{ fontSize: '12px', marginTop: '4px' }}>To settle {s.bodies[f.targetBody]?.name}.</div>}
            {f.auto === 'explore' && (
              <button class="btn small" style={{ marginTop: '8px' }} onClick={() => act((g) => setAutoExplore(g, f.id, false)) && sfx('click')} data-tip="It finishes this trip, then waits for orders.">
                <Icon name="survey" /> Stop exploring
              </button>
            )}
          </>
        )}
        {here && (
          <>
            <div class="row wrap" style={{ gap: '4px' }}>
              {surveyor && (
                <button class={`btn small ${f.auto === 'explore' ? 'on' : 'primary'}`} onClick={() => act((g) => setAutoExplore(g, f.id, f.auto !== 'explore')) && sfx('click')} data-tip={f.auto === 'explore' ? 'Call off exploring: it waits here for orders.' : 'Keep charting on its own: always the nearest unsurveyed star, keeping a little energy in reserve.'}>
                  <Icon name="survey" /> {f.auto === 'explore' ? 'Stop exploring' : 'Auto-explore'}
                </button>
              )}
              <button class={`btn small ${tgt ? 'on' : ''}`} onClick={() => (tgt ? (targeting.value = null) : pickOnMap(f))} data-tip="Click, then click any star on the map to send it there (or pick one from the list below).">
                <Icon name="move" /> {tgt ? 'Click a star… (Esc cancels)' : 'Choose on map'}
              </button>
              {hasTech(s, 'hunger_lures') && !here.beacon && (
                <button class="btn small" data-tip="Light a decoy beacon here (30 energy). Swarms are drawn to it instead of to us." onClick={() => act((g) => placeBeacon(g, f.id))}>
                  Beacon
                </button>
              )}
              {tender && swarmHere && (
                <button class="btn small" data-tip="Broadcast the dead makers' command language to take control of the swarm." onClick={() => act((g) => tame(g, swarmHere.id))}>
                  Tame swarm
                </button>
              )}
              {f.order === 'fortify' || f.order === 'hold' ? (
                <button class="btn small" data-tip="Stand down: it waits for orders again." onClick={() => act((g) => standFleet(g, f.id, 'idle')) && sfx('click')}>
                  Stand down
                </button>
              ) : isWarFleet(f) ? (
                <button class="btn small primary" data-tip={`Dig in here: counts ${FORTIFY_BONUS}× against swarms in this system, turns raiders away from the capital, and stops asking for orders.`} onClick={() => act((g) => standFleet(g, f.id, 'fortify')) && sfx('build')}>
                  <Icon name="shield" /> Fortify
                </button>
              ) : (
                <button class="btn small" data-tip="Park it here on purpose: the game stops asking about it." onClick={() => act((g) => standFleet(g, f.id, 'hold')) && sfx('click')}>
                  Hold here
                </button>
              )}
              {raidSv && (
                <button
                  class={`btn small danger ${raidArmed ? 'on' : ''}`}
                  disabled={raidWait > 0}
                  onClick={doRaid}
                  data-tip={
                    raidWait > 0
                      ? `${raidSv.name} is on guard since our last raid. ${raidWait} more turn${raidWait === 1 ? '' : 's'}.`
                      : `Take part of ${raidSv.name}’s reserve by force. Every warship here joins in (attack ${raidStrength(s, here.id)}); if their defences hold, it is our ships that get hurt.\nWhatever happens: they will not forgive it, every civilization we know hears of it, Resolve −3, Dissent +4. Once every ${RAID_COOLDOWN} turns at most.`
                  }
                >
                  <Icon name="attack" /> {raidArmed ? 'Really raid? (click again)' : `Raid ${raidSv.name}`}
                </button>
              )}
              <button class="btn small danger" data-tip="Scrap the fleet here and recover some matter." onClick={() => act((g) => disbandFleet(g, f.id)) && (selection.value = null)}>
                Disband
              </button>
            </div>
            {settleTargets.length > 0 && (
              <div class="section">
                <h3>
                  Where to settle{' '}
                  <span class="faint" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    · {settleSort === 'auto' ? SETTLE_BEST[settleDef?.settles?.thread ?? 'kin'] : SETTLE_SORTS.find((x) => x[0] === settleSort)?.[3]}
                  </span>
                </h3>
                <div class="row wrap" style={{ gap: '3px', marginBottom: '4px' }}>
                  {SETTLE_SORTS.map(([k, label, tip]) => (
                    <button key={k} class={`btn small ghost ${settleSort === k ? 'on' : ''}`} data-tip={k === 'auto' ? `What ${THREAD_DEFS[settleDef?.settles?.thread ?? 'kin'].name} need most: ${SETTLE_SORTS.find((x) => x[0] === (settleDef?.settles?.thread ?? 'kin'))?.[2] ?? ''}.` : tip} onClick={() => setSettleSort(k)}>
                      {k === 'auto' ? `Best for ${THREAD_DEFS[settleDef?.settles?.thread ?? 'kin'].name}: ${SETTLE_SORTS.find((x) => x[0] === (settleDef?.settles?.thread ?? 'kin'))?.[1] ?? ''}` : label}
                    </button>
                  ))}
                </div>
                <div class="list">
                  {settleTargets.map(({ b, ly, hab, v }) => (
                    <div key={b.id} class="list-item" onClick={() => act((g) => orderFleet(g, f.id, b.systemId, 'colonize', b.id)) && sfx('good')}>
                      <Icon name={bodyIcon(b.kind)} />
                      <span class="grow">
                        {isBeacon(s, s.systems[b.systemId]) && <span class="chip boon" style={{ marginRight: '6px' }} data-tip={BEACON_TIP}>collision star</span>}
                        {b.name} <span class="faint" style={{ fontSize: '11px' }}>{bodyKindName(s, b)}{b.systemId !== here.id ? ` · ${s.systems[b.systemId].name}` : ''}</span>
                        <SwarmNear s={s} systemId={b.systemId} />
                      </span>
                      <button class="btn small ghost" style={{ padding: '1px 5px' }} onClick={(e) => { e.stopPropagation(); lookAtWorld(b.systemId, b.id); }} data-tip="Look at this world before sending the ship: the view turns to it, inside its system, and the ship waits for your order. Its star's panel (and the galaxy map) show what is around it.">
                        <Icon name="focus" />
                      </button>
                      <span class={`mono ${settleDef?.settles?.thread === 'kin' && hab >= LIVING_WORLD ? 'good' : ''}`} style={{ fontSize: '11px' }} data-tip={v.tip}>
                        {v.label}
                      </span>
                      <span class="mono faint" style={{ fontSize: '11px' }} data-tip={ly > 0 ? TRIP_TIP : ''}>{ly > 0 ? tripLabel(s, ly, mods) : 'here'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div class="section">
              <h3>
                Nearby{' '}
                {surveyor && (
                  <span class="faint" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                    · {dests.some((d) => s.civ.known[d.sys.id] !== 2) ? 'unsurveyed first' : 'all charted'}
                  </span>
                )}
              </h3>
              {surveyor && !dests.some((d) => s.civ.known[d.sys.id] !== 2) && (
                <p class="dim" style={{ fontSize: '12px', margin: '0 0 6px' }}>
                  Every star we know of here is charted. A ship with nothing uncharted near it takes a long look at the end of the turn and picks out the nearest unseen stars (a probe three, other ships one), even across the gulfs between clusters. Deep Survey Optics lets everyone see farther.
                </p>
              )}
              <div class="list">
                {dests.map(({ sys, ly }) => (
                  <div key={sys.id} class="list-item" style={{ flexWrap: 'wrap' }} onClick={() => act((g) => orderFleet(g, f.id, sys.id, 'move')) && sfx('select')}>
                    <Icon name={primaryIcon(sys.primary.kind)} />
                    <span class="grow">
                      {sys.name}
                      {isBeacon(s, sys) && <span class="chip boon" style={{ marginLeft: '6px' }} data-tip={BEACON_TIP}>collision star</span>}
                      {swarmSeenAt(s, sys.id) && <span class="chip danger" style={{ marginLeft: '6px' }} data-tip={SWARM_TIP}>swarm</span>}
                      {s.civ.known[sys.id] !== 2 && <span class="faint" style={{ fontSize: '11px' }}> unsurveyed</span>}
                    </span>
                    <span class="mono faint" style={{ fontSize: '11px' }} data-tip={`Distance · turns at this pace · years of flight · launch energy\n${TRIP_TIP}`}>
                      {formatDistance(ly)} · {tripLabel(s, ly, mods)} · {n0(launchCost(s, f, ly, mods))}
                      <Icon name="energy" />
                    </span>
                    {s.civ.known[sys.id] === 2 && <SiteStrip s={s} sites={destSites[sys.id]} best={destBest} mine={settleDef?.settles?.thread ?? null} />}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ swarm

function SwarmPanel({ s, sw }: { s: GameState; sw: Swarm }) {
  void rev.value; // mutable game state: re-render on every change
  const at = sw.systemId ? s.systems[sw.systemId] : null;
  const col = at ? Object.values(s.colonies).find((c) => c.systemId === at.id) : null;
  const tenderHere = at && Object.values(s.fleets).some((f) => f.at === at.id && f.ships.some((x) => SHIP_BY_ID[x.cls]?.tames));
  return (
    <>
      <div class="drawer-head">
        <div class="eyebrow">{at ? `At ${at.name}` : sw.to ? `Moving toward ${s.systems[sw.to]?.name}` : 'Drifting'}</div>
        <h2>{sw.tamed ? 'Tamed Swarm' : 'The Hunger'}</h2>
        <div class="row wrap" style={{ marginTop: '6px' }}>
          <span class={`chip ${sw.tamed ? 'neon' : 'danger'}`}>{sw.tamed ? 'answers to us' : sw.awake ? 'awake' : 'dormant'}</span>
        </div>
      </div>
      <div class="drawer-body scroll">
        <div class="drawer-plate" style={{ backgroundImage: `url(art/${sw.tamed ? 'swarm_tamed' : 'swarm'}.webp)` }} role="img" aria-label={sw.tamed ? 'A tamed swarm working in ordered rings' : 'A swarm stripping a world'} />
        <p class="flavor" style={{ margin: '0 0 8px' }}>
          {sw.tamed
            ? 'Its makers’ commands still work. For now it does what we say.'
            : 'Self-replicating harvesters left by a civilization that died long ago. No mind, no malice: they follow heat and matter, eat, and multiply.'}
        </p>
        <dl class="kv">
          <dt>Size</dt>
          <dd class="mono">{n1(sw.size)}</dd>
          <dt>Appetite</dt>
          <dd class="mono">{n1(sw.appetite)}</dd>
        </dl>
        <div class="row wrap" style={{ gap: '4px', marginTop: '10px' }}>
          {!sw.tamed && hasTech(s, 'command_language') && (
            <button class="btn small" disabled={!tenderHere} data-tip={tenderHere ? 'Take command of it.' : 'A Swarm Tender must be in the same system.'} onClick={() => act((g) => tame(g, sw.id))}>
              Tame
            </button>
          )}
          {sw.tamed && col && (
            <button class="btn small" data-tip="Fold the swarm into this settlement as Lattice. Something of its appetite comes with it (Taint)." onClick={() => act((g) => absorb(g, sw.id, col.id)) && (selection.value = null)}>
              Absorb into {col.name}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
