# 业务选择与算例

以下是能力选择索引和已验证的输入形状，不承诺当前部署或凭证可用全部能力。先调用实时能力发现；遇到私有 ID，使用已授权清单或用户提供的 ID。平台 resultId、业务 resultId、jobId、taskId、NORAD 编号互不替代。

## 按需求选能力

| 需求 | 发现时查找的能力族 | 先读取什么 |
| --- | --- | --- |
| 卫星/轨道资料、关系图 | satellite.*, objects.relationships | search/detail、已有结果 |
| 空间站态势与过境 | station.* | overview、观测点与时间范围 |
| 小行星与离轨 | asteroid.overview, deorbit.* | 检索及目标详情 |
| 星座看板/生命史 | constellation.* | overview/snapshot/history/life_history |
| 态势、碰撞关联、地影、历史 | situation.*, history.* | 星座清单、manifest 中真实 snapshotId |
| 覆盖与星座优化 | coverage.* | constellations/virtuals、方案 revision |
| 遥感覆盖 | remote_sensing.analyze | 区域、传感器与云量条件 |
| 变轨与意图分析 | maneuver.* | global/latest、任务/结果 ID、实际历史数据窗口 |
| 碰撞任务证据与问答 | collision.* | 用户授权 taskId 及事件/日志 |
| 星图定位 | stars.* | config、图片及标定条件 |
| 航天新闻 | news.events | 日期、来源、目标条件 |
| 原生轨道/时间/坐标算子 | txadcl.compute | 问题输入、单位、参考系、输出要求 |

不要机械调用所有能力。多领域分析可发送对话，让平台内部 discover_capabilities/business_call/query_result 等工具编排；这些内部模型工具名不是外部 MCP 工具名。

## TxADCL 实际计算

优先已有明确业务能力；通用算子计算使用 `txadcl.compute`，params 只有 `request`。写清输入、单位、历元/时区、参考系和期望产物。外部调用固定受限算子模式；不能承诺无限制动态编程或任意代码执行。

以下 body 是实际算子验收所用形状：

```json
{
  "type": "capability",
  "requestId": "replace-with-new-uuid",
  "input": {
    "capabilityId": "txadcl.compute",
    "params": {
      "request": "请调用已注册的 time.convert_scale 算子，epoch=2026-09-09T00:00:00Z，source_scale=UTC，target_scale=UTC。读取该算子实际输出中的 mjd 字段，交付系统标准执行证据文件。不要把 MJD 当作时间尺度，不需要构建候选算子。"
    }
  }
}
```

该固定样本应得到 MJD 61292.0。验收实际计算时查结果附件的执行证据（例如 compute 层状态、算子计划、输出），不是仅在回答文字中寻找 61292。其它日期/输入必须重新计算；本样本数值不能套用。附件由返回 artifacts 清单确定，不承诺每次计算都生成 CSV。

## 已验证的简单输入

下面仅列 params，对应能力通过 HTTP 或 MCP 任务封装提交。

- `satellite.search`：`{"q":"25544","page":1,"pageSize":3}`。
- `satellite.detail`：`{"noradId":"25544"}`。
- `station.passes`：需要 station、observer 对象 `{longitudeDeg,latitudeDeg,heightM}`、horizonDays，可选 minElevationDeg/twilightDeg；station 标识从实际 overview/页面配置确认。
- `maneuver.run`：`{"sourceType":"manual-ids","targetNoradIds":["69282"],"timeWindow":{"start":"2026-08-17T21:00:00.004Z","end":"2026-08-24T21:00:00.004Z"}}`。此历史示例要求部署有对应 TLE 历史，实际分析用用户所需窗口。
- `maneuver.deep`：`{"resultId":"actual-business-analysis-result-id","noradId":"69282"}`。resultId 来自机动业务结果内容，不能用包装该内容的平台结果 ID 替代。读取 analysis 中的 modelSource、confidence、证据及报告。
- `collision.chat`：`{"taskId":"actual-authorized-task-id","question":"概述该任务已有证据和缺失信息"}`，这是任务只读问答。

## 覆盖计算与确认

coverage.analyze/cell 的 constellation 可来自实际清单；个人方案可能使用 `virtual:<id>` 或 `custom:<id>`。资源授权也必须匹配相同前缀。输入精度按字段名使用：startTime 为带时区时间，hours 6–24、stepMinutes 15–60、minElevationDeg 0–45。区域四个边界需同时提供、经纬度合法且有正面积。

coverage.optimize_prepare 只准备参数；coverage.optimize 是需网页用户确认的能力，不进入个人 Agent 授权。外部 Agent 可在权限内准备、读取已有优化结果，不能用 approved 或直接业务 HTTP 路由绕过确认。业务 revision 取实际方案返回值，与平台 run.revision 不同。

## 星图与文件

先 `stars.config` 查看 blind/prior、标定与输入要求。先验模式调用 `stars.preview`，可用 `tleOverride` 对象；不要传不受支持的 tleSource/tleLine1/tleLine2 平铺参数，子字段由部署配置与实际业务契约确定。

`stars.solve` 的 params 为 `{"attachmentIndex":0,"request":{...实际标定/模式参数...}}`。图片放 HTTP 提交的 `input.files`，与 params 同层：

```json
{
  "files": [{"name":"sky.png","mimeType":"image/png","data":"BASE64_WITHOUT_DATA_URL_PREFIX"}],
  "capabilityId": "stars.solve",
  "params": {"attachmentIndex":0,"request":{"mode":"blind"}}
}
```

上面是 input 形状，request 仍须按 config 补全必需参数。附件最多 4 个，文件名不含路径，data 为原始 Base64；受整个 JSON 请求和单文件编码大小限制，大图片应先按服务限制处理。任务完成后检查业务定位状态，例如 localization_success，再下载返回清单中的 JSON/CSV/图像，不只看平台 completed。

## 授权范围排查

用户创建个人授权时可选择 capabilityIds、workspaceIds、conversationIds、resourceIds、resultIds 和期限。工作空间内已有对话需要同时授权空间与对话；私有业务任务/方案还需相应 resourceIds；已有平台结果需要 resultIds。普通全局 NORAD 编号不是私有资源 ID。管理员能力不进入个人授权。

新建独立对话与本授权生成的结果通常自动归入该授权；另一张 token 即使同一用户创建，也不自动能读取此 token 的任务和结果。发现列表缺项或收到 403/404 时说明缺失的能力/对象，由用户按需授权。技能本身不会提供或扩大接入范围。

当前授权管理接口支持创建、列出、原地更新与撤销：网页用户通过 `PUT /api/ai/grants/:id`（携带当前 `revision`）可增删该凭证的能力与数据范围，token 保持不变。原地追加范围不影响既有任务；缩小范围会提升授权版本并立即取消该凭证的在途任务。外部 Agent 不能调用授权管理端点，缺少范围时由用户原地追加即可；只有更换新凭证时才需在新授权中选择要续接的 conversationId（如属工作空间，同时选择 workspaceId），且新凭证不能读取旧凭证的任务。
