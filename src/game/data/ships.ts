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
  /** It can break a settlement's defences: without one, a settlement behind a Defence Grid or a Bastion Shell cannot be stormed. */
  breaches?: boolean;
  /** A one-use strike at a settlement, flown at nearly the speed of light (the Kinetic Lance). */
  lance?: boolean;
  hp: number;
  survey?: boolean;
  settles?: { thread: ThreadId; pops: number; structure?: string };
  tames?: boolean;
  inSystem?: boolean; // cannot leave its star
  crew?: number; // Kin drawn from the settlement that builds it
  /** Woven of fields at a Leptonic Shipyard, by a leptonic settlement: the only ships it can build, and the only ones built once matter is gone. */
  leptonic?: boolean;
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
  { id: 'breacher', name: 'Breacher', desc: 'A siege hull: shaped charges, mining rigs and a heavy prow, to break a settlement’s defences. Without one, a settlement behind a Defence Grid or a Bastion Shell cannot be stormed.', tech: 'aegis_lattices', cost: 120, matter: 50, mass: 8, attack: 1, vs: { settlements: 10, ships: 2 }, hp: 20, upkeep: 0.6, breaches: true },
  { id: 'lance', name: 'Kinetic Lance', desc: 'A mass driven at nearly the speed of light: a strike at a settlement, once, stopped only by the screens of ships waiting there. Everyone hears of it, and it spends the galaxy’s free energy. One in flight at a time.', tech: 'relativistic_arks', cost: 200, matter: 120, mass: 20, attack: 0, hp: 1, upkeep: 0.2, lance: true },
  { id: 'aegis', name: 'Aegis', desc: 'A heavy picket built around a salvaged reactor, at its strongest dug in.', tech: 'aegis_lattices', cost: 110, matter: 40, mass: 8, attack: 8, hp: 30, upkeep: 0.8, screen: 0.3, dugIn: 3 },
  // (31 Oct, the player: "add a leptonic shipyard pls also i think there was a wraith/phantom ship for leptonic era already?": in the plan, not built until now)
  { id: 'wraith', name: 'Leptonic Wraith', desc: 'Speculative: a warship of electron–positron structure held in fields, woven at a Leptonic Shipyard. The only warship that can be made once matter is gone, and it outlasts matter.', tech: 'leptonic_computation', cost: 90, matter: 30, mass: 2, attack: 5, hp: 16, upkeep: 0.3, screen: 0.3, leptonic: true },
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
  const parts = [
    attackNote(d),
    `hull ${d.hp}`,
    d.upkeep ? `upkeep ${d.upkeep} energy a turn` : '',
    d.screen ? `turns ${Math.round(d.screen * 100)}% of raids away from its star` : '',
    d.eyes ? `sees ${d.eyes}× as far` : '',
    d.dugIn ? `${d.dugIn}× as strong fortified` : '',
    d.breaches ? 'breaks a settlement’s defences' : '',
  ].filter(Boolean);
  return `${parts.join('; ')}.`;
}

/**
 * What a ship can hit, in words: its attack against swarms and against other civilizations (their
 * ships in a battle, their settlements in a raid, a siege or a storming), or that it is unarmed. A
 * settler's guns only answer a swarm that comes for it (hunger.ts).
 */
export function attackNote(d: ShipDef): string {
  if (d.lance) return 'One strike at a settlement, in a war';
  if (!isWarship(d.id)) return d.attack > 0 ? `Unarmed, but hits back at ${d.attack} if a swarm comes for it` : 'Unarmed';
  const swarms = strength(d.id, 'swarms');
  const ships = strength(d.id, 'ships');
  const settlements = strength(d.id, 'settlements');
  if (ships !== settlements) return `Attack ${swarms} against swarms, ${ships} against other civilizations’ ships, ${settlements} against their settlements`;
  return swarms === ships ? `Attack ${swarms} against swarms and other civilizations` : `Attack ${swarms} against swarms, ${ships} against other civilizations`;
}

/** Whether a ship is a warship: it can fight something, and it carries no settlers. */
export function isWarship(cls: string): boolean {
  const d = SHIP_BY_ID[cls];
  return !!d && !d.settles && (d.attack > 0 || Object.values(d.vs ?? {}).some((v) => (v ?? 0) > 0));
}

/** A painted hull in public/art/ships/<look>.png (the Ark is 'settler', the Warden 'war'). */
export type FleetLook = 'settler' | 'probe' | 'war' | 'other' | 'lighter' | 'seedcore' | 'spore' | 'vaultship' | 'aegis' | 'tender' | 'picket' | 'breacher' | 'hunter' | 'lance' | 'wraith';

const HULL: Record<string, FleetLook> = {
  ark: 'settler',
  lighter: 'lighter',
  seedcore: 'seedcore',
  spore: 'spore',
  vaultship: 'vaultship',
  warden: 'war',
  aegis: 'aegis',
  tender: 'tender',
  picket: 'picket',
  breacher: 'breacher',
  hunter: 'hunter',
  lance: 'lance',
  wraith: 'wraith',
};

/** The warships' hulls, heaviest first: a fleet wears the first it carries. */
const WAR_HULLS = ['aegis', 'breacher', 'hunter', 'wraith', 'warden', 'picket'];

/** Which painted hull stands for a fleet on the map and in the lists: its heaviest warship, else its first settler, else its tender. */
export function fleetLook(classes: string[]): FleetLook {
  const war = WAR_HULLS.find((c) => classes.includes(c));
  if (war) return HULL[war];
  // (a Lance shows its own only with no other warship to escort it)
  if (classes.includes('lance')) return HULL.lance;
  const settler = classes.find((c) => SHIP_BY_ID[c]?.settles);
  if (settler) return HULL[settler] ?? 'settler';
  if (classes.length > 0 && classes.every((c) => c === 'probe')) return 'probe';
  if (classes.includes('tender')) return HULL.tender;
  return 'other';
}

/** What a hull is for, which sets the colour of its glow on the map. */
export function lookRole(look: FleetLook): 'war' | 'settler' | 'other' {
  if (look === 'war' || look === 'aegis' || look === 'picket' || look === 'breacher' || look === 'hunter' || look === 'lance' || look === 'wraith') return 'war';
  return look === 'settler' || look === 'lighter' || look === 'seedcore' || look === 'spore' || look === 'vaultship' ? 'settler' : 'other';
}
