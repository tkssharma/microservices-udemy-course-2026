# Lesson 2.1: Understanding Your Monolith

## Introduction

Before migrating to microservices, you must deeply understand your existing monolith. This lesson teaches you how to analyze your monolith to identify what to migrate and in what order.

---

## Why Understanding Matters

```
┌─────────────────────────────────────────────────────────────┐
│                 MIGRATION WITHOUT UNDERSTANDING              │
│                                                              │
│  "Let's just split it into services!"                       │
│                                                              │
│  Result:                                                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                     │
│  │ Service │◀─│ Service │◀─│ Service │                     │
│  │    A    │─▶│    B    │─▶│    C    │                     │
│  └────┬────┘  └────┬────┘  └────┬────┘                     │
│       │            │            │                           │
│       └────────────┼────────────┘                           │
│                    ▼                                         │
│            ┌──────────────┐                                 │
│            │  Shared DB   │                                 │
│            └──────────────┘                                 │
│                                                              │
│  = Distributed Monolith (worst of both worlds)              │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Map Your Codebase

### Create a Module Map

Identify the major modules/components in your monolith:

```
┌─────────────────────────────────────────────────────────────┐
│                    E-COMMERCE MONOLITH                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Modules                            │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │  /src                                                 │   │
│  │  ├── /users          (User management)               │   │
│  │  ├── /products       (Product catalog)               │   │
│  │  ├── /orders         (Order processing)              │   │
│  │  ├── /payments       (Payment handling)              │   │
│  │  ├── /inventory      (Stock management)              │   │
│  │  ├── /shipping       (Delivery tracking)             │   │
│  │  ├── /notifications  (Email, SMS)                    │   │
│  │  ├── /analytics      (Reporting)                     │   │
│  │  └── /admin          (Back office)                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Questions to Answer

- What are the main functional areas?
- How are they organized in code?
- Which areas have the most code?
- Which areas change most frequently?

---

## Step 2: Analyze Dependencies

### Create a Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                   DEPENDENCY ANALYSIS                        │
│                                                              │
│                    ┌──────────┐                             │
│                    │  Orders  │                             │
│                    └────┬─────┘                             │
│           ┌─────────────┼─────────────┐                     │
│           │             │             │                     │
│           ▼             ▼             ▼                     │
│     ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│     │  Users   │  │ Products │  │ Payments │              │
│     └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│          │             │             │                      │
│          │             ▼             │                      │
│          │       ┌──────────┐        │                      │
│          │       │Inventory │        │                      │
│          │       └──────────┘        │                      │
│          │                           │                      │
│          └───────────┬───────────────┘                      │
│                      ▼                                       │
│               ┌──────────────┐                              │
│               │ Notifications│                              │
│               └──────────────┘                              │
│                                                              │
│  Arrows show "depends on" relationships                     │
└─────────────────────────────────────────────────────────────┘
```

### Dependency Types

1. **Code Dependencies**: Direct function/class imports
2. **Data Dependencies**: Shared database tables
3. **Runtime Dependencies**: Services called at runtime

### Tools for Analysis

```bash
# For Node.js projects
npx madge --image graph.svg src/

# For TypeScript
npx dependency-cruiser --output-type dot src | dot -T svg > deps.svg

# Database dependencies
# Analyze foreign keys and joins in queries
```

---

## Step 3: Identify Data Ownership

### Map Tables to Modules

```
┌─────────────────────────────────────────────────────────────┐
│                    DATA OWNERSHIP MAP                        │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Module      │ Tables                               │    │
│  ├────────────────────────────────────────────────────┤    │
│  │ Users       │ users, user_profiles, addresses      │    │
│  │ Products    │ products, categories, product_images │    │
│  │ Orders      │ orders, order_items, order_history   │    │
│  │ Payments    │ payments, refunds, payment_methods   │    │
│  │ Inventory   │ inventory, stock_movements           │    │
│  │ Shipping    │ shipments, tracking, carriers        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Problem Areas (shared tables):                             │
│  - orders.user_id → users.id (foreign key)                 │
│  - order_items.product_id → products.id (foreign key)      │
│  - payments.order_id → orders.id (foreign key)             │
└─────────────────────────────────────────────────────────────┘
```

### Identify Shared Data

```
┌─────────────────────────────────────────────────────────────┐
│                    SHARED DATA PROBLEM                       │
│                                                              │
│  Orders module directly queries:                            │
│  - users table (to get user email)                          │
│  - products table (to get product price)                    │
│  - inventory table (to check stock)                         │
│                                                              │
│  This creates tight coupling!                               │
│                                                              │
│  ┌─────────┐                                                │
│  │ Orders  │──────┐                                         │
│  │ Module  │      │                                         │
│  └─────────┘      │                                         │
│       │           │                                         │
│       ▼           ▼                                         │
│  ┌─────────────────────────────────────────┐               │
│  │              DATABASE                    │               │
│  │  ┌───────┐ ┌───────┐ ┌───────┐         │               │
│  │  │ users │ │products│ │orders │         │               │
│  │  └───────┘ └───────┘ └───────┘         │               │
│  └─────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 4: Analyze Change Frequency

