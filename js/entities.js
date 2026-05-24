import * as THREE from 'three';

/* ---------- Coin ---------- */
export class Coin {
  constructor(scene, x, z) {
    const geo = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 24);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffd700, metalness: 0.7, roughness: 0.25,
      emissive: 0x554400, emissiveIntensity: 0.4,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, 0.8, z);
    this.mesh.rotation.x = Math.PI / 2;
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.collected = false;
    this.baseY = 0.8;
    this.scene = scene;
    this.phase = Math.random() * Math.PI * 2;
  }
  update(dt, t, player) {
    if (this.collected) return;
    this.mesh.rotation.z += dt * 3.5;
    this.mesh.position.y = this.baseY + Math.sin(t * 3 + this.phase) * 0.12;
    // Magnet pull
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
    let geo;
    if (kind === 'heart') {
      geo = new THREE.IcosahedronGeometry(0.45, 0);
    } else if (kind === 'shield') {
      geo = new THREE.OctahedronGeometry(0.5);
    } else if (kind === 'speed') {
      geo = new THREE.TetrahedronGeometry(0.55);
    } else if (kind === 'magnet') {
      geo = new THREE.TorusGeometry(0.35, 0.13, 8, 12);
    } else {
      geo = new THREE.ConeGeometry(0.4, 0.7, 6);
    }
    const mat = new THREE.MeshStandardMaterial({
      color, emissive: color, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.3,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, 1.0, z);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.baseY = 1.0;
    this.phase = Math.random() * Math.PI * 2;
  }
  update(dt, t) {
    if (this.collected) return;
    this.mesh.rotation.y += dt * 2.5;
    this.mesh.rotation.x += dt * 1.2;
    this.mesh.position.y = this.baseY + Math.sin(t * 2.5 + this.phase) * 0.18;
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

/* ---------- Patroller: moves in a line, turns at obstacles/walls ---------- */
export class Patroller extends EnemyBase {
  constructor(scene, x, z) {
    super(scene);
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9933cc, roughness: 0.5, emissive: 0x220044, emissiveIntensity: 0.3 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, 0.5, z);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
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
    if (world.collidesAt(nx, nz, 0.55) || Math.abs(nx) > bound || Math.abs(nz) > bound) {
      bounce = true;
    }
    if (bounce) {
      const a = Math.random() * Math.PI * 2;
      this.dir.set(Math.cos(a), 0, Math.sin(a));
    } else {
      this.mesh.position.x = nx;
      this.mesh.position.z = nz;
    }
    this.mesh.rotation.y += dt * 2;
    this.mesh.position.y = 0.5 + Math.abs(Math.sin(t * 4)) * 0.15;
  }
}

/* ---------- Chaser: pursues player when within range ---------- */
export class Chaser extends EnemyBase {
  constructor(scene, x, z) {
    super(scene);
    const geo = new THREE.IcosahedronGeometry(0.6, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff3344, roughness: 0.4, emissive: 0x661111, emissiveIntensity: 0.4 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set(x, 0.6, z);
    this.mesh.castShadow = true;
    scene.add(this.mesh);
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
    this.mesh.rotation.y += dt * 3;
    this.mesh.rotation.x += dt * 2;
  }
}

/* ---------- Spike: stationary hazard ---------- */
export class Spike extends EnemyBase {
  constructor(scene, x, z) {
    super(scene);
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 6), mat);
      const a = (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.2, 0.35, Math.sin(a) * 0.2);
      s.castShadow = true;
      group.add(s);
    }
    const center = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.9, 6), mat);
    center.position.y = 0.45;
    center.castShadow = true;
    group.add(center);
    group.position.set(x, 0, z);
    this.mesh = group;
    scene.add(group);
    this.stationary = true;
  }
  update() { /* nothing */ }
  hits(player) {
    const dx = this.mesh.position.x - player.position.x;
    const dz = this.mesh.position.z - player.position.z;
    return dx * dx + dz * dz < 0.7 * 0.7 && player.position.y < 1.0;
  }
}

/* ---------- Boss: big chaser with HP, spawns spikes ---------- */
export class Boss extends EnemyBase {
  constructor(scene, x, z) {
    super(scene);
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.2, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x661177, emissive: 0x331044, emissiveIntensity: 0.5, roughness: 0.4 })
    );
    body.castShadow = true;
    body.position.y = 1.1;
    group.add(body);
    this.body = body;
    // Crown
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(0.9, 0.7, 6),
      new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0x554400, emissiveIntensity: 0.5, metalness: 0.6 })
    );
    crown.position.y = 2.6;
    group.add(crown);
    group.position.set(x, 0, z);
    this.mesh = group;
    scene.add(group);
    this.hp = 5;
    this.speed = 2.4;
    this.cooldown = 0;
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
    this.body.position.y = 1.1 + Math.sin(t * 2) * 0.1;
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      this.body.material.emissiveIntensity = 0.5 + this.flash * 4;
    }
  }
  hits(player) {
    const dx = this.mesh.position.x - player.position.x;
    const dz = this.mesh.position.z - player.position.z;
    return dx * dx + dz * dz < 1.6 * 1.6 && player.position.y < 2.0;
  }
  /** Hit from above (player stomp). Returns true on death. */
  takeStomp() {
    this.hp--;
    this.flash = 0.4;
    return this.hp <= 0;
  }
}
