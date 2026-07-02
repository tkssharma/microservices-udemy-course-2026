# Pattern 9: Database per Service

## What is it?

Each microservice owns and manages its own private database. No direct database sharing between services.

---

## The Principle

- Service owns its data
- Only the service can access its database
- Other services request data via API

---

## Why It Matters

### Benefits

- **Loose coupling** - Services can change DB schema independently
- **Technology freedom** - Use best DB for each service (SQL, NoSQL, Graph)
- **Independent scaling** - Scale each database separately
- **Fault isolation** - One DB failure doesn't affect others

### Challenges

- **Cross-service queries** - Can't JOIN across services
- **Data consistency** - No ACID across services
- **Data duplication** - Some data may be replicated

---

## Data Ownership Examples

| Service   | Database      | Data Owned          |
| --------- | ------------- | ------------------- |
| Users     | PostgreSQL    | User profiles, auth |
| Orders    | PostgreSQL    | Orders, line items  |
| Products  | MongoDB       | Product catalog     |
| Search    | Elasticsearch | Search indexes      |
| Analytics | ClickHouse    | Event data          |

---

## Cross-Service Data Access

### Option 1: API Calls

- Service A calls Service B's API
- Simple but adds latency

### Option 2: Event-Driven

- Service B publishes events
- Service A maintains local copy
- Eventually consistent

### Option 3: API Composition

- Gateway aggregates data from multiple services
- Useful for read-heavy operations

---

## Anti-Pattern: Shared Database

❌ **Don't do this:**

- Multiple services accessing same tables
- Tight coupling through schema
- Can't change without coordinating all services

---

## Key Takeaways

- **One service = one database**
- Enables independent deployments
- Use **events** or **APIs** for cross-service data
- Choose the right database type per service
- Accept eventual consistency

---

## 📊 Eraser.io Diagram Code

```eraser
// Database per Service
Users Service [icon: users, color: blue]
Orders Service [icon: shopping-cart, color: green]
Products Service [icon: package, color: orange]
Search Service [icon: search, color: purple]

PostgreSQL Users [icon: database, color: blue]
PostgreSQL Orders [icon: database, color: green]
MongoDB Products [icon: database, color: orange]
Elasticsearch [icon: database, color: purple]

Users Service --> PostgreSQL Users: Owns
Orders Service --> PostgreSQL Orders: Owns
Products Service --> MongoDB Products: Owns
Search Service --> Elasticsearch: Owns

Event Bus [icon: radio, color: red]
Orders Service --> Event Bus: Publish events
Products Service --> Event Bus: Publish events
Search Service --> Event Bus: Subscribe & sync
```

```eraser
// Cross-Service Data Access
Order Service [icon: shopping-cart, color: blue]
User Service [icon: users, color: green]
Event Bus [icon: radio, color: orange]

Order Service --> User Service: API call for user data
User Service --> Event Bus: UserUpdated event
Event Bus --> Order Service: Sync local cache
```
