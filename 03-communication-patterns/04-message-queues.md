# Lesson 3.4: Message Queues (RabbitMQ)

## Introduction

Message queues enable asynchronous communication between services. RabbitMQ is one of the most popular message brokers, implementing the AMQP (Advanced Message Queuing Protocol). This lesson covers message queue concepts and practical implementation with RabbitMQ.

---

## Why Message Queues?

```
┌─────────────────────────────────────────────────────────────┐
│                  WHY MESSAGE QUEUES?                         │
│                                                              │
│  Problem: Direct Service Communication                      │
│  ─────────────────────────────────────                      │
│  ┌─────────┐         ┌─────────┐                           │
│  │ Order   │────────▶│ Email   │                           │
│  │ Service │         │ Service │ (DOWN)                    │
│  └─────────┘         └─────────┘                           │
│       │                                                     │
│       ▼                                                     │
│  Order fails because Email service is down!                │
│                                                              │
│  Solution: Message Queue                                    │
│  ───────────────────────                                    │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                │
│  │ Order   │───▶│  Queue  │───▶│ Email   │                │
│  │ Service │    │         │    │ Service │ (DOWN)         │
│  └─────────┘    └─────────┘    └─────────┘                │
│       │              │                                      │
│       ▼              │                                      │
│  Order succeeds!     └── Message waits until Email is up   │
└─────────────────────────────────────────────────────────────┘
```

### Benefits

```
┌─────────────────────────────────────────────────────────────┐
│                  MESSAGE QUEUE BENEFITS                      │
│                                                              │
│  1. Decoupling                                              │
│     Services don't need to know about each other.          │
│                                                              │
│  2. Resilience                                              │
│     Messages persist if consumer is down.                   │
│                                                              │
│  3. Scalability                                             │
│     Add more consumers to handle load.                      │
│                                                              │
│  4. Load Leveling                                           │
│     Buffer traffic spikes.                                  │
│                                                              │
│  5. Async Processing                                        │
│     Producer doesn't wait for consumer.                     │
└─────────────────────────────────────────────────────────────┘
```

---

