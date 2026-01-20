# Lesson 8.2: Saga Pattern Overview

## Introduction

The Saga pattern is a way to manage data consistency across microservices in distributed transaction scenarios. A saga is a sequence of local transactions where each transaction updates data within a single service.

---

## What is a Saga?

```
┌─────────────────────────────────────────────────────────────┐
│              SAGA DEFINITION                                 │
│                                                              │
│  A Saga is:                                                 │
│  • A sequence of local transactions                         │
│  • Each transaction updates one service's database          │
│  • Each transaction publishes an event/message              │
│  • Next transaction triggered by previous event             │
│  • If a transaction fails, compensating transactions undo   │
│    the changes made by preceding transactions               │
│                                                              │
│  Key Insight:                                               │
│  ────────────                                               │
│  Instead of ACID, we get ACD:                               │
│  • Atomicity:    Each local transaction is atomic           │
│  • Consistency:  Eventual consistency across services       │
│  • Durability:   Each local transaction is durable          │
│  (No Isolation - other transactions can see intermediate)   │
└─────────────────────────────────────────────────────────────┘
```

---

## Saga Flow: Happy Path

```
┌─────────────────────────────────────────────────────────────┐
│              SAGA: HAPPY PATH                                │
│                                                              │
│  Create Order Saga:                                         │
│                                                              │
│  ┌─────────────┐                                           │
│  │ T1: Create  │                                           │
│  │   Order     │──────────────┐                            │
│  │  (PENDING)  │              │                            │
│  └─────────────┘              │                            │
│                               ▼                            │
│                        ┌─────────────┐                     │
│                        │ T2: Reserve │                     │
│                        │  Inventory  │──────────────┐      │
│                        │             │              │      │
│                        └─────────────┘              │      │
│                                                     ▼      │
│                                              ┌─────────────┐│
│                                              │ T3: Process ││
│                                              │   Payment   ││
│                                              │             ││
│                                              └──────┬──────┘│
│                                                     │       │
│                        ┌─────────────┐              │       │
│                        │ T4: Confirm │◀─────────────┘       │
│                        │   Order     │                      │
│                        │ (CONFIRMED) │                      │
│                        └─────────────┘                      │
│                                                              │
│  All transactions succeed → Order confirmed                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Saga Flow: Failure & Compensation

```
┌─────────────────────────────────────────────────────────────┐
│              SAGA: FAILURE PATH                              │
│                                                              │
│  T1: Create Order     ✓ SUCCESS                             │
│  ┌─────────────┐                                           │
│  │   Order     │                                           │
│  │  (PENDING)  │                                           │
│  └─────────────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  T2: Reserve Inventory ✓ SUCCESS                            │
│  ┌─────────────┐                                           │
│  │  Inventory  │                                           │
│  │  Reserved   │                                           │
│  └─────────────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  T3: Process Payment   ✗ FAILED (Card Declined)             │
│  ┌─────────────┐                                           │
│  │   Payment   │                                           │
│  │   FAILED    │                                           │
│  └─────────────┘                                           │
│         │                                                   │
│         │  TRIGGER COMPENSATING TRANSACTIONS                │
│         ▼                                                   │
│  C2: Release Inventory ✓ COMPENSATED                        │
│  ┌─────────────┐                                           │
│  │  Inventory  │                                           │
│  │  Released   │                                           │
│  └─────────────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  C1: Cancel Order      ✓ COMPENSATED                        │
│  ┌─────────────┐                                           │
│  │   Order     │                                           │
│  │ (CANCELLED) │                                           │
│  └─────────────┘                                           │
│                                                              │
│  System returns to consistent state                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Saga Participants

```
┌─────────────────────────────────────────────────────────────┐
│              SAGA PARTICIPANTS                               │
│                                                              │
│  Each participant has:                                      │
│                                                              │
│  1. Forward Transaction (T)                                 │
│     The actual business operation                           │
│     Example: Reserve inventory                              │
│                                                              │
│  2. Compensating Transaction (C)                            │
│     Undoes the forward transaction                          │
│     Example: Release inventory                              │
│                                                              │
│  Participant Structure:                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Inventory Service                       │   │
│  │                                                      │   │
│  │  Forward:     reserveInventory(orderId, items)      │   │
│  │               → InventoryReserved event             │   │
│  │                                                      │   │
│  │  Compensate:  releaseInventory(orderId)             │   │
│  │               → InventoryReleased event             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Saga States

```
┌─────────────────────────────────────────────────────────────┐
│              SAGA STATE MACHINE                              │
│                                                              │
│                    ┌─────────┐                              │
│                    │ STARTED │                              │
│                    └────┬────┘                              │
│                         │                                   │
│           ┌─────────────┼─────────────┐                    │
│           │             │             │                    │
│           ▼             ▼             ▼                    │
│     ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│     │EXECUTING │  │EXECUTING │  │EXECUTING │              │
│     │  STEP 1  │─▶│  STEP 2  │─▶│  STEP 3  │              │
│     └──────────┘  └──────────┘  └────┬─────┘              │
│                                      │                     │
│                         ┌────────────┼────────────┐        │
│                         │            │            │        │
│                         ▼            ▼            ▼        │
│                   ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│                   │COMPLETED │ │COMPENSAT-│ │  FAILED  │  │
│                   │          │ │   ING    │ │          │  │
│                   └──────────┘ └────┬─────┘ └──────────┘  │
│                                     │                      │
│                                     ▼                      │
│                               ┌──────────┐                 │
│                               │COMPENSAT-│                 │
│                               │   ED     │                 │
│                               └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Saga Example: Order Processing

