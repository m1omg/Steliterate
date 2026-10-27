import * as THREE from 'three';
import { Rng } from '../game/rng';
import type { Quality } from './engine';

// What is not matter, drawn (the new version, part 3-7). A leptonic settlement is minds and works
// held by fields in structures of electrons and positrons, so it is drawn as its fields: thin
// glowing filaments along the lines of a dipole field, a standing wave round its equator, and
// sparse motes of plasma trapped in it, bouncing between the mirror points and drifting round as
// charged particles do in a planet's radiation belts. Additive, translucent, breathing slowly on
// elapsed time. Minds woven through the positronium are vast, faint ellipses across the whole
// system (positroniumVeil); a settlement written into a horizon rides its hole's photon ring
// (GLOW_FRAG's uWrit). All of it is speculation, as the Codex says: what such things might look
// like, not anything anyone has seen.

/** How a civilization's fields are laid out: its own way of holding itself together. */
export type FieldStyle = 'ours' | 'chorus' | 'lattice' | 'archive';

export interface FieldOpts {
  /** The radius it is held around: a world's, or a small core of its own in the Deep. */
  core: number;
  /** How far out its widest field line reaches (the line's L, from the centre). */
  reach: number;
  /** The filaments' and motes' colour (the age's accent). */
  color: THREE.Color;
  /** The standing wave's: whose it is. */
  mark: THREE.Color;
  quality: Quality;
  seed: number;
  style?: FieldStyle;
  /** What stands there: structures that house minds (more shells), Field Stores (current loops), Burst Catchers (a cage), Positronium Nets (lines strung outward). */
  minds?: number;
  stores?: number;
  catchers?: number;
  nets?: number;
}

export interface FieldRig {
  group: THREE.Group;
  /** The standing wave round its equator: the ring that says whose it is (the selection circle takes its place). */
  ring: THREE.Mesh;
  mats: THREE.ShaderMaterial[];
  /** What was drawn, for the checks: filament segments, motes, current loops. */
  counts: { segments: number; motes: number; loops: number };
}

/** Brighter than white only where bloom runs (Medium and High): on Low it would only clip. */
export const fieldGain = (q: Quality) => (q === 'low' ? 1.0 : 1.7);

const COUNTS: Record<Quality, { azimuths: number; shells: number; segs: number; motes: number }> = {
  low: { azimuths: 6, shells: 2, segs: 28, motes: 40 },
  medium: { azimuths: 9, shells: 3, segs: 40, motes: 110 },
  high: { azimuths: 12, shells: 3, segs: 56, motes: 220 },
};

const FILAMENT_VERT = /* glsl */ `
  attribute float aT;
  attribute float aSeed;
  varying float vT;
  varying float vSeed;
  void main() {
    vT = aT;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** A field line: it breathes on its own (a Chorus's all together), and a faint pulse runs along it. */
const FILAMENT_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uGain;
  uniform float uSync;
  uniform float uFaint;
  varying float vT;
  varying float vSeed;
  void main() {
    float s = mix(vSeed, 0.37, uSync);
    float breath = 0.55 + 0.45 * sin(uTime * 0.55 + s * 6.2832);
    float pulse = smoothstep(0.86, 1.0, sin((vT * 2.0 - uTime * 0.07 + s) * 6.2832));
    float ends = smoothstep(0.0, 0.18, vT) * smoothstep(1.0, 0.82, vT);
    float a = (0.22 + 0.5 * pulse) * breath * ends * uFaint;
    gl_FragColor = vec4(uColor * a * uGain, a);
  }
`;

const RING_VERT = /* glsl */ `
  varying float vAng;
  void main() {
    vAng = atan(position.y, position.x);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/**
 * Round a torus: a standing wave (uModes nodes that stay dark, antinodes swelling and fading
 * together), or with uModes 0 a current loop, a brighter stretch running round it.
 */
const RING_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uGain;
  uniform float uModes;
  uniform float uPhase;
  varying float vAng;
  void main() {
    float a;
    if (uModes > 0.5) {
      float w = cos(vAng * uModes) * cos(uTime * 0.9 + uPhase);
      a = 0.25 + 0.75 * abs(w);
    } else {
      float run = fract(vAng / 6.2832 - uTime * 0.05 + uPhase);
      a = 0.3 + 0.7 * smoothstep(0.75, 1.0, run);
    }
    gl_FragColor = vec4(uColor * a * uGain * 0.9, a * 0.85);
  }
`;

