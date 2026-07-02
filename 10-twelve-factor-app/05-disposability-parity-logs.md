# Lesson 10.5: Disposability, Dev/Prod Parity & Logs

This lesson covers Factors IX, X, and XI—critical for building robust, observable microservices.

---

## Factor IX: Disposability

> **"Maximize robustness with fast startup and graceful shutdown"**

### The Principle

Processes should be **disposable**, meaning they can:
- Start up quickly (seconds, not minutes)
- Shut down gracefully when receiving SIGTERM
- Be robust against sudden death

This is critical for:
- Rapid elastic scaling
- Quick deployment of code or config changes
- Robustness in production

### Fast Startup

**Optimize Application Bootstrap**
```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const startTime = Date.now();
  
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'], // Reduce logging during startup
  });

  await app.listen(process.env.PORT || 3000);
  
  console.log(`Application started in ${Date.now() - startTime}ms`);
}

bootstrap();
```

**Lazy Loading Modules**
```typescript
// app.module.ts
import { Module } from '@nestjs/common';

@Module({
  imports: [
    // Lazy load heavy modules
    import('./reports/reports.module').then(m => m.ReportsModule),
  ],
})
export class AppModule {}
```

### Graceful Shutdown

**NestJS Shutdown Hooks**
```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable shutdown hooks
  app.enableShutdownHooks();
  
  await app.listen(3000);
}

bootstrap();
```

**Implementing OnModuleDestroy**
```typescript
// database.service.ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  async onModuleDestroy() {
    console.log('Closing database connections...');
    await this.pool.end();
    console.log('Database connections closed');
  }
}
```

**Complete Graceful Shutdown Example**
```typescript
// graceful-shutdown.service.ts
import { Injectable, OnModuleDestroy, OnApplicationShutdown } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class GracefulShutdownService implements OnModuleDestroy, OnApplicationShutdown {
  private isShuttingDown = false;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  isHealthy(): boolean {
    return !this.isShuttingDown;
  }

  async onModuleDestroy() {
    this.isShuttingDown = true;
    console.log('Module destroying, stopping new requests...');
  }

  async onApplicationShutdown(signal: string) {
    console.log(`Received shutdown signal: ${signal}`);
    
    // Wait for in-flight requests (give them 10 seconds)
    await this.waitForInflightRequests(10000);
    
    // Close Redis connection
    await this.redis.quit();
    
    console.log('Graceful shutdown complete');
  }

  private async waitForInflightRequests(timeout: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, timeout));
  }
}
```

**Health Check for Kubernetes**
```typescript
// health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { GracefulShutdownService } from './graceful-shutdown.service';

@Controller('health')
export class HealthController {
  constructor(private shutdownService: GracefulShutdownService) {}

  @Get('live')
  liveness() {
    return { status: 'ok' };
  }

  @Get('ready')
  readiness() {
    if (!this.shutdownService.isHealthy()) {
      throw new Error('Service is shutting down');
    }
    return { status: 'ready' };
  }
}
```

**Kubernetes Probe Configuration**
```yaml
# deployment.yaml
spec:
  containers:
    - name: order-service
      livenessProbe:
        httpGet:
          path: /health/live
          port: 3000
        initialDelaySeconds: 5
        periodSeconds: 10
      readinessProbe:
        httpGet:
          path: /health/ready
          port: 3000
        initialDelaySeconds: 5
        periodSeconds: 5
      lifecycle:
        preStop:
          exec:
            command: ["sleep", "5"]  # Allow time for deregistration
  terminationGracePeriodSeconds: 30
```

---

## Factor X: Dev/Prod Parity

> **"Keep development, staging, and production as similar as possible"**

### The Principle

Minimize gaps between environments:

| Gap | Traditional | 12-Factor |
|-----|-------------|-----------|
| **Time** | Weeks between deploys | Hours or minutes |
| **Personnel** | Devs write, ops deploy | Same person does both |
| **Tools** | Different backing services | Same services everywhere |

### Docker for Environment Parity

**docker-compose.yml for Development**
```yaml
version: '3.8'

services:
  order-service:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/orders
      - REDIS_URL=redis://redis:6379
      - RABBITMQ_URL=amqp://rabbitmq:5672
    depends_on:
      - postgres
      - redis
      - rabbitmq
    volumes:
      - .:/app
      - /app/node_modules

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: orders
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"
      - "15672:15672"

volumes:
  postgres_data:
```

