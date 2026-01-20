# Lesson 2.4: Strangler Fig Pattern

## Introduction

The Strangler Fig pattern is the safest and most proven approach for migrating from a monolith to microservices. Named after the strangler fig tree that grows around a host tree and eventually replaces it, this pattern allows you to incrementally replace parts of your monolith.

---

## Why Strangler Fig?

```
┌─────────────────────────────────────────────────────────────┐
│                 MIGRATION APPROACHES                         │
│                                                              │
│  Big Bang Rewrite:                                          │
│  ─────────────────                                          │
│  - Rewrite everything at once                               │
│  - Deploy new system, retire old                            │
│  - High risk, often fails                                   │
│  - No value until complete                                  │
│                                                              │
│  Strangler Fig:                                             │
│  ──────────────                                             │
│  - Migrate incrementally                                    │
│  - Old and new run together                                 │
│  - Low risk, proven approach                                │
│  - Value delivered continuously                             │
│                                                              │
│  "The only thing a Big Bang rewrite guarantees is a         │
│   Big Bang." - Martin Fowler                                │
└─────────────────────────────────────────────────────────────┘
```

---

## How It Works

### The Strangler Fig Tree Analogy

```
┌─────────────────────────────────────────────────────────────┐
│                 STRANGLER FIG ANALOGY                        │
│                                                              │
│  Stage 1: Seed lands on host tree                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    ┌───┐                             │   │
│  │                    │ M │  ← Monolith (host tree)    │   │
│  │                    │ O │                             │   │
│  │                    │ N │                             │   │
│  │                    │ O │                             │   │
│  │                    └───┘                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Stage 2: New growth wraps around                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  ┌─┬───┬─┐                           │   │
│  │                  │S│ M │S│  ← Services grow around  │   │
│  │                  │ │ O │ │                           │   │
│  │                  │ │ N │ │                           │   │
│  │                  │ │ O │ │                           │   │
│  │                  └─┴───┴─┘                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Stage 3: New system replaces old                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                  ┌───────┐                           │   │
│  │                  │  S S  │  ← Microservices only    │   │
│  │                  │  S S  │                           │   │
│  │                  │  S S  │                           │   │
│  │                  │  S S  │                           │   │
│  │                  └───────┘                           │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Add a Facade (Proxy)

```
┌─────────────────────────────────────────────────────────────┐
│                    STEP 1: ADD FACADE                        │
│                                                              │
│  Before:                                                    │
│  ───────                                                    │
│  ┌────────┐         ┌─────────────────────────────────┐    │
│  │ Client │ ──────▶ │          Monolith               │    │
│  └────────┘         └─────────────────────────────────┘    │
│                                                              │
│  After:                                                     │
│  ──────                                                     │
│  ┌────────┐    ┌─────────┐    ┌────────────────────────┐   │
│  │ Client │───▶│ Facade  │───▶│       Monolith         │   │
│  └────────┘    │ (Proxy) │    └────────────────────────┘   │
│                └─────────┘                                  │
│                                                              │
│  The facade routes ALL traffic to the monolith initially.  │
│  This is a no-op change that sets up the infrastructure.   │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Extract First Service

```
┌─────────────────────────────────────────────────────────────┐
│                STEP 2: EXTRACT FIRST SERVICE                 │
│                                                              │
│  ┌────────┐    ┌─────────┐                                 │
│  │ Client │───▶│ Facade  │                                 │
│  └────────┘    └────┬────┘                                 │
│                     │                                       │
│         ┌───────────┴───────────┐                          │
│         │                       │                          │
│         ▼                       ▼                          │
│  ┌─────────────┐    ┌─────────────────────────────────┐   │
│  │ Notification│    │          Monolith               │   │
│  │   Service   │    │  (still handles everything else)│   │
│  └─────────────┘    └─────────────────────────────────┘   │
│                                                              │
│  Facade routes /notifications/* to new service.            │
│  Everything else still goes to monolith.                   │
└─────────────────────────────────────────────────────────────┘
```

### Step 3: Continue Extraction

