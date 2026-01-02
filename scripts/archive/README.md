# Archived Scripts

本目录包含已归档的脚本，这些脚本通常是一次性使用或很少使用的。

## 📜 脚本列表

### init-project.sh
**用途**: 初始化项目目录结构

**使用场景**: 仅在项目首次创建时使用

**使用方式**:
```bash
./scripts/archive/init-project.sh
```

**功能**:
- 创建所有服务的目录结构
- 生成基础配置文件
- 创建 .gitignore 文件
- 初始化 Prometheus、Grafana、PostgreSQL 配置

---

### setup-hosts.sh
**用途**: 配置本地主机名映射

**使用场景**: 当需要通过主机名访问远程 Docker 服务时

**使用方式**:
```bash
# 打印 hosts 条目（手动添加到 /etc/hosts）
./scripts/archive/setup-hosts.sh print

# 打印环境变量导出命令
./scripts/archive/setup-hosts.sh export

# 生成 Docker hosts 文件
./scripts/archive/setup-hosts.sh docker-hosts
```

**注意**: 
- 需要在 .env.local 中设置 DOCKER_HOST_IP
- 修改 /etc/hosts 需要 sudo 权限

---

### sparse-clone.sh
**用途**: 稀疏克隆仓库（仅克隆部署所需文件）

**使用场景**: 在生产服务器上部署时，只需要 docker-compose 和配置文件

**使用方式**:
```bash
./scripts/archive/sparse-clone.sh <repo-url> [target-dir]

# 示例
./scripts/archive/sparse-clone.sh https://github.com/user/chain-risk-platform.git
```

**克隆内容**:
- docker-compose.yml
- .env.example
- infra/ 目录

---

## ⚠️ 注意事项

1. 这些脚本已经归档，不再积极维护
2. 使用前请检查脚本内容是否符合当前项目结构
3. 如果需要频繁使用某个脚本，考虑将其移回主目录并更新

## 🔄 恢复脚本

如果需要恢复某个脚本到主目录：

```bash
mv scripts/archive/script-name.sh scripts/
```

然后更新 `scripts/README.md` 文档。
