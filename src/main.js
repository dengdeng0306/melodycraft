import './style.css';
import { PianoRoll } from './core/PianoRoll.js';
import { Transport } from './core/Transport.js';
import { TrackManager } from './core/TrackManager.js';
import { AudioEngine } from './audio/AudioEngine.js';
import { ProjectManager } from './core/ProjectManager.js';

const app = document.getElementById('app');

// ─── 初始化核心模块 ───

const transport = new Transport();
const trackManager = new TrackManager();
const audioEngine = new AudioEngine();
const projectManager = new ProjectManager();

// ─── 构建 UI ───

app.innerHTML = `
  <div class="app">
    <!-- Top Bar -->
    <div class="topbar">
      <div class="topbar-left">
        <div class="logo">🎵 MelodyCraft <span class="logo-sub">· 音乐工坊</span></div>
        <div class="divider"></div>
        <input id="projectName" class="project-name" value="未命名项目" maxlength="30" />
        <span id="dirtyIndicator" class="dirty-indicator"></span>
      </div>
      <div class="topbar-center">
        <button class="tool-btn active" data-tool="pencil">✏️ 画笔</button>
        <button class="tool-btn" data-tool="select">👆 选择</button>
        <button class="tool-btn" data-tool="erase">🧹 橡皮</button>
        <div class="divider"></div>
        <span class="snap-label">吸附:</span>
        <button class="tool-btn active" data-snap="0">1/1</button>
        <button class="tool-btn" data-snap="1">1/2</button>
        <button class="tool-btn" data-snap="2">1/4</button>
      </div>
      <div class="topbar-right">
        <span id="timeDisplay">00:00.000</span>
        <div class="bpm-control">
          <span>BPM</span>
          <input type="number" id="bpmInput" value="120" min="40" max="240" />
        </div>
        <button id="playBtn">▶</button>
        <button id="stopBtn">⏹</button>
        <div class="divider"></div>
        <button id="newProjectBtn" class="btn-secondary">📄 新建</button>
        <button id="saveBtn" class="btn-secondary">💾 保存</button>
        <button id="loadBtn" class="btn-secondary">📂 打开</button>
        <button id="exportBtn" class="btn-secondary">📤 导出</button>
      </div>
    </div>

    <!-- Load/Save Dialog -->
    <div id="projectDialog" class="dialog-overlay" style="display:none;">
      <div class="dialog">
        <div class="dialog-header">
          <span>📂 打开项目</span>
          <button id="dialogClose" class="btn-icon">✕</button>
        </div>
        <div id="projectList" class="dialog-body">
          <div class="empty-state">暂无保存的项目</div>
        </div>
        <div class="dialog-footer">
          <span id="storageInfo" class="storage-info"></span>
        </div>
      </div>
    </div>

    <div class="main-layout">
      <!-- Track Panel -->
      <div class="track-panel" id="trackPanel">
        <div class="track-panel-header">
          <span>音轨</span>
          <button id="addTrackBtn" class="btn-sm">＋</button>
        </div>
        <div id="trackList"></div>
      </div>
      <div class="workspace" id="workspace">
        <div id="pianoRollContainer"></div>
      </div>
    </div>
  </div>
`;

// ─── 项目状态 ───

let currentProjectId = null;
let currentProjectName = '未命名项目';
let dirty = false; // 是否有未保存修改

function markDirty() {
  dirty = true;
  updateTitleDisplay();
}

function markClean() {
  dirty = false;
  updateTitleDisplay();
}

function updateTitleDisplay() {
  const el = document.getElementById('projectName');
  if (document.activeElement !== el) el.value = currentProjectName;
  const indicator = document.getElementById('dirtyIndicator');
  indicator.textContent = dirty ? '未保存' : '';
  indicator.style.display = dirty ? 'inline' : 'none';
}

// ─── PianoRoll ───

const pianoRoll = new PianoRoll('pianoRollContainer', transport, trackManager);

pianoRoll.onNotesChange(() => markDirty());

