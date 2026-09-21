import * as THREE from 'three';
import { BALL_START_Z, HEAD_PIN_Z } from './constants';

export type CamMode = 'aim' | 'follow' | 'pins';

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private mode: CamMode = 'aim';
  private readonly look = new THREE.Vector3(0, 0.35, 6);
  private readonly desired = new THREE.Vector3();
  private readonly lookTarget = new THREE.Vector3();
  private fovTarget = 34;
  private shake = 0;
  private shakeAmp = 0;
  portrait = false;
  reducedMotion = false;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(34, aspect, 0.08, 80);
    this.camera.position.set(0, 1.55, BALL_START_Z - 2.2);
  }

  setMode(mode: CamMode): void {
    this.mode = mode;
  }

  punch(amount: number): void {
    if (this.reducedMotion) return;
    this.shake = 0.32;
    this.shakeAmp = amount;
  }

  update(dt: number, ball: THREE.Vector3, aimX: number, key: THREE.DirectionalLight): void {
    if (this.mode === 'aim') {
      const y = this.portrait ? 2.15 : 1.5;
      const z = this.portrait ? BALL_START_Z - 2.7 : BALL_START_Z - 2.15;
      this.desired.set(aimX * 0.22, y, z);
      this.lookTarget.set(aimX * 0.08, this.portrait ? 0.15 : 0.28, 8.5);
      this.fovTarget = this.portrait ? 50 : 34;
    } else if (this.mode === 'follow') {
      this.desired.set(ball.x * 0.55, ball.y + (this.portrait ? 1.7 : 1.2), ball.z - (this.portrait ? 2.5 : 2.05));
      this.lookTarget.set(ball.x * 0.35, 0.3, ball.z + 3.6);
      this.fovTarget = this.portrait ? 52 : 40;
    } else {
      this.desired.set(this.portrait ? 0.2 : 1.75, this.portrait ? 2.35 : 1.38, HEAD_PIN_Z + (this.portrait ? 2.4 : 1.65));
      this.lookTarget.set(0, 0.28, HEAD_PIN_Z + 0.35);
      this.fovTarget = this.portrait ? 46 : 32;
    }

    const lambda = this.mode === 'follow' ? 7.5 : 3.1;
    const cam = this.camera;
    cam.position.x = THREE.MathUtils.damp(cam.position.x, this.desired.x, lambda, dt);
    cam.position.y = THREE.MathUtils.damp(cam.position.y, this.desired.y, lambda, dt);
    cam.position.z = THREE.MathUtils.damp(cam.position.z, this.desired.z, lambda, dt);
    const lookLambda = this.mode === 'pins' ? 2.8 : 8;
    this.look.x = THREE.MathUtils.damp(this.look.x, this.lookTarget.x, lookLambda, dt);
    this.look.y = THREE.MathUtils.damp(this.look.y, this.lookTarget.y, lookLambda, dt);
    this.look.z = THREE.MathUtils.damp(this.look.z, this.lookTarget.z, lookLambda, dt);
    cam.lookAt(this.look);

    if (Math.abs(cam.fov - this.fovTarget) > 0.02) {
      cam.fov = THREE.MathUtils.damp(cam.fov, this.fovTarget, 4, dt);
      cam.updateProjectionMatrix();
    }

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const mag = this.shake * this.shakeAmp;
      cam.position.x += Math.sin(this.shake * 90) * mag;
      cam.position.y += Math.cos(this.shake * 70) * mag * 0.55;
    }

    const focusZ = this.mode === 'pins' ? HEAD_PIN_Z + 0.3 : ball.z + 1.4;
    const focusX = this.mode === 'pins' ? 0 : ball.x;
    key.position.set(focusX + 1.1, 7.2, focusZ - 3.2);
    key.target.position.set(focusX, 0, focusZ);
    key.target.updateMatrixWorld();
    key.shadow.camera.updateProjectionMatrix();
  }
}
