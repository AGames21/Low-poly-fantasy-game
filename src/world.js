// The castle grounds: fog, moonlight, a glowing green-lit castle at the end of
// a pink stone path, dead red trees, ruins, and a lone lantern.
import * as THREE from 'three';
import {
  stoneTexture, groundTexture, pathTexture, clothTexture, mulberry32,
} from './textures.js';

export const WORLD_BOUNDS = 88;
export const CASTLE_Z = -70;

// ---- smooth rolling terrain -------------------------------------------------
// Both the ground mesh and the player walk height sample this.
function hash2(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = (h ^ (h >> 13)) | 0;
  h = Math.imul(h, 1274126177);
  return (((h ^ (h >> 16)) >>> 0) / 4294967296);
}

function smoothNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz);
  const c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function heightAt(x, z) {
  // gentle GameCube-style hills…
  const h = (smoothNoise(x * 0.045, z * 0.045) * 0.7 + smoothNoise(x * 0.11, z * 0.11) * 0.3) * 3.4;
  // …flattened along the path corridor, the castle footprint, and spawn
  const pathMask = smoothstep(4.5, 20, Math.abs(x));
  const castleDx = Math.max(0, Math.abs(x) - 26);
  const castleDz = Math.max(0, Math.abs(z - CASTLE_Z) - 20);
  const castleMask = smoothstep(0, 16, Math.hypot(castleDx, castleDz));
  const spawnMask = smoothstep(6, 15, Math.hypot(x, z - 4));
  return h * pathMask * castleMask * spawnMask;
}

export function createWorld(scene) {
  const group = new THREE.Group();

  // --- atmosphere ---
  scene.fog = new THREE.Fog(0x140b2e, 18, 150);
  scene.add(new THREE.AmbientLight(0x3a2a66, 1.1));
  const hemi = new THREE.HemisphereLight(0x1e4d2e, 0x0a0714, 0.9);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight(0xbfe8c8, 0.85);
  moonLight.position.set(60, 90, -80);
  scene.add(moonLight);
  // cool purple fill from behind the camera so the knight's front reads
  const fill = new THREE.DirectionalLight(0x7a5adf, 0.5);
  fill.position.set(-30, 40, 60);
  scene.add(fill);

  // --- ground: displaced plane with smooth normals (rolling hills) ---
  const groundGeo = new THREE.PlaneGeometry(400, 400, 100, 100);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  }
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(
    groundGeo,
    new THREE.MeshLambertMaterial({ map: groundTexture() })
  );
  group.add(ground);

  // --- stone path to the castle (pink-lit slabs, image 3) ---
  const pathMat = new THREE.MeshLambertMaterial({ map: pathTexture() });
  const slabGeo = new THREE.BoxGeometry(1.9, 0.12, 1.9);
  const pathRng = mulberry32(101);
  for (let z = 8; z > CASTLE_Z + 8; z -= 2.1) {
    for (const xo of [-1.05, 1.05]) {
      const slab = new THREE.Mesh(slabGeo, pathMat);
      slab.position.set(
        xo + (pathRng() - 0.5) * 0.3,
        0.05 + pathRng() * 0.03,
        z + (pathRng() - 0.5) * 0.3
      );
      slab.rotation.y = (pathRng() - 0.5) * 0.2;
      group.add(slab);
    }
  }
  // warm pink glow hovering over the path so the slabs pop like the reference
  const pathGlow = new THREE.PointLight(0xff77cc, 60, 40, 2);
  pathGlow.position.set(0, 4, -6);
  group.add(pathGlow);

  // --- castle ---
  const castle = buildCastle();
  castle.position.set(0, 0, CASTLE_Z);
  group.add(castle);

  // green uplight washing the castle face (image 3)
  const castleGlow = new THREE.PointLight(0x2dff6e, 2600, 130, 2);
  castleGlow.position.set(0, 6, CASTLE_Z + 22);
  group.add(castleGlow);
  const castleGlowHigh = new THREE.PointLight(0x1fdf5a, 1400, 120, 2);
  castleGlowHigh.position.set(0, 30, CASTLE_Z + 16);
  group.add(castleGlowHigh);

  // --- dead red trees flanking the grounds (image 3) ---
  const treeRng = mulberry32(202);
  for (let i = 0; i < 34; i++) {
    const tree = buildTree(treeRng);
    let x = 0, z = 0;
    do {
      x = (treeRng() - 0.5) * 160;
      z = 20 - treeRng() * 130;
    } while (Math.abs(x) < 6 && z > CASTLE_Z - 5); // keep the path clear
    tree.position.set(x, heightAt(x, z) - 0.05, z);
    tree.rotation.y = treeRng() * Math.PI * 2;
    const s = 0.8 + treeRng() * 0.9;
    tree.scale.set(s, s, s);
    group.add(tree);
  }

  // --- ruins: broken walls and pillars ---
  const ruinMat = new THREE.MeshLambertMaterial({ map: stoneTexture({ seed: 13 }) });
  const ruinRng = mulberry32(303);
  for (let i = 0; i < 10; i++) {
    const w = 3 + ruinRng() * 5;
    const h = 1 + ruinRng() * 2.4;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.8), ruinMat);
    const x = (ruinRng() - 0.5) * 130;
    const z = 15 - ruinRng() * 100;
    if (Math.abs(x) < 7) continue;
    wall.position.set(x, heightAt(x, z) + h / 2 - 0.15, z);
    wall.rotation.y = ruinRng() * Math.PI;
    wall.rotation.z = (ruinRng() - 0.5) * 0.08;
    group.add(wall);
  }
  for (let i = 0; i < 6; i++) {
    const h = 2 + ruinRng() * 3;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, h, 6), ruinMat);
    const x = (ruinRng() - 0.5) * 110;
    const z = 10 - ruinRng() * 90;
    if (Math.abs(x) < 7) continue;
    pillar.position.set(x, heightAt(x, z) + h / 2 - 0.15, z);
    pillar.rotation.z = (ruinRng() - 0.5) * 0.15;
    group.add(pillar);
  }

  // --- lantern by the path (image 2) ---
  const lantern = buildLantern();
  lantern.position.set(3.4, 0, -4);
  group.add(lantern);

  scene.add(group);
  return { group };
}

