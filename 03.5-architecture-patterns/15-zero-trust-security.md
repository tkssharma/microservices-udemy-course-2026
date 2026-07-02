# Pattern 15: Zero Trust Security

## What is it?

Security model where no request is trusted by default. Every request must be authenticated and authorized, regardless of source.

---

## Core Principle

> "Never trust, always verify"

Traditional: Trust inside network, verify outside  
Zero Trust: Verify everything, everywhere

---

## Key Principles

| Principle             | Description                       |
| --------------------- | --------------------------------- |
| **Verify explicitly** | Always authenticate and authorize |
| **Least privilege**   | Minimum access needed             |
| **Assume breach**     | Design as if already compromised  |

---

## Implementation Layers

### 1. Identity Verification

- **JWT tokens** - Stateless authentication
- **OAuth 2.0 / OIDC** - Standard protocols
- **API keys** - Service-to-service auth

### 2. Network Security

- **mTLS** - Mutual TLS between services
- **Network policies** - Kubernetes network rules
- **Service mesh** - Encrypted communication

### 3. Authorization

- **RBAC** - Role-based access control
- **ABAC** - Attribute-based access control
- **Policy engines** - OPA, Casbin

### 4. API Gateway

- Token validation
- Rate limiting
- IP allowlisting

---

## Zero Trust Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                                                              │
│   ┌─────────┐      ┌─────────────┐      ┌─────────────┐    │
│   │ Client  │─JWT─▶│ API Gateway │─────▶│   Service   │    │
│   └─────────┘      │ • Validate  │      │ • Verify    │    │
│                    │ • Rate limit│      │ • Authorize │    │
│                    └─────────────┘      └──────┬──────┘    │
│                                                │            │
│                                          mTLS  │            │
│                                                ▼            │
│                                         ┌─────────────┐    │
│                                         │  Service B  │    │
│                                         │ • Verify    │    │
│                                         │ • Authorize │    │
│                                         └─────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Common Tools

| Category         | Tools                      |
| ---------------- | -------------------------- |
| **Identity**     | Auth0, Keycloak, Okta      |
| **Secrets**      | Vault, AWS Secrets Manager |
| **Policy**       | OPA, Casbin                |
| **Service Mesh** | Istio, Linkerd             |
| **API Gateway**  | Kong, AWS API Gateway      |

---

## Best Practices

### Authentication

- Use short-lived tokens
- Implement token refresh
- Validate tokens at every service

### Authorization

- Check permissions on every request
- Use fine-grained policies
- Audit access regularly

### Secrets

- Never hardcode secrets
- Rotate secrets automatically
- Use secrets manager

### Monitoring

- Log all access attempts
- Alert on anomalies
- Monitor for breaches

---

## Microservices Security Checklist

- [ ] mTLS between all services
- [ ] JWT validation at gateway AND services
- [ ] Rate limiting enabled
- [ ] Secrets in Vault/Secrets Manager
- [ ] Network policies defined
- [ ] Audit logging enabled
- [ ] Regular security scanning

---

## Key Takeaways

- **Zero Trust** = verify every request
- Use **JWT + mTLS** for authentication
- Implement **authorization at each service**
- **Secrets management** is critical
- **Monitor and audit** all access

---

## 📊 Eraser.io Diagram Code

```eraser
// Zero Trust Architecture
Client [icon: monitor, color: blue]
API Gateway [icon: server, color: orange] {
  JWT Validation [icon: check]
  Rate Limiting [icon: gauge]
}

Identity Provider [icon: users, color: purple]
Policy Engine [icon: shield, color: red]
Secrets Vault [icon: lock, color: green]

Service A [icon: server, color: blue]
Service B [icon: server, color: blue]

Client --> Identity Provider: 1. Authenticate
Identity Provider --> Client: 2. JWT token
Client --> API Gateway: 3. Request + JWT
API Gateway --> Policy Engine: 4. Check policies
API Gateway --> Service A: 5. Forward if allowed
Service A <--> Service B: mTLS
Service A --> Secrets Vault: Get secrets
```

```eraser
// Authentication Flow
User [icon: user, color: blue]
Auth Service [icon: lock, color: orange]
API Gateway [icon: server, color: green]
Protected Service [icon: shield, color: purple]

User --> Auth Service: 1. Login credentials
Auth Service --> User: 2. JWT access token
User --> API Gateway: 3. Request + Bearer token
API Gateway --> API Gateway: 4. Validate JWT
API Gateway --> Protected Service: 5. Forward with claims
Protected Service --> Protected Service: 6. Check permissions
Protected Service --> User: 7. Response
```
