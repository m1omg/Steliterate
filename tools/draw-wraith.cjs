// Draws the Leptonic Wraith's hull (public/art/ships/wraith.png, 256 × 256, bow up), in code as the
// new version's plan has it ("drawn in code as a field"): not a hull of matter but a ship of fields,
// in the same language as a leptonic settlement on the map (src/render/fields.ts): glowing filaments
// along the lines of a dipole field, its axis along the ship, a standing wave round its waist, a
// bright core, and sparse motes trapped in its belts. Violet-white, as the Black Hole Age's light.
// Seeded, so it draws the same each time: node tools/draw-wraith.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage();
  const url = await page.evaluate(() => {
    const W = 256;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = W;
    const g = c.getContext('2d');
    let seed = 7919;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const cx = W / 2;
    const cy = W / 2 + 4;
    g.globalCompositeOperation = 'lighter';
    // a dipole's field line, r = L sin²θ, the dipole across the ship, so its lobes run fore and aft:
    // seen from above at `phase` round its axis; faint where the lines crowd into the core
    const line = (L, w, phase) => {
      const pts = [];
      for (let i = 0; i <= 140; i++) {
        const th = (i / 140) * Math.PI;
        const r = L * Math.sin(th) ** 2;
        pts.push([cx + r * Math.cos(th) * w, cy - r * Math.sin(th) * Math.cos(phase), Math.sin(th) ** 2]);
      }
      return pts;
    };
    const stroke = (pts, color, width, alpha) => {
      g.strokeStyle = color;
      g.lineWidth = width;
      for (let i = 1; i < pts.length; i++) {
        g.globalAlpha = alpha * Math.min(1, pts[i][2] * 1.6);
        g.beginPath();
        g.moveTo(pts[i - 1][0], pts[i - 1][1]);
        g.lineTo(pts[i][0], pts[i][1]);
        g.stroke();
      }
    };
    // filaments: nested shells, fore and aft, each a soft glow and a fine bright thread
    const shells = [108, 90, 72, 54];
    const phases = [0, 0.12, 0.24, 0.34, 0.66, 0.76, 0.88, 1].map((x) => x * Math.PI);
    for (const [k, L] of shells.entries()) {
      for (const phase of phases) {
        const pts = line(L, 0.72, phase);
        stroke(pts, '#7a5cff', 5, 0.05);
        stroke(pts, '#a48dff', 2.2, 0.11);
        stroke(pts, '#e6dcff', 0.8, 0.32 - k * 0.04);
      }
    }
    // its spine, bow to stern: the dipole's own axis, a fine bright current
    for (const [w, a, col] of [[6, 0.08, '#7a5cff'], [2.5, 0.25, '#c9b8ff'], [1, 0.7, '#ffffff']]) {
      const gr = g.createLinearGradient(0, cy - 112, 0, cy + 108);
      gr.addColorStop(0, col);
      gr.addColorStop(0.5, col);
      gr.addColorStop(1, 'rgba(120,90,255,0)');
      g.globalAlpha = a;
      g.strokeStyle = gr;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(cx, cy - 112);
      g.lineTo(cx, cy + 108);
      g.stroke();
    }
    // the standing wave round its waist: an ellipse, nodes dark, antinodes bright
    for (let i = 0; i < 64; i++) {
      const t0 = (i / 64) * Math.PI * 2;
      const t1 = ((i + 1) / 64) * Math.PI * 2;
      const amp = Math.abs(Math.sin(t0 * 3));
      g.globalAlpha = 0.15 + 0.6 * amp;
      g.strokeStyle = '#c9b8ff';
      g.lineWidth = 1.2 + 1.5 * amp;
      g.beginPath();
      g.ellipse(cx, cy, 24, 7, 0, t0, t1);
      g.stroke();
    }
    // the core, and a brighter point at the bow
    const glow = (x, y, r, inner, a) => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, inner);
      gr.addColorStop(1, 'rgba(120,90,255,0)');
      g.globalAlpha = a;
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    };
    glow(cx, cy, 26, 'rgba(230,220,255,1)', 0.45);
    glow(cx, cy, 7, 'rgba(255,255,255,1)', 0.9);
    glow(cx, cy - 104, 10, 'rgba(220,240,255,1)', 0.55);
    glow(cx, cy + 102, 7, 'rgba(180,160,255,1)', 0.3);
    // motes trapped in its belts, bouncing between their mirror points
    for (let i = 0; i < 70; i++) {
      const L = 54 + rnd() * 54;
      const th = 0.45 + rnd() * (Math.PI - 0.9);
      const phase = phases[Math.floor(rnd() * phases.length)];
      const r = L * Math.sin(th) ** 2;
      const x = cx + r * Math.cos(th) * 0.72;
      const y = cy - r * Math.sin(th) * Math.cos(phase);
      glow(x, y, 2.2 + rnd() * 2, rnd() < 0.2 ? 'rgba(160,240,255,1)' : 'rgba(235,225,255,1)', 0.5 + rnd() * 0.4);
    }
    return c.toDataURL('image/png');
  });
  const out = path.join(__dirname, '..', 'public', 'art', 'ships', 'wraith.png');
  fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`wrote ${out}`);
  await b.close();
})();
