# LinguaContext 技术架构文档

**版本**: v2.3  
**更新日期**: 2026-01-23

## 1. 系统概览

LinguaContext 是基于 **Google Chrome Extension Manifest V3** 架构开发的浏览器扩展。它采用模块化设计，利用现代 Web 技术栈（ES Modules, Async/Await）构建，旨在提供高性能、低侵入式的英语辅助学习体验。

### 核心特性
*   **Manifest V3**: 完全遵循 MV3 标准，使用 Service Worker 替代后台页面，提升性能和安全性。
*   **Shadow DOM UI**: 使用 Shadow DOM 技术将 UI 注入宿主页面，彻底解决样式污染问题。
*   **Offscreen Document**: 解决内容脚本中的音频播放 CSP 限制问题。
*   **Cloud Native**: 深度集成 Google Drive API 实现数据同步。
*   **Streaming AI**: 支持流式接收 LLM 响应，提升用户感知的响应速度。
*   **Concurrency Control**: 使用 Mutex 互斥锁机制保证数据一致性。
*   **Context-Aware**: 独特的上下文提取与持久化机制。

---

## 2. 目录结构

```
src/
├── background/         # 后台服务 (Service Worker)
│   ├── service-worker.js   # 核心控制器，消息路由，Mutex 锁
│   └── google-drive.js     # Google Drive API 封装
├── content/            # 内容脚本 (注入页面)
│   ├── content-script.js   # ShadowHost 挂载、Shadow DOM 管理、事件处理
│   └── styles.css          # UI 样式表 (注入到 Shadow Root)
├── dashboard/          # 管理面板 (SPA)
│   ├── dashboard.html      # 结构 (App Header + View Sections)
│   ├── dashboard.css       # 样式
│   └── dashboard.js        # 逻辑 (视图切换、数据绑定、消息通信)
├── offscreen/          # 离屏文档 (音频播放)
│   ├── offscreen.html
│   └── offscreen.js
├── services/           # 业务逻辑服务层
│   ├── llm.js              # LLM API 调用 (Volcengine)
│   └── tts.js              # TTS API 调用 (Volcengine)
├── config/             # 配置中心
│   └── config.js           # API Keys, Endpoints, Defaults
└── utils/              # 工具库
    ├── logger.js           # 统一日志处理
    └── mutex.js            # 互斥锁实现
docs/                   # 文档
manifest.json           # 扩展清单文件
```

---

## 3. 核心模块详解

### 3.1 Content Script (`content-script.js`)
*   **职责**: 负责与用户当前浏览的页面交互。
*   **架构升级 (v2.3)**:
    *   **Shadow DOM**: 不再直接将 UI 元素追加到 `document.body`，而是创建一个 `ShadowHost` (`#linguacontext-shadow-host`) 挂载到 `document.documentElement`，并将所有 UI（浮窗、按钮）封装在 `ShadowRoot` 内。
    *   **样式隔离**: 彻底解决了宿主页面全局 CSS（如 `div { overflow: hidden }`）导致的浮窗样式错乱问题。
*   **核心逻辑**:
    *   **Context Extraction**: 遍历 DOM 树，智能提取选中文字所在的完整句子或段落。
    *   **Overlay UI**: 解释浮窗支持拖拽、固定 (Pin) 和最大高度限制 (80vh)。
    *   **Markdown Rendering**: 内置轻量级 Markdown 解析器，支持流式渲染 AI 返回的内容。

### 3.2 Service Worker (`service-worker.js`)
*   **职责**: 扩展的大脑，处理跨域请求、状态管理和消息转发。
*   **并发控制 (Mutex)**:
    *   引入 `src/utils/mutex.js`，在处理 `SAVE_WORD`, `REMOVE_WORD`, `SYNC_DATA`, `SAVE_SETTINGS` 等关键操作时加锁，防止竞态条件导致的数据覆盖。
*   **消息路由**:
    *   `FETCH_EXPLANATION`: 接收文本和语境 -> 调用 LLM Service -> 流式返回结果给 Content Script。
    *   `FETCH_TTS`: 接收文本 -> 调用 TTS Service -> 转发给 Offscreen 播放。
    *   `SYNC_DATA`: 处理 Google Drive 的同步逻辑。
    *   `SAVE_SETTINGS`: 统一处理设置保存，确保写入操作原子化。

### 3.3 Dashboard (`dashboard/`)
*   **架构**: 单页应用 (SPA)。
*   **数据流**:
    *   不再直接写入 `chrome.storage`，而是发送消息给 Background，由 Service Worker 统一调度写入，确保与同步逻辑不冲突。
*   **初始化**:
    *   加载时会自动检测本地数据，如果是空状态（且非初次安装），尝试自动从云端拉取备份 (`Auto-Pull`)。
*   **逻辑**:
    *   **Soft Delete**: 前端过滤掉 `isDeleted: true` 的单词，但保留在存储中以便同步删除状态到云端。

### 3.4 Offscreen Document (`offscreen/`)
*   **背景**: MV3 中 Content Script 受到宿主页面 CSP (Content Security Policy) 的严格限制，往往无法播放 `blob:` 或 `data:` 协议的音频。
*   **解决方案**: 创建一个独立的离屏 HTML 文档，它拥有扩展的特权上下文。Service Worker 将音频数据发送给 Offscreen，由 Offscreen 执行 `new Audio().play()`。

---

## 4. 数据流与同步

### 4.1 解释流程
1.  **User**: 选中网页文本 "epiphany"。
2.  **Content Script**: 捕获选中，提取上下文 "It was a moment of epiphany..."。
3.  **Message**: 发送 `FETCH_EXPLANATION` 到 Background。
4.  **Background**: 调用 `LLMService`。
5.  **LLMService**: 请求云端 API。
6.  **Stream**: 云端分块返回数据 -> Background -> Content Script -> 实时更新 UI。

### 4.2 同步流程 (Sync)
*   **策略**: **Local Master (本地为主)** + **Soft Delete (软删除)**。
*   **模式**:
    *   **PUSH (Backup)**: 本地数据发生变更（增删改）时，将本地快照完整推送到云端，覆盖云端旧备份。
    *   **PULL (Restore)**: 仅在手动点击“从云端恢复”或初始化检测到本地为空时触发，将云端数据拉取到本地。
*   **删除逻辑**:
    *   删除单词时，先在本地标记 `isDeleted: true` 并更新 `updatedAt`。
    *   立即触发 PUSH，将带有删除标记的数据同步到云端，确保云端备份也“记住”了这个删除操作。

---

## 5. 扩展与维护

*   **添加新 API**: 在 `config.js` 中配置 Key 和 Endpoint，在 `services/` 下新建服务文件。
*   **修改 UI**: 主要修改 `content-script.js` (Shadow DOM 内部结构) 和 `dashboard/` (管理页)。
*   **调试**:
    *   **Content Script**: 打开网页控制台 (F12)。
    *   **Service Worker**: 在 `chrome://extensions` 页面点击 "Service Worker" 查看视图。
    *   **Offscreen**: 在 `chrome://extensions` 页面可能有隐藏的入口，或通过 inspect tool 调试。

---
**LinguaContext Architecture Team**
