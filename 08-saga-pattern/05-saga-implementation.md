# Lesson 8.5: Saga Implementation

## Introduction

This lesson brings together all the concepts we've learned to build a complete saga implementation using the orchestration approach with Express and TypeScript.

---

## Project Structure

```
saga-orchestrator/
├── src/
│   ├── sagas/
│   │   ├── saga.interface.ts
│   │   ├── saga-orchestrator.ts
│   │   └── order-saga.ts
│   ├── services/
│   │   ├── order.service.ts
│   │   ├── inventory.service.ts
│   │   └── payment.service.ts
│   ├── repositories/
│   │   └── saga.repository.ts
│   └── app.ts
├── package.json
└── docker-compose.yml
```

---

## Saga Interface

```typescript
// src/sagas/saga.interface.ts

export type SagaStatus = 'STARTED' | 'EXECUTING' | 'COMPLETED' | 'COMPENSATING' | 'COMPENSATED' | 'FAILED';

export type StepStatus = 'PENDING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'COMPENSATING' | 'COMPENSATED';

export interface SagaStep<TContext> {
  name: string;
  execute: (context: TContext) => Promise<void>;
  compensate: (context: TContext) => Promise<void>;
}

export interface SagaState {
  id: string;
  type: string;
  status: SagaStatus;
  context: Record<string, unknown>;
  currentStep: number;
  steps: {
    name: string;
    status: StepStatus;
    error?: string;
    completedAt?: Date;
  }[];
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface SagaResult<T = unknown> {
  success: boolean;
  sagaId: string;
  data?: T;
  error?: string;
}
```

---

## Saga Repository

```typescript
// src/repositories/saga.repository.ts

import { Pool } from 'pg';
import { SagaState, SagaStatus, StepStatus } from '../sagas/saga.interface';

export class SagaRepository {
  constructor(private pool: Pool) {}

  async create(saga: Omit<SagaState, 'startedAt'>): Promise<SagaState> {
    const result = await this.pool.query(
      `INSERT INTO sagas (id, type, status, context, current_step, steps, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [saga.id, saga.type, saga.status, JSON.stringify(saga.context), saga.currentStep, JSON.stringify(saga.steps)],
    );
    return this.mapRow(result.rows[0]);
  }

  async findById(id: string): Promise<SagaState | null> {
    const result = await this.pool.query('SELECT * FROM sagas WHERE id = $1', [id]);
    return result.rows[0] ? this.mapRow(result.rows[0]) : null;
  }

  async updateStatus(id: string, status: SagaStatus, error?: string): Promise<void> {
    await this.pool.query(
      `UPDATE sagas 
       SET status = $2, error = $3, completed_at = CASE WHEN $2 IN ('COMPLETED', 'COMPENSATED', 'FAILED') THEN NOW() ELSE NULL END
       WHERE id = $1`,
      [id, status, error],
    );
  }

  async updateStep(sagaId: string, stepIndex: number, status: StepStatus, error?: string): Promise<void> {
    const saga = await this.findById(sagaId);
    if (!saga) throw new Error('Saga not found');

    saga.steps[stepIndex].status = status;
    saga.steps[stepIndex].error = error;
    if (status === 'COMPLETED' || status === 'COMPENSATED') {
      saga.steps[stepIndex].completedAt = new Date();
    }

    await this.pool.query(`UPDATE sagas SET steps = $2, current_step = $3 WHERE id = $1`, [
      sagaId,
      JSON.stringify(saga.steps),
      stepIndex,
    ]);
  }

  async updateContext(sagaId: string, context: Record<string, unknown>): Promise<void> {
    await this.pool.query(`UPDATE sagas SET context = $2 WHERE id = $1`, [sagaId, JSON.stringify(context)]);
  }

  private mapRow(row: any): SagaState {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      context: row.context,
      currentStep: row.current_step,
      steps: row.steps,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      error: row.error,
    };
  }
}
```

---

## Saga Orchestrator

```typescript
// src/sagas/saga-orchestrator.ts

import { v4 as uuid } from 'uuid';
import { SagaRepository } from '../repositories/saga.repository';
import { SagaStep, SagaState, SagaResult, SagaStatus } from './saga.interface';

export abstract class SagaOrchestrator<TContext extends Record<string, unknown>> {
  protected abstract sagaType: string;
  protected abstract steps: SagaStep<TContext>[];

  constructor(protected sagaRepository: SagaRepository) {}

