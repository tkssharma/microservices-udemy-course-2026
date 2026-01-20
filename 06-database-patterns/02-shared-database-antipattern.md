# Lesson 6.2: Shared Database Anti-Pattern

## Introduction

A shared database is when multiple services read from and write to the same database. While it seems simpler, it creates tight coupling and defeats the purpose of microservices.

---

## The Anti-Pattern

```
┌─────────────────────────────────────────────────────────────┐
│              SHARED DATABASE ANTI-PATTERN                    │
│                                                              │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐       │
│  │    User     │   │   Order     │   │  Product    │       │
│  │   Service   │   │   Service   │   │   Service   │       │
│  └──────┬──────┘   └──────┬──────┘   └──────┬──────┘       │
│         │                 │                 │               │
│         │                 │                 │               │
│         └─────────────────┼─────────────────┘               │
│                           │                                 │
│                           ▼                                 │
│                    ┌─────────────┐                         │
│                    │   Shared    │                         │
│                    │  Database   │                         │
│                    │             │                         │
│                    │ users       │                         │
│                    │ orders      │                         │
│                    │ products    │                         │
│                    └─────────────┘                         │
│                                                              │
│  All services access all tables directly.                   │
│  This is a DISTRIBUTED MONOLITH.                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Why It's a Problem

### 1. Tight Coupling

```
┌─────────────────────────────────────────────────────────────┐
│              TIGHT COUPLING                                  │
│                                                              │
│  Scenario: Add column to users table                        │
│  ────────────────────────────────────                       │
│                                                              │
│  1. User Service needs new column: phone_number             │
│  2. Order Service has query: SELECT * FROM users            │
│  3. Product Service has query: SELECT * FROM users          │
│                                                              │
│  Impact:                                                    │
│  • Must coordinate schema change with ALL services          │
│  • Must deploy ALL services together                        │
│  • One service's change affects all others                  │
│  • Cannot evolve services independently                     │
│                                                              │
│  This defeats the purpose of microservices!                 │
└─────────────────────────────────────────────────────────────┘
```

### 2. No Clear Ownership

```
┌─────────────────────────────────────────────────────────────┐
│              OWNERSHIP CONFUSION                             │
│                                                              │
│  Question: Who owns the users table?                        │
│                                                              │
│  User Service: "We own it, we manage user data"             │
│  Order Service: "We need to update user's last_order_date"  │
│  Product Service: "We track user's favorite_category"       │
│                                                              │
│  Result:                                                    │
│  • Multiple services modify same table                      │
│  • No single source of truth                                │
│  • Conflicting business rules                               │
│  • Data integrity issues                                    │
│  • Blame game when things break                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Scaling Limitations

```
┌─────────────────────────────────────────────────────────────┐
│              SCALING PROBLEMS                                │
│                                                              │
│  Shared Database:                                           │
│  ─────────────────                                          │
│  • All services compete for same database resources         │
│  • Order Service spike affects User Service                 │
│  • Cannot scale database per service needs                  │
│  • Single point of failure                                  │
│                                                              │
│  Database per Service:                                      │
│  ─────────────────────                                      │
│  • Each service scales independently                        │
│  • Order DB can be scaled without affecting User DB         │
│  • Failure isolated to single service                       │
└─────────────────────────────────────────────────────────────┘
```

### 4. Technology Lock-In

All services must use the same database technology, even if it's not optimal.

---

## Real-World Consequences

```
┌─────────────────────────────────────────────────────────────┐
│              REAL-WORLD CONSEQUENCES                         │
│                                                              │
│  1. Deployment Nightmares                                   │
│     "We can't deploy Order Service until User Service       │
│      is ready because they share the database migration"    │
│                                                              │
│  2. Performance Issues                                      │
│     "Order Service's heavy queries are slowing down         │
│      User Service's login endpoint"                         │
│                                                              │
│  3. Data Corruption                                         │
│     "Product Service updated user preferences but           │
│      User Service overwrote them"                           │
│                                                              │
│  4. Testing Complexity                                      │
│     "We can't test Order Service in isolation because       │
│      it depends on User Service's tables"                   │
│                                                              │
│  5. Team Conflicts                                          │
│     "User team wants to rename column but Order team        │
│      hasn't updated their code yet"                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Signs You Have This Problem

- Services must be deployed together
- Schema changes require coordination across teams
- Multiple services have direct SQL queries to same tables
- Database is a bottleneck for all services
- Teams blame each other for data issues
- Cannot test services in isolation

---

## How to Fix It

### Step 1: Identify Data Ownership

```
┌─────────────────────────────────────────────────────────────┐
│              IDENTIFY OWNERSHIP                              │
│                                                              │
│  Table              Owner Service                           │
│  ─────              ─────────────                           │
│  users              User Service                            │
│  user_preferences   User Service                            │
│  orders             Order Service                           │
│  order_items        Order Service                           │
│  products           Product Service                         │
│  categories         Product Service                         │
│                                                              │
│  Rule: Each table has exactly ONE owner                     │
└─────────────────────────────────────────────────────────────┘
```

### Step 2: Create APIs for Data Access

```typescript
// Before: Direct database access
class OrderService {
  async createOrder(userId: string) {
    // BAD: Direct access to users table
    const user = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  }
}

// After: API access
class OrderService {
  async createOrder(userId: string) {
    // GOOD: Access via User Service API
    const user = await this.userClient.getUser(userId);
  }
}
```

### Step 3: Migrate Data Gradually

Use the Strangler Fig pattern to gradually move tables to separate databases.

---

## When Shared Database Might Be OK

```
┌─────────────────────────────────────────────────────────────┐
│              ACCEPTABLE EXCEPTIONS                           │
│                                                              │
│  1. Early Stage / POC                                       │
│     Starting with shared DB, plan to split later            │
│                                                              │
│  2. Same Team Owns All Services                             │
│     Small team, tight coordination possible                 │
│                                                              │
│  3. Read-Only Access                                        │
│     Service only reads, never writes                        │
│     (Still not ideal, but less harmful)                     │
│                                                              │
│  4. Reporting / Analytics                                   │
│     Separate read replica for reporting                     │
│     (Not the same as shared operational DB)                 │
│                                                              │
│  Even in these cases, plan for eventual separation!         │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Shared database = distributed monolith** - worst of both worlds
2. **Tight coupling** - changes affect all services
3. **No clear ownership** - leads to data integrity issues
4. **Scaling problems** - cannot scale independently
5. **Fix by identifying ownership** and creating APIs
6. **Migrate gradually** - use Strangler Fig pattern

---

## What's Next?

In the next lesson, we will explore data consistency strategies for distributed databases.

---
