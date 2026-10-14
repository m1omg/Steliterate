import { Rng } from '../game/rng';
import { blackbody } from '../render/shaders/noise';

// Painting by the pixel, for the films: what the game's own view draws with shaders, painted here
// on the CPU into offscreen canvases (the films keep to one 2D canvas, never a second WebGL
// context): a star's disc with its limb darkening, granulation and spots; a world with its seas,
// land, ice, cloud, the terminator, its air and the lights of its settlements, turning; a field of
// stars by temperature; a galaxy of stipple. Everything is seeded, so the same moment always
// paints the same picture. Heavy work is a Lazy job, done a slice at a time while a film plays
// (`warm`) or all at once when a frame needs it (`get`): the result is the same either way.

export type RGB = readonly [number, number, number];

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** A job done a slice at a time (`warm`, until a deadline) or all at once (`get`): what it makes is the same either way. */
export class Lazy<T> {
  private it: Generator<void, T, void> | null;
  private value: T | undefined;
  private finished = false;
  constructor(make: () => Generator<void, T, void>) {
    this.it = make();
  }
  get ready(): boolean {
    return this.finished;
  }
  get(): T {
    while (!this.finished) this.step();
    return this.value as T;
  }
  /** Work on it until `until` (performance.now()); whether it is done. */
  warm(until: number): boolean {
    while (!this.finished && performance.now() < until) this.step();
    return this.finished;
  }
  private step() {
    const r = this.it!.next();
    if (r.done) {
      this.value = r.value;
      this.finished = true;
      this.it = null;
    }
  }
}

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** A temperature's colour (0..1), as the game's view colours a star. */
export const kelvin = (T: number): RGB => blackbody(T);

export const css = (c: RGB, a = 1) => `rgba(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)},${a})`;

// ------------------------------------------------------------------ noise

/** Improved Perlin noise in three dimensions (Perlin 2002), its permutation shuffled by a seed: about -1..1. */
export class Perlin {
  private p = new Uint8Array(512);
  constructor(seed: number) {
    const rng = new Rng(seed);
    const q = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [q[i], q[j]] = [q[j], q[i]];
    }
    for (let i = 0; i < 512; i++) this.p[i] = q[i & 255];
  }
  noise(x: number, y: number, z: number): number {
    const p = this.p;
    const X = Math.floor(x),
      Y = Math.floor(y),
      Z = Math.floor(z);
    x -= X;
    y -= Y;
    z -= Z;
    const xi = X & 255,
      yi = Y & 255,
      zi = Z & 255;
    const u = x * x * x * (x * (x * 6 - 15) + 10);
    const v = y * y * y * (y * (y * 6 - 15) + 10);
    const w = z * z * z * (z * (z * 6 - 15) + 10);
    const A = p[xi] + yi,
      AA = p[A] + zi,
      AB = p[A + 1] + zi;
    const B = p[xi + 1] + yi,
      BA = p[B] + zi,
      BB = p[B + 1] + zi;
    const g = (h: number, x: number, y: number, z: number) => {
      const k = h & 15;
      const a = k < 8 ? x : y;
      const b = k < 4 ? y : k === 12 || k === 14 ? x : z;
      return ((k & 1) === 0 ? a : -a) + ((k & 2) === 0 ? b : -b);
    };
    return mix(
      mix(mix(g(p[AA], x, y, z), g(p[BA], x - 1, y, z), u), mix(g(p[AB], x, y - 1, z), g(p[BB], x - 1, y - 1, z), u), v),
      mix(mix(g(p[AA + 1], x, y, z - 1), g(p[BA + 1], x - 1, y, z - 1), u), mix(g(p[AB + 1], x, y - 1, z - 1), g(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w,
    );
  }
  /** Fractal sum of octaves, about -1..1. */
  fbm(x: number, y: number, z: number, octaves = 5, lacunarity = 2.03, gain = 0.5): number {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise(x * f, y * f, z * f);
      norm += amp;
      amp *= gain;
      f *= lacunarity;
    }
    return sum / norm;
  }
}

// ------------------------------------------------------------------ a star's disc

export interface StarLook {
  /** Its temperature (K): the colour of the disc. */
  T: number;
  seed: number;
  /** Limb darkening, quadratic: I(μ) = 1 − u(1 − μ) − v(1 − μ)² (a red dwarf's about 0.5 and 0.25, Claret 2000). */
  limb?: readonly [number, number];
  /** Spot groups: how many, and how big their spots are at most (radians on the sphere). */
  spots?: number;
  spotSize?: number;
  /** Granulation's scale (cells across the disc) and how strong. */
  cells?: number;
  grain?: number;
  /** Where the convection is (a second phase of it, for a disc that seethes as it crossfades). */
  phase?: number;
}

/**
 * A star's disc, `px` across: brightest in the middle and darker and redder toward the limb, the
 * convection's cells over it, bright faculae near the limb, and groups of dark spots, each with
 * its penumbra and a ragged edge, foreshortened as they lie on the sphere. Transparent outside the
 * disc; the glow round it is drawn with the frame.
 */
export function paintStar(px: number, o: StarLook): Lazy<HTMLCanvasElement> {
  return new Lazy(function* () {
    const n = Math.max(8, Math.round(px));
    const cv = canvas(n, n);
    const g = cv.getContext('2d')!;
    const img = g.createImageData(n, n);
    const noise = new Perlin(o.seed);
    const cells = new Perlin(o.seed + 31 + Math.round((o.phase ?? 0) * 7));
    const rng = new Rng(o.seed + 1);
    const [u, v] = o.limb ?? [0.5, 0.25];
    const base = kelvin(o.T);
    const cool = kelvin(o.T * 0.62);
    const spots: { x: number; y: number; z: number; r: number }[] = [];
    for (let i = 0; i < (o.spots ?? 0); i++) {
      const lon = rng.range(-1.3, 1.3);
      const lat = rng.range(0.15, 0.7) * (rng.chance(0.5) ? 1 : -1);
      // a group: a leader and its followers, strung out along the latitude
      const count = 1 + Math.floor(rng.next() * 3);
      for (let j = 0; j < count; j++) {
        const lo = lon + j * rng.range(0.06, 0.14);
        const la = lat + rng.range(-0.04, 0.04);
        spots.push({ x: Math.cos(la) * Math.sin(lo), y: Math.sin(la), z: Math.cos(la) * Math.cos(lo), r: (o.spotSize ?? 0.08) * (j === 0 ? 1 : rng.range(0.35, 0.7)) });
      }
    }
    const f = o.cells ?? 30;
    const grain = o.grain ?? 0.3;
    const hot = smooth(3600, 8000, o.T);
    const gr = mix(246, 236, hot);
    const gg = mix(196, 240, hot);
    const gb = mix(150, 255, hot);
    const ph = (o.phase ?? 0) * 3.1;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) / n) * 2 - 1;
        const y = ((j + 0.5) / n) * 2 - 1;
        const r2 = x * x + y * y;
        const k = (j * n + i) * 4;
        if (r2 > 1) continue;
        const z = Math.sqrt(1 - r2);
        const mu = z;
        // the cells: bright granules, dark lanes where the turbulence crosses zero
        const c1 = cells.noise(x * f, y * f, z * f + ph) + 0.5 * cells.noise(x * f * 2.3, y * f * 2.3, z * f * 2.3 - ph);
        const lane = smooth(0.0, 0.42, Math.abs(c1));
        const gran = 1 - grain + grain * (0.35 + 0.65 * lane);
        // supergranulation's slow mottling, and faculae near the limb
        const mottle = 1 + 0.07 * noise.fbm(x * 2.6 + 3, y * 2.6, z * 2.6, 3);
        const fac = 1 + 0.32 * Math.max(0, noise.fbm(x * 7, y * 7, z * 7 + 11, 3) - 0.12) * Math.pow(1 - mu, 1.5);
        let spot = 1;
        for (const s of spots) {
          const cosd = x * s.x - y * s.y + z * s.z;
          if (cosd < 0.7) continue;
          const d = Math.acos(Math.min(1, cosd)) * (1 + 0.28 * noise.noise(x * 14, y * 14, z * 14));
          spot *= mix(0.32, 1, smooth(s.r * 0.42, s.r * 0.62, d)) * mix(0.68, 1, smooth(s.r * 0.8, s.r * 1.25, d));
        }
        const limb = Math.max(0, 1 - u * (1 - mu) - v * (1 - mu) * (1 - mu));
        const I = limb * gran * mottle * fac * spot;
        // the limb is cooler as well as darker
        const e = Math.pow(1 - mu, 0.9);
        // (scaled so the centre does not clip: the limb's darkening stays in the picture; a cool
        // star's light deepened toward red, a hot one's left white-blue)
        img.data[k] = Math.min(255, mix(base[0], cool[0], e) * I * gr);
        img.data[k + 1] = Math.min(255, mix(base[1], cool[1], e) * I * gg);
        img.data[k + 2] = Math.min(255, mix(base[2], cool[2], e) * I * gb);
        // a soft edge, a pixel wide
        img.data[k + 3] = Math.round(255 * clamp01((1 - Math.sqrt(r2)) * n * 0.5));
      }
      if (j % 24 === 23) yield;
    }
    g.putImageData(img, 0, 0);
    return cv;
  });
}

