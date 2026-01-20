# Lesson 9.3: Event Sourcing Basics

## Introduction

Event Sourcing is a pattern where state changes are stored as a sequence of events. Instead of storing current state, you store the history of all changes that led to the current state.

---

## Traditional State Storage vs Event Sourcing

```
┌─────────────────────────────────────────────────────────────┐
│              TRADITIONAL (State Storage)                     │
│                                                              │
│  Store current state only:                                  │
│                                                              │
│  orders table:                                              │
│  ┌────────┬────────┬──────────┬─────────┐                  │
│  │   id   │ userId │  status  │  total  │                  │
│  ├────────┼────────┼──────────┼─────────┤                  │
│  │ ord_1  │ usr_1  │ SHIPPED  │  99.99  │                  │
│  └────────┴────────┴──────────┴─────────┘                  │
│                                                              │
│  Questions we can't answer:                                 │
│  • When was the order created?                              │
│  • What was the original total before discount?             │
│  • Who changed the status and when?                         │
│  • What items were removed before checkout?                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              EVENT SOURCING                                  │
│                                                              │
│  Store all events that happened:                            │
│                                                              │
│  events table:                                              │
│  ┌────────┬─────────────────────┬───────────────────────┐  │
│  │ seq    │ event_type          │ data                  │  │
│  ├────────┼─────────────────────┼───────────────────────┤  │
│  │ 1      │ OrderCreated        │ {orderId, userId}     │  │
│  │ 2      │ ItemAdded           │ {productId, qty: 2}   │  │
│  │ 3      │ ItemAdded           │ {productId, qty: 1}   │  │
│  │ 4      │ ItemRemoved         │ {productId}           │  │
│  │ 5      │ DiscountApplied     │ {code, amount: 10}    │  │
│  │ 6      │ OrderConfirmed      │ {total: 99.99}        │  │
│  │ 7      │ PaymentReceived     │ {paymentId}           │  │
│  │ 8      │ OrderShipped        │ {trackingNumber}      │  │
│  └────────┴─────────────────────┴───────────────────────┘  │
│                                                              │
│  Current state = replay all events                          │
│  Full history preserved!                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## How Event Sourcing Works

```
┌─────────────────────────────────────────────────────────────┐
│              EVENT SOURCING FLOW                             │
│                                                              │
│  1. Command arrives                                         │
│     AddItemToCart(productId, quantity)                      │
│                                                              │
│  2. Load aggregate from events                              │
│     Cart = replay(events for cart_123)                      │
│                                                              │
│  3. Validate and execute command                            │
│     cart.addItem(productId, quantity)                       │
│                                                              │
│  4. Generate new event(s)                                   │
│     ItemAddedToCart { cartId, productId, quantity }         │
│                                                              │
│  5. Append event to event store                             │
│     eventStore.append(cartId, event)                        │
│                                                              │
│  6. Publish event for read model updates                    │
│     eventBus.publish(event)                                 │
│                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                 │
│  │ Command │───▶│Aggregate│───▶│  Event  │                 │
│  └─────────┘    │ (Cart)  │    │  Store  │                 │
│                 └─────────┘    └────┬────┘                 │
│                      ▲              │                       │
│                      │              ▼                       │
│                      │         ┌─────────┐                 │
│                      └─────────│  Event  │                 │
│                       replay   │   Bus   │                 │
│                                └─────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Event Structure

```typescript
// Base event interface
interface DomainEvent {
  eventId: string; // Unique event ID
  aggregateId: string; // ID of the aggregate
  aggregateType: string; // Type of aggregate (Order, Cart, etc.)
  eventType: string; // Type of event
  version: number; // Version for optimistic concurrency
  timestamp: Date; // When event occurred
  data: Record<string, unknown>; // Event payload
  metadata?: {
    userId?: string; // Who triggered the event
    correlationId?: string; // For tracing
    causationId?: string; // What caused this event
  };
}

// Concrete events
interface OrderCreatedEvent extends DomainEvent {
  eventType: 'OrderCreated';
  data: {
    userId: string;
    items: { productId: string; quantity: number; price: number }[];
  };
}

interface ItemAddedEvent extends DomainEvent {
  eventType: 'ItemAdded';
  data: {
    productId: string;
    quantity: number;
    price: number;
  };
}

interface OrderConfirmedEvent extends DomainEvent {
  eventType: 'OrderConfirmed';
  data: {
    total: number;
    confirmedAt: Date;
  };
}
```

---

## Aggregate with Event Sourcing

