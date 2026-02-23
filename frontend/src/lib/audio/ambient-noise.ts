export type AmbientEffect = "off" | "vinyl-crackle" | "radio-static" | "brown-noise";

class AmbientNoiseEngine {
  private _ctx: AudioContext | null = null;
  private _gain: GainNode | null = null;
  private _source: AudioBufferSourceNode | null = null;
  private _filter: BiquadFilterNode | null = null;
  private _running = false;
  private _effect: AmbientEffect = "vinyl-crackle";
  private _volume = 0.15;

  attachContext(ctx: AudioContext): void {
    if (this._ctx === ctx) return;
    this.stop();
    this._ctx = ctx;
    this._gain = ctx.createGain();
    this._gain.gain.value = this._volume;
    this._gain.connect(ctx.destination);
  }

  setConfig(config: { effect?: AmbientEffect; volume?: number }): void {
    if (config.effect !== undefined) this._effect = config.effect;
    if (config.volume !== undefined) {
      this._volume = config.volume;
      if (this._gain) this._gain.gain.value = this._volume;
    }
    // Restart with new effect if currently running
    if (this._running && config.effect !== undefined) {
      this.stop();
      this.start();
    }
  }

  start(): void {
    if (!this._ctx || !this._gain || this._effect === "off") return;
    this.stopSource();

    const ctx = this._ctx;
    const sampleRate = ctx.sampleRate;
    const duration = 4; // 4-second loop
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    switch (this._effect) {
      case "brown-noise":
        this._buildBrownNoise(data);
        break;
      case "vinyl-crackle":
        this._buildVinylCrackle(data);
        break;
      case "radio-static":
        this._buildRadioStatic(data);
        break;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();

    switch (this._effect) {
      case "brown-noise":
        filter.type = "lowpass";
        filter.frequency.value = 200;
        break;
      case "vinyl-crackle":
        filter.type = "bandpass";
        filter.frequency.value = 800;
        filter.Q.value = 0.5;
        break;
      case "radio-static":
        filter.type = "bandpass";
        filter.frequency.value = 1000;
        filter.Q.value = 2;
        break;
    }

    source.connect(filter);
    filter.connect(this._gain);
    source.start();

    this._source = source;
    this._filter = filter;
    this._running = true;
  }

  stop(): void {
    this.stopSource();
    this._running = false;
  }

  get running(): boolean {
    return this._running;
  }

  private stopSource(): void {
    if (this._source) {
      try {
        this._source.stop();
      } catch {
        // Already stopped
      }
      this._source.disconnect();
      this._source = null;
    }
    if (this._filter) {
      this._filter.disconnect();
      this._filter = null;
    }
  }

  private _buildBrownNoise(data: Float32Array): void {
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5; // Amplify
    }
  }

  private _buildVinylCrackle(data: Float32Array): void {
    for (let i = 0; i < data.length; i++) {
      // Base noise floor
      let sample = (Math.random() * 2 - 1) * 0.03;
      // Random pops/clicks
      if (Math.random() < 0.002) {
        sample += (Math.random() - 0.5) * 0.8;
      }
      // Occasional larger pops
      if (Math.random() < 0.0003) {
        sample += (Math.random() - 0.5) * 1.5;
      }
      data[i] = sample;
    }
  }

  private _buildRadioStatic(data: Float32Array): void {
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
}

export const ambientNoise = new AmbientNoiseEngine();
