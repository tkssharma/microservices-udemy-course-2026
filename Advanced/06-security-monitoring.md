# Security Monitoring for Microservices

## Overview

Security monitoring detects attacks, unauthorized access, and abnormal behavior in your microservices ecosystem. It's essential for protecting your systems and meeting compliance requirements.

---

## Security Monitoring Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Monitoring                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ API Gateway │  │ Auth Service│  │   WAF       │         │
│  │   Logs      │  │    Logs     │  │   Logs      │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┴────────────────┘                 │
│                          │                                  │
│                          ▼                                  │
│              ┌─────────────────────┐                        │
│              │   Security SIEM     │                        │
│              │  (OpenSearch/ELK)   │                        │
│              └──────────┬──────────┘                        │
│                         │                                   │
│         ┌───────────────┼───────────────┐                   │
│         ▼               ▼               ▼                   │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │
│  │   Alerts    │ │ Dashboards  │ │  Reports    │           │
│  └─────────────┘ └─────────────┘ └─────────────┘           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentication Monitoring

### JWT/OAuth Logging

```typescript
// auth.service.ts
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  async validateToken(token: string, req: Request) {
    const clientIp = req.headers['x-forwarded-for'] || req.ip;
    const userAgent = req.headers['user-agent'];

    try {
      const decoded = this.jwtService.verify(token);
      
      this.logger.log({
        event: 'auth.token.validated',
        userId: decoded.sub,
        clientIp,
        userAgent,
        tokenExp: decoded.exp,
      });
      
      return decoded;
    } catch (error) {
      this.logger.warn({
        event: 'auth.token.invalid',
        reason: error.message,
        clientIp,
        userAgent,
        tokenSnippet: token.substring(0, 20) + '...',
      });
      
      throw new UnauthorizedException();
    }
  }

  async login(credentials: LoginDto, req: Request) {
    const clientIp = req.headers['x-forwarded-for'] || req.ip;
    const userAgent = req.headers['user-agent'];

    const user = await this.validateCredentials(credentials);

    if (!user) {
      this.logger.warn({
        event: 'auth.login.failed',
        username: credentials.username,
        clientIp,
        userAgent,
        reason: 'invalid_credentials',
      });
      
      // Track failed attempts
      await this.trackFailedLogin(credentials.username, clientIp);
      
      throw new UnauthorizedException();
    }

    this.logger.log({
      event: 'auth.login.success',
      userId: user.id,
      username: user.username,
      clientIp,
      userAgent,
    });

    return this.generateTokens(user);
  }

  async logout(userId: string, req: Request) {
    this.logger.log({
      event: 'auth.logout',
      userId,
      clientIp: req.ip,
    });
  }
}
```

### Failed Login Tracking

```typescript
// brute-force-protection.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class BruteForceProtectionService {
  private readonly logger = new Logger(BruteForceProtectionService.name);
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION = 900; // 15 minutes

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async trackFailedLogin(username: string, ip: string) {
    const userKey = `failed_login:user:${username}`;
    const ipKey = `failed_login:ip:${ip}`;

    const [userAttempts, ipAttempts] = await Promise.all([
      this.redis.incr(userKey),
      this.redis.incr(ipKey),
    ]);

    await Promise.all([
      this.redis.expire(userKey, this.LOCKOUT_DURATION),
      this.redis.expire(ipKey, this.LOCKOUT_DURATION),
    ]);

    if (userAttempts >= this.MAX_ATTEMPTS) {
      this.logger.warn({
        event: 'security.brute_force.user_locked',
        username,
        attempts: userAttempts,
        lockoutMinutes: this.LOCKOUT_DURATION / 60,
      });
    }

    if (ipAttempts >= this.MAX_ATTEMPTS * 2) {
      this.logger.warn({
        event: 'security.brute_force.ip_blocked',
        ip,
        attempts: ipAttempts,
      });
    }
  }

  async isLocked(username: string, ip: string): Promise<boolean> {
    const [userAttempts, ipAttempts] = await Promise.all([
      this.redis.get(`failed_login:user:${username}`),
      this.redis.get(`failed_login:ip:${ip}`),
    ]);

    return (
      parseInt(userAttempts || '0') >= this.MAX_ATTEMPTS ||
      parseInt(ipAttempts || '0') >= this.MAX_ATTEMPTS * 2
    );
  }
}
```

---

## API Rate Limiting & Abuse Detection

### Rate Limiter with Logging

