import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
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
    this.group = new THREE.Group();
    scene.add(this.group);
    this.group.position.y = 0.5;

    // Body: rounded box with PBR-ish material
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xff5b5b,
      roughness: 0.32, metalness: 0.18,
      envMapIntensity: 0.7,
    });
    this.bodyMat = bodyMat;
    const bodyGeo = new RoundedBoxGeometry(1.0, 1.0, 1.0, 5, 0.18);
    this.body = new THREE.Mesh(bodyGeo, bodyMat);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.group.add(this.body);
    this.mesh = this.group; // keep public field for camera

    // Belly accent panel
    const belly = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xffdadc, roughness: 0.6 })
    );
    belly.position.set(0, -0.08, -0.501);
    this.body.add(belly);

    // Eyes (whites + pupils)
    const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.3 });
    const eyeWL = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), eyeWhiteMat);
    const eyeWR = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), eyeWhiteMat);
    eyeWL.position.set(-0.2, 0.15, -0.43);
    eyeWR.position.set( 0.2, 0.15, -0.43);
    this.body.add(eyeWL); this.body.add(eyeWR);
    const pL = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), pupilMat);
    const pR = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), pupilMat);
    pL.position.set(0, 0.01, -0.09); pR.position.set(0, 0.01, -0.09);
    eyeWL.add(pL); eyeWR.add(pR);
    this.eyeL = eyeWL; this.eyeR = eyeWR;
    this.pupilL = pL; this.pupilR = pR;

    // Glint highlights
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const gL = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), glintMat);
    const gR = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), glintMat);
    gL.position.set(-0.04, 0.04, -0.11);
    gR.position.set(-0.04, 0.04, -0.11);
    pL.add(gL); pR.add(gR);

    // Mouth (small dark arc)
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.022, 6, 12, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x331111, roughness: 0.5 })
    );
    mouth.position.set(0, -0.08, -0.46);
    mouth.rotation.x = Math.PI;
    this.body.add(mouth);

    // Antenna
    const antMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0x553300, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.6 });
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.35, 6), antMat);
    stalk.position.set(0, 0.55, 0);
    this.body.add(stalk);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), antMat);
    ball.position.set(0, 0.78, 0);
    this.body.add(ball);
    this.antennaBall = ball;

    // Soft shadow disc beneath player (always visible)
    const shadowTex = this.buildShadowTexture();
    this.shadowDisc = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0.55, depthWrite: false })
    );
    this.shadowDisc.rotation.x = -Math.PI / 2;
    scene.add(this.shadowDisc);
    this.shadowDisc.visible = false;

    // Dash trail (line of cubes left behind, fade out)
    this.trail = [];

    // State
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
    this.powerups = { shield: 0, speed: 0, magnet: 0, doubleJump: 0 };
    this.slippery = false;
    this.velocity = new THREE.Vector3();
    this.dead = false;
    this.flashT = 0;
    this.bobT = 0;

    // Shield bubble (hidden until used)
    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0x66aaff, transparent: true, opacity: 0.35,
      roughness: 0.1, metalness: 0.2, emissive: 0x2244aa, emissiveIntensity: 0.5,
      side: THREE.DoubleSide,
    });
    this.shieldBubble = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85, 2), shieldMat);
    this.shieldBubble.visible = false;
    this.group.add(this.shieldBubble);
  }

  buildShadowTexture() {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const ctx = cv.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  get position() { return this.group.position; }

  resetTo(x, z) {
    this.group.position.set(x, 0.5, z);
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
    this.group.visible = true;
    this.group.scale.set(1, 1, 1);
    this.shadowDisc.visible = true;
    this.shadowDisc.material.opacity = 0.55;
    this.body.material.emissiveIntensity = 0;
    this.shieldBubble.visible = false;
    for (const t of this.trail) this.scene.remove(t.mesh);
    this.trail = [];
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

  addTrailPuff() {
    const geo = new RoundedBoxGeometry(0.7, 0.7, 0.7, 3, 0.18);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe080, transparent: true, opacity: 0.65,
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(this.group.position);
    m.rotation.copy(this.body.rotation);
    this.scene.add(m);
    this.trail.push({ mesh: m, life: 0.35, age: 0 });
    if (this.trail.length > 14) {
      const old = this.trail.shift();
      this.scene.remove(old.mesh);
    }
  }

  update(dt, collidesAt, arenaHalf) {
    this.bobT += dt;

    if (this.dead) {
      this.group.position.y -= 4 * dt;
      this.group.rotation.y += 4 * dt;
      this.group.scale.multiplyScalar(1 - dt * 1.2);
      this.shadowDisc.material.opacity = Math.max(0, this.shadowDisc.material.opacity - dt * 1.5);
      // Fade trail
      for (let i = this.trail.length - 1; i >= 0; i--) {
        const t = this.trail[i];
        t.age += dt;
        t.mesh.material.opacity = Math.max(0, 0.65 - t.age / t.life * 0.65);
        if (t.age >= t.life) { this.scene.remove(t.mesh); this.trail.splice(i, 1); }
      }
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

    const m = Input.moveVec();
    let mx = m.x, mz = m.z;
    const len = Math.hypot(mx, mz);
    if (len > 0) { mx /= len; mz /= len; }

    const speedMul = this.powerups.speed > 0 ? 1.55 : 1.0;
    let speed = BASE_SPEED * speedMul;

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
      this.addTrailPuff();
    } else if (Input.wasPressed('ShiftLeft') || Input.wasPressed('ShiftRight')) {
      if (this.dashCd <= 0 && (mx !== 0 || mz !== 0)) {
        this.dashT = DASH_DURATION;
        this.dashCd = DASH_COOLDOWN;
        this.dashDir.set(mx, 0, mz);
        this.invincibleT = Math.max(this.invincibleT, DASH_DURATION + 0.05);
        Audio.dash();
      }
    }

    // Horizontal motion + collision
    const nx = this.group.position.x + this.velocity.x * dt;
    const nz = this.group.position.z + this.velocity.z * dt;
    const half = arenaHalf - 0.6;
    if (!collidesAt(nx, this.group.position.z)) {
      this.group.position.x = Math.max(-half, Math.min(half, nx));
    } else { this.velocity.x = 0; }
    if (!collidesAt(this.group.position.x, nz)) {
      this.group.position.z = Math.max(-half, Math.min(half, nz));
    } else { this.velocity.z = 0; }

    // Jump
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

    this.vy += GRAVITY * dt;
    this.group.position.y += this.vy * dt;
    if (this.group.position.y <= 0.5) {
      this.group.position.y = 0.5;
      this.vy = 0;
      if (!this.onGround) {
        this.onGround = true;
        this.jumpsLeft = this.maxJumps;
      }
    }

    // Facing & subtle squash/stretch
    if (mx !== 0 || mz !== 0) this.facing = Math.atan2(mx, -mz);
    this.body.rotation.y = this.facing;

    // Body bob when grounded + lean when moving
    const moveAmt = Math.min(1, Math.hypot(this.velocity.x, this.velocity.z) / 10);
    const bob = this.onGround ? Math.sin(this.bobT * 12) * 0.05 * moveAmt : 0;
    this.body.position.y = 0 + bob;
    this.body.rotation.x = -moveAmt * 0.18 + (this.vy > 0 ? -0.1 : (!this.onGround ? 0.08 : 0));

    // Squash on landing
    if (this.onGround && !this._wasOnGroundLast && this._fellHardLast) {
      this.body.scale.set(1.18, 0.78, 1.18);
      this._fellHardLast = false;
    }
    this.body.scale.x += (1 - this.body.scale.x) * dt * 8;
    this.body.scale.y += (1 - this.body.scale.y) * dt * 8;
    this.body.scale.z += (1 - this.body.scale.z) * dt * 8;
    if (this.vy < -10) this._fellHardLast = true;
    this._wasOnGroundLast = this.onGround;

    // Antenna sway
    this.antennaBall.position.x = Math.sin(this.bobT * 4) * 0.04;
    this.antennaBall.material.emissiveIntensity = 0.4 + Math.sin(this.bobT * 6) * 0.2;

    // Pupils look toward movement direction
    const pupilOffset = 0.025;
    if (mx !== 0 || mz !== 0) {
      this.pupilL.position.x = 0; this.pupilL.position.y = 0.01;
      this.pupilR.position.x = 0; this.pupilR.position.y = 0.01;
    } else {
      // Idle drift
      this.pupilL.position.x = Math.sin(this.bobT * 0.7) * pupilOffset;
      this.pupilR.position.x = Math.sin(this.bobT * 0.7) * pupilOffset;
    }

    // Shadow disc follows footprint, fades with height
    this.shadowDisc.position.set(this.group.position.x, 0.02, this.group.position.z);
    const liftFrac = Math.max(0, Math.min(1, (this.group.position.y - 0.5) / 5));
    this.shadowDisc.material.opacity = 0.55 * (1 - liftFrac * 0.9);

    // Visual: invincibility blink and flash + shield bubble
    const blink = this.invincibleT > 0 && Math.floor(this.invincibleT * 16) % 2 === 0;
    this.body.visible = !blink;
    if (this.flashT > 0) {
      this.bodyMat.emissive = new THREE.Color(0xff3333);
      this.bodyMat.emissiveIntensity = this.flashT * 2.2;
    } else if (this.powerups.speed > 0) {
      this.bodyMat.emissive = new THREE.Color(0xffd060);
      this.bodyMat.emissiveIntensity = 0.4;
    } else {
      this.bodyMat.emissiveIntensity = 0;
    }
    this.shieldBubble.visible = this.powerups.shield > 0;
    if (this.shieldBubble.visible) {
      this.shieldBubble.rotation.y += dt * 0.8;
      this.shieldBubble.rotation.x += dt * 0.5;
      const pulse = 0.85 + Math.sin(this.bobT * 6) * 0.06;
      this.shieldBubble.scale.set(pulse, pulse, pulse);
    }

    // Trail aging
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const t = this.trail[i];
      t.age += dt;
      const a = 1 - t.age / t.life;
      t.mesh.material.opacity = Math.max(0, 0.65 * a);
      t.mesh.scale.setScalar(Math.max(0.01, a));
      if (t.age >= t.life) { this.scene.remove(t.mesh); this.trail.splice(i, 1); }
    }
  }
}
