# Lesson 3.1: Synchronous vs Asynchronous Communication

## Introduction

When microservices need to communicate, they have two fundamental options: synchronous (request-response) or asynchronous (event-based). Understanding when to use each is critical for building resilient systems.

---

## The Two Communication Styles

```
┌─────────────────────────────────────────────────────────────┐
│              COMMUNICATION STYLES                            │
│                                                              │
│  SYNCHRONOUS (Request-Response):                            │
│  ───────────────────────────────                            │
│  ┌─────────┐  request   ┌─────────┐                        │
│  │ Service │ ─────────▶ │ Service │                        │
│  │    A    │ ◀───────── │    B    │                        │
│  └─────────┘  response  └─────────┘                        │
│                                                              │
│  Service A waits for Service B to respond.                  │
│                                                              │
│  ASYNCHRONOUS (Event-Based):                                │
│  ───────────────────────────                                │
│  ┌─────────┐  publish   ┌─────────┐  consume  ┌─────────┐  │
│  │ Service │ ─────────▶ │ Message │ ────────▶ │ Service │  │
│  │    A    │            │  Broker │           │    B    │  │
│  └─────────┘            └─────────┘           └─────────┘  │
│                                                              │
│  Service A publishes and continues. Service B processes     │
│  when ready.                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## Synchronous Communication

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│              SYNCHRONOUS FLOW                                │
│                                                              │
│  Timeline:                                                  │
│  ─────────                                                  │
│                                                              │
│  Service A          Network          Service B              │
│      │                                    │                 │
│      │──── HTTP Request ────────────────▶│                 │
│      │                                    │                 │
│      │         (A is waiting)            │ Processing...   │
│      │         (A is blocked)            │                 │
│      │                                    │                 │
│      │◀─── HTTP Response ────────────────│                 │
│      │                                    │                 │
│      │ Continue processing                │                 │
│      ▼                                    │                 │
│                                                              │
│  Total time = Network latency + Processing time             │
└─────────────────────────────────────────────────────────────┘
```

### Characteristics

```
┌─────────────────────────────────────────────────────────────┐
│           SYNCHRONOUS CHARACTERISTICS                        │
│                                                              │
│  ✓ Simple to understand and implement                       │
│  ✓ Immediate response                                       │
│  ✓ Easy error handling                                      │
│  ✓ Natural request-response pattern                         │
│                                                              │
│  ✗ Caller is blocked waiting                                │
│  ✗ Tight coupling (temporal)                                │
│  ✗ Cascading failures possible                              │
│  ✗ Harder to scale                                          │
│                                                              │
│  Common Protocols:                                          │
│  • HTTP/REST                                                │
│  • gRPC                                                     │
│  • GraphQL                                                  │
└─────────────────────────────────────────────────────────────┘
```

### When to Use Synchronous

```
┌─────────────────────────────────────────────────────────────┐
│           WHEN TO USE SYNCHRONOUS                            │
│                                                              │
│  Use When:                                                  │
│  ──────────                                                 │
│  • You need an immediate response                           │
│  • The operation must complete before proceeding            │
│  • Simple query/response patterns                           │
│  • User is waiting for result                               │
│                                                              │
│  Examples:                                                  │
│  ─────────                                                  │
│  • Get user profile                                         │
│  • Validate credit card                                     │
│  • Check inventory availability                             │
│  • Authenticate user                                        │
│  • Get product details                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Asynchronous Communication

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│              ASYNCHRONOUS FLOW                               │
│                                                              │
│  Timeline:                                                  │
│  ─────────                                                  │
│                                                              │
│  Service A       Message Broker       Service B             │
│      │                 │                  │                 │
│      │── Publish ─────▶│                  │                 │
│      │                 │                  │                 │
│      │ Continue        │                  │                 │
│      │ immediately     │                  │                 │
│      ▼                 │                  │                 │
│                        │                  │                 │
│      (A is done)       │── Deliver ──────▶│                 │
│                        │                  │                 │
│                        │                  │ Processing...   │
│                        │                  ▼                 │
│                                                              │
│  Service A doesn't wait. Service B processes independently. │
└─────────────────────────────────────────────────────────────┘
```

