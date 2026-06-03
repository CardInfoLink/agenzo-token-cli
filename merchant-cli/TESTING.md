# agenzo-merchant-cli 完整测试清单（v3）

手动测试用例。merchant-cli 现对接 v3 agent_pay（`/api/v3/agent-pay/ride/*`），
用 v3 MongoDB API Key 鉴权，book 走 monthly_settlement 月结账户扣款。

按 A→B→C 顺序测：A 无副作用随便跑，B 只读安全，C 会真实下单 + 扣月结余额（测试环境）。

## 前置准备

```bash
# 1. 安装为全局命令（在 merchant-cli 目录跑一次）
cd /Users/administrator/PycharmProjects/agenzo-token-cli/merchant-cli
npm install && npm run build && npm link
agenzo-merchant-cli --version          # 预期 0.1.0

# 2. host 指向本地后端
agenzo-merchant-cli config set-host http://localhost:8000

# 3. 测试 API Key（v3 monthly_settlement developer，余额 500 USD）
KEY=sk_prod_bb0a9233cc43874552f27d4371a369076c0e125a1474f785f7bd0d1e0bd66276
```

前置依赖（已就绪）：
- agenzo 后端运行在 `http://localhost:8000`（含 v3 ride 模块）
- 上面的 KEY 是 v3 MongoDB 里的真实 key，关联一个 monthly_settlement developer + 充值 500 USD 的月结账户
- ride 后端对接 elife sandbox（quote/book 返回真实报价/订单）

> 说明：merchant-cli 不再用 `--payment-method-id`。monthly_settlement 模式下 book
> 不传任何支付凭证，后端自动从月结账户扣余额。

---

## A 档：离线测试（无副作用，随便跑）

### A1. 版本与帮助
| # | 命令 | 预期 |
|---|------|------|
| A1.1 | `agenzo-merchant-cli --version` | `0.1.0` |
| A1.2 | `agenzo-merchant-cli --help` | 列出 config / ride / services |
| A1.3 | `agenzo-merchant-cli ride --help` | 列出 quote/book/get/cancel/list-orders |
| A1.4 | `agenzo-merchant-cli services --help` | 列出 list/get |
| A1.5 | `agenzo-merchant-cli config --help` | 列出 set-host/reset-host/show |

### A2. config 配置
| # | 命令 | 预期 |
|---|------|------|
| A2.1 | `agenzo-merchant-cli config show` | 输出当前 host |
| A2.2 | `agenzo-merchant-cli config set-host http://test.example.com` | 设置成功 |
| A2.3 | `agenzo-merchant-cli config show` | host 变更 |
| A2.4 | `agenzo-merchant-cli config reset-host` | 重置为默认 |
| A2.5 | `agenzo-merchant-cli config set-host http://localhost:8000` | **测完务必设回本地** |

### A3. services 能力发现（离线，内置静态）
| # | 命令 | 预期 |
|---|------|------|
| A3.1 | `agenzo-merchant-cli services list` | 输出 ride 一条，含 billing_mode |
| A3.2 | `agenzo-merchant-cli services get ride` | ride 详情：verbs / workflow |
| A3.3 | `agenzo-merchant-cli services get nope` | 报 SERVICE_NOT_FOUND，退出码非 0 |
| A3.4 | `agenzo-merchant-cli services list --format table` | 表格输出 |

### A4. verb schema 自描述
| # | 命令 | 预期 |
|---|------|------|
| A4.1 | `agenzo-merchant-cli ride quote --help --format json` | quote 参数/响应 schema |
| A4.2 | `agenzo-merchant-cli ride book --help --format json` | book schema，含 payment-order-id 条件说明、idempotency-key |
| A4.3 | `agenzo-merchant-cli ride get --help --format json` | get schema |
| A4.4 | `agenzo-merchant-cli ride cancel --help --format json` | cancel schema |
| A4.5 | `agenzo-merchant-cli ride list-orders --help --format json` | list-orders schema |

### A5. spinner 加载反馈（流分离）
| # | 命令 / 操作 | 预期 |
|---|------------|------|
| A5.1 | 交互终端直接跑 B1 的 quote | 请求时有 `⠋ Fetching quotes...` 转圈，出结果后消失 |
| A5.2 | `... ride quote ... 2>/dev/null \| head -1` | stdout 第一行是 `{`（spinner 不污染 stdout） |
| A5.3 | `... ride quote ... 1>/dev/null 2>e.txt; wc -c < e.txt` | 非 TTY 时 stderr 0 字节 |
| A5.4 | `agenzo-merchant-cli services list`（本地命令） | 秒回，无转圈 |

---

## B 档：只读联调（需要后端，安全）

### B1. ride quote — 查报价
```bash
agenzo-merchant-cli --api-key $KEY ride quote \
  --pickup-lat 37.7937 --pickup-lng -122.3956 --pickup-name "1 Market St" \
  --dropoff-lat 37.6213 --dropoff-lng -122.3790 --dropoff-name "SFO Airport" \
  --pickup-time now --passenger-name "Test User" --passenger-phone +14155551234
```
预期：返回 `vehicle_classes[]` 多车型 + 价格 + quote_id。**记下第一个车型的
quote_id / vehicle_class / price.amount，C 档要用。**

| # | 变体 | 预期 |
|---|------|------|
| B1.1 | 上面的命令 | 多车型报价 |
| B1.2 | 加 `--format table` | 表格输出 |
| B1.3 | 加 `--passenger-count 2 --luggage-count 3` | 正常返回 |

