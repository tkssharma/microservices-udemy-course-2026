# Dashboards & Visualization with Grafana

## Overview

Grafana is the leading open-source platform for monitoring and observability visualization. It connects to multiple data sources and provides powerful dashboarding capabilities.

---

## Why Grafana?

| Feature | Description |
|---------|-------------|
| Multi-datasource | Prometheus, Elasticsearch, CloudWatch, etc. |
| Rich visualizations | Graphs, tables, heatmaps, gauges |
| Templating | Dynamic dashboards with variables |
| Alerting | Built-in alert rules |
| Sharing | Export, embed, and share dashboards |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Grafana                              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Prometheus  │  │ OpenSearch  │  │   Jaeger    │         │
│  │  (metrics)  │  │   (logs)    │  │  (traces)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          ▼                                  │
│              ┌─────────────────────┐                        │
│              │    Dashboards       │                        │
│              │  - Service Health   │                        │
│              │  - Business Metrics │                        │
│              │  - Infrastructure   │                        │
│              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## Setting Up Grafana

### Docker Compose

```yaml
version: '3.8'

services:
  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    depends_on:
      - prometheus

  prometheus:
    image: prom/prometheus:v2.47.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml

volumes:
  grafana_data:
```

---

## Data Source Configuration

### Provisioning Data Sources

```yaml
# grafana/provisioning/datasources/datasources.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false

  - name: OpenSearch
    type: opensearch
    access: proxy
    url: http://opensearch:9200
    database: logs-*
    jsonData:
      timeField: "@timestamp"
      esVersion: "2.0.0"
      logMessageField: message
      logLevelField: level

  - name: Jaeger
    type: jaeger
    access: proxy
    url: http://jaeger:16686
    editable: false
```

---

## Building Microservices Dashboard

### Dashboard JSON Structure

```json
{
  "dashboard": {
    "title": "Microservices Overview",
    "tags": ["microservices", "production"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": []
  }
}
```

### Essential Panels

#### 1. Request Rate Panel

```json
{
  "title": "Request Rate",
  "type": "timeseries",
  "targets": [
    {
      "expr": "sum(rate(http_requests_total[5m])) by (service)",
      "legendFormat": "{{service}}"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "reqps"
    }
  }
}
```

#### 2. Error Rate Panel

```json
{
  "title": "Error Rate %",
  "type": "timeseries",
  "targets": [
    {
      "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) by (service) / sum(rate(http_requests_total[5m])) by (service) * 100",
      "legendFormat": "{{service}}"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "percent",
      "thresholds": {
        "steps": [
          { "color": "green", "value": null },
          { "color": "yellow", "value": 1 },
          { "color": "red", "value": 5 }
        ]
      }
    }
  }
}
```

#### 3. Latency P95 Panel

```json
{
  "title": "P95 Latency",
  "type": "timeseries",
  "targets": [
    {
      "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))",
      "legendFormat": "{{service}}"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "s"
    }
  }
}
```

#### 4. Service Health Stat Panel

```json
{
  "title": "Services Up",
  "type": "stat",
  "targets": [
    {
      "expr": "sum(up{job=~\".*-service\"})",
      "legendFormat": ""
    }
  ],
  "fieldConfig": {
    "defaults": {
      "thresholds": {
        "steps": [
          { "color": "red", "value": null },
          { "color": "yellow", "value": 2 },
          { "color": "green", "value": 3 }
        ]
      }
    }
  }
}
```

---

## Dashboard Templates with Variables

### Service Variable

```yaml
# Variable configuration
name: service
type: query
query: label_values(http_requests_total, service)
refresh: On Dashboard Load
multi: true
includeAll: true
```

### Using Variables in Queries

```promql
# Filter by selected service
rate(http_requests_total{service=~"$service"}[5m])
```

### Time Range Variable

```promql
# Dynamic time window
rate(http_requests_total[$__rate_interval])
```

---

## Complete Dashboard Provisioning

```yaml
# grafana/provisioning/dashboards/dashboards.yml
apiVersion: 1

providers:
  - name: 'default'
    orgId: 1
    folder: 'Microservices'
    folderUid: 'microservices'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
```

### Service Health Dashboard

