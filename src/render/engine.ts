import * as THREE from 'three';
import { ERA_BY_ID } from '../game/eras';
import type { GameState } from '../game/types';
import { OrbitRig } from './camera';
import { GalaxyView, type Pickable } from './galaxyView';
import { createPost, type PostChain } from './post';
import { SystemView } from './systemView';

export type ViewKind = 'galaxy' | 'system';
export type Quality = 'low' | 'medium' | 'high';

export interface EngineEvents {
  onPick: (p: Pickable | null, view: ViewKind) => void;
  onHover: (p: Pickable | null, x: number, y: number) => void;
  onEnterSystem: (systemId: string) => void;
}

interface Label {
  el: HTMLDivElement;
  used: boolean;
}

// One renderer, two scenes. The loop measures real elapsed time; nothing depends on how
// often the browser asks for frames.

export class Engine {
  renderer: THREE.WebGLRenderer;
  camera: THREE.PerspectiveCamera;
  rig: OrbitRig;
  galaxyScene = new THREE.Scene();
  systemScene = new THREE.Scene();
  galaxy = new GalaxyView();
  system = new SystemView();
  post: PostChain;
  view: ViewKind = 'galaxy';
  private last = 0;
  private now = 0;
  private fade = 0;
  private fadeTarget = 0;
  private pendingSwitch: (() => void) | null = null;
  private state: GameState | null = null;
  private labels: Label[] = [];
  private labelLayer: HTMLDivElement;
  private running = false;
  private galaxyCam = { target: new THREE.Vector3(), distance: 220, yaw: 0.6, pitch: 0.85 };
  quality: Quality = 'high';
  private tint = new THREE.Color(1, 0.94, 0.88);
  private tintGoal = new THREE.Color(1, 0.94, 0.88);
  timeScale = 1;
  showLabels = true;

