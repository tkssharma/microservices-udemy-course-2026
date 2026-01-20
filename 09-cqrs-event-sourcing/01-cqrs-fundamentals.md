# Lesson 9.1: CQRS Fundamentals

## Introduction

CQRS (Command Query Responsibility Segregation) is a pattern that separates read and write operations into different models. This separation allows each model to be optimized for its specific purpose.

---

## What is CQRS?

```
┌─────────────────────────────────────────────────────────────┐
│              TRADITIONAL CRUD                                │
│                                                              │
│  ┌─────────────┐                                           │
│  │   Client    │                                           │
│  └──────┬──────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │   Service   │  ← Same model for read & write            │
│  └──────┬──────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │  Database   │  ← Same schema for read & write           │
│  └─────────────┘                                           │
│                                                              │
│  Problems:                                                  │
│  • Read and write have different requirements              │
│  • Complex queries slow down writes                        │
│  • Hard to scale reads independently                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              CQRS                                            │
│                                                              │
│  ┌─────────────┐                                           │
│  │   Client    │                                           │
│  └──────┬──────┘                                           │
│         │                                                   │
│    ┌────┴────┐                                             │
│    │         │                                             │
│    ▼         ▼                                             │
│  ┌─────┐   ┌─────┐                                         │
│  │Write│   │Read │  ← Separate models                      │
│  │Model│   │Model│                                         │
│  └──┬──┘   └──┬──┘                                         │
│     │         │                                             │
│     ▼         ▼                                             │
│  ┌─────┐   ┌─────┐                                         │
│  │Write│   │Read │  ← Can be different databases           │
│  │ DB  │   │ DB  │                                         │
│  └─────┘   └─────┘                                         │
│                                                              │
│  Benefits:                                                  │
│  • Optimize each model for its purpose                     │
│  • Scale reads and writes independently                    │
│  • Simpler models (single responsibility)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Commands vs Queries

```
┌─────────────────────────────────────────────────────────────┐
│              COMMANDS vs QUERIES                             │
│                                                              │
│  COMMANDS (Write):                                          │
│  ─────────────────                                          │
│  • Intent to change state                                   │
│  • Imperative: CreateOrder, UpdateUser, DeleteProduct       │
│  • Can be rejected (validation fails)                       │
│  • May have side effects                                    │
│  • Return success/failure (not data)                        │
│                                                              │
│  QUERIES (Read):                                            │
│  ────────────────                                           │
│  • Request for information                                  │
│  • Interrogative: GetOrder, FindUsers, ListProducts         │
│  • Cannot be rejected (always returns something)            │
│  • No side effects (idempotent)                             │
│  • Return data                                              │
│                                                              │
│  Key Principle:                                             │
│  ──────────────                                             │
│  A method should either change state OR return data,        │
│  never both. (Command-Query Separation)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Simple CQRS Implementation

```typescript
// Commands
interface CreateOrderCommand {
  userId: string;
  items: { productId: string; quantity: number }[];
}

interface UpdateOrderStatusCommand {
  orderId: string;
  status: string;
}

// Command Handlers
class OrderCommandHandler {
  constructor(
    private orderRepository: OrderWriteRepository,
    private eventBus: EventBus,
  ) {}

  async handleCreateOrder(command: CreateOrderCommand): Promise<string> {
    // Validate
    if (!command.items.length) {
      throw new Error('Order must have items');
    }

    // Create order
    const order = new Order({
      id: generateId(),
      userId: command.userId,
      items: command.items,
      status: 'PENDING',
      createdAt: new Date(),
    });

    // Save to write database
    await this.orderRepository.save(order);

    // Publish event for read model sync
    await this.eventBus.publish({
      type: 'ORDER_CREATED',
      data: order,
    });

    return order.id;
  }

  async handleUpdateStatus(command: UpdateOrderStatusCommand): Promise<void> {
    const order = await this.orderRepository.findById(command.orderId);
    if (!order) throw new Error('Order not found');

    order.status = command.status;
    order.updatedAt = new Date();

    await this.orderRepository.save(order);

    await this.eventBus.publish({
      type: 'ORDER_STATUS_UPDATED',
      data: { orderId: order.id, status: order.status },
    });
  }
}

// Queries
interface GetOrderQuery {
  orderId: string;
}

interface ListOrdersQuery {
  userId: string;
  status?: string;
  page: number;
  limit: number;
}

// Query Handlers
class OrderQueryHandler {
  constructor(private orderReadRepository: OrderReadRepository) {}

  async handleGetOrder(query: GetOrderQuery): Promise<OrderView | null> {
    return this.orderReadRepository.findById(query.orderId);
  }

  async handleListOrders(query: ListOrdersQuery): Promise<OrderListView> {
    return this.orderReadRepository.findByUser(query.userId, query.status, query.page, query.limit);
  }
}
```

