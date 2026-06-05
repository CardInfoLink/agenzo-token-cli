# merchant-cli 变更说明

> 本次围绕"让 CLI 与架构升级文档（`agenzo/doc/architecture-upgrade/v1`）和 v3 后端
> （`app/agent_pay`）保持一致"做的改动，以及尚待后端配合的待办。
> CLI 定位：**忠实投影后端能力的薄客户端**——凡是"跟着 developer 走、会变"的信息都不写死在 CLI。

---

## 一、已完成

### 批次一：消除信息错配（CLI 侧独立完成，低风险）

| # | 改动 | 文件 | 原因 |
| --- | --- | --- | --- |
| 1 | 命令名 `ride` → `ride-elife` | `index.ts` / `registry.ts` / `ride/*.ts` 帮助文案 / `README.md` / `SKILL.md` / `scripts/schema-drift-check.mjs` | 对齐 schema `cli_noun: ride-elife`，并为"同品类多供应商"（`ride-didi` 等）预留命名空间 |
| 2 | 删除 `billing` 字段 | `registry.ts` / `services/list.ts` / `services/get.ts` | registry 原硬编码 `pay_per_call`，但后端只实现 `monthly_settlement`，会误导 Agent 走死路。计费模式是 developer 属性、应由后端运行时返回，CLI 不该写死 |
| 3 | 标注 registry 静态边界 | `registry.ts` 头注释 / `SKILL.md` | 明确它是"CLI 内置单商户清单，非实时后端发现"，并指明 merchant-discovery 就绪后应改为动态拉取 |
| 4 | 修 services 字段不一致 | `SKILL.md` | 去掉文档里不存在的 `enabled` 字段，改为 registry 真实字段 |
| 5 | 补齐错误码目录 | `core/errors.ts` | 把 schema `error_recovery` 引用的 10 个后端码登记进 `ErrorCodes`（按来源分组），消除孤儿码，符合 `cli-standard §10` |

> 注意：HTTP 路径 `/api/v3/agent-pay/ride/*` **未改**——CLI 命令名与后端接口路径是两回事，动了会调不通。

### 批次二：补齐标准要求的客户端能力

| # | 改动 | 文件 | 说明 |
| --- | --- | --- | --- |
| 6 | `ride-elife get` 加 `--watch` + NDJSON 流式 | `ride/get.ts` / `core/output.ts` | 满足 `cli-standard §6.2` 流式要求 + schema 的 polling 语义。带 `--watch` 时按终态列表轮询（默认 5s 间隔、600s 超时上限），每轮一行 NDJSON；不带则维持单次查询。终态集合对齐 schema `terminal_statuses` |
| 7 | 响应类型按后端实际返回重建 | `types/api.ts` | `BookResponse` / `GetOrderResponse` / `ListOrdersResponse` / `CancelResponse` / `QuoteResponse` 各自独立建模（原先错误地把三者合并为同一 `Order`）。删除从未被引用的请求体死代码类型 |

验证：`npm run build` + `npx tsc --noEmit` + `npm run lint` 均通过；`--watch` 经 mock 后端实测逐行 NDJSON 输出并在终态停止；单次查询向后兼容。

---

## 二、待办（批次三：需后端先就绪，单独立项）

| # | 待办 | 依赖 | 说明 |
| --- | --- | --- | --- |
| A | schema 字段对齐后端实际返回 | 测试后端 + v3 key | `list-orders` / `get` 的 schema 仍描述了丰富的 MySQL 订单形态，后端实际返回 MongoDB `ap_ride_orders` 精简字段。用 `scripts/schema-drift-check.mjs` 验证后修订 `ride-elife.json` 与 CLI 内 schema |
| B | `services` 改连 merchant-discovery | 后端 `merchant-discovery` 接口 | `services list/get` 由静态 registry 改为调 `GET /api/merchant/v1/services`，billing_mode 等随之由后端动态返回。CLI 只做展示 |
| C | pay_per_call 接入 | payment-cli + charge 能力 | book 的 `--payment-order-id` 参数已就位，后端把 `PayPerCallNotAvailableError` 换成"反查 payment_order 是否 PAID"即可。CLI 侧改动极小 |
| D | 四 CLI 共享 key store | `agenzo-cli` monorepo + `cli-core` | 让 API Key 落盘到共享目录 `~/.agenzo/api-keys/`，token/merchant/payment 三 CLI 自动读取，免去每次手传 `--api-key`。应在 `cli-core` 共享包里统一实现，不在 merchant-cli 单独打补丁（否则将来合并 monorepo 时重复） |

---

## 三、给后端团队的对齐点

