import { BALL_SKINS } from '../game/ball';
import type { ScoreView } from '../game/scoring';
import { copy, storageGet, storageSet, type CopyKey, type Lang } from './i18n';

export type HudAction =
  | 'mute'
  | 'help'
  | 'replay'
  | 'new'
  | 'lang'
  | 'start'
  | 'close-help'
  | `skin:${string}`;

export class Hud {
  readonly canvas: HTMLCanvasElement;
  lang: Lang = storageGet('elite-bowling-lang') === 'en' ? 'en' : 'he';
  private readonly root: HTMLElement;
  private readonly scoreboard: HTMLElement;
  private readonly frames: HTMLElement[] = [];
  private readonly totalEl: HTMLElement;
  private readonly powerFill: HTMLElement;
  private readonly powerNum: HTMLElement;
  private readonly hookNeedle: HTMLElement;
  private readonly hintHe: HTMLElement;
  private readonly hintEn: HTMLElement;
  private readonly toast: HTMLElement;
  private readonly toastHe: HTMLElement;
  private readonly toastEn: HTMLElement;
  private readonly flash: HTMLElement;
  private readonly overlay: HTMLElement;
  private readonly overlayCard: HTMLElement;
  private readonly muteBtn: HTMLButtonElement;
  private readonly replayBtn: HTMLButtonElement;
  private readonly skinRow: HTMLElement;
  private onAction: (action: HudAction) => void = () => {};

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = '';
    root.className = this.lang === 'en' ? 'lang-en' : 'lang-he';

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'lane';
    this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-label', 'Elite Bowling lane');
    root.append(this.canvas);

    const hud = el('div', 'hud');
    const top = el('div', 'top panel');
    const brand = el('div', 'brand bi');
    brand.append(text('span', 'he', copy.title.he), text('span', 'en', copy.title.en));
    const actions = el('div', 'actions');
    this.muteBtn = button('mute', copy.mute);
    const helpBtn = button('help', copy.help);
    this.replayBtn = button('replay', copy.replay);
    const newBtn = button('new', copy.newGame);
    const langBtn = button('lang', { he: 'EN', en: 'עב' });
    actions.append(this.muteBtn, helpBtn, this.replayBtn, newBtn, langBtn);

    this.scoreboard = el('div', 'scoreboard');
    this.scoreboard.setAttribute('role', 'table');
    for (let i = 0; i < 10; i++) {
      const frame = el('div', i === 9 ? 'frame tenth' : 'frame');
      frame.append(text('div', 'frame-num', String(i + 1)));
      const marks = el('div', 'marks');
      const boxes = i === 9 ? 3 : 2;
      for (let m = 0; m < boxes; m++) marks.append(el('span'));
      const running = el('div', 'running');
      frame.append(marks, running);
      this.frames.push(frame);
      this.scoreboard.append(frame);
    }
    const totalBox = el('div', 'total-box');
    const totalLabel = el('div', 'total-label bi');
    totalLabel.append(text('span', 'he', copy.score.he), text('span', 'en', copy.score.en));
    this.totalEl = text('div', 'total-num', '0');
    totalBox.append(totalLabel, this.totalEl);
    this.scoreboard.append(totalBox);

    top.append(brand, this.scoreboard, actions);

    const bottom = el('div', 'bottom');
    const power = el('div', 'meter panel');
    const powerLabel = el('div', 'meter-label bi');
    powerLabel.append(text('span', 'he', copy.power.he), text('span', 'en', copy.power.en));
    const track = el('div', 'power-track');
    this.powerFill = el('div', 'power-fill');
    track.append(this.powerFill);
    this.powerNum = text('div', 'power-num', '0');
    power.append(powerLabel, track, this.powerNum);

    const hint = el('div', 'hint panel');
    this.hintHe = text('div', 'he', copy.aimHint.he);
    this.hintEn = text('div', 'en', copy.aimHint.en);
    this.skinRow = el('div', 'skins');
    this.skinRow.setAttribute('role', 'radiogroup');
    for (const skin of BALL_SKINS) {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = `swatch skin-${skin.id}`;
      swatch.dataset.action = `skin:${skin.id}`;
      const name = skin.id === 'sapphire' ? copy.sapphire : skin.id === 'obsidian' ? copy.obsidian : copy.crimson;
      swatch.setAttribute('aria-label', `${name.he} / ${name.en}`);
      swatch.title = `${name.he} / ${name.en}`;
      this.skinRow.append(swatch);
    }
    hint.append(this.hintHe, this.hintEn, this.skinRow);

    const hook = el('div', 'meter panel hook-meter');
    const hookLabel = el('div', 'meter-label bi');
    hookLabel.append(text('span', 'he', copy.hook.he), text('span', 'en', copy.hook.en));
    const hookTrack = el('div', 'hook-track');
    this.hookNeedle = el('div', 'hook-needle');
    hookTrack.append(el('div', 'hook-center'), this.hookNeedle);
    hook.append(hookLabel, hookTrack);

    bottom.append(power, hint, hook);
    hud.append(top, bottom);
    root.append(hud);

    this.toast = el('div', 'toast');
    this.toast.setAttribute('aria-live', 'polite');
    this.toastHe = text('div', 'toast-he', '');
    this.toastEn = text('div', 'toast-en', '');
    this.toast.append(this.toastHe, this.toastEn);
    this.flash = el('div', 'flash');
    root.append(this.toast, this.flash);

    this.overlay = el('div', 'overlay');
    this.overlayCard = el('div', 'card panel');
    this.overlay.append(this.overlayCard);
    root.append(this.overlay);

