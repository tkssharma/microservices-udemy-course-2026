# Lesson 3.3: gRPC Communication

## Introduction

gRPC is a high-performance, open-source RPC (Remote Procedure Call) framework developed by Google. It uses Protocol Buffers for serialization and HTTP/2 for transport, making it significantly faster than REST for service-to-service communication.

---

## Why gRPC?

```
┌─────────────────────────────────────────────────────────────┐
│                  REST vs gRPC                                │
│                                                              │
│  Aspect              REST              gRPC                 │
│  ──────              ────              ────                 │
│  Protocol            HTTP/1.1          HTTP/2               │
│  Payload             JSON (text)       Protobuf (binary)    │
│  Contract            OpenAPI (opt)     Proto files (req)    │
│  Streaming           Limited           Full support         │
│  Code Generation     Optional          Built-in             │
│  Browser Support     Native            Requires proxy       │
│  Performance         Good              Excellent            │
│  Human Readable      Yes               No (binary)          │
│                                                              │
│  gRPC is 2-10x faster than REST for most use cases.        │
└─────────────────────────────────────────────────────────────┘
```

### When to Use gRPC

```
┌─────────────────────────────────────────────────────────────┐
│                  WHEN TO USE gRPC                            │
│                                                              │
│  Use gRPC When:                                             │
│  ──────────────                                             │
│  • High-performance internal communication                  │
│  • Polyglot services (multiple languages)                   │
│  • Streaming data (real-time updates)                       │
│  • Strong typing is important                               │
│  • Low latency is critical                                  │
│                                                              │
│  Use REST When:                                             │
│  ───────────────                                            │
│  • Public APIs (browser clients)                            │
│  • Simple CRUD operations                                   │
│  • Human-readable debugging needed                          │
│  • Third-party integrations                                 │
│  • Team unfamiliar with gRPC                                │
└─────────────────────────────────────────────────────────────┘
```

---

## gRPC Concepts

### Protocol Buffers (Protobuf)

```
┌─────────────────────────────────────────────────────────────┐
│                  PROTOCOL BUFFERS                            │
│                                                              │
│  Proto file defines:                                        │
│  • Messages (data structures)                               │
│  • Services (RPC methods)                                   │
│  • Types (string, int32, bool, etc.)                        │
│                                                              │
│  Benefits:                                                  │
│  • Strongly typed                                           │
│  • Language agnostic                                        │
│  • Backward compatible                                      │
│  • Compact binary format                                    │
│  • Auto-generated code                                      │
└─────────────────────────────────────────────────────────────┘
```

### Communication Patterns

```
┌─────────────────────────────────────────────────────────────┐
│                  gRPC PATTERNS                               │
│                                                              │
│  1. Unary (Request-Response)                                │
│  ───────────────────────────                                │
│  Client ──request──▶ Server                                 │
│  Client ◀──response── Server                                │
│                                                              │
│  2. Server Streaming                                        │
│  ────────────────────                                       │
│  Client ──request──▶ Server                                 │
│  Client ◀──stream──── Server                                │
│  Client ◀──stream──── Server                                │
│  Client ◀──stream──── Server                                │
│                                                              │
│  3. Client Streaming                                        │
│  ────────────────────                                       │
│  Client ──stream──▶ Server                                  │
│  Client ──stream──▶ Server                                  │
│  Client ◀──response── Server                                │
│                                                              │
│  4. Bidirectional Streaming                                 │
│  ──────────────────────────                                 │
│  Client ◀──stream──▶ Server                                 │
│  (Both send streams simultaneously)                         │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Setup

### Install Dependencies

```bash
npm init -y
npm install @grpc/grpc-js @grpc/proto-loader
npm install -D typescript @types/node ts-node
```

### Project Structure

```
product-service/
├── src/
│   ├── index.ts
│   ├── server.ts
│   ├── client.ts
│   └── services/
│       └── product.service.ts
├── proto/
│   └── product.proto
├── package.json
└── tsconfig.json
```

---

## Define Proto File

```protobuf
// proto/product.proto
syntax = "proto3";

package product;

