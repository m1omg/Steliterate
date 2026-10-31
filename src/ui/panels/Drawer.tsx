import { signal } from '@preact/signals';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { SHIP_BY_ID, attackNote, fleetLook, isWarship, shipNote } from '../../game/data/ships';
import { STRUCTURE_BY_ID, STRUCTURE_KINDS, enabledAt, structureKind, structureLabel, type StructureKind } from '../../game/data/structures';
import { EVENT_BY_ID } from '../../game/data/events';
import { THREAD_DEFS } from '../../game/data/threads';
import { formatDistance, formatYears, logTurnLength } from '../../game/eras';
import { FROZEN_K, ICE_MELTS_K, frozenHard, tooColdForOpenAir, WATER_RICH, fallsInAt, giantWorld, rubbleGame, bodyClimate, boilingAway, buriedOcean, curvatureWarmth, decayWarmth, haloDrawn, insolation, insolationByDistance, lampsOver, lightUnitSuns, primaryTemperature, seededLifeUnkept, sourceLight, sunGone, terraformLit, turnsToFreeze, waterState } from '../../game/physics';
import { SEED_CAP, SEED_RATE, TERRAFORM_CEILING, seedingBlocked, seedingGrowth, terraformSummary } from '../../game/sim/terraform';
import {
  absorb,
  buildableShips,
  buildableStructures,
  buildCost,
  convert,
  disbandFleet,
  dismantle,
  dismantleCheck,
  dismantleTerms,
  moveQueued,
  orderFleet,
  setAutoExplore,
  setTactic,
  fortifyOne, standFleet,
  storm,
  placeBeacon,
  putOutBeacon,
  queueBuild,
  raid,
  removeQueued,
  rushBuild,
  rushCost,
  setFocus,
  setSpare,
  tame,
  toggleOverdrive,
  attack as attackOrder,
  strike,
  type Conversion,
} from '../../game/sim/actions';
import { PASSAGE_OUTPUT, capacity } from '../../game/sim/economy';
import { beginPassage, endForeseen, passageCheck, passageTerms, turnsToEndOfMatter } from '../../game/sim/passage';
import { turnsToCollapse } from '../../game/sim/deeptime';
import { SPENT_SPIN, driftChoices, holeFailing, type DriftChoice } from '../../game/sim/crossing';
import { beginHorizon, driftCheck, driftTerms, driftToAnotherHole, horizonCheck, horizonTerms } from '../../game/sim/horizon';
import { POSITRONIUM_DECAY, beginWeave, leaveWeave, leaveWeaveCheck, leaveWeaveCost, positroniumHere, turnsToDecay, weaveCheck, weaveTerms } from '../../game/sim/positronium';
import { spareYield, type SpareYield } from '../../game/sim/spare';
import { governorChoice, setGovernor } from '../../game/sim/governor';
import { GOVERNOR_TIP, GovernorChip, GovernorPicker, KIND_ICON, governorLine } from '../Governor';
import { canSettle, launchCost } from '../../game/sim/fleets';
import { TRIP_TIP, tripLabel } from '../trip';
import { computeMods } from '../../game/sim/mods';
import { builtEffect, builtEffectText, project, structureEffect, type BuildEffect } from '../../game/sim/projection';
import { allColonies, allFleets, capital, colonies, distLy, fleets, formOf, hasCharter, hasTech, leftBehind, ownColony, popsOf, protonFateKnown, swarmSeenAt } from '../../game/sim/util';
import { nearestSwarmSeen, nestSeenAt, readsSwarms, swarmArrives, swarmSight } from '../../game/sim/sight';
import { FORMS } from '../../game/data/forms';
import { assaultBlocked, assaultOdds, atWarWith, battleForecast, holdOf, screensSeen, settlementFire, shipsInWords, strikeBlocked, walled } from '../../game/sim/conflict';
import { TACTICS, tacticNote, tacticOf } from '../../game/data/tactics';
import { SIEGE_TURNS } from '../../game/sim/war';
import { settlementSeen } from '../../game/sim/others';
import { attackBlocked, attackOdds, swarmReach, warshipsAt } from '../../game/sim/hunger';
import { BEACON_COST, BEACON_UPKEEP } from '../../game/sim/beacons';
import type { Body, Colony, Fleet, GameState, StarSystem, Swarm, ThreadId } from '../../game/types';
import { THREADS } from '../../game/types';
import { kelvin, mult, n0, n1, pct, signed, solarMass } from '../fmt';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { FOCUS, spareChoices, PRIMARY_NAME, TRAIT_NAME, WAY_NAME, wayArt, bodyIcon, primaryIcon, bodyKindName, bodyKindNote, deepNote, isBeacon, BEACON_TIP, NEST_TIP, SWARM_TIP } from '../labels';
import { act, engine, following, hudPrefs, isPhone, notify, openBuildFor, rev, selection, setHudPrefs, sheetHint, sheetSize, targeting, view } from '../store';
import { uiFactor } from '../Tip';
import { FormWorkChip } from '../FormWorkChip';
import { RAID_COOLDOWN, raidForce, raidTarget } from '../../game/sim/survivors';
import { pickOnMap, pivotToSystem, sendFromSystems } from '../screens/Lists';
import { loreView } from '../screens/Story';
import { siteValue } from '../../game/sim/sites';
import { SiteStrip, bestOf, needOf, starSites, worldSites, type Need, type Sites } from '../siteStrip';
import { YIELDS, yieldText, yieldTip } from '../yields';
import { survivorPeople, survivorWorld } from '../../game/sim/homes';
import { residentsSeen, seenThere } from '../../game/sim/claims';
import { spinSharers } from '../../game/sim/ways';
import { EXPLORE_RESERVE, FORTIFY_BONUS, LANCE_SPEED, LIVING_WORLD, isLance, isWarFleet, naturalKinRoom } from '../../game/sim/fleets';
import { sfx } from '../../audio/sfx';
import { focusTitle, lowVision, pressable, useWholeScroll } from '../a11y';
import { MATTER_DISSOLVES, calendarEra, fateOf } from '../../game/fate';
import { flowing, keeping, nextToFlow } from '../../game/sim/flow';
import { livedShare, turnStep, turnsUntilYears } from '../../game/sim/flare';

