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
import { CrossingScreen, EraIntro, EventModal, OutcomeScreen, eventResult } from './screens/Story';
import { TipLayer } from './Tip';
import { game, modal, rev, screen, targeting, toast } from './store';

function applyEraColors(s: GameState | null) {
  const era = ERA_BY_ID[s?.era ?? 'dusk'];
  const r = document.documentElement.style;
  r.setProperty('--accent', era.accent);
  r.setProperty('--accent-soft', era.accentSoft);
  r.setProperty('--neon', era.neon);
}

function Toast() {
  const t = toast.value;
  useEffect(() => {
    if (!t) return;
    const id = window.setTimeout(() => {
      if (toast.value === t) toast.value = null;
    }, 3800);
    return () => window.clearTimeout(id);
  }, [t]);
  if (!t) return null;
  return (
    <div class={`toast panel ${t.kind}`} role="status" onClick={() => (toast.value = null)}>
      {t.text}
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
          {targeting.value && (
            <div class="targeting panel" role="status">
              Choose a destination for {s.fleets[targeting.value.fleetId]?.name ?? 'the fleet'}.{' '}
              <button class="btn small ghost" onClick={() => (targeting.value = null)}>
                Cancel
              </button>
            </div>
          )}
          {!blocking && (s.pending.length > 0 || eventResult.value) && <EventModal s={s} />}
        </>
      )}
      <ModalHost s={s} />
      <Toast />
      <TipLayer />
    </div>
  );
}
