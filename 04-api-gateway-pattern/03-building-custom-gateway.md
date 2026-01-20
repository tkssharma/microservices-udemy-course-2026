# Lesson 4.3: Building a Custom API Gateway with Express

## Introduction

While production systems often use established API Gateway solutions like Kong or AWS API Gateway, building a custom gateway helps you understand the concepts deeply. This lesson walks through building a fully functional API Gateway using Express and TypeScript.

---

## Project Structure

```
api-gateway/
├── src/
│   ├── index.ts
│   ├── config/
│   │   └── routes.config.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── rate-limit.middleware.ts
│   │   ├── logging.middleware.ts
│   │   └── error.middleware.ts
│   ├── proxy/
│   │   └── proxy.service.ts
│   ├── services/
│   │   └── circuit-breaker.ts
│   └── types/
│       └── index.ts
├── package.json
└── tsconfig.json
```

---

## Setup

### package.json

```json
{
  "name": "api-gateway",
  "version": "1.0.0",
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "http-proxy-middleware": "^2.0.6",
    "jsonwebtoken": "^9.0.0",
    "helmet": "^7.0.0",
    "cors": "^2.8.5",
    "express-rate-limit": "^7.1.0",
    "ioredis": "^5.3.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.17",
    "@types/jsonwebtoken": "^9.0.2",
    "@types/cors": "^2.8.13",
    "@types/uuid": "^9.0.2",
    "typescript": "^5.0.0",
    "ts-node-dev": "^2.0.0"
  }
}
```

---

## Route Configuration

```typescript
// src/config/routes.config.ts
export interface RouteConfig {
  path: string;
  target: string;
  auth: boolean;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  methods?: string[];
}

export const routes: RouteConfig[] = [
  {
    path: '/api/users',
    target: process.env.USER_SERVICE_URL || 'http://localhost:3001',
    auth: true,
    rateLimit: { windowMs: 60000, max: 100 },
  },
  {
    path: '/api/products',
    target: process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002',
    auth: false,
    rateLimit: { windowMs: 60000, max: 200 },
  },
  {
    path: '/api/orders',
    target: process.env.ORDER_SERVICE_URL || 'http://localhost:3003',
    auth: true,
    rateLimit: { windowMs: 60000, max: 50 },
  },
  {
    path: '/api/payments',
    target: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3004',
    auth: true,
    rateLimit: { windowMs: 60000, max: 20 },
    methods: ['POST'],
  },
  {
    path: '/api/auth',
    target: process.env.AUTH_SERVICE_URL || 'http://localhost:3005',
    auth: false,
    rateLimit: { windowMs: 60000, max: 10 },
  },
];
```

---

## Main Application

