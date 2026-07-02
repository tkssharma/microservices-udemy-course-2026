# Metrics Collection with Prometheus

## Overview

Prometheus is an open-source monitoring and alerting toolkit designed for reliability and scalability. It's the de facto standard for metrics collection in cloud-native environments.

---

## Why Prometheus for Microservices?

| Feature | Benefit |
|---------|---------|
| Pull-based model | Services don't need to know where metrics go |
| Multi-dimensional data | Labels allow flexible querying |
| Powerful query language | PromQL for complex aggregations |
| Service discovery | Auto-discovers targets in K8s |
| Built-in alerting | Alertmanager integration |

---

## Core Concepts

### Metric Types

```
┌─────────────────────────────────────────────────────────────┐
│                    Prometheus Metric Types                   │
├─────────────────┬───────────────────────────────────────────┤
│ Counter         │ Cumulative, only increases (requests)     │
│ Gauge           │ Can go up/down (memory, connections)      │
│ Histogram       │ Samples in buckets (latency distribution) │
│ Summary         │ Quantiles over sliding window             │
└─────────────────┴───────────────────────────────────────────┘
```

### Labels

Labels add dimensions to metrics:
```
http_requests_total{method="GET", path="/api/orders", status="200"}
http_requests_total{method="POST", path="/api/orders", status="201"}
```

---

## Setting Up Prometheus with NestJS

### Install Dependencies

```bash
npm install prom-client @willsoto/nestjs-prometheus
```

### Configure the Module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
})
export class AppModule {}
```

### Custom Metrics

```typescript
// metrics.service.ts
import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram, Gauge } from 'prom-client';

@Injectable()
export class MetricsService {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly requestCounter: Counter<string>,

    @InjectMetric('http_request_duration_seconds')
    private readonly requestDuration: Histogram<string>,

    @InjectMetric('orders_in_progress')
    private readonly ordersInProgress: Gauge<string>,
  ) {}

  incrementRequests(method: string, path: string, status: number) {
    this.requestCounter.inc({
      method,
      path,
      status: status.toString(),
    });
  }

  recordRequestDuration(method: string, path: string, duration: number) {
    this.requestDuration.observe({ method, path }, duration);
  }

  setOrdersInProgress(count: number) {
    this.ordersInProgress.set(count);
  }
}
```

### Register Custom Metrics

```typescript
// metrics.module.ts
import { Module } from '@nestjs/common';
import { makeCounterProvider, makeHistogramProvider, makeGaugeProvider } from '@willsoto/nestjs-prometheus';
import { MetricsService } from './metrics.service';

@Module({
  providers: [
    MetricsService,
    makeCounterProvider({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status'],
    }),
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    }),
    makeGaugeProvider({
      name: 'orders_in_progress',
      help: 'Number of orders currently being processed',
    }),
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
```

---

## Metrics Middleware

```typescript
// metrics.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metricsService: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();

    res.on('finish', () => {
      const duration = (Date.now() - startTime) / 1000;
      
      this.metricsService.incrementRequests(
        req.method,
        req.route?.path || req.path,
        res.statusCode,
      );
      
      this.metricsService.recordRequestDuration(
        req.method,
        req.route?.path || req.path,
        duration,
      );
    });

    next();
  }
}
```

---

## Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'order-service'
    static_configs:
      - targets: ['order-service:3000']
    metrics_path: /metrics

  - job_name: 'user-service'
    static_configs:
      - targets: ['user-service:3001']
    metrics_path: /metrics

  - job_name: 'payment-service'
    static_configs:
      - targets: ['payment-service:3002']
    metrics_path: /metrics

  # Kubernetes service discovery
  - job_name: 'kubernetes-pods'
    kubernetes_sd_configs:
      - role: pod
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
```

---

## Essential PromQL Queries

### Request Rate
```promql
# Requests per second (last 5 minutes)
rate(http_requests_total[5m])

# By service
sum(rate(http_requests_total[5m])) by (job)
```

### Error Rate
```promql
# Error percentage
sum(rate(http_requests_total{status=~"5.."}[5m])) 
/ 
sum(rate(http_requests_total[5m])) * 100
```

### Latency (P95, P99)
```promql
# 95th percentile latency
histogram_quantile(0.95, 
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le, path)
)

# 99th percentile latency
histogram_quantile(0.99, 
  sum(rate(http_request_duration_seconds_bucket[5m])) by (le)
)
```

### Saturation
```promql
# CPU usage
100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage
(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) 
/ node_memory_MemTotal_bytes * 100
```

---

## Golden Signals Metrics

| Signal | Metric | PromQL |
|--------|--------|--------|
| **Latency** | Request duration | `histogram_quantile(0.95, ...)` |
| **Traffic** | Request rate | `rate(http_requests_total[5m])` |
| **Errors** | Error rate | `rate(http_requests_total{status=~"5.."}[5m])` |
| **Saturation** | Resource usage | CPU, memory, queue depth |

---

## Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:v2.47.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=15d'

volumes:
  prometheus_data:
```

---

## Best Practices

### Naming Conventions
```
# Format: <namespace>_<name>_<unit>
http_requests_total
http_request_duration_seconds
order_processing_duration_seconds
database_connections_current
```

### Cardinality Control
```typescript
// ❌ High cardinality - avoid
counter.inc({ userId: user.id, orderId: order.id });

// ✅ Bounded cardinality
counter.inc({ service: 'orders', status: 'success' });
```

### Label Best Practices
- Keep label values bounded (status codes, not user IDs)
- Use consistent label names across services
- Don't include high-cardinality fields

---

## Key Takeaways

1. **Pull model** - Prometheus scrapes your `/metrics` endpoint
2. **Four metric types** - Counter, Gauge, Histogram, Summary
3. **Labels** - Add dimensions without creating new metrics
4. **PromQL** - Powerful query language for aggregations
5. **Golden signals** - Latency, Traffic, Errors, Saturation

---

## Next Steps

- Set up Grafana dashboards for visualization
- Configure Alertmanager for alerting
- Add Kubernetes service discovery
