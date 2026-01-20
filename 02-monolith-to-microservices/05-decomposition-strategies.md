# Lesson 2.5: Decomposition Strategies

## Introduction

There are multiple strategies for decomposing a monolith into microservices. Each strategy has its use cases, benefits, and trade-offs. This lesson covers the most effective decomposition approaches.

---

## Overview of Strategies

```
┌─────────────────────────────────────────────────────────────┐
│              DECOMPOSITION STRATEGIES                        │
│                                                              │
│  1. By Business Capability                                  │
│  2. By Subdomain (DDD)                                      │
│  3. By Use Case / User Journey                              │
│  4. By Data Ownership                                       │
│  5. By Team Structure                                       │
│  6. By Change Frequency                                     │
│  7. By Scalability Requirements                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Strategy 1: Decompose by Business Capability

### Concept

Align services with what the business does, not how it's implemented.

```
┌─────────────────────────────────────────────────────────────┐
│            DECOMPOSE BY BUSINESS CAPABILITY                  │
│                                                              │
│  Business Capabilities:                                     │
│  ──────────────────────                                     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    E-COMMERCE                        │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │                                                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ Product  │  │  Order   │  │ Customer │          │   │
│  │  │Management│  │Management│  │Management│          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  │                                                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ Payment  │  │ Shipping │  │ Marketing│          │   │
│  │  │Processing│  │ Logistics│  │ Promotion│          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Each capability becomes a service or group of services.   │
└─────────────────────────────────────────────────────────────┘
```

### How to Identify Capabilities

1. Talk to business stakeholders
2. Look at organizational structure
3. Analyze business processes
4. Review existing documentation

### Example Mapping

```
┌─────────────────────────────────────────────────────────────┐
│         CAPABILITY TO SERVICE MAPPING                        │
│                                                              │
│  Capability              Services                           │
│  ──────────              ────────                           │
│  Product Management  →   Product Catalog Service            │
│                          Product Search Service             │
│                          Category Service                   │
│                                                              │
│  Order Management    →   Order Service                      │
│                          Cart Service                       │
│                          Checkout Service                   │
│                                                              │
│  Payment Processing  →   Payment Service                    │
│                          Refund Service                     │
│                          Fraud Detection Service            │
│                                                              │
│  Shipping Logistics  →   Shipping Service                   │
│                          Tracking Service                   │
│                          Carrier Integration Service        │
└─────────────────────────────────────────────────────────────┘
```

### Pros and Cons

```
Pros:
- Aligns with business organization
- Stable boundaries (business capabilities rarely change)
- Clear ownership

Cons:
- May not match current code structure
- Requires business domain knowledge
- Some capabilities span multiple technical areas
```

---

## Strategy 2: Decompose by Subdomain (DDD)

### Concept

Use Domain-Driven Design to identify subdomains and bounded contexts.

```
┌─────────────────────────────────────────────────────────────┐
│              DECOMPOSE BY SUBDOMAIN                          │
│                                                              │
│  Domain Types:                                              │
│  ─────────────                                              │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CORE DOMAIN                                          │   │
│  │ What makes your business unique                      │   │
│  │ Example: Recommendation Engine, Pricing Algorithm    │   │
│  │ → Build in-house, invest heavily                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SUPPORTING DOMAIN                                    │   │
│  │ Necessary but not differentiating                    │   │
│  │ Example: Inventory Management, Order Processing      │   │
│  │ → Build or buy, moderate investment                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ GENERIC DOMAIN                                       │   │
│  │ Common across industries                             │   │
│  │ Example: Authentication, Email, Payments             │   │
│  │ → Buy or use SaaS, minimal investment                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Example: E-Commerce Subdomains

