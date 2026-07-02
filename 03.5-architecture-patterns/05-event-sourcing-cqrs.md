# Pattern 5: Event Sourcing & CQRS

## Event Sourcing

### What is it?

Store state as a sequence of events rather than current state. The current state is derived by replaying all events.

### Key Concepts

- **Event** - Immutable record of something that happened
- **Event Store** - Append-only log of all events
- **Projection** - Derived view built from events
- **Replay** - Rebuild state by replaying events

### Benefits

- Complete audit trail
- Time travel / debugging
- Can rebuild any past state
- Enables event-driven architecture

### Challenges

- Increased storage
- Eventual consistency
- Schema evolution complexity

---

## CQRS (Command Query Responsibility Segregation)

### What is it?

Separate read and write models. Commands modify state, Queries read state.

### Key Concepts

- **Command** - Intent to change state (CreateOrder, UpdateUser)
- **Query** - Request for data (GetOrderById, ListUsers)
- **Write Model** - Optimized for updates
- **Read Model** - Optimized for queries

### Benefits

- Scale reads/writes independently
- Optimize each model separately
- Simpler query logic
- Better performance

### When to Use

- High read/write ratio difference
- Complex querying needs
- Different scaling requirements

---

## Event Sourcing + CQRS Together

Events from write side → Project to read models

### Flow

1. **Command** arrives
2. **Write model** processes, emits event
3. **Event** stored in event store
4. **Projector** builds read model
5. **Query** reads from optimized read model

---

## Key Takeaways

- **Event Sourcing** = store events, not state
- **CQRS** = separate read/write models
- Often used together but can be independent
- Adds complexity - use when benefits justify it

---

## 📊 Eraser.io Diagram Code

```eraser
// Event Sourcing
Command [icon: edit, color: blue]
Aggregate [icon: box, color: green]
Event Store [icon: database, color: orange]
Projector [icon: cpu, color: purple]
Read Model [icon: eye, color: blue]

Command --> Aggregate: Apply
Aggregate --> Event Store: Append event
Event Store --> Projector: Stream events
Projector --> Read Model: Update projection
```

```eraser
// CQRS Pattern
Client [icon: monitor]

Write Side [icon: edit, color: orange] {
  Command Handler [icon: terminal]
  Write Model [icon: database]
}

Read Side [icon: eye, color: blue] {
  Query Handler [icon: search]
  Read Model [icon: database]
}

Event Bus [icon: radio, color: purple]

Client --> Write Side: Commands
Client --> Read Side: Queries
Write Side --> Event Bus: Domain events
Event Bus --> Read Side: Sync projections
```
