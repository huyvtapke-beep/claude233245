import * as THREE from 'three';
import { LEVELS } from './levels.js';
import { Player } from './player.js';
import { World } from './world.js';
import { Coin, PowerUp, Patroller, Chaser, Spike, Boss } from './entities.js';
import { ParticleSystem, CameraShake } from './effects.js';
import { Audio } from './audio.js';
import { Storage } from './storage.js';
import { Input } from './input.js';

const POWERUP_KINDS = ['heart', 'shield', 'speed', 'magnet', 'jump'];

function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export class Game {
  constructor(scene, camera, ui) {
    this.scene = scene;
    this.camera = camera;
    this.ui = ui;

    this.state = 'menu'; // menu | playing | paused | gameover | levelcomplete | victory
    this.levelIndex = 0;
    this.score = 0;
    this.runTotalScore = 0;
    this.runTotalTime = 0;
    this.runTotalStars = 0;
    this.elapsed = 0;

    this.world = new World(scene);
    this.player = new Player(scene);
    this.player.mesh.visible = false;
    this.particles = new ParticleSystem(scene);
    this.shake = new CameraShake();

    this.coins = [];
    this.powerups = [];
    this.enemies = [];

    this.coinsTotal = 0;
    this.coinsCollected = 0;
  }

  startNewRun() {
    this.runTotalScore = 0;
    this.runTotalTime = 0;
    this.runTotalStars = 0;
    this.startLevel(0);
  }

  startLevel(index) {
    this.levelIndex = index;
    const def = LEVELS[index];
    const rng = mulberry32(index * 9173 + 12345);

    this.world.build(def, rng);
    this.player.slippery = !!def.slippery;
    this.player.resetTo(0, 0);
    this.player.mesh.visible = true;

    // Clear and spawn entities
    for (const c of this.coins) c.remove();
    for (const p of this.powerups) p.remove();
    for (const e of this.enemies) e.remove();
    this.coins = []; this.powerups = []; this.enemies = [];

    for (let i = 0; i < def.coins; i++) {
      const p = this.world.randomWalkable(rng, 2, 3);
      this.coins.push(new Coin(this.scene, p.x, p.z));
    }
    for (let i = 0; i < def.powerups; i++) {
      const p = this.world.randomWalkable(rng, 2, 4);
      const kind = POWERUP_KINDS[Math.floor(rng() * POWERUP_KINDS.length)];
      this.powerups.push(new PowerUp(this.scene, p.x, p.z, kind));
    }
    for (const spec of def.enemies) {
      for (let i = 0; i < spec.count; i++) {
        const p = this.world.randomWalkable(rng, 3, 6);
        if (spec.type === 'patroller') this.enemies.push(new Patroller(this.scene, p.x, p.z));
        else if (spec.type === 'chaser') this.enemies.push(new Chaser(this.scene, p.x, p.z));
        else if (spec.type === 'spike') this.enemies.push(new Spike(this.scene, p.x, p.z));
        else if (spec.type === 'boss') this.enemies.push(new Boss(this.scene, p.x, p.z));
      }
    }

    this.coinsTotal = this.coins.length;
    this.coinsCollected = 0;
    this.score = 0;
    this.elapsed = 0;

    this.world.setPortalActive(false);
    this.ui.setObjective(def.objective);
    this.ui.showHUD(true);
    this.ui.showOverlay(null);
    this.state = 'playing';

    Audio.startMusic(def.music.mood, def.music.tempo);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showOverlay('pause');
    Audio.stopMusic();
  }
  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.ui.showOverlay(null);
    const def = LEVELS[this.levelIndex];
    Audio.startMusic(def.music.mood, def.music.tempo);
  }
  quitToMenu() {
    this.state = 'menu';
    Audio.stopMusic();
    this.player.mesh.visible = false;
    this.player.shadowDisc.visible = false;
    this.ui.showHUD(false);
    this.ui.refreshMenu();
    this.ui.showOverlay('menu');
  }

  retryLevel() { this.startLevel(this.levelIndex); }

  nextLevel() {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.state = 'victory';
      this.ui.showVictory({
        totalScore: this.runTotalScore,
        totalTime: this.runTotalTime,
        totalStars: this.runTotalStars,
      });
      Audio.stopMusic();
      Audio.win();
      return;
    }
    this.startLevel(this.levelIndex + 1);
  }

  computeStars(time, def, hp) {
    let s = 1;
    if (time <= def.parTime) s = 2;
    if (time <= def.parTime * 0.7 && hp === this.player.maxHp) s = 3;
    return s;
  }

  finishLevel() {
    const def = LEVELS[this.levelIndex];
    const timeBonus = Math.max(0, Math.round((def.parTime - this.elapsed) * 5));
    const hpBonus = this.player.hp * 50;
    const levelBonus = (this.levelIndex + 1) * 100;
    const finalScore = this.score + timeBonus + hpBonus + levelBonus;
    const stars = this.computeStars(this.elapsed, def, this.player.hp);

    this.runTotalScore += finalScore;
    this.runTotalTime += this.elapsed;
    this.runTotalStars += stars;

    Storage.recordRun({
      levelIndex: this.levelIndex,
      score: finalScore,
      time: this.elapsed,
      deaths: 0,
      stars,
    });
    Storage.recordLevelComplete(this.levelIndex);

    this.state = 'levelcomplete';
    Audio.stopMusic();
    Audio.win();
    this.ui.showLevelComplete({
      levelIndex: this.levelIndex,
      score: finalScore,
      time: this.elapsed,
      par: def.parTime,
      stars,
    });
  }

  handleGameOver() {
    this.state = 'gameover';
    Audio.stopMusic();
    this.shake.trigger(0.8, 0.5);
    Storage.recordRun({
      levelIndex: this.levelIndex,
      score: this.score,
      time: this.elapsed,
      deaths: 1,
      stars: 0,
    });
    this.ui.showGameOver({
      score: this.score,
      levelIndex: this.levelIndex,
      time: this.elapsed,
    });
  }

  update(dt) {
    if (this.state !== 'playing') {
      this.particles.update(dt);
      return;
    }

    if (Input.wasPressed('KeyP') || Input.wasPressed('Escape')) {
      this.pause();
      return;
    }
    if (Input.wasPressed('KeyM')) {
      const m = Audio.toggleMute();
      this.ui.toast(m ? 'Muted' : 'Sound on', 900);
    }

    this.elapsed += dt;

    this.player.update(dt, (x, z) => this.world.collidesAt(x, z, 0.5), this.world.size);

    // Hazard tile (lava)
    if (this.world.hazardAt(this.player.position.x, this.player.position.z) && this.player.position.y < 0.6) {
      if (this.player.damage(1)) {
        this.shake.trigger(0.35, 0.25);
        this.particles.burst(this.player.position.x, 0.3, this.player.position.z, 0xff4422, 22, 7);
      }
    }

    // Coin pickup
    for (const c of this.coins) {
      if (c.collected) continue;
      c.update(dt, this.elapsed, this.player);
      const dx = c.mesh.position.x - this.player.position.x;
      const dy = c.mesh.position.y - this.player.position.y;
      const dz = c.mesh.position.z - this.player.position.z;
      if (dx * dx + dy * dy + dz * dz < 0.95 * 0.95) {
        c.remove();
        this.coinsCollected++;
        this.score += 10;
        Audio.coin();
        this.particles.burst(c.mesh.position.x, c.mesh.position.y, c.mesh.position.z, 0xffd700, 10, 3);
        if (this.coinsCollected === this.coinsTotal) {
          this.world.setPortalActive(true);
          this.ui.setObjective('Portal open! Reach it to advance.');
          this.ui.toast('Portal opened!', 1400);
          Audio.portal();
        }
      }
    }

    // Powerup pickup
    for (const p of this.powerups) {
      if (p.collected) continue;
      p.update(dt, this.elapsed);
      const dx = p.mesh.position.x - this.player.position.x;
      const dy = p.mesh.position.y - this.player.position.y;
      const dz = p.mesh.position.z - this.player.position.z;
      if (dx * dx + dy * dy + dz * dz < 1.0) {
        p.remove();
        this.player.applyPowerup(p.kind);
        this.score += 25;
        const col = ({ heart: 0xff5577, shield: 0x55aaff, speed: 0xffee44, magnet: 0xaa66ff, jump: 0x66ff99 })[p.kind];
        this.particles.burst(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z, col, 18, 4);
        this.ui.toast({
          heart: '+1 HP', shield: 'Shield!', speed: 'Speed Boost', magnet: 'Magnet active', jump: 'Double Jump!',
        }[p.kind], 1100);
      }
    }

    // Enemies
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.update(dt, this.elapsed, this.world, this.player);
      if (e.hits(this.player)) {
        const isBoss = e instanceof Boss;
        const playerFalling = this.player.vy < -2 && this.player.position.y > e.mesh.position.y + 0.3;
        if (isBoss && playerFalling) {
          this.player.vy = 12;
          const dead = e.takeStomp();
          this.particles.burst(e.mesh.position.x, 2, e.mesh.position.z, 0xaa55ff, 30, 6);
          this.shake.trigger(0.4, 0.25);
          if (dead) {
            e.remove();
            this.ui.toast('Boss defeated!', 1800);
            this.score += 500;
          }
        } else if (e instanceof Spike) {
          if (this.player.damage(1)) {
            this.shake.trigger(0.3, 0.2);
            this.particles.burst(this.player.position.x, 0.5, this.player.position.z, 0xff4444, 16, 5);
          }
        } else if (!isBoss && playerFalling) {
          // Stomp enemy
          e.remove();
          this.player.vy = 10;
          this.score += 50;
          Audio.hurt();
          this.particles.burst(e.mesh.position.x, e.mesh.position.y, e.mesh.position.z, 0xff66aa, 20, 5);
        } else {
          if (this.player.damage(1)) {
            this.shake.trigger(0.4, 0.25);
            // Knockback
            const dx = this.player.position.x - e.mesh.position.x;
            const dz = this.player.position.z - e.mesh.position.z;
            const d = Math.hypot(dx, dz) || 1;
            this.player.velocity.x = (dx / d) * 8;
            this.player.velocity.z = (dz / d) * 8;
            this.player.vy = 4;
            this.particles.burst(this.player.position.x, 0.6, this.player.position.z, 0xff5555, 14, 4);
          }
        }
      }
    }

    // Cleanup dead
    this.enemies = this.enemies.filter((e) => e.alive);
    this.coins = this.coins.filter((c) => !c.collected);
    this.powerups = this.powerups.filter((p) => !p.collected);

    this.world.update(dt, this.elapsed);
    this.particles.update(dt);

    // Death check
    if (this.player.dead && this.player.mesh.scale.x < 0.2) {
      this.handleGameOver();
      return;
    }

    // Portal check
    if (this.world.portalContains(this.player.position.x, this.player.position.z)) {
      this.particles.burst(this.world.portal.group.position.x, 2, this.world.portal.group.position.z, 0xaaffee, 40, 8);
      this.finishLevel();
      return;
    }

    // HUD
    this.ui.updateHud({
      level: this.levelIndex + 1,
      score: this.score,
      coinsCollected: this.coinsCollected,
      coinsTotal: this.coinsTotal,
      time: this.elapsed,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      powerups: this.player.powerups,
    });
  }
}
