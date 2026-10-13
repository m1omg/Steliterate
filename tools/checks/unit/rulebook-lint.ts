// One rulebook (the new version, docs/plans/new-version.md, part 2a-0): what keeps every
// civilization's part of a turn its own, read from the source itself.
// - no raw walk over every settlement or fleet: colonies(state) and fleets(state) give the
//   civilization whose turn or view it is, allColonies and allFleets everyone's (util.ts), so
//   each walk says whose it means (migrate, in save.ts, walks a save's every one);
// - what is true of the universe is in the state's flags (the halo drawn, the end of matter, the
//   Long Flow), what is true of one civilization in its own (its first swarm, its people lost to
//   decay, the free energy its forecast last saw, the guide, the forecasts put away);
// - nothing pushes into a civilization's messages but deliver (civs.ts), so that one meant for
//   another waits in the outbox;
// - the pointer is set only by pointAt (civs.ts), never by assigning `state.civ`.
import { check, done } from '../lib';

declare const process: { getBuiltinModule(id: string): unknown };
const fs = process.getBuiltinModule('node:fs') as { readdirSync(p: URL, o: { recursive: true }): string[]; readFileSync(p: URL, e: 'utf8'): string };

const root = new URL('../../../src/', import.meta.url);
const files = fs.readdirSync(root, { recursive: true }).filter((f) => /\.(ts|tsx)$/.test(f));

interface Rule {
  what: string;
  re: RegExp;
  /** files where it is the rule's own business */
  allowed: string[];
}
const RULES: Rule[] = [
  { what: 'every walk over settlements and fleets says whose it means (colonies, fleets; allColonies, allFleets)', re: /Object\.(values|keys|entries)\(\s*[\w.]+\.(colonies|fleets)\s*\)/, allowed: ['game/sim/util.ts', 'game/save.ts'] },
  { what: 'the universe’s facts are in the state’s flags', re: /\bciv\.flags(\.|\[')(halo_drawn|matter_gone|flowed)\b/, allowed: [] },
  { what: 'a civilization’s own facts are in its flags', re: /(?<!civ)\.flags(\.(first_swarm|decay_lost|gfe_prev|tut)\b|\[`fcd:)/, allowed: ['game/save.ts'] },
  { what: 'only deliver puts a message in a civilization’s list', re: /\.signals\.push\(/, allowed: ['game/civs.ts'] },
  { what: 'only pointAt sets the pointer', re: /\.civ\s*=[^=]/, allowed: [] },
];

for (const r of RULES) {
  const hits: string[] = [];
  for (const f of files) {
    const name = f.replace(/\\/g, '/');
    if (r.allowed.includes(name)) continue;
    fs.readFileSync(new URL(f, root), 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (r.re.test(line) && !/^\s*(\/\/|\*)/.test(line)) hits.push(`${name}:${i + 1}`);
      });
  }
  check(hits.length === 0, `${r.what}${hits.length ? `; not at ${hits.slice(0, 6).join(', ')}${hits.length > 6 ? ` and ${hits.length - 6} more` : ''}` : ''}`);
}
check(files.length > 80, `(${files.length} source files read)`);

done('RULEBOOK LINT');
