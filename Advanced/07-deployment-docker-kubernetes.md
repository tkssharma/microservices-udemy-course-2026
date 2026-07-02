# Deployment with Docker & Kubernetes

## Overview

Containerization with Docker and orchestration with Kubernetes are foundational for deploying microservices at scale. This module covers production-ready deployment strategies.

---

## Docker for Microservices

### Multi-Stage Dockerfile

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files first (layer caching)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Production stage
FROM node:20-alpine AS production

# Security: run as non-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

WORKDIR /app

# Copy only necessary files
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### Docker Compose for Local Development

```yaml
# docker-compose.yml
version: '3.8'

services:
  # Application Services
  order-service:
    build:
      context: ./services/order-service
      dockerfile: Dockerfile
    ports:
      - "3001:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/orders
      - REDIS_URL=redis://redis:6379
      - RABBITMQ_URL=amqp://rabbitmq:5672
      - JAEGER_ENDPOINT=http://jaeger:14268/api/traces
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
      rabbitmq:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  user-service:
    build:
      context: ./services/user-service
      dockerfile: Dockerfile
    ports:
      - "3002:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/users
      - REDIS_URL=redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy

  api-gateway:
    build:
      context: ./services/api-gateway
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - ORDER_SERVICE_URL=http://order-service:3000
      - USER_SERVICE_URL=http://user-service:3000
    depends_on:
      - order-service
      - user-service

  # Infrastructure
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_MULTIPLE_DATABASES: orders,users
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init-multiple-dbs.sh:/docker-entrypoint-initdb.d/init.sh
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "15672:15672"
    healthcheck:
      test: rabbitmq-diagnostics -q ping
      interval: 10s
      timeout: 5s
      retries: 5

  # Observability
  prometheus:
    image: prom/prometheus:v2.47.0
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml

  grafana:
    image: grafana/grafana:10.2.0
    ports:
      - "3003:3000"
    volumes:
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning

  jaeger:
    image: jaegertracing/all-in-one:1.52
    ports:
      - "16686:16686"
      - "14268:14268"

volumes:
  postgres_data:
  redis_data:
```

---

## Kubernetes Deployment

### Namespace & Resource Quotas

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: microservices
  labels:
    name: microservices
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: microservices-quota
  namespace: microservices
spec:
  hard:
    requests.cpu: "10"
    requests.memory: 20Gi
    limits.cpu: "20"
    limits.memory: 40Gi
    pods: "50"
```

### ConfigMap & Secrets

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: order-service-config
  namespace: microservices
data:
  NODE_ENV: "production"
  LOG_LEVEL: "info"
  SERVICE_NAME: "order-service"
---
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: order-service-secrets
  namespace: microservices
type: Opaque
stringData:
  DATABASE_URL: "postgresql://user:password@postgres:5432/orders"
  REDIS_URL: "redis://redis:6379"
  JWT_SECRET: "your-secret-key"
```

### Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
  namespace: microservices
  labels:
    app: order-service
    version: v1
spec:
  replicas: 3
  selector:
    matchLabels:
      app: order-service
  template:
    metadata:
      labels:
        app: order-service
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3000"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: order-service
      containers:
        - name: order-service
          image: registry.example.com/order-service:v1.2.3
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
          envFrom:
            - configMapRef:
                name: order-service-config
            - secretRef:
                name: order-service-secrets
          resources:
            requests:
              cpu: "100m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          lifecycle:
            preStop:
              exec:
                command: ["sleep", "10"]
      terminationGracePeriodSeconds: 30
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: order-service
                topologyKey: kubernetes.io/hostname
```

### Service

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: order-service
  namespace: microservices
  labels:
    app: order-service
spec:
  type: ClusterIP
  ports:
    - name: http
      port: 80
      targetPort: 3000
      protocol: TCP
  selector:
    app: order-service
```

### Horizontal Pod Autoscaler

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
  namespace: microservices
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
```

### Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  namespace: microservices
  annotations:
    kubernetes.io/ingress.class: nginx
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - api.example.com
      secretName: api-tls
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /api/orders
            pathType: Prefix
            backend:
              service:
                name: order-service
                port:
                  number: 80
          - path: /api/users
            pathType: Prefix
            backend:
              service:
                name: user-service
                port:
                  number: 80
```

---

## Deployment Strategies

