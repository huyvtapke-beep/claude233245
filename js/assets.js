import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/**
 * Load real assets from the three.js examples CDN with graceful fallback.
 * The game stays fully playable even if every request fails.
 */
const CDN = 'https://unpkg.com/three@0.160.0/examples/textures';

const URLS = {
  hdr: `${CDN}/equirectangular/quarry_01_1k.hdr`,
  grass: `${CDN}/terrain/grasslight-big.jpg`,
  grassN: `${CDN}/terrain/grasslight-big-nm.jpg`,
  brick: `${CDN}/brick_diffuse.jpg`,
  brickN: `${CDN}/brick_bump.jpg`,
  brickR: `${CDN}/brick_roughness.jpg`,
  water: `${CDN}/waternormals.jpg`,
};

function loadTex(url, srgb) {
  return new Promise((resolve) => {
    new THREE.TextureLoader().load(
      url,
      (t) => {
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.anisotropy = 8;
        resolve(t);
      },
      undefined,
      () => resolve(null),
    );
  });
}

function loadHdr(url) {
  return new Promise((resolve) => {
    new RGBELoader().load(
      url,
      (t) => {
        t.mapping = THREE.EquirectangularReflectionMapping;
        resolve(t);
      },
      undefined,
      () => resolve(null),
    );
  });
}

export const Assets = {
  envMap: null,        // PMREM-prefiltered cubemap for PBR reflections
  envEquirect: null,   // Raw HDR for backgrounds if desired
  grass: null,
  grassNormal: null,
  brick: null,
  brickBump: null,
  brickRoughness: null,
  waterNormals: null,
  ready: false,
  _listeners: [],

  onReady(cb) {
    if (this.ready) cb();
    else this._listeners.push(cb);
  },

  async load(renderer) {
    const [hdr, grass, grassN, brick, brickB, brickR, water] = await Promise.all([
      loadHdr(URLS.hdr),
      loadTex(URLS.grass, true),
      loadTex(URLS.grassN, false),
      loadTex(URLS.brick, true),
      loadTex(URLS.brickN, false),
      loadTex(URLS.brickR, false),
      loadTex(URLS.water, false),
    ]);

    if (hdr) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      pmrem.compileEquirectangularShader();
      try {
        this.envMap = pmrem.fromEquirectangular(hdr).texture;
      } catch (e) {
        this.envMap = null;
      }
      this.envEquirect = hdr;
      pmrem.dispose();
    }
    this.grass = grass;
    this.grassNormal = grassN;
    this.brick = brick;
    this.brickBump = brickB;
    this.brickRoughness = brickR;
    this.waterNormals = water;

    this.ready = true;
    for (const cb of this._listeners) {
      try { cb(); } catch (e) { /* ignore */ }
    }
    this._listeners = [];
  },
};