```typescript
// Event-sourced aggregate
class Order {
  private id: string;
  private userId: string;
  private items: Map<string, OrderItem> = new Map();
  private status: OrderStatus = 'DRAFT';
  private total: number = 0;
  private version: number = 0;

  // Uncommitted events (new events from this session)
  private uncommittedEvents: DomainEvent[] = [];

  // Reconstruct from events
  static fromEvents(events: DomainEvent[]): Order {
    const order = new Order();
    for (const event of events) {
      order.apply(event, false);
    }
    return order;
  }

  // Apply event to update state
  private apply(event: DomainEvent, isNew: boolean = true): void {
    switch (event.eventType) {
      case 'OrderCreated':
        this.applyOrderCreated(event as OrderCreatedEvent);
        break;
      case 'ItemAdded':
        this.applyItemAdded(event as ItemAddedEvent);
        break;
      case 'ItemRemoved':
        this.applyItemRemoved(event as ItemRemovedEvent);
        break;
      case 'OrderConfirmed':
        this.applyOrderConfirmed(event as OrderConfirmedEvent);
        break;
    }

    this.version++;

    if (isNew) {
      this.uncommittedEvents.push(event);
    }
  }

  private applyOrderCreated(event: OrderCreatedEvent): void {
    this.id = event.aggregateId;
    this.userId = event.data.userId;
    this.status = 'DRAFT';
  }

  private applyItemAdded(event: ItemAddedEvent): void {
    const existing = this.items.get(event.data.productId);
    if (existing) {
      existing.quantity += event.data.quantity;
    } else {
      this.items.set(event.data.productId, {
        productId: event.data.productId,
        quantity: event.data.quantity,
        price: event.data.price,
      });
    }
    this.recalculateTotal();
  }

  private applyItemRemoved(event: ItemRemovedEvent): void {
    this.items.delete(event.data.productId);
    this.recalculateTotal();
  }

  private applyOrderConfirmed(event: OrderConfirmedEvent): void {
    this.status = 'CONFIRMED';
    this.total = event.data.total;
  }

  // Command methods that generate events
  static create(id: string, userId: string): Order {
    const order = new Order();
    order.apply({
      eventId: generateId(),
      aggregateId: id,
      aggregateType: 'Order',
      eventType: 'OrderCreated',
      version: 1,
      timestamp: new Date(),
      data: { userId },
    });
    return order;
  }

  addItem(productId: string, quantity: number, price: number): void {
    if (this.status !== 'DRAFT') {
      throw new Error('Cannot modify confirmed order');
    }

    this.apply({
      eventId: generateId(),
      aggregateId: this.id,
      aggregateType: 'Order',
      eventType: 'ItemAdded',
      version: this.version + 1,
      timestamp: new Date(),
      data: { productId, quantity, price },
    });
  }

  confirm(): void {
    if (this.items.size === 0) {
      throw new Error('Cannot confirm empty order');
    }

    this.apply({
      eventId: generateId(),
      aggregateId: this.id,
      aggregateType: 'Order',
      eventType: 'OrderConfirmed',
      version: this.version + 1,
      timestamp: new Date(),
      data: { total: this.total, confirmedAt: new Date() },
    });
  }

  getUncommittedEvents(): DomainEvent[] {
    return [...this.uncommittedEvents];
  }

  clearUncommittedEvents(): void {
    this.uncommittedEvents = [];
  }

  private recalculateTotal(): void {
    this.total = Array.from(this.items.values()).reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}
```

---

## Benefits of Event Sourcing

```
┌─────────────────────────────────────────────────────────────┐
│              BENEFITS                                        │
│                                                              │
│  1. Complete Audit Trail                                    │
│     Every change is recorded with who, what, when           │
│     Perfect for compliance and debugging                    │
│                                                              │
│  2. Time Travel                                             │
│     Reconstruct state at any point in time                  │
│     "What did the order look like yesterday?"               │
│                                                              │
│  3. Event Replay                                            │
│     Rebuild read models from scratch                        │
│     Fix bugs by replaying with corrected logic              │
│                                                              │
│  4. Debugging                                               │
│     Reproduce exact sequence of events                      │
│     Understand how state got corrupted                      │
│                                                              │
│  5. Analytics                                               │
│     Rich historical data for analysis                       │
│     Understand user behavior patterns                       │
│                                                              │
│  6. Integration                                             │
│     Events naturally integrate with other systems           │
│     Publish events for downstream consumers                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Challenges

```
┌─────────────────────────────────────────────────────────────┐
│              CHALLENGES                                      │
│                                                              │
│  1. Event Schema Evolution                                  │
│     Events are immutable - can't change old events          │
│     Must handle multiple versions                           │
│                                                              │
│  2. Performance                                             │
│     Loading many events can be slow                         │
│     Solution: Snapshots                                     │
│                                                              │
│  3. Complexity                                              │
│     Different mental model                                  │
│     Team needs training                                     │
│                                                              │
│  4. Querying                                                │
│     Can't query events directly for current state           │
│     Need read models (CQRS)                                 │
│                                                              │
│  5. Storage                                                 │
│     Events accumulate forever                               │
│     Need archival strategy                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Store events, not state** - events are the source of truth
2. **Replay to get state** - current state = sum of all events
3. **Events are immutable** - never modify, only append
4. **Full audit trail** - complete history preserved
5. **Combine with CQRS** - events for writes, projections for reads

---

## What's Next?

In the next lesson, we will build an Event Store implementation.

---
