# Lesson 7.4: Pub/Sub Pattern

## Introduction

The Publish-Subscribe (Pub/Sub) pattern is a messaging pattern where publishers send messages without knowing who will receive them, and subscribers receive messages without knowing who sent them.

---

## How Pub/Sub Works

```
┌─────────────────────────────────────────────────────────────┐
│              PUB/SUB PATTERN                                 │
│                                                              │
│  Publishers                    Subscribers                  │
│  ──────────                    ───────────                  │
│                                                              │
│  ┌──────────┐                  ┌──────────┐                │
│  │ Order    │──publish──┐      │  Email   │                │
│  │ Service  │           │      │ Service  │◀──subscribe    │
│  └──────────┘           │      └──────────┘      │         │
│                         │                        │         │
│                         ▼                        │         │
│                  ┌─────────────┐                 │         │
│                  │   Topic:    │                 │         │
│                  │   orders    │◀────────────────┘         │
│                  └─────────────┘                           │
│                         │                                   │
│                         │      ┌──────────┐                │
│                         └─────▶│Inventory │                │
│                                │ Service  │                │
│                                └──────────┘                │
│                                                              │
│  • Publisher doesn't know subscribers                       │
│  • Subscribers don't know publisher                         │
│  • Topic/Channel decouples them                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Pub/Sub vs Point-to-Point

```
┌─────────────────────────────────────────────────────────────┐
│              POINT-TO-POINT (Queue)                          │
│                                                              │
│  Producer ──▶ Queue ──▶ Consumer                            │
│                                                              │
│  • One message, one consumer                                │
│  • Message removed after consumption                        │
│  • Load balancing across consumers                          │
│  • Use for: Task distribution                               │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              PUB/SUB (Topic)                                 │
│                                                              │
│                      ┌──▶ Subscriber A                      │
│  Publisher ──▶ Topic ├──▶ Subscriber B                      │
│                      └──▶ Subscriber C                      │
│                                                              │
│  • One message, many consumers                              │
│  • Each subscriber gets a copy                              │
│  • Broadcast to all interested parties                      │
│  • Use for: Event notification                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation with RabbitMQ (Fanout Exchange)

```typescript
import amqp from 'amqplib';

// Publisher
class EventPublisher {
  private channel: amqp.Channel;

  async connect(): Promise<void> {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    this.channel = await connection.createChannel();

    // Fanout exchange broadcasts to all bound queues
    await this.channel.assertExchange('order-events', 'fanout', {
      durable: true,
    });
  }

  async publish(event: object): Promise<void> {
    const message = Buffer.from(JSON.stringify(event));

    // Routing key ignored for fanout
    this.channel.publish('order-events', '', message, {
      persistent: true,
    });
  }
}

// Subscriber
class EventSubscriber {
  private channel: amqp.Channel;

  async subscribe(handler: Function): Promise<void> {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    this.channel = await connection.createChannel();

    // Each subscriber gets its own queue
    const queue = await this.channel.assertQueue('', {
      exclusive: true, // Auto-delete when connection closes
    });

    // Bind queue to exchange
    await this.channel.bindQueue(queue.queue, 'order-events', '');

    // Consume
    this.channel.consume(queue.queue, async (msg) => {
      if (msg) {
        const event = JSON.parse(msg.content.toString());
        await handler(event);
        this.channel.ack(msg);
      }
    });
  }
}

// Usage
// Publisher (Order Service)
const publisher = new EventPublisher();
await publisher.connect();
await publisher.publish({
  type: 'ORDER_PLACED',
  orderId: 'ord_123',
  userId: 'usr_456',
});

// Subscriber 1 (Email Service)
const emailSubscriber = new EventSubscriber();
await emailSubscriber.subscribe(async (event) => {
  if (event.type === 'ORDER_PLACED') {
    await sendOrderConfirmationEmail(event.orderId);
  }
});

// Subscriber 2 (Inventory Service)
const inventorySubscriber = new EventSubscriber();
await inventorySubscriber.subscribe(async (event) => {
  if (event.type === 'ORDER_PLACED') {
    await reserveInventory(event.orderId);
  }
});
```

---

## Implementation with Kafka

