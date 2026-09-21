import { describe, expect, it } from 'vitest';
import { isFrameComplete, needsFreshRack, scoreGame } from './scoring';

describe('bowling score', () => {
  it('scores a perfect game as 300', () => {
    const frames = Array.from({ length: 9 }, () => [10]);
    frames.push([10, 10, 10]);
    const view = scoreGame(frames);
    expect(view.gameOver).toBe(true);
    expect(view.total).toBe(300);
    expect(view.frames[0]?.cumulative).toBe(30);
    expect(view.frames[9]?.marks).toEqual(['X', 'X', 'X']);
    expect(view.frames[9]?.cumulative).toBe(300);
  });

  it('scores all gutters as 0', () => {
    const frames = Array.from({ length: 10 }, () => [0, 0]);
    const view = scoreGame(frames);
    expect(view.total).toBe(0);
    expect(view.frames[0]?.marks).toEqual(['–', '–']);
    expect(view.frames[9]?.cumulative).toBe(0);
  });

  it('waits to print a strike until the bonus balls exist', () => {
    const view = scoreGame([[10], [], [], [], [], [], [], [], [], []]);
    expect(view.frames[0]?.cumulative).toBeNull();
    expect(view.total).toBe(0);
    expect(view.gameOver).toBe(false);
  });

  it('scores a mixed game with spares, strikes, and a tenth-frame fill', () => {
    const frames = [
      [8, 1],
      [10],
      [9, 1],
      [0, 5],
      [10],
      [10],
      [10],
      [2, 3],
      [10],
      [7, 3, 8],
    ];
    const view = scoreGame(frames);
    expect(view.frames.map((frame) => frame.cumulative)).toEqual([
      9, 29, 39, 44, 74, 96, 111, 116, 136, 154,
    ]);
    expect(view.total).toBe(154);
    expect(view.frames[1]?.marks).toEqual(['', 'X']);
    expect(view.frames[2]?.marks).toEqual(['9', '/']);
    expect(view.frames[3]?.marks).toEqual(['–', '5']);
    expect(view.frames[9]?.marks).toEqual(['7', '/', '8']);
  });

  it('marks a tenth-frame spare and a fresh fill ball', () => {
    const frames = Array.from({ length: 9 }, () => [0, 0]);
    frames.push([10, 0, 8]);
    const view = scoreGame(frames);
    expect(view.frames[9]?.marks).toEqual(['X', '–', '8']);
    expect(view.frames[9]?.cumulative).toBe(18);
    expect(isFrameComplete(9, [10])).toBe(false);
    expect(needsFreshRack(9, [10])).toBe(true);
    expect(needsFreshRack(9, [7, 3])).toBe(true);
    expect(needsFreshRack(9, [7, 2])).toBe(false);
    expect(needsFreshRack(0, [10])).toBe(false);
  });

  it('scores all 5-spares plus a fill as 150', () => {
    const frames = Array.from({ length: 9 }, () => [5, 5]);
    frames.push([5, 5, 5]);
    expect(scoreGame(frames).total).toBe(150);
  });
});
