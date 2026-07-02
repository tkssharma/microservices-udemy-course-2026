# Pattern 7: Outbox Pattern

## What is it?

A pattern ensuring reliable message publishing by storing events in a database table (outbox) as part of the same transaction as the business data.

---

## The Problem

```
1. Save order to database ✅
2. Publish event to message broker ❌ (broker down)
Result: Data saved but event lost!
```

---

## The Solution

### Transactional Outbox

1. **Save data + event** in same DB transaction
2. **Separate process** reads outbox and publishes
3. **Mark as published** after successful publish

### Flow

1. Begin transaction
2. Insert order into `orders` table
3. Insert event into `outbox` table
4. Commit transaction
5. Publisher reads outbox → publishes to broker → marks as sent

---

## Outbox Table Structure

| Column         | Purpose                          |
| -------------- | -------------------------------- |
| id             | Unique event ID                  |
| aggregate_type | Entity type (Order, User)        |
| aggregate_id   | Entity ID                        |
| event_type     | Event name (OrderCreated)        |
| payload        | Event data (JSON)                |
| created_at     | Timestamp                        |
| published_at   | When published (null if pending) |

---

## Publishing Strategies

### 1. Polling Publisher

- Periodically query outbox for unpublished events
- Simple but adds latency

### 2. Change Data Capture (CDC)

- Tools like Debezium watch database logs
- Near real-time, no polling needed
- More complex setup

---

## Benefits

- **Guaranteed delivery** - Event stored with data
- **Atomicity** - All or nothing
- **Retry-safe** - Can republish if needed

## Challenges

- Additional table and process
- Ordering guarantees need care
- Cleanup of old events

---

## Key Takeaways

- **Outbox** = store events in DB before publishing
- Solves the dual-write problem
- Use **polling** or **CDC** to publish
- Essential for reliable event-driven systems

---

## 📊 Eraser.io Diagram Code

```eraser
// Transactional Outbox Pattern
Order Service [icon: server, color: blue]

Database [icon: database, color: green] {
  Orders Table [icon: table]
  Outbox Table [icon: table]
}

Outbox Publisher [icon: upload, color: orange]
Message Broker [icon: radio, color: purple]
Consumer Service [icon: server, color: red]

Order Service --> Database: 1. Begin TX
Order Service --> Database: 2. Insert order + event
Order Service --> Database: 3. Commit TX
Outbox Publisher --> Database: 4. Poll outbox
Outbox Publisher --> Message Broker: 5. Publish event
Outbox Publisher --> Database: 6. Mark as sent
Message Broker --> Consumer Service: 7. Deliver event
```

```eraser
// CDC Approach
Database [icon: database, color: green]
Debezium [icon: activity, color: orange]
Kafka [icon: radio, color: purple]
Consumer [icon: server, color: blue]

Database --> Debezium: Read transaction log
Debezium --> Kafka: Stream changes
Kafka --> Consumer: Consume events
```
