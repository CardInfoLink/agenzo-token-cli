# agenzo-merchant-cli — 高层 Spec（首个 npm 交付）

## 1. 目标

在仓库内新建一个**独立的 Node.js CLI 包** `merchant-cli/`，可独立 `npm publish`，
bin 名为 `agenzo-merchant-cli`。它是 Agenzo 平台 **Merchant（商户履约）产品线**的命令行入口，
面向 AI Agent 和人类用户，本期只交付**打车（ride）**业务闭环 + **能力发现（services）**。

这是一个面向 Agent 的 CLI：默认输出 JSON（机器友好），`--format table` 才输出人类可读文本。

**约束（强约束，不要违反）**：
- 只新建 `merchant-cli/` 子目录里的文件，**不要修改仓库里任何已有文件**（尤其是仓库根的
  `src/`、`package.json`、`tsconfig.json` 等属于已发布的 agenzo-token-cli，必须原样不动）。
- 这是全新独立包，不依赖仓库根的代码；它自带一份精简的内部 core 工具。
- 技术栈与 agenzo-token-cli 对齐：TypeScript + ESM + commander + @inquirer/prompts + tsup 构建，Node 18+。

## 2. 它对接什么

CLI 通过 HTTPS 调用 **agenzo 后端已就绪的 REST 接口**（不直连任何第三方、不碰支付密钥）。
后端基址可通过 `config set-host` 配置，默认 `https://agent.everonet.com`。
所有 ride 接口都在 `/api/v2` 前缀下，已存在、可直接对接：

| 命令 | 后端端点 | 方法 |
|---|---|---|
| ride quote | `/api/v2/rides/search` | POST |
| ride book | `/api/v2/rides/book` | POST |
| ride get | `/api/v2/rides/{order_id}/status` | GET |
| ride cancel | `/api/v2/rides/{order_id}/cancel` | POST |
| ride list-orders | `/api/v2/rides/orders` | GET |

### 认证
- 运行面用 **API Key**，通过 `--api-key <key>` 传入；缺省时交互式索取。
- 后端要求请求头 **`X-API-Key: <key>`**。

### 后端统一响应封装
- 成功：`{ "success": true, "data": {...}, "request_id": "req_xxx" }`
- 失败：`{ "success": false, "error": { "code": "...", "message": "..." }, "request_id": "req_xxx" }`
- CLI 必须解开这层封装：成功取 `data`，失败以 `error.code` 为错误路由键、`error.message` 给用户看。

## 3. 命令清单（本期范围）

```
agenzo-merchant-cli
├── config set-host <url> / reset-host / show     本地后端地址配置
├── services
│   ├── list                                       列出当前 Key 可用的商户能力（能力发现）
│   └── get <service-id>                            查单个能力的 verbs / workflow / schema 入口
└── ride
    ├── quote        查 A→B 报价与可选车型（只读）
    ├── book         下单叫车（写操作，必须 --idempotency-key）
    ├── get          查订单状态（只读，可轮询）
    ├── cancel       取消订单（写操作，必须 --idempotency-key）
    └── list-orders  列出当前 Key 下的 ride 订单（只读，分页）
```

### 3.1 ride quote
请求 `POST /api/v2/rides/search`，请求体字段（snake_case）：
`pickup{lat,lng,name}`、`dropoff{lat,lng,name}`、`pickup_time`(epoch 秒或 "now")、
`passenger_name`、`passenger_phone`(E.164)、可选 `passenger_count`/`luggage_count`/`passenger_email`/`children_count`。
CLI flags 用 `--pickup-lat/--pickup-lng/--pickup-name/--dropoff-*/--pickup-time/--passenger-name/--passenger-phone/...`。
响应含 `vehicle_classes[]`（每项有 `vehicle_class`、`price{amount,currency,quote_id}`、`passenger_capacity`、`luggage_capacity`）、`meet_and_greet`、`is_airport_transfer`、`airport_direction`。
**金额是货币常规单位（decimal，42.50 = $42.50），不是分。**

### 3.2 ride book
请求 `POST /api/v2/rides/book`，写操作，必须带 `--idempotency-key`（通过 `Idempotency-Key` 请求头发送，不放 body）。
请求体字段：`quote_id`、`vehicle_class`、`price_amount`、`price_currency`(默认 USD)、
`payment_method_id`、`passenger_name`、`passenger_phone`、可选 `passenger_email`/`luggage_count`/`special_requests`、
`pickup{lat,lng,name}`、`dropoff{lat,lng,name}`、`pickup_time`、
可选 `meet_and_greet`(bool)/`meet_and_greet_price`/`welcome_sign`/`arrival_flight{flight_no,airline}`/`departure_flight{...}`。
> 注意：当前后端 book 用 `payment_method_id`（绑卡句柄）。CLI 本期照此对接，flag 命名为 `--payment-method-id`。
> 在 book.ts 顶部留一条注释 TODO：未来后端改造完成后切换为 `--payment-order-id`（支付订单反查模式，对应内部工单 BACK-034）。
响应含 `ride_id`(后续 get/cancel 用)、`order_id`、`price`、以及 elife 透传字段。

### 3.3 ride get
请求 `GET /api/v2/rides/{order_id}/status`，`--order-id` 取值为 book 返回的 `ride_id`。
响应含 `status`、`from`、`to`、`pickup_time`、`vehicle_class`、`price`、`passenger`、`driver`（派单后才有）、`vehicle`（派单后才有）等。
状态枚举（大小写敏感）：`Pending` / `Accepted` / `On my way` / `Waiting` / `On board` / `At destination` / `Rejected` / `Cancelled` / `Customer no show` / `Driver no show`。
终态：`At destination` / `Cancelled` / `Rejected` / `Customer no show` / `Driver no show`。

