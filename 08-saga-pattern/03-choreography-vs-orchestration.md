# Lesson 8.3: Choreography vs Orchestration

## Introduction

There are two main approaches to implementing sagas: choreography and orchestration. Each has distinct characteristics that make it suitable for different scenarios.

---

## Choreography

In choreography, each service produces and listens to events. There's no central coordinator - services collaborate by reacting to each other's events.

```
┌─────────────────────────────────────────────────────────────┐
│              CHOREOGRAPHY                                    │
│                                                              │
│  No central coordinator - services react to events          │
│                                                              │
│  ┌─────────────┐     OrderCreated     ┌─────────────┐      │
│  │   Order     │─────────────────────▶│  Inventory  │      │
│  │   Service   │                      │   Service   │      │
│  └─────────────┘                      └──────┬──────┘      │
│         ▲                                    │              │
│         │                          InventoryReserved        │
│         │                                    │              │
│         │                                    ▼              │
│         │                             ┌─────────────┐      │
│         │                             │   Payment   │      │
│         │                             │   Service   │      │
│         │                             └──────┬──────┘      │
│         │                                    │              │
│         │                          PaymentProcessed         │
│         │                                    │              │
│         └────────────────────────────────────┘              │
│                                                              │
│  Each service:                                              │
│  • Listens for relevant events                              │
│  • Performs its local transaction                           │
│  • Publishes result event                                   │
│  • Knows nothing about other services                       │
└─────────────────────────────────────────────────────────────┘
```

### Choreography Implementation

```typescript
// Order Service
class OrderService {
  async createOrder(data: CreateOrderDTO): Promise<Order> {
    const order = await this.orderRepository.create({
      ...data,
      status: 'PENDING',
    });

    // Publish event - don't know who listens
    await this.eventBus.publish({
      type: 'ORDER_CREATED',
      data: { orderId: order.id, items: order.items, total: order.total },
    });

    return order;
  }

  // Listen for payment result
  @EventHandler('PAYMENT_PROCESSED')
  async onPaymentProcessed(event: PaymentProcessedEvent): Promise<void> {
    await this.orderRepository.updateStatus(event.data.orderId, 'CONFIRMED');
  }

  @EventHandler('PAYMENT_FAILED')
  async onPaymentFailed(event: PaymentFailedEvent): Promise<void> {
    await this.orderRepository.updateStatus(event.data.orderId, 'CANCELLED');
  }
}

// Inventory Service
class InventoryService {
  @EventHandler('ORDER_CREATED')
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      await this.reserveStock(event.data.orderId, event.data.items);

      await this.eventBus.publish({
        type: 'INVENTORY_RESERVED',
        data: { orderId: event.data.orderId },
      });
    } catch (error) {
      await this.eventBus.publish({
        type: 'INVENTORY_RESERVATION_FAILED',
        data: { orderId: event.data.orderId, reason: error.message },
      });
    }
  }

  // Compensate if payment fails
  @EventHandler('PAYMENT_FAILED')
  async onPaymentFailed(event: PaymentFailedEvent): Promise<void> {
    await this.releaseStock(event.data.orderId);
  }
}

// Payment Service
class PaymentService {
  @EventHandler('INVENTORY_RESERVED')
  async onInventoryReserved(event: InventoryReservedEvent): Promise<void> {
    try {
      await this.processPayment(event.data.orderId);

      await this.eventBus.publish({
        type: 'PAYMENT_PROCESSED',
        data: { orderId: event.data.orderId },
      });
    } catch (error) {
      await this.eventBus.publish({
        type: 'PAYMENT_FAILED',
        data: { orderId: event.data.orderId, reason: error.message },
      });
    }
  }
}
```

---

## Orchestration

In orchestration, a central orchestrator (saga coordinator) tells each service what to do and when.

```
┌─────────────────────────────────────────────────────────────┐
│              ORCHESTRATION                                   │
│                                                              │
│  Central orchestrator controls the flow                     │
│                                                              │
│                    ┌─────────────────┐                      │
│                    │      Saga       │                      │
│                    │  Orchestrator   │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│           ┌─────────────────┼─────────────────┐            │
│           │                 │                 │            │
│           ▼                 ▼                 ▼            │
│    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    │
│    │   Order     │   │  Inventory  │   │   Payment   │    │
│    │   Service   │   │   Service   │   │   Service   │    │
│    └─────────────┘   └─────────────┘   └─────────────┘    │
│                                                              │
│  Orchestrator:                                              │
│  • Knows the saga steps                                     │
│  • Sends commands to services                               │
│  • Receives responses                                       │
│  • Decides next step or compensation                        │
│  • Maintains saga state                                     │
└─────────────────────────────────────────────────────────────┘
```

### Orchestration Implementation

