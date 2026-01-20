# Lesson 3.2: REST API Communication

## Introduction

REST (Representational State Transfer) is the most common communication pattern for microservices. This lesson covers best practices for designing and implementing REST APIs for service-to-service communication.

---

## REST Fundamentals

### Core Principles

```
┌─────────────────────────────────────────────────────────────┐
│                  REST PRINCIPLES                             │
│                                                              │
│  1. Stateless                                               │
│     Each request contains all information needed.           │
│     Server doesn't store client state.                      │
│                                                              │
│  2. Resource-Based                                          │
│     Everything is a resource with a unique URI.             │
│     /users/123, /orders/456, /products/789                  │
│                                                              │
│  3. HTTP Methods                                            │
│     GET = Read, POST = Create, PUT = Update,                │
│     PATCH = Partial Update, DELETE = Remove                 │
│                                                              │
│  4. Uniform Interface                                       │
│     Consistent API design across all resources.             │
│                                                              │
│  5. HATEOAS (optional)                                      │
│     Responses include links to related resources.           │
└─────────────────────────────────────────────────────────────┘
```

### HTTP Methods

```
┌─────────────────────────────────────────────────────────────┐
│                  HTTP METHODS                                │
│                                                              │
│  Method    Purpose           Idempotent    Safe             │
│  ──────    ───────           ──────────    ────             │
│  GET       Read resource     Yes           Yes              │
│  POST      Create resource   No            No               │
│  PUT       Replace resource  Yes           No               │
│  PATCH     Update partial    No            No               │
│  DELETE    Remove resource   Yes           No               │
│                                                              │
│  Idempotent: Same request = same result (safe to retry)    │
│  Safe: Doesn't modify state                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## API Design Best Practices

### URL Structure

```
┌─────────────────────────────────────────────────────────────┐
│                  URL DESIGN                                  │
│                                                              │
│  Good URLs:                                                 │
│  ──────────                                                 │
│  GET    /users                    List users                │
│  GET    /users/123                Get user 123              │
│  POST   /users                    Create user               │
│  PUT    /users/123                Update user 123           │
│  DELETE /users/123                Delete user 123           │
│                                                              │
│  GET    /users/123/orders         User's orders             │
│  GET    /orders/456/items         Order's items             │
│                                                              │
│  Bad URLs:                                                  │
│  ─────────                                                  │
│  GET    /getUser?id=123           ✗ Verb in URL            │
│  POST   /users/create             ✗ Action in URL          │
│  GET    /user/123                 ✗ Singular (use plural)  │
│  GET    /Users/123                ✗ Uppercase              │
└─────────────────────────────────────────────────────────────┘
```

### Query Parameters

```
┌─────────────────────────────────────────────────────────────┐
│                  QUERY PARAMETERS                            │
│                                                              │
│  Filtering:                                                 │
│  GET /products?category=electronics&inStock=true            │
│                                                              │
│  Sorting:                                                   │
│  GET /products?sort=price&order=asc                         │
│  GET /products?sort=-createdAt  (- for descending)          │
│                                                              │
│  Pagination:                                                │
│  GET /products?page=2&limit=20                              │
│  GET /products?offset=40&limit=20                           │
│                                                              │
│  Field Selection:                                           │
│  GET /products?fields=id,name,price                         │
│                                                              │
│  Search:                                                    │
│  GET /products?q=laptop                                     │
└─────────────────────────────────────────────────────────────┘
```

### Response Format

```
┌─────────────────────────────────────────────────────────────┐
│                  RESPONSE FORMAT                             │
│                                                              │
│  Single Resource:                                           │
│  ─────────────────                                          │
│  {                                                          │
│    "id": "123",                                             │
│    "name": "John Doe",                                      │
│    "email": "john@example.com",                             │
│    "createdAt": "2024-01-15T10:30:00Z"                      │
│  }                                                          │
│                                                              │
│  Collection:                                                │
│  ───────────                                                │
│  {                                                          │
│    "data": [                                                │
│      { "id": "1", "name": "Product 1" },                    │
│      { "id": "2", "name": "Product 2" }                     │
│    ],                                                       │
│    "pagination": {                                          │
│      "page": 1,                                             │
│      "limit": 20,                                           │
│      "total": 150,                                          │
│      "totalPages": 8                                        │
│    }                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## HTTP Status Codes

```
┌─────────────────────────────────────────────────────────────┐
│                  STATUS CODES                                │
│                                                              │
│  2xx Success:                                               │
│  ─────────────                                              │
│  200 OK              Request succeeded                      │
│  201 Created         Resource created                       │
│  204 No Content      Success, no body (DELETE)              │
│                                                              │
│  4xx Client Error:                                          │
│  ─────────────────                                          │
│  400 Bad Request     Invalid request body                   │
│  401 Unauthorized    Authentication required                │
│  403 Forbidden       Not allowed                            │
│  404 Not Found       Resource doesn't exist                 │
│  409 Conflict        Resource conflict                      │
│  422 Unprocessable   Validation failed                      │
│  429 Too Many Req    Rate limit exceeded                    │
│                                                              │
│  5xx Server Error:                                          │
│  ─────────────────                                          │
│  500 Internal Error  Server error                           │
│  502 Bad Gateway     Upstream service error                 │
│  503 Unavailable     Service temporarily down               │
│  504 Gateway Timeout Upstream timeout                       │
└─────────────────────────────────────────────────────────────┘
```

### Error Response Format

```typescript
// Consistent error response structure
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable code
    message: string;        // Human-readable message
    details?: any[];        // Validation errors, etc.
    requestId?: string;     // For debugging
  };
}

// Example error response
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request body",
    "details": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "age", "message": "Must be a positive number" }
    ],
    "requestId": "req-abc-123"
  }
}
```

---

## Express + TypeScript Implementation

### Project Structure

```
user-service/
├── src/
│   ├── index.ts
│   ├── routes/
│   │   └── user.routes.ts
│   ├── controllers/
│   │   └── user.controller.ts
│   ├── services/
│   │   └── user.service.ts
│   ├── middleware/
│   │   ├── error.middleware.ts
│   │   └── validation.middleware.ts
│   ├── dto/
│   │   └── user.dto.ts
│   └── types/
│       └── index.ts
├── package.json
└── tsconfig.json
```

### Main Application

```typescript
// src/index.ts
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { userRoutes } from './routes/user.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { requestLogger } from './middleware/logging.middleware';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/users', userRoutes);

// Error handling (must be last)
app.use(errorMiddleware);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`User service running on port ${PORT}`);
});
```

### Routes

```typescript
// src/routes/user.routes.ts
import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { validateBody } from '../middleware/validation.middleware';
import { CreateUserDTO, UpdateUserDTO } from '../dto/user.dto';

const router = Router();
const controller = new UserController();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', validateBody(CreateUserDTO), controller.create);
router.put('/:id', validateBody(UpdateUserDTO), controller.update);
router.delete('/:id', controller.delete);

export { router as userRoutes };
```

### Controller

```typescript
// src/controllers/user.controller.ts
import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { NotFoundError } from '../errors/not-found.error';

export class UserController {
  private userService = new UserService();

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.userService.findAll({
        page: Number(page),
        limit: Number(limit),
      });

      res.json({
        data: result.users,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.findById(req.params.id);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.create(req.body);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await this.userService.update(req.params.id, req.body);

      if (!user) {
        throw new NotFoundError('User not found');
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.userService.delete(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
```

### Error Middleware

```typescript
// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ValidationError extends AppError {
  constructor(public details: any[]) {
    super(422, 'VALIDATION_ERROR', 'Validation failed');
  }
}

export function errorMiddleware(error: Error, req: Request, res: Response, next: NextFunction) {
  console.error('Error:', {
    message: error.message,
    stack: error.stack,
    requestId: req.headers['x-request-id'],
  });

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: (error as ValidationError).details,
        requestId: req.headers['x-request-id'],
      },
    });
  }

  // Unknown error
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: req.headers['x-request-id'],
    },
  });
}
```

---

## Service-to-Service Communication

### HTTP Client Setup

```typescript
// src/clients/http-client.ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export function createHttpClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor - add correlation ID
  client.interceptors.request.use((config) => {
    config.headers['x-correlation-id'] = config.headers['x-correlation-id'] || generateCorrelationId();
    return config;
  });

  // Response interceptor - logging
  client.interceptors.response.use(
    (response) => {
      console.log(`HTTP ${response.status} ${response.config.url}`);
      return response;
    },
    (error) => {
      console.error(`HTTP Error: ${error.message}`, {
        url: error.config?.url,
        status: error.response?.status,
      });
      throw error;
    },
  );

  return client;
}

function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

### Service Client

```typescript
// src/clients/product-service.client.ts
import { createHttpClient } from './http-client';

interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export class ProductServiceClient {
  private client = createHttpClient(process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002');

  async getProduct(productId: string): Promise<Product> {
    const response = await this.client.get(`/api/products/${productId}`);
    return response.data;
  }

  async getProducts(productIds: string[]): Promise<Product[]> {
    const response = await this.client.get('/api/products', {
      params: { ids: productIds.join(',') },
    });
    return response.data.data;
  }

  async checkStock(productId: string, quantity: number): Promise<boolean> {
    const response = await this.client.get(`/api/products/${productId}/stock`, { params: { quantity } });
    return response.data.available;
  }
}
```

### Using the Client

```typescript
// src/services/order.service.ts
import { ProductServiceClient } from '../clients/product-service.client';
import { UserServiceClient } from '../clients/user-service.client';

export class OrderService {
  private productClient = new ProductServiceClient();
  private userClient = new UserServiceClient();

  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    // Validate user exists
    const user = await this.userClient.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate products and check stock
    for (const item of items) {
      const hasStock = await this.productClient.checkStock(item.productId, item.quantity);
      if (!hasStock) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
    }

    // Get product details for order
    const productIds = items.map((i) => i.productId);
    const products = await this.productClient.getProducts(productIds);

    // Calculate total
    const total = items.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      return sum + (product?.price || 0) * item.quantity;
    }, 0);

    // Create order
    const order = await this.orderRepository.create({
      userId,
      items,
      total,
      status: 'PENDING',
    });

    return order;
  }
}
```

---

## Handling Failures

### Retry with Exponential Backoff

```typescript
// src/utils/retry.ts
interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = { maxRetries: 3, baseDelay: 100, maxDelay: 5000 },
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Don't retry on client errors (4xx)
      if (axios.isAxiosError(error) && error.response?.status < 500) {
        throw error;
      }

      if (attempt < options.maxRetries) {
        const delay = Math.min(options.baseDelay * Math.pow(2, attempt), options.maxDelay);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await sleep(delay);
      }
    }
  }

  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Usage
