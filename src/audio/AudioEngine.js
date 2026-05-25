/**
 * AudioEngine — 原生 Web Audio API
 * 支持多音轨播放（不同波形类型）
 */

const AudioCtx = window.AudioContext || window.webkitAudioContext;

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.currentTracks = [];
    this._oscillators = [];
    this._masterGain = null;
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
    this.stop(); // clear old

    const ctx = this.ctx;
    const bpm = this._bpm || 120;
    const beatDuration = 60 / bpm;
    const now = ctx.currentTime;

    for (const track of this.currentTracks) {
      const vol = track.muted ? 0 : (track.volume || 0.3);
      for (const note of track.notes) {
        const startTime = now + note.beat * beatDuration;
        const dur = Math.max(0.05, note.duration * beatDuration);
        const freq = this._keyToFreq(note.key);

        const osc = ctx.createOscillator();
        osc.type = track.instrumentType || 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        const env = ctx.createGain();
        env.gain.setValueAtTime(0, startTime);
        env.gain.linearRampToValueAtTime(vol, startTime + 0.01);
        env.gain.setValueAtTime(vol, startTime + dur - 0.05);
        env.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

        osc.connect(env);
        env.connect(this._masterGain);
        osc.start(startTime);
        osc.stop(startTime + dur + 0.1);
        this._oscillators.push(osc);
      }
    }
  }

  stop() {
    for (const osc of this._oscillators) {
      try { osc.stop(); osc.disconnect(); } catch (e) { /* ok */ }
    }
    this._oscillators = [];
  }

  setBpm(bpm) {
    this._bpm = bpm;
  }

  /**
   * 离线渲染导出 WAV
   */
  async exportWav(tracks, bpm = 120) {
    if (!tracks || tracks.length === 0) return null;

    const beatDuration = 60 / bpm;
    const totalDuration = this._calculateDuration(tracks, bpm);
    const sampleRate = 44100;
    const totalSamples = Math.ceil(sampleRate * totalDuration);
    const buffer = new Float32Array(totalSamples);

    for (const track of tracks) {
      if (track.muted) continue;
      const vol = track.volume || 0.3;
      const oscType = track.instrumentType || 'triangle';

      for (const note of track.notes) {
        const freq = this._keyToFreq(note.key);
        const startSample = Math.floor(note.beat * beatDuration * sampleRate);
        const noteSamples = Math.max(100, Math.floor(note.duration * beatDuration * sampleRate));

        for (let i = 0; i < noteSamples && startSample + i < totalSamples; i++) {
          const t = i / sampleRate;
          let sample = 0;

          switch (oscType) {
            case 'square':
              sample = (t * freq) % 1 < 0.5 ? 1 : -1;
              break;
            case 'sawtooth':
              sample = 2 * ((t * freq) % 1) - 1;
              break;
            case 'sine':
              sample = Math.sin(2 * Math.PI * freq * t);
              break;
            case 'triangle':
            default: {
              const phase = (t * freq) % 1;
              sample = phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
              break;
            }
          }

          const attack = Math.min(1, i / (sampleRate * 0.01));
          const release = Math.max(0, 1 - (i / noteSamples));
          const envelope = attack * release;

          buffer[startSample + i] += sample * vol * envelope;
        }
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
