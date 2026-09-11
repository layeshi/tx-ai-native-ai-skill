# MCP 调用

## 连接

端点为 `<平台根地址>/api/ai/mcp`，传输为 Stateless Streamable HTTP。调用前加载 `~/.config/tx-ai-native-ai/connection.env`，每次请求带 `Authorization: Bearer <个人 Agent token>`。客户端配置字段因客户端而异；将实际凭证放在客户端安全设置，不复制到技能或示例配置。当前为个人 Bearer 接入，不提供 OAuth 或 refresh token 流程；token 过期或撤销后必须重新完成网页授权。

当前协议为 `2025-03-26`：客户端初始化、发送 initialized 通知，再 tools/list 获取真实工具 schema。HTTP POST 返回 JSON；通知返回 202。该 MCP 地址的 GET 返回 405；需要任务事件流时使用 HTTP `/api/ai/runs/:id/events`，不是 MCP GET。

已有原生 MCP 工具时直接调用。只有 HTTP 客户端时，可发送标准 JSON-RPC：

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"analysis-agent","version":"1.0"}}}
```

```json
{"jsonrpc":"2.0","method":"notifications/initialized"}
```

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
```

调用示例（先确认本授权可见 satellite.search）：

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "submit_calculation",
    "arguments": {
      "requestId": "replace-with-new-uuid",
      "capabilityId": "satellite.search",
      "params": {"q": "25544", "page": 1, "pageSize": 3}
    }
  }
}
```

## 八项工具

以 tools/list 的 inputSchema 为准。下表表示当前契约；`?` 表示可选。

| 工具 | arguments | 完成条件 |
| --- | --- | --- |
| list_capabilities | `{}` | 获得此授权可用的能力数组 |
| create_conversation | title?, workspaceId? | 获得 conversation.id |
| send_message | prompt, requestId, conversationId?, workspaceId?, metadata? | 获得 run.id 后续查终态 |
| submit_calculation | capabilityId, params, requestId, conversationId?, workspaceId?, forceRecompute? | 获得 run.id 后续查终态 |
| get_run | runId | 检查 body.status/result/events |
| cancel_run | runId | 仅请求取消，再 get_run 等待终态 |
| list_results | conversationId?, workspaceId? | 获得授权结果 id、能力、参数、时间 |
| query_result | resultId, path?, offset?, limit?, filters?, sortBy?, descending?, aggregate?, conversationId?, workspaceId? | 获得所需范围的真实结果事实 |

metadata 当前允许 workspaceId、assetIds、builtinSourceIds；上下文与授权必须一致。查询参数语义见 [HTTP 结果契约](http.md#结果分页和附件)。MCP send_message 的参数在 arguments 顶层，HTTP 则包装在 input；不要混用封装。

## 解包和继续执行

成功工具结果为 `result.content[]` 中的 text，text 内是 JSON 字符串。先检查 JSON-RPC `error`，再检查 `result.isError`，再解析 text。HTTP 200 仍可能携带 `isError:true`，不能当作成功。

直接 submit_calculation 解包后顶层 `id` 是 runId，完成后 `body.result.resultId` 通常是持久结果 ID。通过 get_run 查询，随后 query_result 取事实。对话可多次调用业务工具，结果引用可能出现在事件中；不假定所有对话都有单个 resultId。

初始化、工具发现、JSON-RPC 调用 ID 与任务 requestId 是不同层次。重发同一业务提交时保持 requestId 和 arguments；JSON-RPC id 只关联当前传输响应。

MCP 不暴露附件下载、结果引用或重试专门工具。需要这些操作时使用 [HTTP 接口](http.md)，沿用同一平台和凭证。星图图片提交需要 HTTP input.files，当前 MCP submit_calculation 不提供 files 字段。
