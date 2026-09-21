import { afterAll, beforeAll, expect, it } from 'vitest';
import { HEAD_PIN_Z, MAX_BALL_X } from './constants';
import { BowlingPhysics } from './physics';

let phys: BowlingPhysics;

beforeAll(async () => {
  phys = new BowlingPhysics();
  await phys.init();
}, 40000);

afterAll(() => {
  phys.destroy();
});

function rollUntilSettled(maxSteps = 1400): void {
  for (let i = 0; i < maxSteps && !phys.settled; i++) phys.step(1 / 120);
}

it('keeps an armed rack standing', () => {
  phys.resetRack();
  phys.armPins();
  for (let i = 0; i < 200; i++) phys.step(1 / 120);
  expect(phys.countFallen()).toBe(0);
  expect(phys.peakPinSpeed).toBeLessThan(1.25);
  expect(phys.peakPinY).toBeLessThan(0.7);
});

it('knocks pins on a straight hit without launching the rack', () => {
  phys.resetRack();
  phys.launch({ x: 0, aim: 0, power: 0.86, hook: 0 });
  rollUntilSettled();
  const fallen = phys.countFallen();
  expect(phys.settled).toBe(true);
  expect(fallen).toBeGreaterThanOrEqual(1);
  expect(phys.peakPinY).toBeLessThan(1.7);
  expect(phys.peakPinSpeed).toBeLessThan(16);
  expect(phys.ballPose.y).toBeLessThan(1.2);
  expect(phys.ballPose.z).toBeGreaterThan(HEAD_PIN_Z - 2);
});

it('scatters a pocket hit and keeps the simulation bounded', () => {
  phys.resetRack();
  phys.launch({ x: 0.16, aim: 0.004, power: 0.78, hook: -0.72 });
  rollUntilSettled();
  const fallen = phys.countFallen();
  expect(fallen).toBeGreaterThanOrEqual(4);
  expect(phys.gutterEarly).toBe(false);
  expect(phys.peakPinY).toBeLessThan(1.8);
  expect(phys.peakPinSpeed).toBeLessThan(18);
});

it('records an early gutter without touching the rack', () => {
  phys.resetRack();
  phys.launch({ x: MAX_BALL_X, aim: 0, power: 0.9, hook: 1 });
  rollUntilSettled();
  expect(phys.gutterEarly).toBe(true);
  expect(phys.countFallen()).toBe(0);
});
