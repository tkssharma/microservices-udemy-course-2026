# Lesson 5.5: Service Discovery in Kubernetes

## Introduction

Kubernetes provides built-in service discovery through its Service and DNS mechanisms. This eliminates the need for external service registries like Consul or etcd for most use cases.

---

## Kubernetes Services

A Kubernetes Service provides a stable endpoint for a set of Pods.

```
┌─────────────────────────────────────────────────────────────┐
│              KUBERNETES SERVICE                              │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Service                           │   │
│  │              user-service                            │   │
│  │           ClusterIP: 10.96.0.100                     │   │
│  │              Port: 80                                │   │
│  └────────────────────┬────────────────────────────────┘   │
│                       │                                     │
│         ┌─────────────┼─────────────┐                      │
│         ▼             ▼             ▼                      │
│    ┌─────────┐   ┌─────────┐   ┌─────────┐                │
│    │  Pod 1  │   │  Pod 2  │   │  Pod 3  │                │
│    │10.0.0.5 │   │10.0.0.6 │   │10.0.0.7 │                │
│    └─────────┘   └─────────┘   └─────────┘                │
│                                                              │
│  Service provides:                                          │
│  • Stable DNS name (user-service)                           │
│  • Stable IP (ClusterIP)                                    │
│  • Load balancing across pods                               │
│  • Automatic endpoint updates                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Service Definition

```yaml
# user-service.yaml
apiVersion: v1
kind: Service
metadata:
  name: user-service
  namespace: default
spec:
  selector:
    app: user-service
  ports:
    - port: 80
      targetPort: 3000
  type: ClusterIP

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-service
  template:
    metadata:
      labels:
        app: user-service
    spec:
      containers:
        - name: user-service
          image: user-service:latest
          ports:
            - containerPort: 3000
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 20
```

---

## DNS-Based Discovery

Kubernetes creates DNS entries for Services automatically.

```
┌─────────────────────────────────────────────────────────────┐
│              KUBERNETES DNS                                  │
│                                                              │
│  DNS Format:                                                │
│  ───────────                                                │
│  <service>.<namespace>.svc.cluster.local                    │
│                                                              │
│  Examples:                                                  │
│  ─────────                                                  │
│  user-service.default.svc.cluster.local                     │
│  order-service.production.svc.cluster.local                 │
│                                                              │
│  Short names (within same namespace):                       │
│  ─────────────────────────────────────                      │
│  user-service                                               │
│  order-service                                              │
│                                                              │
│  Usage in code:                                             │
│  ───────────────                                            │
│  const userServiceUrl = 'http://user-service';              │
│  // Kubernetes DNS resolves to ClusterIP                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Service Types

```
┌─────────────────────────────────────────────────────────────┐
│              SERVICE TYPES                                   │
│                                                              │
│  1. ClusterIP (default)                                     │
│  ──────────────────────                                     │
│  Internal only, accessible within cluster                   │
│  Use for: Service-to-service communication                  │
│                                                              │
│  2. NodePort                                                │
│  ───────────                                                │
│  Exposes on each node's IP at a static port                 │
│  Use for: Development, simple external access               │
│                                                              │
│  3. LoadBalancer                                            │
│  ─────────────                                              │
│  Creates external load balancer (cloud provider)            │
│  Use for: Production external access                        │
│                                                              │
│  4. ExternalName                                            │
│  ──────────────                                             │
│  Maps to external DNS name                                  │
│  Use for: External services (databases, APIs)               │
└─────────────────────────────────────────────────────────────┘
```

---

## Using Services in Code

```typescript
// In Kubernetes, just use the service name
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://user-service';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service';

class UserClient {
  async getUser(userId: string): Promise<User> {
    // Kubernetes DNS resolves 'user-service' to the ClusterIP
    const response = await fetch(`${USER_SERVICE_URL}/users/${userId}`);
    return response.json();
  }
}
```

---

## Headless Services

For client-side load balancing, use headless services.

```yaml
# Headless service - returns pod IPs directly
apiVersion: v1
kind: Service
metadata:
  name: user-service-headless
spec:
  clusterIP: None # Makes it headless
  selector:
    app: user-service
  ports:
    - port: 3000
```

```
┌─────────────────────────────────────────────────────────────┐
│              HEADLESS SERVICE                                │
│                                                              │
│  Regular Service:                                           │
│  DNS lookup → Single ClusterIP                              │
│                                                              │
│  Headless Service:                                          │
│  DNS lookup → All Pod IPs                                   │
│  [10.0.0.5, 10.0.0.6, 10.0.0.7]                            │
│                                                              │
│  Use for:                                                   │
│  • Client-side load balancing                               │
│  • Stateful applications                                    │
│  • When you need to know all endpoints                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Health Probes

Kubernetes uses probes to determine pod health.

```yaml
spec:
  containers:
    - name: app
      livenessProbe:
        httpGet:
          path: /health/live
          port: 3000
        initialDelaySeconds: 15
        periodSeconds: 20
        failureThreshold: 3

      readinessProbe:
        httpGet:
          path: /health/ready
          port: 3000
        initialDelaySeconds: 5
        periodSeconds: 10
        failureThreshold: 3

      startupProbe:
        httpGet:
          path: /health/startup
          port: 3000
        failureThreshold: 30
        periodSeconds: 10
```

---

## Key Takeaways

1. **Kubernetes Services** provide built-in discovery
2. **DNS-based** - use service names directly
3. **Automatic load balancing** across healthy pods
4. **Health probes** determine pod readiness
5. **No external registry needed** for most cases

---

## Module Summary

In this module, you learned:

- Why service discovery is needed
- Client-side vs server-side discovery
- Service registry patterns
- Health checking and load balancing
- Kubernetes native service discovery

---

## What's Next?

In the next module, we will explore database patterns for microservices.

---
