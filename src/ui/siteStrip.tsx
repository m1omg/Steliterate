// What a place offers each kind of settler, in one short line: livable ground (Kin), power (Echoes
// and the Chorus), matter (the Lattice) and time before it falls into its star (Coldminds), from
// siteValue (game/sim/sites.ts). A fleet's Where to settle and Nearby lists and the Surveyed worlds
// list show it under each world or star, with the measure the list is sorted by marked.

import { canSettle } from '../game/sim/fleets';
import { siteValue, type SiteValue } from '../game/sim/sites';
import type { Body, GameState, StarSystem, ThreadId } from '../game/types';
import { Icon } from './Icon';
import type { IconName } from './icons';
import { bodyKindName } from './labels';

/** The four measures a place is judged by, one for each kind of settler (the Chorus wants power, as Echoes do). */
export type Need = 'kin' | 'echoes' | 'lattice' | 'coldminds';

/** In the order of the sort buttons: livable, power, matter, lasting. */
export const NEEDS: { need: Need; icon: IconName; name: string; what: string }[] = [
  { need: 'kin', icon: 'kin', name: 'Livable', what: 'Livable, for Kin: habitability × vitality, and room without domes' },
  { need: 'echoes', icon: 'energy', name: 'Power', what: 'Power, for Echoes and the Chorus: the energy a settlement there could collect each turn at the Tide' },
  { need: 'lattice', icon: 'matter', name: 'Matter', what: 'Matter, for the Lattice: what its mines, skimmers and lifters could raise there each turn' },
  { need: 'coldminds', icon: 'clock', name: 'Lasting', what: 'Lasting, for Coldminds: how long before the world falls into its dead star' },
];

/** The measure a kind of mind settles by. */
export const needOf = (t: ThreadId): Need => (t === 'chorus' ? 'echoes' : t);

/** For each measure, a world and what it offers. */
export type Sites = Partial<Record<Need, { b: Body; v: SiteValue }>>;

/** What one world offers by every measure. */
export function worldSites(s: GameState, b: Body): Sites {
  const out: Sites = {};
  for (const n of NEEDS) out[n.need] = { b, v: siteValue(s, b, n.need) };
  return out;
}

/** A charted star's best world by each measure, among the worlds that kind could settle (none where they cannot). */
export function starSites(s: GameState, sys: StarSystem): Sites {
  const out: Sites = {};
  for (const n of NEEDS) {
    for (const id of sys.bodies) {
      const b = s.bodies[id];
      if (!b || canSettle(s, b, n.need)) continue;
      const v = siteValue(s, b, n.need);
      if (!out[n.need] || v.score > out[n.need]!.v.score) out[n.need] = { b, v };
    }
  }
  return out;
}

/** The best score by each measure among these places, to pick out the good ones. */
export function bestOf(list: Sites[]): Partial<Record<Need, number>> {
  const best: Partial<Record<Need, number>> = {};
  for (const sites of list) for (const n of NEEDS) best[n.need] = Math.max(best[n.need] ?? 0, sites[n.need]?.v.score ?? 0);
  return best;
}

/** One measure, short: "45% · 4 room", "12", "10¹⁹·² years" shortened to its number. */
function short(need: Need, label: string): string {
  if (/boils away|swallowed/.test(label)) return label.replace(/ this turn$/, '');
  if (need === 'kin') return label;
  if (need === 'coldminds') return label.replace(/^lasts /, '').replace(/ years?$/, '').replace('never falls in', '∞');
  return label.match(/[\d,.]+/)?.[0] ?? label;
}

/**
 * Every measure for a place, in one line. `one`: the values of this world (else the best world of
 * a star, for each measure). `active`: the measure the list is sorted by, marked. `mine`: the
 * settlers' own measure, in bold when another is marked. Good values (room to live without domes;
 * at least three quarters of the best in `best`) are green; a world dying or boiling away is amber.
 */
export function SiteStrip({ s, sites, best, mine, active, one }: { s: GameState; sites: Sites; best: Partial<Record<Need, number>>; mine?: Need | null; active?: Need | null; one?: boolean }) {
  return (
    <div class="site-strip">
      {NEEDS.map((n) => {
        const x = sites[n.need];
        const on = active === n.need;
        if (!x) {
          return (
            <span key={n.need} class={`mark mono faint${on ? ' sorted' : ''}`} data-tip={`${n.what}. Nowhere here they could settle.`}>
              <Icon name={n.icon} /> none
            </span>
          );
        }
        const label = x.v.label;
        const dying = x.v.score < 0 || /freezing|cooling/.test(label);
        const top = n.need === 'kin' ? !dying && /room/.test(label) : (best[n.need] ?? 0) > 0 && x.v.score >= 0.75 * best[n.need]!;
        const where = one ? 'Here' : `The best place here: ${x.b.name} (${bodyKindName(s, x.b)})`;
        return (
          <span
            key={n.need}
            class={`mark mono ${dying ? 'warn' : top ? 'good' : 'faint'}${on ? ' sorted' : ''}`}
            style={mine === n.need && !on ? { fontWeight: 600 } : undefined}
            data-tip={`${n.what}${on ? ' (this list is sorted by it)' : ''}. ${where}: ${label}.\n${x.v.tip}`}
          >
            <Icon name={n.icon} /> {short(n.need, label)}
          </span>
        );
      })}
    </div>
  );
}
