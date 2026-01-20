# Lesson 6.1: Database per Service Pattern

## Introduction

The database-per-service pattern is a fundamental principle in microservices architecture. Each service owns its data and exposes it only through its API. No other service can access another service's database directly.

---

## The Pattern

```
┌─────────────────────────────────────────────────────────────┐
│              DATABASE PER SERVICE                            │
│                                                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │    User     │   │   Order     │   │  Product    │       │
│  │   Service   │   │   Service   │   │   Service   │       │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘       │
│         │                 │                 │               │
│         │ owns            │ owns            │ owns          │
│         ▼                 ▼                 ▼               │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │   User DB   │   │  Order DB   │   │ Product DB  │       │
│  │ (PostgreSQL)│   │  (MongoDB)  │   │(Elasticsearch)      │
│  └─────────────┘   └─────────────┘   └─────────────┘       │
│                                                              │
│  Rules:                                                     │
│  ──────                                                     │
│  ✓ Each service has its own database                        │
│  ✓ Only the owning service can read/write                   │
│  ✓ Other services must use the API                          │
│  ✗ No direct database access from other services            │
│  ✗ No shared tables between services                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Why Database per Service?

### 1. Loose Coupling

```
┌─────────────────────────────────────────────────────────────┐
│              LOOSE COUPLING                                  │
│                                                              │
│  Shared Database:                                           │
│  ─────────────────                                          │
│  Change user table schema → Break Order Service             │
│  Change user table schema → Break Product Service           │
│  Change user table schema → Break Payment Service           │
│                                                              │
│  Database per Service:                                      │
│  ─────────────────────                                      │
│  Change user table schema → Only User Service affected      │
│  API contract remains stable                                │
│  Other services unaware of internal changes                 │
└─────────────────────────────────────────────────────────────┘
```

### 2. Independent Deployability

Services can be deployed independently without coordinating database changes.

### 3. Technology Freedom

Each service can use the best database for its needs:

- User Service: PostgreSQL (relational, ACID)
- Product Search: Elasticsearch (full-text search)
- Session Store: Redis (fast key-value)
- Analytics: ClickHouse (columnar, analytics)

### 4. Scalability

Scale each database independently based on its workload.

---

## Implementation Strategies

### Option 1: Separate Database Servers

```
┌─────────────────────────────────────────────────────────────┐
│              SEPARATE SERVERS                                │
│                                                              │
│  User Service ──────▶ user-db.example.com:5432              │
│  Order Service ─────▶ order-db.example.com:27017            │
│  Product Service ───▶ product-db.example.com:9200           │
│                                                              │
│  Pros: Complete isolation, independent scaling              │
│  Cons: Higher cost, more infrastructure                     │
└─────────────────────────────────────────────────────────────┘
```

### Option 2: Separate Schemas (Same Server)

```
┌─────────────────────────────────────────────────────────────┐
│              SEPARATE SCHEMAS                                │
│                                                              │
│  PostgreSQL Server                                          │
│  ├── user_service schema                                    │
│  │   ├── users table                                        │
│  │   └── profiles table                                     │
│  ├── order_service schema                                   │
│  │   ├── orders table                                       │
│  │   └── order_items table                                  │
│  └── product_service schema                                 │
│      ├── products table                                     │
│      └── categories table                                   │
│                                                              │
│  Pros: Lower cost, easier to manage                         │
│  Cons: Shared resources, less isolation                     │
└─────────────────────────────────────────────────────────────┘
```

### Option 3: Separate Tables (Same Schema)

```
┌─────────────────────────────────────────────────────────────┐
│              SEPARATE TABLES (Minimum Isolation)             │
│                                                              │
│  Database: microservices                                    │
│  ├── user_users                                             │
│  ├── user_profiles                                          │
│  ├── order_orders                                           │
│  ├── order_items                                            │
│  ├── product_products                                       │
│  └── product_categories                                     │
│                                                              │
│  Pros: Simple, low cost                                     │
│  Cons: Easy to violate boundaries, shared resources         │
│                                                              │
│  Use only for: Small teams, early stages, POCs              │
└─────────────────────────────────────────────────────────────┘
```

---

## Code Example

```typescript
// user-service/src/config/database.ts
import { Pool } from 'pg';

// User service connects ONLY to its own database
const pool = new Pool({
  host: process.env.USER_DB_HOST,
  port: parseInt(process.env.USER_DB_PORT || '5432'),
  database: process.env.USER_DB_NAME,
  user: process.env.USER_DB_USER,
  password: process.env.USER_DB_PASSWORD,
});

export { pool };

// user-service/src/repositories/user.repository.ts
import { pool } from '../config/database';

export class UserRepository {
  async findById(id: string): Promise<User | null> {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async create(user: CreateUserDTO): Promise<User> {
    const result = await pool.query(
      `INSERT INTO users (id, email, name, created_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [generateId(), user.email, user.name],
    );
    return result.rows[0];
  }
}

// order-service/src/services/order.service.ts
// Order service needs user data - must call User Service API
export class OrderService {
  private userClient: UserServiceClient;

  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    // Get user via API, NOT direct database access
    const user = await this.userClient.getUser(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Create order in Order Service's own database
    const order = await this.orderRepository.create({
      userId,
      userEmail: user.email, // Cache what we need
      items,
      total: this.calculateTotal(items),
    });

    return order;
  }
}
```

---

## Handling Cross-Service Queries

When you need data from multiple services:

### Option 1: API Composition

```typescript
// API Gateway or BFF aggregates data
async function getOrderDetails(orderId: string) {
  const order = await orderService.getOrder(orderId);
  const user = await userService.getUser(order.userId);
  const products = await productService.getProducts(order.items.map((i) => i.productId));

  return {
    order,
    user: { id: user.id, name: user.name },
    products,
  };
}
```

### Option 2: Data Denormalization

```typescript
// Store needed data locally (denormalized)
// Order Service stores user name with order
interface Order {
  id: string;
  userId: string;
  userName: string; // Denormalized from User Service
  userEmail: string; // Denormalized from User Service
  items: OrderItem[];
}

// Keep in sync via events
eventBus.subscribe('USER_UPDATED', async (event) => {
  await orderRepository.updateUserInfo(event.userId, event.name, event.email);
});
```

---

## Challenges

```
┌─────────────────────────────────────────────────────────────┐
│              CHALLENGES                                      │
│                                                              │
│  1. Cross-Service Queries                                   │
│     No JOINs across services                                │
│     Solution: API composition, denormalization              │
│                                                              │
│  2. Data Consistency                                        │
│     No distributed transactions                             │
│     Solution: Eventual consistency, Saga pattern            │
│                                                              │
│  3. Data Duplication                                        │
│     Same data in multiple services                          │
│     Solution: Event-driven sync, accept duplication         │
│                                                              │
│  4. Reporting                                               │
│     Can't query across all data                             │
│     Solution: Data warehouse, event sourcing                │
│                                                              │
│  5. Complexity                                              │
│     More databases to manage                                │
│     Solution: Automation, managed services                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Each service owns its data** - no shared databases
2. **Access via API only** - never direct database access
3. **Technology freedom** - use the right database for each service
4. **Independent scaling** - scale databases based on workload
5. **Trade-offs exist** - no JOINs, eventual consistency
6. **Start simple** - separate schemas before separate servers

---

## What's Next?

In the next lesson, we will explore why shared databases are an anti-pattern.

---
