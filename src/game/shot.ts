import {
  BALL_LINEAR_DAMPING,
  BALL_START_Z,
  FOUL_Z,
  HEAD_PIN_Z,
  HOOK_ACCEL,
  LANE_HALF,
  MAX_SPEED,
  MIN_SPEED,
  PHYSICS_DT,
  clamp01,
  smoothstep,
} from './constants';

export interface ShotParams {
  x: number;
  aim: number;
  power: number;
  hook: number;
}

export interface ShotPoint {
  x: number;
  z: number;
  gutter: boolean;
}

/**
 * Oil lives on the heads of the lane; grip rises through the backend
 * so hook shows up late, the way a real breakpoint does.
 * `hook` > 0 curves to the bowler's right (+X).
 */
export function laneGrip(z: number): number {
  const span = HEAD_PIN_Z - FOUL_Z;
  const t = (z - FOUL_Z) / span;
  if (t <= 0.55) return 0.06;
  if (t >= 0.84) return 1;
  return 0.06 + 0.94 * smoothstep((t - 0.55) / (0.84 - 0.55));
}

export function shotSpeed(power: number): number {
  return MIN_SPEED + clamp01(power) * (MAX_SPEED - MIN_SPEED);
}

/** Kinematic preview shared with the force applied in the physics step. */
export function integrateShot(shot: ShotParams): ShotPoint[] {
  const speed = shotSpeed(shot.power);
  let x = shot.x;
  let z = BALL_START_Z;
  let vx = Math.sin(shot.aim) * speed;
  let vz = Math.cos(shot.aim) * speed;
  const points: ShotPoint[] = [];
  const gutterAt = LANE_HALF - 0.03;

  for (let i = 0; i < 780; i++) {
    const grip = z >= FOUL_Z ? laneGrip(z) : 0.02;
    vx += shot.hook * HOOK_ACCEL * grip * PHYSICS_DT;
    const drag = 1 / (1 + BALL_LINEAR_DAMPING * PHYSICS_DT);
    vx *= drag;
    vz *= drag;
    x += vx * PHYSICS_DT;
    z += vz * PHYSICS_DT;
    if (i % 3 === 0) points.push({ x, z, gutter: false });
    if (z > FOUL_Z && Math.abs(x) > gutterAt) {
      points.push({ x, z, gutter: true });
      break;
    }
    if (z > HEAD_PIN_Z + 0.2 || vz < 0.3) break;
  }
  return points;
}