### Characteristics

```
┌─────────────────────────────────────────────────────────────┐
│           ASYNCHRONOUS CHARACTERISTICS                       │
│                                                              │
│  ✓ Loose coupling (temporal)                                │
│  ✓ Better fault tolerance                                   │
│  ✓ Easier to scale                                          │
│  ✓ Natural for fire-and-forget                              │
│  ✓ Handles traffic spikes (buffering)                       │
│                                                              │
│  ✗ More complex to implement                                │
│  ✗ Eventual consistency                                     │
│  ✗ Harder to debug                                          │
│  ✗ No immediate response                                    │
│  ✗ Message broker is additional infrastructure              │
│                                                              │
│  Common Technologies:                                       │
│  • RabbitMQ                                                 │
│  • Apache Kafka                                             │
│  • Redis Pub/Sub                                            │
│  • AWS SQS/SNS                                              │
└─────────────────────────────────────────────────────────────┘
```

### When to Use Asynchronous

```
┌─────────────────────────────────────────────────────────────┐
│           WHEN TO USE ASYNCHRONOUS                           │
│                                                              │
│  Use When:                                                  │
│  ──────────                                                 │
│  • Response not needed immediately                          │
│  • Long-running operations                                  │
│  • Notifying multiple services                              │
│  • Handling traffic spikes                                  │
│  • Decoupling services                                      │
│                                                              │
│  Examples:                                                  │
│  ─────────                                                  │
│  • Send email notification                                  │
│  • Process order (after payment)                            │
│  • Generate report                                          │
│  • Update search index                                      │
│  • Sync data between services                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Comparison

### Side-by-Side

```
┌─────────────────────────────────────────────────────────────┐
│              SYNC VS ASYNC COMPARISON                        │
│                                                              │
│  Aspect              Synchronous       Asynchronous         │
│  ──────              ───────────       ────────────         │
│  Coupling            Tight             Loose                │
│  Response            Immediate         Eventually           │
│  Complexity          Simple            Complex              │
│  Failure handling    Direct            Retry/DLQ            │
│  Scalability         Limited           High                 │
│  Debugging           Easy              Hard                 │
│  Consistency         Strong            Eventual             │
│  Latency             Higher            Lower (for caller)   │
│  Infrastructure      Minimal           Message broker       │
└─────────────────────────────────────────────────────────────┘
```

### Failure Scenarios

```
┌─────────────────────────────────────────────────────────────┐
│              FAILURE HANDLING                                │
│                                                              │
│  SYNCHRONOUS - Service B is down:                           │
│  ─────────────────────────────────                          │
│  ┌─────────┐  request   ┌─────────┐                        │
│  │ Service │ ─────────▶ │ Service │                        │
│  │    A    │     X      │    B    │ (DOWN)                 │
│  └─────────┘            └─────────┘                        │
│       │                                                     │
│       ▼                                                     │
│  Service A fails or times out.                              │
│  User sees error.                                           │
│                                                              │
│  ASYNCHRONOUS - Service B is down:                          │
│  ───────────────────────────────────                        │
│  ┌─────────┐  publish   ┌─────────┐         ┌─────────┐   │
│  │ Service │ ─────────▶ │ Message │ ──X───▶ │ Service │   │
│  │    A    │            │  Broker │         │    B    │   │
│  └─────────┘            └─────────┘         └─────────┘   │
│       │                      │               (DOWN)        │
│       ▼                      │                             │
│  Service A succeeds.         │ Message waits in queue.     │
│  User sees success.          │ Processed when B recovers.  │
└─────────────────────────────────────────────────────────────┘
```

---

## Hybrid Approach

### Real-World Pattern

Most systems use both synchronous and asynchronous communication:

```
┌─────────────────────────────────────────────────────────────┐
│              HYBRID COMMUNICATION                            │
│                                                              │
│  User places order:                                         │
│  ──────────────────                                         │
│                                                              │
│  ┌──────┐    ┌─────────┐    ┌─────────┐                    │
│  │ User │───▶│  Order  │───▶│ Payment │  SYNC: Validate    │
│  └──────┘    │ Service │◀───│ Service │  payment before    │
│              └────┬────┘    └─────────┘  confirming order  │
│                   │                                         │
│                   │ ASYNC: Notify other services           │
│                   ▼                                         │
│              ┌─────────┐                                   │
│              │ Message │                                   │
│              │  Broker │                                   │
│              └────┬────┘                                   │
│         ┌─────────┼─────────┐                              │
│         ▼         ▼         ▼                              │
│    ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│    │Inventory│ │Shipping │ │  Email  │                    │
│    │ Service │ │ Service │ │ Service │                    │
│    └─────────┘ └─────────┘ └─────────┘                    │
│                                                              │
│  Sync for: Payment validation (must succeed)               │
│  Async for: Downstream processing (can happen later)       │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Example: Synchronous

