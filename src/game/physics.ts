import RAPIER from '@dimforge/rapier3d-compat';
import type { Collider, RigidBody, World } from '@dimforge/rapier3d-compat';
import {
  ARM_Z,
  BACK_Z,
  BALL_LINEAR_DAMPING,
  BALL_MASS,
  BALL_RADIUS,
  BALL_START_Z,
  FOUL_Z,
  GUTTER_DROP,
  GUTTER_OUTER,
  HEAD_PIN_Z,
  HOOK_ACCEL,
  LANE_HALF,
  PIN_CENTER_Y,
  PIN_MASS,
  PIT_Z,
  PHYSICS_DT,
  pinPositions,
} from './constants';
import { laneGrip, shotSpeed, type ShotParams } from './shot';

const GROUP_LANE = 0x0001;
const GROUP_GUTTER = 0x0002;
const GROUP_PIN = 0x0004;
const GROUP_BALL = 0x0008;
const GROUP_WALL = 0x0010;

const FALL_UP_Y = Math.cos((22 * Math.PI) / 180);

export interface ImpactEvent {
  x: number;
  y: number;
  z: number;
  mag: number;
  ball: boolean;
}

export interface PinPose {
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

export interface RackSnapshot {
  standing: boolean[];
  poses: PinPose[];
}

interface PinBody {
  body: RigidBody;
  collider: Collider;
  neck: Collider;
}

function groups(member: number, filter: number): number {
  return (member << 16) | filter;
}

function upY(q: { x: number; y: number; z: number; w: number }): number {
  return 1 - 2 * (q.x * q.x + q.z * q.z);
}

/**
 * Fixed-step Rapier world. Pins stay kinematic until the ball arrives so the
 * rack does not jitter, then go dynamic for the collision.
 */
export class BowlingPhysics {
  private world!: World;
  private queue!: RAPIER.EventQueue;
  private ball!: RigidBody;
  private ballCollider!: Collider;
  private pins: PinBody[] = [];
  private layout = pinPositions();
  private accumulator = 0;
  private tmp = { x: 0, y: 0, z: 0 };
  private tmp2 = { x: 0, y: 0, z: 0 };
  private tmpQ = { x: 0, y: 0, z: 0, w: 1 };
  private impactKeyAt = new Map<string, number>();
  private simClock = 0;

  ballPose: PinPose = { x: 0, y: BALL_RADIUS, z: BALL_START_Z, qx: 0, qy: 0, qz: 0, qw: 1 };
  ballPrev: PinPose = { ...this.ballPose };
  pinPoses: PinPose[] = [];
  pinPrev: PinPose[] = [];
  standing: boolean[] = Array.from({ length: 10 }, () => true);
  ballLive = false;
  gutterEarly = false;
  hitPin = false;
  settled = false;
  peakPinY = 0;
  peakPinSpeed = 0;
  lastShot: ShotParams | null = null;
  preLaunch: RackSnapshot | null = null;
  impacts: ImpactEvent[] = [];
  alpha = 1;

  private hook = 0;
  private armed = false;
  private liveTime = 0;
  private stillTime = 0;
  private ballStill = 0;

  private readonly ballNormal = groups(GROUP_BALL, GROUP_LANE | GROUP_GUTTER | GROUP_PIN | GROUP_WALL);
  private readonly ballGutter = groups(GROUP_BALL, GROUP_GUTTER | GROUP_WALL);