## RabbitMQ Concepts

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│                  RABBITMQ ARCHITECTURE                       │
│                                                              │
│  ┌──────────┐                           ┌──────────┐       │
│  │ Producer │                           │ Consumer │       │
│  └────┬─────┘                           └────▲─────┘       │
│       │                                      │              │
│       │ publish                              │ consume      │
│       ▼                                      │              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    RabbitMQ                          │   │
│  │                                                      │   │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐      │   │
│  │  │ Exchange │───▶│ Binding  │───▶│  Queue   │      │   │
│  │  └──────────┘    └──────────┘    └──────────┘      │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Producer → Exchange → Binding → Queue → Consumer          │
└─────────────────────────────────────────────────────────────┘
```

### Exchange Types

```
┌─────────────────────────────────────────────────────────────┐
│                  EXCHANGE TYPES                              │
│                                                              │
│  1. Direct Exchange                                         │
│  ──────────────────                                         │
│  Routes by exact routing key match.                         │
│                                                              │
│  Producer ──[key: order.created]──▶ Exchange                │
│                                        │                    │
│                    ┌───────────────────┼───────────────┐   │
│                    ▼                   ▼               ▼   │
│              [order.created]    [order.paid]    [order.*] │
│                    │                                       │
│                    ▼                                       │
│                 Queue A                                    │
│                                                              │
│  2. Fanout Exchange                                         │
│  ──────────────────                                         │
│  Broadcasts to ALL bound queues (ignores routing key).     │
│                                                              │
│  Producer ──▶ Exchange ──▶ Queue A                         │
│                       ──▶ Queue B                          │
│                       ──▶ Queue C                          │
│                                                              │
│  3. Topic Exchange                                          │
│  ─────────────────                                          │
│  Routes by pattern matching (* = one word, # = zero+).     │
│                                                              │
│  Producer ──[order.created.us]──▶ Exchange                 │
│                                      │                      │
│              ┌───────────────────────┼───────────────┐     │
│              ▼                       ▼               ▼     │
│        [order.*.us]           [order.#]      [*.created.*]│
│              │                       │               │     │
│              ▼                       ▼               ▼     │
│           Queue A                Queue B          Queue C  │
│                                                              │
│  4. Headers Exchange                                        │
│  ───────────────────                                        │
│  Routes by message headers (rarely used).                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup RabbitMQ

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  rabbitmq:
    image: rabbitmq:3-management
    container_name: rabbitmq
    ports:
      - '5672:5672' # AMQP
      - '15672:15672' # Management UI
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: password
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq

volumes:
  rabbitmq_data:
```

### Install Dependencies

```bash
npm install amqplib
npm install -D @types/amqplib
```

---

## RabbitMQ Connection

```typescript
// src/messaging/rabbitmq.ts
import amqp, { Connection, Channel } from 'amqplib';

class RabbitMQConnection {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private readonly url: string;

  constructor() {
    this.url = process.env.RABBITMQ_URL || 'amqp://admin:password@localhost:5672';
  }

  async connect(): Promise<void> {
    try {
      this.connection = await amqp.connect(this.url);
      this.channel = await this.connection.createChannel();

      // Handle connection errors
      this.connection.on('error', (err) => {
        console.error('RabbitMQ connection error:', err);
        this.reconnect();
      });

      this.connection.on('close', () => {
        console.log('RabbitMQ connection closed');
        this.reconnect();
      });

      console.log('Connected to RabbitMQ');
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  private async reconnect(): Promise<void> {
    console.log('Attempting to reconnect to RabbitMQ...');
    setTimeout(() => this.connect(), 5000);
  }

  getChannel(): Channel {
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }
    return this.channel;
  }

  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}

export const rabbitmq = new RabbitMQConnection();
```

---

## Publisher Implementation

```typescript
// src/messaging/publisher.ts
import { Channel } from 'amqplib';
import { rabbitmq } from './rabbitmq';

interface PublishOptions {
  persistent?: boolean;
  correlationId?: string;
  replyTo?: string;
}

export class MessagePublisher {
  private channel: Channel;
  private exchange: string;

  constructor(exchange: string) {
    this.exchange = exchange;
    this.channel = rabbitmq.getChannel();
  }

  async setup(): Promise<void> {
    // Declare exchange (topic type for flexible routing)
    await this.channel.assertExchange(this.exchange, 'topic', {
      durable: true,
    });
  }

  async publish(routingKey: string, message: object, options: PublishOptions = {}): Promise<void> {
    const content = Buffer.from(JSON.stringify(message));

    this.channel.publish(this.exchange, routingKey, content, {
      persistent: options.persistent ?? true,
      contentType: 'application/json',
      correlationId: options.correlationId,
      replyTo: options.replyTo,
      timestamp: Date.now(),
    });

    console.log(`Published to ${this.exchange}/${routingKey}:`, message);
  }
}

// Usage example
export class OrderEventPublisher {
  private publisher: MessagePublisher;

  constructor() {
    this.publisher = new MessagePublisher('orders');
  }

  async init(): Promise<void> {
    await this.publisher.setup();
  }

  async publishOrderCreated(order: Order): Promise<void> {
    await this.publisher.publish('order.created', {
      eventType: 'ORDER_CREATED',
      timestamp: new Date().toISOString(),
      data: {
        orderId: order.id,
        userId: order.userId,
        items: order.items,
        total: order.total,
      },
    });
  }

  async publishOrderPaid(orderId: string, paymentId: string): Promise<void> {
    await this.publisher.publish('order.paid', {
      eventType: 'ORDER_PAID',
      timestamp: new Date().toISOString(),
      data: { orderId, paymentId },
    });
  }

  async publishOrderShipped(orderId: string, trackingNumber: string): Promise<void> {
    await this.publisher.publish('order.shipped', {
      eventType: 'ORDER_SHIPPED',
      timestamp: new Date().toISOString(),
      data: { orderId, trackingNumber },
    });
  }
}
```

---

## Consumer Implementation

```typescript
// src/messaging/consumer.ts
import { Channel, ConsumeMessage } from 'amqplib';
import { rabbitmq } from './rabbitmq';

type MessageHandler = (message: any, raw: ConsumeMessage) => Promise<void>;

export class MessageConsumer {
  private channel: Channel;
  private exchange: string;
  private queue: string;

  constructor(exchange: string, queue: string) {
    this.exchange = exchange;
    this.queue = queue;
    this.channel = rabbitmq.getChannel();
  }

  async setup(routingPatterns: string[]): Promise<void> {
    // Declare exchange
    await this.channel.assertExchange(this.exchange, 'topic', {
      durable: true,
    });

    // Declare queue
    await this.channel.assertQueue(this.queue, {
      durable: true,
      deadLetterExchange: `${this.exchange}.dlx`,
    });

    // Bind queue to exchange with routing patterns
    for (const pattern of routingPatterns) {
      await this.channel.bindQueue(this.queue, this.exchange, pattern);
      console.log(`Bound ${this.queue} to ${this.exchange} with pattern ${pattern}`);
    }

    // Set prefetch (process one message at a time)
    await this.channel.prefetch(1);
  }

  async consume(handler: MessageHandler): Promise<void> {
    await this.channel.consume(
      this.queue,
      async (msg) => {
        if (!msg) return;

        try {
          const content = JSON.parse(msg.content.toString());
          console.log(`Received message on ${this.queue}:`, content.eventType);

          await handler(content, msg);

          // Acknowledge message
          this.channel.ack(msg);
        } catch (error) {
          console.error('Error processing message:', error);

          // Reject and requeue (or send to DLQ after retries)
          const redelivered = msg.fields.redelivered;
          if (redelivered) {
            // Already retried, send to DLQ
            this.channel.nack(msg, false, false);
          } else {
            // First failure, requeue
            this.channel.nack(msg, false, true);
          }
        }
      },
      { noAck: false },
    );

    console.log(`Consumer started for queue: ${this.queue}`);
  }
}
```

---

## Service Implementation

### Order Service (Publisher)

```typescript
// order-service/src/services/order.service.ts
import { OrderEventPublisher } from '../messaging/publisher';

export class OrderService {
  private eventPublisher: OrderEventPublisher;

  constructor() {
    this.eventPublisher = new OrderEventPublisher();
  }

  async init(): Promise<void> {
    await this.eventPublisher.init();
  }

  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    // Create order in database
    const order = await this.orderRepository.create({
      userId,
      items,
      total: this.calculateTotal(items),
      status: 'PENDING',
    });

    // Publish event (async - don't wait for consumers)
    await this.eventPublisher.publishOrderCreated(order);

    return order;
  }

  async markOrderPaid(orderId: string, paymentId: string): Promise<void> {
    await this.orderRepository.update(orderId, { status: 'PAID' });
    await this.eventPublisher.publishOrderPaid(orderId, paymentId);
  }

  private calculateTotal(items: OrderItem[]): number {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}
```

### Inventory Service (Consumer)

```typescript
// inventory-service/src/handlers/order.handler.ts
import { MessageConsumer } from '../messaging/consumer';
import { InventoryService } from '../services/inventory.service';

export class OrderEventHandler {
  private consumer: MessageConsumer;
  private inventoryService: InventoryService;

  constructor() {
    this.consumer = new MessageConsumer('orders', 'inventory.order-events');
    this.inventoryService = new InventoryService();
  }

  async start(): Promise<void> {
    // Subscribe to order events
    await this.consumer.setup(['order.created', 'order.cancelled']);

    await this.consumer.consume(async (message) => {
      switch (message.eventType) {
        case 'ORDER_CREATED':
          await this.handleOrderCreated(message.data);
          break;
        case 'ORDER_CANCELLED':
          await this.handleOrderCancelled(message.data);
          break;
        default:
          console.log('Unknown event type:', message.eventType);
      }
    });
  }

  private async handleOrderCreated(data: any): Promise<void> {
    console.log(`Reserving inventory for order ${data.orderId}`);

    for (const item of data.items) {
      await this.inventoryService.reserveStock(item.productId, item.quantity, data.orderId);
    }
  }

  private async handleOrderCancelled(data: any): Promise<void> {
    console.log(`Releasing inventory for order ${data.orderId}`);
    await this.inventoryService.releaseReservation(data.orderId);
  }
}

// inventory-service/src/index.ts
import { rabbitmq } from './messaging/rabbitmq';
import { OrderEventHandler } from './handlers/order.handler';

async function main() {
  await rabbitmq.connect();

  const orderHandler = new OrderEventHandler();
  await orderHandler.start();

  console.log('Inventory service started');
}

main().catch(console.error);
```

### Notification Service (Consumer)

```typescript
// notification-service/src/handlers/order.handler.ts
import { MessageConsumer } from '../messaging/consumer';
import { EmailService } from '../services/email.service';

export class OrderNotificationHandler {
  private consumer: MessageConsumer;
  private emailService: EmailService;

  constructor() {
    // Different queue, same exchange
    this.consumer = new MessageConsumer('orders', 'notifications.order-events');
    this.emailService = new EmailService();
  }

  async start(): Promise<void> {
    // Subscribe to all order events
    await this.consumer.setup(['order.#']);

    await this.consumer.consume(async (message) => {
      switch (message.eventType) {
        case 'ORDER_CREATED':
          await this.sendOrderConfirmation(message.data);
          break;
        case 'ORDER_SHIPPED':
          await this.sendShippingNotification(message.data);
          break;
      }
    });
  }

  private async sendOrderConfirmation(data: any): Promise<void> {
    await this.emailService.send({
      to: data.userEmail,
      subject: `Order Confirmation #${data.orderId}`,
      template: 'order-confirmation',
      data,
    });
  }

  private async sendShippingNotification(data: any): Promise<void> {
    await this.emailService.send({
      to: data.userEmail,
      subject: `Your order has shipped!`,
      template: 'order-shipped',
      data,
    });
  }
}
```

---

## Dead Letter Queue (DLQ)

```typescript
// src/messaging/dlq.ts
import { Channel } from 'amqplib';
import { rabbitmq } from './rabbitmq';

export async function setupDeadLetterQueue(mainExchange: string, mainQueue: string): Promise<void> {
  const channel = rabbitmq.getChannel();

  // Dead letter exchange
  const dlxExchange = `${mainExchange}.dlx`;
  const dlqQueue = `${mainQueue}.dlq`;

  // Declare DLX
  await channel.assertExchange(dlxExchange, 'topic', { durable: true });

  // Declare DLQ
  await channel.assertQueue(dlqQueue, { durable: true });

  // Bind DLQ to DLX
  await channel.bindQueue(dlqQueue, dlxExchange, '#');

  console.log(`DLQ setup complete: ${dlqQueue}`);
}

// Process dead letters (manual retry or investigation)
export async function processDLQ(dlqQueue: string, handler: (message: any) => Promise<void>): Promise<void> {
  const channel = rabbitmq.getChannel();

  await channel.consume(dlqQueue, async (msg) => {
    if (!msg) return;

    const content = JSON.parse(msg.content.toString());
    console.log('Processing dead letter:', content);

    try {
      await handler(content);
      channel.ack(msg);
    } catch (error) {
      console.error('Failed to process dead letter:', error);
      // Keep in DLQ for manual investigation
      channel.nack(msg, false, false);
    }
  });
}
```

---

## Message Patterns

### Request-Reply Pattern

```typescript
// src/messaging/rpc-client.ts
import { v4 as uuidv4 } from 'uuid';
import { Channel } from 'amqplib';
import { rabbitmq } from './rabbitmq';

export class RpcClient {
  private channel: Channel;
  private replyQueue: string = '';
  private pendingRequests: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (error: Error) => void;
    }
  > = new Map();

  async setup(): Promise<void> {
    this.channel = rabbitmq.getChannel();

    // Create exclusive reply queue
    const { queue } = await this.channel.assertQueue('', {
      exclusive: true,
      autoDelete: true,
    });
    this.replyQueue = queue;

    // Listen for replies
    await this.channel.consume(
      this.replyQueue,
      (msg) => {
        if (!msg) return;

        const correlationId = msg.properties.correlationId;
        const pending = this.pendingRequests.get(correlationId);

        if (pending) {
          const response = JSON.parse(msg.content.toString());
          pending.resolve(response);
          this.pendingRequests.delete(correlationId);
        }

        this.channel.ack(msg);
      },
      { noAck: false },
    );
  }

  async call(queue: string, message: any, timeout = 5000): Promise<any> {
    const correlationId = uuidv4();

    return new Promise((resolve, reject) => {
      // Set timeout
      const timer = setTimeout(() => {
        this.pendingRequests.delete(correlationId);
        reject(new Error('RPC timeout'));
      }, timeout);

      // Store pending request
      this.pendingRequests.set(correlationId, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject,
      });

      // Send request
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        correlationId,
        replyTo: this.replyQueue,
      });
    });
  }
}

