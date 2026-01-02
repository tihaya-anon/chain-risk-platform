# API Specification Quick Reference

## 🚀 快速使用

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

## 📍 API 文档访问地址

| 服务 | Swagger UI | API Spec JSON | 端口 |
|------|-----------|---------------|------|
| Query Service | http://localhost:8081/swagger/index.html | http://localhost:8081/swagger/doc.json | 8081 |
| BFF | http://localhost:3001/docs | http://localhost:3001/docs-json | 3001 |
| Risk ML Service | http://localhost:8082/docs | http://localhost:8082/openapi.json | 8082 |
| Orchestrator | http://localhost:8080/swagger-ui.html | http://localhost:8080/v3/api-docs | 8080 |
| Graph Engine | http://localhost:8084/swagger-ui.html | http://localhost:8084/v3/api-docs | 8084 |

## 📦 生成的文件位置

所有 API 规范统一存放在：

```
docs/api-specs/
├── query-service.openapi.json
├── bff.openapi.json
├── risk-ml-service.openapi.json
├── orchestrator.openapi.json
└── graph-engine.openapi.json
```

## 🔧 各服务技术栈

| 服务 | 语言/框架 | OpenAPI 工具 | 生成方式 |
|------|----------|-------------|---------|
| Query Service | Go + Gin | swaggo/swag | CLI 生成 |
| BFF | TypeScript + NestJS | @nestjs/swagger | 运行时生成 |
| Risk ML Service | Python + FastAPI | FastAPI 内置 | 运行时生成 |
| Orchestrator | Java + Spring WebFlux | springdoc-openapi | 运行时生成 |
| Graph Engine | Java + Spring MVC | springdoc-openapi | 运行时生成 |

## 📝 API 文档注释示例

### Go (Query Service)

```go
// GetTransfers godoc
// @Summary      Get transfers
// @Description  Get paginated list of transfers
// @Tags         transfers
// @Accept       json
// @Produce      json
// @Param        page     query    int     false  "Page number"
// @Success      200      {object} response.TransfersResponse
// @Router       /api/v1/transfers [get]
func (h *TransferHandler) GetTransfers(c *gin.Context) {
    // ...
}
```

### TypeScript (BFF)

```typescript
@ApiTags('addresses')
@Controller('addresses')
export class AddressController {
  @Get(':address')
  @ApiOperation({ summary: 'Get address information' })
  @ApiParam({ name: 'address', description: 'Blockchain address' })
  @ApiResponse({ status: 200, type: AddressDto })
  async getAddress(@Param('address') address: string) {
    // ...
  }
}
```

### Python (Risk ML Service)

```python
@router.post("/score", response_model=RiskScoreResponse)
async def calculate_risk_score(
    request: RiskScoreRequest
) -> RiskScoreResponse:
    """
    Calculate risk score for an address.
    
    Args:
        request: Risk score request
        
    Returns:
        Risk score with level and factors
    """
    # ...
```

### Java (Orchestrator/Graph Engine)

```java
@Tag(name = "Address")
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

## 🐛 常见问题

### swag 命令未找到

```bash
go install github.com/swaggo/swag/cmd/swag@latest
export PATH=$PATH:$(go env GOPATH)/bin
```

### 服务未运行

```bash
# 启动基础设施
make infra-up

# 启动所有服务
make run-svc

# 或单独启动
make query-run
make bff-run
make risk-run
make orchestrator-run
make graph-run
```

### 端口被占用

```bash
# 检查端口
lsof -i :8081  # Query Service
lsof -i :3001  # BFF
lsof -i :8082  # Risk ML Service
lsof -i :8080  # Orchestrator
lsof -i :8084  # Graph Engine

# 停止所有服务
make stop-svc
```

## 📚 详细文档

完整文档请参考：[docs/API_SPECS_GUIDE.md](./API_SPECS_GUIDE.md)

## 🔄 开发工作流

1. **修改 API 代码** → 添加/更新文档注释
2. **本地测试** → 访问 Swagger UI 验证
3. **更新规范** → `make api-update-query`
4. **提交代码** → 包含 API 规范文件

## 🎯 最佳实践

- ✅ 每次修改 API 后立即更新文档
- ✅ 提供详细的描述和示例
- ✅ 文档化所有错误响应
- ✅ 明确标注认证要求
- ✅ 使用语义化版本号
