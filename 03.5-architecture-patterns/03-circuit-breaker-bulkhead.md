# Pattern 3: Circuit Breaker & Bulkhead Pattern

## Circuit Breaker Pattern

### What is it?

The Circuit Breaker prevents an application from repeatedly trying to execute an operation that's likely to fail. It "trips" when failures exceed a threshold, failing fast instead of waiting for timeouts.

```
┌─────────────────────────────────────────────────────────────┐
│                    CIRCUIT BREAKER STATES                    │
│                                                              │
│  ┌──────────┐    Failures     ┌──────────┐                 │
│  │  CLOSED  │───────────────▶│   OPEN   │                 │
│  │          │   exceed        │          │                 │
│  │ Requests │   threshold     │  Fail    │                 │
│  │  pass    │                 │  fast    │                 │
│  └──────────┘                 └────┬─────┘                 │
│       ▲                            │                        │
│       │                     timeout expires                 │
│       │                            │                        │
│       │      success        ┌──────▼─────┐                 │
│       └─────────────────────│ HALF-OPEN  │                 │
│                             │            │                 │
│              failure        │  Test      │                 │
│           ┌─────────────────│  request   │                 │
│           │                 └────────────┘                 │
│           ▼                                                 │
│     Back to OPEN                                           │
└─────────────────────────────────────────────────────────────┘
```

### States Explained

| State         | Behavior                                              |
| ------------- | ----------------------------------------------------- |
| **CLOSED**    | Normal operation, requests pass through               |
| **OPEN**      | All requests fail immediately without calling service |
| **HALF-OPEN** | Limited requests allowed to test if service recovered |

---

### NestJS Circuit Breaker Implementation

```typescript
// src/resilience/circuit-breaker.ts
export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: number | null = null;
  private nextAttempt: number = Date.now();

  constructor(
    private readonly options: {
      failureThreshold: number;
      successThreshold: number;
      timeout: number;
    } = {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 30000,
    },
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = CircuitState.HALF_OPEN;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.timeout;
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}
```

### Using Circuit Breaker in Service

```typescript
// src/orders/orders.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { CircuitBreaker } from '../resilience/circuit-breaker';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);
  private readonly paymentCircuit = new CircuitBreaker({
    failureThreshold: 3,
    successThreshold: 2,
    timeout: 10000,
  });

  constructor(private httpService: HttpService) {}

  async processPayment(orderId: string, amount: number) {
    try {
      return await this.paymentCircuit.execute(async () => {
        const response = await this.httpService.axiosRef.post(
          'http://payment-service/process',
          { orderId, amount },
          { timeout: 5000 },
        );
        return response.data;
      });
    } catch (error) {
      this.logger.warn(`Payment failed, circuit state: ${this.paymentCircuit.getState()}`);
      // Return fallback or queue for retry
      return { status: 'PENDING', message: 'Payment queued for processing' };
    }
  }
}
```

---

### Using Opossum Library

```typescript
// src/resilience/circuit-breaker.service.ts
import { Injectable } from '@nestjs/common';
import CircuitBreaker from 'opossum';

@Injectable()
export class CircuitBreakerService {
  private breakers = new Map<string, CircuitBreaker>();

  createBreaker<T>(name: string, fn: (...args: any[]) => Promise<T>, options?: CircuitBreaker.Options): CircuitBreaker {
    const breaker = new CircuitBreaker(fn, {
      timeout: 5000,
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      ...options,
    });

    breaker.on('open', () => console.log(`${name}: Circuit OPENED`));
    breaker.on('halfOpen', () => console.log(`${name}: Circuit HALF-OPEN`));
    breaker.on('close', () => console.log(`${name}: Circuit CLOSED`));
    breaker.on('fallback', () => console.log(`${name}: Fallback executed`));

    this.breakers.set(name, breaker);
    return breaker;
  }

  getBreaker(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }
}
```

---

## Bulkhead Pattern

### What is it?

The Bulkhead pattern isolates elements of an application into pools so that if one fails, the others continue to function. Named after ship compartments that prevent flooding.

```
┌─────────────────────────────────────────────────────────────┐
│                      BULKHEAD PATTERN                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Application                       │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐       │   │
│  │  │  Pool A   │  │  Pool B   │  │  Pool C   │       │   │
│  │  │ (Orders)  │  │(Payments) │  │(Inventory)│       │   │
│  │  │           │  │           │  │           │       │   │
│  │  │ 10 conns  │  │ 5 conns   │  │ 5 conns   │       │   │
│  │  │ max       │  │ max       │  │ max       │       │   │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘       │   │
│  └────────┼──────────────┼──────────────┼──────────────┘   │
│           │              │              │                   │
│           ▼              ▼              ▼                   │
│      ┌────────┐    ┌────────┐    ┌────────┐               │
│      │ Orders │    │Payment │    │Inventory│               │
│      │Service │    │Service │    │Service  │               │
│      └────────┘    └────────┘    └────────┘               │
│                                                              │
│  If Payment Service is slow/down, only Pool B is affected   │
│  Orders and Inventory continue to work normally              │
└─────────────────────────────────────────────────────────────┘
```

### Bulkhead Types

| Type                | Description                          | Use Case             |
| ------------------- | ------------------------------------ | -------------------- |
| **Thread Pool**     | Separate thread pools per dependency | CPU-bound operations |
| **Connection Pool** | Separate DB/HTTP connection pools    | I/O-bound operations |
| **Semaphore**       | Limit concurrent executions          | Simple isolation     |

---

### Semaphore Bulkhead Implementation