  constructor(private host: HTMLElement, private events: EngineEvents) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor('#030306');
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'stage-canvas';
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 30000);
    this.rig = new OrbitRig(this.camera, this.renderer.domElement);
    this.galaxyScene.background = new THREE.Color('#020204');
    this.systemScene.background = new THREE.Color('#020204');
    this.galaxyScene.add(this.galaxy.group);
    this.systemScene.add(this.system.group);
    this.post = createPost(this.renderer, this.galaxyScene, this.camera);
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'label-layer';
    host.appendChild(this.labelLayer);
    this.rig.onClick = (x, y) => this.click(x, y);
    this.rig.onHover = (x, y) => this.events.onHover(this.pickAt(x, y), x, y);
    window.addEventListener('resize', this.resize);
    this.renderer.domElement.addEventListener('dblclick', (e) => {
      const p = this.pickAt(e.clientX, e.clientY);
      if (p && p.kind === 'system' && this.view === 'galaxy') this.events.onEnterSystem(p.id);
    });
    this.resize();
  }

  setQuality(q: Quality) {
    this.quality = q;
    this.resize();
    this.post.bloom.enabled = q !== 'low';
  }

  private pixelRatio(): number {
    const cap = this.quality === 'low' ? 1 : this.quality === 'medium' ? 1.5 : 2;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  resize = () => {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    const pr = this.pixelRatio();
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.post.setSize(w, h, pr);
    this.galaxy.setPixelRatio(pr);
  };

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (ts: number) => {
      if (!this.running) return;
      requestAnimationFrame(loop);
      const dt = Math.min(0.1, Math.max(0, (ts - this.last) / 1000));
      this.last = ts;
      this.frame(dt * this.timeScale);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
  }

  /** Advance everything by dt seconds of real time and draw. Public so tests can drive it. */
  frame(dt: number) {
    this.now += dt;
    // crossfade between views, time-based
    const k = 1 - Math.exp(-9 * dt);
    this.fade += (this.fadeTarget - this.fade) * k;
    if (this.pendingSwitch && this.fade > 0.97) {
      const fn = this.pendingSwitch;
      this.pendingSwitch = null;
      fn();
      this.fadeTarget = 0;
    }
    this.tint.lerp(this.tintGoal, 1 - Math.exp(-1.5 * dt));
    const u = this.post.finish.uniforms;
    u.uTime.value = this.now;
    u.uFade.value = this.fade;
    u.uTint.value.copy(this.tint);
    if (this.view === 'galaxy') this.galaxy.update(dt, this.now, this.camera, this.rig.distance);
    else this.system.update(dt, this.camera);
    // the rig moves after the scene so a followed planet is centred on this frame's position
    this.rig.update(dt);
    this.post.composer.render(dt);
    this.updateLabels();
  }

  /** Feed a fresh game state. Rebuilds what changed. */
  setState(state: GameState) {
    this.state = state;
    const era = ERA_BY_ID[state.era];
    this.galaxy.setPalette(era.accent, era.neon);
    this.system.neon.set(era.neon);
    this.tintGoal.set(state.era === 'dusk' ? '#fff0e2' : state.era === 'degenerate' ? '#e6eeff' : state.era === 'blackhole' ? '#ece6ff' : '#e2e4e8');
    this.post.finish.uniforms.uGrain.value = state.era === 'dark' ? 0.09 : 0.06;
    this.galaxy.sync(state, this.now);
    if (this.view === 'system' && this.system.systemId) {
      if (state.systems[this.system.systemId]?.gone) this.showGalaxy();
      else this.system.build(state, this.system.systemId);
    }
  }

  focusGalaxyOn(systemId: string, distance = 160, instant = false) {
    const s = this.state?.systems[systemId];
    if (!s) return;
    const t = new THREE.Vector3(s.pos.x, s.pos.y, s.pos.z);
    if (instant) this.rig.jump(t, distance);
    else this.rig.flyTo(t, distance, 1.2);
  }

  showSystem(systemId: string, focusBodyId?: string) {
    if (!this.state) return;
    const go = () => {
      if (this.view === 'galaxy') {
        this.galaxyCam = { target: this.rig.target.clone(), distance: this.rig.goalDistance, yaw: this.rig.goalYaw, pitch: this.rig.goalPitch };
      }
      this.view = 'system';
      this.system.build(this.state!, systemId);
      this.post.setScene(this.systemScene, this.camera);
      this.rig.minDistance = 4;
      this.rig.maxDistance = 600;
      this.rig.jump(new THREE.Vector3(0, 0, 0), 150);
      this.rig.goalPitch = this.rig.pitch = 0.5;
      this.rig.flyTo(new THREE.Vector3(0, 0, 0), 70 + this.system.primaryRadius * 4, 1.4);
      if (focusBodyId) {
        this.system.selectedBody = focusBodyId;
        this.focusBody(focusBodyId);
      }
    };
    this.fadeTarget = 1;
    this.pendingSwitch = go;
  }

  showGalaxy() {
    const go = () => {
      this.view = 'galaxy';
      this.post.setScene(this.galaxyScene, this.camera);
      this.rig.minDistance = 6;
      this.rig.maxDistance = 9000;
      this.rig.jump(this.galaxyCam.target, this.galaxyCam.distance);
      this.rig.goalYaw = this.rig.yaw = this.galaxyCam.yaw;
      this.rig.goalPitch = this.rig.pitch = this.galaxyCam.pitch;
      this.system.systemId = null;
    };
    if (this.view === 'galaxy') return;
    this.fadeTarget = 1;
    this.pendingSwitch = go;
  }

  select(id: string | null) {
    this.galaxy.selected = id && !id.startsWith('body:') ? id : null;
    const was = this.system.selectedBody;
    this.system.selectedBody = id?.startsWith('body:') ? id.slice(5) : id;
    if (this.view !== 'system') return;
    if (id?.startsWith('body:')) this.focusBody(id.slice(5));
    else if (was && this.rig.follow) {
      // let go of the planet and step back to the whole system
      this.rig.flyTo(new THREE.Vector3(0, 0, 0), 70 + this.system.primaryRadius * 4, 1.0);
    }
  }

  /** Mark a discovery on the galaxy map. */
  ping(systemId: string, color = '#9ff5e6') {
    if (this.state) this.galaxy.ping(this.state, systemId, color, this.now);
  }

  /** In the system view: fly to a planet and keep it in the middle of the screen. */
  focusBody(bodyId: string) {
    const f = this.system.bodyFocus(bodyId);
    if (!f) return;
    this.rig.flyToFollow(() => this.system.bodyFocus(bodyId)?.pos ?? null, Math.max(9, f.radius * 7), 1.1);
  }

  private click(x: number, y: number) {
    const p = this.pickAt(x, y);
    this.events.onPick(p, this.view);
  }

  pickAt(x: number, y: number): Pickable | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const list = this.view === 'galaxy' ? this.galaxy.pickables : this.system.pickables;
    let best: Pickable | null = null;
    let bestD = this.view === 'galaxy' ? 16 : 26;
    const v = new THREE.Vector3();
    for (const p of list) {
      v.copy(p.pos).project(this.camera);
      if (v.z > 1) continue;
      const sx = rect.left + ((v.x + 1) / 2) * rect.width;
      const sy = rect.top + ((1 - v.y) / 2) * rect.height;
      const d = Math.hypot(sx - x, sy - y) - (p.kind === 'fleet' ? 4 : 0);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  /** Where an object is on screen (for tooltips and anchored UI). */
  screenOf(pos: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const v = pos.clone().project(this.camera);
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height, visible: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
  }

  private label(i: number): Label {
    while (this.labels.length <= i) {
      const el = document.createElement('div');
      el.className = 'map-label';
      this.labelLayer.appendChild(el);
      this.labels.push({ el, used: false });
    }
    return this.labels[i];
  }

  private updateLabels() {
    const state = this.state;
    for (const l of this.labels) l.used = false;
    if (!state || this.fade > 0.3 || !this.showLabels) {
      for (const l of this.labels) l.el.style.display = 'none';
      return;
    }
    const rect = this.renderer.domElement.getBoundingClientRect();
    const items: { text: string; pos: THREE.Vector3; cls: string; w: number }[] = [];
    if (this.view === 'galaxy') {
      const d = this.rig.distance;
      if (d > 700) {
        for (const p of state.provinces) {
          if (p.kind === 'halo' || p.kind === 'void') continue;
          items.push({ text: p.name, pos: new THREE.Vector3(p.pos.x, p.pos.y + 40, p.pos.z), cls: 'province', w: 10 });
        }
        for (const r of state.regions) if (r.kind === 'outlier' || r.kind === 'globular') items.push({ text: r.name, pos: new THREE.Vector3(r.pos.x, r.pos.y + 20, r.pos.z), cls: 'province', w: 9 });
      } else {
        const colonized = new Set(Object.values(state.colonies).map((c) => c.systemId));
        const cand = this.galaxy.pickables
          .filter((p) => p.kind === 'system')
          .map((p) => ({ p, dd: p.pos.distanceTo(this.rig.target) }))
          .filter((x) => x.dd < d * 1.1)
          .sort((a, b) => a.dd - b.dd)
          .slice(0, 36);
        for (const { p } of cand) {
          const s = state.systems[p.id];
          const mine = colonized.has(p.id);
          items.push({ text: s.name, pos: p.pos, cls: mine ? 'mine' : state.civ.known[p.id] === 2 ? 'surveyed' : 'seen', w: mine ? 3 : 1 });
        }
      }
    } else if (this.system.systemId) {
      for (const p of this.system.pickables) {
        if (!p.id.startsWith('body:')) continue;
        const b = state.bodies[p.id.slice(5)];
        if (!b) continue;
        items.push({ text: b.kind === 'deep' ? 'The Deep' : b.name, pos: p.pos.clone().add(new THREE.Vector3(0, b.size + 1.2, 0)), cls: b.colonyId ? 'mine' : 'body', w: 2 });
      }
    }
    let i = 0;
    const placed: { x: number; y: number }[] = [];
    items.sort((a, b) => b.w - a.w);
    for (const it of items) {
      const v = it.pos.clone().project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) continue;
      const x = ((v.x + 1) / 2) * rect.width;
      const y = ((1 - v.y) / 2) * rect.height;
      if (placed.some((q) => Math.abs(q.x - x) < 70 && Math.abs(q.y - y) < 14)) continue;
      placed.push({ x, y });
      const l = this.label(i++);
      l.used = true;
      if (l.el.textContent !== it.text) l.el.textContent = it.text;
      l.el.className = `map-label ${it.cls}`;
      l.el.style.display = 'block';
      l.el.style.transform = `translate(${Math.round(x + 9)}px, ${Math.round(y - 8)}px)`;
    }
    for (const l of this.labels) if (!l.used) l.el.style.display = 'none';
  }
}