// ─── 初始音轨（首次运行才添加示例） ───

const isFirstRun = !localStorage.getItem('melodycraft_has_visited');

trackManager.addTrack('音轨 1');
pianoRoll.activeTrackId = trackManager.tracks[0].id;

if (isFirstRun) {
  // 首次访问：添加示例音符，帮助用户了解怎么用
  const t0 = trackManager.tracks[0];
  t0.addNote(60, 0, 1);
  t0.addNote(62, 1, 0.5);
  t0.addNote(64, 2, 1);
  t0.addNote(67, 4, 2);
  t0.addNote(67, 6, 2);
  t0.name = '示例旋律';

  trackManager.addTrack('示例和弦');
  const t1 = trackManager.tracks[1];
  t1.addNote(48, 0, 2);
  t1.addNote(52, 2, 2);
  t1.addNote(55, 4, 2);
  t1.addNote(55, 6, 2);
  t1.instrumentType = 'organ';
  t1.volume = 0.15;

  pianoRoll.activeTrackId = trackManager.tracks[0].id;
  localStorage.setItem('melodycraft_has_visited', 'true');
}

// ─── 音轨面板 ───

function renderTrackList() {
  const list = document.getElementById('trackList');
  list.innerHTML = '';
  for (const track of trackManager.tracks) {
    const isActive = track.id === pianoRoll.activeTrackId;
    const item = document.createElement('div');
    item.className = `track-item ${isActive ? 'active' : ''}`;
    item.dataset.trackId = track.id;
    item.innerHTML = `
      <div class="track-color" style="background:${track.color};width:4px;height:100%;position:absolute;left:0;top:0;border-radius:3px 0 0 3px;"></div>
      <div class="track-info">
        <input class="track-name" value="${track.name}" spellcheck="false" />
        <div class="track-controls">
          <select class="track-instrument">
            <option value="piano" ${track.instrumentType === 'piano' ? 'selected' : ''}>🎹 钢琴</option>
            <option value="organ" ${track.instrumentType === 'organ' ? 'selected' : ''}>🎹 风琴</option>
            <option value="flute" ${track.instrumentType === 'flute' ? 'selected' : ''}>🎵 长笛</option>
            <option value="bass" ${track.instrumentType === 'bass' ? 'selected' : ''}>🎸 贝斯</option>
          </select>
          <input type="range" class="track-volume" min="0" max="1" step="0.05" value="${track.volume}" />
          <button class="btn-icon mute-btn" data-muted="${track.muted}">${track.muted ? '🔇' : '🔊'}</button>
          <button class="btn-icon solo-btn" data-solo="${track.solo}">${track.solo ? '⭐' : '☆'}</button>
          <button class="btn-icon delete-track-btn" ${trackManager.tracks.length <= 1 ? 'disabled' : ''}>✕</button>
        </div>
      </div>
    `;
    item.addEventListener('click', e => {
      if (e.target.closest('.track-controls')) return;
      pianoRoll.setActiveTrack(track.id);
      renderTrackList();
    });
    item.querySelector('.track-name').addEventListener('change', e => {
      trackManager.renameTrack(track.id, e.target.value);
      markDirty();
    });
    item.querySelector('.track-instrument').addEventListener('change', e => {
      trackManager.setInstrumentType(track.id, e.target.value);
      markDirty();
    });
    item.querySelector('.track-volume').addEventListener('input', e => {
      trackManager.setVolume(track.id, parseFloat(e.target.value));
      markDirty();
    });
    item.querySelector('.mute-btn').addEventListener('click', e => {
      e.stopPropagation();
      trackManager.toggleMute(track.id);
      markDirty();
      renderTrackList();
    });
    item.querySelector('.solo-btn').addEventListener('click', e => {
      e.stopPropagation();
      trackManager.toggleSolo(track.id);
      markDirty();
      renderTrackList();
    });
    item.querySelector('.delete-track-btn').addEventListener('click', e => {
      e.stopPropagation();
      trackManager.removeTrack(track.id);
      markDirty();
      renderTrackList();
    });
    list.appendChild(item);
  }
}