```
┌─────────────────────────────────────────────────────────────┐
│              E-COMMERCE SUBDOMAINS                           │
│                                                              │
│  Core Domain:                                               │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Recommendation  │  │    Pricing      │                  │
│  │    Engine       │  │   Optimization  │                  │
│  └─────────────────┘  └─────────────────┘                  │
│  (Competitive advantage - build in-house)                   │
│                                                              │
│  Supporting Domain:                                         │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │    Catalog      │  │     Order       │                  │
│  │   Management    │  │   Processing    │                  │
│  └─────────────────┘  └─────────────────┘                  │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   Inventory     │  │    Shipping     │                  │
│  └─────────────────┘  └─────────────────┘                  │
│  (Important but not unique - build efficiently)             │
│                                                              │
│  Generic Domain:                                            │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Authentication  │  │     Email       │                  │
│  └─────────────────┘  └─────────────────┘                  │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │    Payments     │  │    Analytics    │                  │
│  │   (Stripe)      │  │   (Segment)     │                  │
│  └─────────────────┘  └─────────────────┘                  │
│  (Use third-party services)                                 │
└─────────────────────────────────────────────────────────────┘
```

### Pros and Cons

```
Pros:
- Focuses investment on core business
- Clear service boundaries
- Enables buy vs build decisions

Cons:
- Requires DDD expertise
- Time-consuming domain analysis
- May conflict with existing structure
```

---

## Strategy 3: Decompose by Use Case

### Concept

Identify user journeys and create services that support complete use cases.

```
┌─────────────────────────────────────────────────────────────┐
│              DECOMPOSE BY USE CASE                           │
│                                                              │
│  User Journey: "Purchase a Product"                         │
│  ───────────────────────────────────                        │
│                                                              │
│  ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐      │
│  │Browse│───▶│Search│───▶│ Add │───▶│Check│───▶│ Pay │      │
│  │     │    │     │    │Cart │    │ out │    │     │      │
│  └─────┘    └─────┘    └─────┘    └─────┘    └─────┘      │
│     │          │          │          │          │           │
│     ▼          ▼          ▼          ▼          ▼           │
│  ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐    ┌─────┐      │
│  │Catalog│  │Search│   │Cart │   │Order│   │Payment│      │
│  │Service│  │Service│  │Service│ │Service│  │Service│      │
│  └─────┘    └─────┘    └─────┘    └─────┘    └─────┘      │
│                                                              │
│  Each step in the journey maps to a service.               │
└─────────────────────────────────────────────────────────────┘
```

### Example: Multiple User Journeys

```
┌─────────────────────────────────────────────────────────────┐
│              USER JOURNEY ANALYSIS                           │
│                                                              │
│  Journey 1: Customer Purchase                               │
│  ─────────────────────────────                              │
│  Browse → Search → View → Add to Cart → Checkout → Pay     │
│  Services: Catalog, Search, Cart, Order, Payment            │
│                                                              │
│  Journey 2: Order Tracking                                  │
│  ─────────────────────────                                  │
│  View Orders → Track Shipment → Receive Notifications      │
│  Services: Order, Shipping, Notification                    │
│                                                              │
│  Journey 3: Return/Refund                                   │
│  ────────────────────────                                   │
│  Request Return → Ship Back → Process Refund               │
│  Services: Return, Shipping, Payment                        │
│                                                              │
│  Journey 4: Customer Support                                │
│  ───────────────────────────                                │
│  Create Ticket → Chat → Resolve → Rate                     │
│  Services: Support, Chat, Feedback                          │
└─────────────────────────────────────────────────────────────┘
```

### Pros and Cons

```
Pros:
- User-centric design
- Clear value delivery
- Easy to prioritize

Cons:
- May create overlapping services
- Some services used in multiple journeys
- Can lead to fine-grained services
```

---

## Strategy 4: Decompose by Data Ownership

### Concept

Identify data entities and group them into services that own related data.

