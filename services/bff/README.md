# BFF (Backend for Frontend)

BFF service for Chain Risk Platform. This service completely trusts Gateway for authentication.

## Architecture

```
Frontend → Gateway (JWT Auth) → BFF (Trust Gateway) → Backend Services
                    ↓
              Add Headers:
              - X-User-Id
              - X-User-Username
              - X-User-Role
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

## Endpoints

### Public Endpoints (No Authentication)

- `POST /api/v1/auth/login` - User login

### Protected Endpoints (Gateway Authentication Required)

- `GET /api/v1/auth/profile` - Get user profile
- `GET /api/v1/addresses/:address` - Get address info
- `GET /api/v1/addresses/:address/transfers` - Get transfers
- `GET /api/v1/addresses/:address/stats` - Get statistics
- `POST /api/v1/risk/score` - Calculate risk score
- `POST /api/v1/risk/score/batch` - Batch risk scoring
- `GET /api/v1/risk/rules` - Get risk rules

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
