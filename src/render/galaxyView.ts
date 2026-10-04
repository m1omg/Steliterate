import * as THREE from 'three';
import { fleetLook, lookRole, type FleetLook } from '../game/data/ships';
import { diskLight, dwarfGlow, emberShare, primaryTemperature, shownKind } from '../game/physics';
import { thermalRGB } from './shaders/bodies';
import { livingWorlds } from '../game/sim/fleets';
import { Rng, hashSeed } from '../game/rng';
import type { GameState, StarSystem } from '../game/types';
import { blackbody } from './shaders/noise';

// The Coalescence seen from outside: layered star populations of the ancestral galaxies,
// dimming era by era, with every known system as a node you can pick.

const DUST_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute float aSeed;
  uniform float uTime;
  uniform float uScale;
  uniform float uBright;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.85 + 0.15 * sin(uTime * (0.3 + aSeed * 0.9) + aSeed * 40.0);
    gl_PointSize = clamp(aSize * uScale / -mv.z, 0.6, 22.0);
    vColor = aColor;
    vAlpha = uBright * tw * clamp(aSize * uScale / -mv.z, 0.25, 1.0);
  }
`;

const DUST_FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  uniform vec3 uTint;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d);
    a = a * a;
    gl_FragColor = vec4(vColor * uTint, a * vAlpha);
  }
`;

const NODE_VERT = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  attribute vec4 aState; // x: owned, y: rust, z: pulse phase, w: dim
  attribute float aMark; // 0: seen from afar, 1: surveyed, 2: surveyed, with a living world
  uniform float uTime;
  uniform float uPixel;
  uniform float uLift; // 0 natural, 1 enhanced, 2 thermal
  varying vec3 vColor;
  varying vec4 vState;
  varying float vSize;
  varying float vStar;
  varying float vMark;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = aSize * uPixel * (1.0 + 60.0 / max(8.0, -mv.z));
    vStar = clamp(s, (uLift > 0.5 ? 9.0 : 5.0) * uPixel, 64.0 * uPixel);
    // marked systems get room for their ring, however small the star is drawn
    bool marked = aMark > 0.5 || aState.x > 0.5 || aState.y > 0.01;
    gl_PointSize = max(vStar, marked ? 26.0 * uPixel : 0.0);
    vColor = aColor;
    vState = aState;
    vSize = gl_PointSize;
    vMark = aMark;
  }
`;

const NODE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uPixel;
  uniform vec3 uOwned;
  uniform vec3 uRust;
  uniform vec3 uCharted;
  uniform vec3 uLiving;
  uniform float uLift; // 0 natural, 1 enhanced, 2 thermal: every known star stays visible
  varying vec3 vColor;
  varying vec4 vState;
  varying float vSize;
  varying float vStar;
  varying float vMark;
  // a line lw pixels wide along the circle of radius R (pixels)
  float ringAt(float px, float R, float lw) {
    return 1.0 - smoothstep(0.0, lw, abs(px - R));
  }
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float px = length(c) * vSize; // distance from the centre, in pixels
    float r = vStar * 0.5;        // the star's own radius, in pixels
    float core = 1.0 - smoothstep(0.0, 0.22 * r, px);
    float halo = (1.0 - smoothstep(0.0, r, px)) * 0.35;
    vec3 col = vColor * (core * 1.6 + halo) * vState.w;
    float a = max(core, halo * 0.9) * vState.w;
    if (uLift > 0.5) {
      // a small solid disc, however dead the star: grey-white when enhanced, its temperature
      // colour in the thermal view
      float R = max(0.3 * r, 2.6 * uPixel);
      float disc = 1.0 - smoothstep(R - 0.8 * uPixel, R + 0.8 * uPixel, px);
      float glow = (1.0 - smoothstep(0.0, R * 2.6, px)) * 0.35;
      vec3 lc = uLift > 1.5 ? vColor : mix(vec3(0.72, 0.76, 0.84), vColor, 0.45);
      col = max(col, lc * (disc + glow));
      a = max(a, max(disc, glow));
    }
    float lw = 1.2 * uPixel;
    if (vState.x > 0.5) {
      // settlement ring
      float ring = ringAt(px, max(r * 0.72, 8.0 * uPixel), lw * 1.3) * (0.75 + 0.25 * sin(uTime * 1.6 + vState.z));
      col += uOwned * ring * 1.4;
      a = max(a, ring);
    } else if (vMark > 0.5) {
      // surveyed: a steady thin ring; green where a living world waits
      float ring = ringAt(px, max(r * 0.62, 7.0 * uPixel), lw) * (vMark > 1.5 ? 0.9 : 0.6);
      col += (vMark > 1.5 ? uLiving : uCharted) * ring;
      a = max(a, ring);
    }
    // the Hunger's rust bloom, flickering
    if (vState.y > 0.01) {
      float flick = 0.6 + 0.4 * sin(uTime * 7.0 + vState.z * 13.0) * sin(uTime * 2.3 + vState.z);
      float rust = ringAt(px, max(r * 0.9, 11.0 * uPixel), lw * 1.6) * vState.y * flick;
      col += uRust * rust;
      a = max(a, rust);
    }
    if (a < 0.01) discard;
    gl_FragColor = vec4(col, a);
  }
`;

