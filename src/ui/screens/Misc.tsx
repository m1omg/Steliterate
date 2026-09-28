import { useState } from 'preact/hooks';
import { ERA_BY_ID } from '../../game/eras';
import { exportCode, hasSave, importCode, loadGame, saveGame } from '../../game/save';
import type { GameState, LogEntry } from '../../game/types';
import { setVolumes } from '../../audio/core';
import { sfx } from '../../audio/sfx';
import { bump, engine, game, modal, notify, rev, saveSettings, screen, selection, settings } from '../store';
import { CODEX } from './Codex';
import { MANUAL } from './Manual';
import { startTutorial } from '../hud/Tutorial';
import { ModalFrame } from './Frame';

const LOG_FILTERS: { id: 'all' | LogEntry['kind']; name: string }[] = [
  { id: 'all', name: 'All' },
  { id: 'era', name: 'Ages' },
  { id: 'event', name: 'Choices' },
  { id: 'mind', name: 'Minds' },
  { id: 'bad', name: 'Losses' },
  { id: 'good', name: 'Gains' },
];

export function LogModal({ s }: { s: GameState }) {
  void rev.value;
  const [f, setF] = useState<(typeof LOG_FILTERS)[number]['id']>('all');
  const entries = s.log.filter((e) => f === 'all' || e.kind === f).slice(-400).reverse();
  return (
    <ModalFrame title="The Record" eyebrow={`${s.log.length} entries`} icon="log">
      <div class="row wrap" style={{ gap: '4px', marginBottom: '8px' }}>
        {LOG_FILTERS.map((x) => (
          <button key={x.id} class={`btn small ${f === x.id ? 'primary' : ''}`} onClick={() => setF(x.id)}>
            {x.name}
          </button>
        ))}
      </div>
      <div class="feed" style={{ maxHeight: 'none' }}>
        {entries.map((e, i) => (
          <div
            key={i}
            class={`e ${e.kind}`}
            style={{ cursor: e.systemId ? 'pointer' : 'default' }}
            onClick={() => {
              if (!e.systemId) return;
              selection.value = { kind: 'system', id: e.systemId };
              engine()?.select(e.systemId);
              engine()?.focusGalaxyOn(e.systemId, 120);
              modal.value = null;
            }}
          >
            <span class="faint mono" style={{ fontSize: '10px' }}>
              {ERA_BY_ID[e.era].numeral}·{e.turn}
            </span>{' '}
            {e.text}
          </div>
        ))}
      </div>
    </ModalFrame>
  );
}

export function CodexModal({ topic }: { topic?: string }) {
  const [cur, setCur] = useState(topic ?? MANUAL[0].id);
  const all = [...MANUAL, ...CODEX];
  const entry = all.find((c) => c.id === cur) ?? MANUAL[0];
  const isManual = MANUAL.includes(entry);
  const group = (label: string, list: typeof CODEX) => (
    <>
      <div class="eyebrow codex-group">{label}</div>
      {list.map((c) => (
        <button key={c.id} class={`btn small ${c.id === cur ? 'primary' : 'ghost'}`} onClick={() => setCur(c.id)}>
          {c.title}
        </button>
      ))}
    </>
  );
  return (
    <ModalFrame title="Codex" eyebrow="How to play, and how the end of the universe works" icon="info">
      <div class="codex">
        <nav class="codex-nav">
          {group('How to play', MANUAL)}
          {group('The science', CODEX)}
        </nav>
        <article class={`codex-body${isManual ? ' manual' : ''}`}>
          <h2>{entry.title}</h2>
          {entry.body.map((p, i) => (
            <p key={i} class={isManual ? '' : 'flavor'} style={{ color: 'var(--ink)' }}>
              {p}
            </p>
          ))}
        </article>
      </div>
    </ModalFrame>
  );
}

