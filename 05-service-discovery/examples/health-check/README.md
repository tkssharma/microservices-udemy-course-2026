# Health Check Pattern Example

Demonstrates Kubernetes-style health checks for service discovery.

## Endpoints

- **GET /health/live** - Liveness probe (is process alive?)
- **GET /health/ready** - Readiness probe (can handle traffic?)
- **GET /health** - Full health with dependency checks

## Run

```bash
cd service
npm install
npm run dev
```

## Test

```bash
# Immediately after start (not ready)
curl http://localhost:3000/health/ready
# {"status":"not ready","message":"Initializing..."}

# After 5 seconds (ready)
curl http://localhost:3000/health/ready
# {"status":"ready"}

# Full health check
curl http://localhost:3000/health
```

## Kubernetes Usage

```yaml
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 3
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

## Key Points

- **Liveness**: Restart container if probe fails
- **Readiness**: Remove from load balancer if not ready
- Check dependencies (DB, cache) in full health endpoint