```typescript
// Saga definition
interface OrderSaga {
  sagaId: string;
  orderId: string;
  status: 'STARTED' | 'EXECUTING' | 'COMPLETED' | 'COMPENSATING' | 'COMPENSATED' | 'FAILED';
  currentStep: number;
  steps: SagaStep[];
  compensationIndex: number;
}

interface SagaStep {
  name: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'COMPENSATED';
  service: string;
  action: string;
  compensationAction: string;
  data: Record<string, unknown>;
}

// Order Saga Steps
const createOrderSaga = (orderData: OrderData): OrderSaga => ({
  sagaId: generateId(),
  orderId: orderData.orderId,
  status: 'STARTED',
  currentStep: 0,
  compensationIndex: -1,
  steps: [
    {
      name: 'Create Order',
      status: 'PENDING',
      service: 'order-service',
      action: 'CREATE_ORDER',
      compensationAction: 'CANCEL_ORDER',
      data: { orderId: orderData.orderId, items: orderData.items },
    },
    {
      name: 'Reserve Inventory',
      status: 'PENDING',
      service: 'inventory-service',
      action: 'RESERVE_INVENTORY',
      compensationAction: 'RELEASE_INVENTORY',
      data: { orderId: orderData.orderId, items: orderData.items },
    },
    {
      name: 'Process Payment',
      status: 'PENDING',
      service: 'payment-service',
      action: 'PROCESS_PAYMENT',
      compensationAction: 'REFUND_PAYMENT',
      data: { orderId: orderData.orderId, amount: orderData.total },
    },
    {
      name: 'Confirm Order',
      status: 'PENDING',
      service: 'order-service',
      action: 'CONFIRM_ORDER',
      compensationAction: 'NONE', // Last step, no compensation needed
      data: { orderId: orderData.orderId },
    },
  ],
});
```

---

## Benefits of Saga Pattern

```
┌─────────────────────────────────────────────────────────────┐
│              BENEFITS                                        │
│                                                              │
│  1. No Distributed Locks                                    │
│     Each service manages its own data                       │
│     No blocking across services                             │
│                                                              │
│  2. High Availability                                       │
│     Services can fail independently                         │
│     System continues to function                            │
│                                                              │
│  3. Loose Coupling                                          │
│     Services communicate via events                         │
│     Can evolve independently                                │
│                                                              │
│  4. Scalability                                             │
│     Each service scales independently                       │
│     No central coordinator bottleneck (choreography)        │
│                                                              │
│  5. Visibility                                              │
│     Saga state can be tracked                               │
│     Easy to see where things failed                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Challenges

```
┌─────────────────────────────────────────────────────────────┐
│              CHALLENGES                                      │
│                                                              │
│  1. Complexity                                              │
│     More moving parts than single transaction               │
│     Harder to reason about                                  │
│                                                              │
│  2. No Isolation                                            │
│     Intermediate states visible to other transactions       │
│     "Dirty reads" possible                                  │
│                                                              │
│  3. Compensation Logic                                      │
│     Must design compensating transactions                   │
│     Some actions hard to undo (emails sent)                 │
│                                                              │
│  4. Debugging                                               │
│     Distributed tracing needed                              │
│     Harder to reproduce issues                              │
│                                                              │
│  5. Testing                                                 │
│     Must test all failure scenarios                         │
│     Integration testing complex                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Saga = sequence of local transactions** with compensations
2. **No global ACID** - eventual consistency instead
3. **Each step has a compensating action** to undo it
4. **Benefits**: No locks, high availability, loose coupling
5. **Challenges**: Complexity, no isolation, compensation design

---

## What's Next?

In the next lesson, we will compare choreography and orchestration approaches for implementing sagas.

---