```
┌─────────────────────────────────────────────────────────────┐
│               STEP 3: CONTINUE EXTRACTION                    │
│                                                              │
│  ┌────────┐    ┌─────────┐                                 │
│  │ Client │───▶│ Facade  │                                 │
│  └────────┘    └────┬────┘                                 │
│                     │                                       │
│      ┌──────────────┼──────────────┐                       │
│      │              │              │                       │
│      ▼              ▼              ▼                       │
│  ┌────────┐   ┌──────────┐   ┌─────────────────────┐      │
│  │Notific.│   │ Product  │   │      Monolith       │      │
│  │Service │   │ Service  │   │ (shrinking)         │      │
│  └────────┘   └──────────┘   └─────────────────────┘      │
│                                                              │
│  More services extracted, monolith shrinks.                │
└─────────────────────────────────────────────────────────────┘
```

### Step 4: Complete Migration

```
┌─────────────────────────────────────────────────────────────┐
│               STEP 4: COMPLETE MIGRATION                     │
│                                                              │
│  ┌────────┐    ┌─────────────┐                             │
│  │ Client │───▶│ API Gateway │                             │
│  └────────┘    └──────┬──────┘                             │
│                       │                                     │
│      ┌────────┬───────┼───────┬────────┐                   │
│      │        │       │       │        │                   │
│      ▼        ▼       ▼       ▼        ▼                   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
│  │Notif.│ │Prodct│ │Order │ │Paymnt│ │ User │            │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘            │
│                                                              │
│  Monolith is gone. Facade becomes API Gateway.             │
└─────────────────────────────────────────────────────────────┘
```

---

## Facade Implementation

### Simple Express Proxy

```typescript
// facade/src/index.ts
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

// Route configuration
const routes = {
  // New microservices
  '/api/notifications': 'http://notification-service:3001',
  '/api/products': 'http://product-service:3002',

  // Everything else goes to monolith
  '/': 'http://monolith:3000',
};

// Setup proxies for new services
Object.entries(routes).forEach(([path, target]) => {
  if (path !== '/') {
    app.use(
      path,
      createProxyMiddleware({
        target,
        changeOrigin: true,
        pathRewrite: { [`^${path}`]: '' },
      }),
    );
  }
});

// Default: proxy to monolith
app.use(
  '/',
  createProxyMiddleware({
    target: routes['/'],
    changeOrigin: true,
  }),
);

app.listen(8080, () => {
  console.log('Facade running on port 8080');
});
```

### Feature Flag Based Routing

```typescript
// facade/src/router.ts
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();

// Feature flags (could come from config service)
const featureFlags = {
  useNewProductService: true,
  useNewOrderService: false, // Still in development
  useNewUserService: false, // Not started
};

// Dynamic routing based on feature flags
app.use('/api/products', (req, res, next) => {
  const target = featureFlags.useNewProductService ? 'http://product-service:3002' : 'http://monolith:3000';

  createProxyMiddleware({
    target,
    changeOrigin: true,
  })(req, res, next);
});

app.use('/api/orders', (req, res, next) => {
  const target = featureFlags.useNewOrderService ? 'http://order-service:3003' : 'http://monolith:3000';

  createProxyMiddleware({
    target,
    changeOrigin: true,
  })(req, res, next);
});

// Default to monolith
app.use(
  '/',
  createProxyMiddleware({
    target: 'http://monolith:3000',
    changeOrigin: true,
  }),
);
```

---

## Data Migration Strategies

### Strategy 1: Shared Database (Temporary)

```
┌─────────────────────────────────────────────────────────────┐
│            STRATEGY 1: SHARED DATABASE                       │
│                                                              │
│  ┌─────────────┐         ┌─────────────┐                   │
│  │   Product   │         │  Monolith   │                   │
│  │   Service   │         │             │                   │
│  └──────┬──────┘         └──────┬──────┘                   │
│         │                       │                           │
│         └───────────┬───────────┘                           │
│                     ▼                                        │
│            ┌─────────────────┐                              │
│            │  Shared Database │                              │
│            │   (temporary)    │                              │
│            └─────────────────┘                              │
│                                                              │
│  Pros:                                                      │
│  - Simple to implement                                      │
│  - No data sync needed                                      │
│                                                              │
│  Cons:                                                      │
│  - Tight coupling                                           │
│  - Schema changes affect both                               │
│  - Must migrate data eventually                             │
│                                                              │
│  Use as: Temporary stepping stone only!                     │
└─────────────────────────────────────────────────────────────┘
```