```json
{
  "annotations": {
    "list": []
  },
  "title": "Service Health Dashboard",
  "uid": "service-health",
  "version": 1,
  "panels": [
    {
      "id": 1,
      "title": "Request Rate by Service",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 0 },
      "targets": [
        {
          "datasource": "Prometheus",
          "expr": "sum(rate(http_requests_total[5m])) by (service)",
          "legendFormat": "{{service}}"
        }
      ]
    },
    {
      "id": 2,
      "title": "Error Rate by Service",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 0 },
      "targets": [
        {
          "datasource": "Prometheus",
          "expr": "sum(rate(http_requests_total{status=~\"5..\"}[5m])) by (service) / sum(rate(http_requests_total[5m])) by (service) * 100",
          "legendFormat": "{{service}}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "percent",
          "max": 100
        }
      }
    },
    {
      "id": 3,
      "title": "P95 Latency",
      "type": "timeseries",
      "gridPos": { "h": 8, "w": 12, "x": 0, "y": 8 },
      "targets": [
        {
          "datasource": "Prometheus",
          "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service))",
          "legendFormat": "{{service}}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "unit": "s"
        }
      }
    },
    {
      "id": 4,
      "title": "Active Connections",
      "type": "gauge",
      "gridPos": { "h": 8, "w": 12, "x": 12, "y": 8 },
      "targets": [
        {
          "datasource": "Prometheus",
          "expr": "sum(database_connections_active) by (service)",
          "legendFormat": "{{service}}"
        }
      ],
      "fieldConfig": {
        "defaults": {
          "max": 100,
          "thresholds": {
            "steps": [
              { "color": "green", "value": null },
              { "color": "yellow", "value": 70 },
              { "color": "red", "value": 90 }
            ]
          }
        }
      }
    }
  ],
  "templating": {
    "list": [
      {
        "name": "service",
        "type": "query",
        "datasource": "Prometheus",
        "query": "label_values(http_requests_total, service)",
        "refresh": 1,
        "multi": true,
        "includeAll": true
      }
    ]
  },
  "time": {
    "from": "now-1h",
    "to": "now"
  },
  "refresh": "30s"
}
```

---

## Advanced Visualization Types

### Heatmap (Latency Distribution)

```json
{
  "title": "Request Latency Heatmap",
  "type": "heatmap",
  "targets": [
    {
      "expr": "sum(increase(http_request_duration_seconds_bucket[1m])) by (le)",
      "format": "heatmap"
    }
  ],
  "options": {
    "calculate": false,
    "color": {
      "scheme": "Oranges"
    }
  }
}
```

### Table (Top Endpoints)

```json
{
  "title": "Top 10 Slowest Endpoints",
  "type": "table",
  "targets": [
    {
      "expr": "topk(10, histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, path)))",
      "format": "table",
      "instant": true
    }
  ],
  "transformations": [
    {
      "id": "sortBy",
      "options": {
        "sort": [{ "field": "Value", "desc": true }]
      }
    }
  ]
}
```

### Logs Panel (OpenSearch)

```json
{
  "title": "Recent Errors",
  "type": "logs",
  "datasource": "OpenSearch",
  "targets": [
    {
      "query": "level:error",
      "timeField": "@timestamp"
    }
  ],
  "options": {
    "showTime": true,
    "showLabels": true,
    "wrapLogMessage": true
  }
}
```

---

## Dashboard Best Practices

### Layout Guidelines

```
┌─────────────────────────────────────────────────────────────┐
│  Row 1: Key Stats (Stat panels)                             │
│  [Services Up] [Error Rate] [Avg Latency] [Request Rate]    │
├─────────────────────────────────────────────────────────────┤
│  Row 2: Time Series (Main graphs)                           │
│  [Request Rate Over Time]    [Error Rate Over Time]         │
├─────────────────────────────────────────────────────────────┤
│  Row 3: Detailed Views                                      │
│  [Latency by Endpoint]       [Top Errors Table]             │
├─────────────────────────────────────────────────────────────┤
│  Row 4: Infrastructure                                      │
│  [CPU Usage]    [Memory]    [Network]    [Disk]            │
└─────────────────────────────────────────────────────────────┘
```

### Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| Error Rate | < 1% | 1-5% | > 5% |
| P95 Latency | < 200ms | 200-500ms | > 500ms |
| CPU | < 70% | 70-85% | > 85% |
| Memory | < 80% | 80-90% | > 90% |

---

## Alerting in Grafana

```yaml
# Alert rule example
groups:
  - name: service-alerts
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (service) 
          / sum(rate(http_requests_total[5m])) by (service) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ $labels.service }}"
          description: "Error rate is {{ $value | humanizePercentage }}"
```

---

## Key Takeaways

1. **Multi-datasource** - Single pane of glass for metrics, logs, traces
2. **Variables** - Make dashboards reusable and interactive
3. **Provisioning** - Version control your dashboards as code
4. **Thresholds** - Visual indicators for health status
5. **Alerting** - Proactive notification from dashboards

---

## Next Steps

- Create service-specific dashboards
- Set up dashboard-based alerts
- Configure team notifications
