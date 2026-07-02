# Pattern 13: Event-Driven Architecture (EDA)

## What is it?

Services communicate by producing and consuming events instead of direct calls. Events represent something that happened in the system.

---

## 📚 Theoretical Foundation

### The Philosophy Behind EDA

Event-Driven Architecture represents a fundamental shift in how we think about system communication. Instead of asking "what should I do?" (imperative), we declare "what happened" (declarative).

**Traditional Request-Response:**

> "Hey Order Service, create an order for user 123"

**Event-Driven:**

> "An order was created for user 123" — whoever cares can react

This subtle shift enables **temporal decoupling** (sender and receiver don't need to be available simultaneously) and **behavioral decoupling** (sender doesn't dictate what happens next).

---

### Request-Response vs Event-Driven

| Aspect               | Request-Response            | Event-Driven                            |
| -------------------- | --------------------------- | --------------------------------------- |
| **Coupling**         | Tight - caller knows callee | Loose - producer doesn't know consumers |
| **Communication**    | Synchronous                 | Asynchronous                            |
| **Failure handling** | Immediate error             | Retry, dead-letter queues               |
| **Scalability**      | Limited by slowest service  | Independent scaling                     |
| **Latency**          | Predictable                 | Variable                                |
| **Debugging**        | Easy to trace               | Requires correlation IDs                |
| **Data consistency** | Strong (usually)            | Eventual                                |

---

### When to Use EDA

**✅ EDA is ideal for:**

- **Decoupled workflows** - Order → Payment → Inventory → Shipping
- **Multiple consumers** - One event triggers many actions
- **Audit requirements** - Need history of all changes
- **Peak load handling** - Buffer requests during spikes
- **Real-time features** - Notifications, dashboards, analytics
- **Cross-team boundaries** - Teams can evolve independently

**❌ Avoid EDA when:**

- Simple CRUD operations
- Immediate consistency required
- Low latency is critical (< 10ms)
- Small team, simple system
- Debugging simplicity is priority

---

### The CAP Theorem Connection

EDA embraces the **AP** side of CAP theorem:

```
       C (Consistency)
        /\
       /  \
      /    \
     /  CA  \
    /________\
   A -------- P
(Availability) (Partition Tolerance)

EDA chooses: Availability + Partition Tolerance
Trade-off: Eventual Consistency
```

In distributed systems, you can only guarantee 2 of 3:

- **Consistency** - All nodes see same data
- **Availability** - System always responds
- **Partition Tolerance** - Works despite network failures

EDA accepts eventual consistency to gain availability and fault tolerance.

---

### Event Anatomy

A well-designed event contains:

```
┌─────────────────────────────────────────────┐
│                   EVENT                      │
├─────────────────────────────────────────────┤
│  id: "evt_abc123"          (Unique ID)      │
│  type: "OrderCreated"      (What happened)  │
│  source: "order-service"   (Who produced)   │
│  time: "2026-02-26T14:00Z" (When)           │
│  correlationId: "req_xyz"  (Trace context)  │
│  data: {                   (Payload)        │
│    orderId: "ord_123",                      │
│    userId: "user_456",                      │
│    items: [...],                            │
│    total: 99.99                             │
│  }                                          │
│  metadata: {               (Optional)       │
│    version: "1.0",                          │
│    contentType: "application/json"          │
│  }                                          │
└─────────────────────────────────────────────┘
```

---

### Event Design Principles

#### 1. Events are Immutable Facts

Once published, an event **never changes**. If something was wrong, publish a correcting event.

```
❌ Wrong: Update OrderCreated event
✅ Right: Publish OrderCorrected event
```

#### 2. Events Should Be Self-Contained

Include enough data so consumers don't need to call back:

```
❌ Thin event: { orderId: "123" }
   → Consumer must call Order Service

✅ Fat event: { orderId: "123", userId: "456", items: [...], total: 99.99 }
   → Consumer has everything needed
```

