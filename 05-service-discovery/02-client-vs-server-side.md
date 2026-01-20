# Lesson 5.2: Client-Side vs Server-Side Discovery

## Introduction

There are two main patterns for service discovery: client-side and server-side. Each has trade-offs that make it suitable for different scenarios.

---

## Client-Side Discovery

In client-side discovery, the client is responsible for querying the service registry and selecting an available instance.

```
┌─────────────────────────────────────────────────────────────┐
│              CLIENT-SIDE DISCOVERY                           │
│                                                              │
│  ┌─────────────┐     1. Query      ┌─────────────┐         │
│  │   Client    │─────────────────▶│  Service    │         │
│  │  (Order     │                   │  Registry   │         │
│  │   Service)  │◀─────────────────│             │         │
│  └──────┬──────┘  2. Return list   └─────────────┘         │
│         │         [A:3001, B:3001, C:3001]                 │
│         │                                                   │
│         │  3. Select instance (load balance)               │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │ User Service│                                           │
│  │  Instance B │                                           │
│  └─────────────┘                                           │
│                                                              │
│  Client responsibilities:                                   │
│  • Query registry                                           │
│  • Cache service locations                                  │
│  • Load balance across instances                            │
│  • Handle instance failures                                 │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Example

```typescript
// Client-side discovery with caching
class ServiceDiscoveryClient {
  private cache: Map<string, ServiceInstance[]> = new Map();
  private registryUrl: string;

  constructor(registryUrl: string) {
    this.registryUrl = registryUrl;
  }

  async getServiceInstances(serviceName: string): Promise<ServiceInstance[]> {
    // Check cache first
    if (this.cache.has(serviceName)) {
      return this.cache.get(serviceName)!;
    }

    // Query registry
    const response = await fetch(`${this.registryUrl}/services/${serviceName}`);
    const instances = await response.json();

    // Cache results
    this.cache.set(serviceName, instances);

    return instances;
  }

  // Round-robin load balancing
  private currentIndex: Map<string, number> = new Map();

  async selectInstance(serviceName: string): Promise<ServiceInstance> {
    const instances = await this.getServiceInstances(serviceName);

    if (instances.length === 0) {
      throw new Error(`No instances available for ${serviceName}`);
    }

    const index = this.currentIndex.get(serviceName) || 0;
    const instance = instances[index % instances.length];
    this.currentIndex.set(serviceName, index + 1);

    return instance;
  }
}

// Usage
const discovery = new ServiceDiscoveryClient('http://consul:8500');
const userService = await discovery.selectInstance('user-service');
const response = await fetch(`http://${userService.address}:${userService.port}/users/123`);
```

### Pros and Cons

**Pros:**

- Client has full control over load balancing
- Can implement custom routing logic
- Fewer network hops
- Client can cache and optimize

**Cons:**

- Client complexity increases
- Must implement in every client language
- Tight coupling to registry
- Client must handle failures

---

## Server-Side Discovery

In server-side discovery, the client makes requests to a load balancer, which queries the registry and forwards requests.

```
┌─────────────────────────────────────────────────────────────┐
│              SERVER-SIDE DISCOVERY                           │
│                                                              │
│  ┌─────────────┐                                           │
│  │   Client    │                                           │
│  │  (Order     │                                           │
│  │   Service)  │                                           │
│  └──────┬──────┘                                           │
│         │                                                   │
│         │  1. Request to user-service                      │
│         ▼                                                   │
│  ┌─────────────┐     2. Query      ┌─────────────┐         │
│  │    Load     │─────────────────▶│  Service    │         │
│  │   Balancer  │◀─────────────────│  Registry   │         │
│  └──────┬──────┘  3. Return list   └─────────────┘         │
│         │                                                   │
│         │  4. Forward to selected instance                 │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │ User Service│                                           │
│  │  Instance B │                                           │
│  └─────────────┘                                           │
│                                                              │
│  Load balancer responsibilities:                            │
│  • Query registry                                           │
│  • Load balance across instances                            │
│  • Health checking                                          │
│  • Handle instance failures                                 │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Example

```typescript
// Server-side: Client just calls the load balancer
class UserServiceClient {
  private loadBalancerUrl: string;

  constructor() {
    // Client only knows the load balancer address
    this.loadBalancerUrl = process.env.LOAD_BALANCER_URL || 'http://lb:8080';
  }

  async getUser(userId: string): Promise<User> {
    // Simple HTTP call - load balancer handles discovery
    const response = await fetch(`${this.loadBalancerUrl}/user-service/users/${userId}`);
    return response.json();
  }
}
```

### Pros and Cons

**Pros:**

- Simple client implementation
- Language agnostic
- Centralized load balancing logic
- Client decoupled from registry

**Cons:**

- Additional network hop
- Load balancer can be bottleneck
- Load balancer is single point of failure
- Less flexibility for clients

---

## Comparison

```
┌─────────────────────────────────────────────────────────────┐
│              COMPARISON                                      │
│                                                              │
│  Aspect              Client-Side      Server-Side           │
│  ──────              ───────────      ───────────           │
│  Client complexity   High             Low                   │
│  Network hops        Fewer            More                  │
│  Load balancing      Client           Centralized           │
│  Language support    Per-language     Any                   │
│  Flexibility         High             Lower                 │
│  Single point fail   No               Yes (LB)              │
│  Caching             Client           LB                    │
│                                                              │
│  Examples:                                                  │
│  Client-side: Netflix Ribbon, gRPC                          │
│  Server-side: AWS ELB, Kubernetes Service, nginx            │
└─────────────────────────────────────────────────────────────┘
```

---

## Hybrid Approach

Many systems use a hybrid approach:

```
┌─────────────────────────────────────────────────────────────┐
│              HYBRID APPROACH                                 │
│                                                              │
│  External Traffic (Server-Side):                            │
│  ───────────────────────────────                            │
│  Internet → Load Balancer → API Gateway → Services          │
│                                                              │
│  Internal Traffic (Client-Side):                            │
│  ───────────────────────────────                            │
│  Service A → Registry Query → Service B                     │
│                                                              │
│  Benefits:                                                  │
│  • External: Simple, secure entry point                     │
│  • Internal: Low latency, flexible routing                  │
└─────────────────────────────────────────────────────────────┘
```

---

## When to Use Each

**Use Client-Side When:**

- Need fine-grained control over load balancing
- Low latency is critical
- Services are in same language/framework
- Using service mesh (Istio, Linkerd)

**Use Server-Side When:**

- Polyglot environment
- Want simple client code
- External traffic entry point
- Using Kubernetes (built-in)

---

## Key Takeaways

1. **Client-side**: Client queries registry, more control, more complexity
2. **Server-side**: Load balancer handles discovery, simpler clients
3. **Hybrid is common**: Server-side for external, client-side for internal
4. **Choose based on**: Language diversity, latency needs, team expertise

---

## What's Next?

In the next lesson, we will explore service registry patterns and implementations.

---
