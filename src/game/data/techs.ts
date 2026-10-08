import type { EraId, ThreadId } from '../types';

export type Field = 'stewardship' | 'mind' | 'reach' | 'harvest' | 'continuity';

export const FIELDS: { id: Field; name: string; blurb: string }[] = [
  { id: 'stewardship', name: 'Stewardship', blurb: 'Keeping worlds and bodies alive a little longer.' },
  { id: 'mind', name: 'Mind', blurb: 'What else a person can become, and how slowly they can think.' },
  { id: 'reach', name: 'Reach', blurb: 'Ships, travel and defence across the dark.' },
  { id: 'harvest', name: 'Harvest', blurb: 'Taking energy and matter from what is left.' },
  { id: 'continuity', name: 'Continuity', blurb: 'Holding together: society, memory, the other minds, the end.' },
];

export interface TechEffects {
  echoMaxClock?: number; // raises the slowest clock Echoes can reach (log10 years)
  speed?: number; // ship speed as a fraction of c
  paceMax?: number; // how far the civilization can quicken
  paceMin?: number; // how far it can slow
  reserveMult?: number;
  insightMult?: number;
  industryMult?: number;
  upkeep?: Partial<Record<ThreadId, number>>; // multipliers
  detect?: number; // detection radius (ly)
  crossing?: number; // crossing losses multiplier
  flags?: string[];
}

export interface TechDef {
  id: string;
  name: string;
  era: EraId;
  field: Field;
  cost: number;
  requires: string[];
  desc: string;
  effects?: TechEffects;
  speculative?: boolean;
  taint?: number; // Hunger-derived knowledge
  noAuto?: boolean; // a deliberate choice with consequences: never worked out from surplus insight
  needsStable?: boolean; // only if protons are stable
  needsDecay?: boolean; // only if protons decay
  needsCurvature?: boolean; // only if curvature radiation is unmaking matter
}

const T = (t: TechDef) => t;