#### 3. Use Past Tense Naming

Events describe what **happened**, not what should happen:

```
❌ CreateOrder, ProcessPayment
✅ OrderCreated, PaymentProcessed
```

#### 4. Version Your Events

Schemas evolve. Use versioning to maintain compatibility:

```
OrderCreated.v1 → OrderCreated.v2 (added shippingAddress)
```

---

### Idempotency: The Critical Concept

In EDA, messages can be delivered **more than once**. Consumers must handle duplicates gracefully.

**Idempotent operation:** Running it multiple times produces the same result as running once.

```
✅ Idempotent:
   - Set user email to "x@y.com" (same result if repeated)
   - Upsert record with ID

❌ Not Idempotent:
   - Increment counter (1 → 2 → 3...)
   - Send email notification (user gets multiple emails)
```

**Strategies for Idempotency:**

| Strategy                | How it works                                 |
| ----------------------- | -------------------------------------------- |
| **Event ID tracking**   | Store processed event IDs, skip duplicates   |
| **Natural idempotency** | Design operations to be naturally idempotent |
| **Idempotency keys**    | Client provides unique key per operation     |
| **Optimistic locking**  | Use version numbers to detect conflicts      |

---

### Message Ordering

**Problem:** Events may arrive out of order.

```
Sent:     OrderCreated → OrderUpdated → OrderCancelled
Received: OrderCreated → OrderCancelled → OrderUpdated  ← Wrong!
```

**Solutions:**

| Approach             | Description                                         |
| -------------------- | --------------------------------------------------- |
| **Partition keys**   | Same entity's events go to same partition (ordered) |
| **Sequence numbers** | Include sequence, reject out-of-order               |
| **Event timestamps** | Use logical clocks, process by timestamp            |
| **Single consumer**  | One consumer per partition ensures order            |

---

### Dead Letter Queues (DLQ)

When a message fails processing repeatedly, it goes to a **Dead Letter Queue** for manual inspection.

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Producer │────→│  Queue   │────→│ Consumer │
└──────────┘     └──────────┘     └────┬─────┘
                                       │
                                  Fails 3x
                                       │
                                       ▼
                               ┌──────────────┐
                               │ Dead Letter  │
                               │    Queue     │
                               └──────────────┘
                                       │
                                       ▼
                               Manual review / Alert
