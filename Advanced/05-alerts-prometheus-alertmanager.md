# Alerting with Prometheus Alertmanager & Grafana

## Overview

Alerting notifies teams when systems deviate from expected behavior. Good alerting catches issues before users notice them, while avoiding alert fatigue.

---

## Alerting Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Prometheus                                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               Alert Rules                            │    │
│  │  - High error rate                                   │    │
│  │  - High latency                                      │    │
│  │  - Service down                                      │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │ Firing alerts                     │
└─────────────────────────┼───────────────────────────────────┘
                          ▼
              ┌─────────────────────┐
              │    Alertmanager     │
              │  - Grouping         │
              │  - Inhibition       │
              │  - Silencing        │
              │  - Routing          │
              └──────────┬──────────┘
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
     ┌─────────┐   ┌─────────┐   ┌─────────┐
     │  Slack  │   │  Email  │   │PagerDuty│
     └─────────┘   └─────────┘   └─────────┘
```

---

## Prometheus Alert Rules

### Basic Rule Structure

```yaml
# prometheus/alert-rules.yml
groups:
  - name: microservices
    rules:
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
          /
          sum(rate(http_requests_total[5m])) by (service)
          > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ $labels.service }}"
          description: "Error rate is {{ $value | humanizePercentage }} (threshold: 5%)"
          runbook_url: "https://wiki.example.com/runbooks/high-error-rate"
```

### Essential Alert Rules

```yaml
groups:
  - name: availability
    rules:
      # Service Down
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ $labels.job }} is down"
          description: "{{ $labels.instance }} has been down for more than 1 minute"

      # High Error Rate
      - alert: HighErrorRate
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
          / sum(rate(http_requests_total[5m])) by (service) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate on {{ $labels.service }}"
          description: "Error rate: {{ $value | humanizePercentage }}"

      # No Requests (possible issue)
      - alert: NoTraffic
        expr: |
          sum(rate(http_requests_total[5m])) by (service) == 0
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "No traffic to {{ $labels.service }}"

  - name: latency
    rules:
      # High Latency P95
      - alert: HighLatency
        expr: |
          histogram_quantile(0.95,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
          ) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High P95 latency on {{ $labels.service }}"
          description: "P95 latency: {{ $value | humanizeDuration }}"

      # Very High Latency P99
      - alert: VeryHighLatency
        expr: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket[5m])) by (le, service)
          ) > 2
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Very high P99 latency on {{ $labels.service }}"

  - name: saturation
    rules:
      # High CPU Usage
      - alert: HighCPUUsage
        expr: |
          100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100) > 85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High CPU usage on {{ $labels.instance }}"
          description: "CPU usage: {{ $value | humanize }}%"

      # High Memory Usage
      - alert: HighMemoryUsage
        expr: |
          (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)
          / node_memory_MemTotal_bytes * 100 > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ $labels.instance }}"

      # Disk Space Low
      - alert: DiskSpaceLow
        expr: |
          (node_filesystem_avail_bytes{fstype!="tmpfs"}
          / node_filesystem_size_bytes) * 100 < 10
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Low disk space on {{ $labels.instance }}"

  - name: database
    rules:
      # High DB Connections
      - alert: HighDBConnections
        expr: |
          pg_stat_activity_count / pg_settings_max_connections > 0.8
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connection usage"

      # Slow Queries
      - alert: SlowQueries
        expr: |
          rate(pg_stat_statements_seconds_total[5m])
          / rate(pg_stat_statements_calls_total[5m]) > 1
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Slow database queries detected"
```

---

## Alertmanager Configuration

### Main Config

```yaml
# alertmanager/alertmanager.yml
global:
  smtp_smarthost: 'smtp.example.com:587'
  smtp_from: 'alertmanager@example.com'
  smtp_auth_username: 'alertmanager@example.com'
  smtp_auth_password: 'password'
  slack_api_url: 'https://hooks.slack.com/services/xxx/yyy/zzz'

# Templates
templates:
  - '/etc/alertmanager/templates/*.tmpl'

