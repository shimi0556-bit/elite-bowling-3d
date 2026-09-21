import * as THREE from 'three';
import { HEAD_PIN_Z } from './constants';
import type { ShotPoint } from './shot';

const POOL = 72;

export class ImpactFx {
  readonly points: THREE.Points;
  readonly flash: THREE.PointLight;
  private readonly positions: Float32Array;
  private readonly velocities: Float32Array;
  private readonly life: Float32Array;
  private readonly geo: THREE.BufferGeometry;
  private readonly mat: THREE.ShaderMaterial;

  constructor() {
    this.positions = new Float32Array(POOL * 3);
    this.velocities = new Float32Array(POOL * 3);
    this.life = new Float32Array(POOL);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const lifeAttr = new THREE.BufferAttribute(this.life, 1);
    this.geo.setAttribute('aLife', lifeAttr);
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {},
      vertexShader: `
        attribute float aLife;
        varying float vLife;
        void main() {
          vLife = aLife;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(aLife * 22.0 * (1.0 / -mv.z), 0.0);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying float vLife;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r = dot(d, d);
          if (r > 0.25) discard;
          float alpha = smoothstep(0.25, 0.02, r) * vLife;
          gl_FragColor = vec4(1.15, 0.78, 0.42, alpha);
        }
      `,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.flash = new THREE.PointLight(0xffd8ae, 0, 5.5, 2);
    this.flash.position.set(0, 0.5, HEAD_PIN_Z + 0.2);
  }

  burst(x: number, y: number, z: number, magnitude: number): void {
    const count = magnitude > 120 ? 8 : magnitude > 50 ? 5 : 3;
    let spawned = 0;
    for (let i = 0; i < POOL && spawned < count; i++) {
      if ((this.life[i] ?? 0) > 0.05) continue;
      const o = i * 3;
      this.positions[o] = x + (Math.random() - 0.5) * 0.08;
      this.positions[o + 1] = y + (Math.random() - 0.5) * 0.06;
      this.positions[o + 2] = z + (Math.random() - 0.5) * 0.08;
      this.velocities[o] = (Math.random() - 0.5) * 1.6;
      this.velocities[o + 1] = 0.8 + Math.random() * 1.4;
      this.velocities[o + 2] = (Math.random() - 0.5) * 1.6;
      this.life[i] = 0.55 + Math.random() * 0.25;
      spawned++;
    }
    this.flash.position.set(x, y + 0.1, z);
    this.flash.intensity = Math.min(7, this.flash.intensity + magnitude / 35);
    const attr = this.geo.getAttribute('position');
    const lifeAttr = this.geo.getAttribute('aLife');
    attr.needsUpdate = true;
    lifeAttr.needsUpdate = true;
  }

  update(dt: number): void {
    let dirty = false;
    for (let i = 0; i < POOL; i++) {
      const current = this.life[i] ?? 0;
      if (current <= 0) continue;
      this.life[i] = current - dt * 1.6;
      const o = i * 3;
      this.velocities[o + 1] = (this.velocities[o + 1] ?? 0) - 4.5 * dt;
      this.positions[o] = (this.positions[o] ?? 0) + (this.velocities[o] ?? 0) * dt;
      this.positions[o + 1] = (this.positions[o + 1] ?? 0) + (this.velocities[o + 1] ?? 0) * dt;
      this.positions[o + 2] = (this.positions[o + 2] ?? 0) + (this.velocities[o + 2] ?? 0) * dt;
      dirty = true;
    }
    if (dirty) {
      this.geo.getAttribute('position').needsUpdate = true;
      this.geo.getAttribute('aLife').needsUpdate = true;
    }
    this.flash.intensity = THREE.MathUtils.damp(this.flash.intensity, 0, 6, dt);
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

export class AimGuide {
  readonly points: THREE.Points;
  readonly ring: THREE.Mesh;
  private readonly positions = new Float32Array(90 * 3);
  private readonly geo: THREE.BufferGeometry;
  private pulse = 0;

  constructor() {
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setDrawRange(0, 0);
    this.points = new THREE.Points(this.geo, new THREE.PointsMaterial({
      color: 0xf0d7a2,
      size: 0.045,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      sizeAttenuation: true,
    }));
    this.points.frustumCulled = false;
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.055, 0.105, 28),
      new THREE.MeshBasicMaterial({
        color: 0xf0d7a2,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.015;
    this.ring.visible = false;
  }

  setPath(path: ShotPoint[], visible: boolean): void {
    this.points.visible = visible && path.length > 1;
    this.ring.visible = visible && path.length > 0;
    if (!visible || path.length === 0) return;
    const step = Math.max(1, Math.ceil(path.length / 80));
    let count = 0;
    for (let i = 0; i < path.length && count < 90; i += step) {
      const point = path[i];
      if (!point) continue;
      this.positions[count * 3] = point.x;
      this.positions[count * 3 + 1] = 0.02;
      this.positions[count * 3 + 2] = point.z;
      count++;
    }
    this.geo.setDrawRange(0, count);
    this.geo.getAttribute('position').needsUpdate = true;
    this.geo.computeBoundingSphere();
    const end = path[path.length - 1];
    if (!end) return;
    const gutter = path.some((point) => point.gutter);
    const color = gutter ? 0xe15b4a : 0xf0d7a2;
    (this.points.material as THREE.PointsMaterial).color.setHex(color);
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(color);
    this.ring.position.x = end.x;
    this.ring.position.z = Math.min(end.z, HEAD_PIN_Z - 0.05);
  }

  update(dt: number): void {
    this.pulse += dt * 3;
    const scale = 1 + Math.sin(this.pulse) * 0.06;
    this.ring.scale.setScalar(scale);
  }

  dispose(): void {
    this.geo.dispose();
    (this.points.material as THREE.Material).dispose();
    this.ring.geometry.dispose();
    (this.ring.material as THREE.Material).dispose();
  }
}
