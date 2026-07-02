# Pattern 2: Sidecar & Ambassador Pattern

## Sidecar Pattern

### What is it?

The Sidecar pattern deploys helper components alongside your main service in the same pod/container group. The sidecar handles cross-cutting concerns without modifying the main application code.

```
┌─────────────────────────────────────────────────────────────┐
│                         POD / HOST                           │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │    Main Service     │    │      Sidecar        │        │
│  │   ───────────────   │◀──▶│   ─────────────     │        │
│  │  • Business Logic   │    │  • Logging Agent    │        │
│  │  • API Endpoints    │    │  • Config Refresh   │        │
│  │                     │    │  • Service Mesh     │        │
│  │    localhost:3000   │    │  • Metrics Export   │        │
│  └─────────────────────┘    └─────────────────────┘        │
│            │                          │                     │
│            └──────────┬───────────────┘                     │
│                       ▼                                     │
│              Shared Network/Volume                          │
└─────────────────────────────────────────────────────────────┘
```

### Common Sidecar Use Cases

| Use Case         | Sidecar Component    | Purpose                     |
| ---------------- | -------------------- | --------------------------- |
| **Logging**      | Fluent Bit, Filebeat | Ship logs to central system |
| **Monitoring**   | Prometheus exporter  | Expose metrics              |
| **Service Mesh** | Envoy, Linkerd       | Traffic management, mTLS    |
| **Config**       | Consul agent         | Dynamic configuration       |
| **Security**     | Vault agent          | Secret injection            |

---

### Kubernetes Sidecar Example

```yaml
# k8s/deployment-with-sidecar.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
    spec:
      containers:
        # Main application
        - name: order-service
          image: order-service:latest
          ports:
            - containerPort: 3000
          volumeMounts:
            - name: logs
              mountPath: /app/logs
          env:
            - name: LOG_PATH
              value: /app/logs/app.log

        # Logging sidecar
        - name: log-shipper
          image: fluent/fluent-bit:latest
          volumeMounts:
            - name: logs
              mountPath: /app/logs
            - name: fluent-bit-config
              mountPath: /fluent-bit/etc/
          resources:
            limits:
              memory: '128Mi'
              cpu: '100m'

        # Metrics sidecar
        - name: metrics-exporter
          image: prom/statsd-exporter:latest
          ports:
            - containerPort: 9102

      volumes:
        - name: logs
          emptyDir: {}
        - name: fluent-bit-config
          configMap:
            name: fluent-bit-config
```

### Fluent Bit Sidecar Configuration

```yaml
# k8s/fluent-bit-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: fluent-bit-config
data:
  fluent-bit.conf: |
    [SERVICE]
        Flush         5
        Daemon        Off
        Log_Level     info

    [INPUT]
        Name          tail
        Path          /app/logs/*.log
        Tag           order-service

    [OUTPUT]
        Name          opensearch
        Match         *
        Host          opensearch.logging.svc
        Port          9200
        Index         orders
```

---

## Ambassador Pattern

### What is it?

The Ambassador pattern is a specialized sidecar that handles outbound connections on behalf of the main service. It acts as an out-of-process proxy for network requests.

```
┌─────────────────────────────────────────────────────────────┐
│                         POD / HOST                           │
│  ┌─────────────────────┐    ┌─────────────────────┐        │
│  │    Main Service     │───▶│     Ambassador      │        │
│  │                     │    │   ─────────────     │        │
│  │  HTTP Request to    │    │  • Retry Logic      │        │
│  │  localhost:8080     │    │  • Circuit Breaker  │        │
│  │                     │    │  • Rate Limiting    │        │
│  └─────────────────────┘    │  • Auth Headers     │        │
│                             └──────────┬──────────┘        │
│                                        │                    │
└────────────────────────────────────────┼────────────────────┘
                                         ▼
                              ┌─────────────────────┐
                              │  External Service   │
                              └─────────────────────┘
```

### Ambassador Use Cases

- **Legacy service integration** - Add modern resilience patterns
- **Third-party API calls** - Centralize retry/auth logic
- **Circuit breaking** - Protect against downstream failures
- **Request transformation** - Modify headers, payloads

---

### Ambassador with Envoy Example

```yaml
# k8s/ambassador-envoy.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: envoy-config
data:
  envoy.yaml: |
    static_resources:
      listeners:
        - name: listener_0
          address:
            socket_address:
              address: 0.0.0.0
              port_value: 8080
          filter_chains:
            - filters:
                - name: envoy.filters.network.http_connection_manager
                  typed_config:
                    "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                    stat_prefix: ingress_http
                    route_config:
                      name: local_route
                      virtual_hosts:
                        - name: backend
                          domains: ["*"]
                          routes:
                            - match:
                                prefix: "/"
                              route:
                                cluster: external_api
                                retry_policy:
                                  retry_on: "5xx,connect-failure"
                                  num_retries: 3
                    http_filters:
                      - name: envoy.filters.http.router
      clusters:
        - name: external_api
          connect_timeout: 5s
          type: LOGICAL_DNS
          lb_policy: ROUND_ROBIN
          circuit_breakers:
            thresholds:
              - max_connections: 100
                max_pending_requests: 100
                max_requests: 100
          load_assignment:
            cluster_name: external_api
            endpoints:
              - lb_endpoints:
                  - endpoint:
                      address:
                        socket_address:
                          address: api.external.com
                          port_value: 443
```

