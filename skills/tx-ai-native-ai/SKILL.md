---
name: tx-ai-native-ai
description: 使用 Tx-AI 系统原生 AI，通过个人 Agent 凭证与 MCP/HTTP 调用智能对话、工作空间对话、页面已有业务计算、TxADCL 算子及授权结果。用于委托平台分析、复用计算结果、查询任务和下载附件；不用于部署系统或直接调用模型供应商。
---

# Tx-AI 原生 AI

把 Tx-AI 当作有持久任务、业务数据、计算服务和结果授权的分析平台。优先读取已有结果；需新增计算时，调用平台发现到的能力。模型供应商接口不是本技能的入口。

## 连接与选择

1. 每次使用先执行 `set -a; . ~/.config/tx-ai-native-ai/connection.env; set +a`（文件不存在时才询问连接信息）。配置目录必须为 `0700`、文件为 `0600`。默认使用 `PLATFORM_BASE_URL` 和 `PLATFORM_AGENT_TOKEN`；多部署连接使用 `PLATFORM_BASE_URL_<连接名>`、`PLATFORM_AGENT_TOKEN_<连接名>`，默认连接名由 `TX_AI_NATIVE_AI_DEFAULT_CONNECTION` 表示。凭证形如 `txai_<grant-id>.<secret>`，由网页用户在页面助手授权管理创建、仅创建时展示；供应商 `sk-…` 密钥不能替代它。
2. 授权成功后执行 `printf '%s' "$token" | node scripts/connection.mjs save --url "$url" --token-stdin --name DEFAULT`。脚本原子写入安全配置并更新默认单连接变量；后续运行自动加载，不再索要 URL/token。禁止写入仓库、项目 `.env`、对话、日志或交付文件。
3. 已有 MCP 连接时，读取 [MCP 调用](references/mcp.md)，执行 `list_capabilities`。只有 HTTP 时，读取 [HTTP 调用与结果](references/http.md)，请求 `/api/ai/capabilities`。没有地址/凭证则只询问缺失项；不创建账号或读取服务端数据库来绕过授权。
4. 以当前发现结果的 `id`、`title`、`fields`、`effect`、`scope` 为准。`fields` 是允许的参数名列表，不是完整 JSON Schema；复杂输入参考 [业务选择与算例](references/recipes.md)，不确定时先查该领域配置/清单或用平台对话澄清。平台返回的 `path` 是内部实现路径，外部 Agent 仍经统一任务接口调用。

外部能力发现与平台内部对话工具继承同一份 Agent 授权，两者都看不到某能力并不能证明部署缺少该能力或数据源。能力不可见时报告“当前授权不可用”；只有实际执行相应查询并获得空集合，才能报告“该范围查询结果为空”。completed 也可能只是模型已完成权限不足的说明，不能据此判定业务查询成功。

连接返回 `401` 或 `403` 时执行 `node scripts/connection.mjs invalidate --name "$TX_AI_NATIVE_AI_DEFAULT_CONNECTION"`，清除当前 token、保留 URL；停止重试，不自动切换账号或创建凭证。提示用户重新授权，成功后按上述命令保存新 token。持久化不延长 token 有效期，也不能绕过撤销、过期或管理员关闭资格。

## 执行流程

- **复用**：先 `list_results`，检查能力、参数、来源、创建时间是否符合问题；工作空间结果列表只展示该空间的引用。需要全量事实时用 `query_result`，不把任务预览当作完整数据。
- **调用**：参数明确时选 `submit_calculation` / HTTP `type=capability`；跨能力分析或自然语言委托选 `send_message` / HTTP `type=conversation`。已有对话继续携带 `conversationId`；工作空间任务同时携带 `workspaceId`。标识来自实际返回或用户提供。
- **去重**：每个逻辑提交生成 UUID 作为 `requestId`。传输失败、响应丢失时，使用同一个请求体与 requestId 重发。新需求用新 ID；不要通过反复生成 ID 来探测长任务是否成功。
- **等待**：从提交响应顶层 `id` 取得 runId，持续查询 `body.status` 或订阅 SSE。`202`、`queued`、`running`、`cancelling` 都不等于完成。定期反馈进度；预算耗尽时保留 runId 供续查，不宣称任务失败，也不重复提交。取消后等待最终状态。
- **确认**：`waiting_confirmation` 时说明任务和待确认内容，交由网页用户处理。个人 Agent 授权排除管理员能力及 `effect=confirm` 能力；授权现状可能直接令这些能力不可见。外部 Agent 不能调用 confirm、管理授权、保存/删除结果、提交 page-receipts，也不能注入 `approved` / `pageContext`。缺少范围时由用户修改授权，不能换用户身份绕过。
- **核实**：`completed` 后读取 `body.result`、过程事件和持久结果。直接能力任务通常返回 `body.result.resultId`；对话任务可能产生多个结果，从事件和结果列表识别，不能假定统一 resultId 路径。检查实际业务状态、错误、部分结果、来源与附件证据，再判断用户要求是否完成。

## 完成与边界

交付回答包含关键结果、runId/resultId、数据时间/范围、是否复用结果和已取得的附件。科学计算需实际执行输出或证据，不能把平台模型的文字解释当作已执行算子；数据为空或过旧要如实说明。

外部 Agent 可复用页面背后的业务能力，不要求页面保持打开。页面按钮、筛选和表单操作属于已连接网页的 Page AI 会话，由网页执行并提交回执；不能把一次 HTTP 计算描述为已经操作页面。页面紫色动态边框仅表示页面 AI 活动，不是计算成功证据。

语音接口目前按用户要求暂缓，本技能不调用语音或将其作为先决条件。本文对应 2026-09-09 验收的 API；部署可能尚未包含此版本，以实时能力发现与服务响应为准。接口 404 时先核对地址和部署版本，不自动启动或部署服务。
