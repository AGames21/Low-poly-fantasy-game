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

  // smooth-shaded building blocks — curved silhouettes, GameCube-style
  const capsule = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
  const ball = (r, mat, sx = 1, sy = 1, sz = 1) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), mat);
    m.scale.set(sx, sy, sz);
    return m;
  };
  const cyl = (rt, rb, h, mat, seg = 12) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);

  // ---- torso: lathed breastplate, oval cross-section ----
  const torso = new THREE.Group();
  const torsoBaseY = 1.02;
  torso.position.y = torsoBaseY;
  model.add(torso);

  const profile = [
    new THREE.Vector2(0.21, -0.12),  // waist
    new THREE.Vector2(0.29, 0.10),
    new THREE.Vector2(0.33, 0.34),   // chest
    new THREE.Vector2(0.29, 0.56),
    new THREE.Vector2(0.14, 0.70),   // collar
  ];
  const chest = new THREE.Mesh(new THREE.LatheGeometry(profile, 14), armor);
  chest.scale.z = 0.78;
  torso.add(chest);

  // belt: a flattened torus at the waist
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.045, 6, 14), clothDark);
  belt.rotation.x = Math.PI / 2;
  belt.scale.z = 0.85;
  belt.position.y = -0.10;
  torso.add(belt);

  // tabard skirt: smooth flared cone
  const skirt = new THREE.Mesh(
    new THREE.LatheGeometry([
      new THREE.Vector2(0.23, 0),
      new THREE.Vector2(0.34, -0.28),
      new THREE.Vector2(0.43, -0.55),
    ], 14),
    cloth
  );
  skirt.scale.z = 0.88;
  skirt.position.y = -0.10;
  torso.add(skirt);

  // pauldrons: big smooth domes over the shoulders
  for (const side of [-1, 1]) {
    const pauldron = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2),
      armor
    );
    pauldron.position.set(side * 0.42, 0.60, 0);
    pauldron.scale.set(1.2, 1.05, 1.05);
    pauldron.rotation.z = side * -0.22;
    torso.add(pauldron);
  }

  // ---- head ----
  const head = new THREE.Group();
  head.position.y = 0.78;
  torso.add(head);
  const neck = cyl(0.10, 0.12, 0.14, clothDark, 10);
  neck.position.y = 0.02;
  head.add(neck);
  head.add(buildHelmet(config.helmet, armor, armorFlat));

  // ---- arms: capsules with sphere gauntlets ----
  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.42, 0.58, 0);
    torso.add(shoulder);
    const upper = capsule(0.095, 0.24, cloth);
    upper.position.y = -0.2;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.42;
    shoulder.add(elbow);
    const forearm = capsule(0.09, 0.2, armor);
    forearm.position.y = -0.16;
    elbow.add(forearm);
    const hand = new THREE.Group();
    hand.position.y = -0.38;
    elbow.add(hand);
    hand.add(ball(0.105, armor, 1, 1.1, 1));
    return { shoulder, elbow, hand };
  };
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // ---- legs: capsule thighs/shins, rounded sabatons ----
  const makeLeg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.17, 1.0, 0);
    model.add(hip);
    const thigh = capsule(0.115, 0.26, cloth);
    thigh.position.y = -0.22;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.48;
    hip.add(knee);
    const shin = capsule(0.095, 0.24, armor);
    shin.position.y = -0.19;
    knee.add(shin);
    const boot = ball(0.115, clothDark, 1, 0.75, 1.7);
    boot.position.set(0, -0.45, 0.06);
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
    // rounded-top cylinder helm with bar visor (images 1 & 5)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.34, 14), armor);
    body.position.y = 0.22;
    helm.add(body);
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), armor);
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
    // smooth conical knight helm with spike (images 3 & 4)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.3, 12), armor);
    body.position.y = 0.2;
    helm.add(body);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.24, 12), armor);
    cone.position.y = 0.47;
    helm.add(cone);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.2, 8), armor);
    spike.position.y = 0.66;
    helm.add(spike);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.07, 0.06), dark);
    visor.position.set(0, 0.26, 0.17);
    helm.add(visor);
    const noseBar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.16, 8), armor);
    noseBar.position.set(0, 0.2, 0.185);
    helm.add(noseBar);
  } else {
    // greathelm: cylindrical helm, gently domed crown, visor + grille (image 1)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.195, 0.205, 0.4, 14), armor);
    body.position.y = 0.24;
    helm.add(body);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.195, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), armor);
    crown.position.y = 0.44;
    crown.scale.y = 0.4;
    helm.add(crown);
    // angled eye slits
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 0.04), dark);
      eye.position.set(side * 0.08, 0.32, 0.175);
      eye.rotation.z = side * -0.25;
      helm.add(eye);
    }
    // vertical grille bars
    for (let i = -2; i <= 2; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.14, 0.04), dark);
      bar.position.set(i * 0.06, 0.15, 0.18);
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
  // curved plate: an open cylinder arc, like a real heater shield face
  const plateGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.66, 10, 1, true, -0.55, 1.1);
  const plateMat = armorFlat.clone();
  plateMat.side = THREE.DoubleSide;
  const face = new THREE.Mesh(plateGeo, plateMat);
  face.rotation.y = Math.PI; // concave side toward the arm
  shield.add(face);
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.28, 10), armorFlat);
  point.rotation.x = Math.PI;
  point.scale.z = 0.35;
  point.position.set(0, -0.45, -0.36);
  shield.add(point);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 6), armorFlat);
  boss.position.z = -0.44;
  shield.add(boss);
  shield.position.set(-0.08, -0.05, 0.14);
  shield.rotation.y = Math.PI + 0.25;
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
