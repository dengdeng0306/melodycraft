/**
 * PianoRoll — 钢琴卷帘核心渲染与交互
 * 支持多音轨（按颜色区分）
 */
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const TOTAL_KEYS = 48;
const KEY_HEIGHT = 20;
const COL_WIDTH = 30;
const TOTAL_BARS = 8;
const BEATS_PER_BAR = 4;
const TOTAL_BEATS = TOTAL_BARS * BEATS_PER_BAR;
const SNAP_DIVISIONS = [1, 2, 4]; // 1, 1/2, 1/4 吸附

export class PianoRoll {
  constructor(containerId, transport, trackManager) {
    this.container = document.getElementById(containerId);
    this.transport = transport;
    this.trackManager = trackManager;
    this.activeTrackId = null;
    this.selectedNoteIds = new Set();
    this.snapIndex = 2; // default 1/4
    this.tool = 'pencil'; // pencil | select | erase
    this.dragState = null;

    this.TOTAL_PX = TOTAL_KEYS * KEY_HEIGHT + 30;
    this.WIDTH = TOTAL_BEATS * 4 * COL_WIDTH + 50;

    this._createDOM();
    this._bindEvents();
    this._bindTransport();
    this._bindTrackManager();
    this.render();
  }

  get snapValue() { return SNAP_DIVISIONS[this.snapIndex]; }

  get currentTrack() {
    if (!this.activeTrackId && this.trackManager.tracks.length > 0) {
      this.activeTrackId = this.trackManager.tracks[0].id;
    }
    return this.trackManager.tracks.find(t => t.id === this.activeTrackId) || this.trackManager.tracks[0];
  }

  // ──────────────────── DOM ────────────────────

  _createDOM() {
    this.container.innerHTML = '';
    this.container.style.cssText = 'overflow:auto;height:100%;position:relative;background:#12122a;';

    const scrollEl = document.createElement('div');
    scrollEl.style.cssText = `position:relative;min-width:${this.WIDTH}px;min-height:${this.TOTAL_PX}px;`;

    // Grid horizontal lines
    this._gridH = document.createElement('div');
    this._gridH.style.cssText = 'position:absolute;top:0;left:50px;right:0;bottom:0;pointer-events:none;';
    scrollEl.appendChild(this._gridH);

    // Grid vertical lines
    this._gridV = document.createElement('div');
    this._gridV.style.cssText = 'position:absolute;top:0;left:50px;right:0;bottom:0;pointer-events:none;';
    scrollEl.appendChild(this._gridV);

    // Key labels
    this._keyLabels = document.createElement('div');
    this._keyLabels.style.cssText = 'position:absolute;top:0;left:0;width:50px;bottom:0;border-right:1px solid #2a2a45;';
    scrollEl.appendChild(this._keyLabels);

    // Time labels
    this._timeLabels = document.createElement('div');
    this._timeLabels.style.cssText = 'position:absolute;bottom:0;left:50px;right:0;height:30px;border-top:1px solid #2a2a45;';
    scrollEl.appendChild(this._timeLabels);

    // Notes area (interactive)
    this._notesArea = document.createElement('div');
    this._notesArea.style.cssText = 'position:absolute;top:0;left:50px;right:0;bottom:30px;z-index:2;cursor:crosshair;';
    scrollEl.appendChild(this._notesArea);

    // Playhead
    this._playhead = document.createElement('div');
    this._playhead.style.cssText = 'position:absolute;top:0;bottom:30px;width:2px;background:#fbbf24;z-index:5;pointer-events:none;box-shadow:0 0 8px rgba(251,191,36,.5);display:none;';
    scrollEl.appendChild(this._playhead);

    scrollEl.appendChild(this._playhead);

    this.container.appendChild(scrollEl);
    this._scrollEl = scrollEl;
  }

  // ──────────────────── Grid Rendering ────────────────────

  render() {
    this._renderHorizontalGrid();
    this._renderVerticalGrid();
    this._renderKeyLabels();
    this._renderTimeLabels();
    this._renderNotes();
    this._updatePlayhead();
  }

