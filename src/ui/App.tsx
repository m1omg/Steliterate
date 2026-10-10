import { useEffect, useLayoutEffect } from 'preact/hooks';
import { ERA_BY_ID } from '../game/eras';
import type { GameState } from '../game/types';
import { music } from '../audio/music';
import { Hud } from './hud/Hud';
import { Drawer } from './panels/Drawer';
import { ChartersModal, ThreadsModal } from './screens/Society';
import { CodexModal, LogModal, SaveModal, SettingsModal } from './screens/Misc';
import { MainMenu, Setup } from './screens/Menu';
import { ResearchModal } from './screens/Research';
import { SignalsModal } from './screens/Signals';
import { FleetsModal, SystemsModal } from './screens/Lists';
import { CrossingScreen, EraIntro, EventModal, LoreModal, OutcomeScreen, eventResult, loreView } from './screens/Story';
import { TipLayer, uiFactor } from './Tip';
import { Icon } from './Icon';
import { dismissToast, engine, game, hoverStar, lvFolded, mapHover, modal, rev, screen, settings, targeting, toasts, touchInput, uiZoom } from './store';
import { sendPicked } from './screens/Lists';
import { SHIP_BY_ID } from '../game/data/ships';
import { formatDistance } from '../game/eras';
import { launchCost } from '../game/sim/fleets';
import { tripLabel } from './trip';
import { computeMods } from '../game/sim/mods';
import { distLy } from '../game/sim/util';
import { n0 } from './fmt';

function applyEraColors(s: GameState | null) {
  const era = ERA_BY_ID[s?.era ?? 'dusk'];
  const r = document.documentElement.style;
  r.setProperty('--accent', era.accent);
  r.setProperty('--accent-soft', era.accentSoft);
  r.setProperty('--neon', era.neon);
}