```
┌─────────────────────────────────────────────────────────────┐
│              DECOMPOSE BY DATA OWNERSHIP                     │
│                                                              │
│  Step 1: List all entities                                  │
│  ─────────────────────────                                  │
│  User, Profile, Address, Product, Category, Order,         │
│  OrderItem, Payment, Shipment, Review, Cart                 │
│                                                              │
│  Step 2: Group by ownership                                 │
│  ──────────────────────────                                 │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  User Service   │  │ Product Service │                  │
│  │  ─────────────  │  │  ─────────────  │                  │
│  │  • User         │  │  • Product      │                  │
│  │  • Profile      │  │  • Category     │                  │
│  │  • Address      │  │  • Review       │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  Order Service  │  │ Payment Service │                  │
│  │  ─────────────  │  │  ─────────────  │                  │
│  │  • Order        │  │  • Payment      │                  │
│  │  • OrderItem    │  │  • Refund       │                  │
│  │  • Cart         │  │  • Transaction  │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Handling Shared Data

```
┌─────────────────────────────────────────────────────────────┐
│              HANDLING SHARED DATA                            │
│                                                              │
│  Problem: Order needs User email and Product name           │
│                                                              │
│  Solution 1: Store IDs only, fetch when needed              │
│  ─────────────────────────────────────────────              │
│  Order: { userId: "123", productIds: ["p1", "p2"] }        │
│  → Call User Service and Product Service when displaying   │
│                                                              │
│  Solution 2: Denormalize (copy) needed data                 │
│  ─────────────────────────────────────────                  │
│  Order: {                                                   │
│    userId: "123",                                           │
│    userEmail: "user@example.com",  // Copied               │
│    items: [{                                                │
│      productId: "p1",                                       │
│      productName: "Widget",         // Copied               │
│      priceAtPurchase: 29.99         // Snapshot            │
│    }]                                                       │
│  }                                                          │
│  → Update via events when source changes                    │
│                                                              │
│  Recommendation: Denormalize for read performance,          │
│  use events to keep data eventually consistent.             │
└─────────────────────────────────────────────────────────────┘
```

### Pros and Cons

```
Pros:
- Clear data ownership
- Avoids shared databases
- Natural service boundaries

Cons:
- Data duplication needed
- Eventual consistency complexity
- May not align with business view
```

---

## Strategy 5: Decompose by Team Structure

### Concept

Align services with team boundaries (Inverse Conway Maneuver).

```
┌─────────────────────────────────────────────────────────────┐
│              DECOMPOSE BY TEAM STRUCTURE                     │
│                                                              │
│  Current Teams:                                             │
│  ──────────────                                             │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Team: Storefront (5 people)                          │   │
│  │ Skills: Frontend, Node.js, React                     │   │
│  │ → Services: Catalog, Search, Cart                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Team: Fulfillment (4 people)                         │   │
│  │ Skills: Backend, Python, Logistics                   │   │
│  │ → Services: Order, Inventory, Shipping               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Team: Payments (3 people)                            │   │
│  │ Skills: Security, Compliance, Java                   │   │
│  │ → Services: Payment, Fraud, Billing                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Each team owns 2-4 services they can manage.              │
└─────────────────────────────────────────────────────────────┘
```

### Team Size Guidelines

```
┌─────────────────────────────────────────────────────────────┐
│                  TEAM SIZE GUIDELINES                        │
│                                                              │
│  Team Size        Services per Team                         │
│  ─────────        ─────────────────                         │
│  2-3 people   →   1-2 services                              │
│  4-6 people   →   2-4 services                              │
│  7-9 people   →   3-5 services                              │
│                                                              │
│  Rules:                                                     │
│  • One service = One owning team                            │
│  • Team can own multiple services                           │
│  • Service scope should match team capacity                 │
│  • Consider on-call burden                                  │
└─────────────────────────────────────────────────────────────┘
```

### Pros and Cons

```
Pros:
- Clear ownership
- Matches organizational reality
- Reduces coordination overhead

Cons:
- May not align with domain boundaries
- Team changes affect architecture
- Can create artificial boundaries
```

---

## Strategy 6: Decompose by Change Frequency

### Concept

Separate components that change frequently from those that are stable.

```
┌─────────────────────────────────────────────────────────────┐
│            DECOMPOSE BY CHANGE FREQUENCY                     │
│                                                              │
│  Analyze git history:                                       │
│  ────────────────────                                       │
│                                                              │
│  High Change Frequency:          Low Change Frequency:      │
│  ──────────────────────          ─────────────────────      │
│  • Pricing logic                 • User authentication      │
│  • Promotion engine              • Payment processing       │
│  • UI components                 • Core data models         │
│  • Search algorithms             • Infrastructure code      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  Stable Services          Volatile Services         │   │
│  │  ───────────────          ─────────────────         │   │
│  │  ┌─────────────┐          ┌─────────────┐          │   │
│  │  │    Auth     │          │   Pricing   │          │   │
│  │  │  (monthly)  │          │   (daily)   │          │   │
│  │  └─────────────┘          └─────────────┘          │   │
│  │  ┌─────────────┐          ┌─────────────┐          │   │
│  │  │   Payment   │          │  Promotions │          │   │
│  │  │  (monthly)  │          │   (daily)   │          │   │
│  │  └─────────────┘          └─────────────┘          │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Separate volatile from stable to enable faster releases.  │
└─────────────────────────────────────────────────────────────┘
```

### Pros and Cons

```
Pros:
- Faster releases for volatile components
- Stable components don't need frequent testing
- Reduces deployment risk

