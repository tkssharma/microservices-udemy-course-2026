import express, { Request, Response } from 'express';
import amqp, { Connection, Channel } from 'amqplib';

const app = express();
app.use(express.json());

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE_NAME = 'order_events';

let channel: Channel;

async function connectRabbitMQ(): Promise<void> {
  const connection: Connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  console.log('Connected to RabbitMQ');
}

interface OrderRequest {
  productId: string;
  quantity: number;
}

app.post('/orders', async (req: Request, res: Response) => {
  const { productId, quantity }: OrderRequest = req.body;

  const order = {
    id: `order-${Date.now()}`,
    productId,
    quantity,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  // Publish event asynchronously - don't wait for processing
  const event = {
    type: 'ORDER_CREATED',
    payload: order,
  };

  channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(event)), {
    persistent: true,
  });

  console.log(`Published ORDER_CREATED event for ${order.id}`);

  // Return immediately - order will be processed asynchronously
  res.status(202).json({
    message: 'Order received and queued for processing',
    order,
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'order-service-async' });
});

const PORT = process.env.PORT || 3000;

connectRabbitMQ().then(() => {
  app.listen(PORT, () => {
    console.log(`Order Service (Async) running on port ${PORT}`);
  });
});
