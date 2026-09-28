// Core data model. Everything in GameState is plain JSON so saves are trivial.

export type EraId = 'dusk' | 'degenerate' | 'blackhole' | 'dark';
export type ThreadId = 'kin' | 'echoes' | 'chorus' | 'lattice' | 'coldminds';
export type Focus = 'balanced' | 'energy' | 'industry' | 'insight' | 'accord';
export type ProtonFate = 'decays' | 'stable' | 'unknown';
export type EpochLength = 'brief' | 'standard' | 'vast';
export type Difficulty = 'gentle' | 'standard' | 'harsh';

export type PrimaryKind =
  | 'red_dwarf'
  | 'blue_dwarf'
  | 'white_dwarf'
  | 'black_dwarf'
  | 'brown_dwarf'
  | 'neutron_star'
  | 'black_hole'
  | 'smbh'
  | 'collision_star'
  | 'helium_star'
  | 'helium_giant'
  | 'dark_star'
  | 'rogue'
  | 'void';

export type BodyKind =
  | 'eyeball'
  | 'terran'
  | 'super_earth'
  | 'barren'
  | 'ice'
  | 'ocean_ice'
  | 'gas_giant'
  | 'ice_giant'
  | 'asteroids'
  | 'deep';

export const THREADS: ThreadId[] = ['kin', 'echoes', 'chorus', 'lattice', 'coldminds'];

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** A province of the Coalescence: the remains of one ancestral galaxy, or the halo/void. */
export interface Province {
  id: string;
  name: string;
  kind: 'core' | 'ancestral' | 'stream' | 'halo' | 'void';
  pos: Vec3; // display
  phys: Vec3; // ly
  radius: number; // display
  lore: string;
}

/** A reach: a local stellar neighbourhood (display 1 unit = 1 ly locally). */
export interface Region {
  id: string;
  name: string;
  provinceId: string;
  pos: Vec3;
  phys: Vec3;
  radiusLy: number;
  kind: 'reach' | 'globular' | 'core' | 'outlier';
}

export interface Primary {
  kind: PrimaryKind;
  mass: number; // solar masses
  lum: number; // base light factor for its current phase (era-normalised)
  blueAt?: number; // cosmic year a red dwarf leaves the main sequence (blue dwarf)
  whiteAt?: number; // cosmic year it collapses into a white dwarf
  bornAt?: number; // collision / merger stars
  diesAt?: number; // collision / merger stars burn out
  halo?: boolean; // white dwarf warmed by dark-matter capture in the Degenerate Age
  spin: number; // extractable rotational energy left (energy units)
  spinMax: number;
  evaporateAt?: number; // black holes: Hawking evaporation (cosmic year)
  rekindle?: number; // extra light from a feeding world or rekindling (era-normalised)
}

export interface StarSystem {
  id: string;
  name: string;
  regionId: string;
  provinceId: string;
  pos: Vec3; // display
  phys: Vec3; // ly
  primary: Primary;
  bodies: string[];
  seed: number;
  special?: 'home' | 'core' | 'outlier' | 'survivor' | 'slow' | 'sleeper';
  ejected?: boolean; // flung out of the galaxy by dynamical evaporation
  rust?: number; // Hunger infestation 0..1
  beacon?: boolean; // decoy beacon placed by the player
  gone?: boolean; // nothing left (dissolved / evaporated)
}

export interface Relic {
  kind: 'archive' | 'engine' | 'sleepers' | 'tomb' | 'ghosts';
  state: 'hidden' | 'found' | 'studied' | 'woken' | 'spent';
}

export interface Feeding {
  start: number; // cosmic year the planet reached its tidal limit
  tau: number; // mass-loss timescale (years)
  base: number; // era-normalised power at onset
  model: 'feed' | 'rekindle';
  revealed: boolean;
}

