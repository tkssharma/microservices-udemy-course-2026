# Lesson 7.5: Event Storming

## Introduction

Event Storming is a collaborative workshop technique for exploring complex business domains. It helps teams discover domain events, commands, aggregates, and bounded contexts through visual modeling.

---

## What is Event Storming?

```
┌─────────────────────────────────────────────────────────────┐
│              EVENT STORMING                                  │
│                                                              │
│  A workshop where:                                          │
│  • Domain experts and developers collaborate                │
│  • Sticky notes represent domain concepts                   │
│  • Timeline of events is built on a wall                    │
│  • Discussions reveal hidden complexity                     │
│                                                              │
│  Invented by Alberto Brandolini                             │
│                                                              │
│  Benefits:                                                  │
│  ─────────                                                  │
│  • Shared understanding of domain                           │
│  • Discover bounded contexts                                │
│  • Identify service boundaries                              │
│  • Find missing requirements                                │
│  • Align business and technical teams                       │
└─────────────────────────────────────────────────────────────┘
```

---

## The Sticky Note Legend

```
┌─────────────────────────────────────────────────────────────┐
│              STICKY NOTE COLORS                              │
│                                                              │
│  ┌─────────────┐                                           │
│  │   ORANGE    │  Domain Event                             │
│  │             │  "Something that happened"                 │
│  │ OrderPlaced │  Past tense                               │
│  └─────────────┘                                           │
│                                                              │
│  ┌─────────────┐                                           │
│  │    BLUE     │  Command                                  │
│  │             │  "Request to do something"                │
│  │ Place Order │  Imperative                               │
│  └─────────────┘                                           │
│                                                              │
│  ┌─────────────┐                                           │
│  │   YELLOW    │  Aggregate / Entity                       │
│  │             │  "Thing that handles command"             │
│  │    Order    │  Noun                                     │
│  └─────────────┘                                           │
│                                                              │
│  ┌─────────────┐                                           │
│  │    PINK     │  External System                          │
│  │             │  "Third-party integration"                │
│  │Payment Gate │                                           │
│  └─────────────┘                                           │
│                                                              │
│  ┌─────────────┐                                           │
│  │   PURPLE    │  Policy / Business Rule                   │
│  │             │  "When X happens, do Y"                   │
│  │ Send Email  │                                           │
│  └─────────────┘                                           │
│                                                              │
│  ┌─────────────┐                                           │
│  │    GREEN    │  Read Model / View                        │
│  │             │  "Information needed"                     │
│  │Order Status │                                           │
│  └─────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Event Storming Process

### Step 1: Chaotic Exploration

```
┌─────────────────────────────────────────────────────────────┐
│              STEP 1: CHAOTIC EXPLORATION                     │
│                                                              │
│  Everyone writes domain events on orange sticky notes       │
│  Place them on the wall in rough timeline order             │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Customer │ │  Item    │ │  Order   │ │ Payment  │       │
│  │Registered│ │ Added to │ │  Placed  │ │ Received │       │
│  │          │ │   Cart   │ │          │ │          │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Inventory│ │  Order   │ │  Order   │ │  Order   │       │
│  │ Reserved │ │ Shipped  │ │Delivered │ │ Returned │       │
│  │          │ │          │ │          │ │          │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  No filtering - capture everything!                         │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Enforce Timeline

```
┌─────────────────────────────────────────────────────────────┐
│              STEP 2: ENFORCE TIMELINE                        │
│                                                              │
│  Arrange events in chronological order                      │
│  Left to right = time progression                           │
│                                                              │
│  START ──────────────────────────────────────────────▶ END  │
│                                                              │
│  ┌──────────┐                                              │
│  │ Customer │                                              │
│  │Registered│                                              │
│  └──────────┘                                              │
│        │                                                    │
│        ▼                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  Item    │─▶│  Order   │─▶│ Payment  │                  │
│  │  Added   │  │  Placed  │  │ Received │                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                     │                                       │
│                     ▼                                       │
│               ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│               │ Inventory│─▶│  Order   │─▶│  Order   │     │
│               │ Reserved │  │ Shipped  │  │Delivered │     │
│               └──────────┘  └──────────┘  └──────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Step 3: Add Commands and Actors

```
┌─────────────────────────────────────────────────────────────┐
│              STEP 3: COMMANDS AND ACTORS                     │
│                                                              │
│  Add blue commands that trigger events                      │
│  Add actors (people/systems) that issue commands            │
│                                                              │
│  👤 Customer                                                │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────┐     ┌──────────┐                             │
│  │  Place   │────▶│  Order   │                             │
│  │  Order   │     │  Placed  │                             │
│  │  (blue)  │     │ (orange) │                             │
│  └──────────┘     └──────────┘                             │
│                                                              │
│  🤖 Payment Gateway                                         │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────┐     ┌──────────┐                             │
│  │ Confirm  │────▶│ Payment  │                             │
│  │ Payment  │     │ Received │                             │
│  │  (blue)  │     │ (orange) │                             │
│  └──────────┘     └──────────┘                             │
└─────────────────────────────────────────────────────────────┘
```

### Step 4: Identify Aggregates

```
┌─────────────────────────────────────────────────────────────┐
│              STEP 4: AGGREGATES                              │
│                                                              │
│  Group related events under aggregates (yellow)             │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    ORDER                             │   │
│  │                   (yellow)                           │   │
│  │                                                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │  Order   │  │  Order   │  │  Order   │          │   │
│  │  │  Placed  │  │ Confirmed│  │ Shipped  │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   PAYMENT                            │   │
│  │                   (yellow)                           │   │
│  │                                                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐          │   │
│  │  │ Payment  │  │ Payment  │  │ Payment  │          │   │
│  │  │ Initiated│  │ Received │  │ Refunded │          │   │
│  │  └──────────┘  └──────────┘  └──────────┘          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Step 5: Identify Bounded Contexts

