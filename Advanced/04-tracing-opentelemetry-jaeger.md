# Distributed Tracing with OpenTelemetry & Jaeger

## Overview

Distributed tracing tracks requests as they flow through multiple microservices, helping you understand latency, identify bottlenecks, and debug failures in distributed systems.

---

## Why Distributed Tracing?

In microservices, a single user request may touch 5-10 services:

```
User Request
    │
    ▼
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│   API   │ ──▶ │  Order  │ ──▶ │ Payment │ ──▶ │  Notif  │
│ Gateway │     │ Service │     │ Service │     │ Service │
└─────────┘     └────┬────┘     └─────────┘     └─────────┘
                     │
                     ▼
               ┌─────────┐
               │Inventory│
               │ Service │
               └─────────┘
```

**Without tracing:** "Something is slow, but which service?"
**With tracing:** "The payment service DB query takes 2 seconds"

---

## Core Concepts

### Traces, Spans, and Context

```
Trace ID: abc123
├── Span: API Gateway (50ms)
│   ├── Span: Auth Check (5ms)
│   └── Span: Route to Order Service
├── Span: Order Service (200ms)
│   ├── Span: Validate Order (10ms)
│   ├── Span: DB Query (50ms)
│   └── Span: Call Payment Service (120ms)
└── Span: Payment Service (100ms)
    ├── Span: Process Payment (80ms)
    └── Span: Send Receipt (15ms)
```

| Term | Description |
|------|-------------|
| **Trace** | Complete journey of a request |
| **Span** | Single operation within a trace |
| **Context** | Trace/Span IDs passed between services |
| **Parent Span** | Span that initiated current span |

---

## OpenTelemetry Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               OpenTelemetry SDK                      │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐             │    │
│  │  │ Tracer  │  │ Meter   │  │ Logger  │             │    │
│  │  └────┬────┘  └────┬────┘  └────┬────┘             │    │
│  │       │            │            │                   │    │
│  │       └────────────┴────────────┘                   │    │
│  │                    │                                │    │
│  │              ┌─────┴─────┐                          │    │
│  │              │ Exporter  │                          │    │
│  │              └─────┬─────┘                          │    │
│  └────────────────────┼────────────────────────────────┘    │
└───────────────────────┼─────────────────────────────────────┘
                        │
                        ▼
              ┌─────────────────┐
              │     Jaeger      │
              │  (or Zipkin,    │
              │   Tempo, etc.)  │
              └─────────────────┘
```

---

## Setting Up OpenTelemetry in NestJS

### Install Dependencies

```bash
npm install @opentelemetry/sdk-node \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-jaeger \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions
```

### Tracing Configuration

```typescript
// tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
});

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: process.env.SERVICE_NAME || 'order-service',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.SERVICE_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
  traceExporter: jaegerExporter,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingPaths: ['/health', '/metrics'],
      },
      '@opentelemetry/instrumentation-express': {},
      '@opentelemetry/instrumentation-pg': {},
      '@opentelemetry/instrumentation-redis': {},
    }),
  ],
});

export function initTracing() {
  sdk.start();
  
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => console.log('Tracing terminated'))
      .catch((error) => console.error('Error terminating tracing', error))
      .finally(() => process.exit(0));
  });
}
```

### Initialize Before App

```typescript
// main.ts
import { initTracing } from './tracing';

// Initialize tracing BEFORE importing NestFactory
initTracing();

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap();
```

---

## Manual Span Creation

### Tracing Service

```typescript
// tracing.service.ts
import { Injectable } from '@nestjs/common';
import { trace, Span, SpanStatusCode, context } from '@opentelemetry/api';

@Injectable()
export class TracingService {
  private tracer = trace.getTracer('order-service');

  startSpan(name: string): Span {
    return this.tracer.startSpan(name);
  }

