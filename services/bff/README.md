# BFF (Backend for Frontend)

API Gateway and service orchestration layer for Chain Risk Platform.

## Overview

BFF serves as the unified entry point for frontend applications, providing:
- **API Gateway**: Routes requests to backend microservices
- **Service Orchestration**: Coordinates multi-service operations in parallel
- **Authentication**: JWT token generation (validation done by Gateway)
- **WebSocket**: Real-time notifications and updates
- **Circuit Breaker**: Fault tolerance for downstream services (planned)
- **Rate Limiting**: API protection (planned)
- **Caching**: Response caching for performance

## Architecture

```
Frontend → Gateway (JWT Auth) → BFF → Backend Services
                    ↓                  ↓
              Add Headers:        Query Service
              - X-User-Id         Risk ML Service
              - X-User-Username   Graph Service
              - X-User-Role       Alert Service
```

### Orchestration Layer

BFF includes an orchestration module that coordinates complex multi-service operations:

```
Orchestration Module
    ↓
┌───┴────┬─────────┬──────────┐
│        │         │          │
Query   Risk    Graph      Alert
Service Service Service   Service
```

## Authentication Model

### BFF Trusts Gateway Completely

- **No JWT validation in BFF**: BFF does not validate JWT tokens
- **Gateway handles authentication**: All authentication is done by Gateway
- **User context from headers**: BFF extracts user info from Gateway-injected headers

### Request Flow

1. **Login** (No authentication required)
   ```
   POST /api/v1/auth/login
   → BFF generates JWT token
   → Returns token to client
   ```

2. **Protected Endpoints** (Gateway authentication required)
   ```
   GET /api/v1/addresses/:address
   Headers:
     Authorization: Bearer <jwt>
     
   → Gateway validates JWT
   → Gateway adds headers:
       X-User-Id: 1
       X-User-Username: admin
       X-User-Role: admin
   → BFF trusts these headers
   → BFF processes request with user context
   ```

## Gateway Headers

BFF expects these headers from Gateway for authenticated requests:

- `X-User-Id`: User ID
- `X-User-Username`: Username
- `X-User-Role`: User role (admin, user, etc.)

**All three headers are required**. If any header is missing, BFF returns 401 Unauthorized.

## Guards

### GatewayAuthGuard

The only authentication guard used in BFF:

```typescript
@UseGuards(GatewayAuthGuard)
```

This guard:
- Checks for Gateway headers (`X-User-*`)
- Throws `UnauthorizedException` if headers are missing
- Attaches user info to `request.user`

**No JWT validation** - BFF completely trusts Gateway.

## Configuration

### Environment Variables

```bash
PORT=3001
JWT_SECRET=your-secret-key  # Only for generating tokens, not validation
```

### JWT Configuration

JWT configuration in `configs/config.yaml` is **only for generating tokens** during login:

```yaml
jwt:
  secret: your-super-secret-key-change-in-production
  expiresIn: 1d
```

BFF does **not** use this for validating tokens. Gateway handles all validation.

## Running

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Documentation

Swagger UI available at: `http://localhost:3001/docs`

## Security Considerations

### Why Trust Gateway?

1. **Network Isolation**: BFF should only be accessible from Gateway (internal network)
2. **Single Point of Authentication**: Centralized auth logic in Gateway
3. **Performance**: No duplicate JWT validation
4. **Simplicity**: BFF focuses on business logic, not authentication

### Production Deployment

- Deploy BFF in **private network** (not publicly accessible)
- Only Gateway should have access to BFF
- Use network policies/firewalls to enforce this
- Gateway and BFF must share the same JWT secret (for login token generation)

## Development vs Production

### Development Mode

For local development, you can:
- Access BFF directly (bypass Gateway) for debugging
- Use Swagger UI to test endpoints
- Manually add Gateway headers for testing

### Production Mode

- BFF is **not exposed** to public
- All requests **must** go through Gateway
- Gateway adds user context headers
- BFF validates presence of headers

## Modules

### 1. Authentication Module (`/api/v1/auth`)
- User login and JWT token generation
- User profile management

### 2. Address Module (`/api/v1/addresses`)
- Address information queries
- Transfer history
- Address statistics

### 3. Risk Module (`/api/v1/risk`)
- Risk score calculation
- Batch risk scoring
- Risk rules management

### 4. Graph Module (`/api/v1/graph`)
- Graph queries (proxied to Graph Service)
- Address clustering
- Tag propagation

### 5. Alert Module (`/api/v1/alerts`)
- Alert management
- Alert history
- Alert subscriptions

### 6. Transfer Module (`/api/v1/transfers`)
- Transfer queries
- Transfer history

### 7. **Orchestration Module** (`/api/v1/orchestration`)
- **Multi-service coordination**
- **Parallel API calls with fallback handling**
- **Aggregated responses**

### 8. WebSocket Module (`/ws`)
- Real-time notifications
- Live updates

## API Endpoints

### Public Endpoints (No Authentication)

- `POST /api/v1/auth/login` - User login

### Protected Endpoints (Gateway Authentication Required)

#### Address Endpoints
- `GET /api/v1/addresses/:address` - Get address info
- `GET /api/v1/addresses/:address/transfers` - Get transfers
- `GET /api/v1/addresses/:address/stats` - Get statistics

