import express, { Request, Response } from 'express';
import Redis from 'ioredis';

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface Event {
  type: string;
  aggregateId: string;
  payload: unknown;
  timestamp: string;
  version: number;
}

// Event store (append-only)
const eventStore: Event[] = [];

async function appendEvent(event: Event): Promise<void> {
  eventStore.push(event);
  // Publish event for read model to update
  await redis.publish('events', JSON.stringify(event));
  console.log(`Event stored: ${event.type} for ${event.aggregateId}`);
}

// Command: Create Product
app.post('/commands/create-product', async (req: Request, res: Response) => {
  const { id, name, price, stock } = req.body;

  const event: Event = {
    type: 'PRODUCT_CREATED',
    aggregateId: id,
    payload: { name, price, stock },
    timestamp: new Date().toISOString(),
    version: 1,
  };

  await appendEvent(event);
  res.status(202).json({ message: 'Command accepted', eventId: event.aggregateId });
});

// Command: Update Stock
app.post('/commands/update-stock', async (req: Request, res: Response) => {
  const { productId, quantity, operation } = req.body;

  const existingEvents = eventStore.filter((e) => e.aggregateId === productId);
  const version = existingEvents.length + 1;

  const event: Event = {
    type: operation === 'add' ? 'STOCK_ADDED' : 'STOCK_REMOVED',
    aggregateId: productId,
    payload: { quantity },
    timestamp: new Date().toISOString(),
    version,
  };

  await appendEvent(event);
  res.status(202).json({ message: 'Command accepted' });
});

// Get event stream for an aggregate (for debugging)
app.get('/events/:aggregateId', (req: Request, res: Response) => {
  const events = eventStore.filter((e) => e.aggregateId === req.params.aggregateId);
  res.json(events);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Write Service (Commands) on port ${PORT}`);
});
