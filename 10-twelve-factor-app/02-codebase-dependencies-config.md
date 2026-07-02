# Lesson 10.2: Codebase, Dependencies & Config

This lesson covers the first three factors that form the foundation of a well-structured microservice.

---

## Factor I: Codebase

> **"One codebase tracked in revision control, many deploys"**

### The Principle

- Each microservice has exactly **one codebase** (Git repository)
- The same codebase is deployed to multiple environments (dev, staging, prod)
- Different versions may be deployed, but it's the same codebase

### Microservices Application

```
┌─────────────────────────────────────────────────────────┐
│                    Organization                          │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ user-service│  │order-service│  │payment-svc  │     │
│  │   (repo)    │  │   (repo)    │  │   (repo)    │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
│         │                │                │             │
│    ┌────┴────┐      ┌────┴────┐      ┌────┴────┐       │
│    │dev│stg│prod    │dev│stg│prod    │dev│stg│prod     │
│    └─────────┘      └─────────┘      └─────────┘       │
└─────────────────────────────────────────────────────────┘
```

### Repository Strategies

**Option 1: Polyrepo (Recommended for Teams)**
```
github.com/company/user-service
github.com/company/order-service
github.com/company/payment-service
```

**Option 2: Monorepo with Clear Boundaries**
```
/services
  /user-service      # Independent deployable
  /order-service     # Independent deployable
  /payment-service   # Independent deployable
/shared
  /common-types      # Shared library
```

### Anti-Patterns to Avoid

❌ Multiple apps sharing the same codebase (refactor into separate services)
❌ Same app with multiple codebases (merge them)
❌ Deploying different code to different environments

---

## Factor II: Dependencies

> **"Explicitly declare and isolate dependencies"**

### The Principle

- Never rely on system-wide packages
- Declare all dependencies explicitly in a manifest file
- Use dependency isolation to prevent "leaking" from the system

### Node.js Implementation

**package.json - Explicit Declaration**
```json
{
  "name": "order-service",
  "version": "1.0.0",
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/config": "^3.0.0",
    "pg": "^8.11.0",
    "class-validator": "^0.14.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=9.0.0"
  }
}
```

**Lock Files for Reproducibility**
```bash
# Always commit your lock file
package-lock.json  # npm
yarn.lock          # yarn
pnpm-lock.yaml     # pnpm
```

### Dockerfile Best Practices

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy dependency files first (layer caching)
COPY package*.json ./

# Install dependencies in isolation
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build

CMD ["node", "dist/main.js"]
```

### Anti-Patterns to Avoid

❌ Relying on globally installed packages (`npm install -g`)
❌ Missing lock files in version control
❌ Using `npm install` in production (use `npm ci`)
❌ Unversioned dependencies (`"lodash": "*"`)

---

## Factor III: Config

> **"Store config in the environment"**

### The Principle

- Configuration that varies between deploys should be stored in **environment variables**
- Strict separation of config from code
- You should be able to open-source your code without exposing credentials

### What Counts as Config?

| Config (Environment) | NOT Config (Code) |
|---------------------|-------------------|
| Database URLs | Internal routing |
| API keys & secrets | Service port (default) |
| External service URLs | Framework settings |
| Feature flags | Business logic |
| Per-deploy settings | Application structure |

### NestJS ConfigModule Implementation

**1. Install the ConfigModule**
```bash
npm install @nestjs/config
```

**2. Create Environment Files (for development only)**
```env
# .env.development
DATABASE_URL=postgresql://localhost:5432/orders_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-key
LOG_LEVEL=debug
```

**3. Configure the Module**
```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.NODE_ENV === 'development' 
        ? '.env.development' 
        : undefined, // In production, use real env vars
    }),
  ],
})
export class AppModule {}
```

**4. Create a Configuration Schema**
```typescript
// config/configuration.ts
export default () => ({
  database: {
    url: process.env.DATABASE_URL,
    poolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
  },
  redis: {
    url: process.env.REDIS_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
  app: {
    port: parseInt(process.env.PORT, 10) || 3000,
    environment: process.env.NODE_ENV || 'development',
  },
});
```

**5. Validate Configuration at Startup**
```typescript
// config/env.validation.ts
import { plainToInstance } from 'class-transformer';
import { IsString, IsNumber, validateSync, IsUrl } from 'class-validator';

class EnvironmentVariables {
  @IsUrl()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsNumber()
  PORT: number = 3000;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  
  return validatedConfig;
}
```

**6. Use Configuration in Services**
```typescript
// orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OrdersService {
  constructor(private configService: ConfigService) {}

  async processOrder() {
    const dbUrl = this.configService.get<string>('DATABASE_URL');
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    // Use configuration values...
  }
}
```

### Docker & Kubernetes Config

**Docker Compose**
```yaml
services:
  order-service:
    image: order-service:latest
    environment:
      - DATABASE_URL=postgresql://db:5432/orders
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - NODE_ENV=production
```

**Kubernetes ConfigMap & Secrets**
```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: order-service-config
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"

---
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: order-service-secrets
type: Opaque
stringData:
  DATABASE_URL: "postgresql://..."
  JWT_SECRET: "super-secret-key"
```

### Anti-Patterns to Avoid

❌ Hardcoded configuration values
❌ Config files checked into version control with secrets
❌ Environment-specific code branches
❌ `.env` files in production deployments

---

## Summary

| Factor | Key Action | NestJS Tool |
|--------|-----------|-------------|
| I. Codebase | One repo per service | Git + proper repo structure |
| II. Dependencies | Use `package.json` + lock files | `npm ci` in Docker |
| III. Config | Environment variables | `@nestjs/config` module |

---

## Next Lesson

In the next lesson, we'll cover **Factors IV and V**: Backing Services and the Build/Release/Run separation.
