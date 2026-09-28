import * as THREE from 'three';

// An orbit rig with inertia. Every motion is time-based: targets are approached with
// 1 - exp(-k * dt) smoothing and flights use elapsed seconds, so the camera behaves the
// same at 30, 60 or 240 Hz.

export class OrbitRig {
  camera: THREE.PerspectiveCamera;
  target = new THREE.Vector3();
  distance = 200;
  yaw = 0.6;
  pitch = 0.85;
  minDistance = 6;
  maxDistance = 9000;
  // goals the smoothed values chase
  goalTarget = new THREE.Vector3();
  goalDistance = 200;
  goalYaw = 0.6;
  goalPitch = 0.85;
  sharpness = 7; // per second
  private flight: { from: THREE.Vector3; to: THREE.Vector3; fromD: number; toD: number; t: number; dur: number } | null = null;
  private el: HTMLElement;
  private pointers = new Map<number, { x: number; y: number }>();
  private dragMode: 'rotate' | 'pan' | null = null;
  private pinchDist = 0;
  private moved = 0;
  onClick: ((x: number, y: number) => void) | null = null;
  onHover: ((x: number, y: number) => void) | null = null;
  autoYaw = 0; // slow cinematic drift (radians per second)
  /** Something to keep centred (a planet on its orbit). Cleared when the player pans. */
  follow: (() => THREE.Vector3 | null) | null = null;

  constructor(camera: THREE.PerspectiveCamera, el: HTMLElement) {
    this.camera = camera;
    this.el = el;
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
    el.addEventListener('wheel', this.wheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  dispose() {
    this.el.removeEventListener('pointerdown', this.down);
    this.el.removeEventListener('pointermove', this.move);
    this.el.removeEventListener('pointerup', this.up);
    this.el.removeEventListener('pointercancel', this.up);
    this.el.removeEventListener('wheel', this.wheel);
  }

  jump(target: THREE.Vector3, distance: number) {
    this.target.copy(target);
    this.goalTarget.copy(target);
    this.distance = this.goalDistance = distance;
    this.flight = null;
    this.follow = null;
  }

  flyTo(target: THREE.Vector3, distance: number, duration = 1.1) {
    this.follow = null;
    this.flight = { from: this.target.clone(), to: target.clone(), fromD: this.distance, toD: distance, t: 0, dur: Math.max(0.05, duration) };
  }

  /** Fly to something that moves, then keep it centred. */
  flyToFollow(fn: () => THREE.Vector3 | null, distance: number, duration = 1.1) {
    const now = fn();
    if (!now) return;
    this.flight = { from: this.target.clone(), to: now.clone(), fromD: this.distance, toD: distance, t: 0, dur: Math.max(0.05, duration) };
    this.follow = fn;
  }

  private down = (e: PointerEvent) => {
    this.el.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.moved = 0;
    if (this.pointers.size === 1) this.dragMode = e.button === 2 || e.shiftKey ? 'pan' : 'rotate';
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.dragMode = 'pan';
    }
  };

  private move = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (!p) {
      this.onHover?.(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    this.moved += Math.abs(dx) + Math.abs(dy);
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinchDist > 0) this.zoomBy(this.pinchDist / Math.max(1, d));
      this.pinchDist = d;
      this.pan(dx * 0.5, dy * 0.5);
      return;
    }
    if (this.dragMode === 'rotate') {
      this.goalYaw -= dx * 0.005;
      this.goalPitch = THREE.MathUtils.clamp(this.goalPitch + dy * 0.004, 0.08, 1.52);
      this.flight = null;
    } else if (this.dragMode === 'pan') this.pan(dx, dy);
  };

  private up = (e: PointerEvent) => {
    if (this.pointers.has(e.pointerId) && this.pointers.size === 1 && this.moved < 6) this.onClick?.(e.clientX, e.clientY);
    this.pointers.delete(e.pointerId);
    if (this.pointers.size === 0) this.dragMode = null;
    this.pinchDist = 0;
  };

  private wheel = (e: WheelEvent) => {
    e.preventDefault();
    const k = Math.exp(Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0022);
    this.zoomBy(k);
  };

  zoomBy(k: number) {
    this.goalDistance = THREE.MathUtils.clamp(this.goalDistance * k, this.minDistance, this.maxDistance);
    if (this.flight) {
      this.flight.toD = this.goalDistance;
    }
  }

  private pan(dx: number, dy: number) {
    const s = this.distance * 0.0016;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.goalTarget.addScaledVector(right, -dx * s).addScaledVector(fwd, -dy * s);
    this.flight = null;
    this.follow = null;
  }

  update(dt: number) {
    const k = 1 - Math.exp(-this.sharpness * dt);
    const followed = this.follow ? this.follow() : null;
    if (this.follow && !followed) this.follow = null;
    if (this.flight) {
      const f = this.flight;
      if (followed) f.to.copy(followed); // the destination keeps moving
      f.t += dt;
      const u = Math.min(1, f.t / f.dur);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      this.goalTarget.lerpVectors(f.from, f.to, e);
      // logarithmic zoom so long flights feel even
      this.goalDistance = Math.exp(Math.log(f.fromD) + (Math.log(f.toD) - Math.log(f.fromD)) * e);
      // a flight is already eased and depends only on elapsed time: follow it exactly, so the
      // path is the same at any refresh rate (smoothing a moving goal would lag by frame rate)
      this.target.copy(this.goalTarget);
      this.distance = this.goalDistance;
      if (u >= 1) this.flight = null;
    } else if (followed) {
      // locked on: exact, so the view never lags by frame rate
      this.goalTarget.copy(followed);
      this.target.copy(followed);
      this.distance += (this.goalDistance - this.distance) * k;
    } else {
      this.target.lerp(this.goalTarget, k);
      this.distance += (this.goalDistance - this.distance) * k;
    }
    this.goalYaw += this.autoYaw * dt;
    this.yaw += (this.goalYaw - this.yaw) * k;
    this.pitch += (this.goalPitch - this.pitch) * k;
    const cp = Math.cos(this.pitch);
    const off = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp).multiplyScalar(this.distance);
    this.camera.position.copy(this.target).add(off);
    this.camera.lookAt(this.target);
    this.camera.near = Math.max(0.05, this.distance * 0.002);
    this.camera.far = Math.max(20000, this.distance * 40);
    this.camera.updateProjectionMatrix();
  }
}