// Usage
const rpcClient = new RpcClient();
await rpcClient.setup();

const result = await rpcClient.call('inventory.check-stock', {
  productId: 'prod-123',
  quantity: 5,
});
```

---

## Best Practices

```
┌─────────────────────────────────────────────────────────────┐
│                  MESSAGE QUEUE BEST PRACTICES                │
│                                                              │
│  1. Message Design                                          │
│  ─────────────────                                          │
│  • Include event type and timestamp                         │
│  • Use correlation IDs for tracing                          │
│  • Keep messages small (reference large data)               │
│  • Version your message schemas                             │
│                                                              │
│  2. Reliability                                             │
│  ─────────────                                              │
│  • Use persistent messages                                  │
│  • Acknowledge after processing                             │
│  • Implement dead letter queues                             │
│  • Handle duplicates (idempotency)                          │
│                                                              │
│  3. Performance                                             │
│  ─────────────                                              │
│  • Use prefetch to control concurrency                      │
│  • Batch publishes when possible                            │
│  • Monitor queue depth                                      │
│  • Scale consumers horizontally                             │
│                                                              │
│  4. Operations                                              │
│  ───────────                                                │
│  • Monitor queue length and consumer lag                    │
│  • Set up alerts for DLQ messages                           │
│  • Use management UI for debugging                          │
│  • Implement health checks                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Message queues decouple services** - Producer and consumer don't need to be available simultaneously
2. **RabbitMQ uses exchanges for routing** - Direct, fanout, topic, headers
3. **Acknowledge after processing** - Ensures messages aren't lost
4. **Use dead letter queues** - Handle failed messages gracefully
5. **Design for idempotency** - Messages may be delivered more than once
6. **Monitor queue depth** - Detect consumer lag early
7. **Scale consumers horizontally** - Add more consumers for throughput

---

## What's Next?

In the next lesson, we will explore event-based communication patterns and event-driven architecture.

---