// ------------------------------------------------------------------ a world

export interface WorldLook {
  seed: number;
  /** Share of the surface under sea (0..1). */
  sea: number;
  /** Ice: from this |latitude|-ish (0..1) and on the night side's far half, if the world is locked. */
  ice: number;
  locked?: boolean;
  /** Cloud cover (0..1). */
  cloud: number;
  /** Settlements: how many lit places (on the night side), and where (lon, lat in radians). */
  lights?: readonly (readonly [number, number])[];
  palette: { deep: RGB; shallow: RGB; low: RGB; high: RGB; ice: RGB; cloud: RGB; air: RGB; lights: RGB };
}

/**
 * A world's map (equirectangular, `w` × w/2): continents warped out of noise, with ridges of
 * mountains, coasts and shelves, a hot dry face under a locked world's star and ice over its far
 * side and its poles, streaks of cloud, and the lights of its settlements; made once. A World
 * paints its disc from it at any turn of its rotation.
 */
export function paintWorldMap(w: number, o: WorldLook): Lazy<WorldMap> {
  return new Lazy(function* () {
    const W = Math.round(w);
    const H = Math.round(w / 2);
    const albedo = new Uint8ClampedArray(W * H * 3);
    const sea = new Uint8Array(W * H);
    const cloud = new Uint8Array(W * H);
    const light = new Uint8Array(W * H);
    const ground = new Perlin(o.seed);
    const warp = new Perlin(o.seed + 9);
    const air = new Perlin(o.seed + 17);
    const rng = new Rng(o.seed + 3);
    const height = (x: number, y: number, z: number) => {
      // domain warping: the continents bent into shapes no plain noise makes
      const qx = x + 0.45 * warp.fbm(x * 1.4, y * 1.4, z * 1.4, 4);
      const qy = y + 0.45 * warp.fbm(x * 1.4 + 5.2, y * 1.4, z * 1.4, 4);
      const qz = z + 0.45 * warp.fbm(x * 1.4, y * 1.4 + 9.7, z * 1.4, 4);
      const base = ground.fbm(qx * 1.7, qy * 1.7, qz * 1.7, 6);
      const ridge = 1 - Math.abs(ground.noise(qx * 5.5, qy * 5.5, qz * 5.5));
      return base + 0.18 * ridge * ridge - 0.09;
    };
    // where the sea lies: the height at the sea's share, found from a sample
    const sample: number[] = [];
    for (let i = 0; i < 600; i++) {
      const lon = rng.range(-Math.PI, Math.PI);
      const lat = Math.asin(rng.range(-1, 1));
      sample.push(height(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)));
    }
    sample.sort((a, b) => a - b);
    const level = sample[Math.min(sample.length - 1, Math.floor(o.sea * sample.length))];
    const pal = o.palette;
    const put = (k: number, c: readonly number[]) => {
      albedo[k * 3] = c[0] * 255;
      albedo[k * 3 + 1] = c[1] * 255;
      albedo[k * 3 + 2] = c[2] * 255;
    };
    for (let j = 0; j < H; j++) {
      const lat = (0.5 - (j + 0.5) / H) * Math.PI;
      const cl = Math.cos(lat);
      const sl = Math.sin(lat);
      for (let i = 0; i < W; i++) {
        const lon = ((i + 0.5) / W) * Math.PI * 2 - Math.PI;
        const x = cl * Math.cos(lon);
        const y = sl;
        const z = cl * Math.sin(lon);
        const hgt = height(x, y, z);
        const k = j * W + i;
        // a locked world: the face under the star (longitude 0) hot and dry, the far face frozen
        const facing = o.locked ? Math.cos(lon) * cl : 0;
        const away = o.locked ? smooth(0.05, 0.75, -facing) : 0;
        const fine = ground.noise(x * 22, y * 22, z * 22);
        let c: number[];
        if (hgt < level) {
          const d = clamp01((level - hgt) * 6);
          const shelf = 1 - smooth(0, 0.18, d);
          c = [mix(pal.deep[0], pal.shallow[0], shelf), mix(pal.deep[1], pal.shallow[1], shelf), mix(pal.deep[2], pal.shallow[2], shelf)];
          sea[k] = 255;
        } else {
          const e = clamp01((hgt - level) * 3.4);
          const detail = 0.82 + 0.3 * (0.5 + 0.5 * fine) * (0.6 + 0.4 * ground.noise(x * 7, y * 7, z * 7));
          c = [mix(pal.low[0], pal.high[0], e) * detail, mix(pal.low[1], pal.high[1], e) * detail, mix(pal.low[2], pal.high[2], e) * detail];
          // under the star: baked and dry, a rust-ochre
          const dry = smooth(0.35, 0.95, facing) * 0.55;
          c = [mix(c[0], 0.62, dry), mix(c[1], 0.38, dry), mix(c[2], 0.22, dry)];
        }
        const polar = smooth(o.ice, o.ice + 0.12, Math.abs(sl) + 0.07 * fine);
        const iceAt = Math.max(polar, away * smooth(-0.25, 0.1, hgt - level + 0.12 + 0.05 * fine));
        if (iceAt > 0) c = [mix(c[0], pal.ice[0], iceAt), mix(c[1], pal.ice[1], iceAt), mix(c[2], pal.ice[2], iceAt)];
        put(k, c);
        // cloud: streaks drawn out along the latitude, heaped up where the star heats the air, thin over the ice
        const cn = air.fbm(x * 2.6 + 0.3 * fine, y * 7.5, z * 2.6, 6) * 0.5 + 0.5;
        const heap = o.locked ? 0.25 * smooth(0.2, 1, facing) - 0.2 * away : 0;
        cloud[k] = 255 * smooth(1 - o.cloud * 0.9 - heap, 1 - o.cloud * 0.9 - heap + 0.2, cn);
      }
      if (j % 12 === 11) yield;
    }
    // the settlements: each a cluster of lights, a bright core and scattered towns, with roads between
    // (each a point of its own, drawn sharp over the disc, and a faint glow in the map beneath)
    const towns: number[] = [];
    for (const [lon0, lat0] of o.lights ?? []) {
      const count = 40 + Math.floor(rng.next() * 50);
      let px0 = lon0;
      let py0 = lat0;
      for (let t = 0; t < count; t++) {
        const r = Math.abs(rng.range(-1, 1)) * rng.range(0.015, 0.12);
        const a = rng.range(0, Math.PI * 2);
        const lon = lon0 + (Math.cos(a) * r) / Math.max(0.2, Math.cos(lat0));
        const lat = lat0 + Math.sin(a) * r;
        const v = 110 + rng.next() * 145 * (1 - r * 4);
        const plot = (lo: number, la: number, val: number) => {
          const i = Math.floor(((((lo + Math.PI) / (Math.PI * 2)) % 1) + 1) % 1 * W);
          const j = Math.floor((0.5 - la / Math.PI) * H);
          if (j < 0 || j >= H) return;
          const k = j * W + i;
          if (sea[k]) return;
          light[k] = Math.max(light[k], val * 0.35);
          towns.push(lo, la, val / 255);
        };
        plot(lon, lat, v);
        if (r < 0.04) plot(lon + 0.004, lat, v * 0.7);
        // a road to the last town: a faint string of lights
        if (rng.chance(0.3)) for (let q = 1; q < 6; q++) plot(px0 + ((lon - px0) * q) / 6, py0 + ((lat - py0) * q) / 6, 70);
        px0 = lon;
        py0 = lat;
      }
    }
    return { W, H, albedo, sea, cloud, light, towns: new Float32Array(towns) };
  });
}

