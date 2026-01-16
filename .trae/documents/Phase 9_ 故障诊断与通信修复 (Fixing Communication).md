# Phase 9: 故障诊断与通信修复 (Fixing Communication)

用户反馈即使重启浏览器后依然报错，且错误信息为 `Error sending message: [object Object]`，这说明 Background Service Worker 可能根本没有启动，或者在接收消息时发生了未捕获的错误导致连接立即关闭。`[object Object]` 通常意味着 `chrome.runtime.lastError` 是一个对象，但被 console.log 隐式转换了，我们需要打印出具体内容。

最重要的是，用户提到 "按钮消失，也没有弹出浮窗"。这说明 `this.hideTrigger()` 执行了，`this.showOverlay()` 也执行了（或者尝试执行了），但 Overlay 可能因为某些原因不可见，或者在通信失败的回调中被错误地隐藏了。

更关键的是：**Background Script 是否存活？** 
Manifest V3 的 Service Worker 是短活的 (ephemeral)，可能会被浏览器终止。如果唤醒失败，或者唤醒过程中抛错，就会导致 `Could not establish connection`。

## 1. 错误诊断
用户提供的 Stack Trace 显示错误发生在 `src/content/content-script.js:279`，即 `chrome.runtime.sendMessage` 的回调中。
`console.error("Error sending message:", chrome.runtime.lastError);`

这确认了消息发送失败。可能的原因：
1.  **Service Worker 挂了/没启动**: 代码有语法错误，或者初始化时报错。
2.  **消息通道关闭**: `sendResponse` 没有被调用，或者 `onMessage` 监听器没有返回 `true` 来保持异步通道。
3.  **Content Script 逻辑问题**: `showOverlay` 设置了可见性，但可能被某些 CSS 覆盖，或者位置计算错误导致飞出屏幕。但用户说 "按钮消失"，说明点击事件触发了。

## 2. 检查 Background Service Worker (`src/background/service-worker.js`)
回顾之前的代码修改，我们在 Phase 6 中大幅修改了 System Prompt。
需要检查：
-   `callLLM` 函数是否正确处理了 API 错误？
-   `onMessage` 监听器中，`handleFetchExplanation` 是异步的，我们必须返回 `true`。
-   **重要**: 如果 `handleFetchExplanation` 中途报错，`chrome.tabs.sendMessage` 可能没机会执行，或者执行时 Tab 已经变了？
-   **更重要**: Manifest V3 Service Worker 在不活动时会终止。`sendMessage` 会唤醒它。如果唤醒失败（例如 `API_KEY` 变量定义问题，或者 import 问题），就会报错。

## 3. 修复方案

### 步骤 A: 增强 Content Script 的错误显示
目前的 `console.error` 打印了 `[object Object]`，我们需要 `JSON.stringify` 来看清错误。
同时，确保在通信失败时，**Overlay 能显示错误状态**，而不是仅仅消失。目前的逻辑是：
```javascript
if (errMsg.includes("invalidated")...) {
    this.showRefreshTip();
    this.hideOverlay(true); // <--- 这里直接隐藏了！
} else {
    this.updateOverlay({ text: "错误", ... });
}
```
如果错误是 "Could not establish connection" (通常意味着 SW 没响应)，我们应该显示错误，而不是隐藏。

### 步骤 B: 检查并加固 Background Script
确保 `onMessage` 始终返回 `true`。
检查 `API_KEY` 和 `fetch` 逻辑。
为了调试，我们可以在 Background 中增加 `console.log`，但用户看不到 Background 的控制台。
我们可以让 Content Script 在收到错误时，尝试用另一种方式通知用户。

### 步骤 C: 确保 Overlay 可见性
如果 `showOverlay` 被调用，Overlay 应该显示 "思考中..."。如果用户说 "没有弹出浮窗"，可能是：
1.  `showOverlay` 中的位置计算导致它跑到了屏幕外？
2.  或者 `hideOverlay(true)` 在错误处理中被立即调用了？

根据用户描述 "点击按钮之后就按钮消失，也没有弹出浮窗"，且报错是在回调中（异步），说明点击瞬间应该至少有一瞬间的浮窗？除非 JS 执行太快直接报错隐藏了。
或者，`try-catch` 包裹了 `sendMessage`，如果 `sendMessage` 立即抛错（同步），则 `catch` 块执行了 `this.hideOverlay(true)`。

**修正计划**:
1.  **Content Script**: 在 `sendMessage` 之前就 `showOverlay`，并确保除非是 "Invalidated" 错误，否则不要 `hideOverlay`，而是显示错误信息。
2.  **Content Script**: 改进错误日志打印。
3.  **Background**: 检查代码是否有语法错误（用户无法直接反馈，但我可以自查）。
    *自查*: 上次修改 `service-worker.js` 时，`systemPrompt` 字符串拼接是否正确？
    *自查*: `const API_KEY` 是否有效？（虽然是模拟/测试 Key，但代码逻辑不能错）。

## 4. 实施步骤
1.  **修改 Content Script**:
    -   优化 `handleTriggerClick` 中的错误处理逻辑。不要急着 `hideOverlay`。
    -   打印详细的 `lastError`。
    -   确保 `showOverlay` 能够正确复位（移除 `hidden` 类等）。
2.  **修改 Background Script**:
    -   确保 `onMessage` 处理函数中有全局 `try-catch` 兜底，防止 crash。
    -   确认 `return true` 存在且位置正确。

## 5. 验证
1.  刷新插件。
2.  刷新网页。
3.  点击 Trigger。
4.  如果 Background 报错，Overlay 应显示红色错误信息，而不是消失。