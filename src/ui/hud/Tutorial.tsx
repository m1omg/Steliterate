import { useEffect, useRef } from 'preact/hooks';
import { SHIP_BY_ID } from '../../game/data/ships';
import { colonies } from '../../game/sim/util';
import type { GameState } from '../../game/types';
import { Icon } from '../Icon';
import { act, modal, rev, selection } from '../store';
import { sfx } from '../../audio/sfx';

// The guide: a short run of steps over the first turns. The step lives in the save
// (flags.tut), so it survives a reload; deleting the flag ends the guide.

interface Step {
  title: string;
  text: string;
  /** CSS selector of the element to point at. */
  target?: string;
  /** When this returns true the guide moves on by itself. */
  done?: (s: GameState) => boolean;
}

const STEPS: Step[] = [
  {
    title: 'The end of the universe',
    text: 'You lead a people on a dying world at the very end of the age of stars. The universe itself is the enemy: stars go out, matter decays, black holes evaporate. Your aim is to keep going for as long as anything can. This guide covers the first turns; you can end it at any time.',
  },
  {
    title: 'The Chronometer',
    text: 'Across the top: where you are in the remaining life of the universe. Every turn covers more time than the last, from decades now to trillions of years later. Forecasts and milestones are pinned on it.',
    target: '.chrono',
  },
  {
    title: 'Energy first',
    text: 'Energy is the master resource: the big number is your reserve, the small one what the next turn adds or costs. Matter builds things, insight drives research, accord buys laws. Hover over any figure for its breakdown.',
    target: '.resources',
  },
  {
    title: 'Choose a research project',
    text: 'Open Research (the first button on the left, or R) and pick a project. Anything you learn from discoveries is carried into whatever you choose next.',
    target: '.rail > button:nth-child(1)',
    done: (s) => !!s.civ.researching,
  },
  {
    title: 'Your homeworld',
    text: 'Open your settlement: click the homeworld on the map, or use Settlements (S) on the rail.',
    target: '.rail > button:nth-child(2)',
    done: (s) => {
      const sel = selection.value;
      return sel?.kind === 'body' && colonies(s).some((c) => c.bodyId === sel.id);
    },
  },
  {
    title: 'Build something',
    text: 'This panel is the settlement: its yields, people, world and structures. Open Build and queue something. A Solar Array adds energy; a Shipyard lets you build settler ships.',
    target: '.drawer',
    done: (s) => colonies(s).some((c) => c.queue.length > 0),
  },
  {
    title: 'Send out the probes',
    text: 'You have two survey probes. Open Fleets (F), choose a probe and pick a nearby star from its list. Until a probe surveys a system, you only see its star.',
    target: '.rail > button:nth-child(3)',
    done: (s) => Object.values(s.fleets).some((f) => !!f.to && f.ships.some((x) => SHIP_BY_ID[x.cls]?.survey)),
  },
  {
    title: 'End the turn',
    text: 'Press End Turn, or Enter. The chips above it list anything still waiting for you; click one to go there.',
    target: '.endturn',
    done: (s) => s.turn > 1,
  },
  {
    title: 'Forecasts',
    text: 'Bottom left: what is coming, and roughly when. Click a forecast to find it on the map, or close it with ×. It stays pinned on the Chronometer.',
    target: '.bottom-left',
  },
  {
    title: 'Growing',
    text: 'To grow, settle other worlds. A System Lighter needs only a Shipyard and carries a family to another world of the same star. Crossing to other stars takes Kin Arks (Fusion Drives) or Seedcores (Mind Substrate). A ready settler lists where it can go.',
    target: '.rail > button:nth-child(3)',
  },
  {
    title: 'Pace and sleep',
    text: 'Bottom right: Pace makes the coming turns shorter (more decisions, less energy each) or longer (more energy, but the universe moves on faster). Sleep puts everyone under: upkeep falls to a tenth while energy still comes in.',
    target: '.pace',
  },
  {
    title: 'You are on your own',
    text: 'That is the basics. The Codex (K) has the full manual under How to play, and the science behind every age. The universe is not on your side. Endure.',
  },
];

function setStep(n: number | null) {
  act((g) => {
    if (n === null || n >= STEPS.length) delete g.flags.tut;
    else g.flags.tut = n;
  });
}

export function startTutorial(g: GameState) {
  g.flags.tut = 0;
}

export function Tutorial({ s }: { s: GameState }) {
  void rev.value;
  void selection.value;
  const step = s.flags.tut;
  const cur = step !== undefined ? STEPS[step] : undefined;
  const ring = useRef<HTMLDivElement>(null);

  // Move on once the player has done what the step asks.
  useEffect(() => {
    if (step === undefined || !cur?.done) return;
    if (cur.done(s)) {
      sfx('select');
      setStep(step + 1);
    }
  });

  // Keep the highlight ring over its target, wherever the layout puts it.
  useEffect(() => {
    if (!cur?.target) return;
    let raf = 0;
    const place = () => {
      const el = ring.current;
      const t = document.querySelector(cur.target!) as HTMLElement | null;
      if (el) {
        const r = t?.getBoundingClientRect();
        if (r && r.width > 0 && !modal.value) {
          el.style.display = 'block';
          el.style.left = `${r.left - 4}px`;
          el.style.top = `${r.top - 4}px`;
          el.style.width = `${r.width + 8}px`;
          el.style.height = `${r.height + 8}px`;
        } else el.style.display = 'none';
      }
      raf = requestAnimationFrame(place);
    };
    place();
    return () => cancelAnimationFrame(raf);
  }, [cur?.target]);

  if (!cur || step === undefined || modal.value) return null;
  const last = step === STEPS.length - 1;
  return (
    <>
      {cur.target && <div ref={ring} class="tut-ring" aria-hidden="true" />}
      <div class="tutorial panel" role="dialog" aria-label="Guide">
        <div class="row">
          <Icon name="info" cls="accent" />
          <div class="eyebrow grow">
            Guide · {step + 1} of {STEPS.length}
          </div>
          <button class="btn ghost small" aria-label="End the guide" data-tip="End the guide. Settings can start it again." onClick={() => setStep(null)}>
            <Icon name="close" />
          </button>
        </div>
        <div class="tut-title">{cur.title}</div>
        <p class="tut-text">{cur.text}</p>
        <div class="row" style={{ gap: '6px', justifyContent: 'flex-end' }}>
          <button
            class={`btn small ${cur.done ? 'ghost' : 'primary'}`}
            onClick={() => {
              sfx('click');
              setStep(last ? null : step + 1);
            }}
          >
            {last ? 'Finish' : cur.done ? 'Skip this step' : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}
