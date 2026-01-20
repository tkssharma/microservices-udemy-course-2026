# Lesson 2.6: Migration Best Practices

## Introduction

Migrating from a monolith to microservices is a journey that can take months or years. This lesson covers proven best practices and common pitfalls to help you succeed.

---

## The Migration Mindset

```
┌─────────────────────────────────────────────────────────────┐
│                  MIGRATION MINDSET                           │
│                                                              │
│  Wrong Mindset:                                             │
│  ──────────────                                             │
│  "We need to rewrite everything as microservices"           │
│  "Microservices will solve all our problems"                │
│  "We'll be done in 6 months"                                │
│                                                              │
│  Right Mindset:                                             │
│  ─────────────                                              │
│  "We'll incrementally improve our architecture"             │
│  "We'll extract services where it makes sense"              │
│  "This is an ongoing evolution, not a project"              │
│  "Some parts may stay as monolith forever"                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Best Practice 1: Start Small

### Extract One Service First

```
┌─────────────────────────────────────────────────────────────┐
│                    START SMALL                               │
│                                                              │
│  First Service Criteria:                                    │
│  ───────────────────────                                    │
│  ✓ Low risk (not critical path)                             │
│  ✓ Few dependencies                                         │
│  ✓ Clear boundaries                                         │
│  ✓ Small team can own it                                    │
│  ✓ Easy to test                                             │
│                                                              │
│  Good First Services:          Bad First Services:          │
│  ───────────────────           ────────────────────         │
│  • Notification/Email          • User/Authentication        │
│  • File Upload                 • Order Processing           │
│  • Analytics/Reporting         • Payment                    │
│  • Search                      • Core Business Logic        │
│                                                              │
│  Learn from the first extraction before scaling up.        │
└─────────────────────────────────────────────────────────────┘
```

### Build the Platform First

```
┌─────────────────────────────────────────────────────────────┐
│              BUILD PLATFORM CAPABILITIES                     │
│                                                              │
│  Before extracting services, ensure you have:               │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Infrastructure                                       │   │
│  │ [ ] Container orchestration (Kubernetes/ECS)        │   │
│  │ [ ] CI/CD pipelines                                 │   │
│  │ [ ] Service discovery                               │   │
│  │ [ ] Load balancing                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Observability                                        │   │
│  │ [ ] Centralized logging                             │   │
│  │ [ ] Distributed tracing                             │   │
│  │ [ ] Metrics and dashboards                          │   │
│  │ [ ] Alerting                                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Development                                          │   │
│  │ [ ] Service template/boilerplate                    │   │
│  │ [ ] Local development environment                   │   │
│  │ [ ] API documentation standards                     │   │
│  │ [ ] Testing strategy                                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Best Practice 2: Maintain Feature Parity

### Ensure Identical Behavior

```
┌─────────────────────────────────────────────────────────────┐
│                 FEATURE PARITY                               │
│                                                              │
│  The new service must behave exactly like the monolith:    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Verification Checklist                               │   │
│  │                                                      │   │
│  │ [ ] Same API endpoints                              │   │
│  │ [ ] Same request/response format                    │   │
│  │ [ ] Same error codes and messages                   │   │
│  │ [ ] Same validation rules                           │   │
│  │ [ ] Same business logic                             │   │
│  │ [ ] Same edge cases handled                         │   │
│  │ [ ] Same performance characteristics                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Technique: Shadow Testing                                  │
│  ─────────────────────────                                  │
│  Send same requests to both old and new service.           │
│  Compare responses. Log differences.                        │
└─────────────────────────────────────────────────────────────┘
```

### Shadow Testing Implementation

```typescript
// Shadow testing middleware
async function shadowTest(req: Request, res: Response, next: NextFunction) {
  // Call new service in background (don't wait)
  callNewService(req)
    .then((newResponse) => {
      // Compare with monolith response
      const monolithResponse = res.locals.monolithResponse;

      if (!deepEqual(monolithResponse, newResponse)) {
        logger.warn('Shadow test mismatch', {
          endpoint: req.path,
          monolith: monolithResponse,
          newService: newResponse,
          requestId: req.headers['x-request-id'],
        });
      }
    })
    .catch((error) => {
      logger.error('Shadow test failed', { error });
    });

  next();
}
```

