// Runs the checks in tools/checks and prints a summary.
//   node tools/checks/run.mjs unit|browser|all [url=http://localhost:4173/] [outDir=playtest-shots/checks] [names...]
// (an argument starting with http is the url, one with a slash the screenshot folder, any other a
// check to run, by name: node tools/checks/run.mjs unit clock evap)
// npm run check runs the unit checks; npm run check:browser the browser checks, against a served
// build (npm run build && npx vite preview --port 4173). Each check ends with `TAG OK` or
// `TAG FAILED (n)` and sets its exit code; a run with every check passing ends `ALL CHECKS PASSED`.
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const [mode = 'unit', ...rest] = process.argv.slice(2);
const url = rest.find((a) => /^https?:/.test(a)) ?? 'http://localhost:4173/';
const out = rest.find((a) => !/^https?:/.test(a) && a.includes('/')) ?? 'playtest-shots/checks';
const only = rest.filter((a) => !/^https?:/.test(a) && !a.includes('/'));
const pick = (dir, ext) =>
  readdirSync(join(here, dir))
    .filter((f) => f.endsWith(ext) && (!only.length || only.includes(f.slice(0, -ext.length))))
    .sort()
    .map((f) => ({ name: `${dir}/${f.slice(0, -ext.length)}`, file: join(here, dir, f) }));

const tsx = join(root, 'node_modules', '.bin', 'tsx');
const jobs = [];
if (mode === 'unit' || mode === 'all') for (const c of pick('unit', '.ts')) jobs.push({ ...c, cmd: tsx, argv: [c.file], lane: 'unit' });
if (mode === 'browser' || mode === 'all') for (const c of pick('browser', '.cjs')) jobs.push({ ...c, cmd: process.execPath, argv: [c.file, url, out], lane: 'browser' });
if (!jobs.length) {
  console.log(`No checks to run (mode ${mode}${only.length ? `, names ${only.join(' ')}` : ''}).`);
  process.exit(1);
}

function runOne(job) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(job.cmd, job.argv, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    child.stdout.on('data', (d) => (text += d));
    child.stderr.on('data', (d) => (text += d));
    child.on('close', (code) => resolve({ ...job, code, text, secs: (Date.now() - t0) / 1000 }));
  });
}

// unit checks run several at a time; browser checks one at a time (each drives a browser)
async function lane(list, width) {
  const results = [];
  let next = 0;
  async function worker() {
    while (next < list.length) {
      const job = list[next++];
      const r = await runOne(job);
      const last = r.text.trim().split('\n').filter((l) => /\b(OK|FAILED)\b/.test(l)).pop() ?? `exit ${r.code}`;
      console.log(`${r.code === 0 ? 'pass' : 'FAIL'}  ${r.name.padEnd(28)} ${r.secs.toFixed(0).padStart(4)} s  ${last}`);
      results.push(r);
    }
  }
  await Promise.all(Array.from({ length: Math.min(width, list.length) }, worker));
  return results;
}

const results = [
  ...(await lane(jobs.filter((j) => j.lane === 'unit'), Math.max(1, cpus().length - 1))),
  ...(await lane(jobs.filter((j) => j.lane === 'browser'), 1)),
];
const failed = results.filter((r) => r.code !== 0);
for (const r of failed) {
  console.log(`\n---- ${r.name} (exit ${r.code})`);
  const lines = r.text.trim().split('\n');
  console.log(lines.filter((l) => /^BAD|Error|error/.test(l)).slice(0, 12).join('\n') || lines.slice(-12).join('\n'));
}
console.log(failed.length ? `\n${failed.length} of ${results.length} checks FAILED` : `\nALL CHECKS PASSED (${results.length})`);
process.exitCode = failed.length ? 1 : 0;
