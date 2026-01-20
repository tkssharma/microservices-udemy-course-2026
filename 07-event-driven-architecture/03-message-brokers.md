# Lesson 7.3: Message Brokers (RabbitMQ, Kafka, Redis)

## Introduction

Message brokers are the backbone of event-driven architecture. They receive, store, and deliver messages between services. This lesson compares three popular options.

---

## What is a Message Broker?

```
┌─────────────────────────────────────────────────────────────┐
│              MESSAGE BROKER                                  │
│                                                              │
│  ┌──────────┐                           ┌──────────┐       │
│  │ Producer │                           │ Consumer │       │
│  │    A     │──┐                   ┌───▶│    X     │       │
│  └──────────┘  │                   │    └──────────┘       │
│                │                   │                        │
│  ┌──────────┐  │  ┌─────────────┐  │    ┌──────────┐       │
│  │ Producer │──┼─▶│   Message   │──┼───▶│ Consumer │       │
│  │    B     │  │  │   Broker    │  │    │    Y     │       │
│  └──────────┘  │  └─────────────┘  │    └──────────┘       │
│                │                   │                        │
│  ┌──────────┐  │                   │    ┌──────────┐       │
│  │ Producer │──┘                   └───▶│ Consumer │       │
│  │    C     │                           │    Z     │       │
│  └──────────┘                           └──────────┘       │
│                                                              │
│  Broker responsibilities:                                   │
│  • Receive messages from producers                          │
│  • Store messages durably                                   │
│  • Deliver messages to consumers                            │
│  • Handle failures and retries                              │
└─────────────────────────────────────────────────────────────┘
```

---

## RabbitMQ

Traditional message broker with flexible routing.

```
┌─────────────────────────────────────────────────────────────┐
│              RABBITMQ ARCHITECTURE                           │
│                                                              │
│  Producer ──▶ Exchange ──▶ Queue ──▶ Consumer               │
│                                                              │
│  Exchange Types:                                            │
│  ───────────────                                            │
│  • Direct:  Route by exact routing key                      │
│  • Fanout:  Broadcast to all bound queues                   │
│  • Topic:   Route by pattern matching                       │
│  • Headers: Route by message headers                        │
│                                                              │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐            │
│  │ Producer │────▶│ Exchange │────▶│  Queue   │            │
│  └──────────┘     │ (topic)  │     │ orders.* │            │
│                   └────┬─────┘     └────┬─────┘            │
│                        │                │                   │
│                        │                ▼                   │
│                        │           ┌──────────┐            │
│                        └──────────▶│  Queue   │            │
│                                    │payments.*│            │
│                                    └──────────┘            │
└─────────────────────────────────────────────────────────────┘
```

### RabbitMQ Implementation

```typescript
import amqp from 'amqplib';

// Publisher
class RabbitMQPublisher {
  private connection: amqp.Connection;
  private channel: amqp.Channel;

  async connect(): Promise<void> {
    this.connection = await amqp.connect(process.env.RABBITMQ_URL);
    this.channel = await this.connection.createChannel();

    // Declare exchange
    await this.channel.assertExchange('events', 'topic', { durable: true });
  }

  async publish(routingKey: string, event: object): Promise<void> {
    const message = Buffer.from(JSON.stringify(event));

    this.channel.publish('events', routingKey, message, {
      persistent: true,
      contentType: 'application/json',
    });
  }
}

// Consumer
class RabbitMQConsumer {
  async consume(pattern: string, handler: Function): Promise<void> {
    const connection = await amqp.connect(process.env.RABBITMQ_URL);
    const channel = await connection.createChannel();

    // Declare queue
    const queue = await channel.assertQueue('', { exclusive: true });

    // Bind to exchange with pattern
    await channel.bindQueue(queue.queue, 'events', pattern);

    // Consume messages
    channel.consume(queue.queue, async (msg) => {
      if (msg) {
        try {
          const event = JSON.parse(msg.content.toString());
          await handler(event);
          channel.ack(msg);
        } catch (error) {
          channel.nack(msg, false, false); // Dead letter
        }
      }
    });
  }
}

// Usage
const publisher = new RabbitMQPublisher();
await publisher.connect();
await publisher.publish('order.created', { orderId: '123' });

const consumer = new RabbitMQConsumer();
await consumer.consume('order.*', async (event) => {
  console.log('Received:', event);
});
```

---

## Apache Kafka

Distributed streaming platform for high-throughput scenarios.

```
┌─────────────────────────────────────────────────────────────┐
│              KAFKA ARCHITECTURE                              │
│                                                              │
│  Topic: orders                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Partition 0: [msg1][msg2][msg3][msg4][msg5]         │   │
│  │ Partition 1: [msg1][msg2][msg3][msg4]               │   │
│  │ Partition 2: [msg1][msg2][msg3][msg4][msg5][msg6]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Key Concepts:                                              │
│  ─────────────                                              │
│  • Topics: Categories of messages                           │
│  • Partitions: Parallel units within topic                  │
│  • Offset: Position in partition                            │
│  • Consumer Groups: Parallel consumers                      │
│                                                              │
│  Consumer Group A:                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │Consumer 1│  │Consumer 2│  │Consumer 3│                  │
│  │Partition0│  │Partition1│  │Partition2│                  │
│  └──────────┘  └──────────┘  └──────────┘                  │
│                                                              │
│  Each partition consumed by one consumer in group           │
└─────────────────────────────────────────────────────────────┘
```

