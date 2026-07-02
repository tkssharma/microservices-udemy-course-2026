# Pub/Sub Pattern with Redis

Event-driven communication using Redis Pub/Sub.

## Services

- **publisher** (port 3000): Publishes domain events
- **subscriber**: Consumes and handles events

## Run

```bash
# Start Redis
docker-compose up -d

# Terminal 1 - Start subscriber (start first to see events)
cd subscriber && npm install && npm run dev

# Terminal 2 - Start publisher
cd publisher && npm install && npm run dev
```

## Test

```bash
# Create order (triggers ORDER_CREATED event)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-1", "items": ["item-1"], "total": 99}'

# Pay order (triggers ORDER_PAID event)
curl -X POST http://localhost:3000/orders/order-123/pay
```

## Watch Subscriber Output

```
[orders] Received: ORDER_CREATED
📦 Inventory: Reserving stock for order {...}
📧 Notification: Sending order confirmation {...}
```

## Key Points

- **Fire and forget**: Publisher doesn't wait for handlers
- **Multiple subscribers**: Same event triggers multiple handlers
- **Loose coupling**: Publisher doesn't know about subscribers
- **Note**: Redis Pub/Sub doesn't persist messages (use Streams for durability)
