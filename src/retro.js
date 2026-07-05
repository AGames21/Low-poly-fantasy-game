// Retro console rendering: the game renders at a reduced internal resolution
// and the canvas is stretched fullscreen with smooth (bilinear) scaling — the
// soft GameCube-era look. Materials also get subtle vertex snapping.
import * as THREE from 'three';

export const INTERNAL_HEIGHT = 432;

export function createRetroRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  function resize() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const h = INTERNAL_HEIGHT;
    const w = Math.round(h * aspect);
    // third arg false: keep the CSS size fullscreen, only shrink the buffer
    renderer.setSize(w, h, false);
    return { width: w, height: h, aspect };
  }

  return { renderer, resize };
}

// Quantizes clip-space vertex positions to a grid → subtle retro vertex
// wobble. Kept fine enough that meshes still read as smooth (GameCube-era),
// not jittery PS1.
const SNAP = new THREE.Vector2(480, 270);

export function snapMaterial(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      {
        vec2 snapRes = vec2(${SNAP.x.toFixed(1)}, ${SNAP.y.toFixed(1)});
        vec3 ndc = gl_Position.xyz / gl_Position.w;
        ndc.xy = floor(ndc.xy * snapRes) / snapRes;
        gl_Position.xyz = ndc * gl_Position.w;
      }`
    );
  };
  return material;
}

export function snapAll(root) {
  root.traverse((obj) => {
    if (obj.isMesh && obj.material && !obj.material.userData.noSnap) {
      snapMaterial(obj.material);
    }
  });
}