const SWARM_VERT = /* glsl */ `
  attribute vec3 aCenter;
  attribute vec4 aParams; // x: phase, y: radius, z: speed, w: size of swarm
  attribute float aTamed; // 1 for a swarm that answers to us
  uniform float uTime;
  uniform float uPixel;
  varying float vFlick;
  varying float vTamed;
  // murmuration: every mote follows the same few slow waves, so the flock moves as one
  void main() {
    float t = uTime * aParams.z;
    float p = aParams.x;
    vec3 flow = vec3(
      sin(t * 0.7 + p * 1.3) + 0.6 * sin(t * 1.9 + p * 0.4),
      0.5 * sin(t * 1.1 + p * 2.1) + 0.3 * cos(t * 0.5 + p),
      cos(t * 0.8 + p * 1.7) + 0.6 * cos(t * 1.5 + p * 0.8)
    );
    vec3 shared = vec3(sin(t * 0.33), 0.4 * sin(t * 0.21), cos(t * 0.27)) * 0.8;
    vec3 pos = aCenter + (flow * 0.55 + shared) * aParams.y;
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(2.2 * uPixel * (1.0 + 30.0 / max(6.0, -mv.z)), 1.0, 6.0 * uPixel);
    vFlick = 0.5 + 0.5 * sin(uTime * 5.0 + p * 31.0);
    vTamed = aTamed;
  }
`;

const SWARM_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uTamedColor;
  uniform float uOpacity;
  varying float vFlick;
  varying float vTamed;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    if (length(c) > 0.5) discard;
    // dark motes, catching dull red light now and then (a tamed swarm's, the system view's teal)
    vec3 col = mix(vec3(0.05, 0.03, 0.03), mix(uColor, uTamedColor, vTamed), step(0.82, vFlick));
    gl_FragColor = vec4(col, uOpacity * (0.55 + 0.45 * vFlick));
  }
