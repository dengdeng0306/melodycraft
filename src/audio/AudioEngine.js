/**
 * AudioEngine — 基于 Web Audio API 的音频播放引擎（不依赖 Tone.js Transport）
 * 
 * 手动调度音符触发，避免 Tone.js 复杂的时间格式问题
 */
import * as Tone from 'tone';

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

export class AudioEngine {
  constructor() {
    this.ready = false;
    this.synth = null;
    this.currentNotes = [];
    this._scheduledEvents = [];
  }

  async init() {
    if (this.ready) return;
    await Tone.start();
    this.ready = true;
  }

  /**
   * 创建/重建合成器
   */
  _createSynth() {
    if (this.synth) this.synth.dispose();
    this.synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.5 }
    }).toDestination();
    return this.synth;
  }

  /**
   * 加载音符但不播放
   */
  loadNotes(notes, bpm = 120) {
    this.currentNotes = notes;
    this._bpm = bpm;
  }

  /**
   * 立即播放所有音符（手动调度 schedule）
   */
  async play() {
    await this.init();

    const synth = this._createSynth();
    const bpm = this._bpm || 120;
    const now = Tone.now();
    const beatDuration = 60 / bpm;

    // 取消之前调度的音符
    this.stop();

    // 手动调度每个音符
    for (const note of this.currentNotes) {
      const startTime = now + note.beat * beatDuration;
      const dur = note.duration * beatDuration;
      const noteName = this._keyToNote(note.key);

      const eventId = synth.triggerAttackRelease(noteName, dur, startTime);
      this._scheduledEvents.push(eventId);
    }
  }

  pause() {
    // Tone.js 不支持暂停单个 synth，停掉合成器
    if (this.synth) {
      this.synth.volume.value = -Infinity; // 静音
    }
  }

  stop() {
    if (this.synth) {
      this.synth.dispose();
      this.synth = null;
    }
    this._scheduledEvents = [];
  }

  setBpm(bpm) {
    this._bpm = bpm;
  }

  /**
   * 离线渲染导出 WAV
   */
  async exportWav(notes, bpm = 120) {
    if (!notes || notes.length === 0) return null;

    const duration = this._calculateDuration(notes, bpm);
    const offline = new Tone.Offline(1, duration);

    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.5 }
    }).toDestination();

    const beatDuration = 60 / bpm;
    const now = 0; // 离线环境从 0 开始

    for (const note of notes) {
      const startTime = now + note.beat * beatDuration;
      const dur = note.duration * beatDuration;
      const noteName = this._keyToNote(note.key);
      synth.triggerAttackRelease(noteName, dur, startTime);
    }

    const buffer = await offline.render();
    const wav = this._bufferToWav(buffer);
    this._cleanupSynth(synth);
    return wav;
  }

  _cleanupSynth(synth) {
    try { synth.dispose(); } catch (e) { /* ignore */ }
  }

  _keyToNote(key) {
    const octave = Math.floor(key / 12) + 2;
    const name = NOTE_NAMES[key % 12];
    return `${name}${octave}`;
  }

  _calculateDuration(notes, bpm) {
    if (!notes || notes.length === 0) return 2;
    const maxBeat = Math.max(...notes.map(n => n.beat + n.duration));
    return (maxBeat / (bpm / 60)) + 2; // +2 seconds padding
  }

  _bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;

    const data = buffer.getChannelData(0);
    const dataLength = data.length;
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
      const s = Math.max(-1, Math.min(1, data[i]));
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
  }
}