// ─── 项目名编辑 ───

document.getElementById('projectName').addEventListener('change', e => {
  const name = e.target.value.trim() || '未命名项目';
  currentProjectName = name;
  markDirty();
});

document.getElementById('projectName').addEventListener('keydown', e => {
  if (e.key === 'Enter') e.target.blur();
});

trackManager.on('tracksChanged', renderTrackList);
renderTrackList();
document.getElementById('addTrackBtn').addEventListener('click', () => {
  trackManager.addTrack();
  markDirty();
  renderTrackList();
});

// ─── 工具按钮 ───

document.querySelectorAll('[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pianoRoll.setTool(btn.dataset.tool);
  });
});

document.querySelectorAll('[data-snap]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-snap]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pianoRoll.setSnap(parseInt(btn.dataset.snap));
  });
});

// ─── 播放控制 ───

const playBtn = document.getElementById('playBtn');
playBtn.addEventListener('click', async () => {
  if (transport.playing) {
    transport.pause();
    playBtn.textContent = '▶';
    return;
  }
  await audioEngine.init();
  audioEngine.loadTracks(trackManager.tracks.filter(t => {
    const hasSolo = trackManager.tracks.some(t2 => t2.solo);
    if (hasSolo) return t.solo && !t.muted;
    return !t.muted;
  }), transport.bpm);
  transport.play();
  audioEngine.play();
  playBtn.textContent = '⏸';
});

document.getElementById('stopBtn').addEventListener('click', () => {
  transport.stop();
  audioEngine.stop();
  playBtn.textContent = '▶';
});

document.getElementById('bpmInput').addEventListener('change', e => {
  const bpm = parseInt(e.target.value) || 120;
  transport.setBpm(bpm);
  audioEngine.setBpm(bpm);
  markDirty();
});

