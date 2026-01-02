# API Specification Management

本文档说明如何自动生成和更新所有微服务的 OpenAPI 规范文档。

## 📋 概述

所有 API 规范文档统一存放在 `docs/api-specs/` 目录下：

```
docs/api-specs/
├── query-service.openapi.json      # Query Service (Go)
├── bff.openapi.json                # BFF (NestJS)
├── risk-ml-service.openapi.json    # Risk ML Service (FastAPI)
├── orchestrator.openapi.json       # Orchestrator (Spring Boot)
└── graph-engine.openapi.json       # Graph Engine (Spring Boot)
```

## 🔧 各服务 API 生成方式

### 1. Query Service (Go + swaggo/swag)

**技术栈**: Go + Gin + swaggo/swag

**生成方式**:
```bash
cd services/query-service
swag init -g cmd/query/main.go -o docs --parseDependency --parseInternal
```

**API 文档注释**: 使用 godoc 风格的注释
```go
// GetTransfers godoc
// @Summary      Get transfers
// @Description  Get paginated list of transfers
// @Tags         transfers
// @Accept       json
// @Produce      json
// @Param        page     query    int     false  "Page number"
// @Param        limit    query    int     false  "Items per page"
// @Success      200      {object} response.TransfersResponse
// @Router       /api/v1/transfers [get]
func (h *TransferHandler) GetTransfers(c *gin.Context) {
    // ...
}
```

**访问地址**: http://localhost:8081/swagger/index.html

---

### 2. BFF (NestJS + @nestjs/swagger)

**技术栈**: NestJS + TypeScript + @nestjs/swagger

**生成方式**: 运行时自动生成，通过 HTTP 端点获取
```bash
curl http://localhost:3001/docs-json > bff.openapi.json
```

**API 文档注释**: 使用装饰器
```typescript
@ApiTags('addresses')
@Controller('addresses')
export class AddressController {
  @Get(':address')
  @ApiOperation({ summary: 'Get address information' })
  @ApiParam({ name: 'address', description: 'Blockchain address' })
  @ApiResponse({ status: 200, description: 'Address information', type: AddressDto })
  async getAddress(@Param('address') address: string) {
    // ...
  }
}
```

**访问地址**: http://localhost:3001/docs

---

### 3. Risk ML Service (FastAPI)

**技术栈**: Python + FastAPI

**生成方式**: FastAPI 自动生成，通过 HTTP 端点获取
```bash
curl http://localhost:8082/openapi.json > risk-ml-service.openapi.json
```

**API 文档注释**: 使用 Python docstring 和类型注解
```python
@router.post("/score", response_model=RiskScoreResponse)
async def calculate_risk_score(
    request: RiskScoreRequest,
    service: RiskService = Depends(get_risk_service)
) -> RiskScoreResponse:
    """
    Calculate risk score for an address.
    
    Args:
        request: Risk score request with address and network
        
    Returns:
        Risk score response with score, level, and factors
    """
    # ...
```

**访问地址**: http://localhost:8082/docs

---

### 4. Orchestrator (Spring Boot + springdoc-openapi)

**技术栈**: Java + Spring WebFlux + springdoc-openapi

**生成方式**: 运行时自动生成，通过 HTTP 端点获取
```bash
curl http://localhost:8080/v3/api-docs > orchestrator.openapi.json
```

**API 文档注释**: 使用 Swagger 注解
```java
@Tag(name = "Address", description = "Address query endpoints")
@RestController
@RequestMapping("/api/v1/addresses")
public class AddressController {
    
    @Operation(summary = "Get address information")
    @ApiResponse(responseCode = "200", description = "Success")
    @GetMapping("/{address}")
    public Mono<AddressResponse> getAddress(@PathVariable String address) {
        // ...
    }
}
```

**访问地址**: http://localhost:8080/swagger-ui.html

---

### 5. Graph Engine (Spring Boot + springdoc-openapi)

**技术栈**: Java + Spring MVC + springdoc-openapi

**生成方式**: 运行时自动生成，通过 HTTP 端点获取
```bash
curl http://localhost:8084/v3/api-docs > graph-engine.openapi.json
```

**API 文档注释**: 使用 Swagger 注解
```java
@Tag(name = "Graph", description = "Graph query and analysis endpoints")
@RestController
@RequestMapping("/api/graph")
public class GraphController {
    
    @Operation(summary = "Get address relationships")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Success"),
        @ApiResponse(responseCode = "404", description = "Address not found")
    })
    @GetMapping("/address/{address}/relationships")
    public ResponseEntity<RelationshipResponse> getRelationships(
        @PathVariable String address
    ) {
        // ...
    }
}
```

**访问地址**: http://localhost:8084/swagger-ui.html

---

## 🚀 使用自动化脚本

### 方式一：使用 Makefile（推荐）

