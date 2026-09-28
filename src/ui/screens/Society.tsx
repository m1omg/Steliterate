import { CHARTERS, type CharterDef } from '../../game/data/charters';
import { DEMANDS, THREAD_DEFS } from '../../game/data/threads';
import { TECH_BY_ID } from '../../game/data/techs';
import { logTurnLength, stepTime } from '../../game/eras';
import { charterAvailable, enactCharter } from '../../game/sim/actions';
import { clockRange, computeMods, strainFor } from '../../game/sim/mods';
import { demandMet } from '../../game/sim/society';
import { hasCharter, threadTotals } from '../../game/sim/util';
import type { GameState, ThreadId } from '../../game/types';
import { THREADS } from '../../game/types';
import { n0, n1, pow10 } from '../fmt';
import { Icon } from '../Icon';
import { act, rev } from '../store';
import { sfx } from '../../audio/sfx';
import { ModalFrame } from './Frame';

function Stances({ d }: { d: CharterDef }) {
  return (
    <div class="row wrap" style={{ gap: '4px' }}>
      {Object.entries(d.stances)
        .filter(([, v]) => v)
        .map(([t, v]) => (
          <span key={t} class={`chip ${v! > 0 ? 'good' : 'danger'}`} data-tip={`${THREAD_DEFS[t as ThreadId].name} standing ${v! > 0 ? '+' : ''}${v}`}>
            <Icon name={t as ThreadId} /> {v! > 0 ? '+' : ''}
            {v}
          </span>
        ))}
      {d.resolve ? <span class={`chip ${d.resolve > 0 ? 'good' : 'danger'}`}>resolve {d.resolve > 0 ? '+' : ''}{d.resolve}</span> : null}
      {d.dissent ? <span class={`chip ${d.dissent < 0 ? 'good' : 'danger'}`}>dissent {d.dissent > 0 ? '+' : ''}{d.dissent}</span> : null}
      {d.taint ? <span class="chip danger">taint +{d.taint}</span> : null}
    </div>
  );
}

export function ChartersModal({ s }: { s: GameState }) {
  void rev.value;
  const open = s.civ.techs.includes('the_long_record');
  const light = CHARTERS.filter((c) => !c.dark);
  const dark = CHARTERS.filter((c) => c.dark);
  const showDark = s.civ.techs.includes('hunger_studies') || s.civ.taint > 0;
  const card = (d: CharterDef) => {
    const enacted = hasCharter(s, d.id);
    const err = enacted ? null : charterAvailable(s, d.id);
    return (
      <div key={d.id} class={`card ${enacted ? 'enacted' : ''} ${d.dark ? 'dark' : ''}`}>
        <div class="row">
          <h4 class="grow">{d.name}</h4>
          <span class="mono faint">{d.cost} accord</span>
        </div>
        <div class="flavor" style={{ fontSize: '13px' }}>{d.desc}</div>
        <div style={{ fontSize: '12px' }}>{d.effect}</div>
        <Stances d={d} />
        {enacted ? (
          <span class="good" style={{ fontSize: '12px' }}><Icon name="check" /> Enacted. It cannot be revoked.</span>
        ) : (
          <button
            class={`btn small ${d.dark ? 'danger' : ''}`}
            disabled={!!err}
            data-tip={err ?? (d.dark ? 'There is no coming back from this.' : 'Charters are permanent.')}
            onClick={() => act((g) => enactCharter(g, d.id)) && sfx(d.dark ? 'bad' : 'good')}
          >
            {err && (d.tech && !s.civ.techs.includes(d.tech)) ? `Needs ${TECH_BY_ID[d.tech]?.name}` : 'Enact'}
          </button>
        )}
      </div>
    );
  };
  return (
    <ModalFrame title="Charters" eyebrow={`The book of laws · ${n0(s.civ.accord)} accord`} icon="doctrines">
      {!open && <p class="warn">Research The Long Record to begin writing Charters.</p>}
      <p class="dim" style={{ fontSize: '12px', marginTop: 0 }}>
        Laws are permanent. Each Thread has an opinion: approval raises its standing, opposition lowers it. A Thread whose standing stays very low may leave.
      </p>
      <div class="cards">{light.map(card)}</div>
      {showDark && (
        <div class="section">
          <h3 class="bad">The ways of the Hunger</h3>
          <p class="dim" style={{ fontSize: '12px', marginTop: 0 }}>
            Survive the way the swarms survive: by eating what is left. Each step brings plenty now and closes some endings. At 100 Taint there is no one left inside.
          </p>
          <div class="cards">{dark.map(card)}</div>
        </div>
      )}
    </ModalFrame>
  );
}

