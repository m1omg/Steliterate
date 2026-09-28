import { useState } from 'preact/hooks';
import { ERA_BY_ID } from '../../game/eras';
import { deleteSlot, exportCode, hasSave, listSlots, loadGame, loadSlot, readSave, saveFile, saveGame, saveToSlot, type SlotInfo } from '../../game/save';
import { offerFile, pickTextFile } from '../download';
import type { GameState, LogEntry } from '../../game/types';
import { setVolumes } from '../../audio/core';
import { sfx } from '../../audio/sfx';
import { UI_SCALES, applyUiScale, uiZoom, bump, engine, game, modal, notify, rev, saveSettings, screen, selection, settings, view } from '../store';
import { Icon } from '../Icon';
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
    if (patch.uiScale) applyUiScale(patch.uiScale);
  };
  const g = screen.value === 'game' ? game.value : null;
  return (
    <ModalFrame title={g ? 'Menu' : 'Settings'} icon="settings" narrow>
      <div class="col" style={{ gap: '14px' }}>
        {g && (
          <div class="row wrap" style={{ gap: '6px' }}>
            <button class="btn primary" onClick={() => (saveGame(g) ? notify('Saved.', 'good') : notify('Could not save: storage is unavailable here. Use a save code.', 'bad'))}>
              <Icon name="save" /> Quick save
            </button>
            <button class="btn" onClick={() => (modal.value = { kind: 'save' })}>
              Save slots, load, export…
            </button>
            <button class="btn ghost" onClick={() => quitToMenu(g)}>
              Main menu
            </button>
          </div>
        )}
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
            {UI_SCALES.map((u) => (
              <button key={u.v} class={`btn small ${st.uiScale === u.v ? 'primary' : ''}`} onClick={() => set({ uiScale: u.v })}>
                {u.label}
              </button>
            ))}
          </div>
          {uiZoom.value < st.uiScale - 0.005 && <div class="faint" style={{ fontSize: '11.5px', marginTop: '4px' }}>This screen has room for ×{uiZoom.value.toFixed(2)} at most; bigger sizes stop there.</div>}
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
  // start centred on the capital (or the homeworld, if there is no capital)
  const cap = g.civ.capitalId ? g.colonies[g.civ.capitalId] : null;
  view.value = 'galaxy';
  engine()?.showGalaxy(cap?.systemId ?? g.civ.homeSystemId, 150, true);
}

/** Back to the title screen. The game is kept in the autosave slot, so Continue resumes it. */
function quitToMenu(g: GameState) {
  saveGame(g, true);
  sfx('click');
  modal.value = null;
  selection.value = null;
  screen.value = 'menu';
}

async function exportSave(g: GameState | null) {
  if (!g) return notify('No saved game found.', 'bad');
  const f = saveFile(g);
  const r = await offerFile(f.name, f.text);
  if (r === 'saved') notify(`Exported ${f.name}.`, 'good');
  else if (r === 'failed') notify('This browser would not save the file. Use a save code instead.', 'bad');
}

async function importSave() {
  const text = await pickTextFile('.json,.txt,application/json,text/plain');
  if (text == null) return;
  const g = readSave(text);
  if (g) startLoaded(g);
  else notify('That file is not a Steliterate save.', 'bad');
}

const ERA_SHORT: Record<string, string> = { dusk: 'the Long Dusk', degenerate: 'the Degenerate Age', blackhole: 'the Black Hole Age', dark: 'the Dark' };

