import { NOISE_GLSL } from './noise';

// Shaders for things seen up close: stars and remnants, planets that die in front of you,
// black holes with a photon ring and a Doppler-bright disk.

export const STAR_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vView;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const STAR_FRAG = /* glsl */ `
  ${NOISE_GLSL}
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uGranule;   // granulation strength (convective stars)
  uniform float uBands;     // banding (brown dwarfs)
  uniform float uIntensity;
  uniform float uSeed;
  varying vec3 vNormal;
  varying vec3 vPos;
  varying vec3 vView;
  void main() {
    vec3 p = normalize(vPos);
    float mu = max(0.0, dot(vNormal, vView));
    float limb = pow(mu, 0.55);                // limb darkening
    float n1 = fbm(p * 3.2 + vec3(uSeed, uTime * 0.05, -uTime * 0.03));
    float n2 = snoise(p * 11.0 + vec3(0.0, uTime * 0.18, uSeed));
    float gran = 1.0 + uGranule * (n1 * 0.6 + n2 * 0.25);
    float spots = smoothstep(0.35, 0.6, fbm3(p * 1.7 + vec3(uSeed * 2.0, 0.0, uTime * 0.01))) * uGranule * 0.7;
    float band = 1.0 + uBands * (0.35 * sin(p.y * 18.0 + fbm3(p * 2.0 + uSeed) * 3.0) + 0.2 * snoise(vec3(p.y * 9.0, uTime * 0.03, uSeed)));
    // convection: hot rising cells, cooler redder lanes; the limb is darker and redder
    float g = clamp(0.5 + uGranule * (n1 * 0.9 + n2 * 0.45), 0.0, 1.0);
    vec3 hot = uColor * vec3(1.3, 1.08, 0.9);
    vec3 cool = uColor * vec3(0.95, 0.5, 0.3);
    vec3 base = mix(cool, hot, g) * band;
    base = mix(cool * vec3(0.7, 0.45, 0.35), base, limb);
    // faculae and the odd flare on convective stars
    float fac = smoothstep(0.55, 0.9, snoise(p * 6.0 + vec3(uSeed, uTime * 0.07, 0.0))) * uGranule;
    float flare = smoothstep(0.82, 0.98, snoise(p * 2.3 + vec3(-uSeed, 0.0, uTime * 0.11))) * uGranule;
    vec3 col = base * (1.0 - spots) * (1.0 + fac * 0.5) * uIntensity;
    col += hot * flare * 1.4 * uIntensity;
    // hot rim where the corona begins
    col += uColor * pow(1.0 - mu, 3.0) * 0.5 * uIntensity;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const PLANET_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vObj;
  varying vec3 vWorldN;
  varying vec3 vView;
  void main() {
    vObj = normalize(position);
    vNormal = normalize(normalMatrix * normal);
    vWorldN = normalize(mat3(modelMatrix) * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

// kind: 0 rocky, 1 eyeball (tidally locked, substellar sea), 2 ice, 3 gas giant, 4 ice giant, 5 ocean-ice
export const PLANET_FRAG = /* glsl */ `
  ${NOISE_GLSL}
  uniform float uTime;
  uniform float uSeed;
  uniform int uKind;
  uniform float uVitality;    // 1 = living, 0 = dead and frozen
  uniform float uLights;      // settlement night lights 0..1
  uniform vec3 uNeon;
  uniform vec3 uSunDir;       // world-space direction toward the primary
  uniform vec3 uSunColor;
  uniform float uSunPower;
  uniform vec3 uSubstellar;   // object-space point facing the star (tidally locked worlds)
  uniform float uRust;        // the Hunger eating it
  uniform float uFeeding;     // being torn into a stream
  varying vec3 vNormal;
  varying vec3 vObj;
  varying vec3 vWorldN;
  varying vec3 vView;

  vec3 rockPalette(float h, float s) {
    vec3 a = vec3(0.23, 0.19, 0.17);
    vec3 b = vec3(0.42, 0.34, 0.28);
    vec3 c = vec3(0.58, 0.52, 0.46);
    return mix(mix(a, b, smoothstep(-0.3, 0.2, h)), c, smoothstep(0.25, 0.7, h + s * 0.2));
  }

  void main() {
    vec3 p = vObj;
    float h = fbm(p * 2.4 + uSeed);
    float detail = fbm3(p * 9.0 + uSeed * 1.7);
    vec3 albedo;
    float spec = 0.0;
    float clouds = 0.0;
    if (uKind == 3 || uKind == 4) {
      float lat = p.y + 0.12 * fbm3(p * 3.0 + vec3(uSeed, uTime * 0.01, 0.0));
      float bands = sin(lat * (uKind == 3 ? 22.0 : 12.0) + fbm3(vec3(lat * 4.0, uSeed, uTime * 0.02)) * 2.5);
      vec3 c1 = uKind == 3 ? vec3(0.55, 0.42, 0.33) : vec3(0.35, 0.45, 0.52);
      vec3 c2 = uKind == 3 ? vec3(0.32, 0.24, 0.21) : vec3(0.22, 0.3, 0.38);
      albedo = mix(c2, c1, 0.5 + 0.5 * bands);
    } else if (uKind == 2 || uKind == 5) {
      albedo = mix(vec3(0.55, 0.6, 0.66), vec3(0.78, 0.82, 0.86), smoothstep(-0.2, 0.4, h));
      albedo *= 0.85 + 0.15 * detail;
      if (uKind == 5) albedo = mix(albedo, vec3(0.42, 0.52, 0.6), smoothstep(0.1, 0.5, detail) * 0.4);
      spec = 0.25;
    } else {
      albedo = rockPalette(h, detail);
      if (uKind == 1) {
        // an eyeball world: a sea and green-brown land facing the sun, ice everywhere else
        float facing = dot(p, normalize(uSubstellar));
        float land = smoothstep(0.02, 0.12, h + 0.05);
        vec3 living = mix(vec3(0.05, 0.12, 0.16), mix(vec3(0.16, 0.2, 0.1), vec3(0.3, 0.26, 0.18), detail * 0.5 + 0.5), land);
        vec3 frozen = mix(vec3(0.6, 0.64, 0.7), vec3(0.82, 0.85, 0.9), smoothstep(-0.2, 0.3, detail));
        float warmZone = smoothstep(0.25 - 0.55 * uVitality, 0.75 - 0.35 * uVitality, facing);
        float alive = warmZone * smoothstep(0.02, 0.35, uVitality);
        albedo = mix(frozen, living, alive);
        // what is left of the dead: grey, dust-dry land
        albedo = mix(albedo, rockPalette(h, detail) * 0.8, (1.0 - smoothstep(0.0, 0.4, uVitality)) * warmZone * 0.7);
        spec = (1.0 - land) * alive * 0.7;
        clouds = smoothstep(0.1, 0.55, fbm(p * 3.0 + vec3(uTime * 0.02, uSeed, 0.0))) * alive * 0.8;
      }
    }
    // the Hunger's rust
    float rust = uRust * smoothstep(0.2, 0.6, fbm3(p * 5.0 + uSeed * 3.0));
    albedo = mix(albedo, vec3(0.36, 0.14, 0.07), rust);

    vec3 n = normalize(vWorldN);
    float ndl = dot(n, normalize(uSunDir));
    float diff = max(0.0, ndl);
    vec3 light = uSunColor * uSunPower;
    vec3 col = albedo * light * diff;
    col = mix(col, vec3(0.95, 0.96, 1.0) * light * diff, clouds);
    // specular glint on water / ice
    vec3 hvec = normalize(normalize(uSunDir) + normalize(vView));
    col += light * spec * pow(max(0.0, dot(normalize(vNormal), hvec)), 40.0) * diff;
    // night side: settlement lights, warm sodium with a few neon strips
    float night = smoothstep(0.08, -0.25, ndl);
    float cityMask = smoothstep(0.55, 0.8, detail * 0.5 + 0.5 + snoise(p * 40.0 + uSeed) * 0.3) * uLights;
    vec3 city = mix(vec3(1.0, 0.62, 0.3), uNeon, step(0.93, fract(sin(dot(floor(p * 60.0), vec3(12.9, 78.2, 37.7))) * 43758.5))) * cityMask;
    col += city * night * 1.8;
    col += albedo * 0.015; // faint ambient from the rest of the sky
    // atmosphere rim, thinning as the world dies
    float rim = pow(1.0 - max(0.0, dot(normalize(vNormal), normalize(vView))), 3.0);
    vec3 atmo = uKind == 1 ? mix(vec3(0.45, 0.62, 0.9), vec3(0.9, 0.55, 0.35), 0.4) : vec3(0.5, 0.55, 0.65);
    col += atmo * rim * (0.08 + 0.55 * uVitality) * (0.3 + 0.7 * max(0.0, ndl + 0.3)) * uSunPower;
    // being torn apart: glowing streaks
    col += vec3(1.0, 0.55, 0.3) * uFeeding * smoothstep(0.3, 0.8, snoise(p * 6.0 + vec3(uTime * 0.2))) * 0.8;
    gl_FragColor = vec4(col, 1.0);
  }
