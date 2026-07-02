# API Gateway Pattern Example

Comprehensive API Gateway demonstrating all key patterns for microservices.

## Features

| Feature             | Description                              |
| ------------------- | ---------------------------------------- |
| **Routing**         | Path-based routing to backend services   |
| **Authentication**  | JWT token validation                     |
| **Rate Limiting**   | Global + per-service limits              |
| **Circuit Breaker** | Fault tolerance for failing services     |
| **Request Logging** | Structured JSON logging with request IDs |
| **Health Check**    | Gateway health endpoint                  |

## Services

```
┌─────────────────────────────────────────────────────┐
│                  API Gateway (:3000)                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────┐  │
│  │  Auth   │ │  Rate   │ │ Circuit │ │  Proxy   │  │
│  │  JWT    │ │ Limiter │ │ Breaker │ │  Router  │  │
│  └─────────┘ └─────────┘ └─────────┘ └──────────┘  │
└─────────────────┬───────────────┬──────────────────┘
                  │               │
        ┌─────────┴───┐     ┌─────┴─────────┐
        ▼             ▼     ▼               ▼
   ┌─────────┐   ┌─────────┐   ┌─────────────┐
   │  User   │   │  Order  │   │   Product   │
   │ Service │   │ Service │   │   Service   │
   │ (:3001) │   │ (:3002) │   │   (:3003)   │
   └─────────┘   └─────────┘   └─────────────┘
       🔓            🔒              🔓
```

## Run

```bash
# Terminal 1 - User Service
cd user-service && npm install && npm run dev

# Terminal 2 - Order Service
cd order-service && npm install && npm run dev

# Terminal 3 - Gateway
cd gateway && npm install && npm run dev
```

## Test Examples

### 1. Health Check

```bash
curl http://localhost:3000/health
```

### 2. Public Endpoints (No Auth Required)

```bash
# Users - public
curl http://localhost:3000/api/users
curl http://localhost:3000/api/users/1
```

### 3. Get JWT Token

```bash
# Login to get token
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"password123"}'
```

### 4. Protected Endpoints (Auth Required)

```bash
# Save token from login response
TOKEN="eyJhbGciOiJIUzI1NiIs..."

# Orders - protected (requires token)
curl http://localhost:3000/api/orders \
  -H "Authorization: Bearer $TOKEN"

curl http://localhost:3000/api/orders/1 \
  -H "Authorization: Bearer $TOKEN"
```

### 5. Test Rate Limiting

```bash
# Hit rate limit (100 req/min global, 50 req/min for orders)
for i in {1..110}; do curl -s http://localhost:3000/api/users; done
```

### 6. Test Circuit Breaker

```bash
# Stop a service, gateway will return 503 after 5 failures
# Then restart service, circuit resets automatically
```

## Gateway Patterns Demonstrated

### 1. Service Registry

```typescript
const services = {
  '/api/users': { target: 'http://localhost:3001', auth: false },
  '/api/orders': { target: 'http://localhost:3002', auth: true },
};
```

### 2. JWT Authentication

```typescript
// Token validated at gateway, user info forwarded via headers
req.headers['x-user-id'] = decoded.userId;
req.headers['x-user-role'] = decoded.role;
```

### 3. Circuit Breaker

```typescript
// Opens after 5 failures, auto-resets after 30s timeout
if (circuitBreaker.isOpen(service)) {
  return res.status(503).json({ error: 'Service unavailable' });
}
```

### 4. Rate Limiting

```typescript
// Global: 100 req/min, Per-service: configurable
const limiter = rateLimit({ windowMs: 60000, max: 100 });
```

## Key Points

- **Single Entry Point**: All clients go through gateway on port 3000
- **Security**: Services not exposed publicly, auth at edge
- **Resilience**: Circuit breaker prevents cascade failures
- **Observability**: Structured logging with request tracing
- **Scalability**: Easy to add new services to registry
