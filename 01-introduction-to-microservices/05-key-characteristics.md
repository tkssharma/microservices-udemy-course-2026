# Lesson 1.5: Key Characteristics of Microservices

## Introduction

Well-designed microservices share common characteristics. Understanding these helps you build services that are maintainable, scalable, and resilient.

---

## The Nine Key Characteristics

```
┌─────────────────────────────────────────────────────────────┐
│            KEY CHARACTERISTICS OF MICROSERVICES              │
│                                                              │
│  1. Single Responsibility                                   │
│  2. Autonomous / Independent                                │
│  3. Owns Its Data                                           │
│  4. Lightweight Communication                               │
│  5. Independently Deployable                                │
│  6. Decentralized Governance                                │
│  7. Failure Isolation                                       │
│  8. Observable                                              │
│  9. Automation-First                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Single Responsibility

### What It Means

Each microservice does one thing and does it well. It focuses on a single business capability.

### Good vs Bad Examples

```
┌─────────────────────────────────────────────────────────────┐
│                   SINGLE RESPONSIBILITY                      │
│                                                              │
│  GOOD:                          BAD:                        │
│  ─────                          ────                        │
│                                                              │
│  ┌─────────────────┐           ┌─────────────────┐         │
│  │ Payment Service │           │ Order-Payment-  │         │
│  │                 │           │ Shipping-Email  │         │
│  │ - Process pay   │           │ Service         │         │
│  │ - Refunds       │           │                 │         │
│  │ - Payment hist  │           │ - Create order  │         │
│  └─────────────────┘           │ - Process pay   │         │
│                                │ - Ship order    │         │
│  Focused on payments           │ - Send emails   │         │
│                                └─────────────────┘         │
│                                                              │
│                                Too many responsibilities    │
└─────────────────────────────────────────────────────────────┘
```

### How to Identify Boundaries

- **Domain-Driven Design**: Align with bounded contexts
- **Business Capability**: One capability per service
- **Team Ownership**: Can one team own it completely?
- **Change Frequency**: Things that change together stay together

---

## 2. Autonomous / Independent

### What It Means

A service can function without depending on other services being available. It makes its own decisions.

### Autonomy Levels

```
┌─────────────────────────────────────────────────────────────┐
│                    AUTONOMY SPECTRUM                         │
│                                                              │
│  LOW AUTONOMY                          HIGH AUTONOMY        │
│  ────────────                          ─────────────        │
│                                                              │
│  Sync calls to          Async events,     Fully self-       │
│  other services         local cache       contained         │
│  for every request                                          │
│                                                              │
│  ├──────────────────────────────────────────────────┤      │
│  │                                                   │      │
│  Tightly Coupled                        Loosely Coupled     │
└─────────────────────────────────────────────────────────────┘
```

### Example: Order Service Autonomy

```
LOW AUTONOMY:
─────────────
Order Service needs to call:
- User Service (get user details)
- Product Service (get product info)
- Inventory Service (check stock)
- Payment Service (process payment)

If ANY service is down, Order Service fails.

HIGH AUTONOMY:
──────────────
Order Service has:
- Cached user data (from events)
- Cached product data (from events)
- Local inventory snapshot
- Async payment processing

Can create orders even if other services are temporarily down.
```

---

## 3. Owns Its Data

### What It Means

Each service has its own database. No other service can directly access it.

### Data Ownership

```
┌─────────────────────────────────────────────────────────────┐
│                      DATA OWNERSHIP                          │
│                                                              │
│  WRONG: Shared Database                                     │
│  ──────────────────────                                     │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │ Service │  │ Service │  │ Service │                     │
│  │    A    │  │    B    │  │    C    │                     │
│  └────┬────┘  └────┬────┘  └────┬────┘                     │
│       │            │            │                           │
│       └────────────┼────────────┘                           │
│                    ▼                                         │
│            ┌──────────────┐                                 │
│            │   Shared DB  │  ← Coupling, no autonomy       │
│            └──────────────┘                                 │
│                                                              │
│  RIGHT: Database per Service                                │
│  ───────────────────────────                                │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │ Service │  │ Service │  │ Service │                     │
│  │    A    │  │    B    │  │    C    │                     │
│  └────┬────┘  └────┬────┘  └────┬────┘                     │
│       │            │            │                           │
│       ▼            ▼            ▼                           │
│  ┌────────┐  ┌────────┐  ┌────────┐                        │
│  │  DB A  │  │  DB B  │  │  DB C  │  ← Independence       │
│  └────────┘  └────────┘  └────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Data Access Rules

