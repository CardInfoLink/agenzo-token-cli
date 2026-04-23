# Contributing

感谢你对 agent-token-admin 的贡献兴趣！

## 开发环境

```bash
# 克隆项目
git clone https://github.com/CardInfoLink/agent-token-cli.git
cd agent-token-cli

# 安装依赖
npm install

# 开发构建（watch 模式）
npm run dev

# 运行测试
npm test

# 生产构建
npm run build
```

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

每个功能域目录内，一个文件对应一个子命令。例如修改 `developers create`，直接编辑 `src/developers/create.ts`。

## 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
feat: add new payment type support
fix: handle timeout in magic link polling
docs: update README examples
refactor: simplify auth token refresh logic
test: add property tests for formatter
```

## Pull Request

1. Fork 项目并创建分支
2. 确保 `npm run build` 和 `npm test` 通过
3. 提交 PR 并描述变更内容
