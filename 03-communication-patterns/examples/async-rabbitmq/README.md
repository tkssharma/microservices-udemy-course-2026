# Asynchronous RabbitMQ Communication Example

Demonstrates async event-based pattern using RabbitMQ message broker.

## Services

- **order-service** (port 3000): Publishes order events to queue
- **inventory-service** (port 3001): Consumes and processes order events

## Run

```bash
# Start RabbitMQ
docker-compose up -d

# Terminal 1 - Start inventory service (consumer)
cd inventory-service
npm install
npm run dev

# Terminal 2 - Start order service (producer)
cd order-service
npm install
npm run dev
```

## Test

```bash
# Create order (returns immediately with 202 Accepted)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"productId": "product-1", "quantity": 5}'

# Check inventory (processed asynchronously)
curl http://localhost:3001/inventory
```

## RabbitMQ Dashboard

Open http://localhost:15672 (guest/guest) to see queues and messages.

## Key Points

- Order service returns **immediately** (202 Accepted)
- Inventory service processes orders **when ready**
- Services are **decoupled** - can scale independently
- Messages are **persisted** in queue if consumer is down
