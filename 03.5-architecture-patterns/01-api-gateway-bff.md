# Pattern 1: API Gateway & Backend for Frontend (BFF)

## API Gateway Pattern

### What is it?

An API Gateway is a single entry point for all client requests. It acts as a reverse proxy, routing requests to appropriate microservices while handling cross-cutting concerns.

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENTS                              │
│     ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│     │   Web   │    │ Mobile  │    │   IoT   │              │
│     └────┬────┘    └────┬────┘    └────┬────┘              │
│          │              │              │                    │
│          └──────────────┼──────────────┘                    │
│                         ▼                                   │
│               ┌─────────────────┐                          │
│               │   API Gateway   │                          │
│               │  ─────────────  │                          │
│               │ • Authentication│                          │
│               │ • Rate Limiting │                          │
│               │ • Load Balancing│                          │
│               │ • Caching       │                          │
│               └────────┬────────┘                          │
│          ┌─────────────┼─────────────┐                     │
│          ▼             ▼             ▼                     │
│     ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│     │ Users   │  │ Orders  │  │Products │                 │
│     │ Service │  │ Service │  │ Service │                 │
│     └─────────┘  └─────────┘  └─────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### Key Responsibilities

| Responsibility                      | Description                            |
| ----------------------------------- | -------------------------------------- |
| **Routing**                         | Route requests to appropriate services |
| **Authentication**                  | Verify JWT tokens, API keys            |
| **Rate Limiting**                   | Protect services from overload         |
| **Load Balancing**                  | Distribute traffic across instances    |
| **Caching**                         | Cache responses for performance        |
| **Request/Response Transformation** | Modify payloads as needed              |
| **Circuit Breaking**                | Prevent cascade failures               |

---

### NestJS API Gateway Implementation

```typescript
// gateway/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.setGlobalPrefix('api/v1');

  await app.listen(3000);
}
bootstrap();
```

```typescript
// gateway/src/app.module.ts
import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { UsersController } from './users/users.controller';
import { OrdersController } from './orders/orders.controller';

@Module({
  imports: [
    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    // Caching
    CacheModule.register({
      ttl: 5000,
      max: 100,
    }),
    // Microservice clients
    ClientsModule.register([
      {
        name: 'USERS_SERVICE',
        transport: Transport.TCP,
        options: { host: 'users-service', port: 3001 },
      },
      {
        name: 'ORDERS_SERVICE',
        transport: Transport.TCP,
        options: { host: 'orders-service', port: 3002 },
      },
    ]),
  ],
  controllers: [UsersController, OrdersController],
})
export class AppModule {}
```

```typescript
// gateway/src/users/users.controller.ts
import { Controller, Get, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthGuard } from '../guards/auth.guard';
import { firstValueFrom } from 'rxjs';

@Controller('users')
@UseGuards(ThrottlerGuard, AuthGuard)
export class UsersController {
  constructor(@Inject('USERS_SERVICE') private usersClient: ClientProxy) {}

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  async getUser(@Param('id') id: string) {
    return firstValueFrom(this.usersClient.send({ cmd: 'get_user' }, { id }));
  }

  @Get(':id/orders')
  async getUserWithOrders(@Param('id') id: string) {
    // Aggregate data from multiple services
    const [user, orders] = await Promise.all([
      firstValueFrom(this.usersClient.send({ cmd: 'get_user' }, { id })),
      firstValueFrom(this.ordersClient.send({ cmd: 'get_user_orders' }, { userId: id })),
    ]);

    return { ...user, orders };
  }
}
```

---

## Backend for Frontend (BFF) Pattern

### What is it?

BFF creates dedicated backend services for each type of frontend client (web, mobile, IoT). Each BFF is tailored to the specific needs of its client.

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│  ┌─────────┐         ┌─────────┐         ┌─────────┐       │
│  │   Web   │         │ Mobile  │         │   IoT   │       │
│  │  Client │         │  Client │         │  Client │       │
│  └────┬────┘         └────┬────┘         └────┬────┘       │
│       │                   │                   │             │
│       ▼                   ▼                   ▼             │
│  ┌─────────┐         ┌─────────┐         ┌─────────┐       │
│  │ Web BFF │         │Mobile   │         │ IoT BFF │       │
│  │ (Full   │         │  BFF    │         │(Minimal │       │
│  │  data)  │         │(Compact)│         │ payload)│       │
│  └────┬────┘         └────┬────┘         └────┬────┘       │
│       │                   │                   │             │
│       └───────────────────┼───────────────────┘             │
│                           ▼                                 │
│     ┌─────────┐     ┌─────────┐     ┌─────────┐            │
│     │ Users   │     │ Orders  │     │Products │            │
│     │ Service │     │ Service │     │ Service │            │
│     └─────────┘     └─────────┘     └─────────┘            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Why Use BFF?

