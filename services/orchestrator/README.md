# Orchestrator Service

API Gateway and Orchestrator for Chain Risk Platform.

## Features

### 1. API Gateway
- **JWT Authentication**: Validates JWT tokens and extracts user information
- **Request Routing**: Routes requests to BFF and other services
- **User Context Injection**: Adds user headers (X-User-Id, X-User-Username, X-User-Role)
- **Request Logging**: Logs all incoming/outgoing requests
- **CORS Support**: Configurable CORS settings

### 2. API Orchestration
- **Multi-Service Coordination**: Combines multiple API calls into single endpoint
- **Parallel Execution**: Executes independent API calls in parallel
- **Error Handling**: Graceful degradation when services fail

### 3. Resilience
- **Circuit Breaker**: Prevents cascading failures
- **Rate Limiting**: Protects services from overload
- **Fallback**: Provides fallback responses when services are down
- **Retry**: Automatic retry for transient failures

## Architecture

```
Frontend → Orchestrator (Port 8080) → BFF (Port 3001) → Backend Services
           [JWT Auth]                  [User Headers]
           [Rate Limit]
           [Circuit Breaker]
           [Orchestration]
```

## Endpoints

### Gateway Routes (Proxy to BFF)
- `/api/v1/auth/**` - Authentication (no auth required)
- `/api/v1/addresses/**` - Address queries (auth required)
- `/api/v1/risk/**` - Risk scoring (auth required)

### Orchestration Routes (Complex Scenarios)
- `GET /api/v1/orchestration/address-profile/{address}` - Comprehensive address profile
  - Combines: address info + risk score + recent transfers
  - Parallel execution
  - Partial failure tolerance

### Fallback Routes
- `/fallback/bff` - BFF service unavailable fallback
- `/fallback/generic` - Generic error fallback

## Configuration

### Environment Variables

```bash
PORT=8080
JWT_SECRET=your-secret-key
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Resilience Configuration

**Circuit Breaker**:
- Sliding window: 10 requests
- Failure threshold: 50%
- Wait duration: 10s

**Rate Limiter**:
- Limit: 100 requests per second per user
- Timeout: 0s (fail immediately)

**Retry**:
- Max attempts: 3
- Wait duration: 1s

## Running

```bash
# Build
mvn clean package

# Run
java -jar target/orchestrator-0.1.0.jar

# Or with Maven
mvn spring-boot:run
```

## Testing

### Login
```bash
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Get Address (via Gateway)
```bash
curl http://localhost:8080/api/v1/addresses/0x123... \
  -H "Authorization: Bearer <token>"
```

### Get Address Profile (Orchestration)
```bash
curl http://localhost:8080/api/v1/orchestration/address-profile/0x123... \
  -H "Authorization: Bearer <token>"
```

## Monitoring

- Health: `http://localhost:8080/actuator/health`
- Metrics: `http://localhost:8080/actuator/metrics`
- Circuit Breakers: `http://localhost:8080/actuator/circuitbreakers`
- Rate Limiters: `http://localhost:8080/actuator/ratelimiters`

## Development

### Adding New Orchestration

1. Add method in `BffClient` for API call
2. Create endpoint in `OrchestrationController`
3. Combine multiple API calls using `Mono.zip()`
4. Add error handling with `onErrorResume()`

Example:
```java
Mono.zip(apiCall1, apiCall2, apiCall3)
    .map(tuple -> combineResults(tuple))
    .onErrorResume(e -> fallbackResponse());
```

## Advantages Over Separate Gateway

1. **Reduced Latency**: No extra network hop for orchestration
2. **Simplified Deployment**: One service instead of two
3. **Unified Configuration**: Single place for auth, rate limiting, etc.
4. **Better Observability**: Single service to monitor
5. **Cost Effective**: Fewer resources required
