# Chrome 沉浸式英语学习助手 - Phase 1 开发计划

根据 `pruduct.md` (原 `product.md`) 的需求，我们将首先专注于 **Phase 1: 骨架与通信 (The Skeleton)**。目标是搭建 Manifest V3 基础结构，并打通 "选中 -> 显示图标 -> 弹出卡片" 的完整交互链路。

## 目录结构规划
我们将采用模块化结构，以支持后续的扩展。
```text
/
├── manifest.json            # 插件配置文件 (Manifest V3)
├── src/
│   ├── background/          # 模块 B: 大脑
│   │   └── service-worker.js
│   ├── content/             # 模块 A & C: 观察者 & 呈现层
│   │   ├── content-script.js
│   │   └── styles.css
│   └── utils/               # 通用工具 (后续使用)
└── assets/                  # 图标资源 (暂使用占位符)
```

## 实施步骤

### 1. 基础配置 (Manifest V3)
- 创建 `manifest.json`。
- 配置 `permissions` (如 `storage`, `activeTab` 等)。
- 配置 `content_scripts` 注入 `content-script.js` 和 `styles.css`。
- 配置 `background` service worker。

### 2. 模块 A: 观察者 (Content Script)
- 实现文本选择监听 (`mouseup` / `selectionchange`)。
- 计算选区坐标。
- 实现 "触发图标" (Trigger Icon) 的渲染与定位。
- **目标**: 用户选中文字后，鼠标附近出现图标。

### 3. 模块 C: 呈现层 (UI Components)
- 编写 `styles.css`，定义图标和卡片的样式 (Apple-like 风格)。
- 实现点击图标后弹出 "结果卡片" (Overlay) 的逻辑。
- 卡片暂时显示 "Loading..." 或占位内容。

### 4. 模块 B: 大脑 (Background & Messaging)
- 在 `service-worker.js` 中设置消息监听器 `chrome.runtime.onMessage`。
- 在 `content-script.js` 中实现点击图标发送消息给 Background。
- 验证 Content Script 与 Background 的通信链路 (Ping/Pong)。

## 验证标准
1.  加载插件后，在任意网页选中这文本，能看到浮动图标。
2.  点击图标，能看到浮动卡片弹出。
3.  (控制台) 确认 Content Script 成功发送消息，Background 成功接收并返回。

确认后，我将开始创建文件并编写代码。