```typescript
// src/index.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

import { routes } from './config/routes.config';
import { authMiddleware } from './middleware/auth.middleware';
import { createRateLimiter } from './middleware/rate-limit.middleware';
import { loggingMiddleware } from './middleware/logging.middleware';
import { errorMiddleware } from './middleware/error.middleware';
import { createProxy } from './proxy/proxy.service';

const app = express();

// Security middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
  }),
);

// Add correlation ID to all requests
app.use((req, res, next) => {
  req.headers['x-correlation-id'] = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('x-correlation-id', req.headers['x-correlation-id']);
  next();
});

// Request logging
app.use(loggingMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Setup routes with middleware
routes.forEach((route) => {
  const middlewares: express.RequestHandler[] = [];

  // Rate limiting
  if (route.rateLimit) {
    middlewares.push(createRateLimiter(route.rateLimit));
  }

  // Authentication
  if (route.auth) {
    middlewares.push(authMiddleware);
  }

  // Create proxy for this route
  const proxy = createProxy(route.target, route.path);

  // Apply route with middlewares
  if (route.methods) {
    route.methods.forEach((method) => {
      (app as any)[method.toLowerCase()](`${route.path}/*`, ...middlewares, proxy);
    });
  } else {
    app.use(route.path, ...middlewares, proxy);
  }

  console.log(`Route configured: ${route.path} → ${route.target}`);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Error handling
app.use(errorMiddleware);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});
```

---

## Proxy Service

```typescript
// src/proxy/proxy.service.ts
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { Request, Response, NextFunction } from 'express';
import { CircuitBreaker } from '../services/circuit-breaker';

const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(target: string): CircuitBreaker {
  if (!circuitBreakers.has(target)) {
    circuitBreakers.set(
      target,
      new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 30000,
      }),
    );
  }
  return circuitBreakers.get(target)!;
}

export function createProxy(target: string, path: string) {
  const circuitBreaker = getCircuitBreaker(target);

  const proxyOptions: Options = {
    target,
    changeOrigin: true,
    pathRewrite: {
      [`^${path}`]: '', // Remove the base path
    },
    onProxyReq: (proxyReq, req: Request) => {
      // Forward correlation ID
      if (req.headers['x-correlation-id']) {
        proxyReq.setHeader('x-correlation-id', req.headers['x-correlation-id']);
      }

      // Forward user context from auth middleware
      if ((req as any).user) {
        proxyReq.setHeader('x-user-id', (req as any).user.id);
        proxyReq.setHeader('x-user-role', (req as any).user.role);
      }

      // Log outgoing request
      console.log(`Proxying: ${req.method} ${req.path} → ${target}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      // Record success for circuit breaker
      circuitBreaker.recordSuccess();

      // Add gateway headers
      proxyRes.headers['x-gateway'] = 'api-gateway';
    },
    onError: (err, req, res) => {
      // Record failure for circuit breaker
      circuitBreaker.recordFailure();

      console.error(`Proxy error for ${target}:`, err.message);

      (res as Response).status(502).json({
        error: {
          code: 'BAD_GATEWAY',
          message: 'Service temporarily unavailable',
          service: path,
        },
      });
    },
  };

  const proxy = createProxyMiddleware(proxyOptions);

  // Wrap with circuit breaker
  return (req: Request, res: Response, next: NextFunction) => {
    if (!circuitBreaker.isAvailable()) {
      return res.status(503).json({
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service is temporarily unavailable (circuit open)',
          service: path,
          retryAfter: circuitBreaker.getRetryAfter(),
        },
      });
    }

    proxy(req, res, next);
  };
}
```

---

## Authentication Middleware

```typescript
// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

interface JwtPayload {
  id: string;
  email: string;
  role: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get token from header
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authorization header required',
      },
    });
  }

  // Check Bearer format
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid authorization format. Use: Bearer <token>',
      },
    });
  }

  const token = parts[1];

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Attach user to request
    req.user = decoded;

    // Log authenticated request
    console.log(`Authenticated: User ${decoded.id} (${decoded.role})`);

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired',
        },
      });
    }

    return res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid token',
      },
    });
  }
}

// Optional: Role-based authorization
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: `Required role: ${roles.join(' or ')}`,
        },
      });
    }

    next();
  };
}
```

---

## Rate Limiting Middleware

```typescript
// src/middleware/rate-limit.middleware.ts
import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export function createRateLimiter(config: RateLimitConfig) {
  return rateLimit({
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Rate limit by user ID if authenticated, otherwise by IP
      if ((req as any).user?.id) {
        return `user:${(req as any).user.id}`;
      }
      return req.ip || 'unknown';
    },
    handler: (req: Request, res: Response) => {
      res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
          retryAfter: Math.ceil(config.windowMs / 1000),
        },
      });
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    },
  });
}
```

---

## Logging Middleware

```typescript
// src/middleware/logging.middleware.ts
import { Request, Response, NextFunction } from 'express';

interface RequestLog {
  timestamp: string;
  correlationId: string;
  method: string;
  path: string;
  query: object;
  ip: string;
  userAgent: string;
  userId?: string;
  responseStatus?: number;
  responseTime?: number;
}

export function loggingMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Log request
  const log: RequestLog = {
    timestamp: new Date().toISOString(),
    correlationId: req.headers['x-correlation-id'] as string,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip || 'unknown',
    userAgent: req.headers['user-agent'] || 'unknown',
  };

  // Capture response
  res.on('finish', () => {
    log.responseStatus = res.statusCode;
    log.responseTime = Date.now() - startTime;
    log.userId = (req as any).user?.id;

    // Log based on status
    if (res.statusCode >= 500) {
      console.error('REQUEST_ERROR:', JSON.stringify(log));
    } else if (res.statusCode >= 400) {
      console.warn('REQUEST_WARN:', JSON.stringify(log));
    } else {
      console.log('REQUEST:', JSON.stringify(log));
    }
  });

  next();
}
```

---

## Circuit Breaker

```typescript
// src/services/circuit-breaker.ts
enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  halfOpenRequests?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenRequests: number = 0;

  constructor(private config: CircuitBreakerConfig) {}

  isAvailable(): boolean {
    if (this.state === CircuitState.CLOSED) {
      return true;
    }

    if (this.state === CircuitState.OPEN) {
      // Check if reset timeout has passed
      if (Date.now() - this.lastFailureTime >= this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenRequests = 0;
        console.log('Circuit breaker: OPEN → HALF_OPEN');
        return true;
      }
      return false;
    }

    // HALF_OPEN: Allow limited requests
    if (this.halfOpenRequests < (this.config.halfOpenRequests || 3)) {
      this.halfOpenRequests++;
      return true;
    }

    return false;
  }

  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= (this.config.halfOpenRequests || 3)) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        console.log('Circuit breaker: HALF_OPEN → CLOSED');
      }
    } else {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      console.log('Circuit breaker: HALF_OPEN → OPEN');
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.log('Circuit breaker: CLOSED → OPEN');
    }
  }

  getRetryAfter(): number {
    if (this.state === CircuitState.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      return Math.ceil((this.config.resetTimeout - elapsed) / 1000);
    }
    return 0;
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

---

## Error Middleware

```typescript
// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';

export function errorMiddleware(error: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Unhandled error:', {
    message: error.message,
    stack: error.stack,
    correlationId: req.headers['x-correlation-id'],
    path: req.path,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      correlationId: req.headers['x-correlation-id'],
    },
  });
}
```

---

## Response Aggregation Example

```typescript
// src/routes/aggregation.routes.ts
import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// Aggregate dashboard data from multiple services
router.get('/dashboard', async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  const correlationId = req.headers['x-correlation-id'];

  const headers = {
    'x-correlation-id': correlationId,
    'x-user-id': userId,
  };

  try {
    // Make parallel requests to multiple services
    const [userRes, ordersRes, notificationsRes] = await Promise.allSettled([
      axios.get(`${process.env.USER_SERVICE_URL}/users/${userId}`, { headers }),
      axios.get(`${process.env.ORDER_SERVICE_URL}/orders?userId=${userId}&limit=5`, { headers }),
      axios.get(`${process.env.NOTIFICATION_SERVICE_URL}/notifications?userId=${userId}&unread=true`, { headers }),
    ]);

    // Aggregate responses
    const dashboard = {
      user: userRes.status === 'fulfilled' ? userRes.value.data : null,
      recentOrders: ordersRes.status === 'fulfilled' ? ordersRes.value.data : [],
      notifications: notificationsRes.status === 'fulfilled' ? notificationsRes.value.data : [],
      errors: [] as string[],
    };

    // Track partial failures
    if (userRes.status === 'rejected') {
      dashboard.errors.push('Failed to fetch user data');
    }
    if (ordersRes.status === 'rejected') {
      dashboard.errors.push('Failed to fetch orders');
    }
    if (notificationsRes.status === 'rejected') {
      dashboard.errors.push('Failed to fetch notifications');
    }

    res.json(dashboard);
  } catch (error) {
    console.error('Dashboard aggregation error:', error);
    res.status(500).json({
      error: {
        code: 'AGGREGATION_ERROR',
        message: 'Failed to aggregate dashboard data',
      },
    });
  }
});

export { router as aggregationRoutes };
```

---

## Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  api-gateway:
    build: ./api-gateway
    ports:
      - '8080:8080'
    environment:
      - PORT=8080
      - JWT_SECRET=your-secret-key
      - USER_SERVICE_URL=http://user-service:3001
      - PRODUCT_SERVICE_URL=http://product-service:3002
      - ORDER_SERVICE_URL=http://order-service:3003
      - PAYMENT_SERVICE_URL=http://payment-service:3004
    depends_on:
      - user-service
      - product-service
      - order-service

  user-service:
    build: ./user-service
    ports:
      - '3001:3001'

  product-service:
    build: ./product-service
    ports:
      - '3002:3002'

  order-service:
    build: ./order-service
    ports:
      - '3003:3003'
```

---

## Testing the Gateway

```bash
# Health check
curl http://localhost:8080/health

# Public endpoint (no auth)
curl http://localhost:8080/api/products

# Protected endpoint (requires auth)
curl http://localhost:8080/api/orders \
  -H "Authorization: Bearer <your-jwt-token>"

# Test rate limiting
for i in {1..20}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/products
done
```

---

## Key Takeaways

1. **Express + http-proxy-middleware** makes building a gateway straightforward
2. **Middleware chain** handles cross-cutting concerns cleanly
3. **Circuit breaker** prevents cascading failures
4. **Correlation IDs** enable distributed tracing
5. **Rate limiting** protects backend services
6. **Response aggregation** reduces client round trips

---

## What's Next?

In the next lesson, we will explore the Backend for Frontend (BFF) pattern for optimizing APIs for different client types.

---
