# Lesson 9.2: Read vs Write Models

## Introduction

In CQRS, the read model and write model serve different purposes and can be designed independently. This lesson explores how to design and implement both models effectively.

---

## Write Model (Command Side)

```
┌─────────────────────────────────────────────────────────────┐
│              WRITE MODEL                                     │
│                                                              │
│  Purpose: Handle commands, enforce business rules           │
│                                                              │
│  Characteristics:                                           │
│  ─────────────────                                          │
│  • Normalized data (3NF)                                    │
│  • Enforces constraints and invariants                      │
│  • Optimized for writes                                     │
│  • Contains business logic                                  │
│  • Domain-driven design                                     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 Order Aggregate                      │   │
│  │                                                      │   │
│  │  ┌─────────────┐                                    │   │
│  │  │   Order     │                                    │   │
│  │  │ - id        │                                    │   │
│  │  │ - userId    │                                    │   │
│  │  │ - status    │                                    │   │
│  │  │ - total     │                                    │   │
│  │  └──────┬──────┘                                    │   │
│  │         │ 1:N                                       │   │
│  │         ▼                                           │   │
│  │  ┌─────────────┐                                    │   │
│  │  │ OrderItem   │                                    │   │
│  │  │ - productId │                                    │   │
│  │  │ - quantity  │                                    │   │
│  │  │ - price     │                                    │   │
│  │  └─────────────┘                                    │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Write Model Implementation

```typescript
// Domain Entity (Write Model)
class Order {
  private id: string;
  private userId: string;
  private items: OrderItem[];
  private status: OrderStatus;
  private total: number;
  private createdAt: Date;
  private updatedAt: Date;

  constructor(props: OrderProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.items = props.items || [];
    this.status = props.status || 'PENDING';
    this.total = this.calculateTotal();
    this.createdAt = props.createdAt || new Date();
    this.updatedAt = new Date();
  }

  // Business logic lives here
  addItem(item: OrderItem): void {
    if (this.status !== 'PENDING') {
      throw new Error('Cannot modify confirmed order');
    }
    this.items.push(item);
    this.total = this.calculateTotal();
    this.updatedAt = new Date();
  }

  removeItem(productId: string): void {
    if (this.status !== 'PENDING') {
      throw new Error('Cannot modify confirmed order');
    }
    this.items = this.items.filter((i) => i.productId !== productId);
    this.total = this.calculateTotal();
    this.updatedAt = new Date();
  }

  confirm(): void {
    if (this.items.length === 0) {
      throw new Error('Cannot confirm empty order');
    }
    if (this.status !== 'PENDING') {
      throw new Error('Order already processed');
    }
    this.status = 'CONFIRMED';
    this.updatedAt = new Date();
  }

  cancel(): void {
    if (this.status === 'SHIPPED') {
      throw new Error('Cannot cancel shipped order');
    }
    this.status = 'CANCELLED';
    this.updatedAt = new Date();
  }

  private calculateTotal(): number {
    return this.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}

// Write Repository
interface OrderWriteRepository {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
}

class PostgresOrderWriteRepository implements OrderWriteRepository {
  async save(order: Order): Promise<void> {
    await this.pool.query(
      `INSERT INTO orders (id, user_id, status, total, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         status = $3, total = $4, updated_at = $6`,
      [order.id, order.userId, order.status, order.total, order.createdAt, order.updatedAt],
    );

    // Save items
    await this.pool.query('DELETE FROM order_items WHERE order_id = $1', [order.id]);
    for (const item of order.items) {
      await this.pool.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.productId, item.quantity, item.price],
      );
    }
  }
}
```

---

## Read Model (Query Side)

```
┌─────────────────────────────────────────────────────────────┐
│              READ MODEL                                      │
│                                                              │
│  Purpose: Serve queries efficiently                         │
│                                                              │
│  Characteristics:                                           │
│  ─────────────────                                          │
│  • Denormalized data                                        │
│  • Optimized for specific queries                           │
│  • No business logic                                        │
│  • Pre-computed aggregations                                │
│  • Multiple views for different needs                       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Order List View                         │   │
│  │                                                      │   │
│  │  {                                                   │   │
│  │    orderId: "ord_123",                              │   │
│  │    userId: "usr_456",                               │   │
│  │    userName: "John Doe",        ← Denormalized      │   │
│  │    status: "CONFIRMED",                             │   │
│  │    itemCount: 3,                ← Pre-computed      │   │
│  │    total: 149.99,                                   │   │
│  │    createdAt: "2024-01-15"                          │   │
│  │  }                                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Order Detail View                       │   │
│  │                                                      │   │
│  │  {                                                   │   │
│  │    orderId: "ord_123",                              │   │
│  │    user: { id, name, email },   ← Embedded          │   │
│  │    items: [                                         │   │
│  │      { productName, quantity, price, imageUrl }     │   │
│  │    ],                           ← Enriched          │   │
│  │    status: "CONFIRMED",                             │   │
│  │    timeline: [...],             ← History           │   │
│  │    total: 149.99                                    │   │
│  │  }                                                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Read Model Implementation

