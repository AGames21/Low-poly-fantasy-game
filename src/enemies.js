// Things to fight: training dummies near spawn and wraiths that haunt the
// grounds (the hooded green-skulled reapers from the reference art).
import * as THREE from 'three';
import { snapAll } from './retro.js';
import { clothTexture, mulberry32 } from './textures.js';
import { heightAt, WORLD_BOUNDS } from './world.js';

const WRAITH_COUNT = 5;
const WRAITH_HP = 3;
const DUMMY_HP = 3;
const WRAITH_SPEED = 2.1;
const AGGRO_RADIUS = 22;

export function createEnemies(scene) {
  const rng = mulberry32(4242);
  const enemies = [];

  for (const [x, z] of [[-5, -3], [5.5, -7], [-6.5, -14]]) {
    enemies.push(makeDummy(x, z));
  }
  for (let i = 0; i < WRAITH_COUNT; i++) {
    enemies.push(makeWraith(randomWraithSpot(rng)));
  }
  for (const e of enemies) {
    snapAll(e.group);
    scene.add(e.group);
  }

  // Returns how many times the player got clawed this frame.
  function update(dt, playerPos, t) {
    let playerHits = 0;
    for (const e of enemies) {
      if (e.state === 'dead') {
        e.respawnT -= dt;
        if (e.respawnT <= 0) e.respawn(rng);
        continue;
      }
      e.update(dt, playerPos, t);
      if (e.type === 'wraith' && e.state === 'alive') {
        e.attackCd = Math.max(0, e.attackCd - dt);
        const d = flatDistance(e.group.position, playerPos);
        if (d < 1.2 && e.attackCd <= 0) {
          e.attackCd = 1.5;
          e.lungeT = 0.3;
          playerHits++;
        }
      }
    }
    return playerHits;
  }

  // A sword sweep from `origin` facing `forward`. Damages everything alive
  // in a short arc. Returns { hits, kills }.
  function applyHit(origin, forward) {
    let hits = 0;
    let kills = 0;
    for (const e of enemies) {
      if (e.state !== 'alive') continue;
      const to = e.group.position.clone().sub(origin);
      to.y = 0;
      const d = to.length();
      if (d > 2.8) continue;
      if (d > 0.7 && to.normalize().dot(forward) < 0.4) continue;
      hits++;
      e.hp--;
      e.onHit(forward);
      if (e.hp <= 0) {
        e.state = 'dying';
        e.dieT = 0.7;
        if (e.type === 'wraith') kills++;
      }
    }
    return { hits, kills };
  }

  return { update, applyHit, enemies };
}

function flatDistance(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  return Math.hypot(dx, dz);
}

function randomWraithSpot(rng) {
  const angle = rng() * Math.PI * 2;
  const radius = 16 + rng() * 30;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius * 0.9 - 10;
  return { x: THREE.MathUtils.clamp(x, -WORLD_BOUNDS + 5, WORLD_BOUNDS - 5), z: THREE.MathUtils.clamp(z, -WORLD_BOUNDS + 5, 12) };
}

// flash every lambert material in the group, decayed by update()
function makeFlash(group) {
  const mats = [];
  group.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshLambertMaterial) mats.push(o.material);
  });
  return {
    set(color) {
      for (const m of mats) m.emissive.setHex(color);
      this.t = 0.18;
    },
    t: 0,
    update(dt, restore = 0x000000) {
      if (this.t <= 0) return;
      this.t -= dt;
      if (this.t <= 0) for (const m of mats) m.emissive.setHex(restore);
    },
  };
}

// ---------------------------------------------------------------- dummies --
function makeDummy(x, z) {
  const group = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x5c4326 });
  const straw = new THREE.MeshLambertMaterial({ color: 0xa8893c });
  const sack = new THREE.MeshLambertMaterial({ map: clothTexture({ base: '#6e5838', seed: 313 }) });

  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 1.6, 8), wood);
  post.position.y = 0.8;
  group.add(post);
  const arms = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 7), wood);
  arms.rotation.z = Math.PI / 2;
  arms.position.y = 1.35;
  group.add(arms);
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 7), sack);
  body.scale.set(1, 1.35, 0.8);
  body.position.y = 1.05;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 9, 6), straw);
  head.position.y = 1.78;
  group.add(head);

  const baseY = heightAt(x, z);
  group.position.set(x, baseY, z);
  group.rotation.y = Math.random() * Math.PI * 2;

  const flash = makeFlash(group);
  const e = {
    type: 'dummy',
    group,
    hp: DUMMY_HP,
    state: 'alive',
    wobble: 0,
    wobbleDir: 1,
    dieT: 0,
    respawnT: 0,
    onHit(forward) {
      this.wobble = 0.5;
      this.wobbleDir = Math.sign(forward.x + forward.z) || 1;
      flash.set(0xff4422);
    },
    update(dt) {
      flash.update(dt);
      if (this.state === 'dying') {
        this.dieT -= dt;
        group.rotation.x = (1 - Math.max(0, this.dieT) / 0.7) * 1.4; // keel over
        if (this.dieT <= 0) {
          this.state = 'dead';
          this.respawnT = 6;
          group.visible = false;
        }
        return;
      }
      if (this.wobble > 0) {
        this.wobble = Math.max(0, this.wobble - dt);
        group.rotation.x = Math.sin(this.wobble * 24) * this.wobble * 0.5 * this.wobbleDir;
      } else {
        group.rotation.x = 0;
      }
    },
    respawn() {
      this.state = 'alive';
      this.hp = DUMMY_HP;
      group.rotation.x = 0;
      group.visible = true;
    },
  };
  return e;
}