export interface WorldMap {
  W: number;
  H: number;
  albedo: Uint8ClampedArray;
  sea: Uint8Array;
  cloud: Uint8Array;
  light: Uint8Array;
  /** The towns, as (longitude, latitude, brightness) triples. */
  towns: Float32Array;
}

/**
 * A world's disc, `n` pixels across, lit from `light` (a direction in the view: x right, y up, z
 * toward us) by a star of colour `sun`: what it shows turns with `spin` (radians), over a map made
 * once. The lighting, the air at the limb and the glint on its seas are worked out once per disc;
 * each frame only looks the map up, so a turning world costs a few milliseconds.
 */
export class World {
  readonly n: number;
  private img: ImageData;
  readonly canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private lon0: Float32Array;
  private row: Int32Array;
  private day: Float32Array;
  private rim: Float32Array;
  private glint: Float32Array;
  private inside: Uint8Array;
  private last = NaN;
  constructor(
    n: number,
    private map: WorldMap,
    private o: { light: readonly [number, number, number]; sun: RGB; tilt?: number; air: RGB; lights: RGB; airThick?: number },
  ) {
    this.n = Math.max(8, Math.round(n));
    const N = this.n;
    this.canvas = canvas(N, N);
    this.g = this.canvas.getContext('2d')!;
    this.img = this.g.createImageData(N, N);
    this.lon0 = new Float32Array(N * N);
    this.row = new Int32Array(N * N);
    this.day = new Float32Array(N * N);
    this.rim = new Float32Array(N * N);
    this.glint = new Float32Array(N * N);
    this.inside = new Uint8Array(N * N);
    const [lx, ly, lz] = o.light;
    const ll = Math.hypot(lx, ly, lz) || 1;
    const tilt = o.tilt ?? 0.2;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const x = (i + 0.5) / N * 2 - 1;
        const y = 1 - (j + 0.5) / N * 2;
        const r2 = x * x + y * y;
        const k = j * N + i;
        if (r2 > 1) continue;
        this.inside[k] = 1;
        const z = Math.sqrt(1 - r2);
        // into the body's frame: its axis tilted toward us by `tilt`
        const by = y * ct + z * st;
        const bz = -y * st + z * ct;
        this.lon0[k] = Math.atan2(x, bz);
        this.row[k] = Math.min(map.H - 1, Math.max(0, Math.floor((0.5 - Math.asin(Math.max(-1, Math.min(1, by))) / Math.PI) * map.H)));
        const ndl = (x * lx + y * ly + z * lz) / ll;
        this.day[k] = ndl;
        // the air: brighter toward the limb on the lit side, a thin ring on the dark one
        this.rim[k] = Math.pow(1 - z, 2.6);
        // the star's glint on the sea: its light reflected toward us (R = 2(N·L)N − L, seen along z)
        const rz = 2 * ndl * z - lz / ll;
        this.glint[k] = ndl > 0 ? Math.pow(Math.max(0, rz), 60) : 0;
      }
    }
  }
  /** Paint the disc at `spin` (radians of rotation); the same spin paints the same pixels. */
  paint(spin: number): HTMLCanvasElement {
    if (spin === this.last) return this.canvas;
    this.last = spin;
    const { W, albedo, sea, cloud, light } = this.map;
    const d = this.img.data;
    const N = this.n;
    const [sr, sg, sb] = this.o.sun;
    const [ar, ag, ab] = this.o.air;
    const [cr, cg, cb] = this.o.lights;
    const thick = this.o.airThick ?? 1;
    const off = (spin / (Math.PI * 2)) * W;
    for (let k = 0; k < N * N; k++) {
      const p = k * 4;
      if (!this.inside[k]) {
        d[p + 3] = 0;
        continue;
      }
      let u = Math.floor(((this.lon0[k] + Math.PI) / (Math.PI * 2)) * W + off) % W;
      if (u < 0) u += W;
      const m = this.row[k] * W + u;
      const ndl = this.day[k];
      // daylight with a soft terminator (the air scatters a little past it)
      const lit = smooth(-0.08, 0.32, ndl) * (0.25 + 0.75 * Math.max(0, ndl));
      const cl = cloud[m] / 255;
      const a0 = albedo[m * 3] / 255;
      const a1 = albedo[m * 3 + 1] / 255;
      const a2 = albedo[m * 3 + 2] / 255;
      const s0 = a0 + (0.92 - a0) * cl;
      const s1 = a1 + (0.9 - a1) * cl;
      const s2 = a2 + (0.88 - a2) * cl;
      const night = 1 - smooth(-0.15, 0.05, ndl);
      const lamp = (light[m] / 255) * night * (1 - cl * 0.7);
      const rim = this.rim[k] * thick;
      const airLit = rim * (smooth(-0.35, 0.2, ndl) * 1.1 + 0.08);
      const gl = sea[m] ? this.glint[k] * (1 - cl) * 1.4 : 0;
      d[p] = Math.min(255, 255 * (s0 * sr * lit + ar * airLit + cr * lamp * 1.4 + sr * gl));
      d[p + 1] = Math.min(255, 255 * (s1 * sg * lit + ag * airLit + cg * lamp * 1.25 + sg * gl));
      d[p + 2] = Math.min(255, 255 * (s2 * sb * lit + ab * airLit + cb * lamp * 0.9 + sb * gl));
      d[p + 3] = 255;
    }
    this.g.putImageData(this.img, 0, 0);
    // the towns: sharp points on the night side, each where its place on the map has turned to
    const towns = this.map.towns;
    const tilt = this.o.tilt ?? 0.2;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const [lx, ly, lz] = this.o.light;
    const ll = Math.hypot(lx, ly, lz) || 1;
    const g = this.g;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < towns.length; i += 3) {
      const lon0 = towns[i] - spin;
      const lat = towns[i + 1];
      const bx = Math.cos(lat) * Math.sin(lon0);
      const by = Math.sin(lat);
      const bz = Math.cos(lat) * Math.cos(lon0);
      const y = by * ct - bz * st;
      const z = by * st + bz * ct;
      if (z <= 0.05) continue;
      const night = 1 - smooth(-0.12, 0.04, (bx * lx + y * ly + z * lz) / ll);
      if (night <= 0) continue;
      const v = towns[i + 2] * night * Math.min(1, z * 2.5);
      const x0 = ((bx + 1) / 2) * N;
      const y0 = ((1 - y) / 2) * N;
      g.fillStyle = `rgba(${Math.round(cr * 255)},${Math.round(cg * 235)},${Math.round(cb * 200)},${Math.min(1, v * 1.1)})`;
      const sz = Math.max(1, N / 700) * (v > 0.75 ? 1.6 : 1);
      g.fillRect(x0 - sz / 2, y0 - sz / 2, sz, sz);
    }
    g.restore();
    return this.canvas;
  }
}

