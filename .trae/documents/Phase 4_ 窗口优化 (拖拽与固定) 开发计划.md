# Phase 4: 窗口优化 (拖拽与固定) 开发计划

本阶段目标是提升用户体验，赋予用户对悬浮窗口的控制权，包括拖拽移动、固定位置（置顶）以及改进的关闭逻辑。

## 1. 样式更新 (`src/content/styles.css`)
-   **拖拽支持**: 将卡片顶部区域 (Header/Actions) 设为拖拽手柄，增加 `cursor: move` 指示。
-   **Pin 按钮**: 在操作栏 (`.lc-actions`) 添加 "置顶" (📌) 按钮，设计激活 (Pinned) 和非激活状态的样式。
-   **过渡优化**: 在拖拽过程中动态禁用 CSS `transition`，以确保跟手流畅。

## 2. 逻辑实现 (`src/content/content-script.js`)
-   **状态管理**:
    -   增加 `isPinned` 标志位。
    -   增加拖拽相关状态 (`isDragging`, `dragOffset`)。
-   **拖拽功能**:
    -   实现 `makeDraggable` 方法，监听 `mousedown` (on Header), `mousemove`, `mouseup`。
    -   实时更新 Overlay 的 `top` 和 `left` 属性。
-   **Pin (置顶) 逻辑**:
    -   **点击外部行为**: 修改 `handleMouseUp`，当 `isPinned === true` 时，点击窗口外部**不再自动关闭**窗口。
    -   **位置保持**: 修改 `showOverlay`，当 `isPinned === true` 时，**复用当前窗口位置**，不再重新定位到新选区附近。
    -   **强制关闭**: 点击 "关闭" (✕) 按钮时，无论是否 Pin 住，都强制隐藏窗口。

## 3. 实施步骤
1.  **CSS**: 添加 Pin 按钮样式，调整 Header 区域作为拖拽区。
2.  **JS (UI 构建)**: 在 `injectUI` 中添加 Pin 按钮，并绑定事件。
3.  **JS (拖拽)**: 实现拖拽核心逻辑。
4.  **JS (交互)**: 修改 `handleMouseUp` 和 `showOverlay` 适配 Pin 状态。

## 4. 验证场景
1.  **拖拽**: 按住顶部栏可自由移动窗口。
2.  **Pin 测试**: 点击 Pin 按钮 -> 点击页面空白处 -> 窗口保持显示。
3.  **位置固定**: 在 Pin 状态下选中新文本 -> 点击 LC 图标 -> 窗口在**原地**更新内容，不跳转到新文本旁。
4.  **关闭**: 点击关闭按钮 -> 窗口消失 -> Pin 状态重置 (可选，或保持用户偏好，暂定保持)。