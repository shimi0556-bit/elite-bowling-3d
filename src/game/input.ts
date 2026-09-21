import { MAX_BALL_X, clamp } from './constants';
import type { ShotParams } from './shot';

export class AimInput {
  ballX = 0;
  aim = 0;
  hook = 0;
  power = 0;
  dragging = false;
  private enabled = false;
  private readonly keys = new Set<string>();
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private lockedX = 0;
  private charging = false;
  private chargePhase = 0;
  private pending: ShotParams | null = null;
  private readonly powerPx: number;
  private readonly onPointerDown: (event: PointerEvent) => void;
  private readonly onPointerMove: (event: PointerEvent) => void;
  private readonly onPointerUp: (event: PointerEvent) => void;
  private readonly onKeyDown: (event: KeyboardEvent) => void;
  private readonly onKeyUp: (event: KeyboardEvent) => void;
  private readonly onContext: (event: Event) => void;

  constructor(private readonly el: HTMLElement) {
    this.powerPx = window.matchMedia('(pointer: coarse)').matches ? 150 : 200;
    this.onPointerDown = (event) => this.pointerDown(event);
    this.onPointerMove = (event) => this.pointerMove(event);
    this.onPointerUp = (event) => this.pointerUp(event);
    this.onKeyDown = (event) => this.keyDown(event);
    this.onKeyUp = (event) => this.keyUp(event);
    this.onContext = (event) => event.preventDefault();
  }

  attach(): void {
    this.el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.el.addEventListener('contextmenu', this.onContext);
  }

  detach(): void {
    this.el.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.el.removeEventListener('contextmenu', this.onContext);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.dragging = false;
      this.charging = false;
      this.power = 0;
    }
  }

  reset(): void {
    this.ballX = 0;
    this.aim = 0;
    this.hook = 0;
    this.power = 0;
    this.dragging = false;
    this.charging = false;
    this.pending = null;
  }

  update(dt: number): void {
    if (!this.enabled) return;
    const slide = 0.62 * dt;
    if (this.keys.has('a') || this.keys.has('arrowleft')) this.ballX -= slide;
    if (this.keys.has('d') || this.keys.has('arrowright')) this.ballX += slide;
    this.ballX = clamp(this.ballX, -MAX_BALL_X, MAX_BALL_X);
    if (this.keys.has('q')) this.hook -= 0.75 * dt;
    if (this.keys.has('e')) this.hook += 0.75 * dt;
    this.hook = clamp(this.hook, -1, 1);
    if (this.keys.has('arrowup')) this.aim = clamp(this.aim + 0.15 * dt, -0.12, 0.12);
    if (this.keys.has('arrowdown')) this.aim = clamp(this.aim - 0.15 * dt, -0.12, 0.12);
    if (this.charging && !this.dragging) {
      this.chargePhase += dt * 1.45;
      this.power = 0.16 + 0.84 * (0.5 - 0.5 * Math.cos(this.chargePhase));
    }
  }

  takeShot(): ShotParams | null {
    const shot = this.pending;
    this.pending = null;
    return shot;
  }

  private pointerDown(event: PointerEvent): void {
    if (!this.enabled || event.button !== 0) return;
    if (event.target instanceof HTMLElement && event.target.closest('button, .swatch')) return;
    this.dragging = true;
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.lockedX = this.ballX;
    this.el.setPointerCapture?.(event.pointerId);
  }

  private pointerMove(event: PointerEvent): void {
    if (this.dragging && event.pointerId === this.pointerId) {
      const dx = event.clientX - this.startX;
      const dy = event.clientY - this.startY;
      const pull = Math.max(0, dy, -dy * 0.9);
      this.power = clamp(pull / this.powerPx, 0, 1);
      this.hook = clamp(dx / (this.powerPx * 0.78), -1, 1);
      this.ballX = this.lockedX;
      return;
    }
    if (!this.enabled || this.dragging) return;
    const rect = this.el.getBoundingClientRect();
    if (rect.width <= 0) return;
    const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    this.ballX = clamp(nx * (MAX_BALL_X / 0.72), -MAX_BALL_X, MAX_BALL_X);
  }

  private pointerUp(event: PointerEvent): void {
    if (!this.dragging || event.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.pointerId = null;
    if (this.power >= 0.08 && this.enabled) {
      this.pending = { x: this.lockedX, aim: this.aim, power: this.power, hook: this.hook };
    }
    this.power = 0;
  }

  private keyDown(event: KeyboardEvent): void {
    if (event.target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter')) return;
    const key = event.key.toLowerCase();
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(key)) event.preventDefault();
    if (key === ' ' && this.enabled && !event.repeat) {
      this.charging = true;
      this.chargePhase = 0;
    }
    this.keys.add(key);
  }

  private keyUp(event: KeyboardEvent): void {
    const key = event.key.toLowerCase();
    this.keys.delete(key);
    if (key === ' ' && this.charging) {
      this.charging = false;
      if (this.enabled && this.power >= 0.12) {
        this.pending = { x: this.ballX, aim: this.aim, power: this.power, hook: this.hook };
      }
      this.power = 0;
    }
  }
}
