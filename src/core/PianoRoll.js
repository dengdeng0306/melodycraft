/**
 * PianoRoll — 钢琴卷帘核心渲染与交互
 * 支持多音轨（按颜色区分）、音符拖拽、长度调整
 */
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const TOTAL_KEYS = 48;
const KEY_HEIGHT = 20;
const COL_WIDTH = 30;
const TOTAL_BARS = 8;
const BEATS_PER_BAR = 4;
const TOTAL_BEATS = TOTAL_BARS * BEATS_PER_BAR;
const SNAP_DIVISIONS = [1, 2, 4];

export class PianoRoll {
  constructor(containerId, transport, trackManager) {
    this.container = document.getElementById(containerId);
    this.transport = transport;
    this.trackManager = trackManager;
    this.activeTrackId = null;
    this.selectedNoteKeys = new Set(); // "trackId:noteId"
    this.snapIndex = 2;
    this.tool = 'pencil';
    this.dragState = null; // { type: 'move'|'resize'|'draw', noteEl, ... }

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

    this._gridH = document.createElement('div');
    this._gridH.style.cssText = 'position:absolute;top:0;left:50px;right:0;bottom:0;pointer-events:none;';
    scrollEl.appendChild(this._gridH);

    this._gridV = document.createElement('div');
    this._gridV.style.cssText = 'position:absolute;top:0;left:50px;right:0;bottom:0;pointer-events:none;';
    scrollEl.appendChild(this._gridV);

    this._keyLabels = document.createElement('div');
    this._keyLabels.style.cssText = 'position:absolute;top:0;left:0;width:50px;bottom:0;border-right:1px solid #2a2a45;';
    scrollEl.appendChild(this._keyLabels);

    this._timeLabels = document.createElement('div');
    this._timeLabels.style.cssText = 'position:absolute;bottom:0;left:50px;right:0;height:30px;border-top:1px solid #2a2a45;';
    scrollEl.appendChild(this._timeLabels);

    this._notesArea = document.createElement('div');
    this._notesArea.style.cssText = 'position:absolute;top:0;left:50px;right:0;bottom:30px;z-index:2;';
    scrollEl.appendChild(this._notesArea);

    this._playhead = document.createElement('div');
    this._playhead.style.cssText = 'position:absolute;top:0;bottom:30px;width:2px;background:#fbbf24;z-index:5;pointer-events:none;box-shadow:0 0 8px rgba(251,191,36,.5);display:none;';
    scrollEl.appendChild(this._playhead);

    this.container.appendChild(scrollEl);
    this._scrollEl = scrollEl;
  }

  // ──────────────────── Grid ────────────────────

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
      line.style.background = c % 16 === 0 ? '#2a2a45' : (c % 4 === 0 ? '#22224a' : '#1a1a35');
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
    this._notesArea.querySelectorAll('.note-wrapper').forEach(el => el.remove());