```

---

### Backpressure

When consumers can't keep up with producers:

```
Producer: 1000 events/sec
Consumer:  100 events/sec  ← Overwhelmed!
```

**Strategies:**

- **Buffering** - Queue absorbs the spike (temporary)
- **Dropping** - Discard excess (acceptable for metrics)
- **Sampling** - Process subset (analytics)
- **Scaling** - Add more consumers
- **Rate limiting** - Slow down producers

---

### Real-World Use Cases

| Company      | Use Case                                             |
| ------------ | ---------------------------------------------------- |
| **Netflix**  | Millions of events/sec for real-time recommendations |
| **Uber**     | Trip updates, driver location, surge pricing         |
| **LinkedIn** | Activity feeds, notifications, analytics             |
| **Airbnb**   | Search indexing, pricing updates, availability       |
| **Spotify**  | Playlist updates, listening history, recommendations |

---

### EDA Maturity Model

| Level       | Description    | Characteristics                           |
| ----------- | -------------- | ----------------------------------------- |
| **Level 0** | No events      | Direct API calls only                     |
| **Level 1** | Basic events   | Simple pub/sub, no replay                 |
| **Level 2** | Event log      | Persistent events, replay capability      |
| **Level 3** | Event sourcing | Events as source of truth                 |
| **Level 4** | Full EDA       | CQRS + Event Sourcing + Stream processing |

---

## Core Concepts

| Term         | Description                            |
| ------------ | -------------------------------------- |
| **Event**    | Immutable fact that something happened |
| **Producer** | Service that publishes events          |
| **Consumer** | Service that subscribes to events      |
| **Broker**   | Middleware that routes events          |
| **Topic**    | Channel for specific event types       |

---

## Event Types

### 1. Domain Events

Business-meaningful occurrences:

- `OrderPlaced`
- `PaymentReceived`
- `UserRegistered`

### 2. Integration Events

Cross-service communication:

- `InventoryReserved`
- `ShipmentDispatched`

### 3. System Events

Infrastructure-level:

- `ServiceStarted`
- `HealthCheckFailed`

---

## Popular Tools

| Tool               | Type           | Best For                |
| ------------------ | -------------- | ----------------------- |
| **Apache Kafka**   | Log-based      | High throughput, replay |
| **RabbitMQ**       | Message broker | Complex routing         |
| **Amazon SQS/SNS** | Managed        | AWS ecosystem           |
| **Redis Streams**  | In-memory      | Low latency             |
| **NATS**           | Lightweight    | Cloud-native            |

---

## Benefits

✅ **Loose coupling** - Services don't know about each other  
✅ **Scalability** - Add consumers without changing producers  
✅ **Resilience** - Async processing, no blocking  
✅ **Audit trail** - Events can be stored/replayed  
✅ **Real-time** - React to changes immediately

---

## Challenges

❌ **Eventual consistency** - Data not immediately consistent  
❌ **Debugging complexity** - Harder to trace flows  
❌ **Message ordering** - Need to handle out-of-order  
❌ **Duplicate handling** - Idempotency required

---

## Event Delivery Guarantees

| Guarantee         | Description            | Use Case          |
| ----------------- | ---------------------- | ----------------- |
| **At-most-once**  | May lose messages      | Metrics, logs     |
| **At-least-once** | May duplicate          | Most use cases    |
| **Exactly-once**  | No loss, no duplicates | Financial systems |

---

## Patterns Within EDA

### Pub/Sub

- Publisher doesn't know subscribers
- Many consumers per event

### Event Streaming

- Persistent event log
- Replay from any point
- Kafka, Kinesis

### Event Notification

- Minimal data, just "something happened"
- Consumer fetches details if needed

### Event-Carried State Transfer

- Event contains all relevant data
- Consumer doesn't need to call back

---

## Key Takeaways

- **Events** = asynchronous, loosely coupled communication
- Choose broker based on **throughput** and **features**
- Handle **idempotency** and **ordering**
- Accept **eventual consistency**
- Great for **scalable, resilient** systems

---

## 📊 Eraser.io Diagram Code

```eraser
// Event-Driven Architecture
Order Service [icon: shopping-cart, color: blue]
Payment Service [icon: credit-card, color: green]
Inventory Service [icon: package, color: orange]
Notification Service [icon: bell, color: purple]
Analytics Service [icon: bar-chart, color: red]

Kafka [icon: radio, color: black] {
  orders-topic [icon: layers]
  payments-topic [icon: layers]
  inventory-topic [icon: layers]
}

Order Service --> Kafka: OrderCreated
Kafka --> Payment Service: Subscribe
Kafka --> Inventory Service: Subscribe
Kafka --> Notification Service: Subscribe
Kafka --> Analytics Service: Subscribe

Payment Service --> Kafka: PaymentProcessed
Inventory Service --> Kafka: InventoryUpdated
```

```eraser
// Pub/Sub Pattern
Publisher A [icon: server, color: blue]
Publisher B [icon: server, color: blue]

Topic [icon: radio, color: orange]

Subscriber 1 [icon: server, color: green]
Subscriber 2 [icon: server, color: green]
Subscriber 3 [icon: server, color: green]

Publisher A --> Topic: Publish event
Publisher B --> Topic: Publish event
Topic --> Subscriber 1: Deliver
Topic --> Subscriber 2: Deliver
Topic --> Subscriber 3: Deliver
```
