import { useState } from 'preact/hooks';
import { heardTies } from '../../game/sim/ties';
import { asSeen } from '../../game/sim/others';
import { formatDistance, formatYears, logTurnLength } from '../../game/eras';
import { turnStep, turnsUntilYears } from '../../game/sim/flare';
import { answerSignal, askForAid, breakPact, devour, goToWar, makeGesture, peace, proposeAPact, seize, sendAid, shutHaloSiphons } from '../../game/sim/actions';
import { siphonsRunning } from '../../game/physics';
import { HUNGER_CAUSE, SIEGE_TURNS, WAR_ACCORD, hungerCause, seizeBlocked, stormTarget, warBlocked, warCause, warDefence } from '../../game/sim/war';
import { HEARD_CEILING, JUST_CAUSE_AT, SANCTION_AT, shuns } from '../../game/sim/judge';
import { assaultForce, assaultOdds, besieged, holdOf, walled, warFront } from '../../game/sim/conflict';
import { PACT_KINDS, PACTS, hasPact, pactBlocked, pactCost } from '../../game/sim/pacts';
import { PROMISE_TURNS, starsSeen } from '../../game/sim/claims';
import { ASK_COOLDOWN, askBlocked, goneAnswer, inStep, reachBy, talkSpan } from '../../game/sim/survivors';
import { canConverse, stepGap, voiceClock, voiceRange, voiceThread } from '../../game/sim/signals';
import { THREAD_DEFS } from '../../game/data/threads';
import { SANCTUARY_TRUST } from '../../game/sim/refuge';
import { capital, distLy, hasCharter } from '../../game/sim/util';
import type { GameState, Signal, Survivor } from '../../game/types';
import { n0, n1, pct, pow10 } from '../fmt';
import { WAY_NAME, paceName, wayArt } from '../labels';
import { act, rev } from '../store';
import { sfx } from '../../audio/sfx';
import { ModalFrame } from './Frame';

function senderName(s: GameState, sig: Signal): string {
  if (sig.from === 'astronomers') return 'Our astronomers';
  if (sig.from === 'slow') return 'The Slow Ones';
  if (sig.from === 'dark') return 'The halo';
  return s.survivors[sig.from]?.name ?? 'Unknown';
}

/**
 * Shut the Halo Siphons for good, with a yes first: under the Unlit's request while the siphons run
 * (they will not gather until they are shut), and on the Unlit's card.
 */
function ShutSiphons({ s, card }: { s: GameState; card?: boolean }) {
  void rev.value; // mutable game state: re-render on every change
  const [armed, setArmed] = useState(false);
  if (!s.civ.techs.includes('halo_siphons')) return null;
  if (!siphonsRunning(s))
    return card ? (
      <div class="faint siphons" style={{ fontSize: '12.5px', marginTop: '6px' }}>
        Our Halo Siphons: shut for good on turn {s.civ.flags.siphons_shut}.
      </div>
    ) : null;
  return (
    <div class="siphons" style={{ marginTop: card ? '6px' : '8px' }}>
      {card ? (
        <>
          <div class="eyebrow">Our Halo Siphons</div>
          <div class="dim" style={{ fontSize: '13.5px' }}>
            They drive the halo’s dark matter into our embers: ember light doubles, and the halo empties sooner, for every ember in the galaxy.
          </div>
        </>
      ) : (
        <div class="warn" style={{ fontSize: '13.5px' }}>Our Halo Siphons still run: they will not gather while the siphons drain the halo.</div>
      )}
      <div class="row wrap" style={{ gap: '6px', marginTop: '4px', alignItems: 'center' }}>
        <button
          class={`btn small danger siphons-shut ${armed ? 'on' : ''}`}
          data-tip="From the next turn ember light no longer doubles, and the halo falls at its own pace again. What they have drawn stays drawn, and they cannot be started again."
          onClick={() => setArmed(!armed)}
        >
          Shut the Halo Siphons
        </button>
      </div>
      {armed && (
        <div class="row wrap confirm-heavy" style={{ gap: '6px', alignItems: 'center' }}>
          <span class="warn" style={{ fontSize: '13.5px' }}>Shut the Halo Siphons for good? Ember yields lose their doubling, and the siphons cannot be started again.</span>
          <button
            class="btn small danger siphons-yes"
            onClick={() => {
              setArmed(false);
              if (act((g) => shutHaloSiphons(g))) sfx('select');
            }}
          >
            Shut them for good
          </button>
          <button class="btn small siphons-no" onClick={() => setArmed(false)}>
            Not now
          </button>
        </div>
      )}
    </div>
  );
}

