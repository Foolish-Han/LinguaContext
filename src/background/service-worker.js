import { driveService } from "./google-drive.js";
import { callLLMStreaming } from "../services/llm.js";
import { fetchTTS } from "../services/tts.js";
import { Logger } from "../utils/logger.js";
import { CONFIG } from "../config/config.js";
import { Mutex } from "../utils/mutex.js";

const mutex = new Mutex();

Logger.info(
  "LinguaContext Background Service Worker Loaded",
);

chrome.runtime.onMessage.addListener(
  (request, sender, sendResponse) => {
    switch (request.action) {
      case "FETCH_EXPLANATION":
        handleFetchExplanation(
          request,
          sender.tab.id,
          sendResponse,
        );
        return true;
      case "FETCH_TTS":
        // Must return true to indicate async response
        handleFetchTTS(request.text, sendResponse);
        return true;
      case "SAVE_WORD":
        handleSaveWord(request.data, sendResponse);
        return true;
      case "REMOVE_WORD":
        handleRemoveWord(request.wordId, sendResponse);
        return true;
      case "CHECK_IS_SAVED":
        handleCheckIsSaved(request.word, sendResponse);
        return true;
      case "SAVE_SETTINGS":
        handleSaveSettings(request.settings, sendResponse);
        return true;
      case "RESET_SETTINGS":
        handleResetSettings(sendResponse);
        return true;
      case "SYNC_DATA":
        handleSyncData(request, sendResponse);
        return true;
      case "LOGOUT_GOOGLE":
        handleLogout(sendResponse);
        return true;
      default:
        Logger.warn("Unknown action:", request.action);
        return false;
    }
  },
);

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: "src/dashboard/dashboard.html",
  });
});

/* --- Handlers --- */

