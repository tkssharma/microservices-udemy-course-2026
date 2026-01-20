# Lesson 7.2: Event Types (Domain, Integration, Commands)

## Introduction

Not all events are the same. Understanding different event types helps you design better event-driven systems and choose the right approach for each scenario.

---

## Three Types of Messages

```
┌─────────────────────────────────────────────────────────────┐
│              MESSAGE TYPES                                   │
│                                                              │
│  1. Events                                                  │
│     "Something happened"                                    │
│     Past tense, immutable fact                              │
│     Example: OrderPlaced, UserRegistered                    │
│                                                              │
│  2. Commands                                                │
│     "Do something"                                          │
│     Imperative, request for action                          │
│     Example: PlaceOrder, SendEmail                          │
│                                                              │
│  3. Queries                                                 │
│     "Tell me something"                                     │
│     Request for information                                 │
│     Example: GetOrderStatus, FindUser                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Domain Events vs Integration Events

```
┌─────────────────────────────────────────────────────────────┐
│              DOMAIN EVENTS                                   │
│                                                              │
│  Internal to a service/bounded context                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 Order Service                        │   │
│  │                                                      │   │
│  │  OrderAggregate ──▶ OrderPlaced (domain event)      │   │
│  │        │                   │                         │   │
│  │        │                   ▼                         │   │
│  │        │           OrderEventHandler                 │   │
│  │        │           (update read model)               │   │
│  │        │                                             │   │
│  └────────┼─────────────────────────────────────────────┘   │
│           │                                                  │
│           │ NOT exposed outside                              │
│                                                              │
│  Characteristics:                                           │
│  • Rich domain language                                     │
│  • Contains internal details                                │
│  • Used within bounded context                              │
│  • Can change without affecting other services              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              INTEGRATION EVENTS                              │
│                                                              │
│  Published for other services to consume                    │
│                                                              │
│  ┌──────────────┐                    ┌──────────────┐      │
│  │Order Service │                    │Payment Service│      │
│  │              │                    │              │      │
│  │ OrderPlaced  │                    │              │      │
│  │ (domain)     │                    │              │      │
│  │      │       │                    │              │      │
│  │      ▼       │                    │              │      │
│  │ Translator   │                    │              │      │
│  │      │       │                    │              │      │
│  └──────┼───────┘                    └──────┬───────┘      │
│         │                                   │               │
│         ▼                                   ▼               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Message Broker                          │   │
│  │         OrderCreatedIntegrationEvent                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Characteristics:                                           │
│  • Simplified, stable contract                              │
│  • No internal implementation details                       │
│  • Versioned for backward compatibility                     │
│  • Part of public API                                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Domain Event Example

```typescript
// Domain event - internal to Order Service
interface OrderPlacedDomainEvent {
  orderId: string;
  customerId: string;
  customerEmail: string;
  customerTier: 'bronze' | 'silver' | 'gold'; // Internal detail
  items: {
    productId: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxRate: number;
  }[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  shippingCost: number;
  total: number;
  paymentMethod: {
    type: string;
    lastFourDigits: string;
    expiryDate: string;
  };
  shippingAddress: Address;
  billingAddress: Address;
  internalNotes: string; // Internal detail
  createdAt: Date;
  createdBy: string;
}

// Used within Order Service
class OrderEventHandler {
  handle(event: OrderPlacedDomainEvent): void {
    // Update read model, send internal notifications, etc.
  }
}
```

---

## Integration Event Example

```typescript
// Integration event - published to other services
interface OrderCreatedIntegrationEvent {
  eventId: string;
  eventType: 'order.created';
  version: '1.0';
  timestamp: string;
  data: {
    orderId: string;
    customerId: string;
    items: {
      productId: string;
      quantity: number;
      price: number;
    }[];
    total: number;
    currency: string;
  };
}

// Translator converts domain event to integration event
class OrderIntegrationEventPublisher {
  async publish(domainEvent: OrderPlacedDomainEvent): Promise<void> {
    const integrationEvent: OrderCreatedIntegrationEvent = {
      eventId: generateId(),
      eventType: 'order.created',
      version: '1.0',
      timestamp: new Date().toISOString(),
      data: {
        orderId: domainEvent.orderId,
        customerId: domainEvent.customerId,
        items: domainEvent.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.unitPrice,
        })),
        total: domainEvent.total,
        currency: 'USD',
      },
    };

    await this.messageBroker.publish('orders', integrationEvent);
  }
}
```