function Message({ s, sig }: { s: GameState; sig: Signal }) {
  const age = isFinite(s.years) && isFinite(sig.sentYears) ? s.years - sig.sentYears : 0;
  const sv = s.survivors[sig.from];
  const open = !sig.resolved && sig.choices.length > 0;
  return (
    <div class={`message ${open ? 'open' : ''}`}>
      <div class="row">
        {sv && <span style={{ width: '8px', height: '8px', background: sv.color, display: 'inline-block' }} />}
        <span class="eyebrow grow">{senderName(s, sig)}</span>
        <span class="mono faint" style={{ fontSize: '12.5px' }} data-tip="How long ago this light left its sender.">
          {age > 1 ? `${formatYears(age)} old` : 'just now'} · turn {sig.arrivedTurn}
        </span>
      </div>
      <div class="msg-title">{sig.title}</div>
      <div class="flavor" style={{ color: 'var(--ink)' }}>{sig.text}</div>
      {sv && !sv.alive && open && <div class="warn" style={{ fontSize: '13.5px', marginTop: '4px' }}>By the time this reached us, they were already gone: nothing we answer can reach them now.</div>}
      {open && (
        <div class="row wrap" style={{ gap: '6px', marginTop: '8px' }}>
          {sig.choices.map((c) => {
            // (an answer that would reach a sender gone since cannot be given: goneAnswer)
            const gone = goneAnswer(s, sig, c.id);
            return (
              <button key={c.id} class="btn choice" disabled={!!gone} data-tip={gone ?? undefined} onClick={() => act((g) => answerSignal(g, sig.uid, c.id)) && sfx('select')}>
                <span>{c.label}</span>
                {(gone ?? c.hint) && <span class="h">{gone ?? c.hint}</span>}
              </button>
            );
          })}
        </div>
      )}
      {open && sig.kind === 'dark_reveal2' && siphonsRunning(s) && <ShutSiphons s={s} />}
      {sig.resolved && sig.choices.length > 0 && <div class="faint" style={{ fontSize: '12.5px', marginTop: '4px' }}>Answered: {sig.choices.find((c) => c.id === sig.resolved)?.label ?? sig.resolved}</div>}
    </div>
  );
}

function PatternView({ p }: { p: number[] }) {
  return (
    <svg viewBox="0 0 120 60" width="120" height="60" aria-label={`Pattern ${p.join(', ')}`}>
      <line x1="0" y1="56" x2="120" y2="56" stroke="var(--line-2)" />
      {p.map((v, i) => (
        <g key={i}>
          <line x1={20 + i * 40} x2={20 + i * 40} y1={56} y2={56 - v * 5} stroke="var(--neon)" stroke-width="3" />
          <circle cx={20 + i * 40} cy={56 - v * 5} r="4" fill="none" stroke="var(--neon)" />
        </g>
      ))}
    </svg>
  );
}

/** Why they feel as they do: what they remember, newest first, and the standing reasons. */
function regardTip(s: GameState, sv: Survivor): string {
  const lines = [...(sv.memory ?? [])].reverse().map((m) => `Turn ${m.turn}: ${m.what} (${m.delta > 0 ? '+' : '−'}${Math.abs(m.delta)})`);
  if (!lines.length) lines.push('Nothing yet: they are making up their minds about us.');
  // what they have heard of the Hunger in us, not our own Taint (judge.ts)
  const heard = sv.heardTaint ?? 0;
  const ceiling = Math.round(100 - heard * HEARD_CEILING);
  if (heard > 0) lines.push(`The Hunger they have heard of in us (Taint ${Math.round(heard)}): they think no better of us than ${ceiling}.`);
  if (shuns(s, sv)) lines.push('They shun us for it: no new pact, trade or joint work.');
  const trust = Math.min(SANCTUARY_TRUST, ceiling);
  if (hasCharter(s, 'sanctuary') && sv.disposition >= 0 && sv.disposition < trust) lines.push(`Sanctuary: their trust in us grows, toward ${trust}.`);
  return lines.join('\n');
}

const SLOW_STAGE = ['Unknown.', 'A pattern near the Heart: someone counting, very slowly.', 'They have spoken. They wait for an answer.', 'In conversation, one thought per age.', 'They have shared the seam: the Aeon Seed is possible.'];
const DARK_STAGE = ['Unknown.', 'Mass without light: something invisible moves in the halo.', 'Contact by gravity: they answer moved masses with moved masses.', 'We know what the embers cost them.', 'They want to make one star.'];

