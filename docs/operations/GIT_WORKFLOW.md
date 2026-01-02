# Git 工作流指南

## 📌 分支策略

采用 **Git Flow** 简化版：

```
main (生产环境)
  │
  └── develop (开发主线)
        │
        ├── feature/xxx (功能分支)
        ├── fix/xxx (修复分支)
        └── refactor/xxx (重构分支)
```

### 分支命名规范

```bash
# 功能开发
feature/data-ingestion-etherscan
feature/query-service-api
feature/risk-ml-rules

# Bug 修复
fix/kafka-connection-timeout
fix/transfer-parser-null-check

# 重构
refactor/query-service-cache

# 发布
release/v1.0.0
```

---

## 🔄 日常开发流程

### 1. 开始新功能

```bash
# 从 develop 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/query-service-api

# 开发...
```

### 2. 提交代码

```bash
# 提交规范: <type>(<scope>): <subject>
git add .
git commit -m "feat(query-service): add address query API"
```

#### Commit Type 规范

| Type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式 (不影响功能) |
| `refactor` | 重构 |
| `test` | 测试相关 |
| `chore` | 构建/工具变更 |
| `perf` | 性能优化 |

#### Scope 规范 (服务名)

```
data-ingestion, query-service, alert-service, 
risk-ml-service, bff-gateway, orchestrator,
stream-processor, batch-processor, graph-engine,
frontend, infra, docs
```

#### 示例

```bash
feat(data-ingestion): add Etherscan API client
fix(stream-processor): handle null token address
docs(readme): update quick start guide
refactor(query-service): extract cache layer
test(risk-ml-service): add rule engine unit tests
chore(ci): add Python linting step
```

### 3. 推送并创建 PR

```bash
git push origin feature/query-service-api
# 在 GitHub 创建 Pull Request → develop
```

### 4. Code Review & Merge

- PR 需要通过 CI 检查
- 合并后删除功能分支

---

## 🏷️ 版本发布

### 语义化版本 (SemVer)

```
v{MAJOR}.{MINOR}.{PATCH}

MAJOR: 不兼容的 API 变更
MINOR: 向后兼容的功能新增
PATCH: 向后兼容的 Bug 修复
```

### 发布流程

```bash
# 1. 从 develop 创建 release 分支
git checkout develop
git checkout -b release/v1.0.0

# 2. 更新版本号、CHANGELOG
# 3. 测试

# 4. 合并到 main 并打 tag
git checkout main
git merge release/v1.0.0
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin main --tags

# 5. 合并回 develop
git checkout develop
git merge release/v1.0.0
git push origin develop

# 6. 删除 release 分支
git branch -d release/v1.0.0
```

---

## 📁 Monorepo 特殊考虑

### 只构建变更的服务

CI 配置 (`.github/workflows/ci.yml`) 使用 `paths-filter` 检测变更：

```yaml
# 只有 Go 代码变更时才运行 Go CI
go:
  - 'data-ingestion/**'
  - 'services/query-service/**'
  - 'services/alert-service/**'
```

### 跨服务变更

如果一个 PR 涉及多个服务，在 commit message 中说明：

```bash
git commit -m "feat(query-service,bff-gateway): add address risk endpoint

- query-service: add /addresses/:addr/risk endpoint
- bff-gateway: aggregate risk data from risk-ml-service"
```

---

## 🛡️ 保护规则建议

### main 分支保护

- ✅ Require pull request reviews
- ✅ Require status checks to pass
- ✅ Require linear history
- ✅ Do not allow force pushes

### develop 分支保护

- ✅ Require status checks to pass
- ✅ Do not allow force pushes

---

## 🔧 常用命令速查

```bash
# 查看所有分支
git branch -a

# 删除本地分支
git branch -d feature/xxx

# 删除远程分支
git push origin --delete feature/xxx

# 变基到最新 develop
git checkout feature/xxx
git rebase develop

# 撤销最后一次提交 (保留更改)
git reset --soft HEAD~1

# 查看某个服务的提交历史
git log --oneline -- services/query-service/

# 查看变更了哪些文件
git diff --name-only develop

# 暂存当前更改
git stash
git stash pop
```

---

## 📋 PR 模板

创建 `.github/pull_request_template.md`:

```markdown
## 变更类型
- [ ] 新功能 (feat)
- [ ] Bug 修复 (fix)
- [ ] 重构 (refactor)
- [ ] 文档 (docs)
- [ ] 其他

## 涉及服务
- [ ] data-ingestion
- [ ] query-service
- [ ] alert-service
- [ ] risk-ml-service
- [ ] bff-gateway
- [ ] orchestrator
- [ ] stream-processor
- [ ] frontend
- [ ] infra

## 变更描述
<!-- 简要描述这个 PR 做了什么 -->

## 测试
<!-- 如何测试这些变更 -->

## Checklist
- [ ] 代码已自测
- [ ] 添加/更新了单元测试
- [ ] 更新了相关文档
- [ ] CI 检查通过
```
