import * as THREE from 'three';
import type { Quality } from './engine';

// A nebula seen up close (1 Nov, the player: the system view's nebula was "just pink points … please
// make them look prettier and more realistic"). Where it had three soft glows, whose noise ran out
// from the middle as rays, it is now a cloud: a sphere of gas the view marches through, pixel by
// pixel, adding the light the gas gives off and taking away the light its dust swallows, so that it
// has depth and parallax as the camera turns. In it:
// - filaments and knots of gas (folded noise, warped so that it streams), thinning to nothing at the
//   cloud's edge, glowing the rose of hydrogen with patches of blue where dust scatters starlight;
// - a dense, dark core where the star will form, a globule of dust that hides the stars behind it,
//   its rim lit (a bright-rimmed globule, as in the Rosette or IC 1396);
// - as the star's birth nears, a dull red glow deep inside, seen through the dust: the protostar,
//   as infrared shows one (to the eye it would be hidden).
// Thin gas (interregnum.ts thinGas) is the same, sparse and grey, with no core.
// A bend: few hot stars are left at 10¹² years to make hydrogen glow; the rose is kept faint.
// The noise is baked once into a small 3D texture (three reads a step), the march's steps set by the
// quality setting, and it is drawn at 0.62 of the screen's resolution or less (cloudScale), as soft
// gas loses little by it: under half the work, a seventh on Low, for phones and the software renderer. It drifts on elapsed time only (uTime).

const N = 64;

let baked: THREE.Data3DTexture | null = null;

/**
 * Tileable 3D gradient noise, baked once into 64³ texels (deterministic): red holds three octaves
 * (lattices of 4, 8 and 16 cells a side), green, blue and alpha one octave each of their own (4
 * cells), for the warp and the colour. So the march reads two or three texels a step, not eight.
 */
function noiseTexture(): THREE.Data3DTexture {
  if (baked) return baked;
  let h = 0x6d2b79f5;
  const next = () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** One octave's gradients on a lattice of `cells` a side. */
  const lattice = (cells: number) => {
    const g = new Float32Array(cells * cells * cells * 3);
    for (let i = 0; i < cells * cells * cells; i++) {
      const z = next() * 2 - 1;
      const a = next() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      g[i * 3] = r * Math.cos(a);
      g[i * 3 + 1] = r * Math.sin(a);
      g[i * 3 + 2] = z;
    }
    return { g, cells };
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  /** Perlin noise at texel (x, y, z) of an octave, wrapping (about −0.7 to 0.7). */
  const perlin = (L: { g: Float32Array; cells: number }, x: number, y: number, z: number) => {
    const c = L.cells;
    const s = c / N;
    const px = x * s;
    const py = y * s;
    const pz = z * s;
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    const iz = Math.floor(pz);
    const fx = px - ix;
    const fy = py - iy;
    const fz = pz - iz;
    const dot = (i: number, j: number, k: number, dx: number, dy: number, dz: number) => {
      const o = ((((iz + k) % c) * c + ((iy + j) % c)) * c + ((ix + i) % c)) * 3;
      return L.g[o] * dx + L.g[o + 1] * dy + L.g[o + 2] * dz;
    };
    const u = fade(fx);
    const v = fade(fy);
    const w = fade(fz);
    return lerp(
      lerp(lerp(dot(0, 0, 0, fx, fy, fz), dot(1, 0, 0, fx - 1, fy, fz), u), lerp(dot(0, 1, 0, fx, fy - 1, fz), dot(1, 1, 0, fx - 1, fy - 1, fz), u), v),
      lerp(lerp(dot(0, 0, 1, fx, fy, fz - 1), dot(1, 0, 1, fx - 1, fy, fz - 1), u), lerp(dot(0, 1, 1, fx, fy - 1, fz - 1), dot(1, 1, 1, fx - 1, fy - 1, fz - 1), u), v),
      w,
    );
  };
  const o4 = lattice(4);
  const o8 = lattice(8);
  const o16 = lattice(16);
  const wx = lattice(4);
  const wy = lattice(4);
  const wz = lattice(4);
  const byte = (n: number) => Math.max(0, Math.min(255, Math.round((0.5 + n * 0.75) * 255)));
  const data = new Uint8Array(N * N * N * 4);
  for (let z = 0; z < N; z++) {
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = ((z * N + y) * N + x) * 4;
        data[i] = byte((perlin(o4, x, y, z) * 0.57 + perlin(o8, x, y, z) * 0.29 + perlin(o16, x, y, z) * 0.14) * 1.25);
        data[i + 1] = byte(perlin(wx, x, y, z));
        data[i + 2] = byte(perlin(wy, x, y, z));
        data[i + 3] = byte(perlin(wz, x, y, z));
      }
    }
  }
  const tex = new THREE.Data3DTexture(data, N, N, N);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.wrapR = THREE.RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  baked = tex;
  return tex;
}

