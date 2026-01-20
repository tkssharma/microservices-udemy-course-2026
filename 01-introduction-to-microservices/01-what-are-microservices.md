# Lesson 1.1: What are Microservices?

## Introduction

Microservices architecture is a way of building software applications as a collection of small, independent services. Each service runs in its own process, owns its own data, and communicates with other services through well-defined APIs.

Think of it like a city. Instead of one massive building that handles everything (a monolith), you have specialized buildings: hospitals for healthcare, schools for education, banks for finance. Each operates independently but together they form a functioning city.

---

## Simple Definition

**Microservices** = Small, focused services that:

- Do one thing well
- Run independently
- Communicate over a network
- Can be deployed separately
- Own their own data

---

## Visual Representation

```
┌─────────────────────────────────────────────────────────────────┐
│                        MONOLITH                                  │
│  ┌─────────┬─────────┬─────────┬─────────┬─────────┐           │
│  │  User   │  Order  │ Payment │ Product │  Email  │           │
│  │ Module  │ Module  │ Module  │ Module  │ Module  │           │
│  └─────────┴─────────┴─────────┴─────────┴─────────┘           │
│                    Single Database                               │
│                    Single Deployment                             │
└─────────────────────────────────────────────────────────────────┘

                              vs

┌─────────────────────────────────────────────────────────────────┐
│                      MICROSERVICES                               │
│                                                                  │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │  User   │  │  Order  │  │ Payment │  │ Product │            │
│  │ Service │  │ Service │  │ Service │  │ Service │            │
│  │   DB    │  │   DB    │  │   DB    │  │   DB    │            │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘            │
│       ▲            ▲            ▲            ▲                  │
│       └────────────┴─────┬──────┴────────────┘                  │
│                          │                                       │
│                    API Gateway                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why Do Microservices Exist?

### The Problem with Large Applications

As applications grow, monolithic architectures face challenges:

1. **Slow Development**: Large codebase means longer build times
2. **Risky Deployments**: One small change requires deploying everything
3. **Scaling Issues**: Cannot scale individual components
4. **Technology Lock-in**: Entire app uses same language/framework
5. **Team Bottlenecks**: Teams step on each other's code

### The Solution

Microservices solve these by breaking the application into smaller, manageable pieces that can evolve independently.

---

## Real-World Examples

### E-Commerce Platform (Amazon-style)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Product    │     │   Shopping   │     │   Payment    │
│   Catalog    │     │     Cart     │     │   Service    │
│   Service    │     │   Service    │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Search     │     │    Order     │     │   Shipping   │
│   Service    │     │   Service    │     │   Service    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    User      │     │   Inventory  │     │ Notification │
│   Service    │     │   Service    │     │   Service    │
└──────────────┘     └──────────────┘     └──────────────┘
```

### Streaming Platform (Netflix-style)

- **User Service**: Profiles, preferences, authentication
- **Content Service**: Movies, shows, metadata
- **Recommendation Service**: ML-based suggestions
- **Streaming Service**: Video delivery, encoding
- **Billing Service**: Subscriptions, payments
- **Analytics Service**: Viewing patterns, metrics

### Banking Application (Fintech)

- **Account Service**: Account management
- **Transaction Service**: Money transfers
- **Fraud Detection Service**: Real-time fraud analysis
- **Notification Service**: Alerts, statements
- **KYC Service**: Identity verification

---

## How Microservices Communicate

Services talk to each other through:

### 1. Synchronous Communication (Request-Response)

```
┌─────────┐  HTTP/REST   ┌─────────┐
│ Service │ ──────────▶  │ Service │
│    A    │ ◀──────────  │    B    │
└─────────┘   Response   └─────────┘
```

### 2. Asynchronous Communication (Events/Messages)

```
┌─────────┐              ┌─────────────┐              ┌─────────┐
│ Service │ ──publish──▶ │   Message   │ ──consume──▶ │ Service │
│    A    │              │    Broker   │              │    B    │
└─────────┘              └─────────────┘              └─────────┘
```

---

## A Simple Example

Imagine an online bookstore:

**Monolith Approach:**

```
BookstoreApp/
├── controllers/
│   ├── UserController
│   ├── BookController
│   ├── OrderController
│   └── PaymentController
├── models/
├── services/
└── database (single)
```

**Microservices Approach:**

```
User-Service/          (Port 3001)
├── src/
├── database (users)
└── Dockerfile

Book-Service/          (Port 3002)
├── src/
├── database (books)
└── Dockerfile

Order-Service/         (Port 3003)
├── src/
├── database (orders)
└── Dockerfile

Payment-Service/       (Port 3004)
├── src/
├── database (payments)
└── Dockerfile
```

---

## Key Takeaways

1. **Microservices are small, focused services** that do one thing well
2. **Each service is independent** with its own database and deployment
3. **Services communicate over network** using REST, gRPC, or messages
4. **They solve scaling and team problems** in large applications
5. **Not a silver bullet** - they add complexity in exchange for flexibility

---

## What's Next?

In the next lesson, we will compare microservices with monolithic architecture and Service-Oriented Architecture (SOA) to understand the evolution and differences.

---