// ------------------------------------------------------------------ fields of stars

export interface FieldStar {
  x: number;
  y: number;
  /** Brightness, 0..1. */
  b: number;
  T: number;
  /** A beat it goes out at (Infinity: it stays). */
  out: number;
}

/** A small round glow sprite in white, drawn tinted by the frame (made once per size). */
const dots = new Map<number, HTMLCanvasElement>();
export function dotSprite(r: number): HTMLCanvasElement {
  const k = Math.max(2, Math.round(r));
  let d = dots.get(k);
  if (d) return d;
  d = canvas(k * 2, k * 2);
  const g = d.getContext('2d')!;
  const grd = g.createRadialGradient(k, k, 0, k, k, k);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, k * 2, k * 2);
  dots.set(k, d);
  return d;
}

/**
 * A layer of the sky, painted once onto a canvas larger than the frame (so the camera can move
 * over it): `n` stars, most faint, a few bright with the four spikes a telescope's vanes give them,
 * coloured by temperature from `temps` (pairs of [weight, kelvin]); and, if asked, the band of the
 * galaxy's unresolved light with dark lanes of dust across it.
 */
export function paintSky(w: number, h: number, o: { seed: number; n: number; temps: readonly (readonly [number, number])[]; band?: { color: RGB; alpha: number; angle: number }; spikes?: number; scale: number }): Lazy<HTMLCanvasElement> {
  return new Lazy(function* () {
    const cv = canvas(w, h);
    const g = cv.getContext('2d')!;
    const rng = new Rng(o.seed);
    if (o.band) {
      // the band: noise in a strip, painted small and laid on smooth
      const bw = Math.max(16, Math.round(w / 6));
      const bh = Math.max(16, Math.round(h / 6));
      const small = canvas(bw, bh);
      const sg = small.getContext('2d')!;
      const img = sg.createImageData(bw, bh);
      const noise = new Perlin(o.seed + 5);
      const ca = Math.cos(o.band.angle);
      const sa = Math.sin(o.band.angle);
      for (let j = 0; j < bh; j++) {
        for (let i = 0; i < bw; i++) {
          const x = i / bw - 0.5;
          const y = j / bh - 0.5;
          const across = -x * sa + y * ca;
          const along = x * ca + y * sa;
          const core = Math.exp(-(across * across) / 0.012);
          const n = noise.fbm(along * 6, across * 14, 0.5, 5) * 0.5 + 0.5;
          const dust = smooth(0.48, 0.7, noise.fbm(along * 9 + 4, across * 30, 2.5, 4) * 0.5 + 0.5);
          const v = core * Math.pow(n, 1.6) * (1 - dust * 0.85);
          const k = (j * bw + i) * 4;
          img.data[k] = o.band.color[0] * 255;
          img.data[k + 1] = o.band.color[1] * 255;
          img.data[k + 2] = o.band.color[2] * 255;
          img.data[k + 3] = Math.min(255, v * 255 * o.band.alpha);
        }
        if (j % 32 === 31) yield;
      }
      sg.putImageData(img, 0, 0);
      g.imageSmoothingEnabled = true;
      g.drawImage(small, 0, 0, w, h);
    }
    const total = o.temps.reduce((a, [wt]) => a + wt, 0);
    const pick = () => {
      let r = rng.next() * total;
      for (const [wt, T] of o.temps) {
        r -= wt;
        if (r <= 0) return T * (0.92 + rng.next() * 0.16);
      }
      return o.temps[0][1];
    };
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < o.n; i++) {
      const x = rng.next() * w;
      const y = rng.next() * h;
      // a steep spread of brightness: thousands faint, a handful bright
      const b = Math.pow(rng.next(), 5.5);
      const c = kelvin(pick());
      const r = (0.6 + b * 4.2) * o.scale;
      if (r < 1.2) {
        g.fillStyle = css(c, 0.25 + b * 3);
        g.fillRect(x, y, Math.max(1, o.scale * 0.9), Math.max(1, o.scale * 0.9));
      } else {
        const s = dotSprite(r * 2.2);
        g.globalAlpha = Math.min(1, 0.35 + b * 1.4);
        // (a white sprite tinted by drawing it over a colour fill, through a small canvas)
        g.drawImage(tint(s, c), x - s.width / 2, y - s.height / 2);
        g.globalAlpha = 1;
      }
      if (i % 600 === 599) yield;
    }
    // the brightest few: the spikes of a telescope's vanes
    for (let i = 0; i < (o.spikes ?? 0); i++) {
      const x = rng.range(0.05, 0.95) * w;
      const y = rng.range(0.05, 0.95) * h;
      const c = kelvin(pick());
      const L = rng.range(18, 46) * o.scale;
      g.drawImage(tint(dotSprite(7 * o.scale), c), x - 7 * o.scale, y - 7 * o.scale);
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
      ]) {
        const grd = g.createLinearGradient(x - dx * L, y - dy * L, x + dx * L, y + dy * L);
        grd.addColorStop(0, css(c, 0));
        grd.addColorStop(0.5, css(c, 0.7));
        grd.addColorStop(1, css(c, 0));
        g.strokeStyle = grd;
        g.lineWidth = Math.max(1, 0.8 * o.scale);
        g.beginPath();
        g.moveTo(x - dx * L, y - dy * L);
        g.lineTo(x + dx * L, y + dy * L);
        g.stroke();
      }
    }
    return cv;
  });
}