  async withSpan<T>(name: string, fn: (span: Span) => Promise<T>): Promise<T> {
    const span = this.tracer.startSpan(name);
    
    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        () => fn(span),
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  addSpanAttributes(span: Span, attributes: Record<string, string | number | boolean>) {
    Object.entries(attributes).forEach(([key, value]) => {
      span.setAttribute(key, value);
    });
  }
}
```

### Using Tracing in Services

```typescript
// orders.service.ts
import { Injectable } from '@nestjs/common';
import { TracingService } from './tracing.service';

@Injectable()
export class OrdersService {
  constructor(
    private readonly tracingService: TracingService,
    private readonly paymentClient: PaymentClient,
  ) {}

  async createOrder(dto: CreateOrderDto) {
    return this.tracingService.withSpan('createOrder', async (span) => {
      span.setAttribute('userId', dto.userId);
      span.setAttribute('itemCount', dto.items.length);

      // Validate order
      await this.tracingService.withSpan('validateOrder', async (validateSpan) => {
        validateSpan.setAttribute('validationType', 'full');
        await this.validateOrder(dto);
      });

      // Save to database
      const order = await this.tracingService.withSpan('saveOrder', async (dbSpan) => {
        dbSpan.setAttribute('db.system', 'postgresql');
        return this.orderRepository.save(dto);
      });

      span.setAttribute('orderId', order.id);

      // Call payment service
      await this.tracingService.withSpan('processPayment', async (paymentSpan) => {
        paymentSpan.setAttribute('paymentMethod', dto.paymentMethod);
        await this.paymentClient.processPayment(order);
      });

      return order;
    });
  }
}
```

---

## Context Propagation

### HTTP Client with Context

```typescript
// http-client.service.ts
import { Injectable, HttpService } from '@nestjs/common';
import { context, propagation, trace } from '@opentelemetry/api';

@Injectable()
export class TracedHttpClient {
  constructor(private readonly httpService: HttpService) {}

  async get<T>(url: string): Promise<T> {
    const headers: Record<string, string> = {};
    
    // Inject trace context into headers
    propagation.inject(context.active(), headers);

    const response = await this.httpService.axiosRef.get<T>(url, { headers });
    return response.data;
  }

