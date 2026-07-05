import * as THREE from 'three';
import { createRetroRenderer, snapAll } from './retro.js';
import { createSky } from './sky.js';
import { createWorld, WORLD_BOUNDS, heightAt } from './world.js';
import { createKnight } from './knight.js';
import { createEnemies } from './enemies.js';
import { createControls } from './controls.js';
import { createUI, loadConfig } from './ui.js';

const canvas = document.getElementById('game-canvas');
const { renderer, resize } = createRetroRenderer(canvas);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 500);

const sky = createSky();
scene.add(sky.group);
createWorld(scene);
snapAll(scene);

const knight = createKnight(loadConfig());
knight.group.position.set(0, 0, 4);
scene.add(knight.group);

const enemies = createEnemies(scene);
const controls = createControls(canvas);

// ---------- camera rig ----------
const cam = {
  yaw: 0,              // camera sits at +z behind the knight, looking toward the castle (-z)
  pitch: 0.14,
  dist: 5.2,
  target: new THREE.Vector3(),
};

// ---------- player state ----------
const MAX_HP = 5;
const OBJECTIVE_KILLS = 5;
const player = {
  pos: knight.group.position,
  heading: Math.PI, // facing -z (toward castle)
  vy: 0,
  grounded: true,
  speed: 0,
  hp: MAX_HP,
  invulnT: 0,
  kills: 0,
  deadT: 0,
};
const WALK_SPEED = 5.2;
const GRAVITY = 22;
const JUMP_VELOCITY = 8;
let swingConnected = true; // current sword swing already hit something

// ---------- combat/status HUD ----------
const heartsEl = document.getElementById('hearts');
const objectiveEl = document.getElementById('objective');
const damageFlashEl = document.getElementById('damage-flash');
const deathScreenEl = document.getElementById('death-screen');

function updateHUD() {
  heartsEl.innerHTML =
    '<span class="full">' + '♥'.repeat(player.hp) + '</span>' +
    '<span class="empty">' + '♥'.repeat(MAX_HP - player.hp) + '</span>';
  objectiveEl.textContent = player.kills >= OBJECTIVE_KILLS
    ? 'The grounds are cleansed… for now.'
    : `Slay ${OBJECTIVE_KILLS} wraiths — ${player.kills}/${OBJECTIVE_KILLS}`;
}
updateHUD();

function hurtPlayer() {
  if (player.invulnT > 0 || player.deadT > 0) return;
  player.hp--;
  player.invulnT = 1.2;
  updateHUD();
  damageFlashEl.style.opacity = '1';
  setTimeout(() => { damageFlashEl.style.opacity = '0'; }, 180);
  if (player.hp <= 0) {
    player.deadT = 2.2;
    deathScreenEl.style.display = 'flex';
  }
}

function respawnPlayer() {
  player.pos.set(0, 0, 4);
  player.heading = Math.PI;
  player.vy = 0;
  player.grounded = true;
  player.hp = MAX_HP;
  player.invulnT = 2;
  cam.yaw = 0;
  deathScreenEl.style.display = 'none';
  updateHUD();
}

let started = false;
createUI({
  onStart: () => { started = true; },
  onConfigChange: (config) => knight.applyConfig(config),
  onPlatformChange: () => {},
});

function onResize() {
  const { aspect } = resize();
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);
onResize();

const clock = new THREE.Clock();
const tmpDir = new THREE.Vector3();

// exposed for automated end-to-end tests
window.__knight = { player, cam, enemies, knight };

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  sky.update(time);

  const input = started && player.deadT <= 0
    ? controls.poll()
    : { move: { x: 0, y: 0 }, lookDX: 0, lookDY: 0, zoomDelta: 0, jump: false, attack: false };

  // death / respawn
  if (player.deadT > 0) {
    player.deadT -= dt;
    if (player.deadT <= 0) respawnPlayer();
  }
  if (player.invulnT > 0) player.invulnT -= dt;

  // camera orbit
  cam.yaw -= input.lookDX * 0.005;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + input.lookDY * 0.004, -0.15, 1.1);
  cam.dist = THREE.MathUtils.clamp(cam.dist + input.zoomDelta * 0.5, 2.5, 12);

  // movement is camera-relative: forward = away from camera
  const moveLen = Math.hypot(input.move.x, input.move.y);
  if (moveLen > 0.05) {
    const forwardAngle = cam.yaw + Math.PI; // direction the camera faces
    const rightAngle = forwardAngle - Math.PI / 2; // camera's screen-right
    const dx = Math.sin(forwardAngle) * input.move.y + Math.sin(rightAngle) * input.move.x;
    const dz = Math.cos(forwardAngle) * input.move.y + Math.cos(rightAngle) * input.move.x;
    tmpDir.set(dx, 0, dz).normalize();
    player.pos.x += tmpDir.x * WALK_SPEED * moveLen * dt;
    player.pos.z += tmpDir.z * WALK_SPEED * moveLen * dt;
    const targetHeading = Math.atan2(tmpDir.x, tmpDir.z);
    player.heading = dampAngle(player.heading, targetHeading, 12, dt);
    player.speed = WALK_SPEED * moveLen;
  } else {
    player.speed = 0;
  }

  // world bounds
  const r = Math.hypot(player.pos.x, player.pos.z);
  if (r > WORLD_BOUNDS) {
    player.pos.x *= WORLD_BOUNDS / r;
    player.pos.z *= WORLD_BOUNDS / r;
  }

  // jump / gravity, walking over the rolling terrain
  const groundY = heightAt(player.pos.x, player.pos.z);
  if (input.jump && player.grounded) {
    player.vy = JUMP_VELOCITY;
    player.grounded = false;
  }
  if (player.grounded) {
    player.pos.y = groundY;
  } else {
    player.vy -= GRAVITY * dt;
    player.pos.y += player.vy * dt;
    if (player.pos.y <= groundY) {
      player.pos.y = groundY;
      player.vy = 0;
      player.grounded = true;
      knight.land();
    }
  }

  // ---- combat ----
  if (input.attack && knight.attack()) {
    swingConnected = false;
  }
  if (!swingConnected && knight.attackHitActive()) {
    tmpDir.set(Math.sin(player.heading), 0, Math.cos(player.heading));
    const result = enemies.applyHit(player.pos, tmpDir);
    if (result.hits > 0) {
      swingConnected = true;
      if (result.kills > 0) {
        player.kills += result.kills;
        updateHUD();
      }
    }
  }
  if (started) {
    const clawHits = enemies.update(dt, player.pos, time);
    if (clawHits > 0) hurtPlayer();
  }
  // flicker while invulnerable so the hit reads
  knight.group.visible = player.invulnT <= 0 || Math.floor(time * 12) % 2 === 0;

  knight.group.rotation.y = player.heading;
  knight.update(dt, { speed: player.speed, grounded: player.grounded, vy: player.vy });

  // follow camera with a little lag
  cam.target.lerp(
    new THREE.Vector3(player.pos.x, player.pos.y + 1.45, player.pos.z),
    1 - Math.exp(-8 * dt)
  );
  const offX = Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
  const offY = Math.sin(cam.pitch) * cam.dist;
  const offZ = Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
  camera.position.set(cam.target.x + offX, cam.target.y + offY, cam.target.z + offZ);
  camera.lookAt(cam.target);

  renderer.render(scene, camera);
}

function dampAngle(current, target, lambda, dt) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

tick();