### B2. ride list-orders
| # | 命令 | 预期 |
|---|------|------|
| B2.1 | `agenzo-merchant-cli --api-key $KEY ride list-orders` | 返回 orders/total/page/page_size（首次可能空） |
| B2.2 | `... ride list-orders --page 1 --page-size 5` | 分页正常 |
| B2.3 | `... ride list-orders --format table` | orders 渲染成子表格 |

### B3. 鉴权错误
| # | 命令 | 预期 |
|---|------|------|
| B3.1 | `agenzo-merchant-cli --api-key sk_wrong ride list-orders` | 报 1002 认证失败，退出码非 0 |
| B3.2 | `agenzo-merchant-cli ride list-orders`（不带 key） | 交互式提示输入 API key |

---

## C 档：写操作（⚠️ 真实下单 + 扣月结余额，测试环境）

> book 会真实向 elife sandbox 下单，并从月结账户扣对应金额（decimal 转分）。
> 下单后尽快 cancel。建议连续做 C1→C4。

### C1. quote 拿新鲜 quote_id
```bash
agenzo-merchant-cli --api-key $KEY ride quote \
  --pickup-lat 37.7937 --pickup-lng -122.3956 --pickup-name "1 Market St" \
  --dropoff-lat 37.6213 --dropoff-lng -122.3790 --dropoff-name "SFO Airport" \
  --pickup-time now --passenger-name "Test User" --passenger-phone +14155551234
```
记下 quote_id / vehicle_class / price.amount。

### C2. ride book — 下单（月结，替换 <...>）
```bash
agenzo-merchant-cli --api-key $KEY ride book \
  --quote-id "<quote_id>" \
  --vehicle-class "<vehicle_class>" \
  --price-amount <amount> \
  --passenger-name "Test User" --passenger-phone +14155551234 \
  --pickup-lat 37.7937 --pickup-lng -122.3956 --pickup-name "1 Market St" \
  --dropoff-lat 37.6213 --dropoff-lng -122.3790 --dropoff-name "SFO Airport" \
  --pickup-time now \
  --idempotency-key test-$(date +%s) \
  --yes
```
预期：返回 `ride_id`、`order_id`、`payment_status: ON_ACCOUNT`、`billing_entry_id`。
**记下 ride_id。** 注意：不传 payment-method-id / payment-order-id（月结模式）。

| 变体 | 说明 |
|------|------|
| 同 `--idempotency-key` 重复跑 | 幂等：返回同一订单，不重复扣款 |
| 月结 developer 却传 `--payment-order-id xxx` | 报 BILLING_MODE_MISMATCH |

### C3. ride get — 查状态（替换 <ride_id>）
```bash
agenzo-merchant-cli --api-key $KEY ride get --order-id "<ride_id>"
```
预期：返回 status（INIT/Pending/Accepted...）、司机/车辆信息（派单后）。
> 注：elife sandbox 刚下单的订单查 status 偶尔返回 BOOKING_FAILED（上游异步处理中），
> 属 elife 行为，非 CLI 问题。

### C4. ride cancel — 取消（替换 <ride_id>）
```bash
agenzo-merchant-cli --api-key $KEY ride cancel \
  --order-id "<ride_id>" --idempotency-key cancel-$(date +%s) --yes
```
预期：返回 `ride_stat: Cancelled`、`cancellation{cancellation_fee, reversal_amount, currency}`。

### C5. 确认订单进列表
```bash
agenzo-merchant-cli --api-key $KEY ride list-orders --format table
```
预期：看到刚才的订单。

---

## 测试记录表

| 档 | 用例 | 通过? | 备注 |
|----|------|-------|------|
| A1 | 版本/帮助 ☐ | | |
| A2 | config ☐ | | |
| A3 | services ☐ | | |
| A4 | schema 自描述 ☐ | | |
| A5 | spinner ☐ | | |
| B1 | quote ☐ | | |
| B2 | list-orders ☐ | | |
| B3 | 鉴权错误 ☐ | | |
| C2 | book 下单 ☐ | | |
| C3 | get 状态 ☐ | | |
| C4 | cancel ☐ | | |
| C5 | 列表确认 ☐ | | |

---

## 出问题怎么办

- 区分是 CLI 还是后端问题：用 curl 直接打后端对应端点，curl 也失败 → 后端问题。
- v3 后端端点对照：
  - quote → `POST /api/v3/agent-pay/ride/quote`
  - book → `POST /api/v3/agent-pay/ride/book`（Idempotency-Key 头）
  - get → `GET /api/v3/agent-pay/ride/{order_id}/status`
  - cancel → `POST /api/v3/agent-pay/ride/{order_id}/cancel`（Idempotency-Key 头）
  - list-orders → `GET /api/v3/agent-pay/ride/orders`
- 鉴权头：`X-Api-Key: <key>`
- host 配错用 `config show` 检查，`config set-host http://localhost:8000` 改回。
- 验证月结扣款（需要 docker mongosh）：book 后查账户余额应减少对应金额。
```bash
# developer_id 见前置准备里 seed 输出的 DEV_ID
docker exec agenzo-mongodb mongosh --quiet -u <user> -p <pass> --authenticationDatabase admin <db> \
  --eval 'db.ap_settlement_accounts.findOne({developer_id:"<DEV_ID>"}).balance'
```