transport.on('beat', beat => {
  const mins = Math.floor(beat / 60);
  const secs = Math.floor(beat % 60);
  const ms = Math.floor((beat % 1) * 1000);
  document.getElementById('timeDisplay').textContent =
    `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
});

transport.on('stop', () => { playBtn.textContent = '▶'; });

// ─── 项目加载/保存 ───

function saveProject() {
  try {
    const tracks = trackManager.tracks;
    const bpm = transport.bpm;
    let result;
    if (currentProjectId) {
      result = projectManager.saveCurrent(currentProjectName, tracks, bpm, currentProjectId);
    } else {
      result = projectManager.save(currentProjectName, tracks, bpm);
    }
    currentProjectId = result.id;
    currentProjectName = result.name;
    markClean();
    showToast('✅ 已保存');
  } catch (e) {
    showToast('❌ ' + e.message);
  }
}

function loadProject(id) {
  const data = projectManager.load(id);
  if (!data) { showToast('❌ 项目加载失败'); return; }

  // 清空并重建
  trackManager.tracks = [];
  let colorIdx = 0;
  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  for (const t of data.tracks) {
    const track = trackManager.addTrack(t.name || '音轨');
    track.color = t.color || COLORS[colorIdx % COLORS.length];
    track.instrumentType = t.instrumentType || 'piano';
    track.volume = t.volume ?? 0.3;
    track.muted = !!t.muted;
    track.solo = !!t.solo;
    if (t.notes) {
      track.notes = t.notes.map(n => ({
        id: n.id || track._nextNoteId(),
        key: n.key,
        beat: n.beat,
        duration: n.duration,
      }));
    }
    colorIdx++;
  }

  transport.setBpm(data.bpm || 120);
  document.getElementById('bpmInput').value = data.bpm || 120;

  currentProjectId = data.id;
  currentProjectName = data.name || '未命名项目';
  markClean();
  pianoRoll.setActiveTrack(trackManager.tracks[0]?.id);
  pianoRoll.render();
  renderTrackList();
  closeDialog();
  showToast('📂 已打开: ' + currentProjectName);
}

function renderProjectList() {
  const list = document.getElementById('projectList');
  const projects = projectManager.listProjects();
  list.innerHTML = '';

  if (projects.length === 0) {
    list.innerHTML = '<div class="empty-state">暂无保存的项目</div>';
    return;
  }

  for (const p of projects) {
    const isCurrent = p.id === currentProjectId;
    const item = document.createElement('div');
    item.className = `project-item ${isCurrent ? 'active' : ''}`;
    item.innerHTML = `
      <div class="project-item-info">
        <div class="project-item-name">${p.name}</div>
        <div class="project-item-meta">
          ${p.trackCount} 音轨 · ${p.noteCount} 音符
          · ${new Date(p.updatedAt).toLocaleString('zh-CN')}
        </div>
      </div>
      <button class="btn-icon delete-project-btn" title="删除">🗑</button>
    `;

    item.addEventListener('click', e => {
      if (e.target.closest('.delete-project-btn')) return;
      loadProject(p.id);
    });

    item.querySelector('.delete-project-btn').addEventListener('click', e => {
      e.stopPropagation();
      if (confirm(`删除「${p.name}」？`)) {
        projectManager.delete(p.id);
        if (p.id === currentProjectId) {
          currentProjectId = null;
          currentProjectName = '未命名项目';
          markClean();
        }
        renderProjectList();
        updateStorageInfo();
      }
    });

    list.appendChild(item);
  }
}

function updateStorageInfo() {
  const info = projectManager.getStorageInfo();
  document.getElementById('storageInfo').textContent =
    `📊 ${info.projectCount} 个项目 · 约 ${info.usedMB} MB`;
}

function openDialog() {
  renderProjectList();
  updateStorageInfo();
  document.getElementById('projectDialog').style.display = 'flex';
}

function closeDialog() {
  document.getElementById('projectDialog').style.display = 'none';
}

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => toast.classList.remove('show'), 2000);
}

// 新建项目
document.getElementById('newProjectBtn').addEventListener('click', () => {
  if (dirty && !confirm('当前项目未保存，新建将丢弃修改。确定？')) return;
  trackManager.tracks = [];
  currentProjectId = null;
  currentProjectName = '未命名项目';
  trackManager.addTrack('音轨 1');
  pianoRoll.setActiveTrack(trackManager.tracks[0]?.id);
  pianoRoll.render();
  renderTrackList();
  document.getElementById('bpmInput').value = 120;
  transport.setBpm(120);
  markClean();
  showToast('📄 新建项目');
});

// 保存
document.getElementById('saveBtn').addEventListener('click', saveProject);

// 快捷键 Ctrl+S 保存
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    saveProject();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
    e.preventDefault();
    openDialog();
  }
});

// 打开
document.getElementById('loadBtn').addEventListener('click', openDialog);

// 对话框关闭
document.getElementById('dialogClose').addEventListener('click', closeDialog);
document.getElementById('projectDialog').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDialog();
});

// ─── 导出 ───

document.getElementById('exportBtn').addEventListener('click', async () => {
  const btn = document.getElementById('exportBtn');
  btn.textContent = '⏳ 渲染中...';
  btn.disabled = true;
  try {
    await audioEngine.init();
    const blob = await audioEngine.exportWav(trackManager.tracks, transport.bpm);
    if (!blob) throw new Error('没有音符可导出');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentProjectName.replace(/\s+/g, '_')}.wav`;
    a.click();
    URL.revokeObjectURL(url);
    btn.textContent = '✅ 已导出';
    setTimeout(() => { btn.textContent = '📤 导出'; btn.disabled = false; }, 2000);
  } catch (err) {
    btn.textContent = '❌ 导出失败';
    setTimeout(() => { btn.textContent = '📤 导出'; btn.disabled = false; }, 2000);
  }
});

console.log('🎵 MelodyCraft loaded');
