// What a storage building adds to the reserve, as the build list says it (26 Oct, the player: "can
// you explain how much these actually increase my storage capacity?"): one line with the real
// figure, Deep Storage's quarter more counted, a Deep Storage Ring +250 before it and +312 after,
// a Burst Catcher +300 and +375; only the Burst Catcher catches bursts, and says so.
import { newGame } from '../../../src/game/newGame';
import { project, structureEffect } from '../../../src/game/sim/projection';
import { check, done } from '../lib';

const s = newGame({ seed: 1000, length: 'standard', survivors: 3, difficulty: 'standard' });
const c = s.colonies[s.civ.capitalId!];
const notes = (id: string) => structureEffect(s, c, id, project(s).ctx).notes;

s.civ.techs = s.civ.techs.filter((t) => t !== 'deep_storage');
let ring = notes('superconducting_ring');
let catcher = notes('burst_catcher');
console.log(`  without Deep Storage: ring ${JSON.stringify(ring)} · catcher ${catcher[0]}`);
check(ring.includes('Energy reserve +250') && catcher.includes('Energy reserve +300'), 'without Deep Storage: Ring +250, Burst Catcher +300');

s.civ.techs.push('deep_storage');
ring = notes('superconducting_ring');
catcher = notes('burst_catcher');
console.log(`  with Deep Storage: ring ${JSON.stringify(ring)} · catcher ${catcher[0]}`);
check(ring.includes('Energy reserve +312') && catcher.includes('Energy reserve +375'), 'with it, a quarter more: Ring +312, Burst Catcher +375');
check(ring.filter((n) => n.startsWith('Energy reserve')).length === 1, 'one reserve line each');
check(!ring.some((n) => /Catches/.test(n)), 'the Ring catches nothing, and does not say it does');
check(catcher.some((n) => /^Catches bursts: up to \+250 energy each/.test(n)), `the Burst Catcher says what it catches (${catcher.find((n) => n.startsWith('Catches'))?.slice(0, 60)}…)`);
check(!notes('reserve_vault').some((n) => /Catches final bursts/.test(n)) && notes('reserve_vault').includes('Energy reserve +100'), 'an Energy Vault: +100 with Deep Storage');
done('STORAGE NOTES');