/** Our clock, at the top of the screen: the rhythms we can talk at, from our minds' to our turn's. */
function OurClock({ s, logL }: { s: GameState; logL: number }) {
  const voice = voiceThread(s);
  const v = voiceClock(s, logL);
  const [lo, hi] = voiceRange(s, logL);
  const who = voice ? THREAD_DEFS[voice].name : 'our machines';
  const tip = `Two minds can talk if their clocks are within about a thousandfold (a millionfold with a civilization of processes and protocol). We can keep any rhythm from how fast our dominant voice thinks (${who}, ${pow10(v)} yr a thought) to how long our turn is (${pow10(logL)} yr at this pace), since we can always let a turn pass between replies. Slow the pace to reach slower minds; quicken it, past how fast our minds think, to reach faster ones. Slow turns cost minds that cannot slow their own clock (tempo strain).`;
  return (
    <div class="card" style={{ marginBottom: '10px' }} data-tip={tip}>
      <div class="row" style={{ gap: '10px', alignItems: 'baseline' }}>
        <span class="eyebrow">Our clock</span>
        <span class="mono grow">{Math.abs(hi - lo) < 0.05 ? `${pow10(lo)} yr` : `${pow10(lo)} to ${pow10(hi)} yr`}</span>
      </div>
      <div class="dim" style={{ fontSize: '13.5px' }}>
        {who} think at {pow10(v)} years; a turn at this pace spans {pow10(logL)}. We can talk with any mind within a thousandfold of that.
      </div>
    </div>
  );
}

/** What it would take to talk with a mind of clock `theirs`: a pace we can choose, or turns longer or shorter than any yet, or other minds of ours. */
function stepHint(s: GameState, logL: number, theirs: number, span: number): string {
  const gap = stepGap(voiceRange(s, logL), theirs);
  if (Math.abs(gap) <= span) return 'In reach: we can talk.';
  const r = reachBy(s, theirs, span);
  const head = gap > 0 ? 'Too slow for us' : 'Too fast for us';
  const n = Math.ceil(Math.abs(r.tenfolds) - 1e-9);
  const how =
    r.pace !== null
      ? `at ${paceName(r.pace)} we could talk with them.`
      : `our turns would have to be about ${n} tenfold${n === 1 ? '' : 's'} ${r.tenfolds > 0 ? 'longer' : 'shorter'}, beyond any pace we can choose now.`;
  const voices = r.voices.length ? ` ${r.voices.map((t) => THREAD_DEFS[t].name).join(' or ')}, were they the most of us, could talk with them at this pace.` : '';
  return `${head}: ${how}${voices}`;
}

