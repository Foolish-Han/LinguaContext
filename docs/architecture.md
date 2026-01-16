# LinguaContext 技术架构文档

**版本**: v2.2  
**更新日期**: 2026-01-17

## 1. 系统概览

LinguaContext 是基于 **Google Chrome Extension Manifest V3** 架构开发的浏览器扩展。它采用模块化设计，利用现代 Web 技术栈（ES Modules, Async/Await）构建，旨在提供高性能、低侵入式的英语辅助学习体验。

### 核心特性
*   **Manifest V3**: 完全遵循 MV3 标准，使用 Service Worker 替代后台页面，提升性能和安全性。
*   **Offscreen Document**: 解决内容脚本中的音频播放 CSP 限制问题。
*   **Cloud Native**: 深度集成 Google Drive API 实现数据同步。
*   **Streaming AI**: 支持流式接收 LLM 响应，提升用户感知的响应速度。
*   **Context-Aware**: 独特的上下文提取与持久化机制。

---

## 2. 目录结构

```
src/
├── background/         # 后台服务 (Service Worker)
│   ├── service-worker.js   # 核心控制器，消息路由
│   └── google-drive.js     # Google Drive API 封装
├── content/            # 内容脚本 (注入页面)
│   ├── content-script.js   # DOM 监听、UI 渲染、事件处理
│   └── styles.css          # 注入 UI 的样式表
├── dashboard/          # 管理面板 (SPA)
│   ├── dashboard.html      # 结构 (App Header + View Sections)
│   ├── dashboard.css       # 样式
│   └── dashboard.js        # 逻辑 (视图切换、数据绑定)
├── offscreen/          # 离屏文档 (音频播放)
│   ├── offscreen.html
│   └── offscreen.js
├── services/           # 业务逻辑服务层
│   ├── llm.js              # LLM API 调用 (Volcengine)
│   └── tts.js              # TTS API 调用 (Volcengine)
├── config/             # 配置中心
│   └── config.js           # API Keys, Endpoints, Defaults
└── utils/              # 工具库
    └── logger.js           # 统一日志处理
docs/                   # 文档
manifest.json           # 扩展清单文件
```

---

## 3. 核心模块详解

### 3.1 Content Script (`content-script.js`)
*   **职责**: 负责与用户当前浏览的页面交互。
*   **核心逻辑**:
    *   **Context Extraction**: 遍历 DOM 树，智能提取选中文字所在的完整句子或段落。
        *   *优化*: 在触发解释的瞬间立即捕获上下文 (`currentContext`)，防止后续 DOM 变动导致丢失。
    *   **Overlay UI**: 使用直接注入 DOM 的方式创建悬浮窗。
        *   *交互优化*: "收藏"按钮在 AI 生成过程中自动隐藏 (`display: none`)，防止用户保存不完整数据。
    *   **Markdown Rendering**: 内置轻量级 Markdown 解析器，支持流式渲染 AI 返回的内容。

### 3.2 Service Worker (`service-worker.js`)
*   **职责**: 扩展的大脑，处理跨域请求、状态管理和消息转发。
*   **消息路由**:
    *   `FETCH_EXPLANATION`: 接收文本和语境 -> 调用 LLM Service -> 流式返回结果给 Content Script。
        *   *稳定性*: 收到请求后立即调用 `sendResponse` 保持连接活跃，防止浏览器因处理时间过长自动断开消息端口。
    *   `FETCH_TTS`: 接收文本 -> 调用 TTS Service -> 转发给 Offscreen 播放。
    *   `SYNC_DATA`: 处理 Google Drive 的上传/下载逻辑。

### 3.3 Dashboard (`dashboard/`)
*   **架构**: 单页应用 (SPA)。
*   **布局重构 (v2.2)**:
    *   **App Header**: 独立的顶部导航栏，承载全局状态（Logo, Sync, Settings）。
    *   **View Containers**: `list-view`, `detail-view`, `settings-view` 作为独立容器，通过 CSS 类名 (`.hidden`) 切换显示。
*   **逻辑**:
    *   **Context First**: 详情页渲染时，优先将 `word.context` 渲染在顶部高亮区域。
    *   **TTS Error Handling**: 改进了播放成功的判断逻辑，不再依赖返回的音频数据（因为 Offscreen 已播放），只检查 `success: true` 标志。

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
*   **触发**: 用户点击同步按钮或自动触发。
*   **冲突策略**:
    *   **生词 (Words)**: 自动合并 (Merge)，基于时间戳保留最新版本。
    *   **配置 (Settings)**: 若检测到差异，Service Worker 返回 `settingsConflict` 对象，Dashboard 弹出模态框展示 JSON 差异，用户选择后强制上传 (`forceUploadSettings: true`)。

---

## 5. 扩展与维护

*   **添加新 API**: 在 `config.js` 中配置 Key 和 Endpoint，在 `services/` 下新建服务文件。
*   **修改 UI**: 主要修改 `content-script.js` (Overlay) 和 `dashboard/` (管理页)。
*   **调试**:
    *   **Content Script**: 打开网页控制台 (F12)。
    *   **Service Worker**: 在 `chrome://extensions` 页面点击 "Service Worker" 查看视图。
    *   **Offscreen**: 在 `chrome://extensions` 页面可能有隐藏的入口，或通过 inspect tool 调试。

---
**LinguaContext Architecture Team**
