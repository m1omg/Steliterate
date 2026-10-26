import { useState } from 'preact/hooks';
import { music, PIECES, pieceOn, TRACK_CHOICES, type Piece, type TrackKey } from '../../audio/music';
import { ERA_BY_ID } from '../../game/eras';
import { deleteSlot, exportAllSaves, exportCode, fromOlderBuild, hasSave, importSaveBundle, listSlots, loadGame, loadSlot, readSave, readSaveBundle, saveFile, saveGame, saveToSlot, type SlotInfo } from '../../game/save';
import { OLDER_BUILD } from '../../keys';
import { offerFile, pickTextFile } from '../download';
import type { GameState, LogEntry } from '../../game/types';
import { setVolumes } from '../../audio/core';
import { sfx } from '../../audio/sfx';
import { PLAIN_MAX_SCALE, UI_SCALES, uiZoom, between, bump, engine, filmsOn, filmsSeen, game, modal, notify, rev, revealsOn, saveSettings, screen, selection, setViewMode, settings, view } from '../store';
import { FILMS, type FilmId } from '../../film/films';
import { fateOf } from '../../game/fate';
import { Icon } from '../Icon';
import { CODEX } from './Codex';
import { MANUAL } from './Manual';
import { startTutorial } from '../hud/Tutorial';
import { ModalFrame } from './Frame';
import { applyLowVision, pressable } from '../a11y';

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
  const entries = s.civ.log.filter((e) => f === 'all' || e.kind === f).slice(-400).reverse();
  return (
    <ModalFrame title="The Record" eyebrow={`${s.civ.log.length} entries`} icon="log">
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
            class={`e ${e.kind}${e.tone ? ` ${e.tone}` : ''}`}
            style={{ cursor: e.systemId ? 'pointer' : 'default' }}
            {...(e.systemId
              ? pressable(() => {
                  selection.value = { kind: 'system', id: e.systemId! };
                  engine()?.select(e.systemId!);
                  engine()?.focusGalaxyOn(e.systemId!, 120);
                  modal.value = null;
                })
              : {})}
          >
            <span class="faint mono" style={{ fontSize: '11.5px' }}>
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
          <div class="eyebrow codex-group">Films</div>
          <button class={`btn small ${cur === 'films' ? 'primary' : 'ghost'}`} onClick={() => setCur('films')}>
            Films seen
          </button>
        </nav>
        {cur === 'films' ? (
          <FilmsSeen />
        ) : (
          <article class={`codex-body${isManual ? ' manual' : ''}`}>
            <h2>{entry.title}</h2>
            {entry.body.map((p, i) => (
              <p key={i} class={isManual ? '' : 'flavor'} style={{ color: 'var(--ink)' }}>
                {p}
              </p>
            ))}
          </article>
        )}
      </div>
    </ModalFrame>
  );
}

/** The Codex's films: those this player has seen, in any game, to play again (back to this page after). */
function FilmsSeen() {
  const seen = filmsSeen();
  return (
    <article class="codex-body">
      <h2>Films seen</h2>
      {seen.length === 0 ? (
        <p class="flavor" style={{ color: 'var(--ink)' }}>
          A film plays as each age begins and as a game ends. Those you have seen are kept here, to play again.
        </p>
      ) : (
        <div class="col" style={{ gap: '6px' }}>
          {(Object.keys(FILMS) as FilmId[])
            .filter((id) => seen.includes(id))
            .map((id) => (
              <button key={id} class="btn" onClick={() => (modal.value = { kind: 'film', id, args: { fate: game.value ? fateOf(game.value) : undefined }, then: { kind: 'codex', topic: 'films' } })}>
                <Icon name="system" /> {FILMS[id].name}
              </button>
            ))}
        </div>
      )}
    </article>
  );
}

