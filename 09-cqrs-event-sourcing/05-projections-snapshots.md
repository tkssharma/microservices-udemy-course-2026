# Lesson 9.5: Projections and Snapshots

## Introduction

Projections transform events into read models, while snapshots optimize performance by caching aggregate state. Together, they make event sourcing practical for production systems.

---

## What are Projections?

```
┌─────────────────────────────────────────────────────────────┐
│              PROJECTIONS                                     │
│                                                              │
│  Events (Source of Truth)                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ OrderCreated → ItemAdded → ItemAdded → OrderConfirmed│   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           │ Project                         │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Read Models                        │   │
│  │                                                      │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │ Order List  │  │Order Detail │  │  Dashboard  │  │   │
│  │  │    View     │  │    View     │  │   Stats     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Projection = Function that transforms events into views    │
│  Each projection creates a specific read model              │
└─────────────────────────────────────────────────────────────┘
```

---

## Projection Implementation

```typescript
// src/projections/projection.interface.ts

interface Projection {
  name: string;
  handle(event: StoredEvent): Promise<void>;
  getPosition(): Promise<number>;
  setPosition(position: number): Promise<void>;
}

// src/projections/order-list-projection.ts

class OrderListProjection implements Projection {
  name = 'order-list';

  constructor(
    private readDb: Pool,
    private positionStore: PositionStore,
  ) {}

  async handle(event: StoredEvent): Promise<void> {
    switch (event.eventType) {
      case 'OrderCreated':
        await this.onOrderCreated(event);
        break;
      case 'ItemAdded':
        await this.onItemAdded(event);
        break;
      case 'OrderConfirmed':
        await this.onOrderConfirmed(event);
        break;
      case 'OrderShipped':
        await this.onOrderShipped(event);
        break;
    }
  }

  private async onOrderCreated(event: StoredEvent): Promise<void> {
    await this.readDb.query(
      `INSERT INTO order_list_view 
       (order_id, user_id, status, item_count, total, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [event.aggregateId, event.data.userId, 'DRAFT', 0, 0, event.createdAt],
    );
  }

  private async onItemAdded(event: StoredEvent): Promise<void> {
    await this.readDb.query(
      `UPDATE order_list_view 
       SET item_count = item_count + 1,
           total = total + $2
       WHERE order_id = $1`,
      [event.aggregateId, event.data.price * event.data.quantity],
    );
  }

  private async onOrderConfirmed(event: StoredEvent): Promise<void> {
    await this.readDb.query(
      `UPDATE order_list_view 
       SET status = 'CONFIRMED', total = $2
       WHERE order_id = $1`,
      [event.aggregateId, event.data.total],
    );
  }

  private async onOrderShipped(event: StoredEvent): Promise<void> {
    await this.readDb.query(
      `UPDATE order_list_view 
       SET status = 'SHIPPED'
       WHERE order_id = $1`,
      [event.aggregateId],
    );
  }

  async getPosition(): Promise<number> {
    return this.positionStore.get(this.name);
  }

  async setPosition(position: number): Promise<void> {
    await this.positionStore.set(this.name, position);
  }
}
```

---

## Projection Manager

```typescript
// src/projections/projection-manager.ts

class ProjectionManager {
  private projections: Projection[] = [];
  private running = false;

  constructor(private eventStore: EventStore) {}

  register(projection: Projection): void {
    this.projections.push(projection);
  }