Cons:
- May not align with domain
- Change frequency can shift over time
- Requires ongoing analysis
```

---

## Strategy 7: Decompose by Scalability Requirements

### Concept

Separate components with different scaling needs.

```
┌─────────────────────────────────────────────────────────────┐
│          DECOMPOSE BY SCALABILITY REQUIREMENTS               │
│                                                              │
│  Analyze load patterns:                                     │
│  ──────────────────────                                     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Component        │ Load Pattern    │ Scale Need     │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Product Search   │ Read-heavy      │ 100x           │   │
│  │ Product Catalog  │ Read-heavy      │ 50x            │   │
│  │ User Auth        │ Burst           │ 10x            │   │
│  │ Order Creation   │ Write-heavy     │ 5x             │   │
│  │ Payment          │ Consistent      │ 3x             │   │
│  │ Admin Panel      │ Low             │ 1x             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Separate by scaling needs:                                 │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  High Scale     │  │  Medium Scale   │                  │
│  │  ───────────    │  │  ────────────   │                  │
│  │  Search (100x)  │  │  Auth (10x)     │                  │
│  │  Catalog (50x)  │  │  Order (5x)     │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
│  ┌─────────────────┐                                       │
│  │  Low Scale      │                                       │
│  │  ──────────     │                                       │
│  │  Payment (3x)   │                                       │
│  │  Admin (1x)     │                                       │
│  └─────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

### Pros and Cons

```
Pros:
- Optimized resource usage
- Cost-effective scaling
- Performance isolation

Cons:
- May not align with domain
- Scaling needs can change
- Requires load analysis
```

---

## Combining Strategies

### Recommended Approach

```
┌─────────────────────────────────────────────────────────────┐
│              COMBINING STRATEGIES                            │
│                                                              │
│  Step 1: Start with Business Capability                     │
│  ───────────────────────────────────────                    │
│  Identify major business capabilities                       │
│                                                              │
│  Step 2: Refine with DDD Subdomains                         │
│  ──────────────────────────────────                         │
│  Classify as Core, Supporting, Generic                      │
│                                                              │
│  Step 3: Validate with Data Ownership                       │
│  ─────────────────────────────────────                      │
│  Ensure each service owns its data                          │
│                                                              │
│  Step 4: Adjust for Team Structure                          │
│  ─────────────────────────────────                          │
│  Match services to team capacity                            │
│                                                              │
│  Step 5: Consider Scaling Needs                             │
│  ──────────────────────────────                             │
│  Split if scaling requirements differ significantly         │
│                                                              │
│  Result: Well-balanced service boundaries                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Decision Matrix

```
┌─────────────────────────────────────────────────────────────┐
│              STRATEGY DECISION MATRIX                        │
│                                                              │
│  Situation                      Best Strategy               │
│  ─────────                      ─────────────               │
│                                                              │
│  Clear business domains     →   Business Capability         │
│  Complex domain             →   DDD Subdomains              │
│  User-focused product       →   Use Case / Journey          │
│  Data-heavy application     →   Data Ownership              │
│  Existing team structure    →   Team Structure              │
│  Frequent releases needed   →   Change Frequency            │
│  High traffic variance      →   Scalability Requirements    │
│                                                              │
│  Most projects: Combine Business Capability + Data + Team   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **No single strategy is perfect** - Combine multiple approaches
2. **Start with business capability** - Most stable boundaries
3. **Validate with data ownership** - Avoid shared databases
4. **Consider team capacity** - Services need owners
5. **Iterate and refine** - Boundaries can evolve
6. **Document decisions** - Record why boundaries were chosen

---

## What's Next?

In the next lesson, we will cover migration best practices and common pitfalls to avoid.

---