### Track What Changes Most

```
┌─────────────────────────────────────────────────────────────┐
│                   CHANGE FREQUENCY ANALYSIS                  │
│                                                              │
│  Use git to analyze commit frequency per module:            │
│                                                              │
│  $ git log --format=format: --name-only | \                │
│    grep -E '^src/' | \                                      │
│    cut -d/ -f2 | \                                          │
│    sort | uniq -c | sort -rn                                │
│                                                              │
│  Results:                                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Module        │ Commits (last 6 months) │ Trend    │    │
│  ├────────────────────────────────────────────────────┤    │
│  │ products      │ 450                     │ ████████ │    │
│  │ orders        │ 380                     │ ███████  │    │
│  │ users         │ 120                     │ ██       │    │
│  │ payments      │ 80                      │ █        │    │
│  │ inventory     │ 200                     │ ████     │    │
│  │ notifications │ 60                      │ █        │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  High change frequency = good extraction candidate          │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 5: Identify Pain Points

### Common Pain Points

```
┌─────────────────────────────────────────────────────────────┐
│                      PAIN POINT ANALYSIS                     │
│                                                              │
│  Performance Issues:                                        │
│  ──────────────────                                         │
│  [ ] Which modules are slow?                                │
│  [ ] Which queries are expensive?                           │
│  [ ] Where are the bottlenecks?                             │
│                                                              │
│  Scaling Issues:                                            │
│  ───────────────                                            │
│  [ ] Which parts need more resources?                       │
│  [ ] What causes scaling problems?                          │
│  [ ] CPU-bound or I/O-bound?                                │
│                                                              │
│  Development Issues:                                        │
│  ──────────────────                                         │
│  [ ] Which areas have most bugs?                            │
│  [ ] Where do teams conflict?                               │
│  [ ] What takes longest to test?                            │
│                                                              │
│  Deployment Issues:                                         │
│  ─────────────────                                          │
│  [ ] What breaks during deployments?                        │
│  [ ] What requires careful coordination?                    │
│  [ ] What has longest deployment time?                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 6: Create a Migration Priority Matrix

### Prioritization Framework

```
┌─────────────────────────────────────────────────────────────┐
│                  MIGRATION PRIORITY MATRIX                   │
│                                                              │
│                    Business Value                           │
│                    HIGH          LOW                        │
│                ┌───────────┬───────────┐                   │
│           HIGH │           │           │                   │
│   Ease of      │  DO FIRST │  CONSIDER │                   │
│   Extraction   │           │           │                   │
│                ├───────────┼───────────┤                   │
│           LOW  │           │           │                   │
│                │  PLAN FOR │   AVOID   │                   │
│                │           │           │                   │
│                └───────────┴───────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### Scoring Each Module

```
┌─────────────────────────────────────────────────────────────┐
│                    MODULE SCORING                            │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Module      │ Value │ Ease │ Risk │ Priority │ Order │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ Notifications│  3   │  5   │  1   │   HIGH   │   1   │   │
│  │ Analytics    │  2   │  4   │  1   │   MED    │   2   │   │
│  │ Products     │  5   │  3   │  2   │   HIGH   │   3   │   │
│  │ Inventory    │  4   │  3   │  3   │   MED    │   4   │   │
│  │ Orders       │  5   │  2   │  4   │   MED    │   5   │   │
│  │ Payments     │  5   │  2   │  5   │   LOW    │   6   │   │
│  │ Users        │  4   │  1   │  5   │   LOW    │   7   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Value: Business impact (1-5)                               │
│  Ease: How easy to extract (1-5)                            │
│  Risk: Risk of extraction (1-5)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 7: Document Current State

