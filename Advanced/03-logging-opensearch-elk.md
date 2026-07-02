# Centralized Logging with OpenSearch / ELK Stack

## Overview

Centralized logging aggregates logs from all microservices into a single searchable system. OpenSearch (or Elasticsearch) provides powerful full-text search and analytics capabilities.

---

## Stack Comparison

| Component | ELK Stack | OpenSearch Stack |
|-----------|-----------|------------------|
| Search Engine | Elasticsearch | OpenSearch |
| Visualization | Kibana | OpenSearch Dashboards |
| Log Shipper | Logstash | Logstash / Data Prepper |
| Log Collector | Filebeat | Fluent Bit |
| License | Elastic License | Apache 2.0 |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Microservices                             │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Order   │  │ User    │  │ Payment │  │ Notif   │        │
│  │ Service │  │ Service │  │ Service │  │ Service │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
│       └────────────┴────────────┴────────────┘              │
│                         │ stdout/stderr                     │
│                         ▼                                   │
│              ┌─────────────────────┐                        │
│              │     Fluent Bit      │  (Log Collector)       │
│              └──────────┬──────────┘                        │
│                         │                                   │
│                         ▼                                   │
│              ┌─────────────────────┐                        │
│              │     OpenSearch      │  (Search & Storage)    │
│              └──────────┬──────────┘                        │
│                         │                                   │
│                         ▼                                   │
│              ┌─────────────────────┐                        │
│              │ OpenSearch Dashboard│  (Visualization)       │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Structured Logging in NestJS

### Install Pino Logger

```bash
npm install nestjs-pino pino-http pino-pretty
```

