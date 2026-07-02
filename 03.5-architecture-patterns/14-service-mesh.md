# Pattern 14: Service Mesh

## What is it?

A dedicated infrastructure layer for handling service-to-service communication. Implemented via sidecar proxies deployed alongside each service.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SERVICE MESH                            │
│                                                              │
│   ┌──────────────────┐          ┌──────────────────┐       │
│   │ ┌──────┐┌──────┐ │  mTLS    │ ┌──────┐┌──────┐ │       │
│   │ │ App  ││Proxy │◀┼─────────▶┼▶│Proxy ││ App  │ │       │
│   │ │  A   ││      │ │          │ │      ││  B   │ │       │
│   │ └──────┘└──────┘ │          │ └──────┘└──────┘ │       │
│   └──────────────────┘          └──────────────────┘       │
│            │                             │                  │
│            └─────────────┬───────────────┘                  │
│                          ▼                                  │
│                ┌──────────────────┐                        │
│                │   Control Plane   │                        │
│                │  (Configuration)  │                        │
│                └──────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Components

### Data Plane

- Sidecar proxies (Envoy)
- Handles actual traffic
- Runs alongside each service

### Control Plane

- Configuration management
- Policy distribution
- Certificate management

---

## Popular Service Meshes

| Mesh               | Proxy          | Complexity | Best For               |
| ------------------ | -------------- | ---------- | ---------------------- |
| **Istio**          | Envoy          | High       | Feature-rich needs     |
| **Linkerd**        | linkerd2-proxy | Low        | Simplicity, K8s native |
| **Consul Connect** | Envoy          | Medium     | Multi-platform         |
| **AWS App Mesh**   | Envoy          | Medium     | AWS ecosystem          |

---

## Key Features

### Security

- **mTLS** - Encrypted service-to-service traffic
- **Authorization policies** - Who can call whom
- **Certificate rotation** - Automatic

### Traffic Management

- **Load balancing** - Round-robin, weighted
- **Canary releases** - Route % of traffic
- **Circuit breaking** - Prevent cascade failures
- **Retries/timeouts** - Automatic handling

### Observability

- **Distributed tracing** - Automatic span injection
- **Metrics** - Latency, error rates
- **Access logs** - Request/response details

---

## Benefits

✅ **Zero code changes** - Features via configuration  
✅ **Consistent policies** - Same rules everywhere  
✅ **Security by default** - mTLS out of the box  
✅ **Deep visibility** - Metrics, traces, logs  
✅ **Traffic control** - Canary, A/B testing

---

## Challenges

❌ **Complexity** - Another layer to manage  
❌ **Resource overhead** - Sidecar per service  
❌ **Latency** - Extra network hop  
❌ **Learning curve** - New concepts

---

## When to Use

| Situation                  | Service Mesh?      |
| -------------------------- | ------------------ |
| 5-10 services              | Probably not       |
| 50+ services               | Yes                |
| Need mTLS everywhere       | Yes                |
| Complex traffic rules      | Yes                |
| Tight resource constraints | Consider carefully |

---

## Key Takeaways

- **Service Mesh** = infrastructure layer for service communication
- **Sidecar proxies** handle traffic, security, observability
- **Istio** = feature-rich, **Linkerd** = lightweight
- Great for **large-scale** deployments
- Adds **complexity** - evaluate if you need it

---

## 📊 Eraser.io Diagram Code

```eraser
// Service Mesh Architecture
Service A [icon: box, color: blue] {
  App [icon: server]
  Envoy [icon: shield, color: orange]
}

Service B [icon: box, color: blue] {
  App [icon: server]
  Envoy [icon: shield, color: orange]
}

Service C [icon: box, color: blue] {
  App [icon: server]
  Envoy [icon: shield, color: orange]
}

Control Plane [icon: cpu, color: purple] {
  Pilot [icon: navigation]
  Citadel [icon: lock]
  Galley [icon: settings]
}

Service A <--> Service B: mTLS
Service B <--> Service C: mTLS
Service A --> Control Plane: Config
Service B --> Control Plane: Config
Service C --> Control Plane: Config
```

```eraser
// Traffic Management
Ingress Gateway [icon: log-in, color: blue]
Service v1 [icon: box, color: green]
Service v2 [icon: box, color: orange]

Ingress Gateway --> Service v1: 90% traffic
Ingress Gateway --> Service v2: 10% canary
```