### Express + TypeScript REST Call

```typescript
// order-service/src/services/order.service.ts
import axios from 'axios';

interface PaymentResult {
  success: boolean;
  transactionId: string;
}

interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
}

class OrderService {
  private paymentServiceUrl = process.env.PAYMENT_SERVICE_URL;

  async createOrder(orderData: CreateOrderDTO): Promise<Order> {
    // Create order in pending state
    const order = await this.orderRepository.create({
      ...orderData,
      status: 'PENDING',
    });

    try {
      // SYNCHRONOUS: Call payment service and wait
      const paymentResult = await this.processPayment(order);

      if (paymentResult.success) {
        // Update order status
        order.status = 'CONFIRMED';
        order.transactionId = paymentResult.transactionId;
        await this.orderRepository.update(order);

        return order;
      } else {
        order.status = 'PAYMENT_FAILED';
        await this.orderRepository.update(order);
        throw new Error('Payment failed');
      }
    } catch (error) {
      order.status = 'FAILED';
      await this.orderRepository.update(order);
      throw error;
    }
  }

  private async processPayment(order: Order): Promise<PaymentResult> {
    // Synchronous HTTP call - we wait for response
    const response = await axios.post(
      `${this.paymentServiceUrl}/payments`,
      {
        orderId: order.id,
        amount: order.total,
        userId: order.userId,
      },
      {
        timeout: 5000, // 5 second timeout
      },
    );

    return response.data;
  }
}
```

---

## Code Example: Asynchronous

### Express + TypeScript with RabbitMQ

```typescript
// order-service/src/services/order.service.ts
import amqp from 'amqplib';

class OrderService {
  private channel: amqp.Channel;

  async createOrder(orderData: CreateOrderDTO): Promise<Order> {
    // Create order
    const order = await this.orderRepository.create({
      ...orderData,
      status: 'CONFIRMED',
    });

    // ASYNCHRONOUS: Publish event and continue
    await this.publishOrderCreated(order);

    // Return immediately - don't wait for downstream processing
    return order;
  }

  private async publishOrderCreated(order: Order): Promise<void> {
    const event = {
      eventType: 'ORDER_CREATED',
      timestamp: new Date().toISOString(),
      data: {
        orderId: order.id,
        userId: order.userId,
        items: order.items,
        total: order.total,
      },
    };

    // Publish to exchange - returns immediately
    this.channel.publish(
      'orders', // exchange
      'order.created', // routing key
      Buffer.from(JSON.stringify(event)),
      { persistent: true },
    );

    console.log(`Published ORDER_CREATED event for order ${order.id}`);
  }
}

// inventory-service/src/handlers/order.handler.ts
class OrderEventHandler {
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    // Process asynchronously - no one is waiting
    for (const item of event.data.items) {
      await this.inventoryService.reserveStock(item.productId, item.quantity);
    }

    console.log(`Reserved inventory for order ${event.data.orderId}`);
  }
}

// notification-service/src/handlers/order.handler.ts
class NotificationHandler {
  async handleOrderCreated(event: OrderCreatedEvent): Promise<void> {
    // Send email asynchronously
    await this.emailService.send({
      to: event.data.userEmail,
      subject: 'Order Confirmation',
      template: 'order-confirmation',
      data: event.data,
    });

    console.log(`Sent confirmation email for order ${event.data.orderId}`);
  }
}
```

