import express, { Request, Response } from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const INVENTORY_SERVICE_URL = process.env.INVENTORY_URL || 'http://localhost:3001';

interface OrderRequest {
  productId: string;
  quantity: number;
}

app.post('/orders', async (req: Request, res: Response) => {
  const { productId, quantity }: OrderRequest = req.body;

  try {
    // Synchronous call to inventory service
    const inventoryResponse = await axios.get(
      `${INVENTORY_SERVICE_URL}/inventory/${productId}`
    );

    const { stock } = inventoryResponse.data;

    if (stock < quantity) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // Reserve stock (sync call)
    await axios.post(`${INVENTORY_SERVICE_URL}/inventory/reserve`, {
      productId,
      quantity,
    });

    const order = {
      id: `order-${Date.now()}`,
      productId,
      quantity,
      status: 'confirmed',
    };

    res.status(201).json(order);
  } catch (error) {
    console.error('Failed to process order:', error);
    res.status(500).json({ error: 'Order processing failed' });
  }
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'order-service' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});
