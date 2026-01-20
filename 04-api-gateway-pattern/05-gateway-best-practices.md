# Lesson 4.5: API Gateway Best Practices

## Introduction

This lesson covers best practices for designing, implementing, and operating API Gateways in production microservices environments.

---

## Design Best Practices

### 1. Keep the Gateway Thin

The gateway should handle cross-cutting concerns only, not business logic.

**Do:**

- Authentication/Authorization
- Rate limiting
- Request routing
- Logging and monitoring
- Protocol translation

**Don't:**

- Business logic
- Data transformation beyond simple mapping
- Complex orchestration
- Database access

---

### 2. Use Correlation IDs

Add a unique ID to every request for distributed tracing.

```typescript
app.use((req, res, next) => {
  req.headers['x-correlation-id'] = req.headers['x-correlation-id'] || generateUUID();
  res.setHeader('x-correlation-id', req.headers['x-correlation-id']);
  next();
});
```

---

### 3. Implement Circuit Breakers

Prevent cascading failures when services are down.

- Open circuit after N failures
- Return fast failure instead of waiting
- Periodically test if service recovered

---

### 4. Version Your APIs

Support multiple API versions for backward compatibility.

```
/api/v1/users  → User Service v1
/api/v2/users  → User Service v2
```

---

## Security Best Practices

### 1. Validate All Input

Never trust client input. Validate at the gateway.

### 2. Use HTTPS Everywhere

Terminate SSL at the gateway, use internal TLS or private network.

### 3. Implement Rate Limiting

Protect against abuse and DDoS attacks.

### 4. Don't Expose Internal Details

Hide service names, internal IPs, and stack traces from clients.

---

## Operational Best Practices

### 1. Health Checks

Implement health endpoints for load balancers.

```typescript
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});
```

### 2. Graceful Shutdown

Handle SIGTERM properly for zero-downtime deployments.

### 3. Centralized Logging

Log all requests with correlation IDs for debugging.

### 4. Monitor Key Metrics

- Request rate
- Error rate (4xx, 5xx)
- Latency (p50, p95, p99)
- Circuit breaker state

---

## Common Anti-Patterns

1. **Fat Gateway** - Too much business logic in gateway
2. **Single Point of Failure** - No redundancy
3. **No Timeouts** - Requests hang forever
4. **Ignoring Errors** - Swallowing upstream errors
5. **No Rate Limiting** - Vulnerable to abuse

---

## Key Takeaways

1. Keep gateway thin - cross-cutting concerns only
2. Use correlation IDs for tracing
3. Implement circuit breakers
4. Secure with HTTPS, rate limiting, input validation
5. Monitor and log everything
6. Plan for failure with health checks and graceful shutdown

---

## Module Summary

In this module, you learned:

- What an API Gateway is and why it's needed
- Key responsibilities of a gateway
- How to build a custom gateway with Express
- The BFF pattern for client-specific APIs
- Best practices for production gateways

---

## What's Next?

In the next module, we will explore Service Discovery patterns for dynamic service location.

---
