import { NOISE_GLSL } from './noise';

// Shaders for things seen up close: stars and remnants, planets that die in front of you,
// black holes with a photon ring and a Doppler-bright disk.

/**
 * How the universe is shown, shared by every body material: 0 natural light, 1 enhanced
 * (light amplification: a soft fill from the viewer), 2 thermal (false colour by temperature).
 */
export const VIEW_MODE = { value: 0 };

const THERMAL_STOPS: [number, [number, number, number]][] = [
  [0, [0.043, 0.024, 0.125]],
  [0.2, [0.165, 0.102, 0.431]],
  [0.4, [0.416, 0.122, 0.541]],
  [0.6, [0.761, 0.188, 0.353]],
  [0.75, [0.941, 0.416, 0.165]],
  [0.9, [1.0, 0.82, 0.4]],
  [1, [1, 1, 1]],
];

/** The thermal ramp on the CPU (map nodes, the legend): same stops as THERMAL_GLSL. */
export function thermalRGB(k: number): [number, number, number] {
  const t = Math.min(1, Math.max(0, Math.log(Math.max(k, 0) + 1) / Math.log(3001)));
  for (let i = 1; i < THERMAL_STOPS.length; i++) {
    const [t1, c1] = THERMAL_STOPS[i];
    const [t0, c0] = THERMAL_STOPS[i - 1];
    if (t <= t1) {
      const u = (t - t0) / (t1 - t0);
      const e = u * u * (3 - 2 * u);
      return [c0[0] + (c1[0] - c0[0]) * e, c0[1] + (c1[1] - c0[1]) * e, c0[2] + (c1[2] - c0[2]) * e];
    }
  }
  return [1, 1, 1];
}

/** Temperature (K) to a false-colour ramp on a log scale: 0 K indigo, ~4 K violet, ~25 K purple,
 *  ~120 K crimson, ~400 K orange, ~1300 K gold, 3000 K and hotter white. Mirrors thermalRGB(). */
export const THERMAL_GLSL = /* glsl */ `
  vec3 thermal(float k) {
    float t = clamp(log(max(k, 0.0) + 1.0) / log(3001.0), 0.0, 1.0);
    vec3 c = mix(vec3(0.043, 0.024, 0.125), vec3(0.165, 0.102, 0.431), smoothstep(0.0, 0.2, t));
    c = mix(c, vec3(0.416, 0.122, 0.541), smoothstep(0.2, 0.4, t));
    c = mix(c, vec3(0.761, 0.188, 0.353), smoothstep(0.4, 0.6, t));
    c = mix(c, vec3(0.941, 0.416, 0.165), smoothstep(0.6, 0.75, t));
    c = mix(c, vec3(1.0, 0.82, 0.4), smoothstep(0.75, 0.9, t));
    return mix(c, vec3(1.0), smoothstep(0.9, 1.0, t));
  }
`;

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
  ${THERMAL_GLSL}
  uniform int uViewMode;
  uniform float uTempK;
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
    // enhanced: even a burnt-out star shows its disc; thermal: its surface temperature
    if (uViewMode == 1) col += vec3(0.05, 0.055, 0.065) * (0.35 + 0.65 * mu);
    else if (uViewMode == 2) col = thermal(uTempK) * (0.55 + 0.45 * limb) * (0.9 + 0.2 * n1);
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

