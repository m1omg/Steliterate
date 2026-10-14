import { useEffect } from 'preact/hooks';
import { audio, duckMusic } from '../../audio/core';
import { music } from '../../audio/music';
import { playCue } from '../../film/cue';
import { FILMS, type FilmArgs, type FilmId } from '../../film/films';
import { FilmPlayer, elapsedClock, type FilmClock } from '../../film/player';
import { engine, modal, sawFilm, settings, type Modal } from '../store';

/**
 * A film (part 4), full screen, then what comes after it. It is drawn in a layer of its own on the
 * page, outside the interface's zoom (its sizes follow the screen; the magnifier mode enlarges its
 * words). The game's own view stops meanwhile (one canvas drawing at a time: phones); the music
 * steps back for the film's cue, whose clock the film keeps time with. A click, Space, Enter or
 * Escape skips it, as does its Skip button, which has the focus.
 */
export function FilmScreen({ id, args, then }: { id: FilmId; args?: FilmArgs; then?: Modal }) {
  useEffect(() => {
    const def = FILMS[id];
    const el = document.createElement('div');
    el.className = 'film-screen';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', `Film: ${def.name}`);
    el.style.setProperty('--film-accent', def.accent);
    document.body.append(el);
    const eng = engine();
    eng?.stop();
    let left = false;
    const go = () => {
      if (left) return;
      left = true;
      modal.value = then ?? null;
      // an ending's music waits for its film
      if (then?.kind === 'outcome') music.setMood('outcome');
    };
    // keep time with the cue where there is sound to play it on, else with elapsed time
    const a = audio();
    let clock: FilmClock = elapsedClock();
    let voice: ReturnType<typeof playCue> | null = null;
    if (a && a.ctx.state === 'running') {
      const at = a.ctx.currentTime + 0.1;
      voice = playCue(id, a.ctx, a.film, at, args?.fate);
      duckMusic(true);
      clock = { now: () => Math.max(0, a.ctx.currentTime - at) };
    }
    const player = new FilmPlayer(el, id, { quality: settings.value.quality, args, onEnd: go });
    const skip = document.createElement('button');
    skip.className = 'btn small film-skip';
    skip.textContent = 'Skip';
    skip.addEventListener('click', (e) => {
      e.stopPropagation();
      go();
    });
    el.append(skip);
    el.addEventListener('click', go);
    player.play(clock);
    sawFilm(id);
    skip.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        go();
      }
    };
    window.addEventListener('keydown', keys, true);
    return () => {
      window.removeEventListener('keydown', keys, true);
      player.dispose();
      el.remove();
      voice?.stop(0.35);
      duckMusic(false);
      eng?.start();
    };
  }, [id]);
  return null;
}
