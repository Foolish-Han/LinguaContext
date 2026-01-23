import { CONFIG } from "../config/config.js";

let allWords = [];
let currentWordIndex = -1;

document.addEventListener("DOMContentLoaded", init);

async function init() {
  // Bind Navigation
  document
    .getElementById("back-btn")
    .addEventListener("click", () => showList());
  document
    .getElementById("prev-btn")
    .addEventListener("click", showPrev);
  document
    .getElementById("next-btn")
    .addEventListener("click", showNext);

  // Bind Settings Buttons
  document
    .getElementById("settings-btn")
    .addEventListener("click", showSettings);
  document
    .getElementById("settings-back-btn")
    .addEventListener("click", showList);
  document
    .getElementById("save-settings-btn")
    .addEventListener("click", saveSettings);
  document
    .getElementById("reset-settings-btn")
    .addEventListener("click", resetSettings);

  // Bind Shortcut Inputs
  setupShortcutInput("shortcut-explain");
  setupShortcutInput("shortcut-play");

  // Bind Conflict Modal Buttons
  document
    .getElementById("keep-local-btn")
    .addEventListener("click", () =>
      resolveConflict("local"),
    );
  document
    .getElementById("keep-cloud-btn")
    .addEventListener("click", () =>
      resolveConflict("cloud"),
    );

  // Bind Confirm Modal Buttons
  document
    .getElementById("confirm-cancel-btn")
    .addEventListener("click", closeConfirmModal);
  document
    .getElementById("confirm-ok-btn")
    .addEventListener("click", handleConfirmOk);

  // Bind Sync Button
  const syncBtn = document.getElementById("sync-btn");
  if (syncBtn) {
    syncBtn.addEventListener("click", () =>
      triggerSync(true),
    );
  }

  // Set textarea placeholder with default prompt
  const textarea = document.getElementById("custom-prompt");
  if (textarea) {
    textarea.placeholder = CONFIG.LLM.SYSTEM_PROMPT;
  }

  // Attempt silent sync on load to check status
  // Only sync if local is empty (Initialization)
  try {
    const { savedWords = {} } =
      await chrome.storage.local.get("savedWords");

    // Check if we have any ACTIVE words (filter out soft-deleted ones)
    const activeCount = Object.values(savedWords).filter(
      (w) => !w.isDeleted,
    ).length;

    // Treat as "Empty" if no savedWords object OR no keys OR no active words
    if (
      !savedWords ||
      Object.keys(savedWords).length === 0 ||
      activeCount === 0
    ) {
      // Init Mode: Try to restore from cloud

      // Update UI to show we are checking cloud (visual feedback is important)
      const emptyState =
        document.getElementById("empty-state");
      if (emptyState) {
        emptyState.classList.remove("hidden");
        // Use a spinner or text to indicate loading
        emptyState.innerHTML =
          '<div class="loading-spinner"></div><p>正在检查云端备份...</p>';
      }

      console.log(
        "Local storage effectively empty. Triggering Auto-PULL...",
      );
      await triggerSync(false, "PULL");

      // Reset empty state text if still empty after sync
      if (emptyState) {
        // Check again
        const { savedWords: newWords = {} } =
          await chrome.storage.local.get("savedWords");
        const newActiveCount = Object.values(
          newWords,
        ).filter((w) => !w.isDeleted).length;
        if (newActiveCount === 0) {
          emptyState.textContent =
            "还没有生词，快去网页划词添加吧！";
        }
      }
    } else {
      console.log(
        `Local storage has ${activeCount} active words. Skipping Auto-PULL.`,
      );
    }
  } catch (e) {
    console.error("Init sync check failed", e);
  }

  await loadWords();
}

function setupShortcutInput(id) {
  const input = document.getElementById(id);
  if (!input) return;

  input.addEventListener("keydown", (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Allow Backspace/Delete to clear
    if (e.key === "Backspace" || e.key === "Delete") {
      input.value = "";
      return;
    }

    // Ignore modifier keys pressed alone
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key))
      return;

    // Build shortcut string
    const parts = [];
    if (e.ctrlKey) parts.push("Ctrl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey) parts.push("Cmd");

    // Handle Key
    let key = e.key;
    if (key === " ") key = "Space";
    // If single char, uppercase it for display? No, keep it simple.
    // Actually for content script matching, we often check e.key or e.code.
    // Let's store readable string, but standardizing case.
    if (key.length === 1) key = key.toLowerCase();

    parts.push(key);
    input.value = parts.join("+");
  });
}

