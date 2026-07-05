import * as THREE from 'three';
import { createRetroRenderer, snapAll } from './retro.js';
import { createSky } from './sky.js';
import { createWorld, WORLD_BOUNDS, heightAt } from './world.js';
import { createKnight } from './knight.js';
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

const controls = createControls(canvas);

// ---------- camera rig ----------
const cam = {
  yaw: 0,              // camera sits at +z behind the knight, looking toward the castle (-z)
  pitch: 0.14,
  dist: 5.2,
  target: new THREE.Vector3(),
};

// ---------- player state ----------
const player = {
  pos: knight.group.position,
  heading: Math.PI, // facing -z (toward castle)
  vy: 0,
  grounded: true,
  speed: 0,
};
const WALK_SPEED = 5.2;
const GRAVITY = 22;
const JUMP_VELOCITY = 8;

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

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  sky.update(time);

  const input = started
    ? controls.poll()
    : { move: { x: 0, y: 0 }, lookDX: 0, lookDY: 0, zoomDelta: 0, jump: false };

  // camera orbit
  cam.yaw -= input.lookDX * 0.005;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + input.lookDY * 0.004, -0.15, 1.1);
  cam.dist = THREE.MathUtils.clamp(cam.dist + input.zoomDelta * 0.5, 2.5, 12);

  // movement is camera-relative: forward = away from camera
  const moveLen = Math.hypot(input.move.x, input.move.y);
  if (moveLen > 0.05) {
    const forwardAngle = cam.yaw + Math.PI; // direction the camera faces
    const dx = Math.sin(forwardAngle) * input.move.y + Math.sin(forwardAngle + Math.PI / 2) * input.move.x;
    const dz = Math.cos(forwardAngle) * input.move.y + Math.cos(forwardAngle + Math.PI / 2) * input.move.x;
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
    }
  }

  knight.group.rotation.y = player.heading;
  knight.update(dt, { speed: player.speed, grounded: player.grounded });

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
