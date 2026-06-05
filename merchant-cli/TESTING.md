# agenzo-merchant-cli 完整测试清单（v3）

手动测试用例。merchant-cli 对接 v3 agent_pay（`/api/v3/agent-pay/ride/*`），
用 v3 MongoDB API Key 鉴权，book 走 monthly_settlement 月结账户扣款。

命令组为 **`ride-elife`**（按 provider 命名，为多打车供应商预留）。

按 A→B→C 顺序测：A 无副作用随便跑，B 只读安全，C 会真实下单 + 扣月结余额（测试环境）。

## 前置准备

```bash
# 1. 安装为全局命令（在 merchant-cli 目录跑一次）
cd /Users/administrator/PycharmProjects/agenzo-token-cli/merchant-cli
npm install && npm run build && npm link
agenzo-merchant-cli --version          # 输出与 package.json version 一致

# 2. host 指向本地后端
agenzo-merchant-cli config set-host http://localhost:8000

# 3. 造测试 API Key（在 agenzo 项目里跑，后端 + MongoDB 要开着）
cd /Users/administrator/PycharmProjects/agenzo
.venv/bin/python -m scripts.seed_v3_ride_test
#   输出 API_KEY=sk_prod_xxx 和 DEV_ID=dev_xxx，复制下来：
KEY=sk_prod_xxx
DEV_ID=dev_xxx
```

前置依赖（已就绪）：
- agenzo 后端运行在 `http://localhost:8000`（含 v3 ride 模块）
- seed 脚本生成的 KEY 关联一个 monthly_settlement developer + 充值 500 USD（balance=50000 分）的月结账户
- ride 后端对接 elife sandbox（quote/book 返回真实报价/订单），坐标用**新加坡**（Changi/Marina），SFO 等其它地区 sandbox 可能返回 VEHICLE_UNAVAILABLE
- 测 `--watch` 流式状态推进需后端 `MOCK_STATUS_UPDATE=true`（sandbox 无真实司机，靠 mock 推进状态）

> 说明：merchant-cli 不用 `--payment-method-id`。monthly_settlement 模式下 book
> 不传任何支付凭证，后端自动从月结账户扣余额。

---

## A 档：离线测试（无副作用，随便跑）

### A1. 版本与帮助
| # | 命令 | 预期 |
|---|------|------|
| A1.1 | `agenzo-merchant-cli --version` | 输出版本号（与 package.json 一致） |
| A1.2 | `agenzo-merchant-cli --help` | 列出 config / ride-elife / services |
| A1.3 | `agenzo-merchant-cli ride-elife --help` | 列出 quote/book/get/cancel/list-orders |
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

### A3. services 能力发现（离线，内置静态 registry）
| # | 命令 | 预期 |
|---|------|------|
| A3.1 | `agenzo-merchant-cli services list` | 输出 ride-elife 一条，含 service_id/name/provider/cli_noun/version/verbs（**不含 billing_mode**，计费模式由后端决定） |
| A3.2 | `agenzo-merchant-cli services get ride-elife` | ride-elife 详情：verbs / verb_descriptions / workflow / discovery |
| A3.3 | `agenzo-merchant-cli services get nope` | 报 SERVICE_NOT_FOUND，退出码非 0 |
| A3.4 | `agenzo-merchant-cli services list --format table` | 表格输出 |

### A4. verb schema 自描述
| # | 命令 | 预期 |
|---|------|------|
| A4.1 | `agenzo-merchant-cli ride-elife quote --help --format json` | quote 参数/响应 schema |
| A4.2 | `agenzo-merchant-cli ride-elife book --help --format json` | book schema；response 含 `is_scheduled` / `order_type` / `billing_entry_id`；params 含 idempotency-key |
| A4.3 | `agenzo-merchant-cli ride-elife get --help --format json` | get schema；params 含 `watch` / `watch-interval` / `watch-timeout`；response 含 `final_amount` / `final_settlement_status` |
| A4.4 | `agenzo-merchant-cli ride-elife cancel --help --format json` | cancel schema；response 含 `refund_amount` |
| A4.5 | `agenzo-merchant-cli ride-elife list-orders --help --format json` | list-orders schema；response 含 `is_scheduled` / `scheduled_at` / `final_amount` / `final_settlement_status` / `cancellation_fee` |

### A5. spinner 加载反馈（流分离）
| # | 命令 / 操作 | 预期 |
|---|------------|------|
| A5.1 | 交互终端直接跑 B1 的 quote | 请求时有 `⠋ Fetching quotes...` 转圈，出结果后消失 |
| A5.2 | `... ride-elife quote ... 2>/dev/null \| head -1` | stdout 第一行是 `{`（spinner 不污染 stdout） |
| A5.3 | `... ride-elife quote ... 1>/dev/null 2>e.txt; wc -c < e.txt` | 非 TTY 时 stderr 0 字节 |
| A5.4 | `agenzo-merchant-cli services list`（本地命令） | 秒回，无转圈 |