  _renderHorizontalGrid() {
    this._gridH.innerHTML = '';
    for (let i = 0; i <= TOTAL_KEYS; i++) {
      const line = document.createElement('div');
      line.style.cssText = `position:absolute;left:0;right:0;top:${i * KEY_HEIGHT}px;height:1px;`;
      line.style.background = i % 12 === 0 ? '#2a2a45' : '#1e1e3a';
      this._gridH.appendChild(line);
    }
  }

  _renderVerticalGrid() {
    this._gridV.innerHTML = '';
    const totalCols = TOTAL_BEATS * 4;
    for (let c = 0; c <= totalCols; c++) {
      const line = document.createElement('div');
      line.style.cssText = `position:absolute;top:0;bottom:0;left:${c * COL_WIDTH}px;width:1px;`;
      if (c % 16 === 0) line.style.background = '#2a2a45';
      else if (c % 4 === 0) line.style.background = '#22224a';
      else line.style.background = '#1a1a35';
      this._gridV.appendChild(line);
    }
  }

  _renderKeyLabels() {
    this._keyLabels.innerHTML = '';
    for (let i = 0; i < TOTAL_KEYS; i++) {
      const keyIndex = TOTAL_KEYS - 1 - i;
      const octave = Math.floor(keyIndex / 12);
      const noteIdx = keyIndex % 12;
      const label = document.createElement('div');
      label.textContent = NOTE_NAMES[noteIdx] + octave;
      label.style.cssText = `position:absolute;right:8px;top:${i * KEY_HEIGHT + KEY_HEIGHT / 2}px;
        font-size:9px;color:${NOTE_NAMES[noteIdx].length > 1 ? '#444' : '#666'};
        transform:translateY(-50%);pointer-events:none;`;
      this._keyLabels.appendChild(label);
    }
  }

  _renderTimeLabels() {
    this._timeLabels.innerHTML = '';
    for (let b = 0; b <= TOTAL_BARS; b++) {
      const label = document.createElement('div');
      label.textContent = b + 1;
      label.style.cssText = `position:absolute;top:8px;left:${b * 16 * COL_WIDTH}px;
        font-size:9px;color:#555;transform:translateX(-50%);pointer-events:none;`;
      this._timeLabels.appendChild(label);
    }
  }

  // ──────────────────── Notes ────────────────────

  _renderNotes() {
    this._notesArea.querySelectorAll('.note').forEach(el => el.remove());

    // 渲染所有音轨的音符（按颜色区分）
    for (const track of this.trackManager.tracks) {
      for (const note of track.notes) {
        const el = this._createNoteElement(note, track.color, track.id);
        this._notesArea.appendChild(el);
      }
    }
  }

  _createNoteElement(note, trackColor, trackId) {
    const el = document.createElement('div');
    el.className = 'note';
    el.dataset.noteId = note.id;
    el.dataset.trackId = trackId;

    const x = note.beat * COL_WIDTH * 4;
    const y = (TOTAL_KEYS - 1 - note.key) * KEY_HEIGHT + 2;
    const w = Math.max(4, note.duration * COL_WIDTH * 4);
    const isSelected = this._isNoteSelected(trackId, note.id);
    const isActiveTrack = trackId === this.activeTrackId;

    el.style.cssText = `
      position:absolute; left:${x}px; top:${y}px; width:${w}px; height:${KEY_HEIGHT - 4}px;
      border-radius:3px; cursor:pointer; z-index:2;
      background:${trackColor};
      opacity:${isActiveTrack ? 0.9 : 0.5};
      box-shadow:${isSelected ? '0 0 0 2px rgba(255,255,255,0.6)' : '0 1px 3px rgba(0,0,0,0.3)'};
      transition: opacity 0.1s;
      border-left:${isActiveTrack ? '2px solid rgba(255,255,255,0.3)' : 'none'};
    `;
    return el;
  }

  _isNoteSelected(trackId, noteId) {
    return this.selectedNoteIds.has(`${trackId}:${noteId}`);
  }

  // ──────────────────── Coordinate Helpers ────────────────────

