# Lesson 4.1: What is an API Gateway?

## Introduction

An API Gateway is a server that acts as the single entry point for all client requests in a microservices architecture. It sits between clients and backend services, routing requests to the appropriate service.

---

## The Problem Without a Gateway

```
┌─────────────────────────────────────────────────────────────┐
│              WITHOUT API GATEWAY                             │
│                                                              │
│  ┌──────────┐                                               │
│  │  Mobile  │──────┐                                        │
│  │   App    │      │                                        │
│  └──────────┘      │                                        │
│                    ├──▶ User Service (port 3001)            │
│  ┌──────────┐      │                                        │
│  │   Web    │──────┼──▶ Product Service (port 3002)         │
│  │   App    │      │                                        │
│  └──────────┘      ├──▶ Order Service (port 3003)           │
│                    │                                        │
│  ┌──────────┐      ├──▶ Payment Service (port 3004)         │
│  │  Third   │──────┘                                        │
│  │  Party   │                                               │
│  └──────────┘                                               │
│                                                              │
│  Problems:                                                  │
│  • Clients need to know all service URLs                    │
│  • Each service needs authentication                        │
│  • No centralized rate limiting                             │
│  • CORS issues with multiple origins                        │
│  • Protocol translation (HTTP/gRPC) per client              │
│  • Difficult to change service locations                    │
└─────────────────────────────────────────────────────────────┘
```

---

## The Solution: API Gateway

```
┌─────────────────────────────────────────────────────────────┐
│                WITH API GATEWAY                              │
│                                                              │
│  ┌──────────┐                                               │
│  │  Mobile  │──────┐                                        │
│  │   App    │      │                                        │
│  └──────────┘      │                                        │
│                    │      ┌─────────────────┐               │
│  ┌──────────┐      │      │                 │               │
│  │   Web    │──────┼─────▶│   API Gateway   │               │
│  │   App    │      │      │                 │               │
│  └──────────┘      │      └────────┬────────┘               │
│                    │               │                        │
│  ┌──────────┐      │               │                        │
│  │  Third   │──────┘      ┌────────┴────────┐               │
│  │  Party   │             │                 │               │
│  └──────────┘             ▼                 ▼               │
│                    ┌────────────┐    ┌────────────┐         │
│                    │   User     │    │  Product   │         │
│                    │  Service   │    │  Service   │         │
│                    └────────────┘    └────────────┘         │
│                    ┌────────────┐    ┌────────────┐         │
│                    │   Order    │    │  Payment   │         │
│                    │  Service   │    │  Service   │         │
│                    └────────────┘    └────────────┘         │
│                                                              │
│  Benefits:                                                  │
│  • Single entry point                                       │
│  • Centralized authentication                               │
│  • Rate limiting and throttling                             │
│  • Request routing                                          │
│  • Protocol translation                                     │
│  • Response aggregation                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## API Gateway Definition

```
┌─────────────────────────────────────────────────────────────┐
│                  API GATEWAY DEFINITION                      │
│                                                              │
│  An API Gateway is a service that:                          │
│                                                              │
│  1. Receives all client requests                            │
│  2. Routes requests to appropriate backend services         │
│  3. Aggregates responses when needed                        │
│  4. Handles cross-cutting concerns:                         │
│     • Authentication & Authorization                        │
│     • Rate limiting                                         │
│     • Caching                                               │
│     • Logging & Monitoring                                  │
│     • Request/Response transformation                       │
│                                                              │
│  Think of it as:                                            │
│  • A reverse proxy with intelligence                        │
│  • A facade for your microservices                          │
│  • The front door to your system                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Real-World Analogy

