import * as THREE from 'three';
import { bodyClimate, brownWarmth, diskLight, emberShare, haloDrawn, primaryTemperature, pulsarBeam, seaBand, shownKind } from '../game/physics';
import { hashSeed, Rng } from '../game/rng';
import { survivorWorld } from '../game/sim/homes';
import { seenThere } from '../game/sim/claims';
import type { Body, Colony, ColonyForm, GameState, StarSystem, Survivor, Swarm } from '../game/types';
import { coolDwarfShine, radialTexture, type Pickable } from './galaxyView';
import { DISK_FRAG, DISK_VERT, GLOW_FRAG, GLOW_VERT, PLANET_FRAG, PLANET_VERT, STAR_FRAG, STAR_VERT, VIEW_MODE, thermalRGB } from './shaders/bodies';
import { blackbody } from './shaders/noise';
import { calendarEra, matterGone } from '../game/fate';
import { flowing } from '../game/sim/flow';
import { allColonies, allFleets, colonies, coloniesOf, fleets, formOf, ownColony } from '../game/sim/util';
import { fleetSeen, settlementSeen } from '../game/sim/others';
import { positroniumHere } from '../game/sim/positronium';
import { thinShare } from '../game/sim/thinning';
import { ironAge } from '../game/sim/deeptime';
import { ERA_BY_ID } from '../game/eras';
import type { Quality } from './engine';
import { fieldCage, fieldLattice, positroniumVeil, type FieldStyle } from './fields';
import { ANOMALIES } from '../game/data/events';
import { fleetLook, lookRole } from '../game/data/ships';

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

/** The selection circle on a world no one lives on (on a lived-on world it takes its ring's colour). */
const SELECT = new THREE.Color('#ffd9b0');

/**
 * The survey reveal (part 4), since 21 Oct a flight of the camera, as the player pictures it
 * (Endless Space 2's): a look at the star while a ring of light leaves it (`intro`; the ring takes
 * `pulse`); then a flight to each world in its turn (`dive` the first, down from the whole system;
 * `fly` each other, `flyMany` with more than six), dust streaking past, and a while at it (`hold`:
 * `holdAll` shared among them, within `holdMin` and `holdMax`; `find` more where the survey found
 * something), close and half in its star's light, its scan sweeping it in as the camera arrives
 * (from `scanA` to `scanB`, counted from the arrival); at the last world, where the star shines,
 * the camera comes round its night side until the star rises over its edge (`sunrise` more); then
 * back out to the whole system (`out`), the orbits drawn in from the star outward (each over
 * `orbit`, `stagger` apart). Seconds of the view's clock; Next (a click, Space) cuts a while short.
 */
const REVEAL = { intro: 1.5, pulse: 1.4, dive: 1.35, fly: 1.0, flyMany: 0.8, holdAll: 10, holdMin: 1.6, holdMax: 2.3, find: 1.1, sunrise: 1.8, out: 1.7, scanA: -0.25, scanB: 0.7, orbit: 0.6, stagger: 0.1 };
/** How fast the camera glides along an asteroid belt while it is there (world units a second). */
const BELT_GLIDE = 1.1;
/** The dust that streaks past in a flight: how many motes, and how long a streak is (the way the camera goes in this long, at most a third of the dust's cell). */
const DUST = 180;
const STREAK = 0.012;
const UP = new THREE.Vector3(0, 1, 0);

/** Where the reveal has come to, for its caption (UI): the world (null at the star and on the way out), its place, how many, and where the flight is. */
export interface RevealStep {
  systemId: string;
  bodyId: string | null;
  index: number;
  total: number;
  /** At the star, on the way to the world, at it, or back out to the whole system. */
  phase: 'intro' | 'fly' | 'hold' | 'outro';
}

/** Where the camera is, in OrbitRig's terms: what it looks at, from how far, from which way and how high. */
export interface CinePose {
  target: THREE.Vector3;
  distance: number;
  yaw: number;
  pitch: number;
}

/** How a reveal ended: played out, skipped (back to the whole system), or let go of where it was (a hand on the view, another system, another game). */
export type RevealEnd = 'done' | 'skip' | 'drop';

/** One world's part in the reveal. */
interface Shot {
  id: string;
  kind: 'world' | 'belt' | 'deep';
  /** The flight to it. */
  fly: number;
  /** Its while there as planned (what the camera does there is timed by it), and as it is (Next cuts it short). */
  plan: number;
  hold: number;
  /** The last world, its star rising over its edge. */
  sunrise: boolean;
}

interface Reveal {
  systemId: string;
  /** The view's time it began at. */
  start: number;
  /** The look at the star (Next cuts it short). */
  intro: number;
  /** The worlds in the order they come. */
  shots: Shot[];
  /** Each world's place from the star outward: its orbit is drawn in in that order on the way out. */
  rank: Map<string, number>;
  /** How far the star's pulse goes: past the last orbit. */
  reach: number;
  /** Which way the view faced as it began: the whole system is seen from there again at the end. */
  yaw0: number;
  /** A world the view was entered to look at: the flight ends on it, not on the whole system. */
  focus: string | null;
  /** The dust's cell (world units): as many motes in every cube this wide. */
  cell: number;
}

/** When each part of a reveal begins (seconds from its start): each flight, each arrival, the way out, the end. */
interface Schedule {
  fly: number[];
  at: number[];
  out: number;
  end: number;
}

const FIND_IDS = new Set(ANOMALIES.map((a) => a.id));

