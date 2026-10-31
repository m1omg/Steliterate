// The governor's controls, shared by a settlement's Build tab, a system's Worlds list and the
// Systems window's Our settlements (27 and 31 Oct, the player: "add a governor like in alpha
// centauri…", "allow me to mark different worlds in system view to set the governor to", "Please
// add a governor-setter into the Systems menu").
import { STRUCTURE_KINDS, structureLabel, type StructureKind } from '../game/data/structures';
import { GOVERNOR_KEEPS, governorChoice, governorName } from '../game/sim/governor';
import { project } from '../game/sim/projection';
import { formOf } from '../game/sim/util';
import type { Colony, GameState } from '../game/types';
import { Icon } from './Icon';
import type { IconName } from './icons';

/** The icon for each kind of structure; its colour comes from `.kind-<kind>` in styles.css. */
export const KIND_ICON: Record<StructureKind, IconName> = { energy: 'energy', storage: 'reserve', matter: 'matter', industry: 'industry', insight: 'insight', accord: 'accord', people: 'kin', world: 'planet', defence: 'shield' };

export const GOVERNOR_TIP = `A governor chooses this settlement’s builds: whenever its queue is empty, it queues the structure of one kind that gives it the most for what it costs, here and now, keeping ${GOVERNOR_KEEPS.matter} matter in store. What you queue comes first; it waits for the queue to empty. Off: you choose.`;

/**
 * Off, or one of the build list's kinds: the governor's choice (27 Oct, the player: "add a governor
 * like in alpha centauri to set a focus on building buildings of a certain category"). `value`
 * 'mixed' where the settlements it sets differ.
 */
export function GovernorPicker({ value, onPick, label }: { value: StructureKind | null | 'mixed'; onPick: (k: StructureKind | null) => void; label: string }) {
  return (
    <div class="governor-picker" role="group" aria-label={label}>
      <button class={`btn small ${value === null ? 'primary' : ''}`} aria-pressed={value === null} data-tip="No governor: you choose what is built" onClick={() => onPick(null)}>
        Off
      </button>
      {STRUCTURE_KINDS.map((k) => (
        <button key={k.id} class={`btn small kind-${k.id} ${value === k.id ? 'primary' : ''}`} aria-pressed={value === k.id} data-tip={`${k.name}: ${k.tip}
Whenever the queue is empty, the governor queues the ${k.name.toLowerCase()} structure worth the most here for what it costs.`} onClick={() => onPick(k.id)}>
          <Icon name={KIND_ICON[k.id]} /> {k.name}
        </button>
      ))}
    </div>
  );
}

/** What a settlement's governor does next, in words. */
export function governorLine(s: GameState, c: Colony): string {
  if (!c.governor) return '';
  const name = governorName(c.governor);
  if (c.queue.length) return `Once the queue is done, the governor builds ${name}.`;
  const g = governorChoice(s, c, project(s).ctx);
  return g.pick ? `Next: ${structureLabel(g.pick.id, s.systems[c.systemId], formOf(c)).name}, at the turn’s start.` : `The governor builds ${name}: ${g.why}.`;
}

/** A governed settlement's chip: its kind, and on its tip what it does next. */
export function GovernorChip({ s, c }: { s: GameState; c: Colony }) {
  if (!c.governor) return null;
  return (
    <span class={`chip governor-chip kind-${c.governor}`} style={{ marginLeft: '6px' }} data-tip={`Governor: ${governorName(c.governor)}. ${governorLine(s, c)}`}>
      <Icon name={KIND_ICON[c.governor]} /> {governorName(c.governor)}
    </span>
  );
}
