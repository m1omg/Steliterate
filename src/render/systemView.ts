import * as THREE from 'three';
import { primaryTemperature } from '../game/physics';
import { hashSeed, Rng } from '../game/rng';
import type { Body, GameState, StarSystem } from '../game/types';
import { radialTexture, type Pickable } from './galaxyView';
import { DISK_FRAG, DISK_VERT, GLOW_FRAG, GLOW_VERT, PLANET_FRAG, PLANET_VERT, STAR_FRAG, STAR_VERT } from './shaders/bodies';
import { blackbody } from './shaders/noise';

// One system up close. Planets orbit on elapsed time (never on frame count), the star
// granulates and flares, the dying world freezes as its vitality falls.

interface PlanetRig {
  body: Body;
  pivot: THREE.Object3D;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial | null;
  speed: number;
  phase: number;
  radius: number;
  extra: THREE.Object3D[];
}

const KIND_INDEX: Record<string, number> = { eyeball: 1, terran: 1, super_earth: 0, barren: 0, ice: 2, ocean_ice: 5, gas_giant: 3, ice_giant: 4 };

export class SystemView {
  group = new THREE.Group();
  systemId: string | null = null;
  pickables: Pickable[] = [];
  private starMat: THREE.ShaderMaterial | null = null;
  private glowMats: THREE.ShaderMaterial[] = [];
  private diskMats: THREE.ShaderMaterial[] = [];
  private planets: PlanetRig[] = [];
  private swarm: THREE.Points | null = null;
  private swarmMat: THREE.ShaderMaterial | null = null;
  private dyson: THREE.InstancedMesh | null = null;
  private dysonSpin: { axis: THREE.Vector3; speed: number; r: number; phase: number }[] = [];
  private fleets = new THREE.Group();
  private stars: THREE.Points;
  private time = 0;
  primaryRadius = 5;
  neon = new THREE.Color('#4fe3d1');
  selectedBody: string | null = null;

  /** Where a body is right now, and how big: for the camera to fly to and follow. */
  bodyFocus(bodyId: string): { pos: THREE.Vector3; radius: number } | null {
    const p = this.pickables.find((x) => x.id === `body:${bodyId}`);
    if (!p) return null;
    const rig = this.planets.find((x) => x.body.id === bodyId);
    const radius = rig ? (rig.body.kind === 'asteroids' ? 4 : rig.body.size) : 3;
    return { pos: p.pos.clone(), radius };
  }
  private selRing: THREE.Mesh;

