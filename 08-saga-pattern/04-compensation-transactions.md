# Lesson 8.4: Compensation Transactions

## Introduction

Compensation transactions are the "undo" operations in a saga. When a step fails, compensating transactions reverse the effects of previously completed steps to maintain data consistency.

---

## What is Compensation?

```
┌─────────────────────────────────────────────────────────────┐
│              COMPENSATION CONCEPT                            │
│                                                              │
│  Forward Transaction:                                       │
│  ────────────────────                                       │
│  The actual business operation                              │
│  Example: Reserve 5 items from inventory                    │
│                                                              │
│  Compensating Transaction:                                  │
│  ─────────────────────────                                  │
│  Semantically undoes the forward transaction                │
│  Example: Release 5 reserved items back to inventory        │
│                                                              │
│  Key Point:                                                 │
│  ──────────                                                 │
│  Compensation is NOT a database rollback!                   │
│  It's a new transaction that reverses the effect.           │
│                                                              │
│  Forward:     Stock: 100 → 95 (reserved 5)                  │
│  Compensate:  Stock: 95 → 100 (released 5)                  │
│               (Two separate transactions)                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Compensation Strategies

```
┌─────────────────────────────────────────────────────────────┐
│              COMPENSATION STRATEGIES                         │
│                                                              │
│  1. Perfect Compensation                                    │
│  ───────────────────────                                    │
│  Completely reverses the effect                             │
│  Example: Refund full payment                               │
│                                                              │
│  2. Partial Compensation                                    │
│  ─────────────────────                                      │
│  Partially reverses (when full reversal impossible)         │
│  Example: Refund minus processing fee                       │
│                                                              │
│  3. No Compensation Needed                                  │
│  ─────────────────────────                                  │
│  Action has no side effects to undo                         │
│  Example: Read-only validation step                         │
│                                                              │
│  4. Manual Compensation                                     │
│  ──────────────────────                                     │
│  Requires human intervention                                │
│  Example: Physical goods already shipped                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Designing Compensating Transactions

```
┌─────────────────────────────────────────────────────────────┐
│              COMPENSATION DESIGN                             │
│                                                              │
│  Step                    Compensation                       │
│  ────                    ────────────                       │
│  Create Order            Cancel Order                       │
│  Reserve Inventory       Release Inventory                  │
│  Charge Payment          Refund Payment                     │
│  Send Confirmation       Send Cancellation Email            │
│  Create Shipment         Cancel Shipment                    │
│  Deduct Loyalty Points   Restore Loyalty Points             │
│                                                              │
│  Difficult to Compensate:                                   │
│  ─────────────────────────                                  │
│  • Email sent            (Cannot unsend)                    │
│  • SMS sent              (Cannot unsend)                    │
│  • Physical shipment     (Need return process)              │
│  • External API call     (May not support undo)             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Example

```typescript
// Define compensation for each saga step
interface SagaStep<T> {
  name: string;
  execute: (context: T) => Promise<void>;
  compensate: (context: T) => Promise<void>;
}

// Order Saga with compensations
class OrderSaga {
  private steps: SagaStep<OrderContext>[] = [
    {
      name: 'Create Order',
      execute: async (ctx) => {
        ctx.order = await this.orderService.create({
          userId: ctx.userId,
          items: ctx.items,
          status: 'PENDING',
        });
      },
      compensate: async (ctx) => {
        await this.orderService.cancel(ctx.order.id);
      },
    },
    {
      name: 'Reserve Inventory',
      execute: async (ctx) => {
        ctx.reservation = await this.inventoryService.reserve(ctx.order.id, ctx.items);
      },
      compensate: async (ctx) => {
        await this.inventoryService.release(ctx.reservation.id);
      },
    },
    {
      name: 'Process Payment',
      execute: async (ctx) => {
        ctx.payment = await this.paymentService.charge(ctx.userId, ctx.order.total);
      },
      compensate: async (ctx) => {
        await this.paymentService.refund(ctx.payment.id);
      },
    },
    {
      name: 'Confirm Order',
      execute: async (ctx) => {
        await this.orderService.confirm(ctx.order.id);
      },
      compensate: async (ctx) => {
        // Last step - no compensation needed if this fails
        // Previous steps will be compensated
      },
    },
  ];

  async execute(userId: string, items: OrderItem[]): Promise<OrderResult> {
    const context: OrderContext = { userId, items };
    const completedSteps: number[] = [];

    try {
      for (let i = 0; i < this.steps.length; i++) {
        await this.steps[i].execute(context);
        completedSteps.push(i);
      }
      return { success: true, orderId: context.order.id };
    } catch (error) {
      // Compensate in reverse order
      await this.compensate(context, completedSteps);
      return { success: false, error: error.message };
    }
  }

