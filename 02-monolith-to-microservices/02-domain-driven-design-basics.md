# Lesson 2.2: Domain-Driven Design Basics

## Introduction

Domain-Driven Design (DDD) is a software design approach that focuses on modeling software based on the business domain. It provides powerful concepts for identifying microservice boundaries.

---

## Why DDD for Microservices?

```
┌─────────────────────────────────────────────────────────────┐
│                  DDD AND MICROSERVICES                       │
│                                                              │
│  Problem: How do we decide service boundaries?              │
│                                                              │
│  Bad Approach:                                              │
│  - Split by technical layers (API, Service, Data)           │
│  - Split by team structure                                  │
│  - Random splitting                                         │
│                                                              │
│  DDD Approach:                                              │
│  - Split by business capability                             │
│  - Align with domain boundaries                             │
│  - One bounded context = One microservice                   │
│                                                              │
│  Result: Services that make business sense                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Core DDD Concepts

### 1. Domain

The domain is the business problem you are solving.

```
┌─────────────────────────────────────────────────────────────┐
│                       DOMAIN EXAMPLES                        │
│                                                              │
│  E-Commerce Domain:                                         │
│  - Selling products online                                  │
│  - Managing inventory                                       │
│  - Processing payments                                      │
│  - Shipping orders                                          │
│                                                              │
│  Banking Domain:                                            │
│  - Managing accounts                                        │
│  - Processing transactions                                  │
│  - Detecting fraud                                          │
│  - Regulatory compliance                                    │
│                                                              │
│  Healthcare Domain:                                         │
│  - Patient management                                       │
│  - Appointment scheduling                                   │
│  - Medical records                                          │
│  - Billing and insurance                                    │
└─────────────────────────────────────────────────────────────┘
```

### 2. Ubiquitous Language

A shared vocabulary between developers and domain experts.

```
┌─────────────────────────────────────────────────────────────┐
│                   UBIQUITOUS LANGUAGE                        │
│                                                              │
│  Without Ubiquitous Language:                               │
│  ────────────────────────────                               │
│  Developer: "The user entity has a cart collection"         │
│  Business:  "What's an entity? What's a collection?"        │
│                                                              │
│  With Ubiquitous Language:                                  │
│  ──────────────────────────                                 │
│  Everyone: "A Customer has a Shopping Cart with Items"      │
│                                                              │
│  Rules:                                                     │
│  - Use business terms in code                               │
│  - Avoid technical jargon with stakeholders                 │
│  - Document the language                                    │
│  - Enforce consistency                                      │
└─────────────────────────────────────────────────────────────┘
```

### 3. Bounded Context

A boundary within which a domain model is defined and applicable.

```
┌─────────────────────────────────────────────────────────────┐
│                    BOUNDED CONTEXTS                          │
│                                                              │
│  E-Commerce System:                                         │
│                                                              │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   SALES         │    │   SHIPPING      │                │
│  │   Context       │    │   Context       │                │
│  │                 │    │                 │                │
│  │  - Customer     │    │  - Recipient    │                │
│  │  - Order        │    │  - Shipment     │                │
│  │  - Product      │    │  - Package      │                │
│  │  - Price        │    │  - Address      │                │
│  └─────────────────┘    └─────────────────┘                │
│                                                              │
│  ┌─────────────────┐    ┌─────────────────┐                │
│  │   INVENTORY     │    │   BILLING       │                │
│  │   Context       │    │   Context       │                │
│  │                 │    │                 │                │
│  │  - Product      │    │  - Account      │                │
│  │  - Stock        │    │  - Invoice      │                │
│  │  - Warehouse    │    │  - Payment      │                │
│  │  - Location     │    │  - Transaction  │                │
│  └─────────────────┘    └─────────────────┘                │
│                                                              │
│  Note: "Product" means different things in each context!    │
└─────────────────────────────────────────────────────────────┘
```

### Same Term, Different Meaning

```
┌─────────────────────────────────────────────────────────────┐
│              "PRODUCT" IN DIFFERENT CONTEXTS                 │
│                                                              │
│  Sales Context:                                             │
│  ┌─────────────────────────────────────────┐               │
│  │ Product                                  │               │
│  │ - name                                   │               │
│  │ - description                            │               │
│  │ - price                                  │               │
│  │ - images                                 │               │
│  │ - reviews                                │               │
│  └─────────────────────────────────────────┘               │
│                                                              │
│  Inventory Context:                                         │
│  ┌─────────────────────────────────────────┐               │
│  │ Product                                  │               │
│  │ - sku                                    │               │
│  │ - quantity                               │               │
│  │ - warehouse_location                     │               │
│  │ - reorder_level                          │               │
│  └─────────────────────────────────────────┘               │
│                                                              │
│  Shipping Context:                                          │
│  ┌─────────────────────────────────────────┐               │
│  │ Product                                  │               │
│  │ - weight                                 │               │
│  │ - dimensions                             │               │
│  │ - fragile                                │               │
│  │ - hazardous                              │               │
│  └─────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## Strategic DDD Patterns