#### Risk Endpoints
- `POST /api/v1/risk/score` - Calculate risk score
- `POST /api/v1/risk/score/batch` - Batch risk scoring
- `GET /api/v1/risk/rules` - Get risk rules

#### Graph Endpoints
- `GET /api/v1/graph/addresses/:address` - Get graph node info
- `GET /api/v1/graph/addresses/:address/neighbors` - Get neighbors
- `POST /api/v1/graph/clustering/run` - Run clustering
- `POST /api/v1/graph/propagation/run` - Run tag propagation

#### Alert Endpoints
- `GET /api/v1/alerts` - List alerts
- `POST /api/v1/alerts` - Create alert
- `GET /api/v1/alerts/:id` - Get alert details

#### **Orchestration Endpoints** (Multi-Service Coordination)

- `GET /api/v1/orchestration/address-profile/:address` - Get comprehensive address profile
  - Aggregates: address info + risk score + recent transfers (parallel)

- `GET /api/v1/orchestration/address-analysis/:address` - Get full address analysis
  - Aggregates: address info + risk + graph data + neighbors + tags + cluster + alerts (parallel)

- `GET /api/v1/orchestration/connection/:fromAddress/:toAddress` - Find connection between addresses
  - Finds shortest path + enriches with risk scores

- `GET /api/v1/orchestration/high-risk-network` - Get high-risk network
  - Returns addresses above risk threshold

## Orchestration Module Details

The orchestration module coordinates multiple backend services to provide aggregated responses with improved performance through parallel execution.

### Features

- **Parallel Execution**: Calls multiple services simultaneously using `Promise.all()`
- **Partial Failure Handling**: Returns partial results if some services fail
- **Fallback Values**: Provides default values when services are unavailable
- **Error Resilience**: Continues execution even if individual services fail
- **Performance**: Reduces total latency by parallelizing independent calls

### Example: Address Profile

```typescript
// Single endpoint that aggregates 3 services in parallel
GET /api/v1/orchestration/address-profile/0x742d35Cc...

// Internally calls (in parallel):
// 1. Query Service: GET /api/v1/addresses/0x742d35Cc...
// 2. Risk ML Service: POST /api/v1/risk/score
// 3. Query Service: GET /api/v1/addresses/0x742d35Cc.../transfers

// Response:
{
  "address": "0x742d35Cc...",
  "network": "ethereum",
  "addressInfo": { /* from Query Service */ },
  "riskScore": { /* from Risk ML Service */ },
  "recentTransfers": { /* from Query Service */ },
  "orchestratedAt": 1706612345678
}
```

### Example: Address Analysis

```typescript
// Comprehensive analysis aggregating 7 parallel calls
GET /api/v1/orchestration/address-analysis/0x742d35Cc...?neighborDepth=2&neighborLimit=20

// Internally calls (in parallel):
// 1. Query Service: address info
// 2. Risk ML Service: risk score
// 3. Graph Service: graph node info
// 4. Graph Service: neighbors
// 5. Graph Service: tags
// 6. Graph Service: cluster info
// 7. Alert Service: alert history

// Response:
{
  "address": "0x742d35Cc...",
  "network": "ethereum",
  "basic": {
    "addressInfo": { /* ... */ },
    "riskScore": { /* ... */ }
  },
  "graph": {
    "graphInfo": { /* ... */ },
    "neighbors": [ /* ... */ ],
    "tags": ["Exchange", "High Volume"],
    "cluster": { /* ... */ }
  },
  "alerts": {
    "data": [ /* ... */ ],
    "total": 5
  },
  "orchestratedAt": 1706612345678
}
```

### Partial Failure Example

If Graph Service is down but other services are healthy:

```json
{
  "address": "0x742d35Cc...",
  "basic": {
    "addressInfo": { /* success */ },
    "riskScore": { /* success */ }
  },
  "graph": {
    "graphInfo": { "error": "Graph info unavailable" },
    "neighbors": { "error": "Neighbors unavailable" },
    "tags": [],
    "cluster": { "error": "Cluster info unavailable" }
  },
  "alerts": { /* success */ }
}
```

### Performance Benefits

| Approach | Latency | Description |
|----------|---------|-------------|
| **Sequential** | 500ms + 300ms + 200ms = **1000ms** | Call services one by one |
| **Parallel (Orchestration)** | max(500ms, 300ms, 200ms) = **500ms** | Call all services simultaneously |

**Improvement**: ~50% latency reduction for multi-service operations

## Testing

### With Gateway (Recommended)

```bash
# Login through Gateway
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Access protected endpoint through Gateway
curl http://localhost:8080/api/v1/addresses/0x123... \
  -H "Authorization: Bearer <token>"
```

### Direct BFF Access (Development Only)

```bash
# Manually add Gateway headers
curl http://localhost:3001/api/v1/addresses/0x123... \
  -H "X-User-Id: 1" \
  -H "X-User-Username: admin" \
  -H "X-User-Role: admin"
```

## Migration from JWT to Gateway Trust

### What Changed

- ✅ Removed `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`
- ✅ Removed `JwtStrategy` and `JwtAuthGuard`
- ✅ Simplified `GatewayAuthGuard` to only check headers
- ✅ All controllers now use only `GatewayAuthGuard`
- ✅ Auth service still generates JWT (for login response)

### What Stayed

- ✅ JWT secret configuration (for token generation)
- ✅ Login endpoint functionality
- ✅ User context in request handlers
- ✅ API structure and responses
