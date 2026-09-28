import type { BodyKind, EraId, PrimaryKind, ThreadId } from '../types';

export type EnergyMode =
  | 'light' // share of the primary's light (stars, embers, merger stars, rekindled dwarfs)
  | 'geo' // planetary core heat
  | 'fusion' // matter -> energy
  | 'accretion' // matter -> energy at a black hole
  | 'spin' // rotational energy (neutron stars, Penrose process) from a finite reservoir
  | 'hawking' // Hawking radiation of a black hole
  | 'decay' // proton decay in degenerate matter
  | 'siphon' // horizon siphoning (speculative)
  | 'rekindle'; // debris stream of a feeding world

export interface StructureDef {
  id: string;
  name: string;
  desc: string;
  era: EraId; // first era it can be built
  tech?: string;
  cost: number; // industry
  matter: number; // upfront matter
  max: number; // per settlement
  systemUnique?: boolean;
  bodies?: BodyKind[]; // allowed body kinds (default: any)
  notBodies?: BodyKind[];
  primaries?: PrimaryKind[]; // allowed primary kinds
  habitable?: boolean; // only bodies with intrinsic habitability > 0.3
  energy?: { mode: EnergyMode; amount: number; input?: number };
  matterYield?: number; // x richness
  hydrogenYield?: number; // x hydrogen
  lift?: number; // matter from the primary itself
  industry?: number;
  insight?: number;
  accord?: number;
  resolve?: number;
  cap?: Partial<Record<ThreadId, number>>;
  cryoCap?: number;
  reserveCap?: number;
  burstCap?: number;
  defense?: number;
  upkeep?: number; // energy
  declineMult?: number;
  coreHeatBonus?: number;
  vitalityOnce?: number;
  signature: number; // how much it draws the Hunger (light and heat)
  decayProof?: boolean;
  continuityMult?: number;
  gfeDrain?: number; // unsustainable
  enables?: string; // conversion / action key
}

const S = (d: StructureDef) => d;

