import * as THREE from 'three';
import { Input } from './input.js';
import { Audio } from './audio.js';

const GRAVITY = -28;
const BASE_JUMP = 9.0;
const BASE_SPEED = 8.0;
const DASH_SPEED = 22.0;
const DASH_DURATION = 0.18;
const DASH_COOLDOWN = 1.0;
const INVINCIBLE_AFTER_HIT = 1.0;

export class Player {
  constructor(scene) {
    this.scene = scene;

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff4d4d, roughness: 0.4, metalness: 0.2 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    this.mesh.position.y = 0.5;
    scene.add(this.mesh);

    // Eyes (visual flair)
    const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeL.position.set(-0.18, 0.1, -0.51);
    this.eyeR.position.set( 0.18, 0.1, -0.51);
    this.mesh.add(this.eyeL);
    this.mesh.add(this.eyeR);

    this.vy = 0;
    this.onGround = true;
    this.facing = 0;

    this.maxHp = 3;
    this.hp = 3;
    this.invincibleT = 0;

    this.jumpsLeft = 1;
    this.maxJumps = 1;
    this.canDoubleJump = false;

    this.dashT = 0;
    this.dashCd = 0;
    this.dashDir = new THREE.Vector3();

    this.powerups = {
      shield: 0,    // seconds remaining
      speed: 0,
      magnet: 0,
      doubleJump: 0,
    };

    this.slippery = false;
    this.velocity = new THREE.Vector3();
    this.dead = false;
    this.flashT = 0;
  }

  get position() { return this.mesh.position; }

  resetTo(x, z) {
    this.mesh.position.set(x, 0.5, z);
    this.velocity.set(0, 0, 0);
    this.vy = 0;
    this.onGround = true;
    this.hp = this.maxHp;
    this.invincibleT = 0;
    this.dashT = 0;
    this.dashCd = 0;
    this.powerups = { shield: 0, speed: 0, magnet: 0, doubleJump: 0 };
    this.maxJumps = 1;
    this.canDoubleJump = false;
    this.dead = false;
    this.mesh.visible = true;
  }

  applyPowerup(kind) {
    switch (kind) {
      case 'heart': this.hp = Math.min(this.maxHp, this.hp + 1); break;
      case 'shield': this.powerups.shield = 6; break;
      case 'speed': this.powerups.speed = 6; break;
      case 'magnet': this.powerups.magnet = 8; break;
      case 'jump': this.powerups.doubleJump = 10; this.canDoubleJump = true; this.maxJumps = 2; break;
    }
    Audio.powerup();
  }

