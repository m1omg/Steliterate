import { Rng } from '../game/rng';
import { circlePath, glow, ink, noise1, rgba, ss, type Ctx, type Pt } from './draw';
import type { FilmDef } from './films';
import { axes, figure } from './holes';
import { camera, landscape, layer, put, reticle, skyRatio } from './kit';
import { dotSprite, paintElliptical, paintSky, paintStar, tint } from './paint';
import { ease, note, reel2, type Scene } from './reel';

// A supernova of the Degenerate Age (26 Oct, the player: "this warrants a cutscene like the ages
// ones, make a kickass one pls :D ... i mean supernovae in degenerate era"). It plays with a game's
// first supernova (turnflow.ts). What happens, as physics tells it: two white dwarfs, each the
// size of a world and nearly a Sun's mass (the lighter one the larger, as degenerate matter is),
// spiral together as gravitational waves carry their orbit away; the lighter is torn apart and
// heaped on the heavier; the remnant passes the Chandrasekhar limit, carbon ignites in its core,
// and it detonates, about 10⁴⁴ J in a second or two, its ashes flying at some 10,000 km/s in
// layers (iron-group elements inside, silicon, sulphur and calcium, then unburnt carbon and
// oxygen); for a few weeks it outshines all that is left, lighting dust and drifting worlds no
// one had seen; its afterglow is radioactive (nickel-56 to cobalt-56 to iron-56); nothing is left
// at its centre. The words are the event's own. Where the film bends it: millions of years of
// spiralling and the weeks of light are shown in moments, gravitational waves (invisible) are drawn
// as rings, and the ashes' colours stand for their elements.

const INK = '#e6dccb';
const ACC = '#ffd27a';
const SOFT = '#fff0cf';
const WHITE = '#f4f7ff';

