# 同步策略重构：本地主导的主从备份模式

根据您的指正，我将弃用复杂的双向合并逻辑，转而实现一套**以本地为绝对核心**的主从备份策略。

## 核心原则
1.  **云端即备份**: 云端数据仅作为本地数据的镜像。
2.  **本地主导**: 日常操作（增/删/改）只进行单向上传（Local -> Cloud），强制更新云端备份。
3.  **按需拉取**: 仅在“初始化（本地为空）”或“用户手动点击同步”时，才从云端拉取数据。

## 详细设计

### 1. 同步模式定义
我们将定义两种明确的同步操作模式：

*   **PUSH (备份模式)**
    *   **行为**: 读取本地数据 -> 直接上传覆盖云端文件。**不下载，不合并**。
    *   **触发**: 
        *   保存单词 (`SAVE_WORD`)
        *   删除单词 (`REMOVE_WORD`)
        *   保存设置 (`saveSettings`)
    *   **效果**: 保证云端时刻是本地的最新副本。本地删了，云端也就没了。

*   **PULL (恢复/合并模式)**
    *   **行为**: 下载云端数据 -> 将云端的新增/更新数据合并到本地 -> 写入本地 -> (可选)反向上传以保持一致。
    *   **触发**: 
        *   用户点击“同步”按钮。
        *   扩展初始化且本地为空时。

### 2. 代码变更计划

#### Service Worker (`src/background/service-worker.js`)
*   **重构 `handleSyncData`**:
    *   增加 `syncMode` 参数 (`'PUSH' | 'PULL'`)。
    *   **PUSH 分支**: 获取本地数据 -> `driveService.uploadFile` -> 返回成功。
    *   **PULL 分支**: `driveService.downloadFile` -> 执行合并（以云端补全本地） -> `chrome.storage.local.set` -> 返回成功。

#### Dashboard (`src/dashboard/dashboard.js`)
*   **初始化 (`init`)**:
    *   移除原来的 `triggerSync(false)`（自动静默同步）。
    *   改为：检查本地是否为空。如果为空，自动触发 `triggerSync('PULL')` 尝试恢复备份。如果非空，**什么都不做**。
*   **操作触发**:
    *   `deleteWord`: 删除成功后，调用 `triggerSync('PUSH')`。
    *   `saveSettings`: 保存后，调用 `triggerSync('PUSH')`。
    *   `syncBtn`: 点击时，调用 `triggerSync('PULL')`。

#### Content Script (`src/content/content-script.js`)
*   **保存单词**: 保存成功后，后台 Service Worker 应自动触发一次 PUSH（或者在 handleSaveWord 内部直接调用上传逻辑，为了解耦，建议由 Service Worker 统一管理）。
    *   *修正*: `handleSaveWord` 和 `handleRemoveWord` 在 Service Worker 中。我们可以直接在这些函数末尾调用内部的 `syncData('PUSH')` 逻辑，或者在前端回调中触发。为了保证后台操作的原子性，建议在 Service Worker 的 `handleSaveWord/RemoveWord` 完成本地存储后，**异步**执行一次 PUSH 上传。

### 3. 解决“删除后复活”问题
*   **场景复盘**: 
    1.  用户删除单词 -> 本地 Storage 移除。
    2.  触发 PUSH -> 本地数据（不含该词）上传覆盖云端。
    3.  结果 -> 云端文件也不含该词。
    4.  用户刷新 -> 读取本地 -> 无该词。
    5.  用户点同步 (PULL) -> 下载云端 -> 云端也无该词 -> 合并后仍无该词。
    *   **完美解决**。

## 执行步骤
1.  **修改 Service Worker**: 实现 `syncMode` 逻辑，并在保存/删除单词后自动触发 PUSH。
2.  **修改 Dashboard**: 调整初始化和按钮点击的同步调用逻辑。

此方案逻辑清晰，完全符合“云端仅供备份”的定位。