### Create Architecture Documentation

```
┌─────────────────────────────────────────────────────────────┐
│              CURRENT STATE DOCUMENTATION                     │
│                                                              │
│  1. System Context Diagram                                  │
│     - External systems                                      │
│     - User types                                            │
│     - Integration points                                    │
│                                                              │
│  2. Component Diagram                                       │
│     - Major modules                                         │
│     - Dependencies                                          │
│     - Data flows                                            │
│                                                              │
│  3. Data Model                                              │
│     - Entity relationships                                  │
│     - Table ownership                                       │
│     - Shared data                                           │
│                                                              │
│  4. Integration Points                                      │
│     - External APIs                                         │
│     - Third-party services                                  │
│     - Message queues                                        │
│                                                              │
│  5. Known Issues                                            │
│     - Technical debt                                        │
│     - Performance problems                                  │
│     - Scaling limitations                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Example: Analyzing a Real Monolith

### E-Commerce Monolith Analysis

```typescript
// Current monolith structure
src/
├── controllers/
│   ├── UserController.ts      // 800 lines
│   ├── ProductController.ts   // 1200 lines
│   ├── OrderController.ts     // 2000 lines  ← Largest, most complex
│   ├── PaymentController.ts   // 600 lines
│   └── ShippingController.ts  // 400 lines
├── services/
│   ├── UserService.ts
│   ├── ProductService.ts
│   ├── OrderService.ts        // Calls 5 other services
│   ├── PaymentService.ts
│   ├── InventoryService.ts
│   └── NotificationService.ts
├── models/
│   └── ... (all Sequelize models)
└── database/
    └── ... (single PostgreSQL)
```

### Dependency Analysis Result

```
┌─────────────────────────────────────────────────────────────┐
│                 ORDER SERVICE DEPENDENCIES                   │
│                                                              │
│  OrderService.ts imports:                                   │
│  ─────────────────────────                                  │
│  - UserService (get user details)                           │
│  - ProductService (get product info)                        │
│  - InventoryService (check/reserve stock)                   │
│  - PaymentService (process payment)                         │
│  - NotificationService (send confirmation)                  │
│                                                              │
│  Database queries:                                          │
│  ─────────────────                                          │
│  - SELECT from users                                        │
│  - SELECT from products                                     │
│  - UPDATE inventory                                         │
│  - INSERT into orders                                       │
│  - INSERT into payments                                     │
│                                                              │
│  Conclusion: OrderService is highly coupled                 │
│  Recommendation: Extract simpler services first             │
└─────────────────────────────────────────────────────────────┘
```

### Recommended Extraction Order

```
┌─────────────────────────────────────────────────────────────┐
│              RECOMMENDED EXTRACTION ORDER                    │
│                                                              │
│  1. NotificationService (lowest coupling, easy to extract) │
│     └── Sends emails/SMS, no business logic dependencies   │
│                                                              │
│  2. ProductService (read-heavy, clear boundaries)          │
│     └── Product catalog, categories, search                │
│                                                              │
│  3. InventoryService (clear domain, moderate coupling)     │
│     └── Stock levels, reservations                         │
│                                                              │
│  4. UserService (core service, many dependents)            │
│     └── Authentication, profiles, addresses                │
│                                                              │
│  5. PaymentService (high risk, needs careful planning)     │
│     └── Payment processing, refunds                        │
│                                                              │
│  6. OrderService (most complex, extract last)              │
│     └── Order orchestration, checkout flow                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Map your codebase** to understand module structure
2. **Analyze dependencies** to find coupling points
3. **Identify data ownership** to plan database separation
4. **Track change frequency** to find high-value extraction targets
5. **Document pain points** to prioritize what to fix
6. **Create a priority matrix** to plan extraction order
7. **Start with low-risk, high-value** extractions

---

## What's Next?

In the next lesson, we will learn Domain-Driven Design basics to help identify proper service boundaries.

---