export function SignalsModal({ s }: { s: GameState }) {
  void rev.value;
  const arrived = s.civ.signals.filter((x) => x.arrivedTurn !== null);
  const openMsgs = arrived.filter((x) => !x.resolved && x.choices.length);
  const [tab, setTab] = useState<'messages' | 'others' | 'minds'>(openMsgs.length ? 'messages' : 'others');
  // a heavy choice waits for a yes: 'seize:<id>', 'storm:<id>', 'raze:<id>', 'war:<id>' or 'devour:<id>'
  const [armed, setArmed] = useState<string | null>(null);
  const logL = logTurnLength(turnStep(s));
  const my = voiceRange(s, logL);
  const cap = capital(s);
  const capSys = cap ? s.systems[cap.systemId] : s.systems[s.civ.homeSystemId];
  const survivors = Object.values(s.survivors);
  const slow = s.minds.slow;
  const dark = s.minds.dark;
  const history = arrived.filter((x) => !(!x.resolved && x.choices.length)).slice(-25).reverse();
  return (
    <ModalFrame title="Signals" eyebrow="Everything travels at the speed of light" icon="diplomacy">
      <OurClock s={s} logL={logL} />
      <div class="row" style={{ gap: '4px', marginBottom: '10px' }}>
        <button class={`btn small ${tab === 'messages' ? 'primary' : ''}`} onClick={() => setTab('messages')}>
          Messages {openMsgs.length ? `(${openMsgs.length})` : ''}
        </button>
        <button class={`btn small ${tab === 'others' ? 'primary' : ''}`} onClick={() => setTab('others')}>Survivors</button>
        {(slow.stage > 0 || dark.stage > 0) && (
          <button class={`btn small ${tab === 'minds' ? 'primary' : ''}`} onClick={() => setTab('minds')}>Other minds</button>
        )}
      </div>
      {tab === 'messages' && (
        <div class="col" style={{ gap: '10px' }}>
          {openMsgs.length === 0 && history.length === 0 && <p class="dim">Nothing has reached us yet. The dark is quiet.</p>}
          {openMsgs.map((sig) => (
            <Message key={sig.uid} s={s} sig={sig} />
          ))}
          {history.length > 0 && <div class="eyebrow" style={{ marginTop: '6px' }}>Earlier</div>}
          {history.map((sig) => (
            <Message key={sig.uid} s={s} sig={sig} />
          ))}
        </div>
      )}
      {tab === 'others' && (
        <div class="cards">
          {survivors.length === 0 && <p class="dim">As far as anyone can tell, we are alone.</p>}
          {survivors.map((sv) => {
            const home = s.systems[sv.homeSystemId];
            const ly = capSys && home ? distLy(capSys, home) : 0;
            const talk = canConverse(my, sv.clock, talkSpan(sv));
            return (
              <div key={sv.id} class="card" style={{ opacity: sv.alive ? 1 : 0.55 }}>
                <div class="row">
                  <span style={{ width: '12px', height: '12px', background: sv.color, display: 'inline-block' }} />
                  <h4 class="grow">{sv.contact || !sv.alive ? sv.name : 'Unknown signal'}</h4>
                </div>
                {sv.contact ? (
                  <>
                    <div class="drawer-plate" style={{ backgroundImage: `url(art/${wayArt(sv.way)}.webp)` }} role="img" aria-label={`${sv.name}: ${WAY_NAME[sv.way]}`} />
                    <div class="dim" style={{ fontSize: '13.5px' }}>
                      {sv.adjective}, {WAY_NAME[sv.way]}. {formatDistance(ly)} away{s.civs[sv.id] && ly > 0 ? `: we see them as they were ${formatYears(ly)} ago` : ''}.
                    </div>
                    {sv.alive ? (
                      <>
                        <dl class="kv">
                          <dt>People</dt>
                          <dd class="mono">{n0(asSeen(s, sv).pop)}</dd>
                          <dt data-tip="How they feel about us, and why: what they remember of what we did and what they heard of us, each when its light reached them.">Toward us</dt>
                          <dd class={`mono ${sv.disposition < -20 ? 'bad' : sv.disposition > 20 ? 'good' : ''}`} data-tip={regardTip(s, sv)}>
                            {sv.disposition > 20 ? 'friendly' : sv.disposition < -20 ? 'hostile' : 'wary'} ({n0(sv.disposition)})
                          </dd>
                          <dt data-tip={`How long one of their thoughts takes. We can talk with them if it is within ${sv.way === 'lattice' ? 'a millionfold (processes and protocol parse anything slow enough)' : 'about a thousandfold'} of any rhythm we can keep, from how fast our minds think to how long our turn is.`}>Clock</dt>
                          <dd class={`mono ${talk ? '' : 'warn'}`} data-tip={stepHint(s, logL, sv.clock, talkSpan(sv))}>{pow10(sv.clock)} yr{talk ? ' · in reach' : stepGap(my, sv.clock) > 0 ? ' · too slow for us' : ' · too fast for us'}</dd>
                          {shuns(s, sv) && (
                            <>
                              <dt data-tip={`They have heard of ${SANCTION_AT} Taint or more in us, and are not on that path themselves: no new pact, trade or joint work, and their archives are closed to us${sv.way === 'lattice' ? ' (the Tessellate keeps an agreement it made to the letter)' : ''}.`}>Shun us</dt>
                              <dd class="mono bad">for the Hunger they have heard of in us (Taint {n0(sv.heardTaint ?? 0)})</dd>
                            </>
                          )}
                          {(sv.taintSeen ?? 0) > 0 && (
                            <>
                              <dt data-tip={`Their Taint, as far as we have heard: each of their steps toward the Hunger reaches us when its light does. From ${JUST_CAUSE_AT}, the Hunger in them is cause for war, and no one holds a war on it against us.`}>The Hunger in them</dt>
                              <dd class={`mono ${hungerCause(sv) ? 'bad' : 'warn'}`}>
                                Taint {n0(sv.taintSeen ?? 0)}
                                {hungerCause(sv) ? ' · cause for war' : ''}
                              </dd>
                            </>
                          )}
                          {sv.aidGiven > 0 && (
                            <>
                              <dt data-tip="Energy we beamed to them that has reached them, and that they know came from us.">Aid received</dt>
                              <dd class="mono">{n0(sv.aidGiven)}</dd>
                            </>
                          )}
                          {starsSeen(s, sv).length > 1 && (
                            <>
                              <dt data-tip={s.civs[sv.id] ? 'The stars we can see they live at: we see a new star of theirs when the light of it reaches us.' : 'The stars we can see they live at. Their settlers cross at a fiftieth of the speed of light, and we see a new star of theirs when the light of it reaches us. Each one slows their decline.'}>Stars</dt>
                              <dd class="mono">{starsSeen(s, sv).length}</dd>
                            </>
                          )}
                          {sv.promised && (
                            <>
                              <dt data-tip={`We promised them warships against the swarm there. If ours fight it within ${PROMISE_TURNS} turns they will remember it; if we never come, they will remember that too.`}>Promised</dt>
                              <dd class={`mono ${sv.promised.kept ? 'good' : 'warn'}`}>
                                warships to {s.systems[sv.promised.systemId]?.name ?? 'their star'}
                                {sv.promised.kept ? ', and they came' : `, ${Math.max(0, PROMISE_TURNS - (s.turn - sv.promised.turn))} turns left`}
                              </dd>
                            </>
                          )}
                          {sv.war?.by && sv.war.by !== s.civ.id && (
                            <>
                              <dt data-tip={`They declared war on us on turn ${sv.war.since}${sv.war.cause ? `: ${sv.war.cause}` : ''}. Their warships come for ${s.systems[sv.war.at ?? '']?.name ?? 'our settlement nearest them'} first; held with none of ours there, a settlement of ours is besieged, and our stores and will run down. They make peace when it has gone on long enough, their warships are lost, or it has cost them a settlement. We can strike back: besiege and storm theirs, as they can ours.`}>War on us</dt>
                              <dd class="mono bad">
                                since turn {sv.war.since} · at {s.systems[sv.war.at ?? '']?.name ?? '?'}
                                {(() => {
                                  const held = besieged(s, sv.id, s.civ.id);
                                  return held ? ` · their siege of ${held.name} ${Math.min(held.siege!.turns, SIEGE_TURNS)}/${SIEGE_TURNS}` : ' · no siege';
                                })()}
                              </dd>
                            </>
                          )}
                          {sv.war && !(sv.war.by && sv.war.by !== s.civ.id) && !s.civs[sv.id] && (
                            <>
                              <dt data-tip={`At war since turn ${sv.war.since}. A siege is warships held at their first star turn after turn; after ${SIEGE_TURNS} turns we can try to take it. They arm as the war goes on.`}>War</dt>
                              <dd class="mono bad">
                                since turn {sv.war.since} · siege {sv.war.siege}/{SIEGE_TURNS} · their strength {warDefence(s, sv).toFixed(0)}
                              </dd>
                            </>
                          )}
                          {sv.war && !(sv.war.by && sv.war.by !== s.civ.id) && s.civs[sv.id] && (() => {
                            const front = warFront(s, sv.id);
                            const star = s.systems[sv.war.at ?? '']?.name ?? '?';
                            const held = besieged(s, s.civ.id, sv.id);
                            const c = held ?? front;
                            return (
                              <>
                                <dt data-tip={`At war since turn ${sv.war.since}. It is fought first at ${front ? `${front.name}, at ${star}` : star}: their settlement nearest our capital. A siege is warships of ours held at any settlement of theirs turn after turn, holding the line or closing in, with none of their warships there; after ${SIEGE_TURNS} turns we can storm it, and behind a Defence Grid or a Bastion Shell only with a Breacher. What it holds: 2, and 0.3 for each of its people, its Defence Grids, a Bastion Shell. They strike back at ours as we strike at theirs.`}>War</dt>
                                <dd class="mono bad">
                                  since turn {sv.war.since} · at {star}
                                  {held ? ` · our siege of ${held.name} ${Math.min(held.siege!.turns, SIEGE_TURNS)}/${SIEGE_TURNS}` : ' · no siege'}
                                  {c ? ` · it holds ${n1(holdOf(c))}${walled(c) ? ', walled' : ''}` : ''}
                                </dd>
                              </>
                            );
                          })()}
                          {sv.exodus && (
                            <>
                              <dt data-tip="They set out when our answer reaches them: minds cross as light, flesh by ship.">Coming to us</dt>
                              <dd class="mono good">
                                {n0(sv.exodus.n)} of them, {isFinite(s.years) && sv.exodus.at > s.years ? `here in ${formatYears(sv.exodus.at - s.years)}` : 'arriving'}
                              </dd>
                            </>
                          )}
                          {(sv.beams ?? []).length > 0 && (
                            <>
                              <dt data-tip="Energy we beamed to them, still crossing the dark at the speed of light.">On its way</dt>
                              <dd class="mono">
                                {n0((sv.beams ?? []).reduce((a, b) => a + b.energy, 0))} energy,{' '}
                                {(() => {
                                  const left = Math.min(...(sv.beams ?? []).map((b) => b.at)) - s.years;
                                  return isFinite(left) && left > 0 ? `there in ${formatYears(left)}` : 'arriving';
                                })()}
                              </dd>
                            </>
                          )}
                        </dl>
                        <div class="row">
                          <span class="eyebrow grow">Their prospects</span>
                          <span class="mono">{pct(sv.health)}</span>
                        </div>
                        <div class={`bar ${sv.health < 0.3 ? 'bad' : 'good'}`}><i style={{ width: pct(sv.health) }} /></div>
                        {sv.exodus && <div class="dim" style={{ fontSize: '13.5px' }}>They are leaving their star to live among us.</div>}
                        {!sv.exodus && (
                          <>
                            <div class="row wrap" style={{ gap: '4px' }}>
                              {[25, 100].map((e) => (
                                <button
                                  key={e}
                                  class="btn small"
                                  disabled={s.civ.energy < e}
                                  data-tip={`Beam ${e} energy to them. It crosses ${formatDistance(ly)} at the speed of light and reaches them ${ly > 0 ? `in ${formatYears(ly)}` : 'at once'}.${inStep(s, sv) ? '' : ' Our clocks are too far apart to talk: they will have the energy, but not know it came from us.'}`}
                                  onClick={() => act((g) => sendAid(g, sv.id, e)) && sfx('good')}
                                >
                                  {e === 25 ? 'Send 25 energy' : 'Send 100'}
                                </button>
                              ))}
                              {(() => {
                                const blocked = askBlocked(s, sv);
                                const cap = capital(s);
                                const d = cap ? distLy(s.systems[cap.systemId], s.systems[sv.homeSystemId]) : 0;
                                const turns = isFinite(s.years) ? turnsUntilYears(s, s.years + 2 * d, s.civ.pace) : 0;
                                const trip = d > 0 ? `${formatYears(2 * d)}${isFinite(turns) ? `, about ${turns} turn${turns === 1 ? '' : 's'} at your pace` : ''}` : 'no time';
                                const inFlight = s.civ.signals.find((x) => x.from === sv.id && x.kind === 'aid_answer' && x.arrivedTurn === null);
                                return (
                                  <button
                                    class="btn small"
                                    disabled={!!blocked}
                                    data-tip={
                                      inFlight
                                        ? `Our request is out. Their answer arrives in about ${formatYears(Math.max(0, inFlight.arriveYears - s.years))}.`
                                        : `${blocked ? `${blocked}\n` : ''}Ask them for energy. The request and their answer (and the beam carrying what they give) travel at the speed of light: back in ${trip}. They decide by how they feel about us, how they are faring and what we have given them; giving costs them a little. Every request costs some goodwill, more if we keep asking; once every ${ASK_COOLDOWN} turns at most. A hostile civilization refuses, and if we are weak, it will know.`
                                    }
                                    onClick={() => act((g) => askForAid(g, sv.id)) && sfx('signal')}
                                  >
                                    {inFlight ? 'Request on its way…' : 'Ask for help'}
                                  </button>
                                );
                              })()}
                              {sv.war ? (
                                <>
                                  {s.civs[sv.id] && (() => {
                                    const why = seizeBlocked(s, sv);
                                    const c = stormTarget(s, sv);
                                    const odds = c ? assaultOdds(s, s.civ.id, c) : 0;
                                    const terms = c ? `our warships there bring ${n1(assaultForce(s, s.civ.id, c))} against settlements, against the ${n1(holdOf(c))} it holds, on a draw: about ${pct(odds)} to win.` : '';
                                    const cause = warCause(s, sv);
                                    return (
                                      <>
                                        <button
                                          class={`btn small danger ${armed === `storm:${sv.id}` ? 'on' : ''} ${why ? 'disabled' : ''}`}
                                          data-tip={`${why ? `${why}\n` : ''}${c ? `Storm ${c.name}: ${terms} ` : ''}Taken, three tenths of its people flee to their own and the rest are ours, unwilling; three tenths of what was built there is wreckage. Thrown back, the siege begins again. Either way it costs hulls, the galaxy’s free energy pays for what it held, and everyone hears of it when the light arrives${cause ? '' : '. With no cause, it is a step toward the Hunger'}.`}
                                          onClick={() => !why && setArmed(armed === `storm:${sv.id}` ? null : `storm:${sv.id}`)}
                                        >
                                          {why || !c ? 'Storm' : `Storm (${pct(odds)})`}
                                        </button>
                                        <button
                                          class={`btn small danger ${armed === `raze:${sv.id}` ? 'on' : ''} ${why ? 'disabled' : ''}`}
                                          data-tip={`${why ? `${why}\n` : ''}${c ? `Raze ${c.name}: the same assault (${terms}) ` : 'The same assault, '}and won, nothing there is left, and no one. Everyone hears of it, and thinks worse of it than of a taking${cause ? '' : '. With no cause, it is a longer step toward the Hunger'}.`}
                                          onClick={() => !why && setArmed(armed === `raze:${sv.id}` ? null : `raze:${sv.id}`)}
                                        >
                                          Raze
                                        </button>
                                      </>
                                    );
                                  })()}
                                  {!s.civs[sv.id] && (() => {
                                    const why = seizeBlocked(s, sv);
                                    return (
                                      <button
                                        class={`btn small danger ${armed === `seize:${sv.id}` ? 'on' : ''} ${why ? 'disabled' : ''}`}
                                        data-tip={`${why ? `${why}\n` : ''}Take their first star by force: a battle against their strength (${warDefence(s, sv).toFixed(0)}), which we can lose. Everyone will hear of it when the light reaches them.`}
                                        onClick={() => !why && setArmed(armed === `seize:${sv.id}` ? null : `seize:${sv.id}`)}
                                      >
                                        Seize
                                      </button>
                                    );
                                  })()}
                                  {sv.war.by && sv.war.by !== s.civ.id ? (
                                    <button class="btn small disabled" data-tip="They began this war, and it ends when they make peace: once it has gone on long enough, their warships are lost, or it has cost them a settlement.">
                                      Make peace
                                    </button>
                                  ) : (
                                    <button class="btn small" data-tip="Stop the war. They hear of it when the light arrives; the ill will takes longer to fade." onClick={() => act((g) => peace(g, sv.id)) && sfx('good')}>
                                      Make peace
                                    </button>
                                  )}
                                </>
                              ) : (
                                (() => {
                                  const why = warBlocked(s, sv);
                                  const cause = warCause(s, sv);
                                  return (
                                    <button
                                      class={`btn small danger ${armed === `war:${sv.id}` ? 'on' : ''} ${why ? 'disabled' : ''}`}
                                      data-tip={`${why ? `${why}\n` : ''}${cause ? `${cause} ` : ''}The Threads must consent (${WAR_ACCORD} accord); resolve −5, dissent +8, every Thread’s standing −${cause ? 1 : 3}. Our pacts with them end. Everyone hears of it when the light arrives${cause === HUNGER_CAUSE ? ', and no one blames us' : cause ? ', and few blame us' : ', and those who hate us join against us'}. No trade, archives or refuge while it lasts.`}
                                      onClick={() => !why && setArmed(armed === `war:${sv.id}` ? null : `war:${sv.id}`)}
                                    >
                                      Declare war
                                    </button>
                                  );
                                })()
                              )}
                              {hasCharter(s, 'absorb_the_weak') && (
                                <button class={`btn small danger ${armed === `devour:${sv.id}` ? 'on' : ''}`} data-tip="Devour them whole while they are weak. The Hunger's way." onClick={() => setArmed(armed === `devour:${sv.id}` ? null : `devour:${sv.id}`)}>
                                  Devour
                                </button>
                              )}
                            </div>
                            <div class="pacts">
                              <div class="eyebrow" style={{ marginTop: '8px' }} data-tip="Proposed and answered at the speed of light, so a pact takes the round trip to seal. Each costs accord, the Threads' consent to bind us, and every pact in force makes the next dearer. Breaking one is heard everywhere.">
                                Pacts
                              </div>
                              {PACT_KINDS.map((k) => {
                                const on = hasPact(sv, k);
                                const waiting = sv.proposal?.kind === k;
                                const why = pactBlocked(s, sv, k);
                                return (
                                  <div key={k} class="row" style={{ gap: '6px', alignItems: 'center', marginTop: '3px' }}>
                                    <span class={`grow ${on ? 'good' : 'dim'}`} style={{ fontSize: '13.5px' }} data-tip={PACTS[k].desc}>
                                      {PACTS[k].name}
                                      {on ? ` · since turn ${sv.pacts?.[k]}` : waiting ? ' · proposed: waiting for their answer' : ''}
                                    </span>
                                    {on ? (
                                      <button class="btn small" data-tip="End it. They hear of it first and worst, everyone else when the light reaches them." onClick={() => act((g) => breakPact(g, sv.id, k)) && sfx('bad')}>
                                        End
                                      </button>
                                    ) : (
                                      !waiting && (
                                        <button
                                          class={`btn small pact-propose ${why ? 'disabled' : ''}`}
                                          data-tip={why ? `Cannot propose it: ${why}` : `Propose it: ${pactCost(s)} accord now, back if they decline. Our proposal reaches them in ${formatYears(ly)}, and their answer comes back as long again.`}
                                          onClick={() => !why && act((g) => proposeAPact(g, sv.id, k)) && sfx('signal')}
                                        >
                                          Propose · {pactCost(s)}
                                        </button>
                                      )
                                    )}
                                  </div>
                                );
                              })}
                              {(() => {
                                // their pacts with the others, as far as their news has reached us
                                const known = heardTies(s, sv.id);
                                return (
                                  known.length > 0 && (
                                    <div class="dim" style={{ fontSize: '13.5px', marginTop: '6px' }} data-tip="Their pacts with the other civilizations, as far as the news of them has reached us.">
                                      With the others: {known.map((k) => `${k.kinds.map((x) => PACTS[x].name).join(' and ')} with ${s.survivors[k.other]?.name ?? k.other}`).join('; ')}
                                    </div>
                                  )
                                );
                              })()}
                            </div>
                          </>
                        )}
                        {armed?.endsWith(`:${sv.id}`) && (
                          <div class="row wrap confirm-heavy" style={{ gap: '6px', alignItems: 'center' }}>
                            <span class="warn" style={{ fontSize: '13.5px' }}>
                              {armed.startsWith('storm') || armed.startsWith('raze')
                                ? (() => {
                                    const c = stormTarget(s, sv);
                                    const odds = pct(c ? assaultOdds(s, s.civ.id, c) : 0);
                                    return armed.startsWith('storm')
                                      ? `Storm ${c?.name ?? 'their settlement'}? About ${odds} to take it. Three tenths of its people would flee to their own; the rest would be ours, unwilling. Every civilization will hear of it.`
                                      : `Raze ${c?.name ?? 'their settlement'}? About ${odds} to destroy it, and everyone in it. Every civilization will hear of it.`;
                                  })()
                                : armed.startsWith('seize')
                                ? `Take ${sv.name}’s star by force? Some of them would live on as our people; the rest would not. Every civilization will hear of it.`
                                : armed.startsWith('war')
                                  ? `Go to war with ${sv.name}? ${warCause(s, sv) ?? 'Everyone will hear of it, and those who hate us will join against us.'}`
                                  : `Devour ${sv.name} whole? There is no way back from this.`}
                            </span>
                            <button
                              class="btn small danger"
                              onClick={() => {
                                const what = armed;
                                setArmed(null);
                                if (act((g) => (what.startsWith('storm') ? seize(g, sv.id) : what.startsWith('raze') ? seize(g, sv.id, true) : what.startsWith('seize') ? seize(g, sv.id) : what.startsWith('war') ? goToWar(g, sv.id) : devour(g, sv.id)))) sfx('bad');
                              }}
                            >
                              {armed.startsWith('storm') ? 'Storm it' : armed.startsWith('raze') ? 'Raze it' : armed.startsWith('seize') ? 'Seize their star' : armed.startsWith('war') ? 'Declare war' : 'Devour them'}
                            </button>
                            <button class="btn small" onClick={() => setArmed(null)}>
                              Not now
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div class="dim" style={{ fontSize: '13.5px' }}>
                        {sv.fate === 'faded' ? 'Their lights went out.' : sv.fate === 'saved' ? 'They made it, with our help.' : sv.fate === 'absorbed' ? 'They live on as part of us.' : sv.fate === 'seized' ? (s.civs[sv.id] ? 'We took the last of their settlements.' : 'We took their star.') : sv.fate === 'destroyed' ? 'We destroyed the last of their settlements.' : sv.fate === 'conquered' ? 'Another civilization took the last of their settlements.' : sv.fate === 'devoured' ? 'We ate them.' : sv.fate === 'transcended' ? 'They went somewhere we cannot follow.' : sv.fate === 'hungered' ? 'They became what they feared.' : 'Gone.'}
                      </div>
                    )}
                  </>
                ) : (
                  <div class="dim" style={{ fontSize: '13.5px' }}>
                    {sv.alive ? 'Something artificial, too far or too faint to make out yet. Our voice has not reached them.' : 'Gone before we ever met.'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {tab === 'minds' && (
        <div class="cards">
          {slow.stage > 0 && (
            <div class="card">
              <div class="eyebrow">Around the Heart</div>
              <h4>The Slow Ones</h4>
              <div class="drawer-plate" style={{ backgroundImage: 'url(art/slow.webp)' }} role="img" aria-label="The Heart, and the stars around it dimming and brightening in a pattern" />
              <div class="flavor" style={{ fontSize: '14.5px' }}>{slow.flags.silent ? 'Silent. They stopped answering when we began to eat.' : SLOW_STAGE[slow.stage]}</div>
              <dl class="kv">
                <dt>Their clock</dt>
                <dd class={`mono ${canConverse(my, slow.clock, 2.5) ? 'good' : 'warn'}`} data-tip={stepHint(s, logL, slow.clock, 2.5)}>{pow10(slow.clock)} yr</dd>
                <dt>Understanding</dt>
                <dd class="mono">{n0(slow.understanding)}</dd>
              </dl>
              {!canConverse(my, slow.clock, 2.5) && <div class="warn" style={{ fontSize: '13.5px' }}>{stepHint(s, logL, slow.clock, 2.5)}</div>}
            </div>
          )}
          {dark.stage > 0 && (
            <div class="card">
              <div class="eyebrow">In the halo</div>
              <h4>The Unlit</h4>
              <div class="flavor" style={{ fontSize: '14.5px' }}>{DARK_STAGE[Math.min(dark.stage, DARK_STAGE.length - 1)]}</div>
              <div class="row">
                <span class="eyebrow grow">Understanding</span>
                <span class="mono">{n0(dark.understanding)}</span>
              </div>
              <div class="bar neon"><i style={{ width: `${dark.understanding}%` }} /></div>
              {dark.stage >= 2 && (
                <>
                  <div class="eyebrow" style={{ marginTop: '6px' }}>Their last gesture</div>
                  <PatternView p={dark.lastPattern} />
                  <div class="dim" style={{ fontSize: '13.5px' }}>
                    Answer by moving mass (15 energy, 10 matter). Continue what they began, mirror it back, resonate with it, or hold still. A misread reply can move a world.
                  </div>
                  <div class="row wrap" style={{ gap: '4px' }}>
                    {(['continue', 'mirror', 'resonance', 'silence'] as const).map((g) => (
                      <button key={g} class="btn small" disabled={s.civ.flags.gesture_turn === s.turn} onClick={() => act((st) => makeGesture(st, g)) && sfx('signal')}>
                        {g === 'continue' ? 'Continue' : g === 'mirror' ? 'Mirror' : g === 'resonance' ? 'Resonate' : 'Hold still'}
                      </button>
                    ))}
                  </div>
                  {s.civ.flags.gesture_turn === s.turn && <div class="faint" style={{ fontSize: '12.5px' }}>Masses can be moved once per turn.</div>}
                </>
              )}
              <ShutSiphons s={s} card />
            </div>
          )}
        </div>
      )}
    </ModalFrame>
  );
}
