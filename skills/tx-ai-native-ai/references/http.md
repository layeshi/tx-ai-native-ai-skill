# HTTP 调用与结果

## 认证与发现

以下示例要求已有 `curl`、`jq`，且安全环境已设置平台根地址及个人 Agent token。不要把模型网关地址配置成平台根地址。每个请求携带 `Authorization: Bearer`，JSON 请求另带 `Content-Type: application/json`。

```bash
: "${PLATFORM_BASE_URL:?需要平台根地址}"
: "${PLATFORM_AGENT_TOKEN:?需要个人 Agent 凭证}"
curl --fail-with-body --max-time 30 -sS \
  -H "Authorization: Bearer $PLATFORM_AGENT_TOKEN" \
  "$PLATFORM_BASE_URL/api/ai/capabilities"
```

返回能力数组，不包装在 `data` 内。`GET /api/ai/config` 返回 `configured`、`model` 等；配置标志不证明上游当前健康，最终以任务结果为准。

## 创建对话和提交任务

创建独立对话：`POST /api/ai/conversations`，body 为 `{"title":"轨道分析"}`。创建工作空间对话时加入已授权 `workspaceId`。响应顶层 `id` 是 conversationId；Agent 创建的新对话自动加入此凭证的对话范围。也可直接提交 conversation 任务，平台自动创建并记录在 `body.actor.conversationId`。

对话任务 body：

```json
{
  "type": "conversation",
  "requestId": "replace-with-new-uuid",
  "conversationId": "actual-conversation-id",
  "input": {
    "prompt": "检索国际空间站，读取可用轨道资料并说明数据时间。需要计算时调用系统已有能力。"
  }
}
```

工作空间任务在顶层加入 `workspaceId`，与 conversationId 的实际归属一致。可在 `input.metadata` 指定 `workspaceId`、`assetIds`、`builtinSourceIds`；metadata 不能扩大授权，其 workspaceId 必须与顶层一致。

直接能力提交的完整示例（先确认发现结果中存在 `satellite.search`）：

```bash
platform_request_id=$(python3 -c 'import uuid; print(uuid.uuid4())')
platform_request_body=$(jq -n --arg requestId "$platform_request_id" \
  '{type:"capability",requestId:$requestId,input:{capabilityId:"satellite.search",params:{q:"25544",page:1,pageSize:3}}}')
platform_run=$(curl --fail-with-body --max-time 30 -sS \
  -H "Authorization: Bearer $PLATFORM_AGENT_TOKEN" \
  -H 'Content-Type: application/json' \
  --data-binary "$platform_request_body" "$PLATFORM_BASE_URL/api/ai/runs")
platform_run_id=$(printf '%s' "$platform_run" | jq -er '.id')
printf '%s\n' "$platform_run_id"
```

超时后保留 `platform_request_body` 重发，不重新生成 requestId。requestId 长度 8–128，只允许字母数字下划线、点、横线；UUID 符合约束。`input.forceRecompute=true` 跳过平台结果复用；业务数据仍可能来自底层快照，因此不能理解为强制刷新全部数据源。

## 任务查询、事件、取消和重试

```bash
curl --fail-with-body --max-time 30 -sS \
  -H "Authorization: Bearer $PLATFORM_AGENT_TOKEN" \
  "$PLATFORM_BASE_URL/api/ai/runs/$platform_run_id"
```

任务是记录对象：顶层 `id`、`revision`、`createdAt`，主体 `body.status`、`body.actor`、`body.events`、`body.result` 等。直接能力完成结果一般包含 `resultId`、`reused`、`source`、预览 `data`；具体字段依调用结果而定。

建议每 2–5 秒查询，长任务可降低频率。终态为 `completed`、`failed`、`cancelled`、`interrupted`；`waiting_confirmation` 暂停等待用户。失败原因从实际任务和事件读取。

