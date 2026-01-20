# Lesson 6.3: Data Consistency Strategies

## Introduction

When each service has its own database, maintaining data consistency across services becomes challenging. This lesson covers strategies for handling consistency in distributed systems.

---

## The Consistency Challenge

```
┌─────────────────────────────────────────────────────────────┐
│              THE CONSISTENCY PROBLEM                         │
│                                                              │
│  Monolith (Single Database):                                │
│  ───────────────────────────                                │
│  BEGIN TRANSACTION;                                         │
│    INSERT INTO orders (...);                                │
│    UPDATE inventory SET stock = stock - 1;                  │
│    INSERT INTO payments (...);                              │
│  COMMIT;                                                    │
│                                                              │
│  All or nothing. ACID guarantees.                           │
│                                                              │
│  Microservices (Multiple Databases):                        │
│  ────────────────────────────────────                       │
│  Order Service:     INSERT INTO orders (...);     ✓         │
│  Inventory Service: UPDATE stock = stock - 1;     ✓         │
│  Payment Service:   INSERT INTO payments (...);   ✗ FAILED  │
│                                                              │
│  What now? Order created, inventory reduced,                │
│  but payment failed. Data is INCONSISTENT.                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Strong vs Eventual Consistency

```
┌─────────────────────────────────────────────────────────────┐
│              CONSISTENCY MODELS                              │
│                                                              │
│  Strong Consistency:                                        │
│  ───────────────────                                        │
│  • All nodes see same data at same time                     │
│  • Read always returns latest write                         │
│  • Requires distributed transactions                        │
│  • Higher latency, lower availability                       │
│                                                              │
│  Eventual Consistency:                                      │
│  ─────────────────────                                      │
│  • Data will be consistent eventually                       │
│  • Temporary inconsistency is acceptable                    │
│  • No distributed transactions needed                       │
│  • Lower latency, higher availability                       │
│                                                              │
│  CAP Theorem:                                               │
│  ────────────                                               │
│  You can only have 2 of 3:                                  │
│  • Consistency                                              │
│  • Availability                                             │
│  • Partition tolerance                                      │
│                                                              │
│  In distributed systems, partitions happen.                 │
│  Choose: CP (consistent) or AP (available)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Strategy 1: Saga Pattern

Manage distributed transactions as a sequence of local transactions with compensating actions.

```
┌─────────────────────────────────────────────────────────────┐
│              SAGA PATTERN                                    │
│                                                              │
│  Forward Flow (Happy Path):                                 │
│  ──────────────────────────                                 │
│  1. Order Service: Create order (PENDING)                   │
│  2. Inventory Service: Reserve stock                        │
│  3. Payment Service: Process payment                        │
│  4. Order Service: Confirm order (CONFIRMED)                │
│                                                              │
│  Compensation Flow (Failure):                               │
│  ─────────────────────────────                              │
│  1. Order Service: Create order (PENDING)      ✓            │
│  2. Inventory Service: Reserve stock           ✓            │
│  3. Payment Service: Process payment           ✗ FAILED     │
│                                                              │
│  Compensate:                                                │
│  2c. Inventory Service: Release stock          ✓            │
│  1c. Order Service: Cancel order               ✓            │
│                                                              │
│  Each step has a compensating action to undo it.            │
└─────────────────────────────────────────────────────────────┘
```

---

## Strategy 2: Event-Driven Consistency

Use events to propagate changes across services.

```
┌─────────────────────────────────────────────────────────────┐
│              EVENT-DRIVEN CONSISTENCY                        │
│                                                              │
│  1. Order Service creates order                             │
│     └── Publishes: ORDER_CREATED                            │
│                                                              │
│  2. Inventory Service receives ORDER_CREATED                │
│     └── Reserves stock                                      │
│     └── Publishes: INVENTORY_RESERVED                       │
│                                                              │
│  3. Payment Service receives INVENTORY_RESERVED             │
│     └── Processes payment                                   │
│     └── Publishes: PAYMENT_COMPLETED                        │
│                                                              │
│  4. Order Service receives PAYMENT_COMPLETED                │
│     └── Updates order to CONFIRMED                          │
│                                                              │
│  If any step fails, publish failure event.                  │
│  Other services react and compensate.                       │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// Order Service
class OrderService {
  async createOrder(data: CreateOrderDTO): Promise<Order> {
    // Create order in PENDING state
    const order = await this.orderRepository.create({
      ...data,
      status: 'PENDING',
    });

    // Publish event
    await this.eventBus.publish({
      type: 'ORDER_CREATED',
      data: {
        orderId: order.id,
        userId: order.userId,
        items: order.items,
        total: order.total,
      },
    });

    return order;
  }

  // Handle payment completed
  @EventHandler('PAYMENT_COMPLETED')
  async onPaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    await this.orderRepository.updateStatus(event.data.orderId, 'CONFIRMED');
  }

  // Handle payment failed
  @EventHandler('PAYMENT_FAILED')
  async onPaymentFailed(event: PaymentFailedEvent): Promise<void> {
    await this.orderRepository.updateStatus(event.data.orderId, 'CANCELLED');
  }
}

// Inventory Service
class InventoryService {
  @EventHandler('ORDER_CREATED')
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      // Reserve stock
      for (const item of event.data.items) {
        await this.reserveStock(item.productId, item.quantity, event.data.orderId);
      }

      // Publish success
      await this.eventBus.publish({
        type: 'INVENTORY_RESERVED',
        data: { orderId: event.data.orderId },
      });
    } catch (error) {
      // Publish failure
      await this.eventBus.publish({
        type: 'INVENTORY_RESERVATION_FAILED',
        data: {
          orderId: event.data.orderId,
          reason: error.message,
        },
      });
    }
  }

  // Compensate on payment failure
  @EventHandler('PAYMENT_FAILED')
  async onPaymentFailed(event: PaymentFailedEvent): Promise<void> {
    await this.releaseReservation(event.data.orderId);
  }
}
```