async function loadWords() {
  try {
    const { savedWords = {} } =
      await chrome.storage.local.get("savedWords");
    // Filter out soft-deleted words
    allWords = Object.values(savedWords).filter(
      (w) => !w.isDeleted,
    );

    // Sort by timestamp descending (newest first)
    allWords.sort((a, b) => b.timestamp - a.timestamp);

    updateStats(allWords.length);
    renderList(allWords);

    // Check URL params
    const params = new URLSearchParams(
      window.location.search,
    );
    const id = params.get("id");
    if (id) {
      const index = allWords.findIndex((w) => w.id === id);
      if (index !== -1) {
        showDetail(index);
      }
    }
  } catch (error) {
    console.error("Failed to load words:", error);
  }
}

function updateStats(count) {
  const statsEl = document.getElementById("stats");
  statsEl.textContent = `已收藏 ${count} 个生词`;
}

function renderList(words) {
  const container = document.getElementById("word-list");
  const emptyState = document.getElementById("empty-state");

  container.innerHTML = "";

  if (words.length === 0) {
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");

  words.forEach((word, index) => {
    const row = createRow(word, index);
    container.appendChild(row);
  });
}

function createRow(data, index) {
  const div = document.createElement("div");
  div.className = "word-row";
  div.id = `row-${data.id}`;

  div.innerHTML = `
        <div class="word-row-content">
            <h3 class="word-row-title">${data.word || "无标题"}</h3>
            <span class="word-row-meta">收藏于 ${new Date(data.timestamp).toLocaleDateString()}</span>
        </div>
        <div class="word-row-actions">
            <button class="delete-btn" title="删除">✕</button>
        </div>
    `;

  // Bind row click for detail
  div.addEventListener("click", (e) => {
    if (e.target.closest(".delete-btn")) return;
    showDetail(index);
  });

  // Bind delete event
  div
    .querySelector(".delete-btn")
    .addEventListener("click", (e) => {
      e.stopPropagation();
      deleteWord(data.id);
    });

  return div;
}

function showList() {
  document
    .getElementById("list-view")
    .classList.remove("hidden");
  document
    .getElementById("detail-view")
    .classList.add("hidden");
  document
    .getElementById("settings-view")
    .classList.add("hidden");

  // Update URL
  const url = new URL(window.location);
  url.searchParams.delete("id");
  window.history.pushState({}, "", url);
}

async function showSettings() {
  document
    .getElementById("list-view")
    .classList.add("hidden");
  document
    .getElementById("detail-view")
    .classList.add("hidden");
  document
    .getElementById("settings-view")
    .classList.remove("hidden");

  // Load current settings
  const data = await chrome.storage.local.get([
    "userSettings",
    "customPrompt",
  ]);

  // Fallback logic
  let settings = data.userSettings;
  if (!settings) {
    if (data.customPrompt) {
      settings = {
        ...CONFIG.DEFAULT_SETTINGS,
        customPrompt: data.customPrompt,
      };
    } else {
      settings = { ...CONFIG.DEFAULT_SETTINGS };
    }
  }

  // Populate UI
  document.getElementById("custom-prompt").value =
    settings.customPrompt || "";
  document.getElementById("shortcuts-enabled").checked =
    settings.shortcuts?.enabled ?? true;
  document.getElementById("shortcut-explain").value =
    settings.shortcuts?.explain || "e";
  document.getElementById("shortcut-play").value =
    settings.shortcuts?.play || "p";
  document.getElementById("show-buttons").checked =
    settings.showButtons ?? true;
  // Explicitly check for autoPlayTTS property, default to true if undefined
  document.getElementById("auto-play-tts").checked =
    settings.autoPlayTTS ??
    CONFIG.DEFAULT_SETTINGS.autoPlayTTS ??
    true;
}

/* --- Toast & Confirm Utilities --- */

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");

  // Clear previous timeout if exists (simple debounce)
  if (toast.timeout) clearTimeout(toast.timeout);

  toast.timeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

let confirmCallback = null;

function showConfirm(title, message, onConfirm) {
  const modal = document.getElementById("confirm-modal");
  document.getElementById("confirm-title").textContent =
    title;
  document.getElementById("confirm-message").textContent =
    message;

  confirmCallback = onConfirm;
  modal.classList.remove("hidden");
}

function closeConfirmModal() {
  document
    .getElementById("confirm-modal")
    .classList.add("hidden");
  confirmCallback = null;
}

function handleConfirmOk() {
  if (confirmCallback) {
    confirmCallback();
  }
  closeConfirmModal();
}

async function saveSettings() {
  // Construct Settings Object
  const prompt =
    document.getElementById("custom-prompt").value;
  const shortcutsEnabled = document.getElementById(
    "shortcuts-enabled",
  ).checked;
  const shortcutExplain = document.getElementById(
    "shortcut-explain",
  ).value;
  const shortcutPlay =
    document.getElementById("shortcut-play").value;
  const showButtons =
    document.getElementById("show-buttons").checked;
  const autoPlayTTS =
    document.getElementById("auto-play-tts").checked;

  const newSettings = {
    customPrompt: prompt,
    shortcuts: {
      enabled: shortcutsEnabled,
      explain: shortcutExplain,
      play: shortcutPlay,
    },
    showButtons: showButtons,
    autoPlayTTS: autoPlayTTS,
    updatedAt: Date.now(), // Add timestamp for sync
  };

  // Save to Local Storage via Service Worker (Mutex Protected)
  chrome.runtime.sendMessage(
    {
      action: "SAVE_SETTINGS",
      settings: newSettings,
    },
    (response) => {
      if (
        chrome.runtime.lastError ||
        !response ||
        !response.success
      ) {
        console.error(
          "Save settings failed:",
          chrome.runtime.lastError || response?.error,
        );
        showToast("设置保存失败，请重试");
        return;
      }

      showToast("设置已保存！");
      showList();
    },
  );
}

async function resetSettings() {
  showConfirm(
    "恢复默认设置",
    "确定要恢复默认设置吗？这将覆盖您的自定义提示词和快捷键配置。",
    async () => {
      // Reset via Service Worker (Mutex Protected)
      chrome.runtime.sendMessage(
        { action: "RESET_SETTINGS" },
        (response) => {
          if (
            chrome.runtime.lastError ||
            !response ||
            !response.success
          ) {
            console.error(
              "Reset settings failed:",
              chrome.runtime.lastError || response?.error,
            );
            showToast("重置失败，请重试");
            return;
          }

          // Re-populate with defaults
          document.getElementById("custom-prompt").value =
            "";
          document.getElementById(
            "shortcuts-enabled",
          ).checked = true;
          document.getElementById(
            "shortcut-explain",
          ).value = "e";
          document.getElementById("shortcut-play").value =
            "p";
          document.getElementById("show-buttons").checked =
            true;
          document.getElementById("auto-play-tts").checked =
            true;

          showToast("已恢复默认设置！");
        },
      );
    },
  );
}

function showDetail(index) {
  if (index < 0 || index >= allWords.length) return;

  currentWordIndex = index;
  const word = allWords[index];

  document
    .getElementById("list-view")
    .classList.add("hidden");
  document
    .getElementById("detail-view")
    .classList.remove("hidden");

  // Update Hero Title
  document.getElementById("detail-word").textContent =
    word.word || "详情";

  // Bind Play Button
  const playBtn = document.getElementById(
    "detail-play-btn",
  );
  playBtn.onclick = () => playTTS(word.word);

  // Render Content
  const contentContainer = document.getElementById(
    "detail-content",
  );

  if (word.html) {
    // Check if context is already in Markdown (some versions might have it)
    // But per user request, we force a specific context block at the top.
    contentContainer.innerHTML = `
            <div style="margin-bottom: 24px; padding: 16px; background-color: var(--lc-bg-secondary); border-radius: 8px; border-left: 4px solid var(--lc-accent-color);">
                <div style="font-size: 12px; color: var(--lc-text-secondary); margin-bottom: 8px; font-weight: 600;">原文语境 (Original Context)</div>
                <div style="font-size: 15px; line-height: 1.6; color: var(--lc-text-color);">"${word.context || "（无上下文）"}"</div>
            </div>
            
            <div class="lc-markdown">${word.html}</div>
            
            <div style="margin-top: 32px; font-size: 12px; color: var(--lc-text-secondary); border-top: 1px solid var(--lc-border-color); padding-top: 16px; text-align: right;">
                收藏于 ${new Date(word.timestamp).toLocaleString()}
            </div>
        `;
  } else {
    // Legacy Rendering
    contentContainer.innerHTML = `
            <div class="lc-header" style="margin-bottom: 24px;">
                <h1 class="word-title">${word.word} <span class="word-ipa">[${word.ipa}]</span></h1>
                <span class="card-pos">${word.pos}</span>
            </div>
            
            <div class="card-context" style="order: -1; margin-bottom: 20px;">
                <span class="context-label">原文语境</span>
                <p class="context-text">"${word.context}"</p>
            </div>
            
            <div class="card-def">
                <p class="def-en">${word.definition_en}</p>
                <p class="def-cn">${word.definition_cn}</p>
            </div>
        `;
  }

  // Update Navigation Buttons
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");

  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === allWords.length - 1;

  // Update URL
  const url = new URL(window.location);
  url.searchParams.set("id", word.id);
  window.history.pushState({}, "", url);
}

function showPrev() {
  if (currentWordIndex > 0) {
    showDetail(currentWordIndex - 1);
  }
}

function showNext() {
  if (currentWordIndex < allWords.length - 1) {
    showDetail(currentWordIndex + 1);
  }
}

async function deleteWord(id) {
  showConfirm(
    "删除生词",
    "确定要删除这个生词吗？此操作无法撤销。",
    async () => {
      try {
        // We use the runtime message to handle deletion to ensure logic consistency (soft delete)
        chrome.runtime.sendMessage(
          { action: "REMOVE_WORD", wordId: id },
          async (response) => {
            if (response && response.success) {
              // Remove from local array UI immediately
              allWords = allWords.filter(
                (w) => w.id !== id,
              );
              updateStats(allWords.length);

              // If in detail view and deleting current word, go back to list
              const urlParams = new URLSearchParams(
                window.location.search,
              );
              if (urlParams.get("id") === id) {
                showList();
              }

              // Re-render list
              renderList(allWords);
              showToast("生词已删除");

              // Trigger sync to propagate deletion (PUSH MODE)
              triggerSync(false, "PUSH");
            } else {
              showToast(
                "删除失败: " +
                  (response?.error || "未知错误"),
              );
            }
          },
        );
      } catch (error) {
        console.error("Failed to delete word:", error);
        showToast("删除失败: " + error.message);
      }
    },
  );
}

function playTTS(text) {
  if (!text) return;

  chrome.runtime.sendMessage(
    { action: "FETCH_TTS", text: text },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error(
          "TTS Error:",
          chrome.runtime.lastError,
        );
        showToast(
          "TTS连接失败: " +
            chrome.runtime.lastError.message,
        );
        return;
      }

      if (response && response.success) {
        // If audioData is returned, play it locally (legacy support)
        if (response.audioData) {
          try {
            const audio = new Audio(response.audioData);
            audio
              .play()
              .catch((e) =>
                console.error("Audio Playback Error:", e),
              );
          } catch (e) {
            console.error("Audio Init Error:", e);
            showToast("播放失败");
          }
        } else {
          console.log("Audio played by background service");
        }
      } else {
        console.error("TTS API Failed:", response?.error);
        showToast(
          "TTS生成失败: " + (response?.error || "未知错误"),
        );
      }
    },
  );
}

