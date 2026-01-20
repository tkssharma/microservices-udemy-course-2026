# Lesson 2.3: Identifying Service Boundaries

## Introduction

Identifying the right service boundaries is the most critical decision in microservices architecture. Wrong boundaries lead to a distributed monolith. This lesson provides practical techniques for finding good boundaries.

---

## Why Boundaries Matter

```
┌─────────────────────────────────────────────────────────────┐
│                 BOUNDARY DECISIONS MATTER                    │
│                                                              │
│  Good Boundaries:                Bad Boundaries:             │
│  ───────────────                 ───────────────             │
│  - Independent teams             - Constant coordination     │
│  - Independent deployments       - Deploy together           │
│  - Clear ownership               - Shared ownership          │
│  - Loose coupling                - Tight coupling            │
│  - High cohesion                 - Low cohesion              │
│                                                              │
│  ┌───┐ ┌───┐ ┌───┐              ┌───┐◀──▶┌───┐◀──▶┌───┐   │
│  │ A │ │ B │ │ C │              │ A │    │ B │    │ C │   │
│  └───┘ └───┘ └───┘              └───┘    └───┘    └───┘   │
│  Independent                     Distributed Monolith       │
└─────────────────────────────────────────────────────────────┘
```

---

## Technique 1: Business Capability Mapping

### What is a Business Capability?

A business capability is what a business does, not how it does it.

```
┌─────────────────────────────────────────────────────────────┐
│              BUSINESS CAPABILITY MAP                         │
│                                                              │
│  E-Commerce Business Capabilities:                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 CUSTOMER FACING                      │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Product      │ Shopping   │ Checkout  │ Customer   │   │
│  │ Discovery    │ Experience │           │ Support    │   │
│  │              │            │           │            │   │
│  │ - Browse     │ - Cart     │ - Payment │ - Tickets  │   │
│  │ - Search     │ - Wishlist │ - Address │ - Chat     │   │
│  │ - Filter     │ - Compare  │ - Review  │ - Returns  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    OPERATIONS                        │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Inventory   │ Order      │ Shipping  │ Supplier   │   │
│  │ Management  │ Fulfillment│           │ Management │   │
│  │             │            │           │            │   │
│  │ - Stock     │ - Pick     │ - Carrier │ - Purchase │   │
│  │ - Reorder   │ - Pack     │ - Track   │ - Receive  │   │
│  │ - Warehouse │ - Ship     │ - Deliver │ - Quality  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                     FINANCE                          │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Billing     │ Accounting │ Fraud     │ Reporting  │   │
│  │             │            │ Detection │            │   │
│  │ - Invoice   │ - Ledger   │ - Rules   │ - Sales    │   │
│  │ - Payment   │ - Tax      │ - ML      │ - Finance  │   │
│  │ - Refund    │ - Audit    │ - Review  │ - Ops      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Mapping Capabilities to Services

```
┌─────────────────────────────────────────────────────────────┐
│            CAPABILITY → SERVICE MAPPING                      │
│                                                              │
│  Business Capability        Microservice                    │
│  ───────────────────        ────────────                    │
│  Product Discovery    ───▶  Product Catalog Service         │
│                             Search Service                  │
│                                                              │
│  Shopping Experience  ───▶  Cart Service                    │
│                             Wishlist Service                │
│                                                              │
│  Checkout             ───▶  Order Service                   │
│                             Payment Service                 │
│                                                              │
│  Inventory Management ───▶  Inventory Service               │
│                                                              │
│  Shipping             ───▶  Shipping Service                │
│                             Tracking Service                │
│                                                              │
│  Billing              ───▶  Billing Service                 │
│                             Invoice Service                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Technique 2: Bounded Context Analysis

### Finding Bounded Contexts

Look for areas where:

- Language changes (same word, different meaning)
- Different teams or departments own the area
- Different rules apply
- Different data models exist

```
┌─────────────────────────────────────────────────────────────┐
│              BOUNDED CONTEXT INDICATORS                      │
│                                                              │
│  Language Changes:                                          │
│  ─────────────────                                          │
│  Sales: "Customer" = person who buys                        │
│  Support: "Customer" = person with a ticket                 │
│  Shipping: "Customer" = delivery recipient                  │
│                                                              │
│  Different Rules:                                           │
│  ────────────────                                           │
│  Sales: Price can have discounts                            │
│  Accounting: Price must match invoice exactly               │
│  Inventory: Price is cost price, not selling price          │
│                                                              │
│  Different Data:                                            │
│  ───────────────                                            │
│  Sales: Product has images, reviews, description            │
│  Inventory: Product has SKU, location, quantity             │
│  Shipping: Product has weight, dimensions                   │
└─────────────────────────────────────────────────────────────┘
```

