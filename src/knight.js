// The customizable knight: a low-poly articulated figure built entirely from
// primitives, with swappable helmets, armor materials, tints, and gear.
import * as THREE from 'three';
import { snapAll } from './retro.js';
import {
  metalTexture, enchantedTexture, clothTexture, bookTexture, pageTexture,
} from './textures.js';

export const HELMETS = {
  greathelm: 'Great Helm',
  bucket: 'Bucket Helm',
  pointed: 'Pointed Helm',
};

export const ARMOR_MATERIALS = {
  silver: 'Polished Silver',
  iron: 'Dark Iron',
  gold: 'Royal Gold',
  enchanted: 'Enchanted Marble',
};

export const TINTS = ['#ffffff', '#9fb6ff', '#ff9f9f', '#9fffb2', '#c9a0ff', '#ffe29f'];

export const WEAPONS = {
  sword: 'Longsword',
  swordshield: 'Sword & Shield',
  book: 'Forbidden Tome',
  none: 'Unarmed',
};

export const DEFAULT_CONFIG = {
  helmet: 'greathelm',
  material: 'silver',
  tint: '#ffffff',
  weapon: 'sword',
};

// cache generated textures so re-customizing doesn't rebuild canvases
const tex = {};
function getTex(name, make) {
  if (!tex[name]) tex[name] = make();
  return tex[name];
}

function makeArmorMaterial(preset, tintHex) {
  const tint = new THREE.Color(tintHex);
  let mat;
  switch (preset) {
    case 'iron':
      mat = new THREE.MeshLambertMaterial({
        map: getTex('metalDark', () => metalTexture({ seed: 33 })),
        color: new THREE.Color(0x4a4a58).multiply(tint),
      });
      break;
    case 'gold':
      mat = new THREE.MeshLambertMaterial({
        map: getTex('metal', () => metalTexture()),
        color: new THREE.Color(0xd8a83a).multiply(tint),
      });
      break;
    case 'enchanted': {
      const marble = getTex('enchanted', () => enchantedTexture());
      mat = new THREE.MeshLambertMaterial({
        map: marble,
        color: new THREE.Color(0xbfffe8).multiply(tint),
        emissive: new THREE.Color(0x55ffd0).multiply(tint),
        emissiveMap: marble,
        emissiveIntensity: 2.2,
      });
      break;
    }
    case 'silver':
    default:
      mat = new THREE.MeshLambertMaterial({
        map: getTex('metal', () => metalTexture()),
        color: new THREE.Color(0xe8e8f4).multiply(tint),
      });
  }
  return mat;
}

export function createKnight(initialConfig = DEFAULT_CONFIG) {
  const group = new THREE.Group(); // world transform, owned by main.js
  let model = null;
  let joints = null;
  let config = { ...DEFAULT_CONFIG, ...initialConfig };
  let walkPhase = 0;

  function applyConfig(next) {
    config = { ...config, ...next };
    if (model) {
      group.remove(model);
      model.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          if (o.material && !o.material.userData.shared) o.material.dispose();
        }
      });
    }
    ({ model, joints } = buildModel(config));
    snapAll(model);
    group.add(model);
  }

  function update(dt, { speed = 0, grounded = true } = {}) {
    if (!joints) return;
    const moving = speed > 0.1;
    if (moving) walkPhase += dt * speed * 3.4;
    const t = performance.now() / 1000;

    const legSwing = moving ? Math.sin(walkPhase) * 0.65 : 0;
    const armSwing = moving ? Math.sin(walkPhase) * 0.45 : 0;
    const idle = Math.sin(t * 1.6) * 0.03;

    joints.hipL.rotation.x = legSwing;
    joints.hipR.rotation.x = -legSwing;
    joints.kneeL.rotation.x = moving ? Math.max(0, -Math.sin(walkPhase - 0.6)) * 0.7 : 0;
    joints.kneeR.rotation.x = moving ? Math.max(0, Math.sin(walkPhase - 0.6)) * 0.7 : 0;

    if (!grounded) {
      // simple jump pose: legs tucked, arms slightly out
      joints.hipL.rotation.x = 0.5;
      joints.hipR.rotation.x = 0.4;
      joints.kneeL.rotation.x = 0.9;
      joints.kneeR.rotation.x = 0.8;
    }

    if (config.weapon === 'book') {
      // both hands hold the tome in front of the chest, head tilted to read
      joints.shoulderL.rotation.set(-1.05, 0.35, 0.15);
      joints.elbowL.rotation.x = -0.85;
      joints.shoulderR.rotation.set(-1.05, -0.35, -0.15);
      joints.elbowR.rotation.x = -0.85;
      joints.head.rotation.x = 0.35 + idle * 0.5;
    } else {
      joints.shoulderL.rotation.set(-armSwing, 0, 0.12 + (moving ? 0 : idle));
      joints.elbowL.rotation.x = -0.25 - (moving ? Math.max(0, armSwing) * 0.4 : 0);
      const holding = config.weapon !== 'none';
      joints.shoulderR.rotation.set(holding ? armSwing * 0.4 - 0.15 : armSwing, 0, -0.12 - (moving ? 0 : idle));
      joints.elbowR.rotation.x = holding ? -0.5 : -0.25 - (moving ? Math.max(0, -armSwing) * 0.4 : 0);
      joints.head.rotation.x = idle * 0.4;
    }

    // torso bob + sway
    joints.torso.position.y = joints.torsoBaseY + (moving ? Math.abs(Math.sin(walkPhase)) * 0.05 : idle * 0.4);
    joints.torso.rotation.z = moving ? Math.sin(walkPhase) * 0.045 : idle * 0.3;
  }

  applyConfig(config);
  return {
    group,
    applyConfig,
    update,
    getConfig: () => ({ ...config }),
  };
}