let conflictData = null;

// Add syncMode parameter
function triggerSync(
  interactive = false,
  syncMode = "PUSH",
) {
  return new Promise((resolve) => {
    const btn = document.getElementById("sync-btn");
    const status = document.getElementById("sync-status");

    if (interactive) {
      btn.innerHTML =
        '<span class="loading"></span> 同步中...';
      btn.disabled = true;
      // Interactive sync implies PULL (Restore/Merge)
      syncMode = "PULL";
    }

    chrome.runtime.sendMessage(
      {
        action: "SYNC_DATA",
        interactive: interactive,
        syncMode,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          // Often means "The user did not approve access" if interactive=true
          if (interactive) {
            status.textContent = "同步取消或失败";
            status.className = "sync-status error";
            status.classList.remove("hidden");
            btn.textContent = "☁️ 登录 Google Drive 同步";
            btn.disabled = false;
            console.warn(
              "Sync Error:",
              chrome.runtime.lastError,
            );
          }
          resolve({
            success: false,
            error: chrome.runtime.lastError.message,
          });
          return;
        }

        if (response && response.success) {
          // Check for settings conflict (was promptConflict)
          if (response.settingsConflict) {
            if (interactive) {
              showConflictModal(response.settingsConflict);
            } else {
              // Silent sync conflict: Just show indicator, don't interrupt
              status.textContent = `同步完成 (发现配置冲突)`;
              status.className = "sync-status error"; // Use error color to attract attention
              status.classList.remove("hidden");
            }
          } else {
            status.textContent = `上次同步: ${new Date().toLocaleTimeString()} (共${response.count}条)`;
            status.className = "sync-status success";
            status.classList.remove("hidden");
          }

          btn.textContent = "🔄 立即同步";
          btn.classList.add("synced");
          btn.disabled = false;

          // Reload list to show merged data
          loadWords();
        } else {
          // Failed
          if (interactive) {
            status.textContent = `同步失败: ${response?.error || "未知错误"}`;
            status.className = "sync-status error";
            status.classList.remove("hidden");
            btn.textContent = "☁️ 登录 Google Drive 同步";
            btn.disabled = false;

            if (response?.error?.includes("OAuth")) {
              showToast(
                "Google 登录失败，请检查 manifest.json 中的 Client ID 配置。",
              );
            }
          } else {
            // Silent failure - just reset button
            btn.textContent = "☁️ 登录 Google Drive 同步";
          }
        }
        resolve(response);
      },
    );
  });
}