| 操作 | 请求 | 说明 |
| --- | --- | --- |
| 列出任务 | `GET /api/ai/runs` | 可用 `conversationId`、`summary=true`、`before`；Agent 只见本授权发起的任务 |
| SSE | `GET /api/ai/runs/:id/events` | `curl -N`，携带 Bearer；`Last-Event-ID` 或 `after` 续传 |
| 取消 | `POST /api/ai/runs/:id/cancel`，`{}` | 202 只是取消请求，继续查最终状态 |
| 重试 | `POST /api/ai/runs/:id/retry`，`{}` | 仅 failed/cancelled/interrupted，响应是新任务，记录新 id |

SSE 普通 `data` 事件为执行过程；具名 `event: status` 包含 status/revision。连接关闭也可能是授权失效，不能单凭断开推断成功。重新连线前查任务状态；不要无限重试 401/403。

## 结果、分页和附件

| 操作 | 请求 | 返回或约束 |
| --- | --- | --- |
| 结果列表 | `GET /api/ai/results` | 数组；记录元数据和 body，省略大字段 data；可加 workspaceId/conversationId |
| 读取结果 | `GET /api/ai/results/:id?path=&offset=0&limit=50` | resultId、data、source、createdAt、artifacts，依类型有 keys/total 等 |
| 筛选/统计 | `POST /api/ai/results/:id/query` | 下述查询 body |
| 完整 JSON | `GET /api/ai/results/:id/download` | result.body，包括完整 data；也需 Bearer |
| 附件下载 | 使用返回的 `artifacts[].url` | 平台相对路径；同平台根地址、同 Bearer，不猜文件 key |
| 引用到空间 | `POST /api/ai/results/:id/reference` | `{"workspaceId":"actual-id"}`；需结果和空间均获授权 |

查询的 `path` 从业务结果的 `data` 根开始，不加 `body.data`；根路径为空字符串，嵌套使用 `items`、`result.summary` 等实际字段名。先看根的 keys，再逐层选取。不是 JSONPath，不支持 `$`、通配符或表达式。分页 limit 1–200，默认 50；即使根 data 预览截断，也可沿字段路径读取或下载完整 JSON。

下面是数组查询模板，字段名必须替换为实际返回结构，不能直接假定每种结果均有 items/score：

```json
{
  "path": "items",
  "offset": 0,
  "limit": 50,
  "filters": [{"field": "score", "op": "gte", "value": 0.5}],
  "sortBy": "score",
  "descending": true,
  "aggregate": {"operation": "mean", "field": "score"}
}
```

过滤最多 8 条，支持 eq/ne/gt/gte/lt/lte/contains；数值比较需要数值类型。聚合支持 count/min/max/sum/mean，除 count 外需数值 field。聚合基于完整匹配集合，不是当前页；缺失值不当零。查看 aggregate 的有效样本/缺失信息，结合原始结果解释。

Agent 可读本授权生成或用户显式授权的结果；只拥有 workspaceId 不等于拥有其中全部结果。带 workspaceId 的读取还要求结果已引用到该空间。独立临时结果通常 30 天过期，绑定空间/对话的结果与手工保存的结果持久保留；以实际 expiresAt 为准。引用关联原结果，源结果删除后引用会失效。

下载 artifacts 时校验返回 URL 是本平台 `/api/ai/results/…/files/…` 路径，再拼接根地址，防止把 Bearer 发到其他主机。使用安全本地文件名；不自动执行下载文件。sizeBytes 存在时比较字节数，不存在时验证文件非空及内容类型。

## 错误处理

| 状态 | 处理 |
| --- | --- |
| 400 | 核对 body、精确参数名、标识、单位和字段路径，修正后作为新逻辑请求提交 |
| 401 | 凭证缺失、过期或撤销；停止重试并让用户恢复有效接入 |
| 403 | 能力或对象未授权、仅用户接口；由用户调整范围，保持现有身份 |
| 404 | 资源不存在、不可见或已删除；也可能部署不含此路由，核对上下文 |
| 409 | 并发版本/状态冲突或附件校验失败；重新读取当前状态，附件损坏不当作可用文件 |
| 413 | 缩小输入/查询集合；结果过大时选择更小字段路径 |
| 429 / 5xx | 记录任务与错误；短暂故障可有界退避重试读取，提交重试保留 requestId |

已授权外部调用不使用 `/api/compute-process/*`、原始业务路由或 grant 管理端点。这些兼容/用户入口不能代替统一任务 API。