### Kafka Implementation

```typescript
import { Kafka, Producer, Consumer } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'order-service',
  brokers: ['localhost:9092'],
});

// Producer
class KafkaPublisher {
  private producer: Producer;

  async connect(): Promise<void> {
    this.producer = kafka.producer();
    await this.producer.connect();
  }

  async publish(topic: string, event: object, key?: string): Promise<void> {
    await this.producer.send({
      topic,
      messages: [
        {
          key: key, // Messages with same key go to same partition
          value: JSON.stringify(event),
          headers: {
            'content-type': 'application/json',
          },
        },
      ],
    });
  }
}

// Consumer
class KafkaConsumer {
  private consumer: Consumer;

  async connect(groupId: string): Promise<void> {
    this.consumer = kafka.consumer({ groupId });
    await this.consumer.connect();
  }

  async subscribe(topic: string, handler: Function): Promise<void> {
    await this.consumer.subscribe({ topic, fromBeginning: false });

    await this.consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        const event = JSON.parse(message.value.toString());
        await handler(event, { topic, partition, offset: message.offset });
      },
    });
  }
}

// Usage
const publisher = new KafkaPublisher();
await publisher.connect();
await publisher.publish('orders', { orderId: '123' }, 'user_456');

const consumer = new KafkaConsumer();
await consumer.connect('order-processors');
await consumer.subscribe('orders', async (event, metadata) => {
  console.log('Received:', event, 'from partition:', metadata.partition);
});
```

---

## Redis Streams

Lightweight streaming with Redis.

```
┌─────────────────────────────────────────────────────────────┐
│              REDIS STREAMS                                   │
│                                                              │
│  Stream: orders                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1234-0: {orderId: "1", total: 100}                  │   │
│  │ 1234-1: {orderId: "2", total: 200}                  │   │
│  │ 1235-0: {orderId: "3", total: 150}                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Consumer Groups:                                           │
│  ─────────────────                                          │
│  • Group tracks last read position                          │
│  • Messages distributed among consumers                     │
│  • Pending entries list for unacknowledged                  │
│                                                              │
│  Simpler than Kafka, good for smaller scale                 │
└─────────────────────────────────────────────────────────────┘
```

### Redis Streams Implementation

```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Publisher
class RedisStreamPublisher {
  async publish(stream: string, event: object): Promise<string> {
    const id = await redis.xadd(
      stream,
      '*', // Auto-generate ID
      'data',
      JSON.stringify(event),
    );
    return id;
  }
}

// Consumer
class RedisStreamConsumer {
  async createGroup(stream: string, group: string): Promise<void> {
    try {
      await redis.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
    } catch (error) {
      // Group already exists
    }
  }

  async consume(stream: string, group: string, consumer: string, handler: Function): Promise<void> {
    while (true) {
      const results = await redis.xreadgroup(
        'GROUP',
        group,
        consumer,
        'COUNT',
        10,
        'BLOCK',
        5000,
        'STREAMS',
        stream,
        '>',
      );

      if (results) {
        for (const [streamName, messages] of results) {
          for (const [id, fields] of messages) {
            try {
              const event = JSON.parse(fields[1]);
              await handler(event);
              await redis.xack(stream, group, id);
            } catch (error) {
              console.error('Failed to process:', id);
            }
          }
        }
      }
    }
  }
}

// Usage
const publisher = new RedisStreamPublisher();
await publisher.publish('orders', { orderId: '123' });

const consumer = new RedisStreamConsumer();
await consumer.createGroup('orders', 'processors');
await consumer.consume('orders', 'processors', 'consumer-1', async (event) => {
  console.log('Received:', event);
});
```

---

## Comparison

| Feature        | RabbitMQ             | Kafka                      | Redis Streams    |
| -------------- | -------------------- | -------------------------- | ---------------- |
| **Model**      | Message Queue        | Event Log                  | Stream           |
| **Throughput** | Medium               | Very High                  | High             |
| **Retention**  | Until consumed       | Configurable               | Configurable     |
| **Ordering**   | Per queue            | Per partition              | Per stream       |
| **Replay**     | No                   | Yes                        | Yes              |
| **Complexity** | Medium               | High                       | Low              |
| **Use Case**   | Task queues, routing | Event streaming, analytics | Simple streaming |

---

## When to Use Each

```
┌─────────────────────────────────────────────────────────────┐
│              WHEN TO USE                                     │
│                                                              │
│  RabbitMQ:                                                  │
│  • Complex routing requirements                             │
│  • Task queues with acknowledgment                          │
│  • Request-reply patterns                                   │
│  • Traditional messaging                                    │
│                                                              │
│  Kafka:                                                     │
│  • High throughput (millions/sec)                           │
│  • Event sourcing, replay needed                            │
│  • Stream processing                                        │
│  • Long-term event storage                                  │
│  • Multiple consumer groups                                 │
│                                                              │
│  Redis Streams:                                             │
│  • Already using Redis                                      │
│  • Simpler requirements                                     │
│  • Lower latency needed                                     │
│  • Smaller scale                                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **RabbitMQ** - flexible routing, traditional messaging
2. **Kafka** - high throughput, event log, replay capability
3. **Redis Streams** - simple, fast, good for smaller scale
4. **Choose based on** throughput, replay needs, complexity
5. **All support** consumer groups and acknowledgments

---

## What's Next?

In the next lesson, we will explore the Pub/Sub pattern in detail.

---
