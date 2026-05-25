# 🎵 MelodyCraft · 音乐工坊

**面向普通音乐爱好者的可视化音乐创作工具。**

让没有乐理基础的人，也能在 10 分钟内做出一段属于自己的旋律。

---

## ✨ 核心理念

> 专业 DAW 太复杂，AI 一键生成没参与感。
> **MelodyCraft 取中间：乐高式的音乐创作。**

- 🎹 **钢琴卷帘** — 可视化编排旋律
- 🎸 **拖拽乐器** — 像搭积木一样组合音色
- 🤖 **AI 辅助** — 自动生成和弦/旋律/歌词
- 📝 **歌词编辑** — 边写词边谱曲
- 🔗 **一键分享** — 你的作品，立刻能听

---

## 🗺️ 项目蓝图

| 阶段 | 用户规模 | 目标 |
|------|---------|------|
| MVP | 0 → 1 万 | 钢琴卷帘 + 多音轨 + 导出 |
| V1.1 | 1 万 → 10 万 | 用户系统 + 云端存储 |
| V1.2 | 10 万 → 50 万 | AI 辅助 + 社区分享 |
| V2.0 | 50 万 → 100 万 | 移动端 + 全球化 |

详见 [`docs/百万用户架构蓝图.md`](docs/百万用户架构蓝图.md)

---

## 🏗️ 技术栈

| 层面 | 技术 |
|------|------|
| 前端 | HTML / CSS / JS |
| 音频引擎 | Web Audio API + Tone.js |
| 存储 | IndexedDB → Supabase |
| 托管 | GitHub Pages → Cloudflare |
| AI | API 接入 → 自建推理 |

---

## 🚀 快速开始

```bash
# 克隆仓库
git clone https://github.com/dengdeng0306/melodycraft.git
cd melodycraft

# 使用 Live Server 或 Python 启动
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

---

## 📄 许可

MIT License © 2026 dengdeng0306