```typescript
// Read Model DTOs (Views)
interface OrderListView {
  orderId: string;
  userId: string;
  userName: string;
  status: string;
  itemCount: number;
  total: number;
  createdAt: Date;
}

interface OrderDetailView {
  orderId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  items: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    imageUrl: string;
  }[];
  status: string;
  timeline: {
    status: string;
    timestamp: Date;
  }[];
  total: number;
  createdAt: Date;
}

// Read Repository
interface OrderReadRepository {
  findById(id: string): Promise<OrderDetailView | null>;
  findByUser(userId: string, page: number, limit: number): Promise<OrderListView[]>;
  findByStatus(status: string): Promise<OrderListView[]>;
  getOrderStats(userId: string): Promise<OrderStats>;
}

class ElasticsearchOrderReadRepository implements OrderReadRepository {
  async findById(id: string): Promise<OrderDetailView | null> {
    const result = await this.client.get({
      index: 'orders',
      id,
    });
    return result._source as OrderDetailView;
  }

  async findByUser(userId: string, page: number, limit: number): Promise<OrderListView[]> {
    const result = await this.client.search({
      index: 'orders',
      body: {
        query: { term: { userId } },
        sort: [{ createdAt: 'desc' }],
        from: (page - 1) * limit,
        size: limit,
      },
    });
    return result.hits.hits.map((hit) => hit._source as OrderListView);
  }

  async getOrderStats(userId: string): Promise<OrderStats> {
    const result = await this.client.search({
      index: 'orders',
      body: {
        query: { term: { userId } },
        aggs: {
          totalOrders: { value_count: { field: 'orderId' } },
          totalSpent: { sum: { field: 'total' } },
          avgOrderValue: { avg: { field: 'total' } },
          byStatus: { terms: { field: 'status' } },
        },
      },
    });
    return this.mapAggregations(result.aggregations);
  }
}
```

---

## Synchronizing Read and Write Models

```
┌─────────────────────────────────────────────────────────────┐
│              SYNCHRONIZATION                                 │
│                                                              │
│  Write Model                          Read Model            │
│  ───────────                          ──────────            │
│                                                              │
│  ┌─────────────┐                     ┌─────────────┐       │
│  │   Command   │                     │    Query    │       │
│  │   Handler   │                     │   Handler   │       │
│  └──────┬──────┘                     └──────┬──────┘       │
│         │                                   │               │
│         ▼                                   ▼               │
│  ┌─────────────┐                     ┌─────────────┐       │
│  │  Write DB   │                     │   Read DB   │       │
│  │ (PostgreSQL)│                     │(Elasticsearch)      │
│  └──────┬──────┘                     └─────────────┘       │
│         │                                   ▲               │
│         │                                   │               │
│         │  ┌─────────────────────────────┐ │               │
│         └─▶│      Event/Message Bus      │─┘               │
│            │   (ORDER_CREATED event)     │                 │
│            └─────────────────────────────┘                 │
│                                                              │
│  Sync Methods:                                              │
│  1. Events (async, eventual consistency)                    │
│  2. Database triggers                                       │
│  3. Change Data Capture (CDC)                               │
│  4. Polling                                                 │
└─────────────────────────────────────────────────────────────┘
```

