import { ERA_BY_ID, ERAS, deepMilestonesFor, formatEta, formatYears, formatYearsShort, milestonesFor } from '../../game/eras';
import { DEGENERATE_END, fateKnown, fateOf } from '../../game/fate';
import type { EraId, GameState } from '../../game/types';
import { rev } from '../store';

// The whole remaining life of the universe on one instrument strip. Each age gets a segment;
// inside it, time is scaled so that the present moves visibly.

const SEG: Record<EraId, [number, number]> = { dusk: [0, 0.22], degenerate: [0.22, 0.5], blackhole: [0.5, 0.78], dark: [0.78, 1] };

/** Position (0..1) of a moment on the ruler for the era-segmented scale. */
export function rulerPos(years: number, eta: number): number {
  if (eta < 14.0001) {
    const elapsed = Math.max(0, years - ERA_BY_ID.dusk.startYears);
    const u = Math.log10(40 + elapsed) / Math.log10(1e13);
    return SEG.dusk[0] + (SEG.dusk[1] - SEG.dusk[0]) * clamp01((u - 0.12) / 0.88);
  }
  if (eta < 15) return SEG.dusk[1];
  if (eta < 40) return SEG.degenerate[0] + (SEG.degenerate[1] - SEG.degenerate[0]) * clamp01((eta - 15) / 25);
  if (eta < 100) return SEG.blackhole[0] + (SEG.blackhole[1] - SEG.blackhole[0]) * clamp01((eta - 40) / 60);
  const lam = Math.log10(eta);
  return SEG.dark[0] + (SEG.dark[1] - SEG.dark[0]) * clamp01((lam - 2) / 120);
}

