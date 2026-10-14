// The films' export page (film.html, for tools/film-render.mjs): one film at a fixed size, every
// moment drawn exactly on request (`__film.frame(t)`), and its cue rendered offline as a WAV.
// Served by the Vite dev server only; the game's build never includes it.
import '../ui/styles.css';
import { renderCue, wavBase64 } from './cue';
import { FILMS, type FilmId } from './films';
import { FilmPlayer } from './player';

const q = new URLSearchParams(location.search);
const id = (q.get('film') ?? 'dusk') as FilmId;
const w = Number(q.get('w') ?? 1920);
const h = Number(q.get('h') ?? 1080);
const host = document.getElementById('film')!;
host.style.width = `${w}px`;
host.style.height = `${h}px`;
const fate = q.get('fate') as 'decay' | 'stable' | 'curvature' | null;
const eta = q.get('eta');
const player = new FilmPlayer(host, FILMS[id] ? id : 'dusk', { quality: 'high', args: { fate: fate ?? undefined, eta: eta ? Number(eta) : undefined }, width: w, height: h, pixelRatio: 1 });

(window as unknown as { __film: unknown }).__film = {
  length: player.length,
  frame: (t: number) => player.frame(t),
  cue: async () => wavBase64(await renderCue(player.id, player.length + 1.5)),
  ready: () => document.fonts.ready.then(() => true),
};
