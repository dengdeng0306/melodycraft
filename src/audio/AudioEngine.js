/**
 * AudioEngine — 原生 Web Audio API 乐器合成器
 * 每种乐器使用不同的合成参数模拟真实音色
 */

const AudioCtx = window.AudioContext || window.webkitAudioContext;

// 乐器定义
const INSTRUMENTS = {
  piano: {
    label: '🎹 钢琴',
    synth: 'piano',
  },
  organ: {
    label: '🎹 风琴',
    synth: 'organ',
  },
  flute: {
    label: '🎵 长笛',
    synth: 'flute',
  },
  bass: {
    label: '🎸 贝斯',
    synth: 'bass',
  },
};

export { INSTRUMENTS };

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.currentTracks = [];
    this._masterGain = null;
    this._nodes = []; // 所有活跃节点
  }

  async init() {
    if (this.ready && this.ctx?.state === 'running') return;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
      this._masterGain = this.ctx.createGain();
      this._masterGain.gain.value = 0.3;
      this._masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    this.ready = true;
  }

  loadTracks(tracks, bpm = 120) {
    this.currentTracks = tracks;
    this._bpm = bpm;
  }

  async play() {
    await this.init();
    this.stop();

    const ctx = this.ctx;
    const bpm = this._bpm || 120;
    const beatDuration = 60 / bpm;
    const now = ctx.currentTime;

    for (const track of this.currentTracks) {
      if (track.muted) continue;
      const vol = track.volume ?? 0.3;
      const instr = track.instrumentType || 'piano';

      for (const note of track.notes) {
        const startTime = now + note.beat * beatDuration;
        const dur = Math.max(0.05, note.duration * beatDuration);
        const freq = this._keyToFreq(note.key);
        const nodes = this._createNote(ctx, instr, freq, dur, vol, startTime);
        this._nodes.push(...nodes);
      }
    }
  }

  /**
   * 根据乐器类型创建声音
   */
  _createNote(ctx, instrument, freq, dur, vol, startTime) {
    const nodes = [];
    const endTime = startTime + dur;

    switch (instrument) {
      case 'piano':
        return this._synthPiano(ctx, freq, dur, vol, startTime, endTime);
      case 'organ':
        return this._synthOrgan(ctx, freq, dur, vol, startTime, endTime);
      case 'flute':
        return this._synthFlute(ctx, freq, dur, vol, startTime, endTime);
      case 'bass':
        return this._synthBass(ctx, freq, dur, vol, startTime, endTime);
      default:
        return this._synthPiano(ctx, freq, dur, vol, startTime, endTime);
    }
  }

  /**
   * 🎹 钢琴：三角波 + 轻微谐波 + 快速衰减
   */
  _synthPiano(ctx, freq, dur, vol, startTime, endTime) {
    const nodes = [];

    // 主音（三角波）
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(freq, startTime);

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0, startTime);
    gain1.gain.linearRampToValueAtTime(vol * 0.7, startTime + 0.005); // fast attack
    gain1.gain.exponentialRampToValueAtTime(vol * 0.1, startTime + dur * 0.3);
    gain1.gain.exponentialRampToValueAtTime(0.001, endTime);

    osc1.connect(gain1);
    gain1.connect(this._masterGain);
    osc1.start(startTime);
    osc1.stop(endTime + 0.05);
    nodes.push(osc1);

    // 谐波（八度上方，三角波）
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(freq * 2, startTime);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, startTime);
    gain2.gain.linearRampToValueAtTime(vol * 0.15, startTime + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.001, startTime + dur * 0.2);

    osc2.connect(gain2);
    gain2.connect(this._masterGain);
    osc2.start(startTime);
    osc2.stop(endTime + 0.05);
    nodes.push(osc2);

    // 噪声瞬态（模拟琴槌敲击）
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(vol * 0.08, startTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.03);

    // 用方波+高频率模拟敲击瞬态
    const noiseOsc = ctx.createOscillator();
    noiseOsc.type = 'square';
    noiseOsc.frequency.setValueAtTime(freq * 4, startTime);
    noiseOsc.connect(noiseGain);
    noiseGain.connect(this._masterGain);
    noiseOsc.start(startTime);
    noiseOsc.stop(startTime + 0.03);
    nodes.push(noiseOsc);

    return nodes;
  }

  /**
   * 🎹 风琴：方波 + 正弦波混合 + 持续
   */
  _synthOrgan(ctx, freq, dur, vol, startTime, endTime) {
    const nodes = [];

    // 基础方波
    const osc1 = ctx.createOscillator();
    osc1.type = 'square';
    osc1.frequency.setValueAtTime(freq, startTime);

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0, startTime);
    gain1.gain.linearRampToValueAtTime(vol * 0.35, startTime + 0.03);
    gain1.gain.setValueAtTime(vol * 0.35, endTime - 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, endTime);

    osc1.connect(gain1);
    gain1.connect(this._masterGain);
    osc1.start(startTime);
    osc1.stop(endTime + 0.05);
    nodes.push(osc1);

    // 五度上方正弦波
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 1.5, startTime);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, startTime);
    gain2.gain.linearRampToValueAtTime(vol * 0.2, startTime + 0.03);
    gain2.gain.setValueAtTime(vol * 0.2, endTime - 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, endTime);

    osc2.connect(gain2);
    gain2.connect(this._masterGain);
    osc2.start(startTime);
    osc2.stop(endTime + 0.05);
    nodes.push(osc2);

    return nodes;
  }

  /**
   * 🎵 长笛：正弦波 + 微弱三角波 + 轻柔起音
   */
  _synthFlute(ctx, freq, dur, vol, startTime, endTime) {
    const nodes = [];

    // 主音
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(freq, startTime);

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0, startTime);
    gain1.gain.linearRampToValueAtTime(vol * 0.5, startTime + 0.08); // slow attack
    gain1.gain.setValueAtTime(vol * 0.5, endTime - 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, endTime);

    osc1.connect(gain1);
    gain1.connect(this._masterGain);
    osc1.start(startTime);
    osc1.stop(endTime + 0.05);
    nodes.push(osc1);

    // 轻微谐波
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, startTime);

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, startTime);
    gain2.gain.linearRampToValueAtTime(vol * 0.06, startTime + 0.1);
    gain2.gain.setValueAtTime(vol * 0.06, endTime - 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, endTime);

    osc2.connect(gain2);
    gain2.connect(this._masterGain);
    osc2.start(startTime);
    osc2.stop(endTime + 0.05);
    nodes.push(osc2);

    return nodes;
  }

  /**
   * 🎸 贝斯：锯齿波 + 低通效果
   */
  _synthBass(ctx, freq, dur, vol, startTime, endTime) {
    const nodes = [];

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, startTime);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 3, startTime);
    filter.frequency.exponentialRampToValueAtTime(freq, startTime + dur * 0.3);

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0, startTime);
    gain1.gain.linearRampToValueAtTime(vol * 0.5, startTime + 0.01);
    gain1.gain.setValueAtTime(vol * 0.5, endTime - 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, endTime);

    osc1.connect(filter);
    filter.connect(gain1);
    gain1.connect(this._masterGain);
    osc1.start(startTime);
    osc1.stop(endTime + 0.05);
    nodes.push(osc1);

    return nodes;
  }

  stop() {
    for (const node of this._nodes) {
      try { node.stop(); node.disconnect(); } catch (e) { /* ok */ }
    }
    this._nodes = [];
  }

  setBpm(bpm) {
    this._bpm = bpm;
  }

  // ─── 导出 ───

  async exportWav(tracks, bpm = 120) {
    if (!tracks || tracks.length === 0) return null;

    const beatDuration = 60 / bpm;
    const totalDuration = this._calculateDuration(tracks, bpm);
    const sampleRate = 44100;
    const totalSamples = Math.ceil(sampleRate * totalDuration);
    const buffer = new Float32Array(totalSamples);

    for (const track of tracks) {
      if (track.muted) continue;
      const vol = track.volume ?? 0.3;
      const instr = track.instrumentType || 'piano';

      for (const note of track.notes) {
        const freq = this._keyToFreq(note.key);
        const startSample = Math.floor(note.beat * beatDuration * sampleRate);
        const noteSamples = Math.max(100, Math.floor(note.duration * beatDuration * sampleRate));

        for (let i = 0; i < noteSamples && startSample + i < totalSamples; i++) {
          const t = i / sampleRate;
          let sample = this._renderSample(instr, freq, t, noteSamples, sampleRate);
          buffer[startSample + i] += sample * vol;
        }
      }
    }

    // 归一化
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

  _renderSample(instr, freq, t, noteSamples, sampleRate) {
    const envAttack = Math.min(1, t / 0.01);
    const envRelease = Math.max(0, 1 - (t / (noteSamples / sampleRate)));

    switch (instr) {
      case 'piano': {
        // 三角波主音
        const phase1 = (t * freq) % 1;
        const s1 = phase1 < 0.5 ? 4 * phase1 - 1 : 3 - 4 * phase1;
        // 谐波
        const phase2 = (t * freq * 2) % 1;
        const s2 = phase2 < 0.5 ? 4 * phase2 - 1 : 3 - 4 * phase2;
        // 快速衰减（钢琴音短）
        const pianoEnv = Math.min(1, t / 0.005) * Math.max(0.001, Math.exp(-t * 8));
        return (s1 * 0.6 + s2 * 0.15) * pianoEnv;
      }
      case 'organ': {
        const s1 = (t * freq) % 1 < 0.5 ? 0.35 : -0.35;
        const s2 = Math.sin(2 * Math.PI * freq * 1.5 * t) * 0.2;
        return (s1 + s2) * envAttack * envRelease;
      }
      case 'flute': {
        const s1 = Math.sin(2 * Math.PI * freq * t) * 0.5;
        const s2 = Math.sin(2 * Math.PI * freq * 2 * t) * 0.06;
        const slowAttack = Math.min(1, t / 0.08);
        return (s1 + s2) * slowAttack * envRelease;
      }
      case 'bass': {
        const s1 = 2 * ((t * freq) % 1) - 1;
        // 模拟低通
        const s2 = (s1 + (t * freq * 3) % 1 < 0.5 ? 1 : -1 * 0.15);
        return (s1 * 0.5) * envAttack * envRelease;
      }
      default:
        return 0;
    }
  }

  _keyToFreq(key) {
    return 440 * Math.pow(2, (key - 69) / 12);
  }

  _calculateDuration(tracks, bpm) {
    let maxBeat = 0;
    for (const track of tracks) {
      for (const note of track.notes) {
        const end = note.beat + note.duration;
        if (end > maxBeat) maxBeat = end;
      }
    }
    return maxBeat > 0 ? (maxBeat / (bpm / 60)) + 1 : 2;
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
    view.setUint16(20, 1, true);
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