### Strategy 2: Database View

```
┌─────────────────────────────────────────────────────────────┐
│              STRATEGY 2: DATABASE VIEW                       │
│                                                              │
│  ┌─────────────┐         ┌─────────────┐                   │
│  │   Product   │         │  Monolith   │                   │
│  │   Service   │         │             │                   │
│  └──────┬──────┘         └──────┬──────┘                   │
│         │                       │                           │
│         ▼                       │                           │
│  ┌─────────────┐                │                           │
│  │  View/API   │◀───────────────┘                           │
│  │  (read-only)│                                            │
│  └──────┬──────┘                                            │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────┐                                        │
│  │    Database     │                                        │
│  └─────────────────┘                                        │
│                                                              │
│  New service reads through a view or API.                   │
│  Writes still go to monolith.                               │
└─────────────────────────────────────────────────────────────┘
```

### Strategy 3: Data Synchronization

```
┌─────────────────────────────────────────────────────────────┐
│            STRATEGY 3: DATA SYNCHRONIZATION                  │
│                                                              │
│  ┌─────────────┐                    ┌─────────────┐        │
│  │   Product   │                    │  Monolith   │        │
│  │   Service   │                    │             │        │
│  └──────┬──────┘                    └──────┬──────┘        │
│         │                                  │                │
│         ▼                                  ▼                │
│  ┌─────────────┐    ┌──────────┐   ┌─────────────┐        │
│  │  Product DB │◀───│  Sync    │───│ Monolith DB │        │
│  │   (new)     │    │  Process │   │  (legacy)   │        │
│  └─────────────┘    └──────────┘   └─────────────┘        │
│                                                              │
│  Sync options:                                              │
│  - Change Data Capture (CDC)                                │
│  - Event-based sync                                         │
│  - Scheduled batch sync                                     │
│                                                              │
│  Eventually, monolith stops writing to synced tables.       │
└─────────────────────────────────────────────────────────────┘
```

### Strategy 4: Event-Driven Sync

```typescript
// In monolith: Publish events when data changes
class ProductRepository {
  private eventBus: EventBus;

  async update(product: Product): Promise<void> {
    await this.db.update('products', product);

    // Publish event for new service to consume
    await this.eventBus.publish('product.updated', {
      id: product.id,
      name: product.name,
      price: product.price,
      updatedAt: new Date(),
    });
  }
}

// In new Product Service: Consume events
class ProductEventHandler {
  async handleProductUpdated(event: ProductUpdatedEvent): Promise<void> {
    await this.productRepository.upsert({
      id: event.id,
      name: event.name,
      price: event.price,
      syncedAt: new Date(),
    });
  }
}
```

---

## Handling Cross-Cutting Concerns

### Authentication During Migration

```
┌─────────────────────────────────────────────────────────────┐
│            AUTHENTICATION DURING MIGRATION                   │
│                                                              │
│  Option 1: Facade handles auth                              │
│  ─────────────────────────────                              │
│  ┌────────┐    ┌─────────┐                                 │
│  │ Client │───▶│ Facade  │──┬──▶ Monolith                  │
│  │ + JWT  │    │ (auth)  │  └──▶ New Services              │
│  └────────┘    └─────────┘                                 │
│                                                              │
│  Facade validates JWT, passes user context to services.    │
│                                                              │
│  Option 2: Shared auth service                              │
│  ─────────────────────────────                              │
│  ┌────────┐    ┌─────────┐    ┌─────────────┐             │
│  │ Client │───▶│ Facade  │───▶│ Auth Service│             │
│  └────────┘    └────┬────┘    └─────────────┘             │
│                     │                                       │
│              ┌──────┴──────┐                               │
│              ▼             ▼                               │
│         Monolith      New Services                         │
│                                                              │
│  Extract auth first, all services use it.                  │
└─────────────────────────────────────────────────────────────┘
```

### Logging and Tracing

