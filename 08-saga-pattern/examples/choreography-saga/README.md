# Choreography Saga Pattern

Distributed transaction using event-based choreography with compensation.

## Flow

```
Order Created → Payment Service → Inventory Service
                     ↓                    ↓
              Payment Success      Inventory Reserved → Order Completed
              Payment Failed       Inventory Failed → Compensate (Refund)
```

## Services

- **order-service** (port 3000): Orchestrates order lifecycle
- **payment-service**: Processes payments, handles refunds
- **inventory-service**: Reserves stock

## Run

```bash
# Start RabbitMQ
docker-compose up -d

# Terminal 1 - Order service
cd order-service && npm install && npm run dev

# Terminal 2 - Payment service
cd payment-service && npm install && npm run dev

# Terminal 3 - Inventory service
cd inventory-service && npm install && npm run dev
```

## Test

```bash
# Create order (triggers saga)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-1", "items": ["item-1"], "total": 99}'

# Check order status
curl http://localhost:3000/orders/order-<id>
```

## Watch the Saga

The services will log their participation in the saga. If inventory fails, you'll see the payment service process a refund (compensation).

## Key Points

- **No central coordinator**: Services react to events
- **Compensation**: Failed steps trigger rollback actions
- **Eventual consistency**: Order status updates asynchronously
