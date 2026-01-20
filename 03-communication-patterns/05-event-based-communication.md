# Lesson 3.5: Event-Based Communication

## Introduction

Event-based communication is a pattern where services communicate by publishing and subscribing to events. This creates loosely coupled systems where services react to changes rather than being directly called.

---

## Events vs Commands vs Queries

```
┌─────────────────────────────────────────────────────────────┐
│           EVENTS vs COMMANDS vs QUERIES                      │
│                                                              │
│  COMMAND (Imperative)                                       │
│  ────────────────────                                       │
│  "Do this thing"                                            │
│  • CreateOrder, SendEmail, ProcessPayment                   │
│  • Directed at specific service                             │
│  • Expects action to be taken                               │
│  • Usually one handler                                      │
│                                                              │
│  QUERY (Request)                                            │
│  ───────────────                                            │
│  "Give me this data"                                        │
│  • GetUser, FindProducts, GetOrderStatus                    │
│  • Expects response                                         │
│  • Synchronous typically                                    │
│                                                              │
│  EVENT (Fact)                                               │
│  ────────────                                               │
│  "This thing happened"                                      │
│  • OrderCreated, PaymentReceived, UserRegistered            │
│  • Published to anyone interested                           │
│  • No expectation of response                               │
│  • Multiple handlers possible                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Event Types

```
┌─────────────────────────────────────────────────────────────┐
│                    EVENT TYPES                               │
│                                                              │
│  1. Domain Events                                           │
│  ─────────────────                                          │
│  Business-meaningful events within a bounded context.       │
│  • OrderPlaced, PaymentProcessed, InventoryReserved         │
│  • Used within a service or between closely related ones    │
│                                                              │
│  2. Integration Events                                      │
│  ─────────────────────                                      │
│  Events published for other services to consume.            │
│  • OrderCreatedIntegrationEvent                             │
│  • Cross-service communication                              │
│  • Part of public API                                       │
│                                                              │
│  3. Event-Carried State Transfer                            │
│  ───────────────────────────────                            │
│  Events that carry data for consumers to cache.             │
│  • UserUpdated { id, name, email, address }                 │
│  • Reduces need for synchronous queries                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Event-Driven Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              EVENT-DRIVEN ARCHITECTURE                       │
│                                                              │
│                    ┌─────────────────┐                      │
│                    │  Event Broker   │                      │
│                    │ (RabbitMQ/Kafka)│                      │
│                    └────────┬────────┘                      │
│           ┌─────────────────┼─────────────────┐             │
│           │                 │                 │             │
│           ▼                 ▼                 ▼             │
│    ┌────────────┐   ┌────────────┐   ┌────────────┐        │
│    │   Order    │   │ Inventory  │   │   Email    │        │
│    │  Service   │   │  Service   │   │  Service   │        │
│    └────────────┘   └────────────┘   └────────────┘        │
│           │                 │                 │             │
│           │    publishes    │    subscribes   │             │
│           │                 │                 │             │
│           ▼                 ▼                 ▼             │
│    OrderCreated      InventoryReserved   EmailSent         │
│    OrderPaid         StockDepleted                         │
│    OrderShipped                                            │
│                                                              │
│  Services publish events about what happened.               │
│  Other services subscribe to events they care about.        │
└─────────────────────────────────────────────────────────────┘
```

---

## Event Schema Design

### Event Structure

```typescript
// src/events/base-event.ts
interface BaseEvent {
  eventId: string; // Unique event identifier
  eventType: string; // Type of event
  aggregateId: string; // ID of the entity this event is about
  aggregateType: string; // Type of entity
  timestamp: string; // ISO 8601 timestamp
  version: number; // Schema version
  correlationId?: string; // For tracing
  causationId?: string; // ID of event that caused this
  metadata?: Record<string, any>;
}

