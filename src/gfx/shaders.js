export const SKY_VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform float uSunSize;
uniform float uNight;
uniform float uTime;
varying vec3 vWorld;

float hash3(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

// Deterministic star field: one star per sparse grid cell, fixed in world
// direction space (no per-pixel noise -> no TV-static shimmer).
vec3 stars(vec3 dir, float night) {
  if (night <= 0.3) return vec3(0.0);
  float grid = 74.0;
  vec3 cell = floor(dir * grid);
  float r = hash3(cell);
  if (r > 0.2) return vec3(0.0);
  vec3 off = vec3(
    hash3(cell + vec3(1.7, 9.2, 4.1)),
    hash3(cell + vec3(7.3, 2.1, 8.5)),
    hash3(cell + vec3(3.1, 6.7, 1.9))
  ) - 0.5;
  vec3 starDir = normalize(cell + off * 0.7);
  float ang = acos(clamp(dot(dir, starDir), -1.0, 1.0));
  float twinkle = 0.78 + 0.22 * sin(uTime * 1.6 + r * 41.0);
  float b = (0.45 + r * 1.7) * twinkle;
  return vec3(0.82, 0.87, 1.0) * b * (1.0 - smoothstep(0.006, 0.03, ang));
}

void main() {
  vec3 dir = normalize(vWorld);
  float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(h, 0.85));

  float sun = pow(max(dot(dir, normalize(uSunDir)), 0.0), 1400.0 / uSunSize);
  float glow = pow(max(dot(dir, normalize(uSunDir)), 0.0), 7.0);
  col += uSunColor * sun * 1.8;
  col += uSunColor * glow * 0.1;

  float moon = pow(max(dot(dir, normalize(uMoonDir)), 0.0), 900.0);
  col += vec3(0.72, 0.78, 0.92) * moon * uNight * 1.5;

  col += stars(dir, uNight) * (uNight - 0.3) / 0.7;

  float haze = pow(1.0 - abs(dir.y), 3.0);
  col += uHorizon * haze * 0.06;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const WATER_VERT = /* glsl */ `
uniform float uTime;
uniform vec2 uWind;
varying vec3 vWorld;
varying vec3 vNrm;
varying vec2 vUv;

void main() {
  vUv = uv;
  vec3 p = position;
  float w1 = sin(p.x * 0.55 + uTime * 1.1 + uWind.x) * 0.08;
  float w2 = cos(p.z * 0.7 + uTime * 0.85 + uWind.y) * 0.06;
  float w3 = sin((p.x + p.z) * 0.35 + uTime * 1.6) * 0.04;
  p.y += w1 + w2 + w3;
  vec3 dx = vec3(1.0, cos(p.x * 0.55 + uTime * 1.1) * 0.04, 0.0);
  vec3 dz = vec3(0.0, -sin(p.z * 0.7 + uTime * 0.85) * 0.04, 1.0);
  vNrm = normalize(normalMatrix * normalize(cross(dz, dx)));
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const WATER_FRAG = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSunDir;
uniform float uTime;
uniform vec3 uCam;
varying vec3 vWorld;
varying vec3 vNrm;
varying vec2 vUv;

void main() {
  vec3 n = normalize(vNrm);
  vec3 view = normalize(uCam - vWorld);
  float fres = pow(1.0 - max(dot(n, view), 0.0), 3.0);
  float depth = smoothstep(0.0, 3.5, 1.6 - vWorld.y * 0.02);
  vec3 col = mix(uShallow, uDeep, depth);
  float spec = pow(max(dot(reflect(-normalize(uSunDir), n), view), 0.0), 48.0);
  float foam = smoothstep(0.72, 0.95, sin(vUv.x * 40.0 + uTime) * 0.5 + 0.5) * 0.12;
  col += vec3(0.85, 0.92, 0.95) * spec * 0.55;
  col += vec3(0.78, 0.86, 0.88) * foam;
  col = mix(col, vec3(0.78, 0.88, 0.92), fres * 0.55);
  gl_FragColor = vec4(col, 0.78 + fres * 0.18);
}
`;

export const GRASS_VERT = /* glsl */ `
uniform float uTime;
uniform vec3 uWind;
uniform vec3 uPlayer;
attribute float aPhase;
attribute float aShade;
varying float vShade;

void main() {
  vShade = aShade;
  vec3 p = position;
  float h = uv.y;
  vec3 wpos = (instanceMatrix * vec4(p, 1.0)).xyz;
  float dist = length(wpos.xz - uPlayer.xz);
  float part = smoothstep(1.8, 0.2, dist) * 0.24;
  float gust = sin(uTime * 1.4 + aPhase + wpos.x * 0.4 + wpos.z * 0.3);
  p.x += (uWind.x * 0.16 + gust * 0.11) * h * h;
  p.z += (uWind.z * 0.16 + gust * 0.09) * h * h;
  vec3 away = normalize(vec3(wpos.x - uPlayer.x, 0.0, wpos.z - uPlayer.z) + vec3(0.001, 0.0, 0.0));
  p.x += away.x * part * h;
  p.z += away.z * part * h;
  float hide = smoothstep(1.7, 3.0, dist);
  vShade = aShade * hide;
  if (dist < 1.6) p.y -= 4.0;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

export const GRASS_FRAG = /* glsl */ `
varying float vShade;
void main() {
  // Deep conifer green with ochre variation; darker than the old blades so
  // the field never reads as white strokes against the bright sky.
  float mixK = clamp(vShade * 0.6, 0.0, 1.0);
  vec3 col = mix(vec3(0.30, 0.36, 0.20), vec3(0.46, 0.40, 0.22), mixK);
  col *= 0.70 + vShade * 0.30;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const TOON_WRAP = /* glsl */ `
#ifndef SKY_WRAP
#define SKY_WRAP
vec3 skyWrap(vec3 col, vec3 n, vec3 light, vec3 sky, vec3 ground) {
  float wrap = dot(n, light) * 0.5 + 0.5;
  float rim = pow(1.0 - max(dot(n, vec3(0.0, 1.0, 0.0)), 0.0), 2.0);
  col *= mix(0.55, 1.12, wrap);
  col += sky * 0.08 * (n.y * 0.5 + 0.5);
  col += ground * 0.05 * (1.0 - n.y);
  col += rim * sky * 0.06;
  return col;
}
#endif
`;
