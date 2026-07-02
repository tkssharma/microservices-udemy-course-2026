import express, { Request, Response } from 'express';
import Redis from 'ioredis';

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface DomainEvent {
  type: string;
  payload: unknown;
  timestamp: string;
  correlationId: string;
}

function createEvent(type: string, payload: unknown): DomainEvent {
  return {
    type,
    payload,
    timestamp: new Date().toISOString(),
    correlationId: `corr-${Date.now()}`,
  };
}

app.post('/orders', async (req: Request, res: Response) => {
  const { userId, items, total } = req.body;

  const order = {
    id: `order-${Date.now()}`,
    userId,
    items,
    total,
    status: 'created',
  };

  // Publish domain event
  const event = createEvent('ORDER_CREATED', order);
  await redis.publish('orders', JSON.stringify(event));

  console.log(`Published: ${event.type}`);
  res.status(201).json(order);
});

app.post('/orders/:id/pay', async (req: Request, res: Response) => {
  const { id } = req.params;

  const event = createEvent('ORDER_PAID', { orderId: id });
  await redis.publish('orders', JSON.stringify(event));

  console.log(`Published: ${event.type}`);
  res.json({ orderId: id, status: 'paid' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Publisher Service on port ${PORT}`);
});
