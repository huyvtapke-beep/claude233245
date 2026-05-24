import * as THREE from 'three';
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

// Scene & camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1020);

const camera = new THREE.PerspectiveCamera(
  60, window.innerWidth / window.innerHeight, 0.1, 300
);
camera.position.set(0, 12, 18);
camera.lookAt(0, 0, 0);

// Lights
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.95);
sun.position.set(30, 50, 20);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -50;
sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50;
sun.shadow.camera.bottom = -50;
sun.shadow.bias = -0.0005;
scene.add(sun);

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
const camOffset = new THREE.Vector3(0, 8, 13);
function updateCamera(dt) {
  if (game.state === 'menu' || game.state === 'victory') {
    // Slow orbit on menu
    const t = performance.now() * 0.0002;
    camera.position.set(Math.cos(t) * 18, 12, Math.sin(t) * 18);
    camera.lookAt(0, 1, 0);
    return;
  }
  if (!game.player.mesh.visible) return;
  const target = game.player.position.clone().add(camOffset);
  camera.position.lerp(target, 0.12);
  const look = game.player.position.clone();
  look.y += 0.5;
  camera.lookAt(look);
  game.shake.apply(camera, dt);
}

// Resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Unlock audio on first user gesture
window.addEventListener('pointerdown', () => Audio.resume(), { once: true });
window.addEventListener('keydown', () => Audio.resume(), { once: true });

// Main loop
const clock = new THREE.Clock();
function animate() {
  const dt = Math.min(clock.getDelta(), 0.066);
  game.update(dt);
  updateCamera(dt);
  Input.endFrame();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