export function Drawer({ s }: { s: GameState }) {
  void rev.value;
  // (choosing a destination folds a phone's panel away: the view's slide for it is measured again)
  void targeting.value;
  const ref = useRef<HTMLElement>(null);
  const whole = useWholeScroll(ref, '.drawer-head', '.drawer-body');
  // On a phone the panel covers part of the map: slide the view so what is selected stays in
  // sight (and can be tapped again) in what is left. Upright, that is between the top bar and
  // the sheet; held sideways, to the left of the panel.
  useLayoutEffect(() => {
    const place = () => {
      const eng = engine();
      const el = ref.current;
      if (!eng) return;
      const r = el?.getBoundingClientRect();
      // (the magnifier mode's column is beside the map, not over it)
      if (!el || !r || r.height === 0 || !isPhone() || lowVision()) {
        eng.setFocusY(null);
        eng.setSheetFocusX(null);
        return;
      }
      if (window.innerWidth > 760) {
        eng.setFocusY(null);
        eng.setSheetFocusX(r.left > window.innerWidth * 0.3 ? r.left / 2 : null);
        return;
      }
      eng.setSheetFocusX(null);
      const top = (document.querySelector('.resources') as HTMLElement | null)?.getBoundingClientRect().bottom ?? 0;
      eng.setFocusY(r.top - top > 80 ? (top + r.top) / 2 : null);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  });
  useEffect(
    () => () => {
      engine()?.setFocusY(null);
      engine()?.setSheetFocusX(null);
    },
    [],
  );
  const sel = selection.value;
  // the magnifier mode: whatever is chosen, the focus (and a magnifier following it) goes to its panel
  useEffect(() => {
    if (lowVision() && sel) focusTitle(ref.current?.querySelector('.drawer-head h2'));
  }, [sel?.kind, sel?.id]);
  // a phone's sheet: what was just picked on the map opens it small, so the map stays in view;
  // anything chosen from a list or a button, at the size last set with its handle
  useEffect(() => {
    if (!sel) return;
    const key = `${sel.kind}:${sel.id}`;
    if (sheetHint.mapKey === key) {
      sheetHint.mapKey = null;
      sheetSize.value = 0;
    } else sheetSize.value = hudPrefs.value.sheet ?? 1;
  }, [sel?.kind, sel?.id]);
  const size = sheetSize.value;
  if (!sel) return null;
  let body: preact.JSX.Element | null = null;
  if (sel.kind === 'system' && s.systems[sel.id]) body = <SystemPanel s={s} sys={s.systems[sel.id]} />;
  else if (sel.kind === 'body' && s.bodies[sel.id]) {
    const b = s.bodies[sel.id];
    // (a settlement of another civilization is its world to us, not a settlement of ours)
    const c = b.colonyId ? ownColony(s, b.colonyId) : undefined;
    body = c ? <ColonyPanel s={s} c={c} /> : <BodyPanel s={s} b={b} />;
  } else if (sel.kind === 'fleet' && s.fleets[sel.id]) body = <FleetPanel s={s} f={s.fleets[sel.id]} />;
  else if (sel.kind === 'swarm' && s.swarms[sel.id]) body = <SwarmPanel s={s} sw={s.swarms[sel.id]} />;
  if (!body) return null;
  return (
    <aside ref={ref} class={`drawer panel s${size}${whole ? ' whole' : ''}`} aria-label="Selection">
      <SheetHandle panel={ref} size={size} />
      <button class="btn ghost small drawer-close" aria-label="Close" onClick={() => { selection.value = null; engine()?.select(null); }}>
        <Icon name="close" />
      </button>
      {body}
    </aside>
  );
}

const SHEET_NAMES = ['small', 'half the screen', 'the whole screen'];

/**
 * A phone's sheet handle (hidden elsewhere: styles.css). Tap: the next size up, from the
 * largest back to the smallest. Drag: any height, settling on the nearest size when let go.
 */
function SheetHandle({ panel, size }: { panel: { current: HTMLElement | null }; size: 0 | 1 | 2 }) {
  const drag = useRef<{ id: number; y: number; h: number; moved: number } | null>(null);
  const settle = (to: 0 | 1 | 2) => {
    sheetSize.value = to;
    setHudPrefs({ sheet: to });
  };
  // the heights the three sizes come to now (as their max-heights in styles.css: shares of the
  // room between the top bar and the sheet's foot)
  const heights = (el: HTMLElement): number[] => {
    const top = document.querySelector('.resources')?.getBoundingClientRect().bottom ?? 0;
    const room = (el.getBoundingClientRect().bottom - top - 8) / uiFactor();
    return [0.36, 0.72, 1].map((k) => k * room);
  };
  return (
    <button
      class="sheet-handle"
      aria-label={`Panel size: ${SHEET_NAMES[size]}. Tap for ${SHEET_NAMES[size === 2 ? 0 : size + 1]}, or drag.`}
      onPointerDown={(e) => {
        const el = panel.current;
        if (!el) return;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { id: e.pointerId, y: e.clientY, h: el.getBoundingClientRect().height / uiFactor(), moved: 0 };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        const el = panel.current;
        if (!d || d.id !== e.pointerId || !el) return;
        const dy = (e.clientY - d.y) / uiFactor();
        d.moved = Math.max(d.moved, Math.abs(dy));
        if (d.moved < 6) return;
        const [lo, , hi] = heights(el);
        el.style.maxHeight = `${Math.max(lo * 0.6, Math.min(hi, d.h - dy))}px`;
      }}
      onPointerUp={() => {
        const d = drag.current;
        const el = panel.current;
        drag.current = null;
        if (!d || !el) return;
        if (d.moved < 6) {
          sfx('click');
          settle(size === 2 ? 0 : ((size + 1) as 1 | 2));
          return;
        }
        // the nearest size to where it was let go
        const h = el.getBoundingClientRect().height / uiFactor();
        const hs = heights(el);
        el.style.maxHeight = '';
        const near = hs.reduce((best, x, i) => (Math.abs(x - h) < Math.abs(hs[best] - h) ? i : best), 0) as 0 | 1 | 2;
        settle(near);
      }}
      onPointerCancel={() => {
        drag.current = null;
        if (panel.current) panel.current.style.maxHeight = '';
      }}
    >
      <i />
    </button>
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
        const c = b.colonyId ? ownColony(s, b.colonyId) : null;
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
  const T = primaryTemperature(sys.primary, s.years, calendarEra(s), decayWarmth(s), curvatureWarmth(s), haloDrawn(s));
  const province = s.provinces.find((x) => x.id === sys.provinceId);
  const fleetsHere = fleets(s).filter((f) => f.at === sys.id);
  // the swarms we see here (a sleeping one only with Hunger Studies: sight.ts)
  const seenSwarm = swarmSight(s);
  const swarms = Object.values(s.swarms).filter((w) => w.systemId === sys.id && seenSwarm(w));
  // another civilization here: at its first star, or where the light of its arrival has reached us
  const survivor = Object.values(s.survivors).find((v) => v.alive && v.systems.includes(sys.id) && (v.homeSystemId === sys.id || seenThere(s, v, sys.id)));
  const outpost = !!survivor && survivor.homeSystemId !== sys.id;
  const survivorHome = survivor && known === 2 ? survivorWorld(s, survivor, sys.id) : null;
  const fc = s.civ.forecasts.filter((f) => f.systemId === sys.id);
  const d = distFromCapital(s, sys);
  // our settlements here, and those marked to be given a governor (27 Oct, the player: "allow me to
  // mark different worlds in system view to set the governor to"); the marks are this star's only
  const ours = sys.bodies.map((id) => s.bodies[id]?.colonyId).map((id) => (id ? ownColony(s, id) : null)).filter((c): c is Colony => !!c);
  const [marks, setMarks] = useState<{ sys: string; ids: string[] }>({ sys: '', ids: [] });
  const marked = marks.sys === sys.id ? marks.ids.filter((id) => ours.some((c) => c.id === id)) : [];
  const mark = (id: string, on: boolean) => setMarks({ sys: sys.id, ids: on ? [...marked.filter((x) => x !== id), id] : marked.filter((x) => x !== id) });
  const markedGov = marked.map((id) => s.colonies[id]?.governor ?? null);
  const govValue = markedGov.every((g) => g === markedGov[0]) ? markedGov[0] : 'mixed';
  return (
    <>
      <div class="drawer-head">
        <div class="eyebrow">{province?.name ?? 'The Coalescence'}{sys.ejected ? ' · cast out into the void' : ''}</div>
        <h2>{sys.name}</h2>
        <div class="row wrap" style={{ marginTop: '6px' }}>
          <span class="chip"><Icon name={primaryIcon(sys.primary.kind)} /> {PRIMARY_NAME[sys.primary.kind]}</span>
          {known < 2 && <span class="chip warn">{known === 1 ? 'not surveyed' : 'unknown'}</span>}
          {(sys.rust ?? 0) > 0.05 && <span class="chip danger" data-tip={rustTip(s, sys)}>rust {pct(sys.rust ?? 0)}</span>}
          {sys.beacon && (
            <>
              <span class="chip neon" data-tip={`A decoy beacon burns here, drawing swarms away from us. It costs ${BEACON_UPKEEP} energy a turn at the Tide to keep burning, and goes dark if we stop feeding it or run short.`}>
                decoy beacon
              </span>
              <button class="btn small" data-tip="Stop feeding it: it goes dark at once." onClick={() => act((g) => putOutBeacon(g, sys.id)) && sfx('click')}>
                Put out
              </button>
            </>
          )}
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
                  const c = b.colonyId ? ownColony(s, b.colonyId) : null;
                  const hab = b.habitability * b.vitality;
                  return (
                    <div key={b.id} class="list-item" {...pressable(() => selectBody(b))}>
                      {c && (
                        <label class="world-mark" data-tip={`Mark ${c.name} to give it a governor`} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={marked.includes(c.id)} aria-label={`Mark ${c.name}`} onChange={(e) => mark(c.id, (e.target as HTMLInputElement).checked)} />
                        </label>
                      )}
                      <Icon name={bodyIcon(b.kind)} cls={c ? 'neon' : hab >= LIVING_WORLD ? 'boon' : ''} />
                      <span class="grow">
                        {c ? c.name : b.name} <span class="faint" style={{ fontSize: '12.5px' }}>{bodyKindName(s, b)}</span>
                        {c && <FormWorkChip c={c} industry={p.perColony[c.id]?.y.industry ?? 0} />}
                        {c && <GovernorChip s={s} c={c} />}
                      </span>
                      {b.relic && b.relic.state !== 'hidden' && <Icon name="relic" cls={b.relic.flowed ? '' : 'accent'} />}
                      {survivor && survivorHome?.id === b.id && (
                        <span data-tip={`${survivor.contact ? survivor.name : 'Someone'} live${survivor.contact ? '' : 's'} here`} style={{ width: '9px', height: '9px', background: survivor.color, display: 'inline-block' }} />
                      )}
                      {b.rogue && <span class="chip warn">rogue</span>}
                      {b.feeding && <span class="chip boon">feeding</span>}
                      {c ? (
                        <span class="mono neon" style={{ fontSize: '13.5px' }} data-tip="People living here">{popsOf(c)}</span>
                      ) : b.kind !== 'deep' ? (
                        <span class={`mono ${hab >= LIVING_WORLD ? 'boon' : 'faint'}`} style={{ fontSize: '12.5px' }} data-tip="Habitable: habitability × vitality">{pct(hab)}</span>
                      ) : null}
                      <Icon name="arrow_right" cls="faint" />
                    </div>
                  );
                })}
            </div>
            {ours.length > 0 && (
              <div class="governor-bar" style={{ marginTop: '6px' }}>
                <div class="row" style={{ gap: '6px', fontSize: '12.5px' }}>
                  <span class="grow faint" data-tip={GOVERNOR_TIP}>
                    {marked.length ? `${marked.length} marked: give ${marked.length > 1 ? 'them' : 'it'} a governor` : 'Mark our settlements here to give them a governor'}
                  </span>
                  {ours.length > 1 && (
                    <button class="btn ghost small" onClick={() => setMarks({ sys: sys.id, ids: marked.length === ours.length ? [] : ours.map((c) => c.id) })}>
                      {marked.length === ours.length ? 'Unmark all' : 'Mark all'}
                    </button>
                  )}
                </div>
                {marked.length > 0 && (
                  <GovernorPicker
                    value={govValue}
                    label="Governor of the marked settlements"
                    onPick={(k) => {
                      if (act((g) => setGovernor(g, marked, k))) sfx('click');
                      setMarks({ sys: sys.id, ids: [] });
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}
        <p class="flavor" style={{ margin: '8px 0' }}>{src.label}.</p>
        <dl class="kv">
          <dt>Light for collectors</dt>
          {src.alive && src.alive[1] > s.years && src.alive[1] < s.years + p.turnYears && s.civ.flags.star_flash !== src.alive[1] ? (
            <dd class="mono warn" data-tip="It burns out within the coming turn, so collectors catch its light only for that sliver of it. Keeping time with it (one turn, a flash, when it is too brief for more) lives the turn in its light.">
              {`burns ${formatYears(src.alive[1] - s.years)} of a ${formatYears(p.turnYears)} turn`}
            </dd>
          ) : (
            <dd class="mono" data-tip="How much a light collector here gathers compared with its rating.">{src.light > 0 ? `×${mult(src.light)}` : 'none'}</dd>
          )}
          {(sys.primary.kind === 'black_hole' || sys.primary.kind === 'smbh') && (
            // the disk's light in Suns, from what its collectors gather, so the two agree (the player, 16 Oct: "find a way to quantify black hole accretion disk brightness")
            <>
              <dt data-tip={DISK_TIP}>Disk luminosity</dt>
              <dd class="mono" data-tip={`${DISK_TIP}${src.light > 0 ? `\nAs collectors here gather it, ×${mult(src.light)} their rating: in this age one unit of light is ${mult(lightUnitSuns(calendarEra(s)))} L☉.` : ''}`}>
                {src.light > 0 ? `${mult(src.light * lightUnitSuns(calendarEra(s)))} L☉` : 'dark'}
              </dd>
            </>
          )}
          {T > 0 && (
            <>
              <dt data-tip={tempTip(s, sys)}>{sys.primary.kind === 'black_hole' || sys.primary.kind === 'smbh' ? 'Hawking temperature' : 'Temperature'}</dt>
              <dd class="mono" data-tip={tempTip(s, sys)}>{kelvin(T)}</dd>
            </>
          )}
          {sys.primary.kind !== 'void' && sys.primary.kind !== 'rogue' && (
            <>
              <dt>Mass</dt>
              <dd class="mono">{solarMass(sys.primary.mass)} M☉</dd>
            </>
          )}
          {(sys.primary.kind === 'black_hole' || sys.primary.kind === 'smbh') && sys.primary.evaporateAt && sys.primary.evaporateAt > s.years && (
            <EvaporatesRow s={s} at={sys.primary.evaporateAt} />
          )}
          {sys.primary.spinMax > 0 && (
            <>
              <dt data-tip={spinSharers(s, sys.id).length ? (s.settings.civsAsleep ? 'In the Black Hole Age a hole’s spin is a commons: others living here draw on it as we do (a partner only half what it could), and it does not come back.' : 'A hole’s spin is a commons: others living here draw on it with Penrose Harvesters of their own, as we do, and it does not come back.') : undefined}>Spin reservoir</dt>
              <dd class="mono">
                {pct(sys.primary.spin / sys.primary.spinMax)}
                {(() => {
                  const others = spinSharers(s, sys.id).filter((v) => v.contact && (v.homeSystemId === sys.id || seenThere(s, v, sys.id)));
                  return others.length ? ` · shared with ${others.map((v) => v.name).join(', ')}` : '';
                })()}
              </dd>
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
              <div key={f.uid} class={`row ${f.severity === 'danger' ? 'bad' : f.severity === 'boon' ? 'boon' : 'warn'}`} style={{ fontSize: '13.5px', alignItems: 'flex-start' }} data-tip={f.text}>
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
              style={{ fontSize: '14.5px' }}
              role={survivorHome ? 'button' : undefined}
              onClick={() => survivorHome && selectBody(survivorHome)}
              data-tip={survivorHome ? `They live ${survivorHome.kind === 'deep' ? 'in orbital habitats in the Deep' : `on ${survivorHome.name}`}. Click to look at it.` : ''}
            >
              <span style={{ width: '10px', height: '10px', background: survivor.color, display: 'inline-block' }} />
              <span class="grow">
                {survivor.name}
                {survivorHome && <span class="faint" style={{ fontSize: '12.5px' }}> · {survivorHome.kind === 'deep' ? 'in the Deep' : `on ${survivorHome.name}`}</span>}
              </span>
              <span class="faint">{!survivor.contact ? 'not contacted' : outpost ? 'a settlement of theirs' : survivorPeople(survivor)}</span>
            </div>
          </div>
        )}
        {known === 1 && (
          <p class="dim" style={{ fontSize: '13.5px' }}>
            Seen from afar: the star is known, its worlds are not. Send any ship to survey it (probes are the cheapest, and see farthest).
          </p>
        )}
        <WarHere s={s} sys={sys} />
        {(fleetsHere.length > 0 || swarms.length > 0) && (
          <div class="section">
            <h3>In orbit</h3>
            <div class="list">
              {fleetsHere.map((f) => (
                <div key={f.id} class="list-item" {...pressable(() => { selection.value = { kind: 'fleet', id: f.id }; engine()?.select(f.id); })}>
                  <Icon name="fleet" cls="neon" /> <span class="grow">{f.name}</span> <span class="faint">{f.ships.length} ship{f.ships.length > 1 ? 's' : ''}</span>
                </div>
              ))}
              {swarms.map((w) => (
                <div key={w.id} class="list-item" {...pressable(() => { selection.value = { kind: 'swarm', id: w.id }; engine()?.select(w.id); })}>
                  <Icon name="warning" cls={w.tamed ? 'neon' : w.awake ? 'bad' : 'faint'} /> <span class="grow">{w.tamed ? 'Tamed swarm' : w.awake ? 'Hunger swarm' : 'Hunger swarm, asleep'}</span> <span class="mono faint">size {n1(w.size)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/** What a dead star's temperature means, and what it would be if protons decay, while we do not know. */
/** What a black hole's disk luminosity is. */
const DISK_TIP = 'The light of its accretion disk: gas falling into the hole glows as it goes in. A lone stellar hole has only a faint trickle of gas, and in the dark of the later ages next to none. The Heart’s crowded core feeds it far more while its stars last, then less as they die. A world falling in gives a flash, within the turn, that only a Burst Catcher holds on to.';

function tempTip(s: GameState, sys: StarSystem): string {
  const k = sys.primary.kind;
  if (k === 'black_hole' || k === 'smbh') return 'A black hole glows at its Hawking temperature, colder the heavier it is: a few hundredths of a microkelvin for one of a few Suns. It gives almost nothing, but it gives it until it is gone.';
  const dead = k === 'white_dwarf' || k === 'black_dwarf' || k === 'brown_dwarf' || k === 'neutron_star';
  if (!dead || calendarEra(s) === 'dusk') return '';
  const base = `Nothing warms a dead star but dark matter falling into it while the halo lasts, a world falling in, and its own last heat, which it loses slowly${k === 'neutron_star' ? ' (as T ≈ K·t^-½, with no envelope to hold it in)' : ', its envelope holding it in'}.${curvatureWarmth(s) ? ` Space itself turns its mass into particles, and those made inside it warm it: ${k === 'neutron_star' ? 'about 30 nK' : k === 'brown_dwarf' ? 'a few femtokelvin' : 'a few tenths of a picokelvin to a few picokelvin, the denser the warmer'} (Falcke, Wondrak & van Suijlekom 2025).` : ''} What we can gather goes as T⁴: a thousand times colder is a million million times less.`;
  if (protonFateKnown(s) || sys.primary.rekindle) return base;
  return `${base}\nIf protons decay, their warmth would hold it near ${k === 'neutron_star' ? '1.5 K' : k === 'brown_dwarf' ? '9 mK' : '0.05 K'}. Until we know (the Proton Question), this is the prediction without it.`;
}

/** A temperature, with Celsius where people would feel it. */
function kelvinC(k: number): string {
  const c = k - 273.15;
  return c > -120 && c < 200 ? `${n0(k)} K (${c > 0 ? '+' : ''}${n0(c)} °C)` : kelvin(k);
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
  return `The Hunger's rust: how much a swarm has fed here. It builds while one eats (4% a turn at the Tide, more for a bigger swarm), and fades by a tenth a turn at the Tide once no swarm is there: as much in a year at any pace. The rust itself does no harm; the harm is what was eaten, the worlds' mineral richness and hydrogen, which never grow back. ${feeding ? 'A swarm is feeding here now.' : 'No swarm is feeding here now.'}`;
}

/** A living world without a sun: cooling as its dead star fades, or freezing, and how long it has. */
/** A settlement's world as terraformed, where it keeps mirrors or an air going (sim/terraform.ts). */
function TerraformedRow({ s, c }: { s: GameState; c: Colony }) {
  const b = s.bodies[c.bodyId];
  const kept = (['orbital_mirrors', 'atmosphere_works'] as const).filter((id) => (c.structures[id] ?? 0) > 0);
  if (!b || !kept.length) return null;
  const t = terraformSummary(s, b, c);
  const names = kept.map((id) => STRUCTURE_BY_ID[id].name).join(' and ');
  const raised = t.now > t.own;
  const more = kept.length === 1 && t.full > t.now + 0.005 ? ` With ${kept[0] === 'orbital_mirrors' ? 'Atmosphere Works' : 'Orbital Mirrors'} too it would be ${pct(t.full)}.` : '';
  const tip = !terraformLit(s, b)
    ? 'Its own habitability: terraforming does nothing here now (it runs on a red dwarf’s steady light, in the Long Dusk only).'
    : raised
      ? `${pct(t.own)} of its own, raised by ${names}: its warmest ground is ${Math.round(t.warmth)} K.${more} Terraforming makes a world at most ${pct(TERRAFORM_CEILING)} habitable.`
      : `${names} cannot make it more livable: its warmest ground is ${Math.round(t.warmth)} K.${more}`;
  return (
    <>
      <dt data-tip={tip}>Habitability</dt>
      <dd class={raised ? 'mono good' : 'mono'} data-tip={tip}>{raised ? `${pct(t.now)}, terraformed` : pct(t.now)}</dd>
    </>
  );
}

/** How seeded life on a world of ours is doing (sim/terraform.ts), or undefined if none is seeded. */
function seededTip(s: GameState, b: Body): string | undefined {
  const c = b.colonyId ? ownColony(s, b.colonyId) : undefined;
  if (!c || !((c.structures.biosphere_seeding ?? 0) > 0)) return undefined;
  return seedingGrowth(s, b, c) > 0
    ? `Seeded life is spreading: +${Math.round(SEED_RATE * 100)}% a turn at the Tide, up to ${Math.round(SEED_CAP * 100)}%.`
    : b.vitality >= SEED_CAP - 1e-9
      ? `Seeded life has spread as far as it can (${Math.round(SEED_CAP * 100)}%).`
      : seededLifeUnkept(s, b, c) || !terraformLit(s, b)
        ? 'Seeded life cannot spread now: nothing keeps the world warm.'
        : `Seeded life cannot spread now. ${seedingBlocked(s, b, c) ?? ''}`;
}

function FreezingRow({ s, b, c }: { s: GameState; b: Body; c?: Colony }) {
  const tip = seededLifeUnkept(s, b, c)
    ? 'Life seeded on a dead world lives on the warmth the terraforming gives it. With its star flaring or dead, or its Orbital Mirrors and Atmosphere Works both gone, it freezes: 5% of its vitality a turn at the Tide (half that with a Core Stimulator; a tenth of it a turn at Quick ×10).'
    : `A living world whose star has died cools as the light fades. Once even its warmest ground is below ${FROZEN_K} K it freezes: 5% of its vitality a turn at the Tide (half that with a Core Stimulator; a tenth of it a turn at Quick ×10), and when none is left it is an ice world or bare rock. After the Last Light every living world freezes so, as does one cast out of its system. Orbital Lamps keep one warm and alive.`;
  // (in turns at our pace)
  const n = turnsToFreeze(s, b, c, livedShare(s));
  if (isFinite(n)) {
    return (
      <>
        <dt data-tip={tip}>Freezing</dt>
        <dd class="mono bad" data-tip={tip}>{`dies in about ${n} turn${n === 1 ? '' : 's'}`}</dd>
      </>
    );
  }
  if (calendarEra(s) !== 'dusk' || !sunGone(s, b) || lampsOver(s, b, c)) return null;
  return (
    <>
      <dt data-tip={tip}>Cooling</dt>
      <dd class="warn" data-tip={tip}>its star is dead</dd>
    </>
  );
}

/**
 * A world's traits as shown: a rogue world is no longer locked to any star, and an ocean is buried
 * only while ice is left over it, not once even the coldest ground has thawed (a flare's open sea)
 * or boiled (a steam world). A twilight sea keeps its ice, and its ocean, on the night side.
 */
function shownTraits(s: GameState, b: Body): string[] {
  const c = bodyClimate(s, b);
  const p = s.systems[b.systemId]?.primary;
  const alone = !!b.rogue || !p || p.kind === 'rogue' || p.kind === 'void';
  // what the world was given once, shown only while it is still so
  const past = (t: string): boolean => {
    switch (t) {
      case 'tidally_locked':
        return alone || b.kind === 'asteroids';
      case 'subsurface_ocean':
        return !buriedOcean(s, b, c);
      case 'water_rich':
        return (b.water ?? 0) < WATER_RICH;
      case 'vent_life':
      case 'warm_rogue':
        return b.vitality <= 0;
      case 'clathrates':
        return !!c.steam || (c.day ?? c.mean) >= ICE_MELTS_K;
      case 'resonance':
        return alone;
      case 'outer':
      case 'hole_world':
        return true; // (a mark for the rules, not a find)
      default:
        return false;
    }
  };
  return b.traits.filter((t) => !past(t));
}

/** When a black hole has evaporated: what is settled there drifts on, with nothing left there to draw on. */
function EvaporatesRow({ s, at }: { s: GameState; at: number }) {
  const turns = turnsUntilYears(s, at);
  const tip = `When its Hawking radiation has carried off all its mass: about 2×10⁶⁷ years for a hole of one Sun, a thousand times longer for ten, the lightest first. ${
    turns <= 1 ? 'At this pace it goes during this turn.' : isFinite(turns) ? `At this pace in ${turns} turns.` : 'At this pace further off than we can foresee.'
  } What is settled here drifts on after it, with nothing left here to draw on.`;
  return (
    <>
      <dt data-tip={tip}>Evaporates</dt>
      <dd class={`mono ${turns <= 1 ? 'warn' : ''}`} data-tip={tip}>
        in {formatYears(at - s.years)}
        {turns <= 1 ? ', this turn' : isFinite(turns) ? ` · ${turns} turns` : ''}
      </dd>
    </>
  );
}

/** When a world reaches its dead star's tidal limit: never for a rogue world, which has no star to fall into. */
function FallsInwardRow({ s, b }: { s: GameState; b: Body }) {
  if (!b.inspiralAt || !isFinite(b.inspiralAt) || b.feeding) return null;
  // around a star that never takes its worlds in (in a game begun before 19 Oct, a brown dwarf or
  // a black hole: physics.ts, NEVER_FEED), or once the date has passed without it, say nothing
  const at = fallsInAt(s, b);
  if (!b.rogue && (!isFinite(at) || at <= s.years)) return null;
  if (b.rogue) {
    const tip = 'Flung loose from its star, it drifts on its own: it has no star to fall into.';
    return (
      <>
        <dt data-tip={tip}>Falls inward</dt>
        <dd data-tip={tip}>never: adrift</dd>
      </>
    );
  }
  const kind = s.systems[b.systemId]?.primary.kind;
  // what then becomes of it, in a game begun since 20 Oct (physics.ts: rubbleGame)
  const then = !rubbleGame(s)
    ? ''
    : giantWorld(b)
      ? ' Its gas then pours in, in a flash that melts what is near: the forecasts say how far, and what our settlements there need.'
      : kind === 'black_hole'
        ? ' The hole takes all of its rubble within the turn: a faint flash, harming nothing, that Burst Catchers bank.'
        : ' It is torn into a ring of rubble, richer to mine than the world was, which rains onto the star.';
  const tip =
    (kind === 'black_hole'
      ? 'When gravitational-wave orbital decay brings it close enough for the black hole’s tides to tear it apart.'
      : kind === 'brown_dwarf'
        ? 'When gravitational-wave orbital decay brings it to the brown dwarf’s tidal limit.'
        : "When gravitational-wave orbital decay brings it to its dead star's tidal limit.") + then;
  return (
    <>
      <dt data-tip={tip}>Falls inward</dt>
      <dd class="mono">{formatYears(at)}</dd>
    </>
  );
}

/** A world its new star is boiling away (or its giant swallowing): gone as this turn ends. */
function BoilingRow({ s, b }: { s: GameState; b: Body }) {
  const boil = boilingAway(s, b);
  if (!boil) return null;
  const tip =
    boil === 'swallowed'
      ? 'A helium giant swells to some 25 times the Sun’s size (0.116 AU). Every world orbiting inside it is swallowed, gas giants too.'
      : 'A helium star pours out ultraviolet: a world whose warmest ground passes 3,000 K has its rock vapour stripped off into space, and rubble evaporates from 1,600 K (from 1,800 K under a giant). Gas and ice giants are spared. Our people there get off to the Deep, three in four.';
  return (
    <>
      <dt data-tip={tip}>{boil === 'swallowed' ? 'Swallowed' : 'Boiling away'}</dt>
      <dd class="mono bad" data-tip={tip}>gone as this turn ends</dd>
    </>
  );
}

/** A world with no star to orbit: cast out of its system, or born in a starless one. */
function starless(s: GameState, b: Body): boolean {
  return !!b.rogue || s.systems[b.systemId]?.primary.kind === 'rogue';
}

/** Temperature and water rows for a world's key/value list (a giant's temperature only: it has no surface). */
function ClimateRows({ s, b }: { s: GameState; b: Body }) {
  if (b.kind === 'deep') return null;
  const giant = b.kind === 'gas_giant' || b.kind === 'ice_giant';
  const c = bodyClimate(s, b);
  const curved = curvatureWarmth(s) ? ' Under curvature radiation space turns its mass into particles, and those made inside it keep it a few tenths of a femtokelvin warm (Falcke, Wondrak & van Suijlekom 2025).' : '';
  const tip = giant
    ? `At the cloud tops: from starlight (by a black hole, its disk’s) and what is left of its own heat, and far from any star the galaxy’s faint glow.${curved}`
    : `From starlight (by a black hole, its disk’s), the world’s own heat and what is left of its air, and far from any star the galaxy’s faint glow (about 1 K in the Dusk). Tidally locked worlds keep a hot day side and a cold night side.${curved}`;
  return (
    <>
      <dt data-tip={tip}>Temperature</dt>
      <dd class="mono" data-tip={c.day !== undefined ? `Day side ${kelvinC(c.day)}\nNight side ${kelvinC(c.night!)}` : ''}>
        {c.day !== undefined && kelvin(c.day) !== kelvin(c.night!) ? `${kelvin(c.night!)} to ${kelvin(c.day)}` : kelvinC(c.mean)}
      </dd>
      {!giant && (
        <>
          <dt>Water</dt>
          <dd style={{ fontSize: '13.5px' }}>{waterState(b, c, buriedOcean(s, b, c))}</dd>
        </>
      )}
      {b.kind !== 'gas_giant' && <SunlightRow s={s} b={b} />}
    </>
  );
}

/** Sunlight on the surface: none without a star, or from one that gives nothing; capped values marked. */
function SunlightRow({ s, b }: { s: GameState; b: Body }) {
  const tip = 'Sunlight on the surface compared with the star’s standard orbit, by the inverse-square law. Surface Solar Arrays collect this much of the star’s light (at most ×2.5, at least ×0.05); orbital collectors catch it anywhere.';
  const sys = s.systems[b.systemId];
  let text: string;
  let more = '';
  if (starless(s, b)) text = 'none: no star';
  else if (!(sourceLight(s, sys, s.years, project(s).turnYears).light > 0)) text = 'none: its star gives none';
  else {
    const raw = insolationByDistance(s, b);
    const got = insolation(s, b);
    text = `×${mult(got)}${raw > got * 1.01 ? ' (most)' : raw < got * 0.99 ? ' (least)' : ''}`;
    if (raw > got * 1.01 || raw < got * 0.99) more = `\nBy distance alone ×${mult(raw)}; surface arrays collect ×${mult(got)}.`;
  }
  return (
    <>
      <dt data-tip={tip + more}>Sunlight</dt>
      <dd class="mono" data-tip={more.trim() || undefined}>{text}</dd>
    </>
  );
}

// ------------------------------------------------------------------ uninhabited body

function BodyPanel({ s, b }: { s: GameState; b: Body }) {
  void rev.value; // mutable game state: re-render on every change
  const sys = s.systems[b.systemId];
  const surveyed = s.civ.known[sys.id] === 2;
  const settlers = fleets(s).filter((f) => f.at && f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles && (!SHIP_BY_ID[x.cls]?.inSystem || f.at === b.systemId)));
  const residents = surveyed ? residentsSeen(s, b) : null;
  return (
    <>
      <div class="drawer-head">
        <div class="eyebrow">
          <span style={{ cursor: 'pointer' }} {...pressable(() => selectSystem(sys.id))}>{sys.name}</span> · <span data-tip={bodyKindNote(s, b)}>{bodyKindName(s, b)}</span>
        </div>
        <h2>{b.name}</h2>
        {residents && (
          <div class="row" style={{ marginTop: '4px', fontSize: '14.5px', gap: '6px' }} data-tip={residents.contact ? `${residents.name}: ${WAY_NAME[residents.way] ?? ''}. Their world cannot be settled; it can only be taken, or left to them.` : 'Someone lives here. We have not made contact with them yet.'}>
            <span style={{ width: '10px', height: '10px', background: residents.color, display: 'inline-block' }} />
            <span>
              {residents.contact ? (
                <>
                  {residents.homeSystemId === b.systemId ? 'Home of' : 'A settlement of'} <b>{residents.name}</b>{' '}
                  <span class="faint">
                    · {residents.homeSystemId === b.systemId ? survivorPeople(residents) : 'settled from their first star'}
                    {b.kind === 'deep' ? ', in orbital habitats' : ''}
                  </span>
                </>
              ) : (
                'Someone lives here.'
              )}
            </span>
          </div>
        )}
        <div class="row wrap" style={{ marginTop: '6px' }}>
          {shownTraits(s, b).map((t) =>
            EVENT_BY_ID[`anom_${t}`] ? (
              <button key={t} class="chip lore" data-tip={`${TRAIT_NAME[t]?.[1] ?? ''}\nClick to read the survey report again.`} onClick={() => { sfx('open'); loreView.value = { defId: `anom_${t}`, bodyId: b.id }; }}>
                <Icon name="relic" /> {TRAIT_NAME[t]?.[0] ?? t}
              </button>
            ) : (
              <span key={t} class="chip" data-tip={TRAIT_NAME[t]?.[1] ?? ''}>{TRAIT_NAME[t]?.[0] ?? t}</span>
            ),
          )}
          {b.rogue && <span class="chip warn" data-tip="Flung loose from its star, usually by a close stellar pass: only its own heat is left, and it has no star to fall into.">rogue</span>}
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
            <BoilingRow s={s} b={b} />
            {b.kind !== 'deep' && b.kind !== 'gas_giant' && b.kind !== 'ice_giant' && (
              <>
                <dt data-tip="Kin the world holds by itself: about 12 × habitability × vitality, rounded down (a third of that on a rogue or feeding world). Below about 8% habitability × vitality there is no room, nor where even its warmest ground averages under −14.9 °C (the yearly mean of Oymyakon, the coldest town people live in the year round): there Kin can live only in domes, warrens or a Garden Ark.">Room for Kin</dt>
                <dd class={naturalKinRoom(b, s) > 0 ? 'mono good' : ''} style={naturalKinRoom(b, s) > 0 ? undefined : { fontSize: '13.5px' }}>
                  {naturalKinRoom(b, s) > 0 ? `${naturalKinRoom(b, s)} without domes` : tooColdForOpenAir(s, b) && !frozenHard(s, b) && b.vitality > 0 ? 'none: too cold outside, domes needed' : 'none: domes needed'}
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
            <dd class="mono">{b.kind === 'deep' ? '—' : b.rogue ? 'none: adrift' : starless(s, b) ? 'none: no star' : b.feeding ? 'at its star’s tidal limit' : `${b.orbitAU < 0.1 ? b.orbitAU.toFixed(3) : n1(b.orbitAU)} AU`}</dd>
            <dt>Mass</dt>
            <dd class="mono">{b.massEarth >= 10 ? n0(b.massEarth) : mult(b.massEarth)} M⊕</dd>
            <FallsInwardRow s={s} b={b} />
            {b.relic && b.relic.state !== 'hidden' && (
              <>
                <dt>Ruins</dt>
                <dd>
                  {EVENT_BY_ID[`relic_${b.relic.kind}`]?.title ?? b.relic.kind} · {b.relic.state}
                  {b.relic.flowed ? ', since flowed into smooth lumps' : ''}{' '}
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
                  <span class="grow" style={{ fontSize: '13.5px' }}>
                    {def.name} at {from.name}
                    <div class="faint mono" style={{ fontSize: '12.5px' }}>{ly > 0 ? `${formatDistance(ly)} · ${tripLabel(s, ly, mods, true)} · ${n0(launchCost(s, f, ly, mods))} energy` : 'here'}</div>
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
  { id: 'merge', label: 'Merge', icon: 'merge', tip: 'Two Echoes become one Chorus (8 energy). Needs a Confluence Node, or a Leptonic Confluence.', show: (_s, c) => enabledAt(c.structures, 'merge') },
  { id: 'cool', label: 'Cool', icon: 'coldminds', tip: 'One Echo becomes a Coldmind, thinking far slower and costing almost nothing to keep. Needs a Cold Vault.', show: (_s, c) => (c.structures.cold_vault ?? 0) + (c.structures.lepton_substrate ?? 0) + (c.structures.bastion ?? 0) > 0 },
  { id: 'freeze', label: 'Freeze', icon: 'cryo', tip: 'Put one Kin into Cold Sleep. Sleepers cost almost nothing and do nothing.', show: (s, c) => capacity(s, c, computeMods(s)).cryo > 0 },
  { id: 'thaw', label: 'Thaw', icon: 'wake', tip: 'Wake one sleeper.', show: (_s, c) => c.cryo > 0 },
];

/**
 * The Passage (passage.ts): this settlement rewritten in electron–positron structures before
 * matter ends, as a project in its queue. Shown once it can be foreseen and Leptonic Computation is
 * known; asks once more before it begins.
 */
function PassageSection({ s, c }: { s: GameState; c: Colony }) {
  void rev.value; // mutable game state: re-render on every change
  const [sure, setSure] = useState(false);
  const going = c.queue.find((q) => q.kind === 'passage');
  if (formOf(c) !== 'baryonic' || (!going && !(hasTech(s, 'leptonic_computation') && endForeseen(s)))) return null;
  const t = passageTerms(s, c);
  const why = going ? null : passageCheck(s, c);
  const industry = c.last?.industry ?? 0;
  const turns = industry > 0 ? Math.ceil(t.industry / industry) : Infinity;
  const left = turnsToEndOfMatter(s);
  // (under decay matter begins to dissolve a decade and a half before it is gone)
  const dissolves = fateOf(s) === 'decay' && s.eta < MATTER_DISSOLVES ? turnsToEndOfMatter(s, MATTER_DISSOLVES) : Infinity;
  // (if matter is stable it tunnels into black holes, from 10^(10^26) years, deep in the Dark Era: deeptime.ts)
  const stable = fateOf(s) === 'stable';
  const collapse = stable ? turnsToCollapse(s, s.civ.pace) : Infinity;
  const out = Math.round(PASSAGE_OUTPUT * 100);
  const what = `${t.crossing} structure${t.crossing === 1 ? '' : 's'} cross${t.crossing === 1 ? 'es' : ''} over (Energy Vaults as Field Stores, the homes of minds, harvesters at a black hole); ${t.apart} ${t.apart === 1 ? 'is' : 'are'} taken apart${t.matterBack ? ` (+${t.matterBack} matter)` : ''}.${t.kin ? ` Its ${t.kin} Kin cannot go: their patterns are kept in the archive (+${t.insight} insight).` : ''}${t.lattice ? ` ${t.lattice} of its Lattice will not survive the re-encoding.` : ''}`;
  return (
    <div class="section passage">
      <h3>The Passage</h3>
      {going ? (
        <p class="dim">
          Under way: {Math.round((going.progress / going.cost) * 100)}%, in the queue. While it is worked here, this settlement makes {out}% of its energy, matter, insight and accord.
        </p>
      ) : (
        <>
          <p class="dim">
            Rewrite this settlement in electron–positron structures held by fields, which will outlast matter: {t.industry} industry ({isFinite(turns) ? `about ${turns} turn${turns === 1 ? '' : 's'} here` : 'nothing builds here'}
            {stable
              ? isFinite(collapse)
                ? `; matter begins to tunnel into black holes in about ${collapse}`
                : '; matter, stable, tunnels into black holes from 10^(10²⁶) years, deep in the Dark Era'
              : isFinite(dissolves)
                ? `; matter begins to dissolve in about ${Math.floor(dissolves)}, and is gone in about ${Math.floor(left)}`
                : isFinite(left)
                  ? `; matter ends in about ${Math.floor(left)}`
                  : ''}
            ) and {t.energy} energy now. {what} While it is worked, the settlement makes {out}% of its energy, matter, insight and accord; then only what has a leptonic form can be built there.
          </p>
          <button
            class={`btn small ${sure ? 'danger' : ''} ${why ? 'disabled' : ''}`}
            data-tip={why ?? 'It goes into the queue as a project; taking it off gives the energy back.'}
            onClick={() => {
              if (why) return;
              if (!sure) return setSure(true);
              setSure(false);
              if (act((g) => beginPassage(g, c.id))) sfx('build');
            }}
          >
            {sure ? 'Really begin the Passage? (click again)' : 'Begin the Passage'}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * Leaving a black hole (horizon.ts): a leptonic settlement drifts to the hole the player chooses
 * (31 Oct, the player: "let me choose the hole but with recommendations and spin/lifetime
 * statistics"): every hole it could go to, the game's own choice first and marked (the most spin to
 * give of those that will last), each with its spin, how long it will last, how far it is and
 * whether a vault of ours is there; poor choices say why. Shown where it is leptonic and its hole is
 * failing it, or it is at none; asks once more.
 */
function DriftSection({ s, c }: { s: GameState; c: Colony }) {
  void rev.value; // mutable game state: re-render on every change
  const [sure, setSure] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  if (formOf(c) !== 'leptonic') return null;
  const sys = s.systems[c.systemId];
  // (only where its hole is failing it, or there is none: from a healthy hole it would go to a poorer one)
  const failing = holeFailing(s, sys);
  if (!failing) return null;
  const choices = driftChoices(s, c);
  const chosen = choices.find((x) => x.sys.id === picked) ?? choices.find((x) => x.recommended) ?? choices[0];
  const t = driftTerms(s, c, chosen?.sys.id);
  const why = chosen ? driftCheck(s, c, chosen.sys.id) : 'No black hole left to go to.';
  const p = sys.primary;
  const atHole = p.kind === 'black_hole' || p.kind === 'smbh';
  const state =
    p.kind === 'void'
      ? 'Its black hole has evaporated.'
      : !atHole
        ? 'Away from the black holes nothing it is made of gathers energy.'
        : p.spin < SPENT_SPIN
          ? 'Its black hole has no spin left to give.'
          : failing
            ? 'Its black hole will soon evaporate.'
            : '';
  const lasts = (x: DriftChoice) => {
    if (!isFinite(x.lasts)) return 'lasts beyond reckoning';
    // (in turns where they can be counted: not from an age whose turns will never reach it)
    const n = x.sys.primary.evaporateAt ? turnsUntilYears(s, x.sys.primary.evaporateAt) : Infinity;
    return `lasts ${formatYears(x.lasts)}${isFinite(n) ? ` (${n} turn${n === 1 ? '' : 's'})` : ''}`;
  };
  return (
    <div class="section drift">
      <h3>{atHole ? 'Another black hole' : 'To a black hole'}</h3>
      <p class="dim">
        {state ? `${state} ` : ''}
        {choices.length
          ? `Choose a hole to drift to, taking all it has, for ${t.energy} energy. Recommended: the most spin to give of those that will last; any is within a turn’s reach.`
          : 'No other black hole is left to go to.'}
      </p>
      {choices.length > 0 && (
        <div class="list drift-choices" role="group" aria-label="Black holes to drift to">
          {choices.map((x) => {
            const on = x.sys.id === chosen?.sys.id;
            return (
              <div
                key={x.sys.id}
                class={`list-item ${on ? 'active' : ''}`}
                aria-pressed={on}
                {...pressable(() => {
                  setPicked(x.sys.id);
                  setSure(false);
                  sfx('click');
                })}
              >
                <span class="grow">
                  {x.sys.name}
                  {x.recommended && (
                    <span class="chip neon" style={{ marginLeft: '6px' }} data-tip="The game’s own choice: the most spin to give of the holes that will last">
                      recommended
                    </span>
                  )}
                  {x.ours && (
                    <span class="chip" style={{ marginLeft: '6px' }} data-tip="A vault of ours is there: it would join it, and share its spin">
                      our vault
                    </span>
                  )}
                  {x.poor && <span class="chip warn" style={{ marginLeft: '6px' }}>{x.poor}</span>}
                  <div class="faint mono" style={{ fontSize: '12.5px' }}>
                    spin {n0(x.spin)} · {lasts(x)} · {formatDistance(distLy(sys, x.sys))}
                  </div>
                </span>
              </div>
            );
          })}
        </div>
      )}
      {chosen && (
        <button
          class={`btn small ${sure ? 'danger' : ''} ${why ? 'disabled' : ''}`}
          style={{ marginTop: '6px' }}
          data-tip={why ?? (chosen.ours ? `It joins our vault at ${chosen.sys.name}.` : `It settles in ${chosen.sys.name}’s Deep.`)}
          onClick={() => {
            if (why) return;
            if (!sure) return setSure(true);
            setSure(false);
            setPicked(null);
            if (act((g) => driftToAnotherHole(g, c.id, chosen.sys.id))) sfx('click');
          }}
        >
          {sure ? `Really drift to ${chosen.sys.name}? (click again)` : `Drift to ${chosen.sys.name}`}
        </button>
      )}
    </div>
  );
}

/**
 * Writing into a horizon (horizon.ts): a leptonic settlement in a black hole's Deep, once Horizon
 * Writing is known, as a project in its queue; and, once written, what that means and how long the
 * hole will hold it. Asks once more before it begins.
 */
function HorizonSection({ s, c }: { s: GameState; c: Colony }) {
  void rev.value; // mutable game state: re-render on every change
  const [sure, setSure] = useState(false);
  const going = c.queue.find((q) => q.kind === 'horizon');
  const sys = s.systems[c.systemId];
  const p = sys.primary;
  const hole = p.kind === 'black_hole' || p.kind === 'smbh';
  const left = hole && p.evaporateAt ? Math.max(0, Math.log10(p.evaporateAt) - s.eta) : Infinity;
  if (formOf(c) === 'horizon')
    return (
      <div class="section horizon">
        <h3>In the horizon</h3>
        <p class="dim">
          Written into the horizon of {sys.name}: its minds cost a tenth of their upkeep and think at a quarter of their pace, with room by the hole’s mass. Bound to it{isFinite(left) ? `, which will evaporate in about ${left < 10 ? left.toFixed(1) : Math.round(left)} decades` : ''}: then they are written back out, leptonic, and drift on.
        </p>
      </div>
    );
  if (formOf(c) !== 'leptonic' || !hole || s.bodies[c.bodyId]?.kind !== 'deep' || (!going && !hasTech(s, 'horizon_writing'))) return null;
  const t = horizonTerms(c);
  const why = going ? null : horizonCheck(s, c);
  return (
    <div class="section horizon">
      <h3>The horizon</h3>
      {going ? (
        <p class="dim">Under way: {Math.round((going.progress / going.cost) * 100)}%, in the queue. While it is worked here, this settlement makes {Math.round(PASSAGE_OUTPUT * 100)}% of its energy, insight and accord.</p>
      ) : (
        <>
          <p class="dim">
            Write this settlement into the horizon of {sys.name}: {t.industry} industry and {t.energy} energy now. Its minds would cost a tenth of their upkeep and think at a quarter of their pace, bound to the hole{isFinite(left) ? ` (it will evaporate in about ${left < 10 ? left.toFixed(1) : Math.round(left)} decades)` : ''}.
          </p>
          <button
            class={`btn small ${sure ? 'danger' : ''} ${why ? 'disabled' : ''}`}
            data-tip={why ?? 'It goes into the queue as a project; taking it off gives the energy back.'}
            onClick={() => {
              if (why) return;
              if (!sure) return setSure(true);
              setSure(false);
              if (act((g) => beginHorizon(g, c.id))) sfx('build');
            }}
          >
            {sure ? 'Really write it into the horizon? (click again)' : 'Write into the horizon'}
          </button>
        </>
      )}
    </div>
  );
}

/**
 * The widest atoms (positronium.ts): a leptonic settlement, once Positronium Weaving is known and
 * the atoms have formed, can be woven through them, as a project in its queue; woven, the section
 * counts down to their decay at our pace and offers to leave the weave. Asks once more each time.
 */
function WeaveSection({ s, c }: { s: GameState; c: Colony }) {
  void rev.value; // mutable game state: re-render on every change
  const [sure, setSure] = useState(false);
  const going = c.queue.find((q) => q.kind === 'weave');
  const woven = formOf(c) === 'positronium';
  if (!woven && (formOf(c) !== 'leptonic' || !positroniumHere(s) || (!going && !hasTech(s, 'positronium_weaving')))) return null;
  const left = turnsToDecay(s);
  const when = isFinite(left) ? (left <= 1 ? 'within the next turn' : `in about ${left} turns at this pace`) : 'one day';
  if (woven) {
    const why = leaveWeaveCheck(s, c);
    const cost = leaveWeaveCost(s, c);
    return (
      <div class="section weave">
        <h3>In the weave</h3>
        <p class="dim">
          Woven through the positronium: its minds cost a fiftieth of their upkeep and think at a tenth of their pace. The atoms decay {when} {`(η\u00a0${POSITRONIUM_DECAY})`}: whoever is still woven through them then ends with them.
        </p>
        <button
          class={`btn small ${sure ? 'danger' : ''} ${why ? 'disabled' : ''}`}
          data-tip={why ?? `Back out at once, leptonic: ${cost} energy.`}
          onClick={() => {
            if (why) return;
            if (!sure) return setSure(true);
            setSure(false);
            if (act((g) => leaveWeave(g, c.id))) sfx('click');
          }}
        >
          {sure ? 'Really leave the weave? (click again)' : 'Leave the weave'}
        </button>
      </div>
    );
  }
  const t = weaveTerms(c);
  const why = going ? null : weaveCheck(s, c);
  return (
    <div class="section weave">
      <h3>The positronium</h3>
      {going ? (
        <p class="dim">Under way: {Math.round((going.progress / going.cost) * 100)}%, in the queue. While it is worked here, this settlement makes {Math.round(PASSAGE_OUTPUT * 100)}% of its energy, insight and accord. The atoms decay {when}.</p>
      ) : (
        <>
          <p class="dim">
            Weave this settlement through the positronium: {t.industry} industry and {t.energy} energy now. Its minds would cost a fiftieth of their upkeep and think at a tenth of their pace, with room to spare, until the atoms decay {when} {`(η\u00a0${POSITRONIUM_DECAY})`}. It can leave the weave at any time before.
          </p>
          <button
            class={`btn small ${sure ? 'danger' : ''} ${why ? 'disabled' : ''}`}
            data-tip={why ?? 'It goes into the queue as a project; taking it off gives the energy back.'}
            onClick={() => {
              if (why) return;
              if (!sure) return setSure(true);
              setSure(false);
              if (act((g) => beginWeave(g, c.id))) sfx('build');
            }}
          >
            {sure ? 'Really weave it through the positronium? (click again)' : 'Weave through the positronium'}
          </button>
        </>
      )}
    </div>
  );
}

function ColonyPanel({ s, c }: { s: GameState; c: Colony }) {
  void rev.value; // mutable game state: re-render on every change
  const [tab, setTab] = useState<'overview' | 'build'>('overview');
  // a structure about to be taken apart, waiting for a yes (brought into view: the panel scrolls)
  const [armed, setArmed] = useState<string | null>(null);
  const armRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (armed) armRef.current?.scrollIntoView({ block: 'center' });
  }, [armed]);
  // the idle-settlements reminder opens the Build tab, where a settlement is given work
  const wantBuild = openBuildFor.value;
  const [toBuild, setToBuild] = useState(false);
  useEffect(() => {
    if (wantBuild !== c.id) return;
    setTab('build');
    setToBuild(true);
    openBuildFor.value = null;
  }, [wantBuild, c.id]);
  // the magnifier mode: there, the focus goes to the Build list (its heading: Tab goes on to the rows)
  useEffect(() => {
    if (!toBuild || tab !== 'build') return;
    setToBuild(false);
    if (lowVision()) focusTitle(document.querySelector('.drawer .list-head'));
  }, [toBuild, tab]);
  const b = s.bodies[c.bodyId];
  const sys = s.systems[c.systemId];
  const mods = computeMods(s);
  const capy = capacity(s, c, mods);
  const p = project(s);
  const t = p.perColony[c.id];
  const y = t?.y;
  const isCap = s.civ.capitalId === c.id;
  const eNet = y ? y.energy - y.energyUpkeep : 0;
  // after the Long Flow: who keeps this place whole
  const keep = flowing(s) ? keeping(c, logTurnLength(turnStep(s)), mods) : 'kept';
  return (
    <>
      <div class="drawer-head">
        <div class="eyebrow">
          <span style={{ cursor: 'pointer' }} {...pressable(() => selectSystem(sys.id))}>{sys.name}</span> · <span data-tip={bodyKindNote(s, b)}>{bodyKindName(s, b)}</span>
        </div>
        <h2>{c.name}</h2>
        <div class="row wrap" style={{ marginTop: '6px' }}>
          {isCap && <span class="chip neon">capital</span>}
          {formOf(c) !== 'baryonic' && <span class="chip" data-tip={FORMS[formOf(c)].desc}>{FORMS[formOf(c)].name.toLowerCase()}</span>}
          {shownTraits(s, b).map((tr) => (
            <span key={tr} class="chip" data-tip={TRAIT_NAME[tr]?.[1] ?? ''}>{TRAIT_NAME[tr]?.[0] ?? tr}</span>
          ))}
          {c.starving > 0 && <span class="chip danger">starving</span>}
          {c.siege && (
            <span class="chip danger" data-tip={`${s.civs[c.siege.by]?.name ?? 'The enemy'}’s warships hold this star with none of ours here: our stores and will run down each turn, and they carry off what the blockade drains. From turn ${SIEGE_TURNS} they can storm it (behind a Defence Grid or a Bastion Shell, only with a Breacher). Warships of ours here break the siege, even standing off.`}>
              under siege {Math.min(c.siege.turns, SIEGE_TURNS)}/{SIEGE_TURNS}
            </span>
          )}
          {keep === 'unmanned' && nextToFlow(c) && <span class="chip danger" data-tip="No one is awake here to mend it against the Long Flow: a structure a turn runs into smooth lumps, the cheapest first, Cryo Halls last, with their sleepers. One awake Kin, a Lattice process or a mind that thinks faster than the flow would keep it whole.">flowing away</span>}
          {keep === 'watched' && <span class="chip warn" data-tip="Everyone here thinks more slowly than the Long Flow, so they keep watchers awake between their thoughts: half again their upkeep.">keeping watch</span>}
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
                {YIELDS.map(({ key, name }) => (
                  <div key={key} data-tip={yieldTip(y, key)}>
                    <span class="yv"><Icon name={key} cls={key === 'energy' ? 'accent' : undefined} /> <span class={key === 'energy' ? `mono ${eNet >= 0 ? 'good' : 'bad'}` : 'mono'}>{yieldText(y, key)}</span></span>
                    <span class="yl">{name}</span>
                  </div>
                ))}
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
                <TerraformedRow s={s} c={c} />
                <dt data-tip={`How much of the world is still alive. Kin capacity follows it.${seededTip(s, b) ? `\n${seededTip(s, b)}` : ''}`}>Vitality</dt>
                <dd data-tip={seededTip(s, b)}>
                  <div class="row" style={{ justifyContent: 'flex-end' }}>
                    <div class={`bar ${b.vitality < 0.25 ? 'bad' : 'good'}`} style={{ width: '90px' }}><i style={{ width: pct(b.vitality) }} /></div>
                    <span class="mono">{pct(b.vitality)}</span>
                  </div>
                </dd>
                <FreezingRow s={s} b={b} c={c} />
                <BoilingRow s={s} b={b} />
                <ClimateRows s={s} b={b} />
                <dt>Core heat</dt>
                <dd class="mono">{pct(b.coreHeat)}</dd>
                {c.damage > 0.01 && (
                  <>
                    <dt data-tip="Damage to the settlement's hearth from overdrive, attacks and quakes. It heals by 2% a turn when not in overdrive.">Hearth damage</dt>
                    <dd class="mono bad">{pct(c.damage)}</dd>
                  </>
                )}
                <FallsInwardRow s={s} b={b} />
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
                  .map(([id, n]) => {
                    const why = dismantleCheck(s, c, id);
                    const away = leftBehind(s, c, STRUCTURE_BY_ID[id]);
                    // what they give here now, or why nothing (26 Oct, the player: "the buildings should
                    // show what their current real effect/benefit or lack thereof is")
                    const fx = away ? null : builtEffect(s, c, id, p.ctx);
                    const now = fx ? builtEffectText(fx, n) : '';
                    return (
                      <span
                        key={id}
                        class={`chip ${armed === id ? 'warn' : away || fx?.idle ? 'faint' : ''}`}
                        data-tip={`${structureLabel(id, sys, formOf(c)).desc}${away ? '\nOut of reach: it was built around the star, and this world has drifted loose from it. It gives us nothing now.' : now ? `\n${now}.` : ''}`}
                      >
                        <KindIcon id={id} />
                        {structureLabel(id, sys, formOf(c)).name}
                        {n > 1 ? ` ×${n}` : ''}
                        <button
                          class={`dismantle ${why ? 'off' : ''}`}
                          aria-label={`Take apart ${structureLabel(id, sys, formOf(c)).name}`}
                          data-tip={why ? `Cannot take it apart: ${why}` : `Take one apart: ${dismantleBack(dismantleTerms(s, STRUCTURE_BY_ID[id]))}.`}
                          onClick={() => !why && setArmed(armed === id ? null : id)}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
              </div>
              {armed && (c.structures[armed] ?? 0) > 0 && (
                <div ref={armRef} class="row wrap dismantle-confirm" style={{ gap: '6px', marginTop: '6px', alignItems: 'center' }}>
                  <span class="dim">
                    Take apart one {structureLabel(armed, sys, formOf(c)).name}? {dismantleBack(dismantleTerms(s, STRUCTURE_BY_ID[armed]))}. The work that built it is lost.
                  </span>
                  <button
                    class="btn small danger"
                    onClick={() => {
                      const id = armed;
                      setArmed(null);
                      if (act((g) => dismantle(g, c.id, id))) sfx('click');
                    }}
                  >
                    Take apart
                  </button>
                  <button class="btn small" onClick={() => setArmed(null)}>
                    Keep it
                  </button>
                </div>
              )}
            </div>
            <PassageSection s={s} c={c} />
            <DriftSection s={s} c={c} />
            <HorizonSection s={s} c={c} />
            <WeaveSection s={s} c={c} />
          </>
        ) : (
          <BuildTab s={s} c={c} industry={y?.industry ?? 0} energyMade={y?.energy ?? 0} />
        )}
      </div>
    </>
  );
}

/** Founding new settlements from here: ready settler ships, and one-click orders for more. */
function ExpandSection({ s, c }: { s: GameState; c: Colony }) {
  const ready = fleets(s).filter((f) => f.at === c.systemId && f.order === 'idle' && f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles));
  const ships = buildableShips(s, c).filter((x) => x.def.settles);
  const queued = (id: string) => c.queue.filter((q) => q.key === id).length;
  const noYard = !(c.structures.shipyard ?? 0);
  return (
    <div class="section">
      <h3>Expand</h3>
      {ready.map((f) => (
        <div key={f.id} class="row ready-settler">
          <Icon name="colonize" cls="neon" />
          <span class="grow" style={{ fontSize: '13.5px' }}>
            {f.name} is ready.
          </span>
          <button class="btn small primary" onClick={() => selectFleet(f)}>
            Choose a world
          </button>
        </div>
      ))}
      {noYard ? (
        <div class="faint" style={{ fontSize: '13.5px' }}>Build a Shipyard here to launch settlers.</div>
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
        <div class="faint" style={{ fontSize: '12.5px', marginTop: '4px' }}>
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

/** What taking one apart gives back, and what it costs: "+20 matter back, for 6 energy". */
function dismantleBack(t: { matter: number; energy: number; cost: number }): string {
  const back = t.matter ? `+${t.matter} matter back` : t.energy ? `+${t.energy} energy back` : 'nothing comes back';
  return `${back}, for ${t.cost} energy`;
}

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

function BuildTab({ s, c, industry, energyMade }: { s: GameState; c: Colony; industry: number; energyMade: number }) {
  void rev.value; // mutable game state: re-render on every change
  const [kind, setKind] = useState<'structure' | 'ship'>('structure');
  const rc = rushCost(s, c.id);
  let acc = 0;
  const ctx = project(s).ctx;
  type Item = { id: string; name: string; desc: string; error: string | null | undefined; cost: ReturnType<typeof buildCost>; count: number; fx?: BuildEffect; sk?: StructureKind };
  const all: Item[] =
    kind === 'structure'
      ? buildableStructures(s, c).map((x) => ({ id: x.def.id, ...structureLabel(x.def.id, s.systems[c.systemId], formOf(c)), error: x.error, cost: buildCost(s, x.def, false), count: c.structures[x.def.id] ?? 0, fx: structureEffect(s, c, x.def.id, ctx), sk: structureKind(x.def) }))
      : buildableShips(s, c).map((x) => ({ id: x.def.id, name: x.def.name, desc: `${x.def.desc} ${shipNote(x.def)}`, error: x.error, cost: buildCost(s, x.def, true), count: 0 }));
  // what cannot be built here now can be left out (31 Oct, the player: "let the player hide
  // buildings that are unavailable to build"), remembered between sessions
  const hide = !!hudPrefs.value.hideUnbuildable;
  const unbuildable = all.filter((x) => x.error).length;
  const list = hide ? all.filter((x) => !x.error) : all;
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
        {c.queue.length === 0 && <WorkingOn s={s} c={c} industry={industry} energyMade={energyMade} />}
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
                      <Icon name={q.kind === 'passage' || q.kind === 'horizon' || q.kind === 'weave' ? 'upload' : 'fleet'} />
                    </span>
                  )}
                  {q.kind === 'structure' ? structureLabel(q.key, s.systems[c.systemId], formOf(c)).name : q.kind === 'passage' ? 'The Passage' : q.kind === 'horizon' ? 'Writing into the horizon' : q.kind === 'weave' ? 'Weaving through the positronium' : def?.name ?? q.key}
                </span>
                <span class="mono faint" style={{ fontSize: '12.5px' }}>{isFinite(turns) ? `${turns} turn${turns > 1 ? 's' : ''}` : 'stalled'}</span>
                <button class="btn ghost small" aria-label="Move up" data-tip="Build this sooner (move up the queue)" disabled={i === 0} onClick={() => act((g) => moveQueued(g, c.id, q.uid, -1))}>▲</button>
                <button class="btn ghost small" aria-label="Move down" data-tip="Build this later (move down the queue)" disabled={i === c.queue.length - 1} onClick={() => act((g) => moveQueued(g, c.id, q.uid, 1))}>▼</button>
                <button class="btn ghost small" aria-label="Remove" data-tip="Remove: everything paid up front comes back (work already done here is lost)" onClick={() => act((g) => removeQueued(g, c.id, q.uid))}>
                  <Icon name="close" />
                </button>
              </div>
              <div class="bar neon"><i style={{ width: pct(q.progress / q.cost) }} /></div>
            </div>
          );
        })}
        {rc && c.flags_rushed !== s.turn && (
          <button class="btn small" style={{ marginTop: '6px' }} data-tip="Emergency shifts finish the first project now, not at the turn’s end: it stands at once, and this turn’s industry goes on to the next. People resent it." onClick={() => act((g) => rushBuild(g, c.id)) && sfx('build')}>
            Rush first: {rc.matter ? `${rc.matter} matter, ` : ''}{rc.energy} energy
          </button>
        )}
      </div>
      <GovernorSection s={s} c={c} />
      <SpareChoice s={s} c={c} industry={industry} energyMade={energyMade} />
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
        <div class="row wrap" style={{ gap: '4px', marginBottom: '6px' }}>
          <button
            class={`btn small ghost hide-unbuildable ${hide ? 'on' : ''}`}
            aria-pressed={hide}
            data-tip={hide ? `Show the ${unbuildable} that cannot be built here now, each with why` : 'Leave out what cannot be built here now (each says why while it is shown). Remembered.'}
            onClick={() => {
              setHudPrefs({ hideUnbuildable: !hide });
              sfx('click');
            }}
          >
            {hide ? `Show unavailable (${unbuildable})` : `Hide unavailable${unbuildable ? ` (${unbuildable})` : ''}`}
          </button>
        </div>
        {hide && !list.length && <p class="dim">Nothing {kind === 'structure' ? 'of this' : 'of these'} can be built here now. Show the unavailable to see why.</p>}
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
                {...pressable(() => {
                  if (act((g) => queueBuild(g, c.id, kind, x.id))) sfx('build');
                }, !!x.error)}
              >
                <span class="grow">
                  {x.sk && <KindIcon id={x.id} />}
                  {x.name}
                  {x.count > 0 && <span class="faint"> ×{x.count}</span>}
                  {x.fx && <EffectLine fx={x.fx} />}
                  <div class="build-desc">{x.desc}</div>
                  {x.error && <div class="faint" style={{ fontSize: '12.5px' }}>{x.error}</div>}
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

/** What a turn of spare work makes, in words ("+1.0 insight a turn"), or null for nothing. */
function spareMade(y: SpareYield): string | null {
  const parts = [y.matter && `+${n1(y.matter)} matter`, y.energy && `+${n1(y.energy)} energy`, y.insight && `+${n1(y.insight)} insight`, y.resolve && `+${y.resolve.toFixed(2)} resolve`].filter(Boolean);
  return parts.length ? `${parts.join(', ')} a turn` : null;
}

/** With nothing queued: what the settlement is working on instead, and what it makes. */
function WorkingOn({ s, c, industry, energyMade }: { s: GameState; c: Colony; industry: number; energyMade: number }) {
  const work = spareChoices(s).find((x) => x.id === (c.spare ?? 'salvage'))!;
  const made = spareMade(spareYield(s, c, industry, energyMade));
  // (a governor with a pick spends the turn's industry on it: no spare work)
  const picks = !!c.governor && !!governorChoice(s, c, project(s).ctx).pick;
  return (
    <div style={{ fontSize: '13.5px' }}>
      <div class="faint">Nothing queued.{c.governor ? ` ${governorLine(s, c)}` : ''}</div>
      {!picks && (
        <div data-tip={work.tip}>
          Working on: <b>{work.name}</b>
          {c.spare ? '' : ' (by default: choose below)'}
          {c.governor ? ' meanwhile' : ''} · {made ?? 'nothing comes of it here'}
        </div>
      )}
    </div>
  );
}

/** What the settlement works on whenever its queue is empty: the alternative to building. */
function SpareChoice({ s, c, industry, energyMade }: { s: GameState; c: Colony; industry: number; energyMade: number }) {
  const on = c.spare ?? 'salvage';
  return (
    <div class="section">
      <h3 data-tip="What this settlement works on whenever its build queue is empty, instead of building. Each choice turns its industry into about as much as the others: a tenth of what a building of that kind would make. To switch to it now, remove what is queued (everything paid up front comes back).">
        When nothing is queued
      </h3>
      <div class="seg">
        {spareChoices(s).map((x) => {
          const made = spareMade(spareYield(s, c, industry, energyMade, x.id));
          return (
            <button key={x.id} class={`btn small ${on === x.id && c.spare ? 'primary' : ''}`} data-tip={`${x.tip}\nHere: ${made ?? 'nothing'}.`} onClick={() => act((g) => setSpare(g, c.id, x.id)) && sfx('click')}>
              {x.name}
            </button>
          );
        })}
      </div>
      {c.queue.length > 0 && <div class="faint" style={{ fontSize: '12.5px', marginTop: '4px' }}>Starts once the queue is done.</div>}
    </div>
  );
}

/** The settlement's governor: Off, or the kind it builds whenever the queue is empty. */
function GovernorSection({ s, c }: { s: GameState; c: Colony }) {
  return (
    <div class="section">
      <h3 data-tip={GOVERNOR_TIP}>Governor</h3>
      <GovernorPicker value={c.governor ?? null} label={`Governor of ${c.name}`} onPick={(k) => act((g) => setGovernor(g, [c.id], k)) && sfx('click')} />
      {c.governor && <div class="faint governor-line" style={{ fontSize: '12.5px', marginTop: '4px' }}>{governorLine(s, c)}</div>}
    </div>
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
  ['coldminds', 'Lasting', 'How long before the world falls into its dead star, or its black hole evaporates', 'longest-lasting first'],
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
  // part of a swarm sent after this ship
  const hunter = Object.values(s.swarms).find((w) => w.prey === f.id);
  const known = here ? Object.values(s.systems).filter((x) => x.id !== here.id && !x.gone && (s.civ.known[x.id] ?? 0) > 0).map((x) => ({ sys: x, ly: distLy(here, x) })) : [];
  // collision stars first (all of them, in the Degenerate Age), then the nearest ten
  const nearby = [
    ...known.filter((d) => isBeacon(s, d.sys)).sort((a, b) => a.ly - b.ly),
    ...known
      .filter((d) => !isBeacon(s, d.sys))
      .sort((a, b) => (surveyor ? Number(s.civ.known[a.sys.id] === 2) - Number(s.civ.known[b.sys.id] === 2) : 0) || a.ly - b.ly)
      .slice(0, 10),
  ];
  // how suitable each charted star nearby is for each kind of settler, and the best of them
  const destSites: Record<string, Sites> = {};
  for (const d of nearby) if (s.civ.known[d.sys.id] === 2) destSites[d.sys.id] = starSites(s, d.sys);
  const destBest = bestOf(Object.values(destSites));
  const settleDef = settler ? SHIP_BY_ID[settler.cls] : null;
  const own: Need | null = settleDef?.settles ? needOf(settleDef.settles.thread) : null;
  // settlers are ranked for their own kind unless the player picks another measure
  const [settleSort, setSettleSort] = useState<SettleSort>('auto');
  useEffect(() => setSettleSort('auto'), [f.id]);
  const measure: ThreadId = settleSort === 'auto' || settleSort === 'near' ? (settleDef?.settles?.thread ?? 'kin') : settleSort;
  // the measure both lists are sorted by, marked in them (none when it is the nearest first)
  const marked: Need | null = settleDef && settleSort !== 'near' ? needOf(measure) : null;
  const settleTargets = (
    here && settleDef
      ? Object.values(s.bodies)
          .filter((b) => s.civ.known[b.systemId] === 2 && (!settleDef.inSystem || b.systemId === here.id) && !canSettle(s, b, settleDef.settles!.thread))
          .map((b) => ({ b, ly: distLy(here, s.systems[b.systemId]), v: siteValue(s, b, measure) }))
          // each kind of mind wants something different: Kin livable ground, Echoes power, the Lattice matter, Coldminds time
          .sort((a, b) => Number(isBeacon(s, s.systems[b.b.systemId])) - Number(isBeacon(s, s.systems[a.b.systemId])) || (settleSort === 'near' ? a.ly - b.ly : b.v.score - a.v.score) || a.ly - b.ly)
          .slice(0, 10)
      : []
  ).map((t) => ({ ...t, sites: worldSites(s, t.b) }));
  const settleBest = bestOf(settleTargets.map((t) => t.sites));
  // a settler's Nearby list follows the same sort, the charted stars by their best world and the
  // unsurveyed after them (a probe in the fleet keeps the unsurveyed first until a measure is picked)
  const byMeasure = !!settleDef && !(surveyor && settleSort === 'auto');
  const dests = byMeasure
    ? [...nearby].sort((a, b) => {
        const score = (d: { sys: StarSystem }) => (settleSort === 'near' ? 0 : (destSites[d.sys.id]?.[needOf(measure)]?.v.score ?? -1e9));
        return Number(isBeacon(s, b.sys)) - Number(isBeacon(s, a.sys)) || score(b) - score(a) || a.ly - b.ly;
      })
    : nearby;
  const sortWords = settleSort === 'auto' ? SETTLE_BEST[settleDef?.settles?.thread ?? 'kin'] : SETTLE_SORTS.find((x) => x[0] === settleSort)?.[3];
  const unsurveyedHere = dests.some((d) => s.civ.known[d.sys.id] !== 2);
  const nearbyOrder = byMeasure
    ? `${sortWords}${settleSort !== 'near' && unsurveyedHere ? ', unsurveyed last' : ''}`
    : surveyor
      ? unsurveyedHere ? 'unsurveyed first' : 'all charted'
      : null;
  const swarmHere = here ? Object.values(s.swarms).find((w) => w.systemId === here.id && !w.tamed) : null;
  // another civilization lives here: our warships could take from them
  const [raidArmed, setRaidArmed] = useState(false);
  useEffect(() => setRaidArmed(false), [f.id, f.at]);
  const raidSv = here && isWarFleet(f) ? raidTarget(s, here.id) : null;
  const raidWait = raidSv?.raidedAt !== undefined ? RAID_COOLDOWN - (s.turn - raidSv.raidedAt) : 0;
  const raiders = here && raidSv ? raidForce(s, here.id) : 0;
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
            <span key={i} class="chip" data-tip={SHIP_BY_ID[x.cls] ? `${SHIP_BY_ID[x.cls].desc}\n${attackNote(SHIP_BY_ID[x.cls])}.\nHull ${x.hp}/${SHIP_BY_ID[x.cls].hp}` : x.cls}>
              {SHIP_BY_ID[x.cls]?.name ?? x.cls}
            </span>
          ))}
          {f.order === 'fortify' && <span class="chip neon" data-tip={`Dug in: counts ${FORTIFY_BONUS}× against ships and swarms here (an Aegis 3×; not while standing off), and turns raiders away from the capital.`}><Icon name="shield" /> fortified</span>}
          {tacticOf(f).id !== 'line' && <span class="chip" data-tip={`${tacticOf(f).desc}
${tacticNote(tacticOf(f))}`}>{tacticOf(f).name.toLowerCase()}</span>}
          {f.order === 'hold' && <span class="chip" data-tip="Parked on purpose: the game will not ask about it.">holding</span>}
          {f.order === 'strike' && <span class="chip danger" data-tip="A Kinetic Lance on its way at 99% of the speed of light: it strikes as it arrives, and is spent.">striking</span>}
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
        <TacticRow s={s} f={f} />
        {hunter && (
          <div class="warn" style={{ fontSize: '13.5px', marginBottom: '8px' }}>
            <Icon name="warning" />{' '}
            {hunter.systemId
              ? 'Part of a swarm came here for this ship. It strikes each turn the ship stays; once the ship is gone, it goes on to our nearest settlement.'
              : `Part of the swarm at ${s.systems[hunter.from ?? '']?.name ?? 'a star nearby'} is coming for this ship. A ship under way is safe from it; once the ship is gone, it goes on to our nearest settlement.`}
          </div>
        )}
        {!here && f.to && (
          <>
            <div class="bar neon" style={{ marginBottom: '6px' }}><i style={{ width: pct(f.distance > 0 ? f.traveled / f.distance : 1) }} /></div>
            <div class="mono dim" style={{ fontSize: '13.5px' }}>
              {formatDistance(f.traveled)} of {formatDistance(f.distance)} · {tripLabel(s, f.distance - f.traveled, isLance(f) ? { ...mods, speed: Math.max(mods.speed, LANCE_SPEED) } : mods, true)} to go
            </div>
            {f.order === 'colonize' && f.targetBody && <div class="faint" style={{ fontSize: '13.5px', marginTop: '4px' }}>To settle {s.bodies[f.targetBody]?.name}.</div>}
            {f.order === 'strike' && <div class="faint" style={{ fontSize: '13.5px', marginTop: '4px' }}>To strike {s.colonies[f.targetColony ?? '']?.name ?? 'its target'}. No one there will see it coming until it arrives.</div>}
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
              {isWarFleet(f) && (
                <button class="btn small" onClick={() => sendFromSystems(s, f)} data-tip="Pick its destination from a list: the stars where a civilization asked us for help, then every swarm and other civilization on our map, the nearest first, and the Systems window’s other lists.">
                  <Icon name="attack" /> Choose from list
                </button>
              )}
              {hasTech(s, 'hunger_lures') && !here.beacon && (
                <button
                  class="btn small"
                  data-tip={`Light a decoy beacon here: ${BEACON_COST} energy, then ${BEACON_UPKEEP} a turn at the Tide to keep it burning (it goes dark if we stop feeding it or run short). The nearest awake swarm within reach turns toward it at once; while it burns, swarms choosing their next meal are drawn to it instead of to us.`}
                  onClick={() => act((g) => placeBeacon(g, f.id))}
                >
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
              ) : isWarFleet(f) && f.ships.length > 1 ? (
                <>
                  <button class="btn small primary" data-tip={`Dig in one warship here, the one in the best repair: it leaves this fleet as a fleet of its own and counts ${FORTIFY_BONUS}× against ships and swarms in this system (an Aegis 3×; not while standing off). The other ${f.ships.length - 1} wait for orders.`} onClick={() => act((g) => fortifyOne(g, f.id)) && sfx('build')}>
                    <Icon name="shield" /> Fortify one
                  </button>
                  <button class="btn small" data-tip={`Dig in all ${f.ships.length} here: they count ${FORTIFY_BONUS}× against ships and swarms in this system (an Aegis 3×; not while standing off), turn raiders away from the capital, and stop asking for orders.`} onClick={() => act((g) => standFleet(g, f.id, 'fortify')) && sfx('build')}>
                    <Icon name="shield" /> Fortify all {f.ships.length}
                  </button>
                </>
              ) : isWarFleet(f) ? (
                <button class="btn small primary" data-tip={`Dig in here: counts ${FORTIFY_BONUS}× against ships and swarms in this system (an Aegis 3×; not while standing off), turns raiders away from the capital, and stops asking for orders.`} onClick={() => act((g) => standFleet(g, f.id, 'fortify')) && sfx('build')}>
                  <Icon name="shield" /> Fortify
                </button>
              ) : (
                <button class="btn small" data-tip="Park it here on purpose: the game stops asking about it." onClick={() => act((g) => standFleet(g, f.id, 'hold')) && sfx('click')}>
                  Hold here
                </button>
              )}
              {isWarFleet(f) && swarmHere && here && <AttackButton s={s} systemId={here.id} fleetId={f.id} />}
              {raidSv && (
                <button
                  class={`btn small danger ${raidArmed ? 'on' : ''}`}
                  disabled={raidWait > 0 || raiders <= 0}
                  onClick={doRaid}
                  data-tip={
                    raidWait > 0
                      ? `${raidSv.name} is on guard since our last raid. ${raidWait} more turn${raidWait === 1 ? '' : 's'}.`
                      : raiders <= 0
                        ? 'Warships standing off cannot raid: they must hold the line, close in or escort.'
                        : `Take part of ${raidSv.name}’s reserve by force. Every warship here not standing off joins in, by its fleet’s tactic (attack ${n1(raiders)}); if their defences hold, it is our ships that get hurt.\nWhatever happens: they will not forgive it, every civilization we know hears of it, Resolve −3, Dissent +4. Once every ${RAID_COOLDOWN} turns at most.`
                  }
                >
                  <Icon name="attack" /> {raidArmed ? 'Really raid? (click again)' : `Raid ${raidSv.name}`}
                </button>
              )}
              <button class="btn small danger" data-tip="Scrap the fleet here and recover some matter." onClick={() => act((g) => disbandFleet(g, f.id)) && (selection.value = null)}>
                Disband
              </button>
            </div>
            <BattleSection s={s} f={f} />
            <StrikeSection s={s} f={f} />
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
                  {settleTargets.map(({ b, ly, sites }) => (
                    <div key={b.id} class="list-item" style={{ flexWrap: 'wrap' }} {...pressable(() => act((g) => orderFleet(g, f.id, b.systemId, 'colonize', b.id)) && sfx('good'))}>
                      <Icon name={bodyIcon(b.kind)} />
                      <span class="grow">
                        {isBeacon(s, s.systems[b.systemId]) && <span class="chip boon" style={{ marginRight: '6px' }} data-tip={BEACON_TIP}>collision star</span>}
                        {b.name} <span class="faint" style={{ fontSize: '12.5px' }}>{bodyKindName(s, b)}{b.systemId !== here.id ? ` · ${s.systems[b.systemId].name}` : ''}</span>
                        <SwarmNear s={s} systemId={b.systemId} />
                      </span>
                      <button class="btn small ghost" style={{ padding: '1px 5px' }} onClick={(e) => { e.stopPropagation(); lookAtWorld(b.systemId, b.id); }} data-tip="Look at this world before sending the ship: the view turns to it, inside its system, and the ship waits for your order. Its star's panel (and the galaxy map) show what is around it.">
                        <Icon name="focus" />
                      </button>
                      <span class={`mark mono faint${settleSort === 'near' ? ' sorted' : ''}`} style={{ fontSize: '12.5px' }} data-tip={ly > 0 ? TRIP_TIP : ''}>{ly > 0 ? tripLabel(s, ly, mods) : 'here'}</span>
                      <SiteStrip s={s} sites={sites} best={settleBest} active={marked} one />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div class="section">
              <h3 class="row" style={{ gap: '4px' }}>
                <span class="grow">
                  Nearby{' '}
                  {nearbyOrder && (
                    <span class="faint" style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                      · {nearbyOrder}
                    </span>
                  )}
                </span>
                <button class="btn small ghost more-dests" style={{ textTransform: 'none', letterSpacing: 0 }} onClick={() => sendFromSystems(s, f)} data-tip="Choose from the Systems window: our settlements, every surveyed world and the collision stars, near or far.">
                  More in Systems…
                </button>
              </h3>
              {surveyor && !dests.some((d) => s.civ.known[d.sys.id] !== 2) && (
                <p class="dim" style={{ fontSize: '13.5px', margin: '0 0 6px' }}>
                  Every star we know of here is charted. A ship with nothing uncharted near it takes a long look at the end of the turn and picks out the nearest unseen stars (a probe three, other ships one), even across the gulfs between clusters. Deep Survey Optics lets everyone see farther.
                </p>
              )}
              <div class="list">
                {dests.map(({ sys, ly }) => (
                  <div key={sys.id} class="list-item" style={{ flexWrap: 'wrap' }} {...pressable(() => act((g) => orderFleet(g, f.id, sys.id, 'move')) && sfx('select'))}>
                    <Icon name={primaryIcon(sys.primary.kind)} />
                    <span class="grow">
                      {sys.name}
                      {isBeacon(s, sys) && <span class="chip boon" style={{ marginLeft: '6px' }} data-tip={BEACON_TIP}>collision star</span>}
                      {swarmSeenAt(s, sys.id) && <span class="chip danger" style={{ marginLeft: '6px' }} data-tip={SWARM_TIP}>swarm</span>}
                      {nestSeenAt(s, sys.id) && <span class="chip" style={{ marginLeft: '6px' }} data-tip={NEST_TIP}>nest asleep</span>}
                      {s.civ.known[sys.id] !== 2 && <span class="faint" style={{ fontSize: '12.5px' }}> unsurveyed</span>}
                    </span>
                    <span class={`mark mono faint${byMeasure && settleSort === 'near' ? ' sorted' : ''}`} style={{ fontSize: '12.5px' }} data-tip={`Distance · turns at this pace · years of flight · launch energy\n${TRIP_TIP}`}>
                      {formatDistance(ly)} · {tripLabel(s, ly, mods)} · {n0(launchCost(s, f, ly, mods))}
                      <Icon name="energy" />
                    </span>
                    {s.civ.known[sys.id] === 2 && <SiteStrip s={s} sites={destSites[sys.id]} best={destBest} mine={own} active={byMeasure ? marked : null} />}
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

// ------------------------------------------------------------------ battle (the combat system, 20 Oct)

/**
 * War at a star, in its panel: the battle fought here last turn, as we saw it (both sides' fire
 * and losses), and every siege here, ours or theirs. Nothing where there was neither.
 */
function WarHere({ s, sys }: { s: GameState; sys: StarSystem }) {
  void rev.value; // mutable game state: re-render on every change
  const me = s.civ.id;
  const last = [...s.battles].reverse().find((b) => b.systemId === sys.id && b.turn === s.turn - 1 && b.sides?.some((x) => x.owner === me));
  const sieges = allColonies(s).filter((c) => c.systemId === sys.id && c.siege && (c.owner === me || c.siege.by === me));
  if (!last && !sieges.length) return null;
  const mine = last?.sides?.find((x) => x.owner === me);
  const theirLoss: Record<string, number> = {};
  for (const x of last?.sides ?? []) if (x.owner !== me) for (const [k, n] of Object.entries(x.lost)) theirLoss[k] = (theirLoss[k] ?? 0) + n;
  const who = (last?.sides ?? []).filter((x) => x.owner !== me).map((x) => s.civs[x.owner]?.name ?? 'the enemy');
  return (
    <div class="section">
      <h3>
        <Icon name="attack" /> War here
      </h3>
      {mine && (
        <div class="dim" style={{ fontSize: '13.5px' }}>
          Last turn, against {who.join(' and ')}: we dealt {n1(mine.dealt)} and took {n1(mine.taken)}
          {lossWords(mine.lost, theirLoss, false)}.
        </div>
      )}
      {sieges.map((c) => (
        <div key={c.id} class={c.owner === me ? 'warn' : 'dim'} style={{ fontSize: '13.5px', marginTop: '4px' }}>
          {c.owner === me ? `${s.civs[c.siege!.by]?.name ?? 'The enemy'} hold ${c.name} under siege` : `Our siege of ${c.name}, ${s.civs[c.owner]?.name ?? 'theirs'}`}: turn {c.siege!.turns}
          {c.siege!.turns < SIEGE_TURNS ? ` of ${SIEGE_TURNS}` : ', and it can be stormed'}.
        </div>
      ))}
    </div>
  );
}



/** Ships counted by class, for `shipsInWords`. */
function byClass(ships: { cls: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of ships) out[x.cls] = (out[x.cls] ?? 0) + 1;
  return out;
}

/** What a turn's losses would be, in words, after a forecast's figures. */
function lossWords(weLose: Record<string, number>, theyLose: Record<string, number>, would = true): string {
  const we = shipsInWords(weLose);
  const they = shipsInWords(theyLose);
  const v = would ? 'would lose' : 'lost';
  return `${we ? `; we ${v} ${we}` : ''}${they ? `; they ${v} ${they}` : ''}${!we && !they ? (would ? '; no ship would be lost' : '; no ship was lost') : ''}`;
}

/**
 * How this fleet fights: its tactic, one of four, in every fight it is in (ships, settlements,
 * swarms) until told otherwise. With an enemy at its star, each button's tip says what it would
 * deal and take there this turn. Nothing for a fleet without a warship: there is no one to fight.
 */
function TacticRow({ s, f }: { s: GameState; f: Fleet }) {
  void rev.value; // mutable game state: re-render on every change
  if (f.owner !== s.civ.id || !f.ships.some((x) => isWarship(x.cls))) return null;
  const cur = tacticOf(f).id;
  const unarmed = f.ships.some((x) => !isWarship(x.cls));
  return (
    <div class="row wrap tactics" style={{ gap: '4px', marginBottom: '8px', alignItems: 'center' }}>
      <span class="eyebrow" style={{ marginRight: '2px' }} data-tip="How this fleet fights, in every fight it is in: against ships, settlements and swarms. Change it any turn; it holds until you do.">
        Tactic
      </span>
      {TACTICS.map((t) => {
        const fc = f.at ? battleForecast(s, f.at, f.id, t.id) : null;
        const tip = [
          `${t.name}: ${t.desc}`,
          tacticNote(t),
          t.escorts && !unarmed ? 'It has no unarmed ships aboard to escort.' : '',
          !t.holds && f.order === 'fortify' ? 'Standing off, it gives up being dug in.' : '',
          fc ? `Here, this turn, at an even draw: we would deal ${n1(fc.dealt)} and take ${n1(fc.taken)}${lossWords(fc.weLose, fc.theyLose)}.` : '',
        ]
          .filter(Boolean)
          .join('\n');
        return (
          <button key={t.id} class={`btn small ${cur === t.id ? 'on' : ''}`} aria-pressed={cur === t.id} data-tip={tip} onClick={() => act((g) => setTactic(g, f.id, t.id)) && sfx('click')}>
            {t.name}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The war at this fleet's star: who stands here against us (their ships and tactics, their
 * settlements' guns) and what stands with us, last turn's exchange, our siege of a settlement of
 * theirs here (its turns, then Storm and Raze, asking first), and theirs of one of ours.
 */
function BattleSection({ s, f }: { s: GameState; f: Fleet }) {
  void rev.value; // mutable game state: re-render on every change
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => setArmed(null), [f.id, f.at]);
  const at = f.at;
  if (!at) return null;
  const me = s.civ.id;
  const theirFleets = allFleets(s).filter((x) => x.at === at && x.owner !== me && x.order !== 'strike' && x.ships.length > 0 && atWarWith(s, me, x.owner));
  const theirColonies = allColonies(s).filter((c) => c.systemId === at && c.owner !== me && atWarWith(s, me, c.owner));
  const foes = [...new Set([...theirFleets.map((x) => x.owner), ...theirColonies.map((c) => c.owner)])].sort();
  if (!foes.length) return null;
  const ours = fleets(s).filter((x) => x.at === at && x.ships.length > 0);
  const ourGuns = colonies(s).filter((c) => c.systemId === at).reduce((a, c) => a + settlementFire(c), 0);
  const last = [...s.battles].reverse().find((b) => b.systemId === at && b.turn === s.turn - 1 && b.sides?.some((x) => x.owner === me));
  const mine = last?.sides?.find((x) => x.owner === me);
  const theirLoss: Record<string, number> = {};
  for (const x of last?.sides ?? []) if (x.owner !== me) for (const [k, n] of Object.entries(x.lost)) theirLoss[k] = (theirLoss[k] ?? 0) + n;
  const besiegedHere = colonies(s).filter((c) => c.systemId === at && c.siege && c.siege.by !== me);
  const go = (id: string, raze: boolean) => {
    const key = `${raze ? 'raze' : 'storm'}:${id}`;
    if (armed !== key) {
      setArmed(key);
      sfx('warn');
      return;
    }
    setArmed(null);
    if (act((g) => storm(g, id, raze))) sfx('bad');
  };
  return (
    <div class="section battle">
      <h3 data-tip="Wherever we and a civilization at war with us stand at one star, ships or a settlement, we fight once a turn, all at once. Every ship is a target, armed or not, the least hull left first (an Escort's unarmed ships last); every settlement fires with what it has, its Defence Grids and more. Fire is a warship's strength against ships, dug in if fortified, by its fleet's tactic, on a draw.">
        <Icon name="attack" /> Battle
      </h3>
      {foes.map((o) => {
        const fl = theirFleets.filter((x) => x.owner === o);
        const guns = theirColonies.filter((c) => c.owner === o).reduce((a, c) => a + settlementFire(c), 0);
        return (
          <div key={o} class="row" style={{ fontSize: '13.5px', gap: '6px' }}>
            <span class="bad">{s.civs[o]?.name ?? 'The enemy'}</span>
            <span class="grow dim">
              {fl.length ? fl.map((x) => `${shipsInWords(byClass(x.ships))} (${tacticOf(x).name.toLowerCase()})`).join('; ') : 'no ships'}
              {guns > 0 ? ` · their guns ${n1(guns)}` : ''}
            </span>
          </div>
        );
      })}
      <div class="row" style={{ fontSize: '13.5px', gap: '6px' }}>
        <span class="good">With us</span>
        <span class="grow dim">
          {ours.map((x) => `${x.name}: ${shipsInWords(byClass(x.ships))}${x.ships.some((y) => isWarship(y.cls)) ? ` (${tacticOf(x).name.toLowerCase()}${x.order === 'fortify' && tacticOf(x).holds ? ', dug in' : ''})` : ''}`).join('; ')}
          {ourGuns > 0 ? ` · our guns ${n1(ourGuns)}` : ''}
        </span>
      </div>
      {mine && (
        <div class="dim" style={{ fontSize: '13.5px', marginTop: '4px' }}>
          Last turn: we dealt {n1(mine.dealt)} and took {n1(mine.taken)}
          {lossWords(mine.lost, theirLoss, false)}.
        </div>
      )}
      {besiegedHere.map((c) => (
        <div key={c.id} class="warn" style={{ fontSize: '13.5px', marginTop: '4px' }}>
          {s.civs[c.siege!.by]?.name ?? 'The enemy'} hold {c.name} under siege: turn {c.siege!.turns}
          {c.siege!.turns < SIEGE_TURNS ? ` of ${SIEGE_TURNS}` : ', and can storm it'}.
        </div>
      ))}
      {theirColonies.map((c) => {
        const why = assaultBlocked(s, me, c);
        const turns = c.siege?.by === me ? c.siege.turns : 0;
        const odds = assaultOdds(s, me, c);
        const terms = `It holds ${n1(holdOf(c))}${walled(c) ? ', walled' : ''}; about ${pct(odds)} to win.`;
        return (
          <div key={c.id} style={{ marginTop: '6px' }}>
            <div class="row wrap" style={{ gap: '4px', alignItems: 'center' }}>
              <span class="grow" style={{ fontSize: '13.5px' }}>
                {turns ? `Our siege of ${c.name}: turn ${turns}${turns < SIEGE_TURNS ? ` of ${SIEGE_TURNS}` : ''}` : `${c.name}: no siege of ours`}
              </span>
              <button
                class={`btn small danger ${armed === `storm:${c.id}` ? 'on' : ''} ${why ? 'disabled' : ''}`}
                data-tip={`${why ? `${why}\n` : ''}Storm ${c.name}: our warships here not standing off, their strength against settlements by their tactics, on a draw. ${terms} Taken, three tenths of its people flee to their own and the rest are ours, unwilling; three tenths of what was built there is wreckage. Thrown back, the siege begins again. Either way it costs hulls, and everyone hears of it.`}
                onClick={() => !why && go(c.id, false)}
              >
                {armed === `storm:${c.id}` ? `Really storm? ${pct(odds)} (click again)` : why ? 'Storm' : `Storm (${pct(odds)})`}
              </button>
              <button
                class={`btn small danger ${armed === `raze:${c.id}` ? 'on' : ''} ${why ? 'disabled' : ''}`}
                data-tip={`${why ? `${why}\n` : ''}Raze ${c.name}: the same assault, and won, nothing there is left, and no one. Everyone hears of it, and thinks worse of it than of a taking.`}
                onClick={() => !why && go(c.id, true)}
              >
                {armed === `raze:${c.id}` ? 'Really raze? (click again)' : 'Raze'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ the Kinetic Lance

/**
 * Strike an enemy's settlement with a Kinetic Lance from this fleet: the settlements of those we
 * are at war with that we can see, nearest first, each with its flight and the screens we see of
 * its own ships there; a second click to confirm. Nothing for a fleet without a Lance.
 */
function StrikeSection({ s, f }: { s: GameState; f: Fleet }) {
  void rev.value; // mutable game state: re-render on every change
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => setArmed(null), [f.id, f.at]);
  const here = f.at ? s.systems[f.at] : null;
  if (!here || !f.ships.some((x) => SHIP_BY_ID[x.cls]?.lance)) return null;
  const targets = allColonies(s)
    .filter((c) => c.owner !== s.player && atWarWith(s, s.player, c.owner) && settlementSeen(s, c))
    .map((c) => ({ c, ly: distLy(here, s.systems[c.systemId]) }))
    .sort((a, b) => a.ly - b.ly)
    .slice(0, 8);
  const go = (id: string) => {
    if (armed !== id) {
      setArmed(id);
      sfx('warn');
      return;
    }
    setArmed(null);
    if (act((g) => strike(g, f.id, id))) sfx('bad');
  };
  return (
    <div class="section">
      <h3 data-tip="One strike at an enemy’s settlement we can see, from anywhere: the Lance flies alone at 99% of light and strikes as it arrives, and is spent. Only the screens of their ships already waiting at that star can turn it aside. One in flight at a time.">Strike with the Kinetic Lance</h3>
      {!targets.length && <div class="faint" style={{ fontSize: '13.5px' }}>Only in a war, at a settlement of theirs we can see. There is none.</div>}
      {targets.map(({ c, ly }) => {
        const deep = s.bodies[c.bodyId]?.kind === 'deep';
        const screens = screensSeen(s, c.systemId, c.owner);
        const why = strikeBlocked(s, f.id, c.id);
        const owner = s.civs[c.owner]?.name ?? 'the enemy';
        const tip = `${why ? `${why}\n` : ''}${c.name}, a settlement of ${owner}, at ${s.systems[c.systemId]?.name}: ${formatDistance(ly)} away, ${ly > 0 ? formatYears(ly / LANCE_SPEED) : 'no time'} at 99% of light. ${deep ? 'In the Deep, scattered around its star, it would lose half its people and half of all it built.' : 'On a world, it would be struck down whole, with everyone in it.'} The screens of their ships we see there would turn it aside ${pct(screens)} of the time, as far as we can tell: ships come since that light left, we cannot see. Driving it so fast spends the galaxy’s free energy, and every civilization hears of the strike, turned aside or not.`;
        return (
          <div key={c.id} class="row" style={{ gap: '6px', alignItems: 'center', marginTop: '3px' }}>
            <span style={{ flex: 1, fontSize: '13.5px' }}>
              {c.name} <span class="faint">· {owner} · {formatDistance(ly)}{screens > 0 ? ` · screens ${pct(screens)}` : ''}</span>
            </span>
            <button class={`btn small danger ${armed === c.id ? 'on' : ''} ${why ? 'disabled' : ''}`} data-tip={tip} onClick={() => !why && go(c.id)}>
              <Icon name="attack" /> {armed === c.id ? 'Really strike? (click again)' : 'Strike'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ swarm

/** Send every warship of ours at this star against its swarm: the odds shown, a second click to confirm. */
function AttackButton({ s, systemId, fleetId }: { s: GameState; systemId: string; fleetId: string }) {
  void rev.value; // mutable game state: re-render on every change
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(false), [systemId, fleetId]);
  const sw = Object.values(s.swarms).find((w) => w.systemId === systemId && !w.tamed);
  if (!sw) return null;
  const { attack } = warshipsAt(s, systemId);
  const odds = attackOdds(attack, sw.size);
  const blocked = attackBlocked(s, systemId);
  const go = () => {
    if (!armed) {
      setArmed(true);
      sfx('warn');
      return;
    }
    setArmed(false);
    const out: { r?: { ok: boolean; text: string } } = {};
    const done = act((g) => {
      const r = attackOrder(g, fleetId);
      if (typeof r === 'string') return r;
      out.r = r;
    });
    if (done && out.r) {
      notify(out.r.text, out.r.ok ? 'good' : 'bad');
      sfx(out.r.ok ? 'good' : 'bad');
    }
  };
  const tip =
    blocked ??
    `Every warship of ours here goes for it together: attack ${n1(attack)} against its size ${n1(sw.size)} (fortified ships fight at their plain strength when they go out to attack; each fleet by its tactic). About ${pct(odds)} to win. A win kills ${n1(Math.min(sw.size, attack * 0.3))} of it, and we salvage twice that in matter, while what is left of it hurts our ships; a loss tears into all of them and can sink them.${sw.awake ? '' : ' It is asleep: unless we break it, it wakes.'} Once a turn.`;
  return (
    <button class={`btn small danger ${armed ? 'on' : ''}`} disabled={!!blocked} onClick={go} data-tip={tip}>
      <Icon name="attack" /> {armed ? `Really attack? ${pct(odds)} to win (click again)` : `Attack the swarm (${pct(odds)})`}
    </button>
  );
}

function SwarmPanel({ s, sw }: { s: GameState; sw: Swarm }) {
  void rev.value; // mutable game state: re-render on every change
  const at = sw.systemId ? s.systems[sw.systemId] : null;
  const col = at ? colonies(s).find((c) => c.systemId === at.id) : null;
  const tenderHere = at && fleets(s).some((f) => f.at === at.id && f.ships.some((x) => SHIP_BY_ID[x.cls]?.tames));
  // where it is going, and when it gets there: Hunger Studies reads its way (sight.ts); without
  // it we see where only when it comes for a settlement of ours
  const dest = sw.to ? s.systems[sw.to] : null;
  const toUs = !!dest && colonies(s).some((c) => c.systemId === dest.id);
  const reads = readsSwarms(s) || sw.tamed;
  const due = swarmArrives(s, sw);
  const dueTurns = turnsUntilYears(s, due);
  return (
    <>
      <div class="drawer-head">
        <div class="eyebrow">{at ? `At ${at.name}` : dest && (reads || toUs) ? `Moving toward ${dest.name}` : sw.to ? 'Under way' : 'Drifting'}</div>
        <h2>{sw.tamed ? 'Tamed Swarm' : 'The Hunger'}</h2>
        <div class="row wrap" style={{ marginTop: '6px' }}>
          <span class={`chip ${sw.tamed ? 'neon' : 'danger'}`}>{sw.tamed ? 'answers to us' : sw.awake ? 'awake' : 'dormant'}</span>
          {sw.prey && s.fleets[sw.prey] && (
            <span class="chip danger" data-tip="Part of a swarm sent after one of our ships: it strikes that ship wherever it finds it stopped, and once the ship is gone it goes on to the nearest settlement of the ship’s people.">
              after {s.fleets[sw.prey].name}
            </span>
          )}
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
          {dest && reads && isFinite(due) && (
            <>
              <dt>Arrives</dt>
              <dd class="mono" data-tip="Hunger Studies reads its way: at the speed it crosses at now (a twentieth of light in the Dusk, half of it after).">
                {`in ${formatYears(due - s.years)}${isFinite(dueTurns) ? `, ~${dueTurns} turn${dueTurns === 1 ? '' : 's'}` : ''}`}
              </dd>
            </>
          )}
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
          {!sw.tamed && at && warshipsAt(s, at.id).fleets.length > 0 && <AttackButton s={s} systemId={at.id} fleetId={warshipsAt(s, at.id).fleets[0].id} />}
        </div>
      </div>
    </>
  );
}