export interface Body {
  id: string;
  systemId: string;
  name: string;
  kind: BodyKind;
  orbit: number; // display orbit radius (system view units)
  phase: number;
  size: number; // display radius
  seed: number;
  orbitAU: number; // physical semi-major axis
  massEarth: number;
  habitability: number; // intrinsic suitability for Kin (0..1)
  vitality: number; // current living fraction (0..1)
  decline: number; // base vitality loss per turn
  coreHeat: number; // geothermal potential (0..1)
  richness: number; // matter yield multiplier
  hydrogen: number; // fusion fuel yield multiplier
  water?: number; // share of the surface covered by water or ice (subsurface ocean for ice-shelled worlds)
  traits: string[];
  relic?: Relic;
  colonyId: string | null;
  inspiralAt?: number; // cosmic year it reaches the tidal limit of its (dead) star
  feeding?: Feeding;
  rogue?: boolean; // stripped from its star by a stellar close pass
  dissolved?: boolean;
}

export interface QueueItem {
  uid: string;
  kind: 'structure' | 'ship';
  key: string;
  progress: number;
  cost: number;
}

export interface YieldLine {
  label: string;
  energy?: number;
  matter?: number;
  industry?: number;
  insight?: number;
  accord?: number;
}

export interface YieldBreakdown {
  energy: number;
  energyUpkeep: number;
  matter: number;
  matterUpkeep: number;
  industry: number;
  insight: number;
  accord: number;
  lines: YieldLine[];
}

export interface Colony {
  id: string;
  bodyId: string;
  systemId: string;
  name: string;
  founded: number;
  pops: Record<ThreadId, number>;
  growth: Record<ThreadId, number>;
  cryo: number; // Kin in Cold Sleep
  structures: Record<string, number>;
  queue: QueueItem[];
  focus: Focus;
  overdrive: boolean;
  damage: number; // 0..1 hearth damage from overdrive / attacks
  starving: number; // turns in energy deficit
  flags_rushed?: number; // turn of the last emergency shift
  last?: YieldBreakdown;
}

export interface Ship {
  cls: string;
  hp: number;
}

// fortify: warships dug in to defend where they are; hold: parked on purpose (neither counts as idle)
export type FleetOrder = 'idle' | 'move' | 'colonize' | 'survey' | 'tame' | 'fortify' | 'hold';

export interface Fleet {
  id: string;
  name: string;
  ships: Ship[];
  at: string | null; // system id while stationed
  from: string | null;
  to: string | null;
  traveled: number; // ly on current leg
  distance: number; // ly of current leg
  order: FleetOrder;
  targetBody?: string;
}

export interface CivStats {
  pops: number[];
  energy: number[];
  resolve: number[];
}

export interface Civ {
  name: string;
  homeSystemId: string;
  capitalId: string | null;
  energy: number; // reserve
  matter: number;
  accord: number; // stock, spent on charters
  resolve: number; // 0..100 the will to go on
  dissent: number; // 0..100
  standing: Record<ThreadId, number>; // each Thread's approval 0..100
  lowStanding: Record<ThreadId, number>; // turns spent below the fork threshold
  demands: Record<ThreadId, string | null>;
  techs: string[];
  researching: string | null;
  research: Record<string, number>;
  work: string | null; // active Great Work
  works: Record<string, number>;
  charters: string[];
  pace: number; // log10 factor against the Tide: +1 = quicken x10 (shorter turns), -1 = slow x10
  dormant: boolean;
  sleepTurns: number;
  wakeBonus: number;
  known: Record<string, 1 | 2>; // 1 = detected, 2 = surveyed
  continuity: number; // Dark Era integrity 0..100
  taint: number; // Hunger Taint 0..100
  flags: Record<string, number>;
  stats: CivStats;
}

// ---------------------------------------------------------------- other minds

export type SurvivorWay = 'garden' | 'upload' | 'chorus' | 'dormant' | 'lattice' | 'fork';