async function handleSyncData(request, sendResponse) {
  const { interactive, syncMode = "PUSH" } = request; // Default to PUSH (Backup)
  try {
    const token =
      await driveService.getAuthToken(interactive);

    // 2. Find cloud file (Network operation - do before lock)
    const cloudFile =
      await driveService.findBackupFile(token);

    // --- PUSH MODE (Backup Local to Cloud) ---
    if (syncMode === "PUSH") {
      // Lock for reading local data to ensure consistency
      await mutex.lock();
      let localWords = {};
      let localSettings = null;
      try {
        const localData = await chrome.storage.local.get([
          "savedWords",
          "customPrompt",
          "userSettings",
        ]);
        localWords = localData.savedWords || {};
        localSettings = localData.userSettings;

        // Normalize Local Settings (Migration)
        if (!localSettings && localData.customPrompt) {
          localSettings = {
            ...CONFIG.DEFAULT_SETTINGS,
            customPrompt: localData.customPrompt,
            updatedAt: 0,
          };
        } else if (!localSettings) {
          localSettings = {
            ...CONFIG.DEFAULT_SETTINGS,
            updatedAt: 0,
          };
        }
      } finally {
        mutex.release();
      }

      // Just upload local data, overwriting cloud
      const payload = {
        savedWords: localWords,
        userSettings: localSettings,
        updatedAt: Date.now(),
      };

      Logger.info("PUSH Mode: Uploading local backup...");
      await driveService.uploadFile(
        token,
        payload,
        cloudFile ? cloudFile.id : null,
      );

      // Return local count
      const activeCount = Object.values(localWords).filter(
        (w) => !w.isDeleted,
      ).length;

      sendResponse({
        success: true,
        count: activeCount,
        mode: "PUSH",
      });
      return;
    }

    // --- PULL MODE (Restore/Merge Cloud to Local) ---
    if (syncMode === "PULL") {
      if (!cloudFile) {
        // No cloud file to pull from. Need to read local count safely.
        await mutex.lock();
        let count = 0;
        try {
          const { savedWords = {} } =
            await chrome.storage.local.get("savedWords");
          count = Object.values(savedWords).filter(
            (w) => !w.isDeleted,
          ).length;
        } finally {
          mutex.release();
        }

        sendResponse({
          success: true,
          count: count,
          message: "No cloud backup found.",
        });
        return;
      }

      Logger.info("PULL Mode: Downloading cloud backup...");
      // Network operation - do before lock
      const cloudData = await driveService.downloadFile(
        token,
        cloudFile.id,
      );

      let cloudWords = {};
      let cloudSettings = null;

      // Parse Cloud Data
      if (cloudData.savedWords) {
        cloudWords = cloudData.savedWords;
      } else if (
        !cloudData.userSettings &&
        !cloudData.customPrompt
      ) {
        cloudWords = cloudData; // Legacy format
      }

      if (cloudData.userSettings) {
        cloudSettings = cloudData.userSettings;
      } else if (cloudData.customPrompt) {
        cloudSettings = {
          ...CONFIG.DEFAULT_SETTINGS,
          customPrompt: cloudData.customPrompt,
          updatedAt: 0,
        };
      }

      // Lock for Read-Modify-Write cycle on Local Storage
      await mutex.lock();
      let mergedWords = {};
      let mergedSettings = {};

      try {
        const localData = await chrome.storage.local.get([
          "savedWords",
          "userSettings",
          "customPrompt", // needed for migration check
        ]);
        const localWords = localData.savedWords || {};
        let localSettings = localData.userSettings;

        // Normalize Local Settings inside lock as well
        if (!localSettings && localData.customPrompt) {
          localSettings = {
            ...CONFIG.DEFAULT_SETTINGS,
            customPrompt: localData.customPrompt,
            updatedAt: 0,
          };
        } else if (!localSettings) {
          localSettings = {
            ...CONFIG.DEFAULT_SETTINGS,
            updatedAt: 0,
          };
        }

        mergedWords = { ...localWords };
        mergedSettings = { ...localSettings };

        // 1. Merge Words
        Object.keys(cloudWords).forEach((id) => {
          const cloudEntry = cloudWords[id];
          const localEntry = localWords[id];

          if (!localEntry) {
            // New word from cloud -> Add to local
            mergedWords[id] = cloudEntry;
          } else {
            // Conflict -> Pick newer
            const cloudTime =
              cloudEntry.updatedAt ||
              cloudEntry.timestamp ||
              0;
            const localTime =
              localEntry.updatedAt ||
              localEntry.timestamp ||
              0;
            if (cloudTime > localTime) {
              mergedWords[id] = cloudEntry;
            }
          }
        });

        // 2. Merge Settings
        if (cloudSettings) {
          const cloudTime = cloudSettings.updatedAt || 0;
          const localTime = localSettings.updatedAt || 0;
          if (cloudTime > localTime) {
            mergedSettings = cloudSettings;
          }
        }

        // 3. Update Local
        await chrome.storage.local.set({
          savedWords: mergedWords,
          userSettings: mergedSettings,
          customPrompt: mergedSettings.customPrompt,
        });
      } finally {
        mutex.release();
      }

      // 4. Push back merged state to cloud (to ensure consistency)
      // This is a network op, can be done outside lock.
      const payload = {
        savedWords: mergedWords,
        userSettings: mergedSettings,
        updatedAt: Date.now(),
      };
      await driveService.uploadFile(
        token,
        payload,
        cloudFile.id,
      );

      const activeCount = Object.values(mergedWords).filter(
        (w) => !w.isDeleted,
      ).length;

      sendResponse({
        success: true,
        count: activeCount,
        mode: "PULL",
      });
    }
  } catch (error) {
    Logger.error("Sync failed:", error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleLogout(sendResponse) {
  try {
    const token = await driveService.getAuthToken(false);
    await driveService.removeCachedAuthToken(token);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

async function handleSaveWord(wordData, sendResponse) {
  await mutex.lock();
  try {
    const { savedWords = {} } =
      await chrome.storage.local.get("savedWords");
    const id = Date.now().toString();
    const entry = {
      ...wordData,
      id,
      timestamp: Date.now(),
      updatedAt: Date.now(), // New field for sync
      isDeleted: false, // New field for soft delete
    };
    savedWords[id] = entry;
    await chrome.storage.local.set({ savedWords });
    Logger.info("Word saved:", entry);

    sendResponse({ success: true, id });
  } catch (error) {
    Logger.error("Save failed:", error);
    sendResponse({ success: false, error: error.message });
  } finally {
    mutex.release();
  }

  // Auto-trigger PUSH backup (after lock released)
  handleSyncData(
    { interactive: false, syncMode: "PUSH" },
    () => {},
  );
}

async function handleRemoveWord(wordId, sendResponse) {
  await mutex.lock();
  try {
    const { savedWords = {} } =
      await chrome.storage.local.get("savedWords");
    if (savedWords[wordId]) {
      // Soft Delete
      savedWords[wordId].isDeleted = true;
      savedWords[wordId].updatedAt = Date.now();

      await chrome.storage.local.set({ savedWords });

      sendResponse({ success: true });
    } else {
      sendResponse({
        success: false,
        error: "Word not found",
      });
    }
  } catch (error) {
    Logger.error("Remove failed:", error);
    sendResponse({ success: false, error: error.message });
  } finally {
    mutex.release();
  }

  // Auto-trigger PUSH backup (after lock released)
  handleSyncData(
    { interactive: false, syncMode: "PUSH" },
    () => {},
  );
}

async function handleCheckIsSaved(wordText, sendResponse) {
  try {
    const { savedWords = {} } =
      await chrome.storage.local.get("savedWords");
    const entry = Object.values(savedWords).find(
      (entry) =>
        entry.word &&
        wordText &&
        !entry.isDeleted && // Ignore soft-deleted words
        entry.word.toLowerCase() === wordText.toLowerCase(),
    );
    if (entry) {
      sendResponse({ isSaved: true, id: entry.id });
    } else {
      sendResponse({ isSaved: false });
    }
  } catch (error) {
    Logger.error("Check failed:", error);
    sendResponse({ isSaved: false });
  }
}

async function handleSaveSettings(settings, sendResponse) {
  await mutex.lock();
  try {
    await chrome.storage.local.set({
      userSettings: settings,
      customPrompt: settings.customPrompt, // Keep legacy sync
    });
    Logger.info("Settings saved:", settings);
    sendResponse({ success: true });
  } catch (error) {
    Logger.error("Save settings failed:", error);
    sendResponse({ success: false, error: error.message });
  } finally {
    mutex.release();
  }

  // Auto-trigger PUSH backup
  handleSyncData(
    { interactive: false, syncMode: "PUSH" },
    () => {},
  );
}

async function handleResetSettings(sendResponse) {
  await mutex.lock();
  try {
    await chrome.storage.local.remove([
      "userSettings",
      "customPrompt",
    ]);
    Logger.info("Settings reset to defaults");
    sendResponse({ success: true });
  } catch (error) {
    Logger.error("Reset settings failed:", error);
    sendResponse({ success: false, error: error.message });
  } finally {
    mutex.release();
  }

  // Auto-trigger PUSH backup
  // Note: Resetting implies clearing cloud settings too?
  // Current PUSH logic will upload "undefined" or default settings, effectively resetting cloud too.
  handleSyncData(
    { interactive: false, syncMode: "PUSH" },
    () => {},
  );
}

async function handleFetchExplanation(
  data,
  tabId,
  sendResponse,
) {
  const { text, context } = data;
  Logger.info(
    `Processing text: "${text}" with context: "${context}"`,
  );

  // Acknowledge request immediately to prevent message port timeout
  sendResponse({ success: true });

  try {
    await callLLMStreaming(text, context, (chunk) => {
      chrome.tabs.sendMessage(tabId, {
        action: "STREAM_UPDATE",
        chunk: chunk,
      });
    });
    chrome.tabs.sendMessage(tabId, {
      action: "STREAM_END",
    });
  } catch (error) {
    Logger.error("LLM Call Failed:", error);
    chrome.tabs.sendMessage(tabId, {
      action: "SHOW_ERROR",
      error: error.message || "Unknown error occurred",
    });
  }
}

async function handleFetchTTS(text, sendResponse) {
  try {
    const audioData = await fetchTTS(text);

    // Create Offscreen Document to play audio
    // We check if it exists first
    const hasOffscreen =
      await chrome.offscreen.hasDocument();
    if (!hasOffscreen) {
      await chrome.offscreen.createDocument({
        url: "src/offscreen/offscreen.html",
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play TTS audio",
      });
    }

    // Send message to offscreen document
    chrome.runtime.sendMessage(
      {
        action: "PLAY_AUDIO",
        audioData: audioData,
      },
      (response) => {
        // Forward the result back to content script
        sendResponse(response);

        // Optional: Close offscreen document after timeout to save resources?
        // For now, we can keep it open or close it.
        // Chrome recommends closing it if not needed.
        // But re-creating it has latency. Let's keep it for now or implement a closer.
      },
    );
  } catch (error) {
    Logger.error("TTS Failed:", error);
    sendResponse({ success: false, error: error.message });
  }
}