function Toasts() {
  const list = toasts.value;
  if (!list.length) return null;
  return (
    <div class="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} class={`toast panel ${t.kind}`} onClick={() => dismissToast(t.id)}>
          {t.text}
          {/* the magnifier mode keeps messages until closed (or the turn ends) */}
          {settings.value.lowVision && (
            <button
              class="btn ghost small toast-x"
              aria-label="Close this message"
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(t.id);
              }}
            >
              <Icon name="close" />
            </button>
          )}
          {t.action && (
            <button
              class="btn small toast-act"
              data-tip={t.action.tip}
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(t.id);
                t.action!.run();
              }}
            >
              <Icon name="system" /> {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function ModalHost({ s }: { s: GameState | null }) {
  const m = modal.value;
  if (!m) return null;
  switch (m.kind) {
    case 'codex':
      return <CodexModal topic={m.topic} />;
    case 'settings':
      return <SettingsModal />;
    case 'save':
      return <SaveModal s={s} />;
  }
  if (!s) return null;
  switch (m.kind) {
    case 'research':
      return <ResearchModal s={s} />;
    case 'fleets':
      return <FleetsModal s={s} />;
    case 'settlements':
      return <SystemsModal s={s} tab={m.tab} send={m.send} />;
    case 'charters':
      return <ChartersModal s={s} />;
    case 'threads':
      return <ThreadsModal s={s} />;
    case 'signals':
      return <SignalsModal s={s} />;
    case 'log':
      return <LogModal s={s} />;
    case 'crossing':
      return <CrossingScreen s={s} />;
    case 'outcome':
      return <OutcomeScreen s={s} />;
    case 'era_intro':
      return <EraIntro s={s} />;
  }
  return null;
}

/** The magnifier mode: what is under the pointer on the map, named in large type beside it (main.tsx sets it). */
function MapHover() {
  const h = mapHover.value;
  useEffect(() => {
    // off the map (over the panels), it goes
    const off = (e: PointerEvent) => {
      if (mapHover.value && !(e.target instanceof HTMLCanvasElement)) mapHover.value = null;
    };
    window.addEventListener('pointermove', off);
    return () => window.removeEventListener('pointermove', off);
  }, []);
  if (!h?.text || !settings.value.lowVision || modal.value) return null;
  const f = uiFactor();
  const vw = window.innerWidth / f;
  const left = Math.min(h.x / f + 20, vw - 280);
  return (
    <div class="map-hover" style={{ left: `${Math.max(8, left)}px`, top: `${h.y / f + 20}px` }} aria-hidden="true">
      {h.text}
    </div>
  );
}

/** The magnifier mode's column: its top bar, to fold it away and see the whole map (M). */
function LvBar() {
  const folded = lvFolded.value;
  return (
    <div class="lv-bar">
      <button class="btn small" aria-expanded={!folded} data-tip={folded ? 'Bring the column back (M)' : 'Fold the column away to see the whole map (M)'} onClick={() => (lvFolded.value = !folded)}>
        <Icon name={folded ? 'system' : 'close'} /> {folded ? 'Show the panel' : 'Hide the panel'}
      </button>
    </div>
  );
}

export function App() {
  void rev.value;
  const s = game.value;
  const sc = screen.value;
  const lv = !!settings.value.lowVision;
  const folded = lv && lvFolded.value;
  void uiZoom.value; // (the column's width follows the interface size)
  // the magnifier mode's column covers one side: what is selected sits in the middle of the rest
  useLayoutEffect(() => {
    const place = () => {
      const eng = engine();
      if (!eng) return;
      const col = document.querySelector('.hud');
      const w = window.innerWidth;
      const r = col?.getBoundingClientRect();
      const beside = lv && !folded && sc === 'game' && !!r && r.width > 0 && r.width <= w * 0.8;
      // (messages sit beside it: styles.css; over it when it fills the screen)
      document.documentElement.style.setProperty('--lv-col', beside ? `${Math.round(r!.width / uiFactor())}px` : '0px');
      if (!beside) return eng.setFocusX(null);
      eng.setFocusX(r!.left > 1 ? r!.left / 2 : (r!.right + w) / 2);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  });
  applyEraColors(sc === 'game' ? s : null);
  useEffect(() => {
    if (sc !== 'game') music.setMood('menu');
    else if (s) music.setEra(s.era);
  }, [sc]);
  // danger ahead: the score tightens
  useEffect(() => {
    if (sc !== 'game' || !s || s.outcome) return;
    const danger = s.forecasts.some((f) => f.severity === 'danger' && (f.kind === 'hunger' || f.kind === 'crossing'));
    music.setMood(danger ? 'tension' : 'calm');
  });
  const m = modal.value?.kind;
  const blocking = m === 'crossing' || m === 'outcome' || m === 'era_intro';
  const story = !!s && !blocking && (s.pending.length > 0 || !!eventResult.value);
  const lore = !!s && !blocking && !!loreView.value && !s.pending.length && !eventResult.value;
  return (
    <div class="ui-root">
      {sc === 'menu' && <MainMenu />}
      {sc === 'setup' && <Setup />}
      {sc === 'game' && s && (
        <>
          {/* the HUD: no box of its own (display: contents), out of reach of Tab behind a window */}
          <div class={`hud${folded ? ' folded' : ''}`} inert={!!m || story || lore}>
            {lv && <LvBar />}
            <Hud s={s} />
            <Drawer s={s} />
            <TargetBanner s={s} />
          </div>
          {story && <EventModal s={s} />}
          {lore && <LoreModal s={s} />}
        </>
      )}
      <ModalHost s={s} />
      <Toasts />
      {sc === 'game' && <MapHover />}
      <TipLayer />
    </div>
  );
}

/** "Choose a destination": only while the fleet is still waiting for one. An order given any
 *  other way (the fleet panel's lists, a settle button) ends it too. */
function TargetBanner({ s }: { s: GameState }) {
  void rev.value;
  const t = targeting.value;
  const f = t ? s.fleets[t.fleetId] : null;
  const waiting = !!f && !!f.at && !f.to;
  useEffect(() => {
    if (t && !waiting) targeting.value = null;
  });
  if (!t || !waiting) return null;
  const here = s.systems[f!.at!];
  const hov = hoverStar.value ? s.systems[hoverStar.value] : null;
  const mods = computeMods(s);
  const ly = hov ? distLy(here, hov) : 0;
  const probe = f!.ships.some((x) => SHIP_BY_ID[x.cls]?.survey);
  const touch = touchInput.value;
  const chosen = hov && hov.id !== here.id;
  return (
    <div class="targeting panel" role="status">
      <div>
        <b>{f!.name}</b>:{' '}
        {touch ? 'tap a star to see the trip, then tap it again or press Send' : 'click a star on the map to send it there'}
        {probe ? '; it surveys any star it has not charted' : ''}.{touch ? '' : ' Esc cancels.'}
      </div>
      {chosen && (
        <div class="mono target-est">
          {hov.name} · {formatDistance(ly)} · {tripLabel(s, ly, mods, true)} · {n0(launchCost(s, f!, ly, mods))} energy
          {s.civ.known[hov.id] !== 2 ? ' · unsurveyed' : ''}
        </div>
      )}
      {touch && chosen && (
        <button class="btn small primary" onClick={() => sendPicked(hov.id)}>
          <Icon name="move" /> Send
        </button>
      )}
      <button class="btn small ghost" onClick={() => { targeting.value = null; hoverStar.value = null; }}>
        Cancel
      </button>
    </div>
  );
}
