export type Lang = 'he' | 'en';

export interface Copy {
  he: string;
  en: string;
}

export const copy = {
  title: { he: 'באולינג עלית', en: 'Elite Bowling' },
  frame: { he: 'פריים', en: 'Frame' },
  score: { he: 'ניקוד', en: 'Score' },
  power: { he: 'עוצמה', en: 'Power' },
  hook: { he: 'סיבוב', en: 'Hook' },
  mute: { he: 'השתק', en: 'Mute' },
  sound: { he: 'קול', en: 'Sound' },
  help: { he: 'עזרה', en: 'Help' },
  replay: { he: 'שידור', en: 'Replay' },
  newGame: { he: 'משחק חדש', en: 'New game' },
  start: { he: 'בואו נזרוק', en: 'Let’s bowl' },
  loading: { he: 'מכינים את המסלול…', en: 'Oiling the lane…' },
  error: { he: 'לא הצלחנו לפתוח את המשחק בדפדפן הזה.', en: 'This browser could not start the game.' },
  strike: { he: 'סטרייק', en: 'Strike' },
  spare: { he: 'ספייר', en: 'Spare' },
  gutter: { he: 'תעלה', en: 'Gutter' },
  aimHint: { he: 'הזיזו ימינה ושמאלה, ואז גררו לאחור', en: 'Slide to place, drag back to bowl' },
  rollHint: { he: 'הכדור בדרך', en: 'Ball in motion' },
  clearHint: { he: 'מסדרים את הפינים', en: 'Resetting the rack' },
  overHint: { he: 'המשחק נגמר', en: 'Game over' },
  helpLead: {
    he: 'מסלול אחד, עשרה פריימים, וסיבוב שתופס רק כשהשמן נגמר.',
    en: 'One lane, ten frames, and a hook that waits for the dry boards.',
  },
  helpBody: {
    he: 'הזזה ימינה ושמאלה ממקמת את הכדור. גרירה לאחור קובעת עוצמה, וסטייה לצדדים קובעת סיבוב. הטבעת על המסלול מראה לאן הכדור נכנס. זריקה חזקה מחליקה; זריקה מתונה נותנת לסיבוב לתפוס.',
    en: 'Move left and right to place the ball. Drag back for power and sideways for hook. The ring marks the entry point. A firm ball skids; an easier release lets the hook finish.',
  },
  helpKeys: {
    he: 'מקלדת: A/D מיקום, Q/E סיבוב, חיצים לכיוון עדין, החזקת רווח לטעינה. M השתקה, R שידור, N משחק חדש, H עזרה, L שפה.',
    en: 'Keyboard: A/D place, Q/E hook, arrows for aim, hold Space to charge. M mute, R replay, N new game, H help, L language.',
  },
  ball: { he: 'כדור', en: 'Ball' },
  crimson: { he: 'ארגמן', en: 'Crimson' },
  sapphire: { he: 'ספיר', en: 'Sapphire' },
  obsidian: { he: 'אובסידיאן', en: 'Obsidian' },
  perfect: { he: 'משחק מושלם', en: 'Perfect game' },
  great: { he: 'משחק מצוין', en: 'Outstanding' },
  good: { he: 'יפה מאוד', en: 'Well bowled' },
  solid: { he: 'משחק טוב', en: 'Solid game' },
  again: { he: 'עוד סיבוב?', en: 'Another game?' },
  close: { he: 'סגירה', en: 'Close' },
  ballLabel: { he: 'כדור', en: 'Ball' },
} as const satisfies Record<string, Copy>;

export type CopyKey = keyof typeof copy;

export function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota / private mode */
  }
}
