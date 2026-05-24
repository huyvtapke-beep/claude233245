import * as THREE from 'three';

/**
 * Procedural sky dome with a vertical gradient shader.
 * Two colors (top/bottom) blended with adjustable horizon.
 */
export class SkyDome {
  constructor(scene) {
    this.uniforms = {
      topColor:    { value: new THREE.Color(0x87ceeb) },
      bottomColor: { value: new THREE.Color(0xffffff) },
      offset:      { value: 33 },
      exponent:    { value: 0.6 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos + vec3(0.0, offset, 0.0)).y;
          float f = max(pow(max(h, 0.0), exponent), 0.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, f), 1.0);
        }
      `,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const geo = new THREE.SphereGeometry(180, 32, 16);
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.renderOrder = -1;
    scene.add(this.mesh);
  }

  setColors(top, bottom, opts = {}) {
    this.uniforms.topColor.value.set(top);
    this.uniforms.bottomColor.value.set(bottom);
    if (opts.offset !== undefined) this.uniforms.offset.value = opts.offset;
    if (opts.exponent !== undefined) this.uniforms.exponent.value = opts.exponent;
  }
}