/** A white sprite in a colour (cached per sprite and colour). */
const tints = new Map<string, HTMLCanvasElement>();
export function tint(s: HTMLCanvasElement, c: RGB): HTMLCanvasElement {
  const key = `${s.width}:${Math.round(c[0] * 31)},${Math.round(c[1] * 31)},${Math.round(c[2] * 31)}`;
  let t = tints.get(key);
  if (t) return t;
  t = canvas(s.width, s.height);
  const g = t.getContext('2d')!;
  g.drawImage(s, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = css([Math.round(c[0] * 31) / 31, Math.round(c[1] * 31) / 31, Math.round(c[2] * 31) / 31]);
  g.fillRect(0, 0, s.width, s.height);
  tints.set(key, t);
  return t;
}

// ------------------------------------------------------------------ a galaxy

/**
 * A spiral galaxy seen from above, `size` pixels across: a bulge, a disc and two arms of stipple,
 * each population its own colour (`arms`, `disc`, `bulge`: pairs of [weight, kelvin]), dark lanes of
 * dust on the arms' inner edges, a glow at the core. `young` (0..1) is how much of the arms' blue
 * is still there: in the Dusk, almost none.
 */
export function paintGalaxy(size: number, o: { seed: number; n: number; young: number; dust: number; scale: number; tiltY?: number }): Lazy<HTMLCanvasElement> {
  return new Lazy(function* () {
    const cv = canvas(size, size);
    const g = cv.getContext('2d')!;
    const rng = new Rng(o.seed);
    const R = size * 0.46;
    const cx = size / 2;
    const cy = size / 2;
    const tiltY = o.tiltY ?? 1;
    const glowCore = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.32);
    glowCore.addColorStop(0, 'rgba(255,190,140,0.55)');
    glowCore.addColorStop(0.4, 'rgba(255,150,100,0.16)');
    glowCore.addColorStop(1, 'rgba(255,120,80,0)');
    g.fillStyle = glowCore;
    g.save();
    g.translate(cx, cy);
    g.scale(1, tiltY);
    g.translate(-cx, -cy);
    g.fillRect(0, 0, size, size);
    g.restore();
    g.globalCompositeOperation = 'lighter';
    const pitch = 0.34; // tan of the arms' pitch angle (about 19°: an open spiral)
    const put = (x: number, y: number, T: number, a: number, s: number) => {
      const c = kelvin(T);
      g.fillStyle = css(c, a);
      g.fillRect(cx + x * R - s / 2, cy + y * R * tiltY - s / 2, s, s);
    };
    for (let i = 0; i < o.n; i++) {
      const pick = rng.next();
      if (pick < 0.14) {
        // the bulge: old, red, packed in
        const r = Math.abs(rng.next() + rng.next() + rng.next() - 1.5) * 0.16;
        const a = rng.range(0, Math.PI * 2);
        put(Math.cos(a) * r, Math.sin(a) * r * 0.8, rng.range(3000, 4200), 0.32, o.scale * rng.range(0.7, 1.3));
      } else if (pick < 0.62) {
        // the disc: an exponential spread of old stars, thinning out toward the edge
        const r = Math.min(1, -Math.log(1 - rng.next() * 0.985) * 0.2);
        const a = rng.range(0, Math.PI * 2);
        put(Math.cos(a) * r, Math.sin(a) * r, rng.range(2700, 3900), (0.16 + rng.next() * 0.18) * (1 - r * 0.6), o.scale * rng.range(0.6, 1.1));
      } else {
        // the arms: a log spiral, two of them, broad, the stars scattered off it (more near its middle)
        const arm = rng.next() < 0.5 ? 0 : Math.PI;
        const r = 0.1 + Math.pow(rng.next(), 0.85) * 0.85;
        const th = Math.log(r / 0.1) / pitch + arm;
        const sc = (rng.next() + rng.next() + rng.next() - 1.5) * 0.16 * (0.3 + r);
        const x = Math.cos(th) * r + Math.cos(th + Math.PI / 2) * sc;
        const y = Math.sin(th) * r + Math.sin(th + Math.PI / 2) * sc;
        const young = rng.next() < o.young * 0.45;
        put(x, y, young ? rng.range(9000, 22000) : rng.range(2800, 3600), (young ? 0.55 : 0.26) * (1 - r * 0.45), o.scale * (young ? rng.range(0.9, 1.8) : rng.range(0.6, 1.1)));
      }
      if (i % 2500 === 2499) yield;
    }
    // dust: dark strokes along the arms' inner edges
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 1400 * o.dust; i++) {
      const arm = rng.next() < 0.5 ? 0 : Math.PI;
      const r = 0.14 + Math.pow(rng.next(), 0.9) * 0.75;
      const th = Math.log(r / 0.1) / pitch + arm - 0.22;
      const x = cx + Math.cos(th) * r * R;
      const y = cy + Math.sin(th) * r * R * tiltY;
      g.fillStyle = `rgba(3,3,4,${0.05 + rng.next() * 0.1})`;
      g.beginPath();
      g.ellipse(x, y, R * rng.range(0.008, 0.03), R * rng.range(0.004, 0.012), th + Math.PI / 2, 0, Math.PI * 2);
      g.fill();
      if (i % 400 === 399) yield;
    }
    return cv;
  });
}

