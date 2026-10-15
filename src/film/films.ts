import type { Ctx } from './draw';
import type { Lazy } from './paint';
import { blackHoleAge2 } from './blackhole';
import { GREAT_EVAPORATION2, LAST_HORIZON2 } from './dark';
import { DUSK2 } from './dusk';
import { ENDINGS2 } from './endings';
import { LAST_LIGHT2 } from './lastlight';

// The films (the new version, part 4): one for each age and each ending, every frame drawn by
// code from the film's time. A film is laid out once for its size and quality (`setup`), then
// draws any moment of itself (`draw`) and says what text stands over it then (`text`, real DOM
// text, for translation and screen readers). Its cuts fall on a beat grid; its sound is in cue.ts.
// The words are the game's own: each age's introduction, each ending's epilogue, and nothing of
// what an ending's text does not say.

export type FilmQuality = 'low' | 'medium' | 'high';
export type FilmId =
  | 'dusk'
  | 'last_light'
  | 'great_decay'
  | 'last_warmth'
  | 'great_evaporation'
  | 'last_horizon'
  | 'end_long_thought'
  | 'end_one_voice'
  | 'end_quiet_lattice'
  | 'end_aeon_seed'
  | 'end_last_garden'
  | 'end_hunger'
  | 'end_recurrence'
  | 'end_silence'
  | 'end_fade'
  | 'end_will_fails';
/** The films that end a game. */
export type EndingId = Extract<FilmId, `end_${string}`>;

/** What a film is told of the game it is shown in (the fate of matter, the moment), for its words and its timecode. */
export interface FilmArgs {
  fate?: 'decay' | 'stable' | 'curvature';
  eta?: number;
  /** Device pixels per CSS pixel the film is drawn at (for paintings sharp at that size). */
  pr?: number;
  /** The vignette and the grain laid over the frame by the page (as the game plays it), not drawn into it. */
  pageOverlays?: boolean;
}

/** A line of text over the film: where, in which voice, and how present it is now (0..1). */
export interface FilmText {
  id: string;
  text: string;
  /** title (display face), sub (mono, spaced), narration (serif italic), label and code (mono, small, in a corner), note (mono, small, anywhere: a diagram's labels) */
  kind: 'title' | 'sub' | 'narration' | 'label' | 'code' | 'note';
  at: 'tl' | 'tr' | 'bl' | 'br' | 'mid' | 'low' | 'free';
  opacity: number;
  /** A note's place (fractions of the frame's width and height), alignment, tone and size. */
  x?: number;
  y?: number;
  align?: 'l' | 'c' | 'r';
  tone?: 'accent' | 'ink' | 'dim';
  size?: 's' | 'm';
}

export interface FilmScene {
  draw(c: Ctx, t: number): void;
  text(t: number): FilmText[];
  /** Paint what later scenes need, until `until` (performance.now()), while the film plays. */
  warm?(until: number): void;
  /** Its paintings in the order it needs them, each once, and how many of them its first scene needs (the films' painter thread makes them in that order). */
  assets?: Lazy<unknown>[];
  first?: number;
}

export interface FilmDef {
  id: FilmId;
  /** Its name, for the Codex's list of films. */
  name: string;
  bpm: number;
  beats: number;
  accent: string;
  /** Lay it out for this size and quality; `eager` (the default) paints its first scene's pictures now. */
  setup(w: number, h: number, q: FilmQuality, args?: FilmArgs, eager?: boolean): FilmScene;
}

/** How long a film runs, in seconds. */
export const filmLength = (f: FilmDef) => (f.beats * 60) / f.bpm;

export const FILMS: Record<FilmId, FilmDef> = {
  dusk: DUSK2,
  last_light: LAST_LIGHT2,
  great_decay: blackHoleAge2('great_decay', 'The Great Decay'),
  last_warmth: blackHoleAge2('last_warmth', 'The Last Warmth'),
  great_evaporation: GREAT_EVAPORATION2,
  last_horizon: LAST_HORIZON2,
  ...ENDINGS2,
};

/** The film of a crossing, by its name (CrossingReport.title) and the age it goes to, or null for one with none. */
export function crossingFilm(title: string | undefined, to: string): FilmId | null {
  if (title === 'The Great Decay') return 'great_decay';
  if (title === 'The Last Warmth') return 'last_warmth';
  if (title === 'The Great Evaporation') return 'great_evaporation';
  if (title === 'The Last Light' || to === 'degenerate') return 'last_light';
  if (title === 'The Last Horizon' || to === 'dark') return 'last_horizon';
  return null;
}

/** The film of an ending, by its name, or null for one with none. */
export function endingFilmFor(ending: string): FilmId | null {
  const by: Record<string, FilmId> = {
    'The Long Thought': 'end_long_thought',
    'One Voice': 'end_one_voice',
    'The Quiet Lattice': 'end_quiet_lattice',
    'The Aeon Seed': 'end_aeon_seed',
    'The Last Garden': 'end_last_garden',
    'The Hunger': 'end_hunger',
    Recurrence: 'end_recurrence',
    Silence: 'end_silence',
    'The Fade': 'end_fade',
    'The Will Fails': 'end_will_fails',
  };
  return by[ending] ?? null;
}
