// src/content/content-script.js

class LinguaContextObserver {
  constructor() {
    this.host = null;
    this.shadowRoot = null;
    this.triggerContainer = null;
    this.overlay = null;
    this.selectionRange = null;
    this.selectedText = "";

    // Drag & Pin State
    this.isPinned = false;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.savedWordId = null;

    // Settings
    this.settings = {
      shortcuts: { enabled: true, explain: "e", play: "p" },
      showButtons: true,
    };

    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.injectUI();
    this.attachEvents();
    console.log("LinguaContext Observer Initialized (Shadow DOM)");
  }

  async loadSettings() {
    try {
      const data = await chrome.storage.local.get("userSettings");
      if (data.userSettings) {
        this.settings = data.userSettings;
      }
    } catch (e) {
      console.warn("Failed to load settings", e);
    }
  }

  async injectUI() {
    // 1. Create Shadow Host
    this.host = document.createElement("div");
    this.host.id = "linguacontext-shadow-host";
    // Attach to documentElement to avoid body style issues
    (document.documentElement || document.body).appendChild(this.host);

    // 2. Attach Shadow DOM
    this.shadowRoot = this.host.attachShadow({ mode: "open" });

    // 3. Load CSS
    try {
      const cssUrl = chrome.runtime.getURL("src/content/styles.css");
      const response = await fetch(cssUrl);
      const cssText = await response.text();
      const style = document.createElement("style");
      style.textContent = cssText;
      this.shadowRoot.appendChild(style);
    } catch (e) {
      console.warn("LinguaContext: Failed to load styles", e);
    }

    // 4. Create Trigger Container (with Explain and Speak buttons)
    this.triggerContainer = document.createElement("div");
    this.triggerContainer.className = "linguacontext-trigger-container";
    this.triggerContainer.innerHTML = `
      <div class="lc-trigger-btn" id="lc-trigger-explain" title="解释">
         <span class="lc-trigger-icon">📖</span>
      </div>
      <div class="lc-trigger-btn" id="lc-trigger-speak" title="发音">
         <span class="lc-trigger-icon">🔊</span>
      </div>
    `;
    this.shadowRoot.appendChild(this.triggerContainer);

    // 5. Create Overlay
    this.overlay = document.createElement("div");
    this.overlay.className = "linguacontext-overlay";
    this.overlay.innerHTML = `
      <div class="lc-actions">
          <button class="lc-btn lc-speak-btn" title="朗读">🔊</button>
          <button class="lc-btn lc-save-btn" title="收藏到生词本">☆</button>
          <button class="lc-btn lc-pin-btn" title="固定窗口">📌</button>
          <button class="lc-btn lc-close-btn" title="关闭">✕</button>
      </div>
      <div class="lc-content">
        <h1>LinguaContext</h1>
        <p>加载中...</p>
      </div>
    `;
    this.shadowRoot.appendChild(this.overlay);

    // Make Draggable
    this.makeDraggable();

    // Bind Close Button
    this.overlay
      .querySelector(".lc-close-btn")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        this.hideOverlay(true); // Force hide even if pinned
      });

    // Bind Pin Button
    this.overlay
      .querySelector(".lc-pin-btn")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        this.togglePin();
      });

    // Bind Save Button
    this.overlay
      .querySelector(".lc-save-btn")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleSave();
      });

    // Bind Speak Button (in overlay)
    this.overlay
      .querySelector(".lc-speak-btn")
      .addEventListener("click", (e) => {
        e.stopPropagation();
        this.playTTS(this.selectedText);
      });
  }

  makeDraggable() {
    this.overlay.addEventListener("mousedown", (e) => {
      // Ignore if clicking buttons
      if (
        e.target.closest(".lc-btn") ||
        e.target.closest("input") ||
        e.target.closest("a")
      )
        return;

      // Check relative Y to restrict drag to header
      const rect = this.overlay.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;

      // Only allow dragging top 40px
      if (relativeY > 40) return;

      this.isDragging = true;
      this.dragOffset.x = e.clientX - rect.left;
      this.dragOffset.y = e.clientY - rect.top;

      // Disable transition during drag for smoothness
      this.overlay.style.transition = "none";

      e.preventDefault(); // Prevent text selection during drag
    });

    document.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;

      const x = e.clientX - this.dragOffset.x;
      const y = e.clientY - this.dragOffset.y;

      if (this.isPinned) {
        this.overlay.style.left = `${x}px`;
        this.overlay.style.top = `${y}px`;
      } else {
        this.overlay.style.left = `${x + window.scrollX}px`;
        this.overlay.style.top = `${y + window.scrollY}px`;
      }

      this.overlay.style.transform = "none";
    });

    document.addEventListener("mouseup", () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.overlay.style.transition = "";
      }
    });
  }

  togglePin() {
    this.isPinned = !this.isPinned;
    const btn = this.overlay.querySelector(".lc-pin-btn");

    const rect = this.overlay.getBoundingClientRect(); // Viewport relative

    if (this.isPinned) {
      btn.classList.add("pinned");
      // Switch to fixed
      this.overlay.style.position = "fixed";
      this.overlay.style.top = `${rect.top}px`;
      this.overlay.style.left = `${rect.left}px`;
      this.overlay.style.zIndex = "2147483647";
    } else {
      btn.classList.remove("pinned");
      // Switch to absolute
      this.overlay.style.position = "absolute";
      this.overlay.style.top = `${rect.top + window.scrollY}px`;
      this.overlay.style.left = `${rect.left + window.scrollX}px`;
    }
  }

  attachEvents() {
    document.addEventListener("mouseup", (e) => this.handleMouseUp(e));

    // Keyboard Shortcuts
    document.addEventListener("keydown", (e) => this.handleKeyDown(e));

    // Prevent selection loss when clicking trigger container
    this.triggerContainer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // Bind Trigger Buttons
    const btnExplain = this.triggerContainer.querySelector(
      "#lc-trigger-explain"
    );
    const btnSpeak = this.triggerContainer.querySelector("#lc-trigger-speak");

    btnExplain.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handleTriggerClick(e);
    });

    btnSpeak.addEventListener("click", (e) => {
      e.stopPropagation();
      this.handlePronounceOnly(e);
    });

    // Listen for messages from Background
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === "STREAM_UPDATE") {
        this.handleStreamUpdate(request.chunk);
      } else if (request.action === "STREAM_END") {
        this.handleStreamEnd();
      } else if (request.action === "SHOW_ERROR") {
        this.showError(request.error);
      }
    });

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.userSettings) {
        this.settings = changes.userSettings.newValue;
      }
    });
  }

  handleKeyDown(e) {
    if (!this.settings.shortcuts?.enabled) return;
    if (!this.selectedText) return;

    // Don't trigger if typing in an input
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    if (document.activeElement.isContentEditable) return;

    if (this.matchShortcut(e, this.settings.shortcuts.explain)) {
      e.preventDefault();
      this.handleTriggerClick(e);
    } else if (this.matchShortcut(e, this.settings.shortcuts.play)) {
      e.preventDefault();
      this.handlePronounceOnly(e);
    }
  }

  matchShortcut(event, shortcutString) {
    if (!shortcutString) return false;

    const parts = shortcutString.split("+").map((p) => p.trim().toLowerCase());
    const key = parts.pop();

    const needCtrl = parts.includes("ctrl");
    const needAlt = parts.includes("alt");
    const needShift = parts.includes("shift");
    const needCmd = parts.includes("cmd") || parts.includes("meta");

    if (event.ctrlKey !== needCtrl) return false;
    if (event.altKey !== needAlt) return false;
    if (event.shiftKey !== needShift) return false;
    if (event.metaKey !== needCmd) return false;

    if (event.key.toLowerCase() === key) return true;
    if (key === "space" && event.code === "Space") return true;

    return false;
  }

  handleMouseUp(e) {
    // Check if click is inside Shadow DOM components
    // e.target on document listeners won't see inside shadow DOM unless composed.
    // However, if the user clicks inside our overlay, the event *does* bubble to document as the Host element?
    // Actually, we need to check if the click target is the Host.
    
    // BUT: we have specific listeners on the overlay buttons that stopPropagation.
    // So if we click a button, this document listener won't fire?
    // Wait, `mouseup` on document fires after `click` on button?
    // We used `click` for buttons. `mouseup` is for selection.

    // If I click inside the overlay (e.g. text), `e.target` will be the Host element (because shadow dom encapsulates).
    if (e.target === this.host) {
        // We can't easily tell *where* inside the host.
        // But if the user clicks the host (overlay), we shouldn't treat it as a new selection on the page.
        return;
    }

    const selection = window.getSelection();
    const text = selection.toString().trim();

    if (text.length > 0) {
      this.selectedText = text;
      this.selectionRange = selection.getRangeAt(0).cloneRange();
      this.showTrigger();
    } else {
      this.hideTrigger();
      if (!this.isPinned) {
        this.hideOverlay();
      }
      this.selectedText = "";
    }
  }

  showTrigger() {
    if (!this.selectionRange) return;
    if (!this.settings.showButtons) return;

    const rect = this.selectionRange.getBoundingClientRect();
    const top = rect.top + window.scrollY - 50;
    const left = rect.right + window.scrollX;
    const finalTop = Math.max(0, top);

    this.triggerContainer.style.top = `${finalTop}px`;
    this.triggerContainer.style.left = `${left}px`;
    this.triggerContainer.classList.add("visible");
  }

  hideTrigger() {
    this.triggerContainer.classList.remove("visible");
  }

  handlePronounceOnly(e) {
    this.hideTrigger();
    const text = this.selectedText;
    if (text) {
      this.playTTS(text);
    }
  }

  playTTS(text) {
    if (!text) return;
    chrome.runtime.sendMessage(
      { action: "FETCH_TTS", text: text },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("TTS Error:", chrome.runtime.lastError);
          return;
        }
        if (response && response.success) {
          // Success
        } else {
          console.error("TTS API Failed:", response?.error);
        }
      }
    );
  }

  handleTriggerClick(e) {
    try {
      if (!chrome.runtime?.id) throw new Error("Extension context invalidated");
    } catch (err) {
      this.showRefreshTip();
      return;
    }

    this.hideTrigger();
    this.showOverlay();

    this.streamContent = "";
    this.overlay.querySelector(".lc-content").innerHTML =
      `<div class="lc-loading">思考中...</div>`;

    this.savedWordId = null;
    this.setSaveBtnState(false);
    this.overlay.querySelector(".lc-save-btn").style.display = "none";

    const text = this.selectedText;
    const context = this.getContextFromSelection();

    if (this.settings.autoPlayTTS) {
      this.playTTS(text);
    }

    this.currentContext = context;
    console.log("Sending message to background:", text);

    try {
      chrome.runtime.sendMessage(
        {
          action: "FETCH_EXPLANATION",
          text: text,
          context: context,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            if (this.streamContent && this.streamContent.length > 0) {
              console.warn("Ignored runtime error after stream started:", chrome.runtime.lastError);
              return;
            }
            const errMsg = chrome.runtime.lastError.message || "";
            if (errMsg.includes("Extension context invalidated")) {
              this.showRefreshTip();
              this.hideOverlay(true);
            } else {
              this.updateOverlay({
                word: "Error",
                detail_html: `<h3 style="color:red">连接失败</h3><p>原因: ${errMsg}</p>`,
                text: "连接错误",
                explanation: errMsg,
              });
            }
          }
        }
      );
    } catch (err) {
      console.error("Sync Error sending message:", err);
      this.showRefreshTip();
      this.hideOverlay(true);
    }
  }

  handleStreamUpdate(chunk) {
    if (this.streamContent === "") {
      this.overlay.querySelector(".lc-content").innerHTML =
        `<div class="lc-markdown"></div>`;
    }
    this.streamContent += chunk;
    const html = this.parseMarkdown(this.streamContent);
    const contentContainer = this.overlay.querySelector(".lc-markdown");
    if (contentContainer) {
      contentContainer.innerHTML = html;
    }
  }

  handleStreamEnd() {
    let word = this.selectedText;
    const h1Match = this.streamContent.match(/^# (.*$)/m);
    if (h1Match) {
      word = h1Match[1].trim();
    }

    this.currentData = {
      word: word,
      markdown: this.streamContent,
      html: this.parseMarkdown(this.streamContent),
      timestamp: Date.now(),
      context: this.currentContext || "",
    };

    this.checkIsSaved(word);
    this.overlay.querySelector(".lc-save-btn").style.display = "flex";
  }

  showRefreshTip() {
    const toast = document.createElement("div");
    toast.style.cssText = `
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          background-color: #333;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          z-index: 2147483647;
          font-family: -apple-system, sans-serif;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.3s ease;
      `;
    toast.textContent = "插件已更新，请刷新当前页面以继续使用 🔄";
    document.body.appendChild(toast); // Append toast to body (outside shadow DOM) to ensure visibility? 
    // Yes, for toast it's fine.

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
    });

    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  getContextFromSelection() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return this.selectedText;
    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    if (container.nodeType === 3) container = container.parentElement;
    let context = container.innerText || container.textContent || "";
    context = context.replace(/\s+/g, " ").trim();
    if (context.length < 50 && container.parentElement) {
      let parentContext = container.parentElement.innerText || container.parentElement.textContent || "";
      parentContext = parentContext.replace(/\s+/g, " ").trim();
      if (parentContext.length > context.length) context = parentContext;
    }
    if (context.length > 500) {
      const index = context.indexOf(this.selectedText);
      if (index !== -1) {
        const start = Math.max(0, index - 250);
        const end = Math.min(context.length, index + this.selectedText.length + 250);
        context = "..." + context.substring(start, end) + "...";
      } else {
        context = context.substring(0, 500) + "...";
      }
    }
    return context || this.selectedText;
  }

  showOverlay() {
    if (this.isPinned) {
      this.overlay.classList.add("visible");
      this.overlay.querySelector(".lc-content").innerHTML =
        "<div class='lc-loading'>思考中...</div>";
      return;
    }

    if (this.selectionRange) {
      const rect = this.selectionRange.getBoundingClientRect();
      const top = rect.bottom + window.scrollY + 10;
      const left = rect.left + window.scrollX;
      this.overlay.style.top = `${top}px`;
      this.overlay.style.left = `${left}px`;
      this.overlay.style.transform = "";
    }

    this.overlay.querySelector(".lc-content").innerHTML =
      "<div class='lc-loading'>思考中...</div>";
    this.overlay.classList.add("visible");
  }

  hideOverlay(force = false) {
    if (this.isPinned && !force) return;
    this.overlay.classList.remove("visible");
  }

  updateOverlay(data) {
    if (data.markdown || (data.word && data.word !== "Error")) {
      this.overlay.querySelector(".lc-save-btn").style.display = "flex";
    }
    if (data.markdown) {
      const html = this.parseMarkdown(data.markdown);
      let word = this.selectedText;
      const h1Match = data.markdown.match(/^# (.*$)/m);
      if (h1Match) word = h1Match[1].trim();
      this.currentData = {
        word: word,
        markdown: data.markdown,
        html: html,
        timestamp: Date.now(),
      };
      this.checkIsSaved(word);
      this.overlay.querySelector(".lc-content").innerHTML = `<div class="lc-markdown">${html}</div>`;
      return;
    }
    this.currentData = data;
    this.checkIsSaved(data.word);
    const content = this.overlay.querySelector(".lc-content");
    if (!data.word && data.text) {
      content.innerHTML = `<h1>${data.text}</h1><p>${data.explanation}</p>`;
      return;
    }
    content.innerHTML = `<p>未知数据格式</p>`;
  }

  parseMarkdown(markdown) {
    if (!markdown) return "";
    const escapeHtml = (text) =>
      text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const lines = markdown.split("\n");
    let output = "";
    let state = {
      inList: false,
      inOrderedList: false,
      inTable: false,
      inBlockquote: false,
      inCodeBlock: false,
    };

    const closeBlocks = (exclude = "") => {
      if (state.inList && exclude !== "list") {
        output += "</ul>";
        state.inList = false;
      }
      if (state.inOrderedList && exclude !== "ordered-list") {
        output += "</ol>";
        state.inOrderedList = false;
      }
      if (state.inTable && exclude !== "table") {
        output += "</tbody></table>";
        state.inTable = false;
      }
      if (state.inBlockquote && exclude !== "blockquote") {
        output += "</blockquote>";
        state.inBlockquote = false;
      }
    };

    const formatInline = (text) =>
      text
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.*?)\*/g, "<em>$1</em>")
        .replace(/~~(.*?)~~/g, "<del>$1</del>")
        .replace(/`([^`]+)`/g, "<code>$1</code>");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith("```")) {
        closeBlocks("code");
        if (state.inCodeBlock) {
          output += "</code></pre>";
          state.inCodeBlock = false;
        } else {
          const lang = trimmed.slice(3).trim();
          output += `<pre><code class="${lang}">`;
          state.inCodeBlock = true;
        }
        continue;
      }
      if (state.inCodeBlock) {
        output += escapeHtml(line) + "\n";
        continue;
      }
      if (trimmed.startsWith(">")) {
        closeBlocks("blockquote");
        if (!state.inBlockquote) {
          output += "<blockquote>";
          state.inBlockquote = true;
        }
        output += `<p>${formatInline(trimmed.replace(/^>\s?/, ""))}</p>`;
        continue;
      } else if (state.inBlockquote) {
        closeBlocks();
      }
      if (trimmed === "---" || trimmed === "***" || trimmed.match(/^(-{3,}|\*{3,})$/)) {
        closeBlocks();
        output += "<hr>";
        continue;
      }
      if (trimmed.startsWith("|")) {
        closeBlocks("table");
        const cells = trimmed
          .split("|")
          .map((c) => c.trim())
          .filter((c, idx, arr) => {
            if (idx === 0 && c === "") return false;
            if (idx === arr.length - 1 && c === "") return false;
            return true;
          });
        if (!state.inTable) {
          const nextLine = lines[i + 1]?.trim();
          if (nextLine && nextLine.startsWith("|") && nextLine.includes("---")) {
            output += "<table><thead><tr>";
            cells.forEach((cell) => (output += `<th>${formatInline(cell)}</th>`));
            output += "</tr></thead><tbody>";
            state.inTable = true;
            i++;
            continue;
          } else {
            output += `<p>${formatInline(trimmed)}</p>`;
          }
        } else {
          output += "<tr>";
          cells.forEach((cell) => (output += `<td>${formatInline(cell)}</td>`));
          output += "</tr>";
        }
        continue;
      } else if (state.inTable) {
        closeBlocks();
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
        closeBlocks("list");
        if (!state.inList) {
          output += "<ul>";
          state.inList = true;
        }
        output += `<li>${formatInline(trimmed.substring(2))}</li>`;
        continue;
      }
      const orderedMatch = trimmed.match(/^(\d+)\.\s(.*)/);
      if (orderedMatch) {
        closeBlocks("ordered-list");
        if (!state.inOrderedList) {
          output += "<ol>";
          state.inOrderedList = true;
        }
        output += `<li>${formatInline(orderedMatch[2])}</li>`;
        continue;
      }
      if (state.inList || state.inOrderedList) closeBlocks();
      if (!trimmed) {
        closeBlocks();
        continue;
      }
      const headerMatch = trimmed.match(/^(#{1,6})\s(.*)/);
      if (headerMatch) {
        closeBlocks();
        const level = headerMatch[1].length;
        output += `<h${level}>${formatInline(headerMatch[2])}</h${level}>`;
        continue;
      }
      closeBlocks();
      output += `<p>${formatInline(trimmed)}</p>`;
    }
    closeBlocks();
    return output;
  }

  checkIsSaved(word) {
    if (!word) return;
    chrome.runtime.sendMessage({ action: "CHECK_IS_SAVED", word: word }, (response) => {
      if (response && response.isSaved) {
        this.savedWordId = response.id;
        this.setSaveBtnState(true);
      } else {
        this.savedWordId = null;
        this.setSaveBtnState(false);
      }
    });
  }

  toggleSave() {
    if (!this.currentData || !this.currentData.word) return;
    if (this.savedWordId) {
      chrome.runtime.sendMessage({ action: "REMOVE_WORD", wordId: this.savedWordId }, (response) => {
        if (response && response.success) {
          this.savedWordId = null;
          this.setSaveBtnState(false);
        }
      });
    } else {
      chrome.runtime.sendMessage({ action: "SAVE_WORD", data: this.currentData }, (response) => {
        if (response && response.success) {
          this.savedWordId = response.id;
          this.setSaveBtnState(true);
        }
      });
    }
  }

  setSaveBtnState(isSaved) {
    const btn = this.overlay.querySelector(".lc-save-btn");
    if (isSaved) {
      btn.textContent = "★";
      btn.classList.add("saved");
    } else {
      btn.textContent = "☆";
      btn.classList.remove("saved");
    }
  }

  showError(errorMsg) {
    const content = this.overlay.querySelector(".lc-content");
    content.innerHTML = `
      <h1 class="lc-error-title">错误</h1>
      <p class="lc-error-msg">${errorMsg}</p>
    `;
  }
}

new LinguaContextObserver();