---

## B 档：只读联调（需要后端，安全）

### B1. ride-elife quote — 查报价（新加坡坐标）
```bash
agenzo-merchant-cli --api-key $KEY ride-elife quote \
  --pickup-lat 1.3644 --pickup-lng 103.9915 --pickup-name "Changi Airport" \
  --dropoff-lat 1.2834 --dropoff-lng 103.8607 --dropoff-name "Marina Bay" \
  --pickup-time now --passenger-name "Test User" --passenger-phone +6591234567
```
预期：返回 `vehicle_classes[]` 多车型 + 价格 + quote_id。**记下第一个车型的
quote_id / vehicle_class / price.amount，C 档要用。**

| # | 变体 | 预期 |
|---|------|------|
| B1.1 | 上面的命令 | 多车型报价 |
| B1.2 | 上面命令末尾加 `--format table` | 表格输出 |
| B1.3 | 上面命令末尾加 `--passenger-count 2 --luggage-count 3` | 正常返回 |

### B2. ride-elife list-orders

| # | 命令 | 预期 |
|---|------|------|
| B2.1 | `agenzo-merchant-cli --api-key $KEY ride-elife list-orders` | 返回 orders/total/page/page_size（首次可能空） |
| B2.2 | `agenzo-merchant-cli --api-key $KEY ride-elife list-orders --page 1 --page-size 5` | 分页正常 |
| B2.3 | `agenzo-merchant-cli --api-key $KEY ride-elife list-orders --format table` | orders 渲染成子表格 |

### B3. 鉴权错误

| # | 命令 | 预期 |
|---|------|------|
| B3.1 | `agenzo-merchant-cli --api-key sk_wrong ride-elife list-orders` | 报 1002 认证失败，退出码非 0 |
| B3.2 | `agenzo-merchant-cli ride-elife list-orders`（不带 --api-key） | 交互式提示输入 API key |

### B4. org / developer 归属隔离
> 再跑一次 seed 脚本造**第二个** key（KEY2），用它访问第一个账号的订单。
```bash
cd /Users/administrator/PycharmProjects/agenzo && .venv/bin/python -m scripts.seed_v3_ride_test   # 得到 KEY2
KEY2=sk_prod_yyy
```
| # | 命令 | 预期 |
|---|------|------|
| B4.1 | `agenzo-merchant-cli --api-key $KEY2 ride-elife get --order-id <KEY的某ride_id>` | 报 1805 RIDE_NOT_FOUND（不泄露他人订单） |
| B4.2 | `agenzo-merchant-cli --api-key $KEY2 ride-elife list-orders` | 只看到自己的订单（total=0 或仅自己的） |

---

## C 档：写操作（⚠️ 真实下单 + 扣月结余额，测试环境）

> book 会真实向 elife sandbox 下单，并从月结账户扣对应金额（decimal 转分）。
> 下单后尽快 cancel。建议连续做 C1→C5。坐标用新加坡。

### C1. quote 拿新鲜 quote_id
```bash
agenzo-merchant-cli --api-key $KEY ride-elife quote \
  --pickup-lat 1.3644 --pickup-lng 103.9915 --pickup-name "Changi Airport" \
  --dropoff-lat 1.2834 --dropoff-lng 103.8607 --dropoff-name "Marina Bay" \
  --pickup-time now --passenger-name "Test User" --passenger-phone +6591234567
```
记下 quote_id / vehicle_class / price.amount。

### C2. ride-elife book — 下单（月结，替换 <...>）
```bash
agenzo-merchant-cli --api-key $KEY --yes ride-elife book \
  --quote-id "<quote_id>" \
  --vehicle-class "<vehicle_class>" \
  --price-amount <amount> --price-currency USD \
  --passenger-name "Test User" --passenger-phone +6591234567 \
  --pickup-lat 1.3644 --pickup-lng 103.9915 --pickup-name "Changi Airport" \
  --dropoff-lat 1.2834 --dropoff-lng 103.8607 --dropoff-name "Marina Bay" \
  --pickup-time now \
  --idempotency-key test-$(date +%s)
```
预期：返回 `ride_id`、`order_id`、`status: INIT`、`is_scheduled: false`、
`order_type: realtime`、`payment_status: ON_ACCOUNT`、`billing_entry_id`。
**记下 ride_id。** 不传 payment-method-id / payment-order-id（月结模式）。

| 变体 | 说明 |
|------|------|
| 同 `--idempotency-key` 重复跑 | 幂等：返回同一订单，不重复扣款 |
| 月结 developer 却传 `--payment-order-id xxx` | 报 BILLING_MODE_MISMATCH |

