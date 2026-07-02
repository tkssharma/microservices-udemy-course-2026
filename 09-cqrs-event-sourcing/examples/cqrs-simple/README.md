# CQRS + Event Sourcing Example

Command Query Responsibility Segregation with simple event sourcing.

## Architecture

```
                    ┌─────────────────┐
   POST /commands/* │  Write Service  │ ──▶ Event Store
                    │   (Commands)    │        │
                    └─────────────────┘        │ publish
                                               ▼
                    ┌─────────────────┐    ┌───────┐
   GET /products/*  │  Read Service   │ ◀──│ Redis │
                    │   (Queries)     │    │ PubSub│
                    └─────────────────┘    └───────┘
```

## Services

- **write-service** (port 3001): Handles commands, stores events
- **read-service** (port 3002): Handles queries, projects read model

## Run

```bash
# Start Redis
docker-compose up -d

# Terminal 1 - Read service (start first to catch events)
cd read-service && npm install && npm run dev

# Terminal 2 - Write service
cd write-service && npm install && npm run dev
```

## Test

```bash
# Command: Create product
curl -X POST http://localhost:3001/commands/create-product \
  -H "Content-Type: application/json" \
  -d '{"id": "prod-1", "name": "Laptop", "price": 999, "stock": 50}'

# Command: Update stock
curl -X POST http://localhost:3001/commands/update-stock \
  -H "Content-Type: application/json" \
  -d '{"productId": "prod-1", "quantity": 10, "operation": "remove"}'

# Query: Get all products (from read model)
curl http://localhost:3002/products

# Query: Get single product
curl http://localhost:3002/products/prod-1

# Query: Low stock products
curl http://localhost:3002/products/filter/low-stock

# Debug: View event stream
curl http://localhost:3001/events/prod-1
```

## Key Points

- **Separate models**: Write model (events) vs Read model (projections)
- **Event sourcing**: State derived from event stream
- **Eventual consistency**: Read model updates asynchronously
- **Scale independently**: Read service can be scaled for heavy reads