```typescript
import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['localhost:9092'],
});

// Publisher
class KafkaPublisher {
  private producer = kafka.producer();

  async connect(): Promise<void> {
    await this.producer.connect();
  }

  async publish(topic: string, event: object): Promise<void> {
    await this.producer.send({
      topic,
      messages: [{ value: JSON.stringify(event) }],
    });
  }
}

// Subscriber (each consumer group gets all messages)
class KafkaSubscriber {
  private consumer: ReturnType<typeof kafka.consumer>;

  constructor(groupId: string) {
    this.consumer = kafka.consumer({ groupId });
  }

  async subscribe(topic: string, handler: Function): Promise<void> {
    await this.consumer.connect();
    await this.consumer.subscribe({ topic });

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const event = JSON.parse(message.value.toString());
        await handler(event);
      },
    });
  }
}

// Usage
const publisher = new KafkaPublisher();
await publisher.connect();
await publisher.publish('orders', { type: 'ORDER_PLACED', orderId: '123' });

// Different consumer groups = each gets all messages (pub/sub)
const emailService = new KafkaSubscriber('email-service');
await emailService.subscribe('orders', handleEmailEvent);

const inventoryService = new KafkaSubscriber('inventory-service');
await inventoryService.subscribe('orders', handleInventoryEvent);
```

---

## Topic-Based Filtering

```
┌─────────────────────────────────────────────────────────────┐
│              TOPIC-BASED FILTERING                           │
│                                                              │
│  Topics:                                                    │
│  • orders.created                                           │
│  • orders.shipped                                           │
│  • orders.cancelled                                         │
│  • payments.completed                                       │
│  • payments.failed                                          │
│                                                              │
│  Subscribers:                                               │
│  ────────────                                               │
│  Email Service:     orders.* (all order events)             │
│  Inventory Service: orders.created, orders.cancelled        │
│  Analytics Service: *.* (all events)                        │
│  Fraud Service:     payments.* (all payment events)         │
└─────────────────────────────────────────────────────────────┘
```

### Topic Pattern Matching (RabbitMQ)

```typescript
// Publisher
await channel.assertExchange('events', 'topic', { durable: true });

// Publish with routing key
channel.publish('events', 'order.created', message);
channel.publish('events', 'order.shipped', message);
channel.publish('events', 'payment.completed', message);

// Subscriber - bind with pattern
// * matches one word, # matches zero or more words
await channel.bindQueue(queue, 'events', 'order.*'); // All order events
await channel.bindQueue(queue, 'events', '*.created'); // All created events
await channel.bindQueue(queue, 'events', '#'); // All events
```

---

## Durable Subscriptions

```
┌─────────────────────────────────────────────────────────────┐
│              DURABLE vs NON-DURABLE                          │
│                                                              │
│  Non-Durable (Ephemeral):                                   │
│  ─────────────────────────                                  │
│  • Subscription exists only while connected                 │
│  • Messages missed during disconnect                        │
│  • Use for: Real-time updates, live dashboards              │
│                                                              │
│  Durable:                                                   │
│  ────────                                                   │
│  • Subscription persists across disconnects                 │
│  • Messages queued while disconnected                       │
│  • Use for: Critical events, must not miss                  │
│                                                              │
│  Timeline:                                                  │
│  ─────────                                                  │
│  [Connected]──[Disconnected]──[Reconnected]                 │
│       │              │              │                       │
│  Non-durable:   Miss events    Resume (no backlog)          │
│  Durable:       Queue events   Receive backlog              │
└─────────────────────────────────────────────────────────────┘
```

### Durable Subscription Implementation

```typescript
// RabbitMQ - Durable queue
const queue = await channel.assertQueue('email-service-orders', {
  durable: true, // Survives broker restart
  exclusive: false, // Can reconnect
  autoDelete: false, // Don't delete when consumer disconnects
});

// Kafka - Consumer group automatically durable
// Offset tracked per consumer group
const consumer = kafka.consumer({ groupId: 'email-service' });
```

---

## Best Practices

```
┌─────────────────────────────────────────────────────────────┐
│              BEST PRACTICES                                  │
│                                                              │
│  1. Use Meaningful Topic Names                              │
│     Good: orders.created, users.registered                  │
│     Bad:  topic1, events                                    │
│                                                              │
│  2. Include Event Metadata                                  │
│     • Event ID (for deduplication)                          │
│     • Timestamp                                             │
│     • Source service                                        │
│     • Correlation ID                                        │
│                                                              │
│  3. Handle Failures                                         │
│     • Implement retry logic                                 │
│     • Use dead letter queues                                │
│     • Log failed events                                     │
│                                                              │
│  4. Idempotent Handlers                                     │
│     • Same event processed multiple times = same result     │
│     • Track processed event IDs                             │
│                                                              │
│  5. Monitor Lag                                             │
│     • Track how far behind consumers are                    │
│     • Alert on growing lag                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Pub/Sub decouples** publishers from subscribers
2. **One message, many consumers** - broadcast pattern
3. **Topic filtering** allows selective subscription
4. **Durable subscriptions** for critical events
5. **Idempotency** is essential for reliability

---

## What's Next?

In the next lesson, we will explore Event Storming for domain discovery.

---
