import { Fragment } from 'preact';
import { FIELDS, TECH_BY_ID, TECHS, type TechDef } from '../../game/data/techs';
import { WORKS } from '../../game/data/works';
import { ERAS } from '../../game/eras';
import { setResearch, startWork } from '../../game/sim/actions';
import { workCost, workRequirementMet } from '../../game/sim/endings';
import { project } from '../../game/sim/projection';
import { RESEARCH_DRAW, techAvailable, techCost, techVisible } from '../../game/sim/research';
import { eraIndex, hasTech } from '../../game/sim/util';
import type { GameState } from '../../game/types';
import { n0, n1, pct } from '../fmt';
import { Icon } from '../Icon';
import { act, game, notify, rev } from '../store';
import { sfx } from '../../audio/sfx';
import { ModalFrame } from './Frame';

function techTip(s: GameState, t: TechDef): string {
  const req = t.requires.map((r) => TECH_BY_ID[r]?.name ?? r);
  return [
    t.name,
    t.desc,
    req.length ? `Requires: ${req.join(', ')}` : '',
    t.speculative ? 'Speculative physics: the science here is uncertain.' : '',
    t.taint ? `Hunger-derived knowledge: +${t.taint} Taint.` : '',
    `Cost: ${techCost(s, t.id)} insight`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function ResearchModal({ s }: { s: GameState }) {
  void rev.value;
  const p = project(s);
  const cur = s.civ.researching ? TECH_BY_ID[s.civ.researching] : null;
  const curCost = cur ? techCost(s, cur.id) : 0;
  const curProg = cur ? s.civ.research[cur.id] ?? 0 : 0;
  const workShare = s.civ.work ? 0.5 : 0;
  const perTurn = p.insight * (1 - workShare);
  // already covered (stored insight): it finishes at the end of this turn, never "−3 turns"
  const turns = cur && perTurn > 0 ? Math.max(1, Math.ceil((curCost - curProg) / perTurn)) : Infinity;
  const pick = (t: TechDef) => {
    if (!techAvailable(s, t.id)) return;
    if (!act((g) => setResearch(g, t.id))) return;
    if (game.value?.civ.techs.includes(t.id)) {
      // stored insight already covered it: done on the spot, choose again
      sfx('good');
      notify(`${t.name}: worked out at once from stored insight.`, 'good');
    } else sfx('select');
  };
  return (
    <ModalFrame
      title="Research"
      eyebrow={`${n1(p.insight)} insight per turn${s.civ.work ? ' · half goes to the Great Work' : ''} · the labs draw ${n1(p.insight * RESEARCH_DRAW)} energy while working`}
      icon="research"
    >
      <div class="research-top">
        {cur ? (
          <div class="grow">
            <div class="eyebrow">Researching</div>
            <div class="row">
              <strong style={{ fontSize: '16px' }}>{cur.name}</strong>
              <span class="mono faint">{n0(Math.min(curProg, curCost))} / {curCost}{curProg >= curCost ? ' · done this turn' : isFinite(turns) ? ` · ${turns} turn${turns > 1 ? 's' : ''}` : ''}</span>
            </div>
            <div class="bar neon" style={{ marginTop: '4px' }}><i style={{ width: pct(Math.min(1, curProg / curCost)) }} /></div>
            <div class="dim" style={{ fontSize: '12px', marginTop: '4px' }}>{cur.desc}</div>
          </div>
        ) : (
          <div class="grow warn">
            Research is paused: the labs draw no power, and half of each turn’s insight is kept for later. Choose a project below to resume.
            {s.civ.flags.insight_bank ? ` ${n0(s.civ.flags.insight_bank)} insight is waiting and goes into whatever you choose.` : ''}
          </div>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div class="techgrid">
          <div />
          {ERAS.map((e) => (
            <div key={e.id} class="eh" style={{ opacity: eraIndex(e.id) > eraIndex(s.era) ? 0.45 : 1 }}>
              {e.numeral} · {e.name}
            </div>
          ))}
          {FIELDS.map((f) => (
            <Fragment key={f.id}>
              <div class="fh" data-tip={f.blurb}>
                {f.name}
              </div>
              {ERAS.map((e) => (
                <div key={`${f.id}-${e.id}`} class="techcell">
                  {TECHS.filter((t) => t.field === f.id && t.era === e.id).map((t) => {
                    const visible = techVisible(s, t);
                    const done = hasTech(s, t.id);
                    const avail = techAvailable(s, t.id);
                    const active = s.civ.researching === t.id;
                    const prog = s.civ.research[t.id] ?? 0;
                    if (!visible)
                      return (
                        <div key={t.id} class="tech locked" data-tip="Depends on whether protons decay. Research the Proton Question to find out.">
                          <div class="nm">???</div>
                        </div>
                      );
                    return (
                      <button
                        key={t.id}
                        class={`tech ${done ? 'done' : ''} ${active ? 'active' : ''} ${!done && !avail ? 'locked' : ''} ${t.taint ? 'dark' : ''}`}
                        data-tip={techTip(s, t)}
                        onClick={() => pick(t)}
                        disabled={!avail && !active}
                      >
                        <div class="nm">
                          {done && <Icon name="check" cls="good" />} {t.name}
                        </div>
                        <div class="cs">
                          {done ? 'known' : `${techCost(s, t.id)}${prog > 0 ? ` · ${pct(Math.min(1, prog / techCost(s, t.id)))}` : ''}`}
                          {t.speculative ? ' · speculative' : ''}
                        </div>
                        {prog > 0 && !done && <div class="bar neon"><i style={{ width: pct(Math.min(1, prog / techCost(s, t.id))) }} /></div>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
      <div class="section">
        <h3>Great Works</h3>
        <p class="dim" style={{ fontSize: '12px', margin: '0 0 8px' }}>
          The projects that can end this in something other than silence. Once begun, half of all insight goes into the active Work.
        </p>
        <div class="cards">
          {WORKS.map((w) => {
            const known = hasTech(s, w.tech);
            const cost = workCost(s, w.id);
            const prog = s.civ.works[w.id] ?? 0;
            const met = workRequirementMet(s, w.id);
            const active = s.civ.work === w.id;
            const inEra = w.eras.includes(s.era);
            const tainted = s.civ.taint > w.maxTaint;
            return (
              <div key={w.id} class={`card ${active ? 'enacted' : ''}`}>
                <div class="eyebrow">{w.path} · ending: {w.ending}</div>
                <h4>{w.name}</h4>
                <div class="dim" style={{ fontSize: '12px' }}>
                  {w.eras.map((e) => ERAS.find((x) => x.id === e)!.name).join(', ')} · needs {TECH_BY_ID[w.tech]?.name}
                </div>
                <div style={{ fontSize: '12px' }} class={met ? 'good' : 'warn'}>
                  {met ? <Icon name="check" /> : <Icon name="warning" />} {w.requirement}
                </div>
                {prog > 0 && (
                  <>
                    <div class="bar neon"><i style={{ width: pct(prog / cost) }} /></div>
                    <div class="mono faint" style={{ fontSize: '11px' }}>{n0(prog)} / {cost}</div>
                  </>
                )}
                <button
                  class={`btn small ${active ? 'on' : ''}`}
                  disabled={!known || !inEra || tainted || active}
                  data-tip={!known ? `Research ${TECH_BY_ID[w.tech]?.name} first.` : !inEra ? 'Not in this age.' : tainted ? 'What we have become cannot do this.' : prog > 0 ? 'Resume' : `Begin: ${w.energy} energy`}
                  onClick={() => act((g) => startWork(g, w.id)) && sfx('good')}
                >
                  {active ? 'In progress' : prog > 0 ? 'Resume' : `Begin (${w.energy} energy)`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ModalFrame>
  );
}
