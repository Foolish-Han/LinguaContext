Based on the systematic review of your current codebase (v2.1 with Shortcuts, Sync, and Modular Architecture), I will generate the following two comprehensive documents to replace the outdated `product.md`.

### 1. Product Manual (`docs/product_manual.md`)
A user-facing guide detailing all features and usage flows.
*   **Core Features**: Context-aware AI explanation, Neural TTS pronunciation, One-click Word collection.
*   **Interaction Guide**: 
    *   **Floating Triggers**: How to use the pop-up icons.
    *   **Shortcuts**: Using keyboard shortcuts (`e`, `p`) for efficiency.
    *   **Window Management**: Pinning, Dragging, and Markdown rendering features.
*   **Dashboard & Settings**:
    *   **Wordbook**: Reviewing, Deleting, and playing audio for saved words.
    *   **Cloud Sync**: Google Drive integration, multi-device synchronization, and conflict resolution for Prompts/Settings.
    *   **Customization**: Configuring System Prompts and Toggle settings.

### 2. Architecture Documentation (`docs/architecture.md`)
A technical guide for maintainers, describing the system design.
*   **System Overview**: Chrome Extension Manifest V3 architecture.
*   **Project Structure**: Detailed breakdown of `src/` directories (`background`, `content`, `dashboard`, `services`, `offscreen`, `config`).
*   **Key Modules & Logic**:
    *   **Content Script**: Selection monitoring, DOM traversal for context, Event handling (Mouse/Keyboard), Overlay UI injection.
    *   **Service Worker**: Message routing pattern, Singleton services instantiation.
    *   **Services Layer**: 
        *   `LLM`: Streaming response handling (Volcengine).
        *   `TTS`: Binary buffer handling and Offscreen playback (CSP bypass).
        *   `Drive`: OAuth2 auth flow and JSON file sync logic.
    *   **Data Flow**: Diagrammatic description of the message passing between Content Script, Background, and APIs.
    *   **Storage Strategy**: `chrome.storage.local` usage and Cloud Sync data structure (`savedWords` + `userSettings`).

I will create these two files in the `docs/` directory.