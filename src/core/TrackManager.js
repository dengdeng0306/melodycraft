/**
 * TrackManager — 多音轨管理器
 */
import { Track } from './Track.js';

const TRACK_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export class TrackManager {
  constructor() {
    this.tracks = [];
    this._listeners = {};
    this._nextColorIdx = 0;
  }

  on(event, fn) {
    (this._listeners[event] ||= []).push(fn);
  }

  emit(event, ...args) {
    (this._listeners[event] || []).forEach(fn => fn(...args));
  }

  /**
   * 添加新音轨
   */
  addTrack(name) {
    const track = new Track({
      name: name || `音轨 ${this.tracks.length + 1}`,
      color: TRACK_COLORS[this._nextColorIdx % TRACK_COLORS.length],
    });
    this._nextColorIdx++;
    this.tracks.push(track);
    this.emit('trackAdded', track);
    this.emit('tracksChanged');
    return track;
  }

  /**
   * 删除音轨（保留至少一个）
   */
  removeTrack(trackId) {
    if (this.tracks.length <= 1) return false;
    const idx = this.tracks.findIndex(t => t.id === trackId);
    if (idx === -1) return false;
    const removed = this.tracks.splice(idx, 1)[0];
    this.emit('trackRemoved', removed);
    this.emit('tracksChanged');
    return true;
  }

  /**
   * 获取当前活跃的 tracks（solo 逻辑）
   * 如果有任何音轨 solo，只返回 solo 的音轨
   * 否则返回所有非静音的音轨
   */
  getActiveTracks() {
    const hasSolo = this.tracks.some(t => t.solo);
    return this.tracks.filter(t => {
      if (hasSolo) return t.solo && !t.muted;
      return !t.muted;
    });
  }

  /**
   * 获取所有音轨的所有音符（用于导出）
   */
  getAllNotes() {
    return this.tracks.flatMap((track, trackIndex) =>
      track.notes.map(n => ({
        ...n,
        trackIndex,
        instrumentType: track.instrumentType,
        volume: track.volume,
      }))
    );
  }

  /**
   * 切换静音
   */
  toggleMute(trackId) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.muted = !track.muted;
      this.emit('tracksChanged');
    }
  }

  /**
   * 切换独奏
   */
  toggleSolo(trackId) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.solo = !track.solo;
      this.emit('tracksChanged');
    }
  }

  /**
   * 设置音色
   */
  setInstrumentType(trackId, type) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track && ['triangle', 'square', 'sawtooth', 'sine'].includes(type)) {
      track.instrumentType = type;
      this.emit('tracksChanged');
    }
  }

  /**
   * 设置音量
   */
  setVolume(trackId, volume) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.volume = Math.max(0, Math.min(1, volume));
      this.emit('tracksChanged');
    }
  }

  /**
   * 重命名音轨
   */
  renameTrack(trackId, name) {
    const track = this.tracks.find(t => t.id === trackId);
    if (track) {
      track.name = name;
      this.emit('tracksChanged');
    }
  }

  /**
   * 序列化
   */
  toJSON() {
    return this.tracks.map(t => t.toJSON());
  }

  fromJSON(data) {
    this.tracks = data.map(d => Track.fromJSON(d));
    this._nextColorIdx = this.tracks.length;
    this.emit('tracksChanged');
  }

  get length() {
    return this.tracks.length;
  }
}