  damage(amount = 1) {
    if (this.invincibleT > 0 || this.dead) return false;
    if (this.powerups.shield > 0) {
      this.powerups.shield = 0;
      this.invincibleT = INVINCIBLE_AFTER_HIT;
      this.flashT = 0.3;
      Audio.hurt();
      return false;
    }
    this.hp -= amount;
    this.invincibleT = INVINCIBLE_AFTER_HIT;
    this.flashT = 0.3;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      Audio.die();
    } else {
      Audio.hurt();
    }
    return true;
  }

  /**
   * @param {number} dt
   * @param {(nx:number,nz:number)=>boolean} collidesAt - obstacle collision query
   * @param {number} arenaHalf
   */
  update(dt, collidesAt, arenaHalf) {
    if (this.dead) {
      // Sink and fade
      this.mesh.position.y -= 4 * dt;
      this.mesh.rotation.y += 4 * dt;
      this.mesh.scale.multiplyScalar(1 - dt * 1.2);
      return;
    }

    // Powerup countdowns
    for (const k of Object.keys(this.powerups)) {
      if (this.powerups[k] > 0) {
        this.powerups[k] = Math.max(0, this.powerups[k] - dt);
        if (this.powerups[k] === 0 && k === 'doubleJump') {
          this.canDoubleJump = false; this.maxJumps = 1;
        }
      }
    }
    if (this.invincibleT > 0) this.invincibleT = Math.max(0, this.invincibleT - dt);
    if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
    if (this.dashCd > 0) this.dashCd = Math.max(0, this.dashCd - dt);

    // Movement input
    const m = Input.moveVec();
    let mx = m.x, mz = m.z;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }

    const speedMul = this.powerups.speed > 0 ? 1.55 : 1.0;
    let speed = BASE_SPEED * speedMul;

    // Slippery surfaces use acceleration toward input dir
    if (this.slippery) {
      const target = new THREE.Vector3(mx * speed, 0, mz * speed);
      this.velocity.x += (target.x - this.velocity.x) * Math.min(1, dt * 2.0);
      this.velocity.z += (target.z - this.velocity.z) * Math.min(1, dt * 2.0);
    } else {
      this.velocity.x = mx * speed;
      this.velocity.z = mz * speed;
    }

    // Dash
    if (this.dashT > 0) {
      this.dashT = Math.max(0, this.dashT - dt);
      this.velocity.x = this.dashDir.x * DASH_SPEED;
      this.velocity.z = this.dashDir.z * DASH_SPEED;
    } else if (Input.wasPressed('ShiftLeft') || Input.wasPressed('ShiftRight')) {
      if (this.dashCd <= 0 && (mx !== 0 || mz !== 0)) {
        this.dashT = DASH_DURATION;
        this.dashCd = DASH_COOLDOWN;
        this.dashDir.set(mx, 0, mz);
        this.invincibleT = Math.max(this.invincibleT, DASH_DURATION + 0.05);
        Audio.dash();
      }
    }

    // Apply horizontal motion with collision sliding
    const nx = this.mesh.position.x + this.velocity.x * dt;
    const nz = this.mesh.position.z + this.velocity.z * dt;
    const half = arenaHalf - 0.6;
    if (!collidesAt(nx, this.mesh.position.z)) {
      this.mesh.position.x = Math.max(-half, Math.min(half, nx));
    } else { this.velocity.x = 0; }
    if (!collidesAt(this.mesh.position.x, nz)) {
      this.mesh.position.z = Math.max(-half, Math.min(half, nz));
    } else { this.velocity.z = 0; }

    // Jump / double jump
    if (Input.wasPressed('Space')) {
      if (this.onGround) {
        this.vy = BASE_JUMP;
        this.onGround = false;
        this.jumpsLeft = this.maxJumps - 1;
        Audio.jump();
      } else if (this.jumpsLeft > 0) {
        this.vy = BASE_JUMP * 0.85;
        this.jumpsLeft--;
        Audio.jump();
      }
    }

    // Gravity
    this.vy += GRAVITY * dt;
    this.mesh.position.y += this.vy * dt;
    if (this.mesh.position.y <= 0.5) {
      this.mesh.position.y = 0.5;
      this.vy = 0;
      if (!this.onGround) {
        this.onGround = true;
        this.jumpsLeft = this.maxJumps;
      }
    }

    // Facing
    if (mx !== 0 || mz !== 0) {
      this.facing = Math.atan2(mx, -mz);
    }
    this.mesh.rotation.y = this.facing;

    // Visual: invincibility blink and shield aura
    const blink = this.invincibleT > 0 && Math.floor(this.invincibleT * 16) % 2 === 0;
    this.mesh.visible = !blink;
    if (this.flashT > 0) {
      this.mesh.material.emissive = new THREE.Color(0xff2222);
      this.mesh.material.emissiveIntensity = this.flashT * 2;
    } else if (this.powerups.shield > 0) {
      this.mesh.material.emissive = new THREE.Color(0x4488ff);
      this.mesh.material.emissiveIntensity = 0.35 + Math.sin(performance.now() * 0.01) * 0.15;
    } else if (this.powerups.speed > 0) {
      this.mesh.material.emissive = new THREE.Color(0xffff66);
      this.mesh.material.emissiveIntensity = 0.25;
    } else {
      this.mesh.material.emissiveIntensity = 0;
    }
  }
}
