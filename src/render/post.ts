import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// Cinematic but grimy: halation bloom, a dirty lens that lights up around bright sources,
// film grain, a vignette, chromatic aberration only toward the edges, and an era grade.

/** Procedural lens dirt: smudges, fingerprint arcs, dust specks and fine scratches. */
function makeLensDirt(size = 512): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, size, size);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // soft smudges
  for (let i = 0; i < 26; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 20 + rnd() * 120;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + rnd() * 0.12;
    grd.addColorStop(0, `rgba(255,255,255,${a})`);
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // fingerprint-ish arcs
  g.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = `rgba(255,255,255,${0.02 + rnd() * 0.03})`;
      g.beginPath();
      g.arc(cx, cy, 8 + i * 3.2, rnd() * 6, rnd() * 6 + 1.5);
      g.stroke();
    }
  }
  // dust specks
  for (let i = 0; i < 380; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = rnd() < 0.9 ? rnd() * 1.4 : 1.5 + rnd() * 3;
    g.fillStyle = `rgba(255,255,255,${0.12 + rnd() * 0.35})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // hairline scratches
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.04 + rnd() * 0.1})`;
    g.lineWidth = rnd() < 0.8 ? 0.6 : 1.2;
    g.beginPath();
    const x = rnd() * size;
    const y = rnd() * size;
    g.moveTo(x, y);
    g.quadraticCurveTo(x + (rnd() - 0.5) * 120, y + (rnd() - 0.5) * 120, x + (rnd() - 0.5) * 220, y + (rnd() - 0.5) * 220);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDirt: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGrain: { value: 0.06 },
    uVignette: { value: 0.55 },
    uCA: { value: 1.0 },
    uDirt: { value: 0.9 },
    uTint: { value: new THREE.Color(1, 0.94, 0.88) },
    uLift: { value: new THREE.Color(0.004, 0.0035, 0.004) },
    uFade: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDirt;
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uCA;
    uniform float uDirt;
    uniform vec3 uTint;
    uniform vec3 uLift;
    uniform float uFade;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);
      // chromatic aberration grows only toward the edges
      float ca = uCA * r2 * 0.012;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * ca).b;
      // dirty lens: lit by the bright parts of the image nearby
      vec3 glow = texture2D(tDiffuse, uv, 4.0).rgb;
      float lum = dot(glow, vec3(0.299, 0.587, 0.114));
      vec2 dirtUv = uv * vec2(uResolution.x / uResolution.y, 1.0) * 0.75;
      float dirt = texture2D(tDirt, dirtUv).r;
      col += glow * dirt * uDirt * smoothstep(0.02, 0.6, lum) * 1.6;
      // grade: lifted blacks, era tint
      col = col * uTint + uLift;
      // vignette
      float vig = smoothstep(0.85, 0.2, sqrt(r2) * (1.0 + uVignette * 0.6));
      col *= mix(1.0, vig, uVignette);
      // film grain lives in the midtones: true black stays black
      float g = hash(uv * uResolution + fract(uTime * 13.37) * 173.0) - 0.5;
      float cl = dot(col, vec3(0.299, 0.587, 0.114));
      col += g * uGrain * smoothstep(0.0, 0.25, cl) * (1.2 - cl);
      col = mix(col, vec3(0.0), uFade);
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }
  `,
};

export interface PostChain {
  composer: EffectComposer;
  bloom: UnrealBloomPass;
  finish: ShaderPass;
  setScene(scene: THREE.Scene, camera: THREE.Camera): void;
  setSize(w: number, h: number, pixelRatio: number): void;
}

export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): PostChain {
  const composer = new EffectComposer(renderer);
  const render = new RenderPass(scene, camera);
  composer.addPass(render);
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.75, 0.55, 0.32);
  composer.addPass(bloom);
  const finish = new ShaderPass(FinishShader);
  finish.uniforms.tDirt.value = makeLensDirt();
  composer.addPass(finish);
  composer.addPass(new OutputPass());
  return {
    composer,
    bloom,
    finish,
    setScene(s, c) {
      render.scene = s;
      render.camera = c;
    },
    setSize(w, h, pr) {
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      bloom.resolution.set(w * pr * 0.5, h * pr * 0.5);
      finish.uniforms.uResolution.value.set(w * pr, h * pr);
    },
  };
}
