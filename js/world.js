import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Textures } from './textures.js';
import { SkyDome } from './sky.js';

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.sky = new SkyDome(scene);
    this.obstacles = [];
    this.lavaPads = [];
    this.portal = null;
    this.size = 36;
    this.theme = 'grass';
    this.slippery = false;
    this.lights = [];
  }

  clear() {
    this.scene.remove(this.group);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.obstacles = [];
    this.lavaPads = [];
    this.portal = null;
    // Remove level-local lights from previous build
    for (const l of this.lights) this.scene.remove(l);
    this.lights = [];
  }

  build(levelDef, rng) {
    this.clear();
    this.size = levelDef.size;
    this.theme = levelDef.theme;
    this.slippery = !!levelDef.slippery;

    // Sky + fog
    this.sky.setColors(levelDef.skyTop || levelDef.sky, levelDef.skyBottom || 0xffffff, {
      offset: this.theme === 'space' ? 80 : 33,
      exponent: this.theme === 'lava' ? 0.8 : 0.6,
    });
    this.scene.background = new THREE.Color(levelDef.skyBottom || levelDef.sky);
    this.scene.fog = new THREE.Fog(levelDef.skyBottom || levelDef.sky, levelDef.fog[0], levelDef.fog[1]);

    // Ground (textured)
    const groundTex = Textures.ground(this.theme).clone();
    groundTex.needsUpdate = true;
    groundTex.repeat.set(this.size / 4, this.size / 4);
    const groundNormal = Textures.groundNormal(this.theme).clone();
    groundNormal.needsUpdate = true;
    groundNormal.repeat.set(this.size / 4, this.size / 4);

    const groundGeo = new THREE.PlaneGeometry(this.size * 2.4, this.size * 2.4, 80, 80);
    // Gentle height variation for non-snow themes
    if (this.theme !== 'snow') {
      const pos = groundGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i);
        const h = Math.sin(x * 0.18) * Math.cos(y * 0.21) * 0.18
                + Math.sin(x * 0.07 + 2) * Math.cos(y * 0.09 + 1) * 0.35;
        pos.setZ(i, h);
      }
      pos.needsUpdate = true;
      groundGeo.computeVertexNormals();
    }

    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      normalMap: groundNormal,
      normalScale: new THREE.Vector2(0.7, 0.7),
      roughness: this.theme === 'snow' ? 0.85 : 0.92,
      metalness: this.theme === 'space' ? 0.35 : 0.0,
      envMapIntensity: 0.6,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);

    // Walls (textured rounded blocks)
    const wallTex = Textures.wall(this.theme).clone();
    wallTex.needsUpdate = true;
    const wallNormal = Textures.groundNormal(this.theme).clone();
    wallNormal.needsUpdate = true;
    const wallMat = new THREE.MeshStandardMaterial({
      map: wallTex,
      normalMap: wallNormal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      roughness: 0.7,
      metalness: 0.05,
    });
    const wallH = 2.4;
    const wallT = 1.2;
    const W = this.size;
    const wallSpecs = [
      [W * 2 + wallT, wallT, 0,  W,  W * 2 + wallT, wallH],
      [W * 2 + wallT, wallT, 0, -W,  W * 2 + wallT, wallH],
      [wallT, W * 2 + wallT,  W, 0,  W * 2 + wallT, wallH],
      [wallT, W * 2 + wallT, -W, 0,  W * 2 + wallT, wallH],
    ];
    for (const [w, d, x, z] of wallSpecs) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), wallMat);
      m.position.set(x, wallH / 2, z);
      m.castShadow = true; m.receiveShadow = true;
      // Tile texture on long walls
      const tileX = Math.max(w, d) / 4;
      const inst = m.material.clone();
      inst.map = wallTex.clone();
      inst.map.wrapS = inst.map.wrapT = THREE.RepeatWrapping;
      inst.map.repeat.set(tileX, 1);
      inst.map.needsUpdate = true;
      m.material = inst;
      this.group.add(m);
    }

    // Obstacles — rounded boxes with PBR materials
    const obsMat = new THREE.MeshStandardMaterial({
      color: this.themeObstacleColor(),
      roughness: 0.55,
      metalness: this.theme === 'space' ? 0.5 : 0.1,
      envMapIntensity: 0.5,
    });
    for (let i = 0; i < levelDef.obstacles; i++) {
      const s = 1.4 + rng() * 2.2;
      const geo = new RoundedBoxGeometry(s, s, s, 4, s * 0.18);
      const m = new THREE.Mesh(geo, obsMat);
      const px = (rng() - 0.5) * (this.size - 6);
      const pz = (rng() - 0.5) * (this.size - 6);
      if (Math.hypot(px, pz) < 4) continue;
      m.position.set(px, s / 2, pz);
      m.rotation.y = rng() * Math.PI;
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
      this.obstacles.push({ mesh: m, half: s / 2 });
    }

    // Lava pads with emissive material + flicker point lights
    if (this.theme === 'lava') {
      const lavaMat = new THREE.MeshStandardMaterial({
        color: 0xff5a22,
        emissive: 0xff3300,
        emissiveIntensity: 1.6,
        roughness: 0.35,
        metalness: 0.1,
      });
      for (let i = 0; i < 9; i++) {
        const r = 1.4 + rng() * 1.6;
        const geo = new THREE.CircleGeometry(r, 24);
        const m = new THREE.Mesh(geo, lavaMat);
        m.rotation.x = -Math.PI / 2;
        m.position.set((rng() - 0.5) * (this.size - 6), 0.04, (rng() - 0.5) * (this.size - 6));
        this.group.add(m);
        this.lavaPads.push({ mesh: m, radius: r });
        // Add a small point light over each lava pool
        const light = new THREE.PointLight(0xff5522, 1.2, 8, 2);
        light.position.set(m.position.x, 1.2, m.position.z);
        this.scene.add(light);
        this.lights.push(light);
      }
    }

    // Theme decoration
    this.decorate(rng);

    // Portal
    this.portal = this.createPortal(levelDef.accent);
    const portalPos = { x: (rng() - 0.5) * (this.size - 8), z: -(this.size - 5) };
    this.portal.group.position.set(portalPos.x, 0, portalPos.z);
    this.group.add(this.portal.group);

    // Portal light
    this.portalLight = new THREE.PointLight(levelDef.accent, 1.5, 12, 2);
    this.portalLight.position.set(portalPos.x, 2.2, portalPos.z);
    this.scene.add(this.portalLight);
    this.lights.push(this.portalLight);

    this.setPortalActive(false);
  }

  themeObstacleColor() {
    switch (this.theme) {
      case 'grass': return 0x6f4a26;
      case 'desert': return 0xc59554;
      case 'snow': return 0xb8c8da;
      case 'lava': return 0x4a2828;
      case 'space': return 0x553988;
      default: return 0x666677;
    }
  }

  decorate(rng) {
    if (this.theme === 'grass') {
      // Trees with rounded geometry + flowers
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4520, roughness: 0.85 });
      const leafMat  = new THREE.MeshStandardMaterial({ color: 0x2f9a3a, roughness: 0.7 });
      const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3eb045, roughness: 0.7 });
      for (let i = 0; i < 24; i++) {
        const g = new THREE.Group();
        const h = 1.2 + rng() * 0.8;
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, h, 8), trunkMat);
        t.position.y = h / 2; t.castShadow = true;
        const lr = 0.7 + rng() * 0.4;
        const lobe1 = new THREE.Mesh(new THREE.IcosahedronGeometry(lr, 1), leafMat);
        lobe1.position.y = h + lr * 0.6;
        const lobe2 = new THREE.Mesh(new THREE.IcosahedronGeometry(lr * 0.75, 1), leafMat2);
        lobe2.position.set(lr * 0.4, h + lr, -lr * 0.2);
        lobe1.castShadow = true; lobe2.castShadow = true;
        g.add(t); g.add(lobe1); g.add(lobe2);
        g.position.set((rng() - 0.5) * this.size * 1.85, 0, (rng() - 0.5) * this.size * 1.85);
        if (Math.abs(g.position.x) < this.size - 1 && Math.abs(g.position.z) < this.size - 1) continue;
        this.group.add(g);
      }
      // Flower dots
      const flowerMat = new THREE.MeshStandardMaterial({ color: 0xff66aa, emissive: 0x550022, emissiveIntensity: 0.2 });
      for (let i = 0; i < 30; i++) {
        const f = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), flowerMat);
        f.position.set((rng() - 0.5) * this.size * 1.9, 0.08, (rng() - 0.5) * this.size * 1.9);
        if (Math.abs(f.position.x) < this.size && Math.abs(f.position.z) < this.size) continue;
        this.group.add(f);
      }
    }
    if (this.theme === 'snow') {
      const snowmanMat = new THREE.MeshStandardMaterial({ color: 0xfafcff, roughness: 0.55 });
      const coalMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
      const carrotMat = new THREE.MeshStandardMaterial({ color: 0xff8833, roughness: 0.4 });
      for (let i = 0; i < 8; i++) {
        const g = new THREE.Group();
        const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 12), snowmanMat);
        s1.position.y = 0.6; s1.castShadow = true;
        const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), snowmanMat);
        s2.position.y = 1.4; s2.castShadow = true;
        const s3 = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 12), snowmanMat);
        s3.position.y = 2.05; s3.castShadow = true;
        // Eyes
        const eL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), coalMat);
        const eR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 6), coalMat);
        eL.position.set(-0.1, 2.12, -0.28); eR.position.set(0.1, 2.12, -0.28);
        // Carrot
        const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 6), carrotMat);
        carrot.position.set(0, 2.05, -0.34); carrot.rotation.x = Math.PI / 2;
        g.add(s1); g.add(s2); g.add(s3); g.add(eL); g.add(eR); g.add(carrot);
        g.position.set((rng() - 0.5) * this.size * 1.9, 0, (rng() - 0.5) * this.size * 1.9);
        if (Math.abs(g.position.x) < this.size - 1 && Math.abs(g.position.z) < this.size - 1) continue;
        this.group.add(g);
      }
      // Falling snow
      const snowGeo = new THREE.BufferGeometry();
      const N = 300;
      const arr = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        arr[i * 3]     = (rng() - 0.5) * this.size * 2;
        arr[i * 3 + 1] = rng() * 40 + 4;
        arr[i * 3 + 2] = (rng() - 0.5) * this.size * 2;
      }
      snowGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      this.snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
        color: 0xffffff, size: 0.18, transparent: true, opacity: 0.85,
      }));
      this.group.add(this.snow);
    }
    if (this.theme === 'desert') {
      // Cacti and rocks
      const cactusMat = new THREE.MeshStandardMaterial({ color: 0x3f8a3f, roughness: 0.65 });
      const rockMat = new THREE.MeshStandardMaterial({ color: 0xb89066, roughness: 0.85 });
      for (let i = 0; i < 12; i++) {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 1.7, 10), cactusMat);
        body.position.y = 0.85; body.castShadow = true;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.6, 8), cactusMat);
        arm.position.set(0.32, 1.0, 0); arm.rotation.z = Math.PI / 4; arm.castShadow = true;
        g.add(body); g.add(arm);
        g.position.set((rng() - 0.5) * this.size * 1.9, 0, (rng() - 0.5) * this.size * 1.9);
        if (Math.abs(g.position.x) < this.size && Math.abs(g.position.z) < this.size) continue;
        this.group.add(g);
      }
      for (let i = 0; i < 14; i++) {
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + rng() * 0.6), rockMat);
        r.position.set((rng() - 0.5) * this.size * 1.95, 0.3, (rng() - 0.5) * this.size * 1.95);
        if (Math.abs(r.position.x) < this.size && Math.abs(r.position.z) < this.size) continue;
        r.castShadow = true;
        this.group.add(r);
      }
    }
    if (this.theme === 'lava') {
      // Crystal pillars
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0xff7a33, emissive: 0xff3300, emissiveIntensity: 1.5,
        roughness: 0.3, metalness: 0.2,
      });
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x2a1818, roughness: 0.9 });
      for (let i = 0; i < 16; i++) {
        const g = new THREE.Group();
        const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.45 + rng() * 0.4), rockMat);
        base.position.y = 0.3;
        const crystal = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2 + rng() * 0.8, 6), crystalMat);
        crystal.position.y = 0.7 + rng() * 0.4;
        crystal.rotation.z = (rng() - 0.5) * 0.4;
        g.add(base); g.add(crystal);
        g.position.set((rng() - 0.5) * this.size * 1.9, 0, (rng() - 0.5) * this.size * 1.9);
        if (Math.abs(g.position.x) < this.size && Math.abs(g.position.z) < this.size) continue;
        this.group.add(g);
      }
    }
    if (this.theme === 'space') {
      // Stars + glowing rings
      const starGeo = new THREE.BufferGeometry();
      const N = 600;
      const arr = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const r = 80 + Math.random() * 60;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        arr[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
        arr[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 10;
        arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      }
      starGeo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
        color: 0xffffff, size: 0.6, transparent: true, opacity: 0.9, sizeAttenuation: true,
      }));
      this.group.add(stars);
      // Floating glowing platforms
      const platMat = new THREE.MeshStandardMaterial({
        color: 0x8855ff, emissive: 0x553388, emissiveIntensity: 1.0,
        roughness: 0.35, metalness: 0.5,
      });
      for (let i = 0; i < 6; i++) {
        const g = new THREE.Group();
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 8, 24), platMat);
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.3;
        g.add(ring);
        g.position.set((rng() - 0.5) * this.size * 1.9, 0.05, (rng() - 0.5) * this.size * 1.9);
        if (Math.abs(g.position.x) < this.size && Math.abs(g.position.z) < this.size) continue;
        this.group.add(g);
      }
    }
  }

  createPortal(accent) {
    const group = new THREE.Group();
    const ringGeo = new THREE.TorusGeometry(1.55, 0.2, 16, 48);
    const ringMat = new THREE.MeshStandardMaterial({
      color: accent, emissive: accent, emissiveIntensity: 0.6,
      roughness: 0.25, metalness: 0.6,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = 1.85;
    ring.castShadow = true;
    group.add(ring);

    // Inner swirl (shader-ish disc)
    const innerGeo = new THREE.CircleGeometry(1.35, 48);
    const innerMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color(0xaaffee) },
        uColor2: { value: new THREE.Color(0x224477) },
        uActive: { value: 0.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime;
        uniform float uActive;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        void main() {
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;
          float ang = atan(p.y, p.x);
          float swirl = sin(ang * 6.0 + uTime * 2.0 + r * 8.0) * 0.5 + 0.5;
          float ring = smoothstep(0.98, 0.85, r);
          vec3 col = mix(uColor2, uColor1, swirl * ring);
          float alpha = ring * (0.45 + 0.45 * uActive);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.y = 1.85;
    group.add(inner);

    // Base disc
    const baseMat = new THREE.MeshStandardMaterial({
      color: accent, emissive: accent, emissiveIntensity: 0.4,
      roughness: 0.4, metalness: 0.5,
    });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.9, 0.18, 32), baseMat);
    base.position.y = 0.09; base.castShadow = true; base.receiveShadow = true;
    group.add(base);

    return { group, ring, inner, base, innerMat };
  }

  setPortalActive(active) {
    if (!this.portal) return;
    this.portal.active = active;
    this.portal.innerMat.uniforms.uActive.value = active ? 1.0 : 0.0;
    this.portal.ring.material.emissiveIntensity = active ? 1.4 : 0.3;
    if (this.portalLight) this.portalLight.intensity = active ? 3.0 : 1.0;
  }

  collidesAt(x, z, halfSize = 0.5) {
    for (const o of this.obstacles) {
      const dx = Math.abs(x - o.mesh.position.x);
      const dz = Math.abs(z - o.mesh.position.z);
      if (dx < o.half + halfSize && dz < o.half + halfSize) return true;
    }
    return false;
  }

  hazardAt(x, z) {
    for (const p of this.lavaPads) {
      const dx = x - p.mesh.position.x;
      const dz = z - p.mesh.position.z;
      if (dx * dx + dz * dz < p.radius * p.radius) return true;
    }
    return false;
  }

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
      this.portal.ring.position.y = 1.85 + Math.sin(t * 2) * 0.1;
      this.portal.innerMat.uniforms.uTime.value = t;
      this.portal.inner.position.y = 1.85;
    }
    for (const p of this.lavaPads) {
      p.mesh.material.emissiveIntensity = 1.2 + Math.sin(t * 6 + p.mesh.position.x) * 0.45;
    }
    if (this.snow) {
      const pos = this.snow.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - dt * (1.2 + (i % 3) * 0.3);
        if (y < 0.1) y = 35 + Math.random() * 5;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
  }

  portalContains(x, z) {
    if (!this.portal || !this.portal.active) return false;
    const dx = x - this.portal.group.position.x;
    const dz = z - this.portal.group.position.z;
    return dx * dx + dz * dz < 1.7 * 1.7;
  }
}