// Service definition
service ProductService {
  // Unary RPC
  rpc GetProduct(GetProductRequest) returns (Product);
  rpc CreateProduct(CreateProductRequest) returns (Product);
  rpc UpdateProduct(UpdateProductRequest) returns (Product);
  rpc DeleteProduct(DeleteProductRequest) returns (DeleteProductResponse);

  // Server streaming - get multiple products
  rpc ListProducts(ListProductsRequest) returns (stream Product);

  // Client streaming - bulk create
  rpc BulkCreateProducts(stream CreateProductRequest) returns (BulkCreateResponse);
}

// Messages
message Product {
  string id = 1;
  string name = 2;
  string description = 3;
  double price = 4;
  int32 stock = 5;
  string category = 6;
  int64 created_at = 7;
  int64 updated_at = 8;
}

message GetProductRequest {
  string id = 1;
}

message CreateProductRequest {
  string name = 1;
  string description = 2;
  double price = 3;
  int32 stock = 4;
  string category = 5;
}

message UpdateProductRequest {
  string id = 1;
  string name = 2;
  string description = 3;
  double price = 4;
  int32 stock = 5;
}

message DeleteProductRequest {
  string id = 1;
}

message DeleteProductResponse {
  bool success = 1;
}

message ListProductsRequest {
  string category = 1;
  int32 limit = 2;
}

message BulkCreateResponse {
  int32 created_count = 1;
  repeated string product_ids = 2;
}
```

---

## gRPC Server Implementation

```typescript
// src/server.ts
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

// Load proto file
const PROTO_PATH = path.join(__dirname, '../proto/product.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const productProto = grpc.loadPackageDefinition(packageDefinition) as any;

// In-memory database (replace with real DB)
const products: Map<string, any> = new Map();

// Service implementation
const productService = {
  // Unary RPC: Get single product
  GetProduct: (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    const productId = call.request.id;
    const product = products.get(productId);

    if (!product) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `Product ${productId} not found`,
      });
    }

    callback(null, product);
  },

  // Unary RPC: Create product
  CreateProduct: (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    const { name, description, price, stock, category } = call.request;

    const product = {
      id: generateId(),
      name,
      description,
      price,
      stock,
      category,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    products.set(product.id, product);
    console.log(`Created product: ${product.id}`);

    callback(null, product);
  },

  // Unary RPC: Update product
  UpdateProduct: (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    const { id, name, description, price, stock } = call.request;
    const product = products.get(id);

    if (!product) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: `Product ${id} not found`,
      });
    }

    const updated = {
      ...product,
      name: name || product.name,
      description: description || product.description,
      price: price || product.price,
      stock: stock ?? product.stock,
      updated_at: Date.now(),
    };

    products.set(id, updated);
    callback(null, updated);
  },

  // Unary RPC: Delete product
  DeleteProduct: (call: grpc.ServerUnaryCall<any, any>, callback: grpc.sendUnaryData<any>) => {
    const productId = call.request.id;
    const deleted = products.delete(productId);

    callback(null, { success: deleted });
  },

  // Server streaming: List products
  ListProducts: (call: grpc.ServerWritableStream<any, any>) => {
    const { category, limit } = call.request;
    let count = 0;

    for (const product of products.values()) {
      if (limit && count >= limit) break;
      if (category && product.category !== category) continue;

      call.write(product);
      count++;
    }

    call.end();
  },

  // Client streaming: Bulk create
  BulkCreateProducts: (call: grpc.ServerReadableStream<any, any>, callback: grpc.sendUnaryData<any>) => {
    const createdIds: string[] = [];

    call.on('data', (request: any) => {
      const product = {
        id: generateId(),
        ...request,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      products.set(product.id, product);
      createdIds.push(product.id);
    });

    call.on('end', () => {
      callback(null, {
        created_count: createdIds.length,
        product_ids: createdIds,
      });
    });

    call.on('error', (error: Error) => {
      console.error('Stream error:', error);
    });
  },
};