  async post<T>(url: string, data: any): Promise<T> {
    const headers: Record<string, string> = {};
    propagation.inject(context.active(), headers);

    const response = await this.httpService.axiosRef.post<T>(url, data, { headers });
    return response.data;
  }
}
```

### Message Queue Context

```typescript
// rabbitmq.producer.ts
import { Injectable } from '@nestjs/common';
import { context, propagation, trace } from '@opentelemetry/api';
import * as amqp from 'amqplib';

@Injectable()
export class RabbitMQProducer {
  async publish(queue: string, message: any) {
    const tracer = trace.getTracer('order-service');
    const span = tracer.startSpan(`publish ${queue}`);

    try {
      const headers: Record<string, string> = {};
      propagation.inject(context.active(), headers);

      const messageWithContext = {
        ...message,
        _traceHeaders: headers,
      };

      await this.channel.sendToQueue(
        queue,
        Buffer.from(JSON.stringify(messageWithContext)),
      );

      span.setStatus({ code: SpanStatusCode.OK });
    } finally {
      span.end();
    }
  }
}
```

```typescript
// rabbitmq.consumer.ts
import { Injectable } from '@nestjs/common';
import { context, propagation, trace } from '@opentelemetry/api';

@Injectable()
export class RabbitMQConsumer {
  async consume(queue: string, handler: (msg: any) => Promise<void>) {
    this.channel.consume(queue, async (msg) => {
      const content = JSON.parse(msg.content.toString());
      const { _traceHeaders, ...message } = content;

      // Extract trace context from message
      const extractedContext = propagation.extract(context.active(), _traceHeaders);

      await context.with(extractedContext, async () => {
        const tracer = trace.getTracer('order-service');
        const span = tracer.startSpan(`consume ${queue}`);

        try {
          await handler(message);
          span.setStatus({ code: SpanStatusCode.OK });
        } catch (error) {
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          throw error;
        } finally {
          span.end();
        }
      });

      this.channel.ack(msg);
    });
  }
}
```

---

## Jaeger Setup

### Docker Compose

```yaml
version: '3.8'

services:
  jaeger:
    image: jaegertracing/all-in-one:1.52
    ports:
      - "5775:5775/udp"   # Zipkin compact thrift
      - "6831:6831/udp"   # Jaeger compact thrift
      - "6832:6832/udp"   # Jaeger binary thrift
      - "5778:5778"       # Serve configs
      - "16686:16686"     # Jaeger UI
      - "14268:14268"     # Jaeger HTTP collector
      - "14250:14250"     # Jaeger gRPC collector
    environment:
      - COLLECTOR_OTLP_ENABLED=true
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jaeger
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jaeger
  template:
    metadata:
      labels:
        app: jaeger
    spec:
      containers:
        - name: jaeger
          image: jaegertracing/all-in-one:1.52
          ports:
            - containerPort: 16686
            - containerPort: 14268
          env:
            - name: COLLECTOR_OTLP_ENABLED
              value: "true"
---
apiVersion: v1
kind: Service
metadata:
  name: jaeger
spec:
  selector:
    app: jaeger
  ports:
    - name: ui
      port: 16686
    - name: collector
      port: 14268
```

---

## Span Attributes Best Practices

### Standard Attributes

```typescript
// HTTP spans
span.setAttribute('http.method', 'POST');
span.setAttribute('http.url', '/api/orders');
span.setAttribute('http.status_code', 201);
span.setAttribute('http.response_content_length', 1234);

// Database spans
span.setAttribute('db.system', 'postgresql');
span.setAttribute('db.name', 'orders');
span.setAttribute('db.operation', 'INSERT');
span.setAttribute('db.statement', 'INSERT INTO orders...');

// Custom business attributes
span.setAttribute('order.id', 'ord_12345');
span.setAttribute('order.total', 99.99);
span.setAttribute('order.items_count', 3);
span.setAttribute('user.id', 'usr_67890');
```

### Span Events

```typescript
// Add events to spans
span.addEvent('order.validated', {
  'validation.rules_checked': 5,
});

span.addEvent('payment.initiated', {
  'payment.method': 'credit_card',
  'payment.amount': 99.99,
});

span.addEvent('order.completed', {
  'order.id': order.id,
});
```

---

## Sampling Strategies

```typescript
// tracing.ts
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node';

const sdk = new NodeSDK({
  // Sample 10% of traces in production
  sampler: process.env.NODE_ENV === 'production'
    ? new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(0.1),
      })
    : new AlwaysOnSampler(),
  // ...
});
```

| Strategy | Use Case |
|----------|----------|
| Always On | Development, debugging |
| Always Off | Disable tracing |
| Ratio Based | Production (sample %) |
| Parent Based | Respect parent sampling |

---

## Visualizing Traces in Jaeger

### Key Views

1. **Search** - Find traces by service, operation, tags
2. **Trace Timeline** - Waterfall view of spans
3. **Span Details** - Attributes, logs, events
4. **Compare** - Side-by-side trace comparison
5. **Dependencies** - Service dependency graph

### Useful Queries

```
# Find slow traces
service=order-service minDuration=500ms

# Find errors
service=order-service error=true

# Find by custom tag
service=order-service order.id=ord_12345
```

---

## Key Takeaways

1. **Traces** - End-to-end request journey
2. **Spans** - Individual operations with timing
3. **Context propagation** - Pass trace IDs across services
4. **Sampling** - Control trace volume in production
5. **Attributes** - Add meaningful business context

---

## Next Steps

- Set up trace-based alerts
- Correlate traces with logs
- Integrate with Grafana Tempo
