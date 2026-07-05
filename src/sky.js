// Green nebula night sky — the signature backdrop from the reference shots.
// A big inverted sphere with a shader: black horizon-to-green aurora gradient,
// slowly swirling noise clouds, stars, and a separate low-poly moon.
import * as THREE from 'three';

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const skyFragment = /* glsl */ `
  varying vec3 vDir;
  uniform float uTime;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.1 + vec2(13.7, 7.3);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float up = clamp(dir.y, -0.2, 1.0);

    // base: dark horizon rising into deep green
    vec3 horizon = vec3(0.02, 0.04, 0.08);
    vec3 zenith = vec3(0.01, 0.17, 0.06);
    vec3 col = mix(horizon, zenith, smoothstep(-0.05, 0.6, up));

    // swirling aurora clouds — bright, dominant green (the reference look)
    vec2 uv = dir.xz / (0.35 + abs(dir.y));
    float t = uTime * 0.012;
    float clouds = fbm(uv * 1.6 + vec2(t * 2.0, -t));
    clouds = clouds * fbm(uv * 3.4 - vec2(t, t * 1.7));
    float band = smoothstep(-0.02, 0.4, up) * (1.0 - smoothstep(0.8, 1.0, up) * 0.35);
    vec3 aurora = vec3(0.08, 0.95, 0.30) * pow(clouds, 1.4) * band * 4.6;
    vec3 auroraDim = vec3(0.03, 0.36, 0.15) * clouds * band * 2.2;
    col += aurora + auroraDim;

    // stars in the dark gaps
    vec2 sp = floor(dir.xz / max(0.12, abs(dir.y)) * 42.0);
    float star = step(0.995, hash(sp));
    float twinkle = 0.6 + 0.4 * sin(uTime * 2.0 + hash(sp.yx) * 40.0);
    col += vec3(0.8, 1.0, 0.9) * star * twinkle * smoothstep(0.12, 0.5, up) * (1.0 - clamp(aurora.g, 0.0, 1.0));

    // subtle purple glow bleeding up from the horizon (castle-lands haze)
    col += vec3(0.10, 0.03, 0.22) * (1.0 - smoothstep(-0.05, 0.35, up));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createSky() {
  const group = new THREE.Group();

  const skyMat = new THREE.ShaderMaterial({
    vertexShader: skyVertex,
    fragmentShader: skyFragment,
    uniforms: { uTime: { value: 0 } },
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  skyMat.userData.noSnap = true;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(400, 24, 16), skyMat);
  group.add(sky);

  // Low-poly moon with painted craters (image 3).
  const moonCanvas = document.createElement('canvas');
  moonCanvas.width = moonCanvas.height = 64;
  const ctx = moonCanvas.getContext('2d');
  ctx.fillStyle = '#cfe8cf';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#9fbfa2';
  const craters = [[14, 18, 7], [38, 12, 5], [46, 40, 9], [20, 44, 6], [33, 28, 4], [10, 34, 3]];
  for (const [x, y, r] of craters) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const moonTex = new THREE.CanvasTexture(moonCanvas);
  moonTex.magFilter = THREE.NearestFilter;
  moonTex.minFilter = THREE.NearestFilter;
  moonTex.colorSpace = THREE.SRGBColorSpace;
  const moonMat = new THREE.MeshBasicMaterial({ map: moonTex, fog: false });
  moonMat.userData.noSnap = true;
  const moon = new THREE.Mesh(new THREE.SphereGeometry(22, 10, 8), moonMat);
  moon.position.set(120, 135, -270);
  group.add(moon);

  // soft glow billboard behind the moon
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = glowCanvas.height = 64;
  const gctx = glowCanvas.getContext('2d');
  const grad = gctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  grad.addColorStop(0, 'rgba(210,255,215,0.55)');
  grad.addColorStop(1, 'rgba(210,255,215,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 64, 64);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  glowMat.userData.noSnap = true;
  const glow = new THREE.Sprite(glowMat);
  glow.scale.set(110, 110, 1);
  glow.position.copy(moon.position);
  group.add(glow);

  function update(time) {
    skyMat.uniforms.uTime.value = time;
  }

  return { group, update };
}
