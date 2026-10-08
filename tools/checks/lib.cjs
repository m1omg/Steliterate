// Shared helpers for the browser checks in tools/checks/browser, run against a served build
// (npm run build && npx vite preview --port 4173). Run one with
//   node tools/checks/browser/<name>.cjs [url=http://localhost:4173/] [outDir=playtest-shots/checks]
// or all of them with npm run check:browser (tools/checks/run.mjs). Each prints `ok` or `BAD` per
// check, fails on any console error, and ends with `TAG OK` or `TAG FAILED (n)`.
/* eslint-disable */
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}
const fs = require('fs');
const path = require('path');

const url = process.argv[2] || 'http://localhost:4173/';
const outRoot = process.argv[3] || 'playtest-shots/checks';
const IGNORE = /fonts\.g|ERR_CERT|net::ERR_|GPU stall|Automatic fallback to software WebGL/;
const LAUNCH = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };

let bad = 0;

/** One check: prints `ok` or `BAD` with what was checked, and counts failures. */
function check(ok, what) {
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} ${what}`);
  return ok;
}

/** Waits for the server to answer (up to a minute). */
async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no server at ${url}`);
}

/** A page with console errors collected (they fail the check), opened on the game. */
async function newPage(browser, errors, width = 1400, height = 900) {
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !IGNORE.test(m.text()) && errors.push(m.text()));
  await page.goto(url, { timeout: 90000 });
  await page.waitForTimeout(1500);
  return page;
}

/**
 * Starts a check: the browser, a page on the game (with a new game of `seed` if given), and the
 * folder its screenshots go to.
 */
async function start(name, { width = 1400, height = 900, seed } = {}) {
  await waitForServer();
  const out = path.join(outRoot, name);
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(LAUNCH);
  const errors = [];
  const page = await newPage(browser, errors, width, height);
  if (seed !== undefined) {
    await page.evaluate((sd) => window.__stel.newGame({ seed: sd }), seed);
    await page.waitForTimeout(1000);
  }
  return {
    browser,
    page,
    errors,
    out,
    shot: (file, opts = {}) => page.screenshot({ path: path.join(out, file), ...opts }),
    /** Another page in the same browser (say, at phone size), its errors counted too. */
    another: (w, h) => newPage(browser, errors, w, h),
  };
}

/** Ends a check: no console errors, the browser closed, `TAG OK` or `TAG FAILED (n)`. */
async function finish(tag, t) {
  check(t.errors.length === 0, t.errors.length ? `console errors: ${t.errors.slice(0, 3).join(' | ')}` : 'no console errors');
  await t.browser.close();
  console.log(bad ? `${tag} FAILED (${bad})` : `${tag} OK`);
  process.exitCode = bad ? 1 : 0;
}

/** Runs a check body, turning a thrown error into a failure. */
function run(body) {
  body().catch((e) => {
    console.log(`BAD threw: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
    process.exitCode = 1;
    process.exit(1);
  });
}

module.exports = { check, start, finish, run, url };