/**
 * An old elliptical galaxy, what merging galaxies become (the game's own is the remnant of
 * ancestral galaxies fallen together round the Heart): a smooth swarm of old red stars packed
 * toward the core (a de Vaucouleurs-like fall-off), a little flattened, with the faint tidal
 * streams and shells mergers leave, and globular clusters scattered round it. `size` pixels across.
 */
export function paintElliptical(size: number, o: { seed: number; n: number; scale: number; flat?: number; angle?: number }): Lazy<HTMLCanvasElement> {
  return new Lazy(function* () {
    const cv = canvas(size, size);
    const g = cv.getContext('2d')!;
    const rng = new Rng(o.seed);
    const R = size * 0.46;
    const cx = size / 2;
    const cy = size / 2;
    const flat = o.flat ?? 0.72;
    const ca = Math.cos(o.angle ?? 0.35);
    const sa = Math.sin(o.angle ?? 0.35);
    g.globalCompositeOperation = 'lighter';
    const put = (x: number, y: number, T: number, a: number, s: number) => {
      // flattened and turned
      const px = x * ca - y * flat * sa;
      const py = x * sa + y * flat * ca;
      g.fillStyle = css(kelvin(T), a);
      g.fillRect(cx + px * R - s / 2, cy + py * R - s / 2, s, s);
    };
    // its light: a smooth de Vaucouleurs profile, I ∝ exp(−7.67((r/Re)^¼ − 1)), painted at half
    // size and laid on smooth, warmer at the core, toned so the core does not burn out
    {
      const n = Math.max(32, Math.round(size / 2));
      const small = canvas(n, n);
      const sg = small.getContext('2d')!;
      const img = sg.createImageData(n, n);
      const noise = new Perlin(o.seed + 77);
      const Re = 0.2;
      const toned = (I: number) => Math.asinh(I * 8) / Math.asinh(8 * 2200);
      for (let j = 0; j < n; j++) {
        for (let i = 0; i < n; i++) {
          const x = (i / n) * 2 - 1;
          const y = (j / n) * 2 - 1;
          // into the galaxy's own axes (turned, flattened)
          const u = (x * ca + y * sa) / 0.92;
          const v = (-x * sa + y * ca) / (0.92 * flat);
          const r = Math.hypot(u, v) + 1e-4;
          const I = Math.exp(-7.67 * (Math.pow(r / Re, 0.25) - 1));
          const val = toned(I) * (1 + 0.06 * noise.fbm(x * 5, y * 5, 0.5, 3));
          const warm = Math.min(1, r * 2.2);
          const k = (j * n + i) * 4;
          img.data[k] = 255;
          img.data[k + 1] = Math.round(mix(214, 150, warm));
          img.data[k + 2] = Math.round(mix(170, 96, warm));
          // (faded out well inside the canvas, so no edge of it shows)
          img.data[k + 3] = Math.round(255 * Math.min(1, val * 1.25) * (1 - smooth(0.5, 0.8, r)));
        }
        if (j % 32 === 31) yield;
      }
      sg.putImageData(img, 0, 0);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.imageSmoothingEnabled = true;
      g.drawImage(small, 0, 0, size, size);
      g.restore();
    }
    // the stars resolved out in its halo: the giants of its old population
    for (let i = 0; i < o.n * 0.35; i++) {
      const r = Math.min(1.05, 0.12 * Math.pow(-Math.log(1 - rng.next() * 0.9995), 1.5));
      const a = rng.range(0, Math.PI * 2);
      const alpha = (0.1 + 0.3 * rng.next()) * smooth(0.06, 0.3, r) * (1 - r * 0.5);
      if (alpha < 0.02) continue;
      put(Math.cos(a) * r, Math.sin(a) * r, rng.range(2900, 3900), alpha, o.scale * rng.range(0.6, 1.25));
      if (i % 3000 === 2999) yield;
    }
    // the streams: long arcs of stars torn from the galaxies that fell in, and shells on one side
    for (let s = 0; s < 4; s++) {
      const r0 = rng.range(0.45, 0.95);
      const a0 = rng.range(0, Math.PI * 2);
      const len = rng.range(0.8, 1.8);
      const ecc = rng.range(0.55, 0.9);
      for (let i = 0; i < 900 * (o.n / 60000); i++) {
        const u = rng.next();
        const a = a0 + u * len;
        const rr = r0 * (1 + 0.06 * (rng.next() + rng.next() - 1)) * (1 - 0.15 * u);
        put(Math.cos(a) * rr, Math.sin(a) * rr * ecc, rng.range(2900, 3500), 0.12 * Math.sin(Math.PI * u), o.scale * rng.range(0.6, 1));
      }
      yield;
    }
    for (let s = 0; s < 3; s++) {
      const rr = 0.32 + s * 0.13;
      for (let i = 0; i < 500 * (o.n / 60000); i++) {
        const a = Math.PI * 0.85 + rng.range(-0.5, 0.5);
        const r = rr * (1 + 0.012 * (rng.next() + rng.next() - 1));
        put(Math.cos(a) * r, Math.sin(a) * r, rng.range(3000, 3600), 0.05 * Math.max(0, 1 - Math.abs(a - Math.PI * 0.85) * 1.8), o.scale * 0.8);
      }
    }
    // globular clusters: small tight balls of old stars, all round
    for (let k = 0; k < 16; k++) {
      const r = rng.range(0.25, 1);
      const a = rng.range(0, Math.PI * 2);
      const x0 = Math.cos(a) * r;
      const y0 = Math.sin(a) * r;
      for (let i = 0; i < 70; i++) {
        const d = 0.006 * Math.pow(rng.next(), 1.8);
        const b = rng.range(0, Math.PI * 2);
        put(x0 + Math.cos(b) * d, y0 + Math.sin(b) * d, rng.range(3300, 4800), 0.5, o.scale * 0.9);
      }
    }
    return cv;
  });
}

