/**
 * ProjectManager — 项目保存与加载
 * 使用 localStorage 存储，支持多项目
 */

const STORAGE_KEY = 'melodycraft_projects';
const CURRENT_KEY = 'melodycraft_current_project';

export class ProjectManager {
  constructor() {
    this._projects = this._loadIndex();
  }

  /**
   * 获取所有项目列表
   */
  listProjects() {
    return this._projects.map(id => {
      const data = this._loadProject(id);
      if (!data) return null;
      return {
        id: data.id,
        name: data.name,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        trackCount: data.tracks ? data.tracks.length : 0,
        noteCount: data.tracks ? data.tracks.reduce((s, t) => s + (t.notes ? t.notes.length : 0), 0) : 0,
      };
    }).filter(Boolean).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  /**
   * 保存当前项目
   */
  save(name, tracks, bpm) {
    const id = this._genId();
    const project = {
      id,
      name: name || '未命名项目',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      bpm,
      tracks: tracks.map(t => ({
        name: t.name,
        color: t.color,
        instrumentType: t.instrumentType,
        volume: t.volume,
        muted: t.muted,
        solo: t.solo,
        notes: t.notes.map(n => ({ key: n.key, beat: n.beat, duration: n.duration, id: n.id })),
      })),
    };

    try {
      localStorage.setItem(this._projectKey(id), JSON.stringify(project));
      this._addToIndex(id);
      this.setCurrent(id);
      return project;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        throw new Error('存储空间不足，请先导出项目或删除旧项目');
      }
      throw e;
    }
  }

  /**
   * 保存当前项目（覆盖）
   */
  saveCurrent(name, tracks, bpm, currentId) {
    if (!currentId) return this.save(name, tracks, bpm);

    const project = {
      id: currentId,
      name: name || '未命名项目',
      createdAt: this._loadProject(currentId)?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      bpm,
      tracks: tracks.map(t => ({
        name: t.name,
        color: t.color,
        instrumentType: t.instrumentType,
        volume: t.volume,
        muted: t.muted,
        solo: t.solo,
        notes: t.notes.map(n => ({ key: n.key, beat: n.beat, duration: n.duration, id: n.id })),
      })),
    };

    try {
      localStorage.setItem(this._projectKey(currentId), JSON.stringify(project));
      this._addToIndex(currentId);
      this.setCurrent(currentId);
      return project;
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        throw new Error('存储空间不足');
      }
      throw e;
    }
  }

  /**
   * 加载项目
   */
  load(id) {
    return this._loadProject(id);
  }

  /**
   * 删除项目
   */
  delete(id) {
    localStorage.removeItem(this._projectKey(id));
    this._removeFromIndex(id);
    // 如果删除的是当前项目，清除 current
    if (this.getCurrent() === id) {
      localStorage.removeItem(CURRENT_KEY);
    }
  }

  /**
   * 设置当前项目 ID
   */
  setCurrent(id) {
    localStorage.setItem(CURRENT_KEY, id);
  }

  /**
   * 获取当前项目 ID
   */
  getCurrent() {
    return localStorage.getItem(CURRENT_KEY);
  }

  // ─── internal ───

  _genId() {
    return 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  }

  _projectKey(id) {
    return `melodycraft_proj_${id}`;
  }

  _loadIndex() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  _saveIndex() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._projects));
  }

  _addToIndex(id) {
    if (!this._projects.includes(id)) {
      this._projects.push(id);
      this._saveIndex();
    }
  }

  _removeFromIndex(id) {
    this._projects = this._projects.filter(p => p !== id);
    this._saveIndex();
  }

  _loadProject(id) {
    try {
      const raw = localStorage.getItem(this._projectKey(id));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * 统计存储使用情况
   */
  getStorageInfo() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('melodycraft')) {
        total += localStorage.getItem(key).length * 2; // UTF-16
      }
    }
    return {
      usedBytes: total,
      usedMB: (total / 1024 / 1024).toFixed(2),
      projectCount: this._projects.length,
    };
  }
}
