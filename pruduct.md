项目规格书：Chrome 沉浸式英语学习助手
角色设定: 你是一位精通 Chrome 插件开发 (Manifest V3) 和 UI/UX 设计的资深工程师。 项目目标: 构建一个模块化、可增量开发的 Chrome 扩展，专注于通过“语境”进行英语学习。

1. 产品哲学与核心价值 (Core Philosophy)
我们要做的不是一个简单的翻译工具（如 Google Translate）。我们要构建的是一个学习助手。

语境为王 (Context-Aware): 核心价值在于利用 AI 解释单词或短语时，必须基于当前所在的句子/段落。解释内容需包含：上下文含义、发音、记忆法以及针对当前语境的用法。

极简交互 (Frictionless): 这是一个伴随式工具。用户在阅读时，交互必须极度克制：选中 -> 点击图标 -> 阅读卡片 -> 收藏 -> 关闭。绝不能打断用户的阅读心流。

数据私有 (Data Ownership): 用户是在构建自己的“个人生词本”。数据必须支持本地持久化，并为未来的云端同步（Google Drive）预留接口。

2. 用户旅程 (User Journey)
触发 (Trigger): 用户在任意网页选中一段文本。鼠标附近出现一个微小、不打扰的“助手图标”。

激活 (Activation): 用户点击图标。一个悬浮卡片 (Overlay) 立即弹出。

生成 (Generation): 插件将“选中的文本”+“所在的完整句子”发送给 AI API。

展示 (Display): 卡片展示结构化的学习内容（音标、语境释义、例句、记忆口诀）。

行动 (Action): 用户点击“收藏/星标”按钮，内容被保存。

回顾 (Review): 用户在闲暇时打开插件的独立 Dashboard 页面，复习已收藏的生词。

3. 模块化架构设计 (Modular Architecture)
为了保证代码的可维护性和扩展性，你必须采用模块化设计，严禁编写耦合度高的单体代码。请遵循以下关注点分离原则：

模块 A：观察者 (The Observer - Content Script)
职责: 监听 DOM 事件（文本选择），计算坐标，渲染“触发图标”，并动态注入结果悬浮层。

约束: 必须轻量化，不得阻塞主线程。

模块 B：大脑 (The Brain - Background Service Worker)
职责: 处理所有对外的通信（调用 LLM API）以及数据持久化逻辑（Storage API）。

理由: 绕过 CORS 限制，统一管理 API Key，作为前端 Content Script 的“服务端”。

模块 C：呈现层 (The Presenter - UI Components)
职责: 纯粹的 UI 渲染。

组件:

Trigger Button: 极简风格的图标。

Result Card: 现代化的卡片，需包含不同状态（加载中、成功、错误）。

Dashboard: 一个独立的 HTML 页面，用于以列表形式展示已保存的单词。

模块 D：金库 (The Vault - Storage Layer)
职责: 封装存储逻辑的抽象层。

设计: 初期使用 chrome.storage.local。数据结构设计必须规范化（JSON），以便后续阶段实现导出或 Google Drive 同步。

4. 增量开发策略 (Incremental Strategy)
重要提示: 不要试图一次性写完所有代码。我们将分阶段进行。我会在后续对话中逐步发布指令。

Phase 1: 骨架与通信 (The Skeleton)

搭建 Manifest V3 基础结构。

实现“选中 -> 显示图标 -> 打开空白悬浮层”的完整链路。

打通 Content Script 与 Background 之间的消息传递 (sendMessage)。

Phase 2: 接入智能 (Intelligence)

在 Background 中集成 LLM API (如 OpenAI/Gemini)。

设计 Prompt Engineering，确保 AI 输出适合程序解析的 JSON 格式（而非纯文本）。

前端美化展示 AI 返回的结果。

Phase 3: 持久化 (The Wordbook)

实现 chrome.storage.local 的增删改查。

实现前端的“收藏”按钮逻辑。

开发简易的 Dashboard 页面用于查看生词。

Phase 4: 云端同步 (Cloud Sync - Future)

集成 Google Drive API（此阶段暂不开发，但代码结构需预留位置）。

5. 技术约束与规范 (Technical Constraints)
标准: 必须强制使用 Manifest V3。

技术栈: 原生 JavaScript (ES6+) 或极轻量的构建方案（除非必要，否则避免复杂的 Webpack 配置）。

样式: 使用 CSS Variables 实现主题化。UI 风格追求“Apple-like”——干净、留白、柔和阴影、圆角。

代码质量: 关键逻辑必须添加注释，解释“为什么这样做”。保持函数单一职责。