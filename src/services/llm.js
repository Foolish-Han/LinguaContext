import { CONFIG } from "../config/config.js";
import { Logger } from "../utils/logger.js";

export async function callLLMStreaming(
  targetWord,
  contextSentence,
  onChunk,
) {
  const userPrompt = `目标文本: "${targetWord}"\n上下文: "${contextSentence}"`;

  try {
    // 1. Get custom prompt from storage
    const { customPrompt } =
      await chrome.storage.local.get("customPrompt");
    const systemContent =
      customPrompt || CONFIG.LLM.SYSTEM_PROMPT;

    const response = await fetch(CONFIG.LLM.BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.LLM.API_KEY}`,
      },
      body: JSON.stringify({
        model: CONFIG.LLM.MODEL_NAME,
        messages: [
          {
            role: "user",
            content: `${systemContent}\n\n${userPrompt}`,
          },
        ],
        temperature: 0.3,
        stream: true,
        thinking: {
          type: "disabled",
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(
        `LLM API Error ${response.status}: ${errText}`,
      );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk
        .split("\n")
        .filter((line) => line.trim() !== "");

      for (const line of lines) {
        if (line.startsWith("data:")) {
          const dataStr = line.slice(5).trim();
          if (dataStr === "[DONE]") return;

          try {
            const data = JSON.parse(dataStr);
            // Handle optional chaining safely
            const content =
              data.choices?.[0]?.delta?.content;
            if (content) {
              onChunk(content);
            }
          } catch (e) {
            Logger.warn("Failed to parse SSE chunk:", e);
          }
        }
      }
    }
  } catch (error) {
    Logger.error("LLM Streaming Error:", error);
    throw error;
  }
}
