import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ---------- Coin ---------- */
export class Coin {
  constructor(scene, x, z) {
    const group = new THREE.Group();
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd24a, metalness: 0.85, roughness: 0.18,
      emissive: 0xffa500, emissiveIntensity: 0.55,
    });
    // Thicker disk + thin rim
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 28), coinMat);
    disc.castShadow = true;
    group.add(disc);
    // Star detail on top
    const starMat = new THREE.MeshStandardMaterial({ color: 0xfff0a0, emissive: 0xffaa22, emissiveIntensity: 0.8, metalness: 0.7, roughness: 0.25 });
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), starMat);
    star.rotation.x = Math.PI / 2;
    star.scale.set(1, 0.18, 1);
    star.position.y = 0.08;
    group.add(star);
    const starB = star.clone();
    starB.position.y = -0.08;
    starB.rotation.x = -Math.PI / 2;
    group.add(starB);

    group.position.set(x, 0.8, z);
    group.rotation.x = Math.PI / 2;
    this.mesh = group;
    scene.add(group);
    this.collected = false;
    this.baseY = 0.8;
    this.scene = scene;
    this.phase = Math.random() * Math.PI * 2;
  }
  update(dt, t, player) {
    if (this.collected) return;
    this.mesh.rotation.z += dt * 3.5;
    this.mesh.position.y = this.baseY + Math.sin(t * 3 + this.phase) * 0.12;
    if (player.powerups.magnet > 0) {
      const dx = player.position.x - this.mesh.position.x;
      const dz = player.position.z - this.mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 7 && d > 0.01) {
        this.mesh.position.x += (dx / d) * dt * 9;
        this.mesh.position.z += (dz / d) * dt * 9;
      }
    }
  }
  remove() {
    if (this.collected) return;
    this.collected = true;
    this.scene.remove(this.mesh);
  }
}

/* ---------- PowerUp ---------- */
const POWERUP_COLORS = {
  heart: 0xff5577,
  shield: 0x55aaff,
  speed: 0xffee44,
  magnet: 0xaa66ff,
  jump:  0x66ff99,
};

export class PowerUp {
  constructor(scene, x, z, kind) {
    this.kind = kind;
    this.scene = scene;
    this.collected = false;
    const color = POWERUP_COLORS[kind] || 0xffffff;
    const group = new THREE.Group();

    // Inner emissive crystal
    let geo;
    if (kind === 'heart') geo = new THREE.IcosahedronGeometry(0.45, 0);
    else if (kind === 'shield') geo = new THREE.OctahedronGeometry(0.5);
    else if (kind === 'speed') geo = new THREE.ConeGeometry(0.4, 0.6, 6);
    else if (kind === 'magnet') geo = new THREE.TorusKnotGeometry(0.28, 0.1, 60, 8);
    else geo = new THREE.ConeGeometry(0.4, 0.7, 6);
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 1.2,
      roughness: 0.2, metalness: 0.35,
    });
    const inner = new THREE.Mesh(geo, mat);
    inner.castShadow = true;
    group.add(inner);

    // Outer glow shell (slightly bigger, low opacity)
    const shellMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.18, depthWrite: false,
    });
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), shellMat);
    group.add(shell);

    group.position.set(x, 1.0, z);
    this.mesh = group;
    this.inner = inner;
    scene.add(group);
    this.baseY = 1.0;
    this.phase = Math.random() * Math.PI * 2;
  }
  update(dt, t) {
    if (this.collected) return;
    this.inner.rotation.y += dt * 2.5;
    this.inner.rotation.x += dt * 1.2;
    this.mesh.position.y = this.baseY + Math.sin(t * 2.5 + this.phase) * 0.2;
    const pulse = 1.0 + Math.sin(t * 4 + this.phase) * 0.2;
    this.inner.material.emissiveIntensity = pulse * 1.2;
  }
  remove() {
    if (this.collected) return;
    this.collected = true;
    this.scene.remove(this.mesh);
  }
}

/* ---------- Enemy base ---------- */
class EnemyBase {
  constructor(scene) {
    this.scene = scene;
    this.alive = true;
  }
  position() { return this.mesh.position; }
  hits(player, radius = 0.95) {
    const dx = this.mesh.position.x - player.position.x;
    const dz = this.mesh.position.z - player.position.z;
    return dx * dx + dz * dz < radius * radius && player.position.y < 1.5;
  }
  remove() {
    this.alive = false;
    this.scene.remove(this.mesh);
  }
}

