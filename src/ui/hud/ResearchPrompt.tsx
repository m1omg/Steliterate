import { signal } from '@preact/signals';
import { TECH_BY_ID } from '../../game/data/techs';
import { setResearch } from '../../game/sim/actions';
import { project } from '../../game/sim/projection';
import { IDLE_STUDY, RESEARCH_DRAW, availableTechs, techCost } from '../../game/sim/research';
import { eraIndex } from '../../game/sim/util';
import type { GameState } from '../../game/types';
import { n0, n1 } from '../fmt';
import { Icon } from '../Icon';
import { act, modal, notify, rev } from '../store';
import { sfx } from '../../audio/sfx';
import { useRef } from 'preact/hooks';
import { useFocusPrompt } from '../a11y';

/** Set when a project finishes; cleared when the player picks the next one or pauses. */
export const researchPrompt = signal<{ done: string } | null>(null);

export function ResearchPrompt({ s }: { s: GameState }) {
  void rev.value;
  const rp = researchPrompt.value;
  const head = useRef<HTMLDivElement>(null);
  useFocusPrompt(head, rp && !s.civ.researching ? rp.done : null);
  if (!rp || s.civ.researching) return null;
  const done = TECH_BY_ID[rp.done];
  const p = project(s);
  const perTurn = Math.max(0.1, p.insight * (s.civ.work ? 0.5 : 1));
  const bank = s.civ.flags.insight_bank ?? 0;
  const options = availableTechs(s)
    .filter((t) => !t.taint)
    .sort((a, b) => eraIndex(b.era) - eraIndex(a.era) || techCost(s, a.id) - techCost(s, b.id))
    .slice(0, 4);
  const pick = (id: string) => {
    if (!act((g) => setResearch(g, id))) return;
    if (s.civ.techs.includes(id)) {
      // stored insight covered it: done at once; keep the prompt up for the next choice
      sfx('good');
      notify(`${TECH_BY_ID[id]?.name ?? id}: worked out at once from stored insight.`, 'good');
      researchPrompt.value = { done: id };
    } else {
      sfx('select');
      researchPrompt.value = null;
    }
  };
  return (
    <div class="research-prompt panel" role="dialog" aria-label="Research complete">
      <div class="row">
        <Icon name="research" size="lg" cls="accent" />
        <div class="grow">
          <div class="eyebrow">Research complete</div>
          <div ref={head} class="rp-title">
            {done?.name ?? rp.done}
          </div>
        </div>
        <button class="btn ghost small" aria-label="Close" onClick={() => (researchPrompt.value = null)}>
          <Icon name="close" />
        </button>
      </div>
      {done && <div class="dim rp-desc">{done.desc}</div>}
      <div class="eyebrow" style={{ marginTop: '8px' }}>
        Next{bank > 0 ? ` · ${n0(bank)} insight carried over` : ''}
      </div>
      <div class="rp-options">
        {options.map((t) => {
          const left = Math.max(0, techCost(s, t.id) - (s.civ.research[t.id] ?? 0) - bank);
          return (
            <button key={t.id} class="btn small rp-option" data-tip={t.desc} onClick={() => pick(t.id)}>
              <span class="grow">{t.name}</span>
              <span class="mono faint">{left <= 0 ? 'now' : `~${Math.max(1, Math.ceil(left / perTurn))}t`}</span>
            </button>
          );
        })}
      </div>
      <div class="row wrap" style={{ gap: '6px', marginTop: '8px' }}>
        <button class="btn small" onClick={() => (modal.value = { kind: 'research' })}>
          All projects…
        </button>
        <button
          class="btn small ghost"
          data-tip={`With nothing chosen, the labs stand down: saves about ${n1(p.insight * RESEARCH_DRAW)} energy a turn, but only ${Math.round(IDLE_STUDY * 100)}% of insight is kept for later.`}
          onClick={() => {
            sfx('click');
            researchPrompt.value = null;
          }}
        >
          Pause research
        </button>
      </div>
    </div>
  );
}
