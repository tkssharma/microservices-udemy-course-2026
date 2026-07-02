# Lesson 10.6: Admin Processes & Putting It All Together

This final lesson covers Factor XII and provides a complete 12-Factor checklist for your microservices.

---

## Factor XII: Admin Processes

> **"Run admin/management tasks as one-off processes"**

### The Principle

One-off administrative tasks should:
- Run in an **identical environment** as the app
- Run against a release using the **same codebase and config**
- Ship with application code to avoid synchronization issues

### Common Admin Processes

| Task | Description | Example |
|------|-------------|---------|
| Database migrations | Schema changes | `npm run migration:run` |
| Console/REPL | Interactive debugging | `npm run console` |
| Data fixes | One-time scripts | `npm run fix:duplicate-orders` |
| Reports | Data exports | `npm run report:monthly-sales` |
| Cache warming | Pre-populate caches | `npm run cache:warm` |

### Database Migrations

**TypeORM Migration Setup**
```typescript
// typeorm.config.ts
import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config(); // Load .env

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
  migrationsTableName: 'migrations',
});
```

**Package.json Scripts**
```json
{
  "scripts": {
    "migration:generate": "typeorm migration:generate -d dist/typeorm.config.js",
    "migration:run": "typeorm migration:run -d dist/typeorm.config.js",
    "migration:revert": "typeorm migration:revert -d dist/typeorm.config.js",
    "migration:show": "typeorm migration:show -d dist/typeorm.config.js"
  }
}
```

**Kubernetes Job for Migrations**
```yaml
# migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: order-service-migration
spec:
  template:
    spec:
      containers:
        - name: migration
          image: order-service:v1.2.3  # Same image as app
          command: ["npm", "run", "migration:run"]
          envFrom:
            - secretRef:
                name: order-service-secrets
      restartPolicy: Never
  backoffLimit: 3
```

### NestJS REPL Console

**Create Console Entry Point**
```typescript
// repl.ts
import { repl } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  await repl(AppModule);
}

bootstrap();
```

**Package.json Script**
```json
{
  "scripts": {
    "console": "nest start --entryFile repl"
  }
}
```

**Usage**
```bash
$ npm run console

> await get(OrdersService).findAll()
> await get(UsersService).findByEmail('test@example.com')
```

### One-Off Data Scripts

**Script Structure**
```typescript
// scripts/fix-duplicate-orders.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { OrdersService } from '../src/orders/orders.service';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const ordersService = app.get(OrdersService);
  
  console.log('Finding duplicate orders...');
  const duplicates = await ordersService.findDuplicates();
  console.log(`Found ${duplicates.length} duplicates`);
  
  for (const dup of duplicates) {
    console.log(`Fixing order ${dup.id}...`);
    await ordersService.mergeDuplicate(dup);
  }
  
  console.log('Done!');
  await app.close();
}

run().catch(console.error);
```

**Package.json Script**
```json
{
  "scripts": {
    "script:fix-duplicates": "ts-node scripts/fix-duplicate-orders.ts"
  }
}
```

### Kubernetes CronJob for Scheduled Tasks

```yaml
# cleanup-cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: order-cleanup
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: cleanup
              image: order-service:v1.2.3
              command: ["npm", "run", "script:cleanup-expired-orders"]
              envFrom:
                - configMapRef:
                    name: order-service-config
                - secretRef:
                    name: order-service-secrets
          restartPolicy: OnFailure
```

---

## Complete 12-Factor Checklist

Use this checklist when building or auditing your microservices:

### ✅ Factor I: Codebase
- [ ] One repository per microservice
- [ ] All environments deploy from the same codebase
- [ ] Version control with Git

### ✅ Factor II: Dependencies
- [ ] `package.json` with explicit versions
- [ ] Lock file (`package-lock.json`) committed
- [ ] No global dependencies required
- [ ] `npm ci` used in CI/CD

### ✅ Factor III: Config
- [ ] All config via environment variables
- [ ] No secrets in code or version control
- [ ] `@nestjs/config` module configured
- [ ] Config validation at startup

