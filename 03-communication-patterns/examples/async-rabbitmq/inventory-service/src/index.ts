import express, { Request, Response } from 'express';
import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';

const app = express();
app.use(express.json());

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
const QUEUE_NAME = 'order_events';

// In-memory inventory
const inventory: Record<string, number> = {
  'product-1': 100,
  'product-2': 50,
  'product-3': 25,
};

interface OrderEvent {
  type: string;
  payload: {
    id: string;
    productId: string;
    quantity: number;
  };
}

async function processOrder(event: OrderEvent): Promise<void> {
  const { id, productId, quantity } = event.payload;

  console.log(`Processing order ${id} for ${quantity}x ${productId}`);

  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 1000));

  if (inventory[productId] && inventory[productId] >= quantity) {
    inventory[productId] -= quantity;
    console.log(`✅ Order ${id} processed. Stock remaining: ${inventory[productId]}`);
  } else {
    console.log(`❌ Order ${id} failed - insufficient stock`);
  }
}

async function connectRabbitMQ(): Promise<void> {
  const connection: Connection = await amqp.connect(RABBITMQ_URL);
  const channel: Channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });

  console.log('Waiting for messages in queue:', QUEUE_NAME);

  channel.consume(QUEUE_NAME, async (msg: ConsumeMessage | null) => {
    if (msg) {
      const event: OrderEvent = JSON.parse(msg.content.toString());
      await processOrder(event);
      channel.ack(msg);
    }
  });
}

app.get('/inventory', (_req: Request, res: Response) => {
  res.json(inventory);
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'inventory-service-async' });
});

const PORT = process.env.PORT || 3001;

connectRabbitMQ().then(() => {
  app.listen(PORT, () => {
    console.log(`Inventory Service (Async) running on port ${PORT}`);
  });
});