export const SUPERNOVA2: FilmDef = reel2({ id: 'supernova', name: 'Supernova', bpm: 90, beats: 60, accent: ACC }, (w, h, S, k, args) => {
  const pr = args.pr ?? 1;
  const land = landscape(w, h);
  const M = 1.3;
  const dpx = (x: number) => Math.round(x * pr);
  const spx = (x: number) => Math.round(x * skyRatio(w, h, M, pr));
  const scale = Math.max(1, (S / 900) * pr);
  const area = (w * h) / (1600 * 900);
  const thin = Math.max(1, S * 0.0014);

  // ------------------------------------------------------------ paintings
  // the Degenerate Age's sky: white dwarfs and cinders, no living stars
  const sky = paintSky(spx(w * M), spx(h * M), {
    seed: 501,
    n: Math.round(1900 * k * area),
    temps: [
      [40, 7000],
      [30, 11000],
      [20, 4800],
      [10, 3000],
    ],
    band: { color: [0.55, 0.6, 0.78], alpha: 0.16, angle: land ? -0.3 : -1.1 },
    scale,
  });
  const RA = S * 0.024;
  const RB = S * 0.031;
  const wdA = paintStar(dpx(RA * 2), { T: 16000, seed: 502, limb: [0.35, 0.2], cells: 14, grain: 0.1 });
  const wdB = paintStar(dpx(RB * 2), { T: 9500, seed: 503, limb: [0.35, 0.2], cells: 14, grain: 0.1 });
  const RM = S * 0.06;
  const merged = paintStar(dpx(RM * 2), { T: 24000, seed: 504, limb: [0.3, 0.2], cells: 18, grain: 0.14 });
  const GAL = Math.round(Math.min(2200, S * 1.4 * pr));
  const galaxy = paintElliptical(GAL, { seed: 505, n: Math.round(46000 * k), scale: Math.max(1, GAL / 1300), flat: 0.7, angle: 0.25 });
  const sprite = (r: number) => dotSprite(r * scale);

  const cx = w * 0.5;
  const cy = h * (land ? 0.45 : 0.42);

  // ------------------------------------------------------------ the inspiral, as gravitational waves drive it
  // Their separation falls as (t_c − t)^¼ and the orbit's angle runs as (t_c − t)^⅝ (Peters 1964),
  // so they circle slowly at first and plunge at the end: t_c is beat 15.5. The heavier (0.9 Suns)
  // is the smaller, the lighter (0.7) the larger; each circles their centre of mass.
  const TC = 15.5;
  const C = 1.05;
  const left = (b: number) => Math.max(0, TC - b);
  const sepAt = (b: number) => S * 0.3 * Math.pow(left(b) / TC, 0.25);
  const angAt = (b: number) => 0.4 + C * 1.6 * (Math.pow(TC, 0.625) - Math.pow(left(b), 0.625));
  /** The beat the orbit reached angle a (for the rings shed twice an orbit). */
  const beatAt = (a: number) => TC - Math.pow(Math.max(0, Math.pow(TC, 0.625) - (a - 0.4) / (C * 1.6)), 1.6);
  const MA = 0.9;
  const MB = 0.7;
  const TILT = 0.36;
  /** Where each is at beat b: the heavier (A) and the lighter (B), round their centre. */
  const posAt = (b: number): { a: Pt; b: Pt } => {
    const sep = sepAt(b);
    const an = angAt(b);
    const ra = (sep * MB) / (MA + MB);
    const rb = (sep * MA) / (MA + MB);
    // (as the lighter is torn away the heavier comes to the middle)
    const settle = ss(14.2, 15.8, b);
    return {
      a: [cx + Math.cos(an) * ra * (1 - settle), cy + Math.sin(an) * ra * TILT * (1 - settle)],
      b: [cx - Math.cos(an) * rb, cy - Math.sin(an) * rb * TILT],
    };
  };
  /** The period shown in the corner: minutes falling as (t_c − t)^⅜, from 30 to about one. */
  const periodAt = (b: number) => Math.max(1.1, 30 * Math.pow(Math.max(1e-4, left(b)) / TC, 0.375));

  // the gravitational waves: a ring shed twice an orbit, going out at a steady pace (drawn: they are invisible)
  const rings = (c: Ctx, b: number, alpha: number) => {
    if (alpha <= 0) return;
    const speed = S * 0.075;
    const aNow = angAt(Math.min(b, TC));
    c.save();
    c.lineWidth = thin;
    for (let i = Math.floor((aNow - 0.4) / Math.PI); i >= 0; i--) {
      const born = beatAt(0.4 + i * Math.PI);
      const r = (b - born) * speed;
      if (r > S * 1.1) break;
      if (r <= 0) continue;
      const a = alpha * 0.32 * (1 - r / (S * 1.1));
      c.strokeStyle = rgba(ACC, a);
      c.beginPath();
      c.ellipse(cx, cy, r, r * 0.62, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  };

  // the lighter one torn apart: its matter pulled off in a stream and wound into a disc round the heavier
  const N = Math.round(320 * k) + 120;
  const shreds = Array.from({ length: N }, (_, i) => {
    const r = new Rng(520 + i);
    return { rel: r.next(), rad: r.range(0.5, 1.6), ph: r.range(0, Math.PI * 2), z: r.range(-1, 1), s: r.range(0.6, 1.4), hot: r.next() };
  });
  const torn = (c: Ctx, b: number, fade: number) => {
    const d = ss(12.4, 15.3, b);
    if (d <= 0 || fade <= 0) return;
    const { a: A, b: B } = posAt(b);
    const discR = S * 0.07;
    const sp = sprite(2.2);
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const p of shreds) {
      if (p.rel > d) continue;
      // how far round from the lighter one it has come since it was pulled off
      const u = Math.min(1, (d - p.rel) / 0.35);
      const r = discR * p.rad;
      // Keplerian: the inner turns faster
      const an = p.ph + angAt(Math.min(b, TC)) + (b - 12.4) * 1.6 / Math.pow(p.rad, 1.5);
      const dx = A[0] + Math.cos(an) * r;
      const dy = A[1] + Math.sin(an) * r * TILT + p.z * S * 0.004;
      const x = B[0] + (dx - B[0]) * ease(u);
      const y = B[1] + (dy - B[1]) * ease(u);
      const col = p.hot > 0.5 ? [1, 0.93, 0.8] : [0.82, 0.88, 1];
      c.globalAlpha = 0.55 * fade * (0.5 + 0.5 * p.s);
      put(c, tint(sp, col as [number, number, number]), x, y, pr);
    }
    c.restore();
  };

  // ------------------------------------------------------------ 1. two white dwarfs, circling
  const drawPair = (c: Ctx, b: number) => {
    const { a: A, b: B } = posAt(b);
    const gone = ss(13.6, 15.4, b);
    // the lighter, stretched toward the heavier as it fills its Roche lobe, then gone
    const stretch = 1 + 0.55 * ss(11.6, 14, b);
    const ang = Math.atan2(A[1] - B[1], A[0] - B[0]);
    if (gone < 1) {
      glow(c, B[0], B[1], RB * 3, '#cfe0ff', 0.35 * (1 - gone));
      c.save();
      c.translate(B[0], B[1]);
      c.rotate(ang);
      c.scale(stretch, 1 / Math.sqrt(stretch));
      c.globalAlpha = 1 - gone;
      c.drawImage(wdB.get(), -RB, -RB, RB * 2, RB * 2);
      c.restore();
    }
    glow(c, A[0], A[1], RA * 3.4, SOFT, 0.45 + 0.4 * ss(13, 16, b));
    c.drawImage(wdA.get(), A[0] - RA, A[1] - RA, RA * 2, RA * 2);
  };
  const pair: Scene = {
    from: 0,
    to: 9,
    assets: [sky, wdA, wdB],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, -w * 0.02 * m.p, 0, 1.06, 0.55);
      rings(c, m.b, ss(1.5, 4, m.b));
      drawPair(c, m.b);
      const P = periodAt(m.b);
      figure(c, `ORBIT · ${P >= 2 ? `${Math.round(P)} MIN` : `${Math.round(P * 60)} S`}`, w * 0.5, cy + S * 0.25, S, ss(2.5, 3.5, m.b) * (1 - ss(8.4, 9, m.b)));
    },
    notes(m) {
      return [
        note('p-a', 'TWO WHITE DWARFS · 0.9 AND 0.7 SUNS', 0.5, land ? 0.14 : 0.12, ss(1, 1.8, m.b) * (1 - ss(8, 8.8, m.b)), { align: 'c', tone: 'accent' }),
        note('p-b', 'EACH THE SIZE OF A WORLD · THE LIGHTER, THE LARGER', 0.5, (land ? 0.14 : 0.12) + (S * 0.03) / h, ss(2.4, 3.2, m.b) * (1 - ss(8, 8.8, m.b)), { align: 'c', tone: 'dim' }),
        note('p-c', 'GRAVITATIONAL WAVES CARRY THEIR ORBIT AWAY', 0.5, (cy + S * 0.31) / h, ss(4.6, 5.4, m.b) * (1 - ss(8, 8.8, m.b)), { align: 'c', tone: 'ink' }),
      ];
    },
  };

  // ------------------------------------------------------------ 2. closer, faster: the lighter one torn apart
  const inspiral: Scene = {
    from: 8.5,
    to: 17,
    fade: 1.2,
    assets: [sky, wdA, wdB],
    draw(c, m) {
      const z = 1 + 0.75 * ease(ss(8.5, 15.5, m.b));
      layer(c, sky.get(), w, h, M, -w * 0.03, 0, 1.08 + 0.05 * m.p, 0.5);
      camera(c, cx, cy, z, 0, 0, () => {
        rings(c, m.b, 1 - ss(15.5, 16.8, m.b));
        torn(c, m.b, 1);
        drawPair(c, m.b);
        // the merger's flash of heat
        glow(c, cx, cy, S * 0.12, SOFT, 0.6 * ss(15, 15.6, m.b) * (1 - ss(15.6, 17, m.b)));
      });
      const P = periodAt(m.b);
      figure(c, `ORBIT · ${P >= 2 ? `${Math.round(P)} MIN` : `${Math.round(P * 60)} S`}`, w * 0.5, cy + S * 0.25, S, ss(9, 9.6, m.b) * (1 - ss(14.6, 15.2, m.b)));
    },
    notes(m) {
      return [
        note('i-a', 'MILLIONS OF YEARS · IN SECONDS', 0.5, land ? 0.14 : 0.12, ss(9.4, 10.2, m.b) * (1 - ss(12, 12.6, m.b)), { align: 'c', tone: 'dim' }),
        note('i-b', 'THE LIGHTER ONE · TORN APART', 0.5, land ? 0.14 : 0.12, ss(12.8, 13.6, m.b) * (1 - ss(16, 16.8, m.b)), { align: 'c', tone: 'accent' }),
        note('i-c', 'HEAPED ON THE HEAVIER', 0.5, (land ? 0.14 : 0.12) + (S * 0.03) / h, ss(14.2, 15, m.b) * (1 - ss(16, 16.8, m.b)), { align: 'c', tone: 'dim' }),
      ];
    },
  };

  // ------------------------------------------------------------ 3. past the limit: carbon ignites
  const gauge = land ? { x0: w * 0.3, x1: w * 0.7, y: h * 0.76 } : { x0: w * 0.12, x1: w * 0.88, y: h * 0.74 };
  const gx = (m: number) => gauge.x0 + (m / 1.6) * (gauge.x1 - gauge.x0);
  const massAt = (b: number) => 0.9 + 0.53 * ease(ss(17, 21.6, b));
  const flame = Array.from({ length: 64 }, (_, i) => i);
  const limit: Scene = {
    from: 16.5,
    to: 25.5,
    fade: 1.4,
    assets: [sky, merged],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, -w * 0.03, 0, 1.13, 0.42);
      // the cut-away: closer and closer into its core
      const zin = ss(21.6, 25.2, m.b);
      const z = 1 + 4.5 * Math.pow(zin, 2);
      const tremble = ss(23.5, 25.4, m.b);
      const ox = S * 0.004 * tremble * noise1(531, m.t * 22);
      const oy = S * 0.004 * tremble * noise1(532, m.t * 22);
      camera(c, cx, cy, z, ox, oy, () => {
        // what is left of the disc, falling in
        torn(c, 15.3 + (m.b - 16.5) * 0.4, 1 - ss(16.5, 20.5, m.b));
        const hot = ss(16.5, 22, m.b);
        glow(c, cx, cy, RM * 4, SOFT, 0.35 + 0.35 * hot);
        c.drawImage(merged.get(), cx - RM, cy - RM, RM * 2, RM * 2);
        // the cross-section: a quarter cut away, carbon and oxygen packed tighter toward the core
        const cut = ss(21.4, 22.6, m.b);
        if (cut > 0) {
          c.save();
          c.beginPath();
          c.moveTo(cx, cy);
          c.arc(cx, cy, RM * 0.985, -Math.PI / 2, -Math.PI / 2 + (Math.PI / 2) * cut);
          c.closePath();
          const g = c.createRadialGradient(cx, cy, 0, cx, cy, RM);
          g.addColorStop(0, 'rgba(255,236,200,1)');
          g.addColorStop(0.4, 'rgba(214,190,255,0.95)');
          g.addColorStop(1, 'rgba(110,120,190,0.95)');
          c.fillStyle = g;
          c.fill();
          c.restore();
          for (const f of [0.35, 0.65]) ink(c, circlePath(cx, cy, RM * f, 40, 533 + f * 10, -Math.PI / 2, 0), cut, { width: thin / z, color: INK, seed: 534, alpha: 0.5 });
        }
        // the flame: at its centre, a turbulent bubble that grows and runs
        const fl = ss(22.8, 25.4, m.b);
        if (fl > 0) {
          const R0 = RM * (0.05 + 0.4 * Math.pow(fl, 2));
          const pts: Pt[] = flame.map((i) => {
            const a = (i / 63) * Math.PI * 2;
            const r = R0 * (1 + 0.35 * noise1(540 + (i % 7), m.t * 3 + i * 0.4) * (0.4 + fl));
            return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as const;
          });
          c.save();
          c.globalCompositeOperation = 'lighter';
          c.fillStyle = rgba('#ffb35a', 0.75);
          c.beginPath();
          pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
          c.closePath();
          c.fill();
          c.restore();
          glow(c, cx, cy, R0 * 2.4, '#ffe2a8', 0.9 * fl);
        }
      });
      // the mass, rising past the limit
      const g0 = ss(17.2, 18, m.b) * (1 - ss(21.2, 21.8, m.b));
      if (g0 > 0) {
        ink(c, [[gauge.x0, gauge.y], [gauge.x1, gauge.y]], g0, { width: thin, color: INK, seed: 535, alpha: 0.5 });
        const mm = massAt(m.b);
        const over = mm >= 1.4;
        c.save();
        c.globalAlpha = g0;
        c.fillStyle = over ? rgba('#ff9a5a', 0.55) : rgba(ACC, 0.35);
        c.fillRect(gauge.x0, gauge.y - S * 0.01, gx(mm) - gauge.x0, S * 0.02);
        c.restore();
        ink(c, [[gx(1.4), gauge.y - S * 0.03], [gx(1.4), gauge.y + S * 0.03]], g0, { width: thin * 1.6, color: over ? '#ff9a5a' : ACC, seed: 536, alpha: 0.9 });
        for (const v of [0, 0.4, 0.8, 1.2, 1.6]) figure(c, v.toFixed(1), gx(v), gauge.y + S * 0.05, S, g0 * 0.8);
        figure(c, `${mm.toFixed(2)} SUNS`, gx(mm), gauge.y - S * 0.045, S, g0);
      }
    },
    notes(m) {
      const g0 = ss(17.2, 18, m.b) * (1 - ss(21.2, 21.8, m.b));
      return [
        note('l-a', 'ONE STAR NOW · AND GROWING', 0.5, land ? 0.14 : 0.12, ss(17, 17.8, m.b) * (1 - ss(20.6, 21.4, m.b)), { align: 'c', tone: 'dim' }),
        note('l-b', 'THE CHANDRASEKHAR LIMIT · NO WHITE DWARF CAN BE HEAVIER', gx(1.4) / w, (gauge.y + S * 0.085) / h, g0 * ss(19.8, 20.6, m.b), { align: 'c', tone: 'accent' }),
        note('l-c', 'CARBON · OXYGEN', 0.5, land ? 0.14 : 0.12, ss(22, 22.7, m.b) * (1 - ss(24.6, 25.2, m.b)), { align: 'c', tone: 'dim' }),
        note('l-d', 'CARBON IGNITES AT ITS CORE', 0.5, land ? 0.78 : 0.76, ss(23.1, 23.8, m.b) * (1 - ss(25, 25.5, m.b)), { align: 'c', tone: 'accent' }),
      ];
    },
  };

  // ------------------------------------------------------------ 4. it detonates
  const T0 = 25.5;
  /** The ashes' radius: free expansion, r = v t, from the moment it goes. */
  const blast = (b: number) => S * (0.035 + 0.06 * Math.max(0, b - T0));
  // the layers, inside out: iron-group, then silicon, sulphur and calcium, then unburnt carbon and oxygen
  const LAYERS = [
    { f: 0.38, col: '#fff0d8', rough: 0.07, seed: 551, a: 0.75 },
    { f: 0.68, col: '#ffb257', rough: 0.12, seed: 552, a: 0.5 },
    { f: 1, col: '#8f9cff', rough: 0.18, seed: 553, a: 0.3 },
  ];
  const NF = 180;
  const sparks = Array.from({ length: Math.round(220 * k) + 60 }, (_, i) => {
    const r = new Rng(560 + i);
    return { a: r.range(0, Math.PI * 2), s: r.range(0.35, 1.25), len: r.range(0.04, 0.14), hot: r.next() };
  });
  const shell = (c: Ctx, x: number, y: number, R: number, b: number, cool: number) => {
    c.save();
    c.globalCompositeOperation = 'lighter';
    // outermost first, so the hottest lies over it
    for (let li = LAYERS.length - 1; li >= 0; li--) {
      const L = LAYERS[li];
      const r0 = R * L.f;
      c.beginPath();
      for (let i = 0; i <= NF; i++) {
        const a = (i / NF) * Math.PI * 2;
        // Rayleigh–Taylor fingers: rough, and rougher outward
        const n = noise1(L.seed, a * 6 + 0.3 * (b - T0)) * 0.6 + noise1(L.seed + 9, a * 19) * 0.4;
        const r = r0 * (1 + L.rough * n);
        if (i) c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
        else c.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      c.closePath();
      // a shell: thin, brightest at its edge (seen edge-on, there is more of it along the line of sight)
      const g = c.createRadialGradient(x, y, r0 * 0.2, x, y, r0 * (1 + L.rough));
      g.addColorStop(0, rgba(L.col, 0));
      g.addColorStop(0.62, rgba(L.col, L.a * cool * 0.12));
      g.addColorStop(0.86, rgba(L.col, L.a * cool * 0.7));
      g.addColorStop(1, rgba(L.col, L.a * cool * 0.25));
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = rgba(L.col, L.a * cool * 0.9);
      c.lineWidth = thin;
      c.stroke();
    }
    c.restore();
    // the shock's edge
    ink(c, circlePath(x, y, R * 1.05, 120, 554), 1, { width: thin * 1.4, color: SOFT, seed: 554, alpha: 0.55 * cool });
  };
  const detonation: Scene = {
    from: T0,
    to: 33,
    enter: 'cut',
    assets: [sky],
    draw(c, m) {
      const since = m.b - T0;
      // the frame shakes as it goes, and settles
      const sh = (1 - ss(0, 2.2, since)) * S * 0.012;
      const ox = sh * noise1(571, m.t * 30);
      const oy = sh * noise1(572, m.t * 30);
      layer(c, sky.get(), w, h, M, ox, oy, 1.1, 0.35 + 0.25 * ss(0, 1.5, since));
      const R = blast(m.b);
      const cool = 1 - 0.45 * ss(0, 7.5, since);
      glow(c, cx + ox, cy + oy, R * 2.2, ACC, 0.3 * cool);
      shell(c, cx + ox, cy + oy, R, m.b, cool);
      // the brightest ashes flung ahead of the rest
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.lineCap = 'round';
      for (const p of sparks) {
        const r = R * p.s;
        const L = R * p.len;
        c.strokeStyle = rgba(p.hot > 0.5 ? '#fff2d6' : '#ffb35a', 0.5 * cool * (1 - ss(0.9, 1.25, p.s)));
        c.lineWidth = thin;
        c.beginPath();
        c.moveTo(cx + ox + Math.cos(p.a) * r, cy + oy + Math.sin(p.a) * r);
        c.lineTo(cx + ox + Math.cos(p.a) * (r + L), cy + oy + Math.sin(p.a) * (r + L));
        c.stroke();
      }
      c.restore();
      // its heart still blazing, powered by what is decaying in it
      glow(c, cx + ox, cy + oy, S * 0.09, WHITE, 0.8 * cool);
      // the first light racing out ahead of everything, and a streak across the lens
      const race = ss(0, 2.4, since);
      if (race < 1) {
        c.save();
        c.strokeStyle = rgba(WHITE, 0.7 * (1 - race));
        c.lineWidth = thin * 2.2;
        c.beginPath();
        c.ellipse(cx + ox, cy + oy, S * 1.4 * race, S * 1.4 * race * 0.92, 0, 0, Math.PI * 2);
        c.stroke();
        c.globalCompositeOperation = 'lighter';
        const streak = 1 - ss(0, 2, since);
        const g = c.createLinearGradient(0, cy, w, cy);
        g.addColorStop(0, 'rgba(255,214,150,0)');
        g.addColorStop(0.5, `rgba(255,236,200,${0.85 * streak})`);
        g.addColorStop(1, 'rgba(255,214,150,0)');
        c.fillStyle = g;
        c.fillRect(0, cy + oy - S * 0.004, w, S * 0.008);
        c.restore();
      }
      // the flash: everything white, fading
      const fl = 1 - ss(0, 1.6, since);
      if (fl > 0) {
        c.save();
        c.fillStyle = `rgba(255,252,240,${fl})`;
        c.fillRect(0, 0, w, h);
        c.restore();
      }
    },
    notes(m) {
      const at = (f: number) => (cy + blast(31) * f * 0.62) / h;
      const lx = (f: number) => (cx + blast(31) * f * 0.8 + S * 0.02) / w;
      return [
        note('d-a', 'DETONATION', 0.5, land ? 0.14 : 0.12, ss(25.9, 26.4, m.b) * (1 - ss(32.2, 32.9, m.b)), { align: 'c', tone: 'accent', size: 'm' }),
        note('d-b', 'ABOUT 10⁴⁴ J IN A SECOND OR TWO', 0.5, (land ? 0.14 : 0.12) + (S * 0.035) / h, ss(26.8, 27.6, m.b) * (1 - ss(32.2, 32.9, m.b)), { align: 'c', tone: 'ink' }),
        note('d-c', 'ITS ASHES FLY AT 10,000 KM/S', 0.5, land ? 0.84 : 0.82, ss(28.2, 29, m.b) * (1 - ss(32.2, 32.9, m.b)), { align: 'c', tone: 'dim' }),
        note('d-fe', 'NICKEL · IRON', lx(0.38), at(0.38), ss(29.6, 30.3, m.b) * (1 - ss(32.2, 32.9, m.b)), { tone: 'ink' }),
        note('d-si', 'SILICON · SULPHUR · CALCIUM', lx(0.68), at(0.68), ss(30.2, 30.9, m.b) * (1 - ss(32.2, 32.9, m.b)), { tone: 'accent' }),
        note('d-co', 'CARBON · OXYGEN, UNBURNT', lx(1), at(1), ss(30.8, 31.5, m.b) * (1 - ss(32.2, 32.9, m.b)), { tone: 'dim' }),
      ];
    },
  };

  // ------------------------------------------------------------ 5. for a few weeks it outshines all that is left
  const sn: Pt = [w * (land ? 0.6 : 0.56), h * (land ? 0.42 : 0.38)];
  const GS = S * (land ? 1.15 : 1.25);
  // what its light finds: drifting worlds (lit on the side toward it), dead stars, and dust
  const finds = Array.from({ length: Math.round(16 * k) + 10 }, (_, i) => {
    const r = new Rng(580 + i);
    const a = r.range(0, Math.PI * 2);
    const d = S * r.range(0.12, 0.62);
    return { x: sn[0] + Math.cos(a) * d * (land ? 1.35 : 1), y: sn[1] + Math.sin(a) * d * 0.8, d, size: S * r.range(0.006, 0.022), kind: r.chance(0.6) ? 'world' : 'dust', seed: 590 + i };
  });
  const lit: Scene = {
    from: 32.5,
    to: 43,
    fade: 1.5,
    assets: [sky, galaxy],
    draw(c, m) {
      const u = ease(m.p);
      const z = 1.12 - 0.08 * u;
      layer(c, sky.get(), w, h, M, w * 0.02 * u, 0, z, 0.32);
      c.save();
      c.globalAlpha = 0.32;
      c.globalCompositeOperation = 'lighter';
      c.drawImage(galaxy.get(), w * 0.5 - GS / 2, h * 0.47 - GS / 2, GS, GS);
      c.restore();
      // its light going out over the dark, finding what was there
      const front = S * 0.11 * Math.max(0, m.b - 32.6);
      const bright = 0.75 + 0.25 * Math.sin(Math.min(1, (m.b - 32.5) / 6) * Math.PI * 0.5) - 0.3 * ss(38, 43, m.b);
      for (const f of finds) {
        const on = ss(f.d - S * 0.05, f.d + S * 0.02, front);
        if (on <= 0) continue;
        if (f.kind === 'dust') {
          // a light echo: a faint arc where the light reaches dust
          const r = Math.hypot(f.x - sn[0], f.y - sn[1]);
          const a = Math.atan2(f.y - sn[1], f.x - sn[0]);
          ink(c, circlePath(sn[0], sn[1], r, 40, f.seed, a - 0.35, a + 0.35), on, { width: thin * 1.3, color: ACC, seed: f.seed, alpha: 0.35 * bright });
          glow(c, f.x, f.y, f.size * 4, '#c79a5a', 0.16 * on * bright);
        } else {
          // a drifting world, dark, lit on the side that faces it
          const a = Math.atan2(sn[1] - f.y, sn[0] - f.x);
          c.save();
          c.fillStyle = '#0b0b0e';
          c.beginPath();
          c.arc(f.x, f.y, f.size, 0, Math.PI * 2);
          c.fill();
          c.strokeStyle = rgba(SOFT, 0.85 * on * bright);
          c.lineWidth = Math.max(1, f.size * 0.28);
          c.beginPath();
          c.arc(f.x, f.y, f.size * 0.86, a - 1.2, a + 1.2);
          c.stroke();
          c.restore();
        }
      }
      // the supernova: a point brighter than everything else, with the spikes a telescope gives it
      glow(c, sn[0], sn[1], S * 0.32, ACC, 0.32 * bright);
      glow(c, sn[0], sn[1], S * 0.06, WHITE, 0.95 * bright);
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ]) {
        const L = S * 0.24 * bright;
        const g = c.createLinearGradient(sn[0] - dx * L, sn[1] - dy * L, sn[0] + dx * L, sn[1] + dy * L);
        g.addColorStop(0, 'rgba(255,240,210,0)');
        g.addColorStop(0.5, `rgba(255,248,232,${0.7 * bright})`);
        g.addColorStop(1, 'rgba(255,240,210,0)');
        c.strokeStyle = g;
        c.lineWidth = Math.max(1, S * 0.002);
        c.beginPath();
        c.moveTo(sn[0] - dx * L, sn[1] - dy * L);
        c.lineTo(sn[0] + dx * L, sn[1] + dy * L);
        c.stroke();
      }
      c.restore();
    },
    notes(m) {
      return [
        note('o-a', 'FOR A FEW WEEKS · BRIGHTER THAN ALL THAT IS LEFT', 0.5, land ? 0.14 : 0.12, ss(33.4, 34.2, m.b) * (1 - ss(37.6, 38.4, m.b)), { align: 'c', tone: 'accent' }),
        note('o-b', 'ABOUT FIVE BILLION SUNS AT ITS PEAK', 0.5, (land ? 0.14 : 0.12) + (S * 0.03) / h, ss(34.6, 35.4, m.b) * (1 - ss(37.6, 38.4, m.b)), { align: 'c', tone: 'dim' }),
        note('o-c', 'ITS LIGHT ON DUST AND DRIFTING WORLDS', 0.5, land ? 0.14 : 0.12, ss(38.6, 39.4, m.b) * (1 - ss(42.2, 42.9, m.b)), { align: 'c', tone: 'accent' }),
        note('o-d', 'LIGHT ECHOES', sn[0] / w, (sn[1] - S * 0.3) / h, ss(39.4, 40.2, m.b) * (1 - ss(42.2, 42.9, m.b)), { align: 'c', tone: 'dim' }),
      ];
    },
  };

  // ------------------------------------------------------------ 6. the afterglow is radioactive
  const ch = land ? { x0: w * 0.2, x1: w * 0.8, y0: h * 0.72, y1: h * 0.3 } : { x0: w * 0.12, x1: w * 0.88, y0: h * 0.66, y1: h * 0.3 };
  const DAYS = 150;
  /** Its light, a Type Ia's bolometric curve: the decay heating of 0.6 Suns of nickel-56 (mean lives 8.8 and 111.3 days), let out as the ashes thin (Arnett). */
  const heat = (t: number) => 6.45 * Math.exp(-t / 8.8) + 1.45 * Math.exp(-t / 111.3);
  const lum = (t: number) => heat(t) * (1 - Math.exp(-Math.pow(t / 15, 2))) * (1 + 0.5 * Math.exp(-Math.pow((t - 19) / 9, 2)));
  const curve: Pt[] = Array.from({ length: 121 }, (_, i) => {
    const t = (i / 120) * DAYS;
    const L = Math.max(1e-3, lum(t));
    const y = (Math.log10(L) + 1.2) / (Math.log10(lum(19)) + 1.2);
    return [ch.x0 + (t / DAYS) * (ch.x1 - ch.x0), ch.y0 - Math.max(0, y) * (ch.y0 - ch.y1)] as const;
  });
  const tx = (t: number) => ch.x0 + (t / DAYS) * (ch.x1 - ch.x0);
  const chainY = land ? h * 0.18 : h * 0.2;
  // (spread wider on a phone, where the frame is narrow)
  const chain: [string, number, string][] = [
    ['NICKEL-56', land ? 0.3 : 0.17, '#ff9a6a'],
    ['COBALT-56', 0.5, ACC],
    ['IRON-56', land ? 0.7 : 0.83, '#b8bcc6'],
  ];
  const gap = S * 0.075;
  const afterglow: Scene = {
    from: 42.5,
    to: 49,
    fade: 1.4,
    assets: [sky],
    draw(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.12, 0.22);
      axes(c, ch.x0, ch.y0, ch.x1, ch.y1, ss(42.8, 43.8, m.b), S, 581);
      ink(c, curve, ss(43.6, 46.6, m.b), { width: Math.max(1, S * 0.0026), color: ACC, seed: 582, alpha: 0.95 });
      const ax = ss(43.6, 44.4, m.b);
      for (const d of [0, 50, 100, 150]) figure(c, `${d}`, tx(d), ch.y0 + S * 0.03, S, ax * 0.85);
      figure(c, 'DAYS', ch.x1, ch.y0 + S * 0.06, S, ax * 0.7, 'right');
      // the chain: each decays into the next
      chain.forEach(([, f, col], i) => {
        const on = ss(44.2 + i * 0.9, 44.9 + i * 0.9, m.b);
        glow(c, w * f, chainY, S * 0.03, col, 0.55 * on);
        if (i < 2) ink(c, [[w * f + gap, chainY], [w * chain[i + 1][1] - gap, chainY]], ss(44.6 + i * 0.9, 45.2 + i * 0.9, m.b), { width: thin, color: INK, seed: 583 + i, alpha: 0.6 });
      });
    },
    notes(m) {
      return [
        note('a-a', 'THE AFTERGLOW IS RADIOACTIVE', 0.5, land ? 0.08 : 0.1, ss(43, 43.8, m.b) * (1 - ss(48.2, 48.9, m.b)), { align: 'c', tone: 'accent' }),
        ...chain.map(([el, f], i) => note(`a-${i}`, el, f, chainY / h - (S * 0.004) / h, ss(44.2 + i * 0.9, 44.9 + i * 0.9, m.b) * (1 - ss(48.2, 48.9, m.b)), { align: 'c', tone: i === 2 ? 'ink' : 'accent', size: 'm' })),
        note('a-h1', '6 DAYS', (chain[0][1] + chain[1][1]) / 2, chainY / h + (S * 0.03) / h, ss(44.8, 45.4, m.b) * (1 - ss(48.2, 48.9, m.b)), { align: 'c', tone: 'dim' }),
        note('a-h2', '77 DAYS', (chain[1][1] + chain[2][1]) / 2, chainY / h + (S * 0.03) / h, ss(45.7, 46.3, m.b) * (1 - ss(48.2, 48.9, m.b)), { align: 'c', tone: 'dim' }),
        note('a-pk', 'PEAK · ~19 DAYS', tx(19) / w, (curve[Math.round((19 / DAYS) * 120)][1] - S * 0.04) / h, ss(45, 45.7, m.b) * (1 - ss(48.2, 48.9, m.b)), { align: 'l', tone: 'ink' }),
      ];
    },
  };

  // ------------------------------------------------------------ 7. nothing left behind
  const NR = 220;
  const remnant: Scene = {
    from: 48.5,
    to: 54.5,
    fade: 1.5,
    assets: [sky],
    draw(c, m) {
      const u = ease(m.p);
      layer(c, sky.get(), w, h, M, 0, 0, 1.14 - 0.04 * u, 0.4);
      const R = S * (0.26 + 0.04 * u);
      // its shell, seen centuries on: thin filaments where the shock meets what little is out there
      c.save();
      c.globalCompositeOperation = 'lighter';
      c.lineWidth = thin;
      for (let i = 0; i < NR; i++) {
        const a = (i / NR) * Math.PI * 2;
        const r = R * (1 + 0.06 * noise1(601, a * 5) + 0.03 * noise1(602, a * 23));
        const L = R * (0.02 + 0.06 * Math.abs(noise1(603, a * 11)));
        const tone = noise1(604, a * 3) > 0 ? '#7fd8ff' : ACC;
        c.strokeStyle = rgba(tone, 0.35 + 0.25 * noise1(605, a * 9));
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * (r - L), cy + Math.sin(a) * (r - L));
        c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        c.stroke();
      }
      c.restore();
      glow(c, cx, cy, R * 1.1, '#5a6a90', 0.08);
      reticle(c, cx, cy, S * 0.04, S, ss(49.4, 50.4, m.b), 606, ACC);
    },
    notes(m) {
      return [
        note('r-a', 'NOTHING LEFT BEHIND · NO STAR, NO CORPSE', 0.5, (cy + S * 0.36) / h, ss(49.6, 50.4, m.b), { align: 'c', tone: 'accent' }),
        note('r-b', 'ITS IRON, SCATTERED INTO THE DARK', 0.5, (cy + S * 0.39) / h, ss(51, 51.8, m.b), { align: 'c', tone: 'dim' }),
      ];
    },
  };

  return {
    numeral: 'II',
    title: 'Supernova',
    sub: 'Type Ia · a white dwarf past its limit',
    titleAt: 54,
    eta: [args.eta ?? 15, args.eta ?? 15],
    narration: [
      { from: 17.4, to: 23.2, text: 'The merged remnant was too heavy to live.' },
      { from: 26, to: 31.8, text: 'It detonated as a thermonuclear supernova,' },
      { from: 33.2, to: 37.8, text: 'for a few weeks outshining everything left in the Coalescence.' },
      { from: 38.4, to: 43.6, text: 'Its light lit up shapes in the dark our instruments had never seen.' },
    ],
    scenes: [pair, inspiral, limit, detonation, lit, afterglow, remnant],
    card(c, m) {
      layer(c, sky.get(), w, h, M, 0, 0, 1.0 + 0.04 * m.p, 0.3);
      glow(c, w * 0.5, h * 0.5, S * 0.6, '#b08a50', 0.07 * (1 - m.p));
    },
  };
});