### Context Boundary Checklist

```
┌─────────────────────────────────────────────────────────────┐
│              BOUNDARY VALIDATION CHECKLIST                   │
│                                                              │
│  For each proposed boundary, ask:                           │
│                                                              │
│  Cohesion:                                                  │
│  [ ] Do these features change together?                     │
│  [ ] Do they serve the same business purpose?               │
│  [ ] Would splitting them require constant sync?            │
│                                                              │
│  Coupling:                                                  │
│  [ ] Can this service work if others are down?              │
│  [ ] Does it need real-time data from other services?       │
│  [ ] How many other services does it call?                  │
│                                                              │
│  Data:                                                      │
│  [ ] Does it own its data completely?                       │
│  [ ] Is there shared mutable state?                         │
│  [ ] Can data be eventually consistent?                     │
│                                                              │
│  Team:                                                      │
│  [ ] Can one team own this completely?                      │
│  [ ] Is the scope manageable (not too big/small)?           │
│  [ ] Are the skills needed consistent?                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Technique 3: Data Ownership Analysis

### Identify Data Clusters

```
┌─────────────────────────────────────────────────────────────┐
│                  DATA CLUSTER ANALYSIS                       │
│                                                              │
│  Step 1: List all entities                                  │
│  ─────────────────────────                                  │
│  User, Profile, Address, Product, Category, Order,          │
│  OrderItem, Payment, Shipment, Review, Cart, Wishlist       │
│                                                              │
│  Step 2: Group by strong relationships                      │
│  ─────────────────────────────────────                      │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ User Cluster    │  │ Product Cluster │                  │
│  │ - User          │  │ - Product       │                  │
│  │ - Profile       │  │ - Category      │                  │
│  │ - Address       │  │ - ProductImage  │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Order Cluster   │  │ Shopping Cluster│                  │
│  │ - Order         │  │ - Cart          │                  │
│  │ - OrderItem     │  │ - CartItem      │                  │
│  │ - OrderHistory  │  │ - Wishlist      │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ Payment Cluster │  │ Shipping Cluster│                  │
│  │ - Payment       │  │ - Shipment      │                  │
│  │ - Refund        │  │ - Tracking      │                  │
│  │ - PaymentMethod │  │ - Carrier       │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Handle Cross-Cutting Data

```
┌─────────────────────────────────────────────────────────────┐
│              CROSS-CUTTING DATA STRATEGIES                   │
│                                                              │
│  Problem: Order needs User email and Product name           │
│                                                              │
│  Option 1: API Call (Synchronous)                           │
│  ─────────────────────────────────                          │
│  Order Service ──▶ User Service (get email)                 │
│  Order Service ──▶ Product Service (get name)               │
│  Pros: Always fresh data                                    │
│  Cons: Coupling, latency, availability                      │
│                                                              │
│  Option 2: Data Duplication (Eventual Consistency)          │
│  ─────────────────────────────────────────────              │
│  Order Service stores: user_email, product_name             │
│  Updated via events when source changes                     │
│  Pros: Independent, fast                                    │
│  Cons: Stale data possible, storage overhead                │
│                                                              │
│  Option 3: Event-Carried State Transfer                     │
│  ──────────────────────────────────────                     │
│  UserUpdated event includes: { id, email, name }            │
│  Order Service caches user data locally                     │
│  Pros: Decoupled, fast reads                                │
│  Cons: Complexity, eventual consistency                     │
│                                                              │
│  Recommendation: Use Option 2 or 3 for read data            │
│                  Use Option 1 only for critical writes      │
└─────────────────────────────────────────────────────────────┘
```

---

## Technique 4: Team Structure Alignment

### Conway's Law

> "Organizations design systems that mirror their communication structure."

