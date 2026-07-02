# Pattern 6: Saga Pattern

## What is it?

A pattern for managing distributed transactions across multiple services using a sequence of local transactions with compensating actions.

---

## The Problem

- Microservices each have their own database
- Traditional ACID transactions don't work across services
- Need consistency without distributed locks

---

## Two Approaches

### 1. Choreography

- Services communicate via events
- Each service listens and reacts
- No central coordinator

**Flow:** Order Created → Payment Charged → Inventory Reserved → Order Confirmed

**Pros:** Loosely coupled, simple for few steps  
**Cons:** Hard to track, complex with many services

### 2. Orchestration

- Central orchestrator controls the flow
- Tells each service what to do
- Easier to monitor and manage

**Flow:** Orchestrator → "Charge Payment" → Orchestrator → "Reserve Inventory" → Done

**Pros:** Easy to understand, centralized logic  
**Cons:** Single point of coordination, tighter coupling

---

## Compensating Transactions

When a step fails, undo previous steps:

1. ✅ Order Created
2. ✅ Payment Charged
3. ❌ Inventory Failed
4. ⏪ **Compensate:** Refund Payment
5. ⏪ **Compensate:** Cancel Order

---

## When to Use

- Multi-service business processes
- Long-running transactions
- Need eventual consistency

## When NOT to Use

- Single service operations
- Can use simple request/response
- Need strong consistency (consider different approach)

---

## Key Takeaways

- **Saga** = sequence of local transactions
- **Choreography** = event-driven, decentralized
- **Orchestration** = centralized coordinator
- Always plan **compensating actions** for rollback

---

## 📊 Eraser.io Diagram Code

```eraser
// Saga Choreography
Order Service [icon: shopping-cart, color: blue]
Payment Service [icon: credit-card, color: green]
Inventory Service [icon: package, color: orange]
Shipping Service [icon: truck, color: purple]
Event Bus [icon: radio, color: red]

Order Service --> Event Bus: OrderCreated
Event Bus --> Payment Service: Listen
Payment Service --> Event Bus: PaymentCompleted
Event Bus --> Inventory Service: Listen
Inventory Service --> Event Bus: InventoryReserved
Event Bus --> Shipping Service: Listen
Shipping Service --> Event Bus: ShipmentCreated
```

```eraser
// Saga Orchestration
Saga Orchestrator [icon: cpu, color: blue]
Order Service [icon: shopping-cart, color: green]
Payment Service [icon: credit-card, color: green]
Inventory Service [icon: package, color: green]
Shipping Service [icon: truck, color: green]

Saga Orchestrator --> Order Service: 1. Create order
Order Service --> Saga Orchestrator: Success
Saga Orchestrator --> Payment Service: 2. Charge payment
Payment Service --> Saga Orchestrator: Success
Saga Orchestrator --> Inventory Service: 3. Reserve inventory
Inventory Service --> Saga Orchestrator: Success
Saga Orchestrator --> Shipping Service: 4. Create shipment
```
