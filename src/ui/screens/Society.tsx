import { CHARTERS, type CharterDef } from '../../game/data/charters';
import { DEMANDS, THREAD_DEFS } from '../../game/data/threads';
import { TECH_BY_ID } from '../../game/data/techs';
import { logTurnLength } from '../../game/eras';
import { turnStep } from '../../game/sim/flare';
import { archivedEchoes } from '../../game/sim/archive';
import { useState } from 'preact/hooks';
import { charterAvailable, enactCharter, REPEAL_DISSENT, repealAvailable, repealCharter } from '../../game/sim/actions';
import { clockRange, computeMods, strainFor } from '../../game/sim/mods';
import { demandMet } from '../../game/sim/society';
import { ACCORD_USES, accordCheck, accordCost, spendAccord, type AccordUse } from '../../game/sim/accord';
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

/** What repealing a charter does to each Thread's standing: its stances turned around. */
function repealSummary(d: CharterDef): string {
  const parts = Object.entries(d.stances)
    .filter(([, v]) => v)
    .map(([t, v]) => `${THREAD_DEFS[t as ThreadId].name} ${v! > 0 ? '−' : '+'}${Math.abs(v!)}`);
  return [...parts, `dissent +${REPEAL_DISSENT}`].join(', ');
}

export function ChartersModal({ s }: { s: GameState }) {
  void rev.value;
  const [confirming, setConfirming] = useState<string | null>(null);
  const open = s.civ.techs.includes('the_long_record');
  const light = CHARTERS.filter((c) => !c.dark);
  const dark = CHARTERS.filter((c) => c.dark);
  const showDark = s.civ.techs.includes('hunger_studies') || s.civ.taint > 0;
  const card = (d: CharterDef) => {
    const enacted = hasCharter(s, d.id);
    const err = enacted ? null : charterAvailable(s, d.id);
    const repealErr = enacted ? repealAvailable(s, d.id) : null;
    const repealedAt = s.civ.flags[`repealed_${d.id}`];
    const asking = confirming === d.id && enacted && !repealErr;
    return (
      <div key={d.id} class={`card ${enacted ? 'enacted' : ''} ${d.dark ? 'dark' : ''}`}>
        <div class="row">
          <h4 class="grow">{d.name}</h4>
          <span class="mono faint">{d.cost} accord</span>
        </div>
        <div class="flavor" style={{ fontSize: '14.5px' }}>{d.desc}</div>
        <div style={{ fontSize: '13.5px' }}>{d.effect}</div>
        <Stances d={d} />
        {enacted && d.dark ? (
          <span class="good" style={{ fontSize: '13.5px' }}><Icon name="check" /> Enacted. There is no undoing it.</span>
        ) : enacted ? (
          <div class="col" style={{ gap: '6px' }}>
            <div class="row" style={{ gap: '6px' }}>
              <span class="good grow" style={{ fontSize: '13.5px' }}><Icon name="check" /> In force.</span>
              {!asking && (
                <button class="btn small" disabled={!!repealErr} data-tip={repealErr ?? `Strike it from the book (${d.cost} accord). Standing turns around: ${repealSummary(d)}. What it did once stays done.`} onClick={() => setConfirming(d.id)}>
                  Repeal…
                </button>
              )}
            </div>
            {asking && (
              <div class="row wrap" style={{ gap: '6px' }}>
                <button
                  class="btn small danger"
                  data-tip={`${repealSummary(d)}. What it did once stays done.`}
                  onClick={() => {
                    if (act((g) => repealCharter(g, d.id))) sfx('bad');
                    setConfirming(null);
                  }}
                >
                  Repeal for {d.cost} accord
                </button>
                <button class="btn small ghost" onClick={() => setConfirming(null)}>Keep it</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button
              class={`btn small ${d.dark ? 'danger' : ''}`}
              disabled={!!err}
              data-tip={err ?? (d.dark ? 'There is no coming back from this.' : 'It stays in force until you repeal it.')}
              onClick={() => act((g) => enactCharter(g, d.id)) && sfx(d.dark ? 'bad' : 'good')}
            >
              {err && (d.tech && !s.civ.techs.includes(d.tech)) ? `Needs ${TECH_BY_ID[d.tech]?.name}` : repealedAt !== undefined ? 'Enact again' : 'Enact'}
            </button>
            {repealedAt !== undefined && <span class="faint" style={{ fontSize: '12.5px' }}>Repealed in turn {repealedAt}.{d.id === 'salvage_the_dead' ? ' Its first windfall will not come again.' : ''}</span>}
          </>
        )}
      </div>
    );
  };
  const inBook = s.civ.charters.filter((c) => !CHARTERS.find((x) => x.id === c)?.dark).length;
  const room = s.civ.techs.includes('assembly_of_threads') ? 9 : 5;
  return (
    <ModalFrame title="Charters" eyebrow={`The book of laws · ${inBook} of ${room} written · ${n0(s.civ.accord)} accord`} icon="doctrines">
      {!open && <p class="warn">Research The Long Record to begin writing Charters.</p>}
      <p class="dim" style={{ fontSize: '13.5px', marginTop: 0 }}>
        A law stays in force until you repeal it. Each Thread has an opinion: approval raises its standing, opposition lowers it, and a repeal turns those opinions around and reopens the argument (dissent +{REPEAL_DISSENT}), for as much Accord as the law cost. What a law did once stays done. The book holds {room} laws{room === 5 ? ' (nine with the Assembly of Threads)' : ''}. A Thread whose standing stays very low may leave.
      </p>
      <div class="cards">{light.map(card)}</div>
      {showDark && (
        <div class="section">
          <h3 class="bad">The ways of the Hunger</h3>
          <p class="dim" style={{ fontSize: '13.5px', marginTop: 0 }}>
            Survive the way the swarms survive: by eating what is left. Each step brings plenty now and closes some endings, and none can be repealed. They take no room in the book. At 100 Taint there is no one left inside.
          </p>
          <div class="cards">{dark.map(card)}</div>
        </div>
      )}
    </ModalFrame>
  );
}

/** Spend accord on one of its uses; greyed out, with the reason, when it cannot be done. */
function AccordButton({ s, use, t, label, tip }: { s: GameState; use: AccordUse; t?: ThreadId; label: string; tip: string }) {
  const err = accordCheck(s, use, t);
  const cost = accordCost(s, use, t);
  return (
    <button class="btn small" disabled={!!err} data-tip={`${tip} ${cost} accord now; the price doubles with each use and eases back over about ten turns.${err ? `\n${err}` : ''}`} onClick={() => act((g) => spendAccord(g, use, t)) && sfx('click')}>
      {label} · {cost}
    </button>
  );
}

export function ThreadsModal({ s }: { s: GameState }) {
  void rev.value;
  const mods = computeMods(s);
  const totals = threadTotals(s);
  const logL = logTurnLength(turnStep(s));
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
      <div class="row wrap" style={{ gap: '6px', marginBottom: '12px', alignItems: 'center' }}>
        <span class="eyebrow" data-tip="The Threads' goodwill toward one another. Beyond writing laws, it can be spent here: each use once a turn, its price doubling with every use and easing back over about ten turns.">
          Accord {n0(s.civ.accord)}
        </span>
        <AccordButton s={s} use="rally" label={`Rally: resolve +${ACCORD_USES.rally.gain}`} tip="Gather the Threads and remind one another why we go on." />
        <AccordButton s={s} use="calm" label={`Calm: dissent −${ACCORD_USES.calm.gain}`} tip="Long talks across the Threads, until the argument cools." />
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
              <div class="flavor" style={{ fontSize: '14.5px' }}>{d.blurb}</div>
              {t === 'echoes' && archivedEchoes(s) > 0 && (
                <span class="chip warn" data-tip="Echoes that came to us with no free substrate to run on. They wait, stored and costing nothing, and move in as soon as a Substrate Core has room.">
                  {archivedEchoes(s)} waiting in the archive
                </span>
              )}
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
                    <div class={met ? 'good' : 'warn'} style={{ fontSize: '13.5px' }}>
                      {met ? <Icon name="check" /> : <Icon name="warning" />} Demand: {demDef.text}
                    </div>
                  )}
                  {s.civ.lowStanding[t] > 0 && totals[t] > 0 && <div class="bad" style={{ fontSize: '13.5px' }}>Talking of leaving ({s.civ.lowStanding[t]} turns).</div>}
                  {totals[t] > 0 && <AccordButton s={s} use="hear" t={t} label={`Hear them: standing +${ACCORD_USES.hear.gain}`} tip={`Give ${d.name} a full hearing before the other Threads.`} />}
                </>
              )}
            </div>
          );
        })}
      </div>
    </ModalFrame>
  );
}
