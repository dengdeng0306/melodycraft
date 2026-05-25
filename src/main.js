import './style.css';
import { PianoRoll } from './core/PianoRoll.js';
import { Transport } from './core/Transport.js';
import { TrackManager } from './core/TrackManager.js';
import { AudioEngine } from './audio/AudioEngine.js';

const app = document.getElementById('app');

// ─── 初始化核心模块 ───

const transport = new Transport();
const trackManager = new TrackManager();
const audioEngine = new AudioEngine();

// ─── 构建 UI ───

app.innerHTML = `
  <div class="app">
    <!-- Top Bar -->
    <div class="topbar">
      <div class="topbar-left">
        <div class="logo">🎵 MelodyCraft <span class="logo-sub">· 音乐工坊</span></div>
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
        <button id="exportBtn" class="btn-secondary">📤 导出</button>
      </div>
    </div>

    <div class="main-layout">
      <!-- Track Panel (左侧边栏) -->
      <div class="track-panel" id="trackPanel">
        <div class="track-panel-header">
          <span>音轨</span>
          <button id="addTrackBtn" class="btn-sm">＋</button>
        </div>
        <div id="trackList"></div>
      </div>

      <!-- Workspace -->
      <div class="workspace" id="workspace">
        <div id="pianoRollContainer"></div>
      </div>
    </div>
  </div>
`;

// ─── PianoRoll 初始化 ───

const pianoRoll = new PianoRoll('pianoRollContainer', transport, trackManager);

// ─── 初始音轨 ───

trackManager.addTrack('旋律');
trackManager.addTrack('和弦');
pianoRoll.activeTrackId = trackManager.tracks[0].id;

// 示例音符
const t0 = trackManager.tracks[0];
t0.addNote(60, 0, 1);
t0.addNote(62, 1, 0.5);
t0.addNote(64, 2, 1);
t0.addNote(67, 4, 2);

const t1 = trackManager.tracks[1];
t1.addNote(48, 0, 2);
t1.addNote(52, 2, 2);
t1.addNote(55, 4, 2);
t1.instrumentType = 'square';

// ─── 音轨面板渲染 ───

function renderTrackList() {
  const list = document.getElementById('trackList');
  list.innerHTML = '';

  for (const track of trackManager.tracks) {
    const isActive = track.id === pianoRoll.activeTrackId;
    const item = document.createElement('div');
    item.className = `track-item ${isActive ? 'active' : ''}`;
    item.dataset.trackId = track.id;

    item.innerHTML = `
      <div class="track-color" style="background:${track.color}; width:4px; height:100%; position:absolute; left:0; top:0; border-radius:3px 0 0 3px;"></div>
      <div class="track-info">
        <input class="track-name" value="${track.name}" spellcheck="false" />
        <div class="track-controls">
          <select class="track-instrument">
            <option value="triangle" ${track.instrumentType === 'triangle' ? 'selected' : ''}>🔺 三角波</option>
            <option value="square" ${track.instrumentType === 'square' ? 'selected' : ''}>🔲 方波</option>
            <option value="sawtooth" ${track.instrumentType === 'sawtooth' ? 'selected' : ''}>🔻 锯齿波</option>
            <option value="sine" ${track.instrumentType === 'sine' ? 'selected' : ''}>〰️ 正弦波</option>
          </select>
          <input type="range" class="track-volume" min="0" max="1" step="0.05" value="${track.volume}" />
          <button class="btn-icon mute-btn" data-muted="${track.muted}">${track.muted ? '🔇' : '🔊'}</button>
          <button class="btn-icon solo-btn" data-solo="${track.solo}">${track.solo ? '⭐' : '☆'}</button>
          <button class="btn-icon delete-track-btn" ${trackManager.tracks.length <= 1 ? 'disabled' : ''}>✕</button>
        </div>
      </div>
    `;

    // 点击选中音轨
    item.addEventListener('click', e => {
      if (e.target.closest('.track-controls')) return;
      pianoRoll.setActiveTrack(track.id);
      renderTrackList();
    });

    // 重命名
    item.querySelector('.track-name').addEventListener('change', e => {
      trackManager.renameTrack(track.id, e.target.value);
    });

    // 切换音色
    item.querySelector('.track-instrument').addEventListener('change', e => {
      trackManager.setInstrumentType(track.id, e.target.value);
    });

    // 音量
    item.querySelector('.track-volume').addEventListener('input', e => {
      trackManager.setVolume(track.id, parseFloat(e.target.value));
    });

    // 静音
    item.querySelector('.mute-btn').addEventListener('click', e => {
      e.stopPropagation();
      trackManager.toggleMute(track.id);
      renderTrackList();
    });

    // 独奏
    item.querySelector('.solo-btn').addEventListener('click', e => {
      e.stopPropagation();
      trackManager.toggleSolo(track.id);
      renderTrackList();
    });

    // 删除
    item.querySelector('.delete-track-btn').addEventListener('click', e => {
      e.stopPropagation();
      const removed = trackManager.removeTrack(track.id);
      if (removed) {
        if (pianoRoll.activeTrackId === track.id) {
          pianoRoll.setActiveTrack(trackManager.tracks[0].id);
        }
        renderTrackList();
      }
    });

    list.appendChild(item);
  }
}

trackManager.on('tracksChanged', renderTrackList);
renderTrackList();

// 添加音轨
document.getElementById('addTrackBtn').addEventListener('click', () => {
  trackManager.addTrack();
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
});

// ─── 时间显示 ───

transport.on('beat', beat => {
  const mins = Math.floor(beat / 60);
  const secs = Math.floor(beat % 60);
  const ms = Math.floor((beat % 1) * 1000);
  document.getElementById('timeDisplay').textContent =
    `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}.${String(ms).padStart(3,'0')}`;
});

transport.on('stop', () => {
  playBtn.textContent = '▶';
});

// ─── 导出 ───

document.getElementById('exportBtn').addEventListener('click', async () => {
  const btn = document.getElementById('exportBtn');
  btn.textContent = '⏳ 渲染中...';
  btn.disabled = true;

  try {
    await audioEngine.init();
    const blob = await audioEngine.exportWav(trackManager.tracks, transport.bpm);
    if (!blob) { throw new Error('没有音符可导出'); }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'melodycraft-export.wav';
    a.click();
    URL.revokeObjectURL(url);
    btn.textContent = '✅ 已导出';
    setTimeout(() => { btn.textContent = '📤 导出'; btn.disabled = false; }, 2000);
  } catch (err) {
    console.error('Export failed:', err);
    btn.textContent = '❌ 导出失败';
    setTimeout(() => { btn.textContent = '📤 导出'; btn.disabled = false; }, 2000);
  }
});

console.log('🎵 MelodyCraft loaded —', trackManager.tracks.length, 'tracks');