---

## Best Practice 3: Use Feature Flags

### Gradual Rollout

```
┌─────────────────────────────────────────────────────────────┐
│                   FEATURE FLAGS                              │
│                                                              │
│  Rollout Strategy:                                          │
│  ─────────────────                                          │
│                                                              │
│  Week 1: 0% → Internal testing only                        │
│  Week 2: 1% → Canary with monitoring                       │
│  Week 3: 10% → Expand if no issues                         │
│  Week 4: 50% → Half traffic                                │
│  Week 5: 100% → Full rollout                               │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                      │   │
│  │  Traffic Split:                                      │   │
│  │                                                      │   │
│  │  Week 1: [████████████████████] 100% Monolith       │   │
│  │  Week 2: [█                   ] 1% New Service      │   │
│  │  Week 3: [██                  ] 10% New Service     │   │
│  │  Week 4: [██████████          ] 50% New Service     │   │
│  │  Week 5: [████████████████████] 100% New Service    │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Feature Flag Implementation

```typescript
// Feature flag service
interface FeatureFlags {
  useNewProductService: boolean;
  newProductServicePercentage: number;
}

class FeatureFlagService {
  private flags: FeatureFlags;

  shouldUseNewService(userId: string): boolean {
    if (!this.flags.useNewProductService) {
      return false;
    }

    // Consistent routing based on user ID
    const hash = this.hashUserId(userId);
    return hash < this.flags.newProductServicePercentage;
  }

  private hashUserId(userId: string): number {
    // Returns 0-100 based on user ID
    // Same user always gets same result
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = (hash << 5) - hash + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }
}
```

---

## Best Practice 4: Implement Proper Monitoring

### Key Metrics to Track

```
┌─────────────────────────────────────────────────────────────┐
│                 MONITORING METRICS                           │
│                                                              │
│  Compare Old vs New:                                        │
│  ───────────────────                                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Metric              │ Monolith │ New Service │ Diff  │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Request latency p50 │  45ms    │    42ms     │  -7%  │   │
│  │ Request latency p99 │  200ms   │    180ms    │ -10%  │   │
│  │ Error rate          │  0.1%    │    0.1%     │   0%  │   │
│  │ Requests/sec        │  1000    │    1000     │   0%  │   │
│  │ CPU usage           │  40%     │    35%      │ -12%  │   │
│  │ Memory usage        │  2GB     │    1.5GB    │ -25%  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Alert if new service performs worse than monolith.        │
└─────────────────────────────────────────────────────────────┘
```

### Dashboard Example

```
┌─────────────────────────────────────────────────────────────┐
│              MIGRATION DASHBOARD                             │
│                                                              │
│  Traffic Split:                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Monolith: ████████████████ 80%                      │   │
│  │ New Svc:  ████ 20%                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Error Rate Comparison:                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │     ^                                                │   │
│  │ 1%  │                                                │   │
│  │     │  ──── Monolith                                │   │
│  │ 0.5%│  .... New Service                             │   │
│  │     │                                                │   │
│  │ 0%  └────────────────────────────────────────▶      │   │
│  │         Time                                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  Latency Comparison:                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ p50: Monolith 45ms | New 42ms ✓                     │   │
│  │ p99: Monolith 200ms | New 180ms ✓                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Best Practice 5: Plan for Rollback

### Instant Rollback Capability