export const STRUCTURES: StructureDef[] = [
  // ---------------------------------------------------------------- Dusk: survival basics
  S({ id: 'solar_array', name: 'Solar Arrays', desc: 'Dark photovoltaic fields tuned to a red sun.', era: 'dusk', cost: 30, matter: 10, max: 3, notBodies: ['deep', 'gas_giant'], energy: { mode: 'light', amount: 4 }, signature: 1 }),
  S({ id: 'geothermal_tap', name: 'Geothermal Tap', desc: 'Bores into whatever warmth the core has left.', era: 'dusk', cost: 35, matter: 10, max: 2, notBodies: ['deep', 'gas_giant', 'asteroids'], energy: { mode: 'geo', amount: 7 }, signature: 0.5 }),
  S({ id: 'mine', name: 'Deep Mine', desc: 'Salvage and extraction, forever patched.', era: 'dusk', cost: 30, matter: 0, max: 3, notBodies: ['deep', 'gas_giant'], matterYield: 3, signature: 0.5 }),
  S({ id: 'habitat_dome', name: 'Habitat Domes', desc: 'Sealed domes and pressure halls. Warm, crowded, always humming.', era: 'dusk', cost: 40, matter: 15, max: 5, cap: { kin: 3 }, upkeep: 1, signature: 1 }),
  S({ id: 'archive_spire', name: 'Archive Spire', desc: 'Observatory, library and argument hall in one tower.', era: 'dusk', cost: 40, matter: 10, max: 2, insight: 3, signature: 0.5 }),
  S({ id: 'commons', name: 'The Commons', desc: 'Where people gather to decide how to go on.', era: 'dusk', cost: 35, matter: 5, max: 1, accord: 2, resolve: 0.3, signature: 0.5 }),
  S({ id: 'shipyard', name: 'Shipyard', desc: 'Slips, cranes and a long queue of repairs.', era: 'dusk', cost: 40, matter: 20, max: 1, industry: 1, signature: 1 }),
  S({ id: 'reserve_vault', name: 'Energy Vault', desc: 'Superconducting rings holding charge against lean years.', era: 'dusk', tech: 'energy_storage', cost: 40, matter: 20, max: 4, reserveCap: 80, signature: 0.3 }),
  S({ id: 'foundry', name: 'Orbital Foundry', desc: 'Furnaces in orbit, fed by the belts.', era: 'dusk', tech: 'orbital_industry', cost: 50, matter: 20, max: 2, industry: 3, signature: 1 }),
  S({ id: 'mag_shield', name: 'Magnetic Shield', desc: 'A superconducting loop at the inner Lagrange point, standing in for a dead dynamo.', era: 'dusk', tech: 'magnetospherics', cost: 80, matter: 30, max: 1, habitable: true, declineMult: 0.4, upkeep: 1, signature: 1 }),
  S({ id: 'warrens', name: 'Deep Warrens', desc: 'Cities dug below the frost line, lit by strip lamps.', era: 'dusk', tech: 'subterranean_cities', cost: 60, matter: 15, max: 3, notBodies: ['deep', 'gas_giant', 'asteroids'], cap: { kin: 4 }, upkeep: 0.5, signature: 0.3 }),
  S({ id: 'core_stimulator', name: 'Core Stimulator', desc: 'Deep-bored reactors keeping the mantle soft a little longer.', era: 'dusk', tech: 'deep_mantle', cost: 120, matter: 40, max: 1, habitable: true, coreHeatBonus: 0.3, declineMult: 0.7, upkeep: 1, signature: 1 }),
  S({ id: 'comet_shepherd', name: 'Volatile Shepherding', desc: 'Nudges icy bodies inward to replace what the wind has stripped.', era: 'dusk', tech: 'comet_shepherding', cost: 90, matter: 20, max: 1, habitable: true, vitalityOnce: 0.15, declineMult: 0.8, signature: 0.5 }),
  S({ id: 'cryo_hall', name: 'Cryo Hall', desc: 'Rows of cold berths. Every one of them a promise to wake someone later.', era: 'dusk', tech: 'cold_sleep', cost: 50, matter: 15, max: 2, cryoCap: 10, upkeep: 0.3, signature: 0.2 }),
  S({ id: 'orbital_collector', name: 'Orbital Collectors', desc: 'Salvaged mirror-sails in close orbit.', era: 'dusk', tech: 'orbital_collectors', cost: 70, matter: 30, max: 2, energy: { mode: 'light', amount: 10 }, signature: 2 }),
  S({ id: 'dyson_swarm', name: 'Dyson Swarm', desc: 'Thousands of patched collectors wrapped around the star. Bright work, visible for light-years.', era: 'dusk', tech: 'dyson_swarms', cost: 300, matter: 150, max: 1, systemUnique: true, bodies: ['deep'], energy: { mode: 'light', amount: 40 }, signature: 8 }),
  S({ id: 'fusion_plant', name: 'Fusion Plant', desc: 'Burns hydrogen hauled up from the giants.', era: 'dusk', tech: 'fusion', cost: 60, matter: 20, max: 2, energy: { mode: 'fusion', amount: 4, input: 2 }, signature: 2 }),
  S({ id: 'hydrogen_skimmer', name: 'Hydrogen Skimmer', desc: 'Scoops fuel from a gas giant’s upper air.', era: 'dusk', tech: 'fusion', cost: 50, matter: 10, max: 1, bodies: ['gas_giant', 'ice_giant'], hydrogenYield: 3, signature: 1 }),
  S({ id: 'substrate_core', name: 'Substrate Core', desc: 'Cold racks of thinking matter.', era: 'dusk', tech: 'mind_substrate', cost: 50, matter: 20, max: 6, cap: { echoes: 4 }, upkeep: 0.5, signature: 1 }),
  S({ id: 'upload_clinic', name: 'Upload Clinic', desc: 'Where Kin become Echoes. Some call it a door, some a grave.', era: 'dusk', tech: 'upload', cost: 60, matter: 15, max: 1, enables: 'upload', signature: 0.5 }),
  S({ id: 'confluence_node', name: 'Confluence Node', desc: 'A chamber where minds merge.', era: 'dusk', tech: 'mind_merging', cost: 70, matter: 20, max: 3, cap: { chorus: 3 }, enables: 'merge', upkeep: 0.5, signature: 1 }),
  S({ id: 'lattice_foundry', name: 'Lattice Foundry', desc: 'Replicator beds that build and repair without anyone asking.', era: 'dusk', tech: 'autonomous_replicators', cost: 80, matter: 30, max: 3, cap: { lattice: 6 }, enables: 'lattice', signature: 2 }),
  S({ id: 'defense_grid', name: 'Defense Grid', desc: 'Point-defence lasers and a web of kinetic mines.', era: 'dusk', tech: 'orbital_defense', cost: 50, matter: 20, max: 2, defense: 8, signature: 1 }),
  S({ id: 'stellar_lifter', name: 'Stellar Lifter', desc: 'Magnetic funnels that pull matter out of the star itself. Fast, and ruinous over time.', era: 'dusk', tech: 'stellar_lifting', cost: 150, matter: 40, max: 1, systemUnique: true, bodies: ['deep'], primaries: ['red_dwarf', 'blue_dwarf', 'white_dwarf', 'brown_dwarf', 'black_dwarf'], lift: 7, gfeDrain: 0.0015, signature: 4 }),
  S({ id: 'relic_dig', name: 'Relic Excavation', desc: 'Careful work in the ruins of someone older.', era: 'dusk', cost: 45, matter: 10, max: 1, insight: 4, signature: 0.3 }),
  S({ id: 'accretion_engine', name: 'Accretion Engine', desc: 'Feeds matter to a black hole and catches the light of its falling.', era: 'dusk', tech: 'accretion_engines', cost: 160, matter: 60, max: 2, bodies: ['deep'], primaries: ['black_hole', 'smbh'], energy: { mode: 'accretion', amount: 30, input: 2 }, signature: 6 }),
  S({ id: 'pulsar_brake', name: 'Pulsar Brake', desc: 'Drags on a neutron star’s magnetic field to bleed its spin.', era: 'dusk', tech: 'pulsar_braking', cost: 120, matter: 40, max: 1, bodies: ['deep'], primaries: ['neutron_star'], energy: { mode: 'spin', amount: 8 }, signature: 3 }),

  // ---------------------------------------------------------------- Degenerate Age
  S({ id: 'ember_collector', name: 'Ember Collectors', desc: 'Vast cold radiators around a white dwarf warmed by dark matter. Nearly useless while stars still shine; vital after the Last Light.', era: 'dusk', tech: 'ember_harvest', cost: 70, matter: 40, max: 3, bodies: ['deep'], primaries: ['white_dwarf', 'black_dwarf'], energy: { mode: 'light', amount: 12 }, signature: 2 }),
  S({ id: 'disk_skimmer', name: 'Disk Skimmer', desc: 'Harvests the debris stream of a world falling into its dead star.', era: 'degenerate', tech: 'accretion_modelling', cost: 80, matter: 30, max: 2, bodies: ['deep'], energy: { mode: 'rekindle', amount: 14 }, signature: 2 }),
  S({ id: 'brown_siphon', name: 'Hydrogen Siphon', desc: 'Drinks from a brown dwarf that never became a star.', era: 'degenerate', tech: 'brown_dwarf_mining', cost: 70, matter: 20, max: 1, bodies: ['deep'], primaries: ['brown_dwarf'], lift: 6, signature: 2 }),
  S({ id: 'cold_vault', name: 'Cold Vault', desc: 'A shielded vault near absolute zero, home to Coldminds.', era: 'degenerate', tech: 'cold_computation', cost: 60, matter: 25, max: 4, cap: { coldminds: 6 }, enables: 'cool', upkeep: 0.1, signature: 0.1 }),
  S({ id: 'garden_ark', name: 'Garden Ark', desc: 'A lit, warm, living garden in the dark, at a cost few can afford.', era: 'degenerate', tech: 'garden_arks', cost: 110, matter: 50, max: 3, cap: { kin: 4 }, upkeep: 3, signature: 3 }),
  S({ id: 'horizon_vault', name: 'Horizon Vault', desc: 'Stores energy as black-hole spin. Almost nothing leaks.', era: 'degenerate', tech: 'horizon_storage', cost: 110, matter: 60, max: 2, bodies: ['deep'], primaries: ['black_hole', 'smbh'], reserveCap: 400, signature: 1 }),
  S({ id: 'burst_catcher', name: 'Burst Catcher', desc: 'Buffers for flashes: brief stars, final bursts and flares too fast to use as they happen.', era: 'degenerate', tech: 'burst_capture', cost: 90, matter: 40, max: 2, burstCap: 300, signature: 1 }),
  S({ id: 'decay_harvester', name: 'Decay Harvester', desc: 'Collects the faint heat of protons decaying inside dead stars.', era: 'degenerate', tech: 'baryon_decay_harvest', cost: 80, matter: 30, max: 2, bodies: ['deep'], primaries: ['white_dwarf', 'black_dwarf', 'neutron_star', 'brown_dwarf'], energy: { mode: 'decay', amount: 4 }, signature: 1 }),
  S({ id: 'lepton_substrate', name: 'Leptonic Substrate', desc: 'Speculative: minds re-encoded in electron–positron structures that will outlast the protons.', era: 'degenerate', tech: 'leptonic_computation', cost: 110, matter: 70, max: 3, decayProof: true, cap: { echoes: 4, coldminds: 4, lattice: 2 }, signature: 1 }),
  S({ id: 'superconducting_ring', name: 'Deep Storage Ring', desc: 'Giant, patient batteries for the long nights between sources.', era: 'degenerate', tech: 'deep_storage', cost: 70, matter: 40, max: 3, reserveCap: 150, burstCap: 100, signature: 0.3 }),

  // ---------------------------------------------------------------- Black Hole Age
  S({ id: 'penrose_harvester', name: 'Penrose Harvester', desc: 'Throws mass into the ergosphere and catches it coming back heavier.', era: 'degenerate', tech: 'penrose_process', cost: 100, matter: 0, max: 3, bodies: ['deep'], primaries: ['black_hole', 'smbh'], energy: { mode: 'spin', amount: 20 }, signature: 2 }),
  S({ id: 'hawking_collector', name: 'Hawking Collector', desc: 'Listens to the faint heat of a black hole slowly boiling away.', era: 'degenerate', tech: 'hawking_capture', cost: 100, matter: 0, max: 3, bodies: ['deep'], primaries: ['black_hole', 'smbh'], energy: { mode: 'hawking', amount: 12 }, signature: 1 }),
  S({ id: 'bastion', name: 'Bastion Shell', desc: 'A shell of leptonic structure around a black hole.', era: 'blackhole', tech: 'bastion_architecture', cost: 90, matter: 0, max: 3, cap: { echoes: 3, coldminds: 4, lattice: 3 }, decayProof: true, signature: 1 }),

  // ---------------------------------------------------------------- Dark Era
  S({ id: 'horizon_siphon', name: 'Horizon Siphon', desc: 'Speculative: draws on the faint temperature of the cosmic horizon itself.', era: 'dark', tech: 'horizon_siphon', cost: 120, matter: 0, max: 4, energy: { mode: 'siphon', amount: 0.6 }, signature: 0 }),
  S({ id: 'preservation_array', name: 'Error-Correction Array', desc: 'Keeps the pattern of you from dissolving into noise.', era: 'dark', tech: 'error_correction', cost: 110, matter: 0, max: 2, continuityMult: 0.6, upkeep: 0.3, signature: 0 }),
];

export const STRUCTURE_BY_ID: Record<string, StructureDef> = Object.fromEntries(STRUCTURES.map((s) => [s.id, s]));