1. **Never share databases** between services
2. **Access data through APIs** only
3. **Duplicate data if needed** (eventual consistency)
4. **Use events** to sync data between services

---

## 4. Lightweight Communication

### What It Means

Services communicate using simple, lightweight protocols. No heavy middleware.

### Communication Styles

```
┌─────────────────────────────────────────────────────────────┐
│              LIGHTWEIGHT COMMUNICATION                       │
│                                                              │
│  Synchronous:                                               │
│  ────────────                                               │
│  - REST over HTTP (most common)                             │
│  - gRPC (high performance)                                  │
│  - GraphQL (flexible queries)                               │
│                                                              │
│  Asynchronous:                                              │
│  ─────────────                                              │
│  - Message queues (RabbitMQ, SQS)                          │
│  - Event streaming (Kafka, Redis Streams)                   │
│  - Pub/Sub patterns                                         │
│                                                              │
│  NOT Lightweight:                                           │
│  ────────────────                                           │
│  - SOAP/XML                                                 │
│  - Enterprise Service Bus (ESB)                             │
│  - Heavy middleware                                         │
└─────────────────────────────────────────────────────────────┘
```

### Smart Endpoints, Dumb Pipes

```
SOA (Smart Pipes):
──────────────────
┌─────────┐     ┌─────────────────────────┐     ┌─────────┐
│ Service │ ──▶ │  ESB (routing, trans-   │ ──▶ │ Service │
│    A    │     │  formation, logic)      │     │    B    │
└─────────┘     └─────────────────────────┘     └─────────┘
                         ▲
                    Complex logic in pipe

Microservices (Dumb Pipes):
───────────────────────────
┌─────────┐     ┌─────────────────────────┐     ┌─────────┐
│ Service │ ──▶ │  Simple message broker  │ ──▶ │ Service │
│    A    │     │  (just delivers msgs)   │     │    B    │
└─────────┘     └─────────────────────────┘     └─────────┘
     ▲                                               ▲
  Logic here                                    Logic here
```

---

## 5. Independently Deployable

### What It Means

You can deploy a service without deploying any other service. No coordination required.

### Deployment Independence

```
┌─────────────────────────────────────────────────────────────┐
│               INDEPENDENT DEPLOYMENT                         │
│                                                              │
│  Monday:    Deploy User Service v2.1                        │
│  Tuesday:   Deploy Order Service v3.0                       │
│  Wednesday: Deploy Payment Service v1.5                     │
│  Thursday:  Rollback Payment Service to v1.4                │
│  Friday:    Deploy User Service v2.2                        │
│                                                              │
│  Each deployment is independent.                            │
│  No need to coordinate with other teams.                    │
│  Rollback affects only that service.                        │
└─────────────────────────────────────────────────────────────┘
```

### Requirements for Independence

- **Backward compatible APIs**
- **Versioned APIs** when breaking changes needed
- **Feature flags** for gradual rollouts
- **Independent CI/CD pipelines**

---

## 6. Decentralized Governance

### What It Means

No central authority dictates technology choices. Teams make their own decisions.

### Centralized vs Decentralized

```
┌─────────────────────────────────────────────────────────────┐
│                    GOVERNANCE MODELS                         │
│                                                              │
│  CENTRALIZED:                   DECENTRALIZED:              │
│  ────────────                   ──────────────              │
│                                                              │
│  ┌─────────────────┐           Teams decide:               │
│  │ Architecture    │           - Programming language      │
│  │ Review Board    │           - Framework                 │
│  │                 │           - Database                  │
│  │ Approves all    │           - Libraries                 │
│  │ tech decisions  │                                       │
│  └─────────────────┘           Shared standards:           │
│         │                      - API contracts             │
│         ▼                      - Security requirements     │
│  All teams must                - Observability             │
│  use Java + Oracle             - Communication protocols   │
└─────────────────────────────────────────────────────────────┘
```

### What to Standardize

- API design guidelines
- Security standards
- Logging format
- Health check endpoints
- Deployment practices

### What to Leave Flexible

- Programming language
- Database choice
- Internal architecture
- Testing frameworks
- Development tools

---

## 7. Failure Isolation

### What It Means

When a service fails, the failure is contained. It does not cascade to other services.

### Failure Isolation Patterns

