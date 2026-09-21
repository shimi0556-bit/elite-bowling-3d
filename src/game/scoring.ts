export interface FrameView {
  marks: string[];
  cumulative: number | null;
}

export interface ScoreView {
  frames: FrameView[];
  total: number;
  gameOver: boolean;
}

export function isFrameComplete(frameIndex: number, rolls: readonly number[]): boolean {
  if (frameIndex < 9) return rolls[0] === 10 || rolls.length >= 2;
  if (rolls[0] === 10) return rolls.length >= 3;
  if (rolls.length >= 2 && rolls[0] + rolls[1] === 10) return rolls.length >= 3;
  return rolls.length >= 2;
}

/** Tenth-frame fill ball gets a fresh rack. */
export function needsFreshRack(frameIndex: number, rolls: readonly number[]): boolean {
  if (frameIndex !== 9 || isFrameComplete(frameIndex, rolls)) return false;
  if (rolls.length === 1 && rolls[0] === 10) return true;
  if (rolls.length === 2 && (rolls[0] === 10 || rolls[0] + rolls[1] === 10)) return true;
  return false;
}

function marksForOpen(rolls: readonly number[]): string[] {
  if (rolls.length === 0) return ['', ''];
  if (rolls[0] === 10) return ['', 'X'];
  const first = rolls[0] === 0 ? '–' : String(rolls[0]);
  if (rolls.length < 2) return [first, ''];
  if (rolls[0] + rolls[1] === 10) return [first, '/'];
  const second = rolls[1] === 0 ? '–' : String(rolls[1]);
  return [first, second];
}

function marksForTenth(rolls: readonly number[]): string[] {
  const marks = ['', '', ''];
  let standing = 10;
  let fresh = true;
  for (let i = 0; i < rolls.length && i < 3; i++) {
    const pins = rolls[i] ?? 0;
    if (fresh && pins === 10) {
      marks[i] = 'X';
      standing = 10;
      fresh = true;
    } else if (pins === standing) {
      marks[i] = '/';
      standing = 10;
      fresh = true;
    } else {
      marks[i] = pins === 0 ? '–' : String(pins);
      standing -= pins;
      fresh = false;
    }
  }
  return marks;
}

function rollsAfter(frames: readonly (readonly number[])[], index: number): number[] {
  const out: number[] = [];
  for (let i = index + 1; i < frames.length; i++) {
    const frame = frames[i];
    if (frame) out.push(...frame);
  }
  return out;
}

function frameTotal(frames: readonly (readonly number[])[], index: number): number | null {
  const rolls = frames[index];
  if (!rolls || rolls.length === 0) return null;
  if (index < 9) {
    const upcoming = rollsAfter(frames, index);
    if (rolls[0] === 10) {
      if (upcoming.length < 2) return null;
      return 10 + (upcoming[0] ?? 0) + (upcoming[1] ?? 0);
    }
    if (rolls.length < 2) return null;
    if ((rolls[0] ?? 0) + (rolls[1] ?? 0) === 10) {
      if (upcoming.length < 1) return null;
      return 10 + (upcoming[0] ?? 0);
    }
    return (rolls[0] ?? 0) + (rolls[1] ?? 0);
  }
  if (!isFrameComplete(9, rolls)) return null;
  return rolls.reduce((sum, roll) => sum + roll, 0);
}

export function scoreGame(frames: readonly (readonly number[])[]): ScoreView {
  const view: FrameView[] = [];
  let total = 0;
  for (let i = 0; i < 10; i++) {
    const rolls = frames[i] ?? [];
    const scored = frameTotal(frames, i);
    if (scored !== null) total += scored;
    view.push({
      marks: i === 9 ? marksForTenth(rolls) : marksForOpen(rolls),
      cumulative: scored === null ? null : total,
    });
  }
  const last = frames[9] ?? [];
  return {
    frames: view,
    total,
    gameOver: isFrameComplete(9, last),
  };
}

export function gradeKey(total: number): 'perfect' | 'great' | 'good' | 'solid' | 'again' {
  if (total >= 300) return 'perfect';
  if (total >= 200) return 'great';
  if (total >= 150) return 'good';
  if (total >= 100) return 'solid';
  return 'again';
}
