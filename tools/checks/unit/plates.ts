// Every event with a painting of its own (`plate`) finds it in public/art/events/<plate>.webp, and
// its age's painting (`art`) is there too, behind it while it loads. A missing plate shows only the
// age's painting, so nothing else would notice it.
import { EVENTS } from '../../../src/game/data/events';
import { check, done } from '../lib';

declare const process: { getBuiltinModule(id: string): unknown };
const { existsSync } = process.getBuiltinModule('node:fs') as { existsSync(p: string): boolean };

const withPlate = EVENTS.filter((e) => e.plate);
const missing = withPlate.filter((e) => !existsSync(`public/art/events/${e.plate}.webp`)).map((e) => `${e.id} (${e.plate})`);
check(missing.length === 0, `every event's own plate is there (${missing.length ? `missing: ${missing.join(', ')}` : `${withPlate.length} events, ${new Set(withPlate.map((e) => e.plate)).size} plates`})`);
const noArt = EVENTS.filter((e) => !existsSync(`public/art/${e.art}.webp`)).map((e) => `${e.id} (${e.art})`);
check(noArt.length === 0, `every event's age painting is there (${noArt.length ? `missing: ${noArt.join(', ')}` : `${EVENTS.length} events`})`);
done('PLATES');
