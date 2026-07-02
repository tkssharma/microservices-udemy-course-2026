import express, { Request, Response } from 'express';
import Redis from 'ioredis';

const app = express();
app.use(express.json());

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const subscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  updatedAt: string;
}

// Read model (optimized for queries)
const readModel: Map<string, Product> = new Map();

interface Event {
  type: string;
  aggregateId: string;
  payload: { name?: string; price?: number; stock?: number; quantity?: number };
  timestamp: string;
}

// Project events into read model
function applyEvent(event: Event): void {
  const { type, aggregateId, payload, timestamp } = event;

  switch (type) {
    case 'PRODUCT_CREATED':
      readModel.set(aggregateId, {
        id: aggregateId,
        name: payload.name || '',
        price: payload.price || 0,
        stock: payload.stock || 0,
        updatedAt: timestamp,
      });
      console.log(`Read model: Created product ${aggregateId}`);
      break;

    case 'STOCK_ADDED':
      const productAdd = readModel.get(aggregateId);
      if (productAdd) {
        productAdd.stock += payload.quantity || 0;
        productAdd.updatedAt = timestamp;
        console.log(`Read model: Stock added to ${aggregateId}`);
      }
      break;

    case 'STOCK_REMOVED':
      const productRemove = readModel.get(aggregateId);
      if (productRemove) {
        productRemove.stock -= payload.quantity || 0;
        productRemove.updatedAt = timestamp;
        console.log(`Read model: Stock removed from ${aggregateId}`);
      }
      break;
  }
}

// Subscribe to events from write service
subscriber.subscribe('events');
subscriber.on('message', (_channel: string, message: string) => {
  const event: Event = JSON.parse(message);
  applyEvent(event);
});

// Query: Get all products
app.get('/products', (_req: Request, res: Response) => {
  res.json(Array.from(readModel.values()));
});

// Query: Get product by ID
app.get('/products/:id', (req: Request, res: Response) => {
  const product = readModel.get(req.params.id);
  product ? res.json(product) : res.status(404).json({ error: 'Product not found' });
});

// Query: Get low stock products
app.get('/products/filter/low-stock', (_req: Request, res: Response) => {
  const lowStock = Array.from(readModel.values()).filter((p) => p.stock < 10);
  res.json(lowStock);
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Read Service (Queries) on port ${PORT}`);
});