```
┌─────────────────────────────────────────────────────────────┐
│                  HOTEL RECEPTION ANALOGY                     │
│                                                              │
│  Without Reception (No Gateway):                            │
│  ───────────────────────────────                            │
│  Guest → Housekeeping (for towels)                          │
│  Guest → Kitchen (for food)                                 │
│  Guest → Maintenance (for repairs)                          │
│  Guest → Accounting (for billing)                           │
│                                                              │
│  Guest needs to know where everything is!                   │
│                                                              │
│  With Reception (API Gateway):                              │
│  ─────────────────────────────                              │
│  Guest → Reception → Appropriate Department                 │
│                                                              │
│  Reception handles:                                         │
│  • Verifying guest identity (authentication)                │
│  • Routing requests to right department                     │
│  • Coordinating multiple departments                        │
│  • Translating guest requests                               │
│  • Logging all requests                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Gateway vs Load Balancer vs Reverse Proxy

```
┌─────────────────────────────────────────────────────────────┐
│         GATEWAY vs LOAD BALANCER vs REVERSE PROXY            │
│                                                              │
│  Reverse Proxy (nginx):                                     │
│  ──────────────────────                                     │
│  • Forwards requests to backend servers                     │
│  • SSL termination                                          │
│  • Basic caching                                            │
│  • No application logic                                     │
│                                                              │
│  Load Balancer:                                             │
│  ──────────────                                             │
│  • Distributes traffic across instances                     │
│  • Health checking                                          │
│  • Round-robin, least connections, etc.                     │
│  • Layer 4 (TCP) or Layer 7 (HTTP)                          │
│                                                              │
│  API Gateway:                                               │
│  ────────────                                               │
│  • All of the above, PLUS:                                  │
│  • Authentication & Authorization                           │
│  • Rate limiting per client/API                             │
│  • Request/Response transformation                          │
│  • API versioning                                           │
│  • Response aggregation                                     │
│  • Protocol translation                                     │
│  • Developer portal & documentation                         │
│                                                              │
│  API Gateway = Reverse Proxy + Load Balancer + More         │
└─────────────────────────────────────────────────────────────┘
```

---

## Popular API Gateway Solutions

```
┌─────────────────────────────────────────────────────────────┐
│              API GATEWAY OPTIONS                             │
│                                                              │
│  Cloud-Native:                                              │
│  ─────────────                                              │
│  • AWS API Gateway                                          │
│  • Azure API Management                                     │
│  • Google Cloud Endpoints                                   │
│                                                              │
│  Open Source:                                               │
│  ────────────                                               │
│  • Kong                                                     │
│  • Traefik                                                  │
│  • Express Gateway                                          │
│  • KrakenD                                                  │
│  • Tyk                                                      │
│                                                              │
│  Service Mesh (includes gateway):                           │
│  ────────────────────────────────                           │
│  • Istio                                                    │
│  • Linkerd                                                  │
│  • Consul Connect                                           │
│                                                              │
│  Custom:                                                    │
│  ───────                                                    │
│  • Express.js + http-proxy-middleware                       │
│  • Fastify                                                  │
│  • Node.js native                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## When to Use an API Gateway

```
┌─────────────────────────────────────────────────────────────┐
│              WHEN TO USE API GATEWAY                         │
│                                                              │
│  Use When:                                                  │
│  ──────────                                                 │
│  ✓ Multiple microservices                                   │
│  ✓ Multiple client types (web, mobile, third-party)         │
│  ✓ Need centralized authentication                          │
│  ✓ Need rate limiting                                       │
│  ✓ Need request aggregation                                 │
│  ✓ Need protocol translation                                │
│                                                              │
│  May Not Need When:                                         │
│  ──────────────────                                         │
│  ✗ Single service (monolith)                                │
│  ✗ Internal services only                                   │
│  ✗ Simple proxy is sufficient                               │
│  ✗ Using service mesh for all features                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Gateway Architecture Patterns

### Single Gateway

```
┌─────────────────────────────────────────────────────────────┐
│              SINGLE GATEWAY                                  │
│                                                              │
│  All clients → One Gateway → All Services                   │
│                                                              │
│  ┌────────┐                                                 │
│  │ Client │──┐                                              │
│  └────────┘  │     ┌─────────┐     ┌─────────────┐         │
│              ├────▶│ Gateway │────▶│  Services   │         │
│  ┌────────┐  │     └─────────┘     └─────────────┘         │
│  │ Client │──┘                                              │
│  └────────┘                                                 │
│                                                              │
│  Pros: Simple, single point of management                  │
│  Cons: Single point of failure, can become bottleneck      │
└─────────────────────────────────────────────────────────────┘
```

### Multiple Gateways (BFF)

```
┌─────────────────────────────────────────────────────────────┐
│              BACKEND FOR FRONTEND (BFF)                      │
│                                                              │
│  Different gateway per client type                          │
│                                                              │
│  ┌────────┐     ┌─────────────┐                            │
│  │  Web   │────▶│ Web Gateway │──┐                         │
│  └────────┘     └─────────────┘  │                         │
│                                   │     ┌─────────────┐    │
│  ┌────────┐     ┌─────────────┐  ├────▶│  Services   │    │
│  │ Mobile │────▶│Mobile Gatew │──┤     └─────────────┘    │
│  └────────┘     └─────────────┘  │                         │
│                                   │                         │
│  ┌────────┐     ┌─────────────┐  │                         │
│  │  IoT   │────▶│ IoT Gateway │──┘                         │
│  └────────┘     └─────────────┘                            │
│                                                              │
│  Pros: Optimized per client, independent scaling           │
│  Cons: More complexity, code duplication                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **API Gateway is the single entry point** for all client requests
2. **Handles cross-cutting concerns** - auth, rate limiting, logging
3. **Routes requests** to appropriate backend services
4. **Different from load balancer** - has application-level intelligence
5. **Multiple patterns exist** - single gateway, BFF, service mesh
6. **Choose based on needs** - complexity vs simplicity trade-off

---

## What's Next?

In the next lesson, we will explore the specific responsibilities of an API Gateway in detail.

---