```typescript
// Facade adds correlation ID to all requests
import { v4 as uuidv4 } from 'uuid';

app.use((req, res, next) => {
  // Generate or forward correlation ID
  const correlationId = req.headers['x-correlation-id'] || uuidv4();
  req.headers['x-correlation-id'] = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  // Log request
  console.log(
    JSON.stringify({
      correlationId,
      method: req.method,
      path: req.path,
      timestamp: new Date().toISOString(),
    }),
  );

  next();
});
```

---

## Rollback Strategy

### Feature Flag Rollback

```typescript
// Quick rollback by flipping feature flag
const routingConfig = {
  products: {
    enabled: true, // Set to false to rollback
    newService: 'http://product-service:3002',
    fallback: 'http://monolith:3000',
  },
};

app.use('/api/products', (req, res, next) => {
  const config = routingConfig.products;
  const target = config.enabled ? config.newService : config.fallback;

  createProxyMiddleware({ target, changeOrigin: true })(req, res, next);
});
```

### Canary Rollout

```typescript
// Gradual rollout with percentage-based routing
const canaryConfig = {
  products: {
    percentage: 10, // 10% to new service
    newService: 'http://product-service:3002',
    fallback: 'http://monolith:3000',
  },
};

app.use('/api/products', (req, res, next) => {
  const config = canaryConfig.products;
  const useNewService = Math.random() * 100 < config.percentage;
  const target = useNewService ? config.newService : config.fallback;

  // Log which service handled the request
  console.log(`Routing to: ${useNewService ? 'new' : 'legacy'}`);

  createProxyMiddleware({ target, changeOrigin: true })(req, res, next);
});
```

---

## Migration Checklist

```
┌─────────────────────────────────────────────────────────────┐
│              STRANGLER FIG MIGRATION CHECKLIST               │
│                                                              │
│  Before Starting:                                           │
│  [ ] Identify service to extract                            │
│  [ ] Define API contract                                    │
│  [ ] Plan data migration strategy                           │
│  [ ] Set up monitoring and logging                          │
│                                                              │
│  Facade Setup:                                              │
│  [ ] Deploy facade/proxy                                    │
│  [ ] Route all traffic through facade                       │
│  [ ] Verify no functionality change                         │
│  [ ] Set up feature flags                                   │
│                                                              │
│  Service Extraction:                                        │
│  [ ] Build new service                                      │
│  [ ] Implement same API as monolith                         │
│  [ ] Set up data sync if needed                             │
│  [ ] Test thoroughly                                        │
│                                                              │
│  Rollout:                                                   │
│  [ ] Route small percentage to new service                  │
│  [ ] Monitor errors and latency                             │
│  [ ] Gradually increase percentage                          │
│  [ ] Full cutover when confident                            │
│                                                              │
│  Cleanup:                                                   │
│  [ ] Remove old code from monolith                          │
│  [ ] Remove data sync (if applicable)                       │
│  [ ] Update documentation                                   │
│  [ ] Celebrate!                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Common Pitfalls

### Pitfall 1: Extracting Too Much at Once

```
BAD:  Extract 5 services in parallel
GOOD: Extract 1 service, stabilize, then next
```

### Pitfall 2: Ignoring Data Consistency

```
BAD:  Hope data stays in sync
GOOD: Explicit sync strategy with monitoring
```

### Pitfall 3: No Rollback Plan

```
BAD:  "It will work, we don't need rollback"
GOOD: Feature flags, canary releases, instant rollback
```

### Pitfall 4: Keeping Facade Too Long

```
BAD:  Facade becomes permanent complexity
GOOD: Evolve facade into proper API Gateway
```

---

## Key Takeaways

1. **Strangler Fig is incremental** - Migrate one service at a time
2. **Facade enables routing** - Direct traffic to old or new system
3. **Feature flags enable rollback** - Instant switch back if issues
4. **Data migration is critical** - Plan sync strategy carefully
5. **Monitor everything** - Compare old vs new service behavior
6. **Celebrate small wins** - Each extracted service is progress

---

## What's Next?

In the next lesson, we will explore different decomposition strategies for breaking down your monolith.

---