    for (const track of this.trackManager.tracks) {
      for (const note of track.notes) {
        const wrapper = this._createNoteWrapper(note, track.color, track.id);
        this._notesArea.appendChild(wrapper);
      }
    }
  }

  _createNoteWrapper(note, trackColor, trackId) {
    const wrapper = document.createElement('div');
    wrapper.className = 'note-wrapper';
    wrapper.dataset.noteId = note.id;
    wrapper.dataset.trackId = trackId;

    const x = note.beat * COL_WIDTH * 4;
    const y = (TOTAL_KEYS - 1 - note.key) * KEY_HEIGHT + 2;
    const w = Math.max(12, note.duration * COL_WIDTH * 4);
    const isSelected = this.selectedNoteKeys.has(`${trackId}:${note.id}`);
    const isActive = trackId === this.activeTrackId;

    wrapper.style.cssText = `
      position:absolute; left:${x}px; top:${y}px; width:${w}px; height:${KEY_HEIGHT - 4}px;
      cursor:grab; z-index:2; user-select:none;
    `;

    // 主体
    const body = document.createElement('div');
    body.className = 'note-body';
    body.style.cssText = `
      width:100%; height:100%; border-radius:4px;
      background:${trackColor};
      opacity:${isActive ? 0.85 : 0.4};
      box-shadow:${isSelected ? '0 0 0 2px rgba(255,255,255,0.6), 0 2px 6px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.3)'};
      transition: box-shadow 0.1s;
      border-left:${isActive ? '2px solid rgba(255,255,255,0.4)' : 'none'};
      position:relative;
    `;
    wrapper.appendChild(body);

    // 调整大小的手柄（右侧边缘，仅在活跃+选中时可见）
    if (isActive && isSelected && w > 16) {
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      handle.style.cssText = `
        position:absolute; right:0; top:0; bottom:0; width:6px;
        cursor:ew-resize; z-index:3;
        background:rgba(255,255,255,0.1);
        border-radius:0 4px 4px 0;
      `;
      handle.addEventListener('mousedown', e => {
        e.stopPropagation();
        const noteEl = wrapper;
        this._startResizeDebounced(e, noteEl, note, trackId);
      });
      body.appendChild(handle);
    }

    return wrapper;
  }

  // ──────────────────── Coordinates ────────────────────

  _clientToGrid(clientX, clientY) {
    const rect = this._notesArea.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const gridX = x + this.container.scrollLeft;
    const gridY = y + this.container.scrollTop;

    let key = TOTAL_KEYS - 1 - Math.floor(gridY / KEY_HEIGHT);
    key = Math.max(0, Math.min(TOTAL_KEYS - 1, key));

    const snap = this.snapValue;
    const rawBeat = gridX / (COL_WIDTH * 4);
    let beat = Math.round(rawBeat * snap) / snap;
    beat = Math.max(0, Math.min(TOTAL_BEATS, beat));

    return { key, beat };
  }

  _clientToBeat(clientX) {
    const rect = this._notesArea.getBoundingClientRect();
    const gridX = (clientX - rect.left) + this.container.scrollLeft;
    const snap = this.snapValue;
    const raw = gridX / (COL_WIDTH * 4);
    let beat = Math.round(raw * snap) / snap;
    return Math.max(0.125, Math.min(TOTAL_BEATS, beat));
  }

  _clientToKey(clientY) {
    const rect = this._notesArea.getBoundingClientRect();
    const gridY = (clientY - rect.top) + this.container.scrollTop;
    let key = TOTAL_KEYS - 1 - Math.floor(gridY / KEY_HEIGHT);
    return Math.max(0, Math.min(TOTAL_KEYS - 1, key));
  }

  // ──────────────────── Events ────────────────────

  _bindEvents() {
    // 网格点击（画笔/橡皮）
    this._notesArea.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (e.target.closest('.note-wrapper')) return; // 音符由独立的 mousedown 处理
      this._onGridMouseDown(e);
    });

    // 全局鼠标
    document.addEventListener('mousemove', e => this._onMouseMove(e));
    document.addEventListener('mouseup', e => this._onMouseUp(e));

    // 音符点击/选中（用 mousedown 以便区分点击和拖拽）
    this._notesArea.addEventListener('mousedown', e => {
      const wrapper = e.target.closest('.note-wrapper');
      if (!wrapper) return;
      if (e.target.closest('.resize-handle')) return; // resize 单独处理
      this._onNoteMouseDown(e, wrapper);
    });

    // Delete/Backspace 删除选中音符
    document.addEventListener('keydown', e => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // 不拦截输入框里的删除
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        this._deleteSelectedNotes();
      }
    });
  }

  _onGridMouseDown(e) {
    if (this.tool === 'pencil') {
      const track = this.currentTrack;
      if (!track) return;
      this.selectedNoteKeys.clear();
      const { key, beat } = this._clientToGrid(e.clientX, e.clientY);
      track.addNote(key, beat, this.snapValue);
      this._renderNotes();
      this._emitChange();
    } else if (this.tool === 'erase') {
      const { key, beat } = this._clientToGrid(e.clientX, e.clientY);
      const track = this.currentTrack;
      if (!track) return;
      const note = track.notes.find(n => Math.abs(n.beat - beat) < 0.1 && n.key === key);
      if (note) {
        track.removeNote(note.id);
        this.selectedNoteKeys.clear();
        this._renderNotes();
        this._emitChange();
      }
    }
  }

  _onNoteMouseDown(e, wrapper) {
    const trackId = parseInt(wrapper.dataset.trackId);
    const noteId = parseInt(wrapper.dataset.noteId);
    const key = `${trackId}:${noteId}`;

    // 点击非活跃音轨的音符 → 切过去
    if (trackId !== this.activeTrackId) {
      this.activeTrackId = trackId;
      this.selectedNoteKeys.clear();
    }

    // 多选
    if (e.ctrlKey || e.metaKey) {
      if (this.selectedNoteKeys.has(key)) {
        this.selectedNoteKeys.delete(key);
        this._renderNotes();
        this._emitChange();
        return;
      }
      this.selectedNoteKeys.add(key);
      this._renderNotes();
      return;
    }

    // 如果点击的音符没被选中，清空其他选中
    if (!this.selectedNoteKeys.has(key)) {
      this.selectedNoteKeys.clear();
      this.selectedNoteKeys.add(key);
      this._renderNotes();
    }

    // 记录拖拽开始位置
    const track = this.trackManager.tracks.find(t => t.id === trackId);
    const note = track?.notes.find(n => n.id === noteId);
    if (!track || !note) return;

    const noteX = note.beat * COL_WIDTH * 4;
    const noteY = (TOTAL_KEYS - 1 - note.key) * KEY_HEIGHT;
    const rect = this._notesArea.getBoundingClientRect();

    this.dragState = {
      type: 'move',
      noteId,
      trackId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNote: { key: note.key, beat: note.beat },
      startNoteX: noteX,
      startNoteY: noteY,
      moved: false,
    };
  }

  _startResizeDebounced(e, wrapper, note, trackId) {
    this.dragState = {
      type: 'resize',
      noteId: note.id,
      trackId,
      startMouseX: e.clientX,
      startDuration: note.duration,
      moved: false,
    };
  }

  _onMouseMove(e) {
    if (!this.dragState) return;
    this.dragState.moved = true;

    if (this.dragState.type === 'move') {
      this._handleNoteDrag(e);
    } else if (this.dragState.type === 'resize') {
      this._handleNoteResize(e);
    }
  }

  _handleNoteDrag(e) {
    const ds = this.dragState;
    const dtBeat = (e.clientX - ds.startMouseX) / (COL_WIDTH * 4);
    const dtKey = -(e.clientY - ds.startMouseY) / KEY_HEIGHT;

    const track = this.trackManager.tracks.find(t => t.id === ds.trackId);
    if (!track) return;
    const note = track.notes.find(n => n.id === ds.noteId);
    if (!note) return;

    const snap = this.snapValue;
    let newBeat = Math.round((ds.startNote.beat + dtBeat) * snap) / snap;
    let newKey = Math.round(ds.startNote.key + dtKey);

    newBeat = Math.max(0, Math.min(TOTAL_BEATS - note.duration, newBeat));
    newKey = Math.max(0, Math.min(TOTAL_KEYS - 1, newKey));

    // 同步移动所有选中的音符（同音轨）
    const deltaBeat = newBeat - note.beat;
    const deltaKey = newKey - note.key;

    for (const selectedKey of this.selectedNoteKeys) {
      const [selTid, selNid] = selectedKey.split(':').map(Number);
      if (selTid !== ds.trackId) continue;
      const selTrack = this.trackManager.tracks.find(t => t.id === selTid);
      const selNote = selTrack?.notes.find(n => n.id === selNid);
      if (!selNote) continue;
      const nb = Math.round((selNote.beat + deltaBeat) * snap) / snap;
      const nk = Math.round(selNote.key + deltaKey);
      selNote.beat = Math.max(0, Math.min(TOTAL_BEATS - selNote.duration, nb));
      selNote.key = Math.max(0, Math.min(TOTAL_KEYS - 1, nk));
    }

    this._renderNotes();
  }

  _handleNoteResize(e) {
    const ds = this.dragState;
    const newBeat = this._clientToBeat(e.clientX);
    const snap = this.snapValue;
    let newDuration = Math.round((newBeat - this._clientToBeat(ds.startMouseX) + ds.startDuration) * snap) / snap;
    newDuration = Math.max(0.125, Math.min(16, newDuration));

    const track = this.trackManager.tracks.find(t => t.id === ds.trackId);
    if (!track) return;
    const note = track.notes.find(n => n.id === ds.noteId);
    if (!note) return;

    // 限制不超过右边界
    if (note.beat + newDuration > TOTAL_BEATS) {
      newDuration = TOTAL_BEATS - note.beat;
    }
    note.duration = Math.max(0.125, newDuration);
    this._renderNotes();
  }

  _onMouseUp(e) {
    if (this.dragState && this.dragState.moved) {
      this._emitChange();
    }
    this.dragState = null;
  }

  _deleteSelectedNotes() {
    if (this.selectedNoteKeys.size === 0) return;

    for (const key of this.selectedNoteKeys) {
      const [trackId, noteId] = key.split(':').map(Number);
      const track = this.trackManager.tracks.find(t => t.id === trackId);
      if (track) track.removeNote(noteId);
    }
    this.selectedNoteKeys.clear();
    this._renderNotes();
    this._emitChange();
  }

  // ──────────────────── Transport ────────────────────

  _bindTransport() {
    this.transport.on('beat', beat => this._updatePlayhead(beat));
    this.transport.on('play', () => this._playhead.style.display = 'block');
    this.transport.on('pause', () => { this._playhead.style.display = 'block'; });
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
    this.trackManager.on('tracksChanged', () => this.render());
  }

  setActiveTrack(trackId) {
    this.activeTrackId = trackId;
    this.selectedNoteKeys.clear();
    this._emitChange();
    this.render();
  }

  // ──────────────────── API ────────────────────

  setTool(tool) {
    this.tool = tool;
    this._notesArea.style.cursor = tool === 'pencil' ? 'crosshair' :
      tool === 'erase' ? 'pointer' : 'auto';
  }

  setSnap(index) {
    this.snapIndex = index;
  }

  onNotesChange(fn) {
    this._onNotesChange = fn;
  }

  _emitChange() {
    if (this._onNotesChange) this._onNotesChange();
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