export function SettingsModal() {
  const st = settings.value;
  const set = (patch: Partial<typeof st>) => {
    const next = { ...st, ...patch };
    saveSettings(next);
    setVolumes(next.music, next.sfx);
    if (patch.quality) engine()?.setQuality(patch.quality);
    if (patch.uiScale) document.documentElement.style.fontSize = `${14 * patch.uiScale}px`;
  };
  return (
    <ModalFrame title="Settings" icon="settings" narrow>
      <div class="col" style={{ gap: '14px' }}>
        <div class="field">
          <label for="vol-music">Music {Math.round(st.music * 100)}%</label>
          <input id="vol-music" type="range" min="0" max="1" step="0.05" value={st.music} onInput={(e) => set({ music: Number((e.target as HTMLInputElement).value) })} />
        </div>
        <div class="field">
          <label for="vol-sfx">Sound effects {Math.round(st.sfx * 100)}%</label>
          <input id="vol-sfx" type="range" min="0" max="1" step="0.05" value={st.sfx} onInput={(e) => set({ sfx: Number((e.target as HTMLInputElement).value) })} onChange={() => sfx('click')} />
        </div>
        <div class="field">
          <label>Graphics</label>
          <div class="seg">
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button key={q} class={`btn small ${st.quality === q ? 'primary' : ''}`} onClick={() => set({ quality: q })}>
                {q}
              </button>
            ))}
          </div>
        </div>
        <div class="field">
          <label>Interface size</label>
          <div class="seg">
            {[0.9, 1, 1.12].map((u) => (
              <button key={u} class={`btn small ${st.uiScale === u ? 'primary' : ''}`} onClick={() => set({ uiScale: u })}>
                {u === 0.9 ? 'Compact' : u === 1 ? 'Normal' : 'Large'}
              </button>
            ))}
          </div>
        </div>
        {game.value && screen.value === 'game' && (
          <div class="field">
            <label>Guide</label>
            <div class="row wrap" style={{ gap: '6px' }}>
              <button
                class="btn small"
                onClick={() => {
                  if (!game.value) return;
                  startTutorial(game.value);
                  bump();
                  modal.value = null;
                }}
              >
                Start the guide again
              </button>
              <button class="btn small ghost" onClick={() => (modal.value = { kind: 'codex' })}>
                Open the manual
              </button>
            </div>
          </div>
        )}
        <p class="faint" style={{ fontSize: '12px', margin: 0 }}>
          Animation runs on elapsed time, so the game plays the same at any display refresh rate.
        </p>
      </div>
    </ModalFrame>
  );
}

export function startLoaded(g: GameState) {
  game.value = g;
  screen.value = 'game';
  modal.value = null;
  selection.value = null;
  bump();
  engine()?.showGalaxy();
  engine()?.focusGalaxyOn(g.civ.homeSystemId, 150, true);
}

export function SaveModal({ s }: { s: GameState | null }) {
  const [code, setCode] = useState('');
  const [importText, setImportText] = useState('');
  return (
    <ModalFrame title="Save and load" icon="save" narrow>
      <div class="col" style={{ gap: '12px' }}>
        {s && (
          <div class="row wrap" style={{ gap: '6px' }}>
            <button class="btn primary" onClick={() => (saveGame(s) ? notify('Saved.', 'good') : notify('Could not save: storage is unavailable here. Use a save code.', 'bad'))}>
              Save
            </button>
            <button class="btn" onClick={() => setCode(exportCode(s))}>
              Make a save code
            </button>
          </div>
        )}
        <div class="row wrap" style={{ gap: '6px' }}>
          <button
            class="btn"
            disabled={!hasSave()}
            onClick={() => {
              const g = loadGame();
              if (g) startLoaded(g);
              else notify('No saved game found.', 'bad');
            }}
          >
            Load saved game
          </button>
          <button
            class="btn"
            disabled={!hasSave(true)}
            onClick={() => {
              const g = loadGame(true);
              if (g) startLoaded(g);
              else notify('No autosave found.', 'bad');
            }}
          >
            Load autosave
          </button>
        </div>
        {code && (
          <div class="field">
            <label for="save-code">Save code: copy it somewhere safe</label>
            <textarea id="save-code" class="codebox" readOnly value={code} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />
            <button class="btn small" onClick={() => navigator.clipboard?.writeText(code).then(() => notify('Copied.', 'good'), () => notify('Select the code and copy it by hand.', 'info'))}>
              Copy
            </button>
          </div>
        )}
        <div class="field">
          <label for="import-code">Load from a save code</label>
          <textarea id="import-code" class="codebox" value={importText} onInput={(e) => setImportText((e.target as HTMLTextAreaElement).value)} placeholder="Paste a save code here" />
          <button
            class="btn small"
            disabled={!importText.trim()}
            onClick={() => {
              const g = importCode(importText.trim());
              if (g) startLoaded(g);
              else notify('That code could not be read.', 'bad');
            }}
          >
            Load code
          </button>
        </div>
        {s && (
          <button
            class="btn ghost"
            onClick={() => {
              saveGame(s, true);
              modal.value = null;
              screen.value = 'menu';
            }}
          >
            Return to the main menu
          </button>
        )}
      </div>
    </ModalFrame>
  );
}