`;

export const DISK_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Accretion disk: hot inner edge, Doppler brightening on the approaching side. */
export const DISK_FRAG = /* glsl */ `
  ${NOISE_GLSL}
  uniform float uTime;
  uniform float uInner;
  uniform float uOuter;
  uniform float uHeat;
  uniform vec3 uHot;
  uniform vec3 uCool;
  varying vec3 vPos;
  void main() {
    float r = length(vPos.xy);
    float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
    float ang = atan(vPos.y, vPos.x);
    float swirl = fbm3(vec3(cos(ang) * 2.0, sin(ang) * 2.0, r * 0.35 - uTime * 0.25));
    float streaks = 0.6 + 0.4 * sin(ang * 12.0 + r * 1.5 - uTime * 2.0 + swirl * 4.0);
    float doppler = 0.55 + 0.45 * sin(ang);
    vec3 col = mix(uHot, uCool, t) * (1.2 - t) * streaks * (0.7 + 0.6 * swirl) * doppler * uHeat;
    float a = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.6, t) * uHeat;
    gl_FragColor = vec4(col * 2.2, a);
  }
`;

export const GLOW_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Billboard glow with slow corona filaments and optional lighthouse beams. */
export const GLOW_FRAG = /* glsl */ `
  ${NOISE_GLSL}
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uPower;
  uniform float uBeams;
  uniform float uRing; // photon ring for black holes
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c) * 2.0;
    float a = atan(c.y, c.x);
    float corona = pow(max(0.0, 1.0 - d), 3.0) * (0.8 + 0.4 * fbm3(vec3(cos(a) * 2.0, sin(a) * 2.0, uTime * 0.1)));
    float beams = 0.0;
    if (uBeams > 0.0) {
      float ba = a + uTime * uBeams;
      beams = pow(abs(cos(ba)), 80.0) * smoothstep(1.0, 0.1, d) * 1.4;
    }
    float ring = 0.0;
    if (uRing > 0.0) {
      ring = smoothstep(0.03, 0.0, abs(d - 0.34)) * uRing + smoothstep(0.12, 0.0, abs(d - 0.36)) * 0.3 * uRing;
    }
    vec3 col = uColor * (corona * uPower + beams * uPower + ring);
    float alpha = clamp(corona * uPower + beams + ring, 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`;
