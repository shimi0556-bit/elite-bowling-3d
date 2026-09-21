function storageGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

export class Soundscape {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private rollGain: GainNode | null = null;
  private rollFilter: BiquadFilterNode | null = null;
  private rollSource: AudioBufferSourceNode | null = null;
  private noise: AudioBuffer | null = null;
  muted = storageGet('elite-bowling-muted') === '1';

  private ensure(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    if (!this.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      master.gain.value = this.muted ? 0 : 0.85;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.knee.value = 12;
      compressor.ratio.value = 3.2;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;
      master.connect(compressor);
      compressor.connect(ctx.destination);
      this.ctx = ctx;
      this.master = master;
      this.noise = this.makeNoise(1.4);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  resume(): void {
    this.ensure();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    storageSet('elite-bowling-muted', this.muted ? '1' : '0');
    if (this.master && this.ctx) {
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.85, now + 0.05);
    }
    return this.muted;
  }

  click(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  whoosh(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.18);
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    src.stop(ctx.currentTime + 0.3);
  }

  setRolling(speed: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noise) return;
    if (!this.rollSource) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start();
      this.rollSource = src;
      this.rollFilter = filter;
      this.rollGain = gain;
    }
    const now = ctx.currentTime;
    const amount = Math.max(0, Math.min(1, speed / 10));
    this.rollGain?.gain.setTargetAtTime(amount * 0.11, now, 0.05);
    this.rollFilter?.frequency.setTargetAtTime(140 + amount * 420, now, 0.05);
  }

  stopRoll(): void {
    if (!this.ctx || !this.rollGain) return;
    this.rollGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.06);
  }

  pin(magnitude: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || !this.noise) return;
    const strength = Math.max(0.15, Math.min(1, magnitude / 180));
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 280 + strength * 900;
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18 * strength, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16 + strength * 0.08);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
    src.stop(ctx.currentTime + 0.28);

    const clack = ctx.createOscillator();
    const clackGain = ctx.createGain();
    clack.type = 'triangle';
    clack.frequency.setValueAtTime(180 + strength * 90, ctx.currentTime);
    clack.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.08);
    clackGain.gain.setValueAtTime(0.08 * strength, ctx.currentTime);
    clackGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);
    clack.connect(clackGain);
    clackGain.connect(this.master);
    clack.start();
    clack.stop(ctx.currentTime + 0.12);
  }

  strike(): void {
    this.chime([523.25, 659.25, 783.99, 1046.5], 0.16, 0.9);
  }

  spare(): void {
    this.chime([440, 554.37, 659.25], 0.1, 0.55);
  }

  gutter(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.28);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.34);
  }

  dispose(): void {
    this.rollSource?.stop();
    void this.ctx?.close();
    this.ctx = null;
  }

  private chime(notes: number[], gainValue: number, spread: number): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = index === notes.length - 1 ? 'sine' : 'triangle';
      const start = ctx.currentTime + index * 0.07;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gainValue * (1 - index * 0.12), start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + spread);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(start);
      osc.stop(start + spread + 0.05);
    });
  }

  private makeNoise(seconds: number): AudioBuffer | null {
    const ctx = this.ctx;
    if (!ctx) return null;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 3.2;
    }
    return buffer;
  }
}
