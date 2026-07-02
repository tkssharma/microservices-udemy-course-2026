import amqp, { Channel, Connection } from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
let channel: Channel;

const payments: Map<string, { orderId: string; amount: number; status: string }> = new Map();

async function setup() {
  const conn: Connection = await amqp.connect(RABBITMQ_URL);
  channel = await conn.createChannel();

  await channel.assertExchange('saga', 'topic', { durable: true });
  const q = await channel.assertQueue('payment-events', { durable: true });

  await channel.bindQueue(q.queue, 'saga', 'order.created');
  await channel.bindQueue(q.queue, 'saga', 'order.compensate');

  channel.consume(q.queue, async (msg) => {
    if (!msg) return;
    const event = JSON.parse(msg.content.toString());
    await handleEvent(event, msg.fields.routingKey);
    channel.ack(msg);
  });

  console.log('Payment Service: Listening for order events');
}

async function handleEvent(event: { orderId: string; total?: number; action?: string }, routingKey: string) {
  if (routingKey === 'order.created') {
    console.log(`💳 Processing payment for order ${event.orderId}`);

    // Simulate payment processing
    await new Promise((r) => setTimeout(r, 1000));

    // Simulate 80% success rate
    const success = Math.random() > 0.2;

    if (success) {
      payments.set(event.orderId, {
        orderId: event.orderId,
        amount: event.total || 0,
        status: 'completed',
      });
      publishEvent('payment.success', { type: 'PAYMENT_SUCCESS', orderId: event.orderId });
    } else {
      publishEvent('payment.failed', { type: 'PAYMENT_FAILED', orderId: event.orderId });
    }
  }

  if (routingKey === 'order.compensate' && event.action === 'refund') {
    console.log(`💸 Refunding payment for order ${event.orderId}`);
    const payment = payments.get(event.orderId);
    if (payment) {
      payment.status = 'refunded';
      console.log(`✅ Refund completed for order ${event.orderId}`);
    }
  }
}

function publishEvent(routingKey: string, payload: object) {
  channel.publish('saga', routingKey, Buffer.from(JSON.stringify(payload)));
  console.log(`Published: ${routingKey}`);
}

setup();
