# Pattern 10: Externalized Configuration

## What is it?

Store configuration outside the application code. Configuration varies by environment but code stays the same.

---

## The Principle

- **Code** = same across all environments
- **Config** = different per environment (dev, staging, prod)
- **Never** hardcode environment-specific values

---

## What to Externalize

| Externalize        | Don't Externalize  |
| ------------------ | ------------------ |
| Database URLs      | Business logic     |
| API keys & secrets | Application code   |
| Feature flags      | Static defaults    |
| Service endpoints  | Internal constants |
| Logging levels     |                    |

---

## Configuration Sources

### 1. Environment Variables

- Simple and universal
- Supported by all platforms
- 12-Factor App recommended

### 2. Config Files

- YAML, JSON, .env files
- Good for complex config
- Version controlled (except secrets)

### 3. Config Server

- Centralized configuration service
- Dynamic updates without restart
- Tools: Consul, Spring Cloud Config, AWS Parameter Store

### 4. Secrets Management

- Dedicated for sensitive data
- Encrypted at rest
- Tools: Vault, AWS Secrets Manager, K8s Secrets

---

## Configuration Hierarchy

Priority (highest to lowest):

1. Command line arguments
2. Environment variables
3. Config files
4. Default values in code

---

## Feature Flags

Toggle features without deployment:

| Flag          | Dev  | Staging | Prod  |
| ------------- | ---- | ------- | ----- |
| NEW_CHECKOUT  | true | true    | false |
| BETA_FEATURES | true | false   | false |

**Tools:** LaunchDarkly, Unleash, ConfigCat

---

## Best Practices

✅ **Do:**

- Use environment variables for simple config
- Use secrets manager for sensitive data
- Validate config at startup
- Document all config options

❌ **Don't:**

- Commit secrets to git
- Hardcode URLs or credentials
- Mix config with code logic

---

## Key Takeaways

- **Externalize** all environment-specific config
- Use **env vars** for simple cases
- Use **secrets manager** for credentials
- **Feature flags** enable safe deployments
- Follows 12-Factor App methodology

---

## 📊 Eraser.io Diagram Code

```eraser
// Externalized Configuration
Service A [icon: server, color: blue]
Service B [icon: server, color: blue]
Service C [icon: server, color: blue]

Config Server [icon: settings, color: orange] {
  Dev Config [icon: file]
  Staging Config [icon: file]
  Prod Config [icon: file]
}

Secrets Manager [icon: lock, color: red] {
  DB Credentials [icon: key]
  API Keys [icon: key]
}

Feature Flags [icon: toggle-left, color: purple]

Service A --> Config Server: Fetch config
Service B --> Config Server: Fetch config
Service C --> Config Server: Fetch config
Service A --> Secrets Manager: Get secrets
Service B --> Secrets Manager: Get secrets
Service A --> Feature Flags: Check flags
```

```eraser
// Configuration Hierarchy
Command Line Args [icon: terminal, color: red]
Environment Variables [icon: box, color: orange]
Config Files [icon: file, color: blue]
Default Values [icon: code, color: gray]

Command Line Args --> Environment Variables: Override
Environment Variables --> Config Files: Override
Config Files --> Default Values: Override
```
