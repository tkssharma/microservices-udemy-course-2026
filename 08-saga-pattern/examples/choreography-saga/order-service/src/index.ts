import express, { Request, Response } from 'express';
import amqp, { Channel, Connection } from 'amqplib';

const app = express();
app.use(express.json());

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
let channel: Channel;

interface Order {
  id: string;
  userId: string;
  items: string[];
  total: number;
  status: string;
}

const orders: Map<string, Order> = new Map();

async function setupRabbitMQ() {
  const conn: Connection = await amqp.connect(RABBITMQ_URL);
  channel = await conn.createChannel();

  await channel.assertExchange('saga', 'topic', { durable: true });
  const q = await channel.assertQueue('order-events', { durable: true });

  // Listen for saga events
  await channel.bindQueue(q.queue, 'saga', 'payment.*');
  await channel.bindQueue(q.queue, 'saga', 'inventory.*');

  channel.consume(q.queue, (msg) => {
    if (!msg) return;
    const event = JSON.parse(msg.content.toString());
    handleSagaEvent(event);
    channel.ack(msg);
  });

  console.log('Order Service: Listening for saga events');
}

function handleSagaEvent(event: { type: string; orderId: string }) {
  const order = orders.get(event.orderId);
  if (!order) return;

  switch (event.type) {
    case 'PAYMENT_SUCCESS':
      console.log(`✅ Order ${order.id}: Payment successful`);
      order.status = 'paid';
      // Trigger next step
      publishEvent('order.paid', { orderId: order.id });
      break;

    case 'PAYMENT_FAILED':
      console.log(`❌ Order ${order.id}: Payment failed - cancelling`);
      order.status = 'cancelled';
      break;

    case 'INVENTORY_RESERVED':
      console.log(`✅ Order ${order.id}: Inventory reserved - completing`);
      order.status = 'completed';
      break;

    case 'INVENTORY_FAILED':
      console.log(`❌ Order ${order.id}: Inventory failed - compensating`);
      order.status = 'refunding';
      // Compensation: refund payment
      publishEvent('order.compensate', { orderId: order.id, action: 'refund' });
      break;
  }
}

function publishEvent(routingKey: string, payload: object) {
  channel.publish('saga', routingKey, Buffer.from(JSON.stringify(payload)));
  console.log(`Published: ${routingKey}`);
}

app.post('/orders', async (req: Request, res: Response) => {
  const { userId, items, total } = req.body;

  const order: Order = {
    id: `order-${Date.now()}`,
    userId,
    items,
    total,
    status: 'pending',
  };

  orders.set(order.id, order);

  // Start saga: publish order created event
  publishEvent('order.created', { orderId: order.id, userId, total });

  res.status(202).json({ message: 'Order saga started', order });
});

app.get('/orders/:id', (req: Request, res: Response) => {
  const order = orders.get(req.params.id);
  order ? res.json(order) : res.status(404).json({ error: 'Order not found' });
});

const PORT = process.env.PORT || 3000;
setupRabbitMQ().then(() => {
  app.listen(PORT, () => console.log(`Order Service on port ${PORT}`));
});
