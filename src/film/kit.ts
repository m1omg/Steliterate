import { circlePath, glow, ink, ss, type Ctx, type Pt } from './draw';

// What the films of the second cut share: how a frame is laid out (wide or stacked), the sky's
// layers, the camera, a ship, and the ring the frame points with.

const INK = '#e6dccb';

/**
 * The pixel ratio a sky layer (the frame `m` times over each way) is painted at: the screen's,
 * but no more than about four million pixels a layer, so a large high-density screen does not
 * spend a hundred megabytes on stars.
 */
export const skyRatio = (w: number, h: number, m: number, pr: number) => Math.min(pr, Math.sqrt(4e6 / (w * h * m * m)));

/** A sprite painted in device pixels, drawn at its size in the frame's (CSS) pixels, centred on (x, y). */
export function put(c: Ctx, spr: HTMLCanvasElement, x: number, y: number, pr: number) {
  const w = spr.width / pr;
  const h = spr.height / pr;
  c.drawImage(spr, x - w / 2, y - h / 2, w, h);
}

/** Wide on a landscape screen, stacked on a phone held upright. */
export const landscape = (w: number, h: number) => w > h * 1.15;

/** A layer drawn over the frame from a canvas painted larger than it, moved and zoomed about the frame's centre. */
export function layer(c: Ctx, img: HTMLCanvasElement, w: number, h: number, m: number, ox: number, oy: number, z: number, alpha = 1) {
  if (alpha <= 0) return;
  const lw = w * m * z;
  const lh = h * m * z;
  c.save();
  c.globalAlpha = alpha;
  c.drawImage(img, w / 2 - lw / 2 + ox, h / 2 - lh / 2 + oy, lw, lh);
  c.restore();
}

/** Draw `fn` through a camera: zoomed by `z` about the point (fx, fy), then moved by (ox, oy). */
export function camera(c: Ctx, fx: number, fy: number, z: number, ox: number, oy: number, fn: () => void) {
  c.save();
  c.translate(fx + ox, fy + oy);
  c.scale(z, z);
  c.translate(-fx, -fy);
  fn();
  c.restore();
}

/** A ship seen from above, nose toward `ang`, `s` long: a dark hull lit along one edge, its two engines burning. */
export function ship(c: Ctx, x: number, y: number, ang: number, s: number, burn: number) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  const hull: Pt[] = [
    [0.55, 0],
    [0.18, 0.09],
    [-0.28, 0.15],
    [-0.38, 0.06],
    [-0.38, -0.06],
    [-0.28, -0.15],
    [0.18, -0.09],
  ];
  c.beginPath();
  hull.forEach(([px, py], i) => (i ? c.lineTo(px * s, py * s) : c.moveTo(px * s, py * s)));
  c.closePath();
  c.fillStyle = '#16120f';
  c.fill();
  c.strokeStyle = 'rgba(230,220,203,0.55)';
  c.lineWidth = Math.max(1, s * 0.012);
  c.stroke();
  c.beginPath();
  c.moveTo(0.5 * s, 0);
  c.lineTo(-0.34 * s, 0);
  c.strokeStyle = 'rgba(230,220,203,0.3)';
  c.stroke();
  c.restore();
  for (const side of [-1, 1]) {
    const ex = x + Math.cos(ang) * -0.4 * s - Math.sin(ang) * side * 0.06 * s;
    const ey = y + Math.sin(ang) * -0.4 * s + Math.cos(ang) * side * 0.06 * s;
    glow(c, ex, ey, s * 0.32 * burn, '#ffb070', 0.9 * burn);
    glow(c, ex, ey, s * 0.09, '#fff1d6', burn);
  }
}

/** A thin ink ring and its tick marks round a point: the frame's way of pointing at something. */
export function reticle(c: Ctx, x: number, y: number, r: number, S: number, reveal: number, seed: number, color = INK) {
  if (reveal <= 0) return;
  ink(c, circlePath(x, y, r, 72, seed), reveal, { width: Math.max(1, S * 0.0014), color, seed, alpha: 0.75 });
  const tick = ss(0.5, 1, reveal);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    ink(c, [[x + Math.cos(a) * r * 1.15, y + Math.sin(a) * r * 1.15], [x + Math.cos(a) * r * 1.55, y + Math.sin(a) * r * 1.55]], tick, { width: Math.max(1, S * 0.0014), color, seed: seed + i, alpha: 0.75 });
  }
}

/** A disc too cold to see, painted as the instruments show its faint heat: in false colour (`hue`), dim (`shade`). */
export function falseColour(c: CanvasRenderingContext2D, img: HTMLCanvasElement, x: number, y: number, R: number, hue = '#7a62b8', shade = '#6d6a78') {
  c.drawImage(img, x - R, y - R, R * 2, R * 2);
  c.save();
  c.beginPath();
  c.arc(x, y, R * 0.995, 0, Math.PI * 2);
  c.clip();
  c.globalCompositeOperation = 'color';
  c.fillStyle = hue;
  c.fillRect(x - R, y - R, R * 2, R * 2);
  c.globalCompositeOperation = 'multiply';
  c.fillStyle = shade;
  c.fillRect(x - R, y - R, R * 2, R * 2);
  c.restore();
}
