# Gateway Service

API Gateway for Chain Risk Platform using Spring Cloud Gateway.

## Features

- **JWT Authentication**: Validates JWT tokens and extracts user information
- **Request Routing**: Routes requests to BFF service
- **User Context Injection**: Adds user headers (X-User-Id, X-User-Username, X-User-Role) to downstream requests
- **Request Logging**: Logs all incoming/outgoing requests
- **CORS Support**: Configurable CORS settings
- **Health Checks**: Actuator endpoints for monitoring

## Architecture

```
Client → Gateway (Port 8080) → BFF (Port 3001) → Backend Services
         [JWT Auth]             [User Headers]
```

## User Context Headers

Gateway adds the following headers to authenticated requests:

- `X-User-Id`: User ID extracted from JWT
- `X-User-Username`: Username extracted from JWT  
- `X-User-Role`: User role extracted from JWT

BFF services can use these headers to identify the requesting user without re-validating JWT.

## Configuration

Key configuration in `application.yml`:

- `server.port`: Gateway port (default: 8080)
- `jwt.secret`: JWT secret key for validation
- `spring.cloud.gateway.routes`: Route definitions

## Routes

- `/api/v1/auth/**` → BFF (no authentication)
- `/api/v1/addresses/**` → BFF (authentication required)
- `/api/v1/risk/**` → BFF (authentication required)

## Running

```bash
# Build
mvn clean package

# Run
java -jar target/gateway-0.1.0.jar

# Or with Maven
mvn spring-boot:run
```

## Testing

```bash
# Health check
curl http://localhost:8080/actuator/health

# Login (no auth required)
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Get address info (auth required)
curl http://localhost:8080/api/v1/addresses/0x123... \
  -H "Authorization: Bearer <token>"
```

## Development

Gateway is stateless and can be scaled horizontally.

For local development, ensure:
1. BFF service is running on port 3001
2. JWT secret matches BFF configuration