# Routing tree
route:
  receiver: 'default-receiver'
  group_by: ['alertname', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  
  routes:
    # Critical alerts -> PagerDuty + Slack
    - match:
        severity: critical
      receiver: 'critical-alerts'
      continue: true

    # Warning alerts -> Slack only
    - match:
        severity: warning
      receiver: 'warning-alerts'

    # Database alerts -> DBA team
    - match_re:
        alertname: ^(HighDBConnections|SlowQueries|DatabaseDown)$
      receiver: 'dba-team'

# Inhibition rules
inhibit_rules:
  # If service is down, inhibit high latency alerts
  - source_match:
      alertname: ServiceDown
    target_match:
      alertname: HighLatency
    equal: ['service']

  # If critical, inhibit warning for same issue
  - source_match:
      severity: critical
    target_match:
      severity: warning
    equal: ['alertname', 'service']

# Receivers
receivers:
  - name: 'default-receiver'
    slack_configs:
      - channel: '#alerts'
        send_resolved: true

  - name: 'critical-alerts'
    slack_configs:
      - channel: '#alerts-critical'
        send_resolved: true
        title: '🚨 CRITICAL: {{ .GroupLabels.alertname }}'
        text: '{{ range .Alerts }}{{ .Annotations.description }}{{ end }}'
    pagerduty_configs:
      - service_key: 'your-pagerduty-key'
        severity: critical

  - name: 'warning-alerts'
    slack_configs:
      - channel: '#alerts-warning'
        send_resolved: true
        title: '⚠️ WARNING: {{ .GroupLabels.alertname }}'

  - name: 'dba-team'
    email_configs:
      - to: 'dba@example.com'
    slack_configs:
      - channel: '#dba-alerts'
```

---

## Slack Alert Templates

```yaml
# alertmanager/templates/slack.tmpl
{{ define "slack.default.title" }}
{{ if eq .Status "firing" }}🔥{{ else }}✅{{ end }} [{{ .Status | toUpper }}] {{ .GroupLabels.alertname }}
{{ end }}

{{ define "slack.default.text" }}
{{ range .Alerts }}
*Alert:* {{ .Labels.alertname }}
*Severity:* {{ .Labels.severity }}
*Service:* {{ .Labels.service }}
*Description:* {{ .Annotations.description }}
*Runbook:* {{ .Annotations.runbook_url }}
{{ end }}
{{ end }}
```

---

## Grafana Alerting

### Alert Rule in Grafana

```yaml
# Grafana alert rule (provisioned)
apiVersion: 1

groups:
  - orgId: 1
    name: microservices-alerts
    folder: Alerts
    interval: 1m
    rules:
      - uid: high-error-rate
        title: High Error Rate
        condition: C
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: prometheus
            model:
              expr: sum(rate(http_requests_total{status=~"5.."}[5m])) by (service)
              refId: A
          - refId: B
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: prometheus
            model:
              expr: sum(rate(http_requests_total[5m])) by (service)
              refId: B
          - refId: C
            datasourceUid: __expr__
            model:
              expression: $A / $B > 0.05
              type: math
              refId: C
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: High error rate detected
        noDataState: NoData
        execErrState: Error
```

### Contact Points

```yaml
# Grafana contact points
apiVersion: 1

contactPoints:
  - orgId: 1
    name: slack-alerts
    receivers:
      - uid: slack-receiver
        type: slack
        settings:
          url: https://hooks.slack.com/services/xxx/yyy/zzz
          recipient: "#alerts"
          username: Grafana
          
  - orgId: 1
    name: pagerduty
    receivers:
      - uid: pagerduty-receiver
        type: pagerduty
        settings:
          integrationKey: your-integration-key
          severity: critical
```

---

## SLI/SLO Based Alerting

### Defining SLOs

```yaml
# SLO: 99.9% availability
# Error budget: 0.1% = 43.2 minutes/month

groups:
  - name: slo-alerts
    rules:
      # Burn rate alert (fast burn)
      - alert: SLOBurnRateFast
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m]))
          ) > (14.4 * 0.001)  # 14.4x burn rate
        for: 2m
        labels:
          severity: critical
          slo: availability
        annotations:
          summary: "Fast error budget burn detected"
          description: "Burning error budget 14x faster than allowed"

      # Burn rate alert (slow burn)
      - alert: SLOBurnRateSlow
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[1h]))
            / sum(rate(http_requests_total[1h]))
          ) > (3 * 0.001)  # 3x burn rate
        for: 30m
        labels:
          severity: warning
          slo: availability
        annotations:
          summary: "Slow error budget burn detected"

      # Error budget exhaustion
      - alert: ErrorBudgetExhausted
        expr: |
          1 - (
            sum(increase(http_requests_total{status=~"5.."}[30d]))
            / sum(increase(http_requests_total[30d]))
          ) < 0.999 - 0.001  # Below SLO
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Monthly error budget exhausted"
```

---

## Alert Best Practices

### Alert Severity Guidelines

| Severity | Response Time | Examples |
|----------|---------------|----------|
| **Critical** | Immediate (page) | Service down, data loss risk |
| **Warning** | Hours | High latency, disk 80% full |
| **Info** | Next business day | Approaching thresholds |

### Avoiding Alert Fatigue

```yaml
# ❌ Bad: Too sensitive
- alert: HighLatency
  expr: latency_seconds > 0.1
  for: 1m  # Fires on any spike

# ✅ Good: Sustained issue
- alert: HighLatency
  expr: histogram_quantile(0.95, ...) > 0.5
  for: 10m  # Sustained degradation
```

### Alert Checklist

- [ ] **Actionable** - Someone can do something about it
- [ ] **Meaningful** - Represents real user impact
- [ ] **Documented** - Has runbook link
- [ ] **Tested** - Verified alert fires correctly
- [ ] **Tuned** - Threshold validated over time

---

## Docker Compose Setup

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:v2.47.0
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./prometheus/alert-rules.yml:/etc/prometheus/alert-rules.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--alertmanager.url=http://alertmanager:9093'

  alertmanager:
    image: prom/alertmanager:v0.26.0
    ports:
      - "9093:9093"
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - ./alertmanager/templates:/etc/alertmanager/templates
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'

  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3000:3000"
    environment:
      - GF_UNIFIED_ALERTING_ENABLED=true
    volumes:
      - ./grafana/provisioning:/etc/grafana/provisioning
```

---

## Key Takeaways

1. **Alert on symptoms** - User-facing issues, not internal metrics
2. **Include runbooks** - Link to remediation steps
3. **Group & dedupe** - Alertmanager prevents spam
4. **Use burn rates** - SLO-based alerting is sustainable
5. **Test alerts** - Verify they fire when expected

---

## Next Steps

- Create runbooks for each alert
- Set up on-call rotation
- Implement alert correlation