```
┌─────────────────────────────────────────────────────────────┐
│                  ROLLBACK STRATEGY                           │
│                                                              │
│  Rollback Triggers:                                         │
│  ──────────────────                                         │
│  • Error rate > 1%                                          │
│  • Latency p99 > 500ms                                      │
│  • Any 5xx errors spike                                     │
│  • Data inconsistency detected                              │
│  • Customer complaints                                      │
│                                                              │
│  Rollback Process:                                          │
│  ─────────────────                                          │
│  1. Flip feature flag to 0%                                │
│  2. All traffic goes to monolith                           │
│  3. Investigate issue                                       │
│  4. Fix and redeploy new service                           │
│  5. Resume gradual rollout                                  │
│                                                              │
│  Time to Rollback: < 1 minute                              │
│  (Feature flag change, no deployment needed)                │
└─────────────────────────────────────────────────────────────┘
```

### Automated Rollback

```typescript
// Automated rollback based on metrics
class AutoRollback {
  private readonly thresholds = {
    errorRate: 0.01, // 1%
    latencyP99: 500, // 500ms
    consecutiveErrors: 10,
  };

  private errorCount = 0;

  async checkHealth(metrics: ServiceMetrics): Promise<void> {
    if (metrics.errorRate > this.thresholds.errorRate) {
      await this.triggerRollback('Error rate exceeded threshold');
      return;
    }

    if (metrics.latencyP99 > this.thresholds.latencyP99) {
      await this.triggerRollback('Latency exceeded threshold');
      return;
    }
  }

  async triggerRollback(reason: string): Promise<void> {
    logger.error('Auto-rollback triggered', { reason });

    // Disable feature flag
    await this.featureFlagService.disable('useNewProductService');

    // Alert team
    await this.alertService.sendAlert({
      severity: 'critical',
      message: `Auto-rollback: ${reason}`,
      service: 'product-service',
    });
  }
}
```

---

## Best Practice 6: Handle Data Migration Carefully

### Data Migration Phases

```
┌─────────────────────────────────────────────────────────────┐
│               DATA MIGRATION PHASES                          │
│                                                              │
│  Phase 1: Dual Write                                        │
│  ───────────────────                                        │
│  ┌─────────────┐                                           │
│  │  Monolith   │──write──▶ Old DB                          │
│  │             │──write──▶ New DB (via sync)               │
│  └─────────────┘                                           │
│  Both databases have same data.                             │
│                                                              │
│  Phase 2: Dual Read                                         │
│  ──────────────────                                         │
│  ┌─────────────┐                                           │
│  │ New Service │──read───▶ New DB                          │
│  │             │──verify─▶ Old DB (shadow)                 │
│  └─────────────┘                                           │
│  Verify new DB has correct data.                            │
│                                                              │
│  Phase 3: Cutover                                           │
│  ─────────────────                                          │
│  ┌─────────────┐                                           │
│  │ New Service │──read/write──▶ New DB                     │
│  └─────────────┘                                           │
│  Old DB no longer used for this data.                       │
│                                                              │
│  Phase 4: Cleanup                                           │
│  ────────────────                                           │
│  Remove old tables from monolith database.                  │
└─────────────────────────────────────────────────────────────┘
```

### Data Sync Verification

```typescript
// Verify data sync between old and new databases
async function verifyDataSync(): Promise<SyncReport> {
  const report: SyncReport = {
    totalRecords: 0,
    matchingRecords: 0,
    missingInNew: [],
    missingInOld: [],
    mismatches: [],
  };

  // Get all records from old DB
  const oldRecords = await oldDb.query('SELECT * FROM products');

  for (const oldRecord of oldRecords) {
    report.totalRecords++;

    const newRecord = await newDb.findById(oldRecord.id);

    if (!newRecord) {
      report.missingInNew.push(oldRecord.id);
      continue;
    }

    if (!deepEqual(oldRecord, newRecord)) {
      report.mismatches.push({
        id: oldRecord.id,
        old: oldRecord,
        new: newRecord,
      });
      continue;
    }

    report.matchingRecords++;
  }

  return report;
}
```

---

## Best Practice 7: Communicate and Document

### Migration Documentation

