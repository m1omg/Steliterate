// Core data model. Everything in GameState is plain JSON so saves are trivial.

export type EraId = 'dusk' | 'degenerate' | 'blackhole' | 'dark';
export type ThreadId = 'kin' | 'echoes' | 'chorus' | 'lattice' | 'coldminds';
export type Focus = 'balanced' | 'energy' | 'industry' | 'insight' | 'accord';
export type ProtonFate = 'decays' | 'stable' | 'unknown';
export type EpochLength = 'brief' | 'standard' | 'vast';
export type Difficulty = 'gentle' | 'standard' | 'harsh';
export type Persona = 'player' | 'bio' | 'upload' | 'chorus' | 'lattice' | 'hunger';

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

export interface Galaxy {
  id: string;
  name: string;
  kind: 'host' | 'satellite';
  pos: Vec3; // display units
  phys: Vec3; // light-years
  radiusLy: number;
  displayRadius: number;
  axes: [number, number, number]; // ellipsoid axes in display units
  tilt: number;
  seed: number;
  coreSystemId: string | null;
}

/** A "reach": a local stellar neighbourhood inside a galaxy. */
export interface Region {
  id: string;
  name: string;
  galaxyId: string;
  pos: Vec3;
  phys: Vec3;
  radiusLy: number;
}

export interface Primary {
  kind: PrimaryKind;
  mass: number; // solar masses
  lum: number; // base light factor for its current phase
  blueAt?: number; // cosmic year a red dwarf leaves the main sequence (blue dwarf)
  whiteAt?: number; // cosmic year it collapses into a white dwarf
  bornAt?: number; // collision stars
  diesAt?: number; // collision stars burn out
  wdAge?: number; // for pre-existing white dwarfs: age at game start (years)
  halo?: boolean; // white dwarf embedded in the dark-matter halo (WIMP-heated)
  spin: number; // extractable rotational energy left (energy units)
  spinMax: number;
  evaporateAt?: number; // black holes: Hawking evaporation (cosmic year)
  ejected?: boolean; // galactic evaporation flung it out
}

export interface StarSystem {
  id: string;
  name: string;
  galaxyId: string;
  regionId: string;
  pos: Vec3; // display
  phys: Vec3; // ly
  primary: Primary;
  bodies: string[];
  seed: number;
  special?: 'home' | 'core' | 'satellite_core' | 'rival_home';
  hunger?: number; // infestation level
}

export interface Relic {
  kind: 'archive' | 'engine' | 'sleepers' | 'tomb' | 'lattice';
  surveyed: boolean;
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
  habitability: number; // intrinsic suitability for Kin (0..1)
  vitality: number; // current living fraction (0..1)
  decline: number; // base vitality loss per turn
  coreHeat: number; // geothermal potential (0..1)
  richness: number; // matter yield multiplier
  hydrogen: number; // fusion fuel yield multiplier
  traits: string[];
  relic?: Relic;
  colonyId: string | null;
  detached?: boolean; // stripped from its star by a stellar encounter
  dissolved?: boolean; // gone to proton decay
}

export interface QueueItem {
  uid: string;
  kind: 'structure' | 'ship';
  key: string;
  progress: number;
  cost: number;
}

export interface YieldBreakdown {
  energy: number;
  energyUpkeep: number;
  matter: number;
  matterUpkeep: number;
  industry: number;
  insight: number;
  accord: number;
  lines: { label: string; energy?: number; matter?: number; industry?: number; insight?: number; accord?: number }[];
}

export interface Colony {
  id: string;
  empireId: string;
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
  defense: number;
  starving: number; // turns in energy deficit
  last?: YieldBreakdown;
}

export interface Ship {
  cls: string;
  hp: number;
}

export type FleetOrder = 'idle' | 'move' | 'colonize' | 'survey';

export interface Fleet {
  id: string;
  empireId: string;
  name: string;
  ships: Ship[];
  at: string | null; // system id while stationed
  from: string | null;
  to: string | null;
  traveled: number; // ly travelled on the current leg
  distance: number; // ly of the current leg
  order: FleetOrder;
  targetBody?: string;
  moved?: boolean; // moved this turn (render hint)
}

export type RelationStatus = 'unknown' | 'peace' | 'war' | 'pact';

export interface Relation {
  status: RelationStatus;
  opinion: number; // -100..100
  since: number;
}

export interface EmpireStats {
  pops: number[];
  energy: number[];
  colonies: number[];
}

export interface Empire {
  id: string;
  name: string;
  adjective: string;
  color: string;
  isPlayer: boolean;
  persona: Persona;
  alive: boolean;
  capitalId: string | null;
  homeSystemId: string | null;
  energy: number; // reserve
  matter: number;
  accord: number; // stock
  techs: string[];
  researching: string | null;
  research: Record<string, number>;
  work: string | null; // active Great Work
  works: Record<string, number>; // progress (>= cost means complete)
  doctrines: string[];
  clockTarget: number; // log10 years; used when autoClock is off
  autoClock: boolean;
  dormant: boolean;
  sleepTurns: number;
  wakeBonus: number; // turns of post-wake bonus left
  threadAccord: Record<ThreadId, number>;
  lowAccordTurns: Record<ThreadId, number>;
  known: Record<string, 1 | 2>; // 1 = detected, 2 = surveyed
  relations: Record<string, Relation>;
  continuity: number;
  flags: Record<string, number>;
  stats: EmpireStats;
  ending?: string;
  diedTurn?: number;
  origin?: string; // forked from which empire
}

export interface LogEntry {
  turn: number;
  era: EraId;
  text: string;
  kind: 'info' | 'good' | 'bad' | 'era' | 'combat' | 'event';
  systemId?: string;
}

export interface PendingEvent {
  uid: string;
  defId: string;
  empireId: string;
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
  extinct: string[];
}

export interface Outcome {
  kind: 'victory' | 'defeat' | 'endurance';
  ending: string;
  turn: number;
  years: number;
}

export interface GameSettings {
  seed: number;
  rivals: number;
  length: EpochLength;
  difficulty: Difficulty;
  protonFate: ProtonFate;
  civName: string;
  homeName: string;
}

export interface Battle {
  systemId: string;
  sides: string[];
  losses: Record<string, number>;
  turn: number;
}

export interface GameState {
  v: number;
  settings: GameSettings;
  rng: number;
  turn: number;
  era: EraId;
  eraTurn: number;
  years: number;
  turnLength: number;
  protonsDecay: boolean;
  galaxies: Galaxy[];
  regions: Region[];
  systems: Record<string, StarSystem>;
  bodies: Record<string, Body>;
  colonies: Record<string, Colony>;
  fleets: Record<string, Fleet>;
  empires: Record<string, Empire>;
  playerId: string;
  pending: PendingEvent[];
  log: LogEntry[];
  battles: Battle[];
  nextId: number;
  crossing: CrossingReport | null;
  outcome: Outcome | null;
  flags: Record<string, number>;
  firedEvents: Record<string, number>;
}
