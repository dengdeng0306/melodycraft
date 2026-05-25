/**
 * AudioEngine — 基于 Tone.js 的音频播放引擎
 */
import * as Tone from 'tone';

export class AudioEngine {
  constructor() {
    this.ready = false;
    this.synth = null;
    this.part = null;
    this.currentNotes = [];
    this._started = false;
  }

  async init() {
    if (this.ready) return;
    await Tone.start();
    this.ready = true;
  }

  /**
   * 加载音符序列并准备播放
   * @param {Array} notes - [{key, beat, duration}]
   * @param {number} bpm 
   */
  loadNotes(notes, bpm = 120) {
    this.currentNotes = notes;
    Tone.getTransport().bpm.value = bpm;

    // 清理旧的 part
    if (this.part) {
      this.part.dispose();
      this.part = null;
    }
    if (this.synth) {
      this.synth.dispose();
      this.synth = null;
    }

    // 创建合成器
    this.synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.5 }
    }).toDestination();

    // 创建 Part
    const events = notes.map(n => ({
      time: `0:${n.beat}`,
      note: this._keyToNote(n.key),
      dur: n.duration,
    }));

    this.part = new Tone.Part((time, event) => {
      this.synth.triggerAttackRelease(event.note, event.dur, time);
    }, events);
  }

  async play() {
    await this.init();
    Tone.getTransport().start();
  }

  pause() {
    Tone.getTransport().pause();
  }

  stop() {
    Tone.getTransport().stop();
    Tone.getTransport().cancel();
  }

  setBpm(bpm) {
    Tone.getTransport().bpm.value = bpm;
  }

  /**
   * 离线渲染并导出为 WAV
   */
  async exportWav(notes, bpm = 120) {
    const dur = this._calculateDuration(notes, bpm);
    const offline = new Tone.Offline(1, dur);

    const synth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.5 }
    }).toDestination();

    const events = notes.map(n => ({
      time: `0:${n.beat}`,
      note: this._keyToNote(n.key),
      dur: n.duration,
    }));

    const part = new Tone.Part((time, event) => {
      synth.triggerAttackRelease(event.note, event.dur, time);
    }, events);

    const buffer = await offline.render();
    const wav = this._bufferToWav(buffer);
    return wav;
  }

  _keyToNote(key) {
    const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
    const octave = Math.floor(key / 12) + 2;
    const name = NOTE_NAMES[key % 12];
    return `${name}${octave}`;
  }

  _calculateDuration(notes, bpm) {
    if (notes.length === 0) return 2;
    const maxBeat = Math.max(...notes.map(n => n.beat + n.duration));
    return (maxBeat / (bpm / 60)) + 1;
  }

  _bufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const data = buffer.getChannelData(0);
    const dataLength = data.length;
    const bufferLength = 44 + dataLength * 2;

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // WAV header
    this._writeString(view, 0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    this._writeString(view, 8, 'WAVE');
    this._writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * bitDepth / 8, true);
    view.setUint16(32, numChannels * bitDepth / 8, true);
    view.setUint16(34, bitDepth, true);
    this._writeString(view, 36, 'data');
    view.setUint32(40, dataLength * 2, true);

    // PCM data
    let offset = 44;
    for (let i = 0; i < dataLength; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
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
    if (this.synth) this.synth.dispose();
    if (this.part) this.part.dispose();
  }
}