/* ---------- Patroller ---------- */
export class Patroller extends EnemyBase {
  constructor(scene, x, z) {
    super(scene);
    const group = new THREE.Group();
    // Spiky body (rounded box with horns)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x9a3fd9, roughness: 0.4, metalness: 0.25,
      emissive: 0x33156a, emissiveIntensity: 0.55,
    });
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.9, 0.9, 4, 0.18), bodyMat);
    body.castShadow = true;
    body.position.y = 0.45;
    group.add(body);
    this.body = body;

    // Spikes on top
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xddbbff, emissive: 0x6633aa, emissiveIntensity: 0.6, roughness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 6), spikeMat);
      sp.position.set((i - 1) * 0.25, 1.0, 0);
      group.add(sp);
    }

    // Glowing eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffaaff, emissive: 0xff44ff, emissiveIntensity: 1.4 });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
    const eR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
    eL.position.set(-0.15, 0.55, -0.41);
    eR.position.set( 0.15, 0.55, -0.41);
    group.add(eL); group.add(eR);

    group.position.set(x, 0, z);
    this.mesh = group;
    scene.add(group);
    const a = Math.random() * Math.PI * 2;
    this.dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    this.speed = 3.0;
  }
  update(dt, t, world) {
    if (!this.alive) return;
    const nx = this.mesh.position.x + this.dir.x * this.speed * dt;
    const nz = this.mesh.position.z + this.dir.z * this.speed * dt;
    const bound = world.size - 1.5;
    let bounce = false;
    if (world.collidesAt(nx, nz, 0.55) || Math.abs(nx) > bound || Math.abs(nz) > bound) bounce = true;
    if (bounce) {
      const a = Math.random() * Math.PI * 2;
      this.dir.set(Math.cos(a), 0, Math.sin(a));
    } else {
      this.mesh.position.x = nx;
      this.mesh.position.z = nz;
    }
    this.body.rotation.y += dt * 2;
    this.body.position.y = 0.45 + Math.abs(Math.sin(t * 4)) * 0.12;
    // Face direction
    if (this.dir.x !== 0 || this.dir.z !== 0) {
      this.mesh.rotation.y = Math.atan2(this.dir.x, -this.dir.z);
    }
  }
}

/* ---------- Chaser ---------- */
export class Chaser extends EnemyBase {
  constructor(scene, x, z) {
    super(scene);
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xff4055, roughness: 0.3, metalness: 0.4,
      emissive: 0xff1122, emissiveIntensity: 1.0,
    });
    const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), bodyMat);
    body.castShadow = true;
    body.position.y = 0.55;
    group.add(body);
    this.body = body;

    // Glow halo
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0.15, depthWrite: false })
    );
    halo.position.y = 0.55;
    group.add(halo);

    // Eye (single cyclops)
    const eyeWhite = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 })
    );
    eyeWhite.position.set(0, 0.6, -0.42);
    group.add(eyeWhite);
    const pupil = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    pupil.position.set(0, 0, -0.1);
    eyeWhite.add(pupil);
    this.pupil = pupil;

    group.position.set(x, 0, z);
    this.mesh = group;
    scene.add(group);
    this.speed = 3.8;
    this.range = 12;
  }
  update(dt, t, world, player) {
    if (!this.alive) return;
    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    const d = Math.hypot(dx, dz);
    let mx = 0, mz = 0;
    if (d < this.range && d > 0.1) {
      mx = (dx / d) * this.speed * dt;
      mz = (dz / d) * this.speed * dt;
    } else {
      mx = Math.cos(t * 0.5 + this.mesh.position.x) * this.speed * 0.4 * dt;
      mz = Math.sin(t * 0.5 + this.mesh.position.z) * this.speed * 0.4 * dt;
    }
    const nx = this.mesh.position.x + mx;
    const nz = this.mesh.position.z + mz;
    if (!world.collidesAt(nx, this.mesh.position.z, 0.6)) this.mesh.position.x = nx;
    if (!world.collidesAt(this.mesh.position.x, nz, 0.6)) this.mesh.position.z = nz;
    const bound = world.size - 1.5;
    this.mesh.position.x = Math.max(-bound, Math.min(bound, this.mesh.position.x));
    this.mesh.position.z = Math.max(-bound, Math.min(bound, this.mesh.position.z));
    this.body.rotation.y += dt * 3;
    this.body.rotation.x += dt * 2;
    // Face player
    if (Math.abs(dx) + Math.abs(dz) > 0.01) {
      this.mesh.rotation.y = Math.atan2(dx, -dz);
    }
  }
}