const MOTE_VERT = /* glsl */ `
  attribute vec4 aMote; // x: its field line's L, y: azimuth, z: phase, w: how far it bounces (0..1)
  uniform float uTime;
  uniform float uCore;
  varying float vFlick;
  void main() {
    float L = aMote.x;
    // a dipole's field line, r = L sin^2(theta): the mote bounces between its mirror points and drifts round
    float th0 = asin(sqrt(clamp(uCore / L, 0.0, 0.98)));
    float span = 1.5707963 - th0;
    float th = 1.5707963 + sin(uTime * (0.45 + 0.3 * aMote.z) + aMote.z * 6.2832) * span * aMote.w;
    float phi = aMote.y + uTime * 0.04 * (0.4 + aMote.z);
    float s = sin(th);
    float r = L * s * s;
    vec3 p = vec3(r * s * cos(phi), r * cos(th), r * s * sin(phi));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(26.0 / -mv.z, 1.0, 4.0);
    vFlick = 0.5 + 0.5 * sin(uTime * 2.6 + aMote.z * 41.0);
  }
`;

const MOTE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uGain;
  varying float vFlick;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = (1.0 - d * 2.0) * (0.35 + 0.65 * vFlick);
    gl_FragColor = vec4(uColor * a * uGain, a);
  }
