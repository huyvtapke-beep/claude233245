import * as THREE from 'three';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.obstacles = [];
    this.lavaPads = []; // hazard tiles
    this.portal = null;
    this.size = 36;
    this.theme = 'grass';
    this.slippery = false;
  }

  clear() {
    this.scene.remove(this.group);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.obstacles = [];
    this.lavaPads = [];
    this.portal = null;
  }

  build(levelDef, rng) {
    this.clear();
    this.size = levelDef.size;
    this.theme = levelDef.theme;
    this.slippery = !!levelDef.slippery;

    // Scene visuals
    this.scene.background = new THREE.Color(levelDef.sky);
    this.scene.fog = new THREE.Fog(levelDef.sky, levelDef.fog[0], levelDef.fog[1]);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(this.size * 2, this.size * 2, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({
      color: levelDef.ground,
      roughness: this.theme === 'snow' ? 0.7 : 0.9,
      metalness: this.theme === 'space' ? 0.4 : 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Decorative grid for space/void
    if (this.theme === 'space') {
      const grid = new THREE.GridHelper(this.size * 2, 30, 0x6655aa, 0x332266);
      grid.position.y = 0.01;
      this.group.add(grid);
    }

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: levelDef.accent, roughness: 0.6 });
    const wallH = 2.0;
    const wallT = 1.0;
    const W = this.size;
    const walls = [
      [W * 2 + wallT, wallT, 0,  W],
      [W * 2 + wallT, wallT, 0, -W],
      [wallT, W * 2 + wallT,  W, 0],
      [wallT, W * 2 + wallT, -W, 0],
    ];
    for (const [w, d, x, z] of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      m.position.set(x, wallH / 2, z);
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
    }

    // Obstacles (boxes)
    const obsMat = new THREE.MeshStandardMaterial({
      color: this.themeObstacleColor(),
      roughness: 0.7,
    });
    for (let i = 0; i < levelDef.obstacles; i++) {
      const s = 1.4 + rng() * 2.2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), obsMat);
      const px = (rng() - 0.5) * (this.size - 6);
      const pz = (rng() - 0.5) * (this.size - 6);
      if (Math.hypot(px, pz) < 4) continue; // keep spawn area clear
      m.position.set(px, s / 2, pz);
      m.rotation.y = rng() * Math.PI;
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
      this.obstacles.push({ mesh: m, half: s / 2 });
    }

    // Lava hazard pads for lava theme
    if (this.theme === 'lava') {
      const lavaMat = new THREE.MeshStandardMaterial({
        color: 0xff4400, emissive: 0xff2200, emissiveIntensity: 0.8, roughness: 0.3,
      });
      const padCount = 8;
      for (let i = 0; i < padCount; i++) {
        const r = 1.5 + rng() * 1.5;
        const geo = new THREE.CircleGeometry(r, 16);
        const m = new THREE.Mesh(geo, lavaMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set((rng() - 0.5) * (this.size - 6), 0.02, (rng() - 0.5) * (this.size - 6));
        this.group.add(m);
        this.lavaPads.push({ mesh: m, radius: r });
      }
    }

    // Theme-specific decorations
    this.decorate(rng);

    // Portal (initially inactive)
    this.portal = this.createPortal(levelDef.accent);
    this.portal.group.position.set((rng() - 0.5) * (this.size - 8), 0, -(this.size - 5));
    this.group.add(this.portal.group);
    this.setPortalActive(false);
  }

  themeObstacleColor() {
    switch (this.theme) {
      case 'grass': return 0x6a4a2a;
      case 'desert': return 0xb08840;
      case 'snow': return 0xa0b8d0;
      case 'lava': return 0x553333;
      case 'space': return 0x554477;
      default: return 0x666677;
    }
  }

  decorate(rng) {
    if (this.theme === 'grass') {
      // Trees
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6a4521 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d8a3a });
      for (let i = 0; i < 12; i++) {
        const g = new THREE.Group();
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.4, 6), trunkMat);
        t.position.y = 0.7;
        const l = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 7), leafMat);
        l.position.y = 1.9;
        g.add(t); g.add(l);
        g.position.set((rng() - 0.5) * (this.size * 1.9), 0, (rng() - 0.5) * (this.size * 1.9));
        // Skip near play area to avoid overlapping obstacles
        if (Math.abs(g.position.x) < this.size - 1 && Math.abs(g.position.z) < this.size - 1) continue;
        this.group.add(g);
      }
    }
    if (this.theme === 'snow') {
      const snowmanMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
      for (let i = 0; i < 6; i++) {
        const g = new THREE.Group();
        const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 10), snowmanMat);
        s1.position.y = 0.6;
        const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), snowmanMat);
        s2.position.y = 1.4;
        const s3 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 10), snowmanMat);
        s3.position.y = 2.05;
        g.add(s1); g.add(s2); g.add(s3);
        g.position.set((rng() - 0.5) * this.size * 1.9, 0, (rng() - 0.5) * this.size * 1.9);
        if (Math.abs(g.position.x) < this.size - 1 && Math.abs(g.position.z) < this.size - 1) continue;
        this.group.add(g);
      }
    }
    if (this.theme === 'desert') {
      const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3a7a3a });
      for (let i = 0; i < 10; i++) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.3, 1.6, 8), cactusMat);
        body.position.y = 0.8;
        g.add(body);
        g.position.set((rng() - 0.5) * this.size * 1.9, 0, (rng() - 0.5) * this.size * 1.9);
        if (Math.abs(g.position.x) < this.size - 1 && Math.abs(g.position.z) < this.size - 1) continue;
        this.group.add(g);
      }
    }
    if (this.theme === 'space') {
      // Stars
      const starGeo = new THREE.BufferGeometry();
      const N = 400;
      const arr = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        arr[i * 3]     = (rng() - 0.5) * 300;
        arr[i * 3 + 1] = rng() * 80 + 20;
        arr[i * 3 + 2] = (rng() - 0.5) * 300;
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.4 });
      const stars = new THREE.Points(starGeo, starMat);
      this.group.add(stars);
    }
  }

  createPortal(accent) {
    const group = new THREE.Group();

    const ringGeo = new THREE.TorusGeometry(1.5, 0.18, 12, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: accent, emissive: accent, emissiveIntensity: 0.5, roughness: 0.3,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 1.8;
    ring.castShadow = true;
    group.add(ring);

    const innerGeo = new THREE.CircleGeometry(1.3, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x111133, transparent: true, opacity: 0.65, side: THREE.DoubleSide,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.y = 1.8;
    group.add(inner);

    return { group, ring, inner };
  }

  setPortalActive(active) {
    if (!this.portal) return;
    this.portal.active = active;
    if (active) {
      this.portal.inner.material.color = new THREE.Color(0xaaffee);
      this.portal.inner.material.opacity = 0.85;
      this.portal.ring.material.emissiveIntensity = 1.2;
    } else {
      this.portal.inner.material.color = new THREE.Color(0x222244);
      this.portal.inner.material.opacity = 0.4;
      this.portal.ring.material.emissiveIntensity = 0.3;
    }
  }

  /** Box-AABB collision for movement. */
  collidesAt(x, z, halfSize = 0.5) {
    for (const o of this.obstacles) {
      const dx = Math.abs(x - o.mesh.position.x);
      const dz = Math.abs(z - o.mesh.position.z);
      if (dx < o.half + halfSize && dz < o.half + halfSize) return true;
    }
    return false;
  }

  /** Did the (x,z) hit a hazard pad (lava)? */
  hazardAt(x, z) {
    for (const p of this.lavaPads) {
      const dx = x - p.mesh.position.x;
      const dz = z - p.mesh.position.z;
      if (dx * dx + dz * dz < p.radius * p.radius) return true;
    }
    return false;
  }

  /** Pick a random walkable spot. */
  randomWalkable(rng, padding = 2, minDistFromCenter = 4) {
    for (let i = 0; i < 200; i++) {
      const x = (rng() - 0.5) * (this.size - padding * 2);
      const z = (rng() - 0.5) * (this.size - padding * 2);
      if (Math.hypot(x, z) < minDistFromCenter) continue;
      if (this.collidesAt(x, z, 0.6)) continue;
      if (this.hazardAt(x, z)) continue;
      return { x, z };
    }
    return { x: 0, z: 0 };
  }

  update(dt, t) {
    if (this.portal) {
      this.portal.ring.rotation.z += dt * 1.5;
      this.portal.ring.position.y = 1.8 + Math.sin(t * 2) * 0.1;
      this.portal.inner.rotation.z -= dt * 0.8;
    }
    for (const p of this.lavaPads) {
      p.mesh.material.emissiveIntensity = 0.7 + Math.sin(t * 6 + p.mesh.position.x) * 0.25;
    }
  }

  portalContains(x, z) {
    if (!this.portal || !this.portal.active) return false;
    const dx = x - this.portal.group.position.x;
    const dz = z - this.portal.group.position.z;
    return dx * dx + dz * dz < 1.7 * 1.7;
  }
}