### C3. ride-elife get — 查状态 + 流式轮询（替换 <ride_id>）
```bash
# 单次查询
agenzo-merchant-cli --api-key $KEY ride-elife get --order-id "<ride_id>"

# 流式轮询直到终态（需后端 MOCK_STATUS_UPDATE=true）
agenzo-merchant-cli --api-key $KEY ride-elife get --order-id "<ride_id>" \
  --watch --watch-interval 1
```
预期：单次返回 status；`--watch` 逐行 NDJSON 输出
`Pending → Accepted → On my way → Waiting → On board → At destination`，
到终态自动停止。每行是独立紧凑 JSON。
> 注：生产环境（MOCK_STATUS_UPDATE=false）`--watch` 返回 elife 真实状态。

### C4. ride-elife cancel — 取消（替换 <ride_id>，需未到终态的订单）
```bash
agenzo-merchant-cli --api-key $KEY --yes ride-elife cancel \
  --order-id "<ride_id>" --idempotency-key cancel-$(date +%s)
```
预期：返回 `ride_stat: Cancelled`、`cancellation{cancellation_fee, reversal_amount, currency}`、
`refund_amount`（回补到月结账户的金额 = 已扣 − 取消费）。
| 变体 | 说明 |
|------|------|
| 对已 Cancelled 订单再 cancel | 幂等：返回同一结果，不重复回补 |

### C5. ride-elife list-orders — 确认订单与新字段
```bash
agenzo-merchant-cli --api-key $KEY ride-elife list-orders --format table
```
预期：看到刚才的订单，含 `is_scheduled` / `final_amount` /
`final_settlement_status` / `cancellation_fee` 字段。

### C6. finalFare 多退少补（实时单结算兜底）
实时单到达 `At destination` 后，后端 TaskScheduler 每 `FINALFARE_SETTLEMENT_INTERVAL`
秒（默认 120）自动对账。想立即触发：
```bash
cd /Users/administrator/PycharmProjects/agenzo
PYTHONPATH="$(pwd)/agenzo" .venv/bin/python -c "
import asyncio
from app.core.mongodb import MongoDB
from app.agent_pay.tasks.finalfare_settlement_task import settle_pending_finalfares
async def main():
    await MongoDB.connect(); await settle_pending_finalfares(); await MongoDB.disconnect()
asyncio.run(main())
"
```
预期：日志 `finalfare_settlement_completed ... settled=N`。之后 list-orders 的
`final_settlement_status` 由 `pending` 变为 `settled` / `no_adjustment`
（sandbox 价格相同则 no_adjustment）。

---

## D 档：schema 一致性自检（CLI schema vs 后端真实响应）

```bash
cd /Users/administrator/PycharmProjects/agenzo-token-cli/merchant-cli
MERCHANT_CLI_TEST_KEY=$KEY MERCHANT_CLI_TEST_HOST=http://localhost:8000 npm run test:drift
```
预期：quote / book / get / cancel / list-orders 全部 `no drift`，
末尾 `✓ No schema drift`。这是发版前的关键校验。

---

## 测试记录表

| 档 | 用例 | 通过? | 备注 |
|----|------|-------|------|
| A1 | 版本/帮助 ☐ | | |
| A2 | config ☐ | | |
| A3 | services（含命令名 ride-elife、无 billing_mode）☐ | | |
| A4 | schema 自描述（新字段）☐ | | |
| A5 | spinner ☐ | | |
| B1 | quote ☐ | | |
| B2 | list-orders ☐ | | |
| B3 | 鉴权错误 ☐ | | |
| B4 | org 隔离 ☐ | | |
| C2 | book 下单（is_scheduled/order_type）☐ | | |
| C3 | get + --watch 流式 ☐ | | |
| C4 | cancel（refund_amount）☐ | | |
| C5 | 列表确认（新字段）☐ | | |
| C6 | finalFare 结算 ☐ | | |
| D  | schema drift check ☐ | | |

---

## 发版（测试全通过后）

```bash
cd /Users/administrator/PycharmProjects/agenzo-token-cli/merchant-cli
agenzo-merchant-cli config reset-host    # 别带着 localhost 发版（host 不打进包，但习惯性确认）
npm login                                 # 当前未登录
npm version minor                         # bump（这次有 ride→ride-elife 改名 + 新字段，建议 minor）
npm pack --dry-run                        # 预检：包内应只有 dist/ + README.md + SKILL.md + package.json
npm publish --access public               # @agenzo scoped 包首次公开必须 --access public；prepublishOnly 自动 build
npm view @agenzo/merchant-cli version     # 验证
```

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
- quote 报 VEHICLE_UNAVAILABLE：检查坐标是否在 elife sandbox 覆盖区（用新加坡 Changi/Marina）。
- `--watch` 不推进状态：确认后端 `MOCK_STATUS_UPDATE=true`（sandbox 无真实司机）。
- 验证月结扣款（需要 docker mongosh）：book 后查账户余额应减少对应金额。
```bash
# DEV_ID 见前置准备里 seed 输出
docker exec agenzo-mongodb mongosh --quiet -u <user> -p <pass> --authenticationDatabase admin <db> \
  --eval 'db.ap_settlement_accounts.findOne({developer_id:"<DEV_ID>"}).balance'
```