const product = await withRetry(() => productClient.getProduct(productId));
```

### Timeout Handling

```typescript
// src/clients/product-service.client.ts
import axios from 'axios';

export class ProductServiceClient {
  async getProduct(productId: string): Promise<Product> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/products/${productId}`,
        { timeout: 3000 }, // 3 second timeout
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error('Product service timeout');
        }
        if (error.response?.status === 404) {
          throw new Error('Product not found');
        }
      }
      throw error;
    }
  }
}
```

---

## API Versioning

### URL Versioning

```
┌─────────────────────────────────────────────────────────────┐
│                  API VERSIONING                              │
│                                                              │
│  Option 1: URL Path (Recommended)                           │
│  ─────────────────────────────────                          │
│  /api/v1/users                                              │
│  /api/v2/users                                              │
│                                                              │
│  Option 2: Header                                           │
│  ────────────────                                           │
│  GET /api/users                                             │
│  Accept: application/vnd.myapi.v1+json                      │
│                                                              │
│  Option 3: Query Parameter                                  │
│  ─────────────────────────                                  │
│  /api/users?version=1                                       │
└─────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// src/routes/index.ts
import { Router } from 'express';
import { userRoutesV1 } from './v1/user.routes';
import { userRoutesV2 } from './v2/user.routes';

const router = Router();

// Version 1
router.use('/v1/users', userRoutesV1);

// Version 2 (new response format)
router.use('/v2/users', userRoutesV2);

export { router as apiRoutes };

// src/index.ts
app.use('/api', apiRoutes);
```

---

## Documentation with OpenAPI

```typescript
// src/docs/openapi.ts
export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'User Service API',
    version: '1.0.0',
    description: 'User management microservice',
  },
  servers: [
    { url: 'http://localhost:3001', description: 'Development' },
    { url: 'https://api.example.com', description: 'Production' },
  ],
  paths: {
    '/api/users': {
      get: {
        summary: 'List all users',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
        ],
        responses: {
          200: {
            description: 'List of users',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/UserList' },
              },
            },
          },
        },
      },
      post: {
        summary: 'Create a user',
        requestBody: {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateUser' },
            },
          },
        },
        responses: {
          201: { description: 'User created' },
          422: { description: 'Validation error' },
        },
      },
    },
  },
  components: {
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
        },
      },
    },
  },
};
```

---

## Key Takeaways

1. **Use proper HTTP methods** - GET, POST, PUT, PATCH, DELETE
2. **Design resource-based URLs** - Nouns, not verbs
3. **Return appropriate status codes** - 2xx, 4xx, 5xx
4. **Consistent error format** - Code, message, details
5. **Handle failures gracefully** - Timeouts, retries, fallbacks
6. **Version your APIs** - URL path is simplest
7. **Document with OpenAPI** - Machine-readable specs
8. **Add correlation IDs** - For distributed tracing

---

## What's Next?

In the next lesson, we will explore gRPC for high-performance service-to-service communication.

---
