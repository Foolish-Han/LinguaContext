export const CONFIG = {
  // LLM Config (Doubao / Ark)
  LLM: {
    API_KEY: "7ccf7033-6850-4103-bece-68320df3311f",
    BASE_URL:
      "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    MODEL_NAME: "doubao-seed-1-8-251228",
    SYSTEM_PROMPT: `你是一个专业的语言学习助手。请根据用户提供的目标文本和上下文，生成一份简洁、结构化的学习卡片。

**核心要求：**
1. **解释准确**：结合上下文语境，准确解释目标文本的含义。
2. **结构清晰**：使用 Markdown 格式，包含释义、发音、例句（中英对照）、用法解析等部分。
3. **语言简洁**：避免冗长，直击重点。
4. **联网补充**：如果遇到新词或生僻词，请利用联网能力补充最新信息。

**输出格式建议（Markdown）：**
# 目标文本 [音标]
**词性/类型**：...
**释义**：... (结合语境)

## 解析
- **用法**：...
- **辨析**：... (如有必要)

## 例句
1. **English Sentence**
   中文翻译
2. ...
`,
  },

  // TTS Config (Volcengine)
  TTS: {
    APP_ID: "6311772882",
    ACCESS_KEY: "lVRSYXT6Yi2aeq4rzG6QT78qGqFzC_pR",
    RESOURCE_ID: "seed-tts-2.0",
    URL: "https://openspeech.bytedance.com/api/v3/tts/unidirectional",
    DEFAULT_SPEAKER: "zh_female_vv_uranus_bigtts",
    SAMPLE_RATE: 24000,
    FORMAT: "mp3",
  },

  // Google Drive Sync Config
  SYNC: {
    FILENAME: "linguacontext_words.json",
  },

  // Default User Settings
  DEFAULT_SETTINGS: {
    customPrompt: null, // Will use default system prompt if null
    shortcuts: {
      enabled: true,
      explain: "e",
      play: "p",
    },
    showButtons: true,
    autoPlayTTS: true,
  },
};
