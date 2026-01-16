# Phase 2: 接入智能 (Intelligence) 开发计划

本阶段目标是将模拟的后端逻辑替换为真实的 LLM API 调用，并优化前端展示以呈现结构化的学习内容。

## 1. 架构调整
-   **Manifest 更新**: 为了确保 Background Service Worker 能顺利访问外部 API 且不被 CORS 拦截，需要在 `manifest.json` 中添加 `host_permissions`。

## 2. 模块 B: 大脑 (Background Service Worker)
-   **集成 LLM API**:
    -   使用 `fetch` 调用兼容 OpenAI 接口的阿里云 DashScope 服务。
    -   配置 `API_KEY` (来自 `model.txt`) 和 `BASE_URL`。
    -   模型使用 `qwen-plus` (修正 `model.txt` 中的 `qwen-pluswo` 拼写，或确认是否为特定微调模型，暂定使用标准 `qwen-plus` 或用户指定的 `qwen-pluswo` 如果它是有效的，但根据经验 `qwen-plus` 更常见，我会先尝试使用配置中的名称，如果失败则回退或报错)。
    -   *修正*: `model.txt` 内容为 `model-name:qwen-pluswo`。我会照常使用，但如果 API 报错则回退到 `qwen-plus`。
-   **Prompt Engineering**:
    -   设计 System Prompt，强制模型返回 **纯 JSON** 格式。
    -   输入：选中词 (Target Word) + 上下文句子 (Context Sentence)。
    -   输出结构 (Schema)：
        ```json
        {
          "word": "原型/修正后的词",
          "ipa": "音标",
          "pos": "词性",
          "definition_en": "英文释义 (基于语境)",
          "definition_cn": "中文释义 (基于语境)",
          "context_analysis": "语境解析 (为什么这里用这个词)",
          "mnemonic": "记忆口诀/联想"
        }
        ```

## 3. 模块 C: 呈现层 (UI Components)
-   **Content Script 升级**:
    -   解析 Background 返回的 JSON 数据。
    -   构建富文本 HTML 结构，分区块展示：头部 (词+音标)、核心 (释义)、洞察 (语境分析)。
-   **样式升级 (`styles.css`)**:
    -   增加针对不同数据字段的样式 (如音标使用灰色小字，释义重点突出，标签化词性)。
    -   优化 Loading 状态和错误状态的显示。

## 4. 实施步骤
1.  **配置权限**: 修改 `manifest.json` 添加 `host_permissions`。
2.  **实现 API 调用**: 在 `service-worker.js` 中编写 `fetchLLM` 函数和 Prompt 构建逻辑。
3.  **更新前端渲染**: 修改 `content-script.js` 的 `updateOverlay` 方法。
4.  **美化样式**: 更新 `styles.css`。
5.  **验证**: 选中网页文本，确认能从 LLM 获取并展示真实分析结果。