### 1. Context Map

Shows relationships between bounded contexts.

```
┌─────────────────────────────────────────────────────────────┐
│                      CONTEXT MAP                             │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │    Sales     │         │   Shipping   │                 │
│  │   Context    │────────▶│   Context    │                 │
│  └──────────────┘         └──────────────┘                 │
│         │                        ▲                          │
│         │                        │                          │
│         ▼                        │                          │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │  Inventory   │────────▶│   Billing    │                 │
│  │   Context    │         │   Context    │                 │
│  └──────────────┘         └──────────────┘                 │
│                                                              │
│  Relationship Types:                                        │
│  - Upstream/Downstream                                      │
│  - Customer/Supplier                                        │
│  - Partnership                                              │
│  - Shared Kernel                                            │
│  - Anti-Corruption Layer                                    │
└─────────────────────────────────────────────────────────────┘
```

### 2. Upstream/Downstream

```
┌─────────────────────────────────────────────────────────────┐
│                  UPSTREAM / DOWNSTREAM                       │
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Product    │         │    Order     │                 │
│  │   Catalog    │────────▶│   Service    │                 │
│  │  (Upstream)  │         │ (Downstream) │                 │
│  └──────────────┘         └──────────────┘                 │
│                                                              │
│  Upstream: Provides data/services                           │
│  Downstream: Consumes data/services                         │
│                                                              │
│  Upstream changes can break downstream!                     │
│  Downstream must adapt to upstream changes.                 │
└─────────────────────────────────────────────────────────────┘
```

### 3. Anti-Corruption Layer (ACL)

Protects your domain from external models.

```
┌─────────────────────────────────────────────────────────────┐
│                ANTI-CORRUPTION LAYER                         │
│                                                              │
│  ┌──────────────┐    ┌─────────┐    ┌──────────────┐       │
│  │   External   │    │   ACL   │    │    Your      │       │
│  │   System     │───▶│         │───▶│   Service    │       │
│  │  (Legacy)    │    │Translate│    │              │       │
│  └──────────────┘    └─────────┘    └──────────────┘       │
│                                                              │
│  External Model:           Your Model:                      │
│  {                         {                                │
│    "cust_id": 123,           "customerId": "123",          │
│    "cust_nm": "John",        "name": "John Doe",           │
│    "cust_addr": "..."        "address": { ... }            │
│  }                         }                                │
│                                                              │
│  ACL translates between models, protecting your domain.    │
└─────────────────────────────────────────────────────────────┘
```

---

## Tactical DDD Patterns

### 1. Entities

Objects with identity that persists over time.

```typescript
// Entity: Has unique identity
class Order {
  private readonly id: string; // Identity
  private status: OrderStatus;
  private items: OrderItem[];

  constructor(id: string) {
    this.id = id;
    this.status = OrderStatus.PENDING;
    this.items = [];
  }

  // Two orders are equal if they have the same ID
  equals(other: Order): boolean {
    return this.id === other.id;
  }
}
```

### 2. Value Objects

Objects defined by their attributes, not identity.

