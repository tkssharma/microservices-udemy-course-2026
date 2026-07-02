import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

// In-memory inventory store
const inventory: Record<string, number> = {
  'product-1': 100,
  'product-2': 50,
  'product-3': 25,
};

app.get('/inventory/:productId', (req: Request, res: Response) => {
  const { productId } = req.params;
  const stock = inventory[productId] ?? 0;

  // Simulate some latency
  setTimeout(() => {
    res.json({ productId, stock });
  }, 100);
});

app.post('/inventory/reserve', (req: Request, res: Response) => {
  const { productId, quantity } = req.body;

  if (!inventory[productId] || inventory[productId] < quantity) {
    return res.status(400).json({ error: 'Cannot reserve stock' });
  }

  inventory[productId] -= quantity;
  res.json({ productId, reserved: quantity, remaining: inventory[productId] });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'inventory-service' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Inventory Service running on port ${PORT}`);
});