### Event-Based Synchronization

```typescript
// Event Handler for Read Model Updates
class OrderReadModelUpdater {
  constructor(
    private readRepository: OrderReadRepository,
    private userService: UserService,
    private productService: ProductService,
  ) {}

  @EventHandler('ORDER_CREATED')
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    // Fetch additional data for denormalization
    const user = await this.userService.getUser(event.data.userId);
    const products = await this.productService.getProducts(event.data.items.map((i) => i.productId));

    // Build read model
    const orderView: OrderDetailView = {
      orderId: event.data.orderId,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      items: event.data.items.map((item) => {
        const product = products.find((p) => p.id === item.productId);
        return {
          productId: item.productId,
          productName: product?.name || 'Unknown',
          quantity: item.quantity,
          price: item.price,
          imageUrl: product?.imageUrl || '',
        };
      }),
      status: 'PENDING',
      timeline: [{ status: 'PENDING', timestamp: new Date() }],
      total: event.data.total,
      createdAt: new Date(),
    };

    await this.readRepository.save(orderView);
  }

  @EventHandler('ORDER_STATUS_UPDATED')
  async onOrderStatusUpdated(event: OrderStatusUpdatedEvent): Promise<void> {
    const order = await this.readRepository.findById(event.data.orderId);
    if (!order) return;

    order.status = event.data.status;
    order.timeline.push({
      status: event.data.status,
      timestamp: new Date(),
    });

    await this.readRepository.save(order);
  }
}
```

---

## Multiple Read Models

```
┌─────────────────────────────────────────────────────────────┐
│              MULTIPLE READ MODELS                            │
│                                                              │
│  Same data, different views for different needs             │
│                                                              │
│  Write Model (Source of Truth)                              │
│  ┌─────────────┐                                           │
│  │   Orders    │                                           │
│  │   (RDBMS)   │                                           │
│  └──────┬──────┘                                           │
│         │                                                   │
│         │ Events                                            │
│         │                                                   │
│    ┌────┴────┬────────────┬────────────┐                   │
│    │         │            │            │                   │
│    ▼         ▼            ▼            ▼                   │
│  ┌─────┐  ┌─────┐    ┌─────────┐  ┌─────────┐             │
│  │List │  │Detail│   │Analytics│  │ Search  │             │
│  │View │  │View  │   │  View   │  │  View   │             │
│  │     │  │      │   │         │  │         │             │
│  │Redis│  │Mongo │   │ClickHse │  │Elastic  │             │
│  └─────┘  └─────┘    └─────────┘  └─────────┘             │
│                                                              │
│  Each optimized for its use case:                           │
│  • List: Fast key-value lookup                              │
│  • Detail: Document with nested data                        │
│  • Analytics: Columnar for aggregations                     │
│  • Search: Full-text search                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Handling Eventual Consistency

```typescript
// Client-side handling of eventual consistency
class OrderController {
  async createOrder(req: Request, res: Response): Promise<void> {
    // Execute command
    const orderId = await this.commandHandler.handle(new CreateOrderCommand(req.body));

    // Option 1: Return immediately with order ID
    // Client can poll or use WebSocket for updates
    res.status(202).json({
      orderId,
      message: 'Order is being processed',
      statusUrl: `/orders/${orderId}/status`,
    });

    // Option 2: Wait briefly for read model sync
    // await this.waitForReadModel(orderId, 2000);
    // const order = await this.queryHandler.getOrder(orderId);
    // res.status(201).json(order);
  }

  private async waitForReadModel(orderId: string, timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const exists = await this.readRepository.exists(orderId);
      if (exists) return;
      await this.sleep(100);
    }
  }
}
```

---

## Key Takeaways

1. **Write model** - normalized, enforces business rules
2. **Read model** - denormalized, optimized for queries
3. **Sync via events** - eventual consistency
4. **Multiple read models** - different views for different needs
5. **Handle consistency** - client-side strategies for lag

---

## What's Next?

In the next lesson, we will explore Event Sourcing basics.

---