  private async compensate(context: OrderContext, completedSteps: number[]): Promise<void> {
    // Reverse order
    for (let i = completedSteps.length - 1; i >= 0; i--) {
      const stepIndex = completedSteps[i];
      try {
        await this.steps[stepIndex].compensate(context);
      } catch (error) {
        // Log but continue compensating other steps
        console.error(`Compensation failed for step ${stepIndex}:`, error);
      }
    }
  }
}
```

---

## Handling Compensation Failures

```
┌─────────────────────────────────────────────────────────────┐
│              COMPENSATION FAILURE HANDLING                   │
│                                                              │
│  What if compensation fails?                                │
│                                                              │
│  1. Retry with Backoff                                      │
│  ─────────────────────                                      │
│  async compensateWithRetry(step, context, maxRetries = 3) { │
│    for (let i = 0; i < maxRetries; i++) {                   │
│      try {                                                  │
│        await step.compensate(context);                      │
│        return;                                              │
│      } catch (error) {                                      │
│        await sleep(Math.pow(2, i) * 1000);                  │
│      }                                                      │
│    }                                                        │
│    throw new CompensationFailedError(step.name);            │
│  }                                                          │
│                                                              │
│  2. Dead Letter Queue                                       │
│  ─────────────────────                                      │
│  Store failed compensations for manual review               │
│                                                              │
│  3. Alert Operations                                        │
│  ────────────────────                                       │
│  Notify team for manual intervention                        │
│                                                              │
│  4. Idempotent Compensations                                │
│  ───────────────────────────                                │
│  Design compensations to be safely retried                  │
└─────────────────────────────────────────────────────────────┘
```

### Idempotent Compensation

```typescript
class InventoryService {
  async release(reservationId: string): Promise<void> {
    // Idempotent: Check if already released
    const reservation = await this.reservationRepository.findById(reservationId);

    if (!reservation) {
      // Already released or never existed - success
      return;
    }

    if (reservation.status === 'RELEASED') {
      // Already compensated - success
      return;
    }

    // Perform release
    await this.reservationRepository.update(reservationId, {
      status: 'RELEASED',
      releasedAt: new Date(),
    });

    await this.stockRepository.increment(reservation.productId, reservation.quantity);
  }
}
```

---

## Semantic Compensation

Sometimes you can't truly undo an action. Use semantic compensation instead.

```
┌─────────────────────────────────────────────────────────────┐
│              SEMANTIC COMPENSATION                           │
│                                                              │
│  Email Sent:                                                │
│  ───────────                                                │
│  Cannot unsend email                                        │
│  Semantic: Send cancellation/correction email               │
│                                                              │
│  Shipment Created:                                          │
│  ─────────────────                                          │
│  Physical goods in transit                                  │
│  Semantic: Create return shipment, notify customer          │
│                                                              │
│  External API Called:                                       │
│  ────────────────────                                       │
│  Third party processed request                              │
│  Semantic: Call cancellation API if available               │
│            Or flag for manual reconciliation                │
│                                                              │
│  Points Awarded:                                            │
│  ───────────────                                            │
│  User already spent points                                  │
│  Semantic: Deduct from balance, allow negative              │
│            Or create debt record                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Compensation Order

```
┌─────────────────────────────────────────────────────────────┐
│              COMPENSATION ORDER                              │
│                                                              │
│  Forward:     T1 → T2 → T3 → T4 (FAIL)                      │
│  Compensate:  C3 ← C2 ← C1                                  │
│                                                              │
│  Why reverse order?                                         │
│  ──────────────────                                         │
│  • Later steps may depend on earlier steps                  │
│  • Undo in reverse maintains consistency                    │
│                                                              │
│  Example:                                                   │
│  ─────────                                                  │
│  T1: Create Order                                           │
│  T2: Reserve Inventory (references order)                   │
│  T3: Process Payment (references order)                     │
│                                                              │
│  If T3 fails:                                               │
│  C2: Release Inventory (still has order reference)          │
│  C1: Cancel Order (now safe, no references)                 │
│                                                              │
│  Wrong order would break referential integrity!             │
└─────────────────────────────────────────────────────────────┘
```

---

## Best Practices

```
┌─────────────────────────────────────────────────────────────┐
│              BEST PRACTICES                                  │
│                                                              │
│  1. Design Compensation Early                               │
│     Think about undo when designing the forward action      │
│                                                              │
│  2. Make Compensations Idempotent                           │
│     Safe to retry multiple times                            │
│                                                              │
│  3. Store Compensation Data                                 │
│     Save what's needed to undo (IDs, amounts, etc.)         │
│                                                              │
│  4. Handle Partial Failures                                 │
│     Continue compensating even if one fails                 │
│                                                              │
│  5. Log Everything                                          │
│     Audit trail for debugging and compliance                │
│                                                              │
│  6. Test Compensation Paths                                 │
│     Test failures at each step                              │
│                                                              │
│  7. Consider Timing                                         │
│     Some compensations have time limits                     │
│     (e.g., refund window)                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Compensation is not rollback** - it's a new transaction
2. **Design compensation with forward action** - think about undo early
3. **Make compensations idempotent** - safe to retry
4. **Compensate in reverse order** - maintain consistency
5. **Handle failures gracefully** - retry, log, alert
6. **Semantic compensation** for irreversible actions

---

## What's Next?

In the next lesson, we will implement a complete saga with all the concepts we've learned.

---