  async start(): Promise<void> {
    this.running = true;

    for (const projection of this.projections) {
      this.runProjection(projection);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  private async runProjection(projection: Projection): Promise<void> {
    let position = await projection.getPosition();

    while (this.running) {
      try {
        const events = await this.eventStore.readFromPosition(position, 100);

        for (const event of events) {
          await projection.handle(event);
          position = event.sequenceNumber;
          await projection.setPosition(position);
        }

        if (events.length === 0) {
          await this.sleep(1000); // Wait for new events
        }
      } catch (error) {
        console.error(`Projection ${projection.name} error:`, error);
        await this.sleep(5000); // Wait before retry
      }
    }
  }

  // Rebuild projection from scratch
  async rebuild(projectionName: string): Promise<void> {
    const projection = this.projections.find((p) => p.name === projectionName);
    if (!projection) throw new Error('Projection not found');

    // Reset position to start
    await projection.setPosition(0);

    // Clear existing data
    await this.clearProjectionData(projectionName);

    // Replay all events
    let position = 0;
    while (true) {
      const events = await this.eventStore.readFromPosition(position, 1000);

      if (events.length === 0) break;

      for (const event of events) {
        await projection.handle(event);
        position = event.sequenceNumber;
      }

      await projection.setPosition(position);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Usage
const manager = new ProjectionManager(eventStore);
manager.register(new OrderListProjection(readDb, positionStore));
manager.register(new OrderDetailProjection(readDb, positionStore));
manager.register(new DashboardStatsProjection(readDb, positionStore));
await manager.start();
```

---

## What are Snapshots?

```
┌─────────────────────────────────────────────────────────────┐
│              SNAPSHOTS                                       │
│                                                              │
│  Problem: Loading 10,000 events to rebuild aggregate        │
│  is slow!                                                   │
│                                                              │
│  Solution: Periodically save aggregate state (snapshot)     │
│                                                              │
│  Without Snapshots:                                         │
│  ──────────────────                                         │
│  Load: Event1 → Event2 → ... → Event10000                   │
│  Time: 5 seconds                                            │
│                                                              │
│  With Snapshots:                                            │
│  ────────────────                                           │
│  Load: Snapshot@9900 → Event9901 → ... → Event10000         │
│  Time: 50 milliseconds                                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Events: [1][2][3]...[9900][9901]...[10000]          │   │
│  │                  ↑                                   │   │
│  │            Snapshot                                  │   │
│  │         (state at 9900)                              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Snapshot Implementation

```typescript
// src/snapshots/snapshot.interface.ts

interface Snapshot {
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: Record<string, unknown>;
  createdAt: Date;
}

interface SnapshotStore {
  save(snapshot: Snapshot): Promise<void>;
  load(aggregateId: string): Promise<Snapshot | null>;
}

// src/snapshots/postgres-snapshot-store.ts

class PostgresSnapshotStore implements SnapshotStore {
  constructor(private pool: Pool) {}

  async save(snapshot: Snapshot): Promise<void> {
    await this.pool.query(
      `INSERT INTO snapshots (aggregate_id, aggregate_type, version, state, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (aggregate_id) 
       DO UPDATE SET version = $3, state = $4, created_at = $5`,
      [
        snapshot.aggregateId,
        snapshot.aggregateType,
        snapshot.version,
        JSON.stringify(snapshot.state),
        snapshot.createdAt,
      ],
    );
  }

  async load(aggregateId: string): Promise<Snapshot | null> {
    const result = await this.pool.query('SELECT * FROM snapshots WHERE aggregate_id = $1', [aggregateId]);

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      version: row.version,
      state: row.state,
      createdAt: row.created_at,
    };
  }
}
```

---

## Repository with Snapshots

```typescript
// src/repositories/snapshotting-repository.ts

class SnapshottingOrderRepository {
  private snapshotInterval = 100; // Snapshot every 100 events

  constructor(
    private eventStore: EventStore,
    private snapshotStore: SnapshotStore,
    private eventBus: EventBus,
  ) {}

  async findById(orderId: string): Promise<Order | null> {
    // Try to load snapshot first
    const snapshot = await this.snapshotStore.load(orderId);

    let events: StoredEvent[];
    let order: Order;

    if (snapshot) {
      // Load events after snapshot
      events = await this.eventStore.loadEventsFromVersion(orderId, snapshot.version);

      // Restore from snapshot and apply new events
      order = Order.fromSnapshot(snapshot.state);
      for (const event of events) {
        order.apply(event, false);
      }
    } else {
      // No snapshot, load all events
      events = await this.eventStore.loadEvents(orderId);

      if (events.length === 0) return null;

      order = Order.fromEvents(events);
    }

    return order;
  }

  async save(order: Order): Promise<void> {
    const uncommittedEvents = order.getUncommittedEvents();

    if (uncommittedEvents.length === 0) return;

    const expectedVersion = order.getVersion() - uncommittedEvents.length;

    const result = await this.eventStore.append(order.getId(), 'Order', uncommittedEvents, expectedVersion);

    if (!result.success) {
      throw new Error(result.error);
    }

    // Publish events
    for (const event of uncommittedEvents) {
      await this.eventBus.publish(event);
    }

    order.clearUncommittedEvents();

    // Create snapshot if needed
    if (order.getVersion() % this.snapshotInterval === 0) {
      await this.createSnapshot(order);
    }
  }

  private async createSnapshot(order: Order): Promise<void> {
    const snapshot: Snapshot = {
      aggregateId: order.getId(),
      aggregateType: 'Order',
      version: order.getVersion(),
      state: order.toSnapshot(),
      createdAt: new Date(),
    };

    await this.snapshotStore.save(snapshot);
  }
}

// Order aggregate with snapshot support
class Order {
  // ... existing code ...

  static fromSnapshot(state: Record<string, unknown>): Order {
    const order = new Order();
    order.id = state.id as string;
    order.userId = state.userId as string;
    order.items = new Map(Object.entries(state.items as object));
    order.status = state.status as OrderStatus;
    order.total = state.total as number;
    order.version = state.version as number;
    return order;
  }

  toSnapshot(): Record<string, unknown> {
    return {
      id: this.id,
      userId: this.userId,
      items: Object.fromEntries(this.items),
      status: this.status,
      total: this.total,
      version: this.version,
    };
  }
}
```

---

## Snapshot Strategies

```
┌─────────────────────────────────────────────────────────────┐
│              SNAPSHOT STRATEGIES                             │
│                                                              │
│  1. Every N Events                                          │
│     Snapshot after every 100 events                         │
│     Simple, predictable                                     │
│                                                              │
│  2. Time-Based                                              │
│     Snapshot every hour/day                                 │
│     Good for aggregates with steady activity                │
│                                                              │
│  3. On Demand                                               │
│     Snapshot when loading takes too long                    │
│     Adaptive to actual performance                          │
│                                                              │
│  4. Background Process                                      │
│     Separate process creates snapshots                      │
│     Doesn't slow down normal operations                     │
│                                                              │
│  Best Practice:                                             │
│  ──────────────                                             │
│  Combine strategies: Every N events + background cleanup    │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Projections** transform events into read models
2. **Multiple projections** for different query needs
3. **Rebuild projections** by replaying events
4. **Snapshots** cache aggregate state for performance
5. **Combine both** for scalable event-sourced systems

---

## Module Summary

In this module, you learned:

- CQRS fundamentals and when to apply them
- Designing separate read and write models
- Event Sourcing for complete audit trails
- Building an Event Store
- Using projections and snapshots for performance

---

## What's Next?

In the next module, we will explore Resilience Patterns for building fault-tolerant microservices.

---
