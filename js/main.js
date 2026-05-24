import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { Assets } from './assets.js';

// Renderer
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

// Scene & camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);

const camera = new THREE.PerspectiveCamera(
  60, window.innerWidth / window.innerHeight, 0.1, 500
);
camera.position.set(0, 12, 18);
camera.lookAt(0, 0, 0);

// PMREM environment: start with synthetic RoomEnvironment for immediate PBR reflections.
// Will be replaced by HDR-derived env once assets finish loading.
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const roomEnv = new RoomEnvironment(renderer);
scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.12);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0xb6d6ff, 0x4a3a20, 0.32);
hemi.position.set(0, 50, 0);
scene.add(hemi);

// Main directional sun with tighter, sharper shadows
const sun = new THREE.DirectionalLight(0xfff2c8, 1.05);
sun.position.set(28, 50, 18);
sun.castShadow = true;
const SHADOW_RES = window.devicePixelRatio > 1 ? 2048 : 4096;
sun.shadow.mapSize.set(SHADOW_RES, SHADOW_RES);
const SHADOW_HALF = 26;
sun.shadow.camera.left = -SHADOW_HALF;
sun.shadow.camera.right = SHADOW_HALF;
sun.shadow.camera.top = SHADOW_HALF;
sun.shadow.camera.bottom = -SHADOW_HALF;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.04;
sun.shadow.radius = 6;
sun.shadow.blurSamples = 24;
scene.add(sun);
scene.add(sun.target);

// Rim light for silhouette pop
const rim = new THREE.DirectionalLight(0xc4d3ff, 0.55);
rim.position.set(-20, 25, -25);
scene.add(rim);

// Subtle fill from below to soften deep shadows
const fill = new THREE.DirectionalLight(0xffd8a0, 0.15);
fill.position.set(-15, -5, 10);
scene.add(fill);

// Post-processing: bloom + vignette + output
const composer = new EffectComposer(renderer);
composer.setSize(window.innerWidth, window.innerHeight);
composer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.6, 0.65, 0.82,
);
composer.addPass(bloom);

// Custom vignette + film grain shader pass
const vignettePass = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uOffset:   { value: 1.05 },
    uDarkness: { value: 0.85 },
    uGrain:    { value: 0.025 },
    uTime:     { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uOffset;
    uniform float uDarkness;
    uniform float uGrain;
    uniform float uTime;
    varying vec2 vUv;
    float rand(vec2 co){
      return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 p = (vUv - 0.5) * vec2(uOffset);
      float v = 1.0 - dot(p, p) * uDarkness;
      v = clamp(v, 0.0, 1.0);
      v = smoothstep(0.0, 1.0, v);
      vec3 col = c.rgb * v;
      // Tiny film grain
      float n = (rand(vUv * vec2(800.0, 600.0) + uTime) - 0.5) * uGrain;
      col += n;
      gl_FragColor = vec4(col, c.a);
    }
  `,
});
composer.addPass(vignettePass);
composer.addPass(new OutputPass());

// UI + Game
let game;
const ui = new UI({
  onAction: (action) => {
    Audio.resume();
    switch (action) {
      case 'start':   game.startNewRun(); break;
      case 'how':     ui.showInfo('how'); break;
      case 'scores':  ui.showInfo('scores'); break;
      case 'credits': ui.showInfo('credits'); break;
      case 'back':    ui.showOverlay('menu'); break;
      case 'resume':  game.resume(); break;
      case 'restart': game.retryLevel(); break;
      case 'retry':   game.retryLevel(); break;
      case 'next':    game.nextLevel(); break;
      case 'quit':    game.quitToMenu(); break;
    }
  },
});

game = new Game(scene, camera, ui);
ui.showOverlay('menu');

// Load real assets in the background, swap env map when ready
Assets.load(renderer).then(() => {
  if (Assets.envMap) {
    if (scene.environment) scene.environment.dispose?.();
    scene.environment = Assets.envMap;
  }
  // Notify world so it can swap to real textures
  if (game && game.world && game.world.applyAssets) {
    game.world.applyAssets(Assets);
  }
});

// Camera follow
const camOffset = new THREE.Vector3(0, 8.5, 13);
const lookTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (game.state === 'menu' || game.state === 'victory') {
    const t = performance.now() * 0.00025;
    camera.position.set(Math.cos(t) * 22, 14, Math.sin(t) * 22);
    camera.lookAt(0, 1, 0);
    return;
  }
  if (!game.player.mesh.visible) return;
  const target = game.player.position.clone().add(camOffset);
  camera.position.lerp(target, 0.12);
  lookTarget.copy(game.player.position);
  lookTarget.y += 0.5;
  camera.lookAt(lookTarget);
  game.shake.apply(camera, dt);
}

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  bloom.setSize(window.innerWidth, window.innerHeight);
});

window.addEventListener('pointerdown', () => Audio.resume(), { once: true });
window.addEventListener('keydown', () => Audio.resume(), { once: true });

function updateSun() {
  if (!game.player || game.state !== 'playing') return;
  const p = game.player.position;
  sun.target.position.set(p.x, 0, p.z);
  sun.target.updateMatrixWorld();
  sun.position.set(p.x + 28, 50, p.z + 18);
}

function tuneBloomForLevel() {
  const t = game.world?.theme;
  // Per-theme exposure: pull bright outdoor scenes back, lift dark ones
  const exposure = { grass: 0.95, desert: 0.82, snow: 0.85, lava: 1.05, space: 1.0 }[t] ?? 1.0;
  renderer.toneMappingExposure = exposure;
  if (!t) { bloom.strength = 0.6; bloom.threshold = 0.85; return; }
  // Bright themes get weaker, higher-threshold bloom; dark themes keep punch.
  bloom.strength  = { grass: 0.38, desert: 0.28, snow: 0.4,  lava: 1.05, space: 0.95 }[t] ?? 0.5;
  bloom.threshold = { grass: 0.95, desert: 1.0,  snow: 0.95, lava: 0.68, space: 0.72 }[t] ?? 0.85;
}
let lastTheme = null;
function checkTheme() {
  if (game.world?.theme !== lastTheme) {
    lastTheme = game.world?.theme;
    tuneBloomForLevel();
  }
}

// Main loop
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.066);
  game.update(dt);
  updateCamera(dt);
  updateSun();
  checkTheme();
  vignettePass.uniforms.uTime.value = performance.now() * 0.001;
  Input.endFrame();
  composer.render();
  requestAnimationFrame(animate);
}
animate();