  async execute(initialContext: TContext): Promise<SagaResult> {
    const sagaId = uuid();

    // Create saga record
    const saga = await this.sagaRepository.create({
      id: sagaId,
      type: this.sagaType,
      status: 'STARTED',
      context: initialContext,
      currentStep: 0,
      steps: this.steps.map((step) => ({
        name: step.name,
        status: 'PENDING',
      })),
    });

    const context = { ...initialContext } as TContext;

    try {
      await this.sagaRepository.updateStatus(sagaId, 'EXECUTING');

      // Execute each step
      for (let i = 0; i < this.steps.length; i++) {
        const step = this.steps[i];

        await this.sagaRepository.updateStep(sagaId, i, 'EXECUTING');

        try {
          await step.execute(context);
          await this.sagaRepository.updateStep(sagaId, i, 'COMPLETED');
          await this.sagaRepository.updateContext(sagaId, context);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.sagaRepository.updateStep(sagaId, i, 'FAILED', errorMessage);
          throw error;
        }
      }

      await this.sagaRepository.updateStatus(sagaId, 'COMPLETED');

      return {
        success: true,
        sagaId,
        data: context,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Start compensation
      await this.compensate(sagaId, context);

      return {
        success: false,
        sagaId,
        error: errorMessage,
      };
    }
  }

  private async compensate(sagaId: string, context: TContext): Promise<void> {
    await this.sagaRepository.updateStatus(sagaId, 'COMPENSATING');

    const saga = await this.sagaRepository.findById(sagaId);
    if (!saga) return;

    // Find completed steps to compensate (in reverse order)
    const completedSteps = saga.steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => step.status === 'COMPLETED')
      .reverse();

    for (const { index } of completedSteps) {
      const step = this.steps[index];

      await this.sagaRepository.updateStep(sagaId, index, 'COMPENSATING');

      try {
        await this.retryWithBackoff(() => step.compensate(context), 3);
        await this.sagaRepository.updateStep(sagaId, index, 'COMPENSATED');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Compensation failed for step ${step.name}:`, errorMessage);
        // Continue compensating other steps
      }
    }

    await this.sagaRepository.updateStatus(sagaId, 'COMPENSATED');
  }

  private async retryWithBackoff(fn: () => Promise<void>, maxRetries: number): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await fn();
        return;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        await this.sleep(Math.pow(2, i) * 1000);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

## Order Saga Implementation

```typescript
// src/sagas/order-saga.ts

import { SagaOrchestrator } from './saga-orchestrator';
import { SagaStep } from './saga.interface';
import { SagaRepository } from '../repositories/saga.repository';
import { OrderService } from '../services/order.service';
import { InventoryService } from '../services/inventory.service';
import { PaymentService } from '../services/payment.service';

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

interface OrderContext {
  userId: string;
  items: OrderItem[];
  total: number;
  orderId?: string;
  reservationId?: string;
  paymentId?: string;
}

export class OrderSaga extends SagaOrchestrator<OrderContext> {
  protected sagaType = 'CREATE_ORDER';
  protected steps: SagaStep<OrderContext>[];

  constructor(
    sagaRepository: SagaRepository,
    private orderService: OrderService,
    private inventoryService: InventoryService,
    private paymentService: PaymentService,
  ) {
    super(sagaRepository);
    this.steps = this.defineSteps();
  }

  private defineSteps(): SagaStep<OrderContext>[] {
    return [
      {
        name: 'Create Order',
        execute: async (ctx) => {
          const order = await this.orderService.create({
            userId: ctx.userId,
            items: ctx.items,
            total: ctx.total,
            status: 'PENDING',
          });
          ctx.orderId = order.id;
        },
        compensate: async (ctx) => {
          if (ctx.orderId) {
            await this.orderService.cancel(ctx.orderId);
          }
        },
      },
      {
        name: 'Reserve Inventory',
        execute: async (ctx) => {
          const reservation = await this.inventoryService.reserve(ctx.orderId!, ctx.items);
          ctx.reservationId = reservation.id;
        },
        compensate: async (ctx) => {
          if (ctx.reservationId) {
            await this.inventoryService.release(ctx.reservationId);
          }
        },
      },
      {
        name: 'Process Payment',
        execute: async (ctx) => {
          const payment = await this.paymentService.charge({
            orderId: ctx.orderId!,
            userId: ctx.userId,
            amount: ctx.total,
          });
          ctx.paymentId = payment.id;
        },
        compensate: async (ctx) => {
          if (ctx.paymentId) {
            await this.paymentService.refund(ctx.paymentId);
          }
        },
      },
      {
        name: 'Confirm Order',
        execute: async (ctx) => {
          await this.orderService.confirm(ctx.orderId!);
        },
        compensate: async (ctx) => {
          // No compensation needed - previous steps handle it
        },
      },
    ];
  }
}
```

---

## Services

```typescript
// src/services/order.service.ts

export interface Order {
  id: string;
  userId: string;
  items: { productId: string; quantity: number; price: number }[];
  total: number;
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED';
}

export class OrderService {
  async create(data: Omit<Order, 'id'>): Promise<Order> {
    // Create order in database
    const order: Order = {
      id: `ord_${Date.now()}`,
      ...data,
    };
    console.log('Order created:', order.id);
    return order;
  }

  async confirm(orderId: string): Promise<void> {
    // Update order status to CONFIRMED
    console.log('Order confirmed:', orderId);
  }

  async cancel(orderId: string): Promise<void> {
    // Update order status to CANCELLED
    console.log('Order cancelled:', orderId);
  }
}

// src/services/inventory.service.ts

export interface Reservation {
  id: string;
  orderId: string;
  items: { productId: string; quantity: number }[];
  status: 'RESERVED' | 'RELEASED';
}

export class InventoryService {
  async reserve(orderId: string, items: { productId: string; quantity: number }[]): Promise<Reservation> {
    // Check and reserve inventory
    // Throws if insufficient stock
    const reservation: Reservation = {
      id: `res_${Date.now()}`,
      orderId,
      items,
      status: 'RESERVED',
    };
    console.log('Inventory reserved:', reservation.id);
    return reservation;
  }

  async release(reservationId: string): Promise<void> {
    // Release reserved inventory
    console.log('Inventory released:', reservationId);
  }
}

// src/services/payment.service.ts

export interface Payment {
  id: string;
  orderId: string;
  userId: string;
  amount: number;
  status: 'COMPLETED' | 'REFUNDED';
}

export class PaymentService {
  async charge(data: { orderId: string; userId: string; amount: number }): Promise<Payment> {
    // Process payment
    // Throws if payment fails
    const payment: Payment = {
      id: `pay_${Date.now()}`,
      ...data,
      status: 'COMPLETED',
    };
    console.log('Payment processed:', payment.id);
    return payment;
  }

  async refund(paymentId: string): Promise<void> {
    // Refund payment
    console.log('Payment refunded:', paymentId);
  }
}
```

---

## API Endpoint

```typescript
// src/app.ts

import express from 'express';
import { Pool } from 'pg';
import { OrderSaga } from './sagas/order-saga';
import { SagaRepository } from './repositories/saga.repository';
import { OrderService } from './services/order.service';
import { InventoryService } from './services/inventory.service';
import { PaymentService } from './services/payment.service';

const app = express();
app.use(express.json());

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sagaRepository = new SagaRepository(pool);
const orderService = new OrderService();
const inventoryService = new InventoryService();
const paymentService = new PaymentService();

const orderSaga = new OrderSaga(sagaRepository, orderService, inventoryService, paymentService);

// Create order endpoint
app.post('/orders', async (req, res) => {
  const { userId, items } = req.body;

  const total = items.reduce((sum: number, item: any) => sum + item.price * item.quantity, 0);

  const result = await orderSaga.execute({ userId, items, total });

  if (result.success) {
    res.status(201).json({
      message: 'Order created successfully',
      sagaId: result.sagaId,
      orderId: (result.data as any).orderId,
    });
  } else {
    res.status(400).json({
      message: 'Order creation failed',
      sagaId: result.sagaId,
      error: result.error,
    });
  }
});

// Get saga status
app.get('/sagas/:id', async (req, res) => {
  const saga = await sagaRepository.findById(req.params.id);

  if (!saga) {
    return res.status(404).json({ error: 'Saga not found' });
  }

  res.json(saga);
});

app.listen(3000, () => {
  console.log('Saga orchestrator running on port 3000');
});
```

---

## Database Schema

```sql
-- migrations/001_create_sagas_table.sql

CREATE TABLE sagas (
  id UUID PRIMARY KEY,
  type VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL,
  context JSONB NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  steps JSONB NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  error TEXT
);

CREATE INDEX idx_sagas_status ON sagas(status);
CREATE INDEX idx_sagas_type ON sagas(type);
```

---

## Key Takeaways

1. **Saga orchestrator** manages the flow and state
2. **Each step** has execute and compensate functions
3. **Context** carries data between steps
4. **Compensation** runs in reverse order on failure
5. **Retry with backoff** for resilient compensation
6. **Persist saga state** for recovery and debugging

---

## Module Summary

In this module, you learned:

- Why distributed transactions are problematic
- The Saga pattern for eventual consistency
- Choreography vs orchestration approaches
- Designing compensation transactions
- Implementing a complete saga orchestrator

---

## What's Next?

In the next module, we will explore CQRS and Event Sourcing patterns.

---