export function ThreadsModal({ s }: { s: GameState }) {
  void rev.value;
  const mods = computeMods(s);
  const totals = threadTotals(s);
  const logL = logTurnLength(stepTime(s.era, s.years, s.eta, s.civ.pace, s.settings.length));
  return (
    <ModalFrame title="Threads" eyebrow="The kinds of mind you are made of" icon="threads">
      <div class="row wrap" style={{ gap: '16px', marginBottom: '10px' }}>
        <div data-tip="The will to go on. Everything you do is scaled by it.">
          <span class="eyebrow">Resolve</span> <span class="mono">{n0(s.civ.resolve)}</span>
        </div>
        <div data-tip="How much the Threads disagree. Above 40 it slows work.">
          <span class="eyebrow">Dissent</span> <span class="mono">{n0(s.civ.dissent)}</span>
        </div>
        <div data-tip="The length of the coming turn, as log₁₀ years. Each Thread thinks at its own clock; the gap is tempo strain.">
          <span class="eyebrow">This age's tempo</span> <span class="mono">{pow10(logL)} yr per turn</span>
        </div>
      </div>
      <div class="cards">
        {THREADS.map((t) => {
          const d = THREAD_DEFS[t];
          const [lo, hi] = clockRange(t, mods);
          const st = strainFor(t, logL, mods, -s.civ.pace);
          const dem = s.civ.demands[t];
          const demDef = dem ? DEMANDS.find((x) => x.id === dem) : null;
          const met = dem ? demandMet(s, dem, mods, logL) : true;
          const standing = s.civ.standing[t];
          return (
            <div key={t} class="card" style={{ opacity: totals[t] > 0 ? 1 : 0.55 }}>
              <div class="row">
                <Icon name={t} size="xl" cls={totals[t] > 0 ? 'neon' : 'faint'} />
                <h4 class="grow">{d.name}</h4>
                <span class="mono">{totals[t]}</span>
              </div>
              <div class="flavor" style={{ fontSize: '13px' }}>{d.blurb}</div>
              {!d.conscious && <span class="chip" data-tip="The Lattice has no standing and no demand: it has never asked for anything. It cannot be persuaded, only maintained.">asks for nothing</span>}
              <dl class="kv">
                <dt>Upkeep</dt>
                <dd class="mono">{n1(d.energyUpkeep * mods.upkeep[t])} energy{d.matterUpkeep ? `, ${n1(d.matterUpkeep)} matter` : ''}</dd>
                <dt>Works</dt>
                <dd class="mono">{n1(d.industry)} ind · {n1(d.insight)} ins · {n1(d.accord)} acc</dd>
                <dt data-tip="log₁₀ years per subjective moment: the fastest and slowest this kind of mind can live.">Clock</dt>
                <dd class="mono">{d.strainImmune ? 'any' : lo === hi ? `${pow10(lo)}` : `${pow10(lo)} – ${pow10(hi)}`}</dd>
                <dt>Tempo now</dt>
                <dd class={`mono ${st.m > 0.5 ? 'warn' : st.m < -0.5 ? 'boon' : ''}`}>
                  {st.m === 0 ? 'in step' : st.m > 0 ? `too fast by ${n1(st.m)} · upkeep ×${n1(st.upkeepMul)}` : `too slow by ${n1(-st.m)} · output ×${n1(st.outMul)}`}
                </dd>
              </dl>
              {d.conscious && (
                <>
                  <div class="row">
                    <span class="eyebrow grow">Standing</span>
                    <span class={`mono ${standing < 25 ? 'bad' : ''}`}>{n0(standing)}</span>
                  </div>
                  <div class={`bar ${standing < 25 ? 'bad' : 'good'}`}><i style={{ width: `${standing}%` }} /></div>
                  {demDef && totals[t] > 0 && (
                    <div class={met ? 'good' : 'warn'} style={{ fontSize: '12px' }}>
                      {met ? <Icon name="check" /> : <Icon name="warning" />} Demand: {demDef.text}
                    </div>
                  )}
                  {s.civ.lowStanding[t] > 0 && totals[t] > 0 && <div class="bad" style={{ fontSize: '12px' }}>Talking of leaving ({s.civ.lowStanding[t]} turns).</div>}
                </>
              )}
            </div>
          );
        })}
      </div>
    </ModalFrame>
  );
}