function buildModel(config) {
  const model = new THREE.Group();
  const armor = makeArmorMaterial(config.material, config.tint);
  const armorFlat = armor.clone();
  armorFlat.flatShading = true;
  const cloth = new THREE.MeshLambertMaterial({ map: getTex('cloth', () => clothTexture()) });
  const clothDark = new THREE.MeshLambertMaterial({ map: getTex('clothDark', () => clothTexture({ base: '#100c18', seed: 61 })) });

  const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  const cyl = (rt, rb, h, mat, seg = 6) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);

  // ---- torso ----
  const torso = new THREE.Group();
  const torsoBaseY = 1.02;
  torso.position.y = torsoBaseY;
  model.add(torso);

  const chest = box(0.62, 0.62, 0.4, armor);
  chest.position.y = 0.42;
  torso.add(chest);
  const belly = box(0.5, 0.26, 0.34, cloth);
  belly.position.y = 0.05;
  torso.add(belly);
  const belt = box(0.54, 0.09, 0.38, clothDark);
  belt.position.y = -0.08;
  torso.add(belt);
  // tabard skirt (tapered)
  const skirt = cyl(0.32, 0.44, 0.5, cloth, 6);
  skirt.position.y = -0.32;
  torso.add(skirt);

  // pauldrons
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.21, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2), armorFlat);
    pauldron.position.set(side * 0.4, 0.68, 0);
    pauldron.scale.set(1.15, 1, 1.1);
    torso.add(pauldron);
  }

  // ---- head ----
  const head = new THREE.Group();
  head.position.y = 0.78;
  torso.add(head);
  const neck = cyl(0.1, 0.12, 0.12, clothDark, 6);
  neck.position.y = 0.02;
  head.add(neck);
  head.add(buildHelmet(config.helmet, armor, armorFlat));

  // ---- arms ----
  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.42, 0.62, 0);
    torso.add(shoulder);
    const upper = box(0.16, 0.4, 0.18, cloth);
    upper.position.y = -0.22;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.44;
    shoulder.add(elbow);
    const forearm = box(0.15, 0.34, 0.16, armor);
    forearm.position.y = -0.18;
    elbow.add(forearm);
    const hand = new THREE.Group();
    hand.position.y = -0.4;
    elbow.add(hand);
    const gauntlet = box(0.14, 0.14, 0.15, armorFlat);
    hand.add(gauntlet);
    return { shoulder, elbow, hand };
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // ---- legs ----
  const makeLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.17, 1.0, 0);
    model.add(hip);
    const thigh = box(0.2, 0.42, 0.22, cloth);
    thigh.position.y = -0.24;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.48;
    hip.add(knee);
    const shin = box(0.17, 0.4, 0.19, armor);
    shin.position.y = -0.22;
    knee.add(shin);
    const boot = box(0.18, 0.12, 0.3, clothDark);
    boot.position.set(0, -0.46, 0.05);
    knee.add(boot);
    return { hip, knee };
  };
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // ---- gear ----
  attachGear(config.weapon, armL, armR, armorFlat, clothDark);

  const joints = {
    torso,
    torsoBaseY,
    head,
    shoulderL: armL.shoulder,
    shoulderR: armR.shoulder,
    elbowL: armL.elbow,
    elbowR: armR.elbow,
    hipL: legL.hip,
    hipR: legR.hip,
    kneeL: legL.knee,
    kneeR: legR.knee,
  };
  return { model, joints };
}