| Client     | Requirements                                          |
| ---------- | ----------------------------------------------------- |
| **Web**    | Rich data, complex UI, high bandwidth                 |
| **Mobile** | Compact payloads, offline support, battery efficiency |
| **IoT**    | Minimal data, low bandwidth, specific protocols       |

---

### Mobile BFF Example

```typescript
// mobile-bff/src/products/products.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  async getProducts(@Query('page') page = 1) {
    const products = await this.productsService.getProducts(page);

    // Return compact payload for mobile
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      thumb: p.images[0]?.thumbnail, // Single thumbnail
    }));
  }
}
```

### Web BFF Example

```typescript
// web-bff/src/products/products.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ReviewsService } from './reviews.service';

@Controller('products')
export class ProductsController {
  constructor(
    private productsService: ProductsService,
    private reviewsService: ReviewsService,
  ) {}

  @Get()
  async getProducts(@Query('page') page = 1) {
    const products = await this.productsService.getProducts(page);

    // Enrich with additional data for web
    return Promise.all(
      products.map(async (p) => ({
        ...p,
        images: p.images, // All images
        reviews: await this.reviewsService.getTopReviews(p.id, 3),
        relatedProducts: await this.productsService.getRelated(p.id),
      })),
    );
  }
}
```

---

## API Gateway vs BFF

| Aspect       | API Gateway                                | BFF                                |
| ------------ | ------------------------------------------ | ---------------------------------- |
| **Purpose**  | Single entry point, cross-cutting concerns | Client-specific optimization       |
| **Number**   | One per system                             | One per client type                |
| **Logic**    | Routing, auth, rate limiting               | Data transformation, aggregation   |
| **Coupling** | Loosely coupled to clients                 | Tightly coupled to specific client |

### Combined Architecture

```
┌───────────────────────────────────────────────────────────┐
│                                                            │
│     Web ──▶ Web BFF ──┐                                   │
│                       │                                    │
│  Mobile ──▶ Mobile BFF├──▶ API Gateway ──▶ Microservices │
│                       │                                    │
│     IoT ──▶ IoT BFF ──┘                                   │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

---

## Popular API Gateway Solutions

| Solution            | Type        | Best For              |
| ------------------- | ----------- | --------------------- |
| **Kong**            | Self-hosted | Full control, plugins |
| **AWS API Gateway** | Managed     | AWS ecosystem         |
| **Nginx**           | Self-hosted | High performance      |
| **Traefik**         | Self-hosted | Kubernetes native     |
| **Express Gateway** | Self-hosted | Node.js ecosystem     |

---

## Anti-Patterns to Avoid

❌ **Gateway as Business Logic** - Keep business logic in services  
❌ **Single Point of Failure** - Deploy multiple gateway instances  
❌ **Over-aggregation** - Don't aggregate too much data in gateway  
❌ **Shared BFF** - Each client type should have its own BFF

---

## Key Takeaways

1. **API Gateway** handles cross-cutting concerns at the edge
2. **BFF** optimizes API responses for specific client needs
3. Use both together for complex multi-client systems
4. Keep gateway logic minimal - routing and policies only
5. BFFs can aggregate and transform data from multiple services

---

## 📊 Eraser.io Diagram Code

```eraser
// API Gateway Pattern
Web Client [icon: monitor]
Mobile Client [icon: smartphone]
IoT Device [icon: cpu]

API Gateway [icon: server, color: blue] {
  Authentication [icon: lock]
  Rate Limiting [icon: gauge]
  Routing [icon: git-branch]
  Caching [icon: database]
}

Users Service [icon: users, color: green]
Orders Service [icon: shopping-cart, color: green]
Products Service [icon: package, color: green]

Web Client --> API Gateway
Mobile Client --> API Gateway
IoT Device --> API Gateway

API Gateway --> Users Service
API Gateway --> Orders Service
API Gateway --> Products Service
```

```eraser
// BFF Pattern
Web App [icon: monitor]
Mobile App [icon: smartphone]
IoT App [icon: cpu]

Web BFF [icon: server, color: blue]
Mobile BFF [icon: server, color: orange]
IoT BFF [icon: server, color: purple]

Users Service [icon: users, color: green]
Orders Service [icon: shopping-cart, color: green]
Products Service [icon: package, color: green]

Web App --> Web BFF: Full data
Mobile App --> Mobile BFF: Compact data
IoT App --> IoT BFF: Minimal data

Web BFF --> Users Service
Web BFF --> Orders Service
Mobile BFF --> Users Service
Mobile BFF --> Orders Service
IoT BFF --> Products Service
```
