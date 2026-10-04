import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

// Restrained on purpose: a faint, tight bloom on light sources only, fine film grain, a
// vignette, chromatic aberration only toward the edges, and an era grade.

const FinishShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uGrain: { value: 0.035 },
    uVignette: { value: 0.55 },
    uCA: { value: 0.6 },
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
    uniform float uTime;
    uniform vec2 uResolution;
    uniform float uGrain;
    uniform float uVignette;
    uniform float uCA;
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
  // Bloom only for what is truly brighter than white (star cores, flares, hot disks), tight and
  // faint. Lit surfaces never reach the threshold, so worlds stay crisp: glow belongs to light
  // sources, which carry their own coronae (as in ra-system-alpha), not to the whole frame.
  const bloom = new UnrealBloomPass(new THREE.Vector2(512, 512), 0.28, 0.18, 1.0);
  composer.addPass(bloom);
  const finish = new ShaderPass(FinishShader);
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
