# Lesson 10.3: Backing Services & Build/Release/Run

This lesson covers Factors IV and V, focusing on external resources and the deployment pipeline.

---

## Factor IV: Backing Services

> **"Treat backing services as attached resources"**

### The Principle

A **backing service** is any service the app consumes over the network:
- Databases (PostgreSQL, MongoDB, MySQL)
- Message queues (RabbitMQ, Kafka, Redis)
- SMTP services (SendGrid, Mailgun)
- Caching systems (Redis, Memcached)
- Storage services (S3, MinIO)
- Third-party APIs (Stripe, Twilio)

The app should make **no distinction** between local and third-party services. Both are attached via URLs stored in config.

### Visual Representation

```
┌─────────────────────────────────────────────────────────────┐
│                     Order Service                            │
└─────────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
    │PostgreSQL│   │ Redis   │   │RabbitMQ │   │ Stripe  │
    │ (local) │   │ (local) │   │ (cloud) │   │  (API)  │
    └─────────┘   └─────────┘   └─────────┘   └─────────┘
         ▲              ▲              ▲              ▲
         │              │              │              │
    DATABASE_URL   REDIS_URL    RABBITMQ_URL   STRIPE_API_KEY
```

### NestJS Implementation

**Database as Attached Resource**
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: configService.get('NODE_ENV') === 'development',
      }),
    }),
  ],
})
export class AppModule {}
```

**Message Queue as Attached Resource**
```typescript
// rabbitmq.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'ORDERS_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.get<string>('RABBITMQ_URL')],
            queue: 'orders_queue',
            queueOptions: { durable: true },
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class RabbitMQModule {}
```

**Redis as Attached Resource**
```typescript
// redis.module.ts
import { Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'single',
        url: configService.get<string>('REDIS_URL'),
      }),
    }),
  ],
})
export class CacheModule {}
```

### Swapping Backing Services

The beauty of this pattern: you can swap services without code changes.

**Development → Production Database**
```bash
# Development
DATABASE_URL=postgresql://localhost:5432/orders_dev

# Production (AWS RDS)
DATABASE_URL=postgresql://user:pass@orders-db.abc123.us-east-1.rds.amazonaws.com:5432/orders
```

**Local Redis → Managed Redis**
```bash
# Development
REDIS_URL=redis://localhost:6379

# Production (AWS ElastiCache)
REDIS_URL=redis://orders-cache.abc123.cache.amazonaws.com:6379
```

### Anti-Patterns to Avoid

❌ Hardcoded database connection strings
❌ Different code paths for "local" vs "production" services
❌ Tight coupling to specific service implementations
❌ Credentials in code

---

## Factor V: Build, Release, Run

> **"Strictly separate build and run stages"**

### The Principle

The deployment pipeline has three distinct stages:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    BUILD    │ ──▶ │   RELEASE   │ ──▶ │     RUN     │
│             │     │             │     │             │
│ Code +      │     │ Build +     │     │ Release     │
│ Dependencies│     │ Config      │     │ executed in │
│ = Build     │     │ = Release   │     │ environment │
└─────────────┘     └─────────────┘     └─────────────┘
```

| Stage | Input | Output | Responsibility |
|-------|-------|--------|----------------|
| **Build** | Code + dependencies | Executable artifact | Compile, bundle, create image |
| **Release** | Build + config | Deployable release | Combine with environment config |
| **Run** | Release | Running process | Execute in target environment |

### Build Stage

**Dockerfile - Multi-stage Build**
```dockerfile
# Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production Stage
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

USER node

CMD ["node", "dist/main.js"]
```

**Build Script**
```json
{
  "scripts": {
    "build": "nest build",
    "build:docker": "docker build -t order-service:${VERSION:-latest} ."
  }
}
```

### Release Stage

The release combines the build artifact with environment-specific configuration.

**GitHub Actions - CI/CD Pipeline**
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker image
        run: |
          docker build -t order-service:${{ github.sha }} .
          docker tag order-service:${{ github.sha }} order-service:latest
      
      - name: Push to Registry
        run: |
          docker push myregistry/order-service:${{ github.sha }}
          docker push myregistry/order-service:latest

  release-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to Staging
        run: |
          kubectl set image deployment/order-service \
            order-service=myregistry/order-service:${{ github.sha }}
        env:
          KUBECONFIG: ${{ secrets.STAGING_KUBECONFIG }}

  release-production:
    needs: release-staging
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to Production
        run: |
          kubectl set image deployment/order-service \
            order-service=myregistry/order-service:${{ github.sha }}
        env:
          KUBECONFIG: ${{ secrets.PROD_KUBECONFIG }}
```

### Run Stage

**Kubernetes Deployment**
```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
    spec:
      containers:
        - name: order-service
          image: myregistry/order-service:v1.2.3
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: order-service-config
            - secretRef:
                name: order-service-secrets
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

### Release Versioning

Every release should have a unique ID (timestamp, git SHA, or semantic version):

```
order-service:2024-01-15-143022
order-service:abc123def
order-service:v1.2.3
```

This enables:
- **Rollback**: Deploy a previous release instantly
- **Audit trail**: Know exactly what's running
- **Reproducibility**: Same release = same behavior

### Anti-Patterns to Avoid

❌ Running `npm install` in production
❌ Building on production servers
❌ Modifying code in running containers
❌ No versioning for releases
❌ Manual deployments without automation

---

## Summary

| Factor | Key Principle | Implementation |
|--------|--------------|----------------|
| IV. Backing Services | Attached via URL config | ConfigService + env vars |
| V. Build/Release/Run | Strict stage separation | Docker + CI/CD pipelines |

---

## Next Lesson

In the next lesson, we'll cover **Factors VI, VII, and VIII**: Processes, Port Binding, and Concurrency—the core of scalable microservices.
