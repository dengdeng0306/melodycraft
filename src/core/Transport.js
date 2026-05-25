/**
 * Transport — 播放控制
 */
export class Transport {
  constructor() {
    this.playing = false;
    this.bpm = 120;
    this.currentBeat = 0;
    this.listeners = {};
    this._timer = null;
    this._startTime = 0;
    this._startBeat = 0;
  }

  on(event, fn) {
    (this.listeners[event] ||= []).push(fn);
  }

  emit(event, ...args) {
    (this.listeners[event] || []).forEach(fn => fn(...args));
  }

  play() {
    if (this.playing) return;
    this.playing = true;
    this._startTime = performance.now();
    this._startBeat = this.currentBeat;
    this.emit('play');
    this._tick();
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    cancelAnimationFrame(this._timer);
    this.emit('pause');
  }

  stop() {
    this.pause();
    this.currentBeat = 0;
    this.emit('stop');
    this.emit('beat', 0);
  }

  toggle() {
    this.playing ? this.pause() : this.play();
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(240, bpm));
    this.emit('bpm', this.bpm);
  }

  _tick() {
    if (!this.playing) return;
    const elapsed = (performance.now() - this._startTime) / 1000;
    const beatsPerSecond = this.bpm / 60;
    const totalBeats = this._startBeat + elapsed * beatsPerSecond;

    // 限制在 128 拍内（8 小节 × 16 拍）
    if (totalBeats >= 128) {
      this.stop();
      return;
    }

    this.currentBeat = totalBeats;
    this.emit('beat', totalBeats);
    this._timer = requestAnimationFrame(() => this._tick());
  }

  destroy() {
    this.stop();
  }
}