```
┌─────────────────────────────────────────────────────────────┐
│              STEP 5: BOUNDED CONTEXTS                        │
│                                                              │
│  Draw boundaries around related aggregates                  │
│  These become your microservices!                           │
│                                                              │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │    ORDERING CONTEXT     │  │    PAYMENT CONTEXT      │  │
│  │                         │  │                         │  │
│  │  ┌───────┐  ┌───────┐  │  │  ┌───────┐             │  │
│  │  │ Order │  │ Cart  │  │  │  │Payment│             │  │
│  │  └───────┘  └───────┘  │  │  └───────┘             │  │
│  │                         │  │                         │  │
│  └─────────────────────────┘  └─────────────────────────┘  │
│                                                              │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  │
│  │   INVENTORY CONTEXT     │  │   SHIPPING CONTEXT      │  │
│  │                         │  │                         │  │
│  │  ┌───────┐  ┌───────┐  │  │  ┌───────┐  ┌───────┐  │  │
│  │  │Product│  │ Stock │  │  │  │Shipment│  │Carrier│  │  │
│  │  └───────┘  └───────┘  │  │  └───────┘  └───────┘  │  │
│  │                         │  │                         │  │
│  └─────────────────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Example: E-Commerce Event Storm

```
┌─────────────────────────────────────────────────────────────┐
│              E-COMMERCE EVENT STORM RESULT                   │
│                                                              │
│  Timeline:                                                  │
│  ─────────                                                  │
│                                                              │
│  👤 Customer                                                │
│  │                                                          │
│  ├─▶ [Browse Catalog] ──▶ ProductViewed                    │
│  │                                                          │
│  ├─▶ [Add to Cart] ──▶ ItemAddedToCart                     │
│  │                                                          │
│  ├─▶ [Place Order] ──▶ OrderPlaced                         │
│  │                        │                                 │
│  │                        ├──▶ (Policy: Reserve Inventory)  │
│  │                        │         │                       │
│  │                        │         ▼                       │
│  │                        │    InventoryReserved            │
│  │                        │                                 │
│  │                        └──▶ (Policy: Process Payment)    │
│  │                                  │                       │
│  │                                  ▼                       │
│  │                             PaymentProcessed             │
│  │                                  │                       │
│  │                                  ▼                       │
│  │                             OrderConfirmed               │
│  │                                  │                       │
│  │                                  ▼                       │
│  │                          (Policy: Ship Order)            │
│  │                                  │                       │
│  │                                  ▼                       │
│  │                             OrderShipped                 │
│  │                                  │                       │
│  │                                  ▼                       │
│  │                             OrderDelivered               │
│  │                                                          │
│  └─▶ [Request Return] ──▶ ReturnRequested                  │
│                                                              │
│  Bounded Contexts Identified:                               │
│  • Catalog (Product, Category)                              │
│  • Cart (Cart, CartItem)                                    │
│  • Ordering (Order, OrderItem)                              │
│  • Inventory (Stock, Reservation)                           │
│  • Payment (Payment, Refund)                                │
│  • Shipping (Shipment, Tracking)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Tips for Successful Event Storming

```
┌─────────────────────────────────────────────────────────────┐
│              TIPS                                            │
│                                                              │
│  1. Include Domain Experts                                  │
│     • Business people who know the domain                   │
│     • Not just developers                                   │
│                                                              │
│  2. Use a Big Wall                                          │
│     • Physical space for sticky notes                       │
│     • Or digital tools (Miro, Mural)                        │
│                                                              │
│  3. Start with Events                                       │
│     • Don't jump to solutions                               │
│     • Focus on what happens, not how                        │
│                                                              │
│  4. Embrace Chaos                                           │
│     • Initial mess is expected                              │
│     • Order emerges through discussion                      │
│                                                              │
│  5. Look for Hotspots                                       │
│     • Areas with many events = complexity                   │
│     • Areas with confusion = needs clarification            │
│                                                              │
│  6. Time-box Sessions                                       │
│     • 2-4 hours per session                                 │
│     • Multiple sessions for large domains                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Collaborative technique** - brings business and tech together
2. **Events first** - focus on what happened
3. **Visual modeling** - sticky notes on a timeline
4. **Discover boundaries** - aggregates become services
5. **Iterative process** - refine through discussion

---

## Module Summary

In this module, you learned:

- Event-driven architecture fundamentals
- Different event types and when to use them
- Message broker options and trade-offs
- Pub/Sub pattern implementation
- Event Storming for domain discovery

---

## What's Next?

In the next module, we will explore the Saga pattern for managing distributed transactions.

---