    root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-action]') : null;
      if (!(target instanceof HTMLElement)) return;
      const action = target.dataset.action;
      if (!action) return;
      this.onAction(action as HudAction);
    });

    this.showLoading();
    this.setSkin(storageGet('elite-bowling-skin') ?? 'crimson');
  }

  setHandler(handler: (action: HudAction) => void): void {
    this.onAction = handler;
  }

  setMuted(muted: boolean): void {
    const label = muted ? copy.sound : copy.mute;
    setBi(this.muteBtn, label.he, label.en);
    this.muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  }

  setLang(lang: Lang): void {
    this.lang = lang;
    this.root.classList.toggle('lang-en', lang === 'en');
    this.root.classList.toggle('lang-he', lang === 'he');
    document.documentElement.lang = lang === 'he' ? 'he' : 'en';
    storageSet('elite-bowling-lang', lang);
  }

  toggleLang(): void {
    this.setLang(this.lang === 'he' ? 'en' : 'he');
  }

  setScore(view: ScoreView, activeFrame: number): void {
    view.frames.forEach((frame, index) => {
      const node = this.frames[index];
      if (!node) return;
      node.classList.toggle('active', index === activeFrame && !view.gameOver);
      node.classList.toggle('done', frame.cumulative !== null);
      const marks = node.querySelectorAll('.marks span');
      frame.marks.forEach((mark, markIndex) => {
        const cell = marks[markIndex];
        if (cell) cell.textContent = mark;
      });
      const running = node.querySelector('.running');
      if (running) running.textContent = frame.cumulative === null ? '' : String(frame.cumulative);
    });
    this.totalEl.textContent = String(view.total);
    this.scoreboard.setAttribute(
      'aria-label',
      `${copy.score.he} ${view.total}. ${copy.score.en} ${view.total}`,
    );
  }

  setMeters(power: number, hook: number): void {
    this.powerFill.style.height = `${Math.round(power * 100)}%`;
    this.powerNum.textContent = String(Math.round(power * 100));
    this.hookNeedle.style.left = `${((hook + 1) / 2) * 100}%`;
    this.hookNeedle.classList.toggle('hot', Math.abs(hook) > 0.82);
  }

  setHint(key: CopyKey): void {
    const line = copy[key];
    this.hintHe.textContent = line.he;
    this.hintEn.textContent = line.en;
  }

  setReplayEnabled(enabled: boolean): void {
    this.replayBtn.disabled = !enabled;
  }

  setSkin(id: string): void {
    storageSet('elite-bowling-skin', id);
    for (const swatch of this.skinRow.querySelectorAll('button')) {
      const on = swatch.dataset.action === `skin:${id}`;
      swatch.classList.toggle('selected', on);
      swatch.setAttribute('aria-checked', on ? 'true' : 'false');
    }
  }

  toastMark(kind: 'strike' | 'spare' | 'gutter'): void {
    const line = copy[kind];
    this.toastHe.textContent = line.he;
    this.toastEn.textContent = line.en;
    this.toast.className = `toast show ${kind}`;
    this.flash.className = kind === 'gutter' ? 'flash' : 'flash go';
    window.setTimeout(() => {
      this.toast.classList.remove('show');
    }, kind === 'strike' ? 1200 : 900);
  }

  showLoading(): void {
    this.fillOverlay(copy.loading.he, copy.loading.en, null);
    this.overlay.classList.remove('hidden');
  }

  showError(): void {
    this.fillOverlay(copy.error.he, copy.error.en, null);
    this.overlay.classList.remove('hidden');
  }

  showHelp(): void {
    this.overlayCard.replaceChildren();
    this.overlayCard.append(biBlock(copy.title.he, copy.title.en, 'card-title'));
    this.overlayCard.append(biBlock(copy.helpLead.he, copy.helpLead.en, 'card-lead'));
    this.overlayCard.append(biBlock(copy.helpBody.he, copy.helpBody.en, 'card-body'));
    this.overlayCard.append(biBlock(copy.helpKeys.he, copy.helpKeys.en, 'card-keys'));
    const start = button('start', copy.start);
    start.classList.add('btn-primary');
    this.overlayCard.append(start);
    this.overlay.classList.remove('hidden');
    start.focus();
  }

  showGameOver(total: number, he: string, en: string): void {
    this.overlayCard.replaceChildren();
    this.overlayCard.append(biBlock(he, en, 'card-title'));
    const score = text('div', 'final-score', String(total));
    this.overlayCard.append(score);
    const row = el('div', 'card-actions');
    const again = button('new', copy.newGame);
    again.classList.add('btn-primary');
    const replay = button('replay', copy.replay);
    row.append(again, replay);
    this.overlayCard.append(row);
    this.overlay.classList.remove('hidden');
    again.focus();
  }

  hideOverlay(): void {
    this.overlay.classList.add('hidden');
    this.canvas.focus();
  }

  private fillOverlay(he: string, en: string, action: HudAction | null): void {
    this.overlayCard.replaceChildren();
    this.overlayCard.append(biBlock(he, en, 'card-title'));
    if (action) this.overlayCard.append(button(action, copy.start));
  }
}

function el(tag: string, className = ''): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function text(tag: string, className: string, value: string): HTMLElement {
  const node = el(tag, className);
  node.textContent = value;
  return node;
}

function biBlock(he: string, en: string, className: string): HTMLElement {
  const node = el('div', `${className} bi`);
  node.append(text('span', 'he', he), text('span', 'en', en));
  return node;
}

function setBi(buttonEl: HTMLButtonElement, he: string, en: string): void {
  buttonEl.replaceChildren(text('span', 'he', he), text('span', 'en', en));
}

function button(action: string, label: { he: string; en: string }): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'btn bi';
  node.dataset.action = action;
  node.append(text('span', 'he', label.he), text('span', 'en', label.en));
  return node;
}
