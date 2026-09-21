import * as THREE from 'three';
import { PIN_CENTER_Y, pinPositions } from './constants';
import type { BowlingPhysics } from './physics';

export class PinRack {
  readonly group = new THREE.Group();
  private readonly pins: THREE.Group[] = [];
  private readonly drop = new Array<number>(10).fill(-1);
  private lift = 0;
  private readonly geometry: THREE.LatheGeometry;
  private readonly stripeGeo: THREE.TorusGeometry;
  private readonly bodyMat: THREE.MeshPhysicalMaterial;
  private readonly stripeMat: THREE.MeshPhysicalMaterial;

  constructor() {
    const profile = [
      new THREE.Vector2(0.001, -0.19),
      new THREE.Vector2(0.034, -0.19),
      new THREE.Vector2(0.05, -0.155),
      new THREE.Vector2(0.06, -0.08),
      new THREE.Vector2(0.059, 0.0),
      new THREE.Vector2(0.045, 0.055),
      new THREE.Vector2(0.03, 0.1),
      new THREE.Vector2(0.026, 0.125),
      new THREE.Vector2(0.037, 0.158),
      new THREE.Vector2(0.027, 0.182),
      new THREE.Vector2(0.001, 0.191),
    ];
    this.geometry = new THREE.LatheGeometry(profile, 28);
    this.stripeGeo = new THREE.TorusGeometry(0.033, 0.0055, 8, 22);
    this.bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xf6f1e6,
      roughness: 0.32,
      metalness: 0.02,
      clearcoat: 0.65,
      clearcoatRoughness: 0.22,
      envMapIntensity: 0.55,
    });
    this.stripeMat = new THREE.MeshPhysicalMaterial({
      color: 0xb4232c,
      roughness: 0.38,
      metalness: 0.08,
      clearcoat: 0.45,
    });

    const spots = pinPositions();
    for (let i = 0; i < spots.length; i++) {
      const pin = new THREE.Group();
      const body = new THREE.Mesh(this.geometry, this.bodyMat);
      body.castShadow = true;
      body.receiveShadow = true;
      pin.add(body);
      for (const y of [0.09, 0.122]) {
        const stripe = new THREE.Mesh(this.stripeGeo, this.stripeMat);
        stripe.rotation.x = Math.PI / 2;
        stripe.position.y = y;
        stripe.castShadow = true;
        pin.add(stripe);
      }
      const spot = spots[i];
      if (spot) pin.position.set(spot.x, PIN_CENTER_Y, spot.z);
      this.pins.push(pin);
      this.group.add(pin);
    }
  }

  resetDropIn(): void {
    this.lift = 0.55;
    this.drop.fill(-1);
    for (const pin of this.pins) pin.visible = true;
  }

  dropFallen(standing: readonly boolean[]): void {
    standing.forEach((up, index) => {
      if (!up) this.drop[index] = 0;
    });
  }

  sync(physics: BowlingPhysics, dt: number): void {
    this.lift = THREE.MathUtils.damp(this.lift, 0, 7, dt);
    for (let i = 0; i < this.pins.length; i++) {
      const pin = this.pins[i];
      const pose = physics.pinPoses[i];
      if (!pin || !pose) continue;
      const dropping = this.drop[i] ?? -1;
      if (dropping >= 0) {
        const t = dropping + dt;
        this.drop[i] = t;
        pin.visible = true;
        pin.position.y -= dt * 1.35;
        pin.position.z += dt * 0.55;
        pin.rotation.x += dt * 2.2;
        if (t > 0.42) {
          pin.visible = false;
          this.drop[i] = -1;
        }
        continue;
      }
      pin.visible = pose.y > -0.35;
      if (!pin.visible) continue;
      const lift = physics.standing[i] ? this.lift : 0;
      pin.position.set(pose.x, pose.y + lift, pose.z);
      pin.quaternion.set(pose.qx, pose.qy, pose.qz, pose.qw);
    }
  }

  dispose(): void {
    this.geometry.dispose();
    this.stripeGeo.dispose();
    this.bodyMat.dispose();
    this.stripeMat.dispose();
  }
}
