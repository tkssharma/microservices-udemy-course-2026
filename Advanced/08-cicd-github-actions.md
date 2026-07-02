# CI/CD with GitHub Actions

## Overview

Continuous Integration and Continuous Deployment (CI/CD) automates building, testing, and deploying microservices. GitHub Actions provides native CI/CD integrated with your repository.

---

## CI/CD Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CI/CD Pipeline                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │  Push   │───▶│  Build  │───▶│  Test   │───▶│  Scan   │  │
│  │ to main │    │  Image  │    │  Suite  │    │Security │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│                                                     │        │
│                                                     ▼        │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Deploy  │◀───│ Deploy  │◀───│  Push   │◀───│  Tag    │  │
│  │  Prod   │    │ Staging │    │Registry │    │ Release │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Complete CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run format:check

  test:
    name: Test
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - name: Run tests
        run: npm run test:cov
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build:
    name: Build Image
    runs-on: ubuntu-latest
    needs: [lint, test]
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=ref,event=branch
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

---

## Security Scanning

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 0 * * 0'

jobs:
  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high
      - uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          tags: scan-target:latest
          load: true
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'scan-target:latest'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'

  codeql:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v2
        with:
          languages: javascript
      - uses: github/codeql-action/autobuild@v2
      - uses: github/codeql-action/analyze@v2
```

---

## Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
    tags: ['v*']

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - uses: azure/setup-kubectl@v3
      - uses: azure/k8s-set-context@v3
        with:
          kubeconfig: ${{ secrets.KUBE_CONFIG_STAGING }}
      - name: Deploy to staging
        run: |
          kubectl set image deployment/order-service \
            order-service=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            -n staging
          kubectl rollout status deployment/order-service -n staging

  smoke-test:
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run smoke tests
        run: |
          npm ci
          npm run test:smoke
        env:
          API_URL: ${{ secrets.STAGING_API_URL }}

  deploy-production:
    needs: smoke-test
    runs-on: ubuntu-latest
    environment: production
    if: startsWith(github.ref, 'refs/tags/v')
    steps:
      - uses: actions/checkout@v4
      - uses: azure/setup-kubectl@v3
      - uses: azure/k8s-set-context@v3
        with:
          kubeconfig: ${{ secrets.KUBE_CONFIG_PRODUCTION }}
      - name: Deploy to production
        run: |
          kubectl set image deployment/order-service \
            order-service=${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} \
            -n production
          kubectl rollout status deployment/order-service -n production
      - name: Create Grafana annotation
        run: |
          curl -X POST ${{ secrets.GRAFANA_URL }}/api/annotations \
            -H "Authorization: Bearer ${{ secrets.GRAFANA_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"text":"Deployed ${{ github.ref_name }}","tags":["deploy","production"]}'
```

---

## Canary Deployment

```yaml
# .github/workflows/canary.yml
name: Canary Deploy

on:
  workflow_dispatch:
    inputs:
      weight:
        description: 'Canary traffic percentage'
        required: true
        default: '10'

jobs:
  canary:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: azure/k8s-set-context@v3
        with:
          kubeconfig: ${{ secrets.KUBE_CONFIG_PRODUCTION }}
      - name: Deploy canary
        run: |
          kubectl apply -f k8s/canary-deployment.yaml
          kubectl annotate ingress api-canary \
            nginx.ingress.kubernetes.io/canary-weight="${{ github.event.inputs.weight }}" \
            --overwrite

  monitor:
    needs: canary
    runs-on: ubuntu-latest
    steps:
      - name: Monitor error rate
        run: |
          sleep 300  # Wait 5 minutes
          ERROR_RATE=$(curl -s "${{ secrets.PROMETHEUS_URL }}/api/v1/query" \
            --data-urlencode 'query=sum(rate(http_requests_total{status=~"5..",version="canary"}[5m]))/sum(rate(http_requests_total{version="canary"}[5m]))' \
            | jq '.data.result[0].value[1]')
          if (( $(echo "$ERROR_RATE > 0.05" | bc -l) )); then
            echo "Error rate too high: $ERROR_RATE"
            exit 1
          fi

  promote-or-rollback:
    needs: monitor
    runs-on: ubuntu-latest
    if: always()
    steps:
      - uses: azure/k8s-set-context@v3
        with:
          kubeconfig: ${{ secrets.KUBE_CONFIG_PRODUCTION }}
      - name: Promote or rollback
        run: |
          if [ "${{ needs.monitor.result }}" == "success" ]; then
            kubectl set image deployment/order-service order-service=$IMAGE -n production
            kubectl delete -f k8s/canary-deployment.yaml
          else
            kubectl delete -f k8s/canary-deployment.yaml
            echo "Canary rolled back due to high error rate"
          fi
```

---

## Reusable Workflows

```yaml
# .github/workflows/reusable-build.yml
name: Reusable Build

on:
  workflow_call:
    inputs:
      service-name:
        required: true
        type: string
      dockerfile-path:
        required: false
        type: string
        default: './Dockerfile'
    outputs:
      image-tag:
        value: ${{ jobs.build.outputs.tag }}

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - id: meta
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ github.repository }}/${{ inputs.service-name }}
      - uses: docker/build-push-action@v5
        with:
          context: ./services/${{ inputs.service-name }}
          file: ${{ inputs.dockerfile-path }}
          push: true
          tags: ${{ steps.meta.outputs.tags }}
```

### Calling Reusable Workflow

```yaml
# .github/workflows/build-services.yml
name: Build All Services

on:
  push:
    branches: [main]

jobs:
  build-order-service:
    uses: ./.github/workflows/reusable-build.yml
    with:
      service-name: order-service

  build-user-service:
    uses: ./.github/workflows/reusable-build.yml
    with:
      service-name: user-service
```

---

## Matrix Builds for Multiple Services

```yaml
name: Build Services Matrix

on:
  push:
    branches: [main]

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      services: ${{ steps.filter.outputs.changes }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: filter
        with:
          filters: |
            order-service:
              - 'services/order-service/**'
            user-service:
              - 'services/user-service/**'
            payment-service:
              - 'services/payment-service/**'

  build:
    needs: changes
    if: ${{ needs.changes.outputs.services != '[]' }}
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: ${{ fromJson(needs.changes.outputs.services) }}
    steps:
      - uses: actions/checkout@v4
      - name: Build ${{ matrix.service }}
        run: |
          cd services/${{ matrix.service }}
          docker build -t ${{ matrix.service }}:${{ github.sha }} .
```

---

## Environment Protection Rules

Configure in GitHub Settings → Environments:

| Environment | Rules |
|-------------|-------|
| **staging** | No approvals, deploy on push |
| **production** | Required reviewers, wait 5 min |

---

## Secrets Management

```yaml
# Using secrets in workflows
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  
# Using environment-specific secrets
jobs:
  deploy:
    environment: production
    env:
      API_KEY: ${{ secrets.PROD_API_KEY }}
```

---

## Workflow Status Badge

```markdown
![CI](https://github.com/owner/repo/actions/workflows/ci.yml/badge.svg)
```

---

## Key Takeaways

1. **Parallel jobs** - Run lint, test, scan concurrently
2. **Environments** - Separate staging/production configs
3. **Reusable workflows** - DRY principle for CI/CD
4. **Matrix builds** - Build only changed services
5. **Security scanning** - Automated vulnerability detection
6. **Canary deploys** - Safe production rollouts

---

## Next Steps

- Set up GitHub Environments
- Configure branch protection rules
- Implement feature flags for gradual rollouts