```
┌─────────────────────────────────────────────────────────────┐
│              MIGRATION DOCUMENTATION                         │
│                                                              │
│  For Each Extracted Service:                                │
│  ───────────────────────────                                │
│                                                              │
│  1. Architecture Decision Record (ADR)                      │
│     - Why this service was extracted                        │
│     - Boundaries and responsibilities                       │
│     - Trade-offs considered                                 │
│                                                              │
│  2. API Documentation                                       │
│     - Endpoints                                             │
│     - Request/response schemas                              │
│     - Error codes                                           │
│                                                              │
│  3. Runbook                                                 │
│     - How to deploy                                         │
│     - How to rollback                                       │
│     - Common issues and fixes                               │
│                                                              │
│  4. Data Migration Log                                      │
│     - What data was migrated                                │
│     - Sync strategy used                                    │
│     - Verification results                                  │
└─────────────────────────────────────────────────────────────┘
```

### Team Communication

```
┌─────────────────────────────────────────────────────────────┐
│              COMMUNICATION PLAN                              │
│                                                              │
│  Before Migration:                                          │
│  ─────────────────                                          │
│  • Announce plan to all stakeholders                        │
│  • Share timeline and milestones                            │
│  • Identify dependencies with other teams                   │
│                                                              │
│  During Migration:                                          │
│  ─────────────────                                          │
│  • Weekly status updates                                    │
│  • Immediate notification of issues                         │
│  • Share metrics dashboard                                  │
│                                                              │
│  After Migration:                                           │
│  ────────────────                                           │
│  • Retrospective                                            │
│  • Document lessons learned                                 │
│  • Share success metrics                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Common Pitfalls to Avoid

### Pitfall 1: Big Bang Migration

```
┌─────────────────────────────────────────────────────────────┐
│              PITFALL: BIG BANG MIGRATION                     │
│                                                              │
│  Mistake:                                                   │
│  "Let's rewrite everything and switch over on launch day"  │
│                                                              │
│  Why It Fails:                                              │
│  • Too many unknowns                                        │
│  • No way to validate incrementally                         │
│  • Rollback is impossible                                   │
│  • Team burnout                                             │
│                                                              │
│  Solution:                                                  │
│  Strangler Fig pattern with incremental extraction.        │
└─────────────────────────────────────────────────────────────┘
```

### Pitfall 2: Distributed Monolith

```
┌─────────────────────────────────────────────────────────────┐
│            PITFALL: DISTRIBUTED MONOLITH                     │
│                                                              │
│  Symptoms:                                                  │
│  • Services must be deployed together                       │
│  • One service change breaks others                         │
│  • Shared database between services                         │
│  • Synchronous calls everywhere                             │
│                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐                │
│  │ Service │◀──▶│ Service │◀──▶│ Service │                │
│  │    A    │    │    B    │    │    C    │                │
│  └────┬────┘    └────┬────┘    └────┬────┘                │
│       │              │              │                       │
│       └──────────────┼──────────────┘                       │
│                      ▼                                       │
│              ┌──────────────┐                               │
│              │  Shared DB   │                               │
│              └──────────────┘                               │
│                                                              │
│  Solution:                                                  │
│  • Database per service                                     │
│  • Async communication where possible                       │
│  • Clear API contracts                                      │
└─────────────────────────────────────────────────────────────┘
```

### Pitfall 3: Ignoring Organizational Change

```
┌─────────────────────────────────────────────────────────────┐
│         PITFALL: IGNORING ORGANIZATIONAL CHANGE              │
│                                                              │
│  Mistake:                                                   │
│  "We'll just change the architecture, teams stay the same" │
│                                                              │
│  Reality:                                                   │
│  Microservices require:                                     │
│  • Cross-functional teams                                   │
│  • DevOps culture                                           │
│  • Service ownership                                        │
│  • On-call responsibilities                                 │
│                                                              │
│  Solution:                                                  │
│  • Align team structure with services                       │
│  • Train teams on new responsibilities                      │
│  • Build DevOps capabilities                                │
└─────────────────────────────────────────────────────────────┘
```

### Pitfall 4: Premature Optimization

```
┌─────────────────────────────────────────────────────────────┐
│            PITFALL: PREMATURE OPTIMIZATION                   │
│                                                              │
│  Mistake:                                                   │
│  "Let's add Kubernetes, service mesh, and event sourcing   │
│   before we extract our first service"                      │
│                                                              │
│  Reality:                                                   │
│  Start simple, add complexity as needed.                    │
│                                                              │
│  Progression:                                               │
│  1. Simple HTTP services                                    │
│  2. Add container orchestration when needed                 │
│  3. Add service mesh when complexity requires               │
│  4. Add event sourcing for specific use cases               │
│                                                              │
│  Solution:                                                  │
│  YAGNI - You Ain't Gonna Need It (yet)                     │
└─────────────────────────────────────────────────────────────┘
```

### Pitfall 5: No Exit Criteria

```
┌─────────────────────────────────────────────────────────────┐
│              PITFALL: NO EXIT CRITERIA                       │
│                                                              │
│  Mistake:                                                   │
│  "We'll keep extracting services until... forever?"         │
│                                                              │
│  Solution:                                                  │
│  Define clear goals:                                        │
│  • Which services will be extracted                         │
│  • What stays in monolith                                   │
│  • Success metrics                                          │
│  • Timeline                                                 │
│                                                              │
│  Example Goals:                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Goal                              │ Target │ Status │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Extract Product Service           │ Q1     │ Done   │   │
│  │ Extract Order Service             │ Q2     │ WIP    │   │
│  │ Extract Payment Service           │ Q3     │ Plan   │   │
│  │ Reduce monolith deploy time to 5m │ Q4     │ Plan   │   │
│  │ Independent team deployments      │ Q4     │ Plan   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Migration Checklist

