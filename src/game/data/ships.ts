import type { ThreadId } from '../types';

/** What a ship fights: other ships, settlements (raids, sieges, assaults) or the Hunger's swarms. */
export type Against = 'ships' | 'settlements' | 'swarms';

export interface ShipDef {
  id: string;
  name: string;
  desc: string;
  tech?: string;
  cost: number;
  matter: number;
  mass: number; // for launch energy
  attack: number;
  /** Its strength against each kind of foe, where that differs from `attack`. */
  vs?: Partial<Record<Against, number>>;
  /** Energy a turn to keep it crewed, fuelled and patched (warships). */
  upkeep?: number;
  /** The chance it turns a raid away from the star where it is stopped (screens combine). */
  screen?: number;
  /** How much farther it sees from where it is stopped than a ship's plain eyes. */
  eyes?: number;
  /** How much stronger it defends dug in (fortified) than in the open, if not FORTIFY_BONUS. */
  dugIn?: number;
  hp: number;
  survey?: boolean;
  settles?: { thread: ThreadId; pops: number; structure?: string };
  tames?: boolean;
  inSystem?: boolean; // cannot leave its star
  crew?: number; // Kin drawn from the settlement that builds it
}

export const SHIPS: ShipDef[] = [
  { id: 'lighter', name: 'System Lighter', desc: 'A slow chemical-rocket hauler that carries one family of Kin and a folded dome to another world of the same star. It cannot cross interstellar space, and its colonists come from the settlement that builds it.', cost: 45, matter: 20, mass: 2, attack: 0, hp: 3, settles: { thread: 'kin', pops: 1, structure: 'habitat_dome' }, inSystem: true, crew: 1 },
  { id: 'probe', name: 'Survey Probe', desc: 'A small sublight probe that charts systems and ruins.', cost: 20, matter: 5, mass: 1, attack: 0, hp: 2, survey: true },
  { id: 'ark', name: 'Kin Ark', desc: 'Carries sleeping Kin and a folded dome to a new world.', tech: 'fusion_drives', cost: 80, matter: 30, mass: 8, attack: 0, hp: 6, settles: { thread: 'kin', pops: 2, structure: 'habitat_dome' } },
  { id: 'seedcore', name: 'Seedcore', desc: 'A substrate core with two Echoes aboard. Can settle anywhere, even the empty space around a dead star.', tech: 'mind_substrate', cost: 70, matter: 25, mass: 4, attack: 0, hp: 5, settles: { thread: 'echoes', pops: 2, structure: 'substrate_core' } },
  { id: 'spore', name: 'Lattice Spore', desc: 'A replicator seed that builds its own foundry on arrival.', tech: 'autonomous_replicators', cost: 60, matter: 30, mass: 4, attack: 1, hp: 6, settles: { thread: 'lattice', pops: 2, structure: 'lattice_foundry' } },
  { id: 'vaultship', name: 'Vault Ship', desc: 'Carries Coldminds in their vault to a new, colder home.', tech: 'cold_computation', cost: 90, matter: 30, mass: 6, attack: 0, hp: 8, settles: { thread: 'coldminds', pops: 3, structure: 'cold_vault' } },
  { id: 'picket', name: 'Picket', desc: 'A light watcher: long-range eyes, and a screen that turns raiders away from the star where it waits. No match for a swarm.', tech: 'orbital_defense', cost: 25, matter: 8, mass: 1, attack: 1, vs: { settlements: 0.5 }, hp: 4, upkeep: 0.1, screen: 0.5, eyes: 2 },
  { id: 'warden', name: 'Warden', desc: 'A patched-together escort with lasers and kinetic launchers.', tech: 'orbital_defense', cost: 45, matter: 15, mass: 3, attack: 3, hp: 10, upkeep: 0.3, screen: 0.2 },
  { id: 'hunter', name: 'Hunter', desc: 'Built on what Hunger Studies learned of the swarms: it strikes where a swarm holds itself together, twice as hard as a Warden.', tech: 'hunger_studies', cost: 70, matter: 25, mass: 4, attack: 3, vs: { swarms: 6 }, hp: 12, upkeep: 0.4, screen: 0.1 },
  { id: 'aegis', name: 'Aegis', desc: 'A heavy picket built around a salvaged reactor, at its strongest dug in.', tech: 'aegis_lattices', cost: 110, matter: 40, mass: 8, attack: 8, hp: 30, upkeep: 0.8, screen: 0.3, dugIn: 3 },
  { id: 'tender', name: 'Swarm Tender', desc: 'Broadcasts the dead makers’ command language to calm a swarm.', tech: 'command_language', cost: 70, matter: 20, mass: 3, attack: 0, hp: 8, tames: true },
];