const VERT = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler3D uNoise;
  uniform float uTime;
  uniform float uR;
  uniform vec3 uCenter;
  uniform vec3 uSeed;
  uniform float uDensity;
  uniform float uCore;
  uniform float uDust;
  uniform float uGlow;
  uniform float uBirth;
  uniform vec3 uRose;
  uniform vec3 uBlue;
  uniform vec3 uPink;
  uniform vec3 uTeal;
  uniform vec3 uWarm;
  varying vec3 vWorld;

  vec4 tex(vec3 p) { return texture(uNoise, p); }

  void main() {
    vec3 ro = cameraPosition;
    vec3 rd = normalize(vWorld - cameraPosition);
    // the ray's way through the cloud's sphere
    vec3 oc = ro - uCenter;
    float b = dot(oc, rd);
    float c = dot(oc, oc) - uR * uR;
    float disc = b * b - c;
    if (disc <= 0.0) discard;
    float sq = sqrt(disc);
    float t0 = max(-b - sq, 0.0);
    float t1 = -b + sq;
    if (t1 <= t0) discard;
    float dt = (t1 - t0) / float(STEPS);
    // a fixed jitter per pixel (interleaved gradient noise: the finest grain), so the steps leave no bands
    float jit = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
    float t = t0 + dt * jit;
    float du = dt / uR;
    vec3 drift = vec3(uTime * 0.004, uTime * -0.003, uTime * 0.002);
    vec3 col = vec3(0.0);
    // (the light from inside reddened by the dust in front of it: blue goes first)
    vec3 T = vec3(1.0);
    for (int i = 0; i < STEPS; i++) {
      vec3 p = (ro + rd * t - uCenter) / uR;
      float r = length(p);
      t += dt;
      if (r > 1.0) continue;
      vec3 q = p * 0.5 + uSeed;
      // warped, so the gas streams rather than lying in blobs (and where the light is strong, from the same read)
      vec4 a = tex(q * 0.6 + drift);
      q += (a.gba - 0.5) * 0.35;
      float f = tex(q).r;
      // finer: the detail, and the dust's sheets (seen edge-on, its lanes)
      vec4 d = tex(q * 3.1 + vec3(0.29, 0.61, 0.13));
      f = f * 0.74 + d.r * 0.26;
      // a ragged outline, not a ball
      float rr = r * (0.72 + 0.56 * a.g);
      float shell = (1.0 - smoothstep(0.3, 0.92, rr)) * (1.0 - smoothstep(0.85, 1.0, r));
      // the gas: thin between its clumps, so the stars show through
      float dens = shell * smoothstep(0.4, 0.74, f);
      // the clumps' lit skins: hydrogen glows where starlight meets it, a dense clump's inside stays dark
      float skin = smoothstep(0.44, 0.53, f) * (1.0 - smoothstep(0.56, 0.7, f));
      // where the light is strong: brighter, pinker, a little teal (oxygen) at its heart
      float zone = smoothstep(0.38, 0.78, a.a);
      float emit = shell * (skin * (0.25 + 1.5 * zone) + smoothstep(0.4, 0.6, f) * 0.1) * uDensity;
      // dust: the dense clumps, and thin dark sheets through it
      float clump = shell * smoothstep(0.6, 0.78, f);
      float lane = pow(1.0 - abs(d.g * 2.0 - 1.0), 12.0) * smoothstep(0.42, 0.6, f) * shell;
      // the dense core where the star is forming: a small dark globule, ragged, its edge faintly lit
      float rc = r * (0.75 + 0.7 * d.b);
      float core = uCore * exp(-rc * rc * 60.0) * (0.6 + 0.8 * f);
      float rim = uCore * smoothstep(0.05, 0.25, core) * (1.0 - smoothstep(0.25, 0.7, core)) * 0.4;
      float blue = smoothstep(0.55, 0.75, a.b) * (1.0 - zone);
      vec3 c = mix(uRose, uPink, zone * skin);
      c = mix(c, uTeal, zone * zone * 0.35 * (1.0 - skin));
      c = mix(c, uBlue, blue * 0.7);
      vec3 e = c * emit * (1.0 - smoothstep(0.1, 0.6, core)) + uPink * rim * 0.8;
      col += T * e * uGlow * 1.3 * du;
      float tau = (dens * 0.35 + clump * uDust * 3.0 + lane * uDust * 7.0 + core * 9.0) * du;
      T *= exp(-tau * vec3(0.8, 1.0, 1.3));
      if (T.g < 0.02) break;
    }
    // the protostar, deep in its core: a dull red glow, as infrared would show it
    if (uBirth > 0.0) {
      float miss = length(cross(uCenter - ro, rd)) / uR;
      col += uWarm * uBirth * (exp(-miss * miss * 900.0) * 0.9 + exp(-miss * miss * 60.0) * 0.12);
    }
    gl_FragColor = vec4(col, 1.0 - dot(T, vec3(0.3, 0.5, 0.2)));
  }
