import { useEffect } from 'preact/hooks';
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
import { FleetsModal, SettlementsModal } from './screens/Lists';
import { CrossingScreen, EraIntro, EventModal, OutcomeScreen, eventResult } from './screens/Story';
import { TipLayer } from './Tip';
import { dismissToast, game, hoverStar, modal, rev, screen, targeting, toasts } from './store';
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
      return <SettlementsModal s={s} tab={m.tab} />;
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

export function App() {
  void rev.value;
  const s = game.value;
  const sc = screen.value;
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
  return (
    <div class="ui-root">
      {sc === 'menu' && <MainMenu />}
      {sc === 'setup' && <Setup />}
      {sc === 'game' && s && (
        <>
          <Hud s={s} />
          <Drawer s={s} />
          <TargetBanner s={s} />
          {!blocking && (s.pending.length > 0 || eventResult.value) && <EventModal s={s} />}
        </>
      )}
      <ModalHost s={s} />
      <Toasts />
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
  return (
    <div class="targeting panel" role="status">
      <div>
        <b>{f!.name}</b>: click a star on the map to send it there{probe ? '; it surveys any star it has not charted' : ''}. Esc cancels.
      </div>
      {hov && hov.id !== here.id && (
        <div class="mono target-est">
          {hov.name} · {formatDistance(ly)} · {tripLabel(s, ly, mods, true)} · {n0(launchCost(s, f!, ly, mods))} energy
          {s.civ.known[hov.id] !== 2 ? ' · unsurveyed' : ''}
        </div>
      )}
      <button class="btn small ghost" onClick={() => { targeting.value = null; hoverStar.value = null; }}>
        Cancel
      </button>
    </div>
  );
}