`;

export interface Pickable {
  kind: 'system' | 'fleet' | 'swarm';
  id: string;
  pos: THREE.Vector3;
  /** Size in world units: a click anywhere on its disc on screen picks it. */
  radius?: number;
}

export class GalaxyView {
  group = new THREE.Group();
  private dust: THREE.Points | null = null;
  private dustMat: THREE.ShaderMaterial;
  private nodes: THREE.Points | null = null;
  private nodeMat: THREE.ShaderMaterial;
  private swarmPts: THREE.Points | null = null;
  private swarmMat: THREE.ShaderMaterial;
  private fleetGroup = new THREE.Group();
  private lines: THREE.LineSegments | null = null;
  private selRing: THREE.Mesh;
  private heartGlow: THREE.Sprite;
  private territory: THREE.Points | null = null;
  pickables: Pickable[] = [];
  /** 0 natural, 1 enhanced, 2 thermal (see VIEW_MODE). */
  viewMode = 0;
  /** Surveyed systems with an unsettled living world (for the map's marks and labels). */
  living = new Set<string>();
  private pings: { mesh: THREE.Mesh; t0: number; delay: number }[] = [];
  private syncedState: GameState | null = null;
  private fleetAnim = new Map<
    string,
    { from: THREE.Vector3; to: THREE.Vector3; t0: number; mesh: THREE.Sprite; kind: FleetKind; star: THREE.Vector3 | null; dest: THREE.Vector3 | null; phase: number; pick: Pickable | null }
  >();
  private seedBuilt = -1;
  private time = 0;
  selected: string | null = null;

  constructor() {
    this.dustMat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      uniforms: { uTime: { value: 0 }, uScale: { value: 300 }, uBright: { value: 1 }, uTint: { value: new THREE.Color(1, 1, 1) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.nodeMat = new THREE.ShaderMaterial({
      vertexShader: NODE_VERT,
      fragmentShader: NODE_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uPixel: { value: 1 },
        uOwned: { value: new THREE.Color('#4fe3d1') },
        uRust: { value: new THREE.Color('#b8452a') },
        uCharted: { value: new THREE.Color('#cfe3ea') },
        uLiving: { value: new THREE.Color('#b8f5a0') },
        uLift: { value: 0 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.swarmMat = new THREE.ShaderMaterial({
      vertexShader: SWARM_VERT,
      fragmentShader: SWARM_FRAG,
      uniforms: { uTime: { value: 0 }, uPixel: { value: 1 }, uColor: { value: new THREE.Color('#c0482c') }, uTamedColor: { value: new THREE.Color('#4fe3d1') }, uOpacity: { value: 0.9 } },
      transparent: true,
      depthWrite: false,
    });
    const ringGeo = new THREE.RingGeometry(1, 1.08, 64);
    this.selRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffd9b0', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    this.selRing.visible = false;
    this.group.add(this.selRing);
    const glowTex = radialTexture();
    this.heartGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: '#ffae70', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.5 }));
    this.heartGlow.scale.set(260, 260, 1);
    this.group.add(this.heartGlow);
    this.group.add(this.fleetGroup);
  }

  setPixelRatio(pr: number) {
    this.nodeMat.uniforms.uPixel.value = pr;
    this.swarmMat.uniforms.uPixel.value = pr;
    this.dustMat.uniforms.uScale.value = 300 * pr;
  }

  setPalette(accent: string, neon: string) {
    void accent;
    this.nodeMat.uniforms.uOwned.value.set(neon);
  }

  /** Build the unchanging star field of the Coalescence once per world. */
  private buildDust(state: GameState) {
    if (this.dust) {
      this.group.remove(this.dust);
      this.dust.geometry.dispose();
    }
    const rng = new Rng(hashSeed(state.settings.seed * 3 + 1));
    const pos: number[] = [];
    const col: number[] = [];
    const size: number[] = [];
    const seed: number[] = [];
    const push = (x: number, y: number, z: number, c: [number, number, number], s: number) => {
      pos.push(x, y, z);
      col.push(...c);
      size.push(s);
      seed.push(rng.next());
    };
    const warm = (t: number): [number, number, number] => blackbody(t);
    const gauss = () => rng.gauss();
    // one vast shared envelope: a de Vaucouleurs-like profile, bright core, long faint wings
    for (let i = 0; i < 30000; i++) {
      const r = 18 + Math.pow(rng.next(), 2.6) * 820;
      const th = rng.next() * Math.PI * 2;
      const ph = Math.acos(rng.range(-1, 1));
      push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.62, r * Math.sin(ph) * Math.sin(th), warm(rng.range(2600, 3600)), rng.range(1.0, 2.4));
    }
    // merger shells: faint concentric arcs left by galaxies that fell in (seen around real merger remnants)
    for (let k = 0; k < 7; k++) {
      const R = 260 + k * 85 + rng.range(-20, 20);
      const axis = rng.range(0, Math.PI * 2);
      const span = rng.range(0.7, 1.4);
      const side = k % 2 === 0 ? 1 : -1;
      for (let i = 0; i < 1300; i++) {
        const a = axis + side * (Math.PI / 2) + rng.range(-span, span);
        const rr = R + gauss() * 5;
        push(Math.cos(a) * rr, gauss() * 22 * 0.62, Math.sin(a) * rr, warm(rng.range(2700, 3300)), rng.range(0.9, 1.7));
      }
    }
    for (const p of state.provinces) {
      if (p.kind === 'ancestral') {
        const tint = rng.range(-300, 300);
        const n = 9000;
        for (let i = 0; i < n; i++) {
          const r = Math.abs(gauss()) * p.radius * 0.5;
          const th = rng.next() * Math.PI * 2;
          const ph = Math.acos(rng.range(-1, 1));
          push(p.pos.x + r * Math.sin(ph) * Math.cos(th), p.pos.y + r * Math.cos(ph) * 0.45, p.pos.z + r * Math.sin(ph) * Math.sin(th), warm(rng.range(2700, 3700) + tint), rng.range(1, 2.2));
        }
        // a bridge of stars back to the core: they are falling together
        for (let i = 0; i < 2600; i++) {
          const u = rng.next();
          const j = gauss() * 45;
          push(p.pos.x * u + j, p.pos.y * u + gauss() * 20, p.pos.z * u + gauss() * 45, warm(rng.range(2600, 3400)), rng.range(0.8, 1.8));
        }
      } else if (p.kind === 'stream') {
        const ang0 = Math.atan2(p.pos.z, p.pos.x);
        const rad = Math.hypot(p.pos.x, p.pos.z);
        for (let i = 0; i < 4200; i++) {
          const a = ang0 + rng.range(-0.9, 0.9);
          const rr = rad + gauss() * 22;
          push(Math.cos(a) * rr, p.pos.y + gauss() * 16 + Math.sin(a * 3) * 40, Math.sin(a) * rr, warm(rng.range(2600, 3300)), rng.range(0.9, 1.9));
        }
      }
    }
    // the halo: sparse, old, wide
    for (let i = 0; i < 9000; i++) {
      const r = 300 + Math.abs(gauss()) * 480;
      const th = rng.next() * Math.PI * 2;
      const ph = Math.acos(rng.range(-1, 1));
      push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph) * 0.8, r * Math.sin(ph) * Math.sin(th), warm(rng.range(2500, 3200)), rng.range(0.7, 1.5));
    }
    for (const r of state.regions) {
      if (r.kind !== 'globular' && r.kind !== 'outlier') continue;
      const n = r.kind === 'globular' ? 2200 : 500;
      for (let i = 0; i < n; i++) {
        const rr = Math.abs(gauss()) * (r.kind === 'globular' ? 14 : 8);
        const th = rng.next() * Math.PI * 2;
        const ph = Math.acos(rng.range(-1, 1));
        push(r.pos.x + rr * Math.sin(ph) * Math.cos(th), r.pos.y + rr * Math.cos(ph), r.pos.z + rr * Math.sin(ph) * Math.sin(th), warm(rng.range(2800, 4200)), rng.range(0.8, 1.6));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    this.dust = new THREE.Points(g, this.dustMat);
    this.dust.frustumCulled = false;
    this.group.add(this.dust);
  }

  /** Rebuild everything that changes with the game state. */
  /** Switch how the map is shown; the next sync recolours the stars. */
  setViewMode(m: number) {
    this.viewMode = m;
    this.nodeMat.uniforms.uLift.value = m;
  }

  /** Where a fleet's hull is drawn right now (it glides during the turn animation). */
  fleetPos(id: string): THREE.Vector3 | null {
    return this.fleetAnim.get(id)?.mesh.position ?? null;
  }

  /** After the GPU context was lost and restored: rebuild the point clouds on the next sync. */
  invalidate() {
    this.seedBuilt = -1;
  }

  sync(state: GameState, now: number) {
    if (state !== this.syncedState) {
      // a different game (new, loaded, or the menu's preview world): fleet ids repeat between
      // games, so start every hull where it is instead of gliding in from the old map
      for (const a of this.fleetAnim.values()) this.fleetGroup.remove(a.mesh);
      this.fleetAnim.clear();
      this.syncedState = state;
    }
    if (this.seedBuilt !== state.settings.seed) {
      this.buildDust(state);
      this.seedBuilt = state.settings.seed;
    }
    // brightness of the old stellar population by era
    const liveRed = Object.values(state.systems).filter((s) => s.primary.kind === 'red_dwarf' || s.primary.kind === 'blue_dwarf').length;
    const totalRed = Math.max(1, (state.flags.red_total ??= liveRed));
    const bright =
      state.era === 'dusk' ? 0.12 + 0.88 * (liveRed / totalRed) : state.era === 'degenerate' ? 0.1 : state.era === 'blackhole' ? 0.018 : 0.0;
    // enhanced and thermal views keep the old population faintly visible even when it is dark
    this.dustMat.uniforms.uBright.value = this.viewMode === 1 ? Math.max(bright, 0.28) : this.viewMode === 2 ? Math.max(bright, 0.14) : bright;
    this.dustMat.uniforms.uTint.value.set(state.era === 'dusk' ? '#ffffff' : state.era === 'degenerate' ? '#9fb8ff' : '#8c86b8');
    this.heartGlow.material.opacity = state.era === 'dusk' ? 0.35 : state.era === 'degenerate' ? 0.16 : state.era === 'blackhole' ? 0.06 : 0;

    // system nodes
    const known = state.civ.known;
    const colonized = new Set(Object.values(state.colonies).map((c) => c.systemId));
    const pos: number[] = [];
    const col: number[] = [];
    const size: number[] = [];
    const st: number[] = [];
    const mark: number[] = [];
    this.pickables = [];
    this.living.clear();
    for (const s of Object.values(state.systems)) {
      if (!known[s.id] || s.gone) continue;
      const [r, g, b] = this.viewMode === 2 ? thermalRGB(nodeTemperature(s, state)) : nodeColor(s, state);
      pos.push(s.pos.x, s.pos.y, s.pos.z);
      col.push(r, g, b);
      size.push(nodeSize(s, state));
      st.push(colonized.has(s.id) ? 1 : 0, s.rust ?? 0, (hashSeed(s.id) % 1000) / 159, known[s.id] === 2 ? 1 : 0.7);
      const alive = known[s.id] === 2 && livingWorlds(state, s.id).length > 0;
      if (alive) this.living.add(s.id);
      mark.push(known[s.id] === 2 ? (alive ? 2 : 1) : 0);
      this.pickables.push({ kind: 'system', id: s.id, pos: new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z) });
    }
    if (this.nodes) {
      this.group.remove(this.nodes);
      this.nodes.geometry.dispose();
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ng.setAttribute('aColor', new THREE.Float32BufferAttribute(col, 3));
    ng.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    ng.setAttribute('aState', new THREE.Float32BufferAttribute(st, 4));
    ng.setAttribute('aMark', new THREE.Float32BufferAttribute(mark, 1));
    this.nodes = new THREE.Points(ng, this.nodeMat);
    this.nodes.frustumCulled = false;
    this.nodes.renderOrder = 2;
    this.group.add(this.nodes);

    // settled territory: soft neon discs
    if (this.territory) {
      this.group.remove(this.territory);
      this.territory.geometry.dispose();
    }
    const tp: number[] = [];
    for (const id of colonized) {
      const s = state.systems[id];
      tp.push(s.pos.x, s.pos.y, s.pos.z);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    const tm = new THREE.PointsMaterial({ size: 38, map: radialTexture(), color: this.nodeMat.uniforms.uOwned.value, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.territory = new THREE.Points(tg, tm);
    this.group.add(this.territory);

    this.syncFleets(state, now);
    this.syncSwarms(state);
  }

  private syncFleets(state: GameState, now: number) {
    const seen = new Set<string>();
    const lp: number[] = [];
    for (const f of Object.values(state.fleets)) {
      seen.add(f.id);
      let p: THREE.Vector3;
      if (f.at) {
        const s = state.systems[f.at];
        p = new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z).add(new THREE.Vector3(2.2, 1.2, 0));
      } else {
        const a = state.systems[f.from!];
        const b = state.systems[f.to!];
        const u = f.distance > 0 ? f.traveled / f.distance : 1;
        p = new THREE.Vector3(a.pos.x + (b.pos.x - a.pos.x) * u, a.pos.y + (b.pos.y - a.pos.y) * u, a.pos.z + (b.pos.z - a.pos.z) * u);
        lp.push(p.x, p.y, p.z, b.pos.x, b.pos.y, b.pos.z);
      }
      let anim = this.fleetAnim.get(f.id);
      const kind = fleetLook(f.ships.map((s) => s.cls));
      const role = lookRole(kind);
      const star = f.at ? new THREE.Vector3(state.systems[f.at].pos.x, state.systems[f.at].pos.y, state.systems[f.at].pos.z) : null;
      const dest = f.to ? new THREE.Vector3(state.systems[f.to].pos.x, state.systems[f.to].pos.y, state.systems[f.to].pos.z) : null;
      if (!anim || anim.kind !== kind) {
        if (anim) this.fleetGroup.remove(anim.mesh);
        const mesh = fleetGlyph(kind, role === 'war' ? '#ffc98f' : role === 'settler' ? '#9ff5e6' : '#bfe9ff');
        this.fleetGroup.add(mesh);
        mesh.position.copy(p);
        anim = { from: p.clone(), to: p.clone(), t0: now, mesh, kind, star, dest, phase: (hashId(f.id) % 628) / 100, pick: null };
        this.fleetAnim.set(f.id, anim);
      } else {
        anim.from = anim.mesh.position.clone();
        anim.to = p;
        anim.t0 = now;
        anim.star = star;
        anim.dest = dest;
      }
      const pick: Pickable = { kind: 'fleet', id: f.id, pos: p.clone() };
      anim.pick = pick;
      this.pickables.push(pick);
    }
    for (const [id, a] of this.fleetAnim) {
      if (!seen.has(id)) {
        this.fleetGroup.remove(a.mesh);
        this.fleetAnim.delete(id);
      }
    }
    if (this.lines) {
      this.group.remove(this.lines);
      this.lines.geometry.dispose();
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    this.lines = new THREE.LineSegments(lg, new THREE.LineDashedMaterial({ color: '#8fd7ff', dashSize: 3, gapSize: 3, transparent: true, opacity: 0.45 }));
    this.lines.computeLineDistances();
    this.group.add(this.lines);
  }

  private syncSwarms(state: GameState) {
    if (this.swarmPts) {
      this.group.remove(this.swarmPts);
      this.swarmPts.geometry.dispose();
      this.swarmPts = null;
    }
    const centers: number[] = [];
    const params: number[] = [];
    const tamed: number[] = [];
    const pos: number[] = [];
    for (const sw of Object.values(state.swarms)) {
      if (!sw.awake && !sw.tamed) continue;
      let c: THREE.Vector3 | null = null;
      if (sw.systemId) {
        const s = state.systems[sw.systemId];
        if (!state.civ.known[s.id]) continue;
        c = new THREE.Vector3(s.pos.x, s.pos.y + 1.5, s.pos.z);
      } else if (sw.from && sw.to) {
        const a = state.systems[sw.from];
        const b = state.systems[sw.to];
        const u = sw.distance > 0 ? Math.min(1, sw.traveled / sw.distance) : 0;
        c = new THREE.Vector3(a.pos.x + (b.pos.x - a.pos.x) * u, a.pos.y + (b.pos.y - a.pos.y) * u, a.pos.z + (b.pos.z - a.pos.z) * u);
      }
      if (!c) continue;
      const n = Math.round(80 + sw.size * 30);
      const rad = 2.5 + Math.sqrt(sw.size) * 1.6;
      // a click anywhere on its cloud picks it (the star it hangs over still wins right on the star)
      this.pickables.push({ kind: 'swarm', id: sw.id, pos: c.clone(), radius: rad * 1.2 });
      for (let i = 0; i < n; i++) {
        centers.push(c.x, c.y, c.z);
        pos.push(c.x, c.y, c.z);
        params.push(Math.random() * 100, rad * (0.4 + Math.random() * 0.8), 0.4 + Math.random() * 0.25, sw.size);
        tamed.push(sw.tamed ? 1 : 0);
      }
    }
    if (!centers.length) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aCenter', new THREE.Float32BufferAttribute(centers, 3));
    g.setAttribute('aParams', new THREE.Float32BufferAttribute(params, 4));
    g.setAttribute('aTamed', new THREE.Float32BufferAttribute(tamed, 1));
    this.swarmPts = new THREE.Points(g, this.swarmMat);
    this.swarmPts.frustumCulled = false;
    this.group.add(this.swarmPts);
  }

  /** A discovery: rings of light spread from a system for a couple of seconds. */
  ping(state: GameState, systemId: string, color: string, now: number) {
    const s = state.systems[systemId];
    if (!s) return;
    for (const delay of [0, 0.45]) {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.92, 1, 64),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending }),
      );
      m.position.set(s.pos.x, s.pos.y, s.pos.z);
      m.renderOrder = 4;
      this.group.add(m);
      this.pings.push({ mesh: m, t0: now, delay });
    }
  }

  update(dt: number, now: number, camera: THREE.Camera, cameraDistance: number) {
    this.time += dt;
    const t = this.time;
    for (let i = this.pings.length - 1; i >= 0; i--) {
      const pg = this.pings[i];
      const u = (now - pg.t0 - pg.delay) / 2.4;
      const mat = pg.mesh.material as THREE.MeshBasicMaterial;
      if (u >= 1) {
        this.group.remove(pg.mesh);
        pg.mesh.geometry.dispose();
        mat.dispose();
        this.pings.splice(i, 1);
        continue;
      }
      const e = Math.max(0, u);
      pg.mesh.lookAt(camera.position);
      pg.mesh.scale.setScalar(Math.max(1.5, cameraDistance * 0.01) * (1 + e * 9));
      mat.opacity = u < 0 ? 0 : 0.9 * (1 - e) * (1 - e);
    }
    this.dustMat.uniforms.uTime.value = t;
    this.nodeMat.uniforms.uTime.value = t;
    this.swarmMat.uniforms.uTime.value = t;
    // fleets glide to their new positions over a fixed real-time span
    const sz = Math.max(1.8, cameraDistance * 0.034);
    for (const a of this.fleetAnim.values()) {
      const u = Math.min(1, (now - a.t0) / 1.4);
      const e = u * u * (3 - 2 * u);
      let heading: THREE.Vector3 | null = null;
      if (a.star && u >= 1) {
        // parked: a slow station-keeping orbit around the star, on elapsed time
        const r = 2.6;
        const ang = a.phase + t * 0.25;
        a.mesh.position.set(a.star.x + Math.cos(ang) * r, a.star.y + 0.9, a.star.z + Math.sin(ang) * r);
        heading = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang)).add(a.mesh.position);
      } else {
        a.mesh.position.lerpVectors(a.from, a.to, e);
        heading = a.dest ?? a.to;
      }
      if (a.pick) a.pick.pos.copy(a.mesh.position);
      // point the hull along its heading as seen on screen
      const p0 = a.mesh.position.clone().project(camera);
      const p1 = heading.clone().project(camera);
      const dx = (p1.x - p0.x) * ((camera as THREE.PerspectiveCamera).aspect ?? 1);
      const dy = p1.y - p0.y;
      if (dx * dx + dy * dy > 1e-10) a.mesh.material.rotation = Math.atan2(dy, dx) - Math.PI / 2;
      a.mesh.scale.setScalar(sz);
    }
    if (this.selected) {
      const p = this.pickables.find((x) => x.id === this.selected);
      if (p) {
        this.selRing.visible = true;
        this.selRing.position.copy(p.pos);
        this.selRing.lookAt(camera.position);
        const s = Math.max(1.6, cameraDistance * 0.028) * (1 + 0.06 * Math.sin(t * 3));
        this.selRing.scale.setScalar(s);
      } else this.selRing.visible = false;
    } else this.selRing.visible = false;
  }
}

/** A primary's surface (or, for holes, its disk's) temperature for the thermal view, in K. */
function nodeTemperature(s: StarSystem, state: GameState): number {
  const k = shownKind(s.primary, state.years);
  if (k === 'black_hole' || k === 'smbh') return 2.7 + 900 * diskLight(k, state.era, state.years);
  if (k === 'void' || k === 'rogue') return 3;
  return primaryTemperature(s.primary, state.years, state.era);
}

function nodeColor(s: StarSystem, state: GameState): [number, number, number] {
  // (a new star already out shows as the cold dwarf it is becoming)
  const k = shownKind(s.primary, state.years);
  if (k === 'black_hole' || k === 'smbh') return [0.62, 0.52, 1.0];
  if (k === 'void' || k === 'rogue') return [0.35, 0.36, 0.42];
  if (k === 'brown_dwarf') return [0.62, 0.3, 0.28];
  if (k === 'black_dwarf') return s.primary.rekindle ? [0.9, 0.45, 0.25] : [0.3, 0.3, 0.34];
  const tK = primaryTemperature(s.primary, state.years, state.era);
  if (k === 'white_dwarf' && state.era !== 'dusk') {
    // greying toward a black dwarf as it cools; an ember blue-white while the halo warms it
    if (s.primary.rekindle) return [0.9, 0.45, 0.25];
    const g = dwarfGlow(state.years);
    const e = emberShare(s.primary, state.years);
    const cold = [0.3 + 0.05 * g, 0.3 + 0.07 * g, 0.34 + 0.11 * g];
    return [cold[0] + (0.55 - cold[0]) * e, cold[1] + (0.62 - cold[1]) * e, cold[2] + (0.8 - cold[2]) * e];
  }
  const [r, g, b] = blackbody(Math.max(1800, tK));
  const boost = k === 'red_dwarf' || k === 'collision_star' ? 1.0 : 1.2;
  return [r * boost, g * boost, b * boost];
}

function nodeSize(s: StarSystem, state: GameState): number {
  switch (shownKind(s.primary, state.years)) {
    case 'smbh':
      return 11;
    case 'helium_giant':
    case 'dark_star':
      return 10;
    case 'blue_dwarf':
    case 'helium_star':
      return 8;
    case 'red_dwarf':
    case 'collision_star':
      return 6;
    case 'black_hole':
      return 6;
    case 'neutron_star':
      return 5;
    default:
      return 4.5;
  }
}

let _radial: THREE.Texture | null = null;
export function radialTexture(): THREE.Texture {
  if (_radial) return _radial;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.08)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  _radial = new THREE.CanvasTexture(c);
  return _radial;
}

type FleetKind = FleetLook;
const _fleetTex = new Map<string, THREE.CanvasTexture>();

/**
 * A painted hull seen from above, bow up (public/art/ships), over a faint halo in the fleet's
 * colour so it reads against black space. The halo shows at once; the hull fills in once the
 * image has loaded.
 */
function fleetTexture(kind: FleetKind, color: string): THREE.CanvasTexture {
  const key = `${kind}:${color}`;
  const hit = _fleetTex.get(key);
  if (hit) return hit;
  const S = 160;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const halo = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  halo.addColorStop(0, hexA(color, 0.22));
  halo.addColorStop(0.55, hexA(color, 0.08));
  halo.addColorStop(1, hexA(color, 0));
  g.fillStyle = halo;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    const d = S * 0.8;
    const o = (S - d) / 2;
    // a thin rim of the fleet colour around the silhouette, then the hull itself on top
    g.shadowColor = color;
    g.shadowBlur = 7;
    g.drawImage(img, o, o, d, d);
    g.shadowBlur = 0;
    g.drawImage(img, o, o, d, d);
    t.needsUpdate = true;
  };
  img.src = `art/ships/${kind}.png`;
  _fleetTex.set(key, t);
  return t;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function fleetGlyph(kind: FleetKind, color: string): THREE.Sprite {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: fleetTexture(kind, color), transparent: true, depthWrite: false, depthTest: false }));
  m.renderOrder = 3;
  return m;
}

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}