export function SettingsModal() {
  const st = settings.value;
  const set = (patch: Partial<typeof st>) => {
    const next = { ...st, ...patch };
    saveSettings(next);
    setVolumes(next.music, next.sfx);
    if (patch.playlist || patch.overture !== undefined) music.setPlaylist(next.playlist, next.overture);
    if (patch.quality) engine()?.setQuality(patch.quality);
    if (patch.uiScale !== undefined || patch.lowVision !== undefined || patch.lvSide !== undefined) applyLowVision();
  };
  // the magnifier mode: on, it also shows the map in light amplification (V changes it back); off,
  // a size only the mode offers comes back to the largest of the others
  const setLv = (on: boolean) => {
    set({ lowVision: on, uiScale: on ? st.uiScale : Math.min(st.uiScale, PLAIN_MAX_SCALE) });
    if (on) setViewMode(1);
  };
  const g = screen.value === 'game' ? game.value : null;
  return (
    <ModalFrame title={g ? 'Menu' : 'Settings'} icon="settings" narrow>
      <div class="col" style={{ gap: '14px' }}>
        {g && (
          <div class="row wrap" style={{ gap: '6px' }}>
            <button class="btn primary" onClick={() => between() && (saveGame(g) ? notify('Saved.', 'good') : notify('Could not save: storage is unavailable here. Use a save code.', 'bad'))}>
              <Icon name="save" /> Quick save
            </button>
            <button class="btn" onClick={() => (modal.value = { kind: 'save' })}>
              Save slots, load, export…
            </button>
            {/* (on a phone the rail leaves the Codex out, for room: it is here) */}
            <button class="btn" onClick={() => (modal.value = { kind: 'codex' })}>
              <Icon name="info" /> Codex
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
        <MusicTrackField />
        <PlaylistField playlist={st.playlist} overture={st.overture} set={set} />
        <div class="field">
          <label for="vol-sfx">Sound effects {Math.round(st.sfx * 100)}%</label>
          <input id="vol-sfx" type="range" min="0" max="1" step="0.05" value={st.sfx} onInput={(e) => set({ sfx: Number((e.target as HTMLInputElement).value) })} onChange={() => sfx('click')} />
        </div>
        <div class="field">
          <label>Graphics</label>
          <div class="seg">
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button key={q} class={`btn small ${st.quality === q ? 'primary' : ''}`} onClick={() => set({ quality: q, qualityChosen: true })}>
                {q}
              </button>
            ))}
          </div>
        </div>
        <div class="field">
          <label>Films</label>
          <div class="seg">
            <button class={`btn small ${filmsOn() ? 'primary' : ''}`} aria-pressed={filmsOn()} onClick={() => set({ films: true })}>
              On
            </button>
            <button class={`btn small ${!filmsOn() ? 'primary' : ''}`} aria-pressed={!filmsOn()} onClick={() => set({ films: false })}>
              Off
            </button>
          </div>
          <div class="faint" style={{ fontSize: '13px', marginTop: '4px', lineHeight: 1.45 }}>
            A short film, drawn as it plays, as each age begins and as a game ends. A click, Space or Escape skips one; the Codex plays again those you have seen. Off to begin with where the system asks for less motion.
          </div>
        </div>
        <div class="field">
          <label>Survey reveals</label>
          <div class="seg">
            <button class={`btn small ${revealsOn() ? 'primary' : ''}`} aria-pressed={revealsOn()} onClick={() => set({ reveals: true })}>
              On
            </button>
            <button
              class={`btn small ${!revealsOn() ? 'primary' : ''}`}
              aria-pressed={!revealsOn()}
              onClick={() => {
                set({ reveals: false });
                engine()?.skipReveal(true);
              }}
            >
              Off
            </button>
          </div>
          <div class="faint" style={{ fontSize: '13px', marginTop: '4px', lineHeight: 1.45 }}>
            Looking into a system your ships have just charted, the camera flies to each of its worlds in turn, a caption naming each with what the survey found there, then pulls back to the whole system. Next, Space or a click goes on to the next world; Skip, Enter or Escape shows them all at once. Off to begin with where the system asks for less motion.
          </div>
        </div>
        <div class="field">
          <label>Magnifier mode</label>
          <div class="seg">
            <button class={`btn small ${st.lowVision ? 'primary' : ''}`} aria-pressed={!!st.lowVision} onClick={() => setLv(true)}>
              On
            </button>
            <button class={`btn small ${!st.lowVision ? 'primary' : ''}`} aria-pressed={!st.lowVision} onClick={() => setLv(false)}>
              Off
            </button>
          </div>
          <div class="faint" style={{ fontSize: '13px', marginTop: '4px', lineHeight: 1.45 }}>
            For low vision and screen magnifiers: the panels in one scrolling column beside the map, two more sizes, stronger contrast and plainer type, larger stars and names on the map, and the focus (which a magnifier can follow) goes to whatever opens. N goes to what needs attention, B to a settlement’s Build tab, M folds the column away. A link that opens the game with it on: add ?lowvision to the address.
          </div>
          {st.lowVision && (
            <div class="seg" style={{ marginTop: '6px' }} role="group" aria-label="The column’s side">
              {(['left', 'right'] as const).map((side) => (
                <button key={side} class={`btn small ${(st.lvSide ?? 'right') === side ? 'primary' : ''}`} aria-pressed={(st.lvSide ?? 'right') === side} onClick={() => set({ lvSide: side })}>
                  Column on the {side}
                </button>
              ))}
            </div>
          )}
        </div>
        <div class="field">
          <label>Interface size</label>
          <div class="seg">
            {UI_SCALES.filter((u) => !u.lv || st.lowVision).map((u) => (
              <button key={u.v} class={`btn small ${st.uiScale === u.v ? 'primary' : ''}`} onClick={() => set({ uiScale: u.v })}>
                {u.label}
              </button>
            ))}
          </div>
          {uiZoom.value < st.uiScale - 0.005 && <div class="faint" style={{ fontSize: '13px', marginTop: '4px' }}>This screen has room for ×{uiZoom.value.toFixed(2)} at most; bigger sizes stop there.</div>}
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
        <p class="faint" style={{ fontSize: '13.5px', margin: 0 }}>
          Animation runs on elapsed time, so the game plays the same at any display refresh rate.
        </p>
      </div>
    </ModalFrame>
  );
}