---

## Strategy 3: Outbox Pattern

Ensure events are published reliably by storing them in the same transaction as the data change.

```
┌─────────────────────────────────────────────────────────────┐
│              OUTBOX PATTERN                                  │
│                                                              │
│  Problem:                                                   │
│  ────────                                                   │
│  1. Save order to database     ✓                            │
│  2. Publish event to broker    ✗ (broker down)              │
│                                                              │
│  Order saved but event never published!                     │
│                                                              │
│  Solution: Outbox Table                                     │
│  ───────────────────────                                    │
│  1. BEGIN TRANSACTION                                       │
│  2. INSERT INTO orders (...)                                │
│  3. INSERT INTO outbox (event_type, payload, ...)           │
│  4. COMMIT                                                  │
│                                                              │
│  Separate process reads outbox and publishes events.        │
│  If publish fails, retry. Event is never lost.              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// Outbox table schema
// CREATE TABLE outbox (
//   id UUID PRIMARY KEY,
//   event_type VARCHAR(100),
//   payload JSONB,
//   created_at TIMESTAMP,
//   published_at TIMESTAMP NULL
// );

class OrderService {
  async createOrder(data: CreateOrderDTO): Promise<Order> {
    return await this.db.transaction(async (trx) => {
      // Create order
      const order = await trx('orders')
        .insert({
          id: generateId(),
          ...data,
          status: 'PENDING',
        })
        .returning('*');

      // Add event to outbox (same transaction)
      await trx('outbox').insert({
        id: generateId(),
        event_type: 'ORDER_CREATED',
        payload: JSON.stringify({
          orderId: order.id,
          userId: order.userId,
          items: order.items,
        }),
        created_at: new Date(),
      });

      return order;
    });
  }
}

// Outbox publisher (separate process)
class OutboxPublisher {
  async publishPendingEvents(): Promise<void> {
    const events = await this.db('outbox').whereNull('published_at').orderBy('created_at').limit(100);

    for (const event of events) {
      try {
        await this.eventBus.publish({
          type: event.event_type,
          data: JSON.parse(event.payload),
        });

        await this.db('outbox').where('id', event.id).update({ published_at: new Date() });
      } catch (error) {
        console.error('Failed to publish event:', event.id);
        // Will retry on next run
      }
    }
  }
}
```

---

## Strategy 4: Two-Phase Commit (2PC)

Coordinate distributed transactions across services.

```
┌─────────────────────────────────────────────────────────────┐
│              TWO-PHASE COMMIT                                │
│                                                              │
│  Phase 1: Prepare                                           │
│  ─────────────────                                          │
│  Coordinator: "Can you commit?"                             │
│  Order DB:     "Yes, I can commit"                          │
│  Inventory DB: "Yes, I can commit"                          │
│  Payment DB:   "Yes, I can commit"                          │
│                                                              │
│  Phase 2: Commit                                            │
│  ────────────────                                           │
│  Coordinator: "Commit!"                                     │
│  Order DB:     "Committed"                                  │
│  Inventory DB: "Committed"                                  │
│  Payment DB:   "Committed"                                  │
│                                                              │
│  Problems:                                                  │
│  ─────────                                                  │
│  • Blocking: All participants locked during prepare         │
│  • Single point of failure: Coordinator                     │
│  • Not suitable for microservices                           │
│                                                              │
│  Generally AVOID in microservices. Use Saga instead.        │
└─────────────────────────────────────────────────────────────┘
```

---

## Choosing a Strategy

| Strategy     | Use When                       | Complexity   |
| ------------ | ------------------------------ | ------------ |
| Saga         | Multi-step business processes  | Medium       |
| Event-Driven | Loose coupling, async OK       | Medium       |
| Outbox       | Need reliable event publishing | Low          |
| 2PC          | Strong consistency required    | High (avoid) |

---

## Key Takeaways

1. **Embrace eventual consistency** - strong consistency is expensive
2. **Saga pattern** for multi-step transactions with compensation
3. **Event-driven** for loose coupling and async processing
4. **Outbox pattern** for reliable event publishing
5. **Avoid 2PC** in microservices - too blocking
6. **Design for failure** - always have compensation logic

---

## What's Next?

In the next lesson, we will explore data synchronization patterns between services.

---