function buildCastle() {
  const castle = new THREE.Group();
  const wallMat = new THREE.MeshLambertMaterial({ map: stoneTexture({ seed: 7 }) });
  const wallMatDark = new THREE.MeshLambertMaterial({ map: stoneTexture({ base: '#3a3648', mortar: '#221f30', seed: 9 }) });
  const spireMat = new THREE.MeshLambertMaterial({ color: 0x14101f });

  const box = (w, h, d, mat = wallMat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const tower = (r, h, mat = wallMat) => new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.12, h, 12), mat);
  const spire = (r, h) => new THREE.Mesh(new THREE.ConeGeometry(r, h, 12), spireMat);

  // main keep
  const keep = box(18, 26, 14);
  keep.position.y = 13;
  castle.add(keep);
  const keepUpper = box(12, 10, 10, wallMatDark);
  keepUpper.position.y = 31;
  castle.add(keepUpper);
  const keepSpire = spire(7, 14);
  keepSpire.position.y = 43;
  castle.add(keepSpire);

  // corner towers + spires
  const towerSpots = [
    [-11, -6], [11, -6], [-11, 6], [11, 6],
  ];
  for (const [x, z] of towerSpots) {
    const t = tower(3, 30);
    t.position.set(x, 15, z);
    castle.add(t);
    const s = spire(4, 11);
    s.position.set(x, 35.5, z);
    castle.add(s);
  }
  // outer flanking towers
  for (const x of [-20, 20]) {
    const t = tower(2.4, 18, wallMatDark);
    t.position.set(x, 9, 2);
    castle.add(t);
    const s = spire(3.2, 9);
    s.position.set(x, 22.5, x < 0 ? 2 : 2);
    castle.add(s);
  }

  // battlements along the keep roofline
  for (let x = -8; x <= 8; x += 2.6) {
    const merlon = box(1.2, 1.4, 1.2, wallMatDark);
    merlon.position.set(x, 26.7, 7 - 0.6);
    castle.add(merlon);
  }

  // gate arch
  const gate = box(5, 8, 1.2, wallMatDark);
  gate.position.set(0, 4, 7.2);
  castle.add(gate);
  const gateHole = new THREE.Mesh(
    new THREE.BoxGeometry(3, 6, 1.4),
    new THREE.MeshBasicMaterial({ color: 0x020108 })
  );
  gateHole.position.set(0, 3, 7.3);
  castle.add(gateHole);

  // glowing green windows
  const winMat = new THREE.MeshBasicMaterial({ color: 0x66ffa0 });
  winMat.userData.noSnap = true;
  const winGeo = new THREE.PlaneGeometry(0.9, 2);
  const windowSpots = [
    [-4, 16], [4, 16], [0, 20], [-4, 10], [4, 10], [0, 33], [-3, 30], [3, 30],
  ];
  for (const [x, y] of windowSpots) {
    const win = new THREE.Mesh(winGeo, winMat);
    win.position.set(x, y, 7.08);
    castle.add(win);
  }

  return castle;
}

function buildTree(rng) {
  const tree = new THREE.Group();
  const barkMat = new THREE.MeshLambertMaterial({ color: 0x1a1016 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x6e1414 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.4, 3.2, 7), barkMat);
  trunk.position.y = 1.6;
  tree.add(trunk);

  // smooth blob canopy: overlapping squashed spheres (GC-style foliage)
  const clumps = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < clumps; i++) {
    const r = 0.9 + rng() * 1.1;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), leafMat);
    leaf.position.set(
      (rng() - 0.5) * 2.0,
      3.0 + rng() * 1.6,
      (rng() - 0.5) * 2.0
    );
    leaf.scale.set(1, 0.75 + rng() * 0.3, 1);
    leaf.rotation.y = rng() * Math.PI;
    tree.add(leaf);
  }
  // a couple of bare branches
  for (let i = 0; i < 2; i++) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 1.6, 5), barkMat);
    branch.position.set((rng() - 0.5) * 0.8, 2.4 + rng() * 0.8, (rng() - 0.5) * 0.8);
    branch.rotation.z = (rng() - 0.5) * 1.8;
    branch.rotation.x = (rng() - 0.5) * 1.2;
    tree.add(branch);
  }
  return tree;
}

function buildLantern() {
  const lantern = new THREE.Group();
  const postMat = new THREE.MeshLambertMaterial({ map: clothTexture({ base: '#241a12', seed: 91 }) });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 2.6, 5), postMat);
  post.position.y = 1.3;
  lantern.add(post);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), postMat);
  arm.position.set(0.3, 2.55, 0);
  lantern.add(arm);

  const cage = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.44, 0.34),
    new THREE.MeshLambertMaterial({ color: 0x2a1a10 })
  );
  cage.position.set(0.6, 2.25, 0);
  lantern.add(cage);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa23a });
  flameMat.userData.noSnap = true;
  const flame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), flameMat);
  flame.position.copy(cage.position);
  lantern.add(flame);

  const light = new THREE.PointLight(0xff8c2a, 40, 18, 2);
  light.position.set(0.6, 2.3, 0);
  lantern.add(light);
  return lantern;
}