---

## Service Mesh (Sidecar at Scale)

Service meshes deploy sidecars to every service, creating a network of proxies.

```
┌─────────────────────────────────────────────────────────────┐
│                      SERVICE MESH                            │
│                                                              │
│   ┌──────────────────┐          ┌──────────────────┐       │
│   │ ┌──────┐┌──────┐ │  mTLS    │ ┌──────┐┌──────┐ │       │
│   │ │ Svc  ││Envoy │◀┼─────────▶┼─│Envoy ││ Svc  │ │       │
│   │ │  A   ││Proxy │ │          │ │Proxy ││  B   │ │       │
│   │ └──────┘└──────┘ │          │ └──────┘└──────┘ │       │
│   └──────────────────┘          └──────────────────┘       │
│            │                             │                  │
│            └─────────────┬───────────────┘                  │
│                          ▼                                  │
│                ┌──────────────────┐                        │
│                │   Control Plane   │                        │
│                │  (Istio/Linkerd)  │                        │
│                └──────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Popular Service Meshes

| Mesh               | Proxy          | Best For                       |
| ------------------ | -------------- | ------------------------------ |
| **Istio**          | Envoy          | Feature-rich, complex setups   |
| **Linkerd**        | linkerd2-proxy | Lightweight, Kubernetes native |
| **Consul Connect** | Envoy          | HashiCorp ecosystem            |

---

### NestJS with Sidecar Communication

```typescript
// src/external-api/external-api.service.ts
import { Injectable, HttpService } from '@nestjs/common';

@Injectable()
export class ExternalApiService {
  constructor(private httpService: HttpService) {}

  async callExternalApi(data: any) {
    // Call goes through ambassador sidecar at localhost:8080
    // Ambassador handles: retry, circuit breaking, auth headers
    const response = await this.httpService.axiosRef.post('http://localhost:8080/api/resource', data);
    return response.data;
  }
}
```

```typescript
// src/app.module.ts
import { Module, HttpModule } from '@nestjs/common';
import { ExternalApiService } from './external-api/external-api.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
      // No retry logic needed - ambassador handles it
    }),
  ],
  providers: [ExternalApiService],
})
export class AppModule {}
```

---

## Sidecar vs Ambassador

| Aspect                | Sidecar                     | Ambassador                    |
| --------------------- | --------------------------- | ----------------------------- |
| **Traffic Direction** | Inbound + auxiliary         | Outbound                      |
| **Purpose**           | Extend service capabilities | Proxy external calls          |
| **Examples**          | Logging, metrics, mesh      | API calls, legacy integration |

---

## Benefits

✅ **Language agnostic** - Works with any technology  
✅ **Separation of concerns** - Main app stays focused  
✅ **Consistent infrastructure** - Same sidecar for all services  
✅ **Independent updates** - Update sidecar without touching app

## Drawbacks

❌ **Increased latency** - Extra network hop  
❌ **Resource overhead** - Each pod needs extra containers  
❌ **Complexity** - More components to manage  
❌ **Debugging difficulty** - Harder to trace issues

---

## Key Takeaways

1. **Sidecar** adds capabilities without changing application code
2. **Ambassador** is a specialized sidecar for outbound traffic
3. **Service Mesh** applies sidecar pattern across all services
4. Use when cross-cutting concerns need to be consistent across services
5. Consider resource and latency overhead in your design

---

## 📊 Eraser.io Diagram Code

```eraser
// Sidecar Pattern
Pod [icon: box, color: blue] {
  Main Service [icon: server, color: green]
  Logging Sidecar [icon: file-text, color: orange]
  Metrics Sidecar [icon: bar-chart, color: purple]
}

Shared Volume [icon: database]
Log Aggregator [icon: layers, color: red]
Prometheus [icon: activity, color: orange]

Main Service <--> Logging Sidecar: localhost
Main Service <--> Metrics Sidecar: localhost
Logging Sidecar --> Shared Volume
Logging Sidecar --> Log Aggregator
Metrics Sidecar --> Prometheus
```

```eraser
// Service Mesh Pattern
Service A Pod [icon: box, color: blue] {
  App A [icon: server]
  Envoy Proxy [icon: shield, color: orange]
}

Service B Pod [icon: box, color: blue] {
  App B [icon: server]
  Envoy Proxy [icon: shield, color: orange]
}

Control Plane [icon: settings, color: purple] {
  Istiod [icon: cpu]
  Config [icon: file]
  Certs [icon: lock]
}

Service A Pod <--> Service B Pod: mTLS
Service A Pod --> Control Plane: Config sync
Service B Pod --> Control Plane: Config sync
```
