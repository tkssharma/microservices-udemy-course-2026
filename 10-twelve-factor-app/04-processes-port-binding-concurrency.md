# Lesson 10.4: Processes, Port Binding & Concurrency

This lesson covers Factors VI, VII, and VIII—the core principles for building scalable, stateless microservices.

---

## Factor VI: Processes

> **"Execute the app as one or more stateless processes"**

### The Principle

- Processes are **stateless** and **share-nothing**
- Any data that needs to persist must be stored in a **stateful backing service** (database, Redis, S3)
- Memory and filesystem of the process are used only as a brief, single-transaction cache

### Why Stateless Matters

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer                             │
└─────────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │ Process │   │ Process │   │ Process │
    │    1    │   │    2    │   │    3    │
    └─────────┘   └─────────┘   └─────────┘
         │              │              │
         └──────────────┼──────────────┘
                        ▼
                 ┌─────────────┐
                 │   Redis     │  ← Session/State Store
                 │  Database   │  ← Persistent Data
                 └─────────────┘
```

Any request can be handled by **any process**. If Process 1 dies, Process 2 or 3 seamlessly handles the next request.

### Stateless Session Management in NestJS

**❌ Anti-Pattern: In-Memory Sessions**
```typescript
// DON'T DO THIS - state is lost on restart/scale
const sessions = new Map<string, UserSession>();

@Injectable()
export class SessionService {
  getSession(sessionId: string) {
    return sessions.get(sessionId); // Lost when process restarts!
  }
}
```

**✅ Correct: External Session Store**
```typescript
// session.module.ts
import { Module } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    RedisModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'single',
        url: config.get('REDIS_URL'),
      }),
    }),
  ],
})
export class SessionModule {}
```

```typescript
// session.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class SessionService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async setSession(sessionId: string, data: any, ttlSeconds = 3600) {
    await this.redis.setex(
      `session:${sessionId}`,
      ttlSeconds,
      JSON.stringify(data)
    );
  }

  async getSession(sessionId: string) {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string) {
    await this.redis.del(`session:${sessionId}`);
  }
}
```

### Stateless File Uploads

**❌ Anti-Pattern: Local Filesystem**
```typescript
// Files are lost when container restarts
@Post('upload')
async uploadFile(@UploadedFile() file: Express.Multer.File) {
  const path = `/uploads/${file.filename}`;
  await fs.writeFile(path, file.buffer); // DON'T DO THIS
}
```

**✅ Correct: Object Storage (S3)**
```typescript
// s3.service.ts
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucket: string;

  constructor(private configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get('AWS_REGION'),
    });
    this.bucket = this.configService.get('S3_BUCKET');
  }

  async uploadFile(key: string, body: Buffer, contentType: string) {
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }
}
```

---

## Factor VII: Port Binding

> **"Export services via port binding"**

### The Principle

- The app is **completely self-contained**
- It exports HTTP (or other protocols) by **binding to a port**
- No dependency on runtime injection of a webserver (like Apache/Nginx as a container)

### NestJS Port Binding

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 3000;
  
  await app.listen(port, '0.0.0.0');
  console.log(`Application running on port ${port}`);
}

bootstrap();
```

### Multiple Protocol Bindings

A service can bind multiple ports for different protocols:

```typescript
// main.ts - Hybrid Application
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';

async function bootstrap() {
  // HTTP API on port 3000
  const app = await NestFactory.create(AppModule);
  
  // gRPC on port 5000
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'orders',
      protoPath: './proto/orders.proto',
      url: '0.0.0.0:5000',
    },
  });
  
  // RabbitMQ listener
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [process.env.RABBITMQ_URL],
      queue: 'orders_queue',
    },
  });

  await app.startAllMicroservices();
  await app.listen(3000);
}

bootstrap();
```

### Docker Port Exposure

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY . .
RUN npm ci && npm run build

# Document the port (doesn't actually publish it)
EXPOSE 3000

CMD ["node", "dist/main.js"]
```

```yaml
# docker-compose.yml
services:
  order-service:
    build: .
    ports:
      - "3000:3000"  # host:container
    environment:
      - PORT=3000
```

---

## Factor VIII: Concurrency

> **"Scale out via the process model"**

### The Principle

- Scale by running **multiple processes** (horizontal scaling)
- Different process types handle different workloads
- Never rely on threads or async within a single process for scaling

### The Process Model

```
┌─────────────────────────────────────────────────────────────┐
│                      Workload Types                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────┐ ┌─────┐ ┌─────┐    Web Processes (HTTP requests)   │
│  │ web │ │ web │ │ web │    - Handle API requests            │
│  └─────┘ └─────┘ └─────┘    - Stateless, fast responses      │
│                                                              │
│  ┌────────┐ ┌────────┐      Worker Processes (Background)    │
│  │ worker │ │ worker │      - Process queue messages          │
│  └────────┘ └────────┘      - Heavy computation               │
│                                                              │
│  ┌─────────┐                Scheduler Process (Cron)         │
│  │scheduler│                - Periodic tasks                  │
│  └─────────┘                - Single instance                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Kubernetes Horizontal Pod Autoscaling

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

### Separate Deployments for Process Types

```yaml
# web-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service-web
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: order-service
          image: order-service:latest
          command: ["node", "dist/main.js"]
          ports:
            - containerPort: 3000

---
# worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service-worker
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: order-service-worker
          image: order-service:latest
          command: ["node", "dist/worker.js"]
          # No ports - this consumes from queue
```

### NestJS Worker Process

```typescript
// worker.ts
import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { WorkerModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    WorkerModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL],
        queue: 'orders_processing_queue',
        queueOptions: { durable: true },
        prefetchCount: 10, // Process 10 messages concurrently
      },
    },
  );

  await app.listen();
  console.log('Worker is listening for messages...');
}

bootstrap();
```

### Node.js Cluster Mode (Alternative)

For CPU-bound work, you can use cluster mode (though K8s pods are preferred):

```typescript
// cluster.ts
import cluster from 'cluster';
import os from 'os';

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died, respawning...`);
    cluster.fork();
  });
} else {
  require('./main'); // Each worker runs the NestJS app
}
```

---

## Summary

| Factor | Key Principle | Implementation |
|--------|--------------|----------------|
| VI. Processes | Stateless, share-nothing | Redis for sessions, S3 for files |
| VII. Port Binding | Self-contained, export via port | `app.listen(PORT)` |
| VIII. Concurrency | Scale via process model | K8s replicas, separate deployments |

---

## Anti-Patterns Checklist

- [ ] ❌ In-memory sessions or caches that don't survive restarts
- [ ] ❌ Local file storage for uploads
- [ ] ❌ Relying on sticky sessions
- [ ] ❌ Depending on an external web server container
- [ ] ❌ Scaling vertically instead of horizontally
- [ ] ❌ Single process handling all workload types

---

## Next Lesson

In the next lesson, we'll cover **Factors IX, X, and XI**: Disposability, Dev/Prod Parity, and Logs—essential for operational excellence.