`;

export interface NebulaCloudOptions {
  /** Its radius (world units) and a seed for its shape. */
  radius: number;
  seed: number;
  quality: Quality;
  /** Thin gas, not yet gathered: sparse, grey, no core. */
  thin: boolean;
  /** How much gas the galaxy has left (0 to 1): the glow dims as it thins. */
  gas: number;
  /** How near its star's birth is (0 far, 1 at it): the protostar's glow. */
  birth: number;
}

/** A nebula's cloud, up close: one mesh, drawn into a buffer of its own at a fraction of the screen's resolution (systemView prerender), then laid over the scene (cloudOverlay). */
export function nebulaCloud(o: NebulaCloudOptions): { mesh: THREE.Mesh; mat: THREE.ShaderMaterial } {
  const steps = o.quality === 'low' ? 12 : o.quality === 'medium' ? 18 : 24;
  const s = o.seed;
  const glow = 0.35 + 0.65 * o.gas;
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: { STEPS: steps },
    uniforms: {
      uNoise: { value: noiseTexture() },
      uTime: { value: 0 },
      uR: { value: o.radius },
      uCenter: { value: new THREE.Vector3() },
      uSeed: { value: new THREE.Vector3(((s * 0.137) % 1 + 1) % 1, ((s * 0.291) % 1 + 1) % 1, ((s * 0.533) % 1 + 1) % 1) },
      uDensity: { value: o.thin ? 0.35 : 1 },
      uCore: { value: o.thin ? 0 : 1 },
      uDust: { value: o.thin ? 0.2 : 1 },
      uGlow: { value: o.thin ? 0.18 * glow : glow },
      uBirth: { value: o.thin ? 0 : Math.max(0, Math.min(1, o.birth)) },
      uRose: { value: new THREE.Color(o.thin ? '#55607a' : '#b8304f') },
      uPink: { value: new THREE.Color(o.thin ? '#6a7488' : '#ff7aa6') },
      uTeal: { value: new THREE.Color(o.thin ? '#6c7891' : '#4fb4c4') },
      uBlue: { value: new THREE.Color(o.thin ? '#6c7891' : '#4f68d0') },
      uWarm: { value: new THREE.Color('#ff5a2a') },
    },
    // (drawn alone into its own buffer: its light and how much of what is behind it shows, as they are)
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NoBlending,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(o.radius, 48, 32), mat);
  mesh.frustumCulled = false;
  return { mesh, mat };
}

/** How finely the cloud is drawn: its buffer's share of the screen's width and height. */
export function cloudScale(q: Quality): number {
  return q === 'low' ? 0.38 : q === 'medium' ? 0.5 : 0.62;
}

/**
 * The cloud's buffer laid over the scene: a quad over the whole screen at the far plane (so whatever
 * solid is drawn in front of it hides it), drawn after the background stars and before the rest of
 * the see-through things, adding the cloud's light and taking away what its dust swallows.
 */
export function cloudOverlay(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.99999, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      uniform vec2 uTexel;
      varying vec2 vUv;
      void main() {
        // (a soft tent over its texels: the march's step grain smoothed away, the gas soft anyway)
        vec4 c = texture2D(uTex, vUv) * 0.6;
        c += texture2D(uTex, vUv + vec2(uTexel.x, uTexel.y) * 0.5) * 0.1;
        c += texture2D(uTex, vUv + vec2(-uTexel.x, uTexel.y) * 0.5) * 0.1;
        c += texture2D(uTex, vUv + vec2(uTexel.x, -uTexel.y) * 0.5) * 0.1;
        c += texture2D(uTex, vUv + vec2(-uTexel.x, -uTexel.y) * 0.5) * 0.1;
        gl_FragColor = c;
      }
    `,
    uniforms: { uTex: { value: null }, uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) } },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  quad.renderOrder = -1;
  quad.frustumCulled = false;
  return quad;
}
