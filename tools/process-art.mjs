// One grade for every generated plate: light era tint, lifted blacks, slight desaturation,
// film grain and a vignette, exported as webp at 1600 px wide.
//   node tools/process-art.mjs            (reads art-src/*.png, writes public/art/*.webp)
//   node tools/process-art.mjs finds      (reads art-src/anom/*.png, writes public/art/finds/*.webp)
//   node tools/process-art.mjs events     (reads art-src/events/*.png, writes public/art/events/*.webp)
import sharp from 'sharp';
import { mkdirSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

const SET = ['finds', 'events'].includes(process.argv[2]) ? process.argv[2] : 'plates';
const SRC = { finds: 'art-src/anom', events: 'art-src/events', plates: 'art-src' }[SET];
const OUT = { finds: 'public/art/finds', events: 'public/art/events', plates: 'public/art' }[SET];
const WIDTH = 1600;

// per-plate grade: channel gains and lifts (0..255)
const WARM = { gain: [1.04, 1.0, 0.94], lift: [7, 5, 5] };
const COLD = { gain: [0.95, 1.0, 1.05], lift: [4, 5, 8] };
const VIOLET = { gain: [1.0, 0.96, 1.05], lift: [6, 4, 8] };
const GREY = { gain: [0.99, 1.0, 1.01], lift: [5, 5, 6] };
const NEUTRAL = { gain: [1.02, 1.0, 0.97], lift: [6, 5, 5] };
const GRADE = {
  title: WARM,
  dusk: WARM,
  flare: WARM,
  degenerate: COLD,
  blackhole: VIOLET,
  slow: VIOLET,
  dark: GREY,
  ruins: NEUTRAL,
  hunger: NEUTRAL,
  sleepers: COLD,
  survivor: NEUTRAL,
  swarm: NEUTRAL,
  swarm_tamed: COLD,
  // the other peoples, by their way of life
  way_garden: WARM,
  way_upload: COLD,
  way_chorus: VIOLET,
  way_dormant: COLD,
  way_lattice: NEUTRAL,
  way_fork: NEUTRAL,
  // events with a painting of their own, by the age they come in
  dynamo_fails: WARM,
  first_night: WARM,
  last_rain: WARM,
  sea_freezes: WARM,
  mantle_settles: WARM,
  comet: WARM,
  who_sleeps_first: WARM,
  prophet_of_stillness: WARM,
  first_upload: WARM,
  new_star: COLD,
  white_fire: COLD,
  supernova: COLD,
  cast_out: COLD,
  unmoored: COLD,
  world_falls: COLD,
  final_burst: VIOLET,
  // survey discoveries
  vent_life: COLD,
  fossil_reactor: NEUTRAL,
  diamond_mantle: NEUTRAL,
  primordial_hole: VIOLET,
  interstellar_shard: WARM,
  fossils: WARM,
  flare_glass: WARM,
  clathrates: COLD,
  lens: VIOLET,
  sail_graveyard: NEUTRAL,
  resonance: COLD,
  magnetar_print: COLD,
  warm_rogue: GREY,
};

// regions to soften (fractions of the image): stray letter-like shapes the models add
const SOFTEN = {
  survivor: [{ x: 0.58, y: 0.0, w: 0.2, h: 0.24 }],
  warm_rogue: [{ x: 0.89, y: 0.86, w: 0.1, h: 0.13 }], // painted signatures
  fossil_reactor: [{ x: 0.92, y: 0.9, w: 0.075, h: 0.1 }],
  way_lattice: [{ x: 0.0, y: 0.95, w: 0.07, h: 0.05 }],
  prophet_of_stillness: [{ x: 0.3, y: 0.1, w: 0.1, h: 0.24 }, { x: 0.83, y: 0.1, w: 0.1, h: 0.24 }], // a banner emblem too like a known logo
};

function grain(w, h, amount) {
  const buf = Buffer.alloc(w * h);
  let s = 1234567;
  for (let i = 0; i < buf.length; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    const r = ((s >>> 8) & 0xffff) / 0xffff + (((s * 69069) >>> 8) & 0xffff) / 0xffff - 1; // triangular
    buf[i] = Math.max(0, Math.min(255, Math.round(128 + r * amount)));
  }
  return buf;
}

function vignette(w, h, strength) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
      <defs><radialGradient id="v" cx="50%" cy="48%" r="75%">
        <stop offset="55%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="${strength}"/>
      </radialGradient></defs>
      <rect width="100%" height="100%" fill="url(#v)"/>
    </svg>`,
  );
}

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(SRC).filter((x) => x.endsWith('.png'))) {
  const name = basename(f, '.png');
  const g = GRADE[name] ?? NEUTRAL;
  let img = sharp(join(SRC, f)).resize({ width: WIDTH });
  const meta = await img.clone().toBuffer({ resolveWithObject: true });
  const w = meta.info.width;
  const h = meta.info.height;
  let base = sharp(meta.data);
  const layers = [];
  for (const r of SOFTEN[name] ?? []) {
    const box = { left: Math.round(r.x * w), top: Math.round(r.y * h), width: Math.round(r.w * w), height: Math.round(r.h * h) };
    const blurred = await sharp(meta.data).extract(box).blur(18).toBuffer();
    layers.push({ input: blurred, left: box.left, top: box.top });
  }
  if (layers.length) base = sharp(await base.composite(layers).toBuffer());
  const graded = await base
    .linear(g.gain, g.lift)
    .modulate({ saturation: 0.9 })
    .composite([
      { input: grain(w, h, 22), raw: { width: w, height: h, channels: 1 }, blend: 'soft-light' },
      { input: vignette(w, h, name === 'dark' ? 0.75 : 0.55), blend: 'over' },
    ])
    .webp({ quality: 80 })
    .toFile(join(OUT, `${name}.webp`));
  console.log(`${name}.webp ${w}x${h} ${Math.round(graded.size / 1024)} KB`);
}
