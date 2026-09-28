import { useState } from 'preact/hooks';
import { DEFAULT_SETTINGS, newGame } from '../../game/newGame';
import { hasSave, loadGame } from '../../game/save';
import type { Difficulty, EpochLength, GameSettings, ProtonFate } from '../../game/types';
import { music } from '../../audio/music';
import { sfx } from '../../audio/sfx';
import { modal, screen } from '../store';
import { startLoaded } from './Misc';

export function MainMenu() {
  const canContinue = hasSave(true) || hasSave();
  return (
    <div class="menu">
      <div class="menu-art" style={{ backgroundImage: 'url(art/title.webp)' }} />
      <div class="menu-side">
        <div>
          <div class="eyebrow" style={{ marginBottom: '10px' }}>A survival game at the end of time</div>
          <h1 class="title">Steli&shy;terate</h1>
        </div>
        <p class="title-sub">The stars are going out. Your world is dying with its sun. Keep your people alive until the last light, and past it.</p>
        <div class="menu-buttons">
          {canContinue && (
            <button
              class="btn primary"
              onClick={() => {
                const g = loadGame(true) ?? loadGame();
                if (g) {
                  sfx('click');
                  startLoaded(g);
                  music.setEra(g.era);
                }
              }}
            >
              Continue
            </button>
          )}
          <button class={`btn ${canContinue ? '' : 'primary'}`} onClick={() => { sfx('click'); screen.value = 'setup'; }}>
            New game
          </button>
          <button class="btn" onClick={() => { sfx('click'); modal.value = { kind: 'save' }; }}>
            Load
          </button>
          <button class="btn" onClick={() => { sfx('click'); modal.value = { kind: 'codex' }; }}>
            Codex
          </button>
          <button class="btn" onClick={() => { sfx('click'); modal.value = { kind: 'settings' }; }}>
            Settings
          </button>
        </div>
        <div class="menu-foot">
          Four ages, from the last red dwarfs to the Dark Era beyond 10¹⁰⁰ years. The physics follows Adams &amp; Laughlin (1997), Dyson (1979) and Krauss &amp; Starkman (2000), with the speculative parts labelled as such in the Codex.
          <br />
          Sound starts after your first click.
        </div>
      </div>
    </div>
  );
}

function Seg<T extends string | number>({ value, options, onPick }: { value: T; options: { id: T; name: string; tip?: string }[]; onPick: (v: T) => void }) {
  return (
    <div class="seg">
      {options.map((o) => (
        <button key={String(o.id)} class={`btn small ${value === o.id ? 'primary' : ''}`} data-tip={o.tip} onClick={() => onPick(o.id)}>
          {o.name}
        </button>
      ))}
    </div>
  );
}

export function Setup() {
  const [st, setSt] = useState<GameSettings>({ ...DEFAULT_SETTINGS, seed: Math.floor(Math.random() * 1e9) });
  const set = (p: Partial<GameSettings>) => setSt({ ...st, ...p });
  const begin = () => {
    sfx('endturn');
    const g = newGame(st);
    startLoaded(g);
    modal.value = { kind: 'era_intro' };
  };
  return (
    <div class="menu">
      <div class="menu-art" style={{ backgroundImage: 'url(art/title.webp)', opacity: 0.35 }} />
      <div class="menu-side" style={{ maxWidth: '560px' }}>
        <div>
          <div class="eyebrow">New game</div>
          <h1 class="title" style={{ fontSize: 'clamp(36px, 5vw, 56px)' }}>The Long Dusk</h1>
        </div>
        <div class="field">
          <label for="civ-name">Your people</label>
          <input id="civ-name" value={st.civName} maxLength={40} onInput={(e) => set({ civName: (e.target as HTMLInputElement).value })} />
        </div>
        <div class="field">
          <label for="home-name">Your dying world</label>
          <input id="home-name" value={st.homeName} maxLength={24} onInput={(e) => set({ homeName: (e.target as HTMLInputElement).value })} />
        </div>
        <div class="field">
          <label>Other survivors</label>
          <Seg value={st.survivors} options={[0, 1, 2, 3, 4].map((n) => ({ id: n, name: n === 0 ? 'None' : String(n), tip: n === 0 ? 'No other young civilizations. The Hunger, the Slow Ones and stranger things remain.' : `${n} other civilization${n > 1 ? 's' : ''} facing the same end.` }))} onPick={(v) => set({ survivors: v })} />
        </div>
        <div class="field">
          <label>Epoch length</label>
          <Seg<EpochLength>
            value={st.length}
            options={[
              { id: 'brief', name: 'Brief', tip: 'Time runs faster: fewer turns in each age.' },
              { id: 'standard', name: 'Standard', tip: 'About 250 turns in all.' },
              { id: 'vast', name: 'Vast', tip: 'More turns in every age.' },
            ]}
            onPick={(v) => set({ length: v })}
          />
        </div>
        <div class="field">
          <label>Difficulty</label>
          <Seg<Difficulty>
            value={st.difficulty}
            options={[
              { id: 'gentle', name: 'Gentle', tip: 'Fewer swarms, cheaper research and works.' },
              { id: 'standard', name: 'Standard', tip: 'Hard. Most civilizations do not make it.' },
              { id: 'harsh', name: 'Harsh', tip: 'More swarms, dearer research, crueller crossings.' },
            ]}
            onPick={(v) => set({ difficulty: v })}
          />
        </div>
        <div class="field">
          <label>Do protons decay?</label>
          <Seg<ProtonFate>
            value={st.protonFate}
            options={[
              { id: 'unknown', name: 'Unknown', tip: 'Nobody knows yet, including you. Your scientists can find out.' },
              { id: 'decays', name: 'They decay', tip: 'Matter dissolves around η 30–40. The Great Decay is a crossing of its own.' },
              { id: 'stable', name: 'Stable', tip: 'Matter endures. Different endings open.' },
            ]}
            onPick={(v) => set({ protonFate: v })}
          />
        </div>
        <div class="field">
          <label for="seed">Seed</label>
          <div class="row">
            <input id="seed" class="grow" inputMode="numeric" value={String(st.seed)} onInput={(e) => set({ seed: Math.abs(parseInt((e.target as HTMLInputElement).value, 10) || 0) })} />
            <button class="btn small" onClick={() => set({ seed: Math.floor(Math.random() * 1e9) })}>
              Random
            </button>
          </div>
        </div>
        <div class="row" style={{ gap: '8px' }}>
          <button class="btn ghost" onClick={() => (screen.value = 'menu')}>
            Back
          </button>
          <button class="btn primary grow" style={{ minHeight: '46px', fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: '18px', letterSpacing: '0.14em', textTransform: 'uppercase' }} onClick={begin}>
            Begin
          </button>
        </div>
      </div>
    </div>
  );
}