```
┌─────────────────────────────────────────────────────────────┐
│              MIGRATION SUCCESS CHECKLIST                     │
│                                                              │
│  Preparation:                                               │
│  [ ] Platform capabilities in place                         │
│  [ ] Monitoring and alerting ready                          │
│  [ ] Team trained on new tools                              │
│  [ ] First service identified                               │
│                                                              │
│  Execution:                                                 │
│  [ ] Strangler facade deployed                              │
│  [ ] Feature flags configured                               │
│  [ ] Shadow testing passing                                 │
│  [ ] Data sync verified                                     │
│  [ ] Gradual rollout completed                              │
│  [ ] Rollback tested                                        │
│                                                              │
│  Validation:                                                │
│  [ ] Feature parity confirmed                               │
│  [ ] Performance equal or better                            │
│  [ ] Error rates stable                                     │
│  [ ] Team comfortable with operations                       │
│                                                              │
│  Cleanup:                                                   │
│  [ ] Old code removed from monolith                         │
│  [ ] Documentation updated                                  │
│  [ ] Lessons learned documented                             │
│  [ ] Next service planned                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Takeaways

1. **Start small** - Extract one low-risk service first
2. **Build platform first** - CI/CD, monitoring, logging
3. **Use feature flags** - Enable gradual rollout and instant rollback
4. **Maintain feature parity** - New service must behave identically
5. **Monitor everything** - Compare old vs new metrics
6. **Plan for rollback** - Always have an escape route
7. **Handle data carefully** - Use phased migration approach
8. **Communicate** - Keep stakeholders informed
9. **Avoid common pitfalls** - Big bang, distributed monolith, etc.
10. **Define exit criteria** - Know when you're done

---

## Module Summary

In this module, you learned:

- How to analyze and understand your monolith
- Domain-Driven Design basics for finding boundaries
- Techniques for identifying service boundaries
- The Strangler Fig pattern for incremental migration
- Multiple decomposition strategies
- Best practices and pitfalls to avoid

---

## What's Next?

In the next module, we will explore communication patterns between microservices, including synchronous and asynchronous approaches.

---
