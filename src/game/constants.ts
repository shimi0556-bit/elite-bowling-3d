/** Meters. Lane geometry follows regulation proportions. */

export const PHYSICS_DT = 1 / 120;

/** Lateral acceleration (m/s²) at full hook once the ball reaches dry boards. */
export const HOOK_ACCEL = 1.55;

export const BALL_LINEAR_DAMPING = 0.02;
export const MIN_SPEED = 6.5;
export const MAX_SPEED = 10.4;

export const BALL_RADIUS = 0.1085;
export const BALL_MASS = 7.0;
export const PIN_MASS = 1.45;
export const PIN_HEIGHT = 0.381;
export const PIN_CENTER_Y = PIN_HEIGHT / 2 + 0.01;
export const PIN_SPACING = 0.3048;

export const LANE_HALF = 0.533;
export const LANE_WIDTH = LANE_HALF * 2;
export const FOUL_Z = 0;
export const HEAD_PIN_Z = 18.288;
export const BALL_START_Z = -0.64;
export const APPROACH_Z0 = -4.5;
export const MAX_BALL_X = LANE_HALF - BALL_RADIUS - 0.055;
export const GUTTER_DROP = 0.085;
export const GUTTER_OUTER = 1.08;
export const PIT_Z = HEAD_PIN_Z + 1.12;
export const BACK_Z = HEAD_PIN_Z + 3.35;

export const ARM_Z = HEAD_PIN_Z - 5.2;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/** 10 pin centers, bowler looking toward +Z. Index 0 is the head pin. */
export function pinPositions(): { x: number; z: number }[] {
  const spacing = PIN_SPACING;
  const rowDepth = spacing * Math.sqrt(3) / 2;
  const rows = [
    [0],
    [-0.5, 0.5],
    [-1, 0, 1],
    [-1.5, -0.5, 0.5, 1.5],
  ];
  const pins: { x: number; z: number }[] = [];
  rows.forEach((row, index) => {
    for (const column of row) {
      pins.push({ x: column * spacing, z: HEAD_PIN_Z + index * rowDepth });
    }
  });
  return pins;
}