/** Pick a track by hand, or leave it to the age and the moment (Automatic). */
function MusicTrackField() {
  const [chosen, setChosen] = useState<TrackKey | null>(music.chosen);
  const pick = (k: TrackKey | null) => {
    music.setTrack(k);
    setChosen(k);
  };
  const playing = TRACK_CHOICES.find((t) => t.key === music.current())?.name ?? 'the score for this moment';
  return (
    <div class="field">
      <label for="music-track">Music track</label>
      <select id="music-track" value={chosen ?? ''} onChange={(e) => pick(((e.target as HTMLSelectElement).value || null) as TrackKey | null)}>
        <option value="">Automatic: whatever fits the age and the moment</option>
        {TRACK_CHOICES.map((t) => (
          <option key={t.key} value={t.key}>
            {t.name}
          </option>
        ))}
      </select>
      <div class="faint" style={{ fontSize: '12.5px', marginTop: '3px' }}>
        {chosen ? `Playing ${playing} until you choose Automatic again.` : `Now: ${playing}.`}
      </div>
    </div>
  );
}

/** Which pieces each age plays in turn: its recordings, the synthesized score, or any mix. */
function PlaylistField({ playlist, overture, set }: { playlist: Record<string, boolean>; overture: boolean; set: (patch: { playlist?: Record<string, boolean>; overture?: boolean }) => void }) {
  const toggle = (key: TrackKey, p: Piece) => {
    const now = pieceOn(playlist, p);
    if (now && PIECES[key].filter((q) => pieceOn(playlist, q)).length === 1) {
      notify('Each age needs at least one piece to play.');
      return;
    }
    set({ playlist: { ...playlist, [p.id]: !now } });
    sfx('click');
  };
  return (
    <div class="field">
      <label>Playlist</label>
      <div class="col" style={{ gap: '6px' }}>
        {TRACK_CHOICES.filter((t) => t.key !== 'canon').map((t) => (
          <div key={t.key} class="row wrap" style={{ gap: '4px' }}>
            <span class="grow" style={{ fontSize: '14px', minWidth: '140px' }}>{t.name}</span>
            {PIECES[t.key].map((p) => {
              const on = pieceOn(playlist, p);
              return (
                <button key={p.id} class={`btn small ${on ? 'primary' : ''}`} aria-pressed={on} data-tip={p.url ? 'A recorded track (a generated instrumental).' : 'The game’s own score, synthesized as it plays.'} onClick={() => toggle(t.key, p)}>
                  {p.name}
                </button>
              );
            })}
            {t.key === 'degenerate' && (
              <button class={`btn small ${overture ? 'primary' : ''}`} aria-pressed={overture} data-tip="Pachelbel’s Canon in D, once, as the Degenerate Age begins." onClick={() => {
                  set({ overture: !overture });
                  sfx('click');
                }}
              >
                Canon first
              </button>
            )}
          </div>
        ))}
      </div>
      <div class="faint" style={{ fontSize: '12.5px', marginTop: '3px' }}>Each age plays the pieces lit here in turn, fading from one to the next; a lone piece repeats.</div>
    </div>
  );
}