export const TECHS: TechDef[] = [
  // ============================================================ I. Dusk
  // stewardship
  T({ id: 'magnetospherics', name: 'Magnetospheric Engineering', era: 'dusk', field: 'stewardship', cost: 40, requires: [], desc: 'A superconducting loop at the inner Lagrange point can stand in for the dying dynamo. Unlocks the Magnetic Shield.' }),
  T({ id: 'subterranean_cities', name: 'Deep Warrens', era: 'dusk', field: 'stewardship', cost: 60, requires: [], desc: 'Live below the frost line, where vitality matters less. Unlocks Deep Warrens.' }),
  T({ id: 'hardy_lineages', name: 'Hardy Lineages', era: 'dusk', field: 'stewardship', cost: 70, requires: [], desc: 'Kin bred for thin air and cold. Kin capacity suffers less as worlds die; Kin upkeep −10%.', effects: { upkeep: { kin: 0.9 }, flags: ['hardy'] } }),
  T({ id: 'comet_shepherding', name: 'Volatile Shepherding', era: 'dusk', field: 'stewardship', cost: 95, requires: ['magnetospherics'], desc: 'Replace stripped air and water with shepherded ice. Unlocks Volatile Shepherding.' }),
  T({ id: 'terraforming', name: 'Terraforming', era: 'dusk', field: 'stewardship', cost: 130, requires: ['comet_shepherding'], desc: 'Mirrors, an air and seeded life for a dead world by a red dwarf that still burns, as was once proposed for Mars. Unlocks Orbital Mirrors, Atmosphere Works and Biosphere Seeding.' }),
  T({ id: 'deep_mantle', name: 'Mantle Stimulation', era: 'dusk', field: 'stewardship', cost: 140, requires: ['subterranean_cities'], desc: 'Reactors bored into the mantle keep the core soft. Unlocks the Core Stimulator.' }),
  T({ id: 'cold_sleep', name: 'Cold Sleep', era: 'dusk', field: 'stewardship', cost: 110, requires: ['hardy_lineages'], desc: 'Kin can sleep through the lean centuries. Unlocks Cryo Halls.' }),
  // mind
  T({ id: 'mind_substrate', name: 'Mind Substrate', era: 'dusk', field: 'mind', cost: 80, requires: [], desc: 'Minds that run on matter other than flesh. Unlocks Echoes, Substrate Cores and Seedcores.', effects: { echoMaxClock: 3.5 } }),
  T({ id: 'upload', name: 'Continuity of Self', era: 'dusk', field: 'mind', cost: 120, requires: ['mind_substrate'], desc: 'A Kin can become an Echo and still, they say, be themselves. Unlocks the Upload Clinic.' }),
  T({ id: 'slow_instancing', name: 'Slow Instancing', era: 'dusk', field: 'mind', cost: 170, requires: ['mind_substrate'], desc: 'Echoes can run a thought across millennia. Echo clock limit rises to 10⁷ years.', effects: { echoMaxClock: 7 } }),
  T({ id: 'mind_merging', name: 'Confluence', era: 'dusk', field: 'mind', cost: 210, requires: ['upload'], desc: 'Many minds, one voice. Unlocks the Chorus and Confluence Nodes.' }),
  T({ id: 'reversible_logic', name: 'Reversible Logic', era: 'dusk', field: 'mind', cost: 320, requires: ['slow_instancing'], desc: 'Thinking without erasing, so almost without heat. Echo clock limit 10¹¹ years; Echo upkeep −15%.', effects: { echoMaxClock: 11, upkeep: { echoes: 0.85, chorus: 0.9 } } }),
  T({ id: 'autonomous_replicators', name: 'Autonomous Replicators', era: 'dusk', field: 'mind', cost: 150, requires: [], desc: 'Self-repairing machines that learn their own maintenance. Unlocks the Lattice and Lattice Spores.' }),
  // reach
  T({ id: 'survey_optics', name: 'Deep Survey Optics', era: 'dusk', field: 'reach', cost: 30, requires: [], desc: 'Chart farther and see the dead more clearly. Detection range grows.', effects: { detect: 150 } }),
  T({ id: 'fusion_drives', name: 'Fusion Drives', era: 'dusk', field: 'reach', cost: 60, requires: ['survey_optics'], desc: 'Ships at six percent of light. Unlocks the Kin Ark.', effects: { speed: 0.06 } }),
  T({ id: 'orbital_defense', name: 'Orbital Defence', era: 'dusk', field: 'reach', cost: 70, requires: [], desc: 'Defence Grids and Warden escorts.' }),
  T({ id: 'orbital_industry', name: 'Orbital Industry', era: 'dusk', field: 'reach', cost: 55, requires: [], desc: 'Foundries in orbit. Unlocks the Orbital Foundry.' }),
  T({ id: 'magnetic_sails', name: 'Magsail Braking', era: 'dusk', field: 'reach', cost: 130, requires: ['fusion_drives'], desc: 'Brake against the thin interstellar medium. Ships at 15% of light; launches cost less.', effects: { speed: 0.15, flags: ['cheap_launch'] } }),
  T({ id: 'catalyzed_drives', name: 'Catalysed Drives', era: 'dusk', field: 'reach', cost: 280, requires: ['magnetic_sails'], desc: 'Ships at 40% of light. Other provinces come within reach.', effects: { speed: 0.4, detect: 2000 } }),
  T({ id: 'hunger_studies', name: 'Hunger Studies', era: 'dusk', field: 'reach', cost: 90, requires: ['orbital_defense'], desc: 'Learn what the swarms are and how they move. Reveals swarms within detection range and forecasts their paths.' }),
  T({ id: 'hunger_lures', name: 'Decoy Beacons', era: 'dusk', field: 'reach', cost: 160, requires: ['hunger_studies'], desc: 'Bright false hearths in dead systems draw the Hunger away. Fleets can light beacons; each burns while we feed it.' }),
  // harvest
  T({ id: 'energy_storage', name: 'Superconducting Storage', era: 'dusk', field: 'harvest', cost: 40, requires: [], desc: 'Hold energy against lean years. Unlocks Energy Vaults.' }),
  T({ id: 'orbital_collectors', name: 'Orbital Collectors', era: 'dusk', field: 'harvest', cost: 55, requires: [], desc: 'Mirror-sails in close orbit. Unlocks Orbital Collectors.' }),
  T({ id: 'fusion', name: 'Controlled Fusion', era: 'dusk', field: 'harvest', cost: 80, requires: [], desc: 'Burn hydrogen from the giants. Unlocks Fusion Plants and Hydrogen Skimmers.' }),
  T({ id: 'dyson_swarms', name: 'Dyson Swarms', era: 'dusk', field: 'harvest', cost: 230, requires: ['orbital_collectors'], desc: 'Wrap a star in collectors. Enormous yield, and visible across the reach, including to the Hunger.' }),
  T({ id: 'stellar_lifting', name: 'Stellar Lifting', era: 'dusk', field: 'harvest', cost: 280, requires: ['dyson_swarms'], desc: 'Pull matter out of stars. Quick wealth that permanently drains the galaxy’s free energy.' }),
  T({ id: 'horizon_physics', name: 'Horizon Physics', era: 'dusk', field: 'harvest', cost: 240, requires: ['fusion'], desc: 'What falls into a black hole, and what comes back out. Prerequisite for accretion engines.' }),
  T({ id: 'accretion_engines', name: 'Accretion Engines', era: 'dusk', field: 'harvest', cost: 360, requires: ['horizon_physics'], desc: 'Black-hole mining: feed matter in, catch up to forty percent of its mass-energy on the way down.' }),
  T({ id: 'pulsar_braking', name: 'Pulsar Braking', era: 'dusk', field: 'harvest', cost: 200, requires: ['horizon_physics'], desc: 'Bleed rotational energy from neutron stars. Unlocks the Pulsar Brake.' }),
  // continuity
  T({ id: 'the_long_record', name: 'The Long Record', era: 'dusk', field: 'continuity', cost: 50, requires: [], desc: 'Keep an honest account of what happened and why. +1 Accord per settlement; unlocks the first Charters.', effects: { flags: ['charters'] } }),
  T({ id: 'assembly_of_threads', name: 'Assembly of Threads', era: 'dusk', field: 'continuity', cost: 150, requires: ['the_long_record'], desc: 'Every Thread gets a voice. Thread standing recovers faster; more Charters.' }),
  T({ id: 'deep_listening', name: 'Deep Listening', era: 'dusk', field: 'continuity', cost: 120, requires: ['survey_optics'], desc: 'Listen for other minds across light-years and ages. Opens the Signals panel to faint and slow messages.' }),
  T({ id: 'hibernation_protocols', name: 'Hibernation Protocols', era: 'dusk', field: 'continuity', cost: 180, requires: ['cold_sleep'], desc: 'Sleep through lean ages safely. Unlocks the Long Sleep and slower paces.', effects: { paceMin: -2 } }),
  T({ id: 'proton_question', name: 'The Proton Question', era: 'dusk', field: 'continuity', cost: 200, requires: ['the_long_record'], desc: 'Build the detector that settles it: will ordinary matter last?', effects: { flags: ['proton_known'] } }),
  T({ id: 'halo_dynamics', name: 'Halo Dynamics', era: 'dusk', field: 'continuity', cost: 220, requires: ['deep_listening'], desc: 'Map the invisible mass that holds the Coalescence together. Something in it is moving against the flow.' }),
  T({ id: 'last_light_protocols', name: 'Last Light Protocols', era: 'dusk', field: 'continuity', cost: 340, requires: ['assembly_of_threads'], desc: 'Plan for the end of starlight: losses in the Last Light are halved.', effects: { crossing: 0.5 } }),

  // ============================================================ II. Degenerate
  T({ id: 'ember_harvest', name: 'Ember Harvest', era: 'dusk', field: 'harvest', cost: 240, requires: ['orbital_collectors'], desc: 'Cold radiators around white dwarfs warmed by annihilating dark matter. Unlocks Ember Collectors.' }),
  T({ id: 'brown_dwarf_mining', name: 'Brown Dwarf Mining', era: 'degenerate', field: 'harvest', cost: 280, requires: [], desc: 'The failed stars are full of hydrogen. Unlocks Hydrogen Siphons.' }),
  T({ id: 'accretion_modelling', name: 'Accretion Modelling', era: 'degenerate', field: 'harvest', cost: 320, requires: [], desc: 'Predict how falling worlds feed their dead stars, and harvest the stream. Unlocks Disk Skimmers; sharpens feeding forecasts.' }),
  T({ id: 'deep_storage', name: 'Deep Storage', era: 'degenerate', field: 'harvest', cost: 360, requires: [], desc: 'Batteries for ages. Unlocks Deep Storage Rings; reserve capacity +25%.', effects: { reserveMult: 1.25 } }),
  T({ id: 'burst_capture', name: 'Burst Capture', era: 'degenerate', field: 'harvest', cost: 420, requires: ['deep_storage'], desc: 'Catch flashes too brief to use as they happen. Unlocks Burst Catchers.' }),
  T({ id: 'horizon_storage', name: 'Horizon Storage', era: 'degenerate', field: 'harvest', cost: 650, requires: ['deep_storage'], desc: 'Bank energy as black-hole spin. Unlocks Horizon Vaults.' }),
  T({ id: 'baryon_decay_harvest', name: 'Decay Harvest', era: 'degenerate', field: 'harvest', cost: 820, requires: [], needsDecay: true, desc: 'The protons are going. Catch the heat as they do. Unlocks Decay Harvesters.' }),
  T({ id: 'curvature_harvest', name: 'Curvature Harvest', era: 'degenerate', field: 'harvest', cost: 820, requires: [], needsCurvature: true, desc: 'Space itself, curved tight around a neutron star, is turning its mass into particles. Catch them. Unlocks Curvature Collectors.' }),
  T({ id: 'cold_computation', name: 'Cold Computation', era: 'degenerate', field: 'mind', cost: 330, requires: [], desc: 'Minds that run near absolute zero. Unlocks Coldminds, Cold Vaults and Vault Ships. Echo clock limit 10¹⁶ years.', effects: { echoMaxClock: 16 } }),
  T({ id: 'glacial_cognition', name: 'Glacial Cognition', era: 'degenerate', field: 'mind', cost: 480, requires: ['cold_computation'], desc: 'Echo clock limit 10²⁴ years.', effects: { echoMaxClock: 24 } }),
  T({ id: 'deep_time_protocols', name: 'Deep-Time Protocols', era: 'degenerate', field: 'mind', cost: 600, requires: ['glacial_cognition'], desc: 'Echo clock limit 10³² years.', effects: { echoMaxClock: 32 } }),
  T({ id: 'abyssal_thought', name: 'Abyssal Thought', era: 'degenerate', field: 'mind', cost: 920, requires: ['deep_time_protocols'], desc: 'Echo clock limit 10⁴⁰ years.', effects: { echoMaxClock: 40 } }),
  T({ id: 'quickening', name: 'Quickening', era: 'degenerate', field: 'mind', cost: 400, requires: [], desc: 'Run fast and hot while a bright source lasts. You can quicken further, and Quick ×10 works while you keep time with a new star: each of its turns splits into ten.', effects: { paceMax: 2 } }),
  T({ id: 'leptonic_computation', name: 'Leptonic Computation', era: 'degenerate', field: 'mind', cost: 900, requires: ['deep_time_protocols'], speculative: true, desc: 'Speculative: re-encode minds in electrons and positrons, which do not decay. Unlocks Leptonic Substrate.' }),
  T({ id: 'garden_arks', name: 'Garden Arks', era: 'degenerate', field: 'stewardship', cost: 420, requires: [], desc: 'A living garden in the dark, lit by whatever you can spare. Kin can live on without stars.' }),
  T({ id: 'relativistic_arks', name: 'Relativistic Arks', era: 'degenerate', field: 'reach', cost: 380, requires: [], desc: 'Ships at 80% of light; long launches cost less.', effects: { speed: 0.8, flags: ['cheap_launch'] } }),
  T({ id: 'aegis_lattices', name: 'Aegis Lattices', era: 'degenerate', field: 'reach', cost: 360, requires: [], desc: 'Heavy pickets for heavy swarms. Unlocks the Aegis.' }),
  T({ id: 'command_language', name: 'Command Language', era: 'degenerate', field: 'reach', cost: 520, requires: [], desc: 'Decode the dead makers’ instructions to the swarms. Swarm Tenders can calm and tame them.' }),
  T({ id: 'hunger_engines', name: 'Hunger Engines', era: 'degenerate', field: 'harvest', cost: 460, requires: ['command_language'], taint: 12, desc: 'Borrow the swarms’ way of eating. Matter yields +40%. The Hunger’s logic stays with you.', effects: { flags: ['hunger_engines'] } }),
  T({ id: 'communion', name: 'Communion', era: 'degenerate', field: 'mind', cost: 600, requires: ['hunger_engines'], taint: 18, desc: 'Do not tame the swarms: join them. Unlocks the Communion charter.' }),
  T({ id: 'gravitic_semaphore', name: 'Gravitic Semaphore', era: 'degenerate', field: 'continuity', cost: 380, requires: [], desc: 'Speak with mass itself: move worlds a little, read the replies in orbits. Contact with what hides in the halo becomes possible.' }),
  T({ id: 'halo_siphons', name: 'Halo Siphons', era: 'degenerate', field: 'harvest', cost: 560, requires: ['ember_harvest'], desc: 'Drive dark matter into the embers faster. Ember yields double, and the halo empties sooner.', effects: { flags: ['halo_siphons'] } , noAuto: true }),
  T({ id: 'great_decay_protocols', name: 'Great Decay Protocols', era: 'degenerate', field: 'continuity', cost: 700, requires: [], desc: 'Prepare for the end of matter. Losses in the Great Decay (or, if space itself unmakes matter, the Great Evaporation) are halved.', effects: { crossing: 0.5 } }),

  // ============================================================ III. Black Hole
  T({ id: 'penrose_process', name: 'Penrose Process', era: 'degenerate', field: 'harvest', cost: 700, requires: ['accretion_engines'], desc: 'Extract a black hole’s spin. Unlocks Penrose Harvesters.' }),
  T({ id: 'hawking_capture', name: 'Hawking Capture', era: 'degenerate', field: 'harvest', cost: 750, requires: ['penrose_process'], desc: 'Collect the heat of evaporating holes. Unlocks Hawking Collectors.' }),
  T({ id: 'bastion_architecture', name: 'Bastion Architecture', era: 'blackhole', field: 'stewardship', cost: 550, requires: [], desc: 'Shells of leptonic structure around black holes. Unlocks Bastion Shells.' }),
  T({ id: 'horizon_cognition', name: 'Horizon Cognition', era: 'blackhole', field: 'mind', cost: 800, requires: [], desc: 'Echo clock limit 10⁶⁰ years.', effects: { echoMaxClock: 60 } }),
  T({ id: 'hawking_patience', name: 'Hawking-Scale Patience', era: 'blackhole', field: 'mind', cost: 1000, requires: ['horizon_cognition'], desc: 'Echo clock limit 10⁸⁰ years.', effects: { echoMaxClock: 80 } }),
  T({ id: 'ultimate_slowness', name: 'Ultimate Slowness', era: 'blackhole', field: 'mind', cost: 1250, requires: ['hawking_patience'], desc: 'Echo clock limit 10¹⁰⁰ years.', effects: { echoMaxClock: 100 } }),
  T({ id: 'total_confluence', name: 'Total Confluence', era: 'blackhole', field: 'mind', cost: 950, requires: [], desc: 'What it would take for everyone to become one. Enables the Great Work Confluence.' }),
  T({ id: 'archive_theory', name: 'Archive Theory', era: 'blackhole', field: 'continuity', cost: 950, requires: [], desc: 'A record that maintains itself with no one to read it. Enables the Great Work Archive of Everything.' }),
  T({ id: 'conformal_mathematics', name: 'Conformal Mathematics', era: 'blackhole', field: 'continuity', cost: 1200, requires: [], speculative: true, desc: 'Speculative, after Penrose: if the end of one universe is the beginning of the next, something could be written across the seam. Enables the Aeon Seed.' }),
  T({ id: 'error_correction', name: 'Deep Error Correction', era: 'blackhole', field: 'continuity', cost: 800, requires: [], desc: 'Keep a pattern intact across unimaginable time. Unlocks Error-Correction Arrays.' }),
  T({ id: 'last_horizon_protocols', name: 'Last Horizon Protocols', era: 'blackhole', field: 'continuity', cost: 900, requires: [], desc: 'Losses when the last black holes die are halved.', effects: { crossing: 0.5 } }),

  // ============================================================ IV. Dark
  T({ id: 'asymptotic_mind', name: 'Asymptotic Mind', era: 'dark', field: 'mind', cost: 900, requires: [], desc: 'A mind whose thoughts can stretch without limit. Enables the Hibernal Cascade.', effects: { echoMaxClock: Infinity } }),
  T({ id: 'horizon_siphon', name: 'Horizon Siphoning', era: 'dark', field: 'harvest', cost: 800, requires: [], speculative: true, desc: 'Speculative: draw the faintest trickle from the cosmic horizon’s temperature. Unlocks Horizon Siphons.' }),
  T({ id: 'garden_of_embers', name: 'Garden of Embers', era: 'dark', field: 'stewardship', cost: 900, requires: [], needsStable: true, desc: 'The protons held. Something could still grow. Enables the Great Work Garden of Embers.' }),
];

export const TECH_BY_ID: Record<string, TechDef> = Object.fromEntries(TECHS.map((t) => [t.id, t]));

export const ERA_COST_SCALE: Record<EraId, number> = { dusk: 1, degenerate: 1, blackhole: 1, dark: 1 };
