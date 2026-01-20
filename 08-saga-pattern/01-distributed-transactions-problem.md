# Lesson 8.1: Distributed Transactions Problem

## Introduction

In a monolithic application, database transactions are straightforward. But in microservices, data is spread across multiple databases, making traditional ACID transactions impossible.

---

## The Monolith Advantage

```
┌─────────────────────────────────────────────────────────────┐
│              MONOLITH: SIMPLE TRANSACTIONS                   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    Monolith                          │   │
│  │                                                      │   │
│  │  BEGIN TRANSACTION;                                  │   │
│  │    INSERT INTO orders (...);                         │   │
│  │    UPDATE inventory SET stock = stock - 1;           │   │
│  │    INSERT INTO payments (...);                       │   │
│  │  COMMIT;                                             │   │
│  │                                                      │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│                  ┌─────────────┐                           │
│                  │  Database   │                           │
│                  │   (ACID)    │                           │
│                  └─────────────┘                           │
│                                                              │
│  ACID Guarantees:                                           │
│  • Atomicity:    All or nothing                             │
│  • Consistency:  Valid state transitions                    │
│  • Isolation:    Concurrent transactions don't interfere    │
│  • Durability:   Committed data persists                    │
└─────────────────────────────────────────────────────────────┘
```

---

## The Microservices Challenge

```
┌─────────────────────────────────────────────────────────────┐
│              MICROSERVICES: NO SINGLE TRANSACTION            │
│                                                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │   Order     │   │  Inventory  │   │   Payment   │       │
│  │   Service   │   │   Service   │   │   Service   │       │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘       │
│         │                 │                 │               │
│         ▼                 ▼                 ▼               │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │  Order DB   │   │ Inventory DB│   │  Payment DB │       │
│  └─────────────┘   └─────────────┘   └─────────────┘       │
│                                                              │
│  Problem: Cannot wrap all three in a single transaction!    │
│                                                              │
│  Each service has its own database.                         │
│  No shared transaction context.                             │
│  No global COMMIT or ROLLBACK.                              │
└─────────────────────────────────────────────────────────────┘
```

---

## What Can Go Wrong?

### Scenario: Place Order

```
┌─────────────────────────────────────────────────────────────┐
│              FAILURE SCENARIO                                │
│                                                              │
│  Step 1: Create Order                                       │
│  ┌─────────────┐                                           │
│  │   Order     │  INSERT order → SUCCESS ✓                 │
│  │   Service   │  Order ID: ord_123                        │
│  └─────────────┘                                           │
│                                                              │
│  Step 2: Reserve Inventory                                  │
│  ┌─────────────┐                                           │
│  │  Inventory  │  UPDATE stock → SUCCESS ✓                 │
│  │   Service   │  Reserved 2 items                         │
│  └─────────────┘                                           │
│                                                              │
│  Step 3: Process Payment                                    │
│  ┌─────────────┐                                           │
│  │   Payment   │  Charge card → FAILED ✗                   │
│  │   Service   │  Card declined!                           │
│  └─────────────┘                                           │
│                                                              │
│  RESULT:                                                    │
│  • Order exists (should be cancelled)                       │
│  • Inventory reserved (should be released)                  │
│  • Payment failed                                           │
│                                                              │
│  DATA IS INCONSISTENT!                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Why Not Two-Phase Commit (2PC)?

```
┌─────────────────────────────────────────────────────────────┐
│              TWO-PHASE COMMIT                                │
│                                                              │
│  Phase 1: Prepare                                           │
│  ─────────────────                                          │
│  Coordinator: "Can everyone commit?"                        │
│  Order DB:     "Yes, I'm ready"                             │
│  Inventory DB: "Yes, I'm ready"                             │
│  Payment DB:   "Yes, I'm ready"                             │
│                                                              │
│  Phase 2: Commit                                            │
│  ────────────────                                           │
│  Coordinator: "Everyone commit!"                            │
│  All DBs:     "Done"                                        │
│                                                              │
│  PROBLEMS:                                                  │
│  ──────────                                                 │
│  1. Synchronous & Blocking                                  │
│     All participants locked during prepare phase            │
│     High latency                                            │
│                                                              │
│  2. Single Point of Failure                                 │
│     Coordinator crashes = all participants stuck            │
│                                                              │
│  3. Reduced Availability                                    │
│     If any participant unavailable, transaction fails       │
│                                                              │
│  4. Not Scalable                                            │
│     Doesn't work well across network boundaries             │
│                                                              │
│  5. Technology Lock-in                                      │
│     All databases must support same 2PC protocol            │
│                                                              │
│  2PC violates microservices principles!                     │
└─────────────────────────────────────────────────────────────┘
```

---

## The CAP Theorem Reality

```
┌─────────────────────────────────────────────────────────────┐
│              CAP THEOREM                                     │
│                                                              │
│  In a distributed system, you can only have 2 of 3:         │
│                                                              │
│                    Consistency                              │
│                        /\                                   │
│                       /  \                                  │
│                      /    \                                 │
│                     /      \                                │
│                    /   CA   \                               │
│                   /          \                              │
│                  /____________\                             │
│         Availability ──────── Partition                     │
│                               Tolerance                     │
│                                                              │
│  Network partitions WILL happen in distributed systems.     │
│  So you must choose: Consistency OR Availability            │
│                                                              │
│  Microservices typically choose:                            │
│  • Availability over strong consistency                     │
│  • Eventual consistency is acceptable                       │
└─────────────────────────────────────────────────────────────┘
```

---

## The Solution: Saga Pattern

Instead of one big transaction, use a sequence of local transactions with compensating actions.

```
┌─────────────────────────────────────────────────────────────┐
│              SAGA APPROACH                                   │
│                                                              │
│  Traditional Transaction:                                   │
│  ────────────────────────                                   │
│  BEGIN → Step1 → Step2 → Step3 → COMMIT/ROLLBACK           │
│  (All or nothing, synchronous)                              │
│                                                              │
│  Saga:                                                      │
│  ─────                                                      │
│  T1 → T2 → T3 (each commits independently)                  │
│                                                              │
│  If T3 fails:                                               │
│  C2 ← C1 (compensating transactions undo T2, T1)            │
│                                                              │
│  • Each step is a local transaction                         │
│  • Each step has a compensating action                      │
│  • Eventually consistent                                    │
│  • No global locks                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **ACID doesn't work** across multiple databases
2. **2PC is problematic** - blocking, single point of failure
3. **CAP theorem** forces trade-offs in distributed systems
4. **Eventual consistency** is the pragmatic choice
5. **Saga pattern** provides a solution with compensating transactions

---

## What's Next?

In the next lesson, we will explore the Saga pattern in detail.

---
