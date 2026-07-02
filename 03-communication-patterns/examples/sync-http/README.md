# Synchronous HTTP Communication Example

Demonstrates synchronous request-response pattern between two microservices.

## Services

- **order-service** (port 3000): Creates orders, calls inventory-service synchronously
- **inventory-service** (port 3001): Manages product stock

## Run

```bash
# Terminal 1 - Start inventory service
cd inventory-service
npm install
npm run dev

# Terminal 2 - Start order service
cd order-service
npm install
npm run dev
```

## Test

```bash
# Check inventory
curl http://localhost:3001/inventory/product-1

# Create order (sync call to inventory)
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"productId": "product-1", "quantity": 5}'
```

## Key Points

- Order service **waits** for inventory service response
- If inventory service is slow/down, order service is blocked
- Tight coupling between services