function generateId(): string {
  return `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Start server
function startServer() {
  const server = new grpc.Server();

  server.addService(productProto.product.ProductService.service, productService);

  const address = '0.0.0.0:50051';

  server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (error, port) => {
    if (error) {
      console.error('Failed to start server:', error);
      return;
    }

    console.log(`gRPC server running on ${address}`);
    server.start();
  });
}

startServer();
```

---

## gRPC Client Implementation

```typescript
// src/client.ts
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';

const PROTO_PATH = path.join(__dirname, '../proto/product.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const productProto = grpc.loadPackageDefinition(packageDefinition) as any;

export class ProductServiceClient {
  private client: any;

  constructor(address: string = 'localhost:50051') {
    this.client = new productProto.product.ProductService(address, grpc.credentials.createInsecure());
  }

  // Unary call: Get product
  async getProduct(id: string): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.GetProduct({ id }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Unary call: Create product
  async createProduct(data: {
    name: string;
    description: string;
    price: number;
    stock: number;
    category: string;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.CreateProduct(data, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Unary call: Update product
  async updateProduct(
    id: string,
    data: Partial<{ name: string; description: string; price: number; stock: number }>,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      this.client.UpdateProduct({ id, ...data }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });
  }

  // Unary call: Delete product
  async deleteProduct(id: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.client.DeleteProduct({ id }, (error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response.success);
        }
      });
    });
  }

  // Server streaming: List products
  async listProducts(category?: string, limit?: number): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const products: any[] = [];
      const call = this.client.ListProducts({ category, limit });

      call.on('data', (product: any) => {
        products.push(product);
      });

      call.on('end', () => {
        resolve(products);
      });

      call.on('error', (error: any) => {
        reject(error);
      });
    });
  }

  // Client streaming: Bulk create
  async bulkCreateProducts(
    products: Array<{
      name: string;
      description: string;
      price: number;
      stock: number;
      category: string;
    }>,
  ): Promise<{ created_count: number; product_ids: string[] }> {
    return new Promise((resolve, reject) => {
      const call = this.client.BulkCreateProducts((error: any, response: any) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });

      for (const product of products) {
        call.write(product);
      }

      call.end();
    });
  }

  // Close connection
  close(): void {
    this.client.close();
  }
}
```

---

## Using the Client in Another Service

```typescript
// order-service/src/services/order.service.ts
import { ProductServiceClient } from '../clients/product.client';

export class OrderService {
  private productClient: ProductServiceClient;

  constructor() {
    this.productClient = new ProductServiceClient(process.env.PRODUCT_SERVICE_GRPC_URL || 'product-service:50051');
  }

  async createOrder(userId: string, items: OrderItem[]): Promise<Order> {
    // Validate products exist and have stock
    for (const item of items) {
      try {
        const product = await this.productClient.getProduct(item.productId);

        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for product ${product.name}`);
        }
      } catch (error: any) {
        if (error.code === 5) {
          // NOT_FOUND
          throw new Error(`Product ${item.productId} not found`);
        }
        throw error;
      }
    }

    // Create order...
    const order = await this.orderRepository.create({
      userId,
      items,
      status: 'PENDING',
    });

    return order;
  }
}
```

---

## Error Handling

### gRPC Status Codes

```
┌─────────────────────────────────────────────────────────────┐
│                  gRPC STATUS CODES                           │
│                                                              │
│  Code  Name                 HTTP Equivalent                 │
│  ────  ────                 ───────────────                 │
│  0     OK                   200                             │
│  1     CANCELLED            499                             │
│  2     UNKNOWN              500                             │
│  3     INVALID_ARGUMENT     400                             │
│  4     DEADLINE_EXCEEDED    504                             │
│  5     NOT_FOUND            404                             │
│  6     ALREADY_EXISTS       409                             │
│  7     PERMISSION_DENIED    403                             │
│  8     RESOURCE_EXHAUSTED   429                             │
│  9     FAILED_PRECONDITION  400                             │
│  10    ABORTED              409                             │
│  11    OUT_OF_RANGE         400                             │
│  12    UNIMPLEMENTED        501                             │
│  13    INTERNAL             500                             │
│  14    UNAVAILABLE          503                             │
│  15    DATA_LOSS            500                             │
│  16    UNAUTHENTICATED      401                             │
└─────────────────────────────────────────────────────────────┘
```

### Error Handling in Client

```typescript
// src/clients/product.client.ts
import * as grpc from '@grpc/grpc-js';

