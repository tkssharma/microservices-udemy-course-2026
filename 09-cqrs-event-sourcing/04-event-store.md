# Lesson 9.4: Event Store

## Introduction

An Event Store is a specialized database for storing events. It's the backbone of event-sourced systems, providing append-only storage with strong ordering guarantees.

---

## Event Store Requirements

```
┌─────────────────────────────────────────────────────────────┐
│              EVENT STORE REQUIREMENTS                        │
│                                                              │
│  1. Append-Only                                             │
│     Events can only be added, never modified or deleted     │
│                                                              │
│  2. Ordered                                                 │
│     Events must maintain strict ordering per aggregate      │
│                                                              │
│  3. Optimistic Concurrency                                  │
│     Detect concurrent writes to same aggregate              │
│                                                              │
│  4. Stream-Based                                            │
│     Events grouped by aggregate (stream)                    │
│                                                              │
│  5. Subscription Support                                    │
│     Subscribe to new events for projections                 │
│                                                              │
│  6. Durable                                                 │
│     Events must survive crashes                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Event Store Schema

```sql
-- PostgreSQL Event Store Schema

CREATE TABLE events (
  -- Global sequence number
  sequence_number BIGSERIAL PRIMARY KEY,

  -- Event identification
  event_id UUID NOT NULL UNIQUE,

  -- Aggregate identification
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,

  -- Version for optimistic concurrency
  version INTEGER NOT NULL,

  -- Event data
  event_type VARCHAR(100) NOT NULL,
  data JSONB NOT NULL,
  metadata JSONB,

  -- Timestamp
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Ensure version uniqueness per aggregate
  UNIQUE (aggregate_id, version)
);

-- Index for loading aggregate events
CREATE INDEX idx_events_aggregate
  ON events (aggregate_id, version);

-- Index for subscriptions (reading from position)
CREATE INDEX idx_events_sequence
  ON events (sequence_number);

-- Index for event type queries
CREATE INDEX idx_events_type
  ON events (event_type);
```

---

## Event Store Implementation

```typescript
// src/event-store/event-store.interface.ts

interface StoredEvent {
  sequenceNumber: number;
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  eventType: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

interface AppendResult {
  success: boolean;
  sequenceNumber?: number;
  error?: string;
}

interface EventStore {
  // Append events to a stream
  append(
    aggregateId: string,
    aggregateType: string,
    events: DomainEvent[],
    expectedVersion: number,
  ): Promise<AppendResult>;

  // Load all events for an aggregate
  loadEvents(aggregateId: string): Promise<StoredEvent[]>;

  // Load events from a specific version
  loadEventsFromVersion(aggregateId: string, fromVersion: number): Promise<StoredEvent[]>;

  // Subscribe to all events from a position
  subscribe(fromSequence: number, handler: (event: StoredEvent) => Promise<void>): Promise<Subscription>;
}
```

```typescript
// src/event-store/postgres-event-store.ts

import { Pool } from 'pg';

export class PostgresEventStore implements EventStore {
  constructor(private pool: Pool) {}

  async append(
    aggregateId: string,
    aggregateType: string,
    events: DomainEvent[],
    expectedVersion: number,
  ): Promise<AppendResult> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Check current version (optimistic concurrency)
      const versionResult = await client.query(
        `SELECT COALESCE(MAX(version), 0) as current_version 
         FROM events WHERE aggregate_id = $1`,
        [aggregateId],
      );

      const currentVersion = versionResult.rows[0].current_version;

