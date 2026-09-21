import { describe, expect, it } from 'vitest';
import { HEAD_PIN_Z, LANE_HALF, MAX_BALL_X } from './constants';
import { integrateShot } from './shot';

describe('shot preview', () => {
  it('keeps a straight ball near the head pin', () => {
    const path = integrateShot({ x: 0, aim: 0, power: 0.8, hook: 0 });
    const end = path[path.length - 1];
    expect(end).toBeDefined();
    expect(Math.abs(end?.x ?? 1)).toBeLessThan(0.05);
    expect(end?.z ?? 0).toBeGreaterThan(HEAD_PIN_Z - 0.5);
    expect(path.some((point) => point.gutter)).toBe(false);
  });

  it('bends a full hook late and can find the gutter from the edge', () => {
    const hooked = integrateShot({ x: 0, aim: 0, power: 0.72, hook: 1 });
    const end = hooked[hooked.length - 1];
    expect(end).toBeDefined();
    expect(end?.x ?? 0).toBeGreaterThan(0.22);
    expect(end?.x ?? 1).toBeLessThan(LANE_HALF + 0.05);

    const gutter = integrateShot({ x: MAX_BALL_X, aim: 0, power: 0.85, hook: 1 });
    expect(gutter.some((point) => point.gutter)).toBe(true);
  });
});
