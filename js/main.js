import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Game } from './game.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { Input } from './input.js';

// Renderer
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

// Scene & camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);

const camera = new THREE.PerspectiveCamera(
  60, window.innerWidth / window.innerHeight, 0.1, 400
);
camera.position.set(0, 12, 18);
camera.lookAt(0, 0, 0);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.18);
scene.add(ambient);

const hemi = new THREE.HemisphereLight(0xb6d6ff, 0x4a3a20, 0.55);
hemi.position.set(0, 50, 0);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2c8, 1.25);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
sun.shadow.bias = -0.0003;
sun.shadow.normalBias = 0.05;
sun.shadow.radius = 4;
scene.add(sun);

// Rim light (back-light for silhouette pop)
const rim = new THREE.DirectionalLight(0xc4d3ff, 0.45);
rim.position.set(-20, 25, -25);
scene.add(rim);

// Post-processing
const composer = new EffectComposer(renderer);
composer.setSize(window.innerWidth, window.innerHeight);
composer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.55,   // strength
  0.6,    // radius
  0.85,   // threshold
);
composer.addPass(bloom);
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

// Unlock audio on first user gesture
window.addEventListener('pointerdown', () => Audio.resume(), { once: true });
window.addEventListener('keydown', () => Audio.resume(), { once: true });

// Sun position tracks player a bit so shadows stay tight
function updateSun() {
  if (!game.player) return;
  sun.target.position.copy(game.player.position);
  sun.target.updateMatrixWorld();
  sun.position.set(
    game.player.position.x + 30,
    50,
    game.player.position.z + 20
  );
}

// Adjust bloom strength per theme for atmosphere
function tuneBloomForLevel() {
  const t = game.world?.theme;
  if (!t) { bloom.strength = 0.55; return; }
  bloom.strength = { grass: 0.5, desert: 0.55, snow: 0.55, lava: 1.05, space: 0.95 }[t] || 0.55;
  bloom.threshold = (t === 'lava' || t === 'space') ? 0.7 : 0.85;
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
  Input.endFrame();
  composer.render();
  requestAnimationFrame(animate);
}
animate();
