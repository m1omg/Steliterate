import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { SHIP_BY_ID, fleetLook } from '../../game/data/ships';
import { STRUCTURE_BY_ID } from '../../game/data/structures';
import { THREAD_DEFS } from '../../game/data/threads';
import { formatDistance, formatYears } from '../../game/eras';
import { bodyClimate, primaryTemperature, sourceLight, waterState } from '../../game/physics';
import {
  absorb,
  buildableShips,
  buildableStructures,
  buildCost,
  convert,
  disbandFleet,
  moveQueued,
  orderFleet,
  standFleet,
  placeBeacon,
  queueBuild,
  removeQueued,
  rushBuild,
  rushCost,
  setFocus,
  tame,
  toggleOverdrive,
  type Conversion,
} from '../../game/sim/actions';
import { capacity } from '../../game/sim/economy';
import { canSettle, launchCost, travelTurnsEstimate } from '../../game/sim/fleets';
import { computeMods } from '../../game/sim/mods';
import { project, structureEffect, type BuildEffect } from '../../game/sim/projection';
import { capital, distLy, hasCharter, hasTech, popsOf } from '../../game/sim/util';
import type { Body, Colony, Fleet, GameState, StarSystem, Swarm, ThreadId } from '../../game/types';
import { THREADS } from '../../game/types';
import { n0, n1, pct, signed } from '../fmt';
import { Icon } from '../Icon';
import type { IconName } from '../icons';
import { BODY_NAME, FOCUS, PRIMARY_NAME, TRAIT_NAME, bodyIcon, primaryIcon } from '../labels';
import { act, engine, rev, selection, targeting, view } from '../store';
import { FORTIFY_BONUS, isWarFleet } from '../../game/sim/fleets';
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
          {(sys.rust ?? 0) > 0.05 && <span class="chip danger">rust {pct(sys.rust ?? 0)}</span>}
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
        <p class="flavor" style={{ margin: '0 0 8px' }}>{src.label}.</p>
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
              <dt>Burns until</dt>
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
            <div class="row" style={{ fontSize: '13px' }}>
              <span style={{ width: '10px', height: '10px', background: survivor.color, display: 'inline-block' }} />
              <span class="grow">{survivor.name}</span>
              <span class="faint">{survivor.contact ? `${n0(survivor.pop)} people` : 'not contacted'}</span>
            </div>
          </div>
        )}
        {known === 1 && (
          <p class="dim" style={{ fontSize: '12px' }}>
            Seen from afar: the star is known, its worlds are not. Send a probe to survey it.
          </p>
        )}
        {known === 2 && (
          <div class="section">
            <h3>Bodies</h3>
            <div class="list">
              {sys.bodies
                .map((id) => s.bodies[id])
                .filter((b) => b && !b.dissolved)
                .map((b) => {
                  const c = b.colonyId ? s.colonies[b.colonyId] : null;
                  return (
                    <div key={b.id} class="list-item" onClick={() => selectBody(b)}>
                      <Icon name={bodyIcon(b.kind)} cls={c ? 'neon' : ''} />
                      <span class="grow">
                        {c ? c.name : b.name} <span class="faint" style={{ fontSize: '11px' }}>{BODY_NAME[b.kind]}</span>
                      </span>
                      {known === 2 && b.relic && b.relic.state !== 'hidden' && <Icon name="relic" cls="accent" />}
                      {b.rogue && <span class="chip warn">rogue</span>}
                      {b.feeding && <span class="chip boon">feeding</span>}
                      {c ? <span class="mono neon" style={{ fontSize: '12px' }}>{popsOf(c)}</span> : known === 2 && b.habitability > 0.3 ? <span class="mono faint" style={{ fontSize: '11px' }} data-tip="Habitability × vitality">{pct(b.habitability * b.vitality)}</span> : null}
                    </div>
                  );
                })}
            </div>
          </div>
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

/** Temperature and water rows for a world's key/value list. */
function ClimateRows({ s, b }: { s: GameState; b: Body }) {
  if (b.kind === 'deep' || b.kind === 'gas_giant' || b.kind === 'ice_giant') return null;
  const c = bodyClimate(s, b);
  const tip = 'From starlight, the world’s own heat and what is left of its air. Tidally locked worlds keep a hot day side and a cold night side.';
  return (
    <>
      <dt data-tip={tip}>Temperature</dt>
      <dd class="mono" data-tip={c.day !== undefined ? `Day side ${kelvin(c.day)}\nNight side ${kelvin(c.night!)}` : ''}>
        {c.day !== undefined ? `${n0(c.night!)}–${n0(c.day)} K` : kelvin(c.mean)}
      </dd>
      <dt>Water</dt>
      <dd style={{ fontSize: '12px' }}>{waterState(b, c)}</dd>
    </>
  );
}

// ------------------------------------------------------------------ uninhabited body

function BodyPanel({ s, b }: { s: GameState; b: Body }) {
  void rev.value; // mutable game state: re-render on every change
  const sys = s.systems[b.systemId];
  const surveyed = s.civ.known[sys.id] === 2;
  const settlers = Object.values(s.fleets).filter((f) => f.at && f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles && (!SHIP_BY_ID[x.cls]?.inSystem || f.at === b.systemId)));
  return (
    <>
      <div class="drawer-head">
        <div class="eyebrow">
          <span style={{ cursor: 'pointer' }} onClick={() => selectSystem(sys.id)}>{sys.name}</span> · {BODY_NAME[b.kind]}
        </div>
        <h2>{b.name}</h2>
        <div class="row wrap" style={{ marginTop: '6px' }}>
          {b.traits.map((t) => (
            <span key={t} class="chip" data-tip={TRAIT_NAME[t]?.[1] ?? ''}>{TRAIT_NAME[t]?.[0] ?? t}</span>
          ))}
          {b.rogue && <span class="chip warn" data-tip="Stripped from its star by a close stellar pass. Only its own heat is left.">rogue</span>}
          {b.feeding && <span class="chip boon" data-tip="Being torn apart by its dead star; the debris stream heats the star.">feeding its star</span>}
        </div>
      </div>
      <div class="drawer-body scroll">
        {!surveyed ? (
          <p class="flavor">Not yet surveyed. Send a probe to learn what is here.</p>
        ) : (
          <dl class="kv">
            <dt>Habitability</dt>
            <dd class="mono">{pct(b.habitability)}</dd>
            <dt>Vitality</dt>
            <dd class="mono">{pct(b.vitality)}</dd>
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
                <dd>{b.relic.kind} · {b.relic.state}</dd>
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
                    <div class="faint mono" style={{ fontSize: '11px' }}>{ly > 0 ? `${formatDistance(ly)} · ~${travelTurnsEstimate(s, ly, mods)} turns · ${n0(launchCost(s, f, ly, mods))} energy` : 'here'}</div>
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
          <span style={{ cursor: 'pointer' }} onClick={() => selectSystem(sys.id)}>{sys.name}</span> · {BODY_NAME[b.kind]}
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
              <div class="yields">
                <div data-tip={`Energy\n${lineTip('energy')}\nUpkeep −${n1(y.energyUpkeep)}`}>
                  <Icon name="energy" cls="accent" /> <span class={`mono ${eNet >= 0 ? 'good' : 'bad'}`}>{signed(eNet)}</span>
                </div>
                <div data-tip={`Matter\n${lineTip('matter')}${y.matterUpkeep ? `\nUsed −${n1(y.matterUpkeep)}` : ''}`}>
                  <Icon name="matter" /> <span class="mono">{signed(y.matter - y.matterUpkeep)}</span>
                </div>
                <div data-tip={`Industry\n${lineTip('industry')}`}>
                  <Icon name="industry" /> <span class="mono">{n1(y.industry)}</span>
                </div>
                <div data-tip={`Insight\n${lineTip('insight')}`}>
                  <Icon name="insight" /> <span class="mono">{n1(y.insight)}</span>
                </div>
                <div data-tip={`Accord\n${lineTip('accord')}`}>
                  <Icon name="accord" /> <span class="mono">{signed(y.accord)}</span>
                </div>
              </div>
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
                  .filter(([, n]) => n > 0)
                  .map(([id, n]) => (
                    <span key={id} class="chip" data-tip={STRUCTURE_BY_ID[id]?.desc ?? ''}>
                      {STRUCTURE_BY_ID[id]?.name ?? id}
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
                data-tip={`${def.name}\n${def.desc}${error ? `\n${error}` : ''}`}
                onClick={() => act((g) => queueBuild(g, c.id, 'ship', def.id)) && sfx('build')}
              >
                <Icon name="colonize" /> {def.name}
                <span class="mono faint">
                  {cost.industry}
                  <Icon name="industry" />
                  {cost.matter > 0 && (
                    <>
                      {' '}
                      {cost.matter}
                      <Icon name="matter" />
                    </>
                  )}
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

function BuildTab({ s, c, industry }: { s: GameState; c: Colony; industry: number }) {
  void rev.value; // mutable game state: re-render on every change
  const [kind, setKind] = useState<'structure' | 'ship'>('structure');
  const rc = rushCost(s, c.id);
  let acc = 0;
  const ctx = project(s).ctx;
  const list: { id: string; name: string; desc: string; error: string | null | undefined; cost: ReturnType<typeof buildCost>; count: number; fx?: BuildEffect }[] =
    kind === 'structure'
      ? buildableStructures(s, c).map((x) => ({ id: x.def.id, name: x.def.name, desc: x.def.desc, error: x.error, cost: buildCost(s, x.def, false), count: c.structures[x.def.id] ?? 0, fx: structureEffect(s, c, x.def.id, ctx) }))
      : buildableShips(s, c).map((x) => ({ id: x.def.id, name: x.def.name, desc: x.def.desc, error: x.error, cost: buildCost(s, x.def, true), count: 0 }));
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
                <span class="grow">{def?.name ?? q.key}</span>
                <span class="mono faint" style={{ fontSize: '11px' }}>{isFinite(turns) ? `${turns} turn${turns > 1 ? 's' : ''}` : 'stalled'}</span>
                <button class="btn ghost small" aria-label="Move up" disabled={i === 0} onClick={() => act((g) => moveQueued(g, c.id, q.uid, -1))}>▲</button>
                <button class="btn ghost small" aria-label="Move down" disabled={i === c.queue.length - 1} onClick={() => act((g) => moveQueued(g, c.id, q.uid, 1))}>▼</button>
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
        <div class="list">
          {list.map((x) => (
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
                {x.name}
                {x.count > 0 && <span class="faint"> ×{x.count}</span>}
                {x.fx && <EffectLine fx={x.fx} />}
                <div class="build-desc">{x.desc}</div>
                {x.error && <div class="faint" style={{ fontSize: '11px' }}>{x.error}</div>}
              </span>
              <span class="mono faint" style={{ fontSize: '11px', textAlign: 'right' }}>
                {x.cost.industry}<Icon name="industry" />
                {x.cost.matter > 0 && <> {x.cost.matter}<Icon name="matter" /></>}
                {x.cost.energy > 0 && <> {x.cost.energy}<Icon name="energy" /></>}
              </span>
            </div>
          ))}
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

function FleetPanel({ s, f }: { s: GameState; f: Fleet }) {
  void rev.value; // mutable game state: re-render on every change
  const mods = computeMods(s);
  const here = f.at ? s.systems[f.at] : null;
  const settler = f.ships.find((x) => SHIP_BY_ID[x.cls]?.settles);
  const surveyor = f.ships.some((x) => SHIP_BY_ID[x.cls]?.survey);
  const tender = f.ships.some((x) => SHIP_BY_ID[x.cls]?.tames);
  const tgt = targeting.value?.fleetId === f.id;
  const dests = here
    ? Object.values(s.systems)
        .filter((x) => x.id !== here.id && !x.gone && (s.civ.known[x.id] ?? 0) > 0)
        .map((x) => ({ sys: x, ly: distLy(here, x) }))
        .sort((a, b) => (surveyor ? Number(s.civ.known[a.sys.id] === 2) - Number(s.civ.known[b.sys.id] === 2) : 0) || a.ly - b.ly)
        .slice(0, 10)
    : [];
  const settleDef = settler ? SHIP_BY_ID[settler.cls] : null;
  const settleTargets =
    here && settleDef
      ? Object.values(s.bodies)
          .filter((b) => s.civ.known[b.systemId] === 2 && (!settleDef.inSystem || b.systemId === here.id) && !canSettle(s, b, settleDef.settles!.thread))
          .map((b) => ({ b, ly: distLy(here, s.systems[b.systemId]), room: Math.floor(12 * b.habitability * b.vitality) }))
          .sort((a, b) => a.ly - b.ly || b.room - a.room)
          .slice(0, 10)
      : [];
  const swarmHere = here ? Object.values(s.swarms).find((w) => w.systemId === here.id && !w.tamed) : null;
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
        </div>
      </div>
      <div class="drawer-body scroll">
        {!here && f.to && (
          <>
            <div class="bar neon" style={{ marginBottom: '6px' }}><i style={{ width: pct(f.distance > 0 ? f.traveled / f.distance : 1) }} /></div>
            <div class="mono dim" style={{ fontSize: '12px' }}>
              {formatDistance(f.traveled)} of {formatDistance(f.distance)} · about {travelTurnsEstimate(s, f.distance - f.traveled, mods)} more turn(s)
            </div>
            {f.order === 'colonize' && f.targetBody && <div class="faint" style={{ fontSize: '12px', marginTop: '4px' }}>To settle {s.bodies[f.targetBody]?.name}.</div>}
          </>
        )}
        {here && (
          <>
            <div class="row wrap" style={{ gap: '4px' }}>
              <button class={`btn small ${tgt ? 'on' : ''}`} onClick={() => (targeting.value = tgt ? null : { fleetId: f.id, order: 'move' })} data-tip="Then click a destination on the map.">
                <Icon name="move" /> {tgt ? 'Pick a destination…' : 'Move'}
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
              <button class="btn small danger" data-tip="Scrap the fleet here and recover some matter." onClick={() => act((g) => disbandFleet(g, f.id)) && (selection.value = null)}>
                Disband
              </button>
            </div>
            {settleTargets.length > 0 && (
              <div class="section">
                <h3>Where to settle</h3>
                <div class="list">
                  {settleTargets.map(({ b, ly, room }) => (
                    <div key={b.id} class="list-item" onClick={() => act((g) => orderFleet(g, f.id, b.systemId, 'colonize', b.id)) && sfx('good')}>
                      <Icon name={bodyIcon(b.kind)} />
                      <span class="grow">
                        {b.name} <span class="faint" style={{ fontSize: '11px' }}>{BODY_NAME[b.kind]}{b.systemId !== here.id ? ` · ${s.systems[b.systemId].name}` : ''}</span>
                      </span>
                      {settleDef?.settles?.thread === 'kin' &&
                        (room > 0 ? (
                          <span class="chip good" data-tip={`Room for ${room} Kin without building anything.`}>{room} room</span>
                        ) : (
                          <span class="chip" data-tip="Nothing lives here. The Kin will live in the dome they bring, and in any domes or warrens you build.">domes only</span>
                        ))}
                      <span class="mono faint" style={{ fontSize: '11px' }}>{ly > 0 ? `~${travelTurnsEstimate(s, ly, mods)}t` : 'here'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div class="section">
              <h3>{surveyor ? 'Unsurveyed nearby' : 'Nearby'}</h3>
              <div class="list">
                {dests.map(({ sys, ly }) => (
                  <div key={sys.id} class="list-item" onClick={() => act((g) => orderFleet(g, f.id, sys.id, 'move')) && sfx('select')}>
                    <Icon name={primaryIcon(sys.primary.kind)} />
                    <span class="grow">
                      {sys.name}
                      {s.civ.known[sys.id] !== 2 && <span class="faint" style={{ fontSize: '11px' }}> unsurveyed</span>}
                    </span>
                    <span class="mono faint" style={{ fontSize: '11px' }} data-tip="Distance · turns at the current Tide · launch energy">
                      {formatDistance(ly)} · ~{travelTurnsEstimate(s, ly, mods)}t · {n0(launchCost(s, f, ly, mods))}
                      <Icon name="energy" />
                    </span>
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