export const SHIP_BY_ID: Record<string, ShipDef> = Object.fromEntries(SHIPS.map((s) => [s.id, s]));

/** A ship's strength against a kind of foe: its own figure for it, or else its attack. */
export function strength(cls: string, against: Against): number {
  const d = SHIP_BY_ID[cls];
  return d ? (d.vs?.[against] ?? d.attack) : 0;
}

/** A ship's figures, for the build list: what it fights with, its hull, its upkeep and its gifts. */
export function shipNote(d: ShipDef): string {
  const vs = (Object.entries(d.vs ?? {}) as [Against, number][]).filter(([, v]) => v !== d.attack);
  const parts = [
    d.attack || vs.length ? `Attack ${d.attack}${vs.map(([k, v]) => `, ${v} against ${k}`).join('')}` : '',
    `hull ${d.hp}`,
    d.upkeep ? `upkeep ${d.upkeep} energy a turn` : '',
    d.screen ? `turns ${Math.round(d.screen * 100)}% of raids away from its star` : '',
    d.eyes ? `sees ${d.eyes}× as far` : '',
    d.dugIn ? `${d.dugIn}× as strong fortified` : '',
  ].filter(Boolean);
  return `${parts.join('; ')}.`;
}

/** Whether a ship is a warship: it can fight something, and it carries no settlers. */
export function isWarship(cls: string): boolean {
  const d = SHIP_BY_ID[cls];
  return !!d && !d.settles && (d.attack > 0 || Object.values(d.vs ?? {}).some((v) => (v ?? 0) > 0));
}

/** A painted hull in public/art/ships/<look>.png (the Ark is 'settler', the Warden 'war'). */
export type FleetLook = 'settler' | 'probe' | 'war' | 'other' | 'lighter' | 'seedcore' | 'spore' | 'vaultship' | 'aegis' | 'tender';

const HULL: Record<string, FleetLook> = {
  ark: 'settler',
  lighter: 'lighter',
  seedcore: 'seedcore',
  spore: 'spore',
  vaultship: 'vaultship',
  warden: 'war',
  aegis: 'aegis',
  tender: 'tender',
};

/** Which painted hull stands for a fleet on the map and in the lists: its heaviest warship, else its first settler, else its tender. */
export function fleetLook(classes: string[]): FleetLook {
  if (classes.includes('aegis')) return HULL.aegis;
  // (the Hunter and the Picket wear the Warden's hull until they have their own)
  if (classes.includes('warden') || classes.includes('hunter') || classes.includes('picket')) return 'war';
  const settler = classes.find((c) => SHIP_BY_ID[c]?.settles);
  if (settler) return HULL[settler] ?? 'settler';
  if (classes.length > 0 && classes.every((c) => c === 'probe')) return 'probe';
  if (classes.includes('tender')) return HULL.tender;
  return 'other';
}

/** What a hull is for, which sets the colour of its glow on the map. */
export function lookRole(look: FleetLook): 'war' | 'settler' | 'other' {
  if (look === 'war' || look === 'aegis') return 'war';
  return look === 'settler' || look === 'lighter' || look === 'seedcore' || look === 'spore' || look === 'vaultship' ? 'settler' : 'other';
}
