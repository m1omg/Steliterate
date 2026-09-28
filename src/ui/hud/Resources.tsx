import { TECH_BY_ID } from '../../game/data/techs';
import { techCost } from '../../game/sim/research';
import type { Projection } from '../../game/sim/projection';
import type { GameState } from '../../game/types';
import { n0, n1, pct, signed } from '../fmt';
import { Icon } from '../Icon';
import { modal, rev } from '../store';

function Gauge({ v, max, cls }: { v: number; max: number; cls?: string }) {
  return (
    <div class={`bar ticks gauge ${cls ?? ''}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100))}%` }} />
    </div>
  );
}

export function Resources({ s, p }: { s: GameState; p: Projection }) {
  void rev.value; // mutable game state: re-render on every change
  const civ = s.civ;
  const eNet = p.energyIn - p.energyOut;
  const mNet = p.matterIn - p.matterOut;
  const cap = p.reserveCap;
  const research = civ.researching ? TECH_BY_ID[civ.researching] : null;
  const rProg = research ? (civ.research[research.id] ?? 0) / techCost(s, research.id) : 0;
  const eTip = [
    `Energy reserve ${n0(civ.energy)} / ${n0(cap)}`,
    `Next turn: +${n1(p.energyIn)} captured, −${n1(p.energyOut)} upkeep`,
    ...Object.entries(p.perColony).map(([id, t]) => `${s.colonies[id]?.name}: ${signed(t.y.energy - t.y.energyUpkeep)}`),
    civ.dormant ? 'Dormant: upkeep is a fraction, nothing else gets done.' : '',
  ]
    .filter(Boolean)
    .join('\n');
  const matterGone = s.protonsDecay && (s.era === 'blackhole' || s.era === 'dark');
  return (
    <div class="resources panel scan">
      <div class={`res ${civ.energy < cap * 0.15 && eNet < 0 ? 'hazard-edge' : ''}`} data-tip={eTip}>
        <Icon name="energy" size="lg" cls="accent" />
        <div class="col" style={{ gap: '2px' }}>
          <div class="row" style={{ gap: '6px' }}>
            <span class="v phos">{n0(civ.energy)}</span>
            <span class={`d mono ${eNet >= 0 ? 'good' : 'bad'}`}>{signed(eNet)}</span>
          </div>
          <Gauge v={civ.energy} max={cap} cls={eNet < 0 && civ.energy < cap * 0.2 ? 'bad' : ''} />
        </div>
        <span class="l">Energy</span>
      </div>
      {!matterGone && (
        <div class="res" data-tip={`Matter ${n0(civ.matter)}\nNext turn: +${n1(p.matterIn)} mined, −${n1(p.matterOut)} used\nDeposits run out as you mine them.`}>
          <Icon name="matter" size="lg" />
          <span class="v phos">{n0(civ.matter)}</span>
          <span class={`d mono ${mNet >= 0 ? 'good' : 'bad'}`}>{signed(mNet)}</span>
          <span class="l">Matter</span>
        </div>
      )}
      <div class="res" style={{ cursor: 'pointer' }} onClick={() => (modal.value = { kind: 'research' })} data-tip={research ? `Researching ${research.name}: ${pct(rProg)}\n${n1(p.insight)} insight per turn` : `${n1(p.insight)} insight per turn. Nothing is being researched: choose a project.`}>
        <Icon name="insight" size="lg" />
        <div class="col" style={{ gap: '2px' }}>
          <div class="row" style={{ gap: '6px' }}>
            <span class="v phos">{n1(p.insight)}</span>
            <span class="d dim">{research ? research.name : <span class="warn">idle</span>}</span>
          </div>
          <Gauge v={rProg} max={1} cls="neon" />
        </div>
      </div>
      <div class="res" data-tip={`Accord ${n0(civ.accord)}: spent on Charters.\n${signed(p.accord)} per turn`} onClick={() => (modal.value = { kind: 'charters' })} style={{ cursor: 'pointer' }}>
        <Icon name="accord" size="lg" />
        <span class="v phos">{n0(civ.accord)}</span>
        <span class={`d mono ${p.accord >= 0 ? 'good' : 'bad'}`}>{signed(p.accord)}</span>
      </div>
      <div class="res" data-tip={`Resolve ${n0(civ.resolve)}: the will to go on. Low resolve lowers everything you do; at zero for too long, the civilization gives up.`}>
        <span class="l" style={{ display: 'block' }}>Resolve</span>
        <div class="col" style={{ gap: '2px' }}>
          <span class={`mono ${civ.resolve < 25 ? 'bad' : ''}`}>{n0(civ.resolve)}</span>
          <Gauge v={civ.resolve} max={100} cls={civ.resolve < 25 ? 'bad' : 'good'} />
        </div>
      </div>
      <div class="res" data-tip={`Dissent ${n0(civ.dissent)}: how much the Threads disagree. Above 40 it slows work; a Thread with very low standing and high dissent may fork away.`}>
        <span class="l" style={{ display: 'block' }}>Dissent</span>
        <div class="col" style={{ gap: '2px' }}>
          <span class={`mono ${civ.dissent > 45 ? 'bad' : ''}`}>{n0(civ.dissent)}</span>
          <Gauge v={civ.dissent} max={100} cls={civ.dissent > 45 ? 'bad' : 'warn'} />
        </div>
      </div>
      <div class="res" data-tip={`Galactic free energy ${pct(s.gfe)}\nThe usable energy left in the Coalescence. Every source and deposit yields less as it falls. The Hunger spends it, and so do stellar lifting, overdrive and consuming the dead.`}>
        <span class="l" style={{ display: 'block' }}>Free energy</span>
        <span class={`mono ${s.gfe < 0.7 ? 'warn' : 'dim'}`}>{pct(s.gfe)}</span>
      </div>
      {s.era === 'dark' && (
        <div class="res" data-tip="Continuity: how intact the pattern of you still is. Every cycle in the dark loses a little. At zero, you fade.">
          <Icon name="continuity" size="lg" />
          <div class="col" style={{ gap: '2px' }}>
            <span class={`mono ${civ.continuity < 30 ? 'bad' : ''}`}>{n0(civ.continuity)}</span>
            <Gauge v={civ.continuity} max={100} cls={civ.continuity < 30 ? 'bad' : 'neon'} />
          </div>
        </div>
      )}
      {civ.taint > 0 && (
        <div class="res" data-tip={`Hunger Taint ${n0(civ.taint)}\nWhat you have taken from the Hunger. Past 30 and 60 some endings close. At 100 you become it.`}>
          <span class="l bad" style={{ display: 'block' }}>Taint</span>
          <span class="mono bad">{n0(civ.taint)}</span>
        </div>
      )}
    </div>
  );
}
