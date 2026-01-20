# Lesson 5.4: Health Checking and Load Balancing

## Introduction

Health checking ensures that only healthy service instances receive traffic. Load balancing distributes requests across those healthy instances. Together, they form the foundation of reliable service communication.

---

## Health Check Types

```
┌─────────────────────────────────────────────────────────────┐
│              HEALTH CHECK TYPES                              │
│                                                              │
│  1. Liveness Check                                          │
│  ─────────────────                                          │
│  "Is the process running?"                                  │
│  • Simple ping/pong                                         │
│  • Returns 200 if alive                                     │
│  • Failure = restart the service                            │
│                                                              │
│  2. Readiness Check                                         │
│  ──────────────────                                         │
│  "Can the service handle requests?"                         │
│  • Checks dependencies (DB, cache)                          │
│  • Returns 200 if ready                                     │
│  • Failure = remove from load balancer                      │
│                                                              │
│  3. Startup Check                                           │
│  ─────────────────                                          │
│  "Has the service finished starting?"                       │
│  • For slow-starting services                               │
│  • Prevents premature liveness checks                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Health Check Implementation

```typescript
// src/health/health.controller.ts
import { Router, Request, Response } from 'express';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    [key: string]: {
      status: 'pass' | 'fail';
      latency?: number;
      message?: string;
    };
  };
}

// Liveness check - is the process running?
router.get('/health/live', (req: Request, res: Response) => {
  res.json({ status: 'alive' });
});

// Readiness check - can we handle requests?
router.get('/health/ready', async (req: Request, res: Response) => {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {},
  };

  // Check database
  try {
    const start = Date.now();
    await checkDatabase();
    health.checks.database = {
      status: 'pass',
      latency: Date.now() - start,
    };
  } catch (error) {
    health.checks.database = {
      status: 'fail',
      message: (error as Error).message,
    };
    health.status = 'unhealthy';
  }

  // Check Redis
  try {
    const start = Date.now();
    await checkRedis();
    health.checks.redis = {
      status: 'pass',
      latency: Date.now() - start,
    };
  } catch (error) {
    health.checks.redis = {
      status: 'fail',
      message: (error as Error).message,
    };
    health.status = 'degraded'; // Can work without cache
  }

  // Check external API
  try {
    const start = Date.now();
    await checkExternalApi();
    health.checks.externalApi = {
      status: 'pass',
      latency: Date.now() - start,
    };
  } catch (error) {
    health.checks.externalApi = {
      status: 'fail',
      message: (error as Error).message,
    };
    health.status = 'degraded';
  }

  const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
});

async function checkDatabase(): Promise<void> {
  await db.query('SELECT 1');
}

async function checkRedis(): Promise<void> {
  await redis.ping();
}

async function checkExternalApi(): Promise<void> {
  const response = await fetch('https://api.example.com/health', {
    timeout: 3000,
  });
  if (!response.ok) throw new Error('External API unhealthy');
}

export { router as healthRoutes };
```

---

## Load Balancing Algorithms

```
┌─────────────────────────────────────────────────────────────┐
│              LOAD BALANCING ALGORITHMS                       │
│                                                              │
│  1. Round Robin                                             │
│  ───────────────                                            │
│  Request 1 → Instance A                                     │
│  Request 2 → Instance B                                     │
│  Request 3 → Instance C                                     │
│  Request 4 → Instance A (repeat)                            │
│                                                              │
│  2. Weighted Round Robin                                    │
│  ───────────────────────                                    │
│  Instance A (weight 3): 3 requests                          │
│  Instance B (weight 1): 1 request                           │
│  Instance C (weight 2): 2 requests                          │
│                                                              │
│  3. Least Connections                                       │
│  ─────────────────────                                      │
│  Route to instance with fewest active connections           │
│                                                              │
│  4. Random                                                  │
│  ────────                                                   │
│  Randomly select an instance                                │
│                                                              │
│  5. IP Hash                                                 │
│  ─────────                                                  │
│  Same client IP always goes to same instance                │
│  (sticky sessions)                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Load Balancer Implementation