function buildHelmet(style, armor, armorFlat) {
  const helm = new THREE.Group();
  const dark = new THREE.MeshBasicMaterial({ color: 0x05030a });
  dark.userData.noSnap = true;

  if (style === 'bucket') {
    // rounded-top cylinder helm with dotted rivets + bar visor (images 1 & 5)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.34, 10), armor);
    body.position.y = 0.22;
    helm.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2), armor);
    top.position.y = 0.39;
    helm.add(top);
    // eye slit
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.045, 0.05), dark);
    slit.position.set(0, 0.28, 0.19);
    helm.add(slit);
    // vertical breath slits
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.12, 0.045), dark);
      bar.position.set(i * 0.055, 0.13, 0.195);
      helm.add(bar);
    }
  } else if (style === 'pointed') {
    // conical knight helm with spike (images 3 & 4)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.3, 8), armor);
    body.position.y = 0.2;
    helm.add(body);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.22, 8), armorFlat);
    cone.position.y = 0.46;
    helm.add(cone);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.22, 5), armorFlat);
    spike.position.y = 0.65;
    helm.add(spike);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.06), dark);
    visor.position.set(0, 0.26, 0.17);
    helm.add(visor);
    const noseBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.05), armorFlat);
    noseBar.position.set(0, 0.2, 0.185);
    helm.add(noseBar);
  } else {
    // greathelm: flat-topped box helm with angry visor + bar grille (image 1)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.4, 0.34), armor);
    body.position.y = 0.24;
    helm.add(body);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, 0.36), armorFlat);
    brow.position.y = 0.42;
    helm.add(brow);
    // angled eye slits
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.04), dark);
      eye.position.set(side * 0.08, 0.32, 0.165);
      eye.rotation.z = side * -0.25;
      helm.add(eye);
    }
    // vertical grille bars
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.14, 0.04), dark);
      bar.position.set(i * 0.06, 0.15, 0.17);
      helm.add(bar);
    }
  }
  return helm;
}

function attachGear(weapon, armL, armR, armorFlat, clothDark) {
  if (weapon === 'sword' || weapon === 'swordshield') {
    armR.hand.add(buildSword(armorFlat, clothDark));
  }
  if (weapon === 'swordshield') {
    armL.hand.add(buildShield(armorFlat));
  }
  if (weapon === 'book') {
    // the tome floats between both posed hands, parented to the left hand
    const book = buildBook();
    book.position.set(0.22, -0.02, 0.16);
    book.rotation.set(-0.5, 0, 0);
    armL.hand.add(book);
  }
}

function buildSword(armorFlat, clothDark) {
  const sword = new THREE.Group();
  const steel = new THREE.MeshLambertMaterial({ map: metalTexture({ seed: 77 }), color: 0xcfcfe0 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.05, 0.02), steel);
  blade.position.y = -0.62;
  sword.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 4), steel);
  tip.rotation.x = Math.PI;
  tip.rotation.y = Math.PI / 4;
  tip.position.y = -1.2;
  sword.add(tip);
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.06), armorFlat);
  guard.position.y = -0.1;
  sword.add(guard);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.18, 6), clothDark);
  grip.position.y = 0.02;
  sword.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), armorFlat);
  pommel.position.y = 0.13;
  sword.add(pommel);
  // rest angle: blade forward-down
  sword.rotation.x = -0.5;
  return sword;
}

function buildShield(armorFlat) {
  const shield = new THREE.Group();
  const face = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.06), armorFlat);
  shield.add(face);
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.255, 0.3, 4), armorFlat);
  point.rotation.x = Math.PI;
  point.rotation.y = Math.PI / 4;
  point.scale.z = 0.16;
  point.position.y = -0.45;
  shield.add(point);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), armorFlat);
  boss.position.z = 0.05;
  shield.add(boss);
  shield.position.set(-0.08, -0.05, 0.1);
  shield.rotation.y = 0.25;
  return shield;
}

function buildBook() {
  const book = new THREE.Group();
  const cover = new THREE.MeshLambertMaterial({ map: bookTexture() });
  const pages = new THREE.MeshLambertMaterial({ map: pageTexture() });
  for (const side of [-1, 1]) {
    const half = new THREE.Group();
    const coverMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.42), cover);
    coverMesh.position.x = side * 0.15;
    half.add(coverMesh);
    const pageMesh = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.04, 0.38), pages);
    pageMesh.position.set(side * 0.15, 0.028, 0);
    half.add(pageMesh);
    half.rotation.z = side * -0.3; // open-book V
    book.add(half);
  }
  return book;
}
