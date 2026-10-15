/**
 * Halftone earth. Each land dot is a point sprite. Dots near the active stop
 * swell and warm toward the safelight accent; dots turning away from the
 * camera fade out so the limb stays soft.
 */
export const dotsVertex = /* glsl */ `
  uniform float uSize;
  uniform float uPixelRatio;
  uniform vec3 uActive;
  uniform float uActiveStrength;
  attribute float aRand;
  varying float vFacing;
  varying float vGlow;
  varying float vRand;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 normal = normalize(world.xyz);
    vFacing = dot(normal, normalize(cameraPosition - world.xyz));
    vGlow = smoothstep(0.16, 0.0, distance(normalize(position), uActive)) * uActiveStrength;
    vRand = aRand;
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * uPixelRatio * (1.0 + vGlow * 0.9) * (3.0 / -mv.z);
  }
`;

export const dotsFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uOpacity;
  uniform float uTime;
  varying float vFacing;
  varying float vGlow;
  varying float vRand;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    if (r > 0.5) discard;
    float disc = smoothstep(0.5, 0.32, r);
    float facing = smoothstep(-0.02, 0.4, vFacing);
    float shimmer = 0.85 + 0.15 * sin(uTime * 1.3 + vRand * 6.2831);
    vec3 color = mix(uColor, uAccent, vGlow);
    float alpha = disc * facing * uOpacity * mix(0.92 * shimmer, 1.0, vGlow);
    gl_FragColor = vec4(color, alpha);
  }
`;

/** Fresnel rim on a back-faced shell: a faint warm atmosphere. */
export const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const atmosphereFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormal;
  void main() {
    float rim = pow(max(0.0, 0.66 - dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
    gl_FragColor = vec4(uColor, rim * uOpacity);
  }
`;

/**
 * Travel arcs. Tube UVs run 0 → 1 along the curve, so drawing an arc is a
 * single uniform: discard everything past uDraw, and brighten a short head
 * just behind it like a tracer.
 */
export const arcVertex = /* glsl */ `
  varying float vT;
  void main() {
    vT = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const arcFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uDraw;
  uniform float uOpacity;
  varying float vT;
  void main() {
    if (vT > uDraw) discard;
    float head = smoothstep(uDraw - 0.12, uDraw, vT) * step(uDraw, 0.999);
    float tail = smoothstep(0.0, 0.06, vT);
    gl_FragColor = vec4(uColor + head * 0.6, (0.55 + head * 0.45) * tail * uOpacity);
  }
`;

/** Pin halo: a pulsing ring on a camera-facing quad. */
export const pinFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uActive;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float r = length(vUv - 0.5) * 2.0;
    float core = smoothstep(0.26, 0.18, r);
    float pulse = fract(uTime * 0.6);
    float ring = smoothstep(0.06, 0.0, abs(r - pulse)) * (1.0 - pulse) * uActive;
    float halo = smoothstep(1.0, 0.2, r) * 0.18 * uActive;
    float a = (core + ring + halo) * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uColor, a);
  }
`;

export const pinVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
