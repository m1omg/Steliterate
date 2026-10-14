// Renders one of the films (src/film) to an MP4, every frame drawn at its exact time:
//   node tools/film-render.mjs <film> <out.mp4> [--size=1920x1080] [--fps=60] [--ffmpeg=<path>] [--jpeg] [--fate=decay|stable|curvature]
// It starts the Vite dev server for film.html (the export page, never built into the game),
// steps the film's time by 1/fps, screenshots each frame (the canvas and the words over it),
// renders the film's cue offline, and encodes with ffmpeg: H.264 and AAC. ffmpeg is not a
// dependency of the game: give its path (--ffmpeg, or FFMPEG), for instance imageio-ffmpeg's in
// a scratch venv. The fonts come from STEL_FONTS where Google is out of reach (as for the checks).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { routeFonts, LAUNCH } = require('./checks/lib.cjs');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const [film = 'dusk', out = `${film}.mp4`, ...rest] = process.argv.slice(2);
const opt = (k, d) => rest.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const [w, h] = opt('size', '1920x1080').split('x').map(Number);
const fps = Number(opt('fps', '60'));
// (JPEG frames are much quicker to capture at 1080p, and H.264 loses more than they do)
const jpeg = rest.includes('--jpeg');
const ext = jpeg ? 'jpg' : 'png';
const ffmpeg = opt('ffmpeg', process.env.FFMPEG ?? 'ffmpeg');
// (the films that differ by the fate of matter: which one)
const fate = opt('fate', '');
const port = 5179;

const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);
try {
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`http://localhost:${port}/film.html`)).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  const browser = await chromium.launch(LAUNCH);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await routeFonts(ctx);
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${port}/film.html?film=${film}&w=${w}&h=${h}${fate ? `&fate=${fate}` : ''}`, { timeout: 120000 });
  await page.waitForFunction(() => !!window.__film, null, { timeout: 120000 });
  await page.evaluate(() => window.__film.ready());
  const length = await page.evaluate(() => window.__film.length);
  const dir = mkdtempSync(join(tmpdir(), 'film-'));
  const n = Math.ceil(length * fps);
  for (let i = 0; i < n; i++) {
    await page.evaluate((t) => window.__film.frame(t), i / fps);
    writeFileSync(join(dir, `${String(i).padStart(5, '0')}.${ext}`), await page.screenshot(jpeg ? { type: 'jpeg', quality: 94 } : { type: 'png' }));
    if (i % fps === 0) process.stdout.write(`\r${film}: ${i} / ${n} frames`);
  }
  writeFileSync(join(dir, 'cue.wav'), Buffer.from(await page.evaluate(() => window.__film.cue()), 'base64'));
  await browser.close();
  console.log(`\r${film}: ${n} frames, encoding…`);
  const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(dir, `%05d.${ext}`), '-i', join(dir, 'cue.wav'), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-c:a', 'aac', '-b:a', '192k', '-shortest', out], { stdio: 'inherit' });
  rmSync(dir, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${r.status ?? r.error})`);
  console.log(`${out}: ${w}×${h}, ${length.toFixed(2)} s at ${fps} fps`);
} finally {
  stop();
}
process.exit(0);
