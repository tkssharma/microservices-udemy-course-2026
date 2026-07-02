import amqp, { Channel, Connection } from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
let channel: Channel;

const inventory: Record<string, number> = {
  'item-1': 10,
  'item-2': 5,
  'item-3': 0, // Out of stock - will trigger compensation
};

async function setup() {
  const conn: Connection = await amqp.connect(RABBITMQ_URL);
  channel = await conn.createChannel();

  await channel.assertExchange('saga', 'topic', { durable: true });
  const q = await channel.assertQueue('inventory-events', { durable: true });

  await channel.bindQueue(q.queue, 'saga', 'order.paid');

  channel.consume(q.queue, async (msg) => {
    if (!msg) return;
    const event = JSON.parse(msg.content.toString());
    await handleEvent(event);
    channel.ack(msg);
  });

  console.log('Inventory Service: Listening for paid orders');
}

async function handleEvent(event: { orderId: string }) {
  console.log(`📦 Reserving inventory for order ${event.orderId}`);

  // Simulate inventory check
  await new Promise((r) => setTimeout(r, 500));

  // Simulate: 70% have stock available
  const hasStock = Math.random() > 0.3;

  if (hasStock) {
    publishEvent('inventory.reserved', {
      type: 'INVENTORY_RESERVED',
      orderId: event.orderId,
    });
  } else {
    console.log(`❌ Out of stock for order ${event.orderId}`);
    publishEvent('inventory.failed', {
      type: 'INVENTORY_FAILED',
      orderId: event.orderId,
    });
  }
}

function publishEvent(routingKey: string, payload: object) {
  channel.publish('saga', routingKey, Buffer.from(JSON.stringify(payload)));
  console.log(`Published: ${routingKey}`);
}

setup();