---

## When to Use CQRS

```
┌─────────────────────────────────────────────────────────────┐
│              WHEN TO USE CQRS                                │
│                                                              │
│  Good Fit:                                                  │
│  ─────────                                                  │
│  ✓ Read and write patterns are very different              │
│  ✓ Complex queries that slow down writes                   │
│  ✓ Need to scale reads independently                       │
│  ✓ Different teams work on read vs write                   │
│  ✓ Event sourcing is used                                  │
│  ✓ Multiple read representations needed                    │
│                                                              │
│  Not Needed:                                                │
│  ───────────                                                │
│  ✗ Simple CRUD applications                                │
│  ✗ Read and write patterns are similar                     │
│  ✗ Small scale, no performance issues                      │
│  ✗ Team is small and not specialized                       │
│                                                              │
│  Remember: CQRS adds complexity!                            │
│  Only use when benefits outweigh costs.                     │
└─────────────────────────────────────────────────────────────┘
```

---

## CQRS Levels

```
┌─────────────────────────────────────────────────────────────┐
│              CQRS LEVELS                                     │
│                                                              │
│  Level 1: Same Database, Different Models                  │
│  ─────────────────────────────────────────                  │
│  • Separate code paths for read/write                       │
│  • Same database, different queries                         │
│  • Simplest form                                            │
│                                                              │
│  Level 2: Same Database, Different Tables                  │
│  ─────────────────────────────────────────                  │
│  • Write to normalized tables                               │
│  • Read from denormalized views/tables                      │
│  • Sync via triggers or application code                    │
│                                                              │
│  Level 3: Different Databases                               │
│  ────────────────────────────                               │
│  • Write DB optimized for writes (PostgreSQL)               │
│  • Read DB optimized for reads (Elasticsearch)              │
│  • Sync via events                                          │
│  • Eventual consistency                                     │
│                                                              │
│  Level 4: Event Sourcing + CQRS                             │
│  ──────────────────────────────                             │
│  • Write = append events to event store                     │
│  • Read = project events to read models                     │
│  • Full audit trail                                         │
│  • Most complex                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Benefits and Trade-offs

```
┌─────────────────────────────────────────────────────────────┐
│              BENEFITS                                        │
│                                                              │
│  1. Independent Scaling                                     │
│     Scale read replicas without affecting writes            │
│                                                              │
│  2. Optimized Models                                        │
│     Read model: denormalized, fast queries                  │
│     Write model: normalized, data integrity                 │
│                                                              │
│  3. Simpler Code                                            │
│     Each model has single responsibility                    │
│                                                              │
│  4. Flexibility                                             │
│     Multiple read models for different use cases            │
│                                                              │
│  5. Performance                                             │
│     Queries don't compete with writes                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              TRADE-OFFS                                      │
│                                                              │
│  1. Complexity                                              │
│     More moving parts, harder to understand                 │
│                                                              │
│  2. Eventual Consistency                                    │
│     Read model may lag behind write model                   │
│                                                              │
│  3. Data Duplication                                        │
│     Same data in multiple places                            │
│                                                              │
│  4. Synchronization                                         │
│     Must keep read model in sync                            │
│                                                              │
│  5. Learning Curve                                          │
│     Team needs to understand the pattern                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **CQRS separates** read and write operations
2. **Commands change state**, queries return data
3. **Different models** can be optimized for their purpose
4. **Multiple levels** of CQRS complexity
5. **Not always needed** - adds complexity
6. **Best with event sourcing** for full benefits

---

## What's Next?

In the next lesson, we will explore read and write models in detail.

---
