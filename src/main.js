import './style.css';
import { PianoRoll } from './core/PianoRoll.js';
import { Transport } from './core/Transport.js';
import { AudioEngine } from './audio/AudioEngine.js';

const app = document.getElementById('app');

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

    <!-- Workspace -->
    <div class="workspace" id="workspace">
      <div id="pianoRollContainer"></div>
    </div>
  </div>
`;

// ─── 初始化核心模块 ───

const transport = new Transport();
const audioEngine = new AudioEngine();
const pianoRoll = new PianoRoll('pianoRollContainer', transport);

// ─── UI 绑定 ───

// 工具按钮
document.querySelectorAll('[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pianoRoll.setTool(btn.dataset.tool);
  });
});

// 吸附按钮
document.querySelectorAll('[data-snap]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-snap]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pianoRoll.setSnap(parseInt(btn.dataset.snap));
  });
});

// 播放
const playBtn = document.getElementById('playBtn');
playBtn.addEventListener('click', async () => {
  if (transport.playing) {
    transport.pause();
    playBtn.textContent = '▶';
    return;
  }

  // 准备音频
  await audioEngine.init();
  audioEngine.loadNotes(pianoRoll.notes, transport.bpm);

  transport.play();
  audioEngine.play();
  playBtn.textContent = '⏸';
});

// 停止
document.getElementById('stopBtn').addEventListener('click', () => {
  transport.stop();
  audioEngine.stop();
  playBtn.textContent = '▶';
});

// BPM
document.getElementById('bpmInput').addEventListener('change', e => {
  const bpm = parseInt(e.target.value) || 120;
  transport.setBpm(bpm);
  audioEngine.setBpm(bpm);
});

// 时间显示
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

// 导出
document.getElementById('exportBtn').addEventListener('click', async () => {
  const btn = document.getElementById('exportBtn');
  btn.textContent = '⏳ 渲染中...';
  btn.disabled = true;

  try {
    await audioEngine.init();
    const blob = await audioEngine.exportWav(pianoRoll.notes, transport.bpm);
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

// 添加一些示例音符
pianoRoll.addNote(48, 0, 1);
pianoRoll.addNote(52, 1, 0.5);
pianoRoll.addNote(55, 1.5, 0.5);
pianoRoll.addNote(60, 2, 1);
pianoRoll.addNote(59, 3, 0.5);
pianoRoll.addNote(57, 3.5, 0.5);
pianoRoll.addNote(55, 4, 2);

console.log('🎵 MelodyCraft loaded!');
