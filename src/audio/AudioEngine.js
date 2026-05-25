/**
 * AudioEngine — 原生 Web Audio API（不依赖 Tone.js）
 * 
 * 用原生 API 实现三角波合成 + ADSR 包络
 * 不再依赖 Tone.js，避免加载问题和兼容性问题
 */

const AudioCtx = window.AudioContext || window.webkitAudioContext;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.currentNotes = [];
    this._oscillators = [];
    this._gain = null;
  }

  async init() {
    // 如果已经初始化且 AudioContext 是 running 状态，直接返回
    if (this.ready && this.ctx?.state === 'running') return;
    
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this._masterGain = this.ctx.createGain();
      this._masterGain.gain.value = 0.3; // 主音量
      this._masterGain.connect(this.ctx.destination);
    }
    
    // AudioContext 需要用户交互后才能启动
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    
    this.ready = true;
  }

  loadNotes(notes, bpm = 120) {
    this.currentNotes = notes;
    this._bpm = bpm;
  }

  async play() {
    await this.init();

    const ctx = this.ctx;
    const bpm = this._bpm || 120;
    const beatDuration = 60 / bpm;
    const now = ctx.currentTime;

    for (const note of this.currentNotes) {
      const startTime = now + note.beat * beatDuration;
      const dur = Math.max(0.05, note.duration * beatDuration);
      const freq = this._keyToFreq(note.key);

      // 创建振荡器
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);

      // 创建包络（音量控制）
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, startTime);
      env.gain.linearRampToValueAtTime(0.3, startTime + 0.01); // attack
      env.gain.setValueAtTime(0.3, startTime + dur - 0.05);    // sustain
      env.gain.exponentialRampToValueAtTime(0.001, startTime + dur); // release

      osc.connect(env);
      env.connect(this._masterGain);

      osc.start(startTime);
      osc.stop(startTime + dur + 0.1);

      this._oscillators.push(osc);
    }
  }

  stop() {
    for (const osc of this._oscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // 可能已经停止
      }
    }
    this._oscillators = [];
  }

  setBpm(bpm) {
    this._bpm = bpm;
  }

  /**
   * 离线渲染导出 WAV
   */
  async exportWav(notes, bpm = 120) {
    if (!notes || notes.length === 0) return null;

    const beatDuration = 60 / bpm;
    const totalDuration = this._calculateDuration(notes, bpm);
    const sampleRate = 44100;
    const totalSamples = Math.ceil(sampleRate * totalDuration);
    const buffer = new Float32Array(totalSamples);

    // 渲染每个音符到 buffer
    for (const note of notes) {
      const freq = this._keyToFreq(note.key);
      const startSample = Math.floor(note.beat * beatDuration * sampleRate);
      const noteSamples = Math.max(100, Math.floor(note.duration * beatDuration * sampleRate));

      for (let i = 0; i < noteSamples && startSample + i < totalSamples; i++) {
        const t = i / sampleRate;
        // 三角波
        const period = 1 / freq;
        const phase = (t % period) / period;
        let sample;
        if (phase < 0.5) {
          sample = 4 * phase - 1;
        } else {
          sample = 3 - 4 * phase;
        }

        // 简单包络
        const attack = Math.min(1, i / (sampleRate * 0.01));
        const release = Math.max(0, 1 - (i / noteSamples));
        const envelope = attack * release;

        buffer[startSample + i] += sample * 0.3 * envelope;
      }
    }

    // 防止削波
    let max = 0;
    for (let i = 0; i < totalSamples; i++) {
      const abs = Math.abs(buffer[i]);
      if (abs > max) max = abs;
    }
    if (max > 0.99) {
      for (let i = 0; i < totalSamples; i++) buffer[i] /= max;
    }

    return this._float32ToWav(buffer, sampleRate);
  }

  _keyToFreq(key) {
    // A4 = 440Hz, 对应 MIDI note 69
    return 440 * Math.pow(2, (key - 69) / 12);
  }

  _calculateDuration(notes, bpm) {
    if (!notes || notes.length === 0) return 2;
    const maxBeat = Math.max(...notes.map(n => n.beat + n.duration));
    return (maxBeat / (bpm / 60)) + 1;
  }

  _float32ToWav(samples, sampleRate) {
    const numChannels = 1;
    const bitDepth = 16;
    const dataLength = samples.length;
    const bufferLength = 44 + dataLength * 2;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    this._writeString(view, 8, 'WAVE');
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bitDepth / 8, true);
    view.setUint16(32, numChannels * bitDepth / 8, true);
    view.setUint16(34, bitDepth, true);
    this._writeString(view, 36, 'data');
    view.setUint32(40, dataLength * 2, true);

    let offset = 44;
    for (let i = 0; i < dataLength; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  destroy() {
    this.stop();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}
