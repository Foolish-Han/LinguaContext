# Phase 8: 修复 "Extension context invalidated" 错误

这个错误非常经典。它通常发生在插件被重新加载（更新或手动刷新）后，而原本注入在网页中的 Content Script 依然是旧版本的 "孤儿" 脚本。这个旧脚本试图调用 `chrome.runtime.sendMessage`，但因为它的上下文（Extension Context）已经失效（被新版本取代），所以浏览器抛出了 `Extension context invalidated` 错误。

## 1. 错误根源分析
-   **场景**: 用户刷新了插件 (`chrome://extensions` -> Reload)，但没有刷新当前的网页页面 (Wikipedia)。
-   **结果**: 网页中运行的 Content Script 是旧的。它依然能响应 DOM 事件（因为它是注入到页面的 JS），但在尝试与 Background 通信时失败，因为旧的 Runtime ID 已不再有效。

## 2. 解决方案
这个问题无法通过修改代码**完全**根除（因为旧脚本已经存在于内存中且无法被新插件控制），但我们可以通过以下方式显著改善体验和健壮性：

### 方案 A: 优雅的错误捕获 (Error Handling)
-   在 `chrome.runtime.sendMessage` 调用时捕获异常。
-   如果捕获到 "Extension context invalidated" 错误，给用户一个友好的提示，告诉他们 **"请刷新当前页面以使用最新版本的插件"**。
-   这能防止功能静默失效（按钮消失但无反应），给用户明确的行动指引。

### 方案 B: 自动检测孤儿状态 (Orphan Detection)
-   在执行关键操作前，先检查 `chrome.runtime.id` 是否存在。如果上下文已失效，该属性通常会变为 undefined 或抛错。

## 3. 实施计划
我们将在 `src/content/content-script.js` 中实施 **方案 A + B**。

1.  **修改 `handleTriggerClick`**:
    -   在发送消息前，增加 `try-catch` 块包裹 `chrome.runtime.sendMessage`。
    -   注意：`chrome.runtime.sendMessage` 本身是异步的，但如果上下文失效，它可能会同步抛出异常，或者在回调中报错。我们需要同时处理同步 try-catch 和 `chrome.runtime.lastError`。
    -   **修正**: `Extension context invalidated` 通常是一个同步抛出的 Error，或者在尝试访问 `chrome.runtime` 时抛出。

2.  **增加失效提示**:
    -   如果检测到失效，弹出一个临时的 Toast 或直接在 Trigger 按钮上方显示提示："插件已更新，请刷新页面"。

## 4. 代码变更 (`src/content/content-script.js`)

```javascript
handleTriggerClick(e) {
    // 1. 尝试访问 runtime，如果报错则说明失效
    try {
        if (!chrome.runtime?.id) {
            throw new Error("Extension context invalidated");
        }
    } catch (err) {
        this.showRefreshTip(); // 新增方法：显示提示
        return;
    }

    this.hideTrigger();
    this.showOverlay();
    
    // ... 正常的 sendMessage 逻辑 ...
    // 同时在 sendMessage 的回调中也要检查 lastError，虽然 invalidated 通常直接抛错
}

showRefreshTip() {
    // 在按钮位置显示提示
    alert("插件已更新，请刷新当前页面以继续使用。"); 
    // 或者更优雅的 UI 提示
}
```

为了保持 UI 风格一致，我将使用自定义的提示气泡而不是 `alert`。

## 5. 验证
1.  加载插件，打开页面。
2.  去扩展管理页刷新插件。
3.  回到页面点击按钮，确认是否弹出提示而不是静默失败。