```typescript
// src/loadbalancer/load-balancer.ts
interface ServiceInstance {
  id: string;
  address: string;
  port: number;
  weight?: number;
  connections?: number;
}

// Round Robin
class RoundRobinBalancer {
  private currentIndex = 0;

  select(instances: ServiceInstance[]): ServiceInstance {
    if (instances.length === 0) {
      throw new Error('No instances available');
    }
    const instance = instances[this.currentIndex % instances.length];
    this.currentIndex++;
    return instance;
  }
}

// Weighted Round Robin
class WeightedRoundRobinBalancer {
  private currentWeight = 0;
  private currentIndex = 0;

  select(instances: ServiceInstance[]): ServiceInstance {
    const maxWeight = Math.max(...instances.map((i) => i.weight || 1));
    const gcd = this.gcd(instances.map((i) => i.weight || 1));

    while (true) {
      this.currentIndex = (this.currentIndex + 1) % instances.length;

      if (this.currentIndex === 0) {
        this.currentWeight -= gcd;
        if (this.currentWeight <= 0) {
          this.currentWeight = maxWeight;
        }
      }

      const instance = instances[this.currentIndex];
      if ((instance.weight || 1) >= this.currentWeight) {
        return instance;
      }
    }
  }

  private gcd(numbers: number[]): number {
    return numbers.reduce((a, b) => this.gcdTwo(a, b));
  }

  private gcdTwo(a: number, b: number): number {
    return b === 0 ? a : this.gcdTwo(b, a % b);
  }
}

// Least Connections
class LeastConnectionsBalancer {
  select(instances: ServiceInstance[]): ServiceInstance {
    return instances.reduce((min, instance) => ((instance.connections || 0) < (min.connections || 0) ? instance : min));
  }
}

// Random
class RandomBalancer {
  select(instances: ServiceInstance[]): ServiceInstance {
    const index = Math.floor(Math.random() * instances.length);
    return instances[index];
  }
}
```

---

## Health-Aware Load Balancing

```typescript
// Combine health checking with load balancing
class HealthAwareLoadBalancer {
  private instances: Map<string, ServiceInstance & { healthy: boolean }> = new Map();
  private balancer = new RoundRobinBalancer();

  async updateHealth(serviceName: string): Promise<void> {
    const instances = await this.discovery.getInstances(serviceName);

    for (const instance of instances) {
      try {
        const response = await fetch(`http://${instance.address}:${instance.port}/health/ready`, { timeout: 5000 });

        this.instances.set(instance.id, {
          ...instance,
          healthy: response.ok,
        });
      } catch {
        this.instances.set(instance.id, {
          ...instance,
          healthy: false,
        });
      }
    }
  }

  getHealthyInstance(serviceName: string): ServiceInstance {
    const healthy = Array.from(this.instances.values()).filter((i) => i.healthy);

    if (healthy.length === 0) {
      throw new Error(`No healthy instances for ${serviceName}`);
    }

    return this.balancer.select(healthy);
  }
}
```

---

## Graceful Degradation

```
┌─────────────────────────────────────────────────────────────┐
│              GRACEFUL DEGRADATION                            │
│                                                              │
│  When a service is unhealthy:                               │
│                                                              │
│  1. Remove from load balancer                               │
│     Stop sending new requests                               │
│                                                              │
│  2. Drain existing connections                              │
│     Let in-flight requests complete                         │
│                                                              │
│  3. Retry with backoff                                      │
│     Periodically check if recovered                         │
│                                                              │
│  4. Circuit breaker                                         │
│     Stop trying after repeated failures                     │
│                                                              │
│  5. Fallback                                                │
│     Return cached data or default response                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Liveness vs Readiness**: Different purposes, different actions
2. **Check dependencies**: Readiness should verify DB, cache, etc.
3. **Multiple algorithms**: Choose based on your needs
4. **Health-aware routing**: Only route to healthy instances
5. **Graceful degradation**: Handle failures gracefully

---

## What's Next?

In the next lesson, we will explore how Kubernetes handles service discovery natively.

---
