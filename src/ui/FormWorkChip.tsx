// A change of form under way at a settlement, as a chip: the Passage, writing into a horizon,
// weaving into the positronium (28 Oct, the player: "make the system view shows systems that are
// inprogress of the leptonic Passage"). In Our settlements and in a system's Worlds list.
import type { Colony } from '../game/types';

/**
 * A change of form under way at a settlement, in its queue: the Passage onto leptonic substrate,
 * writing into a hole's horizon, weaving into the positronium. Its name, a short one for a chip, how
 * far along it is, and the turns left at this industry (all that is queued before it first); null
 * where none is.
 */
export function formWork(c: Colony, industry: number): { name: string; short: string; done: number; turns: number } | null {
  const i = c.queue.findIndex((q) => q.kind === 'passage' || q.kind === 'horizon' || q.kind === 'weave');
  if (i < 0) return null;
  const q = c.queue[i];
  const left = c.queue.slice(0, i + 1).reduce((a, x) => a + Math.max(0, x.cost - x.progress), 0);
  const names = { passage: ['The Passage', 'Passage'], horizon: ['Writing into the horizon', 'into the horizon'], weave: ['Weaving through the positronium', 'weaving'] } as const;
  const [name, short] = names[q.kind as 'passage' | 'horizon' | 'weave'];
  return { name, short, done: q.cost > 0 ? q.progress / q.cost : 0, turns: industry > 0 ? Math.ceil(left / industry) : Infinity };
}

/** A change of form under way, as a chip's words and tip: "Passage 42%", "The Passage under way: 42% done, about 6 turns more". */
function formWorkText(w: { name: string; short: string; done: number; turns: number }): { text: string; tip: string } {
  const pc = Math.floor(w.done * 100);
  return {
    text: `${w.short} ${pc}%`,
    tip: `${w.name} under way: ${pc}% done, ${isFinite(w.turns) ? `about ${w.turns} turn${w.turns === 1 ? '' : 's'} more at this settlement’s industry` : 'stalled: no industry here'}.`,
  };
}

/** The chip: "Passage 42%", its tip how far along and how long; nothing where no change of form is under way. */
export function FormWorkChip({ c, industry }: { c: Colony; industry: number }) {
  const w = formWork(c, industry);
  if (!w) return null;
  const t = formWorkText(w);
  return (
    <span class="chip neon form-work" style={{ marginLeft: '6px' }} data-tip={t.tip}>
      {t.text}
    </span>
  );
}