interface OrderCreatedEvent extends BaseEvent {
  eventType: 'ORDER_CREATED';
  aggregateType: 'Order';
  data: {
    orderId: string;
    userId: string;
    items: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unitPrice: number;
    }>;
    totalAmount: number;
    currency: string;
    shippingAddress: {
      street: string;
      city: string;
      country: string;
      zipCode: string;
    };
  };
}
```

### Event Factory

```typescript
// src/events/event-factory.ts
import { v4 as uuidv4 } from 'uuid';

export class EventFactory {
  static create<T extends BaseEvent>(
    eventType: string,
    aggregateType: string,
    aggregateId: string,
    data: any,
    options: {
      correlationId?: string;
      causationId?: string;
      version?: number;
    } = {},
  ): T {
    return {
      eventId: uuidv4(),
      eventType,
      aggregateType,
      aggregateId,
      timestamp: new Date().toISOString(),
      version: options.version || 1,
      correlationId: options.correlationId,
      causationId: options.causationId,
      data,
    } as T;
  }
}

// Usage
const event = EventFactory.create<OrderCreatedEvent>(
  'ORDER_CREATED',
  'Order',
  order.id,
  {
    orderId: order.id,
    userId: order.userId,
    items: order.items,
    totalAmount: order.total,
    currency: 'USD',
    shippingAddress: order.shippingAddress,
  },
  { correlationId: requestId },
);
```

---

## Event Publisher

```typescript
// src/events/event-publisher.ts
import { Channel } from 'amqplib';
import { rabbitmq } from '../messaging/rabbitmq';

export class EventPublisher {
  private channel: Channel;
  private exchange: string;

  constructor(exchange: string = 'events') {
    this.exchange = exchange;
    this.channel = rabbitmq.getChannel();
  }

  async init(): Promise<void> {
    await this.channel.assertExchange(this.exchange, 'topic', {
      durable: true,
    });
  }

  async publish(event: BaseEvent): Promise<void> {
    const routingKey = this.buildRoutingKey(event);
    const content = Buffer.from(JSON.stringify(event));

    this.channel.publish(this.exchange, routingKey, content, {
      persistent: true,
      contentType: 'application/json',
      messageId: event.eventId,
      timestamp: Date.now(),
      headers: {
        'x-event-type': event.eventType,
        'x-aggregate-type': event.aggregateType,
        'x-correlation-id': event.correlationId,
      },
    });

    console.log(`Published event: ${event.eventType} (${event.eventId})`);
  }

  private buildRoutingKey(event: BaseEvent): string {
    // Format: aggregateType.eventType
    // Example: order.created, payment.processed
    const type = event.eventType.toLowerCase().replace('_', '.');
    return `${event.aggregateType.toLowerCase()}.${type}`;
  }
}
```

---

## Event Subscriber

```typescript
// src/events/event-subscriber.ts
import { Channel, ConsumeMessage } from 'amqplib';
import { rabbitmq } from '../messaging/rabbitmq';

type EventHandler<T = any> = (event: T) => Promise<void>;

interface Subscription {
  eventType: string;
  handler: EventHandler;
}

export class EventSubscriber {
  private channel: Channel;
  private exchange: string;
  private queue: string;
  private subscriptions: Map<string, EventHandler[]> = new Map();

  constructor(exchange: string, queue: string) {
    this.exchange = exchange;
    this.queue = queue;
    this.channel = rabbitmq.getChannel();
  }

  async init(): Promise<void> {
    await this.channel.assertExchange(this.exchange, 'topic', {
      durable: true,
    });

    await this.channel.assertQueue(this.queue, {
      durable: true,
      deadLetterExchange: `${this.exchange}.dlx`,
    });

    await this.channel.prefetch(10);
  }

  subscribe<T extends BaseEvent>(eventType: string, handler: EventHandler<T>): void {
    const handlers = this.subscriptions.get(eventType) || [];
    handlers.push(handler as EventHandler);
    this.subscriptions.set(eventType, handlers);
  }

