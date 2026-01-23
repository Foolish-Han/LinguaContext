# 添加自动播放 TTS 功能计划

我将实现用户请求的“生成解释时自动播放语音”的功能，并为其添加设置开关。

## 修改计划

### 1. 配置更新 (`src/config/config.js`)
*   在 `DEFAULT_SETTINGS` 中添加 `autoPlayTTS` 字段，默认值为 `false`。

### 2. 设置页面 UI 更新 (`src/dashboard/dashboard.html`)
*   在“快捷键与交互”设置区域，添加一个新的复选框 (Checkbox)，标签为“自动朗读 (Auto Play TTS)”。

### 3. 设置页面逻辑更新 (`src/dashboard/dashboard.js`)
*   **加载设置 (`showSettings`)**: 读取 `autoPlayTTS` 状态并更新 UI。
*   **保存设置 (`saveSettings`)**: 获取复选框状态并保存到 `chrome.storage.local`。
*   **重置设置 (`resetSettings`)**: 将 `autoPlayTTS` 重置为默认值 (`false`)。

### 4. 业务逻辑更新 (`src/content/content-script.js`)
*   在 `handleTriggerClick` 方法中（即用户点击“解释”按钮或使用快捷键触发解释时）：
    *   检查 `this.settings.autoPlayTTS` 是否为 `true`。
    *   如果是，立即调用 `this.playTTS(this.selectedText)`，实现“边查边读”的体验。

## 验证计划
1.  **验证设置**: 打开 Dashboard -> 设置，勾选“自动朗读”，保存。刷新页面检查是否保持勾选。
2.  **验证功能**: 在网页中划词并点击“解释”。
    *   预期：除了弹出解释窗口外，应立即听到单词发音。
3.  **验证关闭**: 关闭“自动朗读”设置，再次测试，应不再自动发音。