### Avoid Environment-Specific Code

**❌ Anti-Pattern: Environment Branches**
```typescript
// DON'T DO THIS
if (process.env.NODE_ENV === 'development') {
  // Use SQLite
  database = new SQLiteAdapter();
} else {
  // Use PostgreSQL
  database = new PostgresAdapter();
}
```

**✅ Correct: Same Adapters, Different Config**
```typescript
// Always use the same database adapter
// Just change the connection string via environment
@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',  // Same in dev and prod
      url: process.env.DATABASE_URL,  // Different URL per environment
    }),
  ],
})
export class AppModule {}
```

### Feature Flags Instead of Branches

```typescript
// feature-flags.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FeatureFlagsService {
  constructor(private configService: ConfigService) {}

  isEnabled(feature: string): boolean {
    const flags = this.configService.get<string>('FEATURE_FLAGS') || '';
    return flags.split(',').includes(feature);
  }
}

// Usage
if (this.featureFlags.isEnabled('new-checkout-flow')) {
  return this.newCheckoutService.process(order);
} else {
  return this.legacyCheckoutService.process(order);
}
```

---

## Factor XI: Logs

> **"Treat logs as event streams"**

### The Principle

- App should NOT manage log files, rotation, or storage
- Write logs to **stdout** as a stream of events
- Let the execution environment capture and route logs

### Logging Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  App writes │ ──▶ │   stdout    │ ──▶ │Log Collector│
│  to stdout  │     │   stderr    │     │(Fluentd/etc)│
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    ▼                         ▼                         ▼
              ┌───────────┐            ┌───────────┐            ┌───────────┐
              │Elasticsearch           │  Datadog  │            │CloudWatch │
              └───────────┘            └───────────┘            └───────────┘
```

### Structured Logging with NestJS

**Install Pino Logger**
```bash
npm install nestjs-pino pino-http pino-pretty
```

**Configure Structured Logging**
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport: process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined, // JSON in production
        redact: ['req.headers.authorization', 'req.body.password'],
      },
    }),
  ],
})
export class AppModule {}
```

**Using the Logger**
```typescript
// orders.service.ts
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class OrdersService {
  constructor(
    @InjectPinoLogger(OrdersService.name)
    private readonly logger: PinoLogger,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    this.logger.info({ orderId: dto.id, userId: dto.userId }, 'Creating order');
    
    try {
      const order = await this.orderRepository.save(dto);
      this.logger.info({ orderId: order.id }, 'Order created successfully');
      return order;
    } catch (error) {
      this.logger.error({ error, dto }, 'Failed to create order');
      throw error;
    }
  }
}
```

**JSON Log Output (Production)**
```json
{"level":30,"time":1705312422000,"pid":1,"hostname":"order-service-abc123","context":"OrdersService","orderId":"ord_123","userId":"usr_456","msg":"Creating order"}
{"level":30,"time":1705312422050,"pid":1,"hostname":"order-service-abc123","context":"OrdersService","orderId":"ord_123","msg":"Order created successfully"}
```

### Request Correlation IDs

```typescript
// correlation.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    req['correlationId'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
  }
}
```

### Kubernetes Log Collection

```yaml
# fluentd-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluentd-config
data:
  fluent.conf: |
    <source>
      @type tail
      path /var/log/containers/*.log
      pos_file /var/log/fluentd-containers.log.pos
      tag kubernetes.*
      read_from_head true
      <parse>
        @type json
        time_key time
        time_format %Y-%m-%dT%H:%M:%S.%NZ
      </parse>
    </source>

    <match kubernetes.**>
      @type elasticsearch
      host elasticsearch.logging.svc.cluster.local
      port 9200
      index_name kubernetes-logs
    </match>
```

---

## Summary

| Factor | Key Principle | Implementation |
|--------|--------------|----------------|
| IX. Disposability | Fast start, graceful stop | Shutdown hooks, health checks |
| X. Dev/Prod Parity | Same tools everywhere | Docker Compose, feature flags |
| XI. Logs | Event streams to stdout | Pino/structured JSON logging |

---

## Next Lesson

In the final lesson, we'll cover **Factor XII: Admin Processes** and tie everything together with a complete 12-Factor NestJS application.
