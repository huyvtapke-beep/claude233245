import * as THREE from 'three';

/**
 * Procedural canvas-generated textures. Cached by key.
 * No external assets — everything is drawn at runtime.
 */
const cache = new Map();

function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function noise2D(ix, iy, seed = 1) {
  const s = Math.sin(ix * 12.9898 + iy * 78.233 + seed * 0.731) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x, y, seed = 1) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const tl = noise2D(xi, yi, seed);
  const tr = noise2D(xi + 1, yi, seed);
  const bl = noise2D(xi, yi + 1, seed);
  const br = noise2D(xi + 1, yi + 1, seed);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return (tl * (1 - u) + tr * u) * (1 - v) + (bl * (1 - u) + br * u) * v;
}

function fbm(x, y, octaves = 5, seed = 1) {
  let value = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += valueNoise(x * freq, y * freq, seed + i * 17) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return value;
}

/** Build a CanvasTexture for the given ground theme. */
function buildGroundTexture(theme, size = 512) {
  const cv = makeCanvas(size);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;

  const scale = 6 / size;
  const palettes = {
    grass: [
      [56, 120, 60], [82, 145, 70], [40, 95, 50], [70, 130, 60],
    ],
    desert: [
      [220, 175, 100], [200, 155, 80], [240, 200, 130], [180, 140, 70],
    ],
    snow: [
      [240, 244, 250], [220, 230, 240], [255, 255, 255], [200, 215, 230],
    ],
    lava: [
      [50, 20, 18], [80, 30, 20], [25, 12, 12], [120, 40, 25],
    ],
    space: [
      [22, 22, 50], [40, 30, 80], [10, 8, 30], [60, 50, 110],
    ],
  };
  const pal = palettes[theme] || palettes.grass;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x * scale, y * scale, 5, 11);
      const idx = Math.min(pal.length - 1, Math.floor(n * pal.length));
      const c = pal[idx];
      // small per-pixel variation
      const jitter = (Math.random() - 0.5) * 12;
      const o = (y * size + x) * 4;
      d[o]     = Math.max(0, Math.min(255, c[0] + jitter));
      d[o + 1] = Math.max(0, Math.min(255, c[1] + jitter));
      d[o + 2] = Math.max(0, Math.min(255, c[2] + jitter));
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Theme-specific overlay accents
  if (theme === 'grass') {
    // Grass tufts
    ctx.fillStyle = 'rgba(60, 150, 70, 0.8)';
    for (let i = 0; i < 400; i++) {
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.5, 4);
    }
  } else if (theme === 'snow') {
    // Sparkles
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 200; i++) {
      ctx.fillRect(Math.random() * size, Math.random() * size, 2, 2);
    }
  } else if (theme === 'desert') {
    // Ripples
    ctx.strokeStyle = 'rgba(170,130,70,0.25)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 30; i++) {
      ctx.beginPath();
      const cy = Math.random() * size;
      ctx.moveTo(0, cy);
      for (let x = 0; x <= size; x += 8) {
        ctx.lineTo(x, cy + Math.sin(x * 0.05 + i) * 6);
      }
      ctx.stroke();
    }
  } else if (theme === 'lava') {
    // Cracks of glow
    ctx.strokeStyle = 'rgba(255,120,40,0.85)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) {
      ctx.beginPath();
      let x = Math.random() * size, y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 30; s++) {
        x += (Math.random() - 0.5) * 16;
        y += (Math.random() - 0.5) * 16;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  } else if (theme === 'space') {
    // Glowing dust
    ctx.fillStyle = 'rgba(180, 160, 255, 0.5)';
    for (let i = 0; i < 80; i++) {
      const r = 0.5 + Math.random() * 1.5;
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Build a normal map by computing heightfield gradient from fbm. */
function buildGroundNormal(theme, size = 256) {
  const cv = makeCanvas(size);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const scale = 8 / size;
  const seed = { grass: 11, desert: 22, snow: 33, lava: 44, space: 55 }[theme] || 11;
  const strength = (theme === 'snow' || theme === 'desert') ? 1.2 : 1.6;

  function h(x, y) { return fbm(x * scale, y * scale, 4, seed); }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
      const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
      // normal vector
      const nx = -dx, ny = -dy, nz = 1.0;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      const o = (y * size + x) * 4;
      d[o]     = Math.floor((nx / len * 0.5 + 0.5) * 255);
      d[o + 1] = Math.floor((ny / len * 0.5 + 0.5) * 255);
      d[o + 2] = Math.floor((nz / len * 0.5 + 0.5) * 255);
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Stylized wood/stone wall texture by theme. */
function buildWallTexture(theme, size = 256) {
  const cv = makeCanvas(size);
  const ctx = cv.getContext('2d');

  const bases = {
    grass: '#7a5a30', desert: '#a07a4a', snow: '#7585a0',
    lava: '#553030', space: '#3a2a5a',
  };
  ctx.fillStyle = bases[theme] || '#666';
  ctx.fillRect(0, 0, size, size);

  // Add noise
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const j = (Math.random() - 0.5) * 30;
    d[i] = Math.max(0, Math.min(255, d[i] + j));
    d[i+1] = Math.max(0, Math.min(255, d[i+1] + j));
    d[i+2] = Math.max(0, Math.min(255, d[i+2] + j));
  }
  ctx.putImageData(img, 0, 0);

  // Brick lines
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  const brickH = 28;
  const brickW = 64;
  for (let y = 0, row = 0; y < size; y += brickH, row++) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    const off = (row % 2) ? brickW / 2 : 0;
    for (let x = off; x < size; x += brickW) {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + brickH); ctx.stroke();
    }
  }
  // Highlights
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  for (let y = 1, row = 0; y < size; y += brickH, row++) {
    const off = (row % 2) ? brickW / 2 : 0;
    for (let x = off; x < size; x += brickW) {
      ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + brickW - 2, y + 1); ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export const Textures = {
  ground(theme) {
    const k = `ground_${theme}`;
    if (!cache.has(k)) cache.set(k, buildGroundTexture(theme));
    return cache.get(k);
  },
  groundNormal(theme) {
    const k = `groundN_${theme}`;
    if (!cache.has(k)) cache.set(k, buildGroundNormal(theme));
    return cache.get(k);
  },
  wall(theme) {
    const k = `wall_${theme}`;
    if (!cache.has(k)) cache.set(k, buildWallTexture(theme));
    return cache.get(k);
  },
};
