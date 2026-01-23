# LinguaContext - Immersive English Learning Assistant

LinguaContext is a Chrome Extension designed to help users learn English vocabulary in context. Unlike traditional dictionaries, it captures the **sentence context** where you found the word, uses AI to generate context-aware explanations, and provides high-quality TTS pronunciation.

## ✨ Key Features

- **Context-Aware Definitions**: Captures the surrounding sentence when you select a word, providing explanations relevant to the specific usage scenario.
- **AI-Powered Insights**: Uses advanced LLMs (Doubao/Ark) to generate comprehensive word cards including definitions, IPA phonetics, and example sentences.
- **Natural TTS Pronunciation**: High-quality neural text-to-speech engine (Volcengine) for accurate pronunciation.
- **Smart UI Isolation**: Built with **Shadow DOM** technology to ensure the extension's popup and buttons look perfect on any website (e.g., ClickUp, Notion) without style conflicts.
- **Vocabulary Dashboard**: A dedicated dashboard to review your saved words, filter by date, and manage your learning progress.
- **Cloud Sync**: Syncs your vocabulary and settings across devices using **Google Drive**, featuring a robust "Local Master" strategy with conflict resolution.

## 🛠 Technical Architecture

This extension is built on **Manifest V3** standards.

- **Core**:
  - **Service Worker**: Handles all backend logic, API requests, and data synchronization.
  - **Mutex Concurrency Control**: Implements a custom Mutex lock to ensure atomic operations on local storage and sync processes, preventing race conditions.
- **UI & Interaction**:
  - **Shadow DOM**: Content scripts inject UI elements into a Shadow Root, isolating extension styles from the host page CSS.
  - **Offscreen Document**: Handles audio playback (TTS) to comply with Chrome's Service Worker limitations.
- **Data & Sync**:
  - **Storage**: `chrome.storage.local` for local persistence.
  - **Sync Strategy**: Implements a "Soft Delete" mechanism and a Push/Pull sync protocol to manage data consistency between local storage and Google Drive.

## 🚀 Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/LinguaContext.git
    ```
2.  **Open Chrome Extensions**:
    - Navigate to `chrome://extensions/`
    - Enable **Developer mode** (top right toggle).
3.  **Load Unpacked**:
    - Click **Load unpacked**.
    - Select the root directory of this project (`LinguaContext`).

## ⚙️ Configuration

The project uses `src/config/config.js` for API configurations.
*Note: You may need to replace the API keys with your own credentials for production use.*

## 📝 Usage

1.  **Select & Explain**: Highlight any text on a webpage. Click the **📖** icon to get an AI explanation or **🔊** to hear pronunciation.
2.  **Pin Window**: Click the **📌** pin icon to keep the explanation window fixed on the screen while you scroll.
3.  **Save Word**: Click the **☆** star icon to save the word and its context to your vocabulary list.
4.  **Dashboard**: Click the extension icon in the browser toolbar to open the Dashboard for review and settings.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

[MIT License](LICENSE)