```
┌─────────────────────────────────────────────────────────────┐
│                   FAILURE ISOLATION                          │
│                                                              │
│  Without Isolation:                                         │
│  ──────────────────                                         │
│                                                              │
│  Service A ──▶ Service B ──▶ Service C                     │
│                    │                                         │
│                    ▼                                         │
│               Service B FAILS                               │
│                    │                                         │
│                    ▼                                         │
│  Service A hangs waiting... System DOWN                     │
│                                                              │
│  With Isolation:                                            │
│  ───────────────                                            │
│                                                              │
│  Service A ──▶ Service B ──▶ Service C                     │
│       │            │                                         │
│       │            ▼                                         │
│       │       Service B FAILS                               │
│       │            │                                         │
│       ▼            ▼                                         │
│  Circuit breaker   Timeout                                  │
│  returns fallback  triggers                                 │
│                                                              │
│  Service A continues with degraded functionality            │
└─────────────────────────────────────────────────────────────┘
```

### Isolation Techniques

- **Timeouts**: Don't wait forever
- **Circuit Breakers**: Stop calling failing services
- **Bulkheads**: Isolate resources per service
- **Fallbacks**: Provide default responses
- **Retry with backoff**: Handle transient failures

---

## 8. Observable

### What It Means

You can understand what is happening inside the system through logs, metrics, and traces.

### Three Pillars of Observability

```
┌─────────────────────────────────────────────────────────────┐
│                THREE PILLARS OF OBSERVABILITY                │
│                                                              │
│  ┌─────────────────┐                                        │
│  │      LOGS       │  What happened?                        │
│  │                 │  - Error messages                      │
│  │  [timestamp]    │  - Request details                     │
│  │  [level]        │  - Debug information                   │
│  │  [message]      │                                        │
│  └─────────────────┘                                        │
│                                                              │
│  ┌─────────────────┐                                        │
│  │     METRICS     │  How is it performing?                 │
│  │                 │  - Request rate                        │
│  │  ───────────    │  - Error rate                          │
│  │  ──────         │  - Latency                             │
│  │  ────────────   │  - Resource usage                      │
│  └─────────────────┘                                        │
│                                                              │
│  ┌─────────────────┐                                        │
│  │     TRACES      │  How do requests flow?                 │
│  │                 │  - Request path                        │
│  │  A ──▶ B ──▶ C  │  - Service dependencies               │
│  │     └──▶ D      │  - Latency breakdown                   │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

### Observability Requirements

- Structured logging (JSON format)
- Correlation IDs across services
- Health check endpoints
- Metrics endpoints (/metrics)
- Distributed tracing integration

---

## 9. Automation-First

### What It Means

Everything is automated: builds, tests, deployments, infrastructure.

### Automation Requirements

```
┌─────────────────────────────────────────────────────────────┐
│                   AUTOMATION REQUIREMENTS                    │
│                                                              │
│  Code ──▶ Build ──▶ Test ──▶ Deploy ──▶ Monitor            │
│    │        │        │         │          │                 │
│    ▼        ▼        ▼         ▼          ▼                 │
│  Git     Docker    Unit     Kubernetes  Prometheus         │
│  hooks   build     tests    deployment  alerts             │
│          CI/CD     E2E      Helm/Kustomize                 │
│                    Contract                                 │
│                                                              │
│  Manual processes don't scale with microservices.          │
└─────────────────────────────────────────────────────────────┘
```

### What to Automate

- **Build**: Automated builds on commit
- **Test**: Automated test suites
- **Deploy**: One-click or automatic deployments
- **Scale**: Auto-scaling based on metrics
- **Recovery**: Automatic restarts on failure
- **Rollback**: Automatic rollback on errors

---

## Characteristics Checklist

Use this checklist when designing microservices:

```
┌─────────────────────────────────────────────────────────────┐
│              MICROSERVICE DESIGN CHECKLIST                   │
│                                                              │
│  [ ] Does it have a single, clear responsibility?           │
│  [ ] Can it function if other services are down?            │
│  [ ] Does it own its data exclusively?                      │
│  [ ] Does it use lightweight communication?                 │
│  [ ] Can it be deployed independently?                      │
│  [ ] Can the team make technology decisions?                │
│  [ ] Are failures isolated from other services?             │
│  [ ] Is it observable (logs, metrics, traces)?              │
│  [ ] Is everything automated?                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Single responsibility** keeps services focused and maintainable
2. **Autonomy** reduces dependencies and improves resilience
3. **Data ownership** prevents coupling through shared databases
4. **Lightweight communication** avoids middleware complexity
5. **Independent deployment** enables fast, safe releases
6. **Decentralized governance** empowers teams
7. **Failure isolation** prevents cascading failures
8. **Observability** enables understanding and debugging
9. **Automation** is essential at scale

---

## What's Next?

In the next lesson, we will discuss when to use microservices and when to avoid them.

---
