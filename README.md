# באולינג עלית · Elite Bowling

משחק באולינג תלת־ממדי בדפדפן: מסלול עץ עם שמן, פינים יציבים, ניקוד מלא של עשרה פריימים, ועברית לצד אנגלית. אין שרת — אתר סטטי.

A premium browser 3D bowling lane: varnished wood and oil, stable pin physics, full ten-frame scoring, and a Hebrew / English HUD. No backend — static files only.

## הרצה · Run

```bash
npm i
npm run dev
```

ואז לפתוח את הכתובת ש־Vite מדפיס (בדרך כלל `http://localhost:5173`).

Then open the URL Vite prints (usually `http://localhost:5173`).

```bash
npm test
npm run build
npm run preview
```

`npm run build` בודק TypeScript וכותב את האתר לתיקייה `dist`.

`npm run build` typechecks and writes the site to `dist`.

## שליטה · Controls

| פעולה · Action | עכבר / מגע · Pointer | מקלדת · Keyboard |
| --- | --- | --- |
| מיקום הכדור · Place the ball | הזזה ימינה ושמאלה · Move left / right | `A` / `D` |
| עוצמה · Power | גרירה לאחור (או קדימה) ושחרור · Drag back or forward, then release | החזקת `Space` ושחרור · Hold `Space`, release |
| סיבוב · Hook | סטייה לצדדים בזמן הגרירה · Sideways drift while dragging | `Q` / `E` |
| כיוון עדין · Fine aim | — | חצים למעלה / למטה · Arrow up / down |
| השתקה · Mute | כפתור · Button | `M` |
| שידור חוזר · Replay last shot | כפתור · Button | `R` |
| משחק חדש · New game | כפתור · Button | `N` |
| עזרה · Help | כפתור · Button | `H` |
| שפה · Language | כפתור · Button | `L` |

הטבעת על המסלול מראה לאן הכדור צפוי להיכנס. סיבוב חיובי (גרירה ימינה) מעקם לימין של השחקן. השמן בחלק הראשון של המסלול חלק; הסיבוב תופס לקראת הפינים. זריקה חזקה מדי מחליקה ומספיקה פחות להתעקל.

The ring on the lane is the predicted entry point. A positive hook (drag right) bends to the bowler's right. The heads are oily and the ball skids; the hook grabs in the dry backend. A harder ball has less time to curve.

קו העבירה מסומן בתחילת המסלול. הכדור תמיד משוחרר מאחוריו. כדור שנופל לתעלה לפני הפינים נחשב 0.

The foul line is marked at the start of the lane. The ball is always released behind it. A ball that drops into the gutter before the pins scores 0.

ניקוד: סטרייק = 10 ועוד שתי הזריקות הבאות, ספייר = 10 ועוד הזריקה הבאה, פריים פתוח = סכום שתי הזריקות. בפריים העשירי יש זריקת מילוי אחרי סטרייק או ספייר.

Scoring: strike = 10 plus the next two rolls, spare = 10 plus the next roll, open frame = the sum of two rolls. The tenth frame awards a fill ball after a strike or spare.

## פיזיקה וגרפיקה · Physics and picture

- [Rapier](https://rapier.rs/) (`@dimforge/rapier3d-compat`) בצעדים קבועים. הפינים נעולים עד שהכדור מתקרב, כדי שלא ירעדו, ואז נופלים כגופים דינמיים.
- המסלול, הכדור והפינים בנויים מגיאומטריה וחומרים (עץ, לכה, כדור מבריק, פסי אדום על הפינים) — בלי תיבות אפורות.
- בלום עדין ווינייט במחשב. אם הקצב יורד מתחת ל־50fps, הבלום נכבה, הרזולוציה יורדת, והרינדור עובר למעבר ישיר.
- הסאונד מסונתז ב־Web Audio (גלגול, פגיעת פין, סטרייק, ספייר, תעלה, קליק). אין קבצי מדיה חיצוניים.

- [Rapier](https://rapier.rs/) (`@dimforge/rapier3d-compat`) runs on a fixed step. Pins stay locked until the ball arrives so the rack does not shiver, then fall as dynamic bodies.
- Lane, ball, and pins are modeled geometry with materials (varnish, a polished ball, red neck stripes) — not placeholder boxes.
- Desktop gets a light bloom and vignette. If the frame rate drops under 50fps, bloom turns off, the pixel ratio drops, and rendering falls back to a direct pass.
- Sound is synthesized with the Web Audio API (roll, pin hit, strike, spare, gutter, UI click). No external media files.

## GitHub Pages

הזרימה ב־`.github/workflows/pages.yml` רצה על `main`: בדיקות, בנייה עם `GITHUB_PAGES=true` (ה־`base` הוא `/elite-bowling-3d/`), ופריסה ל־Pages.

צריך לאפשר Pages מהגדרות הריפו: **Settings → Pages → Build and deployment → GitHub Actions**.

אחרי מיזוג ל־`main` האתר אמור לעלות בכתובת:

`https://<user>.github.io/elite-bowling-3d/`

The workflow in `.github/workflows/pages.yml` runs on `main`: tests, a build with `GITHUB_PAGES=true` (`base` is `/elite-bowling-3d/`), and a Pages deploy.

Enable Pages in the repo: **Settings → Pages → Build and deployment → GitHub Actions**.

After a merge to `main` the site should be at:

`https://<user>.github.io/elite-bowling-3d/`

לפריסה במקום אחר (נתיב שורש) בנו בלי המשתנה `GITHUB_PAGES`, כדי שה־`base` יישאר `/`.

For a host served from the domain root, build without `GITHUB_PAGES` so `base` stays `/`.