```
┌─────────────────────────────────────────────────────────────┐
│                    CONWAY'S LAW                              │
│                                                              │
│  Team Structure:              System Structure:             │
│  ───────────────              ─────────────────             │
│                                                              │
│  ┌─────────────┐              ┌─────────────┐              │
│  │ Team Alpha  │    ───▶      │ Service A   │              │
│  │ (5 people)  │              │ Service B   │              │
│  └─────────────┘              └─────────────┘              │
│                                                              │
│  ┌─────────────┐              ┌─────────────┐              │
│  │ Team Beta   │    ───▶      │ Service C   │              │
│  │ (4 people)  │              │ Service D   │              │
│  └─────────────┘              └─────────────┘              │
│                                                              │
│  Inverse Conway Maneuver:                                   │
│  Design teams to match desired architecture                 │
└─────────────────────────────────────────────────────────────┘
```

### Team Ownership Model

```
┌─────────────────────────────────────────────────────────────┐
│                  TEAM OWNERSHIP MODEL                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Team: Checkout Squad                                 │   │
│  │ Services: Cart, Order, Checkout                     │   │
│  │ Members: 2 Backend, 1 Frontend, 1 QA                │   │
│  │ On-call: Rotates weekly                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Team: Payments Squad                                 │   │
│  │ Services: Payment, Billing, Fraud                   │   │
│  │ Members: 3 Backend, 1 Security, 1 QA                │   │
│  │ On-call: Rotates weekly                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Team: Catalog Squad                                  │   │
│  │ Services: Product, Search, Category                 │   │
│  │ Members: 2 Backend, 1 Search Eng, 1 QA              │   │
│  │ On-call: Rotates weekly                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Rule: One team owns 2-5 services                          │
│  Rule: One service has exactly one owning team             │
└─────────────────────────────────────────────────────────────┘
```

---

## Technique 5: Change Frequency Analysis

### Group by Change Patterns

```
┌─────────────────────────────────────────────────────────────┐
│               CHANGE FREQUENCY ANALYSIS                      │
│                                                              │
│  Analyze git history to find what changes together:         │
│                                                              │
│  $ git log --name-only --format="" | \                      │
│    sort | uniq -c | sort -rn                                │
│                                                              │
│  Results:                                                   │
│  ┌────────────────────────────────────────────────────┐    │
│  │ Files that change together frequently:             │    │
│  │                                                     │    │
│  │ Cluster 1 (Product):                               │    │
│  │ - src/products/ProductController.ts                │    │
│  │ - src/products/ProductService.ts                   │    │
│  │ - src/categories/CategoryService.ts                │    │
│  │                                                     │    │
│  │ Cluster 2 (Order):                                 │    │
│  │ - src/orders/OrderController.ts                    │    │
│  │ - src/orders/OrderService.ts                       │    │
│  │ - src/cart/CartService.ts                          │    │
│  │                                                     │    │
│  │ Cluster 3 (User):                                  │    │
│  │ - src/users/UserController.ts                      │    │
│  │ - src/auth/AuthService.ts                          │    │
│  │ - src/profiles/ProfileService.ts                   │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Things that change together should stay together!          │
└─────────────────────────────────────────────────────────────┘
```

---

## Common Boundary Mistakes

### Mistake 1: Too Fine-Grained

