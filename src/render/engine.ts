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
  onPick: (p: Pickable | null, view: ViewKind, pointerType?: string) => void;
  onHover: (p: Pickable | null, x: number, y: number) => void;
  onEnterSystem: (systemId: string) => void;
  /** Zoomed out past the edge of a system: back to the galaxy. */
  onLeaveSystem?: () => void;
}

/** Zooming the galaxy view closer than this dives into the system at the focus. */
const ENTER_ZOOM = 12;
/** How far past a system view's widest zoom the player must push to leave it (log scale). */
const LEAVE_PUSH = Math.log(1.5);

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
  private leavePush = 0;
  private focusY: number | null = null;
  /** The browser took the GPU away (a phone backgrounding the page, a driver reset). */
  contextLost = false;
  /** Lost: true when the picture goes, false when it is back. 'stuck' if it will not come back. */
  onContextChange: ((state: 'lost' | 'restored' | 'stuck') => void) | null = null;
  private lostTimer = 0;
  private viewShift = 0;
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
    this.rig.onClick = (x, y, type) => this.click(x, y, type);
    this.rig.zoomAnchor = (x, y) => (this.view === 'galaxy' ? this.zoomAnchorAt(x, y) : null);
    this.rig.onZoomIntent = (requested) => this.zoomIntent(requested);
    this.rig.onHover = (x, y) => this.events.onHover(this.pickAt(x, y), x, y);
    window.addEventListener('resize', this.resize);
    // Phones drop the GPU context when the page goes to the background. three.js asks for it
    // back; hide the dead canvas meanwhile (some browsers paint it white), rebuild on return,
    // and if it never comes back, say so.
    const canvas = this.renderer.domElement;
    canvas.addEventListener('webglcontextlost', () => {
      this.contextLost = true;
      canvas.style.visibility = 'hidden';
      this.onContextChange?.('lost');
      this.watchLost();
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      window.clearTimeout(this.lostTimer);
      this.galaxy.invalidate();
      if (this.state) this.setState(this.state);
      this.resize();
      canvas.style.visibility = '';
      this.onContextChange?.('restored');
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      this.resize();
      if (this.contextLost) this.watchLost();
    });
    this.renderer.domElement.addEventListener('dblclick', (e) => {
      const p = this.pickAt(e.clientX, e.clientY);
      if (p && p.kind === 'system' && this.view === 'galaxy') this.events.onEnterSystem(p.id);
    });
    this.resize();
  }

  /** While visible and still lost: nudge the browser, then give up and report. */
  private watchLost() {
    window.clearTimeout(this.lostTimer);
    if (document.visibilityState !== 'visible') return;
    this.lostTimer = window.setTimeout(() => {
      if (!this.contextLost || document.visibilityState !== 'visible') return;
      try {
        this.renderer.forceContextRestore();
      } catch {
        // no WEBGL_lose_context: nothing to nudge
      }
      this.lostTimer = window.setTimeout(() => {
        if (this.contextLost && document.visibilityState === 'visible') this.onContextChange?.('stuck');
      }, 3000);
    }, 1500);
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
    // slide the picture so the focus sits where the UI asked (phones: above an open panel)
    const el = this.renderer.domElement;
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;
    const shiftGoal = this.focusY === null ? 0 : h / 2 - this.focusY;
    this.viewShift += (shiftGoal - this.viewShift) * (1 - Math.exp(-8 * dt));
    if (Math.abs(this.viewShift) > 0.5) this.camera.setViewOffset(w, h, 0, this.viewShift, w, h);
    else if (this.camera.view) this.camera.clearViewOffset();
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
        // (entered by zooming in: come back a little further out, to see the neighbourhood)
        this.galaxyCam = { target: this.rig.goalTarget.clone(), distance: Math.max(this.rig.goalDistance, 36), yaw: this.rig.goalYaw, pitch: this.rig.goalPitch };
      }
      this.leavePush = 0;
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

  /**
   * Where on screen (CSS px from the top) the centre of the view should sit; null for the
   * middle. On a phone the selection panel covers the lower half, so the view slides up.
   */
  setFocusY(y: number | null) {
    this.focusY = y;
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

  private click(x: number, y: number, pointerType?: string) {
    const p = this.pickAt(x, y);
    this.events.onPick(p, this.view, pointerType);
  }

  /** Zoom toward the star under the pointer, or else the point on the galactic plane there. */
  private zoomAnchorAt(x: number, y: number): THREE.Vector3 | null {
    const p = this.pickAt(x, y);
    if (p && p.kind === 'system') return p.pos.clone();
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hit = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.rig.goalTarget.y), new THREE.Vector3());
    // a grazing ray would fling the focus far away: only trust nearby points
    return hit && hit.distanceTo(this.rig.goalTarget) < this.rig.goalDistance * 3 ? hit : null;
  }

  /** The system the galaxy view is focused on, if the camera is close to one. */
  private systemAtFocus(): string | null {
    const t = this.rig.goalTarget;
    const reach = Math.max(2.5, this.rig.goalDistance * 0.45);
    let best: string | null = null;
    let bestD = reach;
    for (const p of this.galaxy.pickables) {
      if (p.kind !== 'system') continue;
      const d = p.pos.distanceTo(t) * (p.id === this.galaxy.selected ? 0.5 : 1); // the selected star wins ties
      if (d < bestD) {
        bestD = d;
        best = p.id;
      }
    }
    return best;
  }

  private zoomIntent(requested: number) {
    if (this.pendingSwitch || !this.state) return;
    if (this.view === 'galaxy') {
      if (this.rig.goalDistance > ENTER_ZOOM) return;
      const id = this.systemAtFocus();
      if (id) this.events.onEnterSystem(id);
      return;
    }
    // in a system: pushing on past the widest view goes back out to the galaxy
    const max = this.rig.maxDistance;
    if (requested > max && this.rig.goalDistance >= max * 0.999) this.leavePush += Math.log(requested / max);
    else if (requested < this.rig.goalDistance) this.leavePush = 0;
    if (this.leavePush > LEAVE_PUSH) {
      this.leavePush = 0;
      this.events.onLeaveSystem?.();
    }
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