/* ---------- Spike ---------- */
export class Spike extends EnemyBase {
  constructor(scene, x, z) {
    super(scene);
    const group = new THREE.Group();
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6, metalness: 0.3 });
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.25, metalness: 0.85 });
    // Base disc
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.15, 16), baseMat);
    base.position.y = 0.075; base.castShadow = true; base.receiveShadow = true;
    group.add(base);
    // 5 spikes
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.7, 8), spikeMat);
      s.position.set(Math.cos(a) * 0.22, 0.5, Math.sin(a) * 0.22);
      s.castShadow = true;
      group.add(s);
    }
    const center = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.95, 8), spikeMat);
    center.position.y = 0.6; center.castShadow = true;
    group.add(center);
    // Red warning glow on bottom
    const warn = new THREE.Mesh(
      new THREE.CircleGeometry(0.55, 16),
      new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.45 })
    );
    warn.rotation.x = -Math.PI / 2;
    warn.position.y = 0.011;
    group.add(warn);
    this.warn = warn;

    group.position.set(x, 0, z);
    this.mesh = group;
    scene.add(group);
    this.stationary = true;
  }
  update(dt, t) {
    if (this.warn) this.warn.material.opacity = 0.35 + Math.sin(t * 5) * 0.2;
  }
  hits(player) {
    const dx = this.mesh.position.x - player.position.x;
    const dz = this.mesh.position.z - player.position.z;
    return dx * dx + dz * dz < 0.7 * 0.7 && player.position.y < 1.0;
  }
}

/* ---------- Boss ---------- */
export class Boss extends EnemyBase {
  constructor(scene, x, z) {
    super(scene);
    const group = new THREE.Group();

    // Body (rounded cube)
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x6611aa, emissive: 0x44119a, emissiveIntensity: 0.7,
      roughness: 0.35, metalness: 0.4,
    });
    const body = new THREE.Mesh(new RoundedBoxGeometry(2.2, 2.2, 2.2, 5, 0.25), bodyMat);
    body.castShadow = true;
    body.position.y = 1.1;
    group.add(body);
    this.body = body;

    // Eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffaa22, emissiveIntensity: 1.5 });
    const eL = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), eyeMat);
    const eR = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), eyeMat);
    eL.position.set(-0.5, 1.35, -1.12);
    eR.position.set( 0.5, 1.35, -1.12);
    group.add(eL); group.add(eR);

    // Crown
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xffd84a, emissive: 0x553300, emissiveIntensity: 0.6,
      metalness: 0.85, roughness: 0.2,
    });
    const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.18, 16), crownMat);
    crownBase.position.y = 2.35;
    group.add(crownBase);
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.5, 8), crownMat);
      const a = (i / 5) * Math.PI * 2;
      sp.position.set(Math.cos(a) * 0.7, 2.65, Math.sin(a) * 0.7);
      group.add(sp);
    }
    // Gem in front of crown
    const gem = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.18),
      new THREE.MeshStandardMaterial({ color: 0xff4488, emissive: 0xaa1144, emissiveIntensity: 1.2, metalness: 0.5, roughness: 0.2 })
    );
    gem.position.set(0, 2.4, -1.0);
    group.add(gem);

    // Aura ring
    const aura = new THREE.Mesh(
      new THREE.TorusGeometry(1.8, 0.06, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.55 })
    );
    aura.rotation.x = Math.PI / 2;
    aura.position.y = 0.05;
    group.add(aura);
    this.aura = aura;

    group.position.set(x, 0, z);
    this.mesh = group;
    scene.add(group);
    this.hp = 5;
    this.speed = 2.4;
    this.flash = 0;
  }
  update(dt, t, world, player) {
    if (!this.alive) return;
    const dx = player.position.x - this.mesh.position.x;
    const dz = player.position.z - this.mesh.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.1) {
      const mx = (dx / d) * this.speed * dt;
      const mz = (dz / d) * this.speed * dt;
      const nx = this.mesh.position.x + mx;
      const nz = this.mesh.position.z + mz;
      if (!world.collidesAt(nx, this.mesh.position.z, 1.1)) this.mesh.position.x = nx;
      if (!world.collidesAt(this.mesh.position.x, nz, 1.1)) this.mesh.position.z = nz;
    }
    this.body.rotation.y += dt * 1.2;
    this.body.position.y = 1.1 + Math.sin(t * 2) * 0.12;
    this.aura.rotation.z += dt * 1.5;
    this.aura.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      this.body.material.emissiveIntensity = 0.7 + this.flash * 4;
    }
    if (Math.abs(dx) + Math.abs(dz) > 0.01) {
      this.mesh.rotation.y = Math.atan2(dx, -dz);
    }
  }
  hits(player) {
    const dx = this.mesh.position.x - player.position.x;
    const dz = this.mesh.position.z - player.position.z;
    return dx * dx + dz * dz < 1.6 * 1.6 && player.position.y < 2.0;
  }
  takeStomp() {
    this.hp--;
    this.flash = 0.4;
    return this.hp <= 0;
  }
}