`;

function additive(vert: string, frag: string, uniforms: Record<string, THREE.IUniform>, side: THREE.Side = THREE.FrontSide): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side });
}

/** Line segments with a running parameter (aT, 0..1 along each line) and a seed per line. */
function lines(segs: number[][], seeds: number[], ts: number[][]): THREE.BufferGeometry {
  const pos: number[] = [];
  const t: number[] = [];
  const sd: number[] = [];
  segs.forEach((pts, i) => {
    for (let j = 0; j + 1 < pts.length / 3; j++) {
      pos.push(pts[j * 3], pts[j * 3 + 1], pts[j * 3 + 2], pts[j * 3 + 3], pts[j * 3 + 4], pts[j * 3 + 5]);
      t.push(ts[i][j], ts[i][j + 1]);
      sd.push(seeds[i], seeds[i]);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(sd, 1));
  return g;
}

function filaments(g: THREE.BufferGeometry, color: THREE.Color, gain: number, sync: number, faint = 1): { obj: THREE.LineSegments; mat: THREE.ShaderMaterial } {
  const mat = additive(FILAMENT_VERT, FILAMENT_FRAG, { uTime: { value: 0 }, uColor: { value: color.clone() }, uGain: { value: gain }, uSync: { value: sync }, uFaint: { value: faint } });
  return { obj: new THREE.LineSegments(g, mat), mat };
}

/** A circle of `n` points round the y axis (radius r, at height y), as a flat list. */
function circle(r: number, y: number, n: number): { pts: number[]; ts: number[] } {
  const pts: number[] = [];
  const ts: number[] = [];
  for (let j = 0; j <= n; j++) {
    const a = (j / n) * Math.PI * 2;
    pts.push(r * Math.cos(a), y, r * Math.sin(a));
    ts.push(j / n);
  }
  return { pts, ts };
}

/**
 * A cage of field lines round a sphere of radius r: meridians through the poles and a few
 * parallels. A Burst Catcher's buffers round a settlement, a Bastion Shell round its hole.
 */
export function fieldCage(r: number, color: THREE.Color, quality: Quality, seed: number, faint = 0.6): { obj: THREE.LineSegments; mat: THREE.ShaderMaterial; segments: number } {
  const rng = new Rng(seed);
  const meridians = quality === 'low' ? 6 : quality === 'medium' ? 9 : 12;
  const n = quality === 'low' ? 32 : 64;
  const segs: number[][] = [];
  const ts: number[][] = [];
  const seeds: number[] = [];
  for (let i = 0; i < meridians; i++) {
    const phi = (i / meridians) * Math.PI;
    const pts: number[] = [];
    const tt: number[] = [];
    for (let j = 0; j <= n; j++) {
      const th = (j / n) * Math.PI * 2;
      pts.push(r * Math.sin(th) * Math.cos(phi), r * Math.cos(th), r * Math.sin(th) * Math.sin(phi));
      tt.push(j / n);
    }
    segs.push(pts);
    ts.push(tt);
    seeds.push(rng.next());
  }
  for (const y of [-0.5, 0, 0.5]) {
    const c = circle(r * Math.sqrt(1 - y * y), r * y, n);
    segs.push(c.pts);
    ts.push(c.ts);
    seeds.push(rng.next());
  }
  const g = lines(segs, seeds, ts);
  const { obj, mat } = filaments(g, color, fieldGain(quality), 0, faint);
  return { obj, mat, segments: g.getAttribute('position').count / 2 };
}

/**
 * A settlement's fields: filaments along a tilted dipole's lines from just above its core out to
 * `reach`, a standing wave round its equator (in `mark`, whose it is), motes trapped in it, and
 * what stands there drawn into it. Its counts follow the quality setting; nothing in it moves but
 * on elapsed time (`uTime`).
 */
export function fieldLattice(o: FieldOpts): FieldRig {
  const rng = new Rng(o.seed);
  const n = COUNTS[o.quality];
  const style = o.style ?? 'ours';
  const gain = fieldGain(o.quality);
  const group = new THREE.Group();
  const mats: THREE.ShaderMaterial[] = [];
  const rMin = o.core * 1.05;
  // more shells for more of what houses minds, up to three more
  const shells = n.shells + Math.min(o.quality === 'low' ? 1 : 3, o.minds ?? 0);
  const segs: number[][] = [];
  const ts: number[][] = [];
  const seeds: number[] = [];
  for (let k = 0; k < shells; k++) {
    const L = rMin + (o.reach - rMin) * ((k + 1) / shells);
    const th0 = Math.asin(Math.sqrt(Math.min(0.98, rMin / L)));
    for (let i = 0; i < n.azimuths; i++) {
      // the Lattice lays its lines out exactly; everyone else a little unevenly
      const jitter = style === 'lattice' ? 0 : rng.range(-0.18, 0.18);
      const phi = ((i + (k % 2) * 0.5) / n.azimuths) * Math.PI * 2 + jitter;
      const pts: number[] = [];
      const tt: number[] = [];
      for (let j = 0; j <= n.segs; j++) {
        const t = j / n.segs;
        const th = th0 + (Math.PI - 2 * th0) * t;
        const s = Math.sin(th);
        const r = L * s * s;
        pts.push(r * s * Math.cos(phi), r * Math.cos(th), r * s * Math.sin(phi));
        tt.push(t);
      }
      segs.push(pts);
      ts.push(tt);
      seeds.push(rng.next());
    }
  }
  // Positronium Nets: lines strung outward, through the widest atoms
  const nets = Math.min(4, o.nets ?? 0) * (o.quality === 'low' ? 3 : 6);
  for (let i = 0; i < nets; i++) {
    const d = new THREE.Vector3(rng.range(-1, 1), rng.range(-0.4, 0.4), rng.range(-1, 1)).normalize();
    const pts: number[] = [];
    const tt: number[] = [];
    for (let j = 0; j <= 8; j++) {
      const r = o.reach * (1 + 3 * (j / 8));
      pts.push(d.x * r, d.y * r, d.z * r);
      tt.push(j / 8);
    }
    segs.push(pts);
    ts.push(tt);
    seeds.push(rng.next());
  }
  const g = lines(segs, seeds, ts);
  const fil = filaments(g, o.color, gain, style === 'chorus' ? 1 : 0);
  mats.push(fil.mat);
  group.add(fil.obj);
  let segments = g.getAttribute('position').count / 2;
  // the standing wave round the equator, a little outside the core
  const R = o.core + (o.reach - o.core) * 0.35;
  const tube = Math.max(0.02, o.core * 0.012 + 0.012);
  const rm = additive(RING_VERT, RING_FRAG, { uTime: { value: 0 }, uColor: { value: o.mark.clone() }, uGain: { value: gain }, uModes: { value: style === 'lattice' ? 12 : style === 'chorus' ? 3 : 6 }, uPhase: { value: 0 } }, THREE.DoubleSide);
  mats.push(rm);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, tube, 6, 128), rm);
  ring.rotation.x = Math.PI / 2;
  ring.userData.markColor = o.mark.clone();
  group.add(ring);
  // Field Stores: energy in the fields of currents, a loop each, at its own tilt
  const loops = Math.min(4, o.stores ?? 0);
  for (let i = 0; i < loops; i++) {
    const lm = additive(RING_VERT, RING_FRAG, { uTime: { value: 0 }, uColor: { value: o.color.clone().lerp(o.mark, 0.35) }, uGain: { value: gain }, uModes: { value: 0 }, uPhase: { value: i * 0.29 } }, THREE.DoubleSide);
    mats.push(lm);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(o.core + (o.reach - o.core) * (0.55 + 0.12 * i), tube * 0.8, 6, 96), lm);
    loop.rotation.set(Math.PI / 2 + rng.range(-0.9, 0.9), rng.range(0, Math.PI), 0);
    group.add(loop);
  }
  // Burst Catchers: buffers for the flashes, a wide cage round it all
  if ((o.catchers ?? 0) > 0) {
    const cage = fieldCage(o.reach * 1.35, o.color, o.quality, o.seed + 7, 0.45);
    mats.push(cage.mat);
    group.add(cage.obj);
    segments += cage.segments;
  }
  // motes trapped in the field
  const mp: number[] = [];
  const ma: number[] = [];
  for (let i = 0; i < n.motes; i++) {
    mp.push(0, 0, 0);
    ma.push(rMin + (o.reach - rMin) * rng.range(0.25, 1), rng.range(0, Math.PI * 2), rng.next(), rng.range(0.2, 0.95));
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3));
  pg.setAttribute('aMote', new THREE.Float32BufferAttribute(ma, 4));
  const pm = additive(MOTE_VERT, MOTE_FRAG, { uTime: { value: 0 }, uCore: { value: rMin }, uColor: { value: o.color.clone().lerp(new THREE.Color(1, 1, 1), 0.35) }, uGain: { value: gain } });
  mats.push(pm);
  const pts = new THREE.Points(pg, pm);
  pts.frustumCulled = false;
  group.add(pts);
  group.userData.field = true;
  return { group, ring, mats, counts: { segments, motes: n.motes, loops } };
}

const VEIL_VERT = /* glsl */ `
  attribute float aT;
  attribute float aSeed;
  varying float vT;
  varying float vRing;
  void main() {
    vT = aT;
    vRing = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** A slow brightening runs round each orbit, never in step on two of them. */
const VEIL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vT;
  varying float vRing;
  void main() {
    float run = 0.6 + 0.4 * sin((vT - uTime * 0.004 * (1.0 + vRing * 0.3)) * 6.2832 + vRing * 1.7);
    float a = uOpacity * run;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/**
 * The positronium, across a whole system: a few vast, faint ellipses about a centre far outside
 * it, the orbits of electron–positron pairs wider than today's observable universe slowly
 * shrinking, barely moving. Brighter where minds are woven through it (`opacity`).
 */
export function positroniumVeil(o: { seed: number; quality: Quality; color: THREE.Color; opacity: number }): { obj: THREE.LineSegments; mat: THREE.ShaderMaterial; rings: number } {
  const rng = new Rng(o.seed);
  const rings = o.quality === 'low' ? 3 : o.quality === 'medium' ? 5 : 7;
  const n = o.quality === 'low' ? 160 : 320;
  const a0 = rng.range(520, 700);
  const e = rng.range(0.35, 0.55);
  const segs: number[][] = [];
  const ts: number[][] = [];
  const seeds: number[] = [];
  for (let k = 0; k < rings; k++) {
    // each orbit a little smaller than the last, as the pairs spiral in
    const a = a0 * Math.pow(0.86, k);
    const b = a * Math.sqrt(1 - e * e);
    const pts: number[] = [];
    const tt: number[] = [];
    for (let j = 0; j <= n; j++) {
      const t = (j / n) * Math.PI * 2;
      pts.push(a * Math.cos(t), 0, b * Math.sin(t));
      tt.push(j / n);
    }
    segs.push(pts);
    ts.push(tt);
    seeds.push(k);
  }
  const mat = additive(VEIL_VERT, VEIL_FRAG, { uTime: { value: 0 }, uColor: { value: o.color.clone() }, uOpacity: { value: o.opacity } });
  const obj = new THREE.LineSegments(lines(segs, seeds, ts), mat);
  obj.frustumCulled = false;
  // their common centre lies far outside the system, along the orbits' long axis, so the middle
  // ones pass right through it as long, slow arcs, and the rest beside it
  obj.rotation.set(rng.range(-0.35, 0.35), rng.range(0, Math.PI * 2), rng.range(-0.2, 0.2));
  obj.position.copy(new THREE.Vector3(a0 * 0.6, rng.range(-20, 20), 0).applyEuler(obj.rotation));
  obj.userData.veil = true;
  return { obj, mat, rings };
}