      if (currentVersion !== expectedVersion) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: `Concurrency conflict: expected version ${expectedVersion}, got ${currentVersion}`,
        };
      }

      // Append events
      let lastSequence: number = 0;
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const version = expectedVersion + i + 1;

        const result = await client.query(
          `INSERT INTO events 
           (event_id, aggregate_id, aggregate_type, version, event_type, data, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING sequence_number`,
          [
            event.eventId,
            aggregateId,
            aggregateType,
            version,
            event.eventType,
            JSON.stringify(event.data),
            JSON.stringify(event.metadata || {}),
          ],
        );

        lastSequence = result.rows[0].sequence_number;
      }

      await client.query('COMMIT');

      return { success: true, sequenceNumber: lastSequence };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async loadEvents(aggregateId: string): Promise<StoredEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM events 
       WHERE aggregate_id = $1 
       ORDER BY version`,
      [aggregateId],
    );

    return result.rows.map(this.mapRow);
  }

  async loadEventsFromVersion(aggregateId: string, fromVersion: number): Promise<StoredEvent[]> {
    const result = await this.pool.query(
      `SELECT * FROM events 
       WHERE aggregate_id = $1 AND version > $2
       ORDER BY version`,
      [aggregateId, fromVersion],
    );

    return result.rows.map(this.mapRow);
  }

  async subscribe(fromSequence: number, handler: (event: StoredEvent) => Promise<void>): Promise<Subscription> {
    let currentSequence = fromSequence;
    let running = true;

    const poll = async () => {
      while (running) {
        const result = await this.pool.query(
          `SELECT * FROM events 
           WHERE sequence_number > $1 
           ORDER BY sequence_number 
           LIMIT 100`,
          [currentSequence],
        );

        for (const row of result.rows) {
          const event = this.mapRow(row);
          await handler(event);
          currentSequence = event.sequenceNumber;
        }

        if (result.rows.length === 0) {
          // No new events, wait before polling again
          await this.sleep(1000);
        }
      }
    };

    // Start polling in background
    poll().catch(console.error);

    return {
      stop: () => {
        running = false;
      },
    };
  }

  private mapRow(row: any): StoredEvent {
    return {
      sequenceNumber: row.sequence_number,
      eventId: row.event_id,
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      version: row.version,
      eventType: row.event_type,
      data: row.data,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

## Repository with Event Store

```typescript
// src/repositories/event-sourced-repository.ts

export class EventSourcedOrderRepository {
  constructor(
    private eventStore: EventStore,
    private eventBus: EventBus,
  ) {}

  async save(order: Order): Promise<void> {
    const uncommittedEvents = order.getUncommittedEvents();

    if (uncommittedEvents.length === 0) {
      return;
    }

    const expectedVersion = order.getVersion() - uncommittedEvents.length;

    const result = await this.eventStore.append(order.getId(), 'Order', uncommittedEvents, expectedVersion);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Publish events for read model updates
    for (const event of uncommittedEvents) {
      await this.eventBus.publish(event);
    }

    order.clearUncommittedEvents();
  }

  async findById(orderId: string): Promise<Order | null> {
    const events = await this.eventStore.loadEvents(orderId);

    if (events.length === 0) {
      return null;
    }

    return Order.fromEvents(events);
  }
}
```

---

## Using the Event Store

```typescript
// Usage example

const eventStore = new PostgresEventStore(pool);
const eventBus = new RabbitMQEventBus();
const orderRepository = new EventSourcedOrderRepository(eventStore, eventBus);

// Create and save an order
async function createOrder(userId: string, items: OrderItem[]): Promise<Order> {
  const order = Order.create(generateId(), userId);

  for (const item of items) {
    order.addItem(item.productId, item.quantity, item.price);
  }

  order.confirm();

  await orderRepository.save(order);

  return order;
}

// Load an order
async function getOrder(orderId: string): Promise<Order | null> {
  return orderRepository.findById(orderId);
}

// Modify an order
async function addItemToOrder(orderId: string, productId: string, quantity: number, price: number): Promise<void> {
  const order = await orderRepository.findById(orderId);

  if (!order) {
    throw new Error('Order not found');
  }

  order.addItem(productId, quantity, price);

  await orderRepository.save(order);
}
```

---

## Event Store Options

```
┌─────────────────────────────────────────────────────────────┐
│              EVENT STORE OPTIONS                             │
│                                                              │
│  1. EventStoreDB                                            │
│     Purpose-built event store                               │
│     Native projections, subscriptions                       │
│     Best for pure event sourcing                            │
│                                                              │
│  2. PostgreSQL                                              │
│     Familiar, reliable                                      │
│     Good for getting started                                │
│     Need to implement subscriptions                         │
│                                                              │
│  3. Apache Kafka                                            │
│     High throughput                                         │
│     Built-in partitioning                                   │
│     Log-based, not aggregate-based                          │
│                                                              │
│  4. MongoDB                                                 │
│     Flexible schema                                         │
│     Change streams for subscriptions                        │
│     Good for document-oriented events                       │
│                                                              │
│  5. DynamoDB                                                │
│     Serverless, scalable                                    │
│     Streams for subscriptions                               │
│     AWS native                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Event Store is append-only** - never modify or delete
2. **Optimistic concurrency** - version checking prevents conflicts
3. **Streams per aggregate** - events grouped by aggregate ID
4. **Subscriptions** - enable read model updates
5. **Multiple options** - PostgreSQL, EventStoreDB, Kafka, etc.

---

## What's Next?

In the next lesson, we will explore projections and snapshots.

---