export interface Survivor {
  id: string;
  kind: 'survivor';
  name: string;
  adjective: string;
  color: string;
  way: SurvivorWay;
  homeSystemId: string;
  systems: string[];
  pop: number; // abstract population
  health: number; // 0..1 trajectory; 0 = gone
  reserve: number;
  disposition: number; // -100..100 toward you
  clock: number; // log10 years
  contact: boolean;
  alive: boolean;
  fate?: 'faded' | 'saved' | 'absorbed' | 'seized' | 'devoured' | 'transcended';
  aidGiven: number;
  lastSent: number; // turn
  forkOf?: ThreadId;
}

export interface Mind {
  id: string;
  kind: 'slow' | 'dark';
  name: string;
  systemId: string | null;
  stage: number;
  understanding: number; // 0..100
  clock: number; // log10 years they think on
  lastPattern: number[]; // for gestures
  flags: Record<string, number>;
}

export interface Swarm {
  id: string;
  systemId: string | null;
  from: string | null;
  to: string | null;
  traveled: number;
  distance: number;
  size: number;
  awake: boolean;
  tamed: boolean;
  appetite: number;
}

export interface SignalChoice {
  id: string;
  label: string;
  hint?: string;
}

export interface Signal {
  uid: string;
  from: string; // mind / survivor id, or 'astronomers'
  kind: string; // e.g. 'aid', 'trade', 'refugees', 'raid', 'last', 'gesture', 'slow'
  sentYears: number;
  arriveYears: number;
  arrivedTurn: number | null;
  title: string;
  text: string;
  data: Record<string, number | string>;
  choices: SignalChoice[];
  resolved: string | null;
}

export interface Forecast {
  uid: string;
  kind: string;
  title: string;
  text: string;
  dueYears: number; // cosmic year of the event (Infinity = open)
  systemId?: string;
  bodyId?: string;
  severity: 'info' | 'warn' | 'danger' | 'boon';
}

export interface LogEntry {
  turn: number;
  era: EraId;
  text: string;
  kind: 'info' | 'good' | 'bad' | 'era' | 'combat' | 'event' | 'mind';
  systemId?: string;
}

export interface PendingEvent {
  uid: string;
  defId: string;
  data: Record<string, string | number>;
}

export interface CrossingReport {
  from: EraId;
  to: EraId;
  lines: { text: string; kind: 'good' | 'bad' | 'info' }[];
  popsBefore: number;
  popsAfter: number;
  coloniesBefore: number;
  coloniesAfter: number;
}

export interface Outcome {
  kind: 'victory' | 'dark' | 'endurance' | 'defeat';
  ending: string;
  turn: number;
  eta: number;
}

export interface GameSettings {
  seed: number;
  survivors: number;
  length: EpochLength;
  difficulty: Difficulty;
  protonFate: ProtonFate;
  civName: string;
  homeName: string;
}

export interface Battle {
  systemId: string;
  turn: number;
  text: string;
}

export interface GameState {
  v: number;
  settings: GameSettings;
  rng: number;
  turn: number;
  era: EraId;
  eraTurn: number;
  years: number; // exact while < 1e300, Infinity beyond
  eta: number; // log10(years), canonical
  turnLength: number; // years spanned by the last turn (Infinity in deep time)
  protonsDecay: boolean;
  gfe: number; // galactic free energy 0..1
  provinces: Province[];
  regions: Region[];
  systems: Record<string, StarSystem>;
  bodies: Record<string, Body>;
  colonies: Record<string, Colony>;
  fleets: Record<string, Fleet>;
  civ: Civ;
  survivors: Record<string, Survivor>;
  minds: Record<string, Mind>;
  swarms: Record<string, Swarm>;
  signals: Signal[];
  forecasts: Forecast[];
  pending: PendingEvent[];
  log: LogEntry[];
  battles: Battle[];
  nextId: number;
  crossing: CrossingReport | null;
  outcome: Outcome | null;
  flags: Record<string, number>;
  fired: Record<string, number>;
  /** Save format version (absent in the first published saves: version 1). */
  saveVersion?: number;
}
