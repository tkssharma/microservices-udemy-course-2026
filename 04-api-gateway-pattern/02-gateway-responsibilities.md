# Lesson 4.2: Gateway Responsibilities

## Introduction

An API Gateway handles many cross-cutting concerns that would otherwise need to be implemented in every microservice. This lesson covers the key responsibilities of an API Gateway.

---

## Core Responsibilities Overview

```
┌─────────────────────────────────────────────────────────────┐
│              API GATEWAY RESPONSIBILITIES                    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    API GATEWAY                       │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                                                      │   │
│  │  1. Request Routing                                 │   │
│  │  2. Authentication & Authorization                  │   │
│  │  3. Rate Limiting & Throttling                      │   │
│  │  4. Request/Response Transformation                 │   │
│  │  5. Response Aggregation                            │   │
│  │  6. Caching                                         │   │
│  │  7. Load Balancing                                  │   │
│  │  8. Circuit Breaking                                │   │
│  │  9. Logging & Monitoring                            │   │
│  │  10. SSL Termination                                │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Request Routing

### What It Does

Routes incoming requests to the appropriate backend service based on URL path, headers, or other criteria.

```
┌─────────────────────────────────────────────────────────────┐
│                  REQUEST ROUTING                             │
│                                                              │
│  Incoming Request          Routed To                        │
│  ─────────────────         ─────────                        │
│  /api/users/*         →    User Service                     │
│  /api/products/*      →    Product Service                  │
│  /api/orders/*        →    Order Service                    │
│  /api/payments/*      →    Payment Service                  │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ GET /api/users/123                                  │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │              API GATEWAY                            │    │
│  │  Route: /api/users/* → http://user-service:3001    │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │ GET http://user-service:3001/users/123              │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Routing Strategies

```
┌─────────────────────────────────────────────────────────────┐
│                  ROUTING STRATEGIES                          │
│                                                              │
│  1. Path-Based Routing                                      │
│     /api/v1/users → User Service                            │
│     /api/v1/orders → Order Service                          │
│                                                              │
│  2. Header-Based Routing                                    │
│     X-API-Version: 2 → Service v2                           │
│     X-Client-Type: mobile → Mobile-optimized service        │
│                                                              │
│  3. Query Parameter Routing                                 │
│     ?version=2 → Service v2                                 │
│                                                              │
│  4. Host-Based Routing                                      │
│     api.example.com → API services                          │
│     admin.example.com → Admin services                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication & Authorization

### What It Does

Validates client identity and permissions before forwarding requests to backend services.

```
┌─────────────────────────────────────────────────────────────┐
│              AUTHENTICATION FLOW                             │
│                                                              │
│  ┌────────┐                    ┌─────────────┐             │
│  │ Client │─── Request ───────▶│ API Gateway │             │
│  │        │    + JWT Token     │             │             │
│  └────────┘                    └──────┬──────┘             │
│                                       │                     │
│                              ┌────────▼────────┐           │
│                              │ Validate Token  │           │
│                              │ Check Claims    │           │
│                              │ Verify Permissions          │
│                              └────────┬────────┘           │
│                                       │                     │
│                    ┌──────────────────┼──────────────────┐ │
│                    │                  │                  │ │
│                    ▼                  ▼                  ▼ │
│               ┌────────┐        ┌────────┐        ┌────────┐
│               │  401   │        │  403   │        │Forward │
│               │Unauth  │        │Forbidden│       │Request │
│               └────────┘        └────────┘        └────────┘
│                                                              │
│  Gateway adds user context to forwarded request:            │
│  X-User-Id: 123                                             │
│  X-User-Role: admin                                         │
│  X-User-Permissions: read,write                             │
└─────────────────────────────────────────────────────────────┘
```

### Auth Strategies

```
┌─────────────────────────────────────────────────────────────┐
│              AUTHENTICATION STRATEGIES                       │
│                                                              │
│  1. JWT Validation                                          │
│     • Gateway validates JWT signature                       │
│     • Extracts claims (user ID, roles)                      │
│     • Forwards user context to services                     │
│                                                              │
│  2. OAuth2 / OpenID Connect                                 │
│     • Gateway acts as OAuth2 resource server                │
│     • Validates access tokens with auth server              │
│                                                              │
│  3. API Key                                                 │
│     • Simple key-based authentication                       │
│     • Good for third-party integrations                     │
│                                                              │
│  4. mTLS (Mutual TLS)                                       │
│     • Certificate-based authentication                      │
│     • Used for service-to-service auth                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Rate Limiting & Throttling

### What It Does

Limits the number of requests a client can make in a given time period to protect backend services.

```
┌─────────────────────────────────────────────────────────────┐
│                  RATE LIMITING                               │
│                                                              │
│  Configuration:                                             │
│  ──────────────                                             │
│  Free tier:     100 requests/minute                         │
│  Pro tier:      1000 requests/minute                        │
│  Enterprise:    10000 requests/minute                       │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Request #101 from Free tier user                    │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │              API GATEWAY                            │    │
│  │  Check: 100/100 requests used                       │    │
│  │  Result: RATE LIMITED                               │    │
│  └────────────────────────────────────────────────────┘    │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 429 Too Many Requests                               │    │
│  │ Retry-After: 60                                     │    │
│  │ X-RateLimit-Limit: 100                              │    │
│  │ X-RateLimit-Remaining: 0                            │    │
│  │ X-RateLimit-Reset: 1642345678                       │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Rate Limiting Strategies

```
┌─────────────────────────────────────────────────────────────┐
│              RATE LIMITING STRATEGIES                        │
│                                                              │
│  1. Fixed Window                                            │
│     100 requests per minute, resets at minute boundary      │
│     Simple but can have burst at window edges               │
│                                                              │
│  2. Sliding Window                                          │
│     100 requests in any 60-second period                    │
│     Smoother but more complex                               │
│                                                              │
│  3. Token Bucket                                            │
│     Tokens added at fixed rate, consumed per request        │
│     Allows bursts up to bucket size                         │
│                                                              │
│  4. Leaky Bucket                                            │
│     Requests processed at fixed rate                        │
│     Excess requests queued or dropped                       │
│                                                              │
│  Rate Limit By:                                             │
│  • IP address                                               │
│  • API key                                                  │
│  • User ID                                                  │
│  • Endpoint                                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Request/Response Transformation

### What It Does

Modifies requests before forwarding and responses before returning to clients.

```
┌─────────────────────────────────────────────────────────────┐
│              REQUEST TRANSFORMATION                          │
│                                                              │
│  Client Request:                                            │
│  ───────────────                                            │
│  POST /api/orders                                           │
│  {                                                          │
│    "items": [...],                                          │
│    "shipping": "express"                                    │
│  }                                                          │
│                                                              │
│  Gateway Transforms:                                        │
│  ───────────────────                                        │
│  • Add correlation ID                                       │
│  • Add user context from JWT                                │
│  • Convert field names (camelCase → snake_case)             │
│  • Add timestamp                                            │
│                                                              │
│  Forwarded Request:                                         │
│  ──────────────────                                         │
│  POST http://order-service/orders                           │
│  X-Correlation-Id: abc-123                                  │
│  X-User-Id: user-456                                        │
│  {                                                          │
│    "items": [...],                                          │
│    "shipping_type": "express",                              │
│    "user_id": "user-456",                                   │
│    "created_at": "2024-01-15T10:30:00Z"                     │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

### Response Transformation

```
┌─────────────────────────────────────────────────────────────┐
│              RESPONSE TRANSFORMATION                         │
│                                                              │
│  Service Response:                                          │
│  ─────────────────                                          │
│  {                                                          │
│    "order_id": "ord-123",                                   │
│    "user_id": "user-456",                                   │
│    "internal_status_code": 1,                               │
│    "database_created_at": "2024-01-15T10:30:00Z"            │
│  }                                                          │
│                                                              │
│  Gateway Transforms:                                        │
│  ───────────────────                                        │
│  • Remove internal fields                                   │
│  • Convert field names (snake_case → camelCase)             │
│  • Map status codes to human-readable                       │
│                                                              │
│  Client Response:                                           │
│  ────────────────                                           │
│  {                                                          │
│    "orderId": "ord-123",                                    │
│    "status": "pending",                                     │
│    "createdAt": "2024-01-15T10:30:00Z"                      │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Response Aggregation

### What It Does

Combines responses from multiple services into a single response for the client.

```
┌─────────────────────────────────────────────────────────────┐
│              RESPONSE AGGREGATION                            │
│                                                              │
│  Client Request:                                            │
│  GET /api/dashboard                                         │
│                                                              │
│  Without Aggregation:                                       │
│  ────────────────────                                       │
│  Client makes 4 separate requests:                          │
│  • GET /api/users/me                                        │
│  • GET /api/orders/recent                                   │
│  • GET /api/notifications                                   │
│  • GET /api/recommendations                                 │
│                                                              │
│  With Aggregation:                                          │
│  ─────────────────                                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │              API GATEWAY                            │    │
│  │                                                      │    │
│  │  Parallel calls:                                    │    │
│  │  ├──▶ User Service                                  │    │
│  │  ├──▶ Order Service                                 │    │
│  │  ├──▶ Notification Service                          │    │
│  │  └──▶ Recommendation Service                        │    │
│  │                                                      │    │
│  │  Aggregate responses into single response           │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Single Response:                                           │
│  {                                                          │
│    "user": { ... },                                         │
│    "recentOrders": [ ... ],                                 │
│    "notifications": [ ... ],                                │
│    "recommendations": [ ... ]                               │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Caching

### What It Does

Caches responses to reduce load on backend services and improve response times.

```
┌─────────────────────────────────────────────────────────────┐
│                      CACHING                                 │
│                                                              │
│  Request Flow with Cache:                                   │
│  ────────────────────────                                   │
│                                                              │
│  ┌────────┐     ┌─────────────┐     ┌─────────────┐        │
│  │ Client │────▶│ API Gateway │────▶│   Cache     │        │
│  └────────┘     └──────┬──────┘     └──────┬──────┘        │
│                        │                    │               │
│                        │    Cache HIT       │               │
│                        │◀───────────────────┘               │
│                        │                                    │
│                        │    Cache MISS                      │
│                        ▼                                    │
│                 ┌─────────────┐                             │
│                 │   Service   │                             │
│                 └──────┬──────┘                             │
│                        │                                    │
│                        │ Response + Cache                   │
│                        ▼                                    │
│                 ┌─────────────┐                             │
│                 │   Cache     │                             │
│                 │   (store)   │                             │
│                 └─────────────┘                             │
│                                                              │
│  Cache Strategies:                                          │
│  • Cache-Control headers                                    │
│  • TTL-based expiration                                     │
│  • Cache invalidation on updates                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Load Balancing

### What It Does

Distributes requests across multiple instances of a service.

```
┌─────────────────────────────────────────────────────────────┐
│                  LOAD BALANCING                              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              API GATEWAY                            │    │
│  │                                                      │    │
│  │  Load Balancer for User Service:                    │    │
│  │  ┌────────────────────────────────────────────┐    │    │
│  │  │ Instance 1: user-service-1:3001 (healthy)  │    │    │
│  │  │ Instance 2: user-service-2:3001 (healthy)  │    │    │
│  │  │ Instance 3: user-service-3:3001 (unhealthy)│    │    │
│  │  └────────────────────────────────────────────┘    │    │
│  │                                                      │    │
│  │  Algorithm: Round Robin (skip unhealthy)            │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Request 1 → Instance 1                                     │
│  Request 2 → Instance 2                                     │
│  Request 3 → Instance 1 (skip 3, unhealthy)                │
│  Request 4 → Instance 2                                     │
│                                                              │
│  Algorithms:                                                │
│  • Round Robin                                              │
│  • Least Connections                                        │
│  • Weighted                                                 │
│  • IP Hash (sticky sessions)                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Circuit Breaking

### What It Does

Prevents cascading failures by stopping requests to failing services.

```
┌─────────────────────────────────────────────────────────────┐
│                  CIRCUIT BREAKER                             │
│                                                              │
│  States:                                                    │
│  ───────                                                    │
│                                                              │
│  ┌────────┐    failures    ┌────────┐    timeout   ┌──────┐│
│  │ CLOSED │ ─────────────▶ │  OPEN  │ ───────────▶ │ HALF ││
│  │        │                │        │              │ OPEN ││
│  └────────┘                └────────┘              └──────┘│
│       ▲                         │                      │   │
│       │                         │                      │   │
│       │         success         │      failure         │   │
│       └─────────────────────────┴──────────────────────┘   │
│                                                              │
│  CLOSED: Normal operation, requests pass through            │
│  OPEN: Service failing, return error immediately            │
│  HALF-OPEN: Test with limited requests                      │
│                                                              │
│  Example:                                                   │
│  • 5 failures in 10 seconds → OPEN                         │
│  • Wait 30 seconds → HALF-OPEN                             │
│  • 3 successes → CLOSED                                    │
│  • 1 failure → OPEN again                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Logging & Monitoring

### What It Does

Logs all requests and responses for debugging, auditing, and monitoring.

```
┌─────────────────────────────────────────────────────────────┐
│              LOGGING & MONITORING                            │
│                                                              │
│  Request Log Entry:                                         │
│  ──────────────────                                         │
│  {                                                          │
│    "timestamp": "2024-01-15T10:30:00.123Z",                 │
│    "correlationId": "abc-123",                              │
│    "method": "POST",                                        │
│    "path": "/api/orders",                                   │
│    "clientIp": "192.168.1.100",                             │
│    "userId": "user-456",                                    │
│    "userAgent": "Mozilla/5.0...",                           │
│    "requestSize": 1024,                                     │
│    "responseStatus": 201,                                   │
│    "responseTime": 145,                                     │
│    "upstreamService": "order-service",                      │
│    "upstreamLatency": 120                                   │
│  }                                                          │
│                                                              │
│  Metrics to Track:                                          │
│  ─────────────────                                          │
│  • Request rate (requests/second)                           │
│  • Error rate (4xx, 5xx)                                    │
│  • Latency (p50, p95, p99)                                  │
│  • Upstream service health                                  │
│  • Rate limit hits                                          │
│  • Cache hit ratio                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. SSL Termination

### What It Does

Handles HTTPS encryption/decryption at the gateway, so backend services can use plain HTTP.

```
┌─────────────────────────────────────────────────────────────┐
│                  SSL TERMINATION                             │
│                                                              │
│  ┌────────┐  HTTPS   ┌─────────────┐  HTTP   ┌───────────┐ │
│  │ Client │ ───────▶ │ API Gateway │ ──────▶ │  Service  │ │
│  └────────┘  (TLS)   │ (terminates │ (plain) └───────────┘ │
│                      │    SSL)     │                        │
│                      └─────────────┘                        │
│                                                              │
│  Benefits:                                                  │
│  ─────────                                                  │
│  • Centralized certificate management                       │
│  • Reduced CPU load on services                             │
│  • Simplified service configuration                         │
│  • Single point for SSL updates                             │
│                                                              │
│  Security Note:                                             │
│  ──────────────                                             │
│  Internal traffic should still be secured:                  │
│  • Use mTLS between gateway and services                    │
│  • Or use private network (VPC)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Responsibility Summary

| Responsibility   | Purpose                     | Example               |
| ---------------- | --------------------------- | --------------------- |
| Routing          | Direct requests to services | /users → User Service |
| Authentication   | Verify identity             | JWT validation        |
| Authorization    | Check permissions           | Role-based access     |
| Rate Limiting    | Protect services            | 100 req/min           |
| Transformation   | Modify requests/responses   | Add headers           |
| Aggregation      | Combine responses           | Dashboard API         |
| Caching          | Improve performance         | Cache GET responses   |
| Load Balancing   | Distribute load             | Round robin           |
| Circuit Breaking | Prevent cascading failures  | Open after 5 failures |
| Logging          | Audit and debug             | Request logs          |
| SSL Termination  | Handle encryption           | HTTPS → HTTP          |

---

## Key Takeaways

1. **Gateway centralizes cross-cutting concerns** - Don't duplicate in every service
2. **Authentication at the edge** - Validate once, forward user context
3. **Rate limiting protects services** - Essential for public APIs
4. **Aggregation reduces client calls** - Better mobile experience
5. **Circuit breaking prevents cascading failures** - Fail fast
6. **Logging enables debugging** - Correlation IDs are essential

---

## What's Next?

In the next lesson, we will build a custom API Gateway using Express and TypeScript.

---