// ---------------------------------------------------------------- wraiths --
function makeWraith(spot) {
  const group = new THREE.Group();
  const robeMat = new THREE.MeshLambertMaterial({ map: clothTexture({ base: '#0c1410', seed: 137 }), color: 0x223326 });
  const skullMat = new THREE.MeshLambertMaterial({
    color: 0x9fff9f,
    emissive: 0x2fae4f,
    emissiveIntensity: 1.4,
  });
  const dark = new THREE.MeshBasicMaterial({ color: 0x020403 });
  dark.userData.noSnap = true;

  // hooded robe: flared lathe, ragged hem
  const robe = new THREE.Mesh(
    new THREE.LatheGeometry([
      new THREE.Vector2(0.02, 1.75),
      new THREE.Vector2(0.24, 1.6),
      new THREE.Vector2(0.2, 1.2),
      new THREE.Vector2(0.34, 0.6),
      new THREE.Vector2(0.46, 0.05),
    ], 10),
    robeMat
  );
  group.add(robe);
  // hood shadow + glowing skull
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 7), skullMat);
  skull.position.set(0, 1.42, 0.08);
  skull.scale.set(1, 1.15, 1);
  group.add(skull);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), dark);
    eye.position.set(side * 0.05, 1.45, 0.2);
    group.add(eye);
  }
  // reaching arms
  const arms = new THREE.Group();
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.62, 6), robeMat);
    arm.position.set(side * 0.3, 1.05, 0.28);
    arm.rotation.x = -1.15;
    arm.rotation.z = side * -0.35;
    arms.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 7, 5), skullMat);
    hand.position.set(side * 0.42, 1.02, 0.55);
    arms.add(hand);
  }
  group.add(arms);

  group.position.set(spot.x, heightAt(spot.x, spot.z), spot.z);

  const flash = makeFlash(group);
  const e = {
    type: 'wraith',
    group,
    hp: WRAITH_HP,
    state: 'alive',
    attackCd: 0,
    lungeT: 0,
    wanderAngle: Math.random() * Math.PI * 2,
    knock: new THREE.Vector3(),
    dieT: 0,
    respawnT: 0,
    onHit(forward) {
      flash.set(0xffffff);
      this.knock.set(forward.x, 0, forward.z).multiplyScalar(7);
    },
    update(dt, playerPos, t) {
      flash.update(dt, 0x000000);
      skullMat.emissive.setHex(0x2fae4f); // flash restore turns this off; keep the glow
      if (this.state === 'dying') {
        this.dieT -= dt;
        const k = Math.max(0, this.dieT) / 0.7;
        group.scale.set(k, k, k); // wither into the ground
        group.rotation.y += dt * 9;
        if (this.dieT <= 0) {
          this.state = 'dead';
          this.respawnT = 5;
          group.visible = false;
          group.rotation.y = 0;
        }
        return;
      }

      const pos = group.position;
      const dPlayer = flatDistance(pos, playerPos);
      let vx = 0, vz = 0;
      if (dPlayer < AGGRO_RADIUS && dPlayer > 0.6) {
        // drift menacingly toward the knight
        vx = (playerPos.x - pos.x) / dPlayer;
        vz = (playerPos.z - pos.z) / dPlayer;
        group.rotation.y = Math.atan2(vx, vz);
      } else {
        this.wanderAngle += (Math.random() - 0.5) * dt * 2;
        vx = Math.sin(this.wanderAngle) * 0.35;
        vz = Math.cos(this.wanderAngle) * 0.35;
        group.rotation.y = this.wanderAngle;
      }
      const lunge = this.lungeT > 0 ? 2.2 : 1;
      if (this.lungeT > 0) this.lungeT -= dt;
      pos.x += (vx * WRAITH_SPEED * lunge + this.knock.x) * dt;
      pos.z += (vz * WRAITH_SPEED * lunge + this.knock.z) * dt;
      this.knock.multiplyScalar(Math.exp(-6 * dt));
      const r = Math.hypot(pos.x, pos.z);
      if (r > WORLD_BOUNDS - 3) {
        pos.x *= (WORLD_BOUNDS - 3) / r;
        pos.z *= (WORLD_BOUNDS - 3) / r;
      }
      // hover over the terrain with a ghostly bob
      pos.y = heightAt(pos.x, pos.z) + 0.15 + Math.sin(t * 2.2 + this.wanderAngle * 7) * 0.08;
    },
    respawn(rng) {
      const s = randomWraithSpot(rng);
      group.position.set(s.x, heightAt(s.x, s.z), s.z);
      group.scale.set(1, 1, 1);
      group.visible = true;
      this.state = 'alive';
      this.hp = WRAITH_HP;
      this.knock.set(0, 0, 0);
    },
  };
  return e;
}