### ✅ Factor IV: Backing Services
- [ ] Databases, caches, queues configured via URL
- [ ] Can swap local for managed service without code changes
- [ ] No hardcoded connection strings

### ✅ Factor V: Build, Release, Run
- [ ] Multi-stage Dockerfile
- [ ] CI/CD pipeline with distinct stages
- [ ] Immutable releases with version tags
- [ ] No runtime compilation

### ✅ Factor VI: Processes
- [ ] Stateless application processes
- [ ] Sessions stored in Redis/external store
- [ ] File uploads to S3/object storage
- [ ] No in-memory state that can't be lost

### ✅ Factor VII: Port Binding
- [ ] App exports service via port
- [ ] Self-contained (no external web server required)
- [ ] Port configurable via environment

### ✅ Factor VIII: Concurrency
- [ ] Horizontal scaling via process replication
- [ ] Separate deployments for web/worker processes
- [ ] HPA configured for auto-scaling

### ✅ Factor IX: Disposability
- [ ] Fast startup (< 10 seconds)
- [ ] Graceful shutdown handlers
- [ ] Health check endpoints
- [ ] Kubernetes probes configured

### ✅ Factor X: Dev/Prod Parity
- [ ] Docker Compose for local development
- [ ] Same backing services in all environments
- [ ] No environment-specific code branches
- [ ] Feature flags for conditional features

### ✅ Factor XI: Logs
- [ ] Structured JSON logging
- [ ] Logs to stdout/stderr only
- [ ] Correlation IDs for request tracing
- [ ] No log file management in app

### ✅ Factor XII: Admin Processes
- [ ] Migrations run as one-off jobs
- [ ] Scripts use same codebase and config
- [ ] Kubernetes Jobs for one-off tasks
- [ ] CronJobs for scheduled tasks

---

## Complete Example: 12-Factor NestJS Service

```
order-service/
├── src/
│   ├── main.ts                    # Port binding, graceful shutdown
│   ├── app.module.ts              # Config, backing services
│   ├── config/
│   │   ├── configuration.ts       # Typed config
│   │   └── env.validation.ts      # Config validation
│   ├── health/
│   │   └── health.controller.ts   # Liveness/readiness probes
│   ├── orders/
│   │   ├── orders.module.ts
│   │   ├── orders.controller.ts
│   │   └── orders.service.ts
│   └── common/
│       ├── logger/                # Structured logging
│       └── middleware/            # Correlation IDs
├── migrations/                    # Database migrations
├── scripts/                       # Admin one-off scripts
├── repl.ts                        # Console entry point
├── Dockerfile                     # Multi-stage build
├── docker-compose.yml             # Dev environment
├── package.json                   # Dependencies
├── package-lock.json              # Lock file
├── .env.example                   # Template (no secrets)
└── k8s/
    ├── deployment.yaml
    ├── service.yaml
    ├── configmap.yaml
    ├── hpa.yaml
    └── migration-job.yaml
```

---

## Key Takeaways

1. **The 12 factors are interconnected** - implementing one often makes others easier
2. **Start with the basics** - Factors I, II, III are foundational
3. **Docker and Kubernetes naturally align** with 12-factor principles
4. **NestJS provides built-in support** for many factors (ConfigModule, shutdown hooks, etc.)
5. **Audit existing services** against the checklist to identify improvements

---

## Resources

- [The Twelve-Factor App](https://12factor.net/) - Original methodology
- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)
- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)
- [Docker Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)

---

## Module Complete! 🎉

You now understand how to build cloud-native microservices following the 12-Factor App methodology. These principles will help you create applications that are:

- **Scalable** - Horizontal scaling with stateless processes
- **Portable** - Run anywhere with environment-based config
- **Maintainable** - Clear separation of concerns
- **Observable** - Structured logs and health checks
- **Resilient** - Fast recovery with graceful shutdown

Apply these principles to every microservice you build!
