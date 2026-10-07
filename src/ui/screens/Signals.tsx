import { useState } from 'preact/hooks';
import { formatDistance, formatYears, logTurnLength } from '../../game/eras';
import { turnStep, turnsUntilYears } from '../../game/sim/flare';
import { answerSignal, askForAid, breakPact, devour, makeGesture, proposeAPact, seize, sendAid } from '../../game/sim/actions';
import { PACT_KINDS, PACTS, hasPact, pactBlocked, pactCost } from '../../game/sim/pacts';
import { ASK_COOLDOWN, askBlocked, inStep } from '../../game/sim/survivors';
import { canConverse, voiceClock } from '../../game/sim/signals';
import { capital, distLy, hasCharter } from '../../game/sim/util';
import type { GameState, Signal } from '../../game/types';
import { n0, pct, pow10 } from '../fmt';
import { WAY_NAME, wayArt } from '../labels';
import { act, rev } from '../store';
import { sfx } from '../../audio/sfx';
import { ModalFrame } from './Frame';

function senderName(s: GameState, sig: Signal): string {
  if (sig.from === 'astronomers') return 'Our astronomers';
  if (sig.from === 'slow') return 'The Slow Ones';
  if (sig.from === 'dark') return 'The halo';
  return s.survivors[sig.from]?.name ?? 'Unknown';
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
        <span class="mono faint" style={{ fontSize: '11px' }} data-tip="How long ago this light left its sender.">
          {age > 1 ? `${formatYears(age)} old` : 'just now'} · turn {sig.arrivedTurn}
        </span>
      </div>
      <div class="msg-title">{sig.title}</div>
      <div class="flavor" style={{ color: 'var(--ink)' }}>{sig.text}</div>
      {sv && !sv.alive && open && <div class="warn" style={{ fontSize: '12px', marginTop: '4px' }}>By the time this reached us, they were already gone.</div>}
      {open && (
        <div class="row wrap" style={{ gap: '6px', marginTop: '8px' }}>
          {sig.choices.map((c) => (
            <button key={c.id} class="btn choice" onClick={() => act((g) => answerSignal(g, sig.uid, c.id)) && sfx('select')}>
              <span>{c.label}</span>
              {c.hint && <span class="h">{c.hint}</span>}
            </button>
          ))}
        </div>
      )}
      {sig.resolved && sig.choices.length > 0 && <div class="faint" style={{ fontSize: '11px', marginTop: '4px' }}>Answered: {sig.choices.find((c) => c.id === sig.resolved)?.label ?? sig.resolved}</div>}
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

const SLOW_STAGE = ['Unknown.', 'A pattern near the Heart: someone counting, very slowly.', 'They have spoken. They wait for an answer.', 'In conversation, one thought per age.', 'They have shared the seam: the Aeon Seed is possible.'];
const DARK_STAGE = ['Unknown.', 'Mass without light: something invisible moves in the halo.', 'Contact by gravity: they answer moved masses with moved masses.', 'We know what the embers cost them.', 'They want to make one star.'];

export function SignalsModal({ s }: { s: GameState }) {
  void rev.value;
  const arrived = s.signals.filter((x) => x.arrivedTurn !== null);
  const openMsgs = arrived.filter((x) => !x.resolved && x.choices.length);
  const [tab, setTab] = useState<'messages' | 'others' | 'minds'>(openMsgs.length ? 'messages' : 'others');
  // a heavy choice waits for a yes: 'seize:<id>' or 'devour:<id>'
  const [armed, setArmed] = useState<string | null>(null);
  const logL = logTurnLength(turnStep(s));
  const my = voiceClock(s, logL);
  const cap = capital(s);
  const capSys = cap ? s.systems[cap.systemId] : s.systems[s.civ.homeSystemId];
  const survivors = Object.values(s.survivors);
  const slow = s.minds.slow;
  const dark = s.minds.dark;
  const history = arrived.filter((x) => !(!x.resolved && x.choices.length)).slice(-25).reverse();
  return (
    <ModalFrame title="Signals" eyebrow={`Everything travels at the speed of light · our voice thinks at ${pow10(my)} yr`} icon="diplomacy">
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
            const talk = canConverse(my, sv.clock);
            return (
              <div key={sv.id} class="card" style={{ opacity: sv.alive ? 1 : 0.55 }}>
                <div class="row">
                  <span style={{ width: '12px', height: '12px', background: sv.color, display: 'inline-block' }} />
                  <h4 class="grow">{sv.contact || !sv.alive ? sv.name : 'Unknown signal'}</h4>
                </div>
                {sv.contact ? (
                  <>
                    <div class="drawer-plate" style={{ backgroundImage: `url(art/${wayArt(sv.way)}.webp)` }} role="img" aria-label={`${sv.name}: ${WAY_NAME[sv.way]}`} />
                    <div class="dim" style={{ fontSize: '12px' }}>{sv.adjective}, {WAY_NAME[sv.way]}. {formatDistance(ly)} away.</div>
                    {sv.alive ? (
                      <>
                        <dl class="kv">
                          <dt>People</dt>
                          <dd class="mono">{n0(sv.pop)}</dd>
                          <dt>Toward us</dt>
                          <dd class={`mono ${sv.disposition < -20 ? 'bad' : sv.disposition > 20 ? 'good' : ''}`}>{sv.disposition > 20 ? 'friendly' : sv.disposition < -20 ? 'hostile' : 'wary'} ({n0(sv.disposition)})</dd>
                          <dt data-tip="Two minds can only talk if their clocks are within about three orders of magnitude.">Clock</dt>
                          <dd class={`mono ${talk ? '' : 'warn'}`}>{pow10(sv.clock)} yr{talk ? '' : ' · out of step'}</dd>
                          {sv.aidGiven > 0 && (
                            <>
                              <dt data-tip="Energy we beamed to them that has reached them, and that they know came from us.">Aid received</dt>
                              <dd class="mono">{n0(sv.aidGiven)}</dd>
                            </>
                          )}
                          {(sv.beams ?? []).length > 0 && (
                            <>
                              <dt data-tip="Energy we beamed to them, still crossing the dark at the speed of light.">On its way</dt>
                              <dd class="mono">
                                {n0((sv.beams ?? []).reduce((a, b) => a + b.energy, 0))} energy, there in {formatYears(Math.max(0, Math.min(...(sv.beams ?? []).map((b) => b.at)) - s.years))}
                              </dd>
                            </>
                          )}
                        </dl>
                        <div class="row">
                          <span class="eyebrow grow">Their prospects</span>
                          <span class="mono">{pct(sv.health)}</span>
                        </div>
                        <div class={`bar ${sv.health < 0.3 ? 'bad' : 'good'}`}><i style={{ width: pct(sv.health) }} /></div>
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
                            const inFlight = s.signals.find((x) => x.from === sv.id && x.kind === 'aid_answer' && x.arrivedTurn === null);
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
                          <button class={`btn small danger ${armed === `seize:${sv.id}` ? 'on' : ''}`} data-tip="Take their star by force. Needs warships at their home. Everyone will hear of it, when the light reaches them." onClick={() => setArmed(armed === `seize:${sv.id}` ? null : `seize:${sv.id}`)}>
                            Seize
                          </button>
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
                                <span class={`grow ${on ? 'good' : 'dim'}`} style={{ fontSize: '12px' }} data-tip={PACTS[k].desc}>
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
                        </div>
                        {armed?.endsWith(`:${sv.id}`) && (
                          <div class="row wrap confirm-heavy" style={{ gap: '6px', alignItems: 'center' }}>
                            <span class="warn" style={{ fontSize: '12px' }}>
                              {armed.startsWith('seize') ? `Take ${sv.name}’s star by force? Some of them would live on as our people; the rest would not. Every civilization will hear of it.` : `Devour ${sv.name} whole? There is no way back from this.`}
                            </span>
                            <button
                              class="btn small danger"
                              onClick={() => {
                                const what = armed;
                                setArmed(null);
                                if (act((g) => (what.startsWith('seize') ? seize(g, sv.id) : devour(g, sv.id)))) sfx('bad');
                              }}
                            >
                              {armed.startsWith('seize') ? 'Seize their star' : 'Devour them'}
                            </button>
                            <button class="btn small" onClick={() => setArmed(null)}>
                              Not now
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <div class="dim" style={{ fontSize: '12px' }}>
                        {sv.fate === 'faded' ? 'Their lights went out.' : sv.fate === 'saved' ? 'They made it, with our help.' : sv.fate === 'absorbed' ? 'They live on as part of us.' : sv.fate === 'seized' ? 'We took their star.' : sv.fate === 'devoured' ? 'We ate them.' : sv.fate === 'transcended' ? 'They went somewhere we cannot follow.' : 'Gone.'}
                      </div>
                    )}
                  </>
                ) : (
                  <div class="dim" style={{ fontSize: '12px' }}>
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
              <div class="flavor" style={{ fontSize: '13px' }}>{slow.flags.silent ? 'Silent. They stopped answering when we began to eat.' : SLOW_STAGE[slow.stage]}</div>
              <dl class="kv">
                <dt>Their clock</dt>
                <dd class={`mono ${canConverse(my, slow.clock, 2.5) ? 'good' : 'warn'}`}>{pow10(slow.clock)} yr</dd>
                <dt>Understanding</dt>
                <dd class="mono">{n0(slow.understanding)}</dd>
              </dl>
              {!canConverse(my, slow.clock, 2.5) && <div class="warn" style={{ fontSize: '12px' }}>We think too fast for them. Slow down (pace, Echoes, Coldminds) to be heard.</div>}
            </div>
          )}
          {dark.stage > 0 && (
            <div class="card">
              <div class="eyebrow">In the halo</div>
              <h4>The Unlit</h4>
              <div class="flavor" style={{ fontSize: '13px' }}>{DARK_STAGE[Math.min(dark.stage, DARK_STAGE.length - 1)]}</div>
              <div class="row">
                <span class="eyebrow grow">Understanding</span>
                <span class="mono">{n0(dark.understanding)}</span>
              </div>
              <div class="bar neon"><i style={{ width: `${dark.understanding}%` }} /></div>
              {dark.stage >= 2 && (
                <>
                  <div class="eyebrow" style={{ marginTop: '6px' }}>Their last gesture</div>
                  <PatternView p={dark.lastPattern} />
                  <div class="dim" style={{ fontSize: '12px' }}>
                    Answer by moving mass (15 energy, 10 matter). Continue what they began, mirror it back, resonate with it, or hold still. A misread reply can move a world.
                  </div>
                  <div class="row wrap" style={{ gap: '4px' }}>
                    {(['continue', 'mirror', 'resonance', 'silence'] as const).map((g) => (
                      <button key={g} class="btn small" disabled={s.civ.flags.gesture_turn === s.turn} onClick={() => act((st) => makeGesture(st, g)) && sfx('signal')}>
                        {g === 'continue' ? 'Continue' : g === 'mirror' ? 'Mirror' : g === 'resonance' ? 'Resonate' : 'Hold still'}
                      </button>
                    ))}
                  </div>
                  {s.civ.flags.gesture_turn === s.turn && <div class="faint" style={{ fontSize: '11px' }}>Masses can be moved once per turn.</div>}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </ModalFrame>
  );
}