```typescript
// Value Object: No identity, defined by attributes
class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {}

  // Two Money objects are equal if amount and currency match
  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Currency mismatch');
    }
    return new Money(this.amount + other.amount, this.currency);
  }
}

// Value Object: Address
class Address {
  constructor(
    public readonly street: string,
    public readonly city: string,
    public readonly zipCode: string,
    public readonly country: string,
  ) {}
}
```

### 3. Aggregates

A cluster of entities and value objects with a root entity.

```
┌─────────────────────────────────────────────────────────────┐
│                      AGGREGATE                               │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                 Order Aggregate                      │   │
│  │                                                      │   │
│  │  ┌─────────────────┐                                │   │
│  │  │  Order (Root)   │◀── Aggregate Root              │   │
│  │  │  - id           │                                │   │
│  │  │  - status       │                                │   │
│  │  │  - createdAt    │                                │   │
│  │  └────────┬────────┘                                │   │
│  │           │                                          │   │
│  │           │ contains                                 │   │
│  │           ▼                                          │   │
│  │  ┌─────────────────┐    ┌─────────────────┐        │   │
│  │  │   OrderItem     │    │ ShippingAddress │        │   │
│  │  │   (Entity)      │    │ (Value Object)  │        │   │
│  │  └─────────────────┘    └─────────────────┘        │   │
│  │                                                      │   │
│  │  Rules:                                             │   │
│  │  - Access only through Aggregate Root               │   │
│  │  - Transactional consistency within aggregate       │   │
│  │  - Reference other aggregates by ID only            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

```typescript
// Aggregate Root
class Order {
  private readonly id: string;
  private items: OrderItem[] = [];
  private shippingAddress: Address;
  private status: OrderStatus;

  // All access goes through the root
  addItem(productId: string, quantity: number, price: Money): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new Error('Cannot modify confirmed order');
    }
    const item = new OrderItem(productId, quantity, price);
    this.items.push(item);
  }

  removeItem(productId: string): void {
    if (this.status !== OrderStatus.PENDING) {
      throw new Error('Cannot modify confirmed order');
    }
    this.items = this.items.filter((i) => i.productId !== productId);
  }

  confirm(): void {
    if (this.items.length === 0) {
      throw new Error('Cannot confirm empty order');
    }
    this.status = OrderStatus.CONFIRMED;
  }

  getTotal(): Money {
    return this.items.reduce((sum, item) => sum.add(item.getSubtotal()), new Money(0, 'USD'));
  }
}
```

### 4. Domain Events

Something that happened in the domain that domain experts care about.

```typescript
// Domain Event
interface DomainEvent {
  occurredAt: Date;
  aggregateId: string;
}

class OrderPlaced implements DomainEvent {
  occurredAt: Date;
  aggregateId: string;

  constructor(
    public readonly orderId: string,
    public readonly customerId: string,
    public readonly totalAmount: Money,
    public readonly items: OrderItemDTO[],
  ) {
    this.occurredAt = new Date();
    this.aggregateId = orderId;
  }
}

class OrderShipped implements DomainEvent {
  occurredAt: Date;
  aggregateId: string;

  constructor(
    public readonly orderId: string,
    public readonly trackingNumber: string,
    public readonly carrier: string,
  ) {
    this.occurredAt = new Date();
    this.aggregateId = orderId;
  }
}
```

### 5. Domain Services

Operations that don't belong to any entity.

```typescript
// Domain Service: Pricing logic that spans multiple entities
class PricingService {
  calculateOrderTotal(items: OrderItem[], customer: Customer, promotions: Promotion[]): Money {
    let total = items.reduce((sum, item) => sum.add(item.getSubtotal()), new Money(0, 'USD'));

    // Apply customer discount
    if (customer.isPremium()) {
      total = total.multiply(0.9); // 10% discount
    }

    // Apply promotions
    for (const promo of promotions) {
      total = promo.apply(total);
    }

    return total;
  }
}
```

### 6. Repositories

Abstraction for data access.

```typescript
// Repository Interface (Domain Layer)
interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  save(order: Order): Promise<void>;
  findByCustomerId(customerId: string): Promise<Order[]>;
}

// Repository Implementation (Infrastructure Layer)
class PostgresOrderRepository implements OrderRepository {
  constructor(private db: Database) {}

