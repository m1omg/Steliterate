import { signal } from '@preact/signals';
import { SHIP_BY_ID, fleetLook } from '../../game/data/ships';
import { orderFleet, standFleet } from '../../game/sim/actions';
import { isIdleFleet, isWarFleet, travelTurnsEstimate } from '../../game/sim/fleets';
import { computeMods } from '../../game/sim/mods';
import { colonies, distLy } from '../../game/sim/util';
import type { Fleet, GameState } from '../../game/types';
import { Icon } from '../Icon';
import { act, rev } from '../store';
import { goToFleet } from '../screens/Lists';
import { sfx } from '../../audio/sfx';
import { researchPrompt } from './ResearchPrompt';

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
      .map(({ sys, ly }) => ({ label: sys.name, sub: `~${travelTurnsEstimate(s, ly, mods)}t${order === 'survey' ? ' · survey' : ''}`, run: (g: GameState) => orderFleet(g, f.id, sys.id, order) }));
  if (f.ships.some((x) => SHIP_BY_ID[x.cls]?.survey)) {
    const unsurveyed = Object.values(s.systems).filter((x) => s.civ.known[x.id] === 1 && !x.gone && x.id !== here.id).map((x) => x.id);
    return ways(unsurveyed, 'survey');
  }
  const ours = [...new Set(colonies(s).map((c) => c.systemId))].filter((id) => id !== here.id);
  return ways(ours, 'move');
}

export function ShipPrompt({ s }: { s: GameState }) {
  void rev.value;
  // the research prompt goes first; the two never stack
  if (researchPrompt.value && !s.civ.researching) return null;
  const ids = [...(shipPrompt.value ? [shipPrompt.value] : []), ...shipQueue.value];
  const f = ids.map((id) => s.fleets[id]).find((x) => x && isIdleFleet(x));
  if (!f) return null;
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
          <div class="eyebrow">Awaiting orders · {here?.name}</div>
          <div class="rp-title">{f.name}</div>
        </div>
        <button class="btn ghost small" aria-label="Later" data-tip="Later: ask again next time" onClick={() => drop(f.id)}>
          <Icon name="close" />
        </button>
      </div>
      {options.length > 0 && (
        <div class="rp-options">
          {options.map((o) => (
            <button key={o.label} class="btn small rp-option" onClick={() => choose(o.run)}>
              <span class="grow">{o.label}</span>
              <span class="mono faint">{o.sub}</span>
            </button>
          ))}
        </div>
      )}
      <div class="row wrap" style={{ gap: '6px', marginTop: '8px' }}>
        {war ? (
          <button class="btn small primary" data-tip="Dig in here: stronger defence, and it stops asking." onClick={() => choose((g) => standFleet(g, f.id, 'fortify'))}>
            <Icon name="shield" /> Fortify here
          </button>
        ) : (
          <button class="btn small" data-tip="Park it here: the game stops asking about it." onClick={() => choose((g) => standFleet(g, f.id, 'hold'))}>
            Hold here
          </button>
        )}
        <button
          class="btn small ghost"
          onClick={() => {
            goToFleet(s, f);
            drop(f.id);
          }}
        >
          Show…
        </button>
      </div>
    </div>
  );
}
