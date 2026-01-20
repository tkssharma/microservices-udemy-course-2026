# Lesson 7.1: Event-Driven Fundamentals

## Introduction

Event-driven architecture (EDA) is a design pattern where services communicate by producing and consuming events. Instead of direct calls, services react to things that have happened.

---

## What is an Event?

An event is a record of something that happened in the system.

```
┌─────────────────────────────────────────────────────────────┐
│              WHAT IS AN EVENT?                               │
│                                                              │
│  An event represents a fact that occurred:                  │
│                                                              │
│  • "Order was placed"                                       │
│  • "Payment was processed"                                  │
│  • "User registered"                                        │
│  • "Inventory was updated"                                  │
│                                                              │
│  Key characteristics:                                       │
│  ────────────────────                                       │
│  • Immutable - cannot be changed after creation             │
│  • Past tense - describes what happened                     │
│  • Contains data - relevant information about what happened │
│  • Has timestamp - when it occurred                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Request-Response vs Event-Driven

```
┌─────────────────────────────────────────────────────────────┐
│              REQUEST-RESPONSE                                │
│                                                              │
│  ┌─────────────┐         ┌─────────────┐                   │
│  │   Order     │ ──────▶ │   Payment   │                   │
│  │   Service   │ request │   Service   │                   │
│  │             │ ◀────── │             │                   │
│  └─────────────┘ response└─────────────┘                   │
│                                                              │
│  • Synchronous                                              │
│  • Tight coupling                                           │
│  • Caller waits for response                                │
│  • Caller knows about callee                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              EVENT-DRIVEN                                    │
│                                                              │
│  ┌─────────────┐         ┌─────────────┐                   │
│  │   Order     │         │   Payment   │                   │
│  │   Service   │         │   Service   │                   │
│  └──────┬──────┘         └──────┬──────┘                   │
│         │                       │                           │
│         │ publish               │ subscribe                 │
│         ▼                       ▼                           │
│  ┌─────────────────────────────────────────┐               │
│  │            Message Broker                │               │
│  │         (ORDER_PLACED event)             │               │
│  └─────────────────────────────────────────┘               │
│                                                              │
│  • Asynchronous                                             │
│  • Loose coupling                                           │
│  • Publisher doesn't wait                                   │
│  • Publisher doesn't know subscribers                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Event-Driven Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│              EDA COMPONENTS                                  │
│                                                              │
│  1. Event Producers                                         │
│     Services that publish events                            │
│     Example: Order Service publishes ORDER_PLACED           │
│                                                              │
│  2. Event Consumers                                         │
│     Services that subscribe to and process events           │
│     Example: Email Service listens for ORDER_PLACED         │
│                                                              │
│  3. Event Channel (Message Broker)                          │
│     Infrastructure that routes events                       │
│     Example: RabbitMQ, Kafka, Redis Streams                 │
│                                                              │
│  4. Events                                                  │
│     The messages themselves                                 │
│     Example: { type: "ORDER_PLACED", data: {...} }          │
└─────────────────────────────────────────────────────────────┘
```

---

## Event Structure

```typescript
interface Event {
  // Unique identifier for this event
  id: string;

  // Type of event
  type: string;

  // When the event occurred
  timestamp: string;

  // Version for schema evolution
  version: string;

  // Source service that produced the event
  source: string;

  // Correlation ID for tracing
  correlationId: string;

  // The actual event data
  data: Record<string, unknown>;
}

// Example
const orderPlacedEvent: Event = {
  id: 'evt_123456',
  type: 'ORDER_PLACED',
  timestamp: '2024-01-15T10:30:00Z',
  version: '1.0',
  source: 'order-service',
  correlationId: 'req_789',
  data: {
    orderId: 'ord_456',
    userId: 'usr_123',
    items: [{ productId: 'prod_1', quantity: 2, price: 29.99 }],
    total: 59.98,
  },
};
```

---

## Benefits of Event-Driven Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              BENEFITS                                        │
│                                                              │
│  1. Loose Coupling                                          │
│     • Producers don't know about consumers                  │
│     • Services can evolve independently                     │
│     • Easy to add new consumers                             │
│                                                              │
│  2. Scalability                                             │
│     • Consumers can scale independently                     │
│     • Events can be processed in parallel                   │
│     • Backpressure handling                                 │
│                                                              │
│  3. Resilience                                              │
│     • Events are persisted in broker                        │
│     • Failed consumers can retry                            │
│     • System continues if one service is down               │
│                                                              │
│  4. Audit Trail                                             │
│     • Events provide history of what happened               │
│     • Can replay events for debugging                       │
│     • Natural audit log                                     │
│                                                              │
│  5. Real-time Processing                                    │
│     • React to events as they happen                        │
│     • Stream processing                                     │
│     • Real-time analytics                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Challenges

```
┌─────────────────────────────────────────────────────────────┐
│              CHALLENGES                                      │
│                                                              │
│  1. Complexity                                              │
│     • Harder to trace request flow                          │
│     • Debugging distributed events                          │
│     • Understanding system behavior                         │
│                                                              │
│  2. Eventual Consistency                                    │
│     • Data not immediately consistent                       │
│     • Must design for temporary inconsistency               │
│                                                              │
│  3. Event Ordering                                          │
│     • Events may arrive out of order                        │
│     • Must handle ordering requirements                     │
│                                                              │
│  4. Duplicate Events                                        │
│     • Same event may be delivered multiple times            │
│     • Must implement idempotency                            │
│                                                              │
│  5. Schema Evolution                                        │
│     • Event structure changes over time                     │
│     • Must maintain backward compatibility                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Simple Implementation

```typescript
// Simple event bus implementation
class EventBus {
  private handlers: Map<string, Function[]> = new Map();

  subscribe(eventType: string, handler: Function): void {
    const handlers = this.handlers.get(eventType) || [];
    handlers.push(handler);
    this.handlers.set(eventType, handlers);
  }

  async publish(event: Event): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];

    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        console.error(`Handler failed for ${event.type}:`, error);
      }
    }
  }
}

// Usage
const eventBus = new EventBus();

// Subscribe to events
eventBus.subscribe('ORDER_PLACED', async (event: Event) => {
  console.log('Processing order:', event.data.orderId);
  await sendConfirmationEmail(event.data);
});

eventBus.subscribe('ORDER_PLACED', async (event: Event) => {
  console.log('Updating inventory for order:', event.data.orderId);
  await updateInventory(event.data.items);
});

// Publish event
await eventBus.publish({
  id: generateId(),
  type: 'ORDER_PLACED',
  timestamp: new Date().toISOString(),
  version: '1.0',
  source: 'order-service',
  correlationId: 'req_123',
  data: { orderId: 'ord_456', items: [...] }
});
```

---

## Key Takeaways

1. **Events represent facts** - things that happened in the past
2. **Loose coupling** - producers don't know consumers
3. **Asynchronous** - no waiting for responses
4. **Scalable and resilient** - handle failures gracefully
5. **Trade-offs exist** - complexity, eventual consistency

---

## What's Next?

In the next lesson, we will explore different types of events and when to use each.

---