### Rolling Update (Default)

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%
```

### Blue-Green Deployment

```yaml
# blue-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service-blue
spec:
  replicas: 3
  selector:
    matchLabels:
      app: order-service
      version: blue
  template:
    metadata:
      labels:
        app: order-service
        version: blue
    spec:
      containers:
        - name: order-service
          image: registry.example.com/order-service:v1.0.0

---
# green-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: order-service
      version: green
  template:
    metadata:
      labels:
        app: order-service
        version: green
    spec:
      containers:
        - name: order-service
          image: registry.example.com/order-service:v2.0.0

---
# service.yaml - Switch between blue/green
apiVersion: v1
kind: Service
metadata:
  name: order-service
spec:
  selector:
    app: order-service
    version: blue  # Change to 'green' to switch
```

### Canary Deployment with Nginx Ingress

```yaml
# canary-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: order-service-canary
  annotations:
    nginx.ingress.kubernetes.io/canary: "true"
    nginx.ingress.kubernetes.io/canary-weight: "10"
spec:
  rules:
    - host: api.example.com
      http:
        paths:
          - path: /api/orders
            pathType: Prefix
            backend:
              service:
                name: order-service-canary
                port:
                  number: 80
```

---

## Health Checks Implementation

```typescript
// health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private memory: MemoryHealthIndicator,
    @InjectRedis() private redis: Redis,
  ) {}

  @Get('live')
  @HealthCheck()
  liveness() {
    // Basic check - is the process running?
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  readiness() {
    // Full check - can we serve traffic?
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.checkRedis(),
      () => this.memory.checkHeap('memory_heap', 200 * 1024 * 1024),
    ]);
  }

  private async checkRedis() {
    try {
      await this.redis.ping();
      return { redis: { status: 'up' } };
    } catch (error) {
      return { redis: { status: 'down', error: error.message } };
    }
  }
}
```

---

## Monitoring Deployments

### Deployment Annotations for Grafana

```yaml
# Create annotation on deploy
apiVersion: batch/v1
kind: Job
metadata:
  name: grafana-annotation
  annotations:
    argocd.argoproj.io/hook: PostSync
spec:
  template:
    spec:
      containers:
        - name: annotate
          image: curlimages/curl
          command:
            - curl
            - -X
            - POST
            - http://grafana:3000/api/annotations
            - -H
            - "Content-Type: application/json"
            - -d
            - '{"text":"Deployed order-service v1.2.3","tags":["deployment","order-service"]}'
      restartPolicy: Never
```

### Prometheus Rules for Deployment Monitoring

```yaml
groups:
  - name: deployment
    rules:
      - alert: DeploymentReplicasMismatch
        expr: |
          kube_deployment_spec_replicas != kube_deployment_status_available_replicas
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Deployment {{ $labels.deployment }} replicas mismatch"

      - alert: PodCrashLooping
        expr: |
          rate(kube_pod_container_status_restarts_total[15m]) * 60 * 15 > 3
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Pod {{ $labels.pod }} is crash looping"

      - alert: DeploymentRolloutStuck
        expr: |
          kube_deployment_status_condition{condition="Progressing",status="false"} == 1
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Deployment {{ $labels.deployment }} rollout is stuck"
```

---

## Kustomize for Environment Management

```
├── base/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── kustomization.yaml
├── overlays/
│   ├── development/
│   │   ├── kustomization.yaml
│   │   ├── replicas-patch.yaml
│   ├── staging/
│   │   ├── kustomization.yaml
│   ├── production/
│   │   ├── kustomization.yaml
│   │   ├── replicas-patch.yaml
│   │   ├── resources-patch.yaml
```

```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - service.yaml
  - hpa.yaml

# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: production
bases:
  - ../../base
patchesStrategicMerge:
  - replicas-patch.yaml
  - resources-patch.yaml
images:
  - name: order-service
    newTag: v1.2.3
```

---

## Key Takeaways

1. **Multi-stage builds** - Smaller, secure images
2. **Health checks** - Liveness vs Readiness
3. **Resource limits** - Prevent noisy neighbors
4. **HPA** - Auto-scale based on metrics
5. **Deployment strategies** - Rolling, Blue-Green, Canary

---

## Next Steps

- Set up GitOps with ArgoCD
- Implement progressive delivery
- Configure pod disruption budgets