  async start(): Promise<void> {
    // Bind queue for each subscription
    for (const eventType of this.subscriptions.keys()) {
      const routingKey = this.eventTypeToRoutingKey(eventType);
      await this.channel.bindQueue(this.queue, this.exchange, routingKey);
      console.log(`Subscribed to: ${routingKey}`);
    }

    // Start consuming
    await this.channel.consume(
      this.queue,
      async (msg) => {
        if (!msg) return;
        await this.handleMessage(msg);
      },
      { noAck: false },
    );

    console.log(`Event subscriber started: ${this.queue}`);
  }

  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    try {
      const event = JSON.parse(msg.content.toString()) as BaseEvent;
      const handlers = this.subscriptions.get(event.eventType) || [];

      if (handlers.length === 0) {
        console.warn(`No handler for event type: ${event.eventType}`);
        this.channel.ack(msg);
        return;
      }

      // Execute all handlers
      await Promise.all(handlers.map((handler) => handler(event)));

      this.channel.ack(msg);
    } catch (error) {
      console.error('Error handling event:', error);

      // Retry logic
      const retryCount = (msg.properties.headers?.['x-retry-count'] || 0) + 1;

      if (retryCount <= 3) {
        // Requeue with retry count
        this.channel.nack(msg, false, false);
        // Republish with delay (simplified - use delayed exchange in production)
      } else {
        // Send to DLQ
        this.channel.nack(msg, false, false);
      }
    }
  }

  private eventTypeToRoutingKey(eventType: string): string {
    // ORDER_CREATED -> order.order.created
    // Supports wildcards: ORDER_* -> order.order.*
    return eventType.toLowerCase().replace('_', '.');
  }
}
```

---

## Service Implementation

### Order Service (Publisher)

```typescript
// order-service/src/services/order.service.ts
import { EventPublisher } from '../events/event-publisher';
import { EventFactory } from '../events/event-factory';

export class OrderService {
  private eventPublisher: EventPublisher;

  constructor() {
    this.eventPublisher = new EventPublisher('events');
  }

  async init(): Promise<void> {
    await this.eventPublisher.init();
  }