### Configure Structured Logging

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        
        // JSON format in production
        transport: process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,

        // Redact sensitive fields
        redact: {
          paths: ['req.headers.authorization', 'req.body.password', 'req.body.creditCard'],
          censor: '[REDACTED]',
        },

        // Custom serializers
        serializers: {
          req: (req) => ({
            method: req.method,
            url: req.url,
            correlationId: req.headers['x-correlation-id'],
          }),
        },
      },
    }),
  ],
})
export class AppModule {}
```

### Correlation ID Middleware

```typescript
// correlation.middleware.ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
    
    req['correlationId'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    
    next();
  }
}
```

### Using Logger in Services

```typescript
// orders.service.ts
import { Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';

@Injectable()
export class OrdersService {
  constructor(
    @InjectPinoLogger(OrdersService.name)
    private readonly logger: PinoLogger,
  ) {}

  async createOrder(dto: CreateOrderDto, correlationId: string) {
    this.logger.info({
      correlationId,
      userId: dto.userId,
      action: 'order.create.started',
    }, 'Creating order');

    try {
      const order = await this.orderRepository.save(dto);
      
      this.logger.info({
        correlationId,
        orderId: order.id,
        action: 'order.create.completed',
      }, 'Order created successfully');
      
      return order;
    } catch (error) {
      this.logger.error({
        correlationId,
        error: error.message,
        stack: error.stack,
        action: 'order.create.failed',
      }, 'Failed to create order');
      
      throw error;
    }
  }
}
```

---

## Log Output Format

### JSON Log Structure

```json
{
  "level": 30,
  "time": 1705312422000,
  "pid": 1,
  "hostname": "order-service-abc123",
  "context": "OrdersService",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "orderId": "ord_12345",
  "userId": "usr_67890",
  "action": "order.create.completed",
  "msg": "Order created successfully",
  "responseTime": 125
}
```

### Log Levels

| Level | Value | Usage |
|-------|-------|-------|
| trace | 10 | Detailed debugging |
| debug | 20 | Debug information |
| info | 30 | Normal operations |
| warn | 40 | Warning conditions |
| error | 50 | Error conditions |
| fatal | 60 | System failures |

---

## Fluent Bit Configuration

### Kubernetes DaemonSet

```yaml
# fluent-bit-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
  namespace: logging
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         5
        Log_Level     info
        Daemon        off
        Parsers_File  parsers.conf

    [INPUT]
        Name              tail
        Tag               kube.*
        Path              /var/log/containers/*.log
        Parser            docker
        DB                /var/log/flb_kube.db
        Mem_Buf_Limit     50MB
        Skip_Long_Lines   On
        Refresh_Interval  10

    [FILTER]
        Name                kubernetes
        Match               kube.*
        Kube_URL            https://kubernetes.default.svc:443
        Kube_CA_File        /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
        Kube_Token_File     /var/run/secrets/kubernetes.io/serviceaccount/token
        Kube_Tag_Prefix     kube.var.log.containers.
        Merge_Log           On
        Merge_Log_Key       log_processed
        K8S-Logging.Parser  On
        K8S-Logging.Exclude Off

    [FILTER]
        Name          parser
        Match         kube.*
        Key_Name      log
        Parser        json
        Reserve_Data  True

    [OUTPUT]
        Name            opensearch
        Match           kube.*
        Host            opensearch.logging.svc.cluster.local
        Port            9200
        Index           logs
        Type            _doc
        Logstash_Format On
        Logstash_Prefix kubernetes
        Retry_Limit     False
        tls             Off

  parsers.conf: |
    [PARSER]
        Name        docker
        Format      json
        Time_Key    time
        Time_Format %Y-%m-%dT%H:%M:%S.%L
        Time_Keep   On

    [PARSER]
        Name        json
        Format      json
        Time_Key    time
        Time_Format %Y-%m-%dT%H:%M:%S.%L
```

---

## OpenSearch Setup

### Docker Compose

```yaml
version: '3.8'

services:
  opensearch:
    image: opensearchproject/opensearch:2.11.0
    environment:
      - discovery.type=single-node
      - bootstrap.memory_lock=true
      - "OPENSEARCH_JAVA_OPTS=-Xms512m -Xmx512m"
      - DISABLE_SECURITY_PLUGIN=true
    ulimits:
      memlock:
        soft: -1
        hard: -1
    ports:
      - "9200:9200"
    volumes:
      - opensearch_data:/usr/share/opensearch/data

  opensearch-dashboards:
    image: opensearchproject/opensearch-dashboards:2.11.0
    ports:
      - "5601:5601"
    environment:
      - OPENSEARCH_HOSTS=["http://opensearch:9200"]
      - DISABLE_SECURITY_DASHBOARDS_PLUGIN=true
    depends_on:
      - opensearch

  fluent-bit:
    image: fluent/fluent-bit:2.2
    volumes:
      - ./fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf
      - /var/log:/var/log:ro
    depends_on:
      - opensearch

volumes:
  opensearch_data:
```

---

## Index Template

```json
PUT _index_template/logs-template
{
  "index_patterns": ["logs-*", "kubernetes-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.lifecycle.name": "logs-policy",
      "index.lifecycle.rollover_alias": "logs"
    },
    "mappings": {
      "properties": {
        "@timestamp": { "type": "date" },
        "level": { "type": "keyword" },
        "message": { "type": "text" },
        "correlationId": { "type": "keyword" },
        "service": { "type": "keyword" },
        "action": { "type": "keyword" },
        "userId": { "type": "keyword" },
        "orderId": { "type": "keyword" },
        "responseTime": { "type": "integer" },
        "error": {
          "properties": {
            "message": { "type": "text" },
            "stack": { "type": "text" }
          }
        }
      }
    }
  }
}
```

---

## Index Lifecycle Management

```json
PUT _ilm/policy/logs-policy
{
  "policy": {
    "phases": {
      "hot": {
        "min_age": "0ms",
        "actions": {
          "rollover": {
            "max_age": "1d",
            "max_size": "10gb"
          }
        }
      },
      "warm": {
        "min_age": "7d",
        "actions": {
          "shrink": {
            "number_of_shards": 1
          },
          "forcemerge": {
            "max_num_segments": 1
          }
        }
      },
      "delete": {
        "min_age": "30d",
        "actions": {
          "delete": {}
        }
      }
    }
  }
}
```

---

## Searching Logs

### Basic Queries

```json
// Find all errors
GET logs-*/_search
{
  "query": {
    "match": { "level": "error" }
  }
}

// Find by correlation ID
GET logs-*/_search
{
  "query": {
    "term": { "correlationId": "550e8400-e29b-41d4-a716-446655440000" }
  },
  "sort": [{ "@timestamp": "asc" }]
}

// Find errors in last hour
GET logs-*/_search
{
  "query": {
    "bool": {
      "must": [
        { "match": { "level": "error" } },
        { "range": { "@timestamp": { "gte": "now-1h" } } }
      ]
    }
  }
}
```

### Aggregations

```json
// Error count by service
GET logs-*/_search
{
  "size": 0,
  "aggs": {
    "errors_by_service": {
      "filter": { "term": { "level": "error" } },
      "aggs": {
        "services": {
          "terms": { "field": "service" }
        }
      }
    }
  }
}

// Response time percentiles
GET logs-*/_search
{
  "size": 0,
  "aggs": {
    "response_percentiles": {
      "percentiles": {
        "field": "responseTime",
        "percents": [50, 90, 95, 99]
      }
    }
  }
}
```

---

## Logging Best Practices

### What to Log

| Log | Don't Log |
|-----|-----------|
| Request ID / Correlation ID | Passwords |
| User ID (not PII) | Credit card numbers |
| Action/Event type | Personal data (PII) |
| Timestamps | Session tokens |
| Error messages & stack | API keys |
| Response times | |

### Log Levels Usage

```typescript
// TRACE - Very detailed debugging
logger.trace({ query }, 'SQL query executed');

// DEBUG - Developer debugging
logger.debug({ userId, cartItems }, 'Cart retrieved');

// INFO - Normal operations
logger.info({ orderId }, 'Order created successfully');

// WARN - Unexpected but handled
logger.warn({ retryCount }, 'Payment retry attempted');

// ERROR - Failures requiring attention
logger.error({ error, orderId }, 'Order processing failed');

// FATAL - System cannot continue
logger.fatal({ error }, 'Database connection lost');
```

---

## Key Takeaways

1. **Structured JSON logs** - Machine-parseable format
2. **Correlation IDs** - Track requests across services
3. **Centralized storage** - Single place to search all logs
4. **Index lifecycle** - Automatic rotation and retention
5. **Sensitive data** - Redact before logging

---

## Next Steps

- Create saved searches in OpenSearch Dashboards
- Set up log-based alerts
- Build log visualizations in Grafana
