import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

interface DomainEvent {
  type: string;
  payload: unknown;
  timestamp: string;
  correlationId: string;
}

type EventHandler = (event: DomainEvent) => Promise<void>;

const handlers: Record<string, EventHandler[]> = {
  ORDER_CREATED: [
    async (event) => {
      console.log('📦 Inventory: Reserving stock for order', event.payload);
    },
    async (event) => {
      console.log('📧 Notification: Sending order confirmation', event.payload);
    },
  ],
  ORDER_PAID: [
    async (event) => {
      console.log('🚚 Shipping: Preparing shipment for', event.payload);
    },
    async (event) => {
      console.log('📧 Notification: Payment received', event.payload);
    },
  ],
};

redis.subscribe('orders', (err) => {
  if (err) {
    console.error('Failed to subscribe:', err);
    return;
  }
  console.log('Subscribed to "orders" channel');
});

redis.on('message', async (channel, message) => {
  const event: DomainEvent = JSON.parse(message);
  console.log(`\n[${channel}] Received: ${event.type}`);

  const eventHandlers = handlers[event.type] || [];
  for (const handler of eventHandlers) {
    await handler(event);
  }
});

console.log('Subscriber Service started. Waiting for events...');