1. **计费模式以后端为准**：CLI 已不再声明 billing_mode。月结由 `book` 响应 `payment_status=ON_ACCOUNT` 体现；pay_per_call 落地后用 `payment_status=PAID` + `payment_order_id`。
2. **错误码契约**：CLI 已登记 `BILLING_MODE_MISMATCH` / `ACCOUNT_*` / `PAYMENT_ORDER_*` / `PARAM_IDEMPOTENCY_KEY_CONFLICT` / `INTERNAL_ERROR` 等后端码，后端新增/改名错误码需同步通知，避免 CLI 侧出现孤儿码。
3. **多供应商路由**：当前 `ride-elife` 各 verb 与 HTTP 路径 `/ride/*` 写死给 elife。接第二家打车供应商时，后端路径需能区分 provider（body 带 `provider` 或路径区分），否则 CLI 命名虽已就绪仍打到 elife。
4. **schema drift 检查**：`scripts/schema-drift-check.mjs` 需连测试后端 + v3 monthly_settlement key 跑，用于发现 CLI schema 与后端响应字段的漂移。

---

## 四、批次三 CLI 字段对齐（已完成）

后端 spec `v3-ride-fulfillment-parity` 已在 v3（`app/agent_pay/`）实现实时单/预约单区分、finalFare 多退少补、取消退款结算等能力并新增响应字段。CLI 侧已同步对齐：

### 4.1 `src/types/api.ts`（已改）

- `BookResponse` 增加：`is_scheduled: boolean`、`order_type: string`（`"realtime"` / `"airport"`）
- `RideOrderListItem` 增加：`is_scheduled: boolean`、`scheduled_at: string`、`final_amount: number | null`、`final_settlement_status: string`、`cancellation_fee: number | null`
- `GetOrderResponse` 增加：`is_scheduled?: boolean`、`final_amount?: number | null`、`final_settlement_status?: string`
- `CancelResponse` 增加：`refund_amount?: number`

### 4.2 verb schema 描述（已改 `src/ride/*.ts`）

- `book.ts` 的 `bookSchema.response` 增加 `is_scheduled` / `order_type`
- `get.ts` 的 `rideGetSchema.response` 增加 `final_amount` / `final_settlement_status`
- `list-orders.ts` 的 `listOrdersSchema.response` 增加上述新字段

### 4.3 文档（已改 SKILL.md）

- book / list-orders / cancel 段补充新字段说明（is_scheduled、final_amount、final_settlement_status、refund_amount）+ 实时单/预约单结算差异

### 4.4 字段语义参考

- `final_settlement_status`: `pending`（待结算）/ `settled`（已结算）/ `no_adjustment`（无差额）/ `settlement_pending`（余额不足待人工）/ `not_applicable`（预约单不适用）
- `final_amount`: 实时单行程结束后由后端定时对账写入；结算前等于 `price_amount`
- 金额仍为 DECIMAL 货币单位（与现有契约一致）

### 4.5 验证（已完成）

- `npm run build` + `npx tsc --noEmit` + `npm run lint` 全过
- `ride-elife book --help --format json` / `list-orders --help --format json` 确认新字段出现在 schema
- 连本地后端实跑 quote→book→get(--watch)→cancel→list-orders 全流程，CLI 输出字段与后端一致
- `scripts/schema-drift-check.mjs` 留待连测试后端 + v3 key 时跑（需 live 后端）

---

## 五、v0.2.0 新增改动

### 5.1 服务端权威定价 + 前置校验

后端 `/book` 现在强制校验客户端传入的 `price_amount` 和 `vehicle_class`：

- **PRICE_MISMATCH (1811)**：传入金额与 quote 报价不一致时拒绝
- **VEHICLE_CLASS_MISMATCH (1812)**：传入车型与 quote 车型不一致时拒绝
- 即使绕过前置校验（Redis 过期），后端仍用 elife 响应里的权威价格落库/扣款（P0 兜底）

### 5.2 字段名对齐生产

- `GetOrderResponse` 的 `from`/`to` → `from_location`/`to_location`（匹配生产 elife 响应）
- 新增 `pickup_time` 字段

### 5.3 quote 参数放宽

- `--passenger-name` 和 `--passenger-phone` 在 quote 时**不再必填**（elife 报价不需要乘客信息）
- book 时仍为必填

### 5.4 预约单 pickup-time 修复

- CLI book 命令现在正确将数字字符串的 `--pickup-time` 转为 int 发给后端（之前字符串导致预约单报错）

### 5.5 错误详情透传

- elife 返回的具体错误信息（如 "passenger.email: This field is required"）现在直接透传给 CLI 端
- 不再显示无用的通用 "booking could not be completed" 消息
