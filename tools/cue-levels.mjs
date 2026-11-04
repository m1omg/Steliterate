// The films' sound, measured: renders each film's cue offline (the export page, film.html, as
// tools/film-render.mjs does) and prints its peak and its loudness (RMS, dBFS), so a new score can
// be held to the level of the old ones and kept from clipping.
//   node tools/cue-levels.mjs [film...] [--fate=stable] [--stems]   (default: every film)
// --stems: each instrument's own loudness too (rendered alone), to balance them.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { LAUNCH } = require('./checks/lib.cjs');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const args = process.argv.slice(2);
const fate = args.find((a) => a.startsWith('--fate='))?.slice(7) ?? '';
const stems = args.includes('--stems');
const named = args.filter((a) => !a.startsWith('--'));
const port = 5181;
// (Vite itself, not through npx: killing npx left its Vite running, holding the port, 3 Nov)
const server = spawn(process.execPath, [new URL('../node_modules/vite/bin/vite.js', import.meta.url).pathname, '--port', String(port), '--strictPort'], { stdio: 'ignore' });
process.on('exit', () => server.kill());

/** Peak and RMS (dBFS) of 16-bit PCM WAV bytes (base64), over every channel. */
function levels(b64) {
  const buf = Buffer.from(b64, 'base64');
  const ch = buf.readUInt16LE(22);
  const data = 44;
  const n = (buf.length - data) / 2;
  let peak = 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = buf.readInt16LE(data + i * 2) / 32768;
    peak = Math.max(peak, Math.abs(v));
    sum += v * v;
  }
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  return { peak: db(peak), rms: db(Math.sqrt(sum / n)), secs: n / ch / 48000 };
}

try {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/film.html`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const browser = await chromium.launch(LAUNCH);
  const page = await browser.newPage({ viewport: { width: 320, height: 180 } });
  await page.goto(`http://localhost:${port}/film.html?film=dusk&w=320&h=180`, { timeout: 120000 });
  await page.waitForFunction(() => !!window.__film, null, { timeout: 120000 });
  const films = named.length ? named : await page.evaluate(async () => Object.keys((await import('/src/film/films.ts')).FILMS));
  for (const id of films) {
    await page.goto(`http://localhost:${port}/film.html?film=${id}&w=320&h=180${fate ? `&fate=${fate}` : ''}`, { timeout: 120000 });
    await page.waitForFunction(() => !!window.__film, null, { timeout: 120000 });
    const wav = await page.evaluate(() => window.__film.cue());
    const l = levels(wav);
    console.log(`${id.padEnd(20)} peak ${l.peak.toFixed(1).padStart(6)} dBFS   rms ${l.rms.toFixed(1).padStart(6)} dBFS   ${l.secs.toFixed(1)} s`);
    if (stems) {
      const each = await page.evaluate(
        async ([id, fate]) => {
          const cue = await import('/src/film/cue.ts');
          const score = await import('/src/film/score.ts');
          const s = score.scoreOf(id, fate || undefined);
          const used = [...new Set(score.compose(s).map((e) => e.v))];
          const secs = (s.beats * 60) / s.bpm + 1.5;
          const out = [];
          for (const v of used) {
            const b = await cue.renderCue(id, secs, 24000, fate || undefined, [v]);
            let sum = 0;
            let peak = 0;
            for (let c = 0; c < b.numberOfChannels; c++)
              for (const x of b.getChannelData(c)) {
                sum += x * x;
                peak = Math.max(peak, Math.abs(x));
              }
            out.push([v, 20 * Math.log10(Math.sqrt(sum / (b.length * b.numberOfChannels)) || 1e-9), 20 * Math.log10(peak || 1e-9)]);
          }
          return out;
        },
        [id, fate],
      );
      console.log('   ' + each.sort((a, b) => b[1] - a[1]).map(([v, r, p]) => `${v} ${r.toFixed(1)}/${p.toFixed(1)}`).join('  '));
    }
  }
  await browser.close();
} finally {
  server.kill();
}
