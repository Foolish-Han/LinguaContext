# Phase 5: 深度学习内容升级 (Advanced AI Content)

本阶段的目标是根据用户提供的详细 Prompt 模板，全面升级 AI 的输出质量，使其从简单的词典查询变为深度的语言学习助手。

## 1. 后端逻辑升级 (`src/background/service-worker.js`)
-   **Prompt 重构**:
    -   将用户提供的新 Prompt 模板集成到 System Prompt 中。
    -   调整 JSON Schema 以适配更丰富的内容结构。由于新 Prompt 要求根据文本类型（单词/短语/句子/中文）灵活输出，我们需要一个更通用的 JSON 结构，或者让 AI 返回 Markdown 格式的内容以便更自由地展示。
    -   *决策*: 之前的 JSON 结构 (`word`, `ipa`, `pos`, `definition_en`, `definition_cn`, `context_analysis`, `mnemonic`) 比较死板，无法很好地承载 "句子结构分析"、"关键词深度解析" 等复杂内容。
    -   *方案*: 保持顶层 JSON 结构，但增加一个 `html_content` 或 `structured_content` 字段，允许 AI 返回经过组织的 HTML 片段（或者 Markdown，前端转 HTML）。考虑到 Prompt 中明确提到 "不要使用表格"、"层次清晰"，且要求灵活展示，**直接让 AI 返回渲染好的 HTML 片段** (仅 body 内容) 可能比定义极其复杂的 JSON Schema 更灵活且效果更好。
    -   *修正方案*: 混合模式。
        -   `word`: 核心词/句 (用于标题)。
        -   `ipa`: 音标 (如果是单词/短语)。
        -   `pos`: 词性 (如果是单词)。
        -   `summary`: 简短释义 (用于列表展示)。
        -   `detail_html`: **核心字段**。让 AI 根据 Prompt 生成完整的、结构化的 HTML 内容（包含 `<h3>`, `<ul>`, `<li>`, `<strong>` 等标签），直接注入到卡片的详细区域。这样可以完美适配用户要求的 "灵活选择内容"。

-   **Prompt 调整**:
    -   要求 AI 返回 JSON: `{ "word": "...", "ipa": "...", "pos": "...", "summary": "...", "detail_html": "..." }`。
    -   在 `detail_html` 中，AI 依据 Prompt 生成深度解析内容。

## 2. 前端展示升级 (`src/content/content-script.js` & `styles.css`)
-   **Content Script**:
    -   调整 `updateOverlay` 方法，不再逐个字段拼凑 DOM，而是渲染 `detail_html`。
    -   保留 Header 区域 (`word`, `ipa`, `pos`) 用于快速识别。
-   **CSS**:
    -   为 `detail_html` 中的标签 (`h3`, `ul`, `li`, `strong`, `p`) 添加样式，保持 Apple-like 风格。
    -   增加对 "关键词深度解析" 等区块的视觉区分。

## 3. 实施步骤
1.  **Service Worker**: 更新 `systemPrompt`，嵌入新模板，并定义新的 JSON 输出格式。
2.  **CSS**: 添加针对富文本内容的样式规则 (如 `.lc-detail h3`, `.lc-detail ul` 等)。
3.  **Content Script**: 更新渲染逻辑，适配新数据结构。
4.  **验证**: 测试单词、短语、长句、中文四种场景，确保内容展示符合预期且格式美观。