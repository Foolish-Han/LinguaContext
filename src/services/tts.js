import { CONFIG } from "../config/config.js";
import { Logger } from "../utils/logger.js";

export async function fetchTTS(text) {
  try {
    const response = await fetch(CONFIG.TTS.URL, {
      method: "POST",
      headers: {
        "X-Api-App-Id": CONFIG.TTS.APP_ID,
        "X-Api-Access-Key": CONFIG.TTS.ACCESS_KEY,
        "X-Api-Resource-Id": CONFIG.TTS.RESOURCE_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user: { uid: "user_1" },
        req_params: {
          text: text,
          speaker: CONFIG.TTS.DEFAULT_SPEAKER,
          audio_params: {
            format: CONFIG.TTS.FORMAT,
            sample_rate: CONFIG.TTS.SAMPLE_RATE,
          },
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `TTS API Error ${response.status}: ${errText}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let base64Audio = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process buffer for complete lines
      let boundary = buffer.indexOf("\n");
      while (boundary !== -1) {
        const line = buffer.slice(0, boundary).trim();
        buffer = buffer.slice(boundary + 1);

        if (line) {
          try {
            const json = JSON.parse(line);

            if (json.code === 3001) {
              // Skip meta info chunk
            } else if (json.code === 3000 && json.data) {
              // Audio Data Chunk
              base64Audio += json.data;
            } else if (json.code === 0 && json.data) {
              // Legacy/Standard format fallback
              base64Audio += json.data;
            } else if (
              json.code > 0 &&
              json.code !== 20000000
            ) {
              Logger.warn("TTS Error Code:", json);
            }
          } catch (e) {
            Logger.warn("JSON Parse Error (Chunk):", e);
          }
        }
        boundary = buffer.indexOf("\n");
      }
    }

    // Process any remaining buffer content
    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer.trim());
        if (json.code === 3000 && json.data) {
          base64Audio += json.data;
        } else if (json.code === 0 && json.data) {
          base64Audio += json.data;
        } else if (
          json.code > 0 &&
          json.code !== 20000000
        ) {
          Logger.warn("TTS Error Code (Final):", json);
        }
      } catch (e) {
        Logger.warn(
          "JSON Parse Error (Final):",
          e,
          "Content:",
          buffer.trim(),
        );
      }
    }

    if (!base64Audio) {
      Logger.warn(
        "No audio data parsed. Raw buffer content:",
        buffer,
      );
      throw new Error(
        "No audio data received from TTS service",
      );
    }

    return `data:audio/mp3;base64,${base64Audio}`;
  } catch (error) {
    Logger.error("TTS Fetch Failed:", error);
    throw error;
  }
}