---

## Async Patterns

### 1. Fire and Forget

```
┌─────────────────────────────────────────────────────────────┐
│              FIRE AND FORGET                                 │
│                                                              │
│  ┌─────────┐  publish   ┌─────────┐                        │
│  │ Service │ ─────────▶ │  Queue  │ ────▶ Consumer         │
│  │    A    │            └─────────┘                        │
│  └─────────┘                                                │
│       │                                                     │
│       ▼                                                     │
│  Continue immediately                                       │
│                                                              │
│  Use for: Logging, analytics, notifications                │
└─────────────────────────────────────────────────────────────┘
```

### 2. Request-Reply (Async)

```
┌─────────────────────────────────────────────────────────────┐
│              ASYNC REQUEST-REPLY                             │
│                                                              │
│  ┌─────────┐  request   ┌─────────┐  request  ┌─────────┐  │
│  │ Service │ ─────────▶ │  Queue  │ ────────▶ │ Service │  │
│  │    A    │            └─────────┘           │    B    │  │
│  └─────────┘                                  └────┬────┘  │
│       ▲                                            │       │
│       │              ┌─────────┐                   │       │
│       └───────────── │  Reply  │ ◀─────────────────┘       │
│         reply        │  Queue  │    reply                  │
│                      └─────────┘                           │
│                                                              │
│  Use for: Long operations where you need result later      │
└─────────────────────────────────────────────────────────────┘
```

### 3. Publish-Subscribe

```
┌─────────────────────────────────────────────────────────────┐
│              PUBLISH-SUBSCRIBE                               │
│                                                              │
│                      ┌─────────┐                            │
│                      │Consumer1│                            │
│                   ┌─▶│(Inventory)                           │
│  ┌─────────┐     │  └─────────┘                            │
│  │Publisher│─────┼──▶┌─────────┐                            │
│  │ (Order) │     │   │Consumer2│                            │
│  └─────────┘     │   │(Shipping)                            │
│                  │   └─────────┘                            │
│                  └──▶┌─────────┐                            │
│                      │Consumer3│                            │
│                      │ (Email) │                            │
│                      └─────────┘                            │
│                                                              │
│  One event, multiple consumers.                             │
│  Use for: Broadcasting events to interested services.       │
└─────────────────────────────────────────────────────────────┘
```

---

## Decision Framework

```
┌─────────────────────────────────────────────────────────────┐
│              DECISION FRAMEWORK                              │
│                                                              │
│  Question                              Answer → Pattern     │
│  ────────                              ─────────────────    │
│                                                              │
│  Do you need immediate response?       Yes → Synchronous    │
│                                        No  → Asynchronous   │
│                                                              │
│  Is the operation long-running?        Yes → Asynchronous   │
│                                        No  → Either         │
│                                                              │
│  Must the caller know if it failed?    Yes → Synchronous    │
│                                        No  → Asynchronous   │
│                                                              │
│  Are multiple services interested?     Yes → Pub/Sub        │
│                                        No  → Point-to-point │
│                                                              │
│  Can you accept eventual consistency?  Yes → Asynchronous   │
│                                        No  → Synchronous    │
│                                                              │
│  Need to handle traffic spikes?        Yes → Asynchronous   │
│                                        No  → Either         │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Synchronous** = Request-Response, caller waits
2. **Asynchronous** = Fire-and-forget or event-based, caller continues
3. **Use sync** when you need immediate response or strong consistency
4. **Use async** for decoupling, scalability, and resilience
5. **Most systems use both** - choose based on the use case
6. **Async adds complexity** - message brokers, eventual consistency
7. **Sync has failure risks** - cascading failures, timeouts

---

## What's Next?

In the next lesson, we will dive deep into REST API communication patterns for microservices.

---
