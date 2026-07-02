# Pattern 4: Strangler Fig & Anti-Corruption Layer

## Strangler Fig Pattern

### What is it?

Incrementally migrate from monolith to microservices by gradually replacing functionality. Named after strangler fig trees that grow around host trees.

### How it Works

1. **Identify** bounded context to extract
2. **Add facade** in front of monolith
3. **Build** new microservice
4. **Redirect** traffic to new service
5. **Remove** old code from monolith
6. **Repeat** for next context

### When to Use

- Migrating legacy monolith
- Need zero-downtime migration
- Want incremental, low-risk approach

---

## Anti-Corruption Layer (ACL)

### What is it?

A translation layer that isolates your new system from legacy/external systems. Prevents "corruption" of your domain model.

### Purpose

- **Translate** between different data models
- **Isolate** from legacy system changes
- **Protect** clean architecture from external mess

### When to Use

- Integrating with legacy systems
- Working with poorly designed external APIs
- Protecting domain model purity

---

## Key Takeaways

- **Strangler Fig** = gradual migration strategy
- **ACL** = protective translation layer
- Both reduce risk when dealing with legacy systems

---

## 📊 Eraser.io Diagram Code

```eraser
// Strangler Fig Migration
Client [icon: monitor]
Facade Router [icon: git-branch, color: blue]

// New Microservices
Users Service [icon: users, color: green]
Orders Service [icon: shopping-cart, color: green]

// Legacy Monolith
Monolith [icon: server, color: red] {
  Reports Module [icon: file-text]
  Admin Module [icon: settings]
}

Client --> Facade Router
Facade Router --> Users Service: Migrated
Facade Router --> Orders Service: Migrated
Facade Router --> Monolith: Legacy routes
```

```eraser
// Anti-Corruption Layer
New Service [icon: server, color: green]
ACL [icon: shield, color: orange] {
  Translator [icon: repeat]
  Adapter [icon: link]
}
Legacy System [icon: server, color: red]

New Service --> ACL: Clean domain model
ACL --> Legacy System: Legacy format
Legacy System --> ACL: Legacy response
ACL --> New Service: Translated response
```
