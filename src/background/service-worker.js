import { driveService } from "./google-drive.js";
import { callLLMStreaming } from "../services/llm.js";
import { fetchTTS } from "../services/tts.js";
import { Logger } from "../utils/logger.js";
import { CONFIG } from "../config/config.js";

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
  const { interactive, forceUploadSettings } = request;
  try {
    const token =
      await driveService.getAuthToken(interactive);

    // 1. Get local data
    const localData = await chrome.storage.local.get([
      "savedWords",
      "customPrompt",
      "userSettings",
    ]);
    const localWords = localData.savedWords || {};

    // Normalize Local Settings
    let localSettings = localData.userSettings;

    // Migration: If no userSettings but legacy customPrompt exists
    if (!localSettings && localData.customPrompt) {
      localSettings = {
        ...CONFIG.DEFAULT_SETTINGS,
        customPrompt: localData.customPrompt,
      };
      // We don't save back immediately here, we wait for the sync completion
    } else if (!localSettings) {
      // First time load or no settings
      localSettings = { ...CONFIG.DEFAULT_SETTINGS };
    }

    // 2. Get cloud file
    const cloudFile =
      await driveService.findBackupFile(token);

    let mergedWords = { ...localWords };
    let cloudWords = {};
    let cloudSettings = null;
    let settingsConflict = null;

    if (cloudFile) {
      // Cloud file exists, download and merge
      Logger.info("Downloading cloud backup...");
      const cloudData = await driveService.downloadFile(
        token,
        cloudFile.id,
      );

      // Parse Cloud Data
      if (cloudData.savedWords) {
        cloudWords = cloudData.savedWords;
      } else if (
        !cloudData.userSettings &&
        !cloudData.customPrompt
      ) {
        // Legacy: whole file is savedWords
        cloudWords = cloudData;
      }

      // Parse Cloud Settings
      if (cloudData.userSettings) {
        cloudSettings = cloudData.userSettings;
      } else if (cloudData.customPrompt) {
        // Legacy Cloud: migrate prompt to settings
        cloudSettings = {
          ...CONFIG.DEFAULT_SETTINGS,
          customPrompt: cloudData.customPrompt,
        };
      }

      // Merge Words Strategy: Keep the newer version based on timestamp
      Object.keys(cloudWords).forEach((id) => {
        const cloudEntry = cloudWords[id];
        const localEntry = localWords[id];

        if (!localEntry) {
          mergedWords[id] = cloudEntry;
        } else {
          if (
            (cloudEntry.timestamp || 0) >
            (localEntry.timestamp || 0)
          ) {
            mergedWords[id] = cloudEntry;
          }
        }
      });

      // Check Settings Conflict
      // We only check conflict if interactive (user initiated) and not forced
      if (!forceUploadSettings && interactive) {
        // Simple Deep Equal Check
        const localStr = JSON.stringify(localSettings);
        const cloudStr = cloudSettings
          ? JSON.stringify(cloudSettings)
          : null;

        if (cloudStr && localStr !== cloudStr) {
          settingsConflict = {
            local: localSettings,
            cloud: cloudSettings,
          };
        } else if (
          cloudStr &&
          !localData.userSettings &&
          !localData.customPrompt
        ) {
          // If local is brand new/empty, adopt cloud without conflict
          localSettings = cloudSettings;
        }
      } else if (!forceUploadSettings && !interactive) {
        // Silent sync: If cloud exists and we are just background syncing
        // We usually trust the one with latest timestamp? But we don't have timestamp on settings.
        // For safety in background sync:
        // If local is default and cloud is not, take cloud.
        // Otherwise, we might skip settings sync or overwrite cloud?
        // Let's safe-guard: If background sync, do NOT overwrite cloud settings if they differ?
        // Or just skip settings sync in background if conflict?

        // Current decision: In background sync, if conflict, we do NOTHING to settings (keep local),
        // but we still sync words.
        if (cloudSettings) {
          const localStr = JSON.stringify(localSettings);
          const cloudStr = JSON.stringify(cloudSettings);
          if (localStr !== cloudStr) {
            // Conflict in background: ignore settings sync, just keep local
            // But we should probably pull cloud settings if local is untouched?
            // Too complex. Let's just ignore settings changes in silent mode if conflict.
          }
        }
      }
    }

    // 3. Update local storage
    // If we resolved to use cloudSettings (in the auto-adopt case), we update local
    if (localSettings) {
      await chrome.storage.local.set({
        savedWords: mergedWords,
        userSettings: localSettings,
        // Keep legacy customPrompt in sync for now just in case
        customPrompt: localSettings.customPrompt,
      });
    } else {
      await chrome.storage.local.set({
        savedWords: mergedWords,
      });
    }

    // 4. Update cloud file
    // If conflict exists, we DO NOT upload settings, we just return the conflict.
    // The user will resolve and call again with forceUploadSettings=true (after updating local).

    if (!settingsConflict) {
      const payload = {
        savedWords: mergedWords,
        userSettings: localSettings,
        updatedAt: Date.now(),
      };

      Logger.info("Uploading merged backup...");
      await driveService.uploadFile(
        token,
        payload,
        cloudFile ? cloudFile.id : null,
      );
    }

    sendResponse({
      success: true,
      count: Object.keys(mergedWords).length,
      settingsConflict: settingsConflict, // Renamed from promptConflict
    });
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
  try {
    const { savedWords = {} } =
      await chrome.storage.local.get("savedWords");
    const id = Date.now().toString();
    const entry = {
      ...wordData,
      id,
      timestamp: Date.now(),
    };
    savedWords[id] = entry;
    await chrome.storage.local.set({ savedWords });
    Logger.info("Word saved:", entry);
    sendResponse({ success: true, id });
  } catch (error) {
    Logger.error("Save failed:", error);
    sendResponse({ success: false, error: error.message });
  }
}

async function handleRemoveWord(wordId, sendResponse) {
  try {
    const { savedWords = {} } =
      await chrome.storage.local.get("savedWords");
    if (savedWords[wordId]) {
      delete savedWords[wordId];
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
  }
}

async function handleCheckIsSaved(wordText, sendResponse) {
  try {
    const { savedWords = {} } =
      await chrome.storage.local.get("savedWords");
    const entry = Object.values(savedWords).find(
      (entry) =>
        entry.word &&
        wordText &&
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