  async findById(id: string): Promise<Order | null> {
    const row = await this.db.query(
      'SELECT * FROM orders WHERE id = $1',
      [id]
    );
    return row ? this.toDomain(row) : null;
  }

  async save(order: Order): Promise<void> {
    await this.db.query(
      'INSERT INTO orders (...) VALUES (...) ON CONFLICT UPDATE ...',
      [...]
    );
  }

  private toDomain(row: any): Order {
    // Map database row to domain object
  }
}
```

---

## Mapping DDD to Microservices

```
┌─────────────────────────────────────────────────────────────┐
│              DDD TO MICROSERVICES MAPPING                    │
│                                                              │
│  DDD Concept              Microservices                     │
│  ───────────              ─────────────                     │
│                                                              │
│  Bounded Context    ───▶  Microservice                      │
│  Aggregate          ───▶  Service internal boundary         │
│  Domain Event       ───▶  Integration event / Message       │
│  Anti-Corruption    ───▶  API Gateway / Adapter             │
│  Context Map        ───▶  Service dependency diagram        │
│  Ubiquitous Lang    ───▶  API contracts / Schema            │
└─────────────────────────────────────────────────────────────┘
```

### Example: E-Commerce Bounded Contexts to Services

```
┌─────────────────────────────────────────────────────────────┐
│           BOUNDED CONTEXTS → MICROSERVICES                   │
│                                                              │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ Sales Context   │   ───▶  │ Order Service   │           │
│  └─────────────────┘         │ Cart Service    │           │
│                              └─────────────────┘           │
│                                                              │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ Catalog Context │   ───▶  │ Product Service │           │
│  └─────────────────┘         │ Search Service  │           │
│                              └─────────────────┘           │
│                                                              │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ Inventory Ctx   │   ───▶  │ Inventory Svc   │           │
│  └─────────────────┘         └─────────────────┘           │
│                                                              │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ Shipping Context│   ───▶  │ Shipping Service│           │
│  └─────────────────┘         └─────────────────┘           │
│                                                              │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │ Billing Context │   ───▶  │ Payment Service │           │
│  └─────────────────┘         │ Invoice Service │           │
│                              └─────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

---

## Event Storming

A workshop technique to discover domain events and bounded contexts.

```
┌─────────────────────────────────────────────────────────────┐
│                    EVENT STORMING                            │
│                                                              │
│  Step 1: Identify Domain Events (Orange sticky notes)       │
│  ─────────────────────────────────────────────────────      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │ Customer   │ │ Item Added │ │ Order      │              │
│  │ Registered │ │ to Cart    │ │ Placed     │              │
│  └────────────┘ └────────────┘ └────────────┘              │
│                                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │ Payment    │ │ Order      │ │ Order      │              │
│  │ Received   │ │ Shipped    │ │ Delivered  │              │
│  └────────────┘ └────────────┘ └────────────┘              │
│                                                              │
│  Step 2: Identify Commands (Blue sticky notes)              │
│  ─────────────────────────────────────────────              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐              │
│  │ Register   │ │ Add Item   │ │ Place      │              │
│  │ Customer   │ │ to Cart    │ │ Order      │              │
│  └────────────┘ └────────────┘ └────────────┘              │
│                                                              │
│  Step 3: Group into Bounded Contexts                        │
│  ───────────────────────────────────                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Customer Context    │ Sales Context    │ Shipping   │   │
│  │ ──────────────────  │ ─────────────    │ ────────   │   │
│  │ Customer Registered │ Item Added       │ Shipped    │   │
│  │                     │ Order Placed     │ Delivered  │   │
│  │                     │ Payment Received │            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Bounded Context = Microservice** - Each context becomes a service
2. **Ubiquitous Language** - Use business terms in code and APIs
3. **Aggregates define consistency** - Transaction boundary within a service
4. **Domain Events enable integration** - Async communication between services
5. **Anti-Corruption Layer protects** - Translate external models at boundaries
6. **Event Storming discovers boundaries** - Workshop technique with domain experts

---

## What's Next?

In the next lesson, we will apply these DDD concepts to identify service boundaries in your monolith.

---
