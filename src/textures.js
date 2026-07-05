// Procedural canvas textures — everything is generated, no image assets.
// Low-res canvases stretched with bilinear filtering give the soft,
// slightly blurry GameCube/N64 texture look.
import * as THREE from 'three';

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function toTexture(canvas, repeat = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Small deterministic RNG so the world looks the same every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function speckle(ctx, size, rng, count, colors, maxR = 3) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    const r = 1 + rng() * maxR;
    ctx.fillRect(Math.floor(rng() * size), Math.floor(rng() * size), r, r);
  }
}

// Dark mossy stone (castle walls, ruins).
export function stoneTexture({ base = '#4a4658', mortar = '#2a2736', size = 128, seed = 7 } = {}) {
  const rng = mulberry32(seed);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, size, size);
  const rows = 8;
  const bh = size / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (size / 8);
    for (let c = 0; c < 4; c++) {
      const bw = size / 4;
      const x = ((c * bw + offset) % size + size) % size;
      const jitter = (rng() - 0.5) * 8;
      ctx.fillStyle = shade(base, (rng() - 0.5) * 30 + jitter);
      ctx.fillRect(x + 1, r * bh + 1, bw - 2, bh - 2);
      // wrap-around piece for offset rows
      if (x + bw > size) ctx.fillRect(x - size + 1, r * bh + 1, bw - 2, bh - 2);
    }
  }
  speckle(ctx, size, rng, 260, [shade(base, -34), shade(base, 26), '#1d3326'], 2.4);
  return toTexture(canvas);
}

// Night grass / dirt ground — soft mottled blobs, not hard speckles.
export function groundTexture({ size = 128, seed = 11 } = {}) {
  const rng = mulberry32(seed);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#17251a';
  ctx.fillRect(0, 0, size, size);
  const blobColors = ['30,51,35', '15,26,18', '36,64,42', '19,31,36', '42,29,46'];
  for (let i = 0; i < 140; i++) {
    const x = rng() * size, y = rng() * size;
    const r = 4 + rng() * 14;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = blobColors[Math.floor(rng() * blobColors.length)];
    g.addColorStop(0, `rgba(${c},${0.35 + rng() * 0.3})`);
    g.addColorStop(1, `rgba(${c},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  speckle(ctx, size, rng, 260, ['#243a28', '#101c14', '#2e2438'], 2.2);
  speckle(ctx, size, rng, 50, ['#37543a', '#3b3050'], 1.4);
  return toTexture(canvas, 24);
}

// Pink-lit stone slabs for the path (image 3 look).
export function pathTexture({ size = 128, seed = 23 } = {}) {
  const rng = mulberry32(seed);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#241a2c';
  ctx.fillRect(0, 0, size, size);
  const cells = 4;
  const cw = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const tone = 60 + rng() * 90;
      ctx.fillStyle = `rgb(${Math.floor(tone + 40)}, ${Math.floor(tone * 0.72)}, ${Math.floor(tone + 30)})`;
      ctx.fillRect(x * cw + 2, y * cw + 2, cw - 4, cw - 4);
    }
  }
  speckle(ctx, size, rng, 240, ['#3a2a44', '#6e5470', '#8a6a8a'], 2);
  return toTexture(canvas);
}

// Brushed plate metal for armor.
export function metalTexture({ size = 64, seed = 31 } = {}) {
  const rng = mulberry32(seed);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b8b8c8';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 220; i++) {
    const v = 140 + rng() * 110;
    ctx.fillStyle = `rgba(${v},${v},${v + 12},0.5)`;
    ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 10, 1);
  }
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = 'rgba(40,40,55,0.35)';
    ctx.fillRect(rng() * size, rng() * size, 2, 1 + rng() * 3);
  }
  return toTexture(canvas);
}

// Glowing enchanted marble (image 1 knight) — swirling blue/green veins.
export function enchantedTexture({ size = 128, seed = 47, hueA = '#0a3a2e', hueB = '#7dffe8' } = {}) {
  const rng = mulberry32(seed);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = hueA;
  ctx.fillRect(0, 0, size, size);
  // wandering vein strokes
  for (let v = 0; v < 42; v++) {
    let x = rng() * size, y = rng() * size;
    let angle = rng() * Math.PI * 2;
    const bright = v % 3 === 0;
    ctx.strokeStyle = bright ? hueB : shade(hueB, -70);
    ctx.lineWidth = bright ? 1.6 : 1;
    ctx.globalAlpha = 0.35 + rng() * 0.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let s = 0; s < 26; s++) {
      angle += (rng() - 0.5) * 1.4;
      x += Math.cos(angle) * 4;
      y += Math.sin(angle) * 4;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  speckle(ctx, size, rng, 120, [hueB, '#bffff2'], 1.2);
  return toTexture(canvas);
}

// Dark cloth / leather for under-armor and boots.
export function clothTexture({ base = '#191423', size = 64, seed = 59 } = {}) {
  const rng = mulberry32(seed);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    ctx.fillStyle = `rgba(255,255,255,${0.02 + rng() * 0.04})`;
    ctx.fillRect(0, y, size, 1);
  }
  speckle(ctx, size, rng, 160, [shade(base, 16), shade(base, -12)], 1.6);
  return toTexture(canvas);
}

// Ornate red book cover (image 1 tome).
export function bookTexture({ size = 64, seed = 71 } = {}) {
  const rng = mulberry32(seed);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8a1a14';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#d8b84a';
  ctx.lineWidth = 2;
  ctx.strokeRect(5, 5, size - 10, size - 10);
  ctx.strokeRect(11, 11, size - 22, size - 22);
  ctx.fillStyle = '#d8b84a';
  for (let i = 0; i < 14; i++) {
    ctx.fillRect(16 + rng() * (size - 34), 16 + rng() * (size - 34), 2 + rng() * 3, 2);
  }
  speckle(ctx, size, rng, 60, ['#6e120e', '#a8322a'], 1.6);
  return toTexture(canvas);
}

// Parchment pages with scribbled text.
export function pageTexture({ size = 64 } = {}) {
  const rng = mulberry32(83);
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#e2d5ac';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#4a3a28';
  for (let y = 8; y < size - 6; y += 5) {
    let x = 8;
    while (x < size - 8) {
      const w = 3 + rng() * 7;
      ctx.fillRect(x, y, w, 1.6);
      x += w + 2 + rng() * 3;
    }
  }
  return toTexture(canvas);
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}
