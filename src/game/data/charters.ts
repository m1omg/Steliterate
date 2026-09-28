import type { EraId, ThreadId } from '../types';

// The book of Charters: irreversible laws. Every Thread has an opinion.

export interface CharterDef {
  id: string;
  name: string;
  desc: string;
  effect: string; // plain statement of the mechanical effect
  era: EraId;
  tech?: string;
  requiresCharter?: string;
  excludes?: string[];
  cost: number; // accord
  stances: Partial<Record<ThreadId, number>>; // standing change on enactment
  resolve?: number;
  dissent?: number;
  taint?: number;
  dark?: boolean;
}

const C = (c: CharterDef) => c;

export const CHARTERS: CharterDef[] = [
  C({ id: 'cold_sleep_lottery', name: 'Cold Sleep Lottery', era: 'dusk', tech: 'cold_sleep', cost: 20, stances: { kin: -8, echoes: 2 }, resolve: -4, desc: 'When a settlement cannot feed everyone, a lottery decides who sleeps until better times.', effect: 'Starving settlements put Kin into Cold Sleep instead of losing them. Cryo upkeep −50%.' }),
  C({ id: 'upload_at_death', name: 'Upload at Death', era: 'dusk', tech: 'upload', cost: 25, stances: { kin: -10, echoes: 10 }, dissent: 3, excludes: ['sanctity_of_flesh'], desc: 'No one simply dies any more. Whoever is dying is copied.', effect: 'Half of the Kin who die become Echoes where there is substrate.' }),
  C({ id: 'sanctity_of_flesh', name: 'Sanctity of Flesh', era: 'dusk', cost: 20, stances: { kin: 12, echoes: -8, chorus: -6 }, excludes: ['upload_at_death'], desc: 'A body is not a vessel. What is born stays born.', effect: 'Kin standing and resolve steadier; uploads and merges cost Accord.' }),
  C({ id: 'abandon_the_surface', name: 'Abandon the Surface', era: 'dusk', tech: 'subterranean_cities', cost: 30, stances: { kin: -14 }, resolve: -8, desc: 'Stop pretending the sky will come back. Everyone goes down into the warrens.', effect: 'Dying worlds no longer cost Kin capacity; the homeworld demand is dropped. Industry +10%.' }),
  C({ id: 'right_to_stop', name: 'The Right to Stop', era: 'dusk', tech: 'mind_substrate', cost: 25, stances: { echoes: 14, kin: 3, chorus: -4 }, dissent: -5, desc: 'Any mind may choose to end. No one will be kept running against their will.', effect: 'In hardship some minds stop instead of suffering: fewer losses to strain and deficit count against resolve; dissent falls faster.' }),
  C({ id: 'merge_consent', name: 'Merge Consent', era: 'dusk', tech: 'mind_merging', cost: 20, stances: { chorus: 12, echoes: 6, kin: 4 }, desc: 'No one is merged who did not ask for it.', effect: 'Merging into the Chorus is half as fast and costs no standing.' }),
  C({ id: 'child_quotas', name: 'Child Quotas', era: 'dusk', cost: 20, stances: { kin: -10 }, resolve: -3, desc: 'Fewer mouths. Every birth is licensed.', effect: 'Kin growth −60%; Kin upkeep −12%.' }),
  C({ id: 'sanctuary', name: 'Sanctuary', era: 'dusk', cost: 25, stances: { kin: 6, echoes: 4, chorus: 4 }, resolve: 6, desc: 'Our doors are open to the other survivors, whatever they are.', effect: 'You can accept refugees from other minds; survivors trust you more.' }),
  C({ id: 'salvage_the_dead', name: 'Salvage the Dead', era: 'dusk', cost: 20, stances: { kin: -4, lattice: 0 }, resolve: -3, desc: 'The dead do not need their machines. Strip every ruin and every silent colony.', effect: 'Ruins and faded survivors yield double Matter; slightly drains the galaxy’s free energy.' }),
  C({ id: 'blackout', name: 'Blackout', era: 'dusk', tech: 'hunger_studies', cost: 20, stances: { kin: -5, coldminds: 6 }, resolve: -4, desc: 'Lights out. Heat sinks buried. Nothing to see here.', effect: 'The Hunger is drawn to you 70% less. All output −10%.' }),
  C({ id: 'rationing', name: 'Rationing', era: 'dusk', cost: 15, stances: { kin: -6, coldminds: 4 }, resolve: -2, desc: 'Everyone gets less, so everyone gets some.', effect: 'Energy upkeep −15%; resolve −1 per turn while in force.' }),
  C({ id: 'open_archives', name: 'Open Archives', era: 'dusk', tech: 'the_long_record', cost: 20, stances: { echoes: 6, kin: 3 }, desc: 'All knowledge free to all Threads.', effect: 'Insight +15%.' }),
  C({ id: 'overdrive_protocols', name: 'Overdrive Protocols', era: 'dusk', cost: 20, stances: { coldminds: -8, kin: 2 }, desc: 'Hearths may run past their ratings when needed.', effect: 'Settlements can overdrive their Hearth: +50% energy capture, with damage, faster decline and a drain on the galaxy’s free energy.' }),
  C({ id: 'thread_parity', name: 'Thread Parity', era: 'dusk', tech: 'assembly_of_threads', cost: 30, stances: { kin: -4, echoes: 6, chorus: 6, coldminds: 6 }, dissent: -6, desc: 'Every kind of mind counts the same.', effect: 'Thread standings drift toward the middle; forks become less likely.' }),
  C({ id: 'lattice_compact', name: 'Lattice Compact', era: 'dusk', tech: 'autonomous_replicators', cost: 20, stances: { kin: -4, echoes: -2 }, desc: 'The machines work for us, and we will not resent them for it.', effect: 'The other Threads no longer resent the Lattice; Lattice output +15%; tamed swarms relapse less.' }),
  C({ id: 'wardens_oath', name: 'Wardens’ Oath', era: 'dusk', tech: 'orbital_defense', cost: 15, stances: { kin: 3 }, desc: 'Someone will always stand watch.', effect: 'Warships −25% cost; settlement defence +50%.' }),
  C({ id: 'the_long_watch', name: 'The Long Watch', era: 'dusk', tech: 'hibernation_protocols', cost: 25, stances: { coldminds: 8, echoes: 4, kin: -4 }, desc: 'Sleep in shifts. There is always someone awake, and always someone rested.', effect: 'Dormant turns cost half as much; waking gives +30% output for two turns.' }),
  // dark path
  C({ id: 'consume_the_dead', name: 'Consume the Dead', era: 'dusk', tech: 'hunger_studies', cost: 10, stances: { kin: -10, echoes: -6, chorus: -6, coldminds: -6 }, taint: 15, dark: true, desc: 'Feed on what the dead left: their worlds, their machines, their bodies.', effect: 'Ruins, faded survivors and dissolving worlds give triple Matter. Drains free energy. Hunger Taint +15.' }),
  C({ id: 'strip_the_sleepers', name: 'Strip the Sleepers', era: 'degenerate', requiresCharter: 'consume_the_dead', cost: 10, stances: { kin: -8, echoes: -10, coldminds: -12 }, taint: 15, dark: true, desc: 'The sleepers will never know. Their vaults are warm, and warmth is food.', effect: 'Sleeper vaults can be devoured for a large energy windfall. Hunger Taint +15.' }),
  C({ id: 'absorb_the_weak', name: 'Absorb the Weak', era: 'degenerate', requiresCharter: 'consume_the_dead', cost: 10, stances: { kin: -8, echoes: -8, chorus: -4 }, taint: 20, dark: true, desc: 'The failing survivors are resources in a waiting state.', effect: 'You can devour weakened survivors whole. Hunger Taint +20.' }),
  C({ id: 'communion_charter', name: 'Communion', era: 'degenerate', tech: 'communion', requiresCharter: 'consume_the_dead', cost: 10, stances: { kin: -12, echoes: -10, chorus: -8, coldminds: -10 }, taint: 25, dark: true, desc: 'The swarms are not enemies. They are what we are becoming.', effect: 'Swarms merge into your Lattice instead of attacking you; your Taint grows with every swarm you hold.' }),
];

export const CHARTER_BY_ID: Record<string, CharterDef> = Object.fromEntries(CHARTERS.map((c) => [c.id, c]));
