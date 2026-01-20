# Lesson 5.3: Service Registry Patterns

## Introduction

The service registry is the heart of service discovery. This lesson covers how services register themselves and how registries maintain accurate service information.

---

## Self-Registration Pattern

Services register themselves with the registry on startup.

```
┌─────────────────────────────────────────────────────────────┐
│              SELF-REGISTRATION                               │
│                                                              │
│  Service Startup:                                           │
│  ────────────────                                           │
│                                                              │
│  ┌─────────────┐                                           │
│  │ User Service│                                           │
│  │  Starting...│                                           │
│  └──────┬──────┘                                           │
│         │                                                   │
│         │  1. Start application                            │
│         │  2. Initialize HTTP server                       │
│         │  3. Register with registry                       │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │  Service    │                                           │
│  │  Registry   │                                           │
│  │             │                                           │
│  │ user-service│                                           │
│  │ 10.0.0.5:3001                                           │
│  └─────────────┘                                           │
│                                                              │
│  Service Shutdown:                                          │
│  ─────────────────                                          │
│  1. Receive SIGTERM                                         │
│  2. Deregister from registry                                │
│  3. Stop accepting new requests                             │
│  4. Finish in-flight requests                               │
│  5. Exit                                                    │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// Self-registration with Consul
import Consul from 'consul';

class ServiceRegistry {
  private consul: Consul.Consul;
  private serviceId: string;

  constructor() {
    this.consul = new Consul({
      host: process.env.CONSUL_HOST || 'localhost',
      port: process.env.CONSUL_PORT || '8500',
    });
    this.serviceId = `${process.env.SERVICE_NAME}-${process.env.HOSTNAME}`;
  }

  async register(): Promise<void> {
    const registration = {
      id: this.serviceId,
      name: process.env.SERVICE_NAME,
      address: process.env.SERVICE_HOST,
      port: parseInt(process.env.SERVICE_PORT || '3000'),
      check: {
        http: `http://${process.env.SERVICE_HOST}:${process.env.SERVICE_PORT}/health`,
        interval: '10s',
        timeout: '5s',
      },
      tags: ['api', 'v1'],
    };

    await this.consul.agent.service.register(registration);
    console.log(`Registered service: ${this.serviceId}`);
  }

  async deregister(): Promise<void> {
    await this.consul.agent.service.deregister(this.serviceId);
    console.log(`Deregistered service: ${this.serviceId}`);
  }
}

// Usage in application startup
const registry = new ServiceRegistry();

async function startServer() {
  const app = express();

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
  });

  const server = app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await registry.register();
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    await registry.deregister();
    server.close(() => {
      process.exit(0);
    });
  });
}
```

---

## Third-Party Registration Pattern

An external service registrar handles registration on behalf of services.

```
┌─────────────────────────────────────────────────────────────┐
│              THIRD-PARTY REGISTRATION                        │
│                                                              │
│  ┌─────────────┐                                           │
│  │ User Service│                                           │
│  │ (unaware of │                                           │
│  │  registry)  │                                           │
│  └─────────────┘                                           │
│         ▲                                                   │
│         │ monitor                                           │
│         │                                                   │
│  ┌─────────────┐     register     ┌─────────────┐         │
│  │  Service    │─────────────────▶│  Service    │         │
│  │  Registrar  │                  │  Registry   │         │
│  └─────────────┘                  └─────────────┘         │
│                                                              │
│  Examples:                                                  │
│  • Kubernetes (kubelet registers pods)                      │
│  • Registrator (Docker container registrar)                 │
│  • AWS ECS (task registration)                              │
└─────────────────────────────────────────────────────────────┘
```

### Benefits

- Services don't need registry client code
- Works with any service (even legacy)
- Centralized registration logic
- Consistent registration across all services

---

## Service Discovery Query

```typescript
// Querying the registry for service instances
class ServiceDiscovery {
  private consul: Consul.Consul;

  async getHealthyInstances(serviceName: string): Promise<ServiceInstance[]> {
    const services = await this.consul.health.service({
      service: serviceName,
      passing: true, // Only healthy instances
    });

    return services.map((entry: any) => ({
      id: entry.Service.ID,
      address: entry.Service.Address,
      port: entry.Service.Port,
      tags: entry.Service.Tags,
    }));
  }

  async getServiceUrl(serviceName: string): Promise<string> {
    const instances = await this.getHealthyInstances(serviceName);

    if (instances.length === 0) {
      throw new Error(`No healthy instances for ${serviceName}`);
    }

    // Simple random selection
    const instance = instances[Math.floor(Math.random() * instances.length)];
    return `http://${instance.address}:${instance.port}`;
  }
}
```

---

## Registry High Availability

```
┌─────────────────────────────────────────────────────────────┐
│              REGISTRY HIGH AVAILABILITY                      │
│                                                              │
│  Single Registry = Single Point of Failure                  │
│                                                              │
│  Solution: Clustered Registry                               │
│  ────────────────────────────                               │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Registry   │  │  Registry   │  │  Registry   │         │
│  │   Node 1    │◀▶│   Node 2    │◀▶│   Node 3    │         │
│  │  (Leader)   │  │ (Follower)  │  │ (Follower)  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                              │
│  • Raft consensus for leader election                       │
│  • Data replicated across nodes                             │
│  • Automatic failover if leader fails                       │
│  • Clients can connect to any node                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Popular Service Registries

### Consul

```yaml
# docker-compose.yml
services:
  consul:
    image: consul:latest
    ports:
      - '8500:8500'
    command: agent -server -bootstrap -ui -client=0.0.0.0
```

### etcd

```yaml
services:
  etcd:
    image: quay.io/coreos/etcd:latest
    ports:
      - '2379:2379'
    command:
      - etcd
      - --advertise-client-urls=http://0.0.0.0:2379
      - --listen-client-urls=http://0.0.0.0:2379
```

---

## Key Takeaways

1. **Self-registration**: Services register themselves (more coupling)
2. **Third-party registration**: External registrar handles it (less coupling)
3. **Health checks**: Registry must know if instances are healthy
4. **High availability**: Cluster the registry for reliability
5. **Graceful shutdown**: Deregister before stopping

---

## What's Next?

In the next lesson, we will explore health checking and load balancing in detail.

---
