# Phase 7: 细节打磨与交互优化

本阶段将针对用户提出的三个具体反馈进行优化，包括 UI 文案汉化、固定位置逻辑升级以及操作栏布局调整。

## 1. 文案汉化 (Localization)
-   **目标**: 将前端所有硬编码的英文提示词替换为中文。
-   **修改点**: `src/content/content-script.js`
    -   `Processing...` -> `思考中...`
    -   `Talking to Brain...` -> `正在连接大脑...`
    -   `Loading...` -> `加载中...`
    -   `Error` -> `错误`

## 2. 窗口固定逻辑升级 (Absolute Fixation)
-   **现状**: 窗口当前是 `position: absolute`，会随着页面滚动而移动（相对于文档流）。
-   **目标**: 固定 (Pin) 后，窗口应变为 `position: fixed`，相对于视口固定，不随页面滚动。
-   **实施**:
    -   在 `togglePin` 中切换 CSS `position` 属性 (`absolute` <-> `fixed`)。
    -   **关键点**: 切换定位模式时，需要重新计算 `top/left` 坐标。
        -   `absolute` -> `fixed`: `top = top - window.scrollY`
        -   `fixed` -> `absolute`: `top = top + window.scrollY`
    -   在 `makeDraggable` 中处理两种定位模式下的坐标更新（如果是 fixed，不需要加 scrollY）。

## 3. 操作栏 (Actions Bar) 固定
-   **现状**: `.lc-actions` 是绝对定位在 Overlay 内的，如果 Overlay 内容滚动，它可能会被遮挡或随内容移动（取决于 overflow 容器是谁）。目前 Overlay 设置了 `overflow-y: auto`，而 `.lc-actions` 是 `absolute` top:0。
    -   如果 Overlay 自身滚动，`absolute` 的子元素会随之滚动（除非包含块在可视区外，但这里 Overlay 是包含块）。
    -   或者，如果 Overlay 内容区 (`.lc-content`) 独立滚动，而 Overlay 容器不滚动，则 Actions 可以固定。
-   **目标**: 无论内容如何滚动，操作按钮始终固定在窗口右上角。
-   **方案**:
    -   **DOM 结构调整**: 将 `.lc-content` 设为滚动容器，而 `.linguacontext-overlay` 设为不可滚动（或仅作为外框）。
    -   **CSS 调整**:
        -   `.linguacontext-overlay`: `overflow: hidden`, `display: flex`, `flex-direction: column`.
        -   Header 区域 (含 Actions): 固定高度或 flex-shrink 0。
        -   `.lc-content` (及新的 `.lc-detail-container`): `overflow-y: auto`, `flex-grow: 1`, `height: 100%`.
        -   确保 Actions Bar `z-index` 高于内容。

## 4. 实施步骤
1.  **JS**: 替换英文提示文案。
2.  **JS**: 修改 `togglePin` 逻辑，实现 `position: fixed` 切换及坐标换算。
3.  **CSS/HTML**: 重构 Overlay 内部布局，使 Actions Bar 独立于滚动区域。
4.  **验证**: 滚动页面测试固定效果；滚动卡片内容测试按钮位置；拖拽测试。