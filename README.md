# agent-token-admin

> 🇨🇳 中文 | [🇬🇧 English](./README_EN.md)

Agent Payment API 的命令行管理工具。

## 安装

```bash
npm install -g agent-token-admin
```

**要求**: Node.js 18+

## 快速开始

```bash
# 1. 登录（首次使用自动注册）
agent-token-admin login --email your@email.com

# 2. 创建开发者
agent-token-admin developers create --name "My Agent" --email agent@example.com

# 3. 创建 API Key
agent-token-admin keys create --developer dev_001 --name "Production Key"

# 4. 添加支付方式（绑卡）
agent-token-admin payment-methods add --key ak_xxx --email user@example.com

# 5. 创建 VCN 支付令牌
agent-token-admin payment-tokens create --type vcn --key ak_xxx --pm pm_001 --member mem_001 --amount 500
```

## 命令

| 命令 | 说明 |
|------|------|
| `login` | 通过 Magic Link 登录（首次自动注册） |
| `logout` | 登出当前组织 |
| `orgs me / update / list / switch` | 组织管理 |
| `developers create / list / get / update` | 开发者管理 |
| `keys create / list / get / rotate / disable` | API Key 管理 |
| `payment-methods add / list / get / disable` | 支付方式管理 |
| `payment-tokens create / list / get / revoke` | 支付令牌管理（VCN / Network Token / X402） |

## 认证模式

- **Control Plane**（`orgs`、`developers`、`keys`）：Bearer Token，通过 `login` 获取
- **Runtime Plane**（`payment-methods`、`payment-tokens`）：API Key，通过 `--key` 传入

## 文档

- [完整命令参考与 Sample](./AGENT_CLI.md)

## 项目结构

```
src/
├── auth/              # 认证（login/logout + AuthService）
├── orgs/              # 组织管理
├── developers/        # 开发者管理
├── keys/              # API Key 管理
├── payment-methods/   # 支付方式
├── payment-tokens/    # 支付令牌
├── api/               # HTTP 客户端
├── config/            # 本地配置与凭证管理
├── utils/             # 格式化、交互提示、错误处理
└── types/             # TypeScript 类型定义
```

## 开发

```bash
npm install        # 安装依赖
npm run dev        # 开发构建（watch）
npm test           # 运行测试
npm run build      # 生产构建
```

## 许可证

MIT