function slotWhen(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Named saves: as many as the browser will hold. */
function SaveSlots({ s }: { s: GameState | null }) {
  const [slots, setSlots] = useState<SlotInfo[]>(() => listSlots());
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busySlot, setBusySlot] = useState(false);
  const refresh = () => setSlots(listSlots());
  const defaultName = s ? `${s.settings.civName} · turn ${s.turn}` : '';
  const save = async (id?: string, over?: string) => {
    if (!s || busySlot) return;
    setBusySlot(true);
    const r = await saveToSlot(s, over ?? (name || defaultName), id);
    setBusySlot(false);
    if (typeof r === 'string') notify(r, 'bad');
    else {
      notify(`Saved “${r.name}”.`, 'good');
      sfx('good');
      setName('');
    }
    setConfirm(null);
    refresh();
  };
  return (
    <div class="section" style={{ marginTop: 0 }}>
      <h3>Save slots</h3>
      {s && (
        <div class="row" style={{ gap: '6px', marginBottom: '8px' }}>
          <input class="grow" aria-label="Name of the new save" placeholder={defaultName} value={name} maxLength={60} onInput={(e) => setName((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
          <button class="btn primary" disabled={busySlot} onClick={() => save()}>
            <Icon name="save" /> Save to a new slot
          </button>
        </div>
      )}
      {slots.length === 0 ? (
        <p class="dim" style={{ fontSize: '12px', margin: 0 }}>No saved slots yet.</p>
      ) : (
        <div class="list save-slots">
          {slots.map((x) => (
            <div key={x.id} class="list-item" style={{ cursor: 'default' }}>
              <span class="grow">
                {x.name}
                <div class="faint" style={{ fontSize: '11px' }}>
                  {x.civ} · turn {x.turn}, {ERA_SHORT[x.era] ?? x.era} · saved {slotWhen(x.savedAt)} · {Math.max(1, Math.round(x.bytes / 1024))} KB
                </div>
              </span>
              <button
                class="btn small"
                onClick={async () => {
                  const g = await loadSlot(x.id);
                  if (g) startLoaded(g);
                  else notify('That slot could not be read.', 'bad');
                }}
              >
                Load
              </button>
              {s && (
                <button class={`btn small ${confirm === `o:${x.id}` ? 'danger' : 'ghost'}`} disabled={busySlot} onClick={() => (confirm === `o:${x.id}` ? save(x.id, x.name) : setConfirm(`o:${x.id}`))} data-tip="Save this game over the slot">
                  {confirm === `o:${x.id}` ? 'Overwrite?' : 'Overwrite'}
                </button>
              )}
              <button
                class={`btn small ${confirm === `d:${x.id}` ? 'danger' : 'ghost'}`}
                aria-label={`Delete ${x.name}`}
                onClick={() => {
                  if (confirm !== `d:${x.id}`) return setConfirm(`d:${x.id}`);
                  deleteSlot(x.id);
                  setConfirm(null);
                  refresh();
                }}
              >
                {confirm === `d:${x.id}` ? 'Delete?' : <Icon name="close" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function SaveModal({ s }: { s: GameState | null }) {
  const [code, setCode] = useState('');
  const [importText, setImportText] = useState('');
  return (
    <ModalFrame title="Save and load" icon="save" narrow>
      <div class="col" style={{ gap: '12px' }}>
        {s && (
          <div class="row wrap" style={{ gap: '6px' }}>
            <button class="btn ghost" onClick={() => quitToMenu(s)} data-tip="Your game is kept as the autosave: Continue picks it up.">
              Main menu
            </button>
          </div>
        )}
        <SaveSlots s={s} />
        <div class="eyebrow">Quick save and autosave</div>
        <div class="row wrap" style={{ gap: '6px' }}>
          {s && (
            <button class="btn" onClick={() => (saveGame(s) ? notify('Quick-saved.', 'good') : notify('Could not save: storage is unavailable here. Export a file or use a save code.', 'bad'))} data-tip="One quick slot, overwritten each time">
              Quick save
            </button>
          )}
          <button
            class="btn"
            disabled={!hasSave()}
            onClick={() => {
              const g = loadGame();
              if (g) startLoaded(g);
              else notify('No saved game found.', 'bad');
            }}
          >
            Load quick save
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
        <div class="eyebrow">Files: keep a game safe, or move it to another device</div>
        <div class="row wrap" style={{ gap: '6px' }}>
          {s && (
            <button class="btn" onClick={() => exportSave(s)} data-tip="Download this game as a file: keep it safe, or carry it to another device.">
              Export save file
            </button>
          )}
          <button class="btn" onClick={importSave} data-tip="Open a save file exported from this or another device.">
            Import save file…
          </button>
        </div>
        {!s && (hasSave() || hasSave(true)) && (
          <div class="row wrap" style={{ gap: '6px' }}>
            <button class="btn small" disabled={!hasSave()} onClick={() => exportSave(loadGame())}>
              Export quick save
            </button>
            <button class="btn small" disabled={!hasSave(true)} onClick={() => exportSave(loadGame(true))}>
              Export autosave
            </button>
          </div>
        )}
        <div class="eyebrow" style={{ marginTop: '4px' }}>
          Save codes: the same save as text, for pasting
        </div>
        {s && !code && (
          <div>
            <button class="btn small" onClick={() => setCode(exportCode(s))}>
              Make a save code
            </button>
          </div>
        )}
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
          <label for="import-code">Load from a save code (or a save file’s text)</label>
          <textarea id="import-code" class="codebox" value={importText} onInput={(e) => setImportText((e.target as HTMLTextAreaElement).value)} placeholder="Paste a save code here" />
          <button
            class="btn small"
            disabled={!importText.trim()}
            onClick={() => {
              const g = readSave(importText);
              if (g) startLoaded(g);
              else notify('That code could not be read.', 'bad');
            }}
          >
            Load code
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
