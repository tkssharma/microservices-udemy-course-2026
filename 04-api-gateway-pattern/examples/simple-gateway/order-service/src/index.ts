import express, { Request, Response } from 'express';

const app = express();
app.use(express.json());

const orders = [
  { id: '1', userId: '1', product: 'Laptop', amount: 999 },
  { id: '2', userId: '2', product: 'Phone', amount: 599 },
];

app.get('/', (_req: Request, res: Response) => {
  res.json(orders);
});

app.get('/:id', (req: Request, res: Response) => {
  const order = orders.find((o) => o.id === req.params.id);
  order ? res.json(order) : res.status(404).json({ error: 'Order not found' });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Order Service on port ${PORT}`));
