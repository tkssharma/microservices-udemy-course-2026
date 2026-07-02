# Database Per Service Pattern

Each microservice owns its data with a dedicated database.

## Services

- **user-service** (port 3001): PostgreSQL for structured user data
- **order-service** (port 3002): MongoDB for flexible order documents

## Run

```bash
# Start databases
docker-compose up -d

# Terminal 1
cd user-service && npm install && npm run dev

# Terminal 2
cd order-service && npm install && npm run dev
```

## Test

```bash
# Create user (PostgreSQL)
curl -X POST http://localhost:3001/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John", "email": "john@example.com"}'

# Create order (MongoDB)
curl -X POST http://localhost:3002/orders \
  -H "Content-Type: application/json" \
  -d '{"userId": "1", "items": [{"product": "Laptop", "qty": 1}], "total": 999}'

# Get all
curl http://localhost:3001/users
curl http://localhost:3002/orders
```

## Key Points

- **Loose coupling**: Services can evolve independently
- **Right tool for the job**: PostgreSQL for users, MongoDB for orders
- **Data ownership**: Each service owns its schema
- **Trade-off**: Cross-service queries require API calls