/** In the Dark Era the ruler becomes a deep-time ruler on log10(eta). */
function deepPos(eta: number): number {
  if (eta < 100) return 0.04 * clamp01((eta - 13.9) / 86);
  return 0.06 + 0.94 * clamp01((Math.log10(eta) - 2) / 120);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

const SEV_COLOR: Record<string, string> = { info: 'var(--ink-dim)', warn: 'var(--warn)', danger: 'var(--bad)', boon: 'var(--boon)' };

export function Chronometer({ s }: { s: GameState }) {
  void rev.value;
  const era = ERA_BY_ID[s.era];
  const deep = s.era === 'dark';
  const now = deep ? deepPos(s.eta) : rulerPos(s.years, s.eta);
  const pins = s.forecasts
    .filter((f) => isFinite(f.dueYears))
    .map((f) => ({ f, x: deep ? deepPos(Math.log10(Math.max(1, f.dueYears))) : rulerPos(f.dueYears, Math.log10(Math.max(1, f.dueYears))) }))
    .filter((p) => p.x > now - 0.001);
  // the fate of matter decides where the Degenerate Age ends: until it is known, the timeline
  // shows the stretch it might end in, and every date that depends on it, as questions
  const fate = fateKnown(s) ? fateOf(s) : null;
  const milestones = deep ? deepMilestonesFor(fate).map((m) => ({ ...m, x: deepPos(Math.pow(10, m.at)) })) : milestonesFor(fate).map((m) => ({ ...m, x: rulerPos(Math.pow(10, m.at), m.at) }));
  const at = (e: number) => rulerPos(Math.pow(10, e), e);
  const split = at(fate ? DEGENERATE_END[fate] : DEGENERATE_END.stable);
  const unsure: [number, number] | null = fate ? null : [at(DEGENERATE_END.stable), at(DEGENERATE_END.curvature)];
  const band: Record<EraId, [number, number]> = { dusk: SEG.dusk, degenerate: [SEG.degenerate[0], split], blackhole: [unsure ? unsure[1] : split, SEG.blackhole[1]], dark: SEG.dark };
  const turnSpan = isFinite(s.turnLength) ? formatYears(s.turnLength) : formatYears(Infinity, s.eta);
  const age = s.era === 'dusk' ? `${formatYears(s.years)} since the Big Bang` : formatYears(s.years, s.eta);
  return (
    <div class="chrono panel scan">
      <div class="chrono-era">
        <div class="num">
          {era.numeral} · {era.science.toUpperCase()}
        </div>
        <div class="name">{era.name}</div>
        <div class="sci">Turn {s.turn} · {s.era === 'dusk' ? `${formatYearsShort(s.years - era.startYears)} into the Dusk` : `turn ${s.eraTurn + 1} of this age`}</div>
      </div>
      <div class="ruler" aria-label="Chronometer: the remaining life of the universe">
        <svg viewBox="0 0 1000 46" preserveAspectRatio="none">
          {!deep &&
            ERAS.map((e) => {
              const [a, b] = band[e.id];
              const cur = e.id === s.era;
              return (
                <g key={e.id}>
                  <rect x={a * 1000} y={18} width={Math.max(0, (b - a) * 1000 - 3)} height={10} fill={cur ? 'var(--accent)' : 'rgba(233,223,207,0.08)'} opacity={cur ? 0.28 : 1} />
                  <rect x={a * 1000} y={18} width={Math.max(0, (Math.min(now, b) - a)) * 1000} height={10} fill="var(--accent)" opacity={e.index < ERA_BY_ID[s.era].index ? 0.12 : cur ? 0.55 : 0} />
                </g>
              );
            })}
          {!deep && unsure && (
            <g>
              <defs>
                <pattern id="chrono-unsure" width="6" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
                  <rect width="3" height="10" fill="rgba(233,223,207,0.16)" />
                </pattern>
              </defs>
              <rect x={unsure[0] * 1000} y={18} width={(unsure[1] - unsure[0]) * 1000 - 3} height={10} fill="url(#chrono-unsure)" />
              <rect x={unsure[0] * 1000} y={18} width={Math.max(0, (Math.min(now, unsure[1]) - unsure[0])) * 1000} height={10} fill="var(--accent)" opacity={s.era === 'degenerate' ? 0.4 : 0.12} />
            </g>
          )}
          {deep && (
            <g>
              <rect x={0} y={18} width={55} height={10} fill="rgba(233,223,207,0.1)" />
              <rect x={60} y={18} width={940} height={10} fill="var(--accent)" opacity={0.18} />
              <rect x={60} y={18} width={Math.max(0, now * 1000 - 60)} height={10} fill="var(--accent)" opacity={0.5} />
            </g>
          )}
          {milestones.map((m, i) => (
            <line key={i} x1={m.x * 1000} x2={m.x * 1000} y1={12} y2={34} stroke="rgba(233,223,207,0.35)" stroke-width={1} vector-effect="non-scaling-stroke" />
          ))}
          {pins.map((p) => (
            <path key={p.f.uid} d={`M ${p.x * 1000} 36 l 4 8 h -8 z`} fill={SEV_COLOR[p.f.severity]} />
          ))}
          <line x1={now * 1000} x2={now * 1000} y1={4} y2={42} stroke="var(--neon)" stroke-width={2} vector-effect="non-scaling-stroke" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {!deep &&
            ERAS.map((e) => (
              <div key={e.id} class="eyebrow" style={{ position: 'absolute', left: `${band[e.id][0] * 100}%`, top: '-2px', fontSize: '9.5px', color: e.id === s.era ? 'var(--accent-soft)' : undefined }}>
                {e.numeral} {e.science.replace(' Era', '')}
              </div>
            ))}
          {!deep && unsure && (
            <div
              class="eyebrow"
              data-tip="Where the Degenerate Age ends depends on what becomes of matter, which no one knows yet: near η 30 if it is stable, η 39 if protons decay, η 68 if space itself slowly unmakes it. The Proton Question would tell us; the neutron stars will, near η 30."
              style={{ position: 'absolute', left: `${unsure[0] * 100}%`, top: '-2px', fontSize: '9.5px', pointerEvents: 'auto', cursor: 'help' }}
            >
              II → III ?
            </div>
          )}
          {deep && (
            <div class="eyebrow" style={{ position: 'absolute', left: '0', top: '-2px', fontSize: '9.5px' }}>
              I–III · deep time: log₁₀ <span class="greek">η</span> →
            </div>
          )}
        </div>
        <div style={{ position: 'absolute', inset: 0 }}>
          {milestones.map((m, i) => (
            <div key={i} data-tip={`${m.label}\n${m.detail}`} style={{ position: 'absolute', left: `calc(${m.x * 100}% - 5px)`, top: '10px', width: '10px', height: '26px', cursor: 'help' }} />
          ))}
          {pins.map((p) => (
            <div key={p.f.uid} data-tip={`${p.f.title}\n${p.f.text}`} style={{ position: 'absolute', left: `calc(${p.x * 100}% - 6px)`, top: '34px', width: '12px', height: '12px', cursor: 'help' }} />
          ))}
        </div>
      </div>
      <div class="chrono-time">
        <div class="eta phos" data-tip="η, the cosmological decade: log₁₀ of the universe’s age in years.">
          η {formatEta(s.eta, s.era)}
        </div>
        <div class="age">{age}</div>
        <div class="span">this turn spanned {turnSpan}</div>
      </div>
    </div>
  );
}
