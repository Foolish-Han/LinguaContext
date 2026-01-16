# LinguaContext

**LinguaContext** 是一个基于 AI 的沉浸式英语学习 Chrome 扩展。它通过智能分析单词在当前网页中的**语境 (Context)**，提供精准的释义、例句和发音，并支持一键收藏到生词本和云端同步。

## 🚀 核心功能

*   **语境感知解释**: AI 根据选中单词所在的句子提供释义，拒绝生搬硬套。
*   **流式响应**: 像 ChatGPT 一样实时显示 AI 的思考过程。
*   **神经语音 TTS**: 高质量的美式/英式发音朗读。
*   **生词本 Dashboard**: 现代化的管理面板，复习时可查看**原文语境**。
*   **云端同步**: 支持 Google Drive 同步，多设备数据一致。
*   **高度定制**: 支持自定义 AI Prompt 和快捷键。

## 🛠️ 安装指南 (开发者模式)

由于本项目尚未发布到 Chrome Web Store，你需要通过“加载已解压的扩展程序”来安装。

### 前置准备

1.  **获取源码**: 克隆或下载本项目到本地。
2.  **配置 API Key**:
    *   本项目依赖 **Volcengine (火山引擎)** 的 LLM 和 TTS 服务。
    *   打开 `src/config/config.js` 文件。
    *   将 `API_KEY` 替换为你自己的火山引擎 API Key。
    *   *(可选)* 配置 `GOOGLE_CLIENT_ID` 用于 Google Drive 同步（需在 Google Cloud Console 申请）。
    *   **⚠️ 注意**: 目前 Google Drive API 处于测试阶段 (Testing Mode)。如需使用同步功能，请联系开发者将您的 Google 邮箱加入白名单，否则无法授权登录。

### 安装步骤

1.  打开 Chrome 浏览器。
2.  在地址栏输入 `chrome://extensions/` 并回车。
3.  **开启开发者模式**:
    *   在页面右上角，找到 **"开发者模式" (Developer mode)** 开关并打开。
4.  **加载扩展**:
    *   点击左上角的 **"加载已解压的扩展程序" (Load unpacked)** 按钮。
    *   在弹出的文件选择窗口中，选择本项目所在的**根目录** (`LinguaContext` 文件夹)。
5.  **完成**:
    *   此时你应该能在扩展列表中看到 "LinguaContext"。
    *   浏览器工具栏会出现一个小图标（可能需要点击拼图图标将其固定）。

## 📖 使用说明

1.  **浏览网页**: 打开任意英文网页（例如 BBC, CNN, TechCrunch）。
2.  **划词**: 选中一个单词或短语。
3.  **解释**: 点击悬浮的 📖 图标，或按下快捷键 `e`。
4.  **朗读**: 点击悬浮的 🔊 图标，或按下快捷键 `p`。
5.  **生词本**: 点击浏览器右上角的扩展图标进入 Dashboard。

## 🏗️ 技术架构

*   **Manifest V3**: 最新 Chrome 扩展标准。
*   **Service Worker**: 后台任务处理与消息路由。
*   **Offscreen Document**: 音频播放解决方案。
*   **Native DOM Injection**: 无侵入式 UI 渲染。

详细文档请参阅 `docs/` 目录：
*   [产品手册 (Product Manual)](docs/product_manual.md)
*   [技术架构 (Architecture)](docs/architecture.md)

---
**License**: MIT