/**
 * A brown dwarf's disc, `px` across: never lit, glowing only by its own heat (a deep magenta-red
 * at about 1,000 K, as the game's enhanced light shows it), banded like a cold Jupiter by its fast
 * spin, the bands torn at their edges, darker toward the limb.
 */
export function paintBanded(px: number, o: { seed: number; T: number; bands?: number; tilt?: number }): Lazy<HTMLCanvasElement> {
  return new Lazy(function* () {
    const n = Math.max(8, Math.round(px));
    const cv = canvas(n, n);
    const g = cv.getContext('2d')!;
    const img = g.createImageData(n, n);
    const noise = new Perlin(o.seed);
    const base = kelvin(Math.max(1000, o.T));
    const bands = o.bands ?? 9;
    const ct = Math.cos(o.tilt ?? 0.25);
    const st = Math.sin(o.tilt ?? 0.25);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.5) / n) * 2 - 1;
        const y = ((j + 0.5) / n) * 2 - 1;
        const r2 = x * x + y * y;
        if (r2 > 1) continue;
        const z = Math.sqrt(1 - r2);
        // latitude in the dwarf's own frame (its axis tipped a little)
        const ly = -y * ct + z * st;
        const turb = noise.fbm(x * 3, ly * 2, z * 3, 4);
        const band = 0.5 + 0.5 * Math.sin((ly + 0.12 * turb) * bands * Math.PI);
        const storm = Math.max(0, noise.noise(x * 9, ly * 9, z * 9) - 0.45) * 1.4;
        const v = (0.55 + 0.35 * band + 0.25 * storm) * (0.25 + 0.75 * Math.pow(z, 0.6));
        const k = (j * n + i) * 4;
        img.data[k] = Math.min(255, base[0] * 210 * v);
        img.data[k + 1] = Math.min(255, base[1] * 120 * v + 18 * v);
        img.data[k + 2] = Math.min(255, base[2] * 140 * v + 40 * v);
        img.data[k + 3] = Math.round(255 * clamp01((1 - Math.sqrt(r2)) * n * 0.5));
      }
      if (j % 24 === 23) yield;
    }
    g.putImageData(img, 0, 0);
    return cv;
  });
}