  _clientToGrid(clientX, clientY) {
    const rect = this._notesArea.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const scrollLeft = this.container.scrollLeft;
    const scrollTop = this.container.scrollTop;
    const gridX = x + scrollLeft;
    const gridY = y + scrollTop;

    let key = TOTAL_KEYS - 1 - Math.floor(gridY / KEY_HEIGHT);
    key = Math.max(0, Math.min(TOTAL_KEYS - 1, key));

    const snap = this.snapValue;
    const rawBeat = gridX / (COL_WIDTH * 4);
    let beat = Math.round(rawBeat * snap) / snap;
    beat = Math.max(0, Math.min(TOTAL_BEATS, beat));

    return { key, beat };
  }

  // ──────────────────── Events ────────────────────

  _bindEvents() {
    this._notesArea.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const noteEl = e.target.closest('.note');
      if (noteEl) return; // notes handle their own events via click
      this._onGridMouseDown(e);
    });

    document.addEventListener('mousemove', e => this._onMouseMove(e));
    document.addEventListener('mouseup', e => this._onMouseUp(e));

    this._notesArea.addEventListener('click', e => {
      const noteEl = e.target.closest('.note');
      if (!noteEl) return;

      const trackId = parseInt(noteEl.dataset.trackId);
      const noteId = parseInt(noteEl.dataset.noteId);
      const key = `${trackId}:${noteId}`;

      if (e.ctrlKey || e.metaKey) {
        if (this.selectedNoteIds.has(key)) {
          this.selectedNoteIds.delete(key);
        } else {
          this.selectedNoteIds.add(key);
        }
      } else {
        this.selectedNoteIds.clear();
        this.selectedNoteIds.add(key);
        // 点击其他音轨的音符时自动切换
        this.activeTrackId = trackId;
        this.emitActiveTrackChange();
      }
      this._renderNotes();
    });
  }

  _onGridMouseDown(e) {
    if (this.tool === 'pencil') {
      const track = this.currentTrack;
      if (!track) return;
      const { key, beat } = this._clientToGrid(e.clientX, e.clientY);
      track.addNote(key, beat, this.snapValue);
      this._renderNotes();
      this.emitNotesChange();
    } else if (this.tool === 'erase') {
      const { key, beat } = this._clientToGrid(e.clientX, e.clientY);
      // 从当前音轨删除该位置的音符
      const track = this.currentTrack;
      if (!track) return;
      const note = track.notes.find(n => Math.abs(n.beat - beat) < 0.1 && n.key === key);
      if (note) {
        track.removeNote(note.id);
        this._renderNotes();
        this.emitNotesChange();
      }
    }
  }

  _onMouseMove(e) {
    // 不做拖拽，后续版本加
  }

  _onMouseUp(e) {
    this.dragState = null;
  }

  // ──────────────────── Transport ────────────────────

  _bindTransport() {
    this.transport.on('beat', beat => this._updatePlayhead(beat));
    this.transport.on('play', () => this._playhead.style.display = 'block');
    this.transport.on('pause', () => this._playhead.style.display = 'block');
    this.transport.on('stop', () => {
      this._playhead.style.display = 'none';
      this._updatePlayhead(0);
    });
  }

  _updatePlayhead(beat = 0) {
    this._playhead.style.left = (beat * COL_WIDTH * 4) + 'px';
  }

  // ──────────────────── Track Manager ────────────────────

  _bindTrackManager() {
    this.trackManager.on('tracksChanged', () => {
      this.render();
    });
  }

  setActiveTrack(trackId) {
    this.activeTrackId = trackId;
    this.selectedNoteIds.clear();
    this.emitActiveTrackChange();
    this.render();
  }

  emitActiveTrackChange() {
    // 通知外部（main.js 可以监听）
    if (this._onActiveTrackChange) {
      this._onActiveTrackChange(this.activeTrackId);
    }
  }

  emitNotesChange() {
    if (this._onNotesChange) {
      this._onNotesChange();
    }
  }

  // ──────────────────── API ────────────────────

  setTool(tool) {
    this.tool = tool;
    this._notesArea.style.cursor = tool === 'pencil' ? 'crosshair' :
      tool === 'erase' ? 'pointer' : 'default';
  }

  setSnap(index) {
    this.snapIndex = index;
  }

  onActiveTrackChange(fn) {
    this._onActiveTrackChange = fn;
  }

  onNotesChange(fn) {
    this._onNotesChange = fn;
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