  async createOrder(
    userId: string,
    items: OrderItem[],
    shippingAddress: Address,
    correlationId: string,
  ): Promise<Order> {
    // Create order
    const order = await this.orderRepository.create({
      userId,
      items,
      shippingAddress,
      total: this.calculateTotal(items),
      status: 'CREATED',
    });

    // Publish event
    const event = EventFactory.create<OrderCreatedEvent>(
      'ORDER_CREATED',
      'Order',
      order.id,
      {
        orderId: order.id,
        userId: order.userId,
        items: order.items.map((item) => ({
          productId: item.productId,
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        totalAmount: order.total,
        currency: 'USD',
        shippingAddress: order.shippingAddress,
      },
      { correlationId },
    );

    await this.eventPublisher.publish(event);

    return order;
  }

  async cancelOrder(orderId: string, reason: string): Promise<void> {
    const order = await this.orderRepository.findById(orderId);

    if (!order) {
      throw new Error('Order not found');
    }

    order.status = 'CANCELLED';
    await this.orderRepository.update(order);

    const event = EventFactory.create('ORDER_CANCELLED', 'Order', orderId, {
      orderId,
      reason,
      cancelledAt: new Date().toISOString(),
    });

    await this.eventPublisher.publish(event);
  }
}
```

### Inventory Service (Subscriber)

```typescript
// inventory-service/src/index.ts
import { EventSubscriber } from '../events/event-subscriber';
import { InventoryService } from './services/inventory.service';

async function main() {
  await rabbitmq.connect();

  const inventoryService = new InventoryService();
  const subscriber = new EventSubscriber('events', 'inventory-service');

  await subscriber.init();

  // Subscribe to order events
  subscriber.subscribe<OrderCreatedEvent>('ORDER_CREATED', async (event) => {
    console.log(`Processing ORDER_CREATED: ${event.data.orderId}`);

    for (const item of event.data.items) {
      await inventoryService.reserveStock(item.productId, item.quantity, event.data.orderId);
    }
  });

  subscriber.subscribe<OrderCancelledEvent>('ORDER_CANCELLED', async (event) => {
    console.log(`Processing ORDER_CANCELLED: ${event.data.orderId}`);
    await inventoryService.releaseReservation(event.data.orderId);
  });

  await subscriber.start();
  console.log('Inventory service started');
}

main().catch(console.error);
```

### Notification Service (Subscriber)

```typescript
// notification-service/src/index.ts
import { EventSubscriber } from '../events/event-subscriber';
import { EmailService } from './services/email.service';
import { UserService } from './services/user.service';

async function main() {
  await rabbitmq.connect();

  const emailService = new EmailService();
  const userService = new UserService();
  const subscriber = new EventSubscriber('events', 'notification-service');

  await subscriber.init();

  // Subscribe to multiple event types
  subscriber.subscribe<OrderCreatedEvent>('ORDER_CREATED', async (event) => {
    const user = await userService.getUser(event.data.userId);

    await emailService.send({
      to: user.email,
      subject: `Order Confirmation #${event.data.orderId}`,
      template: 'order-confirmation',
      data: {
        userName: user.name,
        orderId: event.data.orderId,
        items: event.data.items,
        total: event.data.totalAmount,
      },
    });
  });

  subscriber.subscribe<PaymentProcessedEvent>('PAYMENT_PROCESSED', async (event) => {
    const user = await userService.getUser(event.data.userId);

    await emailService.send({
      to: user.email,
      subject: 'Payment Received',
      template: 'payment-received',
      data: event.data,
    });
  });

  subscriber.subscribe<OrderShippedEvent>('ORDER_SHIPPED', async (event) => {
    const user = await userService.getUser(event.data.userId);

    await emailService.send({
      to: user.email,
      subject: 'Your Order Has Shipped!',
      template: 'order-shipped',
      data: {
        trackingNumber: event.data.trackingNumber,
        carrier: event.data.carrier,
        estimatedDelivery: event.data.estimatedDelivery,
      },
    });
  });

  await subscriber.start();
  console.log('Notification service started');
}

main().catch(console.error);
```

---

## Event Flow Example

```
┌─────────────────────────────────────────────────────────────┐
│              ORDER CREATION EVENT FLOW                       │
│                                                              │
│  1. User places order                                       │
│     │                                                        │
│     ▼                                                        │
│  2. Order Service creates order                             │
│     │                                                        │
│     ▼                                                        │
│  3. Order Service publishes ORDER_CREATED                   │
│     │                                                        │
│     ├──────────────────┬──────────────────┐                 │
│     ▼                  ▼                  ▼                 │
│  Inventory         Payment           Notification           │
│  Service           Service           Service                │
│     │                  │                  │                 │
│     ▼                  ▼                  ▼                 │
│  Reserve           Create             Send                  │
│  Stock             Payment            Confirmation          │
│     │              Request            Email                 │
│     │                  │                                    │
│     ▼                  ▼                                    │
│  Publish           Publish                                  │
│  INVENTORY_        PAYMENT_                                 │
│  RESERVED          PROCESSED                                │
│     │                  │                                    │
│     └──────────────────┼──────────────────┐                │
│                        ▼                  ▼                │
│                   Order Service      Notification          │
│                   (update status)    (send receipt)        │
└─────────────────────────────────────────────────────────────┘
```

---

## Idempotency

### Why Idempotency Matters

```
┌─────────────────────────────────────────────────────────────┐
│                    IDEMPOTENCY                               │
│                                                              │
│  Problem: Events may be delivered more than once            │
│  ─────────────────────────────────────────────              │
│                                                              │
│  Scenario:                                                  │
│  1. Consumer receives ORDER_CREATED                         │
│  2. Consumer reserves inventory                             │
│  3. Consumer crashes before acknowledging                   │
│  4. Message is redelivered                                  │
│  5. Consumer reserves inventory AGAIN (double reservation!) │
│                                                              │
│  Solution: Make handlers idempotent                         │
│  ──────────────────────────────────                         │
│  Processing the same event multiple times                   │
│  produces the same result.                                  │
└─────────────────────────────────────────────────────────────┘
```

### Idempotency Implementation

```typescript
// src/services/idempotency.service.ts
import Redis from 'ioredis';

export class IdempotencyService {
  private redis: Redis;
  private ttl: number = 24 * 60 * 60; // 24 hours

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async isProcessed(eventId: string): Promise<boolean> {
    const key = `event:processed:${eventId}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async markProcessed(eventId: string): Promise<void> {
    const key = `event:processed:${eventId}`;
    await this.redis.setex(key, this.ttl, 'true');
  }

  async processOnce<T>(eventId: string, handler: () => Promise<T>): Promise<T | null> {
    // Check if already processed
    if (await this.isProcessed(eventId)) {
      console.log(`Event ${eventId} already processed, skipping`);
      return null;
    }

    // Process
    const result = await handler();

    // Mark as processed
    await this.markProcessed(eventId);

    return result;
  }
}

// Usage in event handler
const idempotencyService = new IdempotencyService();

subscriber.subscribe<OrderCreatedEvent>('ORDER_CREATED', async (event) => {
  await idempotencyService.processOnce(event.eventId, async () => {
    // This will only run once per eventId
    for (const item of event.data.items) {
      await inventoryService.reserveStock(item.productId, item.quantity, event.data.orderId);
    }
  });
});
```

---

## Event Ordering

```
┌─────────────────────────────────────────────────────────────┐
│                  EVENT ORDERING                              │
│                                                              │
│  Problem: Events may arrive out of order                    │
│  ───────────────────────────────────────                    │
│                                                              │
│  Published:  ORDER_CREATED → ORDER_PAID → ORDER_SHIPPED    │
│  Received:   ORDER_PAID → ORDER_CREATED → ORDER_SHIPPED    │
│                                                              │
│  Solutions:                                                 │
│  ──────────                                                 │
│                                                              │
│  1. Partition by aggregate ID                               │
│     Events for same order go to same partition              │
│     (Kafka does this well)                                  │
│                                                              │
│  2. Sequence numbers                                        │
│     Include sequence number in event                        │
│     Reject out-of-order events                              │
│                                                              │
│  3. Timestamp-based                                         │
│     Use event timestamp for ordering                        │
│     Handle late arrivals gracefully                         │
│                                                              │
│  4. Design for eventual consistency                         │
│     Make handlers tolerant of order                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Best Practices

```
┌─────────────────────────────────────────────────────────────┐
│              EVENT-DRIVEN BEST PRACTICES                     │
│                                                              │
│  Event Design:                                              │
│  ─────────────                                              │
│  • Events are immutable facts                               │
│  • Use past tense (OrderCreated, not CreateOrder)           │
│  • Include all relevant data                                │
│  • Version your event schemas                               │
│  • Keep events small but complete                           │
│                                                              │
│  Publishing:                                                │
│  ───────────                                                │
│  • Publish after transaction commits                        │
│  • Use outbox pattern for reliability                       │
│  • Include correlation IDs                                  │
│                                                              │
│  Consuming:                                                 │
│  ──────────                                                 │
│  • Make handlers idempotent                                 │
│  • Handle out-of-order events                               │
│  • Use dead letter queues                                   │
│  • Monitor consumer lag                                     │
│                                                              │
│  Operations:                                                │
│  ───────────                                                │
│  • Log all events                                           │
│  • Monitor event flow                                       │
│  • Set up alerts for failures                               │
│  • Have replay capability                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Events are facts** - Something that happened, not a command
2. **Loose coupling** - Publishers don't know about subscribers
3. **Multiple subscribers** - One event can trigger many reactions
4. **Idempotency is critical** - Events may be delivered multiple times
5. **Include correlation IDs** - For distributed tracing
6. **Version your schemas** - Events evolve over time
7. **Design for failure** - Use DLQs, retries, monitoring

---

## What's Next?

In the next lesson, we will discuss how to choose the right communication pattern for different scenarios.

---
