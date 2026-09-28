import type { ThreadId } from '../types';

export interface ShipDef {
  id: string;
  name: string;
  desc: string;
  tech?: string;
  cost: number;
  matter: number;
  mass: number; // for launch energy
  attack: number;
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
  { id: 'warden', name: 'Warden', desc: 'A patched-together escort with lasers and kinetic launchers.', tech: 'orbital_defense', cost: 45, matter: 15, mass: 3, attack: 3, hp: 10 },
  { id: 'aegis', name: 'Aegis', desc: 'A heavy picket built around a salvaged reactor.', tech: 'aegis_lattices', cost: 110, matter: 40, mass: 8, attack: 8, hp: 30 },
  { id: 'tender', name: 'Swarm Tender', desc: 'Broadcasts the dead makers’ command language to calm a swarm.', tech: 'command_language', cost: 70, matter: 20, mass: 3, attack: 0, hp: 8, tames: true },
];

export const SHIP_BY_ID: Record<string, ShipDef> = Object.fromEntries(SHIPS.map((s) => [s.id, s]));
