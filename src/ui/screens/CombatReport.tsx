import { useEffect } from 'preact/hooks';
import { ERA_BY_ID } from '../../game/eras';
import type { GameState, LogEntry } from '../../game/types';
import { Icon } from '../Icon';
import { modal } from '../store';
import { ModalFrame } from './Frame';
import { goToFleet, pivotToSystem } from './Lists';

/**
 * The fights of the turn just played, as they went for us (26 Oct, the player: "there also should
 * be popups for combat, rn often you defeat a swarm or get your fleet destroyed with just tiny text
 * footnote in events"): every line of the Record a fight left this turn, won or lost (`tone`,
 * combatLog), the losses first, each with Look. Over a Long Sleep, the turns' fights together, as
 * it ends (turnflow.ts).
 */
export function CombatReport({ s, entries }: { s: GameState; entries: LogEntry[] }) {
  // Enter closes it too, as it closes an event's result (a button in focus answers Enter itself)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || (e.target as HTMLElement | null)?.tagName === 'BUTTON') return;
      e.preventDefault();
      modal.value = null;
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const bad = entries.filter((e) => e.tone === 'bad');
  const good = entries.filter((e) => e.tone === 'good');
  const turns = [...new Set(entries.map((e) => e.turn))];
  const eyebrow = `${turns.length > 1 ? `Turns ${turns[0]} to ${turns[turns.length - 1]}` : `Turn ${turns[0] ?? s.turn}`} · ${good.length ? `${good.length} won` : ''}${good.length && bad.length ? ', ' : ''}${bad.length ? `${bad.length} lost` : ''}`;
  const look = (e: LogEntry) => {
    const f = e.fleet ? s.fleets[e.fleet] : undefined;
    if (f) goToFleet(s, f);
    else if (e.systemId) {
      modal.value = null;
      pivotToSystem(e.systemId);
    }
  };
  return (
    <ModalFrame
      title="Combat"
      eyebrow={eyebrow}
      icon="attack"
      narrow
      foot={
        <button class="btn primary" onClick={() => (modal.value = null)} data-tip="Close (Esc, or Enter)">
          Close
        </button>
      }
    >
      <div class="list combat-report">
        {[...bad, ...good].map((e, i) => (
          <div key={i} class={`list-item combat-line ${e.tone}`} style={{ cursor: 'default' }}>
            <Icon name={e.tone === 'bad' ? 'warning' : 'attack'} cls={e.tone === 'bad' ? 'bad' : 'good'} />
            <span class="grow">
              {e.text}
              <div class="faint mono" style={{ fontSize: '11.5px' }}>
                {ERA_BY_ID[e.era].numeral}·{e.turn}
                {e.systemId && s.systems[e.systemId] ? ` · ${s.systems[e.systemId].name}` : ''}
              </div>
            </span>
            {(e.systemId || (e.fleet && s.fleets[e.fleet])) && (
              <button class="btn small ghost" onClick={() => look(e)} data-tip={e.fleet && s.fleets[e.fleet] ? `Go to ${s.fleets[e.fleet].name}` : `Go to ${s.systems[e.systemId!]?.name ?? 'the star'}`}>
                <Icon name="focus" /> Look
              </button>
            )}
          </div>
        ))}
      </div>
    </ModalFrame>
  );
}
