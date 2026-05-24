import * as THREE from 'three';

export class ParticleSystem {
  constructor(scene, max = 400) {
    this.scene = scene;
    this.max = max;
    this.geo = new THREE.BufferGeometry();
    this.positions = new Float32Array(max * 3);
    this.colors = new Float32Array(max * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.25, vertexColors: true, transparent: true, opacity: 0.95,
      sizeAttenuation: true, depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.particles = []; // active list
  }

  burst(x, y, z, color = 0xffd700, count = 18, spread = 5) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.max) this.particles.shift();
      const speed = spread * (0.5 + Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI - Math.PI / 2;
      this.particles.push({
        x, y, z,
        vx: Math.cos(theta) * Math.cos(phi) * speed,
        vy: Math.sin(phi) * speed + 2,
        vz: Math.sin(theta) * Math.cos(phi) * speed,
        life: 0.6 + Math.random() * 0.4,
        age: 0,
        r: c.r, g: c.g, b: c.b,
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.age += dt;
      if (p.age >= p.life) { this.particles.splice(i, 1); continue; }
      p.vy += -14 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.4; p.vx *= 0.7; p.vz *= 0.7; }
    }
    // Write into buffers (fill unused with origin + zero alpha-ish color)
    const N = this.max;
    for (let i = 0; i < N; i++) {
      const p = this.particles[i];
      const o = i * 3;
      if (p) {
        const fade = 1 - p.age / p.life;
        this.positions[o] = p.x;
        this.positions[o + 1] = p.y;
        this.positions[o + 2] = p.z;
        this.colors[o]     = p.r * fade;
        this.colors[o + 1] = p.g * fade;
        this.colors[o + 2] = p.b * fade;
      } else {
        this.positions[o] = 9999;
        this.positions[o + 1] = -100;
        this.positions[o + 2] = 9999;
        this.colors[o] = 0; this.colors[o + 1] = 0; this.colors[o + 2] = 0;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

export class CameraShake {
  constructor() {
    this.amp = 0;
    this.duration = 0;
    this.t = 0;
  }
  trigger(amp = 0.4, duration = 0.25) {
    this.amp = Math.max(this.amp, amp);
    this.duration = Math.max(this.duration, duration);
    this.t = this.duration;
  }
  apply(camera, dt) {
    if (this.t <= 0) return;
    this.t = Math.max(0, this.t - dt);
    const decay = this.t / this.duration;
    const a = this.amp * decay;
    camera.position.x += (Math.random() - 0.5) * a;
    camera.position.y += (Math.random() - 0.5) * a;
    camera.position.z += (Math.random() - 0.5) * a;
    if (this.t === 0) this.amp = 0;
  }
}