### 3.4 ride cancel
请求 `POST /api/v2/rides/{order_id}/cancel`，写操作，必须带 `--idempotency-key`。
响应含 `ride_id`、`ride_stat`、`cancellation{cancellation_fee,reversal_amount,currency}`。

### 3.5 ride list-orders
请求 `GET /api/v2/rides/orders`，query 参数：`page`(默认1)、`page_size`(默认20)、可选 `status`、`order_type`。
响应含 `orders[]`、`total`、`page`、`page_size`。

### 3.6 services list / get
后端**暂无** `/services` discovery 端点。本期 CLI 用**内置静态注册表**实现：
- `services list`：输出一个静态的能力清单，本期只有 ride 一条
  （`service_id`、`name`、`description`、`version`、`provider="elife"`、`cli_noun="ride"`、
  `verbs=["quote","book","get","cancel","list-orders"]`、`since`、`discovery.help_command`）。
  同时回显 `billing.mode`（本期固定 `pay_per_call`）。
- `services get <service-id>`：输出该能力更详细的元数据（verb 描述 + workflow 步骤：quote→book→get(poll)→[cancel]）。
- 未知 service-id 返回错误码 `SERVICE_NOT_FOUND`。
这样 Agent 首发就能"发现"ride 能力，无需后端配合。

## 4. 通用要求（所有命令）

- **输出双形态**：默认 `--format json`（输出后端 data 的 JSON）；`--format table` 输出人类可读的 key-value / 表格。
- **写操作幂等**：book、cancel 必须支持 `--idempotency-key`，作为 `Idempotency-Key` 请求头发送；缺省时交互式索取。
- **错误码**：用 SCREAMING_SNAKE_CASE 字符串错误码（如 `QUOTE_EXPIRED`、`VEHICLE_UNAVAILABLE`、
  `BOOKING_FAILED`、`CANCELLATION_NOT_ALLOWED`、`SERVICE_NOT_FOUND`、`PARAM_IDEMPOTENCY_KEY_REQUIRED`），
  以后端 `error.code` 为准透传；网络/超时错误本地映射。错误信息清晰，必要时给恢复建议。
- **版本协商**：读后端响应头 `X-CLI-Min-Version`，若本地版本低于该值则报错退出码 2 并提示升级（可参考 agenzo-token-cli 的实现）。
- **`--help --format json`**：每个 verb 支持以 JSON 输出自己的参数/响应 schema（Agent 发现参数用）。
- **`--yes` 全局 flag**：跳过交互确认（自动化/Agent 用）。

## 5. 包结构（建议，planner 可微调）

```
merchant-cli/
├── package.json          name=agenzo-merchant-cli, bin: agenzo-merchant-cli → dist/index.js
├── tsconfig.json
├── tsup.config.ts        ESM, target node18, banner shebang
├── README.md
├── SKILL.md              给 Agent 读的技能说明（命令、流程、错误恢复）
└── src/
    ├── index.ts          commander 入口，注册 config / services / ride 所有命令
    ├── core/             内置精简底座（不依赖仓库根）
    │   ├── api-client.ts     HTTP client，X-API-Key 头，解封装 success/error，min-version 协商
    │   ├── formatter.ts      table / keyValue / status 输出
    │   ├── output.ts         按 --format 分发 json / table 输出
    │   ├── prompt-engine.ts  缺省参数交互式索取
    │   ├── errors.ts         错误码与错误类
    │   ├── version.ts        读 package.json 版本 + min-version 比较
    │   └── config-manager.ts 读写本地 host 配置（~/.agenzo-merchant-cli/）
    ├── types/
    │   └── api.ts            请求/响应 TypeScript 类型
    ├── ride/
    │   ├── quote.ts
    │   ├── book.ts
    │   ├── get.ts
    │   ├── cancel.ts
    │   └── list-orders.ts
    ├── services/
    │   ├── list.ts
    │   ├── get.ts
    │   └── registry.ts      内置静态能力注册表
    └── utils/
        └── idempotency.ts   幂等键校验/提示
```

## 6. 验收标准

- `cd merchant-cli && npm install && npm run build` 成功，产出 `dist/index.js`。
- `node dist/index.js --help` 列出 config / services / ride 三组命令。
- `node dist/index.js ride quote --help` 显示参数；加 `--format json` 输出参数 schema。
- `node dist/index.js services list` 能输出内置的 ride 能力（不需要后端）。
- TypeScript 编译无错误（`npx tsc --noEmit` 通过）。
- 每个命令文件能独立通过类型检查；命令文件之间不共享可变状态、不互相 import（除 core/types/utils）。

## 7. 拆分建议（给 planner 的提示）

- **先做一个 foundation/scaffold 任务**：建包配置 + core/ + types/ + utils/ + index.ts 入口
  （入口里把 ride 各 verb 和 services 各 verb 注册为可调用的占位/骨架）。这个任务是其它所有任务的前置依赖。
- **其余任务各实现一个命令文件**，依赖 foundation。并行任务的 `files_owned` 不要重叠
  （每个 ride 命令一个文件、services 单独一个任务、文档单独一个任务）。
- acceptance 用 TypeScript 编译检查（如 `cd merchant-cli && npx tsc --noEmit`）；foundation 额外跑 `npm install && npm run build`。