// kind: 0 rocky, 1 sea and land (an eyeball, or a terrestrial world), 2 ice, 3 gas giant, 4 ice giant, 5 ocean-ice
export const PLANET_FRAG = /* glsl */ `
  ${NOISE_GLSL}
  ${THERMAL_GLSL}
  uniform int uViewMode;
  uniform float uEye;         // sea-and-land worlds: how much their star still keeps a sea liquid (0 once frozen over)
  uniform float uTempDay;     // K (the same as uTempNight unless tidally locked)
  uniform float uTempNight;
  uniform float uWater;       // the share of the surface its water would cover (an ice world's melt fills its low ground)
  uniform float uLocked;      // 1: one face to its star for ever (tidally locked, or an eyeball); 0: turning, warmed all round
  uniform float uTime;
  uniform float uSeed;
  uniform int uKind;
  uniform float uVitality;    // 1 = living, 0 = dead and frozen
  uniform float uLights;      // settlement night lights 0..1
  uniform float uDev;        // how built-up the settlement is 0..1
  uniform vec3 uNeon;
  uniform vec3 uCityCol;     // the colour of the lights: sodium for ours, their own colour for others
  uniform vec3 uSunDir;       // world-space direction toward the primary
  uniform vec3 uSunColor;
  uniform float uSunPower;
  uniform vec3 uSubstellar;   // object-space point facing the star (tidally locked worlds)
  uniform float uRust;        // the Hunger eating it
  uniform float uFeeding;     // being torn into a stream
  uniform float uEaten;       // a swarm of the Hunger feeding on it now, by its size (0..1)
  uniform float uFlow;        // the Long Flow has come: the ground has run smooth (0 or 1)
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

  // the colour of ground glowing by its own heat, a blackbody fit: dull red at the Draper point
  // (about 800 K), orange by 1,500 K, yellow-white by 3,000 K
  vec3 heatColor(float T) {
    float t = clamp(T, 1000.0, 6600.0) / 100.0;
    float g = clamp((99.4708 * log(t) - 161.1196) / 255.0, 0.0, 1.0);
    float b = t <= 19.0 ? 0.0 : clamp((138.5177 * log(t - 10.0) - 305.0448) / 255.0, 0.0, 1.0);
    return mix(vec3(0.55, 0.05, 0.02), vec3(1.0, g, b), smoothstep(780.0, 1150.0, T));
  }

  // how brightly it glows: faint at 1,000 K, never past the bloom threshold below about 2,500 K
  float heatGlow(float T) {
    return 0.25 * smoothstep(780.0, 1500.0, T) + 0.75 * smoothstep(1500.0, 3600.0, T) + 0.6 * smoothstep(3600.0, 6000.0, T);
  }

  void main() {
    vec3 p = vObj;
    float h = fbm(p * 2.4 + uSeed);
    float detail = fbm3(p * 9.0 + uSeed * 1.7);
    // cities keep the pattern they were built on
    float cityDetail = detail;
    // after the Long Flow solid ground has run like a slow liquid: mountains and craters settle
    // toward one smooth level, leaving the faint marks of what they were made of
    h = mix(h, h * 0.25, uFlow);
    detail = mix(detail, detail * 0.35, uFlow);
    // where the star is (for a locked world, for ever), and how warm the ground is here: the day
    // side's temperature facing it, the night side's beyond the terminator
    float facing = dot(p, normalize(uSubstellar));
    float T = mix(uTempNight, uTempDay, smoothstep(-0.25, 0.6, facing));
    vec3 albedo;
    float spec = 0.0;
    float clouds = 0.0;
    float steam = 0.0; // a veil of boiled-off water
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
      if (uTempDay > 263.0) {
        // warmed past freezing, the ice melts into open sea: everywhere on an ice-shelled ocean,
        // and on an ice world in its low ground, as far as its water reaches (bare rock above);
        // past boiling it goes up as a veil of steam
        float melt = smoothstep(263.0, 283.0, T);
        float level = -0.6 + 1.2 * uWater;
        float wet = uKind == 5 ? 1.0 : 1.0 - smoothstep(level - 0.05, level + 0.05, h);
        vec3 sea = mix(vec3(0.035, 0.09, 0.13), vec3(0.05, 0.12, 0.16), smoothstep(-0.6, 0.6, h));
        albedo = mix(albedo, mix(rockPalette(h, detail) * 0.8, sea, wet), melt);
        spec = mix(spec, 0.7 * wet, melt);
        steam = smoothstep(363.0, 383.0, T);
      }
    } else {
      albedo = rockPalette(h, detail);
      if (uKind == 1) {
        // a sea and green-brown land where the star keeps it warm: on an eyeball (or any locked
        // world) only the face toward it, ice everywhere else; on a turning world, all round. The
        // sea is its star's doing (uEye): once the star is dead the sea freezes over and the world
        // is one ice shell, the old sea only a smoother, darker plain under it
        float land = smoothstep(0.02, 0.12, h + 0.05);
        vec3 living = mix(vec3(0.05, 0.12, 0.16), mix(vec3(0.16, 0.2, 0.1), vec3(0.3, 0.26, 0.18), detail * 0.5 + 0.5), land);
        vec3 frozen = mix(vec3(0.6, 0.64, 0.7), vec3(0.82, 0.85, 0.9), smoothstep(-0.2, 0.3, detail));
        float warmZone = uLocked > 0.5 ? smoothstep(0.25 - 0.55 * uVitality, 0.75 - 0.35 * uVitality, facing) : 1.0;
        float alive = warmZone * smoothstep(0.02, 0.35, uVitality) * uEye;
        albedo = mix(frozen, living, alive);
        // dried out while the star still burns: grey, dust-dry land where it is warm
        albedo = mix(albedo, rockPalette(h, detail) * 0.8, (1.0 - smoothstep(0.0, 0.4, uVitality)) * warmZone * 0.7 * uEye);
        // the star gone: ice everywhere, a little darker and smoother over the old sea
        float oldSea = (uLocked > 0.5 ? smoothstep(0.3, 0.7, facing) : 1.0) * (1.0 - land);
        albedo = mix(albedo, mix(frozen * (0.92 + 0.08 * detail), vec3(0.48, 0.53, 0.6), oldSea * 0.55), 1.0 - uEye);
        spec = (1.0 - land) * alive * 0.7;
        clouds = smoothstep(0.1, 0.55, fbm(p * 3.0 + vec3(uTime * 0.02, uSeed, 0.0))) * alive * 0.8;
        if (uTempDay > 363.0) {
          // too hot for a sea: past boiling it is gone, leaving pale, salt-crusted sea floor and
          // dry land under a veil of steam
          float boil = smoothstep(363.0, 383.0, T);
          vec3 dry = mix(vec3(0.6, 0.58, 0.52) * (0.85 + 0.15 * detail), rockPalette(h, detail) * 0.85, land);
          albedo = mix(albedo, dry, boil);
          spec *= 1.0 - boil;
          clouds *= 1.0 - boil;
          steam = boil;
        }
      }
    }
    // the Hunger's rust: patches that spread the longer a swarm has fed here (it never fades),
    // dull oxide pitted where the harvesters bored in; on a giant, a thinner brown haze
    float rustN = fbm3(p * 5.0 + uSeed * 3.0) + 0.3 * snoise(p * 16.0 + uSeed);
    float giant = (uKind == 3 || uKind == 4) ? 0.5 : 1.0;
    float rustCover = uRust > 0.001 ? smoothstep(0.55 - 0.9 * uRust, 0.68 - 0.85 * uRust, rustN) * giant : 0.0;
    float pits = smoothstep(0.35, 0.85, snoise(p * 38.0 + uSeed * 5.0));
    vec3 rustCol = mix(vec3(0.24, 0.085, 0.04), vec3(0.47, 0.2, 0.08), smoothstep(-0.4, 0.6, snoise(p * 11.0 + uSeed)));
    rustCol = mix(rustCol, vec3(0.08, 0.035, 0.025), pits * 0.7);
    float rust = rustCover * (0.65 + 0.35 * uRust);
    albedo = mix(albedo, rustCol, rust);
    spec *= 1.0 - rust;
    clouds *= 1.0 - 0.6 * rust;
    // hot rock: from about 1,500 K the ground is lava, a dark basalt crust split by glowing cracks
    // (the glow itself is added after the lighting)
    float lava = 0.0;
    if ((uKind == 0 || uKind == 1) && uTempDay > 1300.0) {
      lava = smoothstep(1400.0, 1700.0, T);
      float crust = mix(0.05, 0.09, smoothstep(-0.4, 0.6, detail));
      albedo = mix(albedo, vec3(crust, crust * 0.9, crust * 0.85), lava);
      spec *= 1.0 - lava;
      clouds *= 1.0 - lava;
      steam *= 1.0 - lava;
    }
    // boiled-off water hangs over the world as a veil of steam
    if (steam > 0.0) clouds = max(clouds, steam * (0.55 + 0.4 * fbm(p * 2.2 + vec3(uTime * 0.015, uSeed, 0.0))));
    // a swarm eating it now: scattered sparks where the harvesters cut in, most of them in the
    // rust, coming and going on elapsed time
    float cut = uEaten > 0.0 ? smoothstep(0.86, 0.99, snoise(p * 30.0 + vec3(0.0, uTime * 0.6, uSeed))) * max(rustCover, 0.3) : 0.0;

    vec3 n = normalize(vWorldN);
    float ndl = dot(n, normalize(uSunDir));
    float diff = max(0.0, ndl);
    vec3 light = uSunColor * uSunPower;
    vec3 col = albedo * light * diff;
    col = mix(col, vec3(0.95, 0.96, 1.0) * light * diff, clouds);
    // specular glint on water / ice
    vec3 hvec = normalize(normalize(uSunDir) + normalize(vView));
    col += light * spec * pow(max(0.0, dot(normalize(vNormal), hvec)), 40.0) * diff;
    // a bright sun would clip the day side to flat white: roll off only the highlights,
    // leaving everything below the knee exactly as it was
    vec3 over = max(col - 0.55, 0.0);
    col = min(col, vec3(0.55)) + over / (1.0 + over * 1.8);
    // hot ground glows by its own heat, by day and by night: from about 800 K a dull red all over;
    // as lava, in the cracks and pools of its crust; from about 3,000 K a sea of magma, its limb
    // hazed by boiling rock. A giant too hot for its clouds glows dully from below.
    if (uTempDay > 780.0) {
      vec3 hc = heatColor(T);
      float g = heatGlow(T);
      if (uKind == 3 || uKind == 4) {
        col += hc * g * 0.35 * smoothstep(1000.0, 1600.0, T) * (0.75 + 0.25 * detail);
      } else if (uKind == 0 || uKind == 1) {
        float n = snoise(p * 7.0 + vec3(uSeed, uTime * 0.012, -uTime * 0.008));
        float cracks = smoothstep(0.82, 0.97, 1.0 - abs(n));
        float pools = smoothstep(0.45, 0.8, fbm3(p * 3.2 + uSeed * 2.3));
        float molten = smoothstep(2200.0, 3000.0, T);
        float spread = mix(1.0, 0.15 + 1.6 * max(cracks, pools * 0.7), lava);
        spread = mix(spread, 0.8 + 0.4 * pools, molten);
        col += hc * g * spread;
        float limb = pow(1.0 - max(0.0, dot(normalize(vNormal), normalize(vView))), 2.5);
        col += hc * smoothstep(2600.0, 3600.0, T) * limb * 0.9;
      }
    }
    // settlements: warm sodium with a few neon strips
    float night = smoothstep(0.08, -0.25, ndl);
    // around a dead star there is no day side: it is night everywhere
    float dark = max(night, 1.0 - smoothstep(0.05, 0.3, uSunPower));
    // the fine street-scale texture fades out before it gets smaller than a pixel, so a
    // distant world shows soft clusters of light instead of aliased speckle
    float fineAA = 1.0 - smoothstep(0.2, 0.7, length(fwidth(p * 40.0)));
    float blocks = snoise(p * 40.0 + uSeed) * 0.3 * fineAA;
    // a young settlement is a few lit clusters; the lights spread as it grows (uDev)
    float cityLo = mix(0.9, 0.56, uDev);
    float cityMask = smoothstep(cityLo, cityLo + 0.2, cityDetail * 0.5 + 0.5 + blocks) * uLights;
    float neonCell = step(0.965, fract(sin(dot(floor(p * 60.0), vec3(12.9, 78.2, 37.7))) * 43758.5)) * fineAA;
    vec3 cityCol = mix(uCityCol, uNeon, neonCell);
    if (uKind == 1 && uLocked > 0.5) {
      // a tidally locked world is lived on along its terminator and the edge of the day side:
      // the night side is ice. Cities spread along the ring as the settlement grows.
      // (the cities stay where they were built, on the old terminator, even after the star dies)
      float ring = smoothstep(-0.3 + 0.1 * (1.0 - uDev), -0.08, facing) * (1.0 - smoothstep(0.25 + 0.15 * uDev, 0.5 + 0.15 * uDev, facing));
      float sprawl = smoothstep(0.78 - 0.4 * uDev, 0.95 - 0.3 * uDev, cityDetail * 0.5 + 0.5 + blocks * 1.2);
      float urban = ring * sprawl * smoothstep(0.0, 0.1, uDev);
      // by day: grey-brown built ground and the glint of glass roofs
      col = mix(col, vec3(0.28, 0.26, 0.25) * light * diff * (0.8 + 0.4 * cityDetail), urban * 0.75);
      // in the permanent twilight of the terminator the lights never go out
      float twilight = max(smoothstep(0.45, -0.1, ndl), dark);
      // around a dead star the cities burn low, on inner heat and fusion
      float lamp = mix(1.0, 0.5, 1.0 - smoothstep(0.05, 0.3, uSunPower));
      col += cityCol * urban * uLights * twilight * 0.95 * lamp;
      // and they light the air above them: a soft sodium haze over the built-up ring,
      // drawn on the world itself rather than smeared across the screen
      float haze = ring * smoothstep(0.5 - 0.4 * uDev, 0.95 - 0.3 * uDev, cityDetail * 0.5 + 0.5) * smoothstep(0.0, 0.1, uDev);
      col += uCityCol * haze * uLights * twilight * 0.12 * lamp;
      // a thin neon thread of transit lines linking the cities around the ring
      float lineMask = smoothstep(0.985, 1.0, sin((facing + 0.02 * snoise(p * 7.0 + uSeed)) * 120.0)) * ring * smoothstep(0.3, 0.8, uDev);
      col += uNeon * lineMask * twilight * 0.8 * lamp * lamp;
    } else {
      col += cityCol * cityMask * dark * 1.1;
      // and a faint sodium glow in the air over them
      col += uCityCol * smoothstep(cityLo - 0.12, cityLo + 0.12, cityDetail * 0.5 + 0.5) * uLights * dark * 0.1;
    }
    col += albedo * 0.015; // faint ambient from the rest of the sky
    // ice reflects what little starlight there is: the frozen night side stays faintly visible
    if (uKind == 1 || uKind == 2 || uKind == 5) col += albedo * vec3(0.012, 0.016, 0.024) * night;
    // atmosphere rim, thinning as the world dies
    // (only a thin twilight arc survives on the night side)
    float rim = pow(1.0 - max(0.0, dot(normalize(vNormal), normalize(vView))), 4.0);
    vec3 atmo = uKind == 1 ? mix(vec3(0.45, 0.62, 0.9), vec3(0.9, 0.55, 0.35), 0.4) : vec3(0.5, 0.55, 0.65);
    col += atmo * rim * (0.08 + 0.55 * uVitality) * (0.03 + 0.97 * smoothstep(-0.3, 0.35, ndl)) * uSunPower;
    // being torn apart: glowing streaks
    col += vec3(1.0, 0.55, 0.3) * uFeeding * smoothstep(0.3, 0.8, snoise(p * 6.0 + vec3(uTime * 0.2))) * 0.8;
    if (uEaten > 0.0) col += vec3(1.0, 0.36, 0.12) * uEaten * cut * (0.75 + 0.25 * sin(uTime * 9.0 + rustN * 31.0)) * 1.3;
    float toViewer = max(0.0, dot(normalize(vNormal), normalize(vView)));
    if (uViewMode == 1) {
      // light amplification: a soft fill from the viewer, so dark worlds show their ground
      col += albedo * (0.08 + 0.4 * toViewer);
    } else if (uViewMode == 2) {
      // thermal: what the world radiates, not what it reflects. Day and night sides of a locked
      // world, and the warmth of wherever people live
      float tv = max(T, 290.0 * uLights * smoothstep(cityLo - 0.1, cityLo + 0.15, cityDetail * 0.5 + 0.5));
      tv = max(tv, 900.0 * uFeeding * smoothstep(0.3, 0.8, snoise(p * 6.0 + vec3(uTime * 0.2))));
      tv = max(tv, 700.0 * uEaten * cut);
      col = thermal(tv) * (0.5 + 0.5 * toViewer) * (0.9 + 0.2 * detail);
    }
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
    // the corona is the star's own glow (there is no screen-wide bloom to lend it one)
    float corona = pow(max(0.0, 1.0 - d), 3.0) * (0.8 + 0.4 * fbm3(vec3(cos(a) * 2.0, sin(a) * 2.0, uTime * 0.1))) * 1.3;
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
