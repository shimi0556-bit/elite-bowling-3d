import * as THREE from 'three';
import { BALL_RADIUS } from './constants';
import { makeMonogramTexture } from './materials';
import type { PinPose } from './physics';

export interface BallSkin {
  id: string;
  color: number;
  metalness: number;
  roughness: number;
}

export const BALL_SKINS: BallSkin[] = [
  { id: 'crimson', color: 0xc42a42, metalness: 0.62, roughness: 0.2 },
  { id: 'sapphire', color: 0x1d4fa8, metalness: 0.58, roughness: 0.18 },
  { id: 'obsidian', color: 0x1c1c1e, metalness: 0.88, roughness: 0.14 },
];

export class BallView {
  readonly group = new THREE.Group();
  private readonly material: THREE.MeshPhysicalMaterial;
  private readonly logo: THREE.Mesh;
  private readonly logoMap: THREE.Texture;
  private readonly shellGeo: THREE.SphereGeometry;
  private readonly holeGeo: THREE.CylinderGeometry;
  private readonly holeMat: THREE.MeshPhysicalMaterial;
  private readonly logoGeo: THREE.CircleGeometry;
  private returning = false;
  private returnT = 0;
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private spin = 0;

  constructor() {
    this.shellGeo = new THREE.SphereGeometry(BALL_RADIUS, 48, 32);
    this.material = new THREE.MeshPhysicalMaterial({
      color: BALL_SKINS[0]?.color ?? 0xc42a42,
      metalness: 0.62,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.45,
    });
    const shell = new THREE.Mesh(this.shellGeo, this.material);
    shell.castShadow = true;
    shell.receiveShadow = true;
    this.group.add(shell);

    this.holeGeo = new THREE.CylinderGeometry(0.011, 0.012, 0.045, 12);
    this.holeMat = new THREE.MeshPhysicalMaterial({ color: 0x14080c, roughness: 0.62, metalness: 0.15 });
    const holes = [
      new THREE.Vector3(0.0, 0.045, -0.07),
      new THREE.Vector3(-0.028, 0.02, -0.055),
      new THREE.Vector3(0.028, 0.02, -0.055),
    ];
    for (const spot of holes) {
      const hole = new THREE.Mesh(this.holeGeo, this.holeMat);
      const normal = spot.clone().normalize();
      hole.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      hole.position.copy(normal.multiplyScalar(BALL_RADIUS - 0.01));
      this.group.add(hole);
    }

    this.logoMap = makeMonogramTexture();
    this.logoGeo = new THREE.CircleGeometry(0.038, 24);
    this.logo = new THREE.Mesh(this.logoGeo, new THREE.MeshPhysicalMaterial({
      map: this.logoMap,
      transparent: true,
      roughness: 0.35,
      metalness: 0.55,
      emissive: 0x3a2a12,
      emissiveIntensity: 0.25,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }));
    this.logo.position.set(0, 0.01, -(BALL_RADIUS + 0.001));
    this.group.add(this.logo);
  }

  setSkin(id: string): void {
    const skin = BALL_SKINS.find((entry) => entry.id === id) ?? BALL_SKINS[0];
    if (!skin) return;
    this.material.color.setHex(skin.color);
    this.material.metalness = skin.metalness;
    this.material.roughness = skin.roughness;
  }

  sync(pose: PinPose): void {
    if (this.returning) return;
    this.group.position.set(pose.x, pose.y, pose.z);
    this.group.quaternion.set(pose.qx, pose.qy, pose.qz, pose.qw);
    this.group.visible = pose.y > -1;
  }

  startReturn(target: THREE.Vector3): void {
    this.from.copy(this.group.position);
    this.to.copy(target);
    this.returnT = 0;
    this.returning = true;
    this.group.visible = true;
  }

  update(dt: number): boolean {
    this.spin += dt * (this.returning ? 6 : 0);
    if (!this.returning) return false;
    this.returnT = Math.min(1, this.returnT + dt / 0.72);
    const t = this.returnT * this.returnT * (3 - 2 * this.returnT);
    this.group.position.lerpVectors(this.from, this.to, t);
    this.group.position.y += Math.sin(t * Math.PI) * 0.32;
    this.group.rotation.x += dt * 8;
    if (this.returnT >= 1) {
      this.returning = false;
      this.group.position.copy(this.to);
      return true;
    }
    return false;
  }

  dispose(): void {
    this.shellGeo.dispose();
    this.holeGeo.dispose();
    this.logoGeo.dispose();
    this.material.dispose();
    this.holeMat.dispose();
    this.logoMap.dispose();
    (this.logo.material as THREE.Material).dispose();
  }
}
