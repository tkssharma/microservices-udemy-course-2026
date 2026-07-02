# Pattern 8: Service Discovery

## What is it?

A mechanism for services to find and communicate with each other dynamically, without hardcoded addresses.

---

## The Problem

- Services scale up/down dynamically
- IP addresses change
- Can't hardcode service locations

---

## Two Approaches

### 1. Client-Side Discovery

- Client queries service registry
- Client chooses instance and connects directly
- Client handles load balancing

**Tools:** Netflix Eureka, Consul

**Pros:** No proxy overhead, client controls routing  
**Cons:** Client needs discovery logic for each language

### 2. Server-Side Discovery

- Client calls load balancer/router
- Router queries registry and forwards request
- Client doesn't know about instances

**Tools:** Kubernetes Services, AWS ALB, Nginx

**Pros:** Simpler clients, centralized routing  
**Cons:** Extra network hop, router can be bottleneck

---

## Service Registry

Central database of service instances:

| Service | Instance | Address       | Health  |
| ------- | -------- | ------------- | ------- |
| orders  | orders-1 | 10.0.1.5:3000 | healthy |
| orders  | orders-2 | 10.0.1.6:3000 | healthy |
| users   | users-1  | 10.0.2.3:3001 | healthy |

### Registration Methods

- **Self-registration** - Service registers itself on startup
- **Third-party** - Deployment platform registers services

---

## Health Checks

- Services report health periodically
- Unhealthy instances removed from registry
- Types: HTTP endpoint, TCP, script

---

## Popular Solutions

| Tool               | Type        | Best For         |
| ------------------ | ----------- | ---------------- |
| **Kubernetes DNS** | Server-side | K8s environments |
| **Consul**         | Both        | Multi-platform   |
| **Eureka**         | Client-side | Spring ecosystem |
| **etcd**           | Key-value   | General purpose  |

---

## Key Takeaways

- **Service Discovery** = dynamic service location
- **Client-side** = client queries registry directly
- **Server-side** = router/LB handles discovery
- **Health checks** keep registry accurate
- Kubernetes handles this automatically with Services

---

## 📊 Eraser.io Diagram Code

```eraser
// Client-Side Discovery
Client Service [icon: server, color: blue]
Service Registry [icon: book, color: orange]

Order Service 1 [icon: shopping-cart, color: green]
Order Service 2 [icon: shopping-cart, color: green]
Order Service 3 [icon: shopping-cart, color: green]

Client Service --> Service Registry: 1. Query instances
Service Registry --> Client Service: 2. Return list
Client Service --> Order Service 2: 3. Direct call (load balanced)

Order Service 1 --> Service Registry: Register + heartbeat
Order Service 2 --> Service Registry: Register + heartbeat
Order Service 3 --> Service Registry: Register + heartbeat
```

```eraser
// Server-Side Discovery
Client [icon: monitor]
Load Balancer [icon: git-branch, color: blue]
Service Registry [icon: book, color: orange]

Order Service 1 [icon: shopping-cart, color: green]
Order Service 2 [icon: shopping-cart, color: green]

Client --> Load Balancer: 1. Request
Load Balancer --> Service Registry: 2. Get instances
Load Balancer --> Order Service 1: 3. Forward request

Order Service 1 --> Service Registry: Register
Order Service 2 --> Service Registry: Register
```
