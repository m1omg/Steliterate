// Cut the generated ship paintings out of their black backgrounds and fit them into square
// sprites for the galaxy map.
//   node tools/process-sprites.mjs
// Sources: art-src/ships/<name>.png (black background, bow pointing up)
// Output:  public/art/ships/<name>.png (256×256, transparent, bow up)
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = 'art-src/ships';
const OUT = 'public/art/ships';
const SIZE = 256;
const PAD = 0.06; // empty margin around the hull, as a share of the sprite

// ship name (FleetLook in src/game/data/ships.ts) -> source file
const SHIPS = {
  settler: 'ark.png', probe: 'probe.png', war: 'warden.png', other: 'hauler.png',
  lighter: 'lighter.png', seedcore: 'seedcore.png', spore: 'spore.png', vaultship: 'vaultship.png', aegis: 'aegis.png', tender: 'tender.png',
};

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

fs.mkdirSync(OUT, { recursive: true });
for (const [name, file] of Object.entries(SHIPS)) {
  const src = path.join(SRC, file);
  if (!fs.existsSync(src)) {
    console.log(`skip ${name}: no ${src}`);
    continue;
  }
  const { data, info } = await sharp(src).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  // the background is the dark region connected to the edges; dark parts inside the hull stay solid
  const DARK = 46;
  const bright = (i) => Math.max(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]);
  const outside = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (outside[i] || bright(i) >= DARK) continue;
    outside[i] = 1;
    const x = i % w;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (i >= w) stack.push(i - w);
    if (i < w * (h - 1)) stack.push(i + w);
  }
  const rgba = Buffer.alloc(w * h * 4);
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    // over the flat black background, brightness is coverage (the anti-aliased edge)
    const m = Math.max(r, g, b);
    const a = outside[i] ? smooth(10, DARK, m) : 1;
    // un-premultiply the anti-aliased edge so it does not carry a dark fringe
    const k = a > 0.02 ? Math.min(1 / a, 4) : 0;
    rgba[i * 4] = Math.min(255, r * k);
    rgba[i * 4 + 1] = Math.min(255, g * k);
    rgba[i * 4 + 2] = Math.min(255, b * k);
    rgba[i * 4 + 3] = Math.round(a * 255);
    if (a > 0.3) {
      const x = i % w, y = (i / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  // square crop around the hull, centred, with a margin
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const side = Math.ceil(Math.max(x1 - x0, y1 - y0) * (1 + 2 * PAD));
  const left = Math.round(cx - side / 2), top = Math.round(cy - side / 2);
  const ext = {
    left: Math.max(0, -left), top: Math.max(0, -top),
    right: Math.max(0, left + side - w), bottom: Math.max(0, top + side - h),
  };
  // pad first, in its own pass: in one pipeline sharp would crop before it pads
  const padded = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extend({ ...ext, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  await sharp(padded.data, { raw: { width: padded.info.width, height: padded.info.height, channels: 4 } })
    .extract({ left: left + ext.left, top: top + ext.top, width: side, height: side })
    .resize(SIZE, SIZE, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(OUT, `${name}.png`));
  console.log(`${name}: hull ${x1 - x0}×${y1 - y0} px -> ${OUT}/${name}.png`);
}