function showConflictModal(conflict) {
  conflictData = conflict;
  const modal = document.getElementById("conflict-modal");

  // Format display for complex settings
  // If it's just prompt (legacy structure or simple structure), show prompt
  // Otherwise show pretty JSON

  function formatForDisplay(settings) {
    if (!settings) return "（空）";
    // If it looks like a full settings object
    if (
      settings.shortcuts ||
      settings.showButtons !== undefined
    ) {
      return JSON.stringify(settings, null, 2);
    }
    // If it's just a string (legacy prompt) or object with just prompt
    if (typeof settings === "string") return settings;
    if (
      settings.customPrompt &&
      Object.keys(settings).length === 1
    )
      return settings.customPrompt;

    return JSON.stringify(settings, null, 2);
  }

  document.getElementById(
    "local-prompt-preview",
  ).textContent = formatForDisplay(conflict.local);
  document.getElementById(
    "cloud-prompt-preview",
  ).textContent = formatForDisplay(conflict.cloud);
  modal.classList.remove("hidden");
}

async function resolveConflict(choice) {
  if (!conflictData) return;

  const modal = document.getElementById("conflict-modal");
  const status = document.getElementById("sync-status");

  let finalSettings = null;
  if (choice === "local") {
    finalSettings = conflictData.local;
  } else {
    finalSettings = conflictData.cloud;
    // Update local storage to match cloud
    await chrome.storage.local.set({
      userSettings: finalSettings,
      customPrompt: finalSettings.customPrompt,
    });

    // Refresh settings UI if open
    const textarea =
      document.getElementById("custom-prompt");
    // We might be on settings page
    if (
      !document
        .getElementById("settings-view")
        .classList.contains("hidden")
    ) {
      await showSettings(); // Reload UI
    }
  }

  // Hide modal
  modal.classList.add("hidden");
  conflictData = null;

  status.textContent = "正在解决冲突并同步...";

  // Trigger sync with force option to overwrite the other side
  // If we chose local, we force upload local to cloud
  // If we chose cloud, we updated local, so now they match, but we can sync to be sure

  chrome.runtime.sendMessage(
    {
      action: "SYNC_DATA",
      interactive: true,
      forceUploadSettings: true, // This flag tells background to ignore conflict check and upload
    },
    (response) => {
      if (response && response.success) {
        status.textContent = "冲突已解决，同步完成";
        status.className = "sync-status success";
      }
    },
  );
}