```
┌─────────────────────────────────────────────────────────────┐
│                   TOO FINE-GRAINED                           │
│                                                              │
│  BAD: Nano-services                                         │
│  ─────────────────────                                      │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐        │
│  │User│ │Prof│ │Addr│ │Auth│ │Perm│ │Role│ │Sess│        │
│  └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘        │
│                                                              │
│  Problems:                                                  │
│  - Too many network calls                                   │
│  - Distributed transactions everywhere                      │
│  - Operational nightmare                                    │
│                                                              │
│  GOOD: Right-sized services                                 │
│  ───────────────────────────                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              User Service                            │   │
│  │  (User + Profile + Address + Auth + Permissions)    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Mistake 2: Too Coarse-Grained

```
┌─────────────────────────────────────────────────────────────┐
│                   TOO COARSE-GRAINED                         │
│                                                              │
│  BAD: Mega-services                                         │
│  ───────────────────                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Commerce Service                        │   │
│  │  (Products + Orders + Payments + Shipping +         │   │
│  │   Inventory + Users + Reviews + Analytics)          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Problems:                                                  │
│  - It's just a monolith with extra steps                   │
│  - Can't scale independently                                │
│  - Teams still conflict                                     │
│                                                              │
│  GOOD: Separate by business capability                      │
│  ─────────────────────────────────────                      │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐              │
│  │Product │ │ Order  │ │Payment │ │Shipping│              │
│  │Service │ │Service │ │Service │ │Service │              │
│  └────────┘ └────────┘ └────────┘ └────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### Mistake 3: Technical Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                  TECHNICAL BOUNDARIES                        │
│                                                              │
│  BAD: Split by technical layer                              │
│  ─────────────────────────────                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │ API Service │ Business Service │ Data Service      │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
│  Problems:                                                  │
│  - Every feature requires all three services               │
│  - Tight coupling                                           │
│  - No independent deployment                                │
│                                                              │
│  GOOD: Split by business capability                         │
│  ──────────────────────────────────                         │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │  Product   │ │   Order    │ │  Payment   │             │
│  │ (API+Biz+  │ │ (API+Biz+  │ │ (API+Biz+  │             │
│  │   Data)    │ │   Data)    │ │   Data)    │             │
│  └────────────┘ └────────────┘ └────────────┘             │
│                                                              │
│  Each service is a vertical slice with all layers.         │
└─────────────────────────────────────────────────────────────┘
```

---

## Boundary Decision Framework

```
┌─────────────────────────────────────────────────────────────┐
│              BOUNDARY DECISION FRAMEWORK                     │
│                                                              │
│  For each proposed service, score these factors:            │
│                                                              │
│  1. Business Alignment (1-5)                                │
│     Does it map to a clear business capability?             │
│                                                              │
│  2. Data Ownership (1-5)                                    │
│     Does it own its data without sharing?                   │
│                                                              │
│  3. Team Fit (1-5)                                          │
│     Can one team own it completely?                         │
│                                                              │
│  4. Independence (1-5)                                      │
│     Can it operate without other services?                  │
│                                                              │
│  5. Change Isolation (1-5)                                  │
│     Do changes stay within the boundary?                    │
│                                                              │
│  Score >= 20: Good boundary                                 │
│  Score 15-19: Review and refine                             │
│  Score < 15:  Reconsider boundary                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Practical Example

### E-Commerce Service Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│           FINAL SERVICE BOUNDARY DECISIONS                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Service: Product Catalog                             │   │
│  │ Owns: products, categories, product_images          │   │
│  │ Team: Catalog Squad                                  │   │
│  │ APIs: CRUD products, search, browse                 │   │
│  │ Events: ProductCreated, ProductUpdated, PriceChanged│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Service: Order Management                            │   │
│  │ Owns: orders, order_items, order_history            │   │
│  │ Team: Checkout Squad                                 │   │
│  │ APIs: Create order, get order, cancel order         │   │
│  │ Events: OrderPlaced, OrderCancelled, OrderCompleted │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Service: Inventory                                   │   │
│  │ Owns: inventory, stock_movements, warehouses        │   │
│  │ Team: Operations Squad                               │   │
│  │ APIs: Check stock, reserve, release                 │   │
│  │ Events: StockReserved, StockReleased, LowStock      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Service: Payment                                     │   │
│  │ Owns: payments, refunds, payment_methods            │   │
│  │ Team: Payments Squad                                 │   │
│  │ APIs: Process payment, refund, get status           │   │
│  │ Events: PaymentProcessed, PaymentFailed, Refunded   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Service: User                                        │   │
│  │ Owns: users, profiles, addresses, auth              │   │
│  │ Team: Platform Squad                                 │   │
│  │ APIs: Register, login, profile, addresses           │   │
│  │ Events: UserRegistered, ProfileUpdated              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Service: Notification                                │   │
│  │ Owns: notifications, templates, preferences         │   │
│  │ Team: Platform Squad                                 │   │
│  │ APIs: Send notification, get preferences            │   │
│  │ Consumes: OrderPlaced, PaymentProcessed, etc.       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Use business capabilities** as primary boundary guide
2. **Apply bounded context analysis** to find language boundaries
3. **Ensure data ownership** - each service owns its data
4. **Align with team structure** - Conway's Law works both ways
5. **Analyze change patterns** - things that change together stay together
6. **Avoid technical boundaries** - use vertical slices
7. **Right-size services** - not too big, not too small
8. **Validate boundaries** using the decision framework

---

## What's Next?

In the next lesson, we will learn the Strangler Fig pattern for incrementally migrating from monolith to microservices.

---