  constructor() {
    this.stars = backgroundStars();
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.03, 96), new THREE.MeshBasicMaterial({ color: '#ffd9b0', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    this.selRing.visible = false;
  }

  private clear() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mat && !Array.isArray(mat) && mat !== this.selRing.material) mat.dispose();
    });
    this.group.clear();
    this.planets = [];
    this.glowMats = [];
    this.diskMats = [];
    this.pickables = [];
    this.dyson = null;
    this.dysonSpin = [];
    this.swarm = null;
    this.swarmMat = null;
    this.fleets = new THREE.Group();
    this.starMat = null;
  }

  build(state: GameState, systemId: string) {
    this.clear();
    this.systemId = systemId;
    const sys = state.systems[systemId];
    this.group.add(this.stars);
    (this.stars.material as THREE.PointsMaterial).opacity = state.era === 'dusk' ? 0.8 : state.era === 'degenerate' ? 0.35 : state.era === 'blackhole' ? 0.12 : 0.03;
    this.group.add(this.selRing);
    this.buildPrimary(state, sys);
    const light = primaryLightColor(state, sys);
    const colonized = new Set(Object.values(state.colonies).filter((c) => c.systemId === sys.id).map((c) => c.bodyId));
    // until a probe has surveyed it, a system is only its star: the worlds are not charted yet
    const surveyed = state.civ.known[sys.id] === 2 || colonized.size > 0;
    for (const bid of surveyed ? sys.bodies : []) {
      const b = state.bodies[bid];
      if (!b || b.dissolved) continue;
      if (b.kind === 'deep') {
        this.buildDeep(state, sys, b, colonized.has(b.id));
        continue;
      }
      this.buildBody(state, sys, b, light, colonized.has(b.id));
    }
    if (surveyed) this.buildStructures(state, sys);
    this.buildSwarm(state, sys);
    this.buildFleets(state, sys);
    this.group.add(this.fleets);
  }

  private buildPrimary(state: GameState, sys: StarSystem) {
    const p = sys.primary;
    const seed = (hashSeed(sys.id) % 1000) / 10;
    const temp = primaryTemperature(p, state.years, state.era);
    const col = new THREE.Color(...blackbody(Math.max(1500, temp)));
    const addGlow = (size: number, color: THREE.Color, power: number, beams = 0, ring = 0) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: GLOW_VERT,
        fragmentShader: GLOW_FRAG,
        uniforms: { uTime: { value: 0 }, uColor: { value: color }, uPower: { value: power }, uBeams: { value: beams }, uRing: { value: ring } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const s = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
      s.userData.billboard = true;
      this.glowMats.push(m);
      this.group.add(s);
      return s;
    };
    const addStar = (r: number, color: THREE.Color, granule: number, bands: number, intensity: number) => {
      this.starMat = new THREE.ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: { uTime: { value: 0 }, uColor: { value: color }, uGranule: { value: granule }, uBands: { value: bands }, uIntensity: { value: intensity }, uSeed: { value: seed } },
      });
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 48), this.starMat);
      this.group.add(m);
      this.primaryRadius = r;
      this.pickables.push({ kind: 'system', id: sys.id, pos: new THREE.Vector3() });
    };
    switch (p.kind) {
      case 'red_dwarf':
      case 'collision_star':
        addStar(5, col.clone().lerp(new THREE.Color('#ff4a14'), 0.55), 1.0, 0, 0.68);
        addGlow(34, col.clone().lerp(new THREE.Color('#ff5a1c'), 0.4), 0.55);
        break;
      case 'blue_dwarf':
        addStar(5.4, col, 0.55, 0, 0.9);
        addGlow(42, col, 0.6);
        break;
      case 'helium_star':
        addStar(3.2, col, 0.4, 0, 2.6);
        addGlow(52, col, 1.6);
        break;
      case 'helium_giant':
        addStar(9, col, 1.0, 0, 2.2);
        addGlow(80, col, 1.8);
        break;
      case 'dark_star':
        addStar(8, new THREE.Color('#ffcfa0'), 0.6, 0, 1.6);
        addGlow(70, new THREE.Color('#ffb98a'), 1.2);
        break;
      case 'white_dwarf':
        if (state.era === 'dusk') {
          addStar(1.6, col, 0.1, 0, 3);
          addGlow(20, col, 1.1);
        } else {
          const ember = p.halo && state.eta < 25;
          addStar(1.6, ember ? new THREE.Color('#6d4a52') : new THREE.Color('#3a3a44'), 0.15, 0, 0.9);
          if (ember) addGlow(14, new THREE.Color('#8a4f4a'), 0.35);
        }
        break;
      case 'black_dwarf':
        addStar(1.6, new THREE.Color('#2a2628'), 0.1, 0, 0.6);
        break;
      case 'brown_dwarf':
        addStar(3.4, new THREE.Color(state.era === 'dusk' ? '#7a3a33' : '#3c2225'), 0.2, 1.0, 0.9);
        addGlow(14, new THREE.Color('#5a2420'), 0.35);
        break;
      case 'neutron_star':
        addStar(0.8, new THREE.Color('#dde8ff'), 0.1, 0, 3);
        addGlow(40, new THREE.Color('#9cc3ff'), state.era === 'dusk' ? 0.9 : 0.4, 0.6);
        break;
      case 'black_hole':
      case 'smbh': {
        const r = p.kind === 'smbh' ? 6 : 2.6;
        const hole = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshBasicMaterial({ color: '#000000' }));
        this.group.add(hole);
        this.primaryRadius = r;
        this.pickables.push({ kind: 'system', id: sys.id, pos: new THREE.Vector3() });
        addGlow(r * 6, new THREE.Color('#ffd2a8'), 0.0, 0, 1.0);
        const fed = Object.values(state.colonies).some((c) => c.systemId === sys.id && ((c.structures.accretion_engine ?? 0) > 0 || (c.structures.penrose_harvester ?? 0) > 0));
        const heat = p.kind === 'smbh' ? (state.era === 'dark' ? 0 : 0.55) : fed ? 1.0 : 0.18;
        this.addDisk(r * 1.6, r * (p.kind === 'smbh' ? 9 : 6), heat);
        break;
      }
      default:
        this.primaryRadius = 1;
        this.pickables.push({ kind: 'system', id: sys.id, pos: new THREE.Vector3() });
        break;
    }
    if (p.rekindle && p.rekindle > 0.01) this.addDisk(this.primaryRadius * 2.2, this.primaryRadius * 7, Math.min(1, p.rekindle));
  }

  private addDisk(inner: number, outer: number, heat: number) {
    const m = new THREE.ShaderMaterial({
      vertexShader: DISK_VERT,
      fragmentShader: DISK_FRAG,
      uniforms: { uTime: { value: 0 }, uInner: { value: inner }, uOuter: { value: outer }, uHeat: { value: heat }, uHot: { value: new THREE.Color('#fff0d8') }, uCool: { value: new THREE.Color('#c2562e') } },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const disk = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128, 4), m);
    disk.rotation.x = -Math.PI / 2 + 0.22;
    this.diskMats.push(m);
    this.group.add(disk);
  }

  private buildDeep(state: GameState, sys: StarSystem, b: Body, settled: boolean) {
    const r = this.primaryRadius * 2.4 + 3;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.12, 128), new THREE.MeshBasicMaterial({ color: settled ? this.neon : '#6b6f7a', transparent: true, opacity: settled ? 0.55 : 0.18, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    this.group.add(ring);
    const pos = new THREE.Vector3(r, 0, 0);
    this.pickables.push({ kind: 'system', id: `body:${b.id}`, pos });
    if (settled) {
      // a station: a small lit hull on the Deep ring
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: '#1a1a1f' }));
      hull.position.copy(pos);
      const lights = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.32), new THREE.MeshBasicMaterial({ color: this.neon }));
      lights.position.copy(pos);
      this.group.add(hull, lights);
    }
    void state;
    void sys;
  }

  private buildBody(state: GameState, sys: StarSystem, b: Body, light: { color: THREE.Color; power: number }, settled: boolean) {
    const pivot = new THREE.Object3D();
    const orbitR = b.rogue ? b.orbit * 2.6 + 30 : b.orbit + this.primaryRadius * 1.5;
    const size = b.size;
    let mesh: THREE.Mesh;
    let mat: THREE.ShaderMaterial | null = null;
    if (b.kind === 'asteroids') {
      mesh = asteroidBelt(orbitR, hashSeed(b.id), b.richness);
      this.group.add(mesh);
      this.planets.push({ body: b, pivot, mesh, mat: null, speed: 0.02 / Math.pow(orbitR / 20, 1.5), phase: b.phase, radius: orbitR, extra: [] });
      this.pickables.push({ kind: 'system', id: `body:${b.id}`, pos: new THREE.Vector3(orbitR, 0, 0) });
      return;
    }
    const col = state.colonies[b.colonyId ?? ''];
    const pops = col ? col.pops.kin + col.pops.echoes + col.pops.chorus + col.pops.lattice + col.pops.coldminds : 0;
    mat = new THREE.ShaderMaterial({
      vertexShader: PLANET_VERT,
      fragmentShader: PLANET_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: (hashSeed(b.id) % 1000) / 37 },
        uKind: { value: KIND_INDEX[b.kind] ?? 0 },
        uVitality: { value: b.vitality },
        uLights: { value: settled ? Math.min(1, 0.35 + pops / 12) : 0 },
        // how built-up the settlement is: people plus everything they have built
        uDev: { value: settled && col ? Math.min(1, 0.15 + pops / 30 + Object.values(col.structures).reduce((a, n) => a + n, 0) / 40) : 0 },
        uNeon: { value: this.neon },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uSunColor: { value: light.color },
        uSunPower: { value: b.rogue ? 0.02 : light.power },
        uSubstellar: { value: new THREE.Vector3(-1, 0, 0) },
        uRust: { value: sys.rust ?? 0 },
        uFeeding: { value: b.feeding ? 1 : 0 },
      },
    });
    mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 64, 48), mat);
    mesh.position.set(orbitR, 0, 0);
    pivot.add(mesh);
    const extra: THREE.Object3D[] = [];
    if (b.kind === 'gas_giant' && hashSeed(b.id) % 3 === 0) {
      const ringM = new THREE.Mesh(new THREE.RingGeometry(size * 1.4, size * 2.2, 96), new THREE.MeshBasicMaterial({ color: '#8b7a6a', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
      ringM.rotation.x = -Math.PI / 2 + 0.3;
      mesh.add(ringM);
    }
    if (settled) {
      // habitat ring: a thin lit band around the settled world
      const hab = new THREE.Mesh(new THREE.TorusGeometry(size * 1.5, 0.03 + size * 0.01, 6, 96), new THREE.MeshBasicMaterial({ color: this.neon, transparent: true, opacity: 0.7 }));
      hab.rotation.x = Math.PI / 2 + 0.25;
      mesh.add(hab);
      extra.push(hab);
      if (col && (col.structures.mag_shield ?? 0) > 0) {
        const shield = new THREE.Mesh(new THREE.TorusGeometry(size * 0.9, 0.05, 8, 64), new THREE.MeshBasicMaterial({ color: '#a8d8ff', transparent: true, opacity: 0.8 }));
        shield.userData.l1 = true;
        pivot.add(shield);
        extra.push(shield);
      }
    }
    // orbit line
    const orbit = new THREE.Mesh(new THREE.RingGeometry(orbitR - 0.04, orbitR + 0.04, 180), new THREE.MeshBasicMaterial({ color: b.rogue ? '#4a4a52' : '#8a8f9c', transparent: true, opacity: b.rogue ? 0.08 : 0.16, side: THREE.DoubleSide, depthWrite: false }));
    orbit.rotation.x = -Math.PI / 2;
    this.group.add(orbit);
    this.group.add(pivot);
    const speed = b.rogue ? 0.004 : 0.25 / Math.pow(orbitR / 12, 1.5);
    this.planets.push({ body: b, pivot, mesh, mat, speed, phase: b.phase, radius: orbitR, extra });
    this.pickables.push({ kind: 'system', id: `body:${b.id}`, pos: mesh.position.clone() });
  }

  private buildStructures(state: GameState, sys: StarSystem) {
    const cols = Object.values(state.colonies).filter((c) => c.systemId === sys.id);
    const count = (k: string) => cols.reduce((a, c) => a + (c.structures[k] ?? 0), 0);
    const r0 = this.primaryRadius;
    // Dyson swarm: thousands of patched collectors, dark faces and lit seams
    const dysonCount = count('dyson_swarm') * 1400 + count('orbital_collector') * 90 + count('ember_collector') * 160;
    if (dysonCount > 0) {
      const geo = new THREE.PlaneGeometry(0.5, 0.32);
      const mat = new THREE.MeshBasicMaterial({ color: '#2a2622', side: THREE.DoubleSide });
      const inst = new THREE.InstancedMesh(geo, mat, dysonCount);
      const rng = new Rng(hashSeed(sys.id + 'dyson'));
      const lit = new THREE.Color('#ffb070');
      const dark = new THREE.Color('#231f1d');
      const neon = this.neon;
      for (let i = 0; i < dysonCount; i++) {
        const shell = i < count('dyson_swarm') * 1400;
        const r = shell ? r0 * rng.range(2.1, 3.4) : r0 * rng.range(3.5, 5.5);
        const axis = new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
        this.dysonSpin.push({ axis, speed: rng.range(0.05, 0.16) / Math.sqrt(r / r0), r, phase: rng.range(0, Math.PI * 2) });
        const c = rng.chance(0.06) ? neon : rng.chance(0.35) ? lit.clone().multiplyScalar(rng.range(0.4, 0.9)) : dark;
        inst.setColorAt(i, c);
      }
      this.dyson = inst;
      this.group.add(inst);
    }
  }

  private buildSwarm(state: GameState, sys: StarSystem) {
    const sw = Object.values(state.swarms).find((s) => s.systemId === sys.id && (s.awake || s.tamed));
    if (!sw) return;
    const n = Math.round(400 + sw.size * 120);
    const pos: number[] = [];
    const params: number[] = [];
    const rng = new Rng(hashSeed(sw.id));
    for (let i = 0; i < n; i++) {
      pos.push(0, 0, 0);
      params.push(rng.range(0, 100), rng.range(3, 9) + sw.size * 0.6, rng.range(0.5, 0.9), sw.size);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aParams', new THREE.Float32BufferAttribute(params, 4));
    this.swarmMat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec4 aParams;
        uniform float uTime;
        uniform vec3 uCenter;
        varying float vFlick;
        void main() {
          float t = uTime * aParams.z;
          float p = aParams.x;
          vec3 flow = vec3(sin(t * 0.7 + p * 1.3) + 0.6 * sin(t * 1.9 + p * 0.4), 0.5 * sin(t * 1.1 + p * 2.1), cos(t * 0.8 + p * 1.7) + 0.6 * cos(t * 1.5 + p * 0.8));
          vec3 shared = vec3(sin(t * 0.3), 0.3 * sin(t * 0.2), cos(t * 0.26)) * 1.2;
          vec3 pos = uCenter + (flow * 0.5 + shared) * aParams.y;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(90.0 / -mv.z, 1.0, 5.0);
          vFlick = 0.5 + 0.5 * sin(uTime * 6.0 + p * 23.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vFlick;
        void main() {
          if (length(gl_PointCoord - 0.5) > 0.5) discard;
          vec3 col = mix(vec3(0.04, 0.03, 0.03), uColor, step(0.85, vFlick));
          gl_FragColor = vec4(col, 0.85);
        }
      `,
      uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3(this.primaryRadius * 5, 2, this.primaryRadius * 3) }, uColor: { value: new THREE.Color(sw.tamed ? '#4fe3d1' : '#c0482c') } },
      transparent: true,
      depthWrite: false,
    });
    this.swarm = new THREE.Points(g, this.swarmMat);
    this.swarm.frustumCulled = false;
    this.group.add(this.swarm);
    this.pickables.push({ kind: 'swarm', id: sw.id, pos: (this.swarmMat.uniforms.uCenter.value as THREE.Vector3).clone() });
  }

  private buildFleets(state: GameState, sys: StarSystem) {
    const here = Object.values(state.fleets).filter((f) => f.at === sys.id);
    here.forEach((f, i) => {
      const hull = shipMesh(f.ships.some((s) => s.cls === 'warden' || s.cls === 'aegis'));
      hull.userData.orbit = { r: this.primaryRadius * 3.2 + 4 + i * 1.5, speed: 0.12, phase: i * 1.9 };
      this.fleets.add(hull);
      this.pickables.push({ kind: 'fleet', id: f.id, pos: new THREE.Vector3() });
    });
  }

  update(dt: number, camera: THREE.Camera) {
    this.time += dt;
    const t = this.time;
    if (this.starMat) this.starMat.uniforms.uTime.value = t;
    for (const m of this.glowMats) m.uniforms.uTime.value = t;
    for (const m of this.diskMats) m.uniforms.uTime.value = t;
    if (this.swarmMat) this.swarmMat.uniforms.uTime.value = t;
    this.group.traverse((o) => {
      if (o.userData.billboard) o.quaternion.copy(camera.quaternion);
    });
    const pick = (id: string) => this.pickables.find((p) => p.id === id);
    for (const pr of this.planets) {
      const a = pr.phase + t * pr.speed;
      pr.pivot.rotation.y = a;
      if (pr.body.kind === 'asteroids') {
        pr.mesh.rotation.y = a * 0.3;
        continue;
      }
      pr.mesh.rotation.y = pr.body.traits.includes('tidally_locked') ? 0 : t * 0.1;
      const world = new THREE.Vector3();
      pr.mesh.getWorldPosition(world);
      const p = pick(`body:${pr.body.id}`);
      if (p) p.pos.copy(world);
      if (pr.mat) {
        pr.mat.uniforms.uTime.value = t;
        const toSun = world.clone().multiplyScalar(-1).normalize();
        pr.mat.uniforms.uSunDir.value.copy(toSun);
        // tidally locked worlds keep one face to the star: its object-space direction
        const inv = new THREE.Matrix4().copy(pr.mesh.matrixWorld).invert();
        pr.mat.uniforms.uSubstellar.value.copy(toSun.clone().transformDirection(inv));
      }
      for (const e of pr.extra) {
        if (e.userData.l1) {
          // the magnetic shield sits between the world and its star
          e.position.copy(pr.mesh.position).multiplyScalar(0.86);
          e.lookAt(0, 0, 0);
        }
      }
    }
    if (this.dyson) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const v = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < this.dysonSpin.length; i++) {
        const s = this.dysonSpin[i];
        const a = s.phase + t * s.speed;
        const base = new THREE.Vector3().crossVectors(s.axis, up).normalize();
        if (base.lengthSq() < 0.01) base.set(1, 0, 0);
        v.copy(base).applyAxisAngle(s.axis, a).multiplyScalar(s.r);
        q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v.clone().normalize());
        m.compose(v, q, new THREE.Vector3(1, 1, 1));
        this.dyson.setMatrixAt(i, m);
      }
      this.dyson.instanceMatrix.needsUpdate = true;
    }
    for (const f of this.fleets.children) {
      const o = f.userData.orbit as { r: number; speed: number; phase: number };
      const a = o.phase + t * o.speed;
      f.position.set(Math.cos(a) * o.r, 1.2, Math.sin(a) * o.r);
      f.lookAt(Math.cos(a + 0.1) * o.r, 1.2, Math.sin(a + 0.1) * o.r);
    }
    const fleetPicks = this.pickables.filter((p) => p.kind === 'fleet');
    fleetPicks.forEach((p, i) => {
      const f = this.fleets.children[i];
      if (f) p.pos.copy(f.position);
    });
    if (this.selectedBody) {
      const p = pick(`body:${this.selectedBody}`) ?? pick(this.selectedBody);
      if (p) {
        const rig = this.planets.find((x) => x.body.id === this.selectedBody);
        const r = rig ? (rig.body.kind === 'asteroids' ? 3 : rig.body.size * 1.9) : 2;
        this.selRing.visible = true;
        this.selRing.position.copy(p.pos);
        this.selRing.lookAt(camera.position);
        this.selRing.scale.setScalar(r * (1 + 0.05 * Math.sin(t * 3)));
        // close up the planet fills the view; the ring steps back so it does not glare over it
        const k = camera.position.distanceTo(p.pos) / r;
        const fade = Math.min(1, Math.max(0, (k - 3) / 9));
        (this.selRing.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.68 * fade * fade * (3 - 2 * fade);
      } else this.selRing.visible = false;
    } else this.selRing.visible = false;
  }
}

function primaryLightColor(state: GameState, sys: StarSystem): { color: THREE.Color; power: number } {
  const p = sys.primary;
  const temp = primaryTemperature(p, state.years, state.era);
  const c = new THREE.Color(...blackbody(Math.max(1500, temp)));
  let power = 1.4;
  if (p.kind === 'blue_dwarf' || p.kind === 'helium_star' || p.kind === 'helium_giant') power = 2;
  if (p.kind === 'white_dwarf') power = state.era === 'dusk' ? 1.1 : 0.12;
  if (p.kind === 'black_dwarf') power = p.rekindle ? 0.3 : 0.03;
  if (p.kind === 'brown_dwarf') power = 0.12;
  if (p.kind === 'neutron_star') power = 0.3;
  if (p.kind === 'black_hole' || p.kind === 'smbh' || p.kind === 'void' || p.kind === 'rogue') {
    c.set('#8a7aa8');
    power = 0.05;
  }
  if (p.kind === 'dark_star') {
    c.set('#ffcfa0');
    power = 1.3;
  }
  return { color: c, power };
}

function backgroundStars(): THREE.Points {
  const rng = new Rng(99);
  const pos: number[] = [];
  const col: number[] = [];
  for (let i = 0; i < 2600; i++) {
    const th = rng.next() * Math.PI * 2;
    const ph = Math.acos(rng.range(-1, 1));
    const r = 1800;
    pos.push(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th));
    const c = blackbody(rng.range(2500, 3800));
    const b = rng.range(0.2, 1);
    col.push(c[0] * b, c[1] * b, c[2] * b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.8, depthWrite: false, map: radialTexture() }));
}

function asteroidBelt(r: number, seed: number, richness: number): THREE.Mesh {
  const rng = new Rng(seed);
  const n = 700;
  const geo = new THREE.IcosahedronGeometry(0.12, 0);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#2e2926' }), n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const a = rng.range(0, Math.PI * 2);
    const rr = r + rng.gauss() * 1.2;
    const s = rng.range(0.4, 1.6) * (0.6 + richness * 0.3);
    m.compose(new THREE.Vector3(Math.cos(a) * rr, rng.gauss() * 0.3, Math.sin(a) * rr), new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.next() * 3, rng.next() * 3, 0)), new THREE.Vector3(s, s, s));
    inst.setMatrixAt(i, m);
  }
  return inst as unknown as THREE.Mesh;
}

function shipMesh(war: boolean): THREE.Object3D {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 5), new THREE.MeshBasicMaterial({ color: war ? '#3a2e28' : '#2a2e33' }));
  hull.rotation.x = Math.PI / 2;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: war ? '#ffb070' : '#8fe8ff' }));
  glow.position.z = -0.55;
  g.add(hull, glow);
  return g;
}