```bash
# 更新所有服务的 API 规范
make api-update

# 更新单个服务
make api-update-query      # Query Service
make api-update-bff        # BFF
make api-update-risk       # Risk ML Service
make api-update-orch       # Orchestrator
make api-update-graph      # Graph Engine
```

### 方式二：直接运行脚本

```bash
# 更新所有服务
./scripts/update-api-specs.sh

# 更新指定服务
./scripts/update-api-specs.sh --query --bff

# 查看帮助
./scripts/update-api-specs.sh --help
```

### 脚本选项

```
Options:
  --all              Update all services (default)
  --query            Update Query Service only
  --bff              Update BFF only
  --risk             Update Risk ML Service only
  --orchestrator     Update Orchestrator only
  --graph            Update Graph Engine only
  --help, -h         Show help message
```

---

## 📝 工作流程

### 开发流程

1. **修改 API 代码**
   - 更新 Controller/Handler
   - 添加/修改 API 文档注释

2. **本地测试**
   - 启动服务
   - 访问 Swagger UI 验证文档

3. **更新 API 规范**
   ```bash
   make api-update-query  # 或其他服务
   ```

4. **提交代码**
   ```bash
   git add services/query-service/
   git add docs/api-specs/query-service.openapi.json
   git commit -m "feat: add new API endpoint"
   ```

### CI/CD 集成

可以在 CI/CD 流程中自动更新 API 规范：

```yaml
# .github/workflows/api-docs.yml
name: Update API Docs

on:
  push:
    branches: [main, develop]
    paths:
      - 'services/**'
      - 'processing/**'

jobs:
  update-api-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup dependencies
        run: |
          # Install Go, Node.js, Python, Java
          
      - name: Start services
        run: |
          make infra-up
          make run-svc
          
      - name: Update API specs
        run: make api-update
        
      - name: Commit changes
        run: |
          git config user.name "GitHub Actions"
          git config user.email "actions@github.com"
          git add docs/api-specs/
          git commit -m "docs: update API specifications" || exit 0
          git push
```

---

## 🔍 验证 API 规范

### 使用 Swagger Editor

1. 访问 [Swagger Editor](https://editor.swagger.io/)
2. 导入生成的 JSON 文件
3. 验证格式和内容

### 使用 OpenAPI CLI

```bash
# 安装 openapi-cli
npm install -g @redocly/cli

# 验证 API 规范
redocly lint docs/api-specs/query-service.openapi.json

# 生成 HTML 文档
redocly build-docs docs/api-specs/query-service.openapi.json \
  -o docs/api-specs/query-service.html
```

---

## 📦 依赖要求

### Query Service
- Go 1.21+
- swag CLI: `go install github.com/swaggo/swag/cmd/swag@latest`

### BFF
- Node.js 18+
- npm dependencies (已在 package.json 中)

### Risk ML Service
- Python 3.11+
- uv (Python 包管理器)
- FastAPI dependencies

### Orchestrator & Graph Engine
- Java 17+
- Maven 3.8+
- Spring Boot dependencies

---

## 🐛 故障排除

### 问题：swag 命令未找到

```bash
# 安装 swag
go install github.com/swaggo/swag/cmd/swag@latest

# 确保 $GOPATH/bin 在 PATH 中
export PATH=$PATH:$(go env GOPATH)/bin
```

### 问题：服务未运行

对于需要运行服务的情况（BFF, Risk ML, Orchestrator, Graph Engine）：

```bash
# 启动基础设施
make infra-up

# 启动所有服务
make run-svc

# 或单独启动
make bff-run
make risk-run
make orchestrator-run
make graph-run
```

### 问题：端口被占用

```bash
# 检查端口占用
lsof -i :3001  # BFF
lsof -i :8081  # Query Service
lsof -i :8082  # Risk ML Service
lsof -i :8080  # Orchestrator
lsof -i :8084  # Graph Engine

# 停止服务
make stop-svc
```

---

## 📚 参考文档

- [Swagger/OpenAPI Specification](https://swagger.io/specification/)
- [swaggo/swag](https://github.com/swaggo/swag)
- [NestJS Swagger](https://docs.nestjs.com/openapi/introduction)
- [FastAPI OpenAPI](https://fastapi.tiangolo.com/tutorial/metadata/)
- [springdoc-openapi](https://springdoc.org/)

---

## 🎯 最佳实践

1. **保持文档同步**: 每次修改 API 后立即更新文档
2. **使用语义化版本**: API 版本号遵循 SemVer
3. **详细的描述**: 为每个端点提供清晰的描述和示例
4. **错误响应**: 文档化所有可能的错误响应
5. **认证说明**: 明确标注需要认证的端点
6. **请求示例**: 提供完整的请求和响应示例

---

## 📊 API 规范统计

查看当前 API 规范的统计信息：

```bash
# 查看文件大小
ls -lh docs/api-specs/

# 统计端点数量
jq '.paths | length' docs/api-specs/query-service.openapi.json

# 查看 API 版本
jq '.info.version' docs/api-specs/*.json
```
