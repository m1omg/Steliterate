import { signal } from '@preact/signals';
import { SHIP_BY_ID, fleetLook } from '../../game/data/ships';
import { orderFleet, setAutoExplore, standFleet } from '../../game/sim/actions';
import { canSurvey, isIdleFleet, isWarFleet } from '../../game/sim/fleets';
import { TRIP_TIP, tripLabel } from '../trip';
import { computeMods } from '../../game/sim/mods';
import { colonies, distLy } from '../../game/sim/util';
import type { Fleet, GameState } from '../../game/types';
import { Icon } from '../Icon';
import { BEACON_TIP, isBeacon } from '../labels';
import { act, rev } from '../store';
import { goToFleet, pickOnMap, pivotToSystem, sendFromSystems } from '../screens/Lists';
import { sfx } from '../../audio/sfx';
import { researchPrompt } from './ResearchPrompt';
import { useRef } from 'preact/hooks';
import { useFocusPrompt } from '../a11y';

/** Fleets that have just run out of orders, oldest first. Shown one at a time. */
export const shipQueue = signal<string[]>([]);
/** Set to bring one fleet to the front (the idle-ships chip does this). */
export const shipPrompt = signal<string | null>(null);

function drop(id: string) {
  shipQueue.value = shipQueue.value.filter((x) => x !== id);
  if (shipPrompt.value === id) shipPrompt.value = null;
}

interface Option {
  label: string;
  sub: string;
  run: (g: GameState) => string | null | void;
  beacon?: boolean;
}

function suggestions(s: GameState, f: Fleet): Option[] {
  const here = s.systems[f.at!];
  const mods = computeMods(s);
  const ways = (ids: string[], order: 'survey' | 'move') =>
    ids
      .map((id) => s.systems[id])
      .map((sys) => ({ sys, ly: distLy(here, sys) }))
      .sort((a, b) => a.ly - b.ly)
      .slice(0, 3)
      .map(({ sys, ly }) => ({ label: sys.name, sub: `${tripLabel(s, ly, mods)}${order === 'survey' ? ' · survey' : ''}`, run: (g: GameState) => orderFleet(g, f.id, sys.id, order) }));
  // in the Degenerate Age the collision stars on our map come first
  const beacons = Object.values(s.systems).filter((x) => isBeacon(s, x) && x.id !== here.id);
  const top = ways(beacons.map((x) => x.id), 'move').map((o) => ({ ...o, beacon: true }));
  const skip = new Set(beacons.map((x) => x.name));
  if (f.ships.some((x) => SHIP_BY_ID[x.cls]?.survey)) {
    const unsurveyed = Object.values(s.systems).filter((x) => s.civ.known[x.id] === 1 && !x.gone && x.id !== here.id).map((x) => x.id);
    return [...top, ...ways(unsurveyed, 'survey').filter((o) => !skip.has(o.label))];
  }
  // any other ship charts a star it reaches too: offer the nearest uncharted ones, then home
  const unsurveyed = Object.values(s.systems).filter((x) => s.civ.known[x.id] === 1 && !x.gone && x.id !== here.id).map((x) => x.id);
  const ours = [...new Set(colonies(s).map((c) => c.systemId))].filter((id) => id !== here.id);
  const chart = f.ships.some((x) => SHIP_BY_ID[x.cls]?.settles) ? [] : ways(unsurveyed, 'move').slice(0, 2).map((o) => ({ ...o, sub: `${o.sub} · survey` }));
  return [...top, ...chart, ...ways(ours, 'move').filter((o) => !skip.has(o.label))].filter((o, i, a) => a.findIndex((x) => x.label === o.label) === i);
}

export function ShipPrompt({ s }: { s: GameState }) {
  void rev.value;
  // the research prompt goes first; the two never stack
  if (researchPrompt.value && !s.civ.researching) return null;
  const ids = [...(shipPrompt.value ? [shipPrompt.value] : []), ...shipQueue.value];
  const f = ids.map((id) => s.fleets[id]).find((x) => x && isIdleFleet(x));
  if (!f) return null;
  return <ShipCard s={s} f={f} />;
}

function ShipCard({ s, f }: { s: GameState; f: Fleet }) {
  const head = useRef<HTMLDivElement>(null);
  useFocusPrompt(head, f.id);
  const here = s.systems[f.at!];
  const war = isWarFleet(f);
  const options = suggestions(s, f);
  const choose = (run: (g: GameState) => string | null | void) => {
    if (act(run)) {
      sfx('select');
      drop(f.id);
    }
  };
  return (
    <div class="research-prompt ship-prompt panel" role="dialog" aria-label="A ship awaits orders">
      <div class="row">
        <img class="fleet-thumb" src={`art/ships/${fleetLook(f.ships.map((x) => x.cls))}.png`} alt="" />
        <div class="grow">
          <div class="eyebrow">
            Awaiting orders ·{' '}
            <button class="linkbtn" onClick={() => pivotToSystem(here.id)} data-tip={`Centre the view on ${here.name}`}>
              <Icon name="focus" /> {here.name}
            </button>
          </div>
          <div ref={head} class="rp-title">
            {f.name}
          </div>
        </div>
        <button class="btn ghost small" aria-label="Later" data-tip="Later: ask again next time" onClick={() => drop(f.id)}>
          <Icon name="close" />
        </button>
      </div>
      {options.length > 0 && (
        <div class="rp-options">
          {options.map((o) => (
            <button key={o.label} class="btn small rp-option" onClick={() => choose(o.run)}>
              <span class="grow">
                {o.label}
                {o.beacon && <span class="chip boon" style={{ marginLeft: '6px' }} data-tip={BEACON_TIP}>collision star</span>}
              </span>
              <span class="mono faint" data-tip={TRIP_TIP}>{o.sub}</span>
            </button>
          ))}
        </div>
      )}
      <div class="row wrap" style={{ gap: '6px', marginTop: '8px' }}>
        {canSurvey(f) && (
          <button class="btn small primary" data-tip="Keep charting on its own: always the nearest unsurveyed star, keeping a little energy in reserve. It stops asking until nothing is left to chart." onClick={() => choose((g) => setAutoExplore(g, f.id, true))}>
            <Icon name="survey" /> Auto-explore
          </button>
        )}
        {war ? (
          <button class="btn small primary" data-tip="Dig in here: stronger defence, and it stops asking." onClick={() => choose((g) => standFleet(g, f.id, 'fortify'))}>
            <Icon name="shield" /> Fortify here
          </button>
        ) : (
          <button class="btn small ghost" data-tip="Park it here: the game stops asking about it." onClick={() => choose((g) => standFleet(g, f.id, 'hold'))}>
            Hold here
          </button>
        )}
        <button class="btn small" onClick={() => pickOnMap(f)} data-tip="Pick any star on the galaxy map as its destination">
          <Icon name="move" /> Choose on map
        </button>
        <button
          class="btn small"
          data-tip="Choose from the Systems window: our settlements, every surveyed world and the collision stars, near or far"
          onClick={() => sendFromSystems(s, f)}
        >
          <Icon name="system" /> From Systems…
        </button>
        <button class="btn small ghost" onClick={() => pivotToSystem(here.id, true)} data-tip={`Step inside ${here.name} to see its worlds`}>
          <Icon name="system" /> Look inside
        </button>
        <button
          class="btn small ghost"
          data-tip="Open the fleet's panel, with every destination"
          onClick={() => {
            goToFleet(s, f);
            drop(f.id);
          }}
        >
          All orders…
        </button>
      </div>
    </div>
  );
}