/** A survey found something here: ruins (a relic) or a remarkable find (Story.tsx worldFinds). */
function hasFind(b: Body | undefined): boolean {
  return !!b && ((!!b.relic && b.relic.state !== 'hidden') || b.traits.some((t) => FIND_IDS.has(t)));
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

const KIND_INDEX: Record<string, number> = { eyeball: 1, terran: 1, super_earth: 0, barren: 0, ice: 2, ocean_ice: 5, gas_giant: 3, ice_giant: 4 };

export class SystemView {
  group = new THREE.Group();
  systemId: string | null = null;
  pickables: Pickable[] = [];
  private starMat: THREE.ShaderMaterial | null = null;
  private rockMats: { mat: THREE.MeshBasicMaterial; tempK: number; rust: number }[] = [];
  /** Motes of a feeding swarm on the worlds it is eating: they follow their world round its orbit. */
  private eatMotes: { mat: THREE.ShaderMaterial; rig: PlanetRig }[] = [];
  private glowMats: THREE.ShaderMaterial[] = [];
  private diskMats: THREE.ShaderMaterial[] = [];
  private planets: PlanetRig[] = [];
  private swarm: THREE.Points | null = null;
  private swarmMat: THREE.ShaderMaterial | null = null;
  private dyson: THREE.InstancedMesh | null = null;
  private dysonSpin: { axis: THREE.Vector3; speed: number; r: number; phase: number }[] = [];
  private fleets = new THREE.Group();
  /** Other civilizations' habitats: groups that turn slowly, some following their world, lights that breathe. */
  private habitats: { obj: THREE.Object3D; spin: number; follow: THREE.Object3D | null; pulse: THREE.MeshBasicMaterial[] }[] = [];
  /** Sleepers' vault lights, breathing slowly. */
  private sleepLights: THREE.ShaderMaterial[] = [];
  /** What is not matter (fields.ts): every material that breathes on elapsed time, and what turns slowly. */
  private fieldMats: THREE.ShaderMaterial[] = [];
  private fieldSpin: { obj: THREE.Object3D; speed: number }[] = [];
  /** The quality setting (Engine.setQuality): how many filaments, motes and ellipses, and whether colour may go past white for the bloom. */
  quality: Quality = 'high';
  /** What the last build drew of what is not matter, and of matter thinning or turned to iron (for the checks). */
  look = { fields: 0, segments: 0, motes: 0, loops: 0, cages: 0, writ: 0, veil: 0, thin: 0, iron: 0 };
  private stars: THREE.Points;
  private time = 0;
  /** Orbital clock: stands still while orbits are paused (the stars keep burning on `time`). */
  private orbitTime = 0;
  orbitsPaused = false;
  primaryRadius = 5;
  /** How far back the camera stands to see the whole system: further for one with cold worlds far out. */
  frameDistance(): number {
    const far = this.planets.reduce((m, p) => (p.body.rogue ? m : Math.max(m, p.radius)), 0);
    return Math.max(70 + this.primaryRadius * 4, far * 1.1);
  }
  neon = new THREE.Color('#4fe3d1');
  selectedBody: string | null = null;
  /** The survey reveal playing, if one is (kept across a rebuild of the same system; applied in update). */
  private reveal: Reveal | null = null;
  private revealAt = '';
  /** Where its flight is (null with none playing). */
  private cinePhase: RevealStep['phase'] | null = null;
  /** Told where the reveal has come to, and null once it is over (Engine: the caption). */
  onReveal: ((r: RevealStep | null) => void) | null = null;
  /** Told how it ended, with the world the view was entered for and which way it faced at first (Engine: the camera after it). */
  onRevealEnd: ((how: RevealEnd, focus: string | null, yaw0: number) => void) | null = null;
  /** Where the reveal puts the camera this frame (Engine: the rig), null when none is flying. */
  cinema: CinePose | null = null;
  /** The magnifier mode (Engine): worlds in the middle of what its column leaves, and no dust. */
  lowVision = false;
  /** How strongly the star lights its worlds (primaryLightColor): one that shines rises over the last world of a reveal. */
  private sunPower = 1;
  /** The reveal's first moment: a ring of light leaving the star. */
  private pulse: THREE.Mesh;
  /** Dust streaking past in the reveal's flights: lines from each mote back along the camera's way. */
  private dust: THREE.LineSegments;
  private dustSeed = new Float32Array(DUST * 3);

  /** Where a body is right now, and how big: for the camera to fly to and follow. */
  /** Where a fleet in this system is drawn right now. */
  fleetPos(id: string): THREE.Vector3 | null {
    return this.pickables.find((x) => x.kind === 'fleet' && x.id === id)?.pos ?? null;
  }

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
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.03, 96), new THREE.MeshBasicMaterial({ color: SELECT.clone(), transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    this.selRing.visible = false;
    this.pulse = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 160), new THREE.MeshBasicMaterial({ color: this.neon.clone(), transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pulse.rotation.x = -Math.PI / 2;
    this.pulse.visible = false;
    const rng = new Rng(4129);
    for (let i = 0; i < this.dustSeed.length; i++) this.dustSeed[i] = rng.next();
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST * 6), 3).setUsage(THREE.DynamicDrawUsage));
    dg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(DUST * 6), 3).setUsage(THREE.DynamicDrawUsage));
    this.dust = new THREE.LineSegments(dg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.dust.frustumCulled = false;
    this.dust.visible = false;
  }

  private clear() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mat && !Array.isArray(mat) && mat !== this.selRing.material && mat !== this.pulse.material && mat !== this.dust.material) mat.dispose();
    });
    this.group.clear();
    this.planets = [];
    this.glowMats = [];
    this.rockMats = [];
    this.diskMats = [];
    this.pickables = [];
    this.dyson = null;
    this.dysonSpin = [];
    this.swarm = null;
    this.swarmMat = null;
    this.eatMotes = [];
    this.habitats = [];
    this.sleepLights = [];
    this.fieldMats = [];
    this.fieldSpin = [];
    this.look = { fields: 0, segments: 0, motes: 0, loops: 0, cages: 0, writ: 0, veil: 0, thin: 0, iron: 0 };
    this.fleets = new THREE.Group();
    this.starMat = null;
  }

  build(state: GameState, systemId: string) {
    // (a reveal belongs to its system: another one built ends it)
    if (this.reveal && this.reveal.systemId !== systemId) this.endReveal('drop');
    this.clear();
    this.systemId = systemId;
    const sys = state.systems[systemId];
    this.group.add(this.stars);
    (this.stars.material as THREE.PointsMaterial).opacity = state.era === 'dusk' ? 0.8 : state.era === 'degenerate' ? 0.35 : state.era === 'blackhole' ? 0.12 : 0.03;
    this.group.add(this.selRing);
    this.group.add(this.pulse);
    this.group.add(this.dust);
    this.buildPrimary(state, sys);
    const light = primaryLightColor(state, sys);
    this.sunPower = light.power;
    const colonized = new Set(colonies(state).filter((c) => c.systemId === sys.id).map((c) => c.bodyId));
    // until a probe has surveyed it, a system is only its star: the worlds are not charted yet
    const surveyed = state.civ.known[sys.id] === 2 || colonized.size > 0;
    // other civilizations living here: a civilization of its own in every settlement of its whose
    // light has reached us, one simulated lightly on the world its way of life calls for
    const residents = new Map<string, Survivor>();
    // (and what their settlements there are made of, where they are civilizations of their own)
    const theirForms = new Map<string, ColonyForm>();
    if (surveyed) {
      for (const v of Object.values(state.survivors)) {
        if (!v.alive || !v.systems.includes(sys.id) || (v.homeSystemId !== sys.id && !seenThere(state, v, sys.id))) continue;
        if (state.civs[v.id]) {
          for (const c of coloniesOf(state, v.id)) {
            if (c.systemId !== sys.id || !settlementSeen(state, c) || !state.bodies[c.bodyId]) continue;
            residents.set(c.bodyId, v);
            theirForms.set(c.bodyId, formOf(c));
          }
        } else {
          const w = survivorWorld(state, v, sys.id);
          if (w) residents.set(w.id, v);
        }
      }
    }
    // the Thinning: the share of ordinary matter gone, for whatever here is still made of it
    THIN.value = thinShare(state);
    this.look.thin = THIN.value;
    const iron = ironAge(state);
    for (const bid of surveyed ? sys.bodies : []) {
      const b = state.bodies[bid];
      if (!b || b.dissolved) continue;
      const from = this.group.children.length;
      if (b.kind === 'deep') this.buildDeep(state, sys, b, colonized.has(b.id), residents.get(b.id), theirForms.get(b.id));
      else this.buildBody(state, sys, b, light, colonized.has(b.id), residents.get(b.id), theirForms.get(b.id), iron);
      // whatever was drawn for it waits for its turn in a survey reveal
      for (let i = from; i < this.group.children.length; i++) this.group.children[i].userData.reveal = b.id;
    }
    if (surveyed) this.buildStructures(state, sys);
    // the positronium, everywhere at once while it lasts: brighter where our minds are woven through it
    if (positroniumHere(state)) this.buildVeil(state, sys);
    this.buildSwarm(state, sys);
    this.buildFleets(state, sys);
    this.group.add(this.fleets);
  }

  private buildPrimary(state: GameState, sys: StarSystem) {
    const p = sys.primary;
    const iron = ironAge(state);
    const seed = (hashSeed(sys.id) % 1000) / 10;
    const temp = primaryTemperature(p, state.years, calendarEra(state), 0, 0, haloDrawn(state));
    const col = new THREE.Color(...blackbody(Math.max(1500, temp)));
    const addGlow = (size: number, color: THREE.Color, power: number, beams = 0, ring = 0) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: GLOW_VERT,
        fragmentShader: GLOW_FRAG,
        uniforms: { uTime: { value: 0 }, uColor: { value: color }, uPower: { value: power }, uBeams: { value: beams }, uRing: { value: ring }, uWrit: { value: 0 }, uWritColor: { value: new THREE.Color() }, uGain: { value: this.quality === 'low' ? 1 : 1.6 } },
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
        uniforms: { uTime: { value: 0 }, uColor: { value: color }, uGranule: { value: granule }, uBands: { value: bands }, uIntensity: { value: intensity }, uSeed: { value: seed }, uViewMode: VIEW_MODE, uTempK: { value: temp } },
      });
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 48), this.starMat);
      this.group.add(m);
      this.primaryRadius = r;
      this.pickables.push({ kind: 'system', id: sys.id, pos: new THREE.Vector3(), radius: r });
    };
    // (a new star already out is drawn as the cold dwarf it is becoming)
    const kind = shownKind(p, state.years);
    switch (kind) {
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
        if (iron || p.exploded) {
          // everything fused to iron by tunnelling (or the iron core a black dwarf supernova left): a cold, faintly metallic sphere
          addStar(1.6, IRON_STAR.clone(), 0.08, 0, 0.7);
          this.look.iron++;
        } else if (calendarEra(state) === 'dusk') {
          // too cool to glow (below about 780 K, where hot ground starts to) it looks like an ember,
          // a little more copper; it brightens into its own colour as it gets hotter
          const shine = coolDwarfShine(temp);
          addStar(1.6, COOL_DWARF.clone().lerp(col, shine), 0.1 + 0.05 * (1 - shine), 0, 0.9 + 2.1 * shine);
          addGlow(14 + 6 * shine, COOL_DWARF_GLOW.clone().lerp(col, shine), 0.35 + 0.75 * shine);
        } else {
          // dark as a black dwarf once nothing warms it; an ember keeps a dull red warmth while the halo lasts
          const ember = emberShare(p, state.years, haloDrawn(state));
          const surface = new THREE.Color('#2a2628').lerp(new THREE.Color('#6d4a52'), ember);
          addStar(1.6, surface, 0.15, 0, 0.6 + 0.3 * ember);
          if (ember > 0) addGlow(14, new THREE.Color('#8a4f4a'), 0.35 * ember);
        }
        break;
      case 'black_dwarf':
        addStar(1.6, iron || p.exploded ? IRON_STAR.clone() : new THREE.Color('#2a2628'), 0.1, 0, iron || p.exploded ? 0.7 : 0.6);
        if (iron || p.exploded) this.look.iron++;
        break;
      case 'brown_dwarf': {
        // after the Dusk it darkens as it cools, its glow going with its warmth: in the Black Hole
        // Age as dark as a black dwarf (until 12 Oct it glowed the same in every age)
        const warm = calendarEra(state) === 'dusk' ? 1 : brownWarmth(temp);
        addStar(3.4, calendarEra(state) === 'dusk' ? new THREE.Color('#7a3a33') : new THREE.Color('#2a2628').lerp(new THREE.Color('#3c2225'), warm), 0.2, 1.0, 0.6 + 0.3 * warm);
        if (warm > 0.02) addGlow(14, new THREE.Color('#5a2420'), 0.35 * warm);
        break;
      }
      case 'neutron_star': {
        // it shines by its spin, as its collectors' light does: beams in the Dusk, fading through
        // the Degenerate Age, then a dark, spun-down sphere (it blazed the same in every age)
        const beam = pulsarBeam(calendarEra(state), state.years);
        addStar(0.8, new THREE.Color('#2c2b34').lerp(new THREE.Color('#dde8ff'), beam), 0.1, 0, 0.6 + 2.4 * beam);
        if (beam > 0.02) addGlow(40, new THREE.Color('#9cc3ff'), (calendarEra(state) === 'dusk' ? 0.9 : 0.4) * beam, 0.6 * beam);
        break;
      }
      case 'black_hole':
      case 'smbh': {
        const r = kind === 'smbh' ? 6 : 2.6;
        const hole = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshBasicMaterial({ color: '#000000' }));
        this.group.add(hole);
        this.primaryRadius = r;
        this.pickables.push({ kind: 'system', id: sys.id, pos: new THREE.Vector3(), radius: r });
        const ringGlow = addGlow(r * 6, new THREE.Color('#ffd2a8'), 0.0, 0, 1.0);
        // minds written into the horizon ride the photon ring: ours in the age's neon, another's in its colour
        const writ = this.horizonWriters(state, sys);
        if (writ) {
          const u = (ringGlow.material as THREE.ShaderMaterial).uniforms;
          u.uWrit.value = 1;
          u.uWritColor.value.copy(writ);
          this.look.writ++;
        }
        // a Bastion Shell of ours: a shell of field lines round the hole
        const bastions = colonies(state).filter((c) => c.systemId === sys.id).reduce((a, c) => a + (c.structures.bastion ?? 0), 0);
        if (bastions > 0) {
          const cage = fieldCage(r * 2.2, new THREE.Color(ERA_BY_ID[state.era].accent), this.quality, hashSeed(sys.id + 'bastion'), 0.35 + 0.15 * Math.min(3, bastions));
          cage.obj.rotation.x = 0.4;
          this.group.add(cage.obj);
          this.fieldMats.push(cage.mat);
          this.fieldSpin.push({ obj: cage.obj, speed: 0.02 });
          this.look.cages++;
          this.look.segments += cage.segments;
        }
        const fed = allColonies(state).some((c) => c.systemId === sys.id && ((c.structures.accretion_engine ?? 0) > 0 || (c.structures.penrose_harvester ?? 0) > 0));
        const shine = diskLight(kind, calendarEra(state), state.years, !matterGone(state));
        const heat = fed ? 1.0 : kind === 'smbh' ? Math.min(0.75, 0.12 + shine * 0.4) : 0.18;
        // (no matter left to fall in: no disk, whatever harvests the hole's spin)
        if (!matterGone(state)) this.addDisk(r * 1.6, r * (kind === 'smbh' ? 9 : 6), heat);
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

  private buildDeep(state: GameState, sys: StarSystem, b: Body, settled: boolean, sv?: Survivor, theirForm?: ColonyForm) {
    const r = this.primaryRadius * 2.4 + 3;
    const other = sv ? othersColor(sv) : null;
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.12, 128), new THREE.MeshBasicMaterial({ color: settled ? this.neon : (other ?? '#6b6f7a'), transparent: true, opacity: settled ? 0.55 : other ? 0.4 : 0.18, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    // (the Deep is its ring: in a survey reveal it comes with its turn, not with the orbits)
    ring.userData.deep = (ring.material as THREE.MeshBasicMaterial).opacity;
    this.group.add(ring);
    const pos = new THREE.Vector3(r, 0, 0);
    this.pickables.push({ kind: 'system', id: `body:${b.id}`, pos });
    const ours = settled ? colonies(state).find((c) => c.bodyId === b.id) : undefined;
    const form = ours ? formOf(ours) : 'baryonic';
    // (minds written into the horizon are on its photon ring: buildPrimary)
    if (ours && form !== 'baryonic') {
      if (form !== 'horizon') this.addField(state, ours, ours.id, pos, null, 0, this.neon, 'ours', form === 'positronium' ? 0.6 : 1);
    } else if (settled) {
      // a station of matter: a small lit hull on the Deep ring (it thins with matter)
      const hull = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.3), withDissolve(new THREE.MeshBasicMaterial({ color: '#1a1a1f' })));
      hull.position.copy(pos);
      const lights = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.32), withDissolve(new THREE.MeshBasicMaterial({ color: this.neon })));
      lights.position.copy(pos);
      this.group.add(hull, lights);
    }
    // another civilization's, where the Deep is theirs: its fields, if it is no longer made of matter, or its orbital habitats
    if (sv && other) {
      if (theirForm && theirForm !== 'baryonic') {
        if (theirForm !== 'horizon') this.addField(state, null, sv.id + b.id, pos, null, 0, other, styleOf(sv), theirForm === 'positronium' ? 0.6 : 1);
      } else this.addHabitats(sv, other, pos.clone(), null, 0);
    }
    void sys;
  }

  /**
   * A settlement no longer made of matter, drawn as its fields (fields.ts): round a point of its
   * own in the Deep (`at`), or round its world (`follow`, of radius `core`). Ours carries the age's
   * neon wave, another's its own colour; what stands there (`c`, ours) shows in it. Returns the
   * standing wave, the ring that says whose it is.
   */
  private addField(state: GameState, c: Colony | null, key: string, at: THREE.Vector3 | null, follow: THREE.Mesh | null, core: number, mark: THREE.Color, style: FieldStyle, faint = 1): THREE.Mesh {
    const n = (ids: string[]) => (c ? ids.reduce((a, id) => a + (c.structures[id] ?? 0), 0) : 0);
    const accent = new THREE.Color(ERA_BY_ID[state.era].accent);
    const deep = !follow;
    const rig = fieldLattice({
      core: deep ? 0.3 : core,
      reach: deep ? 2.4 : core * 2.9,
      color: (style === 'ours' ? accent : mark.clone().lerp(accent, 0.3)).multiplyScalar(faint),
      mark,
      quality: this.quality,
      seed: hashSeed(key + 'fields'),
      style,
      minds: n(['substrate_core', 'cold_vault', 'lattice_foundry', 'confluence_node', 'lepton_substrate', 'lepton_confluence']),
      stores: n(['reserve_vault', 'superconducting_ring']),
      catchers: n(['burst_catcher']),
      nets: n(['positronium_net']),
    });
    const g = rig.group;
    if (deep) {
      // a point of light at its heart, so it can be found from across the system
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: mark, transparent: true, opacity: 0.45 * faint, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.scale.setScalar(1.3);
      g.add(glow);
      g.position.copy(at!);
      g.rotation.set(0.45, 0, 0.2);
      this.group.add(g);
      this.fieldSpin.push({ obj: g, speed: 0.03 });
    } else {
      g.rotation.x = 0.25;
      follow.add(g);
    }
    rig.ring.userData.mark = true;
    this.fieldMats.push(...rig.mats);
    this.look.fields++;
    this.look.segments += rig.counts.segments;
    this.look.motes += rig.counts.motes;
    this.look.loops += rig.counts.loops;
    if (c && (c.structures.burst_catcher ?? 0) > 0) this.look.cages++;
    return rig.ring;
  }

  private buildBody(state: GameState, sys: StarSystem, b: Body, light: { color: THREE.Color; power: number }, settled: boolean, sv?: Survivor, theirForm?: ColonyForm, iron = false) {
    const pivot = new THREE.Object3D();
    const orbitR = b.rogue ? b.orbit * 2.6 + 30 : b.orbit + this.primaryRadius * 1.5;
    const size = b.size;
    let mesh: THREE.Mesh;
    let mat: THREE.ShaderMaterial | null = null;
    if (b.kind === 'asteroids') {
      mesh = asteroidBelt(orbitR, hashSeed(b.id), b.richness, flowing(state));
      mesh.userData.belt = (mesh as unknown as THREE.InstancedMesh).count;
      this.rockMats.push({ mat: mesh.material as THREE.MeshBasicMaterial, tempK: bodyClimate(state, b).mean, rust: sys.rust ?? 0 });
      this.applyViewMode();
      this.group.add(mesh);
      this.planets.push({ body: b, pivot, mesh, mat: null, speed: 0.02 / Math.pow(orbitR / 20, 1.5), phase: b.phase, radius: orbitR, extra: [] });
      this.pickables.push({ kind: 'system', id: `body:${b.id}`, pos: new THREE.Vector3(orbitR, 0, 0) });
      return;
    }
    const col = b.colonyId ? ownColony(state, b.colonyId) : undefined;
    const climate = bodyClimate(state, b);
    const band = seaBand(climate);
    const eating = feedingSwarm(state, sys);
    const pops = col ? col.pops.kin + col.pops.echoes + col.pops.chorus + col.pops.lattice + col.pops.coldminds : 0;
    // a settlement of ours that made the Passage is its fields now, round the world: no cities on it
    const fields = settled && !!col && formOf(col) !== 'baryonic';
    // another civilization that lives on the surface: their cities, in their own colour
    const other = sv ? othersColor(sv) : null;
    const surface = !!sv && (sv.way === 'garden' || sv.way === 'dormant' || sv.way === 'fork');
    mat = new THREE.ShaderMaterial({
      vertexShader: PLANET_VERT,
      fragmentShader: PLANET_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uSeed: { value: (hashSeed(b.id) % 1000) / 37 },
        uKind: { value: KIND_INDEX[b.kind] ?? 0 },
        uVitality: { value: b.vitality },
        uLights: { value: fields ? 0 : settled ? Math.min(1, 0.35 + pops / 12) : surface ? (sv!.way === 'dormant' ? 0.3 : sv!.way === 'fork' ? 0.7 : 0.85) : 0 },
        // how built-up the settlement is: people plus everything they have built
        uDev: { value: fields ? 0 : settled && col ? Math.min(1, 0.15 + pops / 30 + Object.values(col.structures).reduce((a, n) => a + n, 0) / 40) : surface ? (sv!.way === 'dormant' ? 0.12 : Math.min(1, 0.25 + sv!.pop / 40)) : 0 },
        uNeon: { value: surface && other ? other : this.neon },
        uCityCol: { value: surface && other ? other.clone().lerp(new THREE.Color(1.0, 0.62, 0.3), 0.25) : new THREE.Color(1.0, 0.62, 0.3) },
        uSunDir: { value: new THREE.Vector3(1, 0, 0) },
        uSunColor: { value: light.color },
        uSunPower: { value: b.rogue ? 0.02 : light.power },
        uSubstellar: { value: new THREE.Vector3(-1, 0, 0) },
        uRust: { value: sys.rust ?? 0 },
        uFeeding: { value: b.feeding ? 1 : 0 },
        uEaten: { value: eating ? Math.min(1, 0.4 + eating.size / 12) : 0 },
        // the Long Flow: the ground has run smooth
        uFlow: { value: flowing(state) ? 1 : 0 },
        uViewMode: VIEW_MODE,
        uTempDay: { value: climate.day ?? climate.mean },
        uTempNight: { value: climate.night ?? climate.mean },
        // its sea where the Water row puts it (one band for both, physics.ts)
        uSeaFrom: { value: band.from },
        uSeaTo: { value: band.to },
        // its water boiled into a sky of steam all round: thick on a water-rich world past the
        // runaway greenhouse, thinner the less water there was
        uSteam: { value: climate.steam ? 1 : band.to < -1 && !climate.airless ? Math.min(1, (b.water ?? 0) / 0.3) : 0 },
        uAir: { value: climate.airless ? 0 : 1 },
        uWater: { value: b.water ?? 0 },
        // an eyeball is one face to its star by definition; any other world only if it is locked
        uLocked: { value: b.kind === 'eyeball' || b.traits.includes('tidally_locked') ? 1 : 0 },
        // matter stable, past 10^1500 years: iron through and through
        uIron: { value: iron ? 1 : 0 },
        // the survey reveal sweeps it in (update)
        uReveal: { value: 1 },
        uScan: { value: this.neon },
      },
    });
    if (iron) this.look.iron++;
    mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 64, 48), mat);
    mesh.position.set(orbitR, 0, 0);
    pivot.add(mesh);
    const extra: THREE.Object3D[] = [];
    if (b.kind === 'gas_giant' && hashSeed(b.id) % 3 === 0) {
      const ringM = new THREE.Mesh(new THREE.RingGeometry(size * 1.4, size * 2.2, 96), new THREE.MeshBasicMaterial({ color: '#8b7a6a', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
      ringM.rotation.x = -Math.PI / 2 + 0.3;
      mesh.add(ringM);
    }
    if (fields) {
      // its fields round the world; their standing wave says whose it is (the selection circle takes its place)
      extra.push(this.addField(state, col!, col!.id, null, mesh, size, this.neon, 'ours', formOf(col!) === 'positronium' ? 0.6 : 1));
    } else if (settled) {
      // habitat ring: a thin lit band around the settled world (it thins with matter)
      const hab = new THREE.Mesh(new THREE.TorusGeometry(size * 1.5, 0.03 + size * 0.01, 6, 96), withDissolve(new THREE.MeshBasicMaterial({ color: this.neon, transparent: true, opacity: 0.7 })));
      hab.rotation.x = Math.PI / 2 + 0.25;
      // whose world this is: selected, the selection circle takes its place and colour (update)
      hab.userData.mark = true;
      mesh.add(hab);
      extra.push(hab);
      if (col && (col.structures.mag_shield ?? 0) > 0) {
        const shield = new THREE.Mesh(new THREE.TorusGeometry(size * 0.9, 0.05, 8, 64), withDissolve(new THREE.MeshBasicMaterial({ color: '#a8d8ff', transparent: true, opacity: 0.8 })));
        shield.userData.l1 = true;
        pivot.add(shield);
        extra.push(shield);
      }
    }
    if (sv && other && theirForm && theirForm !== 'baryonic' && theirForm !== 'horizon' && !surface) {
      // another's settlement past matter: its fields round the world, in its colour
      extra.push(this.addField(state, null, sv.id + b.id, null, mesh, size, other, styleOf(sv), theirForm === 'positronium' ? 0.6 : 1));
    } else if (sv && other) {
      if (surface) {
        // a thin ring in their colour marks a world someone else lives on (sleepers show only their faint lights)
        if (sv.way !== 'dormant') {
          const theirs = new THREE.Mesh(new THREE.TorusGeometry(size * 1.45, 0.02 + size * 0.008, 6, 96), new THREE.MeshBasicMaterial({ color: other, transparent: true, opacity: 0.45 }));
          theirs.rotation.x = Math.PI / 2 - 0.35;
          theirs.userData.mark = true;
          mesh.add(theirs);
          extra.push(theirs);
        } else this.sleepLights.push(mat);
      } else {
        // minds on substrate with no Deep to live in: their habitats orbit their world
        this.addHabitats(sv, other, null, mesh, size * 1.4);
      }
    }
    // orbit line
    const orbit = new THREE.Mesh(new THREE.RingGeometry(orbitR - 0.04, orbitR + 0.04, 180), new THREE.MeshBasicMaterial({ color: b.rogue ? '#4a4a52' : '#8a8f9c', transparent: true, opacity: b.rogue ? 0.08 : 0.16, side: THREE.DoubleSide, depthWrite: false }));
    orbit.rotation.x = -Math.PI / 2;
    orbit.userData.orbit = (orbit.material as THREE.MeshBasicMaterial).opacity;
    this.group.add(orbit);
    pivot.userData.world = true;
    this.group.add(pivot);
    const speed = b.rogue ? 0.004 : 0.25 / Math.pow(orbitR / 12, 1.5);
    this.planets.push({ body: b, pivot, mesh, mat, speed, phase: b.phase, radius: orbitR, extra });
    if (eating) this.addFeedingMotes(this.planets[this.planets.length - 1], eating, size);
    // the Thinning: the world's matter going, a haze of motes drifting off it
    if (THIN.value > 0) this.addThinMotes(this.planets[this.planets.length - 1], size);
    this.pickables.push({ kind: 'system', id: `body:${b.id}`, pos: mesh.position.clone(), radius: size });
  }

  /**
   * Another civilization's habitats, shaped by how they live: a flotilla of archive stations for
   * uploaded minds, one ring-station whose lights breathe together for a merged Chorus, a lattice
   * of identical cells for processes. `clear` keeps them outside a host world's surface.
   */
  private addHabitats(sv: Survivor, color: THREE.Color, anchor: THREE.Vector3 | null, follow: THREE.Object3D | null, clear: number) {
    const g = new THREE.Group();
    const rng = new Rng(hashSeed(sv.id + 'habitats'));
    const hullMat = new THREE.MeshBasicMaterial({ color: '#16151b' });
    const lightMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
    const pulse: THREE.MeshBasicMaterial[] = [];
    if (sv.way === 'chorus') {
      const R = Math.max(1.3, clear + 0.5);
      const torus = new THREE.Mesh(new THREE.TorusGeometry(R, 0.14, 8, 72), hullMat);
      torus.rotation.x = Math.PI / 2;
      g.add(torus);
      const node = new THREE.SphereGeometry(0.2, 12, 8);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const m = new THREE.Mesh(node, lightMat);
        m.position.set(Math.cos(a) * R, 0, Math.sin(a) * R);
        g.add(m);
      }
      if (!follow) {
        // the heart of the station, and spokes to it, where no world sits in the middle
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), lightMat));
        const spoke = new THREE.CylinderGeometry(0.025, 0.025, R, 4);
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const sp = new THREE.Mesh(spoke, hullMat);
          sp.position.set(Math.cos(a) * R * 0.5, 0, Math.sin(a) * R * 0.5);
          sp.rotation.set(0, -a, Math.PI / 2);
          g.add(sp);
        }
      }
      pulse.push(lightMat);
    } else if (sv.way === 'lattice') {
      const n = 5;
      const step = 0.45;
      const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), lightMat, n * n * 3);
      const off = follow ? clear + (n * step) / 2 + 0.6 : 0;
      const m4 = new THREE.Matrix4();
      let k = 0;
      for (let x = 0; x < n; x++)
        for (let z = 0; z < n; z++)
          for (let y = 0; y < 3; y++) {
            if (rng.chance(0.25)) continue;
            m4.makeTranslation(off + (x - (n - 1) / 2) * step, (y - 1) * step, (z - (n - 1) / 2) * step);
            cells.setMatrixAt(k++, m4);
          }
      cells.count = k;
      g.add(cells);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(n * step, 3 * step, n * step), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.22 }));
      frame.position.x = off;
      g.add(frame);
    } else {
      for (let i = 0; i < 7; i++) {
        const st = new THREE.Group();
        const len = rng.range(0.6, 1.2);
        st.add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.22, 0.22), hullMat));
        st.add(new THREE.Mesh(new THREE.BoxGeometry(len * 1.02, 0.05, 0.24), lightMat));
        const r = clear > 0 ? clear + rng.range(0.3, 1.2) : rng.range(0.4, 2.2);
        const a = rng.range(0, Math.PI * 2);
        st.position.set(Math.cos(a) * r, rng.range(-0.5, 0.5), Math.sin(a) * r);
        st.rotation.set(rng.range(0, Math.PI), rng.range(0, Math.PI), 0);
        g.add(st);
      }
    }
    // a soft glow, so their home can be found from across the system
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color, transparent: true, opacity: follow ? 0.18 : 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(follow ? clear * 3 : 5.5);
    g.add(glow);
    if (anchor) g.position.copy(anchor);
    // in the Deep they stand alone: a little larger, so they hold their own beside the planets
    if (!follow) g.scale.setScalar(1.4);
    this.group.add(g);
    this.habitats.push({ obj: g, spin: sv.way === 'lattice' ? 0.05 : 0.12, follow, pulse });
  }

  /** Whose minds are written into this hole's horizon: ours (in the age's neon) first, else another's whose light has shown them to us. */
  private horizonWriters(state: GameState, sys: StarSystem): THREE.Color | null {
    if (colonies(state).some((c) => c.systemId === sys.id && formOf(c) === 'horizon')) return this.neon.clone();
    for (const c of allColonies(state)) {
      if (c.owner === state.player || c.systemId !== sys.id || formOf(c) !== 'horizon' || !settlementSeen(state, c)) continue;
      const sv = state.survivors[c.owner];
      if (sv) return othersColor(sv);
    }
    return null;
  }

  /** The positronium across the whole system (fields.ts): brighter, in the age's neon, where our minds are woven through it. */
  private buildVeil(state: GameState, sys: StarSystem) {
    const woven = colonies(state).some((c) => c.systemId === sys.id && formOf(c) === 'positronium');
    const era = ERA_BY_ID[state.era];
    const v = positroniumVeil({ seed: hashSeed(`positronium:${sys.id}`), quality: this.quality, color: new THREE.Color(woven ? era.neon : era.accentSoft), opacity: woven ? 0.24 : 0.11 });
    this.group.add(v.obj);
    this.fieldMats.push(v.mat);
    this.fieldSpin.push({ obj: v.obj, speed: 0.0008 });
    this.look.veil = v.rings;
  }

  /**
   * The Thinning (part 3-3): a world's matter going, a haze of motes drifting off it and fading,
   * more of them the more of matter is gone. In world space, following the world (update() moves
   * uFrom, as for a swarm's motes), on elapsed time.
   */
  private addThinMotes(rig: PlanetRig, size: number) {
    const mat = this.thinMotes(hashSeed(rig.body.id + 'thin'), size, this.quality === 'low' ? 24 : this.quality === 'medium' ? 60 : 110);
    this.eatMotes.push({ mat, rig });
  }

  /** Motes leaving something of matter as it thins: `base` of them at the most, from a sphere of radius `size` about uFrom. */
  private thinMotes(seed: number, size: number, base: number): THREE.ShaderMaterial {
    const rng = new Rng(seed);
    const n = Math.max(6, Math.round(base * Math.min(1, 0.3 + THIN.value)));
    const pos: number[] = [];
    const params: number[] = [];
    const dirs: number[] = [];
    for (let i = 0; i < n; i++) {
      pos.push(0, 0, 0);
      params.push(rng.next(), rng.range(0.03, 0.08), rng.range(0.6, 1), 0);
      const d = new THREE.Vector3(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
      dirs.push(d.x, d.y, d.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aParams', new THREE.Float32BufferAttribute(params, 4));
    g.setAttribute('aDir', new THREE.Float32BufferAttribute(dirs, 3));
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec4 aParams; // x: phase, y: how fast it leaves, z: how far it goes
        attribute vec3 aDir;
        uniform float uTime;
        uniform vec3 uFrom;
        uniform float uSize;
        varying float vAlpha;
        void main() {
          float f = fract(uTime * aParams.y + aParams.x);
          vec3 pos = uFrom + aDir * uSize * (1.02 + f * 1.6 * aParams.z);
          vAlpha = smoothstep(0.0, 0.1, f) * (1.0 - f);
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(40.0 / -mv.z, 1.0, 3.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float a = (1.0 - d * 2.0) * vAlpha * 0.8;
          gl_FragColor = vec4(uColor * a, a);
        }
      `,
      uniforms: { uTime: { value: 0 }, uFrom: { value: new THREE.Vector3() }, uSize: { value: size }, uColor: { value: new THREE.Color('#d9a47e') } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
    return mat;
  }

  private buildStructures(state: GameState, sys: StarSystem) {
    const cols = colonies(state).filter((c) => c.systemId === sys.id);
    const count = (k: string) => cols.reduce((a, c) => a + (c.structures[k] ?? 0), 0);
    const r0 = this.primaryRadius;
    // Dyson swarm: thousands of patched collectors, dark faces and lit seams
    const dysonCount = count('dyson_swarm') * 1400 + count('orbital_collector') * 90 + count('ember_collector') * 160 + count('infrared_shroud') * 160;
    if (dysonCount > 0) {
      const geo = new THREE.PlaneGeometry(0.5, 0.32);
      const mat = withDissolve(withNearFade(new THREE.MeshBasicMaterial({ color: '#2a2622', side: THREE.DoubleSide })));
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
      // the Thinning: the collectors' matter going too, motes drifting off the shell
      if (THIN.value > 0) this.fieldMats.push(this.thinMotes(hashSeed(sys.id + 'thin'), r0 * 2.8, this.quality === 'low' ? 40 : this.quality === 'medium' ? 100 : 180));
    }
  }

  /** Where a swarm's main cloud hangs in the system view. */
  private swarmCenter(): THREE.Vector3 {
    return new THREE.Vector3(this.primaryRadius * 5, 2, this.primaryRadius * 3);
  }

  /**
   * A swarm eating a world: a haze of harvesters circling low over it, and a thin stream of
   * them carrying the harvest off to the swarm's cloud. Drawn in world space, following the world
   * (update() moves uFrom), animated on elapsed time.
   */
  private addFeedingMotes(rig: PlanetRig, sw: Swarm, size: number) {
    const rng = new Rng(hashSeed(sw.id + rig.body.id));
    const shell = Math.round(90 + sw.size * 18);
    const stream = Math.round(40 + sw.size * 8);
    const pos: number[] = [];
    const params: number[] = [];
    const axes: number[] = [];
    for (let i = 0; i < shell + stream; i++) {
      pos.push(0, 0, 0);
      params.push(rng.range(0, 100), rng.range(1.12, 1.7), rng.range(0.3, 0.9), i < shell ? 0 : 1);
      axes.push(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aParams', new THREE.Float32BufferAttribute(params, 4));
    g.setAttribute('aAxis', new THREE.Float32BufferAttribute(axes, 3));
    const mat = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute vec4 aParams;
        attribute vec3 aAxis;
        uniform float uTime;
        uniform vec3 uFrom;
        uniform vec3 uTo;
        uniform float uSize;
        varying float vFlick;
        varying float vAlpha;
        void main() {
          float t = uTime * aParams.z + aParams.x;
          vec3 pos;
          if (aParams.w < 0.5) {
            // circling low over the surface, each on its own tilted orbit
            vec3 ax = normalize(aAxis + vec3(0.0, 0.001, 0.0));
            vec3 u = normalize(cross(ax, vec3(0.3, 1.0, 0.2)));
            vec3 v = cross(ax, u);
            pos = uFrom + (u * cos(t) + v * sin(t)) * uSize * aParams.y;
            vAlpha = 0.9;
          } else {
            // carried off to the swarm, wandering a little on the way
            float f = fract(t * 0.05);
            vec3 d = uTo - uFrom;
            float len = length(d);
            vec3 side = normalize(cross(d, vec3(0.0, 1.0, 0.0)) + vec3(0.0001));
            float bow = 1.0 - abs(f * 2.0 - 1.0);
            pos = mix(uFrom, uTo, f) + side * sin(f * 9.0 + aParams.x) * len * 0.04 * bow + vec3(0.0, sin(f * 7.0 + aParams.x * 1.7), 0.0) * len * 0.02 * bow;
            vAlpha = smoothstep(0.0, 0.08, f) * (1.0 - smoothstep(0.85, 1.0, f)) * 0.8;
          }
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(70.0 / -mv.z, 1.0, 4.0);
          vFlick = 0.5 + 0.5 * sin(uTime * 6.0 + aParams.x * 23.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vFlick;
        varying float vAlpha;
        void main() {
          if (length(gl_PointCoord - 0.5) > 0.5) discard;
          vec3 col = mix(vec3(0.05, 0.035, 0.03), uColor, step(0.8, vFlick));
          gl_FragColor = vec4(col, vAlpha);
        }
      `,
      uniforms: { uTime: { value: 0 }, uFrom: { value: new THREE.Vector3() }, uTo: { value: this.swarmCenter() }, uSize: { value: size }, uColor: { value: new THREE.Color('#d0502c') } },
      transparent: true,
      depthWrite: false,
    });
    const pts = new THREE.Points(g, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
    this.eatMotes.push({ mat, rig });
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
      uniforms: { uTime: { value: 0 }, uCenter: { value: this.swarmCenter() }, uColor: { value: new THREE.Color(sw.tamed ? '#4fe3d1' : '#c0482c') } },
      transparent: true,
      depthWrite: false,
    });
    this.swarm = new THREE.Points(g, this.swarmMat);
    this.swarm.frustumCulled = false;
    this.group.add(this.swarm);
    // a click anywhere on its cloud picks it (motes spread about 6 + 0.6·size units around the centre)
    this.pickables.push({ kind: 'swarm', id: sw.id, pos: (this.swarmMat.uniforms.uCenter.value as THREE.Vector3).clone(), radius: (6 + sw.size * 0.6) * 1.2 });
  }

  private buildFleets(state: GameState, sys: StarSystem) {
    const here = fleets(state).filter((f) => f.at === sys.id);
    here.forEach((f, i) => {
      const hull = shipMesh(lookRole(fleetLook(f.ships.map((s) => s.cls))) === 'war');
      hull.userData.orbit = { r: this.primaryRadius * 3.2 + 4 + i * 1.5, speed: 0.12, phase: i * 1.9 };
      this.fleets.add(hull);
      this.pickables.push({ kind: 'fleet', id: f.id, pos: new THREE.Vector3() });
    });
    // the others' fleets here, as their light shows them: their colour, an orbit of their own, not ours to pick
    const theirs = allFleets(state).filter((f) => {
      if (f.owner === state.player) return false;
      const sn = fleetSeen(state, f);
      return !!sn && 'at' in sn && sn.at === sys.id;
    });
    theirs.forEach((f, i) => {
      const hull = shipMesh(lookRole(fleetLook(f.ships.map((s) => s.cls))) === 'war', state.survivors[f.owner]?.color);
      hull.userData.orbit = { r: this.primaryRadius * 3.2 + 4.75 + (here.length + i) * 1.5, speed: -0.09, phase: 1 + i * 1.9 };
      this.fleets.add(hull);
    });
  }

  /** Rocks are unlit: recolour them for the view mode (the shaders read VIEW_MODE themselves). */
  applyViewMode() {
    for (const r of this.rockMats) {
      if (VIEW_MODE.value === 2) r.mat.color.setRGB(...thermalRGB(r.tempK)).multiplyScalar(0.8);
      else {
        r.mat.color.set(VIEW_MODE.value === 1 ? '#6a625c' : '#2e2926');
        // the Hunger's rust on the rocks, as on the worlds
        if (r.rust > 0.001) r.mat.color.lerp(new THREE.Color(VIEW_MODE.value === 1 ? '#8a3c1c' : '#4a1f10'), Math.min(0.75, 0.2 + r.rust * 0.6));
        // rubble hot enough glows by its own heat, as hot worlds do
        if (r.tempK > 780) r.mat.color.add(heatColor(r.tempK).multiplyScalar(heatGlow(r.tempK)));
      }
    }
  }

  update(dt: number, camera: THREE.PerspectiveCamera, viewDistance = 100) {
    // rocks and collectors that drift right in front of the camera fade out instead of
    // blotting out the world being looked at
    NEAR_FADE.value = viewDistance * 0.3;
    this.time += dt;
    if (!this.orbitsPaused) this.orbitTime += dt;
    const t = this.time;
    const ot = this.orbitTime;
    if (this.starMat) this.starMat.uniforms.uTime.value = t;
    for (const m of this.glowMats) m.uniforms.uTime.value = t;
    for (const m of this.diskMats) m.uniforms.uTime.value = t;
    if (this.swarmMat) this.swarmMat.uniforms.uTime.value = t;
    this.group.traverse((o) => {
      if (o.userData.billboard) o.quaternion.copy(camera.quaternion);
    });
    const pick = (id: string) => this.pickables.find((p) => p.id === id);
    for (const pr of this.planets) {
      const a = pr.phase + ot * pr.speed;
      pr.pivot.rotation.y = a;
      if (pr.body.kind === 'asteroids') {
        pr.mesh.rotation.y = a * 0.3;
        continue;
      }
      pr.mesh.rotation.y = pr.body.traits.includes('tidally_locked') ? 0 : ot * 0.1;
      const world = new THREE.Vector3();
      pr.mesh.getWorldPosition(world);
      const p = pick(`body:${pr.body.id}`);
      if (p) p.pos.copy(world);
      for (const m of this.eatMotes) {
        if (m.rig !== pr) continue;
        m.mat.uniforms.uFrom.value.copy(world);
        m.mat.uniforms.uTime.value = t;
      }
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
    // other civilizations' habitats turn slowly (on elapsed time); a Chorus's lights breathe as one
    for (const h of this.habitats) {
      if (h.follow) h.follow.getWorldPosition(h.obj.position);
      h.obj.rotation.y = t * h.spin;
      for (const m of h.pulse) m.opacity = 0.6 + 0.35 * Math.sin(t * 1.3);
    }
    for (const m of this.sleepLights) m.uniforms.uLights.value = 0.2 + 0.12 * Math.sin(t * 0.35);
    // what is not matter breathes on elapsed time, and turns slowly
    for (const m of this.fieldMats) m.uniforms.uTime.value = t;
    for (const f of this.fieldSpin) f.obj.rotation.y = t * f.speed;
    if (this.dyson) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const v = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      for (let i = 0; i < this.dysonSpin.length; i++) {
        const s = this.dysonSpin[i];
        const a = s.phase + ot * s.speed;
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
      const a = o.phase + ot * o.speed;
      f.position.set(Math.cos(a) * o.r, 1.2, Math.sin(a) * o.r);
      // (heading along its orbit, whichever way it goes round)
      const ahead = a + Math.sign(o.speed) * 0.1;
      f.lookAt(Math.cos(ahead) * o.r, 1.2, Math.sin(ahead) * o.r);
    }
    const fleetPicks = this.pickables.filter((p) => p.kind === 'fleet');
    fleetPicks.forEach((p, i) => {
      const f = this.fleets.children[i];
      if (f) p.pos.copy(f.position);
    });
    // the survey reveal: what it has not yet charted on screen waits (and its name and the pointer:
    // hidden), and the camera flies (`cinema`, for the engine to put the rig there)
    const waiting = this.applyReveal(camera);
    // a world wears one ring: selected, the selection circle takes the place and colour of the
    // ring that says whose it is (ours, or a neighbour's); a world no one lives on gets the pale one
    // (none in a reveal's flight)
    let marked: THREE.Mesh | undefined;
    if (this.selectedBody && !waiting?.has(this.selectedBody) && !this.labelsHeld) {
      const p = pick(`body:${this.selectedBody}`) ?? pick(this.selectedBody);
      if (p) {
        const rig = this.planets.find((x) => x.body.id === this.selectedBody);
        const r = rig ? (rig.body.kind === 'asteroids' ? 3 : rig.body.size * 1.9) : 2;
        marked = rig?.extra.find((e) => e.userData.mark) as THREE.Mesh | undefined;
        const mat = this.selRing.material as THREE.MeshBasicMaterial;
        mat.color.copy(marked ? ((marked.userData.markColor as THREE.Color | undefined) ?? (marked.material as THREE.MeshBasicMaterial).color) : SELECT);
        this.selRing.visible = true;
        this.selRing.position.copy(p.pos);
        this.selRing.lookAt(camera.position);
        this.selRing.scale.setScalar(r);
        // close up the planet fills the view; the ring steps back so it does not glare over it,
        // though one that says whose world it is stays clear enough to read
        const k = camera.position.distanceTo(p.pos) / r;
        const fade = Math.min(1, Math.max(0, (k - 3) / 9));
        const floor = marked ? 0.35 : 0.12;
        mat.opacity = floor + (0.8 - floor) * fade * fade * (3 - 2 * fade);
      } else this.selRing.visible = false;
    } else this.selRing.visible = false;
    for (const pr of this.planets) for (const e of pr.extra) if (e.userData.mark) e.visible = e !== marked && !waiting?.has(pr.body.id);
  }

  /**
   * Begin the survey reveal of the system just built: a flight to each of its worlds in orbit order
   * (or `first` first, a world the view was entered to look at, which the flight ends on), after a
   * look at the star; `yaw`, which way the view faces as it begins (the whole system is seen from
   * there again at the end).
   */
  startReveal(state: GameState, first?: string | null, yaw = 0) {
    const id = this.systemId;
    if (!id) return;
    const dist = new Map<string, number>();
    for (const p of this.pickables) {
      if (!p.id.startsWith('body:')) continue;
      const b = p.id.slice(5);
      dist.set(b, this.planets.find((x) => x.body.id === b)?.radius ?? p.pos.length());
    }
    const order = state.systems[id].bodies.filter((b) => dist.has(b)).sort((a, b) => (a === first ? -1 : b === first ? 1 : dist.get(a)! - dist.get(b)!));
    if (!order.length) return;
    // the star rises over the last world (not a belt or the Deep): the outermost world comes last
    const rises = (bid: string) => {
      const b = state.bodies[bid];
      return !!b && b.kind !== 'asteroids' && b.kind !== 'deep' && !b.rogue && this.sunPower >= 0.2;
    };
    const last = [...order].reverse().find(rises);
    if (last && last !== first && order[order.length - 1] !== last) order.push(...order.splice(order.indexOf(last), 1));
    const n = order.length;
    const hold = Math.min(REVEAL.holdMax, Math.max(REVEAL.holdMin, REVEAL.holdAll / n));
    const shots: Shot[] = order.map((bid, i) => {
      const b = state.bodies[bid];
      const kind = b?.kind === 'asteroids' ? 'belt' : b?.kind === 'deep' ? 'deep' : 'world';
      // (a world flung loose has no star to rise over it)
      const sunrise = i === n - 1 && rises(bid);
      const plan = hold + (hasFind(b) ? REVEAL.find : 0) + (sunrise ? REVEAL.sunrise : 0);
      return { id: bid, kind, fly: i === 0 ? REVEAL.dive : n > 6 ? REVEAL.flyMany : REVEAL.fly, plan, hold: plan, sunrise };
    });
    const rank = new Map([...order].sort((a, b) => dist.get(a)! - dist.get(b)!).map((b, i) => [b, i] as const));
    const reach = this.planets.reduce((m, p) => (p.body.rogue ? m : Math.max(m, p.radius)), this.primaryRadius * 3) * 1.15;
    const cell = Math.min(30, Math.max(10, this.frameDistance() * 0.18));
    this.reveal = { systemId: id, start: this.time, intro: REVEAL.intro, shots, rank, reach, yaw0: yaw, focus: first && dist.has(first) ? first : null, cell };
    this.revealAt = '';
  }

  /** Skip the reveal: every world at once (`how`: skipped, or let go of where the camera is). */
  stopReveal(how: RevealEnd = 'skip') {
    this.endReveal(how);
  }

  get revealing(): boolean {
    return !!this.reveal;
  }

  /** While a reveal flies, the worlds' names wait (on the way back out they come). */
  get labelsHeld(): boolean {
    return !!this.reveal && this.cinePhase !== 'outro';
  }

  /**
   * Next (a click on the view, Space): on to the next world now, the while here cut short; in a
   * flight, the world it is flying to is left as soon as it is scanned.
   */
  nextShot() {
    const r = this.reveal;
    if (!r) return;
    const t = this.time - r.start;
    const sch = this.schedule(r);
    if (t < sch.fly[0]) {
      r.intro = Math.max(0, t);
      return;
    }
    for (let i = 0; i < r.shots.length; i++) {
      const s = r.shots[i];
      if (t < sch.at[i]) {
        s.hold = Math.min(s.hold, REVEAL.scanB + 0.4);
        return;
      }
      if (t < sch.at[i] + s.hold) {
        s.hold = t - sch.at[i];
        return;
      }
    }
  }

  /** Whether a pickable waits for the reveal (a world not yet charted on screen): its name and the pointer wait with it. */
  hidden(id: string): boolean {
    const r = this.reveal;
    if (!r || !id.startsWith('body:')) return false;
    const i = r.shots.findIndex((s) => s.id === id.slice(5));
    return i >= 0 && this.time - r.start < this.schedule(r).at[i] + REVEAL.scanB;
  }

  private schedule(r: Reveal): Schedule {
    const fly: number[] = [];
    const at: number[] = [];
    let t = r.intro;
    for (const s of r.shots) {
      fly.push(t);
      t += s.fly;
      at.push(t);
      t += s.hold;
    }
    return { fly, at, out: t, end: t + REVEAL.out };
  }

  /**
   * The reveal applied to what is drawn, every frame it plays (after a rebuild too): the worlds
   * still to come hidden, each coming in as the camera flies to it and scanned in as it arrives,
   * the orbits drawn in on the way out; and where the camera is (`cinema`), with the dust of a
   * flight. Returns the worlds not yet wholly there.
   */
  private applyReveal(camera: THREE.PerspectiveCamera): Set<string> | null {
    const r = this.reveal;
    this.cinema = null;
    this.dust.visible = false;
    if (!r) return null;
    const t = this.time - r.start;
    const sch = this.schedule(r);
    if (t >= sch.end) {
      this.endReveal('done');
      return null;
    }
    const waiting = new Set<string>();
    r.shots.forEach((s, i) => {
      if (t < sch.at[i] + REVEAL.scanB) waiting.add(s.id);
    });
    // first a ring of light leaves the star, out past the last orbit
    const k = clamp01(t / REVEAL.pulse);
    const r0 = this.primaryRadius * 1.2;
    this.pulse.visible = k < 1;
    this.pulse.scale.setScalar(r0 + (r.reach - r0) * (1 - (1 - k) * (1 - k)));
    const pm = this.pulse.material as THREE.MeshBasicMaterial;
    pm.color.copy(this.neon);
    pm.opacity = 0.5 * (1 - k);
    const index = new Map(r.shots.map((s, i) => [s.id, i] as const));
    // a world's scan, from just before the camera arrives
    const sweep = (i: number) => clamp01((t - sch.at[i] - REVEAL.scanA) / (REVEAL.scanB - REVEAL.scanA));
    for (const o of this.group.children) {
      const id = o.userData.reveal as string | undefined;
      const i = id === undefined ? undefined : index.get(id);
      if (i === undefined) continue;
      const since = t - sch.fly[i];
      if (o.userData.deep !== undefined) {
        // the Deep's ring comes in with the flight to it
        o.visible = since >= 0;
        ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (o.userData.deep as number) * clamp01(since / REVEAL.orbit);
      } else if (o.userData.orbit !== undefined) {
        // orbits are drawn in on the way back out, from the star outward
        const drawn = clamp01((t - sch.out - r.rank.get(id!)! * REVEAL.stagger) / REVEAL.orbit);
        o.visible = drawn > 0;
        ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = (o.userData.orbit as number) * drawn;
      } else if (o.userData.belt !== undefined) {
        // a belt's rubble comes in as the scan passes
        const inst = o as unknown as THREE.InstancedMesh;
        inst.count = Math.round((o.userData.belt as number) * sweep(i));
        o.visible = inst.count > 0;
      } else if (o.userData.world) o.visible = since >= 0;
      // (what is round it, habitats, fields and motes, once it is charted)
      else o.visible = sweep(i) >= 1;
    }
    for (const pr of this.planets) {
      const i = index.get(pr.body.id);
      if (i === undefined || !pr.mat) continue;
      // the world itself, a silhouette as the camera comes, then the scan
      const scan = sweep(i);
      pr.mat.uniforms.uReveal.value = scan;
      // its rings, its fields and its shield come with its look
      for (const ch of pr.mesh.children) ch.visible = scan >= 1;
      for (const ch of pr.pivot.children) if (ch !== pr.mesh) ch.visible = scan >= 1;
    }
    // where the flight is, for the caption: a world's from the moment its scan begins
    let phase: RevealStep['phase'] = 'intro';
    let cur = -1;
    if (t >= sch.out) phase = 'outro';
    else {
      for (let i = 0; i < r.shots.length && t >= sch.fly[i]; i++) {
        cur = i;
        phase = t >= sch.at[i] + REVEAL.scanA ? 'hold' : 'fly';
      }
    }
    this.cinePhase = phase;
    const key = `${phase}:${cur}`;
    if (key !== this.revealAt) {
      this.revealAt = key;
      const out = phase === 'outro';
      this.onReveal?.({ systemId: r.systemId, bodyId: out || cur < 0 ? null : r.shots[cur].id, index: out ? r.shots.length : cur, total: r.shots.length, phase });
    }
    // the camera: where the flight is now, and (for the dust) a thirtieth of a second before
    const ot = this.orbitTime;
    this.cinema = this.cinePose(r, sch, t, ot, camera);
    if (!this.lowVision) {
      const h = 1 / 30;
      this.flightDust(r, this.cinema, this.cinePose(r, sch, t - h, this.orbitsPaused ? ot : ot - h, camera), h);
    }
    return waiting;
  }

  /** Where the camera is at `t` into the reveal (orbits at `ot`): a pure function of the two, so the same at any frame rate. */
  private cinePose(r: Reveal, sch: Schedule, t: number, ot: number, cam: THREE.PerspectiveCamera): CinePose {
    if (t < sch.fly[0]) return this.introPose(r, t);
    // (a flight keeps out of the star's glare midway)
    const keep = this.primaryRadius * 2.6 + 2;
    for (let i = 0; i < r.shots.length; i++) {
      if (t < sch.at[i]) {
        const from = i === 0 ? this.introPose(r, r.intro) : this.shotPose(r.shots[i - 1], r.shots[i - 1].hold, ot, cam);
        return blendPose(from, this.shotPose(r.shots[i], 0, ot, cam), (t - sch.fly[i]) / r.shots[i].fly, keep);
      }
      if (t < sch.at[i] + r.shots[i].hold) return this.shotPose(r.shots[i], t - sch.at[i], ot, cam);
    }
    const last = r.shots[r.shots.length - 1];
    return blendPose(this.shotPose(last, last.hold, ot, cam), this.endPose(r, ot), (t - sch.out) / REVEAL.out, keep);
  }

  /** The look at the star: low over its plane, drawing back and up as its ring of light goes out. */
  private introPose(r: Reveal, tau: number): CinePose {
    const p = clamp01(tau / REVEAL.intro);
    const e = 1 - (1 - p) * (1 - p);
    return { target: new THREE.Vector3(), distance: this.frameDistance() * (0.5 + 0.22 * e), yaw: r.yaw0 - 0.45 + 0.2 * e, pitch: 0.12 + 0.13 * e };
  }

  /** Where the flight ends: the whole system, as the view opens without a reveal, or the world it was entered to look at, as focusBody flies to it. */
  private endPose(r: Reveal, ot: number): CinePose {
    const f = r.focus ? this.planets.find((x) => x.body.id === r.focus) : undefined;
    if (r.focus) {
      const at = f && f.body.kind !== 'asteroids' ? orbitPos(f, ot) : (this.pickables.find((p) => p.id === `body:${r.focus}`)?.pos.clone() ?? new THREE.Vector3());
      const radius = f ? (f.body.kind === 'asteroids' ? 4 : f.body.size) : 3;
      return { target: at, distance: Math.max(9, radius * 7), yaw: r.yaw0, pitch: 0.5 };
    }
    return { target: new THREE.Vector3(), distance: this.frameDistance(), yaw: r.yaw0, pitch: 0.5 };
  }

  /**
   * The camera at one world, `local` seconds into its while there. A world: close, as big on the
   * screen as it is big, three parts lit with its star off to the left, beside the caption (low in
   * the middle on a screen held upright; in the middle of what the magnifier mode's column leaves),
   * turning and closing in a little; the last one, where its star shines, seen from its night side
   * as the camera comes round until the star rises over its right edge. A belt: along it, low,
   * gliding through its rubble. The Deep: from outside its ring, the star beyond it.
   */
  private shotPose(s: Shot, local: number, ot: number, cam: THREE.PerspectiveCamera): CinePose {
    const u = clamp01(local / s.plan);
    const aspect = cam.aspect;
    const tanV = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const upright = aspect < 0.9;
    // (the last world left of the middle, for its star to rise on the screen beyond its right edge)
    const place = this.lowVision ? { x: s.sunrise ? -0.2 : 0, y: 0 } : upright ? { x: s.sunrise ? -0.3 : 0, y: -0.2 } : { x: s.sunrise ? -0.12 : 0.3, y: -0.04 };
    const pr = this.planets.find((x) => x.body.id === s.id);
    if (s.kind === 'deep' || !pr) {
      // the star with the Deep's ring round it, from above, turning a little
      const R = this.pickables.find((p) => p.id === `body:${s.id}`)?.pos.length() ?? this.primaryRadius * 3;
      return framed(new THREE.Vector3(), Math.max(12, R * 2), (this.reveal?.yaw0 ?? 0) - 0.3 + 0.12 * u, 0.42 + 0.03 * u, this.lowVision ? 0 : upright ? 0 : 0.22, upright ? -0.12 : -0.05, tanV, aspect);
    }
    if (s.kind === 'belt') {
      // a point of the belt, turning with it (update: its rocks turn by a third of its angle), seen
      // from outside the ring, its arc of rubble going round to the star beyond (its rocks are drawn
      // unlit: specks, not close up)
      const R = pr.radius;
      const phi = pr.body.phase + (local * BELT_GLIDE) / R;
      const W = new THREE.Vector3(Math.cos(phi) * R, 0, Math.sin(phi) * R).applyAxisAngle(UP, (pr.phase + ot * pr.speed) * 0.3);
      return framed(W, Math.max(9, R * 0.45), 2.6 + 0.08 * u, 0.3 + 0.03 * u, place.x, place.y, tanV, aspect);
    }
    const W = orbitPos(pr, ot);
    const R = pr.body.size;
    // its share of the screen's height, as big as it is (never wider than the screen)
    const f = s.sunrise ? Math.min(1.15, Math.max(0.65, 0.45 + 0.17 * R)) : Math.min(0.85, Math.max(0.3, 0.12 + 0.17 * R));
    const rho = Math.atan(Math.min(f * tanV, (s.sunrise && (upright || this.lowVision) ? 0.5 : 0.8) * tanV * aspect));
    const dist = R / Math.sin(rho);
    if (!s.sunrise) return framed(W, dist * (1.05 - 0.08 * smooth(0, 1, u)), 1.15 + 0.12 * u, 0.14 + 0.05 * u, place.x, place.y, tanV, aspect);
    // seen from its night side: the star, behind it, comes out from its middle to past its edge
    const L = Math.max(1, W.length());
    const star = Math.atan(this.primaryRadius / (L + dist));
    const sep = Math.max(0, rho - 1.2 * star) + (rho + 2.5 * star - Math.max(0, rho - 1.2 * star)) * smooth(0, 1, u);
    return framed(W, dist, -Math.PI + (sep * (L + dist)) / L, 0.06, place.x, place.y, tanV, aspect);
  }

  /**
   * Dust in a flight: motes fixed in space (each the copy nearest the camera of a pattern repeating
   * every `cell`), drawn as lines back along the camera's way, brighter the faster it goes and fading
   * toward the edge of their cell. From two poses a fixed time apart, so the same at any frame rate.
   */
  private flightDust(r: Reveal, now: CinePose, before: CinePose, h: number) {
    const a = camAt(now);
    const v = a.clone().sub(camAt(before)).divideScalar(h);
    const cell = r.cell;
    const k = smooth(cell * 1.5, cell * 6, v.length());
    if (k <= 0.002) return;
    // (a streak at most a third of the cell long)
    const tail = v.clone().multiplyScalar(STREAK);
    if (tail.length() > cell / 3) tail.setLength(cell / 3);
    const pos = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
    const col = this.dust.geometry.getAttribute('color') as THREE.BufferAttribute;
    const P = pos.array as Float32Array;
    const C = col.array as Float32Array;
    const half = cell / 2;
    for (let i = 0; i < DUST; i++) {
      const sx = this.dustSeed[i * 3] * cell;
      const sy = this.dustSeed[i * 3 + 1] * cell;
      const sz = this.dustSeed[i * 3 + 2] * cell;
      const x = sx + cell * Math.round((a.x - sx) / cell);
      const y = sy + cell * Math.round((a.y - sy) / cell);
      const z = sz + cell * Math.round((a.z - sz) / cell);
      const d = Math.hypot(x - a.x, y - a.y, z - a.z);
      // (none right at the camera, where a streak would cross the whole screen)
      const fade = clamp01(1 - (d / half) ** 2) * smooth(cell * 0.06, cell * 0.2, d) * k;
      P.set([x, y, z, x - tail.x, y - tail.y, z - tail.z], i * 6);
      C.set([0.36 * fade, 0.4 * fade, 0.46 * fade, 0, 0, 0], i * 6);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
    this.dust.visible = true;
  }

  /** The reveal over (or skipped, or let go of): everything as it is drawn without one. */
  private endReveal(how: RevealEnd) {
    const r = this.reveal;
    if (!r) return;
    this.reveal = null;
    this.revealAt = '';
    this.cinePhase = null;
    this.cinema = null;
    this.pulse.visible = false;
    this.dust.visible = false;
    for (const o of this.group.children) {
      if (o.userData.reveal === undefined) continue;
      o.visible = true;
      if (o.userData.orbit !== undefined) ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = o.userData.orbit as number;
      if (o.userData.deep !== undefined) ((o as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = o.userData.deep as number;
      if (o.userData.belt !== undefined) (o as unknown as THREE.InstancedMesh).count = o.userData.belt as number;
    }
    for (const pr of this.planets) {
      if (pr.mat) pr.mat.uniforms.uReveal.value = 1;
      for (const ch of pr.mesh.children) ch.visible = true;
      for (const ch of pr.pivot.children) ch.visible = true;
    }
    this.onReveal?.(null);
    this.onRevealEnd?.(how, r.focus, r.yaw0);
  }
}

/** A world's place on its orbit at orbit time `ot` (update turns its pivot by its angle about the star's axis). */
function orbitPos(pr: PlanetRig, ot: number): THREE.Vector3 {
  const a = pr.phase + ot * pr.speed;
  return new THREE.Vector3(Math.cos(a) * pr.radius, 0, -Math.sin(a) * pr.radius);
}

/** Where the rig puts the camera for a pose. */
function camAt(p: CinePose): THREE.Vector3 {
  const c = Math.cos(p.pitch);
  return new THREE.Vector3(Math.sin(p.yaw) * c, Math.sin(p.pitch), Math.cos(p.yaw) * c).multiplyScalar(p.distance).add(p.target);
}

const wrap = (x: number) => x - 2 * Math.PI * Math.round(x / (2 * Math.PI));

/**
 * A pose that has `W` at (`x`, `y`) on the screen (from -1 to 1 each way), seen from `dist` away,
 * from `turn` round from the way to its star (0: from between them; π/2: half lit, the star to the
 * left; past π: from its night side, the star to the right) and `rise` above its orbit's plane.
 */
function framed(W: THREE.Vector3, dist: number, turn: number, rise: number, x: number, y: number, tanV: number, aspect: number): CinePose {
  const yaw = (W.x === 0 && W.z === 0 ? 0 : Math.atan2(-W.x, -W.z)) + turn;
  const C = new THREE.Vector3(Math.sin(yaw) * Math.cos(rise), Math.sin(rise), Math.cos(yaw) * Math.cos(rise)).multiplyScalar(dist).add(W);
  const w = W.clone().sub(C).normalize();
  const right = new THREE.Vector3().crossVectors(w, UP).normalize();
  const up = new THREE.Vector3().crossVectors(right, w);
  // look off it by as much as puts it there
  const v = w.addScaledVector(right, -x * tanV * aspect).addScaledVector(up, -y * tanV).normalize();
  return { target: C.clone().addScaledVector(v, dist), distance: dist, yaw: Math.atan2(-v.x, -v.z), pitch: Math.asin(Math.max(-1, Math.min(1, -v.y))) };
}

/**
 * On the way from one pose to the next, eased in and out: what the camera looks at goes round the
 * star (never through it), the view turning with the way it goes, the camera further out midway
 * the further it flies, and midway no nearer the star's middle than `keep` (pushed straight out,
 * still looking where it was; at neither end, so the flight leaves and lands where it should).
 */
function blendPose(a: CinePose, b: CinePose, u: number, keep = 0): CinePose {
  const k = clamp01(u);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const ra = Math.hypot(a.target.x, a.target.z);
  const rb = Math.hypot(b.target.x, b.target.z);
  const azA = ra > 1e-6 ? Math.atan2(a.target.x, a.target.z) : rb > 1e-6 ? Math.atan2(b.target.x, b.target.z) : 0;
  const azB = rb > 1e-6 ? Math.atan2(b.target.x, b.target.z) : azA;
  const az = azA + wrap(azB - azA) * e;
  const rr = ra + (rb - ra) * e;
  const qa = wrap(a.yaw - azA);
  const qb = wrap(b.yaw - azB);
  const hop = Math.min(1, (a.target.distanceTo(b.target) / (a.distance + b.distance)) * 0.12);
  const bump = Math.sin(Math.PI * e);
  const p: CinePose = {
    target: new THREE.Vector3(Math.sin(az) * rr, a.target.y + (b.target.y - a.target.y) * e, Math.cos(az) * rr),
    distance: Math.exp(Math.log(a.distance) + (Math.log(b.distance) - Math.log(a.distance)) * e) * (1 + hop * bump),
    yaw: az + qa + wrap(qb - qa) * e,
    pitch: a.pitch + (b.pitch - a.pitch) * e + 0.1 * hop * bump,
  };
  const C = camAt(p);
  const r = C.length();
  const push = (keep - r) * bump;
  if (push <= 1e-6) return p;
  if (r < 1e-6) C.set(0, push, 0);
  else C.multiplyScalar((r + push) / r);
  const d = C.sub(p.target);
  const dist = d.length();
  return { target: p.target, distance: dist, yaw: Math.atan2(d.x, d.z), pitch: Math.asin(Math.max(-1, Math.min(1, d.y / dist))) };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A white dwarf too cool to glow: an ember's dull warmth, a little more copper (embers are #6d4a52). */
const COOL_DWARF = new THREE.Color('#6e4a40');
const COOL_DWARF_GLOW = new THREE.Color('#91573f');

/** The colour of ground glowing by its own heat (the planet shader's heatColor): dull red near 800 K, orange by 1,500 K. */
function heatColor(T: number): THREE.Color {
  return new THREE.Color(0.55, 0.05, 0.02).lerp(new THREE.Color(...blackbody(Math.max(1000, T))), smooth(780, 1150, T));
}

/** How brightly it glows (the planet shader's heatGlow). */
function heatGlow(T: number): number {
  return 0.25 * smooth(780, 1500, T) + 0.75 * smooth(1500, 3600, T) + 0.6 * smooth(3600, 6000, T);
}

/** A swarm of the Hunger eating the worlds of this star now (awake, untamed, not in transit). */
function feedingSwarm(state: GameState, sys: StarSystem): Swarm | null {
  return Object.values(state.swarms).find((w) => w.systemId === sys.id && w.awake && !w.tamed) ?? null;
}

function primaryLightColor(state: GameState, sys: StarSystem): { color: THREE.Color; power: number } {
  const p = sys.primary;
  const k = shownKind(p, state.years);
  const temp = primaryTemperature(p, state.years, calendarEra(state), 0, 0, haloDrawn(state));
  const c = new THREE.Color(...blackbody(Math.max(1500, temp)));
  let power = 1.4;
  if (k === 'blue_dwarf' || k === 'helium_star' || k === 'helium_giant') power = 2;
  if (k === 'white_dwarf') power = calendarEra(state) === 'dusk' ? 0.12 + 0.98 * coolDwarfShine(temp) : p.rekindle ? 0.3 : 0.03 + 0.09 * emberShare(p, state.years, haloDrawn(state));
  if (k === 'black_dwarf') power = p.rekindle ? 0.3 : 0.03;
  if (k === 'brown_dwarf') power = 0.03 + 0.09 * (calendarEra(state) === 'dusk' ? 1 : brownWarmth(temp));
  if (k === 'neutron_star') power = 0.03 + 0.27 * pulsarBeam(calendarEra(state), state.years);
  if (k === 'black_hole' || k === 'smbh' || k === 'void' || k === 'rogue') {
    c.set('#8a7aa8');
    power = 0.05;
    if (k === 'black_hole' || k === 'smbh') {
      // lit by the disk: warm light, as strong as what the collectors get
      const shine = diskLight(k, calendarEra(state), state.years, !matterGone(state));
      if (shine > 0.05) {
        c.set('#ffd6b0');
        power = Math.min(1.4, 0.1 + shine * 0.85);
      }
    }
  }
  if (k === 'dark_star') {
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

/** A belt of rocks: jagged, or, after the Long Flow, every stone slumped into a smooth sphere. */
function asteroidBelt(r: number, seed: number, richness: number, round = false): THREE.Mesh {
  const rng = new Rng(seed);
  const n = 700;
  const geo = new THREE.IcosahedronGeometry(0.12, round ? 1 : 0);
  const inst = new THREE.InstancedMesh(geo, withNearFade(new THREE.MeshBasicMaterial({ color: '#2e2926' })), n);
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

/** A ship in orbit: its hull and its drive's glow (another civilization's in its own colour). */
function shipMesh(war: boolean, colour?: string): THREE.Object3D {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.1, 5), new THREE.MeshBasicMaterial({ color: war ? '#3a2e28' : '#2a2e33' }));
  hull.rotation.x = Math.PI / 2;
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: colour ?? (war ? '#ffb070' : '#8fe8ff') }));
  glow.position.z = -0.55;
  g.add(hull, glow);
  return g;
}

/** Shared: fragments nearer the camera than this are dropped (set each frame from the zoom). */
const NEAR_FADE = { value: 0 };

function withNearFade<T extends THREE.Material>(m: T): T {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNearFade = NEAR_FADE;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vViewDepth;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvViewDepth = -mvPosition.z;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vViewDepth;\nuniform float uNearFade;')
      .replace('void main() {', 'void main() {\n  if (vViewDepth < uNearFade) discard;');
  };
  return m;
}

/** Shared: the share of ordinary matter gone (the Thinning), for whatever in the view is still made of matter (set on each build). */
const THIN = { value: 0 };

/**
 * What is still made of matter thins with it (the Thinning, part 3-3): blocky holes eaten into it
 * as the share of matter gone grows, their edges glowing as it goes. Composes with withNearFade.
 */
function withDissolve<T extends THREE.Material>(m: T): T {
  const prev = m.onBeforeCompile;
  const prevKey = prev ? prev.toString() : '';
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    sh.uniforms.uThin = THIN;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDisPos;')
      // (where on the thing itself, so the holes stay put as it moves: an instance by its number)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\n  vDisPos = position + vec3(float(gl_InstanceID) * 1.618, 0.0, 0.0);\n#else\n  vDisPos = position;\n#endif');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDisPos;\nuniform float uThin;')
      .replace(
        '#include <dithering_fragment>',
        '#include <dithering_fragment>\n  if (uThin > 0.0) {\n    float n = fract(sin(dot(floor(vDisPos * 9.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n    if (n < uThin) discard;\n    gl_FragColor.rgb += vec3(1.0, 0.55, 0.25) * (1.0 - smoothstep(0.0, 0.07, n - uThin)) * 1.2;\n  }',
      );
  };
  // (its own program: the cache key would otherwise be this wrapper's text, whatever it wraps)
  m.customProgramCacheKey = () => `${prevKey}|dissolve`;
  return m;
}

/** A dead star turned to iron (matter stable, past 10^1500 years, or the core a black dwarf supernova left): a cold, faintly metallic grey. */
const IRON_STAR = new THREE.Color('#3a3c42');

/** How another civilization holds itself together as fields: a Chorus breathes as one, the Lattice lays its lines out exactly. */
function styleOf(sv: Survivor): FieldStyle {
  return sv.way === 'chorus' ? 'chorus' : sv.way === 'lattice' ? 'lattice' : 'archive';
}

/** How we see another civilization's lights: in their colour once we know them. */
function othersColor(sv: Survivor): THREE.Color {
  return new THREE.Color(sv.contact ? sv.color : '#d9cdb8');
}