```typescript
// src/resilience/bulkhead.ts
export class Bulkhead {
  private currentCount = 0;
  private queue: Array<() => void> = [];

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number = 100,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.currentCount >= this.maxConcurrent) {
      if (this.queue.length >= this.maxQueue) {
        throw new Error('Bulkhead queue full - request rejected');
      }
      await this.waitForSlot();
    }

    this.currentCount++;
    try {
      return await fn();
    } finally {
      this.currentCount--;
      this.releaseSlot();
    }
  }

  private waitForSlot(): Promise<void> {
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  private releaseSlot(): void {
    const next = this.queue.shift();
    if (next) next();
  }

  getStats() {
    return {
      active: this.currentCount,
      queued: this.queue.length,
      available: this.maxConcurrent - this.currentCount,
    };
  }
}
```

### Bulkhead Service with Multiple Pools

```typescript
// src/resilience/bulkhead.service.ts
import { Injectable } from '@nestjs/common';
import { Bulkhead } from './bulkhead';

@Injectable()
export class BulkheadService {
  private bulkheads = new Map<string, Bulkhead>();

  constructor() {
    // Create isolated pools for different services
    this.bulkheads.set('orders', new Bulkhead(10, 50));
    this.bulkheads.set('payments', new Bulkhead(5, 20));
    this.bulkheads.set('inventory', new Bulkhead(5, 30));
    this.bulkheads.set('notifications', new Bulkhead(3, 100));
  }

  async execute<T>(pool: string, fn: () => Promise<T>): Promise<T> {
    const bulkhead = this.bulkheads.get(pool);
    if (!bulkhead) {
      throw new Error(`Unknown bulkhead pool: ${pool}`);
    }
    return bulkhead.execute(fn);
  }

  getStats(pool: string) {
    return this.bulkheads.get(pool)?.getStats();
  }
}
```

### Using Bulkhead in Controller

```typescript
// src/orders/orders.controller.ts
import { Controller, Post, Body, ServiceUnavailableException } from '@nestjs/common';
import { BulkheadService } from '../resilience/bulkhead.service';
import { PaymentService } from '../payment/payment.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private bulkheadService: BulkheadService,
    private paymentService: PaymentService,
  ) {}

  @Post()
  async createOrder(@Body() orderDto: CreateOrderDto) {
    // Process payment with isolated bulkhead
    try {
      const payment = await this.bulkheadService.execute('payments', () =>
        this.paymentService.process(orderDto.amount),
      );
      return { orderId: '...', payment };
    } catch (error) {
      if (error.message.includes('Bulkhead')) {
        throw new ServiceUnavailableException('Service temporarily unavailable');
      }
      throw error;
    }
  }
}
```

---

## Combining Circuit Breaker + Bulkhead

```typescript
// src/resilience/resilient-client.ts
import { Injectable } from '@nestjs/common';
import { CircuitBreaker } from './circuit-breaker';
import { Bulkhead } from './bulkhead';

@Injectable()
export class ResilientClient {
  private circuitBreaker: CircuitBreaker;
  private bulkhead: Bulkhead;

  constructor(config: { maxConcurrent: number; failureThreshold: number }) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: config.failureThreshold,
      successThreshold: 2,
      timeout: 30000,
    });
    this.bulkhead = new Bulkhead(config.maxConcurrent, 50);
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // First check circuit breaker, then apply bulkhead
    return this.circuitBreaker.execute(() => this.bulkhead.execute(fn));
  }
}
```

---

## Retry Pattern (Companion Pattern)

```typescript
// src/resilience/retry.ts
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    delay: number;
    backoffMultiplier?: number;
  },
): Promise<T> {
  let lastError: Error;
  let delay = options.delay;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < options.maxRetries) {
        await sleep(delay);
        delay *= options.backoffMultiplier || 2;
      }
    }
  }
  throw lastError!;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
```

---

## Key Takeaways

1. **Circuit Breaker** prevents cascade failures by failing fast
2. **Bulkhead** isolates failures to specific components
3. **Combine both** for maximum resilience
4. Always implement **fallbacks** for graceful degradation
5. **Monitor** circuit/bulkhead states for observability

---

## 📊 Eraser.io Diagram Code

```eraser
// Circuit Breaker Pattern
Client [icon: monitor]
Order Service [icon: server, color: blue]
Circuit Breaker [icon: zap, color: orange]
Payment Service [icon: credit-card, color: green]
Fallback [icon: life-buoy, color: red]

Client --> Order Service: Request
Order Service --> Circuit Breaker: Call payment
Circuit Breaker --> Payment Service: CLOSED state
Circuit Breaker --> Fallback: OPEN state

// States
CLOSED [icon: check-circle, color: green]
OPEN [icon: x-circle, color: red]
HALF_OPEN [icon: clock, color: orange]

CLOSED --> OPEN: Failures exceed threshold
OPEN --> HALF_OPEN: Timeout expires
HALF_OPEN --> CLOSED: Success
HALF_OPEN --> OPEN: Failure
```

```eraser
// Bulkhead Pattern
Application [icon: server, color: blue]

Orders Pool [icon: box, color: green] {
  Connection 1 [icon: link]
  Connection 2 [icon: link]
  10 max [icon: hash]
}

Payments Pool [icon: box, color: orange] {
  Connection 1 [icon: link]
  5 max [icon: hash]
}

Inventory Pool [icon: box, color: purple] {
  Connection 1 [icon: link]
  5 max [icon: hash]
}

Orders Service [icon: shopping-cart]
Payment Service [icon: credit-card]
Inventory Service [icon: package]

Application --> Orders Pool
Application --> Payments Pool
Application --> Inventory Pool
Orders Pool --> Orders Service
Payments Pool --> Payment Service
Inventory Pool --> Inventory Service
```
