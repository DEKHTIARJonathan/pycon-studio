/**
 * AudioWorklet processor for radio playback.
 *
 * Holds exclusive ownership of the PCM sample data (transferred via postMessage,
 * not shared with the main thread). This eliminates cross-thread synchronization
 * and keeps the hot read path entirely within the worklet thread's memory.
 */
class RadioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._channels = null;
    this._readPos = 0;
    this._length = 0;
    this._playing = false;

    this.port.onmessage = (e) => {
      switch (e.data.type) {
        case "load":
          this._channels = e.data.channels;
          this._length = e.data.length;
          this._readPos = e.data.startPos || 0;
          this._playing = true;
          break;
        case "pause":
          this._playing = false;
          break;
        case "resume":
          this._playing = true;
          break;
        case "seek":
          this._readPos = e.data.position;
          break;
        case "stop":
          this._playing = false;
          this._channels = null;
          this._readPos = 0;
          this._length = 0;
          break;
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];

    if (!this._playing || !this._channels) {
      for (let ch = 0; ch < output.length; ch++) output[ch].fill(0);
      return true;
    }

    const frames = output[0].length;
    const numCh = Math.min(output.length, this._channels.length);
    const remaining = this._length - this._readPos;
    const toCopy = Math.min(frames, Math.max(0, remaining));

    for (let ch = 0; ch < numCh; ch++) {
      if (toCopy > 0) {
        output[ch].set(
          this._channels[ch].subarray(this._readPos, this._readPos + toCopy)
        );
      }
      if (toCopy < frames) {
        output[ch].fill(0, toCopy);
      }
    }

    for (let ch = numCh; ch < output.length; ch++) {
      output[ch].fill(0);
    }

    this._readPos += toCopy;

    if (this._readPos >= this._length) {
      this._playing = false;
      this.port.postMessage({ type: "ended" });
    }

    return true;
  }
}

registerProcessor("radio-processor", RadioProcessor);