export class ProductServiceClient {
  async getProduct(id: string): Promise<Product> {
    return new Promise((resolve, reject) => {
      // Set deadline (timeout)
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);

      this.client.GetProduct({ id }, { deadline }, (error: grpc.ServiceError | null, response: any) => {
        if (error) {
          // Handle specific error codes
          switch (error.code) {
            case grpc.status.NOT_FOUND:
              reject(new NotFoundError(`Product ${id} not found`));
              break;
            case grpc.status.DEADLINE_EXCEEDED:
              reject(new TimeoutError('Product service timeout'));
              break;
            case grpc.status.UNAVAILABLE:
              reject(new ServiceUnavailableError('Product service unavailable'));
              break;
            default:
              reject(new Error(`gRPC error: ${error.message}`));
          }
        } else {
          resolve(response);
        }
      });
    });
  }
}
```

---

## Interceptors (Middleware)

```typescript
// src/interceptors/logging.interceptor.ts
import * as grpc from '@grpc/grpc-js';

export function loggingInterceptor(
  options: any,
  nextCall: (options: any) => grpc.InterceptingCall,
): grpc.InterceptingCall {
  const startTime = Date.now();
  const method = options.method_definition.path;

  console.log(`gRPC Request: ${method}`);

  return new grpc.InterceptingCall(nextCall(options), {
    start: (metadata, listener, next) => {
      next(metadata, {
        onReceiveMessage: (message, next) => {
          next(message);
        },
        onReceiveStatus: (status, next) => {
          const duration = Date.now() - startTime;
          console.log(`gRPC Response: ${method} - ${status.code} (${duration}ms)`);
          next(status);
        },
      });
    },
  });
}

// Usage in client
const client = new productProto.product.ProductService(address, grpc.credentials.createInsecure(), {
  interceptors: [loggingInterceptor],
});
```

---

## Load Balancing

```typescript
// src/client-with-lb.ts
import * as grpc from '@grpc/grpc-js';

// Round-robin load balancing across multiple servers
const addresses = ['product-service-1:50051', 'product-service-2:50051', 'product-service-3:50051'];

// Using DNS-based load balancing
const client = new productProto.product.ProductService(
  `dns:///product-service:50051`,
  grpc.credentials.createInsecure(),
  {
    'grpc.lb_policy_name': 'round_robin',
    'grpc.service_config': JSON.stringify({
      loadBalancingConfig: [{ round_robin: {} }],
    }),
  },
);
```

---

## Health Checking

```protobuf
// proto/health.proto
syntax = "proto3";

package grpc.health.v1;

service Health {
  rpc Check(HealthCheckRequest) returns (HealthCheckResponse);
  rpc Watch(HealthCheckRequest) returns (stream HealthCheckResponse);
}

message HealthCheckRequest {
  string service = 1;
}

message HealthCheckResponse {
  enum ServingStatus {
    UNKNOWN = 0;
    SERVING = 1;
    NOT_SERVING = 2;
  }
  ServingStatus status = 1;
}
```

```typescript
// src/health.ts
const healthService = {
  Check: (call: any, callback: any) => {
    callback(null, { status: 'SERVING' });
  },
  Watch: (call: any) => {
    call.write({ status: 'SERVING' });
    // Keep connection open for status updates
  },
};

server.addService(healthProto.grpc.health.v1.Health.service, healthService);
```

---

## Key Takeaways

1. **gRPC is faster than REST** - Binary protocol, HTTP/2
2. **Proto files define contracts** - Strongly typed, auto-generated code
3. **Four communication patterns** - Unary, server streaming, client streaming, bidirectional
4. **Use for internal services** - Not ideal for public APIs
5. **Built-in features** - Deadlines, cancellation, load balancing
6. **Error handling via status codes** - Similar to HTTP but different codes
7. **Interceptors for cross-cutting concerns** - Logging, auth, metrics

---

## What's Next?

In the next lesson, we will explore message queues with RabbitMQ for asynchronous communication.

---