```typescript
// rate-limiter.guard.ts
import { Injectable, CanActivate, ExecutionContext, HttpException, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class RateLimiterGuard implements CanActivate {
  private readonly logger = new Logger(RateLimiterGuard.name);
  private readonly WINDOW_SIZE = 60; // 1 minute
  private readonly MAX_REQUESTS = 100;

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const clientIp = request.headers['x-forwarded-for'] || request.ip;
    const userId = request.user?.id || 'anonymous';
    const endpoint = `${request.method}:${request.route?.path || request.path}`;

    const key = `rate_limit:${userId}:${endpoint}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, this.WINDOW_SIZE);
    }

    if (current > this.MAX_REQUESTS) {
      this.logger.warn({
        event: 'security.rate_limit.exceeded',
        userId,
        clientIp,
        endpoint,
        requests: current,
        limit: this.MAX_REQUESTS,
        windowSeconds: this.WINDOW_SIZE,
      });

      throw new HttpException('Too Many Requests', 429);
    }

    // Log suspicious activity (high rate but under limit)
    if (current > this.MAX_REQUESTS * 0.8) {
      this.logger.log({
        event: 'security.rate_limit.warning',
        userId,
        clientIp,
        endpoint,
        requests: current,
        percentOfLimit: Math.round((current / this.MAX_REQUESTS) * 100),
      });
    }

    return true;
  }
}
```

### Anomaly Detection Metrics

```typescript
// security-metrics.service.ts
import { Injectable } from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class SecurityMetricsService {
  constructor(
    @InjectMetric('auth_attempts_total')
    private readonly authAttempts: Counter<string>,

    @InjectMetric('rate_limit_hits_total')
    private readonly rateLimitHits: Counter<string>,

    @InjectMetric('suspicious_requests_total')
    private readonly suspiciousRequests: Counter<string>,
  ) {}

  recordAuthAttempt(success: boolean, method: string) {
    this.authAttempts.inc({
      success: success.toString(),
      method, // 'password', 'oauth', 'api_key'
    });
  }

  recordRateLimitHit(endpoint: string, userId: string) {
    this.rateLimitHits.inc({ endpoint, userId });
  }

  recordSuspiciousRequest(type: string, details: string) {
    this.suspiciousRequests.inc({ type, details });
  }
}
```

---

## Sensitive Data Protection

### PII Masking in Logs

```typescript
// log-sanitizer.ts
export class LogSanitizer {
  private static readonly SENSITIVE_FIELDS = [
    'password',
    'token',
    'authorization',
    'apiKey',
    'api_key',
    'secret',
    'creditCard',
    'credit_card',
    'ssn',
    'socialSecurity',
  ];

  private static readonly PII_PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    ssn: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
  };

  static sanitize(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      
      // Redact sensitive fields
      if (this.SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Recursively sanitize nested objects
      if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitize(sanitized[key]);
      }

      // Mask PII in string values
      if (typeof sanitized[key] === 'string') {
        sanitized[key] = this.maskPII(sanitized[key]);
      }
    }

    return sanitized;
  }

  static maskPII(value: string): string {
    let masked = value;
    
    // Mask email: john.doe@example.com -> j***@example.com
    masked = masked.replace(this.PII_PATTERNS.email, (email) => {
      const [local, domain] = email.split('@');
      return `${local[0]}***@${domain}`;
    });

    // Mask credit card: 1234-5678-9012-3456 -> ****-****-****-3456
    masked = masked.replace(this.PII_PATTERNS.creditCard, (cc) => {
      return `****-****-****-${cc.slice(-4)}`;
    });

    return masked;
  }
}
```

### Audit Logging

```typescript
// audit.service.ts
import { Injectable, Logger } from '@nestjs/common';

export interface AuditEvent {
  action: string;
  actor: {
    userId: string;
    username: string;
    ip: string;
  };
  resource: {
    type: string;
    id: string;
  };
  changes?: {
    before?: any;
    after?: any;
  };
  result: 'success' | 'failure';
  reason?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('AUDIT');

  log(event: AuditEvent) {
    this.logger.log({
      event: 'audit.action',
      ...event,
      timestamp: new Date().toISOString(),
    });
  }

  logDataAccess(userId: string, resourceType: string, resourceId: string, action: string) {
    this.logger.log({
      event: 'audit.data_access',
      userId,
      resourceType,
      resourceId,
      action,
      timestamp: new Date().toISOString(),
    });
  }