---

## Commands

Commands are requests for action. Unlike events, commands can be rejected.

```
┌─────────────────────────────────────────────────────────────┐
│              COMMANDS                                        │
│                                                              │
│  Events:                                                    │
│  • Past tense: OrderPlaced, PaymentProcessed                │
│  • Cannot be rejected (already happened)                    │
│  • Multiple handlers possible                               │
│                                                              │
│  Commands:                                                  │
│  • Imperative: PlaceOrder, ProcessPayment                   │
│  • Can be rejected (validation, business rules)             │
│  • Single handler (one service processes)                   │
│                                                              │
│  Flow:                                                      │
│  ──────                                                     │
│  Command: PlaceOrder ──▶ Order Service                      │
│                              │                              │
│                              ├── Validate                   │
│                              ├── Process                    │
│                              └── Emit Event: OrderPlaced    │
└─────────────────────────────────────────────────────────────┘
```

### Command Implementation

```typescript
// Command
interface PlaceOrderCommand {
  commandId: string;
  userId: string;
  items: { productId: string; quantity: number }[];
  shippingAddress: Address;
  paymentMethod: string;
}

// Command handler
class PlaceOrderHandler {
  async handle(command: PlaceOrderCommand): Promise<Order> {
    // Validate
    const user = await this.userService.getUser(command.userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check inventory
    for (const item of command.items) {
      const available = await this.inventoryService.checkStock(item.productId);
      if (available < item.quantity) {
        throw new Error(`Insufficient stock for ${item.productId}`);
      }
    }

    // Create order
    const order = await this.orderRepository.create({
      userId: command.userId,
      items: command.items,
      shippingAddress: command.shippingAddress,
      status: 'PENDING',
    });

    // Emit domain event
    await this.eventBus.publish({
      type: 'ORDER_PLACED',
      data: order,
    });

    return order;
  }
}
```

---

## Event vs Command Comparison

| Aspect      | Event              | Command                 |
| ----------- | ------------------ | ----------------------- |
| Tense       | Past (OrderPlaced) | Imperative (PlaceOrder) |
| Can reject? | No                 | Yes                     |
| Handlers    | Multiple           | Single                  |
| Coupling    | Loose              | Tighter                 |
| Response    | None               | Success/Failure         |

---

## Notification Events vs Event-Carried State Transfer

```
┌─────────────────────────────────────────────────────────────┐
│              NOTIFICATION EVENT                              │
│                                                              │
│  Minimal data - just notifies something happened            │
│                                                              │
│  {                                                          │
│    "type": "ORDER_PLACED",                                  │
│    "data": {                                                │
│      "orderId": "ord_123"                                   │
│    }                                                        │
│  }                                                          │
│                                                              │
│  Consumer must call back to get details:                    │
│  GET /orders/ord_123                                        │
│                                                              │
│  Pros: Small events, always fresh data                      │
│  Cons: Requires callback, coupling to source                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              EVENT-CARRIED STATE TRANSFER                    │
│                                                              │
│  Contains all data consumer needs                           │
│                                                              │
│  {                                                          │
│    "type": "ORDER_PLACED",                                  │
│    "data": {                                                │
│      "orderId": "ord_123",                                  │
│      "userId": "usr_456",                                   │
│      "userEmail": "user@example.com",                       │
│      "items": [...],                                        │
│      "total": 99.99,                                        │
│      "shippingAddress": {...}                               │
│    }                                                        │
│  }                                                          │
│                                                              │
│  Consumer has all needed data                               │
│                                                              │
│  Pros: No callback needed, decoupled                        │
│  Cons: Larger events, potentially stale data                │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Domain events** - internal, rich, can change freely
2. **Integration events** - external, stable contract, versioned
3. **Commands** - requests for action, can be rejected
4. **Notification events** - minimal data, requires callback
5. **Event-carried state** - full data, no callback needed
6. **Choose based on coupling needs** and data freshness requirements

---

## What's Next?

In the next lesson, we will compare message brokers: RabbitMQ, Kafka, and Redis.

---
