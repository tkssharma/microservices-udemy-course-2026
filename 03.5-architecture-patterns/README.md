# Module 3.5: Top Architecture Patterns for Microservices

## Overview

This module covers the most popular and essential architecture patterns that every microservices developer should know. These patterns solve common challenges in distributed systems including communication, resilience, data management, deployment, and security.

---

## Lessons

| #   | Lesson                                                         | Patterns Covered                          |
| --- | -------------------------------------------------------------- | ----------------------------------------- |
| 1   | [API Gateway & BFF](./01-api-gateway-bff.md)                   | API Gateway, Backend for Frontend         |
| 2   | [Sidecar & Ambassador](./02-sidecar-ambassador.md)             | Sidecar, Ambassador                       |
| 3   | [Circuit Breaker & Bulkhead](./03-circuit-breaker-bulkhead.md) | Circuit Breaker, Bulkhead, Retry          |
| 4   | [Strangler Fig](./04-strangler-fig.md)                         | Strangler Fig, Anti-Corruption Layer      |
| 5   | [Event Sourcing & CQRS](./05-event-sourcing-cqrs.md)           | Event Sourcing, CQRS                      |
| 6   | [Saga Pattern](./06-saga-pattern.md)                           | Choreography, Orchestration               |
| 7   | [Outbox Pattern](./07-outbox-pattern.md)                       | Transactional Outbox, CDC                 |
| 8   | [Service Discovery](./08-service-discovery.md)                 | Client-side, Server-side Discovery        |
| 9   | [Database per Service](./09-database-per-service.md)           | Database per Service, Shared Database     |
| 10  | [Externalized Configuration](./10-externalized-config.md)      | Config Server, Feature Flags              |
| 11  | [Container Deployment](./11-container-deployment.md)           | Docker, Kubernetes, Deployment Strategies |
| 12  | [Serverless Microservices](./12-serverless-microservices.md)   | FaaS, Lambda, Event-driven                |
| 13  | [Event-Driven Architecture](./13-event-driven-architecture.md) | Kafka, RabbitMQ, Pub/Sub                  |
| 14  | [Service Mesh](./14-service-mesh.md)                           | Istio, Linkerd, mTLS                      |
| 15  | [Zero Trust Security](./15-zero-trust-security.md)             | JWT, mTLS, Authorization                  |

---

## Patterns at a Glance

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE PATTERNS OVERVIEW                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  COMMUNICATION              RESILIENCE              DATA MANAGEMENT      │
│  ┌─────────────┐           ┌─────────────┐         ┌─────────────┐      │
│  │ API Gateway │           │  Circuit    │         │  Database   │      │
│  │ BFF/Sidecar │           │  Breaker    │         │ per Service │      │
│  └─────────────┘           │  Bulkhead   │         │   Outbox    │      │
│                            └─────────────┘         │  CQRS/ES    │      │
│                                                    └─────────────┘      │
│  DEPLOYMENT                 TRANSACTIONS            SECURITY            │
│  ┌─────────────┐           ┌─────────────┐         ┌─────────────┐      │
│  │ Containers  │           │    Saga     │         │ Zero Trust  │      │
│  │ Serverless  │           │   Events    │         │Service Mesh │      │
│  │ Kubernetes  │           └─────────────┘         │    mTLS     │      │
│  └─────────────┘                                   └─────────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🏆 Modern Production Stack (2026)

```
Containers (Docker) → Kubernetes → API Gateway → Event-driven (Kafka) → CI/CD → Observability + Service Mesh
```

---

## 🎯 Quick Decision Guide

| Scale             | Recommended Pattern             |
| ----------------- | ------------------------------- |
| **Small Startup** | Serverless                      |
| **Growing SaaS**  | Containers + Kubernetes         |
| **Enterprise**    | Kubernetes + Service Mesh + EDA |
| **FinTech**       | CQRS + Event Sourcing           |

---

## Learning Objectives

By the end of this module, you will be able to:

- ✅ Understand when and why to use each pattern
- ✅ Implement patterns using Node.js and NestJS
- ✅ Recognize anti-patterns and common pitfalls
- ✅ Combine patterns effectively for real-world scenarios
- ✅ Make informed architectural decisions

---

## Pattern Categories

### 1. Communication Patterns

- **API Gateway** - Single entry point for all clients
- **Backend for Frontend (BFF)** - Dedicated backends for different clients

### 2. Decomposition Patterns

- **Strangler Fig** - Incremental migration from monolith
- **Anti-Corruption Layer** - Isolate legacy systems

### 3. Resilience Patterns

- **Circuit Breaker** - Prevent cascade failures
- **Bulkhead** - Isolate failures to components
- **Retry with Backoff** - Handle transient failures

### 4. Data Management Patterns

- **Database per Service** - Service owns its data
- **Outbox Pattern** - Reliable event publishing
- **Event Sourcing** - Store state as events
- **CQRS** - Separate read and write models

### 5. Transaction Patterns

- **Saga** - Distributed transactions via compensation

### 6. Infrastructure Patterns

- **Sidecar** - Extend service functionality
- **Service Discovery** - Dynamic service location
- **Externalized Configuration** - Centralized config management

---

## Prerequisites

- Basic understanding of microservices concepts
- Familiarity with Node.js/NestJS
- Knowledge of REST APIs and messaging
- Docker basics

---

## Folder Structure

```
03.5-architecture-patterns/
├── README.md
├── 01-api-gateway-bff.md
├── 02-sidecar-ambassador.md
├── 03-circuit-breaker-bulkhead.md
├── 04-strangler-fig.md
├── 05-event-sourcing-cqrs.md
├── 06-saga-pattern.md
├── 07-outbox-pattern.md
├── 08-service-discovery.md
├── 09-database-per-service.md
└── 10-externalized-config.md
```

---

## Quick Reference: When to Use Each Pattern

| Pattern                 | Use When...                                         |
| ----------------------- | --------------------------------------------------- |
| **API Gateway**         | Multiple clients need unified API access            |
| **BFF**                 | Different clients have different data needs         |
| **Circuit Breaker**     | Services may fail or become slow                    |
| **Bulkhead**            | Need to isolate critical resources                  |
| **Strangler Fig**       | Migrating from monolith incrementally               |
| **Saga**                | Need distributed transactions                       |
| **CQRS**                | Read and write workloads differ significantly       |
| **Event Sourcing**      | Need complete audit trail                           |
| **Outbox**              | Need reliable event publishing with DB transactions |
| **Sidecar**             | Adding cross-cutting concerns without code changes  |
| **Service Discovery**   | Services scale dynamically                          |
| **Externalized Config** | Config varies across environments                   |