  logPrivilegedAction(userId: string, action: string, details: any) {
    this.logger.warn({
      event: 'audit.privileged_action',
      userId,
      action,
      details,
      timestamp: new Date().toISOString(),
    });
  }
}
```

---

## Security Alerts

### Prometheus Alert Rules

```yaml
# security-alerts.yml
groups:
  - name: security
    rules:
      # Brute Force Detection
      - alert: BruteForceAttack
        expr: |
          sum(increase(auth_attempts_total{success="false"}[5m])) by (ip) > 20
        for: 1m
        labels:
          severity: critical
          category: security
        annotations:
          summary: "Possible brute force attack from {{ $labels.ip }}"
          description: "{{ $value }} failed auth attempts in 5 minutes"

      # Unusual Login Location
      - alert: UnusualLoginActivity
        expr: |
          sum(increase(auth_attempts_total{success="true"}[1h])) by (userId, country) > 1
          and on(userId) count(auth_login_countries) by (userId) > 2
        for: 0m
        labels:
          severity: warning
          category: security
        annotations:
          summary: "User logging in from multiple countries"

      # Rate Limit Abuse
      - alert: RateLimitAbuse
        expr: |
          sum(increase(rate_limit_hits_total[5m])) by (userId) > 50
        for: 5m
        labels:
          severity: warning
          category: security
        annotations:
          summary: "User {{ $labels.userId }} hitting rate limits repeatedly"

      # Elevated Error Rate (potential attack)
      - alert: SuspiciousErrorSpike
        expr: |
          sum(increase(http_requests_total{status=~"4.."}[5m])) by (ip)
          / sum(increase(http_requests_total[5m])) by (ip) > 0.5
        for: 5m
        labels:
          severity: warning
          category: security
        annotations:
          summary: "High 4xx error rate from IP {{ $labels.ip }}"

      # Unauthorized Access Attempts
      - alert: UnauthorizedAccessSpike
        expr: |
          sum(increase(http_requests_total{status="401"}[5m])) > 100
        for: 2m
        labels:
          severity: critical
          category: security
        annotations:
          summary: "Spike in 401 unauthorized responses"

      # SQL Injection Attempt (based on WAF logs)
      - alert: SQLInjectionAttempt
        expr: |
          sum(increase(waf_blocked_requests_total{rule="sql_injection"}[5m])) > 10
        for: 1m
        labels:
          severity: critical
          category: security
        annotations:
          summary: "SQL injection attempts detected"
```

---

## Security Dashboard Panels

### Grafana Dashboard JSON

```json
{
  "title": "Security Monitoring",
  "panels": [
    {
      "title": "Failed Login Attempts",
      "type": "timeseries",
      "targets": [
        {
          "expr": "sum(rate(auth_attempts_total{success=\"false\"}[5m])) by (reason)",
          "legendFormat": "{{reason}}"
        }
      ]
    },
    {
      "title": "Rate Limit Hits",
      "type": "stat",
      "targets": [
        {
          "expr": "sum(increase(rate_limit_hits_total[1h]))",
          "instant": true
        }
      ]
    },
    {
      "title": "Top Blocked IPs",
      "type": "table",
      "targets": [
        {
          "expr": "topk(10, sum(increase(auth_attempts_total{success=\"false\"}[24h])) by (ip))",
          "format": "table",
          "instant": true
        }
      ]
    },
    {
      "title": "Security Events by Type",
      "type": "piechart",
      "targets": [
        {
          "expr": "sum(increase(security_events_total[24h])) by (type)",
          "legendFormat": "{{type}}"
        }
      ]
    }
  ]
}
```

---

## API Gateway Security Logs

### Kong Gateway Logging

```yaml
# kong.yml
plugins:
  - name: http-log
    config:
      http_endpoint: http://fluent-bit:8080/kong
      method: POST
      content_type: application/json
      custom_fields_by_lua:
        security_event: |
          return {
            client_ip = kong.client.get_ip(),
            authenticated_user = kong.client.get_credential(),
            rate_limited = kong.ctx.shared.rate_limited or false,
          }

  - name: ip-restriction
    config:
      deny:
        - 10.0.0.0/8  # Example blocked range

  - name: bot-detection
    config:
      deny:
        - known-bots
```

---

## Key Security Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Failed logins/min | Authentication failures | > 10/min from same IP |
| Rate limit hits | API abuse attempts | > 50 in 5 min |
| 401 responses | Unauthorized access | Spike > 100 in 5 min |
| Unique IPs/user | Login anomaly | > 3 countries/hour |
| WAF blocks | Attack detection | Any critical rule |

---

## Key Takeaways

1. **Log security events** - Auth, access, rate limits
2. **Protect PII** - Mask sensitive data in logs
3. **Track anomalies** - Failed logins, unusual patterns
4. **Alert on attacks** - Brute force, injection attempts
5. **Audit trail** - Who did what and when

---

## Next Steps

- Integrate with SIEM platform
- Set up automated response (ban IPs)
- Implement threat intelligence feeds
