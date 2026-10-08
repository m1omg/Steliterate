// A settlement's yields each turn, as its panel and the Systems window's list of settlements show
// them: energy and matter net of what it uses, industry, insight and accord, and what makes up each.

import type { YieldBreakdown } from '../game/types';
import { n1, signed } from './fmt';

export type YieldKey = 'energy' | 'matter' | 'industry' | 'insight' | 'accord';

export const YIELDS: { key: YieldKey; name: string; what: string }[] = [
  { key: 'energy', name: 'Energy', what: 'captured minus upkeep' },
  { key: 'matter', name: 'Matter', what: 'mined minus used' },
  { key: 'industry', name: 'Industry', what: "builds this settlement's queue" },
  { key: 'insight', name: 'Insight', what: 'drives research' },
  { key: 'accord', name: 'Accord', what: 'buys Charters' },
];

/** What a settlement adds of one kind each turn (energy and matter net of what it uses). */
export function yieldOf(y: YieldBreakdown, k: YieldKey): number {
  return k === 'energy' ? y.energy - y.energyUpkeep : k === 'matter' ? y.matter - y.matterUpkeep : y[k];
}

/** As the settlement's panel shows it: signed where it can fall below zero. */
export function yieldText(y: YieldBreakdown, k: YieldKey): string {
  return k === 'industry' || k === 'insight' ? n1(yieldOf(y, k)) : signed(yieldOf(y, k));
}

/** What makes it up, line by line, for its tooltip. */
export function yieldTip(y: YieldBreakdown, k: YieldKey): string {
  const d = YIELDS.find((x) => x.key === k)!;
  const lines =
    y.lines
      .filter((l) => (l[k] ?? 0) !== 0)
      .map((l) => `${l.label}: ${signed(l[k] ?? 0)}`)
      .join('\n') || 'Nothing yet.';
  const used = k === 'energy' ? `\nUpkeep −${n1(y.energyUpkeep)}` : k === 'matter' && y.matterUpkeep ? `\nUsed −${n1(y.matterUpkeep)}` : '';
  return `${d.name}: ${d.what}\n${lines}${used}`;
}
