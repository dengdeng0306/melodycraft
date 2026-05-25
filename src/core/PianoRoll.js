/**
 * PianoRoll — 钢琴卷帘核心渲染与交互
 */
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const TOTAL_KEYS = 48;
const KEY_HEIGHT = 20;
const COL_WIDTH = 30;
const TOTAL_BARS = 8;
const BEATS_PER_BAR = 4;
const TOTAL_BEATS = TOTAL_BARS * BEATS_PER_BAR;
const SNAP_DIVISIONS = [1, 2, 4]; // whole, half, quarter beat snapping

export class PianoRoll {
  constructor(containerId, transport) {
    this.container = document.getElementById(containerId);
    this.transport = transport;
    this.notes = [];
    this.selectedNoteIds = new Set();
    this.snapIndex = 2; // default 1/4 snap
    this.tool = 'pencil'; // pencil | select | erase
    this.dragState = null;
    this.nextId = 1;

    this.TOTAL_PX = TOTAL_KEYS * KEY_HEIGHT + 30; // +30 bottom label row
    this.WIDTH = TOTAL_BEATS * 4 * COL_WIDTH + 50; // +50 key labels

    this._createDOM();
    this._bindEvents();
    this._bindTransport();
    this.render();
  }

  get snapValue() { return SNAP_DIVISIONS[this.snapIndex]; }

  // ──────────────────── DOM Construction ────────────────────

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

    // Ghost note (for drag preview)
    this._ghost = document.createElement('div');
    this._ghost.className = 'note-ghost';
    this._ghost.style.display = 'none';
    this._notesArea.appendChild(this._ghost);

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
    for (const note of this.notes) {
      const el = this._createNoteElement(note);
      this._notesArea.appendChild(el);
    }
  }

  _createNoteElement(note) {
    const el = document.createElement('div');
    el.className = 'note';
    el.dataset.id = note.id;
    const x = note.beat * COL_WIDTH * 4;
    const y = (TOTAL_KEYS - 1 - note.key) * KEY_HEIGHT + 2;
    const w = Math.max(4, note.duration * COL_WIDTH * 4);
    el.style.cssText = `
      position:absolute; left:${x}px; top:${y}px; width:${w}px; height:${KEY_HEIGHT - 4}px;
      border-radius:3px; cursor:pointer; z-index:2;
      background:${note.color || '#3b82f6'};
      opacity:${this.selectedNoteIds.has(note.id) ? 1 : 0.7};
      box-shadow:${this.selectedNoteIds.has(note.id) ? '0 0 0 2px rgba(255,255,255,0.5)' : 'none'};
    `;
    return el;
  }

  addNote(key, beat, duration = 1, color = '#3b82f6') {
    const id = this.nextId++;
    this.notes.push({ id, key, beat, duration, color });
    this._renderNotes();
    return id;
  }

  removeNote(id) {
    this.notes = this.notes.filter(n => n.id !== id);
    this.selectedNoteIds.delete(id);
    this._renderNotes();
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

  // ──────────────────── Event Binding ────────────────────

  _bindEvents() {
    // Mouse events on notes area
    this._notesArea.addEventListener('mousedown', e => this._onMouseDown(e));
    document.addEventListener('mousemove', e => this._onMouseMove(e));
    document.addEventListener('mouseup', e => this._onMouseUp(e));

    // Click existing notes via delegation
    this._notesArea.addEventListener('click', e => {
      const noteEl = e.target.closest('.note');
      if (noteEl) {
        const id = parseInt(noteEl.dataset.id);
        if (e.ctrlKey || e.metaKey) {
          this.selectedNoteIds.has(id) ? this.selectedNoteIds.delete(id) : this.selectedNoteIds.add(id);
        } else {
          this.selectedNoteIds.clear();
          this.selectedNoteIds.add(id);
        }
        this._renderNotes();
      }
    });
  }

  _onMouseDown(e) {
    // ignore clicks on notes (handled by click delegation)
    if (e.target.closest('.note')) return;

    if (e.button !== 0) return; // left click only

    const { key, beat } = this._clientToGrid(e.clientX, e.clientY);

    if (this.tool === 'pencil') {
      // Add note
      this.addNote(key, beat, this.snapValue);
    } else if (this.tool === 'erase') {
      // Remove note at this position
      const note = this.notes.find(n =>
        Math.abs(n.beat - beat) < 0.1 && n.key === key
      );
      if (note) this.removeNote(note.id);
    } else if (this.tool === 'select') {
      // Start drag selection
      this.dragState = { type: 'select', startX: e.clientX, startY: e.clientY };
    }
  }

  _onMouseMove(e) {
    if (!this.dragState) return;
  }

  _onMouseUp(e) {
    if (!this.dragState) return;
    this.dragState = null;
  }

  // ──────────────────── Transport Binding ────────────────────

  _bindTransport() {
    this.transport.on('beat', beat => {
      this._updatePlayhead(beat);
    });
    this.transport.on('play', () => {
      this._playhead.style.display = 'block';
    });
    this.transport.on('pause', () => {
      this._playhead.style.display = 'block';
    });
    this.transport.on('stop', () => {
      this._playhead.style.display = 'none';
      this._updatePlayhead(0);
    });
  }

  _updatePlayhead(beat = 0) {
    const x = beat * COL_WIDTH * 4;
    this._playhead.style.left = x + 'px';
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

  getProjectData() {
    return {
      bpm: this.transport.bpm,
      notes: this.notes,
    };
  }

  loadProjectData(data) {
    this.notes = data.notes || [];
    this.nextId = this.notes.length + 1;
    this.transport.setBpm(data.bpm || 120);
    this.render();
  }
}
