# Phase 6: 中文输出优化 (Chinese Localization)

本阶段的目标是强制 AI 使用中文进行讲解，以符合中国用户的英语学习习惯。

## 1. 核心问题分析
目前 System Prompt 虽然包含了中文场景，但对于英文输入（单词/句子），Prompt 中的指令多为英文（如 "Definition", "Collocations"），且缺少明确的 "使用中文回答" 的全局约束。这导致 AI 倾向于用英文解释英文。

## 2. 解决方案：Prompt 调优 (`src/background/service-worker.js`)
-   **全局约束**: 在 System Prompt 开头明确指令：**"You must use Simplified Chinese (简体中文) for all explanations, definitions, and analysis, unless specifically teaching an English phrase."**（所有解释、释义和分析必须使用简体中文）。
-   **模板汉化**: 将 Prompt 模板中的各个板块标题和指令翻译成中文。
    -   *Example*: `**[English Word]**` -> `**【英文单词】**`
    -   *Example*: `Lemma & IPA` -> `词形还原 & 音标`
    -   *Example*: `Etymology` -> `词源 (中文讲解)`
-   **输出格式**: 保持 JSON 结构，但明确 `detail_html` 中的文本内容（标题、段落）必须是中文。

## 3. 实施步骤
1.  **Service Worker**: 修改 `systemPrompt`。
    -   添加全局中文指令。
    -   汉化所有 Prompt 描述。
2.  **验证**: 再次测试英文单词、句子，确认解析语言变为中文。

## 4. 预期效果
-   输入: "Serendipity"
-   输出 (HTML):
    -   <h3>释义</h3> <p>n. 意外发现珍奇事物的本领；机缘凑巧。</p>
    -   <h3>词源</h3> <p>源自波斯童话《锡兰三王子》...</p>
    -   <h3>语境分析</h3> <p>在当前句子中，它指的是...</p>