export function startLoaded(g: GameState) {
  if (!between()) return;
  game.value = g;
  screen.value = 'game';
  // a crossing's report not yet read (the game was saved, or the page closed, with it open) opens again
  modal.value = g.civ.crossing ? { kind: 'crossing' } : null;
  selection.value = null;
  bump();
  // start centred on the capital (or the homeworld, if there is no capital)
  const cap = g.civ.capitalId ? g.colonies[g.civ.capitalId] : null;
  view.value = 'galaxy';
  engine()?.showGalaxy(cap?.systemId ?? g.civ.homeSystemId, 150, true);
  // loading from inside a game keeps the screen, so switch the score to the loaded game's age here
  music.setEra(g.era);
}

/** Back to the title screen. The game is kept in the autosave slot, so Continue resumes it. */
function quitToMenu(g: GameState) {
  if (!between()) return;
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

/** Every save in this browser, the slots, the quick save and the autosave, in one file. */
async function exportAll() {
  const f = await exportAllSaves();
  if (!f) return notify('There are no saves in this browser to export.', 'bad');
  const r = await offerFile(f.name, f.text);
  if (r === 'saved') notify(`Exported ${f.count} save${f.count === 1 ? '' : 's'} in ${f.name}.`, 'good');
  else if (r === 'failed') notify('This browser would not save the file. Export the saves one at a time, or use save codes.', 'bad');
}

/** One game (it loads), or a file of all saves (each comes in as a slot; `onSlots` then refreshes the list). */
async function importSave(onSlots?: () => void) {
  const text = await pickTextFile('.json,.txt,application/json,text/plain');
  if (text == null) return;
  const all = readSaveBundle(text);
  if (all) {
    const r = await importSaveBundle(all);
    onSlots?.();
    const parts = [
      r.added ? `${r.added} save${r.added === 1 ? '' : 's'} added as slots` : 'No new saves',
      r.skipped ? `${r.skipped} already here` : '',
      r.failed ? `${r.failed} could not be read or did not fit` : '',
      r.older ? `${r.older} from the older build, which keeps them: import ${r.older === 1 ? 'it' : 'them'} there` : '',
    ].filter(Boolean);
    notify(`${parts.join(', ')}.`, r.added ? 'good' : r.failed || r.older ? 'bad' : 'info', r.older ? olderBuildAction : undefined);
    if (r.added) sfx('good');
    return;
  }
  const g = readSave(text);
  if (g) startLoaded(g);
  else if (fromOlderBuild(text)) notify(OLDER_SAVE, 'bad', olderBuildAction);
  else notify('That file is not a Steliterate save.', 'bad');
}

/** A game saved before the new version: that build keeps it, and plays it. */
const OLDER_SAVE = 'That game is from the older build, before the new version. It plays on there, with your other games from then.';
const olderBuildAction = { label: 'Open it', tip: 'The older build, as it was on 13 Oct, in a new tab.', run: () => { window.open(OLDER_BUILD, '_blank', 'noopener'); } };

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
        <p class="dim" style={{ fontSize: '13.5px', margin: 0 }}>No saved slots yet.</p>
      ) : (
        <div class="list save-slots">
          {slots.map((x) => (
            <div key={x.id} class="list-item" style={{ cursor: 'default' }}>
              <span class="grow">
                {x.name}
                <div class="faint" style={{ fontSize: '12.5px' }}>
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
  // the slot list reads storage as it mounts: a new key after an import reads it again
  const [slotsKey, setSlotsKey] = useState(0);
  const anySaves = listSlots().length > 0 || hasSave() || hasSave(true);
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
        <SaveSlots key={slotsKey} s={s} />
        <div class="eyebrow">Quick save and autosave</div>
        <div class="row wrap" style={{ gap: '6px' }}>
          {s && (
            <button class="btn" onClick={() => between() && (saveGame(s) ? notify('Quick-saved.', 'good') : notify('Could not save: storage is unavailable here. Export a file or use a save code.', 'bad'))} data-tip="One quick slot, overwritten each time">
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
          <button class="btn" disabled={!anySaves} onClick={exportAll} data-tip="Every save slot, the quick save and the autosave in one file: to keep them all safe, or carry them to another device.">
            Export all saves
          </button>
          <button class="btn" onClick={() => importSave(() => setSlotsKey((k) => k + 1))} data-tip="Open a save file exported from this or another device: one game, which loads, or a file of all saves, each of which comes in as a slot.">
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
            <button class="btn small" onClick={() => between() && setCode(exportCode(s))}>
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
              else if (fromOlderBuild(importText)) notify(OLDER_SAVE, 'bad', olderBuildAction);
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