/**
 * A black hole lensing what lies behind it, painted from a background canvas: each pixel of the
 * patch shows the background at the point a light ray through it came from (the point-lens
 * equation, β = θ − θE²/θ: everything near the hole is bent outward into a ring), black inside
 * its shadow (2.6 times its horizon's radius), with the photon ring's thin glow at the shadow's
 * edge. `x, y` is the hole's place on the background canvas, `rs` its shadow's radius there, and
 * the patch reaches `reach` shadow-radii out; the patch is returned centred on the hole.
 */
export function paintLens(bg: HTMLCanvasElement, x: number, y: number, rs: number, o: { reach?: number; ring: RGB; ringGain?: number }): Lazy<HTMLCanvasElement> {
  return new Lazy(function* () {
    const reach = o.reach ?? 7;
    const R = Math.ceil(rs * reach);
    const n = R * 2;
    const src = bg.getContext('2d')!.getImageData(Math.round(x - R * 3), Math.round(y - R * 3), R * 6, R * 6);
    const sw = src.width;
    const sh = src.height;
    const out = canvas(n, n);
    const g = out.getContext('2d')!;
    const img = g.createImageData(n, n);
    // Einstein radius: the ring the background straight behind is bent into (a little outside the shadow)
    const thE = rs * 1.6;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const dx = i + 0.5 - R;
        const dy = j + 0.5 - R;
        const th = Math.hypot(dx, dy);
        const k = (j * n + i) * 4;
        const edge = 1 - smooth(R * 0.82, R, th);
        if (th < rs) {
          img.data[k + 3] = Math.round(255 * edge);
          continue;
        }
        const beta = th - (thE * thE) / th;
        const sx = Math.round(R * 3 + (dx / th) * beta);
        const sy = Math.round(R * 3 + (dy / th) * beta);
        let r = 0,
          gg = 0,
          b = 0;
        if (sx >= 0 && sy >= 0 && sx < sw && sy < sh) {
          const p = (sy * sw + sx) * 4;
          // (the magnification near the ring brightens what is bent there)
          const mag = Math.min(3, 1 / Math.max(0.2, 1 - Math.pow(thE / th, 4)));
          const a = src.data[p + 3] / 255;
          r = src.data[p] * a * mag;
          gg = src.data[p + 1] * a * mag;
          b = src.data[p + 2] * a * mag;
        }
        // the photon ring: a thin bright line at the shadow's edge
        const ring = Math.exp(-Math.pow((th - rs * 1.03) / (rs * 0.035), 2)) * (o.ringGain ?? 1);
        img.data[k] = Math.min(255, r + o.ring[0] * 255 * ring);
        img.data[k + 1] = Math.min(255, gg + o.ring[1] * 255 * ring);
        img.data[k + 2] = Math.min(255, b + o.ring[2] * 255 * ring);
        img.data[k + 3] = Math.round(255 * edge);
      }
      if (j % 32 === 31) yield;
    }
    g.putImageData(img, 0, 0);
    return out;
  });
}
