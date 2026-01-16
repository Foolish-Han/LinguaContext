# Phase 3: 持久化 (The Wordbook) 开发计划

本阶段目标是实现生词本功能，允许用户收藏单词，并在独立的 Dashboard 页面进行回顾。

## 1. 架构扩展
-   **模块 D (Storage Layer)**: 封装 `chrome.storage.local` 操作。
-   **UI 扩展**:
    -   **Result Card**: 增加 "收藏 (Save)" 按钮，支持状态切换 (已收藏/未收藏)。
    -   **Dashboard**: 创建全新的 HTML 页面，用于以列表形式展示已保存的单词。

## 2. 详细实施步骤

### 2.1 模块 D: 金库 (Storage Utility)
-   创建 `src/utils/storage.js` (虽然 Manifest V3 推荐 ES Modules，但 Content Script 加载方式可能有限制，为简单起见，我们可能将其代码内联或作为独立脚本引入。考虑到复用性，我们可以在 `background` 和 `content` 中分别处理，或者使用 `chrome.storage` 直接操作。
-   **策略**:
    -   Content Script 负责发送 "SAVE_WORD" / "REMOVE_WORD" 消息给 Background。
    -   Background 负责实际的 `chrome.storage.local` 读写。
    -   理由：保持 Content Script 轻量，且 Background 拥有持久且统一的存储访问权。

### 2.2 更新 Content Script (UI 交互)
-   **Result Card**:
    -   在卡片右上角 (或合适位置) 添加 "收藏" 按钮 (星号图标)。
    -   点击收藏 -> 发送消息 `SAVE_WORD` -> 按钮变实心/高亮。
    -   初始化卡片时 -> 发送消息 `CHECK_IS_SAVED` -> 更新按钮状态。
-   **消息处理**:
    -   增加 `SAVE_WORD` 消息发送。
    -   增加 `CHECK_IS_SAVED` 消息发送。

### 2.3 更新 Background Service Worker (数据逻辑)
-   **数据结构**:
    ```json
    {
      "savedWords": {
        "word_id_timestamp": {
          "word": "...",
          "context": "...",
          "definition_en": "...",
          "timestamp": 1234567890
        }
      }
    }
    ```
-   **消息监听**:
    -   `SAVE_WORD`: 接收单词数据，存入 `chrome.storage.local`。
    -   `REMOVE_WORD`: 从存储中移除。
    -   `CHECK_IS_SAVED`: 检查单词是否已存在 (简单起见，按单词拼写匹配)。

### 2.4 Dashboard 页面
-   创建 `src/dashboard/dashboard.html`。
-   创建 `src/dashboard/dashboard.js`。
-   创建 `src/dashboard/dashboard.css`。
-   **功能**:
    -   加载时从 `chrome.storage.local` 读取所有单词。
    -   渲染单词列表 (卡片式布局)。
    -   支持删除操作。
-   **Manifest 更新**: 添加 `action` 的点击行为或右键菜单进入 Dashboard，或者作为一个 Options Page。根据需求描述 "用户在闲暇时打开插件的独立 Dashboard 页面"，通常做法是设为 `options_ui` 或通过点击插件图标弹出页面的链接跳转。
    -   *决策*: 既然 Action 点击已用于 Trigger (或无 Action 行为)，我们将 Dashboard 注册为 **Options Page**，或者在 Popup 中提供一个 "Open Dashboard" 的入口。考虑到 Phase 1 的设计是 "选中触发"，Browser Action 图标目前没有绑定 Popup。
    -   *方案*: 点击浏览器右上角插件图标 -> 打开 Dashboard。修改 `manifest.json` 的 `action`，使其点击时打开 `dashboard.html` (如果 Manifest V3 不允许 `action` 直接打开 tab，则需在 `background` 监听 `onClicked` 并 `chrome.tabs.create`)。
    -   *修正*: Manifest V3 `action` 通常弹出 Popup。为了体验更好，我们将 `dashboard.html` 设为点击插件图标直接打开的新标签页 (通过 Background 监听 `action.onClicked`，前提是没有 popup)。

## 3. 验证标准
1.  在网页卡片上点击 "收藏"，按钮状态更新。
2.  点击浏览器插件图标，打开 Dashboard 页面。
3.  Dashboard 页面能列出刚才收藏的单词。
4.  重启浏览器后数据依然存在 (持久化验证)。

## 4. 执行顺序
1.  Background: 实现 Storage 增删查逻辑。
2.  Content: 增加收藏按钮 UI 及逻辑。
3.  Dashboard: 创建页面及逻辑。
4.  Manifest: 配置 Action 行为。