  async init(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -10.4, z: 0 });
    this.world.timestep = PHYSICS_DT;
    this.world.numSolverIterations = 10;
    this.world.integrationParameters.numInternalPgsIterations = 2;
    this.world.integrationParameters.maxCcdSubsteps = 2;
    this.queue = new RAPIER.EventQueue(true);
    this.buildStatics();
    this.buildBall();
    this.buildPins();
    this.resetRack();
    this.address(0);
  }

  destroy(): void {
    this.queue?.free();
    this.world?.free();
  }

  private buildStatics(): void {
    const laneStart = -0.35;
    const laneEnd = PIT_Z - 0.02;
    const laneCenter = (laneStart + laneEnd) / 2;
    const laneHalf = (laneEnd - laneStart) / 2;
    this.fixedBox(LANE_HALF, 0.1, laneHalf, 0, -0.1, laneCenter, GROUP_LANE, 0.02, 0);

    const gutterStart = -0.35;
    const gutterEnd = BACK_Z - 0.2;
    const gutterCenter = (gutterStart + gutterEnd) / 2;
    const gutterHalf = (gutterEnd - gutterStart) / 2;
    const gutterInner = LANE_HALF - 0.02;
    const gutterHalfX = (GUTTER_OUTER - gutterInner) / 2;
    const gutterCenterX = gutterInner + gutterHalfX;
    const gutterY = -GUTTER_DROP - 0.05;
    this.fixedBox(gutterHalfX, 0.05, gutterHalf, -gutterCenterX, gutterY, gutterCenter, GROUP_GUTTER, 0.35, 0.02);
    this.fixedBox(gutterHalfX, 0.05, gutterHalf, gutterCenterX, gutterY, gutterCenter, GROUP_GUTTER, 0.35, 0.02);

    this.fixedBox(0.05, 0.45, gutterHalf, -1.16, 0.28, gutterCenter, GROUP_WALL, 0.4, 0.05);
    this.fixedBox(0.05, 0.45, gutterHalf, 1.16, 0.28, gutterCenter, GROUP_WALL, 0.4, 0.05);

    const kickZ0 = HEAD_PIN_Z - 0.25;
    const kickZ1 = HEAD_PIN_Z + 1.35;
    const kickCenter = (kickZ0 + kickZ1) / 2;
    const kickHalf = (kickZ1 - kickZ0) / 2;
    this.fixedBox(0.07, 0.3, kickHalf, -0.62, 0.3, kickCenter, GROUP_WALL, 0.45, 0.2);
    this.fixedBox(0.07, 0.3, kickHalf, 0.62, 0.3, kickCenter, GROUP_WALL, 0.45, 0.2);

    const pitCenter = (PIT_Z + BACK_Z) / 2;
    const pitHalf = (BACK_Z - PIT_Z) / 2;
    this.fixedBox(1.12, 0.08, pitHalf, 0, -0.5, pitCenter, GROUP_GUTTER, 0.5, 0.05);
    this.fixedBox(1.16, 0.5, 0.08, 0, 0.15, BACK_Z, GROUP_WALL, 0.4, 0.15);
    this.fixedBox(LANE_HALF, 0.25, 0.06, 0, 0.25, -1.2, GROUP_WALL, 0.4, 0.02);
  }

  private fixedBox(
    hx: number,
    hy: number,
    hz: number,
    x: number,
    y: number,
    z: number,
    member: number,
    friction: number,
    restitution: number,
  ): void {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    const desc = RAPIER.ColliderDesc.cuboid(hx, hy, hz)
      .setFriction(friction)
      .setRestitution(restitution)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Average)
      .setCollisionGroups(groups(member, GROUP_BALL | GROUP_PIN));
    this.world.createCollider(desc, body);
  }

  private buildBall(): void {
    const desc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(0, BALL_RADIUS + 0.004, BALL_START_Z)
      .setCanSleep(false)
      .setCcdEnabled(true)
      .setSoftCcdPrediction(0.08)
      .setLinearDamping(BALL_LINEAR_DAMPING)
      .setAngularDamping(0.08);
    this.ball = this.world.createRigidBody(desc);
    const volume = (4 / 3) * Math.PI * BALL_RADIUS ** 3;
    const collider = RAPIER.ColliderDesc.ball(BALL_RADIUS)
      .setDensity(BALL_MASS / volume)
      .setFriction(0.025)
      .setRestitution(0.02)
      .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Min)
      .setCollisionGroups(this.ballNormal)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
      .setContactForceEventThreshold(18);
    this.ballCollider = this.world.createCollider(collider, this.ball);
  }

  private buildPins(): void {
    const bellyVolume = Math.PI * 0.058 ** 2 * 0.25;
    const neckVolume = Math.PI * 0.032 ** 2 * 0.14;
    const bellyMass = PIN_MASS * 0.82;
    const neckMass = PIN_MASS * 0.18;
    for (let i = 0; i < 10; i++) {
      const spot = this.layout[i] ?? { x: 0, z: HEAD_PIN_Z };
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(spot.x, PIN_CENTER_Y, spot.z)
          .setLinearDamping(0.09)
          .setAngularDamping(0.12)
          .setCanSleep(true),
      );
      const shared = {
        friction: 0.62,
        restitution: 0.33,
      };
      const belly = this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(0.125, 0.058)
          .setTranslation(0, -0.062, 0)
          .setDensity(bellyMass / bellyVolume)
          .setFriction(shared.friction)
          .setRestitution(shared.restitution)
          .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Average)
          .setRestitutionCombineRule(RAPIER.CoefficientCombineRule.Average)
          .setCollisionGroups(groups(GROUP_PIN, GROUP_LANE | GROUP_GUTTER | GROUP_PIN | GROUP_BALL | GROUP_WALL))
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS | RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
          .setContactForceEventThreshold(16),
        body,
      );
      const neck = this.world.createCollider(
        RAPIER.ColliderDesc.cylinder(0.07, 0.032)
          .setTranslation(0, 0.105, 0)
          .setDensity(neckMass / neckVolume)
          .setFriction(shared.friction)
          .setRestitution(shared.restitution)
          .setCollisionGroups(groups(GROUP_PIN, GROUP_LANE | GROUP_GUTTER | GROUP_PIN | GROUP_BALL | GROUP_WALL)),
        body,
      );
      this.pins.push({ body, collider: belly, neck });
      const pose = this.identityPose(spot.x, spot.z);
      this.pinPoses.push({ ...pose });
      this.pinPrev.push({ ...pose });
    }
  }

  private identityPose(x: number, z: number): PinPose {
    return { x, y: PIN_CENTER_Y, z, qx: 0, qy: 0, qz: 0, qw: 1 };
  }

  resetRack(): void {
    this.standing = Array.from({ length: 10 }, () => true);
    this.armed = false;
    this.ballLive = false;
    this.settled = false;
    this.gutterEarly = false;
    this.hitPin = false;
    for (let i = 0; i < 10; i++) {
      const spot = this.layout[i] ?? { x: 0, z: HEAD_PIN_Z };
      this.placePin(i, this.identityPose(spot.x, spot.z), true);
    }
    this.snapPinPoses();
  }

  address(x: number): void {
    if (this.ballLive) return;
    const pose = { x, y: BALL_RADIUS + 0.004, z: BALL_START_Z };
    this.ball.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    this.ball.setTranslation(pose, true);
    this.ball.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
    this.ball.setNextKinematicTranslation(pose);
    this.ball.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 });
    this.ballCollider.setCollisionGroups(this.ballNormal);
    this.writeBall(pose.x, pose.y, pose.z, 0, 0, 0, 1);
    this.ballPrev = { ...this.ballPose };
  }

  launch(shot: ShotParams): void {
    this.lastShot = { x: shot.x, aim: shot.aim, power: shot.power, hook: shot.hook };
    this.preLaunch = this.capture();
    this.hook = shot.hook;
    this.gutterEarly = false;
    this.hitPin = false;
    this.settled = false;
    this.armed = false;
    this.liveTime = 0;
    this.stillTime = 0;
    this.ballStill = 0;
    this.peakPinY = 0;
    this.peakPinSpeed = 0;
    this.impacts = [];
    this.impactKeyAt.clear();
    this.disarm();

    const speed = shotSpeed(shot.power);
    const vx = Math.sin(shot.aim) * speed;
    const vz = Math.cos(shot.aim) * speed;
    const origin = { x: shot.x, y: BALL_RADIUS + 0.004, z: BALL_START_Z };
    this.ball.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.ball.setTranslation(origin, true);
    this.ball.setLinvel({ x: vx, y: 0, z: vz }, true);
    this.ball.setAngvel({ x: vz / BALL_RADIUS, y: shot.hook * 11, z: -vx / BALL_RADIUS }, true);
    this.ballCollider.setCollisionGroups(this.ballNormal);
    this.ballLive = true;
    this.writeBall(origin.x, origin.y, origin.z, 0, 0, 0, 1);
    this.ballPrev = { ...this.ballPose };
  }

  step(frameDt: number): void {
    // Twelve steps is 100ms at 120Hz, so a 10fps frame still plays in real time.
    // Leftover time is dropped so a stalled frame cannot spiral the accumulator.
    this.accumulator += Math.min(Math.max(frameDt, 0), 0.1);
    let substeps = 0;
    const maxSteps = 12;
    while (this.accumulator >= PHYSICS_DT && substeps < maxSteps) {
      this.substep();
      this.accumulator -= PHYSICS_DT;
      substeps++;
    }
    if (substeps === maxSteps) this.accumulator = Math.min(this.accumulator, PHYSICS_DT);
    this.alpha = PHYSICS_DT === 0 ? 1 : this.accumulator / PHYSICS_DT;
    this.copyBall();
    this.copyPins();
  }

  private substep(): void {
    this.simClock += PHYSICS_DT;
    if (this.ballLive && !this.armed) {
      const z = this.ball.translation(this.tmp).z;
      if (z > ARM_Z) this.armPins();
    }
    if (this.ballLive && !this.gutterEarly && !this.hitPin) this.applyHook();
    this.world.step(this.queue);
    this.collectEvents();
    if (this.ballLive) this.checkGutter();
    this.trackPeaks();
    if (this.ballLive) this.updateSettle();
  }

  private applyHook(): void {
    const t = this.ball.translation(this.tmp);
    const y = t.y;
    const z = t.z;
    if (y < 0.02) return;
    const grip = z >= FOUL_Z ? laneGrip(z) : 0.02;
    const mass = this.ball.mass();
    const ax = this.hook * HOOK_ACCEL * grip;
    this.ball.applyImpulse({ x: ax * mass * PHYSICS_DT, y: 0, z: 0 }, true);
    const v = this.ball.linvel(this.tmp2);
    this.ball.setAngvel(
      { x: v.z / BALL_RADIUS, y: this.hook * 11, z: -v.x / BALL_RADIUS },
      true,
    );
  }

  private collectEvents(): void {
    this.queue.drainCollisionEvents((a, b, started) => {
      if (!started) return;
      const pinA = this.pinIndexByCollider(a);
      const pinB = this.pinIndexByCollider(b);
      const ballHit = a === this.ballCollider.handle || b === this.ballCollider.handle;
      if (ballHit && (pinA !== -1 || pinB !== -1)) this.hitPin = true;
    });
    this.queue.drainContactForceEvents((event) => {
      const h1 = event.collider1();
      const h2 = event.collider2();
      const mag = event.maxForceMagnitude();
      if (mag < 22) return;
      const key = h1 < h2 ? `${h1}:${h2}` : `${h2}:${h1}`;
      const last = this.impactKeyAt.get(key) ?? -1;
      if (this.simClock - last < 0.07) return;
      this.impactKeyAt.set(key, this.simClock);
      const pinA = this.pinIndexByCollider(h1);
      const pinB = this.pinIndexByCollider(h2);
      if (pinA === -1 && pinB === -1) return;
      const bodyA = this.world.getCollider(h1).parent();
      const bodyB = this.world.getCollider(h2).parent();
      if (!bodyA || !bodyB) return;
      const pa = bodyA.translation(this.tmp);
      const ax = pa.x;
      const ay = pa.y;
      const az = pa.z;
      const pb = bodyB.translation(this.tmp2);
      const ballHit = h1 === this.ballCollider.handle || h2 === this.ballCollider.handle;
      if (ballHit) this.hitPin = true;
      this.impacts.push({
        x: (ax + pb.x) / 2,
        y: (ay + pb.y) / 2,
        z: (az + pb.z) / 2,
        mag,
        ball: ballHit,
      });
      if (this.impacts.length > 24) this.impacts.shift();
    });
  }

  private pinIndexByCollider(handle: number): number {
    if (handle === this.ballCollider.handle) return -1;
    for (let i = 0; i < this.pins.length; i++) {
      const pin = this.pins[i];
      if (pin && (pin.collider.handle === handle || pin.neck.handle === handle)) return i;
    }
    return -1;
  }

  private checkGutter(): void {
    if (this.gutterEarly || this.hitPin) return;
    const t = this.ball.translation(this.tmp);
    const x = t.x;
    const y = t.y;
    const z = t.z;
    if (y < -0.02 || z <= FOUL_Z || Math.abs(x) <= LANE_HALF - 0.03 || z > HEAD_PIN_Z - 0.15) return;
    this.gutterEarly = true;
    this.ballCollider.setCollisionGroups(this.ballGutter);
    const v = this.ball.linvel(this.tmp2);
    const side = x >= 0 ? 1 : -1;
    this.ball.setLinvel({ x: side * 1.8, y: -0.8, z: Math.max(2.4, v.z * 0.92) }, true);
  }

  private trackPeaks(): void {
    for (let i = 0; i < this.pins.length; i++) {
      if (!this.standing[i]) continue;
      const pin = this.pins[i];
      if (!pin) continue;
      const t = pin.body.translation(this.tmp);
      if (t.y > this.peakPinY) this.peakPinY = t.y;
      const v = pin.body.linvel(this.tmp2);
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed > this.peakPinSpeed) this.peakPinSpeed = speed;
    }
  }

  private updateSettle(): void {
    this.liveTime += PHYSICS_DT;
    const t = this.ball.translation(this.tmp);
    const y = t.y;
    const z = t.z;
    const v = this.ball.linvel(this.tmp2);
    const speed = Math.hypot(v.x, v.y, v.z);
    const offDeck = y < -0.03 || z > HEAD_PIN_Z + 2.4;
    const resting = speed < 0.45 && offDeck;
    if (resting) this.ballStill += PHYSICS_DT;
    else this.ballStill = 0;
    if (resting && this.pinsQuiet()) this.stillTime += PHYSICS_DT;
    else this.stillTime = 0;
    const pinsSettled = this.stillTime > 0.32 && this.liveTime > 0.6;
    const ballRested = this.ballStill > 0.85 && this.liveTime > 1.15;
    if (pinsSettled || ballRested || this.liveTime > 5.5) this.settled = true;
  }

  private pinsQuiet(): boolean {
    if (!this.armed) return true;
    for (let i = 0; i < this.pins.length; i++) {
      if (!this.standing[i]) continue;
      const pin = this.pins[i];
      if (!pin) continue;
      const v = pin.body.linvel(this.tmp);
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed > 0.12) return false;
      const w = pin.body.angvel(this.tmp2);
      if (Math.hypot(w.x, w.y, w.z) > 0.35) return false;
    }
    return true;
  }

  consumeImpacts(): ImpactEvent[] {
    const batch = this.impacts;
    this.impacts = [];
    return batch;
  }

  countFallen(): number {
    let count = 0;
    for (let i = 0; i < 10; i++) if (this.standing[i] && this.poseFallen(i)) count++;
    return count;
  }

  /** Apply fallen pins to the standing mask. Returns how many fell this roll. */
  consumeKnocked(): { knocked: number; cleared: boolean } {
    let before = 0;
    let knocked = 0;
    for (let i = 0; i < 10; i++) {
      if (!this.standing[i]) continue;
      before++;
      if (this.poseFallen(i)) {
        this.standing[i] = false;
        knocked++;
      }
    }
    return { knocked, cleared: before > 0 && knocked === before };
  }

  private poseFallen(index: number): boolean {
    const pin = this.pins[index];
    if (!pin) return false;
    const t = pin.body.translation(this.tmp);
    const q = pin.body.rotation(this.tmpQ);
    if (t.y < PIN_CENTER_Y - 0.07) return true;
    if (Math.abs(t.x) > LANE_HALF + 0.02) return true;
    if (t.z > PIT_Z - 0.05) return true;
    return upY(q) < FALL_UP_Y;
  }

  freezeStanding(): void {
    for (let i = 0; i < 10; i++) {
      if (!this.standing[i]) continue;
      this.lockPin(i);
    }
    this.armed = false;
  }

  freezeAll(): void {
    for (let i = 0; i < 10; i++) this.lockPin(i);
    this.armed = false;
    this.ballLive = false;
  }

  sweepFallen(): void {
    for (let i = 0; i < 10; i++) {
      if (this.standing[i]) continue;
      const pin = this.pins[i];
      if (!pin) continue;
      pin.collider.setEnabled(false);
      pin.neck.setEnabled(false);
      pin.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
      const buried = { x: 0, y: -3, z: HEAD_PIN_Z };
      pin.body.setTranslation(buried, true);
      pin.body.setNextKinematicTranslation(buried);
    }
  }

  capture(): RackSnapshot {
    return {
      standing: this.standing.slice(),
      poses: this.pins.map((pin) => {
        const t = pin.body.translation(this.tmp);
        const x = t.x;
        const y = t.y;
        const z = t.z;
        const q = pin.body.rotation(this.tmpQ);
        return { x, y, z, qx: q.x, qy: q.y, qz: q.z, qw: q.w };
      }),
    };
  }

  restore(snapshot: RackSnapshot): void {
    this.standing = snapshot.standing.slice();
    this.ballLive = false;
    this.gutterEarly = false;
    this.hitPin = false;
    this.settled = false;
    this.armed = false;
    snapshot.poses.forEach((pose, index) => {
      this.placePin(index, pose, snapshot.standing[index] ?? false);
    });
    this.snapPinPoses();
  }

  ballSpeed(): number {
    if (!this.ballLive) return 0;
    const v = this.ball.linvel(this.tmp);
    return Math.hypot(v.x, v.y, v.z);
  }

  /** Test helper: wake the rack without a ball. */
  armPins(): void {
    if (this.armed) return;
    this.armed = true;
    for (let i = 0; i < 10; i++) {
      if (!this.standing[i]) continue;
      const pin = this.pins[i];
      if (!pin) continue;
      pin.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      pin.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      pin.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      pin.body.wakeUp();
    }
  }

  private disarm(): void {
    this.armed = false;
    for (let i = 0; i < 10; i++) {
      if (!this.standing[i]) continue;
      this.lockPin(i);
    }
  }

  private lockPin(index: number): void {
    const pin = this.pins[index];
    if (!pin) return;
    const t = pin.body.translation(this.tmp);
    const pose = { x: t.x, y: t.y, z: t.z };
    const q = pin.body.rotation(this.tmpQ);
    const rot = { x: q.x, y: q.y, z: q.z, w: q.w };
    pin.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    pin.body.setTranslation(pose, true);
    pin.body.setRotation(rot, true);
    pin.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    pin.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    pin.body.setNextKinematicTranslation(pose);
    pin.body.setNextKinematicRotation(rot);
  }

  private placePin(index: number, pose: PinPose, enabled: boolean): void {
    const pin = this.pins[index];
    if (!pin) return;
    pin.collider.setEnabled(enabled);
    pin.neck.setEnabled(enabled);
    pin.body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, true);
    const translation = { x: pose.x, y: pose.y, z: pose.z };
    const rotation = { x: pose.qx, y: pose.qy, z: pose.qz, w: pose.qw };
    pin.body.setTranslation(translation, true);
    pin.body.setRotation(rotation, true);
    pin.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    pin.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    pin.body.setNextKinematicTranslation(translation);
    pin.body.setNextKinematicRotation(rotation);
    const slot = this.pinPoses[index];
    if (slot) Object.assign(slot, pose);
  }

  private copyBall(): void {
    this.ballPrev = { ...this.ballPose };
    const t = this.ball.translation(this.tmp);
    const x = t.x;
    const y = t.y;
    const z = t.z;
    const q = this.ball.rotation(this.tmpQ);
    this.writeBall(x, y, z, q.x, q.y, q.z, q.w);
  }

  private writeBall(x: number, y: number, z: number, qx: number, qy: number, qz: number, qw: number): void {
    this.ballPose.x = x;
    this.ballPose.y = y;
    this.ballPose.z = z;
    this.ballPose.qx = qx;
    this.ballPose.qy = qy;
    this.ballPose.qz = qz;
    this.ballPose.qw = qw;
  }

  private copyPins(): void {
    for (let i = 0; i < this.pins.length; i++) {
      const prev = this.pinPrev[i];
      const curr = this.pinPoses[i];
      if (prev && curr) Object.assign(prev, curr);
      const pin = this.pins[i];
      if (!pin || !curr) continue;
      const t = pin.body.translation(this.tmp);
      curr.x = t.x;
      curr.y = t.y;
      curr.z = t.z;
      const q = pin.body.rotation(this.tmpQ);
      curr.qx = q.x;
      curr.qy = q.y;
      curr.qz = q.z;
      curr.qw = q.w;
    }
  }

  private snapPinPoses(): void {
    this.copyPins();
    for (let i = 0; i < this.pinPoses.length; i++) {
      const curr = this.pinPoses[i];
      const prev = this.pinPrev[i];
      if (curr && prev) Object.assign(prev, curr);
    }
    this.accumulator = 0;
    this.alpha = 1;
  }
}