```typescript
// Saga Orchestrator
class OrderSagaOrchestrator {
  async execute(orderData: CreateOrderDTO): Promise<SagaResult> {
    const saga = await this.sagaRepository.create({
      id: generateId(),
      type: 'CREATE_ORDER',
      status: 'STARTED',
      data: orderData,
      currentStep: 0,
    });

    try {
      // Step 1: Create Order
      const order = await this.orderService.createOrder(orderData);
      await this.updateSagaStep(saga.id, 1, 'COMPLETED');

      // Step 2: Reserve Inventory
      await this.inventoryService.reserve(order.id, orderData.items);
      await this.updateSagaStep(saga.id, 2, 'COMPLETED');

      // Step 3: Process Payment
      await this.paymentService.process(order.id, orderData.total);
      await this.updateSagaStep(saga.id, 3, 'COMPLETED');

      // Step 4: Confirm Order
      await this.orderService.confirm(order.id);
      await this.updateSagaStep(saga.id, 4, 'COMPLETED');

      await this.sagaRepository.updateStatus(saga.id, 'COMPLETED');
      return { success: true, orderId: order.id };
    } catch (error) {
      await this.compensate(saga, error);
      return { success: false, error: error.message };
    }
  }

  private async compensate(saga: Saga, error: Error): Promise<void> {
    await this.sagaRepository.updateStatus(saga.id, 'COMPENSATING');

    // Compensate in reverse order
    const completedSteps = saga.currentStep;

    if (completedSteps >= 3) {
      // Payment was processed - refund
      await this.paymentService.refund(saga.data.orderId);
    }

    if (completedSteps >= 2) {
      // Inventory was reserved - release
      await this.inventoryService.release(saga.data.orderId);
    }

    if (completedSteps >= 1) {
      // Order was created - cancel
      await this.orderService.cancel(saga.data.orderId);
    }

    await this.sagaRepository.updateStatus(saga.id, 'COMPENSATED');
  }
}

// Services expose simple command interfaces
class InventoryService {
  async reserve(orderId: string, items: Item[]): Promise<void> {
    // Reserve inventory - throws on failure
    for (const item of items) {
      await this.stockRepository.reserve(item.productId, item.quantity, orderId);
    }
  }

  async release(orderId: string): Promise<void> {
    // Release reserved inventory
    await this.stockRepository.releaseByOrderId(orderId);
  }
}
```

---

## Comparison

```
┌─────────────────────────────────────────────────────────────┐
│              COMPARISON                                      │
│                                                              │
│  Aspect              Choreography      Orchestration        │
│  ──────              ────────────      ─────────────        │
│  Coupling            Loose             Tighter              │
│  Complexity          Distributed       Centralized          │
│  Single point fail   No                Yes (orchestrator)   │
│  Visibility          Harder            Easier               │
│  Adding steps        Easy              Modify orchestrator  │
│  Testing             Harder            Easier               │
│  Debugging           Harder            Easier               │
│  Scalability         Better            Good                 │
│                                                              │
│  Best for:                                                  │
│  Choreography: Simple sagas, few steps, loose coupling     │
│  Orchestration: Complex sagas, many steps, need visibility │
└─────────────────────────────────────────────────────────────┘
```

---

## Choreography: Pros and Cons

```
┌─────────────────────────────────────────────────────────────┐
│              CHOREOGRAPHY                                    │
│                                                              │
│  PROS:                                                      │
│  ─────                                                      │
│  ✓ Loose coupling - services don't know each other         │
│  ✓ No single point of failure                              │
│  ✓ Easy to add new subscribers                             │
│  ✓ Better scalability                                      │
│  ✓ Simple for small sagas                                  │
│                                                              │
│  CONS:                                                      │
│  ─────                                                      │
│  ✗ Hard to understand overall flow                         │
│  ✗ Cyclic dependencies possible                            │
│  ✗ Difficult to track saga state                           │
│  ✗ Testing requires all services                           │
│  ✗ Can become spaghetti with many events                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Orchestration: Pros and Cons

```
┌─────────────────────────────────────────────────────────────┐
│              ORCHESTRATION                                   │
│                                                              │
│  PROS:                                                      │
│  ─────                                                      │
│  ✓ Clear flow - easy to understand                         │
│  ✓ Centralized saga state                                  │
│  ✓ Easier to test and debug                                │
│  ✓ No cyclic dependencies                                  │
│  ✓ Better for complex sagas                                │
│                                                              │
│  CONS:                                                      │
│  ─────                                                      │
│  ✗ Orchestrator is single point of failure                 │
│  ✗ Tighter coupling to orchestrator                        │
│  ✗ Orchestrator can become complex                         │
│  ✗ Risk of too much logic in orchestrator                  │
│  ✗ Must maintain orchestrator                              │
└─────────────────────────────────────────────────────────────┘
```

---

## When to Use Each

```
┌─────────────────────────────────────────────────────────────┐
│              DECISION GUIDE                                  │
│                                                              │
│  Use CHOREOGRAPHY when:                                     │
│  • Saga has 2-4 simple steps                                │
│  • Services are truly independent                           │
│  • Team prefers event-driven design                         │
│  • Need maximum decoupling                                  │
│  • Simple compensation logic                                │
│                                                              │
│  Use ORCHESTRATION when:                                    │
│  • Saga has many steps (5+)                                 │
│  • Complex business logic                                   │
│  • Need clear visibility of saga state                      │
│  • Complex compensation logic                               │
│  • Regulatory/audit requirements                            │
│  • Team prefers explicit control flow                       │
│                                                              │
│  Hybrid approach:                                           │
│  • Orchestration for complex sagas                          │
│  • Choreography for simple notifications                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Choreography**: Decentralized, event-driven, loose coupling
2. **Orchestration**: Centralized control, clear flow, easier debugging
3. **Choreography best for**: Simple sagas, few steps
4. **Orchestration best for**: Complex sagas, many steps, visibility needs
5. **Hybrid approach** often works best in practice

---

## What's Next?

In the next lesson, we will explore compensation transactions in detail.

---
