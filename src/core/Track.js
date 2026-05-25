/**
 * Track — 单一音轨
 */
let trackIdCounter = 0;

export class Track {
  constructor({ name = 'Track', color = '#3b82f6', instrumentType = 'piano', volume = 0.3 } = {}) {
    this.id = trackIdCounter++;
    this.name = name;
    this.color = color;
    this.instrumentType = instrumentType; // 'piano' | 'organ' | 'flute' | 'bass'
    this.volume = volume;
    this.muted = false;
    this.solo = false;
    this.notes = []; // [{ id, key, beat, duration }]
  }

  addNote(key, beat, duration = 1) {
    const id = this._nextNoteId();
    this.notes.push({ id, key, beat, duration });
    return id;
  }

  removeNote(id) {
    this.notes = this.notes.filter(n => n.id !== id);
  }

  getNotes() {
    return this.notes;
  }

  _nextNoteId() {
    return this.notes.length > 0 ? Math.max(...this.notes.map(n => n.id)) + 1 : 1;
  }

  toJSON() {
    return {
      name: this.name,
      color: this.color,
      instrumentType: this.instrumentType,
      volume: this.volume,
      notes: this.notes,
    };
  }

  static fromJSON(data) {
    const track = new Track(data);
    track.notes = data.notes || [];
    return track;
  }
}
